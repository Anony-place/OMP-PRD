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
    th: 1, thead: 1, tr: 1, u: 1, ul: 1, video: 1, audio: 1, source: 1,
    track: 1,
    /* Present in functions/safe-article-html.cjs before this list was - the
       preview unwrapped them and the page kept them, which is the mirror image
       of the bug in the other direction. */
    section: 1, article: 1, tfoot: 1, colgroup: 1, col: 1
  };

  /* Dropped together with ALL of their content. NOTE: iframe stays here —
     even a YouTube embed can be re-skinned by an attacker (clickjacking,
     tracking). walk() converts recognized video embeds into a safe
     thumbnail link instead, so the content intent survives without the
     live frame. */
  var DROP_CONTENT = {
    script: 1, style: 1, iframe: 1, frame: 1, frameset: 1, object: 1,
    embed: 1, applet: 1, noscript: 1, template: 1, title: 1, svg: 1,
    math: 1, form: 1, input: 1, button: 1, select: 1, textarea: 1,
    option: 1, link: 1, meta: 1, base: 1
  };

  /* What the last sanitize() call removed, for author-facing notices
     ("2 iframes converted to links, 1 script dropped"). Reset on every
     call; read via OMPSanitize.stats(). Never leaks between pages — it is
     a plain module variable, not storage. */
  var lastStats = { dropped: {}, converted: {} };
  function note(kind, tag) {
    var bucket = lastStats[kind];
    bucket[tag] = (bucket[tag] || 0) + 1;
  }

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

  /* Author-controlled ids enable in-article anchors ("On this page" links).
     Strict charset so an id can never break out of an attribute or carry
     script — class/style stay stripped. */
  var ID_RE = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;

  function cleanAttrs(src, dst) {
    var i, attr, name;
    for (i = 0; i < src.attributes.length; i++) {
      attr = src.attributes[i];
      name = attr.name.toLowerCase();
      if (/^on/i.test(name)) continue;                       /* inline handlers */
      if (name === 'style' || name === 'class') continue;
      if (name === 'id') {
        if (ID_RE.test(attr.value)) dst.setAttribute('id', attr.value);
        continue;
      }

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

      /* Native media: src is scheme-checked like images (http(s) or
         site-relative — never javascript:/data:); boolean playback
         attributes are allowlisted explicitly. */
      if ((src.tagName === 'VIDEO' || src.tagName === 'AUDIO') && name === 'src') {
        var mediaSrc = safeUrl(attr.value);
        if (mediaSrc === null) continue;
        dst.setAttribute('src', mediaSrc);
        dst.setAttribute('controls', '');
        dst.setAttribute('preload', 'metadata');
        continue;
      }
      if ((src.tagName === 'VIDEO' || src.tagName === 'AUDIO') &&
          (name === 'controls' || name === 'loop' || name === 'muted')) {
        dst.setAttribute(name, '');
        continue;
      }
      if (src.tagName === 'VIDEO' && name === 'poster') {
        var poster = safeUrl(attr.value);
        if (poster === null) continue;
        dst.setAttribute('poster', poster);
        continue;
      }
      if ((src.tagName === 'SOURCE' || src.tagName === 'TRACK') && name === 'src') {
        var trackSrc = safeUrl(attr.value);
        if (trackSrc === null) continue;
        dst.setAttribute('src', trackSrc);
        continue;
      }
      if ((src.tagName === 'SOURCE' || src.tagName === 'TRACK') && name === 'type') {
        if (/^[a-z]+\/[a-z0-9.+-]+$/i.test(attr.value)) dst.setAttribute('type', attr.value.toLowerCase());
        continue;
      }
      if (src.tagName === 'TRACK' && (name === 'kind' || name === 'srclang' || name === 'label')) {
        if (/^[a-z-]+$/i.test(attr.value)) dst.setAttribute(name, attr.value.toLowerCase());
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

  /* Recognized video embeds become a safe thumbnail link: the reader
     still gets the video, but no third-party frame (and its tracking +
     clickjacking surface) ever loads on our page. Anything else framed
     is dropped with its content, as before. */
  function embedLink(node) {
    var src = String(node.getAttribute('src') || '');
    var yt = src.match(/(?:youtube\.com\/embed\/|youtu\.be\/|youtube\.com\/watch\?v=)([A-Za-z0-9_-]{6,20})/);
    if (yt) {
      var a = document.createElement('a');
      a.setAttribute('href', 'https://www.youtube.com/watch?v=' + yt[1]);
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer nofollow');
      var thumb = document.createElement('img');
      thumb.setAttribute('src', 'https://i.ytimg.com/vi/' + yt[1] + '/hqdefault.jpg');
      thumb.setAttribute('alt', 'Watch on YouTube');
      thumb.setAttribute('loading', 'lazy');
      a.appendChild(thumb);
      var cap = document.createElement('span');
      cap.textContent = ' ▶ Watch on YouTube';
      a.appendChild(cap);
      return a;
    }
    var vimeo = src.match(/vimeo\.com\/(?:video\/)?(\d{5,12})/);
    if (vimeo) {
      var v = document.createElement('a');
      v.setAttribute('href', 'https://vimeo.com/' + vimeo[1]);
      v.setAttribute('target', '_blank');
      v.setAttribute('rel', 'noopener noreferrer nofollow');
      v.textContent = '▶ Watch on Vimeo';
      return v;
    }
    return null;
  }

  /* ---------------------------------------------------------------- svg --
     Inline diagrams. Built in the SVG namespace, because createElement('svg')
     produces an element that renders as nothing at all - which is how a pasted
     diagram disappears without an error.

     Only drawing primitives are copied. Anything else - script, style,
     foreignObject, use with an external reference, SMIL animation - is dropped
     together with its children, so a diagram can carry a drawing and nothing
     that executes. Attribute names keep their case: viewBox lowercased is a
     0x0 canvas. */
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var SVG_SHAPES = {
    svg: 1, g: 1, path: 1, rect: 1, circle: 1, ellipse: 1, line: 1,
    polyline: 1, polygon: 1, text: 1, tspan: 1, defs: 1, lineargradient: 1,
    radialgradient: 1, stop: 1, marker: 1, title: 1, desc: 1
  };
  var SVG_ATTR = /^(viewBox|preserveAspectRatio|xmlns|role|aria-label|aria-hidden|class|id|d|fill|fill-opacity|fill-rule|stroke|stroke-width|stroke-linecap|stroke-linejoin|stroke-dasharray|stroke-dashoffset|stroke-opacity|opacity|transform|x|y|x1|y1|x2|y2|cx|cy|r|rx|ry|width|height|points|offset|stop-color|stop-opacity|font-size|font-family|font-weight|text-anchor|dominant-baseline|dx|dy|gradientUnits|gradientTransform|markerWidth|markerHeight|refX|refY|orient|markerUnits)$/;

  function buildSvg(node) {
    function copy(src) {
      var tag = String(src.tagName || '').toLowerCase();
      if (!SVG_SHAPES[tag]) return null;          /* dropped with its children */
      var el = document.createElementNS(SVG_NS, tag);
      var names = src.getAttributeNames ? src.getAttributeNames() : [];
      for (var i = 0; i < names.length; i++) {
        var name = names[i];
        if (!SVG_ATTR.test(name)) continue;       /* href, style, on* and friends */
        var value = src.getAttribute(name);
        if (value == null || /^\s*(javascript|data):/i.test(value)) continue;
        el.setAttribute(name, value);
      }
      for (var j = 0; j < src.childNodes.length; j++) {
        var child = src.childNodes[j];
        if (child.nodeType === 3) { el.appendChild(document.createTextNode(child.nodeValue)); continue; }
        if (child.nodeType !== 1) continue;
        var built = copy(child);
        if (built) el.appendChild(built);
      }
      return el;
    }
    var out = copy(node);
    if (out) note('converted', 'svg'); else note('dropped', 'svg');
    return out;
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
      if (tag === 'iframe') {
        var replacement = embedLink(node);
        if (replacement) {
          note('converted', 'iframe→link');
          dstParent.appendChild(replacement);
        } else {
          note('dropped', 'iframe');
        }
        continue;
      }
      if (tag === 'svg') {
        var drawing = buildSvg(node);
        if (drawing) dstParent.appendChild(drawing);
        continue;
      }
      if (DROP_CONTENT[tag]) { note('dropped', tag); continue; }
      if (!ALLOWED_TAGS[tag]) { walk(node, dstParent); continue; } /* unwrap */
      var dst = document.createElement(tag);
      cleanAttrs(node, dst);
      if (tag === 'table') dst.setAttribute('tabindex', '0');
      /* An <img> (or <video>/<audio>/<source>) whose src was rejected
         (javascript:, data:text/html, missing) must not survive as an
         empty broken element. */
      if ((tag === 'img' || tag === 'video' || tag === 'audio' || tag === 'source') && !dst.getAttribute('src')) continue;
      walk(node, dst);
      dstParent.appendChild(dst);
    }
  }

  function sanitize(html) {
    var input = String(html == null ? '' : html);
    lastStats = { dropped: {}, converted: {} };
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
  /* Author-facing report for the admin live previews: what was stripped
     or converted on the last call, e.g. { dropped: {script: 1},
     converted: {"iframe→link": 2} }. Public renderers ignore it. */
  window.OMPSanitize.stats = function () {
    return { dropped: Object.assign({}, lastStats.dropped), converted: Object.assign({}, lastStats.converted) };
  };
})();