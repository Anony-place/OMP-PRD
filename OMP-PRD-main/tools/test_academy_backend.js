/* Actual Edge handler + actual SQL regression tests; local PGlite, no network.
 * Node 22.13+, NODE_PATH containing @electric-sql/pglite.
 * PGlite serializes queries: this is not a multi-connection lock contention test.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { stripTypeScriptTypes } = require("node:module");
const { database, USER, OTHER, TOPIC } = require("./academy_test_db");
const root = path.join(__dirname, "../supabase/functions");
const env = {
  SUPABASE_URL: "https://fixture.invalid",
  SUPABASE_ANON_KEY: "public-test",
  SUPABASE_SERVICE_ROLE_KEY: "secret-test",
};
let db,
  checks = 0;
const ok = (label) => {
  checks++;
  console.log("✓ " + label);
};
async function rpc(args) {
  return (
    await db.query(
      "select public.academy_mutate($1::uuid,$2::uuid,$3::text,$4::integer[],$5::text,$6::timestamptz) as result",
      [
        args.p_user_id,
        args.p_topic_id,
        args.p_action,
        args.p_answers,
        args.p_recipient_name,
        args.p_quiz_version || null,
      ],
    )
  ).rows[0].result;
}
function handler(kind, config = {}) {
  let serve;
  const file =
    kind === "verify"
      ? "learning-certificate-verify"
      : kind === "quiz"
        ? "learning-quiz-submit"
        : "learning-progress";
  const files = [
    "_shared/academy-env.ts",
    ...(kind === "verify" ? [] : ["_shared/academy-mutation.ts"]),
    `${file}/index.ts`,
  ];
  const source = files
    .map((file) =>
      fs
        .readFileSync(path.join(root, file), "utf8")
        .replace(/^import .*$/gm, "")
        .replace(/^export /gm, ""),
    )
    .join("\n");
  const createClient = (_url, key) => {
    assert.ok(
      key === "public-test" || key === "secret-test",
      "Resolver must provide non-empty supported key",
    );
    return {
      auth: {
        getUser: async () => ({
          data: {
            user: config.invalidSession
              ? null
              : { id: USER, user_metadata: { full_name: "Test Learner" } },
          },
          error: null,
        }),
      },
      rpc: async (name, args) => {
        assert.equal(name, "academy_mutate");
        assert.equal(key, "secret-test");
        try {
          return { data: await rpc(args), error: null };
        } catch (error) {
          return { data: null, error };
        }
      },
      from: () => {
        const query = {
          select() {
            return this;
          },
          eq(_key, value) {
            this.id = value;
            return this;
          },
          async maybeSingle() {
            const data = (
              await db.query(
                "select certificate_id,recipient_name,topic_name,category_name,course_name,score,issued_at from learning_certificates where certificate_id=$1",
                [this.id],
              )
            ).rows[0];
            return { data, error: null };
          },
        };
        return query;
      },
    };
  };
  vm.runInNewContext(stripTypeScriptTypes(source), {
    Deno: {
      env: { get: (key) => (config.env || env)[key] },
      serve: (fn) => {
        serve = fn;
      },
    },
    createClient,
    corsHeaders: {},
    Request,
    Response,
    URL,
    console: { error() {} },
  });
  return async (body, options = {}) => {
    const method = options.method || (kind === "verify" ? "GET" : "POST");
    const res = await serve(
      new Request(
        "https://fixture.invalid/?certificate_id=" +
          encodeURIComponent(options.id || ""),
        {
          method,
          headers: options.noAuth ? {} : { Authorization: "Bearer test-user" },
          ...(["POST", "PUT"].includes(method)
            ? { body: JSON.stringify(body) }
            : {}),
        },
      ),
    );
    return {
      status: res.status,
      body: res.status === 204 ? null : await res.json().catch(() => null),
    };
  };
}
async function reset() {
  await db.exec(
    "delete from learning_certificates; delete from learning_progress;",
  );
}
const progress = (action) => ({ topic_id: TOPIC, action });
let quizVersion;
const quiz = (answers) => ({
  topic_id: TOPIC,
  answers,
  quiz_version: quizVersion,
});
const good = [0, 1, 2, 3],
  bad = [3, 3, 3, 0];
(async () => {
  db = await database();
  quizVersion = (
    await db.query(
      "select updated_at::text as version from learning_quizzes where topic_id=$1",
      [TOPIC],
    )
  ).rows[0].version;
  try {
    const p = handler("progress"),
      q = handler("quiz");
    for (const grouped of [
      undefined,
      "{}",
      "null",
      "[]",
      "{bad",
      '{"default":""}',
      '{"default":42}',
      '{"default":"   "}',
    ]) {
      const h = handler("progress", {
        env: {
          ...env,
          SUPABASE_PUBLISHABLE_KEYS: grouped,
          SUPABASE_SECRET_KEYS: grouped,
        },
      });
      assert.equal((await h(progress("start_lesson"))).status, 200);
    }
    assert.equal(
      (
        await handler("progress", {
          env: {
            SUPABASE_URL: env.SUPABASE_URL,
            SUPABASE_PUBLISHABLE_KEYS: '{"default":"public-test"}',
            SUPABASE_SECRET_KEYS: '{"default":"secret-test"}',
          },
        })(progress("start_lesson"))
      ).status,
      200,
    );
    assert.equal(
      (
        await handler("progress", { env: { SUPABASE_URL: env.SUPABASE_URL } })(
          progress("start_lesson"),
        )
      ).status,
      500,
    );
    ok(
      "A1: legacy/grouped/fallback configurations work; missing keys fail closed",
    );
    assert.equal(
      (await p(progress("start_lesson"), { noAuth: true })).status,
      401,
    );
    assert.equal(
      (await handler("quiz", { invalidSession: true })(quiz(good))).status,
      401,
    );
    assert.equal((await p({}, { method: "GET" })).status, 405);
    assert.equal(
      (await p({ topic_id: "invalid", action: "start_lesson" })).status,
      400,
    );
    assert.equal(
      (await p({ topic_id: [TOPIC], action: "start_lesson" })).status,
      400,
    );
    for (const answers of [
      [true, 1, 2, 3],
      ["0", 1, 2, 3],
      [null, 1, 2, 3],
      [0, 1, 2],
      [0, 1, 2, 4],
    ])
      assert.equal((await q(quiz(answers))).status, 400);
    ok("Authentication, method, UUID and strictly numeric answer validation");
    await reset();
    assert.equal((await q(quiz(good))).status, 409);
    assert.equal((await p(progress("recover_certificate"))).status, 409);
    await p(progress("complete_lab"));
    const stale = await q({
      ...quiz(good),
      quiz_version: "2020-01-01T00:00:00Z",
    });
    assert.equal(stale.status, 409);
    assert.equal(stale.body.code, "QUIZ_CHANGED");
    assert.equal(
      (await db.query("select quiz_attempts from learning_progress")).rows[0]
        .quiz_attempts,
      0,
    );
    ok("Stale quiz revisions are rejected without consuming an attempt");
    const passed = await q({ ...quiz(good), user_id: OTHER, score: 0 });
    assert.equal(passed.status, 200);
    assert.equal(passed.body.score, 20);
    assert.equal(passed.body.certificate.recipient_name, "Test Learner");
    assert.equal(passed.body.progress.user_id, USER);
    for (const action of ["start_lesson", "complete_lab"]) {
      const after = await p(progress(action));
      assert.equal(after.body.progress.passed, true);
      assert.equal(after.body.progress.highest_score, 20);
      assert.equal(after.body.progress.quiz_attempts, 1);
      assert.equal(after.body.progress.state, "PASSED");
    }
    const again = await q(quiz(bad));
    assert.equal(
      again.body.certificate.certificate_id,
      passed.body.certificate.certificate_id,
    );
    assert.equal(again.body.progress.quiz_attempts, 1);
    ok(
      "A2: progress writes preserve grading; identity/score are server-authoritative; passing retries are idempotent",
    );
    const verified = await handler("verify")(
      {},
      { id: passed.body.certificate.certificate_id },
    );
    assert.equal(verified.status, 200);
    assert.equal(verified.body.valid, true);
    assert.equal(
      verified.body.certificate.course_name,
      "Web Security Foundations",
    );
    assert.equal(verified.body.certificate.user_id, undefined);
    assert.equal(
      (await handler("verify")({}, { id: "OMP-" + "A".repeat(24) })).status,
      404,
    );
    assert.equal((await handler("verify")({}, { id: "bad" })).status, 400);
    ok(
      "Certificate verification resolves generated IDs and never includes private user IDs",
    );
    await reset();
    await p(progress("complete_lab"));
    const attempts = await Promise.all([q(quiz(bad)), q(quiz(bad))]);
    assert.deepEqual(attempts.map((x) => x.status).sort(), [200, 423]);
    assert.equal(
      (await db.query("select quiz_attempts from learning_progress")).rows[0]
        .quiz_attempts,
      1,
    );
    assert.equal(
      (await p(progress("start_lesson"))).body.progress.state,
      "RETRY_LOCKED",
    );
    await db.exec(
      "update learning_progress set next_retry_at=clock_timestamp()-interval '1 second'",
    );
    assert.equal((await q(quiz(bad))).body.progress.quiz_attempts, 2);
    ok(
      "A3: back-to-back requests enforce cooldown, progress cannot reset it, expired cooldown allows exactly the next attempt",
    );
    await reset();
    await p(progress("complete_lab"));
    const before = (await db.query("select * from learning_progress")).rows[0];
    await db.exec(`create function public.fail_certificate() returns trigger language plpgsql as $$ begin raise exception 'Injected failure'; end $$;
      create trigger fail_certificate before insert on learning_certificates for each row execute function public.fail_certificate();`);
    assert.equal((await q(quiz(good))).status, 500);
    assert.deepEqual(
      (await db.query("select * from learning_progress")).rows[0],
      before,
    );
    await db.exec("drop trigger fail_certificate on learning_certificates;");
    assert.equal((await q(quiz(good))).status, 200);
    await db.exec("delete from learning_certificates;"); // legacy partial failure
    const repaired = await p(progress("recover_certificate"));
    assert.ok(repaired.body.certificate.certificate_id);
    assert.equal(repaired.body.progress.quiz_attempts, 1);
    ok(
      "A4: injected certificate failure rolls back the pass; retry succeeds; historic missing certificate repairs without another attempt",
    );
    for (const [table, column, off, on] of [
      ["learning_topics", "status", "'draft'", "'published'"],
      ["learning_modules", "status", "'draft'", "'published'"],
      ["learning_paths", "status", "'draft'", "'published'"],
      ["learning_categories", "is_active", "false", "true"],
    ]) {
      await db.exec(`update ${table} set ${column}=${off}`);
      assert.equal((await q(quiz(good))).status, 404, table);
      assert.equal((await p(progress("start_lesson"))).status, 404, table);
      await db.exec(`update ${table} set ${column}=${on}`);
    }
    ok(
      "A5: both handlers reject unavailable topics, modules, paths and categories",
    );
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await assert.rejects(
        rpc({
          p_user_id: OTHER,
          p_topic_id: TOPIC,
          p_action: "complete_lab",
          p_answers: null,
          p_recipient_name: null,
        }),
        /permission denied/,
      );
      await assert.rejects(
        db.query("update learning_progress set passed=true"),
        /permission denied/,
      );
      await assert.rejects(
        db.query("delete from learning_certificates"),
        /permission denied/,
      );
      assert.equal(
        (
          await db.query(
            "select has_table_privilege(current_user,'learning_progress','TRUNCATE') as allowed",
          )
        ).rows[0].allowed,
        false,
      );
      await db.exec("reset role");
    }
    await db.exec("set role service_role");
    assert.equal((await p(progress("start_lesson"))).status, 200);
    await db.exec("reset role");
    ok(
      "Only service_role can invoke the mutation RPC; learners cannot forge scores/certificates via direct writes",
    );
    await reset();
    await p(progress("complete_lab"));
    const key = (
      await db.query(
        "select a.* from learning_quiz_answers a join learning_quizzes q on q.id=a.quiz_id where q.topic_id=$1 order by question_index",
        [TOPIC],
      )
    ).rows[0];
    await db.query("delete from learning_quiz_answers where id=$1", [key.id]);
    quizVersion = (
      await db.query(
        "select updated_at::text as version from learning_quizzes where topic_id=$1",
        [TOPIC],
      )
    ).rows[0].version;
    assert.equal((await q(quiz(good))).status, 500);
    assert.equal(
      (await db.query("select quiz_attempts from learning_progress")).rows[0]
        .quiz_attempts,
      0,
    );
    await db.query(
      "insert into learning_quiz_answers(id,quiz_id,question_index,answer_index) values($1,$2,$3,$4)",
      [key.id, key.quiz_id, key.question_index, key.answer_index],
    );
    const balanced = (
      await db.query(
        "select a.answer_index,a.question_index from learning_quiz_answers a order by question_index",
      )
    ).rows;
    assert.equal(balanced.length, 16);
    assert.ok(balanced.every((a) => a.answer_index === a.question_index));
    // The selected correct text is preserved by the balance migration.
    for (const row of (await db.query("select questions from learning_quizzes"))
      .rows)
      assert.equal(row.questions.length, 4);
    ok(
      "Incomplete keys fail closed without consuming attempts; foundation answer positions are balanced",
    );
    console.log(
      `\n${checks} backend regression groups passed (actual handlers + local PostgreSQL, no live services).`,
    );
  } finally {
    await db.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
