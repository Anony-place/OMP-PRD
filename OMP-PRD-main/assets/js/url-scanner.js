/* ============================================================
   OopsMyPassword — Phishing URL & Suspicious Link Risk Analyzer
   100% browser-local lexical & structural URL inspection:
   IDN homographs, @-authority confusion, brand typosquatting,
   open redirects, and deceptive TLDs. No URL leaves your tab.
   ============================================================ */
(function () {
  'use strict';

  var PROTECTED_BRANDS = [
    'google', 'microsoft', 'apple', 'paypal', 'github', 'amazon',
    'netflix', 'okta', 'chase', 'binance', 'coinbase', 'proton',
    'bitwarden', '1password', 'dropbox', 'linkedin', 'facebook',
    'instagram', 'whatsapp', 'cloudflare', 'stripe', 'slack'
  ];

  var RISKY_TLDS = new Set([
    'zip', 'mov', 'top', 'xyz', 'click', 'link', 'tk', 'ml', 'ga', 'cf', 'gq', 'work', 'support', 'account'
  ]);

  var REDIRECT_PARAMS = new Set([
    'redirect', 'redirect_uri', 'redirect_url', 'next', 'url', 'return', 'returnurl', 'return_to', 'continue', 'dest', 'destination', 'goto'
  ]);

  function normalizeLookalikes(str) {
    return String(str || '')
      .toLowerCase()
      .replace(/0/g, 'o')
      .replace(/1/g, 'l')
      .replace(/3/g, 'e')
      .replace(/5/g, 's')
      .replace(/rn/g, 'm')
      .replace(/vv/g, 'w');
  }

  function editDistance(a, b) {
    var dp = [];
    for (var i = 0; i <= a.length; i++) {
      dp[i] = [i];
      for (var j = 1; j <= b.length; j++) {
        dp[i][j] = i === 0 ? j : 0;
      }
    }
    for (var r = 1; r <= a.length; r++) {
      for (var c = 1; c <= b.length; c++) {
        var cost = a[r - 1] === b[c - 1] ? 0 : 1;
        dp[r][c] = Math.min(dp[r - 1][c] + 1, dp[r][c - 1] + 1, dp[r - 1][c - 1] + cost);
      }
    }
    return dp[a.length][b.length];
  }

  function analyzeUrl(rawInput) {
    var raw = String(rawInput || '').trim();
    if (!raw) return null;

    var candidate = /^https?:\/\//i.test(raw) ? raw : 'https://' + raw;
    var parsed;
    try {
      parsed = new URL(candidate);
    } catch (e) {
      return { valid: false, error: 'Could not parse input as a valid URL. Include a valid hostname such as https://example.com/login.' };
    }

    var score = 0;
    var findings = [];
    var host = parsed.hostname.toLowerCase();
    var labels = host.split('.').filter(Boolean);
    var tld = labels.length > 1 ? labels[labels.length - 1] : '';
    var sld = labels.length > 1 ? labels[labels.length - 2] : labels[0] || '';

    // 1. Embedded @ userinfo authority trick (e.g. https://google.com@evil.com)
    if (parsed.username || parsed.password || /\/\/[^/]*@/.test(candidate)) {
      score += 45;
      findings.push({
        severity: 'High Risk (+45)',
        title: 'Embedded @ Authority Confusion Detected',
        detail: 'The URL contains "' + (parsed.username || 'credentials') + '@" before the real destination host (' + host + '). Browsers ignore everything before @ and navigate to ' + host + '.'
      });
    }

    // 2. Non-ASCII / Punycode IDN Homograph check
    var hasNonAscii = /[^\u0000-\u007f]/.test(raw) || host.indexOf('xn--') !== -1;
    if (hasNonAscii) {
      score += 40;
      findings.push({
        severity: 'High Risk (+40)',
        title: 'IDN Punycode / Homograph Lookalike Domain (xn--)',
        detail: 'Hostname uses Internationalized Domain Name encoding (' + host + '). Attackers use Cyrillic or Greek lookalike letters to spoof trusted domains.'
      });
    }

    // 3. Raw IPv4 / Hex IP host
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || /^0x[0-9a-f]+$/i.test(host)) {
      score += 35;
      findings.push({
        severity: 'High Risk (+35)',
        title: 'Raw IP Address Hostname',
        detail: 'Legitimate login portals rarely ask users to sign in on a raw IP address (' + host + ') instead of a registered domain.'
      });
    }

    // 4. Brand typosquatting or deceptive subdomain placement
    var normalizedSld = normalizeLookalikes(sld);
    PROTECTED_BRANDS.forEach(function (brand) {
      // Exact brand in subdomain, but registered domain is different
      var subPart = labels.slice(0, -2).join('.');
      if (subPart.indexOf(brand) !== -1 && sld !== brand) {
        score += 35;
        findings.push({
          severity: 'High Risk (+35)',
          title: 'Brand Name Placed in Subdomain ("' + brand + '")',
          detail: 'The trusted brand "' + brand + '" appears in a subdomain, while the actual registered domain is "' + sld + '.' + tld + '".'
        });
      } else if (sld !== brand) {
        if (normalizedSld === brand || (sld.length >= 5 && editDistance(sld, brand) === 1) || (sld.indexOf(brand) !== -1 && sld !== brand)) {
          score += 35;
          findings.push({
            severity: 'High Risk (+35)',
            title: 'Potential Brand Typosquatting / Combo-Squatting ("' + brand + '")',
            detail: 'Registered domain "' + sld + '.' + tld + '" closely resembles protected brand "' + brand + '". Verify character-by-character before entering credentials.'
          });
        }
      }
    });

    // 5. Risky / file-extension TLD check
    if (RISKY_TLDS.has(tld)) {
      score += 20;
      findings.push({
        severity: 'Moderate Risk (+20)',
        title: 'High-Abuse or File-Confusion TLD (.' + tld + ')',
        detail: 'The .' + tld + ' top-level domain is frequently used in phishing campaigns or confuses users into thinking a URL is a local file (.zip / .mov).'
      });
    }

    // 6. Excessive subdomain depth or hyphenation
    if (labels.length >= 4) {
      score += 15;
      findings.push({
        severity: 'Advisory (+15)',
        title: 'Deep Subdomain Nesting (' + labels.length + ' levels)',
        detail: 'Phishing kits often stack subdomains to push the real domain out of mobile address bars.'
      });
    }
    if ((host.match(/-/g) || []).length >= 3) {
      score += 15;
      findings.push({
        severity: 'Advisory (+15)',
        title: 'Excessive Hyphens in Hostname',
        detail: 'Multiple hyphens in "' + host + '" are a common pattern in combo-squatted phishing domains.'
      });
    }

    // 7. Open Redirect parameters
    var redirectHits = [];
    parsed.searchParams.forEach(function (val, key) {
      if (REDIRECT_PARAMS.has(key.toLowerCase()) || /^https?:\/\//i.test(val) || /^\/\//.test(val)) {
        redirectHits.push(key + '=' + val.slice(0, 40));
      }
    });
    if (redirectHits.length) {
      score += 20;
      findings.push({
        severity: 'Moderate Risk (+20)',
        title: 'Redirect / Destination Query Parameter Detected',
        detail: 'Query string contains redirect parameters (' + redirectHits.join(', ') + ') which can bounce users to an external phishing site after login.'
      });
    }

    // 8. Unencrypted HTTP check
    if (parsed.protocol === 'http:') {
      score += 20;
      findings.push({
        severity: 'Moderate Risk (+20)',
        title: 'Unencrypted HTTP Transport',
        detail: 'Link uses plain HTTP instead of HTTPS. Any credentials submitted can be intercepted on the network.'
      });
    }

    score = Math.min(100, score);
    if (!findings.length) {
      findings.push({
        severity: 'Clean (0)',
        title: 'No Lexical Phishing Indicators Triggered',
        detail: 'The hostname "' + host + '" uses standard ASCII characters, HTTPS, and shows no @-authority tricks or brand typosquatting patterns.'
      });
    }

    var verdict = score >= 50 ? 'High Phishing Risk' : (score >= 20 ? 'Moderate Caution' : 'Low Structural Risk');
    return {
      valid: true,
      score: score,
      verdict: verdict,
      protocol: parsed.protocol.replace(':', '').toUpperCase(),
      host: host,
      registeredDomain: labels.length >= 2 ? sld + '.' + tld : host,
      subdomains: labels.length > 2 ? labels.slice(0, -2).join('.') : '(none)',
      pathname: parsed.pathname || '/',
      queryCount: Array.from(parsed.searchParams.keys()).length,
      findings: findings
    };
  }

  function init() {
    var root = document.querySelector('[data-url-scanner]');
    if (!root) return;

    var input = document.getElementById('url-scan-input');
    var resultBox = document.getElementById('url-scan-results');

    function render() {
      if (!resultBox) return;
      var res = analyzeUrl(input ? input.value : '');
      if (!res) {
        resultBox.innerHTML = '<p class="muted small">Paste any link above or click a test preset to inspect its hostname, punycode, and phishing heuristics locally.</p>';
        return;
      }
      if (!res.valid) {
        resultBox.innerHTML = '<div class="callout callout-warn"><p>' + res.error + '</p></div>';
        return;
      }

      var badgeColor = res.score >= 50 ? '#dc2626' : (res.score >= 20 ? '#d97706' : '#059669');
      var findingsHtml = res.findings.map(function (f) {
        return (
          '<div class="card card-pad" style="margin-top:10px">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">' +
              '<strong>' + f.title + '</strong>' +
              '<span class="small mono" style="color:' + badgeColor + ';font-weight:700">' + f.severity + '</span>' +
            '</div>' +
            '<p class="muted small mt-8" style="margin-bottom:0">' + f.detail + '</p>' +
          '</div>'
        );
      }).join('');

      resultBox.innerHTML =
        '<div class="card card-pad" style="margin-top:16px">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;padding-bottom:16px;border-bottom:1px solid var(--border)">' +
            '<div>' +
              '<div class="small muted">Lexical Risk Verdict</div>' +
              '<div class="h-2" style="margin:4px 0 0;color:' + badgeColor + '">' + res.verdict + '</div>' +
            '</div>' +
            '<div style="text-align:right">' +
              '<div class="small muted">Risk Score</div>' +
              '<div class="h-2 mono" style="margin:4px 0 0;color:' + badgeColor + '">' + res.score + ' / 100</div>' +
            '</div>' +
          '</div>' +
          '<div class="grid grid-3" style="margin-top:16px;gap:12px">' +
            '<div><div class="small muted">Actual Destination Host</div><code class="mono" style="font-weight:700">' + res.host + '</code></div>' +
            '<div><div class="small muted">Registered Domain (eTLD+1)</div><code class="mono" style="color:var(--purple);font-weight:700">' + res.registeredDomain + '</code></div>' +
            '<div><div class="small muted">Subdomain Prefix</div><code class="mono">' + res.subdomains + '</code></div>' +
            '<div><div class="small muted">Protocol</div><code class="mono">' + res.protocol + '</code></div>' +
            '<div><div class="small muted">Path</div><code class="mono">' + res.pathname + '</code></div>' +
            '<div><div class="small muted">Query Parameters</div><code class="mono">' + res.queryCount + ' param(s)</code></div>' +
          '</div>' +
        '</div>' +
        '<div style="margin-top:16px">' +
          '<h3 class="h-3" style="font-size:1.05rem">Heuristic Inspection Breakdown</h3>' +
          findingsHtml +
        '</div>';
    }

    if (input) {
      input.addEventListener('input', render);
    }

    root.querySelectorAll('[data-url-preset]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (input) {
          input.value = btn.getAttribute('data-url-preset');
          render();
        }
      });
    });

    if (input && !input.value) {
      input.value = 'https://login.microsoft.com-security-verify@m1crosoft-account-auth.zip/oauth2/authorize?redirect=https://evil.example/harvest';
      render();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
