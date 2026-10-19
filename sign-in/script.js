/**
 * DUST & BLADES — sign-in / register (v3)
 */
(function () {
    'use strict';
    const C = window.DustCore;
    const FX = window.DustFX;
    const M = '../media/';

    let audio = null;
    let scene = null;

    const $ = id => document.getElementById(id);
    const tabs = document.querySelector('.tabs');
    const loginTabBtn = document.querySelector('[data-tab="login"]');
    const registerTabBtn = document.querySelector('[data-tab="register"]');
    const loginTab = $('loginTab');
    const registerTab = $('registerTab');
    const loginErrorDiv = $('loginError');
    const regErrorDiv = $('regError');
    const loginUsername = $('loginUsername');
    const loginPassword = $('loginPassword');
    const regUsername = $('regUsername');
    const regPassword = $('regPassword');
    const regPassword2 = $('regPassword2');
    const panel = document.querySelector('.auth');

    function playHover() { if (audio) audio.playSfx('hover', 0.7); }
    function playClick() { if (audio) audio.playSfx('click'); }

    let errTimer = 0;
    function showError(element, message, field) {
        element.textContent = '✖ ' + message;
        element.hidden = false;
        element.classList.remove('shake-err');
        void element.offsetWidth;
        element.classList.add('shake-err');
        FX.shake(panel, 5);
        if (audio) audio.synth('block');
        if (field) field.focus();
        clearTimeout(errTimer);
        errTimer = setTimeout(() => { element.hidden = true; }, 4500);
    }

    function hideError(element) {
        element.hidden = true;
        element.textContent = '';
    }

    function findUserByName(username) {
        return C.getUsers().find(user => user.username === username);
    }

    /** Burn-away animation + embers burst, then go to the menu */
    function enterMenu() {
        const r = panel.getBoundingClientRect();
        panel.classList.add('sealed');
        if (audio) audio.playSfx('upgrade', 0.9);
        for (let i = 0; i < 5; i++) {
            scene.layer.burst(r.left + r.width * Math.random(), r.top + r.height * Math.random(), {
                count: 26, speed: 140, gravity: -60, life: 1.2,
                colors: ['#fff2a8', '#ffc14a', '#ff7a1e', '#c8321a'], glow: true, additive: true
            });
        }
        setTimeout(() => FX.go('../main-menu/index.html'), 380);
    }

    function registerUser(e) {
        if (e) e.preventDefault();
        playClick();
        hideError(regErrorDiv);

        const username = regUsername.value.trim();
        const password = regPassword.value;
        const password2 = regPassword2.value;

        if (!username) return showError(regErrorDiv, 'Введите имя', regUsername);
        if (username.length < 2) return showError(regErrorDiv, 'Имя должно быть длиннее 1 символа', regUsername);
        if (username.length > 20) return showError(regErrorDiv, 'Имя слишком длинное (макс 20)', regUsername);
        if (!/^[a-zA-Zа-яА-ЯёЁ0-9_\-]+$/.test(username)) {
            return showError(regErrorDiv, 'Только буквы, цифры, _ и -', regUsername);
        }
        if (!password) return showError(regErrorDiv, 'Введите пароль', regPassword);
        if (password.length < 3) return showError(regErrorDiv, 'Пароль минимум 3 символа', regPassword);
        if (password !== password2) return showError(regErrorDiv, 'Пароли не совпадают', regPassword2);
        if (findUserByName(username)) return showError(regErrorDiv, 'Это имя уже занято', regUsername);

        const newCharacter = C.createCharacter(username);
        const users = C.getUsers();
        users.push({
            username,
            passwordHash: C.hashPassword(password),
            character: newCharacter,
            createdAt: new Date().toISOString()
        });
        C.saveUsers(users);
        C.setSession(username, newCharacter);
        enterMenu();
    }

    function loginUser(e) {
        if (e) e.preventDefault();
        playClick();
        hideError(loginErrorDiv);

        const username = loginUsername.value.trim();
        const password = loginPassword.value;

        if (!username) return showError(loginErrorDiv, 'Введите имя', loginUsername);
        if (!password) return showError(loginErrorDiv, 'Введите пароль', loginPassword);

        const user = findUserByName(username);
        if (!user) return showError(loginErrorDiv, 'Такого игрока нет', loginUsername);
        if (user.passwordHash !== C.hashPassword(password)) {
            loginPassword.value = '';
            return showError(loginErrorDiv, 'Неверный пароль', loginPassword);
        }

        // Migrate old characters to new defaults if missing fields
        const character = C.normalizeCharacter(user.character, username);
        character.username = username;

        C.setSession(username, character);
        const users = C.getUsers();
        const idx = users.findIndex(u => u.username === username);
        if (idx !== -1) {
            users[idx].character = character;
            C.saveUsers(users);
        }
        enterMenu();
    }

    function switchTab(tabName) {
        const isLogin = tabName === 'login';
        if (loginTab.classList.contains('active') === isLogin) return;
        playClick();
        hideError(loginErrorDiv);
        hideError(regErrorDiv);

        loginTab.classList.toggle('active', isLogin);
        registerTab.classList.toggle('active', !isLogin);
        loginTabBtn.classList.toggle('active', isLogin);
        registerTabBtn.classList.toggle('active', !isLogin);
        tabs.classList.toggle('reg', !isLogin);

        (isLogin ? loginUsername : regUsername).focus();
    }

    function init() {
        // Already logged in → skip to menu
        if (C.getCurrentUser() && C.getCurrentCharacter()) {
            window.location.replace('../main-menu/index.html');
            return;
        }

        // plain black gate: no dungeon backdrop, only a few embers around the panel
        scene = { layer: FX.createLayer({ z: 1 }) };
        FX.enter();

        // no music here — it starts in the main menu
        audio = C.createAudioManager();
        const vols = C.getVolumes();
        audio.setSfxVolume(vols.sfx);
        audio.loadSfx('hover', M + C.MEDIA.hover, 2);
        audio.loadSfx('click', M + C.MEDIA.click, 2);
        audio.loadSfx('upgrade', M + C.MEDIA.upgrade, 1);

        document.querySelectorAll('button').forEach(btn => btn.addEventListener('mouseenter', playHover));

        loginTab.addEventListener('submit', loginUser);
        registerTab.addEventListener('submit', registerUser);
        loginTabBtn.addEventListener('click', () => switchTab('login'));
        registerTabBtn.addEventListener('click', () => switchTab('register'));

        // quiet typewriter clicks
        document.querySelectorAll('.px-input').forEach(inp => {
            inp.addEventListener('input', () => audio.synth('type'));
        });

        setTimeout(() => loginUsername.focus(), 700);
    }

    init();
})();
