import { createSignal, onCleanup, onMount } from "solid-js";

// one pixel unit is one canvas pixel; the shield is a 26x31 grid split at row 18
// into a flat top and a half-circle taper below it
const WIDTH = 26;
const HEIGHT = 31;
const SPLIT = 18;
const RADIUS = WIDTH / 2;

// invader formation: 5x3 blocks of 2x2 cells, anchored at (FORMATION_X, FORMATION_Y)
const COLUMNS = 5;
const ROWS = 3;
const FORMATION_X = 6;
const FORMATION_Y = 2;

const idleCaption = "est. 2019 · non-profit";
const playCaption = "← → move · space shoot · esc quit";

type GameState = "shield" | "assemble" | "play" | "return";

/** One shield pixel travelling toward (or back from) a formation slot. */
interface Traveller {
    fromX: number;
    fromY: number;
    column: number;
    row: number;
    slot: number;
}

/** One alive 2x2 invader block, addressed by formation column and row. */
interface Block {
    column: number;
    row: number;
}

/** One rising shot fired from the ship. */
interface Bullet {
    x: number;
    y: number;
}

/** True when (x, y) falls inside the shield outline. */
function inside(x: number, y: number): boolean {
    if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return false;
    if (y < SPLIT) return true;

    const dx = x + 0.5 - WIDTH / 2;
    const dy = y + 0.5 - SPLIT;
    return dx * dx + dy * dy <= RADIUS * RADIUS;
}

/** True when (x, y) sits on the shield's outline. */
function isEdge(x: number, y: number): boolean {
    return !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
}

/** True when (x, y) falls in the shield's lower-left azure half. */
function isAzure(x: number, y: number): boolean {
    return y * WIDTH > x * HEIGHT;
}

/** The four cells of one formation block, offset by the current march position. */
function blockCells(
    column: number,
    row: number,
    offsetX: number,
    offsetY: number,
): [number, number][] {
    const x = FORMATION_X + column * 3 + offsetX;
    const y = FORMATION_Y + row * 3 + offsetY;
    return [
        [x, y],
        [x + 1, y],
        [x, y + 1],
        [x + 1, y + 1],
    ];
}

/** Sample azure checker cells as pixel sources for the travellers. */
function azureSources(count: number): [number, number][] {
    const cells: [number, number][] = [];
    for (let y = 0; y < HEIGHT; y++) {
        for (let x = 0; x < WIDTH; x++) {
            if (inside(x, y) && isAzure(x, y) && (x + y) % 2 === 0) cells.push([x, y]);
        }
    }

    const picked: [number, number][] = [];
    while (picked.length < count && cells.length > 0) {
        picked.push(cells.splice((Math.random() * cells.length) | 0, 1)[0]);
    }
    return picked;
}

/** Pixel shield that becomes a space-invaders minigame on click. */
export function Shield() {
    let canvas!: HTMLCanvasElement;
    const [caption, setCaption] = createSignal(idleCaption);

    onMount(() => {
        const context = canvas.getContext("2d");
        if (context === null) {
            throw new Error("canvas 2d context unavailable");
        }
        const ctx = context;

        const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
        const ink = () => getComputedStyle(document.body).color;

        // mutable game state, read and written once per animation frame
        const game = {
            state: "shield" as GameState,
            startedAt: 0,
            pixels: [] as Traveller[],
            blocks: [] as Block[],
            offsetX: 0,
            offsetY: 0,
            direction: 1,
            ship: 12,
            bullets: [] as Bullet[],
            stepAt: 0,
            bulletAt: 0,
        };

        // draw every shield cell: solid edges, dithered azure half, faint argent half
        function drawShieldFrame(shimmer: boolean, alpha: number) {
            for (let y = 0; y < HEIGHT; y++) {
                for (let x = 0; x < WIDTH; x++) {
                    if (!inside(x, y)) continue;

                    const edge = isEdge(x, y);
                    const flick = shimmer && Math.random() < 0.04;
                    const on = edge || (isAzure(x, y) && ((x + y) % 2 === 0) !== flick);
                    ctx.globalAlpha = (on ? (edge ? 1 : 0.8) : 0.06) * alpha;
                    ctx.fillRect(x, y, 1, 1);
                }
            }
        }

        // click begins assembly: shield pixels fly into a 5x3 invader formation
        function startGame() {
            if (game.state !== "shield") return;

            const sources = azureSources(COLUMNS * ROWS * 4);
            game.pixels = sources.map(([fromX, fromY], i) => ({
                fromX,
                fromY,
                column: ((i / 4) | 0) % COLUMNS,
                row: (i / 12) | 0,
                slot: i % 4,
            }));

            game.blocks = [];
            for (let row = 0; row < ROWS; row++) {
                for (let column = 0; column < COLUMNS; column++) game.blocks.push({ column, row });
            }

            game.offsetX = 0;
            game.offsetY = 0;
            game.direction = 1;
            game.ship = 12;
            game.bullets = [];
            game.state = "assemble";
            game.startedAt = performance.now();
            setCaption(playCaption);
        }

        // esc, victory, or invasion sends the pixels back into the shield
        function endGame() {
            game.state = "return";
            game.startedAt = performance.now();
            setCaption(idleCaption);
        }

        // march the formation sideways, dropping a row when it reaches an edge
        function marchFormation(now: number) {
            if (now - game.stepAt <= 450) return;
            game.stepAt = now;

            const xs = game.blocks.flatMap((block) => [
                FORMATION_X + block.column * 3 + game.offsetX,
                FORMATION_X + block.column * 3 + game.offsetX + 1,
            ]);
            const hitEdge =
                (game.direction > 0 && Math.max(...xs) >= WIDTH - 2) ||
                (game.direction < 0 && Math.min(...xs) <= 1);

            if (hitEdge) {
                game.direction *= -1;
                game.offsetY += 1;
            } else {
                game.offsetX += game.direction;
            }
        }

        // advance bullets and remove any block (and its travellers) that they hit
        function resolveBullets(now: number) {
            if (now - game.bulletAt <= 60) return;
            game.bulletAt = now;

            for (const bullet of game.bullets) bullet.y -= 1;
            game.bullets = game.bullets.filter((bullet) => bullet.y >= 0);

            for (const bullet of [...game.bullets]) {
                const hit = game.blocks.find((block) =>
                    blockCells(block.column, block.row, game.offsetX, game.offsetY).some(
                        ([cellX, cellY]) => cellX === bullet.x && cellY === bullet.y,
                    ),
                );
                if (hit === undefined) continue;

                game.blocks = game.blocks.filter((block) => block !== hit);
                game.pixels = game.pixels.filter(
                    (pixel) => !(pixel.column === hit.column && pixel.row === hit.row),
                );
                game.bullets = game.bullets.filter((b) => b !== bullet);
            }
        }

        // draw the idle shield, occasionally letting azure cells shimmer
        let lastShimmer = 0;
        function drawIdle(now: number) {
            if (now - lastShimmer > 260) lastShimmer = now;
            drawShieldFrame(!reducedMotion && now - lastShimmer < 40, 1);
        }

        // lerp pixels between shield cells and formation slots over 700ms
        function drawTransition(now: number) {
            const progress = Math.min(1, (now - game.startedAt) / 700);
            const t = game.state === "assemble" ? progress : 1 - progress;

            drawShieldFrame(false, 1 - t);
            ctx.globalAlpha = 0.9;
            for (const pixel of game.pixels) {
                const [targetX, targetY] = blockCells(
                    pixel.column,
                    pixel.row,
                    game.offsetX,
                    game.offsetY,
                )[pixel.slot];
                const x = pixel.fromX + (targetX - pixel.fromX) * t;
                const y = pixel.fromY + (targetY - pixel.fromY) * t;
                ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
            }

            if (progress >= 1) game.state = game.state === "assemble" ? "play" : "shield";
        }

        // march, shoot, collide, then draw invaders, ship, and bullets
        function drawPlay(now: number) {
            marchFormation(now);
            resolveBullets(now);

            const lowest = Math.max(
                0,
                ...game.blocks.map((block) => FORMATION_Y + block.row * 3 + game.offsetY + 1),
            );
            if (game.blocks.length === 0 || lowest >= 27) {
                endGame();
                return;
            }

            ctx.globalAlpha = 0.9;
            for (const block of game.blocks) {
                for (const [cellX, cellY] of blockCells(
                    block.column,
                    block.row,
                    game.offsetX,
                    game.offsetY,
                )) {
                    ctx.fillRect(cellX, cellY, 1, 1);
                }
            }

            ctx.globalAlpha = 1;
            ctx.fillRect(game.ship - 1, 29, 3, 1);
            ctx.fillRect(game.ship, 28, 1, 1);
            for (const bullet of game.bullets) ctx.fillRect(bullet.x, bullet.y, 1, 1);
        }

        // one render loop drives shimmer, transitions, and play
        function loop(now: number) {
            frameId = requestAnimationFrame(loop);
            ctx.clearRect(0, 0, WIDTH, HEIGHT);
            ctx.fillStyle = ink();

            if (game.state === "shield") drawIdle(now);
            else if (game.state === "assemble" || game.state === "return") drawTransition(now);
            else if (game.state === "play") drawPlay(now);
        }
        let frameId = requestAnimationFrame(loop);

        // game captures its keys while assembling or playing, letting the site's
        // accelerator keys through otherwise
        function onKeyDown(event: KeyboardEvent) {
            if (game.state !== "assemble" && game.state !== "play") return;

            if (event.key === "ArrowLeft") game.ship = Math.max(1, game.ship - 1);
            else if (event.key === "ArrowRight") game.ship = Math.min(WIDTH - 2, game.ship + 1);
            else if (event.key === " ") {
                if (game.bullets.length < 2) game.bullets.push({ x: game.ship, y: 27 });
            } else if (event.key === "Escape") endGame();
            else return;

            event.preventDefault();
            event.stopImmediatePropagation();
        }

        canvas.addEventListener("click", startGame);
        addEventListener("keydown", onKeyDown, { capture: true });

        onCleanup(() => {
            cancelAnimationFrame(frameId);
            canvas.removeEventListener("click", startGame);
            removeEventListener("keydown", onKeyDown, { capture: true });
        });
    });

    return (
        <>
            <canvas
                ref={canvas}
                width={WIDTH}
                height={HEIGHT}
                class="mx-auto block h-[124px] w-[104px] cursor-pointer [image-rendering:pixelated]"
                title="click to play"
            />
            <p class="mt-2 min-h-[18px] text-xs text-soft">{caption()}</p>
        </>
    );
}
