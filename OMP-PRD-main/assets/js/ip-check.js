/* ip-check.js — OMP IP & Leak Check (/ip-check)
 *
 * Four independent, button-triggered sessions:
 *   1. Public IP        -> fetch speed.cloudflare.com/meta + api.ipify.org (cross-check)
 *   2. WebRTC leak      -> RTCPeerConnection candidate inspection (browser-only)
 *   3. DNS resolver     -> DNS-over-HTTPS TXT whoami via dns.google
 *   4. Privacy tells    -> local timezone/language vs the IP country from session 1
 *
 * Privacy rules for this file:
 *   - nothing runs on page load; every network call is user-triggered
 *   - all remote content is rendered with textContent/createElement, never innerHTML
 *   - failures are reported honestly, never faked
 */
(function () {
  'use strict';

  var state = { ip: null, country: null, city: null, org: null };

  function $(sel, root) { return (root || document).querySelector(sel); }

  function li(text, tone) {
    var el = document.createElement('li');
    el.textContent = text;
    if (tone) el.setAttribute('data-tone', tone);
    return el;
  }

  function fill(listEl, rows) {
    listEl.innerHTML = '';
    rows.forEach(function (r) { listEl.appendChild(li(r[0], r[1])); });
  }

  function busy(btn, on) {
    btn.disabled = !!on;
    btn.setAttribute('aria-busy', on ? 'true' : 'false');
  }

  function fail(statusEl, what, err) {
    statusEl.textContent = 'Could not reach ' + what + ' — offline, blocked by an extension, or the service is down. Nothing was faked: this check did not run.';
    if (err && window.console) { console.warn('[ip-check]', what, err); }
  }

  /* ---------------- 1 · Public IP ---------------- */
  function initIp(root) {
    var btn = $('[data-ip-run]', root);
    var box = $('[data-ip-box]', root);
    var status = $('[data-ip-status]', root);
    if (!btn) return;
    btn.addEventListener('click', function () {
      busy(btn, true);
      status.textContent = 'Contacting speed.cloudflare.com…';
      fetch('https://speed.cloudflare.com/meta', { cache: 'no-store' })
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (m) {
          state.ip = m.clientIp || null;
          state.country = m.country || null;
          state.city = m.city || null;
          state.org = m.asOrganization || null;
          $('[data-ip-addr]', root).textContent = state.ip || 'not returned';
          $('[data-ip-org]', root).textContent = (m.asOrganization ? m.asOrganization + (m.asn ? ' (AS' + m.asn + ')' : '') : 'not returned');
          $('[data-ip-geo]', root).textContent = [m.city, m.region, m.country].filter(Boolean).join(', ') || 'not returned';
          box.hidden = false;
          status.textContent = 'Now cross-checking with api.ipify.org…';
          return fetch('https://api.ipify.org/?format=json', { cache: 'no-store' })
            .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(function (j) {
              var second = j && j.ip ? j.ip : null;
              if (!second) {
                $('[data-ip-second]', root).textContent = 'no address returned';
              } else if (second === state.ip) {
                $('[data-ip-second]', root).textContent = 'agrees ✓';
              } else {
                $('[data-ip-second]', root).textContent = 'different: ' + second;
              }
              status.textContent = 'Done. Both services queried — results above.';
              busy(btn, false);
            })
            .catch(function (e) {
              $('[data-ip-second]', root).textContent = 'cross-check failed';
              status.textContent = 'Primary result shown; the api.ipify.org cross-check could not run.';
              busy(btn, false);
            });
        })
        .catch(function (e) {
          busy(btn, false);
          fail(status, 'speed.cloudflare.com', e);
        });
    });
  }

  /* ---------------- 2 · WebRTC leak ---------------- */
  function initRtc(root) {
    var btn = $('[data-rtc-run]', root);
    var out = $('[data-rtc-out]', root);
    var status = $('[data-rtc-status]', root);
    if (!btn) return;
    btn.addEventListener('click', function () {
      busy(btn, true);
      fill(out, [['Gathering ICE candidates (about 3 seconds)…', null]]);
      status.textContent = 'Opening a browser-only peer connection. No page request is made.';
      var host = [], srflx = [], mdns = 0, other = [];
      var pc = null;
      try {
        pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      } catch (e) {
        busy(btn, false);
        fill(out, [['WebRTC is not available in this browser — nothing to check.', 'warn']]);
        return;
      }
      pc.createDataChannel('omp-leak-check');
      pc.onicecandidate = function (ev) {
        if (!ev.candidate || !ev.candidate.candidate) return;
        var parts = ev.candidate.candidate.split(' ');
        var addr = parts[4] || '';
        var type = parts[7] || '';
        if (!addr) return;
        if (/\.local$/.test(addr)) { mdns += 1; return; }
        if (type === 'srflx') { if (srflx.indexOf(addr) === -1) srflx.push(addr); }
        else if (type === 'host') { if (host.indexOf(addr) === -1) host.push(addr); }
        else if (addr && other.indexOf(addr) === -1) { other.push(addr); }
      };
      pc.createOffer().then(function (o) { return pc.setLocalDescription(o); }).catch(function () {});
      setTimeout(function () {
        try { pc.close(); } catch (e) {}
        var rows = [];
        if (host.length) {
          rows.push(['Local (host) addresses a site could read: ' + host.join(', '), 'warn']);
        } else if (mdns) {
          rows.push(['Local addresses hidden behind mDNS aliases — your browser is protecting them ✓', 'ok']);
        } else {
          rows.push(['No local addresses exposed ✓', 'ok']);
        }
        if (srflx.length) {
          var viaTunnel = state.ip && srflx.indexOf(state.ip) !== -1;
          rows.push(['Public address(es) seen via STUN: ' + srflx.join(', '), 'warn']);
          rows.push(viaTunnel
            ? ['They match the public IP from session 1 — consistent with your current connection ✓', 'ok']
            : ['They differ from session 1' + (state.ip ? ' (' + state.ip + ')' : '') + ' — if you use a VPN, this may be a WebRTC leak.', 'warn']);
        } else {
          rows.push(['No public address leaked through STUN ✓', 'ok']);
        }
        if (other.length) rows.push(['Other candidate addresses: ' + other.join(', '), null]);
        fill(out, rows);
        status.textContent = 'Done. This check ran entirely in your browser.';
        busy(btn, false);
      }, 3000);
    });
  }

  /* ---------------- 3 · DNS resolver ---------------- */
  function initDns(root) {
    var btn = $('[data-dns-run]', root);
    var out = $('[data-dns-out]', root);
    var status = $('[data-dns-status]', root);
    if (!btn) return;
    btn.addEventListener('click', function () {
      busy(btn, true);
      status.textContent = 'One DNS-over-HTTPS query to dns.google…';
      fetch('https://dns.google/resolve?name=whoami.ds.akahelp.net&type=TXT', { cache: 'no-store' })
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (j) {
          var data = (j && j.Answer ? j.Answer : []).map(function (a) { return a.data || ''; });
          var ip = '', ecs = '', ns = '';
          data.forEach(function (d) {
            if (d.indexOf('ip') === 0) ip = d.slice(2);
            else if (d.indexOf('ecs') === 0) ecs = d.slice(3);
            else if (d.indexOf('ns') === 0) ns = d.slice(2);
          });
          var rows = [];
          if (ip) rows.push(['Your DNS lookups leave via resolver address: ' + ip, null]);
          if (ecs) rows.push(['Your resolver forwards an EDNS client subnet: ' + ecs, 'warn']);
          else rows.push(['No EDNS client subnet is forwarded about you ✓', 'ok']);
          if (ns) rows.push(['Seen by the authoritative nameserver as: ' + ns, null]);
          rows.push(['With a VPN on, these addresses should belong to the VPN provider. If they match your ISP instead, your DNS is leaking.', null]);
          if (state.ip) rows.push(['Session 1 saw your public IP as ' + state.ip + (state.org ? ' (' + state.org + ')' : '') + ' — compare the two.', null]);
          fill(out, rows);
          status.textContent = 'Done. One query, no logs kept by this page.';
          busy(btn, false);
        })
        .catch(function (e) {
          busy(btn, false);
          fail(status, 'dns.google', e);
        });
    });
  }

  /* ---------------- 4 · Privacy tells ---------------- */
  function initTells(root) {
    var btn = $('[data-tell-run]', root);
    var out = $('[data-tell-out]', root);
    var status = $('[data-tell-status]', root);
    if (!btn) return;
    btn.addEventListener('click', function () {
      var rows = [];
      try {
        var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown';
        rows.push(['Browser timezone: ' + tz, null]);
      } catch (e) { rows.push(['Browser timezone: not exposed', null]); }
      var langs = (navigator.languages && navigator.languages.length ? navigator.languages.join(', ') : navigator.language) || 'unknown';
      rows.push(['Browser languages: ' + langs, null]);
      if (state.country) {
        var tz2 = '';
        try { tz2 = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
        var tzCountry = tz2 ? tz2.split('/')[0] : '';
        var tzHints = {
          Asia: ['IN', 'SG', 'JP', 'CN', 'ID', 'PK', 'BD', 'AE', 'IL', 'KR', 'TH', 'VN', 'MY', 'PH', 'TR', 'SA'],
          Europe: ['GB', 'DE', 'FR', 'NL', 'ES', 'IT', 'PL', 'SE', 'NO', 'FI', 'CH', 'AT', 'BE', 'CZ', 'RO', 'PT', 'IE', 'DK', 'GR', 'UA', 'RU'],
          America: ['US', 'CA', 'BR', 'MX', 'AR', 'CO', 'CL', 'PE'],
          Africa: ['NG', 'ZA', 'EG', 'KE', 'MA'],
          Australia: ['AU', 'NZ'],
          Atlantic: ['IS'],
          Indian: ['MV', 'RE'],
          Pacific: ['FJ']
        };
        var hintMatch = tzHints[tzCountry] && tzHints[tzCountry].indexOf(state.country) !== -1;
        var sameRegion = tzCountry && state.country && (tzHints[tzCountry] || []).indexOf(state.country) !== -1;
        if (tz2 && tz2.indexOf(state.country) !== -1) {
          rows.push(['Timezone ' + tz2 + ' matches the IP country ' + state.country + ' ✓', 'ok']);
        } else if (sameRegion) {
          rows.push(['Timezone ' + tz2 + ' and IP country ' + state.country + ' share a region — usually fine ✓', 'ok']);
        } else {
          rows.push(['Timezone ' + tz2 + ' does not match the IP country ' + state.country + ' — a classic VPN/proxy tell.', 'warn']);
        }
        rows.push(['IP city from session 1: ' + (state.city || 'not returned') + ' — big-city IPs with rural expectations are another fingerprint.', null]);
      } else {
        rows.push(['Run session 1 (Show my IP) first and this adds the timezone-vs-country comparison.', null]);
      }
      if (navigator.doNotTrack === '1') rows.push(['Do Not Track is on ✓', 'ok']);
      fill(out, rows);
      status.textContent = 'Done. All of this was computed locally.';
    });
  }

  document.querySelectorAll('.card').forEach(function (card) {
    initIp(card);
    initRtc(card);
    initDns(card);
    initTells(card);
  });
})();
