#!/usr/bin/env node
/* ============================================================
   The panel must repeat what the function said, not what the SDK said.

   supabase-js answers every non-2xx with "Edge Function returned a non-2xx
   status code" and drops the body. The body is where the function explains
   itself - and it is careful to: "GitHub rejected the dispatch (HTTP 403)",
   "server is not configured for deploys", "could not record the job".

   This is the difference between an owner who knows their token lacks Contents:
   write and an owner who is told to try again.

   Run: node tools/test_publish_errors.mjs
   ============================================================ */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { failureMessage, UNEXPLAINED } from '../assets/js/admin/publish-error.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

let passed = 0;
const failures = [];
function assert(condition, message) {
  if (condition) { passed += 1; console.log(`  ✓ ${message}`); return; }
  failures.push(message);
  console.log(`  ✗ ${message}`);
}
const section = (name) => console.log(`\n${name}`);

/* A stand-in for the FunctionsHttpError supabase-js builds: the SDK's generic
   sentence in .message, and the real Response on .context. */
const response = (body, { jsonThrows = false, cloneable = true } = {}) => {
  const self = {
    json: async () => {
      if (jsonThrows) throw new SyntaxError('Unexpected token <');
      return body;
    }
  };
  if (cloneable) self.clone = () => self;
  return self;
};

const sdkError = (context) => ({
  message: 'Edge Function returned a non-2xx status code',
  context
});

section('The function\'s own sentence wins');

const forbidden = await failureMessage(sdkError(response({ error: 'GitHub rejected the dispatch (HTTP 403)' })));
assert(forbidden === 'GitHub rejected the dispatch (HTTP 403)',
  'a 403 from GitHub is repeated exactly, not replaced by the SDK sentence');

const unconfigured = await failureMessage(sdkError(response({ error: 'server is not configured for deploys' })));
assert(unconfigured === 'server is not configured for deploys', 'a missing token is named');

const jobError = await failureMessage(sdkError(response({ job_id: null, error: 'could not record the job' })));
assert(jobError === 'could not record the job', 'an unrecorded job is named');

assert(!/non-2xx/.test(forbidden), 'the SDK sentence never reaches the reader when there is a body');

section('A body that says nothing is not mistaken for a reason');

assert(await failureMessage(sdkError(response({}))) === UNEXPLAINED,
  'an empty JSON body falls back to "answered with an error it did not explain"');
assert(await failureMessage(sdkError(response({ error: '   ' }))) === UNEXPLAINED,
  'a blank error string is not a message');
assert(await failureMessage(sdkError(response({ error: 42 }))) === UNEXPLAINED,
  'a non-string error is not a message');
assert(await failureMessage(sdkError(response(null, { jsonThrows: true }))) === UNEXPLAINED,
  'a body that is not JSON falls back instead of throwing');

section('No response at all still says something true');

assert(await failureMessage(sdkError(undefined)) === UNEXPLAINED,
  'a missing context does not throw');

const offline = await failureMessage({ message: 'Failed to send a request to the Edge Function' });
assert(offline === 'Failed to send a request to the Edge Function',
  'a network failure keeps its own sentence - it is a different fact from a refusal');

const thrown = await failureMessage(new Error('boom'));
assert(thrown === 'boom', 'a thrown Error keeps its message');

assert(typeof (await failureMessage(null)) === 'string', 'null input returns a string, never undefined');

section('The panel uses it, and only for a failed call');

const admin = read('assets/js/admin.js');
assert(/import \{ failureMessage \} from '\.\/admin\/publish-error\.js'/.test(admin),
  'admin.js imports the helper');
assert(/if \(error\) return \{ error: await failureMessage\(error\) \}/.test(admin),
  'requestPublish reports the function\'s sentence, not error.message');
assert(!/if \(error\) return \{ error: error\.message \}/.test(admin),
  'the old pass-through is gone');

section('Every caller shows the sentence it gets');

for (const file of ['assets/js/admin/settings.js', 'assets/js/admin/sections.js']) {
  const source = read(file);
  const shown = /could not start|started\.error|started\.error\)/.test(source);
  assert(shown, `${file} puts the failure in front of the reader`);
}
const settings = read('assets/js/admin/settings.js');
assert(/The deploy could not start: \$\{esc\(started\.error\)\}/.test(settings),
  'the Settings button prints the reason verbatim');

console.log(`\n${passed} passed, ${failures.length} failed\n`);
if (failures.length) process.exitCode = 1;
