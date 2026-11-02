/* ============================================================
   Media library: what is in storage, and what still needs it.

   The old tab could upload, list, copy a URL and delete. That is a file
   browser. The question an admin actually has is different:

     "can I delete this?"

   Answering it by looking at the thumbnail is how a live article loses its
   diagram. So every file is matched against the rows that could reference it,
   and the answer is one of three:

     used      N places link to it, listed by title
     unused    nothing in the database mentions this URL
     unknown   the reference scan could not run

   "Unused" is not "safe to delete" on its own - a URL can be hard-coded in a
   page's HTML - but it is the only honest signal a database can give, and it is
   worth a lot on a free storage tier: the orphans are usually the bulk.

   The matching is a pure function so it can be tested without a browser, and
   it is deliberately dumb: substring search over the columns that can hold a
   URL. A URL is stored verbatim in every one of those columns, so a substring
   is exact enough, and it cannot be fooled into a false negative by a query
   language.
   ============================================================ */

export const BUCKETS = [
  { id: 'articles', label: 'Articles', note: 'Documents and images used in articles.', isPublic: true },
  { id: 'osint-logos', label: 'OSINT logos', note: 'Logos shown on /osint.', isPublic: true },
  { id: 'pentest-logos', label: 'Pentest logos', note: 'Logos shown on /pentest.', isPublic: true },
  { id: 'products', label: 'Product covers', note: 'Cover images on /products.', isPublic: true },
  { id: 'product-files', label: 'Product files', note: 'Private deliverables. Never linked publicly.', isPublic: false }
];

/* Where a URL can appear, per bucket. `table` and `label` are for the human
   reading the result, `columns` is what gets searched. */
export const SOURCES = {
  articles: [
    { table: 'articles', label: 'article', title: 'title', columns: ['content', 'featured_image', 'document_url'] }
  ],
  products: [
    { table: 'products', label: 'product', title: 'name', columns: ['description', 'featured_image'] }
  ],
  'osint-logos': [
    { table: 'osint_tools', label: 'OSINT tool', title: 'name', columns: ['logo_url', 'description'] }
  ],
  'pentest-logos': [
    { table: 'pentest_tools', label: 'pentest tool', title: 'name', columns: ['logo_url', 'description'] }
  ],
  /* A private deliverable is linked from a product row rather than embedded. */
  'product-files': [
    { table: 'products', label: 'product', title: 'name', columns: ['description', 'file_url', 'download_url', 'deliverable_url'] }
  ]
};

/* URLs are matched without the query string and without a trailing slash:
   storage URLs can gain ?download= or #fragment and the file is still the same
   file. A false positive here would block a delete; a false negative would let
   a live page break, so this leans slightly towards matching. */
function normaliseUrl(url) {
  return String(url || '').split('#')[0].split('?')[0].replace(/\/+$/, '').toLowerCase();
}

/* Which columns hold a URL, by table. The callers hand over rows; the columns
   come from SOURCES so a new source cannot be added without saying what to
   search in it. */
function columnsFor(table) {
  for (const sources of Object.values(SOURCES)) {
    for (const source of sources) {
      if (source.table === table) return source.columns;
    }
  }
  return [];
}

/**
 * @param {{ name: string, url?: string, size?: number }[]} files
 * @param {Record<string, { table: string, label: string, title: string, rows: object[] }[]>} records
 *        bucket -> the rows that were fetched for its sources
 * @returns {Map<string, { state: 'used'|'unused'|'unknown', hits: {label:string, title:string}[] }>}
 */
export function findUsage(files, records) {
  const usage = new Map();
  const bucketsWithRows = records || {};

  for (const file of files || []) {
    const needle = normaliseUrl(file.url);
    if (!needle) {
      usage.set(file.name, { state: 'unknown', hits: [] });
      continue;
    }
    const hits = [];
    for (const source of Object.values(bucketsWithRows).flat()) {
      const columns = source.columns || columnsFor(source.table);
      for (const row of source.rows || []) {
        const found = columns.some((column) => {
          const value = row?.[column];
          return typeof value === 'string' && normaliseUrl(value).includes(needle);
        });
        if (found) {
          hits.push({ label: source.label, title: row[source.title] || row.slug || '(untitled)' });
        }
      }
    }
    usage.set(file.name, { state: hits.length ? 'used' : 'unused', hits });
  }
  return usage;
}

export function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1048576) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1073741824) return `${(value / 1048576).toFixed(1)} MB`;
  return `${(value / 1073741824).toFixed(2)} GB`;
}

/* The snippet an author actually pastes. Markdown for the body, a bare URL for
   a field, and plain HTML when the body is HTML. */
export function snippetFor(url, kind = 'markdown', alt = '') {
  const raw = String(alt || '');
  const cleanAlt = raw.replace(/[\[\]]/g, '');
  /* Composed, not pasted: an alt with a quote in it would otherwise close the
     attribute and start a new one, and the snippet is copied by someone who
     trusts it. */
  const htmlAlt = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  switch (kind) {
    case 'html':
      return `<img src="${url}" alt="${htmlAlt}" loading="lazy">`;
    case 'url':
      return url;
    default:
      return `![${cleanAlt}](${url})`;
  }
}

export function summariseBucket(files, usage) {
  const total = (files || []).reduce((sum, file) => sum + (Number(file.size) || 0), 0);
  let used = 0;
  let unused = 0;
  let unknown = 0;
  for (const file of files || []) {
    const state = usage?.get(file.name)?.state;
    if (state === 'used') used += 1;
    else if (state === 'unused') unused += 1;
    else unknown += 1;
  }
  return { count: (files || []).length, total, used, unused, unknown };
}

/* ============================================================
   The screen
   ============================================================ */

const COLUMNS = {
  articles: 'title,slug,content,featured_image,document_url',
  products: 'name,slug,description,featured_image',
  osint_tools: 'name,slug,logo_url,description',
  pentest_tools: 'name,slug,logo_url,description'
};

export async function mountMedia(ctx) {
  const { supabase, esc, panel, notice, flash } = ctx;

  let bucket = BUCKETS[0].id;
  let query = '';
  let order = 'newest';
  let onlyUnused = false;

  panel.innerHTML = `<div class="admin-section-head">
      <div><h2 class="h-3">Media</h2><p class="tiny muted">Every file in storage, and whether a page still needs it. Unused files are the ones worth deleting on a free storage tier.</p></div>
    </div>
    <div class="admin-actions" style="margin-top:16px;gap:8px" role="tablist" aria-label="Buckets">
      ${BUCKETS.map(item => `<button type="button" class="btn btn-sm btn-secondary" data-bucket="${item.id}">${esc(item.label)}</button>`).join('')}
    </div>
    <p class="tiny muted" id="media-bucket-note" style="margin-top:8px"></p>
    <div class="admin-message-toolbar">
      <label class="admin-search"><span class="sr-only">Search files</span><input id="media-q" type="search" placeholder="Search file names…" autocomplete="off"></label>
      <label class="admin-status-filter"><span class="sr-only">Sort</span><select id="media-order">
        <option value="newest">Newest first</option>
        <option value="largest">Largest first</option>
        <option value="name">By name</option>
      </select></label>
      <label class="tiny" style="display:flex;align-items:center;gap:6px"><input id="media-unused" type="checkbox" style="width:auto"> Only unused</label>
    </div>
    <div class="flex justify-between items-center wrap gap-12" style="margin-top:14px">
      <p class="tiny muted" id="media-summary"></p>
      <div class="flex gap-8 items-center">
        <label class="btn btn-primary btn-sm" style="cursor:pointer;margin:0" id="media-upload-label">
          + Upload
          <input id="media-upload" type="file" style="display:none">
        </label>
        <button id="media-refresh" type="button" class="btn btn-secondary btn-sm">Refresh</button>
      </div>
    </div>
    <div id="media-grid" class="admin-media-grid" style="margin-top:16px"></div>`;

  const grid = document.querySelector('#media-grid');
  const summary = document.querySelector('#media-summary');
  const note = document.querySelector('#media-bucket-note');
  const search = document.querySelector('#media-q');
  const orderSelect = document.querySelector('#media-order');
  const unusedToggle = document.querySelector('#media-unused');
  const upload = document.querySelector('#media-upload');

  const paintTabs = () => {
    panel.querySelectorAll('[data-bucket]').forEach(button => {
      const active = button.dataset.bucket === bucket;
      button.className = `btn btn-sm ${active ? 'btn-primary' : 'btn-secondary'}`;
      button.onclick = () => {
        if (bucket === button.dataset.bucket) return;
        bucket = button.dataset.bucket;
        query = '';
        search.value = '';
        load();
      };
    });
    const config = BUCKETS.find(item => item.id === bucket);
    note.textContent = config ? config.note : '';
  };

  /* Rows that could reference a file in this bucket. A failure here is not a
     failure of the screen: it means usage cannot be judged, which is a state
     the badge already knows how to show. */
  const fetchUsage = async () => {
    const sources = SOURCES[bucket] || [];
    const records = [];
    for (const source of sources) {
      try {
        const { data, error } = await supabase.from(source.table)
          .select(COLUMNS[source.table] || '*')
          .limit(500);
        if (error) throw error;
        records.push({ table: source.table, label: source.label, title: source.title, rows: data || [] });
      } catch {
        /* Marked unknown below by leaving the source out and recording it. */
        records.push({ table: source.table, label: source.label, title: source.title, rows: null });
      }
    }
    return records;
  };

  const load = async () => {
    paintTabs();
    grid.innerHTML = '<p class="tiny muted">Loading storage…</p>';
    summary.textContent = '';

    const { data: objects, error } = await supabase.storage.from(bucket).list('', {
      limit: 500,
      sortBy: { column: 'created_at', order: 'desc' }
    });
    if (error) {
      grid.innerHTML = notice(`Could not list "${bucket}": ${error.message}`);
      return;
    }

    const config = BUCKETS.find(item => item.id === bucket);
    const files = (objects || [])
      .filter(object => object.name && object.name !== '.emptyFolderPlaceholder' && object.id)
      .map(object => {
        const { data } = config.isPublic
          ? supabase.storage.from(bucket).getPublicUrl(object.name)
          : { data: null };
        return {
          name: object.name,
          size: object.metadata?.size || 0,
          createdAt: object.created_at || null,
          url: data?.publicUrl || ''
        };
      });

    const records = await fetchUsage();
    const scanFailed = records.some(source => source.rows === null);
    const usage = findUsage(files, scanFailed
      ? Object.fromEntries(records.filter(source => source.rows).map(source => [source.table, [source]]))
      : { [bucket]: records });
    const stats = summariseBucket(files, usage);

    summary.textContent = `${stats.count} file(s) · ${formatBytes(stats.total)}`
      + (scanFailed ? ' · usage could not be checked' : ` · ${stats.unused} unused`);

    const needle = query.trim().toLowerCase();
    let shown = files.filter(file => !needle || file.name.toLowerCase().includes(needle));
    if (onlyUnused) shown = shown.filter(file => usage.get(file.name)?.state === 'unused');
    if (order === 'largest') shown.sort((a, b) => b.size - a.size);
    else if (order === 'name') shown.sort((a, b) => a.name.localeCompare(b.name));
    else shown.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

    if (!files.length) {
      grid.innerHTML = `<div class="admin-empty"><p class="muted">Nothing in <strong>${esc(bucket)}</strong> yet.</p></div>`;
      return;
    }
    if (!shown.length) {
      grid.innerHTML = `<div class="admin-empty"><p class="muted">Nothing matches${onlyUnused ? ' with "only unused"' : ''}${needle ? ` “${esc(query)}”` : ''}.</p></div>`;
      return;
    }

    const badge = (state, hits) => {
      if (state === 'used') return `<span class="tiny" style="color:var(--green,#1a7f37)" title="${esc(hits.map(hit => hit.title).join(', '))}">used in ${hits.length}</span>`;
      if (state === 'unused') return '<span class="tiny" style="color:var(--muted,#667085)">unused</span>';
      return '<span class="tiny" style="color:var(--amber,#9a6700)">usage unknown</span>';
    };

    grid.innerHTML = shown.map(file => {
      const info = usage.get(file.name) || { state: 'unknown', hits: [] };
      const isImage = /\.(png|jpe?g|webp|gif|svg|avif)$/i.test(file.name);
      return `<div class="admin-media-card">
        <div class="admin-media-thumb">
          ${isImage && file.url ? `<img src="${esc(file.url)}" alt="" loading="lazy">` : '<span aria-hidden="true">📄</span>'}
        </div>
        <div class="admin-media-name" title="${esc(file.name)}">${esc(file.name)}</div>
        <div class="admin-media-meta">${esc(formatBytes(file.size))}${file.createdAt ? ' · ' + esc(new Date(file.createdAt).toLocaleDateString()) : ''}</div>
        <div class="admin-media-meta">${badge(info.state, info.hits)}</div>
        ${info.state === 'used'
          ? `<ul class="tiny muted" style="margin:6px 0 0;padding-left:16px">${info.hits.slice(0, 3).map(hit => `<li>${esc(hit.label)}: ${esc(hit.title)}</li>`).join('')}</ul>`
          : ''}
        <div class="admin-media-actions">
          ${file.url ? `<button type="button" class="btn btn-secondary btn-sm" data-copy="${esc(file.url)}" data-copy-kind="url">URL</button>
          ${isImage ? `<button type="button" class="btn btn-secondary btn-sm" data-copy="${esc(file.url)}" data-copy-kind="markdown" data-name="${esc(file.name)}">MD</button>
          <button type="button" class="btn btn-secondary btn-sm" data-copy="${esc(file.url)}" data-copy-kind="html" data-name="${esc(file.name)}">HTML</button>` : ''}` : ''}
          <button type="button" class="btn btn-ghost btn-sm" data-delete="${esc(file.name)}" data-state="${info.state}" style="color:var(--red)">Delete</button>
        </div>
      </div>`;
    }).join('');

    grid.querySelectorAll('[data-copy]').forEach(button => button.onclick = async () => {
      const url = button.dataset.copy;
      const kind = button.dataset.copyKind || 'url';
      const alt = String(button.dataset.name || '').replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ');
      const text = snippetFor(url, kind, alt);
      try {
        await navigator.clipboard.writeText(text);
        flash(panel, kind === 'url' ? 'URL copied.' : `${kind === 'markdown' ? 'Markdown' : 'HTML'} snippet copied - paste it into the article body.`);
      } catch {
        window.prompt('Copy this:', text);
      }
    });

    grid.querySelectorAll('[data-delete]').forEach(button => button.onclick = async () => {
      const name = button.dataset.delete;
      const state = button.dataset.state;
      const info = usage.get(name) || { hits: [] };

      /* A file a page still links to is not deletable from here, and the
         refusal names the pages: "used somewhere" gives the admin nothing to
         act on. */
      if (state === 'used') {
        return flash(panel, `"${name}" is still used by: ${info.hits.map(hit => `${hit.label} "${hit.title}"`).join(', ')}. Remove it there first - deleting it now would break those pages.`);
      }
      const warning = state === 'unused'
        ? `Delete "${name}"? Nothing in the database references it.`
        : `Usage could not be checked for "${name}". A page may still link to it. Delete anyway?`;
      if (!confirm(warning)) return;

      button.disabled = true;
      const { error: deleteError } = await supabase.storage.from(bucket).remove([name]);
      if (deleteError) {
        button.disabled = false;
        return flash(panel, `Delete failed: ${deleteError.message}`);
      }
      flash(panel, `Deleted "${name}".`);
      load();
    });
  };

  upload.onchange = async () => {
    const file = upload.files && upload.files[0];
    if (!file) return;
    upload.disabled = true;
    flash(panel, `Checking and uploading ${file.name}…`);
    try {
      const validation = window.OMPFileValidate ? await window.OMPFileValidate.validateFile(file) : { ok: true, contentType: file.type };
      if (validation && !validation.ok) throw new Error(validation.error || 'File validation failed.');
      /* The original name is kept, minus anything a URL cannot carry. A
         timestamp prefix avoided collisions but made every file unreadable in
         the list, and the list is what you look at when something is off.
         A collision is resolved with a counter instead of overwriting: upsert
         would swap the file under a live page. */
      const base = String(file.name).replace(/[^a-zA-Z0-9._-]/g, '_');
      const dot = base.lastIndexOf('.');
      const stem = dot > 0 ? base.slice(0, dot) : base;
      const extension = dot > 0 ? base.slice(dot) : '';

      let savedAs = base;
      let uploadError = null;
      for (let attempt = 0; attempt < 20; attempt += 1) {
        savedAs = attempt === 0 ? base : `${stem}-${attempt + 1}${extension}`;
        const { error } = await supabase.storage.from(bucket).upload(savedAs, file, {
          contentType: validation.contentType || undefined,
          upsert: false
        });
        uploadError = error;
        if (!error) break;
        if (!/already exists|duplicate|resource already/i.test(error.message || '')) break;
      }
      if (uploadError) throw uploadError;
      flash(panel, savedAs === base ? `Uploaded "${savedAs}".` : `Uploaded as "${savedAs}" - a file with that name was already there.`);
      load();
    } catch (error) {
      flash(panel, `Upload failed: ${error.message || String(error)}`);
    } finally {
      upload.disabled = false;
      upload.value = '';
    }
  };

  search.addEventListener('input', () => { query = search.value; load(); });
  orderSelect.onchange = () => { order = orderSelect.value; load(); };
  unusedToggle.onchange = () => { onlyUnused = unusedToggle.checked; load(); };
  document.querySelector('#media-refresh').onclick = load;

  await load();
}
