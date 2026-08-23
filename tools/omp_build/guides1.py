# -*- coding: utf-8 -*-
"""Guide articles 1–5. Each guide: slug, title, desc, category, minutes,
toc [(id, label)], body (HTML prose), related [slugs]."""

G1 = {
    "slug": "create-strong-password",
    "title": "How to Create a Strong Password",
    "desc": "What actually makes a password strong in 2026 — length, uniqueness and randomness — with concrete examples you can copy.",
    "category": "Fundamentals",
    "minutes": 7,
    "toc": [
        ("what-makes-strong", "What makes a password strong"),
        ("length-beats-complexity", "Length beats complexity"),
        ("three-recipes", "Three reliable recipes"),
        ("examples", "Examples that work"),
        ("myths", "Strength myths to drop"),
        ("checklist", "Quick checklist"),
    ],
    "body": """
<p>You do not need a photographic memory or a cryptography degree to have strong passwords. You need three things: <strong>length</strong>, <strong>unpredictability</strong>, and <strong>uniqueness</strong>. Modern guidance, including NIST SP 800-63B, emphasizes exactly these — and de-emphasizes the old "change it every 90 days and add a symbol" advice.</p>

<h2 id="what-makes-strong">What makes a password strong</h2>
<p>An attacker who steals a site's password database tries to recover passwords by guessing — billions of guesses per second against weakly-hashed databases. A strong password is one that sits too far out in the search space to be worth guessing:</p>
<ul>
  <li><strong>Long</strong> — every extra character multiplies the work. 16+ characters is the modern bar for anything important.</li>
  <li><strong>Unpredictable</strong> — no dictionary words, names, keyboard walks, or clever-but-famous substitutions like <code>p@ssw0rd</code>. Attackers' rulebooks contain all of these.</li>
  <li><strong>Unique</strong> — never reused, because one site's breach becomes every other site's compromise.</li>
</ul>

<h2 id="length-beats-complexity">Length beats complexity</h2>
<p>Complexity rules (<code>Tr0ub4dor</code>-style) push humans toward predictable patterns: capital first letter, a digit at the end, <code>!</code> on the back. Cracking software models those patterns precisely. A 20-character phrase of ordinary words is both easier to remember and harder to guess than an 8-character "complex" password.</p>
<div class="callout callout-info"><p><strong>Rule of thumb:</strong> if a human invented it, assume a cracking rig has a rule for it. Let a random generator — or a dice-word passphrase — do the inventing.</p></div>

<h2 id="three-recipes">Three reliable recipes</h2>
<ol>
  <li><strong>CSPRNG password.</strong> Use our <a href="/generator.html">generator</a> or your password manager: 20 random characters with mixed types. Store it in the manager; you never need to see it.</li>
  <li><strong>Diceware passphrase.</strong> 5–7 random words, e.g. <code>cobweb-giraffe-easel-poncho-vacuum</code>. Random words are memorable yet carry ~13 bits of entropy each from a 1,296-word list. Try the <a href="/passphrase.html">passphrase generator</a>.</li>
  <li><strong>Manager master password.</strong> The one password you must memorize: a 6-word passphrase, written on paper and stored somewhere safe until it sticks.</li>
</ol>

<h2 id="examples">Examples that work</h2>
<pre><code># Random (use a manager to store)
W7$kQ2!vB9#mPz4@xL8d

# Passphrase (memorizable)
lantern-sushi-rocket-tambourine-velvet

# Avoid: predictable transforms of words
Summer2026!   P@ssw0rd   qwerty123</code></pre>

<h2 id="myths">Strength myths to drop</h2>
<ul>
  <li><strong>"Change passwords monthly."</strong> Forced rotation makes people weaker and more predictable. Change on suspicion of compromise, not on a timer.</li>
  <li><strong>"Symbols near the end help."</strong> <code>!2026</code> suffixes are among the first rules tried.</li>
  <li><strong>"A score of 90/100 means I'm safe."</strong> Meters are heuristics. Uniqueness and phishing-resistance matter more than any meter.</li>
</ul>

<h2 id="checklist">Quick checklist</h2>
<ul>
  <li>16+ characters (or 5+ random words) for important accounts</li>
  <li>Generated or diced — not invented</li>
  <li>Unique per account, stored in a password manager</li>
  <li>Two-factor authentication enabled on top</li>
</ul>
""",
    "related": ["password-manager-benefits", "password-entropy", "common-password-mistakes"],
}

G2 = {
    "slug": "password-best-practices",
    "title": "Password Security Best Practices",
    "desc": "The ten habits that prevent almost all account takeovers — from unique passwords and managers to 2FA and breach response.",
    "category": "Fundamentals",
    "minutes": 8,
    "toc": [
        ("unique-everywhere", "One password, one account"),
        ("use-a-manager", "Use a password manager"),
        ("enable-2fa", "Enable two-factor authentication"),
        ("prioritize", "Prioritize the crown jewels"),
        ("breach-response", "Respond fast to breaches"),
        ("hygiene", "Everyday hygiene"),
        ("summary", "Summary"),
    ],
    "body": """
<p>Most account takeovers are not sophisticated hacks. They are automated, industrial-scale abuse of a handful of human habits. Fixing the habits below removes the vast majority of your risk.</p>

<h2 id="unique-everywhere">1. One password, one account</h2>
<p>When any site is breached, attackers take the leaked email/password pairs and try them on banking, email and social networks — this is called <strong>credential stuffing</strong>. Reuse means one forgotten forum account can hand over your digital life. Uniqueness is the single highest-impact habit.</p>

<h2 id="use-a-manager">2. Use a password manager</h2>
<p>Nobody can invent and remember 100 unique random passwords. A password manager generates and stores them behind one strong master passphrase, and autofill refuses to type your password into a look-alike phishing domain — a security feature, not just a convenience. See <a href="/guides/password-manager-benefits.html">Password Manager Benefits</a>.</p>

<h2 id="enable-2fa">3. Enable two-factor authentication</h2>
<p>2FA means a stolen password alone is not enough. Prefer app-based codes or hardware keys over SMS where possible, and store backup codes offline. Details in our <a href="/guides/two-factor-authentication.html">2FA guide</a>.</p>

<h2 id="prioritize">4. Prioritize the crown jewels</h2>
<ul>
  <li><strong>Primary email</strong> — it resets everything else. Strongest passphrase + best 2FA you can get.</li>
  <li><strong>Banking and payments.</strong></li>
  <li><strong>Password manager master password.</strong></li>
  <li><strong>Cloud storage / Apple / Google / Microsoft account</strong> — they hold devices, photos and backups.</li>
</ul>

<h2 id="breach-response">5. Respond fast to breaches</h2>
<p>If a service you use reports a breach: change that password immediately, change any account where you reused it, sign out other sessions if offered, and watch for phishing that exploits the news cycle. Full walkthrough: <a href="/guides/after-a-data-breach.html">What to Do After a Data Breach</a>.</p>

<h2 id="hygiene">6. Everyday hygiene</h2>
<ul>
  <li>Keep devices and browsers updated — patches close the holes that steal passwords.</li>
  <li>Never type passwords from links in messages; navigate to the site yourself.</li>
  <li>Treat "security questions" as extra passwords — random answers stored in your manager.</li>
  <li>Do not share passwords by chat, email or sticky notes; use a manager's sharing feature.</li>
  <li>Log out on shared devices, and never save passwords in browsers you do not control.</li>
</ul>

<h2 id="summary">Summary</h2>
<div class="callout callout-tip"><p><strong>The 80/20:</strong> unique passwords in a manager + 2FA on email and banking. Those two habits alone defeat the overwhelming majority of real-world account takeovers.</p></div>
""",
    "related": ["password-manager-benefits", "two-factor-authentication", "after-a-data-breach"],
}

G3 = {
    "slug": "common-password-mistakes",
    "title": "Common Password Mistakes (and How to Fix Them)",
    "desc": "The seven patterns cracking software exploits first — reuse, personal details, keyboard walks, and ‘clever’ substitutions that aren’t.",
    "category": "Fundamentals",
    "minutes": 6,
    "toc": [
        ("reuse", "Reusing passwords"),
        ("personal", "Personal information"),
        ("patterns", "Predictable patterns"),
        ("substitutions", "Leet substitutions"),
        ("increments", "Incrementing on rotation"),
        ("storage", "Unsafe storage & sharing"),
        ("fixes", "The fixes"),
    ],
    "body": """
<p>Password crackers do not guess randomly. They work through dictionaries of real leaked passwords, transformation rules, and demographics — which means most "clever" human tricks are the first things tried. Here are the mistakes that feed them.</p>

<h2 id="reuse">1. Reusing passwords</h2>
<p>Reuse converts one site's data breach into the takeover of all your accounts via credential stuffing. Fixing reuse is more valuable than strengthening any single password.</p>

<h2 id="personal">2. Personal information</h2>
<p>Pet names, birthdays, kids' names, sports teams — all of it is on social media, and all of it is in cracking dictionaries with mangling rules applied. If a friend could guess it, a rig definitely will.</p>

<h2 id="patterns">3. Predictable patterns</h2>
<ul>
  <li><strong>Keyboard walks:</strong> <code>qwerty</code>, <code>1qaz2wsx</code>, <code>zxcvbnm</code></li>
  <li><strong>Sequences:</strong> <code>abc123</code>, <code>987654321</code></li>
  <li><strong>Repeats:</strong> <code>aaaaaa</code>, <code>112233</code></li>
  <li><strong>Dates:</strong> <code>Summer2026</code>, <code>John1990</code> — a word plus a year is a top cracking rule.</li>
</ul>
<p>Our <a href="/checker.html">checker</a> flags all of these locally in your browser.</p>

<h2 id="substitutions">4. "Clever" leet substitutions</h2>
<p><code>p@ssw0rd</code>, <code>5up3rman</code>, <code>1l0v3you</code> — cracking tools apply leetspeak rules exhaustively. Substitutions add complexity for you and essentially zero work for the attacker. Length and randomness beat mangling every time.</p>

<h2 id="increments">5. Incrementing when forced to rotate</h2>
<p><code>Spring2026!</code> → <code>Summer2026!</code> satisfies rotation policies while changing almost nothing. If one version leaks, every version falls. Modern guidance (NIST SP 800-63B) says to rotate on evidence of compromise, not on a calendar.</p>

<h2 id="storage">6. Unsafe storage and sharing</h2>
<ul>
  <li>Passwords in notes apps, spreadsheets, emails to yourself, or text messages are all searchable, syncable, and leakable.</li>
  <li>Sending a password over chat leaves it in two devices' history and the service's logs.</li>
  <li>Browser-stored passwords on a shared or unmanaged machine are one export away from disclosure.</li>
</ul>

<h2 id="fixes">7. The fixes</h2>
<ol>
  <li>Move everything into a password manager.</li>
  <li>Regenerate reused or weak passwords with a <a href="/generator.html">random generator</a> — start with email, banking, and anything reused.</li>
  <li>For passwords you must memorize, use 5–7 word <a href="/passphrase.html">passphrases</a>.</li>
  <li>Add 2FA so a single mistake is not fatal.</li>
</ol>
<div class="callout callout-warn"><p><strong>Honest metric:</strong> a password you can casually invent is a password a machine can casually guess. Outsource invention to randomness.</p></div>
""",
    "related": ["create-strong-password", "password-manager-benefits", "phishing-attacks"],
}

G4 = {
    "slug": "password-manager-benefits",
    "title": "Password Manager Benefits — and How to Choose One",
    "desc": "Why a password manager is the single biggest upgrade to your security, how it protects you beyond storage, and what to look for when choosing.",
    "category": "Tools",
    "minutes": 7,
    "toc": [
        ("what-it-does", "What a password manager does"),
        ("beyond-storage", "Protection beyond storage"),
        ("choosing", "How to choose one"),
        ("master-password", "The master password"),
        ("migration", "Migrating safely"),
        ("edge-cases", "Edge cases and limits"),
    ],
    "body": """
<p>Security professionals have been consistent for years: <strong>use a password manager</strong>. It is the only realistic way to have a unique, strong password for every account — the two properties that matter most.</p>

<h2 id="what-it-does">What a password manager does</h2>
<ul>
  <li><strong>Generates</strong> long random passwords you never have to type or remember.</li>
  <li><strong>Stores</strong> them in an encrypted vault, unlocked by one strong master passphrase.</li>
  <li><strong>Fills</strong> them automatically on the correct site, and syncs across your devices.</li>
  <li><strong>Audits</strong> your vault for reused, weak, or breached passwords.</li>
</ul>

<h2 id="beyond-storage">Protection beyond storage</h2>
<p>The underrated benefit is <strong>anti-phishing</strong>: autofill matches the exact domain. On <code>paypa1-login.example.com</code>, a manager offers nothing — a warning sign even when your eyes miss it. Managers also kill "password reset fatigue": unique passwords mean one site's breach no longer cascades.</p>

<h2 id="choosing">How to choose one</h2>
<ul>
  <li><strong>Zero-knowledge design</strong> — the provider cannot read your vault; encryption happens on your device.</li>
  <li><strong>Independent audits and a published security model.</strong></li>
  <li><strong>Passkey and 2FA-code support</strong>, secure sharing, emergency access.</li>
  <li><strong>Reputation and longevity.</strong> Your OS/browser built-in manager is far better than nothing; dedicated tools offer more control and portability.</li>
</ul>

<h2 id="master-password">The master password</h2>
<p>Your vault is only as strong as its master password. Use a 6-word passphrase (see our <a href="/passphrase.html">passphrase generator</a>), write it on paper stored somewhere physically safe until memorized, and enable 2FA on the manager account itself.</p>

<h2 id="migration">Migrating safely</h2>
<ol>
  <li>Install the manager and set a strong master passphrase.</li>
  <li>Import from your browser's saved passwords, then clear the browser store.</li>
  <li>Fix the crown jewels first: email, banking, cloud — fresh random passwords.</li>
  <li>Work through reused/weak entries as you naturally log in; no need to do all 200 in a day.</li>
</ol>

<h2 id="edge-cases">Edge cases and limits</h2>
<ul>
  <li>A manager does not protect against malware already on your device — keep systems patched.</li>
  <li>Sync relies on your account security, hence master passphrase + 2FA.</li>
  <li>Export a backup only to encrypted storage, and never email vault exports.</li>
</ul>
<div class="callout callout-tip"><p><strong>Bottom line:</strong> one strong passphrase to memorize, and let software carry the rest. That is the entire trick.</p></div>
""",
    "related": ["two-factor-authentication", "create-strong-password", "passkeys-explained"],
}

G5 = {
    "slug": "two-factor-authentication",
    "title": "Two-Factor Authentication (2FA): What to Use and Why",
    "desc": "SMS codes, authenticator apps, push approvals and hardware keys — how each factor type stacks up, and how to set 2FA up without locking yourself out.",
    "category": "Account Security",
    "minutes": 7,
    "toc": [
        ("why", "Why a second factor matters"),
        ("types", "The main types, ranked"),
        ("setup", "Setting it up safely"),
        ("backup-codes", "Backup codes and recovery"),
        ("attacks", "Attacks on 2FA"),
        ("summary", "Summary"),
    ],
    "body": """
<p>Passwords are "something you know" — and everything you know can be phished, guessed, or leaked. A second factor adds "something you have" (a phone, a key) or "something you are" (biometrics), so a stolen password stops being sufficient.</p>

<h2 id="why">Why a second factor matters</h2>
<p>Attackers buy breached passwords in bulk and replay them automatically. 2FA changes the economics: even a perfect password replay fails without your device. It is the cheapest, highest-leverage defense available to consumers.</p>

<h2 id="types">The main types, ranked (weakest to strongest)</h2>
<ol>
  <li><strong>SMS codes.</strong> Better than nothing. Vulnerable to SIM-swapping and number port-out fraud.</li>
  <li><strong>Email codes.</strong> Similar tier; only as strong as your email account.</li>
  <li><strong>Authenticator apps (TOTP).</strong> Free, offline, phishing-resistant-ish. Codes rotate every 30 seconds. Still typeable into a phishing page in real time.</li>
  <li><strong>Push approvals with number matching.</strong> Convenient; approve with care — unexpected prompts mean someone has your password.</li>
  <li><strong>Hardware security keys / passkeys (FIDO2).</strong> Cryptographically bound to the site's origin — a lookalike domain simply fails. The strongest consumer option.</li>
</ol>

<h2 id="setup">Setting it up safely</h2>
<ol>
  <li>Start with your primary email, then banking, then your password manager, then everything else.</li>
  <li>Prefer an authenticator app or hardware key over SMS when offered.</li>
  <li>Register two factors where possible (two keys, or key + app) to avoid single-device loss.</li>
</ol>

<h2 id="backup-codes">Backup codes and recovery</h2>
<p>When a service shows you backup codes, treat them as spare passwords: download them, print them, store them offline (a safe, a locked drawer). Recovery-phone and recovery-email settings deserve the same care — they are the side door around your 2FA.</p>

<h2 id="attacks">Attacks on 2FA</h2>
<ul>
  <li><strong>MFA fatigue:</strong> attackers spam push prompts hoping you tap "approve". Never approve a prompt you did not trigger.</li>
  <li><strong>Real-time phishing (AiTM):</strong> a proxy site relays your password <em>and</em> code to the real site instantly. Only origin-bound factors (keys/passkeys) fully resist this.</li>
  <li><strong>SIM-swap:</strong> your number is ported to an attacker's SIM. Another reason to prefer app/key-based factors.</li>
</ul>

<h2 id="summary">Summary</h2>
<div class="callout callout-tip"><p><strong>Priority order:</strong> email → money → password manager → identity providers → everything else. Best available factor for each, backup codes stored offline, and never approve a prompt you didn't cause.</p></div>
""",
    "related": ["passkeys-explained", "phishing-attacks", "password-best-practices"],
}

GUIDES_1 = [G1, G2, G3, G4, G5]
