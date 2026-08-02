import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

interface Token3D {
  id: string;
  name: string;
  icon: string;
  x: number; // world x
  y: number; // world z (height)
  z: number; // world y
}

function VTT3D() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [mapFile, setMapFile] = useState<File | null>(null);
  const [heightmapFile, setHeightmapFile] = useState<File | null>(null);
  const [tokens, setTokens] = useState<Token3D[]>([]);
  const [tokenName, setTokenName] = useState('');
  const [tokenIcon, setTokenIcon] = useState('https://www.svgrepo.com/show/2046/d20.svg');
  const planeRef = useRef<THREE.Mesh | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    mountRef.current.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(0, 80, 120);

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(50, 100, 50);
    scene.add(dir);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.update();

    // ground plane placeholder
    const size = 100;
    const segments = 128;
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
    const material = new THREE.MeshStandardMaterial({ color: 0x666666, side: THREE.DoubleSide });
    const plane = new THREE.Mesh(geometry, material);
    plane.rotation.x = -Math.PI / 2;
    planeRef.current = plane;
    scene.add(plane);

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    function onWindowResize() {
      const w = mountRef.current?.clientWidth ?? 800;
      const h = mountRef.current?.clientHeight ?? 600;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }

    window.addEventListener('resize', onWindowResize);

    function animate() {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    }
    animate();

    // handle click to place token or paint height
    const handleClick = (ev: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(plane);
      if (intersects.length > 0) {
        const p = intersects[0].point;
        // add a small marker if needed (debug)
        // For now, place the first token if any selected in UI by adding at click
      }
    };

    renderer.domElement.addEventListener('click', handleClick as any);

    // cleanup
    return () => {
      window.removeEventListener('resize', onWindowResize);
      renderer.domElement.removeEventListener('click', handleClick as any);
      controls.dispose();
      renderer.dispose();
      // remove canvas
      if (mountRef.current?.contains(renderer.domElement)) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  // apply map texture
  useEffect(() => {
    if (!planeRef.current || !mapFile) return;
    const reader = new FileReader();
    reader.onload = () => {
      const tex = new THREE.TextureLoader().load(reader.result as string, () => {
        if (planeRef.current) {
          const mat = planeRef.current.material as THREE.MeshStandardMaterial;
          mat.map = tex;
          mat.needsUpdate = true;
        }
      });
    };
    reader.readAsDataURL(mapFile);
  }, [mapFile]);

  // apply heightmap when provided: displace vertices
  useEffect(() => {
    if (!planeRef.current || !heightmapFile) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        // displace plane vertices by sampling the heightmap
        const geom = planeRef.current!.geometry as THREE.PlaneGeometry;
        const pos = geom.attributes.position as THREE.BufferAttribute;
        const segmentsX = geom.parameters.widthSegments ?? 1;
        const segmentsY = geom.parameters.heightSegments ?? 1;
        for (let i = 0; i < pos.count; i++) {
          const vx = pos.getX(i);
          const vy = pos.getY(i);
          const vz = pos.getZ(i);
          // map vx, vy to uv in [0,1]
          const u = (vx + geom.parameters.width! / 2) / geom.parameters.width!;
          const v = (vy + geom.parameters.height! / 2) / geom.parameters.height!;
          const px = Math.floor(u * (canvas.width - 1));
          const py = Math.floor((1 - v) * (canvas.height - 1));
          const idx = (py * canvas.width + px) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const brightness = (r + g + b) / (3 * 255);
          const height = brightness * 10; // scale
          pos.setZ(i, height);
        }
        pos.needsUpdate = true;
        geom.computeVertexNormals();
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(heightmapFile);
  }, [heightmapFile]);

  const addToken = () => {
    if (!tokenName.trim()) return;
    // place token at origin by default
    const t: Token3D = { id: `${Date.now()}`, name: tokenName.trim(), icon: tokenIcon.trim(), x: 0, y: 1, z: 0 };
    setTokens((p) => [t, ...p]);
    setTokenName('');
  };

  return (
    <section className="panel section" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', gap: 12 }}>
        <div className="panel-card" style={{ flex: '0 0 360px' }}>
          <h2>VTT 3D</h2>
          <label>
            Map image
            <input type="file" accept="image/*" onChange={(e) => setMapFile(e.target.files?.[0] ?? null)} />
          </label>
          <label>
            Heightmap (grayscale)
            <input type="file" accept="image/*" onChange={(e) => setHeightmapFile(e.target.files?.[0] ?? null)} />
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
            <button onClick={addToken}>Add Token</button>
          </div>
          <div style={{ marginTop: 12 }}>
            <h4>Token list</h4>
            {tokens.map((t) => (
              <div key={t.id} style={{ marginBottom: 8 }}>
                <strong>{t.name}</strong>
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 480 }} ref={mountRef} className="panel-card" />
      </div>
    </section>
  );
}

export default VTT3D;
