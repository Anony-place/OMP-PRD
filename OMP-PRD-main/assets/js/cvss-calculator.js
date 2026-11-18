/* CVSS calculator — v3.1 base/temporal/environmental scoring computed locally.
 * Formulas follow the FIRST CVSS v3.1 specification exactly:
 *   Exploitability = 8.22 x AV x AC x PR x UI
 *   Impact (Scope Unchanged)  = 6.42 x ISC
 *   Impact (Scope Changed)    = 7.52 x (ISC - 0.029) - 3.25 x (ISC x 0.9731 - 0.02)^13
 *   ISC = 1 - (1-C)(1-I)(1-A)
 *   Base       = Roundup(min(Impact + Exploitability, 10))            [Scope Unchanged]
 *              = Roundup(min(1.08 x (Impact + Exploitability), 10))    [Scope Changed]
 *   Temporal   = Roundup(Base x E x RL x RC)
 *   Env        = Roundup(AdjustedBase x E x RL x RC)
 * Roundup = smallest number to one decimal place >= input (per spec).
 * CVSS v4.0 vectors are DECODED but never scored here: v4.0 uses macrovector
 * lookup, not a formula, and we do not fake a score. */
(function () {
  'use strict';

  var WEIGHTS = {
    AV: { N: 0.85, A: 0.62, L: 0.55, P: 0.2 },
    AC: { L: 0.77, H: 0.44 },
    PR: { U: { N: 0.85, L: 0.62, H: 0.27 }, C: { N: 0.85, L: 0.68, H: 0.5 } },
    UI: { N: 0.85, R: 0.62 },
    CIA: { H: 0.56, L: 0.22, N: 0 },
    E: { U: 0.91, P: 0.94, F: 0.97, H: 1, X: 1 },
    RL: { U: 0.97, W: 0.96, T: 0.95, O: 1, X: 1 },
    RC: { U: 0.92, R: 0.96, C: 1, X: 1 },
    REQ: { H: 1.5, M: 1, L: 0.5, X: 1 }
  };

  var LABELS = {
    AV: { N: 'Network', A: 'Adjacent', L: 'Local', P: 'Physical' },
    AC: { L: 'Low', H: 'High' },
    PR: { N: 'None', L: 'Low', H: 'High' },
    UI: { N: 'None', R: 'Required' },
    S: { U: 'Unchanged', C: 'Changed' },
    C: { N: 'None', L: 'Low', H: 'High' }, I: { N: 'None', L: 'Low', H: 'High' }, A: { N: 'None', L: 'Low', H: 'High' },
    E: { X: 'Not Defined', U: 'Unproven', P: 'Proof-of-Concept', F: 'Functional', H: 'High' },
    RL: { X: 'Not Defined', U: 'Unavailable', W: 'Workaround', T: 'Temporary Fix', O: 'Official Fix' },
    RC: { X: 'Not Defined', U: 'Unknown', R: 'Reasonable', C: 'Confirmed' },
    CR: { X: 'Not Defined', L: 'Low', M: 'Medium', H: 'High' }, IR: { X: 'Not Defined', L: 'Low', M: 'Medium', H: 'High' }, AR: { X: 'Not Defined', L: 'Low', M: 'Medium', H: 'High' },
    MAV: { X: 'Not Defined', N: 'Network', A: 'Adjacent', L: 'Local', P: 'Physical' },
    MAC: { X: 'Not Defined', L: 'Low', H: 'High' },
    MPR: { X: 'Not Defined', N: 'None', L: 'Low', H: 'High' },
    MUI: { X: 'Not Defined', N: 'None', R: 'Required' },
    MS: { X: 'Not Defined', U: 'Unchanged', C: 'Changed' },
    MC: { X: 'Not Defined', N: 'None', L: 'Low', H: 'High' }, MI: { X: 'Not Defined', N: 'None', L: 'Low', H: 'High' }, MA: { X: 'Not Defined', N: 'None', L: 'Low', H: 'High' }
  };

  var ALLOWED = {
    AV: 'NALP', AC: 'LH', PR: 'NLH', UI: 'NR', S: 'UC',
    C: 'NLH', I: 'NLH', A: 'NLH',
    E: 'XUPFH', RL: 'XUWTO', RC: 'XURC',
    CR: 'XLHM', IR: 'XLHM', AR: 'XLHM',
    MAV: 'XNALP', MAC: 'XLH', MPR: 'XNLH', MUI: 'XNR', MS: 'XUC',
    MC: 'XNLH', MI: 'XNLH', MA: 'XNLH'
  };

  var NAMES = {
    AV: 'Attack Vector', AC: 'Attack Complexity', PR: 'Privileges Required', UI: 'User Interaction',
    S: 'Scope', C: 'Confidentiality', I: 'Integrity', A: 'Availability',
    E: 'Exploit Maturity', RL: 'Remediation Level', RC: 'Report Confidence',
    CR: 'Confidentiality Requirement', IR: 'Integrity Requirement', AR: 'Availability Requirement',
    MAV: 'Modified Attack Vector', MAC: 'Modified Attack Complexity', MPR: 'Modified Privileges Required',
    MUI: 'Modified User Interaction', MS: 'Modified Scope', MC: 'Modified Confidentiality',
    MI: 'Modified Integrity', MA: 'Modified Availability'
  };

  var V4 = {
    AV: { N: 'Network', A: 'Adjacent', L: 'Local', P: 'Physical' },
    AC: { L: 'Low', H: 'High' }, AT: { N: 'None', P: 'Present' },
    PR: { N: 'None', L: 'Low', H: 'High' }, UI: { N: 'None', P: 'Passive', A: 'Active' },
    VC: { H: 'High', L: 'Low', N: 'None' }, VI: { H: 'High', L: 'Low', N: 'None' }, VA: { H: 'High', L: 'Low', N: 'None' },
    SC: { H: 'High', L: 'Low', N: 'None' }, SI: { H: 'High', L: 'Low', N: 'None' }, SA: { H: 'High', L: 'Low', N: 'None' },
    E: { X: 'Not Defined', U: 'Unreported', P: 'Proof-of-Concept', A: 'Attacked' },
    CR: { X: 'Not Defined', L: 'Low', M: 'Medium', H: 'High' }, IR: { X: 'Not Defined', L: 'Low', M: 'Medium', H: 'High' }, AR: { X: 'Not Defined', L: 'Low', M: 'Medium', H: 'High' },
    MAV: { X: 'Not Defined', N: 'Network', A: 'Adjacent', L: 'Local', P: 'Physical' },
    MAC: { X: 'Not Defined', L: 'Low', H: 'High' }, MAT: { X: 'Not Defined', N: 'None', P: 'Present' },
    MPR: { X: 'Not Defined', N: 'None', L: 'Low', H: 'High' }, MUI: { X: 'Not Defined', N: 'None', P: 'Passive', A: 'Active' },
    MVC: { X: 'Not Defined', H: 'High', L: 'Low', N: 'None' }, MVI: { X: 'Not Defined', H: 'High', L: 'Low', N: 'None' }, MVA: { X: 'Not Defined', H: 'High', L: 'Low', N: 'None' },
    MSC: { X: 'Not Defined', H: 'High', L: 'Low', N: 'None' }, MSI: { X: 'Not Defined', S: 'Safety', H: 'High', L: 'Low', N: 'None' }, MSA: { X: 'Not Defined', S: 'Safety', H: 'High', L: 'Low', N: 'None' },
    S: { X: 'Not Defined', N: 'Negligible', P: 'Present' },
    AU: { X: 'Not Defined', N: 'None', P: 'Present' }, R: { X: 'Not Defined', A: 'Automatic', U: 'User', I: 'Invalid' },
    V: { X: 'Not Defined', D: 'Defense-in-depth', C: 'Contained' },
    RE: { X: 'Not Defined', L: 'Low', M: 'Medium', H: 'High' }, U: { X: 'Not Defined', C: 'Clear', T: 'Tolerated', W: 'Workaround' }
  };

  /* Spec roundup: smallest 0.1 >= x, computed on 1e-5 integers so binary float
   * noise cannot push an exact 9.8 to 9.9. */
  function roundUp(x) {
    var r = Math.round(x * 100000);
    if (r % 10000 === 0) return r / 100000;
    return (Math.floor(r / 10000) + 1) * 10000 / 100000;
  }

  function impactOf(isc, scopeChanged) {
    if (isc <= 0) return 0;
    if (scopeChanged) {
      return 7.52 * (isc - 0.029) - 3.25 * Math.pow(isc * 0.9731 - 0.02, 13);
    }
    return 6.42 * isc;
  }

  function parseVector(str) {
    var out = { version: null, metrics: {}, errors: [], v4: [] };
    var raw = String(str || '').trim();
    if (!raw) { out.errors.push('empty'); return out; }
    var parts = raw.split('/');
    var head = parts[0].toUpperCase();
    if (head === 'CVSS:3.1' || head === 'CVSS:3.0') out.version = head.slice(5);
    else if (head === 'CVSS:4.0') out.version = '4.0';
    else { out.errors.push('vector must start with CVSS:3.1, CVSS:3.0 or CVSS:4.0'); return out; }

    for (var i = 1; i < parts.length; i++) {
      var kv = parts[i].split(':');
      if (kv.length !== 2 || !kv[0]) { out.errors.push('bad segment: ' + parts[i]); continue; }
      var key = kv[0].toUpperCase();
      var val = kv[1].toUpperCase();
      if (out.version === '4.0') {
        if (V4[key] && V4[key][val]) out.v4.push({ key: key, val: val });
        else out.errors.push('unknown v4 metric or value: ' + parts[i]);
      } else {
        if (!ALLOWED[key]) { out.errors.push('unknown metric: ' + key); continue; }
        if (ALLOWED[key].indexOf(val) < 0) { out.errors.push('bad value ' + val + ' for ' + key); continue; }
        out.metrics[key] = val;
      }
    }
    if (out.version !== '4.0') {
      ['AV', 'AC', 'PR', 'UI', 'S', 'C', 'I', 'A'].forEach(function (k) {
        if (!out.metrics[k]) out.errors.push('missing base metric: ' + k);
      });
    }
    return out;
  }

  function score(m) {
    var g = function (k, d) { return m[k] || d || 'X'; };
    var scope = g('S');
    var c = WEIGHTS.CIA[g('C')], ia = WEIGHTS.CIA[g('I')], a = WEIGHTS.CIA[g('A')];
    var isc = 1 - (1 - c) * (1 - ia) * (1 - a);
    var impact = (g('C') === 'N' && g('I') === 'N' && g('A') === 'N') ? 0 : impactOf(isc, scope === 'C');
    var prW = WEIGHTS.PR[scope === 'C' ? 'C' : 'U'][g('PR')];
    var exploitability = 8.22 * WEIGHTS.AV[g('AV')] * WEIGHTS.AC[g('AC')] * prW * WEIGHTS.UI[g('UI')];

    var base = 0;
    if (impact > 0) {
      base = scope === 'C'
        ? roundUp(Math.min(1.08 * (impact + exploitability), 10))
        : roundUp(Math.min(impact + exploitability, 10));
    }

    var e = WEIGHTS.E[g('E')], rl = WEIGHTS.RL[g('RL')], rc = WEIGHTS.RC[g('RC')];
    var temporal = base === 0 ? 0 : roundUp(base * e * rl * rc);

    /* Environmental: modified metrics fall back to base values when X. */
    var mc = g('MC') === 'X' ? g('C') : g('MC');
    var mi = g('MI') === 'X' ? g('I') : g('MI');
    var ma = g('MA') === 'X' ? g('A') : g('MA');
    var cr = WEIGHTS.REQ[g('CR')], ir = WEIGHTS.REQ[g('IR')], ar = WEIGHTS.REQ[g('AR')];
    var iscMod = 1 - (1 - WEIGHTS.CIA[mc] * cr) * (1 - WEIGHTS.CIA[mi] * ir) * (1 - WEIGHTS.CIA[ma] * ar);
    var modScope = g('MS') === 'X' ? scope : g('MS');
    var adjImpact = (mc === 'N' && mi === 'N' && ma === 'N') ? 0 : impactOf(iscMod, modScope === 'C');
    var mav = g('MAV') === 'X' ? g('AV') : g('MAV');
    var mac = g('MAC') === 'X' ? g('AC') : g('MAC');
    var mpr = g('MPR') === 'X' ? g('PR') : g('MPR');
    var mui = g('MUI') === 'X' ? g('UI') : g('MUI');
    var mprW = WEIGHTS.PR[modScope === 'C' ? 'C' : 'U'][mpr];
    var adjExploitability = 8.22 * WEIGHTS.AV[mav] * WEIGHTS.AC[mac] * mprW * WEIGHTS.UI[mui];
    var env = 0;
    if (adjImpact > 0) {
      var adjBase = modScope === 'C'
        ? roundUp(Math.min(1.08 * (adjImpact + adjExploitability), 10))
        : roundUp(Math.min(adjImpact + adjExploitability, 10));
      env = roundUp(adjBase * e * rl * rc);
    }

    return {
      base: base, temporal: temporal, environmental: env,
      impact: Math.round(impact * 1000) / 1000,
      exploitability: Math.round(exploitability * 1000) / 1000,
      adjImpact: Math.round(adjImpact * 1000) / 1000,
      adjExploitability: Math.round(adjExploitability * 1000) / 1000,
      isc: Math.round(isc * 100000) / 100000
    };
  }

  function band(x) {
    if (x === 0) return { name: 'None', cls: 'none' };
    if (x < 4) return { name: 'Low', cls: 'low' };
    if (x < 7) return { name: 'Medium', cls: 'medium' };
    if (x < 9) return { name: 'High', cls: 'high' };
    return { name: 'Critical', cls: 'critical' };
  }

  function buildVector(m) {
    var order = ['AV', 'AC', 'PR', 'UI', 'S', 'C', 'I', 'A', 'E', 'RL', 'RC', 'CR', 'IR', 'AR', 'MAV', 'MAC', 'MPR', 'MUI', 'MS', 'MC', 'MI', 'MA'];
    var parts = ['CVSS:3.1'];
    order.forEach(function (k) {
      if (m[k] && m[k] !== 'X') parts.push(k + ':' + m[k]);
    });
    return parts.join('/');
  }

  var engine = {
    parseVector: parseVector, score: score, band: band, buildVector: buildVector,
    roundUp: roundUp, LABELS: LABELS, NAMES: NAMES, V4: V4
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = engine;
  if (typeof window !== 'undefined') window.CVSS31 = engine;

  /* ---------------- UI ---------------- */
  if (typeof document === 'undefined') return;

  var BASE_KEYS = ['AV', 'AC', 'PR', 'UI', 'S', 'C', 'I', 'A'];
  var TEMP_KEYS = ['E', 'RL', 'RC'];
  var ENV_KEYS = ['CR', 'IR', 'AR'];
  var MOD_KEYS = ['MAV', 'MAC', 'MPR', 'MUI', 'MS', 'MC', 'MI', 'MA'];
  var state = {};

  function defaults() {
    /* AC must be L/M/H in CVSS 3.1 — a plain 'N' default parsed as
       "bad value N for AC; missing base metric: AC" and showed a red error
       on every fresh load (audit 2026-11-18). This neutral default vector
       (AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:N) is valid and still scores 0.0. */
    BASE_KEYS.forEach(function (k) { state[k] = k === 'S' ? 'U' : (k === 'AC' ? 'L' : 'N'); });
    state.S = 'U';
    TEMP_KEYS.concat(ENV_KEYS).concat(MOD_KEYS).forEach(function (k) { state[k] = 'X'; });
    state.MS = 'X';
  }

  function chipRow(key) {
    var vals = Object.keys(LABELS[key]);
    var wrap = document.createElement('div');
    wrap.className = 'cvss-row';
    var lab = document.createElement('div');
    lab.className = 'cvss-key small';
    lab.innerHTML = '<strong>' + key + '</strong> <span class="muted">' + NAMES[key] + '</span>';
    wrap.appendChild(lab);
    var opts = document.createElement('div');
    opts.className = 'cvss-opts';
    vals.forEach(function (v) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn btn-secondary btn-sm cvss-opt';
      b.setAttribute('data-cvss-metric', key);
      b.setAttribute('data-cvss-value', v);
      b.textContent = v === 'X' ? 'X · Not Defined' : v + ' · ' + LABELS[key][v];
      b.addEventListener('click', function () {
        state[key] = v;
        render();
      });
      opts.appendChild(b);
    });
    wrap.appendChild(opts);
    return wrap;
  }

  function fill(container, keys) {
    container.innerHTML = '';
    keys.forEach(function (k) { container.appendChild(chipRow(k)); });
  }

  function scoreText(n) {
    return (Math.round(n * 10) / 10).toFixed(1);
  }

  function render() {
    document.querySelectorAll('.cvss-opt').forEach(function (b) {
      var on = state[b.getAttribute('data-cvss-metric')] === b.getAttribute('data-cvss-value');
      b.classList.toggle('btn-primary', on);
      b.classList.toggle('btn-secondary', !on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    var parsed = parseVector(buildVector(state));
    if (parsed.errors.length) {
      var errEl = document.querySelector('[data-cvss-error]');
      if (errEl) errEl.textContent = parsed.errors.join('; ');
      return;
    }
    var r = score(state);
    var b = band(r.base);
    var setText = function (sel, v) { var el = document.querySelector(sel); if (el) el.textContent = v; };
    setText('[data-cvss-score]', scoreText(r.base));
    setText('[data-cvss-temporal]', scoreText(r.temporal));
    setText('[data-cvss-env]', scoreText(r.environmental));
    setText('[data-cvss-band]', b.name);
    setText('[data-cvss-vector]', buildVector(state));
    setText('[data-cvss-impact]', scoreText(r.impact));
    setText('[data-cvss-exploit]', scoreText(r.exploitability));
    setText('[data-cvss-isc]', String(r.isc));
    var pill = document.querySelector('[data-cvss-band]');
    if (pill) { pill.className = 'cvss-pill cvss-' + b.cls; }
    var big = document.querySelector('[data-cvss-score]');
    if (big) big.className = 'cvss-score cvss-' + b.cls;
    setText('[data-cvss-error]', '');
  }

  function renderV4(items) {
    var panel = document.querySelector('[data-cvss-v4panel]');
    if (!panel) return;
    var rows = items.map(function (it) {
      var label = (NAMES[it.key] || V4[it.key] && it.key || it.key);
      var valName = (V4[it.key] && V4[it.key][it.val]) || it.val;
      return '<tr><td class="mono"><strong>' + it.key + '</strong></td><td>' + it.key.replace(/^M/, 'Modified ') + '</td><td>' + valName + ' (' + it.val + ')</td></tr>';
    }).join('');
    panel.innerHTML = '<h3 class="h-3">Decoded CVSS v4.0 vector</h3>' +
      '<p class="small muted">v4.0 scores come from macrovector lookup, not a formula &mdash; this page decodes the vector but does <strong>not</strong> compute a v4.0 score. Use the FIRST reference implementation for that.</p>' +
      '<div class="table-wrap"><table class="table"><thead><tr><th>Metric</th><th>Name</th><th>Value</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    panel.hidden = false;
  }

  function bootUI() {
    var baseBox = document.querySelector('[data-cvss-base]');
    var tempBox = document.querySelector('[data-cvss-temp]');
    var envBox = document.querySelector('[data-cvss-env-req]');
    var modBox = document.querySelector('[data-cvss-mod]');
    if (!baseBox) return;
    defaults();
    fill(baseBox, BASE_KEYS);
    fill(tempBox, TEMP_KEYS);
    fill(envBox, ENV_KEYS);
    fill(modBox, MOD_KEYS);

    var input = document.querySelector('[data-cvss-input]');
    if (input) {
      input.addEventListener('input', function () {
        var raw = input.value.trim();
        if (!raw) { document.querySelector('[data-cvss-v4panel]').hidden = true; defaults(); render(); return; }
        var parsed = parseVector(raw);
        if (parsed.version === '4.0') {
          renderV4(parsed.v4);
          var errEl = document.querySelector('[data-cvss-error]');
          if (errEl) errEl.textContent = parsed.errors.length ? parsed.errors.join('; ') : '';
          return;
        }
        document.querySelector('[data-cvss-v4panel]').hidden = true;
        if (parsed.errors.length) {
          var e2 = document.querySelector('[data-cvss-error]');
          if (e2) e2.textContent = parsed.errors.join('; ');
          return;
        }
        defaults();
        Object.keys(parsed.metrics).forEach(function (k) { state[k] = parsed.metrics[k]; });
        render();
      });
    }

    document.querySelectorAll('[data-cvss-preset]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (input) {
          input.value = btn.getAttribute('data-cvss-preset');
          input.dispatchEvent(new Event('input'));
        }
      });
    });

    var copyBtn = document.querySelector('[data-cvss-copy]');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        var v = document.querySelector('[data-cvss-vector]');
        if (v && navigator.clipboard) navigator.clipboard.writeText(v.textContent);
        copyBtn.textContent = 'Copied';
        setTimeout(function () { copyBtn.textContent = 'Copy vector'; }, 1200);
      });
    }

    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootUI);
  else bootUI();
})();
