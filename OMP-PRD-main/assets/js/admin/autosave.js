/* ============================================================
   Autosave.

   A form that loses an hour of writing to a flat battery, a closed tab or a
   reload on the wrong page is the kind of bug people stop reporting and start
   working around - they paste the article into a notes app first, and then the
   editor is the second copy.

   What is saved is the form's own fields, in the browser, under a key per
   article. Nothing is sent anywhere: a half-written paragraph should not be on
   a server, and it should not need a working connection to be safe.

   Two rules that keep this from becoming its own problem:
     * a draft is only offered when it is NEWER than the saved article, so an
       old draft cannot quietly overwrite a newer version
     * anything older than a week, or bigger than 512 KB, is dropped - the
       quota is shared with the rest of the site's storage
   ============================================================ */

const PREFIX = 'omp-draft:';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_BYTES = 512 * 1024;

export function draftKey(kind, id) {
  return `${PREFIX}${kind}:${id || 'new'}`;
}

/* localStorage throws in private mode on some browsers and is absent in a
   service worker. Autosave is a convenience; it must never break the editor. */
function store() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function saveDraft(key, data, now = Date.now()) {
  const storage = store();
  if (!storage) return false;
  try {
    const payload = JSON.stringify({ savedAt: now, data });
    if (payload.length > MAX_BYTES) return false;
    storage.setItem(key, payload);
    return true;
  } catch {
    /* Quota exceeded, or storage disabled mid-session. Losing the autosave is
       acceptable; throwing out of an input handler is not. */
    return false;
  }
}

export function loadDraft(key, now = Date.now()) {
  const storage = store();
  if (!storage) return null;
  let raw;
  try {
    raw = storage.getItem(key);
  } catch {
    return null;
  }
  if (!raw) return null;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    storage.removeItem(key);
    return null;
  }
  if (!parsed || typeof parsed.savedAt !== 'number' || !parsed.data) {
    storage.removeItem(key);
    return null;
  }
  if (now - parsed.savedAt > MAX_AGE_MS) {
    storage.removeItem(key);
    return null;
  }
  return parsed;
}

export function clearDraft(key) {
  const storage = store();
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    /* nothing to do */
  }
}

/* Called once at editor mount. Without it, abandoned drafts of deleted
   articles sit in the quota for ever. */
export function pruneDrafts(now = Date.now()) {
  const storage = store();
  if (!storage) return 0;
  let removed = 0;
  const doomed = [];
  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key || !key.startsWith(PREFIX)) continue;
      const draft = loadDraft(key, now);
      if (!draft) doomed.push(key);
    }
    for (const key of doomed) {
      storage.removeItem(key);
      removed += 1;
    }
  } catch {
    return removed;
  }
  return removed;
}

export const ago = (savedAt, now = Date.now()) => {
  const seconds = Math.max(0, Math.round((now - savedAt) / 1000));
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.round(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} hours ago`;
  return `${Math.round(seconds / 86400)} days ago`;
};

/* The offer is deliberately a visible strip above the form rather than a
   confirm() at load: a modal on open trains people to dismiss it, and the
   decision needs the draft's age in front of it. */
export function renderOffer(document_, { savedAt, onRestore, onDiscard }) {
  const bar = document_.createElement('div');
  bar.className = 'admin-draft-offer';
  bar.setAttribute('role', 'status');
  bar.style.cssText = 'display:flex;gap:12px;flex-wrap:wrap;align-items:center;'
    + 'padding:10px 14px;margin:0 0 14px;border-radius:10px;'
    + 'background:rgba(154,103,0,.12);border:1px solid rgba(154,103,0,.35)';

  const text = document_.createElement('span');
  text.className = 'tiny';
  text.textContent = `Unsaved work from ${ago(savedAt)} was found in this browser.`;
  bar.appendChild(text);

  const restore = document_.createElement('button');
  restore.type = 'button';
  restore.className = 'btn btn-primary btn-sm';
  restore.textContent = 'Restore it';
  restore.onclick = () => { bar.remove(); onRestore(); };

  const discard = document_.createElement('button');
  discard.type = 'button';
  discard.className = 'btn btn-ghost btn-sm';
  discard.textContent = 'Discard';
  discard.onclick = () => { bar.remove(); onDiscard(); };

  bar.appendChild(restore);
  bar.appendChild(discard);
  return bar;
}

/* Wires a form to its draft.
     read()      -> plain object of the fields to keep
     apply(data) -> puts them back
     savedAt     -> the article's own updated_at, so a stale draft is not
                    offered over a newer save from another device
   Returns { flush, stop, clear } so the save handler can settle it. */
export function installAutosave({ form, key, read, apply, savedAt = null, debounceMs = 1200 }) {
  let timer = null;
  let lastSaved = null;

  const flush = () => {
    clearTimeout(timer);
    timer = null;
    const data = read();
    if (!data) return false;
    const wrote = saveDraft(key, data);
    if (wrote) lastSaved = Date.now();
    return wrote;
  };

  const existing = loadDraft(key);
  let offer = null;
  if (existing) {
    /* Only newer than what is in the database. A draft from before the last
       save is not a rescue, it is a downgrade. */
    const newer = !savedAt || existing.savedAt > new Date(savedAt).getTime();
    if (newer && typeof apply === 'function') {
      offer = renderOffer(form.ownerDocument, {
        savedAt: existing.savedAt,
        onRestore: () => apply(existing.data),
        onDiscard: () => clearDraft(key)
      });
      form.parentNode.insertBefore(offer, form);
    } else if (!newer) {
      clearDraft(key);
    }
  }

  const onInput = () => {
    clearTimeout(timer);
    timer = setTimeout(flush, debounceMs);
  };
  form.addEventListener('input', onInput);
  form.addEventListener('change', onInput);

  const clear = () => {
    clearTimeout(timer);
    timer = null;
    clearDraft(key);
    if (offer && offer.parentNode) offer.remove();
    offer = null;
  };

  const stop = () => {
    clearTimeout(timer);
    timer = null;
    form.removeEventListener('input', onInput);
    form.removeEventListener('change', onInput);
  };

  return { flush, stop, clear, hadOffer: Boolean(offer), lastSaved: () => lastSaved };
}
