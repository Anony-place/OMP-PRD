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

  /* ================= Markdown rendering pipeline (articles) ================= */
  {
    console.log('markdown.js (safe Markdown -> HTML for article bodies)');
    const dom = await loadPage('blog.html', { wait: 200 });
    const w = dom.window;
    await new Promise(r => setTimeout(r, 200));
    ok(typeof w.OMPMarkdown === 'object' && typeof w.OMPMarkdown.toHtml === 'function',
       'blog.html exposes window.OMPMarkdown');
    ok(d_scriptsInOrder(dom.window.document, ['/assets/js/sanitize.js', '/assets/js/markdown.js', '/assets/js/blog.js']),
       'blog.html loads sanitize.js -> markdown.js -> blog.js in that order');
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
    const xss = M.renderSafe('[click](javascript:alert(1)) ![i](javascript:alert(2)) [ok](/guides.html)');
    ok(!/javascript:/i.test(xss), 'javascript: URLs rejected in Markdown links/images');
    ok(!/click\)/.test(xss), 'rejected link leaves no stray ")" behind');
    ok(/<a href="\/guides\.html">ok<\/a>/.test(xss), 'site-relative Markdown links kept');
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

  /* ================= blog.js — feed behavior regressions ================= */
  {
    console.log('blog.js (article feed: no keyword blacklist, #/-only routing)');
    const src = fs.readFileSync(path.join(ROOT, 'assets/js/blog.js'), 'utf8');
    ok(!/deploying process|omp deploying/i.test(src),
       'the hard-coded "omp deploying" keyword blacklist is gone');
    ok(/isRenderable/.test(src) && /a\.slug/.test(src),
       'feed rows are validated structurally (slug + title), not by content keywords');
    ok(/location\.hash[\s\S]{0,80}#\//.test(src) && /slice\(0, 2\)[\s\S]{0,40}#\//.test(src),
       'only "#/slug" hashes are treated as article routes');
    ok(/OMPMarkdown/.test(src) && /renderSafe/.test(src),
       'article bodies render through the Markdown-aware pipeline');
    ok(/encodeURIComponent\(a\.slug\)/.test(src), 'article links URL-encode the slug');
    ok(/excerpt/.test(src), 'articles without a summary get a generated excerpt');
    ok(/featured_image/.test(src) && /safeUrl\(a\.featured_image\)/.test(src),
       'featured_image is rendered (and scheme-checked) instead of fetched-and-ignored');
    ok(/limit\(PAGE_LIMIT\)|\.limit\(/.test(src), 'feed query is bounded by a limit');
    ok(/lastArticles/.test(src), 'hashchange re-renders from cache instead of refetching');
    ok(/demoteHeadings/.test(src), 'blog.js demotes body headings so the page keeps a single <h1>');
    ok(/demoteHeadings/.test(fs.readFileSync(path.join(ROOT, 'assets/js/admin.js'), 'utf8')),
       'admin preview demotes headings too, so it matches the published page');

    const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    ok(!/assets\/js\/blog\.js/.test(idx), 'index.html no longer loads blog.js (homepage has no [data-blog] mount)');
    ok(/assets\/js\/markdown\.js/.test(fs.readFileSync(path.join(ROOT, 'blog.html'), 'utf8')),
       'blog.html loads markdown.js');
  }

  /* ================= search.js — unsafe URLs, cache, mobile button ========= */
  {
    console.log('search.js (poisoned live rows, dedup, mobile button, modal a11y)');
    const dom = await loadPage('index.html', { wait: 300 });
    const w = dom.window, d = w.document;
    await new Promise(r => setTimeout(r, 300));

    /* Seed the live cache with hostile + duplicate rows. fetchLive() trusts
       sessionStorage first, so this exercises the render-time URL gate. */
    w.sessionStorage.setItem('omp-search-live-v2', JSON.stringify({ t: Date.now(), items: [
      { type: 'Tool', title: 'Evil Route', desc: 'should never render', url: 'javascript:alert(1)', kw: 'zzzpoison' },
      { type: 'Tool', title: 'Off Site', desc: 'should never render', url: 'https://evil.example/x', kw: 'zzzpoison' },
      { type: 'Article', title: 'Dup One', desc: '', url: '/blog.html#/dup', kw: 'zzzpoison' },
      { type: 'Article', title: 'Dup One', desc: '', url: '/blog.html#/dup', kw: 'zzzpoison' },
      { type: 'Tool', title: 'Password Generator', desc: '', url: '/generator.html', kw: 'zzzpoison' },
      { type: 'Article', title: 'Good Article', desc: 'a real post', url: '/blog.html#/good-one', kw: 'zzzpoison' }
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
    ok(genLinks.filter(h => h === '/generator.html').length === 1,
       'live tool row for /generator.html does not duplicate the baked-in entry');

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
    const dom = await loadPage('index.html', { wait: 300 });
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
    ok(heroPages.length === 19, '19 inner pages use .page-hero (all covered by the fix) — got ' + heroPages.length);

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
    ok(fs.readFileSync(path.join(ROOT, 'blog.html'), 'utf8').includes('/assets/js/markdown.js'),
       'generated blog.html contains the markdown.js script tag (build output committed)');
    ok(!fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').includes('/assets/js/blog.js'),
       'generated index.html no longer references blog.js (build output committed)');
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
    const blog = fs.readFileSync(path.join(ROOT, 'assets/js/blog.js'), 'utf8');
    const search = fs.readFileSync(path.join(ROOT, 'assets/js/search.js'), 'utf8');
    ok(/OMPUrl\.safeUrl/.test(sanitize) && /OMPUrl\.safeUrl/.test(markdown), 'sanitize.js + markdown.js delegate to OMPUrl');
    ok(/OMPUrl\.safeUrl/.test(blog), 'blog.js safeUrl delegates to OMPUrl');
    ok(/OMPUrl\.safeUrl/.test(search), 'search.js safeResultUrl delegates to OMPUrl');

    /* url.js is loaded before the modules that depend on it. */
    const blogHtml = fs.readFileSync(path.join(ROOT, 'blog.html'), 'utf8');
    const idxUrl = blogHtml.indexOf('/assets/js/url.js');
    const idxSan = blogHtml.indexOf('/assets/js/sanitize.js');
    const idxMk = blogHtml.indexOf('/assets/js/markdown.js');
    const idxBlog = blogHtml.indexOf('/assets/js/blog.js');
    ok(idxUrl !== -1 && idxUrl < idxSan && idxSan < idxMk && idxMk < idxBlog,
       'blog.html loads url.js before sanitize.js/markdown.js/blog.js');
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
    const blogSrc = fs.readFileSync(path.join(ROOT, 'assets/js/blog.js'), 'utf8');
    ok(/target=\"_blank\" rel=\"noopener noreferrer\"/.test(blogSrc), 'public document download opens in a safe context (noopener/noreferrer)');
    ok(/safeUrl\(a\.document_url\)/.test(blogSrc), 'document download URL is scheme-checked before rendering');
  }


  console.log(`\n${checks - failures}/${checks} checks passed, ${failures} failures`);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
