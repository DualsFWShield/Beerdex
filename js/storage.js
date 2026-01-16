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
