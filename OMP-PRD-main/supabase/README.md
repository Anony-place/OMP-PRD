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
the *proof* of what the server actually allows. It must be applied in the
Supabase project (Dashboard → SQL Editor, or your project's `supabase/migrations`
folder) and kept in sync with any schema change.

## Files

| File | Purpose |
|---|---|
| `00_schema_migrations.sql` | Tables, `is_admin()` helper, RLS policies, Storage bucket `articles` policies, and anon revoke/grant. Applied via the Supabase SQL Editor or a migration tool. |

## Required application order

1. **Run `00_schema_migrations.sql`** in the SQL Editor (it is idempotent,
   `drop policy if exists` / `create or replace`). This creates the `profiles`,
   `articles`, `article_categories`, `tools`, `tool_categories`, `media`,
   `contact_messages` tables, the `articles` Storage bucket, and every RLS /
   Storage policy.
2. **Create at least one admin account.**
   - Sign up a normal Supabase Auth user (or create one), then set the flag:
     ```sql
     update public.profiles set is_admin = true where email = 'you@example.com';
     ```
     (An `on auth.users insert` trigger or the dashboard "user metadata"
     approach works too. The `/admin/` panel's `checkAdmin()` reads
     `public.profiles.is_admin` for the signed-in user.)
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
- **Storage object deletion on article delete/replace** isn't wired in
  `admin.js` (orphaned files remain after deleting an article or swapping the
  document). A cleanup job or an `on delete` hook in an Edge Function is a
  follow-up; the bucket policy above still prevents unauthorized writes.
- These policies must be **applied to the live project**. This repo cannot set
  them from the client, and the live site has not been re-verified against a
  deployment of these statements in this session.
