/* ============================================================
   Site rule (2026-11-18): every EXTERNAL link opens in a new tab
   (target="_blank" rel="noopener noreferrer"). Internal links —
   relative paths and our own hosts — keep normal same-tab
   navigation. Applied at HTML-write time by the build scripts and
   mirrored at runtime in assets/js/main.js.

   Idempotent: safe to run twice. JSON-LD <script> blocks are left
   untouched so embedded FAQ markup can never break the JSON.
   ============================================================ */

const LD_JSON_SPLIT = /(<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>)/gi;

function isInternalHost(host) {
  return /oopsmypassword|omp-prd/i.test(host);
}

function externalizeAnchor(tag) {
  if (/\btarget\s*=/i.test(tag)) return tag;
  const m = /\bhref\s*=\s*("([^"]*)"|'([^']*)')/i.exec(tag);
  if (!m) return tag;
  const href = m[2] != null ? m[2] : m[3];
  if (!/^(https?:)?\/\//i.test(href)) return tag;
  const host = href.replace(/^(https?:)?\/\//i, '').split(/[/?#]/)[0];
  if (isInternalHost(host)) return tag;
  let out = tag.replace(/>$/, ' target="_blank">');
  const rel = /\brel\s*=\s*"([^"]*)"/i.exec(out);
  if (!rel) {
    out = out.replace(/>$/, ' rel="noopener noreferrer">');
  } else if (!/noopener/i.test(rel[1]) || !/noreferrer/i.test(rel[1])) {
    const merged = Array.from(new Set(rel[1].split(/\s+/).filter(Boolean).concat(['noopener', 'noreferrer']))).join(' ');
    out = out.replace(rel[0], `rel="${merged}"`);
  }
  return out;
}

export function externalizeHtml(html) {
  if (typeof html !== 'string' || !html) return html;
  const parts = html.split(LD_JSON_SPLIT);
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 1) continue; /* ld+json block — never touch */
    parts[i] = parts[i].replace(/<a\b[^>]*>/gi, externalizeAnchor);
  }
  return parts.join('');
}
