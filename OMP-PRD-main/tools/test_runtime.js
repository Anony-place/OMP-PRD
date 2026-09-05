/* OMP runtime integration tests (jsdom).
   Usage:  NODE_PATH=/tmp/node_modules node tools/test_runtime.js
   Simulates a user on every interactive page and asserts behavior. */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { webcrypto } = require('crypto');

const ROOT = path.dirname(__dirname);

/* True when the given src= values appear as <script> tags in this order. */
function d_scriptsInOrder(doc, srcs) {
  const found = Array.from(doc.querySelectorAll('script[src]')).map(s => s.getAttribute('src'));
  let i = 0;
  for (const f of found) { if (f === srcs[i]) i++; }
  return i === srcs.length;
}

let failures = 0;
let checks = 0;

function ok(cond, name) {
  checks++;
  if (!cond) { failures++; console.log('  ✗ FAIL:', name); }
  else console.log('  ✓', name);
}

const http = require('http');
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml', '.txt': 'text/plain' };
const createRouter = require('./hosting_router.js');
const router = createRouter(ROOT, path.join(ROOT, 'firebase.json'));
/* The harness serves the site the way Firebase Hosting does (redirects,
   cleanUrls, rewrites, 404 page) so tests exercise real public URLs. */
const server = http.createServer((req, res) => {
  let p = req.url.split('?')[0];
  try { p = decodeURIComponent(p); } catch (e) { /* keep raw */ }
  const r = router.resolve(p, 0);
  if (r.type === 'redirect') { res.writeHead(r.status, { Location: r.location }); res.end('moved'); return; }
  const file = path.join(ROOT, r.file || '/404.html');
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(r.type === 'notfound' ? 404 : 200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
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
      if (!window.TextEncoder) {
        window.TextEncoder = TextEncoder;
        window.TextDecoder = TextDecoder;
      }
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
    const dom = await loadPage('');
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
    const dom = await loadPage('generator');
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
    const dom = await loadPage('passphrase');
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
    const dom = await loadPage('entropy');
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
    const dom = await loadPage('password-health');
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
    const dom = await loadPage('breach-check', { wait: 120 });
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
    const dom = await loadPage('random-string');
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
    const dom = await loadPage('security-checklist');
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
    console.log('contact.html (Supabase submission + mailto fallback)');
    const dom = await loadPage('contact');
    const w = dom.window, d = w.document;
    // Simulate an unreachable backend so the suite never POSTs to the live DB.
    w.fetch = () => Promise.reject(new Error('offline'));
    ok(d.body.textContent.includes('Messages go straight to the team'), 'delivery notice present');
    ok(!d.body.textContent.includes('not configured'), 'stale "not configured" copy removed');
    const form = d.querySelector('[data-contact-form]');
    const note = d.querySelector('[data-contact-note]');
    // empty submit → blocked with a toast, no success panel
    form.dispatchEvent(new w.Event('submit', { cancelable: true, bubbles: true }));
    ok(!note.classList.contains('show'), 'empty submit blocked by validation');
    d.getElementById('contact-name').value = 'Ada';
    d.getElementById('contact-email').value = 'ada@example.com';
    d.getElementById('contact-message').value = 'Hello!';
    form.dispatchEvent(new w.Event('submit', { cancelable: true, bubbles: true }));
    await new Promise(r => setTimeout(r, 120));
    ok(note.classList.contains('show'), 'fallback panel appears when backend unreachable');
    ok(note.textContent.includes('Could not send right now'), 'honest failure message shown');
    const link = note.querySelector('a[data-mailto]');
    ok(link.href.startsWith('mailto:hello@oopsmypassword.com?subject='), 'mailto fallback pre-filled');
    ok(link.href.includes('Ada'), 'message folded into mailto link');
    // honeypot: bots filling the hidden field get silent fake success
    d.querySelector('[data-contact-hp]').value = 'spammy';
    form.dispatchEvent(new w.Event('submit', { cancelable: true, bubbles: true }));
    await new Promise(r => setTimeout(r, 40));
    ok(note.textContent.includes('Message sent'), 'honeypot silently fakes success for bots');
    dom.window.close();
  }

  /* ---------------- theme persistence ---------------- */
  {
    console.log('theme persistence');
    const dom = await loadPage('about');
    const w = dom.window, d = w.document;
    click(w, d.querySelector('[data-theme-toggle]'));
    ok(w.localStorage.getItem('omp-theme') === 'light', 'theme saved to localStorage');
    dom.window.close();
  }

  /* ---------------- blog page + whitelist sanitizer (XSS suite) ---------------- */
  {
    console.log('articles (Supabase feed scaffold + sanitizer)');
    const dom = await loadPage('articles', { wait: 250 });
    const w = dom.window, d = w.document;
    await new Promise(r => setTimeout(r, 250));
    ok(d.querySelectorAll('script[src="/assets/js/sanitize.js"]').length === 1, 'articles page loads sanitize.js');
    ok(d.querySelectorAll('script[src="/assets/js/articles.js"]').length === 1, 'articles page loads articles.js');
    ok(typeof w.OMPSanitize === 'function', 'OMPSanitize is available (loads before articles.js)');
    ok(!!d.querySelector('[data-articles]'), 'feed mount point present');
    ok(!d.body.textContent.includes('no backend'), 'stale "no backend" copy removed');
    // In jsdom the esm.sh dynamic import cannot execute; the feed must fail
    // closed with the honest error notice, not hang on "Loading articles…" forever.
    await new Promise(r => setTimeout(r, 400));
    const feedState = d.querySelector('[data-articles]').textContent;
    ok(feedState.includes('temporarily unavailable') || feedState.includes('Loading articles'),
       'feed fails gracefully without network (got: ' + feedState.trim().slice(0, 40) + '…)');

    const S = w.OMPSanitize;
    const noExec = (out) => !/<script|onerror|onload|onclick|javascript:/i.test(out);

    // 1. script tag dropped with content
    let out = S('<p>safe</p><script>alert(1)<\/script>');
    ok(out.includes('<p>safe</p>') && noExec(out) && !out.includes('alert(1)'), 'script tag + content dropped');

    // 2. event handlers stripped
    out = S('<img src="https://x/y.png" onerror="alert(1)"><p onclick="alert(1)" style="color:red" class="c" id="i">t</p>');
    ok(noExec(out) && !out.includes('onerror') && !out.includes('style='), 'on* handlers / style / class / id stripped');

    // 3. javascript: href removed
    out = S('<a href="javascript:alert(1)">click</a>');
    ok(noExec(out) && !out.includes('href'), 'javascript: href dropped');

    // 4. https href kept, hardened with target+rel
    out = S('<a href="https://example.com/x">ext</a>');
    ok(out.includes('href="https://example.com/x"') && out.includes('target="_blank"') && out.includes('rel="noopener noreferrer nofollow"'), 'external link kept + noopener hardened');

    // 5. relative + anchor hrefs kept
    out = S('<a href="/other.html">a</a><a href="#sec">b</a>');
    ok(out.includes('href="/other.html"') && out.includes('href="#sec"'), 'relative and # hrefs kept');

    // 6. iframe/object/embed/svg/form dropped with content
    out = S('<iframe src="https://evil"></iframe><object data="x"></object><svg onload="alert(1)"></svg><form action="/x"><p>formchild</p></form><p>kept</p>');
    ok(!out.includes('iframe') && !out.includes('object') && !out.includes('svg') && !out.includes('formchild') && out.includes('<p>kept</p>'), 'dangerous containers dropped with content');

    // 7. data: image allowed, javascript: data blocked, remote img allowed
    out = S('<img src="data:image/png;base64,AAAA">');
    ok(out.includes('src="data:image/png;base64,AAAA"'), 'data:image/* src allowed');
    out = S('<img src="data:text/html;base64,AAAA">');
    ok(!out.includes('data:text'), 'data:text/html src blocked');
    out = S('<img src="https://cdn.example/i.jpg" alt="pic" width="99999">');
    ok(out.includes('src="https://cdn.example/i.jpg"') && out.includes('alt="pic"') && !out.includes('99999'), 'https img kept, absurd width dropped');

    // 8. unknown tags unwrapped, text preserved
    out = S('<article><h2>Title</h2><custom-tag>inner</custom-tag></article>');
    ok(out.includes('<h2>Title</h2>') && out.includes('inner') && !out.includes('custom-tag'), 'unknown tags unwrapped, text kept');

    // 9. table attrs whitelisted
    out = S('<table><tr><td colspan="3" bgcolor="red">cell</td></tr></table>');
    ok(out.includes('colspan="3"') && !out.includes('bgcolor'), 'colspan kept, bgcolor dropped');

    // 10. mXSS-style nesting survives
    out = S('<div><p><b onclick="x()">bold <script>bad()<\/script>text</b></p></div>');
    ok(out.includes('<b>bold text</b>') || (out.includes('<b>bold ') && noExec(out)), 'nested cleanup keeps text, drops script');

    // 11. break-out attempt as text is inert (escaped, never a live tag)
    out = S('&lt;img src=x onerror=alert(1)&gt;');
    ok(out.includes('&lt;img') && !out.includes('<img'), 'entity-encoded text stays escaped/inert');

    // 12. non-string / null input
    ok(S(null) === '' && S(undefined) === '' && S(123) === '123', 'null/undefined/number inputs handled');

    dom.window.close();
  }

  /* ---------------- global search (auto-injected on every page) ---------------- */
  {
    console.log('index.html (global search injection + Ctrl+K)');
    const dom = await loadPage('', { wait: 300 });
    const w = dom.window, d = w.document;
    await new Promise(r => setTimeout(r, 300));
    const trigger = d.getElementById('omp-search-trigger');
    ok(!!trigger, 'search trigger button auto-injected into header');
    ok(trigger && !!trigger.closest('header .nav-inner'), 'trigger lives inside header .nav-inner');
    // Ctrl+K opens the dialog
    d.body.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 60));
    const overlay = d.getElementById('omp-search-overlay');
    ok(!!overlay, 'Ctrl+K builds search overlay');
    ok(overlay && !overlay.hidden, 'Ctrl+K opens the search dialog');
    // typing filters baked-in index
    if (overlay) {
      const input = d.getElementById('omp-search-input');
      input.value = 'generator';
      input.dispatchEvent(new w.Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 200));
      const rows = overlay.querySelectorAll('li');
      ok(rows.length >= 1 && overlay.textContent.includes('Generator'), 'typing "generator" returns baked-in tool results');
      d.body.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 40));
      ok(overlay.hidden, 'Escape closes the dialog');
    }
    dom.window.close();
  }

  /* ---------------- admin panel (Supabase Auth scaffold) ---------------- */
  {
    console.log('admin/index.html (auth-gated scaffold)');
    const dom = await loadPage('admin/index.html', { wait: 200 });
    const d = dom.window.document;
    await new Promise(r => setTimeout(r, 200));
    ok(!!d.getElementById('admin-root'), 'admin mount point present');
    ok(d.querySelectorAll('script[src="/assets/js/admin-boot-watchdog.js"]').length === 1, 'boot watchdog installed');
    ok(d.querySelectorAll('script[type="module"][src="/assets/js/admin.js"]').length === 1, 'admin.js loaded as module');
    ok(d.body.textContent.includes('Loading secure admin panel'), 'panel shows loading state before module boot');
    dom.window.close();
  }

  /* ================= Markdown rendering pipeline (articles) ================= */
  {
    console.log('markdown.js (safe Markdown -> HTML for article bodies)');
    const dom = await loadPage('articles', { wait: 200 });
    const w = dom.window;
    await new Promise(r => setTimeout(r, 200));
    ok(typeof w.OMPMarkdown === 'object' && typeof w.OMPMarkdown.toHtml === 'function',
       'articles page exposes window.OMPMarkdown');
    ok(d_scriptsInOrder(dom.window.document, ['/assets/js/sanitize.js', '/assets/js/markdown.js', '/assets/js/articles.js']),
       'articles page loads sanitize.js -> markdown.js -> articles.js in that order');
    const M = w.OMPMarkdown;

    /* The live article is authored in Markdown; the feed used to hand it to an
       HTML-only sanitizer, so readers saw one wall of literal "## ** |". */
    const md = '## Heading Two\n\nA **bold** claim with *emphasis*, `code` and ~~struck~~.\n\n' +
               '| Detail | Value |\n| --- | --- |\n| **CVE** | CVE-2026-0768 |\n\n' +
               '* first item\n* second item\n\n```text\nSECRET=...\n```\n\n---\n\n1. step one\n2. step two';
    ok(!M.looksLikeHtml(md), 'Markdown body is not mistaken for HTML');
    const out = M.renderSafe(md);
    ok(/<h2>Heading Two<\/h2>/.test(out), 'ATX heading rendered');
    ok(/<strong>bold<\/strong>/.test(out) && /<em>emphasis<\/em>/.test(out), 'bold + italic rendered');
    ok(/<code>code<\/code>/.test(out), 'inline code rendered');
    ok(/<del>struck<\/del>/.test(out), 'strikethrough rendered');
    ok(/<table>[\s\S]*<th>Detail<\/th>[\s\S]*<td><strong>CVE<\/strong><\/td>/.test(out), 'GFM table rendered');
    ok(/<ul><li>first item<\/li><li>second item<\/li><\/ul>/.test(out), 'bullet list rendered');
    ok(/<ol><li>step one<\/li><li>step two<\/li><\/ol>/.test(out), 'ordered list rendered');
    ok(/<pre><code>SECRET=\.\.\.<\/\/?code>/.test(out.replace('\n', '')) || /<pre><code>SECRET=\.\.\./.test(out), 'fenced code rendered');
    ok(/<hr>/.test(out), 'horizontal rule rendered');
    ok(!/##|\*\*|```/.test(out), 'no literal Markdown syntax leaks into the output');
    ok(!/<script|onerror|javascript:/i.test(out), 'rendered output stays inert');

    /* HTML-authored bodies must pass through untouched, not be re-parsed. */
    const html = '<h2>Real HTML</h2><p>Kept <strong>as-is</strong>.</p>';
    ok(M.looksLikeHtml(html), 'authored HTML is detected');
    ok(/<h2>Real HTML<\/h2>/.test(M.renderSafe(html)), 'authored HTML preserved');

    /* Markdown that merely talks about HTML must still be treated as Markdown. */
    ok(!M.looksLikeHtml('Use the `<div>` tag:\n\n```html\n<div>x</div>\n```'),
       'HTML inside code fences does not flip detection');

    /* Unsafe destinations are dropped, label text kept, no stray punctuation. */
    const xss = M.renderSafe('[click](javascript:alert(1)) ![i](javascript:alert(2)) [ok](/articles)');
    ok(!/javascript:/i.test(xss), 'javascript: URLs rejected in Markdown links/images');
    ok(!/click\)/.test(xss), 'rejected link leaves no stray ")" behind');
    ok(/<a href="\/articles">ok<\/a>/.test(xss), 'site-relative Markdown links kept');
    const ext = M.renderSafe('[n](https://example.test/x?a=1&b=2)');
    ok(/rel="noopener noreferrer nofollow"/.test(ext) && /target="_blank"/.test(ext),
       'external Markdown links hardened with noopener/noreferrer/nofollow');
    ok(!/<script>alert/.test(M.renderSafe('<script>alert(1)</script>plain **md**')),
       'raw <script> inside a Markdown body cannot survive');

    /* Fail closed: no sanitizer => escaped text, never raw markup. */
    const savedSan = w.OMPSanitize;
    delete w.OMPSanitize;
    const closed = M.renderSafe('<img src=x onerror=alert(1)> **hi**');
    ok(!/<img|onerror/i.test(closed), 'renderSafe fails closed when OMPSanitize is missing');
    w.OMPSanitize = savedSan;

    /* The empty <img> left behind by a rejected src must not survive either. */
    ok(!/<img(?![^>]*\ssrc=)/i.test(w.OMPSanitize('<img src="javascript:alert(1)"><b>keep</b>')),
       'sanitizer drops <img> whose src was rejected');
    ok(/<b>keep<\/b>/.test(w.OMPSanitize('<img src="javascript:alert(1)"><b>keep</b>')),
       'sanitizer keeps the sibling content of a dropped <img>');

    /* Body headings must not compete with the article title for <h1>. */
    const holder = w.document.createElement('div');
    holder.innerHTML = '<h1 class="h-1">Article Title</h1><div class="prose">' + M.renderSafe('# Intro\n\n## Section\n\n### Sub') + '</div>';
    M.demoteHeadings(holder.querySelector('.prose'), 1);
    ok(holder.querySelectorAll('h1').length === 1, 'exactly one <h1> survives heading demotion');
    ok(/<h2>Intro<\/h2>/.test(holder.querySelector('.prose').innerHTML), 'body "#" heading demoted to <h2>');
    ok(/<h2>Section<\/h2>/.test(holder.querySelector('.prose').innerHTML),
       'demotion shifts level 1 only — an authored "##" stays <h2>');
    ok(/<h3>Sub<\/h3>/.test(holder.querySelector('.prose').innerHTML), 'level-3 body heading left alone');
    ok(/<h2>Article Title<\/h2>|<h1 class="h-1">Article Title<\/h1>/.test(holder.innerHTML), 'the article title itself is untouched');

    /* Reading time / excerpt must see Markdown as prose, not as syntax. */
    const words = M.plainText(md).split(/\s+/).filter(Boolean).length;
    ok(words > 15 && !/[#*|`]/.test(M.plainText(md)), 'plainText() strips Markdown syntax');
    dom.window.close();
  }

  /* ================= articles.js — feed behavior regressions ================= */
  {
    console.log('articles.js (article feed: no keyword blacklist, routing)');
    const src = fs.readFileSync(path.join(ROOT, 'assets/js/articles.js'), 'utf8');
    ok(!/deploying process|omp deploying/i.test(src),
       'the hard-coded "omp deploying" keyword blacklist is gone');
    ok(/isRenderable/.test(src) && /a\.slug/.test(src),
       'feed rows are validated structurally (slug + title), not by content keywords');
    ok(/location\.hash[\s\S]{0,80}#\//.test(src) && /slice\(0, 2\)[\s\S]{0,40}#\//.test(src),
       'only "#/slug" hashes are treated as article routes');
    ok(/OMPMarkdown/.test(src) && /renderSafe/.test(src),
       'article bodies render through the Markdown-aware pipeline');
    ok(/articlePath/.test(src) && /safeSlug/.test(src), 'article links are built from charset-validated slugs');
    ok(/excerpt/.test(src), 'articles without a summary get a generated excerpt');
    ok(/featured_image/.test(src) && /safeUrl\(a\.featured_image\)/.test(src),
       'featured_image is rendered (and scheme-checked) instead of fetched-and-ignored');
    ok(/limit\(PAGE_LIMIT\)|\.limit\(/.test(src), 'feed query is bounded by a limit');
    ok(/lastArticles/.test(src), 'hashchange re-renders from cache instead of refetching');
    ok(/demoteHeadings/.test(src), 'articles.js demotes body headings so the page keeps a single <h1>');
    ok(/demoteHeadings/.test(fs.readFileSync(path.join(ROOT, 'assets/js/admin.js'), 'utf8')),
       'admin preview demotes headings too, so it matches the published page');

    const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    ok(!/assets\/js\/articles\.js/.test(idx), 'index.html does not load articles.js (homepage has no feed mount)');
    ok(/assets\/js\/markdown\.js/.test(fs.readFileSync(path.join(ROOT, 'articles.html'), 'utf8')),
       'articles.html loads markdown.js');
  }

  /* ================= one content hub: Articles ================= */
  {
    console.log('content architecture (Guides consolidated into Articles)');
    const rootHtml = fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).map(f => ({ f, s: fs.readFileSync(path.join(ROOT, f), 'utf8') }));
    const guidePages = fs.readdirSync(path.join(ROOT, 'guides')).filter(f => f.endsWith('.html')).map(f => fs.readFileSync(path.join(ROOT, 'guides', f), 'utf8'));

    for (const { f, s } of rootHtml) {
      if (f === 'guides.html') continue; /* redirect stub — checked separately */
      ok(!s.includes('href="/guides.html"'), `${f}: no link to the removed /guides.html page`);
      ok(!/nav-links[^>]*>.*>Guides</.test(s), `${f}: primary nav has no Guides item`);
    }
    for (let i = 0; i < guidePages.length; i++) {
      ok(!guidePages[i].includes('href="/guides.html"'), `guides page ${i + 1}/15: no link to the removed /guides.html page`);
    }

    /* Navbar contract: Home, Checker, Generator, Tools, Articles, Breach Check, About
       (+ the JS-injected Search trigger in nav-actions). */
    const blog = rootHtml.find(x => x.f === 'articles.html').s;
    const nav = blog.match(/<nav class="nav-links"[^>]*>([\s\S]*?)<\/nav>/)[1];
    const navLabels = [...nav.matchAll(/<a href="([^"]*)"[^>]*>([^<]*)<\/a>/g)].map(m => m[2]);
    ok(JSON.stringify(navLabels) === JSON.stringify(['Home', 'Checker', 'Generator', 'Tools', 'Articles', 'Products', 'Breach Check', 'About']),
       `desktop navbar is exactly the 8 target items — got [${navLabels.join(', ')}]`);
    const mobile = blog.match(/<nav class="mobile-menu"[^>]*>([\s\S]*?)<a class="btn/)[1];
    ok(!mobile.includes('/guides.html') && !/>Guides</.test(mobile), 'mobile menu has no Guides item');
    ok(mobile.includes('/articles">Articles<'), 'mobile menu links Articles to the hub');
    ok(mobile.includes('/products">Products<'), 'mobile menu links Products to its own hub');

    /* The legacy hub is a redirect, not a destination. */
    const stub = fs.readFileSync(path.join(ROOT, 'guides.html'), 'utf8');
    ok(/http-equiv="refresh"[^>]*url=\/articles/.test(stub), 'guides.html meta-refreshes to /articles');
    ok(/rel="canonical"[^>]*\/articles/.test(stub), 'guides.html canonical points at /articles');
    ok(/noindex/.test(stub), 'guides.html is noindex');
    const fb = fs.readFileSync(path.join(ROOT, 'firebase.json'), 'utf8');
    ok(fb.includes('"source": "/guides.html"') && fb.includes('"destination": "/articles"') && fb.includes('"type": 301'),
       'firebase.json 301-redirects /guides.html to /articles');

    /* Guides are classified inside the hub, not deleted. */
    const bjs = fs.readFileSync(path.join(ROOT, 'assets/js/articles.js'), 'utf8');
    ok((bjs.match(/slug: '[a-z0-9-]+', title:/g) || []).length === 15, 'articles.js bakes in all 15 static guides');
    ok(/categorySlug: 'guides'/.test(bjs), 'static guides are classified under the "guides" category');
    for (const slug of ['news', 'security', 'deep-dives', 'how-to', 'guides'])
      ok(bjs.includes(`{ name: '${slug === 'deep-dives' ? 'Deep Dives' : slug === 'how-to' ? 'How-To' : slug[0].toUpperCase() + slug.slice(1)}', slug: '${slug}' }`), `canonical category "${slug}" exists in the hub filter`);
    ok(/FETCH_TIMEOUT_MS/.test(bjs) && /isTimeout/.test(bjs), 'feed fetch has a hard timeout (no indefinite loading)');
    ok(/renderSkeleton/.test(bjs) && /skel/.test(bjs), 'feed has a skeleton loading state');
    ok(/data-retry/.test(bjs), 'feed error state offers a Retry action');
    ok(/Nothing here yet/.test(bjs) && /Can.t load this category/.test(bjs), 'empty state is distinct from fetch failure');
    ok(/supabase/.test(fs.readFileSync(path.join(ROOT, 'supabase/00_schema_migrations.sql'), 'utf8').toLowerCase()) &&
       fs.readFileSync(path.join(ROOT, 'supabase/00_schema_migrations.sql'), 'utf8').includes("('Guides',     'guides',     5)"),
       'schema seeds the Guides category (plus News/Security/Deep Dives/How-To)');

    /* Search index: one content destination, guides still findable. */
    const sjs = fs.readFileSync(path.join(ROOT, 'assets/js/search.js'), 'utf8');
    ok(!sjs.includes("/guides.html") && !sjs.includes("url: '/blog.html'"), 'search index lists no legacy hub pages');
    ok((sjs.match(/url: '\/articles\/[a-z0-9-]+'/g) || []).length === 15, 'search index finds all 15 guide articles at /articles/<slug>');
    ok(/url: '\/articles', kw: 'blog articles[^']*guides/.test(sjs), 'Articles hub entry covers "guides" queries');

    /* Sitemaps: hub listed, legacy hub gone, guide articles kept. */
    const sm = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
    ok(!sm.includes('/guides.html</loc>'), 'sitemap.xml drops the removed /guides.html page');
    ok(sm.includes('https://oopsmypassword.com/articles</loc>'), 'sitemap.xml lists the Articles hub at its pretty URL');
    ok((sm.match(/\/articles\/[a-z0-9-]+<\/loc>/g) || []).length === 15, 'sitemap.xml lists all 15 guide articles at /articles/<slug>');
    ok(!/\.html<\/loc>/.test(sm), 'sitemap.xml contains no .html implementation URLs');
  }


  /* ================= URL architecture (pretty public URLs) ================= */
  {
    console.log('url architecture (pretty URLs, routing, redirects)');
    const createRouter = require('./hosting_router.js');
    const router = createRouter(ROOT, path.join(ROOT, 'firebase.json'));

    /* --- Firebase-equivalent routing table: direct navigation & refresh.
           The same resolution answers a browser refresh of the same URL. --- */
    const table = [
      ['/',              { type: 'file', file: '/index.html' }],
      ['/checker',       { type: 'file', file: '/checker.html' }],
      ['/articles',      { type: 'file', file: '/articles.html' }],
      ['/products',      { type: 'file', file: '/products.html' }],
      ['/articles/create-strong-password', { type: 'file', file: '/guides/create-strong-password.html' }],
      ['/articles/critical-langflow-vulnerability', { type: 'file', file: '/articles.html' }],
      ['/products/my-cybersecurity-book', { type: 'file', file: '/products.html' }],
      ['/sitemap.xml',   { type: 'file', file: '/sitemap.xml' }],
    ];
    for (const [p, want] of table) {
      const got = router.resolve(p, 0);
      ok(got.type === want.type && got.file === want.file,
         `direct navigation to ${p} serves ${want.file} — got ${got.type} ${got.file || ''}`);
    }

    /* --- permanent redirects for legacy URLs --- */
    const redirs = [
      ['/checker.html', '/checker'],
      ['/checker/', '/checker'],
      ['/index.html', '/'],
      ['/blog.html', '/articles'],
      ['/blog', '/articles'],
      ['/guides.html', '/articles'],
      ['/guides', '/articles'],
      ['/guides/passkeys-explained.html', '/articles/passkeys-explained'],
      ['/guides/passkeys-explained', '/articles/passkeys-explained'],
      ['/articles/', '/articles'],
      ['/products/', '/products'],
    ];
    for (const [from, to] of redirs) {
      const got = router.resolve(from, 0);
      ok(got.type === 'redirect' && got.location === to && got.status === 301,
         `${from} 301-redirects to ${to} — got ${got.type} ${got.location || ''}`);
    }

    /* --- unknown paths reach the custom 404 page --- */
    const nf = router.resolve('/definitely-not-a-page', 0);
    ok(nf.type === 'notfound' && nf.file === '/404.html', 'unknown path serves the custom 404 page');

    /* --- every redirect chain terminates (no loops) --- */
    const loopTargets = redirs.map(r => r[0])
      .concat(['/articles/passkeys-explained.html', '/guides/two-factor-authentication.html', '/tools/', '/faq/', '/products/some-product.html']);
    for (const p of loopTargets) {
      const f = router.follow(p);
      ok(f.end.type !== 'loop', `redirect chain for ${p} terminates (no loops)`);
    }

    /* --- shipped pages expose no .html implementation URLs --- */
    const rootHtml2 = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'))
      .map(f => ({ f, s: fs.readFileSync(path.join(ROOT, f), 'utf8') }));
    for (const { f, s } of rootHtml2) {
      if (f === 'guides.html') continue; /* redirect stub, covered above */
      const bad = s.match(/href="\/[a-z0-9-]+\.html[^"]*"/g) || [];
      ok(!bad.length, `${f}: no .html hrefs in shipped markup${bad.length ? ' — ' + bad[0] : ''}`);
    }

    /* --- canonical + og:url are the pretty public URLs --- */
    for (const { f, s } of rootHtml2) {
      if (f === 'guides.html' || f === 'products.html') continue; /* stub / noindex until content ships */
      const canon = (s.match(/rel="canonical" href="([^"]+)"/) || [])[1] || '';
      const og = (s.match(/property="og:url" content="([^"]+)"/) || [])[1] || '';
      ok(!/\.html$/.test(canon), `${f}: canonical is a pretty URL (${canon})`);
      ok(!/\.html$/.test(og), `${f}: og:url is a pretty URL (${og})`);
    }

    /* --- articles.js: pathname routing, slug safety, canonical meta --- */
    const ajs = fs.readFileSync(path.join(ROOT, 'assets/js/articles.js'), 'utf8');
    ok(ajs.includes('location.pathname') && ajs.includes('history.replaceState'),
       'articles.js routes by pathname and normalizes legacy #/slug URLs');
    ok(/SLUG_RE/.test(ajs) && /safeSlug/.test(ajs),
       'slugs are charset-guarded before they form URLs');
    ok(ajs.includes('link[rel="canonical"]'),
       'dynamic article views rewrite the canonical URL to /articles/<slug>');
    ok(ajs.includes('noindex'), 'not-found article views are marked noindex');

    /* --- products app: slug URLs with the same guarantees --- */
    ok(fs.existsSync(path.join(ROOT, 'products.html')), 'products.html exists (public /products)');
    const pjs = fs.readFileSync(path.join(ROOT, 'assets/js/products.js'), 'utf8');
    ok(/\/products\//.test(pjs) && /SLUG_RE/.test(pjs), 'product URLs are slug-based and charset-guarded');
    ok(pjs.includes('noindex'), 'product not-found views are marked noindex');
    ok(/products_select_published/.test(fs.readFileSync(path.join(ROOT, 'supabase/00_schema_migrations.sql'), 'utf8')),
       'products table has published-only public read (RLS)');
  }


  /* ================= products system (public + admin + schema) ================= */
  {
    console.log('products system (catalog, types, pricing, security, admin)');
    const schema = fs.readFileSync(path.join(ROOT, 'supabase/00_schema_migrations.sql'), 'utf8');
    const pjs = fs.readFileSync(path.join(ROOT, 'assets/js/products.js'), 'utf8');
    const ajs = fs.readFileSync(path.join(ROOT, 'assets/js/admin.js'), 'utf8');
    const sjs = fs.readFileSync(path.join(ROOT, 'assets/js/search.js'), 'utf8');
    const phtml = fs.readFileSync(path.join(ROOT, 'products.html'), 'utf8');

    /* --- schema: types, pricing, flags, private deliverables --- */
    ok(schema.includes("check (product_type in ('book','course','tool','template','resource','other'))"),
       'products.product_type is constrained to the six canonical types');
    for (const col of ['price numeric(10,2)', 'currency char(3)', 'cta_label', 'featured boolean', 'file_path text'])
      ok(schema.includes(col), `products table defines ${col.split(' ')[0]}`);
    ok(schema.includes('products_select_published') && schema.includes("for select to anon using (status = 'published')"),
       'anon reads published products only (RLS)');
    ok(schema.includes('products_admin_insert') && schema.includes('products_admin_update') && schema.includes('products_admin_delete'),
       'product writes are admin-only (RLS)');
    ok(schema.includes("values ('product-files', 'product-files', false)"),
       'deliverables live in a PRIVATE bucket (public=false)');
    ok(!/product-files[\s\S]{0,400}for select to anon/.test(schema),
       'NO anon read policy exists for the private product-files bucket');
    ok(schema.includes('createSignedUrl') || schema.includes('signed'),
       'schema documents the signed-URL download flow for purchased files');
    ok(schema.includes("values ('products', 'products', true)"),
       'covers live in a public bucket (marketing assets)');

    /* --- public app: types, guards, sanitization, states --- */
    const TYPES = ['book', 'course', 'tool', 'template', 'resource', 'other'];
    for (const t of TYPES) ok(pjs.includes(`type: '${t}'`), `public app knows the "${t}" product type`);
    ok(pjs.includes('SLUG_RE') && pjs.includes('safeSlug'), 'product slugs are charset-guarded before URLs are built');
    ok(pjs.includes('OMPUrl') && pjs.includes('safeUrl'), 'products.js safeUrl delegates to the canonical OMPUrl validator');
    ok(/OMPMarkdown[\\s\\S]*renderSafe|renderSafe/.test(pjs), 'full descriptions render through the sanitized pipeline');
    ok(pjs.includes('has_file') && !/href=[^+]*file_path/.test(pjs),
       'private deliverables never become a link (has_file flag only)');
    ok(pjs.includes('omp-product-ld') && pjs.includes("'@type': 'Product'"), 'product detail pages emit schema.org/Product JSON-LD');
    ok(pjs.includes('InStock') && pjs.includes('priceCurrency'), 'JSON-LD includes an Offer with price/currency');
    ok(pjs.includes('Intl.NumberFormat'), 'prices are formatted per currency');
    ok(/Buy Now|Learn More|Get It/.test(pjs), 'CTA labels use the specified verbs');
    ok(/target="_blank" rel="noopener noreferrer"/.test(pjs), 'external CTAs open in a safe context');
    ok(pjs.includes('renderSkeleton') && pjs.includes('FETCH_TIMEOUT_MS') && pjs.includes('data-retry'),
       'skeleton + hard timeout + Retry all present');
    ok(/No products yet/.test(pjs) && /Can.t load products right now/.test(pjs) && /No products match/.test(pjs),
       'empty catalog, fetch failure and filter miss are three distinct states');
    ok(pjs.includes('noindex') && pjs.includes('Product not found'),
       'invalid slugs render a not-found view marked noindex');
    ok(/product-grid/.test(pjs) && /product-card/.test(pjs) && /data-ptype/.test(pjs) && /#product-search/.test(pjs),
       'responsive grid + type filter chips + search input are wired');
    ok(pjs.includes('featured') && /Featured/.test(pjs), 'featured products are surfaced');
    ok(!/from\('articles'\)/.test(pjs) && !/article_categories/.test(pjs),
       'products app never queries the articles tables (no mixing)');

    /* --- admin: full CRUD + guards --- */
    ok(ajs.includes('data-tab="products"'), 'admin dashboard has a Products tab');
    ok(ajs.includes("tab === 'products'"), 'admin loads the products section');
    ok(/data-publish-product/.test(ajs) && /data-feature-product/.test(ajs) && /data-delete-product/.test(ajs) && /data-edit-product/.test(ajs),
       'admin list offers publish/unpublish, feature/unfeature, edit, delete');
    for (const field of ['name="product_type"', 'name="price"', 'name="currency"', 'name="cta_label"', 'name="featured"', 'name="external_url"', 'name="featured_image"', 'name="deliverable"'])
      ok(ajs.includes(field), `admin product form has ${field.replace('name="', '').replace('"', '')}`);
    ok(ajs.includes("from('product-files')"), 'deliverable uploads target the PRIVATE product-files bucket');
    ok(!/getPublicUrl[\s\S]{0,80}product-files/.test(ajs),
       'admin never derives a public URL for a private deliverable');
    ok(ajs.includes("from('products').upload(path, file") || /storage\.from\('products'\)\.upload/.test(ajs),
       'cover uploads go to the public products covers bucket');
    ok(/OMPFileValidate/.test(ajs), 'deliverable uploads run the magic-byte validator');
    ok(/Purchase URL must be a (full |absolute )?http/.test(ajs), 'javascript:/data: purchase URLs are rejected at entry');
    ok(/ISO 4217/.test(ajs), 'currency is validated as 3-letter ISO 4217');
    ok(/function productForm/.test(ajs) && /slugify\(f\.get\('slug'\)\)/.test(ajs),
       'product slugs are produced by the shared slugify (safe charset)');
    ok(!/from\('articles'\)[\s\S]{0,200}product/.test(ajs.replace(/[\s\S]*function productForm/, '')),
       'product form writes only to the products table');

    /* --- search: products in the live index, guarded --- */
    ok(sjs.includes('/rest/v1/products?select=slug,name,summary,product_type&status=eq.published'), 'live search queries published products');
    ok(new RegExp("/\\\\/products\\\\/\\\\?' \\+ encodeURIComponent\\(p\\.slug\\)").test(sjs) || sjs.includes("'/products/' + encodeURIComponent(p.slug)"),
       'live product results link to /products/<slug> with encoded slugs');
    ok(sjs.includes('.omp-sr-badge.b-product{'), 'search styles a Product badge');
    ok(sjs.includes("title: 'Products', desc: 'Books, courses"), 'baked-in index lists the Products hub page');

    /* --- sitemap + page shell --- */
    ok(fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8').includes('https://oopsmypassword.com/products</loc>'),
       'sitemap.xml lists /products');
    ok(phtml.includes('data-products') && phtml.includes('/assets/js/products.js'),
       'products.html mounts the products app');
  }

  /* ================= search.js — unsafe URLs, cache, mobile button ========= */
  {
    console.log('search.js (poisoned live rows, dedup, mobile button, modal a11y)');
    const dom = await loadPage('', { wait: 300 });
    const w = dom.window, d = w.document;
    await new Promise(r => setTimeout(r, 300));

    /* Seed the live cache with hostile + duplicate rows. fetchLive() trusts
       sessionStorage first, so this exercises the render-time URL gate. */
    w.sessionStorage.setItem('omp-search-live-v3', JSON.stringify({ t: Date.now(), items: [
      { type: 'Tool', title: 'Evil Route', desc: 'should never render', url: 'javascript:alert(1)', kw: 'zzzpoison' },
      { type: 'Tool', title: 'Off Site', desc: 'should never render', url: 'https://evil.example/x', kw: 'zzzpoison' },
      { type: 'Article', title: 'Dup One', desc: '', url: '/articles/dup', kw: 'zzzpoison' },
      { type: 'Article', title: 'Dup One', desc: '', url: '/articles/dup', kw: 'zzzpoison' },
      { type: 'Tool', title: 'Password Generator', desc: '', url: '/generator.html', kw: 'zzzpoison' },
      { type: 'Article', title: 'Good Article', desc: 'a real post', url: '/articles/good-one', kw: 'zzzpoison' }
    ] }));

    d.body.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 120));
    const overlay = d.getElementById('omp-search-overlay');
    ok(!!overlay && !overlay.hidden, 'Ctrl+K opens the search dialog');

    const input = d.getElementById('omp-search-input');
    input.value = 'zzzpoison';
    input.dispatchEvent(new w.Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 250));
    const html = overlay.innerHTML;
    ok(!/javascript:/i.test(html), 'javascript: URL from a live row never reaches an href');
    ok(!/evil\.example/i.test(html), 'off-site URL from a live row never reaches an href');
    ok(!/Evil Route|Off Site/.test(html), 'rows with unsafe destinations are dropped entirely');
    ok((html.match(/Dup One/g) || []).length === 1, 'duplicate live rows are collapsed to one result');
    ok(/Good Article/.test(html), 'safe live article row still renders');
    ok(!/zzzpoison/.test(overlay.textContent), 'search keywords are not echoed into the UI');

    /* Baked-in index must not be duplicated by a matching live tool row. */
    input.value = 'generator';
    input.dispatchEvent(new w.Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 250));
    const genLinks = Array.from(overlay.querySelectorAll('a.omp-sr-row')).map(a => a.getAttribute('href'));
    ok(genLinks.filter(h => h === '/generator' || h === '/generator.html').length === 1,
       'live tool row for /generator.html does not duplicate the baked-in /generator entry');

    /* Modal a11y: trigger state + page hidden from assistive tech while open. */
    const trigger = d.getElementById('omp-search-trigger');
    ok(trigger.getAttribute('aria-expanded') === 'true', 'trigger reports aria-expanded=true while open');
    ok(d.querySelector('header.site-nav').getAttribute('aria-hidden') === 'true',
       'background content is aria-hidden while the modal is open');
    ok(input.getAttribute('role') === 'combobox' && input.hasAttribute('aria-controls'),
       'search input is a combobox wired to the listbox');
    ok(/aria-activedescendant="omp-sr-opt-/.test(input.outerHTML) || input.getAttribute('aria-activedescendant') !== '',
       'active option is published via aria-activedescendant');
    ok(overlay.querySelectorAll('li[role="option"][id^="omp-sr-opt-"]').length > 0,
       'result rows are addressable options with ids');

    d.body.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 80));
    ok(overlay.hidden, 'Escape closes the dialog');
    ok(trigger.getAttribute('aria-expanded') === 'false', 'trigger aria-expanded resets on close');
    ok(!d.querySelector('header.site-nav').hasAttribute('aria-hidden'), 'background aria-hidden is removed on close');
    ok(d.body.style.overflow === '', 'body scroll lock is released on close');
    dom.window.close();
  }

  /* ---- mobile-menu search button (the unsized-SVG layout bug) ---- */
  {
    console.log('search.js (mobile menu button)');
    const dom = await loadPage('checker.html', { wait: 300 });
    const w = dom.window, d = w.document;
    await new Promise(r => setTimeout(r, 300));
    const mBtn = d.getElementById('omp-search-mobile-trigger');
    ok(!!mBtn, 'mobile-menu search button is injected');
    ok(mBtn && !!mBtn.querySelector('svg'), 'mobile button carries the magnifier icon');
    ok(mBtn && !mBtn.getAttribute('style'), 'mobile button is styled by the stylesheet, not an inline cssText');
    const css = d.getElementById('omp-search-css');
    ok(css && /\.mobile-search-btn svg\{width:18px;height:18px/.test(css.textContent),
       'stylesheet sizes the mobile button SVG (an <svg> with only a viewBox defaults to ~300x150)');
    ok(css && /\.mobile-search-btn\{[^}]*display:flex/.test(css.textContent),
       '.mobile-search-btn layout rules are present');
    mBtn.click();
    await new Promise(r => setTimeout(r, 120));
    ok(!d.getElementById('mobile-menu').classList.contains('open'), 'opening search closes the mobile menu');
    ok(!d.getElementById('omp-search-overlay').hidden, 'mobile button opens the search dialog');
    dom.window.close();
  }

  /* ================= search.js — FAQ/glossary coverage + live region ==== */
  {
    console.log('search.js (FAQ/glossary in the index + a11y live region)');
    const dom = await loadPage('', { wait: 300 });
    const w = dom.window, d = w.document;
    await new Promise(r => setTimeout(r, 300));
    d.body.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 120));
    const input = d.getElementById('omp-search-input');
    input.value = 'passkey';
    input.dispatchEvent(new w.Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 250));
    const txt = d.getElementById('omp-search-overlay').textContent;
    ok(/What are passkeys\?/.test(txt), 'FAQ question surfaced for \"passkey\"');
    ok(/Passkey/.test(txt), 'glossary term surfaced for \"passkey\"');
    ok(!/javascript:/i.test(d.getElementById('omp-search-overlay').innerHTML), 'new static entries never introduce unsafe hrefs');
    const live = d.querySelector('[data-search-live]');
    ok(!!live && live.getAttribute('role') === 'status', 'search dialog exposes a polite live region');
    ok(/result/.test(live.textContent), 'live region announces the result count');
    dom.window.close();
  }
  /* ================= admin panel ================= */
  {
    console.log('admin/index.html (shared render pipeline + live preview editor)');
    const dom = await loadPage('admin/index.html', { wait: 250 });
    const d = dom.window.document;
    await new Promise(r => setTimeout(r, 250));
    ok(d_scriptsInOrder(d, ['/assets/js/sanitize.js', '/assets/js/markdown.js', '/assets/js/admin-boot-watchdog.js']),
       'admin loads sanitize.js + markdown.js before the boot watchdog/module');
    ok(d.querySelectorAll('script[type="module"][src="/assets/js/admin.js"]').length === 1, 'admin.js still loaded as a module');
    ok(d.querySelector('meta[name="robots"][content*="noindex"]'), 'admin stays noindex');
    dom.window.close();

    const src = fs.readFileSync(path.join(ROOT, 'assets/js/admin.js'), 'utf8');
    ok(/OMPMarkdown/.test(src) && /renderBody/.test(src),
       'admin preview uses the same renderer as the public feed');
    ok(/article-preview/.test(src) && /class="preview-frame"/.test(src), 'live preview editor is present');
    ok(/class="toolbar"/.test(src) && /TOOLBAR/.test(src), 'Markdown formatting toolbar is present');
    ok(/class="body-editor"/.test(src), 'uses the .body-editor styles from admin.css');
    ok(/data-unsaved/.test(src) && /beforeunload/.test(src), 'unsaved-changes guard wired up');
    ok(/article-filter/.test(src), 'article list has a filter/search box');
    ok(!/<label>/.test(src), 'no attribute-less <label> elements (each is for=… or wraps its control)');
    ok(/tabToken/.test(src), 'loadTab() is race-guarded');
    ok(/Delete failed|failed:/.test(src), 'delete/update failures are surfaced instead of swallowed');
    ok(/aria-pressed/.test(src), 'tab buttons expose their active state');
    ok(!/alert\(`Delete/.test(src), 'no alert()-only error reporting on destructive actions');
    ok(/Route must start with/.test(src), 'tool routes are validated as on-site paths');

    const acss = fs.readFileSync(path.join(ROOT, 'assets/css/admin.css'), 'utf8');
    ok(/\.unsaved-dot\[hidden\]\s*\{\s*display:\s*none/.test(acss),
       '.unsaved-dot[hidden] re-asserts display:none (inline-block beats the UA rule)');
    ok(!/\.admin-shell|\.help-ol/.test(acss), 'orphaned admin CSS rules removed');
  }

  /* ================= CSS regressions (overflow + contrast) ================= */
  {
    console.log('styles.css (horizontal overflow + WCAG AA contrast)');
    const css = fs.readFileSync(path.join(ROOT, 'assets/css/styles.css'), 'utf8');

    /* .page-hero::before bleeds past the box with inset:-30% -20%; without a
       clip it made all 19 inner pages wider than the viewport. */
    const heroRule = (css.match(/\.page-hero\s*\{[^}]*\}/) || [''])[0];
    ok(/overflow:\s*hidden/.test(heroRule), '.page-hero clips its ::before glow (overflow:hidden)');
    for (const sel of ['.hero', '.cta-band']) {
      const r = (css.match(new RegExp('\\' + sel + '\\s*\\{[^}]*\\}')) || [''])[0];
      ok(/overflow:\s*hidden/.test(r), sel + ' still clips its decorative bleed');
    }
    const heroPages = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'))
      .filter(f => fs.readFileSync(path.join(ROOT, f), 'utf8').includes('class="page-hero"'));
    ok(heroPages.length === 19, '19 inner pages use .page-hero (products.html added, guides.html is now a redirect stub) — got ' + heroPages.length);

    /* Contrast: every text token must clear 4.5:1 on every surface it can sit on. */
    const hex2rgb = h => { h = h.trim().replace('#', ''); return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)); };
    const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const lum = rgb => { const [r, g, b] = rgb.map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const ratio = (f, b) => { const l1 = lum(hex2rgb(f)), l2 = lum(hex2rgb(b)); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
    /* Pull custom properties out of a literal selector block. Regex-escaping
       the selector is what made this silently return {} for the light theme. */
    const grab = (selector) => {
      const start = css.indexOf(selector);
      if (start === -1) return {};
      const open = css.indexOf('{', start);
      const close = css.indexOf('}', open);
      const block = css.slice(open, close);
      const out = {};
      for (const m of block.matchAll(/(--[\w-]+)\s*:\s*(#[0-9A-Fa-f]{6})\s*;/g)) out[m[1]] = m[2];
      return out;
    };
    const darkBase = grab(':root');
    const lightBlock = grab('[data-theme="light"]');
    ok(Object.keys(lightBlock).length >= 8, 'light-theme token block was parsed (' + Object.keys(lightBlock).length + ' hex tokens)');
    const lightBase = Object.assign({}, darkBase, lightBlock);
    const SURFACES = {
      dark: ['#050811', '#070B16', '#0B1020', '#101827', '#131D31'],
      light: ['#F6F8FC', '#EEF2F9', '#FFFFFF', '#F8FAFF']
    };
    const TEXT_TOKENS = ['--text', '--muted', '--muted-2', '--purple', '--blue', '--cyan', '--green', '--yellow', '--red', '--orange'];
    for (const theme of ['dark', 'light']) {
      const tokens = theme === 'dark' ? darkBase : lightBase;
      for (const t of TEXT_TOKENS) {
        const v = tokens[t];
        if (!v) { ok(false, `${theme}: token ${t} is defined`); continue; }
        const worst = Math.min(...SURFACES[theme].map(b => ratio(v, b)));
        ok(worst >= 4.5, `${theme} ${t} (${v}) >= 4.5:1 on all ${theme} surfaces — worst ${worst.toFixed(2)}`);
      }
    }
    /* White-on-color: skip link + primary CTA gradient stops. */
    ok(ratio('#FFFFFF', '#6D28D9') >= 4.5, 'skip-link background keeps white text >= 4.5:1');
    for (const stop of (css.match(/\.btn-primary\s*\{[^}]*linear-gradient\(135deg,\s*(#[0-9A-Fa-f]{6}),\s*(#[0-9A-Fa-f]{6})\)/) || []).slice(1)) {
      ok(ratio('#FFFFFF', stop) >= 4.5, `.btn-primary gradient stop ${stop} keeps white text >= 4.5:1 (${ratio('#FFFFFF', stop).toFixed(2)})`);
    }
    /* .grad-text is real text, so every brand-gradient stop must pass too. */
    for (const theme of ['dark', 'light']) {
      const block = theme === 'dark' ? css.slice(css.indexOf(':root'), css.indexOf('}', css.indexOf(':root')))
                                     : css.slice(css.indexOf('[data-theme="light"]'), css.indexOf('}', css.indexOf('[data-theme="light"]')));
      const grad = block.match(/--brand-grad:\s*linear-gradient\(135deg,\s*(#[0-9A-Fa-f]{6})[^,]*,\s*(#[0-9A-Fa-f]{6})[^,]*,\s*(#[0-9A-Fa-f]{6})/);
      if (!grad) { ok(false, `${theme}: --brand-grad found`); continue; }
      for (const stop of grad.slice(1)) {
        const worst = Math.min(...SURFACES[theme].map(b => ratio(stop, b)));
        ok(worst >= 4.5, `${theme} .grad-text stop ${stop} >= 4.5:1 (worst ${worst.toFixed(2)})`);
      }
    }
    /* Article prose must style everything the Markdown renderer can emit. */
    for (const sel of ['.prose table', '.prose blockquote', '.prose hr', '.prose img', '.prose h4', '.prose th']) {
      ok(css.includes(sel), `${sel} is styled (Markdown output would otherwise be unstyled)`);
    }
    ok(/\.prose table\s*\{[^}]*overflow-x:\s*auto/.test(css), '.prose tables scroll instead of forcing page overflow');
    ok(!/\.adm-badge|\.blog-grid|\.empty-state|\.article-back/.test(css), 'dead blog/admin-badge CSS removed');
  }

  /* ================= repo hygiene / deploy config ================= */
  {
    console.log('repo hygiene + firebase.json');
    const fb = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase.json'), 'utf8'));
    ok(!fb.hosting.headers.some(h => h.source === '/content/**'), 'dead /content/** header rule removed');
    ok(fb.hosting.headers.some(h => h.source === '**' &&
        h.headers.some(x => x.key === 'Content-Security-Policy' && /connect-src[^;]*supabase\.co/.test(x.value))),
       'CSP still allows the Supabase origin');
    ok(fb.hosting.ignore.includes('tools/**') && fb.hosting.ignore.includes('**/*.md'),
       'build tooling + markdown still excluded from deploys');
    for (const gone of ['find-overflow.js', 'find-overflow2.js', 'find-overflow3.js', 'find-overflow4.js', 'test-browser.js', 'test-audit.js', 'audit-report.json']) {
      ok(!fs.existsSync(path.join(ROOT, gone)), `scratch file ${gone} is out of the deploy root`);
    }
    ok(fs.existsSync(path.join(ROOT, 'tools/browser-audit.js')), 'browser audit harness kept under tools/');
    const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
    ok(!/The panel needs no login/.test(readme), 'README no longer contradicts the Supabase-Auth admin panel');
    ok(!/Plus: 10 guides/.test(readme), 'README guide count matches the 15 generated guides');
    ok(!/long-term caching for `\/assets`/.test(readme), 'README caching claim matches firebase.json (no-cache)');
    ok(/markdown\.js/.test(readme), 'README documents the Markdown renderer');

    /* Build must stay reproducible: generated pages must not drift from tools/. */
    const layoutPy = fs.readFileSync(path.join(ROOT, 'tools/omp_build/layout.py'), 'utf8');
    ok(layoutPy.includes('("/Articles", "/articles")') || layoutPy.includes('("Articles", "/articles")'),
       'layout.py nav points Articles at the pretty /articles URL');
    ok(!layoutPy.includes('("/Guides", "/guides') && !layoutPy.includes('("Guides", "/guides.html")'),
       'layout.py primary nav no longer has a separate Guides item');
    ok(fs.readFileSync(path.join(ROOT, 'articles.html'), 'utf8').includes('/assets/js/markdown.js'),
       'generated articles.html contains the markdown.js script tag (build output committed)');
    ok(!fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').includes('/assets/js/articles.js'),
       'generated index.html no longer references articles.js (build output committed)');
  }


  /* ================= centralized URL validation (OMPUrl) ================= */
  {
    console.log('url.js (canonical URL validator)');
    const OMPUrl = require(path.join(ROOT, 'assets/js/url.js'));
    const safe = (v, o) => OMPUrl.safeUrl(v, o);

    ok(safe('javascript:alert(1)', { attrSafe: true }) === null, 'javascript: URL rejected');
    ok(safe('vbscript:msgbox(1)', { attrSafe: true }) === null, 'vbscript: URL rejected');
    ok(safe('data:text/html,<script>alert(1)</script>', { attrSafe: true }) === null, 'data:text/html URL rejected');
    ok(safe('https://site.example/a', { attrSafe: true }) === 'https://site.example/a', 'https URL allowed');
    ok(safe('mailto:a@b.com', { attrSafe: true }) === null, 'mailto: rejected by default');
    ok(safe('mailto:a@b.com', { allowMailto: true, attrSafe: true }) === 'mailto:a@b.com', 'mailto: allowed when enabled');
    ok(safe('/checker.html', { attrSafe: true }) === '/checker.html', 'site-relative path allowed');
    ok(safe('#main', { attrSafe: true }) === '#main', 'in-page anchor allowed');
    ok(safe('../secrets', { attrSafe: true }) === '../secrets', 'parent-relative allowed by default');
    ok(safe('../secrets', { noUpLevel: true, attrSafe: true }) === null, 'parent-relative rejected with noUpLevel');
    ok(safe('//evil.example/x', { noProtocolRelative: true, attrSafe: true }) === null, 'protocol-relative //host rejected');
    ok(safe('https://evil.example/x', { sameOriginOnly: true, attrSafe: true }) === null, 'off-site https rejected with sameOriginOnly');
    ok(safe('https://x.com",onerror=1', { attrSafe: true }) === null, 'attribute break-out rejected');

    /* The four decorated helpers still hand off to OMPUrl. */
    const sanitize = fs.readFileSync(path.join(ROOT, 'assets/js/sanitize.js'), 'utf8');
    const markdown = fs.readFileSync(path.join(ROOT, 'assets/js/markdown.js'), 'utf8');
    const blog = fs.readFileSync(path.join(ROOT, 'assets/js/articles.js'), 'utf8');
    const search = fs.readFileSync(path.join(ROOT, 'assets/js/search.js'), 'utf8');
    ok(/OMPUrl\.safeUrl/.test(sanitize) && /OMPUrl\.safeUrl/.test(markdown), 'sanitize.js + markdown.js delegate to OMPUrl');
    ok(/OMPUrl\.safeUrl/.test(blog), 'articles.js safeUrl delegates to OMPUrl');
    ok(/OMPUrl\.safeUrl/.test(search), 'search.js safeResultUrl delegates to OMPUrl');

    /* url.js is loaded before the modules that depend on it. */
    const blogHtml = fs.readFileSync(path.join(ROOT, 'articles.html'), 'utf8');
    const idxUrl = blogHtml.indexOf('/assets/js/url.js');
    const idxSan = blogHtml.indexOf('/assets/js/sanitize.js');
    const idxMk = blogHtml.indexOf('/assets/js/markdown.js');
    const idxBlog = blogHtml.indexOf('/assets/js/articles.js');
    ok(idxUrl !== -1 && idxUrl < idxSan && idxSan < idxMk && idxMk < idxBlog,
       'articles page loads url.js before sanitize.js/markdown.js/articles.js');
    const adminHtml = fs.readFileSync(path.join(ROOT, 'admin/index.html'), 'utf8');
    ok(adminHtml.indexOf('/assets/js/url.js') < adminHtml.indexOf('/assets/js/sanitize.js') &&
       adminHtml.indexOf('/assets/js/filevalidate.js') < adminHtml.indexOf('/assets/js/admin-boot-watchdog.js'),
       'admin loads url.js + filevalidate.js before the modules that use them');
    const idxHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    ok(idxHtml.includes('/assets/js/url.js'), 'homepage loads url.js');
  }

  /* ================= client-side document / PDF validation ================= */
  {
    console.log('filevalidate.js (magic-byte + Content-Type gating)');
    const F = require(path.join(ROOT, 'assets/js/filevalidate.js'));
    const u8 = (a) => new Uint8Array(a);
    const chars = (s) => Array.from(s).map(c => c.charCodeAt(0));
    const pdf = chars('%PDF-1.7 ');
    const zip = [...chars('PK\x03\x04'), ...chars('word/')];
    const oledoc = [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1, 0, 0, 0, 0];

    ok(F.describeBytes(u8(pdf), 'a.pdf').ok === true, 'real PDF accepted');
    ok(F.describeBytes(u8(pdf), 'a.pdf').contentType === 'application/pdf', 'PDF forced to application/pdf');
    ok(F.describeBytes(u8(chars('<html><script>x</script></html>')), 'a.pdf').ok === false,
       'HTML smuggled as .pdf rejected (signature mismatch)');
    ok(F.describeBytes(u8([0x4D, 0x5A, 0, 0, 0, 0, 0, 0]), 'a.txt').ok === false,
       'binary exe renamed .txt rejected');
    ok(F.describeBytes(u8(zip), 'a.docx').ok === true, 'ZIP (.docx) accepted');
    ok(F.describeBytes(u8(oledoc), 'a.doc').ok === true, 'OLE2 (.doc) accepted');
    ok(F.describeBytes(u8(chars('# Title\nhello')), 'a.md').ok === true, 'markdown text accepted');
    ok(F.describeBytes(u8(pdf), 'a.exe').ok === false, 'disallowed extension rejected');
    ok(F.describeBytes(u8(chars('<svg><script>x</script></svg>')), 'a.txt').ok === false,
       'SVG-with-script renamed .txt rejected as dangerous');

    await F.validateFile({ name: 'ok.pdf', size: 10, arrayBuffer: () => Promise.resolve(u8(pdf).buffer) })
      .then(r => ok(r.ok === true && r.contentType === 'application/pdf', 'validateFile() yields contentType for upload'));
    await F.validateFile({ name: 'big.pdf', size: F.MAX_BYTES + 1, arrayBuffer: () => Promise.resolve(u8(pdf).buffer) })
      .then(r => ok(r.ok === false && /25 MB/.test(r.error), 'oversized file rejected'));
  }

  /* ================= contact form hardening ================= */
  {
    console.log('contact.js (cooldown + validation)');
    const src = fs.readFileSync(path.join(ROOT, 'assets/js/contact.js'), 'utf8');
    ok(/LAST_SUBMIT_KEY/.test(src) && /COOLDOWN_MS/.test(src), 'contact form has a client-side submission cooldown');
    ok(/sessionStorage\.setItem\(LAST_SUBMIT_KEY/.test(src), 'cooldown timestamp recorded on success');
    ok(/Please wait a few seconds/.test(src), 'cooldown surfaced to the user');
    ok(/msg\.length > 5000/.test(src) && /name\.length > 100/.test(src) && /email\.length > 200/.test(src),
       'contact form enforces field length limits client-side');
  }

  /* ================= admin: featured_image + file pipeline ================= */
  {
    console.log('admin.js (featured_image gating + document validation)');
    const src = fs.readFileSync(path.join(ROOT, 'assets/js/admin.js'), 'utf8');
    ok(/OMPFileValidate/.test(src) && /validateFile/.test(src), 'admin uses the magic-byte file validator');
    ok(/contentType: v\.contentType/.test(src), 'admin forces the validated Content-Type on upload');
    ok(/Featured image URL must be/.test(src) && /OMPUrl\.safeUrl/.test(src),
       'admin rejects a javascript: featured_image at the point of entry');
    ok(/supabase\/00_schema_migrations\.sql/.test(src), 'admin comment points at the RLS/Storage migration');
    const blogSrc = fs.readFileSync(path.join(ROOT, 'assets/js/articles.js'), 'utf8');
    ok(/target=\"_blank\" rel=\"noopener noreferrer\"/.test(blogSrc), 'public document download opens in a safe context (noopener/noreferrer)');
    ok(/safeUrl\(a\.document_url\)/.test(blogSrc), 'document download URL is scheme-checked before rendering');
  }


  console.log(`\n${checks - failures}/${checks} checks passed, ${failures} failures`);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
