# OMP Firebase Functions

This directory contains Firebase Cloud Functions for OopsMyPassword.

## Functions

### `sitemap`
- **Endpoint**: `/sitemap.xml` (Hosting rewrite → this function)
- **Purpose**: Dynamic XML sitemap generation
- **Method**: HTTP GET or HEAD (other methods → 405)
- **Response**: `application/xml; charset=utf-8`

Firebase Hosting serves a committed static file *before* it evaluates function rewrites. `firebase.json` therefore **ignores** `sitemap.xml` from the Hosting upload so the rewrite can actually run. The committed `sitemap.xml` is kept as a local-test / fallback snapshot only.

## Features

- Dynamic content: fetches published articles and products from Supabase
- Static routes: pretty public URLs (no trailing slash, matching `trailingSlash: false`)
- XML escaping of all values
- Fallback sitemap of static routes if Supabase fails
- 5-minute `Cache-Control` on the response
- Publishable key only (no service-role exposure)
- Deduplication of URLs
- Slug charset filter + 2000-row query cap

## Setup

### 1. Install Dependencies
```bash
cd functions
npm install
```

### 2. Firebase Configuration
Ensure you have Firebase CLI installed and authenticated:
```bash
npm install -g firebase-tools
firebase login
```

### 3. Environment Variables
The function uses the following environment variables (with fallback values):
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_PUBLISHABLE_KEY`: Supabase publishable key

To set custom values, create a `.env` file in the functions directory:
```
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

### 4. Deploy Functions **and** Hosting
The rewrite only wins after Hosting is redeployed with `sitemap.xml` ignored:

```bash
firebase deploy --only functions,hosting
```

`firebase.json` includes:

```json
{
  "functions": { "source": "functions", "runtime": "nodejs18" },
  "hosting": {
    "ignore": ["sitemap.xml"],
    "rewrites": [{ "source": "/sitemap.xml", "function": "sitemap" }]
  }
}
```

## Static Routes Included

Pretty public URLs (no trailing slash):
- `/` (Home)
- `/checker` (Password Checker)
- `/generator` (Password Generator)
- `/tools` (All Tools)
- `/articles` (Articles Hub)
- `/products` (Products Hub)
- `/breach-check` (Breach Check)
- `/about` (About)
- `/privacy` (Privacy Policy)
- `/terms` (Terms)
- `/contact` (Contact)
- `/faq` (FAQ)
- `/glossary` (Glossary)
- `/security` (Security)
- `/sitemap` (HTML sitemap)
- `/password-health` (Password Health)
- `/entropy` (Entropy Calculator)
- `/passphrase` (Passphrase Generator)
- `/random-string` (Random String Generator)
- `/security-checklist` (Security Checklist)
- plus the 15 baked-in `/articles/<guide-slug>` pages

## Dynamic Content

### Articles
- Fetches published articles from Supabase (capped at 2000)
- Generates URLs: `https://oopsmypassword.com/articles/{slug}`
- Uses `published_at` → `updated_at` → `created_at` for `lastmod` (UTC date)
- Excludes drafts, archived content, and invalid slugs

### Products
- Fetches published products from Supabase (capped at 2000)
- Generates URLs: `https://oopsmypassword.com/products/{slug}`
- Same `lastmod` and slug rules as articles

## Security Considerations

- No service-role key: uses only the publishable key
- RLS respected: queries `status = 'published'`
- XML injection protection: all values escaped
- Error isolation: Supabase errors logged, not exposed to clients
- Fallback safety: returns a valid static sitemap if Supabase fails

## Testing

### Local Testing
```bash
firebase emulators:start --only functions
curl http://localhost:5001/oopsmypassword/us-central1/sitemap
```

The local Hosting router used by `tools/test_runtime.js` / `tools/smoke_all_pages.js` treats `/sitemap.xml` as a function rewrite and falls back to the committed XML file (Cloud Functions are not running in those tests).

### Production Testing
After deploying **functions and hosting**:
1. `https://oopsmypassword.com/sitemap.xml` returns valid XML from the function
2. Static routes are included without trailing slashes
3. Published articles and products appear
4. Draft content does not appear
5. Content-Type is `application/xml; charset=utf-8`

## Performance

- Cache: 5 minutes (300 seconds)
- Supabase queries: concurrent articles + products
- Response size: typically 5-20KB depending on content count

## Robots.txt

```
Sitemap: https://oopsmypassword.com/sitemap.xml
```

## Deployment Notes

1. First deployment: `firebase deploy` (functions + hosting together)
2. Subsequent updates: `firebase deploy --only functions,hosting` whenever the sitemap rewrite or ignore list changes
3. Monitoring: Firebase Console → Functions for logs and metrics
