import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://aeehfulikupskyrvcpzb.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_s3n2U32MNB4PvHx0GolyqA_wlkzD6eR';
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const root = document.querySelector('#admin-root');

const esc = (value = '') => String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const slugify = value => String(value || '').toLowerCase().trim().replace(/[^a-z0-9\s-]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');

function shell(content) { root.innerHTML = `<div style="max-width:980px;margin:0 auto">${content}</div>`; }

function loginView(message = '') {
  shell(`<div class="card card-pad" style="max-width:460px;margin:8vh auto 0">
    <div class="badge badge-demo">Private administration</div>
    <h1 class="h-2 mt-16">OopsMyPassword Admin</h1>
    <p class="muted" style="margin-top:8px">This area is not public. Sign in with an authorized Supabase Auth account.</p>
    ${message ? `<div class="notice-band mt-16"><p>${esc(message)}</p></div>` : ''}
    <form id="login-form" style="margin-top:24px">
      <div class="form-field"><label for="email">Email</label><input id="email" type="email" autocomplete="username" required></div>
      <div class="form-field"><label for="password">Password</label><input id="password" type="password" autocomplete="current-password" required></div>
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
  });
}

async function requireAdmin() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile, error } = await supabase.from('profiles').select('id,email,is_admin').eq('id', user.id).maybeSingle();
  if (error || !profile?.is_admin) { await supabase.auth.signOut(); loginView('This account is not authorized for the admin panel.'); return false; }
  return true;
}

async function dashboard() {
  shell(`<div class="card card-pad">
    <div class="flex justify-between items-center wrap gap-12"><div><div class="badge badge-demo">Private admin</div><h1 class="h-2 mt-16">OMP Control Center</h1><p class="muted" style="margin-top:6px">Supabase-backed content management.</p></div><button id="logout" class="btn btn-ghost">Sign out</button></div>
    <div class="admin-actions" style="margin-top:28px"><button class="btn btn-primary" data-tab="articles">Articles</button><button class="btn btn-secondary" data-tab="tools">Tools</button></div>
    <section id="panel" style="margin-top:24px"></section>
  </div>`);
  document.querySelector('#logout').onclick = async () => { await supabase.auth.signOut(); loginView(); };
  document.querySelectorAll('[data-tab]').forEach(btn => btn.onclick = () => loadTab(btn.dataset.tab));
  await loadTab('articles');
}

async function loadTab(tab) {
  const panel = document.querySelector('#panel');
  if (tab === 'articles') {
    const [{ data: articles, error }, { data: categories }] = await Promise.all([
      supabase.from('articles').select('id,title,slug,status,published_at,updated_at,category_id').order('updated_at',{ascending:false}),
      supabase.from('article_categories').select('id,name,slug').order('name')
    ]);
    if (error) return panel.innerHTML = `<div class="notice-band"><p>${esc(error.message)}</p></div>`;
    panel.innerHTML = `<div class="flex justify-between items-center wrap gap-12"><h2 class="h-3">Articles</h2><button id="new-article" class="btn btn-primary btn-sm">+ New article</button></div><div id="article-editor"></div><div class="admin-list" style="margin-top:18px">${(articles||[]).map(a => `<div class="admin-row"><div class="grow"><div class="ttl">${esc(a.title)}</div><div class="meta">/${esc(a.slug)} · ${esc(a.status)}</div></div><div class="row-btns"><button class="btn btn-secondary btn-sm" data-edit-article="${a.id}">Edit</button><button class="btn btn-ghost btn-sm" data-delete-article="${a.id}" style="color:var(--red)">Delete</button></div></div>`).join('') || '<div class="admin-empty"><p class="muted">No articles yet.</p></div>'}</div>`;
    const editor = document.querySelector('#article-editor');
    document.querySelector('#new-article').onclick = () => articleForm(editor, categories || [], null);
    document.querySelectorAll('[data-edit-article]').forEach(btn => btn.onclick = async () => { const { data } = await supabase.from('articles').select('*').eq('id',btn.dataset.editArticle).single(); articleForm(editor, categories || [], data); });
    document.querySelectorAll('[data-delete-article]').forEach(btn => btn.onclick = async () => { if (!confirm('Delete this article permanently?')) return; await supabase.from('articles').delete().eq('id',btn.dataset.deleteArticle); loadTab('articles'); });
  } else {
    const [{ data: tools, error }, { data: categories }] = await Promise.all([
      supabase.from('tools').select('id,name,slug,route,is_active,sort_order,category_id').order('sort_order').order('name'),
      supabase.from('tool_categories').select('id,name,slug').order('sort_order').order('name')
    ]);
    if (error) return panel.innerHTML = `<div class="notice-band"><p>${esc(error.message)}</p></div>`;
    panel.innerHTML = `<div class="flex justify-between items-center wrap gap-12"><h2 class="h-3">Tools Registry</h2><button id="new-tool" class="btn btn-primary btn-sm">+ New tool</button></div><p class="tiny muted" style="margin-top:6px">Registry metadata is dynamic; the actual tool route/code still has to exist.</p><div id="tool-editor"></div><div class="admin-list" style="margin-top:18px">${(tools||[]).map(t => `<div class="admin-row"><div class="grow"><div class="ttl">${esc(t.name)}</div><div class="meta">/${esc(t.slug)} · ${esc(t.route || 'no route')} · ${t.is_active ? 'active':'disabled'}</div></div><div class="row-btns"><button class="btn btn-secondary btn-sm" data-edit-tool="${t.id}">Edit</button><button class="btn btn-ghost btn-sm" data-delete-tool="${t.id}" style="color:var(--red)">Delete</button></div></div>`).join('') || '<div class="admin-empty"><p class="muted">No tools yet.</p></div>'}</div>`;
    const editor = document.querySelector('#tool-editor');
    document.querySelector('#new-tool').onclick = () => toolForm(editor, categories || [], null);
    document.querySelectorAll('[data-edit-tool]').forEach(btn => btn.onclick = async () => { const { data } = await supabase.from('tools').select('*').eq('id',btn.dataset.editTool).single(); toolForm(editor, categories || [], data); });
    document.querySelectorAll('[data-delete-tool]').forEach(btn => btn.onclick = async () => { if (!confirm('Delete this tool registry entry?')) return; await supabase.from('tools').delete().eq('id',btn.dataset.deleteTool); loadTab('tools'); });
  }
}

function articleForm(host, categories, article) {
  const a = article || {title:'',slug:'',summary:'',content:'',status:'draft',category_id:null,published_at:null,featured_image:''};
  host.innerHTML = `<form id="article-form" class="card card-pad" style="margin-top:18px"><h3 class="h-3">${article ? 'Edit article' : 'New article'}</h3><div class="editor-row-2" style="margin-top:16px"><div class="form-field"><label>Title</label><input name="title" required value="${esc(a.title)}"></div><div class="form-field"><label>Slug</label><input name="slug" required value="${esc(a.slug)}"></div></div><div class="form-field"><label>Summary</label><textarea name="summary" rows="3">${esc(a.summary)}</textarea></div><div class="editor-row-3"><div class="form-field"><label>Category</label><select name="category_id"><option value="">None</option>${categories.map(c=>`<option value="${c.id}" ${c.id===a.category_id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div><div class="form-field"><label>Status</label><select name="status"><option value="draft" ${a.status==='draft'?'selected':''}>Draft</option><option value="published" ${a.status==='published'?'selected':''}>Published</option><option value="archived" ${a.status==='archived'?'selected':''}>Archived</option></select></div><div class="form-field"><label>Featured image URL</label><input name="featured_image" value="${esc(a.featured_image || '')}"></div></div><div class="form-field"><label>Content (HTML)</label><textarea name="content" rows="18" required>${esc(a.content)}</textarea></div><div class="flex gap-8"><button class="btn btn-primary" type="submit">Save article</button><button class="btn btn-ghost" type="button" id="cancel-editor">Cancel</button></div></form>`;
  document.querySelector('#cancel-editor').onclick = () => host.innerHTML = '';
  document.querySelector('#article-form').addEventListener('submit', async e => { e.preventDefault(); const f=new FormData(e.currentTarget); const status=f.get('status'); const payload={title:f.get('title').trim(),slug:slugify(f.get('slug')),summary:f.get('summary'),content:f.get('content'),category_id:f.get('category_id')||null,status,featured_image:f.get('featured_image')||null,published_at:status==='published'?(a.published_at||new Date().toISOString()):null}; const result=article?await supabase.from('articles').update(payload).eq('id',article.id):await supabase.from('articles').insert(payload); if(result.error)return alert(result.error.message); loadTab('articles'); });
}

function toolForm(host, categories, tool) {
  const t = tool || {name:'',slug:'',description:'',route:'',icon:'',category_id:null,is_active:true,sort_order:0,metadata:{}};
  host.innerHTML = `<form id="tool-form" class="card card-pad" style="margin-top:18px"><h3 class="h-3">${tool ? 'Edit tool' : 'New tool'}</h3><div class="editor-row-2" style="margin-top:16px"><div class="form-field"><label>Name</label><input name="name" required value="${esc(t.name)}"></div><div class="form-field"><label>Slug</label><input name="slug" required value="${esc(t.slug)}"></div></div><div class="form-field"><label>Description</label><textarea name="description" rows="3">${esc(t.description || '')}</textarea></div><div class="editor-row-3"><div class="form-field"><label>Category</label><select name="category_id"><option value="">None</option>${categories.map(c=>`<option value="${c.id}" ${c.id===t.category_id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div><div class="form-field"><label>Route</label><input name="route" placeholder="/checker.html" value="${esc(t.route || '')}"></div><div class="form-field"><label>Icon</label><input name="icon" value="${esc(t.icon || '')}"></div></div><div class="editor-row-2"><div class="form-field"><label>Sort order</label><input name="sort_order" type="number" value="${Number(t.sort_order)||0}"></div><div class="opt-row"><div><div class="opt-name">Active</div><div class="opt-desc">Show this tool on the public registry.</div></div><span class="switch"><input name="is_active" type="checkbox" ${t.is_active?'checked':''}><span class="track"></span></span></div></div><div class="form-field"><label>Metadata JSON</label><textarea name="metadata" rows="6">${esc(JSON.stringify(t.metadata || {}, null, 2))}</textarea></div><div class="flex gap-8"><button class="btn btn-primary" type="submit">Save tool</button><button class="btn btn-ghost" type="button" id="cancel-tool">Cancel</button></div></form>`;
  document.querySelector('#cancel-tool').onclick = () => host.innerHTML = '';
  document.querySelector('#tool-form').addEventListener('submit', async e => { e.preventDefault(); const f=new FormData(e.currentTarget); let metadata={}; try{metadata=JSON.parse(f.get('metadata')||'{}')}catch{return alert('Metadata must be valid JSON.')} const payload={name:f.get('name').trim(),slug:slugify(f.get('slug')),description:f.get('description'),category_id:f.get('category_id')||null,route:f.get('route'),icon:f.get('icon'),sort_order:Number(f.get('sort_order'))||0,is_active:f.get('is_active')==='on',metadata}; const result=tool?await supabase.from('tools').update(payload).eq('id',tool.id):await supabase.from('tools').insert(payload); if(result.error)return alert(result.error.message); loadTab('tools'); });
}

supabase.auth.onAuthStateChange(async () => { if (await requireAdmin()) await dashboard(); });

(async () => { if (await requireAdmin()) await dashboard(); else { const { data: { user } } = await supabase.auth.getUser(); if (!user) loginView(); } })();
