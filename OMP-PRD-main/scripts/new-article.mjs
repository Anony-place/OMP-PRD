#!/usr/bin/env node
/* ============================================================
   new-article.mjs - put an article on the site from a terminal.

     node scripts/new-article.mjs draft.md
     node scripts/new-article.mjs draft.md --status published
     node scripts/new-article.mjs draft.md --status draft --dry-run

   This is the real path, not a mock: it signs in as an admin, calls
   content-publish with {"action":"create"}, the function checks is_admin
   server-side, inserts the row, and starts a deploy. The article is on the
   site when the deploy finishes, and `publish_jobs` says so.

   Why not write to the database directly: the service-role key would have to
   live in your shell, and then the only thing standing between a typo and a
   broken page is a script nobody reviews. Here the key stays in Supabase and
   the rules live in one place for both callers.

   Environment (never commit these):
     SUPABASE_URL          default https://aeehfulikupskyrvcpzb.supabase.co
     SUPABASE_EMAIL        an admin account
     SUPABASE_PASSWORD     its password

   File format - front matter, then the body, both optional but one of them
   has to give a title:

     ---
     title: Password managers, honestly compared
     slug: password-managers-compared
     status: published
     category: guides            # name or slug
     excerpt: One paragraph for cards and search results.
     seo_title: ...              # optional, defaults to the title
     seo_description: ...        # optional, defaults to the excerpt
     cover_image_url: /assets/img/...
     scheduled_for: 2026-12-01T09:00:00Z   # only with status: scheduled
     ---

     Body in Markdown or HTML. It is sanitised where it is rendered, by the same
     allowlist as an article typed in the panel.
   ============================================================ */

import fs from 'node:fs';
import path from 'node:path';

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://aeehfulikupskyrvcpzb.supabase.co').replace(/\/+$/, '');
const EMAIL = process.env.SUPABASE_EMAIL || '';
const PASSWORD = process.env.SUPABASE_PASSWORD || '';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? args[at + 1] : undefined;
};
const file = args.find((arg) => !arg.startsWith('--') && !/^\d{4}-\d{2}-\d{2}T/.test(arg) && !['draft', 'published', 'scheduled'].includes(arg));

const die = (message, code = 1) => { console.error(`\n  ✗ ${message}\n`); process.exit(code); };

if (!file) {
  console.error(`
  Usage: node scripts/new-article.mjs <file.md> [--status draft|published|scheduled]
                                                 [--dry-run] [--json]

  Write the article in Markdown or HTML, with optional front matter:

    ---
    title: How password managers actually work
    slug: how-password-managers-work
    status: published
    category: guides
    excerpt: One line for the cards.
    ---

    Body goes here.
`);
  process.exit(2);
}
if (!fs.existsSync(file)) die(`no such file: ${file}`);
if (fs.statSync(file).isDirectory()) die(`${file} is a directory, not an article`);

/* ------------------------------------------------------------------ parse */

function splitFrontMatter(text) {
  const normalized = text.replace(/\r\n/g, '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return { meta: {}, body: normalized };
  const meta = {};
  for (const line of match[1].split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const at = line.indexOf(':');
    if (at < 0) continue;
    const key = line.slice(0, at).trim();
    let value = line.slice(at + 1).trim();
    /* Only straight quotes are stripped: a title may legitimately contain
       an apostrophe, and trimming those would silently change it. */
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1).replace(/\\"/g, '"');
    }
    meta[key] = value;
  }
  return { meta, body: normalized.slice(match[0].length) };
}

const source = fs.readFileSync(file, 'utf8');
const { meta, body } = splitFrontMatter(source);

/* A title can come from front matter, from the file name, or from the first
   heading. In that order: explicit wins, a heading is a guess, a file name is a
   last resort. */
const firstHeading = body.match(/^\s*#{1}\s+(.+)$/m)?.[1] || body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, '');
const title = String(meta.title || firstHeading || path.basename(file).replace(/\.(md|markdown|html?|txt)$/i, '').replace(/[-_]+/g, ' ')).trim();

const slugify = (value) => String(value || '').toLowerCase().trim()
  .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

const status = String(option('status') || meta.status || 'draft').toLowerCase();
const article = {
  title,
  slug: String(meta.slug || '').trim() || slugify(title),
  status,
  content: body.trim(),
  category: meta.category || undefined,
  excerpt: meta.excerpt || meta.description || undefined,
  seo_title: meta.seo_title || undefined,
  seo_description: meta.seo_description || undefined,
  cover_image_url: meta.cover_image_url || meta.image || undefined,
  scheduled_for: meta.scheduled_for || undefined
};

/* ------------------------------------------------------------- validate */

const problems = [];
if (!article.title) problems.push('no title (front matter, first heading or file name)');
if (!article.slug) problems.push('slug is empty after cleaning the title');
if (!['draft', 'published', 'scheduled'].includes(article.status)) problems.push(`status "${article.status}" is not draft/published/scheduled`);
if (article.status !== 'draft' && !article.content) problems.push('a published article needs a body');
if (article.status === 'scheduled' && !article.scheduled_for) problems.push('status: scheduled needs scheduled_for');
if (article.scheduled_for && Number.isNaN(Date.parse(article.scheduled_for))) problems.push(`scheduled_for "${article.scheduled_for}" is not a date`);
/* A front-matter typo that silently becomes part of the body is the kind of
   thing you only notice after a deploy. */
for (const key of Object.keys(meta)) {
  if (!['title', 'slug', 'status', 'category', 'excerpt', 'description', 'seo_title', 'seo_description',
        'cover_image_url', 'image', 'scheduled_for'].includes(key)) {
    console.warn(`  ! unknown front-matter field "${key}" - ignored`);
  }
}

if (problems.length) {
  for (const problem of problems) console.error(`  ✗ ${problem}`);
  process.exit(1);
}

const summary = `
  title     ${article.title}
  slug      ${article.slug}   ->  /articles/${article.slug}
  status    ${article.status}${article.scheduled_for ? `  (${article.scheduled_for})` : ''}
  category  ${article.category || '(none)'}
  body      ${article.content.length.toLocaleString()} characters, ${article.content.split('\n').length} lines
`;

if (flag('dry-run')) {
  console.log(`${summary}\n  dry run - nothing was sent\n`);
  process.exit(0);
}

/* ------------------------------------------------------------------ send */

if (!EMAIL || !PASSWORD) {
  die('SUPABASE_EMAIL and SUPABASE_PASSWORD are not set.\n    The function checks is_admin server-side, so it needs a real session.');
}

async function post(pathname, payload, token) {
  const response = await fetch(`${SUPABASE_URL}${pathname}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_s3n2U32MNB4PvHx0GolyqA_wlkzD6eR',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000)
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { error: text.slice(0, 300) }; }
  return { ok: response.ok, status: response.status, data };
}

const signed = await post('/auth/v1/token?grant_type=password', { email: EMAIL, password: PASSWORD });
if (!signed.ok || !signed.data?.access_token) {
  die(`sign in failed (HTTP ${signed.status}): ${signed.data?.error_description || signed.data?.msg || signed.data?.error || 'no token'}`);
}
const token = signed.data.access_token;

const created = await post('/functions/v1/content-publish', {
  action: 'create',
  reason: `cli:${article.slug}`,
  article
}, token);

if (!created.ok || created.data?.error) {
  const known = Array.isArray(created.data?.known) ? `\n    known categories: ${created.data.known.join(', ')}` : '';
  die(`create failed (HTTP ${created.status}): ${created.data?.error || 'no detail'}${known}`);
}

console.log(`${summary}
  created   ${created.data.id}
  deploy    ${created.data.job_id ? `queued (job ${created.data.job_id})` : 'not started'}${created.data.coalesced ? ' - joined a deploy already running' : ''}

  The page exists when that job reaches "live". Watch it in the panel: Deploys.
`);

if (flag('json')) console.log(JSON.stringify(created.data, null, 2));
