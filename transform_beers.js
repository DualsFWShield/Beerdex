const fs = require('fs');
const path = require('path');

const inputFile = 'txt.txt';
const csvFile = 'newbeer.csv';
const outputFile = 'new_beers.json';

// Simple CSV Parser that handles quoted newlines
function parseCSV(text) {
    const rows = [];
    let row = [];
    let curVal = '';
    let inQuote = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (inQuote) {
            if (char === '"' && nextChar === '"') {
                curVal += '"';
                i++; // skip next quote
            } else if (char === '"') {
                inQuote = false;
            } else {
                curVal += char;
            }
        } else {
            if (char === '"') {
                inQuote = true;
            } else if (char === ',') {
                row.push(curVal);
                curVal = '';
            } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
                row.push(curVal);
                rows.push(row);
                row = [];
                curVal = '';
                if (char === '\r') i++;
            } else if (char === '\r') {
                // Single CR case
                row.push(curVal);
                rows.push(row);
                row = [];
                curVal = '';
            } else {
                curVal += char;
            }
        }
    }
    if (curVal || row.length > 0) {
        row.push(curVal);
        rows.push(row);
    }
    return rows;
}

try {
    // 1. Parse CSV Data
    console.log("Reading CSV...");
    const csvData = fs.readFileSync(csvFile, 'utf8');
    const parsedRows = parseCSV(csvData);

    // Create Lookup Map
    // Key: Title (trimmed), Value: { brewery, alcohol, type, volume }
    const beerLookup = new Map();

    // Headers are in row 0: web_scraper_order,web_scraper_start_url,pagination-selector,title,description,price,image
    // Title is index 3, Description is index 4

    // Start from index 1 to skip header
    for (let i = 1; i < parsedRows.length; i++) {
        const row = parsedRows[i];
        if (row.length < 5) continue;

        const title = row[3].trim();
        const description = row[4];

        if (!title) continue;

        // Extract fields from description
        // Format examples: 
        // "Brasserie : AB Inbev\n\nVolume : 33cl..."
        // "Brewery : Huyghe\n... Colour : Green"

        const extract = (text, keys) => {
            for (const key of keys) {
                const regex = new RegExp(`${key}\\s*:\\s*(.+)`, 'i');
                const match = text.match(regex);
                if (match) return match[1].trim();
            }
            return null;
        };

        const brewery = extract(description, ['Brasserie', 'Brewery', 'Origine']) || "Inconnue";
        const extractVol = extract(description, ['Volume', 'Volumen']);
        const extractAlc = extract(description, ['Taux d\'alcool', 'Alcohol', 'Pourcentage d\'alcool']);
        const extractColor = extract(description, ['Couleur', 'Colour', 'Color']);

        beerLookup.set(title, {
            brewery: brewery,
            alcohol: extractAlc || "?",
            type: extractColor || "Biere", // Use Color as Type/Style proxy
            volume: extractVol // Might need normalization
        });
    }

    console.log(`Loaded ${beerLookup.size} beers from CSV.`);

    // 2. Process txt.txt
    const data = fs.readFileSync(inputFile, 'utf8');
    const lines = data.split('\n');
    const beers = [];

    lines.forEach((line, index) => {
        if (!line.trim()) return;

        let parts = line.split('\t');

        // Fallback for lines that might be space-separated or messy
        if (parts.length < 3) {
            const regex = /^(https?:\/\/\S+)\s+(https?:\/\/\S+)\s+(.+?)\s+(https?:\/\/\S+)\s+([€0-9,.]+)\s+(https?:\/\/\S+)/;
            const match = line.match(regex);
            if (match) {
                parts = [match[1], match[2], match[3], match[4], match[5], match[6]];
            } else {
                console.warn(`Line ${index + 1}: Skipping, format unrecognized.`);
                return;
            }
        }

        const rawImageUrl = parts[0] ? parts[0].trim() : '';
        const titleAndVol = parts[2] ? parts[2].trim() : '';

        // Lookup in CSV data
        // Try exact match first
        let enriched = beerLookup.get(titleAndVol);

        if (!enriched) {
            // Try flexible matching (maybe titleAndVol has extra spaces issues)
            // Or try partial match? 
            // Let's stick to simple trim() match first, usually consistent.
        }

        // Normalize Volume
        // Try enrichment first, else extract from title
        let volumeRaw = enriched ? enriched.volume : null;
        let volumeStr = "0.33 L";

        const parseVolume = (str) => {
            if (!str) return null;
            // "33cl", "33Cl", "0.33 L", "50cl", "1.5 L"
            const match = str.match(/(\d+(?:[.,]\d+)?)\s*(cl|l|ml)/i);
            if (match) {
                let val = parseFloat(match[1].replace(',', '.'));
                let unit = match[2].toLowerCase();
                if (unit === 'cl') return `${(val / 100).toFixed(2)} L`;
                if (unit === 'ml') return `${(val / 1000).toFixed(2)} L`;
                if (unit === 'l') return `${val.toFixed(2)} L`;
            }
            return null;
        };

        const volFromTitle = parseVolume(titleAndVol);
        const volFromCSV = parseVolume(volumeRaw);

        let volume = volFromCSV || volFromTitle || "0.33 L";

        // Clean Title
        // Remove volume info from title if present
        let title = titleAndVol;
        // Basic cleanup of common patterns
        title = title.replace(/-\s*\d+(?:[.,]\d+)?\s*cl/i, '');
        title = title.replace(/\d+(?:[.,]\d+)?\s*cl/i, '');
        title = title.replace(/\s-\s*$/, '');
        title = title.trim();

        // Type
        // If enriched type (Color) is present, use it. Clean it up.
        // "Blonde", "Brune", "Amber", "Green", "White"
        let type = "Biere";
        if (enriched && enriched.type && enriched.type.length > 2) {
            let rawType = enriched.type;
            // Map some colors/types to nicer names/standard names
            // The user asked to use "Couleur" or "Colour"
            if (rawType.match(/amber/i)) type = "Ambree";
            else if (rawType.match(/brune|brown|dark/i)) type = "Brune";
            else if (rawType.match(/blonde|blond/i)) type = "Blonde";
            else if (rawType.match(/white|wit|blanche/i)) type = "Blanche";
            else if (rawType.match(/red|rouge/i)) type = "Rouge / Fruit";
            else if (rawType.match(/pils/i)) type = "Pils";
            else if (rawType.match(/stout/i)) type = "Stout";
            else if (rawType.match(/ipa/i)) type = "IPA";
            else type = rawType; // fallback to raw string (e.g. "Green" -> user mentioned Green. Let's keep it if unknown)
        } else {
            // Fallback inference from title
            const lowerTitle = title.toLowerCase();
            if (lowerTitle.includes("pils")) type = "Pils";
            else if (lowerTitle.includes("tripel") || lowerTitle.includes("triple")) type = "Triple";
            else if (lowerTitle.includes("dubbel") || lowerTitle.includes("double")) type = "Double";
            else if (lowerTitle.includes("blonde")) type = "Blonde";
            else if (lowerTitle.includes("brune")) type = "Brune";
            else if (lowerTitle.includes("ipa")) type = "IPA";
        }

        // Brewery
        let brewery = enriched ? enriched.brewery : "Inconnue";

        // Alcohol
        let alcohol = enriched ? enriched.alcohol : "?";

        // ID Generation
        const safeTitle = title.toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
        const safeType = type.toUpperCase().replace(/[^A-Z0-9]/g, '_');
        const safeVol = volume.replace(' L', '');
        const id = `${safeTitle}_${safeType}_${safeVol}`;

        // Image Path
        // User requested to use the filename defined in the URL
        const filename = path.basename(rawImageUrl);
        const imagePath = `images/beer/be/${filename}`;

        beers.push({
            title: title,
            brewery: brewery,
            type: type,
            volume: volume,
            alcohol: alcohol,
            id: id,
            image: imagePath
        });
    });

    fs.writeFileSync(outputFile, JSON.stringify(beers, null, 2));
    console.log(`Successfully processed ${beers.length} beers.`);

} catch (err) {
    console.error("Error processing file:", err);
}
