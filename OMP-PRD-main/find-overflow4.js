const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  await page.goto('http://127.0.0.1:8765/checker.html', { waitUntil: 'networkidle' });

  // Walk all elements including those positioned absolutely
  const result = await page.evaluate(() => {
    const allEls = Array.from(document.querySelectorAll('*'));
    const offenders = [];

    for (const el of allEls) {
      const rect = el.getBoundingClientRect();
      const computed = window.getComputedStyle(el);
      // Anything with visible content past viewport right edge
      if (rect.right > document.documentElement.clientWidth + 1 && computed.visibility !== 'hidden' && computed.display !== 'none' && el.tagName !== 'HTML' && el.tagName !== 'BODY') {
        // Skip elements that are entirely within another scrollable container
        let parent = el.parentElement;
        let inScrollable = false;
        while (parent) {
          const ps = window.getComputedStyle(parent);
          if (ps.overflowX === 'auto' || ps.overflowX === 'scroll' || ps.overflowX === 'hidden') {
            inScrollable = true;
            break;
          }
          parent = parent.parentElement;
        }
        if (!inScrollable) {
          offenders.push({
            tag: el.tagName,
            cls: (el.className || '').toString().slice(0, 80),
            id: el.id,
            rect: { w: Math.round(rect.width), l: Math.round(rect.left), r: Math.round(rect.right), t: Math.round(rect.top) },
            text: (el.textContent || '').substring(0, 40).trim()
          });
        }
      }
    }

    return offenders.slice(0, 20);
  });

  console.log(`Found ${result.length} overflowing elements:`);
  for (const el of result) {
    console.log(`  <${el.tag} id="${el.id}" class="${el.cls}"> left=${el.rect.l} w=${el.rect.w} right=${el.rect.r} text="${el.text}"`);
  }

  // Also test a wider viewport
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(500);
  const widerResult = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth
  }));
  console.log(`\nAt 1920px viewport: scrollW=${widerResult.scrollW}, clientW=${widerResult.clientW}, diff=${widerResult.scrollW - widerResult.clientW}`);

  await browser.close();
})();
