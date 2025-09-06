import type { Vec2, Transform, BodyId, Material } from '../../engine/core/primitives'
import type {
  PhysicsService,
  BodyOpts, BodyType, Shape, ShapeBox, ShapeCircle, ShapeCapsule,
} from './types'

import RAPIER from "@dimforge/rapier2d-simd-compat";

// Feature-detect ActiveEvents flags (older builds may lack INTERSECTION_EVENTS)
const AE = RAPIER.ActiveEvents as any;
const AE_COLLISION: number = AE?.COLLISION_EVENTS ?? 0;
const AE_INTERSECTION: number = AE?.INTERSECTION_EVENTS ?? 0;

// ------------------------------------------------------------
// Small helpers
// ------------------------------------------------------------
const toRapier = (p: Vec2) => new RAPIER.Vector2(p.x, p.y);
const fromRapier = (v2: { x: number; y: number }): Vec2 => ({ x: v2.x, y: v2.y });

function toRapierType(t: BodyType): RAPIER.RigidBodyType {
  switch (t) {
    case "dynamic": return RAPIER.RigidBodyType.Dynamic;
    case "kinematic": return RAPIER.RigidBodyType.KinematicPositionBased;
    case "static": return RAPIER.RigidBodyType.Fixed;
    default: return RAPIER.RigidBodyType.Dynamic;
  }
}

// Numeric collision-groups encoding compatible across Rapier versions:
// groups = (filter << 16) | membership
function buildGroups(m?: Material): number {
  const membership = (m?.categoryBits ?? 0x0001) & 0xffff;
  const filter = (m?.maskBits ?? 0xffff) & 0xffff;
  return (filter << 16) | membership;
}

// Helper used for manual filtering in queries where newer filter APIs aren’t available.
function matchesMask(col: RAPIER.Collider, maskBits?: number): boolean {
  if (maskBits == null) return true;
  const g = (col as any).collisionGroups?.() ?? 0xffffffff;
  const membership = g & 0xffff;
  return (membership & (maskBits & 0xffff)) !== 0;
}

type BodyHandle = {
  rb: RAPIER.RigidBody;
  colliders: RAPIER.Collider[];
  type: BodyType;
  userData?: unknown;
  allowSleep: boolean;
  gravityScale: number;
  fixedRotation: boolean;
};

let NEXT_ID = 1 as BodyId;

// ------------------------------------------------------------
// Rapier-backed PhysicsService
// ------------------------------------------------------------
export class RapierPhysicsService implements PhysicsService {
  private world!: RAPIER.World;
  private time = 0;
  private gravity: Vec2 = { x: 0, y: 9.81 }; // Y-down by default

  private bodies = new Map<BodyId, BodyHandle>();
  private idFromRbHandle = new Map<number, BodyId>();

  // Contact event system
  private eventQueue: RAPIER.EventQueue | undefined;
  private beginListeners = new Set<(a: BodyId, b: BodyId) => void>();
  private endListeners = new Set<(a: BodyId, b: BodyId) => void>();

  // ──────────────────────────────────────────────────────────
  // Lifecycle
  // ──────────────────────────────────────────────────────────
  /* internal */ _initAfterWasm(): void {
  this.world = new RAPIER.World(toRapier(this.gravity));
  // Feature-detect EventQueue (older builds may not expose it)
  const EQ: any = (RAPIER as any).EventQueue;
  if (EQ) this.eventQueue = new EQ(true);
}


  // ──────────────────────────────────────────────────────────
  // Time & gravity
  // ──────────────────────────────────────────────────────────
  step(dt: number, substeps = 1): void {
    if (!this.world) return;
    const steps = Math.max(1, (substeps | 0));
    const clamped = Math.max(0, Math.min(dt, 0.1));
    const h = clamped / steps;

    this.world.integrationParameters.dt = h;

    for (let i = 0; i < steps; i++) {
      this.world.step(this.eventQueue);

      if (!this.eventQueue) continue;

      // Drain collision begin/end (present on all builds with events)
      this.eventQueue.drainCollisionEvents((h1: number, h2: number, started: boolean) => {
        const c1 = this.world.colliders.get(h1);
        const c2 = this.world.colliders.get(h2);
        const id1 = this.lookupBodyId(c1?.parent()?.handle);
        const id2 = this.lookupBodyId(c2?.parent()?.handle);
        if (id1 == null || id2 == null) return;

        const bag = started ? this.beginListeners : this.endListeners;
        for (const fn of bag) fn(id1, id2);
      });

      // Drain intersection begin/end **only if** the method exists on this build
      const dq: any = this.eventQueue as any;
      if (typeof dq.drainIntersectionEvents === "function") {
        dq.drainIntersectionEvents((h1: number, h2: number, intersecting: boolean) => {
          const c1 = this.world.colliders.get(h1);
          const c2 = this.world.colliders.get(h2);
          const id1 = this.lookupBodyId(c1?.parent()?.handle);
          const id2 = this.lookupBodyId(c2?.parent()?.handle);
          if (id1 == null || id2 == null) return;

          const bag = intersecting ? this.beginListeners : this.endListeners;
          for (const fn of bag) fn(id1, id2);
        });
      }

      this.time += h;
    }
  }

  setGravity(g: Vec2): void {
    this.gravity = { x: g.x, y: g.y };
    if (this.world) {
      // Prefer setter if present; otherwise assign
      (this.world as any).setGravity?.(toRapier(this.gravity)) ??
        ((this.world as any).gravity = toRapier(this.gravity));
    }
  }

  getGravity(): Vec2 {
    return { ...this.gravity };
  }

  // ──────────────────────────────────────────────────────────
  // Bodies
  // ──────────────────────────────────────────────────────────
  createBody(opts: BodyOpts): BodyId {
    const type = opts.type ?? "dynamic";

    const rbDesc = new RAPIER.RigidBodyDesc(toRapierType(type))
      .setTranslation(opts.position?.x ?? 0, opts.position?.y ?? 0)
      .setRotation(opts.angle ?? 0)
      .setLinearDamping(opts.linearDamping ?? 0)
      .setAngularDamping(opts.angularDamping ?? 0)
      .setCanSleep(opts.allowSleep ?? true)
      .setCcdEnabled(!!opts.bullet);

    // lock rotations on the descriptor if available; otherwise we’ll set inertia / runtime lock after creation
    if (opts.fixedRotation) {
      (rbDesc as any).lockRotations?.();
    }

    rbDesc.setGravityScale(type === "dynamic" ? (opts.gravityScale ?? 1) : 0);

    if (opts.linearVelocity) rbDesc.setLinvel(opts.linearVelocity.x, opts.linearVelocity.y);
    if (opts.angularVelocity != null) rbDesc.setAngvel(opts.angularVelocity);

    const rb = this.world.createRigidBody(rbDesc);

    // If descriptor API lacked rotation locking, try runtime lock; otherwise huge inertia fallback
    if (opts.fixedRotation && !(rbDesc as any).lockRotations) {
      try {
        (rb as any).setEnabledRotations?.(false, false, false);
        if (!(rb as any).setEnabledRotations) {
          const m = rb.mass();
          (rb as any).setAdditionalMassProperties?.(m, /*angular inertia*/ 1e12, true);
        }
      } catch {
        // ignore if API not present
      }
    }

    const colliders: RAPIER.Collider[] = [];
    for (const fx of opts.shapes) {
      const cDesc = this.makeColliderDesc(fx.shape, fx.material);
      const col = this.world.createCollider(cDesc, rb);
      colliders.push(col);
    }

    const id = NEXT_ID++ as BodyId;
    this.bodies.set(id, {
      rb,
      colliders,
      type,
      userData: opts.userData,
      allowSleep: opts.allowSleep ?? true,
      gravityScale: rb.gravityScale(),
      fixedRotation: !!opts.fixedRotation,
    });
    this.idFromRbHandle.set(rb.handle, id);
    return id;
  }

  removeBody(id: BodyId): boolean {
    const h = this.bodies.get(id);
    if (!h) return false;

    for (const col of h.colliders) this.world.removeCollider(col, true);
    this.world.removeRigidBody(h.rb);

    this.idFromRbHandle.delete(h.rb.handle);
    this.bodies.delete(id);
    return true;
  }

  // ──────────────────────────────────────────────────────────
  // Transforms
  // ──────────────────────────────────────────────────────────
  getTransform(id: BodyId): Transform | null {
    const h = this.bodies.get(id);
    if (!h) return null;
    const t = h.rb.translation();
    return { x: t.x, y: t.y, angle: h.rb.rotation() };
  }

  warpTransform(id: BodyId, t: Transform): boolean {
    const h = this.bodies.get(id);
    if (!h) return false;
    h.rb.setTranslation(toRapier({ x: t.x, y: t.y }), true);
    h.rb.setRotation(t.angle, true);
    h.rb.wakeUp();
    return true;
  }

  setKinematicTarget(id: BodyId, t: Partial<Transform>): boolean {
    const h = this.bodies.get(id);
    if (!h || h.type !== "kinematic") return false;
    const cur = this.getTransform(id)!;

    if (t.x != null || t.y != null) {
      const x = t.x ?? cur.x;
      const y = t.y ?? cur.y;
      h.rb.setNextKinematicTranslation({ x, y });
    }
    if (t.angle != null) {
      h.rb.setNextKinematicRotation(t.angle);
    }
    h.rb.wakeUp();
    return true;
  }

  // ──────────────────────────────────────────────────────────
  // Velocities
  // ──────────────────────────────────────────────────────────
  getVelocity(id: BodyId): { vx: number; vy: number; w: number } | null {
    const h = this.bodies.get(id);
    if (!h) return null;
    const lv = h.rb.linvel();
    return { vx: lv.x, vy: lv.y, w: h.rb.angvel() };
  }

  setVelocity(id: BodyId, v: { vx: number; vy: number; w?: number }): boolean {
    const h = this.bodies.get(id);
    if (!h) return false;
    h.rb.setLinvel({ x: v.vx, y: v.vy }, true);
    if (v.w != null) h.rb.setAngvel(v.w, true);
    h.rb.wakeUp();
    return true;
  }

  // ──────────────────────────────────────────────────────────
  // Forces / Impulses
  // ──────────────────────────────────────────────────────────
  applyForce(id: BodyId, force: Vec2, worldPoint?: Vec2): boolean {
    const h = this.bodies.get(id);
    if (!h || h.type !== "dynamic") return false;
    if (worldPoint) {
      h.rb.addForceAtPoint(toRapier(force), toRapier(worldPoint), true);
    } else {
      h.rb.addForce(toRapier(force), true);
    }
    h.rb.wakeUp();
    return true;
  }

  applyTorque(id: BodyId, torque: number): boolean {
    const h = this.bodies.get(id);
    if (!h || h.type !== "dynamic") return false;
    h.rb.addTorque(torque, true);
    h.rb.wakeUp();
    return true;
  }

  applyLinearImpulse(id: BodyId, impulse: Vec2, worldPoint?: Vec2): boolean {
    const h = this.bodies.get(id);
    if (!h || h.type !== "dynamic") return false;
    if (worldPoint) {
      h.rb.applyImpulseAtPoint(toRapier(impulse), toRapier(worldPoint), true);
    } else {
      h.rb.applyImpulse(toRapier(impulse), true);
    }
    h.rb.wakeUp();
    return true;
  }

  applyAngularImpulse(id: BodyId, impulse: number): boolean {
    const h = this.bodies.get(id);
    if (!h || h.type !== "dynamic") return false;
    h.rb.applyTorqueImpulse(impulse, true);
    h.rb.wakeUp();
    return true;
  }

  // ──────────────────────────────────────────────────────────
  // Sleeping & flags
  // ──────────────────────────────────────────────────────────
  isSleeping(id: BodyId): boolean {
    const h = this.bodies.get(id);
    if (!h) return false;
    return h.rb.isSleeping();
  }

  wake(id: BodyId): boolean {
    const h = this.bodies.get(id);
    if (!h) return false;
    h.rb.wakeUp();
    return true;
  }

  // ──────────────────────────────────────────────────────────
  // Queries
  // ──────────────────────────────────────────────────────────
  raycast(
    p1: Vec2,
    p2: Vec2,
    maskBits?: number
  ): Array<{ id: BodyId; point: Vec2; normal: Vec2; fraction: number }> {
    const dir = { x: p2.x - p1.x, y: p2.y - p1.y };
    const len = Math.hypot(dir.x, dir.y) || 1e-9;
    const ray = new RAPIER.Ray(toRapier(p1), { x: dir.x / len, y: dir.y / len });

    const hits: Array<{ id: BodyId; point: Vec2; normal: Vec2; fraction: number }> = [];
    let maxToi = 1.0;

    // Collect multiple hits by shrinking the ray; filter manually by maskBits.
    for (; ;) {
      const hit: any = this.world.castRay(ray, maxToi, true);
      if (!hit) break;

      const col: RAPIER.Collider = hit.collider;
      if (!matchesMask(col, maskBits)) {
        maxToi = hit.toi - 1e-6;
        if (maxToi <= 0) break;
        continue;
      }

      const id = this.lookupBodyId(col.parent()?.handle);
      if (id == null) {
        maxToi = hit.toi - 1e-6;
        if (maxToi <= 0) break;
        continue;
      }

      hits.push({
        id,
        point: fromRapier(ray.pointAt(hit.toi)),
        normal: fromRapier(hit.normal ?? { x: 0, y: 0 }),
        fraction: hit.toi,
      });

      maxToi = hit.toi - 1e-6;
      if (maxToi <= 0) break;
    }

    return hits;
  }

  aabbQuery(min: Vec2, max: Vec2, maskBits?: number): BodyId[] {
    const ids = new Set<BodyId>();

    // Manual pass over colliders using computeAABB (works across versions).
    this.world.colliders.forEach((col: RAPIER.Collider) => {
      if (!matchesMask(col, maskBits)) return;

      const aabb: any = (col as any).computeAABB?.();
      if (!aabb) return;

      const lo = aabb.min ?? aabb.mins ?? aabb.minima ?? { x: 0, y: 0 };
      const hi = aabb.max ?? aabb.maxs ?? aabb.maxima ?? { x: 0, y: 0 };

      const overlaps =
        lo.x <= max.x && hi.x >= min.x &&
        lo.y <= max.y && hi.y >= min.y;

      if (!overlaps) return;

      const id = this.lookupBodyId(col.parent()?.handle);
      if (id != null) ids.add(id);
    });

    return [...ids];
  }

  pointQuery(p: Vec2, maskBits?: number): BodyId | null {
    const pt = toRapier(p);
    let found: BodyId | null = null;

    // Older signature: (point, callback)
    // Newer signature has flags/groups; we keep manual filtering for compatibility.
    this.world.intersectionsWithPoint(pt, (col: RAPIER.Collider) => {
      if (!matchesMask(col, maskBits)) return true;
      const id = this.lookupBodyId(col.parent()?.handle);
      if (id != null && found == null) found = id;
      return true;
    });

    return found;
  }

  // ──────────────────────────────────────────────────────────
  // Events
  // ──────────────────────────────────────────────────────────
  on(event: "begin-contact" | "end-contact", cb: (a: BodyId, b: BodyId) => void): () => void {
    const bag = event === "begin-contact" ? this.beginListeners : this.endListeners;
    bag.add(cb);
    return () => bag.delete(cb);
  }

  // ──────────────────────────────────────────────────────────
  // Metadata
  // ──────────────────────────────────────────────────────────
  getMass(id: BodyId): { mass: number; inertia: number } | null {
    const h = this.bodies.get(id);
    if (!h) return null;
    if (h.type !== "dynamic") return null;
    return { mass: h.rb.mass(), inertia: h.rb.effectiveAngularInertia() };
  }

  getUserData<T = unknown>(id: BodyId): T | null {
    const h = this.bodies.get(id);
    if (!h) return null;
    return (h.userData as T) ?? null;
  }

  setUserData<T = unknown>(id: BodyId, data: T): boolean {
    const h = this.bodies.get(id);
    if (!h) return false;
    h.userData = data;
    return true;
  }

  // ──────────────────────────────────────────────────────────
  // Snapshots
  // ──────────────────────────────────────────────────────────
  readSnapshot() {
    const bodies = [];
    for (const [id, h] of this.bodies) {
      const t = h.rb.translation();
      const v = h.rb.linvel();
      bodies.push({
        id,
        t: { x: t.x, y: t.y, angle: h.rb.rotation() },
        v: { vx: v.x, vy: v.y, w: h.rb.angvel() },
      });
    }
    return { time: this.time, bodies };
  }

  // ──────────────────────────────────────────────────────────
  // Internals
  // ──────────────────────────────────────────────────────────
  private lookupBodyId(rbHandle?: number | null): BodyId | null {
    if (rbHandle == null) return null;
    return this.idFromRbHandle.get(rbHandle) ?? null;
  }

  private makeColliderDesc(shape: Shape, m?: Material): RAPIER.ColliderDesc {
    const friction = Math.min(1, Math.max(0, m?.friction ?? 0.5));
    const restitution = Math.min(1, Math.max(0, m?.restitution ?? 0));
    const density = m?.density ?? 1;
    const sensor = !!m?.isSensor;
    const groups = buildGroups(m);

    // Per-material event configuration (default "all")
    const requested = m?.events ?? "all";

    // If INTERSECTION_EVENTS is missing, we can’t subscribe to intersections.
    // Map requests that rely on intersections to 0 on such builds.
    const ev =
      requested === "none" ? 0 :
        requested === "contacts" ? AE_COLLISION :
          requested === "intersections" ? AE_INTERSECTION : // becomes 0 if unsupported
  /* "all" */                     (AE_COLLISION | AE_INTERSECTION);

    const withCommon = <T extends RAPIER.ColliderDesc>(cd: T) =>
      cd
        .setFriction(friction)
        .setRestitution(restitution)
        .setSensor(sensor)
        .setDensity(density)
        .setCollisionGroups(groups)
        .setActiveEvents(ev);

    switch (shape.type) {
      case "circle": {
        const s = shape as ShapeCircle;
        const cd = RAPIER.ColliderDesc.ball(s.radius);
        if (s.offset) cd.setTranslation(s.offset.x, s.offset.y);
        return withCommon(cd);
      }
      case "box": {
        const s = shape as ShapeBox;
        const cd = RAPIER.ColliderDesc.cuboid(s.hx, s.hy);
        if (s.offset) cd.setTranslation(s.offset.x, s.offset.y);
        if (s.angle) cd.setRotation(s.angle);
        return withCommon(cd);
      }
      case "capsule": {
        const s = shape as ShapeCapsule;
        const cd = RAPIER.ColliderDesc.capsule(s.halfHeight, s.radius);
        if (s.offset) cd.setTranslation(s.offset.x, s.offset.y);
        if (s.angle) cd.setRotation(s.angle);
        return withCommon(cd);
      }
      default:
        throw new Error(`Unsupported shape type: ${(shape as any)?.type}`);
    }
  }
}

// ------------------------------------------------------------
// Async factory (compat build doesn't require explicit init)
// ------------------------------------------------------------
export async function createRapierPhysicsService(): Promise<RapierPhysicsService> {
  const maybeInit = (RAPIER as any).init;
  if (typeof maybeInit === "function") {
    await maybeInit();         // ensure WASM is ready
  }
  const svc = new RapierPhysicsService();
  svc._initAfterWasm();        // now it’s safe to create World & EventQueue
  return svc;
}
