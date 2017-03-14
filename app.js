const TwilioSMSBot = require('botkit-sms')
const controller = TwilioSMSBot({
    account_sid: process.env.TWILIO_ACCOUNT_SID,
    auth_token: process.env.TWILIO_AUTH_TOKEN,
    twilio_number: process.env.TWILIO_NUMBER
});

const Hyperwallet = require('hyperwallet-sdk')
var hyperwalletclient = new Hyperwallet({
    username: "restapiuser@6626871617",
    password: "Pongy2008!",
    programToken: "prg-75a61d12-a518-4e79-9280-5c73b0e5c73a"
});

const firstNameKey = 'firstName';
const lastNameKey = 'lastName';
const debitCardNumber = 'debitCardNumber';
const debitCardExpirationDate = 'debitCardExpiration';

const bot = controller.spawn({})

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
            console.log("RESPONSE: " + JSON.stringify(body, null, 4));
        }
        callback(error, body, res);
    };
}

controller.hears('.*', 'message_received', (bot, message) => {
    var greeting = function(err, convo){
        convo.say('Hi, I am Pronto, an SMS bot for disaster relief. I am going to help you get access to funds so you can get back on track.')
        askToContinueOnboarding({}, convo);
        convo.next();
    };

    var askToContinueOnboarding = function(err, convo) {
        convo.ask('Do you want me to register you?', function(response, convo) {
            convo.say(`${response.text} love it!`);
            askFirstname({}, convo);
            convo.next()
        });
    };

    var askFirstname = function(err, convo) {
        convo.ask('What is your first name?', function(response, convo) {
            askLastName({}, convo);
            convo.next()
        }, {key: firstNameKey});
    }

    var askLastName = function(err, convo) {
        convo.ask('What is your last name?', function(response, convo) {
            createUser(convo)
            convo.next()
        }, {key: lastNameKey});
    }

    var createUser = function(err, convo) {
        const rand = Math.floor(Math.random() * (1000000000 - 1)) + 1;
        hyperwallet.createUser({
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
            programToken,
        }, logResponse(function (error, body) {
            if (!error) {
                askDebitCardNumber({}, convo);
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
            convo.next()
        }, {key: debitCardExpirationDate});
    }

    bot.startConversation(message, greeting);
})
