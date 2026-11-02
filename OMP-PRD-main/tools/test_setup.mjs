#!/usr/bin/env node
/* ============================================================
   Setup diagnostics: the difference between "missing" and "unknown".

   When a migration is not applied, the panel used to say "the deploy could not
   start" - true, and useless. The setup screen says which step is missing and
   what to run. That is only an improvement if it is right: telling someone to
   re-apply a migration that is already applied trains them to ignore the whole
   screen.

   So the checks here are mostly about the three states meaning what they say.

   Run: node tools/test_setup.mjs
   ============================================================ */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.removeAllListeners('warning');
process.on('warning', (warning) => {
  if (warning.code !== 'MODULE_TYPELESS_PACKAGE_JSON') console.warn(warning);
});

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mod = await import(new URL(`file://${path.join(ROOT, 'assets/js/admin/setup.js')}`).href);
const { CHECKS, diagnose, summarise, asText } = mod;

let passed = 0;
const failures = [];
function assert(condition, message) {
  if (condition) { passed += 1; console.log(`  ✓ ${message}`); return; }
  failures.push(message);
  console.log(`  ✗ ${message}`);
}
const section = (name) => console.log(`\n${name}`);

section('Every check can be acted on');
assert(CHECKS.length >= 8, `${CHECKS.length} checks are defined`);
for (const check of CHECKS) {
  assert(Boolean(check.label && check.why && check.fix), `"${check.id}" has a label, a reason and a fix`);
  assert(check.fix.length > 10, `"${check.id}" says what to run, not just that it is broken`);
  assert(!/\bTODO\b/.test(check.fix), `"${check.id}" has a real instruction`);
}
assert(new Set(CHECKS.map((c) => c.id)).size === CHECKS.length, 'no duplicate ids');
const migrationFixes = CHECKS.filter((c) => c.fix.includes('.sql'));
assert(migrationFixes.length >= 5, 'the migrations are named by file, so they can be copy-pasted');

section('Nothing known is reported as unknown');
const everything = diagnose({
  tables: {
    articles: true, publish_jobs: true, redirects: true, article_revisions: true,
    audit_log: true, categories: true
  },
  function: 'ok',
  configured: { github_token: true, repo: true }
});
assert(everything.every((c) => c.state === 'ok'), 'a fully configured site is all green');
assert(everything.length === CHECKS.length, 'every check gets a state');

section('Missing is missing');
const nothing = diagnose({ tables: {}, function: 'unreachable' });
assert(nothing.filter((c) => c.state === 'missing').length === 0,
  'an unreachable function is not reported as a missing token');
assert(nothing.filter((c) => c.state === 'unknown').length === nothing.length,
  'with no probe results at all, everything is unknown - not "all broken"');

const missingTables = diagnose({
  tables: { articles: true, publish_jobs: false, redirects: false, article_revisions: false, audit_log: false, categories: false },
  function: 'ok',
  configured: { github_token: true, repo: true }
});
const jobs = missingTables.find((c) => c.id === 'publish_jobs');
assert(jobs.state === 'missing', 'a table that the probe reached and did not find is missing');
assert(jobs.fix.includes('20261101120000'), 'and the fix names the exact migration');

section('A refusal is not an absence');
/* The exact failure this was written for: the tables existed, but the role had
   policies without grants, so every probe came back "permission denied" and the
   screen told the owner to apply migrations that had been applied for days. */
const refused = diagnose({
  tables: {
    articles: true, publish_jobs: true, categories: true,
    redirects: false, article_revisions: false, audit_log: false,
    denied: ['redirects', 'article_revisions', 'audit_log']
  },
  function: 'ok',
  configured: { github_token: true, repo: true }
});
const redirectCheck = refused.find((c) => c.id === 'redirects');
assert(redirectCheck.state === 'denied', 'a permission error is reported as denied, not missing');
assert(diagnose({ tables: { redirects: false }, function: 'ok' }).find((c) => c.id === 'redirects').state === 'missing',
  'without the denied list, the same false is still "missing" - the two cases are told apart by the probe, not guessed');
const refusedSummary = summarise(refused);
assert(refusedSummary.denied === 3, 'the summary counts refused checks separately');
assert(refusedSummary.missing === 0, 'and does not add them to the missing count');
assert(summarise(refused).canPublish === true,
  'a refused redirects table does not block publishing, which it is not part of');
const refusedText = asText(refused, refusedSummary);
assert(/\[!\]/.test(refusedText), 'the copied checklist marks a refusal with its own symbol');
assert(!/20261101140000/.test(refusedText.split('Redirects')[1]?.split('\n')[0] || ''),
  'a refused table does not tell the reader to apply the migration that is already applied');

section('The function is the thing that can be unreachable');
const noFunction = diagnose({
  tables: { articles: true, publish_jobs: true, redirects: true, article_revisions: true, audit_log: true, categories: true },
  function: 'unreachable'
});
assert(noFunction.find((c) => c.id === 'function').state === 'unknown', 'an undeployed function is unknown, because the probe cannot tell why');
assert(noFunction.find((c) => c.id === 'github_token').state === 'unknown',
  'and its secrets cannot be judged from a function that did not answer');

const tokenMissing = diagnose({
  tables: { articles: true, publish_jobs: true, redirects: true, article_revisions: true, audit_log: true, categories: true },
  function: 'ok',
  configured: { github_token: false, repo: true }
});
assert(tokenMissing.find((c) => c.id === 'github_token').state === 'missing', 'a function that answers and says "no token" is missing, and certain');
assert(tokenMissing.find((c) => c.id === 'github_repo').state === 'ok', 'while the repo it does have is fine');

section('The summary separates "cannot publish" from "not finished"');
const blocked = summarise(tokenMissing);
assert(blocked.canPublish === false, 'a missing token blocks publishing');
assert(blocked.blocked.includes('github_token'), 'and is named as the blocker');
assert(/step\(s\) stand between a save and a live page/.test(blocked.headline), 'the headline says what is wrong, in terms of the consequence');

const cosmeticOnly = summarise(diagnose({
  tables: { articles: true, publish_jobs: true, redirects: false, article_revisions: true, audit_log: false, categories: true },
  function: 'ok',
  configured: { github_token: true, repo: true }
}));
assert(cosmeticOnly.canPublish === true, 'a missing redirects or audit table does not block publishing');
assert(cosmeticOnly.missing === 2, 'but it is still counted');

const perfect = summarise(everything);
assert(perfect.canPublish === true && perfect.headline.includes('wired up'), 'a complete site says so plainly');

section('Nothing secret can reach the screen');
const source = CHECKS.map((c) => `${c.label}${c.why}${c.fix}`).join(' ');
assert(!/eyJ|sb_secret|service_role_key=|ghp_/i.test(source), 'no token, key or prefix appears in the text the panel renders');
const setupSource = await import('node:fs').then((fs) =>
  fs.readFileSync(path.join(ROOT, 'assets/js/admin/setup.js'), 'utf8'));
assert(!/token\s*[:=]\s*['"][A-Za-z0-9_]{10,}/.test(setupSource), 'and no credential is hard-coded in the module');

section('The text export is usable without the panel');
const text = asText(everything, perfect);
assert(text.startsWith('OopsMyPassword admin setup'), 'it starts with what it is');
assert(/\[x\]/.test(text) && !/\[ \]/.test(text), 'ready steps are ticked and nothing is unticked');
const partial = asText(tokenMissing, blocked);
assert(/\[ \] GitHub token — supabase secrets set GITHUB_PUBLISH_TOKEN/.test(partial), 'a missing step carries its fix into the pasted text');
assert(text.split('\n').length >= CHECKS.length, 'one line per check');

section('The panel asks the function a question that starts no deploy');
const fn = await import('node:fs').then((fs) =>
  fs.readFileSync(path.join(ROOT, 'supabase/functions/content-publish/index.ts'), 'utf8'));
assert(/action\s*\|\|\s*""\)\s*===\s*"ping"/.test(fn) || /=== "ping"/.test(fn), 'the function handles a ping action');
const pingBlock = fn.slice(fn.indexOf('=== "ping"'), fn.indexOf('=== "ping"') + 1200);
assert(/configured:/.test(pingBlock), 'and answers with what is configured');
assert(!/insert|dispatch/.test(pingBlock), 'without inserting a job or dispatching a build');
assert(/github_token: Boolean\(githubToken\)/.test(pingBlock), 'it reports whether the token exists, never the token');

console.log(`\n${passed} passed, ${failures.length} failed\n`);
if (failures.length) process.exitCode = 1;
