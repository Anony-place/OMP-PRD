/* ============================================================
   What the publish function actually said.

   supabase-js turns any non-2xx answer into one sentence: "Edge Function
   returned a non-2xx status code". That names the transport and not the
   problem, and the function goes out of its way to say the real thing -
   "GitHub rejected the dispatch (HTTP 403)", "server is not configured for
   deploys", "could not record the job" - in a JSON body it throws away.

   The result was the owner being told, from the panel, that something was
   wrong with no way to find out what: the answer was sitting in publish_jobs
   the whole time.

   So the body is read back out of the failed Response. Pure, async, and
   exported on its own so it can be tested without a browser or a Supabase.
   ============================================================ */

const UNEXPLAINED = 'the publish function answered with an error it did not explain';

export async function failureMessage(error) {
  const response = error && error.context;

  if (response && typeof response.json === 'function') {
    try {
      /* clone() so a caller that also wants the body is not left with a used
         stream. A Response that refuses to clone is read directly. */
      const source = typeof response.clone === 'function' ? response.clone() : response;
      const body = await source.json();
      if (body && typeof body.error === 'string' && body.error.trim()) {
        return body.error.trim();
      }
    } catch {
      /* not JSON, or already consumed: there is nothing better in here */
    }
  }

  const message = String((error && error.message) || '').trim();
  /* The SDK's own sentence is worth showing only when it is not the SDK's own
     sentence. "Failed to send a request to the Edge Function" is a real new
     fact - no network - and survives. */
  if (message && !/non-2xx/i.test(message)) return message;
  return UNEXPLAINED;
}

export { UNEXPLAINED };
