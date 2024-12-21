const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Maximum number of parallel screenshots
const PARALLEL_LIMIT = 10;

// Helper function to capture a screenshot of a single URL
const captureScreenshot = async (browser, url, screenshotDir, progressCallback, failedUrls) => {
    const page = await browser.newPage();
    try {
        console.log(`Processing: ${url}`);

        // Set a smaller viewport to reduce screenshot size
        await page.setViewport({ width: 1024, height: 768 });

        // Navigate to the URL
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        // Create a valid filename
        const fileName = url.replace(/https?:\/\//, '').replace(/[\/:*?"<>|]/g, '_') + '.jpeg';

        // Save the screenshot as a compressed JPEG
        const screenshotPath = path.join(screenshotDir, fileName);
        await page.screenshot({
            path: screenshotPath,
            type: 'jpeg', // Save as JPEG
            quality: 50, // Compression quality (1-100)
        });

        console.log(`Screenshot saved: ${screenshotPath}`);
    } catch (error) {
        console.error(`Failed to process ${url}:`, error.message);
        // Log the failed URL to the array
        failedUrls.push(url);
    } finally {
        await page.close();
        progressCallback();
    }
};

// Main function
(async () => {
    // Read URLs from file
    const filePath = 'urls.txt';
    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
    }

    const urls = fs.readFileSync(filePath, 'utf-8').split('\n').map(url => url.trim()).filter(Boolean);
    const totalUrls = urls.length;
    let processedUrls = 0;
    const failedUrls = [];

    // Progress callback
    const updateProgress = () => {
        processedUrls++;
        const percentage = ((processedUrls / totalUrls) * 100).toFixed(2);
        console.log(`Progress: ${percentage}% (${processedUrls}/${totalUrls})`);
    };

    // Create a screenshots directory if it doesn't exist
    const screenshotDir = path.resolve(__dirname, 'screenshots');
    if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir);
    }

    // Launch Puppeteer browser
    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    // Split URLs into chunks for parallel processing
    for (let i = 0; i < urls.length; i += PARALLEL_LIMIT) {
        const chunk = urls.slice(i, i + PARALLEL_LIMIT);

        // Process each chunk in parallel
        await Promise.all(chunk.map(url => captureScreenshot(browser, url, screenshotDir, updateProgress, failedUrls)));
    }

    // Close the browser
    await browser.close();

    // Save the failed URLs to a file
    if (failedUrls.length > 0) {
        const failedFilePath = path.resolve(__dirname, 'failed_urls.txt');
        fs.writeFileSync(failedFilePath, failedUrls.join('\n'), 'utf-8');
        console.log(`Failed URLs saved to ${failedFilePath}`);
    }

    console.log('All screenshots captured successfully!');
})();
