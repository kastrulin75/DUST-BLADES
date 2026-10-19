/**
 * DUST & BLADES — pixel FX engine
 * Low-res canvases scaled up with nearest-neighbour, so every particle is a real "fat pixel".
 */
(function (global) {
    'use strict';

    // size of one "fat pixel" in css px — grows with the UI scale so particles look the same on 2K/4K
    const UI_SCALE = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--s')) || 1;
    const PX = Math.max(3, Math.round(3 * UI_SCALE));
    const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    const reduced = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function rand(a, b) { return a + Math.random() * (b - a); }

    /* ------------------------------------------------------------------ */
    /* Sprite colour sampling (done once, off the hot path)                */
    /* ------------------------------------------------------------------ */
    const SAMPLE_COLS = 44;
    const spriteCache = new Map();
    const idle = global.requestIdleCallback || (fn => setTimeout(fn, 60));

    function sampleImage(im, key) {
        const cols = SAMPLE_COLS;
        const rows = Math.max(1, Math.round(cols * im.naturalHeight / im.naturalWidth));
        const off = document.createElement('canvas');
        off.width = cols;
        off.height = rows;
        // willReadFrequently keeps this canvas on the CPU: no GPU readback stall
        const oc = off.getContext('2d', { willReadFrequently: true });
        oc.drawImage(im, 0, 0, cols, rows);
        let px;
        try {
            px = oc.getImageData(0, 0, cols, rows).data;
        } catch (_) {
            return; // file:// taints the canvas — disintegrate() falls back to a palette
        }
        const data = new Array(cols * rows);
        let opaque = 0;
        for (let i = 0; i < cols * rows; i++) {
            if (px[i * 4 + 3] < 90) continue;
            data[i] = 'rgb(' + px[i * 4] + ',' + px[i * 4 + 1] + ',' + px[i * 4 + 2] + ')';
            opaque++;
        }
        spriteCache.set(key, { cols, rows, data, opaque: Math.max(1, opaque) });
    }

    /** Pre-sample a sprite so disintegrate() never touches pixels mid-fight */
    function prepareSprite(src) {
        const key = new URL(src, global.location.href).href;
        if (spriteCache.has(key)) return;
        const im = new Image();
        im.decoding = 'async';
        im.onload = () => idle(() => { if (!spriteCache.has(key)) sampleImage(im, key); });
        im.src = key;
    }
    function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

    /* ------------------------------------------------------------------ */
    /* Particle layer                                                      */
    /* ------------------------------------------------------------------ */
    function createLayer(opts) {
        const o = opts || {};
        const canvas = document.createElement('canvas');
        canvas.className = 'fx-canvas';
        canvas.style.zIndex = String(o.z == null ? 5 : o.z);
        (o.parent || document.body).appendChild(canvas);
        const ctx = canvas.getContext('2d');
        let W = 0, H = 0;
        let snap = PX; // device pixels per logical "fat pixel"

        // Full-resolution backing store, logical units of PX css-px:
        // particles stay chunky but move smoothly instead of hopping 3px at a time.
        function resize() {
            const dpr = Math.min(2, global.devicePixelRatio || 1);
            W = Math.ceil(global.innerWidth / PX);
            H = Math.ceil(global.innerHeight / PX);
            canvas.width = Math.round(global.innerWidth * dpr);
            canvas.height = Math.round(global.innerHeight * dpr);
            snap = PX * dpr;
            ctx.setTransform(snap, 0, 0, snap, 0, 0);
            ctx.imageSmoothingEnabled = false;
        }
        resize();
        global.addEventListener('resize', resize);

        const parts = [];
        const emitters = [];
        const shapes = [];
        let last = performance.now();
        let running = true;

        const MAX_PARTS = 900;
        let dirty = false;

        function add(p) {
            if (parts.length >= MAX_PARTS) {
                // overwrite a random old particle instead of shifting the whole array
                parts[(Math.random() * parts.length) | 0] = p;
            } else {
                parts.push(p);
            }
            p.age = 0;
            return p;
        }

        function drawParticle(p) {
            ctx.globalAlpha = p._a;
            const color = p._c, size = p._s, x = Math.round(p.x * snap) / snap, y = Math.round(p.y * snap) / snap;
            if (p.glow) {
                ctx.globalAlpha = p._a * 0.25;
                ctx.fillStyle = color;
                ctx.fillRect(x - 1, y - 1, size + 2, size + 2);
                ctx.globalAlpha = p._a;
            }
            ctx.fillStyle = color;
            if (p.streak) {
                const sp = Math.hypot(p.vx, p.vy) || 1;
                const len = Math.max(1, Math.min(6, sp / 40)) | 0;
                const nx = p.vx / sp, ny = p.vy / sp;
                for (let j = 0; j < len; j++) ctx.fillRect(Math.round((x - nx * j) * snap) / snap, Math.round((y - ny * j) * snap) / snap, size, size);
            } else {
                ctx.fillRect(x, y, size, size);
            }
        }

        function tick(now) {
            if (!running) return;
            requestAnimationFrame(tick);
            const dt = Math.min(0.05, (now - last) / 1000);
            last = now;

            for (const em of emitters) {
                if (em.paused) continue;
                em.acc += em.rate * dt;
                while (em.acc >= 1) {
                    em.acc -= 1;
                    add(em.spawn(W, H));
                }
            }

            // nothing to show: leave the canvas alone (no texture upload this frame)
            if (!parts.length && !shapes.length) {
                if (dirty) { ctx.clearRect(0, 0, W, H); dirty = false; }
                return;
            }
            ctx.clearRect(0, 0, W, H);
            dirty = true;

            for (let i = shapes.length - 1; i >= 0; i--) {
                const s = shapes[i];
                s.age += dt;
                if (s.age >= s.life) { shapes[i] = shapes[shapes.length - 1]; shapes.pop(); continue; }
                s.draw(ctx, s.age / s.life);
            }

            let hasAdditive = false;
            for (let i = parts.length - 1; i >= 0; i--) {
                const p = parts[i];
                p.age += dt;
                if (p.age >= p.life || p.y > H + 20 || p.x < -40 || p.x > W + 40) {
                    parts[i] = parts[parts.length - 1];
                    parts.pop();
                    continue;
                }
                if (p.ax) p.vx += p.ax * dt;
                if (p.ay) p.vy += p.ay * dt;
                if (p.drag) {
                    const d = Math.pow(1 - p.drag, dt * 60);
                    p.vx *= d;
                    p.vy *= d;
                }
                if (p.wobble) p.vx += Math.sin((p.age + p.seed) * p.wobble) * 4 * dt;
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                if (p.floor != null && p.y > p.floor) {
                    p.y = p.floor;
                    p.vy *= -0.3;
                    p.vx *= 0.6;
                }

                const k = p.age / p.life;
                const fadeAt = p.fadeAt == null ? 0.6 : p.fadeAt;
                let alpha = p.fadeIn && k < 0.15 ? k / 0.15 : 1;
                if (k > fadeAt) alpha *= 1 - (k - fadeAt) / (1 - fadeAt);
                if (p.flicker && Math.random() < p.flicker) alpha *= 0.4;
                p._a = alpha;
                if (alpha <= 0) continue;
                p._c = p.colors ? p.colors[Math.min(p.colors.length - 1, (k * p.colors.length) | 0)] : p.color;
                p._s = p.shrink ? Math.max(1, Math.round(p.size * (1 - k))) : p.size;
                if (p.additive) { hasAdditive = true; continue; }
                drawParticle(p);
            }
            // additive particles in one batch: a single composite-mode switch per frame
            if (hasAdditive) {
                ctx.globalCompositeOperation = 'lighter';
                for (let i = 0; i < parts.length; i++) {
                    const p = parts[i];
                    if (p.additive && p._a > 0) drawParticle(p);
                }
                ctx.globalCompositeOperation = 'source-over';
            }
            ctx.globalAlpha = 1;
        }
        requestAnimationFrame(tick);

        const layer = {
            canvas, ctx,
            get W() { return W; },
            get H() { return H; },
            add,
            toLocal(x, y) { return { x: x / PX, y: y / PX }; },

            emitter(rate, spawn) {
                const em = { rate: reduced ? rate * 0.25 : rate, spawn, acc: 0, paused: false };
                emitters.push(em);
                return em;
            },

            shape(life, draw) { shapes.push({ life, draw, age: 0 }); },

            /** Burst of pixels at screen coords */
            burst(x, y, opt) {
                const o = opt || {};
                const n = reduced ? Math.ceil((o.count || 20) / 3) : (o.count || 20);
                const lx = x / PX, ly = y / PX;
                for (let i = 0; i < n; i++) {
                    const a = o.angle != null ? o.angle + rand(-(o.spread || Math.PI), o.spread || Math.PI) : rand(0, Math.PI * 2);
                    const sp = rand(o.speedMin || 20, o.speed || 120);
                    add({
                        x: lx + rand(-(o.jitter || 2), o.jitter || 2),
                        y: ly + rand(-(o.jitter || 2), o.jitter || 2),
                        vx: Math.cos(a) * sp,
                        vy: Math.sin(a) * sp - (o.lift || 0),
                        ay: o.gravity == null ? 220 : o.gravity,
                        drag: o.drag == null ? 0.04 : o.drag,
                        life: rand(o.lifeMin || 0.35, o.life || 0.9),
                        size: o.sizes ? pick(o.sizes) : (o.size || 1),
                        color: pick(o.colors || ['#fff']),
                        colors: o.ramp || null,
                        glow: !!o.glow,
                        additive: !!o.additive,
                        streak: !!o.streak,
                        floor: o.floor != null ? o.floor / PX : null,
                        shrink: !!o.shrink,
                        fadeAt: o.fadeAt
                    });
                }
            },

            /** Pixel sword arc */
            slash(x, y, opt) {
                const o = opt || {};
                const cx = x / PX, cy = y / PX;
                const r = (o.radius || 70) / PX;
                const a0 = o.from == null ? -2.2 : o.from;
                const a1 = o.to == null ? 0.9 : o.to;
                const core = o.core || '#ffffff';
                const edge = o.edge || '#ffd34a';
                const life = o.life || 0.22;
                this.shape(life, (c, k) => {
                    const head = Math.min(1, k * 2.2);
                    const tail = Math.max(0, k * 1.6 - 0.35);
                    const steps = 42;
                    for (let i = 0; i <= steps; i++) {
                        const t = i / steps;
                        if (t > head || t < tail) continue;
                        const a = a0 + (a1 - a0) * t;
                        const thick = Math.max(1, Math.round((o.width || 4) * Math.sin(Math.PI * ((t - tail) / Math.max(0.01, head - tail)))));
                        for (let w = 0; w < thick; w++) {
                            const rr = r - w;
                            c.fillStyle = w === 0 ? edge : core;
                            c.globalAlpha = 1 - k * 0.5;
                            c.fillRect((cx + Math.cos(a) * rr) | 0, (cy + Math.sin(a) * rr) | 0, 1, 1);
                        }
                    }
                    c.globalAlpha = 1;
                });
            },

            /** Expanding pixel ring */
            ring(x, y, opt) {
                const o = opt || {};
                const cx = x / PX, cy = y / PX;
                const maxR = (o.radius || 80) / PX;
                const color = o.color || '#ffd34a';
                const flat = o.flat || 1;
                this.shape(o.life || 0.4, (c, k) => {
                    const r = maxR * (0.15 + 0.85 * (1 - Math.pow(1 - k, 3)));
                    c.globalAlpha = 1 - k;
                    c.fillStyle = color;
                    const n = Math.max(16, (r * 4) | 0);
                    for (let i = 0; i < n; i++) {
                        const a = (i / n) * Math.PI * 2;
                        c.fillRect((cx + Math.cos(a) * r) | 0, (cy + Math.sin(a) * r * flat) | 0, 1, 1);
                    }
                    c.globalAlpha = 1;
                });
            },

            /** Vertical pillar of light (level up, heal) */
            pillar(x, yBottom, opt) {
                const o = opt || {};
                const cx = x / PX, yb = yBottom / PX;
                const w = (o.width || 90) / PX;
                const h = (o.height || 400) / PX;
                const color = o.color || '#ffe28a';
                this.shape(o.life || 1.1, (c, k) => {
                    const a = k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8;
                    for (let i = 0; i < w; i++) {
                        const edge = Math.abs(i - w / 2) / (w / 2);
                        c.globalAlpha = a * (1 - edge) * 0.55;
                        c.fillStyle = color;
                        c.fillRect((cx - w / 2 + i) | 0, (yb - h) | 0, 1, h | 0);
                    }
                    c.globalAlpha = 1;
                });
                for (let i = 0; i < (reduced ? 8 : 30); i++) {
                    add({
                        x: cx + rand(-w / 2, w / 2), y: yb - rand(0, 10),
                        vx: rand(-4, 4), vy: rand(-90, -30), life: rand(0.6, 1.3),
                        size: pick([1, 1, 2]), color, glow: true, additive: true, flicker: 0.2
                    });
                }
            },

            /** Shatter an <img> into its own pixels (falls back to palette dust) */
            disintegrate(img, opt) {
                const o = opt || {};
                const rect = img.getBoundingClientRect();
                if (!rect.width) return;
                // Never read pixels here: a synchronous GPU readback stalls the frame.
                // Colours come from the cache filled by prepareSprite() during idle time.
                const sample = spriteCache.get(img.currentSrc || img.src) || null;
                const cols = sample ? sample.cols : SAMPLE_COLS;
                const rows = sample ? sample.rows : Math.round(SAMPLE_COLS * rect.height / rect.width);
                const data = sample ? sample.data : null;
                const cellW = rect.width / cols, cellH = rect.height / rows;
                const palette = o.palette || ['#ddd', '#999', '#555'];
                const dir = o.dir || 1;
                const keep = reduced ? 0.25 : Math.min(1, 520 / (sample ? sample.opaque : cols * rows * 0.45));
                const size = Math.max(1, Math.round(cellW / PX));
                for (let y = 0; y < rows; y++) {
                    for (let x = 0; x < cols; x++) {
                        let color;
                        if (data) {
                            color = data[y * cols + x];
                            if (!color) continue;
                        } else {
                            const dx = (x / cols - 0.5) * 2, dy = (y / rows - 0.55) * 2;
                            if (dx * dx * 1.6 + dy * dy > 1) continue;
                            color = pick(palette);
                        }
                        if (Math.random() > keep) continue;
                        const delay = (1 - y / rows) * 0.25 + Math.random() * 0.2;
                        add({
                            x: (rect.left + x * cellW) / PX, y: (rect.top + y * cellH) / PX,
                            vx: dir * rand(10, 70) + rand(-20, 20),
                            vy: rand(-70, -10),
                            ay: o.gravity == null ? -30 : o.gravity,
                            drag: 0.02,
                            wobble: 6, seed: Math.random() * 10,
                            life: 0.7 + delay + rand(0, 0.6),
                            fadeAt: 0.35,
                            size,
                            color
                        });
                    }
                }
            },

            clear() { parts.length = 0; shapes.length = 0; },
            destroy() { running = false; canvas.remove(); }
        };
        return layer;
    }

    /* ------------------------------------------------------------------ */
    /* Ambient presets                                                     */
    /* ------------------------------------------------------------------ */
    const ambient = {
        /** Embers rising from given points (fractions of the viewport) */
        embers(layer, points, rate) {
            return layer.emitter(rate || 14, (W, H) => {
                const pt = pick(points);
                const x = (typeof pt.x === 'function' ? pt.x() : pt.x) * W;
                const y = (typeof pt.y === 'function' ? pt.y() : pt.y) * H;
                return {
                    x: x + rand(-3, 3), y: y + rand(-2, 2),
                    vx: rand(-6, 6), vy: rand(-38, -16), ay: -6,
                    wobble: rand(2, 5), seed: Math.random() * 10,
                    life: rand(1.2, 3.2), fadeAt: 0.4,
                    size: Math.random() < 0.2 ? 2 : 1,
                    colors: ['#fff2a8', '#ffc14a', '#ff7a1e', '#c8321a', '#5a1208'],
                    glow: true, additive: true, flicker: 0.08
                };
            });
        },
        /** Slow drifting ash / dust motes */
        ash(layer, rate, colors) {
            return layer.emitter(rate || 6, (W, H) => ({
                x: rand(-10, W), y: rand(-10, H * 0.9),
                vx: rand(2, 10), vy: rand(-3, 6),
                wobble: rand(1, 3), seed: Math.random() * 10,
                life: rand(4, 8), fadeIn: true, fadeAt: 0.6,
                size: 1,
                color: pick(colors || ['#6a5c58', '#8a7c70', '#4a3e3a'])
            }));
        },
        /** Wind-blown sand */
        sand(layer, rate) {
            return layer.emitter(rate || 40, (W, H) => ({
                x: rand(-20, -2), y: rand(H * 0.35, H),
                vx: rand(60, 160), vy: rand(-8, 8),
                wobble: rand(3, 8), seed: Math.random() * 10,
                life: rand(2, 5), fadeIn: true, fadeAt: 0.7,
                size: Math.random() < 0.15 ? 2 : 1,
                streak: Math.random() < 0.4,
                color: pick(['#d8b878', '#c49a58', '#e8d0a0', '#a07840'])
            }));
        }
    };

    /* ------------------------------------------------------------------ */
    /* Screen-level helpers                                                */
    /* ------------------------------------------------------------------ */
    function shake(el, power) {
        if (!el || reduced || document.documentElement.classList.contains('no-shake')) return;
        const p = Math.min(18, power || 6);
        const frames = [];
        for (let i = 0; i < 7; i++) {
            const k = 1 - i / 7;
            frames.push({ transform: 'translate(' + Math.round(rand(-p, p) * k) + 'px,' + Math.round(rand(-p, p) * k) + 'px)' });
        }
        frames.push({ transform: 'translate(0,0)' });
        el.animate(frames, { duration: 260 + p * 8, easing: 'ease-out' });
    }

    function flash(color, ms, opacity) {
        const d = document.createElement('div');
        d.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:8000;background:' + (color || '#fff');
        document.body.appendChild(d);
        const a = d.animate([{ opacity: opacity == null ? 0.6 : opacity }, { opacity: 0 }], { duration: ms || 180, easing: 'ease-out' });
        a.onfinish = () => d.remove();
        setTimeout(() => d.remove(), (ms || 180) + 400);
    }

    /** Mouse parallax for any number of elements (depth in px) */
    function parallax(items) {
        if (reduced) return;
        let tx = 0, ty = 0, cx = 0, cy = 0;
        global.addEventListener('pointermove', e => {
            tx = (e.clientX / global.innerWidth - 0.5) * 2;
            ty = (e.clientY / global.innerHeight - 0.5) * 2;
        });
        let px = NaN, py = NaN;
        (function loop() {
            requestAnimationFrame(loop);
            cx += (tx - cx) * 0.06;
            cy += (ty - cy) * 0.06;
            // only touch styles when the offset moved by a visible amount
            const rx = Math.round(cx * 400) / 400, ry = Math.round(cy * 400) / 400;
            if (rx === px && ry === py) return;
            px = rx;
            py = ry;
            for (const it of items) {
                if (!it.el) continue;
                it.el.style.transform = (it.base || '') + ' translate3d(' + (-rx * it.depth).toFixed(1) + 'px,' + (-ry * it.depth * 0.6).toFixed(1) + 'px,0)';
            }
        })();
    }

    /* ------------------------------------------------------------------ */
    /* Dithered screen transitions                                         */
    /* ------------------------------------------------------------------ */
    const CELL = 18;
    let curtain = null;

    function ensureCurtain() {
        if (curtain) return curtain;
        const c = document.createElement('canvas');
        c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:9600;pointer-events:none;image-rendering:pixelated';
        document.body.appendChild(c);
        curtain = c;
        return c;
    }

    function drawCurtain(t) {
        const c = ensureCurtain();
        const w = Math.ceil(global.innerWidth / CELL);
        const h = Math.ceil(global.innerHeight / CELL);
        if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
        const ctx = c.getContext('2d');
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#000';
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const b = BAYER[(y & 3) * 4 + (x & 3)] / 16;
                const sweep = (y / h) * 0.35;
                if ((b * 0.65 + sweep) < t * 1.0) ctx.fillRect(x, y, 1, 1);
            }
        }
    }

    function animateCurtain(from, to, ms) {
        return new Promise(resolve => {
            const t0 = performance.now();
            (function step(now) {
                const k = Math.min(1, (now - t0) / ms);
                const q = from + (to - from) * k;
                drawCurtain(q);
                if (k < 1) requestAnimationFrame(step);
                else resolve();
            })(t0);
        });
    }

    function enter() {
        const pre = document.getElementById('fxCurtain');
        drawCurtain(1.05);
        if (pre) pre.remove();
        return animateCurtain(1.05, 0, reduced ? 1 : 520).then(() => {
            if (curtain) curtain.getContext('2d').clearRect(0, 0, curtain.width, curtain.height);
        });
    }

    let leaving = false;
    function go(url, ms) {
        if (leaving) return;
        leaving = true;
        ensureCurtain().style.pointerEvents = 'all';
        animateCurtain(0, 1.05, reduced ? 1 : (ms || 420)).then(() => { global.location.href = url; });
    }

    // Restore a page that the browser shows from the back/forward cache
    global.addEventListener('pageshow', e => {
        if (e.persisted && curtain) {
            leaving = false;
            curtain.style.pointerEvents = 'none';
            curtain.getContext('2d').clearRect(0, 0, curtain.width, curtain.height);
        }
    });

    global.DustFX = { PX, createLayer, prepareSprite, ambient, shake, flash, parallax, enter, go, rand, pick, reduced };
})(window);
