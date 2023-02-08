import { AccountSASPermissions, AccountSASResourceTypes, AccountSASServices, BlobServiceClient } from '@azure/storage-blob'
import Cat from 'catid'
import { Worker } from 'worker_threads'
import blobService from '../sharedcode/BlobService.js'
import puppeteer from 'puppeteer'

export default async function (context, jobs) {
    browser = await puppeteer.launch(chromeOptions)
    context.log('......................Jobs to do..................', jobs[0], browser.wsEndpoint())
    // const data = await scrape(jobs[0])
    context.log('--------------------all done-------------------------')
    await browser.close()
    return 'a puppet ran for job' + jobs[0].name
}

const debugging = true
let jobQ = []
const workers = []
const workerLimit = 1

async function startJobs(jobs, context) {
    context.log.error('[Starting Jobs]', jobs.length)
    const collection = []
    jobQ = jobs
    let working = true
    return new Promise(async (resolve, reject) => {
        try {
            while (working) {
                if (workers.length < workerLimit && jobQ.length) {
                    const worker = new Worker('./SharedCode/PuppetWorker.js')
                    workers.push(worker)
                    worker.on('message', (message) => {
                        switch (message.status) {
                            case 'job done':
                                collection.push(message.data)
                                console.log(message.workerName, 'Finished Job, current data entries', collection.length)
                            // eslint-disable-next-line no-fallthrough
                            case 'ready':
                                continueWork(message.id)
                                break
                            case 'job failed':
                                console.error(`${message.workerName} - failed`)
                                if (message.job) console.error('[Failed Job]', message.job)
                                if (message.error) console.error(message.error)
                                worker.postMessage({ do: 'nothing', job: 'quitting time' })
                                break
                            default:
                                console.error(`${message.workerName} - ${message.status}`)
                                if (message.error) console.error(message.error)
                        }
                    })
                    // FIXME end worker on error
                    worker.on('error', err => {
                        workerError(err)
                        worker.postMessage({ do: 'nothing', job: 'quitting time' })
                    })
                    worker.on('exit', () => {
                        workers.splice(workers.findIndex(w => w.threadId === worker.threadId), 1)
                        console.error('[Worker Exited] remaining work force ', workers.length)
                    })
                }
                if (workers.length === 0) {
                    console.log('Collected data', collection)
                    working = false
                }
                await doWork()
            }
            // if (!collection.length) { reject(new Error('no collection')) }
            resolve(collection)
        } catch (error) {
            reject(error)
        }
    })
}

function continueWork(workerId) {
    const worker = workers.find(w => w.threadId === workerId)
    console.log('[JOBS LEFT]', jobQ.length)
    if (jobQ.length > 0) {
        const nextJob = jobQ.shift()
        worker.postMessage({ do: nextJob.type, job: nextJob })
    } else {
        worker.postMessage({ do: 'All in a hard days work', job: 'all done' })
    }
}

function doWork() {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve()
        }, 1000)
    })
}

function workerError(error) {
    console.error('[WORKER_ERROR]', error)
}

// STUB WORKER-LESS ------------------------------------
const headless = true
const chromeOptions = {
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
function url(name, type, week, day) {
    return `https://${name}.github.io/fs-journal/${type}/week${week}` + (day ? `/${day}` : '')
}

let browser = null
const workerName = Cat.getName(false)

const perms = AccountSASPermissions.parse('lrw')
const rTypes = AccountSASResourceTypes.parse('sco').toString()
AccountSASServices
const sas = blobService.generateAccountSasUrl(new Date(new Date().getTime() + 60000), perms, rTypes)
// console.log('SAS', sas)
const bb = new BlobServiceClient(sas)
const container = bb.getContainerClient('screenshots')

async function scrape(job) {
    try {
        if (job.type == 'reflections') {
            return await getReflection(job)
        } else {
            return await getQuiz(job)
        }
    } catch (error) {
        throw new Error(error)
    }
}

async function getReflection({ name, type, week, day }) {
    try {
        const reflection = {
            type: 'reflection',
            name,
            week,
            day,
            questions: {
                url: null,
                imgUrl: null,
                valid: null
            },
            repo: {
                url: null,
                imgUrl: null,
                valid: false
            },
            createdAt: new Date(Date.now()).toISOString(),
            reportedBy: workerName
        }
        // open page
        const page = await browser.newPage()
        await page.setRequestInterception(true)
        // intercept non essential requests and abort
        page.on('request', request => {
            const url = request.url()
            // found a use for .some
            if (blockedDomains.some(domain => url.includes(domain))) {
                request.abort()
            } else {
                request.continue()
            }
        })
        // create url based on job data
        const reflectionLink = url(name, type, week, day)
        reflection.questions.url = reflectionLink
        await page.goto(reflectionLink, { waitUntil: 'domcontentloaded' })
        await page.evaluate(() => { // page Scroll
            return Promise.resolve(window.scrollTo(0, document.body.scrollHeight))
        })
        // SECTION getting reflections pic
        await page.waitForTimeout(200)
        const reflectionImage = await page.screenshot({ type: 'jpeg', fullPage: true, quality: 50 })
        // Save image to Azure
        reflection.questions.imgUrl = await saveScreenshot(name, reflectionImage, '/W' + week + 'D' + day + '.jpg')

        // SECTION getting repo pic
        const linkElm = await page.$('h2+p strong a')
        // check if repo link is even there
        if (linkElm !== null) {
            const link = await (await linkElm.getProperty('href')).jsonValue()
            reflection.repo.url = link
            let linkResponse = {}
            // register listener for repo page response
            await page.on('response', async response => {
                if (response.url() === link) {
                    linkResponse = response
                }
            })
            // nav to repo link
            await page.goto(link, { waitUntil: 'domcontentloaded' })
            await page.waitForTimeout(200)
            // check if repo link was good or not
            if (linkResponse.status() === 200) {
                // hide readme
                const readme = await page.$('#readme')
                if (readme) {
                    await readme.evaluate(elm => elm.style.display = 'none')
                }
                const repoImage = await page.screenshot({ type: 'jpeg', fullPage: true, quality: 50 })
                // Save image to Azure
                reflection.repo.imgUrl = await saveScreenshot(name, repoImage, '/W' + week + 'D' + day + 'repo' + '.jpg')
                reflection.repo.valid = true
            }
        }
        // close page and message parent that job is done
        await page.close()
        // parentPort.postMessage({ status: 'job done', data: reflection, workerName, id })
        return reflection
    } catch (error) {
        console.error(error)
        // parentPort.postMessage({ status: 'job failed', error, workerName, id, job: { name, type, week } })
    }
}

async function getQuiz({ name, type, week }) {
    try {
        const quiz = {
            type: 'quiz',
            name,
            week,
            url: null,
            imgUrl: null,
            questions: {},
            createdAt: new Date(Date.now()).toISOString(),
            reportedBy: workerName
        }
        // open page
        const page = await browser.newPage()
        // intercept non essential requests and abort
        await page.setRequestInterception(true)
        page.on('request', request => {
            const url = request.url()
            if (blockedDomains.some(domain => url.includes(domain))) {
                request.abort()
            } else {
                request.continue()
            }
        })
        // create quiz url from job data
        const quizLink = url(name, type, week)
        quiz.url = quizLink
        await page.goto(quizLink, { waitUntil: 'domcontentloaded' })
        await page.waitForTimeout(200)

        // Take screenshot
        const quizImage = await page.screenshot({ type: 'jpeg', fullPage: true, quality: 50 })
        // Save image to Azure
        // TODO rig up Azure storage
        console.log('screen shot')
        quiz.imgUrl = await saveScreenshot(name, quizImage, '/W' + week + 'quiz' + '.jpg')
        // grabs question text
        const questions = await page.$$eval('article p', (elms) => elms.map(e => e.textContent.trim()))
        // grabs answers
        const answers = await page.$$eval('pre > code.language-plaintext', (elms) => elms.map(e => e.textContent.trim()))
        // combines questions and answers into one object
        questions.forEach((q, i) => {
            quiz.questions[q] = answers[i]
        })
        // close page and message parent job done
        await page.close()
        // parentPort.postMessage({ status: 'job done', data: quiz, id })
        return quiz
    } catch (error) {
        console.error(workerName, error)
        // parentPort.postMessage({ status: 'job failed', error, workerName, id, job: { name, type, week } })
    }
}

async function saveScreenshot(gitName, image, path = '') {
    try {
        console.warn('[SCREENSHOT SAVED]')
        console.log('getting blob')
        const blockBlob = await container.getBlockBlobClient(gitName + path)
        console.log('uploading', typeof image, gitName + path)
        await blockBlob.uploadData(image)
        console.log('returning')
        return blockBlob.url
    } catch (error) {
        console.error(error)
        throw new Error(error)
    }
}