/* Current no-login contract. Legacy auth UI cases are retained separately as historical reference. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const { default: AxeBuilder } = require("@axe-core/playwright");
const ROOT = path.join(__dirname, ".."),
  BASE = process.env.OMP_AUDIT_URL || "http://127.0.0.1:8080";
const data = JSON.parse(
  fs.readFileSync(path.join(ROOT, "assets/data/academy-catalogue.json")),
);
const selfChecks = JSON.parse(
  fs.readFileSync(path.join(ROOT, "assets/data/academy-self-checks.json")),
);
// Resolve the exercise course and lesson from the catalogue rather than
// hardcoding a path: the first topic now belongs to the cyber-security track,
// so a fixed prefix produced a 404 and every downstream assertion failed. The
// lesson is picked from the topics that actually carry a self-check, because the
// quiz assertions below need one.
const selfCheckIds = new Set(
  Object.keys(
    JSON.parse(
      fs.readFileSync(path.join(ROOT, "assets/data/academy-self-checks.json")),
    ),
  ),
);
const t =
  data.topics.find((topic) => selfCheckIds.has(topic.id)) || data.topics[0];
assert.ok(
  selfCheckIds.has(t.id),
  "catalogue must contain a lesson with a published self-check",
);
const tCategory = data.categories.find((c) => c.id === t.category_id),
  tPath = data.paths.find((p) => p.id === t.path_id);
assert.ok(tCategory && tPath, "catalogue topic must resolve to a category and a path");
const course = `/learning/${tCategory.slug}/${tPath.slug}`,
  lesson = course + "/" + t.slug;
let checks = 0,
  scans = 0;
const ok = (s) => {
  checks++;
  console.log("✓ " + s);
};
const errors = [];
(async () => {
  let launch = { headless: true };
  if (process.env.OMP_USE_SERVERLESS_CHROMIUM) {
    const mod = require("@sparticuz/chromium"),
      c = mod.default || mod;
    launch = {
      ...launch,
      executablePath: await c.executablePath(),
      args: c.args.filter((a) => !a.startsWith("--single-process")),
    };
  }
  const browser = await chromium.launch(launch);
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    const external = [];
    await context.route(/^https:\/\//, (route) => {
      external.push(route.request().url());
      return route.abort();
    });
    const go = async (url) => {
      await page.goto(BASE + url);
      await page.reload();
      await page
        .locator('#learning-app[aria-busy="false"] .academy-topbar button')
        .waitFor();
    };
    /* The course page reports local progress as a share of the course, so the
       assertions below compare the rendered percentage rather than a removed
       "n of m lessons" sentence. */
    const courseSize = data.topics.filter(
      (topic) => topic.path_id === tPath.id,
    ).length;
    const pct = (done) => Math.round((done / courseSize) * 100) + "%";
    const progressStat = async () =>
      (await page.locator(".stat-progress .stat-value").innerText()).trim();
    const axe = async (label) => {
      const r = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      assert.deepEqual(
        r.violations.map(
          (v) => v.id + ": " + v.nodes.map((n) => n.target).join(","),
        ),
        [],
        label,
      );
      scans++;
      ok(label + " accessibility");
    };
    await go("/learning");
    assert.equal(
      await page.getByRole("button", { name: /sign in|login/i }).count(),
      0,
    );
    await page.getByRole("button", { name: "Device settings" }).click();
    await page
      .locator("#academy-profile-name")
      .fill("Asha <script>alert(1)</script>");
    await page.getByRole("button", { name: "Save on this device" }).click();
    assert.match(
      await page.locator("#academy-auth-note").innerText(),
      /Nothing was sent/,
    );
    assert.equal(
      await page.locator("#academy-account input[type=email]").count(),
      0,
    );
    await axe("Device settings");
    await page.keyboard.press("Escape");
    await go("/learning");
    await page.getByRole("button", { name: "Device settings" }).click();
    assert.equal(
      await page.locator("#academy-profile-name").inputValue(),
      "Asha <script>alert(1)</script>",
    );
    await page.keyboard.press("Escape");
    ok("Optional name survives reload, is escaped, and never asks for email");
    await axe("Academy home");
    await go(lesson + "#labs");
    await page.locator("#complete-lab").click();
    assert.match(await page.locator("#lab-feedback").innerText(), /confirm/);
    await page.locator("#lab-confirm").check();
    await page.locator("#complete-lab").click();
    await page.locator("#academy-quiz").waitFor();
    ok("Practice saves without login and opens the self-check");
    await page.locator("#question-next").click();
    assert.match(await page.locator(".quiz-error").innerText(), /Choose/);
    for (let i = 0; i < 4; i++) {
      await page
        .locator(
          `input[name=q${i}][value="${selfChecks[t.id].questions[i].answer}"]`,
        )
        .check();
      if (i < 3) await page.locator("#question-next").click();
    }
    await page.locator("#academy-quiz button[type=submit]").click();
    assert.match(await page.locator("#quiz-result").innerText(), /20 \/ 20/);
    assert.match(
      await page.locator("#quiz-result").innerText(),
      /not a verified certificate/,
    );
    ok(
      "Self-check grades locally with explanations, without issuing a false verified certificate",
    );
    await go(lesson + "#quiz");
    assert.match(
      await page.locator("#quiz-container").innerText(),
      /Lesson completed on this device/,
    );
    await axe("Completed lesson");
    await page.locator("[data-retake]").click();
    for (let i = 0; i < 4; i++) {
      await page
        .locator(
          `input[name=q${i}][value="${(selfChecks[t.id].questions[i].answer + 1) % 4}"]`,
        )
        .check();
      if (i < 3) await page.locator("#question-next").click();
    }
    await page.locator("#academy-quiz button[type=submit]").click();
    assert.match(await page.locator("#quiz-result").innerText(), /0 \/ 20/);
    await page.locator("[data-retake-result]").click();
    await page.locator("#academy-quiz").waitFor();
    ok(
      "Immediate retries are allowed and a lower score does not erase the previous completion",
    );
    await go(course);
    assert.equal(courseSize, 4, "fixture course should have 4 lessons");
    assert.equal(await progressStat(), pct(1));
    // The label is uppercased in CSS, and innerText reflects that, so compare
    // without regard to case rather than pinning the visual casing.
    assert.match(
      await page.locator(".stat-progress .stat-label").innerText(),
      /^progress$/i,
    );
    await page.locator("#lesson-filter").selectOption("complete");
    assert.equal(await page.locator(".academy-topic").count(), 1);
    await axe("Course filtered progress");
    ok("Course progress and filters use local records after a full reload");
    await page.getByRole("button", { name: "Device settings" }).click();
    const downloadPromise = page.waitForEvent("download");
    await page.locator("#export-progress").click();
    const download = await downloadPromise;
    const backup = JSON.parse(fs.readFileSync(await download.path(), "utf8"));
    assert.equal(backup.progress[0].passed, true);
    assert.equal(backup.name, "Asha <script>alert(1)</script>");
    await page.evaluate(() =>
      localStorage.setItem("unrelated-preference", "keep"),
    );
    await page.getByText("Reset Academy data", { exact: true }).click();
    await page.locator("#reset-progress").click();
    assert.match(
      await page.locator("#academy-auth-note").innerText(),
      /Confirm/,
    );
    await page.locator("#confirm-reset").check();
    await Promise.all([
      page.waitForEvent("load"),
      page.locator("#reset-progress").click(),
    ]);
    await page.locator(".academy-topbar button").waitFor();
    assert.equal(
      await page.evaluate(() => localStorage.getItem("unrelated-preference")),
      "keep",
    );
    assert.equal(await progressStat(), pct(0));
    await page.getByRole("button", { name: "Device settings" }).click();
    await page
      .locator("#progress-file")
      .setInputFiles({
        name: "backup.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(backup)),
      });
    await page.getByText(/matching lesson records restored/).waitFor();
    await go(course);
    assert.equal(await progressStat(), pct(1));
    ok("Backup/restore works; confirmed reset affects Academy only");
    assert.deepEqual(external, []);
    ok(
      "Name, reading, practice and self-check actions make zero external/network-account calls",
    );
    // Private fixtures exercise future subjects without publishing invented courses.
    const { multiSubjectFixture } =
      await import("./academy_multi_subject_fixture.mjs");
    const { curriculum, resolvePage } =
      await import("../assets/js/academy-model.mjs");
    const { publicView, workspaceView } =
      await import("../assets/js/academy-views.mjs");
    const raw = multiSubjectFixture(data),
      model = curriculum(raw);
    let shell = fs
      .readFileSync(path.join(ROOT, "tools/academy-shell.html"), "utf8")
      .replace(
        /<footer class="site-footer">[\s\S]*?<\/footer>/,
        fs.readFileSync(path.join(ROOT, "tools/site-footer.html"), "utf8"),
      );
    await context.route("**/assets/data/academy-catalogue.json", (r) =>
      r.fulfill({ json: raw }),
    );
    // Serve every private fixture subject from the shell, not just
    // /learning/programming, otherwise the other subject falls through to the
    // real preview server and 404s.
    await context.route(/\/learning\/(programming|design)(\/|$)/, (r) => {
      const p = resolvePage(model, new URL(r.request().url()).pathname);
      return r.fulfill({
        contentType: "text/html",
        body: shell.replace(
          "%%ACADEMY_CONTENT%%",
          workspaceView(model, p, publicView(model, p)),
        ),
      });
    });
    await go("/learning/programming");
    // The path page used to offer a search box with an empty state and a reset
    // button. That UI is gone, so subject isolation is now asserted directly:
    // a path must list exactly its own courses and never another subject's.
    const cardNames = () =>
      page.locator("[data-course-card]:visible h3").allInnerTexts();
    const programmingCards = await cardNames();
    assert.equal(programmingCards.length, 2);
    assert.ok(
      programmingCards.some((t) => /Python Fundamentals/.test(t)),
      "programming path lists the Python course",
    );
    assert.ok(
      programmingCards.some((t) => /JavaScript Fundamentals/.test(t)),
      "programming path lists the JavaScript course",
    );
    assert.ok(
      !programmingCards.some((t) => /Interface Design/.test(t)),
      "programming path never lists a course from another subject",
    );
    await axe("Programming path");
    // The design path holds a single course, so it is inlined rather than
    // shown as a grid. Isolation is asserted against the rendered text.
    await go("/learning/design");
    const designText = await page.locator("#learning-app").innerText();
    assert.match(designText, /Interface Design/);
    assert.ok(
      !/Python Fundamentals|JavaScript Fundamentals/.test(designText),
      "design path never lists a course from another subject",
    );
    assert.equal(
      await page.locator("[data-course-card]:visible").count(),
      0,
      "a single-course path is inlined instead of rendered as a grid",
    );
    ok("Path listings never mix subjects");
    await go("/learning/programming/roadmap");
    assert.doesNotMatch(
      await page.locator(".academy-content").innerText(),
      /Web Security Foundations|Interface Design/,
    );
    await axe("Programming roadmap");
    const py = "/learning/programming/python-fundamentals/introduction",
      js = "/learning/programming/javascript-fundamentals/introduction";
    await go(py + "#examples");
    await page.locator("#section-examples pre").waitFor();
    assert.match(
      await page.locator("#section-examples pre").innerText(),
      /print|script/,
    );
    await axe("Programming code example");
    await page.locator("[data-outline=quiz]").click();
    await page.locator("#mark-reviewed").click();
    assert.match(
      await page.locator("#quiz-container").innerText(),
      /You marked this lesson/,
    );
    await go(js + "#overview");
    assert.doesNotMatch(
      await page.locator("#lesson-state").innerText(),
      /Completed/,
    );
    const pyTopic = model.topics.find((t) => t.url === py),
      jsTopic = model.topics.find((t) => t.url === js);
    assert.equal(
      await page.evaluate(
        (id) =>
          JSON.parse(
            localStorage.getItem("omp-academy-local:v1:progress:" + id),
          ).passed,
        pyTopic.id,
      ),
      true,
    );
    assert.equal(
      await page.evaluate(
        (id) =>
          JSON.parse(
            localStorage.getItem("omp-academy-local:v1:progress:" + id),
          ).passed,
        jsTopic.id,
      ),
      false,
    );
    assert.equal(
      await page.evaluate(
        (id) => localStorage.getItem("omp-academy-course-last:guest:" + id),
        pyTopic.path_id,
      ),
      pyTopic.id,
    );
    ok(
      "Same-named lessons keep independent local progress and per-course bookmarks",
    );
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of [
        "/learning",
        "/learning/roadmap",
        course,
        lesson + "#overview",
        "/learning/programming",
        py + "#examples",
      ]) {
        await go(route);
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          `${width}px overflow at ${route}`,
        );
      }
      ok("Academy, subject, course, lesson and footer fit " + width + "px");
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await context.unroute("**/assets/data/academy-catalogue.json");
    await context.route("**/assets/data/academy-self-checks.json", (r) =>
      r.fulfill({ status: 503, body: "offline" }),
    );
    await go(lesson + "#quiz");
    assert.match(
      await page.locator("#quiz-container").innerText(),
      /could not load/,
    );
    assert.equal(await page.locator("#mark-reviewed").count(), 0);
    ok("Failed self-check loading cannot be mistaken for an ungraded lesson");
    const blocked = await browser.newContext();
    await blocked.addInitScript(() =>
      Object.defineProperty(window, "localStorage", {
        get() {
          throw Error("denied");
        },
      }),
    );
    const bp = await blocked.newPage();
    bp.on("pageerror", (e) => errors.push(e.message));
    await bp.goto(BASE + lesson);
    await bp.getByText(/Browser storage is unavailable/).waitFor();
    await bp.getByRole("button", { name: "Device settings" }).click();
    await bp.locator("#academy-profile-name").fill("Temporary");
    await bp.getByRole("button", { name: "Save on this device" }).click();
    assert.match(
      await bp.locator("#academy-auth-note").innerText(),
      /tab only/,
    );
    await blocked.close();
    ok("Storage-denied browsers remain usable with an honest tab-only warning");
    const nojs = await browser.newContext({ javaScriptEnabled: false });
    const np = await nojs.newPage();
    await np.goto(BASE + lesson);
    /* Without JavaScript the lesson falls back to consolidated static sections
       rather than the interactive reader's per-section layout, so assert the
       real reading content is present instead of a section count. */
    for (const kind of [
      "lesson-concept",
      "lesson-practice",
      "lesson-takeaways",
      "lesson-resources",
    ]) {
      assert.equal(
        await np.locator(`.lesson-section.${kind}`).count(),
        1,
        "no-JS fallback renders the " + kind + " section",
      );
    }
    const noJsText = await np.locator("#learning-app").innerText();
    assert.match(noJsText, new RegExp(t.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(noJsText, /What you'll learn/);
    assert.match(noJsText, /Key takeaways/);
    assert.ok(
      (await np.locator(".lesson-section a[href^='https://']").count()) > 0,
      "no-JS fallback still cites its sources",
    );
    assert.equal(
      await np.locator('footer.site-footer a[href="/learning"]').count(),
      1,
    );
    assert.doesNotMatch(noJsText, /Sign in/);
    await np.goto(BASE + "/");
    assert.equal(await np.locator("h1").evaluate(el => getComputedStyle(el).opacity), "1");
    await nojs.close();
    ok(
      "Full lesson, homepage headline, course links and Academy footer remain available without JavaScript",
    );
    await page.setViewportSize({ width: 1440, height: 1000 });
    await context.route("**/functions/v1/learning-certificate-verify*", (r) =>
      r.fulfill({
        json: {
          valid: true,
          certificate: {
            certificate_id: "OMP-LEGACY-TEST",
            recipient_name: "Legacy Learner",
            topic_name: t.name,
            course_name: "Web Security Foundations",
            category_name: "Web Application Security",
            score: 20,
            issued_at: "2026-09-01T00:00:00Z",
          },
        },
      }),
    );
    await page.goto(BASE + "/certificate");
    await page
      .getByRole("heading", { name: "Certificate ID required" })
      .waitFor();
    await page.goto(BASE + "/certificate?id=OMP-LEGACY-TEST");
    await page
      .getByRole("heading", { name: "Lesson completion certificate" })
      .waitFor();
    assert.match(
      await page.locator(".certificate-course").innerText(),
      /Web Security Foundations/,
    );
    ok(
      "Historical server-issued certificate links still verify without learner login",
    );
    const legacy = await page.request.get(
      BASE + "/learning/web-application-security/" + t.slug,
      { maxRedirects: 0 },
    );
    assert.equal(legacy.status(), 301);
    ok("Historical lesson URLs still redirect to the canonical course URL");
    assert.deepEqual(errors, []);
    ok("No uncaught browser errors");
    await context.close();
    console.log(
      `\n${checks} no-login Academy browser checks passed (${scans} axe scans).`,
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
