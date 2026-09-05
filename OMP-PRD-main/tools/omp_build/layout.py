# -*- coding: utf-8 -*-
"""Shared layout: head, header, footer, icons, reusable components."""

SITE = "https://oopsmypassword.com"
BRAND = "OopsMyPassword"
TWITTER = "@oopsmypassword"
DATE = "2026-08-23"

# ---------------------------------------------------------------- icons
ICONS = {
    "shield": '<path d="M12 2.5 20 5.8v6.1c0 5.2-3.4 8.7-8 10.1-4.6-1.4-8-4.9-8-10.1V5.8Z"/><path d="m8.8 11.8 2.3 2.3 4.1-4.6"/>',
    "gauge": '<path d="m12 14 3.5-3.5"/><path d="M20.2 17a8.5 8.5 0 1 0-16.4 0"/>',
    "dice": '<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="15.5" cy="15.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="15.5" cy="8.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="8.5" cy="15.5" r="1.1" fill="currentColor" stroke="none"/>',
    "radar": '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><path d="m12 12 6-6"/>',
    "pulse": '<path d="M19.5 12.5 12 20l-7.5-7.5a5 5 0 1 1 7.5-6.6 5 5 0 1 1 7.5 6.6Z"/><path d="M4 12h4l1.5-2.5 2 5L13 12h3"/>',
    "key": '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.8 12.2 9.4-9.4"/><path d="m17 6 3 3"/><path d="m14 9 2.5 2.5"/>',
    "sigma": '<path d="M17 5H7l6 7-6 7h10"/>',
    "hash": '<path d="M4 9h16"/><path d="M4 15h16"/><path d="M10 3 8 21"/><path d="m16 3-2 18"/>',
    "list": '<path d="m3 6 1.5 1.5L7 5"/><path d="m3 12 1.5 1.5L7 11"/><path d="m3 18 1.5 1.5L7 17"/><path d="M11 6h10"/><path d="M11 12h10"/><path d="M11 18h10"/>',
    "book": '<path d="M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2Z"/><path d="M22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7Z"/>',
    "sun": '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.9 4.9 1.4 1.4"/><path d="m17.7 17.7 1.4 1.4"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.3 17.7-1.4 1.4"/><path d="m19.1 4.9-1.4 1.4"/>',
    "moon": '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    "menu": '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>',
    "x": '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    "arrow": '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
    "check": '<path d="M20 6 9 17l-5-5"/>',
    "check-circle": '<circle cx="12" cy="12" r="10"/><path d="m8.5 12.5 2.5 2.5 4.5-5.5"/>',
    "alert": '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    "info": '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    "lock": '<rect x="4" y="11" width="16" height="10" rx="2.5"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    "eye-off": '<path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M6.61 6.61A13.5 13.5 0 0 0 2 12s3 8 10 8a9.74 9.74 0 0 0 5.39-1.61"/><path d="m2 2 20 20"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/>',
    "mail": '<rect x="2" y="4" width="20" height="16" rx="3"/><path d="m3 6 9 7 9-7"/>',
    "zap": '<path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H13Z"/>',
    "server-off": '<path d="M2 2l20 20"/><path d="M7 7h13a2 2 0 0 1 2 2v4.5"/><path d="M4 4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h11"/><path d="M2 16h9"/><path d="M6 20h9"/><path d="M17.5 16.5 22 21"/>',
    "clock": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    "users-off": '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m17 8 5 5"/><path d="m22 8-5 5"/>',
    "device": '<rect x="5" y="2" width="14" height="20" rx="2.5"/><path d="M12 18h.01"/>',
    "refresh": '<path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 21v-5h5"/>',
    "fingerprint": '<path d="M12 11a4 4 0 0 1 4 4c0 2-.5 4-1 6"/><path d="M8 15c0 2-.5 4-1 6"/><path d="M18.7 9.5A8 8 0 0 0 4 11"/><path d="M20.5 14.5c.2-1.8-.1-3.4-.9-5"/><path d="M6.8 6.8A8.9 8.9 0 0 0 4 15c0 2 .5 4 1 5"/>',
    "chevron": '<path d="m6 9 6 6 6-6"/>',
    "external": '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    "grad": '<path d="m12 4 10 5-10 5L2 9Z"/><path d="M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5"/><path d="M22 9v6"/>',
    "file": '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M9 13h6"/><path d="M9 17h6"/>',
}


def icon(name, cls="icon-20"):
    return (
        f'<svg class="{cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
        f'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
        f'{ICONS[name]}</svg>'
    )


def logo_svg(uid):
    return (
        '<svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">'
        f'<defs><linearGradient id="omp-lg-{uid}" x1="0" y1="0" x2="1" y2="1">'
        '<stop offset="0" stop-color="#8B5CF6"/><stop offset="1" stop-color="#6366F1"/>'
        '</linearGradient></defs>'
        f'<path d="M15 1.8 26.4 6v8.2c0 6.6-4.4 11.1-11.4 12.9C8 25.3 3.6 20.8 3.6 14.2V6Z" fill="url(#omp-lg-{uid})"/>'
        '<circle cx="10.4" cy="14.2" r="1.9" fill="#fff"/>'
        '<circle cx="15" cy="14.2" r="1.9" fill="#fff"/>'
        '<circle cx="19.6" cy="14.2" r="1.9" fill="#fff"/>'
        '</svg>'
    )

def pretty_url(path):
    """Public (clean) URL for a site path. Implementation files keep their .html names."""
    if not path:
        return "/"
    p, _, frag = path.partition("#")
    frag = ("#" + frag) if frag else ""
    if p in ("/articles", "/guides", "/articles", "/blog"):
        return "/articles" + frag
    if p.startswith("/guides/") and p.endswith(".html"):
        return "/articles/" + p[len("/guides/"):-5] + frag
    if p.endswith(".html"):
        p = p[:-5] or "/"
    if p in ("/index",):
        p = "/"
    return p + frag


NAV_LINKS = [
    ("Home", "/"),
    ("Checker", "/checker"),
    ("Generator", "/generator"),
    ("Tools", "/tools"),
    ("Articles", "/articles"),
    ("Products", "/products"),
    ("Breach Check", "/breach-check"),
    ("About", "/about"),
]


def head(*, title, desc, path, og_type="website", jsonld=None, extra=""):
    canonical = SITE + path
    jsonld_html = ""
    if jsonld:
        import json

        blocks = jsonld if isinstance(jsonld, list) else [jsonld]
        for b in blocks:
            jsonld_html += (
                '\n  <script type="application/ld+json">'
                + json.dumps(b, ensure_ascii=False, separators=(",", ":"))
                + "</script>"
            )
    return f"""<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>
  <meta name="description" content="{desc}">
  <meta name="google-site-verification" content="ilff-p9F52ymQPjAUhrWXMh2zidY67vxMIp0QskcbfY" />
  <link rel="canonical" href="{canonical}">
  <meta name="theme-color" content="#050811">
  <meta name="color-scheme" content="dark light">
  <meta property="og:type" content="{og_type}">
  <meta property="og:site_name" content="{BRAND}">
  <meta property="og:title" content="{title}">
  <meta property="og:description" content="{desc}">
  <meta property="og:url" content="{canonical}">
  <meta property="og:image" content="{SITE}/assets/images/og-image.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{title}">
  <meta name="twitter:description" content="{desc}">
  <meta name="twitter:image" content="{SITE}/assets/images/og-image.jpg">
  <link rel="icon" href="/assets/icons/favicon.svg" type="image/svg+xml">
  <link rel="icon" href="/assets/icons/favicon-32.png" type="image/png" sizes="32x32">
  <link rel="apple-touch-icon" href="/assets/icons/apple-touch-icon.png">
  <link rel="manifest" href="/manifest.webmanifest">
  <link rel="stylesheet" href="/assets/css/styles.css">
  <script src="/assets/js/theme-init.js"></script>{jsonld_html}
  {extra}
</head>"""


def header(active):
    parts = []
    for label, href in NAV_LINKS:
        cur = ' aria-current="page"' if href == active else ''
        parts.append(f'<a href="{href}"{cur}>{label}</a>')
    links = "".join(parts)
    mobile_links = "".join(
        f'<a href="{href}">{label}{icon("arrow","icon-16")}</a>' for label, href in NAV_LINKS
    )
    mobile_links += "".join(
        f'<a href="{href}">{label}{icon("arrow","icon-16")}</a>'
        for label, href in [
            ("Password Health", "/password-health"),
            ("Security Checklist", "/security-checklist"),
            ("FAQ", "/faq"),
            ("Privacy Policy", "/privacy"),
            ("Contact", "/contact"),
        ]
    )
    return f"""<a class="skip-link" href="#main">Skip to content</a>
<header class="site-nav">
  <div class="container nav-inner">
    <a class="brand" href="/" aria-label="{BRAND} — home">
      {logo_svg("h")}
      <span>Oops<span class="grad-text">MyPassword</span></span>
    </a>
    <nav class="nav-links" aria-label="Primary">{links}</nav>
    <div class="nav-actions">
      <button class="icon-btn" type="button" data-theme-toggle aria-label="Toggle color theme" title="Toggle theme">
        <span class="theme-icon-moon">{icon("moon","icon-18")}</span>
        <span class="theme-icon-sun">{icon("sun","icon-18")}</span>
      </button>
      <a class="btn btn-primary btn-sm btn-get-started" href="/#checker">Get Started</a>
      <button class="icon-btn nav-toggle" type="button" data-nav-toggle aria-label="Open menu" aria-expanded="false" aria-controls="mobile-menu">
        <span class="icon-menu">{icon("menu","icon-20")}</span>
        <span class="icon-close">{icon("x","icon-20")}</span>
      </button>
    </div>
  </div>
</header>
<nav class="mobile-menu" id="mobile-menu" aria-label="Mobile">
  {mobile_links}
  <a class="btn btn-primary btn-lg" href="/#checker">Check Your Password</a>
</nav>"""


def footer():
    cols = [
        ("Tools", [
            ("Password Checker", "/checker"),
            ("Password Generator", "/generator"),
            ("Breach Check", "/breach-check"),
            ("Password Health", "/password-health"),
            ("All Tools", "/tools"),
        ]),
        ("Resources", [
            ("Articles", "/articles"),
            ("Products", "/products"),
            ("Security Checklist", "/security-checklist"),
            ("FAQ", "/faq"),
            ("Glossary", "/glossary"),
        ]),
        ("Company", [
            ("About", "/about"),
            ("Privacy", "/privacy"),
            ("Terms", "/terms"),
            ("Contact", "/contact"),
        ]),
    ]
    col_html = ""
    for title, links in cols:
        items = "".join(f'<li><a href="{href}">{label}</a></li>' for label, href in links)
        col_html += f'<div class="footer-col"><h4>{title}</h4><ul>{items}</ul></div>'
    return f"""<footer class="site-footer">
  <div class="container">
    <div class="footer-grid">
      <div class="footer-brand">
        <a class="brand" href="/" aria-label="{BRAND} — home">{logo_svg("f")}<span>Oops<span class="grad-text">MyPassword</span></span></a>
        <p>Privacy-first password tools. Every check runs locally in your browser — no account, no servers, no storage, no tracking of what you type.</p>
        <div class="tag-list mt-16">
          <span class="chip">{icon("lock","icon-16")} Client-side</span>
          <span class="chip">{icon("users-off","icon-16")} No account</span>
        </div>
      </div>
      {col_html}
    </div>
    <div class="footer-bottom">
      <span>© <span data-year>2026</span> {BRAND}. Educational security tools.</span>
      <span class="flex gap-16 wrap">
        <a href="/security">Security</a>
        <a href="/sitemap">Sitemap</a>
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
      </span>
    </div>
  </div>
</footer>"""


def scripts(*names):
    # url.js is the canonical URL safety validator used by sanitize.js /
    # markdown.js / articles.js / search.js, so it must load first.
    out = '<script src="/assets/js/url.js" defer></script>'
    out += '<script src="/assets/js/main.js" defer></script>'
    for n in names:
        out += f'\n<script src="/assets/js/{n}" defer></script>'
    return out


def page(*, path, active, title, desc, body, og_type="website", jsonld=None, scripts_=None, head_extra="", body_class=""):
    html = (
        head(title=title, desc=desc, path=path, og_type=og_type, jsonld=jsonld, extra=head_extra)
        + f'\n<body class="{body_class}">\n'
        + header(active)
        + f'\n<main id="main">\n{body}\n</main>\n'
        + footer()
        + "\n"
        + scripts(*(scripts_ or []))
        + "\n</body>\n</html>\n"
    )
    return html


# ---------------------------------------------------------------- shared UI
def checker_markup(context="page"):
    """The live password checker component (bound by checker.js)."""
    return f"""
<div class="checker-shell" data-checker-context="{context}">
  <div class="card checker-card" data-checker>
    <div class="field-label">
      <label for="pw-{context}">Enter a password to analyze</label>
      <span class="counter" data-pw-counter>0 chars</span>
    </div>
    <div class="pw-input-wrap">
      <input id="pw-{context}" class="pw-input" type="password" data-pw-input
             placeholder="Type or paste a password…" autocomplete="off"
             autocapitalize="off" autocorrect="off" spellcheck="false"
             aria-describedby="pw-privacy-{context}">
      <div class="pw-tools">
        <button class="pw-tool" type="button" data-pw-toggle aria-label="Show password" aria-pressed="false"></button>
        <button class="pw-tool" type="button" data-pw-clear aria-label="Clear password"></button>
      </div>
    </div>
    <p class="privacy-note" id="pw-privacy-{context}">{icon("lock","icon-16")} Your password stays in your browser. Analysis runs locally — nothing is sent, stored or logged.</p>

    <div class="score-row">
      <div>
        <div class="score-number"><span data-score-number>0</span><span class="of">/100</span></div>
        <div class="tiny muted">Heuristic strength score</div>
      </div>
      <span class="strength-pill st-none" data-score-pill><span class="dot"></span><span data-pill-text>Awaiting input</span></span>
    </div>

    <div class="meter" data-meter></div>
    <div class="meter-scale" aria-hidden="true"><span>Very Weak</span><span>Weak</span><span>Fair</span><span>Strong</span><span>Excellent</span></div>

    <div class="stat-grid">
      <div class="stat"><div class="k">Length</div><div class="v" data-stat="length">—</div></div>
      <div class="stat"><div class="k">Est. entropy</div><div class="v mono" data-stat="entropy">—</div></div>
      <div class="stat"><div class="k">Est. crack difficulty</div><div class="v" data-stat="crack">—</div></div>
      <div class="stat"><div class="k">Common password</div><div class="v" data-stat="common">—</div></div>
    </div>

    <div class="check-chip-row" data-cats></div>

    <div class="analysis-panel">
      <div>
        <h3 class="subhead-sm">Analysis</h3>
        <ul class="check-list" data-findings></ul>
      </div>
      <div>
        <h3 class="subhead-sm">Recommendations</h3>
        <ul class="reco-list" data-recos></ul>
      </div>
    </div>

    <p class="disclaimer">{icon("info","icon-18")} <span>Strength estimates are heuristic and should not be treated as a security guarantee. Real-world resistance depends on how the password was chosen, where it is reused, and how the site stores it.</span></p>
    <span class="sr-only" role="status" aria-live="polite" data-live></span>
  </div>
</div>"""


def tool_card(t, reveal=True):
    cls = "card tool-card card-link" + (" soon" if t["status"] == "soon" else "")
    badge = (
        '<span class="badge badge-live">Live</span>'
        if t["status"] == "live"
        else '<span class="badge badge-soon">Coming Soon</span>'
    )
    inner = f"""
  <div class="tool-top"><span class="card-icon">{icon(t["icon"], "icon-22")}</span>{badge}</div>
  <h3>{t["name"]}</h3>
  <p>{t["desc"]}</p>
  <span class="tool-cta">{t["cta"]} {icon("arrow","icon-16")}</span>"""
    if t["status"] == "live":
        return f'<a href="{t["href"]}" class="{cls}">{inner}</a>'
    return f'<div class="{cls}" aria-disabled="true">{inner}</div>'


TOOLS = [
    {"name": "Password Checker", "href": "/checker", "icon": "gauge", "status": "live",
     "desc": "Real-time, fully local strength analysis with pattern detection, entropy estimates and actionable fixes.",
     "cta": "Check a password"},
    {"name": "Password Generator", "href": "/generator", "icon": "dice", "status": "live",
     "desc": "Cryptographically secure passwords built with crypto.getRandomValues() — never Math.random().",
     "cta": "Generate a password"},
    {"name": "Breach Check", "href": "/breach-check", "icon": "radar", "status": "live",
     "desc": "Learn how k-anonymity breach lookups work with a transparent, clearly-labeled local demo.",
     "cta": "Learn & try the demo"},
    {"name": "Password Health", "href": "/password-health", "icon": "pulse", "status": "live",
     "desc": "Run a full local audit — length, diversity, patterns, entropy and reuse hygiene — with a letter grade.",
     "cta": "Audit a password"},
    {"name": "Passphrase Generator", "href": "/passphrase", "icon": "key", "status": "live",
     "desc": "Diceware-style passphrases from a 1,296-word list — memorable and measurably strong.",
     "cta": "Generate a passphrase"},
    {"name": "Password Entropy Calculator", "href": "/entropy", "icon": "sigma", "status": "live",
     "desc": "Explore how length and character pools translate into bits of entropy and real crack times.",
     "cta": "Calculate entropy"},
    {"name": "Random String Generator", "href": "/random-string", "icon": "hash", "status": "live",
     "desc": "Tokens, IDs and test data from a CSPRNG — hex, Base64URL, alphanumeric and more.",
     "cta": "Generate strings"},
    {"name": "Security Checklist", "href": "/security-checklist", "icon": "list", "status": "live",
     "desc": "A practical account-security checklist you can work through in minutes — progress stays on your device.",
     "cta": "Open the checklist"},
]


def guide_card(g, reveal=False):
    return f"""<a href="/articles/{g['slug']}" class="card card-link guide-card">
  <div class="meta">{icon("book","icon-16")}<span>{g["category"]}</span><span class="divider-dot">·</span><span>{g["minutes"]} min read</span></div>
  <h3>{g["title"]}</h3>
  <p class="muted">{g["desc"]}</p>
  <span class="read-more">Read guide {icon("arrow","icon-16")}</span>
</a>"""


def jsonld_website():
    return {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": BRAND,
        "url": SITE + "/",
        "description": "Privacy-first password security tools that run entirely in your browser.",
    }


def jsonld_webapp():
    return {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        "name": BRAND,
        "url": SITE + "/",
        "applicationCategory": "SecurityApplication",
        "operatingSystem": "Any (web browser)",
        "browserRequirements": "Requires JavaScript",
        "isAccessibleForFree": True,
        "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"},
        "featureList": "Password strength checker, password generator, passphrase generator, entropy calculator, password health audit, breach-check demo",
        "description": "Client-side password security toolkit. No account required; passwords never leave the browser.",
    }


def jsonld_faq(faq_items):
    return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {
                "@type": "Question",
                "name": q,
                "acceptedAnswer": {"@type": "Answer", "text": a},
            }
            for q, a in faq_items
        ],
    }


def jsonld_article(g):
    return {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": g["title"],
        "description": g["desc"],
        "datePublished": DATE,
        "dateModified": DATE,
        "author": {"@type": "Organization", "name": BRAND, "url": SITE + "/"},
        "publisher": {"@type": "Organization", "name": BRAND, "url": SITE + "/"},
        "mainEntityOfPage": SITE + "/articles/" + g["slug"],
        "image": SITE + "/assets/images/og-image.jpg",
        "inLanguage": "en",
    }


def jsonld_breadcrumb(items):
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": i + 1,
                "name": name,
                "item": SITE + href,
            }
            for i, (name, href) in enumerate(items)
        ],
    }
