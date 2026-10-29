/* ============================================================
   OopsMyPassword — Client-Side Hash, JWT & Encoding Inspector
   100% browser-local WebCrypto hash generator, hash format
   identifier, offline JWT security auditor, and encoder workbench.
   ============================================================ */
(function () {
  'use strict';

  var SAMPLE_JWT =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
    'eyJzdWIiOiJ1c2VyXzkmODIiLCJuYW1lIjoiQWxpY2UgU2VjdXJpdHkiLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3MTAwMDAwMDAsImV4cCI6MTg5MzQ1NjAwMH0.' +
    'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

  function bufToHex(buffer) {
    var bytes = new Uint8Array(buffer);
    var out = '';
    for (var i = 0; i < bytes.length; i++) {
      out += bytes[i].toString(16).padStart(2, '0');
    }
    return out;
  }

  function identifyHash(raw) {
    var s = String(raw || '').trim();
    if (!s) return [];
    var matches = [];

    if (/^\$argon2(id|i|d)\$/i.test(s)) {
      matches.push({
        name: 'Argon2 (' + s.split('$')[1] + ')',
        grade: 'Strong (Memory-Hard)',
        notes: 'Modern password hashing competition winner. Resistant to GPU/ASIC cracking.'
      });
    }
    if (/^\$2[ayb]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(s)) {
      var cost = s.split('$')[2];
      matches.push({
        name: 'bcrypt (Blowfish crypt, cost=' + cost + ')',
        grade: Number(cost) >= 12 ? 'Strong (Salted Slow Hash)' : 'Moderate (Increase work factor to 12+)',
        notes: 'Includes 128-bit salt and configurable cost factor.'
      });
    }
    if (/^\$scrypt\$/i.test(s) || /^scrypt:/i.test(s)) {
      matches.push({
        name: 'scrypt',
        grade: 'Strong (Memory-Hard)',
        notes: 'Memory-hard key derivation function resistant to parallel hardware attacks.'
      });
    }
    if (/^pbkdf2[_:]/i.test(s) || /^\$pbkdf2/i.test(s)) {
      matches.push({
        name: 'PBKDF2',
        grade: 'Moderate (Check iteration count >= 600,000 for SHA-256)',
        notes: 'NIST/FIPS standard key derivation; requires high iteration counts against modern GPUs.'
      });
    }
    if (/^\$6\$/.test(s)) {
      matches.push({
        name: 'sha512crypt (Unix /etc/shadow $6$)',
        grade: 'Moderate (Salted)',
        notes: 'Standard Linux SHA-512 crypt format.'
      });
    }
    if (/^[a-fA-F0-9]{32}$/.test(s)) {
      matches.push({
        name: 'MD5 or NTLM (128-bit / 32 hex chars)',
        grade: 'Weak for Passwords (Fast Unsalted)',
        notes: 'Cracked at billions of guesses per second on consumer GPUs. Never use for password storage.'
      });
    }
    if (/^[a-fA-F0-9]{40}$/.test(s)) {
      matches.push({
        name: 'SHA-1 or MySQL5 (160-bit / 40 hex chars)',
        grade: 'Weak for Passwords (Fast Unsalted)',
        notes: 'Vulnerable to collision attacks and high-speed GPU hash cracking.'
      });
    }
    if (/^[a-fA-F0-9]{64}$/.test(s)) {
      matches.push({
        name: 'SHA-256 / BLAKE2s / SHA3-256 (256-bit / 64 hex chars)',
        grade: 'Strong for File Integrity / Weak if Unsalted Password',
        notes: 'Safe for file checksums and HMACs; passwords still require Argon2id or bcrypt.'
      });
    }
    if (/^[a-fA-F0-9]{96}$/.test(s)) {
      matches.push({
        name: 'SHA-384 (384-bit / 96 hex chars)',
        grade: 'Strong Cryptographic Digest',
        notes: 'Truncated SHA-512 variant impervious to length-extension attacks.'
      });
    }
    if (/^[a-fA-F0-9]{128}$/.test(s)) {
      matches.push({
        name: 'SHA-512 / BLAKE2b / Whirlpool (512-bit / 128 hex chars)',
        grade: 'Strong Cryptographic Digest',
        notes: '512-bit digest commonly used in digital signatures and integrity verification.'
      });
    }
    if (/^eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/.test(s)) {
      matches.push({
        name: 'JSON Web Token (JWT)',
        grade: 'Encoded Token (Not a Hash)',
        notes: 'Base64URL-encoded header and payload. Switch to the JWT Inspector tab to audit it.'
      });
    }

    if (!matches.length) {
      matches.push({
        name: 'Unrecognized / Custom Format (' + s.length + ' chars)',
        grade: 'Unknown Format',
        notes: 'Does not match standard hex digest lengths (32/40/64/96/128) or modular crypt prefixes ($argon2id$, $2b$).'
      });
    }
    return matches;
  }

  function decodeBase64Url(str) {
    var base64 = String(str || '').replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) base64 += '=';
    var bin = atob(base64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function encodeBase64(str, urlSafe) {
    var bytes = new TextEncoder().encode(String(str || ''));
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    var b64 = btoa(bin);
    if (urlSafe) return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return b64;
  }

  function auditJwt(raw) {
    var token = String(raw || '').trim();
    if (!token) return { ok: false, error: 'Paste a JWT token above to inspect its header, payload, and security posture.' };
    var parts = token.split('.');
    if (parts.length < 2 || parts.length > 3) {
      return { ok: false, error: 'Invalid JWT structure: expected 3 dot-separated segments (header.payload.signature).' };
    }
    var headerObj, payloadObj;
    try {
      headerObj = JSON.parse(decodeBase64Url(parts[0]));
    } catch (e) {
      return { ok: false, error: 'Could not decode JWT Header as valid Base64URL JSON.' };
    }
    try {
      payloadObj = JSON.parse(decodeBase64Url(parts[1]));
    } catch (e) {
      return { ok: false, error: 'Could not decode JWT Payload as valid Base64URL JSON.' };
    }

    var findings = [];
    var alg = String(headerObj.alg || 'none');
    if (alg.toLowerCase() === 'none' || !parts[2]) {
      findings.push({ level: 'danger', title: 'Unsigned Token (alg: none)', desc: 'Token carries no cryptographic signature verification. Any attacker can forge claims.' });
    } else if (/^HS(256|384|512)$/i.test(alg)) {
      findings.push({ level: 'warn', title: 'Symmetric HMAC Algorithm (' + alg + ')', desc: 'Ensure the signing secret has at least 256 bits of CSPRNG entropy to prevent offline hashcat brute-forcing, and verify the server rejects RS256->HS256 algorithm confusion.' });
    } else if (/^(RS|ES|PS|EdDSA)/i.test(alg)) {
      findings.push({ level: 'ok', title: 'Asymmetric Signature Algorithm (' + alg + ')', desc: 'Uses public/private key signing. Verify that jku/jwk/kid header parameters are strictly pinned server-side.' });
    }

    var nowSec = Math.floor(Date.now() / 1000);
    if (typeof payloadObj.exp === 'number') {
      var expDate = new Date(payloadObj.exp * 1000).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
      if (payloadObj.exp < nowSec) {
        findings.push({ level: 'warn', title: 'Token Expired', desc: 'exp claim (' + expDate + ') is in the past. Proper resource servers should reject this token.' });
      } else {
        var ttlHours = Math.round((payloadObj.exp - nowSec) / 3600);
        findings.push({ level: ttlHours > 168 ? 'warn' : 'ok', title: 'Expiration Claim Present (' + expDate + ')', desc: ttlHours > 168 ? 'Token remains valid for ~' + ttlHours + ' hours. Short-lived access tokens (15–60 min) reduce replay risk.' : 'Valid for ~' + Math.max(1, ttlHours) + ' hours.' });
      }
    } else {
      findings.push({ level: 'danger', title: 'Missing Expiration Claim (exp)', desc: 'Token never expires automatically if leaked or stolen.' });
    }

    var sensitiveKeys = Object.keys(payloadObj).filter(function (k) {
      return /password|secret|ssn|credit|card|token|apikey|private/i.test(k);
    });
    if (sensitiveKeys.length) {
      findings.push({ level: 'danger', title: 'Sensitive Keys in Payload (' + sensitiveKeys.join(', ') + ')', desc: 'JWT payloads are Base64URL-encoded, NOT encrypted. Anyone with the token can read these fields.' });
    } else {
      findings.push({ level: 'ok', title: 'No Obvious Secret Key Names in Payload', desc: 'Remember that JWT payloads are readable by clients unless wrapped in JWE encryption.' });
    }

    return {
      ok: true,
      header: JSON.stringify(headerObj, null, 2),
      payload: JSON.stringify(payloadObj, null, 2),
      signature: parts[2] || '(empty — unsigned)',
      findings: findings
    };
  }

  function init() {
    var root = document.querySelector('[data-hash-inspector]');
    if (!root) return;

    // Tab switching
    var tabBtns = root.querySelectorAll('[data-inspector-tab]');
    var panels = root.querySelectorAll('[data-inspector-panel]');
    tabBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var target = btn.getAttribute('data-inspector-tab');
        tabBtns.forEach(function (b) {
          var active = b.getAttribute('data-inspector-tab') === target;
          b.className = 'btn btn-sm ' + (active ? 'btn-primary' : 'btn-ghost');
          b.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        panels.forEach(function (p) {
          p.hidden = p.getAttribute('data-inspector-panel') !== target;
        });
      });
    });

    // 1. Live WebCrypto Hashing
    var hashInput = document.getElementById('hash-live-input');
    var out256 = document.getElementById('hash-out-sha256');
    var out384 = document.getElementById('hash-out-sha384');
    var out512 = document.getElementById('hash-out-sha512');
    var out1 = document.getElementById('hash-out-sha1');

    async function updateHashes() {
      var val = hashInput ? hashInput.value : '';
      if (!val) {
        if (out256) out256.textContent = 'Enter text above to compute SHA-256 digest…';
        if (out384) out384.textContent = '—';
        if (out512) out512.textContent = '—';
        if (out1) out1.textContent = '—';
        return;
      }
      if (!window.crypto || !window.crypto.subtle) return;
      var data = new TextEncoder().encode(val);
      var results = await Promise.all([
        window.crypto.subtle.digest('SHA-256', data),
        window.crypto.subtle.digest('SHA-384', data),
        window.crypto.subtle.digest('SHA-512', data),
        window.crypto.subtle.digest('SHA-1', data)
      ]);
      if (out256) out256.textContent = bufToHex(results[0]);
      if (out384) out384.textContent = bufToHex(results[1]);
      if (out512) out512.textContent = bufToHex(results[2]);
      if (out1) out1.textContent = bufToHex(results[3]);
    }

    if (hashInput) {
      hashInput.addEventListener('input', updateHashes);
      updateHashes();
    }

    // Copy buttons for digests
    root.querySelectorAll('[data-copy-target]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-copy-target');
        var el = document.getElementById(id);
        if (!el || !el.textContent || el.textContent === '—') return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(el.textContent).then(function () {
            var prev = btn.textContent;
            btn.textContent = 'Copied!';
            setTimeout(function () { btn.textContent = prev; }, 1400);
          });
        }
      });
    });

    // 2. Hash Identifier
    var detectInput = document.getElementById('hash-detect-input');
    var detectOutput = document.getElementById('hash-detect-output');
    function updateHashDetection() {
      if (!detectOutput) return;
      var val = detectInput ? detectInput.value : '';
      var matches = identifyHash(val);
      if (!matches.length) {
        detectOutput.innerHTML = '<p class="muted small">Paste any hash digest (e.g. <code>$2b$12$...</code>, <code>$argon2id$...</code>, or 32/64-char hex) to identify its format and security grade.</p>';
        return;
      }
      detectOutput.innerHTML = matches.map(function (m) {
        return (
          '<div class="card card-pad" style="margin-top:10px">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">' +
              '<strong>' + m.name + '</strong>' +
              '<span class="small mono" style="color:var(--purple);font-weight:600">' + m.grade + '</span>' +
            '</div>' +
            '<p class="muted small mt-8" style="margin-bottom:0">' + m.notes + '</p>' +
          '</div>'
        );
      }).join('');
    }
    if (detectInput) {
      detectInput.addEventListener('input', updateHashDetection);
      updateHashDetection();
    }
    root.querySelectorAll('[data-sample-hash]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (detectInput) {
          detectInput.value = btn.getAttribute('data-sample-hash');
          updateHashDetection();
        }
      });
    });

    // 3. JWT Inspector
    var jwtInput = document.getElementById('jwt-input');
    var jwtSampleBtn = document.getElementById('jwt-load-sample');
    var jwtHeaderEl = document.getElementById('jwt-header-out');
    var jwtPayloadEl = document.getElementById('jwt-payload-out');
    var jwtFindingsEl = document.getElementById('jwt-findings-out');

    function updateJwt() {
      var res = auditJwt(jwtInput ? jwtInput.value : '');
      if (!res.ok) {
        if (jwtHeaderEl) jwtHeaderEl.textContent = '// Header JSON';
        if (jwtPayloadEl) jwtPayloadEl.textContent = '// Payload JSON';
        if (jwtFindingsEl) jwtFindingsEl.innerHTML = '<p class="muted small">' + res.error + '</p>';
        return;
      }
      if (jwtHeaderEl) jwtHeaderEl.textContent = res.header;
      if (jwtPayloadEl) jwtPayloadEl.textContent = res.payload;
      if (jwtFindingsEl) {
        jwtFindingsEl.innerHTML = res.findings.map(function (f) {
          var color = f.level === 'danger' ? '#dc2626' : (f.level === 'warn' ? '#d97706' : '#059669');
          var label = f.level === 'danger' ? 'High Risk' : (f.level === 'warn' ? 'Advisory' : 'Passed');
          return (
            '<div class="card card-pad" style="margin-top:10px">' +
              '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px">' +
                '<strong>' + f.title + '</strong>' +
                '<span class="small mono" style="color:' + color + ';font-weight:700">' + label + '</span>' +
              '</div>' +
              '<p class="muted small mt-8" style="margin-bottom:0">' + f.desc + '</p>' +
            '</div>'
          );
        }).join('');
      }
    }

    if (jwtInput) {
      jwtInput.addEventListener('input', updateJwt);
    }
    if (jwtSampleBtn && jwtInput) {
      jwtSampleBtn.addEventListener('click', function () {
        jwtInput.value = SAMPLE_JWT;
        updateJwt();
      });
    }
    if (jwtInput && !jwtInput.value) {
      jwtInput.value = SAMPLE_JWT;
      updateJwt();
    }

    // 4. Encoder / Decoder Workbench
    var encInput = document.getElementById('enc-input');
    var encFormat = document.getElementById('enc-format');
    var encDir = document.getElementById('enc-direction');
    var encOutput = document.getElementById('enc-output');

    function updateEncoding() {
      if (!encOutput) return;
      var raw = encInput ? encInput.value : '';
      var fmt = encFormat ? encFormat.value : 'base64';
      var dir = encDir ? encDir.value : 'encode';
      if (!raw) {
        encOutput.textContent = 'Output will appear here immediately…';
        return;
      }
      try {
        if (dir === 'encode') {
          if (fmt === 'base64') encOutput.textContent = encodeBase64(raw, false);
          else if (fmt === 'base64url') encOutput.textContent = encodeBase64(raw, true);
          else if (fmt === 'hex') encOutput.textContent = bufToHex(new TextEncoder().encode(raw));
          else if (fmt === 'url') encOutput.textContent = encodeURIComponent(raw);
        } else {
          if (fmt === 'base64' || fmt === 'base64url') encOutput.textContent = decodeBase64Url(raw.trim());
          else if (fmt === 'hex') {
            var clean = raw.replace(/\s+/g, '');
            var bytes = new Uint8Array(clean.length / 2);
            for (var i = 0; i < bytes.length; i++) {
              bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
            }
            encOutput.textContent = new TextDecoder().decode(bytes);
          } else if (fmt === 'url') {
            encOutput.textContent = decodeURIComponent(raw);
          }
        }
      } catch (err) {
        encOutput.textContent = 'Could not ' + dir + ' input with ' + fmt + ': ' + err.message;
      }
    }

    [encInput, encFormat, encDir].forEach(function (el) {
      if (el) {
        el.addEventListener('input', updateEncoding);
        el.addEventListener('change', updateEncoding);
      }
    });
    updateEncoding();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
