import { getAllUserData, getCustomBeers } from './storage.js';

let _allBeersProvider = null;

export function init(allBeersProvider) {
    _allBeersProvider = allBeersProvider;
}

function calculateStats() {
    const userData = getAllUserData();
    const customBeers = getCustomBeers();
    const allBeers = _allBeersProvider ? _allBeersProvider() : [];

    let totalBeers = 0;
    let totalVolumeMl = 0;
    let topBeers = [];
    let styles = {};
    let months = {};

    Object.keys(userData).forEach(key => {
        const entry = userData[key];
        const beerId = key.split('_')[0];

        let beer = allBeers.find(b => b.id == beerId);
        if (!beer) beer = customBeers.find(b => b.id == beerId);

        if (!beer && entry.count > 0) {
            console.warn(`[Wrapped] Beer not found for ID: ${beerId}`);
        }

        if (entry.count > 0) {
            totalBeers += entry.count;
            topBeers.push({
                name: beer ? beer.title : 'Bière Mystère',
                count: entry.count,
                image: beer ? beer.image : null,
                id: beerId
            });

            if (entry.history) {
                entry.history.forEach(h => {
                    totalVolumeMl += (h.volume || 330);
                    if (h.date) {
                        const month = new Date(h.date).getMonth();
                        months[month] = (months[month] || 0) + 1;
                    }
                });
            } else {
                totalVolumeMl += entry.count * 330;
            }

            if (beer && beer.style) {
                const style = beer.style.split('-')[0].trim();
                styles[style] = (styles[style] || 0) + entry.count;
            }
        }
    });

    topBeers.sort((a, b) => b.count - a.count);
    const favoriteBeer = topBeers.length > 0 ? topBeers[0] : null;

    const sortedStyles = Object.entries(styles).sort((a, b) => b[1] - a[1]);
    const favoriteStyle = sortedStyles.length > 0 ? sortedStyles[0][0] : 'Inconnu';

    const totalLiters = Math.round(totalVolumeMl / 1000);
    let equivalence = { label: "Bouteilles d'eau", val: totalLiters };

    const eqList = [
        { limit: 50, label: "Un petit aquarium " },
        { limit: 150, label: "Une baignoire remplie " },
        { limit: 300, label: "Un tonneau de vin " },
        { limit: 500, label: "Un jacuzzi pour 2 " },
        { limit: 1000, label: "Une piscine gonflable " }
    ];

    for (let eq of eqList) {
        if (totalLiters >= eq.limit) equivalence = { label: eq.label, val: totalLiters };
    }

    return {
        totalBeers,
        totalLiters,
        favoriteBeer,
        favoriteStyle,
        equivalence,
        uniqueBeers: Object.keys(userData).length
    };
}

export function start() {
    const stats = calculateStats();
    if (stats.totalBeers === 0) {
        window.UI.showToast("Pas assez de données pour le Wrapped ! Buvez un coup d'abord. ");
        return;
    }
    renderStory(stats);
}

function renderStory(stats) {
    const slides = [
        {
            bg: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
            content: `
                <div class="story-title animate-pop-in">BEERDEX<br>WRAPPED</div>
                <div class="story-subtitle animate-slide-up" style="animation-delay:0.5s">Votre année en bières</div>
                <div style="font-size:4rem; margin-top:20px;" class="animate-bounce"></div>
            `
        },
        {
            bg: 'linear-gradient(135deg, #2c3e50 0%, #000000 100%)',
            content: `
                <div class="story-stat-label animate-fade-in">Vous avez bu</div>
                <div class="story-big-number animate-scale-up">${stats.totalLiters} <span style="font-size:2rem">Litres</span></div>
                <div class="story-stat-sub animate-slide-up" style="animation-delay:0.3s">Soit environ...</div>
                <div class="story-fun-fact animate-pop-in" style="animation-delay:0.6s">${stats.equivalence.label}</div>
            `
        },
        stats.favoriteBeer ? {
            bg: 'linear-gradient(135deg, #4b1d1d 0%, #1a0505 100%)',
            content: `
                <div class="story-stat-label animate-fade-in">Votre coup de </div>
                ${stats.favoriteBeer.image ? `<img src="${stats.favoriteBeer.image}" class="story-beer-img animate-rotate-in">` : '<div style="font-size:5rem"></div>'}
                <div class="story-beer-name animate-slide-up">${stats.favoriteBeer.name}</div>
                <div class="story-stat-sub">Bue ${stats.favoriteBeer.count} fois</div>
            `
        } : null,
        {
            bg: 'linear-gradient(135deg, #5D4037 0%, #3E2723 100%)',
            content: `
                <div class="story-stat-label animate-fade-in">Votre style préféré</div>
                <div class="story-big-text animate-pop-in" style="color:var(--accent-gold);">${stats.favoriteStyle}</div>
                <div class="story-stat-sub animate-slide-up">Vous avez du goût !</div>
            `
        },
        {
            bg: 'linear-gradient(135deg, #000000 0%, #111 100%)',
            content: `
                <div class="story-title animate-pop-in">Merci !</div>
                <div class="story-stat-sub" style="margin-top:20px;">À la vôtre </div>
                <button id="btn-share-wrapped" class="btn-primary animate-slide-up" style="margin-top:40px; background:var(--accent-gold); color:black;">Partager</button>
            `
        }
    ].filter(s => s !== null);

    const overlay = document.createElement('div');
    overlay.className = 'story-overlay';

    let progressHTML = '<div class="story-progress-container">';
    slides.forEach(() => {
        progressHTML += '<div class="story-progress-bar"><div class="story-progress-fill"></div></div>';
    });
    progressHTML += '</div>';

    overlay.innerHTML = `
        ${progressHTML}
        <button class="story-close-btn">&times;</button>
        <div class="story-content"></div>
        <div class="story-tap-left"></div>
        <div class="story-tap-right"></div>
    `;

    document.body.appendChild(overlay);

    let currentSlide = 0;
    const contentDiv = overlay.querySelector('.story-content');
    const progressFills = overlay.querySelectorAll('.story-progress-fill');
    let timer = null;

    const showSlide = (index) => {
        if (index >= slides.length) {
            close();
            return;
        }
        if (index < 0) index = 0;

        currentSlide = index;
        const slide = slides[currentSlide];

        overlay.style.background = slide.bg;
        contentDiv.innerHTML = slide.content;

        progressFills.forEach((fill, i) => {
            if (i < currentSlide) fill.style.width = '100%';
            else if (i > currentSlide) fill.style.width = '0%';
            else {
                fill.style.width = '0%';
                void fill.offsetWidth;
                fill.style.transition = 'width 5s linear';
                fill.style.width = '100%';
            }
        });

        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            showSlide(currentSlide + 1);
        }, 5000);

        const shareBtn = contentDiv.querySelector('#btn-share-wrapped');
        if (shareBtn) {
            shareBtn.onclick = (e) => {
                e.stopPropagation();
                if (timer) clearTimeout(timer);
                handleWrappedShare(stats);
            };
        }
    };

    const close = () => {
        if (timer) clearTimeout(timer);
        overlay.classList.add('fade-out');
        setTimeout(() => overlay.remove(), 300);
    };

    overlay.querySelector('.story-tap-left').onclick = (e) => { e.stopPropagation(); showSlide(currentSlide - 1); };
    overlay.querySelector('.story-tap-right').onclick = (e) => { e.stopPropagation(); showSlide(currentSlide + 1); };
    overlay.querySelector('.story-close-btn').onclick = close;

    requestAnimationFrame(() => showSlide(0));
}

function handleWrappedShare(stats) {
    if (confirm("Télécharger le résumé en image ?")) {
         const baseUrl = window.location.origin + window.location.pathname;
         const params = new URLSearchParams({
             action: 'share',
             score: 'J ai bu ' + stats.totalLiters + 'L cette annee !',
             comment: 'Top: ' + (stats.favoriteBeer ? stats.favoriteBeer.name : 'Aucune') + ' (' + (stats.favoriteBeer ? stats.favoriteBeer.count : 0) + ') - ' + stats.favoriteStyle,
             fallback: 'true',
             id: stats.favoriteBeer ? stats.favoriteBeer.id : '1'
         });
         
         const link = baseUrl + '?' + params.toString();
         prompt("Copiez ce lien pour partager vos stats :", link);
    }
}
