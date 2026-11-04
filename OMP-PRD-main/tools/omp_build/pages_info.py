# -*- coding: utf-8 -*-
"""Informational page bodies."""
from .layout import TOOLS, icon
from .pages_core import FAQ_ITEMS, faq_details


def about_body():
    return f"""
<section class="page-hero">
  <div class="container">
    <span class="eyebrow">About</span>
    <h1 class="h-1">Password security, without the account</h1>
    <p class="lead">OopsMyPassword (OMP) is a privacy-first toolkit for understanding, testing and improving passwords — built so that using it never requires trusting it.</p>
  </div>
</section>
<section class="section-tight">
  <div class="container two-col" style="align-items:start">
    <div class="prose">
      <h2 id="what">What OMP is</h2>
      <p>OMP is a set of free, browser-based tools: a real-time password strength checker, a cryptographically-secure generator, a passphrase generator, an entropy calculator, a password health audit, an educational breach-check demo, and a library of practical guides. Every tool works the moment the page loads — no sign-up wall, no trial, no email field.</p>
      <h2 id="why">Why it exists</h2>
      <p>Two things bothered us about the status quo:</p>
      <ul>
        <li><strong>Most "password checkers" ask you to hand your password to a server.</strong> Even well-meaning ones create a habit nobody should have: typing credentials into websites that ask for them.</li>
        <li><strong>Security advice is often theater.</strong> Fake precision ("this password would take 34 quadrillion years"), fake counters, unlabeled demos, dark patterns pushing accounts. We wanted tools that are honest about what they compute.</li>
      </ul>
      <h2 id="philosophy">The privacy-first philosophy</h2>
      <p>OMP is architected so password analysis runs in JavaScript on your device. No password inputs cross the network. Optional contact details are separate from the tools. The best data-protection policy is data you never collect.</p>
      <h2 id="principles">Security principles we hold to</h2>
      <ul>
        <li><strong>Client-side by default.</strong> If a feature can run locally, it runs locally.</li>
        <li><strong>CSPRNG or nothing.</strong> Generation uses <code>crypto.getRandomValues()</code> exclusively — never <code>Math.random()</code>.</li>
        <li><strong>No fake claims.</strong> Estimates are labeled estimates; demos are labeled demos; unfinished tools say "Coming Soon".</li>
        <li><strong>Minimal attack surface.</strong> Password analysis stays local; online publishing, optional email updates and contact messages use documented services.</li>
        <li><strong>Teach, don't lecture.</strong> Every result links to a plain-language explanation.</li>
      </ul>
    </div>
    <div class="grid" style="align-content:start">
      <div class="card card-pad">
        <span class="card-icon">{icon("users-off","icon-22")}</span>
        <h3>No account required</h3>
        <p>Your theme and Security Checklist progress stay in this browser. You can reset them at any time; nothing is sent to a server.</p>
      </div>
      <div class="card card-pad">
        <span class="card-icon">{icon("server-off","icon-22")}</span>
        <h3>No unnecessary data collection</h3>
        <p>OMP does not run analytics that could touch what you type, does not place passwords in URLs, and does not log inputs. If a future feature ever needs a network call (like an opt-in breach lookup), it will be documented, consent-based, and built on k-anonymity.</p>
      </div>
      <div class="card card-pad">
        <span class="card-icon">{icon("grad","icon-22")}</span>
        <h3>Who it's for</h3>
        <p>Anyone with accounts. Students learning the basics, developers who want clean reference tools, and everyone who has ever reused a password and meant to fix it.</p>
      </div>
    </div>
  </div>
</section>
"""


def privacy_body():
    return f"""
<section class="page-hero">
  <div class="container">
    <span class="eyebrow">Legal</span>
    <h1 class="h-1">Privacy Policy</h1>
    <p class="lead">Last updated: September 29, 2026. Plain language, because privacy policies should be read, not scrolled past.</p>
  </div>
</section>
<section class="section-tight">
  <div class="container container-narrow prose">
    <h2 id="summary">The one-paragraph version</h2>
    <p>Passwords you enter into OopsMyPassword's local tools are processed in your browser's memory and nowhere else. We do not store password history, we do not put passwords in URLs, we do not send what you type to analytics, and there are no user accounts that could tie anything to you.</p>

    <h2 id="local-processing">1. Local processing of passwords</h2>
    <ul>
      <li>The Password Checker, Generator, Passphrase Generator, Entropy Calculator and Password Health audit run <strong>entirely client-side</strong>. The password value lives only in browser memory while the tab is open.</li>
      <li>We do not transmit, log, persist, or otherwise observe password inputs.</li>
      <li>Passwords are never included in URLs, query parameters, hash fragments, or referrer headers.</li>
      <li>If this site ever includes error reporting or analytics, it is configured such that input values — passwords included — can never be part of a payload.</li>
    </ul>

    <h2 id="accounts">2. No account, no login</h2>
    <p>Every tool and every article works without an account. Your theme preference and Security Checklist progress are stored in this browser using localStorage, and never leave the device. Clearing browser data removes them. Site administrators use a separate protected publishing login; it is not required for visitors and creates no visitor record.</p>

    <h2 id="breach-demo">3. The breach-check demo</h2>
    <p>The Breach Check page hashes input locally with SHA-1 (WebCrypto) and compares a 5-character hash prefix against a small corpus bundled with the page. No network request is made with any part of your input or its hash. The demo is labeled accordingly and does not represent a live breach database query.</p>

    <h2 id="hosting">4. Hosting and server logs</h2>
    <p>Like nearly every website, the static-hosting provider serving these files processes standard technical metadata (IP address, user agent, requested path) to deliver pages, and may retain it under its own security, reliability and retention policies. We do not sell, rent, or share that data.</p>

    <h2 id="third-parties">5. Third-party services</h2>
    <p>Firebase Hosting serves the site. Supabase supplies published articles/products and contact-message storage; some publishing interfaces load the Supabase library from esm.sh. These requests expose normal network metadata to those providers but never include password inputs. No advertising analytics are included in this build. Contact messages include the name, email and message you submit.</p>

    <h2 id="children">6. Children</h2>
    <p>OMP is intended for a general audience. Password tools and articles need no email. Do not submit unnecessary personal or sensitive information in an optional subscription or contact message.</p>

    <h2 id="changes">7. Changes to this policy</h2>
    <p>Material changes will be posted on this page with an updated date. We will never claim compliance certifications we have not obtained; where a formal legal regime applies to how you use this site, consult qualified counsel.</p>

    <h2 id="contact">8. Contact</h2>
    <p>Privacy questions and security reports: see the <a href="/contact">contact page</a> or our <a href="/security">security policy</a>.</p>
  </div>
</section>
"""


def terms_body():
    return f"""
<section class="page-hero">
  <div class="container">
    <span class="eyebrow">Legal</span>
    <h1 class="h-1">Terms of Use</h1>
    <p class="lead">Last updated: September 29, 2026. By using OopsMyPassword you agree to these terms.</p>
  </div>
</section>
<section class="section-tight">
  <div class="container container-narrow prose">
    <h2 id="educational">1. Educational purpose</h2>
    <p>OopsMyPassword ("OMP", "the site") provides educational tools and content about password security. It is not a security audit of your systems, not professional advice, and not a managed security service.</p>

    <h2 id="estimates">2. Strength scores are estimates, not guarantees</h2>
    <p>All scores, entropy figures and crack-time estimates produced by OMP are <strong>heuristics</strong>. They are useful for comparison and learning, and they are not — and cannot be — a guarantee that a password will withstand attack. Whether a password is safe depends on how it was generated, where it is reused, how each service stores it, and the attacker's resources. Use the outputs as guidance, not assurance.</p>

    <h2 id="your-responsibility">3. Your responsibilities</h2>
    <ul>
      <li><strong>Be careful where you type secrets.</strong> While OMP is built to process them locally, you should never enter passwords into websites you do not understand or trust — including this one. Review our <a href="/privacy">privacy policy</a> and, if you wish, verify behavior in your browser's developer tools.</li>
      <li>You are responsible for the passwords and passphrases you choose to use, where you store them, and how quickly you change them after incidents.</li>
      <li>Do not use OMP's tools to attack, test, or analyze systems you do not own or lack permission to assess.</li>
    </ul>

    <h2 id="availability">4. Availability and changes</h2>
    <p>The site is provided "as is" and "as available". Features may change, and tools may be added, relabeled as "Coming Soon", or retired. We aim for accuracy in all content but provide no warranty of completeness or fitness for a particular purpose.</p>

    <h2 id="liability">5. Limitation of liability</h2>
    <p>To the maximum extent permitted by law, OMP and its authors are not liable for any damages arising from use of the site or reliance on its outputs — including account compromise, data loss, or breach impact. If you face a live security incident, engage qualified professionals and follow our <a href="/articles/after-a-data-breach">breach response guide</a> as general information only.</p>

    <h2 id="ip">6. Intellectual property</h2>
    <p>Site content, guides and design are provided for personal and educational use. The bundled passphrase word list is the EFF's short wordlist, used under its permissive terms with thanks.</p>

    <h2 id="responsible-use">7. Responsible use</h2>
    <p>Do not attempt to disrupt the site, scrape it abusively, or misrepresent its outputs (for example, presenting heuristic scores as certifications). Security researchers: see <a href="/security">our security policy</a> for reporting.</p>
  </div>
</section>
"""


def contact_body():
    return f"""
<section class="page-hero">
  <div class="container">
    <span class="eyebrow">Contact</span>
    <h1 class="h-1">Talk to us</h1>
    <p class="lead">Questions, corrections, guide requests, security reports — all welcome. Messages go straight to the team.</p>
  </div>
</section>
<section class="section-tight">
  <div class="container two-col" style="align-items:start">
    <div class="card card-pad">
      <div class="form-note">{icon("alert","icon-20")}<div><strong>Messages go straight to the team.</strong><br>A successful submission is saved to the private admin inbox; response times are not guaranteed. We never ask for passwords and never share your email — please don't include real passwords or live secrets in your message.</div></div>
      <form class="form-grid mt-24" data-contact-form novalidate>
        <input type="text" name="company_website" data-contact-hp value="" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;height:0;width:0;opacity:0">
        <div class="form-field">
          <label for="contact-name">Name</label>
          <input id="contact-name" name="name" type="text" autocomplete="name" required maxlength="100" placeholder="Ada Lovelace">
        </div>
        <div class="form-field">
          <label for="contact-email">Email</label>
          <input id="contact-email" name="email" type="email" autocomplete="email" required maxlength="200" placeholder="ada@example.com">
        </div>
        <div class="form-field">
          <label for="contact-message">Message</label>
          <textarea id="contact-message" name="message" required maxlength="5000" placeholder="What's on your mind?"></textarea>
        </div>
        <div>
          <button class="btn btn-primary" type="submit">{icon("mail","icon-18")} Send message</button>
        </div>
        <div class="form-success" data-contact-note role="status">
          {icon("check-circle","icon-20")}
          <div><strong>Message sent.</strong> Your message was saved to the team inbox. Response times are not guaranteed.</div>
        </div>
      </form>
    </div>
    <div class="grid" style="align-content:start">
      <div class="card card-pad">
        <span class="card-icon">{icon("shield","icon-22")}</span>
        <h2 class="h-3">Security reports</h2>
        <p>Found a vulnerability in OMP itself? Please follow responsible disclosure via our <a href="/security" style="color:var(--purple)">security policy</a>. <strong>Never include a real password in any report.</strong></p>
      </div>
      <div class="card card-pad">
        <span class="card-icon">{icon("book","icon-22")}</span>
        <h2 class="h-3">Guide requests</h2>
        <p>Want a topic covered — enterprise SSO, hardware keys, securing a parent's accounts? Suggest it and we'll consider it for the guide library.</p>
      </div>
      <div class="card card-pad">
        <span class="card-icon">{icon("info","icon-22")}</span>
        <h2 class="h-3">What we ask you not to send</h2>
        <p>Do not email real passwords, session tokens, or other live secrets — yours or anyone else's. Describe issues with synthetic examples.</p>
      </div>
    </div>
  </div>
</section>
"""


def faq_body():
    return f"""
<section class="page-hero">
  <div class="container">
    <span class="eyebrow">FAQ</span>
    <h1 class="h-1">Frequently asked questions</h1>
    <p class="lead">The ten questions everyone has — answered without marketing fog.</p>
  </div>
</section>
<section class="section-tight">
  <div class="container container-narrow">
    <div class="grid" style="gap:12px">{faq_details(FAQ_ITEMS)}</div>
    <div class="notice-band mt-48">{icon("info","icon-20")}<p>Something missing? <a href="/contact" style="color:var(--purple)">Ask us</a> — good questions become new guides.</p></div>
  </div>
</section>
"""


GLOSSARY = [
    ("2FA / MFA", "Requiring two or more proofs (something you know, have, or are) to sign in."),
    ("Brute-force attack", "Systematically guessing credentials until one works — industrialized by GPUs against leaked hash databases."),
    ("Credential stuffing", "Replaying email/password pairs leaked from one breach across other services, betting on reuse."),
    ("CSPRNG", "Cryptographically secure pseudo-random number generator — unpredictable randomness suitable for keys and passwords. In browsers: crypto.getRandomValues()."),
    ("Diceware", "Generating passphrases by randomly picking words from a published list; entropy = words × log₂(list size)."),
    ("Entropy (bits)", "A measure of unpredictability: log₂ of the search space. Each bit doubles the attacker's work."),
    ("Hash (password)", "A one-way fingerprint of a password. Slow, salted, memory-hard hashes (Argon2, bcrypt) resist cracking; fast unsalted ones (MD5, SHA-1) do not."),
    ("k-anonymity", "A privacy model where a lookup (e.g., a breached-password check) is mixed into a set of at least k possibilities, so the server cannot tell what you searched for."),
    ("Key stretching", "Deliberately slowing password verification (many hash rounds) to make each guess expensive for attackers."),
    ("Master password", "The single strong passphrase that unlocks a password manager; the one secret worth memorizing carefully."),
    ("Passkey", "A phishing-resistant credential (FIDO2/WebAuthn): a private key on your device proving itself to a site's public key — no shared secret."),
    ("Passphrase", "A password made of several random words — long, memorable, and measurably strong."),
    ("Password manager", "Software that generates, encrypts, and fills unique passwords per account, unlocked by one master password."),
    ("Phishing", "Impersonating a trusted service to trick you into revealing credentials — the leading cause of account takeover."),
    ("Rainbow table", "Precomputed lookup of hash→password pairs; defeated by salting."),
    ("Rate limiting", "Server-side throttling of login attempts; the main defense against online guessing."),
    ("Salt", "A per-password random value mixed into hashing so identical passwords hash differently."),
    ("SIM swapping", "Convincing a carrier to move your phone number to an attacker's SIM, hijacking SMS codes."),
    ("TOTP", "Time-based one-time codes from authenticator apps, rotating every 30 seconds."),
    ("WebAuthn", "The web standard behind passkeys and hardware security keys, binding credentials to a site's origin."),
]


def glossary_body():
    terms = "\n".join(
        f'<div class="card card-pad"><h2 class="h-3">{t}</h2><p class="muted small mt-8">{d}</p></div>'
        for t, d in GLOSSARY
    )
    return f"""
<section class="page-hero">
  <div class="container">
    <span class="eyebrow">Reference</span>
    <h1 class="h-1">Security Glossary</h1>
    <p class="lead">Twenty terms that unlock every guide on this site — defined in one or two sentences each.</p>
  </div>
</section>
<section class="section-tight">
  <div class="container"><div class="grid grid-3">{terms}</div></div>
</section>
"""


def security_body():
    return f"""
<section class="page-hero">
  <div class="container">
    <span class="eyebrow">Security</span>
    <h1 class="h-1">Security & Responsible Disclosure</h1>
    <p class="lead">How OMP approaches its own security, and how to report a problem safely.</p>
  </div>
</section>
<section class="section-tight">
  <div class="container two-col" style="align-items:start">
    <div class="prose">
      <h2 id="architecture">Architecture choices that shrink risk</h2>
      <ul>
        <li><strong>Static, client-side site.</strong> Public pages are prebuilt. Password tools run locally; Supabase handles publishing data, contact messages and private admin authentication.</li>
        <li><strong>Local password analysis.</strong> The public tools do not send password inputs to a server. Private administrator sign-in is a separate authenticated service.</li>
        <li><strong>Limited, documented dependencies.</strong> Fonts use the system stack. Publishing features load pinned libraries from esm.sh. These dependencies need maintenance and do not receive password inputs.</li>
        <li><strong>Safe DOM handling.</strong> Plain text uses <code>textContent</code> or escaping; article and product markup passes through an allowlist sanitizer before rendering. The site does not evaluate user-provided JavaScript.</li>
        <li><strong>CSPRNG-only generation.</strong> <code>crypto.getRandomValues()</code> with rejection sampling and a secure shuffle.</li>
      </ul>
      <h2 id="reporting">Reporting a vulnerability</h2>
      <p>If you believe you've found a security issue in OMP — for example a way input could be exfiltrated, an XSS, or a generation flaw — use the <a href="/contact">contact form</a> with:</p>
      <ul>
        <li>A description, affected page(s), and reproduction steps.</li>
        <li><strong>Never real credentials.</strong> Use synthetic example passwords in reports.</li>
      </ul>
      <p>We ask that you give us reasonable time to fix issues before public disclosure and avoid accessing or modifying other people's data. We do not currently run a paid bug-bounty program, and we won't claim otherwise — accurate credit is happily given if you want it.</p>
      <h2 id="verification">Verify our claims</h2>
      <p>Open your browser's developer tools → Network tab → use the checker. You should see zero requests containing your input. That's the whole design.</p>
    </div>
    <div class="grid" style="align-content:start">
      <div class="card card-pad">
        <span class="card-icon">{icon("lock","icon-22")}</span>
        <h3>Our promises</h3>
        <ul class="list-plain">
          <li>{icon("check","icon-18")}<span>No passwords in logs, URLs, storage, or analytics</span></li>
          <li>{icon("check","icon-18")}<span>No execution of user-provided code</span></li>
          <li>{icon("check","icon-18")}<span>Labeled demos, honest estimates</span></li>
          <li>{icon("check","icon-18")}<span>Reports routed to the private admin inbox</span></li>
        </ul>
      </div>
      <div class="callout callout-warn">{icon("alert","icon-20")}<p><strong>Scope note.</strong> This page describes the properties of the current build. Future features that change the data flow (e.g., opt-in breach APIs) will update this page and the privacy policy before shipping.</p></div>
    </div>
  </div>
</section>
"""


def sitemap_body(guides):
    groups = [
        ("Tools", [(t["name"], t["href"]) for t in TOOLS]),
        ("Hubs & Resources", [
            ("OSINT Hub", "/osint"),
            ("Pentest Hub", "/pentest"),
            ("Articles Hub", "/articles"),
            ("Tool Comparisons", "/compare"),
            ("CLI Cheat Sheets", "/cheatsheets"),
            ("Security Glossary", "/glossary"),
            ("Products", "/products"),
        ]),
        ("Guides", [(g["title"], f"/articles/{g['slug']}") for g in guides]),
        ("Site", [
            ("Home", "/"), ("About", "/about"), ("FAQ", "/faq"),
            ("Glossary", "/glossary"), ("Security", "/security"),
            ("Privacy", "/privacy"), ("Terms", "/terms"),
            ("Contact", "/contact"),
        ]),
    ]
    cols = "".join(
        '<div class="footer-col card card-pad"><div class="footer-col-title">' + name + "</div><ul>"
        + "".join(f'<li><a href="{href}">{label}</a></li>' for label, href in links)
        + "</ul></div>"
        for name, links in groups
    )
    return f"""
<section class="page-hero">
  <div class="container">
    <span class="eyebrow">Index</span>
    <h1 class="h-1">Sitemap</h1>
    <p class="lead">Every page on OopsMyPassword. Machine-readable version: <a class="mono" style="color:var(--purple)" href="/sitemap.xml">sitemap.xml</a>.</p>
  </div>
</section>
<section class="section-tight">
  <div class="container"><div class="grid grid-3 sitemap-grid">{cols}</div></div>
</section>
<section class="section-tight" data-sitemap-live hidden>
  <div class="container">
    <h2 class="h-3">Live articles &amp; products</h2>
    <p class="muted small" style="margin-top:6px">Published from the admin panel — the same entries the XML sitemap lists.</p>
    <div class="grid grid-2 sitemap-grid mt-16" data-sitemap-live-grid></div>
  </div>
</section>
"""


