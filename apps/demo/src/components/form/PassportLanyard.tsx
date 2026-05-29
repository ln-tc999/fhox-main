"use client";

/* eslint-disable react/no-unknown-property */
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, extend, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import {
  BallCollider,
  CuboidCollider,
  Physics,
  RigidBody,
  useRopeJoint,
  useSphericalJoint,
  type RapierRigidBody,
} from "@react-three/rapier";
import { MeshLineGeometry, MeshLineMaterial } from "meshline";
import * as THREE from "three";

// Module-level guard: `extend` registers the meshline elements globally.
// In dev with HMR this module may re-execute; the registry no-ops on dupes.
extend({ MeshLineGeometry, MeshLineMaterial });

type LanyardProps = {
  legalName: string;
  tokenId: string;
  manager: string;
  jurisdiction?: string;
};

function PassportLanyardImpl(props: LanyardProps) {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 768,
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div className="relative w-full h-[480px] md:h-[560px] select-none">
      <Canvas
        // Capping DPR at 1.5 cuts framebuffer memory ~44% on retina without
        // visibly degrading the gold/bone palette we're rendering.
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 20], fov: 20 }}
        gl={{
          alpha: true,
          antialias: true,
          powerPreference: "high-performance",
          failIfMajorPerformanceCaveat: false,
          preserveDrawingBuffer: false,
          // Discourage the browser from keeping more contexts than necessary.
          stencil: false,
          depth: true,
        }}
        // Keep the canvas alive when the entity changes (we still re-key on
        // unmount via the parent) but stop wasting GPU when nothing's moving.
        // Rapier wakes bodies on interaction, which re-invalidates the loop.
        frameloop="always"
        onCreated={({ gl, invalidate }) => {
          gl.setClearColor(new THREE.Color(0x000000), 0);
          const canvas = gl.domElement;
          // Browser is asking to drop our context — accept gracefully so it
          // can offer a `restore` event later. Without preventDefault() the
          // context is gone permanently.
          const onLost = (e: Event) => {
            e.preventDefault();
            console.warn("[fhox] WebGL context lost; awaiting restore");
          };
          const onRestored = () => {
            console.info("[fhox] WebGL context restored; resuming render");
            invalidate();
          };
          canvas.addEventListener("webglcontextlost", onLost, false);
          canvas.addEventListener("webglcontextrestored", onRestored, false);
          // R3F doesn't expose a teardown hook tied to onCreated, so dispose
          // the renderer + listeners via the Three.js dispose chain below.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (gl as any).userData.cleanup = () => {
            canvas.removeEventListener("webglcontextlost", onLost);
            canvas.removeEventListener("webglcontextrestored", onRestored);
          };
        }}
      >
        <CanvasCleanup />
        <ambientLight intensity={Math.PI * 0.7} />
        <Physics gravity={[0, -40, 0]} timeStep={isMobile ? 1 / 30 : 1 / 60}>
          <Band isMobile={isMobile} {...props} />
        </Physics>
        <Environment blur={0.85}>
          <Lightformer intensity={2} color="#fff5e0" position={[0, -1, 5]} rotation={[0, 0, Math.PI / 3]} scale={[100, 0.1, 1]} />
          <Lightformer intensity={3} color="#ffe9b3" position={[-1, -1, 1]} rotation={[0, 0, Math.PI / 3]} scale={[100, 0.1, 1]} />
          <Lightformer intensity={3} color="white" position={[1, 1, 1]} rotation={[0, 0, Math.PI / 3]} scale={[100, 0.1, 1]} />
          <Lightformer intensity={8} color="#fff" position={[-10, 0, 14]} rotation={[0, Math.PI / 2, Math.PI / 3]} scale={[100, 10, 1]} />
        </Environment>
      </Canvas>
      <div className="pointer-events-none absolute bottom-4 left-0 right-0 text-center text-[10px] tracking-[0.42em] uppercase text-stone/50">
        Drag the passport
      </div>
    </div>
  );
}

/**
 * Memoized export: when the entity address doesn't change, re-renders of the
 * surrounding form/page don't re-instantiate the entire R3F tree. This is the
 * single biggest defense against Fast-Refresh-induced context exhaustion.
 */
export const PassportLanyard = memo(PassportLanyardImpl, (prev, next) => {
  return (
    prev.manager === next.manager &&
    prev.tokenId === next.tokenId &&
    prev.legalName === next.legalName
  );
});

/**
 * Mounted inside the Canvas tree so it has access to the R3F renderer.
 * Runs the listener-teardown function we stashed in `gl.userData.cleanup`
 * during onCreated, and explicitly disposes the WebGL context on unmount —
 * critical for releasing the GPU slot before a fresh canvas claims it.
 */
function CanvasCleanup() {
  const { gl } = useThree();
  useEffect(() => {
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cleanup = (gl as any).userData.cleanup as (() => void) | undefined;
      cleanup?.();
      gl.dispose();
      // forceContextLoss frees the slot immediately rather than waiting on GC
      const ext = gl.getContext().getExtension("WEBGL_lose_context");
      ext?.loseContext();
    };
  }, [gl]);
  return null;
}

function Band({
  isMobile,
  legalName,
  tokenId,
  manager,
  jurisdiction = "WY",
}: {
  isMobile: boolean;
} & LanyardProps) {
  const band = useRef<THREE.Mesh & { geometry: { setPoints: (pts: THREE.Vector3[]) => void } }>(null);
  const fixed = useRef<RapierRigidBody>(null);
  const j1 = useRef<RapierRigidBody & { lerped?: THREE.Vector3 }>(null);
  const j2 = useRef<RapierRigidBody & { lerped?: THREE.Vector3 }>(null);
  const j3 = useRef<RapierRigidBody>(null);
  const card = useRef<RapierRigidBody>(null);

  const vec = useMemo(() => new THREE.Vector3(), []);
  const ang = useMemo(() => new THREE.Vector3(), []);
  const rot = useMemo(() => new THREE.Vector3(), []);
  const dir = useMemo(() => new THREE.Vector3(), []);

  const segmentProps = {
    type: "dynamic" as const,
    canSleep: true,
    colliders: false as const,
    angularDamping: 4,
    linearDamping: 4,
  };

  const [curve] = useState(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(),
        new THREE.Vector3(),
        new THREE.Vector3(),
        new THREE.Vector3(),
      ]),
  );

  const [dragged, drag] = useState<false | THREE.Vector3>(false);
  const [hovered, hover] = useState(false);

  useRopeJoint(fixed, j1, [[0, 0, 0], [0, 0, 0], 1]);
  useRopeJoint(j1, j2, [[0, 0, 0], [0, 0, 0], 1]);
  useRopeJoint(j2, j3, [[0, 0, 0], [0, 0, 0], 1]);
  useSphericalJoint(j3, card, [
    [0, 0, 0],
    [0, 1.45, 0],
  ]);

  useEffect(() => {
    if (hovered) {
      document.body.style.cursor = dragged ? "grabbing" : "grab";
      return () => void (document.body.style.cursor = "auto");
    }
  }, [hovered, dragged]);

  const frontTexture = usePassportTexture({ legalName, tokenId, manager, jurisdiction });

  useFrame((state, delta) => {
    if (dragged && card.current) {
      vec.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera);
      dir.copy(vec).sub(state.camera.position).normalize();
      vec.add(dir.multiplyScalar(state.camera.position.length()));
      [card, j1, j2, j3, fixed].forEach((r) => r.current?.wakeUp());
      card.current.setNextKinematicTranslation({
        x: vec.x - dragged.x,
        y: vec.y - dragged.y,
        z: vec.z - dragged.z,
      });
    }
    if (fixed.current && j1.current && j2.current && j3.current && card.current && band.current) {
      [j1, j2].forEach((ref) => {
        const r = ref.current!;
        if (!r.lerped) r.lerped = new THREE.Vector3().copy(r.translation());
        const clamped = Math.max(0.1, Math.min(1, r.lerped.distanceTo(r.translation())));
        r.lerped.lerp(r.translation(), delta * (0 + clamped * 50));
      });
      curve.points[0].copy(j3.current.translation());
      curve.points[1].copy(j2.current.lerped!);
      curve.points[2].copy(j1.current.lerped!);
      curve.points[3].copy(fixed.current.translation());
      band.current.geometry.setPoints(curve.getPoints(isMobile ? 16 : 32));
      ang.copy(card.current.angvel() as unknown as THREE.Vector3);
      rot.copy(card.current.rotation() as unknown as THREE.Vector3);
      card.current.setAngvel({ x: ang.x, y: ang.y - rot.y * 0.25, z: ang.z });
    }
  });

  curve.curveType = "chordal";

  return (
    <>
      <group position={[0, 4, 0]}>
        <RigidBody ref={fixed} {...segmentProps} type="fixed" />
        <RigidBody position={[0.5, 0, 0]} ref={j1} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[1, 0, 0]} ref={j2} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[1.5, 0, 0]} ref={j3} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody
          position={[2, 0, 0]}
          ref={card}
          {...segmentProps}
          type={dragged ? "kinematicPosition" : "dynamic"}
        >
          <CuboidCollider args={[0.8, 1.125, 0.02]} />
          <group
            scale={1}
            onPointerOver={() => hover(true)}
            onPointerOut={() => hover(false)}
            onPointerUp={(e) => {
              (e.target as Element).releasePointerCapture(e.pointerId);
              drag(false);
            }}
            onPointerDown={(e) => {
              (e.target as Element).setPointerCapture(e.pointerId);
              drag(
                new THREE.Vector3()
                  .copy(e.point)
                  .sub(vec.copy(card.current!.translation() as unknown as THREE.Vector3)),
              );
            }}
          >
            {/* card body */}
            <mesh>
              <boxGeometry args={[1.6, 2.25, 0.04]} />
              <meshPhysicalMaterial
                color="#0a0807"
                roughness={0.55}
                metalness={0.3}
                clearcoat={isMobile ? 0 : 1}
                clearcoatRoughness={0.18}
              />
            </mesh>
            {/* front face (printed) */}
            <mesh position={[0, 0, 0.021]}>
              <planeGeometry args={[1.55, 2.2]} />
              <meshBasicMaterial map={frontTexture} toneMapped={false} />
            </mesh>
            {/* back face (sealed) */}
            <mesh position={[0, 0, -0.021]} rotation={[0, Math.PI, 0]}>
              <planeGeometry args={[1.55, 2.2]} />
              <meshBasicMaterial color="#0a0807" toneMapped={false} />
            </mesh>
            {/* metal clamp */}
            <mesh position={[0, 1.18, 0]}>
              <boxGeometry args={[0.45, 0.16, 0.08]} />
              <meshPhysicalMaterial color="#c8a45d" metalness={1} roughness={0.25} />
            </mesh>
            {/* clip ring */}
            <mesh position={[0, 1.36, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.1, 0.024, 16, 32]} />
              <meshPhysicalMaterial color="#c8a45d" metalness={1} roughness={0.25} />
            </mesh>
          </group>
        </RigidBody>
      </group>
      <mesh ref={band as unknown as React.RefObject<THREE.Mesh>}>
        {/* @ts-expect-error — extended from meshline */}
        <meshLineGeometry />
        {/* @ts-expect-error — extended from meshline */}
        <meshLineMaterial
          color="#c8a45d"
          depthTest={false}
          resolution={isMobile ? [1000, 2000] : [1000, 1000]}
          lineWidth={0.55}
        />
      </mesh>
    </>
  );
}

/** Builds a CanvasTexture rendered into the front face of the passport. */
function usePassportTexture({
  legalName,
  tokenId,
  manager,
  jurisdiction,
}: {
  legalName: string;
  tokenId: string;
  manager: string;
  jurisdiction: string;
}) {
  return useMemo(() => {
    if (typeof document === "undefined") return new THREE.Texture();
    const W = 620;
    const H = 880;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d")!;

    // background — deep ox-blood
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#100b08");
    grad.addColorStop(1, "#050505");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // gold border
    ctx.strokeStyle = "#c8a45d";
    ctx.lineWidth = 4;
    ctx.strokeRect(28, 28, W - 56, H - 56);

    // inner hairline border
    ctx.strokeStyle = "rgba(200,164,93,0.4)";
    ctx.lineWidth = 1;
    ctx.strokeRect(40, 40, W - 80, H - 80);

    // corner ornaments
    drawCorner(ctx, 28, 28, 1, 1);
    drawCorner(ctx, W - 28, 28, -1, 1);
    drawCorner(ctx, 28, H - 28, 1, -1);
    drawCorner(ctx, W - 28, H - 28, -1, -1);

    // header rubric
    ctx.fillStyle = "#c8a45d";
    ctx.font = "300 18px 'Cormorant Garamond', Garamond, serif";
    ctx.textAlign = "center";
    ctx.letterSpacing = "0.42em";
    ctx.fillText("CORPUS PASSPORT", W / 2, 92);

    // hairline rule
    ctx.fillStyle = "#c8a45d";
    ctx.fillRect(W / 2 - 28, 108, 56, 1);

    // vessel mark (procedural — abstracted version of the logo)
    drawVessel(ctx, W / 2, 230, 90);

    // outer ring around seal
    ctx.strokeStyle = "rgba(200,164,93,0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(W / 2, 230, 120, 0, Math.PI * 2);
    ctx.stroke();

    // legal name
    ctx.fillStyle = "#f4efe7";
    ctx.font = "300 36px 'Cormorant Garamond', Garamond, serif";
    ctx.textAlign = "center";
    const name = truncate(legalName, 26);
    ctx.fillText(name, W / 2, 430);

    // gold dot
    ctx.fillStyle = "#c8a45d";
    ctx.beginPath();
    ctx.arc(W / 2, 470, 3, 0, Math.PI * 2);
    ctx.fill();

    // status
    ctx.fillStyle = "#58d68d";
    ctx.font = "300 13px 'Cormorant Garamond', Garamond, serif";
    ctx.fillText("· ACTIVE  ·  ON-CHAIN ·", W / 2, 510);

    // grid of fields
    const fieldY = 580;
    drawField(ctx, W / 4, fieldY, "JURISDICTION", `${jurisdiction} · WY DAO LLC`);
    drawField(ctx, (3 * W) / 4, fieldY, "IDENTITY TOKEN", `#${tokenId}`);
    drawField(ctx, W / 4, fieldY + 100, "MANAGER", `${manager.slice(0, 6)}…${manager.slice(-4)}`);
    drawField(ctx, (3 * W) / 4, fieldY + 100, "ENTITY TYPE", "ALGORITHMIC LLC");

    // footer
    ctx.fillStyle = "rgba(200,164,93,0.6)";
    ctx.font = "300 11px 'Cormorant Garamond', Garamond, serif";
    ctx.fillText("ARBITRUM SEPOLIA · CHAIN 421614", W / 2, H - 70);
    ctx.fillStyle = "rgba(244,239,231,0.5)";
    ctx.font = "300 10px ui-monospace, Menlo, monospace";
    ctx.fillText("ERC-8004 · WYOMING · CORPUS V0.1", W / 2, H - 50);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 16;
    tex.needsUpdate = true;
    return tex;
  }, [legalName, tokenId, manager, jurisdiction]);
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function drawCorner(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  sx: number,
  sy: number,
) {
  ctx.strokeStyle = "#c8a45d";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x + sx * 22, y);
  ctx.lineTo(x, y);
  ctx.lineTo(x, y + sy * 22);
  ctx.stroke();
}

function drawField(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  label: string,
  value: string,
) {
  ctx.fillStyle = "rgba(155,148,138,0.7)";
  ctx.font = "300 10px ui-monospace, Menlo, monospace";
  ctx.textAlign = "center";
  ctx.fillText(label, cx, cy);
  ctx.fillStyle = "#f4efe7";
  ctx.font = "300 16px 'Cormorant Garamond', Garamond, serif";
  ctx.fillText(value, cx, cy + 28);
}

/** Abstracted vessel/chalice mark — bone white with gold spine, evoking the CORPUS logo. */
function drawVessel(ctx: CanvasRenderingContext2D, cx: number, cy: number, h: number) {
  ctx.save();
  ctx.translate(cx, cy);

  // body
  ctx.fillStyle = "#f4efe7";
  ctx.beginPath();
  ctx.moveTo(0, -h);
  ctx.bezierCurveTo(-h * 0.55, -h * 0.7, -h * 0.6, h * 0.45, 0, h * 0.5);
  ctx.bezierCurveTo(h * 0.6, h * 0.45, h * 0.55, -h * 0.7, 0, -h);
  ctx.closePath();
  ctx.fill();

  // inner shadow
  const g = ctx.createLinearGradient(0, -h, 0, h * 0.5);
  g.addColorStop(0, "rgba(0,0,0,0.0)");
  g.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = g;
  ctx.fill();

  // vertical spine
  ctx.strokeStyle = "rgba(200,164,93,0.85)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -h * 1.08);
  ctx.lineTo(0, h * 0.55);
  ctx.stroke();

  // top + bottom anchor dots
  ctx.fillStyle = "#c8a45d";
  ctx.beginPath();
  ctx.arc(0, -h * 1.08, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, h * 0.6, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
