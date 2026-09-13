# Lab 04 — The Shape of Control: Conditions, Loops, Scope

> "Structured programming is a small set of shapes. Everything else is those shapes nested."

**Weeks:** 7–8 · **Language focus:** booleans and comparisons, `if`/`else`, `switch`, `while`/`do`/`for`, short-circuit, block scope and lifetime · **Project step:** `JMP`/`JZ`/`JNZ`, a loop in bytecode, linear search through memory · **Course:** [EN](README.md) · [UK](README.uk.md) · **Previous:** [Lab 03](lab-03-addresses-not-names.md) · **Notes:** [theory + experiments](lab-04-the-shape-of-control.notes.md)

---

## This lab's feature

A program that only runs top to bottom is a calculator. A **computer** can skip, repeat, and choose. In C++ those shapes are `if`, `switch`, and the loops. In a CPU they are **jumps**: write a new value into `PC`.

That translation is the lecture. `while (A != 0) { A = A - 1; }` is, in ember:

```txt
loop:  LOAD  A, [count]
       JZ    done
       SUB   A, one
       STORE [count], A
       JMP   loop
done:  HALT
```

You will implement `JMP` (always) and `JZ`/`JNZ` (if Z is set / not set — Lab 2's flags finally do work). Then you will write a **linear search**: given a byte `P` and a region of memory, find the first index where `mem[i] == P`, or report miss. The sequence is `ember`'s RAM. The loop exists twice: in C++ (`step` is a loop) and as guest instructions.

Scope is the other half. A name lives in a `{ }` block. The same identifier in an inner block **shadows** the outer one. `static` local variables survive across calls; ordinary locals die when the block ends. Print both with `std::cout` in the notes snippet; then stop using `static` as a party trick.

---

## Theory

### 1. Comparisons produce booleans; C++ also has truthy integers

`== != < > <= >=` produce `bool` (`true`/`false`, which print as 1/0 unless you use `std::boolalpha`). In `if (x)` a non-zero integer is true. Prefer actual `bool` and `==`. The bug of the decade is `if (x = 0)` — assignment, not comparison — which is *true* if you write `if (x = 1)` and false if `if (x = 0)`. Compile with `-Werror` and the warning `using the result of an assignment as a condition` saves you. Still know it.

Logical ops: `!` not, `&&` and, `||` or. They are **not** the bitwise ops from Lab 2. `1 && 2` is `true`; `1 & 2` is `0`.

**Short-circuit:** `A && B` does not evaluate `B` if `A` is false; `A || B` does not evaluate `B` if `A` is true. This is a feature: `if (p && *p == 3)` is safe. It is also a footgun: `if (f() && g())` might not call `g`.

### 2. The shapes

**`if (cond) stmt; else stmt;`** — the else binds to the nearest `if`. Braces always, even for one line. You will thank yourself.

**`switch (n) { case 1: ... break; default: ... }`** — `n` must be an integer (or enum, Lab 6). Without `break`, execution **falls through**. Your `step()` is a `switch (op)` — that is the right tool. Fall-through only when you mean it, and comment `[[fallthrough]]`.

**`while (cond) stmt`** — zero or more times. **`do stmt while (cond)`** — at least once. **`for (init; cond; next)`** — the loop with a counter. They all compile to tests and jumps. Nested loops: the inner runs fully for each outer step. A 2D scan is two `for`s (Lab 5); a linear search is one.

Empty loop: `for (;;)` is `while (true)`. `ember`'s `run` is that, until `HALT` or a step limit (add a limit of e.g. 100000 so a bad `JMP` cannot hang the process).

### 3. Linear search is a loop with an exit

```cpp
// find first i in [lo, hi) with mem.get(i) == needle; return hi if miss
std::uint16_t find(const Memory& mem, std::uint16_t lo, std::uint16_t hi, Byte needle) {
    for (std::uint16_t i = lo; i < hi; ++i) {
        if (mem.get(i) == needle) return i;
    }
    return hi;
}
```

If the region is **sorted**, you may stop early when `mem.get(i) > needle` — that is still linear, just a shorter average. Binary search can wait; understanding *this* loop is the lab.

You will write this twice: in C++ (a `find` command) and as an ember program using `LOAD`/`SUB`/`JZ`/`JMP`.

### 4. Scope, lifetime, and the membrane

A **block** `{ }` is a scope. Names declared inside are invisible outside. Inner `int x` hides outer `x` until the inner block ends. This is not a puzzle; it is how you keep temporaries from leaking.

```cpp
int x = 1;
{
    int x = 10;      // inner x
    static int c = 0;
    c = c + 1;
}
// outer x is still 1; inner x is gone; c still exists but the *name* c is gone
```

**Lifetime:** automatic (`auto`, the default) storage dies at the end of the block. **`static` local** is initialized once and lives until the program ends — the name is still scoped. **Heap** waits until Lab 6. Shadowing is just an inner name hiding an outer one. The global `::x` (unary `::`) reaches a global when an inner name hid it; you almost never need this if you don't use globals. Don't use globals. Pass a `CPU&`.

### Prove it to yourself (notes §§1–4)

1. `if (x = 1)` vs `if (x == 1)` — what does each do? Does `-Werror` save you?
2. `true && (std::cout << "A", false) && (std::cout << "B");` — what prints? (comma operator, or two `if`s: `f() && g()` with prints inside.)
3. `switch` without `break` on `n = 1` with `case 1: print 1; case 2: print 2;`
4. Nested `for` that prints a 3×3 grid of `(i,j)`.
5. The shadowing snippet in §4, with prints; add a `for` that uses both a `static` counter and an ordinary local, and explain which one persists.

---

## Project step: the CPU learns to jump

### Milestones

**M1 — `step` is already a `switch`. Make it total.**
Every known opcode is a `case`. `default:` sets an error: "unknown opcode 0x.." and halt. No silent NOP for garbage. This is `switch` used as a decoder, which is what it's for.

**M2 — Jumps.**
- `JMP imm16` — `PC = addr` (do **not** then add 3).
- `JZ imm16` — if `flags.z` then `PC = addr`, else `PC += 3`.
- `JNZ` similarly.
- `CMP A, B` (or `SUB` without storing) that only sets flags — useful so `JZ` has something to read.

`run` has a max-steps guard. Document it.

**M3 — A loop in bytecode.**
A program that sets `A = 3` and counts down to 0, `OUT` each value. Trace in the README: each `step`'s `PC` and `A`. Then the equivalent C++ `while`. Same shape.

**M4 — Linear search, twice.**
1. Command `find <lo> <hi> <byte>` implemented with the C++ loop above.
2. An ember program (poked bytes, or a listing in the README you enter with `set`) that searches a 8-byte region for `0x41` and `OUT`s the index (or `0xFF` for miss). You may `step` it in the defense.

### Definition of done

- `JMP`/`JZ`/`JNZ`/`CMP`; `run` cannot hang forever.
- Unknown opcodes error out.
- Countdown trace in the README next to the C++ `while`.
- `find` command + a guest search program.
- Repo tagged `lab-04`.

---

## Deliverable checklist

- [ ] `switch` decoder with `default` error; max-steps on `run`.
- [ ] `JMP`, `JZ`, `JNZ`, `CMP`.
- [ ] Countdown program traced.
- [ ] C++ `find` and an ember search; both demonstrated.
- [ ] Git tag `lab-04`.

---

## Reflection — explain it at the whiteboard

1. Translate `while (a > 0) a = a - 1;` into tests and jumps. Draw `PC`.
2. `&&` vs `&`. Give a case where replacing one with the other compiles but is wrong.
3. Why does `if (x = 0)` compile? What flag makes it fail?
4. `while` vs `do-while` vs `for` — which is the countdown, and could they all do it?
5. What does short-circuit buy you with pointers? What does it cost with functions that have side effects?
6. Explain shadowing with two boxes named `x`. When is `static int c` still alive after the block?

---

## Stretch

`JG`/`JL` using the N and Z flags (you'll need to define signed compare carefully — this is why real ISAs have overflow flags). Or: compile a nested C++ loop in [Godbolt](https://godbolt.org/) and circle the `jcc` / `jmp` that *are* this lab. Optional: a `step` debugger command `b <addr>` (breakpoint) that `run`s until `PC == addr`.

---

## Resources

**Watch**

- Crash Course CS — [Instructions and Programs](https://www.youtube.com/watch?v=zltgXvg6r3k) — fetch-decode-execute, jumps.
- Ben Eater — [Jump instructions](https://www.youtube.com/watch?v=Zg1NdPKoosU) if you liked the breadboard series.

**Read**

- learncpp.com — [If statements](https://www.learncpp.com/cpp-tutorial/if-statements-and-blocks/), [switch](https://www.learncpp.com/cpp-tutorial/switch-statement-basics/), [while](https://www.learncpp.com/cpp-tutorial/while-statement/), [for](https://www.learncpp.com/cpp-tutorial/for-statements/), [logical operators](https://www.learncpp.com/cpp-tutorial/logical-operators/).
- Nystrom — [Jumping around](https://gameprogrammingpatterns.com/) is the wrong book; stay on learncpp. For *why* `switch` is your decoder, reread your own `cpu.cpp`.
