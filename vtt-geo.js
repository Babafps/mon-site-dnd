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

    window.VTTGeo = { segCross, moveBlocked, distToSegment, visionPolygon, wallsToPx, eraseVision, visionRadiusPx, blockingWalls };
})();
