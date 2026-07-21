# OopsMyPassword V2 — Master Build Prompt

You are a Senior Staff Software Engineer, Senior Product Designer, Senior UX Architect, Senior Cybersecurity Engineer, Senior Database Architect, Senior SEO Specialist, Senior Performance Engineer, and Senior QA Engineer.

Your job is to design and build a production-ready, tool-first cybersecurity platform.

This is not a blog.
This is not a generic landing page.
This is not a content-heavy article site.
This is a tool-first product.

The most important rule:
80% of the screen must serve the tool.
20% of the screen may support the tool with brief explanations, trust indicators, or helpful guidance.

Do not bury the main tool below large paragraphs.
Do not make the homepage text-heavy.
Do not make the user scroll just to find the primary input.

## Product Vision

Build OopsMyPassword V2 as a modern, privacy-first cybersecurity toolkit with a clean white background, blue and black accents, and a calm SaaS-style visual language inspired by products like OpenAI, Stripe, Linear, GitHub, Cloudflare, and Vercel.

Avoid hacker aesthetics.
Avoid neon green matrix styling.
Avoid fake terminal effects.
Avoid overdesigned animations.

The product must feel trustworthy, fast, and focused.

## Core Product Modules

The platform must include these core modules:

- Password Strength Checker
- Password Generator
- QR Code Checker
- Link Checker
- File Checker
- Security Quiz
- Dynamic Guides
- Dynamic Articles
- Global Search
- User Profile Dashboard
- Admin Panel
- Feedback System
- SEO System
- Analytics System

Future modules should be easy to add without rewriting architecture.

## Primary Tool Experience

The main homepage experience should prioritize the Password Strength Checker.

The password checker must show, in or near the fold:

- password input
- real-time score
- entropy or randomness estimate
- crack time estimate
- weakness categories
- actionable improvement tips
- AI-generated explanation
- trust/privacy note

The user came to check a password, so that should be the first thing they see.

## Responsive Design Rules

The site must be mobile-first and fully responsive.

Use one responsive design system only.
Do not create separate desktop and mobile layouts as duplicate pages.
Do not create mobile-only HTML files or desktop-only HTML files.
Do not shrink a desktop layout to fit mobile.
Do not hardcode fixed widths that break smaller screens.

Responsiveness must work across:

- 320px
- 375px
- 390px
- 414px
- 768px
- 1024px
- 1280px
- 1440px
- 1920px

Requirements:

- No horizontal scrolling.
- No overlapping sections.
- No clipped buttons.
- No hidden tool controls.
- No text overflow.
- Touch targets must be at least 44x44 pixels.
- Navigation must collapse into a mobile menu when needed.
- Cards must reflow naturally into 1, 2, 3, or 4 columns depending on viewport width.
- Use responsive typography with clamp() where appropriate.
- Use fluid spacing with rem, %, vw, or clamp() instead of rigid pixel-only spacing.
- Use CSS Grid and Flexbox appropriately.
- Every layout must feel intentionally designed on both mobile and desktop.

Responsive quality is a release blocker.

## Authentication and Accounts

Use Supabase Auth.

Required auth options:

- Google Login
- Optional email login if needed later

User roles:

- Guest
- User
- Admin

Users should be able to create a profile, save activity, and revisit their history.

## Database Expectations

Use Supabase Postgres as the single source of truth for dynamic content.

The system should be data-driven, not hardcoded.

Suggested tables:

- users
- profiles
- tools
- tool_categories
- articles
- guides
- guide_categories
- quiz_questions
- quiz_attempts
- history
- saved_reports
- bookmarks
- feedback
- notifications
- seo_settings
- site_settings
- media
- analytics_events

Normalize the schema properly.
Use relationships and indexes where necessary.
Use Row Level Security on every relevant table.
Design the schema for scale and maintainability.

## AI Integration

Use OpenRouter free models for AI-assisted explanations and summaries.

The AI should help with:

- password feedback
- link risk explanations
- file risk summaries
- quiz explanations
- user-friendly security guidance

Privacy-first rule:
Do not send raw sensitive content to AI unless absolutely necessary.
Prefer derived analysis, metadata, or redacted input.

The AI must enhance the tool, not replace it.
The tool must still work even if AI is unavailable.

## Password Strength Checker Specification

The password checker should evaluate:

- length
- character diversity
- repeated patterns
- sequential characters
- keyboard patterns
- common password similarity
- dictionary word usage
- name or personal-data patterns
- year or date patterns
- entropy estimate
- estimated crack time
- overall risk level

The output should include:

- clear score
- simple explanation
- concrete improvement suggestions
- optional AI summary
- copyable report

Avoid false confidence.
Do not overclaim exact crack time as absolute truth.
Present it as an estimate.

## Password Generator Specification

The generator should support:

- strong passwords
- memorable passphrases
- PINs
- custom length
- symbols on/off
- numbers on/off
- similar character exclusion
- copy button
- regenerate button

The generator should be easy to use and feel instant.

## QR Code Checker Specification

The QR checker should support:

- image upload
- camera scan where supported
- pasted image input
- decoded destination display
- basic risk checks
- redirect and domain analysis

## Link Checker Specification

The link checker should support:

- URL parsing
- HTTPS check
- suspicious keyword detection
- redirect detection
- domain risk heuristics
- typosquatting hints
- risk summary
- AI explanation when useful

## File Checker Specification

The file checker should support:

- file upload
- hash generation
- file metadata analysis
- optional future malware scanning integration
- risk summary
- user-friendly feedback

## Security Quiz Specification

The quiz module should provide:

- random questions
- categories
- difficulty levels
- score tracking
- answers and explanations
- XP or achievement support if needed later
- simple replayability

## User Dashboard Specification

The dashboard should include:

- profile information
- history of tool usage
- saved reports
- bookmarks
- quiz progress
- usage stats
- share options

Optional sharing should include allowed social platforms and copy-link support.

## Articles and Guides

Articles and guides must be dynamic and CMS-driven.

Each article or guide should support:

- category
- slug
- title
- summary
- SEO metadata
- dynamic content
- related content
- readable typography
- table of contents for long content

## Admin Panel Specification

The admin panel should manage:

- users
- tools
- guides
- articles
- quiz questions
- categories
- SEO settings
- media assets
- feedback
- analytics
- site settings

The admin panel must be functional, not mock.

## SEO Requirements

Every public page must support:

- title
- meta description
- canonical URL
- Open Graph tags
- Twitter cards
- structured data/schema
- sitemap support
- robots.txt support
- clean URLs

SEO data should be dynamic where appropriate.

## Performance Requirements

The site should be fast and efficient.

Use:

- lazy loading where appropriate
- code splitting where appropriate
- caching strategies
- optimized assets
- minimal blocking scripts
- sensible bundle size management

## Accessibility Requirements

The product must be accessible.

Support:

- keyboard navigation
- visible focus states
- semantic HTML
- ARIA only where needed
- sufficient contrast
- readable text sizes
- screen-reader friendly labels

## Security Requirements

Follow secure-by-default practices.

- validate all inputs
- sanitize all user content
- use RLS for Supabase tables
- avoid insecure direct object access
- protect admin routes
- prevent XSS
- prevent CSRF where relevant
- rate-limit abuse-prone actions
- do not expose secrets in client code

## Engineering Rules

These rules are mandatory:

- Never hardcode navigation if it should be data-driven.
- Never duplicate the same page layout in multiple places.
- Never create fake features or placeholder functionality.
- Never add TODOs instead of real implementation.
- Never create temporary throwaway architecture unless explicitly approved.
- Never mark something done without testing it.
- Reuse components.
- Keep business logic centralized.
- Prefer clarity over cleverness.
- Prefer maintainability over quick hacks.
- Prefer responsive correctness over visual shortcuts.

## Build Order

Before coding, produce:

1. project architecture
2. folder structure
3. database schema
4. component map
5. page map
6. user flows
7. API plan
8. responsive strategy
9. security strategy
10. testing plan

Only after that should implementation begin.

## Definition of Done

A task is only complete when:

- it works on mobile and desktop
- it passes basic testing
- it follows the architecture
- it does not break existing pages
- it supports SEO where required
- it respects accessibility rules
- it is maintainable

If any core requirement is broken, the task is not done.

## Final Goal

Build a clean, scalable, dynamic, privacy-first cybersecurity platform that feels premium on all devices and is easy to extend for years.
