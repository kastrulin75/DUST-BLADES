/**
 * DUST & BLADES — shared core (audio, storage, progression)
 */
(function (global) {
    'use strict';

    const STORAGE = {
        USERS: 'dust_users',
        CURRENT_USER: 'dust_current_user',
        CURRENT_CHAR: 'dust_current_character',
        MUSIC_VOL: 'dust_music_volume',
        SFX_VOL: 'dust_sfx_volume',
        DIFFICULTY: 'dust_difficulty',
        CRT: 'dust_crt',
        SHAKE: 'dust_shake'
    };

    const VERSION = '4.0';
    const MAX_LEVEL = 25;
    const EXP_TABLE = {
        1: 0, 2: 100, 3: 200, 4: 500, 5: 750,
        6: 1000, 7: 1200, 8: 1500, 9: 2000, 10: 3000,
        11: 4000, 12: 5000, 13: 6000, 14: 7500, 15: 9000,
        16: 11000, 17: 13000, 18: 15000, 19: 18000, 20: 21000,
        21: 24000, 22: 27000, 23: 30000, 24: 35000, 25: 40000
    };

    const DIFFICULTY = {
        easy:   { label: 'ЛЕГКО',   enemyHp: 0.75, enemyDmg: 0.7,  reward: 0.85 },
        normal: { label: 'НОРМА',   enemyHp: 1,    enemyDmg: 1,    reward: 1 },
        hard:   { label: 'СЛОЖНО',  enemyHp: 1.35, enemyDmg: 1.25, reward: 1.4 }
    };
    // separate mode, far above "hard"; opens once every enemy is beaten on every difficulty
    const HARDCORE = { label: 'ХАРДКОР', enemyHp: 2, enemyDmg: 1.6, reward: 2 };
    const MOB_KEYS = ['zombie', 'skeleton', 'ghost', 'death_knight'];

    /** How many enemy + difficulty pairs the hero has beaten, out of how many */
    function hardcoreProgress(ch) {
        const cleared = (ch && ch.cleared) || {};
        const keys = [];
        MOB_KEYS.forEach(m => Object.keys(DIFFICULTY).forEach(d => keys.push(m + ':' + d)));
        return { done: keys.filter(k => cleared[k]).length, total: keys.length };
    }

    function isHardcoreUnlocked(ch) {
        const p = hardcoreProgress(ch);
        return p.done >= p.total;
    }

    /** Rank shown next to the hero's name */
    const RANKS = [
        [1, 'НОВИЧОК'], [3, 'БОЕЦ'], [6, 'ОПЫТНЫЙ'],
        [10, 'ВЕТЕРАН'], [15, 'МАСТЕР'], [20, 'ЧЕМПИОН'], [25, 'ЛЕГЕНДА']
    ];

    function getRank(level) {
        let r = RANKS[0][1];
        for (const [lvl, name] of RANKS) if (level >= lvl) r = name;
        return r;
    }

    function getExpForNextLevel(level) {
        if (level >= MAX_LEVEL) return EXP_TABLE[MAX_LEVEL];
        return EXP_TABLE[level + 1] || EXP_TABLE[MAX_LEVEL];
    }

    function getExpProgress(level, exp) {
        const cur = EXP_TABLE[level] || 0;
        const next = getExpForNextLevel(level);
        const needed = Math.max(1, next - cur);
        const gained = Math.max(0, exp - cur);
        const percent = level >= MAX_LEVEL ? 100 : Math.min(100, (gained / needed) * 100);
        return { cur, next, needed, gained, percent };
    }

    function createCharacter(username) {
        return {
            username,
            level: 1,
            exp: 0,
            strength: 16,
            maxHp: 150,
            currentHp: 150,
            gold: 120,
            totalKills: 0,
            wins: 0,
            bestCombo: 0,
            hardcoreBest: 0,
            cleared: {},          // 'zombie:hard': true — enemy beaten on that difficulty
            bought: {},           // shop purchases per item: every one raises that item's price
            inventory: { potions: 6 }
        };
    }

    /** Fill fields that older saves may be missing */
    function normalizeCharacter(ch, username) {
        const c = Object.assign(createCharacter(username || (ch && ch.username) || 'Воин'), ch || {});
        if (!c.inventory || typeof c.inventory.potions !== 'number') c.inventory = { potions: 3 };
        if (typeof c.wins !== 'number') c.wins = 0;
        if (typeof c.bestCombo !== 'number') c.bestCombo = 0;
        if (typeof c.hardcoreBest !== 'number') c.hardcoreBest = 0;
        if (!c.cleared || typeof c.cleared !== 'object') c.cleared = {};
        if (!ch || !ch.bought || typeof ch.bought !== 'object') {
            // older saves: work out the upgrades already bought from the stats
            // (start 16 str / 150 hp, +3 str / +15 hp per level, shop +2 str / +15 hp)
            const lv = (c.level || 1) - 1;
            c.bought = {
                strength: Math.max(0, Math.round((c.strength - 16 - lv * 3) / 2)),
                vitality: Math.max(0, Math.round((c.maxHp - 150 - lv * 15) / 15)),
                potion: 0
            };
        }
        c.currentHp = Math.min(c.currentHp, c.maxHp);
        delete c.armor;   // armor was removed from the game: only HP protects the hero
        return c;
    }

    function safeParse(raw, fallback) {
        if (!raw) return fallback;
        try { return JSON.parse(raw); } catch (_) { return fallback; }
    }

    function getUsers() {
        return safeParse(localStorage.getItem(STORAGE.USERS), []);
    }

    function saveUsers(users) {
        localStorage.setItem(STORAGE.USERS, JSON.stringify(users));
    }

    function getCurrentCharacter() {
        return safeParse(localStorage.getItem(STORAGE.CURRENT_CHAR), null);
    }

    function getCurrentUser() {
        return localStorage.getItem(STORAGE.CURRENT_USER) || '';
    }

    function setSession(username, character) {
        localStorage.setItem(STORAGE.CURRENT_USER, username);
        localStorage.setItem(STORAGE.CURRENT_CHAR, JSON.stringify(character));
    }

    function clearSession() {
        localStorage.removeItem(STORAGE.CURRENT_USER);
        localStorage.removeItem(STORAGE.CURRENT_CHAR);
    }

    function saveCharacter(hero) {
        localStorage.setItem(STORAGE.CURRENT_CHAR, JSON.stringify(hero));
        const users = getUsers();
        const idx = users.findIndex(u => u.username === hero.username);
        if (idx !== -1) {
            users[idx].character = hero;
            saveUsers(users);
        }
    }

    function getVolumes() {
        const music = parseInt(localStorage.getItem(STORAGE.MUSIC_VOL), 10);
        const sfx = parseInt(localStorage.getItem(STORAGE.SFX_VOL), 10);
        return {
            music: Number.isFinite(music) ? music : 50,
            sfx: Number.isFinite(sfx) ? sfx : 50
        };
    }

    function saveVolumes(music, sfx) {
        localStorage.setItem(STORAGE.MUSIC_VOL, String(music));
        localStorage.setItem(STORAGE.SFX_VOL, String(sfx));
    }

    function getFlag(key, def) {
        const v = localStorage.getItem(key);
        return v == null ? def : v === '1';
    }

    function setFlag(key, on) {
        localStorage.setItem(key, on ? '1' : '0');
    }

    function getVisualSettings() {
        return { crt: getFlag(STORAGE.CRT, true), shake: getFlag(STORAGE.SHAKE, true) };
    }

    function saveVisualSettings(s) {
        setFlag(STORAGE.CRT, !!s.crt);
        setFlag(STORAGE.SHAKE, !!s.shake);
        applyVisualSettings();
    }

    function applyVisualSettings() {
        const s = getVisualSettings();
        document.documentElement.classList.toggle('no-crt', !s.crt);
        document.documentElement.classList.toggle('no-shake', !s.shake);
    }

    function getDifficulty() {
        const key = localStorage.getItem(STORAGE.DIFFICULTY) || 'normal';
        return DIFFICULTY[key] ? key : 'normal';
    }

    function setDifficulty(key) {
        if (DIFFICULTY[key]) localStorage.setItem(STORAGE.DIFFICULTY, key);
    }

    function hashPassword(password) {
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            hash = ((hash << 5) - hash) + password.charCodeAt(i);
            hash |= 0;
        }
        return 'hash_' + Math.abs(hash).toString(16);
    }

    /**
     * Audio manager: music tracks with crossfade, pooled SFX files,
     * and a tiny WebAudio synth for sounds that have no file.
     */
    function createAudioManager() {
        let musicVol = 50;
        let sfxVol = 50;
        const tracks = Object.create(null);
        let current = null;
        let unlocked = false;
        let ctx = null;
        const fades = new Map();

        function fadeTo(a, target, ms, done) {
            if (fades.has(a)) clearInterval(fades.get(a));
            const start = a.volume;
            const t0 = performance.now();
            const id = setInterval(() => {
                const k = Math.min(1, (performance.now() - t0) / ms);
                a.volume = Math.max(0, Math.min(1, start + (target - start) * k));
                if (k >= 1) {
                    clearInterval(id);
                    fades.delete(a);
                    if (done) done();
                }
            }, 30);
            fades.set(a, id);
        }

        function loadMusic(key, src, loop) {
            if (src === undefined || typeof src === 'boolean') {
                // legacy signature loadMusic(src, loop)
                loop = src;
                src = key;
                key = 'main';
            }
            const a = new Audio();
            a.loop = loop !== false;
            // only the first track streams right away; others load when first played
            a.preload = current ? 'none' : 'auto';
            a.src = src;
            a.volume = 0;
            tracks[key] = a;
            if (!current) current = key;
            return a;
        }

        // Sound effects are decoded once into WebAudio buffers. (One <audio> element per copy
        // used to mean 50-90 media players per page, which could stall the whole browser.)
        const sfx = Object.create(null);      // key -> { src, buf }
        const decodeQueue = [];
        let decoding = 0;

        function audioCtx() {
            if (!ctx) {
                const AC = global.AudioContext || global.webkitAudioContext;
                if (!AC) return null;
                ctx = new AC();
            }
            if (ctx.state === 'suspended' && unlocked) ctx.resume().catch(() => {});
            return ctx;
        }

        /** Fetch + decode a few files at a time so a page load is not one big burst */
        function pumpDecode() {
            const c = audioCtx();
            while (c && decoding < 3 && decodeQueue.length) {
                const item = decodeQueue.shift();
                decoding++;
                fetch(item.src)
                    .then(r => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
                    .then(data => new Promise((ok, bad) => c.decodeAudioData(data, ok, bad)))
                    .then(buf => { item.buf = buf; })
                    .catch(() => {
                        // fetch() is blocked when the game is opened straight from disk (file://):
                        // fall back to a single <audio> element for this sound
                        item.el = new Audio(item.src);
                        item.el.preload = 'auto';
                    })
                    .then(() => { decoding--; pumpDecode(); });
            }
        }

        // (a third "pool size" argument from older callers is ignored: one buffer plays any number of times at once)
        function loadSfx(key, src) {
            if (sfx[key] && sfx[key].src === src) return;
            const item = { src, buf: null };
            sfx[key] = item;
            decodeQueue.push(item);
            pumpDecode();
        }

        /** Play a loaded effect. Returns { duration } in seconds, or undefined while it is still loading. */
        function playSfx(key, mult) {
            const item = sfx[key];
            if (!item || sfxVol <= 0) return;
            const vol = Math.min(1, (sfxVol / 100) * (mult == null ? 1 : mult));
            if (item.el) {
                // busy? play a throwaway copy so overlapping hits still sound
                const a = item.el.paused ? item.el : item.el.cloneNode();
                try {
                    a.currentTime = 0;
                    a.volume = vol;
                    const p = a.play();
                    if (p && p.catch) p.catch(() => {});
                } catch (_) {}
                return { duration: item.el.duration };
            }
            const c = audioCtx();
            if (!item.buf || !c) return;
            if (c.state === 'suspended') c.resume().catch(() => {});
            const src = c.createBufferSource();
            src.buffer = item.buf;
            const g = c.createGain();
            g.gain.value = vol;
            src.connect(g).connect(c.destination);
            src.start();
            return { duration: item.buf.duration };
        }

        let noiseBuf = null;
        /** One shared second of white noise, sliced by playback length */
        function noiseBuffer(c) {
            if (!noiseBuf) {
                noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
                const d = noiseBuf.getChannelData(0);
                for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
            }
            return noiseBuf;
        }

        /** Synthesised retro blips: tone(s) and/or noise bursts */
        function synth(name) {
            const c = audioCtx();
            if (!c || sfxVol <= 0) return;
            const master = c.createGain();
            master.gain.value = (sfxVol / 100) * 0.5;
            master.connect(c.destination);
            const now = c.currentTime;

            function tone(type, f0, f1, t, dur, vol) {
                const o = c.createOscillator();
                const g = c.createGain();
                o.type = type;
                o.frequency.setValueAtTime(f0, now + t);
                o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), now + t + dur);
                g.gain.setValueAtTime(vol, now + t);
                g.gain.exponentialRampToValueAtTime(0.001, now + t + dur);
                o.connect(g).connect(master);
                o.start(now + t);
                o.stop(now + t + dur + 0.02);
            }

            function noise(t, dur, vol, freq) {
                const src = c.createBufferSource();
                src.buffer = noiseBuffer(c);
                const f = c.createBiquadFilter();
                f.type = 'bandpass';
                f.frequency.value = freq || 1200;
                const g = c.createGain();
                g.gain.setValueAtTime(vol, now + t);
                g.gain.exponentialRampToValueAtTime(0.001, now + t + dur);
                src.connect(f).connect(g).connect(master);
                src.start(now + t, Math.random() * 0.4, dur);
            }

            switch (name) {
                case 'block':
                    tone('square', 1400, 700, 0, 0.08, 0.25);
                    tone('square', 900, 420, 0.03, 0.18, 0.18);
                    noise(0, 0.12, 0.35, 3000);
                    break;
                case 'evade':
                    noise(0, 0.22, 0.3, 700);
                    tone('sine', 500, 1400, 0, 0.18, 0.12);
                    break;
                case 'whirl':
                    noise(0, 0.5, 0.45, 500);
                    tone('sawtooth', 90, 340, 0, 0.45, 0.2);
                    tone('square', 220, 880, 0.15, 0.3, 0.1);
                    break;
                case 'charge':
                    tone('sawtooth', 70, 50, 0, 0.6, 0.25);
                    tone('square', 140, 90, 0.1, 0.5, 0.12);
                    break;
                case 'heavy':
                    noise(0, 0.35, 0.5, 260);
                    tone('square', 120, 40, 0, 0.35, 0.3);
                    break;
                case 'select':
                    tone('square', 660, 990, 0, 0.06, 0.12);
                    break;
                case 'perfect':
                    tone('square', 988, 1976, 0, 0.08, 0.16);
                    tone('square', 1319, 1319, 0.06, 0.16, 0.12);
                    tone('triangle', 1976, 1976, 0.1, 0.22, 0.1);
                    break;
                case 'levelup':
                    [523, 659, 784, 1046].forEach((f, i) => tone('square', f, f, i * 0.09, 0.14, 0.14));
                    break;
                case 'wave':
                    tone('sawtooth', 110, 110, 0, 0.5, 0.18);
                    tone('sawtooth', 165, 165, 0.05, 0.5, 0.12);
                    noise(0, 0.5, 0.2, 180);
                    break;
                case 'type':
                    tone('square', 300 + Math.random() * 200, 200, 0, 0.03, 0.05);
                    break;
                default:
                    break;
            }
        }

        function playMusic(key, fadeMs) {
            const next = tracks[key];
            if (!next) return;
            const ms = fadeMs == null ? 700 : fadeMs;
            if (current && current !== key && tracks[current]) {
                const old = tracks[current];
                fadeTo(old, 0, ms, () => old.pause());
            }
            current = key;
            const p = next.play();
            if (p && p.catch) p.catch(() => {});
            fadeTo(next, musicVol / 100, ms);
        }

        function startMusic(key) {
            const k = key || current;
            if (!k) return;
            playMusic(k, 900);
            if (!unlocked) {
                const once = () => {
                    unlocked = true;
                    audioCtx();
                    if (current && tracks[current] && tracks[current].paused) playMusic(current, 900);
                    document.removeEventListener('pointerdown', once);
                    document.removeEventListener('keydown', once);
                };
                document.addEventListener('pointerdown', once);
                document.addEventListener('keydown', once);
            }
        }

        function stopMusic(fadeMs) {
            if (!current || !tracks[current]) return;
            const a = tracks[current];
            fadeTo(a, 0, fadeMs == null ? 400 : fadeMs, () => a.pause());
        }

        function setMusicVolume(v) {
            musicVol = v;
            if (current && tracks[current] && !fades.has(tracks[current])) tracks[current].volume = v / 100;
        }

        function setSfxVolume(v) {
            sfxVol = v;
        }

        return {
            loadMusic, loadSfx, playSfx, playMusic, startMusic, stopMusic, synth,
            setMusicVolume, setSfxVolume,
            get musicVolume() { return musicVol; },
            get sfxVolume() { return sfxVol; }
        };
    }

    function randInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function clamp(n, min, max) {
        return Math.max(min, Math.min(max, n));
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    }

    /** Sound files in media/audio (all lower-case: case matters on web hosts) */
    const MEDIA = {
        click: 'audio/click.mp3', hover: 'audio/hover.mp3', coin: 'audio/coin.mp3', potion: 'audio/potion.mp3',
        victory: 'audio/victory.mp3', desert: 'audio/desert.mp3', attack: 'audio/attack.mp3', lose: 'audio/lose.mp3',
        menu: 'audio/menu.mp3', shop: 'audio/shop.mp3', upgrade: 'audio/upgrade.mp3', slash: 'audio/slash.mp3',
        hardcore: 'audio/hardcore.mp3', shopOpen: 'audio/shop-open.mp3',
        ultHit: 'audio/ult-hit.mp3', ultSlash: 'audio/ult-slash.mp3', ultPerfect: 'audio/ult-perfect.mp3'
    };

    if (typeof document !== 'undefined') applyVisualSettings();

    global.DustCore = {
        STORAGE, VERSION, MAX_LEVEL, EXP_TABLE, DIFFICULTY, MEDIA,
        getExpForNextLevel, getExpProgress, createCharacter, normalizeCharacter, getRank,
        getUsers, saveUsers, getCurrentCharacter, getCurrentUser,
        setSession, clearSession, saveCharacter, getVolumes, saveVolumes,
        getVisualSettings, saveVisualSettings, applyVisualSettings,
        getDifficulty, setDifficulty, hashPassword,
        createAudioManager, randInt, clamp, safeParse, escapeHtml,
        HARDCORE, MOB_KEYS, hardcoreProgress, isHardcoreUnlocked
    };
})(typeof window !== 'undefined' ? window : globalThis);
