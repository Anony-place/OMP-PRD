import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  createLocalStore,
  PREFIX,
  normalizeSelfCheck,
  gradeSelfCheck,
} from "../assets/js/academy-local.mjs";
import { normalizeContent } from "../assets/js/academy-content.mjs";
const seed = JSON.parse(
  await readFile(
    new URL("../assets/data/academy-reading.json", import.meta.url),
  ),
);
const t = seed.topics[0],
  other = seed.topics[1];
const memory = () => {
  const m = new Map();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => m.set(k, v),
    removeItem: (k) => m.delete(k),
    key: (i) => [...m.keys()][i],
    get length() {
      return m.size;
    },
  };
};
let n = 0;
const test = (label, fn) => {
  fn();
  n++;
  console.log("✓ " + label);
};
test("Name and progress survive reload without an identity or email", () => {
  const s = memory(),
    a = createLocalStore(s);
  a.saveName("  Asha  ");
  a.update(t, { lesson_started: true, passed: true, highest_score: 20 });
  const b = createLocalStore(s);
  assert.equal(b.name(), "Asha");
  assert.equal(b.progress(t).passed, true);
  assert.equal(b.progress(other).passed, undefined);
  assert.equal(s.getItem("omp-learning-auth"), null);
});
test("A same-slug lesson in another course never inherits progress", () => {
  const a = createLocalStore(memory());
  a.update(t, { passed: true });
  assert.deepEqual(a.progress({ ...t, path_id: other.id }), {});
  assert.deepEqual(a.progress({ ...t, id: other.id }), {});
});
test("Invalid records cannot produce scores, attempts or boolean completions", () => {
  const s = memory();
  s.setItem(
    PREFIX + "progress:" + t.id,
    JSON.stringify({
      topic_id: t.id,
      course_id: t.path_id,
      passed: "true",
      highest_score: 999,
      attempts: -4,
    }),
  );
  const p = createLocalStore(s).progress(t);
  assert.equal(p.passed, false);
  assert.equal(p.highest_score, 0);
  assert.equal(p.attempts, 0);
});
test("Corrupt storage is surfaced instead of crashing the reader", () => {
  const s = memory();
  s.setItem(PREFIX + "name", "{");
  const a = createLocalStore(s);
  assert.equal(a.name(), "");
  assert.equal(a.damaged, true);
});
test("Denied storage falls back to the current tab, without claiming persistence", () => {
  const a = createLocalStore({
    getItem() {
      throw Error();
    },
    setItem() {
      throw Error();
    },
  });
  a.saveName("Asha");
  a.update(t, { passed: true });
  assert.equal(a.persistent, false);
  assert.equal(a.name(), "Asha");
  assert.equal(a.progress(t).passed, true);
});
test("Quota failures do not discard existing readable records or tab-only changes", () => {
  const s = memory(),
    a = createLocalStore(s);
  a.update(other, { passed: true });
  s.setItem = () => {
    throw Error("quota");
  };
  a.update(t, { passed: true });
  assert.equal(a.persistent, false);
  assert.equal(a.export([t, other]).progress.length, 2);
  assert.equal(a.progress(t).passed, true);
});
test("Reset is namespaced: theme and checklist remain intact", () => {
  const s = memory(),
    a = createLocalStore(s);
  s.setItem("omp-theme", "light");
  s.setItem("checklist", "data");
  s.setItem("omp-academy-position:guest:" + t.id, "quiz");
  a.saveName("Asha");
  a.update(t, { passed: true });
  a.reset();
  assert.equal(a.name(), "");
  assert.equal(s.getItem("omp-theme"), "light");
  assert.equal(s.getItem("checklist"), "data");
  assert.equal(s.getItem("omp-academy-position:guest:" + t.id), null);
});
test("Backups restore only matching lesson/course IDs and merge without erasing passes", () => {
  const a = createLocalStore(memory()),
    b = createLocalStore(memory());
  a.saveName("Asha");
  a.update(t, {
    passed: true,
    highest_score: 20,
    completed_at: new Date().toISOString(),
  });
  b.import(a.export([t]), [t]);
  assert.equal(b.progress(t).passed, true);
  assert.equal(b.name(), "Asha");
  const older = a.export([t]);
  older.progress[0].passed = false;
  older.progress[0].highest_score = 5;
  b.import(older, [t]);
  assert.equal(b.progress(t).highest_score, 20);
  assert.equal(b.progress(t).passed, true);
  assert.equal(
    createLocalStore(memory()).import(a.export([t]), [
      { ...t, path_id: other.id },
    ]),
    0,
  );
});
test("Malformed backups are rejected before any partial name/progress write", () => {
  const a = createLocalStore(memory());
  a.saveName("Original");
  assert.throws(() =>
    a.import(
      {
        version: 1,
        name: "Overwritten",
        progress: [{ topic_id: "__proto__" }],
      },
      [t],
    ),
  );
  assert.equal(a.name(), "Original");
  assert.throws(() => a.import({ version: 99, name: "X", progress: [] }, [t]));
});
const checks = JSON.parse(
  await readFile(
    new URL("../assets/data/academy-self-checks.json", import.meta.url),
  ),
);
test("All four public self-checks have valid reviewed questions and balanced answers", () => {
  for (const topic of seed.topics) {
    const q = normalizeSelfCheck(checks[topic.id]);
    assert.equal(
      gradeSelfCheck(
        q,
        q.questions.map((q) => q.answer),
      ),
      20,
    );
    assert.equal(
      gradeSelfCheck(
        q,
        q.questions.map((q) => (q.answer + 1) % 4),
      ),
      0,
    );
    assert.equal(new Set(q.questions.map((q) => q.answer)).size, 4);
  }
});
test("Incomplete, stringified and out-of-range answers are rejected", () => {
  const q = checks[t.id];
  for (const x of [[], [1, 2, 3], [0, 0, 0, "1"], [0, 0, 0, 4]])
    assert.throws(() => gradeSelfCheck(q, x));
});
test("Public self-checks are explicit and distinct from private server assessment keys", () => {
  const c = normalizeContent(
    { ...t.content, self_check: checks[t.id], correct_answers: [1, 2, 3, 4] },
    t.name,
  );
  assert.equal(c.self_check.questions.length, 4);
  assert.equal(c.correct_answers, undefined);
  assert.throws(() =>
    normalizeContent({ ...t.content, self_check: { questions: [] } }, t.name),
  );
});
const client = await readFile(
  new URL("../assets/js/learning.js", import.meta.url),
  "utf8",
);
test("The learner entrypoint contains no auth SDK, user lookup or server mutations", () => {
  assert.doesNotMatch(
    client,
    /signInWithOtp|getSession|getUser|supabase\.from|functions\.invoke|learning-quiz-submit|esm\.sh/,
  );
  assert.match(client, /createLocalStore/);
});
console.log(`\n${n} local Academy checks passed.`);
