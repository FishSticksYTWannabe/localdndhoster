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

type RollRecord = {
  id: string;
  timestamp: string;
  type: string;
  value: number;
  label: string;
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
  const [rollHistory, setRollHistory] = useState<RollRecord[]>([]);
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
    // init tile heights when needed, but preserve existing data if grid size matches
    const total = cols * rows;
    if (tileHeightsRef.current.length !== total) {
      tileHeightsRef.current = new Array(total).fill(0);
    }
  }, [cols, rows]);

  useEffect(() => {
    loadVTT();
  }, []);

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

  // Dice support (persistent roll history and face mapping)
  const rollStateRef = useRef<{ rolling: boolean; result?: number }>({ rolling: false });

  const getDiceGroup = () => {
    return (sceneRef.current as any)?._diceGroup as THREE.Group | undefined;
  };

  const createFaceTexture = (label: string) => {
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
    ctx.fillText(label, canvas.width / 2, canvas.height / 2 + 10);
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  };

  const createFaceMaterials = (labels: string[]) => {
    return labels.map((label) => new THREE.MeshStandardMaterial({ map: createFaceTexture(label), roughness: 0.4, metalness: 0.1, side: THREE.DoubleSide }));
  };

  const configureGroupsForFaces = (geometry: THREE.BufferGeometry, faceCount: number) => {
    const index = geometry.index;
    if (!index) return 1;
    geometry.clearGroups();
    const totalTriangles = index.count / 3;
    const trianglesPerFace = Math.floor(totalTriangles / faceCount);
    for (let face = 0; face < faceCount; face += 1) {
      const start = face * trianglesPerFace * 3;
      const count = face === faceCount - 1 ? index.count - start : trianglesPerFace * 3;
      geometry.addGroup(start, count, face);
    }
    return Math.max(1, trianglesPerFace);
  };

  const computeFaceNormals = (geometry: THREE.BufferGeometry, faceCount: number) => {
    const normals: THREE.Vector3[] = [];
    const position = geometry.attributes.position;
    const index = geometry.index;
    if (!index) return normals;
    if (geometry.groups.length === 0) {
      configureGroupsForFaces(geometry, faceCount);
    }
    for (let groupIndex = 0; groupIndex < geometry.groups.length; groupIndex += 1) {
      const group = geometry.groups[groupIndex];
      const faceNormal = new THREE.Vector3(0, 0, 0);
      const triangleCount = group.count / 3;
      for (let i = group.start; i < group.start + group.count; i += 3) {
        const i0 = index.array[i];
        const i1 = index.array[i + 1];
        const i2 = index.array[i + 2];
        const a = new THREE.Vector3().fromBufferAttribute(position, i0);
        const b = new THREE.Vector3().fromBufferAttribute(position, i1);
        const c = new THREE.Vector3().fromBufferAttribute(position, i2);
        const triNormal = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
        faceNormal.add(triNormal);
      }
      faceNormal.normalize();
      normals.push(faceNormal);
    }
    return normals;
  };

  const orientDieToFace = (mesh: THREE.Mesh, faceIndex: number, normals: THREE.Vector3[]) => {
    if (!normals[faceIndex]) return;
    const normal = normals[faceIndex].clone().normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const faceQuat = new THREE.Quaternion().setFromUnitVectors(normal, up);
    const randomSpin = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.random() * Math.PI * 2, 0));
    mesh.quaternion.copy(faceQuat.multiply(randomSpin));
  };

  const makeDieMeshFor = (type: 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20', labels: string[]) => {
    const size = Math.min(gridSize / 6, 6);
    let geom: THREE.BufferGeometry;
    switch (type) {
      case 'd4':
        geom = new THREE.TetrahedronGeometry(size * 0.9);
        break;
      case 'd6':
        geom = new THREE.BoxGeometry(size, size, size);
        break;
      case 'd8':
        geom = new THREE.OctahedronGeometry(size * 0.9);
        break;
      case 'd12':
        geom = new THREE.DodecahedronGeometry(size * 0.9);
        break;
      case 'd20':
        geom = new THREE.IcosahedronGeometry(size * 0.9);
        break;
      case 'd10':
      default:
        geom = new THREE.CylinderGeometry(size * 0.6, size * 0.6, size * 1.2, 10, 1, true);
        break;
    }
    configureGroupsForFaces(geom, labels.length);
    const mats = createFaceMaterials(labels);
    const mesh = new THREE.Mesh(geom, mats);
    mesh.castShadow = true;
    return { mesh, faceNormals: computeFaceNormals(geom, labels.length) };
  };

  const [lastRoll, setLastRoll] = useState<string | null>(null);

  const saveRoll = async (type: string, value: number) => {
    const record: RollRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      type,
      value,
      label: `${type}: ${value}`,
    };
    setRollHistory((prev) => {
      const next = [record, ...prev];
      saveVTT({ rollHistory: next });
      return next;
    });
  };

  const rollGeneric = async (type: 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100') => {
    if (!sceneRef.current) return 0;
    const diceGroup = getDiceGroup();
    if (!diceGroup) return 0;
    diceGroup.clear();

    const rollDie = async (dieType: 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20', labels: string[], faceIndex: number, positionX = 0) => {
      const { mesh, faceNormals } = makeDieMeshFor(dieType, labels);
      mesh.position.set(positionX, 10, 0);
      orientDieToFace(mesh, faceIndex, faceNormals);
      diceGroup.add(mesh);
      const startQ = mesh.quaternion.clone();
      const finalQ = mesh.quaternion.clone();
      const start = performance.now();
      const duration = 1000;
      return new Promise<void>((resolve) => {
        function animate(now: number) {
          const t = Math.min(1, (now - start) / duration);
          const tmp = startQ.clone().slerp(finalQ, t);
          mesh.quaternion.copy(tmp);
          if (t < 1) requestAnimationFrame(animate);
          else resolve();
        }
        requestAnimationFrame(animate);
      });
    };

    const getLabels = (count: number, startAtOne = true) => {
      return Array.from({ length: count }, (_, idx) => String(startAtOne ? idx + 1 : idx));
    };

    if (type === 'd100') {
      const tens = Math.floor(Math.random() * 10);
      const ones = Math.floor(Math.random() * 10);
      const value = tens === 0 && ones === 0 ? 100 : tens * 10 + ones;
      const tensLabels = Array.from({ length: 10 }, (_, idx) => (idx === 0 ? '00' : `${idx * 10}`));
      const onesLabels = Array.from({ length: 10 }, (_, idx) => `${idx}`);
      await rollDie('d10', tensLabels, tens, -8);
      await rollDie('d10', onesLabels, ones, 8);
      return value;
    }

    const faceCounts = { d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20 } as const;
    const count = faceCounts[type];
    const labels = getLabels(count, true);
    const resultIndex = Math.floor(Math.random() * count);
    await rollDie(type, labels, resultIndex, 0);
    return resultIndex + 1;
  };

  const doRoll = async (type: 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100') => {
    setLastRoll('Rolling...');
    const res = await rollGeneric(type);
    setLastRoll(`${type}: ${res}`);
    await saveRoll(type, res);
  };
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

  const saveVTT = async (override?: { rollHistory?: RollRecord[] }) => {
    const payload = {
      cellSize,
      cols,
      rows,
      tileHeights: tileHeightsRef.current,
      tokens,
      rollHistory: override?.rollHistory ?? rollHistory,
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
      if (data.rollHistory) setRollHistory(data.rollHistory);
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
            <button onClick={() => saveVTT()}>Save VTT</button>
            <button onClick={() => loadVTT()}>Load VTT</button>
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
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => doRoll('d4')}>d4</button>
          <button onClick={() => doRoll('d6')}>d6</button>
          <button onClick={() => doRoll('d8')}>d8</button>
          <button onClick={() => doRoll('d10')}>d10</button>
          <button onClick={() => doRoll('d12')}>d12</button>
          <button onClick={() => doRoll('d20')}>d20</button>
          <button onClick={() => doRoll('d100')}>d100</button>
          <div style={{ marginLeft: 12, minWidth: 160 }}>{lastRoll ?? 'No roll yet'}</div>
        </div>
        <div style={{ marginTop: 12 }}>
          <h5>Roll History</h5>
          <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid #444', padding: 8, borderRadius: 4, background: '#111' }}>
            {rollHistory.length === 0 ? (
              <div style={{ color: '#888' }}>No rolls yet. Rolls persist with VTT save/load.</div>
            ) : (
              rollHistory.map((record) => (
                <div key={record.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>{new Date(record.timestamp).toLocaleString()} · {record.label}</span>
                  <span>{record.value}</span>
                </div>
              ))
            )}
          </div>
          <button style={{ marginTop: 8 }} onClick={() => {
            setRollHistory([]);
            saveVTT({ rollHistory: [] });
          }}>
            Clear Roll History
          </button>
        </div>
      </div>
    </section>
  );
}

export default VTT3D;

