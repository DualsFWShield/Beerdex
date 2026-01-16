import * as Storage from './storage.js';

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
    modalContainer.innerHTML = '';
}

function openModal(content) {
    modalContainer.innerHTML = '';
    modalContainer.appendChild(content);
    modalContainer.classList.remove('hidden');

    // Close on click outside
    modalContainer.onclick = (e) => {
        if (e.target === modalContainer) closeModal();
    };
}

// --- Renders ---

export function renderBeerList(beers, container) {
    container.innerHTML = '';
    const userData = Storage.getAllUserData();

    if (beers.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding: 20px; color: #666;">Aucune bière trouvée...</div>';
        return;
    }

    const grid = document.createElement('div');
    grid.className = 'beer-grid';

    beers.forEach(beer => {
        const isDrunk = userData[beer.id] ? true : false;
        const card = document.createElement('div');
        card.className = `beer-card ${isDrunk ? 'drunk' : ''}`;
        card.dataset.id = beer.id;

        // Smart path cleaning: remove "images/" if it's duplicated or fix common errors
        // But mainly rely on the render behavior.

        // Stats Badges
        const abv = beer.alcohol ? `<span style="background:rgba(255,255,255,0.1); padding:2px 6px; border-radius:4px; font-size:0.7rem;">${beer.alcohol}</span>` : '';
        const vol = beer.volume ? `<span style="background:rgba(255,255,255,0.1); padding:2px 6px; border-radius:4px; font-size:0.7rem;">${beer.volume}</span>` : '';

        card.innerHTML = `
            <svg class="check-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <div style="width:100%; height:120px; display:flex; justify-content:center; align-items:center;">
                <img src="${beer.image}" alt="${beer.title}" class="beer-image" loading="lazy" 
                     onerror="if(this.src.includes('FUT.jpg')) return; this.src='images/beer/FUT.jpg';">
            </div>
            <div class="beer-info">
                <h3 class="beer-title">${beer.title}</h3>
                <p class="beer-brewery">${beer.brewery}</p>
                <div style="display:flex; gap:5px; justify-content:center; margin-top:5px; color:#aaa;">
                    ${abv} ${vol}
                </div>
            </div>
        `;
        grid.appendChild(card);
    });

    container.appendChild(grid);
}

export function renderBeerDetail(beer, onSave) {
    const existingData = Storage.getBeerRating(beer.id) || {};

    const wrapper = document.createElement('div');
    wrapper.className = 'modal-content';

    let imgPath = beer.image;
    if (!imgPath) imgPath = 'images/beer/FUT.jpg';


    wrapper.innerHTML = `
        <div style="text-align: center; margin-bottom: 20px;">
            <img src="${imgPath}" style="height: 150px; object-fit: contain; filter: drop-shadow(0 0 10px rgba(255,255,255,0.1));" onerror="this.src='https://placehold.co/100x200/1a1a10/e0e0e0?text=Beer'">
            <h2 style="margin-top: 10px; color: var(--accent-gold);">${beer.title}</h2>
            <p style="color: #888;">${beer.brewery} - ${beer.type}</p>
            <div style="display: flex; justify-content: center; gap: 15px; margin-top: 5px; font-size: 0.8rem; color: #aaa;">
                <span>${beer.alcohol || '?'}</span>
                <span>${beer.volume || '?'}</span>
            </div>
        </div>

        <form id="rating-form">
            <div class="form-group">
                <label class="form-label">Note (/20)</label>
                <input type="number" class="form-input" id="rating-score" min="0" max="20" step="0.5" value="${existingData.score || ''}" placeholder="Ex: 15.5">
            </div>

            <div class="form-group">
                <label class="form-label">Commentaire</label>
                <textarea class="form-textarea" id="rating-comment" rows="3" placeholder="Notes de dégustation... (Amertume, arômes...)">${existingData.comment || ''}</textarea>
            </div>

            <button type="submit" class="btn-primary">Enregistrer la dégustation</button>
        </form>
    `;

    wrapper.querySelector('form').onsubmit = (e) => {
        e.preventDefault();
        const score = document.getElementById('rating-score').value;
        const comment = document.getElementById('rating-comment').value;

        if (score) {
            onSave({ score, comment });
            closeModal();
        } else {
            alert("Veuillez mettre une note !");
        }
    };

    openModal(wrapper);
}

export function renderAddBeerForm(onSave) {
    const wrapper = document.createElement('div');
    wrapper.className = 'modal-content';

    wrapper.innerHTML = `
        <h2 style="margin-bottom: 20px;">Ajouter une bière (Custom)</h2>
        <form id="add-beer-form">
            <div class="form-group">
                <label class="form-label">Nom de la bière</label>
                <input type="text" class="form-input" name="title" required>
            </div>
            
             <div class="form-group">
                <label class="form-label">Brasserie</label>
                <input type="text" class="form-input" name="brewery" required>
            </div>

            <div class="form-group">
                <label class="form-label">Type (Blonde, Brune...)</label>
                <input type="text" class="form-input" name="type">
            </div>
            
            <div class="form-group">
                <label class="form-label">Alcool (ex: 5°)</label>
                <input type="text" class="form-input" name="alcohol">
            </div>
            
             <div class="form-group">
                <label class="form-label">Volume (ex: 33cl)</label>
                <input type="text" class="form-input" name="volume">
            </div>

            <!-- Simple Image URL for now, or File Reader could be added for base64 local storage, 
                 but keeping it simple/robust as per request -->
            <div class="form-group">
                <label class="form-label">Image</label>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <input type="file" id="image-file-input" accept="image/*" style="display: none;">
                    <button type="button" class="form-input" style="width: auto;" onclick="document.getElementById('image-file-input').click()">Choisir une photo</button>
                    <span id="file-name" style="font-size: 0.8rem; color: #888;">Par défaut: Fût</span>
                </div>
            </div>

            <button type="submit" class="btn-primary">Ajouter</button>
        </form>
    `;

    let imageBase64 = '';

    // File Reader Logic
    const fileInput = wrapper.querySelector('#image-file-input');
    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (evt) {
                imageBase64 = evt.target.result;
                wrapper.querySelector('#file-name').innerText = file.name;
            };
            reader.readAsDataURL(file);
        }
    };

    wrapper.querySelector('form').onsubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        const newBeer = {
            id: 'CUSTOM_' + Date.now(),
            title: formData.get('title'),
            brewery: formData.get('brewery'),
            type: formData.get('type') || 'Inconnu',
            alcohol: formData.get('alcohol'),
            volume: formData.get('volume'),
            image: imageBase64 || 'images/beer/FUT.jpg'
        };

        onSave(newBeer);
    };

    openModal(wrapper);
}

export function renderStats(allBeers, userData, container) {
    const totalBeers = allBeers.length;
    const drunkCount = Object.keys(userData).length;
    const percentage = Math.round((drunkCount / totalBeers) * 100) || 0;

    container.innerHTML = `
        <div style="text-align: center; padding: 20px;">
            <div style="width: 150px; height: 150px; border-radius: 50%; border: 10px solid var(--bg-card); border-top-color: var(--accent-gold); transform: rotate(-45deg); margin: 0 auto; display: flex; align-items: center; justify-content: center; font-size: 2rem; font-weight: bold; color: var(--accent-gold); box-shadow: var(--shadow-glow);">
                <div style="transform: rotate(45deg);">${percentage}%</div>
            </div>
            <h2 style="margin-top: 20px;">Statistiques</h2>
            <p style="color: var(--text-secondary); margin-top: 10px;">
                Vous avez goûté <strong style="color: #fff;">${drunkCount}</strong> bières sur <strong style="color: #fff;">${totalBeers}</strong> disponibles.
            </p>
            
            <div style="margin-top: 40px; text-align: left; background: var(--bg-card); padding: 20px; border-radius: 16px;">
                <h3>Gestion des données</h3>
                <p style="font-size: 0.8rem; margin-bottom: 20px; color: #888;">Exportez vos données pour les sauvegarder ou les transférer.</p>
                <button id="btn-export" class="form-input" style="text-align: center; margin-bottom: 10px;">📥 Exporter mes données</button>
                <button id="btn-import" class="form-input" style="text-align: center;">📤 Importer des données</button>
            </div>
        </div>
       `;

    // Handle Export
    container.querySelector('#btn-export').onclick = () => {
        const data = Storage.exportData();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `beerdex_backup_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        showToast("Fichier exporté !");
    };

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
