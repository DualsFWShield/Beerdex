const STORAGE_KEY_RATINGS = 'beerdex_ratings';
const STORAGE_KEY_CUSTOM = 'beerdex_custom_beers';

// Get all ratings/notes
export function getAllUserData() {
    const data = localStorage.getItem(STORAGE_KEY_RATINGS);
    return data ? JSON.parse(data) : {};
}

// Get specific beer rating
export function getBeerRating(id) {
    const data = getAllUserData();
    return data[id] || null;
}

// Save rating (Separated from consumption, but linked)
export function saveBeerRating(id, ratingData) {
    const data = getAllUserData();
    if (!data[id]) data[id] = { count: 1, history: [] }; // Assume rating implies drinking once if not present

    data[id] = {
        ...data[id],
        ...ratingData,
        timestamp: new Date().toISOString()
    };

    // Ensure history exists
    if (!data[id].history) {
        data[id].history = [{ date: new Date().toISOString(), volume: 330 }];
        data[id].count = 1;
    }

    localStorage.setItem(STORAGE_KEY_RATINGS, JSON.stringify(data));
}

// Get list of all IDs that have data (e.g. have been drunk/rated)
export function getAllConsumedBeerIds() {
    const data = getAllUserData();
    return Object.keys(data).filter(id => data[id].count > 0);
}

// --- Custom Beers ---

export function getCustomBeers() {
    const data = localStorage.getItem(STORAGE_KEY_CUSTOM);
    return data ? JSON.parse(data) : [];
}

export function saveCustomBeer(beer) {
    const beers = getCustomBeers();
    beers.unshift(beer); // Add to top
    localStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(beers));
}

export function deleteCustomBeer(id) {
    let beers = getCustomBeers();
    beers = beers.filter(b => b.id !== id);
    localStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(beers));
}

// --- Consumption Logic ---

export function parseVolumeToMl(volStr) {
    if (!volStr) return 330; // Default
    let str = volStr.toLowerCase().replace(',', '.').replace(/\s/g, '');
    let val = parseFloat(str);
    if (isNaN(val)) return 330;

    if (str.includes('ml')) return val;
    if (str.includes('cl')) return val * 10;
    if (str.includes('l')) return val * 1000;

    // Fallback based on magnitude
    if (val < 10) return val * 1000; // Assume Liters
    if (val < 100) return val * 10; // Assume cl
    return val; // Assume ml
}

export function addConsumption(id, volumeStr) {
    const data = getAllUserData();
    if (!data[id]) {
        data[id] = { count: 0, history: [] };
    }

    // Migrate old data if necessary (if it has score but no count)
    if (data[id].score && data[id].count === undefined) {
        data[id].count = 1;
        data[id].history = [{
            date: data[id].timestamp,
            volume: 330 // Assumption for historical data
        }];
    }

    data[id].count = (data[id].count || 0) + 1;

    const volMl = parseVolumeToMl(volumeStr);

    if (!data[id].history) data[id].history = [];
    data[id].history.push({
        date: new Date().toISOString(),
        volume: volMl
    });

    localStorage.setItem(STORAGE_KEY_RATINGS, JSON.stringify(data));
    return data[id];
}

export function removeConsumption(id) {
    const data = getAllUserData();
    if (data[id] && data[id].count > 0) {
        data[id].count--;
        if (data[id].history && data[id].history.length > 0) {
            data[id].history.pop();
        }

        if (data[id].count <= 0) {
            // Keep rating data even if count is 0? Or remove?
            // Requirement says "enlever une biere marquee comme bue".
            // If count is 0, we treat it as not drunk.
            data[id].count = 0;
        }
        localStorage.setItem(STORAGE_KEY_RATINGS, JSON.stringify(data));
        return data[id];
    }
}

// --- Rating Template ---

const DEFAULT_TEMPLATE = [
    { id: 'score', label: 'Note Globale (/20)', type: 'number', min: 0, max: 20, step: 0.5 },
    { id: 'comment', label: 'Commentaire', type: 'textarea' }
];

export function getRatingTemplate() {
    const data = localStorage.getItem('beerdex_rating_template');
    return data ? JSON.parse(data) : DEFAULT_TEMPLATE;
}

export function saveRatingTemplate(template) {
    localStorage.setItem('beerdex_rating_template', JSON.stringify(template));
}

export function resetRatingTemplate() {
    localStorage.setItem('beerdex_rating_template', JSON.stringify(DEFAULT_TEMPLATE));
    return DEFAULT_TEMPLATE;
}

// --- Import / Export ---

export function exportData() {
    const exportObj = {
        ratings: getAllUserData(),
        customBeers: getCustomBeers(),
        ratingTemplate: getRatingTemplate(),
        exportDate: new Date().toISOString(),
        version: 2
    };
    return JSON.stringify(exportObj);
}

export function importData(jsonString) {
    try {
        const data = JSON.parse(jsonString);
        if (data.ratings) localStorage.setItem(STORAGE_KEY_RATINGS, JSON.stringify(data.ratings));
        if (data.customBeers) localStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(data.customBeers));
        if (data.ratingTemplate) localStorage.setItem('beerdex_rating_template', JSON.stringify(data.ratingTemplate));
        return true;
    } catch (e) {
        console.error("Import failed:", e);
        return false;
    }
}
