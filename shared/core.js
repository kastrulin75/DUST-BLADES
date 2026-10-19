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

    const VERSION = '3.0';
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
            armor: 4,
            gold: 120,
            totalKills: 0,
            wins: 0,
            bestCombo: 0,
            inventory: { potions: 6 }
        };
    }

    /** Fill fields that older saves may be missing */
    function normalizeCharacter(ch, username) {
        const c = Object.assign(createCharacter(username || (ch && ch.username) || 'Воин'), ch || {});
        if (!c.inventory || typeof c.inventory.potions !== 'number') c.inventory = { potions: 3 };
        if (typeof c.wins !== 'number') c.wins = 0;
        if (typeof c.bestCombo !== 'number') c.bestCombo = 0;
        c.currentHp = Math.min(c.currentHp, c.maxHp);
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
        const pools = Object.create(null);
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

        function loadSfx(key, src, poolSize) {
            const size = poolSize || 3;
            const list = [];
            for (let i = 0; i < size; i++) {
                const a = new Audio(src);
                a.preload = 'auto';
                list.push(a);
            }
            pools[key] = { list, i: 0 };
        }

        function playSfx(key, mult) {
            const pool = pools[key];
            if (!pool) return;
            const a = pool.list[pool.i];
            pool.i = (pool.i + 1) % pool.list.length;
            try {
                a.currentTime = 0;
                a.volume = Math.min(1, (sfxVol / 100) * (mult == null ? 1 : mult));
                const p = a.play();
                if (p && p.catch) p.catch(() => {});
            } catch (_) {}
        }

        function audioCtx() {
            if (!ctx) {
                const AC = global.AudioContext || global.webkitAudioContext;
                if (!AC) return null;
                ctx = new AC();
            }
            if (ctx.state === 'suspended') ctx.resume().catch(() => {});
            return ctx;
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

    const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
    function roman(n) { return ROMAN[n] || String(n); }

    /** Exact-case media paths (they matter on case-sensitive web hosts) */
    const MEDIA = {
        click: 'click.MP3', hover: 'hover.MP3', coin: 'coin.MP3', potion: 'potion.MP3',
        victory: 'victory.MP3', desert: 'desert.MP3', attack: 'attack.mp3', lose: 'lose.mp3',
        menu: 'menu.mp3', shop: 'shop.mp3', upgrade: 'upgrade.mp3'
    };

    if (typeof document !== 'undefined') applyVisualSettings();

    global.DustCore = {
        STORAGE, VERSION, MAX_LEVEL, EXP_TABLE, DIFFICULTY, MEDIA,
        getExpForNextLevel, getExpProgress, createCharacter, normalizeCharacter, getRank,
        getUsers, saveUsers, getCurrentCharacter, getCurrentUser,
        setSession, clearSession, saveCharacter, getVolumes, saveVolumes,
        getVisualSettings, saveVisualSettings, applyVisualSettings,
        getDifficulty, setDifficulty, hashPassword,
        createAudioManager, randInt, clamp, safeParse, escapeHtml, roman
    };
})(typeof window !== 'undefined' ? window : globalThis);
