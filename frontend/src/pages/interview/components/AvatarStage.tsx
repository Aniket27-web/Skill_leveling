import React, { Component, Suspense, useMemo, useRef, type ErrorInfo, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, Environment, OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { VRMLoaderPlugin, type VRM } from '@pixiv/three-vrm';

export type Viseme = 'neutral' | 'aa' | 'ee' | 'oh' | 'oo';
type AvatarStageProps = { speaking: boolean; listening: boolean; viseme: Viseme; className?: string };

class AvatarRenderBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    console.warn('3D interviewer avatar could not initialize:', error.message);
  }

  render() {
    if (this.state.failed) {
      return <div className="flex h-full min-h-[360px] flex-col items-center justify-center gap-3 bg-gradient-to-b from-slate-800 via-slate-900 to-[#111a28] px-6 text-center text-white sm:min-h-[480px]">
        <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-white/20 bg-[#d8a37f] text-4xl" aria-hidden="true">●</div>
        <p className="text-sm font-semibold">Interviewer avatar unavailable</p>
        <p className="max-w-xs text-xs text-white/65">Your audio interview is still ready. You can continue listening and answering.</p>
      </div>;
    }
    return this.props.children;
  }
}

function PlaceholderAvatar({ speaking, listening, viseme }: AvatarStageProps) {
  const head = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Mesh>(null);
  const mouth = useRef<THREE.Mesh>(null);
  const lids = useRef<THREE.Mesh[]>([]);
  const blinkAt = useRef(2.5);
  const blink = useRef(0);
  const color = useMemo(() => new THREE.Color('#d8a37f'), []);

  useFrame(({ clock }, delta) => {
    const time = clock.getElapsedTime();
    if (head.current) {
      head.current.rotation.y = Math.sin(time * 0.48) * 0.07 + (listening ? Math.sin(time * 2.1) * 0.025 : 0);
      head.current.rotation.x = Math.sin(time * 0.31) * 0.025 + (listening ? 0.035 : 0);
    }
    if (torso.current) torso.current.position.y = -0.22 + Math.sin(time * 1.5) * 0.012;
    if (time >= blinkAt.current) {
      blink.current = 1;
      blinkAt.current = time + 2.2 + Math.random() * 3.3;
    }
    blink.current = Math.max(0, blink.current - delta * 8);
    lids.current.forEach((lid) => { if (lid) lid.scale.y = 0.01 + blink.current * 0.48; });
    if (mouth.current) {
      const visemeOpen = viseme === 'aa' ? 0.24 : viseme === 'oh' ? 0.18 : viseme === 'oo' ? 0.12 : viseme === 'ee' ? 0.075 : 0.018;
      mouth.current.scale.y = THREE.MathUtils.damp(mouth.current.scale.y, speaking ? visemeOpen : 0.018, 14, delta);
      mouth.current.scale.x = viseme === 'ee' ? 0.19 : viseme === 'oo' ? 0.09 : 0.14;
    }
  });

  return <group position={[0, -0.98, 0]}>
    <mesh ref={torso} position={[0, -0.22, 0]} castShadow><capsuleGeometry args={[0.46, 0.9, 6, 16]} /><meshStandardMaterial color="#23334d" roughness={0.76} /></mesh>
    <mesh position={[0, 0.23, 0.04]}><capsuleGeometry args={[0.2, 0.24, 4, 12]} /><meshStandardMaterial color={color} roughness={0.82} /></mesh>
    <group ref={head} position={[0, 0.84, 0]}>
      <mesh castShadow><sphereGeometry args={[0.48, 32, 32]} /><meshStandardMaterial color={color} roughness={0.82} /></mesh>
      <mesh position={[0, 0.31, -0.01]}><sphereGeometry args={[0.47, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.48]} /><meshStandardMaterial color="#30251f" roughness={0.9} /></mesh>
      {[-0.17, 0.17].map((x, index) => <group key={x} position={[x, 0.05, 0.41]}>
        <mesh><sphereGeometry args={[0.075, 18, 16]} /><meshStandardMaterial color="#fffdf8" roughness={0.35} /></mesh>
        <mesh position={[0, 0, 0.062]}><sphereGeometry args={[0.034, 12, 12]} /><meshStandardMaterial color="#344761" roughness={0.25} /></mesh>
        <mesh ref={(node) => { if (node) lids.current[index] = node; }} position={[0, 0.055, 0.02]} scale={[1.18, 0.01, 0.25]}><sphereGeometry args={[0.071, 16, 12]} /><meshStandardMaterial color={color} roughness={0.82} /></mesh>
      </group>)}
      <mesh position={[0, -0.03, 0.46]}><sphereGeometry args={[0.06, 12, 12]} /><meshStandardMaterial color="#bd8667" roughness={0.8} /></mesh>
      <mesh ref={mouth} position={[0, -0.19, 0.433]} scale={[0.14, 0.018, 0.04]}><sphereGeometry args={[1, 20, 14]} /><meshStandardMaterial color="#5c2430" roughness={0.45} /></mesh>
      <mesh position={[0, -0.11, 0.429]} scale={[0.18, 0.025, 0.02]}><sphereGeometry args={[1, 20, 12]} /><meshStandardMaterial color="#9e5d56" roughness={0.6} /></mesh>
    </group>
  </group>;
}

function LoadedAvatar({ url, speaking, listening, viseme }: AvatarStageProps & { url: string }) {
  const gltf = useGLTF(url, true, true, (loader) => {
    // three-vrm currently types against @types/three while drei uses three-stdlib's loader types.
    (loader as any).register((parser: any) => new VRMLoaderPlugin(parser) as any);
  });
  const scene = gltf.scene;
  const vrm = gltf.userData.vrm as VRM | undefined;
  const meshes = useMemo(() => {
    const result: THREE.Mesh[] = [];
    scene.traverse((node) => { if ((node as THREE.Mesh).isMesh && (node as THREE.Mesh).morphTargetDictionary) result.push(node as THREE.Mesh); });
    return result;
  }, [scene]);
  const head = useRef<THREE.Group>(null);
  useFrame(({ clock }, delta) => {
    if (head.current) {
      head.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.42) * 0.06 + (listening ? 0.025 : 0);
    }
    const names = viseme === 'neutral' ? [] : [viseme, `viseme_${viseme}`, `mouth${viseme.toUpperCase()}`, 'jawOpen', 'mouthOpen'];
    for (const mesh of meshes) {
      const dictionary = mesh.morphTargetDictionary || {};
      const influences = mesh.morphTargetInfluences || [];
      for (const [name, index] of Object.entries(dictionary)) {
        const normalized = name.toLowerCase();
        const targetName = names.find((candidate) => normalized.includes(candidate.toLowerCase()));
        const target = speaking && targetName ? (targetName === 'jawOpen' || targetName === 'mouthOpen' ? 0.5 : 0.7) : 0;
        influences[index] = THREE.MathUtils.damp(influences[index] || 0, target, 12, delta);
      }
    }
    if (vrm?.expressionManager) {
      const expressionNames = ['aa', 'ee', 'oh', 'ou'];
      expressionNames.forEach((name) => vrm.expressionManager?.setValue(name, 0));
      if (speaking && viseme !== 'neutral') {
        const expression = viseme === 'oo' ? 'ou' : viseme;
        vrm.expressionManager.setValue(expression, 0.8);
      }
      vrm.update(delta);
    }
  });
  return <group ref={head} position={[0, -1.1, 0]} scale={1.8}><primitive object={scene} /></group>;
}

const configuredAvatar = import.meta.env.VITE_INTERVIEWER_MODEL_URL as string | undefined;

export const AvatarStage: React.FC<AvatarStageProps> = ({ className, ...props }) => <div className={`relative overflow-hidden bg-gradient-to-b from-slate-800 via-slate-900 to-[#111a28] ${className || 'h-[360px] rounded-2xl sm:h-[480px]'}`}>
  <AvatarRenderBoundary>
  <Canvas camera={{ position: [0, 0.15, 4.2], fov: 36 }} dpr={[1, 1.5]} shadows gl={{ antialias: true, alpha: false }}>
    <color attach="background" args={['#111a28']} />
    <ambientLight intensity={0.8} />
    <directionalLight position={[3, 5, 4]} intensity={2.1} castShadow />
    <Environment preset="studio" />
    <Suspense fallback={<PlaceholderAvatar {...props} />}>
      {configuredAvatar ? <LoadedAvatar url={configuredAvatar} {...props} /> : <PlaceholderAvatar {...props} />}
    </Suspense>
    <ContactShadows position={[0, -1.8, 0]} opacity={0.28} scale={4} blur={2.5} far={3} />
    <OrbitControls enablePan={false} enableZoom={false} minPolarAngle={1.35} maxPolarAngle={1.7} target={[0, -0.05, 0]} />
  </Canvas>
  </AvatarRenderBoundary>
  <div className="pointer-events-none absolute bottom-4 left-4 rounded-full border border-white/10 bg-slate-950/50 px-3 py-1.5 text-[11px] font-medium text-white/80 backdrop-blur">{props.speaking ? 'Interviewer speaking' : props.listening ? 'Listening to you' : 'Ready for your answer'}</div>
</div>;
