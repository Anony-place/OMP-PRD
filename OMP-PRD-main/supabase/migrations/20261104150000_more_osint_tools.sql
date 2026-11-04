-- Six more OSINT tools, filling the gaps the audit found.
--
-- The OSINT hub advertised a comparison against Censys (/compare/shodan-vs-censys)
-- and never had a Censys page; Maltego, Recon-ng, GHunt, HIBP and dnstwist were
-- the other names readers look for and could not find. Every row carries the
-- same fields as the existing ten, so the publisher renders them identically:
-- overview, key features, install guide, real-world example, four FAQs.
--
-- Idempotent: re-running updates the same six rows by slug.


insert into public.osint_tools
  (name, slug, summary, overview, key_features, install_guide, faqs, use_case, category_id, pricing, access_types, official_url, github_url, docs_url, logo_url, featured, status, sort_order, published_at)
values
  ($omp$Censys$omp$, $omp$censys$omp$, $omp$Search internet-facing hosts and TLS certificates by IP, organisation or domain, then monitor what changes. Freemium web app and API.$omp$, $omp$<p>Censys crawls the public internet and indexes hosts, services and certificates, so you can see what an organisation exposes without sending a single packet to it. Certificate search is the standout: certificates are public by design, and they map domains to organisations far more reliably than a WHOIS record.</p><p>Free accounts get host and certificate search with limited API credits; monitoring, historical scans and bulk exports are paid.</p>$omp$, $omp$<p>Host and service search; TLS certificate index; organisation, ASN and IP pivots; change monitoring (paid); REST API.</p>$omp$, $omp$<pre><code>
# Web search - no install
# https://search.censys.io

# API v2 with curl (create a free API key first)
export CENSYS_API_ID=your-id CENSYS_API_SECRET=your-secret

curl -s -u "$CENSYS_API_ID:$CENSYS_API_SECRET" \
  "https://search.censys.io/api/v2/hosts/search?q=example.com&per_page=25"
</code></pre>
<p>The free tier caps API credits and hides historical data; the web UI stays usable for ad-hoc checks. Docs: https://search.censys.io/api</p>$omp$, $omp$<h3>Is Censys free?</h3>
<p>There is a free tier: host and certificate search in the web UI, with a monthly API credit allowance. Monitoring, history and bulk exports need a paid plan.</p>
<h3>How is it different from Shodan?</h3>
<p>Shodan is built around banners and device fingerprints; Censys is built around certificates and host services. Certificate search makes Censys better for mapping an organisation's domains.</p>
<h3>Does using it scan the target?</h3>
<p>No. You are reading an index that Censys built with its own crawlers, so nothing is sent to the target while you search.</p>
<h3>Why does a certificate show domains that no longer resolve?</h3>
<p>Certificates outlive the hosts they were issued for. Historical certificates are often the only evidence left of a decommissioned service.</p>$omp$, $omp$<p>You know one domain. Pivot through its certificates to find sibling hosts, staging environments and forgotten subdomains that no DNS list you can enumerate would show.</p>$omp$,
   (select id from public.osint_categories where slug = 'domain-osint'),
   'freemium', array['web','api'], $omp$https://search.censys.io/$omp$, null, $omp$https://search.censys.io/api$omp$, $omp$https://www.google.com/s2/favicons?domain=censys.io&sz=128$omp$, true, 'published', 10, '2026-11-04T00:00:00Z')
on conflict (slug) do update set
  name = excluded.name, summary = excluded.summary, overview = excluded.overview,
  key_features = excluded.key_features, install_guide = excluded.install_guide,
  faqs = excluded.faqs, use_case = excluded.use_case, category_id = excluded.category_id,
  pricing = excluded.pricing, access_types = excluded.access_types,
  official_url = excluded.official_url, github_url = excluded.github_url,
  docs_url = excluded.docs_url, logo_url = excluded.logo_url,
  featured = excluded.featured, status = 'published', sort_order = excluded.sort_order,
  published_at = coalesce(public.osint_tools.published_at, excluded.published_at);

insert into public.osint_tools
  (name, slug, summary, overview, key_features, install_guide, faqs, use_case, category_id, pricing, access_types, official_url, github_url, docs_url, logo_url, featured, status, sort_order, published_at)
values
  ($omp$Maltego$omp$, $omp$maltego$omp$, $omp$Graph people, domains, emails and organisations, then expand them with transforms that pull live data. Free Community Edition.$omp$, $omp$<p>Maltego models an investigation as a graph: every entity is a node, and every transform is a call to a data source that adds or links nodes. Instead of reading five tools' output in five tabs, you watch one graph grow and can see which facts actually connect.</p><p>The Community Edition is free for non-commercial use with a limited transform set; commercial and deep-web transforms are licensed.</p>$omp$, $omp$<p>Entity graphs; transform library (DNS, WHOIS, social, breach); link analysis; export to CSV/GraphML; team sharing in paid tiers.</p>$omp$, $omp$<pre><code>
# Desktop application - download from the vendor
# https://www.maltego.com/downloads/

# 1. Install, then register a free Community Edition licence in the app
# 2. New graph -> drag an Entity onto the canvas (Domain, Email, Person)
# 3. Right-click the entity -> Run Transform -> pick a source

# Useful first transforms on a Domain entity
#   DNS from DNS -> To DNS Name
#   To Website [Quick Lookup]
#   To Email addresses from Domain
</code></pre>
<p>Transforms need API keys for some sources; the free ones (DNS, WHOIS, quick lookups) work out of the box. Docs: https://docs.maltego.com/</p>$omp$, $omp$<h3>Is Maltego free?</h3>
<p>The Community Edition is free for non-commercial use with a limited transform set. Commercial use and the deeper data integrations are paid.</p>
<h3>Maltego or a bunch of CLI tools?</h3>
<p>CLI tools give you raw rows. Maltego's value is the graph: it keeps provenance for every edge, so you can show how two entities are connected instead of asserting it.</p>
<h3>Do the transforms touch the target?</h3>
<p>Some do: DNS and direct lookups contact third parties or the target itself. Others read existing datasets. Check each transform before running it on live scope.</p>
<h3>Can I export the graph?</h3>
<p>Yes - CSV, GraphML and image export on the free tier, which is enough to attach evidence to a report.</p>$omp$, $omp$<p>Take an email address, expand it to its domain, the domain to its registrant and hosts, and the hosts to their certificates - then read the graph to see which of those links are real and which are coincidence.</p>$omp$,
   (select id from public.osint_categories where slug = 'all-in-one'),
   'freemium', array['desktop-app'], $omp$https://www.maltego.com/$omp$, null, $omp$https://docs.maltego.com/$omp$, $omp$https://www.google.com/s2/favicons?domain=maltego.com&sz=128$omp$, true, 'published', 11, '2026-11-04T00:00:00Z')
on conflict (slug) do update set
  name = excluded.name, summary = excluded.summary, overview = excluded.overview,
  key_features = excluded.key_features, install_guide = excluded.install_guide,
  faqs = excluded.faqs, use_case = excluded.use_case, category_id = excluded.category_id,
  pricing = excluded.pricing, access_types = excluded.access_types,
  official_url = excluded.official_url, github_url = excluded.github_url,
  docs_url = excluded.docs_url, logo_url = excluded.logo_url,
  featured = excluded.featured, status = 'published', sort_order = excluded.sort_order,
  published_at = coalesce(public.osint_tools.published_at, excluded.published_at);

insert into public.osint_tools
  (name, slug, summary, overview, key_features, install_guide, faqs, use_case, category_id, pricing, access_types, official_url, github_url, docs_url, logo_url, featured, status, sort_order, published_at)
values
  ($omp$GHunt$omp$, $omp$ghunt$omp$, $omp$Turn one Gmail address into the linked Google account: name, profile photo, YouTube channel and account identifiers. Free CLI.$omp$, $omp$<p>GHunt answers a narrow question very well: what does Google itself reveal about a Gmail address? It reads the public profile, the linked YouTube channel and the account metadata that Google's own pages expose, which is usually enough to attach a real name and photo to an address.</p><p>It authenticates with your own Google session cookies, so results come back at the same level a normal signed-in user would see.</p>$omp$, $omp$<p>Gmail to Google account; public profile and photo; linked YouTube channel; account creation hints; JSON output for reports.</p>$omp$, $omp$<pre><code>
# Isolated install
pipx install ghunt

# One-time login: follow the browser steps it prints and paste the cookies
ghunt login

# Look up an address
ghunt email target@gmail.com

# Machine-readable output for a report
ghunt email target@gmail.com --json out.json
</code></pre>
<p>Only look up accounts you have a legitimate reason to investigate. Docs: https://github.com/mxrch/GHunt</p>$omp$, $omp$<h3>Is GHunt free?</h3>
<p>Yes, it is free and open source. There is no key and no paid tier - it uses your own Google session.</p>
<h3>Does the target get notified?</h3>
<p>No. It reads public profile pages and Google's own account endpoints, which do not notify the account owner.</p>
<h3>Why does login fail after a while?</h3>
<p>The session cookies expire. Run ghunt login again and paste fresh values from a browser.</p>
<h3>Does it work for non-Gmail addresses?</h3>
<p>It reports whether the address has a Google account at all; the profile detail only exists when one does.</p>$omp$, $omp$<p>Confirm whether an address is a real, active Google account before you spend a day pivoting on it - and get the profile name and photo that turn an email into a person of interest.</p>$omp$,
   (select id from public.osint_categories where slug = 'email-osint'),
   'free', array['cli'], $omp$https://github.com/mxrch/GHunt$omp$, $omp$https://github.com/mxrch/GHunt$omp$, $omp$https://github.com/mxrch/GHunt$omp$, $omp$https://github.com/mxrch.png$omp$, false, 'published', 12, '2026-11-04T00:00:00Z')
on conflict (slug) do update set
  name = excluded.name, summary = excluded.summary, overview = excluded.overview,
  key_features = excluded.key_features, install_guide = excluded.install_guide,
  faqs = excluded.faqs, use_case = excluded.use_case, category_id = excluded.category_id,
  pricing = excluded.pricing, access_types = excluded.access_types,
  official_url = excluded.official_url, github_url = excluded.github_url,
  docs_url = excluded.docs_url, logo_url = excluded.logo_url,
  featured = excluded.featured, status = 'published', sort_order = excluded.sort_order,
  published_at = coalesce(public.osint_tools.published_at, excluded.published_at);

insert into public.osint_tools
  (name, slug, summary, overview, key_features, install_guide, faqs, use_case, category_id, pricing, access_types, official_url, github_url, docs_url, logo_url, featured, status, sort_order, published_at)
values
  ($omp$Have I Been Pwned$omp$, $omp$have-i-been-pwned$omp$, $omp$Check whether an email appears in known data breaches, and read the full list of incidents it was caught in. Free web lookup.$omp$, $omp$<p>Have I Been Pwned is the reference breach index: an address is matched against hundreds of publicly disclosed breaches, and the result names each incident, the data classes involved and the date. It is the fastest way to tell whether an address has real exposure or only looks interesting.</p><p>The website is free. The API needs a paid key, with a free tier for a few well-known use cases (and a separate free Pwned Passwords range API).</p>$omp$, $omp$<p>Breach lookup by email; per-breach data classes and dates; paste monitoring; domain search (paid); Pwned Passwords k-anonymity API.</p>$omp$, $omp$<pre><code>
# Web lookup - no install
# https://haveibeenpwned.com

# Pwned Passwords API is free and needs no key (k-anonymity lookup)
curl -s https://api.pwnedpasswords.com/range/21BD1 | head

# Breach API needs a key from https://haveibeenpwned.com/API/Key
curl -s -H "hibp-api-key: $HIBP_KEY" \
  "https://haveibeenpwned.com/api/v3/breachedaccount/target@example.com"
</code></pre>
<p>The breach API answers 404 when an address is not in any breach - that is a clean result, not an error. Docs: https://haveibeenpwned.com/API/v3</p>$omp$, $omp$<h3>Is it free?</h3>
<p>The website is free. The breach API needs a paid key; the Pwned Passwords range API is free and needs no key at all.</p>
<h3>Does checking an address notify its owner?</h3>
<p>No. Lookups do not contact the account or notify anyone - but do not enter addresses you are not authorised to investigate into a third-party site.</p>
<h3>HIBP says no breaches - is the address safe?</h3>
<p>It means no incident in this index matched. Private breaches that were never disclosed will not appear anywhere.</p>
<h3>Can I search a whole domain?</h3>
<p>Domain search exists on the paid API and shows which addresses in a verified domain appear in breaches.</p>$omp$, $omp$<p>Before you trust an address in a report, check what has already leaked from it. A breach hit tells you which passwords and identifiers are public, which changes how you describe the risk.</p>$omp$,
   (select id from public.osint_categories where slug = 'email-osint'),
   'freemium', array['web','api'], $omp$https://haveibeenpwned.com/$omp$, null, $omp$https://haveibeenpwned.com/API/v3$omp$, $omp$https://www.google.com/s2/favicons?domain=haveibeenpwned.com&sz=128$omp$, false, 'published', 13, '2026-11-04T00:00:00Z')
on conflict (slug) do update set
  name = excluded.name, summary = excluded.summary, overview = excluded.overview,
  key_features = excluded.key_features, install_guide = excluded.install_guide,
  faqs = excluded.faqs, use_case = excluded.use_case, category_id = excluded.category_id,
  pricing = excluded.pricing, access_types = excluded.access_types,
  official_url = excluded.official_url, github_url = excluded.github_url,
  docs_url = excluded.docs_url, logo_url = excluded.logo_url,
  featured = excluded.featured, status = 'published', sort_order = excluded.sort_order,
  published_at = coalesce(public.osint_tools.published_at, excluded.published_at);

insert into public.osint_tools
  (name, slug, summary, overview, key_features, install_guide, faqs, use_case, category_id, pricing, access_types, official_url, github_url, docs_url, logo_url, featured, status, sort_order, published_at)
values
  ($omp$dnstwist$omp$, $omp$dnstwist$omp$, $omp$Generate look-alike domains - typos, homoglyphs, bitsquatting and TLD swaps - and check which ones are already registered. Free, Python.$omp$, $omp$<p>dnstwist produces the domain permutations an attacker would buy: character swaps, omissions, additions, keyboard neighbours, homoglyphs and alternative TLDs. It then resolves them, so you can separate theory from domains that actually exist.</p><p>Point it at your own brand. The registered-and-resolving output is the shortlist for phishing monitoring and for takedown requests.</p>$omp$, $omp$<p>Permutation fuzzing; homoglyph and bitsquatting sets; DNS resolution; WHOIS and MX lookup; optional screenshot capture; JSON/CSV output.</p>$omp$, $omp$<pre><code>
# Python package
python3 -m pip install --user dnstwist

# or
pipx install dnstwist

# Every permutation, but only the ones that resolve
dnstwist --registered example.com

# Add MX records and a JSON report
dnstwist --registered --mxcheck --format json example.com > lookalikes.json

# Screenshot the registered look-alikes (needs a browser)
dnstwist --registered --screenshots example.com
</code></pre>
<p>Run it against your own domain, not a third party's. Docs: https://github.com/elceef/dnstwist</p>$omp$, $omp$<h3>Is dnstwist free?</h3>
<p>Yes - free and open source, maintained on GitHub. It runs entirely from your machine.</p>
<h3>Why do so many permutations resolve?</h3>
<p>Parked domains and wildcard DNS answer for almost anything. Filter on content or MX records before treating a hit as a threat.</p>
<h3>Does it scan the look-alike sites?</h3>
<p>Only optionally, with --screenshots. By default it resolves names and reads DNS and WHOIS records.</p>
<h3>Can it cover a whole list of domains?</h3>
<p>Feed it one domain per run, or loop it in a script - the JSON output is designed to be diffed between runs.</p>$omp$, $omp$<p>Register a short watchlist: run dnstwist weekly against your brand, diff the registered list, and investigate anything new that resolves with a login page on it.</p>$omp$,
   (select id from public.osint_categories where slug = 'domain-osint'),
   'free', array['cli'], $omp$https://dnstwist.it/$omp$, $omp$https://github.com/elceef/dnstwist$omp$, $omp$https://github.com/elceef/dnstwist$omp$, $omp$https://github.com/elceef.png$omp$, false, 'published', 14, '2026-11-04T00:00:00Z')
on conflict (slug) do update set
  name = excluded.name, summary = excluded.summary, overview = excluded.overview,
  key_features = excluded.key_features, install_guide = excluded.install_guide,
  faqs = excluded.faqs, use_case = excluded.use_case, category_id = excluded.category_id,
  pricing = excluded.pricing, access_types = excluded.access_types,
  official_url = excluded.official_url, github_url = excluded.github_url,
  docs_url = excluded.docs_url, logo_url = excluded.logo_url,
  featured = excluded.featured, status = 'published', sort_order = excluded.sort_order,
  published_at = coalesce(public.osint_tools.published_at, excluded.published_at);

insert into public.osint_tools
  (name, slug, summary, overview, key_features, install_guide, faqs, use_case, category_id, pricing, access_types, official_url, github_url, docs_url, logo_url, featured, status, sort_order, published_at)
values
  ($omp$Recon-ng$omp$, $omp$recon-ng$omp$, $omp$Metasploit-style console for OSINT: workspaces, modules and a database that keeps every finding queryable. Free, open source.$omp$, $omp$<p>Recon-ng puts reconnaissance in a console with workspaces, so an engagement's domains, hosts, contacts and credentials land in one database you can query instead of in a dozen text files. Modules are installed from its marketplace on demand, which keeps the default install small.</p><p>It is a framework, not a scanner: you choose the modules, and it stores what they return.</p>$omp$, $omp$<p>Workspaces per investigation; module marketplace; SQLite-backed results; report generation; API-key management per module.</p>$omp$, $omp$<pre><code>
# Isolated install (Python 3)
pipx install recon-ng

# Start the console and create a workspace
recon-ng
[recon-ng] > workspaces create example-investigation

# Install the modules you need, then run one
[recon-ng] > marketplace install hackertarget
[recon-ng] > modules load recon/domains-hosts/hackertarget
[recon-ng][example-investigation][hackertarget] > options set SOURCE example.com
[recon-ng][example-investigation][hackertarget] > run

# Everything it found is now in the database
[recon-ng] > show hosts
</code></pre>
<p>Some modules need API keys, set with <code>keys add</code>. Docs: https://github.com/lanmaster53/recon-ng</p>$omp$, $omp$<h3>Is Recon-ng free?</h3>
<p>Yes - free and open source. Individual modules may need their own free or paid API keys.</p>
<h3>How is it different from theHarvester?</h3>
<p>theHarvester gives you a report for one domain. Recon-ng gives you a database across a workspace, with modules you add as needed.</p>
<h3>Where is my data stored?</h3>
<p>In a local SQLite database inside the workspace directory - nothing is uploaded unless a module sends it to a third-party API.</p>
<h3>Is the marketplace still maintained?</h3>
<p>The core project and the marketplace both receive updates; check that a module still works before relying on it, since third-party APIs change.</p>$omp$, $omp$<p>Run one organised pass over an in-scope domain: subdomains from several sources, then hosts, then contacts - all stored in a workspace you can export when the engagement ends.</p>$omp$,
   (select id from public.osint_categories where slug = 'all-in-one'),
   'free', array['cli'], $omp$https://github.com/lanmaster53/recon-ng$omp$, $omp$https://github.com/lanmaster53/recon-ng$omp$, $omp$https://github.com/lanmaster53/recon-ng$omp$, $omp$https://github.com/lanmaster53.png$omp$, false, 'published', 15, '2026-11-04T00:00:00Z')
on conflict (slug) do update set
  name = excluded.name, summary = excluded.summary, overview = excluded.overview,
  key_features = excluded.key_features, install_guide = excluded.install_guide,
  faqs = excluded.faqs, use_case = excluded.use_case, category_id = excluded.category_id,
  pricing = excluded.pricing, access_types = excluded.access_types,
  official_url = excluded.official_url, github_url = excluded.github_url,
  docs_url = excluded.docs_url, logo_url = excluded.logo_url,
  featured = excluded.featured, status = 'published', sort_order = excluded.sort_order,
  published_at = coalesce(public.osint_tools.published_at, excluded.published_at);
