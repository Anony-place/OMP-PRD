# -*- coding: utf-8 -*-
"""OMP static site generator.

Assembles every HTML page from shared layout + page bodies so that
head/meta/nav/footer are consistent everywhere. Generated HTML is
committed to the repo root; this script is only a build tool.

Usage:  python3 tools/build.py
"""
import datetime
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from omp_build.layout import (  # noqa: E402
    DATE, SITE, footer, guide_card, head, header, icon,
    jsonld_article, jsonld_breadcrumb, jsonld_faq, jsonld_webapp,
    jsonld_website, page, scripts,
)
from omp_build.guides1 import GUIDES_1  # noqa: E402
from omp_build.guides2 import GUIDES_2  # noqa: E402
from omp_build.guides3 import GUIDES_3  # noqa: E402
from omp_build.pages_core import (  # noqa: E402
    FAQ_ITEMS, breach_body, checker_body, checklist_body, entropy_body,
    generator_body, health_body, home_body, passphrase_body,
    random_string_body, tools_body,
)
from omp_build.pages_blog import admin_body, blog_body  # noqa: E402
from omp_build.pages_info import (  # noqa: E402
    about_body, contact_body, faq_body, glossary_body, privacy_body,
    security_body, sitemap_body, terms_body,
)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GUIDES = GUIDES_1 + GUIDES_2 + GUIDES_3


def write(path, content):
    full = os.path.join(ROOT, path.lstrip("/"))
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8") as f:
        f.write(content)
    print("wrote", path, f"({len(content) // 1024} KB)")


# ------------------------------------------------------------------ guides
def guide_page(g):
    toc_links = "\n".join(
        f'<li><a href="#{i}">{t}</a></li>' for i, t in g["toc"]
    )
    related = [x for x in GUIDES if x["slug"] in g.get("related", [])]
    related_cards = "\n".join(guide_card(x) for x in related)
    body = f"""
<section class="article-hero">
  <div class="container container-narrow">
    <nav aria-label="Breadcrumb" class="small muted"><a href="/guides.html" style="color:var(--purple)">Guides</a> <span class="divider-dot">/</span> {g["category"]}</nav>
    <h1 class="h-1 mt-16">{g["title"]}</h1>
    <p class="lead mt-8">{g["desc"]}</p>
    <div class="article-meta">
      <span class="chip">{icon("book","icon-16")} {g["category"]}</span>
      <span class="chip">{icon("clock","icon-16")} {g["minutes"]} min read</span>
      <span class="chip">Updated {DATE}</span>
    </div>
  </div>
</section>
<section class="section-tight">
  <div class="container">
    <div class="article-layout">
      <aside class="toc" aria-label="Table of contents">
        <div class="subhead-sm">On this page</div>
        <ul>{toc_links}</ul>
      </aside>
      <article class="prose" itemscope itemtype="https://schema.org/Article">
        {g["body"].replace('<span class="chev"></span>', '<span class="chev">' + icon("chevron", "icon-18") + '</span>')}
        <hr class="hr-fade" style="margin-top:48px">
        <div class="callout callout-info">{icon("shield","icon-20")}<p><strong>Put it into practice:</strong> run your next password through the <a href="/checker.html">local checker</a> — it never leaves your browser.</p></div>
      </article>
    </div>
  </div>
</section>
<section class="section" style="background: var(--bg-soft); border-block: 1px solid var(--border)">
  <div class="container">
    <div class="section-head left"><span class="eyebrow">Keep reading</span><h2 class="h-2">Related guides</h2></div>
    <div class="grid grid-3">{related_cards}</div>
  </div>
</section>
"""
    jsonld = [
        jsonld_article(g),
        jsonld_breadcrumb([
            ("Home", "/"), ("Guides", "/guides.html"),
            (g["title"], f"/guides/{g['slug']}.html"),
        ]),
    ]
    if g.get("faq"):
        jsonld.append(jsonld_faq(g["faq"]))
    return page(
        path=f"/guides/{g['slug']}.html", active="/guides.html",
        title=f"{g['title']} — OopsMyPassword Guides", desc=g["desc"],
        body=body, og_type="article", jsonld=jsonld,
        head_extra=f'<meta property="article:published_time" content="{DATE}">',
    )


def guides_index():
    cats = {}
    for g in GUIDES:
        cats.setdefault(g["category"], []).append(g)
    sections = ""
    for cat, items in cats.items():
        cards = "\n".join(guide_card(g) for g in items)
        sections += f"""
<div class="mt-48">
  <h2 class="h-2" style="margin-bottom:20px">{cat}</h2>
  <div class="grid grid-3">{cards}</div>
</div>"""
    body = f"""
<section class="page-hero">
  <div class="container">
    <span class="eyebrow">Learn</span>
    <h1 class="h-1">Password Security Guides</h1>
    <p class="lead">Fifteen practical guides covering everything from password length and cracking time to passkeys and breach response — each written in plain language, each actionable in one sitting.</p>
  </div>
</section>
<section class="section-tight">
  <div class="container">{sections}</div>
</section>
"""
    return page(
        path="/guides.html", active="/guides.html",
        title="Password Security Guides — OopsMyPassword",
        desc="Fifteen practical, plain-language guides: password length and cracking time, strong passwords, managers, 2FA, passkeys, phishing, breach response and entropy.",
        body=body,
        jsonld=jsonld_breadcrumb([("Home", "/"), ("Guides", "/guides.html")]),
    )


# ------------------------------------------------------------------ main
def main():
    write("index.html", page(
        path="/", active="/",
        title="OopsMyPassword — Test, Generate & Learn Password Security (No Account)",
        desc="Privacy-first password tools that run entirely in your browser: real-time strength checker, CSPRNG generator, passphrase generator, entropy calculator and practical security guides. No account required.",
        body=home_body(GUIDES),
        jsonld=[jsonld_website(), jsonld_webapp(), jsonld_faq(FAQ_ITEMS[:5])],
        scripts_=["security.js", "wordlist.js", "checker.js", "generator.js", "blog.js"],
    ))
    write("checker.html", page(
        path="/checker.html", active="/checker.html",
        title="Password Strength Checker — Free, Private, Client-Side | OopsMyPassword",
        desc="Test password strength in real time with pattern detection, entropy estimates and crack-time indication. 100% client-side: your password never leaves your browser.",
        body=checker_body(),
        jsonld=jsonld_breadcrumb([("Home", "/"), ("Password Checker", "/checker.html")]),
        scripts_=["security.js", "wordlist.js", "checker.js"],
    ))
    write("generator.html", page(
        path="/generator.html", active="/generator.html",
        title="Password Generator — Secure CSPRNG, 20-Char Default | OopsMyPassword",
        desc="Generate cryptographically secure passwords locally with crypto.getRandomValues(). Length slider, character options, ambiguous-character filter. No Math.random(), ever.",
        body=generator_body(),
        jsonld=jsonld_breadcrumb([("Home", "/"), ("Password Generator", "/generator.html")]),
        scripts_=["security.js", "generator.js"],
    ))
    write("tools.html", page(
        path="/tools.html", active="/tools.html",
        title="Password Security Tools — All Free & Client-Side | OopsMyPassword",
        desc="Eight browser-based password tools: checker, generator, breach-check demo, health audit, passphrases, entropy calculator, random strings and a security checklist.",
        body=tools_body(),
        jsonld=jsonld_breadcrumb([("Home", "/"), ("Tools", "/tools.html")]),
    ))
    write("breach-check.html", page(
        path="/breach-check.html", active="/breach-check.html",
        title="Breach Check — How k-Anonymity Works + Local Demo | OopsMyPassword",
        desc="Learn why password reuse is dangerous and how privacy-preserving breach lookup works. Includes a clearly-labeled local demo — no live database, no false claims.",
        body=breach_body(),
        jsonld=jsonld_breadcrumb([("Home", "/"), ("Breach Check", "/breach-check.html")]),
        scripts_=["security.js", "breach.js"],
    ))
    write("password-health.html", page(
        path="/password-health.html", active="/tools.html",
        title="Password Health Check — Local 10-Point Audit | OopsMyPassword",
        desc="Run a local 10-point password audit: length, diversity, patterns, entropy and reuse hygiene, with a letter grade and fixes. No account, no stored history.",
        body=health_body(),
        jsonld=jsonld_breadcrumb([("Home", "/"), ("Password Health", "/password-health.html")]),
        scripts_=["security.js", "wordlist.js", "health.js"],
    ))
    write("entropy.html", page(
        path="/entropy.html", active="/tools.html",
        title="Password Entropy Calculator — Bits, Pools & Crack Times | OopsMyPassword",
        desc="Calculate password entropy from length and character pools (H = L·log₂N), or from a real password — with crack times for online, slow-hash and GPU-rig attackers.",
        body=entropy_body(),
        jsonld=jsonld_breadcrumb([("Home", "/"), ("Entropy Calculator", "/entropy.html")]),
        scripts_=["security.js", "wordlist.js", "entropy.js"],
    ))
    write("passphrase.html", page(
        path="/passphrase.html", active="/tools.html",
        title="Passphrase Generator — Diceware-Style, 1296-Word List | OopsMyPassword",
        desc="Generate memorable passphrases from the EFF short wordlist using a CSPRNG. Adjustable word count, separators, capitalization; honest entropy display.",
        body=passphrase_body(),
        jsonld=jsonld_breadcrumb([("Home", "/"), ("Passphrase Generator", "/passphrase.html")]),
        scripts_=["security.js", "wordlist.js", "passphrase.js"],
    ))
    write("random-string.html", page(
        path="/random-string.html", active="/tools.html",
        title="Random String Generator — Hex, Base64URL, Alphanumeric | OopsMyPassword",
        desc="Generate random strings, tokens and IDs locally with a CSPRNG. Choose charset, length and batch size; copy with one click.",
        body=random_string_body(),
        jsonld=jsonld_breadcrumb([("Home", "/"), ("Random String Generator", "/random-string.html")]),
        scripts_=["security.js", "generator.js"],
    ))
    write("security-checklist.html", page(
        path="/security-checklist.html", active="/tools.html",
        title="Security Checklist — 16 Habits for Safer Accounts | OopsMyPassword",
        desc="A practical account-security checklist covering passwords, 2FA, devices and habits. Progress is stored on your device only.",
        body=checklist_body(),
        jsonld=jsonld_breadcrumb([("Home", "/"), ("Security Checklist", "/security-checklist.html")]),
        scripts_=["checklist.js"],
    ))
    write("guides.html", guides_index())
    write("blog.html", page(
        path="/blog.html", active="/blog.html",
        title="Articles — OopsMyPassword",
        desc="News, deep dives and how-tos from the OMP team — loaded from a static JSON feed in your browser. No backend, no tracking.",
        body=blog_body(),
        jsonld=jsonld_breadcrumb([("Home", "/"), ("Articles", "/blog.html")]),
        scripts_=["blog.js"],
    ))
    write("admin/index.html", page(
        path="/admin/", active="",
        title="Article Manager — OopsMyPassword Admin",
        desc="Browser-local article manager for the OMP static JSON feed. No backend, no login server.",
        body=admin_body(),
        scripts_=["blog.js", "admin.js"],
        head_extra='<meta name="robots" content="noindex,nofollow">\n  <link rel="stylesheet" href="/assets/css/admin.css">',
    ))
    for g in GUIDES:
        write(f"guides/{g['slug']}.html", guide_page(g))
    write("about.html", page(
        path="/about.html", active="/about.html",
        title="About OopsMyPassword — Privacy-First Password Tools",
        desc="Why OMP exists, what it believes (client-side by default, no accounts, no fake claims), and the security principles behind every tool.",
        body=about_body(),
        jsonld=jsonld_breadcrumb([("Home", "/"), ("About", "/about.html")]),
    ))
    write("privacy.html", page(
        path="/privacy.html", active="/about.html",
        title="Privacy Policy — OopsMyPassword",
        desc="Passwords are processed locally and never stored, logged, or sent anywhere. No accounts, no trackers, no third-party fonts or CDNs. Read the plain-language policy.",
        body=privacy_body(),
        jsonld=jsonld_breadcrumb([("Home", "/"), ("Privacy Policy", "/privacy.html")]),
    ))
    write("terms.html", page(
        path="/terms.html", active="/about.html",
        title="Terms of Use — OopsMyPassword",
        desc="OMP is an educational tool. Strength scores are heuristic estimates, not security guarantees. Read the terms before relying on any output.",
        body=terms_body(),
        jsonld=jsonld_breadcrumb([("Home", "/"), ("Terms of Use", "/terms.html")]),
    ))
    write("contact.html", page(
        path="/contact.html", active="/about.html",
        title="Contact — OopsMyPassword",
        desc="Questions, corrections and guide requests. The form backend is intentionally not configured yet — we never fake submissions; email links are provided instead.",
        body=contact_body(),
        jsonld=jsonld_breadcrumb([("Home", "/"), ("Contact", "/contact.html")]),
        scripts_=["contact.js"],
    ))
    write("faq.html", page(
        path="/faq.html", active="/about.html",
        title="FAQ — OopsMyPassword",
        desc="Is OMP free? Does it store passwords? How is strength calculated? What is entropy, a password manager, a passkey? Ten straight answers.",
        body=faq_body(),
        jsonld=jsonld_faq(FAQ_ITEMS),
    ))
    write("glossary.html", page(
        path="/glossary.html", active="/about.html",
        title="Security Glossary — OopsMyPassword",
        desc="Twenty password-security terms — entropy, salting, passkeys, k-anonymity, credential stuffing — defined in one or two sentences each.",
        body=glossary_body(),
        jsonld=jsonld_breadcrumb([("Home", "/"), ("Glossary", "/glossary.html")]),
    ))
    write("security.html", page(
        path="/security.html", active="/about.html",
        title="Security & Responsible Disclosure — OopsMyPassword",
        desc="OMP's own security posture — static architecture, no password endpoints, textContent-only DOM handling, CSPRNG generation — plus how to report a vulnerability.",
        body=security_body(),
        jsonld=jsonld_breadcrumb([("Home", "/"), ("Security", "/security.html")]),
    ))
    write("sitemap.html", page(
        path="/sitemap.html", active="/about.html",
        title="Sitemap — OopsMyPassword",
        desc="Every page on OopsMyPassword: tools, guides, and site information.",
        body=sitemap_body(GUIDES),
    ))
    write_404()

    # -------------------------------------------------- metadata files
    urls = ["/"] + [
        "/checker.html", "/generator.html", "/tools.html", "/breach-check.html",
        "/password-health.html", "/entropy.html", "/passphrase.html",
        "/random-string.html", "/security-checklist.html", "/guides.html", "/blog.html",
    ] + [f"/guides/{g['slug']}.html" for g in GUIDES] + [
        "/about.html", "/privacy.html", "/terms.html", "/contact.html",
        "/faq.html", "/glossary.html", "/security.html", "/sitemap.html",
    ]
    sm = ['<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for u in urls:
        pri = "1.0" if u == "/" else "0.8" if u.endswith(".html") and "/" not in u[1:-5] else "0.6"
        sm.append(f"  <url><loc>{SITE}{u}</loc><lastmod>{DATE}</lastmod>"
                  f'<changefreq>{"weekly" if u == "/" else "monthly"}</changefreq>'
                  f"<priority>{pri}</priority></url>")
    sm.append("</urlset>\n")
    write("sitemap.xml", "\n".join(sm))

    write("robots.txt", f"""User-agent: *
Allow: /
Disallow: /tools/
Disallow: /admin/

Sitemap: {SITE}/sitemap.xml
""")

    write("manifest.webmanifest", json.dumps({
        "name": "OopsMyPassword — Privacy-First Password Tools",
        "short_name": "OMP",
        "description": "Test, generate and learn password security — entirely client-side, no account required.",
        "start_url": "/",
        "scope": "/",
        "display": "standalone",
        "background_color": "#050811",
        "theme_color": "#050811",
        "icons": [
            {"src": "/assets/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
            {"src": "/assets/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
            {"src": "/assets/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
        ],
    }, indent=2) + "\n")

    print("\nTotal pages:", len(urls) + 1)  # + 404


def write_404():
    body = f"""
<section class="section">
  <div class="container container-narrow center" style="padding-top:80px;padding-bottom:80px">
    <div class="score-number" style="font-size:4.5rem">4<span class="grad-text">0</span>4</div>
    <h1 class="h-2 mt-16">This page doesn't exist — unlike weak passwords, sadly.</h1>
    <p class="lead mt-16">Head back to safety and make sure your credentials are in better shape than this URL.</p>
    <div class="flex gap-12 wrap mt-32" style="justify-content:center">
      <a class="btn btn-primary" href="/">Go home</a>
      <a class="btn btn-secondary" href="/checker.html">Check a password</a>
      <a class="btn btn-ghost" href="/sitemap.html">View sitemap</a>
    </div>
  </div>
</section>"""
    write("404.html", page(
        path="/404.html", active="/",
        title="Page Not Found — OopsMyPassword",
        desc="The page you were looking for doesn't exist. Try the password checker, generator, or guides instead.",
        body=body,
    ))


if __name__ == "__main__":
    main()
