/* ============================================================
   Settings: what the panel does next, not what the site says.

   The line this screen draws is deliberate. Three things are editable, because
   they only affect the next thing the panel does - a new article's status and
   category, and whether saving a published article starts a build.

   The site's address is NOT editable here, and that is the point. The canonical
   origin, the sitemap URL and the mailto on /contact are written into the build
   by scripts/build-static-seo.mjs. A wrong value in a text box would rewrite
   every canonical tag on the site at once, which is the one change that can
   lose rankings in a day. It stays in a file, reviewed like code - and this
   screen says so instead of pretending the field is missing.

   Saving writes one row. There is no insert: the migration creates row 1 and
   the table refuses a second one, so "which settings apply" never depends on
   row order.
   ============================================================ */

import { adopt, normalise } from './panel-settings.js';

/* Read-only, because it comes from the build and not from the database. Kept
   here rather than fetched: if these ever disagree with the build, the build is
   right, and a number the panel invented would be worse than a label that is
   one commit out of date. */
const IDENTITY = [
  ['Canonical origin', 'https://oopsmypassword.web.app', 'scripts/build-static-seo.mjs (SITE)'],
  ['Text sitemap', '/sitemap.txt', 'scripts/build-static-seo.mjs'],
  ['Vercel mirror', 'verified against Firebase on every deploy', '.github/workflows/verify-vercel-mirror.yml']
];

const isMissingTable = (error) =>
  Boolean(error) && (error.code === '42P01' || /does not exist/i.test(String(error.message || '')));

export async function mountSettings(ctx) {
  const { supabase, esc, panel, notice, flash, requestPublish, publishChip } = ctx;

  panel.innerHTML = `<div class="admin-section-head">
      <div><h2 class="h-3">Settings</h2><p class="tiny muted">Defaults for new articles, and when a save should deploy. One row, applied the moment a form reads it.</p></div>
    </div>
    <div id="settings-body" style="margin-top:16px"><p class="tiny muted">Loading…</p></div>`;

  const body = document.querySelector('#settings-body');

  const paint = async (settings, categories, missing) => {
    const options = [`<option value="">No category</option>`]
      .concat(categories.map((cat) =>
        `<option value="${esc(cat.id)}" ${cat.id === settings.default_category_id ? 'selected' : ''}>${esc(cat.name)}</option>`))
      .join('');

    body.innerHTML = `
      ${missing ? notice('panel_settings does not exist yet - apply supabase/migrations/20261102120000_panel_settings.sql. The panel is using its built-in defaults meanwhile.') : ''}
      <form id="settings-form" class="card card-pad">
        <h3 class="h-4">When you start a new article</h3>
        <div class="form-grid" style="margin-top:12px">
          <div class="form-field">
            <label for="settings-status">Status</label>
            <select id="settings-status" name="default_status">
              <option value="draft" ${settings.default_status === 'draft' ? 'selected' : ''}>Draft</option>
              <option value="published" ${settings.default_status === 'published' ? 'selected' : ''}>Published (goes live on save)</option>
            </select>
            <p class="tiny muted" style="margin-top:6px">Draft is the safe default: nothing reaches the site until you say so.</p>
          </div>
          <div class="form-field">
            <label for="settings-category">Category</label>
            <select id="settings-category" name="default_category_id">${options}</select>
            <p class="tiny muted" style="margin-top:6px">${categories.length ? 'Prefilled on every new article. Still changeable per article.' : 'No categories exist yet - add one in Categories and it will appear here.'}</p>
          </div>
        </div>
        <div class="form-field" style="margin-top:16px">
          <label for="settings-autodeploy">
            <input id="settings-autodeploy" name="autodeploy_on_save" type="checkbox" ${settings.autodeploy_on_save ? 'checked' : ''}>
            Deploy automatically when a published article is saved
          </label>
          <p class="tiny muted" style="margin-top:6px">Off means saving is instant and the site is unchanged until you press the button below. Useful while editing a page in several passes.</p>
        </div>
        <div id="settings-msg" aria-live="polite" style="margin-top:6px"></div>
        <div class="flex gap-12 wrap" style="margin-top:12px">
          <button type="submit" class="btn btn-primary btn-sm">Save settings</button>
          <button type="button" id="settings-deploy" class="btn btn-secondary btn-sm">Publish the whole site now</button>
        </div>
        <p class="tiny muted" style="margin-top:8px">Publishing rebuilds every page, regenerates the sitemap and deploys. A few minutes, no limit on how often.</p>
        <div id="settings-deploy-chip" style="margin-top:10px"></div>
      </form>

      <div class="card card-pad" style="margin-top:16px">
        <h3 class="h-4">Site identity</h3>
        <p class="tiny muted" style="margin-top:6px">Read-only on purpose. These are written into every page at build time; a wrong value here would rewrite every canonical tag at once.</p>
        <div class="admin-list" style="margin-top:10px">
          ${IDENTITY.map(([label, value, where]) => `<div class="admin-row">
            <div class="grow"><strong>${esc(label)}</strong>
              <p class="tiny muted" style="margin-top:4px"><code>${esc(value)}</code></p>
              <p class="tiny muted">changed in <code>${esc(where)}</code></p>
            </div>
          </div>`).join('')}
        </div>
      </div>`;

    document.querySelector('#settings-form').onsubmit = async (event) => {
      event.preventDefault();
      const msg = document.querySelector('#settings-msg');
      const save = document.querySelector('#settings-form button[type="submit"]');
      save.disabled = true;
      const row = normalise({
        default_status: document.querySelector('#settings-status').value,
        default_category_id: document.querySelector('#settings-category').value,
        autodeploy_on_save: document.querySelector('#settings-autodeploy').checked
      });
      const { error } = await supabase
        .from('panel_settings')
        .update({ ...row, updated_at: new Date().toISOString() })
        .eq('id', 1);
      save.disabled = false;
      if (error) {
        msg.innerHTML = notice(isMissingTable(error)
          ? 'panel_settings does not exist yet - apply supabase/migrations/20261102120000_panel_settings.sql.'
          : `Settings were not saved: ${esc(error.message)}`);
        return;
      }
      /* The rest of the panel reads the cache, not the table. Adopt what was
         just written so the next article form uses it without a reload. */
      adopt(row);
      flash(msg, 'Saved. New articles use these defaults from now on.');
    };

    document.querySelector('#settings-deploy').onclick = async () => {
      const button = document.querySelector('#settings-deploy');
      button.disabled = true;
      const started = await requestPublish('settings: whole site', []);
      button.disabled = false;
      const chip = document.querySelector('#settings-deploy-chip');
      if (started.error) {
        chip.innerHTML = notice(`The deploy could not start: ${esc(started.error)}`);
        return;
      }
      if (started.job_id && publishChip) publishChip(chip, started.job_id, '/');
    };
  };

  /* One read for the row, one for the categories, both failing softly: a brand
     new install has neither, and the screen still has to say something true. */
  let settings = { default_status: 'draft', default_category_id: null, autodeploy_on_save: true };
  let missing = false;
  const { data: row, error } = await supabase
    .from('panel_settings')
    .select('default_status,default_category_id,autodeploy_on_save')
    .eq('id', 1)
    .maybeSingle();
  if (error) missing = isMissingTable(error);
  settings = normalise(row);
  adopt(settings);

  const { data: categories } = await supabase
    .from('article_categories')
    .select('id,name,sort_order')
    .order('sort_order', { ascending: true });

  await paint(settings, Array.isArray(categories) ? categories : [], missing);
}
