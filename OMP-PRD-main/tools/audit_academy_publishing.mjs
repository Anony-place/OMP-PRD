/* Fixed-behavior regressions for A7; no writes or network. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { curriculum } from "../assets/js/academy-model.mjs";
import { shuffledOptions } from "../assets/js/academy-quiz.mjs";
const raw = JSON.parse(
  await readFile(
    new URL("../assets/data/academy-catalogue.json", import.meta.url),
    "utf8",
  ),
);
// Every published topic in the built snapshot must survive validation, and
// every one of them must carry the full set of lesson sections. Deriving the
// expected count from the snapshot keeps this a real invariant check instead
// of a magic number that silently goes stale when content is published.
const published = raw.topics.filter((t) => t.status === "published");
assert.ok(published.length > 0, "snapshot has no published topics to validate");
const REQUIRED = [
  "overview",
  "how_it_works",
  "history",
  "real_world",
  "what_to_look_for",
  "defensive",
  "references",
];
for (const topic of published) {
  for (const section of REQUIRED) {
    assert.ok(
      topic.content?.[section],
      `published lesson ${topic.slug} is missing ${section}`,
    );
  }
  assert.ok(
    topic.content.references.every((r) => r.startsWith("https://")),
    `published lesson ${topic.slug} has a non-HTTPS reference`,
  );
}
assert.equal(curriculum(raw).topics.length, published.length);
let checks = 1;
for (const content of [
  {},
  { ...raw.topics[0].content, overview: "   " },
  { ...raw.topics[0].content, defensive: [] },
  { ...raw.topics[0].content, defensive: [""] },
  { ...raw.topics[0].content, references: ["javascript:alert(1)"] },
  { ...raw.topics[0].content, references: "https://example.com" },
  { ...raw.topics[0].content, references: [] },
]) {
  const invalid = structuredClone(raw);
  invalid.topics[0].content = content;
  assert.throws(() => curriculum(invalid), /Published lesson/);
  checks++;
}
const draft = structuredClone(raw);
draft.topics[0].status = "draft";
draft.topics[0].content = {};
assert.equal(curriculum(draft).topics.length, published.length - 1);
checks++;
const missingOutcome = structuredClone(raw);
missingOutcome.modules[0].outcome = " ";
assert.throws(() => curriculum(missingOutcome), /outcome/);
checks++;
for (const seed of [0, 0.25, 0.5, 0.99]) {
  const values = ["one", "two", "three", "four"];
  const shuffled = shuffledOptions(values, () => seed);
  assert.equal(new Set(shuffled.map((o) => o.index)).size, 4);
  assert.ok(shuffled.every((o) => values[o.index] === o.label));
  assert.deepEqual(values, ["one", "two", "three", "four"]);
  checks++;
}
assert.notDeepEqual(
  shuffledOptions(["a", "b", "c", "d"], () => 0).map((o) => o.index),
  [0, 1, 2, 3],
);
checks++;
console.log(
  `${checks} publishing/option-mapping regressions passed: incomplete lessons rejected; drafts remain private; original answer indexes preserved.`,
);
