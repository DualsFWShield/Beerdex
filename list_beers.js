const fs = require('fs');

const beers = JSON.parse(fs.readFileSync('data/newbeer.json', 'utf8'));

const filtered = beers.filter(b => {
    // Check missing alcohol OR generic type "Biere" (which usually means scraping missed the specific style)
    return (b.alcohol === "?" || (b.type && b.type.toLowerCase() === "biere"));
});

const report = filtered.map(b => `| ${b.title} | ${b.alcohol} | ${b.type} | ${b.brewery} |`).join('\n');

const content = `# Beers with Missing Data or Generic Type\n\nFound ${filtered.length} beers.\n\n| Title | Alcohol | Type | Brewery |\n| --- | --- | --- | --- |\n${report}`;

fs.writeFileSync('missing_data_report.md', content);
console.log('Report saved to missing_data_report.md');
