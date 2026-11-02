/* ============================================================
   Newsletter.

   The list of email addresses is revoked from every browser role, on purpose:
   anyone holding the publishable key could otherwise page through it. So this
   section never queries a table. It calls newsletter_overview(), which runs as
   the definer, checks is_admin() in the database, and returns exactly what is
   on screen.

   Two numbers are separated everywhere below, because they mean different
   things:

     pending  somebody typed an address
     active   somebody confirmed it

   A panel that adds them together reports an audience that does not exist, and
   the first campaign to that number is the moment it is discovered.
   ============================================================ */

const STATUS_LABEL = {
  active: 'confirmed',
  pending: 'waiting to confirm',
  unsubscribed: 'unsubscribed'
};

const STATUS_TONE = {
  active: 'var(--green, #1a7f37)',
  pending: 'var(--amber, #9a6700)',
  unsubscribed: 'var(--muted, #667085)'
};

const when = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString(undefined, { dateStyle: 'medium' });
};

export async function mountNewsletter(ctx) {
  const { supabase, esc, panel, notice, flash } = ctx;

  panel.innerHTML = `<div class="admin-section-head">
      <div><h2 class="h-3">Newsletter</h2><p class="tiny muted">Who is subscribed and whether the mail is going out. "Waiting to confirm" is not an audience.</p></div>
      <button id="news-refresh" type="button" class="btn btn-secondary btn-sm">Refresh</button>
    </div>
    <div id="news-body" style="margin-top:16px"><p class="tiny muted">Loading…</p></div>`;

  const body = document.querySelector('#news-body');
  let latest = null;

  const paint = () => {
    const data = latest;
    if (!data) return;
    const subscribers = data.subscribers || {};
    const deliveries = data.deliveries || {};

    const stat = (label, value, note = '', tone = 'inherit') => `<div class="card card-pad" style="min-width:140px;flex:1">
        <p class="tiny muted">${esc(label)}</p>
        <p style="font-size:1.6rem;font-weight:700;color:${tone};line-height:1.2;margin-top:4px">${esc(String(value))}</p>
        ${note ? `<p class="tiny muted" style="margin-top:2px">${esc(note)}</p>` : ''}
      </div>`;

    const stuck = deliveries.failed || 0;
    const recent = Array.isArray(data.recent) ? data.recent : [];
    const problems = Array.isArray(data.problems) ? data.problems : [];

    body.innerHTML = `
      <div class="flex gap-12 wrap">
        ${stat('Confirmed', subscribers.active || 0, `${subscribers.joined_7d || 0} in the last 7 days`, 'var(--green, #1a7f37)')}
        ${stat('Waiting to confirm', subscribers.pending || 0, 'typed an address, never clicked the link', 'var(--amber, #9a6700)')}
        ${stat('Unsubscribed', subscribers.unsubscribed || 0, 'kept so they cannot be mailed again')}
        ${stat('Deliveries', `${deliveries.sent || 0} sent`, stuck ? `${stuck} failed` : 'nothing failed', stuck ? 'var(--red, #c0392b)' : 'inherit')}
      </div>

      ${stuck ? `<div class="card card-pad" style="margin-top:18px;border-color:rgba(192,57,43,.4)">
        <h3 class="h-4" style="color:var(--red,#c0392b)">${stuck} delivery attempt(s) gave up</h3>
        <p class="tiny muted" style="margin-top:6px">These were retried five times or left longer than the provider's 24-hour idempotency window. They are not retried automatically, because a duplicate email is worse than a missing one. Send it by hand from the list below.</p>
        <div class="admin-list" style="margin-top:12px">
          ${problems.map(item => `<div class="admin-row">
            <div class="grow">
              <p class="tiny"><strong>${esc(item.title || 'article')}</strong> → ${esc(item.email || '')}</p>
              <p class="tiny muted" style="margin-top:2px">${esc(String(item.attempts))} attempt(s), first ${esc(when(item.first_attempt_at))}</p>
            </div>
          </div>`).join('') || '<p class="tiny muted">No details available.</p>'}
        </div>
      </div>` : ''}

      <h3 class="h-4" style="margin-top:24px">Recent signups</h3>
      <div class="form-field" style="margin-top:10px;max-width:380px">
        <label for="news-filter" class="sr-only">Filter subscribers</label>
        <input id="news-filter" type="search" placeholder="Filter by address…" autocomplete="off">
      </div>
      <div class="admin-list" id="news-list" style="margin-top:10px"></div>
      <p class="tiny muted" style="margin-top:14px">Showing the ${recent.length} most recent of ${subscribers.total || 0}. Newer subscribers replace older ones here; this is a support view, not an export.</p>`;

    const list = document.querySelector('#news-list');
    const filter = document.querySelector('#news-filter');

    const paintRows = (query) => {
      const needle = String(query || '').trim().toLowerCase();
      const rows = recent.filter(row => !needle || String(row.email || '').toLowerCase().includes(needle));
      if (!rows.length) {
        list.innerHTML = `<p class="tiny muted">${needle ? 'No address matches.' : 'Nobody has subscribed yet.'}</p>`;
        return;
      }
      list.innerHTML = rows.map(row => `<div class="admin-row">
          <div class="grow">
            <p class="tiny"><strong>${esc(row.email)}</strong></p>
            <p class="tiny" style="margin-top:2px;color:${STATUS_TONE[row.status] || 'inherit'}">${esc(STATUS_LABEL[row.status] || row.status)}${row.confirmed_at ? ` · confirmed ${esc(when(row.confirmed_at))}` : ''} · joined ${esc(when(row.created_at))}</p>
          </div>
          ${row.status === 'unsubscribed'
            ? `<button type="button" class="btn btn-ghost btn-sm" data-status="${esc(row.id)}" data-to="active">Re-subscribe</button>`
            : `<button type="button" class="btn btn-ghost btn-sm" data-status="${esc(row.id)}" data-to="unsubscribed" style="color:var(--red)">Unsubscribe</button>`}
        </div>`).join('');

      list.querySelectorAll('[data-status]').forEach(button => button.onclick = async () => {
        const to = button.dataset.to;
        const address = button.closest('.admin-row')?.querySelector('strong')?.textContent || 'this address';
        /* Removing somebody is irreversible from their side: they would have to
           sign up and confirm again. Ask, in their words, not in database words. */
        const ask = to === 'unsubscribed'
          ? `Unsubscribe ${address}?\n\nAny mail queued for them is cancelled. They can subscribe again, but only by confirming a new link.`
          : `Put ${address} back on the list?\n\nThey were removed before. Only do this if they asked to be re-added - not because the number looked better.`;
        if (!confirm(ask)) return;

        button.disabled = true;
        const { error } = await supabase.rpc('newsletter_set_status', { subscriber: button.dataset.status, new_status: to });
        button.disabled = false;
        if (error) {
          return flash(body, /could not find the function|does not exist/i.test(error.message)
            ? 'The newsletter functions are not installed yet - apply supabase/migrations/20261101180000_newsletter_admin.sql.'
            : error.message);
        }
        flash(body, to === 'unsubscribed' ? 'Unsubscribed, and queued mail cancelled.' : 'Back on the list.');
        await load();
      });
    };

    filter.addEventListener('input', () => paintRows(filter.value));
    paintRows('');
  };

  const load = async () => {
    const { data, error } = await supabase.rpc('newsletter_overview');
    if (error) {
      body.innerHTML = /could not find the function|does not exist|schema cache/i.test(error.message)
        ? notice('The newsletter functions are not installed yet - apply supabase/migrations/20261101180000_newsletter_admin.sql.')
        : notice(error.message);
      return;
    }
    latest = data;
    paint();
  };

  document.querySelector('#news-refresh').onclick = load;
  await load();
}
