const fs = require('fs');
const path = require('path');

// Configuration
const SOURCE_DIR = path.resolve(__dirname, '..');
const DEST_DIR = path.resolve(__dirname, '../www');
const FILES_TO_COPY = [
    'index.html',
    'style.css',
    'manifest.webmanifest',
    'offline.html',
    'sw.js' // We copy it even if unused, just to be safe, but app.js will handle skipping it.
];
const DIRS_TO_COPY = [
    'js',
    'data',
    'icons',
    'images'
];

// Ensure Destination Exists
if (!fs.existsSync(DEST_DIR)){
    fs.mkdirSync(DEST_DIR);
}

// Clear Destination (simple clear)
function cleanDir(dirPath) {
    if (fs.existsSync(dirPath)) {
        fs.readdirSync(dirPath).forEach((file, index) => {
            const curPath = path.join(dirPath, file);
            if (fs.lstatSync(curPath).isDirectory()) { // recurse
                // recursively delete directory content? 
                // For safety, let's just use rm logic if node 14+
                fs.rmSync(curPath, { recursive: true, force: true });
            } else { // delete file
                fs.unlinkSync(curPath);
            }
        });
    }
}
console.log('Cleaning www directory...');
cleanDir(DEST_DIR);

// Copy Files
console.log('Copying files...');
FILES_TO_COPY.forEach(file => {
    const src = path.join(SOURCE_DIR, file);
    const dest = path.join(DEST_DIR, file);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
    } else {
        console.warn(`Warning: File not found: ${file}`);
    }
});

// Copy Directories
function copyDir(src, dest) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    let entries = fs.readdirSync(src, { withFileTypes: true });

    for (let entry of entries) {
        let srcPath = path.join(src, entry.name);
        let destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

DIRS_TO_COPY.forEach(dir => {
    const src = path.join(SOURCE_DIR, dir);
    const dest = path.join(DEST_DIR, dir);
    if (fs.existsSync(src)) {
        copyDir(src, dest);
    } else {
        console.warn(`Warning: Directory not found: ${dir}`);
    }
});

console.log('Build for Capacitor completed successfully!');
