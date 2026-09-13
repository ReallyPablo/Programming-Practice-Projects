# Lab 06 — Named Bundles: Structs, Enums, and the Heap

> "A struct is a layout. An enum is a list of meanings. The heap is memory whose lifetime you chose — and must un-choose."

**Weeks:** 11–12 · **Language focus:** `struct`, `enum class`, layout and `sizeof`, stack vs heap, `new`/`delete`, leaks and double-free · **Project step:** `CPU`/`Instruction` as structs, a heap region, sprites as records · **Course:** [EN](README.md) · [UK](README.uk.md) · **Previous:** [Lab 05](lab-05-many-of-one-thing.md) · **Notes:** [theory + experiments](lab-06-named-bundles.notes.md)

---

## This lab's feature

Registers, flags, `PC`, a pointer to memory — you have been carrying those as loose variables or as a struct already. This week you treat **the record** as the design: a `struct` is a name for a layout in memory, field by field. An `enum` is a name for a small set of integers (opcodes, sprite kinds). Together they are how you stop writing `data[i+3]` and start writing `sprite.x`.

The other half is **lifetime**. Everything so far was automatic: `CPU cpu{}` dies at the end of `main`. The **heap** (`new` / `delete`, or a bump pointer *inside* ember's 4 KB) is memory that lives until you say so. Forget `delete` and LeakSanitizer nags. `delete` twice and ASan nags. A dangling pointer is a pointer whose heap object is gone.

Records this week are **sprites**: `x, y, vx, vy, alive`. You `PLOT` them each step. A sequence of records doing a job on the screen, not a table of fields to fill in.

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

The values are not yours to choose: copy them from [ISA.md](ISA.md). What you gain is that `Op::Add` cannot be mixed with `int` without a cast — so a decoded opcode and a raw byte stop being the same type, and the compiler starts catching a class of bug it could not see before. Your `switch (op)` becomes `switch (static_cast<Op>(byte))`, or you store `Op` after decode. Unknown bytes stay an error, not a silent `Nop`.

### 3. Three lifetimes

| Where | Created | Destroyed | Ember analogue |
|---|---|---|---|
| **Static / global** | Before `main` | After `main` | The `Memory` object if you make it global (don't) |
| **Automatic (stack)** | Entering the block | Leaving the block | `CPU cpu` in `main`; locals in `step` |
| **Dynamic (heap)** | `new T` | `delete p` | A host `new Sprite[]`, **or** a guest heap: `0xC00`–`0xEFF` with an allocation pointer |

You will do **both** a little: one host `new`/`delete` so ASan/LSan can teach you, and a **guest bump allocator** (`ALLOC n` → returns an address, advances a pointer) so ember-programs can get a block without C++ `new`. The guest heap is the one that belongs in a VM; the host `new` is the one that belongs in the notes.

Rules: every `new` has one `delete`; every `new[]` has `delete[]`. After `delete`, the pointer is **dangling** — set it to `nullptr`. Do not use a dangling pointer. **Garbage** (leak) is a heap object with no pointer left; **dangling** is a pointer with no object left. They are opposites. Both are bugs.

### 4. A note on `CPU&`

You will see `step(CPU& cpu)` in this lab's code. `T&` is a **reference**: a
pointer that cannot be null and needs no `*` at the call site. Use it for now as
"pass the machine itself, not a copy of it" — the full treatment, and when to
prefer `T`, `T*` or `T&`, is [Lab 7](lab-07-call-and-return.md)'s subject.

### Prove it to yourself (notes §§1–3)

1. `struct P { char c; int n; };` print `sizeof(P)`. Why not 5?
2. `enum class Color { Red, Green }; Color c = Color::Red;` then try `c = 1;`
3. `int* p = new int{42}; std::cout << *p; delete p; std::cout << *p;` with ASan.
4. `new int` without `delete`, with `ASAN_OPTIONS=detect_leaks=1`. On Linux and in WSL you get a leak report. **On macOS with an Apple chip you get `detect_leaks is not supported on this platform`** — that is expected; see [errors.notes.md §3](errors.notes.md).
5. Two `Sprite` values in an array; a loop that moves them and `plot`s.

---

## Project step: records that move, and a heap you can see

### Milestones

**M1 — Refactor to structs + enum.**
`struct Flags`, `struct CPU`, `enum class Op`. `sizeof(CPU)` in the README. `step` switches on `Op`. No behaviour change — tag `lab-06` will still run Lab 5 programs. The job: *name the layout you already had.*

**M2 — Sprites (records + array).**
`struct Sprite { uint8_t x, y; int8_t vx, vy; bool alive; };` and `Sprite sprites[8]` on the host. Command `sprite <i> <x> <y> <vx> <vy>` fills one. Command `tick` updates all alive sprites (bounce off the 64×32 edges) and `show`s. A demo: two sprites bouncing.

**M3 — Guest heap: a bump allocator.**
The heap region is `0xC00`–`0xEFF` ([ISA.md §2](ISA.md#2-memory-map)). `CPU` holds `uint16_t heap_ptr`, starting at `HEAP_LO`. The `ALLOC` opcode (`0x60`): allocate `A` bytes, put the block's address in `H`, advance `heap_ptr`. No room — set `C` and leave `H` alone. A `dump` of that region after two allocations shows two blocks with no gap between them.

Two allocations, then explain in the README: why is there no gap? What would have to change for `FREE` to be possible?

**M4 — Host new/delete, on purpose.**
A *temporary* `scratch.cpp` (same `c++` line as the notes) run three times: `new` and forget (**leak**), `new`/`delete`/read (**use-after-free**), `new`/`delete`/`delete` (**double-free**). Paste the sanitizer output for each and add a one-line moral.

**On macOS with an Apple chip the leak case produces no report** — LeakSanitizer is not available there, and no configuration fixes it. Two ways to pass this milestone, both fully acceptable:

- run that one case in Linux, WSL or Docker and paste the real report; **or**
- paste the `detect_leaks is not supported on this platform` line as evidence you tried, and explain the leak in two sentences: the object is alive, the last pointer to it is gone, nobody can ever free it.

Say in the README which route you took and why. Delete `scratch.cpp` before the tag if you want a clean tree; keep the write-up.

### Definition of done

- `CPU` / `Flags` / `Op` are structs/enum; `sizeof` documented.
- At least two bouncing sprites; `tick` + `show`.
- `ALLOC` bump allocator over `0xC00`–`0xEFF`; `C` set on failure; dump evidence.
- Use-after-free and double-free demonstrated with pasted sanitizer output; leak either demonstrated on Linux/WSL or explained, with the platform note in the README.
- Repo tagged `lab-06`.

---

## Levels

### Basic — "the machine has a shape" (~9–11 hours)
- `struct Flags`, `struct CPU`, `enum class Op : std::uint8_t` with the values from [ISA.md](ISA.md).
- `step` switches on `Op`, not on a raw byte. Unknown bytes are still an error.
- **No behaviour change**: every Lab 5 program still runs. This milestone is a refactor.
- `sizeof(CPU)` and the field layout in the README.
- Repo tagged `lab-06`.

### Standard — target (~15–16 hours)
- Everything in **Definition of done** above.
- `struct Sprite` and `Sprite sprites[8]`; `sprite` and `tick` commands; at least two sprites bouncing off the 64×32 edges.
- `ALLOC` as a bump allocator over `0xC00`–`0xEFF`, `C` set when it does not fit, with a dump after two allocations.
- Two sanitizer reports pasted and explained: use-after-free and double-free. (Leaks: see the note in M4 — on Apple Silicon you explain instead of paste.)

### Advanced — distinction (~19–21 hours)
- Everything above, plus a real leak report produced on Linux or in WSL/Docker.
- A tagged `struct Value` and a one-page note on unions vs tagged structs.
- A guest `FREE` as a free list — a linked-list preview of Lab 8.

---

## Deliverable checklist

- [ ] Structs + `enum class Op`; layout/`sizeof` in the README.
- [ ] `Sprite sprites[8]`; bounce demo.
- [ ] Guest `alloc` bump pointer; dump.
- [ ] Sanitizer reports for use-after-free and double-free, plus the leak (report or documented platform limit), and the fixes.
- [ ] Git tag `lab-06`.

---

## Reflection — explain it at the whiteboard

1. Draw `Sprite` in memory. Where is padding, if any? How did you find out?
2. `enum` vs `enum class` vs `#define ADD 0x10`. Why bother?
3. Stack vs heap: who allocates, who frees? Print `&local` and the pointer from `new` with `std::cout` — what is different?
4. Leak vs dangling vs double-free. Which sanitizer message is which?
5. Why is a bump allocator enough for `ember` this week? What can't it do that `delete` can?
7. Where do the heap and the stack sit in the [memory map](ISA.md#2-memory-map)? Which way does each one grow, and what happens on a real machine when they meet?
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
