/* ============================================================
   OopsMyPassword — no-backend Article Manager (/admin/).
   100% client-side: working copy lives in localStorage, publishing
   = exporting one articles.json and placing it in the repo/hosting.
   It never phones home and never pretends to.
   ============================================================ */
(function () {
  'use strict';

  var root = document.querySelector('[data-admin]');
  if (!root) return;

  var WORK_KEY = 'omp-admin-work';
  var PREV_KEY = 'omp-admin-preview';
  var state = { articles: [], live: {}, dirty: false, view: 'list', editSlug: null, liveFetched: false };
  var previewFlags = loadJSON(PREV_KEY, {});

  function loadJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || 'null') || fallback; } catch (e) { return fallback; }
  }
  function persist() {
    try {
      localStorage.setItem(WORK_KEY, JSON.stringify({ articles: state.articles }));
      localStorage.setItem(PREV_KEY, JSON.stringify(previewFlags));
    } catch (e) { window.ompToast('Could not save — browser storage unavailable'); }
  }
  function slugify(s) {
    return (s || '').toLowerCase().trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }
  function estMinutes(html) {
    var tmp = document.createElement('div');
    tmp.innerHTML = html || '';
    var words = (tmp.textContent || '').trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 200));
  }
  function sanitize(html) {
    return window.OMPSanitize ? window.OMPSanitize(html) : html;
  }

  /* ---------- bootstrap ---------- */
  function init() {
    var saved = loadJSON(WORK_KEY, null);
    if (saved && Array.isArray(saved.articles)) {
      state.articles = saved.articles;
    }
    fetch('/content/articles.json', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : { articles: [] }; })
      .then(function (data) {
        state.liveFetched = true;
        (data.articles || []).forEach(function (a) {
          state.live[a.slug] = a;
          // adopt live articles the owner hasn't edited locally
          if (!state.articles.some(function (x) { return x.slug === a.slug; })) {
            state.articles.push(JSON.parse(JSON.stringify(a)));
          }
        });
        render();
      })
      .catch(function () { state.liveFetched = true; render(); });
    render();
  }

  function isOverride(a) {
    var live = state.live[a.slug];
    return !!live && JSON.stringify(live) !== JSON.stringify(a);
  }

  /* ---------- views ---------- */
  function render() {
    if (state.view === 'edit') return renderEditor();
    if (state.view === 'help') return renderHelp();
    renderList();
  }

  function topbar(extra) {
    return '' +
      '<div class="admin-actions" style="margin-bottom:20px">' +
      '<button class="btn btn-primary btn-sm" data-act="new">+ New article</button>' +
      '<button class="btn btn-secondary btn-sm" data-act="export">Export articles.json</button>' +
      '<button class="btn btn-secondary btn-sm" data-act="copy">Copy JSON</button>' +
      '<button class="btn btn-secondary btn-sm" data-act="import">Import…</button>' +
      '<button class="btn btn-ghost btn-sm" data-act="reload">Reload from live site</button>' +
      '<button class="btn btn-ghost btn-sm" data-act="help">How publishing works</button>' +
      '<span style="flex:1"></span>' +
      (state.dirty ? '<span class="tiny muted"><span class="unsaved-dot"></span> Unsaved local changes</span>' : '<span class="tiny muted">All changes saved in this browser</span>') +
      (extra || '') +
      '</div><input type="file" id="adm-import-file" accept="application/json,.json" hidden>';
  }

  function renderList() {
    var rows = state.articles
      .slice()
      .sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); })
      .map(function (a) {
        var badges = [];
        badges.push(a.status === 'published'
          ? '<span class="adm-badge adm-pub">Published</span>'
          : '<span class="adm-badge adm-draft">Draft</span>');
        if (previewFlags[a.slug]) badges.push('<span class="adm-badge adm-preview">Device preview</span>');
        if (isOverride(a)) badges.push('<span class="adm-badge adm-override">Local override</span>');
        return '' +
          '<div class="admin-row">' +
          '<div class="grow"><div class="ttl">' + esc(a.title) + '</div>' +
          '<div class="meta">/' + esc(a.slug) + ' · ' + esc(a.category || '—') + ' · ' + esc(a.date || 'no date') + ' · ' + (a.minutes || '—') + ' min ' + badges.join(' ') + '</div></div>' +
          '<div class="row-btns">' +
          '<a class="btn btn-ghost btn-sm" href="/blog.html#/' + encodeURIComponent(a.slug) + '" target="_blank" rel="noopener">View</a>' +
          '<button class="btn btn-secondary btn-sm" data-edit="' + esc(a.slug) + '">Edit</button>' +
          '<button class="btn btn-ghost btn-sm" data-dup="' + esc(a.slug) + '">Duplicate</button>' +
          '<button class="btn btn-ghost btn-sm" data-del="' + esc(a.slug) + '" style="color:var(--red)">Delete</button>' +
          '</div></div>';
      }).join('');

    root.innerHTML = topbar() +
      '<div class="card card-pad">' +
      '<div class="flex justify-between items-center wrap gap-12" style="margin-bottom:16px">' +
      '<div><h2 class="h-3">Working copy <span class="muted" style="font-weight:400">(' + state.articles.length + ' article' + (state.articles.length === 1 ? '' : 's') + ')</span></h2>' +
      '<p class="tiny muted" style="margin-top:4px">Live site: ' + Object.keys(state.live).length + ' published from articles.json' + (state.liveFetched ? '' : ' (checking…)') + '</p></div>' +
      (state.articles.length ? '<span class="tiny muted">Changes here affect only this browser until you export.</span>' : '') +
      '</div>' +
      (state.articles.length
        ? '<div class="admin-list">' + rows + '</div>'
        : '<div class="admin-empty"><h3 class="h-3">No articles in your working copy yet</h3><p class="muted" style="margin:8px auto 0;max-width:420px">Click “New article” to write your first post — it renders on the Articles feed the moment you export and upload the JSON.</p></div>') +
      '</div>' +
      publishNote();
    bindList();
  }

  function publishNote() {
    return '' +
      '<div class="notice-band mt-24"><svg class="icon-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>' +
      '<p><strong>To make an article public:</strong> mark it “Published”, click “Export articles.json”, then place that file at <span class="mono">content/articles.json</span> in the repo — via the GitHub web upload, <span class="mono">git push</span>, or your deployment flow. The Articles feed picks it up immediately (no rebuild needed). See “How publishing works”.</p></div>';
  }

  /* ---------- editor ---------- */
  function renderEditor() {
    var a = state.articles.filter(function (x) { return x.slug === state.editSlug; })[0];
    if (!a) { state.view = 'list'; return render(); }
    var cats = ['News', 'Deep Dives', 'How-To', 'Fundamentals', 'Opinion'];
    (state.articles || []).forEach(function (x) { if (x.category && cats.indexOf(x.category) === -1) cats.push(x.category); });

    root.innerHTML = topbar('') +
      '<div class="card card-pad">' +
      '<div class="flex justify-between items-center wrap gap-12" style="margin-bottom:18px">' +
      '<h2 class="h-3">Editing: <span class="grad-text">' + esc(a.title || 'Untitled') + '</span></h2>' +
      '<div class="flex gap-8 wrap">' +
      '<button class="btn btn-ghost btn-sm" data-act="back">← Back</button>' +
      '<button class="btn btn-secondary btn-sm" data-act="save-preview">Save & preview</button>' +
      '<button class="btn btn-primary btn-sm" data-act="save">Save</button>' +
      '</div></div>' +
      '<div class="editor-grid">' +
      '<div class="editor-fields">' +
      '<div class="editor-row-2">' +
      '<div class="form-field"><label for="adm-title">Title</label><input id="adm-title" value="' + esc(a.title) + '" maxlength="140"></div>' +
      '<div class="form-field"><label for="adm-slug">Slug (URL)</label><input id="adm-slug" class="mono" value="' + esc(a.slug) + '" maxlength="120"></div>' +
      '</div>' +
      '<div class="editor-row-3">' +
      '<div class="form-field"><label for="adm-cat">Category</label><input id="adm-cat" list="adm-cats" value="' + esc(a.category || '') + '"><datalist id="adm-cats">' + cats.map(function (c) { return '<option value="' + esc(c) + '">'; }).join('') + '</datalist></div>' +
      '<div class="form-field"><label for="adm-date">Date</label><input id="adm-date" type="date" value="' + esc(a.date || today()) + '"></div>' +
      '<div class="form-field"><label for="adm-min">Minutes (auto if blank)</label><input id="adm-min" type="number" min="1" max="99" value="' + (a.minutes || '') + '"></div>' +
      '</div>' +
      '<div class="form-field"><label for="adm-desc">Description (excerpt & meta description)</label><textarea id="adm-desc" maxlength="220" style="min-height:70px">' + esc(a.description || '') + '</textarea></div>' +
      '<div class="editor-row-2">' +
      '<div class="opt-row"><div><div class="opt-name">Published</div><div class="opt-desc">Off = draft, hidden from the feed</div></div><span class="switch"><input type="checkbox" id="adm-pub"' + (a.status === 'published' ? ' checked' : '') + '><span class="track"></span></span></div>' +
      '<div class="opt-row"><div><div class="opt-name">Preview on this device</div><div class="opt-desc">Show it in the Articles feed in this browser only</div></div><span class="switch"><input type="checkbox" id="adm-prev"' + (previewFlags[a.slug] ? ' checked' : '') + '><span class="track"></span></span></div>' +
      '</div>' +
      '<div class="form-field"><label>Body (HTML — sanitized on render; scripts are stripped)</label>' +
      toolbar() +
      '<textarea id="adm-body" class="body-editor" spellcheck="false">' + esc(a.body || '') + '</textarea></div>' +
      '</div>' +
      '<div>' +
      '<div class="preview-head"><h3 class="h-3">Live preview</h3><button class="btn btn-ghost btn-sm" data-act="refresh-preview">Refresh</button></div>' +
      '<iframe class="preview-frame" id="adm-frame" title="Article preview" sandbox="allow-same-origin"></iframe>' +
      '</div>' +
      '</div></div>';
    bindEditor(a);
    refreshFrame(a);
  }

  function toolbar() {
    var btns = [
      ['H2', '<h2>Heading</h2>\n'], ['H3', '<h3>Subheading</h3>\n'],
      ['¶', '<p>Text…</p>\n'],
      ['• list', '<ul>\n  <li>Point</li>\n</ul>\n'],
      ['1. list', '<ol>\n  <li>Step</li>\n</ol>\n'],
      ['B', '<strong>bold</strong>'], ['I', '<em>italic</em>'],
      ['</>', '<code>code</code>'],
      ['{ }', '<pre><code>snippet</code></pre>\n'],
      ['🔗', '<a href="https://example.com">link text</a>'],
      ['💡 tip', '<div class="callout callout-tip"><p>Tip…</p></div>\n'],
      ['⚠ warn', '<div class="callout callout-warn"><p>Warning…</p></div>\n'],
      ['➖', '<hr class="hr-fade">\n']
    ];
    return '<div class="toolbar" style="margin-bottom:8px">' + btns.map(function (b, i) {
      return '<button type="button" data-snip="' + i + '" title="Insert">' + b[0] + '</button>';
    }).join('') + '</div><template id="adm-snippets">' + btns.map(function (b) {
      return '<span>' + b[1] + '</span>';
    }).join('') + '</template>';
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function insertSnippet(ta, snippet) {
    var s = ta.selectionStart || 0, e = ta.selectionEnd || 0;
    var sel = ta.value.slice(s, e);
    var text = snippet;
    if (sel && snippet.indexOf('…') === -1 && snippet.length < 60 && !/^<h|^<ul|^<ol|^<pre|^<div|^<hr/.test(snippet)) {
      // wrap selection for inline snippets like <strong>..</strong>
      var m = snippet.match(/^(<[^>]+>)(.+)(<\/[^>]+>)$/);
      if (m) text = m[1] + sel + m[3];
    }
    ta.setRangeText(text, s, e, 'end');
    ta.focus();
  }

  function refreshFrame(a) {
    var frame = root.querySelector('#adm-frame');
    if (!frame) return;
    var head = '' +
      '<base href="' + location.origin + '/">' +
      '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<link rel="stylesheet" href="/assets/css/styles.css">' +
      '<script src="/assets/js/theme-init.js"><\/script>' +
      '<style>body{padding:24px;background:var(--bg)}</style>';
    var doc = head +
      '<div class="prose"><span style="font-size:.8rem;color:var(--purple);font-weight:700;text-transform:uppercase;letter-spacing:.06em">' + esc(a.category || 'Article') + '</span>' +
      '<h1 class="h-1">' + esc(a.title || 'Untitled') + '</h1>' +
      '<p class="lead">' + esc(a.description || '') + '</p><hr class="hr-fade">' +
      sanitize(collectBody(a)) + '</div>';
    frame.srcdoc = doc;
  }

  function readEditorInto(a) {
    var val = function (id) { var el = document.getElementById(id); return el ? el.value : ''; };
    a.title = val('adm-title').trim();
    a.slug = slugify(val('adm-slug')) || slugify(a.title);
    a.category = val('adm-cat').trim() || 'Article';
    a.date = val('adm-date') || today();
    a.minutes = parseInt(val('adm-min'), 10) || 0;
    a.description = val('adm-desc').trim();
    a.status = document.getElementById('adm-pub').checked ? 'published' : 'draft';
    a.body = document.getElementById('adm-body').value;
    if (!a.minutes) a.minutes = estMinutes(a.body);
    previewFlags[a.slug] = document.getElementById('adm-prev').checked && a.status === 'published';
    if (!previewFlags[a.slug]) delete previewFlags[a.slug];
    return a;
  }
  function collectBody(a) {
    var el = document.getElementById('adm-body');
    return el ? el.value : (a.body || '');
  }
  function validate(a) {
    if (!a.title) return 'Give the article a title first.';
    if (!a.slug) return 'The article needs a slug.';
    var clash = state.articles.some(function (x) { return x.slug === a.slug && x !== a; });
    if (clash) return 'Another article already uses the slug "' + a.slug + '".';
    if (!(a.body || '').trim()) return 'The body is empty — write something first.';
    return null;
  }

  /* ---------- events ---------- */
  function bindList() {
    root.querySelectorAll('[data-edit]').forEach(function (b) {
      b.addEventListener('click', function () { state.editSlug = b.dataset.edit; state.view = 'edit'; render(); });
    });
    root.querySelectorAll('[data-dup]').forEach(function (b) {
      b.addEventListener('click', function () {
        var src = state.articles.filter(function (x) { return x.slug === b.dataset.dup; })[0];
        if (!src) return;
        var copy = JSON.parse(JSON.stringify(src));
        copy.title = src.title + ' (copy)';
        copy.slug = uniqueSlug(src.slug);
        copy.status = 'draft';
        state.articles.push(copy);
        state.dirty = true; persist(); render();
        window.ompToast('Duplicated as draft');
      });
    });
    root.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        var slug = b.dataset.del;
        if (!confirm('Delete "' + slug + '" from your working copy? (The live site is unaffected until you export.)')) return;
        state.articles = state.articles.filter(function (x) { return x.slug !== slug; });
        delete previewFlags[slug];
        state.dirty = true; persist(); render();
      });
    });
    bindTopbar();
  }

  function bindEditor(a) {
    var ta = document.getElementById('adm-body');
    root.querySelectorAll('[data-snip]').forEach(function (b) {
      b.addEventListener('click', function () {
        var snips = document.getElementById('adm-snippets').children;
        insertSnippet(ta, snips[Number(b.dataset.snip)].textContent);
      });
    });
    var titleEl = document.getElementById('adm-title');
    titleEl.addEventListener('input', function () {
      var slugEl = document.getElementById('adm-slug');
      if (!slugEl.dataset.touched) slugEl.value = slugify(titleEl.value);
    });
    document.getElementById('adm-slug').addEventListener('input', function (e) { e.target.dataset.touched = '1'; });
    root.querySelector('[data-act="refresh-preview"]').addEventListener('click', function () { refreshFrame(a); });
    root.querySelectorAll('[data-act]').forEach(function (b) {
      var act = b.dataset.act;
      if (act === 'save' || act === 'save-preview') {
        b.addEventListener('click', function () {
          readEditorInto(a);
          var err = validate(a);
          if (err) { window.ompToast(err); return; }
          // handle slug rename cleanup
          if (state.editSlug && state.editSlug !== a.slug) delete previewFlags[state.editSlug];
          state.editSlug = a.slug;
          state.dirty = true; persist();
          window.ompToast('Saved in this browser');
          if (act === 'save-preview') { renderList(); location.href = '/blog.html#/' + encodeURIComponent(a.slug); }
          else render();
        });
      }
      if (act === 'back') b.addEventListener('click', function () { state.view = 'list'; render(); });
    });
    bindTopbar();
    // autosave on input (cheap enough)
    root.querySelectorAll('#adm-title,#adm-slug,#adm-cat,#adm-date,#adm-min,#adm-desc,#adm-body,#adm-pub,#adm-prev').forEach(function (el) {
      el.addEventListener('change', function () {
        readEditorInto(a); state.dirty = true; persist();
      });
    });
  }

  function uniqueSlug(base) {
    var s = base + '-2', i = 2;
    while (state.articles.some(function (x) { return x.slug === s; })) { i++; s = base + '-' + i; }
    return s;
  }

  function bindTopbar() {
    var map = {
      'new': function () {
        var a = { slug: uniqueSlug('untitled'), title: '', category: 'Article', date: today(), minutes: 0, status: 'draft', description: '', body: '' };
        state.articles.push(a);
        state.editSlug = a.slug;
        state.view = 'edit'; render();
      },
      'export': doExport,
      'copy': function () {
        window.ompCopy(buildExportJSON(), 'articles.json copied to clipboard');
      },
      'import': function () { document.getElementById('adm-import-file').click(); },
      'reload': function () {
        if (state.dirty && !confirm('Merge with the live articles.json again? Your local edits stay; this only adds any new live articles.')) return;
        location.reload();
      },
      'help': function () { state.view = state.view === 'help' ? 'list' : 'help'; render(); }
    };
    root.querySelectorAll('[data-act]').forEach(function (b) {
      if (map[b.dataset.act]) b.addEventListener('click', map[b.dataset.act]);
    });
    var file = document.getElementById('adm-import-file');
    if (file && !file.dataset.bound) {
      file.dataset.bound = '1';
      file.addEventListener('change', function () {
        var f = file.files && file.files[0];
        if (!f) return;
        var reader = new FileReader();
        reader.onload = function () {
          try {
            var data = JSON.parse(reader.result);
            if (!Array.isArray(data.articles)) throw new Error('missing articles array');
            state.articles = data.articles;
            state.dirty = true; persist(); state.view = 'list'; render();
            window.ompToast('Imported ' + data.articles.length + ' articles');
          } catch (e) { window.ompToast('Import failed: ' + e.message); }
        };
        reader.readAsText(f);
      });
    }
  }

  function buildExportJSON() {
    var pub = state.articles
      .filter(function (a) { return a.status === 'published'; })
      .sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
    return JSON.stringify({ version: 1, articles: pub }, null, 2) + '\n';
  }

  function doExport() {
    var unresolved = state.articles.filter(function (a) { return a.status === 'published'; }).filter(validate);
    if (unresolved.length) {
      window.ompToast('Fix invalid published articles first (e.g. "' + (unresolved[0].title || unresolved[0].slug) + '")');
      return;
    }
    var blob = new Blob([buildExportJSON()], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'articles.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400);
    window.ompToast('articles.json downloaded — place it at content/articles.json');
  }

  function renderHelp() {
    root.innerHTML = topbar('') +
      '<div class="card card-pad prose" style="max-width:none">' +
      '<h2 class="h-2">How publishing works without a backend</h2>' +
      '<p>The Articles feed (<a href="/blog.html">/blog.html</a>) reads <code>content/articles.json</code> — a plain static file. This panel maintains a working copy in your browser only. Publishing = replacing that JSON file on your host. On <strong>Firebase Hosting</strong> you have three easy paths:</p>' +
      '<ol class="help-ol">' +
      '<li><strong>GitHub web UI (no terminal):</strong> Export the file here → in your repo on GitHub, open <code>content/</code> → “Add file → Upload files” → drop in <code>articles.json</code> → commit. If you connect the repo to Firebase Hosting (or CI), deploys happen automatically on push.</li>' +
      '<li><strong>Firebase CLI:</strong> Export here → save as <code>content/articles.json</code> in your local clone → <code>firebase deploy --only hosting</code>. Takes seconds.</li>' +
      '<li><strong>Git push:</strong> same replace, then commit & push — your CI action deploys.</li>' +
      '</ol>' +
      '<h3>Good to know</h3>' +
      '<ul>' +
      '<li><strong>Drafts</strong> are excluded from export. “Preview on this device” shows a published article on this browser before it goes live.</li>' +
      '<li><strong>SEO:</strong> dynamic articles are rendered in the browser (fine for news/updates). Content that must rank in search belongs in the static <a href="/guides.html">guides</a> — add it in <code>tools/omp_build/</code> and run <code>python3 tools/build.py</code>.</li>' +
      '<li><strong>Sanitizing:</strong> article HTML passes through a whitelist renderer — scripts, iframes and event handlers are stripped before display.</li>' +
      '<li><strong>Backup:</strong> your working copy survives reloads (localStorage). Use Export regularly as your backup; Import restores it on any machine.</li>' +
      '<li>This panel needs no login because it can change nothing outside your browser. Anyone who opens it only ever edits their own local copy.</li>' +
      '</ul>' +
      '<button class="btn btn-secondary btn-sm mt-16" data-act="help">Close</button>' +
      '</div>';
    bindTopbar();
    root.querySelectorAll('[data-act="help"]').forEach(function (b) {
      b.addEventListener('click', function () { state.view = 'list'; render(); });
    });
  }

  init();
})();
