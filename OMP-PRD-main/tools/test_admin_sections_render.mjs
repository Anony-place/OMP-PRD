#!/usr/bin/env node
/* ============================================================
   Every admin section, actually rendered.

   The other admin tests check wiring and escaping by reading the source. None
   of them run the code, which is how a section that throws on the first line
   still passes everything and ships as a blank panel.

   Here each section is mounted in a real DOM against a fake Supabase client
   that behaves like the real one - a chainable query builder, a storage list,
   an RPC that returns what the migration returns - and twice each:

     with data     the normal case
     with nothing  the first visit, before anything exists

   The empty case matters more. A brand-new install has no deploy rows, no
   redirects, no revisions and no subscribers, and that is exactly when
   somebody is looking at the screen to find out why nothing works.

   Run: node tools/test_admin_sections_render.mjs
   Requires: npm ci --prefix tools/qa-deps --ignore-scripts
   ============================================================ */

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

process.removeAllListeners('warning');
process.on('warning', (warning) => {
  if (warning.code !== 'MODULE_TYPELESS_PACKAGE_JSON') console.warn(warning);
});

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require_ = createRequire(path.join(ROOT, 'tools/qa-deps/'));
const { JSDOM } = require_('jsdom');

const dom = new JSDOM('<!doctype html><html><body><section id="panel"></section></body></html>', {
  url: 'https://oopsmypassword.web.app/Anony.su/'
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
/* Node defines navigator as a getter, so it is replaced rather than assigned.
   The panel calls navigator.clipboard, which jsdom does not implement. */
Object.defineProperty(globalThis, 'navigator', {
  value: { ...dom.window.navigator, clipboard: { writeText: () => Promise.resolve() } },
  configurable: true
});
globalThis.confirm = () => true;
globalThis.prompt = () => null;

let passed = 0;
const failures = [];
function assert(condition, message) {
  if (condition) { passed += 1; console.log(`  ✓ ${message}`); return; }
  failures.push(message);
  console.log(`  ✗ ${message}`);
}
const section = (name) => console.log(`\n${name}`);

/* ------------------------------------------------------------ the fake */

const NOW = new Date().toISOString();

const DATA = {
  publish_jobs: [
    { id: 'job-1', status: 'live', reason: 'article:x', targets: ['/articles/x'], detail: null, run_url: 'https://github.com/x/y/actions/runs/1', commit_sha: 'abcdef1234567', created_at: NOW, updated_at: NOW },
    /* Two hours old and still queued: the case where the workflow ran and could
       not report back. It must not be painted as work in progress. */
    { id: 'job-0', status: 'queued', reason: 'article:y', targets: [], detail: null, run_url: null, commit_sha: null, created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(), updated_at: NOW }
  ],
  redirects: [{ from_path: '/articles/old', to_path: '/articles/new', status_code: 301, note: 'renamed', created_at: NOW }],
  articles: [{ id: 'a-1', title: 'Kerberos', slug: 'kerberos', status: 'published', updated_at: NOW, content: '<p>hi</p>', category_id: 'c-1' }],
  article_revisions: [{ id: 'r-1', title: 'Kerberos', content: '<p>older</p>', reason: 'update', created_at: NOW, created_by: null, status: 'published', seq: 2 }],
  article_categories: [{ id: 'c-1', name: 'Guides', slug: 'guides', sort_order: 0 }],
  panel_settings: [{ id: 1, default_status: 'draft', default_category_id: 'c-1', autodeploy_on_save: true }],
  products: [{ id: 'p-1', name: 'Field guide', slug: 'field-guide', status: 'published', featured_image: null, description: '' }],
  tools: [{ id: 't-1', name: 'Entropy', slug: 'entropy', is_active: true, icon: null, description: '' }],
  audit_log: [{ id: 1, at: NOW, actor: null, actor_email: 'admin@example.test', table_name: 'articles', action: 'update', changed: ['title'], detail: { title: 'Kerberos' } }],
  osint_tools: [{ id: 'o-1', name: 'Sherlock', slug: 'sherlock', logo_url: '', description: '' }],
  pentest_tools: [{ id: 'pt-1', name: 'nmap', slug: 'nmap', logo_url: '', description: '' }]
};

const RPC = {
  list_admins: [{ id: 'admin-1', email: 'admin@example.test', is_admin: true, created_at: NOW }],
  admin_counts: { admins: 1, accounts: 12 },
  delete_article_category: 2,
  newsletter_overview: {
    subscribers: { total: 4, active: 2, pending: 1, unsubscribed: 1, joined_7d: 2, joined_30d: 3 },
    deliveries: { pending: 1, sending: 0, sent: 9, failed: 1, cancelled: 0 },
    recent: [{ id: 's-1', email: 'a@example.test', status: 'active', created_at: NOW, confirmed_at: NOW }],
    problems: [{ article_id: 'a-1', subscriber_id: 's-2', attempts: 5, first_attempt_at: NOW, email: 'b@example.test', title: 'Kerberos' }]
  },
  restore_article_revision: 'a-1'
};

const STORAGE = {
  articles: [{ id: 'f-1', name: 'diagram.svg', created_at: NOW, metadata: { size: 2048 } }],
  'osint-logos': [],
  'pentest-logos': [],
  products: [],
  'product-files': []
};

/* A query builder that behaves like PostgREST for the calls the panel makes:
   every method returns itself, and the object is awaitable. */
function builder(rows) {
  const result = { data: rows, error: null, count: rows.length };
  const chain = {
    select: () => chain,
    eq: () => chain,
    in: () => chain,
    or: () => chain,
    gte: () => chain,
    lte: () => chain,
    order: () => chain,
    limit: () => chain,
    update: () => chain,
    insert: () => chain,
    delete: () => chain,
    maybeSingle: () => Promise.resolve({ data: rows[0] || null, error: null }),
    single: () => Promise.resolve({ data: rows[0] || null, error: null }),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject)
  };
  return chain;
}

function fakeClient({ empty = false } = {}) {
  const rows = (table) => (empty ? [] : DATA[table] || []);
  return {
    from: (table) => builder(rows(table)),
    rpc: (name) => Promise.resolve({
      data: empty
        ? (name === 'newsletter_overview' ? { subscribers: {}, deliveries: {}, recent: [], problems: [] }
          : name === 'list_admins' ? [] : name === 'admin_counts' ? { admins: 1, accounts: 1 } : null)
        : RPC[name],
      error: null
    }),
    storage: {
      from: (bucket) => ({
        list: () => Promise.resolve({ data: empty ? [] : STORAGE[bucket] || [], error: null }),
        getPublicUrl: (name) => ({ data: { publicUrl: `https://example.test/${bucket}/${name}` } }),
        upload: () => Promise.resolve({ error: null }),
        remove: () => Promise.resolve({ error: null })
      })
    },
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'admin-1', email: 'admin@example.test' } } }) },
    functions: {
      invoke: () => Promise.resolve({
        data: { ok: true, configured: { github_token: true, repo: true, repo_name: 'Anony-place/OMP-PRD' }, tables: {}, latest_job: null },
        error: null
      })
    }
  };
}

const sections = await import(pathToFileURL(path.join(ROOT, 'assets/js/admin/sections.js')).href);
const esc = (value = '') => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function makeContext({ empty }) {
  const panel = document.querySelector('#panel');
  panel.innerHTML = '';
  return {
    panel,
    esc,
    supabase: fakeClient({ empty }),
    notice: (message) => `<div class="notice">${message}</div>`,
    flash: (host, message) => { if (host) host.setAttribute('data-flash', message); },
    loadTab: () => {},
    requestPublish: async () => ({ job_id: 'job-1' }),
    publishChip: () => {},
    storage: dom.window.localStorage
  };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 30));

const EXPECTED = {
  deploys: [/Deploys/, /live/, /could not report back/],
  revisions: [/Revisions/, /Kerberos/],
  redirects: [/Redirects/, /articles\/old/, /articles\/new/],
  categories: [/Categories/, /Guides/, /1 article/],
  media: [/Media/, /diagram\.svg/, /used in 1|unused|usage unknown/],
  activity: [/Activity/, /update/, /Kerberos/],
  settings: [/Settings/, /Publish the whole site now/, /Canonical origin/, /Guides/],
  setup: [/Setup/, /GitHub token/, /Publish function/],
  newsletter: [/Newsletter/, /Confirmed/, /Waiting to confirm/],
  access: [/Access/, /admin@example\.test/],
  search: [/Search/, /Search the library/i],
  export: [/Export/, /JSON/, /Markdown/]
};

const EMPTY_EXPECTED = {
  deploys: /No deploys yet/,
  revisions: /No versions yet|no article matches|No article matches|Type at least/i,
  redirects: /No redirects/,
  categories: /No categories yet/,
  media: /Nothing in|No files|Nothing matches/,
  activity: /Nothing recorded yet|Nothing matches/,
  settings: /No categories exist yet|Draft/,
  setup: /Setup/,
  newsletter: /Nobody has subscribed|No address/,
  access: /Nobody has access|admin/,
  search: /Type at least 2 characters/,
  export: /Download/
};

section('Every declared section mounts');
for (const tab of sections.SECTION_TABS) {
  assert(typeof tab.key === 'string' && tab.key.length > 0, `"${tab.label}" has a key`);
  assert(Boolean(EXPECTED[tab.key]), `"${tab.key}" has an expected rendering to check`);
}

section('With data: the screen paints what the data says');
for (const tab of sections.SECTION_TABS) {
  const ctx = makeContext({ empty: false });
  let threw = null;
  try {
    await sections.mountSection(tab.key, ctx);
    await settle();
  } catch (error) {
    threw = error;
  }

  assert(!threw, `"${tab.key}" mounts without throwing${threw ? ` (${threw.message})` : ''}`);
  if (threw) continue;

  const html = ctx.panel.innerHTML;
  assert(html.length > 200, `"${tab.key}" painted something (${html.length} bytes)`);
  assert(!/\bundefined\b|\bNaN\b|\[object Object\]/.test(html), `"${tab.key}" has no undefined/NaN/[object Object] in its output`);
  assert(!/data-flash="[^"]*(failed|cannot|Error)/i.test(html), `"${tab.key}" did not report a failure`);

  for (const pattern of EXPECTED[tab.key]) {
    assert(pattern.test(html), `"${tab.key}" shows ${pattern}`);
  }
}

section('First visit: nothing exists yet, and nothing crashes');
for (const tab of sections.SECTION_TABS) {
  const ctx = makeContext({ empty: true });
  let threw = null;
  try {
    await sections.mountSection(tab.key, ctx);
    await settle();
  } catch (error) {
    threw = error;
  }

  assert(!threw, `"${tab.key}" mounts against an empty database${threw ? ` (${threw.message})` : ''}`);
  if (threw) continue;

  const html = ctx.panel.innerHTML;
  assert(!/\bundefined\b|\bNaN\b/.test(html), `"${tab.key}" renders no undefined/NaN when empty`);
  assert(EMPTY_EXPECTED[tab.key].test(html), `"${tab.key}" says what is empty instead of showing a blank panel`);
}

section('No section leaks an internal identifier into the visible text');
for (const tab of sections.SECTION_TABS) {
  const ctx = makeContext({ empty: false });
  await sections.mountSection(tab.key, ctx).catch(() => {});
  await settle();
  const text = ctx.panel.textContent.replace(/\s+/g, ' ');
  assert(!/null|undefined/.test(text), `"${tab.key}" shows no raw null/undefined to the reader`);
}

section('A job that started a minute ago is not called stuck');
{
  const original = DATA.publish_jobs;
  const base = original[0];
  DATA.publish_jobs = [{ ...base, id: 'job-fresh', status: 'queued', created_at: new Date(Date.now() - 60 * 1000).toISOString() }];
  const ctx = makeContext({ empty: false });
  await sections.mountSection('deploys', ctx);
  const html = ctx.panel.innerHTML;
  assert(!/could not report back/.test(html),
    'a queued job younger than 30 minutes does not show the "could not report back" warning');
  assert(/queued/.test(html), 'and it is still shown, as queued');
  DATA.publish_jobs = original;
}

console.log(`\n${passed} passed, ${failures.length} failed\n`);
if (failures.length) process.exitCode = 1;
