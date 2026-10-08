/* Whole-site rendering under the configured production CSP/security headers.
 * APIs/CDN SDK responses are explicit local fixtures; no production writes.
 * Header emulation is test-only, so the normal Arena preview stays embeddable. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { default: AxeBuilder } = require('@axe-core/playwright');
const ROOT = path.resolve(__dirname, '..');
const BASE = process.env.OMP_AUDIT_URL || 'http://127.0.0.1:8080';
const { headersFor } = require('./hosting_router')(ROOT);
const routes = [...new Set([...fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => new URL(m[1]).pathname).concat(['/certificate', '/404', '/Anony.su']))];
const issues = [], observations = [];
(async () => {
  let launch = { headless: true };
  if (process.env.OMP_USE_SERVERLESS_CHROMIUM) {
    const mod = require('@sparticuz/chromium'), c = mod.default || mod;
    launch = { ...launch, executablePath: await c.executablePath(), args: c.args.filter(a => !a.startsWith('--single-process')) };
  }
  const browser = await chromium.launch(launch);
  try {
    /* Production pages register /sw.js (main.js), but the worker never
       intercepts cross-origin requests (it returns without respondWith),
       so the esm.sh fixture below applies and the admin panel boots
       against the local CDN mock, not the real one. The sweep audits
       headers/axe/overflow, not SW caching — block SW so the fixtures
       below are deterministic. */
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
    await ctx.route(/^https:\/\//, r => r.abort());
    await ctx.route('https://esm.sh/@supabase/supabase-js@*', r => r.fulfill({ contentType: 'text/javascript', body: `export function createClient(){return {
      auth:{getUser:async()=>({data:{user:null},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
      from(){const q={select(){return q},eq(){return q},order(){return q},limit(){return q},range(){return q},then(resolve,reject){return Promise.resolve({data:[],error:null,count:0}).then(resolve,reject)}};return q}
    }};` }));
    await ctx.route('**/functions/v1/sitemap?format=json', r => r.fulfill({ json: { urls: [] } }));
    await ctx.route(BASE + '/**', async r => {
      /* Each route runs two axe scans and six viewport resizes, so the gap
         between requests on the same keep-alive connection can exceed the
         preview server's idle timeout. When that happens the client reuses a
         socket the server has already closed and the fetch dies with
         "socket hang up", failing the whole sweep on a transport hiccup
         rather than on anything the site did. Retry the fetch; the assertions
         that follow are unchanged. */
      let response;
      for (let attempt = 0; ; attempt++) {
        try {
          response = await r.fetch({ maxRedirects: 0 });
          break;
        } catch (err) {
          if (attempt >= 3) throw err;
          await new Promise((res) => setTimeout(res, 250 * (attempt + 1)));
        }
      }
      await r.fulfill({ response, headers: { ...response.headers(), ...headersFor(new URL(r.request().url()).pathname) } });
    });
    const page = await ctx.newPage();
    let current = '';
    page.on('pageerror', e => issues.push({ route: current, kind: 'runtime', detail: e.message }));
    await page.addInitScript(() => {
      window.__cspViolations = [];
      document.addEventListener('securitypolicyviolation', e => window.__cspViolations.push({ directive: e.effectiveDirective, blocked: e.blockedURI }));
    });
    let scans = 0, layouts = 0;
    for (const route of routes) {
      current = route;
      await page.setViewportSize({ width: 1440, height: 1000 });
      const response = await page.goto(BASE + route, { waitUntil: 'networkidle' });
      if (response.status() !== 200) issues.push({ route, kind: 'status', detail: response.status() });
      if (route === '/Anony.su') await page.locator('#login-form').waitFor();
      const csp = await page.evaluate(() => window.__cspViolations);
      if (csp.length) issues.push({ route, kind: 'CSP', detail: csp });
      for (const theme of ['dark', 'light']) {
        await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
        // Let the real theme transition finish; do not measure an in-between color.
        await page.waitForTimeout(350);
        const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        scans++;
        for (const v of result.violations) issues.push({ route, theme, kind: 'accessibility', rule: v.id, detail: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) });
      }
      for (const width of [320, 390, 768, 1280, 1440, 1920]) {
        await page.setViewportSize({ width, height: 1000 });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
        layouts++;
        if (overflow) issues.push({ route, kind: 'overflow', width });
      }
      observations.push({ route, status: response.status(), themes: 2, widths: 6 });
      console.log('Checked', route);
    }
    const report = { fixtureMode: true, productionHeadersEmulated: true, routes: routes.length, scans, layouts, issues, observations };
    fs.writeFileSync(path.join(ROOT, 'tools/site-security-browser-report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ routes: routes.length, scans, layouts, issues: issues.length }));
    assert.deepEqual(issues, [], 'See tools/site-security-browser-report.json for details');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
