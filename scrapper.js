const puppeteer = require('puppeteer');
const aws = require('aws-sdk');
const ses = new aws.SES({
    region: 'us-east-1'
});

const getPageValues = async () => {
    const browser = await puppeteer.launch({
        headless: false
    });
    const page = await browser.newPage();

    await page.goto('https://liqui.io/Interest');

    await timeout(12000);

    let value1 = await page.evaluate("$('#content > div.white.purse-block.separate-block > div > div > div.col-md-4.col-xs-6.purse-my-coins > table > tbody > tr.currency.pointer.active-currency > td.coins-value.wallet-before-active').html()")
    value1 ? value1 = getValueAndText(value1) : value1 = { value: 0 }
    let value2 = await page.evaluate("$('#content > div.white.purse-block.separate-block > div > div > div.col-md-4.col-xs-6.purse-my-coins > table > tbody > tr:nth-child(2) > td.coins-value.wallet-before-active').html()")
    value2 ? value2 = getValueAndText(value2) : value2 = { value: 0 }

    browser.close()

    return { value1, value2 }
}

const getValueAndText = (v) => {
    return {
        value: v.slice(0, -4),
        text: v.slice(v.length - 3)
    }
}

const timeout = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const getText = async () => {
    const values = await getPageValues()
    let text = ''

    console.log(values)

    if (values.value1.value && parseFloat(values.value1.value) > parseFloat(0, 01)) {
        text += values.value1.text + ': ' + values.value1.value + '\n'
    }
    if (values.value2.value && parseFloat(values.value2.value) > parseFloat(0, 01)) {
        text += values.value2.text + ': ' + values.value2.value + '\n'
    }

    return text
}

exports.handler = function (event, context) {
    console.log("Incoming: ", event);

    const text = await getText()
    if (text == '') {
        console.log('Nothing changed')
    } else {

        let eParams = {
            Destination: {
                ToAddresses: ["jefersonebs@gmail.com"]
            },
            Message: {
                Body: {
                    Text: {
                        Data: text
                    }
                },
                Subject: {
                    Data: "Hey! New values from liquid io"
                }
            },
            Source: "jefersonebs@gmail.com"
        };

        console.log('Sending...');

        let email = ses.sendEmail(eParams, function (err, data) {
            if (err) console.log(err);
            else {
                console.log("Email sent")
                context.succeed(event)
            }
        });
    }
}

/*const run = async () => {
    const text = await getText()
    if (text == '') {
        console.log('Nothing changed')
    } else {
        console.log('shoot email')
    }
}*/