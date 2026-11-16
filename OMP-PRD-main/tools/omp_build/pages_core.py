# -*- coding: utf-8 -*-
"""Core tool page bodies."""
from .layout import TOOLS, checker_markup, guide_card, icon, tool_card

# ------------------------------------------------------------------ FAQ (shared)
FAQ_ITEMS = [
    ("Is OMP free?",
     "Yes. Every tool on OopsMyPassword is free, requires no account, and runs entirely in your browser."),
    ("Does OMP store my password?",
     "No. Passwords you type are analyzed in memory, in your browser tab only. They are never transmitted, written to storage, placed in URLs, or included in any logs or analytics. Closing the tab erases everything."),
    ("Does OMP require an account?",
     "No account is needed. Everything runs in your browser and nothing is stored on a server. Email is requested only if you choose article updates, not to unlock anything."),
    ("How is password strength calculated?",
     "A heuristic score combines length, character variety and bonuses, then subtracts penalties for common passwords, dictionary words, repeated and sequential characters, keyboard walks and dates. An adjusted entropy estimate and an indicative offline crack time are derived from the result."),
    ("Is the strength score guaranteed?",
     "No. No meter can prove a password is safe — real security depends on how the password was generated, whether it is reused, and how each website stores it. Treat scores as educational guidance, not guarantees."),
    ("What is entropy?",
     "A measure of unpredictability in bits: H = L × log2(N) for a randomly generated password of length L from a pool of N characters. Each extra bit doubles the guesses an attacker needs. See our entropy guide and calculator."),
    ("What is a password manager?",
     "An app that generates, encrypts and fills unique passwords for every account, protected by one strong master passphrase. It is the recommended way to fix password reuse. See the password manager guide."),
    ("What are passkeys?",
     "A modern replacement for passwords based on public-key cryptography (FIDO2/WebAuthn). Your device holds a private key unlocked by biometrics or PIN; websites store only a public key. Passkeys are phishing-resistant and cannot be reused or leaked from a server database."),
    ("Should I reuse passwords?",
     "Never. Reuse is how one site's data breach becomes the takeover of your other accounts (credential stuffing). Use a unique password per account — a password manager makes this practical."),
    ("What should I do after a data breach?",
     "Change the breached password and every account that reuses it, sign out other sessions, enable 2FA, and stay alert for phishing that references the breach. Follow the step-by-step breach guide."),
]


CHECKER_FAQ = [
    ("What is a password strength test?",
     "A password strength test estimates how hard a password is to guess. This one scores 0–100 from length, character variety and pattern detection (dictionary words, repeats, keyboard walks), with an entropy estimate and an indicative crack time — all computed in your browser."),
    ("How do I test my password strength?",
     "Type or paste the password into the field above. The score, meter and analysis update as you type, and nothing is sent anywhere. For a fuller picture — including reuse hygiene — run the Password Health audit."),
    ("How accurate is a password strength test?",
     "It is an estimate, not a guarantee. Heuristics cannot know how a password was generated or whether it was reused elsewhere. A random 20-character password outlives any clever human one regardless of what the meter says — including ours."),
    ("What is a good password strength test score?",
     "Aim for Strong or Excellent (roughly 70+ out of 100) with no pattern warnings. Length matters most: 16+ characters, ideally a generated password or a multi-word passphrase."),
]

GENERATOR_FAQ = [
    ("Is this random password generator free and online?",
     "Yes — free, no account, and it runs in your browser on crypto.getRandomValues(). Nothing is transmitted, so the generator keeps working even if your connection does not."),
    ("How many characters should a random password have?",
     "12 characters is a practical floor, 15–16 is the current sweet spot, and 20 is the default here. Every extra character multiplies the search space, so length beats every other trick."),
    ("Can I generate a random password with special characters?",
     "Yes — uppercase, lowercase, numbers and symbols are included by default, and every character type is enforced before a secure shuffle. Sites that reject symbols can be served with the type toggles."),
    ("What is an easy-to-remember strong password?",
     "A passphrase: several random words strung together, like the Passphrase Generator builds. Randomness — not cleverness — is what makes it strong, and 5–7 words is both memorable and slow to crack."),
]


def faq_details(items):
    return "\n".join(
        f'<details class="faq-item"><summary>{q}<span class="chev">{icon("chevron","icon-18")}</span></summary>'
        f'<div class="faq-body"><p>{a}</p></div></details>'
        for q, a in items
    )


# ------------------------------------------------------------------ Home
def home_body(guides):
    tool_cards = "\n".join(tool_card(t) for t in TOOLS)
    by_href = {t["href"]: t for t in TOOLS}
    popular_cards = "\n".join(tool_card(by_href[h]) for h in (
        "/checker", "/generator", "/breach-check",
        "/what-is-my-ip", "/dns-leak-test", "/url-scanner"))
    guide_cards = "\n".join(guide_card(g) for g in guides[:6])
    faq_preview = faq_details(FAQ_ITEMS[:5])
    return f"""
<section class="hero">
  <div class="container hero-copy">
    <div>
      <span class="chip chip-accent reveal">{icon("shield","icon-16")} Privacy-first · 100% client-side</span>
      <h1 class="h-display reveal reveal-d1">Know how strong <span class="grad-text">your password</span> really is.</h1>
      <p class="lead reveal reveal-d2">Test your password strength in real-time, check security risks, generate stronger passwords, and learn how to protect your digital life.</p>
      <div class="hero-cta reveal reveal-d3">
        <a class="btn btn-primary btn-lg" href="/checker">{icon("gauge","icon-18")} Check Your Password</a>
        <a class="btn btn-secondary btn-lg" href="/generator">{icon("dice","icon-18")} Generate Strong Password</a>
      </div>
      <div class="hero-trust reveal reveal-d3">
        <span class="chip">{icon("check","icon-16")} No account required</span>
        <span class="chip">{icon("check","icon-16")} Client-side analysis</span>
        <span class="chip">{icon("check","icon-16")} Privacy-first</span>
      </div>
    </div>
  </div>
</section>

<!-- ===== Popular tools (home = navigation hub; every tool has its own page) ===== -->
<section class="section-tight" id="popular-tools" style="background: var(--bg-soft); border-block: 1px solid var(--border)">
  <div class="container">
    <div class="section-head reveal">
      <span class="eyebrow">Start here</span>
      <h2 class="h-1">Popular tools</h2>
      <p class="lead">Six tools people reach for most. Each runs on its own page — nothing is squeezed into this one.</p>
    </div>
    <div class="grid grid-3">{popular_cards}</div>
  </div>
</section>

<section class="section-tight">
  <div class="container">
    <div class="feature-split">
      <div class="card card-pad hoverable reveal">
        <span class="card-icon">{icon("zap","icon-22")}</span>
        <h3>Instant, honest analysis</h3>
        <p>Length, variety, entropy, common-password and pattern detection — computed live as you type, with clearly-labeled heuristics instead of fake precision.</p>
      </div>
      <div class="card card-pad hoverable reveal reveal-d1">
        <span class="card-icon">{icon("server-off","icon-22")}</span>
        <h3>Nothing leaves your device</h3>
        <p>No servers receive your password. No storage, no logs, no analytics on what you type. Verify it yourself in your browser's network inspector.</p>
      </div>
      <div class="card card-pad hoverable reveal reveal-d2">
        <span class="card-icon">{icon("grad","icon-22")}</span>
        <h3>Learn as you go</h3>
        <p>Every check links to plain-language guides on passphrases, managers, 2FA, passkeys and breach response — security education, not fear.</p>
      </div>
    </div>
  </div>
</section>

<section class="section" id="how-it-works">
  <div class="container">
    <div class="section-head reveal">
      <span class="eyebrow">How it works</span>
      <h2 class="h-1">Three steps to better passwords</h2>
      <p class="lead">No sign-up screens, no setup, no data trade. Open, test, improve.</p>
    </div>
    <div class="steps">
      <div class="step reveal"><h3 class="h-3">Type — or don't</h3><p class="muted">Enter a password in the checker. It stays in the tab's memory; analysis is computed by JavaScript running on your device.</p></div>
      <div class="step reveal reveal-d1"><h3 class="h-3">Understand the result</h3><p class="muted">See a 0–100 heuristic score, entropy estimate, indicative crack time, and exactly which patterns weakened it — each explained in plain English.</p></div>
      <div class="step reveal reveal-d2"><h3 class="h-3">Fix it properly</h3><p class="muted">Regenerate with a CSPRNG, switch memorized secrets to passphrases, and pick up the habits in the guides: managers, 2FA, passkeys.</p></div>
    </div>
  </div>
</section>

<section class="section" id="tools-preview" style="background: var(--bg-soft); border-block: 1px solid var(--border)">
  <div class="container">
    <div class="section-head reveal">
      <span class="eyebrow">Toolbox</span>
      <h2 class="h-1">Fourteen tools. Zero accounts.</h2>
      <p class="lead">Every tool below actually works, in your browser, right now. Anything we haven't finished is labeled instead of faked.</p>
    </div>
    <div class="grid grid-4">{tool_cards}</div>
  </div>
</section>

<section class="section" id="generate">
  <div class="container">
    <div class="cta-band reveal">
      <h2 class="h-1">Need a strong password <em>right now?</em></h2>
      <p class="lead mt-8" style="max-width:620px;margin-inline:auto">The generator builds up to 64-character passwords or a diceware passphrase with pro options — generated locally with <code class="mono">crypto.getRandomValues()</code>, copy in one click. It lives on its own page.</p>
      <div class="flex gap-12 wrap mt-24" style="justify-content:center">
        <a class="btn btn-primary btn-lg" href="/generator">{icon("dice","icon-18")} Generate a Password</a>
        <a class="btn btn-secondary btn-lg" href="/passphrase">Passphrase Generator</a>
      </div>
    </div>
  </div>
</section>

<section class="section" id="guides-preview" style="background: var(--bg-soft); border-block: 1px solid var(--border)">
  <div class="container">
    <div class="section-head reveal">
      <span class="eyebrow">Learn</span>
      <h2 class="h-1">Guides that make you harder to hack</h2>
      <p class="lead">Short, practical reads written for humans — no fear-mongering, no jargon walls.</p>
    </div>
    <div class="grid grid-3">{guide_cards}</div>
    <div class="center mt-32 reveal"><a class="btn btn-secondary" href="/articles">Explore all articles &amp; guides {icon("arrow","icon-16")}</a></div>
  </div>
</section>

<section class="section" id="products-teaser">
  <div class="container">
    <a href="/products" class="card card-pad card-link reveal" style="display:flex;flex-wrap:wrap;gap:20px;align-items:center;justify-content:space-between">
      <div style="max-width:640px">
        <span class="eyebrow">Shop</span>
        <h2 class="h-3" style="margin-top:8px">Books, courses and toolkits from OopsMyPassword</h2>
        <p class="muted" style="margin-top:8px">Deeper material than the free guides — printable checklists, structured courses and ready-to-use templates. Browse the catalog, buy through the storefront, download securely.</p>
      </div>
      <span class="btn btn-primary">Browse products {icon("arrow","icon-16")}</span>
    </a>
  </div>
</section>

<section class="section" id="privacy">
  <div class="container two-col" style="align-items:center">
    <div class="card card-pad reveal">
      <h3 class="h-3">The OMP privacy contract</h3>
      <ul class="list-plain mt-16">
        <li>{icon("lock","icon-18")}<span><strong>Passwords never leave your device</strong> — analysis is 100% client-side JavaScript</span></li>
        <li>{icon("lock","icon-18")}<span><strong>No account needed</strong> — nothing you type leaves your device</span></li>
        <li>{icon("lock","icon-18")}<span><strong>No password history</strong> — password inputs are never written to URLs, storage or logs</span></li>
        <li>{icon("lock","icon-18")}<span><strong>CSPRNG only</strong> — generation uses <span class="mono">crypto.getRandomValues()</span></span></li>
        <li>{icon("lock","icon-18")}<span><strong>No fake claims</strong> — demos are labeled demos; estimates are labeled estimates</span></li>
      </ul>
    </div>
    <div class="reveal reveal-d1">
      <span class="eyebrow">Privacy</span>
      <h2 class="h-1">A password tool you don't have to trust</h2>
      <p class="lead">Most "password checkers" quietly send your password to a server. OMP is architected so it <em>can't</em>: the analysis engine ships as JavaScript that never performs a network request. Open your browser's developer tools and watch — zero password traffic, ever.</p>
      <div class="flex gap-12 wrap mt-24">
        <a class="btn btn-secondary" href="/privacy">Read the privacy policy</a>
        <a class="btn btn-ghost" href="/about">Why we built this {icon("arrow","icon-16")}</a>
      </div>
    </div>
  </div>
</section>

<section class="section" id="faq-preview" style="background: var(--bg-soft); border-block: 1px solid var(--border)">
  <div class="container container-narrow">
    <div class="section-head reveal">
      <span class="eyebrow">FAQ</span>
      <h2 class="h-1">Straight answers</h2>
    </div>
    <div class="grid reveal" style="gap:12px">{faq_preview}</div>
    <div class="center mt-32 reveal"><a class="btn btn-secondary" href="/faq">All 10 questions {icon("arrow","icon-16")}</a></div>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="cta-band reveal">
      <h2 class="h-1">Your next password can be your best one</h2>
      <p class="lead mt-8" style="max-width:560px;margin-inline:auto">Test it, replace it, or learn why it works — all without creating an account.</p>
      <div class="flex gap-12 wrap mt-24" style="justify-content:center">
        <a class="btn btn-primary btn-lg" href="/checker">{icon("gauge","icon-18")} Check Your Password</a>
        <a class="btn btn-secondary btn-lg" href="/articles">Explore the Articles</a>
      </div>
    </div>
  </div>
</section>
"""


# ------------------------------------------------------------------ Checker page
def checker_body():
    return f"""
<section class="page-hero">
  <div class="container">
    <span class="chip chip-accent">{icon("gauge","icon-16")} Live tool · runs locally</span>
    <h1 class="h-1 mt-16">Password Strength Checker</h1>
    <p class="lead">Real-time analysis with pattern detection, entropy estimation, crack-time indication and concrete recommendations — computed entirely in your browser.</p>
  </div>
</section>
<section class="section-tight" id="checker" style="padding-top:24px">
  <div class="container">
    {checker_markup("page")}
  </div>
</section>
<section class="section">
  <div class="container">
    <div class="section-head">
      <span class="eyebrow">Methodology</span>
      <h2 class="h-1">What the checker actually checks</h2>
      <p class="lead">Transparency over theater — here is the full model, including its limits.</p>
    </div>
    <div class="grid grid-3">
      <div class="card card-pad"><span class="card-icon">{icon("check-circle","icon-22")}</span><h3>Positive signals</h3><p>Length (the biggest factor), character-type variety, symbol density, and bonuses for 12/16/20+ characters and uppercase letters beyond the first position.</p></div>
      <div class="card card-pad"><span class="card-icon">{icon("alert","icon-22")}</span><h3>Pattern penalties</h3><p>Common passwords (exact and embedded), dictionary words including leetspeak forms, repeated runs (<span class="mono">aaaa</span>), sequences (<span class="mono">abcd</span>), keyboard walks (<span class="mono">qwerty</span>) and year-like dates.</p></div>
      <div class="card card-pad"><span class="card-icon">{icon("sigma","icon-22")}</span><h3>Entropy & crack time</h3><p>Pool-based entropy (<span class="mono">L·log₂N</span>) adjusted downward by detected patterns, then translated into an indicative offline crack time at ~10¹¹ guesses/second.</p></div>
    </div>
    <div class="notice-band mt-32">{icon("info","icon-20")}<p><strong>Honest limits.</strong> A heuristic cannot know how your password was generated or where else you used it. A randomly generated 20-character password will outlive any "clever" human one regardless of what any meter says — including ours. <a href="/articles/password-entropy" style="color:var(--purple)">Read how entropy works</a>, or see <a href="/articles/nist-password-guidelines-2026" style="color:var(--purple)">what the current NIST password guidelines actually recommend</a>.</p></div>
  </div>
</section>
<section class="section" id="faq" style="padding-top:0">
  <div class="container container-narrow">
    <div class="section-head">
      <span class="eyebrow">FAQ</span>
      <h2 class="h-2">Password strength test — common questions</h2>
    </div>
    {faq_details(CHECKER_FAQ)}
  </div>
</section>
<section class="section" style="padding-top:0">
  <div class="container container-narrow grid grid-3">
    <a class="card card-pad card-link center" href="/generator"><span class="card-icon">{icon("dice","icon-22")}</span><h3>Weak result?</h3><p>Generate a strong replacement in one click.</p></a>
    <a class="card card-pad card-link center" href="/password-health"><span class="card-icon">{icon("pulse","icon-22")}</span><h3>Want the full audit?</h3><p>Run the 10-point password health check.</p></a>
    <a class="card card-pad card-link center" href="/articles/create-strong-password"><span class="card-icon">{icon("book","icon-22")}</span><h3>Build the habit</h3><p>How to create strong passwords that last.</p></a>
  </div>
</section>
"""


# ------------------------------------------------------------------ Generator page
def generator_body():
    def switch_row(opt, name, desc, checked=True):
        c = " checked" if checked else ""
        return f"""<div class="opt-row">
  <div><div class="opt-name">{name}</div><div class="opt-desc">{desc}</div></div>
  <span class="switch"><input type="checkbox" data-opt="{opt}" aria-label="{name}"{c}><span class="track"></span></span>
</div>"""
    return f"""
<section class="page-hero">
  <div class="container">
    <span class="chip chip-accent">{icon("dice","icon-16")} Live tool · CSPRNG</span>
    <h1 class="h-1 mt-16">Random Password Generator</h1>
    <p class="lead">Cryptographically secure random passwords with <span class="mono">crypto.getRandomValues()</span> — generated locally in your browser, free and online. Default: 20 characters, all character types.</p>
  </div>
</section>
<section class="section-tight" style="padding-top:24px">
  <div class="container two-col" style="align-items:start">
    <div class="card card-pad" data-generator>
      <h2 class="h-3">Your password</h2>
      <div class="gen-output mt-16"><code data-gen-output aria-live="polite"></code>
        <button class="icon-btn" type="button" data-copy-btn aria-label="Copy password"></button>
      </div>
      <div class="meter" data-gen-meter aria-hidden="true"></div>
      <div class="flex justify-between items-center mt-8">
        <span class="tiny muted">Estimated entropy</span>
        <span class="tiny muted mono" data-gen-entropy></span>
      </div>

      <div class="slider-head mt-24"><label for="gen-length"><strong>Length</strong> <span class="muted" style="font-weight:400">· 8–64</span></label><output id="gen-length-out" data-gen-length-out>20</output></div>
      <input type="range" id="gen-length" min="8" max="64" value="20" step="1" data-gen-length aria-describedby="gen-length-out">

      <div class="mt-16">
        {switch_row("upper", "Uppercase (A–Z)", "Adds 26 characters to the pool")}
        {switch_row("lower", "Lowercase (a–z)", "Adds 26 characters to the pool")}
        {switch_row("digits", "Numbers (0–9)", "Adds 10 characters to the pool")}
        {switch_row("symbols", "Symbols (!@#…)", "Adds 33 characters to the pool")}
        {switch_row("ambiguous", "Exclude ambiguous characters", "Removes I, l, 1, O, 0 — useful when read aloud or transcribed", checked=False)}
      </div>

      <div class="flex gap-12 wrap mt-24">
        <button class="btn btn-primary" type="button" data-gen-btn>{icon("refresh","icon-18")} Generate</button>
        <button class="btn btn-secondary" type="button" data-copy-btn>{icon("check","icon-18")} Copy</button>
      </div>
      <p class="privacy-note">{icon("lock","icon-16")} Generated locally in your browser — nothing is sent anywhere, and the clipboard is the only place it goes when you choose to copy.</p>
    </div>

    <div class="grid" style="align-content:start">
      <div class="card card-pad">
        <span class="card-icon">{icon("zap","icon-22")}</span>
        <h3>Why getRandomValues matters</h3>
        <p><span class="mono">Math.random()</span> is a predictable pseudo-random generator — its future outputs can be reconstructed from observed ones. <span class="mono">crypto.getRandomValues()</span> draws from the operating system's CSPRNG, the same source browsers use for TLS keys. OMP additionally uses <strong>rejection sampling</strong> and a <strong>secure Fisher–Yates shuffle</strong>, so output is unbiased.</p>
      </div>
      <div class="card card-pad">
        <span class="card-icon">{icon("list","icon-22")}</span>
        <h3>How OMP builds each password</h3>
        <ul class="list-plain">
          <li>{icon("check","icon-18")}<span>One guaranteed character from every selected type</span></li>
          <li>{icon("check","icon-18")}<span>Remaining positions drawn uniformly from the combined pool</span></li>
          <li>{icon("check","icon-18")}<span>Everything shuffled with CSPRNG randomness</span></li>
        </ul>
      </div>
      <div class="card card-pad">
        <span class="card-icon">{icon("key","icon-22")}</span>
        <h3>Need something memorable?</h3>
        <p>Random words beat random characters for memorization. A 5-word passphrase from a 1,296-word list carries ~52 bits; 7 words ~72 bits.</p>
        <a class="btn btn-secondary btn-sm mt-16" href="/passphrase">Try the passphrase generator {icon("arrow","icon-16")}</a>
      </div>
    </div>
  </div>
  <div class="container-narrow mt-48">
    <div class="section-head">
      <span class="eyebrow">FAQ</span>
      <h2 class="h-2">Random password generator — common questions</h2>
    </div>
    {faq_details(GENERATOR_FAQ)}
  </div>
</section>
"""


# ------------------------------------------------------------------ Tools page
def tools_body():
    by_href = {t["href"]: t for t in TOOLS}

    def cards_for(hrefs):
        return "\n".join(tool_card(by_href[h]) for h in hrefs)

    def group(title, lead, hrefs, grid="grid-4"):
        return f"""
    <div class="section-head">
      <h2 class="h-2">{title}</h2>
      <p class="lead">{lead}</p>
    </div>
    <div class="grid {grid}">{cards_for(hrefs)}</div>"""

    sessions = (
        group("Password & account tools",
              "Test, generate and audit secrets. Every tool in this group runs fully in your browser — no request leaves the page.",
              ["/checker", "/generator", "/password-health", "/passphrase",
               "/entropy", "/random-string", "/security-checklist"])
        + group("Privacy & network checks",
              "See what the internet sees about you — and which leaks betray a VPN. The network calls these make are listed on each page.",
              ["/breach-check", "/what-is-my-ip", "/ip-leak-test", "/dns-leak-test"], grid="grid-4")
        + group("Scanning & OSINT",
              "Practitioner tools for suspicious links, hashes and search — all client-side analysis.",
              ["/dork-builder", "/hash-inspector", "/url-scanner"], grid="grid-3")
    )
    return f"""
<section class="page-hero">
  <div class="container">
    <span class="chip chip-accent">{icon("shield","icon-16")} All tools live unless labeled</span>
    <h1 class="h-1 mt-16">The OMP Toolbox</h1>
    <p class="lead">Fourteen focused utilities in three groups — for testing, generating and understanding passwords, checking what the internet sees, and inspecting suspicious links and hashes. Anything that isn't finished says "Coming Soon" instead of pretending.</p>
  </div>
</section>
<section class="section-tight" style="padding-top:16px">
  <div class="container">
    {sessions}
    <div class="notice-band mt-48">{icon("info","icon-20")}<p><strong>No fake tools, no fake stats.</strong> OMP never labels something "connected to a breach database" when it isn't, and never shows invented counters like "12M passwords checked". What you see is what runs.</p></div>
  </div>
</section>
<section class="section" style="padding-top:0">
  <div class="container">
    <div class="section-head">
      <span class="eyebrow">Command references</span>
      <h2 class="h-2">CLI cheat sheets</h2>
      <p class="lead">One-page command references for the tools this work actually runs on — each sheet is a single page you can keep open in a tab.</p>
    </div>
    <div class="flex gap-12 wrap">
      <a class="btn btn-ghost btn-sm" href="/cheatsheets/nmap-command-cheatsheet">Nmap</a>
      <a class="btn btn-ghost btn-sm" href="/cheatsheets/curl-command-cheatsheet">curl</a>
      <a class="btn btn-ghost btn-sm" href="/cheatsheets/ffuf-web-fuzzing-cheatsheet">ffuf</a>
      <a class="btn btn-ghost btn-sm" href="/cheatsheets/hydra-brute-force-cheatsheet">Hydra</a>
      <a class="btn btn-ghost btn-sm" href="/cheatsheets/metasploit-command-cheatsheet">Metasploit</a>
      <a class="btn btn-ghost btn-sm" href="/cheatsheets/http-security-headers-cheatsheet">HTTP security headers</a>
      <a class="btn btn-primary btn-sm" href="/cheatsheets">All cheat sheets →</a>
    </div>
  </div>
</section>
"""


# ------------------------------------------------------------------ Breach page
def breach_body():
    return f"""
<section class="page-hero">
  <div class="container">
    <span class="chip chip-accent">{icon("radar","icon-16")} Live tool · k-anonymity prefix query</span>
    <h1 class="h-1 mt-16">k-Anonymity Password Check</h1>
    <p class="lead">Verify whether a password appears in known public breaches using zero-knowledge <strong>k-anonymity</strong>. Your password is SHA-1 hashed in your browser; only the first 5 hex characters are sent to the range API. If the database cannot be reached, the tool says so instead of guessing &mdash; it will never call a password safe on the strength of a lookup that failed.</p>
  </div>
</section>

<section class="section-tight" style="padding-top:16px">
  <div class="container two-col" style="align-items:start">
    <div class="card card-pad" data-breach>
      <h2 class="h-3">Run a k-anonymity breach lookup</h2>
      <p class="muted small mt-8">Type any password. Your browser computes its SHA-1 hash locally and queries only the 5-character prefix against the Pwned Passwords range API. The password and full hash never leave your device. If the database cannot be reached, you get an unavailable message with the reason and a retry &mdash; not a verdict.</p>
      <div class="pw-input-wrap mt-16">
        <input class="pw-input" type="password" data-breach-input placeholder="Password to check…" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Password to check">
      </div>
      <button class="btn btn-primary mt-16" type="button" data-breach-btn>Check for breaches</button>
      <div class="hash-view" data-breach-hash hidden></div>
      <div class="breach-result" data-breach-result aria-live="polite" aria-atomic="true">
        <div data-breach-status></div>
      </div>
      <p class="disclaimer mt-16">{icon("info","icon-18")}<span><strong>Zero-knowledge guarantee.</strong> Only a 5-character SHA-1 prefix (~1 million matching hashes per prefix) is requested over HTTPS with padding enabled. If that request fails, you get an unavailable message, not a verdict. A password that appears in a short built-in list of well-known breached passwords is still flagged while offline, because a hit is a hit &mdash; it is the &ldquo;not found&rdquo; that would prove nothing.</span></p>
    </div>

    <div class="grid" style="align-content:start">
      <div class="card card-pad">
        <span class="card-icon">{icon("radar","icon-22")}</span>
        <h3>What is a breach?</h3>
        <p>When a service is compromised, its user database — emails, password hashes, personal details — can be stolen and later published or sold. Billions of such records circulate in "combo lists" used for <a href="/glossary/credential-stuffing" style="color:var(--purple)">credential stuffing</a>.</p>
      </div>
      <div class="card card-pad">
        <span class="card-icon">{icon("alert","icon-22")}</span>
        <h3>Why reuse is the real danger</h3>
        <p>Attackers don't need to hack your bank — they take a password leaked from a breached forum and replay it everywhere you have an account. Unique passwords turn a breach into a one-account problem.</p>
      </div>
    </div>
  </div>
</section>

<section class="section" style="background: var(--bg-soft); border-block: 1px solid var(--border)">
  <div class="container">
    <div class="section-head">
      <span class="eyebrow">The model</span>
      <h2 class="h-1">How k-anonymity breach lookup works</h2>
      <p class="lead">The privacy-preserving range architecture powered by <a href="/osint/have-i-been-pwned" style="color:var(--purple)">Have I Been Pwned's Pwned Passwords API</a>.</p>
    </div>
    <div class="steps">
      <div class="step"><h3 class="h-3">Hash locally</h3><p class="muted">Your password is hashed on your device using WebCrypto SHA-1. The plaintext password and full 40-character digest never leave your browser.</p></div>
      <div class="step"><h3 class="h-3">Send only a 5-char prefix</h3><p class="muted">Only the first 5 hex characters of the hash are queried — a range shared by hundreds of unrelated hashes, with response padding enabled.</p></div>
      <div class="step"><h3 class="h-3">Match locally</h3><p class="muted">The range endpoint returns candidate 35-character suffixes; your browser compares them locally in memory and discards the list immediately.</p></div>
    </div>
    <div class="notice-band mt-32">{icon("info","icon-20")}<p><strong>Transparent network behavior:</strong> open your browser's Network inspector while running a check — you will see a single <span class="mono">GET</span> request containing only 5 hex characters (<span class="mono">api.pwnedpasswords.com/range/XXXXX</span>), and never your password. Read more in our <a href="/privacy" style="color:var(--purple)">privacy policy</a>.</p></div>
  </div>
</section>

<section class="section">
  <div class="container container-narrow">
    <h2 class="h-2">Why hashing alone doesn't make passwords safe</h2>
    <div class="prose mt-16">
      <p>It is tempting to think "hash it and it's protected". Reality is harsher:</p>
      <ul>
        <li><strong>Fast hashes are brute-forceable.</strong> MD5/SHA-1 are designed for speed; a modern GPU rig tries ~10¹¹ candidates per second against leaked databases.</li>
        <li><strong>Unsalted hashes leak equality.</strong> Identical passwords produce identical hashes, enabling rainbow tables and instant matches across users.</li>
        <li><strong>Hashing is not encryption.</strong> It is one-way only against inputs with enough entropy — human passwords usually don't have it, which is exactly what cracking exploits.</li>
        <li><strong>The fix is layered:</strong> salted, memory-hard hashing (Argon2/bcrypt) on the server side; unique, generated passwords and 2FA on yours.</li>
      </ul>
      <p>If a service you use was breached, follow the playbook in <a href="/articles/after-a-data-breach">What to Do After a Data Breach</a>.</p>
    </div>
  </div>
</section>
<section class="section" id="faq">
  <div class="container container-narrow">
    <h2 class="h-2">Frequently asked questions</h2>
    <div class="mt-16">
      <details class="faq-item"><summary>How do I check if my password is leaked?<span class="chev">{icon("chevron","icon-18")}</span></summary><div class="faq-body"><p>This page does it without sending the password anywhere: your browser hashes it with SHA-1, asks the breach database for one 5-character prefix, and compares the returned list locally. A count above zero means the password appears in known breaches &mdash; change it everywhere it was used.</p></div></details>
      <details class="faq-item"><summary>What should I do if my password is compromised?<span class="chev">{icon("chevron","icon-18")}</span></summary><div class="faq-body"><p>Change it on every account that used it, starting with your email &mdash; that is the key to password resets everywhere. Turn on 2FA, and replace reused passwords with unique generated ones so the next breach costs one account instead of all of them.</p></div></details>
    </div>
  </div>
</section>
"""


# ------------------------------------------------------------------ Health page
def health_body():
    return f"""
<section class="page-hero">
  <div class="container">
    <span class="chip chip-accent">{icon("pulse","icon-16")} Live tool · local audit</span>
    <h1 class="h-1 mt-16">Password Health</h1>
    <p class="lead">A 10-point local audit of a single password — length, diversity, patterns, entropy and reuse hygiene — with a letter grade and a fix for every failed check. No account, no history, nothing stored.</p>
  </div>
</section>
<section class="section-tight" style="padding-top:24px">
  <div class="container two-col" style="align-items:start" data-health>
    <div class="card card-pad">
      <div class="field-label"><label for="health-input">Password to audit</label></div>
      <div class="pw-input-wrap">
        <input id="health-input" class="pw-input" type="password" data-health-input placeholder="Type a password…" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-describedby="health-privacy">
        <div class="pw-tools"><button class="pw-tool" type="button" data-health-toggle aria-label="Show password"></button></div>
      </div>
      <p class="privacy-note" id="health-privacy">{icon("lock","icon-16")} Audited locally, in this tab only. OMP keeps no password history — there is nothing to sync, export, or leak.</p>
      <div class="grade-ring-wrap mt-24">
        <div class="grade-ring" data-health-ring role="img" aria-label="Password grade">
          <svg width="132" height="132" viewBox="0 0 132 132">
            <defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8B5CF6"/><stop offset="1" stop-color="#22D3EE"/></linearGradient></defs>
            <circle class="ring-bg" cx="66" cy="66" r="54" fill="none" stroke-width="10"/>
            <circle class="ring-val" cx="66" cy="66" r="54" fill="none" stroke-width="10" stroke-dasharray="339.29" stroke-dashoffset="339.29"/>
          </svg>
          <div class="ring-label"><span class="g" data-health-score>—</span><span class="t" data-health-grade></span></div>
        </div>
        <p class="muted small" style="flex:1;min-width:220px" data-health-summary aria-live="polite" aria-atomic="true"></p>
      </div>
    </div>
    <div class="card card-pad">
      <h2 class="h-3">Audit checklist</h2>
      <ul class="check-list mt-16" data-health-checks></ul>
    </div>
  </div>
</section>
<section class="section" style="padding-top:0">
  <div class="container container-narrow">
    <div class="notice-band">{icon("info","icon-20")}<p><strong>About reuse checks.</strong> Because OMP stores no password history, it genuinely cannot know where else a password is used — and we won't pretend otherwise. The reuse reminder is advice; enforcing uniqueness is a password manager's job. See <a href="/articles/password-manager-benefits" style="color:var(--purple)">Password Manager Benefits</a>.</p></div>
  </div>
</section>
"""


# ------------------------------------------------------------------ Entropy page
def entropy_body():
    return f"""
<section class="page-hero">
  <div class="container">
    <span class="chip chip-accent">{icon("sigma","icon-16")} Live tool · the math, exposed</span>
    <h1 class="h-1 mt-16">Password Entropy Calculator</h1>
    <p class="lead">See exactly how length and character pools become bits of entropy — and what those bits mean against realistic attackers.</p>
  </div>
</section>
<section class="section-tight" style="padding-top:24px">
  <div class="container two-col" style="align-items:start">
    <div class="card card-pad">
      <h2 class="h-3">From parameters</h2>
      <p class="muted small mt-8">Assumes every position is chosen uniformly at random — which is true only for generated passwords.</p>
      <div class="mt-16">
        <label class="opt-row" style="cursor:pointer"><div><div class="opt-name">Lowercase (a–z)</div></div><input type="checkbox" data-ec-pool value="lower" checked></label>
        <label class="opt-row" style="cursor:pointer"><div><div class="opt-name">Uppercase (A–Z)</div></div><input type="checkbox" data-ec-pool value="upper" checked></label>
        <label class="opt-row" style="cursor:pointer"><div><div class="opt-name">Digits (0–9)</div></div><input type="checkbox" data-ec-pool value="digits" checked></label>
        <label class="opt-row" style="cursor:pointer"><div><div class="opt-name">Symbols (~33)</div></div><input type="checkbox" data-ec-pool value="symbols" checked></label>
        <div class="opt-row">
          <div><div class="opt-name">…or custom pool size</div><div class="opt-desc">Overrides the checkboxes (e.g., 1296 for a word list)</div></div>
          <input class="input" style="width:110px" type="number" min="1" max="100000" data-ec-custom-pool placeholder="e.g. 1296" aria-label="Custom pool size">
        </div>
      </div>
      <div class="slider-head mt-16"><label for="ec-length"><strong>Length</strong> (characters or words)</label><output id="ec-length-out" data-ec-length-out>20</output></div>
      <input type="range" id="ec-length" min="1" max="128" value="20" step="1" data-ec-length aria-describedby="ec-length-out">
      <div class="stat-grid mt-16">
        <div class="stat"><div class="k">Entropy</div><div class="v mono" data-ec-entropy aria-live="polite" aria-atomic="true">—</div></div>
        <div class="stat"><div class="k">Possible combinations</div><div class="v mono" data-ec-combos>—</div></div>
      </div>
    </div>
    <div class="grid" style="align-content:start">
      <div class="card card-pad">
        <h2 class="h-3">Average time to crack, by attacker model</h2>
        <div class="table-scroll mt-16"><table class="crack-table">
          <thead><tr><th>Attacker</th><th>Guesses/s</th><th>Avg. time</th></tr></thead>
          <tbody data-ec-table></tbody>
        </table></div>
        <p class="tiny muted mt-8">Average = half the search space. Real resistance also depends on hashing, rate limits and 2FA.</p>
        <p class="tiny muted mt-8">The offline attacks above are exactly what tools like Hashcat and John the Ripper run against leaked databases — <a href="/compare/hashcat-vs-john-the-ripper">see them compared</a>.</p>
      </div>
      <div class="card card-pad">
        <h2 class="h-3">…or from an actual password</h2>
        <p class="muted small mt-8">Runs the local analysis engine: naive pool entropy adjusted for detected patterns. <strong>Clear the field when done.</strong></p>
        <div class="pw-input-wrap mt-16">
          <input class="pw-input" type="text" data-ec-password placeholder="Type a password…" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Password to estimate entropy for">
        </div>
        <div class="stat mt-16"><div class="k">Adjusted estimate</div><div class="v mono" data-ec-pw-entropy>—</div></div>
        <p class="tiny muted mt-8" data-ec-pw-detail></p>
      </div>
    </div>
  </div>
</section>
<section class="section" style="padding-top:16px">
  <div class="container container-narrow prose">
    <h2 id="formula">The formula</h2>
    <p><code>H = L × log₂(N)</code> — length times the base-2 logarithm of the pool size. Each random lowercase letter adds ~4.7 bits; each mixed-case alphanumeric ~5.95 bits; each full-set character ~6.57 bits; each word from a 1,296-word list ~10.34 bits.</p>
    <p>The catch: the formula only holds when selection is truly random. Human choices collapse the effective pool dramatically. Details, tables and attacker models: <a href="/articles/password-entropy">How Password Entropy Works</a>.</p>
  </div>
</section>
<section class="section" id="faq">
  <div class="container container-narrow">
    <h2 class="h-2">Frequently asked questions</h2>
    <div class="mt-16">
      <details class="faq-item"><summary>How long does it take to crack my password?<span class="chev">{icon("chevron","icon-18")}</span></summary><div class="faq-body"><p>That is what the calculator above answers: type the password (it never leaves the browser) and the estimate shows crack times against three realistic attackers &mdash; a throttled online form, a stolen hash on a slow KDF, and a GPU rig against a fast hash. The answer is dominated by length and by whether the password is a pattern.</p></div></details>
      <details class="faq-item"><summary>What is a password crack time calculator?<span class="chev">{icon("chevron","icon-18")}</span></summary><div class="faq-body"><p>It converts a password&#39;s entropy &mdash; bits of unpredictability from length and character pools &mdash; into the time an attacker needs to guess it. This page is exactly that: the formula, the pool math, and live crack times for online, slow-hash and GPU-rig attackers.</p></div></details>
    </div>
  </div>
</section>
"""


# ------------------------------------------------------------------ Passphrase page
def passphrase_body():
    return f"""
<section class="page-hero">
  <div class="container">
    <span class="chip chip-accent">{icon("key","icon-16")} Live tool · Diceware-style</span>
    <h1 class="h-1 mt-16">Passphrase Generator</h1>
    <p class="lead">Random words from the EFF short wordlist (<span data-pp-listsize>1296</span> words), drawn locally with a CSPRNG. Strong, memorable, and honest about its math.</p>
  </div>
</section>
<section class="section-tight" style="padding-top:24px">
  <div class="container two-col" style="align-items:start">
    <div class="card card-pad" data-passphrase>
      <h2 class="h-3">Your passphrase</h2>
      <div class="gen-output mt-16"><code data-pp-output aria-live="polite"></code>
        <button class="icon-btn" type="button" data-pp-copy aria-label="Copy passphrase">
          <svg class="icon-18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </button>
      </div>
      <div class="stat-grid">
        <div class="stat"><div class="k">Entropy</div><div class="v mono" data-pp-entropy>—</div></div>
        <div class="stat"><div class="k">Offline crack time (fast hash)</div><div class="v" data-pp-crack>—</div></div>
      </div>

      <div class="slider-head mt-24"><label for="pp-count"><strong>Words</strong> <span class="muted" style="font-weight:400">· ~10.3 bits each</span></label><output id="pp-count-out" data-pp-count-out>6</output></div>
      <input type="range" id="pp-count" min="3" max="10" value="6" step="1" data-pp-count aria-describedby="pp-count-out">

      <div class="mt-16">
        <div class="opt-row">
          <div><div class="opt-name">Separator</div></div>
          <select class="input" data-pp-sep aria-label="Word separator">
            <option value="hyphen" selected>hyphen (-)</option>
            <option value="space">space</option>
            <option value="period">period (.)</option>
            <option value="underscore">underscore (_)</option>
            <option value="none">none</option>
          </select>
        </div>
        <div class="opt-row">
          <div><div class="opt-name">Capitalize words</div><div class="opt-desc">Easier to read on paper; doesn't change the entropy we display</div></div>
          <span class="switch"><input type="checkbox" data-pp-caps aria-label="Capitalize words"><span class="track"></span></span>
        </div>
        <div class="opt-row">
          <div><div class="opt-name">Append a number</div><div class="opt-desc">Adds ~6.6 bits (0–99) — handy for sites with digit requirements</div></div>
          <span class="switch"><input type="checkbox" data-pp-number aria-label="Append a number"><span class="track"></span></span>
        </div>
      </div>

      <div class="flex gap-12 wrap mt-24">
        <button class="btn btn-primary" type="button" data-pp-btn>{icon("refresh","icon-18")} Generate</button>
        <button class="btn btn-secondary" type="button" data-pp-copy>{icon("check","icon-18")} Copy</button>
      </div>
      <p class="privacy-note">{icon("lock","icon-16")} Generated locally in your browser from the bundled <span data-pp-listsize>1296</span>-word list — never transmitted.</p>
    </div>

    <div class="grid" style="align-content:start">
      <div class="card card-pad">
        <span class="card-icon">{icon("book","icon-22")}</span>
        <h3>How passphrases work</h3>
        <p>Diceware picks words the way a generator picks characters: uniformly, from a known list. Entropy is simply <span class="mono">words × log₂(list size)</span>. Five words from this list ≈ 51.7 bits; seven ≈ 72.4 bits — memorable <em>and</em> formidable.</p>
      </div>
      <div class="card card-pad">
        <span class="card-icon">{icon("check-circle","icon-22")}</span>
        <h3>When to use one</h3>
        <ul class="list-plain">
          <li>{icon("check","icon-18")}<span><strong>Master passwords</strong> for your password manager</span></li>
          <li>{icon("check","icon-18")}<span><strong>Device & disk-encryption</strong> unlocks</span></li>
          <li>{icon("check","icon-18")}<span><strong>Anywhere you must type from memory</strong></span></li>
        </ul>
      </div>
      <div class="callout callout-warn">{icon("alert","icon-20")}<p><strong>Don't hand-pick the words.</strong> Humans are terrible random word sources — that's the same trap as "clever" passwords. Generate, then memorize what you got.</p></div>
    </div>
  </div>
</section>
"""


# ------------------------------------------------------------------ Random string page
def random_string_body():
    return f"""
<section class="page-hero">
  <div class="container">
    <span class="chip chip-accent">{icon("hash","icon-16")} Live tool · CSPRNG</span>
    <h1 class="h-1 mt-16">Random String Generator</h1>
    <p class="lead">Tokens, IDs, salts and test fixtures — generated with <span class="mono">crypto.getRandomValues()</span> in your browser. Pick a charset, a length, and a batch size.</p>
  </div>
</section>
<section class="section-tight" style="padding-top:24px">
  <div class="container two-col" style="align-items:start">
    <div class="card card-pad" data-randomizer>
      <div class="grid grid-2">
        <div class="form-field">
          <label for="rs-charset">Character set</label>
          <select class="input" id="rs-charset" data-rand-charset style="width:100%">
            <option value="alnum" selected>Alphanumeric (a–z A–Z 0–9)</option>
            <option value="alpha">Letters only (a–z A–Z)</option>
            <option value="base64url">Base64URL (a–z A–Z 0–9 - _)</option>
            <option value="hex">Hex (0–9 a–f)</option>
            <option value="numeric">Numeric (0–9)</option>
            <option value="symbols">Alphanumeric + symbols</option>
          </select>
        </div>
        <div class="form-field">
          <label for="rs-count">Batch size</label>
          <select class="input" id="rs-count" data-rand-count style="width:100%">
            <option value="1">1 string</option>
            <option value="5" selected>5 strings</option>
            <option value="10">10 strings</option>
            <option value="20">20 strings</option>
          </select>
        </div>
      </div>
      <div class="slider-head mt-16"><label for="rs-length"><strong>Length</strong></label><output id="rs-length-out" data-rand-length-out>32</output></div>
      <input type="range" id="rs-length" min="4" max="128" value="32" step="1" data-rand-length aria-describedby="rs-length-out">
      <div class="mt-24 grid" data-rand-list style="gap:10px" aria-live="polite" aria-atomic="true"></div>
      <button class="btn btn-primary mt-16" type="button" data-rand-btn>{icon("refresh","icon-18")} Regenerate batch</button>
      <p class="privacy-note">{icon("lock","icon-16")} Generated locally — nothing leaves your browser.</p>
    </div>
    <div class="grid" style="align-content:start">
      <div class="card card-pad">
        <span class="card-icon">{icon("info","icon-22")}</span>
        <h2 class="h-3">What these are for</h2>
        <ul class="list-plain">
          <li>{icon("check","icon-18")}<span><strong>Test fixtures</strong> and sample data</span></li>
          <li>{icon("check","icon-18")}<span><strong>Non-guessable IDs</strong> (128-bit Base64URL ≈ UUIDv4 strength)</span></li>
          <li>{icon("check","icon-18")}<span><strong>Salts</strong> and one-time setup values</span></li>
        </ul>
      </div>
      <div class="callout callout-warn">{icon("alert","icon-20")}<p><strong>Building production secrets?</strong> API keys and session tokens should be generated by your server-side CSPRNG and stored hashed. This tool is for convenience and testing — by design it shows values on screen.</p></div>
    </div>
  </div>
</section>
"""


# ------------------------------------------------------------------ Security checklist page
CHECKLIST = [
    ("Passwords & sign-in", [
        ("unique", "Every account has a unique password", "Reuse is the #1 takeover vector — no exceptions for " + "'unimportant' sites."),
        ("manager", "I use a password manager", "The only sustainable way to have 100+ unique, strong passwords."),
        ("email-strong", "My primary email has a strong passphrase + 2FA", "Email resets everything else; it is the keys to the kingdom."),
        ("banking-strong", "Banking/payment accounts have unique passwords + 2FA", "Money accounts get the best factors you have."),
        ("no-personal", "No password contains names, birthdays or hobbies", "If it's on your social profiles, it's in cracking dictionaries."),
    ]),
    ("Two-factor authentication", [
        ("2fa-app", "Authenticator app or hardware key over SMS", "SMS is better than nothing but vulnerable to SIM-swaps."),
        ("backup-codes", "Backup codes are downloaded and stored offline", "A printed sheet in a safe place beats a locked-out weekend."),
        ("mfa-fatigue", "I never approve unexpected login prompts", "An unprompted push means someone already has your password."),
    ]),
    ("Devices & software", [
        ("updates", "OS and browsers auto-update", "Patches close the vulnerabilities that steal credentials."),
        ("screenlock", "All devices lock automatically", "A stolen unlocked phone is a stolen identity."),
        ("disk-encryption", "Disk encryption is enabled (FileVault/BitLocker/Android)", "Default on most modern devices — worth verifying once."),
    ]),
    ("Everyday habits", [
        ("no-link-logins", "I navigate to sites myself instead of clicking login links", "Starves phishing of its favorite delivery mechanism."),
        ("check-domain", "I check the domain before entering credentials", "Two seconds of squinting defeats most lookalike pages."),
        ("sharing", "I share credentials only via a manager's sharing feature", "Never over chat, email, or sticky notes."),
        ("breach-response", "I know what to do when a service I use is breached", "See OMP's breach response guide."),
        ("passkeys", "I create passkeys wherever they're offered", "Phishing-resistant and easier than passwords."),
    ]),
]


def checklist_body():
    idx = 0
    groups = []
    for group, items in CHECKLIST:
        lis = []
        and_str = None
        for slug, title, desc in items:
            idx += 1
            lis.append(f"""<label class="checklist-item">
  <input type="checkbox" data-item="{slug}">
  <span class="box">{icon("check","icon-16")}</span>
  <span class="ci-text"><strong>{title}</strong><span>{desc}</span></span>
</label>""")
        groups.append(f"""<section>
  <h2 class="h-3" style="margin-bottom:14px">{group}</h2>
  <div class="grid" style="gap:10px">{''.join(lis)}</div>
</section>""")
    return f"""
<section class="page-hero">
  <div class="container">
    <span class="chip chip-accent">{icon("list","icon-16")} Live tool · saves on your device</span>
    <h1 class="h-1 mt-16">Security Checklist</h1>
    <p class="lead">Sixteen habits, grouped and prioritized. Work through them in one sitting — your progress is stored in this browser's local storage only (never uploaded, and it never contains passwords).</p>
  </div>
</section>
<section class="section-tight" style="padding-top:16px">
  <div class="container container-narrow" data-checklist>
    <div class="card card-pad" style="position:sticky;top:calc(var(--nav-h) + 12px);z-index:10">
      <div class="flex justify-between items-center wrap gap-12">
        <strong data-checklist-count aria-live="polite" aria-atomic="true">0 of 16 complete (0%)</strong>
        <button class="btn btn-ghost btn-sm" type="button" data-checklist-reset>Reset</button>
      </div>
      <div class="progress-line mt-16" role="progressbar" aria-label="Checklist progress"><span data-checklist-bar></span></div>
    </div>
    <div class="grid mt-32" style="gap:36px">{''.join(groups)}</div>
    <div class="notice-band mt-48">{icon("info","icon-20")}<p>Done with the basics? The <a href="/articles" style="color:var(--purple)">guides</a> go deeper on managers, 2FA, passkeys and breach response.</p></div>
  </div>
</section>
"""


# ---------------------------------------------------- What Is My IP / IP Leak / DNS Leak pages
WHATISMYIP_FAQ = [
    ("Does a VPN change what this page sees?",
     "Yes — while it is connected, the IP, ISP and country shown here belong to the VPN server, not your connection. If the ISP and country look unfamiliar after you connect, that is usually a sign the VPN is working."),
    ("Is IPv6 included, and why does it matter?",
     "If your connection has a public IPv6 address, the lookup shows it beside the IPv4 where the service reports it. It matters because some VPNs route only IPv4 — sites can then see your real IPv6 alongside the VPN's IPv4. Compare both against your VPN's expected location."),
    ("Why does the page make network requests?",
     "An IP can only be discovered by asking an outside service. This page calls exactly two — speed.cloudflare.com/meta (primary) and api.ipify.org (cross-check) — and only when you press the button. Both are listed on the page; nothing else is contacted."),
    ("Does the checker or generator ever see my password?",
     "No. Every password tool on this site — checker, generator, passphrase, health — runs entirely in your browser and performs zero network requests. The leak tests here are the only pages that talk to the network, and only to the hosts listed on each page."),
    ("What is my IP address on my phone?",
     "The same thing this page shows when you open it in your phone's browser: the public address your mobile carrier or Wi-Fi network gives the device. Private addresses like 192.168.x.x or 10.x.x.x are internal — the router or carrier translates them at the edge, and websites never see them."),
]

IPLEAK_FAQ = [
    ("What is a WebRTC IP leak?",
     "WebRTC is the browser technology behind in-browser video and voice. To connect quickly, it can discover your real IP addresses through STUN lookups — even while a VPN is active. If a candidate address here matches your real connection instead of your VPN's, the VPN is leaking."),
    ("How do I read the verdicts on this test?",
     "Local (host) addresses are what your device exposes on its own network; mDNS aliases mean your browser is already hiding them. Public addresses seen via STUN are compared against your baseline — if they match, they belong to your current connection; if they differ while a VPN is on, that is a likely WebRTC leak."),
    ("Does the site see my IP when I run this test?",
     "Only two services are contacted, and only when you press the button: a Google STUN server (stun.l.google.com:19302) for the WebRTC candidates and speed.cloudflare.com/meta for the baseline IP. Your browser talks to them directly — our server is not in the path."),
    ("What is the baseline comparison?",
     "The baseline is your public IP captured by the What Is My IP page — held in this tab's memory only. Turn your VPN on and run the leak test: any WebRTC candidate matching that baseline belongs to the real connection, not the tunnel. If no baseline exists yet, the verdict says so instead of guessing."),
    ("Should I disable WebRTC in my browser?",
     "Not necessarily. On Chrome and Edge, WebRTC already hides local addresses behind mDNS (.local) candidates, and modern browsers give you IP-handling policies. If your VPN consistently leaks, first update the VPN app — blocking WebRTC entirely can break legitimate video calls."),
]

DNSLEAK_FAQ = [
    ("What is a DNS leak?",
     "A DNS leak happens when your DNS lookups — the requests that turn domain names into IP addresses — bypass your VPN and go straight to your ISP or another resolver. Websites still load through the tunnel, but someone watching the resolver can see which sites you visit."),
    ("How do I read the resolver, ECS and NS rows?",
     "The resolver row shows the IP and provider of the service that actually answered the query. ECS shows the client network your resolver advertises to authoritative DNS — your ISP's network here can mean a leak. NS shows which authoritative nameserver saw the lookup. If the resolver belongs to your VPN provider, you are routed correctly."),
    ("What should the result show when a VPN is active?",
     "The resolver should belong to your VPN provider or a privacy service it routes through — not your ISP. If the resolver's IP and provider match your ISP while the VPN is on, the tunnel is not carrying your DNS. Reconnect, enable the VPN's DNS-leak protection, and run the test again."),
    ("Does this test send my DNS queries to your server?",
     "No. Your browser queries dns.google directly — Google's public DNS-over-HTTPS service — asking it to report which resolver actually handled the lookup (a standard whoami trick). Our server is not in the path, and only that one host is contacted."),
    ("Can I fix a DNS leak without changing VPN?",
     "Sometimes. Switching your system or router DNS to a resolver you trust (your VPN's, or a public one like Cloudflare's 1.1.1.1) closes the leak for lookups, but the VPN's own leak protection is the stronger fix because it keeps DNS inside the tunnel. Update the VPN app first — most leaks come from outdated clients."),
]


# ------------------------------------------------------------------ What Is My IP page
def what_is_my_ip_body():
    return f"""
<section class="page-hero">
  <div class="container">
    <span class="chip chip-accent">{icon("globe","icon-16")} Live tool · network facts</span>
    <h1 class="h-1 mt-16">What Is My IP Address?</h1>
    <p class="lead">See the public IPv4 (and IPv6) address websites see, plus its ISP and country — cross-checked against two independent services. Wondering what my IP is on a VPN or on your phone? The answer below is what the internet sees right now.</p>
  </div>
</section>
<section class="section-tight" style="padding-top:16px">
  <div class="container">
    <div class="grid" style="gap:16px">
      <div class="card card-pad reveal">
        <span class="chip chip-accent">{icon("globe","icon-16")} Identity</span>
        <h2 class="h-3 mt-12">IP address, ISP &amp; country</h2>
        <p class="muted mt-8">Primary lookup via Cloudflare, cross-checked against ipify — both responses shown, so a single wrong answer can't fool you.</p>
        <button class="btn btn-primary mt-16" type="button" data-ip-run>Show my IP</button>
        <p class="tiny mt-8 mono" data-ip-status role="status" aria-live="polite">Waiting — nothing runs until you press the button.</p>
        <div class="mt-16" data-ip-box hidden>
          <ul class="list-plain">
            <li>{icon("check","icon-18")}<span>Public IP: <strong class="mono" data-ip-addr>—</strong></span></li>
            <li>{icon("check","icon-18")}<span>Network: <strong class="mono" data-ip-org>—</strong></span></li>
            <li>{icon("check","icon-18")}<span>Location: <strong class="mono" data-ip-geo>—</strong></span></li>
            <li>{icon("check","icon-18")}<span>ipify cross-check: <strong class="mono" data-ip-second>—</strong></span></li>
          </ul>
        </div>
      </div>
    </div>
    <div class="flex gap-12 wrap mt-24">
      <a class="btn btn-secondary btn-sm" href="/ip-leak-test">{icon("fingerprint","icon-16")} Run the WebRTC leak test</a>
      <a class="btn btn-secondary btn-sm" href="/dns-leak-test">{icon("nodes","icon-16")} Run the DNS leak test</a>
    </div>
    <div class="card card-pad mt-24 reveal">
      <span class="card-icon">{icon("server-off","icon-22")}</span>
      <h3 class="h-3">Every request this page makes</h3>
      <p class="muted mt-8">Pressing the button runs exactly two browser-side calls — our server is not in the path:</p>
      <ul class="list-plain mt-16">
        <li>{icon("check","icon-18")}<span><span class="mono tiny">speed.cloudflare.com/meta</span> — primary IP, ASN, organization, country, city</span></li>
        <li>{icon("check","icon-18")}<span><span class="mono tiny">api.ipify.org/?format=json</span> — independent cross-check of the IP</span></li>
      </ul>
      <p class="tiny muted mt-8">Nothing else is contacted. Nothing you type on this site is ever sent anywhere — the password tools on oopsmypassword.com are 100% client-side.</p>
    </div>
    <div class="disclosure-band reveal mt-24">
      <div class="disclosure-icon">{icon("shield","icon-22")}</div>
      <div>
        <h3 class="h-3">How this works — and how to verify it</h3>
        <p>These tests make direct, browser-side calls to three services — <span class="mono tiny">speed.cloudflare.com</span>, <span class="mono tiny">api.ipify.org</span> and <span class="mono tiny">dns.google</span> — and to a public STUN server. Nothing else is contacted. <strong>Verify it yourself:</strong> open your browser's Network tab, run each test, and compare the request list.</p>
      </div>
    </div>
    <div class="mt-32">
      <h2 class="h-2">What your public IP address reveals</h2>
      <p class="muted mt-8">Your public IP is the return address your router or carrier gives every request leaving your network. From it, a website can read your approximate area (city-level at best), your ISP or mobile carrier, and whether the address belongs to a datacenter — which is how sites detect most VPNs. It cannot identify you personally, but it is one of the strongest signals in a browser fingerprint.</p>
      <p class="muted mt-8">Two details are worth checking regularly. First, IPv6: if your connection carries a public IPv6 address and your VPN only routes IPv4, sites can see both — the leak tests on this site catch that class of mismatch. Second, consistency: the cross-check above exists because a single lookup can be wrong or manipulated; two independent services agreeing is a much stronger answer.</p>
      <p class="muted mt-8">On a phone, this page shows the address your carrier or Wi-Fi network gives the browser — the same address any website sees from the device.</p>
    </div>
    <div class="mt-32">
      <h2 class="h-2">What Is My IP — common questions</h2>
      <div class="grid mt-16" style="gap:10px">{faq_details(WHATISMYIP_FAQ)}</div>
    </div>
  </div>
</section>
<section class="section" style="padding-top:0">
  <div class="container container-narrow grid grid-3">
    <a class="card card-pad card-link center" href="/ip-leak-test"><span class="card-icon">{icon("fingerprint","icon-22")}</span><h3>Is your VPN leaking?</h3><p>Run the WebRTC leak test with a baseline comparison.</p></a>
    <a class="card card-pad card-link center" href="/dns-leak-test"><span class="card-icon">{icon("nodes","icon-22")}</span><h3>Where does your DNS go?</h3><p>See which resolver actually handles your lookups.</p></a>
    <a class="card card-pad card-link center" href="/breach-check"><span class="card-icon">{icon("radar","icon-22")}</span><h3>Has a password leaked?</h3><p>Run a zero-knowledge breach lookup against known leak lists.</p></a>
  </div>
</section>
"""


# ------------------------------------------------------------------ IP Leak Test page
def ip_leak_test_body():
    return f"""
<section class="page-hero">
  <div class="container">
    <span class="chip chip-accent">{icon("fingerprint","icon-16")} Live tool · WebRTC &amp; privacy tells</span>
    <h1 class="h-1 mt-16">WebRTC IP Leak Test</h1>
    <p class="lead">Is your VPN leaking your real IP? Run a WebRTC leak test with a baseline comparison, then check the privacy tells browsers reveal alongside an IP. Each check is a separate, button-triggered session — nothing runs behind your back.</p>
  </div>
</section>
<section class="section-tight" style="padding-top:16px">
  <div class="container">
    <div class="grid" style="gap:16px">
      <div class="card card-pad reveal">
        <span class="chip chip-accent">{icon("fingerprint","icon-16")} Exposure</span>
        <h2 class="h-3 mt-12">WebRTC IP leak test</h2>
        <p class="muted mt-8">Your browser negotiates a peer connection the way it would for a video call. Any candidate IP it discovers is shown and compared against your baseline — mDNS-only (.local) candidates mean your browser is already hiding local addresses.</p>
        <button class="btn btn-primary mt-16" type="button" data-rtc-run>Run the leak test</button>
        <p class="tiny mt-8 mono" data-rtc-status role="status" aria-live="polite">Waiting — nothing runs until you press the button.</p>
        <ul class="list-plain mt-16" data-rtc-out></ul>
      </div>
      <div class="card card-pad reveal">
        <span class="chip chip-accent">{icon("shield","icon-16")} Fingerprint</span>
        <h2 class="h-3 mt-12">Privacy tells</h2>
        <p class="muted mt-8">Your timezone and language settings are shared automatically — compared against your IP's country to spot mismatches, along with your Do Not Track setting.</p>
        <button class="btn btn-primary mt-16" type="button" data-tell-run>Check privacy tells</button>
        <p class="tiny mt-8 mono" data-tell-status role="status" aria-live="polite">Waiting — nothing runs until you press the button.</p>
        <ul class="list-plain mt-16" data-tell-out></ul>
      </div>
    </div>
    <div class="flex gap-12 wrap mt-24">
      <a class="btn btn-secondary btn-sm" href="/what-is-my-ip">{icon("globe","icon-16")} What is my IP address?</a>
      <a class="btn btn-secondary btn-sm" href="/dns-leak-test">{icon("nodes","icon-16")} DNS leak test</a>
    </div>
    <div class="card card-pad mt-24 reveal">
      <span class="card-icon">{icon("server-off","icon-22")}</span>
      <h3 class="h-3">Every request these tests make</h3>
      <p class="muted mt-8">Each session is button-triggered and makes direct, browser-side calls — our server is not in the path:</p>
      <ul class="list-plain mt-16">
        <li>{icon("check","icon-18")}<span><span class="mono tiny">stun.l.google.com:19302</span> — WebRTC candidate discovery (leak test)</span></li>
        <li>{icon("check","icon-18")}<span><span class="mono tiny">speed.cloudflare.com/meta</span> — your baseline public IP (run it on What Is My IP)</span></li>
      </ul>
      <p class="tiny muted mt-8">Nothing else is contacted. Nothing you type on this site is ever sent anywhere — the password tools on oopsmypassword.com are 100% client-side.</p>
    </div>
    <div class="disclosure-band reveal mt-24">
      <div class="disclosure-icon">{icon("shield","icon-22")}</div>
      <div>
        <h3 class="h-3">How this works — and how to verify it</h3>
        <p>These tests make direct, browser-side calls to three services — <span class="mono tiny">speed.cloudflare.com</span>, <span class="mono tiny">api.ipify.org</span> and <span class="mono tiny">dns.google</span> — and to a public STUN server. Nothing else is contacted. <strong>Verify it yourself:</strong> open your browser's Network tab, run each test, and compare the request list.</p>
      </div>
    </div>
    <div class="mt-32">
      <h2 class="h-2">How a WebRTC IP leak happens</h2>
      <p class="muted mt-8">WebRTC needs real addresses to build peer-to-peer audio and video streams. To find them, the browser asks a STUN server — in this test, a public Google one — to report the IP it sees. The catch: this lookup can use the direct network interface instead of the VPN tunnel, which is exactly how your real IP ends up in the candidate list while everything else looks protected.</p>
      <p class="muted mt-8">The baseline comparison turns that into a definite answer. The What Is My IP page captures your public IP in this tab's memory; with your VPN on, run the leak test and any candidate matching that baseline belongs to the real connection, not the tunnel. If no baseline exists, the verdict says so instead of guessing. And if your browser only reports <span class="mono tiny">.local</span> mDNS candidates — the default on modern Chrome and Edge — local addresses are already masked and there is nothing sensitive to leak.</p>
    </div>
    <div class="mt-32">
      <h2 class="h-2">WebRTC &amp; IP leaks — common questions</h2>
      <div class="grid mt-16" style="gap:10px">{faq_details(IPLEAK_FAQ)}</div>
    </div>
  </div>
</section>
<section class="section" style="padding-top:0">
  <div class="container container-narrow grid grid-3">
    <a class="card card-pad card-link center" href="/what-is-my-ip"><span class="card-icon">{icon("globe","icon-22")}</span><h3>What is my IP address?</h3><p>See the public IP, ISP and country behind this connection.</p></a>
    <a class="card card-pad card-link center" href="/dns-leak-test"><span class="card-icon">{icon("nodes","icon-22")}</span><h3>Is your DNS leaking?</h3><p>See which resolver actually handles your lookups.</p></a>
    <a class="card card-pad card-link center" href="/glossary"><span class="card-icon">{icon("book","icon-22")}</span><h3>IP, DNS, VPN — in plain words</h3><p>The security glossary defines every term this page uses.</p></a>
  </div>
</section>
"""


# ------------------------------------------------------------------ DNS Leak Test page
def dns_leak_test_body():
    return f"""
<section class="page-hero">
  <div class="container">
    <span class="chip chip-accent">{icon("nodes","icon-16")} Live tool · resolver check</span>
    <h1 class="h-1 mt-16">DNS Leak Test</h1>
    <p class="lead">See which DNS resolver actually handles your lookups — and whether your DNS leaks past the VPN to your ISP. A VPN can hide the sites you visit while its DNS still betrays them; this test shows the real path.</p>
  </div>
</section>
<section class="section-tight" style="padding-top:16px">
  <div class="container">
    <div class="grid" style="gap:16px">
      <div class="card card-pad reveal">
        <span class="chip chip-accent">{icon("nodes","icon-16")} Resolver</span>
        <h2 class="h-3 mt-12">Who handles your DNS</h2>
        <p class="muted mt-8">Your browser asks the resolver to identify itself (a standard whoami lookup) — showing the IP and provider that really handle your DNS, the client network it advertises, and the nameserver that sees the query.</p>
        <button class="btn btn-primary mt-16" type="button" data-dns-run>Run the DNS leak test</button>
        <p class="tiny mt-8 mono" data-dns-status role="status" aria-live="polite">Waiting — nothing runs until you press the button.</p>
        <ul class="list-plain mt-16" data-dns-out></ul>
      </div>
    </div>
    <div class="flex gap-12 wrap mt-24">
      <a class="btn btn-secondary btn-sm" href="/what-is-my-ip">{icon("globe","icon-16")} What is my IP address?</a>
      <a class="btn btn-secondary btn-sm" href="/ip-leak-test">{icon("fingerprint","icon-16")} WebRTC IP leak test</a>
    </div>
    <div class="card card-pad mt-24 reveal">
      <span class="card-icon">{icon("server-off","icon-22")}</span>
      <h3 class="h-3">Every request this test makes</h3>
      <p class="muted mt-8">One button, one browser-side call — our server is not in the path:</p>
      <ul class="list-plain mt-16">
        <li>{icon("check","icon-18")}<span><span class="mono tiny">dns.google/resolve?name=whoami.ds.akahelp.net</span> — reports the resolver IP, advertised client network (ECS) and nameserver that handled the lookup</span></li>
      </ul>
      <p class="tiny muted mt-8">Nothing else is contacted. Nothing you type on this site is ever sent anywhere — the password tools on oopsmypassword.com are 100% client-side.</p>
    </div>
    <div class="disclosure-band reveal mt-24">
      <div class="disclosure-icon">{icon("shield","icon-22")}</div>
      <div>
        <h3 class="h-3">How this works — and how to verify it</h3>
        <p>These tests make direct, browser-side calls to three services — <span class="mono tiny">speed.cloudflare.com</span>, <span class="mono tiny">api.ipify.org</span> and <span class="mono tiny">dns.google</span> — and to a public STUN server. Nothing else is contacted. <strong>Verify it yourself:</strong> open your browser's Network tab, run each test, and compare the request list.</p>
      </div>
    </div>
    <div class="mt-32">
      <h2 class="h-2">What a DNS leak means — and how to fix one</h2>
      <p class="muted mt-8">Every site you visit starts with a DNS lookup. If those lookups travel outside the VPN tunnel, your ISP — or whatever resolver receives them — sees your browsing destinations even while the page content itself is encrypted. That is a DNS leak: the traffic is protected, the map of where you go is not.</p>
      <p class="muted mt-8">Reading the result is simple. The resolver row shows the IP and provider that answered; if it belongs to your VPN provider (or a privacy service the VPN routes through), you are routed correctly. If it belongs to your ISP while the VPN is on, the lookups are escaping. The ECS row is the giveaway for forwarded setups — it shows the client network your resolver advertises upstream — and the NS row shows which authoritative nameserver saw the query.</p>
      <p class="muted mt-8">Fixing a leak starts with the VPN client: update it, turn on its DNS-leak protection, and prefer its own resolvers. If the leak persists, setting your system or router DNS to a resolver you trust — your VPN's, or a public one like Cloudflare's 1.1.1.1 — closes the escape route, though keeping DNS inside the tunnel is the stronger protection. Re-run this test after every change; it is the only honest way to confirm a fix.</p>
    </div>
    <div class="mt-32">
      <h2 class="h-2">DNS leak test — common questions</h2>
      <div class="grid mt-16" style="gap:10px">{faq_details(DNSLEAK_FAQ)}</div>
    </div>
  </div>
</section>
<section class="section" style="padding-top:0">
  <div class="container container-narrow grid grid-3">
    <a class="card card-pad card-link center" href="/ip-leak-test"><span class="card-icon">{icon("fingerprint","icon-22")}</span><h3>Is your VPN leaking?</h3><p>Run the WebRTC leak test with a baseline comparison.</p></a>
    <a class="card card-pad card-link center" href="/what-is-my-ip"><span class="card-icon">{icon("globe","icon-22")}</span><h3>What is my IP address?</h3><p>See the public IP, ISP and country behind this connection.</p></a>
    <a class="card card-pad card-link center" href="/glossary"><span class="card-icon">{icon("book","icon-22")}</span><h3>IP, DNS, VPN — in plain words</h3><p>The security glossary defines every term this page uses.</p></a>
  </div>
</section>
"""
