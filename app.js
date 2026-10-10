// ==========================================
// 1. CONFIGURATION
// ==========================================
// Paste your shareable Teachable Machine URL here (must end with '/')
const MODEL_URL = "https://teachablemachine.withgoogle.com/models/z0uplTCmq/";
const OLLAMA_ENDPOINT = "http://localhost:11434/api/generate";
const CONFIDENCE_THRESHOLD = 0.80;
const ROTATION_SPEED = 0.05;

// ==========================================
// 2. THREE.JS (3D VIEWPORT SETUP)
// ==========================================
const viewport = document.getElementById("viewport");
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  75,
  viewport.clientWidth / viewport.clientHeight,
  0.1,
  1000
);
camera.position.z = 4;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(viewport.clientWidth, viewport.clientHeight);
viewport.appendChild(renderer.domElement);

// Add lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const pointLight = new THREE.PointLight(0x61afef, 1.2);
pointLight.position.set(5, 5, 5);
scene.add(pointLight);

// 3D Geometry (Wireframe Cube)
const geometry = new THREE.BoxGeometry(2, 2, 2);
const material = new THREE.MeshNormalMaterial({ wireframe: false });
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

// Resize handler
window.addEventListener("resize", () => {
  camera.aspect = viewport.clientWidth / viewport.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(viewport.clientWidth, viewport.clientHeight);
});

// Render Loop
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();

// Gesture transformation handler
function applyGestureTransformation(gesture) {
  switch (gesture) {
    case "UP":
      cube.rotation.x -= ROTATION_SPEED;
      break;
    case "DOWN":
      cube.rotation.x += ROTATION_SPEED;
      break;
    case "LEFT":
      cube.rotation.y -= ROTATION_SPEED;
      break;
    case "RIGHT":
      cube.rotation.y += ROTATION_SPEED;
      break;
    default:
      // Neutral / Idle
      break;
  }
}

// ==========================================
// 3. TEACHABLE MACHINE INFERENCE
// ==========================================
let model = null;
let webcam = null;
let maxPredictions = 0;

const startBtn = document.getElementById("start-btn");
const statusLabel = document.getElementById("status");
const webcamContainer = document.getElementById("webcam-container");

startBtn.addEventListener("click", initVisionModel);

async function initVisionModel() {
  startBtn.disabled = true;
  statusLabel.innerText = "Loading model...";

  try {
    model = await tmImage.load(MODEL_URL + "model.json", MODEL_URL + "metadata.json");
    maxPredictions = model.getTotalClasses();

    webcam = new tmImage.Webcam(200, 200, true);
    await webcam.setup();
    await webcam.play();

    webcamContainer.innerHTML = "";
    webcamContainer.appendChild(webcam.canvas);

    statusLabel.innerText = "Tracking active";
    window.requestAnimationFrame(visionLoop);
  } catch (err) {
    console.error(err);
    statusLabel.innerText = "Failed to load model";
    startBtn.disabled = false;
  }
}

async function visionLoop() {
  webcam.update();
  await predictFrame();
  window.requestAnimationFrame(visionLoop);
}

async function predictFrame() {
  if (!model || !webcam) return;

  const predictions = await model.predict(webcam.canvas);
  let bestMatch = predictions[0];

  for (let i = 1; i < maxPredictions; i++) {
    if (predictions[i].probability > bestMatch.probability) {
      bestMatch = predictions[i];
    }
  }

  const label = bestMatch.className.toUpperCase();
  const confidence = bestMatch.probability;

  if (confidence >= CONFIDENCE_THRESHOLD) {
    statusLabel.innerText = `${label} (${Math.round(confidence * 100)}%)`;
    applyGestureTransformation(label);
  } else {
    statusLabel.innerText = "Idle";
  }
}

// ==========================================
// 4. OLLAMA API CHAT
// ==========================================
const chatBox = document.getElementById("chat-box");
const promptInput = document.getElementById("prompt-input");
const sendBtn = document.getElementById("send-btn");

sendBtn.addEventListener("click", handleChatSubmit);
promptInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleChatSubmit();
});

function appendMessage(text, type) {
  const msgEl = document.createElement("div");
  msgEl.className = `msg msg-${type}`;
  msgEl.innerText = text;
  chatBox.appendChild(msgEl);
  chatBox.scrollTop = chatBox.scrollHeight;
  return msgEl;
}

async function handleChatSubmit() {
  const text = promptInput.value.trim();
  if (!text) return;

  appendMessage(text, "user");
  promptInput.value = "";

  const loadingMsg = appendMessage("Thinking...", "system");

  try {
    const res = await fetch(OLLAMA_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3.2",
        prompt: `You are an AI assistant helping a user inspect a 3D model. Be brief and concise. User prompt: ${text}`,
        stream: false,
      }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    loadingMsg.remove();
    appendMessage(data.response, "ai");
  } catch (error) {
    loadingMsg.remove();
    appendMessage("Error: Could not reach Ollama. Check terminal and CORS settings.", "system");
  }
}