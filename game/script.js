/**
 * DUST & BLADES — battle scene (v3)
 */
(function () {
    'use strict';
    const C = window.DustCore;
    const FX = window.DustFX;
    const M = '../media/';
    const ICON = name => M + 'px/icons/' + name + '.png';

    // smooth motion curves: out = snappy settle, in = accelerate into a hit
    const EASE = {
        out: 'cubic-bezier(.22,.9,.3,1)',
        in: 'cubic-bezier(.55,0,.85,.35)'
    };

    const CRIT_CHANCE = 0.18;
    const CRIT_MULT = 1.85;
    const WAVE_SCALE = 0.18;
    const MAX_WAVES = 3;
    const RAGE_MAX = 100;
    const RAGE_ON_HIT = 14;
    const RAGE_ON_HURT = 10;
    const RAGE_ON_DEFEND = 30;
    const DEFEND_MULT = 0.4;
    const GHOST_EVADE = 0.2;
    const SKELETON_REVIVE = 0.3;

    const SHOP = [
        { key: 'strength', name: 'ТОЧИЛЬНЫЙ КАМЕНЬ', desc: '+2 к силе', cost: 30, icon: 'strength' },
        { key: 'armor', name: 'КОВАНЫЕ ПЛАСТИНЫ', desc: '+2 к броне', cost: 40, icon: 'armor' },
        { key: 'potion', name: 'ЗЕЛЬЕ ЗДОРОВЬЯ', desc: 'Лечит 35% здоровья', cost: 30, icon: 'potion' },
        { key: 'vitality', name: 'ЭЛИКСИР ЖИЗНИ', desc: '+15 к макс. здоровью', cost: 60, icon: 'heart' }
    ];

    const MERCHANT_LINES = ['«Чего желаешь?»'];

    const MOBS = {
        skeleton: {
            name: 'СКЕЛЕТ', plural: 'СКЕЛЕТЫ', hp: 70,
            damageMin: 14, damageMax: 20,
            exp: 20, gold: 15,
            img: M + 'px/sprites/skeleton/idle.png',
            k: 0.99,
            hint: 'Слаб поодиночке. Может собраться вновь.',
            hitColors: ['#efe2c4', '#c9b48a', '#8b7d6f', '#ffffff'],
            deathPalette: ['#efe2c4', '#c9b48a', '#8b7d6f', '#5a4a3a', '#2a221c']
        },
        ghost: {
            name: 'ПРИЗРАК', plural: 'ПРИЗРАКИ', hp: 150,
            damageMin: 32, damageMax: 40,
            exp: 50, gold: 45,
            img: M + 'px/sprites/ghost/idle.png',
            k: 0.73,
            hint: 'Бьёт больно. Уклоняется от каждого пятого удара.',
            hitColors: ['#79e6d6', '#bff7ee', '#3a8a90', '#e8ffff'],
            deathPalette: ['#79e6d6', '#4aa8a8', '#2a5a66', '#bff7ee', '#1a2a3a']
        },
        death_knight: {
            name: 'РЫЦАРЬ СМЕРТИ', plural: 'РЫЦАРИ СМЕРТИ', hp: 220,
            damageMin: 65, damageMax: 78,
            exp: 100, gold: 90,
            img: M + 'px/sprites/death-knight/idle.png',
            k: 1.29,
            hint: 'Элита. Каждый третий удар — двойной. Держи защиту.',
            hitColors: ['#ffffff', '#ffd34a', '#ff8a2a', '#5a4a60'],
            deathPalette: ['#3a3040', '#5a4a60', '#2a2228', '#8a7a68', '#79c8ff']
        }
    };

    /* x: % of width, y: px above ground, s: scale, z: stacking */
    const SLOTS = {
        1: [{ x: 72, y: 0, s: 1, z: 3 }],
        2: [{ x: 63, y: 30, s: 0.9, z: 2 }, { x: 84, y: 0, s: 1, z: 3 }],
        3: [{ x: 57, y: 40, s: 0.84, z: 1 }, { x: 86, y: 40, s: 0.84, z: 1 }, { x: 72, y: 0, s: 1, z: 3 }]
    };

    /* ------------------------------------------------------------------ */
    let hero = null;
    let audio = null;
    let mobType = null;
    let difficultyKey = 'normal';
    let wave = 1;
    let enemies = [];
    let sel = 0;
    let phase = 'choose'; // choose | player | busy | over
    let rage = 0;
    let defending = false;
    let combo = 0;
    let pendingGold = 0;
    let chooseIndex = 0;
    let run = null;
    let fxLayer = null;
    let bgLayer = null;

    const $ = id => document.getElementById(id);
    const el = {
        game: $('game'),
        hero: $('hero'),
        heroImg: $('heroImg'),
        heroHpBar: $('heroHpBar'),
        heroHpFill: $('heroHpFill'),
        heroHpGhost: $('heroHpGhost'),
        heroHpText: $('heroHpText'),
        rageBar: $('rageBar'),
        rageFill: $('rageFill'),
        rageText: $('rageText'),
        expBarFill: $('expBarFill'),
        expCurrent: $('expCurrent'),
        expNext: $('expNext'),
        heroLevel: $('heroLevel'),
        heroName: $('heroName'),
        heroRank: $('heroRank'),
        heroGold: $('heroGold'),
        heroArmor: $('heroArmor'),
        heroStrength: $('heroStrength'),
        heroPotions: $('heroPotions'),
        goldBox: $('goldBox'),
        waveBadge: $('waveBadge'),
        wavePips: $('wavePips'),
        enemiesCount: $('enemiesCount'),
        diffBadge: $('diffBadge'),
        turnBanner: $('turnBanner'),
        foes: $('enemiesContainer'),
        log: $('combatLog'),
        comboBox: $('comboBox'),
        comboNum: $('comboNum'),
        floating: $('floatingNumbers'),
        attackBtn: $('attackBtn'),
        rageBtn: $('rageBtn'),
        defendBtn: $('defendBtn'),
        potionBtn: $('potionBtn'),
        shopBtn: $('shopBtn'),
        menuBtn: $('menuBtn'),
        mobModal: $('mobTypeModal'),
        shopModal: $('shopModal'),
        shopItems: $('shopItems'),
        shopGold: $('shopGold'),
        cinema: $('cinema'),
        cinemaTitle: $('cinemaTitle'),
        cinemaSub: $('cinemaSub'),
        result: $('resultScreen')
    };

    /* ------------------------------------------------------------------ */
    /* utils                                                               */
    /* ------------------------------------------------------------------ */
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const rand = FX.rand;

    function anim(node, frames, opts) {
        if (!node) return Promise.resolve();
        const a = node.animate(frames, opts);
        return a.finished.catch(() => {});
    }

    function center(node, fy) {
        const r = node.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height * (fy == null ? 0.5 : fy), r };
    }

    function groundY() {
        return el.hero.getBoundingClientRect().bottom;
    }

    function play(key, mult) { if (audio) audio.playSfx(key, mult); }
    function synth(name) { if (audio) audio.synth(name); }

    function log(html) {
        const li = document.createElement('li');
        li.innerHTML = html;
        el.log.prepend(li);
        while (el.log.children.length > 6) el.log.lastChild.remove();
    }

    function fnum(text, cls, x, y, opt) {
        const o = opt || {};
        const d = document.createElement('div');
        d.className = 'fnum ' + cls;
        d.innerHTML = text;
        d.style.left = (x + rand(-18, 18)) + 'px';
        d.style.top = y + 'px';
        el.floating.appendChild(d);
        const rise = o.rise || 90;
        const a = d.animate([
            { transform: 'translate(-50%,-50%) scale(.3)', opacity: 0 },
            { transform: 'translate(-50%,-50%) scale(1.35)', opacity: 1, offset: 0.12 },
            { transform: 'translate(-50%,-55%) scale(1)', opacity: 1, offset: 0.25 },
            { transform: 'translate(-50%,-' + (50 + rise) + '%) scale(.9)', opacity: 1, offset: 0.75 },
            { transform: 'translate(-50%,-' + (60 + rise) + '%) scale(.85)', opacity: 0 }
        ], { duration: o.duration || 1100, easing: 'ease-out' });
        a.onfinish = () => d.remove();
        setTimeout(() => d.remove(), (o.duration || 1100) + 500);
    }

    /** Icons that fly in an arc from a point to a HUD element */
    function flyIcons(src, from, toEl, n, onArrive) {
        const to = center(toEl);
        let left = n;
        for (let i = 0; i < n; i++) {
            const img = document.createElement('img');
            img.className = 'fly-icon';
            img.src = src;
            img.style.left = '0px';
            img.style.top = '0px';
            document.body.appendChild(img);
            const sx = from.x + rand(-30, 30);
            const sy = from.y + rand(-30, 20);
            const mx = (sx + to.x) / 2 + rand(-60, 60);
            const my = Math.min(sy, to.y) - rand(60, 160);
            const a = img.animate([
                { transform: 'translate(' + sx + 'px,' + sy + 'px) scale(.4)' },
                { transform: 'translate(' + (sx + rand(-30, 30)) + 'px,' + (sy - rand(20, 50)) + 'px) scale(1.2)', offset: 0.2 },
                { transform: 'translate(' + mx + 'px,' + my + 'px) scale(1)', offset: 0.6 },
                { transform: 'translate(' + to.x + 'px,' + to.y + 'px) scale(.6)' }
            ], { duration: 750 + i * 70, easing: 'ease-in-out', fill: 'forwards' });
            a.onfinish = () => {
                img.remove();
                left--;
                if (onArrive) onArrive(left === 0);
            };
        }
    }

    function bump(node) {
        node.classList.remove('bump');
        void node.offsetWidth;
        node.classList.add('bump');
    }

    async function flashSprite(img, cls, ms) {
        img.classList.add(cls);
        await wait(ms || 80);
        img.classList.remove(cls);
    }

    function cinema(title, sub, ms, red) {
        el.cinemaTitle.textContent = title;
        el.cinemaSub.textContent = sub || '';
        el.cinema.className = 'cinema show' + (red ? ' red' : '');
        // restart CSS animations
        el.cinema.querySelectorAll('*').forEach(n => { n.style.animation = 'none'; void n.offsetWidth; n.style.animation = ''; });
        return wait(ms || 1300).then(() => {
            el.cinema.classList.add('out');
            return wait(320);
        }).then(() => { el.cinema.className = 'cinema'; });
    }

    /* ------------------------------------------------------------------ */
    /* HUD                                                                 */
    /* ------------------------------------------------------------------ */
    function updateHeroUI() {
        const pct = (hero.currentHp / hero.maxHp) * 100;
        el.heroHpFill.style.width = pct + '%';
        el.heroHpGhost.style.width = pct + '%';
        el.heroHpBar.classList.toggle('low', pct <= 30);
        el.game.classList.toggle('low-hp', pct <= 30 && phase !== 'choose' && phase !== 'over');
        el.heroHpText.textContent = hero.currentHp + ' / ' + hero.maxHp;

        el.heroStrength.textContent = hero.strength;
        el.heroArmor.textContent = hero.armor;
        el.heroGold.textContent = hero.gold - pendingGold;
        el.heroPotions.textContent = hero.inventory.potions;
        el.heroLevel.textContent = hero.level;
        el.heroName.textContent = hero.username.toUpperCase();
        el.heroRank.textContent = C.getRank(hero.level);

        const p = C.getExpProgress(hero.level, hero.exp);
        el.expBarFill.style.width = p.percent + '%';
        el.expCurrent.textContent = hero.exp;
        el.expNext.textContent = hero.level >= C.MAX_LEVEL ? 'МАКС' : p.next;

        updateRageUI();
        updateActions();
    }

    function updateRageUI() {
        el.rageFill.style.width = (rage / RAGE_MAX * 100) + '%';
        el.rageText.textContent = rage >= RAGE_MAX ? 'ЯРОСТЬ — ВИХРЬ ГОТОВ!' : 'ЯРОСТЬ ' + rage;
        el.rageBar.classList.toggle('full', rage >= RAGE_MAX);
    }

    function addRage(n) {
        const was = rage;
        rage = C.clamp(rage + n, 0, RAGE_MAX);
        if (was < RAGE_MAX && rage >= RAGE_MAX) {
            synth('charge');
            const c = center(el.heroImg, 0.5);
            fnum('ЯРОСТЬ!', 'crit', c.x, c.y - 40, { rise: 60 });
            log('<span class="c-crit">Ярость заполнена — ВИХРЬ готов [R]</span>');
        }
        updateRageUI();
        updateActions();
    }

    function updateActions() {
        const can = phase === 'player';
        const noPotion = hero.inventory.potions <= 0 || hero.currentHp >= hero.maxHp;
        const rageReady = rage >= RAGE_MAX;
        setBtn(el.attackBtn, can);
        setBtn(el.defendBtn, can);
        setBtn(el.rageBtn, can && rageReady);
        setBtn(el.potionBtn, can && !noPotion);
        el.rageBtn.classList.toggle('ready', can && rageReady);
        el.potionBtn.classList.toggle('dimmed', noPotion);
        setBtn(el.shopBtn, phase === 'player');
    }

    function setBtn(btn, on) {
        btn.disabled = !on;
        btn.classList.toggle('is-disabled', !on);
    }

    function setTurnBanner(text, mode) {
        el.turnBanner.textContent = text;
        el.turnBanner.className = 'turn-banner' + (mode ? ' ' + mode : '');
        el.turnBanner.hidden = !text;
    }

    function updateWaveUI() {
        el.waveBadge.textContent = 'ВОЛНА ' + C.roman(wave) + ' / ' + C.roman(MAX_WAVES);
        const alive = enemies.filter(e => !e.dead).length;
        el.enemiesCount.textContent = 'ВРАГОВ: ' + alive;
        const d = C.DIFFICULTY[difficultyKey] || C.DIFFICULTY.normal;
        el.diffBadge.textContent = d.label;
        el.diffBadge.className = 'diff-badge ' + difficultyKey;
        Array.from(el.wavePips.children).forEach((pip, i) => {
            pip.className = i + 1 < wave ? 'done' : i + 1 === wave ? 'now' : '';
        });
    }

    function setCombo(n) {
        combo = n;
        if (combo >= 2) {
            el.comboBox.hidden = false;
            el.comboNum.textContent = combo;
            el.comboBox.classList.remove('pop');
            void el.comboBox.offsetWidth;
            el.comboBox.classList.add('pop');
        } else {
            el.comboBox.hidden = true;
        }
        if (combo > run.maxCombo) run.maxCombo = combo;
    }

    /* ------------------------------------------------------------------ */
    /* hero                                                                */
    /* ------------------------------------------------------------------ */
    function loadHero() {
        const name = C.getCurrentUser() || 'Воин';
        hero = C.normalizeCharacter(C.getCurrentCharacter(), name);
    }

    function checkLevelUp() {
        let leveled = 0;
        while (hero.level < C.MAX_LEVEL && hero.exp >= C.getExpForNextLevel(hero.level)) {
            hero.level++;
            hero.maxHp += 15;
            hero.strength += 3;
            hero.currentHp = hero.maxHp;
            leveled++;
        }
        if (!leveled) return;
        run.levels += leveled;
        play('upgrade', 1.1);
        synth('levelup');
        const c = center(el.heroImg, 0.4);
        fxLayer.pillar(c.x, groundY(), { width: c.r.width * 0.7, height: c.r.height * 1.6, color: '#ffe28a' });
        fnum('НОВЫЙ УРОВЕНЬ!', 'lvl', c.x, c.r.top - 10, { rise: 120, duration: 1600 });
        log('<span class="c-sys">Уровень ' + hero.level + '! +15 здоровья, +3 силы</span>');
        updateHeroUI();
        C.saveCharacter(hero);
    }

    /* ------------------------------------------------------------------ */
    /* enemies                                                             */
    /* ------------------------------------------------------------------ */
    function scaledMob(base, w) {
        const diff = C.DIFFICULTY[difficultyKey] || C.DIFFICULTY.normal;
        const scale = 1 + (w - 1) * WAVE_SCALE;
        const hp = Math.round(base.hp * diff.enemyHp * scale);
        return {
            name: base.name,
            hp,
            maxHp: hp,
            dmgMin: Math.max(1, Math.round(base.damageMin * diff.enemyDmg * scale)),
            dmgMax: Math.max(1, Math.round(base.damageMax * diff.enemyDmg * scale)),
            exp: Math.round(base.exp * diff.reward),
            gold: Math.round(base.gold * diff.reward)
        };
    }

    function buildFoe(e) {
        const base = MOBS[e.mobType];
        const root = document.createElement('div');
        root.className = 'foe';
        root.dataset.mob = e.mobType;
        root.style.left = e.slot.x + '%';
        root.style.bottom = 'calc(var(--ground) + ' + e.slot.y + 'px * var(--s))';
        root.style.setProperty('--w', 'calc(var(--unit-h) * ' + (base.k * e.slot.s).toFixed(3) + ')');
        root.style.setProperty('--z', e.slot.z);
        root.innerHTML =
            '<div class="target-arrow"></div>' +
            '<div class="intent hidden"><img src="' + ICON('attack') + '" alt=""><span></span></div>' +
            '<div class="foe-body">' +
                '<div class="target-ring"></div>' +
                '<div class="unit-shadow"></div>' +
                '<img class="foe-sprite" src="' + base.img + '" alt="' + e.name + '" decoding="async">' +
            '</div>' +
            '<div class="foe-plate">' +
                '<div class="foe-name">' + e.name + '</div>' +
                '<div class="px-bar hp"><div class="ghost"></div><div class="fill"></div><span class="txt"></span></div>' +
            '</div>';
        e.el = root;
        e.body = root.querySelector('.foe-body');
        e.img = root.querySelector('.foe-sprite');
        e.bar = root.querySelector('.px-bar');
        e.fill = root.querySelector('.fill');
        e.ghost = root.querySelector('.ghost');
        e.txt = root.querySelector('.txt');
        e.intentEl = root.querySelector('.intent');
        if (e.mobType === 'ghost') {
            e.img.style.animationDelay = (-Math.random() * 3).toFixed(2) + 's';
        } else {
            e.img.style.animationDelay = (-Math.random() * 2).toFixed(2) + 's';
        }

        root.addEventListener('click', ev => {
            ev.stopPropagation();
            if (e.dead) return;
            const idx = enemies.indexOf(e);
            if (phase === 'player' && idx !== sel) {
                selectEnemy(idx);
                synth('select');
            } else if (phase === 'player') {
                heroAttack();
            }
        });
        root.addEventListener('mouseenter', () => { if (phase === 'player') play('hover', 0.4); });
        updateFoeHp(e);
        return root;
    }

    function updateFoeHp(e) {
        const pct = Math.max(0, e.hp / e.maxHp * 100);
        e.fill.style.width = pct + '%';
        e.ghost.style.width = pct + '%';
        e.txt.textContent = Math.max(0, e.hp) + ' / ' + e.maxHp;
        e.bar.classList.toggle('low', pct <= 30);
    }

    function alive() {
        return enemies.filter(e => !e.dead);
    }

    function selectEnemy(idx) {
        if (!enemies[idx] || enemies[idx].dead) return;
        sel = idx;
        enemies.forEach((e, i) => e.el.classList.toggle('selected', i === sel && phase === 'player'));
    }

    function ensureTarget() {
        if (enemies[sel] && !enemies[sel].dead) return;
        const next = enemies.findIndex(e => !e.dead);
        if (next >= 0) sel = next;
    }

    /** Cycle target in on-screen (left→right) order */
    function cycleTarget(dir) {
        const order = enemies.map((e, i) => ({ e, i })).filter(o => !o.e.dead).sort((a, b) => a.e.slot.x - b.e.slot.x || a.e.slot.y - b.e.slot.y);
        if (order.length < 2) return;
        const pos = order.findIndex(o => o.i === sel);
        const nxt = order[(pos + dir + order.length) % order.length];
        selectEnemy(nxt.i);
        synth('select');
    }

    function computeIntent(e) {
        const heavy = e.mobType === 'death_knight' && e.turns % 3 === 2;
        const wasHeavy = e.intent === 'heavy';
        e.intent = heavy ? 'heavy' : 'attack';
        const mult = heavy ? 2 : 1;
        const lo = Math.max(0, e.dmgMin * mult - hero.armor);
        const hi = Math.max(0, e.dmgMax * mult - hero.armor);
        e.intentEl.classList.toggle('heavy', heavy);
        e.intentEl.querySelector('span').textContent = (heavy ? 'x2 ' : '') + lo + '–' + hi;
        e.el.classList.toggle('charging', heavy);
        if (heavy && !wasHeavy) {
            synth('charge');
            const c = center(e.img, 0.5);
            fxLayer.burst(c.x, c.y, { count: 30, speed: 90, gravity: -80, life: 1, colors: ['#c8302a', '#5a0a0a', '#ff6a4a'], glow: true });
            log('<span class="c-dmg">' + e.name + ' готовит тяжёлый удар!</span>');
        }
    }

    function showIntents(on) {
        enemies.forEach(e => {
            if (e.dead) return;
            if (on) computeIntent(e);
            e.intentEl.classList.toggle('hidden', !on);
        });
    }

    /* ------------------------------------------------------------------ */
    /* flow                                                                */
    /* ------------------------------------------------------------------ */
    function newRun() {
        run = { exp: 0, gold: 0, kills: 0, bestHit: 0, maxCombo: 0, levels: 0 };
    }

    function startGameWithMobType(key) {
        mobType = key;
        el.mobModal.classList.remove('open');
        newRun();
        rage = 0;
        defending = false;
        setCombo(0);
        hero.currentHp = hero.maxHp;
        el.log.innerHTML = '';
        log('<span class="c-sys">Бой начался.</span>');
        updateHeroUI();
        C.saveCharacter(hero);
        startWave(1);
    }

    async function startWave(n) {
        wave = n;
        phase = 'busy';
        updateActions();
        setTurnBanner('');
        el.foes.innerHTML = '';
        const base = MOBS[mobType];
        const slots = SLOTS[n];
        enemies = [];
        for (let i = 0; i < n; i++) {
            const e = Object.assign(scaledMob(base, n), {
                id: i, mobType, slot: slots[i], turns: 0, dead: false, revived: false, intent: null
            });
            enemies.push(e);
        }
        // front-most (largest) enemy is the default target
        sel = enemies.length - 1;
        updateWaveUI();

        synth('wave');
        const sub = n === 1 ? 'ВРАГОВ: 1 · ' + base.name : 'ВРАГОВ: ' + n + ' · ' + base.plural;
        const cine = cinema('ВОЛНА ' + C.roman(n), sub, 1200);

        // enemies march in from the right
        await wait(250);
        enemies.forEach((e, i) => {
            const node = buildFoe(e);
            el.foes.appendChild(node);
            anim(node, [
                { transform: 'translateX(60vw)', opacity: 0 },
                { transform: 'translateX(0)', opacity: 1 }
            ], { duration: 700, delay: i * 160, easing: EASE.out, fill: 'backwards' }).then(() => {
                const r = e.img.getBoundingClientRect();
                fxLayer.burst(r.left + r.width / 2, r.bottom, {
                    count: 18, speed: 70, angle: -Math.PI / 2, spread: 1.3, gravity: 200, life: 0.7,
                    colors: ['#c49a58', '#a07840', '#e8d0a0'], floor: r.bottom + 4
                });
            });
        });

        await cine;
        log('<span class="c-sys">Волна ' + C.roman(n) + ': ' + (n === 1 ? base.name : n + ' × ' + base.name) + '</span>');
        beginPlayerTurn();
    }

    function beginPlayerTurn() {
        if (phase === 'over') return;
        phase = 'player';
        ensureTarget();
        selectEnemy(sel);
        showIntents(true);
        setTurnBanner('ВАШ ХОД', 'player');
        updateHeroUI();
    }

    /** After any hero action: next wave, victory or the enemy's turn */
    async function afterHeroAction() {
        if (alive().length === 0) {
            await waveCleared();
            return;
        }
        await enemyTurn();
    }

    async function waveCleared() {
        phase = 'busy';
        setTurnBanner('');
        updateActions();
        await wait(600);
        if (wave < MAX_WAVES) {
            synth('levelup');
            const c = center(el.heroImg, 0.4);
            hero.currentHp = hero.maxHp;
            updateHeroUI();
            C.saveCharacter(hero);
            fxLayer.pillar(c.x, groundY(), { width: c.r.width * 0.6, height: c.r.height * 1.4, color: '#8fe06a', life: 1.2 });
            fnum('HP ВОССТАНОВЛЕНО', 'heal', c.x, c.r.top, { rise: 80, duration: 1400 });
            log('<span class="c-heal">Здоровье восстановлено.</span>');
            await wait(900);
            startWave(wave + 1);
        } else {
            victory();
        }
    }

    /* ------------------------------------------------------------------ */
    /* hero actions                                                        */
    /* ------------------------------------------------------------------ */
    function beginAction() {
        if (phase !== 'player') return false;
        phase = 'busy';
        showIntents(false);
        enemies.forEach(e => e.el.classList.remove('selected'));
        setTurnBanner('');
        updateActions();
        return true;
    }

    function heroDash(dx, ms) {
        return anim(el.hero, [{ transform: 'translateX(-20px)' }, { transform: 'translateX(' + dx + 'px)' }],
            { duration: ms || 130, easing: EASE.in, fill: 'forwards' });
    }

    async function heroReturn(dx) {
        await anim(el.hero, [{ transform: 'translateX(' + dx + 'px)' }, { transform: 'translateX(0)' }],
            { duration: 240, easing: EASE.out, fill: 'forwards' });
        el.hero.getAnimations().forEach(a => a.cancel());
    }

    async function heroAttack() {
        if (!beginAction()) return;
        const target = enemies[sel];
        const hr = el.hero.getBoundingClientRect();
        const tr = target.img.getBoundingClientRect();
        const dx = Math.max(0, tr.left + tr.width * 0.18 - (hr.right - hr.width * 0.12));

        await anim(el.hero, [{ transform: 'translateX(0)' }, { transform: 'translateX(-20px)' }], { duration: 110, easing: EASE.out, fill: 'forwards' });
        play('attack');
        await heroDash(dx);

        // ghosts may slip away
        if (target.mobType === 'ghost' && Math.random() < GHOST_EVADE) {
            synth('evade');
            anim(target.body, [{ transform: 'none', opacity: 1 }, { transform: 'translateX(40px)', opacity: 0.3 }, { transform: 'none', opacity: 1 }],
                { duration: 420, easing: EASE.out });
            const c = center(target.img, 0.3);
            fnum('УКЛОН', 'info', c.x, c.y);
            fxLayer.burst(c.x, c.y + 40, { count: 16, speed: 60, gravity: -60, colors: MOBS.ghost.hitColors, glow: true, additive: true });
            log('<span class="c-foe">' + target.name + ' ускользает от клинка</span>');
            setCombo(0);
            await wait(120);
            await heroReturn(dx);
            await afterHeroAction();
            return;
        }

        setCombo(combo + 1);
        const isCrit = Math.random() < CRIT_CHANCE;
        let damage = hero.strength + C.randInt(1, 10);
        const comboHit = combo >= 3 && combo % 3 === 0;
        if (comboHit) damage = Math.round(damage * 1.25);
        if (isCrit) damage = Math.round(damage * CRIT_MULT);

        const c = center(target.img, 0.45);
        fxLayer.slash(c.x, c.y, {
            radius: tr.width * (isCrit ? 0.55 : 0.42), width: isCrit ? 7 : 5,
            from: -2.4, to: 0.8, edge: isCrit ? '#ff8a2a' : '#ffd34a', life: isCrit ? 0.3 : 0.22
        });
        await hitEnemy(target, damage, { crit: isCrit, combo: comboHit });
        addRage(RAGE_ON_HIT);

        await wait(isCrit ? 160 : 70); // hit-stop
        await heroReturn(dx);
        await settleDeaths();
        await afterHeroAction();
    }

    /** Apply damage + all juicy feedback; marks death but doesn't remove */
    async function hitEnemy(e, damage, opt) {
        const o = opt || {};
        const base = MOBS[e.mobType];
        e.hp = Math.max(0, e.hp - damage);
        updateFoeHp(e);
        run.bestHit = Math.max(run.bestHit, damage);

        const c = center(e.img, 0.4);
        const label = o.crit ? '<small>КРИТ!</small>' + damage : (o.combo ? '<small>КОМБО</small>' + damage : String(damage));
        fnum(label, o.crit ? 'crit' : 'dmg', c.x, c.y);

        fxLayer.burst(c.x, c.y + 10, {
            count: o.crit ? 46 : 26, speed: o.crit ? 260 : 170, angle: -0.3, spread: 1.3,
            gravity: e.mobType === 'ghost' ? -50 : 420, life: 0.9, sizes: [1, 1, 2],
            colors: base.hitColors, streak: e.mobType === 'death_knight',
            glow: e.mobType === 'ghost', additive: e.mobType === 'ghost',
            floor: e.mobType === 'ghost' ? null : groundY() + 6
        });
        if (o.crit) {
            FX.flash('#fff', 120, 0.35);
            FX.shake(el.game, 10);
            fxLayer.ring(c.x, c.y, { radius: 120, color: '#ffd34a', life: 0.35 });
        }

        anim(e.body, [{ transform: 'translateX(0)' }, { transform: 'translateX(' + (o.crit ? 34 : 20) + 'px)' }, { transform: 'translateX(0)' }],
            { duration: 260, easing: EASE.out });
        flashSprite(e.img, 'flash-white', 70);

        log((o.crit ? '<span class="c-crit">КРИТ!</span> ' : '') + '<span class="c-hero">Вы</span> рубите: ' + e.name +
            ' <span class="c-dmg">−' + damage + '</span>');

        if (e.hp <= 0) await onEnemyZero(e);
    }

    /** Skeletons may pull themselves back together once */
    async function onEnemyZero(e) {
        if (e.mobType === 'skeleton' && !e.revived && wave >= 2 && Math.random() < SKELETON_REVIVE) {
            e.revived = true;
            const c = center(e.img, 0.6);
            fxLayer.burst(c.x, c.y, { count: 40, speed: 160, gravity: 500, life: 1, colors: MOBS.skeleton.deathPalette, floor: groundY() + 4 });
            play('attack', 0.3);
            await anim(e.img, [{ transform: 'none' }, { transform: 'scaleY(.2) scaleX(1.2)', opacity: 0.6 }], { duration: 260, easing: EASE.out, fill: 'forwards' });
            await wait(380);
            e.hp = Math.round(e.maxHp * 0.35);
            updateFoeHp(e);
            synth('charge');
            await anim(e.img, [{ transform: 'scaleY(.2) scaleX(1.2)', opacity: 0.6 }, { transform: 'scaleY(1.1)', opacity: 1, offset: 0.7 }, { transform: 'none', opacity: 1 }],
                { duration: 420, easing: EASE.out });
            e.img.getAnimations().forEach(a => { if (a.effect && a.effect.getTiming().fill === 'forwards') a.cancel(); });
            fnum('ВОССТАЛ!', 'info', c.x, c.y - 60);
            log('<span class="c-foe">Скелет снова поднялся!</span>');
            return;
        }
        e.dead = true;
    }

    /** Dissolve dead enemies, pay rewards */
    async function settleDeaths() {
        const dying = enemies.filter(e => e.dead && !e.removed);
        if (!dying.length) return;
        for (const e of dying) {
            e.removed = true;
            const base = MOBS[e.mobType];
            const c = center(e.img, 0.45);
            play('coin');
            FX.shake(el.game, 6);
            e.intentEl.classList.add('hidden');
            fxLayer.disintegrate(e.img, { palette: base.deathPalette, dir: 1, gravity: e.mobType === 'ghost' ? -60 : -20 });
            e.img.style.visibility = 'hidden';
            e.el.querySelector('.unit-shadow').style.opacity = '0';
            anim(e.el.querySelector('.foe-plate'), [{ opacity: 1 }, { opacity: 0 }], { duration: 400, easing: EASE.out, fill: 'forwards' });

            run.exp += e.exp;
            run.gold += e.gold;
            run.kills++;
            hero.exp += e.exp;
            hero.gold += e.gold;
            hero.totalKills = (hero.totalKills || 0) + 1;
            pendingGold += e.gold;
            log('<span class="c-hero">' + e.name + ' повержен.</span> <span class="c-crit">+' + e.gold + ' зол.</span> <span class="c-sys">+' + e.exp + ' оп.</span>');
            fnum('+' + e.exp + ' ОПЫТА', 'info', c.x, c.y - 70, { rise: 60 });

            const g = e.gold;
            flyIcons(ICON('gold'), c, el.goldBox, Math.min(8, 3 + Math.floor(g / 20)), done => {
                play('coin', 0.35);
                if (done) {
                    pendingGold -= g;
                    el.heroGold.textContent = hero.gold - pendingGold;
                    bump(el.goldBox);
                }
            });
            flyIcons(ICON('exp'), c, el.expBarFill.parentElement, 3);
            updateHeroUI();
            checkLevelUp();
            C.saveCharacter(hero);
            setTimeout(() => e.el.remove(), 1600);
        }
        updateWaveUI();
        ensureTarget();
        await wait(450);
    }

    async function whirlwind() {
        if (rage < RAGE_MAX) return;
        if (!beginAction()) return;
        rage = 0;
        updateRageUI();
        el.hero.classList.add('raging');
        synth('whirl');
        FX.flash('#ff8a2a', 220, 0.3);
        const hc = center(el.heroImg, 0.5);
        fxLayer.ring(hc.x, groundY(), { radius: 200, color: '#ff8a2a', flat: 0.25, life: 0.5 });
        log('<span class="c-crit">ВИХРЬ КЛИНКОВ!</span>');

        const targets = alive();
        const hr = el.hero.getBoundingClientRect();
        const xs = targets.map(e => e.img.getBoundingClientRect());
        const midX = xs.reduce((s, r) => s + r.left + r.width / 2, 0) / xs.length;
        const dx = Math.max(0, midX - hr.width * 0.9 - hr.left);

        await anim(el.hero, [{ transform: 'translateX(0)' }, { transform: 'translateX(-30px) scaleY(.94)' }], { duration: 200, easing: EASE.out, fill: 'forwards' });
        play('attack');
        await heroDash(dx, 160);
        // spin: flip the sprite a few times
        anim(el.heroImg, [
            { transform: 'scaleX(1)' }, { transform: 'scaleX(-1)' }, { transform: 'scaleX(1)' }, { transform: 'scaleX(-1)' }, { transform: 'scaleX(1)' }
        ], { duration: 520, easing: 'ease-in-out' });

        for (const e of targets) {
            const c = center(e.img, 0.45);
            const r = e.img.getBoundingClientRect();
            play('attack', 0.8);
            fxLayer.slash(c.x, c.y, { radius: r.width * 0.5, width: 7, from: 2.6, to: -0.6, edge: '#ff8a2a', core: '#fff1b0', life: 0.28 });
            const isCrit = Math.random() < CRIT_CHANCE;
            let dmg = Math.round(hero.strength * 1.4 + C.randInt(5, 15));
            if (isCrit) dmg = Math.round(dmg * CRIT_MULT);
            await hitEnemy(e, dmg, { crit: isCrit });
            FX.shake(el.game, 8);
            await wait(130);
        }
        await wait(120);
        await heroReturn(dx);
        el.hero.classList.remove('raging');
        await settleDeaths();
        await afterHeroAction();
    }

    async function defend() {
        if (!beginAction()) return;
        defending = true;
        setCombo(0);
        el.hero.classList.add('defending');
        synth('block');
        const c = center(el.heroImg, 0.5);
        fxLayer.ring(c.x, groundY(), { radius: 150, color: '#9ac8ff', flat: 0.25, life: 0.45 });
        fxLayer.burst(c.x, c.y, { count: 20, speed: 90, gravity: -40, colors: ['#cfe4ff', '#9ac8ff', '#ffffff'], glow: true, additive: true });
        fnum('ЗАЩИТА', 'block', c.x, c.r.top + 20);
        log('<span class="c-hero">Вы</span> встаёте в защиту');
        addRage(RAGE_ON_DEFEND);
        await anim(el.hero, [{ transform: 'translateX(0)' }, { transform: 'translateX(-12px) scaleY(.97)' }], { duration: 160, easing: EASE.out, fill: 'forwards' });
        await wait(250);
        await afterHeroAction();
    }

    async function usePotion() {
        if (phase !== 'player') return;
        if (hero.inventory.potions <= 0 || hero.currentHp >= hero.maxHp) return;
        if (!beginAction()) return;
        setCombo(0);
        play('potion');
        hero.inventory.potions--;
        const heal = Math.floor(hero.maxHp * 0.35);
        const before = hero.currentHp;
        hero.currentHp = Math.min(hero.maxHp, hero.currentHp + heal);
        updateHeroUI();
        const c = center(el.heroImg, 0.5);
        fxLayer.pillar(c.x, groundY(), { width: c.r.width * 0.45, height: c.r.height * 1.1, color: '#8fe06a', life: 0.9 });
        fxLayer.burst(c.x, c.y, { count: 26, speed: 70, gravity: -90, colors: ['#8fe06a', '#c8ff9a', '#ffffff'], glow: true, additive: true });
        fnum('+' + (hero.currentHp - before), 'heal', c.x, c.r.top + 30);
        log('<span class="c-hero">Вы</span> пьёте зелье <span class="c-heal">+' + (hero.currentHp - before) + ' HP</span>');
        C.saveCharacter(hero);
        await wait(500);
        await afterHeroAction();
    }

    /* ------------------------------------------------------------------ */
    /* enemy turn                                                          */
    /* ------------------------------------------------------------------ */
    async function enemyTurn() {
        phase = 'busy';
        setTurnBanner('ХОД ВРАГА', 'enemy');
        updateActions();
        await wait(420);

        const attackers = alive().sort((a, b) => a.slot.x - b.slot.x);
        for (const e of attackers) {
            if (hero.currentHp <= 0) break;
            await enemyStrike(e);
            e.turns++;
            await wait(150);
        }

        defending = false;
        el.hero.classList.remove('defending');
        el.hero.getAnimations().forEach(a => a.cancel());
        C.saveCharacter(hero);

        if (hero.currentHp <= 0) {
            defeat();
            return;
        }
        beginPlayerTurn();
    }

    async function enemyStrike(e) {
        const heavy = e.intent === 'heavy';
        const er = e.img.getBoundingClientRect();
        const hr = el.heroImg.getBoundingClientRect();
        const dx = Math.min(0, (hr.right - hr.width * 0.25) - (er.left + er.width * 0.3));
        const isGhost = e.mobType === 'ghost';

        // wind-up
        if (heavy) {
            synth('heavy');
            FX.shake(el.game, 4);
            await anim(e.body, [{ transform: 'translateX(0)' }, { transform: 'translateX(30px) scaleY(1.06)', filter: 'brightness(1.6)' }],
                { duration: 380, easing: EASE.out, fill: 'forwards' });
        } else {
            await anim(e.body, [{ transform: 'translateX(0)' }, { transform: 'translateX(16px)' }], { duration: 140, easing: EASE.out, fill: 'forwards' });
        }
        play('attack', 0.6);
        await anim(e.body, [
            { transform: 'translateX(16px)', opacity: 1 },
            { transform: 'translateX(' + dx + 'px)', opacity: isGhost ? 0.55 : 1 }
        ], { duration: isGhost ? 160 : 120, easing: EASE.in, fill: 'forwards' });

        // impact
        let raw = C.randInt(e.dmgMin, e.dmgMax) * (heavy ? 2 : 1);
        if (defending) raw = Math.round(raw * DEFEND_MULT);
        const dmg = Math.max(0, raw - hero.armor);
        const c = center(el.heroImg, 0.4);

        if (dmg === 0) {
            synth('block');
            fnum('БЛОК', 'block', c.x, c.y);
            fxLayer.burst(c.x + hr.width * 0.2, c.y, { count: 22, speed: 200, angle: Math.PI, spread: 0.9, gravity: 300, colors: ['#ffffff', '#ffd34a', '#cfd6dc'], streak: true, life: 0.5 });
            log('<span class="c-foe">' + e.name + '</span> бьёт — броня держит');
        } else {
            hero.currentHp = Math.max(0, hero.currentHp - dmg);
            updateHeroUI();
            flashSprite(el.heroImg, 'flash-red', 110);
            anim(el.hero, [{ transform: 'translateX(0)' }, { transform: 'translateX(-' + (heavy ? 34 : 18) + 'px)' }, { transform: 'translateX(0)' }],
                { duration: 260, easing: EASE.out });
            fnum((heavy ? '<small>ТЯЖЁЛЫЙ УДАР</small>' : '') + '-' + dmg, heavy ? 'crit hurt' : 'hurt', c.x, c.y);
            fxLayer.burst(c.x + hr.width * 0.1, c.y, {
                count: heavy ? 50 : 26, speed: heavy ? 260 : 160, angle: Math.PI + 0.2, spread: 1.1,
                gravity: 500, life: 1, sizes: [1, 1, 2], colors: ['#8e1b1b', '#c8302a', '#5a0a0a', '#e0402e'], floor: groundY() + 6
            });
            if (isGhost) fxLayer.burst(c.x, c.y, { count: 14, speed: 80, gravity: -40, colors: MOBS.ghost.hitColors, glow: true, additive: true });
            FX.shake(el.game, heavy ? 16 : Math.min(12, 4 + dmg / 6));
            if (heavy) FX.flash('#c8302a', 200, 0.35);
            if (defending) {
                fxLayer.ring(c.x, c.y, { radius: 90, color: '#9ac8ff', life: 0.3 });
                synth('block');
            }
            addRage(RAGE_ON_HURT);
            log('<span class="c-foe">' + e.name + '</span>' + (heavy ? ' бьёт тяжёлым ударом' : ' бьёт') + ': <span class="c-dmg">−' + dmg + '</span>' + (defending ? ' (защита)' : ''));
        }

        await wait(heavy ? 160 : 80);
        await anim(e.body, [
            { transform: 'translateX(' + dx + 'px)', opacity: isGhost ? 0.55 : 1 },
            { transform: 'translateX(0)', opacity: 1 }
        ], { duration: 260, easing: EASE.out, fill: 'forwards' });
        e.body.getAnimations().forEach(a => a.cancel());
        if (heavy) e.el.classList.remove('charging');
    }

    /* ------------------------------------------------------------------ */
    /* end of run                                                          */
    /* ------------------------------------------------------------------ */
    function victory() {
        phase = 'over';
        setTurnBanner('');
        updateActions();
        el.game.classList.remove('low-hp');
        if (audio) audio.stopMusic(600);
        play('victory', 1.1);
        hero.wins = (hero.wins || 0) + 1;
        hero.bestCombo = Math.max(hero.bestCombo || 0, run.maxCombo);
        C.saveCharacter(hero);

        // golden confetti from the sky
        let n = 0;
        const timer = setInterval(() => {
            for (let i = 0; i < 6; i++) {
                fxLayer.add({
                    x: rand(0, fxLayer.W), y: -4, vx: rand(-15, 15), vy: rand(30, 70),
                    wobble: rand(3, 7), seed: Math.random() * 10, life: rand(3, 5), size: FX.pick([1, 2]),
                    color: FX.pick(['#ffe28a', '#e9b949', '#fff', '#ff8a2a'])
                });
            }
            if (++n > 40) clearInterval(timer);
        }, 80);

        showResult('victory');
    }

    function defeat() {
        phase = 'over';
        setTurnBanner('');
        updateActions();
        el.game.classList.remove('low-hp');
        el.game.classList.add('dead');
        if (audio) audio.stopMusic(300);
        play('lose');
        hero.bestCombo = Math.max(hero.bestCombo || 0, run.maxCombo);
        C.saveCharacter(hero);
        anim(el.heroImg, [
            { transform: 'none', filter: 'none' },
            { transform: 'rotate(-6deg) translateY(10px)', filter: 'brightness(.5)', offset: 0.4 },
            { transform: 'rotate(-80deg) translate(-30%, 30%)', filter: 'brightness(.3) grayscale(1)' }
        ], { duration: 900, easing: EASE.out, fill: 'forwards' });
        log('<span class="c-dmg">Вы погибли.</span>');
        setTimeout(() => showResult('lose'), 900);
    }

    function countUp(node, to, ms) {
        const t0 = performance.now();
        (function step(now) {
            const k = Math.min(1, (now - t0) / ms);
            node.textContent = Math.round(to * k);
            if (k < 1) requestAnimationFrame(step);
        })(t0);
    }

    function showResult(type) {
        const win = type === 'victory';
        const img = $('resultImage');
        img.src = win ? M + 'px/victory.png' : M + 'px/lose.png';
        img.alt = win ? 'Победа' : 'Поражение';
        el.result.classList.toggle('lose', !win);
        const rows = win ? [
            ['exp', 'ОПЫТ', run.exp, '+'],
            ['gold', 'ЗОЛОТО', run.gold, '+'],
            ['skull', 'УБИТО', run.kills, ''],
            ['attack', 'ЛУЧШИЙ УДАР', run.bestHit, ''],
            ['target', 'МАКС. КОМБО', run.maxCombo, '']
        ] : [
            ['wait', 'ДОШЛИ ДО ВОЛНЫ', wave, ''],
            ['skull', 'УБИТО', run.kills, ''],
            ['gold', 'ЗОЛОТО', run.gold, '+'],
            ['attack', 'ЛУЧШИЙ УДАР', run.bestHit, '']
        ];
        const box = $('resultStats');
        box.innerHTML = rows.map(r =>
            '<div class="rs-row"><img src="' + ICON(r[0]) + '" alt=""><span>' + r[1] + '</span><b>' + r[3] + '<span data-v="' + r[2] + '">0</span></b></div>'
        ).join('') + (run.levels ? '<div class="rs-row lvlup"><img src="' + ICON('level') + '" alt=""><span>НОВЫЙ УРОВЕНЬ</span><b>' + hero.level + '</b></div>' : '');
        el.result.hidden = false;
        setTimeout(() => box.querySelectorAll('[data-v]').forEach((s, i) => setTimeout(() => countUp(s, +s.dataset.v, 600), i * 150)), 500);
        setTimeout(() => $('restartBtn').focus(), 900);
    }

    function restartGame() {
        play('click');
        el.result.hidden = true;
        el.game.classList.remove('dead');
        el.heroImg.getAnimations().forEach(a => a.cancel());
        el.foes.innerHTML = '';
        enemies = [];
        phase = 'choose';
        rage = 0;
        hero.currentHp = hero.maxHp;
        updateHeroUI();
        C.saveCharacter(hero);
        setTurnBanner('');
        if (audio) audio.playMusic('battle', 600);
        openChoose();
    }

    /* ------------------------------------------------------------------ */
    /* choose enemy modal                                                  */
    /* ------------------------------------------------------------------ */
    function renderMobCards() {
        document.querySelectorAll('.mob-card').forEach(card => {
            const key = card.dataset.mob;
            const base = MOBS[key];
            const s = scaledMob(base, 1);
            card.querySelector('.mob-stats').innerHTML =
                '<span><img src="' + ICON('heart') + '" alt="">' + s.hp + '</span>' +
                '<span><img src="' + ICON('attack') + '" alt="">' + s.dmgMin + '–' + s.dmgMax + '</span>' +
                '<span><img src="' + ICON('gold') + '" alt="">' + s.gold + '</span>' +
                '<span><img src="' + ICON('exp') + '" alt="">' + s.exp + '</span>';
            card.querySelector('.mob-hint').textContent = base.hint;
        });
    }

    function setChooseHot(i) {
        const cards = Array.from(document.querySelectorAll('.mob-card'));
        chooseIndex = (i + cards.length) % cards.length;
        cards.forEach((c, j) => c.classList.toggle('is-hot', j === chooseIndex));
    }

    function openChoose() {
        phase = 'choose';
        updateActions();
        renderMobCards();
        setChooseHot(chooseIndex);
        el.mobModal.classList.add('open');
    }

    function bindDifficultyButtons() {
        difficultyKey = C.getDifficulty();
        const btns = document.querySelectorAll('.diff-btn');
        btns.forEach(b => b.classList.toggle('active', b.dataset.diff === difficultyKey));
        btns.forEach(btn => {
            btn.addEventListener('click', () => {
                play('click');
                difficultyKey = btn.dataset.diff || 'normal';
                C.setDifficulty(difficultyKey);
                btns.forEach(b => b.classList.toggle('active', b === btn));
                renderMobCards();
            });
        });
    }

    /* ------------------------------------------------------------------ */
    /* shop                                                                */
    /* ------------------------------------------------------------------ */
    function renderShop() {
        el.shopItems.innerHTML = SHOP.map(it => {
            const own = it.key === 'strength' ? 'сила ' + hero.strength
                : it.key === 'armor' ? 'броня ' + hero.armor
                : it.key === 'potion' ? 'есть ' + hero.inventory.potions
                : 'макс. ' + hero.maxHp;
            return '<div class="shop-item" data-key="' + it.key + '">' +
                '<img src="' + ICON(it.icon) + '" alt="">' +
                '<div><div class="si-name">' + it.name + '</div><div class="si-desc">' + it.desc + ' · <span class="si-own">' + own + '</span></div></div>' +
                '<div class="price">' + it.cost + '<img src="' + ICON('gold') + '" alt=""></div>' +
                '<button class="px-btn' + (hero.gold >= it.cost ? ' red' : '') + '" type="button" data-buy="' + it.key + '"' + (hero.gold >= it.cost ? '' : ' disabled') + '>КУПИТЬ</button>' +
                '</div>';
        }).join('');
        el.shopGold.textContent = hero.gold - pendingGold;
        el.shopItems.querySelectorAll('[data-buy]').forEach(b => {
            b.addEventListener('click', () => buy(b.dataset.buy));
            b.addEventListener('mouseenter', () => play('hover', 0.6));
        });
    }

    function openShop() {
        if (phase !== 'player') return;
        play('click');
        $('merchantLine').textContent = FX.pick(MERCHANT_LINES);
        renderShop();
        el.shopModal.classList.add('open');
        if (audio) audio.playMusic('shop', 500);
    }

    function closeShop() {
        if (!el.shopModal.classList.contains('open')) return;
        play('click');
        el.shopModal.classList.remove('open');
        if (audio) audio.playMusic('battle', 500);
    }

    function buy(key) {
        const it = SHOP.find(s => s.key === key);
        if (!it || hero.gold < it.cost) {
            synth('block');
            return;
        }
        hero.gold -= it.cost;
        if (key === 'strength') hero.strength += 2;
        else if (key === 'armor') hero.armor += 2;
        else if (key === 'potion') hero.inventory.potions += 1;
        else if (key === 'vitality') {
            hero.maxHp += 15;
            hero.currentHp += 15;
        }
        play(key === 'potion' ? 'coin' : 'upgrade');
        updateHeroUI();
        C.saveCharacter(hero);
        renderShop();
        const row = el.shopItems.querySelector('[data-key="' + key + '"]');
        if (row) row.classList.add('bought');
        showIntents(true);
    }

    /* ------------------------------------------------------------------ */
    /* setup                                                               */
    /* ------------------------------------------------------------------ */
    function loadAudio() {
        audio = C.createAudioManager();
        const vols = C.getVolumes();
        audio.setMusicVolume(vols.music);
        audio.setSfxVolume(vols.sfx);
        audio.loadMusic('battle', M + C.MEDIA.desert, true);
        audio.loadMusic('shop', M + C.MEDIA.shop, true);
        audio.loadSfx('attack', M + C.MEDIA.attack, 5);
        audio.loadSfx('potion', M + C.MEDIA.potion, 2);
        audio.loadSfx('victory', M + C.MEDIA.victory, 1);
        audio.loadSfx('lose', M + C.MEDIA.lose, 1);
        audio.loadSfx('coin', M + C.MEDIA.coin, 6);
        audio.loadSfx('upgrade', M + C.MEDIA.upgrade, 2);
        audio.loadSfx('hover', M + C.MEDIA.hover, 3);
        audio.loadSfx('click', M + C.MEDIA.click, 3);
    }

    function exitToMenu() {
        play('click');
        C.saveCharacter(hero);
        if (audio) audio.stopMusic(350);
        FX.go('../main-menu/index.html');
    }

    function bindEvents() {
        el.attackBtn.addEventListener('click', heroAttack);
        el.rageBtn.addEventListener('click', whirlwind);
        el.defendBtn.addEventListener('click', defend);
        el.potionBtn.addEventListener('click', usePotion);
        el.shopBtn.addEventListener('click', openShop);
        el.menuBtn.addEventListener('click', exitToMenu);
        $('chooseMenuBtn').addEventListener('click', exitToMenu);
        $('closeShopBtn').addEventListener('click', closeShop);
        $('closeShopBtn2').addEventListener('click', closeShop);
        $('restartBtn').addEventListener('click', restartGame);
        $('resultMenuBtn').addEventListener('click', exitToMenu);
        el.shopModal.addEventListener('click', e => { if (e.target === el.shopModal) closeShop(); });

        document.querySelectorAll('.mob-card').forEach((card, i) => {
            card.addEventListener('mouseenter', () => { setChooseHot(i); play('hover', 0.6); });
            card.addEventListener('click', () => {
                play('click');
                synth('heavy');
                startGameWithMobType(card.dataset.mob);
            });
        });

        document.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('mouseenter', () => { if (!btn.disabled) play('hover', 0.6); });
        });

        document.addEventListener('keydown', e => {
            if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
            const key = e.key.toLowerCase();

            if (!el.result.hidden) return;

            if (el.shopModal.classList.contains('open')) {
                if (key === 'escape' || key === 's' || key === 'ы') closeShop();
                return;
            }

            if (el.mobModal.classList.contains('open')) {
                if (key === 'arrowleft' || key === 'a' || key === 'ф') { setChooseHot(chooseIndex - 1); play('hover', 0.6); }
                else if (key === 'arrowright' || key === 'd' || key === 'в') { setChooseHot(chooseIndex + 1); play('hover', 0.6); }
                else if (key === 'enter' || key === ' ') {
                    e.preventDefault();
                    document.querySelectorAll('.mob-card')[chooseIndex].click();
                } else if (key === 'escape') exitToMenu();
                return;
            }

            if (key === ' ' || key === 'a' || key === 'ф' || key === '1') { e.preventDefault(); heroAttack(); }
            else if (key === 'r' || key === 'к' || key === '2') { e.preventDefault(); whirlwind(); }
            else if (key === 'd' || key === 'в' || key === '3') { e.preventDefault(); defend(); }
            else if (key === 'p' || key === 'з' || key === 'h' || key === 'р' || key === '4') { e.preventDefault(); usePotion(); }
            else if (key === 's' || key === 'ы') { e.preventDefault(); openShop(); }
            else if (key === 'escape') exitToMenu();
            else if (key === 'arrowleft' || key === 'arrowright' || key === 'tab') {
                if (phase !== 'player') return;
                e.preventDefault();
                cycleTarget(key === 'arrowleft' || (key === 'tab' && e.shiftKey) ? -1 : 1);
            }
        });

        bindDifficultyButtons();
    }

    function buildAmbience() {
        bgLayer = FX.createLayer({ z: 3, parent: el.game });
        FX.ambient.sand(bgLayer, 34);
        FX.ambient.ash(bgLayer, 3, ['#7a3a2a', '#5a2a22', '#3a1a16']);
        fxLayer = FX.createLayer({ z: 10, parent: el.game });
        FX.parallax([
            { el: $('stageBox'), depth: 14, base: 'translate(-50%,-50%)' }
        ]);
    }

    function init() {
        if (!C.getCurrentUser()) {
            window.location.replace('../sign-in/index.html');
            return;
        }
        loadAudio();
        loadHero();
        newRun();
        buildAmbience();
        // sample sprite colours for the death effect while the player is still choosing
        Object.values(MOBS).forEach(m => FX.prepareSprite(m.img));
        bindEvents();
        updateHeroUI();
        updateWaveUI();
        FX.enter();
        audio.startMusic('battle');
        openChoose();
    }

    init();
})();
