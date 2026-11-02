/* ============================================================
   The panel's own settings, in one place.

   Two modules need the same three values: the article form (what a new draft
   starts as) and the save path (whether saving a published article starts a
   build). Fetching them at each use would be two round trips per save; asking
   admin.js to pass them around would thread state through a 2 600-line module.

   So: one cached read, one fallback. The fallback matters more than the cache.
   If the settings table is missing, unreadable or empty, the panel must still
   work - and it must work the safe way: a new article is a draft, and saving a
   published one does start a deploy, because silently not deploying looks
   exactly like a successful publish.

   normalise() is pure and exported so it can be tested without a browser.
   ============================================================ */

export const FALLBACK = Object.freeze({
  default_status: 'draft',
  default_category_id: null,
  autodeploy_on_save: true
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* A row from the database, or nothing at all, becomes a complete settings
   object. Anything unrecognised falls back rather than propagating: a status
   of "Publshed" must not become the default for every new article. */
export function normalise(row) {
  const source = row && typeof row === 'object' ? row : {};
  const status = String(source.default_status || '').toLowerCase();
  const category = source.default_category_id;
  return {
    default_status: status === 'published' ? 'published' : 'draft',
    default_category_id: typeof category === 'string' && UUID.test(category) ? category : null,
    /* One exception to "fall back to the safe value": an explicit false is a
       decision, so it is honoured. Only a missing or non-boolean value falls
       back to true. */
    autodeploy_on_save: source.autodeploy_on_save === false ? false : true
  };
}

let cached = null;

export function current() {
  return cached || FALLBACK;
}

/* Returns the settings, reading them at most once per page load unless forced.
   A failed read is not an error the panel shows: the fallback is a working
   panel, and Setup already reports a missing table. */
export async function load(supabase, { force = false } = {}) {
  if (cached && !force) return cached;
  try {
    const { data, error } = await supabase
      .from('panel_settings')
      .select('default_status,default_category_id,autodeploy_on_save')
      .eq('id', 1)
      .maybeSingle();
    if (!error) cached = normalise(data);
  } catch {
    /* a thrown client (offline, aborted) is the same as a failed read */
  }
  return current();
}

/* The Settings tab has just written a row; the rest of the panel should not
   have to re-read it. */
export function adopt(row) {
  cached = normalise(row);
  return cached;
}

/* Tests only. Not called by the panel. */
export function reset() {
  cached = null;
}
