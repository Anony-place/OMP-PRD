/* ============================================================
   Setup: what is still missing, said plainly.

   The publishing pipeline spans four places that are configured by hand -
   Supabase migrations, a GitHub token, function secrets, a repository
   variable - and when one is missing the visible symptom is a vague "the
   deploy could not start". That message is true and useless.

   This turns probe results into a checklist. The probes live in the panel,
   because they need the user's own session; everything here is pure, so it can
   be tested without a browser or a database.

   A check has three states and they are not the same thing:
     ok       the probe succeeded
     missing  the probe ran and the thing is not there
     unknown  the probe could not run (no network, function not deployed)
   "Unknown" must never be rendered as "missing": telling someone to re-run a
   migration that is already applied is worse than saying nothing.
   ============================================================ */

export const CHECKS = [
  {
    id: 'articles',
    label: 'Articles table',
    why: 'Everything the panel writes lives here.',
    fix: 'Apply supabase/00_schema_migrations.sql in the SQL editor.'
  },
  {
    id: 'publish_jobs',
    label: 'Publishing queue',
    why: 'Without it the panel cannot tell you whether a deploy ran, so "published" means "saved".',
    fix: 'Apply supabase/migrations/20261101120000_publish_jobs_and_scheduling.sql.'
  },
  {
    id: 'redirects',
    label: 'Redirects table',
    why: 'A renamed slug keeps working only if the old path is recorded.',
    fix: 'Apply supabase/migrations/20261101140000_redirects.sql.'
  },
  {
    id: 'article_revisions',
    label: 'Article history',
    why: 'Restoring an earlier version needs the snapshot table and its trigger.',
    fix: 'Apply supabase/migrations/20261101150000_article_revisions.sql.'
  },
  {
    id: 'audit_log',
    label: 'Activity log',
    why: 'Who changed what, for the tables that are not versioned.',
    fix: 'Apply supabase/migrations/20261101170000_audit_log.sql.'
  },
  {
    id: 'categories',
    label: 'Category functions',
    why: 'Deleting a category moves its articles; without the function it can only un-file them.',
    fix: 'Apply supabase/migrations/20261101160000_categories.sql.'
  },
  {
    id: 'function',
    label: 'Publish function',
    why: 'The panel calls it to start a deploy. No function, no deploy.',
    fix: 'Run: supabase functions deploy content-publish'
  },
  {
    id: 'github_token',
    label: 'GitHub token',
    why: 'The function uses it to ask GitHub for a build. It needs Contents: read and write.',
    fix: 'supabase secrets set GITHUB_PUBLISH_TOKEN=… (fine-grained, this repo only, Contents: read & write)'
  },
  {
    id: 'github_repo',
    label: 'Repository',
    why: 'Which repository to dispatch the build to.',
    fix: 'supabase secrets set GITHUB_REPO=Anony-place/OMP-PRD'
  }
];

/* Turn raw probe results into the list the panel renders.
     probes = {
       tables: { publish_jobs: true|false, ... },
       function: 'ok' | 'unreachable',
       configured: { github_token: bool, repo: bool }
     } */
export function diagnose(probes = {}) {
  const tables = probes.tables || {};
  const configured = probes.configured || {};

  const stateOf = (id) => {
    switch (id) {
      case 'function':
        if (probes.function === 'ok') return 'ok';
        if (probes.function === 'unreachable') return 'unknown';
        return 'unknown';
      case 'github_token':
        if (!configured || probes.function !== 'ok') return 'unknown';
        return configured.github_token ? 'ok' : 'missing';
      case 'github_repo':
        if (probes.function !== 'ok') return 'unknown';
        return configured.repo ? 'ok' : 'missing';
      case 'categories':
        /* The category function ships with the categories migration, and its
           table always exists, so the probe is whether the function is there. */
        if (tables.categories === undefined) return 'unknown';
        return tables.categories ? 'ok' : 'missing';
      default:
        if (tables[id] === undefined) return 'unknown';
        return tables[id] ? 'ok' : 'missing';
    }
  };

  return CHECKS.map((check) => ({ ...check, state: stateOf(check.id) }));
}

export function summarise(checks) {
  const total = checks.length;
  const ok = checks.filter((check) => check.state === 'ok').length;
  const missing = checks.filter((check) => check.state === 'missing').length;
  const unknown = checks.filter((check) => check.state === 'unknown').length;

  /* The publish path is the thing that has to work for an article to reach the
     site. A missing sitemap is a nuisance; a missing token means nothing
     publishes at all. */
  const publishPath = ['articles', 'publish_jobs', 'function', 'github_token', 'github_repo'];
  const blocked = checks.filter((check) => publishPath.includes(check.id) && check.state !== 'ok');

  return {
    total, ok, missing, unknown,
    blocked: blocked.map((check) => check.id),
    canPublish: blocked.length === 0,
    headline: blocked.length === 0
      ? 'Publishing is wired up. Saving a published article builds and deploys the site.'
      : `${blocked.length} step(s) stand between a save and a live page.`
  };
}

/* Plain text, so it can be copied into a message instead of described. */
export function asText(checks, summary) {
  const mark = { ok: '[x]', missing: '[ ]', unknown: '[?]' };
  const lines = [
    `OopsMyPassword admin setup - ${summary.ok}/${summary.total} ready`,
    '',
    ...checks.map((check) => `${mark[check.state]} ${check.label}${check.state === 'missing' ? ` — ${check.fix}` : ''}`)
  ];
  if (summary.unknown) {
    lines.push('', '[?] means the probe could not run, not that the step is undone.');
  }
  return lines.join('\n');
}
