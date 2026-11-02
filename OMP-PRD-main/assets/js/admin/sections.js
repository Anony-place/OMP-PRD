/* ============================================================
   Admin sections that live outside admin.js.

   admin.js is one 2 600-line module and every feature added to it makes the
   next one harder to read. Everything new goes here instead: a section is an
   object with a label, a mount function, and no knowledge of the rest of the
   panel beyond the context it is handed.

   The context (never imported) is what keeps this from becoming a cycle:

     supabase          the client admin.js already created
     esc               html escaper  - never interpolate unescaped text
     notice / flash    the panel's own error and success renderers
     loadTab           to send the user somewhere else
     requestPublish    the publish pipeline, so a change can go live
     publishChip       the "queued → live" progress chip
     panel             the <section id="panel"> being painted

   A section returns after painting; admin.js's stale-render token is not
   available here, so nothing here does slow work before painting.
   ============================================================ */

/* Tab order is the order people need things: what shipped, what redirects,
   what is in the library, and a backup of it. */
export const SECTION_TABS = [
  { key: 'deploys', label: 'Deploys' },
  { key: 'revisions', label: 'Revisions' },
  { key: 'redirects', label: 'Redirects' },
  { key: 'search', label: 'Search' },
  { key: 'export', label: 'Export' }
];

const KEYS = new Set(SECTION_TABS.map(s => s.key));
export const isSection = key => KEYS.has(key);

const STATUS_TONE = {
  live: 'var(--green, #1a7f37)',
  failed: 'var(--red, #c0392b)',
  running: 'var(--amber, #9a6700)',
  deploying: 'var(--amber, #9a6700)',
  queued: 'var(--muted, #667085)',
  skipped: 'var(--muted, #667085)'
};

const when = value => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

const ago = value => {
  if (!value) return '';
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`;
  return `${Math.round(seconds / 86400)}d ago`;
};

/* ---------------------------------------------------------------- deploys */

async function mountDeploys(ctx) {
  const { supabase, esc, panel, notice } = ctx;
  panel.innerHTML = `<div class="admin-section-head">
      <div><h2 class="h-3">Deploys</h2><p class="tiny muted">Every build the publish pipeline has run, newest first. A red row means the site did not change.</p></div>
      <button id="deploy-refresh" type="button" class="btn btn-secondary btn-sm">Refresh</button>
    </div>
    <div id="deploy-list" class="admin-list" style="margin-top:16px"></div>`;

  const list = document.querySelector('#deploy-list');
  const paint = async () => {
    list.innerHTML = '<p class="tiny muted">Loading…</p>';
    /* publish_jobs may not exist yet - the migration is applied by hand. Say so
       instead of showing an empty list and letting it look like nothing ever
       shipped. */
    const { data, error } = await supabase
      .from('publish_jobs')
      .select('id,status,reason,targets,detail,run_url,commit_sha,created_at,updated_at')
      .order('created_at', { ascending: false })
      .limit(40);

    if (error) {
      list.innerHTML = error.code === '42P01' || /does not exist/i.test(error.message)
        ? notice('publish_jobs does not exist yet - apply supabase/migrations/20261101120000_publish_jobs_and_scheduling.sql first.')
        : notice(error.message);
      return;
    }
    if (!data || !data.length) {
      list.innerHTML = '<p class="tiny muted">No deploys yet. Publish an article and the run appears here.</p>';
      return;
    }

    list.innerHTML = data.map(job => {
      const tone = STATUS_TONE[job.status] || 'inherit';
      const targets = Array.isArray(job.targets) && job.targets.length ? job.targets.join(', ') : 'whole site';
      const links = [
        job.run_url ? `<a class="tiny" href="${esc(job.run_url)}" target="_blank" rel="noopener">run log</a>` : '',
        job.commit_sha ? `<span class="tiny muted" title="commit"><code>${esc(String(job.commit_sha).slice(0, 7))}</code></span>` : ''
      ].filter(Boolean).join(' · ');
      return `<div class="admin-row">
        <div class="grow">
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
            <strong style="color:${tone}">${esc(job.status)}</strong>
            <span class="tiny muted">${esc(job.reason || 'manual')} · ${esc(targets)}</span>
          </div>
          <p class="tiny muted" style="margin-top:4px">${esc(when(job.created_at))} <span title="${esc(ago(job.created_at))}"></span></p>
          ${job.detail ? `<p class="tiny" style="margin-top:6px;color:${tone}">${esc(job.detail)}</p>` : ''}
        </div>
        <div class="tiny">${links}</div>
      </div>`;
    }).join('');
  };

  document.querySelector('#deploy-refresh').onclick = paint;
  await paint();
}

/* -------------------------------------------------------------- redirects */

async function mountRedirects(ctx) {
  const { supabase, esc, panel, notice, flash, requestPublish, publishChip } = ctx;

  panel.innerHTML = `<div class="admin-section-head">
      <div><h2 class="h-3">Redirects</h2><p class="tiny muted">Old paths that must keep working. A 301 keeps the ranking the old URL earned; without it the link is a 404.</p></div>
    </div>
    <form id="redirect-form" class="card card-pad" style="margin-top:16px">
      <div class="form-grid">
        <div class="form-field"><label for="red-from">Old path</label><input id="red-from" name="from" placeholder="/articles/old-slug" required></div>
        <div class="form-field"><label for="red-to">New path</label><input id="red-to" name="to" placeholder="/articles/new-slug" required></div>
      </div>
      <div class="form-field"><label for="red-note">Note (why this exists)</label><input id="red-note" name="note" placeholder="slug renamed 2026-11"></div>
      <p class="tiny muted" style="margin:8px 0 12px">Both sides start with <code>/</code>. A rename inside the panel writes this row by itself - add one here only for a path you retired by hand.</p>
      <div id="red-msg" aria-live="polite"></div>
      <button type="submit" class="btn btn-primary btn-sm">Add redirect</button>
    </form>
    <div id="red-list" class="admin-list" style="margin-top:18px"></div>`;

  const list = document.querySelector('#red-list');
  const msg = document.querySelector('#red-msg');

  const paint = async () => {
    list.innerHTML = '<p class="tiny muted">Loading…</p>';
    const { data, error } = await supabase
      .from('redirects')
      .select('from_path,to_path,status_code,note,created_at')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) {
      list.innerHTML = error.code === '42P01' || /does not exist/i.test(error.message)
        ? notice('redirects does not exist yet - apply supabase/migrations/20261101140000_redirects.sql first.')
        : notice(error.message);
      return;
    }
    if (!data || !data.length) {
      list.innerHTML = '<p class="tiny muted">No redirects. Every URL is live at its own path.</p>';
      return;
    }
    const looped = new Set(data.filter(r => data.some(o => o.from_path === r.to_path)).map(r => r.from_path));
    list.innerHTML = data.map(rule => `<div class="admin-row">
        <div class="grow">
          <p><code>${esc(rule.from_path)}</code> → <code>${esc(rule.to_path)}</code></p>
          <p class="tiny muted" style="margin-top:4px">${esc(rule.status_code)}${rule.note ? ' · ' + esc(rule.note) : ''} · ${esc(when(rule.created_at))}</p>
          ${looped.has(rule.from_path) ? '<p class="tiny" style="color:var(--red,#c0392b);margin-top:4px">This path redirects to a path that redirects again. The visitor takes two hops; point it straight at the final URL.</p>' : ''}
        </div>
        <button type="button" class="btn btn-ghost btn-sm" data-del="${esc(rule.from_path)}" style="color:var(--red)">Delete</button>
      </div>`).join('');

    list.querySelectorAll('[data-del]').forEach(btn => btn.onclick = async () => {
      const from = btn.dataset.del;
      if (!confirm(`Delete the redirect from ${from}?\n\nThat URL will start returning 404 as soon as the next deploy runs.`)) return;
      const { error: delError } = await supabase.from('redirects').delete().eq('from_path', from);
      if (delError) return flash(list, `Delete failed: ${delError.message}`);
      await paint();
    });
  };

  /* A redirect that points at itself is a loop, and one that points at a path
     which redirects again is a two-hop chain. Both look fine in a table and
     break the visitor, so the form refuses them. */
  document.querySelector('#redirect-form').onsubmit = async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const from = String(data.get('from') || '').trim();
    const to = String(data.get('to') || '').trim();
    const note = String(data.get('note') || '').trim();
    msg.innerHTML = '';

    if (!from.startsWith('/') || !to.startsWith('/') && !to.startsWith('https://')) {
      return flash(msg, 'Both paths must start with / (or the destination with https://).');
    }
    if (from === to) return flash(msg, 'A path cannot redirect to itself.');

    const { data: clash } = await supabase.from('redirects').select('from_path').eq('from_path', from).maybeSingle();
    if (clash) return flash(msg, `${from} already has a redirect. Delete it first - two rules for one path means the second never runs.`);

    const { error } = await supabase.from('redirects').insert({ from_path: from, to_path: to, note: note || null, status_code: 301 });
    if (error) return flash(msg, `Could not add: ${error.message}`);

    form.reset();
    await paint();
    flash(msg, 'Saved. It becomes a real 301 at the next deploy - use Publish below, or it waits for the next article.');

    const slot = document.createElement('div');
    msg.appendChild(slot);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-primary btn-sm';
    button.style.marginTop = '8px';
    button.textContent = 'Deploy now';
    button.onclick = async () => {
      button.disabled = true;
      const started = await requestPublish('redirects', []);
      if (started.error) { button.disabled = false; return flash(msg, started.error); }
      if (started.job_id && typeof publishChip === 'function') publishChip(slot, started.job_id, from);
      else flash(msg, 'Deploy queued.');
    };
    slot.appendChild(button);
  };

  await paint();
}

/* ----------------------------------------------------------------- search */

async function mountSearch(ctx) {
  const { supabase, esc, panel, notice, loadTab } = ctx;
  panel.innerHTML = `<div class="admin-section-head">
      <div><h2 class="h-3">Search</h2><p class="tiny muted">Find anything by title, slug or body text. The list tabs filter only what is loaded; this asks the database.</p></div>
    </div>
    <div class="form-field" style="margin-top:16px;max-width:520px">
      <label for="global-q">Search the library</label>
      <input id="global-q" type="search" placeholder="e.g. ransomware, password manager, slug words…" autocomplete="off">
    </div>
    <div id="global-results" class="admin-list" style="margin-top:16px"></div>`;

  const results = document.querySelector('#global-results');
  const input = document.querySelector('#global-q');
  let token = 0;

  const paint = async query => {
    const q = String(query || '').trim();
    if (q.length < 2) { results.innerHTML = '<p class="tiny muted">Type at least 2 characters.</p>'; return; }
    const mine = ++token;
    results.innerHTML = '<p class="tiny muted">Searching…</p>';

    /* ilike, not full-text: the corpus is small and this needs no index or
       trigger to stay correct. PostgREST treats , and ) as syntax, so they are
       stripped rather than escaped - a search box is not worth an injection
       hole. */
    const safe = q.replace(/[,()%]/g, ' ').trim();
    const [articles, products] = await Promise.all([
      supabase.from('articles').select('id,title,slug,status,updated_at')
        .or(`title.ilike.%${safe}%,slug.ilike.%${safe}%`).order('updated_at', { ascending: false }).limit(25),
      supabase.from('products').select('id,name,slug,status').or(`name.ilike.%${safe}%,slug.ilike.%${safe}%`).limit(10)
    ]);
    if (mine !== token) return;
    if (articles.error) return results.innerHTML = notice(articles.error.message);

    const hits = [
      ...(articles.data || []).map(row => ({ ...row, kind: 'article', title: row.title, tab: 'articles' })),
      ...(products.data || []).map(row => ({ ...row, kind: 'product', title: row.name, tab: 'products' }))
    ];
    if (!hits.length) { results.innerHTML = `<p class="tiny muted">Nothing matches “${esc(q)}”.</p>`; return; }

    results.innerHTML = hits.map(hit => `<div class="admin-row">
        <div class="grow">
          <p><strong>${esc(hit.title || hit.slug || '(untitled)')}</strong></p>
          <p class="tiny muted" style="margin-top:4px">${esc(hit.kind)} · ${esc(hit.status || '')} · ${esc(hit.slug || '')}</p>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" data-open="${esc(hit.tab)}">Open</button>
      </div>`).join('');
    results.querySelectorAll('[data-open]').forEach(btn => btn.onclick = () => loadTab(btn.dataset.open));
  };

  let timer;
  input.addEventListener('input', event => {
    clearTimeout(timer);
    timer = setTimeout(() => paint(event.target.value), 250);
  });
  input.focus();
  paint('');
}

/* ----------------------------------------------------------------- export */

async function mountExport(ctx) {
  const { supabase, esc, panel, notice, flash } = ctx;
  panel.innerHTML = `<div class="admin-section-head">
      <div><h2 class="h-3">Export</h2><p class="tiny muted">A copy of the library that does not need this panel, this database, or this host. Take one before anything risky.</p></div>
    </div>
    <div class="admin-list" style="margin-top:16px">
      <div class="admin-row"><div class="grow">
        <p><strong>Everything, as JSON</strong></p>
        <p class="tiny muted" style="margin-top:4px">Articles (with bodies), products, categories and redirects, in one file. This is the format the database uses, so it is also the format a restore needs.</p>
      </div><button type="button" class="btn btn-secondary btn-sm" id="export-all">Download</button></div>
      <div class="admin-row"><div class="grow">
        <p><strong>Articles, as Markdown</strong></p>
        <p class="tiny muted" style="margin-top:4px">One .md file with front matter per article - readable without any tool. Use it to move the writing somewhere else, or to read it in ten years.</p>
      </div><button type="button" class="btn btn-secondary btn-sm" id="export-md">Download</button></div>
    </div>
    <div id="export-msg" aria-live="polite" style="margin-top:12px"></div>`;

  const msg = document.querySelector('#export-msg');
  const download = (name, text, type = 'application/json') => {
    const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    /* Revoking immediately can cancel the download in Safari; a tick is enough. */
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };
  const stamp = () => new Date().toISOString().slice(0, 10);

  document.querySelector('#export-all').onclick = async () => {
    flash(msg, 'Collecting…');
    const [articles, products, categories, redirects] = await Promise.all([
      supabase.from('articles').select('*').order('updated_at', { ascending: false }),
      supabase.from('products').select('*'),
      supabase.from('article_categories').select('*'),
      supabase.from('redirects').select('*')
    ]);
    const failed = [articles, products, categories, redirects].find(r => r.error && r.error.code !== '42P01');
    if (failed) return flash(msg, failed.error.message);

    download(`omp-backup-${stamp()}.json`, JSON.stringify({
      exported_at: new Date().toISOString(),
      counts: {
        articles: articles.data?.length || 0,
        products: products.data?.length || 0,
        categories: categories.data?.length || 0,
        redirects: redirects.data?.length || 0
      },
      articles: articles.data || [],
      products: products.data || [],
      categories: categories.data || [],
      redirects: redirects.data || []
    }, null, 2));
    flash(msg, `Downloaded ${articles.data?.length || 0} article(s).`);
  };

  document.querySelector('#export-md').onclick = async () => {
    flash(msg, 'Collecting…');
    const { data, error } = await supabase.from('articles')
      .select('title,slug,status,published_at,updated_at,content,category_id')
      .order('title');
    if (error) return flash(msg, error.message);

    const yaml = value => `"${String(value ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
    const body = (data || []).map(article => [
      '---',
      `title: ${yaml(article.title)}`,
      `slug: ${yaml(article.slug)}`,
      `status: ${yaml(article.status)}`,
      `published_at: ${yaml(article.published_at || '')}`,
      `updated_at: ${yaml(article.updated_at || '')}`,
      '---',
      '',
      String(article.content || '').trim(),
      ''
    ].join('\n')).join('\n');

    download(`omp-articles-${stamp()}.md`, body, 'text/markdown');
    flash(msg, `Downloaded ${data?.length || 0} article(s) as Markdown.`);
  };
}

/* -------------------------------------------------------------- revisions */

async function mountRevisions(ctx) {
  const { supabase, esc, panel, notice, flash, requestPublish, publishChip } = ctx;

  panel.innerHTML = `<div class="admin-section-head">
      <div><h2 class="h-3">Revisions</h2><p class="tiny muted">Every save keeps the version it replaced, and a deleted article keeps its last one. Restoring puts a version back; it does not delete the one it replaces.</p></div>
    </div>
    <div class="form-field" style="margin-top:16px;max-width:460px">
      <label for="rev-q">Find an article</label>
      <input id="rev-q" type="search" placeholder="Title or slug…" autocomplete="off">
    </div>
    <div id="rev-articles" class="admin-list" style="margin-top:12px"></div>
    <div id="rev-history" style="margin-top:20px"></div>
    <div id="rev-msg" aria-live="polite"></div>`;

  const articlesHost = document.querySelector('#rev-articles');
  const historyHost = document.querySelector('#rev-history');
  const msg = document.querySelector('#rev-msg');
  const input = document.querySelector('#rev-q');
  const { data: { user } } = await supabase.auth.getUser();

  const findArticles = async (query) => {
    const q = String(query || '').trim().replace(/[,()%]/g, ' ').trim();
    let request = supabase.from('articles').select('id,title,slug,status,updated_at')
      .order('updated_at', { ascending: false }).limit(15);
    if (q.length >= 2) request = request.or(`title.ilike.%${q}%,slug.ilike.%${q}%`);
    const { data, error } = await request;
    if (error) return articlesHost.innerHTML = notice(error.message);
    if (!data || !data.length) return articlesHost.innerHTML = '<p class="tiny muted">No article matches.</p>';

    articlesHost.innerHTML = data.map(row => `<div class="admin-row">
        <div class="grow">
          <p><strong>${esc(row.title || row.slug || '(untitled)')}</strong></p>
          <p class="tiny muted" style="margin-top:4px">${esc(row.status || '')} · ${esc(row.slug || '')} · edited ${esc(ago(row.updated_at))}</p>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" data-history="${esc(row.id)}" data-slug="${esc(row.slug || '')}" data-title="${esc(row.title || row.slug || '')}">History</button>
      </div>`).join('');

    articlesHost.querySelectorAll('[data-history]').forEach(btn => {
      btn.onclick = () => openHistory(btn.dataset.history, btn.dataset.title, btn.dataset.slug);
    });
  };

  const openHistory = async (articleId, title, slug) => {
    msg.innerHTML = '';
    historyHost.innerHTML = `<h3 class="h-4">${esc(title)}</h3><p class="tiny muted" style="margin-top:6px">Loading versions…</p>`;
    const { data, error } = await supabase.from('article_revisions')
      .select('id,title,content,reason,created_at,created_by,status')
      .eq('article_id', articleId)
      /* seq, not created_at: two saves in the same microsecond share a
         timestamp and the order would be whatever the planner returned. */
      .order('seq', { ascending: false })
      .limit(40);

    if (error) {
      return historyHost.innerHTML = error.code === '42P01' || /does not exist/i.test(error.message)
        ? notice('article_revisions does not exist yet - apply supabase/migrations/20261101150000_article_revisions.sql first.')
        : notice(error.message);
    }
    if (!data || !data.length) {
      return historyHost.innerHTML = `<h3 class="h-4">${esc(title)}</h3>
        <p class="tiny muted" style="margin-top:6px">No versions yet. One appears the first time this article is edited.</p>`;
    }

    const rows = data.map((version, index) => {
      const size = String(version.content || '').length;
      const who = version.created_by && user && version.created_by === user.id ? 'you' : '';
      /* The body is rendered with the same pipeline as the editor preview, so
         what the author reads here cannot differ from what readers get. */
      const preview = typeof window !== 'undefined' && window.OMPMarkdown?.renderSafe
        ? window.OMPMarkdown.renderSafe(version.content || '')
        : (typeof window !== 'undefined' && window.OMPSanitize ? window.OMPSanitize(version.content || '') : esc(version.content || ''));
      return `<div class="admin-row" style="align-items:flex-start">
        <div class="grow">
          <p><strong>${esc(ago(version.created_at))}</strong> <span class="tiny muted">${esc(when(version.created_at))}${who ? ' · ' + esc(who) : ''}</span></p>
          <p class="tiny muted" style="margin-top:4px">${version.reason === 'delete' ? 'the article was deleted - this is its last copy' : 'replaced by a save'} · ${size.toLocaleString()} characters${index === 0 ? ' · newest' : ''}</p>
          <details style="margin-top:8px"><summary class="tiny">Show that version</summary>
            <div class="prose" style="margin-top:8px;max-height:320px;overflow:auto">${preview}</div>
          </details>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" data-restore="${esc(version.id)}">Restore</button>
      </div>`;
    }).join('');

    historyHost.innerHTML = `<h3 class="h-4">${esc(title)}</h3>
      <p class="tiny muted" style="margin-top:6px">${data.length} version(s), newest first.</p>
      <div class="admin-list" style="margin-top:12px">${rows}</div>`;

    historyHost.querySelectorAll('[data-restore]').forEach(btn => btn.onclick = async () => {
      const confirmed = confirm('Restore this version?\n\nThe article goes back to how it was, and the version it replaces is kept.');
      if (!confirmed) return;
      btn.disabled = true;
      const { error: restoreError } = await supabase.rpc('restore_article_revision', { revision_id: btn.dataset.restore });
      btn.disabled = false;
      if (restoreError) return flash(msg, `Restore failed: ${restoreError.message}`);

      await openHistory(articleId, title, slug);
      flash(msg, 'Restored. Nothing is public until you publish - the old page is still live.');
      const slot = document.createElement('div');
      msg.appendChild(slot);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn-primary btn-sm';
      button.style.marginTop = '8px';
      button.textContent = 'Publish the restored version';
      button.onclick = async () => {
        button.disabled = true;
        /* The deploy targets the article's page, not the revision: a revision
           is not a URL. */
        const started = await requestPublish('restore', slug ? [`/articles/${slug}`] : []);
        if (started.error) { button.disabled = false; return flash(msg, started.error); }
        if (started.job_id && typeof publishChip === 'function') publishChip(slot, started.job_id, slug ? `/articles/${slug}` : null);
        else flash(msg, 'Deploy queued.');
      };
      slot.appendChild(button);
    });
  };

  let timer;
  input.addEventListener('input', event => {
    clearTimeout(timer);
    timer = setTimeout(() => findArticles(event.target.value), 250);
  });
  await findArticles('');
}

/* ---------------------------------------------------------------- routing */

const SECTIONS = {
  deploys: mountDeploys,
  revisions: mountRevisions,
  redirects: mountRedirects,
  search: mountSearch,
  export: mountExport
};

export async function mountSection(key, ctx) {
  const mount = SECTIONS[key];
  if (!mount) throw new Error(`unknown admin section: ${key}`);
  return mount(ctx);
}

export function sectionTabs() {
  return SECTION_TABS.map(section => ({ ...section }));
}
