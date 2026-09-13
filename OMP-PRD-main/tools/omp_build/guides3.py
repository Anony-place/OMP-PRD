# -*- coding: utf-8 -*-
"""Long-tail SEO articles (static, snippet-optimized).
Each: direct answer first (featured-snippet block), data table, deep sections,
FAQ block (rendered + FAQPage JSON-LD), dense internal links."""

A1 = {
    "slug": "how-long-should-a-password-be",
    "title": "How Long Should a Password Be?",
    "desc": "The quick answer: 16+ characters for anything important, 12 as an absolute floor — with a per-account table and the math that explains why length beats complexity.",
    "category": "Fundamentals",
    "minutes": 6,
    "toc": [
        ("quick-answer", "The quick answer"),
        ("by-account", "Recommended length by account type"),
        ("why-length-wins", "Why length beats complexity"),
        ("online-vs-offline", "Online vs offline attacks"),
        ("remember-long", "How to handle long passwords"),
        ("faq", "FAQ"),
    ],
    "body": """
<h2 id="quick-answer">The quick answer</h2>
<div class="callout callout-tip"><p><strong>Use at least 16 characters for important accounts and never fewer than 12 anywhere.</strong> For anything you must memorize, use a passphrase of 5–7 random words instead — length without the pain. Every additional random character multiplies an attacker's work; complexity rules barely do.</p></div>
<p>These numbers assume the password is randomly generated or built from random words. A human-invented 20-character password can still be weak — length necessary, but not sufficient, if the content is predictable.</p>

<h2 id="by-account">Recommended length by account type</h2>
<div class="table-scroll"><table class="crack-table">
  <thead><tr><th>Account</th><th>Minimum</th><th>Recommended</th><th>Why</th></tr></thead>
  <tbody>
    <tr><td>Primary email</td><td class="mono">16</td><td class="mono">20+ / 6-word passphrase</td><td>Resets everything else you own</td></tr>
    <tr><td>Password manager master</td><td class="mono">—</td><td class="mono">6–7-word passphrase</td><td>The one secret that guards all others</td></tr>
    <tr><td>Banking / payments</td><td class="mono">16</td><td class="mono">20+ random</td><td>Directly tied to money</td></tr>
    <tr><td>Work / admin / cloud infra</td><td class="mono">16</td><td class="mono">20+ random + hardware key</td><td>Targeted attacks happen here</td></tr>
    <tr><td>Social media & shopping</td><td class="mono">12</td><td class="mono">16 random</td><td>High breach frequency</td></tr>
    <tr><td>Wi-Fi password</td><td class="mono">16</td><td class="mono">20 random</td><td>Offline cracking of captured handshakes</td></tr>
    <tr><td>Forgettable forum signup</td><td class="mono">12</td><td class="mono">16 random (manager)</td><td>Reuse — not weakness — is the danger</td></tr>
  </tbody></table></div>
<p>If this sounds exhausting, it is — which is why <a href="/articles/password-manager-benefits">a password manager</a> does the remembering, and our <a href="/generator">generator</a> does the inventing.</p>

<h2 id="why-length-wins">Why length beats complexity</h2>
<p>Entropy (a password's guess-resistance in bits) grows <em>multiplicatively</em> with length and only <em>additively</em> with character-set size: one extra random mixed-character adds ~6.6 bits, while forcing a symbol into an 8-character password adds ~2 bits total and typically just produces <code>Password1!</code>. Full math with worked tables: <a href="/articles/password-entropy">How Password Entropy Works</a>.</p>

<h2 id="online-vs-offline">Online vs offline attacks change the math</h2>
<ul>
  <li><strong>Online guessing</strong> (through a login form) is throttled to a few attempts per second — even ~40 bits survives for years, and 2FA closes the door.</li>
  <li><strong>Offline cracking</strong> (attacker stole the database) runs up to ~10¹¹ guesses per second against fast hashes. This is the scenario length defends against — and the one our <a href="/checker">checker</a> estimates for.</li>
</ul>

<h2 id="remember-long">How to actually handle long passwords</h2>
<ol>
  <li>Memorize <strong>one</strong> long passphrase (your manager's master password).</li>
  <li>Let the manager generate 16–24-character random passwords everywhere else.</li>
  <li>Use the <a href="/passphrase">passphrase generator</a> for anything you type often, like Wi-Fi.</li>
  <li>Add 2FA so a single password failure is never fatal.</li>
</ol>

<h2 id="faq">Frequently asked questions</h2>
<details class="faq-item"><summary>Is an 8-character password still okay?<span class="chev"></span></summary><div class="faq-body"><p>No. An 8-character password using every character type has ~52 bits of entropy if perfectly random — crackable offline in hours to days — and human-chosen 8-character passwords are far weaker. Treat 12 as the floor and 16 as the standard.</p></div></details>
<details class="faq-item"><summary>Is a 20-character password overkill?<span class="chev"></span></summary><div class="faq-body"><p>For randomly generated passwords it's free — a manager types it for you — and it pushes entropy past ~130 bits, into "physically infeasible" territory for any offline attack. Overkill in the best way.</p></div></details>
<details class="faq-item"><summary>Does adding a symbol matter more than adding two characters?<span class="chev"></span></summary><div class="faq-body"><p>No. Two extra random characters from a mixed pool (~+13 bits) beat the first symbol's pool expansion (~+0.6 bits per character). Symbols help, but length helps more.</p></div></details>
<details class="faq-item"><summary>How long should my Wi-Fi password be?<span class="chev"></span></summary><div class="faq-body"><p>At least 16 random characters. WPA2 handshakes can be captured near your home and cracked offline at full GPU speed, so Wi-Fi needs the same treatment as an important account.</p></div></details>
<details class="faq-item"><summary>What if a site limits me to 12 characters?<span class="chev"></span></summary><div class="faq-body"><p>Use all 12, make them fully random with every character type, make that password unique, and turn on the strongest 2FA the site offers. Also consider telling the site their limit is a security smell.</p></div></details>
""",
    "faq": [
        ("Is an 8-character password still okay?",
         "No. A perfectly random 8-character password is crackable offline in hours to days, and human-chosen ones fall much faster. Use 12 characters minimum and 16 for important accounts."),
        ("Is a 20-character password overkill?",
         "For randomly generated passwords it is free and pushes entropy past ~130 bits — physically infeasible to crack offline. Overkill in the best way."),
        ("Does adding a symbol matter more than adding two characters?",
         "No. Two extra random characters add about +13 bits of entropy; the first symbol expands the pool less per character. Length matters more than symbol count."),
        ("How long should my Wi-Fi password be?",
         "At least 16 random characters. WPA2 handshakes can be captured and cracked offline at full speed."),
        ("What if a site limits me to 12 characters?",
         "Use all 12 randomly with every character type, keep it unique, and enable the strongest 2FA offered."),
    ],
    "related": ["create-strong-password", "password-entropy", "password-cracking-time-table"],
}

A2 = {
    "slug": "password-cracking-time-table",
    "title": "Password Cracking Times by Length",
    "desc": "See exactly how long a GPU rig needs to crack passwords by length and character type — plus the two changes that move you from minutes to millennia.",
    "category": "Deep Dives",
    "minutes": 7,
    "toc": [
        ("quick-answer", "The quick answer"),
        ("the-table", "The time-to-crack table"),
        ("assumptions", "The assumptions behind the numbers"),
        ("two-moves", "The two moves that matter"),
        ("test-yours", "Test your own"),
        ("faq", "FAQ"),
    ],
    "body": """
<h2 id="quick-answer">The quick answer</h2>
<div class="callout callout-tip"><p><strong>Against an offline GPU attack (~10¹¹ guesses/second) on a fast hash: an 8-character random password falls in minutes, a 12-character one in centuries, and 16+ is effectively uncrackable.</strong> Against slow, modern hashing (bcrypt/Argon2) or throttled online logins, everything shifts massively in your favor. Human-picked passwords are weaker than every number on this page — the table assumes true randomness.</p></div>

<h2 id="the-table">The time-to-crack table (offline, fast hash — worst case)</h2>
<p>Average time to guess, assuming a perfectly random password and leaked unsalted MD5-style hashes at ~10¹¹ guesses/second:</p>
<div class="table-scroll"><table class="crack-table">
  <thead><tr><th>Characters</th><th>Digits only</th><th>Lowercase</th><th>Mixed A–z 0–9</th><th>All types (95)</th></tr></thead>
  <tbody>
    <tr><td class="mono">8</td><td>Instantly</td><td>Instantly</td><td>Instantly</td><td>~2 minutes</td></tr>
    <tr><td class="mono">10</td><td>Instantly</td><td>~7 seconds</td><td>~7 days</td><td>~1.9 years</td></tr>
    <tr><td class="mono">12</td><td>Instantly</td><td>~5 hours</td><td>~1,150 years</td><td>Millions of years</td></tr>
    <tr><td class="mono">14</td><td>~2 minutes</td><td>~6 days</td><td>Millions of years</td><td>Beyond feasible</td></tr>
    <tr><td class="mono">16</td><td>~3 hours</td><td>~1.5 years</td><td>Beyond feasible</td><td>Beyond feasible</td></tr>
    <tr><td class="mono">20</td><td>Millions of years</td><td>Millions of years</td><td>Beyond feasible</td><td>Beyond feasible</td></tr>
  </tbody></table></div>
<p>"Beyond feasible" means longer than any attacker's budget, patience, or civilization — often measured in universe-lifetimes.</p>

<h2 id="assumptions">The assumptions behind the numbers</h2>
<ul>
  <li><strong>Offline attack on a fast hash</strong> — the "your database leaked and was hashed with MD5/SHA-1" scenario. This is the number that matters for random generation.</li>
  <li><strong>Slow hashing flips the table.</strong> If the site used bcrypt/Argon2, the same rig manages ~10⁴–10⁵ guesses/second — a million-fold defense you don't control but benefit from.</li>
  <li><strong>Online attacks are nearly irrelevant for length</strong> — rate-limited logins make even modest random passwords safe for centuries; that's what <a href="/articles/two-factor-authentication">2FA</a> is for.</li>
  <li><strong>Random generation is assumed.</strong> A human-typed "16-character password" usually contains words, names or patterns that collapse these numbers — see <a href="/articles/common-password-mistakes">Common Password Mistakes</a>.</li>
</ul>

<h2 id="two-moves">The two moves that matter</h2>
<ol>
  <li><strong>Go longer, not fancier.</strong> Every extra random character multiplies crack time by its pool size (26–95×).</li>
  <li><strong>Be random per account.</strong> A century-strength password reused on a breached site is worth zero — <a href="/articles/password-manager-benefits">get a manager</a> to make both effortless.</li>
</ol>

<h2 id="test-yours">Test your own</h2>
<p>See the assumption-transparent estimate for any password on the <a href="/checker">checker</a> (it never leaves your browser), or model exact pools and lengths with the <a href="/entropy">entropy calculator</a>. The deeper math is in <a href="/articles/password-entropy">How Password Entropy Works</a>.</p>

<h2 id="faq">Frequently asked questions</h2>
<details class="faq-item"><summary>How long does it take to crack a 12-character password?<span class="chev"></span></summary><div class="faq-body"><p>A randomly generated 12-character password with all character types takes millions of years at 10¹¹ guesses/second offline. Mixed alphanumeric without symbols: ~1,150 years. Human-chosen 12-character passwords (words + substitutions) can fall in hours.</p></div></details>
<details class="faq-item"><summary>Do symbols significantly increase crack time?<span class="chev"></span></summary><div class="faq-body"><p>The first symbol expands the pool from 62 to 95 characters (~1.5× crack time per character), which helps — but adding two more characters of any type multiplies time by the pool size twice over. Length first, variety second.</p></div></details>
<details class="faq-item"><summary>Can quantum computers crack my password instantly?<span class="chev"></span></summary><div class="faq-body"><p>No. Grover's algorithm would square-root classical search spaces at best, on hardware that does not exist at relevant scale. Your 128-bit-entropy password is safe for the foreseeable future; passwords are not the weak link quantum computers threaten first.</p></div></details>
<details class="faq-item"><summary>Does the website's hashing really change it that much?<span class="chev"></span></summary><div class="faq-body"><p>Yes — million-fold. MD5 allows ~10¹¹ guesses/second on a good rig; tuned Argon2id can limit the same rig to ~10⁴. You can't control a site's hashing, which is exactly why unique, random, long passwords are your side of the bargain.</p></div></details>
""",
    "faq": [
        ("How long does it take to crack a 12-character password?",
         "A randomly generated 12-character password with all character types takes millions of years offline at 10¹¹ guesses/second; mixed alphanumeric about 1,150 years. Human-chosen ones fall far faster."),
        ("Do symbols significantly increase crack time?",
         "The first symbol expands the pool from 62 to 95 characters, helping — but two additional characters of any type multiply the time far more. Length first, variety second."),
        ("Can quantum computers crack my password instantly?",
         "No. Grover's algorithm offers at best a quadratic speedup on hardware that does not exist at scale; high-entropy passwords remain safe."),
        ("Does the website's hashing really change it that much?",
         "Yes — roughly a million-fold between fast MD5-style hashing and tuned Argon2/bcrypt. Unique, random, long passwords cover you either way."),
    ],
    "related": ["password-entropy", "how-long-should-a-password-be", "create-strong-password"],
}

A3 = {
    "slug": "are-password-managers-safe",
    "title": "Are Password Managers Safe?",
    "desc": "Yes — safer than any realistic alternative. How zero-knowledge vaults protect you even when providers are breached, what the real risks are, and how to set one up safely.",
    "category": "Tools",
    "minutes": 7,
    "toc": [
        ("quick-answer", "The quick answer"),
        ("zero-knowledge", "How zero-knowledge protection works"),
        ("breach-math", "What happens when a manager is breached"),
        ("real-risks", "The real risks (and fixes)"),
        ("browser-vs-dedicated", "Browser built-ins vs dedicated managers"),
        ("setup", "Setting one up safely"),
        ("faq", "FAQ"),
    ],
    "body": """
<h2 id="quick-answer">The quick answer</h2>
<div class="callout callout-tip"><p><strong>Yes. For almost everyone, a reputable password manager is dramatically safer than any alternative — reusing passwords, writing them down, or inventing "clever" patterns.</strong> Even if the provider's servers are breached, a properly-designed (zero-knowledge) vault gives attackers only encrypted data they cannot practically open.</p></div>

<h2 id="zero-knowledge">How zero-knowledge protection works</h2>
<p>Reputable managers encrypt your vault <strong>on your device</strong> using a key derived from your master password. The provider stores ciphertext. They never see your master password or your logins — so a server breach exposes encrypted blobs, and all secrecy rests where it belongs: on one strong passphrase you hold.</p>

<h2 id="breach-math">What happens when a manager is breached</h2>
<p>Even in the pessimistic case — attackers walk away with everyone's encrypted vaults — cracking one vault means brute-forcing its master password against deliberately slow key derivation (~10⁴–10⁵ guesses/second, not billions). A 6-word master passphrase (~72+ bits) is effectively uncrackable, forever. Users with weak master passwords and reused ones are the soft spot — which is a solvable, personal problem, not a design flaw.</p>

<h2 id="real-risks">The real risks (and how to neutralize them)</h2>
<div class="table-scroll"><table class="crack-table">
  <thead><tr><th>Risk</th><th>Severity</th><th>Neutralize it with</th></tr></thead>
  <tbody>
    <tr><td>Weak master password</td><td>Highest</td><td>6–7-word passphrase (<a href="/passphrase">generator</a>)</td></tr>
    <tr><td>Malware on your device</td><td>High</td><td>OS updates, screen lock, disk encryption</td></tr>
    <tr><td>Loss of master password</td><td>High</td><td>Recovery codes printed + stored physically</td></tr>
    <tr><td>Account-level takeover of the sync account</td><td>Medium</td><td>Strong 2FA on the manager account itself</td></tr>
    <tr><td>Provider shutdown</td><td>Low</td><td>Periodic encrypted export backups</td></tr>
  </tbody></table></div>
<p>Compare against the alternative: credential stuffing from reused passwords succeeds <em>daily, at scale, automatically</em>. Risk isn't zero either way — it's dramatically lower with a manager.</p>

<h2 id="browser-vs-dedicated">Browser built-ins vs dedicated managers</h2>
<p>Browser-integrated managers (Chrome/Safari/Firefox) are encrypted, synced, and <strong>vastly better than no manager</strong>. Dedicated tools add: cross-browser portability, secure notes and sharing, vault audits, passkey storage, and richer access controls. Start with whichever one you will actually use today; depth of feature set matters less than adoption.</p>

<h2 id="setup">Setting one up safely (15 minutes)</h2>
<ol>
  <li>Pick a provider with a published security model and independent audits.</li>
  <li>Create a 6-word master passphrase with the <a href="/passphrase">passphrase generator</a> — write it on paper until memorized.</li>
  <li>Enable 2FA on the manager account. Store recovery codes offline.</li>
  <li>Import browser-saved passwords, then clear the browser store.</li>
  <li>Regenerate your top 5 accounts (email, bank, work, cloud, shopping) with the <a href="/generator">password generator</a>.</li>
</ol>

<h2 id="faq">Frequently asked questions</h2>
<details class="faq-item"><summary>What if the password manager company gets hacked?<span class="chev"></span></summary><div class="faq-body"><p>Attackers get encrypted vaults protected by your master password and slow key derivation. With a strong master passphrase, the stolen data stays ciphertext — which is the entire point of the architecture.</p></div></details>
<details class="faq-item"><summary>Isn't it dangerous to keep all passwords in one place?<span class="chev"></span></summary><div class="faq-body"><p>It concentrates risk, then defends that concentration properly: strong encryption, one high-quality secret, and 2FA. The alternative spreads the same secrets across hundreds of sites with wildly uneven defenses — empirically far worse.</p></div></details>
<details class="faq-item"><summary>What happens if I forget my master password?<span class="chev"></span></summary><div class="faq-body"><p>By design, the provider cannot reset it — that's why zero-knowledge is trustworthy. Use their recovery codes (print them now) or account recovery options, and store a paper copy of the passphrase somewhere physically safe while you memorize it.</p></div></details>
<details class="faq-item"><summary>Are free password managers safe?<span class="chev"></span></summary><div class="faq-body"><p>The reputable free tiers (and built-in browser managers) use the same class of encryption as paid plans. Paying typically buys sharing, storage, and support features — not stronger cryptography.</p></div></details>
<details class="faq-item"><summary>Can the password manager's employees read my passwords?<span class="chev"></span></summary><div class="faq-body"><p>Not in a properly implemented zero-knowledge system: decryption keys are derived from your master password on your device, never transmitted. Choose providers that publish their security design and audits.</p></div></details>
""",
    "faq": [
        ("What if the password manager company gets hacked?",
         "Attackers get encrypted vaults protected by your master password and slow key derivation. With a strong master passphrase the stolen data stays ciphertext."),
        ("Isn't it dangerous to keep all passwords in one place?",
         "The concentration is deliberate and defended with encryption plus one strong secret and 2FA. Reusing passwords spreads risk across hundreds of unevenly-defended sites — empirically far worse."),
        ("What happens if I forget my master password?",
         "The provider cannot reset it by design. Use recovery codes (print them) and keep a paper copy of the passphrase somewhere safe until memorized."),
        ("Are free password managers safe?",
         "Reputable free tiers use the same encryption as paid plans; payment buys convenience features, not stronger crypto."),
        ("Can the password manager's employees read my passwords?",
         "Not in a proper zero-knowledge system — decryption keys are derived on your device and never transmitted."),
    ],
    "related": ["password-manager-benefits", "create-strong-password", "password-best-practices"],
}

A4 = {
    "slug": "check-if-password-was-leaked",
    "title": "How to Check If Your Password Has Been Leaked (Safely)",
    "desc": "How k-anonymity lets you check a password against billions of breached records without ever revealing it — plus what to do in the first hour if yours shows up.",
    "category": "Incident Response",
    "minutes": 6,
    "toc": [
        ("quick-answer", "The quick answer"),
        ("k-anonymity", "How k-anonymity keeps your password private"),
        ("golden-rule", "The golden rule of password checking"),
        ("if-found", "If your password shows up: first hour"),
        ("try-demo", "Try the mechanics locally"),
        ("faq", "FAQ"),
    ],
    "body": """
<h2 id="quick-answer">The quick answer</h2>
<div class="callout callout-tip"><p><strong>Use a breach lookup that works on k-anonymity — for example the Pwned Passwords range API model — where only a 5-character hash prefix ever leaves your device.</strong> Never type a real password into a random "check my password" website: the checker itself may be the thief. If a password appears in any breach corpus, retire it everywhere immediately.</p></div>

<h2 id="k-anonymity">How k-anonymity keeps your password private</h2>
<ol>
  <li><strong>Your device hashes the password</strong> (SHA-1) locally. The password itself never travels.</li>
  <li><strong>Only the first 5 hash characters are sent</strong> to the lookup service — a prefix shared by hundreds of unrelated hashes.</li>
  <li><strong>The service returns every hash suffix in that range</strong>, and your device compares locally. The operator learns nothing about which password you checked, let alone the password.</li>
</ol>
<p>The same principle powers reputable third-party services such as Have I Been Pwned's Pwned Passwords and the built-in leak warnings in password managers and browsers.</p>

<h2 id="golden-rule">The golden rule of password checking</h2>
<div class="callout callout-warn"><p>A leak checker can only be trusted if (a) it never receives your password or even its full hash — only a prefix — and (b) you have reason to trust the operator. When in doubt, don't type real credentials anywhere. Practice on the <a href="/checker">fully local checker</a>, where verification is one developer-tools network tab away.</p></div>

<h2 id="if-found">If your password shows up: the first hour</h2>
<ol>
  <li><strong>Change it on the breached service immediately</strong> — from the real site, not an email link.</li>
  <li><strong>Change every account that reused it.</strong> This is the step people skip and the one attackers bank on.</li>
  <li><strong>Sign out other sessions</strong> where the service offers it; revoke unknown app connections.</li>
  <li><strong>Expect phishing.</strong> Breach news always brings follow-up scam waves referencing the incident.</li>
</ol>
<p>The full ordered playbook: <a href="/articles/after-a-data-breach">What to Do After a Data Breach</a>.</p>

<h2 id="try-demo">Try the mechanics locally</h2>
<p>Our <a href="/breach-check">Breach Check page</a> demonstrates the entire model in your browser: SHA-1 hashing, prefix extraction, and prefix matching against a tiny built-in demo corpus. It is transparently labeled a demo — a real deployment would point the same architecture at a licensed range API. That's how this pattern should work everywhere.</p>

<h2 id="faq">Frequently asked questions</h2>
<details class="faq-item"><summary>Is it safe to type my password into a breach checker?<span class="chev"></span></summary><div class="faq-body"><p>Only if it uses k-anonymity (your password or full hash never leaves your device) and you trust the operator — otherwise no. A fully local analyzer (like OMP's) that makes no network calls is the safest form.</p></div></details>
<details class="faq-item"><summary>What does it mean if my password is in a breach corpus?<span class="chev"></span></summary><div class="faq-body"><p>That exact string is in cracking dictionaries used by bots worldwide — even if it wasn't leaked from <em>your</em> account. Common words and patterns appear there regardless. Treat it as burned: never use it again, anywhere.</p></div></details>
<details class="faq-item"><summary>If my password is NOT found, am I safe?<span class="chev"></span></summary><div class="faq-body"><p>No — "not found" only means absent from that corpus. New breaches surface constantly, and targeted guessing doesn't need lists. Strong + unique + 2FA is the durable defense.</p></div></details>
<details class="faq-item"><summary>How do hackers actually get password lists?<span class="chev"></span></summary><div class="faq-body"><p>From breached service databases (especially those stored with fast or unsalted hashes), credential-stealing malware, and phishing. Lists are then merged into "combo lists" traded in criminal ecosystems.</p></div></details>
<details class="faq-item"><summary>How often should I check for leaks?<span class="chev"></span></summary><div class="faq-body"><p>Don't schedule it — automate it. Password managers and modern browsers monitor continuously and alert you. Manual spot-checks are reassuring; continuous monitoring is protection.</p></div></details>
""",
    "faq": [
        ("Is it safe to type my password into a breach checker?",
         "Only if it uses k-anonymity and you trust the operator. A fully local analyzer that makes no network calls is the safest form."),
        ("What does it mean if my password is in a breach corpus?",
         "That string is in cracking dictionaries everyone uses — even if not from your account. Treat it as burned and never use it anywhere again."),
        ("If my password is NOT found, am I safe?",
         "Not proven. Absence from one corpus isn't safety; new breaches surface constantly. Unique strong passwords + 2FA is the real defense."),
        ("How do hackers actually get password lists?",
         "Breached databases with weak hashing, credential-stealing malware, and phishing — merged into traded combo lists."),
        ("How often should I check for leaks?",
         "Automate it instead: password managers and browsers monitor continuously and alert you."),
    ],
    "related": ["after-a-data-breach", "phishing-attacks", "password-best-practices"],
}

A5 = {
    "slug": "password-vs-passphrase",
    "title": "Password vs Passphrase: Which to Use",
    "desc": "For anything you must memorize, a passphrase wins; for everything else, a random password in a manager does. The comparison table and entropy math that settle it.",
    "category": "Fundamentals",
    "minutes": 6,
    "toc": [
        ("quick-answer", "The quick answer"),
        ("comparison", "Password vs passphrase, compared"),
        ("the-math", "The entropy math"),
        ("when-each", "When to use which"),
        ("good-passphrase", "Anatomy of a good passphrase"),
        ("faq", "FAQ"),
    ],
    "body": """
<h2 id="quick-answer">The quick answer</h2>
<div class="callout callout-tip"><p><strong>Use a passphrase (5–7 random words) for the few secrets you must memorize — your password manager's master password, device unlocks, disk encryption. Use a long random password from a generator for everything else.</strong> Passphrases buy length with memorability; random passwords buy maximum entropy per character. Together, they cover 100% of your accounts.</p></div>

<h2 id="comparison">Password vs passphrase, compared</h2>
<div class="table-scroll"><table class="crack-table">
  <thead><tr><th></th><th>Random password</th><th>Passphrase</th></tr></thead>
  <tbody>
    <tr><td>Typical form</td><td class="mono">W7$kQ2!vB9#mPz4@xL8d</td><td class="mono">cobweb-giraffe-easel-poncho-vacuum</td></tr>
    <tr><td>Memorability</td><td>Poor (by design)</td><td>Excellent</td></tr>
    <tr><td>Entropy per character</td><td>High (~6.6 bits)</td><td>Lower — needs length</td></tr>
    <tr><td>Total entropy (typical)</td><td>~130 bits at 20 chars</td><td>~62 bits at 6 words (1296-word list)</td></tr>
    <tr><td>Typing on phones/TVs</td><td>Painful</td><td>Fine</td></tr>
    <tr><td>Best for</td><td>Accounts in a manager</td><td>Secrets you must recall</td></tr>
    <tr><td>Main risk if misused</td><td>People shorten/weaken it</td><td>People hand-pick "random" words</td></tr>
  </tbody></table></div>

<h2 id="the-math">The entropy math in one breath</h2>
<p>A 20-character truly-random password from a 95-character pool holds <code>20 × log₂95 ≈ 131 bits</code>. Six words from a 1,296-word list hold <code>6 × log₂1296 ≈ 62 bits</code>. The random password wins on raw bits — but 62 bits resists years of online guessing and slow-hash offline attacks, and the passphrase can actually be remembered and typed. Different tools for different jobs, not rivals. Deeper dive: <a href="/articles/password-entropy">How Password Entropy Works</a>.</p>

<h2 id="when-each">When to use which</h2>
<ul>
  <li><strong>Passphrase:</strong> manager master password, laptop password, FileVault/BitLocker keys, Wi-Fi you sometimes dictate aloud, answers to security questions (as word salad).</li>
  <li><strong>Random password:</strong> every website and app login, API-adjacent credentials, anything a manager can store and autofill.</li>
  <li><strong>Hybrid trick:</strong> memorable passphrase <em>plus</em> manager-generated for real sites — the master password is the only thing you ever type from memory.</li>
</ul>

<h2 id="good-passphrase">Anatomy of a good passphrase (and a bad one)</h2>
<ul>
  <li><strong>Generated, not invented.</strong> "correct horse battery staple"-style phrases only work when words come from dice or a CSPRNG — humans pick correlated words (<code>ilovemydog</code>). Use the <a href="/passphrase">passphrase generator</a>.</li>
  <li><strong>5–7 words from a published list.</strong> Fewer than 5 from a 1,296-word list is too thin for offline attacks; more than 7 is diminishing returns.</li>
  <li><strong>Separators don't add real entropy</strong> — hyphens, spaces or none are about readability and site rules, not security.</li>
</ul>

<h2 id="faq">Frequently asked questions</h2>
<details class="faq-item"><summary>Is a passphrase just a long password?<span class="chev"></span></summary><div class="faq-body"><p>Technically yes — but the word "passphrase" signals word-based construction, which is what makes it memorable. Systems treat them identically; the difference is in how humans produce and recall them.</p></div></details>
<details class="faq-item"><summary>Can passphrases be cracked with dictionary attacks?<span class="chev"></span></summary><div class="faq-body"><p>Attackers absolutely try known-word combinations — that's exactly why the words must be <em>randomly drawn</em> from a big list. Six random words from 1,296 choices ≈ 2⁶² possibilities; human-picked "random-seeming" words collapse to a tiny, cracked-first subset.</p></div></details>
<details class="faq-item"><summary>Do spaces and capital letters make a passphrase stronger?<span class="chev"></span></summary><div class="faq-body"><p>Barely, in entropy terms — they mainly help satisfy site rules. What matters is word count and random selection. We show entropy honestly (and what actually drives it) on the <a href="/passphrase">generator page</a>.</p></div></details>
<details class="faq-item"><summary>Should my master password be a passphrase?<span class="chev"></span></summary><div class="faq-body"><p>Yes — it's the canonical passphrase use case: maximum-strength secret you must recall without help. Six or seven generated words, written down once, stored physically safe until memorized.</p></div></details>
<details class="faq-item"><summary>Will passkeys make both obsolete?<span class="chev"></span></summary><div class="faq-body"><p>For sign-ins, eventually yes — <a href="/articles/passkeys-explained">passkeys</a> remove shared secrets entirely. But device unlocks, encryption keys and fallback passwords stay human-scale secrets for years, so choosing well still matters.</p></div></details>
""",
    "faq": [
        ("Is a passphrase just a long password?",
         "Technically yes, but the term signals word-based construction — that's what makes it memorable while staying long."),
        ("Can passphrases be cracked with dictionary attacks?",
         "Only if the words are human-picked. Randomly drawn words from a large list (6 words ≈ 2^62) resist exactly that."),
        ("Do spaces and capital letters make a passphrase stronger?",
         "Barely — they mainly satisfy site rules. Word count and random selection drive the entropy."),
        ("Should my master password be a passphrase?",
         "Yes — it is the canonical use case: a maximum-strength secret you must recall unaided."),
        ("Will passkeys make both obsolete?",
         "For sign-ins, eventually. Device unlocks, encryption keys and fallbacks remain human-scale secrets for years."),
    ],
    "related": ["create-strong-password", "password-entropy", "passkeys-explained"],
}

GUIDES_3 = [A1, A2, A3, A4, A5]
