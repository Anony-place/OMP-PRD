/* Database and Storage authorization policies: supabase/00_schema_migrations.sql.
   UI validation is not a replacement for those server-side policies. */
/* The SDK is loaded from esm.sh at runtime (the site ships no bundler and
   no third-party scripts on public pages). The version is PINNED: a
   floating "@2" means a new minor release — or a compromised publish —
   changes what the admin panel executes with no code review. Bump it
   deliberately, and keep every module on the same version
   (tools/test_runtime.js asserts they agree). */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.115.0';
import { ACADEMY_CONFIG } from './academy-config.mjs';

if (typeof window.__adminBootOk === 'function') window.__adminBootOk();

const SUPABASE_URL = ACADEMY_CONFIG.supabaseUrl;
const SUPABASE_PUBLISHABLE_KEY = ACADEMY_CONFIG.supabasePublishableKey;
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

/* Title-dedupe: when the title was auto-extracted from the body's first
   heading, remove that heading from the saved content — otherwise the
   title renders twice (page title + body H1). Only strips when the text
   matches; author-written titles never touch the body. */
function stripExtractedHeading(content, title, wasAuto) {
  if (!wasAuto || !title) return content;
  const norm = s => String(s || '').toLowerCase().replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim();
  const want = norm(title);
  if (!want) return content;
  const raw = String(content || '');
  const md = raw.match(/^\s{0,3}#{1}\s+(.+?)\s*$/m);
  if (md && norm(md[1]) === want) return raw.replace(md[0], '').replace(/^\n+/, '');
  const h1 = raw.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) {
    const d = document.createElement('div');
    d.innerHTML = h1[1];
    if (norm(d.textContent) === want) return raw.replace(h1[0], '').replace(/^\n+/, '');
  }
  return content;
}

/* Pre-publish checklist (industry-standard guardrail): SEO + accessibility
   checks rendered live in every content form. Errors block save (handled
   by existing validation); warnings only advise. */
function contentChecklist(o) {
  const title = String(o.title || '').trim();
  const slug = String(o.slug || '').trim();
  const summary = String(o.summary || '').trim();
  const body = String(o.body || '');
  const checks = [];
  const ok = (pass, label) => checks.push({ pass: !!pass, label });
  ok(title.length >= 10 && title.length <= 70, `Title ${title.length}/70 chars (search sweet spot)`);
  ok(!!slug, 'Slug set (public URL)');
  ok(summary.length === 0 || (summary.length >= 40 && summary.length <= 300), summary.length ? `Summary ${summary.length} chars` : 'Summary empty — excerpt auto-generated');
  ok(!o.needCategory || !!o.categoryId, 'Category selected');
  ok(!body || body.length >= 300, `Body ${body.length} chars (thin pages don't rank)`);
  ok(!/lorem ipsum|TODO|FIXME/i.test(title + ' ' + body.slice(0, 2000)), 'No lorem/TODO placeholders');
  try {
    const holder = document.createElement('div');
    holder.innerHTML = window.OMPMarkdown?.renderSafe ? window.OMPMarkdown.renderSafe(body) : esc(body);
    const imgs = holder.querySelectorAll('img');
    let noAlt = 0;
    imgs.forEach(img => { if (!img.getAttribute('alt')) noAlt++; });
    ok(noAlt === 0, noAlt ? `${noAlt} image(s) missing alt text` : `Images have alt text${imgs.length ? ` (${imgs.length})` : ''}`);
    const h1s = holder.querySelectorAll('h1').length + (body.match(/^\s{0,3}#{1}\s+/gm) || []).length;
    ok(h1s <= 1, h1s > 1 ? `${h1s} × H1 in body (first becomes the page title)` : 'Single H1 (becomes the page title)');
  } catch { /* preview-only check — never blocks save */ }
  return checks;
}

/* Renders a checklist array into a [data-checklist] box. */
function paintChecklist(host, checks) {
  const box = host.querySelector('[data-checklist]');
  if (!box) return;
  box.innerHTML = `<div class="preview-head" style="margin-top:14px"><span class="tiny muted"><strong>Pre-publish checklist</strong> — green means ready</span></div><ul style="list-style:none;margin:8px 0 0;padding:0;display:grid;gap:6px">` +
    checks.map(c => `<li class="tiny" style="display:flex;gap:8px;align-items:flex-start"><span aria-hidden="true">${c.pass ? '✅' : '⚠️'}</span><span class="${c.pass ? 'muted' : ''}">${esc(c.label)}</span></li>`).join('') + '</ul>';
}
function extractTitleFromContent(source) {
  const raw = String(source || '');
  const md = raw.match(/^\s{0,3}#{1}\s+(.+?)\s*$/m);
  if (md) return md[1].replace(/[*_`]/g, '').trim().slice(0, 160);
  const h1 = raw.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) {
    const d = document.createElement('div');
    d.innerHTML = h1[1];
    return (d.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160);
  }
  return '';
}

/* Author-facing sanitizer notice for the live previews: renderBody() runs
   the safety filter, so anything it stripped or converted is reported
   right under the preview instead of silently vanishing. */

function sanitizeNoticeText() {
  try {
    if (!window.OMPSanitize || typeof window.OMPSanitize.stats !== 'function') return '';
    const s = window.OMPSanitize.stats();
    const parts = [];
    for (const k of Object.keys(s.dropped || {})) parts.push(`${s.dropped[k]} × ${k} removed (unsafe, never shown to readers)`);
    for (const k of Object.keys(s.converted || {})) parts.push(`${s.converted[k]} × ${k}`);
    if (!parts.length) return '';
    return `<p class="tiny" style="margin-top:10px;color:var(--yellow)">Heads up — the safety filter changed something: ${esc(parts.join('; '))}. What you see in this preview is exactly what readers get. Video/audio embeds and YouTube links are kept; scripts, iframes and styles are not.</p>`;
  } catch { return ''; }
}

/* Friendly slug-collision check: the database rejects duplicates with a
   cryptic error, so check first and say which slug is taken. */
async function assertSlugFree(table, slug, exceptId) {
  const { data, error } = await supabase.from(table).select('id').eq('slug', slug).limit(2);
  if (error) throw error;
  const clash = (data || []).find(r => String(r.id) !== String(exceptId || ''));
  if (clash) throw new Error(`Slug "${slug}" is already used — pick a different slug.`);
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
  /* No session is not a database failure — it just means nobody is signed
     in. Without this, anonymous visitors saw a scary "database error: Auth
     session missing!" banner on the login screen. */
  if (userError) {
    if (/session missing|no session|not authenticated/i.test(userError.message || '')) return { state: 'anon' };
    return { state: 'db-error', message: userError.message };
  }
  if (!user) return { state: 'anon' };
  const { data: profile, error } = await supabase.from('profiles').select('id,email,is_admin').eq('id', user.id).maybeSingle();
  if (error) return { state: 'db-error', message: error.message };
  if (!profile?.is_admin) return { state: 'forbidden' };
  return { state: 'admin', user };
}

const tabPaging = {
  articles: { page: 1, pageSize: 20 },
  tools: { page: 1, pageSize: 20 },
  products: { page: 1, pageSize: 20 },
  osint: { page: 1, pageSize: 20 },
  pentest: { page: 1, pageSize: 20 },
  messages: { page: 1, pageSize: 20 },
  media: { page: 1, pageSize: 24 }
};

function renderPagination(totalCount, currentPaging, onPageChange) {
  const page = currentPaging.page;
  const pageSize = currentPaging.pageSize;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const start = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(totalCount, page * pageSize);
  const container = document.createElement('div');
  container.className = 'admin-pagination';
  container.innerHTML = `<div class="admin-pagination-info">Showing <strong>${start}–${end}</strong> of <strong>${totalCount}</strong> items (Page ${page} of ${totalPages})</div>
    <div class="admin-pagination-btns">
      <button type="button" class="btn btn-secondary btn-sm" data-page-prev ${page <= 1 ? 'disabled' : ''}>← Previous</button>
      <button type="button" class="btn btn-secondary btn-sm" data-page-next ${page >= totalPages ? 'disabled' : ''}>Next →</button>
    </div>`;
  const prevBtn = container.querySelector('[data-page-prev]');
  const nextBtn = container.querySelector('[data-page-next]');
  if (prevBtn) prevBtn.onclick = () => { if (page > 1) { currentPaging.page--; onPageChange(); } };
  if (nextBtn) nextBtn.onclick = () => { if (page < totalPages) { currentPaging.page++; onPageChange(); } };
  return container;
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

async function refreshAdminStats() {
  const host = document.querySelector('#admin-kpis');
  if (!host) return;
  host.innerHTML = '<div class="admin-kpi-skeleton" aria-hidden="true"></div>'.repeat(4);
  const count = async (table, column, value) => {
    const q = supabase.from(table).select('id', { count: 'exact', head: true });
    const { count: total } = value === undefined ? await q : await q.eq(column, value);
    return Number(total || 0);
  };
  try {
    const [publishedArticles, drafts, publishedProducts, newMessages, activeTools] = await Promise.all([
      count('articles', 'status', 'published'),
      count('articles', 'status', 'draft'),
      count('products', 'status', 'published'),
      count('contact_messages', 'status', 'new'),
      count('tools', 'is_active', true)
    ]);
    host.innerHTML = [
      ['Published', publishedArticles, 'Articles live'],
      ['Drafts', drafts, 'Articles waiting'],
      ['Unread', newMessages, 'New messages'],
      ['Active tools', activeTools, 'Registry tools']
    ].map(([label, value, sub]) =>
      '<div class="admin-kpi"><div class="admin-kpi-label">' + esc(label) +
      '</div><div class="admin-kpi-value">' + esc(value) +
      '</div><div class="admin-kpi-sub">' + esc(sub) + '</div></div>'
    ).join('');
  } catch (e) {
    host.innerHTML = '<div class="admin-kpi admin-kpi-error"><div class="admin-kpi-label">Admin data</div><div class="admin-kpi-sub">Stats unavailable right now.</div></div>';
  }
}

async function dashboard() {
  authUi = 'dashboard';
  shell(`<div class="card card-pad">
    <div class="admin-topbar"><div><div class="badge badge-demo">Private admin</div><h1 class="h-2 mt-16">OMP Control Center</h1><p class="muted" style="margin-top:6px">Content, products, tools, media and support in one place.</p></div><div class="admin-top-actions"><span class="tiny muted" id="admin-session-label">Signed in</span><button id="logout" class="btn btn-ghost">Sign out</button></div></div>
    <div id="admin-kpis" class="admin-kpis" aria-label="Admin overview"></div>
    <div class="admin-actions admin-tabs" style="margin-top:24px" role="group" aria-label="Admin sections"><button class="btn btn-secondary" type="button" data-tab="articles">Articles</button><button class="btn btn-secondary" type="button" data-tab="tools">Tools</button><button class="btn btn-secondary" type="button" data-tab="products">Products</button><button class="btn btn-secondary" type="button" data-tab="osint">OSINT</button><button class="btn btn-secondary" type="button" data-tab="pentest">Pentest</button><button class="btn btn-secondary" type="button" data-tab="media">Media Library</button><button class="btn btn-secondary" type="button" data-tab="messages">Messages</button></div>
    <section id="panel" class="admin-panel" aria-live="polite"></section>
  </div>`);
  document.querySelector('#logout').onclick = async () => { await supabase.auth.signOut(); loginView(); };
  const sessionLabel = document.querySelector('#admin-session-label');
  const { data: { user: sessionUser } } = await supabase.auth.getUser();
  if (sessionLabel) sessionLabel.textContent = sessionUser?.email || 'Signed in';
  document.querySelectorAll('[data-tab]').forEach(btn => btn.onclick = () => loadTab(btn.dataset.tab));
  markActiveTab();
  refreshAdminStats();
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
      <div id="deploy-slot" aria-live="polite"></div>
      <div id="article-editor"></div>
      <div class="admin-list" id="article-list" style="margin-top:18px"></div>
      <div id="article-paging-slot"></div>`;
    const editor = document.querySelector('#article-editor');
    const listEl = document.querySelector('#article-list');
    const pagingSlot = document.querySelector('#article-paging-slot');
    const paintList = filter => {
      const q = String(filter || '').trim().toLowerCase();
      const filtered = q ? rows.filter(a => [a.title, a.slug, a.status].some(v => String(v || '').toLowerCase().includes(q))) : rows;
      const pageSize = tabPaging.articles.pageSize;
      const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
      if (tabPaging.articles.page > totalPages) tabPaging.articles.page = 1;
      const start = (tabPaging.articles.page - 1) * pageSize;
      const shown = filtered.slice(start, start + pageSize);
      listEl.innerHTML = shown.map(a => `<div class="admin-row"><div class="grow"><div class="ttl">${esc(a.title)}</div><div class="meta">/${esc(a.slug)} · <span class="admin-chip ${a.status === 'published' ? 'is-success' : ''}">${esc(a.status)}</span>${a.document_url ? ' · 📄 doc' : ''}</div></div><div class="row-btns"><button type="button" class="btn btn-secondary btn-sm" data-edit-article="${esc(a.id)}">Edit</button><button type="button" class="btn btn-ghost btn-sm" data-delete-article="${esc(a.id)}" style="color:var(--red)">Delete</button></div></div>`).join('')
        || `<div class="admin-empty"><p class="muted">${rows.length ? 'No articles match that filter.' : 'No articles yet.'}</p></div>`;
      
      pagingSlot.innerHTML = '';
      if (filtered.length > pageSize) {
        pagingSlot.appendChild(renderPagination(filtered.length, tabPaging.articles, () => paintList(document.querySelector('#article-filter').value)));
      }

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
        await refreshAdminStats();
        loadTab('articles');
      });
    };
    paintList('');
    document.querySelector('#article-filter').addEventListener('input', e => paintList(e.target.value));
    document.querySelector('#new-article').onclick = () => { articleForm(editor, categories || [], null); editor.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    if (pendingDeploy) {
      const slot = document.querySelector('#deploy-slot');
      if (slot) publishChip(slot, pendingDeploy.jobId, pendingDeploy.path);
      pendingDeploy = null;
    }
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
      await refreshAdminStats();
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
        await refreshAdminStats();
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
        await refreshAdminStats();
        loadTab('products');
      });
    };
    paintList('');
    document.querySelector('#product-filter').addEventListener('input', e => paintList(e.target.value));
    document.querySelector('#new-product').onclick = () => { productForm(editor, null); editor.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  } else if (tab === 'osint') {
    const [{ data: tools, error }, { data: categories, error: catError }] = await Promise.all([
      supabase.from('osint_tools').select('id,name,slug,pricing,status,featured,sort_order,category_id,logo_url,updated_at').order('sort_order').order('name').limit(ADMIN_ROW_LIMIT),
      supabase.from('osint_categories').select('id,name,slug,description,status,sort_order').order('sort_order').order('name')
    ]);
    if (stale()) return;
    if (error) return panel.innerHTML = notice(error.message);
    if (catError) return panel.innerHTML = notice(catError.message);
    const rows = tools || [];
    const cats = categories || [];
    const catName = id => (cats.find(c => c.id === id) || {}).name || '—';
    panel.innerHTML = `<div class="flex justify-between items-center wrap gap-12"><h2 class="h-3">OSINT Hub</h2><div class="flex gap-8"><button id="new-osint-cat" type="button" class="btn btn-secondary btn-sm">+ New category</button><button id="new-osint-tool" type="button" class="btn btn-primary btn-sm">+ New tool</button></div></div>
      <p class="tiny muted" style="margin-top:6px">Public pages: <code>/osint</code> (hub) and <code>/osint/&lt;slug&gt;</code> (detail). Publish a tool and it appears after the next deploy turns the row into a page.</p>
      <h3 class="h-3" style="margin-top:20px">Categories</h3>
      <div id="osint-cat-editor"></div>
      <div class="admin-list" id="osint-cat-list" style="margin-top:12px">${cats.map(c => `<div class="admin-row"><div class="grow"><div class="ttl">${esc(c.name)}</div><div class="meta">/osint#/c/${esc(c.slug)} · ${esc(c.status)}</div></div><div class="row-btns"><button type="button" class="btn btn-secondary btn-sm" data-publish-osint-cat="${esc(c.id)}" data-on="${c.status === 'published' ? '1' : ''}">${c.status === 'published' ? 'Unpublish' : 'Publish'}</button><button type="button" class="btn btn-secondary btn-sm" data-edit-osint-cat="${esc(c.id)}">Edit</button><button type="button" class="btn btn-ghost btn-sm" data-delete-osint-cat="${esc(c.id)}" style="color:var(--red)">Delete</button></div></div>`).join('') || '<div class="admin-empty"><p class="muted">No categories yet — create the first one.</p></div>'}</div>
      <h3 class="h-3" style="margin-top:24px">Tools</h3>
      <div class="form-field" style="margin-top:10px;max-width:380px"><label for="osint-filter">Filter</label><input id="osint-filter" type="search" placeholder="Search name, slug, pricing or status…" autocomplete="off"></div>
      <div id="osint-tool-editor"></div>
      <div class="admin-list" id="osint-tool-list" style="margin-top:18px"></div>`;
    const catEditor = document.querySelector('#osint-cat-editor');
    const toolEditor = document.querySelector('#osint-tool-editor');
    document.querySelector('#new-osint-cat').onclick = () => { osintCategoryForm(catEditor, null); catEditor.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    document.querySelector('#new-osint-tool').onclick = () => { osintToolForm(toolEditor, cats, null); toolEditor.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    document.querySelectorAll('[data-publish-osint-cat]').forEach(btn => btn.onclick = async () => {
      btn.disabled = true;
      const publish = btn.dataset.on !== '1';
      const { error: e2 } = await supabase.from('osint_categories').update(publish ? { status: 'published', published_at: new Date().toISOString() } : { status: 'draft' }).eq('id', btn.dataset.publishOsintCat);
      if (e2) { btn.disabled = false; return flash(panel, `Update failed: ${e2.message}`); }
      loadTab('osint');
    });
    document.querySelectorAll('[data-edit-osint-cat]').forEach(btn => btn.onclick = async () => {
      btn.disabled = true;
      const { data, error: e2 } = await supabase.from('osint_categories').select('*').eq('id', btn.dataset.editOsintCat).single();
      btn.disabled = false;
      if (e2 || !data) return flash(panel, e2 ? e2.message : 'That category could not be loaded.');
      osintCategoryForm(catEditor, data);
      catEditor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    document.querySelectorAll('[data-delete-osint-cat]').forEach(btn => btn.onclick = async () => {
      if (!confirm('Delete this category? Its tools stay published but become uncategorized.')) return;
      btn.disabled = true;
      const { error: e2 } = await supabase.from('osint_categories').delete().eq('id', btn.dataset.deleteOsintCat);
      if (e2) { btn.disabled = false; return flash(panel, `Delete failed: ${e2.message}`); }
      loadTab('osint');
    });
    const listEl = document.querySelector('#osint-tool-list');
    const paintList = filter => {
      const q = String(filter || '').trim().toLowerCase();
      const shown = q ? rows.filter(t => [t.name, t.slug, t.pricing, t.status, catName(t.category_id)].some(v => String(v || '').toLowerCase().includes(q))) : rows;
      listEl.innerHTML = shown.map(t => `<div class="admin-row">${safeHref(t.logo_url) ? `<img src="${esc(safeHref(t.logo_url))}" alt="" width="48" height="32" style="width:48px;height:32px;object-fit:contain;border-radius:6px;flex:none;background:var(--bg-soft)">` : ''}<div class="grow"><div class="ttl">${esc(t.name)} ${t.featured ? '<span class="ptype t-featured">★</span>' : ''}</div><div class="meta">/osint/${esc(t.slug)} · ${esc(catName(t.category_id))} · ${esc(t.pricing)} · ${esc(t.status)}${t.logo_url ? ' · 🖼 logo' : ''}</div></div><div class="row-btns"><button type="button" class="btn btn-secondary btn-sm" data-feature-osint="${esc(t.id)}" data-on="${t.featured ? '1' : ''}">${t.featured ? 'Unfeature' : 'Feature'}</button><button type="button" class="btn btn-secondary btn-sm" data-publish-osint="${esc(t.id)}" data-on="${t.status === 'published' ? '1' : ''}">${t.status === 'published' ? 'Unpublish' : 'Publish'}</button><button type="button" class="btn btn-secondary btn-sm" data-edit-osint="${esc(t.id)}">Edit</button><button type="button" class="btn btn-ghost btn-sm" data-delete-osint="${esc(t.id)}" style="color:var(--red)">Delete</button></div></div>`).join('')
        || `<div class="admin-empty"><p class="muted">${rows.length ? 'No tools match that filter.' : 'No OSINT tools yet — create the first one.'}</p></div>`;
      const patch = async (btn, id, set) => {
        btn.disabled = true;
        const { error: e2 } = await supabase.from('osint_tools').update(set).eq('id', id);
        if (e2) { btn.disabled = false; return flash(panel, `Update failed: ${e2.message}`); }
        loadTab('osint');
      };
      listEl.querySelectorAll('[data-publish-osint]').forEach(btn => btn.onclick = () => {
        const publish = btn.dataset.on !== '1';
        patch(btn, btn.dataset.publishOsint, publish ? { status: 'published', published_at: new Date().toISOString() } : { status: 'draft' });
      });
      listEl.querySelectorAll('[data-feature-osint]').forEach(btn => btn.onclick = () => {
        patch(btn, btn.dataset.featureOsint, { featured: btn.dataset.on !== '1' });
      });
      listEl.querySelectorAll('[data-edit-osint]').forEach(btn => btn.onclick = async () => {
        btn.disabled = true;
        const { data, error: e2 } = await supabase.from('osint_tools').select('*').eq('id', btn.dataset.editOsint).single();
        btn.disabled = false;
        if (e2 || !data) return flash(panel, e2 ? e2.message : 'That tool could not be loaded.');
        osintToolForm(toolEditor, cats, data);
        toolEditor.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      listEl.querySelectorAll('[data-delete-osint]').forEach(btn => btn.onclick = async () => {
        if (!confirm('Delete this OSINT tool permanently?')) return;
        btn.disabled = true;
        const { data: row } = await supabase.from('osint_tools').select('id,logo_url').eq('id', btn.dataset.deleteOsint).maybeSingle();
        const { error: e2 } = await supabase.from('osint_tools').delete().eq('id', btn.dataset.deleteOsint);
        if (e2) { btn.disabled = false; return flash(panel, `Delete failed: ${e2.message}`); }
        await removeStorageObjects([bucketPathFromUrl(row && row.logo_url)]);
        loadTab('osint');
      });
    };
    paintList('');
    document.querySelector('#osint-filter').addEventListener('input', e => paintList(e.target.value));
  } else if (tab === 'pentest') {
    const [{ data: tools, error }, { data: categories, error: catError }] = await Promise.all([
      supabase.from('pentest_tools').select('id,name,slug,pricing,status,featured,sort_order,category_id,logo_url,updated_at').order('sort_order').order('name').limit(ADMIN_ROW_LIMIT),
      supabase.from('pentest_categories').select('id,name,slug,description,status,sort_order').order('sort_order').order('name')
    ]);
    if (stale()) return;
    if (error) return panel.innerHTML = notice(error.message);
    if (catError) return panel.innerHTML = notice(catError.message);
    const rows = tools || [];
    const cats = categories || [];
    const catName = id => (cats.find(c => c.id === id) || {}).name || '—';
    panel.innerHTML = `<div class="flex justify-between items-center wrap gap-12"><h2 class="h-3">Pentest Hub</h2><div class="flex gap-8"><button id="new-pentest-cat" type="button" class="btn btn-secondary btn-sm">+ New category</button><button id="new-pentest-tool" type="button" class="btn btn-primary btn-sm">+ New tool</button></div></div>
      <p class="tiny muted" style="margin-top:6px">Public pages: <code>/pentest</code> (hub) and <code>/pentest/&lt;slug&gt;</code> (detail). Publish a tool and it appears after the next deploy turns the row into a page.</p>
      <h3 class="h-3" style="margin-top:20px">Categories</h3>
      <div id="pentest-cat-editor"></div>
      <div class="admin-list" id="pentest-cat-list" style="margin-top:12px">${cats.map(c => `<div class="admin-row"><div class="grow"><div class="ttl">${esc(c.name)}</div><div class="meta">/pentest#/c/${esc(c.slug)} · ${esc(c.status)}</div></div><div class="row-btns"><button type="button" class="btn btn-secondary btn-sm" data-publish-pentest-cat="${esc(c.id)}" data-on="${c.status === 'published' ? '1' : ''}">${c.status === 'published' ? 'Unpublish' : 'Publish'}</button><button type="button" class="btn btn-secondary btn-sm" data-edit-pentest-cat="${esc(c.id)}">Edit</button><button type="button" class="btn btn-ghost btn-sm" data-delete-pentest-cat="${esc(c.id)}" style="color:var(--red)">Delete</button></div></div>`).join('') || '<div class="admin-empty"><p class="muted">No categories yet — create the first one.</p></div>'}</div>
      <h3 class="h-3" style="margin-top:24px">Tools</h3>
      <div class="form-field" style="margin-top:10px;max-width:380px"><label for="pentest-filter">Filter</label><input id="pentest-filter" type="search" placeholder="Search name, slug, pricing or status…" autocomplete="off"></div>
      <div id="pentest-tool-editor"></div>
      <div class="admin-list" id="pentest-tool-list" style="margin-top:18px"></div>`;
    const catEditor = document.querySelector('#pentest-cat-editor');
    const toolEditor = document.querySelector('#pentest-tool-editor');
    document.querySelector('#new-pentest-cat').onclick = () => { pentestCategoryForm(catEditor, null); catEditor.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    document.querySelector('#new-pentest-tool').onclick = () => { pentestToolForm(toolEditor, cats, null); toolEditor.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    document.querySelectorAll('[data-publish-pentest-cat]').forEach(btn => btn.onclick = async () => {
      btn.disabled = true;
      const publish = btn.dataset.on !== '1';
      const { error: e2 } = await supabase.from('pentest_categories').update(publish ? { status: 'published', published_at: new Date().toISOString() } : { status: 'draft' }).eq('id', btn.dataset.publishPentestCat);
      if (e2) { btn.disabled = false; return flash(panel, `Update failed: ${e2.message}`); }
      loadTab('pentest');
    });
    document.querySelectorAll('[data-edit-pentest-cat]').forEach(btn => btn.onclick = async () => {
      btn.disabled = true;
      const { data, error: e2 } = await supabase.from('pentest_categories').select('*').eq('id', btn.dataset.editPentestCat).single();
      btn.disabled = false;
      if (e2 || !data) return flash(panel, e2 ? e2.message : 'That category could not be loaded.');
      pentestCategoryForm(catEditor, data);
      catEditor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    document.querySelectorAll('[data-delete-pentest-cat]').forEach(btn => btn.onclick = async () => {
      if (!confirm('Delete this category? Its tools stay published but become uncategorized.')) return;
      btn.disabled = true;
      const { error: e2 } = await supabase.from('pentest_categories').delete().eq('id', btn.dataset.deletePentestCat);
      if (e2) { btn.disabled = false; return flash(panel, `Delete failed: ${e2.message}`); }
      loadTab('pentest');
    });
    const listEl = document.querySelector('#pentest-tool-list');
    const paintList = filter => {
      const q = String(filter || '').trim().toLowerCase();
      const shown = q ? rows.filter(t => [t.name, t.slug, t.pricing, t.status, catName(t.category_id)].some(v => String(v || '').toLowerCase().includes(q))) : rows;
      listEl.innerHTML = shown.map(t => `<div class="admin-row">${safeHref(t.logo_url) ? `<img src="${esc(safeHref(t.logo_url))}" alt="" width="48" height="32" style="width:48px;height:32px;object-fit:contain;border-radius:6px;flex:none;background:var(--bg-soft)">` : ''}<div class="grow"><div class="ttl">${esc(t.name)} ${t.featured ? '<span class="ptype t-featured">★</span>' : ''}</div><div class="meta">/pentest/${esc(t.slug)} · ${esc(catName(t.category_id))} · ${esc(t.pricing)} · ${esc(t.status)}${t.logo_url ? ' · 🖼 logo' : ''}</div></div><div class="row-btns"><button type="button" class="btn btn-secondary btn-sm" data-feature-pentest="${esc(t.id)}" data-on="${t.featured ? '1' : ''}">${t.featured ? 'Unfeature' : 'Feature'}</button><button type="button" class="btn btn-secondary btn-sm" data-publish-pentest="${esc(t.id)}" data-on="${t.status === 'published' ? '1' : ''}">${t.status === 'published' ? 'Unpublish' : 'Publish'}</button><button type="button" class="btn btn-secondary btn-sm" data-edit-pentest="${esc(t.id)}">Edit</button><button type="button" class="btn btn-ghost btn-sm" data-delete-pentest="${esc(t.id)}" style="color:var(--red)">Delete</button></div></div>`).join('')
        || `<div class="admin-empty"><p class="muted">${rows.length ? 'No tools match that filter.' : 'No Pentest tools yet — create the first one.'}</p></div>`;
      const patch = async (btn, id, set) => {
        btn.disabled = true;
        const { error: e2 } = await supabase.from('pentest_tools').update(set).eq('id', id);
        if (e2) { btn.disabled = false; return flash(panel, `Update failed: ${e2.message}`); }
        loadTab('pentest');
      };
      listEl.querySelectorAll('[data-publish-pentest]').forEach(btn => btn.onclick = () => {
        const publish = btn.dataset.on !== '1';
        patch(btn, btn.dataset.publishPentest, publish ? { status: 'published', published_at: new Date().toISOString() } : { status: 'draft' });
      });
      listEl.querySelectorAll('[data-feature-pentest]').forEach(btn => btn.onclick = () => {
        patch(btn, btn.dataset.featurePentest, { featured: btn.dataset.on !== '1' });
      });
      listEl.querySelectorAll('[data-edit-pentest]').forEach(btn => btn.onclick = async () => {
        btn.disabled = true;
        const { data, error: e2 } = await supabase.from('pentest_tools').select('*').eq('id', btn.dataset.editPentest).single();
        btn.disabled = false;
        if (e2 || !data) return flash(panel, e2 ? e2.message : 'That tool could not be loaded.');
        pentestToolForm(toolEditor, cats, data);
        toolEditor.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      listEl.querySelectorAll('[data-delete-pentest]').forEach(btn => btn.onclick = async () => {
        if (!confirm('Delete this Pentest tool permanently?')) return;
        btn.disabled = true;
        const { data: row } = await supabase.from('pentest_tools').select('id,logo_url').eq('id', btn.dataset.deletePentest).maybeSingle();
        const { error: e2 } = await supabase.from('pentest_tools').delete().eq('id', btn.dataset.deletePentest);
        if (e2) { btn.disabled = false; return flash(panel, `Delete failed: ${e2.message}`); }
        await removeStorageObjects([bucketPathFromUrl(row && row.logo_url)]);
        loadTab('pentest');
      });
    };
    paintList('');
    document.querySelector('#pentest-filter').addEventListener('input', e => paintList(e.target.value));
  } else if (tab === 'media') {
    const BUCKETS = [
      { id: 'articles', label: 'Articles (Documents & Images)', public: true },
      { id: 'osint-logos', label: 'OSINT Logos', public: true },
      { id: 'pentest-logos', label: 'Pentest Logos', public: true },
      { id: 'products', label: 'Product Covers', public: true },
      { id: 'product-files', label: 'Product Deliverables (Secure)', public: false }
    ];
    let selectedBucket = 'articles';

    const renderMediaView = async () => {
      panel.innerHTML = `<div class="flex justify-between items-center wrap gap-12">
          <div><h2 class="h-3">Media & Asset Library</h2><p class="tiny muted" style="margin-top:4px">Browse, upload, and audit cloud storage assets across OopsMyPassword storage buckets.</p></div>
          <div class="flex gap-8 items-center">
            <label class="btn btn-primary btn-sm" style="cursor:pointer;margin:0">
              + Upload to ${esc(selectedBucket)}
              <input id="media-upload-input" type="file" style="display:none">
            </label>
            <button id="refresh-media" type="button" class="btn btn-secondary btn-sm">Refresh</button>
          </div>
        </div>
        <div class="admin-actions" style="margin-top:16px;gap:8px" role="tablist" aria-label="Buckets">
          ${BUCKETS.map(b => `<button type="button" class="btn btn-sm ${b.id === selectedBucket ? 'btn-primary' : 'btn-secondary'}" data-bucket="${b.id}">${esc(b.label)}</button>`).join('')}
        </div>
        <div id="media-content-host" style="margin-top:18px"><div class="admin-empty"><p class="muted">Loading storage objects…</p></div></div>`;

      document.querySelector('#refresh-media').onclick = () => renderMediaView();
      panel.querySelectorAll('[data-bucket]').forEach(btn => btn.onclick = () => {
        selectedBucket = btn.dataset.bucket;
        renderMediaView();
      });

      const uploadInput = document.querySelector('#media-upload-input');
      uploadInput.onchange = async () => {
        const file = uploadInput.files && uploadInput.files[0];
        if (!file) return;
        uploadInput.disabled = true;
        flash(panel, `Validating and uploading ${file.name} to ${selectedBucket}…`);
        try {
          const v = window.OMPFileValidate ? await window.OMPFileValidate.validateFile(file) : { ok: true, contentType: file.type };
          if (v && !v.ok) throw new Error(v.error || 'File validation failed.');
          const safeName = String(file.name).replace(/[^a-zA-Z0-9._-]/g, '_');
          const targetPath = `${Date.now()}-${safeName}`;
          const { error: upErr } = await supabase.storage.from(selectedBucket).upload(targetPath, file, {
            contentType: v.contentType || undefined,
            upsert: false
          });
          if (upErr) throw upErr;
          flash(panel, `File "${file.name}" uploaded successfully.`);
          renderMediaView();
        } catch (err) {
          flash(panel, `Upload failed: ${err.message || String(err)}`);
        }
      };

      const host = document.querySelector('#media-content-host');
      const { data: objects, error: listErr } = await supabase.storage.from(selectedBucket).list('', {
        limit: 100,
        sortBy: { column: 'created_at', order: 'desc' }
      });
      if (stale()) return;
      if (listErr) {
        host.innerHTML = notice(`Could not list objects in bucket "${selectedBucket}": ${listErr.message}`);
        return;
      }

      const files = (objects || []).filter(o => o.name && o.name !== '.emptyFolderPlaceholder');
      if (!files.length) {
        host.innerHTML = `<div class="admin-empty"><p class="muted">No files in bucket <strong>${esc(selectedBucket)}</strong> yet.</p></div>`;
        return;
      }

      const currentBucketConfig = BUCKETS.find(b => b.id === selectedBucket);
      const isPublic = currentBucketConfig ? currentBucketConfig.public : true;

      host.innerHTML = `<div class="admin-media-grid">${files.map(f => {
        let publicUrl = '';
        if (isPublic) {
          const { data: pub } = supabase.storage.from(selectedBucket).getPublicUrl(f.name);
          publicUrl = pub?.publicUrl || '';
        }
        const isImg = /\.(png|jpe?g|webp|gif|svg)$/i.test(f.name);
        const formatSize = bytes => {
          if (!bytes) return '';
          if (bytes < 1024) return bytes + ' B';
          if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
          return (bytes / 1048576).toFixed(1) + ' MB';
        };
        return `<div class="admin-media-card">
          <div class="admin-media-thumb">
            ${isImg && publicUrl ? `<img src="${esc(publicUrl)}" alt="${esc(f.name)}" loading="lazy">` : (isImg ? '🖼' : '📄')}
          </div>
          <div class="admin-media-name" title="${esc(f.name)}">${esc(f.name)}</div>
          <div class="admin-media-meta">${esc(formatSize(f.metadata?.size))} · ${f.created_at ? esc(new Date(f.created_at).toLocaleDateString()) : ''}</div>
          <div class="admin-media-actions">
            ${publicUrl ? `<button type="button" class="btn btn-secondary btn-sm" style="flex:1" data-copy-media-url="${esc(publicUrl)}">Copy URL</button>` : ''}
            <button type="button" class="btn btn-ghost btn-sm" data-delete-media-file="${esc(f.name)}" style="color:var(--red)">Delete</button>
          </div>
        </div>`;
      }).join('')}</div>`;

      host.querySelectorAll('[data-copy-media-url]').forEach(btn => btn.onclick = async () => {
        try {
          await navigator.clipboard.writeText(btn.dataset.copyMediaUrl);
          flash(panel, 'Public URL copied to clipboard.');
        } catch {
          flash(panel, 'Could not copy URL automatically.');
        }
      });

      host.querySelectorAll('[data-delete-media-file]').forEach(btn => btn.onclick = async () => {
        const fileName = btn.dataset.deleteMediaFile;
        if (!confirm(`Delete "${fileName}" from ${selectedBucket}?`)) return;
        btn.disabled = true;
        const { error: delErr } = await supabase.storage.from(selectedBucket).remove([fileName]);
        if (delErr) {
          btn.disabled = false;
          return flash(panel, `Delete failed: ${delErr.message}`);
        }
        flash(panel, `Deleted "${fileName}".`);
        renderMediaView();
      });
    };

    renderMediaView();
  } else {
    const [{ data: msgs, error }, { data: profiles, error: profileError }] = await Promise.all([
      supabase.from('contact_messages').select('id,name,email,message,status,created_at,read_at,sender_user_id').order('created_at',{ascending:false}).limit(300),
      supabase.from('profiles').select('id,display_name,email').order('display_name')
    ]);
    if (stale()) return;
    if (error) return panel.innerHTML = notice(error.message);
    const rows = msgs || [];
    const profileMap = new Map((profileError ? [] : (profiles || [])).map(p => [p.id, p]));
    const composeMail = (email, name, message) => {
      /* The address part of a mailto: link is used verbatim — encoding it
         (especially the @) breaks some desktop clients, so only the
         subject/body are encoded. Returns '' for a malformed address
         instead of a dead button. */
      const addr = String(email || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) return '';
      const subject = encodeURIComponent('Re: OopsMyPassword — ' + String(name || 'contact').slice(0, 70));
      const body = encodeURIComponent('Hi ' + String(name || 'there').trim() + ',\n\nThanks for contacting OopsMyPassword.\n\n--- Original message ---\n' + String(message || '') + '\n\n');
      return 'mailto:' + addr + '?subject=' + subject + '&body=' + body;
    };
    const copyText = async (text) => {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        return false;
      }
    };
    const applyMessageStatus = async (btn, id, status) => {
      btn.disabled = true;
      const patch = { status };
      if (status !== 'new') patch.read_at = new Date().toISOString();
      const { error: e2 } = await supabase.from('contact_messages').update(patch).eq('id', id);
      if (e2) {
        btn.disabled = false;
        return flash(panel, 'Update failed: ' + e2.message);
      }
      await refreshAdminStats();
      loadTab('messages');
    };

    const paintMessages = (filterText, filterStatus) => {
      const q = String(filterText || '').trim().toLowerCase();
      const status = filterStatus || 'all';
      const filtered = rows.filter(m => {
        const profile = m.sender_user_id ? profileMap.get(m.sender_user_id) : null;
        const displayName = profile?.display_name || m.name || '';
        const displayEmail = profile?.email || m.email || '';
        const hay = [displayName, displayEmail, m.name, m.email, m.message].join(' ').toLowerCase();
        return (!q || hay.includes(q)) && (status === 'all' || m.status === status);
      });
      const newCount = rows.filter(m => m.status === 'new').length;
      const linkedCount = rows.filter(m => m.sender_user_id).length;
      document.querySelector('#message-summary').textContent =
        newCount + ' unread · ' + rows.length + ' total · ' + linkedCount + ' linked account' + (linkedCount === 1 ? '' : 's');
      listEl.innerHTML = filtered.map(m => {
        const profile = m.sender_user_id ? profileMap.get(m.sender_user_id) : null;
        const displayName = profile?.display_name || m.name || 'Unknown sender';
        const displayEmail = profile?.email || m.email || '';
        const linked = !!profile;
        const mail = composeMail(displayEmail, displayName, m.message);
        const initials = String(displayName).trim().split(/\s+/).slice(0, 2).map(x => x[0]?.toUpperCase() || '').join('') || '?';
        return `<article class="admin-message-row ${m.status === 'new' ? 'is-unread' : ''}">
          <div class="admin-message-avatar" aria-hidden="true">${esc(initials)}</div>
          <div class="admin-message-main">
            <div class="admin-message-head">
              <div class="admin-message-sender">
                <div class="ttl">${esc(displayName)}</div>
                ${mail ? `<a class="admin-email-link" href="${esc(mail)}" title="Reply by email">${esc(displayEmail)}</a>` : `<span class="admin-email-link" title="Invalid address — cannot reply">${esc(displayEmail)}</span>`}
              </div>
              <div class="admin-message-meta"><span class="admin-chip ${m.status === 'new' ? 'is-new' : ''}">${esc(m.status)}</span><span class="tiny muted">${esc(new Date(m.created_at).toLocaleString())}</span></div>
            </div>
            <div class="admin-message-badges"><span class="admin-chip">${linked ? 'Account' : 'Guest'}</span>${m.sender_user_id && !profile ? '<span class="admin-chip is-warning">Account record unavailable</span>' : ''}${m.status === 'new' ? '<span class="admin-chip is-new">Unread</span>' : ''}</div>
            <p class="admin-message-body">${esc(m.message)}</p>
            <div class="admin-message-actions">
              ${mail ? `<a class="btn btn-primary btn-sm" href="${esc(mail)}" data-reply-mail="${esc(m.id)}" title="Opens your mail app with a quoted reply">Reply by email</a>` : `<span class="btn btn-ghost btn-sm" title="Sender address is invalid">Can't reply</span>`}
              <button type="button" class="btn btn-secondary btn-sm" data-copy-email="${esc(displayEmail)}">Copy email</button>
              ${m.status === 'new' ? `<button type="button" class="btn btn-secondary btn-sm" data-msg-read="${esc(m.id)}">Mark read</button>` : ''}
              ${m.status !== 'archived' ? `<button type="button" class="btn btn-ghost btn-sm" data-msg-archive="${esc(m.id)}">Archive</button>` : ''}
              <button type="button" class="btn btn-ghost btn-sm" data-msg-delete="${esc(m.id)}" style="color:var(--red)">Delete</button>
            </div>
          </div>
        </article>`;
      }).join('') || `<div class="admin-empty"><p class="muted">${rows.length ? 'No messages match your filters.' : 'Inbox is clear — no contact messages yet.'}</p></div>`;

      listEl.querySelectorAll('[data-copy-email]').forEach(btn => btn.onclick = async () => {
        const ok = await copyText(btn.dataset.copyEmail || '');
        flash(panel, ok ? 'Email copied.' : 'Could not copy automatically — select the email address instead.');
      });
      /* Replying means the message was handled — auto-mark it read so the
         inbox triages itself. Fire-and-forget: the mail app opening must
         never be blocked on the database. */
      listEl.querySelectorAll('[data-reply-mail]').forEach(link => link.addEventListener('click', () => {
        supabase.from('contact_messages').update({ status: 'read', read_at: new Date().toISOString() }).eq('id', link.dataset.replyMail).then(() => refreshAdminStats());
      }));
      listEl.querySelectorAll('[data-msg-read]').forEach(btn => btn.onclick = () => applyMessageStatus(btn, btn.dataset.msgRead, 'read'));
      listEl.querySelectorAll('[data-msg-archive]').forEach(btn => btn.onclick = () => applyMessageStatus(btn, btn.dataset.msgArchive, 'archived'));
      listEl.querySelectorAll('[data-msg-delete]').forEach(btn => btn.onclick = async () => {
        if (!confirm('Delete this message permanently?')) return;
        btn.disabled = true;
        const { error: e2 } = await supabase.from('contact_messages').delete().eq('id', btn.dataset.msgDelete);
        if (e2) {
          btn.disabled = false;
          return flash(panel, 'Delete failed: ' + e2.message);
        }
        await refreshAdminStats();
        loadTab('messages');
      });
    };

    panel.innerHTML = `<div class="admin-section-head">
        <div><h2 class="h-3">Messages</h2><p class="tiny muted" id="message-summary">Loading inbox…</p></div>
        <button id="refresh-messages" type="button" class="btn btn-secondary btn-sm">Refresh</button>
      </div>
      <div class="admin-message-toolbar">
        <label class="admin-search"><span class="sr-only">Search messages</span><input id="message-search" type="search" placeholder="Search name, email or message…" autocomplete="off"></label>
        <label class="admin-status-filter"><span class="sr-only">Filter by status</span><select id="message-status"><option value="all">All messages</option><option value="new">Unread</option><option value="read">Read</option><option value="archived">Archived</option></select></label>
      </div>
      <div class="admin-list admin-message-list" id="message-list" style="margin-top:16px"></div>`;
    const listEl = document.querySelector('#message-list');
    document.querySelector('#refresh-messages').onclick = () => loadTab('messages');
    document.querySelector('#message-search').addEventListener('input', e => paintMessages(e.target.value, document.querySelector('#message-status').value));
    document.querySelector('#message-status').addEventListener('change', e => paintMessages(document.querySelector('#message-search').value, e.target.value));
    paintMessages('', 'all');
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

/* A deploy started in the editor must survive the tab re-render that follows a
   save, so the job id is parked here and picked up by loadTab('articles'). */
let pendingDeploy = null;

/* ---------------------------------------------------------------- publish -- */

/* Saving a published article only writes a row. Its page, canonical, <title>,
   JSON-LD and sitemap entry are static files that a build has to produce and
   commit - otherwise the post exists in the feed and nowhere Google can read.

   requestPublish() asks the content-publish function to start that build. It
   deliberately does NOT claim success: the job row is the truth, and the chip
   below watches it until it says live. */
async function requestPublish(reason, targets) {
  try {
    const { data, error } = await supabase.functions.invoke('content-publish', {
      body: { reason, targets }
    });
    if (error) return { error: error.message };
    if (data?.error) return { error: data.error, job_id: data.job_id };
    return data || {};
  } catch (err) {
    return { error: err?.message || String(err) };
  }
}

/* A deploy is a minute or two of nothing happening. Without visible progress
   people publish twice, which queues a second build for the same article. */
function publishChip(host, jobId, livePath) {
  const chip = document.createElement('div');
  chip.className = 'admin-chip';
  chip.style.marginTop = '12px';
  chip.setAttribute('role', 'status');
  chip.setAttribute('aria-live', 'polite');
  chip.textContent = 'Deploy queued…';
  host.appendChild(chip);

  const labels = {
    queued: 'Deploy queued…',
    running: 'Building pages…',
    deploying: 'Building pages… (deploying)',
    live: 'Live',
    failed: 'Deploy failed',
    skipped: 'Nothing to deploy'
  };
  let ticks = 0;
  const stop = setInterval(async () => {
    ticks += 1;
    const { data } = await supabase.from('publish_jobs')
      .select('status,detail,run_url').eq('id', jobId).maybeSingle();
    if (data) {
      chip.textContent = labels[data.status] || data.status;
      if (data.status === 'live' && livePath) {
        const link = document.createElement('a');
        link.href = livePath;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = ' · Open page';
        chip.appendChild(link);
      }
      if (data.status === 'failed') {
        chip.style.color = 'var(--red)';
        chip.title = data.detail || '';
        if (data.run_url) {
          const link = document.createElement('a');
          link.href = data.run_url;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.textContent = ' · Open build log';
          chip.appendChild(link);
        }
      }
      if (['live', 'failed', 'skipped'].includes(data.status)) clearInterval(stop);
    }
    /* Ten minutes is the whole budget: a deploy that has not said anything by
       then is not going to, and a chip that spins forever is a lie. */
    if (ticks > 120) {
      clearInterval(stop);
      chip.textContent = 'Deploy status unknown - check the Actions tab';
    }
  }, 5000);
  return chip;
}

function articleForm(host, categories, article) {
  const a = article || {title:'',slug:'',summary:'',content:'',status:'draft',category_id:null,published_at:null,scheduled_for:null,featured_image:'',document_url:'',meta_title:'',meta_description:'',og_image:'',canonical_url:'',robots_noindex:false};
  const uid = article ? String(article.id).slice(0, 8) : 'new';
  const id = n => `af-${uid}-${n}`;
  host.innerHTML = `<form id="article-form" class="card card-pad" style="margin-top:18px">
    <div class="preview-head">
      <h3 class="h-3">${article ? 'Edit article' : 'New article'} <span class="unsaved-dot" data-unsaved title="Unsaved changes" hidden></span></h3>
      <span class="tiny muted">Body accepts <strong>Markdown</strong> or HTML</span>
    </div>
    <div class="editor-row-2" style="margin-top:16px">
      <div class="form-field"><label for="${id('title')}">Title (auto-filled from your first heading if left blank)</label><input id="${id('title')}" name="title" value="${esc(a.title)}" placeholder="Or write it here"></div>
      <div class="form-field"><label for="${id('slug')}">Slug</label><input id="${id('slug')}" name="slug" required value="${esc(a.slug)}" placeholder="auto-from-title"></div>
    </div>
    <div class="form-field"><label for="${id('summary')}">Summary</label><textarea id="${id('summary')}" name="summary" rows="3" maxlength="300" placeholder="One or two sentences shown on the article list. Left blank, an excerpt is generated from the body.">${esc(a.summary)}</textarea></div>
    <div class="editor-row-3">
      <div class="form-field"><label for="${id('category')}">Category</label><select id="${id('category')}" name="category_id"><option value="">None</option>${categories.map(c=>`<option value="${esc(c.id)}" ${c.id===a.category_id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div>
      <div class="form-field"><label for="${id('status')}">Status</label><select id="${id('status')}" name="status"><option value="draft" ${a.status==='draft'?'selected':''}>Draft</option><option value="published" ${a.status==='published'?'selected':''}>Published now</option><option value="scheduled" ${a.status==='scheduled'?'selected':''}>Scheduled</option><option value="archived" ${a.status==='archived'?'selected':''}>Archived</option></select></div>
      <div class="form-field"><label for="${id('image')}">Featured image URL</label><input id="${id('image')}" name="featured_image" value="${esc(a.featured_image || '')}" placeholder="https://…"></div>
    </div>
    <div class="form-field" id="${id('schedule-wrap')}" ${a.status === 'scheduled' ? '' : 'hidden'}>
      <label for="${id('scheduled_for')}">Publish at (browser time)</label>
      <input id="${id('scheduled_for')}" name="scheduled_for" type="datetime-local" value="${a.scheduled_for ? new Date(a.scheduled_for).toISOString().slice(0,16) : ''}">
      <p class="tiny muted" style="margin-top:6px">Leave blank to publish at the next 15-minute check. A published article is rebuilt, committed and deployed automatically.</p>
    </div>
    <div class="form-field">
      <label for="${id('doc')}">Attach document (PDF / DOC / DOCX / MD / TXT — max 25 MB)</label>
      <input id="${id('doc')}" name="document" type="file" accept=".pdf,.doc,.docx,.md,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/markdown,text/plain" style="padding:10px">
      <p id="${id('pdf-status')}" class="tiny muted" style="margin-top:6px" aria-live="polite"></p>
      ${documentHref(a.document_url) ? `<p class="tiny" style="margin-top:6px">Attached: <a href="${esc(documentHref(a.document_url))}" target="_blank" rel="noopener noreferrer">view current document</a> &nbsp;<label style="display:inline-flex;gap:6px;align-items:center"><input type="checkbox" name="remove_document"> remove attachment</label></p>`
        : (a.document_url ? `<p class="tiny" style="margin-top:6px;color:var(--red)">This article has an attachment with an unsafe URL (${esc(a.document_url)}). It is not shown to readers — save with “remove attachment” to clear it.</p><label style="display:inline-flex;gap:6px;align-items:center"><input type="checkbox" name="remove_document"> remove attachment</label>` : '<p class="tiny muted" style="margin-top:6px">Optional — readers get a “Download document” button on the article page.</p>')}
    </div>
    <details class="card card-pad" style="margin-top:12px" ${(a.meta_title || a.meta_description || a.og_image || a.canonical_url || a.robots_noindex) ? 'open' : ''}>
      <summary class="h-4" style="cursor:pointer">SEO <span class="tiny muted">— what the search result says. Blank = generated.</span></summary>
      <div class="form-field" style="margin-top:12px">
        <label for="${id('meta_title')}">Meta title <span class="tiny muted" id="${id('meta_title_count')}"></span></label>
        <input id="${id('meta_title')}" name="meta_title" maxlength="70" value="${esc(a.meta_title || '')}" placeholder="Exact <title>. No brand suffix is added when you fill this.">
      </div>
      <div class="form-field">
        <label for="${id('meta_description')}">Meta description <span class="tiny muted" id="${id('meta_description_count')}"></span></label>
        <textarea id="${id('meta_description')}" name="meta_description" rows="3" maxlength="170" placeholder="155–160 characters shows in full on desktop.">${esc(a.meta_description || '')}</textarea>
      </div>
      <div class="editor-row-2">
        <div class="form-field"><label for="${id('og_image')}">Social image URL</label><input id="${id('og_image')}" name="og_image" value="${esc(a.og_image || '')}" placeholder="https://… (1200×630)"></div>
        <div class="form-field"><label for="${id('canonical_url')}">Canonical URL</label><input id="${id('canonical_url')}" name="canonical_url" value="${esc(a.canonical_url || '')}" placeholder="Only when this content lives elsewhere"></div>
      </div>
      <div class="form-field" style="flex-direction:row;align-items:center;gap:8px">
        <input id="${id('noindex')}" name="robots_noindex" type="checkbox" ${a.robots_noindex ? 'checked' : ''} style="width:auto">
        <label for="${id('noindex')}" style="margin:0">Hide from Google (noindex) and drop from the sitemap</label>
      </div>
      <p class="tiny muted">A page that says noindex and appears in the sitemap contradicts itself; the build applies both together.</p>
    </details>
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
    <div data-checklist></div>
    <div class="flex gap-8" style="margin-top:18px"><button class="btn btn-primary" type="submit">Save article</button><button class="btn btn-ghost" type="button" id="cancel-editor">Cancel</button></div>
  </form>`;

  const form = document.querySelector('#article-form');
  const ta = document.querySelector(`#${id('content')}`);
  const titleInput = document.querySelector(`#${id('title')}`);
  const slugInput = document.querySelector(`#${id('slug')}`);
  const preview = document.querySelector('#article-preview');
  const docInput = document.querySelector(`#${id('doc')}`);
  const pdfStatus = document.querySelector(`#${id('pdf-status')}`);
  const statusSelect = document.querySelector(`#${id('status')}`);
  const scheduleWrap = document.querySelector(`#${id('schedule-wrap')}`);
  if (statusSelect && scheduleWrap) {
    statusSelect.addEventListener('change', () => {
      scheduleWrap.hidden = statusSelect.value !== 'scheduled';
    });
  }
  /* A counter, not a limit: something has to tell you that 96 characters of
     title will be cut off in the result. */
  const counter = (fieldName, outId, soft) => {
    const field = document.querySelector(`#${id(fieldName)}`);
    const out = document.querySelector(`#${id(outId)}`);
    if (!field || !out) return;
    const paint = () => {
      const n = String(field.value || '').length;
      out.textContent = `${n}/${soft}`;
      out.style.color = n > soft ? 'var(--red)' : '';
    };
    field.addEventListener('input', paint);
    paint();
  };
  counter('meta_title', 'meta_title_count', 60);
  counter('meta_description', 'meta_description_count', 160);

  let pendingPdfPages = [];
  let pendingPdfObjectUrls = [];

  /* PDF upload is a content import, not merely a file attachment.
     Extract selectable PDF text in the browser and put it directly into the
     article body so authors do not have to manually copy/paste a document.
     PDF.js and its worker are pinned; the admin-only CSP permits blob
     workers and local page-image previews, without enabling unsafe-eval. */
  async function extractPdfText(file) {
    const pdfjs = await import('https://esm.sh/pdfjs-dist@5.4.624/legacy/build/pdf.mjs');
    /* PDF.js 5.x requires an explicit worker source in browser builds.
       Pin the worker to the exact same version as the API module. */
    if (!pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@5.4.624/legacy/build/pdf.worker.mjs';
    }
    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
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

  const clearPendingPdfPages = () => {
    pendingPdfObjectUrls.forEach(url => URL.revokeObjectURL(url));
    pendingPdfObjectUrls = [];
    pendingPdfPages = [];
  };

  async function renderPdfPages(file) {
    const pdfjs = await import('https://esm.sh/pdfjs-dist@5.4.624/legacy/build/pdf.mjs');
    if (!pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@5.4.624/legacy/build/pdf.worker.mjs';
    }
    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
    const pages = [];
    try {
      for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
        const page = await pdf.getPage(pageNo);
        const viewport = page.getViewport({ scale: 1.35 });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext('2d', { alpha: false });
        await page.render({ canvasContext: ctx, viewport }).promise;
        const blob = await new Promise((resolve, reject) =>
          canvas.toBlob(b => b ? resolve(b) : reject(new Error('Could not render PDF page as an image.')), 'image/jpeg', 0.86)
        );
        const objectUrl = URL.createObjectURL(blob);
        pendingPdfObjectUrls.push(objectUrl);
        pages.push({ pageNo, blob, objectUrl });
      }
    } finally {
      try { await pdf.destroy(); } catch {}
    }
    return pages;
  }

  const importPdfContent = async file => {
    if (!file || !file.size || !/\.pdf$/i.test(file.name)) return;
    setPdfStatus('Reading PDF content…');
    try {
      const text = await extractPdfText(file);
      if (!text) {
        setPdfStatus('PDF uploaded, but no selectable text was found. This may be a scanned/image-only PDF; enter the article content manually or add OCR.', 'error');
        return;
      }
      clearPendingPdfPages();
      pendingPdfPages = await renderPdfPages(file);
      /* Never wipe the author's existing text: replace only on explicit
         confirmation, otherwise append the import below a separator. */
      if (ta.value.trim()) {
        if (confirm('Replace the current content with the imported PDF text? (Cancel keeps both: the PDF text is appended at the end.)')) {
          ta.value = text;
        } else {
          ta.value = ta.value.replace(/\s+$/, '') + '\n\n---\n\n' + text;
        }
      } else {
        ta.value = text;
      }
      setDirty(form, true);
      queuePreview();
      setPdfStatus(`Imported ${text.length.toLocaleString()} characters and rendered ${pendingPdfPages.length} PDF page${pendingPdfPages.length === 1 ? '' : 's'} with images. They will be included when you save.`);
    } catch (err) {
      console.error('PDF text extraction failed:', err);
      setPdfStatus(`Could not extract PDF text automatically: ${err?.message || String(err)}. The PDF can still be attached; enter Content manually.`, 'error');
    }
  };

  const paintPreview = () => {
    const title = titleInput.value.trim();
    const pdfVisuals = pendingPdfPages.length
      ? `<div class="pdf-import-preview" style="margin-top:18px"><p class="tiny muted"><strong>PDF page visuals</strong> — images from the uploaded PDF</p>${pendingPdfPages.map(p => `<img src="${esc(p.objectUrl)}" alt="PDF page ${p.pageNo}" loading="lazy" style="display:block;width:100%;height:auto;margin:12px 0;border-radius:8px">`).join('')}</div>`
      : '';
    preview.innerHTML = (title ? `<h1 class="h-1" style="font-size:1.7rem">${esc(title)}</h1>` : '') + renderBody(ta.value) + pdfVisuals + sanitizeNoticeText();
    paintChecklist(form, contentChecklist({ title, slug: slugInput.value, summary: document.querySelector(`#${id('summary')}`).value, body: ta.value, needCategory: true, categoryId: document.querySelector(`#${id('category')}`).value }));
    /* Mirror /articles exactly: the title is the only <h1>, so a "#" heading
       in the body is demoted to <h2> here too. */
    if (window.OMPMarkdown?.demoteHeadings) window.OMPMarkdown.demoteHeadings(preview, 1);
    if (!title && !ta.value.trim()) preview.innerHTML = '<p class="muted">Nothing to preview yet.</p>';
  };
  paintPreview();

  let previewTimer = null;
  const queuePreview = () => { clearTimeout(previewTimer); previewTimer = setTimeout(paintPreview, 180); };
  ta.addEventListener('input', () => {
    setDirty(form, true);
    /* Pasted a full document with its own heading? Offer it as the title
       instead of forcing the author to retype it. */
    if (!titleInput.value.trim() && !slugTouched) {
      const guess = extractTitleFromContent(ta.value);
      if (guess) {
        titleInput.value = guess;
        if (!slugInput.value.trim()) slugInput.value = slugify(guess);
      }
    }
    queuePreview();
  });
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
    clearPendingPdfPages();
    if (!file) { setPdfStatus(''); queuePreview(); return; }
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
    clearPendingPdfPages();
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
    let uploadedDocumentPath = null;
    const uploadedArticleAssetPaths = [];
    submitBtn.disabled = true; submitBtn.textContent = 'Saving…';
    try {
      /* Upload first, but do not create bookkeeping rows until the article
         itself has been persisted. If the DB write fails, immediately remove
         the newly uploaded object so a failed save can never leave an orphan. */
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
        uploadedArticleAssetPaths.push(uploadedDocumentPath);
        uploadedDocumentMeta = {
          file_path: `articles/${uploadedDocumentPath}`,
          public_url: document_url,
          mime_type: v.contentType || file.type || null,
          size_bytes: file.size
        };
      }
      const rawTitle = String(f.get('title') || '').trim();
      /* Title may live inside pasted HTML/Markdown — fall back to the
         body's first heading instead of blocking the save. */
      const title = rawTitle || extractTitleFromContent(f.get('content'));
      if (!title) throw new Error('A title is required — type one above, or start the body with a "# Heading" / <h1>.');
      const slug = slugify(f.get('slug')) || slugify(title);
      if (!slug) throw new Error('A slug is required — add a title or type one in.');
      await assertSlugFree('articles', slug, article?.id);
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
      let content = String(f.get('content') || '').trim();
      /* A PDF is represented in the article as both selectable text and
         rendered page images, so diagrams/photos/layouts are not silently
         lost during import. Upload page images only when the article save
         is actually being submitted. */
      if (pendingPdfPages.length) {
        const pageUrls = [];
        const base = slug || slugify(f.get('title')) || 'article';
        for (const page of pendingPdfPages) {
          const imagePath = `pdf-pages/${base}/${Date.now()}-page-${page.pageNo}.jpg`;
          const { error: imageErr } = await supabase.storage.from('articles').upload(imagePath, page.blob, {
            cacheControl: '31536000',
            upsert: false,
            contentType: 'image/jpeg'
          });
          if (imageErr) throw new Error(`PDF page image upload failed: ${imageErr.message}`);
          uploadedArticleAssetPaths.push(imagePath);
          const { data: imagePublic } = supabase.storage.from('articles').getPublicUrl(imagePath);
          if (!imagePublic?.publicUrl) throw new Error('PDF page image uploaded but no public URL was returned.');
          pageUrls.push(imagePublic.publicUrl);
        }
        content += '\n\n' + pageUrls.map((url, i) => `![PDF page ${i + 1}](${url})`).join('\n\n');
      }
      if (!content) {
        throw new Error(file && file.size
          ? 'PDF/document attached, but no article text was extracted. If this is a scanned/image-only PDF, enter the article content manually.'
          : 'Article content is required.');
      }
      /* Title came from the body heading? Remove that heading so the
         title doesn't render twice on the public page. */
      content = stripExtractedHeading(content, title, !rawTitle);
      /* Scheduling is a promise the cron keeps, so the timestamp is stored in
         UTC and the picker is read as browser-local time (that is what a person
         means when they type 9am). Empty means "as soon as the cron next runs". */
      const scheduledRaw = String(f.get('scheduled_for') || '').trim();
      const scheduledFor = status === 'scheduled'
        ? (scheduledRaw ? new Date(scheduledRaw).toISOString() : new Date().toISOString())
        : null;
      if (status === 'scheduled' && scheduledRaw && Number.isNaN(new Date(scheduledRaw).getTime())) {
        throw new Error('That publish time could not be read - pick a date and time again.');
      }
      /* SEO overrides travel with the row; the build falls back to the generated
         values for any that are blank. */
      const safeHttp = (value) => {
        const raw = String(value || '').trim();
        if (!raw) return null;
        if (!/^https?:\/\//i.test(raw)) throw new Error('Canonical URL and social image must start with http:// or https://.');
        return raw;
      };
      const metaTitle = String(f.get('meta_title') || '').trim().slice(0, 70) || null;
      const metaDescription = String(f.get('meta_description') || '').trim().slice(0, 170) || null;
      const ogImage = safeHttp(f.get('og_image'));
      const canonicalUrl = safeHttp(f.get('canonical_url'));
      const payload = {title,slug,summary:String(f.get('summary') || '').trim().slice(0, 300) || null,content,category_id:f.get('category_id')||null,status,scheduled_for:scheduledFor,featured_image:featured,document_url,meta_title:metaTitle,meta_description:metaDescription,og_image:ogImage,canonical_url:canonicalUrl,robots_noindex:f.get('robots_noindex')==='on',updated_at:new Date().toISOString(),published_at:status==='published'?(a.published_at||new Date().toISOString()):null};
      const result = article
        ? await supabase.from('articles').update(payload).eq('id',article.id)
        : await supabase.from('articles').insert(payload).select('id').single();
      if (result.error) {
        await removeStorageObjects(uploadedArticleAssetPaths.map(path => ({ bucket: 'articles', path })));
        throw result.error;
      }

      /* Bookkeeping is intentionally after the article write. A media-row
         failure must not make a successful article save look failed. */
      if (uploadedDocumentMeta) {
        const { data: { user } } = await supabase.auth.getUser();
        const { error: mediaErr } = await supabase.from('media').insert({
          ...uploadedDocumentMeta,
          uploaded_by: user?.id || null,
          article_id: article?.id || result.data?.id || null
        });
        if (mediaErr) console.warn('media row not recorded:', mediaErr.message);
      }

      /* Publishing is not done until the page exists. Ask for the build, and
         keep the answer where the list can pick it up after it re-renders. */
      if (status === 'published') {
        const started = await requestPublish(`article:${slug}`, [`/articles/${slug}`]);
        if (started.error) {
          flash(form, `Saved, but the deploy could not start: ${started.error}`);
        } else if (started.job_id) {
          pendingDeploy = { jobId: started.job_id, path: `/articles/${slug}` };
        }
      }

      const oldPdfImages = [];
      const oldContent = String(a.content || '');
      const imageUrlPattern = /https?:\/\/[^\\s)"]+\/storage\/v1\/object\/public\/articles\/pdf-pages\/[^\\s)"]+/gi;
      for (const match of oldContent.matchAll(imageUrlPattern)) {
        const loc = bucketPathFromUrl(match[0]);
        if (loc && loc.bucket === 'articles' && loc.path.startsWith('pdf-pages/')) oldPdfImages.push(loc);
      }
      await removeStorageObjects([oldDoc, ...oldPdfImages]);
      clearPendingPdfPages();
      clearDirty(form);
      await refreshAdminStats();
      loadTab('articles');
    } catch (err) {
      if (uploadedArticleAssetPaths.length) {
        await removeStorageObjects(uploadedArticleAssetPaths.map(path => ({ bucket: 'articles', path })));
        uploadedArticleAssetPaths.length = 0;
      }
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
      <div class="form-field"><label for="${id('name')}">Title (auto-filled from your first heading if left blank)</label><input id="${id('name')}" name="name" value="${esc(p.name)}" placeholder="Or write it here"></div>
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
    <div data-checklist></div>
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
    preview.innerHTML = coverHtml + (name ? `<h1 class="h-1" style="font-size:1.7rem">${esc(name)}</h1>` : '') + renderBody(ta.value) + sanitizeNoticeText();
    paintChecklist(form, contentChecklist({ title: name, slug: slugInput.value, summary: document.querySelector(`#${id('summary')}`).value, body: ta.value }));
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
  let uploadedCoverPath = null;
  let uploadedDeliverablePath = null;
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
      uploadedCoverPath = path;
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
      const rawName = String(f.get('name') || '').trim();
      const name = rawName || extractTitleFromContent(f.get('description'));
      if (!name) throw new Error('A title is required — type one, or start the description with a "# Heading" / <h1>.');
      const slug = slugify(f.get('slug')) || slugify(name);
      if (!slug) throw new Error('A slug is required — add a title or type one in.');
      await assertSlugFree('products', slug, product?.id);

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

      /* Track newly-created Storage objects so a failed DB save never
         leaves an orphan behind. */
      const orphans = [];
      const uploadedObjects = [];
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
        uploadedDeliverablePath = path;
        filePath = `product-files/${path}`;
      }

      const status = f.get('status');
      const description = stripExtractedHeading(String(f.get('description') || ''), name, !rawName);
      const payload = {
        name,
        slug,
        summary: String(f.get('summary') || '').trim() || null,
        description,
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
      await refreshAdminStats();
      loadTab('products');
    } catch (err) {
      const cleanup = [];
      if (uploadedCoverPath) cleanup.push({ bucket: 'products', path: uploadedCoverPath });
      if (uploadedDeliverablePath) cleanup.push({ bucket: 'product-files', path: uploadedDeliverablePath });
      if (cleanup.length) await removeStorageObjects(cleanup);
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
  form.querySelectorAll('input, textarea, select').forEach(el => el.addEventListener('input', () => setDirty(form, true)));
  form.querySelectorAll('input, textarea, select').forEach(el => el.addEventListener('change', () => setDirty(form, true)));
  const unsavedHeader = form.querySelector('h3');
  if (unsavedHeader) unsavedHeader.innerHTML += ' <span class="unsaved-dot" data-unsaved title="Unsaved changes" hidden></span>';
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
      clearDirty(form);
      await refreshAdminStats();
      loadTab('tools');
    } catch (err) {
      submitBtn.disabled = false; submitBtn.textContent = 'Save tool';
      flash(form, err?.message || String(err));
    }
  });
}

/* OSINT Hub — categories and tools. Pricing is a single value (radio-like
   select); access_types is a multi-checkbox stored as a Postgres text[].
   Logos upload to the public osint-logos bucket (same pattern as the
   products covers bucket). */
const OSINT_PRICING = [
  { value: 'free', label: 'Free' },
  { value: 'freemium', label: 'Freemium' },
  { value: 'paid', label: 'Paid' }
];
const OSINT_ACCESS = [
  { value: 'web', label: 'Web app' },
  { value: 'cli', label: 'Command line' },
  { value: 'desktop-app', label: 'Desktop app' },
  { value: 'browser-extension', label: 'Browser extension' },
  { value: 'mobile-app', label: 'Mobile app' },
  { value: 'api', label: 'API' }
];

function osintCategoryForm(host, category) {
  const c = category || { name: '', slug: '', description: '', icon: '', sort_order: 0, status: 'draft' };
  const uid = category ? String(category.id).slice(0, 8) : 'new';
  const id = n => `oc-${uid}-${n}`;
  host.innerHTML = `<form id="osint-cat-form" class="card card-pad" style="margin-top:18px">
    <div class="preview-head"><h3 class="h-3">${category ? 'Edit category' : 'New category'} <span class="unsaved-dot" data-unsaved title="Unsaved changes" hidden></span></h3></div>
    <div class="editor-row-2" style="margin-top:16px">
      <div class="form-field"><label for="${id('name')}">Name</label><input id="${id('name')}" name="name" required value="${esc(c.name)}" placeholder="Username OSINT"></div>
      <div class="form-field"><label for="${id('slug')}">Slug</label><input id="${id('slug')}" name="slug" required value="${esc(c.slug)}" placeholder="auto-from-name"></div>
    </div>
    <div class="editor-row-2">
      <div class="form-field"><label for="${id('status')}">Status</label><select id="${id('status')}" name="status"><option value="draft" ${c.status === 'draft' ? 'selected' : ''}>Draft</option><option value="published" ${c.status === 'published' ? 'selected' : ''}>Published</option><option value="archived" ${c.status === 'archived' ? 'selected' : ''}>Archived</option></select></div>
      <div class="form-field"><label for="${id('sort')}">Sort order</label><input id="${id('sort')}" name="sort_order" type="number" value="${Number(c.sort_order) || 0}"></div>
    </div>
    <div class="form-field"><label for="${id('desc')}">Description</label><textarea id="${id('desc')}" name="description" rows="2" maxlength="300">${esc(c.description || '')}</textarea></div>
    <div class="flex gap-8" style="margin-top:18px"><button class="btn btn-primary" type="submit">${category ? 'Save category' : 'Create category'}</button><button class="btn btn-ghost" type="button" id="cancel-osint-cat">Cancel</button></div>
  </form>`;
  const form = document.querySelector('#osint-cat-form');
  const nameInput = document.querySelector(`#${id('name')}`);
  const slugInput = document.querySelector(`#${id('slug')}`);
  form.querySelectorAll('input, textarea, select').forEach(el => el.addEventListener('input', () => setDirty(form, true)));
  form.querySelectorAll('input, textarea, select').forEach(el => el.addEventListener('change', () => setDirty(form, true)));
  let slugTouched = !!(category && category.slug);
  slugInput.addEventListener('input', () => { slugTouched = true; });
  nameInput.addEventListener('input', () => { setDirty(form, true); if (!slugTouched) slugInput.value = slugify(nameInput.value); });
  document.querySelector('#cancel-osint-cat').onclick = () => {
    if (isDirty(form) && !confirm('Discard unsaved changes to this category?')) return;
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
      if (!name) throw new Error('A name is required.');
      const slug = slugify(f.get('slug')) || slugify(name);
      if (!slug) throw new Error('A slug is required.');
      const status = String(f.get('status') || 'draft');
      if (!['draft', 'published', 'archived'].includes(status)) throw new Error('Invalid status.');
      await assertSlugFree('osint_categories', slug, category?.id);
      const payload = {
        name, slug,
        description: String(f.get('description') || '').trim() || null,
        sort_order: Number(f.get('sort_order')) || 0,
        status,
        updated_at: new Date().toISOString(),
        published_at: status === 'published' ? (c.published_at || new Date().toISOString()) : null
      };
      const result = category ? await supabase.from('osint_categories').update(payload).eq('id', category.id) : await supabase.from('osint_categories').insert(payload);
      if (result.error) throw result.error;
      clearDirty(form);
      loadTab('osint');
    } catch (err) {
      submitBtn.disabled = false; submitBtn.textContent = category ? 'Save category' : 'Create category';
      flash(form, err?.message || String(err));
    }
  });
}


function pentestCategoryForm(host, category) {
  const c = category || { name: '', slug: '', description: '', icon: '', sort_order: 0, status: 'draft' };
  const uid = category ? String(category.id).slice(0, 8) : 'new';
  const id = n => `oc-${uid}-${n}`;
  host.innerHTML = `<form id="pentest-cat-form" class="card card-pad" style="margin-top:18px">
    <div class="preview-head"><h3 class="h-3">${category ? 'Edit category' : 'New category'} <span class="unsaved-dot" data-unsaved title="Unsaved changes" hidden></span></h3></div>
    <div class="editor-row-2" style="margin-top:16px">
      <div class="form-field"><label for="${id('name')}">Name</label><input id="${id('name')}" name="name" required value="${esc(c.name)}" placeholder="Username Pentest"></div>
      <div class="form-field"><label for="${id('slug')}">Slug</label><input id="${id('slug')}" name="slug" required value="${esc(c.slug)}" placeholder="auto-from-name"></div>
    </div>
    <div class="editor-row-2">
      <div class="form-field"><label for="${id('status')}">Status</label><select id="${id('status')}" name="status"><option value="draft" ${c.status === 'draft' ? 'selected' : ''}>Draft</option><option value="published" ${c.status === 'published' ? 'selected' : ''}>Published</option><option value="archived" ${c.status === 'archived' ? 'selected' : ''}>Archived</option></select></div>
      <div class="form-field"><label for="${id('sort')}">Sort order</label><input id="${id('sort')}" name="sort_order" type="number" value="${Number(c.sort_order) || 0}"></div>
    </div>
    <div class="form-field"><label for="${id('desc')}">Description</label><textarea id="${id('desc')}" name="description" rows="2" maxlength="300">${esc(c.description || '')}</textarea></div>
    <div class="flex gap-8" style="margin-top:18px"><button class="btn btn-primary" type="submit">${category ? 'Save category' : 'Create category'}</button><button class="btn btn-ghost" type="button" id="cancel-pentest-cat">Cancel</button></div>
  </form>`;
  const form = document.querySelector('#pentest-cat-form');
  const nameInput = document.querySelector(`#${id('name')}`);
  const slugInput = document.querySelector(`#${id('slug')}`);
  form.querySelectorAll('input, textarea, select').forEach(el => el.addEventListener('input', () => setDirty(form, true)));
  form.querySelectorAll('input, textarea, select').forEach(el => el.addEventListener('change', () => setDirty(form, true)));
  let slugTouched = !!(category && category.slug);
  slugInput.addEventListener('input', () => { slugTouched = true; });
  nameInput.addEventListener('input', () => { setDirty(form, true); if (!slugTouched) slugInput.value = slugify(nameInput.value); });
  document.querySelector('#cancel-pentest-cat').onclick = () => {
    if (isDirty(form) && !confirm('Discard unsaved changes to this category?')) return;
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
      if (!name) throw new Error('A name is required.');
      const slug = slugify(f.get('slug')) || slugify(name);
      if (!slug) throw new Error('A slug is required.');
      const status = String(f.get('status') || 'draft');
      if (!['draft', 'published', 'archived'].includes(status)) throw new Error('Invalid status.');
      await assertSlugFree('pentest_categories', slug, category?.id);
      const payload = {
        name, slug,
        description: String(f.get('description') || '').trim() || null,
        sort_order: Number(f.get('sort_order')) || 0,
        status,
        updated_at: new Date().toISOString(),
        published_at: status === 'published' ? (c.published_at || new Date().toISOString()) : null
      };
      const result = category ? await supabase.from('pentest_categories').update(payload).eq('id', category.id) : await supabase.from('pentest_categories').insert(payload);
      if (result.error) throw result.error;
      clearDirty(form);
      loadTab('pentest');
    } catch (err) {
      submitBtn.disabled = false; submitBtn.textContent = category ? 'Save category' : 'Create category';
      flash(form, err?.message || String(err));
    }
  });
}

function osintToolForm(host, categories, tool) {
  const t = tool || { name: '', slug: '', summary: '', overview: '', install_guide: '', category_id: null, pricing: 'free', access_types: ['web'], official_url: '', github_url: '', docs_url: '', logo_url: '', featured: false, status: 'draft', sort_order: 0 };
  const uid = tool ? String(tool.id).slice(0, 8) : 'new';
  const id = n => `ot-${uid}-${n}`;
  const access = Array.isArray(t.access_types) && t.access_types.length ? t.access_types : ['web'];
  host.innerHTML = `<form id="osint-tool-form" class="card card-pad" style="margin-top:18px">
    <div class="preview-head">
      <h3 class="h-3">${tool ? 'Edit OSINT tool' : 'New OSINT tool'} <span class="unsaved-dot" data-unsaved title="Unsaved changes" hidden></span></h3>
      <span class="tiny muted">Overview + install accept <strong>Markdown</strong> or HTML</span>
    </div>
    <div class="editor-row-2" style="margin-top:16px">
      <div class="form-field"><label for="${id('name')}">Name (auto-filled from your first heading if left blank)</label><input id="${id('name')}" name="name" value="${esc(t.name)}" placeholder="Sherlock"></div>
      <div class="form-field"><label for="${id('slug')}">Slug (public URL: /osint/&lt;slug&gt;)</label><input id="${id('slug')}" name="slug" required value="${esc(t.slug)}" placeholder="auto-from-name"></div>
    </div>
    <div class="editor-row-3" style="margin-top:4px">
      <div class="form-field"><label for="${id('cat')}">Category</label><select id="${id('cat')}" name="category_id"><option value="">Uncategorized</option>${categories.map(c => `<option value="${esc(c.id)}" ${String(c.id) === String(t.category_id) ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
      <div class="form-field"><label for="${id('pricing')}">Pricing</label><select id="${id('pricing')}" name="pricing">${OSINT_PRICING.map(p => `<option value="${p.value}" ${t.pricing === p.value ? 'selected' : ''}>${p.label}</option>`).join('')}</select></div>
      <div class="form-field"><label for="${id('status')}">Status</label><select id="${id('status')}" name="status"><option value="draft" ${t.status === 'draft' ? 'selected' : ''}>Draft</option><option value="published" ${t.status === 'published' ? 'selected' : ''}>Published</option><option value="archived" ${t.status === 'archived' ? 'selected' : ''}>Archived</option></select></div>
    </div>
    <fieldset style="margin-top:12px;border:1px solid var(--border);border-radius:var(--radius);padding:12px 14px"><legend class="tiny muted" style="padding:0 6px">Access — how the tool runs (pick all that apply)</legend>
      <div class="flex gap-12 wrap">${OSINT_ACCESS.map(a => `<label style="display:inline-flex;gap:6px;align-items:center;font-size:.9rem"><input type="checkbox" name="access_${a.value}" ${access.includes(a.value) ? 'checked' : ''}> ${a.label}</label>`).join('')}</div>
    </fieldset>
    <div class="opt-row" style="margin-top:12px"><div><div class="opt-name">Featured</div><div class="opt-desc">Pin this tool to the Featured row on /osint.</div></div><span class="switch"><input name="featured" type="checkbox" aria-label="Featured" ${t.featured ? 'checked' : ''}><span class="track"></span></span></div>
    <div class="editor-row-3" style="margin-top:12px">
      <div class="form-field"><label for="${id('official')}">Official site URL</label><input id="${id('official')}" name="official_url" type="url" inputmode="url" value="${esc(t.official_url || '')}" placeholder="https://…"></div>
      <div class="form-field"><label for="${id('github')}">GitHub URL</label><input id="${id('github')}" name="github_url" type="url" inputmode="url" value="${esc(t.github_url || '')}" placeholder="https://github.com/…"></div>
      <div class="form-field"><label for="${id('docs')}">Docs URL</label><input id="${id('docs')}" name="docs_url" type="url" inputmode="url" value="${esc(t.docs_url || '')}" placeholder="https://…"></div>
    </div>
    <div class="form-field" style="margin-top:4px">
      <label for="${id('logo')}">Logo image URL</label>
      <input id="${id('logo')}" name="logo_url" value="${esc(t.logo_url || '')}" placeholder="https://… or upload below">
      <input id="${id('logo-file')}" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,.png,.jpg,.jpeg,.webp,.gif,.svg" style="margin-top:8px;padding:8px" aria-label="Upload logo image">
      <div id="${id('logo-preview')}" class="product-cover" style="max-width:200px;max-height:120px;margin-top:10px;border-radius:var(--radius);overflow:hidden" hidden></div>
      <p class="tiny muted" style="margin-top:6px">PNG/JPG/WebP/GIF/SVG up to 5 MB — uploaded to the public <code>osint-logos</code> bucket.</p>
    </div>
    <div class="form-field" style="margin-top:4px"><label for="${id('summary')}">Short summary (cards + search, max 300)</label><textarea id="${id('summary')}" name="summary" rows="2" maxlength="300">${esc(t.summary || '')}</textarea></div>
    <div class="editor-grid" style="margin-top:8px">
      <div class="editor-fields">
        <label for="${id('overview')}">Overview</label>
        <div class="toolbar" role="toolbar" aria-label="Formatting" aria-controls="${id('overview')}">${TOOLBAR.map((x, i) => `<button type="button" data-mk="${i}" title="${esc(x.title)}" aria-label="${esc(x.title)}">${esc(x.label)}</button>`).join('')}</div>
        <textarea id="${id('overview')}" name="overview" class="body-editor" rows="10" spellcheck="true">${esc(t.overview || '')}</textarea>
        <label for="${id('install')}" style="margin-top:14px">Install &amp; first run (code blocks get a Copy button)</label>
        <textarea id="${id('install')}" name="install_guide" class="body-editor" rows="8" spellcheck="false" placeholder="Paste install commands — fenced code blocks render with a copy button. Web-only tools: write 2-3 numbered steps instead.">${esc(t.install_guide || '')}</textarea>
        <label for="${id('features')}" style="margin-top:14px">Key features (one per line — use "* " bullets)</label>
        <textarea id="${id('features')}" name="key_features" class="body-editor" rows="6" spellcheck="true" placeholder="* First standout capability&#10;* Second standout capability">${esc(t.key_features || '')}</textarea>
        <label for="${id('faqs')}" style="margin-top:14px">Common questions (each question as "### " heading, answer below it)</label>
        <textarea id="${id('faqs')}" name="faqs" class="body-editor" rows="8" spellcheck="true" placeholder="### Is this tool free?&#10;Yes — …&#10;&#10;### How do I install it?&#10;…">${esc(t.faqs || '')}</textarea>
        <label for="${id('usecase')}" style="margin-top:14px">Real-world example (a concrete lawful scenario, 100-150 words)</label>
        <textarea id="${id('usecase')}" name="use_case" class="body-editor" rows="8" spellcheck="true" placeholder="A marketplace seller contacts you on Telegram… Before sending money, run the handle through…">${esc(t.use_case || '')}</textarea>
      </div>
      <div>
        <div class="preview-head"><span class="tiny muted"><strong>Live preview</strong> — exactly what /osint renders</span><button type="button" class="btn btn-ghost btn-sm" id="refresh-osint-preview">Refresh</button></div>
        <div class="preview-frame" style="padding:20px;overflow:auto"><div class="prose" id="osint-preview" style="max-width:none"></div></div>
      </div>
    </div>
    <div class="form-field" style="margin-top:12px;max-width:200px"><label for="${id('sort')}">Sort order</label><input id="${id('sort')}" name="sort_order" type="number" value="${Number(t.sort_order) || 0}"></div>
    <div data-checklist></div>
    <div class="flex gap-8" style="margin-top:18px"><button class="btn btn-primary" type="submit">${tool ? 'Save tool' : 'Create tool'}</button><button class="btn btn-ghost" type="button" id="cancel-osint-tool">Cancel</button></div>
  </form>`;

  const form = document.querySelector('#osint-tool-form');
  const nameInput = document.querySelector(`#${id('name')}`);
  const slugInput = document.querySelector(`#${id('slug')}`);
  const logoInput = document.querySelector(`#${id('logo')}`);
  const logoPreview = document.querySelector(`#${id('logo-preview')}`);
  const overviewTa = document.querySelector(`#${id('overview')}`);
  const installTa = document.querySelector(`#${id('install')}`);
  const featuresTa = document.querySelector(`#${id('features')}`);
  const faqsTa = document.querySelector(`#${id('faqs')}`);
  const useCaseTa = document.querySelector(`#${id('usecase')}`);
  const preview = document.querySelector('#osint-preview');

  const logoSrc = raw => {
    const v = String(raw || '').trim();
    if (!v) return '';
    if (window.OMPUrl?.safeUrl) return window.OMPUrl.safeUrl(v, { attrSafe: true }) || '';
    return /^(https?:|\/)/i.test(v) ? v : '';
  };
  const paintLogo = () => {
    const src = logoSrc(logoInput.value);
    if (!src) { logoPreview.hidden = true; logoPreview.replaceChildren(); return; }
    logoPreview.hidden = false;
    logoPreview.innerHTML = `<img src="${esc(src)}" alt="Logo preview" style="width:100%;height:100%;object-fit:contain">`;
  };
  const paintPreview = () => {
    const name = nameInput.value.trim();
    preview.innerHTML = (name ? `<h1 class="h-1" style="font-size:1.7rem">${esc(name)}</h1>` : '') + renderBody(overviewTa.value) + (featuresTa.value.trim() ? `<h2>Key features</h2>` + renderBody(featuresTa.value) : '') + (installTa.value.trim() ? `<h2>Install &amp; first run</h2>` + renderBody(installTa.value) : '') + (useCaseTa.value.trim() ? `<h2>Real-world example</h2>` + renderBody(useCaseTa.value) : '') + (faqsTa.value.trim() ? `<h2>Common questions</h2>` + renderBody(faqsTa.value) : '') + sanitizeNoticeText();
    paintChecklist(form, contentChecklist({ title: name, slug: slugInput.value, summary: document.querySelector(`#${id('summary')}`).value, body: overviewTa.value, needCategory: true, categoryId: document.querySelector(`#${id('cat')}`).value }));
    if (window.OMPMarkdown?.demoteHeadings) window.OMPMarkdown.demoteHeadings(preview, 1);
    if (!name && !overviewTa.value.trim() && !installTa.value.trim() && !featuresTa.value.trim() && !faqsTa.value.trim() && !useCaseTa.value.trim()) preview.innerHTML = '<p class="muted">Nothing to preview yet.</p>';
  };
  paintLogo();
  paintPreview();
  let previewTimer = null;
  const queuePreview = () => { clearTimeout(previewTimer); previewTimer = setTimeout(paintPreview, 180); };
  [overviewTa, installTa, featuresTa, faqsTa, useCaseTa].forEach(ta => {
    ta.addEventListener('input', () => { setDirty(form, true); queuePreview(); });
  });
  form.querySelectorAll('.toolbar [data-mk]').forEach(btn => btn.onclick = () => applyMarkup(overviewTa, TOOLBAR[Number(btn.dataset.mk)]));
  logoInput.addEventListener('input', () => { setDirty(form, true); paintLogo(); });
  form.querySelectorAll('input, textarea, select').forEach(el => el.addEventListener('change', () => setDirty(form, true)));
  document.querySelector('#refresh-osint-preview').onclick = paintPreview;

  let slugTouched = !!(tool && tool.slug);
  slugInput.addEventListener('input', () => { slugTouched = true; });
  nameInput.addEventListener('input', () => {
    setDirty(form, true);
    if (!slugTouched) slugInput.value = slugify(nameInput.value);
    queuePreview();
  });

  let uploadedLogoPath = null;
  document.querySelector(`#${id('logo-file')}`).addEventListener('change', async e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const v = window.OMPFileValidate
        ? await window.OMPFileValidate.validateImage(file)
        : (() => {
            if (!/^image\/(png|jpe?g|webp|gif|svg\+xml)$/i.test(file.type)) throw new Error('Logo must be a PNG, JPG, WebP, GIF or SVG image.');
            if (file.size > 5 * 1024 * 1024) throw new Error('Logo image is larger than the 5 MB limit.');
            return { ok: true, contentType: file.type };
          })();
      if (!v || !v.ok) throw new Error((v && v.error) || 'Logo image validation failed.');
      const safeName = String(file.name).replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `logos/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from('osint-logos').upload(path, file, {
        cacheControl: '3600', upsert: false, contentType: v.contentType || file.type
      });
      if (upErr) throw new Error(`Upload failed: ${upErr.message}`);
      uploadedLogoPath = path;
      const { data: pub } = supabase.storage.from('osint-logos').getPublicUrl(path);
      if (!pub?.publicUrl) throw new Error('Upload succeeded but no public URL was returned.');
      logoInput.value = pub.publicUrl;
      setDirty(form, true);
      paintLogo();
      flash(form, 'Logo uploaded — remember to save.');
    } catch (err) {
      flash(form, err?.message || String(err));
    }
  });

  document.querySelector('#cancel-osint-tool').onclick = () => {
    if (isDirty(form) && !confirm('Discard unsaved changes to this tool?')) return;
    dirtyForms.delete(form);
    host.innerHTML = '';
  };

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    const f = new FormData(e.currentTarget);
    submitBtn.disabled = true; submitBtn.textContent = 'Saving…';
    try {
      const name = String(f.get('name') || '').trim() || extractTitleFromContent(f.get('overview'));
      if (!name) throw new Error('A name is required — type one, or start the overview with a "# Heading" / <h1>.');
      const slug = slugify(f.get('slug')) || slugify(name);
      if (!slug) throw new Error('A slug is required.');
      await assertSlugFree('osint_tools', slug, tool?.id);
      const absUrl = raw => {
        const v = String(raw || '').trim();
        if (!v) return null;
        const safe = window.OMPUrl ? window.OMPUrl.safeUrl(v, { allowMailto: false }) : (/^https?:\/\//i.test(v) ? v : null);
        if (safe === null) throw new Error(`URL must be a full http(s) URL: ${v.slice(0, 60)}`);
        if (!/^https?:\/\//i.test(safe)) throw new Error('Links must be absolute http(s) URLs (they open in a new tab).');
        return safe;
      };
      const rawLogo = String(f.get('logo_url') || '').trim();
      const logo = rawLogo ? (window.OMPUrl ? window.OMPUrl.safeUrl(rawLogo) : (/^(https?:|\/)/i.test(rawLogo) ? rawLogo : null)) : null;
      if (logo === null && rawLogo) throw new Error('Logo URL must be an http(s) or site-relative URL.');
      const access = OSINT_ACCESS.map(a => a.value).filter(v => f.get(`access_${v}`) === 'on');
      if (!access.length) throw new Error('Pick at least one access type (Web app, Command line, …).');
      const pricing = String(f.get('pricing') || 'free');
      if (!OSINT_PRICING.some(p => p.value === pricing)) throw new Error('Invalid pricing.');
      const status = String(f.get('status') || 'draft');
      if (!['draft', 'published', 'archived'].includes(status)) throw new Error('Invalid status.');
      const catId = String(f.get('category_id') || '').trim() || null;
      if (catId && !categories.some(c => String(c.id) === catId)) throw new Error('Unknown category.');
      const orphans = [];
      const previousLogo = bucketPathFromUrl(t.logo_url);
      if (previousLogo && previousLogo.bucket === 'osint-logos') orphans.push(previousLogo);
      const payload = {
        name, slug,
        summary: String(f.get('summary') || '').trim().slice(0, 300) || null,
        overview: stripExtractedHeading(String(f.get('overview') || ''), name, !String(f.get('name') || '').trim()),
        install_guide: String(f.get('install_guide') || ''),
        key_features: String(f.get('key_features') || ''),
        faqs: String(f.get('faqs') || ''),
        use_case: String(f.get('use_case') || ''),
        category_id: catId,
        pricing, access_types: access,
        official_url: absUrl(f.get('official_url')),
        github_url: absUrl(f.get('github_url')),
        docs_url: absUrl(f.get('docs_url')),
        logo_url: logo,
        featured: f.get('featured') === 'on',
        status,
        sort_order: Number(f.get('sort_order')) || 0,
        updated_at: new Date().toISOString(),
        published_at: status === 'published' ? (t.published_at || new Date().toISOString()) : null
      };
      const result = tool ? await supabase.from('osint_tools').update(payload).eq('id', tool.id) : await supabase.from('osint_tools').insert(payload);
      if (result.error) throw result.error;
      if (logo === (t.logo_url || null)) {
        for (let i = orphans.length - 1; i >= 0; i--) {
          if (orphans[i] === previousLogo) orphans.splice(i, 1);
        }
      }
      await removeStorageObjects(orphans);
      clearDirty(form);
      loadTab('osint');
    } catch (err) {
      if (uploadedLogoPath) await removeStorageObjects([{ bucket: 'osint-logos', path: uploadedLogoPath }]);
      submitBtn.disabled = false; submitBtn.textContent = tool ? 'Save tool' : 'Create tool';
      flash(form, err?.message || String(err));
    }
  });
}

function pentestToolForm(host, categories, tool) {
  const t = tool || { name: '', slug: '', summary: '', overview: '', install_guide: '', category_id: null, pricing: 'free', access_types: ['web'], official_url: '', github_url: '', docs_url: '', logo_url: '', featured: false, status: 'draft', sort_order: 0 };
  const uid = tool ? String(tool.id).slice(0, 8) : 'new';
  const id = n => `ot-${uid}-${n}`;
  const access = Array.isArray(t.access_types) && t.access_types.length ? t.access_types : ['web'];
  host.innerHTML = `<form id="pentest-tool-form" class="card card-pad" style="margin-top:18px">
    <div class="preview-head">
      <h3 class="h-3">${tool ? 'Edit Pentest tool' : 'New Pentest tool'} <span class="unsaved-dot" data-unsaved title="Unsaved changes" hidden></span></h3>
      <span class="tiny muted">Overview + install accept <strong>Markdown</strong> or HTML</span>
    </div>
    <div class="editor-row-2" style="margin-top:16px">
      <div class="form-field"><label for="${id('name')}">Name (auto-filled from your first heading if left blank)</label><input id="${id('name')}" name="name" value="${esc(t.name)}" placeholder="Sherlock"></div>
      <div class="form-field"><label for="${id('slug')}">Slug (public URL: /pentest/&lt;slug&gt;)</label><input id="${id('slug')}" name="slug" required value="${esc(t.slug)}" placeholder="auto-from-name"></div>
    </div>
    <div class="editor-row-3" style="margin-top:4px">
      <div class="form-field"><label for="${id('cat')}">Category</label><select id="${id('cat')}" name="category_id"><option value="">Uncategorized</option>${categories.map(c => `<option value="${esc(c.id)}" ${String(c.id) === String(t.category_id) ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
      <div class="form-field"><label for="${id('pricing')}">Pricing</label><select id="${id('pricing')}" name="pricing">${Pentest_PRICING.map(p => `<option value="${p.value}" ${t.pricing === p.value ? 'selected' : ''}>${p.label}</option>`).join('')}</select></div>
      <div class="form-field"><label for="${id('status')}">Status</label><select id="${id('status')}" name="status"><option value="draft" ${t.status === 'draft' ? 'selected' : ''}>Draft</option><option value="published" ${t.status === 'published' ? 'selected' : ''}>Published</option><option value="archived" ${t.status === 'archived' ? 'selected' : ''}>Archived</option></select></div>
    </div>
    <fieldset style="margin-top:12px;border:1px solid var(--border);border-radius:var(--radius);padding:12px 14px"><legend class="tiny muted" style="padding:0 6px">Access — how the tool runs (pick all that apply)</legend>
      <div class="flex gap-12 wrap">${Pentest_ACCESS.map(a => `<label style="display:inline-flex;gap:6px;align-items:center;font-size:.9rem"><input type="checkbox" name="access_${a.value}" ${access.includes(a.value) ? 'checked' : ''}> ${a.label}</label>`).join('')}</div>
    </fieldset>
    <div class="opt-row" style="margin-top:12px"><div><div class="opt-name">Featured</div><div class="opt-desc">Pin this tool to the Featured row on /pentest.</div></div><span class="switch"><input name="featured" type="checkbox" aria-label="Featured" ${t.featured ? 'checked' : ''}><span class="track"></span></span></div>
    <div class="editor-row-3" style="margin-top:12px">
      <div class="form-field"><label for="${id('official')}">Official site URL</label><input id="${id('official')}" name="official_url" type="url" inputmode="url" value="${esc(t.official_url || '')}" placeholder="https://…"></div>
      <div class="form-field"><label for="${id('github')}">GitHub URL</label><input id="${id('github')}" name="github_url" type="url" inputmode="url" value="${esc(t.github_url || '')}" placeholder="https://github.com/…"></div>
      <div class="form-field"><label for="${id('docs')}">Docs URL</label><input id="${id('docs')}" name="docs_url" type="url" inputmode="url" value="${esc(t.docs_url || '')}" placeholder="https://…"></div>
    </div>
    <div class="form-field" style="margin-top:4px">
      <label for="${id('logo')}">Logo image URL</label>
      <input id="${id('logo')}" name="logo_url" value="${esc(t.logo_url || '')}" placeholder="https://… or upload below">
      <input id="${id('logo-file')}" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,.png,.jpg,.jpeg,.webp,.gif,.svg" style="margin-top:8px;padding:8px" aria-label="Upload logo image">
      <div id="${id('logo-preview')}" class="product-cover" style="max-width:200px;max-height:120px;margin-top:10px;border-radius:var(--radius);overflow:hidden" hidden></div>
      <p class="tiny muted" style="margin-top:6px">PNG/JPG/WebP/GIF/SVG up to 5 MB — uploaded to the public <code>pentest-logos</code> bucket.</p>
    </div>
    <div class="form-field" style="margin-top:4px"><label for="${id('summary')}">Short summary (cards + search, max 300)</label><textarea id="${id('summary')}" name="summary" rows="2" maxlength="300">${esc(t.summary || '')}</textarea></div>
    <div class="editor-grid" style="margin-top:8px">
      <div class="editor-fields">
        <label for="${id('overview')}">Overview</label>
        <div class="toolbar" role="toolbar" aria-label="Formatting" aria-controls="${id('overview')}">${TOOLBAR.map((x, i) => `<button type="button" data-mk="${i}" title="${esc(x.title)}" aria-label="${esc(x.title)}">${esc(x.label)}</button>`).join('')}</div>
        <textarea id="${id('overview')}" name="overview" class="body-editor" rows="10" spellcheck="true">${esc(t.overview || '')}</textarea>
        <label for="${id('install')}" style="margin-top:14px">Install &amp; first run (code blocks get a Copy button)</label>
        <textarea id="${id('install')}" name="install_guide" class="body-editor" rows="8" spellcheck="false" placeholder="Paste install commands — fenced code blocks render with a copy button. Web-only tools: write 2-3 numbered steps instead.">${esc(t.install_guide || '')}</textarea>
        <label for="${id('features')}" style="margin-top:14px">Key features (one per line — use "* " bullets)</label>
        <textarea id="${id('features')}" name="key_features" class="body-editor" rows="6" spellcheck="true" placeholder="* First standout capability&#10;* Second standout capability">${esc(t.key_features || '')}</textarea>
        <label for="${id('faqs')}" style="margin-top:14px">Common questions (each question as "### " heading, answer below it)</label>
        <textarea id="${id('faqs')}" name="faqs" class="body-editor" rows="8" spellcheck="true" placeholder="### Is this tool free?&#10;Yes — …&#10;&#10;### How do I install it?&#10;…">${esc(t.faqs || '')}</textarea>
        <label for="${id('usecase')}" style="margin-top:14px">Real-world example (a concrete lawful scenario, 100-150 words)</label>
        <textarea id="${id('usecase')}" name="use_case" class="body-editor" rows="8" spellcheck="true" placeholder="A marketplace seller contacts you on Telegram… Before sending money, run the handle through…">${esc(t.use_case || '')}</textarea>
      </div>
      <div>
        <div class="preview-head"><span class="tiny muted"><strong>Live preview</strong> — exactly what /pentest renders</span><button type="button" class="btn btn-ghost btn-sm" id="refresh-pentest-preview">Refresh</button></div>
        <div class="preview-frame" style="padding:20px;overflow:auto"><div class="prose" id="pentest-preview" style="max-width:none"></div></div>
      </div>
    </div>
    <div class="form-field" style="margin-top:12px;max-width:200px"><label for="${id('sort')}">Sort order</label><input id="${id('sort')}" name="sort_order" type="number" value="${Number(t.sort_order) || 0}"></div>
    <div data-checklist></div>
    <div class="flex gap-8" style="margin-top:18px"><button class="btn btn-primary" type="submit">${tool ? 'Save tool' : 'Create tool'}</button><button class="btn btn-ghost" type="button" id="cancel-pentest-tool">Cancel</button></div>
  </form>`;

  const form = document.querySelector('#pentest-tool-form');
  const nameInput = document.querySelector(`#${id('name')}`);
  const slugInput = document.querySelector(`#${id('slug')}`);
  const logoInput = document.querySelector(`#${id('logo')}`);
  const logoPreview = document.querySelector(`#${id('logo-preview')}`);
  const overviewTa = document.querySelector(`#${id('overview')}`);
  const installTa = document.querySelector(`#${id('install')}`);
  const featuresTa = document.querySelector(`#${id('features')}`);
  const faqsTa = document.querySelector(`#${id('faqs')}`);
  const useCaseTa = document.querySelector(`#${id('usecase')}`);
  const preview = document.querySelector('#pentest-preview');

  const logoSrc = raw => {
    const v = String(raw || '').trim();
    if (!v) return '';
    if (window.OMPUrl?.safeUrl) return window.OMPUrl.safeUrl(v, { attrSafe: true }) || '';
    return /^(https?:|\/)/i.test(v) ? v : '';
  };
  const paintLogo = () => {
    const src = logoSrc(logoInput.value);
    if (!src) { logoPreview.hidden = true; logoPreview.replaceChildren(); return; }
    logoPreview.hidden = false;
    logoPreview.innerHTML = `<img src="${esc(src)}" alt="Logo preview" style="width:100%;height:100%;object-fit:contain">`;
  };
  const paintPreview = () => {
    const name = nameInput.value.trim();
    preview.innerHTML = (name ? `<h1 class="h-1" style="font-size:1.7rem">${esc(name)}</h1>` : '') + renderBody(overviewTa.value) + (featuresTa.value.trim() ? `<h2>Key features</h2>` + renderBody(featuresTa.value) : '') + (installTa.value.trim() ? `<h2>Install &amp; first run</h2>` + renderBody(installTa.value) : '') + (useCaseTa.value.trim() ? `<h2>Real-world example</h2>` + renderBody(useCaseTa.value) : '') + (faqsTa.value.trim() ? `<h2>Common questions</h2>` + renderBody(faqsTa.value) : '') + sanitizeNoticeText();
    paintChecklist(form, contentChecklist({ title: name, slug: slugInput.value, summary: document.querySelector(`#${id('summary')}`).value, body: overviewTa.value, needCategory: true, categoryId: document.querySelector(`#${id('cat')}`).value }));
    if (window.OMPMarkdown?.demoteHeadings) window.OMPMarkdown.demoteHeadings(preview, 1);
    if (!name && !overviewTa.value.trim() && !installTa.value.trim() && !featuresTa.value.trim() && !faqsTa.value.trim() && !useCaseTa.value.trim()) preview.innerHTML = '<p class="muted">Nothing to preview yet.</p>';
  };
  paintLogo();
  paintPreview();
  let previewTimer = null;
  const queuePreview = () => { clearTimeout(previewTimer); previewTimer = setTimeout(paintPreview, 180); };
  [overviewTa, installTa, featuresTa, faqsTa, useCaseTa].forEach(ta => {
    ta.addEventListener('input', () => { setDirty(form, true); queuePreview(); });
  });
  form.querySelectorAll('.toolbar [data-mk]').forEach(btn => btn.onclick = () => applyMarkup(overviewTa, TOOLBAR[Number(btn.dataset.mk)]));
  logoInput.addEventListener('input', () => { setDirty(form, true); paintLogo(); });
  form.querySelectorAll('input, textarea, select').forEach(el => el.addEventListener('change', () => setDirty(form, true)));
  document.querySelector('#refresh-pentest-preview').onclick = paintPreview;

  let slugTouched = !!(tool && tool.slug);
  slugInput.addEventListener('input', () => { slugTouched = true; });
  nameInput.addEventListener('input', () => {
    setDirty(form, true);
    if (!slugTouched) slugInput.value = slugify(nameInput.value);
    queuePreview();
  });

  let uploadedLogoPath = null;
  document.querySelector(`#${id('logo-file')}`).addEventListener('change', async e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const v = window.OMPFileValidate
        ? await window.OMPFileValidate.validateImage(file)
        : (() => {
            if (!/^image\/(png|jpe?g|webp|gif|svg\+xml)$/i.test(file.type)) throw new Error('Logo must be a PNG, JPG, WebP, GIF or SVG image.');
            if (file.size > 5 * 1024 * 1024) throw new Error('Logo image is larger than the 5 MB limit.');
            return { ok: true, contentType: file.type };
          })();
      if (!v || !v.ok) throw new Error((v && v.error) || 'Logo image validation failed.');
      const safeName = String(file.name).replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `logos/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from('pentest-logos').upload(path, file, {
        cacheControl: '3600', upsert: false, contentType: v.contentType || file.type
      });
      if (upErr) throw new Error(`Upload failed: ${upErr.message}`);
      uploadedLogoPath = path;
      const { data: pub } = supabase.storage.from('pentest-logos').getPublicUrl(path);
      if (!pub?.publicUrl) throw new Error('Upload succeeded but no public URL was returned.');
      logoInput.value = pub.publicUrl;
      setDirty(form, true);
      paintLogo();
      flash(form, 'Logo uploaded — remember to save.');
    } catch (err) {
      flash(form, err?.message || String(err));
    }
  });

  document.querySelector('#cancel-pentest-tool').onclick = () => {
    if (isDirty(form) && !confirm('Discard unsaved changes to this tool?')) return;
    dirtyForms.delete(form);
    host.innerHTML = '';
  };

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    const f = new FormData(e.currentTarget);
    submitBtn.disabled = true; submitBtn.textContent = 'Saving…';
    try {
      const name = String(f.get('name') || '').trim() || extractTitleFromContent(f.get('overview'));
      if (!name) throw new Error('A name is required — type one, or start the overview with a "# Heading" / <h1>.');
      const slug = slugify(f.get('slug')) || slugify(name);
      if (!slug) throw new Error('A slug is required.');
      await assertSlugFree('pentest_tools', slug, tool?.id);
      const absUrl = raw => {
        const v = String(raw || '').trim();
        if (!v) return null;
        const safe = window.OMPUrl ? window.OMPUrl.safeUrl(v, { allowMailto: false }) : (/^https?:\/\//i.test(v) ? v : null);
        if (safe === null) throw new Error(`URL must be a full http(s) URL: ${v.slice(0, 60)}`);
        if (!/^https?:\/\//i.test(safe)) throw new Error('Links must be absolute http(s) URLs (they open in a new tab).');
        return safe;
      };
      const rawLogo = String(f.get('logo_url') || '').trim();
      const logo = rawLogo ? (window.OMPUrl ? window.OMPUrl.safeUrl(rawLogo) : (/^(https?:|\/)/i.test(rawLogo) ? rawLogo : null)) : null;
      if (logo === null && rawLogo) throw new Error('Logo URL must be an http(s) or site-relative URL.');
      const access = Pentest_ACCESS.map(a => a.value).filter(v => f.get(`access_${v}`) === 'on');
      if (!access.length) throw new Error('Pick at least one access type (Web app, Command line, …).');
      const pricing = String(f.get('pricing') || 'free');
      if (!Pentest_PRICING.some(p => p.value === pricing)) throw new Error('Invalid pricing.');
      const status = String(f.get('status') || 'draft');
      if (!['draft', 'published', 'archived'].includes(status)) throw new Error('Invalid status.');
      const catId = String(f.get('category_id') || '').trim() || null;
      if (catId && !categories.some(c => String(c.id) === catId)) throw new Error('Unknown category.');
      const orphans = [];
      const previousLogo = bucketPathFromUrl(t.logo_url);
      if (previousLogo && previousLogo.bucket === 'pentest-logos') orphans.push(previousLogo);
      const payload = {
        name, slug,
        summary: String(f.get('summary') || '').trim().slice(0, 300) || null,
        overview: stripExtractedHeading(String(f.get('overview') || ''), name, !String(f.get('name') || '').trim()),
        install_guide: String(f.get('install_guide') || ''),
        key_features: String(f.get('key_features') || ''),
        faqs: String(f.get('faqs') || ''),
        use_case: String(f.get('use_case') || ''),
        category_id: catId,
        pricing, access_types: access,
        official_url: absUrl(f.get('official_url')),
        github_url: absUrl(f.get('github_url')),
        docs_url: absUrl(f.get('docs_url')),
        logo_url: logo,
        featured: f.get('featured') === 'on',
        status,
        sort_order: Number(f.get('sort_order')) || 0,
        updated_at: new Date().toISOString(),
        published_at: status === 'published' ? (t.published_at || new Date().toISOString()) : null
      };
      const result = tool ? await supabase.from('pentest_tools').update(payload).eq('id', tool.id) : await supabase.from('pentest_tools').insert(payload);
      if (result.error) throw result.error;
      if (logo === (t.logo_url || null)) {
        for (let i = orphans.length - 1; i >= 0; i--) {
          if (orphans[i] === previousLogo) orphans.splice(i, 1);
        }
      }
      await removeStorageObjects(orphans);
      clearDirty(form);
      loadTab('pentest');
    } catch (err) {
      if (uploadedLogoPath) await removeStorageObjects([{ bucket: 'pentest-logos', path: uploadedLogoPath }]);
      submitBtn.disabled = false; submitBtn.textContent = tool ? 'Save tool' : 'Create tool';
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

/* Industry-standard shortcut: Ctrl/Cmd+S saves the open form instead of
   the browser's save-page dialog. */
window.addEventListener('keydown', e => {
  if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 's') return;
  const form = document.querySelector('#panel form');
  if (!form || !document.body.contains(form)) return;
  e.preventDefault();
  if (typeof form.requestSubmit === 'function') form.requestSubmit();
});

/* Warn before losing a half-written article to a stray reload. */
window.addEventListener('beforeunload', e => {
  if (!hasUnsavedWork()) return;
  e.preventDefault();
  e.returnValue = '';
});

scheduleRoute();
