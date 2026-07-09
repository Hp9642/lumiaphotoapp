const fs = require('fs');
const path = require('path');

// Try loading dotenv to read BACKEND_URL
try {
    require('dotenv').config();
} catch (e) {
    // dotenv not installed/loaded, ignore
}

const BACKEND_URL = process.env.BACKEND_URL || '';

console.log('--- Lumina Netlify Build ---');

const srcDir = path.join(__dirname, '..');
const distDir = path.join(srcDir, 'dist');

// Helper to copy directory recursively
function copyDirSync(src, dest) {
    if (!fs.existsSync(src)) return;
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDirSync(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

// 1. Clean and recreate dist
if (fs.existsSync(distDir)) {
    console.log('Cleaning existing dist directory...');
    fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

// 2. Copy public directory contents to dist root
console.log('Copying public files...');
const publicDir = path.join(srcDir, 'public');
if (fs.existsSync(publicDir)) {
    const publicEntries = fs.readdirSync(publicDir, { withFileTypes: true });
    for (const entry of publicEntries) {
        const srcPath = path.join(publicDir, entry.name);
        const destPath = path.join(distDir, entry.name);
        if (entry.isDirectory()) {
            copyDirSync(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

// 3. Copy src/pages to dist/src/pages
console.log('Copying pages...');
const pagesSrc = path.join(srcDir, 'src', 'pages');
const pagesDest = path.join(distDir, 'src', 'pages');
copyDirSync(pagesSrc, pagesDest);

// 4. Generate _redirects file
console.log('Generating _redirects file...');
let redirectsContent = `# Lumina Redirects for Netlify
/portal                  /src/pages/portal.html        200
/manage                  /src/pages/portal.html        200
/pricing                 /pricing.html                 200
/:eventId/upload         /src/pages/upload.html        200
/:eventId/download       /src/pages/download.html      200
/:eventId/view           /src/pages/view.html          200
/:eventId/slideshow      /src/pages/slideshow.html     200
/:eventId/manage         /src/pages/manage.html        200
/:eventId/thankyou       /src/pages/thankyou.html      200

# Permanent Redirects
/:eventId/                 /:eventId/upload              301
/:eventId/manage/          /:eventId/manage              301
`;

if (BACKEND_URL) {
    const cleanUrl = BACKEND_URL.replace(/\/+$/, '');
    console.log(`Setting up API proxy to: ${cleanUrl}`);
    redirectsContent += `\n# API Proxy to self-hosted backend\n/api/*                   ${cleanUrl}/api/:splat        200\n`;
} else {
    console.warn('\n⚠️  WARNING: BACKEND_URL was not set in your .env file.');
    console.warn('API requests (/api/*) will not be routed to a live backend.');
    console.warn('Please define BACKEND_URL in .env and run this script again, or edit dist/_redirects directly.\n');
    redirectsContent += `\n# API Proxy (PLACEHOLDER - UPDATE WITH YOUR BACKEND URL)\n# /api/*                   https://your-backend.com/api/:splat        200\n`;
}

fs.writeFileSync(path.join(distDir, '_redirects'), redirectsContent);
console.log('Build completed! You can now drag-and-drop the "dist" folder to Netlify.');
