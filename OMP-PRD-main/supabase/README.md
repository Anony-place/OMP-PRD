# OopsMyPassword — Supabase security model

This folder documents the **intended** Supabase schema, Row Level Security (RLS)
policies and Storage bucket policies that the site's front-end code relies on.
It lives **outside the deploy root** (`supabase/**` is ignored by
`firebase.json`) so it is never published as static content.

## Why this exists

The public site talks to Supabase with the **publishable (anon) key**. Anyone
with a browser can read that key, so every `SELECT`/`INSERT` the site performs is
also reachable by an attacker calling the REST API directly. The only reason that
is safe is **RLS on the database and on the Storage bucket** — not the JavaScript
checks in `admin.js`, `blog.js`, `search.js` or `contact.js` (those are UX, not
authorization).

The JavaScript in this repo is correct about *what* it intends; this folder is
the intended policy source, not proof of what the deployed server currently allows. It must be applied in the
Supabase project (Dashboard → SQL Editor, or your project's `supabase/migrations`
folder) and kept in sync with any schema change.

## Files

| File | Purpose |
|---|---|
| `00_schema_migrations.sql` | Tables, `is_admin()` helper, RLS policies, Storage bucket `articles` policies, and anon revoke/grant. Applied via the Supabase SQL Editor or a migration tool. |

## Required application order

1. **For a new project**, run `00_schema_migrations.sql` in the SQL Editor (it is locally tested as idempotent,
   `drop policy if exists` / `create or replace`). This creates the `profiles`,
   `articles`, `article_categories`, `tools`, `tool_categories`, `media`,
   `contact_messages` tables, the `articles` Storage bucket, and every RLS /
   Storage policy.
2. **Create at least one admin account.**
   - Sign up a normal Supabase Auth user (or create one), then set the flag:
     ```sql
     update public.profiles set is_admin = true where email = 'you@example.com';
     ```
     Create the matching `public.profiles` row through a trusted SQL/service-role
     operator if it does not exist. Never grant administration based on editable
     user metadata. The admin panel reads the protected `profiles.is_admin` flag;
     ordinary authenticated users cannot update it.
3. **Verify** with the checks below.

## What the front-end does vs. what RLS must allow

| Front-end call | Role | RLS requirement |
|---|---|---|
| `blog.js` reads `articles` | anon | `SELECT` only when `status = 'published'` |
| `search.js` reads `articles` / `tools` | anon | published only / `is_active = true` only |
| `contact.js` inserts `contact_messages` | anon | `INSERT` only, restricted to `name`,`email`,`message`, with length checks |
| `admin.js` reads `articles`/`tools`/`contact_messages`/`profiles` | authenticated admin | `SELECT` via `public.is_admin()` (or own profile row) |
| `admin.js` creates/updates/deletes articles & tools | authenticated admin | `INSERT`/`UPDATE`/`DELETE` via `public.is_admin()` |
| `admin.js` uploads to the `articles` bucket | authenticated admin | Storage `INSERT`/`UPDATE`/`DELETE` via `public.is_admin()` |
| Public article page downloads document | anon | Storage `SELECT` on `articles` bucket (public read) |

## Security design decisions

- **`public.is_admin()` is a `security definer` function.** It resolves the role
  from `profiles` **server-side** and never trusts a client-supplied flag. This
  is what makes `admin.js`'s front-end `is_admin` check insufficient on its own —
  even if that check is bypassed, RLS rejects the write.
- **`profiles` has no anon access.** The publishable key cannot read, or
  enumerate, the admin table. A signed-in user may only read their own row.
- **`articles` has a `status` column.** The anon SELECT policy exposes only
  `published` rows; drafts and archived articles are invisible to the public.
- **`contact_messages` is insert-only for anon**, with length predicates in the
  policy, and no anon read/update/delete. Admin triage (read/archive/delete) is
  authenticated-only.
- **Storage bucket `articles` is public for read, admin-only for write.** This is
  the real defence against the "upload an HTML file named `.pdf`" class of
  attack: `admin.js` preflights magic bytes and forces a correct `Content-Type`
  (see `assets/js/filevalidate.js`), but only RLS stopping non-admin uploads makes
  it trustworthy.

## Known limits / things you must add

- **Rate limiting on the contact form is not fully implemented here.** The
  client cooldown (`contact.js`) is cosmetic. See the comment in
  `00_schema_migrations.sql` (§6) for the options (Postgres trigger, Edge
  Function + CAPTCHA, or an aggregate RLS check). This document flags it as
  **NOT** verified rather than pretending it exists.
- **Storage object deletion on article delete/replace** is now handled in
  `admin.js` after successful DB writes, with rollback cleanup for failed saves.
  A periodic reconciliation job is still useful for legacy orphan objects
  created before this fix.
- These policies must be **applied to the live project**. This repo cannot set
  them from the client, and the live site has not been re-verified against a
  deployment of these statements in this session.


## Existing production projects and fresh-install regression coverage

Do **not** replay the entire base setup over an already hardened live project.
Compare the live schema/migration history first and apply reviewed forward changes.
`01_repair_product_storage_buckets.sql`, `02_production_reconciliation_2026_09_18.sql`
and `03_admin_hardening_2026_09_19.sql` reflect historical production schemas;
02/03 refer to legacy columns/functions and are not a universal fresh-install
sequence. In particular, 03 uses a private SECURITY DEFINER helper with a public
SECURITY INVOKER wrapper. Preserve that stronger deployed arrangement.
Never replay the historical destructive Academy reset migration on production.

The A-to-Z audit corrected base-schema ordering (profiles/products before their
functions/grants/triggers), a duplicate Storage policy on rerun, and overly broad
base contact INSERT permission. Reconciliation 02 already restricts contact
columns on deployments where it was applied; this was not evidence that the live
inbox could be modified anonymously. Source fixtures test fresh installation twice,
public/draft separation, non-admin privilege escalation, contact column grants,
private product files and authorized admin CRUD:

```sh
NODE_PATH=$PWD/tools/qa-deps/node_modules node tools/test_site_database.js
```

This is disposable PostgreSQL with modeled Supabase-owned auth/storage schemas.
It is not an inspection of production RLS. Contact anti-spam remains an open
operational gap: direct REST inserts have no server-verified challenge/rate gate
in this repository. The browser cooldown/honeypot is not such a gate.
