import { createClient } from "npm:@supabase/supabase-js@2.115.0";
import { envKey } from "../_shared/academy-env.ts";

const escapeHTML = (s: unknown) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const hash = async (s: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    ),
    (x) => x.toString(16).padStart(2, "0"),
  ).join("");
const tokenPattern = /^[a-f0-9]{64}$/;
const uuidPattern =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
async function signature(id: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return Array.from(
    new Uint8Array(
      await crypto.subtle.sign(
        "HMAC",
        key,
        new TextEncoder().encode("unsubscribe:" + id),
      ),
    ),
    (x) => x.toString(16).padStart(2, "0"),
  ).join("");
}
async function equal(a: string, b: string) {
  return (await hash(a)) === (await hash(b));
}
Deno.serve(async (req) => {
  const site = (
    Deno.env.get("NEWSLETTER_SITE_ORIGIN") || "https://oopsmypassword.web.app"
  ).replace(/\/$/, "");
  const origins = [
    site,
    ...(Deno.env.get("NEWSLETTER_ALLOWED_ORIGINS") || "")
      .split(",")
      .filter(Boolean),
  ];
  const origin = req.headers.get("origin");
  const headers = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    Vary: "Origin",
  });
  if (origin && origins.includes(origin))
    headers.set("Access-Control-Allow-Origin", origin);
  headers.set(
    "Access-Control-Allow-Headers",
    "content-type, apikey, authorization",
  );
  headers.set("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers });
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (!["POST", "GET"].includes(req.method))
    return json({ error: "Method not allowed" }, 405);
  const url = new URL(req.url);
  // Worker requests and email confirmation/unsubscribe forms intentionally have no browser origin.
  if (origin && !origins.includes(origin) && origin !== url.origin)
    return json({ error: "Origin not allowed" }, 403);
  let body: Record<string, unknown> = {};
  try {
    if (req.method === "POST") {
      const text = await req.text();
      if (text.length > 8192) return json({ error: "Request too large" }, 413);
      body = req.headers.get("content-type")?.includes("application/json")
        ? JSON.parse(text)
        : Object.fromEntries(new URLSearchParams(text));
      if (!body || typeof body !== "object" || Array.isArray(body))
        return json({ error: "Invalid request" }, 400);
    }
  } catch {
    return json({ error: "Invalid request" }, 400);
  }
  const action = String(
    body.action || url.searchParams.get("action") || "subscribe",
  );
  const token = String(body.token || url.searchParams.get("token") || "");
  const id = String(body.id || url.searchParams.get("id") || "");
  if (req.method === "GET") {
    if (
      !["confirm", "unsubscribe"].includes(action) ||
      !tokenPattern.test(token) ||
      (action === "unsubscribe" && !uuidPattern.test(id))
    )
      return json({ error: "Invalid link" }, 400);
    // Supabase's standard domain rewrites HTML GET responses to plain text.
    // Host the human confirmation UI on Firebase; GET never changes consent.
    const destination = new URL("/email-preferences", site);
    destination.hash = new URLSearchParams({ action, token, ...(id ? { id } : {}) }).toString();
    const h = new Headers(headers);
    h.set("Location", destination.href);
    h.set("X-Robots-Tag", "noindex, nofollow");
    return new Response(null, { status: 303, headers: h });
  }

  const supabaseURL = Deno.env.get("SUPABASE_URL");
  let serviceKey = "";
  try {
    serviceKey = envKey("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
  } catch {
    return json({ error: "Email subscriptions are not configured yet." }, 503);
  }
  const secret = Deno.env.get("NEWSLETTER_TOKEN_SECRET") || "";
  if (!supabaseURL || !serviceKey || secret.length < 32)
    return json(
      {
        error:
          "Email subscriptions are not configured yet. Nothing was subscribed.",
      },
      503,
    );
  const db = createClient(supabaseURL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, {
      ...init,
      signal: init?.signal
        ? AbortSignal.any([init.signal, AbortSignal.timeout(10000)])
        : AbortSignal.timeout(10000),
    }) },
  });
  // JSON for the site UI and RFC 8058 one-click clients; no HTML on the API host.
  const resultPage = (message: string) => json({ message });

  try {
    if (action === "confirm") {
      if (!tokenPattern.test(token))
        return json({ error: "Invalid confirmation link" }, 400);
      const { data, error } = await db.rpc("newsletter_confirm", {
        p_hash: await hash(token),
      });
      if (error) throw error;
      return resultPage(
        data
          ? "Subscription confirmed. You will receive new article updates, not login emails. Every update includes an unsubscribe link."
          : "This link has expired or was already used. If you have not confirmed, request a new subscription link.",
      );
    }
    if (action === "unsubscribe") {
      if (
        !uuidPattern.test(id) ||
        !tokenPattern.test(token) ||
        !(await equal(token, await signature(id, secret)))
      )
        return json({ error: "Invalid unsubscribe link" }, 400);
      const { error } = await db.rpc("newsletter_unsubscribe", { p_id: id });
      if (error) throw error;
      return resultPage(
        "You are unsubscribed from article emails. Your local Academy progress is unchanged.",
      );
    }
    const apiKey = Deno.env.get("RESEND_API_KEY"),
      from = Deno.env.get("NEWSLETTER_FROM");
    if (!apiKey || !from)
      return json(
        { error: "Email delivery is not enabled yet. Please try later." },
        503,
      );
    const endpoint = `${supabaseURL}/functions/v1/newsletter`;
    async function mail(
      to: string,
      subject: string,
      html: string,
      key: string,
      unsubscribe?: string,
    ) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        signal: AbortSignal.timeout(15000),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": key,
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject,
          html,
          ...(unsubscribe
            ? {
                headers: {
                  "List-Unsubscribe": `<${unsubscribe}>`,
                  "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
                },
              }
            : {}),
        }),
      });
      if (!response.ok) throw new Error("Email provider rejected delivery");
      const result = await response.json();
      if (!result.id) throw new Error("Email provider did not accept delivery");
      return result.id;
    }
    if (action === "dispatch") {
      const worker = Deno.env.get("NEWSLETTER_WORKER_SECRET") || "";
      if (
        worker.length < 32 ||
        !(await equal(
          req.headers.get("authorization") || "",
          `Bearer ${worker}`,
        ))
      )
        return json({ error: "Unauthorized" }, 401);
      const { data: jobs, error } = await db.rpc("newsletter_claim");
      if (error) throw error;
      let sent = 0,
        failed = 0,
        deferred = 0;
      for (const j of jobs || []) {
        try {
          // Recheck immediately before delivery, not just when the queue was claimed.
          const [s, a] = await Promise.all([
            db
              .from("newsletter_subscribers")
              .select("status")
              .eq("id", j.subscriber_id)
              .single(),
            db
              .from("articles")
              .select("status,slug,title,summary")
              .eq("id", j.article_id)
              .single(),
          ]);
          if (s.error || a.error)
            throw new Error("Publication check unavailable");
          if (s.data.status !== "active" || a.data.status !== "published")
            continue;
          if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(a.data.slug))
            throw new Error("Invalid article slug");
          // The article feed can update before Hosting has built its canonical page.
          // Never email a broken link; defer without consuming a delivery attempt.
          const page = await fetch(`${site}/articles/${a.data.slug}`, {
            method: "HEAD",
            redirect: "manual",
            signal: AbortSignal.timeout(10000),
          });
          if (
            page.status !== 200 ||
            !page.headers.get("content-type")?.includes("text/html")
          ) {
            const { error: deferError } = await db
              .from("newsletter_deliveries")
              .update({
                state: "pending",
                attempts: j.attempt - 1,
                available_at: new Date(Date.now() + 300000).toISOString(),
                ...(j.attempt === 1 ? { first_attempt_at: null } : {}),
              })
              .eq("article_id", j.article_id)
              .eq("subscriber_id", j.subscriber_id)
              .eq("attempts", j.attempt)
              .eq("state", "sending");
            if (deferError) throw deferError;
            deferred++;
            continue;
          }
          const signedToken = await signature(j.subscriber_id, secret);
          const unsub = `${endpoint}?action=unsubscribe&id=${j.subscriber_id}&token=${signedToken}`;
          const humanUnsub = `${site}/email-preferences#action=unsubscribe&id=${j.subscriber_id}&token=${signedToken}`;
          const providerId = await mail(
            j.email,
            `New article: ${String(a.data.title)
              .replace(/[\r\n]/g, " ")
              .slice(0, 180)}`,
            `<h1>${escapeHTML(a.data.title)}</h1><p>${escapeHTML(String(a.data.summary || "").slice(0, 500))}</p><p><a href="${site}/articles/${a.data.slug}">Read the article on OopsMyPassword</a></p><p>You requested article updates. <a href="${escapeHTML(humanUnsub)}">Unsubscribe</a>.</p>`,
            `article-${j.article_id}-${j.subscriber_id}`,
            unsub,
          );
          const { error: e } = await db
            .from("newsletter_deliveries")
            .update({
              state: "sent",
              sent_at: new Date().toISOString(),
              provider_id: providerId,
            })
            .eq("article_id", j.article_id)
            .eq("subscriber_id", j.subscriber_id)
            .eq("attempts", j.attempt)
            .eq("state", "sending");
          if (e) throw e;
          sent++;
        } catch {
          failed++; /* Lease retries, bounded by SQL and provider idempotency; no email/token logging. */
        }
      }
      return json({ sent, retry_pending: failed, deferred });
    }
    if (action !== "subscribe") return json({ error: "Unknown action" }, 400);
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (
      email.length > 254 ||
      !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) ||
      body.consent !== true
    )
      return json(
        { error: "Enter a valid email and agree to receive article updates." },
        400,
      );
    const captchaSecret = Deno.env.get("TURNSTILE_SECRET_KEY");
    if (!captchaSecret)
      return json({ error: "Subscription protection is not configured." }, 503);
    if (
      typeof body.challenge !== "string" ||
      !body.challenge ||
      body.challenge.length > 2048
    )
      return json({ error: "Complete the anti-spam check." }, 400);
    const checked = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        signal: AbortSignal.timeout(10000),
        body: new URLSearchParams({
          secret: captchaSecret,
          response: body.challenge,
        }),
      },
    );
    if (!checked.ok) throw new Error("Challenge service unavailable");
    const verification = await checked.json();
    const hosts = origins.map((o) => new URL(o).hostname);
    if (
      !verification.success ||
      verification.action !== "newsletter" ||
      !hosts.includes(verification.hostname)
    )
      return json({ error: "Anti-spam check failed. Please retry." }, 400);
    const newToken = Array.from(
      crypto.getRandomValues(new Uint8Array(32)),
      (x) => x.toString(16).padStart(2, "0"),
    ).join("");
    const tokenHash = await hash(newToken);
    const { data: send, error } = await db.rpc("newsletter_request", {
      p_email: email,
      p_hash: tokenHash,
    });
    if (error) throw error;
    if (send) {
      try {
        await mail(
          email,
          "Confirm your OopsMyPassword article subscription",
          `<h1>New articles, by email</h1><p>You requested article updates from OopsMyPassword. This is not an account or login.</p><p><a href="${site}/email-preferences#action=confirm&token=${newToken}">Confirm your subscription</a> within 24 hours.</p><p>If you did not request this, ignore this message. No updates will be sent without confirmation.</p>`,
          `confirm-${tokenHash}`,
        );
      } catch (e) {
        await db
          .from("newsletter_subscribers")
          .update({ requested_at: new Date(0).toISOString() })
          .eq("email", email)
          .eq("confirmation_hash", tokenHash);
        throw e;
      }
    }
    return json({
      message:
        "If confirmation is needed, check your inbox and spam folder. Already confirmed addresses stay subscribed. This does not create an account.",
    });
  } catch {
    return json(
      {
        error:
          "We could not complete the email request. Please try again later.",
      },
      503,
    );
  }
});
