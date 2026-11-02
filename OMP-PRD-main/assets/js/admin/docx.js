/* ============================================================
   .docx -> HTML, in the browser, offline.

   Two decisions in this file are the important part of it.

   1. The converter is vendored, not fetched from a CDN. It runs in the admin
      panel, which is behind a CSP that allows scripts from this origin only.
      A CDN import would mean widening that CSP for one admin-only button.

   2. Its output is NOT trusted. A .docx can carry a hyperlink whose target is
      javascript:alert(1), and mammoth reproduces it as a live href - verified
      in tools/test_docx_import.mjs. The converted HTML goes into the editor as
      text, exactly as if it had been pasted, and travels the same path a typed
      article travels: the same sanitizer, the same allowlist. This module never
      touches the DOM.
   ============================================================ */

const CONVERTER_SRC = '/assets/vendor/mammoth.browser.min.js';

let loading = null;

/* Loaded once, on the first .docx picked. The file is 620 KB and most visits
   never need it, so it must not be part of the panel's initial download. */
export function loadConverter(src = CONVERTER_SRC) {
  if (typeof window !== 'undefined' && window.mammoth?.convertToHtml) return Promise.resolve(window.mammoth);
  if (loading) return loading;

  loading = new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('no document to load the converter into'));
      return;
    }
    const existing = document.querySelector(`script[data-docx-converter]`);
    if (existing && window.mammoth?.convertToHtml) {
      resolve(window.mammoth);
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.dataset.docxConverter = 'true';
    script.onload = () => {
      if (window.mammoth?.convertToHtml) resolve(window.mammoth);
      else reject(new Error('the converter loaded but did not register'));
    };
    script.onerror = () => reject(new Error('could not load the .docx converter'));
    document.head.appendChild(script);
  }).catch((error) => {
    /* A failed load must not poison the next attempt: a flaky connection
       should get a second chance, not a cached rejection. */
    loading = null;
    const stale = document.querySelector('script[data-docx-converter]');
    if (stale) stale.remove();
    throw error;
  });

  return loading;
}

/* Images are inlined by mammoth as base64 data URIs, which turns a 200 KB
   document into a multi-megabyte text field and is refused by the editor's
   import limit anyway. They are removed and counted, so the author is told to
   add them through the media library instead of wondering where they went. */
export function stripImages(html) {
  let removed = 0;
  const out = String(html || '').replace(/<img\b[^>]*>/gi, () => {
    removed += 1;
    return '';
  });
  return { html: out, removed };
}

/* Markdown-ish cleanup for what mammoth emits: paragraphs that contain nothing
   are noise, and a run of them becomes a gap the author has to delete by hand. */
export function tidy(html) {
  return String(html || '')
    .replace(/<p>\s*<\/p>\s*/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * @param {{ arrayBuffer(): Promise<ArrayBuffer>, name?: string }} file
 * @param {{ convertImage?: boolean }} [options]
 * @returns {Promise<{ html: string, text: string, messages: string[], images: number }>}
 */
export async function docxToHtml(file, options = {}) {
  const mammoth = await loadConverter();
  const buffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer: buffer }, {
    /* Word's built-in heading styles map to headings; everything else keeps
       its emphasis and lists and loses its fonts, which is the point. */
    styleMap: [
      "p[style-name='Title'] => h2:fresh",
      "p[style-name='Subtitle'] => p:fresh"
    ]
  });

  const { html, removed } = stripImages(result.value);
  return {
    html: tidy(html),
    text: String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    messages: (result.messages || []).map((message) => String(message.message || message)),
    images: removed
  };
}
