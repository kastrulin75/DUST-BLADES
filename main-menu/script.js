(function() {
    let music = null;
    let hoverSound = null;
    let clickSound = null;
    let musicVolume = 50;
    let sfxVolume = 50;
    let menuOpen = false;
    let currentUsername = '';
    let currentCharacter = null;
    
    const menuWrapper = document.getElementById('menuWrapper');
    const logoBox = document.getElementById('logoBox');
    const continueBtn = document.getElementById('continueBtn');
    const playBtn = document.getElementById('playBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    const leaderboardBtn = document.getElementById('leaderboardBtn');
    const buttonsPanel = document.getElementById('buttonsPanel');
    const settingsModal = document.getElementById('settingsModal');
    const leaderboardModal = document.getElementById('leaderboardModal');
    const closeSettings = document.getElementById('closeSettingsBtn');
    const closeLeaderboard = document.getElementById('closeLeaderboardBtn');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    const musicSlider = document.getElementById('musicVolume');
    const sfxSlider = document.getElementById('sfxVolume');
    const musicVal = document.getElementById('musicVolumeValue');
    const sfxVal = document.getElementById('sfxVolumeValue');
    const leaderboardList = document.getElementById('leaderboardList');
    
    const statsSidebar = document.getElementById('statsSidebar');
    const welcomeMessage = document.getElementById('welcomeMessage');
    const deleteUserBtn = document.getElementById('deleteUserBtn');
    const versionInfo = document.getElementById('versionInfo');
    const statStrength = document.getElementById('statStrength');
    const statArmor = document.getElementById('statArmor');
    const statGold = document.getElementById('statGold');
    const statLevel = document.getElementById('statLevel');
    const statPotions = document.getElementById('statPotions');
    const expBarFill = document.getElementById('expBarFill');
    const expCurrentSpan = document.getElementById('expCurrent');
    const expNextSpan = document.getElementById('expNext');
    
    const confirmDeleteModal = document.getElementById('confirmDeleteModal');
    const closeConfirmBtn = document.getElementById('closeConfirmBtn');
    const confirmYesBtn = document.getElementById('confirmYesBtn');
    const confirmNoBtn = document.getElementById('confirmNoBtn');
    
    // Таблица опыта
    const expTable = {
        1: 0, 2: 100, 3: 200, 4: 500, 5: 750,
        6: 1000, 7: 1200, 8: 1500, 9: 2000, 10: 3000,
        11: 4000, 12: 5000, 13: 6000, 14: 7500, 15: 9000,
        16: 11000, 17: 13000, 18: 15000, 19: 18000, 20: 21000,
        21: 24000, 22: 27000, 23: 30000, 24: 35000, 25: 40000
    };
    const MAX_LEVEL = 25;
    
    function getExpForNextLevel(level) {
        if (level >= MAX_LEVEL) return expTable[MAX_LEVEL];
        return expTable[level + 1];
    }
    
    function updateExpBar() {
        if (!currentCharacter) return;
        const currentExp = currentCharacter.exp || 0;
        const currentLevel = currentCharacter.level || 1;
        const expForCurrent = expTable[currentLevel] || 0;
        const expForNext = getExpForNextLevel(currentLevel);
        const expNeeded = expForNext - expForCurrent;
        const expGained = currentExp - expForCurrent;
        const percent = Math.min(100, Math.max(0, (expGained / expNeeded) * 100));
        
        if (expBarFill) expBarFill.style.width = `${percent}%`;
        if (expCurrentSpan) expCurrentSpan.textContent = currentExp;
        if (expNextSpan) expNextSpan.textContent = expForNext;
        if (statLevel) statLevel.textContent = currentLevel;
    }
    
    // Фон
    const bgContainer = document.getElementById('bgContainer');
    bgContainer.innerHTML = '';
    const bgLayer = document.createElement('div');
    bgLayer.style.position = 'absolute';
    bgLayer.style.top = '0';
    bgLayer.style.left = '0';
    bgLayer.style.width = '100%';
    bgLayer.style.height = '100%';
    bgLayer.style.backgroundImage = "url('../media/bg.png')";
    bgLayer.style.backgroundRepeat = 'no-repeat';
    bgLayer.style.backgroundSize = 'cover';
    bgLayer.style.backgroundPosition = 'center';
    bgLayer.style.opacity = '1';
    bgContainer.appendChild(bgLayer);
    
    function loadUserData() {
        const savedUser = localStorage.getItem('dust_current_user');
        const savedChar = localStorage.getItem('dust_current_character');
        if (savedUser && savedChar) {
            currentUsername = savedUser;
            currentCharacter = JSON.parse(savedChar);
            welcomeMessage.textContent = `ПРИВЕТСТВУЕМ, ${currentUsername.toUpperCase()}`;
            updateStatsDisplay();
            updateExpBar();
        } else {
            window.location.href = '../sign-in/index.html';
        }
    }
    
    function updateStatsDisplay() {
        if (currentCharacter) {
            statStrength.textContent = currentCharacter.strength || 0;
            statArmor.textContent = currentCharacter.armor || 0;
            statGold.textContent = currentCharacter.gold || 0;
            statPotions.textContent = (currentCharacter.inventory?.potions) || 0;
            updateExpBar();
        }
    }
    
    function refreshCharacterFromStorage() {
        const savedChar = localStorage.getItem('dust_current_character');
        if (savedChar) {
            currentCharacter = JSON.parse(savedChar);
            updateStatsDisplay();
            updateExpBar();
        }
    }
    
    function deleteUser() {
        let users = [];
        const raw = localStorage.getItem('dust_users');
        if (raw) {
            try { users = JSON.parse(raw); } catch(e) {}
        }
        const newUsers = users.filter(u => u.username !== currentUsername);
        localStorage.setItem('dust_users', JSON.stringify(newUsers));
        localStorage.removeItem('dust_current_user');
        localStorage.removeItem('dust_current_character');
        window.location.href = '../sign-in/index.html';
    }
    
    function openConfirmDelete() { playClick(); confirmDeleteModal.style.display = 'flex'; }
    function closeConfirmDelete() { playClick(); confirmDeleteModal.style.display = 'none'; }
    
    function loadSounds() {
        try {
            music = new Audio('../media/menu.mp3');
            music.loop = true;
            music.volume = musicVolume / 100;
            hoverSound = new Audio('../media/hover.mp3');
            clickSound = new Audio('../media/click.mp3');
        } catch(e) {}
    }
    
    function playHover() {
        if (!hoverSound) return;
        hoverSound.currentTime = 0;
        hoverSound.volume = sfxVolume / 100;
        hoverSound.play().catch(() => {});
    }
    
    function playClick() {
        if (!clickSound) return;
        clickSound.currentTime = 0;
        clickSound.volume = sfxVolume / 100;
        clickSound.play().catch(() => {});
    }
    
    function startMusic() {
        if (!music) return;
        music.currentTime = 0;
        music.volume = musicVolume / 100;
        music.play().catch(() => {
            const once = () => {
                music.play().catch(() => {});
                document.removeEventListener('click', once);
                document.removeEventListener('keydown', once);
            };
            document.addEventListener('click', once);
            document.addEventListener('keydown', once);
        });
    }
    
    function openMenu() {
        if (menuOpen) return;
        playClick();
        menuOpen = true;
        continueBtn.classList.add('hide');
        setTimeout(() => {
            logoBox.style.transform = 'translateY(-80px)';
            buttonsPanel.classList.add('visible');
            statsSidebar.classList.add('visible');
            welcomeMessage.classList.add('visible');
            deleteUserBtn.classList.add('visible');
            versionInfo.classList.add('visible');
        }, 500);
    }
    
    function loadSettings() {
        const vm = localStorage.getItem('dust_music_volume');
        const vs = localStorage.getItem('dust_sfx_volume');
        if (vm !== null) musicVolume = parseInt(vm);
        if (vs !== null) sfxVolume = parseInt(vs);
        
        if (musicSlider) musicSlider.value = musicVolume;
        if (sfxSlider) sfxSlider.value = sfxVolume;
        if (musicVal) musicVal.textContent = musicVolume + '%';
        if (sfxVal) sfxVal.textContent = sfxVolume + '%';
        if (music) music.volume = musicVolume / 100;
    }
    
    function saveSettings() {
        localStorage.setItem('dust_music_volume', musicVolume);
        localStorage.setItem('dust_sfx_volume', sfxVolume);
        if (music) music.volume = musicVolume / 100;
    }
    
    function getLeaderboard() {
        const raw = localStorage.getItem('dust_users');
        if (!raw) return [];
        try {
            const users = JSON.parse(raw);
            const list = users.map(u => ({ username: u.username, kills: u.character?.totalKills || 0 }));
            list.sort((a,b) => b.kills - a.kills);
            return list.slice(0, 10);
        } catch(e) { return []; }
    }
    
    function showLeaderboard() {
        const leaders = getLeaderboard();
        if (!leaders.length) {
            leaderboardList.innerHTML = 'НЕТ ДАННЫХ';
            return;
        }
        let html = '';
        leaders.forEach((l, i) => {
            html += `<div style="display:grid;grid-template-columns:60px 1fr 80px;padding:10px;border-bottom:1px solid #4a3f2c;text-align:center;">
                        <span>${i+1}</span><span>${l.username}</span><span>${l.kills}</span>
                     </div>`;
        });
        leaderboardList.innerHTML = html;
    }
    
    function startGame() { playClick(); window.location.href = '../game/index.html'; }
    function openSettingsModal() { playClick(); settingsModal.style.display = 'flex'; }
    function closeSettingsModal() { playClick(); settingsModal.style.display = 'none'; }
    function openLeaderboardModal() { playClick(); showLeaderboard(); leaderboardModal.style.display = 'flex'; }
    function closeLeaderboardModal() { playClick(); leaderboardModal.style.display = 'none'; }
    
    function bindEvents() {
        continueBtn.addEventListener('click', openMenu);
        playBtn.addEventListener('click', startGame);
        settingsBtn.addEventListener('click', openSettingsModal);
        leaderboardBtn.addEventListener('click', openLeaderboardModal);
        closeSettings.addEventListener('click', closeSettingsModal);
        closeLeaderboard.addEventListener('click', closeLeaderboardModal);
        deleteUserBtn.addEventListener('click', openConfirmDelete);
        closeConfirmBtn.addEventListener('click', closeConfirmDelete);
        confirmYesBtn.addEventListener('click', deleteUser);
        confirmNoBtn.addEventListener('click', closeConfirmDelete);
        
        settingsModal.addEventListener('click', e => { if (e.target === settingsModal) closeSettingsModal(); });
        leaderboardModal.addEventListener('click', e => { if (e.target === leaderboardModal) closeLeaderboardModal(); });
        confirmDeleteModal.addEventListener('click', e => { if (e.target === confirmDeleteModal) closeConfirmDelete(); });
        
        if (musicSlider) {
            musicSlider.addEventListener('input', e => {
                musicVolume = parseInt(e.target.value);
                musicVal.textContent = musicVolume + '%';
                if (music) music.volume = musicVolume / 100;
            });
        }
        if (sfxSlider) {
            sfxSlider.addEventListener('input', e => {
                sfxVolume = parseInt(e.target.value);
                sfxVal.textContent = sfxVolume + '%';
            });
        }
        
        saveSettingsBtn.addEventListener('click', () => { playClick(); saveSettings(); closeSettingsModal(); });
        
        document.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('mouseenter', playHover);
        });
    }
    
    function init() {
        loadUserData();
        loadSettings();
        loadSounds();
        bindEvents();
        startMusic();
        refreshCharacterFromStorage();
    }
    
    init();
})();