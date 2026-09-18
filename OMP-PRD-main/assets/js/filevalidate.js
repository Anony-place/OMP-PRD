/* ============================================================
   OopsMyPassword — client-side upload validation (window.OMPFileValidate).

   The admin article form lets an editor attach a document. The
   trust boundary here is deliberately tight: the browser can only
   *preflight* a file, so the real control lives in the Supabase
   Storage bucket policies (see supabase/00_schema_migrations.sql).
   But a client-side check still stops the most common mistakes and
   the obvious spoofed-extension / HTML-as-PDF cases before they
   ever leave the device, and it forces the exact Content-Type the
   object should be served with so the browser never sniffs an
   uploaded HTML file as a document page.

   Allowed types: PDF, DOC (OLE2), DOCX (OOXML zip), Markdown, plain
   text. Anything that is binary-but-not-one-of-these (a shell
   script, an executable, an SVG/HTML) is rejected regardless of how
   the file is named.

   Structure: signature sniffing is pure and synchronous on a
   Uint8Array, so it is unit-testable in Node without a real File.
   validateFile(file) is the async entry point used by admin.js.
   ============================================================ */
(function (root) {
  'use strict';

  var MAX_BYTES = 25 * 1024 * 1024; // 25 MB — mirrors the form's stated limit

  var ALLOWED_EXT = { pdf: 1, doc: 1, docx: 1, md: 1, txt: 1 };
  var IMAGE_EXT = { png: 1, jpg: 1, jpeg: 1, webp: 1, gif: 1 };
  var IMAGE_MAX_BYTES = 5 * 1024 * 1024;

  var CONTENT_TYPE = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    md: 'text/markdown',
    txt: 'text/plain',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif'
  };

  function ext(name) {
    var n = String(name || '').split('.');
    return n.length > 1 ? (n.pop() || '').toLowerCase() : '';
  }

  /* Signatures we can prove; anything else is "binary" or "text". */
  function sniff(u8) {
    if (!u8 || u8.length < 4) return 'text'; // too short to be a real binary doc
    // %PDF-
    if (u8[0] === 0x25 && u8[1] === 0x50 && u8[2] === 0x44 && u8[3] === 0x46 && u8[4] === 0x2D) return 'pdf';
    // PK\x03\x04 (ZIP container — .docx / .pptx / .xlsx / .zip)
    if (u8[0] === 0x50 && u8[1] === 0x4B && u8[2] === 0x03 && u8[3] === 0x04) return 'zip';
    // OLE2 compound doc (legacy .doc / .xls / .ppt)
    if (u8[0] === 0xD0 && u8[1] === 0xCF && u8[2] === 0x11 && u8[3] === 0xE0 &&
        u8[4] === 0xA1 && u8[5] === 0xB1 && u8[6] === 0x1A && u8[7] === 0xE1) return 'doc';
    // Anything with a NUL in the first KB is binary we cannot classify.
    var nul = false;
    for (var i = 0; i < Math.min(u8.length, 1024); i++) if (u8[i] === 0) { nul = true; break; }
    if (!nul) return 'text';
    return 'binary';
  }

  /* True if the content is text but would be dangerous to serve as-is
     (e.g. an HTML/SVG document meant to execute). We still permit text
     that merely looks like a document (markdown often contains <p>),
     so the check targets executable structure only. */
  function looksDangerous(u8) {
    if (!u8) return false;
    var head = '';
    for (var i = 0; i < Math.min(u8.length, 512); i++) head += String.fromCharCode(u8[i]);
    head = head.trim().toLowerCase();
    // Scripts / SVG / XML-to-HTML / shell / PE / ELF / Mach-O launch nothing here.
    if (/^<script/ .test(head)) return true;
    if (/^<!doctype html/ .test(head)) return true;
    if (head.indexOf('<svg') !== -1 && head.indexOf('</svg') !== -1 && /<script/i.test(head)) return true;
    if (head.indexOf('\x00') === 0) return true;
    return false;
  }

  /* Pure, sync — unit-testable. Returns { ok, error, ext, contentType, signature }. */
  function describeBytes(u8, name) {
    var e = ext(name);
    var sig = sniff(u8);
    var type = e && ALLOWED_EXT[e] ? e : null;

    if (!type) {
      return { ok: false, error: 'Unsupported type. Please attach a PDF, DOC, DOCX, MD or TXT file.', ext: e, contentType: null, signature: sig };
    }

    if (e === 'pdf' && sig !== 'pdf') {
      return { ok: false, error: 'This file is named .pdf but is not a real PDF.', ext: e, contentType: null, signature: sig };
    }
    if (e === 'doc' && sig !== 'doc') {
      return { ok: false, error: 'This file is named .doc but is not a legacy Word document.', ext: e, contentType: null, signature: sig };
    }
    if (e === 'docx' && sig !== 'zip') {
      return { ok: false, error: 'This file is named .docx but is not a valid Word (ZIP) document.', ext: e, contentType: null, signature: sig };
    }
    if ((e === 'md' || e === 'txt') && sig !== 'text') {
      return { ok: false, error: 'This file is named .' + e + ' but is not plain text.', ext: e, contentType: null, signature: sig };
    }
    if (looksDangerous(u8)) {
      return { ok: false, error: 'This file looks like an executable or embedded script — not an allowed document.', ext: e, contentType: null, signature: sig };
    }

    return { ok: true, error: null, ext: e, contentType: CONTENT_TYPE[e], signature: sig };
  }

  /* Raster covers for /products. Magic-byte first so a renamed HTML
     file can never be stored as image/png (X-Content-Type-Options:
     nosniff on a wrong type is why uploaded covers were invisible). */
  function sniffImage(u8) {
    if (!u8 || u8.length < 12) return null;
    if (u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4E && u8[3] === 0x47) return 'png';
    if (u8[0] === 0xFF && u8[1] === 0xD8 && u8[2] === 0xFF) return 'jpeg';
    if (u8[0] === 0x47 && u8[1] === 0x49 && u8[2] === 0x46) return 'gif';
    if (u8[0] === 0x52 && u8[1] === 0x49 && u8[2] === 0x46 && u8[3] === 0x46 &&
        u8[8] === 0x57 && u8[9] === 0x45 && u8[10] === 0x42 && u8[11] === 0x50) return 'webp';
    return null;
  }

  function describeImageBytes(u8, name) {
    var e = ext(name);
    var sig = sniffImage(u8);
    if (!IMAGE_EXT[e]) {
      return { ok: false, error: 'Cover must be a PNG, JPG, WebP or GIF image.', ext: e, contentType: null, signature: sig };
    }
    if (!sig) {
      return { ok: false, error: 'This file is not a real PNG, JPG, WebP or GIF image.', ext: e, contentType: null, signature: sig };
    }
    if ((e === 'png' && sig !== 'png') ||
        ((e === 'jpg' || e === 'jpeg') && sig !== 'jpeg') ||
        (e === 'gif' && sig !== 'gif') ||
        (e === 'webp' && sig !== 'webp')) {
      return { ok: false, error: 'This file’s contents do not match its .' + e + ' extension.', ext: e, contentType: null, signature: sig };
    }
    return { ok: true, error: null, ext: e, contentType: CONTENT_TYPE[e], signature: sig };
  }

  function validateImage(file) {
    return Promise.resolve().then(function () {
      if (!file) return { ok: false, error: 'No file selected.' };
      if (file.size > IMAGE_MAX_BYTES) {
        return { ok: false, error: 'Cover image is larger than the 5 MB limit.' };
      }
      if (!('arrayBuffer' in file)) return { ok: false, error: 'Browser could not read this file.' };
      return file.arrayBuffer().then(function (buf) {
        return describeImageBytes(new Uint8Array(buf), file.name);
      });
    });
  }

  /* Async entry point used by the admin pipeline. file is anything with
     .name, .size and .arrayBuffer() (a File/Blob, or a test mock). */
  function validateFile(file) {
    return Promise.resolve().then(function () {
      if (!file) return { ok: false, error: 'No file selected.' };
      if (file.size > MAX_BYTES) {
        return { ok: false, error: 'File is larger than the 25 MB limit.' };
      }
      if (!('arrayBuffer' in file)) return { ok: false, error: 'Browser could not read this file.' };
      return file.arrayBuffer().then(function (buf) {
        var u8 = new Uint8Array(buf);
        return describeBytes(u8, file.name);
      });
    });
  }

  root.OMPFileValidate = {
    describeBytes: describeBytes,
    describeImageBytes: describeImageBytes,
    validateFile: validateFile,
    validateImage: validateImage,
    MAX_BYTES: MAX_BYTES,
    IMAGE_MAX_BYTES: IMAGE_MAX_BYTES,
    CONTENT_TYPE: CONTENT_TYPE
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.OMPFileValidate;
  }
})(typeof window !== 'undefined' ? window : globalThis);
