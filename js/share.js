/**
 * share.js
 * Logic for generating "Insta-ready" images via Canvas
 */

// Load branding assets
const LOGO_PATH = "icons/logo-bnr.png";
const FOAM_PATH = "images/foam.png";

/**
 * Generates a "Polaroid style" image for a specific beer review
 * @param {Object} beer - The beer object
 * @param {number} rating - User rating (0-20)
 * @param {string} comment - User comment
 * @returns {Promise<Blob>} - The image blob
 */
export async function generateBeerCard(beer, rating, comment) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // High Res Canvas for mobile
    const width = 1080;
    const height = 1920; // Story format 9:16
    canvas.width = width;
    canvas.height = height;

    // --- 1. Background ---
    // Extract a dominant color or use a default gradient based on type
    const colorMap = {
        'Blonde': ['#FDC830', '#F37335'],
        'Brune': ['#3E5151', '#DECBA4'],
        'Ambrée': ['#d53369', '#daae51'],
        'Rouge': ['#cb2d3e', '#ef473a'],
        'Blanche': ['#E0EAFC', '#CFDEF3'],
        'Triple': ['#FFC000', '#D4AF37'],
        'Stout': ['#000000', '#434343'],
        'IPA': ['#56ab2f', '#a8e063']
    };

    // Normalize type for lookup
    let typeKey = 'Blonde';
    if (beer.type) {
        Object.keys(colorMap).forEach(k => {
            if (beer.type.includes(k)) typeKey = k;
        });
    }

    let gradientColors = colorMap[typeKey] || ['#141E30', '#243B55'];

    const grd = ctx.createLinearGradient(0, 0, width, height);
    grd.addColorStop(0, gradientColors[0]);
    grd.addColorStop(1, gradientColors[1]);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, width, height);

    // Overlay Pattern (Noise/Grain simulation for texture)
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fillRect(0, 0, width, height);

    // --- DECORATION: Bubbles & Glows ---
    ctx.save();
    // 1. Large ambient glows
    const drawGlow = (x, y, r, color) => {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, color);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    };
    drawGlow(0, 0, 800, 'rgba(255,255,255,0.1)');
    drawGlow(width, height, 900, 'rgba(0,0,0,0.2)');

    // 2. Beer Bubbles
    for (let i = 0; i < 40; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const r = Math.random() * 20 + 5;
        const opa = Math.random() * 0.1;

        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${opa})`;
        ctx.fill();

        // Shine on bubble
        ctx.beginPath();
        ctx.arc(x - r / 3, y - r / 3, r / 4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${opa + 0.1})`;
        ctx.fill();
    }

    // 3. Beer Foam (Image)
    try {
        const foamImg = await loadImage(FOAM_PATH);
        // Draw at top, full width, auto height driven by aspect ratio
        const foamH = width * (foamImg.height / foamImg.width);
        ctx.drawImage(foamImg, 0, -5, width, foamH); // -5 to cover very top edge edge cases
    } catch (e) {
        console.warn("Foam image not found, skipping");
    }

    ctx.restore();

    // --- 2. Polaroid / Card Container ---
    const cardMargin = 100;
    const cardY = 250;
    const cardWidth = width - (cardMargin * 2);
    const cardHeight = 1350; // Taller to fit info
    const borderRadius = 40;

    drawRoundedRect(ctx, cardMargin, cardY, cardWidth, cardHeight, borderRadius, '#1a1a1a');

    // Shadow for card
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 50;
    ctx.shadowOffsetY = 20;

    // --- 3. Content ---

    // Beer Image
    try {
        const img = await loadImage(beer.image);
        const imgH = 600;
        const imgW = 400; // Constrain width

        ctx.save();
        // Glow behind image
        ctx.shadowColor = "rgba(255,192,0,0.3)";
        ctx.shadowBlur = 40;
        drawImageProp(ctx, img, 0, 0, img.width, img.height, (width / 2) - (imgW / 2), cardY + 60, imgW, imgH);
        ctx.restore();
    } catch (e) {
        // Fallback Icon
        ctx.font = '300px serif';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText('🍺', width / 2, cardY + 400);
    }

    // Reset Shadow
    ctx.shadowColor = "transparent";

    // Text Content
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';

    // Beer Name (Use beer.title !!)
    let displayTitle = beer.title || beer.name || "Bière Inconnue";
    ctx.font = 'bold 70px "Russo One", sans-serif';
    fitText(ctx, displayTitle, width / 2, cardY + 720, cardWidth - 60, 70);

    // Brewery
    ctx.font = 'italic 35px "Outfit", sans-serif';
    ctx.fillStyle = '#AAAAAA';
    ctx.fillText((beer.brewery || "Brasserie Inconnue").toUpperCase(), width / 2, cardY + 770);

    // --- BADGES (Type, Alc, Vol) ---
    const badgesY = cardY + 850;
    const badgeGap = 30;

    const infoItems = [
        { text: beer.type || '?', icon: '' },
        { text: beer.alcohol || '?', icon: '' },
        { text: beer.volume || '?', icon: '' }
    ];

    let totalWidth = 0;
    // Pre-calc width not easily possible with different text lengths without complex logic.
    // Instead, we center 3 fixed-width pills or flow them.

    const pillW = 220;
    const pillH = 100;
    const startX = (width - (pillW * 3 + badgeGap * 2)) / 2;

    infoItems.forEach((item, i) => {
        const x = startX + i * (pillW + badgeGap);
        drawRoundedRect(ctx, x, badgesY, pillW, pillH, 50, 'rgba(255,255,255,0.05)');
        // Border
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.stroke();

        ctx.fillStyle = '#FFC000';
        ctx.font = 'bold 35px "Outfit", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(item.text, x + (pillW / 2), badgesY + 65);
    });


    // Rating Stars
    const score = rating || 0;
    const starStr = "★".repeat(Math.round(score / 4)); // Max 5 stars
    const voidStr = "☆".repeat(5 - Math.round(score / 4));

    // Draw Stars
    ctx.font = '80px "Outfit", sans-serif';
    ctx.fillStyle = '#FFC000'; // Gold
    ctx.textAlign = 'center';
    ctx.fillText(starStr + voidStr, width / 2, cardY + 1080);

    // Score Number
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 40px "Outfit", sans-serif';
    ctx.fillText(`${score}/20`, width / 2, cardY + 1140);


    // Comment (if any)
    if (comment) {
        ctx.font = 'italic 30px "Outfit", serif';
        ctx.fillStyle = '#DDDDDD';
        wrapText(ctx, `"${comment}"`, width / 2, cardY + 1220, cardWidth - 100, 40);
    }

    // --- 4. Branding (Logo & Footer) ---
    const footerY = height - 280;

    // Logo
    try {
        const logo = await loadImage(LOGO_PATH);
        const logoW = 150; // Smaller branding to avoid overlap
        const logoH = logoW * (logo.height / logo.width);
        // Position logo centered between card (1600) and footer (approx 1800)
        // Card ends at 1600. Footer text starts around 1820-font_height.
        const logoY = 1610;

        drawImageProp(ctx, logo, 0, 0, logo.width, logo.height, (width / 2) - (logoW / 2), logoY, logoW, logoH);

    } catch (e) {
        // Fallback text
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 60px "Russo One", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText("BEERDEX", width / 2, footerY - 50);
    }

    // Website URL
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 40px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText("beerdex.dualsfwshield.be", width / 2, height - 100);

    // Tagline (FR)
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = 'italic 30px "Outfit", sans-serif';
    ctx.fillText("Disponible sur Android et iOS", width / 2, height - 50);


    // --- Export ---
    return new Promise(resolve => {
        canvas.toBlob(blob => {
            resolve(blob);
        }, 'image/png', 0.95);
    });
}

/**
 * Native Web Share API wrapper
 */
export async function shareImage(blob, title) {
    // --- MEDIAN / GONATIVE BRIDGE (APK) ---
    // User requested Fullscreen Preview for APK to allow Screenshot
    if (window.median) {
        createFullscreenPreview(blob);
        return;
    }

    // --- GENERIC WEB / DESKTOP ---
    // User requested "Classic Download" restored
    // Try download first.
    try {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `beerdex-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (e) {
        console.error("Download failed, trying preview", e);
        createFullscreenPreview(blob);
    }
}

function createFullscreenPreview(blob) {
    const url = URL.createObjectURL(blob);
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.background = '#000';
    overlay.style.zIndex = '20000';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';

    // Image
    const img = document.createElement('img');
    img.src = url;
    img.style.maxWidth = '100%';
    img.style.maxHeight = '90%';
    img.style.objectFit = 'contain';

    // Close Hint
    const hint = document.createElement('div');
    hint.innerText = "Appuyez pour fermer";
    hint.style.color = '#fff';
    hint.style.marginTop = '20px';
    hint.style.fontFamily = 'sans-serif';
    hint.style.opacity = '0.7';

    overlay.appendChild(img);
    overlay.appendChild(hint);

    // Close Handler
    overlay.onclick = () => {
        document.body.removeChild(overlay);
        URL.revokeObjectURL(url);
    };

    document.body.appendChild(overlay);
}

// --- Helpers ---

function drawRoundedRect(ctx, x, y, width, height, radius, fill) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        // Important for local files or CORS
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

/**
 * Scale image like object-fit: contain
 */
function drawImageProp(ctx, img, x, y, w, h, offsetX, offsetY, containerW, containerH) {
    // Calculate aspect ratio
    const r = Math.min(containerW / w, containerH / h);
    const nw = w * r;
    const nh = h * r;
    const cx = (containerW - nw) / 2;
    const cy = (containerH - nh) / 2;
    ctx.drawImage(img, x, y, w, h, offsetX + cx, offsetY + cy, nw, nh);
}

function fitText(ctx, text, x, y, maxWidth, initialFontSize) {
    let fontSize = initialFontSize;
    ctx.font = `bold ${fontSize}px "Russo One", sans-serif`;
    while (ctx.measureText(text).width > maxWidth && fontSize > 20) {
        fontSize -= 2;
        ctx.font = `bold ${fontSize}px "Russo One", sans-serif`;
    }
    ctx.fillText(text, x, y);
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';

    for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;
        if (testWidth > maxWidth && n > 0) {
            ctx.fillText(line, x, y);
            line = words[n] + ' ';
            y += lineHeight;
        } else {
            line = testLine;
        }
    }
    ctx.fillText(line, x, y);
}
