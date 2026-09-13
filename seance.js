// =====================================================
// seance.js — la prochaine séance d'un personnage (LOT 6.4)
//
// Une date, une heure, et « chaque semaine » quand la table joue à jour fixe.
// Rangée dans la fiche du personnage (clé `dnd-seance`) : elle suit le compte
// du joueur d'un appareil à l'autre, part dans l'export, mais personne d'autre
// ne la voit. Rien n'est envoyé à un agenda sans le geste du joueur : un
// fichier .ics à ouvrir, ou un lien vers Google Agenda.
//
//   Seance.lire(idPerso)             → { date, heure, hebdo, rappel } | null
//   Seance.prochaine(s, maintenant)  → { debut: Date, enCours } | null
//   Seance.libelle(s, maintenant)    → { court: 'J-2' | 'Ce soir 20 h'…, long } | null
//   Seance.editer(idPerso, nom)      → Promise<boolean> (vrai si la séance a changé)
//   Seance.ics(s, nom, id)  ·  Seance.lienGoogle(s, nom)
//
// Chargé à la demande : charger('seance').
// =====================================================
(function () {
    'use strict';

    const CLE = 'dnd-seance';
    const DUREE_MS = 4 * 3600 * 1000;       // une séance dure (et reste « en cours ») 4 heures
    const JOUR = 86400000;
    const RAPPELS = [[0, 'Pas de rappel'], [15, '15 minutes avant'], [60, '1 heure avant'], [1440, 'La veille']];

    const esc = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const deux = (n) => String(n).padStart(2, '0');

    function normaliser(o) {
        if (!o || typeof o !== 'object') return null;
        const date = /^\d{4}-\d{2}-\d{2}$/.test(o.date || '') ? o.date : null;
        if (!date) return null;
        const heure = /^\d{2}:\d{2}$/.test(o.heure || '') ? o.heure : '20:00';
        const r = Number(o.rappel);
        const rappel = RAPPELS.some(([v]) => v === r) ? r : 60;
        return { date, heure, hebdo: !!o.hebdo, rappel };
    }

    function lire(id) {
        if (!id) return null;
        try {
            const brut = localStorage.getItem(id + '_' + CLE);
            return brut ? normaliser(JSON.parse(brut)) : null;
        } catch (e) { return null; }
    }

    /** `s` null efface la séance. Une valeur vide se lit comme une absence, partout. */
    function ecrire(id, s) {
        const valeur = s ? JSON.stringify(normaliser(s)) : '';
        if (window.SheetStore && window.SheetStore.activeId() === id) {
            // Fiche ouverte : on passe par elle (synchro, événements de la fiche).
            window.SheetStore.setRaw(CLE, valeur);
        } else {
            try {
                if (valeur) localStorage.setItem(id + '_' + CLE, valeur);
                else localStorage.removeItem(id + '_' + CLE);
            } catch (e) { /* stockage plein : la séance reste à saisir */ }
            if (window.SupaAuth && window.SupaAuth.currentUser && window.SyncQueue) window.SyncQueue.push(id, CLE, valeur);
        }
        document.dispatchEvent(new CustomEvent('seance:change', { detail: { id, seance: s ? normaliser(s) : null } }));
    }

    // ---------- Le calendrier ----------
    const debutDe = (s) => {
        const [a, m, j] = s.date.split('-').map(Number);
        const [h, mi] = s.heure.split(':').map(Number);
        return new Date(a, m - 1, j, h, mi, 0, 0);
    };
    const decaler = (d, jours) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + jours, d.getHours(), d.getMinutes());

    /** La prochaine occurrence (ou celle en cours) ; null si la séance est passée. */
    function prochaine(s, maintenant) {
        s = normaliser(s);
        if (!s) return null;
        const t = (maintenant || new Date()).getTime();
        let debut = debutDe(s);
        if (s.hebdo && debut.getTime() + DUREE_MS <= t) {
            // Heure locale, semaine après semaine : le passage à l'heure d'été ne décale rien.
            const semaines = Math.floor((t - DUREE_MS - debut.getTime()) / (7 * JOUR));
            if (semaines > 0) debut = decaler(debut, semaines * 7);
            while (debut.getTime() + DUREE_MS <= t) debut = decaler(debut, 7);
        }
        if (debut.getTime() + DUREE_MS <= t) return null;
        return { debut, enCours: debut.getTime() <= t };
    }

    const minuit = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const heureTexte = (d) => d.getHours() + ' h' + (d.getMinutes() ? ' ' + deux(d.getMinutes()) : '');

    function libelle(s, maintenant) {
        const m = maintenant || new Date();
        const n = normaliser(s);
        const p = prochaine(n, m);
        if (!p) return null;
        const jours = Math.round((minuit(p.debut) - minuit(m)) / JOUR);
        let court;
        if (p.enCours) court = 'En cours';
        else if (jours === 0) court = (p.debut.getHours() >= 17 ? 'Ce soir ' : 'Aujourd’hui ') + heureTexte(p.debut);
        else if (jours === 1) court = 'Demain ' + heureTexte(p.debut);
        else court = 'J-' + jours;
        const jour = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(p.debut);
        const long = 'Prochaine séance : ' + jour + ' à ' + heureTexte(p.debut) + (n.hebdo ? ', chaque semaine' : '');
        return { court, long, debut: p.debut, jours, enCours: p.enCours };
    }

    // ---------- L'agenda ----------
    const titre = (nom) => 'Séance de D&D — ' + (nom || 'mon personnage');
    const fuseau = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { return ''; } };
    const utc = (d) => d.getUTCFullYear() + deux(d.getUTCMonth() + 1) + deux(d.getUTCDate())
        + 'T' + deux(d.getUTCHours()) + deux(d.getUTCMinutes()) + '00Z';
    const local = (d) => d.getFullYear() + deux(d.getMonth() + 1) + deux(d.getDate())
        + 'T' + deux(d.getHours()) + deux(d.getMinutes()) + '00';
    const texteIcs = (t) => String(t).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

    /** RFC 5545 § 3.1 : 75 octets au plus par ligne, la suite commence par une espace. */
    function plierLigne(ligne) {
        const enc = new TextEncoder();
        const morceaux = [];
        let cur = '', taille = 0;
        for (const ch of ligne) {
            const n = enc.encode(ch).length;
            if (taille + n > (morceaux.length ? 74 : 75)) { morceaux.push(cur); cur = ''; taille = 0; }
            cur += ch; taille += n;
        }
        morceaux.push(cur);
        return morceaux.map((l, i) => (i ? ' ' + l : l)).join('\r\n');
    }

    function ics(s, nom, id) {
        s = normaliser(s);
        if (!s) return '';
        const debut = (prochaine(s) || { debut: debutDe(s) }).debut;
        const fin = new Date(debut.getTime() + DUREE_MS);
        // Une séance hebdomadaire garde son heure locale toute l'année : on l'écrit
        // dans le fuseau de l'appareil. Une séance unique s'écrit en temps universel.
        const tz = s.hebdo ? fuseau() : '';
        const lignes = [
            'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Bones & Blades//Prochaine seance//FR',
            'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
            'BEGIN:VEVENT',
            'UID:' + String(id || 'perso').replace(/[^\w-]/g, '') + '-' + s.date.replace(/-/g, '') + '@bones-and-blades',
            'DTSTAMP:' + utc(new Date()),
            tz ? 'DTSTART;TZID=' + tz + ':' + local(debut) : 'DTSTART:' + utc(debut),
            tz ? 'DTEND;TZID=' + tz + ':' + local(fin) : 'DTEND:' + utc(fin)
        ];
        if (s.hebdo) lignes.push('RRULE:FREQ=WEEKLY');
        lignes.push('SUMMARY:' + texteIcs(titre(nom)),
            'DESCRIPTION:' + texteIcs('Prochaine séance avec ' + (nom || 'ton personnage') + '. Ta fiche : ' + location.origin + location.pathname));
        if (s.rappel > 0) {
            lignes.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + texteIcs(titre(nom)),
                'TRIGGER:-PT' + s.rappel + 'M', 'END:VALARM');
        }
        lignes.push('END:VEVENT', 'END:VCALENDAR');
        return lignes.map(plierLigne).join('\r\n') + '\r\n';
    }

    function lienGoogle(s, nom) {
        s = normaliser(s);
        if (!s) return '';
        const debut = (prochaine(s) || { debut: debutDe(s) }).debut;
        const fin = new Date(debut.getTime() + DUREE_MS);
        const u = new URL('https://calendar.google.com/calendar/render');
        u.searchParams.set('action', 'TEMPLATE');
        u.searchParams.set('text', titre(nom));
        u.searchParams.set('dates', local(debut) + '/' + local(fin));
        const tz = fuseau();
        if (tz) u.searchParams.set('ctz', tz);
        u.searchParams.set('details', 'Prochaine séance avec ' + (nom || 'ton personnage') + '.');
        if (s.hebdo) u.searchParams.set('recur', 'RRULE:FREQ=WEEKLY');
        return u.toString();
    }

    function telechargerIcs(s, nom, id) {
        const texte = ics(s, nom, id);
        if (!texte) return false;
        const lisible = String(nom || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([texte], { type: 'text/calendar;charset=utf-8' }));
        a.download = 'seance' + (lisible ? '-' + lisible : '') + '.ics';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        return true;
    }

    // ---------- La fenêtre ----------
    function editer(id, nom) {
        if (!id || !window.Dialogue) return Promise.resolve(false);
        const actuelle = lire(id);
        const demain = new Date(Date.now() + JOUR);
        const defaut = actuelle || {
            date: demain.getFullYear() + '-' + deux(demain.getMonth() + 1) + '-' + deux(demain.getDate()),
            heure: '20:00', hebdo: false, rappel: 60
        };
        let form = null, effacer = false;
        const valeurs = () => normaliser({
            date: form.querySelector('[name="date"]').value,
            heure: form.querySelector('[name="heure"]').value,
            hebdo: form.querySelector('[name="hebdo"]').checked,
            rappel: form.querySelector('[name="rappel"]').value
        });

        return window.Dialogue.fenetre({
            titre: 'Prochaine séance', icone: '📅', confirmer: 'Enregistrer', annuler: 'Fermer', annule: null,
            message: `Pour « ${nom || 'ton personnage'} ». Elle reste sur ton compte : personne d’autre ne la voit.`,
            corps(boite) {
                form = document.createElement('div');
                form.className = 'seance-form';
                form.innerHTML = `
                    <div class="seance-ligne">
                        <label class="seance-champ"><span>Date</span><input type="date" name="date" class="dlg-saisie" value="${esc(defaut.date)}"></label>
                        <label class="seance-champ"><span>Heure</span><input type="time" name="heure" class="dlg-saisie" value="${esc(defaut.heure)}" step="300"></label>
                    </div>
                    <label class="seance-case"><input type="checkbox" name="hebdo"${defaut.hebdo ? ' checked' : ''}> Chaque semaine, même jour, même heure</label>
                    <label class="seance-champ"><span>Rappel dans l’agenda</span><select name="rappel" class="dlg-saisie">${
                        RAPPELS.map(([v, l]) => `<option value="${v}"${v === defaut.rappel ? ' selected' : ''}>${esc(l)}</option>`).join('')
                    }</select></label>
                    <p class="seance-apercu" aria-live="polite"></p>
                    <div class="seance-agenda">
                        <button type="button" class="dlg-btn dlg-secondaire" data-seance="ics">📥 Ajouter à l’agenda (.ics)</button>
                        <a class="dlg-btn dlg-secondaire" data-seance="google" href="#" target="_blank" rel="noopener noreferrer">Google Agenda ↗</a>
                        ${actuelle ? '<button type="button" class="dlg-btn dlg-secondaire seance-effacer" data-seance="effacer">Effacer la séance</button>' : ''}
                    </div>`;
                const apercu = form.querySelector('.seance-apercu');
                const google = form.querySelector('[data-seance="google"]');
                const maj = () => {
                    const s = valeurs();
                    const l = s && libelle(s);
                    apercu.textContent = !s ? 'Choisis une date.' : l ? l.long + ' (' + l.court + ').' : 'Cette date est déjà passée.';
                    google.href = s ? lienGoogle(s, nom) : '#';
                    google.setAttribute('aria-disabled', s ? 'false' : 'true');
                };
                form.addEventListener('input', maj);
                form.addEventListener('change', maj);
                form.addEventListener('click', (e) => {
                    const b = e.target.closest('[data-seance]');
                    if (!b) return;
                    if (b.dataset.seance === 'ics') { const s = valeurs(); if (s) telechargerIcs(s, nom, id); else maj(); }
                    else if (b.dataset.seance === 'google') { if (!valeurs()) e.preventDefault(); }
                    else if (b.dataset.seance === 'effacer') { effacer = true; boite.querySelector('[data-dlg="valider"]').click(); }
                });
                maj();
                return form;
            },
            resultat(signaler) {
                if (effacer) return { effacer: true };
                const s = valeurs();
                if (!s) { signaler('Choisis une date pour la séance.'); return undefined; }
                return s;
            }
        }).then(r => {
            if (!r) return false;
            if (r.effacer) {
                ecrire(id, null);
                if (window.showAppToast) window.showAppToast('📅 Séance effacée', 'info');
                return true;
            }
            ecrire(id, r);
            const l = libelle(r);
            if (window.showAppToast) window.showAppToast('📅 ' + (l ? l.long : 'Séance enregistrée'), 'reussite');
            return true;
        });
    }

    window.Seance = { CLE, lire, ecrire, prochaine, libelle, editer, ics, lienGoogle, telechargerIcs };
})();
