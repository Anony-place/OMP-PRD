# -*- coding: utf-8 -*-
"""Static QA for OMP: HTML balance, local links, anchors, duplicate ids, SEO basics."""
import os
import re
import sys
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link",
        "meta", "param", "source", "track", "wbr", "circle", "path", "rect",
        "line", "polyline", "polygon", "ellipse", "stop", "use"}

errors = []
warnings = []


class Checker(HTMLParser):
    def __init__(self, fname):
        super().__init__(convert_charrefs=True)
        self.fname = fname
        self.stack = []
        self.ids = {}
        self.hrefs = []
        self.srcs = []
        self.has = {"title": False, "h1": 0, "meta_desc": False,
                    "canonical": False, "og": 0, "twitter": 0, "main": False}
        self._tag_counts = {}

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag not in VOID:
            self.stack.append((tag, self.getpos()))
        if "id" in a:
            self.ids.setdefault(a["id"], 0)
            self.ids[a["id"]] += 1
            if self.ids[a["id"]] > 1:
                errors.append(f"{self.fname}:{self.getpos()} duplicate id #{a['id']}")
        if tag == "a" and "href" in a:
            self.hrefs.append(a["href"])
        if tag in ("script", "img") and "src" in a:
            self.srcs.append(a["src"])
        if tag == "h1":
            self.has["h1"] += 1
        if tag == "meta":
            if a.get("name") == "description":
                self.has["meta_desc"] = True
        if tag == "link" and a.get("rel") == "canonical":
            self.has["canonical"] = True
        if tag == "meta" and a.get("property", "").startswith("og:"):
            self.has["og"] += 1
        if tag == "meta" and a.get("name", "").startswith("twitter:"):
            self.has["twitter"] += 1
        if tag == "meta" and a.get("name") == "robots" and "noindex" in a.get("content", ""):
            self.has["noindex"] = True
        if tag == "main":
            self.has["main"] = True

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        if not self.stack:
            errors.append(f"{self.fname}:{self.getpos()} closing </{tag}> with empty stack")
            return
        # pop until match (find first matching from top)
        names = [t for t, _ in self.stack]
        if tag in names:
            while self.stack:
                t, pos = self.stack.pop()
                if t == tag:
                    break
                # implicitly closed/never closed inner tag
                errors.append(f"{self.fname}:{pos} <{t}> implicitly closed by </{tag}> at {self.getpos()}")
        else:
            errors.append(f"{self.fname}:{self.getpos()} stray closing </{tag}>")


def resolve(path, base_file):
    """Resolve a public URL to a file on disk (cleanUrls + SPA rewrites)."""
    if path.startswith(("http://", "https://", "mailto:", "tel:", "data:", "javascript:")):
        return None, None
    p, _, frag = path.partition("#")
    if p == "":
        target = os.path.join(ROOT, base_file)
        return target, frag
    if p.startswith("/"):
        target = os.path.join(ROOT, p.lstrip("/"))
        if p.endswith("/"):
            target = os.path.join(target, "index.html")
    else:
        target = os.path.normpath(os.path.join(ROOT, os.path.dirname(base_file), p))

    if os.path.exists(target):
        return target, frag

    # cleanUrls: /checker is served by checker.html
    if not str(target).endswith(".html") and os.path.exists(target + ".html"):
        return target + ".html", frag

    # /articles/<static-guide-slug> is rewritten to /guides/<slug>.html
    if p.startswith("/articles/"):
        slug = p[len("/articles/"):].rstrip("/")
        guide = os.path.join(ROOT, "guides", slug + ".html")
        if os.path.exists(guide):
            return guide, frag
        # live article SPA: /articles/<slug> → articles.html
        hub = os.path.join(ROOT, "articles.html")
        if os.path.exists(hub):
            return hub, frag

    # /products and /products/<slug> → products.html
    if p == "/products" or p.startswith("/products/"):
        catalog = os.path.join(ROOT, "products.html")
        if os.path.exists(catalog):
            return catalog, frag

    # /osint and /osint/<slug> → osint.html
    if p == "/osint" or p.startswith("/osint/"):
        catalog = os.path.join(ROOT, "osint.html")
        if os.path.exists(catalog):
            return catalog, frag

    # /pentest and /pentest/<slug> → pentest.html
    if p == "/pentest" or p.startswith("/pentest/"):
        catalog = os.path.join(ROOT, "pentest.html")
        if os.path.exists(catalog):
            return catalog, frag

    return target, frag


html_files = []
for dirpath, dirnames, filenames in os.walk(ROOT):
    dirnames[:] = [d for d in dirnames if d not in {".git", "tools", "node_modules"}]
    for f in filenames:
        if f.endswith(".html"):
            html_files.append(os.path.relpath(os.path.join(dirpath, f), ROOT))

# articles/ and products/ are built at deploy time from the Supabase database
# by scripts/build-static-seo.mjs, and they embed admin-authored HTML verbatim.
# This sweep audits the pages tools/build.py generates from tools/omp_build —
# its duplicate-id and tag-balance rules would otherwise fail the build over
# something an author typed into an article body, which is not a site defect.
# The generated pages are covered by scripts/verify-seo.mjs instead (canonical,
# title, description, H1, heading order, img alt, JSON-LD, routability), which
# is designed to tolerate injected content.
GENERATED_DIRS = {"articles", "products", "osint", "pentest"}
html_files = [f for f in html_files
              if os.path.dirname(f).split(os.sep)[0] not in GENERATED_DIRS]

anchors = {}  # file -> set(ids)
parsed = {}
for f in sorted(html_files):
    c = Checker(f)
    src = open(os.path.join(ROOT, f), encoding="utf-8").read()
    c.feed(src)
    c.close()
    parsed[f] = c
    anchors[f] = set(c.ids.keys())
    for t, pos in c.stack:
        if t != "html":
            errors.append(f"{f}:{pos} unclosed <{t}>")
    if c.has["h1"] != 1:
        errors.append(f"{f}: expected exactly 1 <h1>, found {c.has['h1']}")
    if not c.has["meta_desc"]:
        errors.append(f"{f}: missing meta description")
    # Indexable pages must self-canonicalise. noindex pages (the 404 and the
    # admin panel) must NOT — a canonical on an error page turns it into a
    # soft 404 in Search Console.
    if not c.has.get("noindex") and not c.has["canonical"]:
        errors.append(f"{f}: missing canonical")
    if c.has.get("noindex") and c.has["canonical"]:
        errors.append(f"{f}: noindex page should not carry a canonical")
    # A noindex page (the private admin panel) must NOT carry social cards —
    # there is nothing to share, and warning about it is a false positive.
    if not c.has.get("noindex"):
        if c.has["og"] < 5:
            warnings.append(f"{f}: only {c.has['og']} og: tags")
        if c.has["twitter"] < 3:
            warnings.append(f"{f}: only {c.has['twitter']} twitter: tags")
    else:
        if c.has["og"] or c.has["twitter"]:
            warnings.append(f"{f}: noindex page should not carry og:/twitter: cards")
    if not c.has["main"]:
        errors.append(f"{f}: missing <main>")
    if "<title>" not in src:
        errors.append(f"{f}: missing <title>")

for f, c in parsed.items():
    for href in c.hrefs + c.srcs:
        target, frag = resolve(href, f)
        if target is None:
            continue
        if not os.path.exists(target):
            errors.append(f"{f}: broken local link {href}")
        elif frag:
            # SPA hash routes (#/c/guides, #/slug) are not HTML ids.
            if frag.startswith("/"):
                continue
            rel = os.path.relpath(target, ROOT)
            if rel.endswith(".html") and frag not in anchors.get(rel, set()):
                errors.append(f"{f}: dead anchor {href} (#{frag} not in {rel})")

def is_noindex(fname):
    return parsed[fname].has.get("noindex")

# titles unique among indexable pages (redirect stubs may share a destination)
titles = {}
for f in html_files:
    if is_noindex(f):
        continue
    src = open(os.path.join(ROOT, f), encoding="utf-8").read()
    m = re.search(r"<title>(.*?)</title>", src)
    if m:
        titles.setdefault(m.group(1), []).append(f)
for t, fs in titles.items():
    if len(fs) > 1:
        errors.append(f"duplicate title '{t}' on {fs}")

# descriptions unique among indexable pages
descs = {}
for f in html_files:
    if is_noindex(f):
        continue
    src = open(os.path.join(ROOT, f), encoding="utf-8").read()
    m = re.search(r'<meta name="description" content="(.*?)">', src)
    if m:
        descs.setdefault(m.group(1), []).append(f)
for d, fs in descs.items():
    if len(fs) > 1:
        errors.append(f"duplicate meta description on {fs}")

print(f"Checked {len(html_files)} html files")
for w in warnings:
    print("WARN:", w)
if errors:
    print(f"\n{len(errors)} ERRORS:")
    for e in errors:
        print("  ", e)
    # Surface each error as a GitHub Actions annotation too, so the reason is
    # visible on the run summary without downloading the full job log.
    if os.environ.get("GITHUB_ACTIONS") == "true":
        for e in errors:
            print(f"::error title=QA failure::{e}")
    sys.exit(1)
print("NO ERRORS — all links, anchors, tags, SEO basics pass.")
