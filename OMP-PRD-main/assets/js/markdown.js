/* ============================================================
   OopsMyPassword — minimal, safe Markdown renderer
   (window.OMPMarkdown)

   Articles authored in the admin panel are usually written in
   Markdown, but the public feed used to render `content` as raw
   HTML — so a Markdown article showed up as one giant wall of
   literal "##", "**" and "|" characters. This module closes that
   gap.

   Safety model: the input is treated as TEXT first and markup
   second. Every character is HTML-escaped before any Markdown
   substitution runs, so raw HTML/JS embedded in a Markdown
   article can never execute. Link and image URLs are scheme
   checked. Callers additionally pipe the result through
   window.OMPSanitize (defence in depth); if that sanitizer is
   missing, renderSafe() fails closed to escaped plain text.

   Supported subset: ATX headings, paragraphs, hard line breaks,
   fenced code, inline code, bold / italic / strikethrough,
   blockquotes, horizontal rules, ordered + unordered lists
   (indent-nested), GFM tables, [text](url) and ![alt](url).
   ============================================================ */
(function () {
  'use strict';

  var CODE_SPAN = '\u0000OMPCODE\u0000';
  var HARD_BREAK = '\u0000OMPBR\u0000';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* Undo esc() for values we need to inspect (URLs), then re-escape
     on output. &amp; must be restored last. */
  function unesc(s) {
    return String(s == null ? '' : s)
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
  }

  /* Only http(s), mailto, site-relative, anchor, parent-relative and
     raster data images survive. javascript:, vbscript:, data:text/html
     … die. Delegate to the canonical validator; escape() on output is
     what keeps a URL from breaking out of an attribute, so attrSafe is
     deliberately off here. */
  function safeUrl(value) {
    var v = String(value == null ? '' : value).trim();
    if (!v) return null;
    /* Strip control characters and HTML-escaped whitespace tricks. */
    v = v.replace(/[\u0000-\u0020]+/g, '');
    if (window.OMPUrl && window.OMPUrl.safeUrl) {
      return window.OMPUrl.safeUrl(v, { attrSafe: false, allowMailto: true, allowDataImage: true });
    }
    if (/^(https?:|mailto:|\/|#|\.\.?\/)/i.test(v)) return v;
    if (/^data:image\/(png|jpe?g|gif|webp|avif);base64,/i.test(v)) return v;
    return null;
  }

  /* ---------- Inline ---------- */
  function inline(escapedText) {
    var text = escapedText;
    var codes = [];

    /* 1. Protect inline code spans from every later rule. */
    text = text.replace(/(`+)[\s\S]*?\1/g, function (match) {
      var body = match.replace(/^`+/, '').replace(/`+$/, '');
      codes.push(body);
      return CODE_SPAN + (codes.length - 1) + CODE_SPAN;
    });

    /* Destination regex allows one level of balanced parentheses so a
       rejected URL such as javascript:alert(1) is consumed whole and
       cannot leak a stray ")" into the rendered text. */
    var DEST = '\\(([^()]*(?:\\([^()]*\\)[^()]*)*)\\)';

    /* 2. Images: ![alt](url "title") */
    text = text.replace(new RegExp('!\\[([^\\]]*)\\]' + DEST, 'g'), function (m, alt, raw) {
      var url = safeUrl(unesc(raw.split(/\s+/)[0]));
      if (!url) return alt; /* keep the alt text, drop the unsafe image */
      return '<img src="' + esc(url) + '" alt="' + alt + '" loading="lazy">';
    });

    /* 3. Links: [label](url "title") */
    text = text.replace(new RegExp('\\[([^\\]]+)\\]' + DEST, 'g'), function (m, label, raw) {
      var url = safeUrl(unesc(raw.split(/\s+/)[0]));
      if (!url) return label; /* keep the label, drop the unsafe href */
      var external = /^https?:/i.test(url);
      return '<a href="' + esc(url) + '"' +
        (external ? ' target="_blank" rel="noopener noreferrer nofollow"' : '') +
        '>' + label + '</a>';
    });

    /* 4. Emphasis — longest markers first so ** never leaks into *. */
    text = text
      .replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>')
      .replace(/__([\s\S]+?)__/g, '<strong>$1</strong>')
      .replace(/(^|[^*\w])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
      .replace(/(^|[^_\w])_([^_\n]+)_(?!_)/g, '$1<em>$2</em>')
      .replace(/~~([\s\S]+?)~~/g, '<del>$1</del>');

    /* 5. Restore code spans and hard breaks. */
    text = text.replace(new RegExp(CODE_SPAN + '(\\d+)' + CODE_SPAN, 'g'), function (m, i) {
      return '<code>' + codes[Number(i)] + '</code>';
    });
    text = text.split(HARD_BREAK).join('<br>');
    return text;
  }

  /* Escape source text, then honour two-trailing-spaces hard breaks. */
  function inlineFromRaw(raw) {
    return inline(esc(raw).replace(/ {2,}\n/g, HARD_BREAK + '\n'));
  }

  /* ---------- Block helpers ---------- */
  var RE_FENCE = /^ {0,3}(`{3,}|~{3,})[ \t]*([\w+#.-]*)[ \t]*$/;
  var RE_HR = /^ {0,3}((\*[ \t]*){3,}|(-[ \t]*){3,}|(_[ \t]*){3,})$/;
  var RE_HEADING = /^ {0,3}(#{1,6})[ \t]+(.*?)[ \t]*#*[ \t]*$/;
  var RE_QUOTE = /^ {0,3}>[ \t]?/;
  var RE_UL = /^(\s*)([-*+])[ \t]+(.*)$/;
  var RE_OL = /^(\s*)(\d{1,9})[.)][ \t]+(.*)$/;

  function isBlank(line) { return /^[ \t]*$/.test(line); }

  function splitRow(line) {
    var s = line.trim().replace(/^\|/, '').replace(/\|$/, '');
    var cells = [];
    var cur = '';
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (ch === '\\' && s[i + 1] === '|') { cur += '|'; i++; continue; }
      if (ch === '|') { cells.push(cur); cur = ''; continue; }
      cur += ch;
    }
    cells.push(cur);
    return cells.map(function (c) { return c.trim(); });
  }

  function isTableDelimiter(line) {
    if (!line || line.indexOf('-') === -1 || line.indexOf('|') === -1) return false;
    var cells = splitRow(line);
    if (!cells.length) return false;
    return cells.every(function (c) { return /^:?-{1,}:?$/.test(c.trim()); });
  }

  function looksLikeTableRow(line) {
    return line.indexOf('|') !== -1 && !isBlank(line) && !isTableDelimiter(line);
  }

  /* True when a line must interrupt the paragraph being collected. */
  function startsBlock(line, nextLine) {
    if (isBlank(line)) return true;
    if (RE_FENCE.test(line) || RE_HR.test(line) || RE_HEADING.test(line) || RE_QUOTE.test(line)) return true;
    if (RE_UL.test(line) || RE_OL.test(line)) return true;
    if (looksLikeTableRow(line) && isTableDelimiter(nextLine || '')) return true;
    return false;
  }

  function renderList(lines, i, ordered) {
    /* Collect every sibling item plus its indented continuation lines,
       then recurse so nested lists and paragraphs inside items work. */
    var re = ordered ? RE_OL : RE_UL;
    var base = (lines[i].match(re) || [, ''])[1].length;
    var items = [];
    var current = null;

    while (i < lines.length) {
      var line = lines[i];
      if (isBlank(line)) {
        /* A blank line only ends the list if the next line is not
           an item and not an indented continuation. */
        var ahead = lines[i + 1];
        if (ahead === undefined || (!re.test(ahead) && /^\s*$/.test(ahead))) { i++; break; }
        if (!re.test(ahead) && ahead.replace(/^ +/, '').length === ahead.length) { i++; break; }
        if (current) current.push('');
        i++;
        continue;
      }
      var m = line.match(re);
      var indent = m ? m[1].length : -1;
      if (m && indent <= base) {
        current = [m[3]];
        items.push(current);
        base = indent;
        i++;
        continue;
      }
      if (current && indent > base) { current.push(line.slice(base + 2)); i++; continue; }
      /* Lazy continuation of the current item's paragraph. */
      if (current && !startsBlock(line, lines[i + 1])) { current.push(line.trim()); i++; continue; }
      break;
    }

    var tag = ordered ? 'ol' : 'ul';
    var html = '<' + tag + '>' + items.map(function (item) {
      var body = toHtml(item.join('\n'));
      /* A single loose paragraph should not add <p> spacing. */
      var single = body.match(/^<p>([\s\S]*)<\/p>$/);
      if (single && body.indexOf('<p>') === body.lastIndexOf('<p>')) body = single[1];
      return '<li>' + body + '</li>';
    }).join('') + '</' + tag + '>';
    return { html: html, next: i };
  }

  /* ---------- Block parser ---------- */
  function toHtml(src) {
    var text = String(src == null ? '' : src).replace(/\r\n?/g, '\n').replace(/\t/g, '    ');
    var lines = text.split('\n');
    var out = [];
    var i = 0;

    while (i < lines.length) {
      var line = lines[i];
      if (isBlank(line)) { i++; continue; }

      /* Fenced code block */
      var fence = line.match(RE_FENCE);
      if (fence) {
        var marker = fence[1][0];
        var len = fence[1].length;
        var closeRe = new RegExp('^ {0,3}' + (marker === '`' ? '`' : '~') + '{' + len + ',}[ \\t]*$');
        var buf = [];
        i++;
        while (i < lines.length && !closeRe.test(lines[i])) { buf.push(lines[i]); i++; }
        i++; /* consume the closing fence (or EOF) */
        out.push('<pre><code>' + esc(buf.join('\n')) + '</code></pre>');
        continue;
      }

      /* Horizontal rule (before lists: "---" is a rule, "- x" is an item) */
      if (RE_HR.test(line)) { out.push('<hr>'); i++; continue; }

      /* ATX heading */
      var h = line.match(RE_HEADING);
      if (h) {
        var level = h[1].length;
        out.push('<h' + level + '>' + inlineFromRaw(h[2]) + '</h' + level + '>');
        i++;
        continue;
      }

      /* Blockquote — recurse on the stripped content */
      if (RE_QUOTE.test(line)) {
        var quote = [];
        while (i < lines.length && (RE_QUOTE.test(lines[i]) || (!isBlank(lines[i]) && quote.length && !startsBlock(lines[i], lines[i + 1])))) {
          quote.push(lines[i].replace(RE_QUOTE, ''));
          i++;
        }
        out.push('<blockquote>' + toHtml(quote.join('\n')) + '</blockquote>');
        continue;
      }

      /* GFM table */
      if (looksLikeTableRow(line) && isTableDelimiter(lines[i + 1])) {
        var head = splitRow(line);
        i += 2;
        var rows = [];
        while (i < lines.length && looksLikeTableRow(lines[i])) { rows.push(splitRow(lines[i])); i++; }
        var t = '<table><thead><tr>' + head.map(function (c) {
          return '<th>' + inlineFromRaw(c) + '</th>';
        }).join('') + '</tr></thead>';
        if (rows.length) {
          t += '<tbody>' + rows.map(function (r) {
            return '<tr>' + head.map(function (_, ci) {
              return '<td>' + inlineFromRaw(r[ci] == null ? '' : r[ci]) + '</td>';
            }).join('') + '</tr>';
          }).join('') + '</tbody>';
        }
        out.push(t + '</table>');
        continue;
      }

      /* Lists */
      if (RE_UL.test(line) && !RE_HR.test(line)) {
        var ul = renderList(lines, i, false);
        out.push(ul.html); i = ul.next; continue;
      }
      if (RE_OL.test(line)) {
        var ol = renderList(lines, i, true);
        out.push(ol.html); i = ol.next; continue;
      }

      /* Paragraph — strip leading indentation only, so the two trailing
         spaces that mark a hard line break survive to inlineFromRaw(). */
      var para = [];
      while (i < lines.length && !startsBlock(lines[i], lines[i + 1])) { para.push(lines[i].replace(/^ +/, '')); i++; }
      if (!para.length) { para.push(lines[i].replace(/^ +/, '')); i++; }
      out.push('<p>' + inlineFromRaw(para.join('\n')) + '</p>');
    }

    return out.join('\n');
  }

  /* ---------- Format detection ---------- */
  /* Block-level tags only: Markdown never produces these, so their
     presence means the author wrote HTML and we must not re-parse. */
  var RE_HTML_BLOCK = /<\/?[ \t]*(p|div|h[1-6]|ul|ol|li|table|thead|tbody|tr|td|th|blockquote|pre|hr|img|figure|figcaption|section|article|aside|header|footer|nav|main|details|summary|dl|dt|dd)([ \t>\/]|$)/i;

  function looksLikeHtml(src) {
    var s = String(src == null ? '' : src);
    /* Ignore anything inside fenced code — a Markdown post about HTML
       is still Markdown. */
    var stripped = s.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
    return RE_HTML_BLOCK.test(stripped);
  }

  function plainText(src) {
    var html = looksLikeHtml(src) ? String(src == null ? '' : src) : toHtml(src);
    try {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
    } catch (e) {
      return String(src == null ? '' : src).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }
  }

  /* Markdown (or HTML) in → safe HTML out. Fails closed: without the
     whitelist sanitizer we return escaped text, never raw markup. */
  function renderSafe(src) {
    var html = looksLikeHtml(src) ? String(src == null ? '' : src) : toHtml(src);
    if (window.OMPSanitize) return window.OMPSanitize(html);
    return esc(plainText(src));
  }

  /* An article page already renders its title as the only <h1>, so a "#"
     heading inside the body would add a second one. Shift body headings down
     one level in place — the author's relative hierarchy is preserved.
     Shared by /blog.html and the admin preview so both stay identical. */
  function demoteHeadings(container, from) {
    if (!container || !container.querySelectorAll) return container;
    var level = from || 1;
    var nodes = container.querySelectorAll('h' + level);
    for (var i = 0; i < nodes.length; i++) {
      var target = document.createElement('h' + Math.min(level + 1, 6));
      while (nodes[i].firstChild) target.appendChild(nodes[i].firstChild);
      nodes[i].parentNode.replaceChild(target, nodes[i]);
    }
    return container;
  }

  window.OMPMarkdown = {
    toHtml: toHtml,
    looksLikeHtml: looksLikeHtml,
    renderSafe: renderSafe,
    plainText: plainText,
    safeUrl: safeUrl,
    demoteHeadings: demoteHeadings
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.OMPMarkdown;
  }
})();
