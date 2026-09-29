/* Real newsletter SQL and actual Edge handler; provider/captcha calls are faked. No email sent. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
const { stripTypeScriptTypes } = require("node:module"),
  { webcrypto } = require("node:crypto");
const { PGlite } = require("@electric-sql/pglite");
let n = 0;
const ok = (s) => {
  n++;
  console.log("✓ " + s);
};
(async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create table articles(id uuid primary key default gen_random_uuid(),title text,slug text,summary text,status text,published_at timestamptz);`);
    await db.exec(
      fs.readFileSync(
        "supabase/migrations/20260929210000_article_newsletter.sql",
        "utf8",
      ),
    );
    const env = {
      SUPABASE_URL: "https://fixture.invalid",
      SUPABASE_SERVICE_ROLE_KEY: "server-key",
      NEWSLETTER_TOKEN_SECRET: "s".repeat(40),
      RESEND_API_KEY: "mail-test",
      NEWSLETTER_FROM: "OMP <updates@example.test>",
      TURNSTILE_SECRET_KEY: "captcha-test",
      NEWSLETTER_WORKER_SECRET: "w".repeat(40),
    };
    let mails = [],
      captchaValid = true,
      mailFail = false,
      pageReady = true,
      handler;
    const rpc = async (name, args = {}) => {
      let r;
      if (name === "newsletter_request")
        r = await db.query("select newsletter_request($1,$2) as result", [
          args.p_email,
          args.p_hash,
        ]);
      else if (name === "newsletter_unsubscribe")
        r = await db.query(
          "select newsletter_unsubscribe($1::uuid) as result",
          [args.p_id],
        );
      else if (name === "newsletter_confirm")
        r = await db.query("select newsletter_confirm($1) as result", [
          args.p_hash,
        ]);
      else if (name === "newsletter_claim")
        return {
          data: (await db.query("select * from newsletter_claim()")).rows,
          error: null,
        };
      else throw Error("Unexpected RPC " + name);
      return { data: r.rows[0].result, error: null };
    };
    const client = {
      rpc,
      from(table) {
        assert.ok(
          [
            "newsletter_subscribers",
            "newsletter_deliveries",
            "articles",
          ].includes(table),
        );
        let fields = "*",
          update,
          where = [];
        const q = {
          select(s) {
            fields = s;
            return q;
          },
          update(v) {
            update = v;
            return q;
          },
          eq(k, v) {
            assert.match(k, /^[a-z_]+$/);
            where.push([k, v]);
            return q;
          },
          single() {
            q.one = true;
            return q;
          },
          then(resolve, reject) {
            const values = [];
            const bind = (v) => {
              values.push(v);
              return "$" + values.length;
            };
            let sql = update
              ? "update " +
                table +
                " set " +
                Object.entries(update)
                  .map(([k, v]) => k + "=" + bind(v))
                  .join(",")
              : "select " + fields + " from " + table;
            if (where.length)
              sql +=
                " where " +
                where.map(([k, v]) => k + "=" + bind(v)).join(" and ");
            if (update) sql += " returning *";
            return db
              .query(sql, values)
              .then((r) => ({
                data: q.one ? r.rows[0] : r.rows,
                error: q.one && !r.rows.length ? new Error("missing") : null,
              }))
              .then(resolve, reject);
          },
        };
        return q;
      },
    };
    const source = [
      "supabase/functions/_shared/academy-env.ts",
      "supabase/functions/newsletter/index.ts",
    ]
      .map((p) =>
        fs
          .readFileSync(p, "utf8")
          .replace(/^import .*;\n/gm, "")
          .replace(/^export /gm, ""),
      )
      .join("\n");
    vm.runInNewContext(stripTypeScriptTypes(source), {
      Deno: { env: { get: (k) => env[k] }, serve: (fn) => (handler = fn) },
      createClient: (url, key) => {
        assert.equal(key, "server-key");
        return client;
      },
      crypto: webcrypto,
      TextEncoder,
      Request,
      Response,
      Headers,
      URL,
      URLSearchParams,
      AbortSignal,
      console,
      fetch: async (url, opts) => {
        if (url.startsWith("https://oopsmypassword.web.app/articles/")) {
          assert.equal(opts.method, "HEAD");
          return new Response(null, {
            status: pageReady ? 200 : 404,
            headers: { "content-type": "text/html" },
          });
        }
        if (url.includes("siteverify"))
          return Response.json({
            success: captchaValid,
            hostname: "oopsmypassword.web.app",
            action: "newsletter",
          });
        assert.equal(url, "https://api.resend.com/emails");
        if (mailFail)
          return Response.json({ error: "provider-down" }, { status: 503 });
        mails.push({ body: JSON.parse(opts.body), headers: opts.headers });
        return Response.json({ id: "mail-" + mails.length });
      },
    });
    async function call(body = {}, extra = {}) {
      const r = await handler(
        new Request(
          "https://fixture.invalid/functions/v1/newsletter" +
            (extra.query || ""),
          {
            method: extra.method || "POST",
            headers: {
              "Content-Type": "application/json",
              ...(extra.headers || {}),
            },
            ...((extra.method || "POST") === "POST"
              ? { body: JSON.stringify(body) }
              : {}),
          },
        ),
      );
      const text = await r.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
      return { status: r.status, data, headers: r.headers };
    }
    const subscribe = {
      action: "subscribe",
      email: "Learner@Example.test",
      consent: true,
      challenge: "valid-fixture",
    };
    assert.equal((await call({ ...subscribe, consent: false })).status, 400);
    captchaValid = false;
    assert.equal((await call(subscribe)).status, 400);
    captchaValid = true;
    assert.equal(mails.length, 0);
    ok(
      "Email, explicit consent and server-verified anti-spam challenge are required",
    );
    assert.equal(
      (await call(subscribe, { headers: { origin: "https://evil.test" } }))
        .status,
      403,
    );
    ok("Unapproved browser origins are rejected");
    assert.equal((await call(subscribe)).status, 200);
    assert.equal(mails.length, 1);
    assert.match(mails[0].body.html, /not an account or login/);
    let subscriber = (await db.query("select * from newsletter_subscribers"))
      .rows[0];
    assert.equal(subscriber.status, "pending");
    assert.equal(subscriber.email, "learner@example.test");
    const token = mails[0].body.html.match(
      /action=confirm&token=([a-f0-9]+)/,
    )[1];
    assert.notEqual(subscriber.confirmation_hash, token);
    ok(
      "Subscription stores a pending email only and sends a separate confirmation (hashed token at rest)",
    );
    await call(subscribe);
    assert.equal(mails.length, 1);
    ok("Repeated requests are throttled without revealing subscriber status");
    const get = await call(
      {},
      { method: "GET", query: "?action=confirm&token=" + token },
    );
    assert.equal(get.status, 303);
    const redirected = new URL(get.headers.get("location"));
    assert.equal(redirected.origin, "https://oopsmypassword.web.app");
    assert.equal(redirected.pathname, "/email-preferences");
    assert.equal(redirected.search, "");
    assert.equal(new URLSearchParams(redirected.hash.slice(1)).get("token"), token);
    assert.match(mails[0].body.html, /https:\/\/oopsmypassword.web.app\/email-preferences#action=confirm/);
    assert.equal(
      (await db.query("select status from newsletter_subscribers")).rows[0]
        .status,
      "pending",
    );
    ok("Email link scanners cannot confirm a subscription with GET");
    const a1 = (
      await db.query(
        "insert into articles(title,slug,status) values('Before confirmation','before','published') returning id",
      )
    ).rows[0].id;
    assert.equal(
      (await db.query("select * from newsletter_deliveries")).rows.length,
      0,
    );
    assert.equal((await call({ action: "confirm", token })).status, 200);
    assert.equal(
      (await db.query("select status from newsletter_subscribers")).rows[0]
        .status,
      "active",
    );
    await call({ action: "confirm", token });
    assert.equal(
      (await db.query("select * from newsletter_deliveries")).rows.length,
      0,
    );
    ok(
      "Only explicitly confirmed subscribers get future publications; no retroactive bulk email",
    );
    const article = (
      await db.query(
        "insert into articles(title,slug,summary,status) values('<script>New</script>','new-article','& review','draft') returning id",
      )
    ).rows[0].id;
    assert.equal(
      (await db.query("select * from newsletter_deliveries")).rows.length,
      0,
    );
    await db.query("update articles set status='published' where id=$1", [
      article,
    ]);
    await db.query("update articles set summary='Changed' where id=$1", [
      article,
    ]);
    assert.equal(
      (await db.query("select * from newsletter_deliveries")).rows.length,
      1,
    );
    ok(
      "Publishing automatically queues an article; drafts and ordinary edits do not send updates",
    );
    assert.equal((await call({ action: "dispatch" })).status, 401);
    const auth = {
      headers: { authorization: "Bearer " + env.NEWSLETTER_WORKER_SECRET },
    };
    pageReady = false;
    const deferred = await call({ action: "dispatch" }, auth);
    assert.equal(deferred.data.deferred, 1);
    assert.equal(mails.length, 1);
    assert.equal(
      (await db.query("select attempts from newsletter_deliveries")).rows[0]
        .attempts,
      0,
    );
    pageReady = true;
    await db.query("update newsletter_deliveries set available_at=now()");
    ok(
      "New-article email waits for a real published HTML URL rather than sending a broken link",
    );
    const result = await call({ action: "dispatch" }, auth);
    assert.equal(result.data.sent, 1);
    assert.equal(mails.length, 2);
    assert.ok(!mails[1].body.html.includes("<script>"));
    assert.match(mails[1].headers["Idempotency-Key"], /^article-/);
    assert.ok(mails[1].body.headers["List-Unsubscribe"]);
    await call({ action: "dispatch" }, auth);
    assert.equal(mails.length, 2);
    ok(
      "Only the authorized worker sends; content is escaped and delivery is deduplicated",
    );
    await db.query("update articles set status='draft' where id=$1", [article]);
    await db.query("update articles set status='published' where id=$1", [
      article,
    ]);
    assert.equal(
      (await db.query("select * from newsletter_deliveries")).rows.length,
      1,
    );
    ok(
      "Republishing the same article does not re-send to its existing recipients",
    );
    const unsub = mails[1].body.headers["List-Unsubscribe"].slice(1, -1),
      u = new URL(unsub);
    assert.equal(
      (await call({}, { method: "GET", query: u.search })).status,
      303,
    );
    assert.equal(
      (await db.query("select status from newsletter_subscribers")).rows[0]
        .status,
      "active",
    );
    assert.equal(
      (
        await call({
          action: "unsubscribe",
          id: subscriber.id,
          token: "0".repeat(64),
        })
      ).status,
      400,
    );
    let queued = (
      await db.query(
        "insert into articles(title,slug,status) values('Next','next','published') returning id",
      )
    ).rows[0].id;
    // RFC 8058 clients POST a form, not JSON, and must receive a successful response.
    const oneClick = await handler(new Request(unsub, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "List-Unsubscribe=One-Click",
    }));
    assert.equal(oneClick.status, 200);
    assert.match((await oneClick.json()).message, /unsubscribed/);
    assert.match(mails[1].body.html, /email-preferences#action=unsubscribe/);
    assert.equal(
      (await db.query("select status from newsletter_subscribers")).rows[0]
        .status,
      "unsubscribed",
    );
    await call({ action: "dispatch" }, auth);
    assert.equal(mails.length, 2);
    ok(
      "Signed unsubscribe works, resists forged tokens, and cancels future queued sends",
    );
    // Reconfirm for retry tests; no old queued updates should be silently revived.
    await call(subscribe);
    assert.equal(mails.length, 3);
    const renewedToken = mails[2].body.html.match(/action=confirm&token=([a-f0-9]+)/)[1];
    assert.notEqual(renewedToken, token);
    assert.equal((await db.query("select status from newsletter_subscribers")).rows[0].status, "pending");
    await call({ action: "confirm", token: renewedToken });
    await call({ action: "dispatch" }, auth);
    assert.equal(mails.length, 3);
    ok("Immediate resubscription needs new consent confirmation and does not revive cancelled mail");
    queued = (
      await db.query(
        "insert into articles(title,slug,status) values('Retry','retry','published') returning id",
      )
    ).rows[0].id;
    mailFail = true;
    const failed = await call({ action: "dispatch" }, auth);
    assert.equal(failed.data.retry_pending, 1);
    assert.equal(
      (
        await db.query(
          "select state from newsletter_deliveries where article_id=$1",
          [queued],
        )
      ).rows[0].state,
      "sending",
    );
    await db.query(
      "update newsletter_deliveries set available_at=now()-interval '1 minute' where article_id=$1",
      [queued],
    );
    mailFail = false;
    await call({ action: "dispatch" }, auth);
    assert.equal(
      (
        await db.query(
          "select state from newsletter_deliveries where article_id=$1",
          [queued],
        )
      ).rows[0].state,
      "sent",
    );
    ok("Provider failure does not mark delivery sent; leased retry succeeds");
    const expiry = (
      await db.query(
        "insert into articles(title,slug,status) values('Expired','expired','published') returning id",
      )
    ).rows[0].id;
    await db.query(
      "update newsletter_deliveries set first_attempt_at=now()-interval '24 hours' where article_id=$1",
      [expiry],
    );
    await call({ action: "dispatch" }, auth);
    assert.equal(
      (
        await db.query(
          "select state from newsletter_deliveries where article_id=$1",
          [expiry],
        )
      ).rows[0].state,
      "failed",
    );
    ok("Ambiguous retries stop before the provider idempotency window expires");
    const fifth = (await db.query("insert into articles(title,slug,status) values('Fifth lease','fifth','published') returning id")).rows[0].id;
    await db.query("update newsletter_deliveries set attempts=4 where article_id=$1", [fifth]);
    const claim = await db.query("select * from newsletter_claim()");
    assert.equal(claim.rows[0].attempt, 5);
    assert.equal((await db.query("select * from newsletter_claim()")).rows.length, 0);
    assert.equal((await db.query("select state from newsletter_deliveries where article_id=$1", [fifth])).rows[0].state, "sending");
    await db.query("update newsletter_deliveries set first_attempt_at=now()-interval '24 hours' where article_id=$1", [fifth]);
    await db.query("select * from newsletter_claim()");
    assert.equal((await db.query("select state from newsletter_deliveries where article_id=$1", [fifth])).rows[0].state, "sending");
    await db.query("update newsletter_deliveries set available_at=now() where article_id=$1", [fifth]);
    await db.query("select * from newsletter_claim()");
    assert.equal((await db.query("select state from newsletter_deliveries where article_id=$1", [fifth])).rows[0].state, "failed");
    ok("Overlapping workers preserve the active fifth lease; only an expired lease can exhaust retries");
    for (let i = 0; i < 5; i++) await db.query("insert into articles(title,slug,status) values('Batch budget',$1,'published')", ['batch-' + i]);
    const batches = [];
    for (let i = 0; i < 3; i++) batches.push((await db.query("select * from newsletter_claim()")).rows);
    assert.deepEqual(batches.map((rows) => rows.length), [2, 2, 1]);
    assert.equal(new Set(batches.flat().map((row) => row.article_id)).size, 5);
    assert.equal((await db.query("select * from newsletter_claim()")).rows.length, 0);
    ok("Two-job batches bound the Edge request budget and do not reclaim another worker's live jobs");
    for (const role of ["anon", "authenticated"]) {
      await db.exec("set role " + role);
      await assert.rejects(db.query("select * from newsletter_subscribers"));
      await assert.rejects(
        db.query("select newsletter_request('x@y.test','hash')"),
      );
      await db.exec("reset role");
    }
    ok(
      "Public visitors cannot read/write subscriber addresses or invoke privileged newsletter RPCs",
    );
    delete env.SUPABASE_SERVICE_ROLE_KEY;
    assert.equal((await call(subscribe)).status, 503);
    ok(
      "Missing server configuration fails closed without pretending to subscribe",
    );
    console.log(
      `\n${n} newsletter SQL/handler checks passed. No live database, captcha or email provider contacted.`,
    );
  } finally {
    await db.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
