import df from 'durable-functions'
export default df.orchestrator(function* (context) {
    try {
        const body = context.df.getInput()
        const nameList = body.list
        const week = body.week


        context.log('orchestration ran', week, nameList)
        let jobQ = createQueue(nameList, week)

        const tasks = []
        jobQ.forEach(job => {
            tasks.push(context.df.callActivity("Journal-Get-v2", [job]))
        })
        context.log('!! starting scrape, tasks:', tasks.length)
        const results = yield context.df.Task.all(tasks)
        context.log('Finished scrape, results: ', results)

        return results
    } catch (error) {
        context.log.error(error)
        throw new Error(error)
    }
})


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