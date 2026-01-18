const fs = require('fs');
const https = require('https');
const path = require('path');

const inputFile = 'txt.txt';
// Target directory as per the JSON structure we defined
const outputDir = path.join('images', 'beer', 'be');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
    console.log(`Creating directory: ${outputDir}`);
    fs.mkdirSync(outputDir, { recursive: true });
}

// Function to download a single file
const downloadImage = (url, filepath) => {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filepath);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                // Consume response data to free up memory
                response.resume();
                fs.unlink(filepath, () => { }); // Delete empty/partial file
                return reject(new Error(`Status Code: ${response.statusCode}`));
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close(() => resolve(filepath));
            });
        }).on('error', (err) => {
            fs.unlink(filepath, () => { });
            reject(err);
        });
    });
};

const processImages = async () => {
    console.log(`Reading ${inputFile}...`);
    const data = fs.readFileSync(inputFile, 'utf8');
    const lines = data.split('\n');

    let count = 0;
    let skipped = 0;
    let errors = 0;
    const total = lines.filter(l => l.trim().length > 0).length;

    console.log(`Found ${total} lines to process.`);

    // Helper to process a line
    const processLine = async (line) => {
        if (!line.trim()) return;

        // Extract URL (assumed to be the first column based on previous analysis)
        // If tab split fails, we try regex fallback just like in the transform script
        let parts = line.split('\t');
        let rawImageUrl = parts[0] ? parts[0].trim() : '';

        if (!rawImageUrl.startsWith('http')) {
            // Try regex fallback from transform_beers.js
            const regex = /^(https?:\/\/\S+)\s+/;
            const match = line.match(regex);
            if (match) {
                rawImageUrl = match[1];
            } else {
                // console.warn('Skipping invalid line/URL'); 
                return;
            }
        }

        const filename = path.basename(rawImageUrl);
        const filepath = path.join(outputDir, filename);

        if (fs.existsSync(filepath)) {
            skipped++;
            // Optional: Check file size to see if it's a real image and not 0 bytes?
            // For now, assume if it exists, it's good.
            if (skipped % 50 === 0) process.stdout.write('.');
            return;
        }

        try {
            await downloadImage(rawImageUrl, filepath);
            count++;
            if (count % 10 === 0) process.stdout.write('+');
        } catch (e) {
            console.error(`\nError downloading ${filename}: ${e.message}`);
            errors++;
        }
    };

    // Process in batches to control concurrency
    const BATCH_SIZE = 10;
    for (let i = 0; i < lines.length; i += BATCH_SIZE) {
        const batchLines = lines.slice(i, i + BATCH_SIZE);
        await Promise.all(batchLines.map(line => processLine(line)));

        // Small progress indicator update
        if (i % 100 === 0) console.log(`\nProcessed ${Math.min(i + BATCH_SIZE, total)} / ${total}`);
    }

    console.log(`\n\nDownload Complete!`);
    console.log(`Downloaded: ${count}`);
    console.log(`Skipped (Already exists): ${skipped}`);
    console.log(`Errors: ${errors}`);
};

processImages();
