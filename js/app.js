import * as Data from './data.js';
import * as UI from './ui.js';
import * as Storage from './storage.js';

// App State
const state = {
    beers: [],
    filter: '',
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
        const filteredBeers = searchBeers(state.beers, state.filter);
        UI.renderBeerList(filteredBeers, mainContent);
    } else if (state.view === 'drunk') {
        const consumedIds = Storage.getAllConsumedBeerIds();
        const drunkBeers = state.beers.filter(b => consumedIds.includes(b.id));
        UI.renderBeerList(drunkBeers, mainContent);
    } else if (state.view === 'stats') {
        UI.renderStats(state.beers, Storage.getAllUserData(), mainContent);
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

    // FAB - Add Custom Beer
    document.getElementById('fab-add').addEventListener('click', () => {
        UI.renderAddBeerForm((newBeer) => {
            Storage.saveCustomBeer(newBeer);
            state.beers.unshift(newBeer); // Add to top
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
                    renderCurrentView(); // Re-render to show checkmarks
                    UI.showToast("Note sauvegardée !");
                });
            }
        }
    });
}

// Start App
document.addEventListener('DOMContentLoaded', init);
