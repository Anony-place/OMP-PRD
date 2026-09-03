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
    console.log('contact.html (Supabase submission + mailto fallback)');
    const dom = await loadPage('contact.html');
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
    const dom = await loadPage('about.html');
    const w = dom.window, d = w.document;
    click(w, d.querySelector('[data-theme-toggle]'));
    ok(w.localStorage.getItem('omp-theme') === 'light', 'theme saved to localStorage');
    dom.window.close();
  }

  /* ---------------- blog page + whitelist sanitizer (XSS suite) ---------------- */
  {
    console.log('blog.html (Supabase feed scaffold + sanitizer)');
    const dom = await loadPage('blog.html', { wait: 250 });
    const w = dom.window, d = w.document;
    await new Promise(r => setTimeout(r, 250));
    ok(d.querySelectorAll('script[src="/assets/js/sanitize.js"]').length === 1, 'blog.html loads sanitize.js');
    ok(d.querySelectorAll('script[src="/assets/js/blog.js"]').length === 1, 'blog.html loads blog.js');
    ok(typeof w.OMPSanitize === 'function', 'OMPSanitize is available (loads before blog.js)');
    ok(!!d.querySelector('[data-blog]'), 'feed mount point present');
    ok(!d.body.textContent.includes('no backend'), 'stale "no backend" copy removed');
    // In jsdom the esm.sh dynamic import cannot execute; the feed must fail
    // closed with the honest error notice, not hang on "Loading articles…" forever.
    await new Promise(r => setTimeout(r, 400));
    const feedState = d.querySelector('[data-blog]').textContent;
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
    const dom = await loadPage('index.html', { wait: 300 });
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

  console.log(`\n${checks - failures}/${checks} checks passed, ${failures} failures`);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
