/* Actual local PostgreSQL constraints/RPC with three subjects and four courses. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { database, USER } = require("./academy_test_db");
const { multiSubjectFixture } = require("./academy_multi_subject_fixture.mjs");
(async () => {
  const db = await database();
  try {
    const seed = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "../assets/data/academy-reading.json"),
        "utf8",
      ),
    );
    const fixture = multiSubjectFixture(seed);
    for (const [key, table] of [
      ["categories", "learning_categories"],
      ["paths", "learning_paths"],
      ["modules", "learning_modules"],
      ["topics", "learning_topics"],
    ]) {
      const known = new Set(seed[key].map((r) => r.id));
      for (const row of fixture[key].filter((r) => !known.has(r.id))) {
        const columns = Object.keys(row);
        await db.query(
          `insert into ${table}(${columns.join(",")}) values(${columns.map((_, i) => "$" + (i + 1)).join(",")})`,
          columns.map((k) =>
            Array.isArray(row[k]) || typeof row[k] === "object"
              ? JSON.stringify(row[k])
              : row[k],
          ),
        );
      }
    }
    const python = fixture.paths.find((p) => p.slug === "python-fundamentals"),
      js = fixture.paths.find((p) => p.slug === "javascript-fundamentals");
    const pyIntro = fixture.topics.find(
        (t) => t.path_id === python.id && t.slug === "introduction",
      ),
      jsIntro = fixture.topics.find(
        (t) => t.path_id === js.id && t.slug === "introduction",
      );
    assert.equal(
      (
        await db.query(
          "select * from learning_topics where category_id=$1 and slug='introduction'",
          [python.category_id],
        )
      ).rows.length,
      2,
    );
    await assert.rejects(
      db.query(
        "insert into learning_topics(category_id,module_id,slug,name) values($1,$2,'introduction','Duplicate')",
        [python.category_id, pyIntro.module_id],
      ),
      /unique constraint/,
    );
    console.log(
      "✓ Same lesson slug works across courses, but duplicates inside one course are rejected",
    );
    await assert.rejects(
      db.query(
        "insert into learning_topics(category_id,module_id,path_id,slug,name) values($1,$2,$3,'invalid','Invalid')",
        [python.category_id, pyIntro.module_id, js.id],
      ),
      /foreign key/,
    );
    await assert.rejects(
      db.query(
        "insert into learning_paths(category_id,slug,name,description,audience) values($1,'roadmap','Invalid','Invalid','Invalid')",
        [python.category_id],
      ),
      /check constraint/,
    );
    console.log(
      "✓ Explicit cross-course assignments and reserved roadmap slugs are rejected by PostgreSQL",
    );
    const assigned = (
      await db.query(
        "insert into learning_topics(category_id,module_id,slug,name,status) values($1,$2,'extra-draft','Draft','draft') returning path_id",
        [python.category_id, pyIntro.module_id],
      )
    ).rows[0];
    assert.equal(assigned.path_id, python.id);
    console.log(
      "✓ Legacy module-only authoring derives the right owning course automatically",
    );
    const call = (topic, action) =>
      db.query("select academy_mutate($1::uuid,$2::uuid,$3::text) as result", [
        USER,
        topic,
        action,
      ]);
    await call(pyIntro.id, "complete_lab");
    await call(jsIntro.id, "start_lesson");
    const rows = (
      await db.query("select * from learning_progress where user_id=$1", [USER])
    ).rows;
    assert.equal(
      rows.find((r) => r.topic_id === pyIntro.id).lab_completed,
      true,
    );
    assert.equal(
      rows.find((r) => r.topic_id === jsIntro.id).lab_completed,
      false,
    );
    console.log(
      "✓ Progress for identical lesson slugs stays isolated by lesson ID/course",
    );
    await assert.rejects(
      db.query("update learning_topics set module_id=$1 where id=$2", [
        jsIntro.module_id,
        pyIntro.id,
      ]),
      /learner history/,
    );
    await assert.rejects(
      db.query(
        "update learning_topics set module_id=null,path_id=null where id=$1",
        [pyIntro.id],
      ),
      /learner history/,
    );
    console.log(
      "✓ A lesson with learner history cannot silently move to another course or become unassigned",
    );
    await db.query("update learning_paths set status='draft' where id=$1", [
      python.id,
    ]);
    await db.exec("set role anon");
    assert.equal(
      (
        await db.query("select * from learning_topics where path_id=$1", [
          python.id,
        ])
      ).rows.length,
      0,
    );
    assert.equal(
      (
        await db.query("select * from learning_topics where path_id=$1", [
          js.id,
        ])
      ).rows.length,
      2,
    );
    await db.exec("reset role");
    assert.equal(
      (await call(pyIntro.id, "start_lesson")).rows[0].result.http_status,
      404,
    );
    assert.equal(
      (await call(jsIntro.id, "start_lesson")).rows[0].result.http_status,
      200,
    );
    console.log(
      "✓ Unpublishing one course hides/blocks only that course, not its sibling course",
    );
    for (const topic of [pyIntro, jsIntro]) {
      const result = await db.query(
        "insert into learning_certificates(certificate_id,user_id,topic_id,category_id,recipient_name,topic_name,category_name,score) values($1,$2,$3,$4,'Learner','Introduction','Programming',20) returning course_id,course_name",
        ["OMP-FIXTURE-" + topic.id, USER, topic.id, topic.category_id],
      );
      assert.equal(result.rows[0].course_id, topic.path_id);
      assert.equal(
        result.rows[0].course_name,
        topic.path_id === python.id ? python.name : js.name,
      );
    }
    console.log(
      "✓ Identically named lesson certificates snapshot their distinct owning course",
    );
    console.log(
      "\n7 multi-course PostgreSQL checks passed. No live services contacted.",
    );
  } finally {
    await db.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
