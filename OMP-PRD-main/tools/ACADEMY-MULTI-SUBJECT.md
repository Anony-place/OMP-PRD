# Subject-neutral Academy — implementation and authoring guide

> Updated product contract: learner name, progress and self-check results are
> local-only, with no login. Email subscription is separate. The hierarchy and
> routing below remain current; historical server-grading verification counts
> describe the previous phase. See [current audit](SITE-LOCAL-FIRST-AUDIT.md).

## What is implemented

The learner-facing hierarchy is now:

**Academy → Category (subject) → Course → Module → Lesson**

- `/learning`: neutral OMP Academy home; browse subjects, not a mixed lesson feed.
- `/learning/roadmap`: choose a subject, not a compulsory web-security sequence.
- `/learning/<category>`: courses belonging only to that subject, with local search/level filters.
- `/learning/<category>/roadmap`: that subject's starting course, prerequisites and module outlines.
- `/learning/<category>/<course>`: that course's curriculum, outcomes and progress.
- `/learning/<category>/<course>/<lesson>`: a focused reader with next-lesson navigation inside the same course.

The historical table/key names `learning_paths` / `path_id` remain for compatibility.
They represent **courses**, not an additional hidden layer. `learning_topics`
represents lessons. IDs, existing lesson URLs and saved learner records are kept.
There is no cross-course "learning path" feature being claimed here.

## Why future courses do not get mixed

1. Each course belongs to one category; each module belongs to one course.
2. Lessons carry a course ID consistent with their module and category. PostgreSQL
   composite foreign keys enforce the relationship, not just the sidebar UI.
3. Lesson slugs are unique **within a course**, not the whole category. Both of
   these routes can exist with independent lesson IDs:
   - `/learning/programming/python-fundamentals/introduction`
   - `/learning/programming/javascript-fundamentals/introduction`
4. A flat `/learning/programming/introduction` alias is not guessed when ambiguous.
   Existing historical redirects are preserved; a new canonical route cannot
   silently collide with an existing redirect.
5. Recommended starting courses are per subject. Opening Programming does not
   recommend that everyone first complete Web Security Foundations.
6. Course progress reads use only that course's local lesson records. Reading bookmarks
   are stored per user, course and lesson; visiting JavaScript does not erase the
   last Python lesson you were reading.
7. Subject/course breadcrumbs, course-local next-lesson links and contextual
   metadata distinguish identically named lessons. Historical server-issued certificates retain their owning course context. New
   local completions are not issued as verified certificates.

## Add a future programming course

These examples explain the structure; they are **not published course content**.
The actual checked-in catalogue remains the existing Web Application Security
subject with Web Security Foundations, two modules and four lessons.

1. Add an active `learning_categories` row for Programming, slug `programming`.
   Use a genuinely distinct subject; do not put Programming under Web Security.
2. Create a draft `learning_paths` row for a course such as Python Fundamentals,
   slug `python-fundamentals`, with the Programming category ID. Fill in audience,
   description, prerequisites, outcomes, difficulty and next steps. Mark at most
   one published course per subject `is_start_here=true`.
3. Add modules in `learning_modules`, using that course's `path_id` and category ID.
   Give every module an outcome and its own order **within that course**.
4. Add lessons in `learning_topics` with the module ID and matching category ID.
   The new trigger derives `path_id` when omitted. An explicitly wrong course ID
   is rejected. Use stable IDs/slugs; do not reuse a different course's lesson ID.
5. Put the lesson's content in `content.sections`. For example:

```json
{
  "sections": [
    {
      "id": "overview",
      "title": "What is a variable?",
      "blocks": [
        {
          "type": "paragraph",
          "text": "A name can refer to a value you want to use again."
        }
      ]
    },
    {
      "id": "examples",
      "title": "A first example",
      "blocks": [
        {
          "type": "code",
          "language": "python",
          "text": "name = \"Ada\"\nprint(name)"
        },
        {
          "type": "list",
          "items": [
            "Run the example in your own environment.",
            "Change the name and explain the output."
          ]
        }
      ]
    },
    {
      "id": "exercise",
      "title": "Try it yourself",
      "blocks": [
        {
          "type": "paragraph",
          "text": "Create a variable for a city and print a greeting containing it."
        }
      ]
    }
  ],
  "references": ["https://docs.python.org/3/tutorial/"],
  "practice_guidance": "Use your own Python environment and work through the linked practice resource."
}
```

6. Add external practice resources to `learning_labs`. Optional public practice
   questions go in `content.self_check`, with four `questions`, each containing
   `question`, four `options`, zero-based `answer`, and `explanation`. These are
   intentionally public learning material. The browser scores them out of 20
   (15 to pass), allows immediate retries, and stores results locally. Existing
   private server exam keys are not exported. The four current foundation
   lessons have separately authored public checks in
   `assets/data/academy-self-checks.json`. A lesson without a check can be marked
   reviewed locally, without inventing a quiz score or issuing a certificate.
7. Review the material, publish the complete parent chain and rebuild through
   `scripts/build-academy.mjs` (live mode) and the existing Hosting pipeline.
   Only reviewed, populated, published courses enter the public catalogue.

No frontend code change is required just to add another category/course or a
lesson with different section headings. Content authors must still write and
review genuine lessons, exercises and assessments.

### Lesson format rules

- 1–30 uniquely named sections; each has a stable slug ID, title and non-empty blocks.
- Supported blocks: `paragraph`, `list`, `code`. Strings are escaped; no raw HTML,
  script execution, embeds or code execution is enabled by these blocks.
- `labs`, `quiz`, `account`, `main`, `learning-app` and legacy `s-01`–`s-08` IDs
  are reserved. A bad block or empty section stops publication before replacing
  the previous output.
- HTTPS references are required. Optional metadata: `seo_title`, `seo_description`,
  `keywords`; optional lesson-specific `practice_guidance`.
- The existing six-field security lesson format remains supported, including its
  original section IDs/bookmarks. New subjects are **not** required to use
  “Defensive thinking”, “What to look for” or a fixed six-section template.
- Category/course slug `roadmap` and routing slug `index` are reserved.
- Keep an existing lesson in its owning course. If reusing material in another
  course, create a deliberate new lesson with its own ID; do not silently move
  a learner's completed lesson to an unrelated course. PostgreSQL rejects a
  cross-course move or unassignment once learner history exists.

## Deployment

New forward migration:

`supabase/migrations/20260929200000_academy_multi_subject_courses.sql`

Apply this after the four earlier forward migrations listed in `ACADEMY-RELEASE.md`.
It backfills lesson course IDs, changes slug uniqueness to course scope, adds
relationship/route guards and snapshots course context on lesson certificates.
It does not delete learner records or change existing certificate IDs/scores.

Redeploy `learning-certificate-verify` because its public projection now includes
`course_name`, then deploy the matching frontend/publication changes. The previous
atomic progress/quiz handlers and their required migrations must also be deployed
if that earlier rollout has not happened. **Never rerun the destructive reset seed.**

No production migration, live learner write or deployment was performed here.

## Verification

Private fixtures cover **three subjects and four courses**: the existing security
course plus Python, JavaScript and Interface Design. They are in `tools/`, which
is excluded from public Hosting—not in the real catalogue.

- `test_academy_multisubject.mjs`: model, route, scoped roadmap/curriculum/progress,
  safe flexible content, duplicate slugs and draft isolation.
- `test_academy_course_database.js`: actual PostgreSQL foreign keys/uniqueness,
  course-derived assignment, progress isolation, publication boundaries and
  course context on identically named lesson certificates.
- `academy_browser_test.js`: real browser interaction with private fixtures;
  subject search, independent progress, independent bookmarks, custom section
  navigation, code escaping, no-JS reading and mobile/accessibility checks.
- `test_academy_build.mjs`: actual publisher builds the three-subject fixture in a
  temporary directory and passes the complete HTML/link/SEO gate. Both Introduction
  lessons get distinct canonicals/titles; no ambiguous flat redirect is created.
- Existing migration, backend, real-concurrency and general runtime checks remain
  in place. CI runs the new model/database tests as well.

Run with the pinned QA dependencies described in `ACADEMY-RELEASE.md`:

```sh
node tools/test_academy_multisubject.mjs
node tools/test_academy_course_database.js
node tools/test_academy_build.mjs
node tools/academy_browser_test.js
```

### Executed local results — 29 September 2026

| Suite                                         | Result                                           |
| --------------------------------------------- | ------------------------------------------------ |
| Browser / responsive / accessibility          | 49 checks, including 11 axe scans                |
| Multi-subject model/view isolation            | 8 checks                                         |
| Multi-course PostgreSQL                       | 7 checks                                         |
| Migration preservation / RLS                  | 8 checks                                         |
| Actual backend handlers with local PostgreSQL | 10 regression groups                             |
| Real overlapping PostgreSQL transactions      | 5 checks                                         |
| Publication / answer-option mapping           | 15 checks                                        |
| Model / generated-page SEO                    | 19 checks                                        |
| Isolated full publishing pipeline             | 6 checks                                         |
| General runtime                               | 582 checks                                       |
| Reviewed content / snapshot                   | 4 checks                                         |
| Sitemap / deployment wiring                   | 25 checks                                        |
| Static HTML / SEO                             | 48 pages, 44 sitemap URLs; no errors or warnings |
| Deno type checking                            | All three Academy handlers pass                  |
| Whitespace validation                         | `git diff --check` passes                        |

The browser ran against the local preview with real Chromium. Database tests
used disposable local databases, not production. The CI job is configured but
GitHub-hosted CI and a production deployment were not executed in this session.

## Boundaries — do not overstate the result

This is a subject-neutral course structure and flexible lesson reader, not a
new visual CMS, embedded IDE, automatic programming-assignment grader or paid
course platform. Existing certificates are explicitly **lesson completion**
certificates with course context, not whole-course certificates. Those features
would need their own implementation and validation if required later.

These fixtures verify separation, not high-volume load capacity. The current
public catalogue is a single JSON payload; profile its size and add pagination
and lazy lesson loading as needed before a large-scale content rollout. That does
not require changing the category/course hierarchy.
