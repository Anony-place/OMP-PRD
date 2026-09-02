const { chromium } = require('playwright');
console.log('Playwright loaded successfully');
console.log('Browser path:', chromium.executablePath());
