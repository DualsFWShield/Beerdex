const fs = require('fs');
const path = require('path');

const existingFile = 'data/belgiumbeer.json';
const newFile = 'new_beers.json';

try {
    const existingBeers = JSON.parse(fs.readFileSync(existingFile, 'utf8'));
    const newBeers = JSON.parse(fs.readFileSync(newFile, 'utf8'));

    // Create a Set of normalized titles for existing beers to fuzzy match or exact match
    const existingTitles = new Set(existingBeers.map(b => b.title.toLowerCase().trim()));
    const existingIds = new Set(existingBeers.map(b => b.id).filter(id => id));

    let removedCount = 0;
    let keptCount = 0;

    // Filter new beers
    const filteredBeers = newBeers.filter(beer => {
        const normTitle = beer.title.toLowerCase().trim();

        // Check if title exists
        if (existingTitles.has(normTitle)) {
            // It's a duplicate
            console.log(`Duplicate found: ${beer.title}`);

            // Delete image file
            if (beer.image) {
                const imgPath = path.resolve(beer.image);
                if (fs.existsSync(imgPath)) {
                    try {
                        fs.unlinkSync(imgPath);
                        console.log(`Deleted image: ${beer.image}`);
                    } catch (e) {
                        console.error(`Failed to delete image ${beer.image}: ${e.message}`);
                    }
                }
            }
            removedCount++;
            return false;
        }

        keptCount++;
        return true;
    });

    // Write back filtered list
    fs.writeFileSync(newFile, JSON.stringify(filteredBeers, null, 2));

    console.log(`\nDeduplication Complete.`);
    console.log(`Total New Beers Processed: ${newBeers.length}`);
    console.log(`Removed Duplicates: ${removedCount}`);
    console.log(`Kept Unique Beers: ${keptCount}`);

} catch (err) {
    console.error("Error during deduplication:", err);
}
