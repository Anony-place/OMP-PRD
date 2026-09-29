/* Human consent UI is hosted on Firebase, not the Supabase API domain.
 * Tokens live only in this page's memory; a GET never changes preferences. */
(() => {
  const button = document.querySelector("[data-email-action]");
  if (!button) return;
  const heading = document.querySelector("[data-email-heading]");
  const status = document.querySelector("[data-email-status]");
  let revision = 0;
  function openLink() {
    const current = ++revision;
    button.hidden = true;
    button.disabled = true;
    button.onclick = null;
    heading.textContent = "Open your email link";
    status.textContent = "Use the confirmation or unsubscribe link in an OopsMyPassword email. Opening a link alone does not change your preferences.";
    const params = new URLSearchParams(location.hash.slice(1));
    // Remove the bearer link from the address bar/history before any API request.
    // Reopening the original email link works if this page is reloaded.
    history.replaceState(null, "", location.pathname);
    const action = params.get("action");
    let token = params.get("token") || "";
    let id = params.get("id") || "";
    const valid = ["confirm", "unsubscribe"].includes(action) &&
      /^[a-f0-9]{64}$/.test(token) &&
      (action === "confirm" ? !id : /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(id)) &&
      [...params.keys()].every((key) => ["action", "token", "id"].includes(key) && params.getAll(key).length === 1);
    if (!valid) {
      if (params.size) status.textContent = "This email link is invalid. Reopen the complete link from your email, or request a new confirmation from Articles.";
      return;
    }
    heading.textContent = action === "confirm" ? "Confirm article emails" : "Stop article emails";
    status.textContent = action === "confirm"
      ? "Choose confirm to receive future article updates. Every update includes an unsubscribe link. No account will be created."
      : "Choose unsubscribe to stop article updates. This will not change your name or learning progress on this device.";
    const label = action === "confirm" ? "Confirm subscription" : "Unsubscribe";
    button.textContent = label;
    button.hidden = false;
    button.disabled = false;
    button.onclick = async () => {
      if (button.disabled) return;
      button.disabled = true;
      button.textContent = "Updating preferences…";
      try {
        const response = await fetch("https://aeehfulikupskyrvcpzb.supabase.co/functions/v1/newsletter", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: "sb_publishable_s3n2U32MNB4PvHx0GolyqA_wlkzD6eR",
          },
          signal: AbortSignal.timeout(15000),
          body: JSON.stringify({ action, token, ...(id ? { id } : {}) }),
        });
        const result = await response.json();
        if (current !== revision) return;
        if (!response.ok || typeof result.message !== "string") {
          throw new Error("Could not update email preferences. Please retry, or reopen the original link later.");
        }
        status.textContent = result.message;
        token = "";
        id = "";
        button.hidden = true;
      } catch {
        if (current !== revision) return;
        status.textContent = "Could not verify the result. Please retry. If this was a confirmation, it may already have succeeded; reopening a used link will not create another subscription.";
        button.disabled = false;
      } finally {
        if (current === revision) button.textContent = label;
      }
    };
  }
  window.addEventListener("hashchange", openLink);
  openLink();
})();
