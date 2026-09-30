/* Behavioral harness for the admin Products section (jsdom, scripted
   supabase mock). Covers: dashboard tab, list + quick actions (publish/
   feature/delete), editor form population, submit validation (URL scheme
   gates, price/currency, slugify), cover upload (public bucket + public
   URL) and deliverable upload (PRIVATE bucket, never getPublicUrl). */
const { JSDOM } = require('jsdom');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..'); /* run: NODE_PATH=<jsdom> node tools/<this> */

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log('  ✗ FAIL: ' + msg); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* The admin click handlers are async: they await a mocked Supabase query
   before they touch the DOM or the recorded calls. How many ticks that takes
   depends on machine load, so a fixed sleep made this harness fail
   intermittently. Wait for the observable condition instead, with a bounded
   timeout so a real regression still reports as a failure and not a hang. */
/* A quick action (publish/feature/delete) calls loadTab('products'), which
   replaces the whole list. The buttons the test holds references to are
   therefore stale the moment the write is recorded, and clicking one of those
   re-renders into a detached container. Wait for the button to be replaced. */
const waitReplaced = async (el, label) =>
  waitFor(() => !el.isConnected, `${label} (list re-render)`);

const waitFor = async (fn, label = 'condition', timeoutMs = 5000) => {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() > deadline) throw new Error(`timed out after ${timeoutMs}ms waiting for ${label}`);
    await sleep(5);
  }
};

const LIBS = ['url.js', 'sanitize.js', 'markdown.js', 'filevalidate.js'].map(f => fs.readFileSync(`${ROOT}/assets/js/${f}`, 'utf8'));
let ADMIN = fs.readFileSync(`${ROOT}/assets/js/admin.js`, 'utf8');

const PRODUCTS = [
  { id: 'p1', name: 'The Passphrase Book', slug: 'passphrase-book', product_type: 'book', status: 'published', featured: true, price: 29.99, currency: 'USD', external_url: 'https://buy.example.com/book', file_path: null, updated_at: '2026-09-01T00:00:00Z' },
  { id: 'p2', name: 'Family Audit Checklist', slug: 'audit-checklist', product_type: 'template', status: 'draft', featured: false, price: 9, currency: 'EUR', external_url: '', file_path: 'product-files/audit/pack.zip', updated_at: '2026-09-02T00:00:00Z' }
];

const calls = { updates: [], deletes: [], inserts: [], uploads: [], publicUrls: [] };

function makeClient() {
  return {
    auth: {
      getUser: async () => ({ data: { user: { id: 'u1' } }, error: null }),
      signOut: async () => ({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } })
    },
    from(table) {
      const rec = { table };
      const b = {
        select() { return b; },
        eq(col, v) { (b._eqs = b._eqs || []).push([col, v]); return b; },
        order() { return b; },
        limit() { return b; },
        maybeSingle: async () => {
          if (table === 'profiles') return { data: { id: 'u1', email: 'a@b.c', is_admin: true }, error: null };
          return { data: null, error: { message: 'unexpected maybeSingle ' + table } };
        },
        single: async () => {
          if (table === 'products' && b._eqs) {
            const id = b._eqs.find(e => e[0] === 'id');
            const row = PRODUCTS.find(p => p.id === (id && id[1]));
            return row ? { data: { ...row }, error: null } : { data: null, error: { message: 'not found' } };
          }
          return { data: null, error: { message: 'unexpected single ' + table } };
        },
        update(set) {
          calls.updates.push({ table, set, eqs: b._eqs || [] });
          rec._set = set;
          return b;
        },
        insert(payload) { calls.inserts.push({ table, payload }); return b; },
        delete() { calls.deletes.push({ table, eqs: b._eqs || [] }); return b; },
        then(res) {
          setTimeout(() => {
            if (table === 'products') res({ data: PRODUCTS.map(p => ({ ...p })), error: null });
            else if (table === 'articles' || table === 'messages' || table === 'article_categories' || table === 'tool_categories') res({ data: [], error: null });
            else res({ data: [], error: null });
          }, 5);
        }
      };
      return b;
    },
    storage: {
      from(bucket) {
        return {
          upload: async (path, file, opts) => {
            calls.uploads.push({ bucket, path, file, opts });
            return { data: { path }, error: null };
          },
          getPublicUrl: path => { calls.publicUrls.push({ bucket, path }); return { data: { publicUrl: 'https://pub.example.com/' + bucket + '/' + path } }; }
        };
      }
    }
  };
}

async function boot() {
  const html = `<!doctype html><html><head></head><body><div id="admin-root"></div></body></html>`;
  const dom = new JSDOM(html, { url: 'https://oopsmypassword.web.app/admin/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.matchMedia = w.matchMedia || (q => ({ matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
  w.Element.prototype.scrollIntoView = w.Element.prototype.scrollIntoView || function () {};
  /* jsdom FormData reads the internal file slot, not .files — inject the
     harness-selected file into the entry list after construction. */
  const OrigFormData = w.FormData;
  w.FormData = class extends OrigFormData {
    constructor(form) {
      super(form);
      if (form && form.querySelectorAll) {
        form.querySelectorAll('input[type="file"][name]').forEach(inp => {
          if (inp.__harnessFile) { this.delete(inp.name); this.append(inp.name, inp.__harnessFile, inp.__harnessFile.name); }
        });
      }
    }
  };
  for (const src of LIBS) w.eval(src);
  w.__mockCreateClient = makeClient;
  ADMIN = fs.readFileSync(`${ROOT}/assets/js/admin.js`, 'utf8');
  w.eval(ADMIN.replace(/^import \{ createClient \} from .*$/m, 'const createClient = window.__mockCreateClient;'));
  try {
    await waitFor(() => w.document.querySelector('[data-tab="products"]'), 'the products tab');
  } catch {
    throw new Error(w.document.body.textContent);
  }
  return { dom, w };
}

function setFile(w, input, name, type, bytes) {
  const file = new w.File([bytes], name, { type });
  input.__harnessFile = file; // FormData path
  Object.defineProperty(input, 'files', { value: { 0: file, length: 1, item: () => file, [Symbol.iterator]: [file][Symbol.iterator] }, configurable: true }); // change-event path
  input.dispatchEvent(new w.Event('change', { bubbles: true }));
}

(async () => {
  const { w } = await boot();

  /* ---------- dashboard + tab ---------- */
  ok(w.document.body.textContent.includes('OMP Control Center'), 'admin dashboard renders');
  const tabBtn = w.document.querySelector('[data-tab="products"]');
  ok(!!tabBtn, 'Products tab exists on the dashboard');
  tabBtn.click();
  const panel = await waitFor(
    () => {
      const el = w.document.querySelector('#panel');
      return el && el.querySelectorAll('.admin-row').length === 2 ? el : null;
    },
    'the products panel with 2 rows');
  ok(panel.textContent.includes('Products'), 'Products section loads');
  ok(panel.textContent.includes('private'), 'products tab explains the private-bucket flow');
  ok(panel.querySelectorAll('.admin-row').length === 2, 'two product rows listed');
  ok(panel.textContent.includes('29.99 USD'), 'published price shown');
  ok(panel.textContent.includes('🔒 file'), 'private deliverable flagged with lock (path NOT printed)');
  ok(!panel.innerHTML.includes('product-files/audit/pack.zip'), 'raw storage path never displayed');

  /* ---------- quick actions ---------- */
  const publishBtn = w.document.querySelector('[data-publish-product="p2"]');
  publishBtn.click(); // draft -> published
  await waitFor(() => calls.updates.some(u => u.table === 'products' && u.set.published_at), 'the publish write');
  await waitReplaced(publishBtn, 'publish');
  ok(calls.updates.some(u => u.table === 'products' && u.set.status === 'published' && u.set.published_at),
     'publish quick-action sets status=published + published_at');
  const featureBtn = w.document.querySelector('[data-feature-product="p2"]');
  featureBtn.click();
  await waitFor(() => calls.updates.some(u => u.table === 'products' && u.set.featured === true), 'the featured write');
  await waitReplaced(featureBtn, 'feature');
  ok(calls.updates.some(u => u.table === 'products' && u.set.featured === true), 'feature quick-action sets featured=true');
  ok(!calls.updates.some(u => u.table === 'products' && u.set.featured === true && u.set.status), 'feature toggle patches only the featured flag');
  w.confirm = () => true;
  const deleteBtn = w.document.querySelector('[data-delete-product="p1"]');
  deleteBtn.click();
  await waitFor(() => calls.deletes.some(d => d.table === 'products'), 'the delete');
  await waitReplaced(deleteBtn, 'delete');
  ok(calls.deletes.some(d => d.table === 'products'), 'delete quick-action deletes the row');

  /* ---------- edit form population ---------- */
  w.document.querySelector('[data-edit-product="p1"]').click();
  /* #product-editor already exists as an empty container from the tab render,
     so waiting for it proves nothing. productForm() creates #product-form
     inside it once the async row fetch resolves, so wait for that instead. */
  const form = await waitFor(() => w.document.querySelector('#product-form'), 'the product form');
  const editor = w.document.querySelector('#product-editor');
  ok(!!form, 'edit click opens the product form');
  ok(form.parentElement === editor, 'the form renders inside the product editor container');
  ok(form.querySelector('[name="name"]').value === 'The Passphrase Book', 'name populated');
  ok(form.querySelector('[name="slug"]').value === 'passphrase-book', 'slug populated');
  ok(form.querySelector('[name="product_type"]').value === 'book', 'type populated');
  ok(form.querySelector('[name="price"]').value === '29.99', 'price populated');
  ok(form.querySelector('[name="featured"]').checked === true, 'featured switch populated');
  ok(form.querySelector('[name="external_url"]').value === 'https://buy.example.com/book', 'purchase URL populated');
  ok(editor.textContent.includes('product-files/audit') === false, 'editor does not leak other rows');
  ok(form.querySelectorAll('[data-mk]').length >= 5, 'markdown toolbar present');
  ok(editor.querySelector('#product-preview') !== null, 'live preview present');

  /* ---------- cancel discards ---------- */
  editor.querySelector('#cancel-product').click();
  ok(!w.document.querySelector('#product-form'), 'cancel closes the editor');

  /* ---------- new product validation ---------- */
  w.document.querySelector('#new-product').click();
  const nf = await waitFor(() => w.document.querySelector('#product-form'), 'the new-product form');
  nf.querySelector('[name="name"]').value = 'New Toolkit!';
  nf.querySelector('[name="name"]').dispatchEvent(new w.Event('input', { bubbles: true }));
  ok(nf.querySelector('[name="slug"]').value === 'new-toolkit', 'slug auto-derives from title (slugify charset)');

  let submitN = 0;
  const submit = async () => {
    const f = w.document.querySelector('#product-form');
    if (!f) return '(form gone)';
    const myN = ++submitN;
    f.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    for (let i = 0; i < 80; i++) {
      await sleep(10);
      const btn2 = w.document.querySelector('#product-form button[type="submit"]');
      if (!btn2) break;                      // success re-rendered the panel
      if (!btn2.disabled && i > 3) break;    // validation flash already shown
    }
    await sleep(40);
    const band = w.document.querySelector('[data-flash]');
    return band ? band.textContent : '';
  };

  nf.querySelector('[name="external_url"]').value = 'javascript:alert(1)';
  let msg = await submit();
  ok(/Purchase URL must be/.test(msg), `javascript: purchase URL rejected (${msg || 'no flash'})`);
  ok(calls.inserts.length === 0, 'no insert happened for the rejected payload');

  nf.querySelector('[name="external_url"]').value = '';
  nf.querySelector('[name="price"]').value = '-5';
  msg = await submit();
  ok(/zero-or-positive/.test(msg), 'negative price rejected');
  nf.querySelector('[name="price"]').value = '10';
  nf.querySelector('[name="currency"]').value = 'dollar';
  msg = await submit();
  ok(/ISO 4217/.test(msg), 'invalid currency rejected');
  nf.querySelector('[name="currency"]').value = 'inr';
  nf.querySelector('[name="featured_image"]').value = 'javascript:alert(1)';
  msg = await submit();
  ok(/Cover image URL/.test(msg), 'javascript: cover URL rejected');

  /* valid payload with deliverable — upload happens during submit */
  nf.querySelector('[name="featured_image"]').value = '';
  nf.querySelector('[name="summary"]').value = 'A kit.';
  nf.querySelector('[name="description"]').value = '## Kit\n\nContents <b>here</b>.';
  nf.querySelector('[name="status"]').value = 'published';
  nf.querySelector('[name="cta_label"]').value = 'Grab It';
  const fileInput = nf.querySelector('[name="deliverable"]');
  setFile(w, fileInput, 'kit v1.pdf', 'application/pdf', new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37])); // %PDF-1.7
  msg = await submit();
  ok(calls.uploads.some(u => u.bucket === 'product-files'), 'deliverable uploaded to the PRIVATE bucket during submit');
  ok(!calls.publicUrls.some(u => u.bucket === 'product-files'), 'NO public URL ever derived for the private bucket');
  const ins = calls.inserts.filter(i => i.table === 'products').pop();
  ok(!!ins, `valid payload inserted (flash: "${msg}")`);
  if (ins) {
    const p = Array.isArray(ins.payload) ? ins.payload[0] : ins.payload;
    ok(p.slug === 'new-toolkit', 'payload slug is slugified');
    ok(p.price === 10 && p.currency === 'INR', 'price/currency normalized');
    ok(p.external_url === null, 'empty purchase URL stored as null');
    ok(/^product-files\//.test(p.file_path), 'deliverable path recorded (bucket-qualified)');
    ok(p.status === 'published' && p.published_at, 'published rows get published_at');
    ok(p.cta_label === 'Grab It', 'custom CTA saved');
  }

  /* ---------- cover upload → public bucket → fills URL ---------- */
  w.document.querySelector('#new-product').click();
  const nf2 = await waitFor(() => w.document.querySelector('#product-form'), 'the second new-product form');
  setFile(w, nf2.querySelector('#' + nf2.querySelector('input[type="file"][accept^="image"]').id), 'cover.png', 'image/png', new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]));
  await waitFor(() => calls.uploads.some(u => u.bucket === 'products'), 'the cover upload');
  ok(calls.uploads.some(u => u.bucket === 'products'), 'cover uploaded to the PUBLIC covers bucket');
  ok(calls.publicUrls.some(u => u.bucket === 'products'), 'cover gets a public URL');
  ok(/^https:\/\/pub\.example\.com\/products\/covers\//.test(nf2.querySelector('[name="featured_image"]').value), 'cover URL field auto-filled');

  /* ---------- filter box ---------- */
  const filterBox = w.document.querySelector('#product-filter');
  if (filterBox) {
    filterBox.value = 'checklist';
    filterBox.dispatchEvent(new w.Event('input', { bubbles: true }));
    ok(w.document.querySelectorAll('#product-list .admin-row').length === 1, 'filter narrows the product list');
  } else ok(false, 'filter input present');

  console.log(`\n${pass}/${pass + fail} admin products behavioral checks passed${fail ? `, ${fail} FAILURES` : ''}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS CRASH:', e); process.exit(2); });
