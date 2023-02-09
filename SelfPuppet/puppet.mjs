
// STUB OPTIONS
import { Worker } from 'worker_threads'



// STUB CLOUD FUNCTION
export default async function (context, req) {
    try {
        const jobs = createQueue(req.body.list, req.body.week)

        const results = await startJobs(jobs, context)
        return {
            body: results
        }
    } catch (error) {
        return {
            status: 429,
            body: error.message
        }
    }
}

// STUB CREATE JOBS

function createQueue(nameList, week) {
    try {
        const jobQ = []
        nameList.forEach(n => {
            for (let i = 1; i <= 5; i++) {
                jobQ.push({
                    type: 'reflections',
                    name: n,
                    week: week,
                    day: '0' + i
                })
            }
            jobQ.push({ name: n, week: week, type: 'quizzes' })
        })
        return jobQ
    } catch (error) {
        throw new Error(error)
    }
}

// STUB PUPPET WORK
function url(name, type, week, day) {
    return `https://${name}.github.io/fs-journal/${type}/week${week}` + (day ? `/${day}` : '')
}

const debugging = true
let jobQ = []
const workers = []
const workerLimit = 1

async function startJobs(jobs, context) {
    context.log.error('[Starting Jobs]', jobs)
    const collection = []
    jobQ = jobs
    let working = true
    return new Promise(async (resolve, reject) => {
        try {
            while (working) {
                if (workers.length < workerLimit && jobQ.length) {
                    const worker = new Worker('../sharedcode/PuppetWorker.js')
                    workers.push(worker)
                    context.log('worker started', workers.length)
                    worker.on('message', (message) => {
                        switch (message.status) {
                            case 'job done':
                                collection.push(message.data)
                                context.log(message.workerName, 'Finished Job, current data entries', collection.length)
                            // eslint-disable-next-line no-fallthrough
                            case 'ready':
                                continueWork(message.id, context)
                                break
                            case 'job failed':
                                context.log.error(`${message.workerName} - failed`)
                                if (message.job) console.error('[Failed Job]', message.job)
                                if (message.error) console.error(message.error)
                                worker.postMessage({ do: 'nothing', job: 'quitting time' })
                                break
                            default:
                                context.log.error(`${message.workerName} - ${message.status}`)
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
                        context.log.error('[Worker Exited] remaining work force ', workers.length)
                        if (workers.length == 0) working = false // no workers, then stop function
                    })
                }
                if (workers.length === 0) {
                    context.log('Collected data', collection)
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

function continueWork(workerId, context) {
    const worker = workers.find(w => w.threadId === workerId)
    context.log('[JOBS LEFT]', jobQ.length)
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