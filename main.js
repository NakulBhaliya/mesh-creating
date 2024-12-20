import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0f0f0); // Light gray background
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
camera.position.z = 5;

// Grid helper
const gridHelper = new THREE.GridHelper(10, 10, 0x888888, 0xcccccc);
scene.add(gridHelper);

// Points and lines storage
const points = [];
const pointsGroup = new THREE.Group();
const linesGroup = new THREE.Group();
scene.add(pointsGroup);
scene.add(linesGroup);

// Preview line
const previewLineMaterial = new THREE.LineBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.5 });
const previewLineGeometry = new THREE.BufferGeometry();
const previewLine = new THREE.Line(previewLineGeometry, previewLineMaterial);
scene.add(previewLine);

// Line creation state
let lastPoint = null;
let mousePosition = new THREE.Vector3();
let firstPointOfShape = null;

// Raycaster for mouse interaction
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const planeIntersectPoint = new THREE.Vector3();

// Event listeners
window.addEventListener('click', onClick);
window.addEventListener('mousemove', onMouseMove);
document.getElementById('clearPoints').addEventListener('click', clearPoints);
document.getElementById('exportGLB').addEventListener('click', exportGLB);
window.addEventListener('resize', onWindowResize);

function onClick(event) {
    // Check if we clicked on the controls
    if (event.target.closest('.no-point-creation')) {
        return;
    }

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(pointsGroup.children);

    if (intersects.length > 0) {
        // Clicked on existing point
        const clickedPoint = intersects[0].object;

        // If this is the first point of the shape, store it
        if (!firstPointOfShape) {
            firstPointOfShape = clickedPoint;
            lastPoint = clickedPoint;
        }
        // If we clicked on the first point and have at least 3 points, create mesh
        else if (clickedPoint === firstPointOfShape && pointsGroup.children.length >= 3) {
            createLine(lastPoint.position, clickedPoint.position);
            createMesh();
            // Reset for next shape
            firstPointOfShape = null;
            lastPoint = null;
            saveState();
        }
        // Regular point connection
        else {
            createLine(lastPoint.position, clickedPoint.position);
            lastPoint = clickedPoint;
            saveState();
        }
    } else if (raycaster.ray.intersectPlane(plane, planeIntersectPoint)) {
        // Create new point
        const newPoint = addPoint(planeIntersectPoint.clone());
        
        // If this is the first point of a new shape
        if (!firstPointOfShape) {
            firstPointOfShape = newPoint;
        }
        // If we have a previous point, create a line
        else if (lastPoint) {
            createLine(lastPoint.position, newPoint.position);
        }
        
        lastPoint = newPoint;
        saveState();
    }
}

function createMesh() {
    // Remove existing mesh if any
    const existingMesh = scene.getObjectByName('createdMesh');
    if (existingMesh) {
        scene.remove(existingMesh);
    }

    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const positions = [];

    // Collect all points in order
    pointsGroup.children.forEach(point => {
        positions.push(point.position);
    });

    // Create triangles (simple fan triangulation)
    for (let i = 1; i < positions.length - 1; i++) {
        vertices.push(
            positions[0].x, positions[0].y, positions[0].z,
            positions[i].x, positions[i].y, positions[i].z,
            positions[i + 1].x, positions[i + 1].y, positions[i + 1].z
        );
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();

    const material = new THREE.MeshPhongMaterial({
        color: 0x00ff00,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.7,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'createdMesh';
    scene.add(mesh);
}

function onMouseMove(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    raycaster.ray.intersectPlane(plane, planeIntersectPoint);
    mousePosition.copy(planeIntersectPoint);

    // Update preview line from last point to current mouse position
    if (lastPoint) {
        const positions = new Float32Array([
            lastPoint.position.x, lastPoint.position.y, lastPoint.position.z,
            mousePosition.x, mousePosition.y, mousePosition.z
        ]);
        previewLineGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        previewLineGeometry.attributes.position.needsUpdate = true;
    }
}

function addPoint(position) {
    const geometry = new THREE.SphereGeometry(0.1);
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const point = new THREE.Mesh(geometry, material);
    point.position.copy(position);
    pointsGroup.add(point);
    points.push(position);
    return point;
}

function createLine(start, end) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array([
        start.x, start.y, start.z,
        end.x, end.y, end.z
    ]);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });
    const line = new THREE.Line(geometry, material);
    linesGroup.add(line);
}

function clearPoints() {
    while (pointsGroup.children.length > 0) {
        pointsGroup.remove(pointsGroup.children[0]);
    }
    while (linesGroup.children.length > 0) {
        linesGroup.remove(linesGroup.children[0]);
    }
    points.length = 0;
    lastPoint = null;
    firstPointOfShape = null;
    previewLine.visible = false;
    
    // Remove existing mesh if any
    const existingMesh = scene.getObjectByName('createdMesh');
    if (existingMesh) {
        scene.remove(existingMesh);
    }

    // Save the cleared state
    saveState();
}

function exportGLB() {
    const mesh = scene.getObjectByName('createdMesh');
    if (!mesh) {
        alert('Please create a mesh first before exporting');
        return;
    }

    // Create a new scene with just the mesh
    const exportScene = new THREE.Scene();
    exportScene.add(mesh.clone());

    const exporter = new GLTFExporter();
    
    const options = {
        binary: true,
        trs: false,
        onlyVisible: true
    };

    exporter.parse(
        exportScene,
        (buffer) => {
            const blob = new Blob([buffer], { type: 'application/octet-stream' });
            const link = document.createElement('a');
            link.style.display = 'none';
            document.body.appendChild(link);
            link.href = URL.createObjectURL(blob);
            link.download = 'mesh.glb';
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        },
        (error) => {
            console.error('An error occurred while exporting:', error);
        },
        options
    );
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
directionalLight.position.set(10, 10, 10);
scene.add(directionalLight);

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

animate();

function saveState() {
    // Save current state
    const state = {
        points: points.map(p => p.clone()),
        pointObjects: pointsGroup.children.map(p => ({
            position: p.position.clone()
        })),
        lineObjects: linesGroup.children.map(l => ({
            positions: l.geometry.attributes.position.array.slice()
        }))
    };

    // Remove future states if we're in the middle of the history
    history.states.splice(history.currentIndex + 1);
    
    // Add new state
    history.states.push(state);
    history.currentIndex++;

    // Remove oldest states if we exceed maxStates
    if (history.states.length > history.maxStates) {
        history.states.shift();
        history.currentIndex--;
    }

    updateUndoRedoButtons();
}

const history = {
    states: [],
    currentIndex: -1,
    maxStates: 50
};

function updateUndoRedoButtons() {
    const undoButton = document.getElementById('undo');
    const redoButton = document.getElementById('redo');
    
    undoButton.disabled = history.currentIndex <= 0;
    redoButton.disabled = history.currentIndex >= history.states.length - 1;
}

function undo() {
    if (history.currentIndex > 0) {
        history.currentIndex--;
        loadState(history.states[history.currentIndex]);
        updateUndoRedoButtons();
    }
}

function redo() {
    if (history.currentIndex < history.states.length - 1) {
        history.currentIndex++;
        loadState(history.states[history.currentIndex]);
        updateUndoRedoButtons();
    }
}

function loadState(state) {
    // Clear current state
    while (pointsGroup.children.length > 0) {
        pointsGroup.remove(pointsGroup.children[0]);
    }
    while (linesGroup.children.length > 0) {
        linesGroup.remove(linesGroup.children[0]);
    }
    points.length = 0;

    // Load points
    state.points.forEach((p, i) => {
        points.push(p);
        const geometry = new THREE.SphereGeometry(0.1);
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const point = new THREE.Mesh(geometry, material);
        point.position.copy(state.pointObjects[i].position);
        pointsGroup.add(point);
    });

    // Load lines
    state.lineObjects.forEach(l => {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(l.positions, 3));
        const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });
        const line = new THREE.Line(geometry, material);
        linesGroup.add(line);
    });

    // Update last point
    lastPoint = pointsGroup.children[pointsGroup.children.length - 1] || null;
}

// Add keyboard shortcuts
window.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey) { // Ctrl or Cmd
        if (event.key === 'z') {
            if (event.shiftKey) {
                redo(); // Ctrl+Shift+Z or Cmd+Shift+Z for Redo
            } else {
                undo(); // Ctrl+Z or Cmd+Z for Undo
            }
            event.preventDefault();
        } else if (event.key === 'y') {
            redo(); // Ctrl+Y or Cmd+Y for Redo
            event.preventDefault();
        }
    }
});

document.getElementById('undo').addEventListener('click', undo);
document.getElementById('redo').addEventListener('click', redo);
