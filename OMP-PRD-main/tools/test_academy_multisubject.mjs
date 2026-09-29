import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  curriculum,
  resolvePage,
  recommended,
} from "../assets/js/academy-model.mjs";
import { publicView, blocksView } from "../assets/js/academy-views.mjs";
import { sectionsFor } from "../assets/js/academy-content.mjs";
import { multiSubjectFixture } from "./academy_multi_subject_fixture.mjs";
const seed = JSON.parse(
  await readFile(
    new URL("../assets/data/academy-reading.json", import.meta.url),
    "utf8",
  ),
);
const raw = multiSubjectFixture(seed),
  data = curriculum(raw);
let checks = 0;
const check = (name, fn) => {
  fn();
  checks++;
  console.log("✓ " + name);
};
check(
  "Three subjects and four courses are independent; no universal security starting point",
  () => {
    assert.equal(data.categories.length, 3);
    assert.equal(data.paths.length, 4);
    assert.equal(recommended(data), undefined);
    for (const c of data.categories)
      assert.equal(recommended(data, c.id).category_id, c.id);
    const home = publicView(data, resolvePage(data, "/learning"));
    assert.ok(!home.includes("NEW TO SECURITY"));
    assert.ok(!home.includes("Security Academy"));
  },
);
check("Subject pages and roadmaps include only their own courses", () => {
  const programming = data.categories.find((c) => c.slug === "programming");
  for (const url of [programming.url, programming.roadmapUrl]) {
    const html = publicView(data, resolvePage(data, url));
    assert.match(html, /Python Fundamentals/);
    assert.match(html, /JavaScript Fundamentals/);
    assert.doesNotMatch(
      html,
      /Web Security Foundations|Interface Design|OWASP|PortSwigger/,
    );
  }
});
check(
  "Same lesson slug in two courses gets distinct canonical routes and no guessed flat redirect",
  () => {
    const python = data.topics.find(
      (t) => t.url === "/learning/programming/python-fundamentals/introduction",
    );
    const js = data.topics.find(
      (t) =>
        t.url === "/learning/programming/javascript-fundamentals/introduction",
    );
    assert.notEqual(python.id, js.id);
    assert.equal(python.legacyUrl, null);
    assert.equal(js.legacyUrl, null);
    assert.equal(
      resolvePage(data, "/learning/programming/introduction").type,
      "notfound",
    );
    assert.equal(
      resolvePage(data, python.url).path.slug,
      "python-fundamentals",
    );
    assert.equal(
      resolvePage(data, js.url).path.slug,
      "javascript-fundamentals",
    );
  },
);
check(
  "Course curriculum, next lesson and progress do not cross courses",
  () => {
    const python = data.paths.find((p) => p.slug === "python-fundamentals"),
      js = data.paths.find((p) => p.slug === "javascript-fundamentals");
    const html = publicView(data, resolvePage(data, python.url), {
      user: { id: "fixture" },
      pmap: new Map(js.topics.map((t) => [t.id, { passed: true }])),
      lastTopic: js.topics[1].id,
    });
    assert.match(html, /0 of 2 lessons completed/);
    assert.doesNotMatch(html, /JavaScript Fundamentals/);
    const last = publicView(data, resolvePage(data, python.topics.at(-1).url));
    assert.match(last, /last lesson in this course/);
    assert.doesNotMatch(last, /javascript-fundamentals/);
  },
);
check(
  "Programming lessons use custom sections/code, not forced security fields; code never executes",
  () => {
    const t = data.topics.find(
      (t) => t.url === "/learning/programming/python-fundamentals/introduction",
    );
    assert.deepEqual(
      sectionsFor(t).map((s) => s.id),
      ["overview", "examples", "exercise"],
    );
    const html = publicView(data, resolvePage(data, t.url));
    assert.doesNotMatch(html, /Defensive thinking|What to look for|<script>/);
    assert.match(html, /&lt;script&gt;window.injection = true&lt;\/script&gt;/);
    assert.match(html, /print\(message\)/);
    assert.equal(
      blocksView([
        { type: "paragraph", text: "<img src=x onerror=alert(1)>" },
      ]).includes("<img"),
      false,
    );
  },
);
check(
  "Existing security lesson IDs, URLs and section anchors stay unchanged",
  () => {
    const old = curriculum(seed);
    for (const t of old.topics) {
      const current = data.topics.find((x) => x.id === t.id);
      assert.equal(current.url, t.url);
      assert.equal(current.legacyUrl, t.legacyUrl);
      assert.equal(sectionsFor(current).length, 6);
      assert.equal(resolvePage(data, t.legacyUrl).url, t.url);
    }
  },
);
check(
  "Duplicate/reserved/empty/unsafe sections and cross-course assignments fail publishing",
  () => {
    const base = raw.topics.findIndex((t) => t.content.sections);
    for (const mutate of [
      (d) => {
        d.topics[base].content.sections = [];
      },
      (d) => {
        d.topics[base].content.sections[0].blocks = [];
      },
      (d) => {
        d.topics[base].content.sections[0].id = "quiz";
      },
      (d) => {
        d.topics[base].content.sections[1].id = "overview";
      },
      (d) => {
        d.topics[base].content.sections[0].blocks = [
          { type: "html", text: "<script>alert(1)</script>" },
        ];
      },
      (d) => {
        d.topics[base].path_id = d.paths[0].id;
      },
      (d) => {
        d.paths[1].slug = "roadmap";
      },
    ]) {
      const bad = structuredClone(raw);
      mutate(bad);
      assert.throws(() => curriculum(bad));
    }
  },
);
check(
  "Draft subjects/courses stay out of public discovery and all descendant routes",
  () => {
    const draft = structuredClone(raw);
    draft.paths.find((p) => p.slug === "python-fundamentals").status = "draft";
    const filtered = curriculum(draft);
    assert.ok(!filtered.routes.some((r) => r.includes("/python-fundamentals")));
    assert.ok(
      filtered.routes.includes(
        "/learning/programming/javascript-fundamentals/introduction",
      ),
    );
  },
);
console.log(`\n${checks} multi-subject/course isolation checks passed.`);
