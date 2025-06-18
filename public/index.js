let krpano = null;
let scene, camera, renderer, cube;
let isDragging = false;
let previousMouseX = 0;
let previousMouseY = 0;
let isApplyingView = false;
let isUpdatingCubeFromKrpano = false;
let isUpdatingKrpanoFromCube = false;

const inputFocusState = {
  hlookat: false,
  vlookat: false,
  fov: false,
};

function setupInputFocusTracking() {
  ["hlookat", "vlookat", "fov"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("focus", () => (inputFocusState[id] = true));
      el.addEventListener("blur", () => (inputFocusState[id] = false));
      el.addEventListener("change", () => applyCameraView());
      el.addEventListener("keypress", (e) => {
        if (e.key === "Enter") applyCameraView();
      });
    } else {
      console.warn(`Input element with ID "${id}" not found.`);
    }
  });
}

function krpano_onready(krpano_interface) {
  krpano = krpano_interface;
  console.log("krpano is ready!");
  if (krpano) {
    const hlookat = krpano.get("view.hlookat") || 0;
    const vlookat = krpano.get("view.vlookat") || 0;
    const fov = krpano.get("view.fov") || 90;
    const hlookatEl = document.getElementById("hlookat");
    const vlookatEl = document.getElementById("vlookat");
    const fovEl = document.getElementById("fov");
    if (hlookatEl)
      hlookatEl.value = Math.max(-180, Math.min(180, hlookat)).toFixed(2);
    if (vlookatEl)
      vlookatEl.value = Math.max(-180, Math.min(180, vlookat)).toFixed(2);
    if (fovEl) fovEl.value = Math.max(10, Math.min(140, fov)).toFixed(2);
    krpano.set("events.onviewchange", "js(updateCubeFromKrpano());");
    updateCubeFromKrpano();
  } else {
    console.error("krpano interface not properly initialized.");
  }
}

function embedKrpanoWithFallback() {
  try {
    embedpano({
      swf: "../tour.swf",
      xml: "../tour.xml",
      target: "pano",
      html5: "auto",
      onready: krpano_onready,
      onerror: (error) => console.error("krpano embedding failed:", error),
    });
  } catch (e) {
    console.error("Failed to embed krpano:", e);
  }
}

function applyCameraView(hlookat, vlookat, fov, tweenTime) {
  if (!krpano) {
    console.error("krpano object not available.");
    return;
  }

  const hlookatEl = document.getElementById("hlookat");
  const vlookatEl = document.getElementById("vlookat");
  const fovEl = document.getElementById("fov");
  const tweenTimeEl = document.getElementById("tweenTime");

  let targetH =
    hlookat !== undefined
      ? hlookat
      : parseFloat(hlookatEl ? hlookatEl.value : 0);
  let targetV =
    vlookat !== undefined
      ? vlookat
      : parseFloat(vlookatEl ? vlookatEl.value : 0);
  let targetFov =
    fov !== undefined ? fov : parseFloat(fovEl ? fovEl.value : 90);
  const targetTweenTime =
    tweenTime !== undefined
      ? tweenTime
      : parseFloat(tweenTimeEl ? tweenTimeEl.value : 1);

  // Clamp input values
  targetH = Math.max(-180, Math.min(180, targetH));
  targetV = Math.max(-180, Math.min(180, targetV));
  targetFov = Math.max(10, Math.min(140, targetFov));

  if (
    isNaN(targetH) ||
    isNaN(targetV) ||
    isNaN(targetFov) ||
    isNaN(targetTweenTime)
  ) {
    console.error("Invalid camera parameters. Using defaults.");
    applyCameraView(
      krpano.get("view.hlookat") || 0,
      krpano.get("view.vlookat") || 0,
      krpano.get("view.fov") || 90,
      1
    );
    return;
  }

  console.log("Applying camera view:", {
    hlookat: targetH,
    vlookat: targetV,
    fov: targetFov,
    tweenTime: targetTweenTime,
  });

  const krpanoCommand = `lookto(${targetH}, ${targetV}, ${targetFov}, ${targetTweenTime}, true, true, true);`;
  try {
    krpano.call(krpanoCommand);
    if (hlookatEl) hlookatEl.value = targetH.toFixed(2);
    if (vlookatEl) vlookatEl.value = targetV.toFixed(2);
    if (fovEl) fovEl.value = targetFov.toFixed(2);
  } catch (e) {
    console.error("Error executing krpano command:", e);
  }

  setTimeout(() => {
    if (krpano) {
      console.log("krpano view after call:", {
        hlookat: krpano.get("view.hlookat"),
        vlookat: krpano.get("view.vlookat"),
        fov: krpano.get("view.fov"),
      });
    }
    isApplyingView = false;
  }, Math.max(1, targetTweenTime * 1000));

  isApplyingView = true;
}

function zoomIn() {
  if (!krpano) return;
  const currentFov = krpano.get("view.fov") || 90;
  const fovMin = 10;
  const newFov = Math.max(currentFov - 10, fovMin);
  applyCameraView(
    krpano.get("view.hlookat"),
    krpano.get("view.vlookat"),
    newFov,
    0.5
  );
  const fovEl = document.getElementById("fov");
  if (fovEl) fovEl.value = newFov.toFixed(2);
}

function zoomOut() {
  if (!krpano) return;
  const currentFov = krpano.get("view.fov") || 90;
  const fovMax = 140;
  const newFov = Math.min(currentFov + 10, fovMax);
  applyCameraView(
    krpano.get("view.hlookat"),
    krpano.get("view.vlookat"),
    newFov,
    0.5
  );
  const fovEl = document.getElementById("fov");
  if (fovEl) fovEl.value = newFov.toFixed(2);
}

function initThreeJSCube() {
  const canvas = document.getElementById("navCubeCanvas");
  const container = document.getElementById("navCubeContainer");
  if (!canvas || !container) {
    console.error("Navigation cube canvas or container not found.");
    return;
  }

  scene = new THREE.Scene();
  const size = Math.min(container.clientWidth, container.clientHeight);
  camera = new THREE.OrthographicCamera(
    -size / 2,
    size / 2,
    size / 2,
    -size / 2,
    0.1,
    1000
  );
  camera.position.z = 200;

  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);

  const cubeSize = size * 0.35; // Increased from 0.25 to 0.35
  const geometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
  const materials = [
    new THREE.MeshBasicMaterial({ color: 0xff0000 }),
    new THREE.MeshBasicMaterial({ color: 0x00ff00 }),
    new THREE.MeshBasicMaterial({ color: 0x0000ff }),
    new THREE.MeshBasicMaterial({ color: 0xffff00 }),
    new THREE.MeshBasicMaterial({ color: 0x00ffff }),
    new THREE.MeshBasicMaterial({ color: 0xff00ff }),
  ];
  cube = new THREE.Mesh(geometry, materials);
  cube.rotation.order = "YXZ";
  scene.add(cube);

  canvas.addEventListener("mousedown", onMouseDown, false);
  document.addEventListener("mousemove", onMouseMove, false);
  document.addEventListener("mouseup", onMouseUp, false);
  canvas.addEventListener("mouseleave", onMouseLeaveCanvas, false);
  canvas.addEventListener("wheel", (e) => e.stopPropagation(), false);
  canvas.addEventListener("contextmenu", (e) => e.stopPropagation(), false);
  window.addEventListener("resize", onWindowResize, false);

  animate();
}

function onWindowResize() {
  const container = document.getElementById("navCubeContainer");
  if (!container || !renderer || !camera) return;
  const width = container.clientWidth;
  const height = container.clientHeight;
  const size = Math.min(width, height);
  if (camera.isOrthographicCamera) {
    camera.left = -size / 2;
    camera.right = size / 2;
    camera.top = size / 2;
    camera.bottom = -size / 2;
    camera.updateProjectionMatrix();
  }
  renderer.setSize(width, height);
  if (cube) {
    const cubeSize = size * 0.35; // Increased from 0.25 to 0.35
    cube.geometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
  }
}

function onMouseDown(event) {
  if (event.target === document.getElementById("navCubeCanvas")) {
    isDragging = true;
    previousMouseX = event.clientX;
    previousMouseY = event.clientY;
    document.getElementById("navCubeCanvas").style.cursor = "grabbing";
    event.preventDefault();
    event.stopPropagation();
  }
}

function onMouseMove(event) {
  if (!isDragging || !cube || !krpano) return;
  const deltaX = event.clientX - previousMouseX;
  const deltaY = event.clientY - previousMouseY;
  const rotationSpeed = 0.015;
  cube.rotation.y += deltaX * rotationSpeed;
  cube.rotation.x += deltaY * rotationSpeed;
  cube.rotation.x = Math.max(
    -Math.PI / 2,
    Math.min(Math.PI / 2, cube.rotation.x)
  );
  updateKrpanoFromCube();
  previousMouseX = event.clientX;
  previousMouseY = event.clientY;
  event.preventDefault();
  event.stopPropagation();
}

function onMouseUp(event) {
  if (isDragging) {
    isDragging = false;
    const canvas = document.getElementById("navCubeCanvas");
    if (canvas) canvas.style.cursor = "grab";
  }
}

function onMouseLeaveCanvas(event) {
  const canvas = document.getElementById("navCubeCanvas");
  if (canvas) canvas.style.cursor = "grab";
}

function animate() {
  requestAnimationFrame(animate);
  if (!isDragging && !isApplyingView) {
    updateCubeFromKrpano();
  }
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

function updateCubeFromKrpano() {
  if (
    !krpano ||
    isUpdatingCubeFromKrpano ||
    !cube ||
    isDragging ||
    isApplyingView
  )
    return;
  isUpdatingCubeFromKrpano = true;
  const krpanoH = Math.max(
    -180,
    Math.min(180, krpano.get("view.hlookat") || 0)
  );
  const krpanoV = krpano.get("view.vlookat") || 0;
  const fov = Math.max(10, Math.min(140, krpano.get("view.fov") || 90));
  const targetCubeY = THREE.MathUtils.degToRad(-krpanoH);
  const targetCubeX = THREE.MathUtils.degToRad(krpanoV);
  const tweenSpeed = 0.1;
  cube.rotation.y += (targetCubeY - cube.rotation.y) * tweenSpeed;
  cube.rotation.x += (targetCubeX - cube.rotation.x) * tweenSpeed;
  const hlookatEl = document.getElementById("hlookat");
  const vlookatEl = document.getElementById("vlookat");
  const fovEl = document.getElementById("fov");
  if (!inputFocusState.hlookat && hlookatEl)
    hlookatEl.value = krpanoH.toFixed(2);
  if (!inputFocusState.vlookat && vlookatEl)
    vlookatEl.value = krpanoV.toFixed(2);
  if (!inputFocusState.fov && fovEl)
    fovEl.value = fov.toFixed(2);
  // Send camera data to APS viewer iframe
  const apsIframe = document.getElementById('aps-viewer');
  if (apsIframe && apsIframe.contentWindow) {
    apsIframe.contentWindow.postMessage({ hlookat: krpanoH, vlookat: krpanoV, fov }, '*');
  }
  isUpdatingCubeFromKrpano = false;
}

function updateKrpanoFromCube() {
  if (!krpano || isUpdatingKrpanoFromCube || !cube) return;
  isUpdatingKrpanoFromCube = true;
  const krpanoH = Math.max(
    -180,
    Math.min(180, -THREE.MathUtils.radToDeg(cube.rotation.y))
  );
  const krpanoV = THREE.MathUtils.radToDeg(cube.rotation.x);
  const currentFov = Math.max(10, Math.min(140, krpano.get("view.fov") || 90));
  const krpanoCommand = `lookto(${krpanoH}, ${krpanoV}, ${currentFov}, 0.0, true, true, true);`;
  try {
    krpano.call(krpanoCommand);
    const hlookatEl = document.getElementById("hlookat");
    const vlookatEl = document.getElementById("vlookat");
    if (hlookatEl) hlookatEl.value = krpanoH.toFixed(2);
    if (vlookatEl) vlookatEl.value = krpanoV.toFixed(2);
  } catch (e) {
    console.error("Error updating krpano from cube:", e);
  }
  isUpdatingKrpanoFromCube = false;
}

function cleanup() {
  window.removeEventListener("resize", onWindowResize);
  const canvas = document.getElementById("navCubeCanvas");
  if (canvas) {
    canvas.removeEventListener("mousedown", onMouseDown);
    canvas.removeEventListener("mouseleave", onMouseLeaveCanvas);
    canvas.removeEventListener("wheel", (e) => e.stopPropagation());
    canvas.removeEventListener("contextmenu", (e) => e.stopPropagation());
  }
  document.removeEventListener("mousemove", onMouseMove);
  document.removeEventListener("mouseup", onMouseUp);
}

document.addEventListener("DOMContentLoaded", () => {
  initThreeJSCube();
  setupInputFocusTracking();
  embedKrpanoWithFallback();
  // Add event listeners for zoom buttons
  const zoomInBtn = document.getElementById("zoomIn");
  if (zoomInBtn) zoomInBtn.addEventListener("click", zoomIn);
  const zoomOutBtn = document.getElementById("zoomOut");
  if (zoomOutBtn) zoomOutBtn.addEventListener("click", zoomOut);
});

window.addEventListener("unload", cleanup);
