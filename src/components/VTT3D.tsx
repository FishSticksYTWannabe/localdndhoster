import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

type Token3D = {
  id: string;
  name: string;
  icon: string;
  x: number;
  y: number; // height
  z: number;
};

const electron = (window as any).require?.('electron');
const ipcRenderer = electron?.ipcRenderer;

function VTT3D() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const planeRef = useRef<THREE.Mesh | null>(null);
  const tilesRef = useRef<THREE.Group | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  const [mapFile, setMapFile] = useState<File | null>(null);
  const [heightmapFile, setHeightmapFile] = useState<File | null>(null);
  const [cellSize, setCellSize] = useState<number>(5);
  const [tokens, setTokens] = useState<Token3D[]>([]);
  const [tokenName, setTokenName] = useState('');
  const [tokenIcon, setTokenIcon] = useState('https://www.svgrepo.com/show/2046/d20.svg');
  const [mode, setMode] = useState<'select' | 'paint' | 'place'>('select');
  const [selectedTiles, setSelectedTiles] = useState<Set<string>>(new Set());
  const gridSize = 100; // world units
  const [cols, setCols] = useState(() => Math.floor(gridSize / cellSize));
  const [rows, setRows] = useState(() => Math.floor(gridSize / cellSize));
  const tileHeightsRef = useRef<number[]>([]);

  useEffect(() => {
    setCols(Math.max(1, Math.floor(gridSize / cellSize)));
    setRows(Math.max(1, Math.floor(gridSize / cellSize)));
  }, [cellSize]);

  useEffect(() => {
    // init tile heights
    const total = cols * rows;
    tileHeightsRef.current = new Array(total).fill(0);
  }, [cols, rows]);

  useEffect(() => {
    if (!mountRef.current) return;
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(0, 80, 120);
    cameraRef.current = camera;

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(50, 100, 50);
    scene.add(dir);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.update();

    // plane
    const segments = Math.max(cols, rows);
    const geometry = new THREE.PlaneGeometry(gridSize, gridSize, cols, rows);
    const material = new THREE.MeshStandardMaterial({ color: 0x666666, side: THREE.DoubleSide });
    const plane = new THREE.Mesh(geometry, material);
    plane.rotation.x = -Math.PI / 2;
    planeRef.current = plane;
    scene.add(plane);

    // tile overlays
    const tilesGroup = new THREE.Group();
    tilesRef.current = tilesGroup;
    scene.add(tilesGroup);

    // dice group
    const diceGroup = new THREE.Group();
    diceGroup.name = 'diceGroup';
    scene.add(diceGroup);
    (scene as any)._diceGroup = diceGroup;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    function onResize() {
      const w = mountRef.current?.clientWidth ?? 800;
      const h = mountRef.current?.clientHeight ?? 600;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }

    window.addEventListener('resize', onResize);

    function render() {
      requestAnimationFrame(render);
      renderer.render(scene, camera);
    }
    render();

    // click/drag handling
    let dragStart: { x: number; y: number } | null = null;

    const toWorld = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const inter = raycaster.intersectObject(plane);
      if (inter.length > 0) return inter[0].point;
      return null;
    };

    const onPointerDown = (ev: PointerEvent) => {
      dragStart = { x: ev.clientX, y: ev.clientY };
    };

    const onPointerUp = (ev: PointerEvent) => {
      const start = dragStart;
      dragStart = null;
      const pEnd = toWorld(ev.clientX, ev.clientY);
      if (!pEnd) return;
      if (start && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 6) {
        // rectangle selection
        const pStart = toWorld(start.x, start.y);
        if (!pStart) return;
        selectTilesInRect(pStart, pEnd);
        return;
      }
      // single click
      if (mode === 'place') {
        placeTokenAtPoint(pEnd);
      } else if (mode === 'paint') {
        paintTileAtPoint(pEnd, 1);
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    function cleanup() {
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      controls.dispose();
      renderer.dispose();
      if (mountRef.current?.contains(renderer.domElement)) {
        mountRef.current.removeChild(renderer.domElement);
      }
    }

    return cleanup;
  }, [cols, rows]);

  // Dice support (d6 implemented with real face orientations)
  const rollStateRef = useRef<{ rolling: boolean; result?: number }>({ rolling: false });

  const makeD6Mesh = () => {
    const size = Math.min(gridSize / 6, 6);
    const geom = new THREE.BoxGeometry(size, size, size);
    const mats = [];
    // simple numbered faces using canvas textures
    for (let i = 1; i <= 6; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 140px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i), canvas.width / 2, canvas.height / 2 + 10);
      const tex = new THREE.CanvasTexture(canvas);
      mats.push(new THREE.MeshStandardMaterial({ map: tex }));
    }
    const mesh = new THREE.Mesh(geom, mats);
    return mesh;
  };

  const getDiceGroup = () => {
    return (sceneRef.current as any)?._diceGroup as THREE.Group | undefined;
  };

  const faceNormalForD6 = (faceIndex: number) => {
    // mapping 1..6 -> normals in local box coordinates
    const normals = [
      new THREE.Vector3(0, 1, 0), // 1 -> +Y
      new THREE.Vector3(0, -1, 0), // 2 -> -Y
      new THREE.Vector3(1, 0, 0), // 3 -> +X
      new THREE.Vector3(-1, 0, 0), // 4 -> -X
      new THREE.Vector3(0, 0, 1), // 5 -> +Z
      new THREE.Vector3(0, 0, -1), // 6 -> -Z
    ];
    return normals[(faceIndex - 1) % 6];
  };

  const rollD6 = async () => {
    if (!sceneRef.current) return Promise.resolve(0);
    const diceGroup = getDiceGroup();
    if (!diceGroup) return Promise.resolve(0);
    // remove existing dice
    diceGroup.clear();
    const die = makeD6Mesh();
    die.position.set(0, 10, 0);
    diceGroup.add(die);

    const targetFace = Math.floor(Math.random() * 6) + 1;
    // compute quaternion so that chosen face normal points up (0,1,0)
    const normal = faceNormalForD6(targetFace).clone().normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(normal, up);

    // add some random spin
    const extra = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6));
    const finalQ = q.multiply(extra);

    // animate slerp
    const duration = 1000;
    const startQ = die.quaternion.clone();
    const start = performance.now();
    return new Promise<number>((resolve) => {
      function animate(now: number) {
        const t = Math.min(1, (now - start) / duration);
        const tmp = startQ.clone().slerp(finalQ, t);
        die.quaternion.copy(tmp);
        if (t < 1) {
          requestAnimationFrame(animate);
        } else {
          rollStateRef.current = { rolling: false, result: targetFace };
          resolve(targetFace);
        }
      }
      rollStateRef.current = { rolling: true };
      requestAnimationFrame(animate);
    });
  };

  const rollD20 = async () => {
    // d20: simulate numeric roll and show spinning icosahedron (no face-number mapping)
    if (!sceneRef.current) return Promise.resolve(0);
    const diceGroup = getDiceGroup();
    if (!diceGroup) return Promise.resolve(0);
    diceGroup.clear();
    const geom = new THREE.IcosahedronGeometry(4, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffdd66 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(0, 10, 0);
    diceGroup.add(mesh);
    const result = Math.floor(Math.random() * 20) + 1;
    const duration = 1000;
    const startQ = mesh.quaternion.clone();
    const extra = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 8, Math.random() * 8, Math.random() * 8));
    const finalQ = extra;
    const start = performance.now();
    return new Promise<number>((resolve) => {
      function animate(now: number) {
        const t = Math.min(1, (now - start) / duration);
        const tmp = startQ.clone().slerp(finalQ, t);
        mesh.quaternion.copy(tmp);
        if (t < 1) requestAnimationFrame(animate);
        else {
          resolve(result);
        }
      }
      requestAnimationFrame(animate);
    });
  };

  const [lastRoll, setLastRoll] = useState<string | null>(null);

  const doRoll = async (type: 'd6' | 'd20') => {
    setLastRoll('Rolling...');
    let res = 0;
    if (type === 'd6') res = await rollD6();
    else res = await rollD20();
    setLastRoll(`${type}: ${res}`);
  };

  // helper: tile index from world position
  const tileIndexFromWorld = (x: number, z: number) => {
    const half = gridSize / 2;
    const localX = x + half; // 0..gridSize
    const localZ = z + half; // 0..gridSize
    const col = Math.floor((localX / gridSize) * cols);
    const row = Math.floor((localZ / gridSize) * rows);
    if (col < 0 || col >= cols || row < 0 || row >= rows) return -1;
    return row * cols + col;
  };

  const tileCenter = (index: number) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const half = gridSize / 2;
    const x = (col + 0.5) * (gridSize / cols) - half;
    const z = (row + 0.5) * (gridSize / rows) - half;
    return { x, z };
  };

  const placeTokenAtPoint = (p: THREE.Vector3) => {
    const idx = tileIndexFromWorld(p.x, p.z);
    const h = idx >= 0 ? tileHeightsRef.current[idx] : 0;
    const { x, z } = idx >= 0 ? tileCenter(idx) : { x: p.x, z: p.z };
    const t: Token3D = { id: `${Date.now()}`, name: tokenName || 'Token', icon: tokenIcon, x, y: h, z };
    setTokens((s) => [t, ...s]);
  };

  const selectTilesInRect = (a: THREE.Vector3, b: THREE.Vector3) => {
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    const minZ = Math.min(a.z, b.z);
    const maxZ = Math.max(a.z, b.z);
    const selected = new Set<string>();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const center = tileCenter(idx);
        if (center.x >= minX && center.x <= maxX && center.z >= minZ && center.z <= maxZ) {
          selected.add(String(idx));
        }
      }
    }
    setSelectedTiles(selected);
    updateTileVisuals(selected);
  };

  const updateTileVisuals = (selectedSet?: Set<string>) => {
    const tilesGroup = tilesRef.current;
    if (!tilesGroup) return;
    // clear
    tilesGroup.clear();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const center = tileCenter(idx);
        const h = tileHeightsRef.current[idx] ?? 0;
        const geom = new THREE.PlaneGeometry(gridSize / cols, gridSize / rows);
        const material = new THREE.MeshStandardMaterial({ color: selectedSet?.has(String(idx)) ? 0x88ccff : 0x000000, transparent: true, opacity: selectedSet?.has(String(idx)) ? 0.35 : 0.0, side: THREE.DoubleSide });
        const m = new THREE.Mesh(geom, material);
        m.rotation.x = -Math.PI / 2;
        m.position.set(center.x, h + 0.01, center.z);
        tilesGroup.add(m);
      }
    }
  };

  const paintTileAtPoint = (p: THREE.Vector3, delta: number) => {
    const idx = tileIndexFromWorld(p.x, p.z);
    if (idx < 0) return;
    tileHeightsRef.current[idx] = (tileHeightsRef.current[idx] ?? 0) + delta;
    updateTileVisuals(selectedTiles);
  };

  const applyHeightToSelection = (value: number) => {
    selectedTiles.forEach((id) => {
      const idx = Number(id);
      tileHeightsRef.current[idx] = value;
    });
    updateTileVisuals(selectedTiles);
  };

  const saveVTT = async () => {
    const payload = {
      cellSize,
      cols,
      rows,
      tileHeights: tileHeightsRef.current,
      tokens,
    };
    if (ipcRenderer) await ipcRenderer.invoke('vtt:save', payload);
  };

  const loadVTT = async () => {
    if (!ipcRenderer) return;
    const res = await ipcRenderer.invoke('vtt:load');
    if (res?.success && res.data) {
      const data = res.data;
      if (data.cellSize) setCellSize(data.cellSize);
      if (data.tileHeights) {
        tileHeightsRef.current = data.tileHeights;
      }
      if (data.tokens) setTokens(data.tokens);
      updateTileVisuals(new Set());
    }
  };

  useEffect(() => {
    updateTileVisuals(selectedTiles);
  }, [cols, rows]);

  return (
    <section className="panel section" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', gap: 12 }}>
        <div className="panel-card" style={{ flex: '0 0 400px' }}>
          <h2>VTT 3D (Grid: {cols}×{rows}, cell {cellSize}×{cellSize})</h2>
          <label>
            Map image
            <input type="file" accept="image/*" onChange={(e) => setMapFile(e.target.files?.[0] ?? null)} />
          </label>
          <label>
            Heightmap (grayscale)
            <input type="file" accept="image/*" onChange={(e) => setHeightmapFile(e.target.files?.[0] ?? null)} />
          </label>
          <label>
            Cell size (world units)
            <input type="number" value={cellSize} onChange={(e) => setCellSize(Number(e.target.value) || 5)} />
          </label>
          <label>
            Mode
            <select value={mode} onChange={(e) => setMode(e.target.value as any)}>
              <option value="select">Select</option>
              <option value="paint">Paint</option>
              <option value="place">Place Token</option>
            </select>
          </label>

          <hr />
          <h3>Tokens</h3>
          <label>
            Name
            <input value={tokenName} onChange={(e) => setTokenName(e.target.value)} />
          </label>
          <label>
            Icon URL
            <input value={tokenIcon} onChange={(e) => setTokenIcon(e.target.value)} />
          </label>
          <div className="button-row">
            <button onClick={() => setMode('place')}>Switch to Place</button>
          </div>

          <hr />
          <h3>Selection / Paint</h3>
          <div className="button-row">
            <button onClick={() => applyHeightToSelection(0)}>Set Selected to 0</button>
            <button onClick={() => applyHeightToSelection(1)}>Set Selected to 1</button>
          </div>

          <div style={{ marginTop: 12 }}>
            <button onClick={saveVTT}>Save VTT</button>
            <button onClick={loadVTT}>Load VTT</button>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 480 }} ref={mountRef} className="panel-card" />
      </div>

      <div style={{ padding: 8 }}>
        <h4>Tokens</h4>
        {tokens.map((t) => (
          <div key={t.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <img src={t.icon} style={{ width: 24, height: 24 }} />
            <div>{t.name} — h:{t.y.toFixed(2)}</div>
          </div>
        ))}
      </div>
      <div style={{ padding: 8 }}>
        <h4>Dice</h4>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => doRoll('d6')}>Roll d6</button>
          <button onClick={() => doRoll('d20')}>Roll d20</button>
          <div style={{ marginLeft: 12 }}>{lastRoll ?? 'No roll yet'}</div>
        </div>
      </div>
    </section>
  );
}

export default VTT3D;

