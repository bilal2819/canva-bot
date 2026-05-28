const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');

async function inviteToCanva(targetEmail) {
    console.log(`🤖 Canva Auto-Invite: Launching browser for ${targetEmail}...`);
    
    // Launch completely headless for GitHub Actions
    const browser = await puppeteer.launch({
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--window-size=1280,800',
            '--disable-blink-features=AutomationControlled'
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        
        // Anti-detection evasion
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
        });

        // Optimization: Block media and fonts, but DO NOT block third-party scripts (needed for Recaptcha)
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const type = req.resourceType();
            if (type === 'image' || type === 'media' || type === 'font') {
                req.abort();
            } else {
                req.continue();
            }
        });

        // Load Cookies
        const cookiePath = './canva_cookies.json';
        if (fs.existsSync(cookiePath)) {
            const raw = fs.readFileSync(cookiePath, 'utf8');
            const parsedCookies = JSON.parse(raw);
            const formatted = parsedCookies.map(c => ({
                name: c.name,
                value: c.value,
                domain: c.domain || '.canva.com',
                path: c.path || '/',
                secure: c.secure !== undefined ? c.secure : true,
                httpOnly: c.httpOnly !== undefined ? c.httpOnly : false,
                sameSite: c.sameSite || 'Lax'
            }));
            await page.setCookie(...formatted);
            console.log('✅ Loaded Canva session cookies.');
        } else {
            throw new Error('canva_cookies.json not found!');
        }

        console.log('Navigating to Canva Home page...');
        await page.goto('https://www.canva.com/', { waitUntil: 'networkidle2', timeout: 60000 });
        console.log('✅ Home page loaded!');

        console.log('🔍 Clicking Profile Menu...');
        await page.waitForSelector('header button, [aria-label="Settings"]', { timeout: 10000 }).catch(() => {});
        
        // Navigate directly to Settings -> People
        console.log('Navigating directly to Settings -> People page...');
        await page.goto('https://www.canva.com/settings/people', { waitUntil: 'networkidle2', timeout: 60000 });
        
        console.log('🔍 Current URL is: ' + page.url());

        console.log('🔍 Finding "Invite people" button...');
        const inviteButton = await page.waitForSelector('::-p-xpath(//button[contains(., "Invite people")])', { timeout: 15000 });
        if (inviteButton) {
            await inviteButton.click();
            console.log('✅ Clicked "Invite people"');
        } else {
            throw new Error('Could not find Invite People button');
        }

        // Wait for input field
        console.log('🔍 Typing email address...');
        const inputSelector = 'input[type="text"], input[placeholder*="email"], input[aria-label*="email"]';
        await page.waitForSelector(inputSelector, { timeout: 10000 });
        await page.type(inputSelector, targetEmail, { delay: 100 });
        
        // Wait a second for UI to update
        await new Promise(r => setTimeout(r, 1000));
        
        // Click the actual Send / Invite button
        console.log('🔍 Clicking the Send Invitations button...');
        const sendButton = await page.waitForSelector('::-p-xpath(//button[contains(., "Send invitations") or contains(., "Invite")])', { timeout: 5000 });
        if (sendButton) {
            await sendButton.click();
            console.log('✅ Clicked Send Invitations!');
        } else {
            throw new Error('Could not find Send Invitations button');
        }
        
        // Wait to ensure invite is sent
        await new Promise(r => setTimeout(r, 5000));
        console.log(`🎉 Successfully invited ${targetEmail} via GitHub Actions!`);

    } catch (error) {
        console.error('❌ Canva automation error:', error.message);
        try {
            await page.screenshot({ path: 'canva_error.png', fullPage: true });
            console.log('📸 Saved error screenshot to canva_error.png');
        } catch (e) {
            console.error('Could not take screenshot', e);
        }
        process.exit(1);
    } finally {
        await browser.close();
    }
}

const email = process.env.TARGET_EMAIL;
if (!email) {
    console.error('❌ TARGET_EMAIL environment variable is missing!');
    process.exit(1);
}

inviteToCanva(email);
