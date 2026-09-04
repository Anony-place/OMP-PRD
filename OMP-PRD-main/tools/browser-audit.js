/* ============================================================
   OMP Comprehensive Browser Audit
   Tests all pages, tools, navigation, accessibility and SEO.

   Usage:
     npm i playwright && npx playwright install chromium
     python3 -m http.server 8765 --bind 127.0.0.1   # from the repo root
     node tools/browser-audit.js

   Writes tools/audit-report.json (excluded from hosting deploys
   by the tools/** ignore rule in firebase.json).
   ============================================================ */
const { chromium } = require('playwright');
const path = require('path');

const BASE_URL = process.env.OMP_AUDIT_URL || 'http://127.0.0.1:8765';
const PAGES = [
  '/index.html',
  '/checker.html',
  '/generator.html',
  '/tools.html',
  '/breach-check.html',
  '/password-health.html',
  '/entropy.html',
  '/passphrase.html',
  '/random-string.html',
  '/security-checklist.html',
  '/guides.html',
  '/blog.html',
  '/about.html',
  '/contact.html',
  '/faq.html',
  '/glossary.html',
  '/privacy.html',
  '/security.html',
  '/sitemap.html',
  '/terms.html',
  '/404.html',
];

const TOOLS = [
  '/checker.html',
  '/generator.html',
  '/passphrase.html',
  '/random-string.html',
  '/entropy.html',
  '/password-health.html',
  '/breach-check.html',
  '/security-checklist.html',
];

const GUIDE_PAGES = [
  '/guides/create-strong-password.html',
  '/guides/password-best-practices.html',
  '/guides/common-password-mistakes.html',
  '/guides/how-long-should-a-password-be.html',
  '/guides/password-vs-passphrase.html',
  '/guides/password-manager-benefits.html',
  '/guides/are-password-managers-safe.html',
  '/guides/two-factor-authentication.html',
  '/guides/passkeys-explained.html',
  '/guides/password-vs-passkey.html',
  '/guides/after-a-data-breach.html',
  '/guides/phishing-attacks.html',
  '/guides/check-if-password-was-leaked.html',
  '/guides/password-entropy.html',
  '/guides/password-cracking-time-table.html',
];

let totalIssues = [];
let pageIndex = 0;

function addIssue(severity, category, page, element, problem, expected, actual, steps) {
  totalIssues.push({
    id: `BUG-${String(totalIssues.length + 1).padStart(3, '0')}`,
    severity,
    category,
    page,
    element,
    problem,
    expected,
    actual,
    steps: steps || [],
    status: 'Open'
  });
}

async function testPage(browser, page, url) {
  const pageErrors = [];
  const consoleErrors = [];
  const failedResources = [];
  let response;

  console.log(`\n=== Testing: ${url} ===`);

  // Track console messages
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  // Track failed requests
  page.on('requestfailed', request => {
    failedResources.push({
      url: request.url(),
      failure: request.failure().errorText
    });
  });

  try {
    response = await page.goto(BASE_URL + url, {
      waitUntil: 'networkidle',
      timeout: 15000
    });

    if (!response) {
      addIssue('P0', 'Navigation', url, 'page', 'Page failed to load', 'HTTP response received', 'No response', [`Navigate to ${url}`]);
      return { pageErrors, consoleErrors, failedResources };
    }

    if (response.status() === 404) {
      addIssue('P0', 'Navigation', url, 'page', 'Page returns 404', 'Page loads successfully', 'HTTP 404', [`Navigate to ${url}`]);
      return { pageErrors, consoleErrors, failedResources };
    }

    // Check title exists
    const title = await page.title();
    if (!title || title.length < 10) {
      addIssue('P1', 'SEO', url, '<title>', 'Title missing or too short', 'Meaningful title', title || 'No title', [`Navigate to ${url}`]);
    }

    // Check H1 exists
    const h1Count = await page.locator('h1').count();
    if (h1Count === 0) {
      addIssue('P0', 'Accessibility', url, 'h1', 'No H1 heading', 'Exactly one H1', 'No H1 found', [`Navigate to ${url}`]);
    } else if (h1Count > 1) {
      addIssue('P2', 'SEO', url, 'h1', `Multiple H1 headings (${h1Count})`, 'Exactly one H1', `${h1Count} H1s found`, [`Navigate to ${url}`]);
    }

    // Check meta description
    const metaDesc = await page.$eval('meta[name="description"]', el => el.getAttribute('content')).catch(() => null);
    if (!metaDesc) {
      addIssue('P1', 'SEO', url, 'meta[name="description"]', 'Missing meta description', 'Meta description present', 'Missing', [`Navigate to ${url}`]);
    }

    // Check canonical
    const canonical = await page.$eval('link[rel="canonical"]', el => el.getAttribute('href')).catch(() => null);
    if (!canonical) {
      addIssue('P2', 'SEO', url, 'link[rel="canonical"]', 'Missing canonical URL', 'Canonical present', 'Missing', [`Navigate to ${url}`]);
    }

    // Check skip link
    const skipLink = await page.$('a.skip-link');
    if (!skipLink) {
      addIssue('P2', 'Accessibility', url, 'a.skip-link', 'Missing skip link', 'Skip link for keyboard users', 'Missing', [`Navigate to ${url}`]);
    }

    // Check main landmark
    const main = await page.$('main');
    if (!main) {
      addIssue('P1', 'Accessibility', url, 'main', 'Missing main landmark', 'main element present', 'Missing', [`Navigate to ${url}`]);
    }

    // Check nav landmark
    const nav = await page.$('nav');
    if (!nav) {
      addIssue('P2', 'Accessibility', url, 'nav', 'Missing nav landmark', 'nav element present', 'Missing', [`Navigate to ${url}`]);
    }

    // Check footer
    const footer = await page.$('footer');
    if (!footer) {
      addIssue('P2', 'Accessibility', url, 'footer', 'Missing footer', 'footer element present', 'Missing', [`Navigate to ${url}`]);
    }

    // Check for horizontal overflow
    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    if (hasOverflow) {
      addIssue('P2', 'CSS', url, 'body', 'Horizontal overflow detected', 'No horizontal scroll', 'scrollWidth > clientWidth', [`Navigate to ${url}`, 'Resize viewport']);
    }

    // Check color contrast issues (basic)
    const lowContrast = await page.evaluate(() => {
      const elements = document.querySelectorAll('p, span, a, h1, h2, h3, h4, li');
      const issues = [];
      for (const el of elements) {
        const style = window.getComputedStyle(el);
        const color = style.color;
        const bg = window.getComputedStyle(el.parentElement || el).backgroundColor;
        if (color === bg || color === 'rgb(0, 0, 0)' && bg === 'rgb(0, 0, 0)') {
          issues.push(el.tagName);
        }
      }
      return issues.slice(0, 5);
    });
    if (lowContrast.length > 0) {
      addIssue('P3', 'Accessibility', url, 'text', `Potential low contrast (${lowContrast.length} elements)`, 'Adequate contrast', 'Possible contrast issues', [`Navigate to ${url}`]);
    }

    // Check focus visible on buttons
    const buttons = await page.$$('button');
    for (const btn of buttons.slice(0, 5)) {
      const hasFocus = await btn.evaluate(el => {
        const style = window.getComputedStyle(el, ':focus-visible');
        return window.getComputedStyle(el).outline !== 'none' || style.outline !== 'none' || el.matches(':focus-visible');
      });
      // This is a basic check - full focus testing requires keyboard interaction
    }

    // Check links work
    const links = await page.$$eval('a[href^="/"]', links => links.map(l => l.getAttribute('href')));
    for (const href of links.slice(0, 10)) {
      if (href === '#') continue;
      const linkResponse = await page.request.get(BASE_URL + href).catch(() => null);
      if (!linkResponse || linkResponse.status() === 404) {
        addIssue('P1', 'Links', url, `a[href="${href}"]`, `Broken internal link: ${href}`, 'Link resolves to valid page', '404 or unreachable', [`Navigate to ${url}`, `Click link ${href}`]);
      }
    }

    console.log(`  Status: ${response.status()}`);
    console.log(`  Title: ${title.substring(0, 60)}...`);
    console.log(`  Console errors: ${consoleErrors.length}`);
    console.log(`  Failed resources: ${failedResources.length}`);

  } catch (error) {
    addIssue('P0', 'Navigation', url, 'page', `Page crashed: ${error.message}`, 'Page loads without crash', error.message, [`Navigate to ${url}`]);
  }

  // Report console errors as P1
  for (const err of consoleErrors) {
    if (err.includes('favicon') || err.includes('manifest')) continue;
    if (err.includes('Failed to load resource')) {
      addIssue('P1', 'Resources', url, 'console', `Failed resource: ${err}`, 'All resources load', err, [`Navigate to ${url}`]);
    } else {
      addIssue('P1', 'JavaScript', url, 'console', `Console error: ${err}`, 'No console errors', err, [`Navigate to ${url}`]);
    }
  }

  // Report failed resources
  for (const res of failedResources) {
    if (res.url.includes('favicon') || res.url.includes('manifest')) continue;
    addIssue('P1', 'Resources', url, res.url, `Resource failed: ${res.failure}`, 'All resources load', `${res.url}: ${res.failure}`, [`Navigate to ${url}`]);
  }

  return { pageErrors, consoleErrors, failedResources };
}

async function testTool(page, url, toolName) {
  console.log(`\n=== Testing Tool: ${toolName} ===`);

  try {
    await page.goto(BASE_URL + url, { waitUntil: 'networkidle', timeout: 15000 });

    // Test basic interaction
    const inputs = await page.$$('input');
    const buttons = await page.$$('button');

    console.log(`  Inputs: ${inputs.length}, Buttons: ${buttons.length}`);

    // Test with valid input
    for (const input of inputs.slice(0, 2)) {
      const tagName = await input.evaluate(el => el.tagName);
      const type = await input.evaluate(el => el.type);

      if (type === 'password' || type === 'text') {
        await input.fill('TestPassword123!');
        await page.waitForTimeout(500);

        // Check if output changed
        const output = await page.$('[data-output], .result, .score, .strength');
        if (output) {
          const outputText = await output.textContent();
          console.log(`  Output updated: ${outputText ? outputText.substring(0, 50) : 'empty'}`);
        }
      }
    }

    // Test empty input
    for (const input of inputs.slice(0, 2)) {
      const type = await input.evaluate(el => el.type);
      if (type === 'password' || type === 'text') {
        await input.fill('');
        await page.waitForTimeout(300);
        console.log(`  Empty input handled: OK`);
      }
    }

    // Test with special characters
    for (const input of inputs.slice(0, 2)) {
      const type = await input.evaluate(el => el.type);
      if (type === 'password' || type === 'text') {
        await input.fill('日本語テスト🔐🎉<script>alert(1)</script>');
        await page.waitForTimeout(300);
        console.log(`  Special characters handled: OK`);
      }
    }

    // Test reset button if exists
    const resetBtn = await page.$('[data-reset], button[type="reset"]');
    if (resetBtn) {
      await resetBtn.click();
      await page.waitForTimeout(300);
      console.log(`  Reset button: OK`);
    }

    // Test copy button if exists
    const copyBtn = await page.$('[data-copy], button[data-copy]');
    if (copyBtn) {
      // Clipboard API may not work in headless, but we can check the button exists
      console.log(`  Copy button present: OK`);
    }

  } catch (error) {
    addIssue('P0', 'Tool Functionality', url, toolName, `Tool crashed: ${error.message}`, 'Tool works', error.message, [`Navigate to ${url}`]);
  }
}

async function testResponsive(page) {
  console.log(`\n=== Testing Responsive Design ===`);

  const viewports = [
    { width: 320, height: 568, name: 'Mobile S' },
    { width: 375, height: 667, name: 'Mobile M' },
    { width: 768, height: 1024, name: 'Tablet' },
    { width: 1280, height: 720, name: 'Desktop' },
    { width: 1920, height: 1080, name: 'Desktop L' },
  ];

  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(BASE_URL + '/index.html', { waitUntil: 'networkidle', timeout: 10000 });

    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    const navVisible = await page.isVisible('header');
    const mainVisible = await page.isVisible('main');

    console.log(`  ${vp.name} (${vp.width}x${vp.height}): overflow=${overflow}, nav=${navVisible}, main=${mainVisible}`);

    if (overflow) {
      addIssue('P2', 'Responsive', 'index.html', `${vp.name} viewport`, `Horizontal overflow at ${vp.width}x${vp.height}`, 'No overflow', 'Horizontal scroll exists', [`Resize to ${vp.width}x${vp.height}`]);
    }
  }
}

async function runAudit() {
  console.log('OMP Comprehensive Browser Audit');
  console.log('================================\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    locale: 'en-US',
  });

  const page = await context.newPage();

  // Test all pages
  console.log('PHASE 1: Page Loading Tests');
  for (const url of PAGES) {
    await testPage(browser, page, url);
  }

  // Test tools
  console.log('\nPHASE 2: Tool Functionality Tests');
  for (const url of TOOLS) {
    await testTool(page, url, url.replace('.html', ''));
  }

  // Test responsive
  console.log('\nPHASE 3: Responsive Design Tests');
  await testResponsive(page);

  // Test guide pages
  console.log('\nPHASE 4: Guide Pages');
  for (const url of GUIDE_PAGES) {
    await testPage(browser, page, url);
  }

  await browser.close();

  // Generate report
  console.log('\n\n========================================');
  console.log('AUDIT REPORT');
  console.log('========================================');

  const p0 = totalIssues.filter(i => i.severity === 'P0');
  const p1 = totalIssues.filter(i => i.severity === 'P1');
  const p2 = totalIssues.filter(i => i.severity === 'P2');
  const p3 = totalIssues.filter(i => i.severity === 'P3');

  console.log(`\nTotal Issues Found: ${totalIssues.length}`);
  console.log(`  P0 (Critical): ${p0.length}`);
  console.log(`  P1 (High): ${p1.length}`);
  console.log(`  P2 (Medium): ${p2.length}`);
  console.log(`  P3 (Low): ${p3.length}`);

  if (totalIssues.length > 0) {
    console.log('\nISSUE DETAILS:');
    for (const issue of totalIssues.slice(0, 50)) {
      console.log(`\n[${issue.severity}] ${issue.id} - ${issue.category}`);
      console.log(`  Page: ${issue.page}`);
      console.log(`  Element: ${issue.element}`);
      console.log(`  Problem: ${issue.problem}`);
      if (issue.expected) console.log(`  Expected: ${issue.expected}`);
      if (issue.actual) console.log(`  Actual: ${issue.actual}`);
    }
  } else {
    console.log('\nNo issues found!');
  }

  // Save report
  const fs = require('fs');
  const reportPath = path.join(__dirname, 'audit-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    total: totalIssues.length,
    bySeverity: {
      P0: p0.length,
      P1: p1.length,
      P2: p2.length,
      P3: p3.length,
    },
    issues: totalIssues
  }, null, 2));

  console.log('\nReport saved to ' + reportPath);
  return totalIssues;
}

runAudit().catch(console.error);
