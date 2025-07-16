import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// --- Scene Setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff); // White background

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000); // Increased far plane
camera.position.set(171.42554267514885, 7.4773593311066975, -130.3341114000014);
camera.lookAt(170.67578008197722, 7.709363478320541, -129.71440975440402);
let cameraInitialized = false;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);

// --- Lighting ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(10, 20, 10);
scene.add(dirLight);

// --- Hose Path ---
const segments = 128; // 2x more segments for smoothness
const points = [];
const hoseSegments = 20; // 2x more path points
for (let i = 0; i <= hoseSegments; i++) {
  points.push(new THREE.Vector3((i - hoseSegments / 2) * 8, Math.sin(i * 0.5) * 2, 0)); // 2x longer along X
}
const curve = new THREE.CatmullRomCurve3(points);

// --- Softbody Hose Geometry ---
const baseRadius = 1;
const tubeGeometry = new THREE.TubeGeometry(curve, segments, baseRadius, 16, false);
const hoseMaterial = new THREE.MeshStandardMaterial({ color: 0x0055cc, roughness: 0.3, metalness: 0.7 }); // More visible blue
const hose = new THREE.Mesh(tubeGeometry, hoseMaterial);
scene.add(hose);

// --- Elastic bulge state ---
let hoseCurrentRadii = Array(segments + 1).fill(baseRadius);

// --- Pool at Intake ---
const poolRadius = 3;
const poolHeight = 2;
const poolGeometry = new THREE.CylinderGeometry(poolRadius, poolRadius, poolHeight, 32);
const poolMaterial = new THREE.MeshStandardMaterial({ color: 0x3399ff, transparent: true, opacity: 0.7 });
const pool = new THREE.Mesh(poolGeometry, poolMaterial);
const poolStart = curve.getPointAt(0);
const poolDir = curve.getTangentAt(0);
const poolUp = new THREE.Vector3(0, 1, 0);
const poolQuat = new THREE.Quaternion().setFromUnitVectors(poolUp, poolDir);
pool.position.copy(poolStart.clone().add(poolDir.clone().multiplyScalar(-poolHeight / 2)));
pool.setRotationFromQuaternion(poolQuat);
scene.add(pool);

// --- Flow Units (Glowing Spheres) ---
const unitSphereGeometry = new THREE.SphereGeometry(1.1, 24, 24);
const unitCubeGeometry = new THREE.BoxGeometry(2.2, 2.2, 2.2);
let unitGeometry = unitSphereGeometry;
let unitShape = 'sphere'; // default
// --- Color Phases ---
const funnelColor = 0x9b59b6; // Purple
const poolColor = 0x9b59b6; // Purple
const inPipeColor = 0xffee88; // Yellow
const outPipeColor = 0xff9900; // Orange

function lerpColor(a, b, t) {
  // a, b: THREE.Color or hex, t: 0-1
  const ca = new THREE.Color(a);
  const cb = new THREE.Color(b);
  return ca.lerp(cb, t);
}

function createFlowUnit() {
  let geometry;
  if (unitShape === 'cube') {
    geometry = unitCubeGeometry.clone();
  } else {
    geometry = unitSphereGeometry.clone();
  }
  // Use a consistent, high-quality material
  const material = new THREE.MeshStandardMaterial({
    color: poolColor,
    emissive: poolColor,
    emissiveIntensity: 0.7,
    metalness: 0.45,
    roughness: 0.25
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.visible = true;
  mesh.unitT = 0;
  mesh.active = false;
  mesh.stage = 'funnel';
  mesh.colorStage = 0; // 0: funnel, 1: pool, 2: in-pipe, 3: out-pipe
  mesh.velocity = new THREE.Vector3();
  mesh.settled = false;
  mesh.isCube = (unitShape === 'cube');
  scene.add(mesh);
  return mesh;
}

// --- Label (Stage) ---
const labelDiv = document.createElement('div');
labelDiv.style.position = 'absolute';
labelDiv.style.color = '#fff';
labelDiv.style.fontWeight = 'bold';
labelDiv.style.pointerEvents = 'none';
labelDiv.style.display = 'none';
labelDiv.style.textShadow = '0 0 8px #000';
labelDiv.innerText = '';
document.body.appendChild(labelDiv);

// --- Input and Button UI ---
const uiDiv = document.createElement('div');
uiDiv.style.position = 'absolute';
uiDiv.style.top = '20px';
uiDiv.style.left = '20px';
uiDiv.style.zIndex = 10;
uiDiv.style.display = 'flex';
uiDiv.style.alignItems = 'center';
uiDiv.style.gap = '10px';
document.body.appendChild(uiDiv);

const input = document.createElement('input');
input.type = 'number';
input.min = '1';
input.max = '100';
input.value = '40';
input.style.width = '50px';
input.style.fontSize = '1.1em';
uiDiv.appendChild(input);

const intervalLabel = document.createElement('span');
intervalLabel.innerText = 'every';
uiDiv.appendChild(intervalLabel);

const intervalInput = document.createElement('input');
intervalInput.type = 'number';
intervalInput.min = '1';
intervalInput.max = '60';
intervalInput.value = '4';
intervalInput.style.width = '50px';
intervalInput.style.fontSize = '1.1em';
uiDiv.appendChild(intervalInput);

const secondsLabel = document.createElement('span');
secondsLabel.innerText = 'seconds';
uiDiv.appendChild(secondsLabel);

const button = document.createElement('button');
button.innerText = 'Send Units';
button.style.padding = '10px 20px';
button.style.fontSize = '1.2em';
uiDiv.appendChild(button);

const stopButton = document.createElement('button');
stopButton.innerText = 'Stop';
stopButton.style.padding = '10px 20px';
stopButton.style.fontSize = '1.2em';
stopButton.style.display = 'none';
uiDiv.appendChild(stopButton);

// --- Stats Panel Overlay ---
const statsPanel = document.createElement('div');
statsPanel.style.position = 'absolute';
statsPanel.style.top = '20px';
statsPanel.style.left = '20px';
statsPanel.style.zIndex = 20;
statsPanel.style.background = 'rgba(30,40,60,0.95)';
statsPanel.style.borderRadius = '12px';
statsPanel.style.boxShadow = '0 4px 24px #0008';
statsPanel.style.padding = '18px 24px 18px 24px';
statsPanel.style.display = 'flex';
statsPanel.style.flexDirection = 'column';
statsPanel.style.gap = '16px';
statsPanel.style.minWidth = '260px';
statsPanel.style.maxWidth = '340px';
statsPanel.style.color = '#fff';
statsPanel.style.fontFamily = 'sans-serif';
statsPanel.style.transition = 'transform 0.3s cubic-bezier(.4,2,.6,1), opacity 0.3s';
statsPanel.style.transform = 'translateY(0)';
statsPanel.style.opacity = '1';
document.body.appendChild(statsPanel);

// --- Expand/Collapse Button ---
const panelToggle = document.createElement('button');
panelToggle.innerText = '≡';
panelToggle.title = 'Show/hide controls';
panelToggle.style.position = 'absolute';
panelToggle.style.top = '16px';
panelToggle.style.left = '16px';
panelToggle.style.zIndex = 30;
panelToggle.style.width = '36px';
panelToggle.style.height = '36px';
panelToggle.style.borderRadius = '50%';
panelToggle.style.background = '#223';
panelToggle.style.color = '#fff';
panelToggle.style.fontSize = '1.5em';
panelToggle.style.border = 'none';
panelToggle.style.boxShadow = '0 2px 8px #0006';
panelToggle.style.cursor = 'pointer';
panelToggle.style.display = 'flex';
panelToggle.style.alignItems = 'center';
panelToggle.style.justifyContent = 'center';
panelToggle.style.transition = 'background 0.2s';
panelToggle.onmouseenter = () => panelToggle.style.background = '#334';
panelToggle.onmouseleave = () => panelToggle.style.background = '#223';
document.body.appendChild(panelToggle);

let panelOpen = true;
panelToggle.onclick = () => {
  panelOpen = !panelOpen;
  if (panelOpen) {
    statsPanel.style.transform = 'translateY(0)';
    statsPanel.style.opacity = '1';
  } else {
    statsPanel.style.transform = 'translateY(-40px)';
    statsPanel.style.opacity = '0';
  }
};

// --- Move UI elements into statsPanel ---
statsPanel.appendChild(input);
statsPanel.appendChild(intervalLabel);
statsPanel.appendChild(intervalInput);
statsPanel.appendChild(secondsLabel);
statsPanel.appendChild(button);
statsPanel.appendChild(stopButton);
uiDiv.style.display = 'none'; // Hide old UI div

// --- Play/Pause Button ---
const playPauseBtn = document.createElement('button');
playPauseBtn.innerText = '⏸';
playPauseBtn.title = 'Pause animation';
playPauseBtn.style.padding = '10px 20px';
playPauseBtn.style.fontSize = '1.2em';
playPauseBtn.style.borderRadius = '8px';
playPauseBtn.style.border = 'none';
playPauseBtn.style.background = '#2a3';
playPauseBtn.style.color = '#fff';
playPauseBtn.style.cursor = 'pointer';
playPauseBtn.style.marginTop = '8px';
statsPanel.appendChild(playPauseBtn);

let animationPaused = false;
playPauseBtn.onclick = () => {
  animationPaused = !animationPaused;
  playPauseBtn.innerText = animationPaused ? '▶️' : '⏸';
  playPauseBtn.title = animationPaused ? 'Play animation' : 'Pause animation';
};

// --- Add Reset Sim Button to Stats Panel ---
const resetBtn = document.createElement('button');
resetBtn.innerText = 'Reset Sim';
resetBtn.title = 'Reset simulation';
resetBtn.style.padding = '10px 20px';
resetBtn.style.fontSize = '1.2em';
resetBtn.style.borderRadius = '8px';
resetBtn.style.border = 'none';
resetBtn.style.background = '#a33';
resetBtn.style.color = '#fff';
resetBtn.style.cursor = 'pointer';
resetBtn.style.marginTop = '8px';
statsPanel.appendChild(resetBtn);

resetBtn.onclick = () => {
  // Remove all balls from scene
  [...funnelUnits, ...poolUnits, ...flowUnits, ...outPoolBalls].forEach(mesh => scene.remove(mesh));
  funnelUnits.length = 0;
  poolUnits.length = 0;
  flowUnits.length = 0;
  outPoolBalls.length = 0;
  intakeQueue.length = 0;
  intakeTimer = 0;
  setUIEnabled(true); // Ensure controls are re-enabled after reset
};

// --- Bulge Intensity Slider ---
const bulgeSliderLabel = document.createElement('label');
bulgeSliderLabel.innerText = 'Bulge Intensity:';
bulgeSliderLabel.style.fontSize = '1.1em';
bulgeSliderLabel.style.marginTop = '8px';
const bulgeSlider = document.createElement('input');
bulgeSlider.type = 'range';
bulgeSlider.min = '0.05';
bulgeSlider.max = '5.0';
bulgeSlider.step = '0.01';
bulgeSlider.value = '1.2'; // Higher default for more visible bulge
bulgeSlider.style.width = '160px';
bulgeSlider.style.marginLeft = '10px';
const bulgeValue = document.createElement('span');
bulgeValue.innerText = bulgeSlider.value;
bulgeValue.style.marginLeft = '8px';
bulgeSlider.oninput = () => { bulgeValue.innerText = bulgeSlider.value; };
bulgeSliderLabel.appendChild(bulgeSlider);
bulgeSliderLabel.appendChild(bulgeValue);
statsPanel.appendChild(bulgeSliderLabel);
let bulgeIntensity = parseFloat(bulgeSlider.value);
bulgeSlider.addEventListener('input', () => {
  bulgeIntensity = parseFloat(bulgeSlider.value);
});

// --- Ball Size Slider ---
const ballSizeSliderLabel = document.createElement('label');
ballSizeSliderLabel.innerText = 'Ball Size:';
ballSizeSliderLabel.style.fontSize = '1.1em';
ballSizeSliderLabel.style.marginTop = '8px';
const ballSizeSlider = document.createElement('input');
ballSizeSlider.type = 'range';
ballSizeSlider.min = '0.15';
ballSizeSlider.max = '2.0';
ballSizeSlider.step = '0.01';
ballSizeSlider.value = '0.45'; // Tiny default
ballSizeSlider.style.width = '120px';
ballSizeSlider.style.marginLeft = '10px';
const ballSizeValue = document.createElement('span');
ballSizeValue.innerText = ballSizeSlider.value;
ballSizeValue.style.marginLeft = '8px';
ballSizeSlider.oninput = () => { ballSizeValue.innerText = ballSizeSlider.value; };
ballSizeSliderLabel.appendChild(ballSizeSlider);
ballSizeSliderLabel.appendChild(ballSizeValue);
statsPanel.appendChild(ballSizeSliderLabel);
let BALL_RADIUS = parseFloat(ballSizeSlider.value);
ballSizeSlider.addEventListener('input', () => {
  BALL_RADIUS = parseFloat(ballSizeSlider.value);
  // Resize all balls/cubes
  for (const arr of [funnelUnits, poolUnits, flowUnits, outPoolBalls]) {
    for (const mesh of arr) {
      if (mesh && mesh.geometry) {
        const oldMaterial = mesh.material;
        mesh.geometry.dispose();
        if (mesh.isCube) {
          mesh.geometry = new THREE.BoxGeometry(BALL_RADIUS * 2, BALL_RADIUS * 2, BALL_RADIUS * 2);
        } else {
          mesh.geometry = new THREE.SphereGeometry(BALL_RADIUS, 24, 24);
        }
        // Re-apply material to preserve color/emissive
        mesh.material = oldMaterial;
      }
    }
  }
});

// --- OrbitControls: Right Mouse = Pan, Middle = Rotate ---
controls.mouseButtons = {
  LEFT: THREE.MOUSE.ROTATE,
  MIDDLE: THREE.MOUSE.PAN,
  RIGHT: THREE.MOUSE.PAN
};

// --- WASD and Arrow Key Camera Controls ---
let camMove = { forward: 0, back: 0, left: 0, right: 0, up: 0, down: 0 };
let camRot = { up: 0, down: 0, left: 0, right: 0 };
window.addEventListener('keydown', e => {
  if (e.repeat) return;
  switch (e.code) {
    case 'KeyW': camMove.forward = 1; break;
    case 'KeyS': camMove.back = 1; break;
    case 'KeyA': camMove.left = 1; break;
    case 'KeyD': camMove.right = 1; break;
    case 'Space': camMove.up = 1; break;
    case 'ShiftLeft': camMove.down = 1; break;
    case 'ArrowUp': camRot.up = 1; break;
    case 'ArrowDown': camRot.down = 1; break;
    case 'ArrowLeft': camRot.left = 1; break;
    case 'ArrowRight': camRot.right = 1; break;
  }
});
window.addEventListener('keyup', e => {
  switch (e.code) {
    case 'KeyW': camMove.forward = 0; break;
    case 'KeyS': camMove.back = 0; break;
    case 'KeyA': camMove.left = 0; break;
    case 'KeyD': camMove.right = 0; break;
    case 'Space': camMove.up = 0; break;
    case 'ShiftLeft': camMove.down = 0; break;
    case 'ArrowUp': camRot.up = 0; break;
    case 'ArrowDown': camRot.down = 0; break;
    case 'ArrowLeft': camRot.left = 0; break;
    case 'ArrowRight': camRot.right = 0; break;
  }
});

function updateCameraControls(delta) {
  // WASD movement
  const moveSpeed = 30 * delta;
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  dir.y = 0; dir.normalize();
  const right = new THREE.Vector3().crossVectors(dir, camera.up).normalize();
  if (camMove.forward) camera.position.addScaledVector(dir, moveSpeed);
  if (camMove.back) camera.position.addScaledVector(dir, -moveSpeed);
  if (camMove.left) camera.position.addScaledVector(right, -moveSpeed);
  if (camMove.right) camera.position.addScaledVector(right, moveSpeed);
  if (camMove.up) camera.position.y += moveSpeed;
  if (camMove.down) camera.position.y -= moveSpeed;
  // Arrow key look (rotate camera)
  const rotSpeed = 1.2 * delta;
  if (camRot.left) camera.rotation.y += rotSpeed;
  if (camRot.right) camera.rotation.y -= rotSpeed;
  if (camRot.up) camera.rotation.x += rotSpeed;
  if (camRot.down) camera.rotation.x -= rotSpeed;
}

// --- Softbody Bulge Logic ---
let flowUnits = [];
let flowStages = [];
let intakeQueue = [];
let poolUnits = [];
let funnelUnits = [];
let outPoolBalls = [];
let intakeTimer = 0;
let intakeDelay = 0.3;

// --- Physics Constants ---
const GRAVITY = -18; // units/sec^2
const BALL_RESTITUTION = 0.45; // bounciness
const BALL_FRICTION = 0.7;

// --- Funnel Above Intake Pool (large, for clusters) ---
const funnelHeight = 10;
const funnelTopRadius = 10;
const funnelBottomRadius = 4;
const funnelGeometry = new THREE.CylinderGeometry(funnelTopRadius, funnelBottomRadius, funnelHeight, 32, 1, true);
const funnelMaterial = new THREE.MeshStandardMaterial({ color: 0xccccff, transparent: true, opacity: 0.4, side: THREE.DoubleSide });
const funnel = new THREE.Mesh(funnelGeometry, funnelMaterial);
funnel.position.copy(pool.position).add(new THREE.Vector3(0, funnelHeight / 2 + poolHeight / 2, 0));
funnel.rotation.y = THREE.MathUtils.degToRad(95);
scene.add(funnel);

// --- Outtake Tray (concave, visible, below outtake, normal up, lower) ---
let outPoolRadius = 14 * 3; // 3x as big
let outPoolHeight = 4.5 * 3;
let outPoolTargetRadius = outPoolRadius;
let outPoolTargetHeight = outPoolHeight;
let outPoolCurrentRadius = outPoolRadius;
let outPoolCurrentHeight = outPoolHeight;
// Flatter tray: use a very shallow paraboloid (almost flat)
function createConcaveTrayGeometry(radius, height, segments = 32) {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const normals = [];
  const uvs = [];
  // Center vertex
  positions.push(0, 0, 0);
  normals.push(0, 1, 0);
  uvs.push(0.5, 0.5);
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    const x = Math.cos(theta) * radius;
    const z = Math.sin(theta) * radius;
    // Flatter: y = -k*(x^2 + z^2), k much smaller
    const k = height / (radius * radius * 12); // 12x shallower than before
    const y = -k * (x * x + z * z);
    positions.push(x, y, z);
    normals.push(0, 1, 0); // Approximate
    uvs.push(0.5 + 0.5 * Math.cos(theta), 0.5 + 0.5 * Math.sin(theta));
  }
  const indices = [];
  for (let i = 1; i <= segments; i++) {
    indices.push(0, i, i + 1);
  }
  geometry.setIndex(indices);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}
let outPoolGeometry = createConcaveTrayGeometry(outPoolRadius, outPoolHeight, 32);
const outPoolMaterial = new THREE.MeshStandardMaterial({ color: outPipeColor, transparent: true, opacity: 0.55, roughness: 0.45, metalness: 0.18 }); // More visible
let outPool = new THREE.Mesh(outPoolGeometry, outPoolMaterial);
outPool.renderOrder = 1;
const outPoolOutline = new THREE.Mesh(outPoolGeometry, new THREE.MeshBasicMaterial({ color: 0x222222, wireframe: true, transparent: true, opacity: 0.18 }));
outPoolOutline.renderOrder = 2;
scene.add(outPoolOutline);
const outPoolEnd = curve.getPointAt(1);
outPool.position.set(outPoolEnd.x, outPoolEnd.y - outPoolHeight * 1.7 - 7.5, outPoolEnd.z);
outPoolOutline.position.copy(outPool.position);
outPoolOutline.rotation.copy(outPool.rotation);
scene.add(outPool);

// --- Add invisible cylindrical walls to the tray ---
let trayWall = new THREE.Mesh(
  new THREE.CylinderGeometry(outPoolRadius * 0.98, outPoolRadius * 0.98, outPoolHeight * 1.2, 48, 1, true),
  new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.04, side: THREE.DoubleSide })
);
trayWall.position.copy(outPool.position);
trayWall.rotation.copy(outPool.rotation);
trayWall.renderOrder = 3;
scene.add(trayWall);

function updateExpandableOutPool() {
  // Target radius/height based on number of balls
  const baseR = 5 * 3, baseH = 2.5 * 3; // 3x as big
  const n = outPoolBalls.length;
  outPoolTargetRadius = baseR + Math.min(n, 20) * 0.18 * 3;
  outPoolTargetHeight = baseH + Math.min(n, 20) * 0.09 * 3;
  outPoolCurrentRadius += (outPoolTargetRadius - outPoolCurrentRadius) * 0.15;
  outPoolCurrentHeight += (outPoolTargetHeight - outPoolCurrentHeight) * 0.15;
  // Rebuild concave tray geometry if needed
  if (Math.abs(outPool.geometry.parameters?.radiusTop - outPoolCurrentRadius) > 0.01 ||
      Math.abs(outPool.geometry.parameters?.height - outPoolCurrentHeight) > 0.01) {
    outPool.geometry.dispose();
    outPool.geometry = createConcaveTrayGeometry(outPoolCurrentRadius, outPoolCurrentHeight, 32);
    outPool.position.set(outPoolEnd.x, outPoolEnd.y - outPoolCurrentHeight * 0.7 - 1.5, outPoolEnd.z);
    outPool.rotation.set(0, 0, 0);
    outPoolOutline.geometry.dispose();
    outPoolOutline.geometry = outPool.geometry.clone();
    outPoolOutline.position.copy(outPool.position);
    outPoolOutline.rotation.copy(outPool.rotation);
  }
  trayWall.geometry.dispose();
  trayWall.geometry = new THREE.CylinderGeometry(outPoolCurrentRadius * 0.98, outPoolCurrentRadius * 0.98, outPoolCurrentHeight * 1.2, 48, 1, true);
  trayWall.position.copy(outPool.position);
  trayWall.rotation.copy(outPool.rotation);
}

function animateFunnelUnits(delta) {
  // Drop balls through funnel with gravity and softened centripetal force
  for (let i = funnelUnits.length - 1; i >= 0; i--) {
    const unit = funnelUnits[i];
    unit.velocity.y += GRAVITY * delta;
    // Softer centripetal force toward funnel center
    const toCenter = new THREE.Vector3().subVectors(funnel.position, unit.position);
    toCenter.y = 0;
    const dist = toCenter.length();
    if (dist > 0.01) {
      toCenter.normalize();
      const centriStrength = 7 * Math.min(1, dist / funnelTopRadius); // Softer
      unit.velocity.x += toCenter.x * centriStrength * delta;
      unit.velocity.z += toCenter.z * centriStrength * delta;
    }
    // Add a small random lateral nudge for realism
    unit.velocity.x += (Math.random() - 0.5) * 0.12 * delta;
    unit.velocity.z += (Math.random() - 0.5) * 0.12 * delta;
    // Smooth entry: as ball nears funnel exit, interpolate toward center and downward
    const funnelExitY = pool.position.y + poolHeight / 2 + BALL_RADIUS + 0.2;
    if (unit.position.y < funnel.position.y - funnelHeight / 2 + 2.5) {
      unit.position.x += (funnel.position.x - unit.position.x) * 0.12;
      unit.position.z += (funnel.position.z - unit.position.z) * 0.12;
      unit.velocity.x *= 0.7;
      unit.velocity.z *= 0.7;
      if (Math.abs(unit.position.x - funnel.position.x) < 0.08 && Math.abs(unit.position.z - funnel.position.z) < 0.08) {
        unit.position.x = funnel.position.x;
        unit.position.z = funnel.position.z;
      }
    }
    // Timeout failsafe: if ball is above funnel exit for >2.5s, force drop
    unit._funnelTime = (unit._funnelTime || 0) + delta;
    if (unit.position.y > funnelExitY && unit._funnelTime > 2.5) {
      unit.position.y = funnelExitY;
      unit.velocity.y = 0;
      unit.position.x = funnel.position.x;
      unit.position.z = funnel.position.z;
    }
    // --- Fix: If unit is lingering at the funnel exit, nudge it down ---
    if (unit.position.y <= funnelExitY + 0.05 && unit.position.y > funnelExitY - 0.1) {
      unit.velocity.y -= 6 * delta; // Downward nudge
    } else {
      unit._stuckLogged = false;
    }
    unit.position.x += unit.velocity.x * delta;
    unit.position.y += unit.velocity.y * delta;
    unit.position.z += unit.velocity.z * delta;
    // Collide with pool surface
    const poolSurfaceY = pool.position.y + poolHeight / 2 + BALL_RADIUS;
    if (unit.position.y <= poolSurfaceY) {
      unit.position.y = poolSurfaceY;
      unit.velocity.y *= -BALL_RESTITUTION;
      unit.velocity.x *= BALL_FRICTION;
      unit.velocity.z *= BALL_FRICTION;
      if (Math.abs(unit.velocity.y) < 1.5) {
        unit.stage = 'pool';
        unit.colorStage = 1;
        unit.settled = true; // Ensure settled is set
        poolUnits.push(unit);
        funnelUnits.splice(i, 1);
        unit._funnelTime = 0;
        unit.material.color.copy(new THREE.Color(poolColor));
        unit.material.emissive.copy(new THREE.Color(poolColor));
      }
    }
  }
}

// --- Cluster Management ---
let clusters = [];
let clusterIdCounter = 1;

function deployUnits(count) {
  // Split into clusters of max 12 balls each
  const maxClusterSize = 12;
  let remaining = count;
  while (remaining > 0) {
    const thisClusterSize = Math.min(maxClusterSize, remaining);
    const clusterColor = new THREE.Color().setHSL(Math.random(), 0.7, 0.55);
    const cluster = {
      id: clusterIdCounter++,
      color: clusterColor.clone(),
      balls: [],
      unitT: 0,
      active: true,
      size: thisClusterSize
    };
    for (let i = 0; i < thisClusterSize; i++) {
      const mesh = createFlowUnit();
      mesh.clusterId = cluster.id;
      mesh.clusterColor = clusterColor.clone();
      mesh.material.color.copy(clusterColor);
      mesh.material.emissive.copy(clusterColor);
      // Drop from random position at top of funnel
      const angle = (i / thisClusterSize) * Math.PI * 2;
      const r = funnelTopRadius * 0.7 * (0.7 + 0.3 * Math.random());
      mesh.position.copy(funnel.position)
        .add(new THREE.Vector3(Math.cos(angle) * r, funnelHeight / 2 + 1, Math.sin(angle) * r));
      mesh.velocity = new THREE.Vector3(0, 0, 0);
      mesh.stage = 'funnel';
      mesh.colorStage = 0;
      funnelUnits.push(mesh);
      cluster.balls.push(mesh);
    }
    clusters.push(cluster);
    remaining -= thisClusterSize;
  }
}

// --- Intake: Move clusters into pipeline as a bundle ---
function animateIntake(delta) {
  // Only allow clusters that are settled in the pool to be sucked into the hose
  for (const cluster of clusters) {
    if (!cluster.active) continue;
    // Check if all balls in cluster are in pool and settled
    const ready = cluster.balls.every(b => b.stage === 'pool' && b.settled);
    if (ready && !cluster.inPipeline) {
      cluster.inPipeline = true;
      cluster.unitT = 0;
      // Remove from poolUnits, add to flowUnits
      for (const mesh of cluster.balls) {
        mesh.active = true;
        mesh.stage = 'in_flight';
        mesh.colorStage = 2;
        mesh.unitT = 0;
        mesh.settled = false;
        flowUnits.push(mesh);
        const idx = poolUnits.indexOf(mesh);
        if (idx !== -1) poolUnits.splice(idx, 1);
      }
    }
  }
}

// --- Clustered Pipeline Animation ---
// Helper: Generate packed 2D positions for n balls (hexagonal close packing)
function getPackedOffsets(n, ballRadius) {
  const offsets = [];
  if (n === 1) return [[0, 0]];
  let layer = 0, count = 0;
  const rowSpacing = ballRadius * Math.sqrt(3);
  while (count < n) {
    const numInLayer = layer === 0 ? 1 : 6 * layer;
    for (let i = 0; i < numInLayer && count < n; i++) {
      const angle = (i / numInLayer) * Math.PI * 2;
      const r = rowSpacing * layer;
      offsets.push([
        Math.cos(angle) * r,
        Math.sin(angle) * r
      ]);
      count++;
    }
    layer++;
  }
  return offsets;
}

function clusterHoseUnits() {
  // Move each cluster as a unit
  for (const cluster of clusters) {
    if (!cluster.inPipeline || (!cluster.active && !cluster.emptying)) continue;
    if (!cluster.balls || cluster.balls.length === 0) continue; // Defensive: skip empty clusters
    // If cluster is emptying, keep remaining balls at exit and drop them
    if (cluster.emptying) {
      const endPos = curve.getPointAt(1);
      for (let i = (cluster.dropIdx || 0); i < cluster.balls.length; i++) {
        const mesh = cluster.balls[i];
        if (!mesh) continue;
        mesh.position.copy(endPos);
      }
      // If all balls dropped, finish
      if ((cluster.dropIdx || 0) >= cluster.balls.length) {
        cluster.emptying = false;
        cluster.active = false;
        cluster.inPipeline = false;
      }
      continue;
    }
    // Clamp unitT to [0, 1]
    cluster.unitT = Math.max(0, Math.min(1, cluster.unitT + 0.002 * 60 * lastDelta));
    // Animate color
    for (const mesh of cluster.balls) {
      if (!mesh) continue; // Defensive: skip undefined meshes
      mesh.unitT = cluster.unitT;
      mesh.material.color.copy(cluster.color);
      mesh.material.emissive.copy(cluster.color);
      mesh.colorStage = 2; // In-pipe (yellow)
    }
    // Packed cluster: arrange balls in a 2D hex grid inside the hose cross-section
    let center, tangent;
    try {
      center = curve.getPointAt(cluster.unitT);
      tangent = curve.getTangentAt(cluster.unitT);
    } catch (e) {
      continue; // Defensive: skip if curve lookup fails
    }
    const normal = new THREE.Vector3(0, 1, 0).cross(tangent).normalize();
    const binormal = tangent.clone().cross(normal).normalize();
    // Compute packed offsets
    const offsets = getPackedOffsets(cluster.balls.length, BALL_RADIUS);
    // Compute required bulge radius to fit all balls
    let maxR = 0;
    for (const [x, y] of offsets) {
      maxR = Math.max(maxR, Math.sqrt(x * x + y * y) + BALL_RADIUS);
    }
    cluster._packedRadius = maxR; // Store for bulge logic
    for (let i = 0; i < cluster.balls.length; i++) {
      const mesh = cluster.balls[i];
      if (!mesh) continue;
      const [x, y] = offsets[i];
      // Place each ball in the packed grid, always inside the hose
      const offset = normal.clone().multiplyScalar(x).add(binormal.clone().multiplyScalar(y));
      mesh.position.copy(center.clone().add(offset));
    }
    // Unbundle at the end (as before)
    if (cluster.unitT >= 1 && cluster.active && !cluster.emptying) {
      cluster.emptying = true;
      cluster.dropIdx = 0;
      function dropNextBall() {
        if (cluster.dropIdx >= cluster.balls.length) return;
        const mesh = cluster.balls[cluster.dropIdx];
        if (mesh) {
          mesh.active = false;
          mesh.stage = 'out_pit';
          mesh.colorStage = 3; // Orange
          // Place at the hose tip (pipeline exit)
          const endPos = curve.getPointAt(1);
          const tangent = curve.getTangentAt(1).clone().normalize();
          // Offset slightly along tangent to avoid overlap
          const offset = tangent.clone().multiplyScalar(BALL_RADIUS * 1.2 + Math.random() * BALL_RADIUS * 0.3);
          mesh.position.copy(endPos.clone().add(offset));
          // Set velocity along tangent, plus a small random component
          const tangentSpeed = 8 + Math.random() * 4; // 8-12 units/sec
          const randomVec = new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2
          ).multiplyScalar(0.7);
          mesh.velocity.copy(tangent.clone().multiplyScalar(tangentSpeed)).add(randomVec);
          // Add random spin
          mesh.rotationSpeed = new THREE.Vector3(
            (Math.random() - 0.5) * 4,
            (Math.random() - 0.5) * 4,
            (Math.random() - 0.5) * 4
          );
          mesh._dropStartY = mesh.position.y; // For failsafe
          mesh._dropStartTime = performance.now();
          mesh.droppedAt = performance.now(); // Always set droppedAt for every dropped ball
          mesh.settled = false;
          mesh.restTimer = 0;
          outPoolBalls.push(mesh);
          // Remove from flowUnits
          const idx = flowUnits.indexOf(mesh);
          if (idx !== -1) flowUnits.splice(idx, 1);
          mesh.droppedAt = performance.now();
          totalProcessedBallCount++;
        }
        cluster.dropIdx++;
        setTimeout(dropNextBall, 40); // Stagger drop by 40ms
      }
      dropNextBall();
      // Failsafe: after 1s, force-drop any remaining balls
      setTimeout(() => {
        for (let i = cluster.dropIdx; i < cluster.balls.length; i++) {
          const mesh = cluster.balls[i];
          if (mesh && mesh.stage !== 'out_pit') {
            mesh.active = false;
            mesh.stage = 'out_pit';
            mesh.colorStage = 3; // Orange
            const endPos = curve.getPointAt(1);
            const tangent = curve.getTangentAt(1).clone().normalize();
            const offset = tangent.clone().multiplyScalar(BALL_RADIUS * 1.2 + Math.random() * BALL_RADIUS * 0.3);
            mesh.position.copy(endPos.clone().add(offset));
            const tangentSpeed = 8 + Math.random() * 4;
            const randomVec = new THREE.Vector3(
              (Math.random() - 0.5) * 2,
              (Math.random() - 0.5) * 2,
              (Math.random() - 0.5) * 2
            ).multiplyScalar(0.7);
            mesh.velocity.copy(tangent.clone().multiplyScalar(tangentSpeed)).add(randomVec);
            mesh.settled = false;
            outPoolBalls.push(mesh);
            const idx = flowUnits.indexOf(mesh);
            if (idx !== -1) flowUnits.splice(idx, 1);
          }
        }
        cluster.emptying = false;
        cluster.active = false;
        cluster.inPipeline = false;
      }, 1000);
    }
  }
}

// --- Bulge: Use Cluster Properties ---
function updateHoseBulge(units) {
  // Bulge is based on cluster position and size
  const posAttr = tubeGeometry.attributes.position;
  const frames = curve.computeFrenetFrames(segments, false);
  for (let i = 0; i <= segments; i++) {
    const segT = i / segments;
    const center = curve.getPointAt(segT);
    const normal = frames.normals[i];
    const binormal = frames.binormals[i];
    // Find clusters near this segment
    let bulgeSum = 0;
    for (const cluster of clusters) {
      if (!cluster.inPipeline || !cluster.active) continue;
      const dist = Math.abs(segT - cluster.unitT);
      // Use the packed radius for this cluster
      const bulgeWidth = 0.035; // Fixed, small width
      if (dist < bulgeWidth) {
        // Sharper falloff
        const falloff = Math.exp(-Math.pow(dist / bulgeWidth, 2) * 8);
        // The bulge must be at least large enough to fit the packed cluster
        const minBulge = Math.max(0.10, (cluster._packedRadius || BALL_RADIUS * 1.2) - baseRadius);
        bulgeSum += minBulge * falloff;
      }
    }
    // Clamp the max bulge to avoid mesh breakage
    const maxBulge = 2.5 * bulgeIntensity; // Make max bulge scale with slider
    const targetRadius = baseRadius + Math.min(bulgeSum * bulgeIntensity, maxBulge); // Multiply bulgeSum by bulgeIntensity
    // Elastic interpolation
    hoseCurrentRadii[i] += (targetRadius - hoseCurrentRadii[i]) * 0.18; // 0.18 = elasticity factor
    for (let j = 0; j < 16; j++) {
      const angle = (j / 16) * Math.PI * 2;
      const radial = normal.clone().multiplyScalar(Math.cos(angle)).add(binormal.clone().multiplyScalar(Math.sin(angle)));
      const vertex = center.clone().add(radial.multiplyScalar(hoseCurrentRadii[i]));
      const idx = i * 16 + j;
      posAttr.setX(idx, vertex.x);
      posAttr.setY(idx, vertex.y);
      posAttr.setZ(idx, vertex.z);
    }
  }
  posAttr.needsUpdate = true;
}

// --- Unit Deployment Interval Logic ---
let deployInterval = null;
function setUIEnabled(enabled) {
  input.disabled = !enabled;
  intervalInput.disabled = !enabled;
  button.disabled = !enabled;
  stopButton.style.display = enabled ? 'none' : 'inline-block';
}

button.addEventListener('click', () => {
  let count = parseInt(input.value, 10);
  if (isNaN(count) || count < 1) count = 1;
  if (count > 100) count = 100;
  let intervalSec = parseInt(intervalInput.value, 10);
  if (isNaN(intervalSec) || intervalSec < 1) intervalSec = 1;
  setUIEnabled(false);
  deployUnits(count);
  deployInterval = setInterval(() => {
    deployUnits(count);
  }, intervalSec * 1000);
});

stopButton.addEventListener('click', () => {
  if (deployInterval) {
    clearInterval(deployInterval);
    deployInterval = null;
  }
  setUIEnabled(true);
});

let simSpeed = 1.0;
// --- Animation Loop (with pause support) ---
let lastTime = performance.now();
let lastDelta = 0.016;
function animate() {
  requestAnimationFrame(animate);
  if (animationPaused) return;
  controls.update();
  const now = performance.now();
  let delta = Math.min((now - lastTime) / 1000, 0.1); // seconds
  delta *= simSpeed;
  lastTime = now;
  lastDelta = delta;
  updateCameraControls(delta);
  animateFunnelUnits(delta); // Added to update balls in the funnel
  animatePoolBalls(delta, poolUnits, pool, poolColor); // Added to update pool balls so clusters can enter pipeline
  animateIntake(delta);
  clusterHoseUnits();
  animatePoolBalls(delta, outPoolBalls, outPool, outPipeColor); // Animate balls in the tray
  updateHoseBulge(flowUnits);
  renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Camera: Start at user-provided position and lookAt ---
function setCameraToTrayView() {
  camera.position.set(109.16058890116071, -26.19117071758837, 8.737296216050266);
  camera.lookAt(108.1911186916251, -25.958563326778542, 8.659699086183016);
  camera.up.set(0, 1, 0);
}
setCameraToTrayView();

// --- Git Link and Title Banner ---
const gitLink = document.createElement('a');
gitLink.href = 'https://github.com/Photon1c/Flowveyor/tree/main/threejspipeline';
gitLink.innerText = 'Git';
gitLink.target = '_blank';
gitLink.style.position = 'absolute';
gitLink.style.top = '12px';
gitLink.style.right = '12px';
gitLink.style.zIndex = '100';
gitLink.style.fontSize = '1.2em';
gitLink.style.fontWeight = 'bold';
gitLink.style.color = '#fff';
gitLink.style.background = 'rgba(30,40,60,0.92)';
gitLink.style.padding = '6px 16px';
gitLink.style.borderRadius = '8px';
gitLink.style.textDecoration = 'none';
gitLink.style.boxShadow = '0 2px 8px #0006';
document.body.appendChild(gitLink);

const titleBanner = document.createElement('div');
titleBanner.innerText = 'Pipeline Sim';
titleBanner.style.position = 'absolute';
titleBanner.style.top = '48px';
titleBanner.style.right = '12px';
titleBanner.style.zIndex = '99';
titleBanner.style.fontSize = '2.1em';
titleBanner.style.fontWeight = 'bold';
titleBanner.style.color = '#fff';
titleBanner.style.background = 'rgba(30,40,60,0.92)';
titleBanner.style.padding = '10px 32px';
titleBanner.style.borderRadius = '12px';
titleBanner.style.boxShadow = '0 2px 12px #0008';
titleBanner.style.transition = 'opacity 1.2s';
document.body.appendChild(titleBanner);

// --- Processed Counter ---
const processedCounter = document.createElement('div');
processedCounter.innerText = 'Processed: 0';
processedCounter.style.position = 'absolute';
processedCounter.style.top = '90px';
processedCounter.style.right = '12px';
processedCounter.style.zIndex = '100';
processedCounter.style.fontSize = '1.3em';
processedCounter.style.fontWeight = 'bold';
processedCounter.style.color = '#fff';
processedCounter.style.background = 'rgba(30,40,60,0.92)';
processedCounter.style.padding = '6px 24px';
processedCounter.style.borderRadius = '8px';
processedCounter.style.boxShadow = '0 2px 8px #0006';
processedCounter.style.display = 'none'; // Hide initially

document.body.appendChild(processedCounter);

async function updateProcessedCounter() {
  try {
    const resp = await fetch('http://localhost:5001/output/ball_count.csv?_=' + Date.now());
    if (!resp.ok) {
      processedCounter.innerText = 'Processed: 0';
      return;
    }
    const text = await resp.text();
    // Get last non-empty line
    const lines = text.trim().split('\n').filter(l => l.trim());
    const last = lines[lines.length - 1];
    const parts = last.split(',');
    const count = parts[1] ? parseInt(parts[1], 10) : 0;
    processedCounter.innerText = 'Processed: ' + count;
  } catch (e) {
    processedCounter.innerText = 'Processed: 0';
  }
}
setInterval(updateProcessedCounter, 30000);
updateProcessedCounter();

setTimeout(() => {
  titleBanner.style.opacity = '0';
  setTimeout(() => {
    titleBanner.style.display = 'none';
    processedCounter.style.display = 'block'; // Show processed counter after title hides
  }, 1200);
}, 15000);

// --- Auto Toggle Switch ---
const autoToggleLabel = document.createElement('label');
autoToggleLabel.innerText = 'Auto:';
autoToggleLabel.style.fontSize = '1.1em';
autoToggleLabel.style.marginTop = '8px';
autoToggleLabel.style.display = 'flex';
autoToggleLabel.style.alignItems = 'center';
const autoToggle = document.createElement('input');
autoToggle.type = 'checkbox';
autoToggle.checked = true;
autoToggle.style.marginLeft = '8px';
autoToggleLabel.appendChild(autoToggle);
// --- Sphere/Cube Dropdown ---
const shapeSelect = document.createElement('select');
shapeSelect.style.marginLeft = '12px';
const sphereOption = document.createElement('option');
sphereOption.value = 'sphere';
sphereOption.text = 'Sphere';
const cubeOption = document.createElement('option');
cubeOption.value = 'cube';
cubeOption.text = 'Cube';
shapeSelect.appendChild(sphereOption);
shapeSelect.appendChild(cubeOption);
shapeSelect.value = 'sphere';
autoToggleLabel.appendChild(shapeSelect);
shapeSelect.onchange = () => {
  unitShape = shapeSelect.value;
  unitGeometry = (unitShape === 'cube') ? unitCubeGeometry : unitSphereGeometry;
};
statsPanel.insertBefore(autoToggleLabel, statsPanel.firstChild);
let autoDeploy = true;
autoToggle.onchange = () => {
  autoDeploy = autoToggle.checked;
  if (autoDeploy && !deployInterval) {
    startAutoDeploy();
  } else if (!autoDeploy && deployInterval) {
    clearInterval(deployInterval);
    deployInterval = null;
    setUIEnabled(true);
  }
};
function startAutoDeploy() {
  let count = parseInt(input.value, 10);
  if (isNaN(count) || count < 1) count = 1;
  if (count > 100) count = 100;
  let intervalSec = parseInt(intervalInput.value, 10);
  if (isNaN(intervalSec) || intervalSec < 1) intervalSec = 1;
  setUIEnabled(false);
  deployUnits(count);
  deployInterval = setInterval(() => {
    if (!autoDeploy) return;
    deployUnits(count);
  }, intervalSec * 1000);
}
window.addEventListener('DOMContentLoaded', () => {
  if (autoToggle.checked) startAutoDeploy();
});

// --- Sim Speed Slider ---
const simSpeedLabel = document.createElement('label');
simSpeedLabel.innerText = 'Sim Speed:';
simSpeedLabel.style.fontSize = '1.1em';
simSpeedLabel.style.marginTop = '8px';
const simSpeedSlider = document.createElement('input');
simSpeedSlider.type = 'range';
simSpeedSlider.min = '0.1';
simSpeedSlider.max = '3.0';
simSpeedSlider.step = '0.01';
simSpeedSlider.value = '1.0';
simSpeedSlider.style.width = '120px';
simSpeedSlider.style.marginLeft = '10px';
const simSpeedValue = document.createElement('span');
simSpeedValue.innerText = simSpeedSlider.value;
simSpeedValue.style.marginLeft = '8px';
simSpeedSlider.oninput = () => { simSpeedValue.innerText = simSpeedSlider.value; };
simSpeedLabel.appendChild(simSpeedSlider);
simSpeedLabel.appendChild(simSpeedValue);
statsPanel.appendChild(simSpeedLabel);
simSpeedSlider.addEventListener('input', () => {
  simSpeed = parseFloat(simSpeedSlider.value);
});

// --- Compact overlay: controls in a single line ---
input.style.display = 'inline-block';
intervalLabel.style.display = 'inline-block';
intervalInput.style.display = 'inline-block';
secondsLabel.style.display = 'inline-block';
button.style.display = 'inline-block';
stopButton.style.display = 'inline-block';
const controlsRow = document.createElement('div');
controlsRow.style.display = 'flex';
controlsRow.style.flexDirection = 'row';
controlsRow.style.alignItems = 'center';
controlsRow.style.gap = '8px';
controlsRow.appendChild(input);
controlsRow.appendChild(intervalLabel);
controlsRow.appendChild(intervalInput);
controlsRow.appendChild(secondsLabel);
controlsRow.appendChild(button);
controlsRow.appendChild(stopButton);
statsPanel.insertBefore(controlsRow, statsPanel.querySelector('label')?.nextSibling || statsPanel.firstChild);
// Remove old controls from statsPanel
[input, intervalLabel, intervalInput, secondsLabel, button, stopButton].forEach(el => {
  if (el.parentNode === statsPanel) statsPanel.removeChild(el);
});

// --- Move Git Link and Title Banner to top right ---
gitLink.style.left = '';
gitLink.style.right = '12px';
titleBanner.style.left = '';
titleBanner.style.right = '12px';

// --- Resizable stats panel ---
statsPanel.style.resize = 'both';
statsPanel.style.overflow = 'auto';
const resizeHandle = document.createElement('div');
resizeHandle.style.position = 'absolute';
resizeHandle.style.right = '2px';
resizeHandle.style.bottom = '2px';
resizeHandle.style.width = '18px';
resizeHandle.style.height = '18px';
resizeHandle.style.cursor = 'nwse-resize';
resizeHandle.style.background = 'rgba(255,255,255,0.08)';
resizeHandle.style.borderRadius = '4px';
resizeHandle.style.zIndex = '120';
statsPanel.appendChild(resizeHandle);

// --- Repulsion Strength Slider ---
const repulsionLabel = document.createElement('label');
repulsionLabel.innerText = 'Repulsion:';
repulsionLabel.style.fontSize = '1.1em';
repulsionLabel.style.marginTop = '8px';
const repulsionSlider = document.createElement('input');
repulsionSlider.type = 'range';
repulsionSlider.min = '0.01';
repulsionSlider.max = '0.5';
repulsionSlider.step = '0.01';
repulsionSlider.value = '0.18';
repulsionSlider.style.width = '120px';
repulsionSlider.style.marginLeft = '10px';
const repulsionValue = document.createElement('span');
repulsionValue.innerText = repulsionSlider.value;
repulsionValue.style.marginLeft = '8px';
repulsionSlider.oninput = () => { repulsionValue.innerText = repulsionSlider.value; };
repulsionLabel.appendChild(repulsionSlider);
repulsionLabel.appendChild(repulsionValue);
statsPanel.appendChild(repulsionLabel);
let userRepulsionStrength = parseFloat(repulsionSlider.value);
repulsionSlider.addEventListener('input', () => {
  userRepulsionStrength = parseFloat(repulsionSlider.value);
});

// --- Make dropped balls less doughy (tray physics) ---
function animatePoolBalls(delta, balls, poolMesh, color, yOffset = 0) {
  // Simple ball-pit physics: gravity, floor, and ball-ball collisions
  for (let i = 0; i < balls.length; i++) {
    const ball = balls[i];
    // --- Only apply simplified physics for outPool (tray) ---
    if (poolMesh === outPool) {
      // Gravity
      ball.velocity.y += GRAVITY * delta;
      // Random jitter to break symmetry
      ball.velocity.x += (Math.random() - 0.5) * 0.08 * delta;
      ball.velocity.z += (Math.random() - 0.5) * 0.08 * delta;
      // Air resistance
      ball.velocity.x *= 0.98;
      ball.velocity.y *= 0.995;
      ball.velocity.z *= 0.98;
      // Clamp velocities for stability
      ball.velocity.x = Math.max(-4, Math.min(4, ball.velocity.x));
      ball.velocity.y = Math.max(-12, Math.min(12, ball.velocity.y));
      ball.velocity.z = Math.max(-4, Math.min(4, ball.velocity.z));
      // Update position
      ball.position.x += ball.velocity.x * delta;
      ball.position.y += ball.velocity.y * delta;
      ball.position.z += ball.velocity.z * delta;
      // Floor collision: clamp to tray floor
      const floorY = poolMesh.position.y - poolHeight / 2 + BALL_RADIUS + yOffset;
      if (ball.position.y < floorY) {
        ball.position.y = floorY;
        ball.velocity.y = 0;
      }
      // Wall collision: clamp to tray radius
      const rel = new THREE.Vector3().subVectors(ball.position, poolMesh.position);
      const r = Math.sqrt(rel.x * rel.x + rel.z * rel.z);
      const wallR = outPoolCurrentRadius * 0.98 - BALL_RADIUS;
      if (r > wallR) {
        const nx = rel.x / r;
        const nz = rel.z / r;
        ball.position.x = poolMesh.position.x + nx * wallR;
        ball.position.z = poolMesh.position.z + nz * wallR;
        ball.velocity.x *= -0.22;
        ball.velocity.z *= -0.22;
      }
      // Ball-ball collision: simple elastic push apart
      for (let j = i + 1; j < balls.length; j++) {
        const other = balls[j];
        const dx = ball.position.x - other.position.x;
        const dz = ball.position.z - other.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < 2 * BALL_RADIUS - 0.01) {
          // Push apart
          const overlap = 2 * BALL_RADIUS - dist;
          const nx = dx / (dist || 1e-6);
          const nz = dz / (dist || 1e-6);
          ball.position.x += nx * overlap / 2;
          ball.position.z += nz * overlap / 2;
          other.position.x -= nx * overlap / 2;
          other.position.z -= nz * overlap / 2;
          // Exchange velocity (simple elastic)
          const v1 = ball.velocity.x * nx + ball.velocity.z * nz;
          const v2 = other.velocity.x * nx + other.velocity.z * nz;
          const m1 = 1, m2 = 1;
          const newV1 = ((m1 - m2) * v1 + 2 * m2 * v2) / (m1 + m2);
          const newV2 = ((m2 - m1) * v2 + 2 * m1 * v1) / (m1 + m2);
          ball.velocity.x += (newV1 - v1) * 0.5;
          ball.velocity.z += (newV1 - v1) * 0.5;
          other.velocity.x += (newV2 - v2) * 0.5;
          other.velocity.z += (newV2 - v2) * 0.5;
        }
      }
      // Animate rotation for outPoolBalls
      if (ball.rotationSpeed) {
        ball.rotation.x += ball.rotationSpeed.x * delta;
        ball.rotation.y += ball.rotationSpeed.y * delta;
        ball.rotation.z += ball.rotationSpeed.z * delta;
      }
      // Color by phase
      let phaseColor = color;
      if (ball.colorStage === 0) phaseColor = funnelColor;
      else if (ball.colorStage === 1) phaseColor = poolColor;
      else if (ball.colorStage === 2) phaseColor = inPipeColor;
      else if (ball.colorStage === 3) phaseColor = outPipeColor;
      ball.material.color.set(phaseColor);
      ball.material.emissive.set(phaseColor);
      continue; // Skip the rest of the loop for outPool balls
    }
    // --- Existing code for pool balls ---
    // If settled, but velocity is high, unsettle (fluid agitation)
    if (poolMesh === outPool && ball.settled) {
      const v2 = ball.velocity.x * ball.velocity.x + ball.velocity.y * ball.velocity.y + ball.velocity.z * ball.velocity.z;
      if (v2 > 0.12) ball.settled = false;
    }
    if (ball.settled) continue;
    ball.velocity.y += GRAVITY * delta;
    // Air resistance for outPoolBalls
    if (poolMesh === outPool) {
      ball.velocity.y *= 0.995;
      ball.velocity.x *= 0.98;
      ball.velocity.z *= 0.98;
      // Clamp velocities for stability
      ball.velocity.x = Math.max(-4, Math.min(4, ball.velocity.x));
      ball.velocity.y = Math.max(-12, Math.min(12, ball.velocity.y));
      ball.velocity.z = Math.max(-4, Math.min(4, ball.velocity.z));
    }
    ball.position.y += ball.velocity.y * delta;
    ball.position.x += ball.velocity.x * delta;
    ball.position.z += ball.velocity.z * delta;
    // Collide with pool floor
    const floorY = poolMesh.position.y - poolHeight / 2 + BALL_RADIUS + yOffset;
    const now = performance.now();
    if (poolMesh === outPool && ball.droppedAt && now - ball.droppedAt < 400) {
      // Let it fall for 400ms before clamping or bouncing
      // Optional: tint color for debugging
      // ball.material.color.set(0x00ffcc); // Uncomment for visible effect
    } else if (ball.position.y < floorY) {
      // If below floor, pop up and bounce
      ball.position.y = floorY;
      if (Math.abs(ball.velocity.y) > 0.2) {
        ball.velocity.y *= -0.45 - Math.random() * 0.15; // Bounce, slightly randomized
        // Optional: cartoon squash/stretch on impact
        /*
        if (poolMesh === outPool) {
          ball.scale.y = 0.7 + Math.random() * 0.2;
          ball.scale.x = ball.scale.z = 1.2 + Math.random() * 0.2;
          setTimeout(() => {
            ball.scale.set(1, 1, 1);
          }, 120);
        }
        */
      } else {
        ball.velocity.y = 0;
        // Friction: reduce lateral velocity
        ball.velocity.x *= 0.7;
        ball.velocity.z *= 0.7;
        // Only settle if all velocities are low
        if (Math.abs(ball.velocity.x) < 0.08 && Math.abs(ball.velocity.z) < 0.08) {
          ball.settled = true;
        }
      }
    }
    // Collide with pool walls
    const rel = new THREE.Vector3().subVectors(ball.position, poolMesh.position);
    const r = Math.sqrt(rel.x * rel.x + rel.z * rel.z);
    if (r > poolRadius - BALL_RADIUS) {
      const nx = rel.x / r;
      const nz = rel.z / r;
      ball.position.x = poolMesh.position.x + nx * (poolRadius - BALL_RADIUS);
      ball.position.z = poolMesh.position.z + nz * (poolRadius - BALL_RADIUS);
      ball.velocity.x *= -0.18;
      ball.velocity.z *= -0.18;
    }
    // Collide with tray walls (for outPool)
    if (poolMesh === outPool) {
      const rel = new THREE.Vector3().subVectors(ball.position, poolMesh.position);
      const r = Math.sqrt(rel.x * rel.x + rel.z * rel.z);
      const wallR = outPoolCurrentRadius * 0.98 - BALL_RADIUS;
      if (r > wallR) {
        const nx = rel.x / r;
        const nz = rel.z / r;
        ball.position.x = poolMesh.position.x + nx * wallR;
        ball.position.z = poolMesh.position.z + nz * wallR;
        ball.velocity.x *= -0.22;
        ball.velocity.z *= -0.22;
      }
    }
    // --- Fluid-inspired: much stronger neighbor repulsion for outPoolBalls ---
    if (poolMesh === outPool) {
      for (let j = 0; j < balls.length; j++) {
        if (i === j) continue;
        const other = balls[j];
        const dx = ball.position.x - other.position.x;
        const dy = ball.position.y - other.position.y;
        const dz = ball.position.z - other.position.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        // Skip repulsion for first 0.5s after drop
        if (ball.droppedAt && now - ball.droppedAt < 500) continue;
        let repulseStrength = 0.22; // much stronger
        if (ball.droppedAt && now - ball.droppedAt > 2000) repulseStrength = userRepulsionStrength * 2.2;
        if (dist > 0 && dist < 4.2 * BALL_RADIUS) {
          const repulse = (4.2 * BALL_RADIUS - dist) * repulseStrength;
          // Add random jitter to break symmetry
          const jitter = (Math.random() - 0.5) * 0.08;
          ball.velocity.x += (dx / dist) * repulse * delta + jitter;
          ball.velocity.y += (dy / dist) * repulse * delta;
          ball.velocity.z += (dz / dist) * repulse * delta + jitter;
          ball.velocity.x *= 0.94;
          ball.velocity.y *= 0.94;
          ball.velocity.z *= 0.94;
        }
      }
    }
    // Ball-ball collisions
    for (let j = i + 1; j < balls.length; j++) {
      const other = balls[j];
      const dx = ball.position.x - other.position.x;
      const dz = ball.position.z - other.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 2 * BALL_RADIUS - 0.01) {
        // Push apart
        const overlap = 2 * BALL_RADIUS - dist;
        const nx = dx / (dist || 1e-6);
        const nz = dz / (dist || 1e-6);
        ball.position.x += nx * overlap / 2;
        ball.position.z += nz * overlap / 2;
        other.position.x -= nx * overlap / 2;
        other.position.z -= nz * overlap / 2;
        // Exchange velocity (simple elastic)
        const v1 = ball.velocity.x * nx + ball.velocity.z * nz;
        const v2 = other.velocity.x * nx + other.velocity.z * nz;
        const m1 = 1, m2 = 1;
        const newV1 = ((m1 - m2) * v1 + 2 * m2 * v2) / (m1 + m2);
        const newV2 = ((m2 - m1) * v2 + 2 * m1 * v1) / (m1 + m2);
        ball.velocity.x += (newV1 - v1) * 0.5;
        ball.velocity.z += (newV1 - v1) * 0.5;
        other.velocity.x += (newV2 - v2) * 0.5;
        other.velocity.z += (newV2 - v2) * 0.5;
        // Add random rotation
        if (ball.rotationSpeed) {
          ball.rotationSpeed.x += (Math.random() - 0.5) * 0.8;
          ball.rotationSpeed.y += (Math.random() - 0.5) * 0.8;
          ball.rotationSpeed.z += (Math.random() - 0.5) * 0.8;
        }
        if (other.rotationSpeed) {
          other.rotationSpeed.x += (Math.random() - 0.5) * 0.8;
          other.rotationSpeed.y += (Math.random() - 0.5) * 0.8;
          other.rotationSpeed.z += (Math.random() - 0.5) * 0.8;
        }
      }
    }
    // Color by phase
    let phaseColor = color;
    if (ball.colorStage === 0) phaseColor = funnelColor;
    else if (ball.colorStage === 1) phaseColor = poolColor;
    else if (ball.colorStage === 2) phaseColor = inPipeColor;
    else if (ball.colorStage === 3) phaseColor = outPipeColor;
    ball.material.color.set(phaseColor);
    ball.material.emissive.set(phaseColor);
    // Animate rotation for outPoolBalls
    if (poolMesh === outPool && ball.rotationSpeed) {
      ball.rotation.x += ball.rotationSpeed.x * delta;
      ball.rotation.y += ball.rotationSpeed.y * delta;
      ball.rotation.z += ball.rotationSpeed.z * delta;
    }
  }
}

// --- Analytics: Track total processed ball count and send to backend every 30s ---
let totalProcessedBallCount = 0;
function sendBallCountToBackend() {
  fetch('http://localhost:5001/log_ball_count', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ count: totalProcessedBallCount })
  }).then(r => r.json()).then(data => {
    // Optionally log success
    // console.log('Ball count sent:', data);
  }).catch(err => {
    console.warn('Failed to send ball count:', err);
  });
}
setInterval(sendBallCountToBackend, 30000);

// --- Camera debug: Print camera position and lookAt on '/' key ---
window.addEventListener('keydown', (e) => {
  if (e.key === '/') {
    const pos = camera.position;
    // Try to infer lookAt from camera direction
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const lookAt = pos.clone().add(dir);
  }
});

