/* ============================================================================
   content-publish — ask GitHub to rebuild and deploy the site.

   Called by the admin panel after an article is saved as published. The answer
   to "did my article go live" lives in publish_jobs, not in this response: this
   function only starts the work.

   Why an edge function instead of the panel calling GitHub directly:
     * the GitHub token must never reach the browser
     * is_admin must be checked server-side; the panel's own check protects the
       UI, not the action
     * ten saves in ten seconds must not become ten builds

   Required secrets (supabase secrets set ...):
     GITHUB_PUBLISH_TOKEN  fine-grained PAT, this repo only,
                           Contents: read & write  (GitHub requires write to
                           create a repository_dispatch event)
     GITHUB_REPO           e.g. Anony-place/OMP-PRD
     PUBLISH_FUNCTION_KEY  shared secret the workflow uses to report back
   ============================================================================ */

import { createClient } from "npm:@supabase/supabase-js@2.115.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2.115.0/cors";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });

/* A burst of saves should produce one build. 90 seconds is longer than a person
   takes to fix a typo and save again, and shorter than anyone's patience for a
   status chip. */
const COALESCE_SECONDS = 90;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const url = Deno.env.get("SUPABASE_URL") || "";
  const publishable = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const githubToken = Deno.env.get("GITHUB_PUBLISH_TOKEN") || "";
  const repo = Deno.env.get("GITHUB_REPO") || "";
  if (!url || !secret) return json({ error: "server is not configured" }, 500);

  /* ---- who is asking -------------------------------------------------- */
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "sign in first" }, 401);

  const userClient = createClient(url, publishable, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) return json({ error: "invalid session" }, 401);
  const user = userData.user;

  const admin = createClient(url, secret, { auth: { persistSession: false } });
  const { data: profile } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_admin) return json({ error: "not an admin" }, 403);

  /* ---- what is being asked -------------------------------------------- */
  let body: { reason?: unknown; targets?: unknown; action?: unknown; article?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    /* an empty body is a legitimate "something changed, rebuild it" */
  }
  /* ---- create an article from outside the panel -----------------------
     The panel writes articles straight to the table with the user's own
     session. Anything else - a script, a CI job, an editor - needs a path that
     enforces the same rules, so it goes through here, where is_admin has just
     been checked and the service role can write.

     The HTML is stored as given. It is sanitised where it is rendered, by the
     same allowlist the page uses for an article typed in the panel, because a
     second sanitiser at write time is exactly how the two drifted apart in
     the first place. */
  let createdId: string | null = null;
  if (String(body.action || "") === "create") {
    const input = (body.article || {}) as Record<string, unknown>;
    const title = String(input.title || "").trim();
    const content = String(input.content || "");
    const slug = String(input.slug || "")
      .toLowerCase().trim()
      .replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    const status = ["draft", "scheduled", "published"].includes(String(input.status))
      ? String(input.status)
      : "draft";

    /* 400, not a silent default: a script that mis-sends a field must hear
       about it here, not discover a broken page after the deploy. */
    if (!title) return json({ error: "article.title is required" }, 400);
    if (title.length > 200) return json({ error: "article.title is longer than 200 characters" }, 400);
    if (!slug) return json({ error: "article.slug is required and must contain letters or digits" }, 400);
    if (content.length > 400000) return json({ error: "article.content is larger than 400 KB" }, 400);
    if (status === "published" && !content.trim()) {
      return json({ error: "a published article cannot have an empty body" }, 400);
    }
    const scheduledFor = input.scheduled_for ? String(input.scheduled_for) : null;
    if (status === "scheduled" && !scheduledFor) {
      return json({ error: "scheduled articles need article.scheduled_for" }, 400);
    }
    if (scheduledFor && Number.isNaN(Date.parse(scheduledFor))) {
      return json({ error: "article.scheduled_for is not a date" }, 400);
    }

    /* Slug is the URL. Two rows with one slug means the build writes one page
       and silently loses the other, so this is a conflict, not an upsert. */
    const { data: taken } = await admin.from("articles").select("id").eq("slug", slug).maybeSingle();
    if (taken) return json({ error: `slug "${slug}" is already used by ${taken.id}`, conflict: true }, 409);

    const record: Record<string, unknown> = {
      title,
      slug,
      content,
      status,
      updated_at: new Date().toISOString(),
    };
    if (status === "published") record.published_at = new Date().toISOString();
    if (scheduledFor) record.scheduled_for = scheduledFor;
    for (const field of ["excerpt", "seo_title", "seo_description", "cover_image_url", "document_url"]) {
      if (input[field]) record[field] = String(input[field]).slice(0, 2000);
    }

    /* Category by name or slug: a script should not have to know a uuid. */
    const category = input.category ? String(input.category) : "";
    if (category) {
      const { data: found } = await admin.from("article_categories").select("id,name,slug");
      const match = (found || []).find((row) =>
        row.slug === category || String(row.name).toLowerCase() === category.toLowerCase());
      if (!match) {
        return json({ error: `unknown category "${category}"`, known: (found || []).map((r) => r.slug) }, 400);
      }
      record.category_id = match.id;
    }

    const { data: created, error: createError } = await admin
      .from("articles").insert(record).select("id,slug,status").single();
    if (createError) return json({ error: createError.message }, 400);

    /* Drafts are not published - nobody asked for a deploy. Everything else
       falls through to the build below so the page exists before the answer
       comes back. */
    if (status === "draft") {
      return json({ ok: true, action: "create", id: created.id, slug: created.slug, status, deployed: false });
    }
    createdId = created.id;
    body.reason = body.reason || `create:${created.slug}`;
    body.targets = Array.isArray(body.targets) && body.targets.length ? body.targets : [`/articles/${created.slug}`];
  }

  const reason = String(body.reason || "manual").slice(0, 200);
  const targets = Array.isArray(body.targets)
    ? body.targets.map((t) => String(t)).filter(Boolean).slice(0, 50)
    : [];

  /* ---- do not build ten times for ten saves --------------------------- */
  const since = new Date(Date.now() - COALESCE_SECONDS * 1000).toISOString();
  const { data: recent } = await admin
    .from("publish_jobs")
    .select("id,status,created_at")
    .in("status", ["queued", "running", "deploying"])
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recent) return json({ job_id: recent.id, coalesced: true, status: recent.status, created: createdId || null });

  if (!githubToken || !repo) {
    /* Fail loudly: a panel that says "published" while nothing will ever build
       is worse than one that says why it could not. */
    const { data: failed } = await admin
      .from("publish_jobs")
      .insert({ requested_by: user.id, reason, targets, status: "failed", detail: "GitHub token or repo not configured" })
      .select("id")
      .single();
    return json({ job_id: failed?.id ?? null, error: "server is not configured for deploys" }, 503);
  }

  const { data: job, error: jobError } = await admin
    .from("publish_jobs")
    .insert({ requested_by: user.id, reason, targets, status: "queued" })
    .select("id")
    .single();
  if (jobError || !job) return json({ error: jobError?.message || "could not record the job" }, 500);

  /* ---- hand it to GitHub ---------------------------------------------- */
  const response = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "oopsmypassword-admin",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      event_type: "content-publish",
      client_payload: { job: job.id, reason, targets, requested_by: user.id },
    }),
  });

  if (!response.ok) {
    const detail = `GitHub rejected the dispatch (HTTP ${response.status})`;
    await admin.from("publish_jobs").update({ status: "failed", detail, updated_at: new Date().toISOString() }).eq("id", job.id);
    /* The reason is logged server-side but NOT echoed if it might contain the
       token - GitHub's error bodies never do, but status alone is enough. */
    return json({ job_id: job.id, error: detail }, 502);
  }

  return json({ job_id: job.id, coalesced: false, status: "queued", created: createdId || null });
});
