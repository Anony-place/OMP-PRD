/* Real Chromium + actual pinned PDF.js under production admin CSP.
 * Auth/content use private fixtures; never signs in, uploads or writes remotely. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { default: AxeBuilder } = require('@axe-core/playwright');
const ROOT = path.resolve(__dirname, '..'), BASE = process.env.OMP_AUDIT_URL || 'http://127.0.0.1:8080';
const { headersFor } = require('./hosting_router')(ROOT);
function pdfFixture() {
  const text = 'BT /F1 20 Tf 40 140 Td (OMP audit fixture) Tj ET';
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${text.length} >>\nstream\n${text}\nendstream`];
  let pdf = '%PDF-1.4\n', offsets = [0];
  objects.forEach((o, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = pdf.length;
  pdf += 'xref\n0 6\n0000000000 65535 f \n' + offsets.slice(1).map(n => String(n).padStart(10, '0') + ' 00000 n \n').join('');
  pdf += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}
let n = 0;
const ok = s => { n++; console.log('✓ ' + s); };
(async () => {
  let launch = { headless: true };
  if (process.env.OMP_USE_SERVERLESS_CHROMIUM) {
    const mod = require('@sparticuz/chromium'), c = mod.default || mod;
    launch = { ...launch, executablePath: await c.executablePath(), args: c.args.filter(a => !a.startsWith('--single-process')) };
  }
  const browser = await chromium.launch(launch);
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const requests = [], errors = [];
    await ctx.route(/^https:\/\//, r => { requests.push(r.request().url()); return r.abort(); });
    await ctx.route('https://esm.sh/@supabase/supabase-js@*', r => r.fulfill({ contentType: 'text/javascript', body: `export function createClient(){return {
      auth:{getUser:async()=>({data:{user:{id:'fixture-admin',email:'admin@example.test'}},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
      from(table){const q={select(){return q},eq(){return q},order(){return q},limit(){return q},maybeSingle:async()=>({data:table==='profiles'?{is_admin:true}:null,error:null}),then(resolve,reject){return Promise.resolve({data:[],error:null,count:0}).then(resolve,reject)}};return q}
    }};` }));
    for (const name of ['pdf.mjs','pdf.worker.mjs']) {
      await ctx.route('https://esm.sh/pdfjs-dist@5.4.624/legacy/build/' + name, r => r.fulfill({
        contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' },
        body: fs.readFileSync(require.resolve('pdfjs-dist/legacy/build/' + name), 'utf8'),
      }));
    }
    await ctx.route(BASE + '/**', async r => {
      const response = await r.fetch({ maxRedirects: 0 });
      await r.fulfill({ response, headers: { ...response.headers(), ...headersFor(new URL(r.request().url()).pathname) } });
    });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.effectiveDirective + ':' + e.blockedURI)); });
    await page.goto(BASE + '/admin');
    await page.locator('#new-article').waitFor();
    ok('Admin dashboard boots with a fixture-authorized account and the real CSP');
    await page.locator('#new-article').click();
    await page.locator('input[name=document]').setInputFiles({ name: 'audit.pdf', mimeType: 'application/pdf', buffer: pdfFixture() });
    await page.waitForFunction(() => /Imported|Could not extract/.test(document.querySelector('[id$="pdf-status"]').textContent), null, { timeout: 30000 });
    const note = await page.locator('[id$="pdf-status"]').innerText();
    assert.match(note, /Imported .*rendered 1 PDF page/);
    assert.match(await page.locator('textarea[name=content]').inputValue(), /OMP audit fixture/);
    const image = page.locator('.pdf-import-preview img');
    await image.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => { const img = document.querySelector('.pdf-import-preview img'); return img?.complete && img.naturalWidth > 0; });
    assert.deepEqual(await page.evaluate(() => window.__csp), []);
    ok('Real PDF text extraction, worker and blob page preview succeed without unsafe-eval');
    for (const theme of ['dark', 'light']) {
      await page.evaluate(t => document.documentElement.dataset.theme = t, theme);
      await page.waitForTimeout(350);
      const result = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
      assert.deepEqual(result.violations.map(v => ({ rule: v.id, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })), [], 'Admin editor ' + theme);
    }
    ok('Admin article editor passes accessibility in both themes');
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Admin editor overflow at ' + width);
    }
    ok('Admin PDF editor fits mobile and desktop');
    assert.deepEqual(requests, []); assert.deepEqual(errors, []);
    ok('No unexpected remote calls, uploads, credential use or uncaught errors');
    console.log(`\n${n} admin browser groups passed; real PDF.js, fixture auth, no live services.`);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
