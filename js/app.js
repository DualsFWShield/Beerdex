import * as Data from './data.js';
import * as UI from './ui.js';
import * as Storage from './storage.js';
import * as Achievements from './achievements.js';

// App State
const state = {
    beers: [],
    filter: '',
    activeFilters: {}, // New filter state
    view: 'home', // home, drunk, stats
};

// Initialize Application
async function init() {
    try {
        // Load Data
        const staticBeers = await Data.fetchAllBeers();
        const customBeers = Storage.getCustomBeers();
        state.beers = [...customBeers, ...staticBeers];

        // Initial Render
        renderCurrentView();

        // Setup Event Listeners
        setupEventListeners();

    } catch (error) {
        console.error("Failed to initialize Beerdex:", error);
        UI.showToast("Erreur de chargement des données. Vérifiez votre connexion.");
    }
}

function renderCurrentView() {
    const mainContent = document.getElementById('main-content');

    if (state.view === 'home') {
        const isDiscovery = Storage.getPreference('discoveryMode', false);

        let filteredBeers = searchBeers(state.beers, state.filter);

        // Discovery Mode Logic: 
        // If NO SEARCH: Show only discovered beers (My Collection).
        // If SEARCH: Show matches (allowing discovery of new ones).
        if (isDiscovery && !state.filter) {
            const consumedIds = Storage.getAllConsumedBeerIds();
            filteredBeers = state.beers.filter(b => consumedIds.includes(b.id));
        }

        // Toggle visibility of 'Bus' tab based on mode
        const busTab = document.querySelector('.nav-item[data-view="drunk"]');
        if (busTab) busTab.style.display = isDiscovery ? 'none' : 'flex';

        const showCreatePrompt = isDiscovery && state.filter && filteredBeers.length === 0;

        UI.renderBeerList(filteredBeers, mainContent, state.activeFilters, showCreatePrompt, () => {
            // Handle "Create" click from empty state
            UI.renderAddBeerForm((newBeer) => {
                Storage.saveCustomBeer(newBeer);
                state.beers.unshift(newBeer);
                Achievements.checkAchievements(state.beers);
                // Discovery mode: If we just added it, it matches the filter usually? 
                // Or we reset filter? Let's just render.
                renderCurrentView();
                UI.closeModal();
                UI.showToast("Bière ajoutée !");
            }, state.filter); // Pass current search query as default title
        });
    } else if (state.view === 'drunk') {
        const consumedIds = Storage.getAllConsumedBeerIds();
        const drunkBeers = state.beers.filter(b => consumedIds.includes(b.id));
        // We could apply filters here too if we want? Let's keep it simple for now, or apply them.
        // Let's pass the filters but typically filters are for "finding new beers".
        // Actually, filtering drunk list is useful.
        UI.renderBeerList(drunkBeers, mainContent, state.activeFilters);
    } else if (state.view === 'stats') {
        const isDiscovery = Storage.getPreference('discoveryMode', false);
        UI.renderStats(state.beers, Storage.getAllUserData(), mainContent, isDiscovery, (newVal) => {
            Storage.savePreference('discoveryMode', newVal);
            renderCurrentView(); // Re-render to reflect change immediately if we switch views
        });
    }
}

function searchBeers(beers, query) {
    if (!query) return beers;
    const lowerQuery = query.toLowerCase();
    return beers.filter(b =>
        b.title.toLowerCase().includes(lowerQuery) ||
        b.brewery.toLowerCase().includes(lowerQuery)
    );
}

function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            state.view = e.currentTarget.dataset.view;
            renderCurrentView();
        });
    });

    // Search Toggle
    const searchToggle = document.getElementById('search-toggle');
    const searchBar = document.getElementById('search-bar');
    const searchInput = document.getElementById('search-input');
    const searchClose = document.getElementById('search-close');

    searchToggle.addEventListener('click', () => {
        searchBar.classList.toggle('hidden');
        if (!searchBar.classList.contains('hidden')) {
            searchInput.focus();
        }
    });

    searchClose.addEventListener('click', () => {
        searchBar.classList.add('hidden');
        searchInput.value = '';
        state.filter = '';
        renderCurrentView();
    });

    searchInput.addEventListener('input', (e) => {
        state.filter = e.target.value;
        renderCurrentView();
    });

    // Filter Toggle
    document.getElementById('filter-toggle').addEventListener('click', () => {
        UI.renderFilterModal(state.beers, state.activeFilters || {}, (filters) => {
            state.activeFilters = filters;

            // Visual feedback
            const btn = document.getElementById('filter-toggle');
            const hasFilters = Object.keys(filters).length > 0;
            btn.style.color = hasFilters ? 'var(--accent-gold)' : 'inherit';

            renderCurrentView();
            if (hasFilters) UI.showToast("Filtres appliqués !");
        });
    });

    // FAB - Add Custom Beer
    document.getElementById('fab-add').addEventListener('click', () => {
        UI.renderAddBeerForm((newBeer) => {
            Storage.saveCustomBeer(newBeer);
            state.beers.unshift(newBeer); // Add to top
            Achievements.checkAchievements(state.beers);
            renderCurrentView();
            UI.closeModal();
            UI.showToast("Bière ajoutée avec succès !");
        });
    });

    // Delegated Events for Beer Cards
    document.getElementById('main-content').addEventListener('click', (e) => {
        const card = e.target.closest('.beer-card');
        if (card) {
            const beerId = card.dataset.id;
            const beer = state.beers.find(b => b.id === beerId);
            if (beer) {
                UI.renderBeerDetail(beer, (ratingData) => {
                    Storage.saveBeerRating(beer.id, ratingData);
                    Achievements.checkAchievements(state.beers);
                    renderCurrentView(); // Re-render to show checkmarks
                    UI.showToast("Note sauvegardée !");
                });
            }
        }
    });
}

// Initialize
window.addEventListener('DOMContentLoaded', init);

// Global event listener for actions triggering achievements
window.addEventListener('beerdex-action', () => {
    Achievements.checkAchievements(state.beers);
});

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);

                // Check for updates on subsequent loads if the SW is waiting
                if (registration.waiting) {
                    notifyUpdate(registration.waiting);
                }

                // Detect when a new worker is available (installed but waiting)
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            notifyUpdate(newWorker);
                        }
                    });
                });
            })
            .catch(err => {
                console.log('ServiceWorker registration failed: ', err);
            });
    });

    // Handle controller change (when new SW takes over, reload page)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
    });
}

function notifyUpdate(worker) {
    const toast = document.createElement('div');
    toast.className = 'update-toast';
    toast.innerHTML = `
        <span>Nouvelle version disponible !</span>
        <button id="reload-btn">Mettre à jour</button>
    `;
    document.body.appendChild(toast);

    document.getElementById('reload-btn').addEventListener('click', () => {
        worker.postMessage({ type: 'SKIP_WAITING' });
    });
}
