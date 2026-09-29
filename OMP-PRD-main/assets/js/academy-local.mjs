/* Device-only learning records. Not an identity, assessment authority or account. */
export const PREFIX = "omp-academy-local:v1:";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const flags = ["lesson_started", "lesson_completed", "lab_completed", "passed"];
export function normalizeProgress(raw, topic) {
  if (!raw || raw.topic_id !== topic.id || raw.course_id !== topic.path_id)
    return {};
  const p = { topic_id: topic.id, course_id: topic.path_id };
  for (const key of flags) p[key] = raw[key] === true;
  p.highest_score =
    Number.isInteger(raw.highest_score) &&
    raw.highest_score >= 0 &&
    raw.highest_score <= 20
      ? raw.highest_score
      : 0;
  p.attempts =
    Number.isSafeInteger(raw.attempts) && raw.attempts >= 0 ? raw.attempts : 0;
  p.completed_at =
    typeof raw.completed_at === "string" &&
    Number.isFinite(Date.parse(raw.completed_at))
      ? raw.completed_at
      : null;
  return p;
}
export function createLocalStore(storage) {
  const memory = new Map(),
    dirty = new Set();
  let persistent = Boolean(storage),
    damaged = false;
  function get(key) {
    try {
      if (storage && !dirty.has(key)) {
        const value = storage.getItem(PREFIX + key);
        if (value !== null) memory.set(key, value);
        else memory.delete(key);
      }
    } catch {
      persistent = false;
      storage = null;
    }
    const raw = memory.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      damaged = true;
      return null;
    }
  }
  function set(key, value) {
    const raw = JSON.stringify(value);
    memory.set(key, raw);
    try {
      if (!storage) throw new Error();
      storage.setItem(PREFIX + key, raw);
      dirty.delete(key);
    } catch {
      persistent = false;
      dirty.add(key);
    }
    return value;
  }
  // Detect denied/quota-limited storage before promising persistence in the UI.
  try {
    if (storage) {
      storage.setItem(PREFIX + "probe", "1");
      storage.removeItem(PREFIX + "probe");
      storage.removeItem("omp-learning-auth");
    }
  } catch {
    persistent = false;
  }
  return {
    get persistent() {
      return persistent;
    },
    get damaged() {
      return damaged;
    },
    name() {
      const v = get("name");
      return typeof v === "string" ? v.slice(0, 100) : "";
    },
    saveName(value) {
      return set("name", String(value).trim().slice(0, 100));
    },
    progress(topic) {
      return normalizeProgress(get("progress:" + topic.id), topic);
    },
    update(topic, change) {
      const old = this.progress(topic);
      const next = normalizeProgress(
        { ...old, ...change, topic_id: topic.id, course_id: topic.path_id },
        topic,
      );
      return set("progress:" + topic.id, next);
    },
    export(topics) {
      return {
        version: 1,
        name: this.name(),
        progress: topics.map((t) => this.progress(t)).filter((p) => p.topic_id),
      };
    },
    import(data, topics) {
      if (
        !data ||
        data.version !== 1 ||
        typeof data.name !== "string" ||
        data.name.length > 100 ||
        !Array.isArray(data.progress) ||
        data.progress.length > 20000
      )
        throw new Error("This is not an Academy backup.");
      const known = new Map(topics.map((t) => [t.id, t]));
      const accepted = [];
      for (const raw of data.progress) {
        if (
          !raw ||
          !uuid.test(raw.topic_id) ||
          !uuid.test(raw.course_id) ||
          flags.some((k) => typeof raw[k] !== "boolean") ||
          !Number.isInteger(raw.highest_score) ||
          raw.highest_score < 0 ||
          raw.highest_score > 20 ||
          !Number.isSafeInteger(raw.attempts) ||
          raw.attempts < 0 ||
          (raw.completed_at !== null &&
            (typeof raw.completed_at !== "string" ||
              !Number.isFinite(Date.parse(raw.completed_at))))
        )
          throw new Error("The backup contains invalid progress records.");
        const t = known.get(raw.topic_id);
        if (t && t.path_id === raw.course_id) accepted.push([t, raw]);
      }
      // Validate everything before changing anything. Unknown/retired lessons are skipped.
      this.saveName(data.name);
      for (const [t, raw] of accepted) {
        const old = this.progress(t);
        this.update(t, {
          ...raw,
          ...Object.fromEntries(flags.map((k) => [k, old[k] || raw[k]])),
          highest_score: Math.max(old.highest_score || 0, raw.highest_score),
          attempts: Math.max(old.attempts || 0, raw.attempts),
          completed_at: old.completed_at || raw.completed_at,
        });
      }
      return accepted.length;
    },
    reset() {
      if (storage) {
        try {
          const keys = Array.from({ length: storage.length }, (_, i) =>
            storage.key(i),
          );
          for (const key of keys)
            if (
              key?.startsWith(PREFIX) ||
              /^omp-academy-(?:position|last|course-last):guest(?::|$)/.test(
                key,
              )
            )
              storage.removeItem(key);
        } catch {
          throw new Error(
            "Browser storage could not be cleared. Use your browser’s site-data settings.",
          );
        }
      } else if (!persistent)
        throw new Error(
          "Storage is unavailable. Clear this site's data in your browser settings to remove persisted records.",
        );
      memory.clear();
      dirty.clear();
      damaged = false;
    },
  };
}
export function normalizeSelfCheck(raw) {
  if (!raw || !Array.isArray(raw.questions) || raw.questions.length !== 4)
    throw new Error("A self-check needs four questions.");
  return {
    passing_score: 15,
    max_score: 20,
    questions: raw.questions.map((q) => {
      if (
        !q ||
        typeof q.question !== "string" ||
        !q.question.trim() ||
        !Array.isArray(q.options) ||
        q.options.length !== 4 ||
        q.options.some((v) => typeof v !== "string" || !v.trim()) ||
        !Number.isInteger(q.answer) ||
        q.answer < 0 ||
        q.answer > 3 ||
        typeof q.explanation !== "string" ||
        !q.explanation.trim()
      )
        throw new Error("Invalid public self-check question.");
      return {
        question: q.question,
        options: [...q.options],
        answer: q.answer,
        explanation: q.explanation,
      };
    }),
  };
}
export function gradeSelfCheck(quiz, answers) {
  const q = normalizeSelfCheck(quiz);
  if (
    !Array.isArray(answers) ||
    answers.length !== 4 ||
    answers.some((a) => !Number.isInteger(a) || a < 0 || a > 3)
  )
    throw new Error("Choose an answer for every question.");
  return q.questions.reduce(
    (score, q, i) => score + (q.answer === answers[i] ? 5 : 0),
    0,
  );
}
