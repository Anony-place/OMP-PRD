# OopsMyPassword: Firebase Hosting → Vercel Migration Plan (SEO-safe)

> Status: **PLAN ONLY** — koi config change nahi kiya gaya. Ye document padho, decision lo, phir Phase 2 ke files banaunga.
> Repo audit date: 2026-11-01 · Site: `https://oopsmypassword.web.app` · Project: `password-e9a30` (Spark) · Vercel team: `aka-su` (Hobby)
>
> **UPDATE 2026-11-01 — budget ₹0, domain nahi:** abhi migrate mat karo. Sitemap issue hosting ka nahi hai (live audit §14). ₹0 path aur free options **§13** me hain.

---

## 0. TL;DR (3 line answer)

1. **Ranking/authority hosting se nahi, URL (domain) se bandhi hoti hai.** Same URL + naya host = SEO impact practically zero. URL badla = site migration = 301 + Search Console Change of Address + 4–12 hafte ki volatility.
2. Isliye **host change aur domain change ek hi din mat karo.** Pehle domain le lo (`oopsmypassword.com`), Firebase par hi 301 se migrate karo, 4–6 hafte ruko, **phir** DNS ko Vercel par point karo. Us second step me URL same rehta hai → ranking/indexing ko haath nahi lagta.
3. Agar domain nahi loge aur `*.vercel.app` par jaoge → ye **forced second migration** hai, aur tumhare account me 2 extra blockers hain: **Hobby plan commercial use allow nahi karta (site par AdSense hai)** aur **Deployment Protection on hone par `.vercel.app` URL Googlebot ko login page dikhayega**. Details §3.

---

## 1. Reality check: hosting change vs domain change

| Scenario | URL | Google ke liye kya hai | Ranking risk |
|---|---|---|---|
| **A.** Same domain, host Firebase → Vercel | `oopsmypassword.com/...` same | Same URL, bas server badla | ~0. Sirf 1–2 hafte ka minor wobble (TTFB / CDN / config galti) |
| **B.** Domain `web.app` → `vercel.app` | URL badla | **Site migration** — naya host, purane backlinks purane host par | High: 2–6 hafte dip, 8–12 hafte recovery |
| **C.** Domain `web.app` → custom `.com` (host same ya baad me) | URL badla ek baar | Site migration, but **ek hi baar** aur controlled | Medium: same as B, but permanent gain |
| **D.** Host + domain ek saath, 301 ke bina | URL badla | **Brand new site** | Catastrophic — 3–6+ months, purana ranking gone |

**Important:** `oopsmypassword.web.app` Google ka owned domain hai, tumhara nahi. Vercel us URL ko serve **nahi kar sakta**. Matlab option A directly possible nahi hai — ek URL change **compulsory** hai (either `.vercel.app` or custom domain). Choice sirf ye hai: **ek baar** badlo ya **do baar**.

### Recommendation
> **Do-step migration.**
> **Step 1 (Week 0):** custom domain `oopsmypassword.com` (ya jo bhi final ho) buy karo → **Firebase Hosting** par point karo → `web.app` se 301 + GSC Change of Address.
> **Step 2 (Week 4–6):** same domain ka DNS **Vercel** par shift karo. URL 100% same → zero SEO work.
>
> Reason: ek hi din me domain + host badalne par agar traffic gire to pata hi nahi chalega ki DNS ka issue tha, Vercel routing ka, ya 301 ka — aur rollback bhi do jagah karna padega.

---

## 2. Tumhare Vercel account ka actual status (maine check kiya)

| Item | Status | Iska matlab |
|---|---|---|
| Team | `aka-su` | — |
| Plan | **Hobby (free)** | Fair-use: **non-commercial only**. Site par `ads.txt` (AdSense pub-5826652112388036) hai = commercial → **Vercel Pro ($20/mo) chahiye**, warna policy violation par project pause ho sakta hai |
| Projects | `wiyc`, `ihavetools`, `ai`, … | OMP ka koi project **nahi** bana abhi |
| **Domains** | **0 (koi custom domain attach nahi)** | Domain pehle lena padega — Vercel free subdomain hi milega |
| `ihavetools` project setting | `ssoProtection: all_except_custom_domains` | Isi team default se naye project par bhi **Vercel Authentication ON** aa sakta hai → `*.vercel.app` URL par Googlebot ko **401 login wall** milega, indexing impossible. Naye project me ise **OFF** karna hai |
| Bandwidth | 100 GB/mo (Hobby) | 13 MB site, mostly text assets → theek hai, but Pro par 1 TB milta hai |

**Agar $20/month nahi dena:** Cloudflare Pages free plan commercial allowed + unlimited static requests. Same `vercel.json` jaisa config (`_headers` / `_redirects`) chalta hai. Plan B ke roop me rakho — baaki poora plan same rehta hai.

---

## 3. Repo audit: Vercel par kya-kya tootega (yehi "issue" aayenge)

### 🔴 Landmine #1 — `package.json` me `vercel-build` script hai jo Firebase deploy karta hai
`OMP-PRD-main/package.json`:
```json
"scripts": {
  "vercel-build": "npx --yes firebase-tools@latest deploy --only hosting --project oopsmypassword --non-interactive"
}
```
Vercel build ke waqt `vercel-build` ko build command ki tarah uthata hai. Result: Vercel ke andar se Firebase deploy chalega (credentials nahi honge → build fail, ya random behaviour). **Isko delete karna hai** aur Vercel project me build command explicitly empty/`echo skip` set karna hai.

### 🔴 Landmine #2 — `firebase.json` ka `ignore` array Vercel par kaam nahi karta
Vercel **poora project root serve karta hai**. Bina `.vercelignore` ke ye live chala jayega:
`tools/` (47 files, internal QA + admin harnesses) · `supabase/` (21 `.sql` migrations + edge functions) · `functions/` · `scripts/` · 18 `.md` files · `.claude/mcp.json` · `firebase.json` / `.firebaserc`.
Ye sab crawl/index ho sakta hai. **`.vercelignore` mandatory hai** (§7 me ready content).

### 🟠 Landmine #3 — 124 redirects, 2 regex redirects, 15 rewrites, 29 header blocks
Vercel aur Firebase ka syntax alag hai:

| Firebase (`firebase.json`) | Vercel (`vercel.json`) |
|---|---|
| `"source": "/foo.html", "type": 301` | `{"source": "/foo.html", "destination": "/bar", "statusCode": 301}` |
| `"source": "/foo{,/**}"` (brace glob) | **Do rules**: `/foo` + `/foo/:path*` |
| `"source": "/@(a\|b\|c)"` (extglob) | Inline regex ya har page ke liye alag rule (converter script se) |
| `"source": "/articles/**"` | `"/articles/:path*"` |
| `"source": "/**"` | `"/(.*)"` |
| `"regex": "/guides/(.*)\\.html"` | `"source": "/guides/:slug"` (cleanUrls ke saath `.html` nahi likhte) |
| `"destination": "/guides/x.html"` (rewrite) | `"destination": "/guides/x"` (cleanUrls on → extension hatao, warna 404) |
| `"type": 301` | `"permanent": true` (=308) ya `"statusCode": 301`. Dono permanent hain, Google dono ko same treat karta hai |
| `ignore: [...]` | `.vercelignore` |
| `cleanUrls: true` / `trailingSlash: false` | **same naam, same behaviour** ✅ |

Redirect count limit: Vercel `vercel.json` me ~1024–2048 entries allow karta hai — 124 comfortably fit.

### 🟠 Landmine #4 — `cleanUrls` khud 308 redirect deta hai
Vercel `cleanUrls: true` par `/checker.html` → `/checker` **308**. Firebase bhi 301 deta tha. Matlab `firebase.json` ke jo redirects `.html` source par hain (jaise `/guides.html` → `/articles`), wo Vercel par **chain** ban sakte hain: `/guides.html` → 308 → `/guides` → 301 → `/articles`. Chain Google ke liye OK hai but slow; isliye **dono variants define karo** (source me `/guides.html` aur `/guides` dono — `firebase.json` already aisa karta hai).

### 🟠 Landmine #5 — path preserve hone chahiye, warna 404 flood
Site ka poora URL space (297 sitemap URLs) **same paths** rakhta hai. Isliye per-URL 301 map ki zaroorat nahi — **ek host-level wildcard 301** kaafi hai. Lekin purane 124 redirects (jaise `/guides/*` → `/articles/*`) **naye host par bhi** port karne padenge, warna wo URLs 404 ho jayenge aur permanently loss.

### 🟡 Landmine #6 — Service Worker (`sw.js`)
Purane origin par installed SW `network-first` hai but navigation response ko intercept karta hai. 301 ke baad user ka address bar purana URL hi dikhata rahega (SW redirect follow karke content naya de dega). Fix: cutover ke baad old host par **kill-switch `sw.js`** deploy karo jo `self.registration.unregister()` + `caches.delete()` kare.

### 🟡 Landmine #7 — IndexNow key file host-bound hai
`018a42cd0f172a9604f172cecf80751d.txt` root me hai. Naye host par key file phir se serve honi chahiye + Bing Webmaster me naya host verify karke IndexNow resubmit karna hoga. (CI already `SITE_ORIGIN` se host derive karta hai — sirf env badalna hai.)

### 🟡 Landmine #8 — Google Search Console verification token property-bound hai
108 pages par `<meta name="google-site-verification" content="ilff-p9F...">`. Ye **`https://oopsmypassword.web.app` URL-prefix property** ko verify karta hai — naye domain ko **nahi**. Naye domain ke liye **Domain property (DNS TXT)** banao; wo host change hone par bhi valid rehti hai. (Domain property me http/https + saare subdomains automatically cover ho jaate hain.)

### 🟡 Landmine #9 — 300 files me purana origin hardcoded
303 HTML + JS + `sitemap.xml` (297 URLs) + `robots.txt` + `rss.xml` + `llms.txt` + `.well-known/security.txt` + JSON-LD `@id`/`sameAs` — sab me `https://oopsmypassword.web.app`.
Existing script `scripts/fix-site-origin.mjs` isi kaam ke liye hai, but usme `OLD_ORIGIN === NEW_ORIGIN` (dono web.app) — migration me `NEW_ORIGIN` update karna hoga, phir poora build dobara chalana hoga.
Single switch points (achhi news): `SITE_ORIGIN` env → `tools/omp_build/layout.py`, `scripts/build-static-seo.mjs`, `scripts/verify-seo.mjs`, GitHub workflow.

### 🟡 Landmine #10 — SEO gate `firebase.json` padhta hai, `vercel.json` nahi
`scripts/verify-seo.mjs` → `tools/hosting_router.js` → `firebase.json`. Migration ke baad CI jo verify karega wo **ship nahi ho raha hoga**. Isliye ek `vercel_router`/parity test chahiye (§9).

---

## 4. Phase-wise plan (calendar)

### Phase 0 — Baseline lock (Day −14)
- [ ] GSC → Performance → **16 months data export** (Queries + Pages), aur `Links` report ka backlink list CSV.
- [ ] Ahrefs/Moz/SimilarWeb se **DR/DA + top 20 keywords with position** ka screenshot (free tools se bhi ho jayega).
- [ ] `sitemap.xml` ki copy + `curl -s https://oopsmypassword.web.app/robots.txt` snapshot — ye "before" state hai, migration ke baad isse compare karna hai.
- [ ] **297 URLs ka expected-status table** generate karo (`tools/hosting_router.js` se — Firebase routing ke hisaab se kaunsa URL 200/301/kya).
- [ ] Supabase publishable key / articles DB waisa hi rahega — koi change nahi.

### Phase 1 — Domain decide karo (Day −10)
- [ ] Domain buy (Cloudflare Registrar / Namecheap). Apex = `oopsmypassword.com` recommend; `www` ko 308 → apex.
- [ ] **GSC Domain property** banao, DNS **TXT** record se verify (host change proof).
- [ ] **AdSense** → Sites → naya domain add; `ads.txt` root me already hai (same publisher ID).
- [ ] DNS TTL abhi se **300s** kar do (cutover par 24–48 ghante lagne se bachne ke liye).

### Phase 2 — Step 1: domain migrate karo, hosting **Firebase hi rakho** (Day −7 → 0)
- [ ] Firebase Hosting → Add custom domain → DNS records (A/TXT) → SSL provision.
- [ ] `SITE_ORIGIN=https://oopsmypassword.com` se poora build chalao → sitemap/canonical/JSON-LD sab naye domain par.
- [ ] `firebase deploy --only hosting` (naya domain live, `web.app` bhi abhi live).
- [ ] **`web.app` par wildcard 301** lagao (Firebase redirects static files se **pehle** evaluate hote hain, isliye site ko delete karne ki zaroorat nahi):
```json
{ "regex": "/(?P<path>.*)", "destination": "https://oopsmypassword.com/:path", "type": 301 }
```
  ⚠️ RE2 me lookahead nahi hota, isliye exclusions regex se possible nahi. Practical approach: `sw.js` + `google*.html` verification file ko alag se handle karo (kill-switch SW niche diya hai), ya un dono ke liye redirect ke **pehle** matching `source` rule na banao — Firebase me "exclude" ka koi tareeka nahi hai, so accept karo ki purane host se sab 301 hoga.
- [ ] GSC → Settings → **Change of Address** → `web.app` property → `.com` property submit (301s live hone ke **baad** hi).
- [ ] Naye domain par `sitemap.xml` submit + top 10 URLs par **URL Inspection → Request indexing**.

### Phase 3 — Step 2 ki tayyari, Vercel par staging (Day −7 → −1, parallel)
- [ ] Vercel project banao: **Root Directory = `OMP-PRD-main`**, Framework = **Other**, Build Command = **empty/`echo skip`**, Output Directory = `.`
- [ ] **Deployment Protection = OFF** (warna Googlebot ko 401 milega).
- [ ] `vercel.json` generate karo `firebase.json` se (converter script — §6).
- [ ] `.vercelignore` add karo (§7).
- [ ] Temporary `*.vercel.app` host par **`X-Robots-Tag: noindex`** (jab tak custom domain attach nahi hota) — warna dono URL index ho kar duplicate content ban jayega:
```json
{ "source": "/(.*)", "has": [{ "type": "host", "value": "omp-prd.vercel.app" }],
  "headers": [{ "key": "X-Robots-Tag", "value": "noindex, nofollow" }] }
```
- [ ] **Parity test** chalao: 297 URLs + 124 purane redirect URLs + 20 random 404s → Firebase live vs Vercel staging, status code aur final destination compare. Diff = 0 hone tak cutover nahi.

### Phase 4 — Cutover (Day 0, low-traffic window; Step 1 ke 4–6 hafte baad)
- [ ] Final build + `firebase deploy` (backup: Firebase deployment abhi bhi live rakho — instant rollback).
- [ ] DNS → Vercel (`A 76.76.21.21` apex, `CNAME cname.vercel-dns.com` www).
- [ ] **URL same hai** → koi 301, koi resubmission, koi change of address nahi chahiye. Bas verify karo (Phase 5).
- [ ] 24 ghante Firebase deploy ko touch mat karo (rollback ke liye).

### Phase 5 — Cutover verification (Day 0, 2–3 ghante)
```bash
# status + final URL
for p in / /checker /articles /guides/how-long-should-a-password-be /sitemap.xml /robots.txt; do
  curl -sIL -A 'Googlebot/2.1 (+http://www.google.com/bot.html)' "https://oopsmypassword.com$p" | head -1
done
# headers: x-robots-tag nahi hona chahiye production domain par
curl -sI https://oopsmypassword.com/ | grep -i -E 'x-robots|content-type|cache-control|strict-transport'
# sitemap Googlebot ke liye 200 + application/xml
curl -sI -A 'Googlebot/2.1' https://oopsmypassword.com/sitemap.xml
# redirect parity (purane redirect abhi bhi kaam karein)
curl -sI https://oopsmypassword.com/guides.html | grep -i -E '^HTTP|location'
```
- [ ] GSC → naya sitemap dobara submit (domain property).
- [ ] GSC → URL Inspection → `/`, `/checker`, `/generator`, `/tools`, 1 article, 1 guide → Request indexing.
- [ ] `https://oopsmypassword.web.app` → `.com` 301 confirm (Step 1 wala redirect abhi bhi zinda).
- [ ] Old origin par **kill-switch service worker**:
```js
/* old host sw.js — 1 line ka purpose: khud ko uninstall karo */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  await self.registration.unregister();
  for (const k of await caches.keys()) await caches.delete(k);
  const cs = await self.clients.matchAll({ type: 'window' });
  cs.forEach(c => c.navigate(c.url));   // ek baar reload → 301 follow ho jayega
})()));
```

### Phase 6 — Monitor (Day +1 → +30)
Daily 5 min: GSC → **Pages/Indexing** (naye 404/5xx/redirect errors), **Performance** (clicks/impressions vs baseline), Vercel → **Deployments + Analytics/Logs** (5xx), Cloudflare/DNS health.
- [ ] Day +3: backlinks update — GSC Links export me se top 20 referring pages/domains, jahan control hai (profile, directory, GitHub, social) wahan URL update.
- [ ] Day +7: AdSense earnings/impressions compare (ads.txt crawl ho raha hai ya nahi).
- [ ] Day +14: Core Web Vitals field data check (CrUX) — Vercel CDN se TTFB improve hona chahiye.
- [ ] Day +30: agar sab green → Firebase project ko **delete mat karo**, sirf "no new deploys" mode me chhodo (Step 1 ka 301 chalta rahe).

### Phase 7 — Cleanup (Day +90 → +365)
- [ ] 301s **kam se kam 12 mahine** rakho (Google ki official guidance: "as long as possible, at least a year").
- [ ] 12 mahine baad `google-sitemap.xml` mirror, `web.app` redirect, purani verification token — tab decide karo.
- [ ] `firebase.json` ko repo me historical reference ke roop me rakh do, lekin **single source of truth = `vercel.json`** ho.

---

## 5. 301 redirect strategy — "kaise hoga" ka exact answer

### 5.1 Do bilkul alag redirect layers hain, inhe mix mat karo

| Layer | Kab | Kahan likhna hai | Kya karta hai |
|---|---|---|---|
| **L1: Host-level 301** | Sirf jab **hostname badle** (web.app → naya domain) | **Firebase** `firebase.json` (purane host par) | Purane host ki har URL ko naye host ki **same path** par bhejta hai |
| **L2: Path-level 301** | Dono hosts par (already existing) | `firebase.json` → baad me `vercel.json` | `/guides.html` → `/articles`, `/blog` → `/articles` etc. (124 rules) |
| **L3: cleanUrls 308** | Automatic | Vercel/Firebase | `/checker.html` → `/checker`, trailing slash hatao |

Agar URL same raha (two-step plan) → **L1 ki zaroorat hi nahi**, sirf L2 + L3 port karne hain. Yehi "zero SEO risk" wali situation hai.

### 5.2 L1 — Firebase par whole-site 301 (RE2, no lookahead)
```json
"redirects": [
  { "regex": "/(?P<path>.*)", "destination": "https://oopsmypassword.com/:path", "type": 301 }
]
```
Firebase docs: redirects `source`/`regex` ko **har request par sabse pehle** check karta hai, filesystem se pehle. Isliye site ko Firebase par deployed rakho — files chahiye hi nahi redirect ke liye.

### 5.3 L2 — 124 redirects ka Firebase → Vercel conversion (koi rule drop nahi)
Sabse bada risk yehi hai: ek bhi rule chhoot gaya to wo URL pada hua traffic kho dega. Isliye **manual copy nahi**, converter script:
`scripts/build-vercel-config.mjs` (banana hai):
1. `firebase.json` padho (source of truth jab tak migration complete na ho).
2. Har redirect/rewrite/header ko Vercel syntax me expand karo (brace globs → 2 rules, `@(a|b)` → per-page rules).
3. `vercel.json` likho; **count assert** karo (`redirects: 124`, `rewrites: 15`, `headers: 29`) — mismatch par exit 1.
4. CI me add karo: `node scripts/build-vercel-config.mjs --check` (agar generated ≠ committed → fail). Isse dono configs drift nahi karenge.

### 5.4 Status code choice
- `"permanent": true` → **308**. Google 308 ko 301 jaisa permanent treat karta hai (method + body preserve karta hai). Modern + simplest.
- `"statusCode": 301` → literal 301, agar tum purane behaviour se byte-identical rehna chahte ho.
- **Kabhi 302/307 use mat karo** permanent move ke liye, aur **kabhi JS/meta-refresh redirect mat lagao** — Google 90%+ cases me JS redirect ko ignore karta hai.

---

## 6. Firebase → Vercel config: cheatsheet

```jsonc
// vercel.json  (OMP-PRD-main/ root me)
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "cleanUrls": true,          // firebase cleanUrls: true  → same
  "trailingSlash": false,     // firebase trailingSlash: false → same
  "buildCommand": "echo skip", // Landmine #1
  "redirects": [
    { "source": "/blog",     "destination": "/articles", "statusCode": 301 },
    { "source": "/blog.html","destination": "/articles", "statusCode": 301 },
    { "source": "/guides",   "destination": "/articles", "statusCode": 301 },
    { "source": "/guides.html","destination": "/articles","statusCode": 301 },
    { "source": "/guides/:slug", "destination": "/articles/:slug", "statusCode": 301 }
    // …baaki 119 redirects converter se, count-matched
  ],
  "rewrites": [
    // cleanUrls on hai to destination me .html NAHI likhna (Landmine #4)
    { "source": "/articles/create-strong-password", "destination": "/guides/create-strong-password" }
    // …15 total
  ],
  "headers": [
    { "source": "/(.*)", "headers": [
      { "key": "X-Content-Type-Options", "value": "nosniff" },
      { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
      { "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains; preload" }
      // firebase ke `**` wale 9 headers, same order
    ]},
    { "source": "/sitemap.xml", "headers": [
      { "key": "Content-Type", "value": "application/xml; charset=UTF-8" },
      { "key": "Cache-Control", "value": "public, max-age=300" }
    ]},
    { "source": "/Anony.su/:path*", "headers": [
      { "key": "X-Robots-Tag", "value": "noindex, nofollow, noarchive" },
      { "key": "Cache-Control", "value": "no-store" }
    ]}
  ]
}
```

Notes jo test me already fail ho chuke hain:
- **Rewrites me `.html` extension + `cleanUrls: true` = 404.** Ye Vercel community ka #1 gotcha hai.
- `headers` ke andar `**/*` (glob) nahi chalta → `/(.*)` ya `/:path*`.
- `404.html` automatically 404 page ban jaata hai Vercel par — extra config nahi chahiye (status **404** hi rehta hai, 200 nahi).
- `.well-known/security.txt` Firebase par `**/.*` ignore ki wajah se **kabhi live hi nahi hua**; Vercel par ho jayega — intentional hai to rakh lo, warna `naye` behaviour ka dhyan rakho.

---

## 7. `.vercelignore` (ready to paste)

```gitignore
# parity with firebase.json "ignore" + extras that must never be public
firebase.json
.firebaserc
.claude/
.github/
tools/
scripts/
supabase/
functions/
**/*.md
**/__pycache__/
**/node_modules/
package.json
package-lock.json
.env
.env.*
```
⚠️ `**/.*` **mat** likhna — wo `.well-known/` bhi uda dega.

---

## 8. Crawl + indexing checklist (live hone ke baad)

| # | Check | Expected |
|---|---|---|
| 1 | `curl -sI -A 'Googlebot/2.1' https://<domain>/` | `200`, no `x-robots-tag: noindex` |
| 2 | `/sitemap.xml` | `200`, `application/xml` |
| 3 | `/robots.txt` | `200`, `Sitemap:` me **naya** domain |
| 4 | `view-source` → canonical / og:url / JSON-LD | Sab naya domain |
| 5 | `/guides.html` | `301 → /articles` (ek hi hop ideally) |
| 6 | `/checker.html` | `308 → /checker → 200` |
| 7 | random `/xyz-not-real` | `404` + custom 404 page, noindex |
| 8 | old domain | `301 → naya domain` (same path) |
| 9 | GSC Domain property | Verified, sitemap "Success", Coverage me 5xx = 0 |
| 10 | AdSense | Site added, `ads.txt` `200` on new domain |
| 11 | Bing Webmaster | Naya host added + IndexNow `200/202` |
| 12 | CrUX / PageSpeed | TTFB Firebase se better ya equal |

**Kya nahi karna:**
- ❌ Purane domain par site ko **live** chhodna (301 ke bina) — duplicate content, Google khud decide karega kaunsa rank kare.
- ❌ 301 hata dena "kyunki traffic gir gaya" — recovery 4–8 hafte lagti hai, 3 din me judge nahi karte.
- ❌ 297 URLs par ek saath "Request indexing" thokna — rate limit, aur Google ko natural crawl signal chahiye. Top 10 kaafi.
- ❌ `trailingSlash` ya `cleanUrls` ko cutover ke saath badalna — ek waqt me ek hi cheez badlo.
- ❌ Firebase project delete karna — 12 mahine tak rollback aur L1 301 dono isi par depend karte hain.

---

## 9. Ranking & authority — realistic expectation

| Metric | Same-URL host move (recommended) | Domain move with 301 |
|---|---|---|
| Indexed pages | Same | 1–3 hafte me reindex |
| Clicks/impressions | ±0–2% (1–2 hafte) | 2–6 hafte me 5–15% dip, 8 hafte me ~90–100% recovery |
| Keyword positions | Stable | Top 3 keywords jaldi recover, long-tail slow |
| "Authority" (DR/DA, site-level trust) | **Unchanged** — domain se bandhi hai | 301 se ~equity transfer hota hai, but **backlinks purane domain par point karte hain** → jitne update karoge utna better |
| Permanent loss risk | Practically zero | Sirf agar: 301 nahi lagaya / 302 lagaya / old site live chhoda / redirects 1 mahine me hata diye |

**Authority ka funda:** DA/DR/Google ka site-level trust **hostname** par hota hai, server par nahi. Isliye same domain + naya host = authority untouched. Naya hostname = naya bucket, jisme 301 ke through equity aati hai, but purane backlinks ka weight tab tak split rehta hai jab tak links update nahi hote.

---

## 10. Rollback plan

| Kab | Kya karo | Time |
|---|---|---|
| Cutover ke 24h andar kuch bhi galat | DNS wapas Firebase IPs par | ~5 min + TTL |
| Routing/redirect bug | Firebase deployment abhi live hai → DNS revert | 5 min |
| 2–7 din baad SEO dip | Pehle GSC Coverage report dekho (status codes), phir Vercel logs; revert tab hi jab 5xx/404 spike ho | — |
| AdSense/ads issues | ads.txt + AdSense site re-verify; ads revenue temporary dip normal hai | — |

---

## 11. Cost & effort

| Item | Cost |
|---|---|
| Domain (`.com`) | ~₹900–1,300/year |
| Vercel **Pro** (AdSense = commercial) | $20/month |
| Vercel Hobby (agar non-commercial rehna ho) | $0 — but policy risk |
| Engineering time | Step 1: ~1 din · Step 2 (config + parity): ~2 din · Monitoring: 30 days × 5 min |

---

## 12. Next step — jo main abhi bana sakta hoon (bolo, order me)

1. `scripts/build-vercel-config.mjs` — `firebase.json` → `vercel.json` converter with count assertion (124/15/29).
2. `OMP-PRD-main/vercel.json` — generated, reviewed, ready to deploy.
3. `OMP-PRD-main/.vercelignore` + `package.json` se `vercel-build` hatana.
4. `scripts/verify-vercel-parity.mjs` — Firebase live vs Vercel staging: 297 + 124 + 20 URLs ka status-code diff.
5. `fix-site-origin.mjs` + workflow `SITE_ORIGIN` ko naye domain par switch (rebuild ke saath, 300 files rewrite).
6. Old-host kill-switch `sw.js` + `firebase.json` wildcard 301 block.

**Do jawab chahiye tabhi aage badhunga:**
- (a) `oopsmypassword.com` tumhare paas hai ya naya domain lena hai?
- (b) Vercel **Pro** ($20/mo) theek hai, ya Hobby/Cloudflare Pages route chahiye?

---

## 13. ₹0 budget path (domain nahi, Vercel ke paise nahi)

### Verdict: **abhi migrate mat karo.**

| Reason | Detail |
|---|---|
| Sitemap issue hosting ka nahi hai | Live sitemap 200 + valid hai (§14). Vercel par shift karne se wahi GSC problem saath aayegi |
| Domain ke bina = SEO migration, zero upside | `web.app` → `*.vercel.app` = naya hostname = 2–6 hafte dip, backlinks split, AdSense re-review |
| Vercel Hobby par AdSense = policy violation | Hobby "non-commercial only". Ads.txt hai → Pro ($20) warna project pause ka risk |
| Firebase free me abhi sab chal raha hai | Hosting + SSL + CDN, ₹0. Sitemap static file hai, valid hai |

Migrate **tab** karo jab: (a) ₹900 ka domain ho jaye, **ya** (b) Firebase ka **360 MB/day** transfer cap hit hone lage (din me site down / 503 aane lage).

### Free host comparison (agar bandwidth hi problem hai)

| Host | Bandwidth | Commercial (AdSense) | Free URL |
|---|---|---|---|
| Firebase Spark | **360 MB/day**, 10 GB storage | ✅ allowed | `*.web.app` |
| Vercel Hobby | 100 GB/month | ❌ **not allowed** | `*.vercel.app` |
| Cloudflare Pages | **unlimited requests/bandwidth** | ✅ allowed | `*.pages.dev` |

→ **Agar Firebase ka daily cap trouble kar raha hai to Vercel nahi, Cloudflare Pages** lo: free, unlimited, AdSense allowed, aur `_headers` / `_redirects` file format me wahi routing port ho jayegi. URL phir bhi badlega (`*.pages.dev`), isliye §4–§5 wala 301 plan waisa hi lagega.

### Free "domain" options (agar bilkul ₹0 aur URL sudharna hai)

| Option | Kaise milta hai | Caveat |
|---|---|---|
| `is-a.dev` | GitHub PR → `tumhara-naam.is-a.dev` | personal/dev sites ke liye, manual approval, apex kisi aur ka |
| `eu.org` | free subdomain registry | approval **weeks–months**, phir bhi `/` control limited |
| `js.org` | GitHub PR | sirf JS projects/docs ke liye |

**AdSense reality check:** free subdomain par naya site add + review hota hai aur approval guaranteed nahi. Agar AdSense abhi `web.app` par approved hai, hostname badalne par **naya site add + re-review** lagega — revenue at risk.

### Aaj ₹0 me jo actual SEO value ban sakti hai

1. GSC property + sitemap **Success** (§14) — sabse pehle yahi.
2. Bing Webmaster Tools me site add + IndexNow (CI already karta hai).
3. **Content + internal linking** — ranking ka 80% yahi hai, hosting ka 0%.
4. Core Web Vitals: image compression, unused JS, font preload.
5. Backlinks: GitHub profile, dev.to, Medium, Quora, Reddit (jo chalega) — jab domain ho tabhi kaam aayega, par profile abhi bana lo.

---

## 14. Sitemap / Search Console issue: live diagnosis + fix

### Live audit (maine 2026-11-01 ko check kiya)

| Check | Result |
|---|---|
| `https://oopsmypassword.web.app/sitemap.xml` live | **200 OK** ✅ |
| URLs | 297, **0 duplicate** ✅ |
| Host consistency | sab `https://oopsmypassword.web.app` ✅ |
| `http://` / `.html` / trailing-slash entries | 0 ✅ |
| Sitemap me aise URLs jo 301 karte hain | **0** ✅ |
| Sitemap me `noindex` pages | 0 ✅ |
| Canonical vs sitemap URL mismatch | 0 ✅ |
| `<lastmod>` format | valid (220 URLs par lastmod nahi hai — **warning only**, optional field) |
| 15 `/articles/<slug>` ka `.html` file nahi | ✅ false alarm — wo `firebase.json` rewrites se `/guides/<slug>.html` serve hote hain |
| `robots.txt` | 200, sitemap advertise kar raha hai ✅ |

**Matlab: sitemap technically perfect hai. Problem hosting/Spark plan me nahi, Search Console side par hai.**

### "Firebase free plan me sitemap issue hota hai" — evidence-based correction

> ⚠️ **Correction (2026-11-01):** pehle maine ise "myth" likha tha. Research ke baad: **issue REAL hai aur 4+ saal se persistent hai** — lekin wo **free *plan*** ka nahi, **free *hostname* (`*.web.app`)** ka hai. Full evidence + fix: **§15**. Yahan neeche wali baat sirf *function-rewrite wale sitemap* ke liye sach hai.

Spark plan me **Cloud Functions nahi chalte**. Agar sitemap kisi function rewrite se serve ho raha ho (`/sitemap.xml → functions.sitemap`), to Spark par wo 404 dega → GSC "Couldn't fetch". **Tumhare repo me exactly yahi hua tha**, aur fix pehle se hai: `SEO-DEPLOY-NOTES.md` kehta hai sitemap ek **baked static file** hai, function rewrite nahi.

Aaj sitemap static hai → free plan se koi lena-dena nahi. ✅

### "Couldn't fetch" ke asli causes (priority order)

1. **Property mismatch** — sitemap `oopsmypassword.com` property par submit hua hai. Us apex ka **DNS record hi nahi** hai, isliye Google fetch hi nahi kar sakta. (Tumhare `SEO-DEPLOY-NOTES.md` me ye already likha hua hai.)
2. **Purane stale submissions** — `…cloudfunctions.net/sitemap`, `google-sitemap.xml`, `http://` variant, ya expired `.com` URL.
3. **Property verify nahi / verification lapse**.
4. **Spark ka 360 MB/day cap cross** → Hosting 503 deta hai → Google ka fetch fail (ye ek hi case hai jahan "free plan" sach me involved ho sakta hai).

### Fix — step by step (15 min, ₹0)

1. GSC kholo → top-left **property dropdown**. Agar `oopsmypassword.com` ya `sc-domain:oopsmypassword.com` selected hai → **wo band karo**, us property par kuch bhi submit karna waste hai.
2. **Add property → URL prefix** → exactly ye daalo: `https://oopsmypassword.web.app/`
3. **Verify** → "HTML tag" method → Google jo `<meta name="google-site-verification" …>` dega. Tumhare 108 pages par pehle se `ilff-p9F52ymQPjAUhrWXMh2zidY67vxMIp0QskcbfY` laga hua hai — agar wahi token hai to seedha **Verify** dabao. (Naya token aaye to `tools/omp_build/layout.py` me `SITE` ke paas wala meta update karke rebuild + `firebase deploy --only hosting`.)
4. **Sitemaps** → purani entries **delete** karo (`.com`, `http://`, `cloudfunctions.net`, `google-sitemap.xml`).
5. **Add a new sitemap** → `sitemap.xml` → Submit. (Full URL bhi paste kar sakte ho, but URL-prefix property ke andar hi hona chahiye.)
6. 24–72 ghante wait. Status **Success** + "Discovered URLs: 297" dikhna chahiye.
7. Phir **URL Inspection** → `/`, `/checker`, `/generator`, `/tools`, 1 article, 1 guide → **Request indexing** (5–10 din me, bulk mat karo).
8. **Indexing → Pages** report me ye dekhna: `Page with redirect`, `Excluded by noindex`, `Not found (404)`, `Server error (5xx)`. 5xx aaye = Spark bandwidth cap ka signal.

### Agar error message alag hai

| GSC message | Matlab | Fix |
|---|---|---|
| **Couldn't fetch** | property/URL mismatch, DNS dead, ya 503 | Step 1–5; `curl -sI -A 'Googlebot/2.1' …/sitemap.xml` se 200 confirm |
| **Sitemap could not be read** | Google ko XML nahi, HTML/404 mila | `Content-Type: application/xml` header check karo (firebase.json me set hai) |
| **Sitemap is HTML** | `/sitemap.xml` par 404 page serve ho raha hai | file deploy hui hai ya nahi (`ls sitemap.xml` + `curl`) |
| **URLs not allowed** | sitemap property ke scope se bahar | property ke andar wala exact URL submit karo |
| **Sitemap contains 404s** | kuch URLs missing | `./scripts/deploy.sh` ka consistency step chalta hai — jo URL sitemap me hai uski file honi chahiye |
| **Pages with redirect** in sitemap | sitemap me purane 301 URLs | aaj 0 hain ✅ |

### Self-check commands (apne laptop par)

```bash
# 1. Googlebot ko kya milta hai
curl -sI -A 'Googlebot/2.1 (+http://www.google.com/bot.html)' https://oopsmypassword.web.app/sitemap.xml
# expect: HTTP/2 200 + content-type: application/xml

# 2. XML valid hai?
curl -s https://oopsmypassword.web.app/sitemap.xml | python3 -c "import sys,xml.etree.ElementTree as E; r=E.fromstring(sys.stdin.read()); print('urls:', len(r))"

# 3. robots.txt sitemap advertise kar raha hai?
curl -s https://oopsmypassword.web.app/robots.txt | grep -i sitemap
```

---

## 15. `*.web.app` sitemap issue — research verdict (maine khud verify kiya)

### 15.1 Verdict: issue REAL hai, lekin "free plan" nahi — "free hostname" hai

| Claim | Verdict | Evidence |
|---|---|---|
| "Firebase free plan se hosting me sitemap issue hota hai" | ⚠️ **Aadha sach** — plan se nahi, **hostname** se hota hai | Neeche 4 independent sources |
| "Ye permanent hai" | ✅ **Practically haan** — 2021 se 2025 tak same reports, Google ne kabhi fix/document nahi kiya | r/Firebase 2021 + 2025 |
| "Vercel par shift karne se fix ho jayega" | ❌ **Nahi** — kisi ne ye prove kiya hai ki platform change se fix nahi hota | dev.to case study (§15.4) |
| "Iska matlab site index nahi hoti" | ❌ Nahi — tumhara homepage **index hai** (§15.2) | `site:` search |

### 15.2 Tumhare site ka actual status (aaj check kiya)

| Test | Result |
|---|---|
| `site:oopsmypassword.web.app` search | **Homepage index hai** ✅ (title + description serve ho raha hai) |
| `/sitemap.xml` fetch | **200 OK, valid XML** ✅ |
| `oopsmypassword.firebaseapp.com` | ⚠️ **same site duplicate serve kar raha hai** (Firebase dono hostname deta hai, ek band nahi kar sakte) |
| Canonicals | ✅ sab `oopsmypassword.web.app` par point karte hain — duplicate hostname ka effect canonical se neutralize hai |
| GSC sitemap status | Ye tumhare screenshot/report par depend karta hai — code me koi defect nahi mila |

Homepage index hai matlab **site blocked nahi hai**. Jo missing hai wo sitemap ka `Success` status aur baaki 296 pages ka crawl.

### 15.3 Evidence — ye koi tumhari hi problem nahi, pattern hai

1. **r/Firebase, Dec 2025** — "`*.web.app` domain par hosting, sitemap months pehle submit kiya, **abhi bhi 'Couldn't fetch'**. Live URL test me sitemap bilkul theek khulta hai." Ek aur user same thread me: "same thing happening to me, live for months with Couldn't fetch."
   → https://www.reddit.com/r/Firebase/comments/1pnua38/
2. **r/Firebase, 2021** — "`*.web.app/sitemap.xml` submit karta hoon to 'couldn't fetch' aata hai, but URL Inspection kehta hai URL is on Google. Sirf 3 pages index hue 10 din me."
   → https://www.reddit.com/r/Firebase/comments/pm5ojj/
3. **Stack Overflow** — "Firebase ke default subdomains (`*.web.app` aur `*.firebaseapp.com`) **automatically indexed nahi hote** by Google."
   → https://stackoverflow.com/questions/67323000/
4. **Google ka khud ka doc** — fetch fail hone par Google "kuch din retry karta hai, phir **stop** kar deta hai". Isliye ek baar fail hua sitemap permanently 'Couldn't fetch' dikhata rehta hai.
   → https://support.google.com/webmasters/answer/7451001

**Common thread:** XML valid, 200 OK, headers sahi, Live Test pass — aur phir bhi GSC "Couldn't fetch". Ye **hostname-level / Google-side** issue hai, file ka bug nahi.

### 15.4 Sabse important: Vercel par shift karne se ye FIX NAHI hoga

Ek developer ne exactly ye experiment kiya — same project, same sitemap, 4 platforms par deploy kiya:
- Cloudflare Pages → GSC: **Couldn't fetch**
- Vercel → **Couldn't fetch**
- Cloudflare Workers / OpenNext → **Couldn't fetch**
- **Alag domain** par same project → **GSC ne fetch kar liya** ✅

Uska conclusion: *"simply changing the hosting platform was probably not enough… the failure was likely tied to the production domain."*
→ https://dev.to/jsxyzb/when-google-search-console-couldnt-fetch-my-sitemap-i-added-an-html-sitemap-fallback-2d0l

**Iska matlab:**
- `.web.app` → `*.vercel.app` = **shared free subdomain → shared free subdomain**. Same problem class, plus AdSense/Hobby violation, plus SEO migration ka nuksaan. **Net negative.**
- `.pages.dev`, `.netlify.app` — sab same class. Koi free host isse "fix" nahi karta.
- **Sirf custom domain** hostname change karta hai → **wahi ek real fix hai.**

### 15.5 Blaze upgrade se bhi fix nahi hota

Blaze plan deta hai: Cloud Functions, Cloud Storage, phone auth. **Hostname reputation ya Google ka crawl behaviour nahi badalta.** Agar koi bole "Blaze lo sitemap theek ho jayega" — wo galat hai. Custom domain = Spark plan par bhi free hai (SSL bhi free).

### 15.6 Free fixes — aaj ₹0 me kya try karo (evidence-backed, priority order)

**#1 Rename trick (sabse zyada logon ka kaam kiya)** — GSC me `/sitemap.xml` ki jagah **`/google-sitemap.xml`** submit karo (tumhare repo me already byte-identical alias hai). r/SEO thread me multiple logon ne `sitemap_index.xml` rename se instant fix report kiya hai. 5 min ka kaam, 100% free, koi risk nahi.
→ https://www.reddit.com/r/SEO/comments/1r8wki0/

**#2 Sitemap index banao** — `/sitemap_index.xml` jo andar `sitemap.xml` ko point kare. Kabhi Google ko index file chahiye hoti hai, kabhi direct urlset.

**#3 HTML sitemap fallback (permanent safety net)** — tumhare paas `/sitemap` page **already hai**. Use footer se har page par link karo + usme saare 297 URLs ke real `<a href>` do. Ye XML sitemap fail hone par bhi Google ka discovery path zinda rakhta hai. (dev.to wala dev isi se bacha.)

**#4 robots.txt se sirf discover karwao** — `Sitemap:` line already hai ✅. Kuch cases me Google sitemap ko robots se zyada reliably pick karta hai.

**#5 URL Inspection → Live Test** — sitemap URL daalo, "Page availability → Page fetch" dekho. Agar **Successful** hai to GSC ka 'Couldn't fetch' cosmetic hai, kaam nahi rukka. Isi se index request karo.

**#6 Internal linking audit** — 297 pages tak crawl path banao: har article/guide se 3–5 related links, hub pages se sab par links. Crawl budget hostname issue se fight karne ka free tareeka yahi hai.

**#7 IndexNow** — Bing/Yandex ke liye already CI me hai; Google ke liye nahi. Par Bing se traffic + backlink signal milta hai.

**#8 Sitemap todo chhote files me** — 297 URLs ek file me hain, chhota hi hai. Na karo abhi. (Sirf agar `Has errors` aaye.)

### 15.7 Sach: permanent fix ki cost sirf domain ki hai

| Option | Cost | Sitemap issue fix? | AdSense safe? | SEO risk |
|---|---|---|---|---|
| Firebase Spark + `web.app` (aaj) | ₹0 | ❌ persistent | ✅ | — |
| Firebase Spark + custom domain | **~₹900/yr** | ✅ **haan** | ✅ | 🟢 ek baar domain migration |
| Vercel Hobby + `.vercel.app` | ₹0 | ❌ (same class) | ❌ Hobby violation | 🔴 migration ka loss |
| Vercel Pro + custom domain | $240/yr + domain | ✅ | ✅ | 🟢 |
| Cloudflare Pages + `.pages.dev` | ₹0 | ❌ (same class) | ✅ | 🔴 migration ka loss |
| Cloudflare Pages + custom domain | ~₹900/yr | ✅ | ✅ | 🟡 migration |

**Bottom line:** ₹0 me sitemap ko **fix** nahi kar sakte. ₹0 me usse **survive** kar sakte ho (§15.6). Domain ₹900 lene par Spark plan par hi permanently fix ho jayega — Vercel ki zaroorat hi nahi. Aur ek baat: index hone ke liye sitemap **mandatory nahi** hai — Google internal links + backlinks se bhi crawl karta hai. Sitemap "Couldn't fetch" hai par site band nahi hai, aur tumhara homepage index bhi hai.

### 15.8 Iska matlab migration ka decision kya hua

- **Migration se ye issue fix nahi hoga** → abhi migrate karna pure loss hai (§13).
- Domain aane par bhi **Firebase par hi rehna better hai** (1 migration vs 2, Spark free, kuch bhi re-setup nahi).
- Vercel tabhi jao jab koi **technical** reason ho (functions chahiye, Firebase ka 360 MB/day cap, ya CI/CD chahiye) — sitemap reason nahi hai.

### 15.9 ✅ Implemented (2026-11-01) — RSS as a sitemap + index + alias

| File | Change |
|---|---|
| `rss.xml` | **37 → 52 items** (15 static guides added), de-duplicated by link, `<lastBuildDate>` (RFC 822), `<ttl>`, `<generator>` |
| `sitemap-index.xml` | now lists **both** `sitemap.xml` **and** `rss.xml` |
| `robots.txt` | declares all three: `sitemap.xml`, `sitemap-index.xml`, `rss.xml` |
| `scripts/build-phase3-seo.mjs` | RSS + index generators emit the above (rebuild-proof, not a hand edit) |
| `tools/build.py` | robots.txt generator emits all three `Sitemap:` lines |
| `scripts/verify-seo.mjs` | new `RSS` gate: RSS 2.0 root, RFC 822 date, canonical origin, every `<link>` routable, no noindex, no dupes; robots gate now allows the three endpoints |
| `tools/test_sitemap.js` | robots assertion updated; blocks `Disallow: /rss` |
| `scripts/verify-live-release.mjs` | live release check now hashes `/rss.xml` + `/sitemap-index.xml` |
| `guides.html` | stale "Cookie check" page replaced by the intended noindex redirect stub (was failing 4 SEO-gate rules) |

Gate results: `tools/test_sitemap.js` **29/29**, `verify-seo.mjs` **passed**,
`tools/qa.py` **0 errors**, RSS valid 2.0 with 52/52 items carrying `<link>`.

**Nothing changed about the diagnosis** (§15.1–15.7): this keeps discovery
alive at ₹0, it does not repair the `*.web.app` hostname reputation. Custom
domain remains the only permanent fix — and it stays on the free Spark plan.
