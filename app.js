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
    programToken: ProgramToken
});

const firstNameKey = 'firstName';
const lastNameKey = 'lastName';
const debitCardNumber = 'debitCardNumber';
const debitCardExpirationDate = 'debitCardExpiration';

const bot = controller.spawn({})
const currentClientId;
const clientIdLookup = {}

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
        convo.ask('Hi, I am Pronto, a SMS bot for disaster relief. I am going to help you get access to funds so you can get back on track. Do you want go ahead and register yourself?', function(response, convo) {
            askFirstname({}, convo);
            convo.next()
        });
    };

    var askFirstname = function(err, convo) {
        convo.ask('Great, let me start noting down your personal details. What is your first name?', function(response, convo) {
            askLastName({}, convo);
            convo.next()
        }, {key: firstNameKey});
    }

    var askLastName = function(err, convo) {
        convo.ask('What is your last name?', function(response, convo) {
            createUser(err, convo)
            convo.next()
        }, {key: lastNameKey});
    }

    var createUser = function(err, convo) {
        const currentClientId = Math.floor(Math.random() * (1000000000 - 1)) + 1;
        hyperwalletclient.createUser({
            clientUserId: currentClientId,
            profileType: "INDIVIDUAL",
            firstName: convo.extractResponse(firstNameKey),
            lastName: convo.extractResponse(lastNameKey),
            email: "testmail-" + currentClientId + "@hyperwallet.com",
            addressLine1: "123 Main Street",
            city: "Austin",
            stateProvince: "TX",
            country: "US",
            postalCode: "78701",
            ProgramToken,
        }, logResponse(function (error, body) {
            if (!error) {
                clientIdLookup[currentClientId] = body.token;
                askDebitCardNumber({}, convo);
                convo.next();
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
        convo.ask('What is your debit card expiration date?', function(response, convo) {
            setTransferMethod(err, convo);
            convo.next()
        }, {key: debitCardExpirationDate});
    }

    var setTransferMethod = function(err, convo) {
        const rand = Math.floor(Math.random() * (1000000000 - 1)) + 1;
        hyperwalletclient.createBankAccount(clientIdLookup[currentClientId] /* usertoken */, {
            transferMethodCountry: "US",
            transferMethodCurrency: "USD",
            type: "BANK_ACCOUNT",
            branchId: "121122676",
            bankAccountPurpose: "CHECKING",
            bankAccountId: convo.extractResponse(debitCardNumber),
        }, logResponse(function (error, body) {
            if (!error) {
                console.log("Transfer method token = " + body.token);
            }
        }));
    }
    bot.startConversation(message, askToContinueOnboarding);
})
