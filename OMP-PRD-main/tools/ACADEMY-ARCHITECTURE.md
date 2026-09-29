# Academy curriculum architecture

> **Current contract:** learners no longer sign in. Name/progress/self-checks are
> device-only; email is exclusively optional article subscription. See
> [the local-first audit](SITE-LOCAL-FIRST-AUDIT.md) and
> [newsletter setup](NEWSLETTER-SETUP.md). Account-backed grading/deployment
> instructions below describe the historical implementation; they are not
> prerequisites for local learner progress. Content-hierarchy migrations still
> apply to live catalogue publishing. Preserve old records; never rerun a reset.


Current expansion: [subject-neutral courses and authoring](ACADEMY-MULTI-SUBJECT.md).
The public hierarchy is now **Category → Course → Module → Lesson**; historical
`learning_paths`/`learning_topics` table names remain for compatibility.

## Research and the gap being addressed

The previous Academy treated a category as a list of lessons. It didn't explain
what the Academy was, whether a learner belonged there, what to know first, how
lessons related, or where a finished topic led. Making the list prettier did not
solve this orientation problem.

Research used for this revision:

1. PortSwigger describes learning paths broken into topics/modules, intended to
   reduce the difficulty of deciding where to begin. Adopted: an explicit order
   and small, goal-based units—not their syllabus or a claim of affiliation.
   [1](https://portswigger.net/blog/new-learning-paths-from-the-web-security-academy)
2. MDN separates getting started, core, and extension modules, and explains the
   audience and starting point. Adopted: prerequisites, outcomes, and a clear
   boundary between the available foundation and further external study.
   [2](https://developer.mozilla.org/en-US/curriculum/)
3. MDN's educator guidance emphasizes clear progression, learning objectives,
   and assessments. Adopted: module-level outcomes and the existing
   learn/practice/check rhythm.
   [3](https://developer.mozilla.org/en-US/docs/Learn_web_development/Educators)
4. Google documents crawling/rendering/indexing and recommends that initial
   and rendered canonical URLs agree. Adopted: static public HTML, real links,
   self-canonicals, and no client-side canonical rewriting.
   [4](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)

## Information architecture

```text
Academy                            /learning
├── Choose your direction           /learning/roadmap
└── Category                       /learning/web-application-security
    ├── Subject roadmap            /learning/web-application-security/roadmap
    └── Course                     /learning/web-application-security/foundations
        ├── Module: Understand the web             #module-how-the-web-works
        │   ├── Web Application Security Fundamentals
        │   └── HTTP Requests & Responses
        └── Module: Protect identity & access      #module-identity-and-access
            ├── Authentication & Session Security
            └── Access Control & Authorization
```

A **category** answers “Which subject?” A **course** answers “What goal?”
There is no extra subcategory layer or shared mandatory cross-subject roadmap.
A **module** groups related topics and defines what the learner should understand
by its end. A **lesson** is the reading/practice/quiz unit (stored in `learning_topics`).

Modules deliberately use anchors on their course rather than empty standalone SEO
pages. Topic URLs include category/course/lesson; sections within a topic use hash
navigation, not separately indexed URLs. There is no arbitrary recursive folder
tree, artificial unlocking, or duplicated topic content across multiple URLs.

The current library is **one category, one course, two modules, four lessons**.
There are no fake unavailable courses, invented launch dates, or claims that
these foundations constitute a full cybersecurity career qualification.

## Publishing new content

Production source: `learning_categories`, `learning_paths`, `learning_modules`,
`learning_topics`, and `learning_labs` in Supabase. The hierarchy migration is
additive: existing topic UUIDs, quizzes, progress, and certificates are unchanged.

1. Create an active category for a genuinely distinct field. Keep a stable,
   descriptive, unique slug. Do not use the reserved category slug `roadmap` or the file-routing slug `index`.
2. Create a **draft** course (`learning_paths`) within the category. Supply a title, description,
   audience, difficulty, prerequisite skill statements, measurable outcomes,
   and honest next steps. `is_start_here` marks a recommended starting course;
   at most one published course per category may carry that flag.
3. Create **draft** modules with the same `category_id`, the course's `path_id`,
   stable slug, description, explicit outcome, and a numeric `sort_order`.
4. Create topics with a `module_id` and matching `category_id`. Populate the
   subject-appropriate `content.sections` with paragraph/list/code blocks, a
   description, and HTTPS references. The original six-field security format
   remains supported; new subjects are not forced to use it. Incomplete lessons must stay draft. `sort_order` determines topic
   order within a module; module order is independent. Keep the old UUID when
   editing a topic, so saved progress and certificates continue to refer to it.
5. Add authorized lab links and configure assessments/answer keys server-side.
   Do not place answer keys in the JSON catalogue or HTML. Review correctness
   rather than assuming generated assessment data is reliable.
6. Review and publish the hierarchy. Draft/archived parents hide descendants
   in public RLS reads and in generated navigation. Empty paths/categories are
   omitted. Invalid slugs, duplicate routes, missing module assignments, or
   cross-category links fail validation.
7. Run the normal static publishing pipeline and deploy the resulting artifact.
   Database edits **do not become public site content until a successful build**.
   This keeps initial HTML, rendered UI, canonicals and sitemap in agreement.
8. If changing a published slug, add an explicit 301 from its old canonical URL.
   The builder preserves existing redirects and supplies redirects for the old
   flat `/learning/<category>/<topic>` URLs. It cannot infer arbitrary historical
   slug changes. Retired pages are removed from generated HTML and the sitemap.

There is **no new admin CMS UI** in this change. Curriculum management is through
trusted Supabase administration/migrations, with draft/published states and the
validated publisher. Anonymous and normal learner roles cannot edit curriculum.

## Implementation boundaries

- `assets/js/academy-model.mjs`: hierarchy validation, ordered collections,
  canonical routes, route resolution and breadcrumbs. No DOM or database access.
- `assets/js/academy-views.mjs`: shared public orientation, category, path,
  roadmap and static full-lesson views used by publisher and browser.
- `assets/js/academy-content.mjs`: safe subject-neutral section/block validation
  and legacy lesson compatibility. No raw HTML or executable code.
- `assets/js/academy-ui.mjs`: shared HTML escaping, HTTPS link validation and icons.
- `assets/js/learning.js`: account dialog, progressive reader, local reading
  bookmarks, server-authoritative progress and quizzes, certificate verification.
- `scripts/build-academy.mjs`: allowlisted public database reads (paginated),
  HTML/canonical/schema generation, sanitized public catalogue, known legacy
  redirects, stale-page cleanup, generated route manifests.
- `tools/academy-shell.html`: non-public template. Do not hand-edit generated
  `learning.html`, `learning/**/*.html` or `certificate.html`.
- `assets/data/academy-catalogue.json`: exact published public content used by the
  browser. No quiz questions, answer keys or learner/account records.
- `supabase/academy-curriculum.json`: reviewed local seed hierarchy, mirrored in
  the additive SQL migration. Not a second live content store or public endpoint.
- `assets/data/academy-reading.json`: reviewed local seed for explicit offline
  builds, regenerated with `python3 tools/build_academy_snapshot.py`. It is no
  longer a separate runtime catalogue fallback. No private/draft data belongs here.

## SEO rules

Public pages contain their headings, lesson body and navigation in their initial
HTTP response. JavaScript enhances the same content; there is no bot detection,
cloaking or separate search-only copy. With JavaScript disabled, the full lesson
remains readable and category → path → topic navigation still works.

Each public route has one static self-canonical and unique title/description.
Breadcrumb markup follows the real hierarchy. Topics use `LearningResource`;
category/path/home pages use `CollectionPage`. No fabricated ratings, reviews,
course accreditation, price claims, or guaranteed rich-result eligibility.

The published route manifest drives both sitemap copies. Certificates are
`noindex, follow`, without a canonical pointing all recipients to one URL, and
excluded from the sitemap. Unknown Academy URLs return an actual HTTP 404—the
old catch-all Academy rewrite is removed. Existing flat lesson links 301 to the
new canonical route and browser bookmarks still use the original topic UUID.

Improved crawlability is not a ranking guarantee. Search Console indexing,
actual Core Web Vitals and real-user search performance still need observation
after deploying the final public artifact.

## Transactional assessment and release safety

All progress/quiz writes go through the service-only `academy_mutate` RPC with
per-learner/topic row locking. It validates the full publication hierarchy,
enforces cooldowns, and commits the score and certificate atomically. Client
reading bookmarks are not server completion. Quiz revisions prevent old tabs
from being graded against edited questions; option display order is shuffled.
The current assessment format is four questions, four options each, 15/20 to pass.

See [fix verification](ACADEMY-FIX-VERIFICATION.md) and
[release notes](ACADEMY-RELEASE.md) for tests and the coordinated rollout.
