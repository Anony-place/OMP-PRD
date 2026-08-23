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
    """Resolve site path to filesystem."""
    if path.startswith(("http://", "https://", "mailto:", "tel:", "data:", "javascript:")):
        return None, None
    p, _, frag = path.partition("#")
    if p == "":
        target = os.path.join(ROOT, base_file)
    elif p.startswith("/"):
        target = os.path.join(ROOT, p.lstrip("/"))
        if p.endswith("/"):
            target = os.path.join(target, "index.html")
    else:
        target = os.path.normpath(os.path.join(ROOT, os.path.dirname(base_file), p))
    return target, frag


html_files = []
for dirpath, dirnames, filenames in os.walk(ROOT):
    dirnames[:] = [d for d in dirnames if d not in {".git", "tools", "node_modules"}]
    for f in filenames:
        if f.endswith(".html"):
            html_files.append(os.path.relpath(os.path.join(dirpath, f), ROOT))

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
    if not c.has["canonical"]:
        errors.append(f"{f}: missing canonical")
    if c.has["og"] < 5:
        warnings.append(f"{f}: only {c.has['og']} og: tags")
    if c.has["twitter"] < 3:
        warnings.append(f"{f}: only {c.has['twitter']} twitter: tags")
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
            rel = os.path.relpath(target, ROOT)
            if rel.endswith(".html") and frag not in anchors.get(rel, set()):
                errors.append(f"{f}: dead anchor {href} (#{frag} not in {rel})")

# titles unique?
titles = {}
for f in html_files:
    src = open(os.path.join(ROOT, f), encoding="utf-8").read()
    m = re.search(r"<title>(.*?)</title>", src)
    if m:
        titles.setdefault(m.group(1), []).append(f)
for t, fs in titles.items():
    if len(fs) > 1:
        errors.append(f"duplicate title '{t}' on {fs}")

# descriptions unique?
descs = {}
for f in html_files:
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
    sys.exit(1)
print("NO ERRORS — all links, anchors, tags, SEO basics pass.")
