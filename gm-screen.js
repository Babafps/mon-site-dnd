// =====================================================
// ÉCRAN DU MAÎTRE (GM Screen) — Phase 1 : UI + outils locaux
// État encapsulé (closure) + persistance localStorage.
// La couche temps réel (Supabase Realtime) viendra en Phase 2.
// =====================================================
(function () {
    'use strict';

    // ---------- Données statiques ----------
    const CONDITIONS = [
        { key: 'pois', icon: '🧪', label: 'Empoisonné' }, { key: 'prone', icon: '⏬', label: 'À terre' },
        { key: 'stun', icon: '💫', label: 'Étourdi' }, { key: 'restr', icon: '⛓️', label: 'Entravé' },
        { key: 'fright', icon: '👻', label: 'Effrayé' }, { key: 'blind', icon: '👁️', label: 'Aveuglé' },
        { key: 'charm', icon: '💖', label: 'Charmé' }, { key: 'grap', icon: '✊', label: 'Empoigné' },
        { key: 'uncon', icon: '💤', label: 'Inconscient' }, { key: 'dead', icon: '☠️', label: 'Mort' }
    ];
    // Générateur de PNJ : prénom + nom de famille (toujours les deux)
    const GEN_FIRST = ['Aldric', 'Maelle', 'Garrik', 'Sylphine', 'Thorin', 'Élora', 'Brann', 'Wynn', 'Cécile',
        'Vasco', 'Nessa', 'Kaeleth', 'Tobias', 'Aldwena', 'Roland', 'Lysandre', 'Gunnar', 'Mira', 'Edric', 'Yseult',
        'Bram', 'Ophélie', 'Dorn', 'Selene', 'Hadrien', 'Faylen', 'Osric', 'Rowena'];
    const GEN_LAST = ['Pierre-Poing', 'Vent-d\'Argent', 'Barbe-de-Fer', 'Tisse-Ombre', 'Cœur-Vaillant', 'd\'Aubéron',
        'Feuille-Rousse', 'Grise-Lune', 'le Borgne', 'la Murmurante', 'Sang-Noir', 'Haute-Tour', 'des Marais',
        'Forge-Tonnerre', 'Brise-Lame', 'Aile-de-Corbeau', 'Or-en-Bouche', 'le Sombre', 'Val-Profond', 'Croc-Gelé'];
    function genNpcName() {
        return GEN_FIRST[Math.floor(Math.random() * GEN_FIRST.length)] + ' ' + GEN_LAST[Math.floor(Math.random() * GEN_LAST.length)];
    }
    const GEN_RUMORS = ['Une lumière étrange flotte chaque nuit au-dessus du vieux moulin.',
        'Le seigneur local n\'a plus été vu depuis trois lunes…', 'On dit qu\'un dragon dort sous la colline aux Corbeaux.',
        'Des marchands disparaissent sur la route de l\'Est.', 'La fille du forgeron parlerait aux morts.',
        'Un trésor maudit reposerait au fond du puits asséché.', 'Les loups descendent des montagnes plus tôt que d\'habitude.',
        'Un culte se réunirait dans les égouts de la cité basse.'];
    const GEN_LOOT = ['Une potion de soins (2d4+2 PV)', '37 pièces d\'or dans une bourse en cuir', 'Une dague finement ouvragée (+1)',
        'Un parchemin de sort inconnu', 'Une gemme verte d\'une valeur de 50 po', 'Une carte au trésor déchirée en deux',
        'Un anneau de cuivre gravé de runes', 'Une fiole de poison (CD 13)', 'Des bottes de marche silencieuse', 'Un médaillon avec un portrait inconnu'];
    const DICE = [4, 6, 8, 10, 12, 20, 100];

    // ---------- Référence rapide (Compendium) ----------
    const CONDITIONS_REF = [
        { name: 'Aveuglé', text: 'Ne voit pas, rate les jets liés à la vue. Désavantage aux attaques ; les attaques contre lui ont l\'avantage.' },
        { name: 'Charmé', text: 'Ne peut attaquer le charmeur ni le cibler par un effet néfaste. Le charmeur a l\'avantage aux interactions sociales.' },
        { name: 'Assourdi', text: 'N\'entend pas et rate les jets liés à l\'ouïe.' },
        { name: 'Effrayé', text: 'Désavantage aux jets tant que la source de peur est en vue ; ne peut s\'en approcher volontairement.' },
        { name: 'Empoigné', text: 'Vitesse à 0. Prend fin si l\'empoigneur est neutralisé ou éloigné.' },
        { name: 'Neutralisé', text: 'Ne peut effectuer ni action ni réaction.' },
        { name: 'Invisible', text: 'Impossible à voir sans aide. Avantage aux attaques ; les attaques contre lui ont le désavantage.' },
        { name: 'Paralysé', text: 'Neutralisé, ne peut bouger ni parler. Rate DEX/FOR. Attaques avec avantage ; coup au contact = critique.' },
        { name: 'Pétrifié', text: 'Transformé en matière solide, neutralisé, résistance à tous les dégâts, immunité poison/maladie.' },
        { name: 'Empoisonné', text: 'Désavantage aux jets d\'attaque et de caractéristique.' },
        { name: 'À terre', text: 'Ne peut que ramper. Désavantage aux attaques. Attaques au contact avec avantage, à distance avec désavantage.' },
        { name: 'Entravé', text: 'Vitesse à 0. Attaques avec désavantage ; attaques contre lui avec avantage. Désavantage aux jets de DEX.' },
        { name: 'Étourdi', text: 'Neutralisé, ne peut bouger, parle avec peine. Rate DEX/FOR. Attaques contre lui avec avantage.' },
        { name: 'Inconscient', text: 'Neutralisé, lâche ce qu\'il tient, tombe à terre. Attaques avec avantage ; coup au contact = critique.' }
    ];

    // ---------- Référence rapide : mécaniques globales D&D 5e ----------
    const RULES_REF = [
        { name: 'Action : Attaquer', text: 'Une attaque au corps à corps ou à distance contre une cible. Certaines classes ont des attaques supplémentaires (Attaque supplémentaire).' },
        { name: 'Action : Foncer (Dash)', text: 'Gagne un déplacement supplémentaire égal à ta vitesse pour le tour.' },
        { name: 'Action : Se désengager', text: 'Ton déplacement ne provoque pas d\'attaques d\'opportunité pour le reste du tour.' },
        { name: 'Action : Esquiver', text: 'Les attaques contre toi ont le désavantage (si tu les vois) et tu as l\'avantage aux jets de DEX, jusqu\'à ton prochain tour. Annulé si vitesse à 0.' },
        { name: 'Action : Se cacher', text: 'Jet de Discrétion (DEX) opposé à la Perception passive. En cas de succès, tu es caché (invisible de fait).' },
        { name: 'Action : Préparer', text: 'Choisis un déclencheur et une action/déplacement à effectuer en réaction quand il survient. Lancer un sort préparé coûte un emplacement et exige la concentration.' },
        { name: 'Action : Aider', text: 'Donne l\'avantage au prochain jet d\'un allié sur une tâche, ou à sa prochaine attaque contre une créature à 1,50 m de toi.' },
        { name: 'Action : Chercher', text: 'Test de Sagesse (Perception) ou d\'Intelligence (Investigation) pour repérer quelque chose.' },
        { name: 'Action : Utiliser un objet', text: 'Interagir avec un second objet, ou utiliser un objet qui le nécessite (une interaction gratuite par tour est incluse dans le déplacement/action).' },
        { name: 'Action bonus', text: 'Action supplémentaire accordée par une capacité/sort spécifique. Une seule par tour.' },
        { name: 'Réaction', text: 'Action instantanée déclenchée par un événement (ex : attaque d\'opportunité). Une seule par round, récupérée au début de ton tour.' },
        { name: 'Attaque d\'opportunité', text: 'Réaction : quand une créature hostile que tu vois sort de ton allonge en se déplaçant, une attaque au contact contre elle.' },
        { name: 'Avantage / Désavantage', text: 'Lance 2d20 et garde le meilleur (avantage) ou le pire (désavantage). Ils ne se cumulent pas ; un de chaque s\'annule.' },
        { name: 'Couverture', text: 'À demi (+2 CA et DEX), aux trois quarts (+5 CA et DEX), totale (impossible à cibler directement).' },
        { name: 'Test de caractéristique', text: '1d20 + mod. de carac (+ maîtrise si compétence maîtrisée) contre un Degré de Difficulté (DD). 10 = moyen, 15 = difficile, 20 = très difficile.' },
        { name: 'Jet de sauvegarde', text: '1d20 + mod. de carac (+ maîtrise si maîtrisé) pour résister à un effet. Le DD de sort = 8 + maîtrise + mod. d\'incantation.' },
        { name: 'Coup critique', text: 'Un 20 naturel à l\'attaque touche toujours et double les dés de dégâts (pas les bonus fixes).' },
        { name: 'Concentration', text: 'Subir des dégâts : jet de sauvegarde de CON (DD 10 ou la moitié des dégâts, le plus élevé). Un seul sort de concentration à la fois.' },
        { name: 'Repos court', text: '≥ 1 heure. Dépense de dés de vie (1d + mod. CON chacun) pour récupérer des PV ; récupère certaines capacités.' },
        { name: 'Repos long', text: '≥ 8 heures. Récupère tous les PV, la moitié des dés de vie (mini 1) et la plupart des ressources. Un seul repos long par 24 h.' },
        { name: 'Épuisement', text: '6 niveaux cumulatifs : 1) désavantage aux tests ; 2) vitesse /2 ; 3) désavantage attaques & sauvegardes ; 4) PV max /2 ; 5) vitesse 0 ; 6) mort. Un repos long retire 1 niveau.' },
        { name: 'Chute', text: '1d6 dégâts contondants par tranche de 3 m de chute (max 20d6). La créature atterrit à terre.' },
        { name: 'Empoigner (grapple)', text: 'À la place d\'une attaque : Athlétisme (FOR) opposé à l\'Athlétisme ou l\'Acrobaties de la cible. Réussite = cible empoignée (vitesse 0).' },
        { name: 'Bousculer', text: 'À la place d\'une attaque : Athlétisme (FOR) opposé. Réussite = mettre à terre OU repousser de 1,50 m.' },
        { name: 'Jets contre la mort', text: 'À 0 PV : à ton tour, 1d20. ≥10 = succès, <10 = échec. 3 succès = stabilisé ; 3 échecs = mort. 1 = 2 échecs, 20 = 1 PV. Subir des dégâts = 1 échec (critique au contact = 2).' },
        { name: 'Stabiliser', text: 'Un test de Sagesse (Médecine) DD 10 stabilise une créature à 0 PV (réussites/échecs remis à zéro).' },
        { name: 'Surprise', text: 'Une créature surprise ne peut ni agir ni réagir lors de son premier tour du combat.' },
        { name: 'Initiative', text: 'Au début du combat : 1d20 + mod. de DEX. On agit dans l\'ordre décroissant.' },
        { name: 'Terrain difficile', text: 'Chaque 1,50 m coûte 3 m de déplacement (déplacement divisé par deux dans la zone).' },
        { name: 'Attaque à distance au contact', text: 'Tirer sur une cible à 1,50 m d\'un ennemi hostile valide donne le désavantage à l\'attaque.' },
        { name: 'Lumière & vision', text: 'Vision dans le noir : voit dans le noir comme une faible luminosité (zone éclairée faiblement = test de perception avec désavantage). Obscurité = zone d\'aveuglement.' },
        { name: 'Inspiration', text: 'Ressource accordée par le MJ : à dépenser pour obtenir l\'avantage sur un jet de ton choix.' },
        { name: 'Action : Lancer un sort', text: 'Temps d\'incantation variable (action, action bonus, réaction, minutes). Un seul sort par tour utilisant un emplacement, sauf tour de magie en action + sort en action bonus.' },
        { name: 'Attaque à deux armes', text: 'Avec deux armes légères : attaque avec la 2ᵉ en action bonus. On n\'ajoute pas le mod. de carac aux dégâts de la 2ᵉ (sauf négatif).' },
        { name: 'Combat monté', text: 'Monter/descendre coûte la moitié du déplacement. La monture suit ton initiative. Tu peux la faire agir indépendamment ou la contrôler (3 actions : Foncer, Se désengager, Esquiver).' },
        { name: 'Saut en longueur', text: 'Avec élan (3 m) : saute un nombre de mètres égal à ta valeur de FOR (en pieds = FOR). Sans élan : moitié.' },
        { name: 'Saut en hauteur', text: 'Avec élan : 0,90 m + (mod. FOR × 0,30 m). Sans élan : moitié.' },
        { name: 'Nager / Escalader', text: 'Sauf vitesse spéciale, chaque 1,50 m coûte 1,50 m supplémentaire (terrain difficile). Le MJ peut exiger un test d\'Athlétisme si conditions difficiles.' },
        { name: 'Portée des armes', text: 'À distance : portée normale / longue. Au-delà de la normale et jusqu\'à la longue = désavantage. Au-delà de la longue = impossible.' },
        { name: 'Boire / administrer une potion', text: 'Boire une potion = une action. La donner à une créature à terre/inconsciente = une action.' },
        { name: 'Composantes de sort (V, S, M)', text: 'Verbale (parler), Somatique (main libre), Matérielle (composant ou focaliseur). Une main libre suffit pour S et M sans coût en or.' },
        { name: 'Rituel', text: 'Un sort avec la mention « rituel » peut être lancé en +10 min sans dépenser d\'emplacement, si la classe le permet.' },
        { name: 'Cumul d\'effets', text: 'Deux sources du même effet ne se cumulent pas : on garde le plus puissant. Des effets différents se cumulent.' },
        { name: 'Zones d\'effet', text: 'Cône, cube, cylindre, ligne, sphère : l\'origine est un point que tu choisis. Une créature dans la zone est affectée si une ligne d\'effet l\'atteint.' },
        { name: 'Dissipation de la magie', text: 'Dissipe un sort de niveau ≤ celui de l\'emplacement utilisé ; sinon test d\'incantation DD 10 + niveau du sort ciblé.' },
        { name: 'Objets : encombrement', text: 'Capacité de port = FOR × 7,5 kg. Au-delà (jusqu\'à FOR × 15) : vitesse réduite à 1,50 m (règle optionnelle).' },
        { name: 'Asphyxie', text: 'Retient son souffle 1 + mod. CON minutes (min 30 s). Ensuite survit un nombre de tours égal au mod. CON (min 1), puis tombe à 0 PV.' },
        { name: 'Soins & PV temporaires', text: 'Les PV temporaires ne se cumulent pas (on garde le plus grand) et ne sont pas restaurés par les soins ; ils encaissent les dégâts en premier.' },
        { name: 'Résistance / Vulnérabilité', text: 'Résistance = dégâts du type divisés par deux (après autres modificateurs). Vulnérabilité = dégâts doublés. Ne se cumulent pas.' },
        { name: 'Identifier un objet magique', text: 'Repos court en contact + concentration, ou sort Identification. Sinon, l\'usage révèle progressivement les propriétés.' },
        { name: 'Interaction sociale', text: 'Attitude de départ (hostile / indifférent / amical) modifie le DD. Persuasion (sincère), Tromperie (mensonge), Intimidation (menace).' },
        { name: 'Vision dans le noir', text: 'À 18 m, la pénombre est traitée comme lumière vive et l\'obscurité comme pénombre (en nuances de gris). Ne perce pas l\'obscurité magique.' }
    ];

    // ---------- État (multi-campagnes) ----------
    // localStorage sert de CACHE rapide / repli hors-ligne ; la source de
    // vérité est le cloud (table gm_campaigns), pour retrouver ses profils
    // MJ depuis n'importe quel appareil (cf. point 1d du cahier des charges).
    const CAMP_KEY = 'dnd-gm-campaigns';
    let campaigns = loadCampaigns();
    let activeCampaignId = null;
    function loadCampaigns() { try { return JSON.parse(localStorage.getItem(CAMP_KEY)) || []; } catch (e) { return []; } }
    function saveCampaigns() {
        try { localStorage.setItem(CAMP_KEY, JSON.stringify(campaigns)); } catch (e) {}
        // Synchro des métadonnées (nom / archivée) vers le cloud, sans toucher à l'état.
        if (window.SupaAuth && window.SupaAuth.currentUser && window.SupaAuth.gmCampaignUpsert) {
            campaigns.forEach(c => window.SupaAuth.gmCampaignUpsert({ id: c.id, name: c.name, archived: !!c.archived }));
        }
    }
    function stateKey() { return 'dnd-gm-state-' + activeCampaignId; }
    function defaultState() {
        return {
            roomCode: null, sessionId: null,
            party: [], initiative: [], round: 1, turnIndex: 0, combatActive: false,
            monsters: [], npcs: [], quests: [], notes: '', scenes: [], soundboard: [],
            map: { bg: null, gridSize: 48, showGrid: true }, tokens: [],
            maps: [], activeMapId: null,
            env: { time: '', weather: '☀️ Dégagé' }, diceLog: [], offlineSheets: []
        };
    }
    let state = defaultState();

    // ---------- Synchro cloud de l'état MJ (débauncée) ----------
    // On ne pousse PAS roomCode/sessionId (données de session éphémères,
    // propres à l'appareil) : ce sont l'état « profil » et non la partie en cours.
    function exportState(st) { const o = Object.assign({}, st); delete o.roomCode; delete o.sessionId; return o; }
    const GmCloud = {
        timer: null, pendingId: null,
        queueState(id) {
            if (!window.SupaAuth || !window.SupaAuth.currentUser || !window.SupaAuth.gmCampaignSaveState) return;
            this.pendingId = id;
            clearTimeout(this.timer);
            this.timer = setTimeout(() => this.flush(), 1200);
        },
        flush() {
            const id = this.pendingId; this.pendingId = null;
            if (!id || id !== activeCampaignId) return;             // campagne changée → déjà en cache local
            try { window.SupaAuth.gmCampaignSaveState(id, exportState(state)); } catch (e) { console.warn('gm state save:', e); }
        },
        flushNow() { clearTimeout(this.timer); this.flush(); }
    };

    // ---------- Données réseau (non persistées : rechargées depuis Supabase) ----------
    const live = { players: [], online: new Set(), netChannel: null, presChannel: null, bans: {} };

    // Arborescence de préparation (cloud gm_tree)
    let tree = [];                 // nœuds plats { id, parent_id, kind, name, data, sort }
    let treeTarget = null;         // dossier cible des ajouts (null = racine)
    let treeSelected = null;       // nœud déplié (éditeur inline)
    const treeExpanded = new Set();
    let pendingTreeUpload = null;
    let treeTextTimer = null;
    function load() { if (!activeCampaignId) return defaultState(); try { const s = JSON.parse(localStorage.getItem(stateKey())); return Object.assign(defaultState(), s || {}); } catch (e) { return defaultState(); } }
    function save() { if (!activeCampaignId) return; syncActivePage(); try { localStorage.setItem(stateKey(), JSON.stringify(state)); } catch (e) {} GmCloud.queueState(activeCampaignId); }

    const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    // ---------- Lancer de dés ----------
    function rollFormula(formula) {
        let total = 0; const rolls = [];
        const clean = String(formula).replace(/\s+/g, '').toLowerCase();
        const tokens = clean.match(/[+-]?[^+-]+/g) || [];
        tokens.forEach(tok => {
            const sign = tok[0] === '-' ? -1 : 1;
            const body = tok.replace(/^[+-]/, '');
            if (body.includes('d')) {
                let [n, f] = body.split('d'); n = parseInt(n) || 1; f = parseInt(f);
                if (!f) return;
                for (let i = 0; i < n; i++) { const r = Math.floor(Math.random() * f) + 1; total += sign * r; rolls.push((sign < 0 ? '-' : '') + r); }
            } else { const v = parseInt(body); if (!isNaN(v)) { total += sign * v; rolls.push((sign < 0 ? '-' : '+') + Math.abs(v)); } }
        });
        return { total, detail: rolls.join(' '), formula: clean };
    }
    function logDice(label, res) {
        state.diceLog.unshift({ label, total: res.total, detail: res.detail });
        if (state.diceLog.length > 30) state.diceLog.pop();
        save(); renderDice();
        // Affiche le grand résultat
        const out = document.getElementById('gm-dice-result');
        if (out) { const crit = /d20/.test(res.formula) && res.detail.split(' ').length === 1; let cls = ''; if (crit && res.total >= 20) cls = 'gm-crit'; if (crit && res.detail === '1') cls = 'gm-fail'; out.innerHTML = `<span class="${cls}">${res.total}</span>`; }
    }

    // ---------- Injection HTML ----------
    function injectHTML() {
        const ov = document.createElement('div');
        ov.id = 'gm-screen'; ov.className = 'screen-view hidden no-print';
        ov.innerHTML = `
        <div class="gm-shell">
        <div class="gm-header">
            <button id="gm-go-home" class="gm-nav-home" title="Retour à l'accueil">🏠 <span class="gm-nav-home-txt">Accueil</span></button>
            <h2 class="gm-title">🛡️ Écran du Maître <span class="beta-badge">Bêta</span></h2>
            <span id="gm-campaign-title" class="gm-campaign-title"></span>
            <div class="gm-room">
                <span id="gm-room-label" class="gm-readonly-note">Session locale</span>
                <span id="gm-room-code" class="gm-room-code" style="display:none;"></span>
                <span id="gm-presence-count" class="gm-presence-count" style="display:none;">👥 0</span>
                <button id="gm-room-btn" class="gm-btn gm-btn-primary">➕ Créer une session</button>
            </div>
            <button id="gm-sidebar-toggle" class="gm-btn gm-icon-btn" title="Afficher / masquer le panneau latéral">📜</button>
            <button id="gm-close" class="gm-btn gm-close" title="Fermer">✕</button>
        </div>

        <div class="gm-workspace">
            <!-- ===== BARRE D'OUTILS VERTICALE (type Roll20) ===== -->
            <div class="gm-leftbar">
                <button class="gm-tool is-active" data-tool="select" title="Sélection / déplacement (souris)">🖱️</button>
                <button class="gm-tool" data-tool="bg" title="Caler le fond : glisser = déplacer la carte, molette = redimensionner (pour aligner sur la grille)">🗺️</button>
                <button class="gm-tool" data-tool="addtoken" title="Ajouter un jeton sur la carte">➕</button>
                <button class="gm-tool" data-tool="sync" title="Placer les combattants (joueurs + monstres)">⟳</button>
                <button class="gm-tool" data-tool="grid" title="Afficher / masquer la grille">▦</button>
                <button class="gm-tool" data-tool="lock" title="Verrouiller / libérer les jetons">🔒</button>
                <button class="gm-tool" data-tool="clear" title="Vider les jetons">🗑️</button>
                <div class="gm-tool-sep"></div>
                <button class="gm-tool" data-tool="fog" title="Brouillard de guerre : activer / retirer">🌫️</button>
                <button class="gm-tool" data-tool="reveal" title="Pinceau : révéler une zone aux joueurs">🔦</button>
                <button class="gm-tool" data-tool="cover" title="Pinceau : re-cacher une zone">⬛</button>
                <button class="gm-tool" data-tool="revealall" title="Tout révéler">👁️</button>
                <button class="gm-tool" data-tool="coverall" title="Tout recouvrir de brouillard">🌑</button>
            </div>
            <!-- ===== ZONE CENTRALE : grande carte (stage) ===== -->
            <div class="gm-main">

                <div class="gm-card gm-card-live gm-span-2">
                    <div class="gm-card-head"><span class="gm-card-icon">📡</span> Joueurs connectés
                        <span class="gm-spacer"></span>
                        <span id="gm-live-status" class="gm-readonly-note">Hors ligne</span>
                    </div>
                    <div class="gm-card-body"><div id="gm-live-list" class="gm-live-list"></div></div>
                </div>

                <div class="gm-card gm-span-2 gm-card-offline">
                    <div class="gm-card-head"><span class="gm-card-icon">💤</span> Fiches hors-ligne
                        <span class="gm-spacer"></span>
                        <span class="gm-readonly-note">Dernière version vue — conservée même après déconnexion</span>
                    </div>
                    <div class="gm-card-body"><div id="gm-offline-list" class="gm-live-list"></div></div>
                </div>

                <div class="gm-card">
                    <div class="gm-card-head"><span class="gm-card-icon">👥</span> Groupe (manuel)</div>
                    <div class="gm-card-body">
                        <div class="gm-row">
                            <input id="gm-party-name" class="gm-input" placeholder="Nom du personnage">
                            <input id="gm-party-cls" class="gm-input" placeholder="Classe" style="flex:0 1 110px;">
                            <button id="gm-party-add" class="gm-add" title="Ajouter">＋</button>
                        </div>
                        <div id="gm-party-list"></div>
                        <div class="gm-readonly-note">ⓘ Suivi manuel (PNJ alliés, joueurs hors-ligne…). Les joueurs reliés par le code apparaissent en haut, en direct.</div>
                    </div>
                </div>

                <div class="gm-card">
                    <div class="gm-card-head"><span class="gm-card-icon">⚔️</span> Combat &amp; Initiative
                        <span class="gm-spacer"></span>
                        <span id="gm-combat-status" class="gm-combat-status">Hors combat</span>
                        <span class="gm-round">Round <b id="gm-round-val">1</b></span>
                    </div>
                    <div class="gm-card-body">
                        <div class="gm-row" style="gap:6px;">
                            <button id="gm-combat-toggle" class="gm-btn gm-btn-primary" style="flex:1;">⚔️ Lancer le combat</button>
                            <button id="gm-combat-addplayers" class="gm-btn" title="Ajouter les joueurs connectés à l'ordre">➕🧝</button>
                            <button id="gm-combat-addmonsters" class="gm-btn" title="Ajouter les monstres à l'ordre">➕👹</button>
                        </div>
                        <div class="gm-row">
                            <input id="gm-init-name" class="gm-input" placeholder="Nom (joueur / monstre)">
                            <input id="gm-init-val" class="gm-input gm-num" type="number" placeholder="Init">
                            <select id="gm-init-type" class="gm-select" style="flex:0 0 auto; width:auto;"><option value="pj">🧝 PJ</option><option value="monster">👹 Monstre</option></select>
                            <button id="gm-init-add" class="gm-add" title="Ajouter">＋</button>
                        </div>
                        <div id="gm-init-list"></div>
                        <div class="gm-row" style="justify-content:space-between;">
                            <button id="gm-init-next" class="gm-btn gm-btn-primary">⏭ Tour suivant</button>
                            <button id="gm-init-reset" class="gm-btn gm-btn-danger">↺ Réinitialiser</button>
                        </div>
                        <div class="gm-readonly-note">ⓘ Lance le combat : les joueurs connectés voient un bouton flottant pour lancer leur initiative, qui peuple et trie cet ordre automatiquement.</div>
                    </div>
                </div>

                <div class="gm-card gm-span-2">
                    <div class="gm-card-head"><span class="gm-card-icon">👹</span> Monstres</div>
                    <div class="gm-card-body">
                        <div class="gm-row">
                            <input id="gm-mon-name" class="gm-input" placeholder="Nom du monstre">
                            <input id="gm-mon-hp" class="gm-input gm-num" type="number" placeholder="PV">
                            <input id="gm-mon-ac" class="gm-input gm-num" type="number" placeholder="CA">
                            <button id="gm-mon-add" class="gm-add" title="Ajouter">＋</button>
                        </div>
                        <div id="gm-mon-list"></div>
                    </div>
                </div>

                <div class="gm-card">
                    <div class="gm-card-head"><span class="gm-card-icon">🌤️</span> Environnement</div>
                    <div class="gm-card-body">
                        <div class="gm-env-row"><label>🕑 Heure</label><input id="gm-env-time" class="gm-input" placeholder="ex : Crépuscule, 18h…"></div>
                        <div class="gm-env-row"><label>🌦️ Météo</label>
                            <select id="gm-env-weather" class="gm-select">
                                <option>☀️ Dégagé</option><option>⛅ Nuageux</option><option>🌧️ Pluie</option>
                                <option>⛈️ Orage</option><option>🌫️ Brouillard</option><option>❄️ Neige</option><option>🌙 Nuit</option>
                            </select>
                        </div>
                        <div class="gm-music-mini">
                            <button class="gm-btn" data-act="music-toggle">🎵 Lecteur</button>
                            <button class="gm-btn" data-act="music-show">▶ Afficher</button>
                        </div>
                    </div>
                </div>

                <div class="gm-card">
                    <div class="gm-card-head"><span class="gm-card-icon">🔊</span> Soundboard</div>
                    <div class="gm-card-body">
                        <label class="gm-btn gm-soundboard-import" title="Importer des effets sonores">➕ Importer mes sons<input type="file" id="gm-sfx-file" accept="audio/*" multiple style="display:none;"></label>
                        <div id="gm-soundboard-pads" class="gm-soundboard-pads"></div>
                        <div class="gm-readonly-note">ⓘ Importe tes propres effets. Clique un pad : le son joue chez toi ET chez les joueurs connectés.</div>
                    </div>
                </div>

                <div class="gm-card">
                    <div class="gm-card-head"><span class="gm-card-icon">🖼️</span> Montrer une image aux joueurs</div>
                    <div class="gm-card-body">
                        <div class="gm-row">
                            <input id="gm-showimg-url" class="gm-input" placeholder="URL d'une image…">
                            <label class="gm-btn" title="Importer une image">📁<input type="file" id="gm-showimg-file" accept="image/*" style="display:none;"></label>
                            <button id="gm-showimg-send" class="gm-add" title="Envoyer aux joueurs">📤</button>
                        </div>
                        <div class="gm-readonly-note">ⓘ Les joueurs reçoivent une notification « Ouvrir » pour voir l'image en grand.</div>
                    </div>
                </div>

                <div class="gm-card">
                    <div class="gm-card-head"><span class="gm-card-icon">🎬</span> Scènes (ambiance)</div>
                    <div class="gm-card-body">
                        <div class="gm-row">
                            <input id="gm-scene-name" class="gm-input" placeholder="Nom (Taverne, Forêt…)">
                            <label class="gm-btn" id="gm-scene-img-label" style="flex:0 0 auto;" title="Image de fond (optionnel)">🖼️<input type="file" id="gm-scene-img" accept="image/*" style="display:none;"></label>
                            <button id="gm-scene-add" class="gm-add" title="Créer la scène">＋</button>
                        </div>
                        <input id="gm-scene-music" class="gm-input" placeholder="🎵 Lien musique/ambiance (YouTube ou .mp3, optionnel)">
                        <div id="gm-scene-list" class="gm-scene-list"></div>
                        <div class="gm-readonly-note">ⓘ « Appliquer » change le fond ET la musique de tous les joueurs connectés, en direct.</div>
                    </div>
                </div>

                <div id="gm-map-card" class="gm-card">
                    <div class="gm-card-head"><span class="gm-card-icon">🗺️</span> Carte tactique
                        <span class="gm-spacer"></span>
                        <button id="gm-map-sync" class="gm-btn" title="Placer les combattants (joueurs + monstres) sur la carte">⟳ Jetons combat</button>
                    </div>
                    <div class="gm-card-body">
                        <div class="gm-row gm-map-pages-row" style="align-items:center;">
                            <label class="gm-map-ctl">🗺️ Page</label>
                            <select id="gm-map-pages" class="gm-select" style="flex:1;" title="Carte affichée"></select>
                            <button id="gm-map-page-add" class="gm-btn" title="Nouvelle carte">➕</button>
                            <button id="gm-map-page-rename" class="gm-btn" title="Renommer la carte">✏️</button>
                            <button id="gm-map-page-del" class="gm-btn gm-btn-danger" title="Supprimer la carte">🗑️</button>
                        </div>
                        <div class="gm-row">
                            <input id="gm-map-url" class="gm-input" placeholder="URL d'une image de fond / map…">
                            <label class="gm-btn" title="Importer une image de carte">🖼️<input type="file" id="gm-map-file" accept="image/*" style="display:none;"></label>
                            <button id="gm-map-seturl" class="gm-add" title="Appliquer le fond">＋</button>
                        </div>
                        <div class="gm-row" style="align-items:center;">
                            <label class="gm-map-ctl">📚 Banque</label>
                            <select id="gm-map-bank" class="gm-select" style="flex:1;"><option value="">— Charger une carte préparée —</option></select>
                        </div>
                        <div class="gm-row" style="gap:14px; align-items:center;">
                            <label class="gm-map-ctl">Grille <input type="number" id="gm-map-grid" class="gm-input gm-num" value="48" min="10" style="width:64px;"></label>
                            <label class="gm-map-ctl"><input type="checkbox" id="gm-map-showgrid" checked> Afficher</label>
                            <button id="gm-map-lock" class="gm-btn" title="Verrouiller / déverrouiller le déplacement des jetons par les joueurs">🔓 Jetons libres</button>
                            <button id="gm-map-snap" class="gm-btn" title="Aimanter les jetons sur la grille (snap)">🧲 Aimant</button>
                            <button id="gm-map-addtoken" class="gm-btn">➕ Jeton</button>
                            <button id="gm-map-resetview" class="gm-btn" title="Recentrer / réinitialiser le zoom">🎯 Recentrer</button>
                            <button id="gm-map-clear" class="gm-btn gm-btn-danger">Vider jetons</button>
                        </div>
                        <div class="gm-readonly-note" style="margin-top:-2px;">ⓘ Molette = zoom · glisser le fond = déplacer · clic sur un jeton = éditer PV/CA/image.</div>
                        <div id="gm-map-view" class="gm-map-view show-grid"></div>
                        <div class="gm-readonly-note">ⓘ Glisse les jetons : positions et fond sont synchronisés en direct avec les joueurs.</div>
                    </div>
                </div>

                <div class="gm-card gm-span-2">
                    <div class="gm-card-head"><span class="gm-card-icon">✉️</span> Murmure &amp; Troc</div>
                    <div class="gm-card-body">
                        <div class="gm-row">
                            <label class="gm-trade-label">Destinataire :</label>
                            <select id="gm-trade-target" class="gm-select" style="flex:1;"><option value="all">📢 Tous les joueurs</option></select>
                        </div>
                        <div class="gm-trade-tabs">
                            <button class="gm-trade-tab active" data-trade="whisper">🤫 Murmure</button>
                            <button class="gm-trade-tab" data-trade="item">🎁 Objet</button>
                        </div>
                        <div id="gm-trade-whisper" class="gm-trade-pane">
                            <textarea id="gm-whisper-text" class="gm-textarea" placeholder="Note secrète à envoyer au joueur…"></textarea>
                            <button id="gm-send-whisper" class="gm-btn gm-btn-primary" style="width:100%;">🤫 Envoyer le murmure</button>
                        </div>
                        <div id="gm-trade-item" class="gm-trade-pane hidden">
                            <div class="gm-row">
                                <input id="gm-gift-name" class="gm-input" placeholder="Nom de l'objet offert">
                                <input id="gm-gift-qty" class="gm-input gm-num" type="number" min="1" value="1" title="Quantité">
                            </div>
                            <input id="gm-gift-note" class="gm-input" placeholder="Petit mot (optionnel)…">
                            <button id="gm-send-gift" class="gm-btn gm-btn-primary" style="width:100%;">🎁 Offrir l'objet</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ===== SIDEBAR DROITE RÉTRACTABLE ===== -->
            <aside class="gm-sidebar">
                <div class="gm-side-tabs">
                    <button class="gm-side-tab active" data-side="table">📋 Table</button>
                    <button class="gm-side-tab" data-side="chat">🎲 Dés</button>
                    <button class="gm-side-tab" data-side="prep">📁 Prépa</button>
                    <button class="gm-side-tab" data-side="journal">📖 Journal</button>
                    <button class="gm-side-tab" data-side="compendium">🔎 Compendium</button>
                </div>

                <!-- Panneau Table : tableau de bord MJ (joueurs, combat, monstres, scènes…) -->
                <div class="gm-side-panel gm-side-table gm-side-show"></div>

                <!-- Panneau Chat / Dés -->
                <div class="gm-side-panel gm-side-chat">
                    <div class="gm-side-card">
                        <div class="gm-side-card-head">🎲 Lanceur de dés</div>
                        <div class="gm-dice-quick">${DICE.map(d => `<button class="gm-die" data-die="${d}">d${d}</button>`).join('')}</div>
                        <div class="gm-row">
                            <input id="gm-dice-formula" class="gm-input" placeholder="ex : 2d6+3, 1d20+5…">
                            <button id="gm-dice-roll" class="gm-add" title="Lancer">🎲</button>
                        </div>
                        <div id="gm-dice-result" class="gm-dice-result"></div>
                    </div>
                    <div class="gm-side-card gm-side-grow">
                        <div class="gm-side-card-head">📜 Historique des lancers</div>
                        <div id="gm-dice-log" class="gm-dice-log"></div>
                    </div>
                </div>

                <!-- Panneau Préparation (arbre de prépa, déplaçable par glisser-déposer) -->
                <div class="gm-side-panel gm-side-prep">
                    <div class="gm-side-card gm-side-grow">
                        <div class="gm-side-card-head" style="display:flex; align-items:center; gap:6px;">📁 Préparation <span id="gm-tree-target" class="gm-readonly-note" style="margin-left:auto; font-weight:normal;">Cible : Racine</span></div>
                        <div class="gm-row gm-tree-toolbar">
                            <input id="gm-tree-name" class="gm-input" placeholder="Nom de l'élément…">
                            <select id="gm-tree-kind" class="gm-select" style="flex:0 0 auto; width:auto;">
                                <option value="folder">📁 Dossier</option>
                                <option value="text">📝 Texte</option>
                                <option value="link">🔗 Lien</option>
                                <option value="image">🖼️ Image</option>
                                <option value="map">🗺️ Map</option>
                                <option value="monster">👹 Monstre</option>
                            </select>
                            <button id="gm-tree-add" class="gm-add" title="Ajouter dans la cible">＋</button>
                        </div>
                        <div class="gm-readonly-note" style="margin:2px 0 6px;">↕ Glisse un élément sur un <b>dossier</b> pour l'y ranger, ou dans la zone vide pour le sortir à la racine.</div>
                        <div id="gm-tree-root" class="gm-tree"></div>
                        <input type="file" id="gm-tree-file" accept="image/*" style="display:none;">
                    </div>
                </div>

                <!-- Panneau Journal -->
                <div class="gm-side-panel gm-side-journal">
                    <div class="gm-side-card">
                        <div class="gm-side-card-head">🎭 PNJ présents</div>
                        <div class="gm-row">
                            <input id="gm-npc-name" class="gm-input" placeholder="Nom du PNJ">
                            <button id="gm-npc-add" class="gm-add" title="Ajouter">＋</button>
                        </div>
                        <div id="gm-npc-list"></div>
                    </div>
                    <div class="gm-side-card">
                        <div class="gm-side-card-head">📜 Quêtes en cours</div>
                        <div class="gm-row">
                            <input id="gm-quest-name" class="gm-input" placeholder="Objectif des joueurs…">
                            <button id="gm-quest-add" class="gm-add" title="Ajouter">＋</button>
                        </div>
                        <div id="gm-quest-list"></div>
                    </div>
                    <div class="gm-side-card gm-side-grow">
                        <div class="gm-side-card-head">📝 Bloc-notes</div>
                        <textarea id="gm-notes" class="gm-textarea" placeholder="Notes à la volée…"></textarea>
                    </div>
                </div>

                <!-- Panneau Compendium -->
                <div class="gm-side-panel gm-side-compendium">
                    <div class="gm-side-card">
                        <div class="gm-side-card-head">🎲 Générateur d'urgence</div>
                        <div class="gm-gen-btns">
                            <button class="gm-btn" data-gen="name">PNJ</button>
                            <button class="gm-btn" data-gen="rumor">Rumeur</button>
                            <button class="gm-btn" data-gen="loot">Trésor</button>
                        </div>
                        <div id="gm-gen-out" class="gm-gen-out">Clique pour générer…</div>
                    </div>
                    <div class="gm-side-card gm-side-grow">
                        <div class="gm-side-card-head">🔎 Recherche rapide</div>
                        <input id="gm-comp-search" class="gm-input" placeholder="Condition, monstre, PNJ, quête…">
                        <div id="gm-comp-results" class="gm-comp-results"></div>
                    </div>
                </div>
            </aside>
        </div>
        </div>`;
        document.body.appendChild(ov);

        // ----- Disposition Roll20 : carte au centre, modules de gestion dans l'onglet « Table » -----
        try {
            const main = ov.querySelector('.gm-main');
            const tablePanel = ov.querySelector('.gm-side-table');
            if (main && tablePanel) {
                // Tout part dans la sidebar SAUF la carte qui reste la grande zone centrale.
                Array.from(main.children).forEach(card => {
                    if (card.id !== 'gm-map-card') tablePanel.appendChild(card);
                });
            }
            // Barre d'outils gauche → proxys vers les contrôles carte existants.
            ov.querySelectorAll('.gm-leftbar .gm-tool').forEach(btn => btn.addEventListener('click', () => {
                const tool = btn.dataset.tool;
                if (tool === 'grid') { const cb = ov.querySelector('#gm-map-showgrid'); if (cb) { cb.checked = !cb.checked; cb.dispatchEvent(new Event('change', { bubbles: true })); } return; }
                if (tool === 'select' || tool === 'reveal' || tool === 'cover' || tool === 'bg') { setMapTool(tool); return; }
                if (tool === 'fog') { toggleFog(); return; }
                if (tool === 'revealall') { fogRevealAll(); return; }
                if (tool === 'coverall') { fogCoverAll(); return; }
                const ids = { addtoken: 'gm-map-addtoken', sync: 'gm-map-sync', lock: 'gm-map-lock', clear: 'gm-map-clear' };
                const el = ids[tool] && ov.querySelector('#' + ids[tool]);
                if (el) el.click();
            }));
        } catch (e) { console.warn('gm layout Roll20:', e); }
    }

    // ---------- Rendus ----------
    function renderParty() {
        const el = document.getElementById('gm-party-list'); if (!el) return;
        if (!state.party.length) { el.innerHTML = `<div class="gm-empty">Aucun personnage suivi.</div>`; return; }
        el.innerHTML = state.party.map(p => {
            const ratio = p.hpMax > 0 ? Math.max(0, Math.min(1, p.hpCur / p.hpMax)) : 0;
            return `<div class="gm-party-item" data-id="${p.id}">
                <span class="gm-party-name">${esc(p.name)}</span>
                <button class="gm-del-x" data-act="party-del" data-id="${p.id}">✕</button>
                <span class="gm-party-sub" style="grid-column:1/-1;">${esc(p.cls || 'Classe ?')}</span>
                <div class="gm-party-stats">
                    <span class="gm-stat-pill">❤️ <input class="gm-input gm-num" style="width:42px;display:inline-block;padding:2px;" type="number" data-f="hpCur" data-id="${p.id}" value="${p.hpCur}">/<input class="gm-input gm-num" style="width:42px;display:inline-block;padding:2px;" type="number" data-f="hpMax" data-id="${p.id}" value="${p.hpMax}"></span>
                    <span class="gm-stat-pill">🛡️ CA <input class="gm-input gm-num" style="width:38px;display:inline-block;padding:2px;" type="number" data-f="ac" data-id="${p.id}" value="${p.ac}"></span>
                    <span class="gm-stat-pill"><b>Perc.P</b> <input class="gm-input gm-num" style="width:38px;display:inline-block;padding:2px;" type="number" data-f="passPerc" data-id="${p.id}" value="${p.passPerc}"></span>
                    <span class="gm-stat-pill"><b>Intu.P</b> <input class="gm-input gm-num" style="width:38px;display:inline-block;padding:2px;" type="number" data-f="passInsight" data-id="${p.id}" value="${p.passInsight}"></span>
                </div>
                <div class="gm-hp-bar"><div class="gm-hp-fill" style="width:${ratio * 100}%;"></div></div>
            </div>`;
        }).join('');
    }
    function renderInit() {
        renderCombatStatus();
        const el = document.getElementById('gm-init-list'); if (!el) return;
        const rv = document.getElementById('gm-round-val'); if (rv) rv.textContent = state.round;
        if (!state.initiative.length) { el.innerHTML = `<div class="gm-empty">Personne dans l'ordre d'initiative.</div>`; return; }
        el.innerHTML = state.initiative.map((c, i) => `<div class="gm-init-item ${i === state.turnIndex ? 'is-active' : ''}${c.hidden ? ' is-mj-hidden' : ''}">
            <span class="gm-init-init">${c.init == null ? '—' : c.init}</span>
            <span class="gm-init-type">${c.type === 'pj' ? '🧝' : '👹'}</span>
            <span class="gm-init-name">${esc(c.name)}</span>
            <button class="gm-eye${c.hidden ? ' is-hidden' : ''}" data-act="init-eye" data-id="${c.id}" title="${c.hidden ? 'Caché des joueurs' : 'Masquer aux joueurs'}">${c.hidden ? '🙈' : '👁️'}</button>
            <button class="gm-init-del" data-act="init-del" data-id="${c.id}">✕</button>
        </div>`).join('');
    }
    function renderMonsters() {
        const el = document.getElementById('gm-mon-list'); if (!el) return;
        if (!state.monsters.length) { el.innerHTML = `<div class="gm-empty">Aucun monstre.</div>`; return; }
        el.innerHTML = state.monsters.map(m => {
            const dead = m.hpCur <= 0;
            const conds = CONDITIONS.map(c => `<button class="gm-cond ${m.conditions.includes(c.key) ? 'on' : ''}" title="${c.label}" data-act="mon-cond" data-id="${m.id}" data-cond="${c.key}">${c.icon}</button>`).join('');
            const atks = (m.attacks || []).map((a, ai) => `<button class="gm-atk-btn" data-act="mon-atk" data-id="${m.id}" data-ai="${ai}">⚔️ ${esc(a.name)} (${esc(a.formula)})</button>`).join('');
            return `<div class="gm-monster${m.hidden ? ' is-mj-hidden' : ''}" data-id="${m.id}">
                <div class="gm-monster-top">
                    <span class="gm-monster-name">${esc(m.name)}${m.ac ? ` <span class="gm-party-sub">CA ${m.ac}</span>` : ''}</span>
                    <div class="gm-hp-ctrl">
                        <input class="gm-input gm-num gm-mon-hp-amt" type="number" min="1" placeholder="#" data-mon-hp-amount="${m.id}" title="Montant de PV à retirer / ajouter">
                        <button class="gm-hp-btn" data-act="mon-hp" data-id="${m.id}" data-delta="-1" title="Retirer ces PV (dégâts)">−</button>
                        <span class="gm-hp-val ${dead ? 'is-dead' : ''}">${m.hpCur}/${m.hpMax}</span>
                        <button class="gm-hp-btn" data-act="mon-hp" data-id="${m.id}" data-delta="1" title="Ajouter ces PV (soin)">＋</button>
                    </div>
                    <button class="gm-eye${m.hidden ? ' is-hidden' : ''}" data-act="mon-eye" data-id="${m.id}" title="${m.hidden ? 'Caché des joueurs (clic = montrer)' : 'Visible (clic = masquer aux joueurs)'}">${m.hidden ? '🙈' : '👁️'}</button>
                    <button class="gm-del-x" data-act="mon-del" data-id="${m.id}">✕</button>
                </div>
                <div class="gm-conditions">${conds}</div>
                <div class="gm-row"><input class="gm-input" placeholder="Attaque (ex: Morsure)" data-mon-atk-name="${m.id}"><input class="gm-input gm-num" style="width:88px;" placeholder="1d20+5" data-mon-atk-formula="${m.id}"><button class="gm-add" style="width:32px;height:32px;font-size:1rem;" data-act="mon-atk-add" data-id="${m.id}">＋</button></div>
                <div class="gm-monster-atk">${atks || '<span class="gm-readonly-note">Aucune attaque enregistrée.</span>'}</div>
            </div>`;
        }).join('');
    }
    function renderDice() {
        const el = document.getElementById('gm-dice-log'); if (!el) return;
        el.innerHTML = state.diceLog.map(d => `<div class="gm-dice-log-item"><span>${esc(d.label)}</span><span><b>${d.total}</b> <span style="opacity:.6;">(${esc(d.detail)})</span></span></div>`).join('');
    }
    function renderNpcs() {
        const el = document.getElementById('gm-npc-list'); if (!el) return;
        if (!state.npcs.length) { el.innerHTML = `<div class="gm-empty">Aucun PNJ.</div>`; return; }
        el.innerHTML = state.npcs.map(n => `<div class="gm-npc" data-id="${n.id}">
            <div class="gm-npc-top">
                <input type="checkbox" class="gm-check" data-act="npc-present" data-id="${n.id}" ${n.present ? 'checked' : ''} title="Présent dans la scène">
                <span class="gm-npc-name">${esc(n.name)}</span>
                <button class="gm-del-x" data-act="npc-del" data-id="${n.id}">✕</button>
            </div>
            <textarea class="gm-textarea" style="min-height:48px;margin-top:6px;" placeholder="Secret / note du PNJ…" data-act="npc-secret" data-id="${n.id}">${esc(n.secret || '')}</textarea>
        </div>`).join('');
    }
    function renderQuests() {
        const el = document.getElementById('gm-quest-list'); if (!el) return;
        if (!state.quests.length) { el.innerHTML = `<div class="gm-empty">Aucune quête.</div>`; return; }
        el.innerHTML = state.quests.map(q => `<div class="gm-quest gm-quest-top ${q.done ? 'gm-quest-done' : ''}" data-id="${q.id}">
            <input type="checkbox" class="gm-check" data-act="quest-done" data-id="${q.id}" ${q.done ? 'checked' : ''}>
            <span style="flex:1;">${esc(q.text)}</span>
            <button class="gm-del-x" data-act="quest-del" data-id="${q.id}">✕</button>
        </div>`).join('');
    }
    function renderScenes() {
        const el = document.getElementById('gm-scene-list'); if (!el) return;
        if (!state.scenes.length) { el.innerHTML = `<div class="gm-empty">Aucune scène préparée.</div>`; return; }
        el.innerHTML = state.scenes.map(s => `<div class="gm-scene" data-id="${s.id}"${s.bg ? ` style="background-image:url(${s.bg})"` : ''}>
            <span class="gm-scene-name">🎬 ${esc(s.name)}</span>
            <div class="gm-scene-actions">
                <button class="gm-btn" data-act="scene-apply" data-id="${s.id}">Appliquer</button>
                <button class="gm-del-x" data-act="scene-del" data-id="${s.id}">✕</button>
            </div>
        </div>`).join('');
    }
    function renderSoundboard() {
        const el = byId('gm-soundboard-pads'); if (!el) return;
        if (!state.soundboard || !state.soundboard.length) { el.innerHTML = `<div class="gm-empty">Aucun son. Importe des effets (.mp3, .wav…).</div>`; return; }
        el.innerHTML = state.soundboard.map(s => `<div class="gm-pad" data-act="sfx-play" data-id="${s.id}" title="${esc(s.name)}${s.local ? ' (local, non diffusé)' : ''}">
            <span class="gm-pad-ic">${s.local ? '🔇' : '🔊'}</span><span class="gm-pad-name">${esc(s.name)}</span>
            <button class="gm-del-x" data-act="sfx-del" data-id="${s.id}" title="Retirer">✕</button>
        </div>`).join('');
    }
    function applyScene(s) {
        if (!s) return;
        if (s.bg) document.body.style.backgroundImage = `url(${s.bg})`;
        if (s.music && window.MusicPlayer && window.MusicPlayer.playUrl) { try { window.MusicPlayer.playUrl(s.music, '🎬 ' + (s.name || 'Scène')); } catch (e) {} }
        if (window.showAppToast) window.showAppToast('🎬 Scène « ' + (s.name || '') + ' » appliquée', '#8a6320');
    }
    function renderTradeTargets() {
        const sel = byId('gm-trade-target'); if (!sel) return;
        const prev = sel.value;
        const opts = ['<option value="all">📢 Tous les joueurs</option>'].concat(live.players.map(p => {
            const s = p.snapshot || {};
            const nm = s.name || p.character_name || 'Aventurier';
            const dot = live.online.has(p.user_id) ? '🟢' : '⚪';
            return `<option value="${p.user_id}">${dot} ${esc(nm)}</option>`;
        }));
        sel.innerHTML = opts.join('');
        if (prev && sel.querySelector(`option[value="${prev}"]`)) sel.value = prev;
    }
    function fileToDataURL(file, cb) {
        const reader = new FileReader();
        reader.onload = ev => { const img = new Image(); img.onload = () => { const cv = document.createElement('canvas'); const MAX = 1280; let w = img.width, h = img.height; if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } cv.width = w; cv.height = h; cv.getContext('2d').drawImage(img, 0, 0, w, h); try { cb(cv.toDataURL('image/jpeg', 0.7)); } catch (e) { cb(null); } }; img.src = ev.target.result; };
        reader.readAsDataURL(file);
    }
    // ---------- État de la session dans l'en-tête ----------
    function updateRoomUI() {
        const rc = byId('gm-room-code'), rb = byId('gm-room-btn'), rl = byId('gm-room-label'), pc = byId('gm-presence-count');
        if (!rc || !rb) return;
        if (state.roomCode) {
            rc.style.display = ''; rc.textContent = state.roomCode;
            rb.textContent = '✕ Fermer la session';
            if (rl) rl.textContent = 'Code :';
            if (pc) pc.style.display = '';
        } else {
            rc.style.display = 'none';
            rb.textContent = '➕ Créer une session';
            if (rl) rl.textContent = 'Session locale';
            if (pc) pc.style.display = 'none';
        }
    }
    function updatePresenceCount() {
        const pc = byId('gm-presence-count'); if (!pc) return;
        const n = live.players.filter(p => live.online.has(p.user_id)).length;
        pc.textContent = '👥 ' + n;
    }

    // ---------- Joueurs connectés (lecture seule, temps réel) ----------
    function renderLivePlayers() {
        renderTradeTargets();
        const el = byId('gm-live-list'); if (!el) return;
        const statusEl = byId('gm-live-status');
        if (!state.sessionId) {
            el.innerHTML = `<div class="gm-empty">Crée une session puis communique le code aux joueurs pour suivre leurs fiches en direct.</div>`;
            if (statusEl) statusEl.textContent = 'Hors ligne';
            return;
        }
        const onlinePlayers = live.players.filter(p => live.online.has(p.user_id));
        if (statusEl) statusEl.textContent = live.players.length ? (onlinePlayers.length + ' en ligne / ' + live.players.length) : 'En attente';
        if (!onlinePlayers.length) {
            el.innerHTML = `<div class="gm-empty">${live.players.length ? 'Aucun joueur en ligne — leurs dernières fiches restent dans « Fiches hors-ligne » ci-dessous.' : ('En attente de joueurs… Donne-leur le code <b>' + esc(state.roomCode || '') + '</b> (menu ☰ → « Rejoindre une session »).')}</div>`;
            renderOfflineSheets();
            return;
        }
        el.innerHTML = onlinePlayers.map(p => {
            const s = p.snapshot || {};
            const online = true;
            const banned = live.bans[p.user_id] && live.bans[p.user_id] > Date.now();
            const hpMax = Number(s.hpMax) || 0, hpCur = Number(s.hpCur) || 0;
            const ratio = hpMax > 0 ? Math.max(0, Math.min(1, hpCur / hpMax)) : 0;
            const low = ratio > 0 && ratio <= 0.33;
            const sub = [s.cls, s.level ? ('Niv ' + s.level) : '', s.race].filter(Boolean).join(' · ');
            const conds = (s.conditions || []).map(c => `<span class="gm-live-cond">${esc(c)}</span>`).join('');
            const death = (s.deathSaves && (s.deathSaves.s || s.deathSaves.f))
                ? `<span class="gm-stat-pill">☠️ ${s.deathSaves.s || 0}✓ / ${s.deathSaves.f || 0}✗</span>` : '';
            return `<div class="gm-live-item${online ? '' : ' is-offline'}">
                <div class="gm-live-top">
                    <span class="gm-live-dot ${online ? 'on' : ''}" title="${online ? 'En ligne' : 'Hors ligne — dernier état connu'}"></span>
                    <span class="gm-live-name gm-clickable" data-act="player-sheet" data-uid="${esc(p.user_id)}" title="Voir la fiche complète">${esc(s.name || p.character_name || 'Aventurier')}</span>
                    ${banned ? '<span class="gm-live-ban" title="Joueur banni">🚫</span>' : ''}
                    ${s.concentrating ? '<span class="gm-live-conc" title="Concentration active">🌀</span>' : ''}
                    <span class="gm-spacer"></span>
                    <span class="gm-party-sub">${esc(sub || '—')}</span>
                    <button class="gm-del-x" data-act="player-kick" data-uid="${esc(p.user_id)}" title="Modérer / exclure ce joueur">✕</button>
                </div>
                <div class="gm-live-stats">
                    <span class="gm-stat-pill">🛡️ CA ${s.ac != null ? s.ac : '—'}</span>
                    <span class="gm-stat-pill">👁️ ${s.passivePerception != null ? s.passivePerception : '—'}</span>
                    ${s.spellDC ? `<span class="gm-stat-pill">✨ DD ${s.spellDC}</span>` : ''}
                    ${death}
                </div>
                <div class="gm-live-hp">
                    <span class="gm-live-hp-num${low ? ' is-low' : ''}">❤️ ${s.hpCur != null ? s.hpCur : '?'} / ${s.hpMax != null ? s.hpMax : '?'}${s.hpTemp ? ` <span class="gm-live-temp">+${s.hpTemp}</span>` : ''}</span>
                    <div class="gm-hp-bar"><div class="gm-hp-fill" style="width:${ratio * 100}%;"></div></div>
                </div>
                ${conds ? `<div class="gm-live-conds">${conds}</div>` : ''}
            </div>`;
        }).join('');
        renderOfflineSheets();
    }

    // ---------- Fiches hors-ligne (dernière version vue, conservée) ----------
    // Met à jour le cache du dernier snapshot connu pour un joueur.
    function stashOfflineSheet(p) {
        if (!p || !p.user_id) return;
        const snap = p.snapshot || null;
        if (!snap || !Object.keys(snap).length) return;
        if (!Array.isArray(state.offlineSheets)) state.offlineSheets = [];
        const entry = { user_id: p.user_id, character_name: (snap.name || p.character_name || 'Aventurier'), snapshot: snap, ts: Date.now() };
        const i = state.offlineSheets.findIndex(o => o.user_id === p.user_id);
        if (i >= 0) state.offlineSheets[i] = entry; else state.offlineSheets.push(entry);
    }
    function removeOfflineSheet(uid) {
        if (!Array.isArray(state.offlineSheets)) return;
        state.offlineSheets = state.offlineSheets.filter(o => o.user_id !== uid);
        save(); renderOfflineSheets();
    }
    function renderOfflineSheets() {
        const el = byId('gm-offline-list'); if (!el) return;
        const sheets = (state.offlineSheets || []).filter(o => !live.online.has(o.user_id)); // pas ceux actuellement en ligne
        if (!sheets.length) {
            el.innerHTML = `<div class="gm-empty">Aucune fiche hors-ligne mémorisée. Quand un joueur se déconnecte, sa dernière fiche apparaît ici.</div>`;
            return;
        }
        sheets.sort((a, b) => (b.ts || 0) - (a.ts || 0));
        el.innerHTML = sheets.map(o => {
            const s = o.snapshot || {};
            const hpMax = Number(s.hpMax) || 0, hpCur = Number(s.hpCur) || 0;
            const ratio = hpMax > 0 ? Math.max(0, Math.min(1, hpCur / hpMax)) : 0;
            const sub = [s.cls, s.level ? ('Niv ' + s.level) : '', s.race].filter(Boolean).join(' · ');
            const when = o.ts ? new Date(o.ts).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '';
            return `<div class="gm-live-item is-offline">
                <div class="gm-live-top">
                    <span class="gm-live-dot" title="Hors ligne — dernière version vue"></span>
                    <span class="gm-live-name gm-clickable" data-act="offline-sheet" data-uid="${esc(o.user_id)}" title="Voir la dernière fiche connue">${esc(s.name || o.character_name || 'Aventurier')}</span>
                    <span class="gm-spacer"></span>
                    <span class="gm-party-sub">${esc(sub || '—')}</span>
                    <button class="gm-del-x" data-act="offline-remove" data-uid="${esc(o.user_id)}" title="Retirer cette fiche">✕</button>
                </div>
                <div class="gm-live-stats">
                    <span class="gm-stat-pill">🛡️ CA ${s.ac != null ? s.ac : '—'}</span>
                    <span class="gm-stat-pill">👁️ ${s.passivePerception != null ? s.passivePerception : '—'}</span>
                    ${when ? `<span class="gm-stat-pill">🕓 ${esc(when)}</span>` : ''}
                </div>
                <div class="gm-live-hp">
                    <span class="gm-live-hp-num">❤️ ${s.hpCur != null ? s.hpCur : '?'} / ${s.hpMax != null ? s.hpMax : '?'}${s.hpTemp ? ` <span class="gm-live-temp">+${s.hpTemp}</span>` : ''}</span>
                    <div class="gm-hp-bar"><div class="gm-hp-fill" style="width:${ratio * 100}%;"></div></div>
                </div>
            </div>`;
        }).join('');
    }
    function openOfflineSheet(uid) {
        const o = (state.offlineSheets || []).find(x => x.user_id === uid); if (!o) return;
        openSheetModal(o.snapshot || {}, o.character_name, { offlineUid: uid });
    }

    // ---------- Modération des joueurs (fiche modale + kick/ban) ----------
    function findLivePlayer(uid) { return (live.players || []).find(p => p.user_id === uid); }
    function ensurePlayerModal() {
        let m = byId('gm-player-modal');
        if (m) return m;
        m = document.createElement('div'); m.id = 'gm-player-modal'; m.className = 'gm-modal-overlay hidden no-print';
        m.innerHTML = '<div class="gm-modal-box"><button class="gm-modal-close" data-act="player-modal-close" title="Fermer">✕</button><div id="gm-player-modal-body"></div></div>';
        document.body.appendChild(m);
        m.addEventListener('click', (e) => {
            if (e.target === m || e.target.closest('[data-act="player-modal-close"]')) { m.classList.add('hidden'); return; }
            const c = e.target.closest('[data-act="player-kick-confirm"]');
            if (c) { const v = (byId('gm-kick-duration') || {}).value || '0'; kickPlayer(c.dataset.uid, v); return; }
            const ub = e.target.closest('[data-act="player-unban"]');
            if (ub) { unbanPlayer(ub.dataset.uid); return; }
            const r = e.target.closest('[data-act="offline-remove"]');
            if (r) { removeOfflineSheet(r.dataset.uid); m.classList.add('hidden'); }
        });
        return m;
    }
    // Corps de fiche COMPLÈTE (lecture seule) — joueur en ligne ou fiche hors-ligne.
    function sheetBodyHtml(s, fallbackName) {
        const f = s.full || {};
        const ab = s.abilities || {};
        const labels = { str: 'FOR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'SAG', cha: 'CHA' };
        const abRow = ['str', 'dex', 'con', 'int', 'wis', 'cha'].map(k => { const a = ab[k] || {}; return `<div class="gm-pm-ab"><span class="gm-pm-ab-l">${labels[k]}</span><span class="gm-pm-ab-s">${a.score != null ? a.score : '—'}</span><span class="gm-pm-ab-m">${esc(a.mod || '')}</span></div>`; }).join('');
        const conds = (s.conditions || []).map(c => `<span class="gm-live-cond">${esc(c)}</span>`).join('') || '<span class="gm-readonly-note">Aucun</span>';
        const sec = (title, inner) => inner ? `<div class="gm-sheet-sec"><div class="gm-sheet-sec-h">${title}</div>${inner}</div>` : '';
        const profMark = (p) => p >= 2 ? ' ◆◆' : (p >= 1 ? ' ◆' : '');

        // Sauvegardes
        const saves = (f.skills || []).filter(k => k.save);
        const savesHtml = saves.length ? `<div class="gm-sheet-pills">${saves.map(k => `<span class="gm-stat-pill${k.prof ? ' is-prof' : ''}">${labels[k.stat] || k.stat || '—'} ${esc(k.mod)}${profMark(k.prof)}</span>`).join('')}</div>` : '';
        // Compétences
        const sk = (f.skills || []).filter(k => !k.save);
        const skillsHtml = sk.length ? `<div class="gm-sheet-grid2">${sk.map(k => `<div class="gm-sheet-kv${k.prof ? ' is-prof' : ''}"><span>${esc(k.name)}${profMark(k.prof)}</span><b>${esc(k.mod)}</b></div>`).join('')}</div>` : '';
        // Attaques
        const atk = f.attacks || [];
        const atkHtml = atk.length ? `<div class="gm-sheet-list">${atk.map(a => `<div class="gm-sheet-row"><b>${esc(a.name || '—')}</b><span>${esc(a.bonus || '')}${a.dmg ? ' · ' + esc(a.dmg) : ''}</span>${a.notes ? `<small>${esc(a.notes)}</small>` : ''}</div>`).join('')}</div>` : '';
        // Magie : infos + emplacements + sorts
        const si = f.spellInfo || {};
        const spellInfoHtml = (si.ability || si.dc || si.atk || si.mod) ? `<div class="gm-sheet-pills"><span class="gm-stat-pill">Incant. ${esc(si.ability || '—')}</span><span class="gm-stat-pill">DD ${esc(si.dc || '—')}</span><span class="gm-stat-pill">Atk ${esc(si.atk || '—')}</span></div>` : '';
        const slots = (f.spellSlots || []).map((d, i) => ({ d, lvl: i })).filter(x => x.d && x.d.total > 0);
        const slotsHtml = slots.length ? `<div class="gm-sheet-pills">${slots.map(x => { const used = (x.d.used || []).filter(Boolean).length; return `<span class="gm-stat-pill">Niv ${x.lvl + 1} : ${Math.max(0, x.d.total - used)}/${x.d.total}</span>`; }).join('')}</div>` : '';
        const spells = f.spells || [];
        const spellsHtml = spells.length ? `<div class="gm-sheet-list">${spells.slice().sort((a, b) => (a.level || 0) - (b.level || 0)).map(sp => `<div class="gm-sheet-row"><b>${(sp.level ? 'N' + sp.level + ' · ' : 'Tour · ')}${esc(sp.name || '—')}</b>${sp.notes ? `<small>${esc(sp.notes)}</small>` : ''}</div>`).join('')}</div>` : '';
        const magicHtml = (spellInfoHtml || slotsHtml || spellsHtml) ? (spellInfoHtml + slotsHtml + spellsHtml) : '';
        // Capacités limitées
        const lim = f.abilitiesLimited || [];
        const limHtml = lim.length ? `<div class="gm-sheet-pills">${lim.map(c => { const used = (c.used || []).filter(Boolean).length; return `<span class="gm-stat-pill">${esc(c.name)} ${Math.max(0, (c.max || 0) - used)}/${c.max || 0}</span>`; }).join('')}</div>` : '';
        // Inventaire + bourse
        const inv = f.inventory || [];
        const invHtml = inv.length ? `<div class="gm-sheet-list">${inv.map(it => `<div class="gm-sheet-row"><b>${esc(it.name || '—')}${(it.qty && it.qty > 1) ? ' ×' + it.qty : ''}</b>${it.weight ? `<small>${esc(it.weight)}</small>` : ''}</div>`).join('')}</div>` : '';
        const cur = f.currency || {};
        const curHtml = (cur.pc || cur.pa || cur.pe || cur.po || cur.pp) ? `<div class="gm-sheet-pills">${[['po', cur.po], ['pa', cur.pa], ['pc', cur.pc], ['pe', cur.pe], ['pp', cur.pp]].filter(c => c[1] && c[1] !== '0').map(c => `<span class="gm-stat-pill">${c[1]} ${c[0].toUpperCase()}</span>`).join('')}</div>` : '';
        // Traits & dons
        const tr = f.traits || [];
        const trHtml = tr.length ? `<div class="gm-sheet-list">${tr.map(t => `<div class="gm-sheet-row"><b>${esc(t.name || '—')}</b>${t.desc ? `<small>${esc(String(t.desc).replace(/<[^>]+>/g, '').slice(0, 220))}</small>` : ''}</div>`).join('')}</div>` : '';
        // Compagnon
        const cp = f.companion || {};
        const cpHtml = (cp.name || cp.notes) ? `<div class="gm-sheet-row"><b>${esc(cp.name || 'Compagnon')}</b><span>CA ${esc(cp.ac || '—')} · PV ${esc(cp.hp || '—')}</span>${cp.notes ? `<small>${esc(cp.notes)}</small>` : ''}</div>` : '';
        // Identité & notes
        const id = f.identity || {}, nt = f.notes || {};
        const idRows = [['Historique', id.background], ['Alignement', id.alignment], ['Langues', id.languages], ['Taille', id.size], ['XP', id.xp]].filter(r => r[1]);
        const idHtml = idRows.length ? `<div class="gm-sheet-grid2">${idRows.map(r => `<div class="gm-sheet-kv"><span>${r[0]}</span><b>${esc(r[1])}</b></div>`).join('')}</div>` : '';
        const txtBlock = (lbl, val) => val ? `<div class="gm-sheet-text"><strong>${lbl} :</strong> ${esc(val)}</div>` : '';
        const notesHtml = [txtBlock('Apparence', id.appearance), txtBlock('Note rapide', nt.quick), txtBlock('Quêtes', nt.quests), txtBlock('PNJ', nt.npcs)].join('');
        const hd = f.hitDice || {};
        const hdHtml = (hd.max) ? `<span class="gm-stat-pill">🎲 Dés de vie ${Math.max(0, (parseInt(hd.max) || 0) - (parseInt(hd.spent) || 0))}/${esc(hd.max)} ${esc(hd.size ? 'd' + hd.size : '')}</span>` : '';

        return `
            <h2 class="gm-pm-name">${esc(s.name || fallbackName || 'Aventurier')}</h2>
            <div class="gm-pm-sub">${esc([s.cls, s.subclass, s.race, s.level ? ('Niv ' + s.level) : '', s.prof ? ('Maîtrise +' + s.prof) : ''].filter(Boolean).join(' · ') || '—')}</div>
            <div class="gm-pm-stats">
                <div class="gm-pm-stat">❤️ PV<b>${s.hpCur != null ? s.hpCur : '?'} / ${s.hpMax != null ? s.hpMax : '?'}${s.hpTemp ? (' (+' + s.hpTemp + ')') : ''}</b></div>
                <div class="gm-pm-stat">🛡️ CA<b>${s.ac != null ? s.ac : '—'}</b></div>
                <div class="gm-pm-stat">⚡ Init<b>${s.initiative != null ? s.initiative : '—'}</b></div>
                <div class="gm-pm-stat">👁️ Perc.P<b>${s.passivePerception != null ? s.passivePerception : '—'}</b></div>
                <div class="gm-pm-stat">🏃 Vitesse<b>${esc(s.speed || '—')}</b></div>
                ${s.spellDC ? `<div class="gm-pm-stat">✨ DD<b>${s.spellDC}</b></div>` : ''}
            </div>
            <div class="gm-pm-abilities">${abRow}</div>
            <div class="gm-pm-pills-row">
                ${s.concentrating ? '<span class="gm-pm-flag">🌀 Concentration</span>' : ''}
                ${(s.deathSaves && (s.deathSaves.s || s.deathSaves.f)) ? `<span class="gm-pm-flag">☠️ Mort ${s.deathSaves.s || 0}✓/${s.deathSaves.f || 0}✗</span>` : ''}
                ${hdHtml}
            </div>
            <div class="gm-pm-section"><strong>États :</strong> ${conds}</div>
            ${sec('🛡️ Jets de sauvegarde', savesHtml)}
            ${sec('🎯 Compétences', skillsHtml)}
            ${sec('⚔️ Attaques', atkHtml)}
            ${sec('✨ Magie', magicHtml)}
            ${sec('🔋 Capacités limitées', limHtml)}
            ${sec('🎒 Inventaire', invHtml)}
            ${sec('💰 Bourse', curHtml)}
            ${sec('📜 Capacités & Dons', trHtml)}
            ${sec('🐾 Compagnon', cpHtml)}
            ${sec('👤 Identité', idHtml)}
            ${notesHtml ? sec('📝 Notes', notesHtml) : ''}`;
    }
    // opts.kickUid → bloc de modération (joueur en ligne) ; opts.offlineUid → bouton retrait (fiche hors-ligne).
    function openSheetModal(s, fallbackName, opts) {
        opts = opts || {};
        let footer = '';
        if (opts.kickUid) {
            const banUntil = live.bans[opts.kickUid];
            const isBanned = banUntil && banUntil > Date.now();
            const banLine = isBanned
                ? `<div class="gm-pm-ban">🚫 Banni — expire à ${esc(new Date(banUntil).toLocaleTimeString())} <button class="gm-btn" data-act="player-unban" data-uid="${esc(opts.kickUid)}">Lever le ban</button></div>`
                : '';
            footer = banLine + `
            <div class="gm-pm-mod">
                <label class="gm-trade-label">Modération :</label>
                <select id="gm-kick-duration" class="gm-select" style="flex:1; min-width:140px;">
                    <option value="0">Kick simple (peut revenir)</option>
                    <option value="5m">Ban 5 minutes</option>
                    <option value="30m">Ban 30 minutes</option>
                    <option value="60m">Ban 1 heure</option>
                    <option value="perm">Ban (toute la session)</option>
                </select>
                <button class="gm-btn gm-btn-danger" data-act="player-kick-confirm" data-uid="${esc(opts.kickUid)}">🚪 Exclure</button>
            </div>
            <div class="gm-readonly-note">Fiche en lecture seule (données partagées en direct par le joueur).</div>`;
        } else if (opts.offlineUid) {
            footer = `
            <div class="gm-pm-mod">
                <span class="gm-readonly-note" style="flex:1;">💤 Dernière version vue — joueur hors ligne.</span>
                <button class="gm-btn gm-btn-danger" data-act="offline-remove" data-uid="${esc(opts.offlineUid)}">🗑️ Retirer cette fiche</button>
            </div>`;
        }
        // IMPORTANT : créer la modale AVANT d'écrire dans son corps (sinon #gm-player-modal-body
        // n'existe pas encore → null.innerHTML → le clic « ne fait rien »).
        const modal = ensurePlayerModal();
        byId('gm-player-modal-body').innerHTML = sheetBodyHtml(s, fallbackName) + footer;
        modal.classList.remove('hidden');
    }
    function openPlayerModal(uid) {
        const p = findLivePlayer(uid);
        if (p) { openSheetModal(p.snapshot || {}, p.character_name, { kickUid: uid }); return; }
        // Repli : le joueur n'est plus en ligne → on ouvre sa dernière fiche connue.
        const o = (state.offlineSheets || []).find(x => x.user_id === uid);
        if (o) { openSheetModal(o.snapshot || {}, o.character_name, { offlineUid: uid }); return; }
        if (window.showAppToast) window.showAppToast('Fiche indisponible (joueur déconnecté).', '#c0392b');
    }
    function kickDurationMs(v) { if (v === '5m') return 5 * 60000; if (v === '30m') return 30 * 60000; if (v === '60m') return 60 * 60000; if (v === 'perm') return 100 * 365 * 24 * 60 * 60000; return 0; }
    function kickPlayer(uid, v) {
        const ms = kickDurationMs(v), until = ms > 0 ? Date.now() + ms : 0;
        // Ban serveur (table session_bans + trigger anti-join) : inviolable côté joueur.
        if (window.SupaAuth && state.sessionId) {
            if (until) { live.bans[uid] = until; window.SupaAuth.banPlayer(state.sessionId, uid, until); }
            else { delete live.bans[uid]; window.SupaAuth.unbanPlayer(state.sessionId, uid); }
        } else if (until) { live.bans[uid] = until; }
        // Déconnexion immédiate (le ban serveur empêche tout retour, le broadcast coupe la session en cours).
        gmBroadcast('kick', { targetUserId: uid, until: until });
        const p = findLivePlayer(uid), nm = (p && (p.snapshot && p.snapshot.name || p.character_name)) || 'Joueur';
        if (window.showAppToast) window.showAppToast('🚪 ' + nm + (until ? ' banni' : ' exclu'), '#7A2828');
        const m = byId('gm-player-modal'); if (m) m.classList.add('hidden');
        renderLivePlayers();
    }
    function unbanPlayer(uid) {
        delete live.bans[uid];
        if (window.SupaAuth && state.sessionId) window.SupaAuth.unbanPlayer(state.sessionId, uid);
        const p = findLivePlayer(uid), nm = (p && (p.snapshot && p.snapshot.name || p.character_name)) || 'Joueur';
        if (window.showAppToast) window.showAppToast('✅ Ban levé pour ' + nm, '#27ae60');
        const m = byId('gm-player-modal'); if (m) m.classList.add('hidden');
        renderLivePlayers();
    }
    function enforceBans() {
        const now = Date.now();
        Object.keys(live.bans).forEach(uid => {
            if (live.bans[uid] <= now) { delete live.bans[uid]; return; }
            if (live.online.has(uid)) gmBroadcast('kick', { targetUserId: uid, until: live.bans[uid] });
        });
    }

    // ---------- Couche réseau (MJ) ----------
    function gmBroadcast(event, payload) {
        if (!live.presChannel) { if (window.showAppToast) window.showAppToast('Ouvre une session pour diffuser aux joueurs.', '#c0392b'); return false; }
        try { live.presChannel.send({ type: 'broadcast', event, payload }); return true; } catch (e) { console.warn('broadcast:', e); return false; }
    }
    // Diffuse une image aux joueurs (ils reçoivent une notification « Ouvrir »).
    function sendSharedImage(url) {
        if (!url) return;
        const ok = gmBroadcast('show-image', { url: url });
        if (ok && window.showAppToast) window.showAppToast('🖼️ Image envoyée aux joueurs', '#2c3e50');
        const inp = byId('gm-showimg-url'); if (inp) inp.value = '';
    }
    function onGiftResponse(p) {
        if (!p) return;
        const who = p.by || 'Un joueur';
        if (p.whisper) return; // accusé de lecture d'un murmure : pas de toast
        const what = p.item ? (' « ' + p.item + ' »') : '';
        if (p.accepted) { if (window.showAppToast) window.showAppToast('✅ ' + who + ' a accepté' + what, '#27ae60'); }
        else { if (window.showAppToast) window.showAppToast('✖ ' + who + ' a refusé' + what, '#c0392b'); }
    }
    function stopNetwork() {
        if (live.netChannel) { try { live.netChannel.unsubscribe(); } catch (e) {} live.netChannel = null; }
        if (live.presChannel) { try { live.presChannel.untrack(); } catch (e) {} try { live.presChannel.unsubscribe(); } catch (e) {} live.presChannel = null; }
        live.players = []; live.online = new Set();
        if (window.MusicPlayer && window.MusicPlayer.setBroadcaster) window.MusicPlayer.setBroadcaster(null);
    }
    function startNetwork() {
        if (!window.SupaAuth || !window.SupaAuth.currentUser || !state.sessionId) return;
        stopNetwork();
        // Le lecteur du MJ diffuse désormais sa lecture aux joueurs de la session
        if (window.MusicPlayer && window.MusicPlayer.setBroadcaster) { window.MusicPlayer.setRole('free'); window.MusicPlayer.setBroadcaster((p) => gmBroadcast('music', p)); }
        const sid = state.sessionId, code = state.roomCode;
        window.SupaAuth.loadSessionPlayers(sid).then(rows => {
            // protège contre une session qui aurait changé entre-temps
            if (state.sessionId !== sid) return;
            live.players = rows || [];
            live.players.forEach(stashOfflineSheet);          // mémorise la dernière fiche vue
            save();
            renderLivePlayers(); updatePresenceCount();
        });
        // Bans actifs (persistés en base) → survivent à un rechargement de l'écran MJ
        if (window.SupaAuth.loadSessionBans) window.SupaAuth.loadSessionBans(sid).then(bans => {
            if (state.sessionId !== sid) return;
            live.bans = bans || {}; renderLivePlayers();
        });
        live.netChannel = window.SupaAuth.subscribeSessionPlayers(sid, (payload) => {
            const row = (payload.new && payload.new.user_id) ? payload.new : payload.old;
            if (!row) return;
            if (payload.eventType === 'DELETE') {
                const uid2 = payload.old && payload.old.user_id;
                live.players = live.players.filter(p => p.user_id !== uid2);
                // on conserve la dernière fiche connue dans le module hors-ligne (déjà mémorisée)
            } else {
                const i = live.players.findIndex(p => p.user_id === row.user_id);
                if (i >= 0) live.players[i] = row; else live.players.push(row);
                stashOfflineSheet(row);
            }
            save();
            renderLivePlayers(); updatePresenceCount();
        });
        try {
            live.presChannel = window.SupaAuth.presenceChannel(code);
            live.presChannel
                .on('presence', { event: 'sync' }, () => {
                    live.online = new Set(Object.keys(live.presChannel.presenceState()));
                    enforceBans();
                    updatePresenceCount(); renderLivePlayers(); renderTradeTargets();
                    // Resynchronise les nouveaux arrivants (combat + carte + musique) sans réécrire la base
                    try { gmBroadcast('combat', combatPayload()); } catch (e) {}
                    if (typeof broadcastMap === 'function') { try { broadcastMap(false); } catch (e) {} }
                    if (window.MusicPlayer && window.MusicPlayer.resync) { try { window.MusicPlayer.resync(); } catch (e) {} }
                })
                .on('broadcast', { event: 'gift-response' }, ({ payload }) => onGiftResponse(payload))
                .on('broadcast', { event: 'initiative-roll' }, ({ payload }) => onInitiativeRoll(payload))
                .on('broadcast', { event: 'token-move' }, ({ payload }) => onTokenMove(payload))
                .subscribe(async (status) => { if (status === 'SUBSCRIBED') { try { await live.presChannel.track({ role: 'gm' }); } catch (e) {} } });
        } catch (e) { console.warn('presence GM:', e); }
    }

    // ---------- Compendium (recherche rapide) ----------
    function renderCompendium(query) {
        const el = byId('gm-comp-results'); if (!el) return;
        const q = (query || '').toLowerCase().trim();
        if (!q) { el.innerHTML = `<div class="gm-readonly-note">Tape un mot-clé : règle 5e (action, avantage, couverture, repos, épuisement, chute, sauvegarde…), condition, ou un de tes monstres / PNJ / quêtes.</div>`; return; }
        const blocks = [];
        CONDITIONS_REF.filter(c => c.name.toLowerCase().includes(q) || c.text.toLowerCase().includes(q))
            .forEach(c => blocks.push(`<div class="gm-comp-item"><div class="gm-comp-title">⚠️ ${esc(c.name)}</div><div class="gm-comp-text">${esc(c.text)}</div></div>`));
        RULES_REF.filter(r => r.name.toLowerCase().includes(q) || r.text.toLowerCase().includes(q))
            .forEach(r => blocks.push(`<div class="gm-comp-item"><div class="gm-comp-title">📖 ${esc(r.name)}</div><div class="gm-comp-text">${esc(r.text)}</div></div>`));
        state.monsters.filter(m => m.name.toLowerCase().includes(q))
            .forEach(m => blocks.push(`<div class="gm-comp-item"><div class="gm-comp-title">👹 ${esc(m.name)}</div><div class="gm-comp-text">PV ${m.hpCur}/${m.hpMax}${m.ac ? ' · CA ' + m.ac : ''}${(m.attacks || []).length ? ' · ' + m.attacks.map(a => esc(a.name) + ' (' + esc(a.formula) + ')').join(', ') : ''}</div></div>`));
        state.npcs.filter(n => n.name.toLowerCase().includes(q) || (n.secret || '').toLowerCase().includes(q))
            .forEach(n => blocks.push(`<div class="gm-comp-item"><div class="gm-comp-title">🎭 ${esc(n.name)}</div>${n.secret ? `<div class="gm-comp-text">${esc(n.secret)}</div>` : ''}</div>`));
        state.quests.filter(t => t.text.toLowerCase().includes(q))
            .forEach(t => blocks.push(`<div class="gm-comp-item"><div class="gm-comp-title">📜 ${t.done ? '✅ ' : ''}${esc(t.text)}</div></div>`));
        el.innerHTML = blocks.length ? blocks.join('') : `<div class="gm-empty">Aucun résultat pour « ${esc(query)} ».</div>`;
    }

    function renderAll() { renderParty(); renderInit(); renderMonsters(); renderDice(); renderNpcs(); renderQuests(); renderScenes(); renderSoundboard(); renderMap(); renderLivePlayers();
        const t = document.getElementById('gm-env-time'); if (t) t.value = state.env.time || '';
        const w = document.getElementById('gm-env-weather'); if (w) w.value = state.env.weather || '☀️ Dégagé';
        const n = document.getElementById('gm-notes'); if (n) n.value = state.notes || '';
        updateRoomUI();
    }

    // ---------- Combat temps réel ----------
    function sortInit() { state.initiative.sort((a, b) => ((b.init == null ? -1 : b.init) - (a.init == null ? -1 : a.init))); }
    function combatPayload() {
        return {
            active: !!state.combatActive,
            round: state.round,
            turnIndex: state.turnIndex,
            order: state.initiative.filter(c => !c.hidden).map(c => ({ name: c.name, init: c.init, type: c.type, charId: c.charId || null }))
        };
    }
    function broadcastCombat() {
        const payload = combatPayload();
        if (live.presChannel) gmBroadcast('combat', payload);
        if (state.sessionId && window.SupaAuth) { try { window.SupaAuth.saveSessionState(state.sessionId, { combat: payload }); } catch (e) {} }
    }
    function renderCombatStatus() {
        const el = byId('gm-combat-status'), btn = byId('gm-combat-toggle');
        if (el) { el.textContent = state.combatActive ? '🟢 En combat' : 'Hors combat'; el.classList.toggle('is-active', !!state.combatActive); }
        if (btn) {
            btn.textContent = state.combatActive ? '⏹ Terminer le combat' : '⚔️ Lancer le combat';
            btn.classList.toggle('gm-btn-danger', !!state.combatActive);
            btn.classList.toggle('gm-btn-primary', !state.combatActive);
        }
    }
    function addPlayersToInit() {
        (live.players || []).forEach(p => {
            const s = p.snapshot || {};
            const nm = s.name || p.character_name || 'Aventurier';
            const exists = state.initiative.find(c => (p.character_id && c.charId === p.character_id) || (c.type === 'pj' && c.name.toLowerCase() === nm.toLowerCase()));
            if (!exists) state.initiative.push({ id: uid(), name: nm, init: null, type: 'pj', charId: p.character_id || null });
        });
        sortInit();
    }
    function onInitiativeRoll(p) {
        if (!p || !p.name) return;
        let entry = null;
        if (p.charId) entry = state.initiative.find(c => c.charId === p.charId);
        if (!entry) entry = state.initiative.find(c => c.type === 'pj' && c.name.toLowerCase() === String(p.name).toLowerCase());
        if (entry) entry.init = p.total;
        else state.initiative.push({ id: uid(), name: p.name, init: p.total, type: 'pj', charId: p.charId || null });
        sortInit(); save(); renderInit(); broadcastCombat();
        if (window.showAppToast) window.showAppToast('🎲 ' + p.name + ' — initiative ' + p.total, '#2c3e50');
    }

    // ---------- Carte tactique ----------
    let mapThrottle = 0;
    function tokenColor(t) { return t.color || (t.type === 'monster' ? '#7A2828' : '#2980b9'); }
    // ===== Cartes multiples (pages type Roll20) =====
    // state.maps = [{ id, name, map:{bg,gridSize,showGrid,tokensLocked}, tokens:[] }]
    // state.map / state.tokens = miroir de la page active (compat avec tout le code existant).
    const cloneMap = (m) => Object.assign({ bg: null, gridSize: 48, showGrid: true }, m || {});
    const cloneTokens = (t) => (t || []).map(x => Object.assign({}, x));

    function ensureMaps() {
        if (!Array.isArray(state.maps)) state.maps = [];
        if (!state.maps.length) {
            const p = { id: uid(), name: 'Carte 1', map: cloneMap(state.map), tokens: cloneTokens(state.tokens) };
            state.maps.push(p);
            state.activeMapId = p.id;
        }
        if (!state.activeMapId || !state.maps.find(p => p.id === state.activeMapId)) {
            state.activeMapId = state.maps[0].id;
            const p0 = state.maps[0];
            state.map = cloneMap(p0.map); state.tokens = cloneTokens(p0.tokens);
        }
    }
    function syncActivePage() {
        if (!state.activeMapId || !Array.isArray(state.maps)) return;
        const p = state.maps.find(x => x.id === state.activeMapId);
        if (p) { p.map = cloneMap(state.map); p.tokens = cloneTokens(state.tokens); }
    }
    function switchMap(id) {
        if (!id || id === state.activeMapId) return;
        const p = (state.maps || []).find(x => x.id === id); if (!p) return;
        syncActivePage();                                   // mémorise la carte courante
        state.activeMapId = id;
        state.map = cloneMap(p.map); state.tokens = cloneTokens(p.tokens);
        save(); renderMap(); broadcastMap(true);
        if (window.showAppToast) window.showAppToast('🗺️ Carte « ' + (p.name || '?') + ' » affichée', '#2c3e50');
    }
    function addMap(name) {
        ensureMaps(); syncActivePage();
        const p = { id: uid(), name: name || ('Carte ' + (state.maps.length + 1)), map: cloneMap({ gridSize: (state.map && state.map.gridSize) || 48 }), tokens: [] };
        state.maps.push(p);
        state.activeMapId = p.id;
        state.map = cloneMap(p.map); state.tokens = [];
        save(); renderMap(); broadcastMap(true);
        if (window.showAppToast) window.showAppToast('➕ « ' + p.name +' » créée', '#2c3e50');
    }
    function renameMap(id, name) {
        const p = (state.maps || []).find(x => x.id === id); if (!p || !name) return;
        p.name = name; save(); renderMapPages();
    }
    function deleteMap(id) {
        if (!Array.isArray(state.maps) || state.maps.length <= 1) { if (window.showAppToast) window.showAppToast('Impossible : il faut au moins une carte.', '#c0392b'); return; }
        const i = state.maps.findIndex(x => x.id === id); if (i < 0) return;
        state.maps.splice(i, 1);
        if (state.activeMapId === id) {
            const p0 = state.maps[0];
            state.activeMapId = p0.id; state.map = cloneMap(p0.map); state.tokens = cloneTokens(p0.tokens);
        }
        save(); renderMap(); broadcastMap(true);
    }
    function renderMapPages() {
        const sel = byId('gm-map-pages'); if (!sel) return;
        ensureMaps();
        sel.innerHTML = (state.maps || []).map(p => `<option value="${p.id}"${p.id === state.activeMapId ? ' selected' : ''}>🗺️ ${esc(p.name)}</option>`).join('');
    }

    // Vue locale de la carte (zoom / déplacement) — non synchronisée, propre au MJ.
    let mapView = { zoom: 1, panX: 0, panY: 0 };
    let mapTool = 'select';      // 'select' | 'reveal' | 'cover'
    let fogBrush = 0.06;         // rayon du pinceau de brouillard (fraction de la largeur)
    function tokenHtml(t) {
        const hpMax = Number(t.hpMax) || 0, hp = Number(t.hp);
        const ratio = hpMax > 0 ? Math.max(0, Math.min(1, (isNaN(hp) ? hpMax : hp) / hpMax)) : 0;
        const low = hpMax > 0 && ratio <= 0.33;
        const imgStyle = t.img ? `background-image:url(${t.img});` : '';
        const sz = Math.round(34 * (t.size || 1));
        const hpBar = hpMax > 0 ? `<div class="gm-token-hp"><div class="gm-token-hp-fill${low ? ' is-low' : ''}" style="width:${ratio * 100}%"></div></div>` : '';
        const acBadge = (t.ac != null && t.ac !== '') ? `<span class="gm-token-ac" title="Classe d'armure">${esc(t.ac)}</span>` : '';
        return `<div class="gm-token${t.hidden ? ' is-mj-hidden' : ''}${t.img ? ' has-img' : ''}" data-token="${t.id}" style="left:${t.x * 100}%; top:${t.y * 100}%; width:${sz}px; height:${sz}px; --tok:${tokenColor(t)}; ${imgStyle}" title="${esc(t.name)}">`
            + (t.img ? '' : `<span class="gm-token-label">${esc((t.name || '?').slice(0, 2))}</span>`)
            + acBadge + hpBar + `</div>`;
    }
    function applyMapTransform() {
        const view = byId('gm-map-view'); if (!view) return;
        const content = view.querySelector('.gm-map-content'); if (!content) return;
        content.style.transform = `translate(${mapView.panX}px, ${mapView.panY}px) scale(${mapView.zoom})`;
    }
    // ----- Brouillard de guerre (fog of war) -----
    function fogState() { const m = state.map || {}; if (!m.fog) m.fog = { on: false, reveals: [] }; if (!Array.isArray(m.fog.reveals)) m.fog.reveals = []; return m.fog; }
    function renderFog() {
        const view = byId('gm-map-view'); if (!view) return;
        const canvas = view.querySelector('.gm-layer-fog'); if (!canvas) return;
        const content = view.querySelector('.gm-map-content'); if (!content) return;
        const fog = (state.map && state.map.fog) || { on: false, reveals: [] };
        if (!fog.on) { canvas.style.display = 'none'; return; }
        canvas.style.display = 'block';
        const w = Math.max(1, content.clientWidth), h = Math.max(1, content.clientHeight);
        if (canvas.width !== w) canvas.width = w;
        if (canvas.height !== h) canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(10,8,6,0.62)';   // MJ : semi-opaque (voit à travers) ; joueur = opaque
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = '#000';                // alpha plein → efface TOTALEMENT les zones révélées
        (fog.reveals || []).forEach(r => { ctx.beginPath(); ctx.arc(r.x * w, r.y * h, (r.r || fogBrush) * w, 0, Math.PI * 2); ctx.fill(); });
        ctx.globalCompositeOperation = 'source-over';
    }
    function paintFogAt(e) {
        const view = byId('gm-map-view'); const content = view && view.querySelector('.gm-map-content'); if (!content) return;
        const r = content.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
        const y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
        const fog = fogState();
        if (mapTool === 'reveal') fog.reveals.push({ x, y, r: fogBrush });
        else if (mapTool === 'cover') fog.reveals = fog.reveals.filter(rv => Math.hypot(rv.x - x, rv.y - y) > fogBrush);
        renderFog();
    }
    function setMapTool(tool) {
        mapTool = (mapTool === tool && tool !== 'select') ? 'select' : tool;
        if (mapTool === 'reveal' || mapTool === 'cover') fogState().on = true;
        document.querySelectorAll('.gm-leftbar .gm-tool[data-tool]').forEach(b => b.classList.toggle('is-active', b.dataset.tool === mapTool));
        save(); renderMap(); broadcastMap(true);
    }
    function toggleFog() { const fog = fogState(); fog.on = !fog.on; if (!fog.on) setMapTool('select'); else { save(); renderMap(); broadcastMap(true); } if (window.showAppToast) window.showAppToast(fog.on ? '🌫️ Brouillard activé — 🔦 révèle, ⬛ recache' : '☀️ Brouillard retiré', '#2c3e50'); }
    function fogRevealAll() { const fog = fogState(); fog.on = true; fog.reveals = [{ x: 0.5, y: 0.5, r: 3 }]; save(); renderMap(); broadcastMap(true); }
    function fogCoverAll() { const fog = fogState(); fog.on = true; fog.reveals = []; save(); renderMap(); broadcastMap(true); }

    function renderMap() {
        const view = byId('gm-map-view'); if (!view) return;
        const m = state.map || {};
        const tokens = (state.tokens || []).map(tokenHtml).join('');
        view.innerHTML = `<div class="gm-map-content"><div class="gm-layer gm-layer-tokens">${tokens}</div><canvas class="gm-layer gm-layer-fog"></canvas></div>`;
        const content = view.querySelector('.gm-map-content');
        content.style.backgroundImage = m.bg ? `url(${m.bg})` : 'none';
        const bx = m.bgX || 0, by = m.bgY || 0, bs = Number(m.bgScale) || 1;
        content.style.backgroundPosition = `calc(50% + ${bx}px) calc(50% + ${by}px)`;
        content.style.backgroundSize = (bs === 1) ? 'contain' : (bs * 100) + '%';
        content.classList.toggle('show-grid', m.showGrid !== false);
        content.style.setProperty('--gm-grid', (m.gridSize || 48) + 'px');
        applyMapTransform();
        renderFog();
        view.classList.toggle('gm-tool-paint', mapTool !== 'select');
        const gi = byId('gm-map-grid'); if (gi && document.activeElement !== gi) gi.value = m.gridSize || 48;
        const sg = byId('gm-map-showgrid'); if (sg) sg.checked = m.showGrid !== false;
        const lb = byId('gm-map-lock'); if (lb) { const locked = !!m.tokensLocked; lb.textContent = locked ? '🔒 Jetons verrouillés' : '🔓 Jetons libres'; lb.classList.toggle('gm-btn-danger', locked); }
        const sn = byId('gm-map-snap'); if (sn) { const on = !!m.snap; sn.classList.toggle('gm-btn-primary', on); sn.textContent = on ? '🧲 Aimant ON' : '🧲 Aimant'; }
        renderMapBank();
        renderMapPages();
    }
    // Aimante une position (fraction 0..1) au centre de la case de grille la plus proche.
    function snapFraction(x, y) {
        const m = state.map || {}; if (!m.snap) return { x, y };
        const view = byId('gm-map-view'); const content = view && view.querySelector('.gm-map-content');
        if (!content) return { x, y };
        const rect = content.getBoundingClientRect();
        const uw = rect.width / (mapView.zoom || 1), uh = rect.height / (mapView.zoom || 1);
        const g = m.gridSize || 48;
        const cw = g / uw, ch = g / uh;
        const sx = (Math.floor(x / cw) + 0.5) * cw, sy = (Math.floor(y / ch) + 0.5) * ch;
        return { x: Math.max(0, Math.min(1, sx)), y: Math.max(0, Math.min(1, sy)) };
    }
    // ----- Bulle contextuelle d'un jeton (PV / CA / nom / image / couleur / caché) -----
    function setTokenField(id, field, value) {
        const t = find(state.tokens, id); if (!t) return;
        if (field === 'hp' || field === 'hpMax' || field === 'ac') t[field] = (value === '' ? null : (parseInt(value, 10) || 0));
        else if (field === 'size') t.size = parseFloat(value) || 1;
        else t[field] = value;
        save(); renderMap(); broadcastMap(true);
    }
    function ensureTokenPopover() {
        let p = byId('gm-token-popover'); if (p) return p;
        p = document.createElement('div'); p.id = 'gm-token-popover'; p.className = 'gm-token-popover hidden no-print';
        document.body.appendChild(p);
        document.addEventListener('pointerdown', (e) => { if (!p.classList.contains('hidden') && !e.target.closest('#gm-token-popover') && !e.target.closest('.gm-token')) p.classList.add('hidden'); });
        return p;
    }
    function openTokenPopover(tok, e) {
        const p = ensureTokenPopover();
        const color = tok.color || (tok.type === 'monster' ? '#7A2828' : '#2980b9');
        const sizes = [['0.75', 'Petit'], ['1', 'Normal'], ['1.5', 'Grand'], ['2', 'Très grand'], ['3', 'Gigantesque']];
        const sizeOpts = sizes.map(s => `<option value="${s[0]}"${(Number(tok.size) || 1) === parseFloat(s[0]) ? ' selected' : ''}>${s[1]}</option>`).join('');
        p.innerHTML = `
            <div class="gm-tp-row"><input class="gm-input" data-tp="name" value="${esc(tok.name || '')}" placeholder="Nom du jeton"></div>
            <div class="gm-tp-row"><label>❤️</label><input class="gm-input gm-num" type="number" data-tp="hp" value="${tok.hp != null ? tok.hp : ''}" placeholder="PV"><span class="gm-tp-sep">/</span><input class="gm-input gm-num" type="number" data-tp="hpMax" value="${tok.hpMax != null ? tok.hpMax : ''}" placeholder="max"><label>🛡️</label><input class="gm-input gm-num" type="number" data-tp="ac" value="${tok.ac != null ? tok.ac : ''}" placeholder="CA"></div>
            <div class="gm-tp-row"><label>📏</label><select class="gm-input" data-tp="size">${sizeOpts}</select></div>
            <div class="gm-tp-row"><input class="gm-input" data-tp="img" value="${esc(tok.img || '')}" placeholder="URL image…"><label class="gm-btn gm-tp-upload" title="Importer une image">🖼️<input type="file" accept="image/*" data-tp="imgfile" style="display:none;"></label><input class="gm-tp-color" type="color" data-tp="color" value="${color}" title="Couleur"></div>
            <div class="gm-tp-row gm-tp-actions"><button class="gm-btn" data-tp-act="hide">${tok.hidden ? '👁️ Montrer' : '🙈 Cacher aux joueurs'}</button><button class="gm-btn gm-btn-danger" data-tp-act="del">🗑️</button></div>`;
        p.classList.remove('hidden');
        const ox = (e && e.clientX) || window.innerWidth / 2, oy = (e && e.clientY) || window.innerHeight / 2;
        p.style.left = Math.max(8, Math.min(ox + 10, window.innerWidth - p.offsetWidth - 8)) + 'px';
        p.style.top = Math.max(8, Math.min(oy + 10, window.innerHeight - p.offsetHeight - 8)) + 'px';
        p.querySelectorAll('[data-tp]').forEach(inp => {
            const f = inp.dataset.tp;
            if (f === 'imgfile') { inp.addEventListener('change', (ev) => { const file = ev.target.files[0]; if (file) fileToDataURL(file, (data) => { setTokenField(tok.id, 'img', data); const u = p.querySelector('[data-tp="img"]'); if (u) u.value = data; }); }); return; }
            const evt = (inp.type === 'color' || inp.tagName === 'SELECT') ? 'change' : 'input';
            inp.addEventListener(evt, () => setTokenField(tok.id, f, inp.value));
        });
        p.querySelectorAll('[data-tp-act]').forEach(b => b.addEventListener('click', () => {
            const t = find(state.tokens, tok.id); if (!t) return;
            if (b.dataset.tpAct === 'hide') t.hidden = !t.hidden;
            else if (b.dataset.tpAct === 'del') { state.tokens = state.tokens.filter(x => x.id !== tok.id); p.classList.add('hidden'); }
            save(); renderMap(); broadcastMap(true);
        }));
    }
    function renderMapBank() {
        const sel = byId('gm-map-bank'); if (!sel) return;
        const maps = (tree || []).filter(n => n.kind === 'map' && n.data && n.data.url);
        const prev = sel.value;
        sel.innerHTML = '<option value="">— Charger une carte préparée —</option>' + maps.map(n => `<option value="${n.id}">🗺️ ${esc(n.name)}</option>`).join('');
        if (prev && sel.querySelector(`option[value="${prev}"]`)) sel.value = prev;
    }
    function broadcastMap(persist) {
        if (live.presChannel) gmBroadcast('map', { map: state.map, tokens: state.tokens });
        if (persist && state.sessionId && window.SupaAuth) { try { window.SupaAuth.saveSessionState(state.sessionId, { map: state.map, tokens: state.tokens }); } catch (e) {} }
    }
    function throttleBroadcastMap() {
        const now = Date.now();
        if (now - mapThrottle < 70) return;
        mapThrottle = now;
        if (live.presChannel) gmBroadcast('map', { map: state.map, tokens: state.tokens });
    }
    function addTokensFromCombat() {
        const add = (name, type, ref, owner) => { if (!state.tokens.find(t => t.ref === ref)) state.tokens.push({ id: uid(), ref, name, type, owner: owner || null, x: 0.1 + Math.random() * 0.8, y: 0.1 + Math.random() * 0.8 }); };
        (live.players || []).forEach(p => { const s = p.snapshot || {}; add(s.name || p.character_name || 'PJ', 'pj', 'pj:' + p.user_id, p.user_id); });
        state.monsters.forEach(m => add(m.name, 'monster', 'mon:' + m.id, null));
        save(); renderMap(); broadcastMap(true);
    }
    // Déplacement d'un jeton demandé par un joueur (broadcast 'token-move')
    let tokenMovePersistTimer = null;
    function onTokenMove(p) {
        if (!p || !p.id) return;
        if (state.map && state.map.tokensLocked) return;            // déplacements verrouillés par le MJ
        const tok = find(state.tokens, p.id); if (!tok) return;
        if (tok.owner && p.fromUid && tok.owner !== p.fromUid) return; // un joueur ne bouge que SON jeton
        tok.x = Math.max(0, Math.min(1, p.x)); tok.y = Math.max(0, Math.min(1, p.y));
        renderMap();
        if (live.presChannel) gmBroadcast('map', { map: state.map, tokens: state.tokens }); // relaye aux autres
        clearTimeout(tokenMovePersistTimer);
        tokenMovePersistTimer = setTimeout(() => { save(); if (state.sessionId && window.SupaAuth) { try { window.SupaAuth.saveSessionState(state.sessionId, { map: state.map, tokens: state.tokens }); } catch (e) {} } }, 400);
    }
    function setupMapDrag() {
        const view = byId('gm-map-view'); if (!view) return;
        let cur = null, tokenEl = null, panning = false, painting = false, bgDrag = false, startX = 0, startY = 0, moved = false, startPan = null, bgStart = null, bgWheelTimer = null;
        const contentRect = () => { const c = view.querySelector('.gm-map-content'); return c ? c.getBoundingClientRect() : view.getBoundingClientRect(); };
        view.addEventListener('pointerdown', (e) => {
            startX = e.clientX; startY = e.clientY; moved = false;
            if (mapTool === 'reveal' || mapTool === 'cover') {   // mode brouillard : on peint
                painting = true; try { view.setPointerCapture(e.pointerId); } catch (_) {}
                paintFogAt(e); e.preventDefault(); return;
            }
            if (mapTool === 'bg') {   // calage du fond : on déplace l'image (pas la grille)
                bgDrag = true; bgStart = { x: state.map.bgX || 0, y: state.map.bgY || 0 };
                try { view.setPointerCapture(e.pointerId); } catch (_) {}
                e.preventDefault(); return;
            }
            const el = e.target.closest('.gm-token');
            if (el) {
                cur = find(state.tokens, el.dataset.token); tokenEl = el; if (!cur) return;
                try { el.setPointerCapture(e.pointerId); } catch (_) {}
                el.classList.add('dragging'); e.preventDefault();
            } else {
                panning = true; startPan = { x: mapView.panX, y: mapView.panY };
                try { view.setPointerCapture(e.pointerId); } catch (_) {}
                view.classList.add('panning');
            }
        });
        view.addEventListener('pointermove', (e) => {
            if (Math.abs(e.clientX - startX) > 3 || Math.abs(e.clientY - startY) > 3) moved = true;
            if (painting) { paintFogAt(e); return; }
            if (bgDrag) {
                state.map.bgX = bgStart.x + (e.clientX - startX); state.map.bgY = bgStart.y + (e.clientY - startY);
                const c = view.querySelector('.gm-map-content'); if (c) c.style.backgroundPosition = `calc(50% + ${state.map.bgX}px) calc(50% + ${state.map.bgY}px)`;
                return;
            }
            if (cur && tokenEl) {
                const r = contentRect();
                const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
                const y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
                cur.x = x; cur.y = y;
                tokenEl.style.left = (x * 100) + '%'; tokenEl.style.top = (y * 100) + '%';
                throttleBroadcastMap();
            } else if (panning) {
                mapView.panX = startPan.x + (e.clientX - startX);
                mapView.panY = startPan.y + (e.clientY - startY);
                applyMapTransform();
            }
        });
        const up = (e) => {
            if (bgDrag) { bgDrag = false; save(); broadcastMap(true); return; }
            if (painting) { painting = false; save(); broadcastMap(true); return; }
            if (cur) {
                if (!moved) { openTokenPopover(cur, e); }              // clic simple → bulle d'édition
                else { const sn = snapFraction(cur.x, cur.y); cur.x = sn.x; cur.y = sn.y; }
                if (tokenEl) tokenEl.classList.remove('dragging');
                cur = null; tokenEl = null; save(); renderMap(); broadcastMap(true);
            }
            if (panning) { panning = false; view.classList.remove('panning'); }
        };
        view.addEventListener('pointerup', up);
        view.addEventListener('pointercancel', up);
        view.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (mapTool === 'bg') {   // molette = redimensionner le fond (calage grille)
                state.map.bgScale = Math.max(0.2, Math.min(5, (Number(state.map.bgScale) || 1) * (e.deltaY < 0 ? 1.05 : 1 / 1.05)));
                const c = view.querySelector('.gm-map-content'); if (c) c.style.backgroundSize = (state.map.bgScale * 100) + '%';
                clearTimeout(bgWheelTimer); bgWheelTimer = setTimeout(() => { save(); broadcastMap(true); }, 250);
                return;
            }
            mapView.zoom = Math.max(0.4, Math.min(4, mapView.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
            applyMapTransform();
        }, { passive: false });
    }
    function resetMapView() { mapView = { zoom: 1, panX: 0, panY: 0 }; applyMapTransform(); }

    // ---------- Préparation (arbre cloud gm_tree) ----------
    function treeKindIcon(k) { return ({ folder: '📁', text: '📝', link: '🔗', image: '🖼️', map: '🗺️', monster: '👹' })[k] || '📄'; }
    function treeNode(id) { return tree.find(n => n.id === id); }
    function treeChildren(pid) { return tree.filter(n => (n.parent_id || null) === (pid || null)).sort((a, b) => (a.sort || 0) - (b.sort || 0)); }
    async function loadTree() {
        if (!window.SupaAuth || !window.SupaAuth.currentUser || !window.SupaAuth.treeList) { tree = []; renderTree(); return; }
        try { tree = (await window.SupaAuth.treeList(activeCampaignId)) || []; } catch (e) { console.warn('loadTree', e); tree = []; }
        renderTree();
    }
    function renderTree() {
        const root = byId('gm-tree-root'); if (!root) return;
        const tgt = byId('gm-tree-target'); if (tgt) { const f = treeNode(treeTarget); tgt.textContent = 'Cible : ' + (f ? f.name : 'Racine'); }
        const kids = treeChildren(null);
        root.innerHTML = kids.length ? kids.map(n => treeNodeHtml(n, 0)).join('') : `<div class="gm-empty">Crée des dossiers et fichiers (textes, liens, images, maps, monstres) pour préparer ta partie.</div>`;
        if (typeof renderMapBank === 'function') renderMapBank();
    }
    function treeNodeHtml(n, depth) {
        const isFolder = n.kind === 'folder';
        const expanded = treeExpanded.has(n.id), selected = treeSelected === n.id, isTarget = treeTarget === n.id;
        const d = n.data || {};
        const thumb = (n.kind === 'image' || n.kind === 'map') && d.url ? `<img class="gm-tree-thumb" src="${esc(d.url)}" alt="">` : '';
        const acts = [];
        if (n.kind === 'monster') acts.push(`<button class="gm-tree-act" data-act="tree-to-combat" data-id="${n.id}" title="Ajouter au combat">⚔️</button>`);
        if (n.kind === 'map') acts.push(`<button class="gm-tree-act" data-act="tree-to-map" data-id="${n.id}" title="Mettre sur la table">🗺️</button>`);
        if (n.kind === 'link' && d.url) acts.push(`<button class="gm-tree-act" data-act="tree-open-link" data-id="${n.id}" title="Ouvrir le lien">↗</button>`);
        acts.push(`<button class="gm-tree-act" data-act="tree-rename" data-id="${n.id}" title="Renommer">✏️</button>`);
        acts.push(`<button class="gm-tree-act" data-act="tree-del" data-id="${n.id}" title="Supprimer">✕</button>`);
        let html = `<div class="gm-tree-node${selected ? ' is-selected' : ''}${isTarget ? ' is-target' : ''}" data-node="${n.id}">
            <div class="gm-tree-row" draggable="true" data-act="tree-click" data-id="${n.id}" style="padding-left:${depth * 16 + 6}px;">
                ${isFolder ? `<span class="gm-tree-caret">${expanded ? '▾' : '▸'}</span>` : '<span class="gm-tree-caret gm-tree-leaf"></span>'}
                <span class="gm-tree-ic">${treeKindIcon(n.kind)}</span>
                <span class="gm-tree-name">${esc(n.name)}</span>
                ${thumb}
                <span class="gm-tree-actions">${acts.join('')}</span>
            </div>`;
        if (!isFolder && selected) html += treeEditorHtml(n);
        if (isFolder && expanded) {
            const kids = treeChildren(n.id);
            html += `<div class="gm-tree-children">${kids.length ? kids.map(c => treeNodeHtml(c, depth + 1)).join('') : `<div class="gm-tree-empty" style="padding-left:${(depth + 1) * 16 + 24}px;">Dossier vide</div>`}</div>`;
        }
        return html + `</div>`;
    }
    function treeEditorHtml(n) {
        const d = n.data || {};
        if (n.kind === 'text') return `<div class="gm-tree-editor"><textarea class="gm-textarea" data-tree-text="${n.id}" placeholder="Contenu de la note…">${esc(d.text || '')}</textarea></div>`;
        if (n.kind === 'link') return `<div class="gm-tree-editor"><input class="gm-input" data-tree-link="${n.id}" value="${esc(d.url || '')}" placeholder="https://…"></div>`;
        if (n.kind === 'image' || n.kind === 'map') return `<div class="gm-tree-editor">${d.url ? `<img class="gm-tree-thumb-lg" src="${esc(d.url)}">` : '<div class="gm-readonly-note">Aucune image importée.</div>'}<div class="gm-row" style="margin-top:6px;"><button class="gm-btn" data-act="tree-upload" data-id="${n.id}">📤 Importer une image</button>${n.kind === 'map' ? `<button class="gm-btn" data-act="tree-to-map" data-id="${n.id}">🗺️ Sur la table</button>` : ''}</div></div>`;
        if (n.kind === 'monster') {
            const m = d.monster || {};
            return `<div class="gm-tree-editor">
                <div class="gm-row"><input class="gm-input gm-num" type="number" data-tree-mon="${n.id}" data-f="hp" value="${m.hp != null ? m.hp : ''}" placeholder="PV"><input class="gm-input gm-num" type="number" data-tree-mon="${n.id}" data-f="ac" value="${m.ac != null ? m.ac : ''}" placeholder="CA"></div>
                <textarea class="gm-textarea" data-tree-mon="${n.id}" data-f="notes" placeholder="Attaques, capacités, notes…">${esc(m.notes || '')}</textarea>
                <button class="gm-btn gm-btn-primary" data-act="tree-to-combat" data-id="${n.id}" style="margin-top:6px;">⚔️ Ajouter au combat</button>
            </div>`;
        }
        return '';
    }
    function treePersist(id, fields) { const n = treeNode(id); if (n) Object.assign(n, fields); if (window.SupaAuth && window.SupaAuth.treeUpdate) window.SupaAuth.treeUpdate(id, fields); }
    // Mise à jour locale immédiate du data + écriture base débauncée (édition de champs)
    function treePatchData(id, patch) {
        const n = treeNode(id); if (n) n.data = Object.assign({}, n.data, patch);
        clearTimeout(treeTextTimer);
        treeTextTimer = setTimeout(() => { const nn = treeNode(id); if (nn && window.SupaAuth && window.SupaAuth.treeUpdate) window.SupaAuth.treeUpdate(id, { data: nn.data }); }, 500);
    }
    function treeDescendants(id) { let ids = [id]; treeChildren(id).forEach(c => { ids = ids.concat(treeDescendants(c.id)); }); return ids; }
    async function treeAdd() {
        const name = byId('gm-tree-name').value.trim(); const kind = byId('gm-tree-kind').value;
        if (!name) return;
        if (!window.SupaAuth || !window.SupaAuth.currentUser) { if (window.showAppToast) window.showAppToast('Connecte-toi pour la préparation cloud.', '#c0392b'); return; }
        const node = { campaign_id: String(activeCampaignId), parent_id: treeTarget || null, kind, name, data: {}, sort: treeChildren(treeTarget).length };
        const created = await window.SupaAuth.treeInsert(node);
        if (!created) { if (window.showAppToast) window.showAppToast('⚠️ Échec — table gm_tree absente ? Lance le SQL Phase 0.', '#c0392b'); return; }
        tree.push(created);
        byId('gm-tree-name').value = '';
        if (kind === 'folder') treeExpanded.add(created.id); else treeSelected = created.id;
        if (treeTarget) treeExpanded.add(treeTarget);
        renderTree();
    }
    function treeAddMonsterToCombat(n) {
        const m = (n.data && n.data.monster) || {};
        const hp = parseInt(m.hp) || 1;
        state.monsters.push({ id: uid(), name: n.name, hpCur: hp, hpMax: hp, ac: parseInt(m.ac) || 0, conditions: [], attacks: [] });
        save(); renderMonsters();
        if (window.showAppToast) window.showAppToast('👹 « ' + n.name + ' » ajouté au combat', '#2c3e50');
    }

    // ---------- Glisser-déposer de l'arbre de préparation ----------
    // Déplace un nœud : dans un dossier (into=true), avant un nœud (into=false),
    // ou à la racine (targetId=null). Réindexe et persiste l'ordre des frères.
    function treeReorder(dragId, targetId, into) {
        const drag = treeNode(dragId); if (!drag) return;
        if (dragId === targetId) return;
        if (treeDescendants(dragId).indexOf(targetId) !== -1) return;   // pas dans son propre sous-arbre
        let newParent, beforeId = null;
        if (into && targetId) newParent = targetId;                     // ranger DANS le dossier
        else if (targetId) { const t = treeNode(targetId); newParent = t ? (t.parent_id || null) : null; beforeId = targetId; } // avant ce nœud
        else newParent = null;                                          // sortir à la racine
        if (newParent === dragId) return;
        const sibs = tree.filter(n => (n.parent_id || null) === (newParent || null) && n.id !== dragId)
                         .sort((a, b) => (a.sort || 0) - (b.sort || 0));
        let pos = sibs.length;
        if (beforeId) { const i = sibs.findIndex(n => n.id === beforeId); if (i >= 0) pos = i; }
        sibs.splice(pos, 0, drag);
        drag.parent_id = newParent;
        // Réindexe et persiste (parent_id + sort) chaque frère dont la position change.
        sibs.forEach((n, i) => {
            const changed = (n.sort !== i) || (n.id === dragId);
            n.sort = i;
            if (changed && window.SupaAuth && window.SupaAuth.treeUpdate) window.SupaAuth.treeUpdate(n.id, { parent_id: n.parent_id || null, sort: i });
        });
        if (newParent) treeExpanded.add(newParent);
        renderTree();
    }
    function setupTreeDnD() {
        const root = byId('gm-tree-root'); if (!root || root._dndWired) return;
        root._dndWired = true;
        let dragId = null;
        const clearHints = () => root.querySelectorAll('.gm-tree-dragover, .gm-tree-dropinto').forEach(el => el.classList.remove('gm-tree-dragover', 'gm-tree-dropinto'));
        root.addEventListener('dragstart', (e) => {
            const row = e.target.closest('.gm-tree-row'); if (!row) return;
            const node = row.closest('.gm-tree-node'); dragId = node ? node.dataset.node : null;
            if (!dragId) return;
            e.dataTransfer.effectAllowed = 'move';
            try { e.dataTransfer.setData('text/plain', dragId); } catch (_) {}
            row.classList.add('gm-tree-dragging');
        });
        root.addEventListener('dragend', () => {
            root.querySelectorAll('.gm-tree-dragging').forEach(el => el.classList.remove('gm-tree-dragging'));
            clearHints(); dragId = null;
        });
        root.addEventListener('dragover', (e) => {
            if (!dragId) return;
            e.preventDefault(); e.dataTransfer.dropEffect = 'move';
            clearHints();
            const row = e.target.closest('.gm-tree-row');
            if (row) {
                const node = row.closest('.gm-tree-node'); const n = node && treeNode(node.dataset.node);
                row.classList.add(n && n.kind === 'folder' ? 'gm-tree-dropinto' : 'gm-tree-dragover');
            }
        });
        root.addEventListener('drop', (e) => {
            if (!dragId) return;
            e.preventDefault();
            const row = e.target.closest('.gm-tree-row');
            if (row) {
                const node = row.closest('.gm-tree-node'); const id = node && node.dataset.node; const n = id && treeNode(id);
                if (n && n.kind === 'folder') treeReorder(dragId, id, true);
                else treeReorder(dragId, id, false);
            } else {
                treeReorder(dragId, null, false);   // déposé dans le vide → racine
            }
            clearHints(); dragId = null;
        });
    }

    // ---------- Câblage ----------
    function byId(id) { return document.getElementById(id); }
    function find(arr, id) { return arr.find(x => x.id === id); }

    function wire() {
        byId('gm-close').addEventListener('click', close);
        const homeBtn = byId('gm-go-home'); if (homeBtn) homeBtn.addEventListener('click', close);

        // Session temps réel (Supabase)
        byId('gm-room-btn').addEventListener('click', async () => {
            const btn = byId('gm-room-btn');
            if (state.roomCode) {
                // Fermer la session
                if (!confirm('Fermer la session ? Les joueurs seront déconnectés.')) return;
                const sid = state.sessionId;
                // Kick : prévenir les joueurs AVANT de couper le réseau, puis nettoyer après le flush
                gmBroadcast('session-closed', {});
                setTimeout(async () => {
                    stopNetwork();
                    state.roomCode = null; state.sessionId = null; save(); updateRoomUI(); renderLivePlayers();
                    if (sid && window.SupaAuth) { try { await window.SupaAuth.closeSession(sid); } catch (e) {} }
                }, 250);
                if (window.showAppToast) window.showAppToast('Session fermée — joueurs déconnectés', '#7A2828');
                return;
            }
            // Créer une session
            if (!window.SupaAuth || !window.SupaAuth.currentUser) {
                if (window.showAppToast) window.showAppToast('Connecte-toi pour créer une session en ligne.', '#c0392b');
                return;
            }
            btn.disabled = true; btn.textContent = 'Création…';
            try {
                const camp = campaigns.find(c => c.id === activeCampaignId);
                const sess = await window.SupaAuth.createSession(camp ? camp.name : 'Partie');
                if (!sess) throw new Error('createSession a échoué');
                state.roomCode = sess.code; state.sessionId = sess.id; save();
                updateRoomUI(); startNetwork(); renderLivePlayers();
                if (window.showAppToast) window.showAppToast('🟢 Session ' + sess.code + ' ouverte ! Donne ce code aux joueurs.', '#2c3e50');
            } catch (e) {
                console.warn(e);
                if (window.showAppToast) window.showAppToast('Échec de création de session.', '#c0392b');
                updateRoomUI();
            } finally { btn.disabled = false; }
        });

        // Bascule de la sidebar droite
        byId('gm-sidebar-toggle').addEventListener('click', () => {
            const ov = byId('gm-screen'); if (ov) ov.classList.toggle('gm-sidebar-collapsed');
        });

        // Onglets de la sidebar (Dés / Journal / Compendium)
        document.querySelectorAll('.gm-side-tab').forEach(tab => tab.addEventListener('click', () => {
            document.querySelectorAll('.gm-side-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const map = { table: '.gm-side-table', chat: '.gm-side-chat', prep: '.gm-side-prep', journal: '.gm-side-journal', compendium: '.gm-side-compendium' };
            document.querySelectorAll('.gm-side-panel').forEach(p => p.classList.remove('gm-side-show'));
            const target = document.querySelector(map[tab.dataset.side]); if (target) target.classList.add('gm-side-show');
            // Si on n'a pas la sidebar ouverte, l'ouvrir
            const ov = byId('gm-screen'); if (ov) ov.classList.remove('gm-sidebar-collapsed');
        }));

        // Compendium : recherche
        const compInput = byId('gm-comp-search');
        if (compInput) compInput.addEventListener('input', (e) => renderCompendium(e.target.value));

        // --- Ajouts ---
        byId('gm-party-add').addEventListener('click', () => {
            const name = byId('gm-party-name').value.trim(); if (!name) return;
            state.party.push({ id: uid(), name, cls: byId('gm-party-cls').value.trim(), hpCur: 0, hpMax: 0, ac: 10, passPerc: 10, passInsight: 10 });
            byId('gm-party-name').value = ''; byId('gm-party-cls').value = ''; save(); renderParty();
        });
        byId('gm-init-add').addEventListener('click', () => {
            const name = byId('gm-init-name').value.trim(); if (!name) return;
            state.initiative.push({ id: uid(), name, init: parseInt(byId('gm-init-val').value) || 0, type: byId('gm-init-type').value });
            sortInit();
            byId('gm-init-name').value = ''; byId('gm-init-val').value = ''; save(); renderInit(); broadcastCombat();
        });
        byId('gm-init-next').addEventListener('click', () => {
            if (!state.initiative.length) return;
            state.turnIndex++;
            if (state.turnIndex >= state.initiative.length) { state.turnIndex = 0; state.round++; }
            save(); renderInit(); broadcastCombat();
        });
        byId('gm-init-reset').addEventListener('click', () => {
            if (!confirm('Réinitialiser l\'ordre d\'initiative et le compteur de round ?')) return;
            state.initiative = []; state.round = 1; state.turnIndex = 0; state.combatActive = false; save(); renderInit(); broadcastCombat();
        });

        // --- Contrôle du combat (MJ) ---
        byId('gm-combat-toggle').addEventListener('click', () => {
            state.combatActive = !state.combatActive;
            if (state.combatActive) { addPlayersToInit(); if (!state.round) state.round = 1; }
            save(); renderInit(); broadcastCombat();
            if (window.showAppToast) window.showAppToast(state.combatActive ? '⚔️ Combat lancé ! Les joueurs peuvent lancer leur initiative.' : '⏹ Combat terminé', state.combatActive ? '#2c3e50' : '#7A2828');
        });
        byId('gm-combat-addplayers').addEventListener('click', () => { addPlayersToInit(); save(); renderInit(); broadcastCombat(); });
        byId('gm-combat-addmonsters').addEventListener('click', () => {
            state.monsters.forEach(m => {
                if (!state.initiative.find(c => c.monId === m.id)) state.initiative.push({ id: uid(), name: m.name, init: Math.floor(Math.random() * 20) + 1, type: 'monster', monId: m.id });
            });
            sortInit(); save(); renderInit(); broadcastCombat();
        });
        byId('gm-mon-add').addEventListener('click', () => {
            const name = byId('gm-mon-name').value.trim(); if (!name) return;
            const hp = parseInt(byId('gm-mon-hp').value) || 1;
            state.monsters.push({ id: uid(), name, hpCur: hp, hpMax: hp, ac: parseInt(byId('gm-mon-ac').value) || 0, conditions: [], attacks: [] });
            byId('gm-mon-name').value = ''; byId('gm-mon-hp').value = ''; byId('gm-mon-ac').value = ''; save(); renderMonsters();
        });
        byId('gm-npc-add').addEventListener('click', () => {
            const name = byId('gm-npc-name').value.trim(); if (!name) return;
            state.npcs.push({ id: uid(), name, secret: '', present: true });
            byId('gm-npc-name').value = ''; save(); renderNpcs();
        });
        byId('gm-quest-add').addEventListener('click', () => {
            const text = byId('gm-quest-name').value.trim(); if (!text) return;
            state.quests.push({ id: uid(), text, done: false });
            byId('gm-quest-name').value = ''; save(); renderQuests();
        });

        // Entrée = valider l'ajout du champ
        [['gm-party-name', 'gm-party-add'], ['gm-init-name', 'gm-init-add'], ['gm-init-val', 'gm-init-add'],
        ['gm-mon-name', 'gm-mon-add'], ['gm-mon-hp', 'gm-mon-add'], ['gm-mon-ac', 'gm-mon-add'],
        ['gm-npc-name', 'gm-npc-add'], ['gm-quest-name', 'gm-quest-add']].forEach(([inp, btn]) => {
            const e = byId(inp); if (e) e.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); byId(btn).click(); } });
        });

        // Dés
        DICE.forEach(() => {});
        document.querySelectorAll('.gm-die').forEach(b => b.addEventListener('click', () => logDice('1d' + b.dataset.die, rollFormula('1d' + b.dataset.die))));
        byId('gm-dice-roll').addEventListener('click', () => { const f = byId('gm-dice-formula').value.trim(); if (f) logDice(f, rollFormula(f)); });
        byId('gm-dice-formula').addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); byId('gm-dice-roll').click(); } });

        // Générateurs
        document.querySelectorAll('[data-gen]').forEach(b => b.addEventListener('click', () => {
            if (b.dataset.gen === 'name') { byId('gm-gen-out').textContent = genNpcName(); return; }
            const pool = b.dataset.gen === 'rumor' ? GEN_RUMORS : GEN_LOOT;
            byId('gm-gen-out').textContent = pool[Math.floor(Math.random() * pool.length)];
        }));

        // Environnement + notes (sauvegarde sur saisie)
        byId('gm-env-time').addEventListener('input', e => { state.env.time = e.target.value; save(); });
        byId('gm-env-weather').addEventListener('change', e => { state.env.weather = e.target.value; save(); });
        byId('gm-notes').addEventListener('input', e => { state.notes = e.target.value; save(); });

        // Mini-contrôle musique
        document.querySelectorAll('[data-act="music-toggle"],[data-act="music-show"]').forEach(b => b.addEventListener('click', () => {
            if (!window.MusicPlayer) return;
            if (b.dataset.act === 'music-show') window.MusicPlayer.show(); else window.MusicPlayer.toggle();
        }));

        // --- Soundboard : import de fichiers audio (upload Storage → pads diffusables) ---
        const sfxFileEl = byId('gm-sfx-file');
        if (sfxFileEl) sfxFileEl.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files || []); e.target.value = '';
            for (const f of files) {
                const name = f.name.replace(/\.[^/.]+$/, '');
                try {
                    const res = await window.SupaAuth.uploadAsset(f, 'sfx');
                    state.soundboard.push({ id: uid(), name, url: res.url, path: res.path });
                } catch (err) {
                    console.warn('upload sfx:', err);
                    // Repli : son jouable localement par le MJ, mais non diffusable (pas d'URL publique)
                    state.soundboard.push({ id: uid(), name, url: URL.createObjectURL(f), local: true });
                    if (window.showAppToast) window.showAppToast('⚠️ Upload Supabase échoué — son local (non diffusé). As-tu lancé le SQL Phase 0 ?', '#c0392b');
                }
                save(); renderSoundboard();
            }
        });

        // --- Carte tactique : fond, grille, jetons ---
        setupMapDrag();
        const mapApplyUrl = () => { const u = byId('gm-map-url').value.trim(); if (!u) return; state.map.bg = u; byId('gm-map-url').value = ''; save(); renderMap(); broadcastMap(true); };
        byId('gm-map-seturl').addEventListener('click', mapApplyUrl);
        byId('gm-map-url').addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); mapApplyUrl(); } });
        byId('gm-map-file').addEventListener('change', async (e) => {
            const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
            try { const res = await window.SupaAuth.uploadAsset(f, 'maps'); state.map.bg = res.url; save(); renderMap(); broadcastMap(true); }
            catch (err) {
                console.warn(err);
                fileToDataURL(f, (data) => { state.map.bg = data; save(); renderMap(); broadcastMap(true); });
                if (window.showAppToast) window.showAppToast('⚠️ Upload échoué — fond local (non diffusé). SQL Phase 0 lancé ?', '#c0392b');
            }
        });
        byId('gm-map-grid').addEventListener('input', e => { state.map.gridSize = parseInt(e.target.value) || 48; save(); renderMap(); broadcastMap(true); });
        byId('gm-map-showgrid').addEventListener('change', e => { state.map.showGrid = e.target.checked; save(); renderMap(); broadcastMap(true); });
        byId('gm-map-addtoken').addEventListener('click', () => { const n = prompt('Nom du jeton :'); if (!n || !n.trim()) return; state.tokens.push({ id: uid(), name: n.trim(), type: 'npc', x: 0.5, y: 0.5 }); save(); renderMap(); broadcastMap(true); });
        byId('gm-map-clear').addEventListener('click', () => { if (!confirm('Retirer tous les jetons ?')) return; state.tokens = []; save(); renderMap(); broadcastMap(true); });
        byId('gm-map-sync').addEventListener('click', addTokensFromCombat);
        byId('gm-map-lock').addEventListener('click', () => { state.map.tokensLocked = !state.map.tokensLocked; save(); renderMap(); broadcastMap(true); if (window.showAppToast) window.showAppToast(state.map.tokensLocked ? '🔒 Jetons verrouillés (MJ seul)' : '🔓 Jetons libres (chaque joueur bouge le sien)', '#2c3e50'); });
        byId('gm-map-snap').addEventListener('click', () => { state.map.snap = !state.map.snap; save(); renderMap(); if (window.showAppToast) window.showAppToast(state.map.snap ? '🧲 Aimantage grille activé' : '🧲 Aimantage désactivé', '#2c3e50'); });
        byId('gm-map-resetview').addEventListener('click', resetMapView);

        // Montrer une image aux joueurs (URL ou import)
        byId('gm-showimg-send').addEventListener('click', () => {
            const u = byId('gm-showimg-url').value.trim();
            if (!u) { if (window.showAppToast) window.showAppToast('Renseigne une URL ou importe une image.', '#c0392b'); return; }
            sendSharedImage(u);
        });
        byId('gm-showimg-file').addEventListener('change', async (e) => {
            const f = e.target.files[0]; if (!f) return;
            try {
                if (window.SupaAuth && window.SupaAuth.uploadAsset) { const res = await window.SupaAuth.uploadAsset(f, 'shared'); sendSharedImage(res.url); }
                else fileToDataURL(f, sendSharedImage);
            } catch (err) { console.warn('showimg upload:', err); if (window.showAppToast) window.showAppToast('Échec de l\'envoi de l\'image.', '#c0392b'); }
            e.target.value = '';
        });
        byId('gm-map-bank').addEventListener('change', (e) => { const n = treeNode(e.target.value); if (n && n.data && n.data.url) { state.map.bg = n.data.url; save(); renderMap(); broadcastMap(true); if (window.showAppToast) window.showAppToast('🗺️ Carte « ' + n.name + ' » chargée', '#2c3e50'); } });

        // Pages de carte (multi-cartes type Roll20)
        byId('gm-map-pages').addEventListener('change', (e) => switchMap(e.target.value));
        byId('gm-map-page-add').addEventListener('click', () => { const n = prompt('Nom de la nouvelle carte :', 'Carte ' + ((state.maps ? state.maps.length : 0) + 1)); if (n && n.trim()) addMap(n.trim()); });
        byId('gm-map-page-rename').addEventListener('click', () => { const p = (state.maps || []).find(x => x.id === state.activeMapId); if (!p) return; const n = prompt('Renommer la carte :', p.name); if (n && n.trim()) renameMap(p.id, n.trim()); });
        byId('gm-map-page-del').addEventListener('click', () => { const p = (state.maps || []).find(x => x.id === state.activeMapId); if (!p) return; if (confirm('Supprimer la carte « ' + p.name + ' » et ses jetons ?')) deleteMap(p.id); });

        // --- Préparation (arbre) ---
        setupTreeDnD();
        byId('gm-tree-add').addEventListener('click', treeAdd);
        byId('gm-tree-name').addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); treeAdd(); } });
        byId('gm-tree-file').addEventListener('change', async (e) => {
            const f = e.target.files && e.target.files[0]; e.target.value = ''; const id = pendingTreeUpload; pendingTreeUpload = null;
            if (!f || !id) return;
            try { const res = await window.SupaAuth.uploadAsset(f, 'images'); const n = treeNode(id); treePersist(id, { data: Object.assign({}, n ? n.data : {}, { url: res.url, path: res.path }) }); renderTree(); }
            catch (err) { console.warn(err); if (window.showAppToast) window.showAppToast('⚠️ Upload échoué — Storage absent ? Lance le SQL Phase 0.', '#c0392b'); }
        });

        // --- Scènes : création (image + musique) ---
        let pendingSceneBg = null;
        byId('gm-scene-img').addEventListener('change', (e) => {
            const f = e.target.files && e.target.files[0]; if (!f) return;
            fileToDataURL(f, (data) => { pendingSceneBg = data; const lbl = byId('gm-scene-img-label'); if (lbl) lbl.classList.add('has-img'); });
        });
        byId('gm-scene-add').addEventListener('click', () => {
            const name = byId('gm-scene-name').value.trim(); if (!name) return;
            const music = byId('gm-scene-music').value.trim();
            state.scenes.push({ id: uid(), name, bg: pendingSceneBg || null, music: music || null });
            byId('gm-scene-name').value = ''; byId('gm-scene-music').value = ''; pendingSceneBg = null;
            const lbl = byId('gm-scene-img-label'); if (lbl) lbl.classList.remove('has-img');
            save(); renderScenes();
        });
        byId('gm-scene-name').addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); byId('gm-scene-add').click(); } });

        // --- Murmure & Troc ---
        document.querySelectorAll('.gm-trade-tab').forEach(tab => tab.addEventListener('click', () => {
            document.querySelectorAll('.gm-trade-tab').forEach(t => t.classList.remove('active')); tab.classList.add('active');
            const isItem = tab.dataset.trade === 'item';
            byId('gm-trade-whisper').classList.toggle('hidden', isItem);
            byId('gm-trade-item').classList.toggle('hidden', !isItem);
        }));
        byId('gm-send-whisper').addEventListener('click', () => {
            const txt = byId('gm-whisper-text').value.trim(); if (!txt) return;
            const target = byId('gm-trade-target').value || 'all';
            if (gmBroadcast('gift', { targetUserId: target, type: 'whisper', message: txt, giftId: uid() })) {
                byId('gm-whisper-text').value = '';
                if (window.showAppToast) window.showAppToast('🤫 Murmure envoyé', '#2c3e50');
            }
        });
        byId('gm-send-gift').addEventListener('click', () => {
            const name = byId('gm-gift-name').value.trim(); if (!name) return;
            const qty = parseInt(byId('gm-gift-qty').value) || 1;
            const note = byId('gm-gift-note').value.trim();
            const target = byId('gm-trade-target').value || 'all';
            if (gmBroadcast('gift', { targetUserId: target, type: 'item', item: { name, qty }, message: note, giftId: uid() })) {
                byId('gm-gift-name').value = ''; byId('gm-gift-qty').value = '1'; byId('gm-gift-note').value = '';
                if (window.showAppToast) window.showAppToast('🎁 Objet envoyé', '#2c3e50');
            }
        });

        // --- Délégation : clics sur éléments générés ---
        document.getElementById('gm-screen').addEventListener('click', (e) => {
            const t = e.target.closest('[data-act]'); if (!t) return;
            const id = t.dataset.id, act = t.dataset.act;
            switch (act) {
                case 'party-del': state.party = state.party.filter(p => p.id !== id); save(); renderParty(); break;
                case 'init-del': {
                    const idx = state.initiative.findIndex(c => c.id === id);
                    state.initiative = state.initiative.filter(c => c.id !== id);
                    if (state.turnIndex >= state.initiative.length) state.turnIndex = 0;
                    save(); renderInit(); break;
                }
                case 'mon-del': state.monsters = state.monsters.filter(m => m.id !== id); save(); renderMonsters(); break;
                case 'mon-eye': { const m = find(state.monsters, id); if (m) { m.hidden = !m.hidden; save(); renderMonsters(); } break; }
                case 'init-eye': { const c = find(state.initiative, id); if (c) { c.hidden = !c.hidden; save(); renderInit(); } break; }
                case 'mon-hp': { const m = find(state.monsters, id); if (m) { const amtEl = document.querySelector('[data-mon-hp-amount="' + id + '"]'); const amt = (amtEl && Math.abs(parseInt(amtEl.value, 10))) || 1; m.hpCur = Math.max(0, Math.min(m.hpMax, m.hpCur + parseInt(t.dataset.delta) * amt)); save(); renderMonsters(); } break; }
                case 'mon-cond': { const m = find(state.monsters, id); if (m) { const c = t.dataset.cond; m.conditions = m.conditions.includes(c) ? m.conditions.filter(x => x !== c) : [...m.conditions, c]; save(); renderMonsters(); } break; }
                case 'mon-atk': { const m = find(state.monsters, id); if (m) { const a = m.attacks[parseInt(t.dataset.ai)]; if (a) logDice(`${m.name} — ${a.name}`, rollFormula(a.formula)); } break; }
                case 'mon-atk-add': {
                    const m = find(state.monsters, id); if (!m) break;
                    const nameEl = document.querySelector(`[data-mon-atk-name="${id}"]`), fEl = document.querySelector(`[data-mon-atk-formula="${id}"]`);
                    const an = nameEl.value.trim(), af = fEl.value.trim(); if (!an || !af) break;
                    m.attacks.push({ name: an, formula: af }); save(); renderMonsters(); break;
                }
                case 'npc-del': state.npcs = state.npcs.filter(n => n.id !== id); save(); renderNpcs(); break;
                case 'quest-del': state.quests = state.quests.filter(q => q.id !== id); save(); renderQuests(); break;
                case 'scene-apply': { const s = find(state.scenes, id); if (s) { applyScene(s); if (live.presChannel) gmBroadcast('scene', { bg: s.bg || null, name: s.name }); } break; }
                case 'scene-del': state.scenes = state.scenes.filter(x => x.id !== id); save(); renderScenes(); break;
                case 'sfx-play': { const s = find(state.soundboard, id); if (s) { if (window.MusicPlayer && window.MusicPlayer.playSfx) window.MusicPlayer.playSfx(s.url); if (!s.local && live.presChannel) gmBroadcast('sfx', { url: s.url, name: s.name }); } break; }
                case 'sfx-del': { const s = find(state.soundboard, id); if (s && s.local && s.url) { try { URL.revokeObjectURL(s.url); } catch (e) {} } if (s && s.path && window.SupaAuth) { try { window.SupaAuth.deleteAsset(s.path); } catch (e) {} } state.soundboard = state.soundboard.filter(x => x.id !== id); save(); renderSoundboard(); break; }
                case 'sfx-native': { const k = t.dataset.sfx; if (window.MusicPlayer && window.MusicPlayer.playBuiltinSfx) window.MusicPlayer.playBuiltinSfx(k); if (live.presChannel) gmBroadcast('sfx', { builtin: k }); break; }
                case 'tree-click': {
                    const n = treeNode(id); if (!n) break;
                    if (n.kind === 'folder') { if (treeExpanded.has(id)) treeExpanded.delete(id); else treeExpanded.add(id); treeTarget = id; }
                    else { treeSelected = (treeSelected === id) ? null : id; treeTarget = n.parent_id || null; }
                    renderTree(); break;
                }
                case 'tree-del': {
                    const n = treeNode(id); if (!n) break;
                    if (!confirm('Supprimer « ' + n.name + ' »' + (n.kind === 'folder' ? ' et tout son contenu' : '') + ' ?')) break;
                    const ids = treeDescendants(id);
                    if (window.SupaAuth && window.SupaAuth.treeDelete) window.SupaAuth.treeDelete(id); // cascade côté serveur
                    tree = tree.filter(x => ids.indexOf(x.id) === -1);
                    if (ids.indexOf(treeSelected) !== -1) treeSelected = null;
                    if (ids.indexOf(treeTarget) !== -1) treeTarget = null;
                    renderTree(); break;
                }
                case 'tree-rename': { const n = treeNode(id); if (!n) break; const nm = prompt('Nouveau nom :', n.name); if (nm && nm.trim()) { treePersist(id, { name: nm.trim() }); renderTree(); } break; }
                case 'tree-to-combat': { const n = treeNode(id); if (n) treeAddMonsterToCombat(n); break; }
                case 'tree-to-map': { const n = treeNode(id); if (n && n.data && n.data.url) { state.map.bg = n.data.url; save(); renderMap(); broadcastMap(true); if (window.showAppToast) window.showAppToast('🗺️ Carte « ' + n.name + ' » sur la table', '#2c3e50'); } else if (window.showAppToast) window.showAppToast('Importe d\'abord une image dans ce nœud.', '#c0392b'); break; }
                case 'tree-open-link': { const n = treeNode(id); if (n && n.data && n.data.url) window.open(n.data.url, '_blank', 'noopener'); break; }
                case 'tree-upload': { pendingTreeUpload = id; byId('gm-tree-file').click(); break; }
                case 'player-sheet': case 'player-kick': openPlayerModal(t.dataset.uid); break;
                case 'offline-sheet': openOfflineSheet(t.dataset.uid); break;
                case 'offline-remove': removeOfflineSheet(t.dataset.uid); break;
            }
        });
        // Délégation : changements (checkboxes, champs de stats joueurs, secrets PNJ)
        document.getElementById('gm-screen').addEventListener('change', (e) => {
            const t = e.target.closest('[data-act]'); if (!t) return;
            const id = t.dataset.id;
            if (t.dataset.act === 'npc-present') { const n = find(state.npcs, id); if (n) { n.present = t.checked; save(); } }
            if (t.dataset.act === 'quest-done') { const q = find(state.quests, id); if (q) { q.done = t.checked; save(); renderQuests(); } }
        });
        document.getElementById('gm-screen').addEventListener('input', (e) => {
            // Champs de l'arbre de préparation (interceptés avant le groupe, à cause de data-f)
            const tt = e.target.closest('[data-tree-text]'); if (tt) { treePatchData(tt.dataset.treeText, { text: e.target.value }); return; }
            const tl = e.target.closest('[data-tree-link]'); if (tl) { treePatchData(tl.dataset.treeLink, { url: e.target.value }); return; }
            const tm = e.target.closest('[data-tree-mon]'); if (tm) { const id = tm.dataset.treeMon, f = tm.dataset.f, n = treeNode(id); const mon = Object.assign({}, (n && n.data && n.data.monster) || {}); mon[f] = (f === 'notes') ? e.target.value : (parseInt(e.target.value) || 0); treePatchData(id, { monster: mon }); return; }
            const pf = e.target.closest('[data-f]');
            if (pf) { const p = find(state.party, pf.dataset.id); if (p) { p[pf.dataset.f] = parseInt(e.target.value) || 0; save(); const item = pf.closest('.gm-party-item'); const fill = item && item.querySelector('.gm-hp-fill'); if (fill && p.hpMax > 0) fill.style.width = Math.max(0, Math.min(1, p.hpCur / p.hpMax)) * 100 + '%'; } return; }
            const sec = e.target.closest('[data-act="npc-secret"]');
            if (sec) { const n = find(state.npcs, sec.dataset.id); if (n) { n.secret = e.target.value; save(); } }
        });
    }

    // ---------- Chargement / migration cloud du profil MJ ----------
    // Rafraîchit l'état de la campagne ouverte depuis le cloud (multi-appareils).
    async function loadStateFromCloud(id) {
        if (!window.SupaAuth || !window.SupaAuth.currentUser || !window.SupaAuth.gmCampaignState) return;
        let cloudState = null;
        try { cloudState = await window.SupaAuth.gmCampaignState(id); } catch (e) { return; }
        if (id !== activeCampaignId) return;                 // l'utilisateur a déjà changé de campagne
        if (cloudState && typeof cloudState === 'object' && Object.keys(cloudState).length) {
            const keepRoom = state.roomCode, keepSid = state.sessionId; // on préserve la session live de cet appareil
            state = Object.assign(defaultState(), cloudState);
            state.roomCode = keepRoom; state.sessionId = keepSid;
            try { localStorage.setItem(stateKey(), JSON.stringify(state)); } catch (e) {}
            renderAll();
        }
    }

    // Liste les campagnes depuis le cloud ; migre les campagnes locales la 1re fois.
    async function gmCloudInit() {
        if (!window.SupaAuth || !window.SupaAuth.currentUser || !window.SupaAuth.gmCampaignsList) return;
        let cloud = null;
        try { cloud = await window.SupaAuth.gmCampaignsList(); } catch (e) { return; }
        if (cloud === null) return;                          // table injoignable (SQL pas lancé) → on reste en local, on réessaiera
        const migrated = localStorage.getItem('dnd-gm-migrated') === '1';
        if (!cloud.length && campaigns.length && !migrated) {
            // Migration unique : pousse les campagnes locales + leur état vers le cloud.
            let allOk = true;
            for (const c of campaigns) {
                let st = {};
                try { st = JSON.parse(localStorage.getItem('dnd-gm-state-' + c.id)) || {}; } catch (e) {}
                const res = await window.SupaAuth.gmCampaignUpsert({ id: c.id, name: c.name, archived: !!c.archived, state: exportState(st) });
                if (!res) allOk = false;
            }
            if (allOk) localStorage.setItem('dnd-gm-migrated', '1'); // on ne marque migré que si tout est bien remonté
            renderCampaigns();
            return;
        }
        localStorage.setItem('dnd-gm-migrated', '1');
        // Cloud = source de vérité : on remplace la liste locale par celle du cloud.
        campaigns = cloud.map(c => ({ id: c.id, name: c.name, archived: !!c.archived, created: c.created_at ? Date.parse(c.created_at) : Date.now() }));
        try { localStorage.setItem(CAMP_KEY, JSON.stringify(campaigns)); } catch (e) {}
        renderCampaigns();
    }

    // ---------- Campagnes (accueil MJ) ----------
    function createCampaign(name) { const c = { id: uid(), name: name.trim(), archived: false, created: Date.now() }; campaigns.push(c); saveCampaigns(); renderCampaigns(); return c; }
    function renderCampaigns() {
        const list = document.getElementById('gm-campaign-list'); if (!list) return;
        const showArch = (document.getElementById('gm-show-archived') || {}).checked;
        const visible = campaigns.filter(c => showArch || !c.archived);
        list.innerHTML = '';
        if (!visible.length) { list.innerHTML = `<p style="text-align:center; font-style:italic; color:#888;">Aucune campagne. Créez-en une !</p>`; return; }
        visible.forEach(c => {
            const card = document.createElement('div'); card.className = 'char-card campaign-card' + (c.archived ? ' is-archived' : '');
            const info = document.createElement('div'); info.className = 'char-info';
            info.innerHTML = `<strong>${esc(c.name)}</strong> ${c.archived ? '<span style="font-size:0.8rem;color:#888;">(archivée)</span>' : ''}`;
            info.onclick = () => open(c.id);
            const actions = document.createElement('div'); actions.className = 'campaign-actions';
            const mk = (label, title, fn) => { const b = document.createElement('button'); b.textContent = label; b.title = title; b.onclick = (e) => { e.stopPropagation(); fn(); }; return b; };
            actions.appendChild(mk('▶', 'Ouvrir', () => open(c.id)));
            actions.appendChild(mk('✏️', 'Renommer', () => { const n = prompt('Nouveau nom :', c.name); if (n && n.trim()) { c.name = n.trim(); saveCampaigns(); renderCampaigns(); } }));
            actions.appendChild(mk(c.archived ? '📂' : '🗄️', c.archived ? 'Désarchiver' : 'Archiver', () => { c.archived = !c.archived; saveCampaigns(); renderCampaigns(); }));
            actions.appendChild(mk('✖', 'Supprimer', () => { if (confirm('Supprimer définitivement « ' + c.name + ' » et toutes ses données ?')) { try { localStorage.removeItem('dnd-gm-state-' + c.id); } catch (e) {} if (window.SupaAuth && window.SupaAuth.gmCampaignDelete) window.SupaAuth.gmCampaignDelete(c.id); campaigns = campaigns.filter(x => x.id !== c.id); saveCampaigns(); renderCampaigns(); } }));
            card.appendChild(info); card.appendChild(actions); list.appendChild(card);
        });
    }
    function wireHome() {
        document.querySelectorAll('.home-tab').forEach(tab => tab.addEventListener('click', () => {
            document.querySelectorAll('.home-tab').forEach(t => t.classList.remove('active')); tab.classList.add('active');
            const isGm = tab.dataset.htab === 'gm';
            const pp = document.getElementById('home-panel-player'); const pg = document.getElementById('home-panel-gm');
            if (pp) pp.classList.toggle('hidden', isGm); if (pg) pg.classList.toggle('hidden', !isGm);
            if (isGm) renderCampaigns();
        }));
        const cc = document.getElementById('btn-create-campaign');
        if (cc) cc.addEventListener('click', () => { const i = document.getElementById('new-campaign-name'); const n = (i.value || '').trim(); if (n) { createCampaign(n); i.value = ''; } });
        const ni = document.getElementById('new-campaign-name'); if (ni) ni.addEventListener('keydown', e => { if (e.key === 'Enter' && cc) { e.preventDefault(); cc.click(); } });
        const sa = document.getElementById('gm-show-archived'); if (sa) sa.addEventListener('change', renderCampaigns);
        renderCampaigns();
        waitForUserGM(gmCloudInit);          // charge / migre les campagnes depuis le cloud une fois connecté
    }

    // ---------- Ouverture / fermeture ----------
    function open(campaignId) {
        if (campaignId && campaignId !== activeCampaignId) { GmCloud.flushNow(); stopNetwork(); } // change de campagne → pousse l'état en attente, coupe l'ancien flux
        if (campaignId) { activeCampaignId = campaignId; state = load(); }
        else if (!activeCampaignId) { const c = createCampaign('Partie rapide'); activeCampaignId = c.id; state = load(); }
        const ov = document.getElementById('gm-screen'); if (!ov) return;
        const camp = campaigns.find(c => c.id === activeCampaignId);
        const tEl = document.getElementById('gm-campaign-title'); if (tEl) tEl.textContent = camp ? '— ' + camp.name : '';
        // Sur mobile, on démarre avec la sidebar repliée pour ne pas masquer le contenu
        if (window.innerWidth <= 1100) ov.classList.add('gm-sidebar-collapsed');
        else ov.classList.remove('gm-sidebar-collapsed');
        if (window.navTo) window.navTo('gm-screen'); else ov.classList.remove('hidden');
        // Le MJ contrôle TOUJOURS la musique sur son écran (jamais le mode « contrôlé par le MJ »)
        if (window.MusicPlayer && window.MusicPlayer.setRole) window.MusicPlayer.setRole('free');
        try { if (location.hash !== '#gm/' + activeCampaignId) location.hash = '#gm/' + activeCampaignId; } catch (e) {}
        ensureMaps();
        renderAll();
        loadTree();
        loadStateFromCloud(activeCampaignId);                 // rafraîchit depuis le cloud (multi-appareils)
        if (state.sessionId && !live.netChannel) startNetwork(); // reconnecte une session déjà ouverte
    }
    function close() {
        // Restaure le rôle musique : « joueur » seulement si une session joueur est active, sinon « libre »
        if (window.MusicPlayer && window.MusicPlayer.setRole) {
            const asPlayer = !!(window.PlayerSession && window.PlayerSession.isConnected && window.PlayerSession.isConnected());
            window.MusicPlayer.setRole(asPlayer ? 'player' : 'free');
        }
        // Retour à l'accueil (onglet MJ), sans toucher à la fiche éventuellement active
        try { if ((location.hash || '').indexOf('#gm/') === 0) location.hash = '#home'; } catch (e) {}
        if (window.navTo) window.navTo('home-screen');
        const gmTab = document.querySelector('.home-tab[data-htab="gm"]');
        if (gmTab) gmTab.click(); else renderCampaigns();
    }

    // ---------- Routage par hash (#gm/<campaignId>) ----------
    function waitForUserGM(cb, tries) {
        tries = tries == null ? 30 : tries;
        if (window.SupaAuth && window.SupaAuth.currentUser) return cb();
        if (tries <= 0) return;
        setTimeout(() => waitForUserGM(cb, tries - 1), 200);
    }
    function gmRouteId() { const m = (location.hash || '').match(/^#gm\/(.+)$/); return m ? m[1] : null; }
    function onHashChange() {
        const id = gmRouteId();
        if (id) {
            if (id !== activeCampaignId || !document.body.classList.contains('gm-active')) {
                if (campaigns.find(c => c.id === id)) open(id);
            }
        } else if (document.body.classList.contains('gm-active')) {
            // On a quitté la route MJ (retour navigateur) alors que l'écran MJ est affiché
            if (window.navTo) window.navTo('home-screen');
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        injectHTML();
        setTimeout(() => {
            wire(); wireHome();
            window.addEventListener('hashchange', onHashChange);
            window.addEventListener('beforeunload', () => GmCloud.flushNow()); // sauvegarde cloud des dernières modifs MJ
            // Restauration au chargement : #gm/<id> rouvre la campagne une fois connecté
            if (gmRouteId()) waitForUserGM(onHashChange);
        }, 60);
    });

    window.GMScreen = { open, close };
})();
