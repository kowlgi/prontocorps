const TwilioSMSBot = require('botkit-sms')
const controller = TwilioSMSBot({
    account_sid: process.env.TWILIO_ACCOUNT_SID,
    auth_token: process.env.TWILIO_AUTH_TOKEN,
    twilio_number: process.env.TWILIO_NUMBER
});

const ProgramToken = "prg-75a61d12-a518-4e79-9280-5c73b0e5c73a";
const Hyperwallet = require('hyperwallet-sdk')
var hyperwalletclient = new Hyperwallet({
    username: "restapiuser@6626871617",
    password: "Pongy2008!",
    programToken: ProgramToken,
    server: "https://api.sandbox.hyperwallet.com",
});

const firstNameKey = 'firstName';
const lastNameKey = 'lastName';
const debitCardNumber = 'debitCardNumber';
const debitCardExpirationDate = 'debitCardExpiration';

const bot = controller.spawn({})
var currentClientId;
var currentUserToken;
var currentUserPhoneNumber;
var currentTransferToken;

controller.setupWebserver(process.env.PORT, function (err, webserver) {
    controller.createWebhookEndpoints(controller.webserver, bot, function () {
        console.log('TwilioSMSBot is online!')
    })
})

function logResponse(callback) {
    return function (error, body, res) {
        if (error) {
            console.log("ERROR: " + JSON.stringify(error, null, 4));
        } else {
            //console.log("RESPONSE: " + JSON.stringify(body, null, 4));
        }
        callback(error, body, res);
    };
}

controller.hears('.*', 'message_received', (bot, message) => {
    var askToContinueOnboarding = function(err, convo) {
        convo.ask('Hi I am Pronto, a relief organization here to help you and your family. We distribute grants directly to you to help you through these hard times. If you’d like to register with us, reply YES. If you’d like more information about our program, reply INFO.', function(response, convo) {
            askFirstname({}, convo);
            convo.next()
        });
    };

    var askFirstname = function(err, convo) {
        convo.ask('Thank you. What is your first name?', function(response, convo) {
            askLastName({}, convo);
            convo.next()
        }, {key: firstNameKey});
    }

    var askLastName = function(err, convo) {
        convo.ask('What is your last name?', function(response, convo) {
            createUser(err, convo)
            askDebitCardNumber(err, convo)
            convo.next()
        }, {key: lastNameKey});
    }

    var createUser = function(err, convo) {
        const rand = Math.floor(Math.random() * (1000000000 - 1)) + 1;
        hyperwalletclient.createUser({
            clientUserId: rand,
            profileType: "INDIVIDUAL",
            firstName: convo.extractResponse(firstNameKey),
            lastName: convo.extractResponse(lastNameKey),
            email: "testmail-" + rand + "@hyperwallet.com",
            addressLine1: "123 Main Street",
            city: "Austin",
            stateProvince: "TX",
            country: "US",
            postalCode: "78701",
            ProgramToken,
        }, logResponse(function (error, body) {
            if (!error) {
                currentClientId = rand
                currentUserToken = body.token;
                console.log("userToken: " + currentUserToken)
            }
        }));
    }

    var askDebitCardNumber = function(err, convo) {
        convo.ask('What is your debit card number?', function(response, convo) {
            askDebitCardExpirationDate(err, convo);
            convo.next()
        }, {key: debitCardNumber});
    }

    var askDebitCardExpirationDate = function(err, convo) {
        convo.ask('What is your debit card expiration date (YYYY-MM)?', function(response, convo) {
            setTransferMethod(err, convo);
        }, {key: debitCardExpirationDate});
    }

    var setTransferMethod = function(err, convo) {
        const headers = {};
        hyperwalletclient.client.doPost(
            `users/${encodeURIComponent(currentUserToken)}/transfer-methods`,
            {
                transferMethodCountry: "US",
                transferMethodCurrency: "USD",
                type: "BANK_CARD",
                cardNumber: convo.extractResponse(debitCardNumber),
                dateOfExpiry: convo.extractResponse(debitCardExpirationDate)
            },
            headers,
            logResponse(function (error, body) {
                if (!error) {
                    currentTransferToken = body.token;
                    console.log("Transfer method token = " + body.token);
                    partingSuccessMessage(err, convo);
                } else {
                    partingErrorMessage(err, convo);
                }
                convo.next()
            }));
        }

        var partingSuccessMessage = function(err, convo) {
            convo.say(`Thank you very much, ${convo.extractResponse(firstNameKey)}, your Pronto account is ready. We will allocate funds to your account immediately.`);
            convo.next()
        }

        var partingErrorMessage = function(err, convo) {
            convo.say('Sorry there was an error during registration. Please try again.');
            convo.next()
        }

        currentUserPhoneNumber = message.from;
        bot.startConversation(message, askToContinueOnboarding);
    })

    var twilio = require('twilio');
    var client = new twilio.RestClient(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

    var createPayment = function(amountPayable) {
        const rand = Math.floor(Math.random() * (1000000000 - 1)) + 1;
        hyperwalletclient.createPayment({
            destinationToken: currentUserToken,
            ProgramToken,
            clientPaymentId: "nsdk-" + rand,
            currency: "USD",
            amount: amountPayable,
            purpose: "OTHER",
        }, logResponse(function (error, body) {
            if (!error) {
                // send SMS
                client.messages.create({
                    body: amountPayable + " has been deposited to your debit card!",
                    to: currentUserPhoneNumber,  // Text this number
                    from: process.env.TWILIO_NUMBER // From a valid Twilio number
                }, function(err, message) {
                });
            } else {
                // do nothing
            }
        }));
    }
    
    // set up webpage for making payments
    const jade = require('jade')
    const express = require('express')
    const compression = require('compression')
    const bodyParser = require('body-parser')
    const app = express()
    const path = require('path')

    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: false }));
    app.set('port', 3005)
    app.set('views', path.join(__dirname, 'views'))
    app.set('view engine', 'jade')

    const Router = express.Router();
    Router.get('/', function(req, res, next) {
        res.render('pay.jade')
    });

    Router.post('/create-payment', function(req, res, next) {
        createPayment(req.body.paymentAmount);
        res.redirect('/')
    });
    app.use('/', Router);

    http = require('http')
    // Start server
    http.createServer(app).listen(app.get('port'), function() {
        console.log('Express listening on port ' + app.get('port'));
    });
