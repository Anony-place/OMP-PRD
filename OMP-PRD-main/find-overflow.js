const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  const pagesToCheck = ['/checker.html', '/generator.html', '/tools.html', '/terms.html'];

  for (const url of pagesToCheck) {
    console.log(`\n=== ${url} ===`);
    await page.goto('http://127.0.0.1:8765' + url, { waitUntil: 'networkidle' });

    // Find the overflowing elements
    const overflowing = await page.evaluate(() => {
      const results = [];
      const docWidth = document.documentElement.clientWidth;
      const allElements = document.querySelectorAll('*');
      for (const el of allElements) {
        const rect = el.getBoundingClientRect();
        if (rect.right > docWidth + 1) {
          results.push({
            tag: el.tagName,
            class: el.className.toString().substring(0, 80),
            id: el.id,
            text: (el.textContent || '').substring(0, 50).trim(),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
            overflow: Math.round(rect.right - docWidth)
          });
        }
      }
      return { docWidth, overflowing: results.slice(0, 15) };
    });

    console.log(`Document width: ${overflowing.docWidth}`);
    console.log(`Overflowing elements: ${overflowing.overflowing.length}`);
    for (const el of overflowing.overflowing) {
      console.log(`  - <${el.tag}> class="${el.class}" right=${el.right} w=${el.width} overflow=${el.overflow}px text="${el.text}"`);
    }
  }

  await browser.close();
})();
