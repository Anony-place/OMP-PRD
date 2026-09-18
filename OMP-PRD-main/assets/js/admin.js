/* The SDK is loaded from esm.sh at runtime (the site ships no bundler and
   no third-party scripts on public pages). The version is PINNED: a
   floating "@2" means a new minor release — or a compromised publish —
   changes what the admin panel executes with no code review. Bump it
   deliberately, and keep every module on the same version
   (tools/test_runtime.js asserts they agree). */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.115.0';

if (typeof window.__adminBootOk === 'function') window.__adminBootOk();

const SUPABASE_URL = 'https://aeehfulikupskyrvcpzb.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_s3n2U32MNB4PvHx0GolyqA_wlkzD6eR';
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'omp-admin-auth' }
});
const root = document.querySelector('#admin-root');
let authUi = 'boot'; // 'boot' | 'login' | 'dashboard'

/* Row cap for the admin lists. Large enough for a realistic library,
   small enough that a tab switch stays instant and a runaway table
   cannot make the panel fetch thousands of rows. */
const ADMIN_ROW_LIMIT = 300;

const esc = (value = '') => String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const slugify = value => String(value || '').toLowerCase().trim().replace(/[^a-z0-9\s-]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');

/* Preview + saved article body go through exactly the same pipeline as
   /articles (assets/js/markdown.js → assets/js/sanitize.js), so what the
   author sees here is what readers get. Fail closed if either is missing. */
function renderBody(source) {
  if (window.OMPMarkdown?.renderSafe) return window.OMPMarkdown.renderSafe(source || '');
  if (window.OMPSanitize) return window.OMPSanitize(String(source || ''));
  return esc(source);
}

function shell(content) { if (typeof window.__adminBootOk === 'function') window.__adminBootOk(); root.innerHTML = `<div style="max-width:980px;margin:0 auto">${content}</div>`; }

function notice(message, tone = 'error') {
  if (!message) return '';
  return `<div class="notice-band" style="margin-top:14px"><p>${esc(message)}</p></div>`;
}

/* Small non-blocking status line; alert() was used for everything before and
   swallowed the actual Supabase error text on failures. */
function flash(host, message) {
  if (!host) return;
  let band = host.querySelector('[data-flash]');
  if (!message) { if (band) band.remove(); return; }
  if (!band) {
    band = document.createElement('div');
    band.setAttribute('data-flash', '');
    band.className = 'notice-band';
    band.style.marginTop = '14px';
    host.prepend(band);
  }
  band.innerHTML = `<p>${esc(message)}</p>`;
}

function loginView(message = '') {
  authUi = 'login';
  shell(`<div class="card card-pad" style="max-width:460px;margin:8vh auto 0">
    <div class="badge badge-demo">Private administration</div>
    <h1 class="h-2 mt-16">OopsMyPassword Admin</h1>
    <p class="muted" style="margin-top:8px">This area is not public. Sign in with an authorized Supabase Auth account.</p>
    ${message ? `<div class="notice-band mt-16"><p>${esc(message)}</p></div>` : ''}
    <form id="login-form" style="margin-top:24px">
      <div class="form-field"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="username" required></div>
      <div class="form-field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required></div>
      <button class="btn btn-primary" type="submit">Sign in</button>
    </form>
    <p class="tiny muted" style="margin-top:16px">There is no signup form here.</p>
  </div>`);
  document.querySelector('#login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const button = e.currentTarget.querySelector('button');
    button.disabled = true; button.textContent = 'Signing in…';
    const { error } = await supabase.auth.signInWithPassword({ email: document.querySelector('#email').value.trim(), password: document.querySelector('#password').value });
    if (error) loginView('Invalid credentials or unavailable account.');
    else scheduleRoute();
  });
}

async function checkAdmin() {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) return { state: 'db-error', message: userError.message };
  if (!user) return { state: 'anon' };
  const { data: profile, error } = await supabase.from('profiles').select('id,email,is_admin').eq('id', user.id).maybeSingle();
  if (error) return { state: 'db-error', message: error.message };
  if (!profile?.is_admin) return { state: 'forbidden' };
  return { state: 'admin', user };
}

let activeTab = 'articles';

function markActiveTab() {
  document.querySelectorAll('[data-tab]').forEach(btn => {
    const on = btn.dataset.tab === activeTab;
    btn.classList.toggle('btn-primary', on);
    btn.classList.toggle('btn-secondary', !on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

async function dashboard() {
  authUi = 'dashboard';
  shell(`<div class="card card-pad">
    <div class="flex justify-between items-center wrap gap-12"><div><div class="badge badge-demo">Private admin</div><h1 class="h-2 mt-16">OMP Control Center</h1><p class="muted" style="margin-top:6px">Supabase-backed content management.</p></div><button id="logout" class="btn btn-ghost">Sign out</button></div>
    <div class="admin-actions" style="margin-top:28px" role="group" aria-label="Admin sections"><button class="btn btn-secondary" type="button" data-tab="articles">Articles</button><button class="btn btn-secondary" type="button" data-tab="tools">Tools</button><button class="btn btn-secondary" type="button" data-tab="products">Products</button><button class="btn btn-secondary" type="button" data-tab="messages">Messages</button></div>
    <section id="panel" style="margin-top:24px" aria-live="polite"></section>
  </div>`);
  document.querySelector('#logout').onclick = async () => { await supabase.auth.signOut(); loginView(); };
  document.querySelectorAll('[data-tab]').forEach(btn => btn.onclick = () => loadTab(btn.dataset.tab));
  markActiveTab();
  await loadTab(activeTab);
}

/* Concurrent loadTab() calls used to race: the slower query could paint over
   the newer tab. A monotonic token makes stale renders no-ops. */
let tabToken = 0;

async function loadTab(tab) {
  activeTab = tab;
  markActiveTab();
  const mine = ++tabToken;
  const panel = document.querySelector('#panel');
  if (!panel) return;
  const stale = () => mine !== tabToken || !document.body.contains(panel);

  if (tab === 'articles') {
    const [{ data: articles, error }, { data: categories }] = await Promise.all([
      /* Bounded: the filter box searches what is loaded, so an unbounded
         table would download every article on every tab switch. */
      supabase.from('articles').select('id,title,slug,status,published_at,updated_at,category_id,document_url').order('updated_at',{ascending:false}).limit(ADMIN_ROW_LIMIT),
      supabase.from('article_categories').select('id,name,slug').order('name')
    ]);
    if (stale()) return;
    if (error) return panel.innerHTML = notice(error.message);
    const rows = articles || [];
    panel.innerHTML = `<div class="flex justify-between items-center wrap gap-12"><h2 class="h-3">Articles</h2><button id="new-article" type="button" class="btn btn-primary btn-sm">+ New article</button></div>
      <div class="form-field" style="margin-top:14px;max-width:380px"><label for="article-filter">Filter</label><input id="article-filter" type="search" placeholder="Search title, slug or status…" autocomplete="off"></div>
      <div id="article-editor"></div>
      <div class="admin-list" id="article-list" style="margin-top:18px"></div>`;
    const editor = document.querySelector('#article-editor');
    const listEl = document.querySelector('#article-list');
    const paintList = filter => {
      const q = String(filter || '').trim().toLowerCase();
      const shown = q ? rows.filter(a => [a.title, a.slug, a.status].some(v => String(v || '').toLowerCase().includes(q))) : rows;
      listEl.innerHTML = shown.map(a => `<div class="admin-row"><div class="grow"><div class="ttl">${esc(a.title)}</div><div class="meta">/${esc(a.slug)} · ${esc(a.status)}${a.document_url ? ' · 📄 doc' : ''}</div></div><div class="row-btns"><button type="button" class="btn btn-secondary btn-sm" data-edit-article="${esc(a.id)}">Edit</button><button type="button" class="btn btn-ghost btn-sm" data-delete-article="${esc(a.id)}" style="color:var(--red)">Delete</button></div></div>`).join('')
        || `<div class="admin-empty"><p class="muted">${rows.length ? 'No articles match that filter.' : 'No articles yet.'}</p></div>`;
      listEl.querySelectorAll('[data-edit-article]').forEach(btn => btn.onclick = async () => {
        btn.disabled = true;
        const { data, error: e2 } = await supabase.from('articles').select('*').eq('id',btn.dataset.editArticle).single();
        /* Always re-enable: the editor renders into a different container,
           so leaving the button disabled until the next list repaint meant
           a cancelled edit left a dead "Edit" button on screen. */
        btn.disabled = false;
        if (e2 || !data) return flash(panel, e2 ? e2.message : 'That article could not be loaded.');
        articleForm(editor, categories || [], data);
        editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      listEl.querySelectorAll('[data-delete-article]').forEach(btn => btn.onclick = async () => {
        if (!confirm('Delete this article permanently?')) return;
        btn.disabled = true;
        /* Read the row first: the attached document has to be removed from
           Storage too, or deleting an article leaks its file forever. */
        const { data: row } = await supabase.from('articles').select('id,slug,document_url').eq('id', btn.dataset.deleteArticle).maybeSingle();
        const { error: e2 } = await supabase.from('articles').delete().eq('id',btn.dataset.deleteArticle);
        if (e2) { btn.disabled = false; return flash(panel, `Delete failed: ${e2.message}`); }
        await removeStorageObjects([bucketPathFromUrl(row && row.document_url)]);
        loadTab('articles');
      });
    };
    paintList('');
    document.querySelector('#article-filter').addEventListener('input', e => paintList(e.target.value));
    document.querySelector('#new-article').onclick = () => { articleForm(editor, categories || [], null); editor.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  } else if (tab === 'tools') {
    const [{ data: tools, error }, { data: categories }] = await Promise.all([
      supabase.from('tools').select('id,name,slug,route,is_active,sort_order,category_id').order('sort_order').order('name'),
      supabase.from('tool_categories').select('id,name,slug').order('sort_order').order('name')
    ]);
    if (stale()) return;
    if (error) return panel.innerHTML = notice(error.message);
    panel.innerHTML = `<div class="flex justify-between items-center wrap gap-12"><h2 class="h-3">Tools Registry</h2><button id="new-tool" type="button" class="btn btn-primary btn-sm">+ New tool</button></div><p class="tiny muted" style="margin-top:6px">Registry metadata is dynamic; the actual tool route/code still has to exist. Routes must stay on this site — the public search rejects anything else.</p><div id="tool-editor"></div><div class="admin-list" style="margin-top:18px">${(tools||[]).map(t => `<div class="admin-row"><div class="grow"><div class="ttl">${esc(t.name)}</div><div class="meta">/${esc(t.slug)} · ${esc(t.route || 'no route')} · ${t.is_active ? 'active':'disabled'}</div></div><div class="row-btns"><button type="button" class="btn btn-secondary btn-sm" data-edit-tool="${esc(t.id)}">Edit</button><button type="button" class="btn btn-ghost btn-sm" data-delete-tool="${esc(t.id)}" style="color:var(--red)">Delete</button></div></div>`).join('') || '<div class="admin-empty"><p class="muted">No tools yet.</p></div>'}</div>`;
    const editor = document.querySelector('#tool-editor');
    document.querySelector('#new-tool').onclick = () => toolForm(editor, categories || [], null);
    document.querySelectorAll('[data-edit-tool]').forEach(btn => btn.onclick = async () => {
      btn.disabled = true;
      const { data, error: e2 } = await supabase.from('tools').select('*').eq('id',btn.dataset.editTool).single();
      btn.disabled = false;
      if (e2 || !data) return flash(panel, e2 ? e2.message : 'That tool could not be loaded.');
      toolForm(editor, categories || [], data);
    });
    document.querySelectorAll('[data-delete-tool]').forEach(btn => btn.onclick = async () => {
      if (!confirm('Delete this tool registry entry?')) return;
      btn.disabled = true;
      const { error: e2 } = await supabase.from('tools').delete().eq('id',btn.dataset.deleteTool);
      if (e2) { btn.disabled = false; return flash(panel, `Delete failed: ${e2.message}`); }
      loadTab('tools');
    });
  } else if (tab === 'products') {
    const { data: products, error } = await supabase.from('products')
      .select('id,name,slug,product_type,status,featured,price,currency,external_url,file_path,updated_at')
      .order('updated_at', { ascending: false });
    if (stale()) return;
    if (error) return panel.innerHTML = notice(error.message);
    const rows = products || [];
    const money = p => (p.price == null || p.price === '') ? '' : (Number(p.price) === 0 ? 'free' : `${Number(p.price)} ${p.currency || ''}`.trim());
    panel.innerHTML = `<div class="flex justify-between items-center wrap gap-12"><h2 class="h-3">Products</h2><button id="new-product" type="button" class="btn btn-primary btn-sm">+ New product</button></div>
      <p class="tiny muted" style="margin-top:6px">Commercial resources (books, courses, templates…) — kept separate from editorial articles. Paid deliverables upload to a <strong>private</strong> bucket and are never linked publicly; buyers get a signed download after purchase.</p>
      <div class="form-field" style="margin-top:14px;max-width:380px"><label for="product-filter">Filter</label><input id="product-filter" type="search" placeholder="Search name, slug, type or status…" autocomplete="off"></div>
      <div id="product-editor"></div>
      <div class="admin-list" id="product-list" style="margin-top:18px"></div>`;
    const editor = document.querySelector('#product-editor');
    const listEl = document.querySelector('#product-list');
    const paintList = filter => {
      const q = String(filter || '').trim().toLowerCase();
      const shown = q ? rows.filter(p => [p.name, p.slug, p.product_type, p.status].some(v => String(v || '').toLowerCase().includes(q))) : rows;
      listEl.innerHTML = shown.map(p => `<div class="admin-row">${safeHref(p.featured_image) ? `<img src="${esc(safeHref(p.featured_image))}" alt="" width="48" height="32" style="width:48px;height:32px;object-fit:cover;border-radius:6px;flex:none;background:var(--bg-soft)">` : ''}<div class="grow"><div class="ttl">${esc(p.name)} ${p.featured ? '<span class="ptype t-featured">★</span>' : ''}</div><div class="meta">/products/${esc(p.slug)} · ${esc(p.product_type)} · ${esc(p.status)}${money(p) ? ' · ' + esc(money(p)) : ''}${p.file_path ? ' · 🔒 file' : ''}${p.featured_image ? ' · 🖼 cover' : ''}</div></div><div class="row-btns"><button type="button" class="btn btn-secondary btn-sm" data-feature-product="${esc(p.id)}" data-on="${p.featured ? '1' : ''}">${p.featured ? 'Unfeature' : 'Feature'}</button><button type="button" class="btn btn-secondary btn-sm" data-publish-product="${esc(p.id)}" data-on="${p.status === 'published' ? '1' : ''}">${p.status === 'published' ? 'Unpublish' : 'Publish'}</button><button type="button" class="btn btn-secondary btn-sm" data-edit-product="${esc(p.id)}">Edit</button><button type="button" class="btn btn-ghost btn-sm" data-delete-product="${esc(p.id)}" style="color:var(--red)">Delete</button></div></div>`).join('')
        || `<div class="admin-empty"><p class="muted">${rows.length ? 'No products match that filter.' : 'No products yet — create the first one.'}</p></div>`;
      const patch = async (btn, id, set) => {
        btn.disabled = true;
        const { error: e2 } = await supabase.from('products').update(set).eq('id', id);
        if (e2) { btn.disabled = false; return flash(panel, `Update failed: ${e2.message}`); }
        loadTab('products');
      };
      listEl.querySelectorAll('[data-publish-product]').forEach(btn => btn.onclick = () => {
        const publish = btn.dataset.on !== '1';
        patch(btn, btn.dataset.publishProduct, publish ? { status: 'published', published_at: new Date().toISOString() } : { status: 'draft' });
      });
      listEl.querySelectorAll('[data-feature-product]').forEach(btn => btn.onclick = () => {
        patch(btn, btn.dataset.featureProduct, { featured: btn.dataset.on !== '1' });
      });
      listEl.querySelectorAll('[data-edit-product]').forEach(btn => btn.onclick = async () => {
        btn.disabled = true;
        const { data, error: e2 } = await supabase.from('products').select('*').eq('id', btn.dataset.editProduct).single();
        btn.disabled = false;
        if (e2 || !data) return flash(panel, e2 ? e2.message : 'That product could not be loaded.');
        productForm(editor, data);
        editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      listEl.querySelectorAll('[data-delete-product]').forEach(btn => btn.onclick = async () => {
        if (!confirm('Delete this product permanently?')) return;
        btn.disabled = true;
        const { data: row } = await supabase.from('products').select('id,slug,file_path,featured_image').eq('id', btn.dataset.deleteProduct).maybeSingle();
        const { error: e2 } = await supabase.from('products').delete().eq('id', btn.dataset.deleteProduct);
        if (e2) { btn.disabled = false; return flash(panel, `Delete failed: ${e2.message}`); }
        await removeStorageObjects([
          bucketPathFromFilePath(row && row.file_path),
          bucketPathFromUrl(row && row.featured_image)
        ]);
        loadTab('products');
      });
    };
    paintList('');
    document.querySelector('#product-filter').addEventListener('input', e => paintList(e.target.value));
    document.querySelector('#new-product').onclick = () => { productForm(editor, null); editor.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  } else {
    const { data: msgs, error } = await supabase.from('contact_messages').select('id,name,email,message,status,created_at').order('created_at',{ascending:false}).limit(200);
    if (stale()) return;
    if (error) return panel.innerHTML = notice(error.message);
    panel.innerHTML = `<div class="flex justify-between items-center wrap gap-12"><h2 class="h-3">Contact messages</h2><button id="refresh-messages" type="button" class="btn btn-secondary btn-sm">Refresh</button></div><div class="admin-list" style="margin-top:18px">${(msgs||[]).map(m => `<div class="admin-row" style="align-items:flex-start"><div class="grow"><div class="ttl">${esc(m.name)} <span class="tiny muted">&lt;${esc(m.email)}&gt;</span></div><div class="meta">${esc(new Date(m.created_at).toLocaleString())} · ${esc(m.status)}${m.status==='new' ? ' · NEW' : ''}</div><p style="margin-top:8px;white-space:pre-wrap;overflow-wrap:anywhere">${esc(m.message)}</p></div><div class="row-btns">${m.status==='new' ? `<button type="button" class="btn btn-secondary btn-sm" data-msg-read="${esc(m.id)}">Mark read</button>` : ''}${m.status!=='archived' ? `<button type="button" class="btn btn-ghost btn-sm" data-msg-archive="${esc(m.id)}">Archive</button>` : ''}<button type="button" class="btn btn-ghost btn-sm" data-msg-delete="${esc(m.id)}" style="color:var(--red)">Delete</button></div></div>`).join('') || '<div class="admin-empty"><p class="muted">No messages yet.</p></div>'}</div>`;
    const setStatus = async (btn, id, patch) => {
      btn.disabled = true;
      const { error: e2 } = await supabase.from('contact_messages').update(patch).eq('id', id);
      if (e2) { btn.disabled = false; return flash(panel, `Update failed: ${e2.message}`); }
      loadTab('messages');
    };
    document.querySelector('#refresh-messages').onclick = () => loadTab('messages');
    document.querySelectorAll('[data-msg-read]').forEach(btn => btn.onclick = () => setStatus(btn, btn.dataset.msgRead, { status: 'read' }));
    document.querySelectorAll('[data-msg-archive]').forEach(btn => btn.onclick = () => setStatus(btn, btn.dataset.msgArchive, { status: 'archived' }));
    document.querySelectorAll('[data-msg-delete]').forEach(btn => btn.onclick = async () => {
      if (!confirm('Delete this message permanently?')) return;
      btn.disabled = true;
      const { error: e2 } = await supabase.from('contact_messages').delete().eq('id',btn.dataset.msgDelete);
      if (e2) { btn.disabled = false; return flash(panel, `Delete failed: ${e2.message}`); }
      loadTab('messages');
    });
  }
}

/* ---------- Markdown toolbar ---------- */
const TOOLBAR = [
  { label: 'H2',   title: 'Section heading',      before: '\n## ',  after: '\n',   placeholder: 'Section' },
  { label: 'H3',   title: 'Sub-heading',          before: '\n### ', after: '\n',   placeholder: 'Sub-section' },
  { label: 'B',    title: 'Bold (Ctrl+B)',        before: '**',     after: '**',   placeholder: 'bold' },
  { label: 'I',    title: 'Italic (Ctrl+I)',      before: '*',      after: '*',    placeholder: 'italic' },
  { label: 'link', title: 'Link',                 before: '[',      after: '](https://)', placeholder: 'link text' },
  { label: '•',    title: 'Bulleted list',        before: '\n* ',   after: '\n',   placeholder: 'List item' },
  { label: '1.',   title: 'Numbered list',        before: '\n1. ',  after: '\n',   placeholder: 'First step' },
  { label: '> ',   title: 'Quote',                before: '\n> ',   after: '\n',   placeholder: 'Quoted text' },
  { label: '</>',  title: 'Code block',           before: '\n```\n', after: '\n```\n', placeholder: 'code' },
  { label: 'tbl',  title: 'Table',                before: '\n| Column | Column |\n| --- | --- |\n| ', after: ' |  |\n', placeholder: 'cell' },
  { label: '—',    title: 'Horizontal rule',      before: '\n\n---\n\n', after: '', placeholder: '' }
];

function applyMarkup(ta, rule) {
  const start = ta.selectionStart, end = ta.selectionEnd;
  const selected = ta.value.slice(start, end) || rule.placeholder || '';
  const next = ta.value.slice(0, start) + rule.before + selected + rule.after + ta.value.slice(end);
  ta.value = next;
  ta.focus();
  ta.selectionStart = start + rule.before.length;
  ta.selectionEnd = ta.selectionStart + selected.length;
  ta.dispatchEvent(new Event('input', { bubbles: true }));
}

/* Unsaved-changes tracking is PER FORM, not a single global flag. One
   shared flag meant opening a product form after touching an article
   inherited (and then cleared) the other form's dirty state — and a
   cancelled tool form left the beforeunload guard armed forever,
   because toolForm()'s Cancel never reset it. */
const dirtyForms = new Set();

function setDirty(form, on) {
  if (!form) return;
  if (on) dirtyForms.add(form); else dirtyForms.delete(form);
  const dot = form.querySelector('[data-unsaved]');
  if (dot) dot.hidden = !on;
}

function clearDirty(form) {
  if (!form) return;
  dirtyForms.delete(form);
  const dot = form.querySelector('[data-unsaved]');
  if (dot) dot.hidden = true;
}

function isDirty(form) {
  return !!form && dirtyForms.has(form);
}

/* Prune forms that were cancelled or replaced: a detached node must not
   keep blocking navigation. */
function hasUnsavedWork() {
  dirtyForms.forEach(f => { if (!document.body.contains(f)) dirtyForms.delete(f); });
  return dirtyForms.size > 0;
}

function clearAllDirty() {
  dirtyForms.clear();
}

/* Safe URL gate for anything that lands in an href/src attribute. Uses the
   same canonical validator as the public site (assets/js/url.js) so the
   admin panel and the public renderer can never disagree about what is
   safe to link to. */
function safeHref(value, opts) {
  const v = String(value == null ? '' : value).trim();
  if (!v) return '';
  if (window.OMPUrl && window.OMPUrl.safeUrl) {
    const safe = window.OMPUrl.safeUrl(v, opts || { attrSafe: true });
    return safe === null ? '' : safe;
  }
  return /^(https?:\/\/|\/|#)/i.test(v) ? v : '';
}

/* document_url is stored by this panel, but a row can also be edited
   outside it — so it is scheme-checked before it becomes an href here,
   exactly as /articles does before rendering the download button. */
function documentHref(value) {
  return safeHref(value, { attrSafe: true });
}

/* Best-effort Storage cleanup. Deleting a row used to orphan its object
   (article document, product deliverable, product cover), which is both a
   cost leak and stale-content risk. Removal never blocks the delete: a
   failed cleanup is logged, not thrown. */
const BUCKET_URL_RE = /\/storage\/v1\/object\/public\/([a-z0-9_-]+)\/(.+)$/i;

function bucketPathFromUrl(url) {
  const m = String(url || '').match(BUCKET_URL_RE);
  if (!m) return null;
  return { bucket: m[1], path: decodeURIComponent(m[2]) };
}

function bucketPathFromFilePath(filePath) {
  const raw = String(filePath || '').replace(/^\/+/, '');
  const slash = raw.indexOf('/');
  if (slash <= 0) return null;
  return { bucket: raw.slice(0, slash), path: raw.slice(slash + 1) };
}

async function removeStorageObjects(locations) {
  const targets = (locations || []).filter(Boolean);
  const byBucket = new Map();
  targets.forEach(t => {
    if (!byBucket.has(t.bucket)) byBucket.set(t.bucket, []);
    byBucket.get(t.bucket).push(t.path);
  });
  await Promise.all(Array.from(byBucket.entries()).map(async ([bucket, paths]) => {
    try {
      const { error } = await supabase.storage.from(bucket).remove(paths);
      if (error) console.warn(`storage cleanup failed (${bucket}):`, error.message);
    } catch (e) {
      console.warn(`storage cleanup threw (${bucket}):`, e && e.message);
    }
  }));
}

function articleForm(host, categories, article) {
  const a = article || {title:'',slug:'',summary:'',content:'',status:'draft',category_id:null,published_at:null,featured_image:'',document_url:''};
  const uid = article ? String(article.id).slice(0, 8) : 'new';
  const id = n => `af-${uid}-${n}`;
  host.innerHTML = `<form id="article-form" class="card card-pad" style="margin-top:18px">
    <div class="preview-head">
      <h3 class="h-3">${article ? 'Edit article' : 'New article'} <span class="unsaved-dot" data-unsaved title="Unsaved changes" hidden></span></h3>
      <span class="tiny muted">Body accepts <strong>Markdown</strong> or HTML</span>
    </div>
    <div class="editor-row-2" style="margin-top:16px">
      <div class="form-field"><label for="${id('title')}">Title</label><input id="${id('title')}" name="title" required value="${esc(a.title)}"></div>
      <div class="form-field"><label for="${id('slug')}">Slug</label><input id="${id('slug')}" name="slug" required value="${esc(a.slug)}" placeholder="auto-from-title"></div>
    </div>
    <div class="form-field"><label for="${id('summary')}">Summary</label><textarea id="${id('summary')}" name="summary" rows="3" placeholder="One or two sentences shown on the article list. Left blank, an excerpt is generated from the body.">${esc(a.summary)}</textarea></div>
    <div class="editor-row-3">
      <div class="form-field"><label for="${id('category')}">Category</label><select id="${id('category')}" name="category_id"><option value="">None</option>${categories.map(c=>`<option value="${esc(c.id)}" ${c.id===a.category_id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div>
      <div class="form-field"><label for="${id('status')}">Status</label><select id="${id('status')}" name="status"><option value="draft" ${a.status==='draft'?'selected':''}>Draft</option><option value="published" ${a.status==='published'?'selected':''}>Published</option><option value="archived" ${a.status==='archived'?'selected':''}>Archived</option></select></div>
      <div class="form-field"><label for="${id('image')}">Featured image URL</label><input id="${id('image')}" name="featured_image" value="${esc(a.featured_image || '')}" placeholder="https://…"></div>
    </div>
    <div class="form-field">
      <label for="${id('doc')}">Attach document (PDF / DOC / DOCX / MD / TXT — max 25 MB)</label>
      <input id="${id('doc')}" name="document" type="file" accept=".pdf,.doc,.docx,.md,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/markdown,text/plain" style="padding:10px">
      <p id="${id('pdf-status')}" class="tiny muted" style="margin-top:6px" aria-live="polite"></p>
      ${documentHref(a.document_url) ? `<p class="tiny" style="margin-top:6px">Attached: <a href="${esc(documentHref(a.document_url))}" target="_blank" rel="noopener noreferrer">view current document</a> &nbsp;<label style="display:inline-flex;gap:6px;align-items:center"><input type="checkbox" name="remove_document"> remove attachment</label></p>`
        : (a.document_url ? `<p class="tiny" style="margin-top:6px;color:var(--red)">This article has an attachment with an unsafe URL (${esc(a.document_url)}). It is not shown to readers — save with “remove attachment” to clear it.</p><label style="display:inline-flex;gap:6px;align-items:center"><input type="checkbox" name="remove_document"> remove attachment</label>` : '<p class="tiny muted" style="margin-top:6px">Optional — readers get a “Download document” button on the article page.</p>')}
    </div>
    <div class="editor-grid" style="margin-top:8px">
      <div class="editor-fields">
        <label for="${id('content')}">Content</label>
        <div class="toolbar" role="toolbar" aria-label="Formatting" aria-controls="${id('content')}">${TOOLBAR.map((t,i)=>`<button type="button" data-mk="${i}" title="${esc(t.title)}" aria-label="${esc(t.title)}">${esc(t.label)}</button>`).join('')}</div>
        <textarea id="${id('content')}" name="content" class="body-editor" rows="18" spellcheck="true" aria-describedby="${id('hint')}">${esc(a.content)}</textarea>
        <p class="tiny muted" id="${id('hint')}">Write Markdown (<code>## heading</code>, <code>**bold**</code>, <code>* item</code>, <code>| table |</code>, fenced code) — existing HTML bodies are detected and kept as-is. Everything is re-sanitized before it reaches readers.</p>
      </div>
      <div>
        <div class="preview-head"><span class="tiny muted"><strong>Live preview</strong> — exactly what /articles renders</span><button type="button" class="btn btn-ghost btn-sm" id="refresh-preview">Refresh</button></div>
        <div class="preview-frame" style="padding:20px;overflow:auto"><div class="prose" id="article-preview" style="max-width:none"></div></div>
      </div>
    </div>
    <div class="flex gap-8" style="margin-top:18px"><button class="btn btn-primary" type="submit">Save article</button><button class="btn btn-ghost" type="button" id="cancel-editor">Cancel</button></div>
  </form>`;

  const form = document.querySelector('#article-form');
  const ta = document.querySelector(`#${id('content')}`);
  const titleInput = document.querySelector(`#${id('title')}`);
  const slugInput = document.querySelector(`#${id('slug')}`);
  const preview = document.querySelector('#article-preview');
  const docInput = document.querySelector(`#${id('doc')}`);
  const pdfStatus = document.querySelector(`#${id('pdf-status')}`);

  /* PDF upload is a content import, not merely a file attachment.
     Extract selectable PDF text in the browser and put it directly into the
     article body so authors do not have to manually copy/paste a document.
     PDF.js is pinned; workerless extraction keeps this standalone admin
     panel free of a separate worker asset. */
  async function extractPdfText(file) {
    const pdfjs = await import('https://esm.sh/pdfjs-dist@5.4.624/legacy/build/pdf.mjs');
    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjs.getDocument({ data, disableWorker: true }).promise;
    const pages = [];
    try {
      for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
        const page = await pdf.getPage(pageNo);
        const content = await page.getTextContent();
        const lines = [];
        let line = [];
        let lastY = null;
        for (const item of content.items || []) {
          const text = String(item.str || '');
          if (!text) continue;
          const y = Array.isArray(item.transform) ? item.transform[5] : null;
          if (lastY !== null && y !== null && Math.abs(y - lastY) > 3 && line.length) {
            lines.push(line.join(' ').replace(/\s+/g, ' ').trim());
            line = [];
          }
          line.push(text);
          if (y !== null) lastY = y;
        }
        if (line.length) lines.push(line.join(' ').replace(/\s+/g, ' ').trim());
        const pageText = lines.filter(Boolean).join('\n').trim();
        if (pageText) pages.push(pageText);
      }
    } finally {
      try { await pdf.destroy(); } catch {}
    }
    return pages.join('\n\n').trim();
  }

  const setPdfStatus = (message, tone = 'muted') => {
    if (!pdfStatus) return;
    pdfStatus.textContent = message;
    pdfStatus.style.color = tone === 'error' ? 'var(--red)' : '';
  };

  const importPdfContent = async file => {
    if (!file || !file.size || !/\.pdf$/i.test(file.name)) return;
    setPdfStatus('Reading PDF content…');
    try {
      const text = await extractPdfText(file);
      if (!text) {
        setPdfStatus('PDF uploaded, but no selectable text was found. This may be a scanned/image-only PDF; enter the article content manually or add OCR.', 'error');
        return;
      }
      ta.value = text;
      setDirty(form, true);
      queuePreview();
      setPdfStatus(`Imported ${text.length.toLocaleString()} characters from the PDF into Content. You can edit it before saving.`);
    } catch (err) {
      console.error('PDF text extraction failed:', err);
      setPdfStatus(`Could not extract PDF text automatically: ${err?.message || String(err)}. The PDF can still be attached; enter Content manually.`, 'error');
    }
  };

  const paintPreview = () => {
    const title = titleInput.value.trim();
    preview.innerHTML = (title ? `<h1 class="h-1" style="font-size:1.7rem">${esc(title)}</h1>` : '') + renderBody(ta.value);
    /* Mirror /articles exactly: the title is the only <h1>, so a "#" heading
       in the body is demoted to <h2> here too. */
    if (window.OMPMarkdown?.demoteHeadings) window.OMPMarkdown.demoteHeadings(preview, 1);
    if (!title && !ta.value.trim()) preview.innerHTML = '<p class="muted">Nothing to preview yet.</p>';
  };
  paintPreview();

  let previewTimer = null;
  const queuePreview = () => { clearTimeout(previewTimer); previewTimer = setTimeout(paintPreview, 180); };
  ta.addEventListener('input', () => { setDirty(form, true); queuePreview(); });
  form.querySelectorAll('input, textarea, select').forEach(el => el.addEventListener('change', () => setDirty(form, true)));
  document.querySelector('#refresh-preview').onclick = paintPreview;

  /* Slug follows the title until the author edits it themselves. */
  let slugTouched = !!(article && article.slug);
  slugInput.addEventListener('input', () => { slugTouched = true; });
  titleInput.addEventListener('input', () => {
    setDirty(form, true);
    if (!slugTouched) slugInput.value = slugify(titleInput.value);
    queuePreview();
  });

  form.querySelectorAll('[data-mk]').forEach(btn => btn.onclick = () => applyMarkup(ta, TOOLBAR[Number(btn.dataset.mk)]));
  docInput.addEventListener('change', async e => {
    const file = e.currentTarget.files?.[0];
    if (!file) { setPdfStatus(''); return; }
    if (/\.pdf$/i.test(file.name)) await importPdfContent(file);
    else setPdfStatus('Document attached. Automatic body import is available for PDF files; DOC/DOCX/MD/TXT can still be attached normally.');
  });
  ta.addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === 'b') { e.preventDefault(); applyMarkup(ta, TOOLBAR.find(r => r.label === 'B')); }
    else if (k === 'i') { e.preventDefault(); applyMarkup(ta, TOOLBAR.find(r => r.label === 'I')); }
  });

  const cancel = () => {
    if (isDirty(form) && !confirm('Discard unsaved changes to this article?')) return;
    dirtyForms.delete(form);
    host.innerHTML = '';
  };
  document.querySelector('#cancel-editor').onclick = cancel;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    const f = new FormData(e.currentTarget);
    const status = f.get('status');
    const file = f.get('document');
    let document_url = a.document_url || null;
    if (f.get('remove_document') === 'on') document_url = null;
    submitBtn.disabled = true; submitBtn.textContent = 'Saving…';
    try {
      /* Upload first, but do not create bookkeeping rows until the article
         itself has been persisted. If the DB write fails, immediately remove
         the newly uploaded object so a failed save can never leave an orphan. */
      let uploadedDocumentPath = null;
      let uploadedDocumentMeta = null;
      if (file && file.size) {
        /* Preflight the file before anything leaves the device: magic-byte
           signature must match the declared extension, and the exact
           Content-Type is forced on upload so the object can never be
           sniffed as text/html. Server-side Storage policies remain the
           authoritative gate. */
        const v = window.OMPFileValidate
          ? await window.OMPFileValidate.validateFile(file)
          : (() => {
              const okTypes = ['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/markdown','text/plain'];
              const ext = (String(file.name).split('.').pop() || '').toLowerCase();
              if (!okTypes.includes(file.type) && !['pdf','doc','docx','md','txt'].includes(ext)) throw new Error(`Unsupported file type: ${file.type || file.name}. Allowed: PDF, DOC, DOCX, MD, TXT.`);
              if (file.size > 25 * 1024 * 1024) throw new Error('File is larger than the 25 MB limit.');
              return { ok: true, contentType: null };
            })();
        if (!v || !v.ok) throw new Error((v && v.error) || 'File validation failed.');
        const safeName = String(file.name).replace(/[^a-zA-Z0-9._-]/g, '_');
        uploadedDocumentPath = `${Date.now()}-${safeName}`;
        const { error: upErr } = await supabase.storage.from('articles').upload(uploadedDocumentPath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: v.contentType || undefined
        });
        if (upErr) {
          uploadedDocumentPath = null;
          throw new Error(`Upload failed: ${upErr.message}`);
        }
        const { data: pub } = supabase.storage.from('articles').getPublicUrl(uploadedDocumentPath);
        if (!pub?.publicUrl) {
          await removeStorageObjects([bucketPathFromUrl(`${SUPABASE_URL}/storage/v1/object/public/articles/${uploadedDocumentPath}`)]).catch(() => {});
          uploadedDocumentPath = null;
          throw new Error('Upload succeeded but Supabase did not return a public URL.');
        }
        document_url = pub.publicUrl;
        uploadedDocumentMeta = {
          file_path: `articles/${uploadedDocumentPath}`,
          public_url: document_url,
          mime_type: v.contentType || file.type || null,
          size_bytes: file.size
        };
      }
      const slug = slugify(f.get('slug')) || slugify(f.get('title'));
      if (!slug) throw new Error('A slug is required — add a title or type one in.');
      /* Replacing the attachment orphans the previous object. Remove it
         only after the new upload succeeded and the row is about to be
         written — a half-applied delete would lose both files. */
      const oldDoc = a.document_url && document_url !== a.document_url ? bucketPathFromUrl(a.document_url) : null;
      /* featured_image lands in an <img src=…> on /articles, so reject a
         javascript: / data:text/html value at the point of entry rather than
         relying only on the renderer's scheme gate. */
      const featuredRaw = String(f.get('featured_image') || '').trim();
      const featured = featuredRaw
        ? (window.OMPUrl ? window.OMPUrl.safeUrl(featuredRaw, { allowDataImage: true }) : (() => { const m = featuredRaw.match(/^(https?:|\/|#|data:image\/[a-z]+;base64,)/i); return m ? featuredRaw : null; })())
        : null;
      if (featured === null && featuredRaw) throw new Error('Featured image URL must be an http(s), site-relative or raster data: image.');
      /* updated_at is set explicitly: the table has no UPDATE trigger, so
         without this the admin list's "sort by updated_at" silently
         degrades to creation order and never reflects edits. */
      const content = String(f.get('content') || '').trim();
      if (!content) {
        throw new Error(file && file.size
          ? 'PDF/document attached, but no article text was extracted. If this is a scanned/image-only PDF, enter the article content manually.'
          : 'Article content is required.');
      }
      const payload = {title:f.get('title').trim(),slug,summary:f.get('summary'),content,category_id:f.get('category_id')||null,status,featured_image:featured,document_url,updated_at:new Date().toISOString(),published_at:status==='published'?(a.published_at||new Date().toISOString()):null};
      const result = article ? await supabase.from('articles').update(payload).eq('id',article.id) : await supabase.from('articles').insert(payload);
      if (result.error) {
        if (uploadedDocumentPath) {
          await removeStorageObjects([{
            bucket: 'articles',
            path: uploadedDocumentPath
          }]);
        }
        throw result.error;
      }

      /* Bookkeeping is intentionally after the article write. A media-row
         failure must not make a successful article save look failed. */
      if (uploadedDocumentMeta) {
        const { data: { user } } = await supabase.auth.getUser();
        const { error: mediaErr } = await supabase.from('media').insert({
          ...uploadedDocumentMeta,
          uploaded_by: user?.id || null
        });
        if (mediaErr) console.warn('media row not recorded:', mediaErr.message);
      }

      await removeStorageObjects([oldDoc]);
      clearDirty(form);
      loadTab('articles');
    } catch (err) {
      submitBtn.disabled = false; submitBtn.textContent = 'Save article';
      flash(form, err?.message || String(err));
    }
  });
}

/* Commercial resources — separate from articles by design. Paid
   deliverables go to the PRIVATE product-files bucket (never linked
   publicly); covers go to the public products bucket. */
const PRODUCT_TYPES = [
  { value: 'book',     label: 'Book' },
  { value: 'course',   label: 'Course' },
  { value: 'tool',     label: 'Tool' },
  { value: 'template', label: 'Template' },
  { value: 'resource', label: 'Resource' },
  { value: 'other',    label: 'Other' }
];

function productForm(host, product) {
  const p = product || {name:'',slug:'',summary:'',description:'',product_type:'other',price:null,currency:'USD',cta_label:'',featured:false,status:'draft',featured_image:'',external_url:'',file_path:''};
  const uid = product ? String(product.id).slice(0, 8) : 'new';
  const id = n => `pf-${uid}-${n}`;
  host.innerHTML = `<form id="product-form" class="card card-pad" style="margin-top:18px">
    <div class="preview-head">
      <h3 class="h-3">${product ? 'Edit product' : 'New product'} <span class="unsaved-dot" data-unsaved title="Unsaved changes" hidden></span></h3>
      <span class="tiny muted">Full description accepts <strong>Markdown</strong> or HTML</span>
    </div>
    <div class="editor-row-2" style="margin-top:16px">
      <div class="form-field"><label for="${id('name')}">Title</label><input id="${id('name')}" name="name" required value="${esc(p.name)}"></div>
      <div class="form-field"><label for="${id('slug')}">Slug (public URL: /products/&lt;slug&gt;)</label><input id="${id('slug')}" name="slug" required value="${esc(p.slug)}" placeholder="auto-from-title"></div>
    </div>
    <div class="editor-row-3" style="margin-top:4px">
      <div class="form-field"><label for="${id('type')}">Product type</label><select id="${id('type')}" name="product_type">${PRODUCT_TYPES.map(t=>`<option value="${t.value}" ${p.product_type===t.value?'selected':''}>${t.label}</option>`).join('')}</select></div>
      <div class="form-field"><label for="${id('status')}">Status</label><select id="${id('status')}" name="status"><option value="draft" ${p.status==='draft'?'selected':''}>Draft</option><option value="published" ${p.status==='published'?'selected':''}>Published</option><option value="archived" ${p.status==='archived'?'selected':''}>Archived</option></select></div>
      <div class="form-field"><label for="${id('cta')}">CTA label</label><input id="${id('cta')}" name="cta_label" maxlength="40" value="${esc(p.cta_label || '')}" placeholder="Buy Now / Learn More / Get It (defaults by type)"></div>
    </div>
    <div class="editor-row-3" style="margin-top:4px">
      <div class="form-field"><label for="${id('price')}">Price</label><input id="${id('price')}" name="price" type="number" min="0" step="0.01" value="${p.price == null ? '' : esc(p.price)}" placeholder="empty = not shown · 0 = free"></div>
      <div class="form-field"><label for="${id('currency')}">Currency (ISO 4217)</label><input id="${id('currency')}" name="currency" maxlength="3" value="${esc(p.currency || 'USD')}" placeholder="USD"></div>
      <div class="form-field"><label for="${id('url')}">Purchase URL</label><input id="${id('url')}" name="external_url" type="url" inputmode="url" value="${esc(p.external_url || '')}" placeholder="https://… (external checkout / landing page)"></div>
    </div>
    <div class="opt-row" style="margin-top:12px"><div><div class="opt-name">Featured</div><div class="opt-desc">Pin this product to the Featured row on /products.</div></div><span class="switch"><input name="featured" type="checkbox" aria-label="Featured" ${p.featured?'checked':''}><span class="track"></span></span></div>
    <div class="form-field" style="margin-top:12px"><label for="${id('summary')}">Short description (cards + search)</label><textarea id="${id('summary')}" name="summary" rows="2" maxlength="300">${esc(p.summary || '')}</textarea></div>
    <div class="editor-row-2" style="margin-top:4px">
      <div class="form-field">
        <label for="${id('cover')}">Cover image URL</label>
        <input id="${id('cover')}" name="featured_image" value="${esc(p.featured_image || '')}" placeholder="https://… or upload below">
        <input id="${id('cover-file')}" type="file" accept="image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif" style="margin-top:8px;padding:8px" aria-label="Upload cover image">
        <div id="${id('cover-preview')}" class="product-cover" style="max-width:280px;margin-top:10px;border-radius:var(--radius);overflow:hidden" hidden></div>
        <p class="tiny muted" style="margin-top:6px">PNG/JPG/WebP/GIF up to 5 MB — uploaded to the public <code>products</code> covers bucket. The preview below is what /products shows.</p>
      </div>
      <div class="form-field">
        <label for="${id('file')}">Deliverable file (paid PDF / DOC / DOCX / MD / TXT — max 25 MB)</label>
        <input id="${id('file')}" name="deliverable" type="file" accept=".pdf,.doc,.docx,.md,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/markdown,text/plain" style="padding:10px">
        ${p.file_path ? `<p class="tiny" style="margin-top:6px">🔒 Stored privately at <code>${esc(p.file_path)}</code> &nbsp;<label style="display:inline-flex;gap:6px;align-items:center"><input type="checkbox" name="remove_file"> remove file</label></p>` : '<p class="tiny muted" style="margin-top:6px">Optional — stored in the <strong>private</strong> <code>product-files</code> bucket. Never publicly linked: buyers receive a short-lived signed download URL from the purchase flow.</p>'}
      </div>
    </div>
    <div class="editor-grid" style="margin-top:8px">
      <div class="editor-fields">
        <label for="${id('content')}">Full description</label>
        <div class="toolbar" role="toolbar" aria-label="Formatting" aria-controls="${id('content')}">${TOOLBAR.map((t,i)=>`<button type="button" data-mk="${i}" title="${esc(t.title)}" aria-label="${esc(t.title)}">${esc(t.label)}</button>`).join('')}</div>
        <textarea id="${id('content')}" name="description" class="body-editor" rows="14" spellcheck="true">${esc(p.description)}</textarea>
      </div>
      <div>
        <div class="preview-head"><span class="tiny muted"><strong>Live preview</strong> — exactly what /products renders</span><button type="button" class="btn btn-ghost btn-sm" id="refresh-product-preview">Refresh</button></div>
        <div class="preview-frame" style="padding:20px;overflow:auto"><div class="prose" id="product-preview" style="max-width:none"></div></div>
      </div>
    </div>
    <div class="flex gap-8" style="margin-top:18px"><button class="btn btn-primary" type="submit">${product ? 'Save product' : 'Create product'}</button><button class="btn btn-ghost" type="button" id="cancel-product">Cancel</button></div>
  </form>`;

  const form = document.querySelector('#product-form');
  const ta = document.querySelector(`#${id('content')}`);
  const nameInput = document.querySelector(`#${id('name')}`);
  const slugInput = document.querySelector(`#${id('slug')}`);
  const coverInput = document.querySelector(`#${id('cover')}`);
  const coverPreview = document.querySelector(`#${id('cover-preview')}`);
  const preview = document.querySelector('#product-preview');

  /* Deliberately does NOT allow data: images. The save path rejects them
     (and the public /products page only renders http(s) or bucket-path
     covers), so previewing one here would show an image that can never
     be published. */
  const coverSrc = (raw) => {
    const v = String(raw || '').trim();
    if (!v) return '';
    if (window.OMPUrl?.safeUrl) return window.OMPUrl.safeUrl(v, { attrSafe: true }) || '';
    return /^(https?:|\/)/i.test(v) ? v : '';
  };

  const paintCover = () => {
    const src = coverSrc(coverInput.value);
    if (!src) { coverPreview.hidden = true; coverPreview.replaceChildren(); return; }
    coverPreview.hidden = false;
    coverPreview.innerHTML = `<img src="${esc(src)}" alt="Cover preview" style="width:100%;height:100%;object-fit:cover">`;
  };

  const paintPreview = () => {
    const name = nameInput.value.trim();
    const src = coverSrc(coverInput.value);
    const coverHtml = src ? `<img src="${esc(src)}" alt="" style="width:100%;max-height:220px;object-fit:cover;border-radius:var(--radius);margin-bottom:14px">` : '';
    preview.innerHTML = coverHtml + (name ? `<h1 class="h-1" style="font-size:1.7rem">${esc(name)}</h1>` : '') + renderBody(ta.value);
    if (window.OMPMarkdown?.demoteHeadings) window.OMPMarkdown.demoteHeadings(preview, 1);
    if (!name && !ta.value.trim() && !src) preview.innerHTML = '<p class="muted">Nothing to preview yet.</p>';
  };
  paintCover();
  paintPreview();
  let previewTimer = null;
  const queuePreview = () => { clearTimeout(previewTimer); previewTimer = setTimeout(paintPreview, 180); };
  ta.addEventListener('input', () => { setDirty(form, true); queuePreview(); });
  coverInput.addEventListener('input', () => { setDirty(form, true); paintCover(); queuePreview(); });
  form.querySelectorAll('input, textarea, select').forEach(el => el.addEventListener('change', () => setDirty(form, true)));
  document.querySelector('#refresh-product-preview').onclick = paintPreview;

  /* Slug follows the title until the author edits it themselves. */
  let slugTouched = !!(product && product.slug);
  slugInput.addEventListener('input', () => { slugTouched = true; });
  nameInput.addEventListener('input', () => {
    setDirty(form, true);
    if (!slugTouched) slugInput.value = slugify(nameInput.value);
    queuePreview();
  });
  form.querySelectorAll('[data-mk]').forEach(btn => btn.onclick = () => applyMarkup(ta, TOOLBAR[Number(btn.dataset.mk)]));

  /* Cover upload → public products bucket → fills the URL field. */
  document.querySelector(`#${id('cover-file')}`).addEventListener('change', async e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const v = window.OMPFileValidate
        ? await window.OMPFileValidate.validateImage(file)
        : (() => {
            if (!/^image\/(png|jpe?g|webp|gif)$/i.test(file.type)) throw new Error('Cover must be a PNG, JPG, WebP or GIF image.');
            if (file.size > 5 * 1024 * 1024) throw new Error('Cover image is larger than the 5 MB limit.');
            return { ok: true, contentType: file.type };
          })();
      if (!v || !v.ok) throw new Error((v && v.error) || 'Cover image validation failed.');
      const safeName = String(file.name).replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `covers/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from('products').upload(path, file, {
        cacheControl: '3600', upsert: false, contentType: v.contentType || file.type
      });
      if (upErr) throw new Error(`Upload failed: ${upErr.message}`);
      const { data: pub } = supabase.storage.from('products').getPublicUrl(path);
      if (!pub?.publicUrl) throw new Error('Upload succeeded but no public URL was returned. Check that the products storage bucket is public.');
      coverInput.value = pub.publicUrl;
      setDirty(form, true);
      paintCover();
      queuePreview();
      flash(form, 'Cover uploaded — remember to save.');
    } catch (err) {
      flash(form, err?.message || String(err));
    }
  });

  document.querySelector('#cancel-product').onclick = () => {
    if (isDirty(form) && !confirm('Discard unsaved changes to this product?')) return;
    dirtyForms.delete(form);
    host.innerHTML = '';
  };

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    const f = new FormData(e.currentTarget);
    submitBtn.disabled = true; submitBtn.textContent = 'Saving…';
    try {
      const name = String(f.get('name') || '').trim();
      if (!name) throw new Error('A title is required.');
      const slug = slugify(f.get('slug')) || slugify(f.get('name'));
      if (!slug) throw new Error('A slug is required — add a title or type one in.');

      /* Purchase URL: http(s) only. It becomes an <a href> on the public
         page, so a javascript:/data: value is rejected at entry. */
      const rawUrl = String(f.get('external_url') || '').trim();
      const purchaseUrl = rawUrl ? (window.OMPUrl ? window.OMPUrl.safeUrl(rawUrl, { allowMailto: false }) : (/^https?:\/\//i.test(rawUrl) ? rawUrl : null)) : null;
      if (purchaseUrl === null && rawUrl) throw new Error('Purchase URL must be a full http(s) URL.');
      if (purchaseUrl && !/^https?:\/\//i.test(purchaseUrl)) throw new Error('Purchase URL must be an absolute http(s) URL (it opens in a new tab).');

      /* Cover URL: same gate the article featured_image uses. */
      const rawCover = String(f.get('featured_image') || '').trim();
      const cover = rawCover ? (window.OMPUrl ? window.OMPUrl.safeUrl(rawCover) : (/^(https?:|\/)/i.test(rawCover) ? rawCover : null)) : null;
      if (cover === null && rawCover) throw new Error('Cover image URL must be an http(s) or site-relative URL. Upload a file instead of pasting a data: image.');

      /* Price/currency pair validation. */
      const rawPrice = String(f.get('price') || '').trim();
      let price = null;
      if (rawPrice !== '') {
        price = Number(rawPrice);
        if (!isFinite(price) || price < 0) throw new Error('Price must be a zero-or-positive number.');
        price = Math.round(price * 100) / 100;
      }
      const currency = price == null ? null : String(f.get('currency') || '').trim().toUpperCase();
      if (price != null && !/^[A-Z]{3}$/.test(currency || '')) throw new Error('Currency must be a 3-letter ISO 4217 code (USD, EUR, INR…).');

      /* Private deliverable upload: magic-byte preflight, forced
         Content-Type, PRIVATE bucket — no public URL is ever derived. */
      /* Objects this save is about to stop referencing. Collected now,
         deleted only after the row write succeeds. */
      const orphans = [];
      const previousFile = bucketPathFromFilePath(p.file_path);
      const previousCover = bucketPathFromUrl(p.featured_image);
      if (previousCover && previousCover.bucket === 'products') orphans.push(previousCover);

      let filePath = p.file_path || null;
      if (f.get('remove_file') === 'on') filePath = null;
      const file = f.get('deliverable');
      if (file && file.size) {
        const v = window.OMPFileValidate ? await window.OMPFileValidate.validateFile(file) : null;
        if (!v || !v.ok) throw new Error((v && v.error) || 'File validation failed (allowed: PDF, DOC, DOCX, MD, TXT).');
        const safeName = String(file.name).replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${slug}/${Date.now()}-${safeName}`;
        const { error: upErr } = await supabase.storage.from('product-files').upload(path, file, { cacheControl: '3600', upsert: false, contentType: v.contentType || undefined });
        if (upErr) throw new Error(`Upload failed: ${upErr.message}`);
        filePath = `product-files/${path}`;
      }

      const status = f.get('status');
      const payload = {
        name,
        slug,
        summary: String(f.get('summary') || '').trim() || null,
        description: f.get('description'),
        product_type: PRODUCT_TYPES.some(t => t.value === f.get('product_type')) ? f.get('product_type') : 'other',
        price, currency,
        cta_label: String(f.get('cta_label') || '').trim().slice(0, 40) || null,
        featured: f.get('featured') === 'on',
        status,
        featured_image: cover,
        external_url: purchaseUrl,
        file_path: filePath,
        /* No UPDATE trigger exists on products either — keep updated_at
           honest so the catalog and the sitemap lastmod stay accurate. */
        updated_at: new Date().toISOString(),
        published_at: status === 'published' ? (p.published_at || new Date().toISOString()) : null
      };
      const result = product ? await supabase.from('products').update(payload).eq('id', product.id) : await supabase.from('products').insert(payload);
      if (result.error) throw result.error;
      /* Only now is it safe to drop the objects the row no longer
         references (replaced deliverable / replaced-or-removed cover). */
      if (filePath !== (p.file_path || null) && previousFile) orphans.push(previousFile);
      if (cover === (p.featured_image || null)) {
        /* Cover unchanged — never delete the object still in use. */
        for (let i = orphans.length - 1; i >= 0; i--) {
          if (orphans[i] === previousCover) orphans.splice(i, 1);
        }
      }
      await removeStorageObjects(orphans);
      clearDirty(form);
      loadTab('products');
    } catch (err) {
      submitBtn.disabled = false; submitBtn.textContent = product ? 'Save product' : 'Create product';
      flash(form, err?.message || String(err));
    }
  });
}

function toolForm(host, categories, tool) {
  const t = tool || {name:'',slug:'',description:'',route:'',icon:'',category_id:null,is_active:true,sort_order:0,metadata:{}};
  const uid = tool ? String(tool.id).slice(0, 8) : 'new';
  const id = n => `tf-${uid}-${n}`;
  host.innerHTML = `<form id="tool-form" class="card card-pad" style="margin-top:18px"><h3 class="h-3">${tool ? 'Edit tool' : 'New tool'}</h3><div class="editor-row-2" style="margin-top:16px"><div class="form-field"><label for="${id('name')}">Name</label><input id="${id('name')}" name="name" required value="${esc(t.name)}"></div><div class="form-field"><label for="${id('slug')}">Slug</label><input id="${id('slug')}" name="slug" required value="${esc(t.slug)}"></div></div><div class="form-field"><label for="${id('desc')}">Description</label><textarea id="${id('desc')}" name="description" rows="3">${esc(t.description || '')}</textarea></div><div class="editor-row-3"><div class="form-field"><label for="${id('cat')}">Category</label><select id="${id('cat')}" name="category_id"><option value="">None</option>${categories.map(c=>`<option value="${esc(c.id)}" ${c.id===t.category_id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div><div class="form-field"><label for="${id('route')}">Route</label><input id="${id('route')}" name="route" placeholder="/checker" value="${esc(t.route || '')}"></div><div class="form-field"><label for="${id('icon')}">Icon</label><input id="${id('icon')}" name="icon" value="${esc(t.icon || '')}"></div></div><div class="editor-row-2"><div class="form-field"><label for="${id('sort')}">Sort order</label><input id="${id('sort')}" name="sort_order" type="number" value="${Number(t.sort_order)||0}"></div><div class="opt-row"><div><div class="opt-name">Active</div><div class="opt-desc">Show this tool on the public registry.</div></div><span class="switch"><input name="is_active" type="checkbox" aria-label="Active" ${t.is_active?'checked':''}><span class="track"></span></span></div></div><div class="form-field"><label for="${id('meta')}">Metadata JSON</label><textarea id="${id('meta')}" name="metadata" rows="6">${esc(JSON.stringify(t.metadata || {}, null, 2))}</textarea></div><p class="tiny muted" style="margin-top:6px">Route must be a path on this site (for example <code>/checker</code>). Off-site or <code>javascript:</code> routes are rejected by the public search.</p><div class="flex gap-8" style="margin-top:14px"><button class="btn btn-primary" type="submit">Save tool</button><button class="btn btn-ghost" type="button" id="cancel-tool">Cancel</button></div></form>`;
  const form = document.querySelector('#tool-form');
  document.querySelector('#cancel-tool').onclick = () => {
    if (isDirty(form) && !confirm('Discard unsaved changes to this tool?')) return;
    dirtyForms.delete(form);
    host.innerHTML = '';
  };
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    const f=new FormData(e.currentTarget);
    let metadata={};
    try { metadata=JSON.parse(f.get('metadata')||'{}'); } catch { return flash(form, 'Metadata must be valid JSON.'); }
    submitBtn.disabled = true; submitBtn.textContent = 'Saving…';
    try {
      const route = String(f.get('route') || '').trim();
      if (route && !/^(\/|#)/.test(route)) throw new Error('Route must start with "/" (a path on this site).');
      const payload={name:f.get('name').trim(),slug:slugify(f.get('slug')),description:f.get('description'),category_id:f.get('category_id')||null,route,icon:f.get('icon'),sort_order:Number(f.get('sort_order'))||0,is_active:f.get('is_active')==='on',metadata};
      const result=tool?await supabase.from('tools').update(payload).eq('id',tool.id):await supabase.from('tools').insert(payload);
      if(result.error) throw result.error;
      loadTab('tools');
    } catch (err) {
      submitBtn.disabled = false; submitBtn.textContent = 'Save tool';
      flash(form, err?.message || String(err));
    }
  });
}

function bootError(e) {
  shell(`<div class="card card-pad" style="max-width:560px;margin:8vh auto 0"><div class="notice-band"><p>Admin panel failed to start: ${esc(e?.message || String(e))}. Check your connection and that the Supabase project is active.</p></div></div>`);
}

async function route() {
  const check = await checkAdmin();
  if (check.state === 'admin') {
    // Only render when we are not already on the dashboard — re-rendering on
    // every auth event used to wipe any open form whenever a token refreshed.
    if (authUi !== 'dashboard') await dashboard();
    return;
  }
  if (check.state === 'db-error') {
    // Never sign out or destroy a working dashboard on a (possibly transient)
    // database error — only surface it when we have no dashboard yet.
    if (authUi !== 'dashboard') {
      loginView(`Could not verify admin permissions — database error: ${check.message}. If the message is "permission denied for table profiles", fix it in the Supabase SQL Editor: GRANT SELECT ON public.profiles TO anon, authenticated; (plus a row-level-security SELECT policy).`);
    }
    return;
  }
  if (check.state === 'forbidden') {
    await supabase.auth.signOut();
    loginView('This account is not authorized for the admin panel.');
    return;
  }
  const expired = authUi === 'dashboard';
  clearAllDirty();
  loginView(expired ? 'Your session ended. Please sign in again.' : '');
}

// Serialize routing so concurrent triggers (login submit + SIGNED_IN event)
// cannot double-render and cannot race each other.
let routeChain = Promise.resolve();
function scheduleRoute() {
  routeChain = routeChain.then(route).catch(e => bootError(e));
  return routeChain;
}

supabase.auth.onAuthStateChange(event => {
  // Routine token lifecycle events must NOT re-render: TOKEN_REFRESHED fires
  // whenever the tab regains focus (i.e. after switching tabs) and used to
  // wipe any open form. INITIAL_SESSION is handled by the boot route below.
  if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') return;
  // Defer out of the callback: awaiting auth methods inside onAuthStateChange
  // can deadlock supabase-js (it holds an internal lock while this runs).
  setTimeout(scheduleRoute, 0);
});

/* Warn before losing a half-written article to a stray reload. */
window.addEventListener('beforeunload', e => {
  if (!hasUnsavedWork()) return;
  e.preventDefault();
  e.returnValue = '';
});

scheduleRoute();
