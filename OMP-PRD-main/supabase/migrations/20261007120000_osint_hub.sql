/* OMP OSINT Hub — Supabase schema + RLS + Storage + seed.
 *
 * New public section: /osint (hub) and /osint/<tool-slug> (detail).
 * The public app (assets/js/osint.js) reads through the publishable key;
 * only published rows are visible to anon. The admin panel (OSINT tab in
 * assets/js/admin.js) signs in and relies on RLS: ONLY an admin can write.
 *
 * Mirrors the products pattern (00_schema_migrations.sql section 10):
 *   - published-only SELECT for anon + authenticated
 *   - full SELECT + INSERT/UPDATE/DELETE for admins via public.is_admin()
 *   - touch_updated_at trigger keeps updated_at (and sitemap lastmod) honest
 *   - public bucket for logos, admin-only writes
 */

-- ---------------------------------------------------------------------------
-- 1. osint_categories
-- ---------------------------------------------------------------------------
create table if not exists public.osint_categories (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text not null unique,
  description  text,
  icon         text,
  sort_order   int not null default 0,
  status       text not null default 'draft' check (status in ('draft','published','archived')),
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id) on delete set null
);

alter table public.osint_categories enable row level security;

drop policy if exists "osint_categories_select_published" on public.osint_categories;
create policy "osint_categories_select_published" on public.osint_categories
  for select to anon, authenticated using (status = 'published');

drop policy if exists "osint_categories_select_all_admin" on public.osint_categories;
create policy "osint_categories_select_all_admin" on public.osint_categories
  for select to authenticated using (public.is_admin());

drop policy if exists "osint_categories_admin_insert" on public.osint_categories;
create policy "osint_categories_admin_insert" on public.osint_categories
  for insert to authenticated with check (public.is_admin());
drop policy if exists "osint_categories_admin_update" on public.osint_categories;
create policy "osint_categories_admin_update" on public.osint_categories
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "osint_categories_admin_delete" on public.osint_categories;
create policy "osint_categories_admin_delete" on public.osint_categories
  for delete to authenticated using (public.is_admin());


-- ---------------------------------------------------------------------------
-- 2. osint_tools
-- ---------------------------------------------------------------------------
-- pricing: free | freemium | paid  (single value, radio in admin)
-- access_types: subset of {web, cli, desktop-app, browser-extension,
--   mobile-app, api} (multi-checkbox in admin; a tool can be both web + cli)
create table if not exists public.osint_tools (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text not null unique,
  summary      text,
  overview     text not null default '',
  install_guide text not null default '',
  category_id  uuid references public.osint_categories(id) on delete set null,
  pricing      text not null default 'free' check (pricing in ('free','freemium','paid')),
  access_types text[] not null default '{web}',
  official_url text,
  github_url   text,
  docs_url     text,
  logo_url     text,
  featured     boolean not null default false,
  status       text not null default 'draft' check (status in ('draft','published','archived')),
  sort_order   int not null default 0,
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id) on delete set null,
  constraint osint_tools_access_types_check
    check (access_types <@ array['web','cli','desktop-app','browser-extension','mobile-app','api']
           and cardinality(access_types) > 0)
);

alter table public.osint_tools enable row level security;

drop policy if exists "osint_tools_select_published" on public.osint_tools;
create policy "osint_tools_select_published" on public.osint_tools
  for select to anon, authenticated using (status = 'published');

drop policy if exists "osint_tools_select_all_admin" on public.osint_tools;
create policy "osint_tools_select_all_admin" on public.osint_tools
  for select to authenticated using (public.is_admin());

drop policy if exists "osint_tools_admin_insert" on public.osint_tools;
create policy "osint_tools_admin_insert" on public.osint_tools
  for insert to authenticated with check (public.is_admin());
drop policy if exists "osint_tools_admin_update" on public.osint_tools;
create policy "osint_tools_admin_update" on public.osint_tools
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "osint_tools_admin_delete" on public.osint_tools;
create policy "osint_tools_admin_delete" on public.osint_tools
  for delete to authenticated using (public.is_admin());

revoke all on public.osint_categories, public.osint_tools from anon;
grant select on public.osint_categories to anon;   -- published only (RLS)
grant select on public.osint_tools to anon;        -- published only (RLS)


-- ---------------------------------------------------------------------------
-- 3. updated_at maintenance (same trigger as articles/products)
-- ---------------------------------------------------------------------------
drop trigger if exists osint_categories_touch_updated_at on public.osint_categories;
create trigger osint_categories_touch_updated_at
  before update on public.osint_categories
  for each row execute function public.touch_updated_at();

drop trigger if exists osint_tools_touch_updated_at on public.osint_tools;
create trigger osint_tools_touch_updated_at
  before update on public.osint_tools
  for each row execute function public.touch_updated_at();


-- ---------------------------------------------------------------------------
-- 4. Storage: "osint-logos" bucket (public tool logos)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('osint-logos', 'osint-logos', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "osint_logos_public_read" on storage.objects;
create policy "osint_logos_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'osint-logos');

drop policy if exists "osint_logos_admin_insert" on storage.objects;
create policy "osint_logos_admin_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'osint-logos' and public.is_admin());
drop policy if exists "osint_logos_admin_update" on storage.objects;
create policy "osint_logos_admin_update" on storage.objects
  for update to authenticated using (bucket_id = 'osint-logos' and public.is_admin()) with check (bucket_id = 'osint-logos' and public.is_admin());
drop policy if exists "osint_logos_admin_delete" on storage.objects;
create policy "osint_logos_admin_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'osint-logos' and public.is_admin());


-- ---------------------------------------------------------------------------
-- 5. Seed: the six hub categories (idempotent)
-- ---------------------------------------------------------------------------
insert into public.osint_categories (name, slug, description, icon, sort_order, status, published_at) values
  ('Username OSINT', 'username-osint', 'Track a username across social networks, forums and websites to map a digital footprint.', 'user', 1, 'published', now()),
  ('Email OSINT', 'email-osint', 'Reverse-lookup an email address to find linked accounts, breaches and public traces.', 'mail', 2, 'published', now()),
  ('Domain & IP OSINT', 'domain-osint', 'Investigate domains, IPs and internet infrastructure — DNS, certificates, subdomains and exposure.', 'server', 3, 'published', now()),
  ('Phone OSINT', 'phone-osint', 'Look up phone numbers to find carrier info, linked accounts and public mentions.', 'device', 4, 'published', now()),
  ('Image & Metadata OSINT', 'image-osint', 'Extract EXIF metadata, reverse-search images and verify visual evidence.', 'image', 5, 'published', now()),
  ('All-in-One OSINT', 'all-in-one', 'Automation platforms that collect and correlate many OSINT sources in one place.', 'layers', 6, 'published', now())
on conflict (slug) do update
  set name = excluded.name,
      description = excluded.description,
      icon = excluded.icon,
      sort_order = excluded.sort_order,
      status = 'published',
      published_at = coalesce(public.osint_categories.published_at, now());


-- ---------------------------------------------------------------------------
-- 6. Seed: ten launch tools (idempotent by slug)
-- ---------------------------------------------------------------------------
-- Sherlock — Username OSINT
insert into public.osint_tools (name, slug, summary, overview, install_guide, category_id, pricing, access_types, official_url, github_url, docs_url, featured, status, sort_order, published_at) values
  ('Sherlock', 'sherlock',
   'Hunt down a username across 400+ social networks and websites. Free, open-source, runs on your machine.',
   'Sherlock is one of the most popular open-source username investigation tools. Give it a username and it checks that handle across more than 400 social networks and websites — GitHub, Instagram, Reddit, Telegram, TikTok and hundreds more — then saves every hit to a text file for that username. Results link straight to the matching profile so you can verify each one by hand. It is a lookup tool, not a hacking tool: it only visits public profile pages and reports which ones exist.',
   '```bash
# Recommended: isolated install with pipx (Python 3.9+)
pipx install sherlock-project

# Verify it runs
sherlock --version

# Check a single username
sherlock user123

# Check several usernames at once
sherlock user1 user2 user3

# Results are saved to user123.txt in the current folder
```',
   (select id from public.osint_categories where slug = 'username-osint'),
   'free', '{cli}',
   'https://sherlockproject.xyz/', 'https://github.com/sherlock-project/sherlock', null,
   true, 'published', 1, now())
on conflict (slug) do update
  set name = excluded.name, summary = excluded.summary, overview = excluded.overview,
      install_guide = excluded.install_guide, category_id = excluded.category_id,
      pricing = excluded.pricing, access_types = excluded.access_types,
      official_url = excluded.official_url, github_url = excluded.github_url,
      docs_url = excluded.docs_url, featured = excluded.featured,
      status = 'published', sort_order = excluded.sort_order,
      published_at = coalesce(public.osint_tools.published_at, now());

-- Maigret — Username OSINT
insert into public.osint_tools (name, slug, summary, overview, install_guide, category_id, pricing, access_types, official_url, github_url, docs_url, featured, status, sort_order, published_at) values
  ('Maigret', 'maigret',
   'Username search across 3000+ sites with HTML/PDF reports. Free, open-source, Sherlock''s bigger sibling.',
   'Maigret collects information about a user by checking a username against more than 3000 websites and data leaks. Where Sherlock answers "does this profile exist?", Maigret goes further: it can pull public profile details (IDs, linked accounts, interests) and generate structured HTML and PDF reports from what it finds. It is the better pick when one username needs a full written report rather than a quick existence check.',
   '```bash
# Recommended: isolated install with pipx (Python 3.9+)
pipx install maigret

# Check a username and open the HTML report
maigret user123 --html

# Also generate a PDF report
maigret user123 --html --pdf
```',
   (select id from public.osint_categories where slug = 'username-osint'),
   'free', '{cli}',
   'https://github.com/soxoj/maigret', 'https://github.com/soxoj/maigret', 'https://maigret.readthedocs.io/',
   false, 'published', 2, now())
on conflict (slug) do update
  set name = excluded.name, summary = excluded.summary, overview = excluded.overview,
      install_guide = excluded.install_guide, category_id = excluded.category_id,
      pricing = excluded.pricing, access_types = excluded.access_types,
      official_url = excluded.official_url, github_url = excluded.github_url,
      docs_url = excluded.docs_url, featured = excluded.featured,
      status = 'published', sort_order = excluded.sort_order,
      published_at = coalesce(public.osint_tools.published_at, now());

-- WhatsMyName — Username OSINT
insert into public.osint_tools (name, slug, summary, overview, install_guide, category_id, pricing, access_types, official_url, github_url, docs_url, featured, status, sort_order, published_at) values
  ('WhatsMyName', 'whatsmyname',
   'Check a username across hundreds of sites instantly in your browser. Free web app, nothing to install.',
   'WhatsMyName is a browser-based username checker maintained by the WebBreacher project. Type a username and it tests it against hundreds of websites in seconds, showing found profiles as clickable links. Because it runs entirely as a web page there is nothing to install and no command line needed — the best first tool for beginners. Power users can also download the site list and run checks offline.',
   'No installation needed — it runs in your browser.

1. Open the WhatsMyName web app below.
2. Type the username and press enter.
3. Click any found result to open and verify the profile.',
   (select id from public.osint_categories where slug = 'username-osint'),
   'free', '{web}',
   'https://whatsmynam3.github.io/WhatsMyName/', 'https://github.com/WebBreacher/WhatsMyName', null,
   false, 'published', 3, now())
on conflict (slug) do update
  set name = excluded.name, summary = excluded.summary, overview = excluded.overview,
      install_guide = excluded.install_guide, category_id = excluded.category_id,
      pricing = excluded.pricing, access_types = excluded.access_types,
      official_url = excluded.official_url, github_url = excluded.github_url,
      docs_url = excluded.docs_url, featured = excluded.featured,
      status = 'published', sort_order = excluded.sort_order,
      published_at = coalesce(public.osint_tools.published_at, now());

-- Holehe — Email OSINT
insert into public.osint_tools (name, slug, summary, overview, install_guide, category_id, pricing, access_types, official_url, github_url, docs_url, featured, status, sort_order, published_at) values
  ('Holehe', 'holehe',
   'Check whether an email address is registered on 120+ platforms. Free, open-source, command line.',
   'Holehe answers one question fast: is this email address signed up on a given site? It tests the address against more than 120 platforms — Reddit, GitHub, Discord, Spotify, Amazon and many more — using each site''s own password-reset and registration flows, without sending anything to the address owner. The result is a clean registered/not-registered list that is perfect for pivoting from an email to a set of accounts.',
   '```bash
# Install with pip (Python 3.9+)
pip install holehe

# Check an email address
holehe test@example.com

# Save results to a CSV file
holehe test@example.com --csv
```',
   (select id from public.osint_categories where slug = 'email-osint'),
   'free', '{cli}',
   'https://github.com/megadose/holehe', 'https://github.com/megadose/holehe', null,
   false, 'published', 1, now())
on conflict (slug) do update
  set name = excluded.name, summary = excluded.summary, overview = excluded.overview,
      install_guide = excluded.install_guide, category_id = excluded.category_id,
      pricing = excluded.pricing, access_types = excluded.access_types,
      official_url = excluded.official_url, github_url = excluded.github_url,
      docs_url = excluded.docs_url, featured = excluded.featured,
      status = 'published', sort_order = excluded.sort_order,
      published_at = coalesce(public.osint_tools.published_at, now());

-- Epieos — Email OSINT
insert into public.osint_tools (name, slug, summary, overview, install_guide, category_id, pricing, access_types, official_url, github_url, docs_url, featured, status, sort_order, published_at) values
  ('Epieos', 'epieos',
   'Reverse-lookup an email or phone number to uncover linked social accounts. Freemium web app.',
   'Epieos is a web-based reverse lookup for email addresses and phone numbers. Paste an identifier and it returns linked Google account details, connected services and public traces — without notifying the target and without logging your query. Basic lookups are free; deeper modules (LinkedIn, Facebook, fitness apps and more) need a paid plan. It is the fastest option when you want answers in a browser instead of a terminal.',
   'No installation needed — it runs in your browser.

1. Open Epieos below and choose Email or Phone lookup.
2. Enter the address or number and confirm the terms.
3. Review linked accounts, then pivot on each finding elsewhere.

Free tier covers basic lookups; advanced modules need a paid plan (check Pricing on their site).',
   (select id from public.osint_categories where slug = 'email-osint'),
   'freemium', '{web}',
   'https://epieos.com/', null, null,
   true, 'published', 2, now())
on conflict (slug) do update
  set name = excluded.name, summary = excluded.summary, overview = excluded.overview,
      install_guide = excluded.install_guide, category_id = excluded.category_id,
      pricing = excluded.pricing, access_types = excluded.access_types,
      official_url = excluded.official_url, github_url = excluded.github_url,
      docs_url = excluded.docs_url, featured = excluded.featured,
      status = 'published', sort_order = excluded.sort_order,
      published_at = coalesce(public.osint_tools.published_at, now());

-- theHarvester — Domain & IP OSINT
insert into public.osint_tools (name, slug, summary, overview, install_guide, category_id, pricing, access_types, official_url, github_url, docs_url, featured, status, sort_order, published_at) values
  ('theHarvester', 'theharvester',
   'Gather emails, subdomains, IPs and employee names for a domain. Free, open-source, command line.',
   'theHarvester is a classic reconnaissance tool for the early stages of an investigation. Give it a domain name and it passively collects emails, subdomains, hostnames, IP addresses and employee names from public sources — search engines, certificate transparency logs, DNS dumps and more. Security teams use it to map what their own organisation exposes; investigators use it to expand one domain into a full target list.',
   '```bash
# Clone and install (Python 3.9+)
git clone https://github.com/laramies/theHarvester.git
cd theHarvester
pip install -r requirements.txt

# Basic run against a domain
python3 theHarvester.py -d example.com -b all

# Limit sources and save output
python3 theHarvester.py -d example.com -b crtsh,hackertarget -f results
```',
   (select id from public.osint_categories where slug = 'domain-osint'),
   'free', '{cli}',
   'https://github.com/laramies/theHarvester', 'https://github.com/laramies/theHarvester', null,
   false, 'published', 1, now())
on conflict (slug) do update
  set name = excluded.name, summary = excluded.summary, overview = excluded.overview,
      install_guide = excluded.install_guide, category_id = excluded.category_id,
      pricing = excluded.pricing, access_types = excluded.access_types,
      official_url = excluded.official_url, github_url = excluded.github_url,
      docs_url = excluded.docs_url, featured = excluded.featured,
      status = 'published', sort_order = excluded.sort_order,
      published_at = coalesce(public.osint_tools.published_at, now());

-- Shodan — Domain & IP OSINT
insert into public.osint_tools (name, slug, summary, overview, install_guide, category_id, pricing, access_types, official_url, github_url, docs_url, featured, status, sort_order, published_at) values
  ('Shodan', 'shodan',
   'The search engine for internet-connected devices, services and exposures. Freemium web app + API.',
   'Shodan continuously scans the internet and indexes banners from servers, routers, webcams, databases and industrial systems. Instead of searching web pages, you search devices: find open ports, outdated software, exposed databases and misconfigured services by IP, hostname, port or organisation. A free account covers basic lookups; serious use (API access, historical data, network scanning) is paid.',
   'No installation needed for the web version.

1. Create a free account on Shodan below.
2. Try a starter query such as `port:22 country:IN` or an IP address.
3. Open a result to see open ports, banners and known vulnerabilities.

For automation, install the CLI (`pip install shodan`) and add your API key with `shodan init YOUR_API_KEY`.',
   (select id from public.osint_categories where slug = 'domain-osint'),
   'freemium', '{web,api}',
   'https://www.shodan.io/', null, 'https://developer.shodan.io/',
   true, 'published', 2, now())
on conflict (slug) do update
  set name = excluded.name, summary = excluded.summary, overview = excluded.overview,
      install_guide = excluded.install_guide, category_id = excluded.category_id,
      pricing = excluded.pricing, access_types = excluded.access_types,
      official_url = excluded.official_url, github_url = excluded.github_url,
      docs_url = excluded.docs_url, featured = excluded.featured,
      status = 'published', sort_order = excluded.sort_order,
      published_at = coalesce(public.osint_tools.published_at, now());

-- PhoneInfoga — Phone OSINT
insert into public.osint_tools (name, slug, summary, overview, install_guide, category_id, pricing, access_types, official_url, github_url, docs_url, featured, status, sort_order, published_at) values
  ('PhoneInfoga', 'phoneinfoga',
   'Scan a phone number for carrier, country, linked accounts and mentions. Free, open-source.',
   'PhoneInfoga is an open-source phone number investigator. Enter a number in international format and it reports the carrier and country, checks the number against data-leak databases, searches for public mentions and can run a browser-based interface for the same checks. Version 2 runs as a local web server, so beginners never have to leave the browser while advanced users keep the terminal workflow.',
   '```bash
# Easiest: run with Docker
docker pull sundowndev/phoneinfoga:latest
docker run -it -p 5000:5000 sundowndev/phoneinfoga serve --port=5000

# Then open http://localhost:5000 in your browser,
# or scan directly from the terminal:
docker run -it sundowndev/phoneinfoga scan -n +33612345678
```',
   (select id from public.osint_categories where slug = 'phone-osint'),
   'free', '{cli,web}',
   'https://github.com/sundowndev/phoneinfoga', 'https://github.com/sundowndev/phoneinfoga', null,
   false, 'published', 1, now())
on conflict (slug) do update
  set name = excluded.name, summary = excluded.summary, overview = excluded.overview,
      install_guide = excluded.install_guide, category_id = excluded.category_id,
      pricing = excluded.pricing, access_types = excluded.access_types,
      official_url = excluded.official_url, github_url = excluded.github_url,
      docs_url = excluded.docs_url, featured = excluded.featured,
      status = 'published', sort_order = excluded.sort_order,
      published_at = coalesce(public.osint_tools.published_at, now());

-- ExifTool — Image & Metadata OSINT
insert into public.osint_tools (name, slug, summary, overview, install_guide, category_id, pricing, access_types, official_url, github_url, docs_url, featured, status, sort_order, published_at) values
  ('ExifTool', 'exiftool',
   'Read, write and strip metadata from images, video, PDFs and documents. Free, the metadata standard.',
   'ExifTool by Phil Harvey is the reference tool for file metadata. Point it at a photo and it reveals camera model, GPS coordinates, timestamps, software history and hundreds of other embedded fields — the raw material of image OSINT and verification work. It reads and writes metadata across a huge range of formats, and almost every other metadata tool is built on top of it.',
   '```bash
# Debian / Ubuntu / Kali
sudo apt install libimage-exiftool-perl

# macOS
brew install exiftool

# Read all metadata from a photo
exiftool photo.jpg

# GPS coordinates only
exiftool -gpslatitude -gpslongitude photo.jpg

# Strip all metadata (safe sharing)
exiftool -all= photo.jpg
```',
   (select id from public.osint_categories where slug = 'image-osint'),
   'free', '{cli}',
   'https://exiftool.org/', null, 'https://exiftool.org/#docs',
   false, 'published', 1, now())
on conflict (slug) do update
  set name = excluded.name, summary = excluded.summary, overview = excluded.overview,
      install_guide = excluded.install_guide, category_id = excluded.category_id,
      pricing = excluded.pricing, access_types = excluded.access_types,
      official_url = excluded.official_url, github_url = excluded.github_url,
      docs_url = excluded.docs_url, featured = excluded.featured,
      status = 'published', sort_order = excluded.sort_order,
      published_at = coalesce(public.osint_tools.published_at, now());

-- SpiderFoot — All-in-One OSINT
insert into public.osint_tools (name, slug, summary, overview, install_guide, category_id, pricing, access_types, official_url, github_url, docs_url, featured, status, sort_order, published_at) values
  ('SpiderFoot', 'spiderfoot',
   'Automate OSINT collection across 200+ modules from one web interface. Free, open-source.',
   'SpiderFoot is an open-source OSINT automation platform. Instead of running ten tools by hand, you give SpiderFoot one target — a domain, IP, email, username or ASN — and its 200+ modules query threat feeds, search engines, DNS records, breach data and social sources automatically, then correlate everything into a single browsable report. It runs as a local web app with a command-line option for scripting.',
   '```bash
# Clone and install (Python 3.9+)
git clone https://github.com/smicallef/spiderfoot.git
cd spiderfoot
pip install -r requirements.txt

# Start the web interface
python3 ./sf.py -l 127.0.0.1:5001

# Open http://127.0.0.1:5001, create a new scan,
# enter your target and pick the modules to run.
```',
   (select id from public.osint_categories where slug = 'all-in-one'),
   'free', '{web,cli}',
   'https://github.com/smicallef/spiderfoot', 'https://github.com/smicallef/spiderfoot', null,
   false, 'published', 1, now())
on conflict (slug) do update
  set name = excluded.name, summary = excluded.summary, overview = excluded.overview,
      install_guide = excluded.install_guide, category_id = excluded.category_id,
      pricing = excluded.pricing, access_types = excluded.access_types,
      official_url = excluded.official_url, github_url = excluded.github_url,
      docs_url = excluded.docs_url, featured = excluded.featured,
      status = 'published', sort_order = excluded.sort_order,
      published_at = coalesce(public.osint_tools.published_at, now());
