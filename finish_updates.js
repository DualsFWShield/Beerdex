const fs = require('fs');
const beers = JSON.parse(fs.readFileSync('data/newbeer.json', 'utf8'));

let count = 0;

beers.forEach(b => {
    // Fix Paulaner
    if (b.title.includes('Paulaner Naturtrub Hefe Weissbier')) {
        console.log(`Updating Paulaner: ${b.title}`);
        b.alcohol = "5.5°";
        b.type = "Blanche (Weissbier)";
        b.brewery = "Paulaner Brauerei";
        count++;
    }
    // Fix Smash
    if (b.title === 'Smash') {
        console.log(`Updating Smash: ${b.title}`);
        b.alcohol = "5.7°";
        b.type = "Blonde";
        b.brewery = "Brasserie Het Nest";
        count++;
    }
});

if (count > 0) {
    fs.writeFileSync('data/newbeer.json', JSON.stringify(beers, null, 2));
    console.log(`Saved ${count} manual fixes.`);
} else {
    console.log("No targets found.");
}
