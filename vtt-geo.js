// =====================================================
// vtt-geo.js — Géométrie partagée MJ / joueur pour la
// carte tactique : murs, portes, ligne de vue (obscurité).
//   • Les murs sont stockés en FRACTIONS (0..1) de la carte :
//     { id, x1, y1, x2, y2, door:bool, open:bool }
//   • Un mur (ou une porte fermée) bloque le déplacement
//     des jetons joueurs ET la ligne de vue dans le noir.
// Utilisé par gm-screen.js (édition) et session.js (rendu joueur).
// =====================================================
(function () {
    'use strict';

    // Sens de rotation du triplet (a,b,c) : >0 anti-horaire, <0 horaire, 0 aligné
    function orient(ax, ay, bx, by, cx, cy) {
        return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    }
    // Vrai si les segments [a,b] et [c,d] se croisent (contact inclus)
    function segCross(ax, ay, bx, by, cx, cy, dx, dy) {
        const o1 = orient(ax, ay, bx, by, cx, cy);
        const o2 = orient(ax, ay, bx, by, dx, dy);
        const o3 = orient(cx, cy, dx, dy, ax, ay);
        const o4 = orient(cx, cy, dx, dy, bx, by);
        if (((o1 > 0 && o2 < 0) || (o1 < 0 && o2 > 0)) && ((o3 > 0 && o4 < 0) || (o3 < 0 && o4 > 0))) return true;
        // Cas colinéaires / extrémités posées pile sur le segment
        const on = (px, py, qx, qy, rx, ry) => Math.min(px, qx) - 1e-9 <= rx && rx <= Math.max(px, qx) + 1e-9 && Math.min(py, qy) - 1e-9 <= ry && ry <= Math.max(py, qy) + 1e-9;
        if (Math.abs(o1) < 1e-12 && on(ax, ay, bx, by, cx, cy)) return true;
        if (Math.abs(o2) < 1e-12 && on(ax, ay, bx, by, dx, dy)) return true;
        if (Math.abs(o3) < 1e-12 && on(cx, cy, dx, dy, ax, ay)) return true;
        if (Math.abs(o4) < 1e-12 && on(cx, cy, dx, dy, bx, by)) return true;
        return false;
    }

    // Murs qui bloquent physiquement / visuellement : murs pleins + portes FERMÉES
    function blockingWalls(walls) {
        return (walls || []).filter(w => w && !(w.door && w.open));
    }

    // Le trajet (x1,y1)→(x2,y2) traverse-t-il un mur ? (fractions : le croisement
    // est conservé par la mise à l'échelle, pas besoin de convertir en pixels)
    function moveBlocked(walls, x1, y1, x2, y2) {
        const bs = blockingWalls(walls);
        for (let i = 0; i < bs.length; i++) {
            const w = bs[i];
            if (segCross(x1, y1, x2, y2, w.x1, w.y1, w.x2, w.y2)) return true;
        }
        return false;
    }

    // Distance d'un point à un segment (même unité que les entrées)
    function distToSegment(px, py, ax, ay, bx, by) {
        const dx = bx - ax, dy = by - ay;
        const l2 = dx * dx + dy * dy;
        if (l2 <= 1e-12) return Math.hypot(px - ax, py - ay);
        let t = ((px - ax) * dx + (py - ay) * dy) / l2;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    }

    // Intersection rayon (origine o, direction d unitaire) / segment [a,b].
    // Renvoie la distance t (>0) ou Infinity.
    function rayHit(ox, oy, dx, dy, ax, ay, bx, by) {
        const ex = bx - ax, ey = by - ay;
        const den = dx * ey - dy * ex;
        if (Math.abs(den) < 1e-12) return Infinity;          // parallèles
        const t = ((ax - ox) * ey - (ay - oy) * ex) / den;   // le long du rayon
        const u = ((ax - ox) * dy - (ay - oy) * dx) / den;   // le long du segment
        if (t > 1e-6 && u >= -1e-6 && u <= 1 + 1e-6) return t;
        return Infinity;
    }

    // Polygone de visibilité depuis (cx,cy) EN PIXELS, limité au rayon R.
    // segs = murs bloquants convertis en pixels [{x1,y1,x2,y2}].
    // Retourne une liste ordonnée de points {x,y} (à tracer puis remplir).
    function visionPolygon(cx, cy, segs, R) {
        const angles = [];
        const N = 90;                                        // rayons uniformes (lisse le cercle)
        for (let i = 0; i < N; i++) angles.push((i / N) * Math.PI * 2);
        const margin = R * 1.6;
        (segs || []).forEach(s => {
            // Rayons vers chaque extrémité (± epsilon pour « glisser » derrière les coins)
            [[s.x1, s.y1], [s.x2, s.y2]].forEach(pt => {
                const dx = pt[0] - cx, dy = pt[1] - cy;
                if (Math.abs(dx) > margin || Math.abs(dy) > margin) return; // trop loin pour compter
                const a = Math.atan2(dy, dx);
                angles.push(a - 0.0008, a, a + 0.0008);
            });
        });
        angles.sort((a, b) => a - b);
        const pts = [];
        let lastA = null;
        for (let i = 0; i < angles.length; i++) {
            const a = angles[i];
            if (lastA !== null && Math.abs(a - lastA) < 1e-5) continue;  // doublons
            lastA = a;
            const dx = Math.cos(a), dy = Math.sin(a);
            let best = R;
            for (let j = 0; j < segs.length; j++) {
                const s = segs[j];
                const t = rayHit(cx, cy, dx, dy, s.x1, s.y1, s.x2, s.y2);
                if (t < best) best = t;
            }
            pts.push({ x: cx + dx * best, y: cy + dy * best });
        }
        return pts;
    }

    // Convertit les murs bloquants (fractions) en segments pixels pour un canvas w×h
    function wallsToPx(walls, w, h) {
        return blockingWalls(walls).map(s => ({ x1: s.x1 * w, y1: s.y1 * h, x2: s.x2 * w, y2: s.y2 * h }));
    }

    // Dessine la « lumière » d'un jeton dans un ctx en mode effacement :
    // clip sur le polygone de visibilité + dégradé radial (net au centre,
    // fondu au bord de la portée). ctx doit être en 'destination-out'.
    function eraseVision(ctx, cx, cy, segs, R) {
        const poly = visionPolygon(cx, cy, segs, R);
        if (!poly.length) return;
        ctx.save();
        ctx.beginPath();
        poly.forEach((p, i) => { i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y); });
        ctx.closePath();
        ctx.clip();
        const g = ctx.createRadialGradient(cx, cy, Math.max(1, R * 0.55), cx, cy, R);
        g.addColorStop(0, 'rgba(0,0,0,1)');      // alpha 1 = zone totalement dévoilée
        g.addColorStop(1, 'rgba(0,0,0,0)');      // fondu en bord de portée
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // Portée de vision d'un jeton en PIXELS : t.vision (m) sinon portée globale.
    // 1 case de grille = 1,5 m (5 pieds, D&D).
    function visionRadiusPx(token, dark, gridSize) {
        const meters = Number(token && token.vision) || Number(dark && dark.range) || 9;
        const cell = Number(dark && dark.cellM) || 1.5;
        return Math.max(8, (meters / cell) * (gridSize || 48));
    }

    // =====================================================
    // GABARITS DE SORTS (AoE) — dessin partagé MJ / joueur.
    // t = { kind:'circle'|'cone'|'line'|'cube', x,y (origine), x2,y2 (extrémité), color }
    // gridPx = taille d'une case en px du canvas ; cellM = mètres par case.
    // =====================================================
    function drawTemplates(ctx, w, h, templates, gridPx, cellM) {
        (templates || []).forEach(t => {
            const x1 = t.x * w, y1 = t.y * h, x2 = (t.x2 != null ? t.x2 : t.x) * w, y2 = (t.y2 != null ? t.y2 : t.y) * h;
            const dx = x2 - x1, dy = y2 - y1, dist = Math.hypot(dx, dy);
            if (dist < 2) return;
            const col = t.color || '#e67e22';
            ctx.save();
            ctx.globalAlpha = 0.28; ctx.fillStyle = col;
            ctx.beginPath();
            if (t.kind === 'cone') {
                // Cône D&D : longueur = largeur à l'extrémité → demi-angle atan(0.5)
                const a = Math.atan2(dy, dx), half = Math.atan(0.5);
                ctx.moveTo(x1, y1);
                ctx.arc(x1, y1, dist, a - half, a + half);
                ctx.closePath();
            } else if (t.kind === 'line') {
                const a = Math.atan2(dy, dx), lw = Math.max(6, gridPx * 0.5);
                const px = Math.sin(a) * lw / 2, py = -Math.cos(a) * lw / 2;
                ctx.moveTo(x1 + px, y1 + py); ctx.lineTo(x2 + px, y2 + py);
                ctx.lineTo(x2 - px, y2 - py); ctx.lineTo(x1 - px, y1 - py);
                ctx.closePath();
            } else if (t.kind === 'cube') {
                const side = Math.max(Math.abs(dx), Math.abs(dy));
                ctx.rect(x1, y1, side * (dx < 0 ? -1 : 1), side * (dy < 0 ? -1 : 1));
            } else {           // circle (sphère)
                ctx.arc(x1, y1, dist, 0, Math.PI * 2);
            }
            ctx.fill();
            ctx.globalAlpha = 0.9; ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
            ctx.stroke(); ctx.setLineDash([]);
            // Point d'origine + étiquette de taille en mètres
            ctx.beginPath(); ctx.arc(x1, y1, 4, 0, Math.PI * 2); ctx.fillStyle = col; ctx.globalAlpha = 1; ctx.fill();
            const meters = Math.round((dist / Math.max(1, gridPx)) * (cellM || 1.5) * 10) / 10;
            const label = meters.toLocaleString('fr-FR') + ' m';
            ctx.font = 'bold 12px Lora, serif';
            const tw = ctx.measureText(label).width;
            const lx = Math.max(2, Math.min(w - tw - 12, (x1 + x2) / 2 - tw / 2 - 5)), ly = Math.max(14, (y1 + y2) / 2 - 8);
            ctx.fillStyle = 'rgba(20,14,8,0.82)';
            ctx.beginPath(); ctx.roundRect ? ctx.roundRect(lx, ly - 11, tw + 10, 16, 5) : ctx.rect(lx, ly - 11, tw + 10, 16); ctx.fill();
            ctx.fillStyle = '#f3e3bb'; ctx.fillText(label, lx + 5, ly + 1);
            ctx.restore();
        });
    }

    window.VTTGeo = { segCross, moveBlocked, distToSegment, visionPolygon, wallsToPx, eraseVision, visionRadiusPx, blockingWalls, drawTemplates };
})();

// =====================================================
// VTTWeather — effets de météo animés sur un canvas
// (pluie / neige / brume / braises), partagé MJ / joueur.
// Boucle rAF par canvas, s'arrête seule si le canvas sort
// du DOM, si l'effet passe à '' ou si l'onglet est caché.
// =====================================================
(function () {
    'use strict';
    function makeParticles(kind, w, h) {
        const n = Math.round((w * h) / (kind === 'fog' ? 90000 : (kind === 'embers' ? 22000 : 9000)));
        const ps = [];
        for (let i = 0; i < Math.max(6, n); i++) {
            ps.push({
                x: Math.random() * w, y: Math.random() * h,
                v: 0.5 + Math.random() * 1.5, s: Math.random(),
                drift: (Math.random() - 0.5) * 0.6
            });
        }
        return ps;
    }
    function step(canvas) {
        const fx = canvas.__wfx;
        if (!fx || !canvas.isConnected || !fx.kind) { if (fx) fx.running = false; return; }
        const ctx = canvas.getContext('2d');
        const w = canvas.width, h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        const k = fx.kind;
        fx.t = (fx.t || 0) + 1;
        fx.ps.forEach(p => {
            if (k === 'rain') {
                ctx.strokeStyle = 'rgba(160,190,230,0.45)'; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 2, p.y + 9 + p.v * 4); ctx.stroke();
                p.y += 6 + p.v * 5; p.x += 1.2;
                if (p.y > h) { p.y = -10; p.x = Math.random() * w; }
            } else if (k === 'snow') {
                ctx.fillStyle = 'rgba(240,244,250,0.7)';
                ctx.beginPath(); ctx.arc(p.x, p.y, 1 + p.s * 2, 0, Math.PI * 2); ctx.fill();
                p.y += 0.5 + p.v * 0.7; p.x += Math.sin((fx.t + p.s * 100) / 40) * 0.6 + p.drift;
                if (p.y > h) { p.y = -4; p.x = Math.random() * w; }
                if (p.x < -4) p.x = w + 4; if (p.x > w + 4) p.x = -4;
            } else if (k === 'fog') {
                const r = 60 + p.s * 140;
                const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
                g.addColorStop(0, 'rgba(200,200,210,0.10)'); g.addColorStop(1, 'rgba(200,200,210,0)');
                ctx.fillStyle = g;
                ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
                p.x += 0.25 + p.drift * 0.4;
                if (p.x - r > w) p.x = -r;
            } else if (k === 'embers') {
                ctx.fillStyle = 'rgba(255,' + Math.round(120 + p.s * 90) + ',40,' + (0.35 + p.s * 0.5) + ')';
                ctx.beginPath(); ctx.arc(p.x, p.y, 1 + p.s * 1.6, 0, Math.PI * 2); ctx.fill();
                p.y -= 0.4 + p.v * 0.8; p.x += Math.sin((fx.t + p.s * 60) / 25) * 0.5;
                if (p.y < -4) { p.y = h + 4; p.x = Math.random() * w; }
            }
        });
        if (fx.running) requestAnimationFrame(() => step(canvas));
    }
    window.VTTWeather = {
        // Applique (ou coupe) un effet sur un canvas. Relance la boucle si besoin.
        apply(canvas, kind, w, h) {
            if (!canvas) return;
            if (canvas.width !== w) canvas.width = w;
            if (canvas.height !== h) canvas.height = h;
            let fx = canvas.__wfx;
            if (!kind) {
                if (fx) fx.kind = '';
                const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, w, h);
                canvas.style.display = 'none';
                return;
            }
            canvas.style.display = 'block';
            if (!fx || fx.kind !== kind || fx.w !== w || fx.h !== h) {
                fx = canvas.__wfx = { kind, w, h, ps: makeParticles(kind, w, h), running: false, t: 0 };
            }
            if (!fx.running) { fx.running = true; requestAnimationFrame(() => step(canvas)); }
        }
    };
})();
