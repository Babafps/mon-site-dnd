// =====================================================
// help.js — Centre d'aide : « comment ça marche ? »
//
// Chaque sujet est une fiche courte, en étapes numérotées, qu'on peut garder
// ouverte pendant qu'on remplit le formulaire dont elle parle. Deux sujets
// lancent une démonstration au lieu d'un texte (visite guidée, assistant).
//
// Ouverture : menu ☰ → « Aide & tutoriels », ou window.Help.open('armes').
// =====================================================
(function () {
    'use strict';

    const esc = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    // `steps` : les gestes dans l'ordre · `tips` : ce qu'on découvre trop tard
    const TOPICS = [
        {
            id: 'fiche', icon: '📜', title: 'Découvrir la fiche',
            intro: `La fiche est découpée en <b>modules</b> : points de vie, caractéristiques,
                    armes, sac à dos, sorts… Tout se sauvegarde tout seul pendant que tu écris.`,
            steps: [
                ['Plier un module', 'Clique sur son titre : il se replie pour libérer de la place.'],
                ['Réorganiser', 'Menu ☰ → Apparence → Disposition. Le mode « Personnalisé » te laisse choisir quel module va dans quelle colonne.'],
                ['Sur téléphone', 'La fiche passe seule en affichage mobile, avec une barre de navigation en bas (Perso · Combat · Sac · Magie · Notes).']
            ],
            tips: ['Le bouton ▲ à côté du niveau fait monter de niveau et annonce ce que tu gagnes.'],
            action: { label: '🎓 Lancer la visite guidée', run: () => window.PjTutorial && window.PjTutorial.startTutorial(true) }
        },
        {
            id: 'armes', icon: '⚔️', title: 'Remplir mes armes',
            intro: `Module <b>Équipement (Attaques)</b> → bouton <b>➕ Ajouter</b>.
                    Une entrée peut être une simple attaque, ou un objet magique complet
                    avec sa description et ses charges.`,
            steps: [
                ['Le nom', 'Tape les premières lettres : la liste des armes et objets du SRD apparaît. En choisir un remplit tout seul les dégâts, la portée, les propriétés, la rareté, la description — et même le nombre de charges quand le texte le mentionne.'],
                ['Toucher', 'Ton bonus au toucher : modificateur de caractéristique + bonus de maîtrise (+ bonus magique). Écris-le tel quel, par exemple <b>+7</b>. Pour un souffle ou un piège, bascule sur « Jet de sauvegarde imposé » et donne le DD.'],
                ['Dégâts', 'Les <b>dés d’un côté</b> (<b>1d8+3</b>), le <b>type de l’autre</b> (<b>tranchants</b>). C’est cette séparation qui permet de doubler correctement les dés sur un critique.'],
                ['Deux mains & dégâts bonus', '« Version à deux mains » pour une arme polyvalente (1d10+3). « Dégâts bonus » pour ce qui s’ajoute toujours : les 2d6 radiants d’une épée solaire, le 1d6 de feu d’une lame ardente.'],
                ['Munitions et charges', 'Les munitions se décomptent à chaque attaque. Les charges servent aux objets magiques : indique combien, et quand elles reviennent (repos court, repos long, à l’aube). Une quantité comme <b>1d6+1</b> sera lancée au repos ; laisse vide pour tout récupérer.'],
                ['Objet magique', 'Coche « Nécessite une liaison » et colle la description : elle restera dépliable sous la ligne, tu n’auras plus à rouvrir le livre à table.']
            ],
            tips: [
                'Clique sur le <b>nom de l’arme</b> (bouton ⚔️ Attaquer) : le d20 roule en 3D, le bonus s’ajoute, les dégâts suivent — et sur un critique les dés sont doublés automatiquement.',
                'Les pastilles <b>Toucher</b> et <b>Dégâts</b> lancent chacune leur moitié. <b>Maj+clic</b> sur Dégâts force un critique.',
                'Le seuil de critique se règle (19 pour un Champion) : le jet en tient compte.',
                'L’étoile ☆ épingle l’arme en haut de la liste et garde sa description ouverte.'
            ]
        },
        {
            id: 'sac', icon: '🎒', title: 'Remplir mon sac à dos',
            intro: `La ligne du haut sert aux ajouts rapides ; le crayon <b>✎</b> ouvre la
                    fiche complète d’un objet.`,
            steps: [
                ['Ajout rapide', 'Nom, quantité, poids, onglet — puis ➕. Là aussi, taper le début d’un nom propose les objets du SRD : le poids, le prix, la rareté et la description viennent avec.'],
                ['Fiche complète', 'Le crayon ✎ ouvre tout : valeur, rareté, liaison, charges et leur recharge, description, note courte.'],
                ['Onglets', 'Range par catégories (Armes, Potions, Trésor…). Le bouton ⚙️ des onglets permet de les renommer et de les réordonner.'],
                ['Équipé ou rangé', 'L’icône ⚔️ marque un objet comme porté : il remonte au-dessus du reste.'],
                ['Épingler', 'L’étoile ☆ garde l’objet tout en haut, description ouverte. Pratique pour la potion qu’on cherche en plein combat.']
            ],
            tips: [
                'Le bouton <b>⚔️+</b> transforme un objet du sac en arme dans le module Attaques, en gardant sa description et ses charges.',
                'La recherche du sac fouille aussi les descriptions : « résistance au feu » retrouve l’objet même si tu as oublié son nom.',
                'Le total en bas compte le poids et le nombre d’objets liés (la limite est de 3).'
            ]
        },
        {
            id: 'des', icon: '🎲', title: 'Lancer les dés',
            intro: `Presque tout ce qui est <b>cliquable</b> lance un dé.`,
            steps: [
                ['Caractéristiques et compétences', 'Clique sur le NOM (« Dextérité », « Discrétion ») : le d20 part avec le bon modificateur.'],
                ['Maîtrises', 'Le rond ○ devant une compétence : un clic = maîtrise (●), un second = expertise (★).'],
                ['Avantage et désavantage', 'Le sélecteur du panneau de dés change le mode : deux d20 sont lancés, le bon est gardé, l’autre est barré.'],
                ['Armes', 'Le bouton ⚔️ Attaquer d’une arme enchaîne toucher et dégâts.'],
                ['Expression libre', 'Le module Calculatrice accepte n’importe quoi : <b>2d6+3</b>, <b>4d6-1</b>…']
            ],
            tips: [
                'Chaque jet est conservé dans l’historique, avec son détail.',
                'Si tu es connecté à la session de ton MJ, tes jets lui sont envoyés en direct.'
            ]
        },
        {
            id: 'regles', icon: '📖', title: 'Les règles & mon contenu',
            intro: `Toute la base de règles est intégrée, et tu peux y ajouter la tienne.`,
            steps: [
                ['Ouvrir', 'Bouton « 📖 Règles du jeu » sur l’écran d’accueil, ou la loupe 🔍 depuis la fiche.'],
                ['Filtrer', 'Sorts : par niveau, école, classe. Monstres : par facteur de puissance, type, taille. Les filtres se combinent avec la recherche.'],
                ['Vue tableau', 'Sur grand écran, le bouton ▦ passe en tableau trié : clique un en-tête pour trier par facteur de puissance, par niveau…'],
                ['Mon contenu', 'Bouton « ✍️ Mon contenu » : crée tes classes, sous-classes, races, sorts, objets, monstres. Ils apparaissent ensuite partout, comme le contenu officiel.'],
                ['Partager', 'Le bouton Exporter enregistre tout ton contenu dans un fichier que ta table peut réimporter.']
            ],
            tips: [
                'Partir d’une entrée officielle : « 📋 Copier du SRD » recopie le Guerrier pour que tu en fasses une variante.',
                'Une classe créée par toi se comporte comme une officielle : l’assistant la connaît, la montée de niveau aussi.'
            ]
        },
        {
            id: 'assistant', icon: '✨', title: 'L’assistant de création',
            intro: `Il remplit la fiche avec toi et déduit tout ce qui peut l’être à partir
                    de la race et de la classe choisies.`,
            steps: [
                ['Identité', 'Nom, classe, sous-classe, niveau. Ton contenu personnel est proposé au même titre que le contenu officiel.'],
                ['Origine', 'Race et sous-race : bonus de caractéristiques, vitesse, taille et langues sont appliqués.'],
                ['Caractéristiques', 'Trois méthodes au choix : répartition à 27 points, tableau standard (15-14-13-12-10-8) ou 4d6 en gardant les 3 meilleurs.'],
                ['Maîtrises', 'Les jets de sauvegarde de la classe sont cochés ; les compétences sont limitées à la liste de la classe et au nombre autorisé.'],
                ['Équipement & aptitudes', 'L’équipement de départ part dans le sac, les aptitudes gagnées dans les capacités, les emplacements de sorts sont réglés.']
            ],
            tips: ['Une fiche incomplète te propose de reprendre l’assistant là où tu en étais.'],
            action: { label: '✨ Lancer l’assistant', run: () => window.PjTutorial && window.PjTutorial.startWizard() }
        }
    ];

    let built = false, current = 'fiche';

    function build() {
        if (built) return;
        built = true;
        const ov = document.createElement('div');
        ov.id = 'help-modal';
        ov.className = 'modal-overlay hidden no-print';
        ov.innerHTML = `
            <div class="modal-box help-box">
                <div class="modal-header">
                    <h2>🎓 Comment ça marche ?</h2>
                    <button class="btn-close-modal" id="btn-close-help">X</button>
                </div>
                <div class="help-body">
                    <nav class="help-nav" id="help-nav"></nav>
                    <article class="help-content" id="help-content"></article>
                </div>
            </div>`;
        document.body.appendChild(ov);
        document.getElementById('btn-close-help').addEventListener('click', close);
        ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
        document.getElementById('help-nav').addEventListener('click', (e) => {
            const b = e.target.closest('[data-topic]'); if (!b) return;
            show(b.dataset.topic);
        });
        document.getElementById('help-content').addEventListener('click', (e) => {
            const b = e.target.closest('[data-help-action]'); if (!b) return;
            const t = TOPICS.find(x => x.id === b.dataset.helpAction);
            close();
            if (t && t.action) setTimeout(t.action.run, 150);
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !ov.classList.contains('hidden')) close();
        });
    }

    function show(id) {
        current = id;
        const t = TOPICS.find(x => x.id === id) || TOPICS[0];
        document.getElementById('help-nav').innerHTML = TOPICS.map(x =>
            `<button type="button" data-topic="${x.id}" class="help-tab${x.id === t.id ? ' is-on' : ''}">
                <span>${x.icon}</span> ${esc(x.title)}</button>`).join('');
        document.getElementById('help-content').innerHTML = `
            <h3>${t.icon} ${esc(t.title)}</h3>
            <p class="help-intro">${t.intro}</p>
            ${t.action ? `<button type="button" class="btn help-do" data-help-action="${t.id}">${esc(t.action.label)}</button>` : ''}
            <ol class="help-steps">${(t.steps || []).map(([h, d]) =>
                `<li><b>${esc(h)}</b><span>${d}</span></li>`).join('')}</ol>
            ${(t.tips || []).length ? `<div class="help-tips"><h4>Bon à savoir</h4><ul>${
                t.tips.map(x => `<li>${x}</li>`).join('')}</ul></div>` : ''}`;
        document.getElementById('help-content').scrollTop = 0;
    }

    function open(id) {
        build();
        show(id || current);
        document.getElementById('help-modal').classList.remove('hidden');
    }
    function close() { document.getElementById('help-modal')?.classList.add('hidden'); }

    // Boutons du menu ☰ (présents dans index.html)
    document.addEventListener('DOMContentLoaded', () => {
        document.body.addEventListener('click', (e) => {
            const b = e.target.closest('[data-help]'); if (!b) return;
            document.getElementById('settings-dropdown')?.classList.add('hidden');
            open(b.dataset.help);
        });
    });

    window.Help = { open, close, TOPICS };
})();
