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


def faq_details(items):
    return "\n".join(
        f'<details class="faq-item"><summary>{q}<span class="chev">{icon("chevron","icon-18")}</span></summary>'
        f'<div class="faq-body"><p>{a}</p></div></details>'
        for q, a in items
    )


# ------------------------------------------------------------------ Home
def home_body(guides):
    tool_cards = "\n".join(tool_card(t) for t in TOOLS)
    guide_cards = "\n".join(guide_card(g) for g in guides[:6])
    faq_preview = faq_details(FAQ_ITEMS[:5])
    return f"""
<section class="hero">
  <div class="container hero-grid">
    <div>
      <span class="chip chip-accent reveal">{icon("shield","icon-16")} Privacy-first · 100% client-side</span>
      <h1 class="h-display reveal reveal-d1">Know how strong <span class="grad-text">your password</span> really is.</h1>
      <p class="lead reveal reveal-d2">Test your password strength in real-time, check security risks, generate stronger passwords, and learn how to protect your digital life.</p>
      <div class="hero-cta reveal reveal-d3">
        <a class="btn btn-primary btn-lg" href="#checker">{icon("gauge","icon-18")} Check Your Password</a>
        <a class="btn btn-secondary btn-lg" href="/generator">{icon("dice","icon-18")} Generate Strong Password</a>
      </div>
      <div class="hero-trust reveal reveal-d3">
        <span class="chip">{icon("check","icon-16")} No account required</span>
        <span class="chip">{icon("check","icon-16")} Client-side analysis</span>
        <span class="chip">{icon("check","icon-16")} Privacy-first</span>
      </div>
    </div>
    <div id="checker" class="reveal reveal-d1" style="scroll-margin-top: calc(var(--nav-h) + 24px)">
      {checker_markup("home")}
    </div>
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
      <h2 class="h-1">Eleven tools. Zero accounts.</h2>
      <p class="lead">Every tool below actually works, in your browser, right now. Anything we haven't finished is labeled instead of faked.</p>
    </div>
    <div class="grid grid-4">{tool_cards}</div>
  </div>
</section>

<section class="section" id="generate">
  <div class="container two-col" style="align-items:center">
    <div class="reveal">
      <span class="eyebrow">Generator</span>
      <h2 class="h-1">Strong passwords, generated in front of you</h2>
      <p class="lead">Built on <code class="mono">crypto.getRandomValues()</code> with bias-free sampling — the same class of randomness browsers use for cryptography. <strong>Generated locally in your browser.</strong></p>
      <ul class="list-plain mt-24">
        <li>{icon("check","icon-18")}<span><strong>20-character default</strong> with all character types</span></li>
        <li>{icon("check","icon-18")}<span><strong>Every character type enforced</strong>, then shuffled securely</span></li>
        <li>{icon("check","icon-18")}<span><strong>Ambiguity filter</strong> for <span class="mono">Il1O0</span>-confusable situations</span></li>
      </ul>
      <a class="btn btn-secondary mt-24" href="/generator">Open full generator {icon("arrow","icon-16")}</a>
    </div>
    <div class="card card-pad reveal reveal-d1" data-generator>
      <h3 class="h-3">Quick generate</h3>
      <div class="gen-output mt-16"><code data-gen-output aria-live="polite"></code>
        <button class="icon-btn" type="button" data-copy-btn aria-label="Copy password"></button>
      </div>
      <div class="meter" data-gen-meter aria-hidden="true"></div>
      <div class="flex justify-between items-center mt-8">
        <span class="tiny muted">Estimated entropy</span>
        <span class="tiny muted mono" data-gen-entropy></span>
      </div>
      <div class="slider-head mt-24"><label for="qg-length"><strong>Length</strong></label><output id="qg-length-out" data-gen-length-out for="qg-length">20</output></div>
      <input type="range" id="qg-length" min="8" max="64" value="20" step="1" data-gen-length aria-describedby="qg-length-out">
      <button class="btn btn-primary mt-24" type="button" data-gen-btn style="width:100%">{icon("refresh","icon-18")} Regenerate</button>
      <p class="privacy-note">{icon("lock","icon-16")} Generated locally in your browser — nothing is transmitted.</p>
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
        <a class="btn btn-primary btn-lg" href="#checker">{icon("gauge","icon-18")} Check Your Password</a>
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
<section class="section-tight" style="padding-top:24px">
  <div class="container">
    <div class="container-narrow" style="margin-inline:auto">
      {checker_markup("page")}
    </div>
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
    <div class="notice-band mt-32">{icon("info","icon-20")}<p><strong>Honest limits.</strong> A heuristic cannot know how your password was generated or where else you used it. A randomly generated 20-character password will outlive any "clever" human one regardless of what any meter says — including ours. <a href="/articles/password-entropy" style="color:var(--purple)">Read how entropy works</a>.</p></div>
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
    <h1 class="h-1 mt-16">Password Generator</h1>
    <p class="lead">Cryptographically secure passwords with <span class="mono">crypto.getRandomValues()</span> — generated locally in your browser. Default: 20 characters, all character types.</p>
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
</section>
"""


# ------------------------------------------------------------------ Tools page
def tools_body():
    cards = "\n".join(tool_card(t) for t in TOOLS)
    return f"""
<section class="page-hero">
  <div class="container">
    <span class="chip chip-accent">{icon("shield","icon-16")} All tools live unless labeled</span>
    <h1 class="h-1 mt-16">The OMP Toolbox</h1>
    <p class="lead">Eleven focused utilities for testing, generating and understanding passwords. Each one runs entirely in your browser — and any tool that isn't finished will say "Coming Soon" instead of pretending.</p>
  </div>
</section>
<section class="section-tight" style="padding-top:16px">
  <div class="container">
    <div class="grid grid-4">{cards}</div>
    <div class="notice-band mt-48">{icon("info","icon-20")}<p><strong>No fake tools, no fake stats.</strong> OMP never labels something "connected to a breach database" when it isn't, and never shows invented counters like "12M passwords checked". What you see is what runs.</p></div>
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
        <p>When a service is compromised, its user database — emails, password hashes, personal details — can be stolen and later published or sold. Billions of such records circulate in "combo lists" used for credential stuffing.</p>
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
      <p class="lead">The privacy-preserving range architecture powered by Have I Been Pwned's Pwned Passwords API.</p>
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
