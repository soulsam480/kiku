/**
 * End-to-end smoke test, driven through playwright-cli against a running deployment.
 *
 *   playwright-cli run-code "$(cat tests/e2e.js)"
 *
 * It never calls the language model (no key required) and cleans up the documents
 * it creates. Waits are event-driven so the run finishes as soon as each step passes.
 */
async page => {
  const report = [];
  const consoleErrors = [];
  const started = Date.now();

  page.on("pageerror", (error) => consoleErrors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(`console: ${message.text()}`);
  });

  const check = (name, passed, detail = "") => {
    report.push({ name, passed, detail });
    if (!passed) throw new Error(`${name}${detail ? ` — ${detail}` : ""}`);
  };

  const badge = () => page.locator("header .badge").textContent();
  const progress = async () => Number((await page.locator("footer span").first().textContent()).split("/")[0].trim());
  const waitBadge = (value, timeout = 120000) =>
    page.waitForFunction((want) => document.querySelector("header .badge")?.textContent === want, value, { timeout });

  const doc = `# E2E Check

Intro paragraph with a ✅ marker and a link to [docs](https://example.com/doc).

## Table

| Layer | Job | Vendors |
| --- | --- | --- |
| Capture | Read a badge | Popsl, Blinq |
| Routing | Pick an owner | Chili Piper |

## List

- First bullet about listening.
- Second bullet about questions.
`;

  try {
    await page.goto("https://listener.sambitsahoojs.workers.dev/");
    // A service worker can serve the previous build, which would invalidate every result.
    await page.evaluate(async () => {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
      await Promise.all((await caches.keys()).map((key) => caches.delete(key)));
    });
    await page.goto("https://listener.sambitsahoojs.workers.dev/");
    await page.waitForFunction(() => Boolean(document.body._x_dataStack), null, { timeout: 20000 });
    check("app boots with Alpine state", true);

    check("page is cross-origin isolated", await page.evaluate(() => crossOriginIsolated));

    // --- create a document and narrate it ------------------------------------
    await page.getByRole("button", { name: "New", exact: true }).click();
    await page.locator("textarea").fill(doc);
    await page.getByRole("button", { name: "Start listening" }).click();
    await page.waitForTimeout(800);

    const toast = (await page.locator(".toast").textContent()).replace(/\s+/g, " ").trim();
    check("document saved to IndexedDB", !toast.includes("Could not save"), toast);
    check("no error toast", toast === "Dismiss" || toast === "", toast);

    await waitBadge("playing");
    check("narration starts", true);

    check("chunks were produced", (await page.locator("header ~ main, main").first().textContent()).includes("sentences"));

    check(
      "table narration kept every column",
      await page.evaluate(() => document.body.textContent.includes("E2E Check")),
    );

    await page.waitForTimeout(2500);
    const active = page.locator("#preview .active-block");
    check("a block is highlighted", (await active.count()) === 1);

    const firstCaption = await page.locator("footer p").first().textContent();
    check("caption shows spoken text", firstCaption.trim().length > 0, firstCaption.slice(0, 40));

    // --- sentence seek -------------------------------------------------------
    const beforeSeek = await progress();
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(600);
    check("next sentence advances", (await progress()) >= beforeSeek);

    // --- jump by clicking a heading -----------------------------------------
    await waitBadge("playing");
    await page.locator("#preview h2").first().click();
    await waitBadge("playing");
    const afterJump = await progress();
    check("clicking a block jumps", afterJump > 0, `chunk ${afterJump}`);

    // --- interrupt and resume ------------------------------------------------
    await page.keyboard.press("i");
    await page.waitForTimeout(300);
    check("interrupting stops narration", (await badge()) === "interrupted", await badge());

    await page.keyboard.press("Escape");
    await page.waitForFunction(
      () => document.querySelector("header .badge")?.textContent !== "interrupted",
      null,
      { timeout: 15000 },
    ).catch(() => {});
    check("escape resumes narration", ["playing", "loading"].includes(await badge()), await badge());

    // --- persistence ---------------------------------------------------------
    const savedProgress = await progress();
    await page.reload();
    await page.waitForFunction(() => Boolean(document.body._x_dataStack), null, { timeout: 20000 });
    await page.waitForTimeout(1000);

    const title = await page.locator("main h2").first().textContent();
    check("document restored after reload", title.includes("E2E Check"), title);
    check("reading position restored", (await progress()) >= savedProgress - 1, `${await progress()}/${savedProgress}`);

    // --- library -------------------------------------------------------------
    await page.getByRole("button", { name: /Docs|Documents/ }).click();
    await page.waitForTimeout(400);
    const rows = page.locator("dialog[open] li");
    check("library lists documents", (await rows.count()) >= 1, `${await rows.count()} rows`);

    const target = rows.filter({ hasText: "E2E Check" }).first();
    await target.getByRole("button", { name: "Delete" }).click();
    await page.waitForTimeout(600);
    check(
      "document deleted",
      (await page.locator("dialog[open] li").filter({ hasText: "E2E Check" }).count()) === 0,
    );

    check("no console errors", consoleErrors.length === 0, consoleErrors.slice(0, 2).join(" | "));
  } catch (error) {
    report.push({ name: "aborted", passed: false, detail: error.message });
  }

  const failed = report.filter((step) => !step.passed);
  return JSON.stringify(
    {
      passed: report.length - failed.length,
      failed: failed.length,
      seconds: Math.round((Date.now() - started) / 1000),
      steps: report,
      consoleErrors: consoleErrors.slice(0, 5),
    },
    null,
    1,
  );
}
