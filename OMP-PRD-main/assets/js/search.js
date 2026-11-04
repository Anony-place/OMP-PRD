/* ============================================================
   OopsMyPassword — Global Search
   One search for everything: live articles (Supabase) + the
   tools registry, plus a baked-in index of site tools, guides
   and pages. Shortcut: Ctrl+K / Cmd+K or "/". 100% client-side
   lookups for static content; article/tool rows come from the
   public Supabase REST endpoint (read-only publishable key).
   ============================================================ */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://aeehfulikupskyrvcpzb.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_s3n2U32MNB4PvHx0GolyqA_wlkzD6eR';
  var CACHE_KEY = 'omp-search-live-v3';
  var CACHE_TTL = 10 * 60 * 1000; /* 10 minutes */
  var MAX_RESULTS = 12;

  /* ---------- Baked-in index: tools, guides, pages ---------- */
  var STATIC_INDEX = [
    /* Interactive tools */
    { type: 'Tool', title: 'Password Strength Checker', desc: 'Test how strong any password is — runs 100% in your browser.', url: '/checker', kw: 'strength test crack time checker zxcvbn weak' },
    { type: 'Tool', title: 'Password Generator', desc: 'Generate secure random passwords with a CSPRNG — 20-character default.', url: '/generator', kw: 'random secure create new password generator symbols numbers' },
    { type: 'Tool', title: 'Passphrase Generator', desc: 'Diceware-style passphrases from a 1296-word list.', url: '/passphrase', kw: 'diceware words memorable passphrase long easy to remember' },
    { type: 'Tool', title: 'Random String Generator', desc: 'Hex, Base64URL and alphanumeric strings for keys, tokens and IDs.', url: '/random-string', kw: 'hex base64 token api key uuid string random' },
    { type: 'Tool', title: 'Password Entropy Calculator', desc: 'Calculate entropy in bits, character pools and estimated crack times.', url: '/entropy', kw: 'bits pools crack time calculation entropy math' },
    { type: 'Tool', title: 'Password Health Check', desc: 'A 10-point local audit of your password habits — nothing leaves your device.', url: '/password-health', kw: 'audit habits reuse hygiene health checkup score' },
    { type: 'Tool', title: 'Breach Check (k-Anonymity Demo)', desc: 'See how breach lookups work with k-anonymity — SHA-1 hashed locally.', url: '/breach-check', kw: 'breach pwned leaked have i been k-anonymity sha1 hash demo' },
    { type: 'Tool', title: 'Security Checklist', desc: '16 habits for safer accounts, from 2FA to password manager setup.', url: '/security-checklist', kw: 'habits checklist 2fa safer accounts tips list' },
    { type: 'Tool', title: 'Google Dork & OSINT Query Builder', desc: 'Compose site:, filetype:, inurl:, intitle:, and intext: queries with 24 presets.', url: '/dork-builder', kw: 'google dork osint search query builder filetype inurl intitle shodan recon' },
    { type: 'Tool', title: 'Hash, JWT & Encoding Inspector', desc: 'Offline SHA-256/512 calculator, password hash identifier, JWT security auditor, and Base64 encoder.', url: '/hash-inspector', kw: 'hash sha256 sha512 argon2id bcrypt jwt decoder token base64 hex inspector' },
    { type: 'Tool', title: 'Phishing URL & Link Risk Scanner', desc: 'Detect IDN homograph punycode (xn--), @-authority tricks, and brand typosquatting locally.', url: '/url-scanner', kw: 'phishing url scanner link checker punycode homograph typosquatting safe' },

    /* Site pages */
    { type: 'Page', title: 'OopsMyPassword — Home', desc: 'Test, generate and learn password security — no account needed.', url: '/', kw: 'home start main free landing' },
    { type: 'Page', title: 'All Tools', desc: 'Every free, client-side tool on one page.', url: '/tools', kw: 'tools overview all list utilities' },
    { type: 'Page', title: 'Tool Comparisons Hub (VS)', desc: '12 head-to-head security, password manager, OSINT, and pentest tool comparisons.', url: '/compare', kw: 'compare vs comparison bitwarden 1password nmap masscan burp zap sherlock maigret' },
    { type: 'Page', title: 'CLI Cheat Sheets Hub', desc: '10 interactive, printable CLI cheat sheets for Nmap, ffuf, Wireshark, sqlmap, Linux PrivEsc, and AD.', url: '/cheatsheets', kw: 'cheatsheets cheat sheet cli commands nmap ffuf wireshark sqlmap linux active directory' },
    { type: 'Page', title: 'Articles', desc: 'Every read in one hub: security news, deep dives, how-tos and guides.', url: '/articles', kw: 'blog articles posts news updates guides learn tutorials help content hub' },
    { type: 'Product Page', title: 'Products', desc: 'Books, courses, tools and resources from OopsMyPassword.', url: '/products', kw: 'products shop store buy purchase book books course template resource pricing' },
    { type: 'Page', title: 'OSINT Hub', desc: 'OSINT tools by category — username, email, domain, phone, image and all-in-one — with install guides and official links.', url: '/osint', kw: 'osint hub investigation username email domain phone image sherlock holehe tools catalog' },
    { type: 'Page', title: 'Pentest Hub', desc: 'Pentest tools by phase — network scanning, web testing, password auditing, wireless, vuln scanning and frameworks. Authorized testing only.', url: '/pentest', kw: 'pentest hub penetration testing nmap burp metasploit hashcat tools kali authorized' },
    { type: 'Page', title: 'About OopsMyPassword', desc: 'Privacy-first password tools — the mission.', url: '/about', kw: 'about team mission privacy first who' },
    { type: 'Page', title: 'Contact', desc: 'Questions, feedback or bug reports.', url: '/contact', kw: 'contact email support feedback report' },
    { type: 'Page', title: 'FAQ', desc: 'Frequently asked questions, answered.', url: '/faq', kw: 'faq questions answers help common' },
    { type: 'Page', title: 'Security Glossary', desc: 'Thirty security, cryptography, web, and OSINT terms defined in depth.', url: '/glossary', kw: 'glossary terms definitions dictionary meaning' },
    { type: 'Page', title: 'Security & Responsible Disclosure', desc: 'How we protect the site and how to report a vulnerability.', url: '/security', kw: 'security disclosure report vulnerability cve responsible' },
    { type: 'Page', title: 'Privacy Policy', desc: 'What we collect (almost nothing) and why.', url: '/privacy', kw: 'privacy policy data collection cookies' },
    { type: 'Page', title: 'Terms of Use', desc: 'The legal bits of using OopsMyPassword.', url: '/terms', kw: 'terms of use legal conditions' },
    { type: 'Page', title: 'Sitemap', desc: 'Every page on the site, listed.', url: '/sitemap', kw: 'sitemap all pages list index' },

    /* Comparisons (/compare/<slug>) */
    { type: 'Comparison', title: 'Bitwarden vs 1Password', desc: 'Open-source vault vs 128-bit Secret Key architecture.', url: '/compare/bitwarden-vs-1password', kw: 'bitwarden 1password compare password manager vault' },
    { type: 'Comparison', title: 'Bitwarden vs Proton Pass', desc: 'Self-hostable vault vs Swiss privacy and SimpleLogin email aliases.', url: '/compare/bitwarden-vs-proton-pass', kw: 'bitwarden proton pass alias compare' },
    { type: 'Comparison', title: 'KeePassXC vs Bitwarden', desc: 'Local offline KDBX database vs zero-knowledge cloud sync.', url: '/compare/keepassxc-vs-bitwarden', kw: 'keepassxc bitwarden offline kdbx compare' },
    { type: 'Comparison', title: 'YubiKey vs Synced Passkeys', desc: 'Hardware FIDO2 security keys vs synced platform passkeys.', url: '/compare/yubikey-vs-passkeys', kw: 'yubikey passkey webauthn fido2 hardware key' },
    { type: 'Comparison', title: 'Nmap vs Masscan', desc: 'Deep service enumeration vs asynchronous high-speed port sweeping.', url: '/compare/nmap-vs-masscan', kw: 'nmap masscan port scanner network pentest' },
    { type: 'Comparison', title: 'Burp Suite vs OWASP ZAP', desc: 'Manual web pentesting proxy vs open-source CI/CD DAST scanner.', url: '/compare/burp-suite-vs-owasp-zap', kw: 'burp suite owasp zap web proxy pentest' },
    { type: 'Comparison', title: 'ffuf vs Gobuster', desc: 'Flexible web fuzzing with auto-calibration vs dedicated dir/dns modes.', url: '/compare/ffuf-vs-gobuster', kw: 'ffuf gobuster web fuzzing directory' },
    { type: 'Comparison', title: 'sqlmap vs Manual SQLi', desc: 'Automated SQL injection exploitation vs manual Burp Repeater testing.', url: '/compare/sqlmap-vs-manual-sqli', kw: 'sqlmap sqli sql injection manual' },
    { type: 'Comparison', title: 'Sherlock vs Maigret', desc: 'Fast CLI username checks vs deep profile metadata & HTML reports.', url: '/compare/sherlock-vs-maigret', kw: 'sherlock maigret username osint' },
    { type: 'Comparison', title: 'OWASP Amass vs Subfinder', desc: 'Comprehensive attack-surface graph vs fast passive subdomain discovery.', url: '/compare/amass-vs-subfinder', kw: 'amass subfinder subdomain recon osint' },
    { type: 'Comparison', title: 'Shodan vs Censys', desc: 'IoT/service banner search vs X.509 certificate transparency intelligence.', url: '/compare/shodan-vs-censys', kw: 'shodan censys exposure search certificate' },
    { type: 'Comparison', title: 'Wireshark vs tcpdump', desc: 'Graphical deep packet dissection vs headless server PCAP capture.', url: '/compare/wireshark-vs-tcpdump', kw: 'wireshark tcpdump pcap packet capture' },

    /* Cheat Sheets (/cheatsheets/<slug>) */
    { type: 'Cheat Sheet', title: 'Nmap Command Cheat Sheet', desc: 'Host discovery, SYN scan, NSE scripts, and output flags.', url: '/cheatsheets/nmap-command-cheatsheet', kw: 'nmap cheat sheet commands port scan nse' },
    { type: 'Cheat Sheet', title: 'Google Dorks OSINT Cheat Sheet', desc: 'Advanced search operators for exposed files, portals, and cloud buckets.', url: '/cheatsheets/google-dorks-osint-cheatsheet', kw: 'google dorks cheat sheet osint operators' },
    { type: 'Cheat Sheet', title: 'ffuf Web Fuzzing Cheat Sheet', desc: 'Directory, vhost, parameter, and authenticated fuzzing one-liners.', url: '/cheatsheets/ffuf-web-fuzzing-cheatsheet', kw: 'ffuf cheat sheet web fuzzing vhost' },
    { type: 'Cheat Sheet', title: 'Wireshark Display Filters Cheat Sheet', desc: 'HTTP, TLS SNI, DNS, TCP anomaly, and SMB hunting filters.', url: '/cheatsheets/wireshark-display-filters-cheatsheet', kw: 'wireshark display filters pcap tshark' },
    { type: 'Cheat Sheet', title: 'sqlmap Pentest Cheat Sheet', desc: 'Controlled Burp request testing, risk/level flags, and DBMS enumeration.', url: '/cheatsheets/sqlmap-pentest-cheatsheet', kw: 'sqlmap cheat sheet sqli database' },
    { type: 'Cheat Sheet', title: 'Linux Privilege Escalation Cheat Sheet', desc: 'Sudoers, SUID, capabilities, cron jobs, and local enumeration commands.', url: '/cheatsheets/linux-privilege-escalation-cheatsheet', kw: 'linux privilege escalation privesc suid getcap' },
    { type: 'Cheat Sheet', title: 'Active Directory Enumeration Cheat Sheet', desc: 'BloodHound, NetExec, Kerberoasting, AS-REP, and AD CS commands.', url: '/cheatsheets/active-directory-enumeration-cheatsheet', kw: 'active directory ad bloodhound kerberoasting' },
    { type: 'Cheat Sheet', title: 'Shodan Search Filters Cheat Sheet', desc: 'ASN, org, ssl.cert, http.favicon.hash, and exposed service filters.', url: '/cheatsheets/shodan-search-filters-cheatsheet', kw: 'shodan filters query cheat sheet' },
    { type: 'Cheat Sheet', title: 'HTTP Security Headers Cheat Sheet', desc: 'HSTS, CSP, X-Frame-Options, Referrer-Policy, and cookie flags.', url: '/cheatsheets/http-security-headers-cheatsheet', kw: 'http security headers csp hsts cors' },
    { type: 'Cheat Sheet', title: 'Incident Response First-Hour Cheat Sheet', desc: 'Volatile state capture, process/network triage, and host containment.', url: '/cheatsheets/incident-response-first-hour-cheatsheet', kw: 'incident response triage linux forensics' },

    /* Guides (/guides/) */
    { type: 'Guide', title: 'What to Do After a Data Breach', desc: 'Step-by-step response plan when a service you use gets breached.', url: '/articles/after-a-data-breach', kw: 'breach response steps stolen exposed what now' },
    { type: 'Guide', title: 'Is It Safe to Use a Password Manager?', desc: 'An honest risk breakdown of password manager safety.', url: '/articles/are-password-managers-safe', kw: 'risk honest safe vault manager worth it trust' },
    { type: 'Guide', title: 'How to Check If Your Password Has Been Leaked', desc: 'Check exposure safely without giving your password away.', url: '/articles/check-if-password-was-leaked', kw: 'leaked pwned check safely breach exposed' },
    { type: 'Guide', title: 'Common Password Mistakes (and How to Fix Them)', desc: 'The reuse, predictability and length errors people make most.', url: '/articles/common-password-mistakes', kw: 'reuse errors fix weak patterns mistakes' },
    { type: 'Guide', title: 'How to Create a Strong Password', desc: 'A practical recipe for passwords that resist cracking.', url: '/articles/create-strong-password', kw: 'create strong new secure recipe tips make' },
    { type: 'Guide', title: 'How Long Should a Password Be in 2026?', desc: 'Recommended lengths by account type — email, banking, social.', url: '/articles/how-long-should-a-password-be', kw: 'length characters account type email banking minimum' },
    { type: 'Guide', title: 'Passkeys Explained: Passwords Without the Password', desc: 'How passkeys work and why they beat passwords.', url: '/articles/passkeys-explained', kw: 'passkey fingerprint face unlock webauthn future no password' },
    { type: 'Guide', title: 'Password Security Best Practices', desc: 'The habits that actually move the security needle.', url: '/articles/password-best-practices', kw: 'best practices security hygiene habits guide' },
    { type: 'Guide', title: 'Password Cracking Time: How Long to Crack 8, 12 or 16 Characters?', desc: 'Cracking-time table by length and character set.', url: '/articles/password-cracking-time-table', kw: 'crack time 8 12 16 characters brute force table gpu' },
    { type: 'Guide', title: 'How Password Entropy Works', desc: 'Entropy explained: bits, pools and real-world randomness.', url: '/articles/password-entropy', kw: 'entropy bits randomness math pools explained' },
    { type: 'Guide', title: 'Password Manager Benefits — and How to Choose One', desc: 'What managers give you and how to pick a good one.', url: '/articles/password-manager-benefits', kw: 'choose vault benefits compare pick manager' },
    { type: 'Guide', title: 'Password vs Passkey: An Honest Comparison', desc: 'Where passkeys win, where passwords still linger.', url: '/articles/password-vs-passkey', kw: 'passkey comparison versus future authentication' },
    { type: 'Guide', title: 'Password vs Passphrase: Which Should You Actually Use?', desc: 'Length versus complexity — the practical answer.', url: '/articles/password-vs-passphrase', kw: 'passphrase which use comparison versus words' },
    { type: 'Guide', title: 'How Phishing Attacks Steal Passwords', desc: 'The anatomy of phishing and how to spot it.', url: '/articles/phishing-attacks', kw: 'phishing scam social engineering steal fake login' },
    { type: 'Guide', title: 'Two-Factor Authentication (2FA): What to Use and Why', desc: 'TOTP apps, hardware keys and SMS — ranked.', url: '/articles/two-factor-authentication', kw: '2fa otp authenticator totp sms hardware key mfa' },

    /* FAQ — individual questions resolve to /faq.html (kept in sync with
       tools/omp_build/pages_core.py FAQ_ITEMS). */
    { type: 'FAQ', title: 'Is OMP free?', desc: 'Yes — every tool is free, needs no account, and runs entirely in your browser.', url: '/faq', kw: 'free cost price pricing account' },
    { type: 'FAQ', title: 'Does OMP store my password?', desc: 'No. Passwords are analyzed in memory, in your tab only — never transmitted, stored, logged or placed in URLs.', url: '/faq', kw: 'store password history log saved privacy' },
    { type: 'FAQ', title: 'Does OMP require an account?', desc: 'No. There is deliberately no sign-up, login or user profile.', url: '/faq', kw: 'account login signup sign up register' },
    { type: 'FAQ', title: 'How is password strength calculated?', desc: 'A heuristic score of length, variety and pattern penalties, plus an adjusted entropy estimate and indicative crack time.', url: '/faq', kw: 'score calculated strength meter heuristic how' },
    { type: 'FAQ', title: 'Is the strength score guaranteed?', desc: 'No — no meter can prove a password is safe; treat scores as educational guidance.', url: '/faq', kw: 'guaranteed accurate reliable trust score' },
    { type: 'FAQ', title: 'What is entropy?', desc: 'Unpredictability in bits: H = L × log2(N). Each bit doubles the guesses an attacker needs.', url: '/faq', kw: 'entropy bits randomness math what is' },
    { type: 'FAQ', title: 'What is a password manager?', desc: 'An app that generates, encrypts and fills unique passwords per account, unlocked by one master passphrase.', url: '/faq', kw: 'manager vault app store passwords' },
    { type: 'FAQ', title: 'What are passkeys?', desc: 'A phishing-resistant password replacement based on public-key cryptography (FIDO2/WebAuthn).', url: '/faq', kw: 'passkey webauthn fido fingerprint face future' },
    { type: 'FAQ', title: 'Should I reuse passwords?', desc: 'Never — reuse is how one breach becomes the takeover of your other accounts (credential stuffing).', url: '/faq', kw: 'reuse same password accounts credential stuffing' },
    { type: 'FAQ', title: 'What should I do after a data breach?', desc: 'Change the breached password and every reuse, sign out sessions, enable 2FA, stay alert for phishing.', url: '/faq', kw: 'breach after compromised steps response' },

    /* Glossary — dedicated term pages (/glossary/<slug>) */
    { type: 'Glossary', title: 'k-Anonymity', desc: 'A privacy model mixing a lookup into a set of at least k possibilities so the server cannot tell what you searched.', url: '/glossary/k-anonymity', kw: 'k-anonymity privacy model lookup anonymity' },
    { type: 'Glossary', title: 'Argon2id', desc: 'Memory-hard password hashing function that resists GPU and ASIC cracking.', url: '/glossary/argon2id', kw: 'argon2id hash password memory hard' },
    { type: 'Glossary', title: 'Credential Stuffing', desc: 'Replaying leaked email/password pairs across services, betting on reuse.', url: '/glossary/credential-stuffing', kw: 'credential stuffing replay reused leaked' },
    { type: 'Glossary', title: 'Password Spraying', desc: 'Testing one common password across many accounts to avoid lockouts.', url: '/glossary/password-spraying', kw: 'password spraying lockout brute force' },
    { type: 'Glossary', title: 'Passkey (FIDO2 / WebAuthn)', desc: 'A phishing-resistant credential bound to a site genuine origin domain.', url: '/glossary/passkey-webauthn', kw: 'passkey webauthn fido phishing resistant' },
    { type: 'Glossary', title: 'TOTP (RFC 6238)', desc: 'Time-based one-time codes from authenticator apps, rotating every 30 seconds.', url: '/glossary/totp-rfc-6238', kw: 'totp otp authenticator time based app' },
    { type: 'Glossary', title: 'Browser-in-the-Browser (BitB)', desc: 'Fake HTML/CSS OAuth login popup rendered inside a webpage to spoof the URL bar.', url: '/glossary/browser-in-the-browser-bitb', kw: 'bitb browser in the browser phishing oauth' },
    { type: 'Glossary', title: 'IDOR (Insecure Direct Object Reference)', desc: 'Accessing another user record by modifying an object ID when server authorization is missing.', url: '/glossary/idor-insecure-direct-object-reference', kw: 'idor bola broken access control' },
    { type: 'Glossary', title: 'SSRF (Server-Side Request Forgery)', desc: 'Tricking a backend server into making HTTP requests to internal services or cloud metadata.', url: '/glossary/ssrf-server-side-request-forgery', kw: 'ssrf server side request forgery metadata' },
    { type: 'Glossary', title: 'XSS (Cross-Site Scripting)', desc: 'Injecting malicious JavaScript into a page viewed by other users.', url: '/glossary/xss-cross-site-scripting', kw: 'xss cross site scripting csp' },
    { type: 'Glossary', title: 'SQL Injection (SQLi)', desc: 'Altering backend database queries via unsanitized input.', url: '/glossary/sql-injection-sqli', kw: 'sqli sql injection prepared statements' },
    { type: 'Glossary', title: 'JWT (JSON Web Token)', desc: 'Signed Base64URL JSON token used for stateless API authentication.', url: '/glossary/jwt-json-web-token', kw: 'jwt json web token bearer' }
  ];

  /* ---------- Live index: Supabase articles + tools registry ---------- */

  /* Search rows are rendered straight into an href, and tool `route`
     values come from the database — so they are scheme-checked here.
     Anything that is not site-relative, an in-page anchor, or a URL on
     this site's own origin is dropped. */
  function safeResultUrl(value) {
    var v = String(value == null ? '' : value).trim();
    if (!v || /["'<>\\\u0000-\u0020]/.test(v)) return '';
    if (window.OMPUrl && window.OMPUrl.safeUrl) {
      var u = window.OMPUrl.safeUrl(v,
        { attrSafe: false, noProtocolRelative: true, noUpLevel: true, allowMailto: false, sameOriginOnly: true });
      if (u === null) return '';
      return String(u).replace(/\.html(?=$|[?#])/i, '');
    }
    if (/^(\/|#)/.test(v) && !/^\/\//.test(v)) return v;
    if (/^https?:\/\//i.test(v)) {
      try { if (new URL(v).origin === location.origin) return new URL(v).pathname + new URL(v).search + new URL(v).hash; }
      catch (e) { return ''; }
    }
    return '';
  }

  var livePromise = null;

  /* Hand-maintained STATIC_INDEX is only half the site. The other half is
     generated from the built HTML by scripts/build-search-index.mjs — without
     it, a visitor searching "curl" or "nikto" found nothing even though the
     page exists. Local JSON, so it resolves instantly and never blocks search. */
  var extraItems = [];
  var extraPromise = null;
  function fetchExtra() {
    if (extraPromise) return extraPromise;
    /* Wrapped because a browser without fetch() must still get a working
       search box — the hand-listed index is the floor, not the ceiling. */
    try { extraPromise = fetch('/assets/data/search-index.json', { credentials: 'same-origin' })
      .then(function (r) { return r && r.ok ? r.json() : null; })
      .then(function (doc) {
        var list = doc && Array.isArray(doc.items) ? doc.items : [];
        extraItems = list.filter(function (it) {
          return it && typeof it.title === 'string' && typeof it.url === 'string' && it.title;
        });
        return extraItems;
      })
      .catch(function () { return extraItems; }); /* search still works without it */
    } catch (e) {
      extraPromise = Promise.resolve(extraItems);
    }
    return extraPromise;
  }

  function buildItemsFromData(articlesList, toolsList, productsList, osintList, pentestList) {
    var items = [];
    var seen = {};
    STATIC_INDEX.forEach(function (it) { seen[normalizeUrl(it.url)] = 1; });

    (articlesList || []).forEach(function (a) {
      if (!a || !a.slug) return;
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(a.slug))) return;
      var url = '/articles/' + encodeURIComponent(a.slug);
      if (seen[normalizeUrl(url)]) return;
      seen[normalizeUrl(url)] = 1;
      items.push({ type: 'Article', title: a.title || a.slug, desc: a.summary || '', url: url, kw: '' });
    });
    (toolsList || []).forEach(function (t) {
      if (!t || !(t.slug || t.route)) return;
      var routed = String(t.route || '').replace(/\.html($|#)/, '$1');
      var raw = safeResultUrl(routed) || '/tools';
      if (seen[normalizeUrl(raw)]) return;
      seen[normalizeUrl(raw)] = 1;
      items.push({ type: 'Tool', title: t.name || t.slug, desc: t.description || '', url: raw, kw: '' });
    });
    (productsList || []).forEach(function (p) {
      if (!p || !p.slug) return;
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(p.slug))) return;
      var url = '/products/' + encodeURIComponent(p.slug);
      if (seen[normalizeUrl(url)]) return;
      seen[normalizeUrl(url)] = 1;
      items.push({ type: 'Product', title: p.name || p.slug, desc: p.summary || (p.product_type ? String(p.product_type) : ''), url: url, kw: String(p.product_type || '') });
    });
    (osintList || []).forEach(function (o) {
      if (!o || !o.slug) return;
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(o.slug))) return;
      var url = '/osint/' + encodeURIComponent(o.slug);
      if (seen[normalizeUrl(url)]) return;
      seen[normalizeUrl(url)] = 1;
      items.push({ type: 'OSINT tool', title: o.name || o.slug, desc: o.summary || '', url: url, kw: 'osint ' + String(o.pricing || '') });
    });
    (pentestList || []).forEach(function (o) {
      if (!o || !o.slug) return;
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(o.slug))) return;
      var url = '/pentest/' + encodeURIComponent(o.slug);
      if (seen[normalizeUrl(url)]) return;
      seen[normalizeUrl(url)] = 1;
      items.push({ type: 'Pentest tool', title: o.name || o.slug, desc: o.summary || '', url: url, kw: 'pentest ' + String(o.pricing || '') });
    });
    return items;
  }

  function fetchWithDeadline(url, headers, ms) {
    if (typeof AbortController === 'undefined') return fetch(url, { headers: headers });
    var ctrl = new AbortController();
    var t = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, ms || 2500);
    return fetch(url, { headers: headers, signal: ctrl.signal }).finally(function () { clearTimeout(t); });
  }

  function fetchLive() {
    if (livePromise) return livePromise;
    livePromise = new Promise(function (resolve) {
      try {
        var cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
        if (cached && cached.items && cached.items.length && Date.now() - cached.t < CACHE_TTL) {
          resolve(cached.items);
          return;
        }
      } catch (e) { /* storage unavailable */ }

      var qSnapshot = fetch('/assets/data/hubs-snapshot.json').then(function (r) { return r && r.ok ? r.json() : null; }).catch(function () { return null; });

      /* Resolve immediately with the local Hubs snapshot so search is instant (<20ms),
         then upgrade in background if Supabase responds within 2.5s. */
      Promise.all([qSnapshot]).then(function (localRes) {
        var snap = localRes[0] || {};
        var localItems = buildItemsFromData(
          snap.articles || [],
          [],
          snap.products || [],
          snap.osint || [],
          snap.pentest || []
        );
        if (localItems.length) {
          liveItems = localItems;
          if (overlay && !overlay.hidden) render();
        }
        resolve(localItems);

        var headers = { apikey: SUPABASE_KEY };
        var qA = SUPABASE_URL + '/rest/v1/articles?select=slug,title,summary&status=eq.published&order=published_at.desc.nullslast&limit=200';
        var qT = SUPABASE_URL + '/rest/v1/tools?select=slug,name,description,route&is_active=eq.true&limit=200';
        var qP = SUPABASE_URL + '/rest/v1/products?select=slug,name,summary,product_type&status=eq.published&order=sort_order.asc&limit=100';
        var qO = SUPABASE_URL + '/rest/v1/osint_tools?select=slug,name,summary,pricing&status=eq.published&order=sort_order.asc&limit=200';
        var qPT = SUPABASE_URL + '/rest/v1/pentest_tools?select=slug,name,summary,pricing&status=eq.published&order=sort_order.asc&limit=200';
        function safeJson(r) {
          if (!r || !r.ok) return Promise.resolve([]);
          return r.json().catch(function () { return []; });
        }
        Promise.all([
          fetchWithDeadline(qA, headers, 2500).then(safeJson).catch(function () { return []; }),
          fetchWithDeadline(qT, headers, 2500).then(safeJson).catch(function () { return []; }),
          fetchWithDeadline(qP, headers, 2500).then(safeJson).catch(function () { return []; }),
          fetchWithDeadline(qO, headers, 2500).then(safeJson).catch(function () { return []; }),
          fetchWithDeadline(qPT, headers, 2500).then(safeJson).catch(function () { return []; })
        ]).then(function (res) {
          var merged = buildItemsFromData(
            (res[0] && res[0].length) ? res[0] : (snap.articles || []),
            res[1] || [],
            (res[2] && res[2].length) ? res[2] : (snap.products || []),
            (res[3] && res[3].length) ? res[3] : (snap.osint || []),
            (res[4] && res[4].length) ? res[4] : (snap.pentest || [])
          );
          if (merged.length) {
            liveItems = merged;
            try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), items: merged })); } catch (e) {}
            if (overlay && !overlay.hidden) render();
          }
        });
      });
    });
    return livePromise;
  }

  function normalizeUrl(u) {
    var s = String(u || '').replace(/\.html(?=$|[?#])/i, '').replace(/\/+$/, '').toLowerCase();
    return s || '/';
  }

  /* ---------- Ranking ---------- */
  function scoreItem(item, q) {
    var t = (item.title || '').toLowerCase();
    var d = (item.desc || '').toLowerCase();
    var k = (item.kw || '').toLowerCase();
    var s = 0;
    if (t === q) s += 100;
    else if (t.indexOf(q) === 0) s += 60;
    else if (t.indexOf(q) !== -1) s += 40;
    if (k.indexOf(q) !== -1) s += 25;
    if (d.indexOf(q) !== -1) s += 10;
    if (s > 0 && t.split(' ').some(function (w) { return w.indexOf(q) === 0; })) s += 15; /* word-prefix bonus */
    return s;
  }

  function searchAll(q, live) {
    var pool = STATIC_INDEX.concat(extraItems, live || []);
    var scored = [];
    var seen = {};
    for (var i = 0; i < pool.length; i++) {
      var url = safeResultUrl(pool[i].url);
      if (!url) continue;                       /* never render an unsafe href */
      var key = normalizeUrl(url) + '|' + String(pool[i].title || '').toLowerCase();
      if (seen[key]) continue;                  /* static + live duplicates */
      var s = scoreItem(pool[i], q);
      if (s > 0) { seen[key] = 1; scored.push([s, pool[i]]); }
    }
    scored.sort(function (a, b) { return b[0] - a[0] || String(a[1].title).localeCompare(String(b[1].title)); });
    return scored.slice(0, MAX_RESULTS).map(function (p) { return p[1]; });
  }

  /* ---------- Styles (CSP: style-src allows 'unsafe-inline') ---------- */
  var CSS = ''
    + '.omp-search-trigger{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--border);background:var(--card);color:var(--muted);border-radius:999px;padding:7px 14px;font:inherit;font-size:13.5px;line-height:1;cursor:pointer;transition:color .15s var(--ease),border-color .15s var(--ease)}'
    + '.omp-search-trigger:hover{color:var(--text);border-color:var(--border-strong)}'
    + '.omp-search-trigger svg{width:14px;height:14px;flex:none}'
    + '.omp-search-trigger kbd{font:600 10.5px/1 var(--font-mono);color:var(--muted-2);border:1px solid var(--border);border-radius:5px;padding:3px 5px;background:var(--bg-soft)}'
    + '@media (max-width:860px){.omp-search-trigger kbd{display:none}.omp-search-trigger .omp-st-label{display:none}.omp-search-trigger{padding:8px 10px}}'
    + '.omp-search-overlay{position:fixed;inset:0;z-index:10000;display:flex;justify-content:center;align-items:flex-start;padding:12vh 16px 16px;background:rgba(2,6,23,.72);backdrop-filter:blur(4px)}'
    + '.omp-search-overlay[hidden]{display:none}'
    + '.omp-search-dialog{width:min(640px,100%);background:var(--surface);border:1px solid var(--border-strong);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);overflow:hidden;transform:translateY(6px);opacity:0;transition:transform .18s var(--ease),opacity .18s var(--ease)}'
    + '.omp-search-overlay.omp-open .omp-search-dialog{transform:none;opacity:1}'
    + '.omp-search-head{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--border)}'
    + '.omp-search-head svg{width:18px;height:18px;color:var(--muted);flex:none}'
    + '#omp-search-input{flex:1;background:transparent;border:0;outline:0;color:var(--text);font:inherit;font-size:16px;min-width:0}'
    + '#omp-search-input::placeholder{color:var(--muted-2)}'
    + '.omp-search-esc{font:600 10.5px/1 var(--font-mono);color:var(--muted-2);border:1px solid var(--border);border-radius:5px;padding:4px 6px;background:var(--bg-soft);flex:none}'
    + '.omp-search-results{list-style:none;margin:0;padding:6px;max-height:min(55vh,420px);overflow-y:auto}'
    + '.omp-search-results li{margin:0}'
    + '.omp-sr-row{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:var(--radius-sm);cursor:pointer;color:var(--text);text-decoration:none}'
    + '.omp-sr-row[data-active="1"]{background:var(--brand-grad-soft);box-shadow:inset 0 0 0 1px var(--border-strong)}'
    + '.omp-sr-badge{flex:none;font:700 10px/1 var(--font-sans);letter-spacing:.06em;text-transform:uppercase;padding:4px 8px;border-radius:999px}'
    + '.omp-sr-badge.b-article{color:#67E8F9;background:rgba(34,211,238,.12)}'
    + '.omp-sr-badge.b-tool{color:#A5B4FC;background:rgba(99,102,241,.14)}'
    + '.omp-sr-badge.b-guide{color:#C4B5FD;background:rgba(139,92,246,.14)}'
    + '.omp-sr-badge.b-lesson,.omp-sr-badge.b-course{color:#34D399;background:rgba(16,185,129,.14)}'
    + '.omp-sr-badge.b-product{color:#FDE68A;background:rgba(234,179,8,.14)}'
    + '.omp-sr-badge.b-productpage{color:#FCD34D;background:rgba(245,158,11,.12)}'
    + '.omp-sr-badge.b-page{color:var(--muted);background:rgba(148,163,184,.12)}'
    + '.omp-sr-badge.b-faq{color:#FDE68A;background:rgba(234,179,8,.14)}'
    + '.omp-sr-badge.b-glossary{color:#A7F3D0;background:rgba(16,185,129,.14)}'
    + '.omp-sr-main{min-width:0}'
    + '.omp-sr-title{font-size:14.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.omp-sr-title mark{background:rgba(34,211,238,.22);color:inherit;border-radius:3px;padding:0 1px}'
    + '.omp-sr-desc{font-size:12.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.omp-sr-empty{padding:26px 16px;text-align:center;color:var(--muted);font-size:14px}'
    + '.omp-sr-foot{display:flex;gap:14px;align-items:center;padding:9px 16px;border-top:1px solid var(--border);color:var(--muted-2);font-size:11.5px;flex-wrap:wrap}'
    + '.omp-sr-foot kbd{font:600 10px/1 var(--font-mono);border:1px solid var(--border);border-radius:4px;padding:2px 4px;background:var(--bg-soft)}'
    /* The mobile-menu button used to be styled entirely from an inline
       cssText and its <svg> had no width/height, so it rendered at the
       replaced-element default (~300x150) and blew the menu row open. */
    + '.mobile-search-btn{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;padding:14px 18px;background:var(--card);border:1px solid var(--border);border-radius:var(--radius-md,12px);color:var(--text);font:inherit;font-size:15px;font-weight:500;text-align:left;cursor:pointer;margin-bottom:12px}'
    + '.mobile-search-btn:hover{border-color:var(--border-strong);color:var(--text)}'
    + '.mobile-search-btn span{display:flex;align-items:center;gap:10px;min-width:0}'
    + '.mobile-search-btn svg{width:18px;height:18px;flex:none;color:var(--muted)}'
    + '.mobile-search-btn kbd{flex:none;font:600 10.5px/1 var(--font-mono);color:var(--muted-2);border:1px solid var(--border);border-radius:4px;padding:3px 5px;background:var(--bg-soft)}'
    + '.omp-search-trigger[aria-expanded="true"]{color:var(--text);border-color:var(--border-strong)}'
    + '@media (prefers-reduced-motion:reduce){.omp-search-dialog{transition:none}}';
  function injectStyles() {
    if (!document.getElementById('omp-search-css')) {
      var st = document.createElement('style');
      st.id = 'omp-search-css';
      st.textContent = CSS;
      document.head.appendChild(st);
    }
  }

  /* ---------- Runtime state ---------- */
  var overlay = null, input = null, listEl = null;
  var liveItems = [];
  var currentResults = [];
  var activeIdx = -1;
  var debounceTimer = null;
  var lastFocus = null;

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* Escape first, then wrap query matches in <mark> */
  function hi(text, q) {
    var t = escapeHtml(text);
    if (!q) return t;
    var re = new RegExp('(' + escapeHtml(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
    return t.replace(re, '<mark>$1</mark>');
  }

  function badgeClass(type) { return 'b-' + String(type || 'Page').toLowerCase(); }

  function rowHtml(item, idx, q) {
    var on = idx === activeIdx;
    return '<li role="option" id="omp-sr-opt-' + idx + '" aria-selected="' + on + '" data-idx="' + idx + '">' +
      '<a class="omp-sr-row" data-active="' + (on ? '1' : '0') + '" href="' + escapeHtml(safeResultUrl(item.url) || '#') + '">' +
      '<span class="omp-sr-badge ' + badgeClass(item.type) + '">' + escapeHtml(item.type) + '</span>' +
      '<span class="omp-sr-main"><span class="omp-sr-title">' + hi(item.title, q) + '</span>' +
      (item.desc ? '<span class="omp-sr-desc">' + hi(item.desc, q) + '</span>' : '') +
      '</span></a></li>';
  }

  function render() {
    if (!input || !listEl) return;
    var q = input.value.trim().toLowerCase();
    var results;
    if (q) {
      results = searchAll(q, liveItems);
    } else {
      /* No query yet: offer quick links so the dialog is useful immediately */
      results = STATIC_INDEX.filter(function (it) { return it.type === 'Page'; }).slice(0, 6);
    }
    currentResults = results;
    activeIdx = results.length ? 0 : -1;
    /* The visual highlight and the AT announcement must stay in sync. */
    input.setAttribute('aria-activedescendant', activeIdx >= 0 ? 'omp-sr-opt-' + activeIdx : '');
    input.setAttribute('aria-expanded', overlay.hidden ? 'false' : 'true');
    var live = overlay.querySelector('[data-search-live]');
    if (!results.length) {
      listEl.innerHTML = '<li class="omp-sr-empty">No matches for "' + escapeHtml(q) +
        '". Try "passphrase", "2fa" or "breach".</li>';
      if (live) live.textContent = 'No results';
      return;
    }
    listEl.innerHTML = results.map(function (it, i) { return rowHtml(it, i, q); }).join('');
    if (live) live.textContent = results.length + ' result' + (results.length === 1 ? '' : 's');
  }

  function setActive(idx) {
    var n = currentResults.length;
    if (!n) { activeIdx = -1; if (input) input.setAttribute('aria-activedescendant', ''); return; }
    activeIdx = ((idx % n) + n) % n;
    if (input) input.setAttribute('aria-activedescendant', 'omp-sr-opt-' + activeIdx);
    var rows = listEl.querySelectorAll('a.omp-sr-row');
    for (var i = 0; i < rows.length; i++) {
      var on = i === activeIdx;
      rows[i].setAttribute('data-active', on ? '1' : '0');
      if (rows[i].parentNode) rows[i].parentNode.setAttribute('aria-selected', on ? 'true' : 'false');
      if (on && rows[i].scrollIntoView) { try { rows[i].scrollIntoView({ block: 'nearest' }); } catch (e) { /* old browsers */ } }
    }
  }

  var TRIGGER_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>';

  /* While the modal is open the page behind it must not be reachable by
     screen readers or by Tab. aria-hidden is toggled only on elements
     that did not already carry it, so nothing is lost on restore. */
  var hiddenSiblings = [];
  var savedScrollLock = null;
  function setPageInert(on) {
    if (on) {
      hiddenSiblings = [];
      var kids = document.body.children;
      for (var i = 0; i < kids.length; i++) {
        var el = kids[i];
        if (el === overlay || el.tagName === 'SCRIPT' || el.tagName === 'STYLE') continue;
        if (el.hasAttribute('aria-hidden')) continue;
        el.setAttribute('aria-hidden', 'true');
        hiddenSiblings.push(el);
      }
    } else {
      hiddenSiblings.forEach(function (el) { el.removeAttribute('aria-hidden'); });
      hiddenSiblings = [];
    }
  }

  function setTriggerState(open) {
    ['omp-search-trigger', 'omp-search-mobile-trigger'].forEach(function (id) {
      var b = document.getElementById(id);
      if (b && b.hasAttribute('aria-expanded')) b.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    if (input) input.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function openSearch() {
    if (!overlay) return;
    lastFocus = document.activeElement;
    overlay.hidden = false;
    requestAnimationFrame(function () { if (overlay) overlay.classList.add('omp-open'); });
    savedScrollLock = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setPageInert(true);
    setTriggerState(true);
    input.value = '';
    render();
    input.focus();
    fetchExtra().then(function () {
      if (overlay && !overlay.hidden) render(); /* generated pages (compare/cheat sheets/glossary) */
    });
    fetchLive().then(function (items) {
      liveItems = items || [];
      if (overlay && !overlay.hidden) render(); /* re-render with fresh articles/tools */
    });
  }

  function closeSearch() {
    if (!overlay || overlay.hidden) return;
    overlay.classList.remove('omp-open');
    overlay.hidden = true;
    document.body.style.overflow = savedScrollLock == null ? '' : savedScrollLock;
    savedScrollLock = null;
    setPageInert(false);
    setTriggerState(false);
    if (input) input.setAttribute('aria-activedescendant', '');
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) { /* ignore */ } }
  }

  /* Keep Tab inside the dialog while it is open. */
  function trapFocus(e) {
    if (e.key !== 'Tab' || !overlay || overlay.hidden) return;
    var focusable = overlay.querySelectorAll('input, a[href], button:not([disabled])');
    if (!focusable.length) return;
    var first = focusable[0], last = focusable[focusable.length - 1];
    var active = document.activeElement;
    if (e.shiftKey && (active === first || !overlay.contains(active))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    else if (!overlay.contains(active)) { e.preventDefault(); first.focus(); }
  }

  function onGlobalKey(e) {
    var k = e.key;
    if ((e.ctrlKey || e.metaKey) && (k === 'k' || k === 'K')) {
      e.preventDefault();
      if (overlay && !overlay.hidden) closeSearch(); else openSearch();
      return;
    }
    if (k === 'Escape' && overlay && !overlay.hidden) { e.preventDefault(); closeSearch(); return; }
    if (overlay && !overlay.hidden) { trapFocus(e); return; }
    if (k === '/' && (!overlay || overlay.hidden)) {
      var t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      e.preventDefault();
      openSearch();
    }
  }

  function injectTrigger() {
    if (document.getElementById('omp-search-trigger')) return true;
    var nav = document.querySelector('header .nav-inner') || document.querySelector('.nav-inner');
    if (!nav) return false; /* page without site chrome (e.g. admin) — stay dormant */
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'omp-search-trigger';
    btn.className = 'omp-search-trigger';
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'omp-search-overlay');
    btn.setAttribute('aria-label', 'Search articles, tools and guides (Ctrl+K)');
    btn.innerHTML = TRIGGER_SVG + '<span class="omp-st-label">Search</span><kbd>Ctrl K</kbd>';
    btn.addEventListener('click', openSearch);
    /* Home is the first slot inside .nav-actions: that puts search left of
       the theme toggle and the "Get Started" CTA on desktop, and left of the
       hamburger on mobile, while inheriting the container's gap. Appending to
       .nav-inner instead would drop the button past the CTA — .btn-get-started
       is a child of .nav-actions, not of .nav-inner. */
    var actions = nav.querySelector('.nav-actions');
    if (actions) actions.insertBefore(btn, actions.firstChild);
    else {
      var anchor = nav.querySelector('.btn-get-started');
      if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(btn, anchor);
      else nav.appendChild(btn);
    }

    var mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenu && !document.getElementById('omp-search-mobile-trigger')) {
      var mBtn = document.createElement('button');
      mBtn.type = 'button';
      mBtn.id = 'omp-search-mobile-trigger';
      mBtn.className = 'mobile-search-btn';
      mBtn.setAttribute('aria-label', 'Search articles, tools and guides');
      mBtn.innerHTML = '<span>' + TRIGGER_SVG + 'Search site…</span><kbd>Ctrl K</kbd>';
      mBtn.addEventListener('click', function() {
        mobileMenu.classList.remove('open');
        document.body.classList.remove('nav-open');
        var navToggle = document.querySelector('[data-nav-toggle]');
        if (navToggle) {
          navToggle.setAttribute('aria-expanded', 'false');
          var mIcon = navToggle.querySelector('.icon-menu');
          var cIcon = navToggle.querySelector('.icon-close');
          if (mIcon) mIcon.style.display = '';
          if (cIcon) cIcon.style.display = 'none';
        }
        openSearch();
      });
      mobileMenu.insertBefore(mBtn, mobileMenu.firstChild);
    }

    return true;
  }

  function buildOverlay() {
    overlay = document.createElement('div');
    overlay.id = 'omp-search-overlay';
    overlay.className = 'omp-search-overlay';
    overlay.hidden = true;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Site search');
    overlay.innerHTML =
      '<div class="omp-search-dialog">' +
        '<div class="omp-search-head">' + TRIGGER_SVG +
          '<input id="omp-search-input" type="text" role="combobox" aria-expanded="false" aria-controls="omp-search-results" aria-autocomplete="list" aria-activedescendant="" placeholder="Search articles, tools & guides…" autocomplete="off" spellcheck="false" aria-label="Search">' +
          '<span class="omp-search-esc">esc</span>' +
        '</div>' +
        '<ul class="omp-search-results" id="omp-search-results" role="listbox" aria-label="Search results"></ul>' +
        '<p class="sr-only" role="status" aria-live="polite" data-search-live></p>' +
        '<div class="omp-sr-foot">' +
          '<span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>' +
          '<span><kbd>↵</kbd> open</span>' +
          '<span><kbd>esc</kbd> close</span>' +
        '</div>' +
      '</div>';
    input = overlay.querySelector('#omp-search-input');
    listEl = overlay.querySelector('.omp-search-results');
    overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) closeSearch(); });
    input.addEventListener('input', function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(render, 80);
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(activeIdx + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(activeIdx - 1); }
      else if (e.key === 'Enter') {
        var item = currentResults[activeIdx];
        if (item) { closeSearch(); window.location.assign(safeResultUrl(item.url) || '/'); }
      }
    });
    listEl.addEventListener('mouseover', function (e) {
      var li = e.target.closest ? e.target.closest('li[data-idx]') : null;
      if (li) setActive(parseInt(li.getAttribute('data-idx'), 10) || 0);
    });
    listEl.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('a.omp-sr-row')) closeSearch(); /* let navigation proceed */
    });
    document.body.appendChild(overlay);
  }

  function initSearch() {
    injectStyles();
    if (!injectTrigger()) return;
    buildOverlay();
    document.addEventListener('keydown', onGlobalKey);
    fetchExtra(); /* warm the generated index before the first Ctrl+K */
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initSearch);
  else initSearch();
})();


