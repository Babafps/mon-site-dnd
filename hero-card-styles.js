// =====================================================
// hero-card-styles.js — les styles de carte de héros à gagner
//
// Chaque style se débloque par un exploit (exploits.js, exploits-suivi.js,
// secrets.js, secrets-monde.js), une fois pour tous les personnages du joueur.
// Il déclare sa palette et des crochets de dessin, que hero-card.js appelle
// avec (ctx, T) — T étant la boîte à outils de la carte : mesures, couleurs,
// formes, et la graine aléatoire du héros (le même héros garde le même décor).
// Mise en page de référence : 1080 × 1350 (le canvas est en double définition).
// =====================================================
(function () {
    'use strict';
    if (!window.HeroCard || !window.HeroCard.ajouterStyles) return;

    // =====================================================
    // PETITES FORMES PARTAGÉES
    // =====================================================
    const TAU = Math.PI * 2;
    function disque(ctx, x, y, r, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
    function cercle(ctx, x, y, r, c, l, tirets) {
        ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = l; if (tirets) ctx.setLineDash(tirets);
        ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); ctx.restore();
    }
    function lueur(ctx, T, c, flouPx) { ctx.shadowColor = c; ctx.shadowBlur = T.flou(flouPx); }

    /** Deux filets autour de la carte. */
    function doubleCadre(ctx, T, c1, l1, c2, tirets) {
        const { W, H, rrect } = T;
        ctx.save();
        ctx.strokeStyle = c1; ctx.lineWidth = l1; rrect(ctx, 30, 30, W - 60, H - 60, 28); ctx.stroke();
        ctx.strokeStyle = c2; ctx.lineWidth = 1.5; if (tirets) ctx.setLineDash(tirets);
        rrect(ctx, 48, 48, W - 96, H - 96, 20); ctx.stroke();
        ctx.restore();
    }
    /** Un motif posé aux quatre coins, en miroir (repère local : le coin en 0,0). */
    function coins(ctx, T, dessin, marge) {
        const { W, H } = T, m = marge || 64;
        [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([sx, sy]) => {
            ctx.save(); ctx.translate(sx < 0 ? W - m : m, sy < 0 ? H - m : m); ctx.scale(sx, sy); dessin(ctx); ctx.restore();
        });
    }
    /** n tirages dans une zone, à partir de la graine du héros : f(x, y, k, i), k ∈ [0,1[. */
    function semis(T, n, f, zone) {
        const { alea, W, H } = T, z = zone || [40, 40, W - 40, H - 40];
        for (let i = 0; i < n; i++) f(z[0] + alea() * (z[2] - z[0]), z[1] + alea() * (z[3] - z[1]), alea(), i);
    }
    function fissuresSimples(ctx, T, n) {
        const { alea, W, H } = T;
        ctx.save(); ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
        for (let i = 0; i < n; i++) {
            let x = alea() < 0.5 ? 0 : W, y = alea() * H;
            let a = x === 0 ? (alea() - 0.5) : Math.PI + (alea() - 0.5);
            ctx.beginPath(); ctx.moveTo(x, y);
            for (let k = 0; k < 12; k++) { a += (alea() - 0.5) * 0.8; x += Math.cos(a) * 24; y += Math.sin(a) * 24; ctx.lineTo(x, y); }
            ctx.stroke();
        }
        ctx.restore();
    }

    // ---------- Motifs ----------
    function trefle(ctx, x, y, r, c) {
        ctx.save(); ctx.fillStyle = c;
        [0, 1, 2, 3].forEach(i => { const a = i * Math.PI / 2 - Math.PI / 4; ctx.beginPath(); ctx.arc(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.5, 0, TAU); ctx.fill(); });
        ctx.strokeStyle = c; ctx.lineWidth = r * 0.16; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + r * 0.3, y + r, x + r * 0.1, y + r * 1.4); ctx.stroke();
        ctx.restore();
    }
    function flocon(ctx, x, y, r, c) {
        ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = Math.max(1, r * 0.12); ctx.lineCap = 'round'; ctx.translate(x, y);
        for (let i = 0; i < 6; i++) {
            ctx.rotate(Math.PI / 3);
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -r);
            ctx.moveTo(0, -r * 0.55); ctx.lineTo(r * 0.28, -r * 0.8); ctx.moveTo(0, -r * 0.55); ctx.lineTo(-r * 0.28, -r * 0.8); ctx.stroke();
        }
        ctx.restore();
    }
    function piece(ctx, x, y, r, c1, c2) {
        const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
        g.addColorStop(0, c1); g.addColorStop(1, c2);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
        cercle(ctx, x, y, r * 0.72, 'rgba(0,0,0,.25)', Math.max(1, r * 0.1));
    }
    function bulle(ctx, x, y, r, c) {
        cercle(ctx, x, y, r, c, Math.max(1, r * 0.1));
        ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(x - r * 0.35, y - r * 0.35, r * 0.22, r * 0.12, -0.7, 0, TAU); ctx.fill();
    }
    function os(ctx, x, y, long, ang, c) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.fillStyle = c;
        const e = long * 0.1;
        ctx.fillRect(-long / 2, -e * 0.55, long, e * 1.1);
        [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sy]) => { ctx.beginPath(); ctx.arc(sx * long / 2, sy * e * 0.7, e * 0.9, 0, TAU); ctx.fill(); });
        ctx.restore();
    }
    function patte(ctx, x, y, s, ang, c) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.fillStyle = c;
        ctx.beginPath(); ctx.ellipse(0, s * 0.35, s * 0.55, s * 0.45, 0, 0, TAU); ctx.fill();
        [[-0.55, -0.2], [-0.2, -0.55], [0.2, -0.55], [0.55, -0.2]].forEach(([a, b]) => { ctx.beginPath(); ctx.ellipse(a * s, b * s, s * 0.2, s * 0.26, 0, 0, TAU); ctx.fill(); });
        ctx.restore();
    }
    function croissant(ctx, x, y, r, c) {
        ctx.fillStyle = c; ctx.beginPath();
        ctx.arc(x, y, r, Math.PI * 0.35, Math.PI * 1.65, false);
        ctx.arc(x + r * 0.45, y, r * 0.85, Math.PI * 1.45, Math.PI * 0.55, true);
        ctx.closePath(); ctx.fill();
    }
    function couronne(ctx, x, y, s, c) {
        ctx.save(); ctx.fillStyle = c; ctx.beginPath();
        ctx.moveTo(x - s, y); ctx.lineTo(x - s, y - s * 0.55); ctx.lineTo(x - s * 0.5, y - s * 0.2); ctx.lineTo(x, y - s * 0.75);
        ctx.lineTo(x + s * 0.5, y - s * 0.2); ctx.lineTo(x + s, y - s * 0.55); ctx.lineTo(x + s, y); ctx.closePath(); ctx.fill();
        ctx.fillRect(x - s, y + s * 0.06, s * 2, s * 0.16);
        [[-1, 0.55], [0, 0.75], [1, 0.55]].forEach(([k, h]) => { ctx.beginPath(); ctx.arc(x + k * s, y - s * h - s * 0.08, s * 0.09, 0, TAU); ctx.fill(); });
        ctx.restore();
    }
    function d20(ctx, x, y, r, c, texte, T) {
        ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = Math.max(1.5, r * 0.06);
        const pts = [0, 1, 2, 3, 4, 5].map(i => [x + Math.cos(-Math.PI / 2 + i * Math.PI / 3) * r, y + Math.sin(-Math.PI / 2 + i * Math.PI / 3) * r]);
        ctx.beginPath(); pts.forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b))); ctx.closePath(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, y - r * 0.62); ctx.lineTo(x + r * 0.56, y + r * 0.36); ctx.lineTo(x - r * 0.56, y + r * 0.36); ctx.closePath(); ctx.stroke();
        if (texte) { ctx.fillStyle = c; ctx.font = `700 ${Math.round(r * 0.5)}px ${T.CINZEL}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(texte, x, y + r * 0.08); }
        ctx.restore();
    }
    /** Une toile d'araignée dans un coin (repère local : le coin en 0,0). */
    function toile(ctx, r, c) {
        ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = 1.2;
        const n = 6;
        for (let i = 0; i <= n; i++) { const a = (Math.PI / 2) * i / n; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); ctx.stroke(); }
        for (let k = 1; k <= 4; k++) {
            const rr = r * k / 4.4;
            ctx.beginPath();
            for (let i = 0; i <= n; i++) {
                const a = (Math.PI / 2) * i / n, px = Math.cos(a) * rr, py = Math.sin(a) * rr;
                if (i === 0) ctx.moveTo(px, py);
                else { const am = (Math.PI / 2) * (i - 0.5) / n; ctx.quadraticCurveTo(Math.cos(am) * rr * 0.86, Math.sin(am) * rr * 0.86, px, py); }
            }
            ctx.stroke();
        }
        ctx.restore();
    }
    function citrouille(ctx, x, y, s) {
        ctx.save(); ctx.fillStyle = '#e8741c';
        [-0.55, 0, 0.55].forEach(k => { ctx.beginPath(); ctx.ellipse(x + k * s * 0.6, y, s * 0.5, s * 0.62, 0, 0, TAU); ctx.fill(); });
        ctx.strokeStyle = 'rgba(120,50,0,.55)'; ctx.lineWidth = s * 0.05;
        [-0.3, 0.3].forEach(k => { ctx.beginPath(); ctx.ellipse(x + k * s, y, s * 0.2, s * 0.6, 0, 0, TAU); ctx.stroke(); });
        ctx.fillStyle = '#4f7a2a'; ctx.fillRect(x - s * 0.07, y - s * 0.8, s * 0.14, s * 0.24);
        ctx.fillStyle = '#2a1204'; ctx.beginPath();
        ctx.moveTo(x - s * 0.42, y - s * 0.12); ctx.lineTo(x - s * 0.18, y - s * 0.3); ctx.lineTo(x - s * 0.12, y - s * 0.05); ctx.closePath();
        ctx.moveTo(x + s * 0.42, y - s * 0.12); ctx.lineTo(x + s * 0.18, y - s * 0.3); ctx.lineTo(x + s * 0.12, y - s * 0.05); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x - s * 0.4, y + s * 0.15); ctx.quadraticCurveTo(x, y + s * 0.5, x + s * 0.4, y + s * 0.15); ctx.quadraticCurveTo(x, y + s * 0.3, x - s * 0.4, y + s * 0.15); ctx.fill();
        ctx.restore();
    }
    function chauveSouris(ctx, x, y, s, c) {
        ctx.save(); ctx.fillStyle = c; ctx.translate(x, y); ctx.beginPath();
        ctx.moveTo(0, -s * 0.15);
        ctx.quadraticCurveTo(-s * 0.5, -s * 0.6, -s, -s * 0.2); ctx.quadraticCurveTo(-s * 0.75, -s * 0.1, -s * 0.7, s * 0.15);
        ctx.quadraticCurveTo(-s * 0.45, 0, -s * 0.35, s * 0.2); ctx.quadraticCurveTo(-s * 0.15, s * 0.05, 0, s * 0.25);
        ctx.quadraticCurveTo(s * 0.15, s * 0.05, s * 0.35, s * 0.2); ctx.quadraticCurveTo(s * 0.45, 0, s * 0.7, s * 0.15);
        ctx.quadraticCurveTo(s * 0.75, -s * 0.1, s, -s * 0.2); ctx.quadraticCurveTo(s * 0.5, -s * 0.6, 0, -s * 0.15);
        ctx.fill(); ctx.restore();
    }
    function chat(ctx, T, x, y, s, c, yeux) {
        ctx.save(); ctx.fillStyle = c; ctx.translate(x, y);
        ctx.beginPath(); ctx.ellipse(0, -s * 0.45, s * 0.42, s * 0.5, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(0, -s * 1.05, s * 0.3, 0, TAU); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-s * 0.28, -s * 1.15); ctx.lineTo(-s * 0.22, -s * 1.48); ctx.lineTo(-s * 0.05, -s * 1.28); ctx.closePath();
        ctx.moveTo(s * 0.28, -s * 1.15); ctx.lineTo(s * 0.22, -s * 1.48); ctx.lineTo(s * 0.05, -s * 1.28); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = c; ctx.lineWidth = s * 0.1; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(s * 0.35, -s * 0.1); ctx.quadraticCurveTo(s * 0.9, 0, s * 0.75, -s * 0.6); ctx.stroke();
        ctx.fillStyle = yeux; lueur(ctx, T, yeux, 8);
        [-1, 1].forEach(k => { ctx.beginPath(); ctx.ellipse(k * s * 0.12, -s * 1.08, s * 0.05, s * 0.08, 0, 0, TAU); ctx.fill(); });
        ctx.restore();
    }
    function chouette(ctx, x, y, s, c, yeux) {
        ctx.save(); ctx.fillStyle = c; ctx.translate(x, y);
        ctx.beginPath(); ctx.ellipse(0, 0, s * 0.5, s * 0.7, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-s * 0.45, -s * 0.45); ctx.lineTo(-s * 0.35, -s * 0.85); ctx.lineTo(-s * 0.1, -s * 0.55);
        ctx.lineTo(s * 0.1, -s * 0.55); ctx.lineTo(s * 0.35, -s * 0.85); ctx.lineTo(s * 0.45, -s * 0.45); ctx.closePath(); ctx.fill();
        ctx.fillStyle = yeux; [-1, 1].forEach(k => { ctx.beginPath(); ctx.arc(k * s * 0.2, -s * 0.35, s * 0.14, 0, TAU); ctx.fill(); });
        ctx.fillStyle = c; [-1, 1].forEach(k => { ctx.beginPath(); ctx.arc(k * s * 0.2, -s * 0.35, s * 0.06, 0, TAU); ctx.fill(); });
        ctx.restore();
    }
    function epee(ctx, x, y, long, ang, lame, garde) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
        ctx.fillStyle = lame; ctx.beginPath();
        ctx.moveTo(0, -long / 2); ctx.lineTo(long * 0.035, -long / 2 + long * 0.08); ctx.lineTo(long * 0.03, long * 0.28);
        ctx.lineTo(-long * 0.03, long * 0.28); ctx.lineTo(-long * 0.035, -long / 2 + long * 0.08); ctx.closePath(); ctx.fill();
        ctx.fillStyle = garde;
        ctx.fillRect(-long * 0.13, long * 0.28, long * 0.26, long * 0.035);
        ctx.fillRect(-long * 0.02, long * 0.315, long * 0.04, long * 0.15);
        ctx.beginPath(); ctx.arc(0, long * 0.49, long * 0.03, 0, TAU); ctx.fill();
        ctx.restore();
    }
    function bouclier(ctx, x, y, s, fond, bord) {
        ctx.save(); ctx.translate(x, y); ctx.beginPath();
        ctx.moveTo(-s * 0.5, -s * 0.55); ctx.lineTo(s * 0.5, -s * 0.55); ctx.lineTo(s * 0.5, 0);
        ctx.quadraticCurveTo(s * 0.45, s * 0.45, 0, s * 0.65); ctx.quadraticCurveTo(-s * 0.45, s * 0.45, -s * 0.5, 0); ctx.closePath();
        ctx.fillStyle = fond; ctx.fill(); ctx.strokeStyle = bord; ctx.lineWidth = s * 0.06; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, -s * 0.55); ctx.lineTo(0, s * 0.6); ctx.moveTo(-s * 0.5, -s * 0.1); ctx.lineTo(s * 0.5, -s * 0.1); ctx.stroke();
        ctx.restore();
    }
    function plume(ctx, x, y, long, ang, c) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.fillStyle = c;
        ctx.beginPath(); ctx.moveTo(0, -long / 2); ctx.quadraticCurveTo(long * 0.22, -long * 0.1, long * 0.02, long * 0.35);
        ctx.quadraticCurveTo(-long * 0.16, -long * 0.05, 0, -long / 2); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = long * 0.012;
        ctx.beginPath(); ctx.moveTo(0, -long * 0.45); ctx.lineTo(long * 0.03, long * 0.5); ctx.stroke();
        ctx.restore();
    }
    function rivet(ctx, x, y, r, c) {
        const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
        g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(0.4, c); g.addColorStop(1, 'rgba(0,0,0,.6)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
    /** Un cercle de runes : deux anneaux et des signes entre les deux. */
    function cercleRunique(ctx, x, y, r, c, n) {
        cercle(ctx, x, y, r, c, 2); cercle(ctx, x, y, r - 26, c, 1.2);
        ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = 1.8;
        for (let i = 0; i < n; i++) {
            const a = TAU * i / n;
            ctx.save(); ctx.translate(x + Math.cos(a) * (r - 13), y + Math.sin(a) * (r - 13)); ctx.rotate(a + Math.PI / 2);
            ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(0, 7);
            const k = i % 4;
            if (k === 0) { ctx.moveTo(0, -2); ctx.lineTo(5, -7); }
            else if (k === 1) { ctx.moveTo(-5, 3); ctx.lineTo(5, -3); }
            else if (k === 2) { ctx.moveTo(-4, -7); ctx.lineTo(4, -2); ctx.lineTo(-4, 3); }
            else { ctx.moveTo(0, 2); ctx.lineTo(-5, 7); ctx.moveTo(0, 2); ctx.lineTo(5, 7); }
            ctx.stroke(); ctx.restore();
        }
        ctx.restore();
    }
    function anneauBrillant(ctx, T, c, l, c2) {
        const { PX, PY, PR } = T;
        ctx.save(); lueur(ctx, T, c, 18); cercle(ctx, PX, PY, PR + 4, c, l); ctx.restore();
        if (c2) cercle(ctx, PX, PY, PR + 17, c2, 1.6);
    }

    const STYLES = [];

    // =====================================================
    // LES SECRETS DU SITE
    // =====================================================
    STYLES.push({
        id: 'astral', nom: '🌌 Astral', exploit: 'astral', entete: 'VENU DU PLAN ASTRAL', sceau: 'Un sac dans un sac', indice: 'Certains sacs n’aiment pas être rangés ensemble.',
        palette: { fondA: [30, 18, 66], fondB: [4, 3, 14], or: [190, 176, 255], encre: [242, 238, 255], primaire: [90, 70, 190] },
        fond(ctx, T) {
            const { PX, PY, PR, halo, etoile } = T;
            halo(ctx, 260, 380, 460, 'rgba(160,80,255,.22)'); halo(ctx, 860, 900, 520, 'rgba(60,120,255,.18)'); halo(ctx, 760, 260, 300, 'rgba(255,110,210,.12)');
            semis(T, 140, (x, y, k) => disque(ctx, x, y, 0.5 + k * 1.6, `rgba(255,255,255,${0.2 + k * 0.6})`));
            semis(T, 10, (x, y, k) => etoile(ctx, x, y, 3 + k * 6, 'rgba(220,210,255,.8)'));
            // Une orbite derrière le portrait, et sa petite planète
            ctx.save(); ctx.translate(PX, PY); ctx.rotate(-0.35);
            ctx.strokeStyle = 'rgba(190,176,255,.5)'; ctx.lineWidth = 1.8;
            ctx.beginPath(); ctx.ellipse(0, 0, PR + 90, PR * 0.5, 0, 0, TAU); ctx.stroke();
            lueur(ctx, T, 'rgba(255,190,240,.9)', 14); disque(ctx, PR + 90, 0, 10, 'rgba(255,200,240,.95)');
            ctx.restore();
        },
        cadre(ctx, T) { doubleCadre(ctx, T, T.css(T.p.or, 0.8), 3, T.css(T.p.or, 0.35), [2, 8]); coins(ctx, T, c => T.etoile(c, 0, 0, 12, 'rgba(235,228,255,.95)')); },
        anneau(ctx, T) { anneauBrillant(ctx, T, T.css(T.p.or), 4, T.css(T.p.or, 0.4)); }
    });

    STYLES.push({
        id: 'epique', nom: '⚜️ Épique', exploit: 'epique', entete: 'HÉROS ÉPIQUE', sceau: 'Niveau 20 atteint', indice: 'Le sommet d’une carrière.',
        palette: { fondA: [58, 22, 80], fondB: [10, 4, 16], or: [233, 196, 106], encre: [248, 238, 220], primaire: [120, 60, 170] },
        fond(ctx, T) {
            T.halo(ctx, T.PX, T.PY, 520, 'rgba(180,120,255,.2)');
            semis(T, 60, (x, y, k) => disque(ctx, x, y, 1 + k * 2, `rgba(233,196,106,${0.15 + k * 0.4})`));
        },
        cadre(ctx, T) {
            const { W, H, rrect, css, p } = T;
            ctx.save(); ctx.strokeStyle = 'rgba(150,90,210,.55)'; ctx.lineWidth = 8; rrect(ctx, 40, 40, W - 80, H - 80, 24); ctx.stroke(); ctx.restore();
            doubleCadre(ctx, T, T.dorure(ctx, 0, 0, W, H), 6, css(p.or, 0.5));
            coins(ctx, T, c => { T.losange(c, 0, 0, 10, css(p.or)); T.losange(c, 24, 0, 5, css(p.or, 0.8)); T.losange(c, 0, 24, 5, css(p.or, 0.8)); });
        },
        anneau(ctx, T) {
            const { PX, PY, PR, css, p } = T;
            ctx.save(); ctx.lineWidth = 8; ctx.strokeStyle = T.dorure(ctx, PX - PR, PY - PR, PX + PR, PY + PR); ctx.beginPath(); ctx.arc(PX, PY, PR + 5, 0, TAU); ctx.stroke(); ctx.restore();
            cercle(ctx, PX, PY, PR + 18, 'rgba(180,120,255,.6)', 2);
            // La couronne se pose sur le haut du portrait, sous le titre
            ctx.save(); lueur(ctx, T, css(p.or, 0.7), 16); couronne(ctx, PX, PY - PR + 8, 40, T.dorure(ctx, PX - 40, 0, PX + 40, 0)); ctx.restore();
        },
        nomDuHeros(ctx, T, l) { ctx.shadowColor = 'rgba(180,120,255,.6)'; ctx.shadowBlur = T.flou(26); ctx.fillStyle = T.dorure(ctx, T.W / 2 - l / 2, 0, T.W / 2 + l / 2, 0); }
    });

    STYLES.push({
        id: 'revenant', nom: '💀 Revenant', exploit: 'revenant', entete: 'REVENU D’ENTRE LES MORTS', sceau: 'Trois jets contre la mort réussis', indice: 'Frôler la mort… et refuser.',
        palette: { fondA: [22, 32, 44], fondB: [4, 6, 10], or: [170, 215, 240], encre: [236, 232, 220], primaire: [60, 90, 120] },
        fond(ctx, T) {
            T.halo(ctx, 200, 1100, 500, 'rgba(120,190,230,.16)'); T.halo(ctx, 900, 500, 420, 'rgba(120,190,230,.12)');
            ctx.strokeStyle = 'rgba(170,215,240,.12)'; ctx.lineWidth = 3;
            semis(T, 7, (x, y, k) => { ctx.beginPath(); ctx.moveTo(x - 200, y); ctx.bezierCurveTo(x - 80, y - 60 * k, x + 80, y + 70, x + 220, y - 20); ctx.stroke(); });
        },
        cadre(ctx, T) {
            doubleCadre(ctx, T, 'rgba(236,232,220,.7)', 3, T.css(T.p.or, 0.3), [10, 7]);
            coins(ctx, T, c => { os(c, 30, 30, 70, Math.PI / 4, 'rgba(236,232,220,.9)'); os(c, 30, 30, 70, -Math.PI / 4, 'rgba(236,232,220,.9)'); }, 46);
        },
        portrait(ctx, T) { const { PX, PY, PR } = T; ctx.globalCompositeOperation = 'color'; ctx.fillStyle = 'rgba(120,170,200,.4)'; ctx.fillRect(PX - PR, PY - PR, PR * 2, PR * 2); },
        anneau(ctx, T) { anneauBrillant(ctx, T, 'rgba(236,232,220,.95)', 5); cercle(ctx, T.PX, T.PY, T.PR + 17, T.css(T.p.or, 0.5), 1.8, [3, 9]); }
    });

    STYLES.push({
        id: 'noctambule', nom: '🦉 Noctambule', exploit: 'nuit-blanche', entete: 'VEILLEUR DE MINUIT', sceau: 'Une fiche ouverte à 3 h du matin', indice: 'Les bardes dorment. Toi, non.',
        palette: { fondA: [18, 28, 60], fondB: [3, 5, 14], or: [236, 226, 170], encre: [232, 236, 250], primaire: [60, 80, 150] },
        fond(ctx, T) {
            T.halo(ctx, 880, 190, 260, 'rgba(236,226,170,.18)');
            ctx.save(); lueur(ctx, T, 'rgba(236,226,170,.8)', 30); croissant(ctx, 880, 190, 62, 'rgba(240,232,190,.95)'); ctx.restore();
            semis(T, 90, (x, y, k) => disque(ctx, x, y, 0.6 + k * 1.4, `rgba(255,255,240,${0.2 + k * 0.6})`));
            semis(T, 6, (x, y, k) => T.etoile(ctx, x, y, 4 + k * 5, 'rgba(255,250,220,.8)'));
            chouette(ctx, 170, 230, 70, 'rgba(8,12,28,.96)', 'rgba(236,210,120,.95)');
        },
        cadre(ctx, T) { doubleCadre(ctx, T, T.css(T.p.or, 0.7), 2.5, T.css(T.p.or, 0.3)); },
        anneau(ctx, T) {
            const { PX, PY, PR } = T;
            anneauBrillant(ctx, T, T.css(T.p.or), 4);
            [0.8, 2.3, 4.1, 5.4].forEach(a => T.etoile(ctx, PX + Math.cos(a) * (PR + 22), PY + Math.sin(a) * (PR + 22), 6, 'rgba(255,250,220,.9)'));
        }
    });

    STYLES.push({
        id: 'tresor', nom: '🐉 Trésor du dragon', exploit: 'dragon', entete: 'GARDIEN DU TRÉSOR', sceau: 'Plus de 10 000 pièces d’or', indice: 'Une fortune qui attire les regards.',
        palette: { fondA: [70, 14, 10], fondB: [12, 2, 2], or: [240, 190, 80], encre: [252, 238, 214], primaire: [150, 40, 30] },
        fond(ctx, T) {
            const { W, H } = T;
            // Des écailles, rang après rang
            ctx.strokeStyle = 'rgba(240,120,70,.1)'; ctx.lineWidth = 2;
            for (let y = 0, r = 0; y < H + 40; y += 34, r++) {
                for (let x = r % 2 ? 0 : 30; x < W + 60; x += 60) { ctx.beginPath(); ctx.arc(x, y, 30, 0, Math.PI); ctx.stroke(); }
            }
            const tas = (x, y, k) => piece(ctx, x, y, 12 + k * 14, '#ffe9a0', '#b07a18');
            semis(T, 12, tas, [80, 1170, 300, 1300]); semis(T, 12, tas, [780, 1170, 1000, 1300]);
        },
        cadre(ctx, T) { doubleCadre(ctx, T, T.dorure(ctx, 0, 0, T.W, T.H), 8, T.css(T.p.or, 0.45)); coins(ctx, T, c => piece(c, 0, 0, 16, '#ffe9a0', '#b07a18')); },
        anneau(ctx, T) {
            const { PX, PY, PR, css, p } = T;
            ctx.save(); ctx.lineWidth = 9; ctx.strokeStyle = T.dorure(ctx, PX - PR, PY - PR, PX + PR, PY + PR); ctx.beginPath(); ctx.arc(PX, PY, PR + 5, 0, TAU); ctx.stroke();
            ctx.strokeStyle = css(p.or, 0.8); ctx.lineWidth = 2;
            for (let i = 0; i < 48; i++) { const a = TAU * i / 48; ctx.beginPath(); ctx.moveTo(PX + Math.cos(a) * (PR + 14), PY + Math.sin(a) * (PR + 14)); ctx.lineTo(PX + Math.cos(a) * (PR + 22), PY + Math.sin(a) * (PR + 22)); ctx.stroke(); }
            ctx.restore();
        }
    });

    STYLES.push({
        id: 'colosse', nom: '🗿 Colosse', exploit: 'tarasque', entete: 'TÉMOIN DE LA TARASQUE', sceau: 'A regardé la Tarasque en face', indice: 'Le plus grand monstre des règles.',
        palette: { fondA: [66, 58, 50], fondB: [16, 14, 12], or: [206, 166, 104], encre: [238, 230, 216], primaire: [110, 90, 70] },
        fond(ctx, T) {
            const { W, H, alea } = T;
            ctx.save(); ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.lineWidth = 3;
            for (let y = 0, r = 0; y < H; y += 120, r++) {
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
                for (let x = (r % 2) * 110; x < W; x += 220) { ctx.beginPath(); ctx.moveTo(x + (alea() - 0.5) * 10, y); ctx.lineTo(x + (alea() - 0.5) * 10, y + 120); ctx.stroke(); }
            }
            ctx.strokeStyle = 'rgba(255,240,220,.06)'; ctx.lineWidth = 2;
            for (let y = 0; y < H; y += 120) { ctx.beginPath(); ctx.moveTo(0, y + 4); ctx.lineTo(W, y + 4); ctx.stroke(); }
            ctx.restore();
            fissuresSimples(ctx, T, 4);
        },
        cadre(ctx, T) {
            const { W, H, rrect, css, p } = T;
            ctx.save(); ctx.strokeStyle = 'rgba(40,34,28,.92)'; ctx.lineWidth = 22; rrect(ctx, 34, 34, W - 68, H - 68, 18); ctx.stroke();
            ctx.strokeStyle = css(p.or, 0.55); ctx.lineWidth = 2; rrect(ctx, 52, 52, W - 104, H - 104, 14); ctx.stroke(); ctx.restore();
            coins(ctx, T, c => { c.fillStyle = 'rgb(90,78,64)'; c.fillRect(-24, -24, 48, 48); c.strokeStyle = css(p.or, 0.6); c.lineWidth = 2; c.strokeRect(-24, -24, 48, 48); }, 40);
        },
        anneau(ctx, T) {
            const { PX, PY, PR, css, p } = T;
            cercle(ctx, PX, PY, PR + 8, 'rgba(40,34,28,.95)', 16); cercle(ctx, PX, PY, PR + 17, css(p.or, 0.6), 2);
            ctx.save(); ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 2;
            for (let i = 0; i < 16; i++) { const a = TAU * i / 16; ctx.beginPath(); ctx.moveTo(PX + Math.cos(a) * PR, PY + Math.sin(a) * PR); ctx.lineTo(PX + Math.cos(a) * (PR + 16), PY + Math.sin(a) * (PR + 16)); ctx.stroke(); }
            ctx.restore();
        }
    });

    STYLES.push({
        id: 'gelatineux', nom: '🧊 Gélatineux', exploit: 'cube', entete: 'À TRAVERS LE CUBE', sceau: 'A contemplé le Cube gélatineux', indice: 'Un monstre qu’on voit à travers.',
        palette: { fondA: [22, 60, 44], fondB: [4, 16, 11], or: [150, 232, 170], encre: [226, 250, 236], primaire: [60, 140, 100] },
        fond(ctx, T) {
            const { PX, PY, rrect } = T;
            ctx.save(); ctx.strokeStyle = 'rgba(150,232,170,.16)'; ctx.lineWidth = 3;
            rrect(ctx, PX - 330, PY - 250, 520, 520, 30); ctx.stroke(); rrect(ctx, PX - 190, PY - 350, 520, 520, 30); ctx.stroke();
            [[-330, -250, -190, -350], [190, -250, 330, -350], [-330, 270, -190, 170], [190, 270, 330, 170]].forEach(([a, b, c, d]) => { ctx.beginPath(); ctx.moveTo(PX + a, PY + b); ctx.lineTo(PX + c, PY + d); ctx.stroke(); });
            ctx.restore();
            semis(T, 34, (x, y, k) => bulle(ctx, x, y, 4 + k * 18, `rgba(190,255,210,${0.25 + k * 0.35})`));
        },
        cadre(ctx, T) {
            const { W, H, rrect, css, p } = T;
            ctx.save(); lueur(ctx, T, css(p.or, 0.6), 18); ctx.strokeStyle = css(p.or, 0.75); ctx.lineWidth = 5; rrect(ctx, 30, 30, W - 60, H - 60, 44); ctx.stroke(); ctx.restore();
            ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(90, 40); ctx.lineTo(420, 40); ctx.stroke(); ctx.restore();
        },
        portrait(ctx, T) {
            const { PX, PY, PR } = T;
            ctx.globalCompositeOperation = 'color'; ctx.fillStyle = 'rgba(110,210,140,.3)'; ctx.fillRect(PX - PR, PY - PR, PR * 2, PR * 2);
            ctx.globalCompositeOperation = 'source-over';
            const g = ctx.createLinearGradient(PX - PR, PY - PR, PX, PY); g.addColorStop(0, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = g; ctx.fillRect(PX - PR, PY - PR, PR * 2, PR * 2);
        },
        anneau(ctx, T) {
            const { PX, PY, PR } = T;
            anneauBrillant(ctx, T, T.css(T.p.or, 0.85), 5);
            [0.4, 1.9, 3.3, 4.6, 5.8].forEach((a, i) => bulle(ctx, PX + Math.cos(a) * (PR + 26), PY + Math.sin(a) * (PR + 26), 6 + i * 2, 'rgba(200,255,220,.7)'));
        }
    });

    STYLES.push({
        id: 'coulisses', nom: '🎬 Coulisses', exploit: 'generique', entete: 'FIN… OU PRESQUE', sceau: 'A tenu jusqu’au bout du générique', indice: 'Tout film a une fin.',
        palette: { fondA: [44, 44, 44], fondB: [6, 6, 6], or: [226, 226, 226], encre: [244, 244, 244], primaire: [90, 90, 90] },
        fond(ctx, T) {
            const { W, H, alea } = T;
            for (let i = 0; i < 22; i++) {
                ctx.strokeStyle = `rgba(255,255,255,${0.04 + alea() * 0.1})`; ctx.lineWidth = 0.6 + alea() * 1.4;
                const x = alea() * W;
                ctx.beginPath(); ctx.moveTo(x, alea() * H * 0.3); ctx.lineTo(x + (alea() - 0.5) * 20, H - alea() * H * 0.3); ctx.stroke();
            }
            semis(T, 40, (x, y, k) => disque(ctx, x, y, 0.8 + k * 2.5, `rgba(255,255,255,${0.05 + k * 0.12})`));
        },
        cadre(ctx, T) {
            const { W, H, rrect } = T;
            // La pellicule : deux bandes perforées sur les côtés
            ctx.fillStyle = 'rgba(0,0,0,.9)'; ctx.fillRect(0, 0, 58, H); ctx.fillRect(W - 58, 0, 58, H);
            ctx.fillStyle = 'rgba(236,236,236,.85)';
            for (let y = 26; y < H - 20; y += 58) { rrect(ctx, 16, y, 26, 34, 5); ctx.fill(); rrect(ctx, W - 42, y, 26, 34, 5); ctx.fill(); }
            ctx.strokeStyle = 'rgba(236,236,236,.5)'; ctx.lineWidth = 2; ctx.strokeRect(70, 30, W - 140, H - 60);
        },
        portrait(ctx, T) { const { PX, PY, PR } = T; ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = '#808080'; ctx.fillRect(PX - PR, PY - PR, PR * 2, PR * 2); },
        anneau(ctx, T) {
            const { PX, PY, PR } = T;
            cercle(ctx, PX, PY, PR + 4, 'rgba(236,236,236,.9)', 5); cercle(ctx, PX, PY, PR + 16, 'rgba(236,236,236,.4)', 1.5);
            ctx.strokeStyle = 'rgba(236,236,236,.7)'; ctx.lineWidth = 2;
            [[-1, 0], [1, 0], [0, 1]].forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(PX + a * (PR - 24), PY + b * (PR - 24)); ctx.lineTo(PX + a * (PR + 30), PY + b * (PR + 30)); ctx.stroke(); });
        }
    });

    // =====================================================
    // LES DÉS, AU LONG COURS
    // =====================================================
    STYLES.push({
        id: 'chanceux', nom: '🍀 Chanceux', exploit: 'nat20x50', entete: 'BÉNI PAR LA CHANCE', sceau: '50 vingt naturels', indice: 'La chance, à force de patience.',
        palette: { fondA: [20, 66, 38], fondB: [4, 18, 10], or: [228, 198, 104], encre: [246, 242, 222], primaire: [40, 120, 70] },
        fond(ctx, T) {
            T.halo(ctx, T.PX, T.PY, 480, 'rgba(228,198,104,.14)');
            semis(T, 26, (x, y, k, i) => { ctx.save(); ctx.globalAlpha = 0.14 + k * 0.22; trefle(ctx, x, y, 12 + k * 18, i % 3 ? '#7fcf7a' : '#e4c668'); ctx.restore(); });
            semis(T, 5, (x, y, k) => { ctx.save(); ctx.globalAlpha = 0.4; d20(ctx, x, y, 22 + k * 16, '#e4c668', '20', T); ctx.restore(); });
        },
        cadre(ctx, T) { doubleCadre(ctx, T, T.dorure(ctx, 0, 0, T.W, T.H), 5, T.css(T.p.or, 0.4)); coins(ctx, T, c => trefle(c, 0, 0, 18, '#8fdc88')); },
        anneau(ctx, T) {
            const { PX, PY, PR, css, p } = T;
            cercle(ctx, PX, PY, PR + 4, css(p.or), 6); cercle(ctx, PX, PY, PR + 16, css(p.or, 0.45), 1.6);
            [-Math.PI / 2, 0, Math.PI].forEach(a => trefle(ctx, PX + Math.cos(a) * (PR + 16), PY + Math.sin(a) * (PR + 16), 12, '#8fdc88'));
        }
    });

    STYLES.push({
        id: 'chatnoir', nom: '🐈‍⬛ Chat noir', exploit: 'nat1x50', entete: 'PORTE-MALHEUR', sceau: '50 un naturels', indice: 'La malchance, à force de patience.',
        palette: { fondA: [34, 18, 46], fondB: [4, 2, 8], or: [196, 140, 245], encre: [242, 232, 252], primaire: [90, 50, 130] },
        fond(ctx, T) {
            T.halo(ctx, 260, 1000, 520, 'rgba(160,90,230,.18)'); T.halo(ctx, 860, 320, 380, 'rgba(160,90,230,.14)');
            // Des traces de pattes qui remontent le long du bord
            for (let i = 0; i < 9; i++) patte(ctx, 108 + (i % 2) * 34, 1210 - i * 112, 12, -0.2 + (i % 2) * 0.4, 'rgba(196,140,245,.18)');
            chat(ctx, T, 930, 250, 64, 'rgba(6,3,10,.96)', '#e8d44a');
        },
        cadre(ctx, T) { doubleCadre(ctx, T, T.css(T.p.or, 0.75), 3, T.css(T.p.or, 0.3), [1, 7]); coins(ctx, T, c => T.losange(c, 0, 0, 8, T.css(T.p.or, 0.9))); },
        anneau(ctx, T) { anneauBrillant(ctx, T, T.css(T.p.or, 0.9), 4, T.css(T.p.or, 0.35)); }
    });

    STYLES.push({
        id: 'jumeaux', nom: '♊ Jumeaux', exploit: 'double20', entete: 'DOUBLE VINGT', sceau: 'Deux 20 sur un même jet', indice: 'L’avantage, poussé à la perfection.',
        palette: { fondA: [46, 50, 60], fondB: [8, 9, 12], or: [214, 224, 238], encre: [246, 248, 252], primaire: [110, 120, 140] },
        fond(ctx, T) {
            const { W, H, PY, halo } = T;
            halo(ctx, 190, PY, 260, 'rgba(214,224,238,.14)'); halo(ctx, W - 190, PY, 260, 'rgba(214,224,238,.14)');
            ctx.save(); ctx.strokeStyle = 'rgba(214,224,238,.12)'; ctx.lineWidth = 2; ctx.setLineDash([4, 10]);
            ctx.beginPath(); ctx.moveTo(W / 2, 120); ctx.lineTo(W / 2, H - 120); ctx.stroke(); ctx.restore();
            ctx.save(); lueur(ctx, T, 'rgba(214,224,238,.7)', 16);
            d20(ctx, 190, PY, 70, 'rgba(230,236,246,.85)', '20', T); d20(ctx, W - 190, PY, 70, 'rgba(230,236,246,.85)', '20', T);
            ctx.restore();
        },
        cadre(ctx, T) {
            const { W, H, css, p } = T;
            doubleCadre(ctx, T, css(p.or, 0.8), 3, css(p.or, 0.35));
            [[W / 2, 30], [W / 2, H - 30], [30, H / 2], [W - 30, H / 2]].forEach(([x, y]) => T.losange(ctx, x, y, 11, css(p.or)));
        },
        anneau(ctx, T) { const { PX, PY, PR, css, p } = T; cercle(ctx, PX, PY, PR + 4, css(p.or), 4); cercle(ctx, PX, PY, PR + 14, css(p.or), 4); cercle(ctx, PX, PY, PR + 24, css(p.or, 0.3), 1.5); }
    });

    STYLES.push({
        id: 'veteran', nom: '🛡️ Vétéran', exploit: 'jets1000', entete: 'VÉTÉRAN DES DÉS', sceau: '1 000 jets de dés', indice: 'Beaucoup, beaucoup de dés.',
        palette: { fondA: [60, 64, 70], fondB: [14, 15, 17], or: [196, 206, 216], encre: [240, 242, 245], primaire: [100, 106, 116] },
        fond(ctx, T) {
            // Du métal martelé : des creux, chacun avec son reflet
            semis(T, 70, (x, y, k) => {
                const r = 10 + k * 26, g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
                g.addColorStop(0, 'rgba(255,255,255,.08)'); g.addColorStop(0.7, 'rgba(0,0,0,.06)'); g.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
            });
        },
        cadre(ctx, T) {
            const { W, H, rrect } = T;
            const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#9aa3ab'); g.addColorStop(0.5, '#e2e7eb'); g.addColorStop(1, '#6d747b');
            ctx.strokeStyle = g; ctx.lineWidth = 16; rrect(ctx, 34, 34, W - 68, H - 68, 14); ctx.stroke();
            for (let x = 90; x < W - 60; x += 90) { rivet(ctx, x, 34, 6, '#b9c1c8'); rivet(ctx, x, H - 34, 6, '#b9c1c8'); }
            for (let y = 124; y < H - 60; y += 90) { rivet(ctx, 34, y, 6, '#b9c1c8'); rivet(ctx, W - 34, y, 6, '#b9c1c8'); }
        },
        anneau(ctx, T) {
            const { PX, PY, PR } = T;
            cercle(ctx, PX, PY, PR + 8, '#aab3bb', 14); cercle(ctx, PX, PY, PR + 1, 'rgba(0,0,0,.45)', 2);
            for (let i = 0; i < 8; i++) { const a = TAU * i / 8 + Math.PI / 8; rivet(ctx, PX + Math.cos(a) * (PR + 8), PY + Math.sin(a) * (PR + 8), 5, '#d6dde3'); }
        }
    });

    // =====================================================
    // LA FICHE
    // =====================================================
    STYLES.push({
        id: 'forteresse', nom: '🏰 Forteresse', exploit: 'ca25', entete: 'INTOUCHABLE', sceau: 'Classe d’armure de 25', indice: 'Presque impossible à toucher.',
        palette: { fondA: [54, 58, 66], fondB: [12, 13, 16], or: [212, 180, 112], encre: [240, 236, 228], primaire: [140, 40, 40] },
        fond(ctx, T) {
            const { W, H, PY } = T;
            ctx.save(); ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 2;
            for (let y = 0, r = 0; y < H; y += 54, r++) {
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
                for (let x = (r % 2) * 60; x < W; x += 120) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 54); ctx.stroke(); }
            }
            ctx.restore();
            bouclier(ctx, 190, PY, 110, 'rgba(140,40,40,.55)', 'rgba(212,180,112,.8)');
            bouclier(ctx, W - 190, PY, 110, 'rgba(40,60,120,.55)', 'rgba(212,180,112,.8)');
        },
        cadre(ctx, T) {
            const { W, H, rrect, css, p } = T;
            ctx.strokeStyle = 'rgba(30,32,38,.95)'; ctx.lineWidth = 18; rrect(ctx, 34, 60, W - 68, H - 94, 8); ctx.stroke();
            // Les créneaux du rempart
            ctx.fillStyle = 'rgba(30,32,38,.95)'; for (let x = 26; x < W - 20; x += 64) ctx.fillRect(x, 20, 36, 44);
            ctx.strokeStyle = css(p.or, 0.5); ctx.lineWidth = 2; rrect(ctx, 52, 76, W - 104, H - 128, 6); ctx.stroke();
        },
        anneau(ctx, T) { const { PX, PY, PR, css, p } = T; cercle(ctx, PX, PY, PR + 8, 'rgba(30,32,38,.95)', 16); cercle(ctx, PX, PY, PR + 18, css(p.or, 0.7), 2.5); }
    });

    STYLES.push({
        id: 'sommet', nom: '🏛️ Au sommet', exploit: 'carac20', entete: 'PERFECTION', sceau: 'Une caractéristique à 20', indice: 'Le maximum humain.',
        palette: { nuit: false, fondA: [242, 238, 230], fondB: [206, 199, 188], or: [150, 102, 52], encre: [42, 34, 28], primaire: [120, 80, 40] },
        fond(ctx, T) {
            const { W, H, alea } = T;
            // Les veines du marbre
            for (let i = 0; i < 14; i++) {
                ctx.strokeStyle = `rgba(90,86,80,${0.06 + alea() * 0.12})`; ctx.lineWidth = 0.8 + alea() * 2.4;
                let x = alea() * W, y = alea() * H;
                ctx.beginPath(); ctx.moveTo(x, y);
                for (let k = 0; k < 5; k++) { const nx = x + (alea() - 0.3) * 260, ny = y + (alea() - 0.3) * 260; ctx.quadraticCurveTo(x + (alea() - 0.5) * 120, y + (alea() - 0.5) * 120, nx, ny); x = nx; y = ny; }
                ctx.stroke();
            }
        },
        cadre(ctx, T) {
            doubleCadre(ctx, T, T.dorure(ctx, 0, 0, T.W, T.H), 6, 'rgba(150,102,52,.45)');
            coins(ctx, T, c => { T.feuille(c, 20, 6, 14, 0.3, 'rgba(150,102,52,.8)'); T.feuille(c, 6, 20, 14, 1.27, 'rgba(150,102,52,.8)'); T.losange(c, 0, 0, 6, '#96663a'); });
        },
        portrait(ctx, T) { const { PX, PY, PR } = T; ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgba(236,214,180,.35)'; ctx.fillRect(PX - PR, PY - PR, PR * 2, PR * 2); },
        anneau(ctx, T) {
            const { PX, PY, PR } = T;
            ctx.save(); ctx.lineWidth = 8; ctx.strokeStyle = T.dorure(ctx, PX - PR, PY - PR, PX + PR, PY + PR); ctx.beginPath(); ctx.arc(PX, PY, PR + 5, 0, TAU); ctx.stroke(); ctx.restore();
            cercle(ctx, PX, PY, PR + 18, 'rgba(150,102,52,.45)', 1.6);
        }
    });

    STYLES.push({
        id: 'mendiant', nom: '🧺 Mendiant', exploit: 'ruine', entete: 'FAUCHÉ COMME LES BLÉS', sceau: 'Tout dépensé, jusqu’à la dernière pièce', indice: 'Tout dépenser, jusqu’à la dernière pièce.',
        palette: { nuit: false, fondA: [198, 172, 128], fondB: [150, 122, 84], or: [96, 64, 32], encre: [46, 32, 20], primaire: [110, 70, 36] },
        fond(ctx, T) {
            const { W, H, rrect } = T;
            // La trame de la toile de jute
            ctx.lineWidth = 1.2;
            for (let y = 0; y < H; y += 9) { ctx.strokeStyle = `rgba(80,56,30,${y % 18 ? 0.09 : 0.13})`; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y + 3); ctx.stroke(); }
            for (let x = 0; x < W; x += 9) { ctx.strokeStyle = `rgba(255,240,210,${x % 18 ? 0.04 : 0.07})`; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 3, H); ctx.stroke(); }
            // Deux pièces rapiécées
            [[160, 1040, 170, 120, -0.1], [880, 190, 130, 110, 0.12]].forEach(([x, y, w, h, a]) => {
                ctx.save(); ctx.translate(x, y); ctx.rotate(a);
                ctx.fillStyle = 'rgba(150,110,70,.55)'; rrect(ctx, -w / 2, -h / 2, w, h, 6); ctx.fill();
                ctx.strokeStyle = 'rgba(60,40,20,.7)'; ctx.lineWidth = 2; ctx.setLineDash([7, 6]); rrect(ctx, -w / 2 + 8, -h / 2 + 8, w - 16, h - 16, 4); ctx.stroke();
                ctx.restore();
            });
        },
        cadre(ctx, T) {
            const { W, H, rrect } = T;
            ctx.strokeStyle = 'rgba(96,64,32,.85)'; ctx.lineWidth = 3; ctx.setLineDash([14, 9]); rrect(ctx, 34, 34, W - 68, H - 68, 20); ctx.stroke();
            ctx.setLineDash([]); ctx.strokeStyle = 'rgba(96,64,32,.35)'; ctx.lineWidth = 6; rrect(ctx, 50, 50, W - 100, H - 100, 16); ctx.stroke();
        },
        anneau(ctx, T) { const { PX, PY, PR } = T; cercle(ctx, PX, PY, PR + 5, 'rgba(96,64,32,.85)', 4, [12, 8]); cercle(ctx, PX, PY, PR + 16, 'rgba(96,64,32,.4)', 2, [3, 6]); }
    });

    STYLES.push({
        id: 'archimage', nom: '🔮 Archimage', exploit: 'sort9', entete: 'ARCHIMAGE', sceau: 'Un sort de niveau 9 lancé', indice: 'La magie la plus haute.',
        palette: { fondA: [14, 28, 72], fondB: [2, 5, 18], or: [130, 205, 255], encre: [232, 244, 255], primaire: [50, 90, 190] },
        fond(ctx, T) {
            const { PX, PY, halo } = T, R = 250;
            halo(ctx, PX, PY, 520, 'rgba(90,170,255,.2)');
            ctx.save(); lueur(ctx, T, 'rgba(130,205,255,.6)', 12); cercleRunique(ctx, PX, PY, R, 'rgba(130,205,255,.55)', 28); ctx.restore();
            // L'étoile à six branches du cercle de conjuration
            ctx.save(); ctx.strokeStyle = 'rgba(130,205,255,.25)'; ctx.lineWidth = 1.5;
            for (let k = 0; k < 2; k++) {
                ctx.beginPath();
                for (let i = 0; i <= 3; i++) { const a = -Math.PI / 2 + k * Math.PI / 3 + TAU * i / 3; const px = PX + Math.cos(a) * (R - 26), py = PY + Math.sin(a) * (R - 26); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
                ctx.stroke();
            }
            ctx.restore();
            semis(T, 50, (x, y, k) => disque(ctx, x, y, 1 + k * 2.2, `rgba(160,220,255,${0.2 + k * 0.5})`));
        },
        cadre(ctx, T) {
            const { W, H, css, p } = T;
            doubleCadre(ctx, T, css(p.or, 0.75), 3, css(p.or, 0.3));
            [[W / 2, H - 30], [30, H / 2], [W - 30, H / 2]].forEach(([x, y]) => { ctx.save(); lueur(ctx, T, css(p.or), 10); cercle(ctx, x, y, 12, css(p.or), 2); T.etoile(ctx, x, y, 7, css(p.or)); ctx.restore(); });
        },
        anneau(ctx, T) { anneauBrillant(ctx, T, T.css(T.p.or), 4, T.css(T.p.or, 0.4)); }
    });

    STYLES.push({
        id: 'armurier', nom: '⚒️ Armurier', exploit: 'armes10', entete: 'MAÎTRE D’ARMES', sceau: 'Dix armes à son râtelier', indice: 'Un arsenal complet.',
        palette: { fondA: [48, 24, 14], fondB: [8, 4, 2], or: [255, 158, 70], encre: [252, 232, 212], primaire: [150, 70, 30] },
        fond(ctx, T) {
            const { W, H, PX, PY, halo } = T;
            halo(ctx, W / 2, H + 60, 700, 'rgba(255,120,40,.28)');
            ctx.save(); ctx.globalAlpha = 0.55;
            epee(ctx, PX, PY, 560, -Math.PI / 4, 'rgba(200,206,212,.9)', 'rgba(150,100,50,.95)');
            epee(ctx, PX, PY, 560, Math.PI / 4, 'rgba(200,206,212,.9)', 'rgba(150,100,50,.95)');
            ctx.restore();
            semis(T, 60, (x, y, k) => { ctx.save(); lueur(ctx, T, 'rgba(255,140,40,.9)', 8); disque(ctx, x, y, 1 + k * 2.6, `rgba(255,${120 + Math.round(k * 90)},40,${0.35 + k * 0.5})`); ctx.restore(); }, [60, 500, W - 60, H - 60]);
        },
        cadre(ctx, T) {
            const { W, H, rrect } = T;
            ctx.strokeStyle = 'rgba(28,24,22,.95)'; ctx.lineWidth = 14; rrect(ctx, 34, 34, W - 68, H - 68, 16); ctx.stroke();
            lueur(ctx, T, 'rgba(255,120,40,.8)', 14); ctx.strokeStyle = 'rgba(255,140,60,.7)'; ctx.lineWidth = 2; rrect(ctx, 46, 46, W - 92, H - 92, 12); ctx.stroke();
        },
        anneau(ctx, T) {
            const { PX, PY, PR } = T;
            cercle(ctx, PX, PY, PR + 7, 'rgba(28,24,22,.95)', 12);
            ctx.save(); lueur(ctx, T, 'rgba(255,120,40,.9)', 20); cercle(ctx, PX, PY, PR + 15, 'rgba(255,150,60,.85)', 2.5); ctx.restore();
        }
    });

    STYLES.push({
        id: 'chroniqueur', nom: '🪶 Chroniqueur', exploit: 'journal20', entete: 'CHRONIQUEUR', sceau: 'Vingt pages de journal', indice: 'Écrire sa propre légende.',
        palette: { nuit: false, fondA: [240, 230, 206], fondB: [214, 196, 160], or: [40, 52, 96], encre: [30, 26, 24], primaire: [40, 52, 96] },
        fond(ctx, T) {
            const { W, H, alea } = T;
            // Des lignes d'écriture effacées, et quelques pâtés d'encre
            ctx.strokeStyle = 'rgba(40,52,96,.07)'; ctx.lineWidth = 2;
            for (let y = 140; y < H - 100; y += 38) {
                ctx.beginPath(); ctx.moveTo(90, y);
                for (let x = 90; x < W - 90; x += 30) ctx.quadraticCurveTo(x + 7, y - 6 * alea(), x + 15, y + (alea() - 0.5) * 3);
                ctx.stroke();
            }
            semis(T, 9, (x, y, k) => {
                disque(ctx, x, y, 5 + k * 16, `rgba(30,36,70,${0.12 + k * 0.2})`);
                for (let i = 0; i < 6; i++) { const a = alea() * TAU, d = 8 + k * 30 + alea() * 20; disque(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, 1 + alea() * 3.5, `rgba(30,36,70,${0.15 + k * 0.2})`); }
            });
        },
        cadre(ctx, T) {
            doubleCadre(ctx, T, 'rgba(40,52,96,.8)', 2.5, 'rgba(40,52,96,.35)');
            coins(ctx, T, c => {
                c.strokeStyle = 'rgba(40,52,96,.8)'; c.lineWidth = 2;
                c.beginPath(); c.moveTo(60, 0); c.bezierCurveTo(20, 0, 0, 20, 12, 36); c.bezierCurveTo(22, 50, 40, 36, 28, 26); c.stroke();
                c.beginPath(); c.moveTo(0, 60); c.bezierCurveTo(0, 20, 20, 0, 36, 12); c.stroke();
            });
        },
        anneau(ctx, T) {
            const { PX, PY, PR } = T;
            cercle(ctx, PX, PY, PR + 4, 'rgba(40,52,96,.85)', 3); cercle(ctx, PX, PY, PR + 12, 'rgba(40,52,96,.4)', 1.2);
            plume(ctx, PX + PR + 46, PY + 30, 190, 0.45, 'rgba(60,70,110,.85)');
        }
    });

    STYLES.push({
        id: 'collectionneur', nom: '🖼️ Collectionneur', exploit: 'persos5', entete: 'GALERIE DES HÉROS', sceau: 'Cinq personnages créés', indice: 'Une galerie de héros.',
        palette: { fondA: [38, 44, 36], fondB: [10, 11, 9], or: [222, 184, 96], encre: [244, 238, 222], primaire: [90, 100, 70] },
        fond(ctx, T) {
            const { rrect } = T;
            // Les autres héros, accrochés au mur de la galerie
            [[150, 250, 110, 140], [930, 250, 110, 140], [150, 470, 90, 110], [930, 470, 90, 110]].forEach(([x, y, w, h]) => {
                ctx.save();
                ctx.fillStyle = 'rgba(0,0,0,.35)'; rrect(ctx, x - w / 2 + 6, y - h / 2 + 8, w, h, 4); ctx.fill();
                ctx.strokeStyle = 'rgba(222,184,96,.75)'; ctx.lineWidth = 7; rrect(ctx, x - w / 2, y - h / 2, w, h, 4); ctx.stroke();
                ctx.fillStyle = 'rgba(60,70,56,.9)'; rrect(ctx, x - w / 2 + 8, y - h / 2 + 8, w - 16, h - 16, 2); ctx.fill();
                ctx.fillStyle = 'rgba(222,184,96,.35)';
                ctx.beginPath(); ctx.arc(x, y - h * 0.12, w * 0.16, 0, TAU); ctx.fill();
                ctx.beginPath(); ctx.ellipse(x, y + h * 0.3, w * 0.26, h * 0.16, 0, Math.PI, TAU); ctx.fill();
                ctx.restore();
            });
            T.halo(ctx, T.PX, T.PY - 140, 380, 'rgba(255,230,170,.16)');
        },
        cadre(ctx, T) {
            const { W, H } = T;
            doubleCadre(ctx, T, T.dorure(ctx, 0, 0, W, H), 9, 'rgba(222,184,96,.5)');
            for (let x = 70; x < W - 50; x += 24) { disque(ctx, x, 48, 2.4, 'rgba(222,184,96,.7)'); disque(ctx, x, H - 48, 2.4, 'rgba(222,184,96,.7)'); }
        },
        anneau(ctx, T) {
            const { PX, PY, PR } = T;
            ctx.save(); ctx.lineWidth = 10; ctx.strokeStyle = T.dorure(ctx, PX - PR, PY - PR, PX + PR, PY + PR); ctx.beginPath(); ctx.arc(PX, PY, PR + 6, 0, TAU); ctx.stroke(); ctx.restore();
            for (let i = 0; i < 36; i++) { const a = TAU * i / 36; disque(ctx, PX + Math.cos(a) * (PR + 18), PY + Math.sin(a) * (PR + 18), 2.6, 'rgba(222,184,96,.8)'); }
        }
    });

    STYLES.push({
        id: 'dresseur', nom: '🐾 Dresseur', exploit: 'compagnon', entete: 'JAMAIS SEUL', sceau: 'Un compagnon à ses côtés', indice: 'On ne part jamais seul.',
        palette: { fondA: [28, 48, 28], fondB: [6, 12, 6], or: [176, 206, 116], encre: [240, 246, 228], primaire: [70, 110, 50] },
        fond(ctx, T) {
            T.halo(ctx, T.PX, T.PY, 460, 'rgba(176,206,116,.14)');
            for (let i = 0; i < 10; i++) patte(ctx, 150 + i * 88, 1225 - (i % 2) * 30 - i * 8, 13, 1.2, 'rgba(176,206,116,.16)');
            semis(T, 18, (x, y, k) => T.feuille(ctx, x, y, 10 + k * 14, k * TAU, `rgba(120,170,80,${0.12 + k * 0.2})`));
        },
        cadre(ctx, T) {
            const { W, H } = T;
            doubleCadre(ctx, T, 'rgba(176,206,116,.75)', 3, 'rgba(176,206,116,.3)');
            const f = (x, y, a) => T.feuille(ctx, x, y, 13, a, 'rgba(120,170,80,.85)');
            for (let x = 90; x < W - 70; x += 70) { f(x, 30, 0.5); f(x + 20, 30, -0.5); f(x, H - 30, -0.5); f(x + 20, H - 30, 0.5); }
            for (let y = 110; y < H - 90; y += 70) { f(30, y, 1.1); f(30, y + 20, 2.0); f(W - 30, y, 2.0); f(W - 30, y + 20, 1.1); }
        },
        anneau(ctx, T) {
            const { PX, PY, PR } = T;
            cercle(ctx, PX, PY, PR + 4, 'rgba(176,206,116,.9)', 4);
            for (let i = 0; i < 10; i++) { const a = TAU * i / 10; T.feuille(ctx, PX + Math.cos(a) * (PR + 20), PY + Math.sin(a) * (PR + 20), 12, a + Math.PI / 2.4, 'rgba(120,170,80,.85)'); }
            patte(ctx, PX + PR * 0.78, PY + PR * 0.78, 22, -0.6, 'rgba(240,246,228,.9)');
        }
    });

    // =====================================================
    // LE CALENDRIER ET LA FIDÉLITÉ
    // =====================================================
    STYLES.push({
        id: 'citrouille', nom: '🎃 Citrouille', exploit: 'halloween', entete: 'NUIT DES OMBRES', sceau: 'Présent un 31 octobre', indice: 'Une nuit d’automne particulière.',
        palette: { fondA: [44, 22, 8], fondB: [8, 4, 1], or: [255, 146, 44], encre: [255, 238, 214], primaire: [160, 70, 10] },
        fond(ctx, T) {
            const { W, H } = T;
            T.halo(ctx, W / 2, H + 40, 640, 'rgba(255,120,20,.22)');
            coins(ctx, T, c => toile(c, 170, 'rgba(236,226,210,.35)'), 34);
            [[150, 1232, 52], [930, 1236, 44]].forEach(([x, y, s]) => { ctx.save(); lueur(ctx, T, 'rgba(255,140,40,.6)', 14); citrouille(ctx, x, y, s); ctx.restore(); });
            [[230, 200, 26], [860, 150, 20], [950, 300, 16]].forEach(([x, y, s]) => chauveSouris(ctx, x, y, s, 'rgba(10,5,2,.9)'));
        },
        cadre(ctx, T) { doubleCadre(ctx, T, T.css(T.p.or, 0.8), 3, T.css(T.p.or, 0.3), [16, 8]); },
        anneau(ctx, T) { anneauBrillant(ctx, T, T.css(T.p.or), 5, 'rgba(255,146,44,.35)'); }
    });

    STYLES.push({
        id: 'hivernal', nom: '❄️ Hivernal', exploit: 'noel', entete: 'CŒUR D’HIVER', sceau: 'Présent au cœur de l’hiver', indice: 'Quand il neige sur la taverne.',
        palette: { fondA: [24, 46, 72], fondB: [6, 12, 22], or: [204, 236, 255], encre: [242, 248, 255], primaire: [70, 120, 170] },
        fond(ctx, T) {
            const { W, H } = T;
            T.halo(ctx, T.PX, T.PY, 460, 'rgba(204,236,255,.14)');
            semis(T, 36, (x, y, k) => flocon(ctx, x, y, 5 + k * 14, `rgba(230,244,255,${0.15 + k * 0.4})`));
            // Une congère au pied de la carte
            ctx.fillStyle = 'rgba(236,246,255,.16)'; ctx.beginPath(); ctx.moveTo(0, H);
            for (let x = 0; x <= W; x += 60) ctx.quadraticCurveTo(x + 30, H - 80 - (x % 120 ? 20 : 0), x + 60, H - 60);
            ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
        },
        cadre(ctx, T) {
            doubleCadre(ctx, T, 'rgba(204,236,255,.8)', 3, 'rgba(204,236,255,.3)');
            coins(ctx, T, c => {
                c.strokeStyle = 'rgba(230,244,255,.7)'; c.lineWidth = 2;
                [[0, 0, 60, 60], [20, 0, 38, 26], [0, 20, 26, 38], [30, 30, 52, 30], [30, 30, 30, 52]].forEach(([a, b, x2, y2]) => { c.beginPath(); c.moveTo(a, b); c.lineTo(x2, y2); c.stroke(); });
                flocon(c, 0, 0, 14, 'rgba(240,250,255,.95)');
            });
        },
        anneau(ctx, T) {
            const { PX, PY, PR } = T;
            anneauBrillant(ctx, T, 'rgba(220,242,255,.95)', 4, 'rgba(204,236,255,.35)');
            for (let i = 0; i < 6; i++) { const a = TAU * i / 6 - Math.PI / 2; flocon(ctx, PX + Math.cos(a) * (PR + 22), PY + Math.sin(a) * (PR + 22), 9, 'rgba(240,250,255,.9)'); }
        },
        devant(ctx, T) { semis(T, 22, (x, y, k) => disque(ctx, x, y, 1.5 + k * 3, `rgba(255,255,255,${0.25 + k * 0.4})`)); }
    });

    STYLES.push({
        id: 'farceur', nom: '🤡 Farceur', exploit: 'avril', entete: 'BOUFFON DU ROI', sceau: 'Présent un 1er avril', indice: 'Un jour où rien n’est sérieux.',
        palette: { fondA: [48, 12, 28], fondB: [10, 3, 6], or: [244, 204, 84], encre: [252, 242, 224], primaire: [150, 30, 60] },
        fond(ctx, T) {
            const { W, H } = T, L = 90, D = 130;
            // Les losanges de l'habit d'arlequin
            for (let r = 0, y = 0; y < H + D; y += D / 2, r++) {
                for (let x = r % 2 ? L / 2 : 0, c = 0; x < W + L; x += L, c++) {
                    ctx.fillStyle = (c + r) % 2 ? 'rgba(170,30,60,.14)' : 'rgba(40,140,90,.12)';
                    ctx.beginPath(); ctx.moveTo(x, y - D / 2); ctx.lineTo(x + L / 2, y); ctx.lineTo(x, y + D / 2); ctx.lineTo(x - L / 2, y); ctx.closePath(); ctx.fill();
                }
            }
        },
        cadre(ctx, T) {
            const { W, H, css, p } = T;
            doubleCadre(ctx, T, css(p.or, 0.8), 2.5, css(p.or, 0.3));
            for (let x = 80, i = 0; x < W - 60; x += 46, i++) {
                T.losange(ctx, x, 30, 8, i % 2 ? 'rgba(220,50,80,.9)' : 'rgba(60,170,110,.9)');
                T.losange(ctx, x, H - 30, 8, i % 2 ? 'rgba(60,170,110,.9)' : 'rgba(220,50,80,.9)');
            }
        },
        anneau(ctx, T) {
            const { PX, PY, PR, css, p } = T;
            cercle(ctx, PX, PY, PR + 4, css(p.or), 5); cercle(ctx, PX, PY, PR + 15, 'rgba(220,50,80,.6)', 3, [18, 12]);
            // Trois grelots
            [-2.4, -Math.PI / 2, -0.74].forEach(a => {
                const x = PX + Math.cos(a) * (PR + 24), y = PY + Math.sin(a) * (PR + 24);
                ctx.save(); lueur(ctx, T, css(p.or, 0.7), 8); disque(ctx, x, y, 9, css(p.or)); ctx.restore();
                disque(ctx, x, y + 3, 2.5, 'rgba(60,30,0,.8)');
            });
        }
    });

    STYLES.push({
        id: 'fidele', nom: '🕯️ Fidèle', exploit: 'fidele30', entete: 'FIDÈLE AU POSTE', sceau: 'Trente jours d’aventure', indice: 'Revenir, encore et encore.',
        palette: { fondA: [48, 40, 24], fondB: [10, 8, 5], or: [204, 174, 112], encre: [246, 238, 220], primaire: [120, 96, 56] },
        fond(ctx, T) {
            const { W, H, PX, PY, alea } = T;
            ctx.save(); ctx.globalAlpha = 0.08; ctx.fillStyle = '#ccae70';
            for (let i = 0; i < 60; i++) { const a = TAU * i / 60; ctx.beginPath(); ctx.moveTo(PX, PY); ctx.arc(PX, PY, 1100, a - 0.012, a + 0.012); ctx.closePath(); ctx.fill(); }
            ctx.restore();
            // L'usure : de fines rayures, comme sur un vieux médaillon
            ctx.strokeStyle = 'rgba(255,240,210,.05)'; ctx.lineWidth = 1;
            for (let i = 0; i < 40; i++) { const x = alea() * W, y = alea() * H, a = alea() * TAU, l = 20 + alea() * 70; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke(); }
        },
        cadre(ctx, T) {
            const { W, H, css, p } = T;
            doubleCadre(ctx, T, css(p.or, 0.85), 6, css(p.or, 0.4));
            [[W / 2, H - 30], [30, H / 2], [W - 30, H / 2], [38, 38], [W - 38, 38], [38, H - 38], [W - 38, H - 38]].forEach(([x, y]) => {
                disque(ctx, x, y, 12, 'rgb(60,48,26)'); cercle(ctx, x, y, 12, css(p.or), 2.5); T.etoile(ctx, x, y, 6, css(p.or));
            });
        },
        anneau(ctx, T) {
            const { PX, PY, PR, css, p } = T;
            cercle(ctx, PX, PY, PR + 5, css(p.or), 6);
            // Trente graduations, comme les jours d'un mois
            ctx.strokeStyle = css(p.or, 0.85);
            for (let i = 0; i < 30; i++) {
                const a = TAU * i / 30 - Math.PI / 2, l = i % 5 ? 8 : 16;
                ctx.lineWidth = i % 5 ? 1.6 : 3;
                ctx.beginPath(); ctx.moveTo(PX + Math.cos(a) * (PR + 12), PY + Math.sin(a) * (PR + 12)); ctx.lineTo(PX + Math.cos(a) * (PR + 12 + l), PY + Math.sin(a) * (PR + 12 + l)); ctx.stroke();
            }
        }
    });

    // =====================================================
    // LES DEUX DERNIERS SECRETS
    // =====================================================
    STYLES.push({
        id: 'liche', nom: '🧟 Liche', exploit: 'konami', entete: 'SEIGNEUR NON-MORT', sceau: 'Le vieux code a été entré', indice: 'Un vieux code de joueur.',
        palette: { fondA: [14, 30, 20], fondB: [2, 6, 4], or: [120, 255, 160], encre: [220, 255, 232], primaire: [40, 110, 70] },
        fond(ctx, T) {
            const { W, H, PX, PY, halo } = T;
            halo(ctx, PX, PY, 500, 'rgba(60,255,140,.16)'); halo(ctx, W / 2, H + 80, 700, 'rgba(60,255,140,.14)');
            ctx.save(); lueur(ctx, T, 'rgba(120,255,160,.7)', 10); cercleRunique(ctx, PX, PY, 250, 'rgba(120,255,160,.3)', 20); ctx.restore();
            ctx.strokeStyle = 'rgba(120,255,160,.1)'; ctx.lineWidth = 4;
            semis(T, 8, (x, y, k) => { ctx.beginPath(); ctx.moveTo(x, y + 120); ctx.bezierCurveTo(x - 60, y + 40, x + 60 * k, y - 20, x - 20, y - 140); ctx.stroke(); });
        },
        cadre(ctx, T) {
            doubleCadre(ctx, T, 'rgba(210,230,200,.6)', 3, 'rgba(120,255,160,.35)');
            coins(ctx, T, c => {
                os(c, 34, 0, 60, 0, 'rgba(220,232,210,.85)'); os(c, 0, 34, 60, Math.PI / 2, 'rgba(220,232,210,.85)');
                c.save(); lueur(c, T, 'rgba(120,255,160,.9)', 12); disque(c, 0, 0, 7, 'rgba(160,255,190,.95)'); c.restore();
            }, 40);
        },
        portrait(ctx, T) { const { PX, PY, PR } = T; ctx.globalCompositeOperation = 'color'; ctx.fillStyle = 'rgba(90,200,130,.45)'; ctx.fillRect(PX - PR, PY - PR, PR * 2, PR * 2); },
        anneau(ctx, T) { anneauBrillant(ctx, T, 'rgba(140,255,175,.95)', 4, 'rgba(120,255,160,.35)'); },
        nomDuHeros(ctx, T) { ctx.shadowColor = 'rgba(80,255,150,.8)'; ctx.shadowBlur = T.flou(28); ctx.fillStyle = T.css(T.p.encre); }
    });

    STYLES.push({
        id: 'os', nom: '🦴 Os', exploit: 'crane7', entete: 'ÇA CHATOUILLE', sceau: 'A chatouillé le crâne de l’accueil', indice: 'Le crâne de l’accueil est chatouilleux.',
        palette: { nuit: false, fondA: [238, 230, 210], fondB: [202, 190, 162], or: [118, 96, 64], encre: [48, 38, 26], primaire: [110, 80, 50] },
        fond(ctx, T) { semis(T, 22, (x, y, k) => os(ctx, x, y, 40 + k * 40, k * TAU, `rgba(150,130,100,${0.1 + k * 0.12})`)); },
        cadre(ctx, T) {
            const { W, H } = T, blanc = 'rgba(248,243,230,1)';
            doubleCadre(ctx, T, 'rgba(118,96,64,.75)', 3, 'rgba(118,96,64,.3)');
            ctx.save(); lueur(ctx, T, 'rgba(60,40,20,.45)', 5);
            for (let x = 110; x < W - 90; x += 110) { os(ctx, x, 30, 70, 0, blanc); os(ctx, x, H - 30, 70, 0, blanc); }
            for (let y = 130; y < H - 100; y += 110) { os(ctx, 30, y, 70, Math.PI / 2, blanc); os(ctx, W - 30, y, 70, Math.PI / 2, blanc); }
            ctx.restore();
        },
        anneau(ctx, T) {
            const { PX, PY, PR } = T;
            ctx.save(); lueur(ctx, T, 'rgba(60,40,20,.4)', 6);
            cercle(ctx, PX, PY, PR + 6, 'rgba(248,243,230,1)', 10);
            for (let i = 0; i < 12; i++) { const a = TAU * i / 12; disque(ctx, PX + Math.cos(a) * (PR + 6), PY + Math.sin(a) * (PR + 6), 7, 'rgba(248,243,230,1)'); }
            ctx.restore();
            cercle(ctx, PX, PY, PR + 6, 'rgba(118,96,64,.5)', 1.5, [22, 14]);
        }
    });

    // =====================================================
    // LA DEUXIÈME VAGUE — formes utiles à ces styles
    // =====================================================
    function flamme(ctx, x, y, h, w, c1, c2) {
        const g = ctx.createLinearGradient(0, y, 0, y - h); g.addColorStop(0, c1); g.addColorStop(1, c2);
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - w / 2, y);
        ctx.quadraticCurveTo(x - w * 0.6, y - h * 0.5, x + w * 0.1, y - h); ctx.quadraticCurveTo(x + w * 0.2, y - h * 0.45, x + w / 2, y);
        ctx.closePath(); ctx.fill();
    }
    function croix(ctx, x, y, s, c) { ctx.fillStyle = c; ctx.fillRect(x - s * 0.18, y - s / 2, s * 0.36, s); ctx.fillRect(x - s / 2, y - s * 0.18, s, s * 0.36); }
    function griffes(ctx, x, y, s, a, c) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.strokeStyle = c; ctx.lineCap = 'round';
        [-1, 0, 1].forEach(k => { ctx.lineWidth = s * 0.07; ctx.beginPath(); ctx.moveTo(k * s * 0.22 - s * 0.1, -s / 2); ctx.quadraticCurveTo(k * s * 0.22 + s * 0.12, 0, k * s * 0.22 - s * 0.05, s / 2); ctx.stroke(); });
        ctx.restore();
    }
    function eclat(ctx, T, x, y, r, n, c) {
        ctx.fillStyle = c; ctx.beginPath();
        for (let i = 0; i < n * 2; i++) { const a = TAU * i / (n * 2), rr = i % 2 ? r * (0.35 + T.alea() * 0.2) : r * (0.8 + T.alea() * 0.4); ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
        ctx.closePath(); ctx.fill();
    }
    function eclair(ctx, T, x1, y1, x2, y2, c, l) {
        ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = l; ctx.lineJoin = 'round'; lueur(ctx, T, c, 12);
        ctx.beginPath(); ctx.moveTo(x1, y1);
        for (let i = 1; i < 8; i++) { const t = i / 8; ctx.lineTo(x1 + (x2 - x1) * t + (T.alea() - 0.5) * 40, y1 + (y2 - y1) * t + (T.alea() - 0.5) * 40); }
        ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
    }
    function livres(ctx, T, x0, x1, base) {
        const teintes = ['#7a2828', '#2f4f6f', '#3f6a3a', '#8a6a2a', '#5a3a6a', '#6a4a2a'];
        for (let x = x0; x < x1;) {
            const w = 12 + T.alea() * 14, h = 60 + T.alea() * 55;
            ctx.fillStyle = teintes[Math.floor(T.alea() * teintes.length)]; ctx.globalAlpha = 0.75;
            ctx.fillRect(x, base - h, w - 2, h); ctx.globalAlpha = 1;
            ctx.fillStyle = 'rgba(214,176,110,.5)'; ctx.fillRect(x + 2, base - h + 10, w - 6, 2); ctx.fillRect(x + 2, base - 14, w - 6, 2);
            x += w;
        }
        ctx.fillStyle = 'rgba(90,60,30,.95)'; ctx.fillRect(x0 - 10, base, x1 - x0 + 20, 9);
    }
    function engrenage(ctx, x, y, r, n, c, l) {
        ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = l; ctx.beginPath();
        for (let i = 0; i < n * 4; i++) { const a = TAU * i / (n * 4), rr = (i % 4 === 0 || i % 4 === 1) ? r * 1.14 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
        ctx.closePath(); ctx.stroke(); cercle(ctx, x, y, r * 0.35, c, l); ctx.restore();
    }
    function chope(ctx, x, y, s) {
        ctx.save();
        const g = ctx.createLinearGradient(x - s / 2, 0, x + s / 2, 0); g.addColorStop(0, '#b8741c'); g.addColorStop(0.5, '#f0b040'); g.addColorStop(1, '#a86418');
        ctx.fillStyle = g; ctx.fillRect(x - s * 0.4, y - s * 0.6, s * 0.8, s * 1.1);
        ctx.strokeStyle = 'rgba(80,50,20,.9)'; ctx.lineWidth = s * 0.07; ctx.strokeRect(x - s * 0.4, y - s * 0.6, s * 0.8, s * 1.1);
        ctx.beginPath(); ctx.arc(x + s * 0.4, y - s * 0.05, s * 0.26, -Math.PI / 2, Math.PI / 2); ctx.stroke();
        ctx.fillStyle = '#fffaf0'; [-0.3, -0.05, 0.22].forEach((k, i) => { ctx.beginPath(); ctx.arc(x + k * s, y - s * 0.62, s * (0.2 + i * 0.02), 0, TAU); ctx.fill(); });
        ctx.restore();
    }
    function caisse(ctx, x, y, s) {
        ctx.save(); ctx.fillStyle = 'rgba(150,110,60,.9)'; ctx.fillRect(x, y, s, s);
        ctx.strokeStyle = 'rgba(70,48,24,.95)'; ctx.lineWidth = s * 0.07; ctx.strokeRect(x, y, s, s); ctx.strokeRect(x + s * 0.12, y + s * 0.12, s * 0.76, s * 0.76);
        ctx.beginPath(); ctx.moveTo(x + s * 0.12, y + s * 0.12); ctx.lineTo(x + s * 0.88, y + s * 0.88); ctx.stroke();
        ctx.restore();
    }
    function sapin(ctx, x, y, h, c) {
        ctx.fillStyle = c;
        [0, 1, 2].forEach(i => { const w = h * (0.5 - i * 0.1), b = y - i * h * 0.26; ctx.beginPath(); ctx.moveTo(x - w / 2, b); ctx.lineTo(x, b - h * 0.45); ctx.lineTo(x + w / 2, b); ctx.closePath(); ctx.fill(); });
        ctx.fillRect(x - h * 0.03, y, h * 0.06, h * 0.1);
    }
    function dents(ctx, x0, x1, y, taille, sens, c) {
        ctx.fillStyle = c; ctx.beginPath();
        for (let x = x0; x < x1; x += taille) { ctx.moveTo(x, y); ctx.lineTo(x + taille / 2, y + sens * taille * 0.9); ctx.lineTo(x + taille, y); }
        ctx.closePath(); ctx.fill();
    }

    // =====================================================
    // LA DEUXIÈME VAGUE — les styles
    // =====================================================
    STYLES.push({
        id: 'pyromane', nom: '🔥 Pyromane', exploit: 'pyromane', entete: 'ENFANT DU BRASIER', sceau: 'Dix boules de feu lancées', indice: 'Une certaine passion pour les explosions.',
        palette: { fondA: [70, 18, 6], fondB: [10, 2, 0], or: [255, 170, 60], encre: [255, 238, 214], primaire: [180, 50, 10] },
        fond(ctx, T) {
            const { W, H, alea } = T;
            T.halo(ctx, W / 2, H + 60, 760, 'rgba(255,110,20,.35)');
            for (let i = 0; i < 30; i++) flamme(ctx, 20 + i * 36 + alea() * 16, H + 10, 70 + alea() * 170, 44 + alea() * 36, 'rgba(255,190,70,.32)', 'rgba(255,70,10,0)');
            semis(T, 50, (x, y, k) => { ctx.save(); lueur(ctx, T, 'rgba(255,140,40,.9)', 8); disque(ctx, x, y, 1 + k * 2.4, `rgba(255,${150 + Math.round(k * 80)},60,${0.3 + k * 0.5})`); ctx.restore(); }, [60, 420, W - 60, H - 60]);
        },
        cadre(ctx, T) { const g = ctx.createLinearGradient(0, T.H, 0, 0); g.addColorStop(0, '#ffcf6a'); g.addColorStop(0.5, '#ff6a1a'); g.addColorStop(1, '#8a1a04'); doubleCadre(ctx, T, g, 6, 'rgba(255,170,60,.4)'); },
        anneau(ctx, T) {
            const { PX, PY, PR } = T;
            for (let i = 0; i < 14; i++) { const a = Math.PI + Math.PI * i / 13; flamme(ctx, PX + Math.cos(a) * (PR + 6), PY + Math.sin(a) * (PR + 6) + 6, 26 + (i % 3) * 8, 16, 'rgba(255,200,80,.85)', 'rgba(255,80,20,0)'); }
            anneauBrillant(ctx, T, 'rgba(255,150,50,.95)', 5, 'rgba(255,170,60,.35)');
        },
        nomDuHeros(ctx, T, l) { const g = ctx.createLinearGradient(0, 500, 0, 570); g.addColorStop(0, '#ffe08a'); g.addColorStop(1, '#ff6a1a'); ctx.shadowColor = 'rgba(255,120,30,.8)'; ctx.shadowBlur = T.flou(26); ctx.fillStyle = g; }
    });

    STYLES.push({
        id: 'soigneur', nom: '✨ Soigneur', exploit: 'soigneur', entete: 'MAIN DE LUMIÈRE', sceau: '500 points de vie rendus', indice: 'Remettre les autres debout, encore et encore.',
        palette: { nuit: false, fondA: [250, 246, 232], fondB: [222, 210, 178], or: [176, 132, 40], encre: [48, 38, 20], primaire: [140, 100, 30] },
        fond(ctx, T) {
            const { W, PX, PY } = T;
            ctx.save(); ctx.globalAlpha = 0.12; ctx.fillStyle = '#e8c46a';
            for (let i = 0; i < 28; i++) { const a = Math.PI * 0.1 + Math.PI * 0.8 * i / 27; ctx.beginPath(); ctx.moveTo(W / 2, -60); ctx.arc(W / 2, -60, 1500, a - 0.015, a + 0.015); ctx.closePath(); ctx.fill(); }
            ctx.restore();
            T.halo(ctx, PX, PY, 420, 'rgba(255,255,240,.7)');
            semis(T, 18, (x, y, k) => croix(ctx, x, y, 10 + k * 16, `rgba(176,132,40,${0.1 + k * 0.15})`));
        },
        cadre(ctx, T) { const { W, H } = T; doubleCadre(ctx, T, T.dorure(ctx, 0, 0, W, H), 4, 'rgba(176,132,40,.4)'); [[W / 2, 30], [W / 2, H - 30], [30, H / 2], [W - 30, H / 2]].forEach(([x, y]) => croix(ctx, x, y, 22, '#b0842a')); },
        anneau(ctx, T) { const { PX, PY, PR } = T; ctx.save(); lueur(ctx, T, 'rgba(255,240,180,1)', 30); cercle(ctx, PX, PY, PR + 4, '#c89a3a', 5); ctx.restore(); cercle(ctx, PX, PY, PR + 18, 'rgba(176,132,40,.4)', 1.6); }
    });

    STYLES.push({
        id: 'increvable', nom: '🩸 Increvable', exploit: 'increvable', entete: 'INCREVABLE', sceau: '1 000 dégâts encaissés', indice: 'Encaisser, encore et encore.',
        palette: { fondA: [60, 10, 14], fondB: [10, 1, 2], or: [220, 90, 80], encre: [250, 230, 226], primaire: [140, 20, 30] },
        fond(ctx, T) {
            T.halo(ctx, T.PX, T.PY, 460, 'rgba(160,20,30,.3)');
            [[180, 360, 150, -0.4], [900, 700, 180, 0.5], [230, 1050, 130, 0.2], [880, 200, 110, -0.2]].forEach(([x, y, s, a]) => griffes(ctx, x, y, s, a, 'rgba(10,0,0,.45)'));
            fissuresSimples(ctx, T, 3);
        },
        cadre(ctx, T) {
            const { W, H, rrect } = T;
            ctx.strokeStyle = 'rgba(30,4,6,.95)'; ctx.lineWidth = 14; rrect(ctx, 34, 34, W - 68, H - 68, 12); ctx.stroke();
            ctx.strokeStyle = 'rgba(220,90,80,.6)'; ctx.lineWidth = 2; rrect(ctx, 50, 50, W - 100, H - 100, 10); ctx.stroke();
            // Des entailles dans le cadre
            ctx.strokeStyle = 'rgba(220,90,80,.8)'; ctx.lineWidth = 3;
            [[200, 34], [640, 34], [W - 34, 400], [W - 34, 980], [380, H - 34], [34, 760]].forEach(([x, y]) => { ctx.beginPath(); ctx.moveTo(x - 10, y - 10); ctx.lineTo(x + 10, y + 10); ctx.stroke(); });
        },
        anneau(ctx, T) {
            const { PX, PY, PR } = T;
            cercle(ctx, PX, PY, PR + 6, 'rgba(30,4,6,.95)', 10); cercle(ctx, PX, PY, PR + 6, 'rgba(220,90,80,.8)', 2);
            // Des points de suture qui tiennent le tout
            ctx.strokeStyle = 'rgba(250,230,226,.85)'; ctx.lineWidth = 2.4;
            for (let i = 0; i < 20; i++) { const a = TAU * i / 20; const cx = PX + Math.cos(a) * (PR + 6), cy = PY + Math.sin(a) * (PR + 6); ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 9, cy + Math.sin(a) * 9); ctx.lineTo(cx - Math.cos(a) * 9, cy - Math.sin(a) * 9); ctx.stroke(); }
        }
    });

    STYLES.push({
        id: 'dormeur', nom: '💤 Dormeur', exploit: 'dormeur', entete: 'GRAND DORMEUR', sceau: 'Vingt-cinq repos longs', indice: 'Rien ne vaut une bonne nuit de sommeil.',
        palette: { fondA: [26, 30, 70], fondB: [6, 6, 18], or: [200, 190, 255], encre: [236, 234, 255], primaire: [90, 80, 170] },
        fond(ctx, T) {
            const { W, H, CINZEL } = T;
            semis(T, 70, (x, y, k) => disque(ctx, x, y, 0.6 + k * 1.4, `rgba(255,255,255,${0.2 + k * 0.5})`));
            ctx.save(); lueur(ctx, T, 'rgba(236,230,190,.7)', 20); croissant(ctx, 150, 200, 42, 'rgba(240,232,200,.9)'); ctx.restore();
            ctx.fillStyle = 'rgba(200,190,255,.55)'; ctx.textAlign = 'center';
            [[850, 230, 64], [920, 170, 44], [970, 125, 30]].forEach(([x, y, t]) => { ctx.font = `700 ${t}px ${CINZEL}`; ctx.fillText('Z', x, y); });
            ctx.fillStyle = 'rgba(170,160,230,.13)';
            for (let x = -40; x < W + 80; x += 110) { ctx.beginPath(); ctx.arc(x, H - 30 - (x % 220 ? 10 : 40), 90, 0, TAU); ctx.fill(); }
        },
        cadre(ctx, T) { doubleCadre(ctx, T, 'rgba(200,190,255,.7)', 3, 'rgba(200,190,255,.3)', [2, 10]); },
        anneau(ctx, T) { anneauBrillant(ctx, T, 'rgba(210,200,255,.95)', 4); cercle(ctx, T.PX, T.PY, T.PR + 17, 'rgba(200,190,255,.4)', 2, [1, 9]); }
    });

    STYLES.push({
        id: 'feudecamp', nom: '🏕️ Feu de camp', exploit: 'feudecamp', entete: 'AU COIN DU FEU', sceau: 'Vingt-cinq repos courts', indice: 'Une petite pause, et on repart.',
        palette: { fondA: [22, 34, 26], fondB: [4, 6, 4], or: [255, 180, 90], encre: [246, 236, 220], primaire: [120, 80, 40] },
        fond(ctx, T) {
            const { W, H, alea } = T;
            semis(T, 60, (x, y, k) => disque(ctx, x, y, 0.6 + k * 1.3, `rgba(255,250,230,${0.15 + k * 0.45})`), [40, 40, W - 40, 520]);
            T.halo(ctx, W / 2, H + 40, 620, 'rgba(255,140,50,.3)');
            for (let i = 0; i < 6; i++) { sapin(ctx, 60 + i * 42 + alea() * 12, H - 40, 180 + alea() * 120, 'rgba(4,10,6,.92)'); sapin(ctx, W - 60 - i * 42 - alea() * 12, H - 40, 180 + alea() * 120, 'rgba(4,10,6,.92)'); }
            semis(T, 24, (x, y, k) => disque(ctx, x, y, 1 + k * 2, `rgba(255,170,70,${0.3 + k * 0.5})`), [360, 1000, 720, 1300]);
        },
        cadre(ctx, T) { doubleCadre(ctx, T, 'rgba(255,180,90,.7)', 3, 'rgba(255,180,90,.3)'); },
        anneau(ctx, T) { anneauBrillant(ctx, T, 'rgba(255,180,90,.95)', 4, 'rgba(255,180,90,.3)'); }
    });

    STYLES.push({
        id: 'coupfatal', nom: '💥 Coup fatal', exploit: 'coupfatal', entete: 'COUP FATAL', sceau: '100 dégâts en un seul coup', indice: 'Un seul coup. Un très, très gros coup.',
        palette: { fondA: [30, 6, 6], fondB: [4, 0, 0], or: [255, 80, 60], encre: [255, 236, 230], primaire: [150, 10, 10] },
        fond(ctx, T) {
            const { PX, PY, W, H } = T;
            ctx.save(); ctx.strokeStyle = 'rgba(255,80,60,.14)'; ctx.lineWidth = 3;
            for (let i = 0; i < 40; i++) { const a = TAU * i / 40, r1 = 260 + T.alea() * 60; ctx.beginPath(); ctx.moveTo(PX + Math.cos(a) * r1, PY + Math.sin(a) * r1); ctx.lineTo(PX + Math.cos(a) * 1200, PY + Math.sin(a) * 1200); ctx.stroke(); }
            ctx.restore();
            ctx.save(); lueur(ctx, T, 'rgba(255,60,40,.8)', 30); eclat(ctx, T, PX, PY, 300, 14, 'rgba(160,10,10,.55)'); ctx.restore();
            semis(T, 16, (x, y, k) => { ctx.save(); ctx.translate(x, y); ctx.rotate(k * TAU); ctx.fillStyle = `rgba(255,120,100,${0.15 + k * 0.3})`; ctx.beginPath(); ctx.moveTo(0, -14 - k * 20); ctx.lineTo(6 + k * 8, 10); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill(); ctx.restore(); }, [60, 560, W - 60, H - 80]);
        },
        cadre(ctx, T) {
            const { W, H } = T, c = 46;
            ctx.strokeStyle = 'rgba(255,80,60,.85)'; ctx.lineWidth = 4; ctx.beginPath();
            ctx.moveTo(30 + c, 30); ctx.lineTo(W - 30 - c, 30); ctx.lineTo(W - 30, 30 + c); ctx.lineTo(W - 30, H - 30 - c); ctx.lineTo(W - 30 - c, H - 30); ctx.lineTo(30 + c, H - 30); ctx.lineTo(30, H - 30 - c); ctx.lineTo(30, 30 + c); ctx.closePath(); ctx.stroke();
            ctx.strokeStyle = 'rgba(255,80,60,.3)'; ctx.lineWidth = 1.5; ctx.strokeRect(50, 50, W - 100, H - 100);
        },
        anneau(ctx, T) {
            const { PX, PY, PR } = T;
            anneauBrillant(ctx, T, 'rgba(255,90,70,.95)', 5);
            ctx.fillStyle = 'rgba(255,90,70,.9)';
            for (let i = 0; i < 8; i++) { const a = TAU * i / 8 + Math.PI / 8; ctx.beginPath(); ctx.moveTo(PX + Math.cos(a - 0.06) * (PR + 8), PY + Math.sin(a - 0.06) * (PR + 8)); ctx.lineTo(PX + Math.cos(a) * (PR + 36), PY + Math.sin(a) * (PR + 36)); ctx.lineTo(PX + Math.cos(a + 0.06) * (PR + 8), PY + Math.sin(a + 0.06) * (PR + 8)); ctx.closePath(); ctx.fill(); }
        }
    });

    STYLES.push({
        id: 'surcharge', nom: '⚡ Surcharge', exploit: 'surcharge', entete: 'SURCHARGE ARCANIQUE', sceau: 'Tous ses emplacements de sort vidés', indice: 'Jusqu’au dernier emplacement de sort.',
        palette: { fondA: [40, 10, 70], fondB: [6, 2, 14], or: [220, 130, 255], encre: [248, 236, 255], primaire: [120, 40, 190] },
        fond(ctx, T) {
            const { PX, PY, W, H } = T;
            T.halo(ctx, PX, PY, 520, 'rgba(190,90,255,.24)');
            [[60, 120], [W - 60, 160], [80, H - 200], [W - 90, H - 140], [W / 2, H - 40]].forEach(([x, y]) => eclair(ctx, T, PX, PY, x, y, 'rgba(230,170,255,.55)', 3));
            semis(T, 60, (x, y, k) => disque(ctx, x, y, 1 + k * 2, `rgba(230,180,255,${0.2 + k * 0.5})`));
        },
        cadre(ctx, T) { doubleCadre(ctx, T, 'rgba(220,130,255,.8)', 3, 'rgba(220,130,255,.3)', [20, 6, 4, 6]); coins(ctx, T, c => eclair(c, T, -8, -8, 40, 40, 'rgba(240,200,255,.9)', 2.5)); },
        anneau(ctx, T) { anneauBrillant(ctx, T, 'rgba(230,160,255,1)', 4); cercle(ctx, T.PX, T.PY, T.PR + 17, 'rgba(220,130,255,.7)', 3, [26, 12]); }
    });

    STYLES.push({
        id: 'erudit', nom: '📚 Érudit', exploit: 'erudit', entete: 'RAT DE BIBLIOTHÈQUE', sceau: 'Cent fiches de règles lues', indice: 'Tout lire. Absolument tout.',
        palette: { fondA: [44, 30, 20], fondB: [10, 6, 4], or: [214, 176, 110], encre: [246, 234, 214], primaire: [110, 60, 30] },
        fond(ctx, T) {
            T.halo(ctx, T.PX, T.PY, 440, 'rgba(255,210,140,.14)');
            [250, 400, 540].forEach(b => { livres(ctx, T, 70, 250, b); livres(ctx, T, 830, 1010, b); });
        },
        cadre(ctx, T) { const { W, H, rrect } = T; ctx.strokeStyle = 'rgba(90,60,30,.95)'; ctx.lineWidth = 12; rrect(ctx, 34, 34, W - 68, H - 68, 10); ctx.stroke(); ctx.strokeStyle = 'rgba(214,176,110,.6)'; ctx.lineWidth = 2; rrect(ctx, 48, 48, W - 96, H - 96, 8); ctx.stroke(); },
        anneau(ctx, T) { const { PX, PY, PR } = T; ctx.save(); ctx.lineWidth = 7; ctx.strokeStyle = T.dorure(ctx, PX - PR, PY - PR, PX + PR, PY + PR); ctx.beginPath(); ctx.arc(PX, PY, PR + 5, 0, TAU); ctx.stroke(); ctx.restore(); }
    });

    STYLES.push({
        id: 'bestiaire', nom: '🐺 Bestiaire', exploit: 'bestiaire', entete: 'CHASSEUR DE MONSTRES', sceau: 'Trente monstres étudiés', indice: 'Connaître chaque créature du manuel.',
        palette: { fondA: [30, 40, 24], fondB: [6, 8, 4], or: [196, 210, 120], encre: [238, 242, 222], primaire: [90, 110, 50] },
        fond(ctx, T) {
            const { W, H } = T;
            [[200, 700, 170, 0.3], [880, 380, 150, -0.3], [860, 1080, 120, 0.1]].forEach(([x, y, s, a]) => griffes(ctx, x, y, s, a, 'rgba(0,0,0,.35)'));
            // Des yeux qui brillent dans l'ombre des bords
            [[110, 260], [W - 120, 560], [140, 940], [W - 150, 1180]].forEach(([x, y]) => { ctx.save(); lueur(ctx, T, 'rgba(230,220,80,.9)', 10); [-12, 12].forEach(dx => { ctx.fillStyle = 'rgba(240,230,110,.85)'; ctx.beginPath(); ctx.ellipse(x + dx, y, 6, 3.5, 0, 0, TAU); ctx.fill(); }); ctx.restore(); });
        },
        cadre(ctx, T) { const { W, H } = T; doubleCadre(ctx, T, 'rgba(196,210,120,.7)', 3, 'rgba(196,210,120,.3)'); dents(ctx, 80, W - 80, 32, 28, 1, 'rgba(236,232,210,.85)'); dents(ctx, 80, W - 80, H - 32, 28, -1, 'rgba(236,232,210,.85)'); },
        anneau(ctx, T) {
            const { PX, PY, PR } = T;
            cercle(ctx, PX, PY, PR + 5, 'rgba(196,210,120,.9)', 5);
            ctx.fillStyle = 'rgba(240,236,214,.95)';
            [-Math.PI / 2 - 0.25, -Math.PI / 2 + 0.25, Math.PI / 2 - 0.25, Math.PI / 2 + 0.25].forEach(a => { const x = PX + Math.cos(a) * (PR + 5), y = PY + Math.sin(a) * (PR + 5), sn = Math.sin(a) < 0 ? 1 : -1; ctx.beginPath(); ctx.moveTo(x - 8, y); ctx.lineTo(x, y + sn * 26); ctx.lineTo(x + 8, y); ctx.closePath(); ctx.fill(); });
        }
    });

    STYLES.push({
        id: 'mimique', nom: '🧰 Mimique', exploit: 'mimique', entete: 'PAS UN COFFRE', sceau: 'A ouvert le mauvais coffre', indice: 'Méfie-toi de ce que tu cherches dans les règles.',
        palette: { fondA: [60, 36, 18], fondB: [14, 8, 3], or: [226, 176, 90], encre: [250, 238, 220], primaire: [120, 70, 30] },
        fond(ctx, T) {
            const { W, H, alea } = T;
            ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 3;
            for (let y = 0; y < H; y += 90) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
            ctx.strokeStyle = 'rgba(255,220,160,.05)'; ctx.lineWidth = 1.5;
            for (let i = 0; i < 40; i++) { const y = alea() * H, x = alea() * W; ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x + 60, y + 6, x + 120, y - 6, x + 200, y); ctx.stroke(); }
            [470, 880].forEach(y => { ctx.fillStyle = 'rgba(30,24,20,.55)'; ctx.fillRect(0, y, W, 26); for (let x = 60; x < W; x += 140) rivet(ctx, x, y + 13, 5, '#9a8a70'); });
        },
        cadre(ctx, T) {
            const { W, H } = T;
            doubleCadre(ctx, T, 'rgba(40,30,22,.95)', 12, 'rgba(226,176,90,.5)');
            // Le cadre est une bouche
            dents(ctx, 70, W - 70, 40, 30, 1, 'rgba(244,239,226,.95)'); dents(ctx, 70, W - 70, H - 40, 30, -1, 'rgba(244,239,226,.95)');
            coins(ctx, T, c => { c.fillStyle = 'rgba(40,30,22,.95)'; c.fillRect(-30, -30, 70, 14); c.fillRect(-30, -30, 14, 70); rivet(c, -23, -23, 5, '#b8a888'); }, 40);
        },
        anneau(ctx, T) { const { PX, PY, PR } = T; cercle(ctx, PX, PY, PR + 6, 'rgba(40,30,22,.95)', 12); cercle(ctx, PX, PY, PR + 6, 'rgba(226,176,90,.7)', 2); for (let i = 0; i < 10; i++) { const a = TAU * i / 10; rivet(ctx, PX + Math.cos(a) * (PR + 6), PY + Math.sin(a) * (PR + 6), 4.5, '#c8b898'); } }
    });

    STYLES.push({
        id: 'tavernier', nom: '🍺 Tavernier', exploit: 'tavernier', entete: 'HABITUÉ DE LA TAVERNE', sceau: 'Dix boissons dans le sac', indice: 'Le sac tinte quand on marche.',
        palette: { fondA: [58, 34, 16], fondB: [12, 6, 2], or: [240, 190, 90], encre: [252, 240, 220], primaire: [130, 70, 20] },
        fond(ctx, T) {
            const { W, H, PY } = T;
            ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.lineWidth = 3;
            for (let x = 0; x < W; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
            T.halo(ctx, T.PX, PY, 420, 'rgba(255,190,90,.18)');
            chope(ctx, 180, PY + 20, 90); chope(ctx, W - 180, PY + 20, 90);
            semis(T, 30, (x, y, k) => cercle(ctx, x, y, 2 + k * 6, `rgba(255,250,235,${0.1 + k * 0.2})`, 1.2));
        },
        cadre(ctx, T) { const { W, H, rrect } = T; ctx.strokeStyle = 'rgba(70,40,16,.95)'; ctx.lineWidth = 16; rrect(ctx, 34, 34, W - 68, H - 68, 14); ctx.stroke(); ctx.strokeStyle = 'rgba(240,190,90,.55)'; ctx.lineWidth = 2; rrect(ctx, 52, 52, W - 104, H - 104, 10); ctx.stroke(); },
        anneau(ctx, T) { const { PX, PY, PR } = T; anneauBrillant(ctx, T, 'rgba(240,180,70,.95)', 6); for (let i = 0; i < 9; i++) { const a = Math.PI * 1.15 + Math.PI * 0.7 * i / 8; disque(ctx, PX + Math.cos(a) * (PR + 10), PY + Math.sin(a) * (PR + 10), 9 + (i % 3) * 3, 'rgba(255,250,240,.92)'); } }
    });

    STYLES.push({
        id: 'horloger', nom: '⚙️ Horloger', exploit: 'horloger', entete: 'MAÎTRE DU TEMPS', sceau: 'Trois heures sur une fiche', indice: 'Perdre la notion du temps sur sa fiche.',
        palette: { fondA: [40, 34, 26], fondB: [8, 6, 4], or: [214, 176, 96], encre: [244, 236, 220], primaire: [120, 90, 40] },
        fond(ctx, T) {
            const { W, H, PX, PY } = T;
            engrenage(ctx, PX, PY, 250, 16, 'rgba(214,176,96,.16)', 10);
            engrenage(ctx, 110, 260, 120, 10, 'rgba(214,176,96,.2)', 7); engrenage(ctx, W - 130, 1000, 150, 12, 'rgba(214,176,96,.16)', 8); engrenage(ctx, 180, 1180, 80, 8, 'rgba(214,176,96,.18)', 6);
        },
        cadre(ctx, T) { doubleCadre(ctx, T, T.dorure(ctx, 0, 0, T.W, T.H), 6, 'rgba(214,176,96,.4)'); coins(ctx, T, c => engrenage(c, 0, 0, 16, 8, 'rgba(214,176,96,.9)', 2.5)); },
        anneau(ctx, T) {
            const { PX, PY, PR } = T;
            cercle(ctx, PX, PY, PR + 5, '#c8a258', 6);
            ctx.strokeStyle = 'rgba(214,176,96,.9)';
            for (let i = 0; i < 60; i++) { const a = TAU * i / 60, l = i % 5 ? 6 : 16; ctx.lineWidth = i % 5 ? 1.2 : 3; ctx.beginPath(); ctx.moveTo(PX + Math.cos(a) * (PR + 12), PY + Math.sin(a) * (PR + 12)); ctx.lineTo(PX + Math.cos(a) * (PR + 12 + l), PY + Math.sin(a) * (PR + 12 + l)); ctx.stroke(); }
        }
    });

    STYLES.push({
        id: 'lycan', nom: '🌕 Lycan', exploit: 'pleine-lune', entete: 'NUIT DE PLEINE LUNE', sceau: 'Présent un soir de pleine lune', indice: 'Quand la lune est ronde…',
        palette: { fondA: [20, 26, 44], fondB: [3, 4, 8], or: [220, 226, 240], encre: [236, 240, 250], primaire: [80, 90, 120] },
        fond(ctx, T) {
            const { W, H, alea } = T;
            T.halo(ctx, 820, 270, 360, 'rgba(220,226,240,.25)');
            ctx.save(); lueur(ctx, T, 'rgba(220,226,240,.8)', 40); disque(ctx, 820, 270, 170, 'rgba(232,236,244,.9)'); ctx.restore();
            semis(T, 9, (x, y, k) => disque(ctx, 820 + (x / W - 0.5) * 240, 270 + (y / H - 0.5) * 240, 8 + k * 18, 'rgba(180,186,200,.35)'));
            semis(T, 60, (x, y, k) => disque(ctx, x, y, 0.6 + k * 1.2, `rgba(255,255,255,${0.2 + k * 0.4})`), [40, 40, W - 40, 600]);
            for (let i = 0; i < 16; i++) sapin(ctx, i * 72 + alea() * 30, H - 30, 160 + alea() * 160, 'rgba(2,4,8,.9)');
        },
        cadre(ctx, T) { doubleCadre(ctx, T, 'rgba(220,226,240,.7)', 2.5, 'rgba(220,226,240,.3)'); },
        anneau(ctx, T) { anneauBrillant(ctx, T, 'rgba(232,236,246,.95)', 4, 'rgba(220,226,240,.35)'); }
    });

    STYLES.push({
        id: 'treize', nom: '🪞 Treize', exploit: 'vendredi13', entete: 'VENDREDI 13', sceau: 'Présent un vendredi 13', indice: 'Un jour où il vaut mieux ne pas sortir.',
        palette: { fondA: [40, 40, 46], fondB: [6, 6, 8], or: [200, 205, 215], encre: [242, 242, 246], primaire: [90, 90, 100] },
        fond(ctx, T) {
            const { W, H, alea, CINZEL } = T;
            ctx.save(); ctx.fillStyle = 'rgba(200,205,215,.06)'; ctx.font = `700 520px ${CINZEL}`; ctx.textAlign = 'center'; ctx.fillText('13', W / 2, H - 120); ctx.restore();
            // Un miroir brisé : un point d'impact, des rayons, des cercles cassés
            const x0 = 260, y0 = 860;
            ctx.strokeStyle = 'rgba(230,234,244,.28)'; ctx.lineWidth = 1.6;
            for (let i = 0; i < 18; i++) { const a = TAU * i / 18 + alea() * 0.2, l = 180 + alea() * 420; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + Math.cos(a) * l, y0 + Math.sin(a) * l); ctx.stroke(); }
            [40, 95, 170].forEach(r => { ctx.beginPath(); for (let i = 0; i <= 18; i++) { const a = TAU * i / 18, rr = r + (alea() - 0.5) * 14; if (i) ctx.lineTo(x0 + Math.cos(a) * rr, y0 + Math.sin(a) * rr); else ctx.moveTo(x0 + Math.cos(a) * rr, y0 + Math.sin(a) * rr); } ctx.stroke(); });
        },
        cadre(ctx, T) { doubleCadre(ctx, T, 'rgba(200,205,215,.75)', 3, 'rgba(200,205,215,.3)', [60, 6, 14, 6]); },
        anneau(ctx, T) {
            const { PX, PY, PR } = T;
            cercle(ctx, PX, PY, PR + 4, 'rgba(210,214,224,.9)', 4);
            ctx.strokeStyle = 'rgba(230,234,244,.6)'; ctx.lineWidth = 1.5;
            [0.4, 2.2, 3.9].forEach(a => { ctx.beginPath(); ctx.moveTo(PX + Math.cos(a) * (PR - 30), PY + Math.sin(a) * (PR - 30)); ctx.lineTo(PX + Math.cos(a + 0.1) * (PR + 26), PY + Math.sin(a + 0.1) * (PR + 26)); ctx.stroke(); });
        }
    });

    STYLES.push({
        id: 'demenageur', nom: '📦 Déménageur', exploit: 'demenageur', entete: 'BÊTE DE SOMME', sceau: 'Plus de 150 kg dans le sac', indice: 'Qui a besoin d’une mule ?',
        palette: { fondA: [70, 54, 34], fondB: [16, 12, 6], or: [226, 190, 120], encre: [250, 240, 222], primaire: [120, 90, 50] },
        fond(ctx, T) {
            const { W, H } = T;
            [[70, 1130, 110], [180, 1160, 80], [110, 1030, 90], [W - 180, 1130, 110], [W - 270, 1170, 80], [W - 150, 1030, 80]].forEach(([x, y, s]) => caisse(ctx, x, y, s));
            ctx.strokeStyle = 'rgba(210,180,120,.25)'; ctx.lineWidth = 5;
            [140, 180].forEach((y, i) => { ctx.beginPath(); ctx.moveTo(40, y); for (let x = 40; x < W - 40; x += 120) ctx.quadraticCurveTo(x + 60, y + (i ? -26 : 26), x + 120, y); ctx.stroke(); });
        },
        cadre(ctx, T) {
            const { W, H, rrect } = T;
            // Une corde tressée : deux brins en pointillés décalés
            ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(210,180,120,.9)'; ctx.setLineDash([14, 10]); rrect(ctx, 36, 36, W - 72, H - 72, 24); ctx.stroke();
            ctx.strokeStyle = 'rgba(150,120,70,.9)'; ctx.lineDashOffset = 12; rrect(ctx, 36, 36, W - 72, H - 72, 24); ctx.stroke();
            ctx.setLineDash([]); ctx.lineDashOffset = 0;
        },
        anneau(ctx, T) {
            const { PX, PY, PR } = T;
            ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(210,180,120,.95)'; ctx.setLineDash([12, 8]); ctx.beginPath(); ctx.arc(PX, PY, PR + 6, 0, TAU); ctx.stroke();
            ctx.strokeStyle = 'rgba(150,120,70,.95)'; ctx.lineDashOffset = 10; ctx.beginPath(); ctx.arc(PX, PY, PR + 6, 0, TAU); ctx.stroke();
            ctx.setLineDash([]); ctx.lineDashOffset = 0;
        }
    });

    // =====================================================
    // LA RARETÉ — affichée dans la vitrine de la carte
    // =====================================================
    const RARETES = {
        legendaire: ['epique', 'chanceux', 'chatnoir', 'jumeaux', 'veteran', 'archimage', 'coupfatal', 'surcharge', 'pyromane', 'horloger'],
        epique: ['astral', 'revenant', 'tresor', 'liche', 'forteresse', 'sommet', 'mendiant', 'armurier', 'chroniqueur', 'fidele', 'soigneur', 'increvable', 'dormeur', 'feudecamp', 'erudit', 'bestiaire', 'demenageur', 'lycan']
    };
    STYLES.forEach(s => { s.rarete = Object.keys(RARETES).find(r => RARETES[r].includes(s.id)) || 'rare'; });

    window.HeroCard.ajouterStyles(STYLES);
})();
