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

// --- Generic Preferences ---
export function getPreference(key, defaultValue) {
    const val = localStorage.getItem(`beerdex_pref_${key}`);
    if (val === null) return defaultValue;
    try {
        return JSON.parse(val);
    } catch {
        return val;
    }
}

export function savePreference(key, value) {
    localStorage.setItem(`beerdex_pref_${key}`, JSON.stringify(value));
}

// --- Import / Export ---

// --- Advanced Export / Sharing ---

export async function exportDataAdvanced(options = { includeCustom: true }) {
    const exportObj = {
        ratings: getAllUserData(),
        ratingTemplate: getRatingTemplate(),
        exportDate: new Date().toISOString(),
        version: 3
    };

    if (options.includeCustom) {
        exportObj.customBeers = getCustomBeers();
    }

    const jsonString = JSON.stringify(exportObj);

    // File System Access API (Desktop)
    if (window.showSaveFilePicker) {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: filename,
                types: [{ description: 'Beerdex JSON', accept: { 'application/json': ['.json'] } }],
            });
            const writable = await handle.createWritable();
            await writable.write(jsonString);
            await writable.close();
            return true;
        } catch (err) {
            console.warn("Save cancelled or failed", err);
            return false;
        }
    }

    // Preparation for Share/Download
    const blob = new Blob([jsonString], { type: 'application/json' });
    const file = new File([blob], filename, { type: 'application/json' });

    // Web Share API Level 2 (Mobile / APK Watcher)
    // We check if we can share this file
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({
                files: [file],
                title: 'Export Beerdex',
                text: 'Voici un export de données Beerdex.'
            });
            return true;
        } catch (err) {
            if (err.name !== 'AbortError') console.warn("Share failed, trying download fallback", err);
            // If share fails, we continue to download fallback below
        }
    }

    // Fallback: Classic Download Link
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a); // Append required for some browsers (Firefox)
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
}

export async function shareBeer(beer) {
    // bundle single beer data + possible rating
    const rating = getBeerRating(beer.id);
    const exportObj = {
        beer: beer,
        rating: rating,
        image: beer.image,
        sharedAt: new Date().toISOString(),
        type: 'single_beer_share'
    };

    const jsonString = JSON.stringify(exportObj, null, 2);
    const filename = `beer_${beer.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;

    // File System Access API
    if (window.showSaveFilePicker) {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: filename,
                types: [{ description: 'Beerdex Beer JSON', accept: { 'application/json': ['.json'] } }],
            });
            const writable = await handle.createWritable();
            await writable.write(jsonString);
            await writable.close();
            return true;
        } catch (e) {
            console.warn("Save cancelled", e);
            return false;
        }
    }

    // Preparation
    const blob = new Blob([jsonString], { type: 'application/json' });
    const file = new File([blob], filename, { type: 'application/json' });

    // Web Share API (Mobile)
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({
                files: [file],
                title: `Partage: ${beer.title}`,
                text: `Découvre cette bière : ${beer.title} ! 🍺`
            });
            return true;
        } catch (err) {
            if (err.name !== 'AbortError') console.warn("Share failed, trying download fallback", err);
        }
    }

    // Fallback Download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
}

// Kept for backward compat or simple calls
export function exportData() {
    return exportDataAdvanced({ includeCustom: true });
}

export function importData(jsonString) {
    try {
        const data = JSON.parse(jsonString);

        // CASE 1: Single Beer Share
        if (data.type === 'single_beer_share' && data.beer) {
            const sharedBeer = data.beer;
            const sharedRating = data.rating;

            // If it's a custom beer ID or doesn't exist in our DB (simulate check? for now we assume ID collision is unlikely for custom unless same origin)
            // But if it IS a known ID (e.g. from static DB), we don't add to custom list, we just import rating.
            // Logic: If ID starts with CUSTOM_, add to my custom list if not present.

            if (String(sharedBeer.id).startsWith('CUSTOM_')) {
                const customs = getCustomBeers();
                const exists = customs.find(b => b.id === sharedBeer.id);
                if (!exists) {
                    saveCustomBeer(sharedBeer);
                    // alert("Bière personnalisée ajoutée !"); 
                } else {
                    // Update? For now, skip or maybe update if user wants? 
                    // Let's assume we don't overwrite custom definition to avoid conflicts, unless user specifically requested.
                    // For simple sharing: if it exists, we stick with what we have.
                }
            }

            // Import Rating/Consumption
            if (sharedRating) {
                const currentRatings = getAllUserData();
                // Merge logic: If we have data, we might want to keep ours OR merge history?
                // Simplest: If I haven't rated it, take the shared rating.
                // If I have, maybe just add a history entry? 

                // For this V1 of sharing: We overwrite/update the rating info if it's newer or we have nothing.
                // But actually, sharing is usually "Here is a beer I found", not "Sync my rating".
                // HOWEVER, the prompt implies importing "une biere a quelqu'un".
                // Let's just SAVE the rating if we don't have one, or update the score/comment if we do?

                // DECISION: If I have no data, I take theirs. 
                // If I have data, I KEEP mine but maybe add their comment as a note?
                // Actually, safeguard: Only import 'static' data (the beer itself).
                // But user asked "inclut egalement les images des bieres custom", implying sharing DEFINITION is key.
                // WE ALREADY HANDLED DEFINITION ABOVE.

                // Optional: Import their rating as MY rating? No, that's weird.
                // Maybe the use case is: "I export my beer to you". You get the beer definition.
                // Use case "Restore backup": You get everything.

                // CHANGE: If it's a single share, we mainly care about the Beer Definition (Custom).
                // We typically DO NOT import the other person's consumption history as OURS.
                // BUT, if it's a backup of a single beer...

                // Compromise: We import the Beer Definition. 
                // We ask user via confirm? No UI in storage.
                // We'll just return true signifying "Beer Imported".
                // If the user wants to copy the rating, that's ambiguous. 
                // Let's Import Rating ONLY IF we have absolutely nothing for this beer.
                if (!getAllUserData()[sharedBeer.id] && sharedRating) {
                    // saveBeerRating(sharedBeer.id, sharedRating); 
                    // Actually, let's NOT auto-import consumption history of someone else.
                    // Just importing the beer definition (if custom) is the main value.
                }
            }
            return true;
        }

        // CASE 2: Full Backup
        if (data.ratings) localStorage.setItem(STORAGE_KEY_RATINGS, JSON.stringify(data.ratings));
        if (data.customBeers) localStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(data.customBeers));
        if (data.ratingTemplate) localStorage.setItem('beerdex_rating_template', JSON.stringify(data.ratingTemplate));
        if (data.version) {
            // potential version migration handle
        }
        return true;
    } catch (e) {
        console.error("Import failed:", e);
        return false;
    }
}
