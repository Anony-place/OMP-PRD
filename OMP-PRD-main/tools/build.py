# -*- coding: utf-8 -*-
"""OMP static site generator.

Assembles every HTML page from shared layout + page bodies so that
head/meta/nav/footer are consistent everywhere. Generated HTML is
committed to the repo root; this script is only a build tool.

Usage:  python3 tools/build.py
"""
import datetime
import json
import re
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from omp_build.layout import (  # noqa: E402
    DATE, SITE, footer, guide_card, head, header, icon,
    jsonld_article, jsonld_breadcrumb, jsonld_faq, jsonld_webapp,
    jsonld_website, jsonld_organization, page, scripts,
)
from omp_build.guides1 import GUIDES_1  # noqa: E402
from omp_build.guides2 import GUIDES_2  # noqa: E402
from omp_build.guides3 import GUIDES_3  # noqa: E402
from omp_build.pages_core import (  # noqa: E402
    FAQ_ITEMS, breach_body, checker_body, checklist_body, entropy_body,
    generator_body, health_body, home_body, passphrase_body,
    random_string_body, tools_body,
)
from omp_build.pages_blog import articles_body, products_body  # noqa: E402
from omp_build.pages_info import (  # noqa: E402
    about_body, contact_body, faq_body, glossary_body, privacy_body,
    security_body, sitemap_body, terms_body, )

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GUIDES = GUIDES_1 + GUIDES_2 + GUIDES_3

SITEMAP_CORE = os.path.join(
    ROOT, "supabase", "functions", "sitemap", "sitemap-core.mjs")


def load_sitemap_core():
    """Read STATIC_ROUTES / STATIC_LASTMOD out of the shared sitemap core.

    The Edge Function is the source of truth for the sitemap; this keeps
    the committed static snapshot (and therefore build.py) from drifting
    away from it, without making the Python build depend on Node.
    """
    with open(SITEMAP_CORE, encoding="utf-8") as fh:
        src = fh.read()

    block = re.search(r"export const STATIC_ROUTES = \[(.*?)\];", src, re.S)
    if not block:
        raise SystemExit("sitemap-core.mjs: STATIC_ROUTES not found")
    routes = re.findall(r"'([^']+)'", block.group(1))
    if not routes:
        raise SystemExit("sitemap-core.mjs: STATIC_ROUTES is empty")
    if "...ACADEMY_ROUTES" in block.group(1):
        manifest_path = os.path.join(os.path.dirname(SITEMAP_CORE), "academy-routes.mjs")
        with open(manifest_path, encoding="utf-8") as fh:
            manifest = re.search(r"export const ACADEMY_ROUTES = (\[.*?\]);", fh.read(), re.S)
        if not manifest:
            raise SystemExit("academy-routes.mjs: ACADEMY_ROUTES not found")
        academy_routes = json.loads(manifest.group(1))
        if not isinstance(academy_routes, list) or any(not isinstance(route, str) or not route.startswith("/learning") for route in academy_routes):
            raise SystemExit("academy-routes.mjs: invalid published routes")
        routes = list(dict.fromkeys(academy_routes + routes))


    # The value is deliberately allowed to be empty: no lastmod is asserted for
    # generated pages. [^']* (not [^']+) so an empty stamp still parses.
    lastmod = re.search(r"export const STATIC_LASTMOD = '([^']*)'", src)
    if not lastmod:
        raise SystemExit("sitemap-core.mjs: STATIC_LASTMOD not found")

    return routes, lastmod.group(1)


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
    <nav aria-label="Breadcrumb" class="small muted"><a href="/articles" style="color:var(--purple)">Articles</a> <span class="divider-dot">/</span> <a href="/articles#/c/guides" style="color:var(--purple)">Guides</a></nav>
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
        <div class="callout callout-info">{icon("shield","icon-20")}<p><strong>Put it into practice:</strong> run your next password through the <a href="/checker">local checker</a> — it never leaves your browser.</p></div>
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
            ("Home", "/"), ("Articles", "/articles"),
            ("Guides", "/articles#/c/guides"),
            (g["title"], f"/articles/{g['slug']}"),
        ]),
    ]
    if g.get("faq"):
        jsonld.append(jsonld_faq(g["faq"]))
    return page(
        path=f"/articles/{g['slug']}", active="/articles",
        title=f"{g.get('seo_title', g['title'])} | OopsMyPassword", desc=g["desc"],
        body=body, og_type="article", jsonld=jsonld,
        head_extra=(
            f'<meta property="article:published_time" content="{DATE}">\n'
            f'  <meta property="article:section" content="Guides">'
        ),
    )


# Legacy /guides.html is a noindex redirect stub (Firebase also 301s it).
# Unique title so it does not collide with the Articles hub in SEO crawls.
GUIDES_REDIRECT_STUB = f"""<!DOCTYPE html>
<html lang="en" data-theme="dark">
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
"""


# ------------------------------------------------------------------ main
def main():
    write("tools/site-footer.html", footer())
    write("functions/site-footer.fragment", footer())
    write("index.html", page(
        path="/", active="/",
        title="OopsMyPassword | Private Password Tools & Academy",
        desc="Free, privacy-first password tools that run entirely in your browser: strength checker, CSPRNG generator, passphrase builder and plain-language security guides.",
        body=home_body(GUIDES),
        jsonld=[jsonld_website(), jsonld_organization(), jsonld_webapp(), jsonld_faq(FAQ_ITEMS[:5])],
        # articles.js is intentionally NOT loaded here: the homepage body has no
        # [data-articles] mount point. The article feed lives on /articles.
        scripts_=["security.js", "wordlist.js", "checker.js", "generator.js"],
    ))
    write("checker.html", page(
        path="/checker", active="/checker",
        title="Password Strength Checker — Private & Free | OopsMyPassword",
        desc="Test password strength in real time with pattern detection, entropy estimates and crack-time indication. 100% client-side: your password never leaves your browser.",
        body=checker_body(),
        jsonld=jsonld_breadcrumb([("Home", "/"), ("Password Checker", "/checker")]),
        scripts_=["security.js", "wordlist.js", "checker.js"],
    ))
    write("generator.html", page(
        path="/generator", active="/generator",
        title="Secure Random Password Generator | OopsMyPassword",
        desc="Generate cryptographically secure passwords locally with crypto.getRandomValues(). Length slider, character options, ambiguous-character filter. No Math.random(), ever.",
        body=generator_body(),
        jsonld=jsonld_breadcrumb([("Home", "/"), ("Password Generator", "/generator")]),
        scripts_=["security.js", "generator.js"],
    ))
    write("tools.html", page(
        path="/tools", active="/tools",
        title="Password Security Tools — All Free & Client-Side | OopsMyPassword",
        desc="Eight browser-based password tools: checker, generator, breach-check demo, health audit, passphrases, entropy calculator, random strings and a security checklist.",
        body=tools_body(),
        jsonld=jsonld_breadcrumb([("Home", "/"), ("Tools", "/tools")]),
    ))
    write("breach-check.html", page(
        path="/breach-check", active="/breach-check",
        title="Password Breach Check — Local Demo | OopsMyPassword",
        desc="Learn why password reuse is dangerous and how privacy-preserving breach lookup works. Includes a clearly-labeled local demo — no live database, no false claims.",
        body=breach_body(),
        jsonld=jsonld_breadcrumb([("Home", "/"), ("Breach Check", "/breach-check")]),
        scripts_=["security.js", "breach.js"],
    ))
    write("password-health.html", page(
        path="/password-health", active="/tools",
        title="Password Health Check — Local 10-Point Audit | OopsMyPassword",
        desc="Run a local 10-point password audit: length, diversity, patterns, entropy and reuse hygiene, with a letter grade and fixes. No account, no stored history.",
        body=health_body(),
        jsonld=jsonld_breadcrumb([("Home", "/"), ("Password Health", "/password-health")]),
        scripts_=["security.js", "wordlist.js", "health.js"],
    ))
    write("entropy.html", page(
        path="/entropy", active="/tools",
        title="Password Entropy Calculator | OopsMyPassword",
        desc="Calculate password entropy from length and character pools (H = L·log₂N), or from a real password — with crack times for online, slow-hash and GPU-rig attackers.",
        body=entropy_body(),
        jsonld=jsonld_breadcrumb([("Home", "/"), ("Entropy Calculator", "/entropy")]),
        scripts_=["security.js", "wordlist.js", "entropy.js"],
    ))
    write("passphrase.html", page(
        path="/passphrase", active="/tools",
        title="Random Passphrase Generator | OopsMyPassword",
        desc="Generate memorable passphrases from the EFF short wordlist using a CSPRNG. Adjustable word count, separators, capitalization; honest entropy display.",
        body=passphrase_body(),
        jsonld=jsonld_breadcrumb([("Home", "/"), ("Passphrase Generator", "/passphrase")]),
        scripts_=["security.js", "wordlist.js", "passphrase.js"],
    ))
    write("random-string.html", page(
        path="/random-string", active="/tools",
        title="Random String Generator — Hex & Base64 | OopsMyPassword",
        desc="Generate random strings, tokens and IDs locally with a CSPRNG. Choose charset, length and batch size; copy with one click.",
        body=random_string_body(),
        jsonld=jsonld_breadcrumb([("Home", "/"), ("Random String Generator", "/random-string")]),
        scripts_=["security.js", "generator.js"],
    ))
    write("security-checklist.html", page(
        path="/security-checklist", active="/tools",
        title="Account Security Checklist — 16 Habits | OopsMyPassword",
        desc="A practical account-security checklist covering passwords, 2FA, devices and habits. Progress is stored on your device only.",
        body=checklist_body(),
        jsonld=jsonld_breadcrumb([("Home", "/"), ("Security Checklist", "/security-checklist")]),
        scripts_=["checklist.js"],
    ))
    write("guides.html", GUIDES_REDIRECT_STUB)
    write("articles.html", page(
        path="/articles", active="/articles",
        title="Articles — OopsMyPassword",
        desc="Password security news, breach analysis and practical how-tos from the OopsMyPassword team.",
        body=articles_body(GUIDES),
        jsonld=jsonld_breadcrumb([("Home", "/"), ("Articles", "/articles")]),
        # Order matters: sanitize.js and markdown.js expose the window globals
        # that articles.js renders article bodies with (Markdown or HTML input).
        scripts_=["sanitize.js", "markdown.js", "articles.js"],
    ))
    write("products.html", page(
        path="/products", active="/products",
        title="Products — OopsMyPassword",
        desc="Books, courses, tools, templates and resources from OopsMyPassword — browse by type, search the catalog, and buy through the linked storefront.",
        body=products_body(),
        jsonld=jsonld_breadcrumb([("Home", "/"), ("Products", "/products")]),
        scripts_=["sanitize.js", "markdown.js", "products.js"],
    ))
    # NOTE: admin/index.html is intentionally NOT generated here.
    # The admin panel is hand-maintained (Supabase Auth) — regenerating it
    # from this script would clobber the live page. See omp_build/pages_blog.py.
    for g in GUIDES:
        write(f"guides/{g['slug']}.html", guide_page(g))
    write("about.html", page(
        path="/about", active="/about",
        title="About OopsMyPassword — Privacy-First Password Tools",
        desc="Why OMP exists, what it believes (client-side by default, no accounts, no fake claims), and the security principles behind every tool.",
        body=about_body(),
        jsonld=jsonld_breadcrumb([("Home", "/"), ("About", "/about")]),
    ))
    write("privacy.html", page(
        path="/privacy", active="/about",
        title="Privacy Policy — OopsMyPassword",
        desc="How OMP handles local password tools, device-only Academy progress and contact messages. Read our plain-language privacy policy.",
        body=privacy_body(),
        jsonld=jsonld_breadcrumb([("Home", "/"), ("Privacy Policy", "/privacy")]),
    ))
    write("terms.html", page(
        path="/terms", active="/about",
        title="Terms of Use — OopsMyPassword",
        desc="OMP is an educational tool. Strength scores are heuristic estimates, not security guarantees. Read the terms before relying on any output.",
        body=terms_body(),
        jsonld=jsonld_breadcrumb([("Home", "/"), ("Terms of Use", "/terms")]),
    ))
    write("contact.html", page(
        path="/contact", active="/about",
        title="Contact — OopsMyPassword",
        desc="Questions, corrections and guide requests. Send a message straight from the page — submissions land in the team's inbox. No password fields, no tracking.",
        body=contact_body(),
        jsonld=jsonld_breadcrumb([("Home", "/"), ("Contact", "/contact")]),
        scripts_=["contact.js"],
    ))
    write("faq.html", page(
        path="/faq", active="/about",
        title="FAQ — OopsMyPassword",
        desc="Is OMP free? Does it store passwords? How is strength calculated? What is entropy, a password manager, a passkey? Ten straight answers.",
        body=faq_body(),
        jsonld=jsonld_faq(FAQ_ITEMS),
    ))
    write("glossary.html", page(
        path="/glossary", active="/about",
        title="Security Glossary — OopsMyPassword",
        desc="Twenty password-security terms — entropy, salting, passkeys, k-anonymity, credential stuffing — defined in one or two sentences each.",
        body=glossary_body(),
        jsonld=jsonld_breadcrumb([("Home", "/"), ("Glossary", "/glossary")]),
    ))
    write("security.html", page(
        path="/security", active="/about",
        title="Security & Responsible Disclosure — OopsMyPassword",
        desc="How OopsMyPassword protects local password inputs, sanitizes published content and restricts admin access, plus how to report a vulnerability safely.",
        body=security_body(),
        jsonld=jsonld_breadcrumb([("Home", "/"), ("Security", "/security")]),
    ))
    write("sitemap.html", page(
        path="/sitemap", active="/about",
        title="Sitemap — OopsMyPassword",
        desc="Every page on OopsMyPassword: tools, guides, and site information.",
        body=sitemap_body(GUIDES),
        scripts_=["sitemap.js"],
    ))
    write_404()

    # -------------------------------------------------- metadata files
    # sitemap.xml is the LIVE endpoint Google fetches. CI deploys Hosting
    # only, so /sitemap.xml MUST be this baked file — a rewrite to the
    # undeployed Cloud Function 404s and Search Console reports
    # "Couldn't fetch". The Edge Function remains a generator used at
    # build time (scripts/build-static-seo.mjs); it is not the public URL.
    #
    # The route list and the static lastmod are read straight out of the
    # shared core module so the snapshot can never drift from what the
    # generator emits. tools/test_sitemap.js asserts the two agree.
    routes, static_lastmod = load_sitemap_core()
    sm = ['<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for u in routes:
        pri = ("1.0" if u == "/" else
               "0.9" if u in ("/articles", "/products") else
               "0.7" if u.startswith("/articles/") or u.startswith("/products/") else
               "0.5" if u == "/sitemap" else "0.8")
        # static_lastmod is empty by design: there is no honest per-page
        # modification date for a generated page, so the optional element is
        # omitted instead of stamped with an invented one.
        lm = f"<lastmod>{static_lastmod}</lastmod>" if static_lastmod else ""
        sm.append(f"  <url><loc>{SITE}{u}</loc>{lm}"
                  f'<changefreq>{"weekly" if u == "/" else "monthly"}</changefreq>'
                  f"<priority>{pri}</priority></url>")
    sm.append("</urlset>")
    write("sitemap.xml", "\n".join(sm) + "\n")

    # IndexNow: a real, generated key file must be publicly served at
    # /<key>.txt for Bing/Yandex to accept URL submissions. The key is public
    # by design (it is served on the site) and is not a credential — it only
    # proves the submitter controls this host. Regenerated here only if absent,
    # so the key stays stable across deploys.
    existing = [f for f in os.listdir(ROOT)
                if re.fullmatch(r"[0-9a-f]{8,128}\.txt", f)]
    if not existing:
        raise SystemExit(
            "no IndexNow key file (<hex>.txt) found in the site root — "
            "generate one with: python3 -c \"import secrets;print(secrets.token_hex(16))\" "
            "and commit <key>.txt containing the key")
    indexnow_key = existing[0][:-4]
    # Written to a build-info line, not into robots.txt: IndexNow ownership is
    # proven by serving /<key>.txt, and "IndexNow-Key:" is not a standard
    # robots.txt directive.
    print("IndexNow key:", indexnow_key, f"(served at /{indexnow_key}.txt)")

    # Only genuinely private paths are blocked.
    #   /admin/    - the noindex admin panel
    #   /functions/- Cloud Function sources (not deployed, blocked in depth)
    # /tools/ was previously listed here. That was a no-op AND a hazard:
    # trailingSlash:false means the public toolbox is /tools (no slash), so
    # the rule matched nothing real while making it look as though a primary,
    # heavily-linked page was blocked from crawlers. robots.txt is not a
    # substitute for noindex, and must never appear to hide public content.
    write("robots.txt", f"""User-agent: *
Allow: /
Disallow: /admin/
Disallow: /functions/

# Submit this exact URL in Google Search Console on the
# https://oopsmypassword.web.app URL-prefix property.
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

    print("\nTotal pages:", len(GUIDES) + len(routes) + 1)  # guides + pages + 404


def write_404():
    body = f"""
<section class="section">
  <div class="container container-narrow center" style="padding-top:80px;padding-bottom:80px">
    <div class="score-number" style="font-size:4.5rem">4<span class="grad-text">0</span>4</div>
    <h1 class="h-2 mt-16">This page doesn't exist — unlike weak passwords, sadly.</h1>
    <p class="lead mt-16">Head back to safety and make sure your credentials are in better shape than this URL.</p>
    <div class="flex gap-12 wrap mt-32" style="justify-content:center">
      <a class="btn btn-primary" href="/">Go home</a>
      <a class="btn btn-secondary" href="/checker">Check a password</a>
      <a class="btn btn-ghost" href="/sitemap">View sitemap</a>
    </div>
  </div>
</section>"""
    # noindex + no canonical: a 404 with a canonical to /404 reads as a soft
    # 404 in Search Console and adds a junk URL to the index.
    write("404.html", page(
        path="/404", active="/",
        title="Page Not Found — OopsMyPassword",
        desc="The page you were looking for doesn't exist. Try the password checker, generator, or guides instead.",
        body=body,
        robots="noindex, follow",
    ))


if __name__ == "__main__":
    main()
