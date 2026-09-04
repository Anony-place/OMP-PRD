/* ============================================================
   OMP hosting router — a faithful local model of the Firebase
   Hosting behavior configured in firebase.json, used by the local
   preview server and by the test harnesses.

   Implemented semantics (per Firebase "Configure Hosting behavior"):
     Priority order of responses:
       1. configured redirects (glob `source` or `regex`)
       2. exact-match static content
            - cleanUrls: /x.html request -> 301 /x ; /x serves x.html
            - trailingSlash:false: /x/ -> 301 /x
       3. configured rewrites (only when NO file matches the path)
       4. custom 404 page (404.html) with 404 status
     Redirect captures: glob ":name*" / regex groups (:1) substitute
     into the destination.

   Usage:
     const resolve = require('./tools/hosting_router.js')(ROOT_DIR);
     const r = resolve('/articles/my-slug');
     // -> { type:'file', file:'/articles.html' } | { type:'redirect', location, status } | { type:'notfound', file:'/404.html' }
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

function globToRegex(glob) {
  // Supports the subset used by this repo's firebase.json:
  //   **  -> any segments (captured when named), * -> one segment,
  //   :name* -> named capture to end, {,/**} -> optional sub-path,
  //   @(a|b|c) -> alternation.
  let re = '';
  let i = 0;
  while (i < glob.length) {
    const c = glob[i];
    if (c === '{' && glob.slice(i, i + 5) === '{,/**') { re += '(?:/.*)?'; i += 6; continue; }
    if (c === '@(') {
      const end = glob.indexOf(')', i);
      re += '(?:' + glob.slice(i + 2, end).replace(/\|/g, '|') + ')';
      i = end + 1; continue;
    }
    if (c === ':') {
      const m = /^:([a-zA-Z0-9_]+)(\*)?/.exec(glob.slice(i));
      if (m) {
        re += m[2] ? '(.*)' : '([^/]+)';
        i += m[0].length; continue;
      }
    }
    if (c === '*') {
      if (glob.slice(i, i + 2) === '**') { re += '.*'; i += 2; continue; }
      re += '[^/]*'; i += 1; continue;
    }
    re += c.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    i += 1;
  }
  return new RegExp('^' + re + '$');
}

function substitute(destination, match) {
  return destination.replace(/:([a-zA-Z0-9_]+|\d+)/g, (all, name) => {
    if (/^\d+$/.test(name)) { const g = match[Number(name)]; return g === undefined ? all : g; }
    /* named groups are not emitted by our subset; regex rules use :N */
    return all;
  });
}

function createRouter(rootDir, configPath) {
  const cfg = JSON.parse(fs.readFileSync(configPath || path.join(rootDir, 'firebase.json'), 'utf8')).hosting;
  const cleanUrls = cfg.cleanUrls !== false;
  const noTrailingSlash = cfg.trailingSlash === false;

  const redirects = (cfg.redirects || []).map(r => ({
    regex: r.regex ? new RegExp('^' + r.regex + '$') : globToRegex(r.source),
    destination: r.destination,
    status: r.type || 301
  }));
  const rewrites = (cfg.rewrites || []).map(r => ({
    regex: r.regex ? new RegExp('^' + r.regex + '$') : globToRegex(r.source),
    destination: r.destination
  }));

  const deployed = (p) => {
    if (cfg.ignore) {
      const rel = p.replace(/^\//, '');
      for (const pat of cfg.ignore) {
        if (globToRegex(pat).test(rel) || globToRegex(pat).test(p)) return false;
      }
    }
    return fs.existsSync(path.join(rootDir, p)) && !fs.statSync(path.join(rootDir, p)).isDirectory();
  };

  function resolve(pathname, depth) {
    if (depth > 10) return { type: 'loop', location: pathname };
    let p = pathname.split('?')[0];

    // 1. Configured redirects (evaluated before any filesystem check)
    for (const r of redirects) {
      const m = p.match(r.regex);
      if (m) return { type: 'redirect', location: substitute(r.destination, m), status: r.status };
    }

    // 2. Exact-match static content (cleanUrls + trailingSlash live here)
    if (noTrailingSlash && p.length > 1 && p.endsWith('/')) {
      return { type: 'redirect', location: p.replace(/\/+$/, '') || '/', status: 301 };
    }
    /* Firebase normalizes /index.html to / with a 301, like any other
       cleanUrls .html redirect. */
    if (cleanUrls && p === '/index.html') {
      return { type: 'redirect', location: '/', status: 301 };
    }
    /* cleanUrls: a request for an uploaded .html file 301s to the
       extensionless URL (evaluated before serving the file). */
    if (cleanUrls && p.endsWith('.html') && deployed(p)) {
      return { type: 'redirect', location: p.slice(0, -5) || '/', status: 301 };
    }
    if (deployed(p)) return { type: 'file', file: p };
    if (p === '/' || p === '') {
      if (deployed('/index.html')) return { type: 'file', file: '/index.html' };
    }
    if (cleanUrls && p.endsWith('.html')) {
      const clean = p.slice(0, -5) || '/';
      if (deployed(clean)) return { type: 'redirect', location: clean, status: 301 };
      // no such file: fall through to rewrites (e.g. /blog.html has an explicit redirect above)
    }
    if (cleanUrls && !p.endsWith('.html') && deployed(p + '.html')) return { type: 'file', file: p + '.html' };
    if (p.length > 1 && deployed(p + '/index.html')) return { type: 'file', file: p + '/index.html' };

    // 3. Rewrites — only when nothing matched on disk
    for (const r of rewrites) {
      const m = p.match(r.regex);
      if (m) {
        const dest = substitute(r.destination, m);
        if (dest.startsWith('/')) {
          if (deployed(dest)) return { type: 'file', file: dest };
          // destination file missing -> continue down the rewrite list
          continue;
        }
        return { type: 'rewrite-external', location: dest };
      }
    }

    // 4. Custom 404
    return { type: 'notfound', file: '/404.html' };
  }

  /* Follow a redirect chain to its end — used by tests to prove there
     are no loops and by the preview server to expose the full hop. */
  function follow(pathname) {
    const hops = [];
    let current = pathname;
    for (let i = 0; i < 10; i++) {
      const r = resolve(current, 0);
      if (r.type !== 'redirect') return { end: r, hops };
      hops.push({ from: current, to: r.location, status: r.status });
      current = r.location;
      if (hops.some(h => h.from === current)) return { end: { type: 'loop', location: current }, hops };
    }
    return { end: { type: 'loop', location: current }, hops };
  }

  return { resolve, follow };
}

module.exports = createRouter;
