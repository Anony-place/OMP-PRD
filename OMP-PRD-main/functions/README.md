# OMP Firebase Functions

This directory contains Firebase Cloud Functions for OopsMyPassword.

## Functions

### `sitemap`
- **Endpoint**: `/sitemap.xml`
- **Purpose**: Dynamic XML sitemap generation
- **Method**: HTTP GET
- **Response**: `application/xml; charset=utf-8`

## Features

- ✅ **Dynamic Content**: Fetches published articles and products from Supabase
- ✅ **Static Routes**: Includes all important static pages
- ✅ **XML Safety**: Proper XML escaping of all values
- ✅ **Error Handling**: Returns fallback sitemap if Supabase fails
- ✅ **Caching**: 5-minute cache for dynamic content
- ✅ **Security**: Uses publishable key (no service-role exposure)
- ✅ **Deduplication**: Removes duplicate URLs

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

### 4. Deploy Functions
```bash
firebase deploy --only functions
```

### 5. Update Firebase Hosting
The `firebase.json` file already includes the rewrite rule:
```json
{ "source": "/sitemap.xml", "function": "sitemap" }
```

Deploy the updated hosting configuration:
```bash
firebase deploy --only hosting
```

## Static Routes Included

The sitemap automatically includes these static routes:
- `/` (Home)
- `/checker/` (Password Checker)
- `/generator/` (Password Generator)
- `/tools/` (All Tools)
- `/articles/` (Articles Hub)
- `/products/` (Products Hub)
- `/breach-check/` (Breach Check)
- `/about/` (About)
- `/privacy/` (Privacy Policy)
- `/terms/` (Terms)
- `/contact/` (Contact)
- `/faq/` (FAQ)
- `/glossary/` (Glossary)
- `/security/` (Security)
- `/password-health/` (Password Health)
- `/entropy/` (Entropy Calculator)
- `/passphrase/` (Passphrase Generator)
- `/random-string/` (Random String Generator)
- `/security-checklist/` (Security Checklist)

## Dynamic Content

### Articles
- Fetches all published articles from Supabase
- Generates URLs: `https://oopsmypassword.com/articles/{slug}`
- Uses `published_at` → `updated_at` → `created_at` for `lastmod`
- Excludes drafts and archived content

### Products
- Fetches all published products from Supabase
- Generates URLs: `https://oopsmypassword.com/products/{slug}`
- Uses `published_at` → `updated_at` → `created_at` for `lastmod`
- Excludes drafts and archived content

## Security Considerations

- ✅ **No Service Role Key**: Uses only publishable key
- ✅ **RLS Respected**: Only fetches `status = 'published'` content
- ✅ **XML Injection Protection**: All values properly escaped
- ✅ **Error Isolation**: Supabase errors logged but not exposed to clients
- ✅ **Fallback Safety**: Returns valid static sitemap if Supabase fails

## Testing

### Local Testing
```bash
# Start Firebase emulator
firebase emulators:start --only functions

# Test the function
curl http://localhost:5001/oopsmypassword/us-central1/sitemap
```

### Production Testing
After deployment, verify:
1. ✅ `https://oopsmypassword.web.app/sitemap.xml` returns valid XML
2. ✅ Static routes are included
3. ✅ Published articles appear
4. ✅ Published products appear
5. ✅ Draft content does NOT appear
6. ✅ XML is properly formatted
7. ✅ Content-Type header is `application/xml; charset=utf-8`

## Performance

- **Cache**: 5 minutes (300 seconds)
- **Supabase Queries**: Concurrent requests for articles and products
- **Response Size**: Typically 5-20KB depending on content count
- **Response Time**: < 500ms under normal conditions

## Robots.txt

The `robots.txt` file points to:
```
Sitemap: https://oopsmypassword.web.app/sitemap.xml
```

This ensures search engines can discover the sitemap.

## Deployment Notes

1. **First Deployment**: Run `firebase deploy` to deploy both functions and hosting
2. **Subsequent Updates**: Deploy only the changed component:
   - Functions only: `firebase deploy --only functions`
   - Hosting only: `firebase deploy --only hosting`
3. **Monitoring**: Check Firebase Console → Functions for logs and metrics