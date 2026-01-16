const DATA_FILES = [
    'data/belgiumbeer.json',
    'data/deutchbeer.json',
    'data/frenchbeer.json',
    'data/nlbeer.json',
    'data/usbeer.json'
];

export async function fetchAllBeers() {
    let allBeers = [];

    const promises = DATA_FILES.map(url =>
        fetch(url)
            .then(response => {
                if (!response.ok) throw new Error(`Failed to load ${url}`);
                return response.json();
            })
            .catch(err => {
                console.warn(`Error loading ${url}:`, err);
                return []; // Fail gracefully
            })
    );

    const results = await Promise.all(promises);

    results.forEach(data => {
        if (Array.isArray(data)) {
            allBeers = allBeers.concat(data);
        }
    });

    // Normalize IDs if missing (fallback to title)
    return allBeers.map(beer => ({
        ...beer,
        id: beer.id || beer.title.replace(/\s+/g, '_').toUpperCase() + '_' + Math.random().toString(36).substr(2, 5)
    }));
}
