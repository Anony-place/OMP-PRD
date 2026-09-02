const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  const urls = ['/checker.html', '/generator.html', '/tools.html', '/terms.html', '/contact.html'];

  for (const url of urls) {
    await page.goto('http://127.0.0.1:8765' + url, { waitUntil: 'networkidle' });

    const result = await page.evaluate(() => {
      // Walk all elements and find anything that extends past the viewport
      const allEls = Array.from(document.querySelectorAll('*'));
      const offenders = [];

      for (const el of allEls) {
        const rect = el.getBoundingClientRect();
        // 256px overflow = something is 256px too wide
        if (rect.width > 1400 || rect.right > 1400) {
          const computed = window.getComputedStyle(el);
          offenders.push({
            tag: el.tagName,
            cls: (el.className || '').toString().slice(0, 80),
            id: el.id,
            width: Math.round(rect.width),
            right: Math.round(rect.right),
            display: computed.display,
            position: computed.position,
            parent: el.parentElement ? (el.parentElement.tagName + '.' + el.parentElement.className).slice(0, 50) : 'none',
            text: (el.textContent || '').substring(0, 30).trim()
          });
        }
      }

      return offenders.slice(0, 5);
    });

    console.log(`\n=== ${url} ===`);
    if (result.length === 0) {
      console.log('  No wide elements found');
    } else {
      for (const el of result) {
        console.log(`  <${el.tag} id="${el.id}" class="${el.cls}"> w=${el.width} right=${el.right} parent=${el.parent}`);
        console.log(`    display=${el.display} position=${el.position}`);
        console.log(`    text: "${el.text}"`);
      }
    }
  }

  await browser.close();
})();
