/* One tool, one canonical URL.
 *
 * SpiderFoot and theHarvester are legitimately both "OSINT" and "pentest
 * reconnaissance", so they appear in both hubs - which produced two live pages
 * per tool with the same overview, the same install steps and a self-canonical
 * on each. Two URLs competing for the same query normally means neither ranks,
 * and the reader who lands on the thinner page gets the worse version.
 *
 * The OSINT page is the deeper write-up, so the pentest listing publishes a
 * canonical pointing at it and drops out of the sitemap. Both consumers
 * (scripts/build-static-seo.mjs, scripts/build-phase3-seo.mjs) import this map
 * so the canonical tag and the sitemap can never disagree.
 */
export const CROSS_CANONICAL = {
  '/pentest/spiderfoot': '/osint/spiderfoot',
  '/pentest/theharvester': '/osint/theharvester'
};
