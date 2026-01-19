const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data'); // Assuming script is in js/
const files = ['belgiumbeer.json', 'deutchbeer.json', 'frenchbeer.json', 'newbeer.json', 'nlbeer.json', 'usbeer.json'];
const outputFile = path.join(dataDir, 'breweries.json');

// 1. Load Existing Mappings (Province Codes)
let existingMappings = {}; // "brewery name" -> "CODE"
if (fs.existsSync(outputFile)) {
    try {
        const raw = fs.readFileSync(outputFile, 'utf8');
        const data = JSON.parse(raw);

        // Handle OLD format: { "ANT": { breweries: [...] } }
        if (!Array.isArray(data)) {
            Object.entries(data).forEach(([code, obj]) => {
                if (obj.breweries) {
                    obj.breweries.forEach(b => existingMappings[b.toLowerCase()] = code);
                }
            });
        }
        // Handle NEW format: [ { name, province } ] (if re-running)
        else {
            data.forEach(item => {
                if (item.province) existingMappings[item.name.toLowerCase()] = item.province;
            });
        }
    } catch (e) {
        console.error("Error reading existing breweries.json", e);
    }
}

// 2. Extract All Breweries
let uniqueBreweries = new Set();

files.forEach(f => {
    const p = path.join(dataDir, f);
    if (!fs.existsSync(p)) return;

    try {
        const raw = fs.readFileSync(p, 'utf8');
        const json = JSON.parse(raw);
        // Normalize: could be array or object with 'beers' key
        const list = Array.isArray(json) ? json : (json.beers || []);

        list.forEach(beer => {
            if (beer.brewery && typeof beer.brewery === 'string') {
                const name = beer.brewery.trim();
                if (name.length > 1) uniqueBreweries.add(name);
            }
        });
    } catch (e) {
        console.error(`Error parsing ${f}:`, e.message);
    }
});

// 3. Build New List
const sortedBreweries = Array.from(uniqueBreweries).sort((a, b) => a.localeCompare(b));

const outputData = sortedBreweries.map(name => {
    return {
        name: name,
        province: existingMappings[name.toLowerCase()] || ""
    };
});

// 4. Write
fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2), 'utf8');

console.log(`Done! Extracted ${outputData.length} unique breweries.`);
console.log(`Preserved mappings: ${Object.keys(existingMappings).length}`);
