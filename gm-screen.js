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
    // Générateur de PNJ : prénom + nom de famille + métier + trait (fiche express jouable)
    const GEN_FIRST = ['Aldric', 'Maelle', 'Garrik', 'Sylphine', 'Thorin', 'Élora', 'Brann', 'Wynn', 'Cécile',
        'Vasco', 'Nessa', 'Kaeleth', 'Tobias', 'Aldwena', 'Roland', 'Lysandre', 'Gunnar', 'Mira', 'Edric', 'Yseult',
        'Bram', 'Ophélie', 'Dorn', 'Selene', 'Hadrien', 'Faylen', 'Osric', 'Rowena', 'Corvin', 'Ludmilla',
        'Théodric', 'Isaure', 'Malko', 'Perrine', 'Aldebert', 'Gwendoline', 'Ferran', 'Ismérie', 'Bastien', 'Aldoria',
        'Cassian', 'Morgane', 'Ulric', 'Talia', 'Renaud', 'Aveline', 'Solveig', 'Léofric', 'Dagobert', 'Wilhelmina'];
    const GEN_LAST = ['Pierre-Poing', 'Vent-d\'Argent', 'Barbe-de-Fer', 'Tisse-Ombre', 'Cœur-Vaillant', 'd\'Aubéron',
        'Feuille-Rousse', 'Grise-Lune', 'le Borgne', 'la Murmurante', 'Sang-Noir', 'Haute-Tour', 'des Marais',
        'Forge-Tonnerre', 'Brise-Lame', 'Aile-de-Corbeau', 'Or-en-Bouche', 'le Sombre', 'Val-Profond', 'Croc-Gelé',
        'Tord-Boyaux', 'Fend-la-Bise', 'de Mortelune', 'Trois-Doigts', 'l\'Aubergiste', 'Chante-Pluie', 'du Bas-Quartier',
        'Taille-Roc', 'Souffle-Court', 'Main-Leste', 'Bec-Salé', 'de Ronce-Épine', 'Œil-de-Faucon', 'Face-de-Craie'];
    const GEN_JOB = ['aubergiste', 'forgeron', 'garde de la porte', 'apothicaire', 'prêtre défroqué', 'contrebandière',
        'chasseuse de primes', 'marchand ambulant', 'ménestrel', 'batelier', 'scribe', 'meunière', 'mercenaire à la retraite',
        'voleuse à la tire', 'herboriste', 'fossoyeur', 'palefrenier', 'diseuse de bonne aventure', 'capitaine de la milice',
        'tenancière de bordel', 'alchimiste raté', 'noble désargenté', 'pêcheur superstitieux', 'tavernière borgne'];
    const GEN_TRAIT = ['parle toujours à voix basse', 'a une dette de jeu énorme', 'ment sur son passé', 'connaît un secret dangereux',
        'boite depuis une vieille bataille', 'collectionne les dents', 'a peur du noir', 'travaille pour deux camps',
        'cherche son frère disparu', 'porte toujours une amulette', 'déteste les elfes', 'rit à des moments gênants',
        'a un familier caché', 'jure sur d\'anciens dieux', 'ne dort jamais deux nuits au même endroit', 'est étonnamment cultivé',
        'sent le poisson et l\'encens', 'a échappé à une pendaison', 'sait où sont enterrés les corps', 'cache un tatouage de guilde'];
    function genNpcName() {
        const pick = a => a[Math.floor(Math.random() * a.length)];
        return pick(GEN_FIRST) + ' ' + pick(GEN_LAST) + ', ' + pick(GEN_JOB) + ' — ' + pick(GEN_TRAIT) + '.';
    }
    const GEN_RUMORS = ['Une lumière étrange flotte chaque nuit au-dessus du vieux moulin.',
        'Le seigneur local n\'a plus été vu depuis trois lunes…', 'On dit qu\'un dragon dort sous la colline aux Corbeaux.',
        'Des marchands disparaissent sur la route de l\'Est.', 'La fille du forgeron parlerait aux morts.',
        'Un trésor maudit reposerait au fond du puits asséché.', 'Les loups descendent des montagnes plus tôt que d\'habitude.',
        'Un culte se réunirait dans les égouts de la cité basse.',
        'Le nouveau prêtre ne projette pas d\'ombre à la lumière des bougies.', 'Une porte est apparue dans une ruelle où il n\'y en avait pas.',
        'Les cloches sonnent seules à minuit depuis la mort du bourgmestre.', 'On paie en or ancien qui se change en feuilles au matin.',
        'La forêt a « avancé » de trois pas cette semaine, jurent les bûcherons.', 'Un enfant du village récite des noms de gens jamais nés.',
        'Le pont-levis du château est baissé depuis dix ans, mais personne n\'ose entrer.', 'Des chants montent du lac gelé quand la lune est pleine.',
        'Le fossoyeur creuse des tombes avant que les gens ne meurent.', 'Un colporteur vend des rêves en fioles — et certains marchent.',
        'La comète rouge annoncerait le retour d\'un roi-sorcier.', 'Les rats fuient la ville par milliers, personne ne sait pourquoi.',
        'Une auberge fantôme apparaît sur la lande les nuits de brouillard.', 'Le puits du marché renvoie parfois des pièces… et des doigts.'];
    const GEN_LOOT = ['Une potion de soins (2d4+2 PV)', '37 pièces d\'or dans une bourse en cuir', 'Une dague finement ouvragée (+1)',
        'Un parchemin de sort inconnu', 'Une gemme verte d\'une valeur de 50 po', 'Une carte au trésor déchirée en deux',
        'Un anneau de cuivre gravé de runes', 'Une fiole de poison (CD 13)', 'Des bottes de marche silencieuse', 'Un médaillon avec un portrait inconnu',
        'Une clé en os qui n\'ouvre aucune porte connue', 'Un carnet chiffré aux pages arrachées', 'Trois flèches à pointe d\'argent',
        'Une bague de sceau d\'une maison noble déchue', 'Un flacon d\'huile qui brûle sans consumer', 'Un dé pipé qui tombe toujours sur 1',
        'Une plume de créature volante, encore chaude', 'Une bourse cousue de fils d\'or (110 po)', 'Un miroir de poche fêlé qui montre autre chose',
        'Une amulette tiède au toucher, froide au danger', 'Un contrat signé du sang d\'un diable', 'Une petite statuette de jade (75 po)',
        'Un grimoire relié de cuir dont l\'auteur vous ressemble', 'Un cristal qui murmure quand on l\'approche du feu',
        'Une paire de dés en ivoire dans un étui de velours', 'Une corde de soie qui ne s\'effiloche jamais (15 m)',
        'Un anneau qui laisse une marque de brûlure quand on ment', 'Un sablier dont le sable remonte par moments'];
    const DICE = [4, 6, 8, 10, 12, 20, 100];

    // ---------- Ambiances en un clic (météo + teinte + effet sonore, diffusées à la table) ----------
    // weather : effet animé (rain/snow/fog/embers/'') · tint : voile coloré sur la carte (rgba)
    // sfx : effet sonore intégré joué chez le MJ ET les joueurs.
    const AMBIANCES = [
        { key: 'tavern', icon: '🍺', label: 'Taverne', weather: '', tint: 'rgba(196,120,40,0.16)', sfx: 'tavern', note: 'Chaleur, brouhaha, feu de cheminée' },
        { key: 'dungeon', icon: '🏚️', label: 'Donjon', weather: 'fog', tint: 'rgba(20,30,60,0.34)', sfx: 'door', note: 'Froid, humide, oppressant' },
        { key: 'combat', icon: '⚔️', label: 'Combat', weather: 'embers', tint: 'rgba(150,20,20,0.20)', sfx: 'horn', note: 'Tension, cendres, cor de guerre' },
        { key: 'storm', icon: '⛈️', label: 'Tempête', weather: 'rain', tint: 'rgba(40,55,90,0.30)', sfx: 'thunder', note: 'Pluie battante et tonnerre' },
        { key: 'forest', icon: '🌲', label: 'Forêt', weather: '', tint: 'rgba(30,90,40,0.18)', sfx: '', note: 'Sous-bois verdoyant et calme' },
        { key: 'snow', icon: '❄️', label: 'Blizzard', weather: 'snow', tint: 'rgba(150,180,220,0.20)', sfx: '', note: 'Neige et vent glacial' },
        { key: 'night', icon: '🌙', label: 'Nuit', weather: '', tint: 'rgba(10,15,45,0.40)', sfx: 'bell', note: 'Obscurité paisible, cloche lointaine' },
        { key: 'clear', icon: '☀️', label: 'Aucune', weather: '', tint: '', sfx: '', note: 'Retire météo et teinte' }
    ];

    // ---------- Générateur de rencontres : par environnement × palier de niveau ----------
    // Chaque entrée = { name, hp, ac } — jetons/monstres posables directement.
    const ENCOUNTERS = {
        forest: {
            1: [['Loups affamés (×3)', 11, 13], ['Gobelins embusqués (×4)', 7, 15], ['Araignée géante', 26, 14], ['Sanglier enragé', 16, 11], ['Bandits de grand chemin (×3)', 11, 12]],
            2: [['Ours-hibou', 59, 13], ['Meute de loups sinistres (×3)', 37, 14], ['Druide dévoyé + lianes', 27, 11], ['Ettercap et ses araignées', 44, 13], ['Tigre à dents de sabre', 52, 12]],
            3: [['Traquenard (plante monstrueuse)', 78, 13], ['Géant des collines', 105, 13], ['Loup-garou solitaire', 58, 12], ['Dryade et ses complices', 22, 11], ['Chimère', 114, 14]],
            4: [['Traquefeuille ancien', 187, 15], ['Couvée de jeunes dragons verts', 136, 18], ['Géant des forêts', 200, 16], ['Élémentaire de bois éveillé', 152, 15]]
        },
        dungeon: {
            1: [['Squelettes (×4)', 13, 13], ['Zombies lents (×3)', 22, 8], ['Gelée ocre', 45, 8], ['Culte de fanatiques (×3)', 22, 13], ['Mimic (coffre piégé)', 58, 12]],
            2: [['Goule et ses goules-liges (×3)', 22, 12], ['Ombre affamée', 16, 12], ['Golem de pacotille', 33, 14], ['Sorcier et familiers', 40, 12], ['Ossuaire animé', 52, 13]],
            3: [['Spectre gardien', 66, 12], ['Momie et malédiction', 58, 11], ['Golem de pierre', 178, 17], ['Cambion geôlier', 82, 19], ['Nuée de crânes hurlants', 90, 15]],
            4: [['Liche mineure', 135, 17], ['Golem de fer', 210, 20], ['Cauchemar de l\'ossuaire', 187, 18], ['Seigneur-liche et sbires', 165, 17]]
        },
        city: {
            1: [['Coupe-jarrets (×4)', 11, 12], ['Garde corrompue (×3)', 11, 16], ['Pickpocket et complices', 9, 13], ['Chien de combat lâché (×2)', 9, 12], ['Ivrogne magicien', 22, 11]],
            2: [['Assassin de guilde', 78, 15], ['Capitaine de la milice + gardes', 65, 18], ['Réseau de voleurs (×4)', 27, 14], ['Mage de rue et golem', 40, 13], ['Diablotin espion + sbires', 33, 13]],
            3: [['Vampire spawn en cavale', 82, 15], ['Chef de guilde et ses lames', 90, 16], ['Doppelganger infiltré', 52, 14], ['Cambion marchand d\'esclaves', 82, 19], ['Golem de chair (arène)', 93, 9]],
            4: [['Archimage renégat', 99, 17], ['Vampire noble et goules', 144, 16], ['Prince du crime + gardes d\'élite', 120, 18], ['Diable barbelé conseiller', 110, 19]]
        },
        road: {
            1: [['Bandits (×4)', 11, 12], ['Loups affamés (×3)', 11, 13], ['Gobelins à cheval (×3)', 7, 15], ['Ogre péager', 59, 11], ['Faux marchand + brigands', 22, 13]],
            2: [['Bande de maraudeurs (×5)', 27, 14], ['Manticore', 68, 14], ['Chevalier renégat + hommes d\'armes', 52, 18], ['Ettin des collines', 85, 12], ['Basilic embusqué', 52, 15]],
            3: [['Troll affamé', 84, 15], ['Groupe de mercenaires vétérans (×4)', 65, 17], ['Wyverne chasseresse', 110, 13], ['Géant des pierres', 126, 17], ['Cavaliers spectraux (×3)', 66, 13]],
            4: [['Dragon rouge juvénile', 178, 18], ['Horde d\'orques (×8) + chef', 93, 16], ['Géant du givre + loups', 138, 15], ['Chimère et cavalerie', 114, 14]]
        },
        mountain: {
            1: [['Aigles géants (×2)', 26, 13], ['Harpies (×3)', 38, 11], ['Gobelins des cimes (×4)', 7, 15], ['Ours brun', 34, 11], ['Contrebandiers (×3)', 11, 12]],
            2: [['Griffon affamé', 59, 12], ['Ogres (×2)', 59, 11], ['Géant des collines', 105, 13], ['Cockatrice en nuée (×3)', 27, 11], ['Chef gobelin + loups', 40, 14]],
            3: [['Géant des pierres', 126, 17], ['Wyverne + petits', 110, 13], ['Yéti ancien', 90, 12], ['Dragon blanc juvénile', 133, 17], ['Roc affamé', 145, 15]],
            4: [['Géant du givre et sa meute', 138, 15], ['Dragon rouge adulte', 256, 19], ['Roc légendaire', 248, 15], ['Titan de pierre éveillé', 220, 18]]
        },
        swamp: {
            1: [['Crocodiles (×2)', 19, 12], ['Vase grise', 45, 8], ['Hommes-lézards (×3)', 22, 15], ['Nuée de moustiques sanguinaires', 22, 12], ['Sorcière des marais (mineure)', 22, 11]],
            2: [['Hydre juvénile', 84, 15], ['Troll des marais', 84, 15], ['Vouivre venimeuse', 68, 13], ['Chaman lézard + guerriers', 52, 15], ['Volée de stirges (×6)', 5, 14]],
            3: [['Hydre à cinq têtes', 136, 15], ['Naga gardien', 75, 15], ['Nuée de mort-vivants noyés', 93, 10], ['Méphites et élémentaire de boue', 88, 13], ['Croque-mitaine des tourbières', 90, 14]],
            4: [['Hydre ancienne', 172, 15], ['Dragon noir adulte', 195, 19], ['Nuée de nagas', 150, 16], ['Élémentaire de marée abyssal', 175, 15]]
        },
        coast: {
            1: [['Pirates (×4)', 11, 12], ['Crabes géants (×3)', 15, 15], ['Sirènes trompeuses (×2)', 16, 11], ['Requin traqueur', 22, 12], ['Contrebandiers armés (×3)', 16, 13]],
            2: [['Sahuagins pillards (×4)', 22, 15], ['Requin-taureau géant', 88, 13], ['Capitaine pirate + équipage', 65, 15], ['Élémentaire d\'eau', 114, 14], ['Méduse échouée', 127, 15]],
            3: [['Kraken juvénile (tentacules)', 110, 14], ['Sahuagin baron + gardes', 90, 16], ['Épave hantée (spectres ×4)', 66, 12], ['Hydre côtière', 136, 15], ['Dragon de bronze juvénile', 142, 18]],
            4: [['Kraken (rencontre légendaire)', 250, 18], ['Dragon de bronze adulte', 212, 19], ['Léviathan élémentaire', 200, 15], ['Cour de tritons + géant des mers', 180, 16]]
        }
    };

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
        { name: 'Vision dans le noir', text: 'À 18 m, la pénombre est traitée comme lumière vive et l\'obscurité comme pénombre (en nuances de gris). Ne perce pas l\'obscurité magique.' },
        { name: 'Degrés de difficulté (DD)', text: 'Très facile 5 · Facile 10 · Moyen 15 · Difficile 20 · Très difficile 25 · Quasi impossible 30.' },
        { name: 'Maîtrise par niveau', text: 'Niv 1-4 : +2 · 5-8 : +3 · 9-12 : +4 · 13-16 : +5 · 17-20 : +6.' },
        { name: 'XP de rencontre (par PJ niv.)', text: 'Seuils approximatifs/PJ — Facile/Moyen/Difficile/Mortel. Niv 1 : 25/50/75/100. Niv 5 : 250/500/750/1100. Adapter selon le groupe.' },
        { name: 'Transport & vitesse de voyage', text: 'Rythme lent 3 km/h (avantage Discrétion) · normal 4,5 km/h · rapide 6 km/h (−5 Perception passive). ≈ 24/36/48 km par jour.' },
        { name: 'Nourriture & eau', text: 'Besoin/jour : ~0,5 kg de nourriture et ~4 L d\'eau (le double par forte chaleur). Privation → épuisement.' },
        { name: 'Suffocation / noyade', text: 'Réserve d\'air = 1 + mod. CON minutes (min 30 s). Ensuite : 0 PV au bout de mod. CON rounds (min 1).' },
        { name: 'Tomber inconscient (PV 0)', text: 'Tu tombes à terre, neutralisé, et fais des jets contre la mort à chaque tour. Tout soin > 0 te réveille.' },
        { name: 'Demi-créatures / couvert', text: 'Tirer à travers un allié n\'impose rien, mais un mur/obstacle accorde un couvert (½, ¾, total) à la cible.' },
        { name: 'Lancer deux sorts par tour', text: 'Interdit d\'utiliser deux emplacements le même tour. Exception : tour de magie (action) + sort en action bonus.' },
        { name: 'Aire d\'effet & créatures', text: 'Sauf indication, on cible les créatures (pas le MJ/joueur seul) ; un allié dans la zone subit aussi l\'effet.' },
        { name: 'Objets & solidité', text: 'CA d\'objet selon matériau (tissu 11 → adamantine 23). PV selon taille/fragilité. Immunité poison/psychique.' },
        { name: 'Montures & vitesse', text: 'Une monture contrôlée n\'agit qu\'avec Foncer/Se désengager/Esquiver. Indépendante : agit librement à son initiative.' },
        { name: 'Potion de soin', text: 'Légère 2d4+2 · Supérieure 4d4+4 · Suprême 8d4+8 · Souveraine 10d4+20. Boire = action ; administrer à autrui = action.' },
        { name: 'Maladies & poisons', text: 'Souvent un jet de sauvegarde de CON. Effets typiques : dégâts récurrents, désavantage, réduction de PV max.' },
        { name: 'Folie (optionnel)', text: 'Courte (1d10 min), longue (1d10×10 min) ou indéfinie. Provoquée par effets surnaturels ; soignée par repos/sorts.' },
        { name: 'Récompenses & trésor', text: 'Trésor individuel (pièces) + objets (table par CR). Pense à varier : or, gemmes, objets d\'art, consommables, objets magiques.' },
        { name: 'Lumière des sources', text: 'Torche : 6 m vive + 6 m pénombre, 1 h. Lanterne sourde : cône 18 m. Lumière (sort) : 6+6 m. Bougie : 1,5 m, 1 h.' },
        { name: 'Surprise & embuscade', text: 'Compare Discrétion du groupe embusqué vs Perception passive des cibles. Les surpris ne font rien au 1er tour.' }
    ];

    // Règles RÉVISÉES 2024 (« 5.5 » / D&D 2024) — les principaux CHANGEMENTS par rapport à 2014.
    const RULES_2024 = [
        { name: 'Test de d20 (terme unifié)', text: '« Test de d20 » regroupe désormais jets de caractéristique, attaques et sauvegardes. Tout effet qui modifie un « test de d20 » s\'applique aux trois.' },
        { name: 'Inspiration héroïque', text: 'Remplace l\'Inspiration : permet de RELANCER n\'importe quel d20 (on garde le nouveau résultat). Les Humains la regagnent à chaque repos long. Non cumulable.' },
        { name: 'Maîtrise d\'armes (Weapon Mastery)', text: 'Grande nouveauté : chaque arme a une propriété de maîtrise utilisable par certaines classes (Guerrier, Barbare…) : Culbute (topple, sauvegarde CON ou à terre), Entaille (sap, désavantage à sa prochaine attaque), Ralentissement (slow, -3 m), Poussée (push, 3 m), Drainage (vex, avantage à ta prochaine attaque contre elle), Écorchure (graze, dégâts = mod. même si raté), Double entaille (nick, attaque supplémentaire de l\'autre main SANS action bonus), Perforation (cleave, touche une 2e créature adjacente).' },
        { name: 'Surprise (révisée)', text: 'Plus de « tour de surpris » : être surpris donne simplement DÉSAVANTAGE au jet d\'initiative. Fini le tour entier perdu.' },
        { name: 'Épuisement (révisé)', text: 'Chaque niveau d\'épuisement : -2 CUMULATIF à tous les tests de d20 et -1,5 m de vitesse (niv. 3 = -6 aux d20, -4,5 m). Mort au niveau 6. Un repos long retire 1 niveau.' },
        { name: 'Agrippé (révisé)', text: 'Agripper = jet d\'ATTAQUE À MAINS NUES (plus de concours) ; s\'échapper = sauvegarde FOR ou DEX contre DD 8 + mod. FOR + maîtrise de l\'agresseur. L\'agrippé a le désavantage contre les autres cibles.' },
        { name: 'Invisible (révisé)', text: 'La créature invisible a l\'AVANTAGE à l\'initiative. Ses attaques ont l\'avantage, celles contre elle le désavantage — SAUF si l\'attaquant la voit (magie, sens spéciaux).' },
        { name: 'Action Influence', text: 'Nouvelle action sociale codifiée : Persuasion/Intimidation/Tromperie/Représentation contre DD = 15 ou Intelligence passive de la cible (selon attitude Amicale/Indifférente/Hostile).' },
        { name: 'Action Étude / Utiliser / Magie', text: 'Actions renommées et codifiées : Étude (Study) = examiner/rappeler des connaissances ; Utiliser (Utilize) = objet ; Magie (Magic) = lancer un sort ou utiliser un pouvoir magique.' },
        { name: 'Se cacher (révisé)', text: 'Action Se cacher : jet de Discrétion DD 15 (minimum) hors de vue ; on note le résultat, il sert de DD pour te repérer. Attaquer ou faire du bruit révèle.' },
        { name: 'Saut (révisé)', text: 'Sauter utilise désormais ta VITESSE (déplacement normal), pas une action. Longueur = score de FOR en pieds avec élan (÷ 2 sans élan) ; hauteur = 3 + mod. FOR.' },
        { name: 'Potions en action bonus', text: 'Boire une potion (dont soin) = ACTION BONUS désormais. L\'administrer à quelqu\'un d\'autre reste une action.' },
        { name: 'Repos long (révisé)', text: 'Interruption d\'1 h de combat/marche/magie = repos raté MAIS on peut reprendre. Après un repos long réussi : PV max, moitié des dés de vie, 1 niveau d\'épuisement retiré.' },
        { name: 'Incantation & composantes', text: 'Un sort par tour en action + 1 sort d\'action bonus SEULEMENT si c\'est un tour de magie mineure (cantrip) pour l\'autre. (Clarification de la règle 2014 des sorts d\'action bonus.)' },
        { name: 'Créatures & CR (2024)', text: 'Les blocs de stats 2024 intègrent les attaques multiples plus lisibles, initiative propre (bonus affiché) et sauvegardes simplifiées.' },
        { name: 'Origines (historique 2024)', text: 'L\'historique donne désormais : +2/+1 (ou +1/+1/+1) aux caractéristiques, un DON d\'origine (ex : Soldat → Savage Attacker, Sage → Magic Initiate) et 2 compétences. L\'espèce ne donne plus les bonus de caracs.' },
        { name: 'Dons par paliers', text: 'Dons de niveau 4+ = « dons généraux » (souvent +1 carac inclus). Dons d\'origine au niveau 1. Dons épiques au niveau 19 (ex : Boon of Combat Prowess).' },
        { name: 'Armes improvisées & à deux mains', text: 'Précisions 2024 : l\'arme de l\'autre main sans la propriété Légère nécessite le don approprié ; « Double entaille » (nick) permet l\'attaque secondaire sans action bonus.' }
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
            env: { time: '', weather: '☀️ Dégagé' }, diceLog: [], offlineSheets: [], combatLog: []
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
    function save() { if (!activeCampaignId) return; syncActivePage(); try { localStorage.setItem(stateKey(), JSON.stringify(state)); } catch (e) {} GmCloud.queueState(activeCampaignId); if (typeof histPush === 'function') histPush(); }

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

    // Parser de chat de dés : « /r 1d20+5 » (public, diffusé aux joueurs) ; « /w gm 1d20 » (secret, MJ seul).
    function handleDiceCommand(raw) {
        raw = String(raw || '').trim(); if (!raw) return;
        let secret = false, formula = raw;
        const mw = raw.match(/^\/w\s+gm\s+(.+)$/i), mr = raw.match(/^\/r\s+(.+)$/i);
        if (mw) { secret = true; formula = mw[1].trim(); }
        else if (mr) { formula = mr[1].trim(); }
        const res = rollFormula(formula);
        logDice((secret ? '🤫 (secret) ' : '🎲 ') + formula, res);
        if (!secret) gmBroadcast('dice', { user: 'MJ', formula: formula, total: res.total, detail: res.detail });
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
            <button id="gm-shortcuts-btn" class="gm-btn gm-icon-btn" title="Raccourcis clavier (?)">⌨️</button>
            <button id="gm-hints-toggle" class="gm-btn gm-icon-btn" title="Masquer les aides ⓘ">💡</button>
            <button id="gm-sidebar-toggle" class="gm-btn gm-icon-btn" title="Afficher / masquer le panneau latéral">📜</button>
            <button id="gm-close" class="gm-btn gm-close" title="Fermer">✕</button>
        </div>

        <div class="gm-workspace">
            <!-- ===== BARRE D'OUTILS VERTICALE (groupes + sous-menus, type Roll20) ===== -->
            <div class="gm-leftbar">
                <!-- Interaction -->
                <button class="gm-tool is-active" data-tgroup="select" title="Sélection : déplacer les jetons et la carte">🖱️</button>
                <button class="gm-tool gm-tool-flyable" data-tgroup="ping" title="Signal : clique la carte → repère lumineux chez les joueurs (couleur réglable)">📍</button>
                <div class="gm-tool-sep" data-sep="Vision &amp; lumière"></div>
                <!-- Vision & lumière : ce que voient les joueurs -->
                <button class="gm-tool gm-tool-flyable" data-tgroup="fog" title="Brouillard de guerre">🌫️</button>
                <button class="gm-tool gm-tool-flyable" data-tgroup="walls" title="Murs, portes &amp; obscurité (vision des joueurs)">🧱</button>
                <button class="gm-tool gm-tool-flyable" data-tgroup="light" title="Points de lumière (torches, lanternes…)">💡</button>
                <div class="gm-tool-sep" data-sep="Contenu"></div>
                <!-- Contenu de la carte -->
                <button class="gm-tool gm-tool-flyable" data-tgroup="tokens" title="Jetons">🧝</button>
                <button class="gm-tool gm-tool-flyable" data-tgroup="draw" title="Dessin &amp; notes MJ">✏️</button>
                <button class="gm-tool gm-tool-flyable" data-tgroup="aoe" title="Gabarits de sorts (sphère, cône, ligne, cube)">🎯</button>
                <div class="gm-tool-sep" data-sep="Ambiance"></div>
                <!-- Ambiance & effets visuels -->
                <button class="gm-tool gm-tool-flyable" data-tgroup="fx" title="Ambiance &amp; effets : météo, cycle jour/nuit, teintes">🎬</button>
                <div class="gm-tool-sep" data-sep="Vue"></div>
                <!-- Navigation -->
                <button class="gm-tool gm-tool-flyable" data-tgroup="view" title="Vue : déplacer, zoom, mesurer, échelle">🗺️</button>
                <button class="gm-tool" data-tgroup="layers" title="Calques (visibilité &amp; opacité)">🗂️</button>
                <div class="gm-tool-sep"></div>
                <button class="gm-tool gm-tool-hist" id="gm-undo" title="Annuler (Ctrl+Z)" disabled>↶</button>
                <button class="gm-tool gm-tool-hist" id="gm-redo" title="Rétablir (Ctrl+Y)" disabled>↷</button>
            </div>
            <!-- ===== ZONE CENTRALE : grande carte (stage) ===== -->
            <div class="gm-main">

                <div id="gm-card-live" class="gm-card gm-card-live gm-span-2">
                    <div class="gm-card-head"><span class="gm-card-icon">📡</span> Joueurs connectés
                        <span class="gm-spacer"></span>
                        <span id="gm-live-status" class="gm-readonly-note">Hors ligne</span>
                    </div>
                    <div class="gm-card-body"><div id="gm-live-list" class="gm-live-list"></div></div>
                </div>

                <div id="gm-card-offline" class="gm-card gm-span-2 gm-card-offline">
                    <div class="gm-card-head"><span class="gm-card-icon">💤</span> Fiches hors-ligne
                        <span class="gm-spacer"></span>
                        <span class="gm-readonly-note gm-hint">Dernière version vue — conservée même après déconnexion</span>
                    </div>
                    <div class="gm-card-body"><div id="gm-offline-list" class="gm-live-list"></div></div>
                </div>

                <div id="gm-card-party" class="gm-card">
                    <div class="gm-card-head"><span class="gm-card-icon">👥</span> Groupe (manuel)</div>
                    <div class="gm-card-body">
                        <div class="gm-row">
                            <input id="gm-party-name" class="gm-input" placeholder="Nom du personnage">
                            <input id="gm-party-cls" class="gm-input" placeholder="Classe" style="flex:0 1 110px;">
                            <button id="gm-party-add" class="gm-add" title="Ajouter">＋</button>
                        </div>
                        <div id="gm-party-list"></div>
                        <div class="gm-readonly-note gm-hint">ⓘ Suivi manuel (PNJ alliés, joueurs hors-ligne…). Les joueurs reliés par le code apparaissent en haut, en direct.</div>
                    </div>
                </div>

                <div id="gm-card-combat" class="gm-card">
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
                        <div class="gm-readonly-note gm-hint">ⓘ Lance le combat : les joueurs connectés voient un bouton flottant pour lancer leur initiative, qui peuple et trie cet ordre automatiquement.</div>
                    </div>
                </div>

                <div id="gm-card-monsters" class="gm-card gm-span-2">
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

                <div class="gm-card gm-span-2">
                    <div class="gm-card-head"><span class="gm-card-icon">📜</span> Journal de combat
                        <span class="gm-spacer"></span>
                        <button id="gm-combatlog-clear" class="gm-btn" title="Vider le journal">🧹</button>
                    </div>
                    <div class="gm-card-body"><div id="gm-combatlog" class="gm-dice-log"></div></div>
                </div>

                <div id="gm-card-env" class="gm-card">
                    <div class="gm-card-head"><span class="gm-card-icon">🌤️</span> Environnement</div>
                    <div class="gm-card-body">
                        <div class="gm-env-row"><label>⏳ Minuteur</label><input id="gm-timer-min" class="gm-input gm-num" type="number" min="1" value="5" style="width:64px;" title="Minutes"><button id="gm-timer-start" class="gm-btn" title="Lancer le compte à rebours (visible par tous)">▶</button><button id="gm-timer-stop" class="gm-btn" title="Arrêter">⏹</button></div>
                        <div class="gm-env-row"><label>🕑 Heure</label><input id="gm-env-time" class="gm-input" placeholder="ex : Crépuscule, 18h…"></div>
                        <div class="gm-env-row"><label>🌦️ Météo</label>
                            <select id="gm-env-weather" class="gm-select">
                                <option>☀️ Dégagé</option><option>⛅ Nuageux</option><option>🌧️ Pluie</option>
                                <option>⛈️ Orage</option><option>🌫️ Brouillard</option><option>❄️ Neige</option><option>🌙 Nuit</option>
                            </select>
                        </div>
                        <div class="gm-set-h" style="margin-top:8px;">🎬 Ambiances (1 clic)</div>
                        <div id="gm-ambiance-btns" class="gm-ambiance-btns"></div>
                        <div class="gm-readonly-note gm-hint">ⓘ Applique météo + teinte de la carte + effet sonore à toute la table.</div>
                        <div class="gm-music-mini">
                            <button class="gm-btn" data-act="music-toggle">🎵 Lecteur</button>
                            <button class="gm-btn" data-act="music-show">▶ Afficher</button>
                        </div>
                    </div>
                </div>

                <div id="gm-card-soundboard" class="gm-card">
                    <div class="gm-card-head"><span class="gm-card-icon">🔊</span> Soundboard</div>
                    <div class="gm-card-body">
                        <label class="gm-btn gm-soundboard-import" title="Importer des effets sonores">➕ Importer mes sons<input type="file" id="gm-sfx-file" accept="audio/*" multiple style="display:none;"></label>
                        <div id="gm-soundboard-pads" class="gm-soundboard-pads"></div>
                        <div class="gm-readonly-note gm-hint">ⓘ Importe tes propres effets. Clique un pad : le son joue chez toi ET chez les joueurs connectés.</div>
                    </div>
                </div>

                <div id="gm-card-image" class="gm-card">
                    <div class="gm-card-head"><span class="gm-card-icon">🖼️</span> Montrer une image aux joueurs</div>
                    <div class="gm-card-body">
                        <div class="gm-row" style="align-items:center;">
                            <label class="gm-map-ctl">👤 Pour</label>
                            <select id="gm-showimg-target" class="gm-select" style="flex:1;"><option value="all">📢 Tous les joueurs</option></select>
                        </div>
                        <div class="gm-row">
                            <input id="gm-showimg-url" class="gm-input" placeholder="URL d'une image…">
                            <label class="gm-btn" title="Importer une image">📁<input type="file" id="gm-showimg-file" accept="image/*" style="display:none;"></label>
                            <button id="gm-showimg-send" class="gm-add" title="Envoyer">📤</button>
                        </div>
                        <div class="gm-row" style="align-items:center;">
                            <label class="gm-map-ctl">📁 Préparée</label>
                            <select id="gm-showimg-prepared" class="gm-select" style="flex:1;"><option value="">— Image préparée —</option></select>
                            <button id="gm-showimg-send-prep" class="gm-btn" title="Envoyer l'image préparée">📤</button>
                        </div>
                        <div class="gm-readonly-note gm-hint">ⓘ Les joueurs reçoivent une notification « Ouvrir » pour voir l'image en grand.</div>
                    </div>
                </div>

                <div id="gm-card-scenes" class="gm-card">
                    <div class="gm-card-head"><span class="gm-card-icon">🎬</span> Scènes (ambiance)</div>
                    <div class="gm-card-body">
                        <div class="gm-row">
                            <input id="gm-scene-name" class="gm-input" placeholder="Nom (Taverne, Forêt…)">
                            <label class="gm-btn" id="gm-scene-img-label" style="flex:0 0 auto;" title="Image de fond (optionnel)">🖼️<input type="file" id="gm-scene-img" accept="image/*" style="display:none;"></label>
                            <button id="gm-scene-add" class="gm-add" title="Créer la scène">＋</button>
                        </div>
                        <input id="gm-scene-music" class="gm-input" placeholder="🎵 Lien musique/ambiance (YouTube ou .mp3, optionnel)">
                        <div id="gm-scene-list" class="gm-scene-list"></div>
                        <div class="gm-readonly-note gm-hint">ⓘ « Appliquer » change le fond ET la musique de tous les joueurs connectés, en direct.</div>
                    </div>
                </div>

                <div id="gm-map-card" class="gm-card gm-map-collapsed">
                    <div class="gm-card-head"><span class="gm-card-icon">🗺️</span> Carte tactique
                        <span id="gm-map-title" class="gm-map-title"></span>
                        <span class="gm-spacer"></span>
                        <button id="gm-map-pages-toggle" class="gm-btn" title="Afficher / masquer la barre des cartes (pages type Roll20)">📑 Cartes</button>
                        <button id="gm-map-collapse" class="gm-btn" title="Afficher / masquer les réglages du fond et de la grille">⚙️ Réglages</button>
                    </div>
                    <div class="gm-card-body">
                        <div id="gm-map-pages-bar" class="gm-map-pages-bar"></div>
                        <div class="gm-map-controls">
                            <div class="gm-set-h">🖼️ Fond de la carte</div>
                            <div class="gm-row">
                                <input id="gm-map-url" class="gm-input" placeholder="URL d'une image de fond / map…">
                                <label class="gm-btn" title="Importer une image de carte">🖼️<input type="file" id="gm-map-file" accept="image/*" style="display:none;"></label>
                                <button id="gm-map-seturl" class="gm-add" title="Appliquer le fond">＋</button>
                            </div>
                            <div class="gm-row" style="align-items:center;">
                                <label class="gm-map-ctl">📚 Banque</label>
                                <select id="gm-map-bank" class="gm-select" style="flex:1;"><option value="">— Choisir une carte préparée —</option></select>
                                <button id="gm-map-bank-load" class="gm-btn" title="Charger la carte prévisualisée">Charger</button>
                            </div>
                            <img id="gm-map-bank-preview" class="gm-map-preview" alt="Aperçu" style="display:none;">
                            <div class="gm-set-h">▦ Grille</div>
                            <div class="gm-row" style="gap:14px; align-items:center;">
                                <label class="gm-map-ctl">Taille <input type="number" id="gm-map-grid" class="gm-input gm-num" value="48" min="10" style="width:64px;"></label>
                                <label class="gm-map-ctl"><input type="checkbox" id="gm-map-showgrid" checked> Afficher</label>
                                <span class="gm-readonly-note" style="flex:1; text-align:right;">Jetons, dessin, brouillard, zoom : barre d'outils à gauche.</span>
                            </div>
                            <div class="gm-set-h">⌨️ Raccourcis clavier</div>
                            <div id="gm-set-shortcuts" class="gm-set-shortcuts"></div>
                            <div class="gm-row" style="margin-top:6px;">
                                <button id="gm-tuto-replay" class="gm-btn" title="Relancer la visite guidée de l'écran MJ">🎓 Revoir le tutoriel</button>
                                <span class="gm-readonly-note" style="flex:1; text-align:right;">Touche <kbd>?</kbd> : aide raccourcis en grand.</span>
                            </div>
                        </div>
                        <div id="gm-map-view" class="gm-map-view show-grid"></div>
                    </div>
                </div>

                <div id="gm-card-trade" class="gm-card gm-span-2">
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
                    <button class="gm-side-tab active" data-side="table"><span class="tb-ic">📋</span><span class="tb-lbl">Table</span></button>
                    <button class="gm-side-tab" data-side="chat"><span class="tb-ic">🎲</span><span class="tb-lbl">Dés</span></button>
                    <button class="gm-side-tab" data-side="audio"><span class="tb-ic">🎵</span><span class="tb-lbl">Audio</span></button>
                    <button class="gm-side-tab" data-side="prep"><span class="tb-ic">📁</span><span class="tb-lbl">Prépa</span></button>
                    <button class="gm-side-tab" data-side="journal"><span class="tb-ic">📖</span><span class="tb-lbl">Journal</span></button>
                    <button class="gm-side-tab" data-side="compendium"><span class="tb-ic">🔎</span><span class="tb-lbl">Règles</span></button>
                </div>

                <!-- Panneau Table : tableau de bord MJ (joueurs, combat, monstres…) -->
                <div class="gm-side-panel gm-side-table gm-side-show"></div>

                <!-- Panneau Audio : lecteur de musique (ancré ici sur l'écran MJ) + soundboard + scènes -->
                <div class="gm-side-panel gm-side-audio"></div>

                <!-- Panneau Chat / Dés -->
                <div class="gm-side-panel gm-side-chat">
                    <div class="gm-side-card">
                        <div class="gm-side-card-head">🎲 Lanceur de dés</div>
                        <div class="gm-dice-quick">${DICE.map(d => `<button class="gm-die" data-die="${d}">d${d}</button>`).join('')}</div>
                        <div class="gm-row">
                            <input id="gm-dice-formula" class="gm-input" placeholder="2d6+3 · /r 1d20+5 · /w gm 1d20 (secret)">
                            <button id="gm-dice-roll" class="gm-add" title="Lancer">🎲</button>
                        </div>
                        <div id="gm-dice-result" class="gm-dice-result"></div>
                    </div>
                    <div class="gm-side-card">
                        <div class="gm-side-card-head">🎯 Demander un jet</div>
                        <div class="gm-row">
                            <select id="gm-rollreq-skill" class="gm-select" style="flex:1;"></select>
                        </div>
                        <div class="gm-row">
                            <select id="gm-rollreq-target" class="gm-select" style="flex:1;"><option value="all">📢 Tous les joueurs</option></select>
                            <button id="gm-rollreq-send" class="gm-add" title="Envoyer la demande">🎯</button>
                        </div>
                        <div class="gm-readonly-note gm-hint">ⓘ Le joueur reçoit un bouton qui lance d20 + le modificateur de SA fiche, et le résultat s'affiche pour toute la table.</div>
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
                    <div class="gm-side-card">
                        <div class="gm-side-card-head">💾 Points de sauvegarde</div>
                        <button id="gm-snap-create" class="gm-btn" style="width:100%;">➕ Sauvegarder l'état de la campagne</button>
                        <div id="gm-snap-list" class="gm-snap-list"></div>
                        <div class="gm-readonly-note">ⓘ Reviens à un état précédent (cartes, jetons, combat, notes…) en un clic.</div>
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
                            <button class="gm-btn" data-gen="encounter">Rencontre</button>
                        </div>
                        <div class="gm-row" id="gm-gen-enc-opts" style="display:none; gap:6px; margin-top:6px;">
                            <select id="gm-gen-env" class="gm-select" style="flex:1;"><option value="forest">🌲 Forêt</option><option value="dungeon">🏚️ Donjon</option><option value="city">🏙️ Ville</option><option value="road">🛣️ Route</option><option value="mountain">⛰️ Montagne</option><option value="swamp">🐸 Marais</option><option value="coast">🌊 Côte</option></select>
                            <select id="gm-gen-tier" class="gm-select" style="flex:1;"><option value="1">Niv. 1-4</option><option value="2">Niv. 5-10</option><option value="3">Niv. 11-16</option><option value="4">Niv. 17-20</option></select>
                        </div>
                        <div id="gm-gen-out" class="gm-gen-out">Clique pour générer…</div>
                        <div id="gm-gen-actions" class="gm-row" style="display:none; margin-top:6px;"></div>
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

        // ----- Disposition Roll20 : carte au centre, gestion dans « Table », audio dans « Audio » -----
        try {
            const main = ov.querySelector('.gm-main');
            const tablePanel = ov.querySelector('.gm-side-table');
            const audioPanel = ov.querySelector('.gm-side-audio');
            if (main && tablePanel) {
                Array.from(main.children).forEach(card => {
                    if (card.id === 'gm-map-card') return;
                    if (audioPanel && (card.id === 'gm-card-soundboard' || card.id === 'gm-card-scenes')) audioPanel.appendChild(card);
                    else tablePanel.appendChild(card);
                });
            }
            // Barre d'outils gauche : outils directs ou sous-menu (flyout) du groupe.
            ov.querySelectorAll('.gm-leftbar .gm-tool').forEach(btn => btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const key = btn.dataset.tgroup;
                if (!key) return;                                    // boutons historique (undo/redo) : gérés à part
                if (key === 'select') { closeToolFlyout(); setMapTool(key); return; }
                if (key === 'ping' && mapTool !== 'ping') setMapTool('ping');   // 1er clic : active l'outil ET montre le sous-menu (couleur)
                if (key === 'layers') { closeToolFlyout(); toggleLayersPanel(); return; }
                openToolFlyout(key, btn);
            }));
            const undoBtn = ov.querySelector('#gm-undo'); if (undoBtn) undoBtn.addEventListener('click', (e) => { e.stopPropagation(); undoMap(); });
            const redoBtn = ov.querySelector('#gm-redo'); if (redoBtn) redoBtn.addEventListener('click', (e) => { e.stopPropagation(); redoMap(); });
            const scBtn = ov.querySelector('#gm-shortcuts-btn'); if (scBtn) scBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleShortcutsHelp(); });
        } catch (e) { console.warn('gm layout Roll20:', e); }
    }

    // ---------- Barre d'outils : groupes & sous-menus (flyouts) ----------
    // Chaque groupe liste ses éléments à l'OUVERTURE (état à jour : verrous, brouillard…).
    function toolGroupItems(key) {
        const m = state.map || {};
        const fogOn = !!(m.fog && m.fog.on);
        if (key === 'ping') return {
            title: '📍 Signal aux joueurs',
            hint: 'Clique la carte : un repère lumineux apparaît chez tous les joueurs. Astuce : double-clic avec la souris 🖱️ = signal aussi.',
            items: [
                { icon: '📍', label: 'Envoyer un signal (clic sur la carte)', type: 'tool', tool: 'ping' },
                { type: 'pingcolor' }
            ]
        };
        if (key === 'draw') return {
            title: '✏️ Dessin & notes',
            hint: 'Astuce : molette sur la carte = épaisseur du trait',
            items: [
                { icon: '✏️', label: 'Dessiner (visible des joueurs)', type: 'tool', tool: 'draw' },
                { icon: '📝', label: 'Notes MJ (privé, jamais diffusé)', type: 'tool', tool: 'gmnote' },
                { type: 'color' },
                { type: 'width' },
                { icon: '↩️', label: 'Annuler le dernier trait', type: 'action', run: undoLastDrawing, keep: true },
                { icon: '🧽', label: 'Effacer tous les dessins', type: 'action', danger: true, run: () => { if (confirm('Effacer tous les dessins de cette carte ?')) clearDrawings(); } }
            ]
        };
        if (key === 'fog') {
            const autoRev = !!(m.fog && m.fog.autoReveal);
            return {
            title: '🌫️ Brouillard de guerre',
            hint: 'Molette sur la carte = taille du pinceau',
            items: [
                { icon: '🌫️', label: fogOn ? 'Brouillard actif — cliquer pour retirer' : 'Activer le brouillard', type: 'toggle', on: fogOn, run: toggleFog },
                { icon: '🔦', label: 'Révéler une zone (pinceau)', type: 'tool', tool: 'reveal' },
                { icon: '⬛', label: 'Recacher une zone (pinceau)', type: 'tool', tool: 'cover' },
                { icon: '🧭', label: autoRev ? 'Exploration révélée : ON — les PJ dévoilent en avançant' : 'Exploration révélée : OFF', type: 'toggle', on: autoRev, run: toggleFogAutoReveal },
                { icon: '👁️', label: 'Tout révéler', type: 'action', run: fogRevealAll, keep: true },
                { icon: '🌑', label: 'Tout recouvrir', type: 'action', run: fogCoverAll, keep: true }
            ]
            };
        }
        if (key === 'walls') {
            const dark = m.dark || { on: false, range: 9 };
            return {
                title: '🧱 Murs, portes & obscurité',
                hint: 'Les murs sont invisibles pour les joueurs : ils bloquent leurs jetons et leur vision dans le noir. Clic sur une pastille 🚪 = ouvrir / fermer la porte.',
                items: [
                    { icon: '🧱', label: 'Tracer un mur (glisser)', type: 'tool', tool: 'wall' },
                    { icon: '🚪', label: 'Tracer une porte (glisser)', type: 'tool', tool: 'door' },
                    { icon: '⚙️', label: 'Régler une porte (verrou / secrète)', type: 'tool', tool: 'dooredit' },
                    { icon: '🧹', label: 'Effacer un mur (cliquer dessus)', type: 'tool', tool: 'wallerase' },
                    { icon: '🌑', label: dark.on ? 'Obscurité active — cliquer pour rallumer' : 'Plonger la pièce dans le noir', type: 'toggle', on: !!dark.on, run: toggleDark },
                    { type: 'vision' },
                    { icon: '👀', label: 'Aperçu : voir comme les joueurs', type: 'toggle', on: !!mapView.visionPreview, run: toggleVisionPreview },
                    { icon: '📐', label: 'Ligne de vue / couverture (2 clics : tireur → cible)', type: 'tool', tool: 'los' },
                    { icon: '🗑️', label: 'Supprimer tous les murs', type: 'action', danger: true, run: clearWallsConfirm }
                ]
            };
        }
        if (key === 'light') return {
            title: '💡 Points de lumière',
            hint: 'Clic sur la carte = poser une lumière · clic sur une lumière = la régler · molette = rayon. Les lumières percent l\'obscurité pour les joueurs (arrêtées par les murs).',
            items: [
                { icon: '💡', label: 'Poser / régler une lumière', type: 'tool', tool: 'light' },
                { type: 'lightcolor' },
                { icon: '🗑️', label: 'Retirer toutes les lumières', type: 'action', danger: true, run: clearLightsConfirm }
            ]
        };
        if (key === 'aoe') return {
            title: '🎯 Gabarits de sorts',
            hint: 'Glisse sur la carte : l\'origine est le point de départ, la taille suit ta souris (étiquette en mètres). Visible par les joueurs.',
            items: [
                { icon: '🎯', label: 'Placer un gabarit (glisser)', type: 'tool', tool: 'aoe' },
                { type: 'aoekind' },
                { type: 'aoecolor' },
                { icon: '🧹', label: 'Effacer un gabarit (cliquer l\'origine)', type: 'tool', tool: 'aoeerase' },
                { icon: (m.playerAoeOff ? '🚫' : '👥'), label: m.playerAoeOff ? 'Joueurs : gabarits interdits — autoriser' : 'Joueurs : gabarits autorisés — interdire', type: 'toggle', on: !m.playerAoeOff, run: togglePlayerAoe },
                { icon: '🗑️', label: 'Retirer tous les gabarits', type: 'action', danger: true, run: clearTemplatesConfirm }
            ]
        };
        if (key === 'tokens') return {
            title: '🧝 Jetons',
            hint: 'Outil « poser » : clique la carte pour déposer des jetons à l\'avance. Clic sur un jeton = fiche (PV, CA, image, taille…).',
            items: [
                { icon: '📍', label: 'Poser des jetons (clic sur la carte)', type: 'tool', tool: 'placetoken' },
                { type: 'placetype' },
                { type: 'placeowner' },
                { icon: '✥', label: 'Déplacer un élément posé (mur, lumière, gabarit)', type: 'tool', tool: 'objmove' },
                { icon: '⟳', label: 'Placer les combattants (choisir qui & où)', type: 'action', run: startPlaceCombatants },
                { icon: m.tokensLocked ? '🔒' : '🔓', label: m.tokensLocked ? 'Verrouillés (MJ seul) — libérer' : 'Libres (joueurs) — verrouiller', type: 'toggle', on: !!m.tokensLocked, run: toggleTokensLock },
                { icon: '🧲', label: 'Aimanter à la grille', type: 'toggle', on: !!m.snap, run: toggleSnap },
                { icon: '❤️', label: 'Barres de PV visibles des joueurs', type: 'toggle', on: !!m.hpBars, run: toggleHpBars },
                { icon: '🗑️', label: 'Vider tous les jetons', type: 'action', danger: true, run: clearTokensConfirm }
            ]
        };
        if (key === 'fx') {
            const dnOn = !!(m.dayNight && m.dayNight.on);
            return {
                title: '🎬 Ambiance & Effets',
                hint: 'Effets visuels diffusés à toute la table. Les « Ambiances » (taverne, donjon…) sont dans l\'onglet Table → Environnement.',
                items: [
                    { type: 'weather' },
                    { icon: dnOn ? '🌗' : '🌗', label: dnOn ? 'Cycle jour/nuit : AFFICHÉ' : 'Cycle jour/nuit : masqué', type: 'toggle', on: dnOn, run: toggleDayNight },
                    { type: 'daynight' },
                    { type: 'daynightpresets' },
                    { icon: '🎨', label: (m.tint ? 'Retirer la teinte d\'ambiance' : 'Aucune teinte d\'ambiance'), type: 'action', run: clearMapTint, keep: true },
                    { icon: '🌋', label: 'Poser un danger (glisser = taille)', type: 'tool', tool: 'hazard' },
                    { type: 'hazardkind' },
                    { icon: '🧹', label: 'Effacer un danger (cliquer dessus)', type: 'tool', tool: 'hazarderase' },
                    { icon: '🗑️', label: 'Retirer tous les dangers', type: 'action', danger: true, run: clearHazardsConfirm },
                    { icon: '🔊', label: 'Zone sonore (glisser = portée)', type: 'tool', tool: 'sound' },
                    { icon: '🗑️', label: 'Retirer toutes les zones sonores', type: 'action', danger: true, run: clearSoundZonesConfirm }
                ]
            };
        }
        if (key === 'view') return {
            title: '🗺️ Vue & navigation',
            hint: 'Molette = zoom sous le curseur · ✋ ou clic-molette = déplacer la vue',
            items: [
                { icon: '✋', label: 'Déplacer la vue (glisser)', type: 'tool', tool: 'pan' },
                { icon: '🖼️', label: 'Caler l\'image de fond sous la grille', type: 'tool', tool: 'bg' },
                { icon: '📏', label: 'Mesurer une distance (glisser)', type: 'tool', tool: 'ruler' },
                { icon: '📐', label: 'Échelle : 1 case = ' + cellMeters() + ' m', type: 'action', run: promptCellM, keep: true },
                { icon: '▦', label: 'Afficher la grille', type: 'toggle', on: m.showGrid !== false, run: toggleGrid },
                { icon: '🔍➕', label: 'Zoomer', type: 'action', run: () => zoomAtCenter(1.2), keep: true },
                { icon: '🔍➖', label: 'Dézoomer', type: 'action', run: () => zoomAtCenter(1 / 1.2), keep: true },
                { icon: '🎯', label: 'Recentrer la vue', type: 'action', run: resetMapView, keep: true }
            ]
        };
        return null;
    }
    // Outils appartenant à chaque groupe (pour surligner le bouton du groupe quand un de ses outils est actif)
    const GROUP_TOOLS = { select: ['select'], ping: ['ping'], draw: ['draw', 'gmnote'], fog: ['reveal', 'cover'], walls: ['wall', 'door', 'dooredit', 'wallerase', 'los'], light: ['light'], aoe: ['aoe', 'aoeerase'], fx: ['hazard', 'hazarderase', 'sound'], view: ['bg', 'ruler', 'pan'], tokens: ['placetoken', 'objmove', 'placecombatant'], layers: [] };
    let flyoutKey = null;
    function ensureToolFlyout() {
        let p = byId('gm-tool-flyout'); if (p) return p;
        p = document.createElement('div'); p.id = 'gm-tool-flyout'; p.className = 'gm-tool-flyout hidden no-print';
        document.body.appendChild(p);
        document.addEventListener('pointerdown', (e) => {
            if (!p.classList.contains('hidden') && !e.target.closest('#gm-tool-flyout') && !e.target.closest('.gm-leftbar')) closeToolFlyout();
        });
        return p;
    }
    function closeToolFlyout() {
        const p = byId('gm-tool-flyout'); if (p) p.classList.add('hidden');
        flyoutKey = null;
    }
    function openToolFlyout(key, btn) {
        if (flyoutKey === key) { closeToolFlyout(); return; }   // re-clic = fermer
        const grp = toolGroupItems(key); if (!grp) return;
        const p = ensureToolFlyout();
        flyoutKey = key;
        p.innerHTML = `<div class="gm-fly-title">${grp.title}</div>` + grp.items.map((it, i) => {
            if (it.type === 'color') return `<div class="gm-fly-row"><span class="gm-fly-ic">🎨</span><span class="gm-fly-lbl">Couleur du trait</span><input type="color" id="gm-draw-color" value="${drawColor}" title="Couleur du dessin / des notes MJ"></div>`;
            if (it.type === 'width') return `<div class="gm-fly-row"><span class="gm-fly-ic">━</span><span class="gm-fly-lbl">Épaisseur</span><input type="range" id="gm-draw-width" min="1" max="24" step="1" value="${drawWidth}"><b class="gm-fly-wval">${drawWidth}</b></div>`;
            if (it.type === 'vision') { const dr = (state.map && state.map.dark && Number(state.map.dark.range)) || 9; return `<div class="gm-fly-row" title="Distance de vision des joueurs dans le noir (1 case = 1,5 m)"><span class="gm-fly-ic">👁️</span><span class="gm-fly-lbl">Vision</span><input type="range" id="gm-dark-range" min="1.5" max="30" step="1.5" value="${dr}"><b class="gm-fly-wval gm-fly-wval-wide" id="gm-dark-range-val">${dr} m</b></div>`; }
            if (it.type === 'lightcolor') return `<div class="gm-fly-row"><span class="gm-fly-ic">🎨</span><span class="gm-fly-lbl">Couleur de lumière</span><input type="color" id="gm-light-color" value="${lightColor}" title="Couleur de la prochaine lumière"></div>`;
            if (it.type === 'placetype') return `<div class="gm-fly-row"><span class="gm-fly-ic">🎭</span><span class="gm-fly-lbl">Type posé</span><span class="gm-place-type" id="gm-place-type">${[['pj', '🧝 PJ'], ['npc', '🙂 PNJ'], ['monster', '👹 Monstre']].map(t => `<button data-ptype="${t[0]}" class="${placeTokenType === t[0] ? 'is-on' : ''}">${t[1]}</button>`).join('')}</span></div>`;
            if (it.type === 'placeowner') {
                const players = (live.players || []);
                const opts = players.map(pl => { const s = pl.snapshot || {}; const nm = s.name || pl.character_name || 'Joueur'; return `<button data-powner="${pl.user_id}" data-pname="${esc(nm)}" class="${placeOwner && placeOwner.uid === pl.user_id ? 'is-on' : ''}">🧝 ${esc(nm)}</button>`; }).join('');
                const none = `<button data-powner="" class="${!placeOwner ? 'is-on' : ''}">— libre —</button>`;
                return `<div class="gm-fly-row" title="Assigne le prochain jeton PJ posé à un joueur connecté (pré-placement) : ce sera SON jeton quand il jouera."><span class="gm-fly-ic">🔗</span><span class="gm-fly-lbl">Joueur</span><span class="gm-place-type" id="gm-place-owner">${none}${opts || '<button disabled>aucun connecté</button>'}</span></div>`;
            }
            if (it.type === 'aoekind') return `<div class="gm-fly-row"><span class="gm-fly-ic">🔷</span><span class="gm-fly-lbl">Forme</span><span class="gm-place-type" id="gm-aoe-kind">${[['circle', '⭕ Sphère'], ['cone', '🔺 Cône'], ['line', '➖ Ligne'], ['cube', '⬛ Cube']].map(t => `<button data-aoekind="${t[0]}" class="${aoeKind === t[0] ? 'is-on' : ''}">${t[1]}</button>`).join('')}</span></div>`;
            if (it.type === 'aoecolor') return `<div class="gm-fly-row"><span class="gm-fly-ic">🎨</span><span class="gm-fly-lbl">Couleur</span><input type="color" id="gm-aoe-color" value="${aoeColor}"></div>`;
            if (it.type === 'pingcolor') return `<div class="gm-fly-row" title="Couleur du repère lumineux envoyé aux joueurs (mémorisée)."><span class="gm-fly-ic">🎨</span><span class="gm-fly-lbl">Couleur</span><input type="color" id="gm-ping-color" value="${pingColor}"></div>`;
            if (it.type === 'weather') { const cur = (state.map && state.map.weather) || ''; return `<div class="gm-fly-row"><span class="gm-fly-ic">🌦️</span><span class="gm-fly-lbl">Météo</span><span class="gm-place-type" id="gm-weather-pick">${[['', '☀️'], ['rain', '🌧️'], ['snow', '❄️'], ['fog', '🌫️'], ['embers', '🔥']].map(t => `<button data-weather="${t[0]}" class="${cur === t[0] ? 'is-on' : ''}" title="${{ '': 'Aucune', rain: 'Pluie', snow: 'Neige', fog: 'Brume', embers: 'Braises' }[t[0]]}">${t[1]}</button>`).join('')}</span></div>`; }
            if (it.type === 'daynight') { const dn = (state.map && state.map.dayNight) || {}; const hh = dn.time == null ? 12 : dn.time; const off = !dn.on; return `<div class="gm-fly-row${off ? ' gm-fly-row-disabled' : ''}" title="Heure de la journée : la carte se teinte (aube, plein jour, crépuscule, nuit). Le curseur n'a d'effet que si le cycle est affiché."><span class="gm-fly-ic">${dayNightIcon(hh)}</span><span class="gm-fly-lbl">Heure</span><input type="range" id="gm-daynight" min="0" max="23" step="1" value="${hh}"${off ? ' disabled' : ''}><b class="gm-fly-wval gm-fly-wval-wide" id="gm-daynight-val">${dayNightLabel(hh)}</b></div>`; }
            if (it.type === 'daynightpresets') return `<div class="gm-fly-row" title="Régler l'heure d'un clic (affiche le cycle jour/nuit)."><span class="gm-fly-ic">⏱️</span><span class="gm-fly-lbl">Rapide</span><span class="gm-place-type" id="gm-dn-presets">${[[6, '🌅 Aube'], [12, '☀️ Midi'], [18, '🌇 Crép.'], [23, '🌙 Nuit']].map(t => `<button data-dnpreset="${t[0]}">${t[1]}</button>`).join('')}</span></div>`;
            if (it.type === 'hazardkind') return `<div class="gm-fly-row"><span class="gm-fly-ic">🌋</span><span class="gm-fly-lbl">Type</span><span class="gm-place-type" id="gm-hazard-kind">${[['lava', '🌋 Lave'], ['poison', '☠️ Poison'], ['fire', '🔥 Feu']].map(t => `<button data-hazardkind="${t[0]}" class="${hazardKind === t[0] ? 'is-on' : ''}">${t[1]}</button>`).join('')}</span></div>`;
            const on = (it.type === 'tool') ? (mapTool === it.tool) : !!it.on;
            return `<button class="gm-fly-item${on ? ' is-on' : ''}${it.danger ? ' is-danger' : ''}" data-fi="${i}"><span class="gm-fly-ic">${it.icon}</span><span class="gm-fly-lbl">${it.label}</span>${it.type !== 'action' ? `<span class="gm-fly-state">${on ? '●' : '○'}</span>` : ''}</button>`;
        }).join('') + (grp.hint ? `<div class="gm-fly-hint">${grp.hint}</div>` : '');
        p.classList.remove('hidden');
        // Position : à droite du bouton, sans déborder de l'écran
        const r = btn.getBoundingClientRect();
        p.style.left = Math.min(r.right + 10, window.innerWidth - p.offsetWidth - 8) + 'px';
        p.style.top = Math.max(8, Math.min(r.top - 4, window.innerHeight - p.offsetHeight - 8)) + 'px';
        // Câblage des éléments
        p.querySelectorAll('[data-fi]').forEach(el => el.addEventListener('click', () => {
            const it = grp.items[parseInt(el.dataset.fi, 10)]; if (!it) return;
            if (it.type === 'tool') { setMapTool(it.tool); closeToolFlyout(); return; }
            it.run();
            if (it.type === 'toggle') { const k = flyoutKey; flyoutKey = null; openToolFlyout(k, btn); }  // rafraîchit l'état affiché
            else if (!it.keep) closeToolFlyout();
        }));
        const col = p.querySelector('#gm-draw-color'); if (col) col.addEventListener('input', (e) => { drawColor = e.target.value; });
        const lcol = p.querySelector('#gm-light-color'); if (lcol) lcol.addEventListener('input', (e) => { lightColor = e.target.value; });
        const ptype = p.querySelector('#gm-place-type');
        if (ptype) ptype.querySelectorAll('[data-ptype]').forEach(b => b.addEventListener('click', (e) => {
            e.stopPropagation(); placeTokenType = b.dataset.ptype; if (b.dataset.ptype !== 'pj') placeOwner = null;
            if (mapTool !== 'placetoken') setMapTool('placetoken');
            ptype.querySelectorAll('[data-ptype]').forEach(x => x.classList.toggle('is-on', x === b));
            const own = p.querySelector('#gm-place-owner'); if (own) own.querySelectorAll('[data-powner]').forEach(x => x.classList.toggle('is-on', !x.dataset.powner && !placeOwner));
        }));
        const powner = p.querySelector('#gm-place-owner');
        if (powner) powner.querySelectorAll('[data-powner]').forEach(b => b.addEventListener('click', (e) => {
            e.stopPropagation();
            placeOwner = b.dataset.powner ? { uid: b.dataset.powner, name: b.dataset.pname } : null;
            if (placeOwner) placeTokenType = 'pj';
            if (mapTool !== 'placetoken') setMapTool('placetoken');
            powner.querySelectorAll('[data-powner]').forEach(x => x.classList.toggle('is-on', x === b));
            const pt = p.querySelector('#gm-place-type'); if (pt) pt.querySelectorAll('[data-ptype]').forEach(x => x.classList.toggle('is-on', x.dataset.ptype === placeTokenType));
        }));
        const akind = p.querySelector('#gm-aoe-kind');
        if (akind) akind.querySelectorAll('[data-aoekind]').forEach(b => b.addEventListener('click', (e) => {
            e.stopPropagation(); aoeKind = b.dataset.aoekind; if (mapTool !== 'aoe') setMapTool('aoe');
            akind.querySelectorAll('[data-aoekind]').forEach(x => x.classList.toggle('is-on', x === b));
        }));
        const acol = p.querySelector('#gm-aoe-color'); if (acol) acol.addEventListener('input', (e) => { aoeColor = e.target.value; });
        const hkind = p.querySelector('#gm-hazard-kind');
        if (hkind) hkind.querySelectorAll('[data-hazardkind]').forEach(b => b.addEventListener('click', (e) => {
            e.stopPropagation(); hazardKind = b.dataset.hazardkind; if (mapTool !== 'hazard') setMapTool('hazard');
            hkind.querySelectorAll('[data-hazardkind]').forEach(x => x.classList.toggle('is-on', x === b));
        }));
        const pgcol = p.querySelector('#gm-ping-color'); if (pgcol) pgcol.addEventListener('input', (e) => { pingColor = e.target.value; try { localStorage.setItem('dnd-gm-ping-color', pingColor); } catch (_) {} });
        const wpick = p.querySelector('#gm-weather-pick');
        if (wpick) wpick.querySelectorAll('[data-weather]').forEach(b => b.addEventListener('click', (e) => {
            e.stopPropagation();
            state.map.weather = b.dataset.weather || '';
            save(); renderMap(); broadcastMap(true);
            wpick.querySelectorAll('[data-weather]').forEach(x => x.classList.toggle('is-on', x === b));
        }));
        const wid = p.querySelector('#gm-draw-width'); if (wid) wid.addEventListener('input', (e) => { drawWidth = Math.max(1, Math.min(24, parseInt(e.target.value, 10) || 3)); const v = p.querySelector('.gm-fly-wval'); if (v) v.textContent = drawWidth; });
        // Curseur de vision (obscurité) : mise à jour en direct + diffusion débauncée aux joueurs
        const dkr = p.querySelector('#gm-dark-range'); if (dkr) dkr.addEventListener('input', (e) => {
            const v = Math.max(1.5, Math.min(30, parseFloat(e.target.value) || 9));
            darkState().range = v;
            const lb = p.querySelector('#gm-dark-range-val'); if (lb) lb.textContent = v + ' m';
            clearTimeout(dkr._t); dkr._t = setTimeout(() => { save(); renderMap(); broadcastMap(true); }, 250);
        });
        // Curseur heure (cycle jour/nuit) : teinte la carte en direct, diffusion débauncée
        const dnr = p.querySelector('#gm-daynight'); if (dnr) dnr.addEventListener('input', (e) => {
            const h = Math.max(0, Math.min(23, parseInt(e.target.value, 10) || 0));
            dayNightState().time = h;
            const lb = p.querySelector('#gm-daynight-val'); if (lb) lb.textContent = dayNightLabel(h);
            const ic = dnr.closest('.gm-fly-row').querySelector('.gm-fly-ic'); if (ic) ic.textContent = dayNightIcon(h);
            applyDayNightLayer();                                // rendu immédiat (léger, pas de rebuild)
            clearTimeout(dnr._t); dnr._t = setTimeout(() => { save(); broadcastMap(true); }, 250);
        });
        // Préréglages d'heure rapides (affichent le cycle et sautent à l'heure)
        const dnp = p.querySelector('#gm-dn-presets');
        if (dnp) dnp.querySelectorAll('[data-dnpreset]').forEach(b => b.addEventListener('click', (e) => {
            e.stopPropagation();
            const h = parseInt(b.dataset.dnpreset, 10); const dn = dayNightState();
            dn.time = isNaN(h) ? 12 : h; dn.on = true;
            save(); renderMap(); broadcastMap(true);
            const k = flyoutKey; flyoutKey = null; openToolFlyout(k, btn);   // rafraîchit l'affichage
        }));
        syncToolbar();
    }
    // Surligne le groupe dont un outil est actif (appelé par setMapTool)
    function syncToolbar() {
        document.querySelectorAll('.gm-leftbar .gm-tool').forEach(b => {
            const tools = GROUP_TOOLS[b.dataset.tgroup] || [];
            b.classList.toggle('is-active', tools.indexOf(mapTool) !== -1);
        });
    }
    // ----- Actions extraites (partagées entre la barre d'outils et les réglages) -----
    function addTokenPrompt() { const n = prompt('Nom du jeton :'); if (!n || !n.trim()) return; state.tokens.push({ id: uid(), name: n.trim(), type: 'npc', x: 0.5, y: 0.5 }); save(); renderMap(); broadcastMap(true); }
    function clearTokensConfirm() { if (!confirm('Retirer tous les jetons ?')) return; state.tokens = []; save(); renderMap(); broadcastMap(true); }
    function toggleTokensLock() { state.map.tokensLocked = !state.map.tokensLocked; save(); renderMap(); broadcastMap(true); if (window.showAppToast) window.showAppToast(state.map.tokensLocked ? '🔒 Jetons verrouillés (MJ seul)' : '🔓 Jetons libres (chaque joueur bouge le sien)', '#2c3e50'); }
    function toggleSnap() { state.map.snap = !state.map.snap; save(); renderMap(); if (window.showAppToast) window.showAppToast(state.map.snap ? '🧲 Aimantage grille activé' : '🧲 Aimantage désactivé', '#2c3e50'); }
    function toggleHpBars() { state.map.hpBars = !state.map.hpBars; save(); renderMap(); broadcastMap(true); if (window.showAppToast) window.showAppToast(state.map.hpBars ? '❤️ Barres de PV visibles des joueurs' : '❤️ Barres de PV masquées', '#2c3e50'); }
    // ----- Cycle jour/nuit (Lot 32) : teinte globale calculée depuis l'heure. Affichage optionnel (MJ). -----
    function dayNightState() { const m = state.map || {}; if (!m.dayNight) m.dayNight = { on: false, time: 12 }; return m.dayNight; }
    function dayNightIcon(h) { return h < 5 || h >= 21 ? '🌙' : (h < 8 ? '🌅' : (h < 18 ? '☀️' : (h < 20 ? '🌇' : '🌆'))); }
    function dayNightLabel(h) { const hh = ((h % 24) + 24) % 24; return (hh < 10 ? '0' + hh : hh) + ' h'; }
    // Couleur de teinte (rgba) interpolée entre points d'ancrage horaires. '' = plein jour (aucune).
    function dayNightTint(h) {
        const anchors = [
            [0, [8, 12, 40, 0.58]], [5, [20, 25, 65, 0.5]], [7, [235, 150, 80, 0.26]],
            [9, [255, 244, 210, 0.05]], [12, [255, 255, 255, 0]], [16, [255, 240, 205, 0.05]],
            [18, [235, 120, 65, 0.28]], [20, [40, 35, 85, 0.42]], [24, [8, 12, 40, 0.58]]
        ];
        h = ((h % 24) + 24) % 24;
        let a = anchors[0], b = anchors[anchors.length - 1];
        for (let i = 0; i < anchors.length - 1; i++) { if (h >= anchors[i][0] && h <= anchors[i + 1][0]) { a = anchors[i]; b = anchors[i + 1]; break; } }
        const t = b[0] === a[0] ? 0 : (h - a[0]) / (b[0] - a[0]);
        const c = a[1].map((v, i) => v + (b[1][i] - v) * t);
        if (c[3] < 0.02) return '';
        return 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + (Math.round(c[3] * 100) / 100) + ')';
    }
    function toggleDayNight() {
        const dn = dayNightState(); dn.on = !dn.on;
        save(); renderMap(); broadcastMap(true);
        if (window.showAppToast) window.showAppToast(dn.on ? '🌗 Cycle jour/nuit affiché (' + dayNightLabel(dn.time) + ')' : '🌗 Cycle jour/nuit masqué', '#2c3e50');
    }
    // Applique juste la couleur au calque jour/nuit (sans rebuild du board) — pour le curseur en direct.
    function applyDayNightLayer() {
        const view = byId('gm-map-view'); const board = view && view.querySelector('.gm-board'); if (!board) return;
        const el = board.querySelector('.gm-layer-daynight'); if (!el) return;
        const dn = (state.map && state.map.dayNight) || {};
        el.style.background = (dn.on ? dayNightTint(dn.time == null ? 12 : dn.time) : '') || 'transparent';
    }
    function clearMapTint() { if (state.map && state.map.tint) { state.map.tint = ''; state.map.ambiance = ''; save(); renderMap(); broadcastMap(true); renderAmbianceBtns(); if (window.showAppToast) window.showAppToast('🎨 Teinte d\'ambiance retirée', '#2c3e50'); } }
    function toggleGrid() { state.map.showGrid = (state.map.showGrid === false); save(); renderMap(); broadcastMap(true); }
    function promptAddMap() { const n = prompt('Nom de la nouvelle carte :', 'Carte ' + ((state.maps ? state.maps.length : 0) + 1)); if (n && n.trim()) addMap(n.trim()); }
    function promptRenameMap(id) { const p = (state.maps || []).find(x => x.id === id); if (!p) return; const n = prompt('Renommer la carte :', p.name); if (n && n.trim()) renameMap(p.id, n.trim()); }
    function confirmDeleteMap(id) { const p = (state.maps || []).find(x => x.id === id); if (!p) return; if (confirm('Supprimer la carte « ' + p.name + ' » et ses jetons ?')) deleteMap(p.id); }

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
        el.innerHTML = state.initiative.map((c, i) => {
            const fx = (c.effects || []).map(f => `<span class="gm-init-fx${f.rounds <= 1 ? ' is-last' : ''}" title="Encore ${f.rounds} tour(s)" data-act="init-fx-del" data-id="${c.id}" data-fx="${esc(f.label)}">${esc(f.label)} <b>${f.rounds}</b> ✕</span>`).join('');
            return `<div class="gm-init-item ${i === state.turnIndex ? 'is-active' : ''}${c.hidden ? ' is-mj-hidden' : ''}">
            <span class="gm-init-init">${c.init == null ? '—' : c.init}</span>
            <span class="gm-init-type">${c.type === 'pj' ? '🧝' : '👹'}</span>
            <span class="gm-init-name">${esc(c.name)}</span>
            <button class="gm-init-fxadd" data-act="init-fx-add" data-id="${c.id}" title="Ajouter un effet temporaire (durée en tours)">✨</button>
            <button class="gm-eye${c.hidden ? ' is-hidden' : ''}" data-act="init-eye" data-id="${c.id}" title="${c.hidden ? 'Caché des joueurs' : 'Masquer aux joueurs'}">${c.hidden ? '🙈' : '👁️'}</button>
            <button class="gm-init-del" data-act="init-del" data-id="${c.id}">✕</button>
            ${fx ? `<div class="gm-init-fxrow">${fx}</div>` : ''}
        </div>`;
        }).join('');
    }
    // Décrémente les effets temporaires de tous les combattants (à chaque nouveau round). Alerte à l'expiration.
    function tickCombatEffects() {
        (state.initiative || []).forEach(c => {
            if (!c.effects || !c.effects.length) return;
            c.effects.forEach(f => { f.rounds = (f.rounds || 1) - 1; });
            const expired = c.effects.filter(f => f.rounds <= 0);
            expired.forEach(f => clog('⏳ ' + (c.name || 'Combattant') + ' : effet « ' + f.label + ' » terminé'));
            c.effects = c.effects.filter(f => f.rounds > 0);
        });
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
                <button class="gm-tree-act" data-act="npc-reveal" data-id="${n.id}" title="Révéler ce PNJ aux joueurs (carte illustrée)">🎴</button>
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
    // ----- Ambiances en un clic (Lot 30) : météo + teinte carte + effet sonore, diffusés -----
    function renderAmbianceBtns() {
        const host = byId('gm-ambiance-btns'); if (!host) return;
        const cur = (state.map && state.map.ambiance) || '';
        host.innerHTML = AMBIANCES.map(a => `<button data-ambiance="${a.key}" class="${cur === a.key ? 'is-on' : ''}" title="${esc(a.note)}">${a.icon} ${esc(a.label)}</button>`).join('');
    }
    function applyAmbiance(key) {
        const a = AMBIANCES.find(x => x.key === key); if (!a) return;
        if (!state.map) state.map = {};
        state.map.weather = a.weather || '';
        state.map.tint = a.tint || '';
        state.map.ambiance = a.key;
        save(); renderMap(); broadcastMap(true);
        renderAmbianceBtns();
        // Effet sonore chez le MJ ET les joueurs
        if (a.sfx) {
            if (window.MusicPlayer && window.MusicPlayer.playBuiltinSfx) { try { window.MusicPlayer.playBuiltinSfx(a.sfx); } catch (e) {} }
            if (live.presChannel) gmBroadcast('sfx', { builtin: a.sfx });
        }
        if (window.showAppToast) window.showAppToast(a.icon + ' Ambiance : ' + a.label, '#8a6320');
    }
    function renderTradeTargets() {
        const opts = ['<option value="all">📢 Tous les joueurs</option>'].concat(live.players.map(p => {
            const s = p.snapshot || {};
            const nm = s.name || p.character_name || 'Aventurier';
            const dot = live.online.has(p.user_id) ? '🟢' : '⚪';
            return `<option value="${p.user_id}">${dot} ${esc(nm)}</option>`;
        })).join('');
        // Même liste pour le troc/murmure, « Montrer une image » ET « Demander un jet »
        ['gm-trade-target', 'gm-showimg-target', 'gm-rollreq-target'].forEach(id => {
            const sel = byId(id); if (!sel) return;
            const prev = sel.value;
            sel.innerHTML = opts;
            if (prev && sel.querySelector(`option[value="${prev}"]`)) sel.value = prev;
        });
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
                    <button class="gm-insp" data-act="player-inspire" data-uid="${esc(p.user_id)}" title="Accorder l'inspiration héroïque">✨</button>
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
        // Retrait OPTIMISTE : on ne dépend pas des events présence/DB (parfois lents ou manqués
        // si le joueur recharge trop vite) → le joueur disparaît tout de suite de « connectés ».
        if (p) stashOfflineSheet(p);                        // conserve sa dernière fiche (hors-ligne)
        live.players = live.players.filter(x => x.user_id !== uid);
        if (live.online && live.online.delete) live.online.delete(uid);
        save();
        if (window.showAppToast) window.showAppToast('🚪 ' + nm + (until ? ' banni' : ' exclu'), '#7A2828');
        const m = byId('gm-player-modal'); if (m) m.classList.add('hidden');
        renderLivePlayers(); updatePresenceCount();
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
        try {
            const p = live.presChannel.send({ type: 'broadcast', event, payload });
            // Filet : un envoi refusé (rate limited / timed out) est retenté une fois.
            if (p && p.then) p.then(res => {
                if (res !== 'ok') {
                    console.warn('[MJ] diffusion « ' + event + ' » → ' + res + ' — nouvelle tentative');
                    setTimeout(() => { try { live.presChannel && live.presChannel.send({ type: 'broadcast', event, payload }); } catch (e) {} }, 250);
                }
            }).catch(e => console.warn('[MJ] diffusion « ' + event + ' » :', e));
            return true;
        } catch (e) { console.warn('broadcast:', e); return false; }
    }
    // Diffuse une image aux joueurs (ils reçoivent une notification « Ouvrir »).
    function sendSharedImage(url) {
        if (!url) return;
        const tgt = byId('gm-showimg-target');
        const target = (tgt && tgt.value) || 'all';
        const ok = gmBroadcast('show-image', { url: url, targetUserId: target });
        if (ok && window.showAppToast) window.showAppToast(target === 'all' ? '🖼️ Image envoyée aux joueurs' : '🖼️ Image envoyée en privé', '#2c3e50');
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
    // Murmure privé reçu d'un joueur : carte persistante (jusqu'au clic « Lu »),
    // un simple toast serait trop volatil pour un message que le MJ ne doit pas rater.
    function onPlayerWhisper(p) {
        if (!p || !p.text) return;
        const who = p.name || 'Un joueur';
        let wrap = byId('gm-whispers');
        if (!wrap) { wrap = document.createElement('div'); wrap.id = 'gm-whispers'; wrap.className = 'no-print'; document.body.appendChild(wrap); }
        const card = document.createElement('div'); card.className = 'gm-whisper-card';
        const time = new Date(p.ts || Date.now()).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        card.innerHTML = `<div class="gm-whisper-head"><span>🤫 ${esc(who)}</span><span class="gm-whisper-time">${time}</span></div><div class="gm-whisper-text">${esc(String(p.text).slice(0, 500))}</div><button class="gm-whisper-ack" type="button">✔ Lu</button>`;
        card.querySelector('.gm-whisper-ack').addEventListener('click', () => card.remove());
        wrap.appendChild(card);
        if (window.showAppToast) window.showAppToast('🤫 Murmure de ' + who, '#53446b');
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
        // ⚠️ Si CET onglet a aussi une session JOUEUR ouverte (localStorage partagé entre
        // fenêtres), son canal occupe déjà le topic « session:CODE » dans ce client Supabase :
        // un 2e abonnement ferait fermer le canal MJ par le serveur → le MJ ne recevrait plus
        // rien des joueurs (jetons, portes, murmures). On la détache LOCALEMENT. (bugfix Lot 25)
        if (window.PlayerSession && window.PlayerSession.detachLocal) { try { window.PlayerSession.detachLocal(); } catch (e) {} }
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
                const prevSnap = (i >= 0 && live.players[i] && live.players[i].snapshot) || null;
                if (i >= 0) live.players[i] = row; else live.players.push(row);
                stashOfflineSheet(row);
                const s = row.snapshot || {};
                // ⚠️ Concentration : un lanceur concentré qui PERD des PV doit faire un jet de CON
                // (DD = max(10, dégâts/2)). On alerte le MJ et on notifie le joueur (jet en un clic).
                if (prevSnap && s.concentrating) {
                    const oldHp = Number(prevSnap.hpCur), newHp = Number(s.hpCur);
                    if (isFinite(oldHp) && isFinite(newHp) && newHp < oldHp) {
                        const dmg = oldHp - newHp, dc = Math.max(10, Math.floor(dmg / 2));
                        const nm = s.name || row.character_name || 'Un joueur';
                        if (window.showAppToast) window.showAppToast('🌀 ' + nm + ' (concentré) subit ' + dmg + ' dégâts → jet de CON DD ' + dc, '#8e44ad');
                        clog('🌀 ' + nm + ' subit ' + dmg + ' dégâts en concentration (DD ' + dc + ')');
                        gmBroadcast('concentration', { targetUserId: row.user_id, dc: dc, dmg: dmg });
                    }
                }
                // Les états de la fiche (badges) ont pu changer → rafraîchit les jetons de ce joueur
                if (prevSnap && JSON.stringify(prevSnap.conditions || []) !== JSON.stringify(s.conditions || [])) {
                    if (!gmDragBusy) renderMap();
                    throttleBroadcastMap();
                }
            }
            save();
            renderLivePlayers(); updatePresenceCount();
        });
        try {
            live.presChannel = window.SupaAuth.presenceChannel(code);
            live.presChannel
                .on('presence', { event: 'sync' }, () => {
                    const prevOnline = live.online || new Set();
                    live.online = new Set(Object.keys(live.presChannel.presenceState()));
                    // Un joueur qui vient de passer hors-ligne : on fige sa dernière fiche connue
                    // (garantit qu'elle apparaît dans « Fiches hors-ligne » même sans event DB).
                    (live.players || []).forEach(p => { if (prevOnline.has(p.user_id) && !live.online.has(p.user_id)) stashOfflineSheet(p); });
                    save();
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
                .on('broadcast', { event: 'door-toggle' }, ({ payload }) => onPlayerDoorToggle(payload))
                .on('broadcast', { event: 'template-add' }, ({ payload }) => onPlayerTemplate(payload))
                .on('broadcast', { event: 'template-clear' }, ({ payload }) => onPlayerTemplateClear(payload))
                .on('broadcast', { event: 'dice' }, ({ payload }) => {   // jet partagé d'un joueur
                    if (!payload) return;
                    // Réussite/échec si la demande portait un DD + mention des critiques naturels
                    const okTxt = (payload.dc != null && payload.dc !== '') ? (Number(payload.total) >= Number(payload.dc) ? ' ✅ (DD ' + payload.dc + ')' : ' ❌ (DD ' + payload.dc + ')') : '';
                    const natTxt = payload.nat === 20 ? ' — NAT 20 !' : (payload.nat === 1 ? ' — NAT 1…' : '');
                    if (window.showAppToast) window.showAppToast('🎲 ' + (payload.user || 'Joueur') + ' : ' + (payload.formula || '') + ' = ' + payload.total + okTxt + natTxt, '#2c3e50');
                    clog('🎲 ' + (payload.user || 'Joueur') + ' lance ' + (payload.formula || '') + ' = ' + payload.total + okTxt + natTxt);
                    if (window.TableFX) { if (payload.nat === 20) window.TableFX.crit(); else if (payload.nat === 1) window.TableFX.fumble(); }
                })
                .on('broadcast', { event: 'rest' }, ({ payload }) => {   // un joueur prend un repos
                    if (!payload) return;
                    const lbl = payload.kind === 'long' ? 'repos long' : 'repos court';
                    if (window.showAppToast) window.showAppToast('🛌 ' + (payload.name || 'Un joueur') + ' entame un ' + lbl, '#2c3e50');
                    clog('🛌 ' + (payload.name || 'Un joueur') + ' — ' + lbl);
                })
                .on('broadcast', { event: 'whisper' }, ({ payload }) => onPlayerWhisper(payload))
                .subscribe(async (status) => { if (status === 'SUBSCRIBED') { try { await live.presChannel.track({ role: 'gm' }); } catch (e) {} } });
        } catch (e) { console.warn('presence GM:', e); }
    }

    // ---------- Compendium (recherche rapide) ----------
    function renderCompendium(query) {
        const el = byId('gm-comp-results'); if (!el) return;
        const q = (query || '').toLowerCase().trim();
        const hit = (s) => !q || String(s || '').toLowerCase().includes(q);
        // Section pliable avec en-tête (repliée par défaut pour les grosses listes quand pas de recherche).
        const section = (id, icon, label, items, collapsedByDefault) => {
            if (!items.length) return '';
            const open = q || !collapsedByDefault;                // recherche → tout ouvert
            return `<div class="gm-comp-sec"><div class="gm-comp-sec-head${open ? ' is-open' : ''}" data-comp-sec="${id}">${icon} ${label} <span class="gm-comp-count">${items.length}</span><span class="gm-comp-caret">${open ? '▾' : '▸'}</span></div><div class="gm-comp-sec-body"${open ? '' : ' style="display:none;"'}>${items.join('')}</div></div>`;
        };
        const conds = CONDITIONS_REF.filter(c => hit(c.name) || hit(c.text))
            .map(c => `<div class="gm-comp-item"><div class="gm-comp-title">⚠️ ${esc(c.name)}</div><div class="gm-comp-text">${esc(c.text)}</div></div>`);
        const rules = RULES_REF.filter(r => hit(r.name) || hit(r.text))
            .map(r => `<div class="gm-comp-item"><div class="gm-comp-title">📖 ${esc(r.name)}</div><div class="gm-comp-text">${esc(r.text)}</div></div>`);
        const rules24 = RULES_2024.filter(r => hit(r.name) || hit(r.text))
            .map(r => `<div class="gm-comp-item"><div class="gm-comp-title">📕 ${esc(r.name)}</div><div class="gm-comp-text">${esc(r.text)}</div></div>`);
        const mons = (state.monsters || []).filter(m => hit(m.name))
            .map(m => `<div class="gm-comp-item"><div class="gm-comp-title">👹 ${esc(m.name)}</div><div class="gm-comp-text">PV ${m.hpCur}/${m.hpMax}${m.ac ? ' · CA ' + m.ac : ''}${(m.attacks || []).length ? ' · ' + m.attacks.map(a => esc(a.name) + ' (' + esc(a.formula) + ')').join(', ') : ''}</div></div>`);
        const npcs = (state.npcs || []).filter(n => hit(n.name) || hit(n.secret))
            .map(n => `<div class="gm-comp-item"><div class="gm-comp-title">🎭 ${esc(n.name)}</div>${n.secret ? `<div class="gm-comp-text">${esc(n.secret)}</div>` : ''}</div>`);
        const quests = (state.quests || []).filter(t => hit(t.text))
            .map(t => `<div class="gm-comp-item"><div class="gm-comp-title">📜 ${t.done ? '✅ ' : ''}${esc(t.text)}</div></div>`);
        const html = section('mon', '👹', 'Mes monstres', mons, false)
            + section('npc', '🎭', 'Mes PNJ', npcs, false)
            + section('quest', '📜', 'Mes quêtes', quests, false)
            + section('cond', '⚠️', 'Conditions (5e)', conds, true)
            + section('rule', '📖', 'Règles (5e · 2014)', rules, true)
            + section('rule24', '📕', 'Règles 2024 (5.5) — les changements', rules24, true);
        el.innerHTML = html || `<div class="gm-empty">Aucun résultat pour « ${esc(query)} ».</div>`;
        // Repli / dépli des sections
        el.querySelectorAll('[data-comp-sec]').forEach(h => h.addEventListener('click', () => {
            const body = h.nextElementSibling; if (!body) return;
            const open = body.style.display === 'none';
            body.style.display = open ? '' : 'none';
            h.classList.toggle('is-open', open);
            const car = h.querySelector('.gm-comp-caret'); if (car) car.textContent = open ? '▾' : '▸';
        }));
    }

    function renderAll() { renderParty(); renderInit(); renderMonsters(); renderDice(); renderNpcs(); renderQuests(); renderScenes(); renderSoundboard(); renderMap(); renderLivePlayers(); renderCombatLog(); renderSnaps();
        { const ci = byId('gm-comp-search'); renderCompendium(ci ? ci.value : ''); }
        renderAmbianceBtns();
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
        // Rafraîchit la surbrillance du jeton dont c'est le tour (sans casser un drag en cours).
        if (!gmDragBusy) { const v = byId('gm-map-view'); if (v && v.querySelector('.gm-map-content')) renderMap(); }
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
        clog('🎲 ' + p.name + ' — initiative ' + p.total);
        if (window.showAppToast) window.showAppToast('🎲 ' + p.name + ' — initiative ' + p.total, '#2c3e50');
    }

    // ---------- Carte tactique ----------
    let mapThrottle = 0;
    function tokenColor(t) { return t.color || (t.type === 'monster' ? '#7A2828' : '#2980b9'); }
    // ===== Cartes multiples (pages type Roll20) =====
    // state.maps = [{ id, name, map:{bg,gridSize,showGrid,tokensLocked}, tokens:[] }]
    // state.map / state.tokens = miroir de la page active (compat avec tout le code existant).
    // stageAR = ratio FIXE de la scène (nouveau modèle « board » : les fractions sont
    // relatives à un plateau letterboxé identique chez le MJ et les joueurs, réf. largeur 1000px).
    const cloneMap = (m) => Object.assign({ bg: null, gridSize: 48, showGrid: true, stageAR: 16 / 9 }, m || {});
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
    // Barre des cartes façon Roll20 : vignettes cliquables, carte active surlignée,
    // renommer (✏️ ou double-clic), supprimer (🗑️), « ➕ Nouvelle » en fin de liste.
    function renderMapPages() {
        const bar = byId('gm-map-pages-bar'); if (!bar) return;
        ensureMaps();
        const title = byId('gm-map-title');
        if (title) { const act = (state.maps || []).find(x => x.id === state.activeMapId); title.textContent = act ? '— ' + act.name : ''; }
        bar.innerHTML = (state.maps || []).map(p => {
            const bg = p.map && p.map.bg;
            return `<div class="gm-page-thumb${p.id === state.activeMapId ? ' is-active' : ''}" draggable="true" data-page="${p.id}" title="${esc(p.name)} — clic ou glisse sur la carte pour l'afficher · double-clic : renommer">
                <div class="gm-page-img"${bg ? ` style="background-image:url(${esc(bg)})"` : ''}>${bg ? '' : '▦'}</div>
                <div class="gm-page-name">${esc(p.name)}</div>
                <div class="gm-page-acts"><button data-pact="rename" data-page="${p.id}" title="Renommer">✏️</button><button data-pact="del" data-page="${p.id}" title="Supprimer">🗑️</button></div>
            </div>`;
        }).join('') + `<button id="gm-map-page-add" class="gm-page-add" title="Créer une nouvelle carte vierge"><span class="gm-page-add-ic">➕</span><span>Nouvelle</span></button>`;
    }

    // Vue locale de la carte (zoom / déplacement / calques visibles) — non synchronisée, propre au MJ.
    let mapView = { zoom: 1, panX: 0, panY: 0,
        layers: { tokens: true, draw: true, gmnotes: true, fog: true, grid: true, walls: true },
        layerOp: { tokens: 1, draw: 1, gmnotes: 1, fog: 1, grid: 1, walls: 1 },
        visionPreview: false,    // aperçu MJ de ce que voient les joueurs dans le noir
        activeLayer: 'pj' };     // calque d'objets actif type Roll20 : 'map' | 'gm' | 'pj'
    // ----- Calques d'objets (jetons) façon Roll20 : Carte / MJ / PJ -----
    const OBJ_LAYERS = [
        { key: 'map', icon: '🗺️', label: 'Carte', tip: 'Décor posé sur la carte (visible des joueurs, sous les jetons)' },
        { key: 'gm', icon: '🎬', label: 'MJ', tip: 'Calque MJ : jetons que SEUL le maître voit (préparation)' },
        { key: 'pj', icon: '👥', label: 'PJ', tip: 'Calque joueurs : ce que les joueurs voient' }
    ];
    // Le calque d'un jeton (rétro-compat : ancien t.hidden ⇒ calque MJ).
    function tokenLayerOf(t) { return t.layer || (t.hidden ? 'gm' : 'pj'); }
    // Normalise tous les jetons (fige t.layer + resynchronise t.hidden = calque MJ).
    function ensureTokenLayers() {
        (state.tokens || []).forEach(t => { const l = tokenLayerOf(t); t.layer = l; t.hidden = (l === 'gm'); });
    }
    // Déplace un jeton vers un calque (= « transférer » MJ → PJ). Source de vérité : t.layer.
    function setTokenLayer(id, layer) {
        const t = find(state.tokens, id); if (!t) return;
        t.layer = layer; t.hidden = (layer === 'gm');
        save(); renderMap(); broadcastMap(true);
        if (window.showAppToast) { const d = OBJ_LAYERS.find(x => x.key === layer); window.showAppToast('Jeton → calque ' + (d ? d.label : layer), '#2c3e50'); }
    }
    function setActiveLayer(layer) {
        mapView.activeLayer = layer;
        renderMap();
        const d = OBJ_LAYERS.find(x => x.key === layer);
        if (window.showAppToast && d) window.showAppToast(d.icon + ' Calque actif : ' + d.label + ' — ' + d.tip, '#2c3e50');
    }
    // Révèle d'un coup tous les jetons du calque MJ (les passe au calque PJ).
    function revealAllGmTokens() {
        const gm = (state.tokens || []).filter(t => tokenLayerOf(t) === 'gm');
        if (!gm.length) { if (window.showAppToast) window.showAppToast('Aucun jeton sur le calque MJ.', '#7a6050'); return; }
        if (!confirm('Montrer aux joueurs les ' + gm.length + ' jeton(s) du calque MJ ?')) return;
        gm.forEach(t => { t.layer = 'pj'; t.hidden = false; });
        save(); renderMap(); broadcastMap(true);
        if (window.showAppToast) window.showAppToast('👥 ' + gm.length + ' jeton(s) transféré(s) aux joueurs', '#2c3e50');
    }
    let mapTool = 'select';      // 'select'|'pan'|'objmove'|'bg'|'reveal'|'cover'|'draw'|'wall'|'door'|'dooredit'|'wallerase'|'ruler'|'light'|'placetoken'|'placecombatant'
    let fogBrush = 0.06;         // rayon du pinceau de brouillard (fraction de la largeur)
    let drawColor = '#e23b3b';   // couleur du dessin libre
    let drawWidth = 3;           // épaisseur du dessin libre (molette en mode ✏️)
    let drawStroke = null;       // tracé en cours
    let drawIsNote = false;      // le tracé en cours appartient au calque privé « Notes MJ »
    let wallDraft = null;        // mur / porte en cours de tracé { x1,y1,x2,y2,door }
    let rulerDraft = null;       // mesure en cours { x1,y1,x2,y2 }
    let moveMeasure = null;      // déplacement mesuré d'un jeton en cours de drag { x1,y1,x2,y2,speed } (Lot 34)
    const tokenUndoPos = {};     // { tokenId: {x,y} } position AVANT le dernier déplacement (pour « ↩️ Position précédente »)
    const tokenMoveLast = {};    // { tokenId: ts } dernier déplacement (détecte le début d'un nouveau mouvement)
    let losA = null, losB = null; // ligne de vue : extrémités { x,y } en fractions (Lot 34b)
    let gmDragBusy = false;      // un drag de jeton MJ est en cours (évite un re-render qui casserait le pointer capture)
    let pingColor = (function () { try { return localStorage.getItem('dnd-gm-ping-color') || '#C49B35'; } catch (e) { return '#C49B35'; } })();   // couleur du signal 📍 (mémorisée)
    let lightColor = '#ffcf7a';  // couleur de la prochaine lumière posée
    let lightRadius = 0.16;      // rayon par défaut d'une lumière (fraction de largeur ; molette pour ajuster)
    let placeTokenType = 'npc';  // type de jeton posé au clic (palette PJ/PNJ/monstre)
    let placeOwner = null;       // joueur assigné au prochain jeton PJ posé { uid, name } (poser à l'avance)
    let aoeKind = 'circle';      // forme du prochain gabarit de sort
    let aoeColor = '#e67e22';    // couleur du prochain gabarit
    let aoeDraft = null;         // gabarit en cours de placement
    let aoeSaveKind = 'save-dex';// type de sauvegarde par défaut dans le panneau « gabarit intelligent »
    let lightDraft = null;       // lumière en cours de pose { x,y,r,color } (glisser = régler le rayon)
    let hazardKind = 'lava';     // type du prochain danger posé (lave / poison / feu)
    let hazardDraft = null;      // danger en cours de placement { kind,x,y,r } (glisser = rayon)
    let soundDraft = null;       // zone sonore en cours de pose { x,y,r } (glisser = portée)
    let sndPreview = { id: null, el: null };  // aperçu audio MJ d'une zone sonore (▶ dans le popover)
    let objHover = null;         // élément saisissable sous le curseur (outil ✥ / gomme 🧹) — surbrillance
    let objHoverKey = '';        // clé du survol courant (évite les re-rendus inutiles)
    let boardWpx = 500;          // largeur ACTUELLE du board MJ en px (mise à jour par renderMap)
    let mapHist = [];            // historique {map,tokens} pour Ctrl+Z (annuler)
    let mapRedo = [];            // pile de rétablissement (Ctrl+Y / Ctrl+Maj+Z)
    let histLock = false;        // évite de ré-empiler pendant un undo/redo
    let placeQueue = [];         // combattants restant à poser sur la carte (outil « placer les combattants »)
    // Jeton dont c'est le tour en combat (surbrillance sur la carte) : match par monId ou par nom.
    function isTokenActiveTurn(t) {
        if (!state.combatActive || !state.initiative || !state.initiative.length) return false;
        const c = state.initiative[state.turnIndex]; if (!c) return false;
        if (c.monId && t.ref === 'mon:' + c.monId) return true;
        return !!(c.name && t.name && c.name.toLowerCase() === t.name.toLowerCase());
    }
    function tokenHtml(t) {
        const hpMax = Number(t.hpMax) || 0, hp = Number(t.hp);
        const ratio = hpMax > 0 ? Math.max(0, Math.min(1, (isNaN(hp) ? hpMax : hp) / hpMax)) : 0;
        const low = hpMax > 0 && ratio <= 0.33;
        const imgStyle = t.img ? `background-image:url(${t.img});` : '';
        // Taille liée à la grille du board : un jeton « Normal » remplit sa case.
        // FORMULE IDENTIQUE côté joueur (renderPlayerMap) → même taille apparente MJ / PJ.
        const gpx = Math.max(6, gridPxFor(boardWpx));
        const sz = Math.max(12, Math.round(gpx * (Number(t.size) || 1) * 0.78));   // 0.78 case : lisible sans remplir la case (Lot 25)
        const layer = tokenLayerOf(t);
        const hpBar = hpMax > 0 ? `<div class="gm-token-hp"><div class="gm-token-hp-fill${low ? ' is-low' : ''}" style="width:${ratio * 100}%"></div></div>` : '';
        const acBadge = (t.ac != null && t.ac !== '') ? `<span class="gm-token-ac" title="Classe d'armure">${esc(t.ac)}</span>` : '';
        const badges = tokenBadges(t);
        const badgeHtml = badges ? `<span class="gm-token-badges" title="États">${esc(badges)}</span>` : '';
        // Aura (rayon en mètres) : disque translucide rendu SOUS le jeton
        let auraHtml = '';
        if (t.aura && Number(t.aura.r) > 0) {
            const apx = (Number(t.aura.r) / cellMeters()) * gpx;
            auraHtml = `<div class="gm-token-aura" style="left:${t.x * 100}%; top:${t.y * 100}%; width:${apx * 2}px; height:${apx * 2}px; --aura:${t.aura.color || '#3498db'};"></div>`;
        }
        const layerCls = layer === 'gm' ? ' is-mj-hidden gm-layer-gm' : (layer === 'map' ? ' gm-token-onmap' : '');
        const dim = (mapView.activeLayer && mapView.activeLayer !== layer) ? ' gm-token-dim' : '';
        return auraHtml + `<div class="gm-token${layerCls}${dim}${t.img ? ' has-img' : ''}${isTokenActiveTurn(t) ? ' is-turn' : ''}" data-token="${t.id}" data-layer="${layer}" style="left:${t.x * 100}%; top:${t.y * 100}%; width:${sz}px; height:${sz}px; --tok:${tokenColor(t)}; ${imgStyle}" title="${esc(t.name)}${layer === 'gm' ? ' — calque MJ (invisible aux joueurs)' : (layer === 'map' ? ' — calque Carte' : '')}">`
            + (t.img ? '' : `<span class="gm-token-label">${esc((t.name || '?').slice(0, 2))}</span>`)
            + acBadge + badgeHtml + hpBar + `</div>`;
    }
    function applyMapTransform() {
        const view = byId('gm-map-view'); if (!view) return;
        const content = view.querySelector('.gm-map-content'); if (!content) return;   // zoom/pan sur le CONTENEUR (le board vit dedans)
        content.style.transform = `translate(${mapView.panX}px, ${mapView.panY}px) scale(${mapView.zoom})`;
    }
    // ----- Brouillard de guerre (fog of war) -----
    function fogState() { const m = state.map || {}; if (!m.fog) m.fog = { on: false, reveals: [] }; if (!Array.isArray(m.fog.reveals)) m.fog.reveals = []; return m.fog; }
    function renderFog() {
        const view = byId('gm-map-view'); if (!view) return;
        const canvas = view.querySelector('.gm-layer-fog'); if (!canvas) return;
        const content = view.querySelector('.gm-board'); if (!content) return;
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
    let _fogLast = null;
    function paintFogAt(e) {
        const view = byId('gm-map-view'); const content = view && view.querySelector('.gm-board'); if (!content) return;
        const r = content.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
        const y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
        const fog = fogState();
        // Trait CONTINU : on interpole des points entre la dernière position et l'actuelle (vrai pinceau).
        const pts = [];
        if (_fogLast) {
            const dx = x - _fogLast.x, dy = y - _fogLast.y, dist = Math.hypot(dx, dy);
            const step = Math.max(fogBrush * 0.45, 0.008), n = Math.min(80, Math.ceil(dist / step));
            for (let i = 1; i <= n; i++) pts.push({ x: _fogLast.x + dx * (i / n), y: _fogLast.y + dy * (i / n) });
        }
        if (!pts.length) pts.push({ x, y });
        if (mapTool === 'reveal') pts.forEach(p => fog.reveals.push({ x: p.x, y: p.y, r: fogBrush }));
        else if (mapTool === 'cover') pts.forEach(p => { fog.reveals = fog.reveals.filter(rv => Math.hypot(rv.x - p.x, rv.y - p.y) > fogBrush); });
        _fogLast = { x, y };
        renderFog();
    }
    function setMapTool(tool) {
        const prev = mapTool;
        mapTool = (mapTool === tool && tool !== 'select') ? 'select' : tool;
        if (mapTool === 'reveal' || mapTool === 'cover') fogState().on = true;
        if (prev === 'placecombatant' && mapTool !== 'placecombatant') removePlaceBar();
        objHover = null; objHoverKey = '';                   // le survol ✥/🧹 ne suit pas l'outil
        if (mapTool !== 'los') { losA = null; losB = null; }  // quitter la ligne de vue efface le tracé
        if (mapTool !== 'ruler') rulerDraft = null;           // quitter la règle efface le chemin mesuré
        syncToolbar();
        save(); renderMap(); broadcastMap(true);
    }
    function toggleFog() { const fog = fogState(); fog.on = !fog.on; if (!fog.on) setMapTool('select'); else { save(); renderMap(); broadcastMap(true); } if (window.showAppToast) window.showAppToast(fog.on ? '🌫️ Brouillard activé — 🔦 révèle, ⬛ recache' : '☀️ Brouillard retiré', '#2c3e50'); }
    // Exploration révélée (Lot 31) : quand ON, les jetons des joueurs dévoilent le brouillard
    // autour d'eux en se déplaçant (façon jeu vidéo). Activable par le MJ seulement.
    function toggleFogAutoReveal() {
        const fog = fogState(); fog.autoReveal = !fog.autoReveal;
        if (fog.autoReveal) fog.on = true;                   // sans brouillard, la révélation n'a pas de sens
        save(); renderMap(); broadcastMap(true);
        if (window.showAppToast) window.showAppToast(fog.autoReveal ? '🧭 Exploration révélée : les joueurs dévoilent la carte en avançant' : '🧭 Exploration révélée désactivée', '#2c3e50');
    }
    // Rayon d'exploration en fraction de largeur (≈ 2,5 cases, borné pour rester lisible).
    function fogExploreRadius() {
        const cw = ((state.map && state.map.gridSize) || 48) / 1000;   // 1 case en fraction
        return Math.max(0.06, Math.min(0.2, cw * 2.5));
    }
    // Dévoile le brouillard autour d'un jeton PJ (mémoire persistante). Renvoie true si un
    // nouveau disque a été ajouté (→ l'appelant sauvegarde/diffuse).
    function autoRevealAround(tok) {
        const m = state.map || {}, fog = m.fog;
        if (!fog || !fog.on || !fog.autoReveal || !tok) return false;
        if (!(tok.type === 'pj' || tok.owner)) return false;           // seuls les PJ explorent
        if (!Array.isArray(fog.reveals)) fog.reveals = [];
        const R = fogExploreRadius();
        // Dédup : pas de nouveau disque si un révélé couvre déjà (< R/2) la position actuelle.
        const near = fog.reveals.some(rv => Math.hypot(rv.x - tok.x, rv.y - tok.y) < R * 0.5);
        if (near) return false;
        fog.reveals.push({ x: tok.x, y: tok.y, r: R });
        if (fog.reveals.length > 4000) fog.reveals.shift();            // garde-fou mémoire
        return true;
    }
    function fogRevealAll() { const fog = fogState(); fog.on = true; fog.reveals = [{ x: 0.5, y: 0.5, r: 3 }]; save(); renderMap(); broadcastMap(true); }
    function fogCoverAll() { const fog = fogState(); fog.on = true; fog.reveals = []; save(); renderMap(); broadcastMap(true); }

    // ----- Murs & portes (invisibles pour les joueurs : bloquent jetons + ligne de vue) -----
    function wallsData() { const m = state.map || {}; if (!Array.isArray(m.walls)) m.walls = []; return m.walls; }
    function darkState() { const m = state.map || {}; if (!m.dark) m.dark = { on: false, range: 9 }; if (!Number(m.dark.range)) m.dark.range = 9; return m.dark; }
    function toggleDark() {
        const d = darkState(); d.on = !d.on;
        save(); renderMap(); broadcastMap(true);
        if (window.showAppToast) window.showAppToast(d.on ? '🌑 Obscurité : les joueurs ne voient qu\'à ' + d.range + ' m autour de leur jeton' : '🔆 Obscurité levée', '#2c3e50');
    }
    function toggleVisionPreview() { mapView.visionPreview = !mapView.visionPreview; renderMap(); }
    function clearWallsConfirm() { if (!confirm('Supprimer tous les murs et portes de cette carte ?')) return; if (state.map) state.map.walls = []; save(); renderMap(); broadcastMap(true); }
    function toggleDoor(id) {
        const d = wallsData().find(w => w.id === id); if (!d) return;
        d.open = !d.open;
        save(); renderWalls(); renderVisionPreview(); broadcastMap(true);
        if (window.showAppToast) window.showAppToast(d.open ? '🚪 Porte ouverte' : '🚪 Porte fermée', '#2c3e50');
    }
    // Aimante le point de tracé : d'abord une extrémité de mur proche (murs continus),
    // sinon un coin de grille si l'aimant 🧲 est actif.
    // excludeSeg : segment à ignorer (le mur qu'on est en train de déplacer, outil ✥).
    function wallSnapPoint(fx, fy, rect, excludeSeg) {
        fx = Math.max(0, Math.min(1, fx)); fy = Math.max(0, Math.min(1, fy));
        const w = rect.width, h = rect.height;
        let best = null, bd = 12;                                  // rayon d'accroche en px écran
        (state.map && state.map.walls || []).forEach(s => {
            if (excludeSeg && s === excludeSeg) return;
            [[s.x1, s.y1], [s.x2, s.y2]].forEach(pt => {
                const d = Math.hypot((pt[0] - fx) * w, (pt[1] - fy) * h);
                if (d < bd) { bd = d; best = { x: pt[0], y: pt[1] }; }
            });
        });
        if (best) return best;
        const m = state.map || {};
        if (m.snap) {
            const cw = (m.gridSize || 48) / 1000;
            const ch = cw * (Number(m.stageAR) || (16 / 9));
            return { x: Math.max(0, Math.min(1, Math.round(fx / cw) * cw)), y: Math.max(0, Math.min(1, Math.round(fy / ch) * ch)) };
        }
        return { x: fx, y: fy };
    }
    // Maj enfoncée : contraint le point (x2,y2) à 0° / 45° / 90° du point (x1,y1),
    // calculé en px ÉCRAN pour que l'angle soit visuellement juste quel que soit le ratio.
    function constrain45(x1, y1, x2, y2, rect) {
        const px1 = x1 * rect.width, py1 = y1 * rect.height, px2 = x2 * rect.width, py2 = y2 * rect.height;
        const d = Math.hypot(px2 - px1, py2 - py1);
        if (d < 2) return { x: x2, y: y2 };
        const step = Math.PI / 4;
        const a = Math.round(Math.atan2(py2 - py1, px2 - px1) / step) * step;
        return {
            x: Math.max(0, Math.min(1, (px1 + Math.cos(a) * d) / rect.width)),
            y: Math.max(0, Math.min(1, (py1 + Math.sin(a) * d) / rect.height))
        };
    }
    function eraseWallAt(e) {
        if (!window.VTTGeo) return;
        const view = byId('gm-map-view'); const content = view && view.querySelector('.gm-board'); if (!content) return;
        const r = content.getBoundingClientRect();
        const px = e.clientX - r.left, py = e.clientY - r.top;
        const walls = wallsData();
        let bi = -1, bd = 11;                                      // tolérance de clic en px
        walls.forEach((s, i) => {
            const d = window.VTTGeo.distToSegment(px, py, s.x1 * r.width, s.y1 * r.height, s.x2 * r.width, s.y2 * r.height);
            if (d < bd) { bd = d; bi = i; }
        });
        if (bi >= 0) { walls.splice(bi, 1); save(); renderMap(); broadcastMap(true); }
    }
    function renderWalls() {
        const view = byId('gm-map-view'); if (!view) return;
        const canvas = view.querySelector('canvas.gm-layer-walls'); if (!canvas) return;
        const content = view.querySelector('.gm-board'); if (!content) return;
        const w = Math.max(1, content.clientWidth), h = Math.max(1, content.clientHeight);
        if (canvas.width !== w) canvas.width = w;
        if (canvas.height !== h) canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, w, h);
        ctx.lineCap = 'round';
        const paintSeg = (s, draft) => {
            ctx.beginPath();
            ctx.moveTo(s.x1 * w, s.y1 * h); ctx.lineTo(s.x2 * w, s.y2 * h);
            if (s.door) { ctx.strokeStyle = s.open ? 'rgba(87,166,74,0.95)' : 'rgba(214,138,43,0.95)'; ctx.setLineDash(s.open ? [3, 8] : [9, 5]); }
            else { ctx.strokeStyle = 'rgba(226,59,59,0.9)'; ctx.setLineDash([]); }
            ctx.lineWidth = 4;
            if (draft) ctx.globalAlpha = 0.55;
            ctx.stroke();
            ctx.globalAlpha = 1;
            // Petites poignées aux extrémités (repères d'accroche)
            ctx.setLineDash([]);
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            [[s.x1, s.y1], [s.x2, s.y2]].forEach(pt => { ctx.beginPath(); ctx.arc(pt[0] * w, pt[1] * h, 3, 0, Math.PI * 2); ctx.fill(); });
        };
        ((state.map && state.map.walls) || []).forEach(s => paintSeg(s, false));
        if (wallDraft) paintSeg(wallDraft, true);
        // Surbrillance de survol (outil ✥ déplacer / gomme 🧹) : on voit CE qu'on va saisir
        if (objHover && (mapTool === 'objmove' || mapTool === 'wallerase')) {
            const hovCol = mapTool === 'wallerase' ? 'rgba(231,76,60,0.55)' : 'rgba(255,214,90,0.6)';
            ctx.save();
            if (objHover.kind === 'wallpt') {
                const s = objHover.ref, px = (objHover.end === '1' ? s.x1 : s.x2) * w, py = (objHover.end === '1' ? s.y1 : s.y2) * h;
                ctx.beginPath(); ctx.arc(px, py, 8, 0, Math.PI * 2);
                ctx.fillStyle = hovCol; ctx.fill();
                ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
            } else if (objHover.kind === 'wallseg') {
                const s = objHover.ref;
                ctx.beginPath(); ctx.moveTo(s.x1 * w, s.y1 * h); ctx.lineTo(s.x2 * w, s.y2 * h);
                ctx.lineWidth = 9; ctx.strokeStyle = hovCol; ctx.setLineDash([]); ctx.stroke();
            } else if (objHover.kind === 'light' || objHover.kind === 'template') {
                const o = objHover.ref;
                ctx.beginPath(); ctx.arc(o.x * w, o.y * h, 13, 0, Math.PI * 2);
                ctx.lineWidth = 3; ctx.strokeStyle = hovCol; ctx.setLineDash([4, 4]); ctx.stroke();
            }
            ctx.restore();
        }
        // Pastilles de porte cliquables (au centre de chaque porte)
        const doorsHost = view.querySelector('.gm-layer-doors');
        if (doorsHost) {
            doorsHost.innerHTML = ((state.map && state.map.walls) || []).filter(s => s.door).map(s => {
                const mx = (s.x1 + s.x2) / 2 * 100, my = (s.y1 + s.y2) / 2 * 100;
                const ic = s.locked ? '🔒' : (s.open ? '🚪' : '🚪');
                const cls = 'gm-door-btn' + (s.open ? ' is-open' : '') + (s.locked ? ' is-locked' : '') + (s.secret ? ' is-secret' : '');
                const st = s.secret ? 'porte SECRÈTE (invisible aux joueurs)' : (s.locked ? 'porte VERROUILLÉE (joueurs bloqués)' : 'porte libre');
                const tip = (mapTool === 'dooredit') ? ('Régler : ' + st) : (s.open ? 'Porte ouverte — clic : fermer' : 'Porte fermée — clic : ouvrir') + ' · ' + st;
                return `<button class="${cls}" data-door="${s.id}" style="left:${mx}%; top:${my}%;" title="${tip}">${s.secret ? '👁️‍🗨️' : ic}</button>`;
            }).join('');
        }
    }
    // ----- Points de lumière (torches, lanternes…) : percent l'obscurité pour les joueurs -----
    function lightsData() { const m = state.map || {}; if (!Array.isArray(m.lights)) m.lights = []; return m.lights; }
    function clearLightsConfirm() { if (!confirm('Retirer toutes les lumières de cette carte ?')) return; if (state.map) state.map.lights = []; save(); renderMap(); broadcastMap(true); }
    function eraseLights(ctx, w, h, segs, pjToks) {
        // Chaque lumière dévoile une zone (bloquée par les murs) — comme un jeton porteur de torche.
        const erase = window.VTTGeo.eraseVisionSoft || window.VTTGeo.eraseVision;   // même rendu doux que côté joueur
        const walls = (state.map && state.map.walls) || [];
        (lightsData()).forEach(l => {
            // Comme côté joueur : une lumière hors de vue des PJ ne leur apparaît pas (sauf « toujours »)
            if (!l.always && pjToks && window.VTTGeo && !pjToks.some(t => !window.VTTGeo.moveBlocked(walls, t.x, t.y, l.x, l.y))) return;
            const R = (Number(l.r) || lightRadius) * w;
            erase(ctx, l.x * w, l.y * h, segs, R);
        });
    }
    function renderLights() {
        const view = byId('gm-map-view'); if (!view) return;
        const host = view.querySelector('.gm-layer-lights'); if (!host) return;
        const content = view.querySelector('.gm-board'); if (!content) return;
        const w = Math.max(1, content.clientWidth), h = Math.max(1, content.clientHeight);
        // + aperçu de la lumière en cours de pose (glisser = régler le rayon)
        const lights = lightsData().concat((lightDraft && lightDraft.r > 0.015) ? [Object.assign({ id: '__draft' }, lightDraft)] : []);
        // Halo lumineux (léger, joli) + pastilles éditables
        host.innerHTML = lights.map(l => {
            const rpx = (Number(l.r) || lightRadius) * w, dpx = rpx * 2;
            const col = l.color || lightColor;
            return `<div class="gm-light-halo" style="left:${l.x * 100}%; top:${l.y * 100}%; width:${dpx}px; height:${dpx}px; --lc:${col};"></div>`
                + `<button class="gm-light-pin" data-light="${l.id}" style="left:${l.x * 100}%; top:${l.y * 100}%; --lc:${col};" title="Lumière — clic (outil 💡) : régler">💡</button>`;
        }).join('');
    }
    function ensureLightPopover() {
        let p = byId('gm-light-popover'); if (p) return p;
        p = document.createElement('div'); p.id = 'gm-light-popover'; p.className = 'gm-token-popover hidden no-print';
        document.body.appendChild(p);
        document.addEventListener('pointerdown', (e) => { if (!p.classList.contains('hidden') && !e.target.closest('#gm-light-popover') && !e.target.closest('.gm-light-pin')) p.classList.add('hidden'); });
        return p;
    }
    function openLightPopover(id, e) {
        const l = lightsData().find(x => x.id === id); if (!l) return;
        const p = ensureLightPopover();
        const rMeters = Math.round(((l.r || lightRadius) / (((state.map && state.map.gridSize) || 48))) * 0 + (l.r || lightRadius) * 100);
        p.innerHTML = `
            <div class="gm-tp-row"><label>💡 Lumière</label><input class="gm-tp-color" type="color" data-lp="color" value="${l.color || lightColor}" title="Couleur"></div>
            <div class="gm-tp-row"><label>Rayon</label><input type="range" data-lp="r" min="4" max="45" step="1" value="${Math.round((l.r || lightRadius) * 100)}"><b class="gm-fly-wval" data-lp-rval>${Math.round((l.r || lightRadius) * 100)}</b></div>
            <div class="gm-tp-row" title="Décoché (défaut) : les joueurs ne voient cette lumière que si l'un de leurs jetons a une ligne de vue dégagée vers elle (les murs bloquent). Coché : visible même dans une zone qu'ils ne voient pas."><label>👁️</label><label class="gm-map-ctl"><input type="checkbox" data-lp="always"${l.always ? ' checked' : ''}> Visible même hors de vue</label></div>
            <div class="gm-tp-row gm-tp-actions"><button class="gm-btn gm-btn-danger" data-lp-act="del">🗑️ Supprimer</button></div>`;
        p.classList.remove('hidden');
        const ox = (e && e.clientX) || window.innerWidth / 2, oy = (e && e.clientY) || window.innerHeight / 2;
        p.style.left = Math.max(8, Math.min(ox + 10, window.innerWidth - p.offsetWidth - 8)) + 'px';
        p.style.top = Math.max(8, Math.min(oy + 10, window.innerHeight - p.offsetHeight - 8)) + 'px';
        p.querySelector('[data-lp="color"]').addEventListener('input', (ev) => { l.color = ev.target.value; save(); renderMap(); broadcastMap(true); });
        p.querySelector('[data-lp="always"]').addEventListener('change', (ev) => { l.always = ev.target.checked || undefined; save(); renderMap(); broadcastMap(true); });
        p.querySelector('[data-lp="r"]').addEventListener('input', (ev) => { l.r = Math.max(0.04, Math.min(0.45, (parseInt(ev.target.value, 10) || 16) / 100)); const v = p.querySelector('[data-lp-rval]'); if (v) v.textContent = Math.round(l.r * 100); save(); renderMap(); broadcastMap(true); });
        p.querySelector('[data-lp-act="del"]').addEventListener('click', () => { state.map.lights = lightsData().filter(x => x.id !== id); p.classList.add('hidden'); save(); renderMap(); broadcastMap(true); });
    }
    // ----- Échelle, gabarits de sorts, météo, journal, historique -----
    function cellMeters() { return Number(state.map && state.map.cellM) || 1.5; }
    function promptCellM() {
        const v = prompt('Combien de mètres représente une case de la grille ?', String(cellMeters()));
        if (v == null) return;
        const n = parseFloat(String(v).replace(',', '.'));
        if (!n || n <= 0) return;
        state.map.cellM = n;
        save(); renderMap(); broadcastMap(true);
        if (window.showAppToast) window.showAppToast('📐 Échelle : 1 case = ' + n + ' m', '#2c3e50');
    }
    // px d'une case pour un board de largeur w (gridSize est stocké en px de référence largeur 1000)
    function gridPxFor(w) { return ((state.map && state.map.gridSize) || 48) * w / 1000; }
    // Migration des anciennes cartes (coordonnées relatives au viewport) vers le modèle « board »
    // à ratio fixe : on fige le ratio ACTUEL et on convertit les px (grille, calage fond) en réf. 1000.
    function migrateMapRef(m, view) {
        if (!m || m.stageAR) return;
        const vw = Math.max(1, view.clientWidth), vh = Math.max(1, view.clientHeight);
        if (vw < 60 || vh < 60) return;                     // vue pas encore affichée : on migrera plus tard
        m.stageAR = vw / vh;
        const k = 1000 / vw;
        m.gridSize = Math.max(8, Math.round(((m.gridSize || 48)) * k));
        if (m.bgX) m.bgX = Math.round(m.bgX * k);
        if (m.bgY) m.bgY = Math.round(m.bgY * k);
        save();
    }
    function templatesData() { const m = state.map || {}; if (!Array.isArray(m.templates)) m.templates = []; return m.templates; }
    function clearTemplatesConfirm() { if (!confirm('Retirer tous les gabarits de sorts ?')) return; if (state.map) state.map.templates = []; save(); renderMap(); broadcastMap(true); }
    function togglePlayerAoe() { state.map.playerAoeOff = !state.map.playerAoeOff; save(); renderMap(); broadcastMap(true); if (window.showAppToast) window.showAppToast(state.map.playerAoeOff ? '🚫 Les joueurs ne peuvent plus poser de gabarits' : '👥 Les joueurs peuvent poser des gabarits', '#2c3e50'); }
    function renderTemplates() {
        const view = byId('gm-map-view'); if (!view) return;
        const canvas = view.querySelector('canvas.gm-layer-templates'); if (!canvas) return;
        const board = view.querySelector('.gm-board'); if (!board) return;
        const w = Math.max(1, board.clientWidth), h = Math.max(1, board.clientHeight);
        if (canvas.width !== w) canvas.width = w;
        if (canvas.height !== h) canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, w, h);
        if (!window.VTTGeo || !window.VTTGeo.drawTemplates) return;
        const all = templatesData().concat(aoeDraft ? [aoeDraft] : []);
        window.VTTGeo.drawTemplates(ctx, w, h, all, gridPxFor(w), cellMeters());
    }
    function eraseTemplateAt(e) {
        const view = byId('gm-map-view'); const board = view && view.querySelector('.gm-board'); if (!board) return;
        const r = board.getBoundingClientRect();
        const px = e.clientX - r.left, py = e.clientY - r.top;
        const ts = templatesData();
        let bi = -1, bd = 16;
        ts.forEach((t, i) => { const d = Math.hypot(px - t.x * r.width, py - t.y * r.height); if (d < bd) { bd = d; bi = i; } });
        if (bi >= 0) { ts.splice(bi, 1); save(); renderMap(); broadcastMap(true); }
    }

    // ===== GABARIT INTELLIGENT (#8) : jetons touchés + jets de sauvegarde =====
    const SAVE_KINDS = [
        ['save-dex', 'DEX', 'dex'], ['save-con', 'CON', 'con'], ['save-wis', 'SAG', 'wis'],
        ['save-str', 'FOR', 'str'], ['save-int', 'INT', 'int'], ['save-cha', 'CHA', 'cha']
    ];
    function tokenTypeIcon(t) {
        const l = tokenLayerOf(t);
        if (t.owner || t.type === 'pj') return '🧑';
        if (t.type === 'monster') return '👹';
        if (l === 'gm') return '🫥';
        return '🧝';
    }
    // Renvoie les jetons-créatures dont le CENTRE est dans le gabarit t (px du board).
    function tokensInTemplate(t) {
        const view = byId('gm-map-view'); const board = view && view.querySelector('.gm-board');
        if (!board || !t || !window.VTTGeo || !window.VTTGeo.pointInTemplate) return [];
        const w = Math.max(1, board.clientWidth), h = Math.max(1, board.clientHeight);
        const gridPx = gridPxFor(w);
        return (state.tokens || []).filter(tok => {
            if (tokenLayerOf(tok) === 'map') return false;   // décor / image de fond, pas une cible
            return window.VTTGeo.pointInTemplate(t, (tok.x || 0) * w, (tok.y || 0) * h, w, h, gridPx);
        });
    }
    function ensureAoePanel() {
        let p = byId('gm-aoe-panel'); if (p) return p;
        p = document.createElement('div'); p.id = 'gm-aoe-panel'; p.className = 'gm-aoe-panel hidden no-print';
        document.body.appendChild(p);
        // Un clic hors du panneau (et pas sur la carte pour re-glisser) le ferme.
        document.addEventListener('pointerdown', (e) => {
            if (p.classList.contains('hidden')) return;
            if (e.target.closest('#gm-aoe-panel')) return;
            if (e.target.closest('#gm-map-view')) return;   // laisser tracer un nouveau gabarit
            p.classList.add('hidden');
        });
        return p;
    }
    // Ouvre le panneau listant les jetons touchés par le gabarit t + jets de sauvegarde.
    function openAoeTargetPanel(t, e) {
        if (!t) return;
        const targets = tokensInTemplate(t);
        const p = ensureAoePanel();
        const KIND_LBL = { circle: '⭕ Sphère', cone: '🔺 Cône', line: '➖ Ligne', cube: '⬛ Cube' };
        if (!targets.length) {
            p.innerHTML = `<div class="gm-aoe-head">🎯 ${KIND_LBL[t.kind] || 'Gabarit'} — aucune cible</div>
                <div class="gm-aoe-empty">Aucun jeton dans la zone.</div>
                <div class="gm-aoe-actions"><button class="gm-btn" data-aoe-act="close">Fermer</button></div>`;
        } else {
            const saveSel = `<select class="gm-input" id="gm-aoe-save">${SAVE_KINDS.map(s => `<option value="${s[0]}"${aoeSaveKind === s[0] ? ' selected' : ''}>Sauv. ${s[1]}</option>`).join('')}</select>`;
            const rows = targets.map(tok => {
                return `<label class="gm-aoe-row"><input type="checkbox" data-aoe-tid="${esc(tok.id)}" checked>
                    <span class="gm-aoe-ic">${tokenTypeIcon(tok)}</span>
                    <span class="gm-aoe-nm">${esc(tok.name || 'Jeton')}</span>
                    <span class="gm-aoe-res" data-aoe-res="${esc(tok.id)}"></span></label>`;
            }).join('');
            p.innerHTML = `<div class="gm-aoe-head">🎯 ${KIND_LBL[t.kind] || 'Gabarit'} — ${targets.length} cible${targets.length > 1 ? 's' : ''}</div>
                <div class="gm-aoe-list">${rows}</div>
                <div class="gm-aoe-cfg">
                    <label class="gm-aoe-cfg-l">Jet</label>${saveSel}
                    <label class="gm-aoe-cfg-l" title="Degré de difficulté (optionnel)">DD</label>
                    <input class="gm-input gm-num" type="number" id="gm-aoe-dc" placeholder="—" min="1" style="width:56px;flex:0 0 auto;">
                </div>
                <div class="gm-aoe-actions">
                    <button class="gm-btn gm-btn-primary" data-aoe-act="roll" title="Demander le jet aux joueurs concernés et lancer pour les PNJ/monstres">🎲 Lancer les sauvegardes</button>
                    <button class="gm-btn" data-aoe-act="close">Fermer</button>
                </div>`;
        }
        p.classList.remove('hidden');
        const ox = (e && e.clientX) || window.innerWidth / 2, oy = (e && e.clientY) || window.innerHeight / 2;
        // positionner puis corriger si ça déborde (offsetWidth dispo après remove hidden)
        p.style.left = Math.max(8, Math.min(ox + 12, window.innerWidth - p.offsetWidth - 8)) + 'px';
        p.style.top = Math.max(8, Math.min(oy + 12, window.innerHeight - p.offsetHeight - 8)) + 'px';
        const saveEl = p.querySelector('#gm-aoe-save');
        if (saveEl) saveEl.addEventListener('change', () => { aoeSaveKind = saveEl.value; });
        p.querySelectorAll('[data-aoe-act]').forEach(b => b.addEventListener('click', () => {
            const act = b.dataset.aoeAct;
            if (act === 'close') { p.classList.add('hidden'); return; }
            if (act === 'roll') rollAoeSaves(p, t);
        }));
    }
    // Déclenche les sauvegardes des cibles cochées : demande aux joueurs (roll-request)
    // et lance un d20 local pour les PNJ/monstres (résultat affiché + journalisé).
    function rollAoeSaves(p, t) {
        const kind = (p.querySelector('#gm-aoe-save') || {}).value || aoeSaveKind;
        const meta = SAVE_KINDS.find(s => s[0] === kind) || SAVE_KINDS[0];
        const dcRaw = (p.querySelector('#gm-aoe-dc') || {}).value;
        const dc = dcRaw ? parseInt(dcRaw, 10) : null;
        const label = 'Sauvegarde ' + meta[1];
        const checked = Array.from(p.querySelectorAll('[data-aoe-tid]')).filter(c => c.checked);
        if (!checked.length) { if (window.showAppToast) window.showAppToast('Aucune cible cochée.', '#c0392b'); return; }
        let asked = 0, rolled = 0;
        checked.forEach(c => {
            const tok = find(state.tokens, c.dataset.aoeTid); if (!tok) return;
            const resEl = p.querySelector(`[data-aoe-res="${CSS.escape(tok.id)}"]`);
            if (tok.owner) {
                // Jeton d'un joueur → on lui demande le jet (il roule avec le mod. de SA fiche)
                gmBroadcast('roll-request', { skill: kind, label: label, dc: dc, targetUserId: tok.owner });
                asked++;
                if (resEl) resEl.textContent = '⏳ demandé';
            } else {
                // PNJ / monstre → jet automatique local (d20 nu ; le MJ ajuste au besoin)
                const r = Math.floor(Math.random() * 20) + 1;
                rolled++;
                let txt = '🎲 ' + r;
                if (dc != null) txt += (r >= dc ? ' ✅' : ' ❌');
                if (resEl) { resEl.textContent = txt; resEl.classList.toggle('is-ok', dc != null && r >= dc); resEl.classList.toggle('is-ko', dc != null && r < dc); }
                clog('🎯 ' + (tok.name || 'Jeton') + ' — ' + label + ' : ' + r + (dc != null ? (r >= dc ? ' (réussite)' : ' (échec)') : ''));
            }
        });
        const parts = [];
        if (asked) parts.push(asked + ' joueur' + (asked > 1 ? 's' : ''));
        if (rolled) parts.push(rolled + ' PNJ/monstre' + (rolled > 1 ? 's' : ''));
        clog('🎯 Gabarit — ' + label + (dc != null ? ' DD ' + dc : '') + ' → ' + parts.join(' + '));
        if (window.showAppToast) window.showAppToast('🎯 ' + label + ' demandé(e) — ' + parts.join(' + '), '#2c3e50');
    }

    function renderWeather() {
        const view = byId('gm-map-view'); if (!view) return;
        const canvas = view.querySelector('canvas.gm-layer-weather'); if (!canvas) return;
        const board = view.querySelector('.gm-board'); if (!board) return;
        if (!window.VTTWeather) return;
        window.VTTWeather.apply(canvas, (state.map && state.map.weather) || '', Math.max(1, board.clientWidth), Math.max(1, board.clientHeight));
    }
    // ----- Dangers animés (lave / poison / feu) : posés sur la carte, diffusés aux joueurs -----
    function hazardsData() { const m = state.map || {}; if (!Array.isArray(m.hazards)) m.hazards = []; return m.hazards; }
    function renderHazards() {
        const view = byId('gm-map-view'); if (!view) return;
        const canvas = view.querySelector('canvas.gm-layer-hazards'); if (!canvas) return;
        const board = view.querySelector('.gm-board'); if (!board) return;
        if (!window.VTTHazards) return;
        const list = hazardsData().concat(hazardDraft ? [hazardDraft] : []);
        window.VTTHazards.apply(canvas, list, Math.max(1, board.clientWidth), Math.max(1, board.clientHeight));
    }
    function clearHazardsConfirm() { if (!confirm('Retirer tous les dangers de cette carte ?')) return; if (state.map) state.map.hazards = []; save(); renderMap(); broadcastMap(true); }
    function eraseHazardAt(e) {
        const view = byId('gm-map-view'); const board = view && view.querySelector('.gm-board'); if (!board) return;
        const r = board.getBoundingClientRect();
        const px = e.clientX - r.left, py = e.clientY - r.top;
        const hz = hazardsData(); let bi = -1, bd = 1e9;
        hz.forEach((z, i) => { const d = Math.hypot(px - z.x * r.width, py - z.y * r.height); if (d < (z.r || 0.08) * r.width && d < bd) { bd = d; bi = i; } });
        if (bi >= 0) { hz.splice(bi, 1); save(); renderMap(); broadcastMap(true); }
    }
    // ===== ZONES SONORES SPATIALISÉES (#3, Lot 33b) =====
    // Modèle : state.map.soundZones = [{ id, x, y (centre, fractions board), r (fraction largeur = portée),
    //          url (audio partageable), name, vol (0..1 = volume max au cœur) }].
    // Côté MJ : marqueur visuel + aperçu audio local. Côté joueur : boucle audio dont le volume
    // monte quand SON jeton approche du centre (session.js).
    function soundZonesData() { const m = state.map || {}; if (!Array.isArray(m.soundZones)) m.soundZones = []; return m.soundZones; }
    function clearSoundZonesConfirm() { if (!confirm('Retirer toutes les zones sonores de cette carte ?')) return; stopSoundPreview(); if (state.map) state.map.soundZones = []; save(); renderMap(); broadcastMap(true); }
    function renderSoundZones() {
        const view = byId('gm-map-view'); if (!view) return;
        const host = view.querySelector('.gm-layer-sound'); if (!host) return;
        const board = view.querySelector('.gm-board'); if (!board) return;
        const w = Math.max(1, board.clientWidth);
        const zones = soundZonesData().concat((soundDraft && soundDraft.r > 0.01) ? [Object.assign({ id: '__draft' }, soundDraft)] : []);
        host.innerHTML = zones.map(z => {
            const rpx = (Number(z.r) || 0.15) * w, dpx = rpx * 2;
            const playing = sndPreview.id === z.id;
            const muted = z.id !== '__draft' && !z.url;
            return `<div class="gm-sound-ring${playing ? ' is-playing' : ''}" style="left:${z.x * 100}%; top:${z.y * 100}%; width:${dpx}px; height:${dpx}px;"></div>`
                + (z.id === '__draft' ? '' : `<button class="gm-sound-pin${muted ? ' is-muted' : ''}" data-sound="${z.id}" style="left:${z.x * 100}%; top:${z.y * 100}%;" title="Zone sonore${z.name ? ' — ' + esc(z.name) : ''}${muted ? ' (aucun son défini)' : ''} · clic (outil 🔊) : régler">${muted ? '🔇' : '🔊'}</button>`);
        }).join('');
    }
    function ensureSoundPopover() {
        let p = byId('gm-sound-popover'); if (p) return p;
        p = document.createElement('div'); p.id = 'gm-sound-popover'; p.className = 'gm-token-popover hidden no-print';
        document.body.appendChild(p);
        document.addEventListener('pointerdown', (e) => { if (!p.classList.contains('hidden') && !e.target.closest('#gm-sound-popover') && !e.target.closest('.gm-sound-pin')) { p.classList.add('hidden'); stopSoundPreview(); } });
        return p;
    }
    function stopSoundPreview() { if (sndPreview.el) { try { sndPreview.el.pause(); } catch (_) {} } sndPreview = { id: null, el: null }; }
    function toggleSoundPreview(z) {
        if (sndPreview.id === z.id) { stopSoundPreview(); renderSoundZones(); return; }
        stopSoundPreview();
        if (!z.url) { if (window.showAppToast) window.showAppToast('Choisis d\'abord un son (liste ou URL).', '#c0392b'); return; }
        try {
            const a = new Audio(z.url); a.loop = true; a.volume = Math.max(0, Math.min(1, z.vol != null ? Number(z.vol) : 0.8));
            const pr = a.play();
            if (pr && pr.catch) pr.catch(() => { if (window.showAppToast) window.showAppToast('Lecture impossible (URL ou format).', '#c0392b'); });
            sndPreview = { id: z.id, el: a };
        } catch (_) {}
        renderSoundZones();
    }
    function openSoundZonePopover(id, e) {
        const z = soundZonesData().find(x => x.id === id); if (!z) return;
        const p = ensureSoundPopover();
        if (z.vol == null) z.vol = 0.8;
        // Sons de la table utilisables comme source (les sons « locaux » ne sont pas diffusables aux joueurs)
        const pads = (state.soundboard || []).filter(s => s.url && !s.local);
        const padOpts = ['<option value="">— Choisir un son de la table —</option>']
            .concat(pads.map(s => `<option value="${esc(s.url)}"${z.url === s.url ? ' selected' : ''}>🔊 ${esc(s.name || 'Son')}</option>`)).join('');
        p.innerHTML = `
            <div class="gm-tp-row"><input class="gm-input" data-sp="name" value="${esc(z.name || '')}" placeholder="Nom de l'ambiance (cascade, foule…)"></div>
            <div class="gm-tp-row" title="Choisir un son importé dans l'onglet Audio (soundboard)"><label>🎵</label><select class="gm-input" data-sp="pad">${padOpts}</select></div>
            <div class="gm-tp-row" title="Ou coller une URL audio directe (.mp3, .ogg…)"><label>🔗</label><input class="gm-input" data-sp="url" value="${esc(z.url || '')}" placeholder="https://…/ambiance.mp3"></div>
            <div class="gm-tp-row"><label>🔊 Volume</label><input type="range" data-sp="vol" min="0" max="100" step="5" value="${Math.round((z.vol != null ? z.vol : 0.8) * 100)}"><b class="gm-fly-wval" data-sp-vval>${Math.round((z.vol != null ? z.vol : 0.8) * 100)}</b></div>
            <div class="gm-tp-row"><label>📏 Portée</label><input type="range" data-sp="r" min="5" max="50" step="1" value="${Math.round((z.r || 0.15) * 100)}"><b class="gm-fly-wval" data-sp-rval>${Math.round((z.r || 0.15) * 100)}</b></div>
            <div class="gm-tp-row gm-tp-actions"><button class="gm-btn" data-sp-act="preview">${sndPreview.id === z.id ? '⏹️ Stop' : '▶️ Écouter'}</button><button class="gm-btn gm-btn-danger" data-sp-act="del">🗑️ Supprimer</button></div>
            <div class="gm-tp-hint">Chaque joueur entend cette zone d'autant plus fort que SON jeton en est proche.</div>`;
        p.classList.remove('hidden');
        const ox = (e && e.clientX) || window.innerWidth / 2, oy = (e && e.clientY) || window.innerHeight / 2;
        p.style.left = Math.max(8, Math.min(ox + 10, window.innerWidth - p.offsetWidth - 8)) + 'px';
        p.style.top = Math.max(8, Math.min(oy + 10, window.innerHeight - p.offsetHeight - 8)) + 'px';
        const commit = (rerender) => { save(); if (rerender) renderMap(); broadcastMap(true); };
        p.querySelector('[data-sp="name"]').addEventListener('input', (ev) => { z.name = ev.target.value; commit(false); });
        p.querySelector('[data-sp="pad"]').addEventListener('change', (ev) => { if (ev.target.value) { z.url = ev.target.value; const u = p.querySelector('[data-sp="url"]'); if (u) u.value = z.url; commit(true); } });
        p.querySelector('[data-sp="url"]').addEventListener('change', (ev) => { z.url = ev.target.value.trim(); commit(true); });
        p.querySelector('[data-sp="vol"]').addEventListener('input', (ev) => { z.vol = Math.max(0, Math.min(1, (parseInt(ev.target.value, 10) || 0) / 100)); const v = p.querySelector('[data-sp-vval]'); if (v) v.textContent = Math.round(z.vol * 100); if (sndPreview.id === z.id && sndPreview.el) sndPreview.el.volume = z.vol; commit(false); });
        p.querySelector('[data-sp="r"]').addEventListener('input', (ev) => { z.r = Math.max(0.05, Math.min(0.5, (parseInt(ev.target.value, 10) || 15) / 100)); const v = p.querySelector('[data-sp-rval]'); if (v) v.textContent = Math.round(z.r * 100); commit(true); });
        p.querySelectorAll('[data-sp-act]').forEach(b => b.addEventListener('click', () => {
            const act = b.dataset.spAct;
            if (act === 'preview') { toggleSoundPreview(z); b.textContent = sndPreview.id === z.id ? '⏹️ Stop' : '▶️ Écouter'; }
            else if (act === 'del') { stopSoundPreview(); state.map.soundZones = soundZonesData().filter(x => x.id !== id); p.classList.add('hidden'); commit(true); }
        }));
    }

    // ----- Badges d'état sur les jetons (manuels + auto depuis les fiches joueurs) -----
    function matchCondIcon(lbl) {
        const s = String(lbl || '').toLowerCase();
        const c = CONDITIONS.find(x => s.includes(x.label.toLowerCase()));
        return c ? c.icon : '⚠️';
    }
    function tokenBadges(t) {
        let b = String(t.badges || '');
        if (t.owner) {
            const p = findLivePlayer(t.owner);
            const conds = (p && p.snapshot && p.snapshot.conditions) || [];
            b += conds.slice(0, 4).map(matchCondIcon).join('');
        }
        return b;
    }
    // Jetons envoyés aux joueurs : on EXCLUT le calque MJ (jamais transmis, même en données)
    // et on « cuit » les badges calculés côté MJ.
    function tokensForShare() { return (state.tokens || []).filter(t => tokenLayerOf(t) !== 'gm').map(t => Object.assign({}, t, { badges: tokenBadges(t) })); }
    // ----- Journal de combat -----
    function clog(text) {
        if (!Array.isArray(state.combatLog)) state.combatLog = [];
        state.combatLog.unshift({ ts: Date.now(), round: state.round || 1, text: String(text).slice(0, 200) });
        if (state.combatLog.length > 120) state.combatLog.pop();
        save(); renderCombatLog();
    }
    function renderCombatLog() {
        const el = byId('gm-combatlog'); if (!el) return;
        const rows = state.combatLog || [];
        if (!rows.length) { el.innerHTML = '<div class="gm-empty">Les évènements de la partie s\'inscriront ici (rounds, dégâts, repos, jets…).</div>'; return; }
        el.innerHTML = rows.map(r => `<div class="gm-dice-log-item"><span><span class="gm-clog-time">${new Date(r.ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} · R${r.round}</span> ${esc(r.text)}</span></div>`).join('');
    }
    // ----- Historique de la carte (Ctrl+Z) -----
    function histPush() {
        if (histLock) return;
        try {
            // Jetons BRUTS (tous calques, badges non cuits) : tokensForShare() filtrait le
            // calque MJ → un Ctrl+Z faisait disparaître les jetons MJ. (bugfix Lot 24)
            const snap = JSON.stringify({ map: state.map, tokens: state.tokens });
            if (mapHist[mapHist.length - 1] !== snap) {
                mapHist.push(snap); if (mapHist.length > 60) mapHist.shift();
                mapRedo.length = 0;                          // une nouvelle action invalide le « rétablir »
                updateUndoRedoButtons();
            }
        } catch (e) {}
    }
    function applyHistSnap(snap) {
        try {
            const prev = JSON.parse(snap);
            histLock = true;
            state.map = prev.map; state.tokens = prev.tokens;
            save(); renderMap(); broadcastMap(true);
            histLock = false;
        } catch (e) { histLock = false; }
    }
    function undoMap() {
        if (mapHist.length < 2) { if (window.showAppToast) window.showAppToast('Rien à annuler sur la carte.', '#7a6050'); return; }
        mapRedo.push(mapHist.pop());                          // l'état courant part dans « rétablir »
        applyHistSnap(mapHist[mapHist.length - 1]);
        updateUndoRedoButtons();
        if (window.showAppToast) window.showAppToast('↩️ Carte : annulé', '#2c3e50');
    }
    function redoMap() {
        if (!mapRedo.length) { if (window.showAppToast) window.showAppToast('Rien à rétablir.', '#7a6050'); return; }
        const snap = mapRedo.pop();
        mapHist.push(snap);
        applyHistSnap(snap);
        updateUndoRedoButtons();
        if (window.showAppToast) window.showAppToast('↪️ Carte : rétabli', '#2c3e50');
    }
    function updateUndoRedoButtons() {
        const u = byId('gm-undo'), r = byId('gm-redo');
        if (u) u.disabled = mapHist.length < 2;
        if (r) r.disabled = !mapRedo.length;
    }
    // ----- Aide : liste des raccourcis clavier (bouton ⌨️ / touche ?) -----
    function toggleShortcutsHelp() {
        let ov = byId('gm-shortcuts-modal');
        if (ov) { ov.remove(); return; }
        ov = document.createElement('div'); ov.id = 'gm-shortcuts-modal'; ov.className = 'gm-modal no-print';
        const rows = (window.__gmShortcuts || []).map(s => `<div class="gm-sc-row"><kbd>${esc(s[0])}</kbd><span>${esc(s[1])}</span></div>`).join('');
        ov.innerHTML = `<div class="gm-modal-box gm-sc-box">
            <div class="gm-modal-head">⌨️ Raccourcis clavier <button class="gm-modal-x" id="gm-sc-close" title="Fermer">✕</button></div>
            <div class="gm-sc-grid">${rows}</div>
            <div class="gm-readonly-note" style="margin-top:8px;">Les raccourcis d'outil ne fonctionnent pas quand tu écris dans un champ.</div>
        </div>`;
        document.body.appendChild(ov);
        const close = () => ov.remove();
        ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
        const x = byId('gm-sc-close'); if (x) x.addEventListener('click', close);
    }
    // ----- Coller une image (Ctrl+V) : fond de la carte si vide, sinon nouveau jeton -----
    function setupMapPaste() {
        document.addEventListener('paste', (e) => {
            if (!document.body.classList.contains('gm-active')) return;
            const tag = (document.activeElement && document.activeElement.tagName || '').toLowerCase();
            if (tag === 'input' || tag === 'textarea' || (document.activeElement && document.activeElement.isContentEditable)) return;
            const items = (e.clipboardData && e.clipboardData.items) || [];
            let file = null;
            for (const it of items) { if (it.type && it.type.indexOf('image') === 0) { file = it.getAsFile(); break; } }
            if (!file) return;
            e.preventDefault();
            fileToDataURL(file, async (data) => {
                let url = data;
                try { const res = await window.SupaAuth.uploadAsset(file, 'maps'); if (res && res.url) url = res.url; } catch (_) {}
                if (!state.map.bg) {                                 // carte vide → l'image devient le fond
                    state.map.bg = url; save(); renderMap(); broadcastMap(true);
                    if (window.showAppToast) window.showAppToast('🖼️ Image collée comme fond de carte', '#2c3e50');
                } else {                                             // sinon → jeton image au centre de la vue
                    state.tokens.push({ id: uid(), name: 'Image', type: 'npc', img: url, x: 0.5, y: 0.5 });
                    save(); renderMap(); broadcastMap(true);
                    if (window.showAppToast) window.showAppToast('🖼️ Image collée comme jeton', '#2c3e50');
                }
            });
        });
    }
    // ----- Points de sauvegarde de la campagne -----
    function snapsKey() { return 'dnd-gm-snapshots-' + activeCampaignId; }
    function loadSnaps() { try { return JSON.parse(localStorage.getItem(snapsKey()) || '[]'); } catch (e) { return []; } }
    function saveSnaps(list) { try { localStorage.setItem(snapsKey(), JSON.stringify(list)); } catch (e) { if (window.showAppToast) window.showAppToast('⚠️ Stockage plein — supprime d\'anciens points de sauvegarde.', '#c0392b'); } }
    function createSnap() {
        const list = loadSnaps();
        list.unshift({ id: uid(), ts: Date.now(), state: JSON.parse(JSON.stringify(state)) });
        while (list.length > 8) list.pop();
        saveSnaps(list); renderSnaps();
        if (window.showAppToast) window.showAppToast('💾 Point de sauvegarde créé', '#2c3e50');
    }
    function renderSnaps() {
        const el = byId('gm-snap-list'); if (!el) return;
        const list = loadSnaps();
        if (!list.length) { el.innerHTML = '<div class="gm-empty">Aucun point de sauvegarde.</div>'; return; }
        el.innerHTML = list.map(s => `<div class="gm-snap-row">
            <span class="gm-snap-label">🕓 ${new Date(s.ts).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</span>
            <button class="gm-btn" data-act="snap-restore" data-id="${s.id}" title="Restaurer cet état">↩</button>
            <button class="gm-del-x" data-act="snap-del" data-id="${s.id}" title="Supprimer">✕</button>
        </div>`).join('');
    }
    // ----- Minuteur partagé (MJ + joueurs) -----
    let gmTimerInt = null;
    function showGmTimer(until) {
        let el = byId('gm-timer-pill');
        clearInterval(gmTimerInt);
        if (!until || until <= Date.now()) { if (el) el.remove(); return; }
        if (!el) { el = document.createElement('div'); el.id = 'gm-timer-pill'; el.className = 'no-print'; document.body.appendChild(el); }
        const tick = () => {
            const left = until - Date.now();
            if (left <= 0) { clearInterval(gmTimerInt); el.remove(); if (window.showAppToast) window.showAppToast('⏰ Temps écoulé !', '#c0392b'); return; }
            const s = Math.ceil(left / 1000);
            el.textContent = '⏳ ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
            el.classList.toggle('is-low', s <= 10);
        };
        tick(); gmTimerInt = setInterval(tick, 500);
    }

    // ----- Réglage d'une porte (verrou / secrète) -----
    function ensureDoorPopover() {
        let p = byId('gm-door-popover'); if (p) return p;
        p = document.createElement('div'); p.id = 'gm-door-popover'; p.className = 'gm-token-popover hidden no-print';
        document.body.appendChild(p);
        document.addEventListener('pointerdown', (e) => { if (!p.classList.contains('hidden') && !e.target.closest('#gm-door-popover') && !e.target.closest('.gm-door-btn')) p.classList.add('hidden'); });
        return p;
    }
    function openDoorPopover(id, e) {
        const d = wallsData().find(w => w.id === id); if (!d) return;
        const p = ensureDoorPopover();
        p.innerHTML = `
            <div class="gm-tp-row"><b>🚪 Réglage de la porte</b></div>
            <div class="gm-tp-row gm-tp-actions"><button class="gm-btn" data-dp-act="toggle">${d.open ? '🚪 Fermer' : '🚪 Ouvrir'}</button></div>
            <label class="gm-dp-check"><input type="checkbox" data-dp="locked" ${d.locked ? 'checked' : ''}> 🔒 Verrouillée (les joueurs ne peuvent pas l'ouvrir)</label>
            <label class="gm-dp-check"><input type="checkbox" data-dp="secret" ${d.secret ? 'checked' : ''}> 👁️‍🗨️ Secrète (invisible pour les joueurs)</label>
            <div class="gm-tp-row gm-tp-actions"><button class="gm-btn gm-btn-danger" data-dp-act="del">🗑️ Supprimer la porte</button></div>`;
        p.classList.remove('hidden');
        const ox = (e && e.clientX) || window.innerWidth / 2, oy = (e && e.clientY) || window.innerHeight / 2;
        p.style.left = Math.max(8, Math.min(ox + 10, window.innerWidth - p.offsetWidth - 8)) + 'px';
        p.style.top = Math.max(8, Math.min(oy + 10, window.innerHeight - p.offsetHeight - 8)) + 'px';
        p.querySelector('[data-dp="locked"]').addEventListener('change', (ev) => { d.locked = ev.target.checked; save(); renderMap(); broadcastMap(true); });
        p.querySelector('[data-dp="secret"]').addEventListener('change', (ev) => { d.secret = ev.target.checked; save(); renderMap(); broadcastMap(true); });
        p.querySelector('[data-dp-act="toggle"]').addEventListener('click', () => { d.open = !d.open; save(); renderMap(); broadcastMap(true); p.classList.add('hidden'); });
        p.querySelector('[data-dp-act="del"]').addEventListener('click', () => { state.map.walls = wallsData().filter(w => w.id !== id); p.classList.add('hidden'); save(); renderMap(); broadcastMap(true); });
    }
    // Aperçu MJ de l'obscurité : voile semi-transparent percé de la vision des jetons joueurs.
    function renderVisionPreview() {
        const view = byId('gm-map-view'); if (!view) return;
        const canvas = view.querySelector('canvas.gm-layer-vision'); if (!canvas) return;
        const content = view.querySelector('.gm-board'); if (!content) return;
        const dark = (state.map && state.map.dark) || null;
        if (!mapView.visionPreview || !dark || !dark.on || !window.VTTGeo) { canvas.style.display = 'none'; return; }
        canvas.style.display = 'block';
        const w = Math.max(1, content.clientWidth), h = Math.max(1, content.clientHeight);
        if (canvas.width !== w) canvas.width = w;
        if (canvas.height !== h) canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(6,4,2,0.72)';                       // semi-opaque : le MJ garde ses repères
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'destination-out';
        const segs = window.VTTGeo.wallsToPx((state.map && state.map.walls) || [], w, h);
        const g = Math.max(1, gridPxFor(w));                     // px d'une case sur CE board
        const dk = Object.assign({}, dark, { cellM: cellMeters() });
        const erase = window.VTTGeo.eraseVisionSoft || window.VTTGeo.eraseVision;   // même rendu doux que côté joueur
        const pjToks = (state.tokens || []).filter(t => !t.hidden && (t.type === 'pj' || t.owner));
        pjToks.forEach(t => {
            erase(ctx, t.x * w, t.y * h, segs, window.VTTGeo.visionRadiusPx(t, dk, g));
        });
        eraseLights(ctx, w, h, segs, pjToks);                    // les lumières éclairent aussi (si en vue des PJ)
        ctx.globalCompositeOperation = 'source-over';
    }
    // Règle : trait + étiquette de distance (1 case = 1,5 m), locale au MJ.
    function renderRuler() {
        const view = byId('gm-map-view'); if (!view) return;
        const canvas = view.querySelector('canvas.gm-layer-ruler'); if (!canvas) return;
        const content = view.querySelector('.gm-board'); if (!content) return;
        const w = Math.max(1, content.clientWidth), h = Math.max(1, content.clientHeight);
        if (canvas.width !== w) canvas.width = w;
        if (canvas.height !== h) canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, w, h);
        if (!rulerDraft || !rulerDraft.pts || !rulerDraft.pts.length) return;
        // Chaîne de points + segment élastique jusqu'au curseur (chemin coudé)
        const nodes = rulerDraft.pts.concat(rulerDraft.cur ? [rulerDraft.cur] : []).map(p => [p.x * w, p.y * h]);
        ctx.strokeStyle = '#C49B35'; ctx.lineWidth = 3; ctx.setLineDash([8, 6]); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); nodes.forEach((n, i) => i === 0 ? ctx.moveTo(n[0], n[1]) : ctx.lineTo(n[0], n[1])); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#C49B35';
        nodes.forEach(n => { ctx.beginPath(); ctx.arc(n[0], n[1], 4, 0, Math.PI * 2); ctx.fill(); });
        const g = Math.max(1, gridPxFor(w));
        let cells = 0;
        for (let i = 1; i < nodes.length; i++) cells += Math.hypot(nodes[i][0] - nodes[i - 1][0], nodes[i][1] - nodes[i - 1][1]) / g;
        const label = (Math.round(cells * cellMeters() * 10) / 10).toLocaleString('fr-FR') + ' m (' + (Math.round(cells * 10) / 10).toLocaleString('fr-FR') + ' cases)' + (rulerDraft.pts.length > 1 ? ' ⟿' : '');
        ctx.font = 'bold 14px Lora, serif';
        const tw = ctx.measureText(label).width;
        const endN = nodes[nodes.length - 1];
        const mx = endN[0], my = endN[1] - 16;
        const bx = Math.max(4, Math.min(w - tw - 16, mx - tw / 2 - 6));
        ctx.fillStyle = 'rgba(20,14,8,0.85)';
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(bx, my - 15, tw + 12, 22, 6) : ctx.rect(bx, my - 15, tw + 12, 22); ctx.fill();
        ctx.fillStyle = '#f3e3bb';
        ctx.fillText(label, bx + 6, my + 1);
    }
    // Vitesse d'un jeton en mètres (t.speed sinon 9 m = 6 cases, valeur 5e par défaut).
    function tokenSpeed(t) { return Math.max(1.5, Number(t && t.speed) || 9); }
    // Jeton sous un point (fraction) — pour accrocher la ligne de vue aux combattants.
    function tokenAtFraction(fx, fy) {
        const view = byId('gm-map-view'); const content = view && view.querySelector('.gm-board'); if (!content) return null;
        const w = Math.max(1, content.clientWidth), h = Math.max(1, content.clientHeight);
        const gpx = Math.max(6, gridPxFor(w));
        let best = null, bd = 1e9;
        (state.tokens || []).forEach(t => {
            const rad = gpx * (Number(t.size) || 1) * 0.5 + 4;
            const d = Math.hypot((t.x - fx) * w, (t.y - fy) * h);
            if (d < rad && d < bd) { bd = d; best = t; }
        });
        return best;
    }
    // Ligne de vue / couverture (Lot 34b) : dessine A→B et indique si des murs bloquent.
    // 5 rayons (centre + 4 décalés d'une demi-case perpendiculaire) → estime la couverture.
    function renderLos() {
        const view = byId('gm-map-view'); if (!view) return;
        const canvas = view.querySelector('canvas.gm-layer-ruler'); if (!canvas) return;
        const content = view.querySelector('.gm-board'); if (!content) return;
        const w = Math.max(1, content.clientWidth), h = Math.max(1, content.clientHeight);
        if (canvas.width !== w) canvas.width = w;
        if (canvas.height !== h) canvas.height = h;
        const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, w, h);
        if (!losA) return;
        ctx.fillStyle = '#C49B35';
        ctx.beginPath(); ctx.arc(losA.x * w, losA.y * h, 5, 0, Math.PI * 2); ctx.fill();
        if (!losB) { return; }
        const segs = window.VTTGeo ? window.VTTGeo.wallsToPx((state.map && state.map.walls) || [], w, h) : [];
        const ax = losA.x * w, ay = losA.y * h, bx = losB.x * w, by = losB.y * h;
        // Vecteur perpendiculaire (demi-case) pour tester les côtés de la cible
        const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
        const g = Math.max(1, gridPxFor(w)) * 0.45;
        const px = -dy / len * g, py = dx / len * g;
        const rays = [[0, 0], [px, py], [-px, -py], [px * 0.5, py * 0.5], [-px * 0.5, -py * 0.5]];
        let blockedCount = 0;
        rays.forEach(o => { if (window.VTTGeo && window.VTTGeo.moveBlockedPx ? window.VTTGeo.moveBlockedPx(ax, ay, bx + o[0], by + o[1], segs) : false) blockedCount++; });
        const clear = blockedCount === 0;
        const total = blockedCount >= rays.length;
        const col = clear ? '#57a64a' : (total ? '#e23b3b' : '#d68a2b');
        ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.setLineDash(clear ? [] : [7, 5]); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = col;
        [[ax, ay], [bx, by]].forEach(pt => { ctx.beginPath(); ctx.arc(pt[0], pt[1], 5, 0, Math.PI * 2); ctx.fill(); });
        const who = (losA.name || losB.name) ? ((losA.name || 'point') + ' → ' + (losB.name || 'point') + ' · ') : '';
        const label = who + (clear ? '👁️ Vue dégagée' : (total ? '🚫 Bloqué (couvert total)' : '🛡️ À couvert (' + (blockedCount >= 3 ? '¾' : '½') + ')'));
        ctx.font = 'bold 13px Lora, serif';
        const tw = ctx.measureText(label).width;
        const mx = (ax + bx) / 2, my = (ay + by) / 2 - 16;
        const bxp = Math.max(4, Math.min(w - tw - 16, mx - tw / 2 - 6));
        ctx.fillStyle = 'rgba(20,14,8,0.85)';
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(bxp, my - 15, tw + 12, 22, 6) : ctx.rect(bxp, my - 15, tw + 12, 22); ctx.fill();
        ctx.fillStyle = '#f3e3bb'; ctx.fillText(label, bxp + 6, my + 1);
    }
    // Déplacement mesuré (Lot 34) : trait + distance parcourue pendant le drag d'un jeton,
    // coloré selon le budget de vitesse (vert = dans la vitesse, orange = jusqu'au x2 « Foncer », rouge = au-delà).
    function renderMoveMeasure() {
        const view = byId('gm-map-view'); if (!view) return;
        const canvas = view.querySelector('canvas.gm-layer-ruler'); if (!canvas) return;
        const content = view.querySelector('.gm-board'); if (!content) return;
        const w = Math.max(1, content.clientWidth), h = Math.max(1, content.clientHeight);
        if (canvas.width !== w) canvas.width = w;
        if (canvas.height !== h) canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, w, h);
        if (!moveMeasure) return;
        const x1 = moveMeasure.x1 * w, y1 = moveMeasure.y1 * h, x2 = moveMeasure.x2 * w, y2 = moveMeasure.y2 * h;
        const g = Math.max(1, gridPxFor(w));
        const cells = Math.hypot(x2 - x1, y2 - y1) / g;
        const meters = cells * cellMeters();
        const spd = moveMeasure.speed || 9;
        const col = meters <= spd + 1e-6 ? '#57a64a' : (meters <= spd * 2 + 1e-6 ? '#d68a2b' : '#e23b3b');
        ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.setLineDash([8, 6]); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = col;
        [[x1, y1], [x2, y2]].forEach(pt => { ctx.beginPath(); ctx.arc(pt[0], pt[1], 4, 0, Math.PI * 2); ctx.fill(); });
        const tag = meters <= spd + 1e-6 ? '' : (meters <= spd * 2 + 1e-6 ? ' ⚡Foncer' : ' 🚫');
        const label = (Math.round(meters * 10) / 10).toLocaleString('fr-FR') + ' m / ' + spd + ' m' + tag;
        ctx.font = 'bold 13px Lora, serif';
        const tw = ctx.measureText(label).width;
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - 16;
        const bx = Math.max(4, Math.min(w - tw - 16, mx - tw / 2 - 6));
        ctx.fillStyle = 'rgba(20,14,8,0.85)';
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(bx, my - 15, tw + 12, 22, 6) : ctx.rect(bx, my - 15, tw + 12, 22); ctx.fill();
        ctx.fillStyle = '#f3e3bb';
        ctx.fillText(label, bx + 6, my + 1);
    }

    // ----- Dessin libre (couche partagée) + Notes MJ (couche privée) -----
    function drawData() { const m = state.map || {}; if (!Array.isArray(m.drawings)) m.drawings = []; return m.drawings; }
    function gmNotesData() { const m = state.map || {}; if (!Array.isArray(m.gmNotes)) m.gmNotes = []; return m.gmNotes; }
    function paintStrokes(ctx, w, h, strokes) {
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        (strokes || []).forEach(s => {
            if (!s.pts || !s.pts.length) return;
            ctx.strokeStyle = s.color || '#e23b3b'; ctx.lineWidth = s.width || 3;
            ctx.beginPath();
            s.pts.forEach((p, i) => { const px = p.x * w, py = p.y * h; i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); });
            if (s.pts.length === 1) ctx.lineTo(s.pts[0].x * w + 0.5, s.pts[0].y * h + 0.5);
            ctx.stroke();
        });
    }
    function renderStrokeLayer(cls, strokes) {
        const view = byId('gm-map-view'); if (!view) return;
        const canvas = view.querySelector(cls); if (!canvas) return;
        const content = view.querySelector('.gm-board'); if (!content) return;
        const w = Math.max(1, content.clientWidth), h = Math.max(1, content.clientHeight);
        if (canvas.width !== w) canvas.width = w;
        if (canvas.height !== h) canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, w, h);
        paintStrokes(ctx, w, h, strokes);
    }
    function renderDraw() { renderStrokeLayer('.gm-layer-draw', (state.map && state.map.drawings) || []); }
    function renderGmNotes() { renderStrokeLayer('.gm-layer-gmnotes', (state.map && state.map.gmNotes) || []); }
    function clearDrawings() { if (state.map) state.map.drawings = []; save(); renderMap(); broadcastMap(true); if (window.showAppToast) window.showAppToast('🧽 Dessins effacés', '#2c3e50'); }
    function showGmMapPing(x, y, color) {
        const view = byId('gm-map-view'); const content = view && view.querySelector('.gm-board'); if (!content) return;
        const p = document.createElement('div'); p.className = 'gm-map-ping';
        p.style.left = (x * 100) + '%'; p.style.top = (y * 100) + '%';
        p.style.setProperty('--ping', color || pingColor);
        content.appendChild(p); setTimeout(() => p.remove(), 2200);
    }

    function renderMap() {
        const view = byId('gm-map-view'); if (!view) return;
        const m = state.map || {};
        migrateMapRef(m, view);                              // anciennes cartes → modèle « board »
        ensureTokenLayers();                                 // fige t.layer (Carte/MJ/PJ) + resync t.hidden
        const L = mapView.layers || {}, OP = mapView.layerOp || {};
        const layStyle = (k) => { let s = ''; if (L[k] === false) s += 'display:none;'; const o = OP[k]; if (o != null && o !== 1) s += 'opacity:' + o + ';'; return s ? ` style="${s}"` : ''; };
        // ===== BOARD : plateau à ratio FIXE, letterboxé — même géométrie chez les joueurs =====
        // (les fractions x/y sont relatives au board, pas à la fenêtre → les murs restent
        //  alignés avec l'image quel que soit l'écran : fix du « on voit à travers les murs »)
        const vw = Math.max(1, view.clientWidth), vh = Math.max(1, view.clientHeight);
        const AR = Number(m.stageAR) || (16 / 9);
        let bw = Math.min(vw, vh * AR), bh = bw / AR;
        boardWpx = bw;
        const tokens = (state.tokens || []).map(tokenHtml).join('');
        view.innerHTML = `<div class="gm-map-content"><div class="gm-board" style="left:${(vw - bw) / 2}px; top:${(vh - bh) / 2}px; width:${bw}px; height:${bh}px;"><div class="gm-layer gm-layer-lights"></div><canvas class="gm-layer gm-layer-hazards"></canvas><div class="gm-layer gm-layer-tokens"${layStyle('tokens')}>${tokens}</div><canvas class="gm-layer gm-layer-draw"${layStyle('draw')}></canvas><canvas class="gm-layer gm-layer-templates"></canvas><canvas class="gm-layer gm-layer-weather"></canvas><canvas class="gm-layer gm-layer-fog"${layStyle('fog')}></canvas><canvas class="gm-layer gm-layer-vision"></canvas><canvas class="gm-layer gm-layer-walls"${layStyle('walls')}></canvas><canvas class="gm-layer gm-layer-gmnotes"${layStyle('gmnotes')}></canvas><div class="gm-layer gm-layer-doors gm-layer-walls"${layStyle('walls')}></div><div class="gm-layer gm-layer-sound"></div><canvas class="gm-layer gm-layer-ruler"></canvas><div class="gm-layer gm-layer-daynight"></div><div class="gm-layer gm-layer-tint"></div></div></div>`;
        const board = view.querySelector('.gm-board');
        const tintEl = board.querySelector('.gm-layer-tint'); if (tintEl) tintEl.style.background = m.tint || 'transparent';
        const dnEl = board.querySelector('.gm-layer-daynight'); if (dnEl) dnEl.style.background = ((m.dayNight && m.dayNight.on) ? dayNightTint(m.dayNight.time == null ? 12 : m.dayNight.time) : '') || 'transparent';
        const f = bw / 1000;                                 // facteur px de référence → px affichés
        board.style.backgroundImage = m.bg ? `url(${m.bg})` : 'none';
        const bx = (m.bgX || 0) * f, by = (m.bgY || 0) * f, bs = Number(m.bgScale) || 1;
        board.style.backgroundPosition = `calc(50% + ${bx}px) calc(50% + ${by}px)`;
        board.style.backgroundSize = (bs === 1) ? 'contain' : (bs * 100) + '%';
        board.classList.toggle('show-grid', m.showGrid !== false && L.grid !== false);
        const gsz = Math.max(4, gridPxFor(bw));
        board.style.setProperty('--gm-grid', gsz + 'px');
        // Débord de grille = multiple exact de la case (≥ ~4000px) pour couvrir le viewport à tout zoom
        board.style.setProperty('--gm-grid-ext', (Math.ceil(4000 / gsz) * gsz) + 'px');
        board.style.setProperty('--gm-grid-op', OP.grid == null ? 1 : OP.grid);
        applyMapTransform();
        renderTemplates();
        renderHazards();
        renderWeather();
        renderDraw();
        renderGmNotes();
        renderLights();
        renderSoundZones();
        if (L.fog !== false) renderFog();
        if (L.walls !== false) renderWalls();
        renderVisionPreview();
        renderRuler();
        if (losA) renderLos();                              // ligne de vue : persiste au re-render
        const paintTools = ['reveal', 'cover', 'draw', 'gmnote', 'bg', 'wall', 'door', 'dooredit', 'wallerase', 'ruler', 'light', 'placetoken', 'placecombatant', 'aoe', 'aoeerase', 'hazard', 'hazarderase', 'sound', 'los'];
        view.classList.toggle('gm-tool-paint', paintTools.indexOf(mapTool) !== -1);
        view.classList.toggle('gm-tool-grab', mapTool === 'pan');
        view.classList.toggle('gm-tool-move', mapTool === 'objmove');
        const gi = byId('gm-map-grid'); if (gi && document.activeElement !== gi) gi.value = m.gridSize || 48;
        const sg = byId('gm-map-showgrid'); if (sg) sg.checked = m.showGrid !== false;
        renderMapBank();
        renderMapPages();
        if (placeQueue.length) renderPlaceBar();              // la barre « placer » survit aux re-rendus
        renderLayerSwitch();                                  // sélecteur de calque (Carte/MJ/PJ) sur la carte
    }
    // Sélecteur de calque d'objets flottant (haut-gauche de la carte), façon Roll20.
    function renderLayerSwitch() {
        const host = byId('gm-map-view'); if (!host) return;
        let bar = byId('gm-layer-switch');
        if (!bar) { bar = document.createElement('div'); bar.id = 'gm-layer-switch'; bar.className = 'gm-layer-switch no-print'; host.appendChild(bar); }
        const gmCount = (state.tokens || []).filter(t => tokenLayerOf(t) === 'gm').length;
        bar.innerHTML = `<span class="gm-lsw-lbl">Calque</span>`
            + OBJ_LAYERS.map(d => `<button class="gm-lsw-btn${mapView.activeLayer === d.key ? ' is-on' : ''}" data-layer="${d.key}" title="${d.tip}">${d.icon}<span>${d.label}</span>${d.key === 'gm' && gmCount ? `<b class="gm-lsw-badge">${gmCount}</b>` : ''}</button>`).join('')
            + (gmCount ? `<button class="gm-lsw-reveal" data-reveal="1" title="Montrer aux joueurs tous les jetons du calque MJ">👁️ Tout révéler</button>` : '');
        bar.querySelectorAll('[data-layer]').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); setActiveLayer(b.dataset.layer); }));
        const rv = bar.querySelector('[data-reveal]'); if (rv) rv.addEventListener('click', (e) => { e.stopPropagation(); revealAllGmTokens(); });
    }
    // Aimante une position (fraction 0..1) au centre de la case de grille la plus proche.
    function snapFraction(x, y) {
        const m = state.map || {}; if (!m.snap) return { x, y };
        // Modèle board : 1 case = gridSize/1000 en fraction de largeur (× ratio pour la hauteur)
        const cw = (m.gridSize || 48) / 1000;
        const ch = cw * (Number(m.stageAR) || (16 / 9));
        const sx = (Math.floor(x / cw) + 0.5) * cw, sy = (Math.floor(y / ch) + 0.5) * ch;
        return { x: Math.max(0, Math.min(1, sx)), y: Math.max(0, Math.min(1, sy)) };
    }
    // ----- Bulle contextuelle d'un jeton (PV / CA / nom / image / couleur / caché) -----
    function setTokenField(id, field, value) {
        const t = find(state.tokens, id); if (!t) return;
        if (field === 'hp' || field === 'hpMax' || field === 'ac') t[field] = (value === '' ? null : (parseInt(value, 10) || 0));
        else if (field === 'size') t.size = parseFloat(value) || 1;
        else if (field === 'vision') t.vision = (value === '' ? null : Math.max(0, parseFloat(value) || 0));   // portée de vision propre (m), vide = réglage global
        else if (field === 'speed') t.speed = (value === '' ? null : Math.max(0, parseFloat(value) || 0));     // vitesse de déplacement (m), vide = 9 m par défaut
        else if (field === 'auraR') { if (!t.aura) t.aura = {}; t.aura.r = Math.max(0, parseFloat(value) || 0); if (!t.aura.r) t.aura = null; }
        else if (field === 'auraColor') { if (!t.aura) t.aura = { r: 3 }; t.aura.color = value; }
        else if (field === 'badges') t.badges = String(value || '').slice(0, 12);
        else if (field === 'owner') { t.owner = value || null; if (t.owner && !t.ref) t.ref = 'pj:' + t.owner; }
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
            <div class="gm-tp-row" title="Assigner ce jeton à un joueur : il devient SON jeton (il peut le déplacer)."><label>🔗</label><select class="gm-input" data-tp="owner"><option value="">— libre / MJ —</option>${(live.players || []).map(pl => { const s = pl.snapshot || {}; const nm = s.name || pl.character_name || 'Joueur'; return `<option value="${pl.user_id}"${tok.owner === pl.user_id ? ' selected' : ''}>${esc(nm)}</option>`; }).join('')}</select></div>
            <div class="gm-tp-row" title="Distance de vision de CE jeton dans le noir (torche, vision dans le noir…). Vide = réglage global de la carte."><label>🌑</label><input class="gm-input gm-num" type="number" min="0" step="1.5" data-tp="vision" value="${tok.vision != null ? tok.vision : ''}" placeholder="Vision (m)"><span class="gm-tp-sep">m</span><label title="Vitesse de déplacement (pour la mesure au drag). Vide = 9 m.">🏃</label><input class="gm-input gm-num" type="number" min="0" step="1.5" data-tp="speed" value="${tok.speed != null ? tok.speed : ''}" placeholder="Vit."><span class="gm-tp-sep">m</span></div>
            <div class="gm-tp-row" title="Aura autour du jeton (rayon en mètres) — visible par tous"><label>🌀</label><input class="gm-input gm-num" type="number" min="0" step="1.5" data-tp="auraR" value="${tok.aura && tok.aura.r ? tok.aura.r : ''}" placeholder="Aura (m)"><span class="gm-tp-sep">m</span><input class="gm-tp-color" type="color" data-tp="auraColor" value="${(tok.aura && tok.aura.color) || '#3498db'}" title="Couleur de l'aura"></div>
            <div class="gm-tp-row" title="Badges d'état affichés sur le jeton (emojis) — les états de la fiche du joueur s'ajoutent automatiquement"><label>🏷️</label><input class="gm-input" data-tp="badges" value="${esc(tok.badges || '')}" placeholder="🤢💤… (états manuels)"></div>
            <div class="gm-tp-row" title="Dégâts / soins rapides"><label>⚔️</label><input class="gm-input gm-num" type="number" min="1" data-tp-amt placeholder="X"><button class="gm-btn gm-btn-danger" data-tp-act="dmg" title="Infliger X dégâts">💥</button><button class="gm-btn" data-tp-act="heal" title="Soigner X PV">💚</button></div>
            <div class="gm-tp-row"><input class="gm-input" data-tp="img" value="${esc(tok.img || '')}" placeholder="URL image…"><label class="gm-btn gm-tp-upload" title="Importer une image">🖼️<input type="file" accept="image/*" data-tp="imgfile" style="display:none;"></label><input class="gm-tp-color" type="color" data-tp="color" value="${color}" title="Couleur"></div>
            <div class="gm-tp-row gm-tp-layer" title="Calque du jeton (façon Roll20). MJ = invisible aux joueurs ; PJ = visible. Transférer = déplacer d'un calque à l'autre."><label>🗂️</label>${OBJ_LAYERS.map(d => `<button class="gm-tp-lbtn${tokenLayerOf(tok) === d.key ? ' is-on' : ''}" data-tp-layer="${d.key}" title="${d.tip}">${d.icon} ${d.label}</button>`).join('')}</div>
            <div class="gm-tp-row gm-tp-actions">${tokenUndoPos[tok.id] ? '<button class="gm-btn" data-tp-act="undomove" title="Remettre le jeton là où il était avant son dernier déplacement">↩️ Position précédente</button>' : ''}<button class="gm-btn gm-btn-danger" data-tp-act="del">🗑️ Supprimer</button></div>`;
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
        p.querySelectorAll('[data-tp-layer]').forEach(b => b.addEventListener('click', () => {
            setTokenLayer(tok.id, b.dataset.tpLayer);
            p.querySelectorAll('[data-tp-layer]').forEach(x => x.classList.toggle('is-on', x === b));
        }));
        p.querySelectorAll('[data-tp-act]').forEach(b => b.addEventListener('click', () => {
            const t = find(state.tokens, tok.id); if (!t) return;
            const act = b.dataset.tpAct;
            if (act === 'del') { state.tokens = state.tokens.filter(x => x.id !== tok.id); p.classList.add('hidden'); }
            else if (act === 'undomove') {
                const u = tokenUndoPos[t.id];
                if (u) { t.x = u.x; t.y = u.y; delete tokenUndoPos[t.id]; p.classList.add('hidden'); if (window.showAppToast) window.showAppToast('↩️ ' + (t.name || 'Jeton') + ' remis à sa position précédente', '#2c3e50'); }
            }
            else if (act === 'dmg' || act === 'heal') {
                const amtEl = p.querySelector('[data-tp-amt]');
                const amt = Math.abs(parseInt(amtEl && amtEl.value, 10)) || 1;
                const max = Number(t.hpMax);
                let hp = Number(t.hp); if (isNaN(hp)) hp = isNaN(max) ? 0 : max;
                hp = act === 'dmg' ? Math.max(0, hp - amt) : (isNaN(max) ? hp + amt : Math.min(max, hp + amt));
                t.hp = hp;
                const hpInp = p.querySelector('[data-tp="hp"]'); if (hpInp) hpInp.value = hp;
                clog((act === 'dmg' ? '💥 ' : '💚 ') + (t.name || 'Jeton') + (act === 'dmg' ? ' subit ' : ' récupère ') + amt + ' PV → ' + hp + (isNaN(max) ? '' : '/' + max));
            }
            save(); renderMap(); broadcastMap(true);
        }));
    }
    function renderMapBank() {
        const sel = byId('gm-map-bank'); if (!sel) return;
        const maps = (tree || []).filter(n => n.kind === 'map' && n.data && n.data.url);
        const prev = sel.value;
        sel.innerHTML = '<option value="">— Choisir une carte préparée —</option>' + maps.map(n => `<option value="${n.id}">🗺️ ${esc(n.name)}</option>`).join('');
        if (prev && sel.querySelector(`option[value="${prev}"]`)) sel.value = prev;
    }
    function renderSharedImagePicker() {
        const sel = byId('gm-showimg-prepared'); if (!sel) return;
        const imgs = (tree || []).filter(n => n.kind === 'image' && n.data && n.data.url);
        const prev = sel.value;
        sel.innerHTML = '<option value="">— Image préparée —</option>' + imgs.map(n => `<option value="${n.id}">🖼️ ${esc(n.name)}</option>`).join('');
        if (prev && sel.querySelector(`option[value="${prev}"]`)) sel.value = prev;
    }
    // Copie de la carte à diffuser aux joueurs : on retire le calque privé « Notes MJ ».
    function mapForShare() { const m = state.map || {}; const c = {}; for (const k in m) if (k !== 'gmNotes') c[k] = m[k]; return c; }
    function broadcastMap(persist) {
        if (live.presChannel) gmBroadcast('map', { map: mapForShare(), tokens: tokensForShare() });
        if (persist && state.sessionId && window.SupaAuth) { try { window.SupaAuth.saveSessionState(state.sessionId, { map: mapForShare(), tokens: tokensForShare() }); } catch (e) {} }
    }
    function throttleBroadcastMap() {
        const now = Date.now();
        if (now - mapThrottle < 70) return;
        mapThrottle = now;
        if (live.presChannel) gmBroadcast('map', { map: mapForShare(), tokens: tokensForShare() });
    }
    // « Placer les combattants » : on choisit QUI (barre du bas) et OÙ (clic sur la carte).
    let placeSelIdx = 0;
    function startPlaceCombatants() {
        const q = [];
        (live.players || []).forEach(p => { const s = p.snapshot || {}; const ref = 'pj:' + p.user_id; if (!state.tokens.find(t => t.ref === ref)) q.push({ name: s.name || p.character_name || 'PJ', type: 'pj', ref, owner: p.user_id, img: (s && s.tokenImg) || null }); });
        (state.monsters || []).forEach(m => { const ref = 'mon:' + m.id; if (!state.tokens.find(t => t.ref === ref)) q.push({ name: m.name, type: 'monster', ref, owner: null }); });
        if (!q.length) { if (window.showAppToast) window.showAppToast('Tous les combattants sont déjà sur la carte.', '#7a6050'); return; }
        placeQueue = q; placeSelIdx = 0;
        setMapTool('placecombatant');
        renderPlaceBar();
        if (window.showAppToast) window.showAppToast('👆 Choisis qui (barre du bas) puis clique la carte pour le poser', '#2c3e50');
    }
    function placeNextCombatant(x, y) {
        if (!placeQueue.length) return;
        const idx = Math.min(placeSelIdx, placeQueue.length - 1);
        const c = placeQueue[idx];
        const spot = spreadFreeSpot(x, y);
        state.tokens.push({ id: uid(), ref: c.ref, name: c.name, type: c.type, owner: c.owner || null, img: c.img || null, x: spot.x, y: spot.y });
        placeQueue.splice(idx, 1);
        if (placeSelIdx >= placeQueue.length) placeSelIdx = Math.max(0, placeQueue.length - 1);
        save(); renderMap(); broadcastMap(true);
        if (!placeQueue.length) { removePlaceBar(); setMapTool('select'); if (window.showAppToast) window.showAppToast('✅ Tous les combattants sont placés', '#2c3e50'); }
        else renderPlaceBar();
    }
    function removePlaceBar() { const b = byId('gm-place-bar'); if (b) b.remove(); placeQueue = []; }
    function renderPlaceBar() {
        let bar = byId('gm-place-bar');
        if (!placeQueue.length) { if (bar) bar.remove(); return; }
        const host = byId('gm-map-view'); if (!host) return;
        if (!bar) { bar = document.createElement('div'); bar.id = 'gm-place-bar'; bar.className = 'gm-place-bar no-print'; host.appendChild(bar); }
        bar.innerHTML = `<span class="gm-place-lbl">À placer — clique un nom puis la carte :</span>`
            + placeQueue.map((c, i) => `<button class="gm-place-chip${i === placeSelIdx ? ' is-on' : ''}" data-pq="${i}">${c.type === 'monster' ? '👹' : '🧝'} ${esc(c.name)}</button>`).join('')
            + `<button class="gm-place-chip gm-place-done" data-pq="done">✕ Terminer</button>`;
        bar.querySelectorAll('[data-pq]').forEach(b => b.addEventListener('click', () => {
            if (b.dataset.pq === 'done') { removePlaceBar(); setMapTool('select'); return; }
            placeSelIdx = parseInt(b.dataset.pq, 10) || 0; renderPlaceBar();
        }));
    }
    // Un joueur ouvre/ferme une porte (autorité MJ : refuse si verrouillée ou secrète).
    function onPlayerDoorToggle(p) {
        if (!p || !p.id) return;
        const d = (state.map && state.map.walls || []).find(w => w.id === p.id && w.door); if (!d) return;
        if (d.locked || d.secret) return;                          // porte verrouillée / secrète : joueur ignoré
        d.open = !d.open;
        save(); renderMap(); broadcastMap(true);
    }
    // Un joueur pose un gabarit de sort (sphère/cône/ligne/cube). Le MJ fait autorité et rediffuse.
    function onPlayerTemplate(p) {
        if (!p || p.x == null || (state.map && state.map.playerAoeOff)) return;
        const ts = templatesData();
        ts.push({ id: uid(), kind: p.kind || 'circle', x: +p.x, y: +p.y, x2: (p.x2 != null ? +p.x2 : +p.x), y2: (p.y2 != null ? +p.y2 : +p.y), color: p.color || '#3498db', by: p.by || 'player', byUid: p.byUid || null });
        if (ts.length > 60) ts.shift();
        save(); renderMap(); broadcastMap(true);
    }
    // Un joueur efface les gabarits qu'il a lui-même posés.
    function onPlayerTemplateClear(p) {
        if (!p) return;
        state.map.templates = templatesData().filter(t => !(t.by === 'player' && (!p.fromUid || t.byUid === p.fromUid)));
        save(); renderMap(); broadcastMap(true);
    }
    // Déplacement d'un jeton demandé par un joueur (broadcast 'token-move')
    let tokenMovePersistTimer = null;
    function onTokenMove(p) {
        if (!p || !p.id) return;
        if (state.map && state.map.tokensLocked) return;            // déplacements verrouillés par le MJ
        const tok = find(state.tokens, p.id); if (!tok) return;
        if (tok.owner && p.fromUid && tok.owner !== p.fromUid) return; // un joueur ne bouge que SON jeton
        const nx = Math.max(0, Math.min(1, p.x)), ny = Math.max(0, Math.min(1, p.y));
        // Autorité MJ : un JOUEUR ne traverse jamais un mur ni une porte fermée (le MJ, lui, est libre).
        const blocked = window.VTTGeo && window.VTTGeo.moveBlocked((state.map && state.map.walls) || [], tok.x, tok.y, nx, ny);
        // Mémorise la position d'avant au DÉBUT d'un mouvement joueur (nouveau burst) pour « ↩️ Position précédente »
        const now2 = Date.now();
        if (!tokenMoveLast[tok.id] || now2 - tokenMoveLast[tok.id] > 800) tokenUndoPos[tok.id] = { x: tok.x, y: tok.y };
        tokenMoveLast[tok.id] = now2;
        if (!blocked) { tok.x = nx; tok.y = ny; }
        autoRevealAround(tok);                                      // exploration révélée : le PJ dévoile en avançant
        // Pendant un drag MJ, un re-render complet détruirait le jeton en cours de déplacement
        // (pointer capture perdu) : on ne met à jour que le jeton déplacé par le joueur.
        if (gmDragBusy) {
            const el = document.querySelector(`#gm-map-view .gm-token[data-token="${tok.id}"]`);
            if (el) { el.style.left = (tok.x * 100) + '%'; el.style.top = (tok.y * 100) + '%'; }
        } else renderMap();
        if (live.presChannel) gmBroadcast('map', { map: mapForShare(), tokens: tokensForShare() }); // relaye aux autres (sans les notes MJ)
        clearTimeout(tokenMovePersistTimer);
        tokenMovePersistTimer = setTimeout(() => { save(); if (state.sessionId && window.SupaAuth) { try { window.SupaAuth.saveSessionState(state.sessionId, { map: mapForShare(), tokens: tokensForShare() }); } catch (e) {} } }, 400);
    }
    // ----- Déplacement des éléments déjà posés (outil ✥) : murs, lumières, gabarits -----
    // Renvoie une « poignée » saisissable la plus proche du point (fx,fy) fraction 0..1.
    function pickMovableAt(fx, fy, rect) {
        const w = rect.width, h = rect.height, px = fx * w, py = fy * h;
        let best = null, bd = 14;                                  // tolérance en px écran
        // Extrémités de murs (déplace un seul bout) puis le mur entier
        (wallsData()).forEach(s => {
            [['1', s.x1, s.y1], ['2', s.x2, s.y2]].forEach(end => {
                const d = Math.hypot(end[1] * w - px, end[2] * h - py);
                if (d < bd) { bd = d; best = { kind: 'wallpt', ref: s, end: end[0] }; }
            });
        });
        if (best) return best;
        // Lumières
        let ld = 16; let lbest = null;
        (lightsData()).forEach(l => { const d = Math.hypot(l.x * w - px, l.y * h - py); if (d < ld) { ld = d; lbest = { kind: 'light', ref: l }; } });
        if (lbest) return lbest;
        // Gabarits (origine)
        let td = 16; let tbest = null;
        (templatesData()).forEach(t => { const d = Math.hypot(t.x * w - px, t.y * h - py); if (d < td) { td = d; tbest = { kind: 'template', ref: t }; } });
        if (tbest) return tbest;
        // Corps d'un mur (glisse le segment entier) — dernier recours
        let sd = 12, sbest = null;
        (wallsData()).forEach(s => {
            const d = window.VTTGeo ? window.VTTGeo.distToSegment(px, py, s.x1 * w, s.y1 * h, s.x2 * w, s.y2 * h) : 99;
            if (d < sd) { sd = d; sbest = { kind: 'wallseg', ref: s, grabX: fx, grabY: fy }; }
        });
        return sbest;
    }
    function moveMovable(md, x, y, rect) {
        if (md.kind === 'wallpt') {
            // Extrémité aimantée aux extrémités des AUTRES murs (reconnexion facile) + grille si 🧲
            if (rect) { const p = wallSnapPoint(x, y, rect, md.ref); x = p.x; y = p.y; }
            const s = md.ref; if (md.end === '1') { s.x1 = x; s.y1 = y; } else { s.x2 = x; s.y2 = y; }
        }
        else if (md.kind === 'wallseg') { const s = md.ref, dx = x - md.grabX, dy = y - md.grabY; s.x1 += dx; s.y1 += dy; s.x2 += dx; s.y2 += dy; md.grabX = x; md.grabY = y; }
        else if (md.kind === 'light') { md.ref.x = x; md.ref.y = y; }
        else if (md.kind === 'template') { const t = md.ref, dx = x - t.x, dy = y - t.y; t.x = x; t.y = y; if (t.x2 != null) { t.x2 += dx; t.y2 += dy; } }
    }
    // À la dépose d'un mur entier (outil ✥) : si une de ses extrémités arrive près de
    // l'extrémité d'un autre mur, on translate le segment pour les CONNECTER (mur continu).
    function reconnectWallSeg(seg) {
        const view = byId('gm-map-view'); const content = view && view.querySelector('.gm-board'); if (!content) return;
        const w = Math.max(1, content.clientWidth), h = Math.max(1, content.clientHeight);
        let best = null, bd = 12;                                  // tolérance en px écran
        (wallsData()).forEach(s => {
            if (s === seg) return;
            [[s.x1, s.y1], [s.x2, s.y2]].forEach(pt => {
                [[seg.x1, seg.y1], [seg.x2, seg.y2]].forEach(my => {
                    const d = Math.hypot((pt[0] - my[0]) * w, (pt[1] - my[1]) * h);
                    if (d < bd) { bd = d; best = { dx: pt[0] - my[0], dy: pt[1] - my[1] }; }
                });
            });
        });
        if (best) {
            seg.x1 += best.dx; seg.y1 += best.dy; seg.x2 += best.dx; seg.y2 += best.dy;
            if (window.showAppToast) window.showAppToast('🧲 Mur connecté', '#2c3e50');
        }
    }
    // Décale légèrement une position si une case est déjà occupée (évite les jetons empilés).
    function spreadFreeSpot(x, y) {
        const cw = ((state.map && state.map.gridSize) || 48) / 1000;
        const ch = cw * (Number(state.map && state.map.stageAR) || (16 / 9));
        const taken = (nx, ny) => (state.tokens || []).some(t => Math.abs(t.x - nx) < cw * 0.5 && Math.abs(t.y - ny) < ch * 0.5);
        if (!taken(x, y)) return { x, y };
        // Spirale de cases voisines
        for (let ring = 1; ring <= 6; ring++) {
            for (let dx = -ring; dx <= ring; dx++) for (let dy = -ring; dy <= ring; dy++) {
                if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
                const nx = Math.max(0, Math.min(1, x + dx * cw)), ny = Math.max(0, Math.min(1, y + dy * ch));
                if (!taken(nx, ny)) return { x: nx, y: ny };
            }
        }
        return { x, y };
    }

    function setupMapDrag() {
        const view = byId('gm-map-view'); if (!view) return;
        let cur = null, tokenEl = null, panning = false, painting = false, bgDrag = false, startX = 0, startY = 0, moved = false, startPan = null, bgStart = null, bgWheelTimer = null, objDrag = null;
        // Rect du BOARD (l'espace de coordonnées partagé) — pas du conteneur transformé.
        const contentRect = () => { const c = view.querySelector('.gm-board'); return c ? c.getBoundingClientRect() : view.getBoundingClientRect(); };
        view.addEventListener('pointerdown', (e) => {
            // Les UI flottantes posées SUR la carte (sélecteur de calque, barre « placer »)
            // gèrent leurs propres clics : ne pas déclencher l'outil carte dessous.
            if (e.target.closest('#gm-layer-switch') || e.target.closest('#gm-place-bar')) return;
            startX = e.clientX; startY = e.clientY; moved = false;
            // Clic molette (bouton du milieu) = se déplacer dans la carte, quel que soit l'outil,
            // SANS perdre l'outil en cours : on le retrouve tel quel au relâchement.
            if (e.button === 1) {
                panning = true; startPan = { x: mapView.panX, y: mapView.panY };
                try { view.setPointerCapture(e.pointerId); } catch (_) {}
                view.classList.add('panning'); e.preventDefault(); return;
            }
            // Outil ✋ Main : glisser n'importe où = déplacer la vue (pas l'image de fond).
            if (mapTool === 'pan') {
                panning = true; startPan = { x: mapView.panX, y: mapView.panY };
                try { view.setPointerCapture(e.pointerId); } catch (_) {}
                view.classList.add('panning'); e.preventDefault(); return;
            }
            // Outil ✥ Déplacer un élément posé (mur, lumière, gabarit) : on saisit la poignée la plus proche.
            if (mapTool === 'objmove') {
                const r = contentRect();
                const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
                objDrag = pickMovableAt(fx, fy, r);
                if (objDrag) { try { view.setPointerCapture(e.pointerId); } catch (_) {} e.preventDefault(); }
                return;
            }
            // Pastille de porte : outil « régler » → popover ; sinon clic = ouvrir/fermer.
            const doorBtn = e.target.closest('.gm-door-btn');
            if (doorBtn) { if (mapTool === 'dooredit') openDoorPopover(doorBtn.dataset.door, e); else toggleDoor(doorBtn.dataset.door); e.preventDefault(); return; }
            // Pastille de lumière : clic (outil lumière) = éditer.
            const lightPin = e.target.closest('.gm-light-pin');
            if (lightPin && mapTool === 'light') { openLightPopover(lightPin.dataset.light, e); e.preventDefault(); return; }
            // Pastille de zone sonore : clic (outil 🔊) = régler.
            const soundPin = e.target.closest('.gm-sound-pin');
            if (soundPin && mapTool === 'sound') { openSoundZonePopover(soundPin.dataset.sound, e); e.preventDefault(); return; }
            if (mapTool === 'reveal' || mapTool === 'cover') {   // mode brouillard : on peint
                painting = true; _fogLast = null; try { view.setPointerCapture(e.pointerId); } catch (_) {}
                paintFogAt(e); e.preventDefault(); return;
            }
            if (mapTool === 'wall' || mapTool === 'door') {      // tracé d'un mur / d'une porte
                const r = contentRect();
                const p = wallSnapPoint((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, r);
                wallDraft = { x1: p.x, y1: p.y, x2: p.x, y2: p.y, door: mapTool === 'door' };
                try { view.setPointerCapture(e.pointerId); } catch (_) {}
                renderWalls(); e.preventDefault(); return;
            }
            if (mapTool === 'wallerase') {                       // gomme : clic sur un mur = suppression
                eraseWallAt(e); e.preventDefault(); return;
            }
            if (mapTool === 'ruler') {                           // règle multi-points : clic = ajoute une étape (chemin coudé)
                const r = contentRect();
                let x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
                if (!rulerDraft || !rulerDraft.pts) rulerDraft = { pts: [], cur: { x, y } };
                const last = rulerDraft.pts[rulerDraft.pts.length - 1];
                if (last && e.shiftKey) { const p = constrain45(last.x, last.y, x, y, r); x = p.x; y = p.y; }
                rulerDraft.pts.push({ x, y }); rulerDraft.cur = { x, y };
                renderRuler(); e.preventDefault(); return;
            }
            if (mapTool === 'light') {                           // clic = pose ; GLISSER = régler le rayon
                const r = contentRect();
                const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
                lightDraft = { x, y, r: 0, color: lightColor };
                try { view.setPointerCapture(e.pointerId); } catch (_) {}
                renderLights(); e.preventDefault(); return;
            }
            if (mapTool === 'sound') {                           // zone sonore : origine → glisser la portée
                const r = contentRect();
                const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
                soundDraft = { x, y, r: 0 };
                try { view.setPointerCapture(e.pointerId); } catch (_) {}
                renderSoundZones(); e.preventDefault(); return;
            }
            if (mapTool === 'aoe') {                             // gabarit de sort : origine → glisser la taille
                const r = contentRect();
                const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
                aoeDraft = { kind: aoeKind, x, y, x2: x, y2: y, color: aoeColor };
                try { view.setPointerCapture(e.pointerId); } catch (_) {}
                renderTemplates(); e.preventDefault(); return;
            }
            if (mapTool === 'aoeerase') {                        // clic sur l'origine d'un gabarit = suppression
                eraseTemplateAt(e); e.preventDefault(); return;
            }
            if (mapTool === 'hazard') {                          // danger animé : origine → glisser le rayon
                const r = contentRect();
                const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
                hazardDraft = { kind: hazardKind, x, y, r: 0 };
                try { view.setPointerCapture(e.pointerId); } catch (_) {}
                renderHazards(); e.preventDefault(); return;
            }
            if (mapTool === 'hazarderase') {                     // clic sur un danger = suppression
                eraseHazardAt(e); e.preventDefault(); return;
            }
            if (mapTool === 'los') {                             // ligne de vue : clic 1 = tireur, clic 2 = cible
                const r = contentRect();
                const fx = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), fy = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
                const tk = tokenAtFraction(fx, fy);              // accroche au jeton cliqué s'il y en a un
                const pt = tk ? { x: tk.x, y: tk.y, name: tk.name || '' } : { x: fx, y: fy };
                if (!losA || losB) { losA = pt; losB = null; } else { losB = pt; }
                renderLos(); e.preventDefault(); return;
            }
            if (mapTool === 'placetoken') {                      // pose un jeton à l'endroit cliqué
                const r = contentRect();
                let x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
                const sn = snapFraction(x, y); x = sn.x; y = sn.y;
                const sp = spreadFreeSpot(x, y); x = sp.x; y = sp.y;
                const names = { pj: 'PJ', npc: 'PNJ', monster: 'Monstre' };
                const lyr = mapView.activeLayer || 'pj';
                const tok = { id: uid(), name: names[placeTokenType] || 'Jeton', type: placeTokenType, x, y, layer: lyr, hidden: lyr === 'gm' };
                if (placeTokenType === 'pj' && placeOwner) { tok.owner = placeOwner.uid; tok.name = placeOwner.name; tok.ref = 'pj:' + placeOwner.uid; }
                state.tokens.push(tok);
                save(); renderMap(); broadcastMap(true); e.preventDefault(); return;
            }
            if (mapTool === 'placecombatant') {                  // pose le combattant sélectionné à l'endroit cliqué
                if (!placeQueue.length) { setMapTool('select'); return; }
                const r = contentRect();
                let x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
                const sn = snapFraction(x, y); x = sn.x; y = sn.y;
                placeNextCombatant(x, y);
                e.preventDefault(); return;
            }
            if (mapTool === 'bg') {   // calage du fond : on déplace l'image (pas la grille)
                bgDrag = true; bgStart = { x: state.map.bgX || 0, y: state.map.bgY || 0 };
                try { view.setPointerCapture(e.pointerId); } catch (_) {}
                e.preventDefault(); return;
            }
            if (mapTool === 'draw') {   // dessin libre : nouveau tracé
                const r = contentRect();
                drawStroke = { color: drawColor, width: drawWidth, pts: [{ x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) }] };
                drawData().push(drawStroke);
                try { view.setPointerCapture(e.pointerId); } catch (_) {}
                renderDraw(); e.preventDefault(); return;
            }
            if (mapTool === 'gmnote') {   // notes MJ : tracé PRIVÉ (jamais diffusé aux joueurs)
                const r = contentRect();
                drawStroke = { color: drawColor, width: drawWidth, pts: [{ x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) }] };
                drawIsNote = true; gmNotesData().push(drawStroke);
                try { view.setPointerCapture(e.pointerId); } catch (_) {}
                renderGmNotes(); e.preventDefault(); return;
            }
            if (mapTool === 'ping') {   // signal : repère lumineux chez les joueurs (au même endroit sur la carte)
                const r = contentRect();
                const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
                gmBroadcast('map-ping', { x: x, y: y, color: pingColor });
                showGmMapPing(x, y);
                if (window.showAppToast) window.showAppToast('📍 Signal envoyé aux joueurs', '#2c3e50');
                e.preventDefault(); return;
            }
            const el = e.target.closest('.gm-token');
            if (el) {
                cur = find(state.tokens, el.dataset.token); tokenEl = el; if (!cur) return;
                gmDragBusy = true;
                moveMeasure = { x1: cur.x, y1: cur.y, x2: cur.x, y2: cur.y, speed: tokenSpeed(cur) };   // déplacement mesuré
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
            if (objDrag) {
                const r = contentRect();
                const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
                moveMovable(objDrag, x, y, r);
                renderWalls(); renderLights(); renderTemplates(); renderVisionPreview(); return;   // redraw léger (pas de rebuild DOM)
            }
            if (painting) { paintFogAt(e); return; }
            if (wallDraft) {
                const r = contentRect();
                let p = wallSnapPoint((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, r);
                if (e.shiftKey) p = constrain45(wallDraft.x1, wallDraft.y1, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, r);
                wallDraft.x2 = p.x; wallDraft.y2 = p.y;
                renderWalls(); return;
            }
            if (lightDraft) {                                  // glisser = régler le rayon de la lumière
                const r = contentRect();
                const px = e.clientX - r.left, py = e.clientY - r.top;
                lightDraft.r = Math.max(0, Math.min(0.45, Math.hypot(px - lightDraft.x * r.width, py - lightDraft.y * r.height) / r.width));
                renderLights(); return;
            }
            if (hazardDraft) {                                 // glisser = régler le rayon du danger
                const r = contentRect();
                const px = e.clientX - r.left, py = e.clientY - r.top;
                hazardDraft.r = Math.max(0, Math.min(0.5, Math.hypot(px - hazardDraft.x * r.width, py - hazardDraft.y * r.height) / r.width));
                renderHazards(); return;
            }
            if (soundDraft) {                                  // glisser = régler la portée de la zone sonore
                const r = contentRect();
                const px = e.clientX - r.left, py = e.clientY - r.top;
                soundDraft.r = Math.max(0, Math.min(0.5, Math.hypot(px - soundDraft.x * r.width, py - soundDraft.y * r.height) / r.width));
                renderSoundZones(); return;
            }
            if (rulerDraft && rulerDraft.pts) {                  // règle : le dernier segment suit le curseur (élastique)
                const r = contentRect();
                let p = { x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) };
                const last = rulerDraft.pts[rulerDraft.pts.length - 1];
                if (last && e.shiftKey) p = constrain45(last.x, last.y, p.x, p.y, r);
                rulerDraft.cur = p;
                renderRuler(); return;
            }
            if (aoeDraft) {
                const r = contentRect();
                let p = { x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) };
                if (e.shiftKey) p = constrain45(aoeDraft.x, aoeDraft.y, p.x, p.y, r);
                aoeDraft.x2 = p.x; aoeDraft.y2 = p.y;
                renderTemplates(); return;
            }
            if (drawStroke) {
                const r = contentRect();
                drawStroke.pts.push({ x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) });
                drawIsNote ? renderGmNotes() : renderDraw(); return;
            }
            if (bgDrag) {
                // Delta écran → px de RÉFÉRENCE (largeur 1000) pour rester stable à tout zoom / toute fenêtre
                const br = contentRect(), kRef = 1000 / Math.max(1, br.width);
                state.map.bgX = bgStart.x + (e.clientX - startX) * kRef;
                state.map.bgY = bgStart.y + (e.clientY - startY) * kRef;
                const b = view.querySelector('.gm-board');
                if (b) { const f = b.clientWidth / 1000; b.style.backgroundPosition = `calc(50% + ${state.map.bgX * f}px) calc(50% + ${state.map.bgY * f}px)`; }
                return;
            }
            if (cur && tokenEl) {
                const r = contentRect();
                const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
                const y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
                // Au PREMIER vrai mouvement seulement : mémorise la position d'avant (pour « ↩️ »)
                // — un simple clic (ouverture de bulle) ne doit pas écraser ce point.
                if (moveMeasure && !moveMeasure._undoSet) { tokenUndoPos[cur.id] = { x: moveMeasure.x1, y: moveMeasure.y1 }; moveMeasure._undoSet = true; }
                cur.x = x; cur.y = y;
                tokenEl.style.left = (x * 100) + '%'; tokenEl.style.top = (y * 100) + '%';
                if (moveMeasure) { moveMeasure.x2 = x; moveMeasure.y2 = y; renderMoveMeasure(); }   // distance parcourue
                if (autoRevealAround(cur)) renderFog();              // exploration révélée : dévoile en avançant
                if (mapView.visionPreview) renderVisionPreview();   // l'aperçu de vision suit le jeton
                throttleBroadcastMap();
            } else if (panning) {
                mapView.panX = startPan.x + (e.clientX - startX);
                mapView.panY = startPan.y + (e.clientY - startY);
                applyMapTransform();
            } else if (mapTool === 'objmove' || mapTool === 'wallerase') {
                // Survol (rien en cours de drag) : surbrillance de l'élément saisissable / effaçable
                const r = contentRect();
                const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
                let hov = null;
                if (mapTool === 'objmove') hov = pickMovableAt(fx, fy, r);
                else {                                          // gomme : mur le plus proche du curseur
                    const px = fx * r.width, py = fy * r.height;
                    let bd = 11, bs = null;
                    (wallsData()).forEach(s => {
                        const d = window.VTTGeo ? window.VTTGeo.distToSegment(px, py, s.x1 * r.width, s.y1 * r.height, s.x2 * r.width, s.y2 * r.height) : 99;
                        if (d < bd) { bd = d; bs = s; }
                    });
                    if (bs) hov = { kind: 'wallseg', ref: bs };
                }
                const key = hov ? (hov.kind + ':' + ((hov.ref && hov.ref.id) || '') + ':' + (hov.end || '')) : '';
                if (key !== objHoverKey) { objHoverKey = key; objHover = hov; renderWalls(); }
            }
        });
        const up = (e) => {
            if (objDrag) {
                // Mur entier déposé près d'une extrémité d'un autre mur → on les connecte (🧲)
                if (objDrag.kind === 'wallseg') reconnectWallSeg(objDrag.ref);
                objDrag = null; save(); renderMap(); broadcastMap(true); return;
            }
            if (lightDraft) {
                // Simple clic = rayon par défaut ; glisser = rayon choisi (mémorisé pour la prochaine)
                const r = Math.max(0.04, Math.min(0.45, lightDraft.r > 0.02 ? lightDraft.r : lightRadius));
                if (lightDraft.r > 0.02) lightRadius = r;
                lightsData().push({ id: uid(), x: lightDraft.x, y: lightDraft.y, r: r, color: lightDraft.color });
                lightDraft = null; save(); renderMap(); broadcastMap(true); return;
            }
            if (hazardDraft) {
                // Clic simple = rayon par défaut ; glisser = rayon choisi
                const r = Math.max(0.05, Math.min(0.5, hazardDraft.r > 0.02 ? hazardDraft.r : 0.1));
                hazardsData().push({ id: uid(), kind: hazardDraft.kind, x: hazardDraft.x, y: hazardDraft.y, r: r });
                hazardDraft = null; save(); renderMap(); broadcastMap(true); return;
            }
            if (soundDraft) {
                // Clic simple = portée par défaut ; glisser = portée choisie. On ouvre le popover pour choisir le son.
                const r = Math.max(0.05, Math.min(0.5, soundDraft.r > 0.02 ? soundDraft.r : 0.15));
                const z = { id: uid(), x: soundDraft.x, y: soundDraft.y, r: r, url: '', name: '', vol: 0.8 };
                soundZonesData().push(z);
                soundDraft = null; save(); renderMap(); broadcastMap(true);
                openSoundZonePopover(z.id, e); return;
            }
            if (drawStroke) { drawStroke = null; drawIsNote = false; save(); broadcastMap(true); return; }
            if (wallDraft) {
                // On ne garde que les segments réels (pas les simples clics)
                if (Math.hypot(wallDraft.x2 - wallDraft.x1, wallDraft.y2 - wallDraft.y1) > 0.004) {
                    wallsData().push({ id: uid(), x1: wallDraft.x1, y1: wallDraft.y1, x2: wallDraft.x2, y2: wallDraft.y2, door: !!wallDraft.door, open: false });
                }
                wallDraft = null; save(); renderMap(); broadcastMap(true); return;
            }
            if (rulerDraft && rulerDraft.pts) { return; }        // règle multi-points : on garde le chemin (fin = Échap / double-clic / autre outil)
            if (aoeDraft) {
                let placed = null;
                const ox = aoeDraft.x, oy = aoeDraft.y;
                if (Math.hypot(aoeDraft.x2 - aoeDraft.x, aoeDraft.y2 - aoeDraft.y) > 0.008) {
                    placed = Object.assign({ id: uid() }, aoeDraft);
                    templatesData().push(placed);
                }
                aoeDraft = null; save(); renderMap(); broadcastMap(true);
                // Gabarit intelligent : lister les jetons touchés + proposer les sauvegardes.
                // Glisser = nouveau gabarit ; clic simple sur l'origine d'un gabarit existant = ré-ouvrir son panneau.
                if (placed) openAoeTargetPanel(placed, e);
                else { const near = templatesData().find(tt => Math.hypot(tt.x - ox, tt.y - oy) < 0.02); if (near) openAoeTargetPanel(near, e); }
                return;
            }
            if (bgDrag) { bgDrag = false; save(); broadcastMap(true); return; }
            if (painting) { painting = false; _fogLast = null; save(); broadcastMap(true); return; }
            if (cur) {
                if (!moved) { openTokenPopover(cur, e); }              // clic simple → bulle d'édition
                else { const sn = snapFraction(cur.x, cur.y); cur.x = sn.x; cur.y = sn.y; autoRevealAround(cur); }
                if (tokenEl) tokenEl.classList.remove('dragging');
                moveMeasure = null;                                   // fin du drag : efface la mesure de déplacement
                cur = null; tokenEl = null; gmDragBusy = false; save(); renderMap(); broadcastMap(true);
            }
            if (panning) { panning = false; view.classList.remove('panning'); }
        };
        view.addEventListener('pointerup', up);
        view.addEventListener('pointercancel', up);
        // Double-clic (outil souris) = signal 📍 aux joueurs, sans changer d'outil
        view.addEventListener('dblclick', (e) => {
            if (mapTool === 'ruler') { rulerDraft = null; renderRuler(); return; }   // termine la mesure coudée
            if (mapTool !== 'select') return;
            if (e.target.closest('.gm-token') || e.target.closest('.gm-door-btn') || e.target.closest('.gm-light-pin')
                || e.target.closest('#gm-layer-switch') || e.target.closest('#gm-place-bar')) return;
            const r = contentRect();
            const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
            gmBroadcast('map-ping', { x: x, y: y, color: pingColor });
            showGmMapPing(x, y);
            if (window.showAppToast) window.showAppToast('📍 Signal envoyé aux joueurs', '#2c3e50');
        });
        view.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (mapTool === 'bg') {   // molette = redimensionner le fond (calage grille)
                state.map.bgScale = Math.max(0.2, Math.min(5, (Number(state.map.bgScale) || 1) * (e.deltaY < 0 ? 1.05 : 1 / 1.05)));
                const b = view.querySelector('.gm-board'); if (b) b.style.backgroundSize = (state.map.bgScale * 100) + '%';
                clearTimeout(bgWheelTimer); bgWheelTimer = setTimeout(() => { save(); broadcastMap(true); }, 250);
                return;
            }
            if (mapTool === 'reveal' || mapTool === 'cover') {   // molette = taille du pinceau de brouillard
                fogBrush = Math.max(0.02, Math.min(0.25, fogBrush * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
                if (window.showAppToast) window.showAppToast('🖌️ Pinceau : ' + Math.round(fogBrush * 100) + '%', '#2c3e50');
                return;
            }
            if (mapTool === 'draw') {   // molette = épaisseur du trait
                drawWidth = Math.max(1, Math.min(24, drawWidth + (e.deltaY < 0 ? 1 : -1)));
                if (window.showAppToast) window.showAppToast('✏️ Épaisseur : ' + drawWidth + ' px', '#2c3e50');
                return;
            }
            if (mapTool === 'light') {   // molette = rayon de la prochaine lumière posée
                lightRadius = Math.max(0.04, Math.min(0.45, lightRadius * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
                if (window.showAppToast) window.showAppToast('💡 Rayon de lumière : ' + Math.round(lightRadius * 100) + '%', '#2c3e50');
                return;
            }
            // Zoom molette centré SUR LE CURSEUR : le point de la carte sous la souris reste fixe.
            const content = view.querySelector('.gm-map-content');
            const crect = content && content.getBoundingClientRect();
            const oldZoom = mapView.zoom;
            const newZoom = Math.max(0.4, Math.min(4, oldZoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
            if (crect && crect.width && newZoom !== oldZoom) {
                const k = newZoom / oldZoom;
                mapView.panX += (e.clientX - crect.left) * (1 - k);
                mapView.panY += (e.clientY - crect.top) * (1 - k);
            }
            mapView.zoom = newZoom;
            applyMapTransform();
        }, { passive: false });
    }
    function resetMapView() { mapView.zoom = 1; mapView.panX = 0; mapView.panY = 0; applyMapTransform(); }
    // Zoom ± centré sur le milieu de la carte (boutons 🔍 de la barre d'outils).
    function zoomAtCenter(factor) {
        const view = byId('gm-map-view'); if (!view) return;
        const content = view.querySelector('.gm-map-content');
        const crect = content && content.getBoundingClientRect();
        const oldZoom = mapView.zoom;
        const newZoom = Math.max(0.4, Math.min(4, oldZoom * factor));
        if (crect && crect.width && newZoom !== oldZoom) {
            const k = newZoom / oldZoom;
            mapView.panX += (crect.width / 2) * (1 - k);
            mapView.panY += (crect.height / 2) * (1 - k);
        }
        mapView.zoom = newZoom;
        applyMapTransform();
    }
    // Annule le dernier trait (Notes MJ si l'outil 📝 est actif, sinon Dessin libre).
    function undoLastDrawing() {
        const note = (mapTool === 'gmnote');
        const d = note ? gmNotesData() : drawData();
        if (!d.length) { if (window.showAppToast) window.showAppToast('Aucun trait à annuler', '#7a6050'); return; }
        d.pop(); save(); note ? renderGmNotes() : renderDraw(); if (!note) broadcastMap(true);
    }

    // ---------- Panneau des calques (visibilité + opacité ; « Notes MJ » privé) ----------
    const LAYER_DEFS = [
        { key: 'tokens', label: '🧝 Jetons' },
        { key: 'draw', label: '✏️ Dessin' },
        { key: 'gmnotes', label: '📝 Notes MJ' },
        { key: 'fog', label: '🌫️ Brouillard' },
        { key: 'walls', label: '🧱 Murs & portes' },
        { key: 'grid', label: '▦ Grille' },
    ];
    function layerIsVisible(k) { return mapView.layers[k] !== false; }
    function applyLayerOpacity(k) {
        const view = byId('gm-map-view'); if (!view) return;
        const o = (mapView.layerOp && mapView.layerOp[k] != null) ? mapView.layerOp[k] : 1;
        if (k === 'grid') { const c = view.querySelector('.gm-map-content'); if (c) c.style.setProperty('--gm-grid-op', o); return; }
        view.querySelectorAll('.gm-layer-' + k).forEach(el => { el.style.opacity = (o === 1 ? '' : o); });
    }
    function ensureLayersPanel() {
        let panel = byId('gm-layers-panel'); if (panel) return panel;
        const host = byId('gm-map-card') || document.querySelector('.gm-main'); if (!host) return null;
        if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
        panel = document.createElement('div');
        panel.id = 'gm-layers-panel'; panel.className = 'gm-layers-panel hidden';
        panel.innerHTML = `<div class="gm-layers-head"><span>🗂️ Calques</span><button class="gm-layers-close" title="Fermer">✕</button></div>`
            + LAYER_DEFS.map(d => `<div class="gm-layer-row">
                    <button class="gm-layer-vis" data-layer="${d.key}" title="Afficher / masquer">👁️</button>
                    <span class="gm-layer-name">${d.label}</span>
                    <input type="range" class="gm-layer-op" data-layer-op="${d.key}" min="0" max="100" step="5" value="100" title="Opacité">
                </div>`).join('')
            + `<div class="gm-layers-foot">Le calque « Notes MJ » n'est jamais montré aux joueurs.</div>`;
        host.appendChild(panel);
        panel.querySelector('.gm-layers-close').addEventListener('click', () => panel.classList.add('hidden'));
        panel.querySelectorAll('.gm-layer-vis').forEach(btn => btn.addEventListener('click', () => {
            const k = btn.dataset.layer;
            mapView.layers[k] = (mapView.layers[k] === false);   // bascule visible / masqué
            renderMap(); syncLayersPanel();
        }));
        panel.querySelectorAll('.gm-layer-op').forEach(sl => sl.addEventListener('input', () => {
            const k = sl.dataset.layerOp;
            if (!mapView.layerOp) mapView.layerOp = {};
            mapView.layerOp[k] = Math.max(0, Math.min(1, (Number(sl.value) || 0) / 100));
            applyLayerOpacity(k);
        }));
        return panel;
    }
    function syncLayersPanel() {
        const panel = byId('gm-layers-panel'); if (!panel) return;
        panel.querySelectorAll('.gm-layer-vis').forEach(btn => {
            const on = layerIsVisible(btn.dataset.layer);
            btn.textContent = on ? '👁️' : '🚫'; btn.classList.toggle('is-off', !on);
        });
        panel.querySelectorAll('.gm-layer-op').forEach(sl => {
            const k = sl.dataset.layerOp;
            const o = (mapView.layerOp && mapView.layerOp[k] != null) ? mapView.layerOp[k] : 1;
            sl.value = Math.round(o * 100);
        });
    }
    function toggleLayersPanel() {
        const panel = ensureLayersPanel(); if (!panel) return;
        const show = panel.classList.contains('hidden');
        panel.classList.toggle('hidden', !show);
        if (show) syncLayersPanel();
    }

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
        if (typeof renderSharedImagePicker === 'function') renderSharedImagePicker();
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

        // Bascule des aides ⓘ (préférence persistée) : épure l'écran une fois qu'on connaît l'outil
        const hintsBtn = byId('gm-hints-toggle');
        if (hintsBtn) {
            const applyHints = (hidden) => {
                const ov = byId('gm-screen'); if (ov) ov.classList.toggle('gm-hints-hidden', hidden);
                hintsBtn.classList.toggle('is-off', hidden);
                hintsBtn.title = hidden ? 'Afficher les aides ⓘ' : 'Masquer les aides ⓘ';
            };
            applyHints(localStorage.getItem('dnd-gm-hints-hidden') === '1');
            hintsBtn.addEventListener('click', () => {
                const hidden = !byId('gm-screen').classList.contains('gm-hints-hidden');
                try { localStorage.setItem('dnd-gm-hints-hidden', hidden ? '1' : '0'); } catch (e) {}
                applyHints(hidden);
            });
        }

        // Onglets de la sidebar (Dés / Journal / Compendium)
        document.querySelectorAll('.gm-side-tab').forEach(tab => tab.addEventListener('click', () => {
            document.querySelectorAll('.gm-side-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const map = { table: '.gm-side-table', chat: '.gm-side-chat', audio: '.gm-side-audio', prep: '.gm-side-prep', journal: '.gm-side-journal', compendium: '.gm-side-compendium' };
            document.querySelectorAll('.gm-side-panel').forEach(p => p.classList.remove('gm-side-show'));
            const target = document.querySelector(map[tab.dataset.side]); if (target) target.classList.add('gm-side-show');
            // Si on n'a pas la sidebar ouverte, l'ouvrir
            const ov = byId('gm-screen'); if (ov) ov.classList.remove('gm-sidebar-collapsed');
        }));

        // Compendium : recherche (+ affichage complet par défaut, champ vide)
        const compInput = byId('gm-comp-search');
        if (compInput) compInput.addEventListener('input', (e) => renderCompendium(e.target.value));
        renderCompendium('');

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
            if (state.turnIndex >= state.initiative.length) { state.turnIndex = 0; state.round++; clog('🔄 Round ' + state.round); tickCombatEffects(); }
            const cur = state.initiative[state.turnIndex];
            if (cur && state.combatActive) clog('▶️ Tour de ' + cur.name);
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
            clog(state.combatActive ? '⚔️ Combat lancé' : '🕊️ Fin du combat');
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
        byId('gm-dice-roll').addEventListener('click', () => { const f = byId('gm-dice-formula').value.trim(); if (f) { handleDiceCommand(f); byId('gm-dice-formula').value = ''; } });
        byId('gm-dice-formula').addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); byId('gm-dice-roll').click(); } });

        // --- 🎯 Demander un jet : le joueur reçoit un bouton qui lance d20 + mod de SA fiche ---
        // Les ids correspondent aux éléments de la fiche joueur (#skill-val-x / #mod-x).
        const ROLLREQ_SKILLS = [
            ['— Compétences —', [
                ['perception', 'Perception'], ['stealth', 'Discrétion'], ['athletics', 'Athlétisme'], ['acrobatics', 'Acrobaties'],
                ['insight', 'Intuition'], ['investigation', 'Investigation'], ['arcana', 'Arcanes'], ['history', 'Histoire'],
                ['nature', 'Nature'], ['religion', 'Religion'], ['medicine', 'Médecine'], ['survival', 'Survie'],
                ['animal', 'Dressage'], ['sleight', 'Escamotage'], ['deception', 'Tromperie'], ['intimidation', 'Intimidation'],
                ['performance', 'Représentation'], ['persuasion', 'Persuasion']
            ]],
            ['— Sauvegardes —', [
                ['save-str', 'Sauvegarde FOR'], ['save-dex', 'Sauvegarde DEX'], ['save-con', 'Sauvegarde CON'],
                ['save-int', 'Sauvegarde INT'], ['save-wis', 'Sauvegarde SAG'], ['save-cha', 'Sauvegarde CHA']
            ]],
            ['— Caractéristiques brutes —', [
                ['str', 'Force'], ['dex', 'Dextérité'], ['con', 'Constitution'],
                ['int', 'Intelligence'], ['wis', 'Sagesse'], ['cha', 'Charisme']
            ]]
        ];
        const rrSkill = byId('gm-rollreq-skill');
        if (rrSkill) rrSkill.innerHTML = ROLLREQ_SKILLS.map(g => `<optgroup label="${g[0]}">` + g[1].map(s => `<option value="${s[0]}">${s[1]}</option>`).join('') + '</optgroup>').join('');
        const rrSend = byId('gm-rollreq-send');
        if (rrSend) rrSend.addEventListener('click', () => {
            const skill = rrSkill ? rrSkill.value : 'perception';
            let label = 'Jet';
            ROLLREQ_SKILLS.forEach(g => g[1].forEach(s => { if (s[0] === skill) label = s[1]; }));
            const target = (byId('gm-rollreq-target') || {}).value || 'all';
            if (!gmBroadcast('roll-request', { skill: skill, label: label, targetUserId: target })) return;
            const who = target === 'all' ? 'tous les joueurs' : 'un joueur';
            if (window.showAppToast) window.showAppToast('🎯 Demande envoyée à ' + who + ' : ' + label, '#2c3e50');
            clog('🎯 Demande de jet : ' + label + ' → ' + who);
        });

        // Générateurs (PNJ jouable · rumeur · trésor · rencontre) + actions contextuelles
        let lastGen = null;   // { type, npc?, encounter? }
        function renderGenActions() {
            const box = byId('gm-gen-actions'); if (!box) return;
            if (lastGen && lastGen.type === 'name') {
                box.style.display = 'flex';
                box.innerHTML = `<button class="gm-gen-actions-btn" data-genact="keep-npc">💾 Garder ce PNJ</button>`;
            } else if (lastGen && lastGen.type === 'encounter' && lastGen.encounter) {
                box.style.display = 'flex';
                box.innerHTML = `<button class="gm-gen-actions-btn" data-genact="add-enc">⚔️ Ajouter au combat</button>`;
            } else { box.style.display = 'none'; box.innerHTML = ''; }
        }
        function genEncounter() {
            const env = (byId('gm-gen-env') || {}).value || 'forest';
            const tier = (byId('gm-gen-tier') || {}).value || '1';
            const list = (ENCOUNTERS[env] && ENCOUNTERS[env][tier]) || [];
            if (!list.length) return null;
            const e = list[Math.floor(Math.random() * list.length)];
            return { name: e[0], hp: e[1], ac: e[2] };
        }
        document.querySelectorAll('[data-gen]').forEach(b => b.addEventListener('click', () => {
            const kind = b.dataset.gen;
            const encOpts = byId('gm-gen-enc-opts'); if (encOpts) encOpts.style.display = (kind === 'encounter') ? 'flex' : 'none';
            const out = byId('gm-gen-out');
            if (kind === 'name') { lastGen = { type: 'name', npc: genNpcName() }; out.textContent = lastGen.npc; }
            else if (kind === 'encounter') {
                const e = genEncounter();
                lastGen = { type: 'encounter', encounter: e };
                out.textContent = e ? ('⚔️ ' + e.name + '  —  PV ' + e.hp + ' · CA ' + e.ac) : 'Aucune rencontre pour ce filtre.';
            } else {
                const pool = kind === 'rumor' ? GEN_RUMORS : GEN_LOOT;
                lastGen = { type: kind };
                out.textContent = pool[Math.floor(Math.random() * pool.length)];
            }
            renderGenActions();
        }));
        // Actions : garder le PNJ dans la campagne / ajouter la rencontre aux monstres
        byId('gm-gen-actions').addEventListener('click', (e) => {
            const b = e.target.closest('[data-genact]'); if (!b) return;
            if (b.dataset.genact === 'keep-npc' && lastGen && lastGen.npc) {
                // « Prénom Nom, métier — trait. » → nom = avant la virgule, reste en secret/note
                const full = lastGen.npc;
                const comma = full.indexOf(',');
                const name = comma > 0 ? full.slice(0, comma).trim() : full.trim();
                const secret = comma > 0 ? full.slice(comma + 1).trim() : '';
                state.npcs.push({ id: uid(), name: name, secret: secret, present: true });
                save(); renderNpcs();
                if (window.showAppToast) window.showAppToast('🎭 PNJ ajouté au Journal : ' + name, '#2c3e50');
            } else if (b.dataset.genact === 'add-enc' && lastGen && lastGen.encounter) {
                const e2 = lastGen.encounter;
                // Parse un « (×N) » pour créer N monstres numérotés (sinon 1 seul).
                const mm = e2.name.match(/^(.*?)\s*\(×(\d+)\)\s*$/);
                const base = mm ? mm[1].trim() : e2.name;
                const count = mm ? Math.min(12, parseInt(mm[2], 10) || 1) : 1;
                for (let i = 0; i < count; i++) {
                    const nm = count > 1 ? (base + ' ' + (i + 1)) : base;
                    state.monsters.push({ id: uid(), name: nm, hpCur: e2.hp, hpMax: e2.hp, ac: e2.ac, conditions: [], attacks: [] });
                }
                save(); renderMonsters();
                if (window.showAppToast) window.showAppToast('⚔️ ' + count + ' monstre(s) ajouté(s) — pose-les via « Placer les combattants »', '#2c3e50');
            }
        });
        // Régénère la rencontre quand on change environnement / palier
        ['gm-gen-env', 'gm-gen-tier'].forEach(id => { const s = byId(id); if (s) s.addEventListener('change', () => {
            const e3 = genEncounter(); lastGen = { type: 'encounter', encounter: e3 };
            byId('gm-gen-out').textContent = e3 ? ('⚔️ ' + e3.name + '  —  PV ' + e3.hp + ' · CA ' + e3.ac) : 'Aucune rencontre pour ce filtre.';
            renderGenActions();
        }); });
        // Boutons d'ambiance
        renderAmbianceBtns();
        byId('gm-ambiance-btns').addEventListener('click', (e) => { const b = e.target.closest('[data-ambiance]'); if (b) applyAmbiance(b.dataset.ambiance); });

        // Minuteur partagé (compte à rebours chez le MJ ET les joueurs)
        byId('gm-timer-start').addEventListener('click', () => {
            const min = Math.max(0.1, parseFloat(byId('gm-timer-min').value) || 5);
            const until = Date.now() + Math.round(min * 60000);
            gmBroadcast('timer', { until: until });
            showGmTimer(until);
            clog('⏳ Minuteur lancé : ' + min + ' min');
        });
        byId('gm-timer-stop').addEventListener('click', () => { gmBroadcast('timer', { until: 0 }); showGmTimer(0); });

        // Journal de combat + points de sauvegarde
        byId('gm-combatlog-clear').addEventListener('click', () => { if (!confirm('Vider le journal de combat ?')) return; state.combatLog = []; save(); renderCombatLog(); });
        byId('gm-snap-create').addEventListener('click', createSnap);

        // Raccourcis clavier des outils carte (hors saisie) + Ctrl+Z = annuler sur la carte
        const TOOL_KEYS = { s: ['select', '🖱️ Souris'], h: ['pan', '✋ Déplacer la vue'], v: ['objmove', '✥ Déplacer un élément'], m: ['wall', '🧱 Mur'], p: ['door', '🚪 Porte'], d: ['draw', '✏️ Dessin'], l: ['light', '💡 Lumière'], r: ['ruler', '📏 Règle'], f: ['reveal', '🔦 Révéler (brouillard)'], j: ['placetoken', '📍 Poser un jeton'], a: ['aoe', '🎯 Gabarit'] };
        // Table des raccourcis affichée dans l'aide (⌨️) — libellés lisibles.
        window.__gmShortcuts = [
            ['S', 'Souris / sélection'], ['H', 'Déplacer la vue (main)'], ['V', 'Déplacer un élément posé'],
            ['M', 'Tracer un mur'], ['P', 'Tracer une porte'], ['D', 'Dessiner'], ['L', 'Poser une lumière'],
            ['R', 'Mesurer (règle)'], ['F', 'Révéler le brouillard'], ['J', 'Poser un jeton'], ['A', 'Gabarit de sort'],
            ['Échap', 'Revenir à la souris'], ['Ctrl + Z', 'Annuler'], ['Ctrl + Y', 'Rétablir'],
            ['Molette', 'Zoom sous le curseur'], ['Clic molette', 'Déplacer la vue'], ['Ctrl + V', 'Coller une image sur la carte'],
            ['Maj + glisser', 'Tracé droit (0° / 45° / 90°)'], ['Double-clic', 'Signal 📍 aux joueurs'], ['?', 'Afficher cette aide']
        ];
        // Même table, en compact, dans le panneau ⚙️ Réglages (demande MJ Lot 24)
        const scHost = byId('gm-set-shortcuts');
        if (scHost) scHost.innerHTML = window.__gmShortcuts.map(s => `<span class="gm-set-sc"><kbd>${esc(s[0])}</kbd> ${esc(s[1])}</span>`).join('');
        const tutoBtn = byId('gm-tuto-replay');
        if (tutoBtn) tutoBtn.addEventListener('click', () => startGmTutorial(true));
        document.addEventListener('keydown', (e) => {
            if (!document.body.classList.contains('gm-active')) return;
            const tag = (e.target.tagName || '').toLowerCase();
            if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return;
            const k = e.key.toLowerCase();
            if ((e.ctrlKey || e.metaKey) && k === 'z' && e.shiftKey) { e.preventDefault(); redoMap(); return; }
            if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); undoMap(); return; }
            if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); redoMap(); return; }
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            if (e.key === 'Escape') { if (placeQueue.length) removePlaceBar(); rulerDraft = null; losA = null; losB = null; if (mapTool !== 'select') { mapTool = 'select'; syncToolbar(); renderMap(); } closeToolFlyout(); return; }
            if (e.key === '?' || (e.shiftKey && e.key === '/')) { e.preventDefault(); toggleShortcutsHelp(); return; }
            const def = TOOL_KEYS[k];
            if (def) {
                e.preventDefault();
                if (mapTool !== def[0]) { mapTool = def[0]; if (def[0] === 'reveal') fogState().on = true; syncToolbar(); renderMap(); }
                closeToolFlyout();
                if (window.showAppToast) window.showAppToast(def[1], '#2c3e50');
            }
        });

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
        setupMapPaste();
        // Le board (plateau à ratio fixe) se recalcule quand la zone carte change de taille
        try {
            let roT = null;
            const ro = new ResizeObserver(() => { clearTimeout(roT); roT = setTimeout(() => { if (!gmDragBusy && document.body.classList.contains('gm-active')) renderMap(); }, 120); });
            ro.observe(byId('gm-map-view'));
        } catch (e) {}
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

        // Montrer une image aux joueurs (URL ou import)
        byId('gm-showimg-send').addEventListener('click', () => {
            const u = byId('gm-showimg-url').value.trim();
            if (!u) { if (window.showAppToast) window.showAppToast('Renseigne une URL ou importe une image.', '#c0392b'); return; }
            sendSharedImage(u);
        });
        byId('gm-showimg-send-prep').addEventListener('click', () => {
            const n = treeNode(byId('gm-showimg-prepared').value);
            if (n && n.data && n.data.url) sendSharedImage(n.data.url);
            else if (window.showAppToast) window.showAppToast('Choisis une image préparée dans la liste.', '#c0392b');
        });
        byId('gm-showimg-file').addEventListener('change', async (e) => {
            const f = e.target.files[0]; if (!f) return;
            try {
                if (window.SupaAuth && window.SupaAuth.uploadAsset) { const res = await window.SupaAuth.uploadAsset(f, 'shared'); sendSharedImage(res.url); }
                else fileToDataURL(f, sendSharedImage);
            } catch (err) { console.warn('showimg upload:', err); if (window.showAppToast) window.showAppToast('Échec de l\'envoi de l\'image.', '#c0392b'); }
            e.target.value = '';
        });
        // Banque : on PRÉVISUALISE d'abord (pas d'application au change), puis « Charger » applique.
        byId('gm-map-bank').addEventListener('change', (e) => {
            const n = treeNode(e.target.value); const prev = byId('gm-map-bank-preview');
            if (n && n.data && n.data.url) { prev.src = n.data.url; prev.style.display = 'block'; }
            else { prev.removeAttribute('src'); prev.style.display = 'none'; }
        });
        byId('gm-map-bank-load').addEventListener('click', () => {
            const n = treeNode(byId('gm-map-bank').value);
            if (n && n.data && n.data.url) { state.map.bg = n.data.url; save(); renderMap(); broadcastMap(true); if (window.showAppToast) window.showAppToast('🗺️ Carte « ' + n.name + ' » chargée', '#2c3e50'); }
            else if (window.showAppToast) window.showAppToast('Choisis d\'abord une carte dans la liste.', '#c0392b');
        });
        // Repli des réglages de la carte (carte plein cadre quand replié)
        byId('gm-map-collapse').addEventListener('click', () => { byId('gm-map-card').classList.toggle('gm-map-collapsed'); renderMap(); });

        // Barre des cartes (pages type Roll20) : délégation sur la barre (re-rendue à chaque renderMap)
        byId('gm-map-pages-toggle').addEventListener('click', () => { byId('gm-map-card').classList.toggle('gm-pages-collapsed'); renderMap(); });
        const pagesBar = byId('gm-map-pages-bar');
        pagesBar.addEventListener('click', (e) => {
            const act = e.target.closest('[data-pact]');
            if (act) { e.stopPropagation(); if (act.dataset.pact === 'rename') promptRenameMap(act.dataset.page); else confirmDeleteMap(act.dataset.page); return; }
            if (e.target.closest('#gm-map-page-add')) { promptAddMap(); return; }
            const th = e.target.closest('.gm-page-thumb');
            if (th) switchMap(th.dataset.page);
        });
        pagesBar.addEventListener('dblclick', (e) => {
            const th = e.target.closest('.gm-page-thumb');
            if (th) promptRenameMap(th.dataset.page);
        });
        // Glisser-déposer d'une vignette sur la carte pour l'AFFICHER (au lieu de cliquer).
        pagesBar.addEventListener('dragstart', (e) => {
            const th = e.target.closest('.gm-page-thumb');
            if (!th) return;
            e.dataTransfer.setData('text/gm-page', th.dataset.page);
            e.dataTransfer.effectAllowed = 'move';
            th.classList.add('gm-page-dragging');
        });
        pagesBar.addEventListener('dragend', (e) => { const th = e.target.closest('.gm-page-thumb'); if (th) th.classList.remove('gm-page-dragging'); });
        const stage = byId('gm-map-view');
        if (stage) {
            const isPageDrag = (e) => Array.from(e.dataTransfer.types || []).indexOf('text/gm-page') !== -1;
            stage.addEventListener('dragover', (e) => { if (!isPageDrag(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; stage.classList.add('gm-stage-drop'); });
            stage.addEventListener('dragleave', (e) => { if (e.target === stage) stage.classList.remove('gm-stage-drop'); });
            stage.addEventListener('drop', (e) => {
                const pid = e.dataTransfer.getData('text/gm-page'); if (!pid) return;
                e.preventDefault(); stage.classList.remove('gm-stage-drop');
                switchMap(pid);
            });
        }

        // --- Préparation (arbre) ---
        setupTreeDnD();
        byId('gm-tree-add').addEventListener('click', treeAdd);
        byId('gm-tree-name').addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); treeAdd(); } });
        byId('gm-tree-file').addEventListener('change', async (e) => {
            const f = e.target.files && e.target.files[0]; e.target.value = ''; const id = pendingTreeUpload; pendingTreeUpload = null;
            if (!f || !id) return;
            try { const res = await window.SupaAuth.uploadAsset(f, 'images'); const n = treeNode(id); treePersist(id, { data: Object.assign({}, n ? n.data : {}, { url: res.url, path: res.path }) }); renderTree(); }
            catch (err) {
                // Repli : Storage indisponible → on enregistre l'image directement dans le nœud (data URL).
                console.warn('upload tree image, repli data URL:', err);
                fileToDataURL(f, (data) => { const n = treeNode(id); treePersist(id, { data: Object.assign({}, n ? n.data : {}, { url: data, path: null }) }); renderTree(); if (window.showAppToast) window.showAppToast('🖼️ Image enregistrée (stockage local).', '#2c3e50'); });
            }
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
                case 'init-fx-add': {
                    const c = find(state.initiative, id); if (!c) break;
                    const raw = prompt('Effet temporaire (la durée en tours peut suivre, ex : « Bénédiction 3 ») :', '');
                    if (raw == null || !raw.trim()) break;
                    const m = raw.trim().match(/^(.*?)[\s:]*(\d+)\s*(?:tours?|rounds?)?$/i);
                    const label = (m && m[1].trim()) ? m[1].trim() : raw.trim();
                    const rounds = (m && m[2]) ? Math.max(1, parseInt(m[2], 10)) : 1;
                    if (!c.effects) c.effects = [];
                    c.effects.push({ label: label.slice(0, 24), rounds: Math.min(99, rounds) });
                    clog('✨ ' + (c.name || 'Combattant') + ' : effet « ' + label + ' » (' + rounds + ' tour' + (rounds > 1 ? 's' : '') + ')');
                    save(); renderInit(); break;
                }
                case 'init-fx-del': {
                    const c = find(state.initiative, id); if (!c || !c.effects) break;
                    const lbl = t.dataset.fx;
                    const idx2 = c.effects.findIndex(f => f.label === lbl);
                    if (idx2 >= 0) c.effects.splice(idx2, 1);
                    save(); renderInit(); break;
                }
                case 'mon-del': state.monsters = state.monsters.filter(m => m.id !== id); save(); renderMonsters(); break;
                case 'mon-eye': { const m = find(state.monsters, id); if (m) { m.hidden = !m.hidden; save(); renderMonsters(); } break; }
                case 'init-eye': { const c = find(state.initiative, id); if (c) { c.hidden = !c.hidden; save(); renderInit(); } break; }
                case 'mon-hp': { const m = find(state.monsters, id); if (m) { const amtEl = document.querySelector('[data-mon-hp-amount="' + id + '"]'); const amt = (amtEl && Math.abs(parseInt(amtEl.value, 10))) || 1; const delta = parseInt(t.dataset.delta) * amt; m.hpCur = Math.max(0, Math.min(m.hpMax, m.hpCur + delta)); clog((delta < 0 ? '💥 ' : '💚 ') + m.name + (delta < 0 ? ' subit ' + (-delta) : ' récupère ' + delta) + ' PV → ' + m.hpCur + '/' + m.hpMax + (m.hpCur <= 0 ? ' ☠️' : '')); save(); renderMonsters(); } break; }
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
                case 'player-inspire': {
                    const p = findLivePlayer(t.dataset.uid);
                    const nm = (p && (p.snapshot && p.snapshot.name || p.character_name)) || 'Le joueur';
                    if (gmBroadcast('inspiration', { targetUserId: t.dataset.uid })) {
                        if (window.showAppToast) window.showAppToast('✨ Inspiration accordée à ' + nm, '#b8862c');
                        clog('✨ Inspiration accordée à ' + nm);
                    }
                    break;
                }
                case 'npc-reveal': {
                    const n = find(state.npcs, id); if (!n) break;
                    const txt = prompt('Texte public affiché aux joueurs (optionnel) :', '');
                    if (txt === null) break;
                    const img = prompt('URL d\'un portrait (optionnel, laisse vide sinon) :', '');
                    if (img === null) break;
                    if (gmBroadcast('npc-card', { name: n.name, text: (txt || '').slice(0, 300), img: (img || '').trim() })) {
                        if (window.showAppToast) window.showAppToast('🎴 « ' + n.name + ' » révélé aux joueurs', '#2c3e50');
                        clog('🎴 PNJ révélé : ' + n.name);
                    }
                    break;
                }
                case 'snap-restore': {
                    const s = loadSnaps().find(x => x.id === id); if (!s) break;
                    if (!confirm('Restaurer la campagne à l\'état du ' + new Date(s.ts).toLocaleString('fr-FR') + ' ?\n(L\'état actuel sera remplacé.)')) break;
                    state = Object.assign(defaultState(), JSON.parse(JSON.stringify(s.state)));
                    ensureMaps(); save(); renderAll(); broadcastMap(true); broadcastCombat();
                    if (window.showAppToast) window.showAppToast('↩️ Campagne restaurée', '#2c3e50');
                    break;
                }
                case 'snap-del': { saveSnaps(loadSnaps().filter(x => x.id !== id)); renderSnaps(); break; }
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
    // ---------- Tutoriel MJ : visite guidée (première ouverture, ou « 🎓 Revoir » dans ⚙️ Réglages) ----------
    const TUTO_KEY = 'dnd-gm-tuto-done';
    let tutoIdx = 0;
    function gmTutoSteps() {
        return [
            { icon: '🛡️', title: 'Bienvenue sur l\'Écran du Maître !', text: 'Petite visite guidée (1 minute). Tu peux la passer à tout moment, et la revoir plus tard depuis ⚙️ Réglages de la carte tactique.' },
            { sel: '#gm-room-btn', icon: '📡', title: 'Joue avec tes joueurs', text: 'Crée une session pour obtenir un CODE à partager. Tes joueurs le saisissent depuis leur fiche, et tu les vois arriver ici en direct (PV, CA, conditions…).' },
            { sel: '.gm-leftbar', icon: '🧰', title: 'La barre d\'outils', text: 'Tout pour animer la carte : souris, signal 📍, dessin ✏️, brouillard 🌫️, murs 🧱, lumières 💡, gabarits de sorts 🎯, jetons 🧝, vue 🗺️ et calques 🗂️. Un clic sur un groupe ouvre son sous-menu.' },
            { sel: '#gm-map-card', icon: '🗺️', title: 'La carte tactique', text: 'Colle une image de fond (Ctrl+V fonctionne !), règle la grille dans ⚙️ Réglages, et gère plusieurs cartes avec 📑 Cartes. Zoom à la molette, déplacement au clic molette.' },
            { sel: '.gm-leftbar [data-tgroup="walls"]', icon: '🧱', title: 'Murs, portes & obscurité', text: 'Trace des murs invisibles pour les joueurs : ils bloquent leurs jetons ET leur vision dans le noir. Les portes s\'ouvrent d\'un clic. Active l\'obscurité 🌑 pour limiter leur vision autour de leur jeton.' },
            { sel: '.gm-leftbar [data-tgroup="tokens"]', icon: '🧝', title: 'Les jetons', text: 'Pose des jetons à l\'avance, assigne-les à tes joueurs (ils pourront les déplacer), et range-les par calques façon Roll20 : Carte, MJ (invisible aux joueurs) ou PJ.' },
            { sel: '#gm-sidebar-toggle', icon: '📜', title: 'Le panneau latéral', text: 'Table des joueurs, lanceur de dés, audio & musique, préparation de séance, journal, et le compendium (règles + conditions 5e cherchables).' },
            { sel: '#gm-shortcuts-btn', icon: '⌨️', title: 'Besoin d\'aide ?', text: 'La touche ? (ou ce bouton) affiche tous les raccourcis clavier. Tu peux revoir ce tutoriel depuis ⚙️ Réglages. Bonne partie ! 🎲' }
        ];
    }
    function onTutoKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); endGmTutorial(); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); tutoIdx++; showTutoStep(); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); tutoIdx = Math.max(0, tutoIdx - 1); showTutoStep(); }
    }
    function startGmTutorial(force) {
        if (!force && localStorage.getItem(TUTO_KEY)) return;
        if (!document.body.classList.contains('gm-active')) return;   // écran MJ refermé entre-temps
        tutoIdx = 0;
        ensureTutoDom();
        document.addEventListener('keydown', onTutoKey, true);        // capture : prime sur les raccourcis d'outils
        showTutoStep();
    }
    function endGmTutorial() {
        try { localStorage.setItem(TUTO_KEY, '1'); } catch (e) {}
        document.removeEventListener('keydown', onTutoKey, true);
        const ov = byId('gm-tuto'); if (ov) ov.remove();
    }
    function ensureTutoDom() {
        let ov = byId('gm-tuto'); if (ov) return ov;
        ov = document.createElement('div'); ov.id = 'gm-tuto'; ov.className = 'no-print';
        ov.innerHTML = '<div class="gm-tuto-spot"></div><div class="gm-tuto-card" role="dialog" aria-label="Tutoriel de l\'écran MJ"></div>';
        document.body.appendChild(ov);
        return ov;
    }
    function showTutoStep() {
        const steps = gmTutoSteps();
        if (tutoIdx >= steps.length) { endGmTutorial(); return; }
        const st = steps[tutoIdx];
        const ov = ensureTutoDom();
        const spot = ov.querySelector('.gm-tuto-spot'), card = ov.querySelector('.gm-tuto-card');
        // Cible mise en lumière (spotlight) — repli : pas de cadre si l'élément est masqué
        let r = null;
        if (st.sel) {
            const el = document.querySelector(st.sel);
            if (el && el.offsetParent !== null) {
                try { el.scrollIntoView({ block: 'nearest' }); } catch (e) {}
                r = el.getBoundingClientRect();
            }
        }
        spot.classList.toggle('gm-tuto-spot-none', !r);
        if (r) {
            const pad = 6;
            spot.style.left = (r.left - pad) + 'px'; spot.style.top = (r.top - pad) + 'px';
            spot.style.width = (r.width + pad * 2) + 'px'; spot.style.height = (r.height + pad * 2) + 'px';
        } else {
            spot.style.left = '50%'; spot.style.top = '50%'; spot.style.width = '0'; spot.style.height = '0';
        }
        const last = tutoIdx === steps.length - 1;
        const dots = steps.map((_, i) => `<span class="gm-tuto-dot${i === tutoIdx ? ' is-on' : ''}"></span>`).join('');
        card.innerHTML = `
            <div class="gm-tuto-head"><span class="gm-tuto-ic">${st.icon}</span><b>${esc(st.title)}</b></div>
            <div class="gm-tuto-text">${esc(st.text)}</div>
            <div class="gm-tuto-dots">${dots}</div>
            <div class="gm-tuto-btns">
                <button class="gm-btn gm-tuto-skip" data-tuto="skip">Passer</button>
                <span class="gm-spacer"></span>
                ${tutoIdx > 0 ? '<button class="gm-btn" data-tuto="prev">← Précédent</button>' : ''}
                <button class="gm-btn gm-btn-primary" data-tuto="next">${last ? 'Terminer ✓' : 'Suivant →'}</button>
            </div>`;
        card.querySelectorAll('[data-tuto]').forEach(b => b.addEventListener('click', () => {
            const act = b.dataset.tuto;
            if (act === 'skip') { endGmTutorial(); return; }
            if (act === 'prev') { tutoIdx = Math.max(0, tutoIdx - 1); showTutoStep(); return; }
            tutoIdx++; showTutoStep();
        }));
        // Position de la bulle : à droite de la cible, sinon à gauche, sinon dessous, sinon centrée
        const vw = window.innerWidth, vh = window.innerHeight;
        const cw = card.offsetWidth, chh = card.offsetHeight;
        let cx = (vw - cw) / 2, cy = (vh - chh) / 2;
        if (r) {
            const M = 14;
            if (r.right + M + cw <= vw - 8) { cx = r.right + M; cy = r.top; }
            else if (r.left - M - cw >= 8) { cx = r.left - M - cw; cy = r.top; }
            else if (r.bottom + M + chh <= vh - 8) { cx = r.left; cy = r.bottom + M; }
            else if (r.top - M - chh >= 8) { cx = r.left; cy = r.top - M - chh; }
            cx = Math.max(8, Math.min(cx, vw - cw - 8));
            cy = Math.max(8, Math.min(cy, vh - chh - 8));
        }
        card.style.left = cx + 'px'; card.style.top = cy + 'px';
    }

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
        // Ancre le lecteur de musique DANS l'onglet Audio de la sidebar (vrai module intégré, plus de flottant).
        try {
            const mp = document.getElementById('music-player-container');
            const audioPanel = ov.querySelector('.gm-side-audio');
            if (mp && audioPanel && mp.parentElement !== audioPanel) { mp.classList.add('music-docked'); audioPanel.insertBefore(mp, audioPanel.firstChild); }
            if (window.MusicPlayer && window.MusicPlayer.show) window.MusicPlayer.show();   // s'assure qu'il est visible une fois ancré
        } catch (e) {}
        try { if (location.hash !== '#gm/' + activeCampaignId) location.hash = '#gm/' + activeCampaignId; } catch (e) {}
        ensureMaps();
        renderAll();
        // Point de départ de l'historique Ctrl+Z (carte + jetons)
        try { mapHist = [JSON.stringify({ map: state.map, tokens: state.tokens })]; } catch (e) { mapHist = []; }
        loadTree();
        loadStateFromCloud(activeCampaignId);                 // rafraîchit depuis le cloud (multi-appareils)
        if (state.sessionId && !live.netChannel) startNetwork(); // reconnecte une session déjà ouverte
        // Première visite : petite visite guidée (skippable, revisionnable dans ⚙️ Réglages)
        if (!localStorage.getItem(TUTO_KEY)) setTimeout(() => startGmTutorial(false), 800);
    }
    function close() {
        stopSoundPreview();                                 // couper un éventuel aperçu de zone sonore
        // Restaure le rôle musique : « joueur » seulement si une session joueur est active, sinon « libre »
        if (window.MusicPlayer && window.MusicPlayer.setRole) {
            const asPlayer = !!(window.PlayerSession && window.PlayerSession.isConnected && window.PlayerSession.isConnected());
            window.MusicPlayer.setRole(asPlayer ? 'player' : 'free');
        }
        // Restaure le lecteur de musique en mode flottant (il était ancré dans le panneau Prépa).
        try { const mp = document.getElementById('music-player-container'); if (mp && mp.classList.contains('music-docked')) { mp.classList.remove('music-docked'); document.body.appendChild(mp); } } catch (e) {}
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
