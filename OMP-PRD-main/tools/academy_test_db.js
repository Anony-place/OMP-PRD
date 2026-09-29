/* Disposable local PostgreSQL engine. Never connects to the deployed project. */
const { PGlite } = require("@electric-sql/pglite");
const fs = require("node:fs");
const path = require("node:path");
const sql = (name) =>
  fs.readFileSync(path.join(__dirname, "../supabase/migrations", name), "utf8");
const USER = "60000000-0000-4000-8000-000000000001";
const OTHER = "60000000-0000-4000-8000-000000000002";
const TOPIC = "10000000-0000-4000-8000-000000000001";
async function database(connection) {
  const db = connection || new PGlite();
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
  await db.exec(
    "grant all on all tables in schema public to anon,authenticated;",
  );
  await db.exec(sql("20260929090000_correct_foundation_quiz_keys.sql"));
  await db.exec(sql("20260929120000_academy_curriculum_hierarchy.sql"));
  await db.exec(sql("20260929150000_academy_atomic_mutations.sql"));
  await db.exec(sql("20260929160000_academy_quiz_option_balance.sql"));
  await db.exec(sql("20260929200000_academy_multi_subject_courses.sql"));
  await db.exec(`insert into auth.users values ('${USER}'),('${OTHER}');`);
  return db;
}
module.exports = { database, sql, USER, OTHER, TOPIC };
