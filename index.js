var krpano = null; // Global variable to hold the krpano object

// Three.js variables
let scene, camera, renderer, cube;
let isDragging = false;
let previousMouseX = 0;
let previousMouseY = 0;

// =============================================================
// krpano Integration
// =============================================================

// This function is called by the krpano embedding script when it's ready
function krpano_onready(krpano_interface) {
  krpano = krpano_interface;
  console.log("krpano is ready!", krpano);

  // Populate input fields with initial krpano view
  if (krpano) {
    document.getElementById("hlookat").value = krpano.get("view.hlookat");
    document.getElementById("vlookat").value = krpano.get("view.vlookat");
    document.getElementById("fov").value = krpano.get("view.fov");

    // Set up a listener for krpano view changes to update the cube
    // This will call `updateCubeFromKrpano()` whenever the krpano view changes
    // The 'null' is important to avoid issues with older krpano versions expecting a specific scope.
    krpano.set("events.onviewchange", "js(updateCubeFromKrpano());");
    console.log("krpano onviewchange event listener set.");

    // Initialize cube orientation with current krpano view
    updateCubeFromKrpano();
  }
}

// Embed the krpano viewer
embedpano({
  swf: "tour.swf", // Path to your krpano Flash file
  xml: "tour.xml", // Path to your krpano XML file
  target: "pano", // ID of the HTML element where the viewer will be embedded
  html5: "auto", // Use HTML5 viewer if supported, fallback to Flash
  onready: krpano_onready, // Callback function when krpano is ready
});

/**
 * Applies a new camera view based on input fields or provided values.
 * @param {number} hlookat Optional. Horizontal lookat angle. If not provided, gets from input field.
 * @param {number} vlookat Optional. Vertical lookat angle. If not provided, gets from input field.
 * @param {number} fov Optional. Field of view. If not provided, gets from input field.
 * @param {number} tweenTime Optional. Animation time. If not provided, gets from input field.
 */
function applyCameraView(hlookat, vlookat, fov, tweenTime) {
  if (!krpano) {
    console.error("krpano object not available yet.");
    return;
  }

  const targetH =
    hlookat !== undefined
      ? hlookat
      : parseFloat(document.getElementById("hlookat").value);
  const targetV =
    vlookat !== undefined
      ? vlookat
      : parseFloat(document.getElementById("vlookat").value);
  const targetFov =
    fov !== undefined ? fov : parseFloat(document.getElementById("fov").value);
  const targetTweenTime =
    tweenTime !== undefined
      ? tweenTime
      : parseFloat(document.getElementById("tweenTime").value);

  // Basic validation for numbers
  if (
    isNaN(targetH) ||
    isNaN(targetV) ||
    isNaN(targetFov) ||
    isNaN(targetTweenTime)
  ) {
    console.error("Invalid camera parameters. Please enter numbers.");
    return;
  }

  // Use krpano's lookto action for smooth animation
  const krpanoCommand = `lookto(${targetH}, ${targetV}, ${targetFov}, ${targetTweenTime}, true, true, true);`;

  console.log(`Executing krpano command: ${krpanoCommand}`);
  // No need to disable onviewchange listener here as this is a manual trigger
  krpano.call(krpanoCommand);
}

/**
 * Zooms in by a fixed amount.
 */
function zoomIn() {
  if (!krpano) {
    console.error("krpano object not available yet.");
    return;
  }
  const currentFov = krpano.get("view.fov");
  const fovMin = krpano.get("view.fovmin");
  const newFov = Math.max(currentFov - 10, fovMin); // Zoom in by 10, but not less than fovmin
  applyCameraView(
    krpano.get("view.hlookat"), // Keep current HLOOKAT
    krpano.get("view.vlookat"), // Keep current VLOOKAT
    newFov, // New FOV
    0.5 // Faster tween time for zoom buttons
  );
  document.getElementById("fov").value = newFov; // Update input field
}

/**
 * Zooms out by a fixed amount.
 */
function zoomOut() {
  if (!krpano) {
    console.error("krpano object not available yet.");
    return;
  }
  const currentFov = krpano.get("view.fov");
  const fovMax = krpano.get("view.fovmax");
  const newFov = Math.min(currentFov + 10, fovMax); // Zoom out by 10, but not more than fovmax
  applyCameraView(
    krpano.get("view.hlookat"), // Keep current HLOOKAT
    krpano.get("view.vlookat"), // Keep current VLOOKAT
    newFov, // New FOV
    0.5 // Faster tween time for zoom buttons
  );
  document.getElementById("fov").value = newFov; // Update input field
}

// =============================================================
// Three.js Navigation Cube
// =============================================================

function initThreeJSCube() {
  const canvas = document.getElementById("navCubeCanvas");
  const container = document.getElementById("navCubeContainer");

  // Scene
  scene = new THREE.Scene();
  // scene.background = new THREE.Color(0x222222); // Uncomment for solid background

  // Camera - Orthographic for flat appearance like a HUD
  const size = 100; // Half-width/height of the frustum
  camera = new THREE.OrthographicCamera(
    -size / 2,
    size / 2,
    size / 2,
    -size / 2,
    0.1,
    1000
  );
  camera.position.z = 200; // Position far enough to see the cube

  // Renderer
  renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    alpha: true, // Allow transparency for the background
    antialias: true,
  });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);

  // Cube Geometry & Material
  const geometry = new THREE.BoxGeometry(40, 40, 40); // Size of the cube
  const materials = [
    new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: false }), // Right (+X)
    new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: false }), // Left (-X)
    new THREE.MeshBasicMaterial({ color: 0x0000ff, wireframe: false }), // Top (+Y)
    new THREE.MeshBasicMaterial({ color: 0xffff00, wireframe: false }), // Bottom (-Y)
    new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: false }), // Front (+Z)
    new THREE.MeshBasicMaterial({ color: 0xff00ff, wireframe: false }), // Back (-Z)
  ];
  cube = new THREE.Mesh(geometry, materials);
  scene.add(cube);

  // Initial rotation for the cube to align with krpano's H=0, V=0
  // krpano's H=0, V=0 usually means looking straight ahead (East/South depending on pano creation).
  // Let's assume for this setup that krpano's 0,0 aligns with Three.js camera looking down -Z at cube's +Z face.
  // If your krpano panorama's 'north' is at H=0, you might need to adjust the cube's initial Y rotation.
  // For example, if krpano's 0 is true North, and your cube's +Z face is "North":
  // cube.rotation.y = THREE.MathUtils.degToRad(0); // If +Z of cube is north
  // If krpano's 0 is West, and your cube's +Z face is North:
  // cube.rotation.y = THREE.MathUtils.degToRad(90); // Rotate cube so its +Z points where krpano 0 is.
  cube.rotation.order = "YXZ"; // Ensures Y (yaw) then X (pitch) are applied consistently

  // Event Listeners for dragging the cube
  canvas.addEventListener("mousedown", onMouseDown, false); // Add false for bubbling phase
  // Listen on document for mousemove/mouseup to ensure dragging continues even if mouse leaves canvas
  document.addEventListener("mousemove", onMouseMove, false);
  document.addEventListener("mouseup", onMouseUp, false);
  canvas.addEventListener("mouseleave", onMouseLeaveCanvas, false); // Specific for canvas

  // Prevent events on the cube canvas from bubbling up to krpano
  canvas.addEventListener("wheel", (e) => e.stopPropagation(), false); // Prevent krpano zoom
  canvas.addEventListener("contextmenu", (e) => e.stopPropagation(), false); // Prevent krpano right-click

  // Handle window resize
  window.addEventListener("resize", onWindowResize, false);

  // Start animation loop
  animate();
}

function onWindowResize() {
  const container = document.getElementById("navCubeContainer");
  const width = container.clientWidth;
  const height = container.clientHeight;

  if (camera.isOrthographicCamera) {
    const size = Math.min(width, height); // Maintain aspect ratio if container is not square
    camera.left = -size / 2;
    camera.right = size / 2;
    camera.top = size / 2;
    camera.bottom = -size / 2;
  } else if (camera.isPerspectiveCamera) {
    camera.aspect = width / height;
  }
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

function onMouseDown(event) {
  // Only start dragging if the event originated from the cube canvas
  if (event.target === document.getElementById("navCubeCanvas")) {
    isDragging = true;
    previousMouseX = event.clientX;
    previousMouseY = event.clientY;
    document.getElementById("navCubeCanvas").style.cursor = "grabbing";
    event.preventDefault(); // Prevent default browser drag behavior
    event.stopPropagation(); // Stop event from propagating to krpano
  }
}

function onMouseMove(event) {
  if (!isDragging || !cube || !krpano) return;

  const deltaX = event.clientX - previousMouseX;
  const deltaY = event.clientY - previousMouseY;

  const rotationSpeed = 0.015; // Adjust sensitivity

  // Rotate the cube directly based on mouse movement
  cube.rotation.y += deltaX * rotationSpeed;
  cube.rotation.x -= deltaY * rotationSpeed;

  // Clamp X rotation (pitch) to prevent flipping (mimics vlookat limits -90 to 90)
  cube.rotation.x = Math.max(
    -Math.PI / 2,
    Math.min(Math.PI / 2, cube.rotation.x)
  );

  // Update krpano view based on cube's new orientation
  updateKrpanoFromCube();

  previousMouseX = event.clientX;
  previousMouseY = event.clientY;
  event.preventDefault(); // Prevent default browser behavior (e.g., text selection)
  event.stopPropagation(); // Stop event from propagating to krpano
}

function onMouseUp(event) {
  if (isDragging) {
    isDragging = false;
    document.getElementById("navCubeCanvas").style.cursor = "grab";
    // We don't stop propagation for mouseup on document, as it's a global event.
    // Event.preventDefault() is generally not needed for mouseup.
  }
}

function onMouseLeaveCanvas(event) {
  // No longer stop dragging when leaving the canvas; only stop on mouseup
  document.getElementById("navCubeCanvas").style.cursor = "grab";
}

function animate() {
  requestAnimationFrame(animate);
  updateCubeFromKrpano(); // Ensure cube is always synced with krpano view
  renderer.render(scene, camera);
}

/**
 * Converts krpano's hlookat/vlookat to cube's Euler angles and updates the cube.
 */
let isUpdatingCubeFromKrpano = false; // Flag to prevent feedback loop

function updateCubeFromKrpano() {
  if (!krpano || isUpdatingCubeFromKrpano || !cube) return;

  // Only update cube if it's not being dragged by the user directly
  // This is important to prevent conflict when user is manipulating the cube
  if (isDragging) {
    return;
  }

  isUpdatingCubeFromKrpano = true; // Set flag

  const krpanoH = krpano.get("view.hlookat");
  const krpanoV = krpano.get("view.vlookat");

  // Convert krpano degrees to Three.js radians
  // The signs here are crucial and depend on your krpano setup and desired cube orientation.
  // Typically, a positive hlookat (turning right) means a negative Y rotation for the cube
  // if its +Z axis points 'forward' and its +Y axis points 'up'.
  const targetCubeY = THREE.MathUtils.degToRad(-krpanoH);
  const targetCubeX = THREE.MathUtils.degToRad(krpanoV);

  // Smoothly animate the cube rotation
  const tweenSpeed = 0.1; // Adjust for faster/slower cube sync
  cube.rotation.y += (targetCubeY - cube.rotation.y) * tweenSpeed;
  cube.rotation.x += (targetCubeX - cube.rotation.x) * tweenSpeed;

  // Optional: Update input fields if needed
  document.getElementById("hlookat").value = krpanoH.toFixed(2);
  document.getElementById("vlookat").value = krpanoV.toFixed(2);
  document.getElementById("fov").value = krpano.get("view.fov").toFixed(2);

  isUpdatingCubeFromKrpano = false; // Reset flag
}

/**
 * Converts cube's Euler angles to krpano's hlookat/vlookat and updates krpano.
 */
let isUpdatingKrpanoFromCube = false; // Flag to prevent feedback loop

function updateKrpanoFromCube() {
  if (!krpano || isUpdatingKrpanoFromCube || !cube) return;

  isUpdatingKrpanoFromCube = true; // Set flag

  // Convert cube's radians to krpano degrees
  // Inverse of the logic in updateCubeFromKrpano
  const krpanoH = -THREE.MathUtils.radToDeg(cube.rotation.y);
  const krpanoV = THREE.MathUtils.radToDeg(cube.rotation.x);

  // krpano lookto command
  const currentFov = krpano.get("view.fov"); // Keep current FOV
  // Set '0.0' for immediate update to feel responsive with cube dragging
  // We're setting ranges to true to ensure krpano respects its own limits.
  const krpanoCommand = `lookto(${krpanoH}, ${krpanoV}, ${currentFov}, 0.0, true, true, true);`;

  krpano.call(krpanoCommand);

  // Optional: Update input fields immediately for feedback
  document.getElementById("hlookat").value = krpanoH.toFixed(2);
  document.getElementById("vlookat").value = krpanoV.toFixed(2);

  isUpdatingKrpanoFromCube = false; // Reset flag
}

// Initialize Three.js cube when the DOM is ready
document.addEventListener("DOMContentLoaded", initThreeJSCube);
