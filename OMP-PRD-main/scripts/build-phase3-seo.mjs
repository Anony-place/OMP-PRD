#!/usr/bin/env node
/* ============================================================
   OopsMyPassword — Phase 3 SEO, Programmatic Content & Tools Builder
   Generates:
   1. 3 New Interactive Security Tools (/dork-builder, /hash-inspector, /url-scanner)
   2. 12 Programmatic VS Comparison Pages (/compare + /compare/<slug>)
   3. 10 Printable CLI & Defensive Security Cheat Sheets (/cheatsheets + /cheatsheets/<slug>)
   4. 30 Dedicated Cybersecurity & OSINT Glossary Pages (/glossary + /glossary/<slug>)
   5. Automated FAQPage JSON-LD & Cross-Pillar Internal Link Mesh across Articles & Tools
   6. /rss.xml, /llms.txt, /llms-full.txt, /sitemap.html, /sitemap.xml, /google-sitemap.xml
   ============================================================ */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://oopsmypassword.web.app';
const OG_IMG = `${SITE}/assets/images/og-image.jpg`;

function esc(v) {
  return String(v ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escJson(v) {
  return JSON.stringify(v ?? '')
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026');
}

function clampTitle(raw, suffix = 'OopsMyPassword') {
  const clean = String(raw || '').trim();
  const full = `${clean} | ${suffix}`;
  if (full.length <= 65) return full;
  if (clean.length <= 65) return clean;
  return clean.slice(0, 62).replace(/\s+\S*$/, '') + '…';
}

function clampDesc(raw) {
  const clean = String(raw || '').replace(/\s+/g, ' ').trim();
  if (clean.length >= 45 && clean.length <= 158) return clean;
  if (clean.length > 158) {
    return clean.slice(0, 154).replace(/\s+\S*$/, '').replace(/[.,;:!-]+$/, '') + '.';
  }
  return (clean + ' Free, client-side cybersecurity reference on OopsMyPassword.').slice(0, 158);
}

const ICON_ARROW = '<svg class="icon-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>';

function siteHeader(active = '') {
  const nav = [
    ['Home', '/'],
    ['Checker', '/checker'],
    ['Tools', '/tools'],
    ['Academy', '/learning'],
    ['OSINT Hub', '/osint'],
    ['Pentest Hub', '/pentest'],
    ['Articles', '/articles'],
    ['Products', '/products']
  ];
  return `<a class="skip-link" href="#main">Skip to content</a><header class="site-nav"><div class="container nav-inner"><a class="brand" href="/" aria-label="OopsMyPassword — home"><svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"><defs><linearGradient id="omp-lg-h" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8B5CF6"/><stop offset="1" stop-color="#6366F1"/></linearGradient></defs><path d="M15 1.8 26.4 6v8.2c0 6.6-4.4 11.1-11.4 12.9C8 25.3 3.6 20.8 3.6 14.2V6Z" fill="url(#omp-lg-h)"/><circle cx="10.4" cy="14.2" r="1.9" fill="#fff"/><circle cx="15" cy="14.2" r="1.9" fill="#fff"/><circle cx="19.6" cy="14.2" r="1.9" fill="#fff"/></svg><span>Oops<span class="grad-text">MyPassword</span></span></a><nav class="nav-links" aria-label="Primary">${nav.map(([name, url]) => `<a href="${url}"${active === url ? ' aria-current="page"' : ''}>${esc(name)}</a>`).join('')}</nav><div class="nav-actions"><button class="icon-btn" type="button" data-theme-toggle aria-label="Toggle color theme" title="Toggle theme"><span class="theme-icon-moon"><svg class="icon-18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg></span><span class="theme-icon-sun"><svg class="icon-18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="M4.9 4.9 6.3 6.3"/><path d="M17.7 17.7 19.1 19.1"/><path d="M2 12h2"/><path d="M20 12h2"/></svg></span></button><a class="btn btn-primary btn-sm btn-get-started" href="/#checker">Get Started</a><button class="icon-btn nav-toggle" type="button" data-nav-toggle aria-label="Open menu" aria-expanded="false" aria-controls="mobile-menu"><span class="icon-menu"><svg class="icon-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/></svg></span><span class="icon-close"><svg class="icon-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></span></button></div></div></header>`;
}

function siteMobileMenu(active = '') {
  const items = [
    ['Home', '/'],
    ['Checker', '/checker'],
    ['Tools', '/tools'],
    ['Academy', '/learning'],
    ['OSINT Hub', '/osint'],
    ['Pentest Hub', '/pentest'],
    ['Comparisons', '/compare'],
    ['Cheat Sheets', '/cheatsheets'],
    ['Glossary', '/glossary'],
    ['Articles', '/articles'],
    ['Products', '/products'],
    ['Dork Builder', '/dork-builder'],
    ['Hash & JWT Inspector', '/hash-inspector'],
    ['URL Risk Scanner', '/url-scanner'],
    ['Generator', '/generator'],
    ['Breach Check', '/breach-check'],
    ['About', '/about'],
    ['Privacy Policy', '/privacy'],
    ['Contact', '/contact']
  ];
  return `<nav class="mobile-menu" id="mobile-menu" aria-label="Mobile">${items.map(([name, url]) => `<a href="${url}"${active === url ? ' aria-current="page"' : ''}>${esc(name)}${ICON_ARROW}</a>`).join('')}<a class="btn btn-primary btn-lg" href="/#checker">Check Your Password</a></nav>`;
}

const UPDATED_FOOTER = `<footer class="site-footer">
  <div class="container">
    <div class="footer-grid">
      <div class="footer-brand">
        <a class="brand" href="/" aria-label="OopsMyPassword — home"><svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"><defs><linearGradient id="omp-lg-f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8B5CF6"/><stop offset="1" stop-color="#6366F1"/></linearGradient></defs><path d="M15 1.8 26.4 6v8.2c0 6.6-4.4 11.1-11.4 12.9C8 25.3 3.6 20.8 3.6 14.2V6Z" fill="url(#omp-lg-f)"/><circle cx="10.4" cy="14.2" r="1.9" fill="#fff"/><circle cx="15" cy="14.2" r="1.9" fill="#fff"/><circle cx="19.6" cy="14.2" r="1.9" fill="#fff"/></svg><span>Oops<span class="grad-text">MyPassword</span></span></a>
        <p>Privacy-first tools and structured learning. Password inputs stay in memory; Academy progress stays on your device. No learner login. The site collects no email addresses.</p>
        <div class="tag-list mt-16">
          <span class="chip"><svg class="icon-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2.5"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg> Client-side</span>
          <span class="chip"><svg class="icon-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m17 8 5 5"/><path d="m22 8-5 5"/></svg> No account</span>
        </div>
        <div class="footer-connect mt-16">
          <div class="footer-col-title">Connect</div>
          <div class="footer-connect-links">
            <a href="https://www.instagram.com/oopssecurity/" target="_blank" rel="noopener noreferrer">Instagram</a>
            <a href="mailto:baishyasuraj51@gmail.com">Admin &amp; Founder</a>
          </div>
        </div>
      </div>
      <div class="footer-col"><div class="footer-col-title">Tools</div><ul><li><a href="/checker">Password Checker</a></li><li><a href="/generator">Password Generator</a></li><li><a href="/breach-check">Breach Check</a></li><li><a href="/dork-builder">OSINT Dork Builder</a></li><li><a href="/hash-inspector">Hash &amp; JWT Inspector</a></li><li><a href="/url-scanner">Phishing URL Scanner</a></li><li><a href="/tools">All Tools</a></li></ul></div><div class="footer-col"><div class="footer-col-title">Resources</div><ul><li><a href="/articles">Articles</a></li><li><a href="/compare">Tool Comparisons</a></li><li><a href="/cheatsheets">CLI Cheat Sheets</a></li><li><a href="/glossary">Security Glossary</a></li><li><a href="/osint">OSINT Hub</a></li><li><a href="/pentest">Pentest Hub</a></li><li><a href="/products">Products</a></li></ul></div><div class="footer-col"><div class="footer-col-title">Academy</div><ul><li><a href="/learning">Academy home</a></li><li><a href="/learning/roadmap">Learning paths</a></li><li><a href="/learning/cyber-security">Cyber Security</a></li><li><a href="/learning/web-application-security">Web App Security</a></li><li><a href="/security-checklist">Security Checklist</a></li><li><a href="/faq">FAQ</a></li></ul></div><div class="footer-col"><div class="footer-col-title">Company</div><ul><li><a href="/about">About</a></li><li><a href="/privacy">Privacy</a></li><li><a href="/terms">Terms</a></li><li><a href="/contact">Contact</a></li><li><a href="/rss.xml">RSS Feed</a></li><li><a href="/llms.txt">LLMs.txt</a></li></ul></div>
    </div>
    <div class="footer-bottom">
      <span>© <span data-year>2026</span> OopsMyPassword. Educational security tools.</span>
      <span class="flex gap-16 wrap">
        <a href="/security">Security</a>
        <a href="/sitemap">Sitemap</a>
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
      </span>
    </div>
  </div>
</footer>`;

function pageTemplate({ title, description, route, activeNav = '/tools', ogType = 'website', jsonld = [], bodyHtml, scripts = [] }) {
  const canonical = `${SITE}${route === '/' ? '/' : route}`;
  const fullTitle = clampTitle(title);
  const fullDesc = clampDesc(description);
  const scriptTags = ['/assets/js/url.js', '/assets/js/main.js', ...scripts]
    .map((s) => `<script src="${esc(s)}" defer></script>`)
    .join('');
  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(fullTitle)}</title>
  <meta name="description" content="${esc(fullDesc)}">
  <meta name="google-site-verification" content="ilff-p9F52ymQPjAUhrWXMh2zidY67vxMIp0QskcbfY" />
  <link rel="canonical" href="${esc(canonical)}">
  <link rel="alternate" type="application/rss+xml" title="OopsMyPassword Security Feed" href="${SITE}/rss.xml">
  <meta name="application-name" content="OopsMyPassword">
  <meta name="theme-color" content="#F6F8FC">
  <meta name="color-scheme" content="light dark">
  <meta property="og:type" content="${esc(ogType)}">
  <meta property="og:site_name" content="OopsMyPassword">
  <meta property="og:title" content="${esc(fullTitle)}">
  <meta property="og:description" content="${esc(fullDesc)}">
  <meta property="og:url" content="${esc(canonical)}">
  <meta property="og:image" content="${OG_IMG}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(fullTitle)}">
  <meta name="twitter:description" content="${esc(fullDesc)}">
  <meta name="twitter:image" content="${OG_IMG}">
  <link rel="icon" href="/assets/icons/favicon.svg" type="image/svg+xml">
  <link rel="icon" href="/assets/icons/favicon-32.png" type="image/png" sizes="32x32">
  <link rel="apple-touch-icon" href="/assets/icons/apple-touch-icon.png">
  <link rel="manifest" href="/manifest.webmanifest">
  <link rel="stylesheet" href="/assets/css/styles.css">
  <script src="/assets/js/theme-init.js"></script>
  ${jsonld.map((x) => `<script type="application/ld+json">${escJson(x)}</script>`).join('\n  ')}
</head>
<body>
${siteHeader(activeNav)}
${siteMobileMenu(activeNav)}
<main id="main">
${bodyHtml}
</main>
${UPDATED_FOOTER}
${scriptTags}
</body>
</html>
`;
}

/* ============================================================
   DATA: 12 Programmatic VS Tool Comparisons
   ============================================================ */
export const COMPARISONS = [
  {
    slug: 'bitwarden-vs-1password',
    title: 'Bitwarden vs 1Password: Security & Vault Comparison',
    shortTitle: 'Bitwarden vs 1Password',
    category: 'Password Managers',
    toolA: 'Bitwarden',
    toolB: '1Password',
    summary: 'Head-to-head comparison of Bitwarden and 1Password across encryption architecture, Secret Key defense, open-source auditing, self-hosting, and pricing.',
    verdictA: 'Best for open-source transparency, self-hosting (Vaultwarden/Docker), and full-featured free tier.',
    verdictB: 'Best for polished UX, extra 128-bit Secret Key defense against vault breaches, and family/enterprise travel mode.',
    rows: [
      ['Source Code Model', 'Open-source (AGPLv3 / GPLv3), publicly auditable on GitHub', 'Proprietary client & server code with published third-party audits'],
      ['Vault Encryption', 'AES-256-CBC + PBKDF2-SHA256 (600,000 iterations) or Argon2id', 'AES-256-GCM + PBKDF2 + 128-bit local Secret Key (2SKD)'],
      ['Self-Hosting Option', 'Yes — official Docker deployment and community Vaultwarden', 'No — cloud-hosted on 1Password infrastructure only'],
      ['Free Tier', 'Unlimited passwords & devices + built-in passkey storage', '14-day trial only; paid subscription required'],
      ['Passkey & FIDO2 Support', 'Full WebAuthn passkey vault & hardware security key unlock', 'Full passkey vault, SSH agent integration, and Watchtower alerts'],
      ['CLI & Developer Workflow', 'Bitwarden CLI (bw) + Secrets Manager for CI/CD', '1Password CLI (op) + biometric SSH key agent & .env injection']
    ],
    workflowA: '# Authenticate & fetch a secret with Bitwarden CLI\nbw login\nexport BW_SESSION=$(bw unlock --raw)\nbw get password "production-db"',
    workflowB: '# Inject secrets at runtime with 1Password CLI\nop signin\nop run --env-file="./.env.tpl" -- npm start\nop read "op://Prod/Database/password"',
    faqs: [
      { q: 'Why does 1Password use a Secret Key in addition to a Master Password?', a: '1Password combines your Master Password with a randomly generated 128-bit Secret Key stored only on your devices. Even if encrypted vault blobs were stolen from 1Password servers, an attacker cannot brute-force a weak master password without the 128-bit Secret Key.' },
      { q: 'Can Bitwarden match 1Password crack resistance?', a: 'Yes, if you switch Bitwarden key derivation to Argon2id in your security settings and use a 5-word Diceware passphrase (64+ bits of entropy) as your master password.' }
    ],
    relatedLinks: [
      { label: 'Passphrase Generator', url: '/passphrase' },
      { label: 'Password Entropy Calculator', url: '/entropy' },
      { label: 'Are Password Managers Safe?', url: '/articles/are-password-managers-safe' }
    ]
  },
  {
    slug: 'bitwarden-vs-proton-pass',
    title: 'Bitwarden vs Proton Pass: Privacy & Encryption Guide',
    shortTitle: 'Bitwarden vs Proton Pass',
    category: 'Password Managers',
    toolA: 'Bitwarden',
    toolB: 'Proton Pass',
    summary: 'Compare Bitwarden and Proton Pass across end-to-end metadata encryption, hide-my-email aliases, Argon2id key derivation, and Swiss privacy laws.',
    verdictA: 'Best for cross-platform maturity, self-hosting flexibility, and enterprise compliance.',
    verdictB: 'Best for integrated Hide-My-Email aliases, full vault metadata encryption (including URLs), and Proton ecosystem users.',
    rows: [
      ['Jurisdiction', 'United States (Santa Barbara, CA)', 'Switzerland (Geneva — Swiss Federal Data Protection Act)'],
      ['Encrypted Vault Fields', 'Encrypts item names, usernames, passwords, URIs, and notes', 'End-to-end encrypts all fields including favicons and metadata'],
      ['Key Derivation', 'Argon2id or PBKDF2-SHA256 (600,000+ rounds)', 'bcrypt + SRP (Secure Remote Password) zero-knowledge auth'],
      ['Built-in Email Aliases', 'Integrates with SimpleLogin, AnonAddy, DuckDuckGo, Fastmail via API', 'Native unlimited SimpleLogin email aliases built into the vault UI'],
      ['Self-Hosting', 'Supported via official Docker image', 'Cloud-hosted by Proton AG only'],
      ['Open Source', '100% open-source clients and server', 'Open-source clients; audited by Cure53']
    ],
    workflowA: '# Export encrypted JSON backup via Bitwarden CLI\nbw export --format encrypted_json --output ./bw-backup.json',
    workflowB: '# Proton Pass CLI / alias workflow\n# Create unique SimpleLogin alias per service inside Proton Pass extension\npass-cli item list --vault "Personal"',
    faqs: [
      { q: 'Which password manager is better for stopping email tracking and breaches?', a: 'Proton Pass includes native hide-my-email aliases powered by SimpleLogin, letting you generate a unique email address AND unique password for every signup so breaches cannot correlate your identity.' },
      { q: 'Are both Bitwarden and Proton Pass open source?', a: 'Yes, both publish their client applications under open-source licenses and commission independent cryptographic audits.' }
    ],
    relatedLinks: [
      { label: 'Password Generator', url: '/generator' },
      { label: 'Breach Check Demo', url: '/breach-check' },
      { label: 'Password Manager Benefits', url: '/articles/password-manager-benefits' }
    ]
  },
  {
    slug: 'keepassxc-vs-bitwarden',
    title: 'KeePassXC vs Bitwarden: Offline Vault vs Cloud Sync',
    shortTitle: 'KeePassXC vs Bitwarden',
    category: 'Password Managers',
    toolA: 'KeePassXC',
    toolB: 'Bitwarden',
    summary: 'Should you store passwords in a local offline KDBX 4.1 file with KeePassXC or a zero-knowledge cloud vault with Bitwarden? Threat model comparison.',
    verdictA: 'Best for air-gapped security, zero cloud attack surface, hardware key challenge-response, and local KDBX file ownership.',
    verdictB: 'Best for seamless multi-device synchronization, family sharing, and effortless mobile autofill.',
    rows: [
      ['Storage Architecture', 'Local offline .kdbx file (sync optional via Syncthing/Nextcloud)', 'Cloud-hosted encrypted vault (or self-hosted server)'],
      ['Encryption & KDF', 'AES-256 / ChaCha20 + Argon2d/Argon2id', 'AES-256-CBC + Argon2id / PBKDF2-SHA256'],
      ['Hardware Key Binding', 'YubiKey HMAC-SHA1 challenge-response & keyfile', 'FIDO2 WebAuthn 2FA for cloud login'],
      ['Cloud Attack Surface', 'Zero — no central vendor server exists to breach', 'Encrypted cloud vault protected by zero-knowledge auth'],
      ['Browser Integration', 'Native messaging proxy to desktop app', 'Standalone browser extension across all platforms'],
      ['SSH Agent Support', 'Built-in cross-platform SSH key agent', 'Built-in SSH agent (2025+ desktop client)']
    ],
    workflowA: '# Inspect or query a local KDBX database with keepassxc-cli\nkeepassxc-cli db-info ./vault.kdbx\nkeepassxc-cli show -a Password ./vault.kdbx "Servers/Prod"',
    workflowB: '# Sync and query cloud vault with Bitwarden CLI\nbw sync\nbw get item "Servers/Prod" | jq .login.password',
    faqs: [
      { q: 'Is KeePassXC safer than cloud password managers?', a: 'KeePassXC eliminates cloud server breaches entirely because your encrypted .kdbx database never sits on a vendor server. However, you are responsible for maintaining 3-2-1 backups of your .kdbx file so device loss does not lock you out.' },
      { q: 'Can I use a keyfile with KeePassXC?', a: 'Yes. Combining a strong master passphrase with a local keyfile or YubiKey challenge-response ensures that even if your KDBX file is copied from cloud storage, it cannot be opened without your physical key.' }
    ],
    relatedLinks: [
      { label: 'Hash & JWT Inspector', url: '/hash-inspector' },
      { label: 'Password Entropy Calculator', url: '/entropy' },
      { label: '3-2-1 Backups Lesson', url: '/learning/cyber-security/cyber-security-track/backups-3-2-1-and-tested-restores' }
    ]
  },
  {
    slug: 'yubikey-vs-passkeys',
    title: 'YubiKey vs Synced Passkeys: FIDO2 Auth Comparison',
    shortTitle: 'YubiKey vs Passkeys',
    category: 'Authentication',
    toolA: 'Hardware YubiKey (Device-Bound)',
    toolB: 'Synced Platform Passkeys',
    summary: 'Compare hardware security keys (YubiKey 5 / FIDO2 device-bound passkeys) against cloud-synced passkeys in Apple iCloud Keychain, Google, and Bitwarden.',
    verdictA: 'Best for high-value root accounts, journalists, executives, and zero-export non-extractable private keys.',
    verdictB: 'Best for everyday consumer adoption, instant cross-device recovery, and replacing passwords everywhere.',
    rows: [
      ['Private Key Storage', 'Non-exportable hardware secure element on physical USB/NFC token', 'Synced across devices via end-to-end encrypted cloud keychain'],
      ['Phishing Resistance', 'Cryptographically bound to origin domain (RP ID) via WebAuthn', 'Cryptographically bound to origin domain (RP ID) via WebAuthn'],
      ['Account Recovery Model', 'Register 2+ physical backup keys; keys can never be exported', 'Restored automatically via iCloud/Google/Password Manager recovery'],
      ['Attestation & Enterprise Assurance', 'Hardware FIDO2 attestation proves key lives in certified silicon', 'Software/cloud provider attestation; copyable if vault is compromised'],
      ['Cross-OS Portability', 'Plug-and-play across Linux, Windows, macOS, iOS, and Android', 'Uses QR-code hybrid transport (caBLE) when signing in across ecosystems'],
      ['Extra Capabilities', 'PIV smart card, OpenPGP, OATH-TOTP, static password, HMAC', 'WebAuthn FIDO2 authentication only']
    ],
    workflowA: '# Generate an Ed25519-SK SSH key resident on a hardware YubiKey\nssh-keygen -t ed25519-sk -O resident -O verify-required -C "yubikey-main"',
    workflowB: '# Inspect WebAuthn RP ID origin binding in browser DevTools\nnavigator.credentials.get({ publicKey: { rpId: "oopsmypassword.web.app", challenge } })',
    faqs: [
      { q: 'Do both YubiKeys and synced passkeys stop real-time evilginx phishing proxies?', a: 'Yes. Both use the FIDO2 WebAuthn protocol, which cryptographically binds the authentication signature to the browser origin domain. A phishing domain never matches the legitimate Relying Party ID.' },
      { q: 'Why do security teams still require physical YubiKeys over synced passkeys?', a: 'A synced passkey is only as secure as the cloud account or password manager syncing it. A YubiKey stores the private key in dedicated hardware silicon from which it can never be exported or copied.' }
    ],
    relatedLinks: [
      { label: 'Passkeys Explained Guide', url: '/articles/passkeys-explained' },
      { label: 'Phishing URL Risk Scanner', url: '/url-scanner' },
      { label: 'Two-Factor Authentication Guide', url: '/articles/two-factor-authentication' }
    ]
  },
  {
    slug: 'nmap-vs-masscan',
    title: 'Nmap vs Masscan: Network Port Scanner Comparison',
    shortTitle: 'Nmap vs Masscan',
    category: 'Network & Pentest',
    toolA: 'Nmap',
    toolB: 'Masscan',
    summary: 'Technical comparison of Nmap and Masscan across packet transmission architecture, service version fingerprinting, NSE scripting, and scan accuracy.',
    verdictA: 'Best for deep service enumeration (-sV), OS detection (-O), NSE vulnerability scripts, and accurate host auditing.',
    verdictB: 'Best for high-speed asynchronous TCP port discovery across large CIDR blocks before passing live ports to Nmap.',
    rows: [
      ['Networking Stack', 'OS socket/pcap stack with adaptive round-trip time congestion control', 'Custom asynchronous raw TCP/IP stack (stateless SYN cookies)'],
      ['Max Packet Rate', 'Thousands of packets/sec per host group', 'Up to 10+ million packets/sec on 10GbE with PF_RING'],
      ['Service Fingerprinting', 'Deep probe catalog (-sV) matching thousands of service banners', 'Basic banner grabbing (--banners); requires careful local firewall tuning'],
      ['Scripting Engine', '600+ Nmap Scripting Engine (NSE) Lua scripts for auth/vuln checks', 'None — focused strictly on fast port discovery'],
      ['Default Scan Order', 'Sequential or grouped per host', 'Randomizes target IP and port order across the entire range'],
      ['Ideal Pipeline Role', 'Stage 2: Targeted service & script enumeration on confirmed open ports', 'Stage 1: Wide CIDR open-port discovery']
    ],
    workflowA: '# Stage 2: Deep service & script scan on discovered ports with Nmap\nnmap -sC -sV -p 22,80,443,8443 -T4 -oA nmap-detail 192.0.2.10',
    workflowB: '# Stage 1: Fast asynchronous port sweep with Masscan\nsudo masscan 192.0.2.0/24 -p1-65535 --rate=5000 -oG masscan-open.gnmap',
    faqs: [
      { q: 'Why do pentesters combine Masscan and Nmap instead of choosing one?', a: 'Masscan can sweep all 65,535 ports across a large subnet in minutes using stateless SYN packets, and pentesters then feed only the discovered open ports into Nmap (-sC -sV) for accurate version detection and NSE script analysis.' },
      { q: 'Can Masscan overwhelm fragile internal networks or IoT devices?', a: 'Yes. Always set an explicit --rate limit (such as --rate=1000) on internal networks so switches, stateful firewalls, and legacy devices are not knocked offline.' }
    ],
    relatedLinks: [
      { label: 'Nmap Pentest Guide', url: '/pentest/nmap' },
      { label: 'Masscan Pentest Guide', url: '/pentest/masscan' },
      { label: 'Nmap Command Cheat Sheet', url: '/cheatsheets/nmap-command-cheatsheet' }
    ]
  },
  {
    slug: 'burp-suite-vs-owasp-zap',
    title: 'Burp Suite vs OWASP ZAP: Web Security Proxy Guide',
    shortTitle: 'Burp Suite vs OWASP ZAP',
    category: 'Web App Security',
    toolA: 'Burp Suite (Community / Pro)',
    toolB: 'OWASP ZAP (Zed Attack Proxy)',
    summary: 'Compare Burp Suite and OWASP ZAP for manual HTTP request tampering, automated DAST CI/CD scanning, Intruder fuzzing, and extension ecosystems.',
    verdictA: 'Best for manual web application penetration testing, Repeater/Intruder ergonomics, and BApp Store extensions.',
    verdictB: 'Best for free open-source active scanning, unthrottled fuzzing, and automated GitHub Actions / CI/CD DAST pipelines.',
    rows: [
      ['License & Cost', 'Proprietary (Free Community Edition; paid Professional Edition)', '100% Free & Open Source (Apache 2.0 License)'],
      ['Automated Active Scanner', 'Professional edition only (excluded from Community edition)', 'Included free with active, passive, and AJAX spider scanners'],
      ['Fuzzer Throttling', 'Burp Community throttles Intruder payload speed; Pro is unthrottled', 'Unthrottled multi-threaded fuzzer included out of the box'],
      ['Manual Testing UI', 'Industry-standard Repeater, Comparer, Decoder, and Logger++', 'Capable desktop Swing UI + modern HUD browser overlay'],
      ['CI/CD Automation', 'Burp Suite DAST (Enterprise commercial license)', 'First-class Docker images & GitHub Actions for free CI/CD scans'],
      ['Out-of-Band Testing', 'Burp Collaborator (Pro)', 'ZAP OAST add-on (integrates with Interactsh / BOAST)']
    ],
    workflowA: '# Route CLI tools (curl / sqlmap) through local Burp Suite proxy\ncurl -x http://127.0.0.1:8080 -k https://target.example.com/api/v1/user',
    workflowB: '# Run headless OWASP ZAP baseline scan in Docker\ndocker run -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t https://target.example.com',
    faqs: [
      { q: 'Is Burp Suite Community enough for learning web application pentesting?', a: 'Yes. Burp Suite Community includes the full intercepting proxy, Repeater, Decoder, and Comparer, which are the primary tools used for manual bug bounty hunting and Academy labs. Pair it with ffuf when you need high-speed fuzzing.' },
      { q: 'When is OWASP ZAP the better choice than Burp Suite?', a: 'OWASP ZAP is completely free and open-source with an unthrottled fuzzer, active vulnerability scanner, and official Docker images for automated CI/CD security testing.' }
    ],
    relatedLinks: [
      { label: 'Burp Suite Pentest Guide', url: '/pentest/burp-suite' },
      { label: 'OWASP ZAP Pentest Guide', url: '/pentest/owasp-zap' },
      { label: 'Hash & JWT Inspector', url: '/hash-inspector' }
    ]
  },
  {
    slug: 'ffuf-vs-gobuster',
    title: 'ffuf vs Gobuster: Web Fuzzing & Content Discovery',
    shortTitle: 'ffuf vs Gobuster',
    category: 'Web App Security',
    toolA: 'ffuf (Fuzz Faster U Fool)',
    toolB: 'Gobuster',
    summary: 'Compare ffuf and Gobuster for directory brute-forcing, virtual host enumeration, POST parameter fuzzing, auto-calibration, and response filtering.',
    verdictA: 'Best for flexible FUZZ keyword placement anywhere in headers, POST bodies, cookies, or query parameters with auto-calibration (-ac).',
    verdictB: 'Best for clean, dedicated subcommands (dir, dns, vhost, s3, gcs) when running straightforward enumeration.',
    rows: [
      ['Language & Concurrency', 'Go (goroutines, ultra-fast HTTP connection pooling)', 'Go (goroutines, fast dedicated mode workers)'],
      ['Fuzzing Flexibility', 'Place FUZZ token anywhere: URL, Host header, Cookie, JSON body, or multi-wordlist', 'Mode-specific flags (dir, vhost, dns, fuzz, s3)'],
      ['False-Positive Filtering', 'Built-in auto-calibration (-ac) + filter by size (-fs), words (-fw), lines (-fl), regex (-fr)', 'Filter by status code (-b) and response length (--exclude-length)'],
      ['Recursion Support', 'Built-in recursive directory discovery (-recursion -recursion-depth 2)', 'No native recursion flag by default'],
      ['DNS & Cloud Bucket Modes', 'Focused on HTTP/HTTPS requests', 'Native dns, vhost, s3, and gcs enumeration subcommands'],
      ['Output Formats', 'JSON, CSV, HTML, Markdown, ejson (-of all)', 'Plain text / file output (-o)']
    ],
    workflowA: '# Fuzz directories with auto-calibration for soft-404s using ffuf\nffuf -u https://target.example.com/FUZZ -w common.txt -ac -mc 200,204,301,302,403',
    workflowB: '# Enumerate directories and virtual hosts with Gobuster\ngobuster dir -u https://target.example.com -w common.txt -x php,bak,txt -t 40',
    faqs: [
      { q: 'Why do web pentesters prefer ffuf -ac (auto-calibration)?', a: 'Modern web apps often return HTTP 200 for every URL (soft 404s). Running ffuf with -ac automatically probes random paths first and filters out baseline response sizes and word counts.' },
      { q: 'Does Gobuster still have advantages over ffuf?', a: 'Yes. Gobuster includes dedicated dns, s3, and gcs subcommands that query DNS resolvers or cloud storage endpoints directly without manual HTTP template setup.' }
    ],
    relatedLinks: [
      { label: 'ffuf Pentest Guide', url: '/pentest/ffuf' },
      { label: 'ffuf Web Fuzzing Cheat Sheet', url: '/cheatsheets/ffuf-web-fuzzing-cheatsheet' },
      { label: 'Pentest Hub', url: '/pentest' }
    ]
  },
  {
    slug: 'sqlmap-vs-manual-sqli',
    title: 'sqlmap vs Manual SQL Injection Testing: Pentest Guide',
    shortTitle: 'sqlmap vs Manual SQLi',
    category: 'Web App Security',
    toolA: 'sqlmap (Automated Exploitation)',
    toolB: 'Manual SQLi (Burp Repeater)',
    summary: 'When should pentesters use automated sqlmap versus manual Boolean, time-based, and UNION SQL injection verification in Burp Repeater?',
    verdictA: 'Best for rapidly extracting schemas or confirming blind time-based/error-based SQLi once an injection point is understood.',
    verdictB: 'Best for stealthy detection, custom multi-step business logic flows, WAF evasion, and avoiding noisy database payloads.',
    rows: [
      ['Request Volume & Noise', 'Hundreds to thousands of automated probe requests', '1 to 10 targeted requests crafted by the tester'],
      ['Business Logic & CSRF Tokens', 'Requires custom --eval, --csrf-token, or proxy macros', 'Handled naturally inside Burp Repeater / session rules'],
      ['Blind SQLi Speed', 'Multi-threaded bisection extracts data in seconds', 'Slow to extract character-by-character manually'],
      ['Production Safety Risk', 'High if --risk=3 or stacked queries are run carelessly', 'High control — tester sends only safe read/sleep probes'],
      ['Second-Order SQLi', 'Requires --second-url configuration', 'Easy to trace across multi-page application workflows'],
      ['Remediation Proof', 'Generates reproducible PoC logs for engineering teams', 'Produces clean minimal HTTP request/response pairs for reports']
    ],
    workflowA: '# Safely test a captured request file for DBMS banner only\nsqlmap -r request.txt -p id --batch --level=2 --risk=1 --banner',
    workflowB: '# Manual Boolean / Time-based probe in Burp Repeater\nGET /items?id=10\' AND (SELECT CASE WHEN (1=1) THEN pg_sleep(3) ELSE pg_sleep(0) END)-- - HTTP/1.1',
    faqs: [
      { q: 'Why do experienced pentesters test manually before launching sqlmap?', a: 'Manual probes verify how the application handles quotes, types, and errors without triggering rate limits or WAF blocks, and prevent automated tools from accidentally corrupting state in write endpoints.' },
      { q: 'What is the safest way to run sqlmap during an authorized assessment?', a: 'Save the exact HTTP request from Burp Suite to a file (-r request.txt), specify the single parameter to test (-p param_name), keep --risk=1, and only enumerate the database banner (--banner) or current user (--current-user) to prove impact.' }
    ],
    relatedLinks: [
      { label: 'sqlmap Pentest Guide', url: '/pentest/sqlmap' },
      { label: 'sqlmap CLI Cheat Sheet', url: '/cheatsheets/sqlmap-pentest-cheatsheet' },
      { label: 'SQL Injection Academy Lesson', url: '/learning/web-application-security/foundations/sql-injection-and-parameterized-queries' }
    ]
  },
  {
    slug: 'sherlock-vs-maigret',
    title: 'Sherlock vs Maigret: Username OSINT Tool Comparison',
    shortTitle: 'Sherlock vs Maigret',
    category: 'OSINT & Recon',
    toolA: 'Sherlock',
    toolB: 'Maigret',
    summary: 'Compare Sherlock and Maigret for username OSINT investigations across site coverage, profile metadata parsing, recursive handle pivoting, and HTML/PDF reporting.',
    verdictA: 'Best for fast, lightweight CLI username checks across 400+ mainstream social platforms with minimal dependencies.',
    verdictB: 'Best for deep OSINT investigations requiring profile bio parsing, linked account extraction, and visual HTML/XMind reports.',
    rows: [
      ['Site Database Size', '400+ curated mainstream social & developer sites', '2,500+ global, regional, and forum platforms'],
      ['Profile Content Parsing', 'Checks account existence (HTTP status / response string)', 'Extracts full name, bio, avatar URL, creation date, and linked handles'],
      ['Recursive Pivoting', 'Single-pass username check', 'Automatically pivots onto new usernames/IDs discovered on profiles'],
      ['False Positive Handling', 'Curated regex/status checks on high-reliability sites', 'Tag-based site filtering (--tags) and heuristic page analysis'],
      ['Reporting Formats', 'Plain text, CSV, JSON, XLSX', 'Interactive HTML report, PDF, XMind mindmap, JSON'],
      ['Tor & Proxy Support', 'Supports Tor (-t) and custom HTTP/SOCKS proxies', 'Supports Tor, proxies, and custom cookie jars']
    ],
    workflowA: '# Fast high-confidence username check with Sherlock\nsherlock target_user --timeout 10 --print-found --csv',
    workflowB: '# Deep profile extraction + HTML report with Maigret\nmaigret target_user --top-sites 300 --html',
    faqs: [
      { q: 'Is Maigret a fork of Sherlock?', a: 'Maigret started as a Python fork of Sherlock and added deep HTML/JSON profile scraping, recursive username pivoting, and standalone HTML/PDF visual dossier generation.' },
      { q: 'How do OSINT analysts verify false positives from username tools?', a: 'Many sites return HTTP 200 even for non-existent users. Always open discovered profile URLs in an isolated browser profile and cross-check avatars, bios, and creation timestamps before attributing an account.' }
    ],
    relatedLinks: [
      { label: 'Sherlock OSINT Guide', url: '/osint/sherlock' },
      { label: 'Maigret OSINT Guide', url: '/osint/maigret' },
      { label: 'Sherlock vs Maigret Deep Dive Article', url: '/articles/sherlock-vs-maigret-username-osint-comparison' }
    ]
  },
  {
    slug: 'amass-vs-subfinder',
    title: 'OWASP Amass vs Subfinder: Subdomain Recon Comparison',
    shortTitle: 'Amass vs Subfinder',
    category: 'OSINT & Recon',
    toolA: 'OWASP Amass',
    toolB: 'ProjectDiscovery Subfinder',
    summary: 'Compare OWASP Amass and ProjectDiscovery Subfinder for passive subdomain discovery, ASN & BGP mapping, DNS brute-forcing, and Unix pipeline speed.',
    verdictA: 'Best for comprehensive attack-surface mapping, ASN/whois correlation, graph database storage, and active DNS alterations.',
    verdictB: 'Best for fast passive subdomain enumeration that pipes cleanly into httpx, naabu, and nuclei.',
    rows: [
      ['Primary Scope', 'Full attack-surface mapping (subdomains, ASNs, netblocks, WHOIS, TLS)', 'Fast passive subdomain enumeration from 40+ intelligence sources'],
      ['Execution Speed', 'Thorough multi-minute graph correlation', 'Completes passive enumeration in seconds'],
      ['Pipeline Integration', 'Stores structured relational asset graph (OpenAssetModel)', 'Outputs clean newline-delimited domains for Unix piping (| httpx)'],
      ['Active DNS Brute-Forcing', 'Built-in active brute-forcing and permutation engine', 'Passive only (pair with dnsx or puredns for active resolution)'],
      ['Configuration', 'Data source YAML config + database backend', 'Single provider-config.yaml for optional API keys'],
      ['Resource Footprint', 'Higher CPU and memory usage on large enterprise scopes', 'Lightweight, minimal RAM footprint']
    ],
    workflowA: '# Passive attack-surface enumeration with OWASP Amass\namass enum -passive -d example.com -o amass-subs.txt',
    workflowB: '# Fast passive subdomain discovery piped to httpx\nsubfinder -d example.com -silent | httpx -silent -title -status-code',
    faqs: [
      { q: 'Should I use Amass or Subfinder for bug bounty reconnaissance?', a: 'Use Subfinder first for rapid passive subdomain discovery that pipes directly into httpx, and run OWASP Amass when mapping a large enterprise with multiple ASNs, acquisitions, and netblocks.' },
      { q: 'Why must passive subdomains be resolved with dnsx or puredns?', a: 'Passive sources like Certificate Transparency logs return historical subdomains that may no longer resolve or may point to unclaimed third-party cloud services (subdomain takeover candidates).' }
    ],
    relatedLinks: [
      { label: 'OWASP Amass Pentest Guide', url: '/pentest/owasp-amass' },
      { label: 'Subfinder Pentest Guide', url: '/pentest/subfinder' },
      { label: 'Sherlock vs Maigret OSINT Article', url: '/articles/sherlock-vs-maigret-username-osint-comparison' }
    ]
  },
  {
    slug: 'shodan-vs-censys',
    title: 'Shodan vs Censys: Internet Exposure Search Comparison',
    shortTitle: 'Shodan vs Censys',
    category: 'OSINT & Recon',
    toolA: 'Shodan',
    toolB: 'Censys Search',
    summary: 'Compare Shodan and Censys for external attack-surface discovery, TLS certificate hunting, ICS/IoT banner analysis, and origin IP discovery behind CDNs.',
    verdictA: 'Best for IoT/OT/ICS device banners, screenshot browsing, CVE filters, and rapid CLI lookups.',
    verdictB: 'Best for deep X.509 TLS certificate history, JARM TLS fingerprinting, and uncovering origin servers behind Cloudflare/CDNs.',
    rows: [
      ['Core Strengths', 'Service banners, IoT/ICS protocols, screenshots, vuln tags', 'Full IPv4/IPv6 state, X.509 certificate transparency, TLS handshakes'],
      ['Origin IP Behind CDN', 'Search ssl.cert.subject.cn:"example.com" or http.favicon.hash', 'Search services.tls.certificates.leaf_data.names: "example.com"'],
      ['Query Syntax', 'Simple key:value filters (org:, asn:, port:, product:, vuln:)', 'Structured field queries (CenQL) with boolean & regex support'],
      ['Certificate Intelligence', 'Indexes active TLS banners observed on scanned ports', 'Combines active internet scans with complete CT log databases'],
      ['CLI & API Tooling', 'Official Python shodan CLI (shodan host, shodan stats)', 'Official censys CLI and Python/Go SDKs'],
      ['Defensive Monitoring', 'Shodan Monitor for CIDR/domain alerting', 'Censys Attack Surface Management (ASM)']
    ],
    workflowA: '# Find exposed services and TLS certificates for a domain in Shodan CLI\nshodan search \'ssl.cert.subject.cn:"example.com" -http.title:"Cloudflare"\'',
    workflowB: '# Query hosts presenting a certificate for example.com in Censys CLI\ncensys search \'services.tls.certificates.leaf_data.names: "example.com"\'',
    faqs: [
      { q: 'How do Shodan and Censys reveal the real origin IP behind a CDN or WAF?', a: 'If an origin server still accepts direct HTTPS connections on IPv4 and presents the organization TLS certificate, both Shodan and Censys index that certificate on the raw IP address, allowing defenders to spot firewall bypasses.' },
      { q: 'Does querying Shodan or Censys send any packets to the target network?', a: 'No. Searching Shodan or Censys queries their pre-indexed databases and is 100% passive reconnaissance.' }
    ],
    relatedLinks: [
      { label: 'Shodan OSINT Guide', url: '/osint/shodan' },
      { label: 'SpiderFoot OSINT Guide', url: '/osint/spiderfoot' },
      { label: 'Shodan Search Filters Cheat Sheet', url: '/cheatsheets/shodan-search-filters-cheatsheet' }
    ]
  },
  {
    slug: 'wireshark-vs-tcpdump',
    title: 'Wireshark vs tcpdump: Packet Capture & Analysis Guide',
    shortTitle: 'Wireshark vs tcpdump',
    category: 'Network & Pentest',
    toolA: 'Wireshark / tshark',
    toolB: 'tcpdump',
    summary: 'Compare Wireshark and tcpdump for live network packet capture, BPF capture filters, display filter forensics, TLS decryption, and incident response.',
    verdictA: 'Best for deep protocol dissection (3,000+ dissectors), TCP stream reconstruction, and forensic PCAP inspection on an analyst workstation.',
    verdictB: 'Best for lightweight, zero-GUI packet capture over SSH on production Linux servers and edge firewalls.',
    rows: [
      ['Runtime Environment', 'Desktop GUI (Wireshark) and terminal analyzer (tshark)', 'Minimal CLI utility pre-installed on almost every Linux/BSD server'],
      ['Filter Languages', 'BPF capture filters + rich Wireshark display filters (http.request, tls.handshake)', 'Berkeley Packet Filter (BPF) expressions only'],
      ['Protocol Dissectors', '3,000+ deep application protocol dissectors + stream reassembly', 'Fast header/hex/ASCII summary output'],
      ['Security Footprint', 'Never capture as root; inspect untrusted PCAPs as non-privileged user', 'Drops privileges automatically after opening capture socket'],
      ['TLS Decryption', 'Supports SSLKEYLOGFILE session key decryption in GUI', 'Captures raw ciphertext; pass PCAP to Wireshark to decrypt'],
      ['Best Practice Workflow', 'Stage 2: Open captured .pcap file locally to follow streams & extract files', 'Stage 1: Capture ring-buffered .pcap on remote server over SSH']
    ],
    workflowA: '# Extract HTTP host and URI fields from a PCAP using tshark\ntshark -r incident.pcap -Y "http.request" -T fields -e ip.src -e http.host -e http.request.uri',
    workflowB: '# Capture traffic on a remote server excluding your own SSH session\nsudo tcpdump -i eth0 -nn -s0 -w incident.pcap \'not port 22\'',
    faqs: [
      { q: 'Why do incident responders capture with tcpdump and analyze with Wireshark?', a: 'Production servers rarely have a GUI installed, and running complex protocol dissectors directly on a live server increases attack surface. Capturing raw packets with tcpdump (-w incident.pcap) and analyzing them offline in Wireshark gives the best of both worlds.' },
      { q: 'What is the difference between a capture filter and a display filter?', a: 'A BPF capture filter (such as tcp port 443) discards non-matching packets at the kernel level before they are written to disk. A Wireshark display filter (such as tls.handshake.type == 1) hides/shows packets dynamically without deleting anything from the PCAP.' }
    ],
    relatedLinks: [
      { label: 'Wireshark Pentest Guide', url: '/pentest/wireshark' },
      { label: 'Wireshark Display Filters Cheat Sheet', url: '/cheatsheets/wireshark-display-filters-cheatsheet' },
      { label: 'Packets & Layered Stack Lesson', url: '/learning/cyber-security/cyber-security-track/packets-and-the-layered-stack' }
    ]
  }
];

/* ============================================================
   DATA: 10 Printable CLI & Defensive Security Cheat Sheets
   ============================================================ */
export const CHEATSHEETS = [
  {
    slug: 'nmap-command-cheatsheet',
    title: 'Nmap Command Cheat Sheet: Discovery, Stealth & NSE',
    shortTitle: 'Nmap Command Cheat Sheet',
    category: 'Network & Pentest',
    summary: 'Copy-ready Nmap CLI commands for host discovery, SYN/TCP/UDP port scanning, service fingerprinting, NSE vulnerability scripts, and output formats.',
    commands: [
      { title: 'Ping Sweep / Host Discovery Only', desc: 'Discover live hosts on a subnet without port scanning them.', cmd: 'nmap -sn {TARGET}/24 -oG live-hosts.gnmap' },
      { title: 'Fast Top-1000 TCP SYN Scan', desc: 'Default half-open stealth scan with service version detection and default safe NSE scripts.', cmd: 'sudo nmap -sS -sC -sV -T4 {TARGET} -oA scan-quick' },
      { title: 'Full 65,535 TCP Port Sweep', desc: 'Scan every TCP port with a minimum packet rate and save all output formats (.nmap, .xml, .gnmap).', cmd: 'sudo nmap -sS -p- --min-rate 1500 -T4 {TARGET} -oA scan-alltcp' },
      { title: 'Targeted Service & OS Detection on Known Ports', desc: 'Run deep version probing and OS fingerprinting only against open ports discovered earlier.', cmd: 'sudo nmap -sV -sC -O -p 22,80,443,445,3389 {TARGET} -oA scan-services' },
      { title: 'Top 100 UDP Ports Scan', desc: 'Check common UDP services (DNS 53, SNMP 161, NTP 123, IKE 500).', cmd: 'sudo nmap -sU --top-ports 100 -sV {TARGET} -oA scan-udp' },
      { title: 'NSE Vulnerability Category Scan', desc: 'Run Nmap Scripting Engine checks in the vuln and safe categories.', cmd: 'nmap --script "vuln and safe" -sV -p 80,443,445 {TARGET}' },
      { title: 'TLS Cipher & Certificate Inspection', desc: 'Enumerate supported TLS versions, cipher suites, and X.509 certificate details.', cmd: 'nmap --script ssl-enum-ciphers,ssl-cert -p 443 {TARGET}' },
      { title: 'SMB Signing & Share Enumeration', desc: 'Audit Windows/Samba hosts for SMBv1 and disabled message signing.', cmd: 'nmap --script smb-security-mode,smb2-security-mode,smb-enum-shares -p 445 {TARGET}' }
    ],
    faqs: [
      { q: 'What does -oA do in Nmap?', a: 'The -oA <basename> flag saves scan results in all three major formats simultaneously: human-readable (.nmap), grepable (.gnmap), and structured XML (.xml) for importing into reporting tools.' },
      { q: 'Why does -sS require sudo privileges?', a: 'A TCP SYN scan (-sS) crafts raw Ethernet/IP packets rather than completing a full OS connect() syscall, which requires root or CAP_NET_RAW privileges.' }
    ],
    relatedLinks: [
      { label: 'Nmap Pentest Guide', url: '/pentest/nmap' },
      { label: 'Nmap vs Masscan Comparison', url: '/compare/nmap-vs-masscan' },
      { label: 'Scanning & Enumeration Lesson', url: '/learning/cyber-security/cyber-security-track/scanning-and-enumeration' }
    ]
  },
  {
    slug: 'google-dorks-osint-cheatsheet',
    title: 'Google Dorks Cheat Sheet for OSINT & Bug Bounty Recon',
    shortTitle: 'Google Dorks OSINT Cheat Sheet',
    category: 'OSINT & Recon',
    summary: 'Essential Google search operators (site, filetype, inurl, intitle, intext) for discovering exposed configuration files, portals, and cloud buckets.',
    commands: [
      { title: 'Enumerate Subdomains Passively', desc: 'Find indexed subdomains while excluding the main www host.', cmd: 'site:*.{DOMAIN} -site:www.{DOMAIN}' },
      { title: 'Exposed .env & Config Files', desc: 'Locate accidentally indexed environment or configuration files.', cmd: 'site:{DOMAIN} (filetype:env OR filetype:yml OR filetype:ini) intext:"PASSWORD"' },
      { title: 'Open Directory Listings', desc: 'Find web servers with directory browsing enabled.', cmd: 'site:{DOMAIN} intitle:"index of /" "Parent Directory"' },
      { title: 'Public Database Backups & SQL Dumps', desc: 'Check for exposed SQL exports or backup archives.', cmd: 'site:{DOMAIN} (filetype:sql OR filetype:bak OR filetype:old) intext:"INSERT INTO"' },
      { title: 'Swagger & OpenAPI Documentation', desc: 'Discover public API explorers and Swagger definitions.', cmd: 'site:{DOMAIN} (inurl:swagger OR inurl:api-docs OR intitle:"Swagger UI")' },
      { title: 'Administrative & Staff Login Portals', desc: 'Map authentication surfaces across an organization.', cmd: 'site:{DOMAIN} (inurl:admin OR inurl:portal OR inurl:sso) intitle:"Sign In"' },
      { title: 'Public Cloud Storage Bucket References', desc: 'Search for S3, GCS, or Azure Blob links tied to the target.', cmd: '(site:s3.amazonaws.com OR site:storage.googleapis.com) "{DOMAIN}"' },
      { title: 'Confidential PDFs & Spreadsheets', desc: 'Audit publicly downloadable documents for internal markings.', cmd: 'site:{DOMAIN} (filetype:pdf OR filetype:xlsx) ("internal use only" OR "confidential")' }
    ],
    faqs: [
      { q: 'Is Google Dorking passive reconnaissance?', a: 'Yes, querying Google search indexes only communicates with Google servers. Clicking a result link sends an HTTP request to the target server, switching to active interaction.' },
      { q: 'Can I build custom Google Dorks interactively on OopsMyPassword?', a: 'Yes! Open the interactive Google Dork & OSINT Search Query Builder at /dork-builder to combine operators visually.' }
    ],
    relatedLinks: [
      { label: 'Interactive Google Dork Builder', url: '/dork-builder' },
      { label: 'Attack Surface & Vectors Lesson', url: '/learning/cyber-security/cyber-security-track/attack-surface-and-attack-vectors' },
      { label: 'OSINT Hub', url: '/osint' }
    ]
  },
  {
    slug: 'ffuf-web-fuzzing-cheatsheet',
    title: 'ffuf Web Fuzzing Cheat Sheet: Directories, Vhosts & APIs',
    shortTitle: 'ffuf Web Fuzzing Cheat Sheet',
    category: 'Web App Security',
    summary: 'Practical ffuf one-liners for directory discovery, virtual host enumeration, GET/POST parameter fuzzing, auto-calibration, and rate limiting.',
    commands: [
      { title: 'Directory Discovery with Auto-Calibration', desc: 'Fuzz web paths while automatically filtering out baseline soft-404 responses.', cmd: 'ffuf -u https://{DOMAIN}/FUZZ -w {WORDLIST} -ac -mc 200,204,301,302,401,403' },
      { title: 'File Extension Fuzzing', desc: 'Test discovered directories for backup and source extensions.', cmd: 'ffuf -u https://{DOMAIN}/FUZZ -w {WORDLIST} -e .php,.bak,.json,.txt,.old -ac' },
      { title: 'Virtual Host (VHost) Subdomain Fuzzing', desc: 'Discover non-DNS internal virtual hosts by fuzzing the HTTP Host header.', cmd: 'ffuf -u https://{TARGET} -H "Host: FUZZ.{DOMAIN}" -w {WORDLIST} -ac' },
      { title: 'GET Query Parameter Name Discovery', desc: 'Find hidden GET parameters accepted by an endpoint.', cmd: 'ffuf -u "https://{DOMAIN}/api/user?FUZZ=1" -w {WORDLIST} -ac' },
      { title: 'JSON POST Body Parameter Fuzzing', desc: 'Fuzz JSON values on API endpoints with custom Content-Type headers.', cmd: 'ffuf -u https://{DOMAIN}/api/login -X POST -H "Content-Type: application/json" -d \'{"user":"FUZZ","pass":"test"}\' -w {WORDLIST} -ac' },
      { title: 'Authenticated Fuzzing with Rate Limiting', desc: 'Throttle requests to 20 req/sec (-rate 20) and pass a session cookie.', cmd: 'ffuf -u https://{DOMAIN}/admin/FUZZ -w {WORDLIST} -b "session=TOKEN_HERE" -rate 20 -ac' },
      { title: 'Recursive Directory Discovery', desc: 'Automatically queue discovered directories up to 2 levels deep.', cmd: 'ffuf -u https://{DOMAIN}/FUZZ -w {WORDLIST} -recursion -recursion-depth 2 -ac' },
      { title: 'Route Fuzz Traffic Through Burp Proxy', desc: 'Replay matched responses into Burp Suite for manual inspection.', cmd: 'ffuf -u https://{DOMAIN}/FUZZ -w {WORDLIST} -ac -replay-proxy http://127.0.0.1:8080' }
    ],
    faqs: [
      { q: 'What is the best flag in ffuf to avoid flooding Burp Suite?', a: 'Use -replay-proxy http://127.0.0.1:8080 instead of -x. The -replay-proxy flag sends only the final matched responses to Burp Suite rather than proxying all 50,000 wordlist guesses.' },
      { q: 'How do I filter out responses of a specific byte size?', a: 'Use -fs <size> to filter by byte size, -fw <words> to filter by word count, or -fl <lines> to filter by line count.' }
    ],
    relatedLinks: [
      { label: 'ffuf Pentest Guide', url: '/pentest/ffuf' },
      { label: 'ffuf vs Gobuster Comparison', url: '/compare/ffuf-vs-gobuster' },
      { label: 'HTTP Requests & Responses Lesson', url: '/learning/web-application-security/foundations/http-requests-responses' }
    ]
  },
  {
    slug: 'wireshark-display-filters-cheatsheet',
    title: 'Wireshark Display Filters Cheat Sheet for Packet Analysis',
    shortTitle: 'Wireshark Display Filters',
    category: 'Network & Pentest',
    summary: 'High-signal Wireshark and tshark display filters for hunting suspicious HTTP requests, DNS tunneling, TLS handshakes, TCP anomalies, and SMB traffic.',
    commands: [
      { title: 'Filter Traffic by IP or Subnet', desc: 'Isolate packets involving a specific host or CIDR block.', cmd: 'ip.addr == {TARGET} && !(tcp.port == 22)' },
      { title: 'HTTP POST & Login Requests', desc: 'Find HTTP requests carrying form submissions or API payloads.', cmd: 'http.request.method == "POST" || http.request.method == "PUT"' },
      { title: 'Suspicious HTTP Status Codes (4xx / 5xx)', desc: 'Spot brute-force 401/403 responses or 500 server exceptions.', cmd: 'http.response.code >= 400' },
      { title: 'TLS ClientHello & Server Name Indication (SNI)', desc: 'See which HTTPS hostnames a client is connecting to even when traffic is encrypted.', cmd: 'tls.handshake.type == 1 && tls.handshake.extensions_server_name contains "{DOMAIN}"' },
      { title: 'DNS Queries & NXDOMAIN Anomalies', desc: 'Hunt for DGA malware beacons or subdomain enumeration.', cmd: 'dns.flags.rcode == 3 || (dns.qry.name contains "{DOMAIN}")' },
      { title: 'TCP SYN Scans & Reset Storms', desc: 'Detect port scanning where SYN packets are met with immediate RST-ACK.', cmd: 'tcp.flags.syn == 1 && tcp.flags.ack == 0' },
      { title: 'SMB2 File Access & Lateral Movement', desc: 'Inspect Windows file share mounts and named pipe IPC.', cmd: 'smb2 || nbns || dcerpc' },
      { title: 'Extract Cleartext Credentials (FTP / HTTP Basic / Telnet)', desc: 'Check legacy cleartext protocols for exposed authentication headers.', cmd: 'http.authorization || ftp.request.command == "PASS" || imap.request' }
    ],
    faqs: [
      { q: 'How can Wireshark see the destination domain of HTTPS traffic without decrypting TLS?', a: 'During the TLS ClientHello (tls.handshake.type == 1), the client usually sends the Server Name Indication (SNI) extension in cleartext unless Encrypted Client Hello (ECH) is enabled.' },
      { q: 'Can I use Wireshark display filters on the command line?', a: 'Yes. Pass any Wireshark display filter to tshark using the -Y flag: tshark -r capture.pcap -Y "tls.handshake.type == 1".' }
    ],
    relatedLinks: [
      { label: 'Wireshark Pentest Guide', url: '/pentest/wireshark' },
      { label: 'Wireshark vs tcpdump Comparison', url: '/compare/wireshark-vs-tcpdump' },
      { label: 'Eavesdropping & Cleartext Lesson', url: '/learning/cyber-security/cyber-security-track/eavesdropping-in-the-clear' }
    ]
  },
  {
    slug: 'sqlmap-pentest-cheatsheet',
    title: 'sqlmap Cheat Sheet: Authorized SQL Injection Verification',
    shortTitle: 'sqlmap Pentest Cheat Sheet',
    category: 'Web App Security',
    summary: 'Safe, controlled sqlmap flags for testing captured Burp HTTP requests, tuning --level and --risk, rate limiting, and verifying parameterization.',
    commands: [
      { title: 'Test a Saved Burp Request File Safely', desc: 'Load raw HTTP headers, cookies, and POST body from a file and test a single parameter.', cmd: 'sqlmap -r request.txt -p id --batch --level=2 --risk=1 --banner' },
      { title: 'Verify Current Database & User Only', desc: 'Minimal proof-of-concept query without dumping sensitive customer tables.', cmd: 'sqlmap -r request.txt -p id --batch --current-db --current-user' },
      { title: 'Specify Backend DBMS Explicitly', desc: 'Skip broad fingerprinting when you already know the database engine (postgresql, mysql, mssql).', cmd: 'sqlmap -r request.txt -p id --dbms=postgresql --technique=BEU --batch' },
      { title: 'List Tables in a Specific Schema', desc: 'Enumerate table names for an authorized database schema.', cmd: 'sqlmap -r request.txt -D app_production --tables --batch' },
      { title: 'Throttle Requests & Route Through Burp Proxy', desc: 'Add a 1-second delay between requests and inspect all traffic in Burp Suite.', cmd: 'sqlmap -r request.txt -p id --proxy="http://127.0.0.1:8080" --delay=1 --threads=1' },
      { title: 'Test JSON or GraphQL POST Payloads', desc: 'Mark the exact injection point inside complex JSON with an asterisk (*).', cmd: 'sqlmap -u "https://{DOMAIN}/api/search" --data=\'{"query":"test*"}\' -H "Content-Type: application/json" --batch' },
      { title: 'Use Random User-Agent & Flush Session Cache', desc: 'Start a clean test run with a standard browser User-Agent header.', cmd: 'sqlmap -r request.txt -p id --random-agent --flush-session --batch' },
      { title: 'Time-Based Blind SQLi Tuning', desc: 'Increase --time-sec on high-latency links to avoid false positives.', cmd: 'sqlmap -r request.txt -p id --technique=T --time-sec=5 --batch' }
    ],
    faqs: [
      { q: 'What do the letters in --technique=BEUSTQ mean?', a: 'B = Boolean-based blind, E = Error-based, U = UNION query-based, S = Stacked queries, T = Time-based blind, and Q = Inline queries.' },
      { q: 'Why should pentesters keep --risk=1 on production-like systems?', a: 'Higher risk levels (--risk=3) include OR-based payloads that can evaluate to TRUE across an entire table, potentially altering every row if the vulnerable query happens to be an UPDATE or DELETE statement.' }
    ],
    relatedLinks: [
      { label: 'sqlmap Pentest Guide', url: '/pentest/sqlmap' },
      { label: 'sqlmap vs Manual SQLi Comparison', url: '/compare/sqlmap-vs-manual-sqli' },
      { label: 'SQL Injection Academy Lesson', url: '/learning/web-application-security/foundations/sql-injection-and-parameterized-queries' }
    ]
  },
  {
    slug: 'linux-privilege-escalation-cheatsheet',
    title: 'Linux Privilege Escalation Cheat Sheet: Enumeration & Hardening',
    shortTitle: 'Linux PrivEsc Cheat Sheet',
    category: 'Network & Pentest',
    summary: 'Essential Linux local enumeration commands for auditing sudoers rules, SUID binaries, file capabilities, cron jobs, and exposed credentials.',
    commands: [
      { title: 'System, Kernel & OS Release Triage', desc: 'Check kernel version, architecture, and distribution release level.', cmd: 'uname -a && cat /etc/os-release && lscpu' },
      { title: 'Check Sudo Privileges for Current User', desc: 'List commands the current user may run as root or another user via sudo.', cmd: 'sudo -l' },
      { title: 'Find SUID & SGID Binaries', desc: 'Locate binaries executing with owner (root) permissions and cross-check against GTFOBins.', cmd: 'find / -perm -4000 -type f 2>/dev/null' },
      { title: 'Enumerate Linux File Capabilities', desc: 'Spot binaries granted powerful capabilities such as cap_setuid+ep or cap_dac_read_search.', cmd: 'getcap -r / 2>/dev/null' },
      { title: 'Inspect System & User Cron Jobs', desc: 'Check scheduled tasks for world-writable scripts or wildcard injection.', cmd: 'cat /etc/crontab && ls -la /etc/cron* /var/spool/cron/crontabs 2>/dev/null' },
      { title: 'Local Loopback Services (127.0.0.1)', desc: 'Find internal databases, admin panels, or debug ports bound only to localhost.', cmd: 'ss -tulpn' },
      { title: 'World-Writable Directories & Config Files', desc: 'Audit /etc and service paths for misconfigured write permissions.', cmd: 'find /etc -writable -type f 2>/dev/null' },
      { title: 'Search for Leaked Environment & History Secrets', desc: 'Check environment variables, shell history, and app config files for cleartext keys.', cmd: 'env && grep -rnE "password|secret|apikey|token" /var/www /opt 2>/dev/null' }
    ],
    faqs: [
      { q: 'Why are Linux file capabilities often missed during manual audits?', a: 'Unlike traditional SUID bits that show an "s" in ls -l output, POSIX capabilities (such as cap_setuid+ep on python3 or tar) are stored in extended file attributes and only appear when queried with getcap -r /.' },
      { q: 'How do defenders harden servers against sudo and SUID escalation?', a: 'Avoid NOPASSWD wildcard rules in /etc/sudoers, mount /tmp and /home with nosuid,noexec, and remove unnecessary SUID bits from standard utilities.' }
    ],
    relatedLinks: [
      { label: 'Linux Permissions Lesson', url: '/learning/cyber-security/cyber-security-track/linux-permissions-users-groups' },
      { label: 'Privilege & Admin Hygiene Lesson', url: '/learning/cyber-security/cyber-security-track/privilege-escalation-and-admin-hygiene' },
      { label: 'Pentest Hub', url: '/pentest' }
    ]
  },
  {
    slug: 'active-directory-enumeration-cheatsheet',
    title: 'Active Directory Enumeration Cheat Sheet: LDAP, Kerberos & SMB',
    shortTitle: 'Active Directory Cheat Sheet',
    category: 'Network & Pentest',
    summary: 'Authorized Active Directory security assessment commands for SMB signing checks, BloodHound collection, SPN Kerberoasting, and AD CS auditing.',
    commands: [
      { title: 'Identify Domain Controllers & SMB Signing Status', desc: 'Map SMB signing requirements and OS versions across a subnet with NetExec.', cmd: 'nxc smb {TARGET}/24 --gen-relay-list smb-unsigned.txt' },
      { title: 'Enumerate Domain Users & Password Policy', desc: 'Check lockout thresholds before any password auditing.', cmd: 'nxc smb {TARGET} -u "user" -p "pass" --pass-pol' },
      { title: 'Collect Active Directory Graph Data for BloodHound', desc: 'Run bloodhound-python remotely to map ACLs, group nesting, and sessions.', cmd: 'bloodhound-python -d {DOMAIN} -u "user" -p "pass" -ns {TARGET} -c All --zip' },
      { title: 'Audit Service Principal Names (Kerberoasting Check)', desc: 'Identify user accounts with SPNs registered that may use weak service passwords.', cmd: 'impacket-GetUserSPNs {DOMAIN}/user:pass -dc-ip {TARGET} -request' },
      { title: 'Check for AS-REP Roastable Accounts', desc: 'Find accounts with "Do not require Kerberos preauthentication" enabled.', cmd: 'impacket-GetNPUsers {DOMAIN}/ -usersfile users.txt -dc-ip {TARGET} -no-pass' },
      { title: 'Audit Active Directory Certificate Services (AD CS)', desc: 'Scan for vulnerable certificate templates (ESC1–ESC8) with Certipy.', cmd: 'certipy find -u user@{DOMAIN} -p "pass" -dc-ip {TARGET} -vulnerable -stdout' },
      { title: 'Enumerate Readable SYSVOL & Group Policy Scripts', desc: 'Check domain shares for legacy scripts or Group Policy Preferences.', cmd: 'nxc smb {TARGET} -u "user" -p "pass" -M gpp_autologin -M spider_plus' },
      { title: 'LDAP Domain Trust & Delegation Query', desc: 'List domain trusts and unconstrained delegation hosts via ldapsearch.', cmd: 'ldapsearch -x -H ldap://{TARGET} -D "user@{DOMAIN}" -w "pass" -b "DC=example,DC=com" "(userAccountControl:1.2.840.113556.1.4.803:=524288)"' }
    ],
    faqs: [
      { q: 'How do organizations defend against Kerberoasting?', a: 'Use Group Managed Service Accounts (gMSAs) with automatically rotated 120-character passwords, enforce AES-256 Kerberos encryption instead of RC4, and audit SPNs attached to privileged user accounts.' },
      { q: 'Why must pentesters always check --pass-pol first?', a: 'Querying the domain password policy reveals the Account Lockout Threshold and Observation Window so testers never lock out production user accounts.' }
    ],
    relatedLinks: [
      { label: 'Windows Security Model Lesson', url: '/learning/cyber-security/cyber-security-track/windows-security-model' },
      { label: 'BloodHound Community Guide', url: '/pentest/bloodhound-community-edition' },
      { label: 'Hashcat Pentest Guide', url: '/pentest/hashcat' }
    ]
  },
  {
    slug: 'shodan-search-filters-cheatsheet',
    title: 'Shodan Search Filters Cheat Sheet: Attack Surface & OSINT',
    shortTitle: 'Shodan Search Filters',
    category: 'OSINT & Recon',
    summary: 'Complete reference of Shodan query filters (org, asn, ssl.cert, http.favicon.hash, vuln, product) for external attack-surface monitoring.',
    commands: [
      { title: 'Hosts Presenting a Domain TLS Certificate', desc: 'Discover origin servers and cloud hosts serving certificates for your domain.', cmd: 'ssl.cert.subject.cn:"{DOMAIN}"' },
      { title: 'Filter by Organization & Autonomous System (ASN)', desc: 'Scope searches to an enterprise netblock or ASN.', cmd: 'org:"Example Corp" asn:AS15169' },
      { title: 'Find Unauthenticated Administrative Dashboards', desc: 'Locate exposed Grafana, Kibana, Jenkins, or Prometheus consoles.', cmd: 'ssl:"{DOMAIN}" (http.title:"Grafana" OR http.title:"Jenkins" OR http.title:"Kibana")' },
      { title: 'Hunt Exposed Databases & Caches', desc: 'Audit external IP space for Redis, MongoDB, Elasticsearch, or PostgreSQL ports.', cmd: 'ssl:"{DOMAIN}" (port:6379 OR port:27017 OR port:9200 OR port:5432)' },
      { title: 'Remote Desktop & Management Services', desc: 'Find internet-facing RDP, VNC, SMB, or IPMI management interfaces.', cmd: 'net:{TARGET}/24 (port:3389 OR port:5900 OR port:445 OR port:623)' },
      { title: 'HTTP Status 200 Open Directory Listings', desc: 'Spot web servers returning open directory indexes.', cmd: 'hostname:"{DOMAIN}" http.title:"Index of /" http.status:200' },
      { title: 'Shodan CLI Host Summary Lookup', desc: 'Inspect open ports, banners, and TLS certificates for a single IP via terminal.', cmd: 'shodan host {TARGET}' },
      { title: 'Shodan CLI Facet Statistics by Port', desc: 'Summarize the most common open ports across a domain.', cmd: 'shodan stats --facets port,product hostname:"{DOMAIN}"' }
    ],
    faqs: [
      { q: 'How does ssl.cert.subject.cn help find servers hidden behind Cloudflare?', a: 'When a web server is configured with an SSL certificate for example.com and its firewall fails to restrict port 443 to Cloudflare IP ranges only, Shodan indexes that certificate on the server public IP.' },
      { q: 'What is http.favicon.hash used for in Shodan?', a: 'Every web framework or custom app has a distinct MurmurHash3 value for its /favicon.ico file. Searching by http.favicon.hash finds servers running the exact same web application even when login titles are customized.' }
    ],
    relatedLinks: [
      { label: 'Shodan OSINT Guide', url: '/osint/shodan' },
      { label: 'Shodan vs Censys Comparison', url: '/compare/shodan-vs-censys' },
      { label: 'Interactive Dork & OSINT Builder', url: '/dork-builder' }
    ]
  },
  {
    slug: 'http-security-headers-cheatsheet',
    title: 'HTTP Security Headers Cheat Sheet: CSP, HSTS & CORS Hardening',
    shortTitle: 'HTTP Security Headers',
    category: 'Web App Security',
    summary: 'Copy-ready HTTP response headers (Strict-Transport-Security, Content-Security-Policy, X-Frame-Options, Permissions-Policy) and curl audit commands.',
    commands: [
      { title: 'Audit Live HTTP Security Headers with curl', desc: 'Fetch only the response headers of a site to inspect its security posture.', cmd: 'curl -sI https://{DOMAIN} | grep -iE "strict-transport|content-security|x-frame|x-content-type|referrer-policy|permissions-policy"' },
      { title: 'Strict-Transport-Security (HSTS Preload Ready)', desc: 'Force HTTPS connections for 2 years including subdomains.', cmd: 'Strict-Transport-Security: max-age=63072000; includeSubDomains; preload' },
      { title: 'Strict Content-Security-Policy (CSP Baseline)', desc: 'Block inline XSS scripts, object plugins, and unauthorized framing.', cmd: 'Content-Security-Policy: default-src \'self\'; script-src \'self\'; object-src \'none\'; base-uri \'self\'; frame-ancestors \'none\'; upgrade-insecure-requests' },
      { title: 'Clickjacking Defense (X-Frame-Options)', desc: 'Prevent attackers from embedding your login or settings page inside an invisible iframe.', cmd: 'X-Frame-Options: DENY' },
      { title: 'MIME-Sniffing Protection', desc: 'Stop browsers from executing uploaded text/image files as JavaScript or HTML.', cmd: 'X-Content-Type-Options: nosniff' },
      { title: 'Privacy-Preserving Referrer-Policy', desc: 'Send only the origin domain on cross-origin requests so sensitive URL paths are not leaked.', cmd: 'Referrer-Policy: strict-origin-when-cross-origin' },
      { title: 'Permissions-Policy (Disable Unused Browser APIs)', desc: 'Explicitly disable camera, microphone, geolocation, and payment APIs unless needed.', cmd: 'Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()' },
      { title: 'Secure Session Cookie Flags', desc: 'Prevent JavaScript XSS theft (HttpOnly), cleartext transmission (Secure), and CSRF (SameSite).', cmd: 'Set-Cookie: __Host-session=TOKEN; Secure; HttpOnly; SameSite=Lax; Path=/' }
    ],
    faqs: [
      { q: 'Why does the __Host- cookie prefix improve security?', a: 'A cookie named with the __Host- prefix is enforced by browsers to have the Secure flag, Path=/, and no Domain attribute, preventing compromised subdomains from overwriting or tossing session cookies.' },
      { q: 'Do I need both X-Frame-Options and CSP frame-ancestors?', a: 'CSP frame-ancestors is the modern standard and supports multiple allowed origins, while X-Frame-Options: DENY is kept alongside it for defense-in-depth compatibility.' }
    ],
    relatedLinks: [
      { label: 'Browser as Attack Surface Lesson', url: '/learning/cyber-security/cyber-security-track/browser-as-attack-surface' },
      { label: 'Cross-Site Scripting & CSP Lesson', url: '/learning/cyber-security/cyber-security-track/cross-site-scripting-and-output-encoding' },
      { label: 'Security Checklist Tool', url: '/security-checklist' }
    ]
  },
  {
    slug: 'incident-response-first-hour-cheatsheet',
    title: 'Incident Response First-Hour Cheat Sheet: Triage & Containment',
    shortTitle: 'Incident Response First Hour',
    category: 'Defensive Security',
    summary: 'First-hour Linux & account compromise triage checklist: preserving volatile network/process state, isolating hosts, and revoking active sessions.',
    commands: [
      { title: '1. Snapshot Active Network Connections & Listeners', desc: 'Record all established outbound C2 connections and listening sockets before rebooting.', cmd: 'ss -antup > /tmp/ir-netstat.txt && lsof -i -n -P > /tmp/ir-lsof.txt' },
      { title: '2. Capture Running Processes & Deleted Binaries', desc: 'List full command lines and spot running processes whose on-disk binary was deleted.', cmd: 'ps auxwwf > /tmp/ir-ps.txt && ls -l /proc/*/exe 2>/dev/null | grep "(deleted)"' },
      { title: '3. Audit Logged-In Users & Recent Auth Events', desc: 'Check currently active TTY sessions, recent SSH logins, and failed brute-force attempts.', cmd: 'w && last -aiF -n 30 && grep -i "Accepted\\|Failed" /var/log/auth.log | tail -n 50' },
      { title: '4. Check Persistence: SSH Keys, Systemd & Cron', desc: 'Inspect authorized_keys and recently modified systemd services.', cmd: 'find /home /root -name "authorized_keys" -exec ls -la {} + && find /etc/systemd/system -mtime -7 -ls' },
      { title: '5. Compute SHA-256 Hashes of Suspicious Artifacts', desc: 'Generate cryptographic digests of suspicious binaries before quarantine.', cmd: 'sha256sum /tmp/suspicious-binary' },
      { title: '6. Host Firewall Containment (Preserve Investigation SSH)', desc: 'Block all outbound traffic except your management IP during containment.', cmd: 'sudo iptables -A INPUT -s {TARGET} -j ACCEPT && sudo iptables -P OUTPUT DROP' }
    ],
    faqs: [
      { q: 'Why should you never immediately reboot a suspected compromised server?', a: 'Rebooting destroys volatile RAM, active network socket tables, in-memory fileless malware processes, and unlinked /proc/*/exe file descriptors that are essential for determining root cause and lateral movement.' },
      { q: 'What is the correct order of operations after discovering a credential breach?', a: 'First revoke active session tokens and OAuth grants, then rotate the password to a unique CSPRNG value, verify MFA devices and forwarding rules, and audit login logs.' }
    ],
    relatedLinks: [
      { label: 'Incident Response Roles Lesson', url: '/learning/cyber-security/cyber-security-track/incident-response-roles-and-communication' },
      { label: 'What to Do After a Data Breach', url: '/articles/after-a-data-breach' },
      { label: 'Hash & JWT Inspector', url: '/hash-inspector' }
    ]
  }
];

/* ============================================================
   DATA: 30 Cybersecurity, Auth, Web & OSINT Glossary Terms
   ============================================================ */
export const GLOSSARY_TERMS = [
  {
    slug: 'k-anonymity',
    term: 'k-Anonymity',
    category: 'Cryptography & Privacy',
    shortDef: 'k-Anonymity is a privacy property where a lookup or record cannot be distinguished from at least k-1 other items in the same set, allowing breach checks without revealing the secret queried.',
    howItWorks: 'In password breach checking (such as the Have I Been Pwned range API and the OopsMyPassword Breach Check), your browser hashes your password locally with SHA-1 and sends only the first 5 hexadecimal characters (20 bits) to the server. Because 16^5 = 1,048,576 possible prefixes share billions of password hashes, the server returns roughly 500–1,000 matching hash suffixes. Your browser checks locally whether your full 40-character hash is in that list, so the server never learns which password you tested.',
    mitigation: 'Always prefer k-anonymity range APIs over services that ask you to submit your full email/password in cleartext. Combine client-side hashing with HTTPS so network observers cannot inspect the response list.',
    relatedTool: { label: 'Breach Check (k-Anonymity Demo)', url: '/breach-check' },
    relatedLesson: { label: 'Hashing, Salting & Password Storage', url: '/learning/cyber-security/cyber-security-track/hashing-salting-password-storage' }
  },
  {
    slug: 'argon2id',
    term: 'Argon2id',
    category: 'Cryptography & Privacy',
    shortDef: 'Argon2id is the modern winner of the Password Hashing Competition that combines memory-hard resistance against GPU cracking (Argon2d) with side-channel timing resistance (Argon2i).',
    howItWorks: 'Unlike fast cryptographic digests such as SHA-256 or MD5 that execute in nanoseconds on tiny GPU registers, Argon2id forces the verifier to allocate and fill a configurable block of RAM (for example, 64 MiB) across multiple passes. Because GPUs and ASICs have limited high-speed memory bandwidth per core, memory-hardness bottlenecks parallel brute-force hardware.',
    mitigation: 'Configure authentication backends and password vaults to use Argon2id with a unique 128-bit random salt per password, at least 19–64 MiB of memory, 2–3 iterations, and parallelism matched to server cores.',
    relatedTool: { label: 'Hash & JWT Inspector', url: '/hash-inspector' },
    relatedLesson: { label: 'Hashing, Salting & Password Storage', url: '/learning/cyber-security/cyber-security-track/hashing-salting-password-storage' }
  },
  {
    slug: 'credential-stuffing',
    term: 'Credential Stuffing',
    category: 'Authentication & Identity',
    shortDef: 'Credential stuffing is an automated cyberattack where bots replay millions of leaked username-and-password pairs from one data breach across other websites to hijack accounts that reused the same password.',
    howItWorks: 'Attackers do not need to crack your password if you used the same password on a forum or store that suffered a breach. Using residential proxy networks and headless browsers, stuffing frameworks test leaked email:password combinations against banking, e-commerce, and SaaS login endpoints at scale, typically succeeding on 0.1% to 2% of attempts due to password reuse.',
    mitigation: 'Generate a unique password or passphrase for every single account using a password manager, enable phishing-resistant MFA (passkeys or TOTP), and deploy rate limiting and breached-password screening on login endpoints.',
    relatedTool: { label: 'Password Generator', url: '/generator' },
    relatedLesson: { label: 'Password Attacks Over the Network', url: '/learning/cyber-security/cyber-security-track/password-attacks-over-the-network' }
  },
  {
    slug: 'password-spraying',
    term: 'Password Spraying',
    category: 'Authentication & Identity',
    shortDef: 'Password spraying is a low-and-slow authentication attack that tests one common password (such as Summer2026! or Welcome123) across thousands of user accounts to avoid triggering per-account lockout thresholds.',
    howItWorks: 'Traditional brute-force attacks try thousands of passwords against a single username, which immediately locks that account after 5–10 failures. Password spraying inverts the loop: the attacker tries a single seasonal or corporate password once against every employee username in Active Directory or Microsoft 365, waits for the lockout observation window to reset, and then tries a second password.',
    mitigation: 'Ban common and seasonal passwords using custom deny-lists, enforce MFA across all external SSO/VPN endpoints, and monitor authentication logs for distributed failed logins across many accounts from the same ASN.',
    relatedTool: { label: 'Password Strength Checker', url: '/checker' },
    relatedLesson: { label: 'Passwords Creation & Rotation Lesson', url: '/learning/cyber-security/cyber-security-track/passwords-creation-storage-rotation' }
  },
  {
    slug: 'passkey-webauthn',
    term: 'Passkey (FIDO2 / WebAuthn)',
    category: 'Authentication & Identity',
    shortDef: 'A passkey is a phishing-resistant digital credential based on FIDO2 and WebAuthn public-key cryptography that replaces passwords with a cryptographic key pair bound to the website genuine domain.',
    howItWorks: 'When you register a passkey, your device or hardware security key generates a unique public/private key pair for that specific domain (Relying Party ID). The website stores only the public key. During sign-in, the site sends a random cryptographic challenge, and your device signs it locally after biometric or PIN verification. No shared secret ever crosses the network.',
    mitigation: 'Enable passkeys on primary email, cloud, GitHub, and password manager accounts, and register a physical FIDO2 backup security key in case your primary phone or laptop is lost.',
    relatedTool: { label: 'YubiKey vs Passkeys Comparison', url: '/compare/yubikey-vs-passkeys' },
    relatedLesson: { label: 'MFA & Passkeys Lesson', url: '/learning/cyber-security/cyber-security-track/multi-factor-authentication-and-passkeys' }
  },
  {
    slug: 'totp-rfc-6238',
    term: 'TOTP (Time-Based One-Time Password)',
    category: 'Authentication & Identity',
    shortDef: 'TOTP (RFC 6238) is an offline two-factor authentication algorithm that computes a short-lived 6- to 8-digit code from a shared secret key and the current Unix timestamp, rotating every 30 seconds.',
    howItWorks: 'When you scan a 2FA QR code into an authenticator app (such as Aegis, Ente Auth, 2FAS, or Bitwarden), your device stores a Base32-encoded secret seed. Every 30 seconds, both your phone and the server divide the current Unix time by 30 and compute an HMAC-SHA1 digest over that counter, truncating the result into a 6-digit numeric code without requiring internet connectivity.',
    mitigation: 'Use TOTP authenticator apps instead of SMS 2FA to eliminate SIM-swapping risk, and remember that TOTP codes can still be relayed by real-time Adversary-in-the-Middle (AitM) phishing sites—verify the domain URL or upgrade to passkeys where supported.',
    relatedTool: { label: 'Security Checklist', url: '/security-checklist' },
    relatedLesson: { label: 'MFA & Passkeys Lesson', url: '/learning/cyber-security/cyber-security-track/multi-factor-authentication-and-passkeys' }
  },
  {
    slug: 'browser-in-the-browser-bitb',
    term: 'Browser-in-the-Browser (BitB) Phishing',
    category: 'Phishing & Social Engineering',
    shortDef: 'Browser-in-the-Browser (BitB) is a phishing technique that renders a fake HTML/CSS popup window inside a webpage to imitate a legitimate Google, Microsoft, or Apple OAuth login dialog complete with a spoofed HTTPS address bar.',
    howItWorks: 'Users are trained to check the address bar of "Sign in with Google/Microsoft" popup windows. In a BitB attack, clicking the login button does not open a real OS browser window; instead, JavaScript draws a pixel-perfect fake window frame and fake URL bar inside the current tab DOM. Because it is just an HTML div, the attacker can display any trusted URL text they want.',
    mitigation: 'Drag the suspected login popup toward the edge of your main browser window—a fake BitB modal cannot leave the boundaries of the parent tab. Better yet, use a password manager or passkey, which checks the real parent tab origin and refuses to autofill on the phishing domain.',
    relatedTool: { label: 'Phishing URL Risk Scanner', url: '/url-scanner' },
    relatedLesson: { label: 'Phishing: Anatomy of a Message', url: '/learning/cyber-security/cyber-security-track/phishing-anatomy-of-a-message' }
  },
  {
    slug: 'idor-insecure-direct-object-reference',
    term: 'IDOR (Insecure Direct Object Reference)',
    category: 'Web App Security',
    shortDef: 'Insecure Direct Object Reference (IDOR), a form of Broken Object Level Authorization (BOLA), occurs when an application uses a client-supplied identifier (such as ?invoice_id=1042) to fetch or modify a record without verifying that the logged-in user owns that object.',
    howItWorks: 'A user logs in legitimately and sees a request to GET /api/v1/orders/5001. If the backend database query simply runs SELECT * FROM orders WHERE id = 5001 without checking AND user_id = current_session.user_id, an attacker can increment or decrement the ID to 5002 and read or modify another customer private data.',
    mitigation: 'Enforce server-side object ownership checks on every read, update, and delete controller action, and use unpredictable UUIDv4 or scoped indirect references alongside strict authorization middleware.',
    relatedTool: { label: 'Burp Suite vs OWASP ZAP', url: '/compare/burp-suite-vs-owasp-zap' },
    relatedLesson: { label: 'Broken Access Control & IDOR Lesson', url: '/learning/cyber-security/cyber-security-track/broken-access-control-and-idor' }
  },
  {
    slug: 'ssrf-server-side-request-forgery',
    term: 'SSRF (Server-Side Request Forgery)',
    category: 'Web App Security',
    shortDef: 'Server-Side Request Forgery (SSRF) is a web vulnerability where an attacker tricks a backend server into making HTTP or network requests to internal-only services, localhost ports, or cloud metadata endpoints.',
    howItWorks: 'Features such as webhook testers, PDF generators, avatar URL fetchers, and link previewers take a URL from the user and fetch it from the server. If the server does not validate the destination IP, an attacker can supply http://169.254.169.254/latest/meta-data/ (cloud instance metadata) or http://127.0.0.1:6379/ to steal temporary IAM credentials or query internal databases behind the firewall.',
    mitigation: 'Enforce strict allowlists of permitted outbound domains, resolve DNS once and block RFC 1918 private IPs, loopback (127.0.0.0/8), and link-local metadata ranges (169.254.169.254), and enforce IMDSv2 hop-limit=1 on cloud instances.',
    relatedTool: { label: 'HTTP Security Headers Cheat Sheet', url: '/cheatsheets/http-security-headers-cheatsheet' },
    relatedLesson: { label: 'File Uploads, SSRF & Validation', url: '/learning/cyber-security/cyber-security-track/file-uploads-ssrf-and-input-validation' }
  },
  {
    slug: 'xss-cross-site-scripting',
    term: 'XSS (Cross-Site Scripting)',
    category: 'Web App Security',
    shortDef: 'Cross-Site Scripting (XSS) is an injection vulnerability where untrusted data is rendered into a web page without context-aware output encoding, allowing an attacker to execute arbitrary JavaScript in another user browser session.',
    howItWorks: 'Whether Stored (saved in a database comment/profile), Reflected (bounced off a URL parameter), or DOM-based (written via unsafe innerHTML sinks in client JS), XSS executes inside the victim origin. That gives the attacker script full access to the DOM, CSRF tokens, non-HttpOnly cookies, and authenticated API endpoints.',
    mitigation: 'Use modern auto-escaping UI templates, never pass untrusted strings to innerHTML or document.write without sanitization, mark session cookies HttpOnly, and deploy a strict Content-Security-Policy (CSP).',
    relatedTool: { label: 'HTTP Security Headers Cheat Sheet', url: '/cheatsheets/http-security-headers-cheatsheet' },
    relatedLesson: { label: 'Cross-Site Scripting & Output Encoding', url: '/learning/cyber-security/cyber-security-track/cross-site-scripting-and-output-encoding' }
  },
  {
    slug: 'sql-injection-sqli',
    term: 'SQL Injection (SQLi)',
    category: 'Web App Security',
    shortDef: 'SQL Injection (SQLi) is a critical vulnerability where user input is concatenated directly into a database query string, allowing an attacker to alter the SQL syntax and read, modify, or delete arbitrary database data.',
    howItWorks: 'When code builds a query via string concatenation like "SELECT * FROM users WHERE email = \'" + input + "\'", supplying \' OR 1=1-- breaks out of the data literal and changes the boolean logic of the WHERE clause. Attackers use UNION queries, error messages, or blind time delays to extract entire tables.',
    mitigation: 'Always use parameterized queries (prepared statements) where the SQL structure is compiled ahead of time and user inputs are bound strictly as non-executable parameters.',
    relatedTool: { label: 'sqlmap Cheat Sheet', url: '/cheatsheets/sqlmap-pentest-cheatsheet' },
    relatedLesson: { label: 'SQL Injection & Parameterized Queries', url: '/learning/web-application-security/foundations/sql-injection-and-parameterized-queries' }
  },
  {
    slug: 'csrf-cross-site-request-forgery',
    term: 'CSRF (Cross-Site Request Forgery)',
    category: 'Web App Security',
    shortDef: 'Cross-Site Request Forgery (CSRF) is an attack that tricks an authenticated user browser into sending an unwanted state-changing HTTP request (such as changing an email or transferring funds) to a web application where they are currently signed in.',
    howItWorks: 'Browsers automatically attach session cookies to cross-site requests unless restricted by SameSite attributes. If a site relies solely on cookies to authenticate a POST /account/email change without checking a secret anti-CSRF token or custom header, a hidden form on an attacker website can submit that request silently when visited.',
    mitigation: 'Include cryptographically random synchronizer CSRF tokens on state-changing requests, set SameSite=Lax or SameSite=Strict on session cookies, and require re-authentication for sensitive account changes.',
    relatedTool: { label: 'HTTP Security Headers Cheat Sheet', url: '/cheatsheets/http-security-headers-cheatsheet' },
    relatedLesson: { label: 'Web Defences: CSP, HSTS, SameSite & CSRF', url: '/learning/cyber-security/cyber-security-track/web-defences-csp-hsts-samesite-and-csrf-tokens' }
  },
  {
    slug: 'jwt-json-web-token',
    term: 'JWT (JSON Web Token)',
    category: 'Authentication & Identity',
    shortDef: 'A JSON Web Token (JWT, RFC 7519) is a compact, URL-safe token format consisting of a Base64URL-encoded JSON Header, Payload (claims), and cryptographic Signature separated by dots.',
    howItWorks: 'Stateless APIs issue a signed JWT after login containing claims like sub (user ID), role, iat (issued at), and exp (expiration). When the client sends the JWT in an Authorization: Bearer header, the server verifies the cryptographic signature before trusting the claims. Importantly, standard JWTs (JWS) are signed, NOT encrypted—anyone can Base64URL-decode and read the payload.',
    mitigation: 'Explicitly whitelist allowed signing algorithms server-side (reject alg: none and prevent RS256-to-HS256 confusion), enforce short expiration times (exp), and never place sensitive secrets in the JWT payload.',
    relatedTool: { label: 'Client-Side Hash & JWT Inspector', url: '/hash-inspector' },
    relatedLesson: { label: 'Session Management & Account Takeover', url: '/learning/cyber-security/cyber-security-track/session-management-and-account-takeover' }
  },
  {
    slug: 'subdomain-takeover',
    term: 'Subdomain Takeover',
    category: 'OSINT & Recon',
    shortDef: 'Subdomain takeover occurs when a subdomain (such as promo.example.com) has a dangling DNS CNAME or A record pointing to an external cloud resource (S3 bucket, GitHub Pages, Azure App) that has been deleted or unclaimed, allowing an attacker to register that cloud resource and serve content under the organization legitimate subdomain.',
    howItWorks: 'After a marketing campaign ends, a team deletes their GitHub Pages repo or AWS S3 bucket but forgets to delete the DNS CNAME record promo.example.com -> example-promo.github.io. An attacker enumerates subdomains, spots the "There isn\'t a GitHub Pages site here" fingerprint, claims the external project name, and now controls promo.example.com—inheriting cookie scope, CORS trust, and brand credibility.',
    mitigation: 'Remove DNS records BEFORE deprovisioning external cloud resources, audit DNS zones continuously for dangling CNAMEs, and use __Host- prefixes on session cookies so subdomains cannot read or set parent cookies.',
    relatedTool: { label: 'Amass vs Subfinder Comparison', url: '/compare/amass-vs-subfinder' },
    relatedLesson: { label: 'DNS & Name Resolution Lesson', url: '/learning/cyber-security/cyber-security-track/dns-name-resolution' }
  },
  {
    slug: 'google-dorking',
    term: 'Google Dorking (Search Engine Recon)',
    category: 'OSINT & Recon',
    shortDef: 'Google Dorking (Google Hacking) is the use of advanced search engine operators—such as site:, filetype:, inurl:, intitle:, and intext:—to locate publicly indexed configuration files, exposed directories, login portals, and sensitive documents.',
    howItWorks: 'Web crawlers continuously index public links unless blocked by authentication or robots.txt / noindex headers. By combining operators like site:example.com filetype:env intext:DB_PASSWORD, security analysts and auditors can instantly query Google index for misconfigured files without sending a single packet to the target server.',
    mitigation: 'Never store .env, .git, or SQL backups inside the public web root, disable web server directory listing (Options -Indexes), and audit your domain periodically using defensive dork queries.',
    relatedTool: { label: 'Interactive Google Dork Builder', url: '/dork-builder' },
    relatedLesson: { label: 'Attack Surface & Attack Vectors', url: '/learning/cyber-security/cyber-security-track/attack-surface-and-attack-vectors' }
  },
  {
    slug: 'idn-homograph-attack',
    term: 'IDN Homograph Attack (Punycode Spoofing)',
    category: 'Phishing & Social Engineering',
    shortDef: 'An IDN homograph attack registers a domain name containing non-ASCII Unicode characters (such as Cyrillic "а" instead of Latin "a") that look visually identical to a trusted brand domain in order to deceive users into visiting a phishing site.',
    howItWorks: 'The Domain Name System translates Internationalized Domain Names (IDNs) into ASCII Punycode strings starting with xn-- (for example, xn--pple-43d.com). If a user clicks a link containing mixed or foreign-script lookalike characters, they may believe they are on apple.com or microsoft.com while actually communicating with an attacker-controlled domain.',
    mitigation: 'Inspect suspicious links with a Punycode/URL risk analyzer, rely on password managers or FIDO2 passkeys (which match the underlying xn-- Punycode domain and refuse to autofill on lookalikes), and enable browser IDN punycode display.',
    relatedTool: { label: 'Phishing URL Risk Scanner', url: '/url-scanner' },
    relatedLesson: { label: 'Phishing: Anatomy of a Message', url: '/learning/cyber-security/cyber-security-track/phishing-anatomy-of-a-message' }
  },
  {
    slug: 'typosquatting',
    term: 'Typosquatting & Combo-Squatting',
    category: 'Phishing & Social Engineering',
    shortDef: 'Typosquatting (and combo-squatting) is the registration of lookalike domains that differ from a trusted brand by a single mistyped letter, character swap (rn vs m), or appended keyword (such as microsoft-security-login.com) for phishing or malware delivery.',
    howItWorks: 'Attackers register domains with 1-character Levenshtein distance (g00gle.com, paypa1.com, micosoft.com) or hyphenated combo-domains. These domains are used in spear-phishing emails, fake OAuth prompts, and even malicious software package registries (npm/PyPI package typosquatting).',
    mitigation: 'Monitor Certificate Transparency logs and DNS permutations with tools like dnstwist, verify the exact Registered Domain (eTLD+1) before signing in, and use passkeys or a password manager bound to the real origin.',
    relatedTool: { label: 'Phishing URL Risk Scanner', url: '/url-scanner' },
    relatedLesson: { label: 'DNS & Name Resolution Lesson', url: '/learning/cyber-security/cyber-security-track/dns-name-resolution' }
  },
  {
    slug: 'zero-trust-architecture',
    term: 'Zero Trust Architecture (ZTA)',
    category: 'Defensive Security',
    shortDef: 'Zero Trust Architecture (NIST SP 800-207) is a security model that eliminates implicit trust based on network location ("inside the corporate LAN/VPN") and instead requires continuous authentication, authorization, and encryption for every user, device, and service request.',
    howItWorks: 'Traditional perimeter networks assumed that once a device connected to the office Wi-Fi or VPN, it could reach any internal server. When a single laptop was phished, attackers moved laterally across the flat network. Zero Trust replaces flat network access with identity-aware proxies, mutual TLS (mTLS), device posture checks, and micro-segmentation per application.',
    mitigation: 'Enforce phishing-resistant MFA + device health verification at an identity-aware proxy, segment internal workloads so servers only accept traffic from authorized peers, and log all east-west access.',
    relatedTool: { label: 'Security Checklist', url: '/security-checklist' },
    relatedLesson: { label: 'Network Defence, Segmentation & Zero Trust', url: '/learning/cyber-security/cyber-security-track/network-defence-segmentation-zero-trust' }
  },
  {
    slug: 'privilege-escalation',
    term: 'Privilege Escalation',
    category: 'Network & Pentest',
    shortDef: 'Privilege escalation is the act of exploiting a bug, misconfiguration, or weak permission to gain higher access rights—either vertically (from a standard user or web service account to root/SYSTEM) or horizontally (accessing another user account of the same tier).',
    howItWorks: 'After an initial foothold on a server or workstation, attackers enumerate local misconfigurations: permissive sudo rules, SUID binaries, unquoted Windows service paths, weak service binary permissions, kernel vulnerabilities, or cleartext credentials left in configuration files and shell histories.',
    mitigation: 'Apply the principle of least privilege, run web applications under dedicated low-privilege service accounts, audit sudoers/SUID/service ACLs regularly, and patch OS kernels promptly.',
    relatedTool: { label: 'Linux Privilege Escalation Cheat Sheet', url: '/cheatsheets/linux-privilege-escalation-cheatsheet' },
    relatedLesson: { label: 'Privilege Escalation & Admin Hygiene', url: '/learning/cyber-security/cyber-security-track/privilege-escalation-and-admin-hygiene' }
  },
  {
    slug: 'lateral-movement',
    term: 'Lateral Movement',
    category: 'Network & Pentest',
    shortDef: 'Lateral movement refers to the techniques an attacker uses after compromising one endpoint to pivot across the internal network to other workstations, servers, and domain controllers in search of high-value assets.',
    howItWorks: 'Attackers harvest credentials, SSH keys, Kerberos tickets, or NTLM hashes from the initially compromised host and use protocols such as SMB, WinRM, RDP, WMI, or SSH to authenticate to adjacent machines—eventually reaching domain administrator or production database access.',
    mitigation: 'Enforce network micro-segmentation and host firewallsblocking workstation-to-workstation SMB/RDP, require SMB signing, disable NTLMv1, and use LAPS (Local Administrator Password Solution) so every workstation has a unique local admin password.',
    relatedTool: { label: 'Active Directory Cheat Sheet', url: '/cheatsheets/active-directory-enumeration-cheatsheet' },
    relatedLesson: { label: 'Network Defence, Segmentation & Zero Trust', url: '/learning/cyber-security/cyber-security-track/network-defence-segmentation-zero-trust' }
  },
  {
    slug: 'kerberoasting',
    term: 'Kerberoasting',
    category: 'Network & Pentest',
    shortDef: 'Kerberoasting is an Active Directory post-exploitation technique where any authenticated domain user requests Kerberos TGS service tickets for accounts with Service Principal Names (SPNs) and cracks those tickets offline to recover the service account cleartext password.',
    howItWorks: 'By design, Active Directory allows any domain user to request a Ticket Granting Service (TGS) ticket for any registered SPN. A portion of that TGS ticket is encrypted with the target service account NTLM/AES password hash. The attacker exports the ticket from memory and runs Hashcat offline at millions of guesses per second without sending any failed logins to the Domain Controller.',
    mitigation: 'Use Group Managed Service Accounts (gMSAs) with 120-character random passwords, ensure human/admin accounts never have SPNs attached, and enforce AES-256 Kerberos encryption instead of legacy RC4-HMAC.',
    relatedTool: { label: 'Active Directory Cheat Sheet', url: '/cheatsheets/active-directory-enumeration-cheatsheet' },
    relatedLesson: { label: 'Password Attacks Over the Network', url: '/learning/cyber-security/cyber-security-track/password-attacks-over-the-network' }
  },
  {
    slug: 'canary-token',
    term: 'Canary Token (Honeytoken)',
    category: 'Defensive Security',
    shortDef: 'A Canary Token (or honeytoken) is a decoy credential, fake API key, tracked document, or unique DNS/HTTP URL planted in sensitive systems that has no legitimate operational use—so any access immediately alerts defenders to an active intrusion.',
    howItWorks: 'Most alerts suffer from high false-positive rates, but a decoy AWS access key placed in a developer ~/.aws/credentials file or a fake "passwords_backup.xlsx" file on a file share should never be touched by normal workflows. The moment an attacker uses the decoy key or opens the document, a unique DNS/webhook callback fires a high-confidence breach alert.',
    mitigation: 'Deploy canary AWS keys, decoy database rows, and tracked PDF/Word files across high-value endpoints and source repositories to reduce Mean Time to Detect (MTTD) from months to minutes.',
    relatedTool: { label: 'Incident Response First-Hour Cheat Sheet', url: '/cheatsheets/incident-response-first-hour-cheatsheet' },
    relatedLesson: { label: 'SIEM Alerts & Noise Lesson', url: '/learning/cyber-security/cyber-security-track/siem-alerts-and-noise' }
  },
  {
    slug: 'cve-and-cvss',
    term: 'CVE & CVSS Score',
    category: 'Defensive Security',
    shortDef: 'CVE (Common Vulnerabilities and Exposures) is the standardized global identifier for publicly disclosed security flaws (e.g., CVE-2026-0768), while CVSS (Common Vulnerability Scoring System) rates technical severity from 0.0 to 10.0.',
    howItWorks: 'When a vulnerability is disclosed, a CVE Numbering Authority assigns a unique CVE ID so advisories, scanners, and patches reference the exact same bug. CVSS computes a numerical score based on Attack Vector (Network vs Local), Attack Complexity, Privileges Required, User Interaction, and CIA impact—while CISA KEV tracks whether the CVE is actively exploited in the wild.',
    mitigation: 'Prioritize patching by combining CVSS severity with active exploitation intelligence (CISA KEV / EPSS) and internet exposure rather than relying on CVSS base score alone.',
    relatedTool: { label: 'Nuclei Pentest Guide', url: '/pentest/nuclei' },
    relatedLesson: { label: 'Patching & Vulnerability Management', url: '/learning/cyber-security/cyber-security-track/patching-and-vulnerability-management' }
  },
  {
    slug: 'siem-and-soar',
    term: 'SIEM & SOAR',
    category: 'Defensive Security',
    shortDef: 'SIEM (Security Information and Event Management) aggregates, normalizes, and correlates security logs across an organization to detect threats, while SOAR (Security Orchestration, Automation, and Response) automates triage playbooks and containment actions.',
    howItWorks: 'A SIEM ingests authentication logs, EDR telemetry, DNS queries, firewall flows, and cloud audit trails into a central searchable index where correlation rules and Sigma detections flag suspicious sequences. SOAR connects to the SIEM to enrich alerts automatically (e.g., reputation lookups) and execute approved containment steps such as disabling a compromised account.',
    mitigation: 'Focus on high-signal log sources (identity provider logs, process creation, DNS, and privileged actions) and tune alert rules continuously to prevent analyst alert fatigue.',
    relatedTool: { label: 'Incident Response Cheat Sheet', url: '/cheatsheets/incident-response-first-hour-cheatsheet' },
    relatedLesson: { label: 'Logs & Event Management Lesson', url: '/learning/cyber-security/cyber-security-track/logs-and-event-management' }
  },
  {
    slug: 'edr-and-xdr',
    term: 'EDR & XDR (Endpoint Detection & Response)',
    category: 'Defensive Security',
    shortDef: 'EDR (Endpoint Detection and Response) continuously monitors workstation and server process trees, memory, file changes, and network sockets to detect and contain behavioral threats, while XDR extends that correlation across identity, cloud, and network layers.',
    howItWorks: 'Unlike legacy antivirus that only checks static file hashes against known signatures, EDR sensors record behavioral telemetry—such as Microsoft Word spawning PowerShell, a process reading LSASS memory, or a web server spawning a reverse shell—and allow SOC analysts to isolate the host from the network with one click.',
    mitigation: 'Deploy EDR across all workstations and servers with tamper protection enabled, and forward endpoint telemetry into your central SIEM for cross-host correlation.',
    relatedTool: { label: 'Linux PrivEsc Cheat Sheet', url: '/cheatsheets/linux-privilege-escalation-cheatsheet' },
    relatedLesson: { label: 'Endpoint Protection (AV & EDR)', url: '/learning/cyber-security/cyber-security-track/endpoint-protection-av-edr' }
  },
  {
    slug: 'cors-misconfiguration',
    term: 'CORS Misconfiguration',
    category: 'Web App Security',
    shortDef: 'A Cross-Origin Resource Sharing (CORS) misconfiguration occurs when a server dynamically reflects an arbitrary Origin header in Access-Control-Allow-Origin alongside Access-Control-Allow-Credentials: true, allowing malicious websites to read authenticated API responses.',
    howItWorks: 'The browser Same-Origin Policy blocks evil.com from reading responses from api.bank.com. However, if api.bank.com blindly echoes back Access-Control-Allow-Origin: https://evil.com (or trusts weakly validated subdomains/regexes) with credentials enabled, JavaScript on evil.com can fetch the logged-in victim private API data and exfiltrate it.',
    mitigation: 'Validate Origin headers against a strict exact-match allowlist of trusted origins, never combine wildcard/reflected origins with Access-Control-Allow-Credentials: true, and reject the "null" origin.',
    relatedTool: { label: 'HTTP Security Headers Cheat Sheet', url: '/cheatsheets/http-security-headers-cheatsheet' },
    relatedLesson: { label: 'Web Defences: CSP, HSTS, SameSite & CSRF', url: '/learning/cyber-security/cyber-security-track/web-defences-csp-hsts-samesite-and-csrf-tokens' }
  },
  {
    slug: 'shodan-banner-grabbing',
    term: 'Banner Grabbing',
    category: 'OSINT & Recon',
    shortDef: 'Banner grabbing is the technique of reading the initial handshake or response headers returned by a network service (such as SSH, HTTP, SMTP, or FTP) to identify the software product, version number, and operating system.',
    howItWorks: 'When a client connects to TCP port 22 or 80, the server often announces its exact version string (for example, SSH-2.0-OpenSSH_8.9p1 Ubuntu-3ubuntu0.6 or Server: nginx/1.24.0). Active banner grabbing connects directly with netcat, curl, or Nmap (-sV), while passive banner grabbing queries search engines like Shodan or Censys.',
    mitigation: 'Disable verbose version tokens in production web servers and proxies (such as server_tokens off; in Nginx), restrict administrative ports (SSH, RDP, databases) behind a VPN or Zero Trust gateway, and keep exposed services patched.',
    relatedTool: { label: 'Shodan Search Filters Cheat Sheet', url: '/cheatsheets/shodan-search-filters-cheatsheet' },
    relatedLesson: { label: 'Scanning & Enumeration Lesson', url: '/learning/cyber-security/cyber-security-track/scanning-and-enumeration' }
  },
  {
    slug: 'sbom-software-bill-of-materials',
    term: 'SBOM (Software Bill of Materials)',
    category: 'Defensive Security',
    shortDef: 'A Software Bill of Materials (SBOM) is a machine-readable inventory (in CycloneDX or SPDX format) listing every open-source and third-party library, version, and transitive dependency packaged inside an application.',
    howItWorks: 'Modern software typically pulls in hundreds of transitive npm, PyPI, Maven, or Go packages. When a zero-day vulnerability like Log4Shell is disclosed, organizations with an automated SBOM generated during CI/CD can query their inventory in seconds to see exactly which containers and services include the affected version.',
    mitigation: 'Generate CycloneDX or SPDX SBOMs automatically in your CI/CD build pipeline, pin dependency versions with lockfiles, and scan dependencies continuously against CVE advisories.',
    relatedTool: { label: 'Security Checklist', url: '/security-checklist' },
    relatedLesson: { label: 'Vulnerable & Outdated Components', url: '/learning/cyber-security/cyber-security-track/vulnerable-and-outdated-components' }
  },
  {
    slug: 'diceware-passphrase',
    term: 'Diceware Passphrase',
    category: 'Cryptography & Privacy',
    shortDef: 'Diceware is a provably random method for generating strong, memorable passphrases by selecting random words from a numbered word list using physical dice or a browser CSPRNG.',
    howItWorks: 'Because human-chosen passwords follow predictable patterns, Diceware separates randomness from human memory. Choosing 5 random words from a 7,776-word list (or 6 words from a 1,296-word list) yields ~62–65 bits of true mathematical entropy—requiring trillions of guesses to brute-force while remaining easy to type and memorize as a master password.',
    mitigation: 'Use a 5- to 6-word CSPRNG passphrase as the master password for your password manager and full-disk encryption (FileVault / BitLocker / LUKS).',
    relatedTool: { label: 'Passphrase Generator', url: '/passphrase' },
    relatedLesson: { label: 'Randomness, Nonces & Entropy', url: '/learning/cyber-security/cyber-security-track/randomness-nonces-and-entropy' }
  },
  {
    slug: 'csprng',
    term: 'CSPRNG (Cryptographically Secure PRNG)',
    category: 'Cryptography & Privacy',
    shortDef: 'A Cryptographically Secure Pseudo-Random Number Generator (CSPRNG) produces unpredictable random bytes seeded by operating-system hardware entropy, suitable for generating passwords, cryptographic keys, and session tokens.',
    howItWorks: 'Standard programming functions like Math.random() in JavaScript or rand() in C are designed for speed and statistical distribution, not security—their internal state can be reconstructed after observing a few outputs. A CSPRNG (such as window.crypto.getRandomValues() in browsers or /dev/urandom in Linux) guarantees that seeing past outputs gives an attacker zero advantage in predicting future or past values.',
    mitigation: 'Never use Math.random() for passwords, reset tokens, CSRF tokens, or salts. Always use window.crypto.getRandomValues() in browsers or node:crypto in Node.js.',
    relatedTool: { label: 'Random String Generator', url: '/random-string' },
    relatedLesson: { label: 'Randomness, Nonces & Entropy', url: '/learning/cyber-security/cyber-security-track/randomness-nonces-and-entropy' }
  }
];

/* ============================================================
   STEP 1: Build the 3 Interactive Security Tools HTML Pages
   ============================================================ */
function buildDorkBuilderPage() {
  const canonical = `${SITE}/dork-builder`;
  const appSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Google Dork & OSINT Search Query Builder',
    url: canonical,
    applicationCategory: 'SecurityApplication',
    operatingSystem: 'All',
    description: 'Interactive client-side Google Dork and OSINT search operator composer with 24 defensive recon presets.'
  };
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What is a Google Dork query?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'A Google Dork combines advanced search operators such as site:, filetype:, inurl:, intitle:, and intext: to locate publicly indexed files, login portals, open directories, and subdomains.'
        }
      },
      {
        '@type': 'Question',
        name: 'Does the OopsMyPassword Dork Builder log the domains I search?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'No. Every search query is composed 100% locally in your browser tab with zero telemetry. Queries are only sent to Google, DuckDuckGo, GitHub, or Shodan if you click the external launch buttons.'
        }
      }
    ]
  };
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'Tools', item: `${SITE}/tools` },
      { '@type': 'ListItem', position: 3, name: 'OSINT Dork Builder', item: canonical }
    ]
  };

  const filetypes = ['pdf', 'env', 'sql', 'log', 'bak', 'yml', 'json', 'xlsx', 'conf', 'pem'];
  const bodyHtml = `
<section class="page-hero">
  <div class="container">
    <nav aria-label="Breadcrumb" class="crumb small muted"><a href="/" style="color:var(--purple)">Home</a> <span class="divider-dot">/</span> <a href="/tools" style="color:var(--purple)">Tools</a> <span class="divider-dot">/</span> <span>OSINT Dork Builder</span></nav>
    <h1 class="h-1 mt-16">Google Dork &amp; OSINT Search Query Builder</h1>
    <p class="lead mt-8">Compose precision search operators for defensive attack-surface audits, subdomain discovery, and exposed file checks — 100% locally in your browser.</p>
  </div>
</section>
<section class="section-tight" data-dork-app>
  <div class="container">
    <div class="card card-pad">
      <h2 class="h-3">1. Configure Target &amp; Operators</h2>
      <div class="grid grid-2 mt-16" style="gap:16px">
        <div>
          <label class="small" for="dork-domain" style="font-weight:600;display:block;margin-bottom:6px">Target Domain (<code>site:</code>)</label>
          <input id="dork-domain" class="input" type="text" placeholder="example.com" autocomplete="off" spellcheck="false">
        </div>
        <div>
          <label class="small" for="dork-exclude" style="font-weight:600;display:block;margin-bottom:6px">Exclude Subdomains (<code>-site:</code>)</label>
          <input id="dork-exclude" class="input" type="text" placeholder="www, blog, docs" autocomplete="off" spellcheck="false">
        </div>
        <div>
          <label class="small" for="dork-inurl" style="font-weight:600;display:block;margin-bottom:6px">URL Path Contains (<code>inurl:</code>)</label>
          <input id="dork-inurl" class="input" type="text" placeholder="admin OR login OR swagger" autocomplete="off">
        </div>
        <div>
          <label class="small" for="dork-intitle" style="font-weight:600;display:block;margin-bottom:6px">Page Title Contains (<code>intitle:</code>)</label>
          <input id="dork-intitle" class="input" type="text" placeholder="index of / OR Dashboard" autocomplete="off">
        </div>
        <div>
          <label class="small" for="dork-intext" style="font-weight:600;display:block;margin-bottom:6px">Body Text Contains (<code>intext:</code>)</label>
          <input id="dork-intext" class="input" type="text" placeholder="DB_PASSWORD OR confidential" autocomplete="off">
        </div>
        <div>
          <label class="small" for="dork-extra" style="font-weight:600;display:block;margin-bottom:6px">Additional Raw Operators</label>
          <input id="dork-extra" class="input" type="text" placeholder="after:2025-01-01 -filetype:html" autocomplete="off">
        </div>
      </div>

      <div class="mt-16">
        <div class="small" style="font-weight:600;margin-bottom:8px">Filter by Filetype (<code>filetype:</code> — select one or more)</div>
        <div class="flex gap-8 wrap">
          ${filetypes.map((ft) => `<button type="button" class="btn btn-ghost btn-sm mono" data-filetype="${ft}" aria-pressed="false">.${ft}</button>`).join('')}
        </div>
      </div>

      <div class="card card-pad mt-24" style="background:var(--bg-elevated, var(--surface))">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
          <span class="small muted" style="font-weight:600">Compiled Search Query</span>
          <div class="flex gap-8 wrap">
            <button type="button" id="dork-copy-btn" class="btn btn-primary btn-sm">Copy Query</button>
            <button type="button" id="dork-reset-btn" class="btn btn-ghost btn-sm">Reset</button>
          </div>
        </div>
        <pre class="mono mt-12" style="padding:14px;border-radius:8px;border:1px solid var(--border);overflow-x:auto;margin:12px 0 0"><code id="dork-output">site:example.com intitle:"index of"</code></pre>
        <p id="dork-query-explain" class="small muted mt-8" style="margin-bottom:0">Default preview shown. Enter a domain or choose a preset below to customize operators.</p>
        <div class="flex gap-12 wrap mt-16">
          <a id="dork-open-google" class="btn btn-secondary btn-sm" href="https://www.google.com" target="_blank" rel="noopener noreferrer">Open in Google ↗</a>
          <a id="dork-open-ddg" class="btn btn-ghost btn-sm" href="https://duckduckgo.com" target="_blank" rel="noopener noreferrer">DuckDuckGo ↗</a>
          <a id="dork-open-github" class="btn btn-ghost btn-sm" href="https://github.com/search" target="_blank" rel="noopener noreferrer">GitHub Code Search ↗</a>
          <a id="dork-open-shodan" class="btn btn-ghost btn-sm" href="https://www.shodan.io" target="_blank" rel="noopener noreferrer">Shodan Host Search ↗</a>
        </div>
      </div>
    </div>

    <div class="mt-32">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
        <h2 class="h-2" style="margin:0">24 Defensive Recon &amp; Audit Presets</h2>
        <div id="dork-cat-filters" class="flex gap-8 wrap"></div>
      </div>
      <p class="muted small mt-8">Click any preset to load its operators into the builder above. Always test only domains you own or are authorized to assess.</p>
      <div id="dork-presets-grid" class="grid grid-3 mt-16"></div>
    </div>

    <div class="mt-32">
      <h2 class="h-3">Related OSINT &amp; Recon Resources</h2>
      <div class="grid grid-3 mt-16">
        <a class="card card-pad card-link" href="/cheatsheets/google-dorks-osint-cheatsheet"><h3 class="h-3">Google Dorks Cheat Sheet</h3><p class="muted small mt-8">Printable operator reference for exposed files and portals.</p></a>
        <a class="card card-pad card-link" href="/learning/cyber-security/cyber-security-track/attack-surface-and-attack-vectors"><h3 class="h-3">Academy: Attack Surface Lesson</h3><p class="muted small mt-8">Learn how search engine indexing works and how to prevent leaks.</p></a>
        <a class="card card-pad card-link" href="/compare/shodan-vs-censys"><h3 class="h-3">Shodan vs Censys Comparison</h3><p class="muted small mt-8">Compare internet-wide banner and certificate search engines.</p></a>
      </div>
    </div>
  </div>
</section>`;

  const html = pageTemplate({
    title: 'Google Dork & OSINT Search Query Builder',
    description: 'Free client-side Google Dork and OSINT search query builder with 24 presets for finding exposed .env files, open directories, cloud buckets, and subdomains.',
    route: '/dork-builder',
    activeNav: '/tools',
    jsonld: [appSchema, faqSchema, breadcrumb],
    bodyHtml,
    scripts: ['/assets/js/dork-builder.js']
  });
  fs.writeFileSync(path.join(ROOT, 'dork-builder.html'), html);
}

function buildHashInspectorPage() {
  const canonical = `${SITE}/hash-inspector`;
  const appSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Client-Side Hash, JWT & Encoding Inspector',
    url: canonical,
    applicationCategory: 'SecurityApplication',
    operatingSystem: 'All',
    description: 'Offline WebCrypto SHA-256/SHA-512 hash calculator, password hash format identifier, JWT token security auditor, and Base64/Hex encoder.'
  };
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Is it safe to paste a JWT token into an online decoder?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Pasting live production JWTs into server-backed websites can leak session tokens. The OopsMyPassword Hash & JWT Inspector runs 100% locally in your browser tab using WebCrypto and native JavaScript—no token or hash ever leaves your device.'
        }
      },
      {
        '@type': 'Question',
        name: 'How can I tell if a password hash uses Argon2id, bcrypt, or MD5?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Modular crypt hashes start with an algorithm identifier such as $argon2id$ or $2b$12$ (bcrypt), whereas raw unsalted MD5 (32 hex chars) and SHA-256 (64 hex chars) appear as fixed-length hexadecimal strings.'
        }
      }
    ]
  };
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'Tools', item: `${SITE}/tools` },
      { '@type': 'ListItem', position: 3, name: 'Hash & JWT Inspector', item: canonical }
    ]
  };

  const bodyHtml = `
<section class="page-hero">
  <div class="container">
    <nav aria-label="Breadcrumb" class="crumb small muted"><a href="/" style="color:var(--purple)">Home</a> <span class="divider-dot">/</span> <a href="/tools" style="color:var(--purple)">Tools</a> <span class="divider-dot">/</span> <span>Hash &amp; JWT Inspector</span></nav>
    <h1 class="h-1 mt-16">Client-Side Hash, JWT &amp; Encoding Inspector</h1>
    <p class="lead mt-8">Compute WebCrypto SHA digests, identify password hash formats (Argon2id, bcrypt, NTLM), audit JWT tokens for security flaws, and convert Base64/Hex — 100% offline in your tab.</p>
  </div>
</section>
<section class="section-tight" data-hash-inspector>
  <div class="container">
    <div class="flex gap-8 wrap" role="tablist" aria-label="Inspector modes">
      <button type="button" class="btn btn-primary btn-sm" data-inspector-tab="jwt" aria-selected="true">JWT Security Auditor</button>
      <button type="button" class="btn btn-ghost btn-sm" data-inspector-tab="hash-gen" aria-selected="false">Live SHA Hash Generator</button>
      <button type="button" class="btn btn-ghost btn-sm" data-inspector-tab="hash-id" aria-selected="false">Hash Format Identifier</button>
      <button type="button" class="btn btn-ghost btn-sm" data-inspector-tab="encoder" aria-selected="false">Base64 / Hex / URL Workbench</button>
    </div>

    <div class="card card-pad mt-16" data-inspector-panel="jwt">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
        <h2 class="h-3" style="margin:0">Offline JWT Decoder &amp; Security Auditor</h2>
        <button type="button" id="jwt-load-sample" class="btn btn-secondary btn-sm">Load Sample JWT</button>
      </div>
      <p class="muted small mt-8">Paste a JSON Web Token below. Header and payload decoding plus 6-point security checks run locally in memory.</p>
      <label class="small" for="jwt-input" style="font-weight:600;display:block;margin-bottom:6px">Encoded JWT (header.payload.signature)</label>
      <textarea id="jwt-input" class="input mono" rows="3" spellcheck="false" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."></textarea>
      <div class="grid grid-2 mt-16" style="gap:16px">
        <div>
          <div class="small" style="font-weight:600;margin-bottom:6px">Decoded Header</div>
          <pre class="mono" style="padding:12px;border-radius:8px;border:1px solid var(--border);overflow-x:auto;margin:0"><code id="jwt-header-out">{}</code></pre>
        </div>
        <div>
          <div class="small" style="font-weight:600;margin-bottom:6px">Decoded Payload Claims</div>
          <pre class="mono" style="padding:12px;border-radius:8px;border:1px solid var(--border);overflow-x:auto;margin:0"><code id="jwt-payload-out">{}</code></pre>
        </div>
      </div>
      <div class="mt-16">
        <h3 class="h-3" style="font-size:1.02rem">Automated JWT Security Posture Findings</h3>
        <div id="jwt-findings-out"></div>
      </div>
    </div>

    <div class="card card-pad mt-16" data-inspector-panel="hash-gen" hidden>
      <h2 class="h-3">WebCrypto Cryptographic Hash Calculator</h2>
      <p class="muted small mt-8">Computes SHA-256, SHA-384, SHA-512, and SHA-1 digests in real time using your browser native <code>crypto.subtle.digest</code> engine.</p>
      <label class="small" for="hash-live-input" style="font-weight:600;display:block;margin-bottom:6px">Input Text</label>
      <input id="hash-live-input" class="input" type="text" value="OopsMyPassword-ZeroKnowledge" autocomplete="off">
      <div class="mt-16" style="display:grid;gap:12px">
        <div class="card card-pad">
          <div style="display:flex;justify-content:space-between;align-items:center"><strong class="small">SHA-256 (256-bit)</strong><button type="button" class="btn btn-ghost btn-sm" data-copy-target="hash-out-sha256">Copy</button></div>
          <code id="hash-out-sha256" class="mono small" style="word-break:break-all;display:block;margin-top:6px"></code>
        </div>
        <div class="card card-pad">
          <div style="display:flex;justify-content:space-between;align-items:center"><strong class="small">SHA-384 (384-bit)</strong><button type="button" class="btn btn-ghost btn-sm" data-copy-target="hash-out-sha384">Copy</button></div>
          <code id="hash-out-sha384" class="mono small" style="word-break:break-all;display:block;margin-top:6px"></code>
        </div>
        <div class="card card-pad">
          <div style="display:flex;justify-content:space-between;align-items:center"><strong class="small">SHA-512 (512-bit)</strong><button type="button" class="btn btn-ghost btn-sm" data-copy-target="hash-out-sha512">Copy</button></div>
          <code id="hash-out-sha512" class="mono small" style="word-break:break-all;display:block;margin-top:6px"></code>
        </div>
        <div class="card card-pad">
          <div style="display:flex;justify-content:space-between;align-items:center"><strong class="small">SHA-1 (160-bit legacy / k-anonymity prefix)</strong><button type="button" class="btn btn-ghost btn-sm" data-copy-target="hash-out-sha1">Copy</button></div>
          <code id="hash-out-sha1" class="mono small" style="word-break:break-all;display:block;margin-top:6px"></code>
        </div>
      </div>
    </div>

    <div class="card card-pad mt-16" data-inspector-panel="hash-id" hidden>
      <h2 class="h-3">Password Hash Format &amp; Crack-Resistance Identifier</h2>
      <p class="muted small mt-8">Paste any hash string or click a sample below to identify the algorithm and whether it is safe for password storage.</p>
      <div class="flex gap-8 wrap mt-8" style="margin-bottom:12px">
        <button type="button" class="btn btn-secondary btn-sm" data-sample-hash="$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$RdescudvJCsgt3ub+b+dWRWJTmaaJObG">Sample Argon2id</button>
        <button type="button" class="btn btn-secondary btn-sm" data-sample-hash="$2b$12$K8GpY7bS8m.e0P1vX3qQ9e7zL1vX2n3m4k5j6h7g8f9d0s1a2w3e4">Sample bcrypt ($2b$12$)</button>
        <button type="button" class="btn btn-secondary btn-sm" data-sample-hash="5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8">Sample SHA-256</button>
        <button type="button" class="btn btn-secondary btn-sm" data-sample-hash="5f4dcc3b5aa765d61d8327deb882cf99">Sample MD5 / NTLM</button>
      </div>
      <label class="small" for="hash-detect-input" style="font-weight:600;display:block;margin-bottom:6px">Hash String to Identify</label>
      <input id="hash-detect-input" class="input mono" type="text" value="$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$RdescudvJCsgt3ub+b+dWRWJTmaaJObG" spellcheck="false">
      <div id="hash-detect-output" class="mt-16"></div>
    </div>

    <div class="card card-pad mt-16" data-inspector-panel="encoder" hidden>
      <h2 class="h-3">Base64, Base64URL, Hex &amp; URL Encoding Workbench</h2>
      <div class="grid grid-2 mt-12" style="gap:12px">
        <div>
          <label class="small" for="enc-format" style="font-weight:600;display:block;margin-bottom:6px">Format</label>
          <select id="enc-format" class="input">
            <option value="base64">Base64 (Standard)</option>
            <option value="base64url">Base64URL (JWT / URL-safe)</option>
            <option value="hex">Hexadecimal (UTF-8 bytes)</option>
            <option value="url">URL Percent-Encoding</option>
          </select>
        </div>
        <div>
          <label class="small" for="enc-direction" style="font-weight:600;display:block;margin-bottom:6px">Operation</label>
          <select id="enc-direction" class="input">
            <option value="encode">Encode Plaintext → Format</option>
            <option value="decode">Decode Format → Plaintext</option>
          </select>
        </div>
      </div>
      <label class="small mt-12" for="enc-input" style="font-weight:600;display:block;margin-bottom:6px">Input</label>
      <textarea id="enc-input" class="input mono" rows="3">Authorization: Bearer security-check-2026</textarea>
      <div class="small mt-12" style="font-weight:600;margin-bottom:6px">Result</div>
      <pre class="mono" style="padding:12px;border-radius:8px;border:1px solid var(--border);overflow-x:auto;margin:0"><code id="enc-output"></code></pre>
    </div>

    <div class="card card-pad mt-32">
      <h2 class="h-3">Deepen Your Cryptography &amp; Token Security Knowledge</h2>
      <div class="grid grid-3 mt-16">
        <a class="card card-pad card-link" href="/glossary/argon2id"><h3 class="h-3">Glossary: Argon2id Explained</h3><p class="muted small mt-8">Why memory-hard password hashing stops GPU cracking rigs.</p></a>
        <a class="card card-pad card-link" href="/glossary/jwt-json-web-token"><h3 class="h-3">Glossary: JWT Security</h3><p class="muted small mt-8">Understand JWT headers, claims, and algorithm confusion risks.</p></a>
        <a class="card card-pad card-link" href="/learning/cyber-security/cyber-security-track/hashing-salting-password-storage"><h3 class="h-3">Academy: Hashing &amp; Salting</h3><p class="muted small mt-8">Interactive lesson on how modern servers store credentials.</p></a>
      </div>
    </div>
  </div>
</section>`;

  const html = pageTemplate({
    title: 'Hash, JWT & Encoding Inspector — Client-Side',
    description: 'Free offline SHA-256/SHA-512 hash calculator, password hash identifier (Argon2id, bcrypt, NTLM), JWT token security auditor, and Base64/Hex encoder.',
    route: '/hash-inspector',
    activeNav: '/tools',
    jsonld: [appSchema, faqSchema, breadcrumb],
    bodyHtml,
    scripts: ['/assets/js/hash-inspector.js']
  });
  fs.writeFileSync(path.join(ROOT, 'hash-inspector.html'), html);
}

function buildUrlScannerPage() {
  const canonical = `${SITE}/url-scanner`;
  const appSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Phishing URL & Suspicious Link Risk Scanner',
    url: canonical,
    applicationCategory: 'SecurityApplication',
    operatingSystem: 'All',
    description: 'Client-side phishing URL analyzer that detects IDN homograph punycode (xn--), @-authority tricks, brand typosquatting, deceptive .zip TLDs, and open redirects.'
  };
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'How does the @ symbol trick work in phishing URLs?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'According to RFC 3986, anything before an @ symbol in a URL authority section is treated as a username, and the real destination host comes immediately after @. A link like https://google.com@evil.example/login actually takes you to evil.example.'
        }
      },
      {
        '@type': 'Question',
        name: 'What is an IDN homograph (xn--) phishing attack?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Attackers register domains containing Cyrillic or Greek characters that look identical to Latin letters. Browsers encode these internationalized domains as Punycode starting with xn--, which our scanner flags automatically.'
        }
      }
    ]
  };
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'Tools', item: `${SITE}/tools` },
      { '@type': 'ListItem', position: 3, name: 'Phishing URL Scanner', item: canonical }
    ]
  };

  const bodyHtml = `
<section class="page-hero">
  <div class="container">
    <nav aria-label="Breadcrumb" class="crumb small muted"><a href="/" style="color:var(--purple)">Home</a> <span class="divider-dot">/</span> <a href="/tools" style="color:var(--purple)">Tools</a> <span class="divider-dot">/</span> <span>Phishing URL Scanner</span></nav>
    <h1 class="h-1 mt-16">Phishing URL &amp; Suspicious Link Risk Scanner</h1>
    <p class="lead mt-8">Inspect any suspicious link locally for IDN homograph punycode (<code>xn--</code>), <code>@</code> authority confusion, brand typosquatting, deceptive <code>.zip</code> TLDs, and open redirects — without visiting the link or sending it to a server.</p>
  </div>
</section>
<section class="section-tight" data-url-scanner>
  <div class="container">
    <div class="card card-pad">
      <h2 class="h-3">Paste a URL or Test an Attack Pattern</h2>
      <div class="flex gap-8 wrap mt-12" style="margin-bottom:12px">
        <button type="button" class="btn btn-secondary btn-sm" data-url-preset="https://login.microsoft.com-security-verify@m1crosoft-account-auth.zip/oauth2/authorize?redirect=https://evil.example/harvest">Test @-Authority + Typosquat</button>
        <button type="button" class="btn btn-secondary btn-sm" data-url-preset="https://www.xn--80ak6aa92e.com/account/signin">Test IDN Punycode (xn--)</button>
        <button type="button" class="btn btn-secondary btn-sm" data-url-preset="https://paypa1-resolution-center.support.top/verify-identity">Test Brand Lookalike</button>
        <button type="button" class="btn btn-secondary btn-sm" data-url-preset="https://oopsmypassword.web.app/checker">Test Clean Legitimate URL</button>
      </div>
      <label class="small" for="url-scan-input" style="font-weight:600;display:block;margin-bottom:6px">Suspicious URL to Analyze Locally</label>
      <input id="url-scan-input" class="input mono" type="text" spellcheck="false" autocomplete="off" placeholder="https://...">
      <div id="url-scan-results"></div>
    </div>

    <div class="card card-pad mt-32">
      <h2 class="h-3">Related Phishing Defense Guides &amp; Lessons</h2>
      <div class="grid grid-3 mt-16">
        <a class="card card-pad card-link" href="/articles/phishing-attacks"><h3 class="h-3">How Phishing Steals Passwords</h3><p class="muted small mt-8">Anatomy of modern credential harvesting and how to stop it.</p></a>
        <a class="card card-pad card-link" href="/glossary/idn-homograph-attack"><h3 class="h-3">Glossary: IDN Homograph Attacks</h3><p class="muted small mt-8">How Punycode lookalike domains spoof trusted brands.</p></a>
        <a class="card card-pad card-link" href="/glossary/browser-in-the-browser-bitb"><h3 class="h-3">Glossary: Browser-in-the-Browser</h3><p class="muted small mt-8">How fake OAuth popup windows spoof the address bar.</p></a>
      </div>
    </div>
  </div>
</section>`;

  const html = pageTemplate({
    title: 'Phishing URL & Suspicious Link Risk Scanner',
    description: 'Free client-side phishing link analyzer. Detect IDN homograph punycode (xn--), @-authority tricks, brand typosquatting, and open redirects offline.',
    route: '/url-scanner',
    activeNav: '/tools',
    jsonld: [appSchema, faqSchema, breadcrumb],
    bodyHtml,
    scripts: ['/assets/js/url-scanner.js']
  });
  fs.writeFileSync(path.join(ROOT, 'url-scanner.html'), html);
}

/* ============================================================
   STEP 2: Build /compare Hub & 12 /compare/<slug> Pages
   ============================================================ */
function buildComparisonsCluster() {
  const dir = path.join(ROOT, 'compare');
  fs.mkdirSync(dir, { recursive: true });

  const categories = ['All', ...new Set(COMPARISONS.map((c) => c.category))];
  const cardsHtml = COMPARISONS.map((c) => `
    <article class="card card-pad" data-hub-card data-hub-cat="${esc(c.category)}" data-hub-search="${esc((c.title + ' ' + c.summary + ' ' + c.toolA + ' ' + c.toolB).toLowerCase())}" style="display:flex;flex-direction:column;justify-content:space-between;gap:14px">
      <div>
        <div class="small muted" style="font-weight:600">${esc(c.category)}</div>
        <h2 class="h-3 mt-8" style="margin-bottom:0"><a href="/compare/${esc(c.slug)}">${esc(c.shortTitle)}</a></h2>
        <p class="muted small mt-8">${esc(c.summary)}</p>
      </div>
      <div style="padding-top:10px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
        <span class="small mono muted">${esc(c.toolA)} vs ${esc(c.toolB)}</span>
        <a class="btn btn-secondary btn-sm" href="/compare/${esc(c.slug)}">Read Comparison →</a>
      </div>
    </article>`).join('');

  const hubSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'Tool Comparisons', item: `${SITE}/compare` }
    ]
  };

  const hubBody = `
<section class="page-hero">
  <div class="container">
    <nav aria-label="Breadcrumb" class="crumb small muted"><a href="/" style="color:var(--purple)">Home</a> <span class="divider-dot">/</span> <span>Tool Comparisons</span></nav>
    <h1 class="h-1 mt-16">Cybersecurity, OSINT &amp; Password Tool Comparisons</h1>
    <p class="lead mt-8">Technical head-to-head breakdowns across password managers, FIDO2 authentication, network scanners, web proxies, and OSINT reconnaissance tools.</p>
  </div>
</section>
<section class="section-tight" data-filterable-hub>
  <div class="container">
    <div class="card card-pad" style="margin-bottom:24px">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
        <input type="search" class="input" data-hub-filter-input placeholder="Search comparisons (e.g. Bitwarden, Nmap, Burp, Sherlock)…" style="max-width:420px" aria-label="Search comparisons">
        <div class="flex gap-8 wrap">
          ${categories.map((cat, idx) => `<button type="button" class="btn btn-sm ${idx === 0 ? 'btn-primary' : 'btn-ghost'}" data-hub-filter-cat="${esc(cat)}">${esc(cat)}</button>`).join('')}
        </div>
      </div>
    </div>
    <div class="grid grid-3">${cardsHtml}</div>
  </div>
</section>`;

  fs.writeFileSync(
    path.join(ROOT, 'compare.html'),
    pageTemplate({
      title: 'Security & OSINT Tool Comparisons (VS Guides)',
      description: 'Compare top password managers, FIDO2 keys, OSINT recon tools, and pentesting utilities side-by-side: Bitwarden vs 1Password, Nmap vs Masscan, and more.',
      route: '/compare',
      activeNav: '/tools',
      jsonld: [hubSchema],
      bodyHtml: hubBody
    })
  );

  // Build each comparison detail page
  COMPARISONS.forEach((c, idx) => {
    const route = `/compare/${c.slug}`;
    const canonical = `${SITE}${route}`;
    const peers = [
      COMPARISONS[(idx + 1) % COMPARISONS.length],
      COMPARISONS[(idx + 2) % COMPARISONS.length],
      COMPARISONS[(idx + 3) % COMPARISONS.length]
    ];

    const articleSchema = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: c.title,
      description: clampDesc(c.summary),
      datePublished: '2026-09-15',
      dateModified: '2026-10-29',
      mainEntityOfPage: canonical,
      author: { '@type': 'Organization', name: 'OopsMyPassword', url: `${SITE}/` },
      publisher: { '@type': 'Organization', name: 'OopsMyPassword', url: SITE },
      image: [OG_IMG]
    };
    const faqSchema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: c.faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a }
      }))
    };
    const breadcrumb = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: 'Comparisons', item: `${SITE}/compare` },
        { '@type': 'ListItem', position: 3, name: c.shortTitle, item: canonical }
      ]
    };

    const tableRows = c.rows.map(([feature, valA, valB]) => `
      <tr>
        <td style="font-weight:600;padding:12px;border-bottom:1px solid var(--border)">${esc(feature)}</td>
        <td style="padding:12px;border-bottom:1px solid var(--border)">${esc(valA)}</td>
        <td style="padding:12px;border-bottom:1px solid var(--border)">${esc(valB)}</td>
      </tr>`).join('');

    const bodyHtml = `
<section class="article-hero">
  <div class="container container-narrow">
    <nav aria-label="Breadcrumb" class="crumb small muted"><a href="/" style="color:var(--purple)">Home</a> <span class="divider-dot">/</span> <a href="/compare" style="color:var(--purple)">Comparisons</a> <span class="divider-dot">/</span> <span>${esc(c.shortTitle)}</span></nav>
    <h1 class="h-1 mt-16">${esc(c.title)}</h1>
    <p class="lead mt-8">${esc(c.summary)}</p>
  </div>
</section>
<section class="section-tight">
  <div class="container container-narrow">
    <article class="prose">
      <h2>Executive Verdict: When to Choose Each</h2>
      <div class="grid grid-2 mt-16" style="gap:16px">
        <div class="card card-pad">
          <h3 class="h-3" style="margin-top:0">Choose ${esc(c.toolA)} if…</h3>
          <p class="small muted" style="margin-bottom:0">${esc(c.verdictA)}</p>
        </div>
        <div class="card card-pad">
          <h3 class="h-3" style="margin-top:0">Choose ${esc(c.toolB)} if…</h3>
          <p class="small muted" style="margin-bottom:0">${esc(c.verdictB)}</p>
        </div>
      </div>

      <h2 class="mt-32">Feature-by-Feature Technical Matrix</h2>
      <div style="overflow-x:auto;margin-top:16px">
        <table style="width:100%;border-collapse:collapse;text-align:left">
          <thead>
            <tr>
              <th style="padding:12px;border-bottom:2px solid var(--border)">Dimension</th>
              <th style="padding:12px;border-bottom:2px solid var(--border)">${esc(c.toolA)}</th>
              <th style="padding:12px;border-bottom:2px solid var(--border)">${esc(c.toolB)}</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>

      <h2 class="mt-32">Side-by-Side CLI &amp; Operational Workflow</h2>
      <div class="grid grid-2 mt-16" style="gap:16px">
        <div>
          <h3>${esc(c.toolA)} Example</h3>
          <pre><code>${esc(c.workflowA)}</code></pre>
        </div>
        <div>
          <h3>${esc(c.toolB)} Example</h3>
          <pre><code>${esc(c.workflowB)}</code></pre>
        </div>
      </div>

      <h2 class="mt-32">Frequently Asked Questions</h2>
      ${c.faqs.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('\n')}

      <hr class="hr-fade" style="margin-top:40px">
      <h2>Related Tools, Academy Lessons &amp; Comparisons</h2>
      <div class="grid grid-3 mt-16" style="gap:12px">
        ${c.relatedLinks.map((l) => `<a class="card card-pad card-link" href="${esc(l.url)}"><strong>${esc(l.label)}</strong><p class="small muted mt-8" style="margin-bottom:0">Explore on OopsMyPassword →</p></a>`).join('')}
      </div>
      <div class="grid grid-3 mt-16" style="gap:12px">
        ${peers.map((p) => `<a class="card card-pad card-link" href="/compare/${esc(p.slug)}"><strong>${esc(p.shortTitle)}</strong><p class="small muted mt-8" style="margin-bottom:0">${esc(p.category)} comparison →</p></a>`).join('')}
      </div>
    </article>
  </div>
</section>`;

    fs.writeFileSync(
      path.join(dir, `${c.slug}.html`),
      pageTemplate({
        title: c.title,
        description: c.summary,
        route,
        activeNav: '/tools',
        ogType: 'article',
        jsonld: [articleSchema, faqSchema, breadcrumb],
        bodyHtml
      })
    );
  });
}

/* ============================================================
   STEP 3: Build /cheatsheets Hub & 10 /cheatsheets/<slug> Pages
   ============================================================ */
function buildCheatsheetsCluster() {
  const dir = path.join(ROOT, 'cheatsheets');
  fs.mkdirSync(dir, { recursive: true });

  const categories = ['All', ...new Set(CHEATSHEETS.map((c) => c.category))];
  const cardsHtml = CHEATSHEETS.map((c) => `
    <article class="card card-pad" data-hub-card data-hub-cat="${esc(c.category)}" data-hub-search="${esc((c.title + ' ' + c.summary).toLowerCase())}" style="display:flex;flex-direction:column;justify-content:space-between;gap:14px">
      <div>
        <div class="small muted" style="font-weight:600">${esc(c.category)} · ${c.commands.length} Commands</div>
        <h2 class="h-3 mt-8" style="margin-bottom:0"><a href="/cheatsheets/${esc(c.slug)}">${esc(c.shortTitle)}</a></h2>
        <p class="muted small mt-8">${esc(c.summary)}</p>
      </div>
      <div style="padding-top:10px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
        <span class="small mono muted">Interactive Target Vars</span>
        <a class="btn btn-secondary btn-sm" href="/cheatsheets/${esc(c.slug)}">Open Cheat Sheet →</a>
      </div>
    </article>`).join('');

  const hubSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'CLI Cheat Sheets', item: `${SITE}/cheatsheets` }
    ]
  };

  const hubBody = `
<section class="page-hero">
  <div class="container">
    <nav aria-label="Breadcrumb" class="crumb small muted"><a href="/" style="color:var(--purple)">Home</a> <span class="divider-dot">/</span> <span>CLI Cheat Sheets</span></nav>
    <h1 class="h-1 mt-16">Interactive Pentest, OSINT &amp; Defensive CLI Cheat Sheets</h1>
    <p class="lead mt-8">Copy-ready command references with live target IP/domain substitution, one-click Markdown export, and printable PDF layout.</p>
  </div>
</section>
<section class="section-tight" data-filterable-hub>
  <div class="container">
    <div class="card card-pad" style="margin-bottom:24px">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
        <input type="search" class="input" data-hub-filter-input placeholder="Search cheat sheets (Nmap, ffuf, Wireshark, Active Directory, Headers)…" style="max-width:420px" aria-label="Search cheat sheets">
        <div class="flex gap-8 wrap">
          ${categories.map((cat, idx) => `<button type="button" class="btn btn-sm ${idx === 0 ? 'btn-primary' : 'btn-ghost'}" data-hub-filter-cat="${esc(cat)}">${esc(cat)}</button>`).join('')}
        </div>
      </div>
    </div>
    <div class="grid grid-3">${cardsHtml}</div>
  </div>
</section>`;

  fs.writeFileSync(
    path.join(ROOT, 'cheatsheets.html'),
    pageTemplate({
      title: 'Cybersecurity, Pentest & OSINT CLI Cheat Sheets',
      description: 'Interactive, printable command-line cheat sheets for Nmap, ffuf, Wireshark, sqlmap, Linux privilege escalation, Active Directory, Shodan, and HTTP headers.',
      route: '/cheatsheets',
      activeNav: '/tools',
      jsonld: [hubSchema],
      bodyHtml: hubBody
    })
  );

  CHEATSHEETS.forEach((cs, idx) => {
    const route = `/cheatsheets/${cs.slug}`;
    const canonical = `${SITE}${route}`;
    const peers = [
      CHEATSHEETS[(idx + 1) % CHEATSHEETS.length],
      CHEATSHEETS[(idx + 2) % CHEATSHEETS.length],
      CHEATSHEETS[(idx + 3) % CHEATSHEETS.length]
    ];

    const articleSchema = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: cs.title,
      description: clampDesc(cs.summary),
      datePublished: '2026-09-18',
      dateModified: '2026-10-29',
      mainEntityOfPage: canonical,
      author: { '@type': 'Organization', name: 'OopsMyPassword', url: `${SITE}/` },
      publisher: { '@type': 'Organization', name: 'OopsMyPassword', url: SITE },
      image: [OG_IMG]
    };
    const faqSchema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: cs.faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a }
      }))
    };
    const breadcrumb = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: 'CLI Cheat Sheets', item: `${SITE}/cheatsheets` },
        { '@type': 'ListItem', position: 3, name: cs.shortTitle, item: canonical }
      ]
    };

    const cmdCards = cs.commands.map((c, cIdx) => {
      const rendered = c.cmd
        .replaceAll('{TARGET}', '192.0.2.10')
        .replaceAll('{DOMAIN}', 'example.com')
        .replaceAll('{WORDLIST}', '/usr/share/wordlists/common.txt');
      return `
      <div class="card card-pad" style="margin-top:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
          <h3 class="h-3" style="font-size:1.03rem;margin:0">${cIdx + 1}. ${esc(c.title)}</h3>
          <button type="button" class="btn btn-secondary btn-sm" data-cs-copy="${cIdx}">Copy Command</button>
        </div>
        <p class="muted small mt-8">${esc(c.desc)}</p>
        <pre class="mono mt-8" style="margin-bottom:0"><code data-cs-template="${esc(c.cmd)}" data-cs-idx="${cIdx}">${esc(rendered)}</code></pre>
      </div>`;
    }).join('');

    const bodyHtml = `
<section class="article-hero">
  <div class="container container-narrow">
    <nav aria-label="Breadcrumb" class="crumb small muted"><a href="/" style="color:var(--purple)">Home</a> <span class="divider-dot">/</span> <a href="/cheatsheets" style="color:var(--purple)">CLI Cheat Sheets</a> <span class="divider-dot">/</span> <span>${esc(cs.shortTitle)}</span></nav>
    <h1 class="h-1 mt-16">${esc(cs.title)}</h1>
    <p class="lead mt-8">${esc(cs.summary)}</p>
  </div>
</section>
<section class="section-tight" data-cheatsheet-page data-cs-title="${esc(cs.title)}">
  <div class="container container-narrow">
    <div class="card card-pad" style="margin-bottom:24px">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
        <h2 class="h-3" style="margin:0">Interactive Target Variable Replacer</h2>
        <div class="flex gap-8 wrap">
          <button type="button" class="btn btn-secondary btn-sm" data-cs-download-md>Download .md</button>
          <button type="button" class="btn btn-ghost btn-sm" data-cs-print>Print / Save PDF</button>
        </div>
      </div>
      <p class="muted small mt-8">Customize your target IP, domain, or wordlist below to update every command block on this page automatically.</p>
      <div class="grid grid-3 mt-12" style="gap:12px">
        <div>
          <label class="small" for="cs-var-target" style="font-weight:600;display:block;margin-bottom:4px">Target IP / Host</label>
          <input id="cs-var-target" class="input mono" type="text" value="192.0.2.10" data-cs-var="TARGET">
        </div>
        <div>
          <label class="small" for="cs-var-domain" style="font-weight:600;display:block;margin-bottom:4px">Target Domain</label>
          <input id="cs-var-domain" class="input mono" type="text" value="example.com" data-cs-var="DOMAIN">
        </div>
        <div>
          <label class="small" for="cs-var-wordlist" style="font-weight:600;display:block;margin-bottom:4px">Wordlist Path</label>
          <input id="cs-var-wordlist" class="input mono" type="text" value="/usr/share/wordlists/common.txt" data-cs-var="WORDLIST">
        </div>
      </div>
    </div>

    <article class="prose">
      <h2>Command Reference</h2>
      ${cmdCards}

      <h2 class="mt-32">Frequently Asked Questions</h2>
      ${cs.faqs.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('\n')}

      <hr class="hr-fade" style="margin-top:40px">
      <h2>Related Guides, Tools &amp; Cheat Sheets</h2>
      <div class="grid grid-3 mt-16" style="gap:12px">
        ${cs.relatedLinks.map((l) => `<a class="card card-pad card-link" href="${esc(l.url)}"><strong>${esc(l.label)}</strong><p class="small muted mt-8" style="margin-bottom:0">Open resource →</p></a>`).join('')}
      </div>
      <div class="grid grid-3 mt-16" style="gap:12px">
        ${peers.map((p) => `<a class="card card-pad card-link" href="/cheatsheets/${esc(p.slug)}"><strong>${esc(p.shortTitle)}</strong><p class="small muted mt-8" style="margin-bottom:0">${esc(p.category)} cheat sheet →</p></a>`).join('')}
      </div>
    </article>
  </div>
</section>`;

    fs.writeFileSync(
      path.join(dir, `${cs.slug}.html`),
      pageTemplate({
        title: cs.title,
        description: cs.summary,
        route,
        activeNav: '/tools',
        ogType: 'article',
        jsonld: [articleSchema, faqSchema, breadcrumb],
        bodyHtml
      })
    );
  });
}

/* ============================================================
   STEP 4: Upgrade /glossary Hub & Build 30 /glossary/<slug> Pages
   ============================================================ */
function buildGlossaryCluster() {
  const dir = path.join(ROOT, 'glossary');
  fs.mkdirSync(dir, { recursive: true });

  const categories = ['All', ...new Set(GLOSSARY_TERMS.map((t) => t.category))];
  const cardsHtml = GLOSSARY_TERMS.map((t) => `
    <article class="card card-pad" data-hub-card data-hub-cat="${esc(t.category)}" data-hub-search="${esc((t.term + ' ' + t.shortDef + ' ' + t.category).toLowerCase())}" style="display:flex;flex-direction:column;justify-content:space-between;gap:12px">
      <div>
        <div class="small muted" style="font-weight:600">${esc(t.category)}</div>
        <h2 class="h-3 mt-8" style="margin-bottom:0"><a href="/glossary/${esc(t.slug)}">${esc(t.term)}</a></h2>
        <p class="muted small mt-8" style="margin-bottom:0">${esc(t.shortDef)}</p>
      </div>
      <div style="padding-top:10px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
        <a class="small" style="color:var(--purple);font-weight:600" href="/glossary/${esc(t.slug)}">Deep-dive &amp; defenses →</a>
        <a class="small muted" href="${esc(t.relatedTool.url)}">${esc(t.relatedTool.label)}</a>
      </div>
    </article>`).join('');

  const hubBreadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'Security Glossary', item: `${SITE}/glossary` }
    ]
  };

  const hubBody = `
<section class="page-hero">
  <div class="container">
    <span class="eyebrow">Reference Encyclopedia</span>
    <h1 class="h-1">Cybersecurity, Cryptography &amp; OSINT Glossary</h1>
    <p class="lead">Thirty core security concepts — from k-anonymity, Argon2id, and passkeys to IDOR, SSRF, Kerberoasting, and Google Dorking — explained with architecture breakdowns and defensive checklists.</p>
  </div>
</section>
<section class="section-tight" data-filterable-hub>
  <div class="container">
    <div class="card card-pad" style="margin-bottom:24px">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
        <input type="search" class="input" data-hub-filter-input placeholder="Search 30 security terms (e.g. Argon2id, IDOR, Passkey, SSRF, JWT)…" style="max-width:420px" aria-label="Search glossary terms">
        <div class="flex gap-8 wrap">
          ${categories.map((cat, idx) => `<button type="button" class="btn btn-sm ${idx === 0 ? 'btn-primary' : 'btn-ghost'}" data-hub-filter-cat="${esc(cat)}">${esc(cat)}</button>`).join('')}
        </div>
      </div>
    </div>
    <div class="grid grid-3">${cardsHtml}</div>
  </div>
</section>`;

  fs.writeFileSync(
    path.join(ROOT, 'glossary.html'),
    pageTemplate({
      title: 'Cybersecurity, Auth & OSINT Glossary — 30 Terms',
      description: 'Thirty cybersecurity, cryptography, web security, and OSINT terms defined with technical breakdowns: Argon2id, k-anonymity, passkeys, IDOR, SSRF, JWT, and more.',
      route: '/glossary',
      activeNav: '/articles',
      jsonld: [hubBreadcrumb],
      bodyHtml: hubBody
    })
  );

  GLOSSARY_TERMS.forEach((t, idx) => {
    const route = `/glossary/${t.slug}`;
    const canonical = `${SITE}${route}`;
    const peers = [
      GLOSSARY_TERMS[(idx + 1) % GLOSSARY_TERMS.length],
      GLOSSARY_TERMS[(idx + 2) % GLOSSARY_TERMS.length],
      GLOSSARY_TERMS[(idx + 3) % GLOSSARY_TERMS.length]
    ];

    const termSchema = {
      '@context': 'https://schema.org',
      '@type': 'DefinedTerm',
      name: t.term,
      description: clampDesc(t.shortDef),
      url: canonical,
      inDefinedTermSet: `${SITE}/glossary`
    };
    const faqSchema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: `What is ${t.term} in cybersecurity?`,
          acceptedAnswer: { '@type': 'Answer', text: t.shortDef }
        },
        {
          '@type': 'Question',
          name: `How do you defend against or implement ${t.term} securely?`,
          acceptedAnswer: { '@type': 'Answer', text: t.mitigation }
        }
      ]
    };
    const breadcrumb = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: 'Security Glossary', item: `${SITE}/glossary` },
        { '@type': 'ListItem', position: 3, name: t.term, item: canonical }
      ]
    };

    const bodyHtml = `
<section class="article-hero">
  <div class="container container-narrow">
    <nav aria-label="Breadcrumb" class="crumb small muted"><a href="/" style="color:var(--purple)">Home</a> <span class="divider-dot">/</span> <a href="/glossary" style="color:var(--purple)">Security Glossary</a> <span class="divider-dot">/</span> <span>${esc(t.term)}</span></nav>
    <div class="small muted mt-12" style="font-weight:600">${esc(t.category)}</div>
    <h1 class="h-1 mt-8">What Is ${esc(t.term)}? Definition, Architecture &amp; Defense</h1>
    <div class="card card-pad mt-16">
      <p style="margin:0;font-size:1.05rem;line-height:1.65"><strong>Quick Definition:</strong> ${esc(t.shortDef)}</p>
    </div>
  </div>
</section>
<section class="section-tight">
  <div class="container container-narrow">
    <article class="prose">
      <h2>How ${esc(t.term)} Works in Practice</h2>
      <p>${esc(t.howItWorks)}</p>

      <h2>Defensive Mitigation &amp; Hardening Checklist</h2>
      <p>${esc(t.mitigation)}</p>

      <h2>Hands-On Tool &amp; Academy Lesson</h2>
      <div class="grid grid-2 mt-16" style="gap:16px">
        <a class="card card-pad card-link" href="${esc(t.relatedTool.url)}">
          <div class="small muted">Interactive Tool / Guide</div>
          <h3 class="h-3 mt-8" style="margin-bottom:0">${esc(t.relatedTool.label)} →</h3>
        </a>
        <a class="card card-pad card-link" href="${esc(t.relatedLesson.url)}">
          <div class="small muted">OMP Academy Lesson</div>
          <h3 class="h-3 mt-8" style="margin-bottom:0">${esc(t.relatedLesson.label)} →</h3>
        </a>
      </div>

      <hr class="hr-fade" style="margin-top:40px">
      <h2>Related Security Glossary Terms</h2>
      <div class="grid grid-3 mt-16" style="gap:12px">
        ${peers.map((p) => `<a class="card card-pad card-link" href="/glossary/${esc(p.slug)}"><strong>${esc(p.term)}</strong><p class="small muted mt-8" style="margin-bottom:0">${esc(p.category)} →</p></a>`).join('')}
      </div>
    </article>
  </div>
</section>`;

    fs.writeFileSync(
      path.join(dir, `${t.slug}.html`),
      pageTemplate({
        title: `What Is ${t.term}? Security Glossary`,
        description: t.shortDef,
        route,
        activeNav: '/articles',
        ogType: 'article',
        jsonld: [termSchema, faqSchema, breadcrumb],
        bodyHtml
      })
    );
  });
}

/* ============================================================
   STEP 5: Update /tools.html with All 11 Tools + New Hubs
   ============================================================ */
function updateToolsHubPage() {
  const file = path.join(ROOT, 'tools.html');
  let html = fs.readFileSync(file, 'utf8');

  // Replace description & title counts if needed and inject the 3 new tool cards + 3 reference hubs
  const newCardsHtml = `<a href="/dork-builder" class="card tool-card card-link">
  <div class="tool-top"><span class="card-icon"><svg class="icon-22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></span><span class="badge badge-live">Live</span></div>
  <h2 class="tool-card-title">OSINT Dork Builder</h2>
  <p>Compose Google, GitHub, and Shodan search operators visually with 24 defensive recon presets.</p>
  <span class="tool-cta">Build search query ${ICON_ARROW}</span></a>
<a href="/hash-inspector" class="card tool-card card-link">
  <div class="tool-top"><span class="card-icon"><svg class="icon-22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span><span class="badge badge-live">Live</span></div>
  <h2 class="tool-card-title">Hash &amp; JWT Inspector</h2>
  <p>Offline WebCrypto SHA-256/512 calculator, password hash identifier, JWT security auditor, and Base64/Hex encoder.</p>
  <span class="tool-cta">Inspect hash or JWT ${ICON_ARROW}</span></a>
<a href="/url-scanner" class="card tool-card card-link">
  <div class="tool-top"><span class="card-icon"><svg class="icon-22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></span><span class="badge badge-live">Live</span></div>
  <h2 class="tool-card-title">Phishing URL Scanner</h2>
  <p>Client-side lexical URL analyzer detecting IDN homograph punycode (xn--), @-authority tricks, and brand typosquatting.</p>
  <span class="tool-cta">Scan a link locally ${ICON_ARROW}</span></a>
<a href="/compare" class="card tool-card card-link">
  <div class="tool-top"><span class="card-icon"><svg class="icon-22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="M21 3l-7 7"/><path d="M3 3l7 7"/></svg></span><span class="badge badge-live">12 Guides</span></div>
  <h2 class="tool-card-title">Tool Comparisons (VS)</h2>
  <p>Head-to-head technical matrices: Bitwarden vs 1Password, Nmap vs Masscan, Burp vs ZAP, Sherlock vs Maigret.</p>
  <span class="tool-cta">Compare tools ${ICON_ARROW}</span></a>`;

  if (!html.includes('href="/dork-builder" class="card tool-card')) {
    html = html.replace(
      /(<a href="\/security-checklist" class="card tool-card card-link">[\s\S]*?<\/a>)<\/div>/,
      `$1${newCardsHtml}</div>`
    );
  }
  html = html.replace(/<footer class="site-footer">[\s\S]*?<\/footer>/, UPDATED_FOOTER);
  fs.writeFileSync(file, html);
}

/* ============================================================
   STEP 6: Enhance Articles & OSINT/Pentest Pages with FAQPage JSON-LD,
           Static Hub Crawlability, and Cross-Pillar Topical Mesh
   ============================================================ */
function extractTitleFromFile(filePath, fallbackSlug) {
  const html = fs.readFileSync(filePath, 'utf8');
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return h1[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const t = html.match(/<title>([\s\S]*?)<\/title>/i);
  if (t) return t[1].replace(/\s*[|—-]\s*OopsMyPassword.*$/i, '').trim();
  return fallbackSlug;
}

function extractLastmodFromFile(filePath, snapshotMap, routeKey) {
  if (snapshotMap && snapshotMap.has(routeKey)) return snapshotMap.get(routeKey);
  const html = fs.readFileSync(filePath, 'utf8');
  const modMeta = html.match(/<meta\s+property="article:(?:modified_time|published_time)"\s+content="(\d{4}-\d{2}-\d{2})/i);
  if (modMeta) return modMeta[1];
  const jsonMod = html.match(/"date(?:Modified|Published)"\s*:\s*"(\d{4}-\d{2}-\d{2})/i);
  if (jsonMod) return jsonMod[1];
  return '2026-10-08';
}

function enhanceExistingPagesWithMeshAndSchema() {
  // Restore clean noindex redirect stub for guides.html so it never causes Search Console errors
  const GUIDES_REDIRECT_STUB = `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Guides have moved — OopsMyPassword</title>
  <meta name="description" content="Guides now live inside the Articles hub: security news, deep dives, how-tos and guides in one place.">
  <!-- noindex + no canonical: this stub exists only as a fallback for the
       Firebase 301 from /guides.html, so it must never enter the index. -->
  <meta name="robots" content="noindex">
  <meta http-equiv="refresh" content="0; url=/articles">
  <meta name="theme-color" content="#050811">
  <link rel="icon" href="/assets/icons/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/assets/css/styles.css">
  <script src="/assets/js/theme-init.js"></script>
</head>
<body>
<main id="main" style="min-height:60vh;display:flex;align-items:center;justify-content:center;text-align:center;padding:48px 20px">
  <div class="container" style="max-width:620px">
    <span class="eyebrow">Guides have moved</span>
    <h1 class="h-2" style="margin-top:12px">Guides are now part of <span class="grad-text">Articles</span></h1>
    <p class="lead" style="margin-top:14px">Everything we publish — security news, deep dives, how-tos and guides — lives in one place now.</p>
    <p style="margin-top:24px"><a class="btn btn-primary" href="/articles">Continue to Articles</a></p>
    <p class="meta" style="margin-top:18px">Redirecting you automatically…</p>
  </div>
</main>
<noscript>
  <p style="text-align:center;padding:0 20px 48px"><a href="/articles" style="color:var(--purple)">Go to Articles →</a></p>
</noscript>
</body>
</html>
`;
  fs.writeFileSync(path.join(ROOT, 'guides.html'), GUIDES_REDIRECT_STUB);

  // Update both shared footer files so test_site_contracts.js stays in sync
  fs.writeFileSync(path.join(ROOT, 'tools/site-footer.html'), UPDATED_FOOTER);
  fs.writeFileSync(path.join(ROOT, 'functions/site-footer.fragment'), UPDATED_FOOTER);

  // Walk all HTML files to update footer and add RSS alternate link
  function* walkHtml(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (['.git', 'node_modules', 'tools', 'functions', 'supabase', '.firebase', '.github', 'Anony.su'].includes(entry.name)) continue;
        yield* walkHtml(path.join(dir, entry.name));
      } else if (entry.name.endsWith('.html')) {
        yield path.join(dir, entry.name);
      }
    }
  }

  for (const file of walkHtml(ROOT)) {
    const rel = path.relative(ROOT, file).split(path.sep).join('/');
    if (rel === 'guides.html' || rel === '404.html') continue;

    let html = fs.readFileSync(file, 'utf8');

    // 1. Sync footer on all pages so new hubs (/compare, /cheatsheets, /dork-builder, /hash-inspector, /url-scanner) get strong site-wide links
    if (html.includes('<footer class="site-footer">')) {
      html = html.replace(/<footer class="site-footer">[\s\S]*?<\/footer>/, UPDATED_FOOTER);
    }

    // 2. Add RSS <link rel="alternate"> if not present
    if (!html.includes('application/rss+xml') && html.includes('</head>')) {
      html = html.replace('</head>', `  <link rel="alternate" type="application/rss+xml" title="OopsMyPassword Security Feed" href="${SITE}/rss.xml">\n</head>`);
    }

    // 3. For /articles/*.html and /guides/*.html: inject FAQPage JSON-LD if not present + Related Tools & Academy mesh
    if ((rel.startsWith('articles/') || rel.startsWith('guides/')) && !html.includes('"@type":"FAQPage"') && !html.includes('"@type": "FAQPage"')) {
      const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      const descMatch = html.match(/<meta name="description" content="([^"]+)"/i);
      const h1Text = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : 'this cybersecurity topic';
      const descText = descMatch ? descMatch[1].trim() : '';
      if (h1Text && descText) {
        const faqObj = {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: [
            {
              '@type': 'Question',
              name: `What is the key takeaway of ${h1Text}?`,
              acceptedAnswer: { '@type': 'Answer', text: descText }
            },
            {
              '@type': 'Question',
              name: 'How can I test or apply these security practices safely?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'Use client-side verification tools on OopsMyPassword—including the Password Checker, Breach Check k-anonymity demo, Phishing URL Scanner, and Hash/JWT Inspector—where inputs never leave your browser.'
              }
            }
          ]
        };
        html = html.replace('</head>', `<script type="application/ld+json">${escJson(faqObj)}</script></head>`);
      }
    }

    // Inject Cross-Pillar Topical Mesh into articles if not already present
    if ((rel.startsWith('articles/') || rel.startsWith('guides/')) && !html.includes('data-topical-mesh')) {
      const meshHtml = `<div class="card card-pad mt-24" data-topical-mesh><div class="small muted" style="font-weight:600">Hands-On Security Practice</div><p class="small mt-8" style="margin-bottom:10px">Apply what you learned with our zero-telemetry tools and references:</p><div class="flex gap-8 wrap"><a class="btn btn-secondary btn-sm" href="/checker">Password Checker</a><a class="btn btn-secondary btn-sm" href="/url-scanner">Phishing URL Scanner</a><a class="btn btn-secondary btn-sm" href="/hash-inspector">Hash &amp; JWT Inspector</a><a class="btn btn-secondary btn-sm" href="/dork-builder">OSINT Dork Builder</a><a class="btn btn-ghost btn-sm" href="/compare">Tool Comparisons</a><a class="btn btn-ghost btn-sm" href="/cheatsheets">CLI Cheat Sheets</a><a class="btn btn-ghost btn-sm" href="/glossary">Security Glossary</a></div></div>`;
      if (html.includes('<div class="callout callout-info">')) {
        html = html.replace('<div class="callout callout-info">', `${meshHtml}<div class="callout callout-info">`);
      }
    }

    // 4. For /osint/*.html and /pentest/*.html: inject FAQPage JSON-LD if not present
    if ((rel.startsWith('osint/') || rel.startsWith('pentest/')) && !rel.startsWith('pentest/category/') && !html.includes('"@type":"FAQPage"')) {
      const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      const descMatch = html.match(/<meta name="description" content="([^"]+)"/i);
      const toolName = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : 'this security tool';
      const descText = descMatch ? descMatch[1].trim() : '';
      if (toolName && descText) {
        const faqObj = {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: [
            {
              '@type': 'Question',
              name: `What is ${toolName} used for in cybersecurity?`,
              acceptedAnswer: { '@type': 'Answer', text: descText }
            },
            {
              '@type': 'Question',
              name: `Is ${toolName} legal to use?`,
              acceptedAnswer: {
                '@type': 'Answer',
                text: `${toolName} is a dual-use security utility. Always obtain explicit written authorization before scanning, enumerating, or testing any domain, network, or account you do not own.`
              }
            }
          ]
        };
        html = html.replace('</head>', `<script type="application/ld+json">${escJson(faqObj)}</script></head>`);
      }
    }

    fs.writeFileSync(file, html);
  }

  // 5. Inject Static Crawlable Links on Hub Pages (/articles, /products, /osint, /pentest)
  // so Googlebot discovers every database-backed page directly from static HTML!
  const dbArticles = fs.existsSync(path.join(ROOT, 'articles'))
    ? fs.readdirSync(path.join(ROOT, 'articles')).filter((f) => f.endsWith('.html')).sort().map((f) => {
        const slug = f.replace(/\.html$/, '');
        return { slug, url: `/articles/${slug}`, title: extractTitleFromFile(path.join(ROOT, 'articles', f), slug) };
      })
    : [];

  const guideArticles = fs.existsSync(path.join(ROOT, 'guides'))
    ? fs.readdirSync(path.join(ROOT, 'guides')).filter((f) => f.endsWith('.html')).sort().map((f) => {
        const slug = f.replace(/\.html$/, '');
        return { slug, url: `/articles/${slug}`, title: extractTitleFromFile(path.join(ROOT, 'guides', f), slug) };
      })
    : [];

  const dbProducts = fs.existsSync(path.join(ROOT, 'products'))
    ? fs.readdirSync(path.join(ROOT, 'products')).filter((f) => f.endsWith('.html')).sort().map((f) => {
        const slug = f.replace(/\.html$/, '');
        return { slug, url: `/products/${slug}`, title: extractTitleFromFile(path.join(ROOT, 'products', f), slug) };
      })
    : [];

  const dbOsint = fs.existsSync(path.join(ROOT, 'osint'))
    ? fs.readdirSync(path.join(ROOT, 'osint')).filter((f) => f.endsWith('.html')).sort().map((f) => {
        const slug = f.replace(/\.html$/, '');
        return { slug, url: `/osint/${slug}`, title: extractTitleFromFile(path.join(ROOT, 'osint', f), slug) };
      })
    : [];

  const dbPentest = fs.existsSync(path.join(ROOT, 'pentest'))
    ? fs.readdirSync(path.join(ROOT, 'pentest')).filter((f) => f.endsWith('.html')).sort().map((f) => {
        const slug = f.replace(/\.html$/, '');
        return { slug, url: `/pentest/${slug}`, title: extractTitleFromFile(path.join(ROOT, 'pentest', f), slug) };
      })
    : [];

  const dbPentestCats = fs.existsSync(path.join(ROOT, 'pentest/category'))
    ? fs.readdirSync(path.join(ROOT, 'pentest/category')).filter((f) => f.endsWith('.html')).sort().map((f) => {
        const slug = f.replace(/\.html$/, '');
        return { slug, url: `/pentest/category/${slug}`, title: extractTitleFromFile(path.join(ROOT, 'pentest/category', f), slug) };
      })
    : [];

  // Update articles.html <noscript> with all 30 articles (15 guides + 15 DB articles)
  const articlesHubPath = path.join(ROOT, 'articles.html');
  if (fs.existsSync(articlesHubPath)) {
    let aHtml = fs.readFileSync(articlesHubPath, 'utf8');
    const allArticles = [...guideArticles, ...dbArticles];
    const listHtml = allArticles.map((a) => `        <li><a href="${esc(a.url)}" style="color:var(--purple)">${esc(a.title)}</a></li>`).join('\n');
    aHtml = aHtml.replace(
      /<noscript>[\s\S]*?<\/noscript>/,
      `<noscript>\n      <div class="notice-band mt-24"><p>All ${allArticles.length} security articles and guides are available as static HTML pages below:</p>\n      <ul style="columns:2;column-gap:28px;margin-top:10px;padding-left:18px;text-align:left">\n${listHtml}\n      </ul></div>\n    </noscript>`
    );
    fs.writeFileSync(articlesHubPath, aHtml);
  }

  // Update products.html <noscript> so it links all published products instead of saying "There are no products for sale today"
  const productsHubPath = path.join(ROOT, 'products.html');
  if (fs.existsSync(productsHubPath) && dbProducts.length) {
    let pHtml = fs.readFileSync(productsHubPath, 'utf8');
    const pLinks = dbProducts.map((p) => `<li><a href="${esc(p.url)}" style="color:var(--purple)">${esc(p.title)}</a></li>`).join('');
    pHtml = pHtml.replace(
      /<noscript>[\s\S]*?<\/noscript>/,
      `<noscript>\n      <div class="notice-band mt-24"><p>Browse published security books, courses, and resources:</p><ul style="margin-top:10px;padding-left:18px;text-align:left">${pLinks}</ul></div>\n    </noscript>`
    );
    fs.writeFileSync(productsHubPath, pHtml);
  }

  // Update osint.html <noscript> so all 10 OSINT tool pages are directly linked from static HTML
  const osintHubPath = path.join(ROOT, 'osint.html');
  if (fs.existsSync(osintHubPath) && dbOsint.length) {
    let oHtml = fs.readFileSync(osintHubPath, 'utf8');
    const oLinks = dbOsint.map((o) => `<li><a href="${esc(o.url)}" style="color:var(--purple)">${esc(o.title)}</a></li>`).join('');
    oHtml = oHtml.replace(
      /<noscript>[\s\S]*?<\/noscript>/,
      `<noscript>\n      <div class="notice-band mt-24"><p>Browse all OSINT tool guides directly (also see <a href="/articles/best-free-osint-tools-for-beginners" style="color:var(--purple)">Best Free OSINT Tools for Beginners</a>):</p><ul style="columns:2;column-gap:24px;margin-top:10px;padding-left:18px;text-align:left">${oLinks}</ul></div>\n    </noscript>`
    );
    fs.writeFileSync(osintHubPath, oHtml);
  }

  // Update pentest.html <noscript> so all 37 Pentest tool pages + 13 category pages are directly linked from static HTML
  const pentestHubPath = path.join(ROOT, 'pentest.html');
  if (fs.existsSync(pentestHubPath) && dbPentest.length) {
    let ptHtml = fs.readFileSync(pentestHubPath, 'utf8');
    const ptLinks = [...dbPentest, ...dbPentestCats].map((t) => `<li><a href="${esc(t.url)}" style="color:var(--purple)">${esc(t.title)}</a></li>`).join('');
    ptHtml = ptHtml.replace(
      /<noscript>[\s\S]*?<\/noscript>/,
      `<noscript>\n      <div class="notice-band mt-24"><p>Browse all authorized penetration testing tool guides and categories directly (or start with the <a href="/learning" style="color:var(--purple)">OMP Academy</a>):</p><ul style="columns:3;column-gap:24px;margin-top:10px;padding-left:18px;text-align:left">${ptLinks}</ul></div>\n    </noscript>`
    );
    fs.writeFileSync(pentestHubPath, ptHtml);
  }
}

/* ============================================================
   STEP 7: Build /sitemap.html, /rss.xml, /llms.txt, /llms-full.txt
           and Synchronize sitemap.xml + google-sitemap.xml + sitemap-index.xml
   ============================================================ */
async function buildSitemapAndFeeds() {
  const dbArticles = fs.existsSync(path.join(ROOT, 'articles'))
    ? fs.readdirSync(path.join(ROOT, 'articles')).filter((f) => f.endsWith('.html')).sort().map((f) => {
        const slug = f.replace(/\.html$/, '');
        return { slug, url: `/articles/${slug}`, title: extractTitleFromFile(path.join(ROOT, 'articles', f), slug), file: path.join(ROOT, 'articles', f) };
      })
    : [];

  const dbProducts = fs.existsSync(path.join(ROOT, 'products'))
    ? fs.readdirSync(path.join(ROOT, 'products')).filter((f) => f.endsWith('.html')).sort().map((f) => {
        const slug = f.replace(/\.html$/, '');
        return { slug, url: `/products/${slug}`, title: extractTitleFromFile(path.join(ROOT, 'products', f), slug), file: path.join(ROOT, 'products', f) };
      })
    : [];

  const dbOsint = fs.existsSync(path.join(ROOT, 'osint'))
    ? fs.readdirSync(path.join(ROOT, 'osint')).filter((f) => f.endsWith('.html')).sort().map((f) => {
        const slug = f.replace(/\.html$/, '');
        return { slug, url: `/osint/${slug}`, title: extractTitleFromFile(path.join(ROOT, 'osint', f), slug), file: path.join(ROOT, 'osint', f) };
      })
    : [];

  const dbPentest = fs.existsSync(path.join(ROOT, 'pentest'))
    ? fs.readdirSync(path.join(ROOT, 'pentest')).filter((f) => f.endsWith('.html')).sort().map((f) => {
        const slug = f.replace(/\.html$/, '');
        return { slug, url: `/pentest/${slug}`, title: extractTitleFromFile(path.join(ROOT, 'pentest', f), slug), file: path.join(ROOT, 'pentest', f) };
      })
    : [];

  const dbPentestCats = fs.existsSync(path.join(ROOT, 'pentest/category'))
    ? fs.readdirSync(path.join(ROOT, 'pentest/category')).filter((f) => f.endsWith('.html')).sort().map((f) => {
        const slug = f.replace(/\.html$/, '');
        return { slug, url: `/pentest/category/${slug}`, title: extractTitleFromFile(path.join(ROOT, 'pentest/category', f), slug), file: path.join(ROOT, 'pentest/category', f) };
      })
    : [];

  // 1. Update /sitemap.html so every tool, comparison, cheat sheet, glossary term, and DB-published page is linked directly from the HTML Sitemap Hub, while preserving data-sitemap-live!
  const sitemapFile = path.join(ROOT, 'sitemap.html');
  let sitemapHtml = fs.readFileSync(sitemapFile, 'utf8');

  const compareLinks = COMPARISONS.map((c) => `<li><a href="/compare/${esc(c.slug)}">${esc(c.shortTitle)}</a></li>`).join('');
  const cheatsheetLinks = CHEATSHEETS.map((c) => `<li><a href="/cheatsheets/${esc(c.slug)}">${esc(c.shortTitle)}</a></li>`).join('');
  const glossaryLinks = GLOSSARY_TERMS.map((g) => `<li><a href="/glossary/${esc(g.slug)}">${esc(g.term)}</a></li>`).join('');
  const dbArticleLinks = dbArticles.map((a) => `<li><a href="${esc(a.url)}">${esc(a.title)}</a></li>`).join('');
  const dbProductLinks = dbProducts.map((p) => `<li><a href="${esc(p.url)}">${esc(p.title)}</a></li>`).join('');
  const dbOsintLinks = dbOsint.map((o) => `<li><a href="${esc(o.url)}">${esc(o.title)}</a></li>`).join('');
  const dbPentestLinks = dbPentest.map((p) => `<li><a href="${esc(p.url)}">${esc(p.title)}</a></li>`).join('');
  const dbPentestCatLinks = dbPentestCats.map((c) => `<li><a href="${esc(c.url)}">${esc(c.title)}</a></li>`).join('');

  const expandedSitemapMain = `<main id="main">
<section class="page-hero">
  <div class="container">
    <span class="eyebrow">All pages</span>
    <h1 class="h-1">Sitemap</h1>
    <p class="lead">Every interactive tool, Academy course, OSINT &amp; Pentest reference, comparison, cheat sheet, glossary term, and article on OopsMyPassword. Machine-readable XML at <a href="/sitemap.xml" style="color:var(--purple)">/sitemap.xml</a>.</p>
  </div>
</section>
<section class="section-tight">
  <div class="container"><div class="grid grid-3 sitemap-grid">
    <div class="footer-col card card-pad"><div class="footer-col-title">Interactive Security Tools</div><ul><li><a href="/checker">Password Checker</a></li><li><a href="/generator">Password Generator</a></li><li><a href="/breach-check">Breach Check (k-Anonymity)</a></li><li><a href="/password-health">Password Health</a></li><li><a href="/passphrase">Passphrase Generator</a></li><li><a href="/entropy">Password Entropy Calculator</a></li><li><a href="/random-string">Random String Generator</a></li><li><a href="/security-checklist">Security Checklist</a></li><li><a href="/dork-builder">Google Dork &amp; OSINT Builder</a></li><li><a href="/hash-inspector">Hash, JWT &amp; Encoding Inspector</a></li><li><a href="/url-scanner">Phishing URL Risk Scanner</a></li><li><a href="/tools">All Tools Hub</a></li></ul></div>
    <div class="footer-col card card-pad"><div class="footer-col-title">Academy &amp; Hubs</div><ul><li><a href="/learning">Academy Home</a></li><li><a href="/learning/roadmap">Learning Paths &amp; Roadmap</a></li><li><a href="/learning/cyber-security">Cyber Security Path</a></li><li><a href="/learning/cyber-security/cyber-security-track">Fundamentals to Defence Course</a></li><li><a href="/learning/web-application-security">Web Application Security Path</a></li><li><a href="/learning/web-application-security/foundations">Web Security Foundations Course</a></li><li><a href="/osint">OSINT Hub</a></li><li><a href="/pentest">Pentest Hub</a></li><li><a href="/articles">Articles Hub</a></li><li><a href="/products">Products</a></li></ul></div>
    <div class="footer-col card card-pad"><div class="footer-col-title">Tool Comparisons (<a href="/compare">/compare</a>)</div><ul>${compareLinks}</ul></div>
    <div class="footer-col card card-pad"><div class="footer-col-title">CLI Cheat Sheets (<a href="/cheatsheets">/cheatsheets</a>)</div><ul>${cheatsheetLinks}</ul></div>
    <div class="footer-col card card-pad"><div class="footer-col-title">Core Guides &amp; Site</div><ul><li><a href="/articles/create-strong-password">How to Create a Strong Password</a></li><li><a href="/articles/password-best-practices">Password Security Best Practices</a></li><li><a href="/articles/common-password-mistakes">Common Password Mistakes</a></li><li><a href="/articles/password-manager-benefits">Password Manager Benefits</a></li><li><a href="/articles/two-factor-authentication">Two-Factor Authentication (2FA)</a></li><li><a href="/articles/passkeys-explained">Passkeys Explained</a></li><li><a href="/articles/after-a-data-breach">What to Do After a Data Breach</a></li><li><a href="/articles/phishing-attacks">How Phishing Attacks Steal Passwords</a></li><li><a href="/articles/password-vs-passkey">Password vs Passkey</a></li><li><a href="/articles/password-entropy">How Password Entropy Works</a></li><li><a href="/articles/how-long-should-a-password-be">How Long Should a Password Be?</a></li><li><a href="/articles/password-cracking-time-table">Password Cracking Times</a></li><li><a href="/articles/are-password-managers-safe">Are Password Managers Safe?</a></li><li><a href="/articles/check-if-password-was-leaked">Check If Your Password Was Leaked</a></li><li><a href="/articles/password-vs-passphrase">Password vs Passphrase</a></li><li><a href="/">Home</a></li><li><a href="/about">About</a></li><li><a href="/faq">FAQ</a></li><li><a href="/security">Security</a></li><li><a href="/privacy">Privacy</a></li><li><a href="/terms">Terms</a></li><li><a href="/contact">Contact</a></li><li><a href="/rss.xml">RSS Feed</a></li><li><a href="/llms.txt">LLMs.txt</a></li></ul></div>
    <div class="footer-col card card-pad"><div class="footer-col-title">Security Glossary (<a href="/glossary">/glossary</a>)</div><ul>${glossaryLinks}</ul></div>
    <div class="footer-col card card-pad"><div class="footer-col-title">Published Security Articles</div><ul>${dbArticleLinks}</ul></div>
    <div class="footer-col card card-pad"><div class="footer-col-title">OSINT Tools &amp; Products</div><ul>${dbOsintLinks}${dbProductLinks}</ul></div>
    <div class="footer-col card card-pad"><div class="footer-col-title">Pentest Tools &amp; Categories</div><ul>${dbPentestCatLinks}${dbPentestLinks}</ul></div>
  </div></div>
</section>
<section class="section-tight" data-sitemap-live hidden>
  <div class="container">
    <h2 class="h-3">Live articles &amp; products</h2>
    <p class="muted small" style="margin-top:6px">Published from the admin panel — the same entries the XML sitemap lists.</p>
    <div class="grid grid-2 sitemap-grid mt-16" data-sitemap-live-grid></div>
  </div>
</section>
</main>`;

  sitemapHtml = sitemapHtml.replace(/<main id="main">[\s\S]*?<\/main>/, expandedSitemapMain);
  if (!sitemapHtml.includes('/assets/js/sitemap.js')) {
    sitemapHtml = sitemapHtml.replace('</body>', '<script src="/assets/js/sitemap.js" defer></script>\n</body>');
  }
  fs.writeFileSync(sitemapFile, sitemapHtml);

  // 2. Build /rss.xml (RSS 2.0 Feed)
  const rssItems = [
    ...dbArticles.map((a) => ({
      title: a.title,
      link: `${SITE}${a.url}`,
      desc: a.title,
      category: 'Security Research'
    })),
    ...COMPARISONS.map((c) => ({
      title: c.title,
      link: `${SITE}/compare/${c.slug}`,
      desc: c.summary,
      category: c.category
    })),
    ...CHEATSHEETS.map((c) => ({
      title: c.title,
      link: `${SITE}/cheatsheets/${c.slug}`,
      desc: c.summary,
      category: c.category
    }))
  ];
  const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>OopsMyPassword — Cybersecurity, OSINT &amp; Privacy Feed</title>
    <link>${SITE}/</link>
    <description>Privacy-first password security tools, OSINT &amp; Pentest guides, CLI cheat sheets, and Academy lessons.</description>
    <language>en-us</language>
    <atom:link href="${SITE}/rss.xml" rel="self" type="application/rss+xml"/>
${rssItems.map((it) => `    <item>
      <title>${esc(it.title)}</title>
      <link>${esc(it.link)}</link>
      <guid isPermaLink="true">${esc(it.link)}</guid>
      <category>${esc(it.category)}</category>
      <description>${esc(it.desc)}</description>
    </item>`).join('\n')}
  </channel>
</rss>
`;
  fs.writeFileSync(path.join(ROOT, 'rss.xml'), rssXml);

  // 3. Build /llms.txt and /llms-full.txt for AI Search Engines
  const llmsTxt = `# OopsMyPassword (https://oopsmypassword.web.app)

> Privacy-first cybersecurity tools, structured Academy courses (Cyber Security, OSINT, Pentesting, Web Application Security), OSINT & Pentest tool directories, CLI cheat sheets, and technical security guides. All interactive tools run 100% client-side in the browser with zero telemetry.

## Interactive Client-Side Security Tools
- [Password Strength Checker](${SITE}/checker): Real-time local entropy, pattern detection, and crack-time estimation.
- [CSPRNG Password Generator](${SITE}/generator): Generates random passwords using window.crypto.getRandomValues().
- [Breach Check (k-Anonymity Demo)](${SITE}/breach-check): Zero-knowledge 5-hex-character SHA-1 prefix range lookup.
- [Google Dork & OSINT Search Query Builder](${SITE}/dork-builder): Visual composer for site:, filetype:, inurl:, intitle:, and intext: queries with 24 presets.
- [Client-Side Hash, JWT & Encoding Inspector](${SITE}/hash-inspector): Offline WebCrypto SHA-256/384/512 calculator, password hash identifier, and JWT security auditor.
- [Phishing URL & Suspicious Link Risk Scanner](${SITE}/url-scanner): Lexical URL analyzer for IDN homograph punycode (xn--), @-authority confusion, and brand typosquatting.
- [Diceware Passphrase Generator](${SITE}/passphrase): Multi-word passphrases with exact bit-entropy calculation.
- [Password Entropy Calculator](${SITE}/entropy): Interactive character pool and keyspace calculator.
- [Password Health Audit](${SITE}/password-health): 10-point local credential hygiene check.
- [Security Checklist](${SITE}/security-checklist): 16-step account hardening tracker.

## Structured Academy Tracks & Hubs
- [OMP Academy Home](${SITE}/learning): 118+ interactive lessons with 4-question self-checks and Full/Step reader modes.
- [OSINT Hub](${SITE}/osint): 20+ OSINT investigation tools with interactive CLI builders and side-by-side comparison drawer.
- [Pentest Hub](${SITE}/pentest): Authorized penetration testing tools by phase with interactive CLI command builders.
- [Tool Comparisons Hub](${SITE}/compare): 12 head-to-head technical comparisons.
- [CLI Cheat Sheets Hub](${SITE}/cheatsheets): 10 interactive, printable command references.
- [Security Glossary](${SITE}/glossary): 30 foundational security, cryptography, and OSINT term deep-dives.
- [Articles & Security Research](${SITE}/articles): Long-form cybersecurity guides and threat analysis.
`;
  fs.writeFileSync(path.join(ROOT, 'llms.txt'), llmsTxt);
  fs.writeFileSync(
    path.join(ROOT, 'llms-full.txt'),
    llmsTxt +
      '\n## Tool Comparisons\n' +
      COMPARISONS.map((c) => `- [${c.title}](${SITE}/compare/${c.slug}): ${c.summary}`).join('\n') +
      '\n\n## CLI Cheat Sheets\n' +
      CHEATSHEETS.map((c) => `- [${c.title}](${SITE}/cheatsheets/${c.slug}): ${c.summary}`).join('\n') +
      '\n\n## Security Glossary Terms\n' +
      GLOSSARY_TERMS.map((g) => `- [${g.term}](${SITE}/glossary/${g.slug}): ${g.shortDef}`).join('\n') +
      '\n'
  );

  // 4. Build complete, canonical, multi-line sitemap.xml, google-sitemap.xml, and sitemap-index.xml
  // Read hubs-snapshot.json for timestamps when available
  const snapshotMap = new Map();
  const snapPath = path.join(ROOT, 'assets/data/hubs-snapshot.json');
  if (fs.existsSync(snapPath)) {
    try {
      const snap = JSON.parse(fs.readFileSync(snapPath, 'utf8'));
      const fmt = (v) => {
        if (!v) return '';
        const ms = Date.parse(v);
        return Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : '';
      };
      for (const a of snap.articles || []) if (a && a.slug) snapshotMap.set(`/articles/${a.slug}`, fmt(a.updated_at || a.published_at || a.created_at));
      for (const p of snap.products || []) if (p && p.slug) snapshotMap.set(`/products/${p.slug}`, fmt(p.updated_at || p.published_at || p.created_at));
      for (const o of snap.osint || []) if (o && o.slug) snapshotMap.set(`/osint/${o.slug}`, fmt(o.updated_at || o.published_at || o.created_at));
      for (const t of snap.pentest || []) if (t && t.slug) snapshotMap.set(`/pentest/${t.slug}`, fmt(t.updated_at || t.published_at || t.created_at));
      for (const c of snap.pentestCategories || []) if (c && c.slug) snapshotMap.set(`/pentest/category/${c.slug}`, fmt(c.updated_at || c.published_at || c.created_at));
    } catch { /* ignore */ }
  }

  const corePath = path.join(ROOT, 'supabase/functions/sitemap/sitemap-core.mjs');
  const core = await import('file://' + corePath);

  const entriesMap = new Map();
  const addEntry = (route, lastmod, changefreq, priority) => {
    const loc = route === '/' ? `${SITE}/` : `${SITE}${route.replace(/\/+$/, '')}`;
    if (!entriesMap.has(loc)) {
      entriesMap.set(loc, { loc, lastmod: lastmod || '', changefreq, priority });
    }
  };

  // Add all STATIC_ROUTES first (homepage '/' is #1, no <lastmod> on static generated routes)
  for (const route of core.STATIC_ROUTES) {
    addEntry(
      route,
      '',
      route === '/' ? 'weekly' : 'monthly',
      core.priorityForRoute(route)
    );
  }

  // Add all database-backed pages on disk with their real <lastmod> dates
  for (const a of dbArticles) {
    addEntry(a.url, extractLastmodFromFile(a.file, snapshotMap, a.url), 'monthly', '0.7');
  }
  for (const p of dbProducts) {
    addEntry(p.url, extractLastmodFromFile(p.file, snapshotMap, p.url), 'monthly', '0.7');
  }
  for (const o of dbOsint) {
    addEntry(o.url, extractLastmodFromFile(o.file, snapshotMap, o.url), 'monthly', '0.7');
  }
  for (const t of dbPentest) {
    addEntry(t.url, extractLastmodFromFile(t.file, snapshotMap, t.url), 'monthly', '0.7');
  }
  for (const c of dbPentestCats) {
    addEntry(c.url, extractLastmodFromFile(c.file, snapshotMap, c.url), 'monthly', '0.7');
  }

  const xmlLines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
  ];
  for (const u of entriesMap.values()) {
    xmlLines.push('  <url>');
    xmlLines.push(`    <loc>${esc(u.loc)}</loc>`);
    if (u.lastmod && /^\d{4}-\d{2}-\d{2}$/.test(u.lastmod)) {
      xmlLines.push(`    <lastmod>${esc(u.lastmod)}</lastmod>`);
    }
    xmlLines.push(`    <changefreq>${esc(u.changefreq)}</changefreq>`);
    xmlLines.push(`    <priority>${esc(u.priority)}</priority>`);
    xmlLines.push('  </url>');
  }
  xmlLines.push('</urlset>');
  const finalXml = xmlLines.join('\n') + '\n';

  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), finalXml);
  fs.writeFileSync(path.join(ROOT, 'google-sitemap.xml'), finalXml);

  // Also generate a clean /sitemap-index.xml pointing to /sitemap.xml
  const sitemapIndexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${SITE}/sitemap.xml</loc>
  </sitemap>
</sitemapindex>
`;
  fs.writeFileSync(path.join(ROOT, 'sitemap-index.xml'), sitemapIndexXml);
}

buildDorkBuilderPage();
buildHashInspectorPage();
buildUrlScannerPage();
buildComparisonsCluster();
buildCheatsheetsCluster();
buildGlossaryCluster();
updateToolsHubPage();
enhanceExistingPagesWithMeshAndSchema();
await buildSitemapAndFeeds();

console.log('Phase 3 SEO pages, interactive tools, schema, and 297-URL sitemaps built successfully.');

