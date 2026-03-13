import puppeteer from 'puppeteer';

(async () => {
    try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        
        page.on('console', msg => console.log('PAGE LOG:', msg.text()));
        page.on('pageerror', error => console.error('PAGE ERROR:', error.message));
        page.on('requestfailed', request => {
            console.error('REQUEST FAILED:', request.url(), request.failure()?.errorText);
        });

        await page.goto('http://localhost:5174/login', { waitUntil: 'networkidle0' });
        await browser.close();
    } catch (e) {
        console.error('Script error:', e);
    }
})();
