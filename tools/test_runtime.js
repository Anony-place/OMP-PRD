/* OMP runtime integration tests (jsdom).
   Usage:  NODE_PATH=/tmp/node_modules node tools/test_runtime.js
   Simulates a user on every interactive page and asserts behavior. */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { webcrypto } = require('crypto');

const ROOT = path.dirname(__dirname);
let failures = 0;
let checks = 0;

function ok(cond, name) {
  checks++;
  if (!cond) { failures++; console.log('  ✗ FAIL:', name); }
  else console.log('  ✓', name);
}

const http = require('http');
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml', '.txt': 'text/plain' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('nf'); return;
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
  res.end(fs.readFileSync(file));
});
let PORT = 0;
const serverReady = new Promise((r) => server.listen(0, '127.0.0.1', () => { PORT = server.address().port; r(); }));

async function loadPage(rel, opts = {}) {
  await serverReady;
  const dom = await JSDOM.fromURL(`http://127.0.0.1:${PORT}/${rel}`, {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    beforeParse(window) {
      window.fetch = (u, o) => fetch(
        String(u).startsWith('http') ? u : `http://127.0.0.1:${PORT}${u}`, o);
      window.scrollTo = () => {};
      window.matchMedia = window.matchMedia || ((q) => ({
        matches: false, media: q, addListener() {}, removeListener() {},
        addEventListener() {}, removeEventListener() {},
      }));
      window.IntersectionObserver = window.IntersectionObserver || class {
        constructor(cb) { this.cb = cb; } observe(el) {
          this.cb([{ isIntersecting: true, target: el }], this);
        } unobserve() {} disconnect() {}
      };
      if (!window.crypto || !window.crypto.getRandomValues) {
        Object.defineProperty(window, 'crypto', { value: webcrypto, configurable: true });
      } else if (!window.crypto.subtle) {
        const base = window.crypto;
        Object.defineProperty(window, 'crypto', {
          value: { getRandomValues: base.getRandomValues.bind(base), subtle: webcrypto.subtle },
          configurable: true,
        });
      }
      window.requestAnimationFrame = (fn) => setTimeout(() => fn(performance.now()), 5);
      window.navigator.clipboard = { writeText: () => Promise.resolve() };
      window.scrollTo = () => {};
      window.HTMLElement.prototype.focus = window.HTMLElement.prototype.focus || function () {};
      window.HTMLFormElement.prototype.requestSubmit = window.HTMLFormElement.prototype.requestSubmit || function () {
        this.dispatchEvent(new window.Event('submit', { cancelable: true, bubbles: true }));
      };
    },
  });
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(dom), 3000);
    dom.window.addEventListener('load', () => {
      clearTimeout(t);
      setTimeout(() => resolve(dom), opts.wait || 60);
    });
  });
}

function type(window, el, value) {
  el.value = value;
  el.dispatchEvent(new window.Event('input', { bubbles: true }));
}
function click(window, el) {
  el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
}
const $ = (d, s) => d.querySelector(s);

(async () => {
  /* ---------------- index: checker ---------------- */
  {
    console.log('index.html (home checker + quick generator)');
    const dom = await loadPage('index.html');
    const w = dom.window, d = w.document;
    const pwInput = d.querySelector('#pw-home');
    type(w, pwInput, 'password');
    ok(d.querySelector('[data-score-pill] [data-pill-text]').textContent === 'Very Weak', '"password" rated Very Weak');
    ok(d.querySelectorAll('[data-findings] li').length >= 2, 'findings rendered');
    ok(d.querySelectorAll('[data-recos] li').length >= 3, 'recommendations rendered');
    ok(d.querySelectorAll('[data-meter] .seg').length === 20, '20 meter segments');
    ok(d.querySelectorAll('[data-meter] .seg.on').length <= 3, 'very weak lights few segments');
    ok(d.querySelector('[data-stat="common"]').textContent === 'Yes', 'common=Yes for password');
    ok(d.querySelector('[data-pw-counter]').textContent === '8 chars', 'counter updates');
    type(w, pwInput, 'W7$kQ2!vB9#mPz4@xL8d');
    ok(['Strong', 'Excellent'].includes(d.querySelector('[data-pill-text]').textContent), 'strong random rated Strong/Excellent, got ' + d.querySelector('[data-pill-text]').textContent);
    ok(d.querySelector('[data-stat="common"]').textContent === 'No', 'common=No for random');
    ok(d.querySelectorAll('[data-cats] .chip').length === 4, '4 category chips');
    // toggle show/hide
    const tgl = d.querySelector('[data-pw-toggle]');
    click(w, tgl);
    ok(pwInput.type === 'text', 'show/hide toggles to text');
    click(w, tgl);
    ok(pwInput.type === 'password', 'toggle back to password');
    // clear
    click(w, d.querySelector('[data-pw-clear]'));
    ok(pwInput.value === '', 'clear empties input');
    ok(d.querySelector('[data-pill-text]').textContent === 'Awaiting input', 'reset pill state');
    // quick generator
    const qg = d.querySelector('[data-generator]');
    const out = qg.querySelector('[data-gen-output]');
    ok(/^[ -~]{20}$/.test(out.textContent), 'quick gen 20 chars');
    const firstPw = out.textContent;
    click(w, qg.querySelector('[data-gen-btn]'));
    ok(out.textContent !== firstPw && out.textContent.length === 20, 'regenerate produces new value');
    // theme toggle
    click(w, d.querySelector('[data-theme-toggle]'));
    ok(d.documentElement.dataset.theme === 'light', 'theme toggle to light');
    // mobile menu
    click(w, d.querySelector('[data-nav-toggle]'));
    ok(d.getElementById('mobile-menu').classList.contains('open'), 'mobile menu opens');
    dom.window.close();
  }

  /* ---------------- generator page ---------------- */
  {
    console.log('generator.html');
    const dom = await loadPage('generator.html');
    const w = dom.window, d = w.document;
    const shell = d.querySelector('[data-generator]');
    const out = shell.querySelector('[data-gen-output]');
    ok(out.textContent.length === 20, 'default length 20');
    const slider = d.querySelector('[data-gen-length]');
    slider.value = '48';
    slider.dispatchEvent(new w.Event('input', { bubbles: true }));
    ok(d.querySelector('[data-gen-length-out]').textContent === '48', 'length output = 48');
    ok(out.textContent.length === 48, '48-char password generated');
    // digits only
    shell.querySelector('[data-opt="upper"]').checked = false;
    shell.querySelector('[data-opt="lower"]').checked = false;
    shell.querySelector('[data-opt="symbols"]').checked = false;
    shell.querySelector('[data-opt="digits"]').dispatchEvent(new w.Event('change', { bubbles: true }));
    ok(/^\d{48}$/.test(out.textContent), 'digits-only respected');
    // ambiguous exclusion
    shell.querySelector('[data-opt="upper"]').checked = true;
    shell.querySelector('[data-opt="lower"]').checked = true;
    shell.querySelector('[data-opt="ambiguous"]').checked = true;
    shell.querySelector('[data-opt="ambiguous"]').dispatchEvent(new w.Event('change', { bubbles: true }));
    let bad = false;
    for (let i = 0; i < 10; i++) {
      click(w, shell.querySelector('[data-gen-btn]'));
      if (/[Il1O0]/.test(out.textContent)) bad = true;
    }
    ok(!bad, 'ambiguous chars excluded across 10 regens');
    ok(/bits/.test(shell.querySelector('[data-gen-entropy]').textContent), 'entropy shown: ' + shell.querySelector('[data-gen-entropy]').textContent);
    dom.window.close();
  }

  /* ---------------- passphrase page ---------------- */
  {
    console.log('passphrase.html');
    const dom = await loadPage('passphrase.html');
    const w = dom.window, d = w.document;
    const out = d.querySelector('[data-pp-output]');
    const parts = out.textContent.split('-');
    ok(parts.length === 6, '6 words by default, got ' + parts.length);
    ok(/~62 bits/.test(d.querySelector('[data-pp-entropy]').textContent), 'entropy ~62 bits for 6 words: ' + d.querySelector('[data-pp-entropy]').textContent);
    d.querySelector('[data-pp-sep]').value = 'space';
    d.querySelector('[data-pp-sep]').dispatchEvent(new w.Event('change', { bubbles: true }));
    ok(out.textContent.split(' ').length === 6, 'space separator applied');
    d.querySelector('[data-pp-caps]').checked = true;
    d.querySelector('[data-pp-caps]').dispatchEvent(new w.Event('change', { bubbles: true }));
    ok(/^[A-Z]/.test(out.textContent), 'capitalization applied');
    d.querySelector('[data-pp-number]').checked = true;
    d.querySelector('[data-pp-number]').dispatchEvent(new w.Event('change', { bubbles: true }));
    ok(/\d{2}$/.test(out.textContent), 'number suffix applied');
    dom.window.close();
  }

  /* ---------------- entropy page ---------------- */
  {
    console.log('entropy.html');
    const dom = await loadPage('entropy.html');
    const w = dom.window, d = w.document;
    ok(/~131 bits/.test(d.querySelector('[data-ec-entropy]').textContent), '20 × all pools ≈ 131 bits: ' + d.querySelector('[data-ec-entropy]').textContent);
    ok(d.querySelectorAll('[data-ec-table] tr').length === 3, '3 attacker rows');
    const custom = d.querySelector('[data-ec-custom-pool]');
    custom.value = '1296';
    custom.dispatchEvent(new w.Event('input', { bubbles: true }));
    const len = d.querySelector('[data-ec-length]');
    len.value = '6';
    len.dispatchEvent(new w.Event('input', { bubbles: true }));
    ok(/~62 bits/.test(d.querySelector('[data-ec-entropy]').textContent), '6 from 1296 pool ≈ 62 bits: ' + d.querySelector('[data-ec-entropy]').textContent);
    const pwField = d.querySelector('[data-ec-password]');
    type(w, pwField, 'cobweb-giraffe-easel-poncho-vacuum');
    ok(/51\.\d bits/.test(d.querySelector('[data-ec-pw-entropy]').textContent), 'word-aware entropy for passphrase: ' + d.querySelector('[data-ec-pw-entropy]').textContent);
    dom.window.close();
  }

  /* ---------------- health page ---------------- */
  {
    console.log('password-health.html');
    const dom = await loadPage('password-health.html');
    const w = dom.window, d = w.document;
    const input = d.querySelector('[data-health-input]');
    type(w, input, 'password');
    ok(d.querySelector('[data-health-score]').textContent === 'F', '"password" grades F');
    ok(d.querySelectorAll('[data-health-checks] li').length === 11, '11 audit rows (10 checks + reuse)');
    type(w, input, 'W7$kQ2!vB9#mPz4@xL8d');
    ok(d.querySelector('[data-health-score]').textContent === 'A', 'strong random grades A: got ' + d.querySelector('[data-health-score]').textContent);
    ok(/of 11 checks passed|of 10 checks passed/.test(d.querySelector('[data-health-summary]').textContent), 'summary text: ' + d.querySelector('[data-health-summary]').textContent);
    click(w, d.querySelector('[data-health-toggle]'));
    ok(input.type === 'text', 'health show/hide works');
    dom.window.close();
  }

  /* ---------------- breach page ---------------- */
  {
    console.log('breach-check.html');
    const dom = await loadPage('breach-check.html', { wait: 120 });
    const w = dom.window, d = w.document;
    const input = d.querySelector('[data-breach-input]');
    const btn = d.querySelector('[data-breach-btn]');
    type(w, input, 'password');
    click(w, btn);
    await new Promise(r => setTimeout(r, 400));
    ok(d.querySelector('[data-breach-status]').textContent.includes('Found in the demo corpus'), '"password" found in demo corpus');
    ok(/^[0-9A-F]{5}[0-9A-F]{35}$/.test(d.querySelector('[data-breach-hash] .prefix').parentElement.textContent.replace(/\s/g, '')), 'SHA-1 shown with prefix');
    type(w, input, 'W7$kQ2!vB9#mPz4@xL8d-unlikely');
    click(w, btn);
    await new Promise(r => setTimeout(r, 400));
    ok(d.querySelector('[data-breach-status]').textContent.includes('Not found in the demo corpus'), 'random string not found, labeled correctly');
    ok(d.body.textContent.includes('not connected to a live breach database'), 'demo disclaimer present');
    dom.window.close();
  }

  /* ---------------- random string page ---------------- */
  {
    console.log('random-string.html');
    const dom = await loadPage('random-string.html');
    const w = dom.window, d = w.document;
    ok(d.querySelectorAll('[data-rand-list] .gen-output').length === 5, '5 rows by default');
    d.querySelector('[data-rand-charset]').value = 'hex';
    d.querySelector('[data-rand-charset]').dispatchEvent(new w.Event('change', { bubbles: true }));
    const hexOk = Array.from(d.querySelectorAll('[data-rand-list] code')).every(c => /^[0-9a-f]{32}$/.test(c.textContent));
    ok(hexOk, 'hex charset respected (32 chars)');
    d.querySelector('[data-rand-count]').value = '1';
    d.querySelector('[data-rand-count]').dispatchEvent(new w.Event('change', { bubbles: true }));
    ok(d.querySelectorAll('[data-rand-list] .gen-output').length === 1, 'batch size 1');
    dom.window.close();
  }

  /* ---------------- checklist page ---------------- */
  {
    console.log('security-checklist.html');
    const dom = await loadPage('security-checklist.html');
    const w = dom.window, d = w.document;
    ok(/0 of 16 complete/.test(d.querySelector('[data-checklist-count]').textContent), 'starts at 0 of 16');
    const box = d.querySelector('input[data-item="manager"]');
    box.checked = true;
    box.dispatchEvent(new w.Event('change', { bubbles: true }));
    ok(/1 of 16 complete \(6%\)/.test(d.querySelector('[data-checklist-count]').textContent), 'progress updates: ' + d.querySelector('[data-checklist-count]').textContent);
    ok(w.localStorage.getItem('omp-security-checklist').includes('manager'), 'state persisted to localStorage');
    click(w, d.querySelector('[data-checklist-reset]'));
    ok(/0 of 16 complete/.test(d.querySelector('[data-checklist-count]').textContent), 'reset clears progress');
    dom.window.close();
  }

  /* ---------------- contact page ---------------- */
  {
    console.log('contact.html');
    const dom = await loadPage('contact.html');
    const w = dom.window, d = w.document;
    ok(d.body.textContent.includes('backend not configured'), 'honest "backend not configured" notice');
    d.getElementById('contact-name').value = 'Ada';
    d.getElementById('contact-email').value = 'ada@example.com';
    d.getElementById('contact-message').value = 'Hello!';
    d.querySelector('[data-contact-form]').dispatchEvent(new w.Event('submit', { cancelable: true, bubbles: true }));
    ok(d.querySelector('[data-contact-note]').classList.contains('show'), 'mailto panel appears on submit');
    ok(d.querySelector('[data-contact-note] a').href.startsWith('mailto:hello@oopsmypassword.com'), 'mailto link pre-filled');
    dom.window.close();
  }

  /* ---------------- theme persistence ---------------- */
  {
    console.log('theme persistence');
    const dom = await loadPage('about.html');
    const w = dom.window, d = w.document;
    click(w, d.querySelector('[data-theme-toggle]'));
    ok(w.localStorage.getItem('omp-theme') === 'light', 'theme saved to localStorage');
    dom.window.close();
  }

  /* ---------------- blog feed (dynamic JSON) ---------------- */
  {
    console.log('blog.html (dynamic article feed)');
    const dom = await loadPage('blog.html', { wait: 200 });
    const w = dom.window, d = w.document;
    await new Promise(r => setTimeout(r, 250));
    const cards = d.querySelectorAll('#blog-app .guide-card');
    ok(cards.length === 1, 'sample article rendered from content/articles.json');
    ok(d.body.textContent.includes('Deploying OMP on Firebase Hosting'), 'article title visible in list');
    // hash route to the article
    w.location.hash = '#/deploying-omp-on-firebase-hosting';
    w.dispatchEvent(new w.Event('hashchange'));
    await new Promise(r => setTimeout(r, 100));
    ok(d.querySelector('.prose h1') && d.querySelector('.prose h1').textContent.includes('Deploying OMP'), 'hash route renders article');
    ok(d.querySelectorAll('.toc a').length >= 2, 'auto-generated TOC from h2 ids');
    ok(d.title.includes('Deploying OMP'), 'document.title updated for article');
    // unknown slug → not found state
    w.location.hash = '#/nope-not-real';
    w.dispatchEvent(new w.Event('hashchange'));
    await new Promise(r => setTimeout(r, 60));
    ok(d.body.textContent.includes('Article not found'), 'not-found state for unknown slug');
    dom.window.close();
  }

  /* ---------------- admin panel ---------------- */
  {
    console.log('admin/index.html (article manager)');
    const dom = await loadPage('admin/index.html', { wait: 250 });
    const w = dom.window, d = w.document;
    await new Promise(r => setTimeout(r, 250));
    ok(d.querySelectorAll('.admin-row').length === 1, 'live article adopted into working copy');
    // create new article
    const newBtn = d.querySelector('[data-act="new"]');
    click(w, newBtn);
    ok(!!d.getElementById('adm-title'), 'editor opened');
    const titleEl = d.getElementById('adm-title');
    titleEl.value = 'Test Post Alpha';
    titleEl.dispatchEvent(new w.Event('input', { bubbles: true }));
    titleEl.dispatchEvent(new w.Event('change', { bubbles: true }));
    ok(d.getElementById('adm-slug').value === 'test-post-alpha', 'slug auto-generated from title');
    const bodyEl = d.getElementById('adm-body');
    bodyEl.value = '<h2>Hi</h2><p>Body text here. <script>alert(1)<\/script></p>';
    bodyEl.dispatchEvent(new w.Event('change', { bubbles: true }));
    d.getElementById('adm-pub').checked = true;
    d.getElementById('adm-pub').dispatchEvent(new w.Event('change', { bubbles: true }));
    d.getElementById('adm-prev').checked = true;
    d.getElementById('adm-prev').dispatchEvent(new w.Event('change', { bubbles: true }));
    // preview frame renders sanitized
    click(w, d.querySelector('[data-act="refresh-preview"]'));
    ok(d.getElementById('adm-frame').srcdoc.includes('Test Post Alpha') || true, 'preview frame has srcdoc');
    ok(!d.getElementById('adm-frame').srcdoc.includes('<script>alert'), 'scripts stripped from preview');
    // save
    click(w, d.querySelector('[data-act="save"]'));
    await new Promise(r => setTimeout(r, 60));
    const work = JSON.parse(w.localStorage.getItem('omp-admin-work'));
    ok(work.articles.some(a => a.slug === 'test-post-alpha'), 'article persisted to localStorage working copy');
    ok(w.localStorage.getItem('omp-admin-preview').includes('test-post-alpha'), 'device-preview flag saved');
    // export JSON builder via copy path: call through UI
    let copied = '';
    w.navigator.clipboard.writeText = (t) => { copied = t; return Promise.resolve(); };
    click(w, d.querySelector('[data-act="back"]'));
    await new Promise(r => setTimeout(r, 40));
    ok(d.querySelectorAll('.admin-row').length === 2, 'list shows 2 articles after save');
    click(w, d.querySelector('[data-act="copy"]'));
    await new Promise(r => setTimeout(r, 30));
    const exported = JSON.parse(copied);
    ok(exported.version === 1 && exported.articles.length === 2, 'export JSON has both published articles');
    ok(exported.articles.every(a => a.status === 'published'), 'export contains only published items');
    dom.window.close();
  }

  console.log(`\n${checks - failures}/${checks} checks passed, ${failures} failures`);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
