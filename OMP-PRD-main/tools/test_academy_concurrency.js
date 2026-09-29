/* Real multi-connection PostgreSQL test. Starts/stops a disposable local cluster.
 * Optional dev deps: embedded-postgres, pg, @electric-sql/pglite (shared setup).
 * No connection string accepted: this test CANNOT touch a remote database.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const EmbeddedPostgres = require("embedded-postgres").default;
const { database, USER, TOPIC } = require("./academy_test_db");
const call = async (client, action, answers = null) => {
  const version =
    action === "submit_quiz"
      ? (
          await client.query(
            "select updated_at::text as version from learning_quizzes where topic_id=$1",
            [TOPIC],
          )
        ).rows[0].version
      : null;
  return client
    .query(
      "select public.academy_mutate($1::uuid,$2::uuid,$3::text,$4::integer[],$5::text,$6::timestamptz) as result",
      [USER, TOPIC, action, answers, "Concurrent Learner", version],
    )
    .then((r) => r.rows[0].result);
};
(async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "omp-pg-"));
  const pg = new EmbeddedPostgres({
    databaseDir: directory,
    user: "postgres",
    password: crypto.randomBytes(24).toString("hex"),
    port: 55439,
    persistent: false,
    initdbFlags: ["--locale=C", "--encoding=UTF8"],
    postgresFlags: ["-c", "listen_addresses=127.0.0.1"],
    onLog: () => {},
    onError: () => {},
  });
  const clients = [];
  let started = false;
  try {
    await pg.initialise();
    await pg.start();
    started = true;
    for (let i = 0; i < 4; i++) {
      const c = pg.getPgClient();
      await c.connect();
      clients.push(c);
    }
    const [control, a, b, observer] = clients;
    await database({
      exec: (sql) => control.query(sql),
      query: (...args) => control.query(...args),
    });
    async function block() {
      await control.query("begin");
      await control.query(
        "select * from learning_progress where user_id=$1 and topic_id=$2 for update",
        [USER, TOPIC],
      );
    }
    async function waitForBlocked(count) {
      const end = Date.now() + 5000;
      while (Date.now() < end) {
        const { rows } = await observer.query(
          "select count(*)::int as n from pg_stat_activity where wait_event_type='Lock' and query like 'select public.academy_mutate%'",
        );
        if (rows[0].n >= count) return;
        await new Promise((r) => setTimeout(r, 10));
      }
      throw new Error("Expected real concurrent lock contention");
    }
    await call(control, "complete_lab");
    await block();
    const failA = call(a, "submit_quiz", [3, 3, 3, 0]);
    const failB = call(b, "submit_quiz", [3, 3, 3, 0]);
    await waitForBlocked(2);
    await control.query("commit");
    assert.deepEqual(
      (await Promise.all([failA, failB])).map((r) => r.http_status).sort(),
      [200, 423],
    );
    assert.equal(
      (await control.query("select quiz_attempts from learning_progress"))
        .rows[0].quiz_attempts,
      1,
    );
    console.log(
      "✓ Two genuinely overlapping quiz transactions: one attempt graded, the other locked",
    );

    await control.query("update learning_progress set next_retry_at=null");
    await block();
    const pass = call(a, "submit_quiz", [0, 1, 2, 3]);
    const progress = call(b, "start_lesson");
    await waitForBlocked(2);
    await control.query("commit");
    await Promise.all([pass, progress]);
    const saved = (await control.query("select * from learning_progress"))
      .rows[0];
    assert.equal(saved.passed, true);
    assert.equal(saved.highest_score, 20);
    assert.equal(saved.quiz_attempts, 2);
    assert.equal(
      (
        await control.query(
          "select count(*)::int as n from learning_certificates",
        )
      ).rows[0].n,
      1,
    );
    console.log(
      "✓ Overlapping progress/quiz transactions preserve the pass, score, attempts and certificate",
    );

    await control.query("delete from learning_certificates");
    await block();
    const recoverA = call(a, "recover_certificate"),
      recoverB = call(b, "recover_certificate");
    await waitForBlocked(2);
    await control.query("commit");
    const recovered = await Promise.all([recoverA, recoverB]);
    assert.equal(
      recovered[0].certificate.certificate_id,
      recovered[1].certificate.certificate_id,
    );
    assert.equal(
      (
        await control.query(
          "select count(*)::int as n from learning_certificates",
        )
      ).rows[0].n,
      1,
    );
    console.log(
      "✓ Overlapping certificate recovery creates exactly one certificate",
    );

    // A publisher owns the parent lock first. A mutation must wait and then
    // re-evaluate publication instead of issuing under the now-draft path.
    await control.query("begin");
    await control.query("update learning_paths set status='draft'");
    const unpublished = call(a, "recover_certificate");
    await waitForBlocked(1);
    await control.query("commit");
    assert.equal((await unpublished).http_status, 404);
    console.log(
      "✓ Concurrent parent unpublication is respected after the lock wait",
    );
    await control.query(
      "update learning_paths set status='published'; delete from learning_certificates; delete from learning_progress;",
    );
    await call(control, "complete_lab");
    await control.query("begin");
    await control.query(
      "update learning_quizzes set questions=questions where topic_id=$1",
      [TOPIC],
    );
    const edited = call(a, "submit_quiz", [0, 1, 2, 3]);
    await waitForBlocked(1);
    await control.query("commit");
    assert.equal((await edited).http_status, 409);
    assert.equal(
      (await control.query("select quiz_attempts from learning_progress"))
        .rows[0].quiz_attempts,
      0,
    );
    console.log(
      "✓ Concurrent quiz edits reject stale answers without consuming an attempt",
    );
    console.log(
      "\n5 real PostgreSQL concurrency checks passed. Disposable cluster only.",
    );
  } finally {
    await Promise.all(clients.map((c) => c.end().catch(() => {})));
    if (started) await pg.stop();
    await fs.rm(directory, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
