// =====================================================
// Pages légales — mentions, confidentialité, CGU, CGV
//
// Écran à part entière (#legal-screen), comme les Règles : on reste en page
// unique. Atteignable depuis le menu ☰ ET depuis le pied de l'accueil et de
// l'écran de connexion — les mentions légales doivent être lisibles AVANT
// d'avoir un compte.
//
// Ce qui doit être rempli par l'éditeur du site est laissé EN CLAIR dans le
// texte, sous la forme [À COMPLÉTER : …], et surligné à l'écran. Mieux vaut
// un trou visible qu'une fausse information qui a l'air vraie.
//
// La politique de confidentialité porte le bouton d'export de toutes les
// données : c'est le droit à la portabilité (RGPD, art. 20), et il se sert
// de la passerelle SheetStore comme le lot 2.
// =====================================================
(function () {
    'use strict';

    const MAJ = '4 septembre 2026';        // dernière relecture du texte
    const esc = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    // Les trous à combler sautent aux yeux, dans le texte comme à l'impression.
    const txt = (s) => esc(s).replace(/\[À COMPLÉTER[^\]]*\]/g,
        (m) => `<mark class="legal-todo">${m}</mark>`);

    // =====================================================
    // Les documents
    // Chaque bloc : {h} titre · {p} paragraphe · {ul} liste · {note} encadré
    //               {dl} définitions · {action} bouton
    // =====================================================

    const DOCS = [
        {
            id: 'mentions', tab: '📇 Mentions légales', title: 'Mentions légales',
            intro: 'Qui édite ce site, qui l’héberge, et comment nous joindre.',
            blocks: [
                { h: 'Éditeur du site' },
                { p: 'Le site Bones & Blades est édité par :' },
                { dl: [
                    ['Nom / raison sociale', '[À COMPLÉTER : nom et prénom, ou raison sociale]'],
                    ['Statut', '[À COMPLÉTER : particulier, micro-entreprise, SAS, association…]'],
                    ['Adresse', '[À COMPLÉTER : adresse postale complète]'],
                    ['Courriel', '[À COMPLÉTER : adresse de contact]'],
                    ['Téléphone', '[À COMPLÉTER : facultatif]'],
                    ['Immatriculation', '[À COMPLÉTER : SIRET et RCS si activité professionnelle — sinon écrire « sans objet »]'],
                    ['TVA intracommunautaire', '[À COMPLÉTER : numéro, ou « non applicable — franchise en base de TVA »]'],
                    ['Directeur de la publication', '[À COMPLÉTER : nom du responsable de la publication]']
                ] },
                { note: 'Tant que le site est gratuit et sans activité professionnelle, les mentions '
                      + 'd’immatriculation n’ont pas lieu d’être. Elles deviennent obligatoires dès la '
                      + 'première vente : à remplir avant d’activer le paiement.' },

                { h: 'Hébergement' },
                { p: 'Le site (pages, images, code) est hébergé par :' },
                { dl: [
                    ['Hébergeur', '[À COMPLÉTER : nom de l’hébergeur]'],
                    ['Adresse', '[À COMPLÉTER : adresse postale de l’hébergeur]'],
                    ['Contact', '[À COMPLÉTER : téléphone ou courriel de l’hébergeur]']
                ] },
                { p: 'Les comptes et les fiches de personnage sont stockés chez Supabase, qui assure '
                   + 'l’authentification et la base de données :' },
                { dl: [
                    ['Prestataire', 'Supabase, Inc.'],
                    ['Adresse', '[À COMPLÉTER : adresse du siège figurant au contrat Supabase]'],
                    ['Région d’hébergement', '[À COMPLÉTER : région choisie pour le projet, par ex. eu-west-3 (Paris)]']
                ] },

                { h: 'Propriété intellectuelle' },
                { p: 'Le code, la mise en page, les illustrations et les textes propres au site sont '
                   + 'protégés par le droit d’auteur. Toute reproduction sans autorisation est interdite, '
                   + 'à l’exception de ce que la loi permet (courte citation, copie privée).' },
                { p: 'Les règles du jeu affichées proviennent du System Reference Document 5.1, publié '
                   + 'par Wizards of the Coast sous licence Creative Commons Attribution 4.0 '
                   + '(CC BY 4.0). Cette licence autorise l’usage, la modification et la '
                   + 'redistribution, y compris commerciale, à condition de citer la source — ce que '
                   + 'fait le pied de la page Règles.' },
                { p: 'Dungeons & Dragons, D&D et les logos associés sont des marques de Wizards of the '
                   + 'Coast LLC. Ce site n’est ni édité, ni approuvé, ni soutenu par Wizards of the '
                   + 'Coast. Le contenu du Manuel des Joueurs qui ne figure pas dans le SRD n’est pas '
                   + 'fourni ici : chacun saisit le sien dans son contenu personnel, qui reste privé.' },

                { h: 'Contenu signalé' },
                { p: 'Pour signaler un contenu illicite ou une atteinte à vos droits, écrivez à '
                   + '[À COMPLÉTER : adresse de contact], en précisant l’adresse de la page, la nature '
                   + 'du problème et vos coordonnées. Le signalement est traité dans les meilleurs '
                   + 'délais.' }
            ]
        },

        {
            id: 'confidentialite', tab: '🔒 Confidentialité', title: 'Politique de confidentialité',
            intro: 'Quelles données sont conservées, pourquoi, combien de temps, et ce que vous pouvez exiger.',
            blocks: [
                { note: 'En deux phrases : le site stocke ce que vous écrivez sur vos fiches, plus votre '
                      + 'adresse e-mail si vous créez un compte. Rien n’est vendu, rien n’est utilisé pour '
                      + 'de la publicité, et vous pouvez tout récupérer ou tout effacer quand vous voulez.' },

                { h: 'Responsable du traitement' },
                { p: 'Le responsable du traitement est [À COMPLÉTER : nom ou raison sociale de l’éditeur], '
                   + 'joignable à [À COMPLÉTER : adresse de contact]. '
                   + '[À COMPLÉTER : coordonnées du délégué à la protection des données, si vous en avez '
                   + 'désigné un — ce n’est pas obligatoire pour un site de cette taille].' },

                { h: 'Ce qui est collecté' },
                { p: 'Sans compte, le site fonctionne entièrement dans votre navigateur : rien ne part '
                   + 'ailleurs. Les fiches vivent dans le stockage local de l’appareil.' },
                { p: 'Avec un compte, sont enregistrés :' },
                { ul: [
                    'votre adresse e-mail et un mot de passe, jamais conservé en clair (Supabase le '
                    + 'remplace par une empreinte cryptographique) ;',
                    'le contenu de vos fiches de personnage : nom, caractéristiques, sorts, inventaire, '
                    + 'journal de bord, notes, image de portrait si vous en ajoutez une ;',
                    'votre contenu personnel (classes, sorts, monstres que vous créez) si vous choisissez '
                    + 'de le synchroniser ;',
                    'les dates de création et de dernière modification de chaque personnage ;',
                    'des données techniques enregistrées par l’hébergeur pour la sécurité du service '
                    + '(adresse IP, horodatage des connexions), conservées par Supabase selon ses propres '
                    + 'durées.'
                ] },
                { p: 'Aucune donnée bancaire n’est traitée ni stockée par le site. Le jour où des options '
                   + 'payantes existeront, le paiement sera confié à un prestataire spécialisé qui recevra '
                   + 'directement vos coordonnées bancaires : elles ne transiteront pas par ce site.' },

                { h: 'Pourquoi, et sur quelle base légale' },
                { dl: [
                    ['Fournir le service (compte, sauvegarde, synchronisation)',
                     'Exécution du contrat qui vous lie au site (art. 6.1.b du RGPD).'],
                    ['Sécurité, prévention des abus, journaux techniques',
                     'Intérêt légitime du responsable de traitement (art. 6.1.f).'],
                    ['Répondre à vos messages',
                     'Intérêt légitime, ou exécution du contrat selon la demande.'],
                    ['Facturation et obligations comptables, le cas échéant',
                     'Obligation légale (art. 6.1.c).']
                ] },
                { p: 'Il n’y a ni profilage, ni décision automatisée, ni revente de données, ni publicité '
                   + 'ciblée. Le site ne vous piste pas d’un site à l’autre.' },

                { h: 'Qui y a accès' },
                { ul: [
                    'vous ;',
                    'Supabase, en qualité de sous-traitant, pour héberger la base et gérer les comptes ;',
                    '[À COMPLÉTER : l’hébergeur du site, si différent] ;',
                    '[À COMPLÉTER : le prestataire de paiement, quand les options payantes existeront] ;',
                    'les autorités, uniquement sur réquisition légale.'
                ] },
                { p: 'Si vous partagez une fiche avec votre table, ou si vous rejoignez une session de jeu, '
                   + 'les informations que vous choisissez de montrer deviennent visibles par les autres '
                   + 'participants. C’est vous qui décidez ce que vous partagez.' },

                { h: 'Où sont les données' },
                { p: 'Les données sont hébergées dans la région [À COMPLÉTER : région Supabase du projet]. '
                   + '[À COMPLÉTER : si la région est hors Union européenne, indiquer ici le mécanisme de '
                   + 'transfert utilisé — clauses contractuelles types de la Commission européenne, et le '
                   + 'lien vers l’addendum de traitement de données de Supabase].' },

                { h: 'Combien de temps' },
                { dl: [
                    ['Compte et fiches', 'tant que le compte existe. La suppression du compte efface les '
                     + 'personnages associés.'],
                    ['Compte resté inactif', '[À COMPLÉTER : durée retenue, par ex. 3 ans sans connexion], '
                     + 'après un message d’avertissement envoyé à votre adresse.'],
                    ['Sauvegardes techniques', 'jusqu’à [À COMPLÉTER : durée de rétention des sauvegardes '
                     + 'chez Supabase] après la suppression.'],
                    ['Documents comptables', '10 ans, comme l’impose le code de commerce, le jour où il y '
                     + 'aura des ventes.'],
                    ['Données stockées localement', 'jusqu’à ce que vous vidiez le stockage de votre '
                     + 'navigateur. Elles ne dépendent que de vous.']
                ] },

                { h: 'Vos droits' },
                { p: 'Vous disposez d’un droit d’accès, de rectification, d’effacement, de limitation, '
                   + 'd’opposition et de portabilité, ainsi que du droit de définir des directives sur le '
                   + 'sort de vos données après votre décès.' },
                { p: 'Pour l’essentiel, vous n’avez besoin de demander la permission à personne :' },
                { ul: [
                    'accès et portabilité : le bouton ci-dessous vous rend tout, immédiatement ;',
                    'rectification : vos fiches sont modifiables à tout moment ;',
                    'effacement : supprimez un personnage depuis l’accueil, ou votre compte entier depuis '
                    + 'le menu ☰ → Compte.'
                ] },
                { action: 'export' },
                { p: 'Pour toute autre demande, écrivez à [À COMPLÉTER : adresse de contact]. Une réponse '
                   + 'vous parviendra dans un délai d’un mois, porté à trois mois si la demande est '
                   + 'complexe — vous en serez informé. Une preuve d’identité pourra vous être demandée '
                   + 'en cas de doute sérieux.' },
                { p: 'Si la réponse ne vous satisfait pas, vous pouvez saisir la Commission nationale de '
                   + 'l’informatique et des libertés : CNIL, 3 place de Fontenoy, TSA 80715, 75334 Paris '
                   + 'Cedex 07, ou www.cnil.fr.' },

                { h: 'Cookies et stockage local' },
                { p: 'Le site ne dépose aucun cookie publicitaire ni aucune mesure d’audience. Il n’y a '
                   + 'donc pas de bandeau de consentement : il n’y a rien à consentir.' },
                { ul: [
                    'stockage local (localStorage) : vos fiches, vos réglages, votre contenu personnel. '
                    + 'Strictement nécessaire au fonctionnement, jamais transmis à un tiers ;',
                    'jeton de session déposé par Supabase quand vous êtes connecté, pour vous garder '
                    + 'authentifié. Strictement nécessaire lui aussi ;',
                    'aucun traceur tiers.'
                ] },

                { h: 'Sécurité' },
                { p: 'Les échanges avec le serveur sont chiffrés (HTTPS). L’accès aux données est cloisonné '
                   + 'par compte au niveau de la base : personne ne peut lire les fiches d’un autre. Les '
                   + 'mots de passe sont stockés sous forme d’empreinte, jamais en clair.' },
                { p: 'Aucun système n’est infaillible. En cas de violation de données susceptible '
                   + 'd’engendrer un risque pour vos droits, la CNIL sera notifiée dans les 72 heures et '
                   + 'vous serez prévenu si le risque est élevé.' },

                { h: 'Mineurs' },
                { p: 'La création d’un compte est réservée aux personnes âgées d’au moins '
                   + '[À COMPLÉTER : âge minimum retenu — 15 ans est le seuil français du consentement '
                   + 'numérique]. En dessous, l’accord d’un titulaire de l’autorité parentale est requis. '
                   + 'Le site peut être utilisé sans compte, et donc sans aucune donnée transmise, à tout '
                   + 'âge.' },

                { h: 'Modifications' },
                { p: 'Cette politique peut évoluer. La date de dernière mise à jour figure en haut de la '
                   + 'page ; en cas de changement important, vous en serez informé par courriel ou par un '
                   + 'message dans le site.' }
            ]
        },

        {
            id: 'cgu', tab: '📜 CGU', title: 'Conditions générales d’utilisation',
            intro: 'Ce que le site vous propose, et ce qu’il attend de vous.',
            blocks: [
                { h: 'Objet' },
                { p: 'Les présentes conditions régissent l’utilisation du site Bones & Blades, qui met à '
                   + 'disposition une fiche de personnage pour le jeu de rôle Dungeons & Dragons 5e, une '
                   + 'consultation des règles du SRD, et des outils de table.' },
                { p: 'Utiliser le site vaut acceptation de ces conditions. Si elles ne vous conviennent '
                   + 'pas, n’utilisez pas le site.' },

                { h: 'Le service' },
                { p: 'Le site est utilisable sans compte : tout fonctionne alors dans votre navigateur, y '
                   + 'compris hors connexion. La création d’un compte ajoute la sauvegarde en ligne et la '
                   + 'synchronisation entre appareils.' },
                { p: 'Resteront gratuits, définitivement : la consultation des règles, la fiche de '
                   + 'personnage, les dés, l’usage hors connexion, et l’export comme l’import de vos '
                   + 'fiches. Des options payantes pourront être proposées à côté — elles sont décrites '
                   + 'dans les conditions générales de vente.' },

                { h: 'Votre compte' },
                { ul: [
                    'les informations que vous donnez à l’inscription doivent être exactes ;',
                    'votre mot de passe est personnel : vous êtes responsable de ce qui se fait depuis '
                    + 'votre compte ;',
                    'prévenez [À COMPLÉTER : adresse de contact] si vous soupçonnez un accès non autorisé ;',
                    'un compte est ouvert à une personne : ne le partagez pas.'
                ] },

                { h: 'Ce que vous écrivez reste à vous' },
                { p: 'Les fiches, notes, journaux et contenus que vous créez vous appartiennent. Le site ne '
                   + 's’en attribue aucun droit : la seule autorisation qu’il obtient est celle, technique '
                   + 'et limitée, de les stocker et de vous les réafficher afin de rendre le service. '
                   + 'Cette autorisation s’éteint quand vous supprimez le contenu.' },
                { p: 'Vous êtes responsable de ce que vous saisissez, et notamment de ne pas y recopier des '
                   + 'textes protégés dont vous n’avez pas les droits. Le contenu personnel saisi dans le '
                   + 'site n’est visible que de vous.' },

                { h: 'Usages interdits' },
                { ul: [
                    'publier ou stocker un contenu illicite, haineux, ou portant atteinte aux droits '
                    + 'd’autrui ;',
                    'tenter d’accéder aux données d’un autre utilisateur ;',
                    'perturber le service, le sonder, le contourner ou le surcharger automatiquement ;',
                    'utiliser le site pour redistribuer massivement du contenu sous droit d’auteur.'
                ] },

                { h: 'Disponibilité' },
                { p: 'Le site est fourni tel quel, sans garantie de disponibilité continue. Des '
                   + 'interruptions sont possibles : maintenance, panne de l’hébergeur, ou simple arrêt du '
                   + 'projet. L’éditeur s’engage à faire son possible pour prévenir à l’avance des '
                   + 'interruptions prévisibles.' },
                { note: 'C’est précisément pour cette raison que l’export de fiche est gratuit et le '
                      + 'restera : vos personnages doivent pouvoir vous survivre au site. Prenez '
                      + 'l’habitude d’exporter une sauvegarde de temps en temps — menu ☰ → Fiche & '
                      + 'sauvegardes.' },

                { h: 'Responsabilité' },
                { p: 'L’éditeur ne peut être tenu responsable de la perte de données résultant du '
                   + 'fonctionnement de votre navigateur, du vidage de son stockage, ou d’une défaillance '
                   + 'de l’hébergeur. Sa responsabilité ne saurait être engagée au-delà de ce que la loi '
                   + 'impose, et les dispositions protectrices du consommateur restent pleinement '
                   + 'applicables.' },

                { h: 'Suspension et fermeture' },
                { p: 'Vous pouvez supprimer votre compte à tout moment depuis le menu ☰ → Compte. '
                   + 'L’éditeur peut suspendre ou fermer un compte en cas de manquement grave aux '
                   + 'présentes conditions, après vous en avoir informé sauf urgence ou obligation légale.' },

                { h: 'Modification des conditions' },
                { p: 'Ces conditions peuvent être modifiées. La version applicable est celle publiée sur '
                   + 'cette page ; les changements importants vous seront signalés.' },

                { h: 'Droit applicable' },
                { p: 'Ces conditions sont soumises au droit français. En cas de litige, une solution '
                   + 'amiable sera recherchée en premier lieu ; à défaut, les tribunaux compétents seront '
                   + 'saisis selon les règles de droit commun. Si vous êtes consommateur, vous conservez '
                   + 'le droit de saisir la juridiction de votre lieu de résidence.' }
            ]
        },

        {
            id: 'cgv', tab: '💳 CGV', title: 'Conditions générales de vente',
            intro: 'Les règles applicables aux options payantes : prix, paiement, rétractation, remboursement, résiliation.',
            blocks: [
                { note: 'Aucune option payante n’est encore en vente. Ce document est publié à l’avance, '
                      + 'pour que rien ne soit vendu avant que les règles ne soient écrites et lisibles.' },

                { h: 'Vendeur' },
                { p: 'Les produits sont vendus par [À COMPLÉTER : nom ou raison sociale], '
                   + '[À COMPLÉTER : adresse], [À COMPLÉTER : SIRET], joignable à '
                   + '[À COMPLÉTER : adresse de contact]. Les présentes conditions s’appliquent à toute '
                   + 'commande passée sur le site.' },

                { h: 'Produits' },
                { p: 'Deux natures d’offres sont prévues :' },
                { ul: [
                    'des achats définitifs, essentiellement décoratifs (dés en trois dimensions, fonds '
                    + 'de page, palettes de couleurs, cadres) : payés une fois, acquis sans limite de '
                    + 'durée ;',
                    'un abonnement donnant accès à des services consommant des ressources '
                    + '(fiches synchronisées en nombre illimité, synchronisation du contenu personnel, '
                    + 'quota d’images, sauvegardes automatiques).'
                ] },
                { p: 'Ne seront jamais payants : les règles, les sorts, la fiche de personnage, les dés de '
                   + 'base, l’usage hors connexion, l’export et l’import de vos fiches.' },

                { h: 'Prix' },
                { p: 'Les prix sont indiqués en euros sur la page des tarifs. '
                   + '[À COMPLÉTER : préciser « toutes taxes comprises » ou « TVA non applicable, '
                   + 'art. 293 B du CGI » selon votre régime]. Le prix applicable est celui affiché au '
                   + 'moment de la commande. Une modification de tarif ne s’applique jamais '
                   + 'rétroactivement à un achat déjà réalisé ; pour un abonnement, tout changement de '
                   + 'prix vous sera notifié au moins [À COMPLÉTER : préavis retenu, un mois par exemple] '
                   + 'avant sa prise d’effet, avec la possibilité de résilier sans frais.' },

                { h: 'Commande et paiement' },
                { p: 'La commande est validée lorsque le paiement est confirmé. Le paiement est traité par '
                   + '[À COMPLÉTER : nom du prestataire de paiement, Stripe par exemple] : vos coordonnées '
                   + 'bancaires sont transmises directement à ce prestataire et ne sont ni vues ni '
                   + 'conservées par le site.' },
                { p: 'Un récapitulatif de commande vous est adressé par courriel. '
                   + '[À COMPLÉTER : préciser si une facture est émise et comment la récupérer].' },

                { h: 'Mise à disposition' },
                { p: 'Les produits sont des contenus numériques : ils sont activés sur votre compte dès la '
                   + 'confirmation du paiement, sans livraison physique. En cas de retard technique, '
                   + 'signalez-le à [À COMPLÉTER : adresse de contact] : l’accès sera rétabli ou la '
                   + 'commande remboursée.' },

                { h: 'Droit de rétractation' },
                { p: 'Vous disposez en principe d’un délai de quatorze jours pour vous rétracter, sans '
                   + 'avoir à vous justifier.' },
                { p: 'Toutefois, l’article L. 221-28 13° du code de la consommation prévoit que ce droit '
                   + 'ne s’applique pas à la fourniture d’un contenu numérique sans support matériel dont '
                   + 'l’exécution a commencé après votre accord préalable exprès et votre renoncement '
                   + 'exprès au droit de rétractation.' },
                { p: 'Concrètement : avant de valider votre achat, deux cases distinctes vous seront '
                   + 'présentées — l’une pour demander la mise à disposition immédiate, l’autre pour '
                   + 'reconnaître que vous perdez alors votre droit de rétractation. Si vous ne les '
                   + 'cochez pas, votre produit sera activé à l’expiration du délai de quatorze jours, et '
                   + 'vous conserverez ce droit entre-temps.' },
                { p: 'Pour vous rétracter lorsque le droit s’applique, il suffit d’une déclaration dénuée '
                   + 'd’ambiguïté envoyée à [À COMPLÉTER : adresse de contact]. Le remboursement '
                   + 'intervient dans les quatorze jours suivant la réception de votre demande, par le '
                   + 'même moyen de paiement que celui utilisé pour la commande.' },

                { h: 'Garantie légale de conformité' },
                { p: 'Les contenus numériques sont couverts par la garantie légale de conformité des '
                   + 'articles L. 224-25-12 et suivants du code de la consommation. Si le produit ne '
                   + 'correspond pas à sa description ou ne fonctionne pas, vous pouvez en exiger la mise '
                   + 'en conformité et, à défaut, obtenir une réduction du prix ou la résolution du '
                   + 'contrat. Ces garanties s’exercent sans frais et indépendamment de toute garantie '
                   + 'commerciale.' },

                { h: 'Abonnement, reconduction et résiliation' },
                { p: 'L’abonnement est souscrit pour une durée de '
                   + '[À COMPLÉTER : durée retenue, mensuelle ou annuelle], reconduite tacitement à '
                   + 'chaque échéance sauf résiliation.' },
                { p: 'Vous pouvez résilier à tout moment depuis votre compte, en quelques clics, sans '
                   + 'avoir à écrire ni à téléphoner — comme l’exige l’article L. 215-1-1 du code de la '
                   + 'consommation. La résiliation prend effet à la fin de la période déjà payée : vous '
                   + 'gardez l’accès jusque-là, et rien ne vous est prélevé ensuite.' },
                { p: '[À COMPLÉTER : préciser ce qu’il advient des fiches synchronisées au-delà du quota '
                   + 'gratuit après résiliation — la règle du site est de ne jamais prendre les données '
                   + 'en otage : elles restent lisibles et exportables].' },
                { p: 'Conformément à l’article L. 215-1 du code de la consommation, l’éditeur vous informe '
                   + 'par écrit, au plus tôt trois mois et au plus tard un mois avant l’échéance, de la '
                   + 'possibilité de ne pas reconduire l’abonnement.' },

                { h: 'Réclamations et médiation' },
                { p: 'Adressez toute réclamation à [À COMPLÉTER : adresse de contact]. En l’absence de '
                   + 'solution amiable, vous pouvez recourir gratuitement au médiateur de la consommation '
                   + 'dont relève l’éditeur : [À COMPLÉTER : nom du médiateur, adresse postale et site '
                   + 'internet — l’adhésion à un dispositif de médiation est obligatoire pour tout '
                   + 'professionnel vendant à des consommateurs].' },

                { h: 'Droit applicable' },
                { p: 'Les présentes conditions sont soumises au droit français. Les dispositions d’ordre '
                   + 'public du pays de résidence du consommateur au sein de l’Union européenne restent '
                   + 'applicables.' }
            ]
        }
    ];

    const BY_ID = Object.fromEntries(DOCS.map(d => [d.id, d]));

    // =====================================================
    // Rendu
    // =====================================================

    function renderBlocks(blocks) {
        return blocks.map(b => {
            if (b.h) return `<h2 class="legal-h">${txt(b.h)}</h2>`;
            if (b.p) return `<p>${txt(b.p)}</p>`;
            if (b.ul) return `<ul class="legal-ul">${b.ul.map(li => `<li>${txt(li)}</li>`).join('')}</ul>`;
            if (b.note) return `<div class="legal-note">${txt(b.note)}</div>`;
            if (b.dl) return `<dl class="legal-dl">${b.dl.map(([k, v]) =>
                `<div><dt>${txt(k)}</dt><dd>${txt(v)}</dd></div>`).join('')}</dl>`;
            if (b.action === 'export') return `
                <div class="legal-action no-print">
                    <button type="button" class="legal-btn" data-legal-act="export">
                        📦 Exporter toutes mes données</button>
                    <span class="legal-action-note">Un fichier JSON, lisible par une machine comme par
                        vous : tous vos personnages, votre contenu personnel et vos réglages.</span>
                    <div class="legal-out" role="status"></div>
                </div>`;
            return '';
        }).join('');
    }

    function renderDoc(id) {
        const d = BY_ID[id] || DOCS[0];
        return `<h1 class="legal-title">${txt(d.title)}</h1>
            <p class="legal-intro">${txt(d.intro)}</p>
            <p class="legal-maj">Dernière mise à jour : ${txt(MAJ)}</p>
            ${renderBlocks(d.blocks)}
            <p class="legal-back-top no-print">
                <button type="button" class="legal-link" data-legal-act="print">🖨️ Imprimer cette page</button>
            </p>`;
    }

    // =====================================================
    // L'écran
    // =====================================================

    let built = false;
    let lastScreen = 'home-screen';
    let current = 'mentions';

    function build() {
        if (built) return;
        built = true;
        const scr = document.createElement('div');
        scr.id = 'legal-screen';
        scr.className = 'screen-view hidden';
        scr.innerHTML = `
            <div class="legal-wrap">
                <header class="legal-top no-print">
                    <button type="button" class="legal-back" data-legal-act="back">← Retour</button>
                    <h1>Informations légales</h1>
                </header>
                <nav class="legal-tabs no-print" aria-label="Documents légaux">
                    ${DOCS.map(d => `<button type="button" class="legal-tab" data-doc="${d.id}">${txt(d.tab)}</button>`).join('')}
                </nav>
                <article class="legal-doc" id="legal-doc"></article>
            </div>`;
        document.body.appendChild(scr);

        scr.addEventListener('click', async (e) => {
            const tab = e.target.closest('.legal-tab');
            if (tab) { show(tab.dataset.doc); return; }
            const act = e.target.closest('[data-legal-act]')?.dataset.legalAct;
            if (act === 'back') { window.navTo(lastScreen); return; }
            if (act === 'print') { window.print(); return; }
            if (act === 'export') { await exportAll(e.target.closest('.legal-action')); return; }
        });
    }

    function show(id) {
        current = BY_ID[id] ? id : 'mentions';
        const doc = document.getElementById('legal-doc');
        if (doc) { doc.innerHTML = renderDoc(current); doc.scrollTop = 0; }
        document.querySelectorAll('#legal-screen .legal-tab').forEach(t =>
            t.classList.toggle('is-on', t.dataset.doc === current));
        const wrap = document.querySelector('#legal-screen .legal-wrap');
        if (wrap) wrap.scrollTop = 0;
        try { location.hash = 'legal-' + current; } catch (e) {}
    }

    /** Le droit à la portabilité, en un bouton. */
    async function exportAll(box) {
        const out = box && box.querySelector('.legal-out');
        const btn = box && box.querySelector('[data-legal-act="export"]');
        const say = (msg, cls) => { if (out) { out.className = 'legal-out' + (cls ? ' ' + cls : ''); out.textContent = msg; } };
        if (!window.SheetStore || !window.SheetStore.portability) {
            say('L’export n’a pas pu se charger. Recharge la page et réessaie.', 'is-err');
            return;
        }
        if (btn) { btn.disabled = true; btn.textContent = '⏳ Rassemblement…'; }
        try {
            const data = await window.SheetStore.portability();
            const n = (data.characters || []).length;
            const text = JSON.stringify(data, null, 1);
            const name = 'mes-donnees-bones-and-blades-'
                + new Date().toISOString().slice(0, 10) + '.json';
            if (window.SheetIO && window.SheetIO.download) window.SheetIO.download(name, text);
            else {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
                a.download = name; document.body.appendChild(a); a.click(); a.remove();
            }
            say(n ? `✅ Fichier téléchargé : ${n} personnage${n > 1 ? 's' : ''}, `
                    + `votre contenu personnel et vos réglages.`
                  : '✅ Fichier téléchargé. Il est presque vide : aucun personnage n’est enregistré '
                    + 'sur cet appareil ni sur ce compte.', 'is-ok');
        } catch (err) {
            say('L’export a échoué : ' + err.message, 'is-err');
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = '📦 Exporter toutes mes données'; }
        }
    }

    // =====================================================
    // Les portes d'entrée : le pied de page et le menu
    // =====================================================

    function footHtml() {
        return `<nav class="legal-foot no-print" aria-label="Informations légales">
            ${DOCS.map(d => `<button type="button" class="legal-foot-link" data-legal-open="${d.id}">${txt(d.title)}</button>`).join('<span class="legal-foot-sep" aria-hidden="true">·</span>')}
        </nav>`;
    }

    function mountFooters() {
        // Sur l'écran de connexion, le pied va DANS la carte : l'écran lui-même
        // est une boîte flexible qui centre son unique enfant, un second
        // enfant partirait se poser à côté.
        const spots = [
            document.querySelector('#home-screen .home-container'),
            document.querySelector('#login-screen .auth-card')
        ];
        spots.forEach(el => {
            if (!el || el.querySelector(':scope > .legal-foot')) return;
            el.insertAdjacentHTML('beforeend', footHtml());
        });
    }

    function mountMenu() {
        const menu = document.getElementById('settings-dropdown');
        if (!menu || menu.querySelector('.legal-menu-cat')) return;
        const cat = document.createElement('details');
        cat.className = 'menu-cat legal-menu-cat';
        cat.innerHTML = `<summary>⚖️ Informations légales</summary>
            <div class="menu-cat-body">
                <p class="menu-hint">Qui édite le site, ce qu’il fait de vos données, et à quoi vous
                    vous engagez.</p>
                ${DOCS.map(d => `<button type="button" class="btn-menu-item" data-legal-open="${d.id}">${txt(d.tab)}</button>`).join('')}
                <hr>
                <button type="button" class="btn-menu-item" data-legal-open="confidentialite"
                        style="color:#2e7d4f;">📦 Exporter toutes mes données</button>
            </div>`;
        menu.appendChild(cat);
    }

    /** Ouvre la page depuis n'importe où. */
    function open(docId, from) {
        build();
        const visible = ['home-screen', 'app-screen', 'rules-screen', 'homebrew-screen', 'login-screen']
            .find(id => { const el = document.getElementById(id); return el && !el.classList.contains('hidden'); });
        lastScreen = from || (visible && visible !== 'legal-screen' ? visible : 'home-screen');
        show(docId || current);
        // La page se lit aussi avant d'avoir un compte : sur l'écran de
        // connexion, `navTo` doit pouvoir revenir en arrière.
        window.navTo('legal-screen');
    }

    // Un seul écouteur pour toutes les portes d'entrée, où qu'elles soient.
    document.addEventListener('click', (e) => {
        const b = e.target.closest('[data-legal-open]');
        if (!b) return;
        e.preventDefault();
        document.getElementById('settings-dropdown')?.classList.add('hidden');
        open(b.dataset.legalOpen);
    });

    // La feuille d'impression du site force l'affichage de la fiche
    // (#app-screen), pour que « Enregistrer en PDF » marche depuis n'importe où.
    // Sans ce marqueur, imprimer les mentions légales sortirait le personnage.
    document.addEventListener('screen:change', (e) => {
        document.body.classList.toggle('legal-active', e.detail && e.detail.id === 'legal-screen');
    });

    function init() {
        // `legal-screen` doit exister dans la liste des écrans, sinon navTo
        // ne saurait pas le masquer en repartant.
        if (window.APP_SCREENS && !window.APP_SCREENS.includes('legal-screen')) {
            window.APP_SCREENS.push('legal-screen');
        } else if (typeof APP_SCREENS !== 'undefined' && !APP_SCREENS.includes('legal-screen')) {
            APP_SCREENS.push('legal-screen');
        }
        build();
        mountFooters();
        mountMenu();
        // Lien direct : /#legal-cgv ouvre les CGV.
        const m = /^#legal-([a-z]+)$/.exec(location.hash || '');
        if (m && BY_ID[m[1]]) setTimeout(() => open(m[1], 'home-screen'), 0);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    window.Legal = { open, exportAll, DOCS };
})();
