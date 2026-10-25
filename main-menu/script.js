/**
 * DUST & BLADES — main menu (v3)
 */
(function () {
    'use strict';
    const C = window.DustCore;
    const FX = window.DustFX;
    const M = '../media/';

    let audio = null;
    let scene = null;
    let menuOpen = false;
    let currentUsername = '';
    let currentCharacter = null;
    let hotIndex = 0;

    const $ = id => document.getElementById(id);
    const continueBtn = $('continueBtn');
    const settingsModal = $('settingsModal');
    const leaderboardModal = $('leaderboardModal');
    const patchModal = $('patchModal');
    const PATCH_SEEN = 'dust_patch_seen';   // last patch whose notes were opened
    const confirmDeleteModal = $('confirmDeleteModal');
    const musicSlider = $('musicVolume');
    const sfxSlider = $('sfxVolume');
    const musicVal = $('musicVolumeValue');
    const sfxVal = $('sfxVolumeValue');
    const crtToggle = $('crtToggle');
    const shakeToggle = $('shakeToggle');
    const leaderboardList = $('leaderboardList');
    const menuItems = Array.from(document.querySelectorAll('.menu-item'));

    let savedVolumes = null;

    function playHover() { if (audio) audio.playSfx('hover', 0.7); }
    function playClick() { if (audio) audio.playSfx('click'); }

    /* ---------------- data ---------------- */
    function loadUserData() {
        const savedUser = C.getCurrentUser();
        const savedChar = C.getCurrentCharacter();
        if (!savedUser || !savedChar) {
            window.location.replace('../sign-in/index.html');
            return false;
        }
        currentUsername = savedUser;
        currentCharacter = C.normalizeCharacter(savedChar, savedUser);
        $('welcomeMessage').textContent = 'С ВОЗВРАЩЕНИЕМ, ' + currentUsername.toUpperCase();
        updateStatsDisplay();
        return true;
    }

    function updateStatsDisplay() {
        const ch = currentCharacter;
        const set = (id, val) => { const n = $(id); if (n) n.textContent = val; };
        set('heroName', ch.username.toUpperCase());
        set('heroRank', C.getRank(ch.level || 1));
        set('statLevel', ch.level || 1);
        set('statStrength', ch.strength || 0);
        set('statBestHit', ch.bestHit || 0);
        set('statHp', ch.maxHp || 0);
        set('statGold', ch.gold || 0);
        set('statPotions', ch.inventory.potions || 0);
        set('statKills', ch.totalKills || 0);
        set('statWins', ch.wins || 0);
        set('statCombo', ch.bestCombo || 0);
        paintHardcore();
        set('statHardcore', ch.hardcoreBest ? 'ВОЛНА ' + ch.hardcoreBest : '—');

        const p = C.getExpProgress(ch.level || 1, ch.exp || 0);
        set('expCurrent', ch.exp || 0);
        set('expNext', ch.level >= C.MAX_LEVEL ? 'МАКС' : p.next);
        setTimeout(() => { $('expBarFill').style.width = p.percent + '%'; }, 700);
        $('confirmName').textContent = ch.username;
    }

    /* ---------------- title -> hub ---------------- */
    function openMenu() {
        if (menuOpen) return;
        menuOpen = true;
        try { sessionStorage.setItem('dust_seen_title', '1'); } catch (_) {}
        playClick();
        if (audio) audio.synth('wave');
        document.body.classList.remove('title-phase');
        document.body.classList.add('hub-phase');
        FX.flash('#ffb060', 260, 0.35);
        const r = continueBtn.getBoundingClientRect();
        scene.layer.burst(r.left + r.width / 2, r.top + r.height / 2, {
            count: 50, speed: 220, gravity: -40, life: 1.1, sizes: [1, 1, 2],
            colors: ['#fff2a8', '#ffc14a', '#ff7a1e'], glow: true, additive: true
        });
        setHot(0, true);
    }

    /* ---------------- keyboard menu ---------------- */
    function setHot(i, silent) {
        hotIndex = (i + menuItems.length) % menuItems.length;
        menuItems.forEach((b, j) => b.classList.toggle('is-hot', j === hotIndex));
        if (!silent && audio) audio.playSfx('hover', 0.7);
    }

    function anyModalOpen() {
        return [settingsModal, leaderboardModal, confirmDeleteModal, patchModal].some(m => m.classList.contains('open'));
    }

    function openModal(m) {
        playClick();
        m.classList.add('open');
    }

    function closeModal(m, silent) {
        if (!m.classList.contains('open')) return;
        if (!silent) playClick();
        m.classList.remove('open');
    }

    /* ---------------- actions ---------------- */
    function startGame(mode) {
        playClick();
        if (audio) {
            audio.synth('heavy');
            audio.stopMusic(400);
        }
        const fig = document.querySelector('.hero-figure');
        if (fig && fig.offsetParent) {
            const r = fig.getBoundingClientRect();
            fig.animate([
                { transform: 'none', filter: 'brightness(1)' },
                { transform: 'translateX(-14px) scaleY(.97)', filter: 'brightness(1.6)', offset: 0.35 },
                { transform: 'translateX(60px)', filter: 'brightness(3)', opacity: 0 }
            ], { duration: 420, easing: 'cubic-bezier(.55,0,.85,.35)', fill: 'forwards' });
            scene.layer.slash(r.left + r.width * 0.6, r.top + r.height * 0.45, { radius: r.width * 0.45, width: 6, life: 0.3 });
        }
        FX.flash('#fff', 140, 0.4);
        setTimeout(() => FX.go('../game/index.html' + (mode ? '?mode=' + mode : '')), 250);
    }

    /** Hardcore: locked until every enemy is beaten on every difficulty */
    function paintHardcore() {
        const p = C.hardcoreProgress(currentCharacter);
        const open = p.done >= p.total;
        const btn = $('hardcoreBtn');
        btn.classList.toggle('locked', !open);
        $('hardcoreSub').textContent = open
            ? (currentCharacter.hardcoreBest ? 'РЕКОРД: ВОЛНА ' + currentCharacter.hardcoreBest : 'ОТКРЫТ')
            : 'ЗАКРЫТ · ' + p.done + '/' + p.total;
        btn.title = open ? '' : 'Победи каждого врага на каждой сложности';
    }

    function startHardcore() {
        if (C.isHardcoreUnlocked(currentCharacter)) {
            startGame('hardcore');
            return;
        }
        if (audio) audio.synth('block');
        // the reason goes in the hint line under the menu (the item itself is too narrow for it)
        const hint = document.querySelector('.menu-hint');
        if (!startHardcore.keys) startHardcore.keys = hint.innerHTML;
        const p = C.hardcoreProgress(currentCharacter);
        hint.textContent = 'ПОБЕДИ КАЖДОГО ВРАГА НА КАЖДОЙ СЛОЖНОСТИ · ' + p.done + '/' + p.total;
        hint.classList.add('warn');
        $('hardcoreBtn').animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(0)' }],
            { duration: 280, easing: 'ease-out' });
        clearTimeout(startHardcore.t);
        startHardcore.t = setTimeout(() => {
            hint.innerHTML = startHardcore.keys;
            hint.classList.remove('warn');
        }, 2600);
    }

    function logout() {
        playClick();
        C.clearSession();
        if (audio) audio.stopMusic(400);
        FX.go('../sign-in/index.html');
    }

    function deleteUser() {
        playClick();
        if (audio) audio.synth('heavy');
        const users = C.getUsers().filter(u => u.username !== currentUsername);
        C.saveUsers(users);
        C.clearSession();
        const fig = document.querySelector('.hero-figure');
        if (fig && fig.offsetParent) {
            scene.layer.disintegrate(fig, { palette: ['#2a2a2e', '#4a4a50', '#6b4a32', '#1a1a1c'], dir: 1 });
            fig.style.visibility = 'hidden';
        }
        closeModal(confirmDeleteModal, true);
        if (audio) audio.stopMusic(800);
        setTimeout(() => FX.go('../sign-in/index.html', 600), 900);
    }

    /* ---------------- settings ---------------- */
    function paintRange(input) {
        input.style.setProperty('--v', input.value + '%');
    }

    function syncSettingsUI() {
        const vols = C.getVolumes();
        const vis = C.getVisualSettings();
        musicSlider.value = vols.music;
        sfxSlider.value = vols.sfx;
        musicVal.textContent = vols.music + '%';
        sfxVal.textContent = vols.sfx + '%';
        paintRange(musicSlider);
        paintRange(sfxSlider);
        crtToggle.checked = vis.crt;
        shakeToggle.checked = vis.shake;
    }

    function openSettings() {
        savedVolumes = C.getVolumes();
        syncSettingsUI();
        openModal(settingsModal);
    }

    /** Closing without saving reverts the live preview */
    function cancelSettings() {
        if (savedVolumes && audio) {
            audio.setMusicVolume(savedVolumes.music);
            audio.setSfxVolume(savedVolumes.sfx);
        }
        C.applyVisualSettings();
        closeModal(settingsModal);
    }

    function saveSettings() {
        C.saveVolumes(parseInt(musicSlider.value, 10), parseInt(sfxSlider.value, 10));
        C.saveVisualSettings({ crt: crtToggle.checked, shake: shakeToggle.checked });
        savedVolumes = null;
        if (audio) audio.playSfx('upgrade', 0.6);
        closeModal(settingsModal, true);
    }

    /* ---------------- patch notes ---------------- */
    function showPatchNotes() {
        openModal(patchModal);
        patchModal.querySelector('.pn-list').scrollTop = 0;
        $('patchNew').hidden = true;
        try { localStorage.setItem(PATCH_SEEN, C.VERSION); } catch (_) {}
    }

    /* ---------------- leaderboard ---------------- */
    function getLeaderboard() {
        return C.getUsers()
            .map(u => ({
                username: u.username,
                kills: (u.character && u.character.totalKills) || 0,
                level: (u.character && u.character.level) || 1,
                wins: (u.character && u.character.wins) || 0,
                hardcore: (u.character && u.character.hardcoreBest) || 0
            }))
            .sort((a, b) => b.kills - a.kills || b.wins - a.wins || b.level - a.level)
            .slice(0, 10);
    }

    function showLeaderboard() {
        const leaders = getLeaderboard();
        if (!leaders.length) {
            leaderboardList.innerHTML = '<div class="lb-empty">ПОКА НЕТ ЗАПИСЕЙ</div>';
        } else {
            leaderboardList.innerHTML = leaders.map((l, i) =>
                '<div class="lb-row' + (l.username === currentUsername ? ' me' : '') + '" style="animation-delay:' + (i * 0.05) + 's">' +
                '<span>' + (i < 3 ? '<i class="medal m' + (i + 1) + '">' + (i + 1) + '</i>' : (i + 1)) + '</span>' +
                '<span>' + C.escapeHtml(l.username) + '</span>' +
                '<span>' + l.level + '</span>' +
                '<span>' + l.kills + '</span>' +
                '<span>' + l.wins + '</span>' +
                '<span>' + (l.hardcore || '—') + '</span>' +
                '</div>'
            ).join('');
        }
        openModal(leaderboardModal);
    }

    /* ---------------- wiring ---------------- */
    function loadAudio() {
        audio = C.createAudioManager();
        const vols = C.getVolumes();
        audio.setMusicVolume(vols.music);
        audio.setSfxVolume(vols.sfx);
        audio.loadMusic('menu', M + C.MEDIA.menu, true);
        audio.loadSfx('hover', M + C.MEDIA.hover, 3);
        audio.loadSfx('click', M + C.MEDIA.click, 3);
        audio.loadSfx('upgrade', M + C.MEDIA.upgrade, 1);
    }

    function bindEvents() {
        continueBtn.addEventListener('click', openMenu);
        $('titleScreen').addEventListener('click', openMenu);

        const actions = {
            playBtn: () => startGame(),
            hardcoreBtn: startHardcore,
            leaderboardBtn: showLeaderboard,
            settingsBtn: openSettings,
            logoutBtn: logout
        };
        menuItems.forEach((btn, i) => {
            btn.addEventListener('mouseenter', () => { if (hotIndex !== i) setHot(i); });
            btn.addEventListener('focus', () => { if (hotIndex !== i) setHot(i, true); });
            btn.addEventListener('click', () => actions[btn.id]());
        });

        $('deleteUserBtn').addEventListener('click', () => openModal(confirmDeleteModal));
        $('deleteUserBtn').addEventListener('mouseenter', playHover);
        $('closeConfirmBtn').addEventListener('click', () => closeModal(confirmDeleteModal));
        $('confirmNoBtn').addEventListener('click', () => closeModal(confirmDeleteModal));
        $('confirmYesBtn').addEventListener('click', deleteUser);
        $('closeSettingsBtn').addEventListener('click', cancelSettings);
        $('saveSettingsBtn').addEventListener('click', saveSettings);
        $('closeLeaderboardBtn').addEventListener('click', () => closeModal(leaderboardModal));
        $('patchBtn').addEventListener('click', showPatchNotes);
        $('patchBtn').addEventListener('mouseenter', playHover);
        $('closePatchBtn').addEventListener('click', () => closeModal(patchModal));

        [settingsModal, leaderboardModal, confirmDeleteModal, patchModal].forEach(m => {
            m.addEventListener('click', e => {
                if (e.target !== m) return;
                if (m === settingsModal) cancelSettings();
                else closeModal(m);
            });
            m.querySelectorAll('button').forEach(b => b.addEventListener('mouseenter', playHover));
        });

        musicSlider.addEventListener('input', () => {
            const v = parseInt(musicSlider.value, 10);
            musicVal.textContent = v + '%';
            paintRange(musicSlider);
            if (audio) audio.setMusicVolume(v);
        });
        sfxSlider.addEventListener('input', () => {
            const v = parseInt(sfxSlider.value, 10);
            sfxVal.textContent = v + '%';
            paintRange(sfxSlider);
            if (audio) audio.setSfxVolume(v);
        });
        sfxSlider.addEventListener('change', playClick);
        // ВЫКЛ always switches off and ВКЛ always switches on (not a blind flip)
        document.querySelectorAll('.px-switch').forEach(sw => {
            const input = sw.querySelector('input');
            sw.querySelectorAll('.sw-off, .sw-on').forEach(half => {
                half.addEventListener('click', e => {
                    e.preventDefault();
                    const on = half.classList.contains('sw-on');
                    if (input.checked === on) return;
                    input.checked = on;
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                });
            });
        });
        crtToggle.addEventListener('change', () => {
            playClick();
            document.documentElement.classList.toggle('no-crt', !crtToggle.checked);
        });
        shakeToggle.addEventListener('change', () => {
            playClick();
            document.documentElement.classList.toggle('no-shake', !shakeToggle.checked);
            if (shakeToggle.checked) FX.shake(settingsModal.firstElementChild, 6);
        });

        document.addEventListener('keydown', e => {
            if (e.repeat) return;
            if (!menuOpen) {
                if (e.key !== 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    e.preventDefault();
                    openMenu();
                }
                return;
            }
            if (e.key === 'Escape') {
                if (settingsModal.classList.contains('open')) cancelSettings();
                else if (leaderboardModal.classList.contains('open')) closeModal(leaderboardModal);
                else if (patchModal.classList.contains('open')) closeModal(patchModal);
                else if (confirmDeleteModal.classList.contains('open')) closeModal(confirmDeleteModal);
                return;
            }
            if (anyModalOpen()) return;
            if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'ы') { e.preventDefault(); setHot(hotIndex + 1); }
            else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'ц') { e.preventDefault(); setHot(hotIndex - 1); }
            else if (e.key === 'Enter' || e.key === ' ') {
                if (document.activeElement && document.activeElement.classList.contains('menu-item')) return;
                e.preventDefault();
                menuItems[hotIndex].click();
            }
        });
    }

    function seenTitle() {
        try { return sessionStorage.getItem('dust_seen_title') === '1'; } catch (_) { return false; }
    }

    function init() {
        if (!loadUserData()) return;
        $('versionInfo').textContent = 'ПАТЧ ' + C.VERSION;
        $('patchVersion').textContent = C.VERSION;
        // "NEW" until this patch's notes have been opened once
        let seen = '';
        try { seen = localStorage.getItem(PATCH_SEEN) || ''; } catch (_) {}
        $('patchNew').hidden = seen === C.VERSION;
        scene = window.DustDungeon.build(document.body);
        FX.enter();
        FX.prepareSprite('../media/sprites/hero/idle.png');
        loadAudio();
        bindEvents();
        audio.startMusic('menu');

        // Coming back from a battle skips the title card
        if (seenTitle()) {
            menuOpen = true;
            document.body.classList.remove('title-phase');
            document.body.classList.add('hub-phase');
            setHot(0, true);
        }
    }

    init();
})();
