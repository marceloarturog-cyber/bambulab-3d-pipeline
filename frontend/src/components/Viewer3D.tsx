import { useRef, useState, useEffect, useCallback, Suspense } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Html, GizmoHelper, GizmoViewport } from '@react-three/drei';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { useStore } from '../store/useStore';

function ModelMesh({ url, format }: { url: string; format: string }) {
  const meshRef = useRef<THREE.Group>(null);
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [object, setObject] = useState<THREE.Group | null>(null);
  const { camera } = useThree();
  const meshVersion = useStore((s) => s.meshVersion);

  useEffect(() => {
    if (!url) return;
    const cacheBuster = `?v=${meshVersion}`;

    if (format === 'stl') {
      const loader = new STLLoader();
      loader.load(url + cacheBuster, (geo) => {
        geo.computeVertexNormals();
        geo.center();
        setGeometry(geo);
        setObject(null);

        geo.computeBoundingBox();
        if (geo.boundingBox) {
          const size = new THREE.Vector3();
          geo.boundingBox.getSize(size);
          const maxDim = Math.max(size.x, size.y, size.z);
          const fov = 50;
          const dist = maxDim / (2 * Math.tan((fov * Math.PI) / 360));
          camera.position.set(dist * 0.8, dist * 0.6, dist * 0.8);
          (camera as THREE.PerspectiveCamera).far = dist * 10;
          (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
        }
      });
    } else if (format === 'obj') {
      const loader = new OBJLoader();
      loader.load(url + cacheBuster, (obj) => {
        const box = new THREE.Box3().setFromObject(obj);
        const center = box.getCenter(new THREE.Vector3());
        obj.position.sub(center);
        setObject(obj);
        setGeometry(null);

        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        const dist = maxDim / (2 * Math.tan((50 * Math.PI) / 360));
        camera.position.set(dist * 0.8, dist * 0.6, dist * 0.8);
      });
    }
  }, [url, format, camera, meshVersion]);

  if (object) {
    return <primitive ref={meshRef} object={object} />;
  }

  if (!geometry) return null;

  return (
    <mesh ref={meshRef as never} geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color="#b0c4de" metalness={0.1} roughness={0.6} side={THREE.DoubleSide} />
    </mesh>
  );
}

function MeasurementOverlay() {
  const measurements = useStore((s) => s.measurements);

  return (
    <>
      {measurements.map((m) => {
        const mid = {
          x: (m.point_a.x + m.point_b.x) / 2,
          y: (m.point_a.y + m.point_b.y) / 2,
          z: (m.point_a.z + m.point_b.z) / 2,
        };
        return (
          <group key={m.id}>
            <line>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  args={[new Float32Array([m.point_a.x, m.point_a.y, m.point_a.z, m.point_b.x, m.point_b.y, m.point_b.z]), 3]}
                  count={2}
                  itemSize={3}
                />
              </bufferGeometry>
              <lineBasicMaterial color="#ff4444" linewidth={2} />
            </line>
            <Html position={[mid.x, mid.y, mid.z]} center>
              <div style={{
                background: 'rgba(0,0,0,0.8)',
                color: '#fff',
                padding: '2px 8px',
                borderRadius: 4,
                fontSize: 12,
                whiteSpace: 'nowrap',
              }}>
                {m.distance.toFixed(2)} mm
              </div>
            </Html>
          </group>
        );
      })}
    </>
  );
}

function ClickHandler() {
  const activeTool = useStore((s) => s.activeTool);
  const addMeasurement = useStore((s) => s.addMeasurement);
  const [firstPoint, setFirstPoint] = useState<THREE.Vector3 | null>(null);
  const { raycaster, scene, camera, pointer } = useThree();

  const handleClick = useCallback(() => {
    if (activeTool !== 'measure') return;

    raycaster.setFromCamera(pointer, camera);
    const meshes: THREE.Object3D[] = [];
    scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) meshes.push(obj);
    });

    const intersects = raycaster.intersectObjects(meshes, true);
    if (intersects.length === 0) return;

    const point = intersects[0].point;

    if (!firstPoint) {
      setFirstPoint(point.clone());
    } else {
      const dist = firstPoint.distanceTo(point);
      addMeasurement({
        id: crypto.randomUUID(),
        point_a: { x: firstPoint.x, y: firstPoint.y, z: firstPoint.z },
        point_b: { x: point.x, y: point.y, z: point.z },
        distance: dist,
      });
      setFirstPoint(null);
    }
  }, [activeTool, firstPoint, raycaster, scene, camera, pointer, addMeasurement]);

  useFrame(() => {});

  return <mesh visible={false} onClick={handleClick}><planeGeometry args={[10000, 10000]} /></mesh>;
}

export default function Viewer3D() {
  const currentModel = useStore((s) => s.currentModel);
  const modelUrl = currentModel ? `/api/models/${currentModel.id}/mesh-data` : null;
  const format = currentModel?.original_format || 'stl';
  const activeTool = useStore((s) => s.activeTool);

  return (
    <div style={{ width: '100%', height: '100%', background: '#1a1a2e' }}>
      <Canvas
        shadows
        camera={{ position: [150, 100, 150], fov: 50, near: 0.1, far: 10000 }}
        style={{ cursor: activeTool === 'measure' ? 'crosshair' : 'grab' }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[50, 100, 50]} intensity={0.8} castShadow />
        <directionalLight position={[-50, 50, -50]} intensity={0.3} />

        <Suspense fallback={
          <Html center>
            <div style={{ color: '#fff', fontSize: 16 }}>Cargando modelo...</div>
          </Html>
        }>
          {modelUrl && <ModelMesh url={modelUrl} format={format} />}
        </Suspense>

        <MeasurementOverlay />
        <ClickHandler />

        <Grid
          args={[500, 500]}
          cellSize={10}
          cellThickness={0.5}
          cellColor="#404060"
          sectionSize={50}
          sectionThickness={1}
          sectionColor="#606090"
          fadeDistance={500}
          position={[0, -0.01, 0]}
        />

        <OrbitControls makeDefault enableDamping dampingFactor={0.1} />

        <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
          <GizmoViewport labelColor="white" axisHeadScale={1} />
        </GizmoHelper>
      </Canvas>

      {!currentModel && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: '#8888aa',
          fontSize: 18,
          textAlign: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>&#9651;</div>
          Sube un modelo 3D para comenzar
        </div>
      )}
    </div>
  );
}
