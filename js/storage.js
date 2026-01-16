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

// Save rating
export function saveBeerRating(id, ratingData) {
    const data = getAllUserData();
    data[id] = {
        ...ratingData,
        timestamp: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEY_RATINGS, JSON.stringify(data));
}

// Get list of all IDs that have data (e.g. have been drunk/rated)
export function getAllConsumedBeerIds() {
    return Object.keys(getAllUserData());
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

// --- Import / Export ---

export function exportData() {
    const exportObj = {
        ratings: getAllUserData(),
        customBeers: getCustomBeers(),
        exportDate: new Date().toISOString(),
        version: 1
    };
    return JSON.stringify(exportObj);
}

export function importData(jsonString) {
    try {
        const data = JSON.parse(jsonString);
        if (data.ratings) localStorage.setItem(STORAGE_KEY_RATINGS, JSON.stringify(data.ratings));
        if (data.customBeers) localStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(data.customBeers));
        return true;
    } catch (e) {
        console.error("Import failed:", e);
        return false;
    }
}
