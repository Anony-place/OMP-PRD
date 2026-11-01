/* Read-only, exact-artifact Hosting check. Run from the built site directory.
 * This verifies a deployment, NOT email delivery or Google indexing. */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const createRouter = require('../tools/hosting_router.js');
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

export async function releaseArtifacts(root) {
  const { resolve: routeFile } = createRouter(root);
  const sitemap = await readFile(join(root, 'sitemap.xml'), 'utf8');
  const paths = new Set([
    '/', '/articles', '/learning', '/privacy', '/certificate',
    '/sitemap.xml', '/google-sitemap.xml', '/sitemap-index.xml', '/sitemap.txt', '/rss.xml', '/robots.txt',
    '/assets/css/styles.css', '/assets/css/learning.css',
    '/assets/js/main.js', '/assets/js/learning.js', '/assets/js/academy-local.mjs',
    '/assets/js/academy-views.mjs', '/assets/js/academy-model.mjs', '/assets/js/academy-ui.mjs',
    '/assets/js/academy-content.mjs', '/assets/js/academy-quiz.mjs',
    '/assets/data/academy-catalogue.json', '/assets/data/academy-self-checks.json',
      ]);
  for (const [, loc] of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) paths.add(new URL(loc).pathname);
  const artifacts = [];
  for (const route of paths) {
    const match = routeFile(route);
    if (match.type !== 'file') throw new Error(`Built route does not resolve to a file: ${route}`);
    const bytes = await readFile(join(root, match.file));
    const type = match.file.endsWith('.html') ? 'text/html'
      : /\.m?js$/.test(match.file) ? 'javascript'
      : match.file.endsWith('.css') ? 'text/css'
      : match.file.endsWith('.json') ? 'application/json'
      : match.file.endsWith('.xml') ? 'xml' : 'text/plain';
    artifacts.push({ route, digest: digest(bytes), bytes, type, status: 200 });
  }
  // A real missing route must be a 404, not a 200 application shell.
  const bytes = await readFile(join(root, '404.html'));
  artifacts.push({ route: '/__omp_release_missing_page__', digest: digest(bytes), bytes, type: 'text/html', status: 404 });
  return artifacts;
}

/* The Vercel build rewrites the site origin inside every HTML/XML file, so the
   bytes on that host differ from the committed bytes by exactly one string. Set
   LIVE_REWRITE_FROM to that string (and LIVE_REWRITE_TO to what the files carry)
   and the comparison becomes exact again, instead of the check having to be
   switched off after the move - which is how a verification step quietly stops
   verifying anything. */
export async function verifyLiveRelease({ root = process.cwd(), origin = process.env.SITE_ORIGIN || 'https://oopsmypassword.web.app', fetcher = fetch, attempts = 4, delayMs = 10000, log = console.log, rewriteFrom = process.env.LIVE_REWRITE_FROM || '', rewriteTo = process.env.LIVE_REWRITE_TO || '' } = {}) {
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 6) throw new Error('attempts must be between 1 and 6');
  const site = new URL(origin);
  if (site.protocol !== 'https:' || site.username || site.password || site.pathname !== '/' || site.search || site.hash)
    throw new Error('SITE_ORIGIN must be an HTTPS origin without credentials, path or query');
  const artifacts = await releaseArtifacts(root);
  for (const item of artifacts) {
    let failure;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const url = new URL(item.route, site);
        url.searchParams.set('release_check', item.digest.slice(0, 16));
        const response = await fetcher(url, {
          redirect: 'manual', signal: AbortSignal.timeout(20000),
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' },
        });
        if (response.status !== item.status) throw new Error(`HTTP ${response.status}, expected ${item.status}`);
        if (!response.headers.get('content-type')?.includes(item.type)) throw new Error('Wrong Content-Type');
        if (response.headers.get('x-content-type-options')?.toLowerCase() !== 'nosniff') throw new Error('Missing nosniff security header');
        const live = Buffer.from(await response.arrayBuffer());
        const comparable = rewriteFrom
          ? Buffer.from(live.toString('utf8').split(rewriteFrom).join(rewriteTo), 'utf8')
          : live;
        if (digest(comparable) !== item.digest) throw new Error('Live bytes differ from the tested build');
        failure = null;
        break;
      } catch (error) {
        failure = error;
        if (attempt < attempts) await new Promise((done) => setTimeout(done, delayMs));
      }
    }
    if (failure) throw new Error(`${item.route}: ${failure.message}`);
    log(`✓ Live artifact ${item.route} (HTTP ${item.status})`);
  }
  log(`${artifacts.length} exact live artifacts verified. Google indexing requires separate evidence.`);
  return artifacts.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  verifyLiveRelease().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
