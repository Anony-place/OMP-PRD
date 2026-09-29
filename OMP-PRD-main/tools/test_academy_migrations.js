/* Ephemeral local PostgreSQL (PGlite), never a live Supabase project.
 * Optional dev dependency: npm i --no-save @electric-sql/pglite
 * Tests migrations against the actual existing foundation schema/seed.
 */
const { PGlite } = require("@electric-sql/pglite");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const root = path.join(__dirname, "..");
const sql = (name) =>
  fs.readFileSync(path.join(root, "supabase/migrations", name), "utf8");
(async () => {
  const db = new PGlite();
  try {
    await db.exec(`create schema auth; create role anon; create role authenticated; create role service_role bypassrls;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to anon,authenticated;`);
    const base = sql("20260927130000_security_academy.sql");
    await db.exec(
      base.slice(0, base.indexOf("insert into public.learning_categories")),
    );
    await db.exec(
      base.slice(
        base.indexOf("alter table public.learning_categories enable"),
        base.indexOf("-- Rebalance answer positions"),
      ),
    );
    await db.exec(sql("20260927143000_reset_to_web_application_security.sql"));
    // Mimic Supabase's public read grants; RLS must still deny private rows.
    await db.exec(
      "grant select on all tables in schema public to anon,authenticated;",
    );
    const user = "60000000-0000-4000-8000-000000000001",
      other = "60000000-0000-4000-8000-000000000002";
    const category = "d93dd172-940d-469c-9e2b-126acfc36bff",
      topic = "10000000-0000-4000-8000-000000000001";
    await db.exec(`insert into auth.users values ('${user}'),('${other}');
 insert into public.learning_progress(user_id,category_id,topic_id,lesson_started,passed,highest_score) values ('${user}','${category}','${topic}',true,true,20);
 insert into public.learning_certificates(certificate_id,user_id,topic_id,category_id,recipient_name,topic_name,category_name,score) values ('OMP-LOCAL-TEST','${user}','${topic}','${category}','Test Learner','Test Topic','Test Category',20);`);
    const before = (await db.query("select * from learning_progress")).rows;
    await db.exec(sql("20260929090000_correct_foundation_quiz_keys.sql"));
    await db.exec(sql("20260929120000_academy_curriculum_hierarchy.sql"));
    assert.deepEqual(
      (await db.query("select * from learning_progress")).rows,
      before,
    );
    assert.equal(
      (
        await db.query(
          "select * from learning_topics where module_id is not null",
        )
      ).rows.length,
      4,
    );
    assert.equal(
      (
        await db.query(
          "select * from learning_quiz_answers where answer_index <> 3",
        )
      ).rows.length,
      0,
    );
    console.log(
      "✓ Additive migrations preserve progress and certificates, organize 4 topics, and correct the quiz keys",
    );
    await db.exec("set role anon;");
    assert.equal(
      (await db.query("select * from learning_paths")).rows.length,
      1,
    );
    assert.equal(
      (await db.query("select * from learning_modules")).rows.length,
      2,
    );
    assert.equal(
      (await db.query("select * from learning_topics")).rows.length,
      4,
    );
    assert.equal(
      (await db.query("select * from learning_quiz_answers")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from learning_certificates")).rows.length,
      0,
    );
    await assert.rejects(
      db.query(
        "insert into learning_paths(category_id,slug,name,description,audience) values ($1,'private','Private','Private','Private')",
        [category],
      ),
    );
    console.log(
      "✓ Public read policies expose published hierarchy but deny keys, certificates and curriculum writes",
    );
    await db.exec(
      "reset role; update learning_paths set status='draft'; set role anon;",
    );
    for (const table of [
      "learning_paths",
      "learning_modules",
      "learning_topics",
      "learning_labs",
      "learning_quizzes",
    ])
      assert.equal(
        (await db.query("select * from " + table)).rows.length,
        0,
        table + " must be hidden with its parent",
      );
    console.log(
      "✓ Unpublishing a parent hides child modules, topics, labs and quizzes through RLS",
    );
    await db.exec(
      `reset role; update learning_paths set status='published'; set role authenticated; set request.jwt.claim.sub='${user}';`,
    );
    assert.equal(
      (await db.query("select * from learning_certificates")).rows.length,
      1,
    );
    await db.exec(`set request.jwt.claim.sub='${other}';`);
    assert.equal(
      (await db.query("select * from learning_certificates")).rows.length,
      0,
    );
    console.log("✓ A learner can retrieve only their own existing certificate");
    await db.exec(
      `reset role; insert into learning_categories(id,slug,name) values ('70000000-0000-4000-8000-000000000001','other','Other');`,
    );
    await assert.rejects(
      db.query(
        "insert into learning_topics(category_id,module_id,slug,name) values ('70000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','bad-parent','Bad parent')",
      ),
    );
    console.log(
      "✓ Composite foreign keys prevent a topic from crossing category boundaries",
    );
    await db.exec(`insert into learning_progress(user_id,category_id,topic_id,passed,highest_score) values ('${other}','${category}','${topic}',false,0);
      insert into learning_certificates(certificate_id,user_id,topic_id,category_id,recipient_name,topic_name,category_name,score) values ('OMP-HISTORIC-TEST','${other}','${topic}','${category}','Historic learner','Test','Test',20);`);
    const certificatesBefore = (
      await db.query("select * from learning_certificates")
    ).rows;
    const correctText =
      "select q.id,a.question_index,q.questions->a.question_index->'options'->>a.answer_index as correct from learning_quizzes q join learning_quiz_answers a on a.quiz_id=q.id order by q.id,a.question_index";
    const answersBefore = (await db.query(correctText)).rows;
    await db.exec(sql("20260929150000_academy_atomic_mutations.sql"));
    await db.exec(sql("20260929160000_academy_quiz_option_balance.sql"));
    assert.deepEqual((await db.query(correctText)).rows, answersBefore);
    assert.deepEqual(
      (
        await db.query("select * from learning_progress where user_id=$1", [
          user,
        ])
      ).rows,
      before,
    );
    assert.deepEqual(
      (await db.query("select * from learning_certificates")).rows,
      certificatesBefore,
    );
    assert.equal(
      (
        await db.query(
          "select * from learning_quiz_answers where answer_index <> question_index",
        )
      ).rows.length,
      0,
    );
    console.log(
      "✓ Atomic mutation and option-balance migrations preserve learner records and every correct answer's meaning",
    );
    const restored = (
      await db.query("select * from learning_progress where user_id=$1", [
        other,
      ])
    ).rows[0];
    assert.equal(restored.passed, true);
    assert.equal(restored.highest_score, 20);
    assert.equal(restored.state, "PASSED");
    console.log(
      "✓ Historical certificate/progress inconsistencies restore completion without deleting records",
    );
    const beforeCourseMigration = (
      await db.query("select * from learning_progress order by id")
    ).rows;
    await db.exec(sql("20260929200000_academy_multi_subject_courses.sql"));
    assert.deepEqual(
      (await db.query("select * from learning_progress order by id")).rows,
      beforeCourseMigration,
    );
    assert.deepEqual(
      (await db.query("select * from learning_certificates")).rows.map(
        ({ course_id, course_name, ...original }) => original,
      ),
      certificatesBefore,
    );
    assert.equal(
      (
        await db.query(
          "select * from learning_topics where path_id is not null",
        )
      ).rows.length,
      4,
    );
    console.log(
      "✓ Course-scoped lesson migration preserves IDs/progress/certificates and backfills owning courses",
    );
    console.log(
      "\n8 local PostgreSQL migration checks passed. No live database was contacted.",
    );
  } finally {
    await db.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
