const fs = require('fs');

const REPORT_FILE = 'missing_data_report.md';
const JSON_FILE = 'data/newbeer.json';

function clean(str) {
    if (!str) return "";
    return str.trim();
}

try {
    const reportRaw = fs.readFileSync(REPORT_FILE, 'utf8');
    const beers = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));

    const lines = reportRaw.split('\n');
    let updatedCount = 0;

    // Map beers by title for easy lookup (lowercase)
    const beerMap = new Map();
    beers.forEach(b => beerMap.set(b.title.toLowerCase().trim(), b));

    // Also map by "clean" title (removing size) just in case
    beers.forEach(b => {
        const cleanTitle = b.title.replace(/ - \d+cl/i, '').trim().toLowerCase();
        if (!beerMap.has(cleanTitle)) {
            beerMap.set(cleanTitle, b);
        }
    });

    console.log(`Loaded ${beers.length} beers.`);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.toLowerCase().startsWith('title')) continue; // Skip header or empty

        // Try splitting by Tab first (user paste from Excel?)
        let parts = line.split('\t');

        // Fallback: Check if it's Pipe separated keys
        if (parts.length < 3 && line.includes('|')) {
            parts = line.split('|').map(p => p.trim()).filter(p => p.length > 0);
        }

        if (parts.length < 4) {
            console.log(`Skipping malformed line ${i + 1}: ${line}`);
            continue;
        }

        // Columns: Title | Alcohol | Type | Brewery | Volume
        // Depending on format, indices might shift.
        // If pipe: | Title | Alcohol | ... -> indices 0,1,2,3...
        // If tab: Title \t Alcohol ... -> indices 0,1,2,3...

        let title, alcohol, type, brewery;

        // Detection logic
        if (line.includes('|')) {
            // Markdown table row: "| Title | ..." splits to ["", "Title", ...]
            // But simpler to just filter empty
            const p = line.split('|').map(s => s.trim()).filter(s => s);
            if (p.length < 4) continue;
            title = p[0];
            alcohol = p[1];
            type = p[2];
            brewery = p[3];
        } else {
            // Tab separated
            title = parts[0];
            alcohol = parts[1];
            type = parts[2];
            brewery = parts[3];
        }

        title = clean(title);

        // Find the beer
        // Try strict match first
        let beer = beerMap.get(title.toLowerCase());

        // Try fuzzy match if needed (handling "..." abbreviations from report?)
        if (!beer) {
            // Check if title in report has "..."
            if (title.includes('...')) {
                const prefix = title.split('...')[0].trim().toLowerCase();
                // Find beer starting with prefix
                const candidate = beers.find(b => b.title.toLowerCase().startsWith(prefix));
                if (candidate) beer = candidate;
            }
        }

        if (beer) {
            let changes = false;

            // update Alcohol
            alcohol = clean(alcohol);
            if (alcohol && alcohol !== '?' && alcohol !== 'N/A' && alcohol !== beer.alcohol) {
                beer.alcohol = alcohol;
                changes = true;
            }

            // update Brewery
            brewery = clean(brewery);
            if (brewery && brewery !== '?' && brewery !== 'Inconnue' && brewery !== beer.brewery) {
                // Check if user put "Brasserie Het Nest" everywhere or if it's real
                // User said "complete toute ces nouvelles infos", so we trust the file content.
                beer.brewery = brewery;
                changes = true;
            }

            // update Type
            type = clean(type);
            if (type && type !== "?" && type !== "Biere" && type !== beer.type) {
                beer.type = type;
                changes = true;
            }

            if (changes) {
                updatedCount++;
                // console.log(`Updated: ${beer.title}`);
            }

        } else {
            console.log(`Beer not found for update: ${title}`);
        }
    }

    console.log(`Success! Updated ${updatedCount} beers.`);
    fs.writeFileSync(JSON_FILE, JSON.stringify(beers, null, 2));

} catch (e) {
    console.error("Error:", e);
}
