/* Newsletter only. No accounts, local progress, auth SDK or email in storage. */
(async () => {
  const form = document.querySelector("[data-newsletter-form]");
  if (!form) return;
  const note = form.querySelector("[data-newsletter-note]");
  const button = form.querySelector('button[type="submit"]');
  const fields = form.querySelector("fieldset");
  let config;
  try {
    const response = await fetch("/assets/data/newsletter-config.json");
    if (!response.ok) throw new Error();
    config = await response.json();
    if (
      config.enabled !== true ||
      !/^[a-zA-Z0-9_-]{10,100}$/.test(config.turnstile_site_key)
    )
      throw new Error();
  } catch {
    note.textContent =
      "Email subscriptions are not enabled yet. No email is being collected. Articles and Academy lessons remain free to use.";
    return;
  }
  fields.disabled = false;
  note.textContent =
    "Optional article updates only. Confirm your email to subscribe; unsubscribe from any update. No login or progress sync.";
  let challenge = "",
    widget;
  const script = document.createElement("script");
  script.src =
    "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  script.onload = () => {
    widget = window.turnstile.render(
      form.querySelector("[data-newsletter-challenge]"),
      {
        sitekey: config.turnstile_site_key,
        action: "newsletter",
        callback: (token) => {
          challenge = token;
          button.disabled = false;
        },
        "expired-callback": () => {
          challenge = "";
          button.disabled = true;
        },
        "error-callback": () => {
          challenge = "";
          button.disabled = true;
          note.textContent =
            "Anti-spam verification could not load. Reload to retry; no subscription was created.";
        },
      },
    );
  };
  script.onerror = () => {
    note.textContent =
      "Anti-spam verification could not load. Reload to retry; no subscription was created.";
  };
  document.head.append(script);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (button.disabled || !challenge || !form.reportValidity()) return;
    button.disabled = true;
    button.textContent = "Requesting confirmation…";
    try {
      const response = await fetch(
        "https://aeehfulikupskyrvcpzb.supabase.co/functions/v1/newsletter",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: "sb_publishable_s3n2U32MNB4PvHx0GolyqA_wlkzD6eR",
          },
          signal: AbortSignal.timeout(15000),
          body: JSON.stringify({
            action: "subscribe",
            email: form.elements.email.value.trim(),
            consent: form.elements.consent.checked,
            challenge,
          }),
        },
      );
      const result = await response.json();
      if (!response.ok || typeof result.message !== "string")
        throw new Error(result.error || "Email request failed. Please retry.");
      note.textContent = result.message;
      form.reset();
    } catch (error) {
      note.textContent =
        error.name === "TimeoutError"
          ? "The request timed out. Check your inbox before retrying; confirmation may have been sent."
          : error.message || "Could not request email updates. Please retry.";
    } finally {
      challenge = "";
      button.textContent = "Subscribe to article updates";
      window.turnstile?.reset(widget);
    }
  });
})();
