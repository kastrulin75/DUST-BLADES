/**
 * DUST & BLADES — animated dungeon backdrop (sign-in + main menu)
 */
(function (global) {
    'use strict';
    const FX = global.DustFX;

    // Torch flame positions inside media/bg.png (fractions of the image)
    const TORCHES = [
        { x: 0.314, y: 0.335 },
        { x: 0.685, y: 0.335 },
        { x: 0.147, y: 0.775 },
        { x: 0.854, y: 0.775 }
    ];

    function build(root) {
        const stage = document.createElement('div');
        stage.className = 'stage';
        stage.innerHTML =
            '<div class="stage-box">' +
                '<div class="stage-img" style="background-image:url(\'../media/px/bg.jpg\')"></div>' +
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
        let rect = box.getBoundingClientRect();
        global.addEventListener('resize', () => { rect = box.getBoundingClientRect(); });

        const layer = FX.createLayer({ z: 1 });
        const pts = TORCHES.map(t => ({
            x: () => (rect.left + t.x * rect.width) / global.innerWidth,
            y: () => (rect.top + (t.y - 0.02) * rect.height) / global.innerHeight
        }));
        FX.ambient.embers(layer, pts, 16);
        FX.ambient.ash(layer, 5);

        // Torch lights and fog move with the wall so the glow stays on the torches
        FX.parallax([{ el: box, depth: 10, base: 'translate(-50%,-50%)' }]);

        return { stage, box, img, layer };
    }

    global.DustDungeon = { build };
})(window);
