const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  const urls = ['/index.html', '/checker.html', '/generator.html', '/tools.html', '/terms.html', '/contact.html'];

  for (const url of urls) {
    await page.goto('http://127.0.0.1:8765' + url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000); // Wait for fonts/animations

    const result = await page.evaluate(() => {
      const docEl = document.documentElement;
      const scrollW = docEl.scrollWidth;
      const clientW = docEl.clientWidth;
      const bodyEl = document.body;
      const bodyScrollW = bodyEl.scrollWidth;
      const bodyClientW = bodyEl.clientWidth;

      // Find overflowing elements
      const overflowEls = [];
      document.querySelectorAll('*').forEach(el => {
        const rect = el.getBoundingClientRect();
        const computed = window.getComputedStyle(el);
        const rightEdge = rect.right + window.scrollX;
        if (rightEdge > docEl.scrollWidth - 1) {
          overflowEls.push({
            tag: el.tagName,
            cls: (el.className || '').toString().slice(0, 60),
            right: Math.round(rightEdge),
            maxRight: Math.round(docEl.scrollWidth),
            style: {
              overflow: computed.overflow,
              overflowX: computed.overflowX,
              position: computed.position,
              width: computed.width,
              maxWidth: computed.maxWidth
            }
          });
        }
      });

      return {
        docEl: { scrollW, clientW, scrollGTE_client: scrollW > clientW },
        body: { scrollW: bodyScrollW, clientW: bodyClientW },
        overflowEls: overflowEls.slice(0, 10),
        hasOverflow: scrollW > clientW
      };
    });

    console.log(`\n=== ${url} ===`);
    console.log(`  scrollWidth=${result.docEl.scrollW}, clientWidth=${result.docEl.clientW}, diff=${result.docEl.scrollW - result.docEl.clientW}`);
    console.log(`  body: scrollWidth=${result.body.scrollW}, clientWidth=${result.body.clientW}`);
    if (result.overflowEls.length > 0) {
      console.log(`  Overflow elements: ${result.overflowEls.length}`);
      for (const el of result.overflowEls) {
        console.log(`    <${el.tag}> class="${el.cls}" right=${el.right}/${el.maxRight} style=${JSON.stringify(el.style)}`);
      }
    } else {
      console.log(`  No overflow elements found`);
    }
  }

  await browser.close();
})();
