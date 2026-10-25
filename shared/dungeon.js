/**
 * DUST & BLADES — animated dungeon backdrop (main menu)
 *
 * Looping video of the dungeon wall with torch glow, embers and fog on top.
 */
(function (global) {
    'use strict';
    const FX = global.DustFX;
    // same ?v= as this script, so a new picture is never served from the browser cache
    const V = (document.currentScript && document.currentScript.src.split('?')[1]) || '';

    // Torch flame positions inside the dungeon picture (fractions of the image)
    const TORCHES = [
        { x: 0.135, y: 0.41 },
        { x: 0.872, y: 0.41 },
        { x: 0.352, y: 0.53 },
        { x: 0.655, y: 0.527 },
        { x: 0.379, y: 0.678 }
    ];

    function build(root) {
        const stage = document.createElement('div');
        stage.className = 'stage';
        stage.innerHTML =
            '<div class="stage-box">' +
                '<div class="stage-img" style="background-image:url(\'../media/images/bg_menu.jpg' + (V ? '?' + V : '') + '\')"></div>' +
                TORCHES.map(t => '<div class="torch-light" style="left:' + (t.x * 100) + '%;top:' + (t.y * 100) + '%"></div>').join('') +
                '<div class="fog back"></div><div class="fog"></div>' +
            '</div>' +
            '<div class="dungeon-shade"></div>';
        (root || document.body).prepend(stage);

        const vign = document.createElement('div');
        vign.className = 'vignette';
        stage.after(vign);

        const box = stage.querySelector('.stage-box');
        const img = stage.querySelector('.stage-img');
        const lights = Array.from(stage.querySelectorAll('.torch-light'));
        FX.backdropVideo(img, '../media/video/bg_menu.mp4' + (V ? '?' + V : ''));

        const layer = FX.createLayer({ z: 1 });
        // embers rise from the torches
        const pts = lights.map(el => {
            let r = null;
            return {
                x: () => { r = el.getBoundingClientRect(); return (r.left + r.width / 2) / global.innerWidth; },
                y: () => ((r || el.getBoundingClientRect()).top + (r || el.getBoundingClientRect()).height * 0.42) / global.innerHeight
            };
        });
        FX.ambient.embers(layer, pts, 16);
        FX.ambient.ash(layer, 5);

        FX.parallax([{ el: box, depth: 10, base: 'translate(-50%,-50%)' }]);

        return { stage, box, img, layer };
    }

    global.DustDungeon = { build };
})(window);
