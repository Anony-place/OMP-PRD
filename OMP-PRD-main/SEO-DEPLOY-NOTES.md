# SEO deployment verification

The article route is rendered by the Firebase `article` function so the initial HTTP response contains the article title, description, canonical URL, content, Article JSON-LD and BreadcrumbList JSON-LD.

Published Supabase articles are queried by slug and status. Missing/unpublished slugs return HTTP 404 with `noindex`; published slugs return HTTP 200.

The Firebase hosting wildcard `/articles/**` is routed to the `article` function after the existing static guide rewrites.

Deployment must publish both Hosting and Functions before Search Console URL Inspection is requested.
