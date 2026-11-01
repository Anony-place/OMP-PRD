#!/usr/bin/env node
/* ============================================================
   firebase.json  ->  vercel.json

   Why this exists
   ---------------
   The site is migrating from Firebase Hosting to Vercel. Firebase and Vercel
   describe the same routing with different syntaxes, and a hand-written
   vercel.json loses rules silently: a redirect that stops existing is a page
   that stops resolving, and nobody notices until a 404 shows up in Search
   Console months later.

   So the conversion is generated, not typed:

     * every Firebase rule must produce at least one Vercel rule, or this
       script throws (no rule is ever dropped without a build failure)
     * the unsupported-source check is explicit - a new glob shape added to
       firebase.json fails here instead of turning into a mystery 404
     * `--check` compares the committed vercel.json with what this script
       would generate, so the two files cannot drift

   Syntax notes (%s)
   ----------
   * Vercel `source` is path-to-regexp, not glob:
         **            -> /(.*)
         /x/**         -> /x/:path*
         /x{,/**}      -> /x  +  /x/:path*
         /@(a|b)       -> /:p(a|b)   (dots escaped)
         the html glob  -> /:path(.*\.html)
   * `cleanUrls: true` means a rewrite/render destination must NOT carry the
     `.html` extension, or the request 404s (Vercel's documented gotcha).
   * Redirects keep `statusCode: 301` rather than `permanent: true`, because
     `permanent` emits 308 and the point of this migration is byte-for-byte
     parity with what Firebase served.
   ============================================================ */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIREBASE_JSON = path.join(ROOT, 'firebase.json');
const VERCEL_JSON = path.join(ROOT, 'vercel.json');

/* The production *.vercel.app alias. Pages on this host get X-Robots-Tag:
   noindex so the staging mirror cannot compete with the live Firebase site in
   search results. It is host-scoped on purpose: the day a real custom domain
   is attached, that domain is not covered by this rule and is indexable. */
const PREVIEW_HOST = 'oopsmypassword.vercel.app';

/* Endpoints Google must be able to fetch AND read without a noindex header,
   otherwise the sitemap itself is excluded from indexing. */
const CRAWLER_ENDPOINTS = 'sitemap|google-sitemap|rss\\.xml|robots\\.txt|llms|manifest\\.webmanifest|ads\\.txt|sw\\.js';

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const stripHtml = (p) => p.replace(/\.html$/, '');

/* ---------------------------------------------------------------- globs */

/* Firebase Hosting glob -> one or more Vercel (path-to-regexp) sources.
   Throwing on an unknown shape is the point: silent loss is the failure mode
   this script exists to prevent. */
function sourceToVercel(source) {
  if (typeof source !== 'string' || !source.length) {
    throw new Error(`unsupported source: ${JSON.stringify(source)}`);
  }

  /* Whole-site glob. */
  if (source === '**') return ['/(.*)'];

  /* A glob that starts with a wildcard segment (html, css, ...). Handled
     before the "must start with /" guard because these do not. */
  const leadingWildcard = source.match(/^\*\*\/\*\.([A-Za-z0-9]+)$/);
  if (leadingWildcard) return [`/:path(.*\\.${escapeRegExp(leadingWildcard[1])})`];

  if (!source.startsWith('/')) {
    throw new Error(`unsupported source (must start with "/"): ${JSON.stringify(source)}`);
  }

  /* Firebase extglob alternation: /@(a|b|c) */
  const extglob = source.match(/^\/@\(([^)]+)\)$/);
  if (extglob) {
    const alternatives = extglob[1].split('|').map((a) => a.trim()).filter(Boolean);
    if (!alternatives.length) throw new Error(`empty extglob: ${source}`);
    if (alternatives.some((a) => a.includes('/'))) {
      /* A multi-segment alternative cannot be expressed as one path-to-regexp
         param, so expand to one rule per alternative instead of guessing. */
      return alternatives.map((a) => `/${a}`);
    }
    return [`/:p(${alternatives.map((a) => escapeRegExp(a)).join('|')})`];
  }

  /* Firebase brace-with-optional-trailing-segment: /x{,/**} */
  if (source.endsWith('{,/**}')) {
    const base = source.slice(0, -'{,/**}'.length);
    return [base, `${base}/:path*`];
  }

  /* Trailing subtree glob: /x/** */
  if (source.endsWith('/**')) {
    const base = source.slice(0, -'/**'.length);
    return [`${base}/:path*`];
  }

  /* A glob anywhere else is not used by this repo; fail loudly rather than
     emitting a rule that silently never matches. */
  if (/[*?{}[\]()]/.test(source)) {
    throw new Error(`unsupported glob shape, add a rule for it: ${source}`);
  }

  return [source];
}

/* ------------------------------------------------------------ redirects */

/* Firebase RE2 redirect -> Vercel. Capture groups become named params so the
   destination can reference them; `:1` -> `:p1`. */
function regexRedirectToVercel(rule) {
  const groups = [];
  const source = rule.regex.replace(/\((?:\?:)?([^()]*)\)/g, (match, inner) => {
    const name = `p${groups.length + 1}`;
    groups.push(name);
    return `:${name}(${inner === '' ? '.*' : inner})`;
  });

  const destination = rule.destination.replace(/:(\d+)/g, (match, index) => {
    const name = groups[Number(index) - 1];
    if (!name) throw new Error(`destination ${rule.destination} references missing group :${index} in ${rule.regex}`);
    return `:${name}`;
  });

  return [{ source, destination, statusCode: rule.type || 301 }];
}

function redirectToVercel(rule) {
  if (rule.regex) return regexRedirectToVercel(rule);
  return sourceToVercel(rule.source).map((source) => ({
    source,
    destination: rule.destination,
    statusCode: rule.type || 301,
  }));
}

/* ------------------------------------------------------------- rewrites */

/* With cleanUrls: true the destination must not end in .html. Keeping the
   extension is the single most common Vercel migration bug: the rewrite
   matches, the file is not found, and the page 404s. */
function rewriteToVercel(rule) {
  if (rule.function) {
    throw new Error(`rewrite to a Cloud Function cannot be ported: ${rule.source}`);
  }
  return sourceToVercel(rule.source).map((source) => ({
    source,
    destination: stripHtml(rule.destination),
  }));
}

/* -------------------------------------------------------------- headers */

function headersToVercel(block) {
  return sourceToVercel(block.source).map((source) => ({
    source,
    headers: block.headers.map((h) => ({ key: h.key, value: h.value })),
  }));
}

/* ------------------------------------------------------------------ main */

export function buildVercelConfig(firebaseConfig) {
  const hosting = firebaseConfig.hosting;
  const report = { redirects: 0, redirectsFrom: 0, rewrites: 0, rewritesFrom: 0, headers: 0, headersFrom: 0 };

  const redirects = [];
  for (const rule of hosting.redirects || []) {
    const converted = redirectToVercel(rule);
    if (!converted.length) throw new Error(`redirect produced no rules: ${JSON.stringify(rule)}`);
    redirects.push(...converted);
    report.redirectsFrom += 1;
  }
  report.redirects = redirects.length;

  const rewrites = [];
  for (const rule of hosting.rewrites || []) {
    const converted = rewriteToVercel(rule);
    if (!converted.length) throw new Error(`rewrite produced no rules: ${JSON.stringify(rule)}`);
    rewrites.push(...converted);
    report.rewritesFrom += 1;
  }
  report.rewrites = rewrites.length;

  /* Staging guard: noindex the HTML on the *.vercel.app mirror only, and never
     the endpoints a crawler has to read. Scoped by host so that attaching a
     custom domain later does not inherit the noindex. */
  const headers = [{
    source: `/:path((?!${CRAWLER_ENDPOINTS}).*)`,
    has: [{ type: 'host', value: PREVIEW_HOST }],
    headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
  }];

  for (const block of hosting.headers || []) {
    const converted = headersToVercel(block);
    if (!converted.length) throw new Error(`header block produced no rules: ${block.source}`);
    headers.push(...converted);
    report.headersFrom += 1;
  }
  report.headers = headers.length;

  const config = {
    $schema: 'https://openapi.vercel.sh/vercel.json',
    /* Same semantics as firebase.json: /about.html -> /about, no trailing
       slash. Both emit a permanent (308 here, 301 on Firebase) redirect for
       the form that is not canonical. */
    cleanUrls: hosting.cleanUrls !== false,
    trailingSlash: hosting.trailingSlash === true,
    redirects,
    rewrites,
    headers,
  };

  return { config, report };
}

/* ------------------------------------------------------------------- cli */

function main() {
  const firebaseConfig = JSON.parse(fs.readFileSync(FIREBASE_JSON, 'utf8'));
  const { config, report } = buildVercelConfig(firebaseConfig);
  const serialized = JSON.stringify(config, null, 2) + '\n';

  if (process.argv.includes('--check')) {
    if (!fs.existsSync(VERCEL_JSON)) {
      console.error('vercel.json is missing — run: node scripts/build-vercel-config.mjs');
      process.exit(1);
    }
    const committed = fs.readFileSync(VERCEL_JSON, 'utf8');
    if (committed !== serialized) {
      console.error('vercel.json is out of date with firebase.json — run: node scripts/build-vercel-config.mjs');
      process.exit(1);
    }
    console.log(
      `vercel.json in sync: ${report.redirects} redirects (from ${report.redirectsFrom}), ` +
      `${report.rewrites} rewrites (from ${report.rewritesFrom}), ` +
      `${report.headers} header rules (from ${report.headersFrom} blocks)`
    );
    return;
  }

  fs.writeFileSync(VERCEL_JSON, serialized);
  console.log(
    `vercel.json written: ${report.redirects} redirects (from ${report.redirectsFrom}), ` +
    `${report.rewrites} rewrites (from ${report.rewritesFrom}), ` +
    `${report.headers} header rules (from ${report.headersFrom} blocks)`
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
