/**
 * DUST & BLADES — battle scene (v3)
 */
(function () {
    'use strict';
    const C = window.DustCore;
    const FX = window.DustFX;
    const M = '../media/';
    // this page's ?v= (cache-bust for files not covered by the sprite manifest)
    const PAGE_V = (document.currentScript && document.currentScript.src.split('?')[1]) || '';
    const ICON = name => M + 'icons/' + name + '.png';

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
    // hardcore: endless waves of mixed enemies
    const HARDCORE = 'hardcore';
    const HC_SCALE = 0.08;     // enemy stat growth per wave (the crowd itself grows too)
    const HC_HEAL = 0.3;       // share of max HP restored between waves
    const HC_MAX_FOES = 5;
    const HC_SHOP_EVERY = 5;   // the merchant only trades on every 5th wave

    // price = cost + step × (how many the hero has already bought): every purchase makes the next dearer.
    // Potions instead follow the stock: the more in the bag, the dearer the next one.
    const SHOP = [
        { key: 'strength', name: 'ТОЧИЛЬНЫЙ КАМЕНЬ', desc: '+2 к силе', cost: 60, step: 20, icon: 'strength' },
        { key: 'potion', name: 'ЗЕЛЬЕ ЗДОРОВЬЯ', desc: 'Лечит 35% здоровья', cost: 30, step: 5, icon: 'potion' },
        { key: 'vitality', name: 'ЭЛИКСИР ЖИЗНИ', desc: '+15 к макс. здоровью', cost: 100, step: 35, icon: 'heart' }
    ];

    function shopPrice(it) {
        const n = it.key === 'potion' ? hero.inventory.potions : (hero.bought && hero.bought[it.key]) || 0;
        return it.cost + it.step * n;
    }

    const MERCHANT_LINES = ['«Чего желаешь?»'];

    // Enemies in order of threat. Art lives in media/sprites/<dir>/<pose>.png (see manifest.js).
    // h = body height relative to the hero (unit-h)
    // hp / damage are the NORMAL base (×difficulty, ×wave); `easy` keeps the softer pre-4.0 base for EASY.
    // gold is set per difficulty, exp = exp × the difficulty's reward.
    const MOBS = {
        zombie: {
            name: 'ЗОМБИ', plural: 'ЗОМБИ', hp: 97,
            damageMin: 17, damageMax: 24,
            exp: 20,
            gold: { easy: 13, normal: 35, hard: 53, hardcore: 80 },
            easy: { hp: 70, damageMin: 14, damageMax: 20 },
            dir: 'zombie', h: 0.95, threat: 1,
            hint: 'Медленный и неуклюжий. Хорошая разминка.',
            hitColors: ['#8fa86a', '#5a7040', '#9a2a1a', '#c8d8a0'],
            deathPalette: ['#6a8048', '#4a5a30', '#3a2a1a', '#8a3020', '#2a2018']
        },
        skeleton: {
            name: 'СКЕЛЕТ', plural: 'СКЕЛЕТЫ', hp: 132,
            damageMin: 22, damageMax: 30,
            exp: 32,
            gold: { easy: 21, normal: 54, hard: 77, hardcore: 120 },
            easy: { hp: 95, damageMin: 18, damageMax: 25 },
            dir: 'skeleton', h: 0.95, threat: 2,
            hint: 'Быстрые кинжалы. Может собраться вновь.',
            hitColors: ['#efe2c4', '#c9b48a', '#8b7d6f', '#ffffff'],
            deathPalette: ['#efe2c4', '#c9b48a', '#8b7d6f', '#5a4a3a', '#2a221c']
        },
        ghost: {
            name: 'ПРИЗРАК', plural: 'ПРИЗРАКИ', hp: 263,
            damageMin: 44, damageMax: 55,
            exp: 65,
            gold: { easy: 47, normal: 72, hard: 98, hardcore: 180 },
            easy: { hp: 190, damageMin: 36, damageMax: 46 },
            dir: 'ghost', h: 1.0, threat: 3,
            hint: 'Бьёт больно. Уклоняется от каждого пятого удара.',
            hitColors: ['#79e6d6', '#bff7ee', '#3a8a90', '#e8ffff'],
            deathPalette: ['#79e6d6', '#4aa8a8', '#2a5a66', '#bff7ee', '#1a2a3a']
        },
        death_knight: {
            name: 'РЫЦАРЬ СМЕРТИ', plural: 'РЫЦАРИ СМЕРТИ', hp: 402,
            damageMin: 85, damageMax: 101,
            exp: 130,
            gold: { easy: 98, normal: 130, hard: 201, hardcore: 330 },
            easy: { hp: 290, damageMin: 70, damageMax: 84 },
            dir: 'death-knight', h: 1.12, threat: 4,
            hint: 'Элита. Каждый третий удар — двойной. Держи защиту.',
            hitColors: ['#ffffff', '#ffd34a', '#ff8a2a', '#5a4a60'],
            deathPalette: ['#3a3040', '#5a4a60', '#2a2228', '#8a7a68', '#79c8ff']
        }
    };

    /* ---------- enemy art: frames + poses from media/sprites/manifest.js ---------- */
    const SPRITES = window.DUST_SPRITES || {};
    // build stamp from the manifest: new art is never served from the browser cache
    const SPRITE_V = window.DUST_SPRITES_V ? '?v=' + window.DUST_SPRITES_V : '';
    function spriteInfo(type) {
        return SPRITES[MOBS[type].dir] || { w: 1, h: 1, poses: ['idle'], feetX: 0.5, bodyX: 0.5, top: 0, ground: 1 };
    }
    function mobPoseSrc(type, pose) {
        const info = spriteInfo(type);
        const p = info.poses.indexOf(pose) >= 0 ? pose : 'idle';
        return M + 'sprites/' + MOBS[type].dir + '/' + p + '.png' + SPRITE_V;
    }
    Object.keys(MOBS).forEach(k => { MOBS[k].img = mobPoseSrc(k, 'idle'); });

    function setFoePose(e, pose) {
        if (!e.img || e.pose === pose) return;
        e.pose = pose;
        e.img.src = mobPoseSrc(e.mobType, pose);
        e.el.dataset.pose = pose;
    }

    /** Show a pose for a moment, then return to idle (unless something else took over) */
    async function foeBeat(e, pose, ms) {
        setFoePose(e, pose);
        await wait(ms);
        if (!e.dead && e.pose === pose) setFoePose(e, 'idle');
    }

    /* x: % of width, y: px above ground, s: scale, z: stacking */
    const SLOTS = {
        1: [{ x: 72, y: 0, s: 1, z: 3 }],
        2: [{ x: 63, y: 30, s: 0.9, z: 2 }, { x: 84, y: 0, s: 1, z: 3 }],
        3: [{ x: 57, y: 40, s: 0.84, z: 1 }, { x: 86, y: 40, s: 0.84, z: 1 }, { x: 72, y: 0, s: 1, z: 3 }],
        // 4-5: back row stands between the front ones, so every enemy can be clicked
        4: [{ x: 57, y: 48, s: 0.82, z: 1 }, { x: 77, y: 48, s: 0.82, z: 1 },
            { x: 67, y: 0, s: 0.95, z: 3 }, { x: 87, y: 0, s: 0.95, z: 3 }],
        5: [{ x: 55, y: 54, s: 0.78, z: 1 }, { x: 73, y: 54, s: 0.78, z: 1 }, { x: 91, y: 54, s: 0.78, z: 1 },
            { x: 64, y: 0, s: 0.92, z: 3 }, { x: 82, y: 0, s: 0.92, z: 3 }]
    };

    /* ------------------------------------------------------------------ */
    let hero = null;
    let audio = null;
    let mobType = null;
    let hardcore = false;
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
        heroUlt: $('heroUlt'),
        timing: $('timing'),
        timingTrack: $('timingTrack'),
        timingLine: $('timingLine'),
        timingRate: $('timingRate'),
        timingHint: $('timingHint'),
        timingCount: $('timingCount'),
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

    /** Centre of the hero's BODY (frame: body at 32% of the width, top at 14% of the height) */
    function heroCenter(fy) {
        const f = el.heroImg.getBoundingClientRect();
        const r = { left: f.left + f.width * 0.15, top: f.top + f.height * 0.14, width: f.width * 0.34, height: f.height * 0.86 };
        r.right = r.left + r.width;
        r.bottom = r.top + r.height;
        return { x: f.left + f.width * 0.32, y: r.top + r.height * (fy == null ? 0.5 : fy), r };
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
        el.rageText.textContent = rage >= RAGE_MAX ? 'ЯРОСТЬ — УЛЬТИМЕЙТ ГОТОВ!' : 'ЯРОСТЬ ' + rage;
        el.rageBar.classList.toggle('full', rage >= RAGE_MAX);
    }

    function addRage(n) {
        const was = rage;
        rage = C.clamp(rage + n, 0, RAGE_MAX);
        if (was < RAGE_MAX && rage >= RAGE_MAX) {
            synth('charge');
            const c = heroCenter(0.5);
            fnum('ЯРОСТЬ!', 'crit', c.x, c.y - 40, { rise: 60 });
            log('<span class="c-crit">Ярость заполнена — УЛЬТИМЕЙТ готов [R]</span>');
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
        setBtn(el.shopBtn, phase === 'player' && shopOpen());
        el.shopBtn.title = shopOpen() ? 'Торговец [S]'
            : 'Торговец откроется на волне ' + (Math.floor(wave / HC_SHOP_EVERY) + 1) * HC_SHOP_EVERY;
    }

    /** In hardcore the merchant is only there on waves 5, 10, 15... */
    function shopOpen() {
        return !hardcore || wave % HC_SHOP_EVERY === 0;
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
        el.waveBadge.textContent = hardcore ? 'ВОЛНА ' + wave : 'ВОЛНА ' + wave + ' / ' + MAX_WAVES;
        el.wavePips.hidden = hardcore;
        const alive = enemies.filter(e => !e.dead).length;
        el.enemiesCount.textContent = 'ВРАГОВ: ' + alive;
        const d = C.DIFFICULTY[difficultyKey] || C.DIFFICULTY.normal;
        el.diffBadge.textContent = hardcore ? C.HARDCORE.label : d.label;
        el.diffBadge.className = 'diff-badge ' + (hardcore ? 'hard hardcore' : difficultyKey);
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
    /* ---------- hero poses (media/sprites/hero/<pose>.png, all on one aligned frame) ---------- */
    const HERO_POSES = ['idle', 'attack', 'block', 'damage', 'win', 'defeat'];
    const heroPoseSrc = p => M + 'sprites/hero/' + p + '.png' + SPRITE_V;
    let heroPose = 'idle';

    // Pose pictures are loaded and decoded up front and kept referenced here,
    // so swapping a pose is instant (an unreferenced Image may be dropped mid-load).
    const posePool = [];
    function preloadImage(src) {
        const im = new Image();
        im.src = src;
        if (im.decode) im.decode().catch(() => {});
        posePool.push(im);
    }

    function preloadHeroPoses() {
        HERO_POSES.map(heroPoseSrc).concat(M + 'sprites/hero/ult.webp').forEach(preloadImage);
    }

    function setHeroPose(p) {
        if (heroPose === p) return;
        heroPose = p;
        el.heroImg.src = heroPoseSrc(p);
        el.hero.dataset.pose = p;
    }

    /** Pose the hero returns to between actions */
    function heroRestPose() {
        return 'idle';
    }

    /** Show a pose for a moment, then go back to the resting pose */
    async function heroBeat(p, ms) {
        setHeroPose(p);
        await wait(ms);
        if (phase !== 'over' && heroPose === p) setHeroPose(heroRestPose());
    }

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
        const c = heroCenter(0.4);
        fxLayer.pillar(c.x, groundY(), { width: c.r.width * 0.7, height: c.r.height * 1.6, color: '#ffe28a' });
        fnum('НОВЫЙ УРОВЕНЬ!', 'lvl', c.x, c.r.top - 10, { rise: 120, duration: 1600 });
        log('<span class="c-sys">Уровень ' + hero.level + '! +15 здоровья, +3 силы</span>');
        updateHeroUI();
        C.saveCharacter(hero);
    }

    /* ------------------------------------------------------------------ */
    /* enemies                                                             */
    /* ------------------------------------------------------------------ */
    function scaledMob(mob, w) {
        const key = hardcore ? 'hardcore' : C.DIFFICULTY[difficultyKey] ? difficultyKey : 'normal';
        const diff = hardcore ? C.HARDCORE : C.DIFFICULTY[key];
        const base = key === 'easy' && mob.easy ? Object.assign({}, mob, mob.easy) : mob;
        const scale = 1 + (w - 1) * (hardcore ? HC_SCALE : WAVE_SCALE);
        const hp = Math.round(base.hp * diff.enemyHp * scale);
        return {
            name: base.name,
            hp,
            maxHp: hp,
            dmgMin: Math.max(1, Math.round(base.damageMin * diff.enemyDmg * scale)),
            dmgMax: Math.max(1, Math.round(base.damageMax * diff.enemyDmg * scale)),
            exp: Math.round(base.exp * diff.reward),
            gold: base.gold[key]
        };
    }

    function buildFoe(e) {
        const base = MOBS[e.mobType];
        const root = document.createElement('div');
        root.className = 'foe';
        root.dataset.mob = e.mobType;
        root.style.left = e.slot.x + '%';
        root.style.bottom = 'calc(var(--ground) + ' + e.slot.y + 'px * var(--s))';
        // frame width so the idle body is (h x unit-h) tall; feet land on the slot point
        const info = spriteInfo(e.mobType);
        const aspect = info.w / info.h;
        const bodyFrac = Math.max(0.2, info.ground - info.top);
        const wK = base.h * e.slot.s / bodyFrac * aspect;
        root.style.setProperty('--w', 'calc(var(--unit-h) * ' + wK.toFixed(3) + ')');
        root.style.setProperty('--z', e.slot.z);
        root.style.setProperty('--fx', info.feetX);
        root.style.setProperty('--cx', info.bodyX);
        root.style.setProperty('--fw', (0.5 * base.h * e.slot.s / wK).toFixed(3));
        root.style.setProperty('--bw', (0.42 * base.h * e.slot.s / wK).toFixed(3));
        root.style.setProperty('--head', ((info.ground - info.top) / info.ground).toFixed(4));
        root.style.setProperty('--sink', (-(1 - info.ground) / aspect).toFixed(4));
        root.dataset.pose = 'idle';
        root.innerHTML =
            '<div class="target-arrow"></div>' +
            '<div class="intent hidden"><img src="' + ICON('attack') + '" alt=""><span></span></div>' +
            '<div class="foe-body">' +
                '<div class="target-ring"></div>' +
                '<div class="unit-shadow"></div>' +
                '<img class="foe-sprite" src="' + base.img + '" alt="' + e.name + '" decoding="async">' +
                '<div class="foe-hit"></div>' +
            '</div>' +
            '<div class="foe-plate">' +
                '<div class="foe-name">' + e.name + '</div>' +
                '<div class="px-bar hp"><div class="ghost"></div><div class="fill"></div><span class="txt"></span></div>' +
            '</div>';
        e.el = root;
        e.body = root.querySelector('.foe-body');
        e.img = root.querySelector('.foe-sprite');
        e.box = root.querySelector('.foe-hit');
        e.pose = 'idle';
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
        const lo = e.dmgMin * mult;
        const hi = e.dmgMax * mult;
        e.intentEl.classList.toggle('heavy', heavy);
        e.intentEl.querySelector('span').textContent = (heavy ? 'x2 ' : '') + lo + '–' + hi;
        e.el.classList.toggle('charging', heavy);
        if (heavy && !wasHeavy) {
            synth('charge');
            const c = center(e.box, 0.5);
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

    /* ------------------------------------------------------------------ */
    /* enemy voices                                                        */
    /* ------------------------------------------------------------------ */
    // media/audio/<prefix><n>.mp3 = idle mutter, <prefix>-<event><n>.mp3 = said on that event only.
    // z = zombie, s = skeleton, g = ghost, dk = death knight (no idle lines).
    const VOICES = {
        zombie: {
            idle: ['z1.mp3', 'z2.mp3', 'z3.ogg', 'z4.mp3', 'z5.mp3', 'z6.mp3', 'z7.mp3'],
            death: ['z-death.mp3']
        },
        skeleton: {
            idle: ['s1.mp3', 's2.mp3', 's3.mp3'],
            dam: ['s-dam1.mp3', 's-dam2.mp3', 's-dam3.mp3', 's-dam4.mp3'],
            death: ['s-death.mp3']
        },
        ghost: {
            idle: ['g1.mp3', 'g2.mp3', 'g3.mp3', 'g4.mp3'],
            attack: ['g-attack1.mp3', 'g-attack2.mp3'],
            dam: ['g-dam1.mp3', 'g-dam2.mp3'],
            death: ['g-death.mp3']
        },
        death_knight: {
            spawn: ['dk-spawn1.mp3', 'dk-spawn2.mp3'],
            attack: ['dk-attack1.mp3', 'dk-attack2.mp3'],
            miss: ['dk-miss.mp3'],
            death: ['dk-death.mp3']
        }
    };
    // event sounds always play; only the knight's taunt on a miss is left to chance.
    // idle mutters are paced by VOICE_IDLE_MS instead of a chance.
    const VOICE_CHANCE = { spawn: 1, attack: 1, dam: 1, death: 1, miss: 0.5, idle: 1 };
    const VOICE_IDLE_MS = [8000, 16000];   // random pause between idle mutters
    const VOICE_VOLUME = 0.9;
    let voiceBusyUntil = 0;
    let voiceLast = '';
    let voiceIdleTimer = 0;
    const voicesLoaded = {};

    function loadVoices(type) {
        if (!audio || voicesLoaded[type] || !VOICES[type]) return;
        voicesLoaded[type] = true;
        Object.values(VOICES[type]).forEach(list => list.forEach(f => audio.loadSfx('v:' + f, M + 'audio/' + f, 2)));
    }

    /** Say something. Idle mutters and the miss taunt wait their turn; event lines always play. */
    // events where the character always makes a sound: its own clip for that event if it has one,
    // otherwise any of its plain lines (z1, s2, g3...). Event clips are never used for other events.
    const VOICE_FALLBACK = { spawn: true, attack: true, dam: true, death: true };

    function voice(type, event, opt) {
        const o = opt || {};
        const set = VOICES[type] || {};
        let list = set[event];
        if ((!list || !list.length) && VOICE_FALLBACK[event]) list = set.idle;
        if (!audio || !list || !list.length) return;
        const now = performance.now();
        // only idle mutters wait for silence; event lines (and the miss taunt) are never held back
        if (!o.force && event === 'idle' && now < voiceBusyUntil) return;
        if (Math.random() > (o.chance != null ? o.chance : VOICE_CHANCE[event])) return;
        let pick = list[(Math.random() * list.length) | 0];
        if (list.length > 1 && pick === voiceLast) pick = list[(list.indexOf(pick) + 1) % list.length];
        voiceLast = pick;
        const a = audio.playSfx('v:' + pick, VOICE_VOLUME);
        const len = a && isFinite(a.duration) && a.duration > 0 ? a.duration * 1000 : 1500;
        voiceBusyUntil = now + len + 250;
    }

    /** Idle mutters while enemies just stand there (only types that have idle lines) */
    function scheduleIdleVoice() {
        clearTimeout(voiceIdleTimer);
        const [lo, hi] = VOICE_IDLE_MS;
        voiceIdleTimer = setTimeout(() => {
            if (phase === 'player' || phase === 'busy') {
                const talkers = alive().filter(e => VOICES[e.mobType] && VOICES[e.mobType].idle);
                if (talkers.length) voice(talkers[(Math.random() * talkers.length) | 0].mobType, 'idle');
            }
            if (phase !== 'over' && phase !== 'choose') scheduleIdleVoice();
        }, lo + Math.random() * (hi - lo));
    }

    function stopIdleVoices() {
        clearTimeout(voiceIdleTimer);
    }

    /* ---------- hardcore waves ---------- */
    // 1 enemy at first, 2-3 early on, 4 from wave 10, 5 from wave 12
    function hardcoreCount(n) {
        if (n <= 1) return 1;
        if (n <= 3) return 2;
        if (n < 10) return 3;
        if (n < 12) return 4;
        return HC_MAX_FOES;
    }

    /** Random mix for wave n. A threat budget grows with the wave, so knights show up later and rarely early. */
    function hardcoreRoster(n) {
        const types = Object.keys(MOBS);
        const count = hardcoreCount(n);
        const budget = 1 + (n - 1) * 1.6;
        const maxThreat = Math.min(4, 1 + Math.floor(n / 2));
        const pool = types.filter(t => MOBS[t].threat <= maxThreat);
        const roster = [];
        for (let i = 0; i < count; i++) roster.push(pool[(Math.random() * pool.length) | 0]);
        // over budget: weaken a random strong enemy one step at a time
        const sum = () => roster.reduce((a, t) => a + MOBS[t].threat, 0);
        while (sum() > Math.max(budget, count)) {
            const strong = roster.map((t, i) => i).filter(i => MOBS[roster[i]].threat > 1);
            const i = strong[(Math.random() * strong.length) | 0];
            roster[i] = types.find(t => MOBS[t].threat === MOBS[roster[i]].threat - 1);
        }
        // the strongest stand in front (last slots)
        return roster.sort((a, b) => MOBS[a].threat - MOBS[b].threat);
    }

    /** Hardcore has its own soundtrack */
    function battleTrack() {
        return hardcore ? 'hardcore' : 'battle';
    }

    function startGameWithMobType(key) {
        hardcore = key === HARDCORE;
        mobType = hardcore ? null : key;
        if (audio) audio.playMusic(battleTrack(), 600);
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
        if (hardcore) Object.keys(MOBS).forEach(loadVoices);
        else loadVoices(key);
        startWave(1);
        scheduleIdleVoice();
    }

    async function startWave(n) {
        wave = n;
        phase = 'busy';
        updateActions();
        setTurnBanner('');
        el.foes.innerHTML = '';
        el.shopBtn.classList.remove('shop-alert');
        const roster = hardcore ? hardcoreRoster(n) : Array(n).fill(mobType);
        const base = MOBS[roster[roster.length - 1]];
        const slots = SLOTS[roster.length];
        el.foes.classList.toggle('crowd', roster.length >= 4);
        enemies = roster.map((type, i) => Object.assign(scaledMob(MOBS[type], n), {
            id: i, mobType: type, slot: slots[i], turns: 0, dead: false, revived: false, intent: null
        }));
        // front-most (largest) enemy is the default target
        sel = enemies.length - 1;
        updateWaveUI();

        synth('wave');
        const sub = hardcore ? 'ВРАГОВ: ' + roster.length + (n === 1 ? '' : ' · ВПЕРЕМЕШКУ')
            : n === 1 ? 'ВРАГОВ: 1 · ' + base.name : 'ВРАГОВ: ' + n + ' · ' + base.plural;
        const cine = cinema('ВОЛНА ' + n, sub, 1200);

        // enemies march in from the right
        await wait(250);
        enemies.forEach((e, i) => {
            const node = buildFoe(e);
            el.foes.appendChild(node);
            anim(node, [
                { transform: 'translateX(60vw)', opacity: 0 },
                { transform: 'translateX(0)', opacity: 1 }
            ], { duration: 700, delay: i * 160, easing: EASE.out, fill: 'backwards' }).then(() => {
                const r = e.box.getBoundingClientRect();
                fxLayer.burst(r.left + r.width / 2, r.bottom, {
                    count: 18, speed: 70, angle: -Math.PI / 2, spread: 1.3, gravity: 200, life: 0.7,
                    colors: ['#c49a58', '#a07840', '#e8d0a0'], floor: r.bottom + 4
                });
            });
        });

        await cine;
        // one spawn sound per wave, however many enemies appear (they'd only drown each other out)
        voice(roster[roster.length - 1], 'spawn');
        if (hardcore && shopOpen()) {
            play('shopOpen');
            el.shopBtn.classList.add('shop-alert');
            log('<span class="c-sys">Торговец открыл лавку! Только на эту волну.</span>');
        }
        log('<span class="c-sys">Волна ' + n + ': ' + (hardcore ? listRoster(roster)
            : n === 1 ? base.name : n + ' × ' + base.name) + '</span>');
        beginPlayerTurn();
    }

    /** "2 × ЗОМБИ, СКЕЛЕТ" */
    function listRoster(roster) {
        const n = {};
        roster.forEach(t => { n[t] = (n[t] || 0) + 1; });
        return Object.keys(n).reverse().map(t => (n[t] > 1 ? n[t] + ' × ' : '') + MOBS[t].name).join(', ');
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
        if (hardcore || wave < MAX_WAVES) {
            synth('levelup');
            const c = heroCenter(0.4);
            const before = hero.currentHp;
            hero.currentHp = hardcore ? Math.min(hero.maxHp, hero.currentHp + Math.round(hero.maxHp * HC_HEAL)) : hero.maxHp;
            updateHeroUI();
            C.saveCharacter(hero);
            fxLayer.pillar(c.x, groundY(), { width: c.r.width * 0.6, height: c.r.height * 1.4, color: '#8fe06a', life: 1.2 });
            if (hardcore) {
                fnum('+' + (hero.currentHp - before) + ' HP', 'heal', c.x, c.r.top, { rise: 80, duration: 1400 });
                log('<span class="c-heal">Передышка: +' + (hero.currentHp - before) + ' HP.</span>');
            } else {
                fnum('HP ВОССТАНОВЛЕНО', 'heal', c.x, c.r.top, { rise: 80, duration: 1400 });
                log('<span class="c-heal">Здоровье восстановлено.</span>');
            }
            setHeroPose('win');
            await wait(1100);
            setHeroPose('idle');
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

    /* ------------------------------------------------------------------ */
    /* attack timing bar (Undertale-style)                                 */
    /* ------------------------------------------------------------------ */
    // Zone edges are distances from the centre as a fraction of half the bar — keep in sync with .timing in style.css
    const TIMING = {
        ms: { easy: 1250, normal: 1000, hard: 800 },   // time for the line to cross the bar
        perfect: 0.06, great: 0.25, good: 0.55,
        perfectBonus: 1.5
    };

    /** Damage multiplier from accuracy: 0.5 at the very edge, 1.4 dead centre (+bonus for perfect) */
    function timingMs() {
        return TIMING.ms[hardcore ? 'hard' : difficultyKey] || TIMING.ms.normal;
    }

    function timingResult(d) {
        if (d == null) return { mult: 0, rating: 'miss', label: 'ПРОМАХ', miss: true };
        const acc = 1 - d;
        let mult = 0.5 + 0.9 * acc;
        if (d <= TIMING.perfect) return { mult: mult * TIMING.perfectBonus, rating: 'perfect', label: 'ИДЕАЛЬНО!', perfect: true };
        if (d <= TIMING.great) return { mult, rating: 'great', label: 'ОТЛИЧНО' };
        if (d <= TIMING.good) return { mult, rating: 'good', label: 'ХОРОШО' };
        return { mult, rating: 'weak', label: 'СЛАБО' };
    }

    /** Run the bar; resolves once the player stopped the line (or it ran out) */
    function attackTiming() {
        return new Promise(resolve => {
            const box = el.timing, line = el.timingLine, rate = el.timingRate;
            const dur = timingMs();
            box.hidden = false;
            box.className = 'timing show';
            rate.className = 'timing-rate';
            rate.textContent = '';
            const trackW = el.timingTrack.clientWidth;
            const t0 = performance.now();
            let done = false;
            let raf = 0;

            function place(p) {
                line.style.transform = 'translateX(' + (p * trackW).toFixed(1) + 'px)';
            }

            function finish(p) {
                if (done) return;
                done = true;
                cancelAnimationFrame(raf);
                window.removeEventListener('keydown', onKey, true);
                window.removeEventListener('pointerdown', onPointer, true);
                const d = p == null ? null : Math.min(1, Math.abs(p - 0.5) / 0.5);
                const res = timingResult(d);
                if (p != null) place(p);
                box.classList.add('stopped');
                rate.textContent = res.label;
                rate.className = 'timing-rate pop ' + res.rating;
                // the slash sound lands the moment you press (Undertale-style); the hero's swing follows
                if (!res.miss) play('slash', res.perfect ? 1.15 : 1);
                if (res.perfect) { synth('perfect'); FX.flash('#fff6d0', 120, 0.25); }
                else if (res.miss) synth('evade');
                setTimeout(() => {
                    box.classList.add('hide');
                    setTimeout(() => { box.hidden = true; box.className = 'timing'; }, 220);
                    resolve(res);
                }, res.perfect ? 520 : 420);
            }

            function stopNow(ts) {
                // judge the exact moment of the press (event time), not when the handler got to run
                const at = Math.min(performance.now(), ts || performance.now());
                // a short grace period so the press that opened the bar can't stop it
                if (at - t0 < 90) return;
                finish(Math.min(1, Math.max(0, (at - t0) / dur)));
            }

            function onKey(e) {
                const k = e.key.toLowerCase();
                if (k === ' ' || k === 'enter' || k === 'a' || k === 'ф' || k === '1') {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!e.repeat) stopNow(e.timeStamp);
                }
            }

            function onPointer(e) {
                e.preventDefault();
                e.stopPropagation();
                stopNow(e.timeStamp);
            }

            (function tick(now) {
                if (done) return;
                const p = (now - t0) / dur;
                if (p >= 1) { place(1); finish(null); return; }
                place(Math.max(0, p));
                raf = requestAnimationFrame(tick);
            })(t0);

            window.addEventListener('keydown', onKey, true);
            window.addEventListener('pointerdown', onPointer, true);
            // safety net if frames stall (background tab): the line still runs out on time
            setTimeout(() => finish(null), dur + 60);
        });
    }

    /**
     * Whirlwind bar: ULT_LINES lines chase each other across the bar.
     * Each press stops the line that is furthest along. Every hit plays ult-hit,
     * the last line's hit plays ult-slash (the finishing blow).
     */
    const ULT_LINES = 5;

    function ultTiming() {
        return new Promise(resolve => {
            const box = el.timing, track = el.timingTrack, rate = el.timingRate, count = el.timingCount;
            const dur = timingMs();
            const gap = dur * 0.34;
            box.hidden = false;
            box.className = 'timing show ult';
            rate.className = 'timing-rate';
            rate.textContent = '';
            el.timingHint.innerHTML = '<span class="px-key">SPACE</span> / КЛИК — ' + ULT_LINES + ' УДАРОВ В ЦЕНТР';
            count.hidden = false;
            count.innerHTML = '<i></i>'.repeat(ULT_LINES);
            const pips = Array.from(count.children);
            const trackW = track.clientWidth;
            const t0 = performance.now();
            const lines = [];
            for (let i = 0; i < ULT_LINES; i++) {
                const node = document.createElement('div');
                node.className = 'timing-line ult-line';
                node.style.visibility = 'hidden';
                track.appendChild(node);
                lines.push({ i, node, start: t0 + i * gap, done: false, res: null });
            }
            let finished = false;
            let raf = 0;

            const progress = (ln, now) => (now - ln.start) / dur;
            const place = (ln, q) => { ln.node.style.transform = 'translateX(' + (q * trackW).toFixed(1) + 'px)'; };

            function settle(ln, res) {
                ln.done = true;
                ln.res = res;
                const pip = pips[ln.i];
                if (res.miss) {
                    ln.node.classList.add('missed');
                    pip.className = 'missed';
                    synth('evade');
                } else {
                    ln.node.classList.add('hit');
                    if (res.perfect) ln.node.classList.add('perfect');
                    pip.className = res.perfect ? 'hit perfect' : 'hit';
                    // the final line is the finishing blow
                    // the final line is the finishing blow: ult-perfect if all five hits were
                    // ОТЛИЧНО or ИДЕАЛЬНО (any mix), otherwise ult-slash
                    if (ln.i === ULT_LINES - 1) {
                        const strong = r => r && (r.rating === 'perfect' || r.rating === 'great');
                        const allStrong = lines.every(l => strong(l === ln ? res : l.res));
                        play(allStrong ? 'ultPerfect' : 'ultSlash', allStrong ? 1.2 : (res.perfect ? 1.15 : 1));
                    } else {
                        play('ultHit', res.perfect ? 1.15 : 1);
                    }
                    if (res.perfect) FX.flash('#fff6d0', 90, 0.18);
                }
                rate.textContent = res.label;
                rate.className = 'timing-rate';
                void rate.offsetWidth;
                rate.className = 'timing-rate pop ' + res.rating;
                if (lines.every(l => l.done)) end();
            }

            function end() {
                if (finished) return;
                finished = true;
                cancelAnimationFrame(raf);
                window.removeEventListener('keydown', onKey, true);
                window.removeEventListener('pointerdown', onPointer, true);
                const results = lines.map(l => l.res);
                const hits = results.filter(r => !r.miss).length;
                const perfects = results.filter(r => r.perfect).length;
                const total = results.reduce((sum, r) => sum + r.mult, 0);
                const flawless = perfects === ULT_LINES;
                const showSummary = () => {
                    rate.textContent = flawless ? 'ИДЕАЛЬНО ×' + ULT_LINES + '!'
                        : 'ПОПАДАНИЙ ' + hits + '/' + ULT_LINES + (perfects ? ' · ИДЕАЛЬНЫХ ' + perfects : '');
                    rate.className = 'timing-rate';
                    void rate.offsetWidth;
                    rate.className = 'timing-rate pop ' + (flawless ? 'perfect' : hits >= 4 ? 'great' : hits >= 2 ? 'good' : hits ? 'weak' : 'miss');
                    if (flawless) FX.flash('#fff6d0', 220, 0.35);
                };
                // keep the last line's own rating (ИДЕАЛЬНО / ОТЛИЧНО...) visible for a moment
                const lastHit = !lines[ULT_LINES - 1].res.miss;
                if (lastHit) setTimeout(showSummary, 380); else showSummary();
                setTimeout(() => {
                    box.classList.add('hide');
                    setTimeout(() => {
                        box.hidden = true;
                        box.className = 'timing';
                        count.hidden = true;
                        el.timingHint.innerHTML = '<span class="px-key">SPACE</span> / КЛИК — БЕЙ В ЦЕНТР';
                        lines.forEach(l => l.node.remove());
                    }, 220);
                    resolve({ results, hits, perfects, mult: total / ULT_LINES });
                }, 1000);
            }

            function press(ts) {
                // the exact moment of the press (event time), not when the handler got to run
                const now = Math.min(performance.now(), ts || performance.now());
                if (now - t0 < 90) return;
                // the line that is furthest along and still running
                let best = null;
                for (const ln of lines) {
                    if (ln.done || now < ln.start) continue;
                    if (!best || ln.start < best.start) best = ln;
                }
                if (!best) return;
                const q = Math.min(1, progress(best, now));
                place(best, q);
                settle(best, timingResult(Math.min(1, Math.abs(q - 0.5) / 0.5)));
            }

            function onKey(e) {
                const k = e.key.toLowerCase();
                if (k === ' ' || k === 'enter' || k === 'a' || k === 'ф' || k === '1' || k === 'r' || k === 'к' || k === '2') {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!e.repeat) press(e.timeStamp);
                }
            }

            function onPointer(e) {
                e.preventDefault();
                e.stopPropagation();
                press(e.timeStamp);
            }

            function sweep(now) {
                for (const ln of lines) {
                    if (ln.done || now < ln.start) continue;
                    const q = progress(ln, now);
                    if (q >= 1) { place(ln, 1); settle(ln, timingResult(null)); continue; }
                    ln.node.style.visibility = 'visible';
                    place(ln, Math.max(0, q));
                }
            }

            (function tick(now) {
                if (finished) return;
                sweep(now);
                if (!finished) raf = requestAnimationFrame(tick);
            })(t0);

            window.addEventListener('keydown', onKey, true);
            window.addEventListener('pointerdown', onPointer, true);
            // safety net if frames stall: lines still run out on time
            const deadline = (ULT_LINES - 1) * gap + dur + 80;
            setTimeout(() => { if (!finished) sweep(t0 + deadline); }, deadline);
        });
    }

    async function heroAttack() {
        if (!beginAction()) return;
        const target = enemies[sel];
        const hr = el.hero.getBoundingClientRect();
        const tr = target.box.getBoundingClientRect();
        // the greatsword's tip is near the right edge of the frame: lunge until it reaches the target
        const dx = Math.max(0, tr.left + tr.width * 0.45 - (hr.left + hr.width * 0.92));

        const timing = await attackTiming();

        await anim(el.hero, [{ transform: 'translateX(0)' }, { transform: 'translateX(-20px)' }], { duration: 110, easing: EASE.out, fill: 'forwards' });
        play('attack');
        setHeroPose('attack');
        await heroDash(dx);

        // stopped too late: the blade cuts air
        if (timing.miss) {
            voice(target.mobType, 'miss');
            const c = center(target.box, 0.3);
            fnum('ПРОМАХ', 'info', c.x, c.y);
            log('<span class="c-hero">Вы</span> бьёте мимо');
            setCombo(0);
            await wait(160);
            await heroReturn(dx);
            setHeroPose('idle');
            await afterHeroAction();
            return;
        }

        // ghosts may slip away (a perfect strike always lands)
        if (target.mobType === 'ghost' && !timing.perfect && Math.random() < GHOST_EVADE) {
            synth('evade');
            anim(target.body, [{ transform: 'none', opacity: 1 }, { transform: 'translateX(40px)', opacity: 0.3 }, { transform: 'none', opacity: 1 }],
                { duration: 420, easing: EASE.out });
            const c = center(target.box, 0.3);
            fnum('УКЛОН', 'info', c.x, c.y);
            fxLayer.burst(c.x, c.y + 40, { count: 16, speed: 60, gravity: -60, colors: MOBS.ghost.hitColors, glow: true, additive: true });
            log('<span class="c-foe">' + target.name + ' ускользает от клинка</span>');
            setCombo(0);
            await wait(120);
            await heroReturn(dx);
            setHeroPose('idle');
            await afterHeroAction();
            return;
        }

        setCombo(combo + 1);
        // damage follows the timing: the closer to the centre, the harder; perfect = crit
        const isCrit = !!timing.perfect;
        // small spread (same average as the old +1..10) so accuracy, not luck, decides the damage
        let damage = Math.max(1, Math.round((hero.strength + 4 + C.randInt(0, 3)) * timing.mult));
        const comboHit = combo >= 3 && combo % 3 === 0;
        if (comboHit) damage = Math.round(damage * 1.25);

        const c = center(target.box, 0.45);
        fxLayer.slash(c.x, c.y, {
            radius: tr.width * (isCrit ? 0.55 : 0.42), width: isCrit ? 7 : 5,
            from: -2.4, to: 0.8, edge: isCrit ? '#ff8a2a' : '#ffd34a', life: isCrit ? 0.3 : 0.22
        });
        await hitEnemy(target, damage, { crit: isCrit, combo: comboHit, tag: isCrit ? 'ИДЕАЛЬНО!' : (timing.rating === 'great' ? 'ОТЛИЧНО' : null) });
        addRage(RAGE_ON_HIT);

        await wait(isCrit ? 160 : 70); // hit-stop
        await heroReturn(dx);
        setHeroPose('idle');
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
        hero.bestHit = Math.max(hero.bestHit || 0, damage);

        const c = center(e.box, 0.4);
        const tag = o.tag || (o.crit ? 'КРИТ!' : (o.combo ? 'КОМБО' : null));
        const label = tag ? '<small>' + tag + '</small>' + damage : String(damage);
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
        e.hitAt = performance.now();
        if (e.hp > 0) {
            foeBeat(e, 'damage', 380);
            voice(e.mobType, 'dam');
        }
        else setFoePose(e, 'damage');

        log((o.crit ? '<span class="c-crit">КРИТ!</span> ' : '') + '<span class="c-hero">Вы</span> рубите: ' + e.name +
            ' <span class="c-dmg">−' + damage + '</span>');

        if (e.hp <= 0) await onEnemyZero(e);
    }

    /** Skeletons may pull themselves back together once */
    async function onEnemyZero(e) {
        if (e.mobType === 'skeleton' && !e.revived && wave >= 2 && Math.random() < SKELETON_REVIVE) {
            e.revived = true;
            const c = center(e.box, 0.6);
            fxLayer.burst(c.x, c.y, { count: 40, speed: 160, gravity: 500, life: 1, colors: MOBS.skeleton.deathPalette, floor: groundY() + 4 });
            play('attack', 0.3);
            await wait(260);          // let the damage frame register first
            setFoePose(e, 'defeat');
            await wait(650);
            e.hp = Math.round(e.maxHp * 0.35);
            updateFoeHp(e);
            synth('charge');
            setFoePose(e, 'idle');
            await anim(e.img, [{ transform: 'translateY(8%)', opacity: 0.5 }, { transform: 'translateY(-3%)', opacity: 1, offset: 0.7 }, { transform: 'none', opacity: 1 }],
                { duration: 420, easing: EASE.out });
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
            const c = center(e.box, 0.45);
            voice(e.mobType, 'death', { force: true });
            play('coin');
            FX.shake(el.game, 6);
            e.intentEl.classList.add('hidden');
            e.el.classList.remove('selected', 'charging');
            anim(e.el.querySelector('.foe-plate'), [{ opacity: 1 }, { opacity: 0 }], { duration: 400, easing: EASE.out, fill: 'forwards' });
            // the damage frame of the killing blow stays visible a moment before the body drops
            const shown = performance.now() - (e.hitAt || 0);
            if (shown < 320) await wait(320 - shown);
            // the body drops in its defeat pose, lies there for a moment, then crumbles to dust
            setFoePose(e, 'defeat');
            const corpse = e;
            setTimeout(() => {
                fxLayer.disintegrate(corpse.img, { palette: base.deathPalette, dir: 1, gravity: corpse.mobType === 'ghost' ? -60 : -20 });
                corpse.img.style.visibility = 'hidden';
                corpse.el.querySelector('.unit-shadow').style.opacity = '0';
            }, 900);

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
            setTimeout(() => e.el.remove(), 2600);
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

        // five strikes on the timing bar decide how hard the storm hits
        const ult = await ultTiming();
        if (!ult.hits) {
            const c = heroCenter(0.4);
            fnum('ПРОМАХ', 'info', c.x, c.y);
            log('<span class="c-hero">Ультимейт</span> рассеялся впустую');
            el.hero.classList.remove('raging');
            await afterHeroAction();
            return;
        }
        synth('whirl');
        FX.flash('#ff8a2a', 220, 0.3);
        const hc = heroCenter(0.5);
        fxLayer.ring(hc.x, groundY(), { radius: 200, color: '#ff8a2a', flat: 0.25, life: 0.5 });
        log('<span class="c-crit">УЛЬТИМЕЙТ!</span> Попаданий: ' + ult.hits + '/' + ULT_LINES);

        const targets = alive();
        const hr = el.hero.getBoundingClientRect();
        const xs = targets.map(e => e.box.getBoundingClientRect());
        const midX = xs.reduce((s, r) => s + r.left + r.width / 2, 0) / xs.length;
        // the hero's body sits at ~32% of the frame; park the spinning storm just in front of the enemies
        const dx = Math.max(0, midX - hr.width * 0.45 - (hr.left + hr.width * 0.32));

        await anim(el.hero, [{ transform: 'translateX(0)' }, { transform: 'translateX(-30px) scaleY(.94)' }], { duration: 200, easing: EASE.out, fill: 'forwards' });
        play('attack');

        // swap the hero for the whirlwind picture and spin it around the vertical axis like a top
        el.hero.classList.add('ulting');
        const spin = el.heroUlt.animate([
            { transform: 'perspective(1400px) rotateY(0deg)' },
            { transform: 'perspective(1400px) rotateY(-360deg)' }
        ], { duration: 480, iterations: Infinity, easing: 'linear' });
        el.heroUlt.animate([
            { opacity: 0, filter: 'brightness(3) drop-shadow(0 0 0 transparent)' },
            { opacity: 1, filter: 'brightness(1) drop-shadow(0 0 10px rgba(255, 140, 50, .45))' }
        ], { duration: 220, easing: EASE.out });
        await heroDash(dx, 220);

        for (const e of targets) {
            const c = center(e.box, 0.45);
            const r = e.box.getBoundingClientRect();
            play('attack', 0.8);
            fxLayer.slash(c.x, c.y, { radius: r.width * 0.5, width: 7, from: 2.6, to: -0.6, edge: '#ff8a2a', core: '#fff1b0', life: 0.28 });
            // damage = base x average multiplier of the five lines (misses count as zero)
            const isCrit = ult.perfects >= 3;
            const dmg = Math.max(1, Math.round((hero.strength * 1.4 + 8 + C.randInt(0, 4)) * ult.mult));
            await hitEnemy(e, dmg, { crit: isCrit, tag: ult.hits + '/' + ULT_LINES });
            FX.shake(el.game, 8);
            await wait(170);
        }
        await wait(160);

        // storm dies down: fade the whirlwind out and show the hero again
        await anim(el.heroUlt, [{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: 'ease-in' });
        spin.cancel();
        el.hero.classList.remove('ulting');
        setHeroPose('idle');
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
        // the hero stays in the idle stance; the block frame plays when a hit actually lands
        synth('block');
        const c = heroCenter(0.5);
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
        const c = heroCenter(0.5);
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
        if (hero.currentHp > 0) setHeroPose('idle');
        C.saveCharacter(hero);

        if (hero.currentHp <= 0) {
            defeat();
            return;
        }
        beginPlayerTurn();
    }

    async function enemyStrike(e) {
        const heavy = e.intent === 'heavy';
        voice(e.mobType, 'attack');
        const er = e.box.getBoundingClientRect();
        const hr = heroCenter(0.5).r;
        const dx = Math.min(0, (hr.left + hr.width * 0.42) - er.left);
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
        setFoePose(e, 'attack');
        await anim(e.body, [
            { transform: 'translateX(16px)', opacity: 1 },
            { transform: 'translateX(' + dx + 'px)', opacity: isGhost ? 0.55 : 1 }
        ], { duration: isGhost ? 160 : 120, easing: EASE.in, fill: 'forwards' });

        // impact
        let raw = C.randInt(e.dmgMin, e.dmgMax) * (heavy ? 2 : 1);
        if (defending) raw = Math.round(raw * DEFEND_MULT);
        const dmg = Math.max(1, raw);
        const c = heroCenter(0.4);

        if (dmg === 0) {
            synth('block');
            heroBeat('block', 380);
            fnum('БЛОК', 'block', c.x, c.y);
            fxLayer.burst(c.x + hr.width * 0.2, c.y, { count: 22, speed: 200, angle: Math.PI, spread: 0.9, gravity: 300, colors: ['#ffffff', '#ffd34a', '#cfd6dc'], streak: true, life: 0.5 });
            log('<span class="c-foe">' + e.name + '</span> бьёт — удар отражён');
        } else {
            hero.currentHp = Math.max(0, hero.currentHp - dmg);
            updateHeroUI();
            if (hero.currentHp <= 0) setHeroPose('damage');
            else if (defending) heroBeat('block', 420);
            else heroBeat('damage', 420);
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
        setFoePose(e, 'idle');
        if (heavy) e.el.classList.remove('charging');
    }

    /* ------------------------------------------------------------------ */
    /* end of run                                                          */
    /* ------------------------------------------------------------------ */
    function victory() {
        stopIdleVoices();
        phase = 'over';
        setTurnBanner('');
        updateActions();
        el.game.classList.remove('low-hp');
        if (audio) audio.stopMusic(600);
        play('victory', 1.1);
        setHeroPose('win');
        anim(el.heroImg, [{ transform: 'translateY(8px)' }, { transform: 'translateY(-6px)', offset: 0.6 }, { transform: 'none' }],
            { duration: 420, easing: EASE.out });
        hero.wins = (hero.wins || 0) + 1;
        const wasLocked = !C.isHardcoreUnlocked(hero);
        hero.cleared[mobType + ':' + difficultyKey] = true;
        run.unlockedHardcore = wasLocked && C.isHardcoreUnlocked(hero);
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
        stopIdleVoices();
        phase = 'over';
        setTurnBanner('');
        updateActions();
        el.game.classList.remove('low-hp');
        el.game.classList.add('dead');
        alive().forEach(e => { e.intentEl.classList.add('hidden'); e.el.classList.remove('selected', 'charging'); setFoePose(e, 'win'); });
        if (audio) audio.stopMusic(300);
        play('lose');
        hero.bestCombo = Math.max(hero.bestCombo || 0, run.maxCombo);
        if (hardcore) {
            run.newRecord = wave > (hero.hardcoreBest || 0);
            hero.hardcoreBest = Math.max(hero.hardcoreBest || 0, wave);
        }
        C.saveCharacter(hero);
        // brief stagger in the hit pose, then the hero drops to one knee
        setTimeout(() => {
            setHeroPose('defeat');
            anim(el.heroImg, [{ transform: 'translateY(-10px)' }, { transform: 'none' }], { duration: 260, easing: EASE.out });
            FX.shake(el.game, 6);
        }, 320);
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
        img.src = win ? M + 'images/victory.png' : M + 'images/lose.png';
        img.alt = win ? 'Победа' : 'Поражение';
        el.result.classList.toggle('lose', !win);
        const rows = win ? [
            ['exp', 'ОПЫТ', run.exp, '+'],
            ['gold', 'ЗОЛОТО', run.gold, '+'],
            ['skull', 'УБИТО', run.kills, ''],
            ['attack', 'ЛУЧШИЙ УДАР', run.bestHit, ''],
            ['target', 'МАКС. КОМБО', run.maxCombo, '']
        ] : hardcore ? [
            ['wait', 'ДОШЛИ ДО ВОЛНЫ', wave, ''],
            ['trophy', run.newRecord ? 'НОВЫЙ РЕКОРД!' : 'РЕКОРД', hero.hardcoreBest, ''],
            ['skull', 'УБИТО', run.kills, ''],
            ['gold', 'ЗОЛОТО', run.gold, '+'],
            ['exp', 'ОПЫТ', run.exp, '+'],
            ['attack', 'ЛУЧШИЙ УДАР', run.bestHit, '']
        ] : [
            ['wait', 'ДОШЛИ ДО ВОЛНЫ', wave, ''],
            ['skull', 'УБИТО', run.kills, ''],
            ['gold', 'ЗОЛОТО', run.gold, '+'],
            ['attack', 'ЛУЧШИЙ УДАР', run.bestHit, '']
        ];
        const box = $('resultStats');
        box.innerHTML = rows.map(r =>
            '<div class="rs-row"><img src="' + ICON(r[0]) + '" alt=""><span>' + r[1] + '</span><b>' + r[3] + '<span data-v="' + r[2] + '">0</span></b></div>'
        ).join('') + (run.levels ? '<div class="rs-row lvlup"><img src="' + ICON('level') + '" alt=""><span>НОВЫЙ УРОВЕНЬ</span><b>' + hero.level + '</b></div>' : '')
            + (run.unlockedHardcore ? '<div class="rs-row lvlup"><img src="' + ICON('skull') + '" alt=""><span>ОТКРЫТ РЕЖИМ</span><b>ХАРДКОР</b></div>' : '');
        const next = win ? nextChallenge() : null;
        $('nextBtn').hidden = !next;
        if (next) $('nextLabel').textContent = 'ДАЛЕЕ: ' + MOBS[next.mob].name + ' · ' + C.DIFFICULTY[next.diff].label;
        $('restartBtn').classList.toggle('red', !next);
        el.result.hidden = false;
        setTimeout(() => box.querySelectorAll('[data-v]').forEach((s, i) => setTimeout(() => countUp(s, +s.dataset.v, 600), i * 150)), 500);
        setTimeout(() => $(next ? 'nextBtn' : 'restartBtn').focus(), 900);
    }

    /** The fight after this one: next enemy on the same difficulty, after the knight the next difficulty */
    function nextChallenge() {
        const mobs = C.MOB_KEYS;
        const diffs = Object.keys(C.DIFFICULTY);
        const m = mobs.indexOf(mobType);
        const d = diffs.indexOf(difficultyKey);
        if (m < 0 || d < 0) return null;
        if (m < mobs.length - 1) return { mob: mobs[m + 1], diff: difficultyKey };
        if (d < diffs.length - 1) return { mob: mobs[0], diff: diffs[d + 1] };
        return null;
    }

    function setDifficulty(key) {
        difficultyKey = key;
        C.setDifficulty(key);
        document.querySelectorAll('.diff-btn').forEach(b => b.classList.toggle('active', b.dataset.diff === key));
    }

    function nextFight() {
        const next = nextChallenge();
        if (!next) return;
        setDifficulty(next.diff);
        chooseIndex = C.MOB_KEYS.indexOf(next.mob);
        restartGame(next.mob);
    }

    /** A new fight with `mob` if given, otherwise the same fight again (same enemy, or a new hardcore run) */
    function restartGame(mob) {
        const again = hardcore ? HARDCORE : mobType;
        stopIdleVoices();
        play('click');
        el.result.hidden = true;
        el.game.classList.remove('dead');
        el.heroImg.getAnimations().forEach(a => a.cancel());
        setHeroPose('idle');
        el.foes.innerHTML = '';
        enemies = [];
        hardcore = false;
        phase = 'choose';
        rage = 0;
        hero.currentHp = hero.maxHp;
        updateHeroUI();
        C.saveCharacter(hero);
        setTurnBanner('');
        startGameWithMobType(typeof mob === 'string' ? mob : again);
    }

    /* ------------------------------------------------------------------ */
    /* choose enemy modal                                                  */
    /* ------------------------------------------------------------------ */
    function renderMobCards() {
        document.querySelectorAll('.mob-card').forEach(card => {
            const key = card.dataset.mob;
            const base = MOBS[key];
            card.classList.toggle('cleared', !!hero.cleared[key + ':' + difficultyKey]);
            const s = scaledMob(base, 1);
            card.querySelector('.mob-stats').innerHTML =
                '<span><img src="' + ICON('heart') + '" alt="">' + s.hp + '</span>' +
                '<span><img src="' + ICON('attack') + '" alt="">' + s.dmgMin + '–' + s.dmgMax + '</span>' +
                '<span><img src="' + ICON('gold') + '" alt="">' + s.gold + '</span>' +
                '<span><img src="' + ICON('exp') + '" alt="">' + s.exp + '</span>';
            card.querySelector('.mob-hint').textContent = base.hint;
            card.querySelector('.mob-art img').src = M + 'sprites/' + base.dir + '/card.png' + SPRITE_V;
            card.querySelectorAll('.threat i').forEach((pip, n) => pip.classList.toggle('on', n < base.threat));
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
                setDifficulty(btn.dataset.diff || 'normal');
                renderMobCards();
            });
        });
    }

    /* ------------------------------------------------------------------ */
    /* shop                                                                */
    /* ------------------------------------------------------------------ */
    function renderShop() {
        el.shopItems.innerHTML = SHOP.map(it => {
            const price = shopPrice(it);
            const own = it.key === 'strength' ? 'сила ' + hero.strength
                : it.key === 'potion' ? 'есть ' + hero.inventory.potions
                : 'макс. ' + hero.maxHp;
            return '<div class="shop-item" data-key="' + it.key + '">' +
                '<img src="' + ICON(it.icon) + '" alt="">' +
                '<div><div class="si-name">' + it.name + '</div><div class="si-desc">' + it.desc + ' · <span class="si-own">' + own + '</span></div></div>' +
                '<div class="price" title="' + (it.key === 'potion' ? 'Цена растёт с каждым зельем в сумке' : 'Следующая будет дороже на ' + it.step) + '">' + price + '<img src="' + ICON('gold') + '" alt=""><small>+' + it.step + '</small></div>' +
                '<button class="px-btn' + (hero.gold >= price ? ' red' : '') + '" type="button" data-buy="' + it.key + '"' + (hero.gold >= price ? '' : ' disabled') + '>КУПИТЬ</button>' +
                '</div>';
        }).join('');
        el.shopGold.textContent = hero.gold - pendingGold;
        el.shopItems.querySelectorAll('[data-buy]').forEach(b => {
            b.addEventListener('click', () => buy(b.dataset.buy));
            b.addEventListener('mouseenter', () => play('hover', 0.6));
        });
    }

    function openShop() {
        if (phase !== 'player' || !shopOpen()) return;
        el.shopBtn.classList.remove('shop-alert');
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
        if (audio) audio.playMusic(battleTrack(), 500);
    }

    function buy(key) {
        const it = SHOP.find(s => s.key === key);
        if (!it || hero.gold < shopPrice(it)) {
            synth('block');
            return;
        }
        hero.gold -= shopPrice(it);
        hero.bought[key] = (hero.bought[key] || 0) + 1;
        if (key === 'strength') hero.strength += 2;
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
    function loadAudio(hc) {
        audio = C.createAudioManager();
        const vols = C.getVolumes();
        audio.setMusicVolume(vols.music);
        audio.setSfxVolume(vols.sfx);
        // the first track loaded streams at once, the rest only when played: the hardcore page
        // needs its own track first (and never plays the desert one)
        if (hc) audio.loadMusic('hardcore', M + C.MEDIA.hardcore, true);
        else audio.loadMusic('battle', M + C.MEDIA.desert, true);
        audio.loadMusic('shop', M + C.MEDIA.shop, true);
        audio.loadSfx('attack', M + C.MEDIA.attack, 5);
        if (hc) audio.loadSfx('shopOpen', M + C.MEDIA.shopOpen);
        audio.loadSfx('potion', M + C.MEDIA.potion, 2);
        audio.loadSfx('victory', M + C.MEDIA.victory, 1);
        audio.loadSfx('lose', M + C.MEDIA.lose, 1);
        audio.loadSfx('coin', M + C.MEDIA.coin, 6);
        audio.loadSfx('upgrade', M + C.MEDIA.upgrade, 2);
        audio.loadSfx('hover', M + C.MEDIA.hover, 3);
        audio.loadSfx('click', M + C.MEDIA.click, 3);
        audio.loadSfx('slash', M + C.MEDIA.slash, 3);
        audio.loadSfx('ultHit', M + C.MEDIA.ultHit, 5);
        audio.loadSfx('ultSlash', M + C.MEDIA.ultSlash, 2);
        audio.loadSfx('ultPerfect', M + C.MEDIA.ultPerfect, 1);
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
        $('restartBtn').addEventListener('click', () => restartGame());
        $('nextBtn').addEventListener('click', nextFight);
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

    /** Desert at dusk, or for hardcore the same land at night in a thunderstorm */
    function buildAmbience(night) {
        const backdrop = document.querySelector('.stage-img.desert');
        bgLayer = FX.createLayer({ z: 3, parent: el.game });
        if (night) {
            el.game.classList.add('night');
            backdrop.style.backgroundImage = "url('" + M + 'images/hardcore.jpg' + (PAGE_V ? '?' + PAGE_V : '') + "')";
            FX.ambient.rain(bgLayer, 70);
            FX.ambient.ash(bgLayer, 2, ['#3a4a6a', '#2a3450', '#1a2236']);
            scheduleLightning();
        } else {
            FX.ambient.sand(bgLayer, 34);
            FX.ambient.ash(bgLayer, 3, ['#7a3a2a', '#5a2a22', '#3a1a16']);
        }
        fxLayer = FX.createLayer({ z: 10, parent: el.game });
        FX.parallax([
            { el: $('stageBox'), depth: 14, base: 'translate(-50%,-50%)' }
        ]);
    }

    /** Lightning lights up the sky behind the fight every few seconds */
    function scheduleLightning() {
        if (FX.reduced) return;
        const sky = document.createElement('div');
        sky.className = 'lightning';
        $('stageBox').appendChild(sky);
        (function strike() {
            setTimeout(() => {
                if (!document.hidden) {
                    sky.animate([
                        { opacity: 0 }, { opacity: 0.9, offset: 0.06 }, { opacity: 0.2, offset: 0.16 },
                        { opacity: 0.75, offset: 0.26 }, { opacity: 0 }
                    ], { duration: 700, easing: 'ease-out' });
                }
                strike();
            }, 5000 + Math.random() * 9000);
        })();
    }

    function init() {
        if (!C.getCurrentUser()) {
            window.location.replace('../sign-in/index.html');
            return;
        }
        loadHero();
        const hc = new URLSearchParams(location.search).get('mode') === HARDCORE && C.isHardcoreUnlocked(hero);
        loadAudio(hc);
        newRun();
        buildAmbience(hc);
        preloadHeroPoses();
        el.heroImg.src = heroPoseSrc('idle');
        // sample sprite colours for the death effect while the player is still choosing
        Object.keys(MOBS).forEach(k => spriteInfo(k).poses.forEach(p => {
            FX.prepareSprite(mobPoseSrc(k, p));
            preloadImage(mobPoseSrc(k, p));
        }));
        bindEvents();
        updateHeroUI();
        updateWaveUI();
        FX.enter();
        audio.startMusic(hc ? 'hardcore' : 'battle');
        if (hc) startGameWithMobType(HARDCORE);
        else openChoose();
    }

    init();
})();
