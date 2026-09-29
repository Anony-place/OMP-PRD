import { createClient } from "npm:@supabase/supabase-js@2.115.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2.115.0/cors";
import { envKey } from "./academy-env.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Authentication stays at the edge; all state transitions live in one DB transaction. */
export function mutationHandler(kind: "progress" | "quiz") {
  return async (req: Request) => {
    if (req.method === "OPTIONS")
      return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST")
      return json({ error: "Method not allowed." }, 405);
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ") || !auth.slice(7).trim())
      return json({ error: "Authentication required." }, 401);
    try {
      const url = Deno.env.get("SUPABASE_URL") || "";
      if (!url) throw new Error("Missing SUPABASE_URL");
      const publishable = envKey(
        "SUPABASE_PUBLISHABLE_KEYS",
        "SUPABASE_ANON_KEY",
      );
      const secret = envKey(
        "SUPABASE_SECRET_KEYS",
        "SUPABASE_SERVICE_ROLE_KEY",
      );
      const userClient = createClient(url, publishable, {
        global: { headers: { Authorization: auth } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const {
        data: { user },
        error: authError,
      } = await userClient.auth.getUser(auth.slice(7));
      if (authError || !user) return json({ error: "Invalid session." }, 401);
      const body = await req.json().catch(() => null);
      if (
        !body ||
        typeof body.topic_id !== "string" ||
        !uuid.test(body.topic_id)
      )
        return json({ error: "Invalid topic ID." }, 400);
      const action = kind === "quiz" ? "submit_quiz" : body.action;
      if (
        kind === "progress" &&
        !["start_lesson", "complete_lab", "recover_certificate"].includes(
          action,
        )
      )
        return json({ error: "Invalid progress action." }, 400);
      if (
        kind === "quiz" &&
        (!Array.isArray(body.answers) ||
          body.answers.length !== 4 ||
          body.answers.some(
            (x: unknown) =>
              typeof x !== "number" || !Number.isInteger(x) || x < 0 || x > 3,
          ))
      ) {
        return json({ error: "Invalid quiz submission." }, 400);
      }
      const metadata = user.user_metadata || {};
      const rawName = metadata.full_name || metadata.name;
      const name =
        typeof rawName === "string" ? rawName.trim().slice(0, 100) : "";
      const admin = createClient(url, secret, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await admin.rpc("academy_mutate", {
        p_user_id: user.id,
        p_topic_id: body.topic_id,
        p_action: action,
        p_answers: kind === "quiz" ? body.answers : null,
        p_recipient_name: name || "OMP Learner",
        p_quiz_version:
          kind === "quiz" &&
          typeof body.quiz_version === "string" &&
          Number.isFinite(Date.parse(body.quiz_version))
            ? body.quiz_version
            : null,
      });
      if (error) throw error;
      if (!data || !Number.isInteger(data.http_status))
        throw new Error("Invalid mutation response");
      const { http_status, ...result } = data;
      return json(result, http_status);
    } catch (error) {
      console.error(`learning-${kind}`, error);
      return json(
        {
          error:
            kind === "quiz"
              ? "Quiz submission failed. Please retry."
              : "Progress update failed. Please retry.",
        },
        500,
      );
    }
  };
}
