let ChromeInstaller = require('@hackstudio/puppeteer-lambda-launcher')

const aws = require('aws-sdk');
const ses = new aws.SES({
    region: process.env.SES_REGION
})

ChromeInstaller = new ChromeInstaller({
    accessKeyId: process.env.ACCESS_KEY_ID,
    secretAccessKey: process.env.SECRET_ACCESS_KEY,
    s3Bucket: process.env.CHROMIUM_S3_BUCKET, s3Key: process.env.CHROMIUM_S3_KEY,
    executePath: process.env.CHROMIUM_S3_EXECUTABLE // Name of executable path when chromium uncompressed 
})

const getPageValues = function () {
    return new Promise(function (resolve, reject) {
        let browser;
        let page;
        let values = {}

        ChromeInstaller.setupChrome()
            .then(function () {

                // if chromium is not installed, we will download, decompress it and install in /tmp folder  
                const chromePath = ChromeInstaller.executablePath

                // Launch puppeteer

                const args = [
                    '--no-sandbox',
                    '--disable-gpu',
                    '--disable-setuid-sandbox',
                    '--single-process',
                    '--headless'
                ]
                const puppeteer = require('puppeteer')
                puppeteer.launch({
                    headless: true,
                    executablePath: chromePath,
                    args: args
                }).then(function (cBrowser) {
                    browser = cBrowser
                    return browser.newPage()
                }).then(function (cPage) {
                    page = cPage
                    return page.goto('https://liqui.io/Interest')
                }).then(function () {
                    return page.waitForNavigation({ waitUntil: 'networkidle2' })
                }).then(function () {
                    return page.evaluate("$('#content > div.white.purse-block.separate-block > div > div > div.col-md-4.col-xs-12.purse-limit > p > span').html()")
                }).then(function (value) {
                    console.log(value)
                    value ? values.value1 = value : values.value1 = 0;
                    return page.click('#content > div.white.purse-block.separate-block > div > div > div.col-md-4.col-xs-6.purse-my-coins > table > tbody > tr:nth-child(2) > td.coins-name')
                }).then(function () {
                    return page.waitFor(1500)
                }).then(function (value) {
                    return page.evaluate("$('#content > div.white.purse-block.separate-block > div > div > div.col-md-4.col-xs-12.purse-limit > p > span').html()")
                }).then(function (value) {
                    console.log(value)
                    value ? values.value2 = value : values.value2 = 0;
                    console.log(values)
                    browser.close()

                    resolve(values)
                }).catch(function (err) {
                    console.log(err)
                    browser.close()
                    reject()
                })
            })
    })
}

const getText = function () {
    return new Promise(function (resolve, reject) {
        getPageValues().then(function (values) {
            let text = ''

            console.log(values)

            if (parseFloat(values.value1) > parseFloat(process.env.LIQUI_VALUE)) {
                text += 'BTC' + ': ' + values.value1 + '\n'
            }
            if (parseFloat(values.value2) > parseFloat(process.env.LIQUI_VALUE)) {
                text += 'ETH' + ': ' + values.value2 + '\n'
            }

            console.log(text)

            resolve(text)
        }).catch(function (err) {
            reject(err)
        })
    })
}

exports.handler = function (event, context) {
    console.log("Incoming: ", event);

    getText().then((text) => {
        if (text == '') {
            console.log('Nothing changed')
            context.succeed(event)
        } else {

            let eParams = {
                Destination: {
                    ToAddresses: [process.env.TO_SES_ADDRESS]
                },
                Message: {
                    Body: {
                        Text: {
                            Data: text
                        }
                    },
                    Subject: {
                        Data: "Hey! New values from liqui io"
                    }
                },
                Source: process.env.FROM_SES_ADDRESS
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
    })
}