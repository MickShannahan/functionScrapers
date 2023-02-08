import puppeteer from "puppeteer";

// STUB OPTIONS
const headless = true
const chromePath = '../chrome-linux/chrome'
const chromeOptions = {
    // executablePath: chromePath,
    headless: headless,
    defaultViewport: null,
    args: [
        '--autoplay-policy=user-gesture-required',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-breakpad',
        '--disable-client-side-phishing-detection',
        '--disable-component-update',
        '--disable-default-apps',
        '--disable-dev-shm-usage',
        '--disable-domain-reliability',
        '--disable-extensions',
        '--disable-features=AudioServiceOutOfProcess',
        '--disable-hang-monitor',
        '--disable-ipc-flooding-protection',
        '--disable-notifications',
        '--disable-offer-store-unmasked-wallet-cards',
        '--disable-popup-blocking',
        '--disable-print-preview',
        '--disable-prompt-on-repost',
        '--disable-renderer-backgrounding',
        '--disable-setuid-sandbox',
        '--disable-speech-api',
        '--disable-sync',
        '--hide-scrollbars',
        '--ignore-gpu-blacklist',
        '--metrics-recording-only',
        '--mute-audio',
        '--no-default-browser-check',
        '--no-first-run',
        '--no-pings',
        '--no-sandbox',
        '--no-zygote',
        '--password-store=basic',
        '--use-gl=swiftshader',
        '--use-mock-keychain'
    ]
}
const blockedDomains = [
    'googlesyndication.com',
    'adservice.google.com',
    'simple-jekyll-search.min.js',
    'bcw.blob',
    'search',
    '.png'
]
let browser = null

function url(name, type, week, day) {
    return `https://${name}.github.io/fs-journal/${type}/week${week}` + (day ? `/${day}` : '')
}


// STUB CLOUD FUNCTION
export default async function (context, req) {
    try {
        context.log('JavaScript HTTP trigger function processed a request.');
        browser = await puppeteer.launch(chromeOptions)
        const name = (req.query.name || (req.body && req.body.name));
        const responseMessage = name
            ? "Hello, " + name + ". This HTTP triggered function executed successfully."
            : "This HTTP triggered function executed successfully. Pass a name in the query string or in the request body for a personalized response.";
        await browser.close()
        return {
            body: responseMessage
        }
    } catch (error) {
        return {
            status: 429,
            body: error.message
        }
    }
}

// STUB PUPPET WORK