/* ============================================================
   OopsMyPassword — whitelist HTML sanitizer (window.OMPSanitize).
   Runs BEFORE any CMS-provided article HTML is displayed.

   - Only whitelisted tags survive; unknown tags are unwrapped
     (their text/children are kept); dangerous containers
     (script/style/iframe/object/embed/svg/math/form…) are
     dropped together with their content.
   - All on* handlers, style/class/id attributes are stripped.
   - URLs are scheme-checked: http(s), mailto, relative, #anchors
     (plus data:image/* for <img>). javascript:/data: others die.
   - External links get target="_blank" + rel noopener/noreferrer.
   - The sanitized tree is rebuilt with createElement/createTextNode,
     so text can never break out of an attribute or tag context.
   ============================================================ */
(function () {
  'use strict';

  var ALLOWED_TAGS = {
    a: 1, abbr: 1, b: 1, blockquote: 1, br: 1, caption: 1, cite: 1,
    code: 1, dd: 1, del: 1, details: 1, dfn: 1, div: 1, dl: 1, dt: 1,
    em: 1, figcaption: 1, figure: 1, h1: 1, h2: 1, h3: 1, h4: 1, h5: 1,
    h6: 1, hr: 1, i: 1, img: 1, ins: 1, kbd: 1, li: 1, mark: 1, ol: 1,
    p: 1, pre: 1, q: 1, s: 1, samp: 1, small: 1, span: 1, strike: 1,
    strong: 1, sub: 1, summary: 1, sup: 1, table: 1, tbody: 1, td: 1,
    th: 1, thead: 1, tr: 1, u: 1, ul: 1
  };

  /* Dropped together with ALL of their content. */
  var DROP_CONTENT = {
    script: 1, style: 1, iframe: 1, frame: 1, frameset: 1, object: 1,
    embed: 1, applet: 1, noscript: 1, template: 1, title: 1, svg: 1,
    math: 1, form: 1, input: 1, button: 1, select: 1, textarea: 1,
    option: 1, link: 1, meta: 1, base: 1, audio: 1, video: 1, source: 1
  };

  function safeUrl(value) {
    var v = String(value || '').trim();
    if (!v) return null;
    /* Delegate to the canonical validator (window.OMPUrl) so the
       scheme allowlist lives in one place. attrSafe guards attribute
       break-out; mailto and parent-relative paths remain allowed. */
    if (window.OMPUrl && window.OMPUrl.safeUrl) {
      return window.OMPUrl.safeUrl(v, { attrSafe: true, allowMailto: true });
    }
    /* Fallback (OMPUrl not yet loaded) — reproduce the same allowlist. */
    if (/^(https?:|mailto:|\/|#|\.\.?\/)/i.test(v)) return v;
    return null;
  }

  function cleanAttrs(src, dst) {
    var i, attr, name;
    for (i = 0; i < src.attributes.length; i++) {
      attr = src.attributes[i];
      name = attr.name.toLowerCase();
      if (/^on/i.test(name)) continue;                       /* inline handlers */
      if (name === 'style' || name === 'class' || name === 'id') continue;

      if (src.tagName === 'A' && name === 'href') {
        var href = safeUrl(attr.value);
        if (href === null) continue;
        dst.setAttribute('href', href);
        if (/^https?:/i.test(href)) {
          dst.setAttribute('target', '_blank');
          dst.setAttribute('rel', 'noopener noreferrer nofollow');
        }
        continue;
      }

      if (src.tagName === 'IMG') {
        if (name === 'src') {
          var imgSrc = /^data:image\//i.test(attr.value) ? attr.value : safeUrl(attr.value);
          if (imgSrc === null) continue;
          dst.setAttribute('src', imgSrc);
          dst.setAttribute('alt', String(src.getAttribute('alt') || ''));
          dst.setAttribute('loading', 'lazy');
          continue;
        }
        if (name === 'width' || name === 'height') {
          var px = parseInt(attr.value, 10);
          if (px > 0 && px < 10000) dst.setAttribute(name, String(px));
          continue;
        }
        continue;
      }

      if ((src.tagName === 'TD' || src.tagName === 'TH') &&
          (name === 'colspan' || name === 'rowspan')) {
        var span = parseInt(attr.value, 10);
        if (span > 0 && span < 1000) dst.setAttribute(name, String(span));
        continue;
      }

      if (name === 'title' || name === 'start' || name === 'datetime' ||
          name === 'lang' || name === 'dir') {
        dst.setAttribute(name, attr.value);
        continue;
      }
      /* everything else is dropped */
    }
  }

  function walk(src, dstParent) {
    for (var i = 0; i < src.childNodes.length; i++) {
      var node = src.childNodes[i];
      if (node.nodeType === 3) {                    /* text */
        dstParent.appendChild(document.createTextNode(node.nodeValue));
        continue;
      }
      if (node.nodeType !== 1) continue;            /* comments, PIs, etc. */
      var tag = node.tagName.toLowerCase();
      if (DROP_CONTENT[tag]) continue;              /* drop with content */
      if (!ALLOWED_TAGS[tag]) { walk(node, dstParent); continue; } /* unwrap */
      var dst = document.createElement(tag);
      cleanAttrs(node, dst);
      /* An <img> whose src was rejected (javascript:, data:text/html,
         missing) must not survive as an empty broken-image element. */
      if (tag === 'img' && !dst.getAttribute('src')) continue;
      walk(node, dst);
      dstParent.appendChild(dst);
    }
  }

  function sanitize(html) {
    var input = String(html == null ? '' : html);
    var srcHolder = document.createElement('template');
    if (!('content' in srcHolder)) {
      /* Ancient browser without <template>: fail closed → plain text only. */
      var plain = document.createElement('div');
      plain.textContent = input;
      return plain.innerHTML;
    }
    /* <template> content is inert: nothing renders, loads or executes here. */
    srcHolder.innerHTML = input;
    var outHolder = document.createElement('div');
    walk(srcHolder.content, outHolder);
    return outHolder.innerHTML;
  }

  window.OMPSanitize = sanitize;
})();