/* Exercise the real post-deploy checker with in-memory HTTP responses. No live requests. */
import assert from 'node:assert/strict';
import { releaseArtifacts, verifyLiveRelease } from '../scripts/verify-live-release.mjs';
const root = process.cwd();
const artifacts = await releaseArtifacts(root);
const byRoute = new Map(artifacts.map((item) => [item.route, item]));
let mutate = () => {}, calls = 0;
const fetcher = async (url, options) => {
  calls++;
  assert.equal(options.redirect, 'manual');
  assert.match(options.headers['User-Agent'], /Googlebot/);
  const item = byRoute.get(url.pathname);
  assert.ok(item, url.pathname);
  assert.ok(url.searchParams.get('release_check'));
  const result = { body: item.bytes, status: item.status, headers: {
    'content-type': item.type === 'javascript' ? 'text/javascript' : item.type === 'xml' ? 'application/xml' : item.type,
    'x-content-type-options': 'nosniff',
  } };
  mutate(url.pathname, result);
  return new Response(result.body, result);
};
const run = (extra = {}) => verifyLiveRelease({ root, fetcher, attempts: 1, delayMs: 0, log: () => {}, ...extra });
assert.equal(await run(), artifacts.length);
assert.ok(byRoute.has('/learning/web-application-security/foundations'));
assert.equal(byRoute.get('/__omp_release_missing_page__').status, 404);
console.log(`✓ Exact Hosting artifact verification covers ${artifacts.length} resources and a real 404`);
for (const [label, change, message] of [
  ['stale deployment', (r) => { r.body = 'previous deployment'; }, /Live bytes differ/],
  ['wrong MIME', (r) => { r.headers['content-type'] = 'text/plain'; }, /Wrong Content-Type/],
  ['missing security header', (r) => { delete r.headers['x-content-type-options']; }, /Missing nosniff/],
  ['redirect instead of page', (r) => { r.status = 302; }, /HTTP 302/],
]) {
  mutate = (route, result) => { if (route === '/') change(result); };
  await assert.rejects(run(), message);
  console.log('✓ Rejects ' + label);
}
mutate = (route, result) => { if (route === '/__omp_release_missing_page__') result.status = 200; };
await assert.rejects(run(), /HTTP 200, expected 404/);
console.log('✓ Rejects soft 404s');
let first = true;
mutate = (route, result) => { if (route === '/' && first) { first = false; result.body = 'propagating'; } };
calls = 0;
assert.equal(await run({ attempts: 2 }), artifacts.length);
assert.equal(calls, artifacts.length + 1);
console.log('✓ Retries transient Hosting propagation, then checks every artifact');
await assert.rejects(run({ origin: 'http://unsafe.test' }), /HTTPS origin/);
await assert.rejects(run({ attempts: 0 }), /attempts/);
console.log('✓ Rejects insecure origins and zero-attempt false passes');
console.log('\n8 release-verifier groups passed; no deployment or live services contacted.');
