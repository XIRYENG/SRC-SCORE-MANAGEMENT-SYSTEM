const puppeteer = require('puppeteer');

(async () => {
  console.log("Launching browser...");
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  
  console.log("Navigating to http://localhost:3000 ...");
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 30000 });
  
  console.log("Page loaded. Checking for elements...");
  const content = await page.content();
  if (content.includes('id="root"')) {
    console.log("Root element found.");
  }
  
  // Wait a little to see if any errors pop up
  await new Promise(r => setTimeout(r, 5000));
  
  await browser.close();
  console.log("Done.");
})();
