// Runs automatically during Netlify's build step (see netlify.toml).
// Scans images/Events/ directly on disk (no GitHub API call — the repo is already
// checked out locally at build time) and writes gallery-manifest.json, a simple
// map of folder name -> list of image paths. journey.html fetches this one static
// file instead of calling GitHub at runtime, which means:
//   - No rate limit of any kind, at any traffic scale.
//   - No token to create, configure, or ever renew.
//   - New photos show up automatically on the next deploy, which already happens
//     every time you push to GitHub (including uploading photos) — no extra step.

const fs = require('fs');
const path = require('path');

const EVENTS_DIR = path.join(__dirname, 'images', 'Events');
const OUTPUT_FILE = path.join(__dirname, 'gallery-manifest.json');
const IMAGE_EXTENSIONS = /\.(jpe?g|png|gif|webp)$/i;

function buildManifest() {
  const manifest = {};

  if (!fs.existsSync(EVENTS_DIR)) {
    console.log('No images/Events folder found yet — writing an empty manifest.');
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(manifest, null, 2));
    return;
  }

  const folders = fs.readdirSync(EVENTS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory());

  folders.forEach((entry) => {
    const folderName = entry.name;
    const folderPath = path.join(EVENTS_DIR, folderName);
    const imageFiles = fs.readdirSync(folderPath)
      .filter((file) => IMAGE_EXTENSIONS.test(file))
      .sort((a, b) => a.localeCompare(b))
      .map((file) => `/images/Events/${encodeURIComponent(folderName)}/${encodeURIComponent(file)}`);

    manifest[folderName] = imageFiles;
  });

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(manifest, null, 2));
  console.log(`Gallery manifest written: ${folders.length} folder(s) found.`);
}

buildManifest();
