const assert = require("node:assert/strict"),
  fs = require("node:fs");
const { JSDOM } = require("jsdom");
const sanitize = require("../functions/safe-article-html.cjs");
let n = 0;
const test = (label, fn) => {
  fn();
  n++;
  console.log("✓ " + label);
};
test("Parser-based publication sanitizer blocks encoded schemes, events and dangerous namespaces", () => {
  for (const payload of [
    '<a href="jav&#x61;script:alert(1)">x</a>',
    '<a href="java&#10;script:alert(1)">x</a>',
    '<svg><a xlink:href="javascript:alert(1)">x</a></svg>',
    "<img src=x onerror=alert(1)>",
    '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
    "<form><input name=location></form>",
    '<style>body{display:none}</style><p style="color:red" id="main">text</p>',
    '<math><mtext><table><mglyph><style><!--</style><img title="--><img src=1 onerror=alert(1)>">',
  ]) {
    const dom = new JSDOM(sanitize(payload));
    const d = dom.window.document;
    assert.equal(
      d.querySelectorAll(
        "script,iframe,svg,math,object,embed,form,input,style,base,meta,link",
      ).length,
      0,
    );
    for (const el of d.querySelectorAll("*"))
      for (const a of el.attributes) {
        assert.ok(!/^on|^style$/i.test(a.name));
        /* Author ids are intentional (in-article anchors): strict charset
           only — anything else must not survive. */
        if (/^id$/i.test(a.name))
          assert.ok(/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(a.value));
        if (["href", "src"].includes(a.name))
          assert.ok(
            !/^(?:javascript|vbscript|data):/i.test(a.value.replace(/\s/g, "")),
          );
      }
    dom.window.close();
  }
});
test("Sanitization retains useful authored content and safe links/code/images", () => {
  const clean = sanitize(
    '<h2>Title</h2><p>Hello <strong>world</strong></p><a href="https://example.com/path">Source</a><img src="/assets/images/og-image.jpg" alt="Cover"><pre><code class="language-python">print(&quot;Hi&quot;)</code></pre>',
  );
  assert.match(clean, /<strong>world<\/strong>/);
  assert.match(clean, /href="https:\/\/example.com\/path"/);
  assert.match(clean, /language-python/);
  assert.match(clean, /src="\/assets/);
});
test("Homepage identifies one consistent website and organization, including subdomain fallback", () => {
  const d = new JSDOM(fs.readFileSync("index.html", "utf8")).window.document;
  const ld = [...d.querySelectorAll('script[type="application/ld+json"]')].map(
    (el) => JSON.parse(el.textContent),
  );
  const sites = ld.filter((x) => x["@type"] === "WebSite");
  assert.equal(sites.length, 1);
  const w = sites[0];
  assert.equal(w.name, "OopsMyPassword");
  assert.equal(w.url, "https://oopsmypassword.web.app/");
  assert.ok(w.alternateName.includes("oopsmypassword.web.app"));
  assert.equal(
    ld.find((x) => x["@type"] === "Organization")["@id"],
    w.publisher["@id"],
  );
  assert.equal(d.querySelector('[property="og:site_name"]').content, w.name);
  assert.ok(d.title.startsWith(w.name));
});
test("Every built public page has the shared Academy footer (including lessons and guides)", () => {
  const files = [];
  for (const dir of [
    ".",
    "guides",
    "learning",
    "learning/web-application-security",
    "learning/web-application-security/foundations",
  ])
    for (const file of fs.readdirSync(dir))
      if (file.endsWith(".html") && file !== "guides.html")
        files.push(dir + "/" + file);
  for (const file of files) {
    const d = new JSDOM(fs.readFileSync(file, "utf8")).window.document;
    const footer = d.querySelector("footer.site-footer");
    assert.ok(footer, file);
    assert.ok(footer.querySelector('a[href="/learning"]'), file);
    assert.ok(footer.querySelector('a[href="/learning/roadmap"]'), file);
    assert.ok(!footer.querySelector('a[href*="newsletter"]'), file + " still links the newsletter");
  }
  assert.equal(
    fs.readFileSync("tools/site-footer.html", "utf8"),
    fs.readFileSync("functions/site-footer.fragment", "utf8"),
  );
});
test("Preview paths cannot bypass private deploy exclusions using dot segments", () => {
  const r = require("./hosting_router")(process.cwd());
  for (const route of ["/assets/../tools/qa.py", "/assets/../functions/index.js", "/assets/../supabase/00_schema_migrations.sql", "/tools/qa.py", "/package.json", "/../.git/config"])
    assert.equal(r.resolve(route).type, "notfound", route);
  assert.equal(r.resolve("/assets/js/main.js").type, "file");
});
test("Admin-only PDF CSP does not broaden public worker permissions", () => {
  const { headersFor } = require("./hosting_router")(process.cwd());
  for (const route of ["/Anony.su", "/Anony.su/", "/Anony.su/index.html"]) {
    assert.match(headersFor(route)["content-security-policy"], /worker-src 'self' blob:/);
    assert.match(headersFor(route)["content-security-policy"], /img-src 'self' data: blob:/);
    assert.equal(headersFor(route)["cache-control"], "no-store");
  }
  assert.doesNotMatch(headersFor("/")["content-security-policy"], /worker-src|unsafe-eval/);
  assert.equal(headersFor("/checker")["cache-control"], "no-cache");
});
console.log(`\n${n} site-wide publishing/privacy contracts passed.`);
