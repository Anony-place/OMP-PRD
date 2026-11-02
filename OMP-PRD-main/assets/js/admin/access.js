/* ============================================================
   Access: who can open this panel.

   profiles is service-role-write-only, on purpose. Before this screen, adding
   an admin meant an UPDATE in the SQL editor - where a missing WHERE grants
   everybody access, and the same statement aimed the other way removes the last
   person who can publish.

   The panel therefore never touches profiles. It calls set_admin_access(),
   which refuses to remove you and refuses to leave nobody, and which writes the
   change to the activity log while doing it.
   ============================================================ */

const when = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString(undefined, { dateStyle: 'medium' });
};

export async function mountAccess(ctx) {
  const { supabase, esc, panel, notice, flash } = ctx;

  panel.innerHTML = `<div class="admin-section-head">
      <div><h2 class="h-3">Access</h2><p class="tiny muted">Who can open this panel. Changes are recorded in Activity.</p></div>
      <button id="access-refresh" type="button" class="btn btn-secondary btn-sm">Refresh</button>
    </div>
    <div id="access-summary" class="card card-pad" style="margin-top:16px"></div>
    <form id="access-form" class="card card-pad" style="margin-top:16px">
      <div class="form-field">
        <label for="access-email">Give someone access</label>
        <input id="access-email" name="email" type="email" placeholder="their login email" required autocomplete="off">
        <p class="tiny muted" style="margin-top:6px">They need an account first - sign in once, then come back here. An address with no account is refused rather than created, because a password is not something this panel can invent.</p>
      </div>
      <div id="access-msg" aria-live="polite"></div>
      <button type="submit" class="btn btn-primary btn-sm">Make admin</button>
    </form>
    <div id="access-list" class="admin-list" style="margin-top:18px"></div>`;

  const summary = document.querySelector('#access-summary');
  const list = document.querySelector('#access-list');
  const msg = document.querySelector('#access-msg');
  const form = document.querySelector('#access-form');
  let me = null;

  const paint = (admins, counts) => {
    summary.innerHTML = `<p><strong>${esc(String(counts?.admins ?? admins.length))}</strong> admin(s) · <strong>${esc(String(counts?.accounts ?? '?'))}</strong> account(s) signed up</p>
      <p class="tiny muted" style="margin-top:6px">Everyone else who signs in is a learner. They can read the site; they cannot change it.</p>`;

    list.innerHTML = admins.map(admin => {
      const isMe = me && admin.id === me;
      return `<div class="admin-row">
        <div class="grow">
          <p><strong>${esc(admin.email || '(no email)')}</strong>${isMe ? ' <span class="tiny muted">· you</span>' : ''}</p>
          <p class="tiny muted" style="margin-top:4px">admin since ${esc(when(admin.created_at))}</p>
        </div>
        ${isMe
          ? '<span class="tiny muted">cannot remove yourself</span>'
          : `<button type="button" class="btn btn-ghost btn-sm" data-remove="${esc(admin.id)}" data-email="${esc(admin.email || '')}" style="color:var(--red)">Remove access</button>`}
      </div>`;
    }).join('') || '<p class="tiny muted">Nobody has access. That should be impossible while you are reading this.</p>';

    list.querySelectorAll('[data-remove]').forEach(button => button.onclick = async () => {
      const email = button.dataset.email;
      /* Say what it means, not what it does. "Remove" is one click away from
         locking a colleague out mid-edit. */
      if (!confirm(`Remove admin access from ${email}?\n\nThey keep their account and can still read the site. They cannot open this panel again until somebody adds them back.`)) return;
      button.disabled = true;
      const { error } = await supabase.rpc('set_admin_access', { target_email: email, make_admin: false });
      button.disabled = false;
      if (error) return flash(msg, error.message);
      flash(msg, `${email} no longer has access.`);
      await load();
    });
  };

  const load = async () => {
    list.innerHTML = '<p class="tiny muted">Loading…</p>';
    const [{ data: admins, error }, { data: counts }, { data: { user } }] = await Promise.all([
      supabase.rpc('list_admins'),
      supabase.rpc('admin_counts'),
      supabase.auth.getUser()
    ]);
    me = user?.id || null;

    if (error) {
      return list.innerHTML = /could not find the function|does not exist|schema cache/i.test(error.message)
        ? notice('The access functions are not installed yet - apply supabase/migrations/20261101190000_admin_users.sql.')
        : notice(error.message);
    }
    paint(Array.isArray(admins) ? admins : [], counts);
  };

  form.onsubmit = async (event) => {
    event.preventDefault();
    const email = String(new FormData(form).get('email') || '').trim();
    msg.innerHTML = '';
    if (!email) return flash(msg, 'An email is required.');

    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    const { data, error } = await supabase.rpc('set_admin_access', { target_email: email, make_admin: true });
    submit.disabled = false;

    if (error) {
      return flash(msg, /sign in once first/.test(error.message)
        ? `No account with ${email}. They need to sign in to the site once, then come back here.`
        : error.message);
    }
    form.reset();
    flash(msg, data === 'already an admin' ? `${email} already had access.` : `${email} can now open this panel.`);
    await load();
  };

  document.querySelector('#access-refresh').onclick = load;
  await load();
}
