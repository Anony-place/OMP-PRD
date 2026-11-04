/* Site runtime configuration for the client-side admin panel.
 * The publishable (anon) key is public by design — it is the same key the
 * REST reads use. Row-level security, not secrecy, protects the data.
 * Never put a service-role key in a file the browser downloads. */
export const SITE_CONFIG = {
  /** Supabase project URL */
  supabaseUrl: 'https://aeehfulikupskyrvcpzb.supabase.co',

  /** Supabase publishable (anon) key */
  supabasePublishableKey: 'sb_publishable_s3n2U32MNB4PvHx0GolyqA_wlkzD6eR',
};
