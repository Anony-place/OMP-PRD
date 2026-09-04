/* ============================================================
   OopsMyPassword — canonical URL safety validator (window.OMPUrl).

   Single home for the scheme / control-character checks that the
   site's several URL-handling helpers used to re-implement with
   subtly different rules:
     assets/js/search.js   -> safeResultUrl()
     assets/js/blog.js     -> safeUrl()
     assets/js/markdown.js -> safeUrl()
     assets/js/sanitize.js -> safeUrl()
   Each caller still chooses its own *policy* (whether to allow
   mailto:, data:image, same-origin-only, relative ../ …) by passing
   the relevant option, but the security-critical allowlist logic
   lives in exactly one place so it can be reviewed and tested once.

   contract: safeUrl(value, opts) → string URL on success, null when
   the value is not safe to use as a URL. Callers that previously
   returned "" for "unsafe" map null → "" themselves.

   schemes allowed (default): http(s):, / (site-relative), # (anchor),
   and ../ (parent-relative).  --optionally---
     allowMailto    -> also allow mailto:
     allowDataImage -> also allow raster data:image base64
     noUpLevel      -> reject ../ (for hrefs that must stay on-site)
     noProtocolRelative -> reject //host (never let // become http://)
     sameOriginOnly -> for http(s):, admit only this site's own origin
                       and rewrite to a path (search palette rows)
     attrSafe       -> reject strings containing " ' < > backslash so a
                       URL can never break out of an HTML attribute
   ============================================================ */
(function (root) {
  'use strict';

  /* Strip ASCII control chars and embedded whitespace so tricks like
     "https://site\njavascript:alert(1)" cannot smuggle a scheme in. */
  function tidy(value) {
    return String(value == null ? '' : value).replace(/[\u0000-\u0020]+/g, '');
  }

  function safeUrl(value, opts) {
    opts = opts || {};
    var v = String(value == null ? '' : value).trim();
    if (!v) return null;
    /* Attribute-context guard: never let a URL carry a quote or an
       angle bracket that could break out of an href/src attribute. */
    if (opts.attrSafe !== false && /["'<>\\]/.test(v)) return null;
    v = tidy(v);
    if (!v) return null;

    if (opts.allowDataImage && /^data:image\/(png|jpe?g|gif|webp|avif);base64,/i.test(v)) {
      return v;
    }
    if (opts.noProtocolRelative && /^\/\//.test(v)) return null;
    if (opts.noUpLevel && /^\.\.\//.test(v)) return null;

    var schemeOk = /^https?:/i.test(v) ||
      (opts.allowMailto && /^mailto:/i.test(v)) ||
      /^(\/|#)/.test(v) ||
      (opts.noUpLevel !== true && /^\.\.?\//.test(v));

    if (!schemeOk) return null;

    if (opts.sameOriginOnly && /^https?:/i.test(v)) {
      try {
        var u = new root.URL(v);
        if (u.origin !== root.location.origin) return null;
        return u.pathname + u.search + u.hash;
      } catch (e) {
        return null;
      }
    }
    return v;
  }

  root.OMPUrl = { safeUrl: safeUrl, tidy: tidy };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.OMPUrl;
  }
})(typeof window !== 'undefined' ? window : globalThis);
