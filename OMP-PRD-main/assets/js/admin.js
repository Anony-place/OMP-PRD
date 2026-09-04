import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

if (typeof window.__adminBootOk === 'function') window.__adminBootOk();

const SUPABASE_URL = 'https://aeehfulikupskyrvcpzb.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_s3n2U32MNB4PvHx0GolyqA_wlkzD6eR';
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'omp-admin-auth' }
});
const root = document.querySelector('#admin-root');
let authUi = 'boot'; // 'boot' | 'login' | 'dashboard'

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
    <div class="admin-actions" style="margin-top:28px" role="group" aria-label="Admin sections"><button class="btn btn-secondary" type="button" data-tab="articles">Articles</button><button class="btn btn-secondary" type="button" data-tab="tools">Tools</button><button class="btn btn-secondary" type="button" data-tab="messages">Messages</button></div>
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
      supabase.from('articles').select('id,title,slug,status,published_at,updated_at,category_id,document_url').order('updated_at',{ascending:false}),
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
        if (e2 || !data) { btn.disabled = false; return flash(panel, e2 ? e2.message : 'That article could not be loaded.'); }
        articleForm(editor, categories || [], data);
        editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      listEl.querySelectorAll('[data-delete-article]').forEach(btn => btn.onclick = async () => {
        if (!confirm('Delete this article permanently?')) return;
        btn.disabled = true;
        const { error: e2 } = await supabase.from('articles').delete().eq('id',btn.dataset.deleteArticle);
        if (e2) { btn.disabled = false; return flash(panel, `Delete failed: ${e2.message}`); }
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
      if (e2 || !data) { btn.disabled = false; return flash(panel, e2 ? e2.message : 'That tool could not be loaded.'); }
      toolForm(editor, categories || [], data);
    });
    document.querySelectorAll('[data-delete-tool]').forEach(btn => btn.onclick = async () => {
      if (!confirm('Delete this tool registry entry?')) return;
      btn.disabled = true;
      const { error: e2 } = await supabase.from('tools').delete().eq('id',btn.dataset.deleteTool);
      if (e2) { btn.disabled = false; return flash(panel, `Delete failed: ${e2.message}`); }
      loadTab('tools');
    });
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

let dirty = false;
function setDirty(form, on) {
  dirty = on;
  const dot = form?.querySelector('[data-unsaved]');
  if (dot) dot.hidden = !on;
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
      ${a.document_url ? `<p class="tiny" style="margin-top:6px">Attached: <a href="${esc(a.document_url)}" target="_blank" rel="noopener">view current document</a> &nbsp;<label style="display:inline-flex;gap:6px;align-items:center"><input type="checkbox" name="remove_document"> remove attachment</label></p>` : '<p class="tiny muted" style="margin-top:6px">Optional — readers get a “Download document” button on the article page.</p>'}
    </div>
    <div class="editor-grid" style="margin-top:8px">
      <div class="editor-fields">
        <label for="${id('content')}">Content</label>
        <div class="toolbar" role="toolbar" aria-label="Formatting" aria-controls="${id('content')}">${TOOLBAR.map((t,i)=>`<button type="button" data-mk="${i}" title="${esc(t.title)}" aria-label="${esc(t.title)}">${esc(t.label)}</button>`).join('')}</div>
        <textarea id="${id('content')}" name="content" class="body-editor" rows="18" required spellcheck="true" aria-describedby="${id('hint')}">${esc(a.content)}</textarea>
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
  ta.addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === 'b') { e.preventDefault(); applyMarkup(ta, TOOLBAR.find(r => r.label === 'B')); }
    else if (k === 'i') { e.preventDefault(); applyMarkup(ta, TOOLBAR.find(r => r.label === 'I')); }
  });

  const cancel = () => {
    if (dirty && !confirm('Discard unsaved changes to this article?')) return;
    dirty = false;
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
      if (file && file.size) {
        /* Preflight the file before anything leaves the device: magic-byte
           signature must match the declared extension, and the exact
           Content-Type is forced on upload so the object can never be
           sniffed as text/html. (Server-side storage policies remain the
           real gate — see supabase/00_schema_migrations.sql.) */
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
        const path = `${Date.now()}-${safeName}`;
        const { error: upErr } = await supabase.storage.from('articles').upload(path, file, { cacheControl: '3600', upsert: false, contentType: v.contentType || undefined });
        if (upErr) throw new Error(`Upload failed: ${upErr.message}`);
        const { data: pub } = supabase.storage.from('articles').getPublicUrl(path);
        document_url = pub.publicUrl;
        /* Best-effort bookkeeping: a failed media row must not block publishing. */
        const { data: { user } } = await supabase.auth.getUser();
        const { error: mediaErr } = await supabase.from('media').insert({ file_path: `articles/${path}`, public_url: document_url, mime_type: (v.contentType || file.type || null), size_bytes: file.size, uploaded_by: user?.id || null });
        if (mediaErr) console.warn('media row not recorded:', mediaErr.message);
      }
      const slug = slugify(f.get('slug')) || slugify(f.get('title'));
      if (!slug) throw new Error('A slug is required — add a title or type one in.');
      /* featured_image lands in an <img src=…> on /articles, so reject a
         javascript: / data:text/html value at the point of entry rather than
         relying only on the renderer's scheme gate. */
      const featuredRaw = String(f.get('featured_image') || '').trim();
      const featured = featuredRaw
        ? (window.OMPUrl ? window.OMPUrl.safeUrl(featuredRaw, { allowDataImage: true }) : (() => { const m = featuredRaw.match(/^(https?:|\/|#|data:image\/[a-z]+;base64,)/i); return m ? featuredRaw : null; })())
        : null;
      if (featured === null && featuredRaw) throw new Error('Featured image URL must be an http(s), site-relative or raster data: image.');
      const payload = {title:f.get('title').trim(),slug,summary:f.get('summary'),content:f.get('content'),category_id:f.get('category_id')||null,status,featured_image:featured,document_url,published_at:status==='published'?(a.published_at||new Date().toISOString()):null};
      const result = article ? await supabase.from('articles').update(payload).eq('id',article.id) : await supabase.from('articles').insert(payload);
      if (result.error) throw result.error;
      dirty = false;
      loadTab('articles');
    } catch (err) {
      submitBtn.disabled = false; submitBtn.textContent = 'Save article';
      flash(form, err?.message || String(err));
    }
  });
}

function toolForm(host, categories, tool) {
  const t = tool || {name:'',slug:'',description:'',route:'',icon:'',category_id:null,is_active:true,sort_order:0,metadata:{}};
  const uid = tool ? String(tool.id).slice(0, 8) : 'new';
  const id = n => `tf-${uid}-${n}`;
  host.innerHTML = `<form id="tool-form" class="card card-pad" style="margin-top:18px"><h3 class="h-3">${tool ? 'Edit tool' : 'New tool'}</h3><div class="editor-row-2" style="margin-top:16px"><div class="form-field"><label for="${id('name')}">Name</label><input id="${id('name')}" name="name" required value="${esc(t.name)}"></div><div class="form-field"><label for="${id('slug')}">Slug</label><input id="${id('slug')}" name="slug" required value="${esc(t.slug)}"></div></div><div class="form-field"><label for="${id('desc')}">Description</label><textarea id="${id('desc')}" name="description" rows="3">${esc(t.description || '')}</textarea></div><div class="editor-row-3"><div class="form-field"><label for="${id('cat')}">Category</label><select id="${id('cat')}" name="category_id"><option value="">None</option>${categories.map(c=>`<option value="${esc(c.id)}" ${c.id===t.category_id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div><div class="form-field"><label for="${id('route')}">Route</label><input id="${id('route')}" name="route" placeholder="/checker.html" value="${esc(t.route || '')}"></div><div class="form-field"><label for="${id('icon')}">Icon</label><input id="${id('icon')}" name="icon" value="${esc(t.icon || '')}"></div></div><div class="editor-row-2"><div class="form-field"><label for="${id('sort')}">Sort order</label><input id="${id('sort')}" name="sort_order" type="number" value="${Number(t.sort_order)||0}"></div><div class="opt-row"><div><div class="opt-name">Active</div><div class="opt-desc">Show this tool on the public registry.</div></div><span class="switch"><input name="is_active" type="checkbox" aria-label="Active" ${t.is_active?'checked':''}><span class="track"></span></span></div></div><div class="form-field"><label for="${id('meta')}">Metadata JSON</label><textarea id="${id('meta')}" name="metadata" rows="6">${esc(JSON.stringify(t.metadata || {}, null, 2))}</textarea></div><p class="tiny muted" style="margin-top:6px">Route must be a path on this site (for example <code>/checker.html</code>). Off-site or <code>javascript:</code> routes are rejected by the public search.</p><div class="flex gap-8" style="margin-top:14px"><button class="btn btn-primary" type="submit">Save tool</button><button class="btn btn-ghost" type="button" id="cancel-tool">Cancel</button></div></form>`;
  const form = document.querySelector('#tool-form');
  document.querySelector('#cancel-tool').onclick = () => { host.innerHTML = ''; };
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
  dirty = false;
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
  if (!dirty) return;
  e.preventDefault();
  e.returnValue = '';
});

scheduleRoute();
