const fs = require('fs');
const FILE = 'data/newbeer.json';
const beers = JSON.parse(fs.readFileSync(FILE, 'utf8'));

let count = 0;

beers.forEach(b => {
    // 1. Fix Verre
    if (b.title === 'Verre a Biere Affligem') {
        b.alcohol = ""; // Empty string for non-alcoholic items/glasses? Or "0°"
        b.type = "Verre"; // Ensure type is Verre
        console.log('Fixed Verre a Biere Affligem');
        count++;
    }

    // 2. Fix Mort Subite Geuze (Update ALL occurrences)
    if (b.title === 'Mort Subite Geuze') {
        b.alcohol = "4.5°";
        b.type = "Gueuze (Ambrée)";
        b.brewery = "Mort Subite (Alken-Maes)";
        console.log('Fixed Mort Subite Geuze');
        count++;
    }
});

fs.writeFileSync(FILE, JSON.stringify(beers, null, 2));
console.log(`Cleanup complete. Updated ${count} entries.`);
