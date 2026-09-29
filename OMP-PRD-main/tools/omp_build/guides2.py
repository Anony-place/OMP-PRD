# -*- coding: utf-8 -*-
"""Guide articles 6–10."""

G6 = {
    "slug": "passkeys-explained",
    "seo_title": "Passkeys Explained: A Beginner’s Guide",
    "title": "Passkeys Explained: Passwords Without the Password",
    "desc": "What passkeys actually are, how the public-key cryptography behind them defeats phishing, and how to start using them today.",
    "category": "The Future",
    "minutes": 8,
    "toc": [
        ("what", "What a passkey is"),
        ("how-it-works", "How it works (simply)"),
        ("why-better", "Why it beats passwords"),
        ("synced-vs-device", "Synced vs device-bound"),
        ("getting-started", "Getting started"),
        ("questions", "Common questions"),
    ],
    "body": """
<p>Passkeys are the industry-backed replacement for passwords, built on the FIDO2/WebAuthn standards and supported by Apple, Google and Microsoft. They remove the shared secret entirely — there is no password to phish, reuse, or leak.</p>

<h2 id="what">What a passkey is</h2>
<p>A passkey is a cryptographic key pair. Your device keeps the <strong>private key</strong>, protected by your fingerprint, face, or device PIN. The website stores only the <strong>public key</strong>. Signing in is your device proving it holds the private key — without ever revealing it.</p>

<h2 id="how-it-works">How it works (simply)</h2>
<ol>
  <li><strong>Registration:</strong> your device generates a fresh key pair for <em>that specific site</em> and sends the public key.</li>
  <li><strong>Sign-in:</strong> the site sends a random challenge; your device signs it with the private key after you unlock (biometric/PIN).</li>
  <li><strong>Verification:</strong> the site checks the signature with the public key. No shared secret ever crosses the wire.</li>
</ol>

<h2 id="why-better">Why it beats passwords</h2>
<ul>
  <li><strong>Phishing-resistant:</strong> the signature is scoped to the exact domain. A lookalike site gets nothing usable.</li>
  <li><strong>Nothing to breach:</strong> a leaked database of public keys is useless for impersonation.</li>
  <li><strong>Nothing to remember or reuse:</strong> keys are per-site by construction.</li>
  <li><strong>Fast:</strong> unlock your device and you are in — usually faster than typing a password.</li>
</ul>

<h2 id="synced-vs-device">Synced vs device-bound</h2>
<p><strong>Synced passkeys</strong> live in your ecosystem password manager (iCloud Keychain, Google Password Manager) and roam across your devices — convenient for most people. <strong>Device-bound passkeys</strong> (hardware security keys) never leave the key — preferred for high-value or high-risk accounts.</p>

<h2 id="getting-started">Getting started</h2>
<ol>
  <li>Where a site offers "Create a passkey" (Google, Apple, Microsoft, GitHub, PayPal and many more), accept it.</li>
  <li>Keep your password as a fallback during the transition, and keep 2FA on accounts that still need it.</li>
  <li>Make sure your ecosystem account (Apple/Google/Microsoft) itself has strong 2FA — it now guards everything.</li>
</ol>

<h2 id="questions">Common questions</h2>
<p><strong>What if I lose my phone?</strong> Synced passkeys recover through your cloud account; register a second device or hardware key as backup. <strong>Are biometrics sent to websites?</strong> No — biometrics only unlock the key locally; the site sees a signature, never your fingerprint. <strong>Can I use a passkey on another computer?</strong> Yes — you can authenticate with your phone via QR code.</p>
<div class="callout callout-info"><p><strong>Takeaway:</strong> passkeys fix the three fatal flaws of passwords — phishable, reusable, breachable — while being easier to use. Adopt them wherever offered.</p></div>
""",
    "related": ["password-vs-passkey", "two-factor-authentication", "phishing-attacks"],
}

G7 = {
    "slug": "after-a-data-breach",
    "title": "What to Do After a Data Breach",
    "desc": "A calm, ordered playbook for the hours and days after a service you use loses your data — including password resets, sessions and scam watch.",
    "category": "Incident Response",
    "minutes": 7,
    "toc": [
        ("confirm", "1. Confirm what happened"),
        ("prioritize", "2. Change the right passwords first"),
        ("sessions", "3. Kill sessions and tokens"),
        ("harden", "4. Harden the account"),
        ("watch", "5. Watch for follow-up scams"),
        ("identity", "6. If identity data leaked"),
        ("prevent", "7. Reduce the next one's impact"),
    ],
    "body": """
<p>A breach notice is not a reason to panic — it is a reason to act in the right order. Most damage after breaches comes from <em>delay</em> and from <em>follow-up phishing</em>, both of which you can control.</p>

<h2 id="confirm">1. Confirm what happened</h2>
<p>Read the provider's official statement (navigate to their site yourself — do not trust emailed links). Note <strong>what data</strong> was involved: passwords (hashed or plaintext?), card numbers, IDs, addresses, security answers. The response differs by data type.</p>

<h2 id="prioritize">2. Change the right passwords first</h2>
<ol>
  <li>The breached account's password — immediately.</li>
  <li><strong>Every account that reused it</strong> (this is where a password manager's audit view shines).</li>
  <li>If your email was involved and weakly protected, secure it — email resets everything else.</li>
</ol>
<p>Generate fresh, unique replacements with a <a href="/generator">random generator</a>, not by tweaking the old one.</p>

<h2 id="sessions">3. Kill sessions and tokens</h2>
<p>Changing a password does not always sign out existing sessions or invalidate API tokens. Use "sign out of all devices", review connected apps, and revoke anything unfamiliar — especially on email, social and cloud accounts.</p>

<h2 id="harden">4. Harden the account</h2>
<ul>
  <li>Enable or upgrade 2FA (app/key over SMS).</li>
  <li>Refresh recovery emails/phones and security answers.</li>
  <li>If the site supports <a href="/articles/passkeys-explained">passkeys</a>, switch — passkeys give attackers nothing reusable to steal.</li>
</ul>

<h2 id="watch">5. Watch for follow-up scams</h2>
<p>Breach news is prime phishing season. Expect emails claiming to be the breached company, "support" calls, and refund scams. Golden rules: navigate manually, never share codes, and treat urgency as a red flag. See <a href="/articles/phishing-attacks">How Phishing Attacks Steal Passwords</a>.</p>

<h2 id="identity">6. If identity data leaked</h2>
<p>For government IDs, SSN-equivalents or payment cards: contact your bank, consider a credit freeze / fraud alert with your national bureaus, report card numbers for reissue, and document everything. Many jurisdictions give you free monitoring or remediation rights — check the official notice.</p>

<h2 id="prevent">7. Reduce the next breach's impact</h2>
<div class="callout callout-tip"><p>You cannot stop companies from being breached. You can make each breach boring: unique passwords everywhere, minimal data shared, passkeys where possible, and a manager keeping track. A breach of a site where you are unique-and-random is an inconvenience, not a crisis.</p></div>
""",
    "related": ["check-if-password-was-leaked", "phishing-attacks", "two-factor-authentication"],
}

G8 = {
    "slug": "phishing-attacks",
    "title": "How Phishing Attacks Steal Passwords",
    "desc": "The anatomy of modern phishing — lookalike domains, urgency scripts, OAuth consent tricks and MFA-relay proxies — and the defenses that actually work.",
    "category": "Threats",
    "minutes": 7,
    "toc": [
        ("anatomy", "The anatomy of a phish"),
        ("tactics", "Tactics you will actually see"),
        ("aitm", "When phishers beat 2FA"),
        ("spot", "How to spot them"),
        ("defenses", "Defenses that work"),
        ("if-clicked", "If you already clicked"),
    ],
    "body": """
<p>Phishing works because it attacks people, not systems. It is also the number-one way passwords are stolen — far ahead of brute force. Understanding the playbook makes you dramatically harder to catch.</p>

<h2 id="anatomy">The anatomy of a phish</h2>
<ol>
  <li><strong>Bait:</strong> an email/SMS/DM that looks like a service you use — a login alert, a delivery, an invoice, a shared document.</li>
  <li><strong>Hook:</strong> a link to a pixel-perfect replica login page on an attacker's domain.</li>
  <li><strong>Harvest:</strong> whatever you type is captured and used within minutes, often by bots.</li>
</ol>

<h2 id="tactics">Tactics you will actually see</h2>
<ul>
  <li><strong>Lookalike domains:</strong> <code>paypa1.com</code>, <code>micros0ft-support.net</code>, or a trusted domain as a subdomain: <code>github.com.verify-account.io</code>.</li>
  <li><strong>Urgency and fear:</strong> "your account will be suspended", "unusual sign-in detected".</li>
  <li><strong>OAuth consent phishing:</strong> instead of a fake password page, a real login page for a malicious app asking for mailbox/drive permissions.</li>
  <li><strong>QR-code phishing ("quishing")</strong> that moves you from a work machine to your less-protected phone.</li>
  <li><strong>Search ads and malvertising</strong> putting fake login pages above the real result.</li>
</ul>

<h2 id="aitm">When phishers beat 2FA</h2>
<p>Attacker-in-the-middle proxies relay the real login page live: you enter your password and TOTP code, the proxy forwards them instantly, and the attacker rides the authenticated session. Only <strong>origin-bound credentials</strong> — hardware keys and <a href="/articles/passkeys-explained">passkeys</a> — break this, because the signature simply will not validate for the wrong domain.</p>

<h2 id="spot">How to spot them</h2>
<ul>
  <li>Check the <em>actual</em> domain — the last two labels before the path, character by character.</li>
  <li>Be suspicious of any message that wants action <em>right now</em>.</li>
  <li>Did autofill offer your password? A password manager that goes quiet on a "familiar" login page is sounding an alarm.</li>
  <li>Unexpected OAuth prompts: read the permissions; a "documents" add-on does not need to read all your mail.</li>
</ul>

<h2 id="defenses">Defenses that work</h2>
<ol>
  <li><strong>Navigate manually</strong> (bookmark or type the domain) for anything involving credentials.</li>
  <li><strong>Password manager autofill</strong> as a tripwire — no fill, no typing.</li>
  <li><strong>Passkeys / hardware keys</strong> — structural immunity to credential phishing.</li>
  <li><strong>Slow down on urgency</strong> — real providers do not mind you taking five minutes to verify.</li>
</ol>

<h2 id="if-clicked">If you already clicked</h2>
<p>Change the password immediately (from the real site), sign out all sessions, check forwarding rules and recovery settings the attacker may have altered, and watch the account for days. If you reused that password anywhere, change those too — then fix reuse permanently with a manager.</p>
""",
    "related": ["passkeys-explained", "two-factor-authentication", "after-a-data-breach"],
}

G9 = {
    "slug": "password-vs-passkey",
    "title": "Password vs Passkey: An Honest Comparison",
    "desc": "Side-by-side on security, usability, recovery and support — where passkeys win, where passwords still linger, and how to navigate the transition.",
    "category": "The Future",
    "minutes": 6,
    "toc": [
        ("model", "Two different security models"),
        ("table", "Head-to-head comparison"),
        ("where-passwords-remain", "Where passwords still linger"),
        ("transition", "Living through the transition"),
        ("recommendation", "Recommendation"),
    ],
    "body": """
<p>Passwords and passkeys are not two versions of the same thing — they are different security models. Understanding the difference makes the industry's direction (and your choices) obvious.</p>

<h2 id="model">Two different security models</h2>
<p><strong>Passwords are shared secrets.</strong> You and the site both effectively hold the secret, so it can be phished from you, guessed, or stolen from the site's database. <strong>Passkeys are asymmetric keys.</strong> Your device proves possession of a private key that never leaves it; the site stores a public key that is worthless to thieves.</p>

<h2 id="table">Head-to-head comparison</h2>
<div class="table-scroll"><table class="crack-table">
  <thead><tr><th>Property</th><th>Password</th><th>Passkey</th></tr></thead>
  <tbody>
    <tr><td>Phishing</td><td>Trivially phishable by lookalike sites</td><td>Origin-bound — lookalikes get nothing</td></tr>
    <tr><td>Server breach</td><td>Leaked hashes get cracked</td><td>Public keys are useless to attackers</td></tr>
    <tr><td>Reuse</td><td>Constant human failure mode</td><td>Impossible by design</td></tr>
    <tr><td>Guessability</td><td>Strength depends on human choices</td><td>Fixed, enormous cryptographic strength</td></tr>
    <tr><td>Speed of sign-in</td><td>Type, or autofill</td><td>One unlock gesture</td></tr>
    <tr><td>Recovery</td><td>Email reset flows</td><td>Cloud sync or backup key</td></tr>
    <tr><td>Support</td><td>Universal</td><td>Major platforms and growing fast</td></tr>
  </tbody>
</table></div>

<h2 id="where-passwords-remain">Where passwords still linger</h2>
<ul>
  <li>Sites that have not implemented WebAuthn yet (still the majority).</li>
  <li>Shared/legacy environments where key management is impractical.</li>
  <li>As the fallback behind passkey-enabled accounts during the transition.</li>
</ul>
<p>That fallback matters: many "passkey accounts" still accept the password, so the password must remain strong and 2FA-enabled until sites allow removing it.</p>

<h2 id="transition">Living through the transition</h2>
<ol>
  <li>Enable passkeys everywhere they are offered (they can live in your password manager).</li>
  <li>Keep passwords unique and manager-generated for everything else.</li>
  <li>Secure the ecosystem account that syncs your passkeys (strong master passphrase + 2FA).</li>
  <li>Register a backup factor (second device or hardware key) for critical accounts.</li>
</ol>

<h2 id="recommendation">Recommendation</h2>
<div class="callout callout-tip"><p><strong>Adopt passkeys opportunistically, run passwords properly in the meantime.</strong> Unique + random + manager + 2FA remains excellent security today; passkeys make it airtight tomorrow.</p></div>
""",
    "related": ["passkeys-explained", "create-strong-password", "two-factor-authentication"],
}

G10 = {
    "slug": "password-entropy",
    "title": "How Password Entropy Works",
    "desc": "The math behind ‘bits of entropy’ — H = L·log₂(N) — with worked examples, attacker models, and why meter scores and entropy are not the same thing.",
    "category": "Deep Dives",
    "minutes": 8,
    "toc": [
        ("definition", "What entropy measures"),
        ("formula", "The formula, worked"),
        ("examples", "Worked examples"),
        ("humans", "Why humans break the math"),
        ("attackers", "Attacker models and time"),
        ("scores", "Entropy vs strength scores"),
        ("takeaways", "Takeaways"),
    ],
    "body": """
<p>Entropy is the one honest, quantitative way to talk about password strength — provided it is applied to how the password was <em>generated</em>, not just what it looks like.</p>

<h2 id="definition">What entropy measures</h2>
<p>Entropy measures uncertainty: how many possibilities an attacker must search, on average, to guess your password. It is expressed in <strong>bits</strong>: each bit doubles the search space. 2<sup>60</sup> possibilities is "60 bits" — roughly a billion billion.</p>

<h2 id="formula">The formula, worked</h2>
<pre><code>H = L × log₂(N)

H = entropy in bits
L = password length
N = size of the character pool each position is drawn from</code></pre>
<p>Example: 16 characters chosen truly randomly from lowercase + digits (pool N = 36):</p>
<pre><code>H = 16 × log₂(36) ≈ 16 × 5.17 ≈ 82.7 bits</code></pre>
<p>Play with every combination on our <a href="/entropy">entropy calculator</a>.</p>

<h2 id="examples">Worked examples (truly random generation)</h2>
<div class="table-scroll"><table class="crack-table">
  <thead><tr><th>Password type</th><th>Pool</th><th>Length</th><th>Entropy</th></tr></thead>
  <tbody>
    <tr><td class="mono">PIN, digits only</td><td class="mono">10</td><td class="mono">6</td><td class="mono">~19.9 bits</td></tr>
    <tr><td class="mono">lowercase only</td><td class="mono">26</td><td class="mono">12</td><td class="mono">~56.4 bits</td></tr>
    <tr><td class="mono">lower+upper+digits</td><td class="mono">62</td><td class="mono">12</td><td class="mono">~71.5 bits</td></tr>
    <tr><td class="mono">all four types</td><td class="mono">95</td><td class="mono">16</td><td class="mono">~105.2 bits</td></tr>
    <tr><td class="mono">5-word passphrase (1,296-word list)</td><td class="mono">1296</td><td class="mono">5 words</td><td class="mono">~51.7 bits</td></tr>
    <tr><td class="mono">7-word passphrase</td><td class="mono">1296</td><td class="mono">7 words</td><td class="mono">~72.4 bits</td></tr>
  </tbody>
</table></div>
<p>Notice what matters: pool size adds a little; length adds a lot — every extra random character multiplies the space.</p>

<h2 id="humans">Why humans break the math</h2>
<p>The formula assumes each character is <em>uniformly and independently random</em>. Humans pick words, names, dates and patterns — distributions an attacker models with frightening accuracy. A human-chosen "12-character password" is nowhere near 71 bits; a randomly generated one is. This is why <code>Math.random()</code>-free generation and dice-word passphrases matter: the <em>process</em> creates the entropy.</p>

<h2 id="attackers">Attacker models and time</h2>
<ul>
  <li><strong>Online attacks</strong> (guessing through a login form) throttle to single-digit guesses per second — even 30–40 bits survives for years.</li>
  <li><strong>Offline attacks on fast hashes</strong> (leaked MD5/SHA-1 databases) run ~10<sup>11</sup> guesses/second on a decent rig — weak passwords fall in milliseconds.</li>
  <li><strong>Slow password hashing</strong> (bcrypt, scrypt, Argon2) drops that to ~10<sup>4</sup>–10<sup>5</sup>/second, buying back orders of magnitude.</li>
</ul>
<p>Add it up as "time ≈ 2<sup>H−1</sup> / guesses-per-second" — half the space, on average, before the attacker finds you.</p>

<h2 id="scores">Entropy vs strength scores</h2>
<div class="callout callout-warn"><p>Our <a href="/checker">checker</a> shows both a 0–100 score and an entropy estimate. The score is a <strong>heuristic</strong> that penalizes patterns; the entropy figure is the naive pool-based number adjusted downward by those findings. Neither is a guarantee — pattern analysis cannot know how your password was actually generated. Treat both as guidance, not proof.</p></div>

<h2 id="takeaways">Takeaways</h2>
<ul>
  <li>Entropy comes from random generation, not cleverness.</li>
  <li>Length is the cheapest entropy: +6.6 bits per extra random mixed character.</li>
  <li>~80 bits is effectively unguessable offline; ~45+ suffices behind rate-limited logins with 2FA.</li>
  <li>You do not choose between memorable and random — passphrases give both.</li>
</ul>
""",
    "related": ["password-cracking-time-table", "create-strong-password", "how-long-should-a-password-be"],
}

GUIDES_2 = [G6, G7, G8, G9, G10]
