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

import { mountMedia } from './media.js';

/* Tab order is the order people need things: what shipped, what redirects,
   what is in the library, and a backup of it. */
export const SECTION_TABS = [
  { key: 'deploys', label: 'Deploys' },
  { key: 'revisions', label: 'Revisions' },
  { key: 'redirects', label: 'Redirects' },
  { key: 'categories', label: 'Categories' },
  { key: 'media', label: 'Media' },
  { key: 'activity', label: 'Activity' },
  { key: 'setup', label: 'Setup' },
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

/* ------------------------------------------------------------------ setup */

async function mountSetup(ctx) {
  const { supabase, esc, panel } = ctx;
  const { diagnose, summarise, asText } = await import('./setup.js');

  panel.innerHTML = `<div class="admin-section-head">
      <div><h2 class="h-3">Setup</h2><p class="tiny muted">What the publishing pipeline needs, and which parts are missing. This screen never starts a deploy.</p></div>
      <button id="setup-refresh" type="button" class="btn btn-secondary btn-sm">Check again</button>
    </div>
    <div id="setup-summary" class="card card-pad" style="margin-top:16px" aria-live="polite"></div>
    <div id="setup-list" class="admin-list" style="margin-top:16px"></div>
    <div class="flex gap-8 wrap" style="margin-top:14px">
      <button id="setup-copy" type="button" class="btn btn-ghost btn-sm">Copy as text</button>
    </div>`;

  const summaryHost = document.querySelector('#setup-summary');
  const listHost = document.querySelector('#setup-list');

  const run = async () => {
    summaryHost.innerHTML = '<p class="tiny muted">Checking…</p>';
    listHost.innerHTML = '';

    /* Table probes are one row each with the user's own session. A permission
       error also lands here, which is correct: if you cannot read the table,
       the panel cannot use it. */
    const tableNames = ['articles', 'publish_jobs', 'redirects', 'article_revisions', 'audit_log', 'article_categories'];
    const tables = {};
    await Promise.all(tableNames.map(async (table) => {
      const { error } = await supabase.from(table).select('*', { head: true, count: 'exact' }).limit(1);
      tables[table] = !error;
    }));
    /* The category function is what makes deletion safe; probe the function
       itself rather than its table, which has existed all along. */
    const { error: categoryProbe } = await supabase.rpc('delete_article_category', { category: '00000000-0000-0000-0000-000000000000' });
    tables.categories = Boolean(categoryProbe) && !/could not find the function|does not exist|schema cache/i.test(categoryProbe.message);

    let probes = { tables };
    try {
      /* ping reports booleans about the function's own secrets and writes
         nothing. If it cannot be reached, the function is not deployed - which
         is a real answer, not a failure to check. */
      const { data, error } = await supabase.functions.invoke('content-publish', {
        body: { action: 'ping' }
      });
      if (error || !data?.ok) {
        probes.function = 'unreachable';
      } else {
        probes.function = 'ok';
        probes.configured = data.configured || {};
      }
    } catch {
      probes.function = 'unreachable';
    }

    const checks = diagnose(probes);
    const summary = summarise(checks);
    const tone = summary.canPublish ? 'var(--green, #1a7f37)' : 'var(--amber, #9a6700)';

    summaryHost.innerHTML = `<p style="color:${tone};font-weight:600">${esc(summary.headline)}</p>
      <p class="tiny muted" style="margin-top:6px">${summary.ok} of ${summary.total} ready${summary.unknown ? ` · ${summary.unknown} could not be checked` : ''}</p>`;

    const marks = { ok: '✓', missing: '✗', unknown: '?' };
    const colours = { ok: 'var(--green, #1a7f37)', missing: 'var(--red, #c0392b)', unknown: 'var(--muted, #667085)' };

    listHost.innerHTML = checks.map(check => `<div class="admin-row" style="align-items:flex-start">
        <div class="grow">
          <p><strong style="color:${colours[check.state]};margin-right:8px">${marks[check.state]}</strong>${esc(check.label)}</p>
          <p class="tiny muted" style="margin-top:4px">${esc(check.why)}</p>
          ${check.state === 'missing' ? `<p class="tiny" style="margin-top:6px"><code>${esc(check.fix)}</code></p>` : ''}
          ${check.state === 'unknown' ? '<p class="tiny muted" style="margin-top:6px">Could not be checked from here - not the same as missing.</p>' : ''}
        </div>
      </div>`).join('');

    document.querySelector('#setup-copy').onclick = async () => {
      const text = asText(checks, summary);
      try {
        await navigator.clipboard.writeText(text);
        summaryHost.insertAdjacentHTML('beforeend', '<p class="tiny muted" style="margin-top:6px">Copied.</p>');
      } catch {
        /* Clipboard permission is not guaranteed; showing the text is a fine
           fallback and keeps this usable on a locked-down browser. */
        window.prompt('Copy this:', text);
      }
    };
  };

  document.querySelector('#setup-refresh').onclick = run;
  await run();
}

/* --------------------------------------------------------------- activity */

async function mountActivity(ctx) {
  const { supabase, esc, panel, notice } = ctx;

  panel.innerHTML = `<div class="admin-section-head">
      <div><h2 class="h-3">Activity</h2><p class="tiny muted">Who changed what. Field names, not values - it answers "who unpublished this", not "what did it say".</p></div>
      <button id="activity-refresh" type="button" class="btn btn-secondary btn-sm">Refresh</button>
    </div>
    <div class="admin-message-toolbar">
      <label class="admin-search"><span class="sr-only">Search activity</span><input id="activity-q" type="search" placeholder="Title, slug, email…" autocomplete="off"></label>
      <label class="admin-status-filter"><span class="sr-only">Filter by table</span><select id="activity-table">
        <option value="all">Everything</option>
        <option value="articles">Articles</option>
        <option value="products">Products</option>
        <option value="tools">Tools</option>
        <option value="article_categories">Categories</option>
      </select></label>
    </div>
    <div id="activity-list" class="admin-list" style="margin-top:16px"></div>`;

  const list = document.querySelector('#activity-list');
  const search = document.querySelector('#activity-q');
  const tableFilter = document.querySelector('#activity-table');
  let token = 0;

  const paint = async () => {
    const mine = ++token;
    list.innerHTML = '<p class="tiny muted">Loading…</p>';

    let request = supabase.from('audit_log')
      .select('id,at,actor,actor_email,table_name,action,changed,detail')
      .order('at', { ascending: false })
      .limit(200);
    if (tableFilter.value !== 'all') request = request.eq('table_name', tableFilter.value);

    const { data, error } = await request;
    if (mine !== token) return;
    if (error) {
      return list.innerHTML = error.code === '42P01' || /does not exist/i.test(error.message)
        ? notice('audit_log does not exist yet - apply supabase/migrations/20261101170000_audit_log.sql first.')
        : notice(error.message);
    }

    const query = search.value.trim().toLowerCase();
    const rows = (data || []).filter(row => {
      if (!query) return true;
      const haystack = [row.actor_email, row.detail?.title, row.detail?.name, row.detail?.slug, row.table_name]
        .filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(query);
    });

    if (!rows.length) {
      list.innerHTML = `<p class="tiny muted">${query ? 'Nothing matches.' : 'Nothing recorded yet. The log fills as the panel is used.'}</p>`;
      return;
    }

    /* One line per entry, newest first. The verb is the thing being scanned for,
       so it leads and it is coloured. */
    const tone = { insert: 'var(--green, #1a7f37)', update: 'var(--muted, #667085)', delete: 'var(--red, #c0392b)' };
    const noun = { articles: 'article', products: 'product', tools: 'tool', article_categories: 'category' };

    list.innerHTML = rows.map(row => {
      const label = row.detail?.title || row.detail?.name || row.detail?.slug || '(unnamed)';
      const who = row.actor_email || 'automation (service role)';
      const fields = Array.isArray(row.changed) && row.changed.length
        ? row.changed.filter(field => field !== 'updated_at').slice(0, 8).join(', ')
        : '';
      return `<div class="admin-row">
        <div class="grow">
          <p><strong style="color:${tone[row.action] || 'inherit'}">${esc(row.action)}</strong>
             ${esc(noun[row.table_name] || row.table_name)}: ${esc(label)}</p>
          <p class="tiny muted" style="margin-top:4px">${esc(who)} · ${esc(when(row.at))}${fields ? ' · ' + esc(fields) : ''}</p>
        </div>
      </div>`;
    }).join('');
  };

  let timer;
  search.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(paint, 250);
  });
  tableFilter.addEventListener('change', paint);
  document.querySelector('#activity-refresh').onclick = paint;
  await paint();
}

/* ------------------------------------------------------------- categories */

async function mountCategories(ctx) {
  const { supabase, esc, panel, notice, flash, requestPublish, publishChip } = ctx;

  panel.innerHTML = `<div class="admin-section-head">
      <div><h2 class="h-3">Categories</h2><p class="tiny muted">The filter chips on /articles. A category's slug is what the chip links to, so it is set once and stays.</p></div>
    </div>
    <form id="cat-form" class="card card-pad" style="margin-top:16px">
      <div class="form-grid">
        <div class="form-field"><label for="cat-name">Name</label><input id="cat-name" name="name" placeholder="Guides" required maxlength="60"></div>
        <div class="form-field"><label for="cat-order">Order</label><input id="cat-order" name="sort_order" type="number" value="0" min="0" max="999" step="10"></div>
      </div>
      <p class="tiny muted" style="margin:8px 0 12px">The slug is made from the name. Two categories cannot share a name - the second would be invisible in the filter.</p>
      <div id="cat-msg" aria-live="polite"></div>
      <button type="submit" class="btn btn-primary btn-sm">Add category</button>
    </form>
    <div id="cat-list" class="admin-list" style="margin-top:18px"></div>`;

  const list = document.querySelector('#cat-list');
  const msg = document.querySelector('#cat-msg');

  const paint = async () => {
    list.innerHTML = '<p class="tiny muted">Loading…</p>';
    const [categories, articles] = await Promise.all([
      supabase.from('article_categories').select('id,name,slug,sort_order').order('sort_order').order('name'),
      supabase.from('articles').select('category_id').limit(2000)
    ]);
    if (categories.error) return list.innerHTML = notice(categories.error.message);

    const counts = new Map();
    for (const row of articles.data || []) {
      if (!row.category_id) continue;
      counts.set(row.category_id, (counts.get(row.category_id) || 0) + 1);
    }
    const uncategorised = (articles.data || []).filter(row => !row.category_id).length;
    const rows = categories.data || [];

    if (!rows.length) {
      list.innerHTML = '<p class="tiny muted">No categories yet. Without one, every article sits under "All".</p>';
      return;
    }

    list.innerHTML = rows.map(category => {
      const count = counts.get(category.id) || 0;
      return `<div class="admin-row">
        <div class="grow">
          <p><strong>${esc(category.name)}</strong> <span class="tiny muted">#/${esc(category.slug)}</span></p>
          <p class="tiny muted" style="margin-top:4px">${count} article${count === 1 ? '' : 's'} · order ${esc(String(category.sort_order ?? 0))}</p>
        </div>
        <div class="flex gap-8 wrap">
          <button type="button" class="btn btn-ghost btn-sm" data-rename="${esc(category.id)}">Rename</button>
          <button type="button" class="btn btn-ghost btn-sm" data-order="${esc(category.id)}">Order</button>
          <button type="button" class="btn btn-ghost btn-sm" data-remove="${esc(category.id)}" data-count="${count}" style="color:var(--red)">Delete</button>
        </div>
      </div>`;
    }).join('') + (uncategorised
      ? `<p class="tiny muted" style="margin-top:12px">${uncategorised} article(s) are not in any category. They still appear under All.</p>`
      : '');

    list.querySelectorAll('[data-rename]').forEach(button => button.onclick = async () => {
      const row = rows.find(item => item.id === button.dataset.rename);
      const name = prompt('New name', row?.name || '');
      if (name === null) return;
      const clean = name.trim();
      if (!clean) return flash(msg, 'A category needs a name.');
      /* The slug is deliberately untouched: it is the filter chip's link, and
         changing it breaks every shared "#/c/<slug>" URL. */
      const { error } = await supabase.from('article_categories').update({ name: clean }).eq('id', button.dataset.rename);
      if (error) return flash(msg, /unique|duplicate/i.test(error.message)
        ? `There is already a category called "${clean}".`
        : error.message);
      await paint();
      flash(msg, 'Renamed. The slug is unchanged, so existing links still filter.');
    });

    list.querySelectorAll('[data-order]').forEach(button => button.onclick = async () => {
      const row = rows.find(item => item.id === button.dataset.order);
      const value = prompt('Position in the filter row (lower first)', String(row?.sort_order ?? 0));
      if (value === null) return;
      const order = Number.parseInt(value, 10);
      if (!Number.isFinite(order) || order < 0) return flash(msg, 'Order must be a number from 0 up.');
      const { error } = await supabase.from('article_categories').update({ sort_order: order }).eq('id', button.dataset.order);
      if (error) return flash(msg, error.message);
      await paint();
    });

    list.querySelectorAll('[data-remove]').forEach(button => button.onclick = async () => {
      const row = rows.find(item => item.id === button.dataset.remove);
      const count = Number(button.dataset.count || 0);
      let moveTo = null;

      if (count > 0) {
        /* Deleting used to un-file every article in the category with no
           warning at all. Now the count is read out loud and the choice is
           explicit. */
        const others = rows.filter(item => item.id !== row.id);
        const options = others.map((item, index) => `${index + 1}. ${item.name}`).join('\n');
        const answer = prompt(
          `"${row.name}" has ${count} article${count === 1 ? '' : 's'}.\n\n` +
          `Type the number of a category to move them to, or leave empty to leave them uncategorised.\n\n${options || '(no other categories)'}`,
          ''
        );
        if (answer === null) return;
        const trimmed = answer.trim();
        if (trimmed) {
          const index = Number.parseInt(trimmed, 10) - 1;
          if (!others[index]) return flash(msg, 'That is not one of the numbers listed.');
          moveTo = others[index].id;
        }
      } else if (!confirm(`Delete "${row.name}"? It has no articles.`)) {
        return;
      }

      button.disabled = true;
      const { data, error } = await supabase.rpc('delete_article_category', { category: row.id, move_to: moveTo });
      button.disabled = false;

      if (error) {
        return flash(msg, /could not find the function|does not exist/i.test(error.message)
          ? 'The category function is not installed yet - apply supabase/migrations/20261101160000_categories.sql.'
          : error.message);
      }
      await paint();

      const moved = Number(data || 0);
      flash(msg, moved > 0
        ? `Deleted "${row.name}" and ${moveTo ? 'moved' : 'uncategorised'} ${moved} article(s).`
        : `Deleted "${row.name}".`);

      if (moved > 0) {
        const slot = document.createElement('div');
        msg.appendChild(slot);
        const publish = document.createElement('button');
        publish.type = 'button';
        publish.className = 'btn btn-primary btn-sm';
        publish.style.marginTop = '8px';
        publish.textContent = 'Update the site now';
        publish.onclick = async () => {
          publish.disabled = true;
          const started = await requestPublish('categories', ['/articles']);
          if (started.error) { publish.disabled = false; return flash(msg, started.error); }
          if (started.job_id && typeof publishChip === 'function') publishChip(slot, started.job_id, '/articles');
          else flash(msg, 'Deploy queued.');
        };
        slot.appendChild(publish);
      }
    });
  };

  document.querySelector('#cat-form').onsubmit = async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    const sortOrder = Number.parseInt(String(data.get('sort_order') || '0'), 10);
    msg.innerHTML = '';
    if (!name) return flash(msg, 'A category needs a name.');

    /* The slug comes from the database trigger, so it uses the same rule the
       CLI and the editor use. The insert sends the name and lets the trigger
       do it, rather than three copies of a regexp drifting apart. */
    const { error } = await supabase.from('article_categories').insert({
      name,
      slug: name,
      sort_order: Number.isFinite(sortOrder) ? sortOrder : 0
    });
    if (error) {
      return flash(msg, /unique|duplicate/i.test(error.message)
        ? `There is already a category with that name.`
        : /needs a slug/.test(error.message)
          ? 'That name has no letters or digits, so it cannot make a link. Add a word.'
          : error.message);
    }
    form.reset();
    document.querySelector('#cat-order').value = '0';
    await paint();
    flash(msg, `Added "${name}". It appears in the filter once the site rebuilds.`);
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
  categories: mountCategories,
  media: mountMedia,
  activity: mountActivity,
  setup: mountSetup,
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
