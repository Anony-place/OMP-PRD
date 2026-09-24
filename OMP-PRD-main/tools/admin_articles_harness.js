/* Behavioral harness for the admin Articles section, login recovery and the
   shared error/UX helpers (jsdom + scripted supabase mock).
   run: NODE_PATH=<dir containing jsdom> node tools/admin_articles_harness.js

   Covers:
   - quick Publish / Unpublish from the list, and the "View ↗" live link
   - editing an article with PDF page images keeps the images it still uses
     (regression: cleanup regex never matched; fixing it naively would have
     deleted in-use images on every edit)
   - deleting an article removes its document AND its PDF page images
   - changing a published slug asks for confirmation; declining aborts
   - duplicate-slug errors are translated for the editor
   - "Forgot password?" sends the reset mail with the /admin/ redirect
   - products list shows cover thumbnails and a View link */
const { JSDOM } = require('jsdom');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log('  ✗ FAIL: ' + msg); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const LIBS = ['url.js', 'sanitize.js', 'markdown.js', 'filevalidate.js'].map(f => fs.readFileSync(`${ROOT}/assets/js/${f}`, 'utf8'));

const PDF = n => `https://aeehfulikupskyrvcpzb.supabase.co/storage/v1/object/public/articles/pdf-pages/guide/111-page-${n}.jpg`;
const DOC = 'https://aeehfulikupskyrvcpzb.supabase.co/storage/v1/object/public/articles/111-guide.pdf';
const ARTICLES = [
  { id: 'a1', title: 'Published guide', slug: 'guide', status: 'published', published_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-02T00:00:00Z', category_id: null, document_url: DOC,
    summary: '', featured_image: '', content: `Intro\n\n![PDF page 1](${PDF(1)})\n\n![PDF page 2](${PDF(2)})` },
  { id: 'a2', title: 'Draft note', slug: 'draft-note', status: 'draft', published_at: null, updated_at: '2026-09-03T00:00:00Z', category_id: null, document_url: null, summary: '', featured_image: '', content: 'Body' }
];
const PRODUCTS = [
  { id: 'p1', name: 'Book', slug: 'book', product_type: 'book', status: 'published', featured: false, price: 5, currency: 'USD', external_url: '', file_path: null,
    featured_image: 'https://aeehfulikupskyrvcpzb.supabase.co/storage/v1/object/public/products/covers/1-book.png', updated_at: '2026-09-01T00:00:00Z' }
];

let calls, nextUpdateError;
function reset() { calls = { updates: [], deletes: [], inserts: [], removes: [], resets: [] }; nextUpdateError = null; }
reset();

function makeClient() {
  return {
    auth: {
      getUser: async () => ({ data: { user: { id: 'u1', email: 'admin@example.com' } }, error: null }),
      getSession: async () => ({ data: { session: { user: { id: 'u1' } } }, error: null }),
      signInWithPassword: async () => ({ error: { status: 429, message: 'Request rate limit reached' } }),
      signOut: async () => ({ error: null }),
      resetPasswordForEmail: async (email, opts) => { calls.resets.push({ email, opts }); return { error: null }; },
      updateUser: async () => ({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } })
    },
    from(table) {
      const b = {
        _eqs: [],
        select(cols, opts) { b._head = opts && opts.head; return b; },
        eq(col, v) { b._eqs.push([col, v]); return b; },
        order() { return b; },
        limit() { return b; },
        update(set) { b._op = 'update'; calls.updates.push({ table, set, eqs: b._eqs }); return b; },
        insert(payload) { b._op = 'insert'; calls.inserts.push({ table, payload }); return b; },
        delete() { b._op = 'delete'; calls.deletes.push({ table, eqs: b._eqs }); return b; },
        _row() {
          const id = (b._eqs.find(e => e[0] === 'id') || [])[1];
          const src = table === 'articles' ? ARTICLES : table === 'products' ? PRODUCTS : [];
          const row = src.find(r => r.id === id);
          return row ? { ...row } : null;
        },
        single: async () => { const r = b._row(); return r ? { data: r, error: null } : { data: null, error: { message: 'not found' } }; },
        maybeSingle: async () => {
          if (table === 'profiles') return { data: { id: 'u1', email: 'admin@example.com', is_admin: true }, error: null };
          return { data: b._row(), error: null };
        },
        then(res) {
          setTimeout(() => {
            if (b._op === 'update' && nextUpdateError) { const e = nextUpdateError; nextUpdateError = null; return res({ data: null, error: e }); }
            if (b._op) return res({ data: null, error: null });
            if (b._head) return res({ count: 1, error: null });
            if (table === 'articles') return res({ data: ARTICLES.map(a => ({ ...a })), error: null });
            if (table === 'products') return res({ data: PRODUCTS.map(p => ({ ...p })), error: null });
            res({ data: [], error: null });
          }, 3);
        }
      };
      return b;
    },
    storage: {
      from(bucket) {
        return {
          remove: async paths => { calls.removes.push({ bucket, paths }); return { error: null }; },
          upload: async path => ({ data: { path }, error: null }),
          getPublicUrl: path => ({ data: { publicUrl: `https://aeehfulikupskyrvcpzb.supabase.co/storage/v1/object/public/${bucket}/${path}` } })
        };
      }
    }
  };
}

async function boot({ url = 'https://oopsmypassword.web.app/admin/', signedIn = true } = {}) {
  const dom = new JSDOM('<!doctype html><html><head></head><body><div id="admin-root"></div></body></html>', { url, runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.Element.prototype.scrollIntoView = function () {};
  w.confirm = () => w.__confirmAnswer !== false;
  for (const src of LIBS) w.eval(src);
  w.__mockCreateClient = () => {
    const c = makeClient();
    if (!signedIn) { c.auth.getUser = async () => ({ data: { user: null }, error: null }); c.auth.getSession = async () => ({ data: { session: null }, error: null }); }
    return c;
  };
  const admin = fs.readFileSync(`${ROOT}/assets/js/admin.js`, 'utf8');
  w.eval(admin.replace(/^import \{ createClient \} from .*$/m, 'const createClient = window.__mockCreateClient;'));
  await sleep(80);
  return w;
}

(async () => {
  let w = await boot();
  const $ = s => w.document.querySelector(s);
  ok(w.document.body.textContent.includes('OMP Control Center'), 'dashboard renders');
  await sleep(40);
  ok(w.document.querySelectorAll('.admin-kpi').length === 5, 'five KPIs incl. live products');

  /* ---------- list: View link + quick publish ---------- */
  const view = [...w.document.querySelectorAll('#article-list a')].find(a => /View/.test(a.textContent));
  ok(view && view.href === 'https://oopsmypassword.web.app/articles/guide', 'published article has a View link to its public URL');
  ok(view && view.rel.includes('noopener'), 'View link opens with noopener');
  const draftRow = $('[data-publish-article="a2"]');
  ok(draftRow && draftRow.textContent === 'Publish', 'draft shows a Publish button');
  draftRow.click(); await sleep(60);
  let up = calls.updates.pop();
  ok(up && up.table === 'articles' && up.set.status === 'published' && up.set.published_at, 'quick Publish sets status + published_at');
  ok(/15 minutes/.test($('#panel [data-flash]')?.textContent || ''), 'editor is told when the public page updates');

  w.__confirmAnswer = false;
  $('[data-publish-article="a1"]').click(); await sleep(40);
  ok(!calls.updates.length, 'Unpublish asks first and does nothing when declined');
  w.__confirmAnswer = true;

  /* ---------- edit keeps in-use PDF images ---------- */
  reset();
  $('[data-edit-article="a1"]').click(); await sleep(40);
  let form = $('#article-form');
  const ta = form.querySelector('textarea[name="content"]');
  ta.value = ta.value.replace('Intro', 'Intro, edited');
  form.dispatchEvent(new w.Event('submit', { cancelable: true })); await sleep(80);
  const removedPaths = calls.removes.flatMap(r => r.paths);
  ok(calls.updates.some(u => u.table === 'articles'), 'article edit saved');
  ok(!removedPaths.some(p => p.startsWith('pdf-pages/')), 'editing text does NOT delete PDF page images still in the body');

  /* ---------- edit that drops one image removes only that one ---------- */
  reset();
  $('[data-edit-article="a1"]').click(); await sleep(40);
  form = $('#article-form');
  const ta2 = form.querySelector('textarea[name="content"]');
  ta2.value = ta2.value.replace(`![PDF page 2](${PDF(2)})`, '');
  form.dispatchEvent(new w.Event('submit', { cancelable: true })); await sleep(80);
  const removed2 = calls.removes.flatMap(r => r.paths);
  ok(removed2.includes('pdf-pages/guide/111-page-2.jpg'), 'image removed from the body is deleted from Storage');
  ok(!removed2.includes('pdf-pages/guide/111-page-1.jpg'), 'image still in the body is kept');

  /* ---------- slug change on a published article needs confirmation ---------- */
  reset();
  $('[data-edit-article="a1"]').click(); await sleep(40);
  form = $('#article-form');
  form.querySelector('input[name="slug"]').value = 'guide-renamed';
  w.__confirmAnswer = false;
  form.dispatchEvent(new w.Event('submit', { cancelable: true })); await sleep(60);
  ok(!calls.updates.length, 'declining the URL-change prompt does not save');
  ok(/not changed/.test(form.querySelector('[data-flash]')?.textContent || ''), 'editor is told the URL was not changed');
  w.__confirmAnswer = true;

  /* ---------- duplicate slug is explained ---------- */
  reset();
  nextUpdateError = { code: '23505', message: 'duplicate key value violates unique constraint "articles_slug_key"' };
  form.dispatchEvent(new w.Event('submit', { cancelable: true })); await sleep(80);
  ok(/already uses that slug/.test(form.querySelector('[data-flash]')?.textContent || ''), 'duplicate slug error is human-readable');

  /* ---------- delete removes doc + PDF images ---------- */
  reset();
  $('#cancel-editor') && $('#cancel-editor').click();
  $('[data-delete-article="a1"]').click(); await sleep(80);
  const del = calls.removes.flatMap(r => r.paths);
  ok(calls.deletes.some(d => d.table === 'articles'), 'article row deleted');
  ok(del.includes('111-guide.pdf'), 'attached document removed');
  ok(del.includes('pdf-pages/guide/111-page-1.jpg') && del.includes('pdf-pages/guide/111-page-2.jpg'), 'PDF page images removed with the article');

  /* ---------- products list thumbnails + View ---------- */
  $('[data-tab="products"]').click(); await sleep(60);
  ok(!!w.document.querySelector('#product-list img'), 'product list shows the cover thumbnail (featured_image now selected)');
  ok([...w.document.querySelectorAll('#product-list a')].some(a => a.href === 'https://oopsmypassword.web.app/products/book'), 'published product has a View link');

  /* ---------- login: forgot password + throttling ---------- */
  w = await boot({ signedIn: false });
  const q = s => w.document.querySelector(s);
  ok(!!q('#forgot-password'), 'login offers Forgot password');
  q('#email').value = 'admin@example.com';
  q('#forgot-password').click(); await sleep(30);
  ok(calls.resets.length === 1 && calls.resets[0].opts.redirectTo === 'https://oopsmypassword.web.app/admin/', 'reset mail requested with /admin/ redirect');
  ok(/If that address belongs/.test(w.document.body.textContent), 'reset response does not reveal whether the account exists');
  q('#email').value = 'admin@example.com'; q('#password').value = 'x';
  q('#login-form').dispatchEvent(new w.Event('submit', { cancelable: true })); await sleep(30);
  ok(/Too many sign-in attempts/.test(w.document.body.textContent), 'rate-limited sign-in explains the wait');

  /* ---------- recovery link shows the set-password form ---------- */
  w = await boot({ url: 'https://oopsmypassword.web.app/admin/#access_token=x&type=recovery' });
  ok(!!w.document.querySelector('#reset-form'), 'recovery link opens the new-password form instead of the dashboard');
  ok(!w.document.body.textContent.includes('OMP Control Center'), 'dashboard is not shown during recovery');

  console.log(`\n${pass}/${pass + fail} admin articles/auth behavioral checks passed${fail ? `, ${fail} FAILURES` : ''}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('HARNESS CRASH:', e); process.exit(1); });
