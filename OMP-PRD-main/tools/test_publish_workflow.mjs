#!/usr/bin/env node
/* ============================================================
   The publishing pipeline itself, checked without running it.

   .github/workflows/publish-content.yml is the only thing between "saved" and
   "on the site", and it is the one file nobody can exercise locally: it needs
   the secrets, the cron and GitHub. A mistake in it does not fail a test, it
   fails silently at 3am - the classic version being a job that commits and
   pushes when the input said dry run.

   So the invariants are asserted here against the parsed file:

     * a dry run cannot commit to main, cannot deploy, cannot claim live
     * nothing is committed before the gates pass
     * a failed run writes a terminal state, and a failure is never recorded
       as "skipped"
     * the cron is off unless the owner turns it on
     * the commit adds generated paths, never `git add -A`

   Run: node tools/test_publish_workflow.mjs
   ============================================================ */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(path.dirname(ROOT), '.github/workflows/publish-content.yml');

let passed = 0;
const failures = [];
function assert(condition, message) {
  if (condition) { passed += 1; console.log(`  ✓ ${message}`); return; }
  failures.push(message);
  console.log(`  ✗ ${message}`);
}
const section = (name) => console.log(`\n${name}`);

assert(fs.existsSync(FILE), 'the publish workflow exists where the pipeline says it does');
if (!fs.existsSync(FILE)) {
  console.log(`\n0 passed, 1 failed\n`);
  process.exit(1);
}
const source = fs.readFileSync(FILE, 'utf8');
const lines = source.split('\n');

/* A deliberately small reader: jobs and their steps by indentation. Not a YAML
   parser - if the shape changes enough to break this, the test says so instead
   of quietly checking nothing. */
function readJobs() {
  const jobs = new Map();
  let inJobs = false;
  let current = null;
  let currentStep = null;
  for (const line of lines) {
    if (/^jobs:\s*$/.test(line)) { inJobs = true; continue; }
    if (!inJobs) continue;
    const job = line.match(/^ {2}([a-z0-9_-]+):\s*$/);
    if (job) {
      current = { name: job[1], lines: [], steps: [] };
      jobs.set(current.name, current);
      currentStep = null;
      continue;
    }
    const step = line.match(/^ {6}- name:\s*(.+)$/);
    if (step && current) {
      currentStep = { name: step[1].trim(), lines: [] };
      current.steps.push(currentStep);
      continue;
    }
    if (current) {
      current.lines.push(line);
      if (currentStep) currentStep.lines.push(line);
    }
  }
  return jobs;
}

const jobs = readJobs();
assert(jobs.size >= 2, `both jobs are found (${[...jobs.keys()].join(', ')})`);

const build = jobs.get('build');
const due = jobs.get('due');
assert(Boolean(build), 'the build job exists');
assert(Boolean(due), 'the scheduled-promotion job exists');

const stepText = (step) => step.lines.join('\n');
const findStep = (job, pattern) => job.steps.find((step) => pattern.test(step.name));

section('Triggers');
assert(/repository_dispatch:\s*\n\s*types:\s*\[content-publish\]/.test(source), 'the panel can dispatch a build');
assert(/workflow_dispatch:/.test(source), 'a human can dispatch one by hand');
assert(/schedule:\s*\n\s*- cron:\s*"\*\/15 \* \* \* \*"/.test(source), 'the cron runs every 15 minutes');
assert(/dry_run:[\s\S]{0,200}?default: false/.test(source), 'and a dry run is opt-in, defaulting to off');

section('A dry run changes nothing outside the runner');
const push = findStep(build, /push/i);
assert(Boolean(push), 'there is a push step');
assert(/DRY_RUN != 'true'/.test(push?.lines.find((line) => /if:/.test(line)) || ''),
  'the push is skipped when dry_run is set');

const live = findStep(build, /Mark the job as live|answer 200/i);
assert(Boolean(live), 'the live confirmation step exists');
const liveGuard = build.steps.filter((step) => /answer 200|Mark the job as live/.test(step.name));
for (const step of liveGuard) {
  const guard = step.lines.find((line) => /^\s+if:/.test(line)) || '';
  assert(/DRY_RUN != 'true'|always\(\)/.test(guard), `"${step.name}" cannot claim "live" during a dry run`);
}
assert(!/git push[^\n]*--force/.test(source), 'nothing force-pushes over a human commit');

section('Order: build, then gates, then commit');
const order = build.steps.map((step) => step.name);
const indexOf = (pattern) => order.findIndex((name) => pattern.test(name));
const buildAt = indexOf(/Build the pages/);
const redirectsAt = indexOf(/Sync managed redirects/);
const gatesAt = indexOf(/Gates/);
const commitAt = indexOf(/Commit generated content/);
assert(buildAt >= 0 && gatesAt >= 0 && commitAt >= 0, 'build, gates and commit steps all exist');
assert(buildAt < gatesAt, 'the build runs before the gates (the gates check the artifact)');
assert(redirectsAt > buildAt && redirectsAt < gatesAt,
  'generated redirects are merged into vercel.json before the config is verified');
assert(gatesAt < commitAt, 'nothing is committed before the gates pass');

section('A failure is recorded as a failure');
const failedStep = findStep(build, /Mark the job as failed/);
assert(Boolean(failedStep), 'there is a failure handler');
const failedGuard = failedStep?.lines.find((line) => /^\s+if:/.test(line)) || '';
assert(/failure\(\)|cancelled\(\)/.test(failedGuard), 'it runs when the job fails or is cancelled');
assert(/status\\?"?:\\?"?failed/.test(stepText(failedStep)) || /failed/.test(stepText(failedStep)),
  'and it writes status=failed');
assert(/run_url/.test(stepText(failedStep)), 'with the run URL, so the panel can link to the log');
assert(order.indexOf('Mark the job as failed') > order.indexOf('Mark the job as live'),
  'it runs after the always() step, so it wins - otherwise a failed gate is recorded as "skipped"');

const skippedLogic = build.steps.find((step) => /Mark the job as live/.test(step.name));
assert(/no page changed/.test(stepText(skippedLogic)), 'the always() step still handles "nothing changed"');

section('The cron is off until it is turned on');
assert(/if:\s*github\.event_name == 'schedule' && vars\.AUTOPUBLISH_ENABLED == 'true'/.test(due.lines.join('\n')),
  'promoting scheduled articles needs the repository variable');
assert(/needs\.due\.outputs\.promoted != '0'/.test(build.lines.join('\n')),
  'and an idle schedule does not rebuild the site');
assert(/needs:\s*\[due\]/.test(build.lines.join('\n')), 'the build waits for the promotion');

section('The commit is narrow');
const commit = findStep(build, /Commit generated content/);
const commitText = stepText(commit);
/* Comments are excluded: the step explains why it does not use `git add -A`,
   and a check that cannot tell an instruction from its own rationale would
   force the rationale to be deleted. */
const commitCode = commitText.split('\n')
  .filter((line) => !/^\s*#/.test(line))
  .join('\n');
assert(!/git add -A|git add \.(\s|$)/.test(commitCode), 'it never stages the whole tree');
assert(/git add articles products/.test(commitText), 'it stages the generated content paths');
assert(/content\/redirects\.json/.test(commitText) && /vercel\.json/.test(commitText),
  'including the files this repo generates for redirects and hosting');
assert(/git diff --cached --quiet/.test(commitText), 'and commits only when something actually changed');

section('The reason in a commit message is flattened first');
assert(/REASON_RAW:/.test(build.lines.join('\n')), 'the raw input is kept separate');
assert(/tr -d '\\r\\n'/.test(commitText) && /cut -c1-80/.test(commitText),
  'and flattened to one short line before it reaches the commit subject');
/* Continuation lines are joined first: the commit command is split over two
   lines with a trailing backslash, and the subject is on the second one. */
const logicalLines = commitCode.replace(/\\\n\s+/g, ' ').split('\n');
const commitLine = logicalLines.find((line) => /git .*commit/.test(line)) || '';
assert(/\$\{REASON\}/.test(commitLine), 'the commit subject uses the flattened REASON');
assert(!/REASON_RAW/.test(commitLine), 'and never the raw input');

section('Secrets are used, never printed');
assert(/SERVICE_KEY: \$\{\{ secrets\.SUPABASE_SERVICE_ROLE_KEY \}\}/.test(source), 'the service key comes from secrets');
assert(!/echo[^\n]*SERVICE_KEY[^\n]*\$\{?SERVICE_KEY/.test(source), 'and is never echoed');
assert(!/set -x/.test(source), 'no step turns on shell tracing, which would print it');
assert((source.match(/\$\{\{ secrets\./g) || []).length <= 3, 'only a small number of secrets are needed');

section('The gates it runs are the ones this repo has');
const GATES = [
  { run: 'verify-seo.mjs', at: 'scripts/verify-seo.mjs' },
  { run: 'test_sitemap.js', at: 'tools/test_sitemap.js' },
  { run: 'test_vercel_config.mjs', at: 'tools/test_vercel_config.mjs' },
  { run: 'tools/qa.py', at: 'tools/qa.py' }
];
for (const gate of GATES) {
  assert(source.includes(gate.run), `${gate.run} is run before a commit`);
  assert(fs.existsSync(path.join(ROOT, gate.at)), `${gate.at} exists, so a rename cannot silently disarm the gate`);
}

section('Concurrency');
assert(/concurrency:[\s\S]{0,120}?group:\s*publish-content/.test(source), 'runs are serialised in one group');
assert(/cancel-in-progress:\s*false/.test(source), 'and never cancelled: each one may hold a commit');

console.log(`\n${passed} passed, ${failures.length} failed\n`);
if (failures.length) process.exitCode = 1;
