// =====================================================
// MUSIC PLAYER MODULE — D&D Theme
// Fichiers locaux + URLs directes + YouTube
// =====================================================

(function () {
    'use strict';

    // =====================================================
    // ÉTAT
    // =====================================================
    let queue = [];          // [{ id, title, type:'audio'|'youtube', src?, videoId?, badge }]
    let currentIndex = -1;
    let isPlaying = false;
    let loopMode = 0;        // 0=off, 1=all, 2=one
    let isShuffle = false;
    let shuffleOrder = [];
    let isSeeking = false;
    let volume = 0.8;
    let isMuted = false;
    let currentType = null;  // 'audio' | 'youtube'
    let ytPlayer = null;
    let ytPlayerReady = false;
    let ytCheckInterval = null;
    let pendingYTVideoId = null;
    let ytReadyTimeout = null;
    let seekInterval = null;
    let dragSrcIndex = -1;

    // DOM
    let audioEl, seekBar, volumeBar;
    let playBtn, prevBtn, nextBtn, loopBtn, shuffleBtn, volumeBtn, queueToggleBtn;
    let trackTitle, trackSource, timeCurrent, timeTotal;
    let queuePanel, addPanel, queueList;
    let playerBar, container, dragGrip;

    // =====================================================
    // INITIALISATION
    // =====================================================
    document.addEventListener('DOMContentLoaded', () => {
        // Inject HTML into page
        injectHTML();
        // Small delay to ensure DOM is ready
        setTimeout(initRefs, 50);
    });

    function injectHTML() {
        const container = document.createElement('div');
        container.id = 'music-player-container';
        container.className = 'no-print';
        container.innerHTML = `
        <!-- YouTube player caché -->
        <div id="yt-player-wrapper"><div id="yt-player"></div></div>
        <!-- Élément audio HTML5 -->
        <audio id="music-audio-el"></audio>

        <!-- PANNEAU AJOUT -->
        <div id="music-add-panel" class="music-panel hidden">
            <div class="music-panel-header">
                <span class="music-panel-title">🎵 Ajouter de la musique</span>
                <button id="music-btn-add-close" class="music-btn" title="Fermer">✕</button>
            </div>
            <div class="music-add-body">
                <div class="music-add-row">
                    <input type="text" id="music-url-input" class="music-input" placeholder="Lien YouTube ou URL audio directe…">
                    <input type="text" id="music-title-input" class="music-input" placeholder="Titre (optionnel)" style="max-width:180px;">
                    <button id="music-btn-add-url" class="music-add-btn">Ajouter</button>
                </div>
                <div class="music-divider">— ou fichier local —</div>
                <label class="music-file-label">
                    📂 Choisir un ou plusieurs fichiers audio
                    <input type="file" id="music-file-input" accept="audio/*,video/mp4,video/webm" multiple>
                </label>
            </div>
        </div>

        <!-- PANNEAU FILE D'ATTENTE -->
        <div id="music-queue-panel" class="music-panel hidden">
            <div class="music-panel-header">
                <span class="music-panel-title">☰ File d'attente</span>
                <button id="music-btn-add-from-queue" class="music-btn-add-track">➕ Ajouter</button>
                <button id="music-btn-queue-close" class="music-btn" title="Fermer">✕</button>
            </div>
            <div id="music-queue-list" class="music-queue-list">
                <div class="music-queue-empty">Aucune musique dans la file — clique sur ➕ pour en ajouter !</div>
            </div>
        </div>

        <!-- BARRE LECTEUR -->
        <div id="music-player-bar" class="music-player-bar">
            <!-- Poignée de déplacement (glisser à l'horizontale) -->
            <span id="music-drag-grip" class="music-drag-grip" title="Glisser pour déplacer le lecteur">⠿</span>
            <!-- Infos piste -->
            <div class="music-track-info">
                <span class="music-note-icon">♪</span>
                <div class="music-track-details">
                    <span id="music-track-title">Aucune musique</span>
                    <span id="music-track-source"></span>
                </div>
            </div>

            <!-- Contrôles -->
            <div class="music-controls-center">
                <button id="music-btn-prev"    class="music-btn" title="Précédent">⏮</button>
                <button id="music-btn-play"    class="music-btn music-btn-play" title="Lecture / Pause">▶</button>
                <button id="music-btn-next"    class="music-btn" title="Suivant">⏭</button>
                <button id="music-btn-loop"    class="music-btn" title="Boucle">🔁</button>
                <button id="music-btn-shuffle" class="music-btn" title="Aléatoire">🔀</button>
            </div>

            <!-- Barre de progression -->
            <div class="music-progress-area">
                <span id="music-time-current" class="music-time">0:00</span>
                <input type="range" id="music-seek-bar" class="music-range" min="0" max="1000" value="0" step="1">
                <span id="music-time-total" class="music-time music-time-total">0:00</span>
            </div>

            <!-- Volume + Queue + Cacher -->
            <div class="music-controls-right">
                <button id="music-btn-volume" class="music-btn" title="Volume">🔊</button>
                <input type="range" id="music-volume-bar" class="music-range" min="0" max="100" value="80">
                <button id="music-btn-queue-toggle" class="music-btn" title="File d'attente">☰</button>
                <button id="music-btn-hide" class="music-btn" title="Cacher le lecteur">▼</button>
            </div>
        </div>

        <!-- Onglet pour réafficher le lecteur -->
        <div id="music-show-tab" class="music-show-tab hidden" title="Afficher le lecteur">
            <span id="music-tab-note">♪</span>
            <span id="music-tab-title">Lecteur musical</span>
            <span class="music-tab-arrow">▲</span>
        </div>
        `;
        document.body.appendChild(container);
    }

    function initRefs() {
        audioEl     = document.getElementById('music-audio-el');
        seekBar     = document.getElementById('music-seek-bar');
        volumeBar   = document.getElementById('music-volume-bar');
        playBtn     = document.getElementById('music-btn-play');
        prevBtn     = document.getElementById('music-btn-prev');
        nextBtn     = document.getElementById('music-btn-next');
        loopBtn     = document.getElementById('music-btn-loop');
        shuffleBtn  = document.getElementById('music-btn-shuffle');
        volumeBtn   = document.getElementById('music-btn-volume');
        queueToggleBtn = document.getElementById('music-btn-queue-toggle');
        trackTitle  = document.getElementById('music-track-title');
        trackSource = document.getElementById('music-track-source');
        timeCurrent = document.getElementById('music-time-current');
        timeTotal   = document.getElementById('music-time-total');
        queuePanel  = document.getElementById('music-queue-panel');
        addPanel    = document.getElementById('music-add-panel');
        queueList   = document.getElementById('music-queue-list');
        playerBar   = document.getElementById('music-player-bar');
        container   = document.getElementById('music-player-container');
        dragGrip    = document.getElementById('music-drag-grip');

        // Déplacement horizontal du dock + restauration de la position
        setupDock();
        // Préférence d'affichage du module (activé / désactivé via le menu)
        try { if (localStorage.getItem('dnd-show-music-player') === 'false') setVisible(false); } catch (e) {}

        // Volume initial
        audioEl.volume = volume;
        volumeBar.value = volume * 100;
        updateVolumeBar();

        // --- Événements audio ---
        audioEl.addEventListener('timeupdate', onAudioTimeUpdate);
        audioEl.addEventListener('loadedmetadata', () => { timeTotal.textContent = fmt(audioEl.duration); });
        audioEl.addEventListener('ended', onTrackEnded);
        audioEl.addEventListener('error', () => showToast('⚠️ Impossible de lire ce fichier.', '#c0392b'));

        // --- Seek bar ---
        seekBar.addEventListener('mousedown',  () => { isSeeking = true; });
        seekBar.addEventListener('touchstart', () => { isSeeking = true; }, { passive: true });
        seekBar.addEventListener('input', () => {
            updateSeekFill();
            const pct = seekBar.value / 1000;
            if (currentType === 'audio') timeCurrent.textContent = fmt((audioEl.duration || 0) * pct);
            else if (ytPlayerReady)      timeCurrent.textContent = fmt((ytPlayer.getDuration() || 0) * pct);
        });
        seekBar.addEventListener('change', () => {
            isSeeking = false;
            seekTo(seekBar.value / 1000);
        });
        seekBar.addEventListener('mouseup', () => { isSeeking = false; seekTo(seekBar.value / 1000); });

        // --- Volume ---
        volumeBar.addEventListener('input', () => {
            volume = volumeBar.value / 100;
            isMuted = volume === 0;
            applyVolume();
            updateVolumeBar();
            updateVolumeIcon();
        });

        // --- Boutons ---
        playBtn.addEventListener('click', togglePlay);
        prevBtn.addEventListener('click', prevTrack);
        nextBtn.addEventListener('click', nextTrack);
        loopBtn.addEventListener('click', cycleLoop);
        shuffleBtn.addEventListener('click', toggleShuffle);
        volumeBtn.addEventListener('click', toggleMute);
        queueToggleBtn.addEventListener('click', toggleQueuePanel);

        document.getElementById('music-btn-hide').addEventListener('click',            hidePlayer);
        document.getElementById('music-show-tab').addEventListener('click', (e) => { if (e.currentTarget.dataset.dragged === '1') { e.currentTarget.dataset.dragged = '0'; return; } showPlayer(); });
        document.getElementById('music-btn-add-close').addEventListener('click',       closeAddPanel);
        document.getElementById('music-btn-queue-close').addEventListener('click',     closeQueuePanel);
        document.getElementById('music-btn-add-from-queue').addEventListener('click',  openAddPanel);
        document.getElementById('music-btn-add-url').addEventListener('click',         addFromUrl);
        document.getElementById('music-file-input').addEventListener('change',         addFromFile);
        document.getElementById('music-url-input').addEventListener('keydown', e => {
            if (e.key === 'Enter') addFromUrl();
        });

        // Sauvegarde propre avant de quitter
        window.addEventListener('beforeunload', () => {
            if (currentType === 'youtube' && ytPlayer && ytPlayerReady) ytPlayer.stopVideo();
        });
    }

    // =====================================================
    // YOUTUBE IFRAME API
    // =====================================================
    function loadYTApi() {
        if (window.YT || document.getElementById('yt-api-script')) return;
        const s = document.createElement('script');
        s.id = 'yt-api-script';
        s.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(s);
    }

    window.onYouTubeIframeAPIReady = function () {
        ytPlayer = new YT.Player('yt-player', {
            height: '180', width: '320',
            playerVars: { autoplay: 0, controls: 0, disablekb: 1, playsinline: 1, rel: 0 },
            events: {
                onReady() {
                    ytPlayerReady = true;
                    clearTimeout(ytReadyTimeout);
                    if (pendingYTVideoId) { const id = pendingYTVideoId; pendingYTVideoId = null; playYTVideo(id); }
                },
                onStateChange(ev) {
                    if (ev.data === YT.PlayerState.PLAYING) {
                        isPlaying = true;
                        playBtn.textContent = '⏸';
                        playerBar.classList.add('music-playing');
                        startYTSeekPoll();
                    } else if (ev.data === YT.PlayerState.PAUSED) {
                        isPlaying = false;
                        playBtn.textContent = '▶';
                        playerBar.classList.remove('music-playing');
                        stopSeekPoll();
                    } else if (ev.data === YT.PlayerState.ENDED) {
                        stopSeekPoll();
                        onTrackEnded();
                    }
                },
                onError() {
                    showToast('⚠️ Vidéo YouTube indisponible (intégration refusée par la chaîne).', '#c0392b');
                    isPlaying = false;
                    playBtn.textContent = '▶';
                    playerBar.classList.remove('music-playing');
                }
            }
        });
    };

    // Lance une vidéo YouTube de façon robuste : si le player n'est pas encore prêt,
    // la vidéo est mise en attente et démarrée dès l'événement onReady.
    function playYTVideo(videoId) {
        if (!ytPlayerReady || !ytPlayer) {
            pendingYTVideoId = videoId;
            loadYTApi();
            clearTimeout(ytReadyTimeout);
            ytReadyTimeout = setTimeout(() => {
                if (!ytPlayerReady) showToast("⚠️ YouTube ne répond pas. Ouvre le site via un serveur web (pas en double-cliquant le fichier).", '#c0392b');
            }, 7000);
            return;
        }
        try {
            ytPlayer.loadVideoById(videoId);
            ytPlayer.setVolume((isMuted ? 0 : volume) * 100);
            // Relance la lecture si la politique d'autoplay du navigateur l'a bloquée
            setTimeout(() => {
                try { if (ytPlayer && ytPlayer.getPlayerState && ytPlayer.getPlayerState() !== 1) ytPlayer.playVideo(); } catch (e) {}
            }, 400);
        } catch (e) {
            console.error(e);
            showToast('⚠️ Lecture YouTube impossible.', '#c0392b');
        }
    }

    function startYTSeekPoll() {
        stopSeekPoll();
        seekInterval = setInterval(() => {
            if (!ytPlayer || isSeeking) return;
            const cur = ytPlayer.getCurrentTime() || 0;
            const dur = ytPlayer.getDuration()    || 0;
            if (dur > 0) {
                seekBar.value = (cur / dur) * 1000;
                updateSeekFill();
            }
            timeCurrent.textContent = fmt(cur);
            timeTotal.textContent   = fmt(dur);
        }, 400);
    }

    function stopSeekPoll() {
        if (seekInterval) { clearInterval(seekInterval); seekInterval = null; }
    }

    // =====================================================
    // AUDIO NATIF
    // =====================================================
    function onAudioTimeUpdate() {
        if (isSeeking || currentType !== 'audio') return;
        const dur = audioEl.duration || 0;
        const cur = audioEl.currentTime;
        if (dur > 0) {
            seekBar.value = (cur / dur) * 1000;
            updateSeekFill();
        }
        timeCurrent.textContent = fmt(cur);
        timeTotal.textContent   = fmt(dur);
    }

    // =====================================================
    // LECTURE
    // =====================================================
    function togglePlay() {
        if (queue.length === 0) { openAddPanel(); return; }
        if (currentIndex < 0)   { playAtIndex(0); return; }

        if (currentType === 'audio') {
            if (isPlaying) pauseAudio(); else resumeAudio();
        } else if (currentType === 'youtube' && ytPlayerReady) {
            if (isPlaying) ytPlayer.pauseVideo(); else ytPlayer.playVideo();
        }
    }

    function pauseAudio() {
        audioEl.pause();
        isPlaying = false;
        playBtn.textContent = '▶';
        playerBar.classList.remove('music-playing');
    }

    function resumeAudio() {
        audioEl.play().catch(console.error);
        isPlaying = true;
        playBtn.textContent = '⏸';
        playerBar.classList.add('music-playing');
    }

    function prevTrack() {
        // Si > 3s : rembobine sinon piste précédente
        const pos = currentType === 'audio' ? audioEl.currentTime
                  : (ytPlayerReady ? ytPlayer.getCurrentTime() : 0);
        if (pos > 3) { seekTo(0); return; }
        const prev = getPrevIdx();
        if (prev !== -1) playAtIndex(prev);
    }

    function nextTrack() {
        const next = getNextIdx();
        if (next !== -1) playAtIndex(next);
        else if (loopMode === 1) playAtIndex(0);
    }

    function onTrackEnded() {
        if (loopMode === 2) { playCurrentTrack(); return; }
        const next = getNextIdx();
        if (next !== -1) { playAtIndex(next); return; }
        if (loopMode === 1) { playAtIndex(0); return; }
        // Fin de la file
        isPlaying = false;
        playBtn.textContent = '▶';
        playerBar.classList.remove('music-playing');
        seekBar.value = 0;
        updateSeekFill();
        timeCurrent.textContent = '0:00';
    }

    function getNextIdx() {
        if (!queue.length) return -1;
        if (isShuffle && shuffleOrder.length) {
            const pos = shuffleOrder.indexOf(currentIndex);
            if (pos < shuffleOrder.length - 1) return shuffleOrder[pos + 1];
            return loopMode === 1 ? shuffleOrder[0] : -1;
        }
        if (currentIndex < queue.length - 1) return currentIndex + 1;
        return -1;
    }

    function getPrevIdx() {
        if (!queue.length) return -1;
        if (isShuffle && shuffleOrder.length) {
            const pos = shuffleOrder.indexOf(currentIndex);
            return pos > 0 ? shuffleOrder[pos - 1] : shuffleOrder[shuffleOrder.length - 1];
        }
        if (currentIndex > 0) return currentIndex - 1;
        return loopMode === 1 ? queue.length - 1 : -1;
    }

    function playAtIndex(idx) {
        if (idx < 0 || idx >= queue.length) return;
        currentIndex = idx;
        playTrack(queue[idx]);
        renderQueue();
    }

    function playCurrentTrack() {
        if (currentIndex >= 0 && currentIndex < queue.length) playTrack(queue[currentIndex]);
    }

    function playTrack(track) {
        stopAllPlayback();

        trackTitle.textContent  = track.title;
        trackSource.textContent = track.badge;
        seekBar.value = 0;
        updateSeekFill();
        timeCurrent.textContent = '0:00';
        timeTotal.textContent   = '0:00';

        if (track.type === 'youtube') {
            currentType = 'youtube';
            loadYTApi();
            playYTVideo(track.videoId);
        } else {
            currentType = 'audio';
            audioEl.src = track.src;
            audioEl.volume = isMuted ? 0 : volume;
            audioEl.play().then(() => {
                isPlaying = true;
                playBtn.textContent = '⏸';
                playerBar.classList.add('music-playing');
            }).catch(err => {
                console.error(err);
                showToast('⚠️ Impossible de lire ce fichier.', '#c0392b');
            });
        }
    }

    function stopAllPlayback() {
        stopSeekPoll();
        if (currentType === 'audio') { audioEl.pause(); audioEl.src = ''; }
        else if (currentType === 'youtube' && ytPlayerReady) { ytPlayer.stopVideo(); }
        isPlaying = false;
        playBtn.textContent = '▶';
        playerBar.classList.remove('music-playing');
    }

    // =====================================================
    // SEEK & VOLUME
    // =====================================================
    function seekTo(pct) {
        if (currentType === 'audio' && audioEl.duration) {
            audioEl.currentTime = pct * audioEl.duration;
        } else if (currentType === 'youtube' && ytPlayerReady) {
            ytPlayer.seekTo(pct * (ytPlayer.getDuration() || 0), true);
        }
    }

    function applyVolume() {
        const v = isMuted ? 0 : volume;
        audioEl.volume = v;
        if (ytPlayer && ytPlayerReady) ytPlayer.setVolume(v * 100);
    }

    function toggleMute() {
        isMuted = !isMuted;
        volumeBar.value = isMuted ? 0 : volume * 100;
        applyVolume();
        updateVolumeIcon();
        updateVolumeBar();
    }

    function updateVolumeIcon() {
        const v = isMuted ? 0 : volume;
        volumeBtn.textContent = v === 0 ? '🔇' : v < 0.35 ? '🔈' : v < 0.7 ? '🔉' : '🔊';
    }

    function updateVolumeBar() {
        const pct = (isMuted ? 0 : volume) * 100;
        volumeBar.style.background = `linear-gradient(to right, var(--accent-color, #C49B35) ${pct}%, rgba(255,255,255,0.12) ${pct}%)`;
    }

    function updateSeekFill() {
        const pct = (seekBar.value / 10).toFixed(1);
        seekBar.style.background = `linear-gradient(to right, var(--accent-color, #C49B35) ${pct}%, rgba(255,255,255,0.12) ${pct}%)`;
    }

    // =====================================================
    // BOUCLE & ALÉATOIRE
    // =====================================================
    function cycleLoop() {
        loopMode = (loopMode + 1) % 3;
        const icons  = ['🔁', '🔁', '🔂'];
        const titles = ['Pas de boucle', 'Boucle — tout', 'Boucle — piste'];
        loopBtn.textContent = icons[loopMode];
        loopBtn.title       = titles[loopMode];
        loopBtn.classList.toggle('active', loopMode > 0);
        // Pour l'audio natif, loop one = boucle HTML
        if (currentType === 'audio') audioEl.loop = (loopMode === 2);
    }

    function toggleShuffle() {
        isShuffle = !isShuffle;
        shuffleBtn.classList.toggle('active', isShuffle);
        if (isShuffle) buildShuffleOrder();
    }

    function buildShuffleOrder() {
        shuffleOrder = queue.map((_, i) => i);
        for (let i = shuffleOrder.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffleOrder[i], shuffleOrder[j]] = [shuffleOrder[j], shuffleOrder[i]];
        }
        const ci = shuffleOrder.indexOf(currentIndex);
        if (ci > 0) { shuffleOrder.splice(ci, 1); shuffleOrder.unshift(currentIndex); }
    }

    // =====================================================
    // PANNEAUX
    // =====================================================
    function toggleQueuePanel() {
        if (queuePanel.classList.contains('hidden')) {
            queuePanel.classList.remove('hidden');
            addPanel.classList.add('hidden');
        } else {
            queuePanel.classList.add('hidden');
        }
    }

    function closeQueuePanel() { queuePanel.classList.add('hidden'); }

    function hidePlayer() {
        queuePanel.classList.add('hidden');
        addPanel.classList.add('hidden');
        playerBar.classList.add('music-bar-hidden');
        const tab = document.getElementById('music-show-tab');
        tab.classList.remove('hidden');
        // Affiche le titre de la piste dans l'onglet
        document.getElementById('music-tab-title').textContent = trackTitle.textContent || 'Lecteur musical';
        document.getElementById('music-tab-note').textContent = isPlaying ? '♪' : '♩';
    }

    function showPlayer() {
        playerBar.classList.remove('music-bar-hidden');
        document.getElementById('music-show-tab').classList.add('hidden');
    }

    function openAddPanel() {
        addPanel.classList.remove('hidden');
        queuePanel.classList.add('hidden');
    }

    function closeAddPanel() { addPanel.classList.add('hidden'); }

    // =====================================================
    // DÉPLACEMENT DU DOCK (horizontal, toujours en bas)
    // =====================================================
    function clampLeft(px) {
        const w = container.offsetWidth;
        return Math.max(8, Math.min(px, window.innerWidth - w - 8));
    }

    function applyDockLeft(px) {
        container.style.left = clampLeft(px) + 'px';
        container.style.transform = 'none';
    }

    function setupDock() {
        if (!container || !dragGrip) return;

        // Restaure la position sauvegardée (sinon : centré par défaut via le CSS)
        const savedLeft = parseFloat(localStorage.getItem('dnd-music-x'));
        if (!isNaN(savedLeft)) applyDockLeft(savedLeft);

        let dragging = false, grabOffsetX = 0;

        const onMove = (clientX) => {
            if (!dragging) return;
            // Le curseur reste « collé » au point de prise : left = curseur − décalage
            applyDockLeft(clientX - grabOffsetX);
        };
        const onUp = () => {
            if (!dragging) return;
            dragging = false;
            container.classList.remove('music-dragging');
            try { localStorage.setItem('dnd-music-x', parseFloat(container.style.left) || 0); } catch (e) {}
        };
        const startDrag = (clientX) => {
            const rect = container.getBoundingClientRect();
            grabOffsetX = clientX - rect.left;          // distance curseur ↔ bord gauche
            container.style.left = rect.left + 'px';    // épingle EXACTEMENT (aucun saut)
            container.style.transform = 'none';
            dragging = true;
            container.classList.add('music-dragging');
        };

        // TOUTE la barre est une zone de prise, SAUF les vrais contrôles (boutons, sliders…).
        // Aucune dépendance à un élément précis ni à une action préalable → drag dès le 1er clic.
        playerBar.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            if (e.target.closest('button, input, select, textarea, a, label')) return; // laisse les contrôles agir
            e.preventDefault();
            startDrag(e.clientX);
        });
        // Écouteurs sur window : on reçoit toujours move/up, même si le pointeur sort de la barre.
        window.addEventListener('pointermove', (e) => onMove(e.clientX));
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);

        // Garde le dock dans l'écran au redimensionnement
        window.addEventListener('resize', () => {
            if (container.style.left && container.style.left !== '') applyDockLeft(parseFloat(container.style.left) || 0);
        });

        // --- Onglet replié : déplaçable librement à l'horizontale, en bas ---
        const tab = document.getElementById('music-show-tab');
        if (tab) {
            const clampTabLeft = (px) => Math.max(8, Math.min(px, window.innerWidth - tab.offsetWidth - 8));
            const applyTabLeft = (px) => { tab.style.left = clampTabLeft(px) + 'px'; tab.style.right = 'auto'; };

            // Restaure la position sauvegardée de l'onglet
            const savedTabLeft = parseFloat(localStorage.getItem('dnd-music-tab-x'));
            if (!isNaN(savedTabLeft)) applyTabLeft(savedTabLeft);

            let tDrag = false, tMoved = false, tStartX = 0, tGrabOffset = 0;
            const tDown = (clientX) => {
                tDrag = true; tMoved = false;
                const rect = tab.getBoundingClientRect();
                tGrabOffset = clientX - rect.left; tStartX = clientX;
                tab.style.transition = 'none';
                tab.style.left = rect.left + 'px'; tab.style.right = 'auto'; // épingle avant de suivre
            };
            const tMove = (clientX) => {
                if (!tDrag) return;
                if (Math.abs(clientX - tStartX) > 4) tMoved = true;
                applyTabLeft(clientX - tGrabOffset);
            };
            const tUp = () => {
                if (!tDrag) return;
                tDrag = false;
                tab.style.transition = '';
                // mémorise « a bougé » pour empêcher le clic d'ouvrir le lecteur
                tab.dataset.dragged = tMoved ? '1' : '0';
                if (tMoved) { try { localStorage.setItem('dnd-music-tab-x', parseFloat(tab.style.left) || 0); } catch (e) {} }
            };

            tab.style.touchAction = 'none';
            tab.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                try { tab.setPointerCapture(e.pointerId); } catch (_) {}
                tDown(e.clientX);
            });
            tab.addEventListener('pointermove', (e) => { if (tDrag) tMove(e.clientX); });
            tab.addEventListener('pointerup',   (e) => { tUp(); try { tab.releasePointerCapture(e.pointerId); } catch (_) {} });
            tab.addEventListener('pointercancel', tUp);

            window.addEventListener('resize', () => {
                if (tab.style.left && tab.style.left !== '') applyTabLeft(parseFloat(tab.style.left) || 0);
            });
        }
    }

    // =====================================================
    // VISIBILITÉ DU MODULE (activé / désactivé)
    // =====================================================
    function setVisible(on, persist) {
        if (!container) return;
        container.style.display = on ? 'flex' : 'none';
        if (persist) { try { localStorage.setItem('dnd-show-music-player', on ? 'true' : 'false'); } catch (e) {} }
    }

    // API publique : pilotée par le menu des paramètres et le raccourci clavier
    window.MusicPlayer = {
        setVisible: (on, persist = true) => setVisible(on, persist),
        isEnabled:  () => container && container.style.display !== 'none',
        show:       () => { setVisible(true, true); showPlayer(); },
        hide:       () => hidePlayer(),
        // Bascule : ré-active si désactivé, sinon montre/masque la barre
        toggle: () => {
            if (!container) return;
            if (container.style.display === 'none') { setVisible(true, true); showPlayer(); return; }
            if (playerBar.classList.contains('music-bar-hidden')) showPlayer(); else hidePlayer();
        }
    };

    // =====================================================
    // AJOUT DE MUSIQUE
    // =====================================================
    function addFromUrl() {
        const urlEl   = document.getElementById('music-url-input');
        const titleEl = document.getElementById('music-title-input');
        const url = urlEl.value.trim();
        if (!url) return;

        const ytId = extractYTId(url);
        let track;

        if (ytId) {
            track = {
                id: uid(), type: 'youtube', videoId: ytId,
                title: titleEl.value.trim() || 'YouTube – ' + ytId,
                badge: '▶ YouTube',
            };
            loadYTApi();
        } else {
            const ext = url.split('?')[0].split('#')[0].split('.').pop().toLowerCase();
            track = {
                id: uid(), type: 'audio', src: url,
                title: titleEl.value.trim() || decodeURIComponent(url.split('/').pop().split('?')[0]) || 'Piste',
                badge: ext ? ext.toUpperCase() : '🔗 URL',
            };
        }

        queue.push(track);
        urlEl.value = ''; titleEl.value = '';
        renderQueue();
        if (isShuffle) buildShuffleOrder();

        if (currentIndex < 0) { playAtIndex(queue.length - 1); closeAddPanel(); }
        else showToast('✅ Ajouté à la file', '#27ae60');
    }

    function addFromFile(ev) {
        const files = Array.from(ev.target.files);
        if (!files.length) return;
        const wasEmpty = queue.length === 0;

        files.forEach(file => {
            const src = URL.createObjectURL(file);
            const name = file.name.replace(/\.[^/.]+$/, '');
            const ext  = file.name.split('.').pop().toUpperCase();
            queue.push({ id: uid(), type: 'audio', src, title: name, badge: `📁 ${ext}` });
        });

        ev.target.value = '';
        renderQueue();
        if (isShuffle) buildShuffleOrder();

        if (wasEmpty) { playAtIndex(0); closeAddPanel(); }
        else showToast(`✅ ${files.length} fichier(s) ajouté(s)`, '#27ae60');
    }

    function extractYTId(url) {
        const patterns = [
            /(?:youtube\.com\/watch\?(?:[^#&]*&)*v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/
        ];
        for (const p of patterns) { const m = url.match(p); if (m) return m[1]; }
        return null;
    }

    // =====================================================
    // RENDU FILE D'ATTENTE
    // =====================================================
    function renderQueue() {
        if (!queueList) return;
        if (!queue.length) {
            queueList.innerHTML = '<div class="music-queue-empty">Aucune musique dans la file — clique sur ➕ pour en ajouter !</div>';
            return;
        }

        queueList.innerHTML = '';
        queue.forEach((track, i) => {
            const playing = i === currentIndex;
            const item = document.createElement('div');
            item.className = 'music-queue-item' + (playing ? ' is-playing' : '');
            // L'élément entier n'est PAS draggable : seule la poignée l'est.
            // (sinon le navigateur tente de démarrer un drag à chaque clic, ce qui
            //  rendait la sélection d'une piste très difficile)
            item.dataset.index = i;

            item.innerHTML = `
                <span class="music-drag-handle" title="Glisser pour réordonner" draggable="true">⠿</span>
                <span class="music-queue-num">${playing ? '♪' : (i + 1)}</span>
                <span class="music-queue-item-name" title="${esc(track.title)}">${esc(track.title)}</span>
                <span class="music-queue-item-badge">${esc(track.badge)}</span>
                <button class="music-queue-del" title="Supprimer">✕</button>
            `;

            item.addEventListener('click', e => {
                if (e.target.classList.contains('music-queue-del')) return;
                if (e.target.classList.contains('music-drag-handle')) return;
                playAtIndex(i);
            });

            item.querySelector('.music-queue-del').addEventListener('click', e => {
                e.stopPropagation();
                removeTrack(parseInt(item.dataset.index));
            });

            // Drag & drop : déclenché uniquement par la poignée, mais c'est bien
            // l'item entier qui sert de zone de dépôt.
            const handle = item.querySelector('.music-drag-handle');
            handle.addEventListener('dragstart', onDragStart);
            handle.addEventListener('dragend',   onDragEnd);
            item.addEventListener('dragover',   onDragOver);
            item.addEventListener('dragleave',  onDragLeave);
            item.addEventListener('drop',       onDrop);

            queueList.appendChild(item);
        });

        // Scroll vers la piste en cours
        const cur = queueList.querySelector('.is-playing');
        if (cur) cur.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    function removeTrack(idx) {
        // Libérer les blob URLs créés localement
        if (queue[idx]?.src?.startsWith('blob:')) URL.revokeObjectURL(queue[idx].src);

        if (idx === currentIndex) {
            stopAllPlayback();
            currentType = null; currentIndex = -1;
            trackTitle.textContent  = 'Aucune musique';
            trackSource.textContent = '';
            seekBar.value = 0; updateSeekFill();
            timeCurrent.textContent = '0:00';
            timeTotal.textContent   = '0:00';
        } else if (idx < currentIndex) {
            currentIndex--;
        }

        queue.splice(idx, 1);
        if (isShuffle) buildShuffleOrder();
        renderQueue();
    }

    // =====================================================
    // DRAG & DROP
    // =====================================================
    function onDragStart(e) {
        const item = e.currentTarget.closest('.music-queue-item');
        dragSrcIndex = parseInt(item.dataset.index);
        item.classList.add('is-dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', dragSrcIndex);
    }

    function onDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        document.querySelectorAll('#music-queue-list .music-queue-item').forEach(el => el.classList.remove('drag-over'));
        e.currentTarget.classList.add('drag-over');
    }

    function onDragLeave(e) { e.currentTarget.classList.remove('drag-over'); }

    function onDrop(e) {
        e.preventDefault();
        const dropIdx = parseInt(e.currentTarget.dataset.index);
        if (dragSrcIndex === dropIdx) return;

        const dragged = queue.splice(dragSrcIndex, 1)[0];
        queue.splice(dropIdx, 0, dragged);

        // Mettre à jour currentIndex
        if      (dragSrcIndex === currentIndex)                          currentIndex = dropIdx;
        else if (dragSrcIndex < currentIndex && dropIdx >= currentIndex) currentIndex--;
        else if (dragSrcIndex > currentIndex && dropIdx <= currentIndex) currentIndex++;

        if (isShuffle) buildShuffleOrder();
        renderQueue();
    }

    function onDragEnd() {
        document.querySelectorAll('#music-queue-list .music-queue-item').forEach(el => {
            el.classList.remove('is-dragging', 'drag-over');
        });
    }

    // =====================================================
    // UTILITAIRES
    // =====================================================
    function fmt(s) {
        if (!s || isNaN(s) || !isFinite(s)) return '0:00';
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60).toString().padStart(2, '0');
        return `${m}:${sec}`;
    }

    function esc(str) {
        return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

    function showToast(msg, bg = '#27ae60') {
        let t = document.getElementById('music-toast');
        if (!t) {
            t = document.createElement('div');
            t.id = 'music-toast';
            t.style.cssText = 'position:fixed;bottom:80px;right:20px;padding:8px 16px;border-radius:8px;font-family:"Cinzel",serif;font-size:0.85rem;font-weight:bold;z-index:5000;transition:opacity 0.4s;pointer-events:none;box-shadow:0 4px 14px rgba(0,0,0,0.4);';
            document.body.appendChild(t);
        }
        t.style.background = bg;
        t.style.color = '#fff';
        t.textContent = msg;
        t.style.opacity = '1';
        clearTimeout(t._timer);
        t._timer = setTimeout(() => { t.style.opacity = '0'; }, 2200);
    }

})();
