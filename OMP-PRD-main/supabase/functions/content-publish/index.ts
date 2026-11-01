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
  let body: { reason?: unknown; targets?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    /* an empty body is a legitimate "something changed, rebuild it" */
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
  if (recent) return json({ job_id: recent.id, coalesced: true, status: recent.status });

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

  return json({ job_id: job.id, coalesced: false, status: "queued" });
});
