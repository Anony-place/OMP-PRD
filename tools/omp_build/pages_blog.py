# -*- coding: utf-8 -*-
"""Dynamic articles (blog) + no-backend admin panel page bodies."""
from .layout import icon


def blog_body():
    return f"""
<section class="page-hero">
  <div class="container">
    <span class="chip chip-accent">{icon("file","icon-16")} Dynamic feed · static-hosted · no backend</span>
    <h1 class="h-1 mt-16">Articles</h1>
    <p class="lead">Fresh posts published by the OMP team. This feed is powered by a single static file — <span class="mono">content/articles.json</span> — loaded by your browser. No server, no database.</p>
  </div>
</section>
<section class="section-tight" style="padding-top:8px">
  <div class="container">
    <div id="blog-app" data-blog>
      <div class="flex items-center gap-12 muted" role="status">{icon("refresh","icon-18")} Loading articles…</div>
    </div>
    <noscript>
      <div class="notice-band mt-24">{icon("info","icon-20")}<p>Dynamic articles need JavaScript (they are loaded from a static JSON file in your browser). The <a href="/guides.html" style="color:var(--purple)">ten core guides</a> are fully static and readable without it.</p></div>
    </noscript>
  </div>
</section>
"""


def admin_body():
    return f"""
<section class="page-hero" style="padding-bottom:8px">
  <div class="container">
    <span class="badge badge-demo">Owner tool · browser-local</span>
    <h1 class="h-1 mt-16">Article Manager</h1>
    <p class="lead">Write and publish articles for the dynamic feed — no backend, no database, no login server. Your work is saved in <strong>this browser</strong> (localStorage); publishing means exporting one JSON file and placing it at <span class="mono">content/articles.json</span> in the site.</p>
  </div>
</section>
<section class="section-tight" style="padding-top:16px">
  <div class="container">
    <div id="admin-app" data-admin>
      <div class="flex items-center gap-12 muted" role="status">{icon("refresh","icon-18")} Loading panel…</div>
    </div>
    <noscript>
      <div class="notice-band mt-24">{icon("alert","icon-20")}<p>The admin panel is a client-side app and requires JavaScript.</p></div>
    </noscript>
  </div>
</section>
"""
