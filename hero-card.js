// =====================================================
// hero-card.js — la carte de héros à partager
//
// Un bouton, une image : le portrait dans son cadre, le nom, la classe, le
// niveau, les caractéristiques, l'arme fétiche. Tout est dessiné dans un
// <canvas>, sur l'appareil — aucun serveur, aucune requête. L'image sort en
// 2160 × 2700 : le format portrait 4:5 qui passe partout (Discord, Instagram,
// WhatsApp), en double définition pour rester nette sur un écran de téléphone
// comme à l'impression. En JPEG (moins d'1 Mo) : en PNG, les dégradés et le
// grain pesaient plus de 9 Mo, au ras de la limite d'envoi de Discord.
//
// La carte se nourrit de la fiche OUVERTE : identité et combat se lisent dans
// le DOM, et les armes arrivent déjà calculées par window.HeroCardArmes(),
// exposé depuis le module armes de script.js — le toucher et les dégâts
// affichés sont donc exactement ceux que la fiche joue.
//
// Le cadre de portrait choisi dans « Apparence » s'applique à la carte : c'est
// ce qui fait de chaque image partagée une vitrine des cadres.
//
// Nuit et Parchemin sont offerts ; les autres styles se DÉBLOQUENT par des
// exploits (exploits.js), une fois pour tous les personnages du joueur :
// Légende (trois 20 naturels d'affilée), Maudit (trois 1). Un héros de niveau
// 20 porte en plus le ruban « Héros épique », quel que soit le style.
// =====================================================
(function () {
    'use strict';

    // La mise en page se pense en 1080 × 1350 ; le canvas compte deux fois plus
    // de pixels dans chaque sens (setTransform au début du dessin). Seul le flou
    // des ombres échappe à la transformation du contexte : il passe par flou().
    const W = 1080, H = 1350, M = 80;
    const ECHELLE = 2;
    const flou = (n) => n * ECHELLE;
    const CINZEL = 'Cinzel, Georgia, serif';
    const LORA = 'Lora, Georgia, serif';

    const $ = (id) => document.getElementById(id);
    const valeur = (id) => { const e = $(id); return e && e.value != null ? String(e.value).trim() : ''; };
    const idPerso = () => { try { return localStorage.getItem('dnd-active-char') || ''; } catch (e) { return ''; } };
    const lire = (k) => { try { return localStorage.getItem(idPerso() + '_' + k); } catch (e) { return null; } };
    const noter = (k, v) => { try { localStorage.setItem(idPerso() + '_' + k, v); } catch (e) {} };
    const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const toast = (m) => { if (window.showAppToast) window.showAppToast(m); };
    // Le vrai signe moins typographique : sur une image, le trait d'union fait cheap.
    const signe = (n) => (n >= 0 ? '+' : '−') + Math.abs(n);

    function bonus(v) {
        const s = String(v == null ? '' : v).trim();
        if (!s) return '';
        if (/^[+−-]/.test(s)) return s.replace('-', '−');
        const n = parseInt(s, 10);
        return isNaN(n) ? s : signe(n);
    }
    const metres = (v) => { const s = String(v || '').trim(); return /^\d+([.,]\d+)?$/.test(s) ? s + ' m' : s; };

    // =====================================================
    // LES STYLES — offerts, ou gagnés par un exploit (exploits.js)
    // =====================================================
    const STYLES = [
        { id: 'nuit', nom: '🌙 Nuit' },
        { id: 'parchemin', nom: '📜 Parchemin' },
        { id: 'legende', nom: '👑 Légende', exploit: 'triple20', entete: 'ÉLU DES DIEUX', sceau: 'Trois 20 naturels d’affilée', indice: 'Les dieux aiment les séries.' },
        { id: 'maudit', nom: '☠️ Maudit', exploit: 'triple1', entete: 'MAUDIT PAR LES DÉS', sceau: 'Trois 1 naturels d’affilée', indice: 'Les dés, eux aussi, savent haïr.' }
    ];
    const styleParId = (id) => STYLES.find(x => x.id === id) || STYLES[0];
    const exploitDe = (st) => (st.exploit && window.Exploits ? window.Exploits.info(st.exploit) : null);
    const disponible = (st) => !st.exploit || !!exploitDe(st);
    /**
     * hero-card-styles.js déclare ici ses styles. Un style porte : id, nom, exploit,
     * indice, entete, sceau, palette { nuit, fondA, fondB, or, encre, primaire },
     * et des crochets de dessin facultatifs, qui reçoivent (ctx, T) — T étant la
     * boîte à outils de la carte : fond, cadre, portrait, anneau, nomDuHeros, devant.
     */
    function ajouterStyles(liste) {
        (liste || []).forEach(x => { if (x && x.id && !STYLES.some(y => y.id === x.id)) STYLES.push(x); });
    }

    // =====================================================
    // COULEURS — tirées du thème actif, pour que la carte ressemble à SA fiche
    // =====================================================
    function versRgb(c, repli) {
        const s = String(c || '').trim();
        let m = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
        if (m) {
            let h = m[1];
            if (h.length === 3) h = h.split('').map(x => x + x).join('');
            return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16));
        }
        m = s.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
        if (m) return [m[1], m[2], m[3]].map(Number);
        return repli;
    }
    const css = (rgb, a) => `rgba(${rgb.map(Math.round).join(',')},${a == null ? 1 : a})`;
    const melange = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

    function palette(style) {
        const cs = getComputedStyle(document.documentElement);
        const primaire = versRgb(cs.getPropertyValue('--primary-color'), [107, 36, 54]);
        const or = versRgb(cs.getPropertyValue('--accent-color'), [196, 155, 53]);
        const decrit = STYLES.find(x => x.id === style);
        if (decrit && decrit.palette) {
            const x = decrit.palette, clair = x.nuit === false;
            return {
                nuit: !clair, primaire: x.primaire || x.or, or: x.or, encre: x.encre, fondA: x.fondA, fondB: x.fondB,
                carte: x.carte || (clair ? css([255, 250, 238], 0.5) : css(x.or, 0.06)),
                trait: x.trait || (clair ? css(x.encre, 0.22) : css(x.or, 0.28))
            };
        }
        if (style === 'legende') {
            // Hors thème, volontairement : une Légende se reconnaît d'une fiche à l'autre.
            const orL = [232, 193, 106];
            return {
                nuit: true, legende: true, primaire: [96, 64, 20], or: orL, encre: [250, 241, 220],
                fondA: [44, 31, 13], fondB: [6, 5, 4],
                carte: css(orL, 0.06), trait: css(orL, 0.3)
            };
        }
        if (style === 'maudit') {
            // Vert venin sur noir de marais : lui aussi se reconnaît d'une fiche à l'autre.
            const venin = [150, 205, 92];
            return {
                nuit: true, maudit: true, primaire: [44, 72, 34], or: venin, encre: [228, 234, 214],
                fondA: [24, 34, 22], fondB: [4, 7, 5],
                carte: css(venin, 0.05), trait: css(venin, 0.26)
            };
        }
        if (style === 'parchemin') {
            return {
                nuit: false, primaire, or: melange(or, [90, 60, 20], 0.25), encre: [43, 29, 20],
                fondA: [247, 237, 214], fondB: [212, 188, 144],
                carte: css([255, 250, 238], 0.55), trait: css([43, 29, 20], 0.2)
            };
        }
        return {
            nuit: true, primaire, or, encre: [243, 232, 210],
            fondA: melange(primaire, [0, 0, 0], 0.55), fondB: [12, 9, 9],
            carte: css([255, 255, 255], 0.05), trait: css([243, 232, 210], 0.15)
        };
    }

    // =====================================================
    // OUTILS DE DESSIN
    // =====================================================
    function rrect(ctx, x, y, w, h, r) {
        r = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }
    function halo(ctx, x, y, r, couleur) {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, couleur); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    function losange(ctx, x, y, r, couleur) {
        ctx.save(); ctx.fillStyle = couleur;
        ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); ctx.fill();
        ctx.restore();
    }
    function etoile(ctx, x, y, r, couleur) {
        ctx.save(); ctx.fillStyle = couleur; ctx.shadowColor = couleur; ctx.shadowBlur = flou(r * 2);
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
            const a = (Math.PI / 4) * i, rr = i % 2 ? r * 0.28 : r;
            ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
        ctx.closePath(); ctx.fill(); ctx.restore();
    }
    function feuille(ctx, x, y, longueur, angle, couleur) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.fillStyle = couleur;
        ctx.beginPath(); ctx.ellipse(0, 0, longueur, longueur * 0.42, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    // Texte espacé, lettre par lettre : `ctx.letterSpacing` n'existe pas partout.
    function largeurEspacee(ctx, txt, esp) {
        const car = [...txt];
        return car.reduce((s, c) => s + ctx.measureText(c).width, 0) + esp * (car.length - 1);
    }
    function texteEspace(ctx, txt, x, y, esp, centre) {
        const aligne = ctx.textAlign;
        let cx = centre ? x - largeurEspacee(ctx, txt, esp) / 2 : x;
        ctx.textAlign = 'left';
        [...txt].forEach(c => { ctx.fillText(c, cx, y); cx += ctx.measureText(c).width + esp; });
        ctx.textAlign = aligne;
    }
    /** La plus grande taille de police qui fait tenir le texte dans la largeur. */
    function ajuster(ctx, txt, poids, famille, max, min, largeur) {
        let t = max;
        for (; t > min; t -= 2) {
            ctx.font = `${poids} ${t}px ${famille}`;
            if (ctx.measureText(txt).width <= largeur) break;
        }
        return t;
    }
    /** Coupe en lignes, au plus `max` ; la dernière reçoit « … » si ça déborde. */
    function couper(ctx, texte, largeur, max) {
        const mots = texte.split(/\s+/).filter(Boolean);
        const lignes = [];
        let ligne = '';
        for (let i = 0; i < mots.length; i++) {
            const essai = ligne ? ligne + ' ' + mots[i] : mots[i];
            if (ctx.measureText(essai).width <= largeur || !ligne) { ligne = essai; continue; }
            lignes.push(ligne);
            ligne = mots[i];
            if (lignes.length === max) {
                let der = lignes[max - 1];
                while (der && ctx.measureText(der + '…').width > largeur) der = der.slice(0, -1);
                lignes[max - 1] = der.trimEnd() + '…';
                return lignes;
            }
        }
        if (ligne) lignes.push(ligne);
        return lignes.slice(0, max);
    }

    // Graine tirée du nom : le même héros garde la même constellation de
    // poussières d'une image à l'autre.
    function graine(texte) {
        let h = 1779033703 ^ texte.length;
        for (let i = 0; i < texte.length; i++) { h = Math.imul(h ^ texte.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
        return () => {
            h = Math.imul(h ^ (h >>> 16), 2246822507);
            h = Math.imul(h ^ (h >>> 13), 3266489909);
            return ((h ^= h >>> 16) >>> 0) / 4294967296;
        };
    }

    let grainCanvas = null;
    function motifGrain(ctx) {
        // Le grain se tisse au pixel réel de l'image : un motif agrandi par la
        // transformation du contexte donnerait des grains doubles, grossiers.
        const T = 160 * ECHELLE;
        if (!grainCanvas) {
            grainCanvas = document.createElement('canvas');
            grainCanvas.width = grainCanvas.height = T;
            const g = grainCanvas.getContext('2d');
            const img = g.createImageData(T, T);
            for (let i = 0; i < img.data.length; i += 4) {
                const v = Math.random() * 255;
                img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
                img.data[i + 3] = 255;
            }
            g.putImageData(img, 0, 0);
        }
        const motif = ctx.createPattern(grainCanvas, 'repeat');
        if (motif && motif.setTransform && window.DOMMatrix) motif.setTransform(new DOMMatrix([1 / ECHELLE, 0, 0, 1 / ECHELLE, 0, 0]));
        return motif;
    }

    // =====================================================
    // CADRES — le même vocabulaire que les cadres de portrait de la boutique
    // =====================================================
    const VERT = [74, 124, 82];

    function coin(ctx, x, y, sx, sy, p, style) {
        ctx.save(); ctx.translate(x, y); ctx.scale(sx, sy);
        const c = style === 'feuilles' ? css(VERT) : css(p.or);
        ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(96, 0); ctx.moveTo(0, 22); ctx.lineTo(0, 96); ctx.stroke();
        ctx.beginPath(); ctx.arc(22, 22, 14, Math.PI, Math.PI * 1.5); ctx.stroke();
        losange(ctx, 0, 0, 7, c);
        [[104, 0], [0, 104]].forEach(([a, b]) => { ctx.beginPath(); ctx.arc(a, b, 3, 0, Math.PI * 2); ctx.fill(); });
        if (style === 'feuilles') { feuille(ctx, 42, 40, 15, Math.PI / 4, css(VERT, 0.85)); feuille(ctx, 62, 18, 9, Math.PI / 9, css(VERT, 0.7)); }
        if (style === 'runes') {
            ctx.lineWidth = 2.2;
            ctx.beginPath(); ctx.moveTo(34, 44); ctx.lineTo(34, 72); ctx.moveTo(34, 52); ctx.lineTo(46, 44); ctx.moveTo(34, 61); ctx.lineTo(46, 53); ctx.stroke();
        }
        ctx.restore();
    }

    function cadre(ctx, p, style) {
        ctx.save();
        ctx.strokeStyle = style === 'oxblood' ? css(p.primaire) : style === 'feuilles' ? css(VERT) : css(p.or);
        ctx.lineWidth = style === 'laiton' ? 9 : style === 'oxblood' ? 7 : 4;
        rrect(ctx, 30, 30, W - 60, H - 60, 28); ctx.stroke();
        if (style === 'laiton') { ctx.lineWidth = 2; ctx.strokeStyle = css(p.or, 0.35); rrect(ctx, 40, 40, W - 80, H - 80, 24); ctx.stroke(); }
        ctx.lineWidth = 1.6; ctx.strokeStyle = css(p.or, 0.5);
        if (style === 'runes') ctx.setLineDash([18, 10]);
        rrect(ctx, 48, 48, W - 96, H - 96, 20); ctx.stroke();
        ctx.restore();
        [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([sx, sy]) =>
            coin(ctx, sx < 0 ? W - 64 : 64, sy < 0 ? H - 64 : 64, sx, sy, p, style));
    }

    function anneau(ctx, x, y, r, p, style) {
        const cercle = (w, c, rr, tirets) => {
            ctx.save(); ctx.lineWidth = w; ctx.strokeStyle = c;
            if (tirets) ctx.setLineDash(tirets);
            ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        };
        if (style === 'oxblood') { cercle(9, css(p.primaire), r + 4); cercle(3, css(p.or, 0.6), r + 12); }
        else if (style === 'runes') {
            cercle(4, css(p.or), r + 3); cercle(2.5, css(p.or, 0.7), r + 16, [14, 9]);
            ctx.save(); ctx.strokeStyle = css(p.or, 0.85); ctx.lineWidth = 2.2;
            for (let i = 0; i < 12; i++) {
                const a = (Math.PI * 2 * i) / 12 - Math.PI / 2;
                ctx.save(); ctx.translate(x + Math.cos(a) * (r + 32), y + Math.sin(a) * (r + 32)); ctx.rotate(a + Math.PI / 2);
                ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(0, 8);
                if (i % 3 === 0) { ctx.moveTo(0, -3); ctx.lineTo(6, -8); } else if (i % 3 === 1) { ctx.moveTo(-5, 0); ctx.lineTo(5, -6); } else { ctx.moveTo(0, 2); ctx.lineTo(-6, -4); }
                ctx.stroke(); ctx.restore();
            }
            ctx.restore();
        }
        else if (style === 'feuilles') {
            cercle(4, css(VERT), r + 3); cercle(2, css(VERT, 0.8), r + 17, [2, 7]);
            for (let i = 0; i < 8; i++) {
                const a = (Math.PI * 2 * i) / 8 + Math.PI / 8;
                feuille(ctx, x + Math.cos(a) * (r + 26), y + Math.sin(a) * (r + 26), 13, a + Math.PI / 2.4, css(VERT, 0.8));
            }
        }
        else if (style === 'laiton') { cercle(10, css(p.or), r + 5); cercle(3, 'rgba(0,0,0,.35)', r + 12); cercle(2, css(p.or, 0.5), r + 18); }
        else { cercle(5, css(p.or), r + 3); cercle(1.5, css(p.or, 0.45), r + 13); }
    }

    function couvrir(ctx, img, cx, cy, r) {
        const s = Math.max((2 * r) / img.width, (2 * r) / img.height);
        const w = img.width * s, h = img.height * s;
        ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
    }

    // =====================================================
    // LÉGENDE — le style secret des trois 20 naturels
    // =====================================================
    /** Un dégradé d'or battu : sombre, éclat, sombre. */
    function dorure(ctx, x0, y0, x1, y1) {
        const g = ctx.createLinearGradient(x0, y0, x1, y1);
        g.addColorStop(0, '#8a6420'); g.addColorStop(0.28, '#f3d27a'); g.addColorStop(0.46, '#fff4cc');
        g.addColorStop(0.64, '#c8962f'); g.addColorStop(0.82, '#f0cd72'); g.addColorStop(1, '#8a6420');
        return g;
    }

    /** Une gloire : des rayons d'or qui partent du portrait et s'éteignent en chemin. */
    function rayons(ctx, x, y, p) {
        const R = 900;
        const g = ctx.createRadialGradient(x, y, 30, x, y, R);
        g.addColorStop(0, css(p.or, 1)); g.addColorStop(0.55, css(p.or, 0.25)); g.addColorStop(1, css(p.or, 0));
        ctx.save();
        ctx.fillStyle = g;
        for (let i = 0; i < 44; i++) {
            const a = (Math.PI * 2 * i) / 44, demi = i % 2 ? 0.01 : 0.026;
            ctx.globalAlpha = i % 2 ? 0.08 : 0.15;
            ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, R, a - demi, a + demi); ctx.closePath(); ctx.fill();
        }
        ctx.restore();
    }

    function cadreLegende(ctx, p) {
        ctx.save();
        ctx.lineWidth = 8; ctx.strokeStyle = dorure(ctx, 0, 0, W, H);
        rrect(ctx, 30, 30, W - 60, H - 60, 28); ctx.stroke();
        ctx.lineWidth = 2; ctx.strokeStyle = css(p.or, 0.5);
        rrect(ctx, 46, 46, W - 92, H - 92, 22); ctx.stroke();
        ctx.lineWidth = 1; ctx.strokeStyle = css(p.or, 0.25);
        rrect(ctx, 56, 56, W - 112, H - 112, 18); ctx.stroke();
        ctx.restore();
        // Une agrafe étoilée posée sur chaque arrondi du cadre
        [[38, 38], [W - 38, 38], [38, H - 38], [W - 38, H - 38]].forEach(([x, y]) => {
            etoile(ctx, x, y, 18, css([255, 240, 196]));
            losange(ctx, x, y, 5, css(p.or));
        });
    }

    /** Deux branches de laurier autour du portrait, ouvertes en bas pour laisser respirer le nom. */
    function laurier(ctx, x, y, R, p) {
        const debut = 52 * Math.PI / 180, fin = -50 * Math.PI / 180, N = 10;
        ctx.save();
        ctx.lineCap = 'round';
        [1, -1].forEach(cote => {
            const pt = (a) => [x + cote * Math.cos(a) * R, y + Math.sin(a) * R];
            ctx.strokeStyle = css(p.or, 0.7); ctx.lineWidth = 2.4;
            ctx.beginPath();
            for (let i = 0; i <= 48; i++) { const [px, py] = pt(debut + (fin - debut) * i / 48); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
            ctx.stroke();
            // Les feuilles, par paires, de plus en plus petites vers la pointe
            for (let i = 0; i <= N; i++) {
                const t = i / N, a = debut + (fin - debut) * t;
                const [bx, by] = pt(a);
                const pousse = Math.atan2(-Math.cos(a), cote * Math.sin(a));
                const taille = 20 - t * 8;
                (i === N ? [0] : [1, -1]).forEach(s => {
                    const ang = pousse + s * cote * 0.6;
                    ctx.save();
                    ctx.translate(bx + Math.cos(ang) * taille * 0.9, by + Math.sin(ang) * taille * 0.9);
                    ctx.rotate(ang);
                    ctx.fillStyle = s >= 0 ? dorure(ctx, -taille, 0, taille, 0) : css(p.or, 0.82);
                    ctx.beginPath(); ctx.ellipse(0, 0, taille, taille * 0.38, 0, 0, Math.PI * 2); ctx.fill();
                    ctx.restore();
                });
            }
        });
        ctx.restore();
    }

    function anneauLegende(ctx, x, y, r, p) {
        ctx.save();
        ctx.lineWidth = 9; ctx.strokeStyle = dorure(ctx, x - r, y - r, x + r, y + r);
        ctx.beginPath(); ctx.arc(x, y, r + 5, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 1.8; ctx.strokeStyle = css(p.or, 0.55);
        ctx.beginPath(); ctx.arc(x, y, r + 17, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        laurier(ctx, x, y, r + 50, p);
        etoile(ctx, x, y - r - 17, 12, css([255, 244, 205]));
    }

    // =====================================================
    // MAUDIT — le style secret des trois 1 naturels
    // =====================================================
    /** Des fissures qui partent des bords et se ramifient. */
    function fissures(ctx, alea) {
        const trace = (x, y, angle, longueur, epaisseur, profondeur) => {
            const pts = [[x, y]];
            let a = angle, fait = 0;
            while (fait < longueur) {
                const pas = 14 + alea() * 26;
                a += (alea() - 0.5) * 0.9;
                x += Math.cos(a) * pas; y += Math.sin(a) * pas; fait += pas;
                pts.push([x, y]);
                if (profondeur > 0 && alea() < 0.16) trace(x, y, a + (alea() < 0.5 ? -1 : 1) * (0.5 + alea() * 0.6), longueur * 0.35, epaisseur * 0.6, profondeur - 1);
            }
            [['rgba(0,0,0,.6)', epaisseur + 1.5, 0], ['rgba(150,205,92,.28)', Math.max(0.8, epaisseur * 0.45), 1.2]].forEach(([c, l, dx]) => {
                ctx.strokeStyle = c; ctx.lineWidth = l;
                ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px + dx, py + dx) : ctx.moveTo(px + dx, py + dx))); ctx.stroke();
            });
        };
        ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        [[0, 0.1, 0.5], [1, 0.08, 2.5], [0, 0.72, -0.3], [1, 0.86, 3.5], [0.22, 1, -1.3]]
            .forEach(([fx, fy, a]) => trace(fx * W, fy * H, a, 260 + alea() * 260, 3, 2));
        ctx.restore();
    }

    function cadreMaudit(ctx, p, alea) {
        ctx.save();
        ctx.strokeStyle = css(p.or, 0.85); ctx.lineWidth = 5;
        ctx.setLineDash([180, 14, 60, 22, 240, 10, 90, 30]);
        rrect(ctx, 30, 30, W - 60, H - 60, 28); ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineWidth = 1.4; ctx.strokeStyle = css(p.or, 0.35);
        rrect(ctx, 48, 48, W - 96, H - 96, 20); ctx.stroke();
        // Le venin suinte du haut du cadre, de part et d'autre du titre
        for (let i = 0; i < 8; i++) {
            const x = i % 2 ? W - 90 - alea() * 200 : 90 + alea() * 200;
            const long = 16 + alea() * 58, r = 3.5 + alea() * 3.5, bas = 32 + long;
            ctx.strokeStyle = css(p.or, 0.75); ctx.lineWidth = r * 0.7;
            ctx.beginPath(); ctx.moveTo(x, 32); ctx.lineTo(x, bas); ctx.stroke();
            ctx.fillStyle = css(p.or, 0.9); ctx.shadowColor = css(p.or, 0.8); ctx.shadowBlur = flou(10);
            ctx.beginPath(); ctx.moveTo(x - r, bas); ctx.quadraticCurveTo(x, bas - r * 2.6, x + r, bas); ctx.arc(x, bas, r, 0, Math.PI); ctx.fill();
            ctx.shadowBlur = 0;
        }
        ctx.restore();
    }

    function anneauMaudit(ctx, x, y, r, p, alea) {
        ctx.save();
        ctx.strokeStyle = css(p.or); ctx.lineWidth = 6; ctx.shadowColor = css(p.or, 0.6); ctx.shadowBlur = flou(16);
        // Un anneau brisé : quatre arcs, quatre éclats manquants
        for (let i = 0; i < 4; i++) {
            const a0 = i * Math.PI / 2 + 0.16 + alea() * 0.1, a1 = (i + 1) * Math.PI / 2 - 0.05 - alea() * 0.12;
            ctx.beginPath(); ctx.arc(x, y, r + 4, a0, a1); ctx.stroke();
        }
        ctx.shadowBlur = 0;
        ctx.lineWidth = 1.6; ctx.strokeStyle = css(p.or, 0.45); ctx.setLineDash([4, 9]);
        ctx.beginPath(); ctx.arc(x, y, r + 18, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        // Des éclats qui fendent le bord du portrait
        ctx.strokeStyle = 'rgba(0,0,0,.65)'; ctx.lineWidth = 2.2;
        for (let i = 0; i < 5; i++) {
            const a = alea() * Math.PI * 2;
            let px = x + Math.cos(a) * (r - 6), py = y + Math.sin(a) * (r - 6);
            ctx.beginPath(); ctx.moveTo(px, py);
            for (let k = 0; k < 3; k++) { px += Math.cos(a + Math.PI + (alea() - 0.5)) * 12; py += Math.sin(a + Math.PI + (alea() - 0.5)) * 12; ctx.lineTo(px, py); }
            ctx.stroke();
        }
        ctx.restore();
    }

    /** Le portrait prend la teinte du venin, comme sous l'effet d'une malédiction. */
    function teinteMaudite(ctx, x, y, r) {
        ctx.save();
        ctx.globalCompositeOperation = 'color';
        ctx.fillStyle = 'rgba(110,170,70,.55)'; ctx.fillRect(x - r, y - r, r * 2, r * 2);
        ctx.globalCompositeOperation = 'multiply';
        const g = ctx.createRadialGradient(x, y, r * 0.35, x, y, r);
        g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(40,60,30,1)');
        ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
        ctx.restore();
    }

    /** Le ruban « Héros épique », noué au pied du portrait d'un héros de niveau 20. */
    function ruban(ctx, x, y, texte, p) {
        ctx.save();
        ctx.font = `700 19px ${CINZEL}`;
        const w = largeurEspacee(ctx, texte, 4) + 60, h = 36;
        ctx.fillStyle = css(melange(p.primaire, [0, 0, 0], 0.45));
        [-1, 1].forEach(sn => {
            const bx = x + sn * (w / 2 - 10);
            ctx.beginPath();
            ctx.moveTo(bx, y - h / 2 + 8); ctx.lineTo(bx + sn * 34, y - h / 2 + 8);
            ctx.lineTo(bx + sn * 22, y + 6); ctx.lineTo(bx + sn * 34, y + h / 2 + 8); ctx.lineTo(bx, y + h / 2 + 8);
            ctx.closePath(); ctx.fill();
        });
        const g = ctx.createLinearGradient(0, y - h / 2, 0, y + h / 2);
        g.addColorStop(0, css(melange(p.primaire, [255, 255, 255], 0.15))); g.addColorStop(1, css(melange(p.primaire, [0, 0, 0], 0.25)));
        ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = flou(12);
        rrect(ctx, x - w / 2, y - h / 2, w, h, 5); ctx.fillStyle = g; ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = css(p.or); ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = css(p.or); ctx.textBaseline = 'middle';
        texteEspace(ctx, texte, x, y + 1, 4, true);
        ctx.restore();
    }

    // =====================================================
    // LES DONNÉES DE LA FICHE
    // =====================================================
    function donnees() {
        const CARACS = [['str', 'FOR'], ['dex', 'DEX'], ['con', 'CON'], ['int', 'INT'], ['wis', 'SAG'], ['cha', 'CHA']];
        const stats = CARACS.map(([k, l]) => {
            const n = parseInt(valeur('stat-' + k), 10);
            const score = isNaN(n) ? 10 : n;
            return { l, score, mod: Math.floor((score - 10) / 2) };
        });
        let armes = [];
        try { armes = typeof window.HeroCardArmes === 'function' ? window.HeroCardArmes() : []; } catch (e) { armes = []; }
        // L'arme fétiche par défaut : épinglée, sinon dégainée, sinon magique,
        // sinon celle qui touche le mieux.
        armes = armes.filter(a => a.nom).sort((a, b) =>
            (b.pinned - a.pinned) || (b.equipped - a.equipped) || (b.magique - a.magique)
            || ((parseInt(String(b.toucher).replace('−', '-'), 10) || -99) - (parseInt(String(a.toucher).replace('−', '-'), 10) || -99)));
        let avatar = null;
        try { avatar = typeof window.HeroCardAvatar === 'function' ? window.HeroCardAvatar() : null; } catch (e) {}
        let cadreChoisi = '';
        try { cadreChoisi = localStorage.getItem('dnd-frame-portrait') || ''; } catch (e) {}
        return {
            nom: valeur('char-name') || 'Héros sans nom',
            classe: valeur('char-class'), sousClasse: valeur('char-subclass'), niveau: valeur('char-level') || '1',
            race: valeur('char-race'), historique: valeur('char-background'),
            stats, ca: valeur('armor-class'), pv: valeur('hp-max'), init: valeur('initiative'),
            vitesse: valeur('speed'), maitrise: valeur('prof-bonus'),
            avatar, cadre: cadreChoisi, armes
        };
    }

    // =====================================================
    // LE DESSIN
    // =====================================================
    function dessiner(cv, d, reg, res) {
        const ctx = cv.getContext('2d');
        ctx.setTransform(ECHELLE, 0, 0, ECHELLE, 0, 0);
        ctx.imageSmoothingEnabled = true;
        if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
        const p = palette(reg.style);
        const st = styleParId(reg.style);
        const sceauInfo = st.sceau ? exploitDe(st) : null;
        const nuit = p.nuit;
        const alea = graine(d.nom + '|' + d.classe);
        const PX = W / 2, PY = 300, PR = 160;
        // La boîte à outils prêtée aux styles de hero-card-styles.js
        const T = { p, alea, W, H, M, PX, PY, PR, css, melange, rrect, halo, etoile, losange, feuille, flou, dorure, texteEspace, largeurEspacee, CINZEL, LORA };
        ctx.clearRect(0, 0, W, H);
        ctx.textBaseline = 'alphabetic';

        // --- Fond : dégradé, halos, taches, poussières, grain, vignette ---
        const fond = ctx.createLinearGradient(0, 0, 0, H);
        fond.addColorStop(0, css(p.fondA)); fond.addColorStop(1, css(p.fondB));
        ctx.fillStyle = fond; ctx.fillRect(0, 0, W, H);
        halo(ctx, W / 2, 300, 520, css(p.or, nuit ? 0.2 : 0.16));
        halo(ctx, W / 2, H + 80, 760, css(p.primaire, nuit ? 0.3 : 0.1));
        if (p.legende) { rayons(ctx, PX, PY, p); halo(ctx, PX, PY, 420, css(p.or, 0.22)); }
        if (p.maudit) halo(ctx, W / 2, H - 40, 720, css(p.or, 0.13));
        if (st.fond) { ctx.save(); st.fond(ctx, T); ctx.restore(); }
        if (!nuit) for (let i = 0; i < 7; i++) halo(ctx, alea() * W, alea() * H, 120 + alea() * 220, css([120, 80, 30], 0.05 + alea() * 0.05));
        for (let i = 0; i < (nuit ? 54 : 26); i++) {
            const x = alea() * W, y = alea() * H, r = 0.8 + alea() * 2.6;
            ctx.save();
            ctx.globalAlpha = (nuit ? 0.18 : 0.12) + alea() * 0.45;
            ctx.fillStyle = css(nuit ? p.or : p.primaire);
            if (nuit) { ctx.shadowColor = css(p.or, 0.9); ctx.shadowBlur = flou(10); }
            ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }
        if (p.legende) for (let i = 0; i < 16; i++) etoile(ctx, M + alea() * (W - 2 * M), M + alea() * (H - 2 * M), 3 + alea() * 6, css(p.or, 0.35 + alea() * 0.5));
        if (p.maudit) fissures(ctx, alea);
        ctx.save();
        ctx.globalAlpha = nuit ? 0.08 : 0.13;
        ctx.globalCompositeOperation = nuit ? 'overlay' : 'multiply';
        ctx.fillStyle = motifGrain(ctx); ctx.fillRect(0, 0, W, H);
        ctx.restore();
        const vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.78);
        vignette.addColorStop(0, 'rgba(0,0,0,0)');
        vignette.addColorStop(1, nuit ? 'rgba(0,0,0,.55)' : 'rgba(80,50,20,.28)');
        ctx.fillStyle = vignette; ctx.fillRect(0, 0, W, H);

        if (p.legende) cadreLegende(ctx, p);
        else if (p.maudit) cadreMaudit(ctx, p, alea);
        else if (st.cadre) { ctx.save(); st.cadre(ctx, T); ctx.restore(); }
        else cadre(ctx, p, d.cadre);

        // --- En-tête ---
        const entete = st.entete || 'BONES & BLADES';
        ctx.fillStyle = css(p.or); ctx.font = `600 24px ${CINZEL}`; ctx.textAlign = 'center';
        texteEspace(ctx, entete, W / 2, 104, 8, true);
        const lt = largeurEspacee(ctx, entete, 8);
        ctx.save(); ctx.strokeStyle = css(p.or, 0.55); ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(W / 2 - lt / 2 - 26, 96); ctx.lineTo(W / 2 - lt / 2 - 130, 96);
        ctx.moveTo(W / 2 + lt / 2 + 26, 96); ctx.lineTo(W / 2 + lt / 2 + 130, 96);
        ctx.stroke(); ctx.restore();
        losange(ctx, W / 2 - lt / 2 - 15, 96, 4, css(p.or));
        losange(ctx, W / 2 + lt / 2 + 15, 96, 4, css(p.or));

        // --- Portrait ---
        ctx.save();
        ctx.shadowColor = css(p.or, p.legende ? 0.8 : nuit ? 0.55 : 0.35); ctx.shadowBlur = flou(p.legende ? 70 : 50);
        ctx.fillStyle = css(p.fondB); ctx.beginPath(); ctx.arc(PX, PY, PR, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.beginPath(); ctx.arc(PX, PY, PR, 0, Math.PI * 2); ctx.clip();
        if (res.avatar) couvrir(ctx, res.avatar, PX, PY, PR);
        else {
            const gp = ctx.createRadialGradient(PX, PY - 40, 20, PX, PY, PR);
            gp.addColorStop(0, css(melange(p.primaire, [255, 255, 255], 0.15)));
            gp.addColorStop(1, css(melange(p.primaire, [0, 0, 0], 0.5)));
            ctx.fillStyle = gp; ctx.fillRect(PX - PR, PY - PR, PR * 2, PR * 2);
            ctx.fillStyle = css(p.or); ctx.font = `700 160px ${CINZEL}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText((d.nom.trim()[0] || '?').toUpperCase(), PX, PY + 8);
            ctx.textBaseline = 'alphabetic';
        }
        if (p.maudit) teinteMaudite(ctx, PX, PY, PR);
        if (st.portrait) { ctx.save(); st.portrait(ctx, T); ctx.restore(); }
        ctx.restore();
        if (p.legende) anneauLegende(ctx, PX, PY, PR, p);
        else if (p.maudit) anneauMaudit(ctx, PX, PY, PR, p, alea);
        else if (st.anneau) { ctx.save(); st.anneau(ctx, T); ctx.restore(); }
        else anneau(ctx, PX, PY, PR, p, d.cadre);
        if ((parseInt(d.niveau, 10) || 0) >= 20) ruban(ctx, PX, PY + PR + 4, 'HÉROS ÉPIQUE', p);

        // --- Nom et identité ---
        ctx.textAlign = 'center';
        const tn = ajuster(ctx, d.nom, '700', CINZEL, 84, 44, W - 2 * M - 40);
        ctx.save();
        ctx.font = `700 ${tn}px ${CINZEL}`;
        if (p.legende) {
            const ln = ctx.measureText(d.nom).width;
            ctx.shadowColor = css(p.or, 0.55); ctx.shadowBlur = flou(30);
            ctx.fillStyle = dorure(ctx, W / 2 - ln / 2, 0, W / 2 + ln / 2, 0);
        }
        else if (typeof st.nomDuHeros === 'function') { st.nomDuHeros(ctx, T, ctx.measureText(d.nom).width); }
        else if (nuit) { ctx.shadowColor = css(p.or, 0.55); ctx.shadowBlur = flou(26); ctx.fillStyle = css(p.encre); }
        else ctx.fillStyle = css(p.primaire);
        ctx.fillText(d.nom, W / 2, 560);
        ctx.restore();

        const l1 = ['Niveau ' + d.niveau, [d.classe, d.sousClasse ? '(' + d.sousClasse + ')' : ''].filter(Boolean).join(' ')].filter(Boolean).join('  ·  ');
        const l2 = [d.race, d.historique].filter(Boolean).join('  ·  ');
        ctx.fillStyle = css(p.encre, 0.72);
        ctx.font = `italic 400 ${ajuster(ctx, l1, 'italic 400', LORA, 34, 22, W - 2 * M)}px ${LORA}`;
        ctx.fillText(l1, W / 2, 608);
        if (l2) {
            ctx.font = `italic 400 ${ajuster(ctx, l2, 'italic 400', LORA, 30, 20, W - 2 * M)}px ${LORA}`;
            ctx.fillText(l2, W / 2, 646);
        }

        let y = l2 ? 668 : 630;
        const devise = String(reg.devise || '').trim();
        if (devise) {
            ctx.font = `italic 400 36px ${LORA}`;
            const lignes = couper(ctx, '« ' + devise + ' »', W - 2 * M - 60, 2);
            ctx.save();
            ctx.fillStyle = css(p.or);
            if (nuit) { ctx.shadowColor = css(p.or, 0.35); ctx.shadowBlur = flou(12); }
            lignes.forEach((ln, i) => ctx.fillText(ln, W / 2, y + 44 + i * 42));
            ctx.restore();
            y += 44 + (lignes.length - 1) * 42 + 10;
        }
        y += 30;

        // Choix de l'arme
        let arme = null;
        if (reg.arme === 'auto') arme = d.armes[0] || null;
        else if (typeof reg.arme === 'number' && !isNaN(reg.arme)) arme = d.armes.find(a => a.i === reg.arme) || null;

        const infos = [['CA', d.ca], ['PV', d.pv], ['INIT', bonus(d.init)], ['VITESSE', metres(d.vitesse)], ['MAÎTRISE', bonus(d.maitrise)]].filter(([, v]) => v);
        // Le bloc du bas se centre dans la place qui reste au-dessus du pied.
        const bloc = 150 + (infos.length ? 20 + 84 : 0) + (arme ? 22 + 118 : 0);
        // Un style gagné grave son exploit juste au-dessus du pied.
        const reste = (sceauInfo ? 1166 : 1190) - (y + bloc);
        if (reste > 0) y += reste / 2;

        // --- Caractéristiques ---
        const gap = 16, cw = (W - 2 * M - gap * 5) / 6, ch = 150;
        const meilleure = Math.max(...d.stats.map(s => s.score));
        let marquee = false;
        d.stats.forEach((s, i) => {
            const x = M + i * (cw + gap);
            const top = s.score === meilleure && !marquee;
            if (top) marquee = true;
            ctx.save();
            rrect(ctx, x, y, cw, ch, 20); ctx.fillStyle = p.carte; ctx.fill();
            if (top) { ctx.shadowColor = css(p.or, 0.6); ctx.shadowBlur = flou(22); ctx.strokeStyle = css(p.or); ctx.lineWidth = 2.6; }
            else { ctx.strokeStyle = p.trait; ctx.lineWidth = 1.5; }
            rrect(ctx, x, y, cw, ch, 20); ctx.stroke();
            ctx.restore();
            ctx.textAlign = 'center';
            ctx.fillStyle = css(p.or); ctx.font = `600 21px ${CINZEL}`;
            texteEspace(ctx, s.l, x + cw / 2, y + 36, 3, true);
            ctx.fillStyle = css(p.encre); ctx.font = `700 54px ${CINZEL}`;
            ctx.fillText(signe(s.mod), x + cw / 2, y + 98);
            ctx.fillStyle = css(p.encre, 0.6); ctx.font = `400 25px ${LORA}`;
            ctx.fillText(String(s.score), x + cw / 2, y + 134);
        });
        y += ch;

        // --- Combat ---
        if (infos.length) {
            y += 20;
            const pg = 14, pw = (W - 2 * M - pg * (infos.length - 1)) / infos.length, ph = 84;
            infos.forEach(([lab, v], i) => {
                const x = M + i * (pw + pg);
                rrect(ctx, x, y, pw, ph, 42); ctx.fillStyle = p.carte; ctx.fill();
                ctx.strokeStyle = p.trait; ctx.lineWidth = 1.5; ctx.stroke();
                ctx.textAlign = 'center';
                ctx.fillStyle = css(p.or); ctx.font = `600 17px ${CINZEL}`;
                texteEspace(ctx, lab, x + pw / 2, y + 32, 2.5, true);
                // Cinzel n'a pas de minuscules : « 9 m » s'y lisait « 9 M ».
                const police = /[a-zà-ÿ]/.test(v) ? LORA : CINZEL;
                ctx.fillStyle = css(p.encre);
                ctx.font = `700 ${ajuster(ctx, v, '700', police, 32, 18, pw - 24)}px ${police}`;
                ctx.fillText(v, x + pw / 2, y + 68);
            });
            y += ph;
        }

        // --- Arme fétiche ---
        if (arme) {
            y += 22;
            const ah = 118;
            ctx.save();
            rrect(ctx, M, y, W - 2 * M, ah, 24);
            ctx.fillStyle = arme.magique ? css(p.or, nuit ? 0.08 : 0.12) : p.carte; ctx.fill();
            if (arme.magique) { ctx.shadowColor = css(p.or, 0.55); ctx.shadowBlur = flou(24); ctx.strokeStyle = css(p.or); ctx.lineWidth = 2.4; }
            else { ctx.strokeStyle = p.trait; ctx.lineWidth = 1.5; }
            rrect(ctx, M, y, W - 2 * M, ah, 24); ctx.stroke();
            ctx.restore();

            const gx = M + 34, dx = W - M - 34;
            // La colonne de droite se mesure d'abord : c'est elle qui décide de la
            // place laissée au nom, pour qu'un long nom ne chevauche jamais les chiffres.
            const toucherTxt = arme.toucher ? (/^DD/.test(arme.toucher) ? arme.toucher : 'Toucher ' + bonus(arme.toucher)) : '';
            ctx.font = `700 30px ${CINZEL}`;
            const wT = toucherTxt ? ctx.measureText(toucherTxt).width : 0;
            const dg = [[arme.degats, arme.type].filter(Boolean).join(' '), ...(arme.extras || []).map(e => '+ ' + e)]
                .filter(Boolean).join(' ');
            const tDg = dg ? ajuster(ctx, dg, 'italic 400', LORA, 25, 16, 440) : 25;
            ctx.font = `italic 400 ${tDg}px ${LORA}`;
            const wD = dg ? ctx.measureText(dg).width : 0;
            const largeurGauche = Math.max(220, (dx - gx) - Math.max(wT, wD) - 36);

            ctx.textAlign = 'left';
            ctx.fillStyle = css(p.or); ctx.font = `600 17px ${CINZEL}`;
            texteEspace(ctx, arme.magique ? 'ARME FÉTICHE · MAGIQUE' : 'ARME FÉTICHE', gx, y + 34, 3, false);

            const taille = ajuster(ctx, arme.nom, '700', CINZEL, 40, 22, largeurGauche - (arme.magique ? 50 : 0));
            ctx.save();
            ctx.font = `700 ${taille}px ${CINZEL}`;
            ctx.fillStyle = arme.magique ? css(p.or) : css(p.encre);
            if (arme.magique && nuit) { ctx.shadowColor = css(p.or, 0.7); ctx.shadowBlur = flou(18); }
            ctx.fillText(arme.nom, gx, y + 78);
            const larg = ctx.measureText(arme.nom).width;
            ctx.restore();
            if (arme.magique) { etoile(ctx, gx + larg + 20, y + 56, 9, css(p.or)); etoile(ctx, gx + larg + 38, y + 74, 5, css(p.or, 0.8)); }

            const sous = [arme.bottes && arme.bottes.length ? 'Botte : ' + arme.bottes.join(', ') : '', arme.rarete].filter(Boolean).join('  ·  ');
            if (sous) {
                ctx.fillStyle = css(p.encre, 0.6);
                ctx.font = `italic 400 ${ajuster(ctx, sous, 'italic 400', LORA, 21, 14, largeurGauche)}px ${LORA}`;
                ctx.fillText(sous, gx, y + 104);
            }

            ctx.textAlign = 'right';
            if (toucherTxt) { ctx.fillStyle = css(p.encre); ctx.font = `700 30px ${CINZEL}`; ctx.fillText(toucherTxt, dx, y + 56); }
            if (dg) { ctx.fillStyle = css(p.encre, 0.68); ctx.font = `italic 400 ${tDg}px ${LORA}`; ctx.fillText(dg, dx, y + 92); }
        }

        if (st.devant) { ctx.save(); st.devant(ctx, T); ctx.restore(); }

        // --- Le sceau de l'exploit (styles gagnés) ---
        if (sceauInfo) {
            let quand = '';
            try { quand = new Date(sceauInfo.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) {}
            const sceau = [st.sceau, quand, sceauInfo.fois > 1 ? '×' + sceauInfo.fois : ''].filter(Boolean).join('  ·  ');
            ctx.save();
            ctx.textAlign = 'center';
            ctx.font = `italic 400 ${ajuster(ctx, sceau, 'italic 400', LORA, 23, 15, W - 2 * M - 90)}px ${LORA}`;
            ctx.fillStyle = css(p.or, 0.92);
            ctx.shadowColor = css(p.or, 0.35); ctx.shadowBlur = flou(10);
            ctx.fillText(sceau, W / 2, 1210);
            const ls = ctx.measureText(sceau).width;
            ctx.restore();
            etoile(ctx, W / 2 - ls / 2 - 22, 1202, 7, css(p.or));
            etoile(ctx, W / 2 + ls / 2 + 22, 1202, 7, css(p.or));
        }

        // --- Pied : logo, nom du site, adresse réelle quand il est en ligne ---
        const local = location.protocol === 'file:' || /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(location.hostname);
        const hote = local ? '' : location.host;
        const titre = 'BONES & BLADES', fy = 1262;
        ctx.textAlign = 'left';
        ctx.font = `600 22px ${CINZEL}`; const tw = largeurEspacee(ctx, titre, 5);
        ctx.font = `400 20px ${LORA}`; const hw = hote ? ctx.measureText('  ·  ' + hote).width : 0;
        const lw = res.logo ? 60 : 0;
        let fx = W / 2 - (lw + tw + hw) / 2;
        if (res.logo) { ctx.drawImage(res.logo, fx, fy - 36, 46, 46); fx += lw; }
        ctx.fillStyle = css(p.or); ctx.font = `600 22px ${CINZEL}`;
        texteEspace(ctx, titre, fx, fy, 5, false); fx += tw;
        if (hote) { ctx.fillStyle = css(p.encre, 0.55); ctx.font = `400 20px ${LORA}`; ctx.fillText('  ·  ' + hote, fx, fy); }
    }

    // =====================================================
    // RESSOURCES (polices, logo, portrait)
    // =====================================================
    let logo = null, avatarSrc = null, avatarImg = null;
    const charger = (src) => new Promise(ok => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
    async function preparer(d) {
        // Sans cette attente, le premier dessin partait en Georgia : le canvas
        // n'attend pas les polices web tout seul.
        if (document.fonts && document.fonts.load) {
            try { await Promise.all([`700 80px ${CINZEL}`, `600 24px ${CINZEL}`, `italic 400 32px ${LORA}`, `400 26px ${LORA}`].map(f => document.fonts.load(f))); } catch (e) {}
        }
        if (!logo) logo = await charger('IMG/logo-256.png');
        if (d.avatar !== avatarSrc) { avatarSrc = d.avatar; avatarImg = d.avatar ? await charger(d.avatar) : null; }
        return { logo, avatar: avatarImg };
    }

    // =====================================================
    // LA FENÊTRE
    // =====================================================
    let modal = null, cv = null, d = null, reglages = null, minuteur = null;

    function construire() {
        if (modal) return;
        modal = document.createElement('div');
        modal.id = 'hero-card-modal';
        modal.className = 'modal-overlay hidden no-print';
        modal.innerHTML = `<div class="modal-box hc-box" role="dialog" aria-labelledby="hc-titre">
            <div class="modal-header"><h2 id="hc-titre">🃏 Carte de héros</h2><button type="button" class="btn-close-modal" data-hc="fermer" aria-label="Fermer">✕</button></div>
            <div class="hc-grid">
                <div class="hc-apercu"><canvas id="hc-canvas" width="${W * ECHELLE}" height="${H * ECHELLE}" role="img" aria-label="Carte de héros"></canvas></div>
                <div class="hc-reglages">
                    <div class="hc-f"><label>Style <span id="hc-compte"></span></label>
                        <div class="hc-seg hc-vitrine">${STYLES.map(x => `<button type="button" data-hc-style="${x.id}">${x.nom}</button>`).join('')}</div>
                        <p class="hc-indice" id="hc-indice" hidden></p>
                    </div>
                    <div class="hc-f"><label for="hc-devise">Devise <span>facultative</span></label>
                        <input type="text" id="hc-devise" maxlength="90" placeholder="Je ne recule jamais." autocomplete="off">
                    </div>
                    <div class="hc-f"><label for="hc-arme">Arme fétiche</label><select id="hc-arme"></select></div>
                    <p class="hc-note">Ton cadre de portrait (menu ☰ → Apparence) s'applique à la carte. L'image est fabriquée sur ton appareil : rien n'est envoyé nulle part.</p>
                    <div class="hc-actions">
                        <button type="button" class="btn hc-go" data-hc="partager" hidden>↗ Partager</button>
                        <button type="button" class="btn hc-go" data-hc="telecharger">⬇ Télécharger</button>
                        <button type="button" class="btn-small hc-ghost" data-hc="copier" hidden>📋 Copier l'image</button>
                    </div>
                </div>
            </div>
        </div>`;
        document.body.appendChild(modal);
        cv = modal.querySelector('#hc-canvas');

        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.closest('[data-hc="fermer"]')) { fermer(); return; }
            const st = e.target.closest('[data-hc-style]');
            if (st) {
                const indice = modal.querySelector('#hc-indice');
                // Un style verrouillé ne se choisit pas : il livre seulement son indice.
                if (st.classList.contains('is-verrou')) { indice.hidden = false; indice.textContent = '🔒 Indice : ' + (st.dataset.indice || 'mystère.'); return; }
                indice.hidden = true;
                reglages.style = st.dataset.hcStyle; noter('dnd-hero-style', reglages.style); majSegments(); rendre(); return;
            }
            const act = e.target.closest('[data-hc]');
            if (!act) return;
            if (act.dataset.hc === 'telecharger') telecharger();
            else if (act.dataset.hc === 'partager') partager();
            else if (act.dataset.hc === 'copier') copier();
        });
        modal.querySelector('#hc-devise').addEventListener('input', (e) => {
            reglages.devise = e.target.value;
            noter('dnd-hero-devise', reglages.devise);
            clearTimeout(minuteur);
            minuteur = setTimeout(rendre, 160);
        });
        modal.querySelector('#hc-arme').addEventListener('change', (e) => {
            reglages.arme = e.target.value;
            noter('dnd-hero-arme', reglages.arme);
            rendre();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) fermer();
        });
    }

    function majSegments() {
        modal.querySelectorAll('[data-hc-style]').forEach(b => {
            const on = b.dataset.hcStyle === reglages.style;
            b.classList.toggle('is-on', on);
            b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
    }

    /** `opts.style` impose un style : les bannières des secrets ouvrent sur le style gagné. */
    async function ouvrir(opts) {
        const app = $('app-screen');
        if (!app || app.classList.contains('hidden') || !idPerso()) { toast('Ouvre une fiche pour créer la carte de ton héros.'); return; }
        const menu = $('settings-dropdown'); if (menu) menu.classList.add('hidden');
        construire();
        d = donnees();
        let style = (opts && opts.style) || lire('dnd-hero-style');
        if (!STYLES.some(x => x.id === style && disponible(x))) style = 'nuit';
        if (opts && opts.style) noter('dnd-hero-style', style);
        reglages = {
            style,
            devise: lire('dnd-hero-devise') || '',
            arme: lire('dnd-hero-arme') || 'auto'
        };
        let gagnes = 0;
        STYLES.forEach(x => {
            const b = modal.querySelector(`[data-hc-style="${x.id}"]`); if (!b) return;
            const libre = disponible(x); if (libre) gagnes++;
            b.classList.toggle('is-verrou', !libre);
            b.textContent = libre ? x.nom : '🔒 ???';
            b.dataset.indice = x.indice || '';
            b.title = libre ? x.nom : 'Style verrouillé — clique pour un indice';
        });
        modal.querySelector('#hc-compte').textContent = `${gagnes} / ${STYLES.length}`;
        modal.querySelector('#hc-indice').hidden = true;
        modal.querySelector('#hc-devise').value = reglages.devise;
        const sel = modal.querySelector('#hc-arme');
        sel.innerHTML = '<option value="auto">Choisie pour moi</option>'
            + d.armes.map(a => `<option value="${a.i}">${esc(a.nom)}${a.magique ? ' ✨' : ''}</option>`).join('')
            + '<option value="aucune">Aucune arme</option>';
        if (![...sel.options].some(o => o.value === reglages.arme)) reglages.arme = 'auto';
        sel.value = reglages.arme;
        majSegments();

        let peutPartager = false;
        try { peutPartager = !!(navigator.canShare && navigator.canShare({ files: [new File(['x'], 'carte.jpg', { type: 'image/jpeg' })] })); } catch (e) {}
        modal.querySelector('[data-hc="partager"]').hidden = !peutPartager;
        modal.querySelector('[data-hc="copier"]').hidden = !(navigator.clipboard && navigator.clipboard.write && window.ClipboardItem);

        modal.classList.remove('hidden');
        await rendre();
    }

    function fermer() { if (modal) modal.classList.add('hidden'); }

    async function rendre() {
        if (!cv || !d) return;
        modal.classList.add('is-busy');
        const res = await preparer(d);
        const arme = reglages.arme === 'auto' ? 'auto' : reglages.arme === 'aucune' ? 'aucune' : parseInt(reglages.arme, 10);
        dessiner(cv, d, { style: reglages.style, devise: reglages.devise, arme }, res);
        cv.setAttribute('aria-label', `Carte de héros de ${d.nom}, ${d.classe || 'aventurier'} de niveau ${d.niveau}`);
        modal.classList.remove('is-busy');
    }

    // =====================================================
    // SORTIE DE L'IMAGE
    // =====================================================
    const nomFichier = () => 'heros-' + (d.nom || 'sans-nom').normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.jpg';
    const enBlob = () => new Promise(ok => cv.toBlob(b => ok(b), 'image/jpeg', 0.95));
    // Le presse-papiers n'accepte que le PNG : on y copie la carte en 1080 × 1350,
    // largement assez pour une conversation, et bien plus léger qu'en pleine définition.
    function enPngReduit() {
        const petit = document.createElement('canvas');
        petit.width = W; petit.height = H;
        const c = petit.getContext('2d');
        c.imageSmoothingEnabled = true;
        if ('imageSmoothingQuality' in c) c.imageSmoothingQuality = 'high';
        c.drawImage(cv, 0, 0, W, H);
        return new Promise(ok => petit.toBlob(b => ok(b), 'image/png'));
    }

    async function telecharger() {
        const b = await enBlob(); if (!b) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(b); a.download = nomFichier();
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        toast(`🃏 Carte enregistrée — ${cv.width} × ${cv.height} px`);
    }
    async function partager() {
        const b = await enBlob(); if (!b) return;
        const f = new File([b], nomFichier(), { type: 'image/jpeg' });
        try { await navigator.share({ files: [f], title: d.nom, text: d.nom + ' — Bones & Blades' }); }
        catch (e) { if (e && e.name !== 'AbortError') toast('Le partage a échoué — télécharge l’image à la place.'); }
    }
    async function copier() {
        // La promesse est confiée telle quelle à ClipboardItem : attendre le blob
        // avant faisait perdre le « geste utilisateur » sur Safari.
        try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': enPngReduit() })]); toast('📋 Image copiée — colle-la dans Discord'); }
        catch (e) { toast('Copie impossible ici — télécharge l’image à la place.'); }
    }

    document.addEventListener('click', (e) => {
        if (e.target.closest('#btn-hero-card, #btn-menu-hero-card')) { e.preventDefault(); ouvrir(); }
    });

    window.HeroCard = {
        open: ouvrir,
        ajouterStyles,
        /** Le style qu'un exploit débloque, ou null : exploits.js s'en sert pour l'annoncer. */
        styleDe: (exploit) => { const x = STYLES.find(y => y.exploit === exploit); return x ? { id: x.id, nom: x.nom } : null; }
    };
})();
