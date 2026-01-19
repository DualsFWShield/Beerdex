import * as Storage from './storage.js';
import * as Share from './share.js';
import Match from './match.js';
import * as Map from './map.js';

// We assume global libs: QRCode, Html5QrcodeScanner (handled via CDN)
const QRCodeLib = window.QRCode;
const Html5Qrcode = window.Html5Qrcode;

// Helpers
const modalContainer = document.getElementById('modal-container');

export function showToast(message) {
    // Simple toast implementation
    const toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.bottom = '80px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.background = 'rgba(255, 192, 0, 0.9)';
    toast.style.color = '#000';
    toast.style.padding = '10px 20px';
    toast.style.borderRadius = '20px';
    toast.style.fontWeight = 'bold';
    toast.style.zIndex = '1000';
    toast.style.boxShadow = '0 5px 15px rgba(0,0,0,0.3)';
    toast.innerText = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

export function closeModal() {
    modalContainer.classList.add('hidden');
    modalContainer.setAttribute('aria-hidden', 'true');
    modalContainer.innerHTML = '';
    document.body.classList.remove('modal-open');
}

function openModal(content) {
    modalContainer.innerHTML = '';
    modalContainer.appendChild(content);
    modalContainer.classList.remove('hidden');
    modalContainer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');

    // Close on click outside
    modalContainer.onclick = (e) => {
        if (e.target === modalContainer) closeModal();
    };
}

// --- Renders ---

// Helper to remove white background from images
window.removeImageBackground = function (img) {
    if (img.dataset.processed) return;

    // Security check for cross-origin (though local files should be fine)
    try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');

        ctx.drawImage(img, 0, 0);

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        const threshold = 230; // Sensitivity for white detection
        let hasChanges = false;

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // Check if pixel is white-ish
            if (r > threshold && g > threshold && b > threshold) {
                // Set alpha to 0 (Transparent)
                data[i + 3] = 0;
                hasChanges = true;
            }
        }

        if (hasChanges) {
            ctx.putImageData(imgData, 0, 0);
            img.src = canvas.toDataURL();
            img.dataset.processed = "true";
        }
    } catch (e) {
        // Silent fail (CORS or other issue)
    }
};

export function renderBeerList(beers, container, filters = null, showCreatePrompt = false, isDiscoveryCallback = null, isAppend = false) {
    if (!isAppend) container.innerHTML = '';
    const userData = Storage.getAllUserData();

    // Filtering Logic
    let filteredBeers = beers;
    if (filters) {
        // --- Advanced Filtering ---

        // Type & Brewery
        if (filters.type && filters.type !== 'All') {
            filteredBeers = filteredBeers.filter(b => b.type === filters.type);
        }
        if (filters.brewery && filters.brewery !== 'All') {
            filteredBeers = filteredBeers.filter(b => b.brewery === filters.brewery);
        }

        // Helpers for parsing
        const getAlc = (b) => parseFloat((b.alcohol || '0').replace('%', '').replace('°', '')) || 0;
        const getVol = (b) => {
            const str = (b.volume || '').toLowerCase();
            if (str.includes('l') && !str.includes('ml') && !str.includes('cl')) {
                return parseFloat(str) * 1000; // Liters to ml
            }
            if (str.includes('cl')) return parseFloat(str) * 10;
            return parseFloat(str) || 330; // Default or raw
        };

        // Alcohol Filter
        if (filters.alcMode) {
            const max = parseFloat(filters.alcMax);
            const min = parseFloat(filters.alcMin);
            const exact = parseFloat(filters.alcExact);

            if (filters.alcMode === 'max' && !isNaN(max)) {
                filteredBeers = filteredBeers.filter(b => getAlc(b) <= max);
            } else if (filters.alcMode === 'range') {
                if (!isNaN(min)) filteredBeers = filteredBeers.filter(b => getAlc(b) >= min);
                if (!isNaN(max)) filteredBeers = filteredBeers.filter(b => getAlc(b) <= max);
            } else if (filters.alcMode === 'exact' && !isNaN(exact)) {
                // allow small epsilon for float comparison?
                filteredBeers = filteredBeers.filter(b => Math.abs(getAlc(b) - exact) < 0.1);
            }
        } else {
            // Backward compat / Default logic
            if (filters.maxAlcohol) {
                filteredBeers = filteredBeers.filter(b => getAlc(b) <= parseFloat(filters.maxAlcohol));
            }
        }

        // Volume Filter
        if (filters.volMode && filters.volMode !== 'any') {
            const min = parseFloat(filters.volMin);
            const max = parseFloat(filters.volMax);
            const exact = parseFloat(filters.volExact);

            if (filters.volMode === 'range') {
                if (!isNaN(min)) filteredBeers = filteredBeers.filter(b => getVol(b) >= min);
                if (!isNaN(max)) filteredBeers = filteredBeers.filter(b => getVol(b) <= max);
            } else if (filters.volMode === 'exact' && !isNaN(exact)) {
                // Approximate check for volumes (e.g. 330ml vs 33cl)
                filteredBeers = filteredBeers.filter(b => Math.abs(getVol(b) - exact) < 5);
            }
        }

        // Minimum Rating
        if (filters.minRating && parseInt(filters.minRating) > 0) {
            const minR = parseInt(filters.minRating);
            filteredBeers = filteredBeers.filter(b => {
                const r = Storage.getBeerRating(b.id);
                return r && r.score >= minR;
            });
        }

        // --- Sorting ---
        if (filters.sortBy && filters.sortBy !== 'default') {
            filteredBeers.sort((a, b) => {
                let valA, valB;

                if (filters.sortBy === 'brewery') {
                    valA = a.brewery.toLowerCase();
                    valB = b.brewery.toLowerCase();
                } else if (filters.sortBy === 'alcohol') {
                    valA = getAlc(a);
                    valB = getAlc(b);
                } else if (filters.sortBy === 'volume') {
                    valA = getVol(a);
                    valB = getVol(b);
                } else { // Default sort by title if sortBy is not recognized but not 'default'
                    valA = a.title.toLowerCase();
                    valB = b.title.toLowerCase();
                }

                if (valA < valB) return filters.sortOrder === 'desc' ? 1 : -1;
                if (valA > valB) return filters.sortOrder === 'desc' ? -1 : 1;
                return 0;
            });
        } else {
            // Default Sort by Title A-Z
            filteredBeers.sort((a, b) => a.title.localeCompare(b.title));
            if (filters.sortOrder === 'desc') filteredBeers.reverse();
        }

        // Custom Beer Filter
        if (filters.onlyCustom) {
            filteredBeers = filteredBeers.filter(b => String(b.id).startsWith('CUSTOM_'));
        }
    }

    if (filteredBeers.length === 0) {
        if (showCreatePrompt && isDiscoveryCallback) {
            container.innerHTML = `
                <div style="text-align:center; padding: 40px 20px;">
                    <p style="color: #888; margin-bottom: 20px;">La bière n'existe pas encore...</p>
                    <button id="btn-create-discovery" class="btn-primary" style="background:var(--accent-gold); color:var(--bg-dark);">
                        ➕ Créer cette bière
                    </button>
                </div>`;
            document.getElementById('btn-create-discovery').onclick = isDiscoveryCallback;
            return;
        }

        // Specific Empty State for Discovery Mode (No Search, Empty Collection)
        if (isDiscoveryCallback && !showCreatePrompt) {
            container.innerHTML = `
                <div style="text-align:center; padding: 50px 20px; color: #888;">
                    <div style="font-size: 3rem; margin-bottom: 20px;">🕵️‍♂️</div>
                    <h3>Mode Découverte</h3>
                    <p style="margin-top: 10px;">Votre collection est vide.</p>
                    <p style="font-size: 0.8rem; margin-top: 5px;">Utilisez la recherche 🔍 pour trouver et ajouter des bières.</p>
                </div>`;
            return;
        }

        container.innerHTML = '<div style="text-align:center; padding: 20px; color: #666;">Aucune bière ne correspond aux critères...</div>';
        return;
    }

    const grid = document.createElement('div');
    grid.className = 'beer-grid';

    filteredBeers.forEach((beer, index) => {
        const isDrunk = userData[beer.id] ? true : false;
        const card = document.createElement('div');
        card.className = `beer-card ${isDrunk ? 'drunk' : ''}`;
        card.dataset.id = beer.id;

        // Stats Badges
        const abv = beer.alcohol ? `<span style="background:rgba(255,255,255,0.1); padding:2px 6px; border-radius:4px; font-size:0.7rem;">${beer.alcohol}</span>` : '';
        const vol = beer.volume ? `<span style="background:rgba(255,255,255,0.1); padding:2px 6px; border-radius:4px; font-size:0.7rem;">${beer.volume}</span>` : '';
        const typeBadge = beer.type ? `<span style="background:rgba(255,255,255,0.1); padding:2px 6px; border-radius:4px; font-size:0.7rem;">${beer.type}</span>` : '';

        // Determine correct fallback/default image based on volume
        const isKeg = (vol) => {
            if (!vol) return false;
            const v = vol.toUpperCase();
            // Simple heuristic for Kegs
            return v.includes('20 L') || v.includes('30 L') || v.includes('50 L') || v.includes('FUT');
        };
        const fallbackImage = isKeg(beer.volume) ? 'images/beer/FUT.jpg' : 'images/beer/default.png';

        // If current image is FUT but it's not a keg, fix it immediately
        let displayImage = beer.image;
        if (!displayImage || (displayImage.includes('FUT.jpg') && !isKeg(beer.volume))) {
            displayImage = fallbackImage;
        }

        card.innerHTML = `
            <svg class="check-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <div style="width:100%; height:120px; display:flex; justify-content:center; align-items:center;">
                <img src="${displayImage}" alt="${beer.title}" class="beer-image" loading="${index < 10 ? 'eager' : 'lazy'}" 
                     ${beer.removeBackground ? 'onload="removeImageBackground(this)"' : ''}
                     onerror="if(this.src.includes('${fallbackImage}')) return; this.src='${fallbackImage}';">
            </div>
            <div class="beer-info">
                <h3 class="beer-title">${beer.title}</h3>
                <p class="beer-brewery">${beer.brewery}</p>
                <div style="display:flex; gap:5px; justify-content:center; margin-top:5px; color:#aaa; flex-wrap:wrap;">
                    ${abv} ${vol} ${typeBadge}
                </div>
            </div>
        `;
        grid.appendChild(card);
    });

    container.appendChild(grid);
}

export function renderFilterModal(allBeers, activeFilters, onApply) {
    const wrapper = document.createElement('div');
    wrapper.className = 'modal-content';

    // Extract unique values
    const types = ['All', ...new Set(allBeers.map(b => b.type).filter(Boolean))].sort();
    const breweries = ['All', ...new Set(allBeers.map(b => b.brewery).filter(Boolean))].sort();

    // Helpers
    const createOptions = (list, selected) => list.map(item => `<option value="${item}" ${item === selected ? 'selected' : ''}>${item}</option>`).join('');

    wrapper.innerHTML = `
        <h2 style="margin-bottom:20px;">Filtres & Tris</h2>
        <form id="filter-form">
            <!-- Sorting -->
            <div class="stat-card mb-20">
                <h4 style="margin-bottom:10px;">Trier par</h4>
                <div style="display:flex; gap:10px;">
                    <select name="sortBy" class="form-select" style="flex:2;">
                        <option value="default" ${activeFilters.sortBy === 'default' ? 'selected' : ''}>Défaut (Nom)</option>
                        <option value="brewery" ${activeFilters.sortBy === 'brewery' ? 'selected' : ''}>Brasserie</option>
                        <option value="alcohol" ${activeFilters.sortBy === 'alcohol' ? 'selected' : ''}>Alcool (%)</option>
                        <option value="volume" ${activeFilters.sortBy === 'volume' ? 'selected' : ''}>Volume</option>
                    </select>
                    <select name="sortOrder" class="form-select" style="flex:1;">
                        <option value="asc" ${activeFilters.sortOrder === 'asc' ? 'selected' : ''}>⬆️ Croissant</option>
                        <option value="desc" ${activeFilters.sortOrder === 'desc' ? 'selected' : ''}>⬇️ Décroissant</option>
                    </select>
                </div>
            </div>

            <!-- Basic Filters -->
            <div class="form-group">
                <label class="form-label">Type</label>
                <select name="type" class="form-select">${createOptions(types, activeFilters.type || 'All')}</select>
            </div>
            <div class="form-group">
                <label class="form-label">Brasserie</label>
                <select name="brewery" class="form-select">${createOptions(breweries, activeFilters.brewery || 'All')}</select>
            </div>

            <!-- Advanced Alcohol -->
            <div class="form-group" style="padding:10px; background:rgba(255,255,255,0.05); border-radius:8px;">
                <label class="form-label">Degré Alcool</label>
                <div style="display:flex; gap:10px; margin-bottom:10px;">
                    <select id="alc-mode" name="alcMode" class="form-select">
                        <option value="max" ${activeFilters.alcMode === 'max' ? 'selected' : ''}>Maximum</option>
                        <option value="range" ${activeFilters.alcMode === 'range' ? 'selected' : ''}>Plage (Min-Max)</option>
                        <option value="exact" ${activeFilters.alcMode === 'exact' ? 'selected' : ''}>Exact</option>
                    </select>
                </div>
                <div id="alc-inputs"></div>
            </div>

            <!-- Advanced Volume -->
            <div class="form-group" style="padding:10px; background:rgba(255,255,255,0.05); border-radius:8px;">
                <label class="form-label">Volume (ml)</label>
                <div style="display:flex; gap:10px; margin-bottom:10px;">
                    <select id="vol-mode" name="volMode" class="form-select">
                        <option value="any" ${!activeFilters.volMode || activeFilters.volMode === 'any' ? 'selected' : ''}>Peu importe</option>
                        <option value="range" ${activeFilters.volMode === 'range' ? 'selected' : ''}>Plage</option>
                        <option value="exact" ${activeFilters.volMode === 'exact' ? 'selected' : ''}>Exact</option>
                    </select>
                </div>
                <div id="vol-inputs"></div>
            </div>

            <!-- Rating -->
             <div class="form-group">
                <label class="form-label">Note Minimum (<span id="rate-val">${activeFilters.minRating || 0}</span>/20)</label>
                <input type="range" name="minRating" class="form-input" min="0" max="20" step="1" value="${activeFilters.minRating || 0}" 
                    oninput="document.getElementById('rate-val').innerText = this.value">
            </div>

            <div class="form-group" style="padding:10px; background:rgba(255,255,255,0.05); border-radius:8px;">
                 <label class="form-group" style="display:flex; align-items:center; gap:10px; cursor:pointer;">
                    <input type="checkbox" name="onlyCustom" ${activeFilters.onlyCustom ? 'checked' : ''} style="width:20px; height:20px;">
                    <span style="font-weight:bold; color:var(--accent-gold);">Mes Créations Uniquement</span>
                </label>
            </div>

            <div style="display:flex; gap:10px; margin-top:20px;">
                <button type="button" id="btn-reset-filters" class="form-input" style="flex:1; color:#aaa;">Réinitialiser</button>
                <button type="submit" class="btn-primary" style="flex:2;">Appliquer</button>
            </div>
        </form>
    `;

    // Dynamic Alcohol Input logic
    const alcContainer = wrapper.querySelector('#alc-inputs');
    const alcModeSelect = wrapper.querySelector('#alc-mode');

    const renderAlcInputs = (mode) => {
        if (mode === 'max') {
            alcContainer.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px;">
                    <input type="range" name="alcMax" class="form-input" min="0" max="15" step="0.5" value="${activeFilters.alcMax || 15}" 
                        oninput="document.getElementById('alc-display-max').innerText = this.value">
                    <span style="min-width:40px;"><span id="alc-display-max">${activeFilters.alcMax || 15}</span>%</span>
                </div>
            `;
        } else if (mode === 'range') {
            alcContainer.innerHTML = `
                <div style="display:flex; gap:5px;">
                    <input type="number" name="alcMin" class="form-input" placeholder="Min" step="0.1" value="${activeFilters.alcMin || ''}">
                    <span style="align-self:center;">à</span>
                    <input type="number" name="alcMax" class="form-input" placeholder="Max" step="0.1" value="${activeFilters.alcMax || ''}">
                </div>
            `;
        } else if (mode === 'exact') {
            alcContainer.innerHTML = `
                 <input type="number" name="alcExact" class="form-input" placeholder="Ex: 5.5" step="0.1" value="${activeFilters.alcExact || ''}">
            `;
        }
    };

    alcModeSelect.onchange = (e) => renderAlcInputs(e.target.value);
    renderAlcInputs(activeFilters.alcMode || 'max'); // Init

    // Dynamic Volume Input logic
    const volContainer = wrapper.querySelector('#vol-inputs');
    const volModeSelect = wrapper.querySelector('#vol-mode');

    const renderVolInputs = (mode) => {
        if (mode === 'any') {
            volContainer.innerHTML = '<div style="color:#aaa; font-style:italic;">Tous les volumes</div>';
        } else if (mode === 'range') {
            volContainer.innerHTML = `
                 <div style="display:flex; gap:5px;">
                    <input type="number" name="volMin" class="form-input" placeholder="Min (ml)" step="10" value="${activeFilters.volMin || ''}">
                    <span style="align-self:center;">à</span>
                    <input type="number" name="volMax" class="form-input" placeholder="Max (ml)" step="10" value="${activeFilters.volMax || ''}">
                </div>
            `;
        } else if (mode === 'exact') {
            volContainer.innerHTML = `
                 <input type="number" name="volExact" class="form-input" placeholder="Ex: 330 (ml)" step="10" value="${activeFilters.volExact || ''}">
            `;
        }
    };

    volModeSelect.onchange = (e) => renderVolInputs(e.target.value);
    renderVolInputs(activeFilters.volMode || 'any');

    wrapper.querySelector('#btn-reset-filters').onclick = () => {
        onApply({});
        closeModal();
    };

    wrapper.querySelector('form').onsubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const filters = Object.fromEntries(formData.entries());
        onApply(filters);
        closeModal();
    };

    openModal(wrapper);
}

export function renderBeerDetail(beer, onSave) {
    const existingData = Storage.getBeerRating(beer.id) || {};
    const template = Storage.getRatingTemplate();

    const wrapper = document.createElement('div');
    wrapper.className = 'modal-content';

    let imgPath = beer.image;
    if (!imgPath) imgPath = 'images/beer/FUT.jpg';

    // Build Dynamic Form
    let formFields = template.map(field => {
        const value = existingData[field.id] !== undefined ? existingData[field.id] : '';

        if (field.type === 'number') {
            return `
                <div class="form-group">
                    <label class="form-label">${field.label}</label>
                    <input type="number" class="form-input" name="${field.id}" min="${field.min}" max="${field.max}" step="${field.step}" value="${value}" placeholder="Note... (0-20)">
                </div>`;
        } else if (field.type === 'textarea') {
            return `
                <div class="form-group">
                    <label class="form-label">${field.label}</label>
                    <textarea class="form-textarea" name="${field.id}" rows="3">${value}</textarea>
                </div>`;
        } else if (field.type === 'range') {
            return `
                <div class="form-group">
                    <label class="form-label" style="display:flex; justify-content:space-between;">
                        <span>${field.label}</span>
                        <span id="val-${field.id}">${value || 0}/10</span>
                    </label>
                    <input type="range" class="form-input" name="${field.id}" min="0" max="10" step="1" value="${value || 0}"
                        oninput="document.getElementById('val-${field.id}').innerText = this.value + '/10'"
                        style="padding:0; height:40px;">
                </div>`;
        } else if (field.type === 'checkbox') {
            return `
                <div class="form-group" style="display:flex; align-items:center; gap:10px; background:var(--bg-card); padding:10px; border-radius:8px;">
                    <input type="checkbox" name="${field.id}" ${value ? 'checked' : ''} style="width:20px; height:20px;">
                        <label class="form-label" style="margin:0;">${field.label}</label>
                </div>`;
        }
        return '';
    }).join('');

    // --- Consumption Section ---
    const consumptionWrapper = document.createElement('div');
    consumptionWrapper.style.cssText = 'background:var(--bg-card); padding:15px; border-radius:12px; margin-bottom:20px; text-align:center;';

    // Default Volume logic
    let defaultVol = beer.volume || '33cl';
    // Clean string for display
    defaultVol = defaultVol.replace('.', ',');

    consumptionWrapper.innerHTML = `
                <h3 style="margin-bottom:10px; font-size:1rem;">Consommation</h3>
                <div style="font-size:2rem; font-weight:bold; color:var(--accent-gold); margin-bottom:10px;">
                    <span id="consumption-count">${existingData.count || 0}</span> <span style="font-size:1rem; color:#666;">fois</span>
                </div>

                <div class="form-group">
                    <label class="form-label">Volume bu</label>
                    <select id="consumption-volume" class="form-select" style="text-align:center;">
                        <option value="${defaultVol}" selected>${defaultVol} (Défaut)</option>
                        <option value="25cl">25cl</option>
                        <option value="33cl">33cl</option>
                        <option value="50cl">50cl (Pinte)</option>
                        <option value="1L">1L</option>
                        <option value="1.5L">1.5L</option>
                        <option value="2L">2L</option>
                    </select>
                </div>

                <div style="display:flex; gap:10px; justify-content:center;">
                    <button id="btn-drink" class="btn-primary" style="margin:0; background:var(--success);">+ Boire</button>
                    <button id="btn-undrink" class="btn-primary" style="margin:0; background:var(--bg-card); border:1px solid #444; color:#aaa; width:auto;">- Annuler</button>
                </div>
                <p style="font-size:0.75rem; color:#666; margin-top:10px;">Ajoute une consommation à l'historique.</p>
                `;

    // --- Custom Beer Actions ---
    let customActions = '';
    if (beer.id.startsWith('CUSTOM_')) {
        customActions = `
            <div style="margin-top:20px; border-top:1px solid #333; padding-top:20px; display:flex; gap:10px;">
                <button id="btn-edit-beer" class="form-input" style="flex:1;">✏️ Modifier</button>
                <button id="btn-delete-beer" class="form-input" style="flex:1; color:var(--danger); border-color:var(--danger);">🗑️ Supprimer</button>
            </div>
        `;
    }

    // Image Fallback Logic
    const isKeg = (vol) => {
        if (!vol) return false;
        const v = vol.toUpperCase();
        return v.includes('20 L') || v.includes('30 L') || v.includes('50 L') || v.includes('FUT');
    };
    const fallbackImage = isKeg(beer.volume) ? 'images/beer/FUT.jpg' : 'images/beer/default.png';

    let displayImage = imgPath;
    if (!displayImage || (displayImage.includes('FUT.jpg') && !isKeg(beer.volume))) {
        displayImage = fallbackImage;
    }

    wrapper.innerHTML = `

                <div style="text-align: center; margin-bottom: 20px;">
                    <img src="${displayImage}" style="height: 150px; object-fit: contain; filter: drop-shadow(0 0 10px rgba(255,255,255,0.1));" 
                         ${beer.removeBackground ? 'onload="removeImageBackground(this)"' : ''}
                         onerror="if(this.src.includes('${fallbackImage}')) return; this.src='${fallbackImage}';">
                        <h2 style="margin-top: 10px; color: var(--accent-gold);">${beer.title}</h2>
                        <p style="color: #888;">${beer.brewery} - ${beer.type}</p>
                        <div style="display: flex; justify-content: center; gap: 15px; margin-top: 5px; font-size: 0.8rem; color: #aaa;">
                            <span>${beer.alcohol || '?'}</span>
                            <span>${beer.volume || '?'}</span>
                        </div>
                </div>

                ${consumptionWrapper.outerHTML}

                <details style="background:var(--bg-card); padding:10px; border-radius:12px; margin-bottom:20px;">
                    <summary style="font-weight:bold; cursor:pointer; list-style:none;">📝 Note de dégustation ${existingData.score ? '✅' : ''}</summary>
                    <form id="rating-form" style="margin-top:15px;">
                        ${formFields}
                        <button type="submit" class="btn-primary">Enregistrer la note</button>
                    </form>
                </details>

                <div style="display:flex; gap:10px; margin-bottom:10px;">
                    <button id="btn-share-beer" class="form-input" style="flex:1;">📤 Lien</button>
                    <button id="btn-share-insta" class="form-input" style="flex:1; border:1px solid var(--accent-gold); color:var(--accent-gold);">📸 Story</button>
                </div>

                ${customActions}
                `;

    // Share Link Handler
    wrapper.querySelector('#btn-share-beer').onclick = async () => {
        showToast("Préparation du partage...");
        await Storage.shareBeer(beer);
    };

    // Share Image Handler (Insta-Beer)
    wrapper.querySelector('#btn-share-insta').onclick = async () => {
        const btn = wrapper.querySelector('#btn-share-insta');
        const originalText = btn.innerHTML;
        btn.innerHTML = '⏳ Création...';

        try {
            // Get user data
            const existingData = Storage.getBeerRating(beer.id) || {};
            const userRating = existingData.score || 0;
            const userComment = existingData.comment || "";

            const blob = await Share.generateBeerCard(beer, userRating, userComment);
            await Share.shareImage(blob, `Check-in: ${beer.title}`);
            btn.innerHTML = originalText;
        } catch (err) {
            console.error(err);
            btn.innerHTML = originalText;
            showToast(err.message === 'Web Share API not supported' ? 'Partage fichier non supporté' : 'Erreur de partage');
        }
    };

    // Re-binding Logic for Consumption
    wrapper.querySelector('#btn-drink').onclick = async () => {
        const vol = wrapper.querySelector('#consumption-volume').value;
        const newData = Storage.addConsumption(beer.id, vol);
        wrapper.querySelector('#consumption-count').innerText = newData.count;

        // Dynamic Import for Achievements to avoid circular dependency issues if any,
        // or just rely on global/window if we attach it there?
        // Better: We need to check achievements here. 
        // Since UI doesn't import Achievements, we might need to pass a callback or dispatch an event.
        // For simplicity, let's dispatch a custom event that App.js listens to?
        // Or just import it here.
        const Achievements = await import('./achievements.js');
        // We need 'allBeers' to calculate stats correctly. 
        // We can pass a callback to renderBeerDetail?
        // Let's dispatch event for cleaner architecture.
        window.dispatchEvent(new CustomEvent('beerdex-action'));

        showToast(`🍻 Glou Glou ! (+${vol})`);
    };

    wrapper.querySelector('#btn-undrink').onclick = () => {
        const newData = Storage.removeConsumption(beer.id);
        if (newData) {
            wrapper.querySelector('#consumption-count').innerText = newData.count;
            showToast("Consommation annulée.");
        }
    };

    // Binding for Custom Actions
    if (customActions) {
        wrapper.querySelector('#btn-delete-beer').onclick = () => {
            if (confirm("Supprimer définitivement cette bière ?")) {
                Storage.deleteCustomBeer(beer.id);
                closeModal();
                showToast("Bière supprimée.");
                setTimeout(() => location.reload(), 500);
            }
        };

        wrapper.querySelector('#btn-edit-beer').onclick = () => {
            closeModal();
            renderAddBeerForm((updatedBeer) => {
                showToast("Bière modifiée !");
                setTimeout(() => location.reload(), 500);
            }, beer);
        };
    }

    wrapper.querySelector('#rating-form').onsubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = {};

        template.forEach(field => {
            if (field.type === 'checkbox') {
                data[field.id] = formData.get(field.id) === 'on';
            } else {
                data[field.id] = formData.get(field.id);
            }
        });

        // Validation for core score if present
        if (template.find(t => t.id === 'score') && !data.score) {
            alert("Veuillez mettre une note !");
            return;
        }

        onSave(data);
        showToast("Note sauvegardée !");
        wrapper.querySelector('details').open = false;
        wrapper.querySelector('summary').innerHTML = "📝 Note de dégustation ✅";
    };

    openModal(wrapper);
}

export function renderAddBeerForm(onSave, editModeBeer = null) {
    const wrapper = document.createElement('div');
    wrapper.className = 'modal-content';

    const title = editModeBeer ? "Modifier la bière" : "Ajouter une bière";
    const btnText = editModeBeer ? "Sauvegarder les modifications" : "Ajouter";

    // Fill values
    const v = (key) => editModeBeer ? (editModeBeer[key] || '') : '';

    wrapper.innerHTML = `
                <h2 style="margin-bottom: 20px;">${title}</h2>
                <form id="add-beer-form">
                    <div class="form-group">
                        <label class="form-label">Nom de la bière</label>
                        <input type="text" class="form-input" name="title" value="${v('title')}" required>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Brasserie</label>
                        <input type="text" class="form-input" name="brewery" value="${v('brewery')}" required>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Type (Blonde, Brune...)</label>
                        <input type="text" class="form-input" name="type" value="${v('type')}">
                    </div>

                    <div class="form-group">
                        <label class="form-label">Alcool (ex: 5°)</label>
                        <input type="text" class="form-input" name="alcohol" value="${v('alcohol')}">
                    </div>

                    <div class="form-group">
                        <label class="form-label">Volume (ex: 33cl)</label>
                        <input type="text" class="form-input" name="volume" value="${v('volume')}">
                    </div>

                    <div class="form-group">
                        <label class="form-label">Image</label>
                        <div style="display: flex; gap: 10px; align-items: center;">
                            <input type="file" id="image-file-input" accept="image/*" style="display: none;">
                                <button type="button" class="form-input" style="width: auto;" onclick="document.getElementById('image-file-input').click()">Choisir une photo</button>
                                <span id="file-name" style="font-size: 0.8rem; color: #888;">${editModeBeer ? 'Image actuelle conservée' : 'Par défaut: Fût'}</span>
                        </div>
                    </div>

                    <button type="submit" class="btn-primary">${btnText}</button>
                </form>
                `;

    let imageBase64 = editModeBeer ? editModeBeer.image : '';

    // File Reader Logic with Resize
    const fileInput = wrapper.querySelector('#image-file-input');
    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            wrapper.querySelector('#file-name').innerText = "Traitement...";
            resizeImage(file, 250, 250, (resizedBase64) => {
                imageBase64 = resizedBase64;
                wrapper.querySelector('#file-name').innerText = file.name + " (Redimensionné)";
            });
        }
    };

    wrapper.querySelector('form').onsubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        const newBeer = {
            id: editModeBeer ? editModeBeer.id : 'CUSTOM_' + Date.now(),
            title: formData.get('title'),
            brewery: formData.get('brewery'),
            type: formData.get('type') || 'Inconnu',
            alcohol: formData.get('alcohol'),
            volume: formData.get('volume'),
            image: imageBase64 || 'images/beer/FUT.jpg'
        };

        if (editModeBeer) {
            Storage.deleteCustomBeer(editModeBeer.id);
            Storage.saveCustomBeer(newBeer);
        }

        onSave(newBeer);
    };

    openModal(wrapper);
}

export function renderStats(allBeers, userData, container, isDiscovery = false, discoveryCallback = null) {
    const totalBeers = allBeers.length;
    const drunkCount = Object.keys(userData).length;
    const percentage = Math.round((drunkCount / totalBeers) * 100) || 0;

    const totalDrunkCount = Object.values(userData).reduce((acc, curr) => acc + (curr.count || 0), 0);

    container.innerHTML = `
                <div class="text-center p-20">
                    <!-- SVG Donut Chart -->
                    <div style="width:160px; height:160px; margin:0 auto; position:relative;">
                        <svg viewBox="0 0 36 36" class="circular-chart">
                            <path class="circle-bg"
                                d="M18 2.0845
                        a 15.9155 15.9155 0 0 1 0 31.831
                        a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                            <path class="circle"
                                stroke-dasharray="${percentage}, 100"
                                d="M18 2.0845
                        a 15.9155 15.9155 0 0 1 0 31.831
                        a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                        </svg>
                        <div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); font-size:1.8rem; font-weight:bold; color:var(--accent-gold);">
                            ${percentage}%
                        </div>
                    </div>
                    <h2 class="mt-20">Statistiques</h2>
                    <p style="color: var(--text-secondary); margin-top: 10px;">
                        Vous avez goûté <strong style="color: #fff;">${drunkCount}</strong> bières uniques sur <strong style="color: #fff;">${totalBeers}</strong>.
                    </p>
                     <p style="color: var(--text-secondary); margin-top: 5px; font-size: 0.9rem;">
                        Total consommé : <strong style="color: var(--accent-gold);">${totalDrunkCount}</strong> verres 🍺
                    </p>

                    ${renderAdvancedStats(allBeers, userData)}



                    <div class="stat-card mt-20 text-center">
                        <div id="beer-map-container" style="min-height:200px;">
                            <span class="spinner"></span> Chargement de la carte...
                        </div>
                    </div>

                    <div class="stat-card mt-20 text-center">
                        <h3>Succès 🏆</h3>
                        <div class="mt-20">
                            ${renderAchievementsList()}
                        </div>
                    </div>

                    <div class="stat-card mt-20 text-center">
                        <h3 style="margin-bottom:10px;">Beer Match ⚔️</h3>
                        <p style="font-size:0.8rem; color:#888; margin-bottom:15px;">Compare tes goûts avec un ami !</p>
                        <button type="button" id="btn-match" class="form-input text-center" style="background:#222; border:1px solid var(--accent-gold); color:var(--accent-gold); cursor:pointer;">
                            ⚔️ Lancer un Duel
                        </button>
                    </div>

                    <div class="stat-card mt-20 text-center">
                        <h3>Personnalisation</h3>
                        <p class="mb-20" style="font-size: 0.8rem; color: #888;">Adaptez le formulaire de notation à vos goûts (Sliders, Checkboxes...).</p>
                        <button type="button" id="btn-template" class="form-input text-center" style="background: #333; color: white; border: 1px solid #444;">⚙️ Configurer la Notation</button>
                    </div>

                    <div class="stat-card mt-20 text-center">
                        <h3>Options</h3>
                         <div style="display:flex; justify-content:space-between; align-items:center; margin-top:15px; background:rgba(255,255,255,0.05); padding:10px; border-radius:8px;">
                            <div style="text-align:left;">
                                <strong style="color:var(--accent-gold);">Mode Découverte</strong>
                                <p style="font-size:0.7rem; color:#888; margin-top:2px;">Cacher les bières non-trouvées</p>
                            </div>
                            <label class="switch">
                                <input type="checkbox" id="toggle-discovery" ${isDiscovery ? 'checked' : ''}>
                                <span class="slider round"></span>
                            </label>
                        </div>
                        
                         <div style="margin-top:15px; padding-top:15px; border-top:1px solid #333;">
                            <button id="btn-check-update" class="form-input text-center" style="width:100%;">🔄 Vérifier les mises à jour</button>
                        </div>
                    </div>

                    <div class="stat-card mt-20 text-center">
                        <h3>Gestion des données</h3>
                        <p class="mb-20" style="font-size: 0.8rem; color: #888;">Exportez vos données pour les sauvegarder ou les transférer.</p>
                        <div style="display:flex; gap:10px; flex-wrap:wrap;">
                            <button type="button" id="btn-export-full" class="form-input text-center mb-10" style="flex:1;">📥 Tout Exporter</button>
                            <button type="button" id="btn-export-light" class="form-input text-center mb-10" style="flex:1; font-size:0.8rem;">📥 Sans Custom</button>
                        </div>
                        <button type="button" id="btn-import" class="form-input text-center mt-20">📤 Importer des données</button>
                        
                        <div style="margin-top:20px; border-top:1px solid #333; padding-top:10px;">
                            <button type="button" id="btn-backup-text" class="form-input text-center" style="font-size:0.8rem; background:none; border:none; color:var(--accent-gold); text-decoration:underline;">
                                Copier ma sauvegarde (Texte)
                            </button>
                        </div>
                    </div>
                    
                    <div class="stat-card mt-20 text-center" style="margin-bottom: 40px;">
                        <h3 style="color:var(--text-secondary); font-size:1rem; text-transform:uppercase; letter-spacing:1px; margin-bottom:15px;">Crédits</h3>
                        
                        <div style="margin-bottom:15px;">
                            <p style="color:var(--accent-gold); font-size:0.8rem; margin-bottom:5px;">Co-Fondateurs</p>
                            <p style="font-size:0.9rem;">Dorian Storms & Noah Bruijninckx</p>
                        </div>
                        
                        <div style="margin-bottom:15px;">
                            <p style="color:var(--accent-gold); font-size:0.8rem; margin-bottom:5px;">Principaux Actionnaires</p>
                            <p style="font-size:0.9rem;">Tristan Storms & Maxance Veulemans</p>
                        </div>
                        
                        <div>
                            <p style="color:var(--accent-gold); font-size:0.8rem; margin-bottom:5px;">Design & Développement</p>
                            <p style="font-size:0.9rem;">Noah Bruijninckx</p>
                        </div>
                        
                        <div style="margin-top:20px; font-size:0.7rem; color:#444;">
                            Beerdex v2.0 &copy; 2026
                        </div>
                    </div>
                </div>
                `;

    // Handlers
    container.querySelector('#btn-template').onclick = () => renderTemplateEditor();

    const btnMatch = container.querySelector('#btn-match');
    if (btnMatch) btnMatch.onclick = () => renderMatchModal(allBeers);

    // Init Map
    setTimeout(() => {
        // We need to construct history list with brewery info
        // allBeers contains full data. userData contains ratings.
        const history = [];
        const ratings = userData || {};
        Object.keys(ratings).forEach(ratingKey => {
            // ratingKey is 'BEER_ID' or 'BEER_ID_UNIQUE'.
            // Extract core ID
            const coreId = ratingKey.split('_')[0];
            const beer = allBeers.find(b => b.id == coreId || b.id == ratingKey);
            if (beer) {
                history.push({ beer: beer, rating: ratings[ratingKey] });
            }
        });

        const mapContainer = container.querySelector('#beer-map-container');
        if (mapContainer) Map.renderMapWithData(mapContainer, history);
    }, 100);

    if (discoveryCallback) {
        container.querySelector('#toggle-discovery').onchange = (e) => {
            discoveryCallback(e.target.checked);
        };
    }

    // Handle Update Check
    container.querySelector('#btn-check-update').onclick = () => {
        if ('serviceWorker' in navigator) {
            showToast("Recherche de mises à jour...");
            navigator.serviceWorker.ready.then(registration => {
                registration.update().then(() => {
                    // If no update found after a short delay, tell user.
                    // If update found, the app.js logic will trigger the toast.
                    setTimeout(() => {
                        // We can't easily know if an update was found or not via the promise result directly,
                        // but if no toast appeared, likely up to date.
                        showToast("Vérification terminée.");
                    }, 2000);
                });
            });
        } else {
            showToast("Service Worker non supporté.");
        }
    };

    // Handle Export Full
    container.querySelector('#btn-export-full').onclick = async () => {
        showToast("Préparation de l'export...");
        await Storage.exportDataAdvanced({ includeCustom: true });
        showToast("Export terminé !");
    };

    // Handle Export Light
    container.querySelector('#btn-export-light').onclick = async () => {
        showToast("Préparation de l'export...");
        await Storage.exportDataAdvanced({ includeCustom: false });
        showToast("Export terminé !");
    };

    // Handle Text Backup
    container.querySelector('#btn-backup-text').onclick = () => {
        const jsonFull = Storage.getExportDataString(true);
        const jsonLight = Storage.getExportDataString(false);

        renderTextBackupModal(jsonFull, jsonLight); // Updated signature
    };

    // Handle Paste Import Button
    const btnPasteImport = document.createElement('button');
    btnPasteImport.type = 'button';
    btnPasteImport.className = 'form-input text-center mt-20';
    btnPasteImport.textContent = '📋 Coller une sauvegarde (Import)';
    btnPasteImport.style.background = 'none';
    btnPasteImport.style.border = '1px dashed var(--accent-gold)';
    btnPasteImport.style.color = 'var(--accent-gold)';

    btnPasteImport.onclick = async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text && (text.startsWith('{') || text.startsWith('['))) {
                if (confirm("Importer les données du presse-papier ? (Les données existantes ne seront pas écrasées)")) {
                    if (Storage.importData(text)) {
                        showToast("Importation réussie !");
                        setTimeout(() => location.reload(), 1500);
                    } else {
                        showToast("Format invalide.");
                    }
                }
            } else {
                // Fallback prompt if clipboard read fails or is empty
                const manual = prompt("Collez le JSON de sauvegarde ici :");
                if (manual) {
                    if (Storage.importData(manual)) {
                        showToast("Importation réussie !");
                        setTimeout(() => location.reload(), 1500);
                    } else {
                        showToast("Format invalide.");
                    }
                }
            }
        } catch (e) {
            const manual = prompt("Impossible de lire le presse-papier. Collez le JSON ici :");
            if (manual && Storage.importData(manual)) {
                showToast("Importation réussie !");
                setTimeout(() => location.reload(), 1500);
            }
        }
    };

    // Insert before the file import button or replace it? 
    // User wants both. Let's add it after the file import button.
    container.querySelector('#btn-import').parentNode.insertBefore(btnPasteImport, container.querySelector('#btn-backup-text').parentNode);


    // Handle Import
    container.querySelector('#btn-import').onclick = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                if (Storage.importData(evt.target.result)) {
                    showToast("Données importées avec succès !");
                    setTimeout(() => location.reload(), 1500);
                } else {
                    showToast("Erreur lors de l'importation.");
                }
            };
            reader.readAsText(file);
        };
        input.click();
    };
}

function renderTemplateEditor() {
    const wrapper = document.createElement('div');
    wrapper.className = 'modal-content';
    let template = Storage.getRatingTemplate();

    const refreshList = () => {
        const listHtml = template.map((field, index) => `
                <div style="background:rgba(0,0,0,0.3); padding:10px; margin-bottom:10px; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <strong>${field.label}</strong> <span style="font-size:0.8rem; color:#888;">(${field.type})</span>
                    </div>
                    ${field.id === 'score' || field.id === 'comment' ? '' : `<button type="button" data-idx="${index}" class="icon-btn delete-field" style="color:red;">🗑️</button>`}
                </div>
                `).join('');

        wrapper.querySelector('#field-list').innerHTML = listHtml;

        wrapper.querySelectorAll('.delete-field').forEach(btn => {
            btn.onclick = (e) => {
                template.splice(e.target.dataset.idx, 1);
                refreshList();
            };
        });
    };

    wrapper.innerHTML = `
                <h2>Configuration Notation</h2>
                <div id="field-list" style="margin: 20px 0;"></div>

                <div style="border-top:1px solid #333; padding-top:20px;">
                    <h3>Ajouter un champ</h3>
                    <div class="form-group">
                        <input type="text" id="new-label" class="form-input" placeholder="Nom (ex: Amertume)">
                    </div>
                    <div class="form-group">
                        <select id="new-type" class="form-select">
                            <option value="range">Curseur (Slider 0-10)</option>
                            <option value="checkbox">Case à cocher (Oui/Non)</option>
                            <option value="textarea">Texte long</option>
                        </select>
                    </div>
                    <button id="add-field" class="btn-primary" style="background:var(--bg-card); border:1px solid var(--accent-gold); color:var(--accent-gold);">+ Ajouter le champ</button>
                </div>

                <button id="save-template" class="btn-primary" style="margin-top:20px;">Enregistrer la configuration</button>
                <button id="reset-template" class="form-input" style="margin-top:10px; background:none; border:none; color:red;">Réinitialiser par défaut</button>
                `;

    setTimeout(refreshList, 0);

    // Add Field
    wrapper.querySelector('#add-field').onclick = () => {
        const label = wrapper.querySelector('#new-label').value;
        const type = wrapper.querySelector('#new-type').value;
        if (label) {
            const id = label.toLowerCase().replace(/[^a-z0-9]/g, '_');
            let field = { id, label, type };
            if (type === 'range') { field.min = 0; field.max = 10; field.step = 1; }
            template.push(field);
            refreshList();
            wrapper.querySelector('#new-label').value = '';
        }
    };

    // Save
    wrapper.querySelector('#save-template').onclick = () => {
        Storage.saveRatingTemplate(template);
        closeModal();
        showToast("Configuration sauvegardée !");
    };

    // Reset
    wrapper.querySelector('#reset-template').onclick = () => {
        if (confirm("Revenir aux champs par défaut ?")) {
            Storage.resetRatingTemplate();
            closeModal();
            showToast("Réinitialisé !");
        }
    };

    openModal(wrapper);
}

// Helper to resize image
export function resizeImage(file, maxWidth, maxHeight, callback) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width *= maxHeight / height;
                    height = maxHeight;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            callback(canvas.toDataURL('image/jpeg', 0.8)); // 0.8 quality jpeg
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function renderAdvancedStats(allBeers, userData) {
    let totalVolumeMl = 0;
    let totalAlcoholMl = 0;

    Object.keys(userData).forEach(id => {
        const user = userData[id];
        if (user.history) {
            user.history.forEach(h => {
                totalVolumeMl += h.volume;
                // Find beer data for alcohol
                const beer = allBeers.find(b => b.id === id);
                if (beer && beer.alcohol) {
                    const degree = parseFloat(beer.alcohol.replace('%', '').replace('°', ''));
                    if (!isNaN(degree)) {
                        totalAlcoholMl += h.volume * (degree / 100);
                    }
                }
            });
        }
    });

    const totalLiters = (totalVolumeMl / 1000).toFixed(1);
    const alcoholLiters = (totalAlcoholMl / 1000).toFixed(2);

    // Fun Comparisons logic (Volume)
    const comparisons = [
        { label: 'Pintes (50cl)', vol: 500, icon: '🍺' },
        { label: 'Packs de 6', vol: 1980, icon: '📦' },
        { label: 'Seaux (10L)', vol: 10000, icon: '🪣' },
        { label: 'Fûts (30L)', vol: 30000, icon: '🛢️' },
        { label: 'Douches (60L)', vol: 60000, icon: '🚿' },
        { label: 'Baignoires (150L)', vol: 150000, icon: '�' },
        { label: 'Jacuzzis (1000L)', vol: 1000000, icon: '🧖' },
        { label: 'Camions Citerne (30k L)', vol: 30000000, icon: '�' },
        { label: 'Piscines (50k L)', vol: 50000000, icon: '🏊' },
        { label: 'Piscines Olympiques', vol: 2500000000, icon: '🏟️' }
    ];

    let compHTML = '';
    comparisons.forEach(c => {
        const val = (totalVolumeMl / c.vol).toFixed(1);
        if (parseFloat(val) >= 1) {
            compHTML += `
        <div style="background:var(--bg-card); padding:10px; border-radius:12px; font-size:0.85rem; color:#888; display:flex; gap:10px; align-items:center;">
                 <span style="font-size:1.2rem;">${c.icon}</span>
                 <span><strong>${val}</strong> ${c.label}</span>
             </div>`;
        }
    });

    // Alcohol Comparisons Logic
    // totalAlcoholMl is pure alcohol.
    const alcComps = [
        { label: 'Pintes de Pils (50cl, 5%)', pure: 25, icon: '🍺' },
        { label: 'Shots de Tequila (3cl, 40%)', pure: 12, icon: '🥃' },
        { label: 'Bouteilles de Vin (75cl, 12%)', pure: 90, icon: '🍷' },
        { label: 'Bouteilles de Whisky (70cl, 40%)', pure: 280, icon: '�' },
        { label: 'Bouteilles de Vodka (70cl, 40%)', pure: 280, icon: '🍸' }
    ];

    let alcHTML = '';
    alcComps.forEach(c => {
        const val = (totalAlcoholMl / c.pure).toFixed(0);
        if (parseInt(val) > 0) {
            alcHTML += `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #333; padding:5px 0;">
                <span style="color:#aaa;">${c.icon} ${c.label}</span>
                <strong style="color:var(--text-primary);">${val}</strong>
            </div>`;
        }
    });

    // If nothing matches (too small volume), show at least one small one
    if (compHTML === '' && totalVolumeMl > 0) {
        compHTML = `
        <div class="comp-item">
                 <span style="font-size:1.2rem;">🍺</span>
                 <span><strong>${(totalVolumeMl / 500).toFixed(2)}</strong> Pintes</span>
             </div>`;
    }

    return `
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:20px;">
                    <div class="stat-card">
                        <div class="stat-value">${totalLiters} L</div>
                        <div class="stat-label">Volume Total</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${alcoholLiters} L</div>
                        <div class="stat-label">Alcool Pur</div>
                    </div>
                </div>

                <div class="mt-20">
                    <h4 class="ach-category-title text-center">Équivalences Volume</h4>
                    <div class="ach-grid" style="grid-template-columns:1fr 1fr;">
                        ${compHTML}
                    </div>
                </div>

                <div class="stat-card mt-20">
                    <h4 class="text-center" style="color:var(--danger); font-size:0.9rem; margin-bottom:10px;">Équivalences Alcool</h4>
                    <p class="text-center" style="font-size:0.75rem; color:#888; margin-bottom:10px;">C'est comme si vous aviez bu...</p>
                    ${alcHTML}
                </div>
                `;
}

// --- Achievements Helper ---
// We import dynamically or rely on global scope if needed, 
// but since we are in a module we can just import at top or here if supported.
// For simplicity in this file-based module structure, let's assume we import at top.
// Wait, we need to add the import statement at the top of the file too.

import * as Achievements from './achievements.js';

function renderAchievementsList() {
    const all = Achievements.getAllAchievements();
    const unlockedIds = Achievements.getUnlockedAchievements();

    // Group by Category
    const byCategory = {};
    all.forEach(ach => {
        const cat = ach.category || 'Autres';
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(ach);
    });

    let html = '';

    Object.keys(byCategory).forEach(cat => {
        html += `<h4 class="ach-category-title text-center">${cat}</h4>`;
        html += `<div class="ach-grid">`;

        html += byCategory[cat].map(ach => {
            const isUnlocked = unlockedIds.includes(ach.id);
            const opacity = isUnlocked ? '1' : '0.4'; // Improved visibility for locked items
            const filter = isUnlocked ? 'none' : 'grayscale(100%)';

            let title = ach.title;
            let desc = ach.desc;

            // Only mask if locked AND hidden
            if (!isUnlocked && ach.hidden) {
                title = '???';
                desc = 'Mystère... Continuez à explorer !';
            }

            // Escape quotes for function arguments
            // We need \\' for JS string inside HTML attribute
            const safeTitle = title.replace(/'/g, "\\'").replace(/"/g, '&quot;');
            const safeDesc = desc.replace(/'/g, "\\'").replace(/"/g, '&quot;');
            const safeIcon = ach.icon.replace(/'/g, "\\'").replace(/"/g, '&quot;');

            return `
                    <div class="ach-item" style="opacity:${opacity}; filter:${filter}; position:relative; cursor:pointer;" 
                         onclick="UI.showAchievementDetails('${safeTitle}', '${safeDesc}', '${safeIcon}', ${isUnlocked})">
                        <div class="ach-icon">${ach.icon}</div>
                    </div>`;
        }).join('');

        html += `</div>`;
    });

    return html;
}

function renderTextBackupModal(jsonFull, jsonLight) {
    const wrapper = document.createElement('div');
    wrapper.className = 'modal-content';

    // Default to full
    let currentJson = jsonFull;

    wrapper.innerHTML = `
        <h2 style="margin-bottom:20px;">Sauvegarde Texte</h2>
        <p style="color:#aaa; font-size:0.9rem; margin-bottom:15px;">
            Si l'export fichier ne fonctionne pas (APK), copiez ce texte.
        </p>
        
        <div style="display:flex; gap:10px; margin-bottom:10px;">
            <button id="tab-full" class="btn-primary" style="padding:8px; font-size:0.8rem; flex:1; background:var(--accent-gold); color:black;">Complet</button>
            <button id="tab-light" class="btn-primary" style="padding:8px; font-size:0.8rem; flex:1; background:var(--bg-card); border:1px solid #444; color:white;">Sans Custom</button>
        </div>

        <textarea id="backup-text-area" class="form-textarea" style="height:200px; font-family:monospace; font-size:0.75rem;" readonly>${jsonFull}</textarea>
        
        <div style="display:flex; gap:10px; margin-top:15px;">
            <button id="btn-copy-backup" class="btn-primary" style="margin:0; background:var(--accent-gold);">📋 Copier</button>
            <button id="btn-share-backup-text" class="btn-primary" style="margin:0; background:var(--bg-card); border:1px solid #444;">📤 Partager</button>
        </div>
    `;

    const textarea = wrapper.querySelector('#backup-text-area');
    const tabFull = wrapper.querySelector('#tab-full');
    const tabLight = wrapper.querySelector('#tab-light');

    const updateTabs = (isFull) => {
        currentJson = isFull ? jsonFull : jsonLight;
        textarea.value = currentJson;

        tabFull.style.background = isFull ? 'var(--accent-gold)' : 'var(--bg-card)';
        tabFull.style.color = isFull ? 'black' : 'white';
        tabFull.style.border = isFull ? 'none' : '1px solid #444';

        tabLight.style.background = !isFull ? 'var(--accent-gold)' : 'var(--bg-card)';
        tabLight.style.color = !isFull ? 'black' : 'white';
        tabLight.style.border = !isFull ? 'none' : '1px solid #444';
    };

    tabFull.onclick = () => updateTabs(true);
    tabLight.onclick = () => updateTabs(false);

    // Copy Handler
    wrapper.querySelector('#btn-copy-backup').onclick = () => {
        textarea.select();
        document.execCommand('copy');
        try {
            navigator.clipboard.writeText(currentJson);
        } catch (e) { }
        showToast("Copié dans le presse-papier !");
    };

    // Share Handler
    wrapper.querySelector('#btn-share-backup-text').onclick = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    text: currentJson,
                    title: 'Beerdex Backup'
                });
            } catch (e) {
                showToast("Partage non supporté.");
            }
        } else {
            showToast("Partage non supporté.");
        }
    };


    // Copy Handler
    wrapper.querySelector('#btn-copy-backup').onclick = () => {
        const area = wrapper.querySelector('#backup-text-area');
        area.select();
        document.execCommand('copy'); // Legacy but reliable
        try {
            navigator.clipboard.writeText(jsonString);
        } catch (e) { }

        showToast("Copié dans le presse-papier !");
    };

    // Share Handler
    wrapper.querySelector('#btn-share-backup-text').onclick = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    text: jsonString,
                    title: 'Beerdex Backup'
                });
            } catch (e) {
                showToast("Partage non supporté.");
            }
        } else {
            showToast("Partage non supporté.");
        }
    };

    openModal(wrapper);
}

export function checkAndShowWelcome() {
    const HAS_SEEN_KEY = 'beerdex_welcome_seen_v2';
    if (localStorage.getItem(HAS_SEEN_KEY)) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'modal-content text-center';
    wrapper.innerHTML = `
        <div style="margin-bottom:20px; font-size:3rem;">🍻</div>
        <h2 style="color:var(--accent-gold); margin-bottom:15px; font-family:'Russo One', sans-serif;">Bienvenue sur Beerdex !</h2>
        
        <p style="font-size:1rem; line-height:1.6; margin-bottom:20px; color:#ddd;">
            Profitez de cette application (offerte par la maison 🎁) pour découvrir, noter et déguster les mille et une bières existantes.
        </p>
        
        <div style="background:rgba(255,255,255,0.05); padding:15px; border-radius:12px; margin-bottom:25px; border:1px solid #444;">
            <p style="font-size:0.9rem; color:#bbb; margin:0;">
                ⚠️ <strong>Note de Sagesse :</strong><br>
                Nous vous invitons à la <em>dégustation</em>, pas à la consommation à outrance.<br>
                L'abus d'alcool est dangereux pour la santé.<br>
                <strong>Dégustez avec sagesse !</strong> 🧡
            </p>
        </div>

        <button id="btn-welcome-ok" class="btn-primary" style="width:100%; font-size:1.1rem; padding:12px;">Glou glou ! 🍺</button>
    `;


    wrapper.querySelector('#btn-welcome-ok').onclick = () => {
        localStorage.setItem(HAS_SEEN_KEY, 'true');
        document.getElementById('modal-container').classList.add('hidden');
        document.getElementById('modal-container').innerHTML = ''; // Clear
    };

    openModal(wrapper);
}

export function showAchievementDetails(title, desc, icon, isUnlocked) {
    const wrapper = document.createElement('div');
    wrapper.className = 'modal-content text-center';

    wrapper.innerHTML = `
        <div style="font-size:4rem; margin-bottom:20px; filter:${isUnlocked ? 'none' : 'grayscale(100%)'}; opacity:${isUnlocked ? '1' : '0.5'};">${icon}</div>
        <h2 style="color:var(--accent-gold); margin-bottom:10px; font-family:'Russo One';">${title}</h2>
        <p style="font-size:1.1rem; color:#ddd; margin-bottom:30px; line-height:1.5;">
            ${desc}
        </p>
        <button class="btn-primary" onclick="UI.closeModal()">Fermer</button>
    `;

    openModal(wrapper);
}

// --- Beer Match (QR) ---

export function renderMatchModal(allBeers) {
    const wrapper = document.createElement('div');
    // Fix: Max-height logic for small screens, and better width
    wrapper.innerHTML = `
        <div class="modal-content text-center" style="width: min(95%, 450px); max-height: 85vh; padding: 20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                <h2 style="margin:0; font-family:'Russo One'; color:var(--accent-gold); font-size:1.5rem;">⚔️ Beer Match</h2>
                <button type="button" class="close-btn" style="background:none; border:none; color:#fff; font-size:1.5rem; cursor:pointer;">&times;</button>
            </div>

            <div style="display:flex; border-bottom:1px solid #333; margin-bottom:20px;">
                <button id="tab-qr" style="flex:1; background:none; border:none; color:var(--accent-gold); padding:10px; border-bottom:2px solid var(--accent-gold); cursor:pointer;">Mon Code</button>
                <button id="tab-scan" style="flex:1; background:none; border:none; color:#666; padding:10px; cursor:pointer;">Scanner</button>
            </div>

            <div id="view-qr" style="display:block;">
                <p style="color:#aaa; font-size:0.9rem; margin-bottom:15px;">Montrez ce code à un ami.</p>
                <div id="qrcode-container" style="background:#FFF; padding:15px; border-radius:10px; display:inline-block; margin-bottom:15px;"></div>
                
                <!-- Text Fallback -->
                <div style="text-align:left;">
                    <p style="font-size:0.8rem; color:#888; margin-bottom:5px;">Code Texte (Copier si le scan échoue) :</p>
                    <textarea id="my-qr-text" readonly style="width:100%; height:60px; background:#222; border:1px solid #444; color:#aaa; font-size:0.7rem; padding:5px; border-radius:4px; resize:none;"></textarea>
                    <button id="btn-copy-code" class="form-input" style="padding:5px 10px; font-size:0.8rem; margin-top:5px; width:100%;">📋 Copier le code</button>
                </div>
            </div>

            <div id="view-scan" style="display:none;">
                <p style="color:#aaa; font-size:0.9rem; margin-bottom:15px;">Scannez le code.</p>
                <div id="reader" style="width:100%; height:250px; background:#000; border-radius:8px; overflow:hidden; position:relative;"></div>
                <div id="scan-feedback" style="margin-top:10px; color:var(--accent-gold); font-size:0.8rem; height:20px;"></div>
                
                <details style="margin-top:15px; text-align:left;">
                    <summary style="color:#555; cursor:pointer; font-size:0.8rem;">Problème de caméra ?</summary>
                    <textarea id="manual-paste" placeholder="Collez le code texte ici (BEERDEX:...)" style="width:100%; height:60px; background:#222; border:1px solid #444; color:#FFF; margin-top:5px; font-size:0.7rem; padding:5px;"></textarea>
                    <button id="btn-manual-compare" class="form-input" style="padding:5px 10px; font-size:0.8rem; margin-top:5px;">Comparer</button>
                </details>
            </div>

            <div id="view-result" style="display:none;"></div>
        </div>
    `;

    const tabQr = wrapper.querySelector('#tab-qr');
    const tabScan = wrapper.querySelector('#tab-scan');
    const viewQr = wrapper.querySelector('#view-qr');
    const viewScan = wrapper.querySelector('#view-scan');
    const viewResult = wrapper.querySelector('#view-result');
    let html5QrcodeScanner = null;
    let isScanning = false;

    // Stop Scanner Safely
    const stopScanner = async () => {
        if (!html5QrcodeScanner) return;
        try {
            if (html5QrcodeScanner.isScanning) {
                await html5QrcodeScanner.stop();
            }
            html5QrcodeScanner.clear();
        } catch (e) {
            console.warn("Scanner stop warning:", e);
        }
        html5QrcodeScanner = null;
        isScanning = false;
    };

    const switchTab = (tab) => {
        if (tab === 'qr') {
            tabQr.style.color = 'var(--accent-gold)'; tabQr.style.borderBottom = '2px solid var(--accent-gold)';
            tabScan.style.color = '#666'; tabScan.style.borderBottom = 'none';
            viewQr.style.display = 'block';
            viewScan.style.display = 'none';
            viewResult.style.display = 'none';
            stopScanner(); // Stop if switching to QR
        } else {
            tabScan.style.color = 'var(--accent-gold)'; tabScan.style.borderBottom = '2px solid var(--accent-gold)';
            tabQr.style.color = '#666'; tabQr.style.borderBottom = 'none';
            viewQr.style.display = 'none';
            viewScan.style.display = 'block';
            viewResult.style.display = 'none';
            // Start scanner with slight delay for UI render
            setTimeout(() => { if (!isScanning) startScanner(); }, 200);
        }
    };

    tabQr.onclick = () => switchTab('qr');
    tabScan.onclick = () => switchTab('scan');

    const generateMyQR = () => {
        const userData = Storage.getAllUserData();
        // Robust ID extraction: handle if userData is directly ratings or wrapper
        const ratings = userData.ratings || userData;
        const myIds = Object.keys(ratings).filter(k => ratings[k] && ratings[k].count > 0).map(k => k.split('_')[0]);

        if (myIds.length === 0) {
            wrapper.querySelector('#qrcode-container').innerHTML = "<p style='color:#ccc; padding:20px;'>Aucune bière notée !<br><small>Buvez d'abord... 😉</small></p>";
            wrapper.querySelector('#my-qr-text').value = "Rien à partager.";
            return;
        }

        if (typeof LZString === 'undefined') {
            console.error("LZString missing");
            wrapper.querySelector('#qrcode-container').innerHTML = "Erreur: Lib Compression manquante";
            return;
        }

        const qrString = Match.generateQRData(myIds, "Ami");

        // set Text FIRST so it appears even if QR fails
        const txtArea = wrapper.querySelector('#my-qr-text');
        if (txtArea) txtArea.value = qrString;

        // QR Code
        const container = wrapper.querySelector('#qrcode-container');
        container.innerHTML = '';

        // Delay slightly to ensure modal is rendered and dimensions are known
        setTimeout(() => {
            if (window.QRCode) {
                try {
                    new QRCode(container, {
                        text: qrString,
                        width: 180,
                        height: 180,
                        colorDark: "#000000",
                        colorLight: "#ffffff",
                        correctLevel: QRCode.CorrectLevel.M
                    });
                } catch (e) {
                    console.error("QR Gen Error", e);
                    container.innerHTML = "Erreur Génération QR";
                }
            } else {
                container.innerHTML = "Lib QR manquante";
            }
        }, 150);

        const btnCopy = wrapper.querySelector('#btn-copy-code');
        if (btnCopy) btnCopy.onclick = () => {
            if (window.navigator && window.navigator.clipboard) {
                txtArea.select();
                navigator.clipboard.writeText(qrString).then(() => {
                    showToast("Code copié !");
                }).catch(() => showToast("Erreur copie"));
            } else {
                txtArea.select();
                document.execCommand('copy');
                showToast("Code copié (legacy)");
            }
        };
    };

    const startScanner = () => {
        const feedback = wrapper.querySelector('#scan-feedback');
        feedback.textContent = "Initialisation caméra...";

        if (!window.Html5Qrcode) {
            feedback.textContent = "Erreur: Librairie QR non chargée";
            return;
        }

        const html5QrCode = new Html5Qrcode("reader");
        html5QrcodeScanner = html5QrCode;

        const qrCodeSuccessCallback = (decodedText, decodedResult) => {
            feedback.textContent = "Code détecté !";
            stopScanner().then(() => {
                processMatch(decodedText);
            });
        };

        const config = { fps: 10, qrbox: { width: 200, height: 200 } };

        html5QrCode.start({ facingMode: "environment" }, config, qrCodeSuccessCallback)
            .then(() => {
                isScanning = true;
                feedback.textContent = "Scannez un code...";
            })
            .catch(err => {
                console.error("Camera Error", err);
                feedback.textContent = "Caméra inaccessible (Permissions ?)";
                isScanning = false;
            });
    };

    const processMatch = (qrString) => {
        const friendData = Match.parseQRData(qrString);
        if (!friendData) {
            alert("Code invalide !");
            // Restart scanner if valid fail? No, easier to stay stopped.
            return;
        }

        const userData = Storage.getAllUserData();
        const ratings = userData.ratings || userData;
        const myIdsList = Object.keys(ratings).filter(k => ratings[k] && ratings[k].count > 0).map(k => k.split('_')[0]);

        const results = Match.compare(allBeers, myIdsList, friendData);
        displayMatchResults(results);
    };

    const displayMatchResults = (results) => {
        viewQr.style.display = 'none';
        viewScan.style.display = 'none';
        viewResult.style.display = 'block';

        // Hide tabs
        tabQr.style.display = 'none';
        tabScan.style.display = 'none';

        viewResult.innerHTML = `
            <div style="text-align:center; margin-bottom:20px;">
                <h3 style="color:var(--accent-gold); margin:0;">Match avec ${results.userName}</h3>
                <div style="font-size:3rem; font-weight:bold; color:#FFF; margin:10px 0;">
                    ${results.score}%
                </div>
                <div style="color:#aaa; font-size:0.9rem;">de compatibilité</div>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:20px;">
                <div style="background:#222; padding:10px; border-radius:8px;">
                    <div style="font-size:1.5rem; font-weight:bold; color:#FFF;">${results.commonCount}</div>
                    <div style="font-size:0.8rem; color:#888; white-space:nowrap;">En commun</div>
                </div>
                 <div style="background:#222; padding:10px; border-radius:8px;">
                    <div style="font-size:1.5rem; font-weight:bold; color:var(--accent-gold);">${results.friendTotal}</div>
                    <div style="font-size:0.8rem; color:#888; white-space:nowrap;">Total Ami</div>
                </div>
            </div>

            ${results.commonCount > 0 ? `
            <div style="text-align:left; margin-bottom:20px;">
                <strong style="color:#aaa; display:block; margin-bottom:5px;">Bières en commun (Top 5)</strong>
                <div style="background:#111; padding:10px; border-radius:8px; font-size:0.9rem;">
                    ${results.common.slice(0, 5).map(b => `<div style="margin-bottom:2px;">🍺 ${b.title}</div>`).join('')}
                    ${results.common.length > 5 ? `<div style="color:#666; font-style:italic;">...et ${results.common.length - 5} autres</div>` : ''}
                </div>
            </div>
            ` : ''}

            ${results.discovery.length > 0 ? `
            <div style="text-align:left;">
                <strong style="color:var(--accent-gold); display:block; margin-bottom:5px;">À découvrir (Top 3)</strong>
                <div style="background:#111; padding:10px; border-radius:8px; font-size:0.9rem;">
                     ${results.discovery.slice(0, 3).map(b => `<div style="margin-bottom:2px;">⭐ ${b.title}</div>`).join('')}
                </div>
            </div>
            ` : ''}
            
            <button id="btn-restart" class="form-input text-center mt-20" style="background:#333; margin-top:20px;">Nouveau Scan</button>
        `;

        wrapper.querySelector('#btn-restart').onclick = () => {
            // Reset UI
            tabQr.style.display = '';
            tabQr.style.color = '#666'; tabQr.style.borderBottom = 'none';
            tabScan.style.display = '';

            // Switch to scan
            switchTab('scan');
        };
    };

    wrapper.querySelector('#btn-manual-compare').onclick = () => {
        const txt = wrapper.querySelector('#manual-paste').value;
        if (txt) processMatch(txt);
    };

    const close = () => {
        stopScanner();
        closeModal();
    };
    wrapper.querySelector('.close-btn').onclick = close;

    // INITIAL CALL
    generateMyQR();

    openModal(wrapper);
}
