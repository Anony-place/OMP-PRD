/* Academy runtime configuration. Edit this file for deployment targets.
 * Values can be overridden at build time via env substitution if desired. */
export const ACADEMY_CONFIG = {
  /** Supabase project URL (e.g., https://xyz.supabase.co) */
  supabaseUrl: "https://aeehfulikupskyrvcpzb.supabase.co",

  /** Supabase publishable (anon) key */
  supabasePublishableKey: "sb_publishable_s3n2U32MNB4PvHx0GolyqA_wlkzD6eR",

  /** Enable Supabase-backed progress (requires user auth). When false, only localStorage is used. */
  useSupabaseProgress: true,

  /** Edge function endpoints (relative to supabaseUrl) */
  endpoints: {
    progress: "/functions/v1/learning-progress",
    quizSubmit: "/functions/v1/learning-quiz-submit",
    certificateVerify: "/functions/v1/learning-certificate-verify",
  },

  /** LocalStorage keys */
  storageKeys: {
    progress: "omp-academy-progress",
    name: "omp-academy-name",
    lastTopic: "omp-academy-last:guest",
    courseLast: "omp-academy-course-last:guest:",
    position: "omp-academy-position:guest:",
  },
};

/** Build a full Edge Function URL */
export function edgeUrl(endpoint) {
  return `${ACADEMY_CONFIG.supabaseUrl}${ACADEMY_CONFIG.endpoints[endpoint]}`;
}