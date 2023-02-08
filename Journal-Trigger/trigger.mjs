const seconds = 1000
import df from 'durable-functions'

export default async function (context, req) {
    try {
        const client = df.getClient(context);
        const instanceId = await client.startNew('Journal-Orchestrator', undefined, req.body);

        context.log(`ran trigger '${instanceId}'.`);

        const response = await client.waitForCompletionOrCreateCheckStatusResponse(req, instanceId, 120 * seconds)
        return response
    } catch (error) {
        return error
    }
};