# OMP — Tool Roadmap: Phase 1 vs Phase 2

> **Phase 1 = Browser-only.** Pure HTML/CSS/JS, no backend, no network requests to external targets.
> **Phase 2 = Requires backend.** Needs server-side networking, privileged sockets, DNS resolution, or arbitrary remote-target access.

## Why This Distinction Matters

The browser enforces CORS. JavaScript running in a tab **cannot** fetch headers from `example.com` unless `example.com` explicitly allows it with `Access-Control-Allow-Origin`. Same for DNS lookups, SSL handshakes, port scans, and TCP connections. OMP's Firebase Hosting is purely static. Any tool that needs arbitrary remote-target access belongs in Phase 2.

**Phase 1 rule:** Build ONLY tools that can actually run as a static Firebase Hosting page. For every proposed tool, first verify technically that its functionality can be implemented client-side. If it requires arbitrary remote-target access, server-side networking, privileged sockets, DNS resolution unavailable to the browser, or other backend capabilities — **skip it for Phase 1 and queue it for Phase 2.**

---

## Phase 1 ✅ — Pure Client-Side Tools

### Password & Entropy (8 tools — all built)
| # | Tool | Status |
|---|------|--------|
| — | Password Checker | ✅ Live |
| — | Password Generator | ✅ Live |
| — | Passphrase Generator | ✅ Live |
| — | Password Health | ✅ Live |
| — | Entropy Calculator | ✅ Live |
| — | Random String Generator | ✅ Live |
| — | Breach Check | ✅ Live (demo) |
| — | Security Checklist | ✅ Live |

### Browser Security (input-based, no remote fetch)
| # | Tool | Feasibility |
|---|------|-------------|
| — | **CSP Analyzer** — Parse pasted CSP header, tree view, bypass detection | ✅ Client-side |
| — | **CSP Directive Explorer** — Interactive directive reference | ✅ Pure static |
| — | **CSP Policy Builder** — Generate CSP from form inputs | ✅ Client-side |
| — | **CSP Violation Report Analyzer** — Parse pasted `report-uri` JSON | ✅ Client-side |
| — | **HSTS Preload Checker** — Check if domain is on Chromium HSTS preload list | ✅ `fetch()` to public preload list (hardcoded) |
| — | **X-Frame-Options Checker** — From pasted headers | ✅ Client-side |
| — | **X-Content-Type-Options Checker** — From pasted headers | ✅ Client-side |
| — | **Referrer Policy Analyzer** — From pasted headers | ✅ Client-side |
| — | **Permissions Policy Analyzer** — From pasted headers | ✅ Client-side |
| — | **Cookie Security Analyzer** — Parse pasted `Set-Cookie` headers | ✅ Client-side |
| — | **Mixed Content Checker** — Paste HTML, find `src="http://"` | ✅ Client-side |
| — | **Subresource Integrity Checker** — Paste `<script>` tags, verify `integrity=` | ✅ Client-side |
| — | **SRI Hash Generator** — Compute SHA-256/384/512 of pasted text | ✅ Client-side |

### Certificate / Key Tools (input-based only)
| # | Tool | Feasibility |
|---|------|-------------|
| — | **Certificate Decoder** — Decode PEM from pasted input | ✅ Client-side |
| — | **X.509 Certificate Parser** — Parse certificate from PEM | ✅ Client-side |
| — | **CSR Decoder** — Decode CSR from pasted PEM | ✅ Client-side |
| — | **PEM Certificate Converter** — Convert PEM ↔ DER ↔ Base64 | ✅ Client-side |
| — | **Certificate Fingerprint Generator** — MD5/SHA-1/SHA-256 from PEM | ✅ Client-side |

### URL / Content Analysis (no remote fetch)
| # | Tool | Feasibility |
|---|------|-------------|
| — | **URL Metadata Extractor** — Parse URL, show components | ✅ Client-side |
| — | **Favicon Hash Generator** — Compute MMH3/MurMurHash from uploaded file | ✅ Client-side |
| — | **Robots.txt Analyzer** — Paste robots.txt, find sensitive paths | ✅ Client-side |
| — | **Sitemap Security Analyzer** — Paste sitemap XML, find risky endpoints | ✅ Client-side |

### Hashing / Encoding / Crypto
| # | Tool | Feasibility |
|---|------|-------------|
| — | **Hash Generator** — SHA-1, SHA-256, SHA-512, MD5, BLAKE2 | ✅ `crypto.subtle` |
| — | **Base64 Encoder / Decoder** | ✅ Client-side |
| — | **URL Encoder / Decoder** | ✅ Client-side |
| — | **JWT Decoder** — Parse/display JWT without verification | ✅ Client-side |
| — | **JWT Validator** — Verify signature with pasted key (HS256) | ✅ Client-side |
| — | **UUID Generator / Validator** | ✅ Client-side |
| — | **BCrypt Hasher** — Compute BCrypt hash (via WASM build) | ✅ Client-side |

### Secrets / Patterns
| # | Tool | Feasibility |
|---|------|-------------|
| — | **API Key Pattern Scanner** — Scan pasted text for API key patterns | ✅ Client-side regex |
| — | **Private Key Detector** — Detect RSA/ECDSA/Ed25519/PGP keys in text | ✅ Client-side regex |
| — | **Leaked Secret Simulator** — Educational pattern detection | ✅ Client-side |
| — | **Git Secret Scanner** — Find `.git/`, `.env`, `.aws/`, SSH keys in paste | ✅ Client-side regex |

### Password / Authentication Education
| # | Tool | Feasibility |
|---|------|-------------|
| — | **Password Strength Visualizer** — Show entropy, patterns, crack time | ✅ Extend existing checker |
| — | **Passkey Simulator** — Educational passkey flow demo | ✅ Client-side (no real WebAuthn backend) |
| — | **2FA Code Generator** — TOTP (RFC 6238) — shared-secret only | ✅ Client-side |

---

## Phase 2 ❌ — Tools Requiring Backend

These need Firebase Cloud Functions (or equivalent) for arbitrary remote-target access. **Only implement after Phase 1 is complete and backend is designed.**

### 🌐 HTTP / Network (arbitrary remote fetch needed)
- **Security Headers Analyzer** — Fetch headers from any URL → **Blocked by CORS** without backend
- **HTTP Response Analyzer** — `fetch()` to arbitrary targets → **Blocked by CORS**
- **HTTP Method Checker** — OPTIONS/probe arbitrary URLs → **Blocked by CORS**
- **HTTP Status Checker** — Check status of arbitrary URL → **Blocked by CORS**
- **Redirect Chain Analyzer** — Follow redirects for any URL → **Blocked by CORS**
- **Redirect Loop Detector** — Same as above
- **HTTPS Enforcement Checker** — Check HTTP→HTTPS behavior → **Blocked by CORS**
- **CORS Security Analyzer** — Probe arbitrary origins → **Blocked by CORS**
- **Cache-Control Security Analyzer** — Fetch and check cache headers → **Blocked by CORS**
- **Content-Type Security Analyzer** — Fetch and check content-type → **Blocked by CORS**
- **Compression Security Checker** — Check compression config → **Blocked by CORS**
- **Cross-Origin Isolation Checker** — Fetch and check COOP/COEP → **Blocked by CORS**
- **TLS Handshake Analyzer** — Raw TLS inspection → **Not possible in browser**
- **OCSP Status Checker** — HTTP request to OCSP responder → **CORS**

### 🔐 SSL / TLS / Certificates (remote connections needed)
- **SSL Certificate Analyzer** — Connect to remote port 443 → **Requires backend**
- **TLS Configuration Analyzer** — Full TLS handshake → **Requires backend**
- **TLS Version Checker** — Probe TLS version → **Requires backend**
- **TLS Cipher Analyzer** — Check cipher suites → **Requires backend**
- **Certificate Expiry Checker** — Connect to target → **Requires backend**
- **Certificate Chain Analyzer** — Fetch full chain → **Requires backend**
- **Certificate Transparency Lookup** — Query CT logs (API) → **Third-party API**
- **ASN Lookup** — Query Team Cymru / RIPEstat → **Third-party API**
- **ASN Network Mapper** — Query ASN for netblocks → **Third-party API**

### 🌍 DNS (requires DNS lookups)
- **DNS Record Lookup** — `dig`-equivalent → **Not available in browser**
- **DNS Propagation Checker** — Query multiple DNS servers → **Not available in browser**
- **DNSSEC Analyzer** — DS/DNSKEY lookups → **Not available in browser**
- **DNSSEC Validator** — `dnsval`-equivalent → **Not available in browser**
- **DNS Zone Analyzer** — AXFR zone transfer → **Not available in browser**
- **DNS Misconfiguration Checker** — Check for common misconfigs → **Requires remote lookup**
- **MX/NS/TXT/CAA/CNAME/A/AAAA Record Analyzer** — DNS lookups → **Not available in browser**
- **Reverse DNS Lookup** — `dig -x` → **Not available in browser**
- **DNS History Analyzer** — Historical DNS data → **Third-party API**
- **WHOIS/RDAP Lookup** — Query RDAP servers → **Third-party API / CORS**
- **Domain Expiry Checker** — RDAP → **Third-party API / CORS**
- **Domain Age Checker** — RDAP → **Third-party API / CORS**
- **Domain Reputation Checker** — Query reputation DB → **Third-party API**
- **Domain Security Score** — Aggregate scoring → **Third-party API**
- **Dangling DNS Record Detector** — CNAME/A lookup → **Requires remote**

### 📡 Network Security (TCP/UDP sockets)
- **Online TCP Port Scanner** → **Not possible in browser**
- **Single Port Checker** → **Not possible in browser**
- **Port Range Checker** → **Not possible in browser**
- **Service Banner Analyzer** → **Not possible in browser**
- **Service Version Detector** → **Not possible in browser**
- **TCP/UDP Connectivity Tester** → **Not possible in browser**
- **Ping Tester** → **Not possible in browser (ICMP)**
- **Traceroute Visualizer** → **Not possible in browser (ICMP/UDP)**
- **Subnet/CIDR/IP Range Calculator** → **Pure computation — could be Phase 1!**
- **IPv4/IPv6 Converter** → **Pure computation — could be Phase 1!**
- **IPv6 Address Analyzer** → **Pure computation — could be Phase 1!**
- **Private/Public IP Detector** → **Pure computation — could be Phase 1!**

### 🕵️ Recon / OSINT (external queries)
- **Passive Subdomain Finder** → **Third-party API**
- **Subdomain Takeover Checker** → **CNAME lookup required**
- **Certificate-Based Subdomain Finder** → **CRT.sh API**
- **IP Intelligence Lookup** → **Third-party API**
- **IP Reputation Checker** → **Third-party API**
- **IP Blacklist Checker** → **Third-party API**
- **Reverse IP Lookup** → **Third-party API**
- **Shared Hosting Checker** → **Third-party API**
- **Technology Stack Detector** → **Favicon hash +wappalyzer API?**
- **Web Server Fingerprinter** → **Headers from target**
- **WAF Detector** → **Headers from target / third-party DB**
- **CDN Detector** → **Headers from target / third-party DB**
- **Cloud Provider Detector** → **IP ranges / headers**

### 📧 Email Security (remote DNS/SMTP lookups)
- **SPF/DKIM/DMARC Analyzer** — DNS TXT lookups → **Not available in browser**
- **SPF/DKIM/DMARC Record Generator** → **Pure computation — could be Phase 1!**
- **DKIM Key Inspector** — DNS lookup → **Not available in browser**
- **DMARC Policy Generator** → **Pure computation — could be Phase 1!**
- **Email Authentication Score** → **Multiple DNS lookups**
- **Email Spoofing Risk Checker** → **DNS lookups**
- **MX Security Analyzer** — MX lookup + TLS → **Not available in browser**
- **MTA-STS Checker** → **HTTPS fetch of policy → CORS**
- **TLS-RPT Analyzer** → **DNS lookup**
- **BIMI Record Checker** → **DNS lookup**
- **Email Security Header Analyzer** — From pasted headers → **Could be Phase 1!**

### JavaScript Security (browser-based possible for some)
- **JavaScript Endpoint Extractor** — Parse pasted JS → **Could be Phase 1!**
- **JavaScript Secret Pattern Scanner** — Scan pasted JS for keys → **Could be Phase 1!**
- **API Endpoint Discovery Tool** — Parse pasted JS → **Could be Phase 1!**

---

## Quick Wins — Phase 1 Tools to Build Next

These are high-value, fully client-side, zero backend:
1. **Hash Generator** — SHA-256/384/512, MD5, BLAKE2 via `crypto.subtle`
2. **Base64/URL Encoder-Decoder** — Standard utility
3. **JWT Decoder** — Display JWT payload without signature verification
4. **CSP Analyzer** — Parse pasted CSP, tree view, find bypasses
5. **Certificate Decoder** — Decode PEM → display subject, issuer, dates
6. **SRI Hash Generator** — SHA-256/384/512 of pasted content
7. **API Key Pattern Scanner** — Regex-based detection in pasted text
8. **Private Key Detector** — Regex for RSA/ECDSA/Ed25519/PGP in paste
9. **Robots.txt Analyzer** — Parse pasted robots.txt, flag sensitive paths
10. **Cookie Security Analyzer** — Parse Set-Cookie from pasted headers
11. **X-Frame-Options / X-Content-Type / Referrer-Policy / Permissions-Policy Checker** — Parse from pasted headers
12. **Subnet/CIDR/IP Range Calculator** — Pure computation
13. **JWT Validator** — Verify HS256 with pasted secret via `crypto.subtle`
14. **BCrypt Hasher** — BCrypt via WASM (no server needed)
15. **2FA TOTP Generator** — RFC 6238, shared-secret based
16. **Passkey Simulator** — Educational WebAuthn flow (no real registration)
17. **Git Secret Scanner** — Find `.git/`, `.env`, SSH keys in pasted text
18. **SPF/DMARC Policy Generator** — Generate from form inputs

---

## Phase 2 — Backend Architecture (Future)

If/when Firebase Cloud Functions are added for Phase 2 tools:
- **Security:** All SSRF risks must be handled server-side (blocked TLDs, private IP ranges, allowlists)
- **Privacy:** No logging of scan targets; user data never persisted
- **Architecture:** Firebase Cloud Functions for Firebase only (no third-party scanner APIs)
- **Cost:** Blaze plan with budget alerts; consider rate limiting
- **Testing:** Firebase Local Emulator Suite for full testing
- **Deployment:** `firebase deploy --only functions` after automated tests pass
