var canvas = document.getElementById('spaceMesh'), ctx = canvas.getContext('2d');

// initial canvas size
var cw = window.innerWidth;
var ch = window.innerHeight;
canvas.width = cw;
canvas.height = ch;


/* USER PARAMETERS

cw is total width
ch is total height

*/
let x = 0;                     //starting x
let y = 0;                     //starting y

let radius = 10;                // node radius
let lineWidth = radius / 4;     // mesh line width
let spacing = 50;               // space between nodes

let lineColor = "#474747ff";  // mesh line color
let nodeColor = lineColor;      // node fill color

let showLines = true;          // show mesh lines
let showNodes = false;          // show nodes

let mouseGravity = 1;           // how strongly nodes are pulled towards mouse [-1.5,1.5]

let changeNodeSize = false;     // whether node size changes with distance to mouse

const planets = [               // planets with gravity and optional orbiting
    { x: -1000000, y: -1000000, r: 40, gravity: 1, color: "#fcb315", textureSrc: "/assets/moon.jpg", Orbits: 1, OrbitRadius: 200, OrbitSpeed: 0.01, angle: 0},
    { x: -1000000, y: -1000000, r: 0, gravity: 2, color: "#1b1b1b", textureSrc: "/assets/mars.jpg"}, // heroPlanet, no need to add values
];

// DOM rectangle gravity bodies (auto-found)
const rectBodies = [];
const RECT_GRAVITY = 1.2;   // same gravity for all rectangles
const RECT_MAXDIST = 260;   // falloff range in px (tweak)

/* END USER PARAMETERS */

// --- Texture cache ---
const textureCache = new Map();

function getTexturePattern(src) {
    if (!src) return null;

    let entry = textureCache.get(src);
    if (entry) return entry.pattern; // may be null if not loaded yet

    // create entry
    const img = new Image();
    img.src = src;

    entry = { img, pattern: null, ready: false };
    textureCache.set(src, entry);

    img.onload = () => {
        // pattern needs a context
        entry.pattern = ctx.createPattern(img, "repeat");
        entry.ready = true;
    };

    return null; // not ready yet on first call
}

// Mouse position
var mX = 0;
var mY = 0;

// Array to store nodes
const nodes = [];

//Make an array of nodes
function createNodes() {
    let xTemp = x-spacing;
    let yTemp = y-spacing;

    while (yTemp <= ch + spacing) {
        const row = [];
        while(xTemp <= cw + spacing) {
            // Add to array
            row.push({ x: xTemp, y: yTemp, radius });
            xTemp += spacing;
        }
        nodes.push(row);
        xTemp = x-spacing;
        yTemp += spacing;
    }
}

// Initial Nodes
createNodes();
updateNodes();

// Change node size from mouse distance
function updateNodes() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Get the circular planets
    syncPlanetFromElement(document.getElementById("heroPlanet"), 1);

    // Get all rectangular gravity bodies from the DOM
    syncRectBodies();

    // Loop through all nodes
    nodes.forEach(row => {
        row.forEach(node => {
            // Initial offset
            let ox = 0;
            let oy = 0;
            let totalFalloff = 0;

            // Rectangle gravity for all .gravity-rect elements
            rectBodies.forEach(rect => {
                const push = applyRectForce(node, rect, RECT_GRAVITY, RECT_MAXDIST, 1); // direction=1 pushes away
                ox += push.ox;
                oy += push.oy;
            });

            // planet gravity for circles
            planets.forEach(planet => {
                // Planet falloff 
                const distance = Math.sqrt((planet.x - node.x) ** 2 + (planet.y - node.y) ** 2);
                const maxDist = 250;
                const t = Math.max(0, 1 - distance / maxDist);
                const falloff = t * t;

                // Apply planet gravity
                oy += (planet.y - node.y) * falloff * planet.gravity;
                ox += (planet.x - node.x) * falloff * planet.gravity;

                totalFalloff += falloff;
            });

            // // Mouse falloff (1 = near mouse, 0 = far from mouse)
            const distance = Math.sqrt((mX - node.x) ** 2 + (mY - node.y) ** 2);
            const maxDist = 250;
            const t = Math.max(0, 1 - distance / maxDist);
            const falloff = t * t;

            // mouse gravity
            ox += (mX - node.x) * falloff * mouseGravity;
            oy += (mY - node.y) * falloff * mouseGravity;

            const maxDisp = spacing * 0.75;
            const mag = Math.hypot(ox, oy);
            if (mag > maxDisp) {
                const k = maxDisp / mag;
                ox *= k;
                oy *= k;
            }

            node.sX = node.x + ox;
            node.sY = node.y + oy;

            totalFalloff += falloff;

            // Shift node size
            if (changeNodeSize) {
                node.radius = radius - radius * totalFalloff;
                if (node.radius < 3) node.radius = 3;
            }

            // draw nodes
            if (showNodes){
                drawCircle(node.sX, node.sY, node.radius, nodeColor);
            }
        });
    });

    // Draw the grid
    if (showLines) {
        for (let i = 0; i < nodes.length; i++) {
            for (let j = 0; j < nodes[i].length; j++) {
                const node = nodes[i][j];
                // Connect to right neighbor
                if (j < nodes[i].length - 1) {
                    const rightNode = nodes[i][j + 1];
                    drawLine(node.sX, node.sY, rightNode.sX, rightNode.sY, lineWidth, lineColor);
                }
                // Connect to bottom neighbor
                if (i < nodes.length - 1) {
                    const bottomNode = nodes[i + 1][j];
                    drawLine(node.sX, node.sY, bottomNode.sX, bottomNode.sY, lineWidth, lineColor);
                }
            }
        }
    }

    planets.forEach(p => drawCircle(p.x, p.y, p.r, p.color, p.textureSrc));
}

function animateOrbits() {
    planets.forEach(planet => {
        if (planet.Orbits != undefined) {
            planet.angle += planet.OrbitSpeed;
            planet.x = planets[planet.Orbits].x + Math.cos(planet.angle) * planet.OrbitRadius;
            planet.y = planets[planet.Orbits].y + Math.sin(planet.angle) * planet.OrbitRadius;
        }
    });

    updateNodes();
    requestAnimationFrame(animateOrbits);
}

animateOrbits();

// Converts HTML elements into planets & their helper functions
function syncPlanetFromElement(el, planetIndex = 0) {
    if (!el) return;

    const r = el.getBoundingClientRect();

    // center in canvas coordinates (matches your mouse math, since you use client coords)
    planets[planetIndex].x = r.left + r.width / 2;
    planets[planetIndex].y = r.top + r.height / 2;

    // make gravity radius match element size
    planets[planetIndex].r = Math.min(r.width, r.height) / 2;
}
function applyRectForce(node, rect, strength, range, direction) {
    // Find closest point on rectangle to node
    const closestX = Math.max(rect.left, Math.min(node.x, rect.right));
    const closestY = Math.max(rect.top, Math.min(node.y, rect.bottom));

    const dx = (node.x - closestX) * direction;
    const dy = (node.y - closestY) * direction;

    const dist = Math.hypot(dx, dy);
    if (dist === 0) return { ox: 0, oy: 0 };

    const t = Math.max(0, 1 - dist / range);
    const falloff = t * t;

    return {
        ox: (dx / dist) * falloff * strength * 20,
        oy: (dy / dist) * falloff * strength * 20
    };
}
function syncRectBodies() {
    rectBodies.length = 0;

    document.querySelectorAll(".gravity-rect").forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return;

        rectBodies.push({
            left: r.left,
            right: r.right,
            top: r.top,
            bottom: r.bottom
        });
    });
}

// Important Helpers
function drawCircle(x, y, radius, color, textureSrc = null) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);

    if (textureSrc) {
        let img = textureCache.get(textureSrc);

        if (!img) {
            img = new Image();
            img.src = textureSrc;
            textureCache.set(textureSrc, img);
        }

        if (img.complete) {
            ctx.save();
            ctx.clip();

            // Draw image centered and scaled to circle size
            ctx.drawImage(
                img,
                x - radius,          // left
                y - radius,          // top
                radius * 2,          // width
                radius * 2           // height
            );

            ctx.restore();
            return;
        }
    }

    // fallback solid fill
    ctx.fillStyle = color;
    ctx.fill();
}
function drawLine(x1, y1, x2, y2, lineWidth, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
}
function RandomInt(max) {
    return Math.floor(Math.random() * max);
}
function getMousePos(event) {
    const rect = canvas.getBoundingClientRect();
    mX = event.clientX - rect.left;
    mY = event.clientY - rect.top;
}
function updateSize() {
    cw = window.innerWidth;
    ch = window.innerHeight;

    canvas.width = cw;
    canvas.height = ch;

    // reset grid + rebuild
    nodes.length = 0;
    x = 25;
    y = 25;

    createNodes();
    updateNodes();
}

// Listeners / Updaters
window.addEventListener('mousemove', (e) => {
    getMousePos(e);
});
window.addEventListener('scroll', () => {
    // lightweight: we don't redraw here, just keep rects fresh
    syncRectBodies();
}, { passive: true });
window.addEventListener('resize', updateSize);
