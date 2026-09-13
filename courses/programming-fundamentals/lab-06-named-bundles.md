# Lab 06 — Named Bundles: Structs, Enums, and the Heap

> "A struct is a layout. An enum is a list of meanings. The heap is memory whose lifetime you chose — and must un-choose."

**Weeks:** 11–12 · **Language focus:** `struct`, `enum class`, layout and `sizeof`, stack vs heap, `new`/`delete`, leaks and double-free · **Project step:** `CPU`/`Instruction` as structs, a heap region, sprites as records · **Course:** [Programming Fundamentals](README.md) · **Previous:** [Lab 05](lab-05-many-of-one-thing.md) · **Notes:** [theory + experiments](lab-06-named-bundles.notes.md)

---

## This lab's feature

Registers, flags, `PC`, a pointer to memory — you have been carrying those as loose variables or as a struct already. This week you treat **the record** as the design: a `struct` is a name for a layout in memory, field by field. An `enum` is a name for a small set of integers (opcodes, sprite kinds). Together they are how you stop writing `data[i+3]` and start writing `sprite.x`.

The other half is **lifetime**. Everything so far was automatic: `CPU cpu{}` dies at the end of `main`. The **heap** (`new` / `delete`, or a bump pointer *inside* ember's 4 KB) is memory that lives until you say so. Forget `delete` and LeakSanitizer nags. `delete` twice and ASan nags. A dangling pointer is a pointer whose heap object is gone.

Older courses called this "named types" and then asked you to compute "percent of first-year students in a dorm" on a fake array of records. You will still have records — **sprites** (or "contacts," or "aircraft," if your theme wants it): `x, y, vx, vy, alive`. You will `PLOT` them each step. That is a sequence of records doing a job, not a table for a variant.

---

## Theory

### 1. `struct` is adjacent fields with names

```cpp
struct Sprite {
    std::uint8_t x, y;
    std::int8_t  vx, vy;
    bool alive;
};

Sprite s{10, 5, 1, 0, true};
s.x = s.x + s.vx;
```

Fields have types. The compiler lays them out in order, **padding** for alignment (a `bool` after a `uint16_t` may not be 3 bytes). Print `sizeof(Sprite)` and `offsetof` (or dump `&s.x`, `&s.y`) this week. The dump is the lecture on layout.

An **array of structs** `Sprite sprites[8];` is Lab 5 plus Lab 6. A **struct of arrays** (`xs[8], ys[8]`) is sometimes faster; you don't need it. Nested structs (`CPU` has `Flags` has `bool z`) are fine.

**Aggregate init** `{ ... }` zeroes missing tail fields. Prefer it.

### 2. `enum class` is a typed set of integers

```cpp
enum class Op : std::uint8_t {
    Halt = 0x00,
    Nop  = 0x01,
    Add  = 0x10,
    // ...
};
```

`Op::Add` cannot be mixed with `int` without a cast — that is the point. Your `switch (op)` becomes `switch (static_cast<Op>(byte))` or you store `Op` after decode. Unknown bytes stay an error, not a silent `Nop`.

Older "enumerations" for student names (`Ivan, Petro, …`) were this with worse examples.

### 3. Three lifetimes

| Where | Created | Destroyed | Ember analogue |
|---|---|---|---|
| **Static / global** | Before `main` | After `main` | The `Memory` object if you make it global (don't) |
| **Automatic (stack)** | Entering the block | Leaving the block | `CPU cpu` in `main`; locals in `step` |
| **Dynamic (heap)** | `new T` | `delete p` | A host `new Sprite[]`, **or** a guest heap: a region `[HEAP_LO, HEAP_HI)` with an allocation pointer |

You will do **both** a little: one host `new`/`delete` so ASan/LSan can teach you, and a **guest bump allocator** (`ALLOC n` → returns an address, advances a pointer) so ember-programs can get a block without C++ `new`. The guest heap is the one that belongs in a VM; the host `new` is the one that belongs in the notes.

Rules: every `new` has one `delete`; every `new[]` has `delete[]`. After `delete`, the pointer is **dangling** — set it to `nullptr`. Do not use a dangling pointer. **Garbage** (leak) is a heap object with no pointer left; **dangling** is a pointer with no object left. They are opposites. Both are bugs.

### 4. References are pointers that must not be null

`void swap(int& a, int& b)` is `void swap(int* a, int* b)` without the `*` at the call site and without null. You may start passing `CPU&` instead of `CPU*` this week. Same machine, nicer spelling.

### Prove it to yourself (notes §§1–3)

1. `struct P { char c; int n; };` print `sizeof(P)`. Why not 5?
2. `enum class Color { Red, Green }; Color c = Color::Red;` then try `c = 1;`
3. `int* p = new int{42}; std::cout << *p; delete p; std::cout << *p;` with ASan.
4. `new int` without `delete`, compiled with leak detection (`ASAN_OPTIONS=detect_leaks=1` on Linux/clang).
5. Two `Sprite` values in an array; a loop that moves them and `plot`s.

---

## Project step: records that move, and a heap you can see

### Milestones

**M1 — Refactor to structs + enum.**
`struct Flags`, `struct CPU`, `enum class Op`. `sizeof(CPU)` in the README. `step` switches on `Op`. No behaviour change — tag `lab-06` will still run Lab 5 programs. This is the "named type" lab's actual job: *name the layout you already had.*

**M2 — Sprites (records + array).**
`struct Sprite { uint8_t x, y; int8_t vx, vy; bool alive; };` and `Sprite sprites[8]` on the host. Command `sprite <i> <x> <y> <vx> <vy>` fills one. Command `tick` updates all alive sprites (bounce off the 64×32 edges) and `show`s. A demo: two sprites bouncing. This *is* the "array of students" practical, with motion.

**M3 — Guest heap: a bump allocator.**
Reserve e.g. `[0x0C00, 0x0FFF)` as heap. `CPU` (or `Memory`) holds `uint16_t heap_ptr` starting at `0x0C00`. Opcode or command `alloc <n>`: if `heap_ptr + n <= HEAP_HI`, return the old pointer and advance; else error. `dump` of that region after two allocs. No `free` required (bump allocators usually don't); mention that in the README.

**M4 — Host new/delete, on purpose.**
A *temporary* command or a 10-line scratch linked in Debug only that `new`s a `Sprite` and forgets it; paste LSan/ASan output. Then a version that `delete`s. Then a version that `delete`s twice. README: three reports, three one-line morals. Remove the broken command before the tag if you want a clean `run`; keep the write-up.

### Definition of done

- `CPU` / `Flags` / `Op` are structs/enum; `sizeof` documented.
- At least two bouncing sprites; `tick` + `show`.
- Guest bump allocator with a documented region; dump evidence.
- Leak / dangling / double-free each demonstrated once with sanitizer output.
- Repo tagged `lab-06`.

---

## Deliverable checklist

- [ ] Structs + `enum class Op`; layout/`sizeof` in the README.
- [ ] `Sprite sprites[8]`; bounce demo.
- [ ] Guest `alloc` bump pointer; dump.
- [ ] Three sanitizer reports (leak, use-after-free, double-free) and the fixes.
- [ ] Git tag `lab-06`.

---

## Reflection — explain it at the whiteboard

1. Draw `Sprite` in memory. Where is padding, if any? How did you find out?
2. `enum` vs `enum class` vs `#define ADD 0x10`. Why bother?
3. Stack vs heap: who allocates, who frees, what does the debugger show for a local vs `new`?
4. Leak vs dangling vs double-free. Which sanitizer message is which?
5. Why is a bump allocator enough for `ember` this week? What can't it do that `delete` can?
6. Why pass `CPU&` into `step` instead of copying `CPU` by value?

---

## Stretch

A tagged `struct Value { enum class Kind { Byte, Addr, SpriteId }; uint16_t bits; };` and a one-page note on unions vs tagged structs (unions: same memory, *you* remember the kind; tagged: the kind is in the bytes). Guest `free` as a free-list (a **linked list** preview of Lab 8). `std::unique_ptr<Sprite>` as the host version of "delete is in the destructor" — look, don't rewrite the course.

---

## Resources

**Watch**

- [Stack vs Heap (10 min, many clones; pick one that draws growing arrows)](https://www.youtube.com/watch?v=5OJRqkYbK-4) — then verify with *your* ASan reports, not the video's word.

**Read**

- learncpp.com — [structs](https://www.learncpp.com/cpp-tutorial/introduction-to-structs-members-and-member-selection/), [enum classes](https://www.learncpp.com/cpp-tutorial/scoped-enumerations-enum-classes/), [dynamic allocation](https://www.learncpp.com/cpp-tutorial/dynamic-memory-allocation-with-new-and-delete/).
- cppreference — [`offsetof`](https://en.cppreference.com/w/cpp/types/offsetof), [RAII](https://en.cppreference.com/w/cpp/language/raii) (the *next* idea after raw `new`).
- AddressSanitizer — [use-after-free examples](https://github.com/google/sanitizers/wiki/AddressSanitizer).
