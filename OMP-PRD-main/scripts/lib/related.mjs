/* ============================================================
   Which three articles sit under this one.

   Every article page used to end at a single "browse the Articles hub" link.
   For a site whose articles are mostly read one at a time from search, that
   leaves sixteen pages that only point at one index - no lateral paths for a
   reader, and very little for a crawler to follow between them.

   Choosing them is a policy, so it lives here instead of in the middle of the
   generator: same input, same three links, every build. Two rules, in order:

     1. an article in the same category beats one that is not - someone
        reading about password attacks wants the neighbouring deep dives
     2. otherwise the most recent wins, so a new article is not stranded

   Ties break on slug. Without that, two articles published in the same second
   would swap places between builds and the publisher would commit a diff that
   changes nothing a reader can see.

   Pure and dependency-free so tools/test_related.mjs can call it directly.
   ============================================================ */

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/* Anything without a stable, addressable page is not a candidate: no slug, an
   unpublished draft, or a page marked noindex (linking to it would put a
   dead-end one click away). */
function eligible(article) {
  if (!article || typeof article !== 'object') return false;
  if (typeof article.slug !== 'string' || !SLUG.test(article.slug)) return false;
  if (typeof article.title !== 'string' || !article.title.trim()) return false;
  if (article.status && article.status !== 'published') return false;
  if (article.robots_noindex === true) return false;
  return true;
}

function when(article) {
  const raw = article.published_at || article.created_at || article.updated_at;
  const time = Date.parse(String(raw || ''));
  return Number.isNaN(time) ? 0 : time;
}

/**
 * @param {object} current  the article the page is being built for
 * @param {object[]} all    every article the build fetched
 * @param {{limit?: number}} [options]
 * @returns {object[]} up to `limit` articles, best first
 */
export function pickRelated(current, all, options = {}) {
  const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 3;
  if (!eligible(current)) return [];

  /* A null category is not a category: two uncategorised articles have nothing
     in common, and treating null === null as a match would rank arbitrarily. */
  const category = current.category_id || null;

  return (Array.isArray(all) ? all : [])
    .filter((article) => eligible(article) && article.slug !== current.slug)
    .map((article) => ({
      article,
      sameCategory: category && article.category_id === category ? 1 : 0,
      at: when(article)
    }))
    .sort((a, b) =>
      b.sameCategory - a.sameCategory ||
      b.at - a.at ||
      a.article.slug.localeCompare(b.article.slug))
    .slice(0, limit)
    .map((entry) => entry.article);
}

export { eligible, SLUG };
