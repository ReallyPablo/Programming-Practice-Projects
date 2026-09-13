# Lab 02 — Objects, Prototypes, and `this`: The Entity Model

> "JavaScript doesn't have classes. It has objects that delegate to other objects, and a `class` keyword that politely pretends otherwise."

**Weeks:** 3–4 · **Language focus:** objects as property bags, `class` and one-level `extends`, the four rules of `this`, composition over inheritance, `Map`/`Set` · **Project step:** ships, bullets, obstacles; an entity manager; collisions; shooting and respawn · **Course:** [JavaScript — Build a Multiplayer Game](README.md) · **Previous:** [Lab 01](lab-01-event-loop-and-game-loop.md) · **Notes:** [theory + experiments](lab-02-objects-prototypes-classes.notes.md)

The prototype chain is **one console experiment** so `class` has something to sit on — not a week of theory and not a gate for the game. Constructor functions, both `extends` chains, and drawing `Function.prototype` live in Stretch / Reflection if you have time.

---

## This lab's feature

Your game has one ship, described as a plain object. Now it needs many things — ships, bullets, asteroids, pickups, explosions — that share behavior (position, velocity, collision radius, `update`, `draw`) but differ in the details.

You already know classes from other languages. Use **`class`** and **one level of `extends`** (`Ship extends Entity`). That is enough to ship this increment. What will actually break your code is **`this`**: it is decided at the *call site*, not by “whose method this is.” What will break your *design* is a deep hierarchy — a homing bullet and a homing asteroid do not want `Entity → Moving → Homing → …`. Game programmers settled on **composition** decades ago; JavaScript makes it natural.

Under `class` sits **delegation**: a method is looked up on the object, then on its prototype — not copied onto every bullet. One experiment in the notes is enough for that picture. You do not need to reconstruct `new` to make collisions work.

---

## Theory

### 1. Objects are property bags; `class` shares behavior

A JavaScript object is a dynamic map from string (or Symbol) keys to values. `obj.x` looks for an *own* property `x`. Methods are just properties that happen to hold functions.

`class` puts shared methods in one place. A thousand bullets do not each carry their own copy of `update` — they share it. That is the only prototype fact you need for this lab: **lookup, not copy.** Prove it once with `Object.create` in the notes (§1), then write `class` and move on.

`class` also gives you things you will use this week: **private fields** (`#hp`, truly inaccessible from outside), static fields (an `#id` counter), and accessors (`get hp()`). Call constructors with `new`; calling a class as a plain function throws.

```js
class Entity {
  static #nextId = 1;
  #id = Entity.#nextId++;
  constructor(x, y) { this.x = x; this.y = y; }
  update(dt) { this.x += this.vx * dt; }
}
```

Rule: **inherit at most one level** (`class Ship extends Entity` is fine). Anything richer is composition (Section 4).

What `class` compiles to — `Entity.prototype.update`, `new` creating `{}` and linking it, the two `extends` chains — is real, and interviewers ask. It is not a prerequisite for M1. If you want that layer, see Stretch and the notes section «Якщо лишився час».

### 2. `this`: four rules, applied in order

`this` is not "the object the method belongs to." It is determined **at call time**, by *how* the function was called. Kyle Simpson's rules, in precedence order:

1. **`new` binding** — `new F()`: `this` is the newly created object.
2. **Explicit binding** — `f.call(obj)`, `f.apply(obj)`, or `f.bind(obj)()`: `this` is `obj`. `bind` returns a permanently bound copy.
3. **Implicit binding** — `obj.f()`: `this` is `obj`, the object to the left of the dot *at the call site*.
4. **Default binding** — plain `f()`: `this` is `undefined` in strict mode (which modules and classes always are), `globalThis` otherwise.

And the exception that makes it all workable: **arrow functions have no `this` of their own.** They capture `this` lexically from the enclosing scope, exactly like any other variable in a closure. `bind`/`call`/`apply` can't change it.

The bug you *will* hit this lab: `button.addEventListener("click", ship.fire)` — you passed the function, not the call; the event system calls it with `this` = the button (or `undefined`). Fixes: `() => ship.fire()`, `ship.fire.bind(ship)`, or define `fire = () => {…}` as a class field (an arrow per instance — costs memory, reads cleanly). Know all three and their trade-offs.

### 3. Composition over inheritance

The tempting design: `Entity → MovingEntity → Ship → PlayerShip`, `Entity → MovingEntity → Bullet`. It breaks the moment you need a bullet that homes (moving + targeting), a stationary turret that shoots (shooting but not moving), or a ship that's also a pickup. Deep hierarchies fossilize; the game changes weekly.

The alternative game developers converged on (Nystrom's [Component](https://gameprogrammingpatterns.com/component.html) chapter): an entity is a **bag of small, independent behaviors** — a position component, a physics component, a collider, a weapon, a health pool — and systems operate on whatever has the components they need. In JavaScript you can do this lightly without a full ECS framework:

- **Mixins via object spread / `Object.assign`:** `const makeShip = () => ({ ...position(), ...physics(), ...weapon(), kind: "ship" })` builds plain objects with factory functions.
- **Explicit components as fields:** `ship.body = new Body(...)`, `ship.weapon = new Weapon(...)`; systems check `if (e.body)`.
- **Behavior as data:** `{ kind: "bullet", ttl: 2, damage: 10 }` and a `switch` in the update system. Boring, fast, easy to serialize — which matters a lot in Lab 5.

The Fun Fun Function talk demonstrates why in ten minutes.

### 4. `Map` and `Set` for the entity store

Don't use plain objects as dictionaries for entity storage. `Map` has any key type (numbers stay numbers), a real `.size`, guaranteed insertion order, no inherited keys (`obj["constructor"]` is a real bug people hit), and is faster for frequent add/remove. **`Map<id, Entity>`** is your entity store; **`Set<Entity>`** for tags or pending-removal lists.

`World` can be walked with `for…of`. A generator is the short way to write `ofKind` without building an intermediate array — copy the snippet; you do not need the iteration protocol by heart to pass the lab:

```js
class World {
  #entities = new Map();
  *[Symbol.iterator]() { yield* this.#entities.values(); }
  *ofKind(kind) { for (const e of this) if (e.kind === kind) yield e; }
}
for (const bullet of world.ofKind("bullet")) { … }
```

Destructuring and spread are the ergonomics layer: `const { x, y } = ship`; `const next = { ...ship, x: ship.x + 1 }` (shallow copy — nested objects are shared). Learn to read them at a glance.

### 5. Mutation, copies, and equality

Objects are **reference types**: `a === b` is identity, not structural equality; assignment copies the reference. `{ ...obj }` is a shallow copy; `structuredClone(obj)` is a deep copy (the right tool for snapshotting state). For the simulation, decide deliberately: **mutate in place** (fast, the norm in games — your `integrate` from Lab 1 does this) or **produce new state**. This lab uses in-place mutation with an explicit *previous-state copy* for interpolation; know what you chose and why.

### Prove it to yourself (browser console, ~10 minutes)

Required — notes §§1–3, same snippets:

1. Delegation, not copy: `Object.create`, then change `a.hello` and read `b.hello`.
2. `class A { m() { return this; } }; const a = new A(); const m = a.m; m()` — what and why? `m.call(a)`? Then the `ship.fire` listener bug.
3. `const o = { "1": "x" }; const m = new Map([[1, "x"]]); o[1], m.get("1")` — explain the difference.

If time left — notes «Якщо лишився час»: both `extends` chains; a generator you must `break` (Lab 1's “don't block the loop” again).

---

## Project step: entities, bullets, and collisions

### Milestones

**M1 — `Vector2` and a base `Entity`.**
`sim/vector.js`: a `Vector2` class with `add`, `sub`, `scale`, `length`, `normalize`, `rotate`, `dot`, `static fromAngle` — **pure methods returning new vectors** (so `a.add(b)` never mutates `a`), plus `addInPlace`-style variants for hot paths if you measure the need. `sim/entity.js`: `class Entity` with `id`, `pos`, `vel`, `angle`, `radius`, `alive`, `kind`, `update(dt)`, and a private `#id` counter via a static field. Refactor Lab 1's ship into `class Ship extends Entity` — one level, no more.

**M2 — The world: a `Map`-based entity manager.**
`sim/world.js`: `class World` holding `#entities: Map<number, Entity>`, with `spawn(e)`, `despawn(id)` (deferred: mark dead, sweep at end of step — mutating a `Map` while iterating it is legal but a source of subtle bugs), `get(id)`, `[Symbol.iterator]`, and `*ofKind(kind)`. `World.step(dt, inputs)` updates all entities, resolves collisions, sweeps the dead. Add `Bullet` (with a time-to-live) and `Asteroid`/`Obstacle` (drifting, bouncing). `Ship.fire()` spawns a bullet from the ship's nose with inherited velocity — and this is where you hit the `this` bug from Section 2 if you wire a keyboard handler naively. Document it when you do.

**M3 — Collisions, damage, respawn.**
`sim/collision.js`: circle–circle tests; a naive O(n²) pass is fine for now (Lab 7 measures it), but write it as a separate *system* that takes the world and emits `(a, b)` pairs so it can be swapped for a spatial hash later. Bullets damage ships and asteroids; ships have `#hp` (private field) with a public `get hp()`; a destroyed ship spawns an explosion entity (particles — many short-lived objects; remember this for Lab 7) and respawns after 2 s at a random safe spot. Score on the HUD.

**M4 — Composition, and a design write-up.**
Add two features that would break a class hierarchy, and implement them with composition instead: (a) a **homing** behavior that can attach to a bullet *or* an asteroid, and (b) a **pickup** (shield / rapid fire) that is stationary and collidable but not a ship. Use whichever technique from Section 3 you prefer — mixins, component fields, or behavior-as-data — and write a README section (≤ 1 page) comparing what the inheritance version would have looked like and why you chose your approach. A prototype-chain diagram is optional (Stretch), not part of the tag.

### Definition of done

- `Vector2`, `Entity`, `Ship`, `Bullet`, `Asteroid`, `Pickup`, `Explosion` exist; inheritance is at most one level deep.
- `World` stores entities in a `Map`, is iterable, exposes `ofKind` as a generator, and sweeps dead entities safely.
- Shooting works; the `this` bug was encountered (or deliberately demonstrated) and fixed, with the fix explained in the README.
- Collisions, damage with private `#hp`, explosions, respawn, and score.
- Homing and pickups implemented via composition; the design write-up is in the README.
- Repo tagged `lab-02`.

---

## Deliverable checklist

- [ ] `Vector2` with pure methods; `Entity` base with private static id counter; `Ship extends Entity` (one level).
- [ ] `World` over `Map`, iterable via `[Symbol.iterator]`, `*ofKind`, deferred despawn sweep.
- [ ] `Bullet` (TTL), `Asteroid`, `Explosion` (particles), `Pickup`; `Ship.fire()`.
- [ ] The `this` bug documented with the fix chosen and alternatives listed.
- [ ] Circle collision system as a swappable function; damage via `#hp`; respawn; score HUD.
- [ ] Homing and pickups via composition; ≤ 1-page design write-up (why not a deep `extends` tree).
- [ ] Git tag `lab-02`.

---

## Reflection — explain it at the whiteboard

Defense: pick 2–3 from the first four. The rest is extra.

1. State the four `this` rules in precedence order. What's `this` in `setTimeout(ship.fire, 100)`? Give three fixes and one downside of each.
2. Why do arrow functions ignore `.bind`? What are they good for, and where are they the wrong choice for a method shared by many instances?
3. Why `Map` over a plain object for the entity store? Give three concrete reasons.
4. Argue for composition over inheritance using your homing-bullet-and-homing-asteroid case. What would the hierarchy have had to look like?

Optional, if you went into Stretch:

5. Draw the prototype chain for `const s = new Ship()` where `class Ship extends Entity`. What does `s.update` do, step by step?
6. What exactly does `new` do? Write `new` as a function using `Object.create` and `.call`.
7. Why do people say `class` is "just sugar"? Name three things `class` does that the constructor-function version doesn't.
8. What is an iterable? Why could `[...world]` be a problem in a game loop?

---

## Stretch

**Prototypes, properly.** One sitting: Fun Fun Function's prototypes talk, then Lydia Hallie's diagrams. In the console, inspect `Object.getPrototypeOf` on a `Ship` instance, on `Ship.prototype`, and on `Ship` itself (the two `extends` chains). Write `new` as a function. Optionally add a one-box diagram to the README.

**Then, if you are still ahead:** replace the ad-hoc composition with a **tiny data-oriented ECS**: components stored as parallel typed arrays (`Float32Array` for positions and velocities), entities as integer indices, systems as functions over ranges. Measure `World.step` time at 5,000 entities against the object-based version (you'll revisit this in Lab 7 with a profiler — write the number down now). Then implement a **spatial hash** for the collision system and show the O(n²) → ~O(n) change on the same benchmark.

---

## Resources

**Watch**

- Fun Fun Function — [Composition over Inheritance (11 min)](https://www.youtube.com/watch?v=wfMtDGfHWpA). The dog-that-can-also-clean-the-house problem; the clearest short argument for Section 3. Watch this first.
- Fun Fun Function — [Prototypes in JavaScript (15 min)](https://www.youtube.com/watch?v=riDVvXZ_Kb4). Stretch / interview: builds the chain from `Object.create` up, with no `class` in sight.

**Read**

- javascript.info — [Classes](https://javascript.info/classes) (especially "Class inheritance" and "Private and protected properties"). The textbook for what you write this lab.
- MDN — [`this`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/this) (read the whole page once) and [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map).
- Robert Nystrom — [Game Programming Patterns: Component](https://gameprogrammingpatterns.com/component.html). Why game engines abandoned deep hierarchies. The design rationale for M4.
- Kyle Simpson — [*You Don't Know JS Yet: Objects & Classes*](https://github.com/getify/You-Dont-Know-JS/blob/2nd-ed/objects-classes/README.md). Chapters on `this` first; prototypes if you take the Stretch.
- Lydia Hallie — [JavaScript Visualized: Prototypal Inheritance](https://dev.to/lydiahallie/javascript-visualized-prototypal-inheritance-47co) and MDN — [Inheritance and the prototype chain](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Inheritance_and_the_prototype_chain). Stretch: what `new` / `class` / `extends` actually build.
- javascript.info — [Prototypes, inheritance](https://javascript.info/prototypes) (all four articles) and MDN — [Iterators and generators](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Iterators_and_generators). Same shelf, not the gate.
