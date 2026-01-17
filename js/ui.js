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
        
        ${consumptionWrapper.outerHTML}

        <details style="background:var(--bg-card); padding:10px; border-radius:12px; margin-bottom:20px;">
            <summary style="font-weight:bold; cursor:pointer; list-style:none;">📝 Note de dégustation ${existingData.score ? '✅' : ''}</summary>
            <form id="rating-form" style="margin-top:15px;">
                ${formFields}
                <button type="submit" class="btn-primary">Enregistrer la note</button>
            </form>
        </details>
        
        ${customActions}
    `;

    // Re-binding Logic for Consumption
    wrapper.querySelector('#btn-drink').onclick = () => {
        const vol = wrapper.querySelector('#consumption-volume').value;
        const newData = Storage.addConsumption(beer.id, vol);
        wrapper.querySelector('#consumption-count').innerText = newData.count;
        showToast(`🍻 Santé ! (+${vol})`);
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

            ${renderAdvancedStats(allBeers, userData)}
            
            <div style="margin-top: 20px; text-align: left; background: var(--bg-card); padding: 20px; border-radius: 16px;">
                <h3>Personnalisation</h3>
                <p style="font-size: 0.8rem; margin-bottom: 20px; color: #888;">Adaptez le formulaire de notation à vos goûts (Sliders, Checkboxes...).</p>
                <button id="btn-template" class="form-input" style="text-align: center; background: #333; color: white; border: 1px solid #444;">⚙️ Configurer la Notation</button>
            </div>

            <div style="margin-top: 20px; text-align: left; background: var(--bg-card); padding: 20px; border-radius: 16px;">
                <h3>Gestion des données</h3>
                <p style="font-size: 0.8rem; margin-bottom: 20px; color: #888;">Exportez vos données pour les sauvegarder ou les transférer.</p>
                <button id="btn-export" class="form-input" style="text-align: center; margin-bottom: 10px;">📥 Exporter mes données</button>
                <button id="btn-import" class="form-input" style="text-align: center;">📤 Importer des données</button>
            </div>
        </div>
       `;

    // Handlers
    container.querySelector('#btn-template').onclick = () => renderTemplateEditor();

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
                ${field.id === 'score' || field.id === 'comment' ? '' : `<button data-idx="${index}" class="icon-btn delete-field" style="color:red;">🗑️</button>`}
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
             <div style="background:var(--bg-card); padding:10px; border-radius:12px; font-size:0.85rem; color:#888; display:flex; gap:10px; align-items:center;">
                 <span style="font-size:1.2rem;">🍺</span>
                 <span><strong>${(totalVolumeMl / 500).toFixed(2)}</strong> Pintes</span>
             </div>`;
    }

    return `
     <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:20px;">
        <div style="background:var(--bg-card); padding:15px; border-radius:12px; text-align:center;">
             <div style="font-size:1.5rem; color:var(--text-primary); font-weight:bold;">${totalLiters} L</div>
             <div style="font-size:0.75rem; color:#666;">Volume Total</div>
        </div>
        <div style="background:var(--bg-card); padding:15px; border-radius:12px; text-align:center;">
             <div style="font-size:1.5rem; color:var(--text-primary); font-weight:bold;">${alcoholLiters} L</div>
             <div style="font-size:0.75rem; color:#666;">Alcool Pur</div>
        </div>
     </div>
     
     <div style="margin-top:20px;">
         <h4 style="color:var(--accent-gold); font-size:0.9rem; margin-bottom:10px;">Équivalences Volume</h4>
         <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
            ${compHTML}
         </div>
     </div>

     <div style="margin-top:20px; background:var(--bg-card); padding:15px; border-radius:12px;">
         <h4 style="color:var(--danger); font-size:0.9rem; margin-bottom:10px;">Équivalences Alcool</h4>
         <p style="font-size:0.75rem; color:#888; margin-bottom:10px;">C'est comme si vous aviez bu...</p>
         ${alcHTML}
     </div>
    `;
}
