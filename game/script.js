// DUST & BLADES - ИГРОВАЯ СЦЕНА
(function() {
    let hero = null;
    let selectedMobType = null;
    let currentWave = 1;
    let enemies = [];
    let selectedEnemyIndex = null;
    let inBattle = false;
    let canAct = true;
    let waitingForEnemy = false;
    let gameActive = true;
    let totalEarnedExp = 0;
    let totalEarnedGold = 0;
    
    let music = null, attackSound = null, potionSound = null, victorySound = null, loseSound = null;
    let coinSound = null, upgradeSound = null, hoverSound = null, clickSound = null;
    let musicVolume = 50, sfxVolume = 50;
    
    // Таблица опыта для уровней
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
    
    function checkLevelUp() {
        let leveled = false;
        while (hero.level < MAX_LEVEL && hero.exp >= getExpForNextLevel(hero.level)) {
            hero.level++;
            hero.maxHp += 15;
            hero.strength += 3;
            hero.currentHp = hero.maxHp;
            leveled = true;
        }
        if (leveled) {
            updateHeroUI();
            saveHero();
        }
    }
    
    const mobsData = {
        skeleton: { 
            name: 'СКЕЛЕТ', hp: 70, maxHp: 70, 
            damageMin: 14, damageMax: 20, 
            exp: 20, gold: 15, 
            img: '../media/skeleton.png', class: '' 
        },
        ghost: { 
            name: 'ПРИЗРАК', hp: 150, maxHp: 150, 
            damageMin: 32, damageMax: 40, 
            exp: 50, gold: 45, 
            img: '../media/ghost.png', class: 'ghost-float' 
        },
        death_knight: { 
            name: 'РЫЦАРЬ СМЕРТИ', hp: 220, maxHp: 220, 
            damageMin: 65, damageMax: 78, 
            exp: 100, gold: 90, 
            img: '../media/death_knight.png', class: '' 
        }
    };
    
    // DOM элементы
    const heroImg = document.getElementById('heroImg');
    const heroHpFill = document.getElementById('heroHpFill');
    const heroHpText = document.getElementById('heroHpText');
    const heroStrengthSpan = document.getElementById('heroStrength');
    const heroArmorSpan = document.getElementById('heroArmor');
    const heroGoldSpan = document.getElementById('heroGold');
    const heroPotionsSpan = document.getElementById('heroPotions');
    const heroLevelSpan = document.getElementById('heroLevel');
    const waveBadge = document.getElementById('waveBadge');
    const enemiesCountSpan = document.getElementById('enemiesCount');
    const enemiesContainer = document.getElementById('enemiesContainer');
    const floatingNumbersDiv = document.getElementById('floatingNumbers');
    const expBarFill = document.getElementById('expBarFill');
    const expCurrentSpan = document.getElementById('expCurrent');
    const expNextSpan = document.getElementById('expNext');
    
    const attackBtn = document.getElementById('attackBtn');
    const potionBtn = document.getElementById('potionBtn');
    const shopBtn = document.getElementById('shopBtn');
    const menuBtn = document.getElementById('menuBtn');
    const mobTypeModal = document.getElementById('mobTypeModal');
    const shopModal = document.getElementById('shopModal');
    const closeShopBtn = document.getElementById('closeShopBtn');
    const closeShopBtn2 = document.getElementById('closeShopBtn2');
    const shopGoldSpan = document.getElementById('shopGold');
    
    function showFloatingNumber(value, type, targetElement) {
        if (!targetElement) return;
        const rect = targetElement.getBoundingClientRect();
        const div = document.createElement('div');
        div.textContent = type === 'damage' ? `-${value}` : `+${value}`;
        div.className = `floating-number ${type === 'damage' ? 'damage' : 'heal'}`;
        div.style.left = `${rect.left + rect.width/2 - 40}px`;
        div.style.top = `${rect.top - 40}px`;
        floatingNumbersDiv.appendChild(div);
        setTimeout(() => div.remove(), 800);
    }
    
    function playSound(sound, volumeMultiplier = 1) {
        if(!sound) return;
        sound.currentTime = 0;
        sound.volume = (sfxVolume/100) * volumeMultiplier;
        sound.play().catch(()=>{});
    }
    function playHover() { playSound(hoverSound); }
    function playClick() { playSound(clickSound); }
    
    function stopMusic() { if(music) { music.pause(); music.currentTime = 0; } }
    function startMusic() {
        if(!music) return;
        music.pause();
        music.currentTime = 0;
        music.volume = musicVolume/100;
        music.play().catch(() => {
            const once = () => {
                music.play().catch(()=>{});
                document.removeEventListener('click', once);
                document.removeEventListener('keydown', once);
            };
            document.addEventListener('click', once);
            document.addEventListener('keydown', once);
        });
    }
    
    function updateExpBar() {
        const currentExp = hero.exp;
        const currentLevel = hero.level;
        const expForCurrent = expTable[currentLevel] || 0;
        const expForNext = getExpForNextLevel(currentLevel);
        const expNeeded = expForNext - expForCurrent;
        const expGained = currentExp - expForCurrent;
        const percent = Math.min(100, Math.max(0, (expGained / expNeeded) * 100));
        
        if (expBarFill) expBarFill.style.width = `${percent}%`;
        if (expCurrentSpan) expCurrentSpan.textContent = currentExp;
        if (expNextSpan) expNextSpan.textContent = expForNext;
        if (heroLevelSpan) heroLevelSpan.textContent = currentLevel;
    }
    
    function loadHero() {
        const saved = localStorage.getItem('dust_current_character');
        if(saved) {
            hero = JSON.parse(saved);
        } else {
            hero = {
                username: localStorage.getItem('dust_current_user') || 'Воин',
                level: 1, exp: 0, maxHp: 150, currentHp: 150, strength: 16, armor: 4, gold: 120, totalKills: 0, inventory: { potions: 6 }
            };
        }
        updateHeroUI();
        updateExpBar();
    }
    
    function saveHero() {
        localStorage.setItem('dust_current_character', JSON.stringify(hero));
        const usersRaw = localStorage.getItem('dust_users');
        if(usersRaw) {
            let users = JSON.parse(usersRaw);
            const idx = users.findIndex(u => u.username === hero.username);
            if(idx !== -1) { users[idx].character = hero; localStorage.setItem('dust_users', JSON.stringify(users)); }
        }
    }
    
    function updateHeroUI() {
        const percent = (hero.currentHp / hero.maxHp) * 100;
        if (heroHpFill) heroHpFill.style.width = `${percent}%`;
        if (heroHpText) heroHpText.textContent = `${hero.currentHp}/${hero.maxHp}`;
        if (heroStrengthSpan) heroStrengthSpan.textContent = hero.strength;
        if (heroArmorSpan) heroArmorSpan.textContent = hero.armor;
        if (heroGoldSpan) heroGoldSpan.textContent = hero.gold;
        if (heroPotionsSpan) heroPotionsSpan.textContent = hero.inventory.potions;
        updateExpBar();
    }
    
    function addExp(amount) {
        hero.exp += amount;
        checkLevelUp();
        saveHero();
        updateHeroUI();
    }
    
    function addGold(amount) { hero.gold += amount; updateHeroUI(); saveHero(); }
    
    function startGameWithMobType(mobKey) {
        selectedMobType = mobKey;
        mobTypeModal.style.display = 'none';
        currentWave = 1;
        totalEarnedExp = 0;
        totalEarnedGold = 0;
        hero.currentHp = hero.maxHp;
        updateHeroUI();
        saveHero();
        startWave(currentWave);
    }
    
    function startWave(waveNum) {
        currentWave = waveNum;
        const count = waveNum;
        const baseData = mobsData[selectedMobType];
        enemies = [];
        for(let i=0; i<count; i++) {
            enemies.push({
                id: i, name: baseData.name, currentHp: baseData.hp, maxHp: baseData.hp,
                damageMin: baseData.damageMin, damageMax: baseData.damageMax,
                exp: baseData.exp, gold: baseData.gold, img: baseData.img, class: baseData.class,
                mobType: selectedMobType
            });
        }
        updateWaveUI();
        renderEnemies();
        selectedEnemyIndex = 0;
        highlightSelectedEnemy();
        inBattle = true;
        canAct = true;
        waitingForEnemy = false;
        gameActive = true;
    }
    
    function updateWaveUI() {
        if (waveBadge) waveBadge.textContent = `ВОЛНА ${currentWave}/3`;
        if (enemiesCountSpan) enemiesCountSpan.textContent = `ВРАГОВ: ${enemies.length}`;
    }
    
    function renderEnemies() {
        if (!enemiesContainer) return;
        enemiesContainer.innerHTML = '';
        const count = enemies.length;
        if(count === 3) {
            enemiesContainer.classList.add('triangle');
            const topRow = document.createElement('div');
            topRow.className = 'triangle-row';
            const bottomRow = document.createElement('div');
            bottomRow.className = 'triangle-row front';
            enemies.forEach((enemy, idx) => {
                const card = createEnemyCard(enemy, idx);
                if(idx < 2) topRow.appendChild(card);
                else bottomRow.appendChild(card);
            });
            enemiesContainer.appendChild(topRow);
            enemiesContainer.appendChild(bottomRow);
        } else {
            enemiesContainer.classList.remove('triangle');
            enemies.forEach((enemy, idx) => {
                enemiesContainer.appendChild(createEnemyCard(enemy, idx));
            });
        }
    }
    
    function createEnemyCard(enemy, idx) {
        const card = document.createElement('div');
        card.className = 'enemy-card';
        if (enemy.mobType) card.setAttribute('data-mob-type', enemy.mobType);
        if(selectedEnemyIndex === idx) card.classList.add('selected');
        card.dataset.index = idx;
        const img = document.createElement('img');
        img.src = enemy.img;
        img.className = `enemy-sprite ${enemy.class}`;
        img.onerror = () => { img.src = '../media/skeleton.png'; };
        if(enemy.class === 'ghost-float') {
            img.style.animationDelay = `${Math.random() * 2}s`;
        }
        const hpDiv = document.createElement('div');
        hpDiv.className = 'hp-bar-container enemy-hp-bar';
        const fill = document.createElement('div');
        fill.className = 'hp-bar-fill';
        fill.style.width = `${(enemy.currentHp/enemy.maxHp)*100}%`;
        const hpText = document.createElement('span');
        hpText.className = 'hp-text';
        hpText.textContent = `${enemy.currentHp}/${enemy.maxHp}`;
        hpDiv.appendChild(fill);
        hpDiv.appendChild(hpText);
        const nameSpan = document.createElement('div');
        nameSpan.className = 'enemy-name';
        nameSpan.textContent = enemy.name;
        card.appendChild(img);
        card.appendChild(hpDiv);
        card.appendChild(nameSpan);
        card.addEventListener('click', (e) => {
            e.stopPropagation();
            if(!inBattle || waitingForEnemy || !canAct || !gameActive) return;
            if(enemies.length === 1) return;
            selectedEnemyIndex = idx;
            highlightSelectedEnemy();
        });
        return card;
    }
    
    function highlightSelectedEnemy() {
        const cards = document.querySelectorAll('.enemy-card');
        cards.forEach((card, i) => {
            if(i === selectedEnemyIndex) card.classList.add('selected');
            else card.classList.remove('selected');
        });
    }
    
    function updateEnemyHpUI(index) {
        const cards = document.querySelectorAll('.enemy-card');
        const card = cards[index];
        if(card) {
            const fill = card.querySelector('.hp-bar-fill');
            const textSpan = card.querySelector('.hp-text');
            const enemy = enemies[index];
            if(fill) fill.style.width = `${(enemy.currentHp/enemy.maxHp)*100}%`;
            if(textSpan) textSpan.textContent = `${enemy.currentHp}/${enemy.maxHp}`;
        }
    }
    
    async function heroAttack() {
        if(!inBattle || !canAct || waitingForEnemy || !gameActive) return;
        if(enemies.length === 0) return;
        let targetIndex = selectedEnemyIndex;
        if(targetIndex >= enemies.length || !enemies[targetIndex] || enemies[targetIndex].currentHp <= 0) {
            const aliveIndex = enemies.findIndex(e => e.currentHp > 0);
            if(aliveIndex === -1) return;
            targetIndex = aliveIndex;
            selectedEnemyIndex = targetIndex;
            highlightSelectedEnemy();
        }
        const target = enemies[targetIndex];
        if(!target || target.currentHp <= 0) return;
        
        canAct = false;
        playSound(attackSound);
        if (heroImg) heroImg.classList.add('hero-attack-animation');
        setTimeout(() => { if (heroImg) heroImg.classList.remove('hero-attack-animation'); }, 300);
        
        const damage = hero.strength + Math.floor(Math.random() * 10) + 1;
        target.currentHp = Math.max(0, target.currentHp - damage);
        updateEnemyHpUI(targetIndex);
        const targetSprite = document.querySelectorAll('.enemy-sprite')[targetIndex];
        if(targetSprite) showFloatingNumber(damage, 'damage', targetSprite);
        
        if(target.currentHp <= 0) {
            playSound(coinSound);
            totalEarnedExp += target.exp;
            totalEarnedGold += target.gold;
            addGold(target.gold);
            addExp(target.exp);
            hero.totalKills = (hero.totalKills || 0) + 1;
            saveHero();
            enemies.splice(targetIndex, 1);
            renderEnemies();
            updateWaveUI();
            if(enemies.length === 0) {
                if(currentWave < 3) {
                    hero.currentHp = hero.maxHp;
                    updateHeroUI();
                    saveHero();
                    currentWave++;
                    startWave(currentWave);
                    canAct = true;
                    waitingForEnemy = false;
                    return;
                } else {
                    victoryGame();
                    return;
                }
            } else {
                if(targetIndex >= enemies.length) selectedEnemyIndex = enemies.length - 1;
                else selectedEnemyIndex = targetIndex;
                highlightSelectedEnemy();
                if(!waitingForEnemy) {
                    waitingForEnemy = true;
                    setTimeout(async () => {
                        await enemyAttackAll();
                        waitingForEnemy = false;
                        if(gameActive && inBattle && hero.currentHp > 0 && enemies.length > 0) {
                            canAct = true;
                        }
                    }, 3000);
                }
                canAct = false;
                return;
            }
        }
        
        waitingForEnemy = true;
        setTimeout(async () => {
            await enemyAttackAll();
            waitingForEnemy = false;
            if(gameActive && inBattle && hero.currentHp > 0 && enemies.length > 0) {
                canAct = true;
            }
        }, 3000);
    }
    
    async function enemyAttackAll() {
        if(!inBattle || enemies.length === 0 || hero.currentHp <= 0 || !gameActive) return;
        for(let i=0; i<enemies.length; i++) {
            const enemy = enemies[i];
            if(enemy.currentHp <= 0) continue;
            playSound(attackSound, 0.7);
            const enemySprite = document.querySelectorAll('.enemy-sprite')[i];
            if(enemySprite) {
                enemySprite.classList.add('mob-attack-animation');
                setTimeout(() => enemySprite.classList.remove('mob-attack-animation'), 400);
            }
            const damage = Math.floor(Math.random() * (enemy.damageMax - enemy.damageMin + 1) + enemy.damageMin);
            let finalDamage = Math.max(1, damage - hero.armor);
            hero.currentHp = Math.max(0, hero.currentHp - finalDamage);
            updateHeroUI();
            if (heroImg) showFloatingNumber(finalDamage, 'damage', heroImg);
            if(hero.currentHp <= 0) break;
            await new Promise(r => setTimeout(r, 400));
        }
        saveHero();
        if(hero.currentHp <= 0) {
            defeatGame();
        }
    }
    
    async function usePotion() {
        if(!inBattle || !canAct || waitingForEnemy || !gameActive) return;
        if(hero.inventory.potions <= 0) return;
        if(hero.currentHp === hero.maxHp) return;
        canAct = false;
        playSound(potionSound);
        hero.inventory.potions--;
        const heal = Math.floor(hero.maxHp * 0.35);
        hero.currentHp = Math.min(hero.maxHp, hero.currentHp + heal);
        updateHeroUI();
        if (heroImg) showFloatingNumber(heal, 'heal', heroImg);
        saveHero();
        waitingForEnemy = true;
        setTimeout(async () => {
            await enemyAttackAll();
            waitingForEnemy = false;
            if(gameActive && inBattle && hero.currentHp > 0 && enemies.length > 0) {
                canAct = true;
            }
        }, 3000);
    }
    
    function victoryGame() {
        inBattle = false;
        gameActive = false;
        stopMusic();
        playSound(victorySound, 1.2);
        showResultScreen('victory', totalEarnedExp, totalEarnedGold);
    }
    
    function defeatGame() {
        inBattle = false;
        gameActive = false;
        stopMusic();
        playSound(loseSound);
        showResultScreen('lose', 0, 0);
    }
    
    function showResultScreen(type, earnedExp, earnedGold) {
        const overlay = document.createElement('div');
        overlay.className = 'result-overlay';
        const img = document.createElement('img');
        img.src = type === 'victory' ? '../media/victory.png' : '../media/lose.png';
        img.className = 'result-image';
        img.onerror = () => { img.style.display = 'none'; };
        overlay.appendChild(img);
        
        if(type === 'victory') {
            const statsDiv = document.createElement('div');
            statsDiv.className = 'result-stats';
            statsDiv.innerHTML = `ПОБЕДА!<br>ОПЫТ: +${earnedExp}<br>ЗОЛОТО: +${earnedGold}`;
            overlay.appendChild(statsDiv);
        } else {
            const statsDiv = document.createElement('div');
            statsDiv.className = 'result-stats';
            statsDiv.innerHTML = `ПОРАЖЕНИЕ...<br>ВЫ НЕ СМОГЛИ ПРОЙТИ ВСЕ ВОЛНЫ`;
            overlay.appendChild(statsDiv);
        }
        
        const btnDiv = document.createElement('div');
        btnDiv.className = 'result-buttons';
        const restartBtn = document.createElement('button');
        restartBtn.textContent = 'ЗАНОВО';
        restartBtn.className = 'result-btn';
        restartBtn.onclick = () => {
            overlay.remove();
            restartGame();
        };
        const menuBtnEl = document.createElement('button');
        menuBtnEl.textContent = 'МЕНЮ';
        menuBtnEl.className = 'result-btn';
        menuBtnEl.onclick = () => {
            window.location.href = '../main-menu/index.html';
        };
        btnDiv.appendChild(restartBtn);
        btnDiv.appendChild(menuBtnEl);
        overlay.appendChild(btnDiv);
        document.body.appendChild(overlay);
    }
    
    function restartGame() {
        enemies = [];
        currentWave = 1;
        selectedEnemyIndex = null;
        inBattle = false;
        canAct = true;
        waitingForEnemy = false;
        gameActive = true;
        totalEarnedExp = 0;
        totalEarnedGold = 0;
        hero.currentHp = hero.maxHp;
        updateHeroUI();
        saveHero();
        startMusic();
        if (mobTypeModal) mobTypeModal.style.display = 'flex';
    }
    
    function openShop() { 
        if (shopGoldSpan) shopGoldSpan.textContent = hero.gold; 
        if (shopModal) shopModal.style.display = 'flex'; 
    }
    function closeShop() { 
        if (shopModal) shopModal.style.display = 'none'; 
    }
    
    // Покупка за ЗОЛОТО
    function buyUpgrade(type) {
        if(type === 'strength' && hero.gold >= 30) { 
            hero.gold -= 30; 
            hero.strength += 2; 
            playSound(upgradeSound); 
            updateHeroUI(); 
            saveHero(); 
        }
        else if(type === 'armor' && hero.gold >= 40) { 
            hero.gold -= 40; 
            hero.armor += 2; 
            playSound(upgradeSound); 
            updateHeroUI(); 
            saveHero(); 
        }
        else if(type === 'potion' && hero.gold >= 30) { 
            hero.gold -= 30; 
            hero.inventory.potions++; 
            playSound(coinSound); 
            updateHeroUI(); 
            saveHero(); 
        }
        if (shopGoldSpan) shopGoldSpan.textContent = hero.gold;
    }
    
    function loadSounds() {
        try {
            music = new Audio('../media/desert.mp3'); 
            music.loop = true;
            music.volume = musicVolume / 100;
            attackSound = new Audio('../media/attack.mp3');
            potionSound = new Audio('../media/potion.mp3');
            victorySound = new Audio('../media/victory.mp3');
            loseSound = new Audio('../media/lose.mp3');
            coinSound = new Audio('../media/coin.mp3');
            upgradeSound = new Audio('../media/upgrade.mp3');
            hoverSound = new Audio('../media/hover.mp3');
            clickSound = new Audio('../media/click.mp3');
        } catch(e) {}
    }
    
    function loadSettings() {
        const vm = localStorage.getItem('dust_music_volume');
        const vs = localStorage.getItem('dust_sfx_volume');
        if(vm !== null) musicVolume = parseInt(vm);
        if(vs !== null) sfxVolume = parseInt(vs);
        if(music) music.volume = musicVolume / 100;
    }
    
    function exitToMenu() { 
        playClick(); 
        saveHero(); 
        window.location.href = '../main-menu/index.html'; 
    }
    
    function bindEvents() {
        if (attackBtn) {
            attackBtn.addEventListener('click', () => { 
                if(inBattle && hero.currentHp > 0 && canAct && !waitingForEnemy && gameActive) heroAttack(); 
            });
        }
        if (potionBtn) {
            potionBtn.addEventListener('click', () => { 
                if(inBattle && hero.currentHp > 0 && canAct && !waitingForEnemy && gameActive) usePotion(); 
            });
        }
        if (shopBtn) shopBtn.addEventListener('click', openShop);
        if (menuBtn) menuBtn.addEventListener('click', exitToMenu);
        if (closeShopBtn) closeShopBtn.addEventListener('click', closeShop);
        if (closeShopBtn2) closeShopBtn2.addEventListener('click', closeShop);
        
        document.querySelectorAll('.shop-buy-btn').forEach(btn => {
            btn.addEventListener('click', (e) => { 
                playClick(); 
                buyUpgrade(btn.dataset.upgrade); 
            });
        });
        
        document.querySelectorAll('.mob-select-btn').forEach(btn => {
            btn.addEventListener('click', (e) => { 
                playClick(); 
                startGameWithMobType(btn.dataset.mob); 
            });
        });
        
        document.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('mouseenter', playHover);
        });
    }
    
    function init() {
        loadSettings();
        loadSounds();
        loadHero();
        bindEvents();
        startMusic();
        if (mobTypeModal) mobTypeModal.style.display = 'flex';
    }
    
    init();
})();