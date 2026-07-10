// DUST & BLADES - СТРАНИЦА ВХОДА/РЕГИСТРАЦИИ
(function() {
    // ========== ЗВУКИ ==========
    let hoverSound = null;
    let clickSound = null;
    let soundEnabled = true;
    
    // Пытаемся загрузить звуки (если файлы есть)
    try {
        hoverSound = new Audio('../media/hover.mp3');
        hoverSound.volume = 0.5;
        clickSound = new Audio('../media/click.mp3');
        clickSound.volume = 0.5;
        // Предзагрузка для более быстрой реакции
        hoverSound.load();
        clickSound.load();
    } catch(e) {
        soundEnabled = false;
    }
    
    function playHover() {
        if (!soundEnabled) return;
        if (!hoverSound) return;
        hoverSound.currentTime = 0;
        hoverSound.play().catch(() => {});
    }
    
    function playClick() {
        if (!soundEnabled) return;
        if (!clickSound) return;
        clickSound.currentTime = 0;
        clickSound.play().catch(() => {});
    }
    
    // ========== ПОЛУЧАЕМ ЭЛЕМЕНТЫ ==========
    const loginTabBtn = document.querySelector('[data-tab="login"]');
    const registerTabBtn = document.querySelector('[data-tab="register"]');
    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');
    
    const doLoginBtn = document.getElementById('doLogin');
    const doRegisterBtn = document.getElementById('doRegister');
    
    const loginErrorDiv = document.getElementById('loginError');
    const regErrorDiv = document.getElementById('regError');
    
    const loginUsername = document.getElementById('loginUsername');
    const loginPassword = document.getElementById('loginPassword');
    const regUsername = document.getElementById('regUsername');
    const regPassword = document.getElementById('regPassword');
    const regPassword2 = document.getElementById('regPassword2');
    
    // ========== ВСЕ КНОПКИ ДЛЯ ЗВУКОВ ==========
    const allButtons = [loginTabBtn, registerTabBtn, doLoginBtn, doRegisterBtn];
    
    // Навешиваем звук наведения
    allButtons.forEach(btn => {
        if (btn) {
            btn.addEventListener('mouseenter', playHover);
        }
    });
    
    // ========== ФУНКЦИИ ОШИБОК ==========
    function showError(element, message) {
        element.textContent = message;
        element.style.display = 'block';
        // Автоматически скрываем ошибку через 4 секунды
        setTimeout(() => {
            if (element.style.display === 'block') {
                element.style.display = 'none';
            }
        }, 4000);
    }
    
    function hideError(element) {
        element.style.display = 'none';
        element.textContent = '';
    }
    
    // ========== РАБОТА С LOCALSTORAGE ==========
    function getUsers() {
        const usersRaw = localStorage.getItem('dust_users');
        if (!usersRaw) return [];
        try { return JSON.parse(usersRaw); }
        catch(e) { return []; }
    }
    
    function saveUsers(users) {
        localStorage.setItem('dust_users', JSON.stringify(users));
    }
    
    function findUserByName(username) {
        const users = getUsers();
        return users.find(user => user.username === username);
    }
    
    function hashPassword(password) {
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            hash = ((hash << 5) - hash) + password.charCodeAt(i);
            hash |= 0;
        }
        return 'hash_' + Math.abs(hash).toString(16);
    }
    
    function createNewCharacter(username) {
        return {
            username: username,
            level: 1,
            exp: 0,
            expToNext: 100,
            strength: 10,
            maxHp: 100,
            currentHp: 100,
            armor: 0,
            gold: 50,
            totalKills: 0,
            inventory: { potions: 3 },
            difficulty: 'normal'
        };
    }
    
    function setCurrentSession(username, characterData) {
        localStorage.setItem('dust_current_user', username);
        localStorage.setItem('dust_current_character', JSON.stringify(characterData));
    }
    
    // ========== РЕГИСТРАЦИЯ ==========
    function registerUser() {
        playClick();
        hideError(regErrorDiv);
        
        const username = regUsername.value.trim();
        const password = regPassword.value;
        const password2 = regPassword2.value;
        
        if (!username) {
            showError(regErrorDiv, 'Имя героя не может быть пустым!');
            return;
        }
        if (username.length < 2) {
            showError(regErrorDiv, 'Имя должно быть длиннее 1 символа');
            return;
        }
        if (username.length > 20) {
            showError(regErrorDiv, 'Имя слишком длинное (макс 20)');
            return;
        }
        if (!password) {
            showError(regErrorDiv, 'Введи пароль!');
            return;
        }
        if (password !== password2) {
            showError(regErrorDiv, 'Пароли не совпадают!');
            return;
        }
        if (password.length < 3) {
            showError(regErrorDiv, 'Пароль минимум 3 символа');
            return;
        }
        
        const existing = findUserByName(username);
        if (existing) {
            showError(regErrorDiv, 'Воин с таким именем уже существует!');
            return;
        }
        
        const hashedPass = hashPassword(password);
        const newCharacter = createNewCharacter(username);
        
        const newUser = {
            username: username,
            passwordHash: hashedPass,
            character: newCharacter,
            createdAt: new Date().toISOString()
        };
        
        const users = getUsers();
        users.push(newUser);
        saveUsers(users);
        
        setCurrentSession(username, newCharacter);
        window.location.href = '../main-menu/index.html';
    }
    
    // ========== ВХОД ==========
    function loginUser() {
        playClick();
        hideError(loginErrorDiv);
        
        const username = loginUsername.value.trim();
        const password = loginPassword.value;
        
        if (!username || !password) {
            showError(loginErrorDiv, 'Заполни имя и пароль!');
            return;
        }
        
        const user = findUserByName(username);
        if (!user) {
            showError(loginErrorDiv, 'Такого воина нет! Зарегистрируйся.');
            return;
        }
        
        const hashedInput = hashPassword(password);
        if (user.passwordHash !== hashedInput) {
            showError(loginErrorDiv, 'Неверный пароль!');
            return;
        }
        
        const characterData = user.character;
        setCurrentSession(username, characterData);
        window.location.href = '../main-menu/index.html';
    }
    
    // ========== ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК ==========
    function switchTab(tabName) {
        playClick();
        hideError(loginErrorDiv);
        hideError(regErrorDiv);
        
        // Очищаем поля при переключении
        if (tabName === 'login') {
            loginTab.classList.add('active');
            registerTab.classList.remove('active');
            loginTabBtn.classList.add('active');
            registerTabBtn.classList.remove('active');
            // Очистка полей регистрации
            regUsername.value = '';
            regPassword.value = '';
            regPassword2.value = '';
        } else {
            loginTab.classList.remove('active');
            registerTab.classList.add('active');
            loginTabBtn.classList.remove('active');
            registerTabBtn.classList.add('active');
            // Очистка полей входа
            loginUsername.value = '';
            loginPassword.value = '';
        }
    }
    
    // ========== НАВЕШИВАЕМ ОБРАБОТЧИКИ ==========
    doLoginBtn.addEventListener('click', loginUser);
    doRegisterBtn.addEventListener('click', registerUser);
    
    loginTabBtn.addEventListener('click', () => switchTab('login'));
    registerTabBtn.addEventListener('click', () => switchTab('register'));
    
    function onEnterPress(event, callback) {
        if (event.key === 'Enter') {
            playClick();
            callback();
        }
    }
    
    loginPassword.addEventListener('keypress', (e) => onEnterPress(e, loginUser));
    loginUsername.addEventListener('keypress', (e) => onEnterPress(e, loginUser));
    regPassword.addEventListener('keypress', (e) => onEnterPress(e, registerUser));
    regPassword2.addEventListener('keypress', (e) => onEnterPress(e, registerUser));
    regUsername.addEventListener('keypress', (e) => onEnterPress(e, registerUser));
})();