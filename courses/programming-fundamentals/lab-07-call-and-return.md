# Lab 07 — Call and Return: Functions, the Stack, and Recursion

> "A function is a named jump with a promise to come back. The stack is how the promise is kept."

**Weeks:** 13–14 · **Language focus:** functions, pass-by-value vs pointer vs reference, headers and translation units, the call stack, recursion · **Project step:** a `Stack` ADT, `CALL`/`RET`, recursive Fibonacci in bytecode · **Course:** [EN](README.md) · [UK](README.uk.md) · **Previous:** [Lab 06](lab-06-named-bundles.md) · **Notes:** [theory + experiments](lab-07-call-and-return.notes.md)

---

## This lab's feature

You have been writing functions since Lab 1 (`main`, `dump`, `step`). This week they become a **subject**: a function has a name, parameters, a return value or `void`, and a **frame** on the call stack. Passing `CPU` by value would copy the machine every `step` — so you pass `CPU&`. Passing `int x` copies the number; the callee cannot change the caller's `x`. That is not a style rule. It is how the stack works.

Then you implement the same idea *inside* ember. **`CALL addr`** pushes `PC` (the return address) onto a **stack** and sets `PC = addr`. **`RET`** pops into `PC`. Recursion is a function that `CALL`s itself. Fibonacci will grow the stack until it returns, or until it overflows — and you will show both.

Older packs split "closed subprograms," "procedures vs functions," "headers," and "recursion as extra credit." Here they are one lab, because they are one mechanism. The **ADT** is `Stack`: `push` / `pop` / `empty` / `full`, vector or linked — you pick, you hide the representation behind `stack.hpp`.

---

## Theory

### 1. A call is a jump that remembers

When C++ executes `y = add(2, 3)`:

1. Place arguments where the callee expects them (registers and/or stack — ABI).
2. Place a **return address** (the instruction after the call).
3. Jump to `add`.
4. `add` runs, leaves a result, jumps to the return address.

You do not need the full x86-64 ABI. You need: **the callee has its own locals**; they die when it returns; the caller's locals are intact. Recursion works because **each call has its own frame**. Draw three frames for `fact(3)` → `fact(2)` → `fact(1)`.

### 2. How values get in and out

| Passing | Callee sees | Can modify caller's object? | Use |
|---|---|---|---|
| `T x` | a copy | no | small values (`uint8_t`, `int`) |
| `T* p` | an address | yes, via `*p` | optional / arrays (decayed) |
| `T& r` | an alias | yes | required object, `CPU&` |
| `const T&` | an alias, read-only | no | large read-only (later) |

**Return:** `return x;` copies (or moves) a value to the caller. `void` returns nothing — a **procedure** in older vocabulary. Prefer returning a value when there is one result (`Byte alu_add(...)`). Use out-parameters (`bool& carry`) when you must return two things and haven't made a `struct AluResult` yet. Do **not** return through globals.

**Overload** (same name, different parameter types) is resolved at compile time. Fine for `dump(const Memory&)` vs `dump(const CPU&)`. Do not overload as a party trick.

### 3. Recursion needs a base case and a smaller case

```cpp
int fact(int n) {
    if (n <= 1) return 1;       // base
    return n * fact(n - 1);     // smaller
}
```

Without a base case, stack overflow. Tail recursion is a special case compilers *may* turn into a loop; do not count on it. Fibonacci naive recursion is exponentially slow — that is a feature for the lab: `fib(10)` is fine, `fib(40)` is a lecture on why stacks and time both matter.

Guest `fib`: `CALL` itself with `A` holding `n`, use the stack for return addresses *and* (if you need) spilled `n`. Document the calling convention in the README: **who saves `A`, where `n` lives.**

### 4. Headers are promises; `.cpp` files keep them

```cpp
// stack.hpp
#pragma once
#include <cstdint>
struct Stack {
    static constexpr int CAP = 64;
    std::uint16_t data[CAP]{};
    int top = -1;               // or a linked node — hidden if you use opaque pointers
};
bool push(Stack& s, std::uint16_t v);
bool pop(Stack& s, std::uint16_t& out);
```

`#include "stack.hpp"` copies the promise into each `.cpp`. **One definition** of `push` lives in `stack.cpp`. Circular includes: `#pragma once` and "include what you use." This is Lab 2.5 from the old pack (the `.h` file) without the pretend lists.

### 5. The stack as an ADT

**LIFO:** last in, first out. `push` / `pop`. Overflow if `top == CAP-1`; underflow if empty. A **queue** is FIFO — implement it only if you need it (Stretch). Representation: array (vector) or linked nodes. The rest of `cpu.cpp` should not touch `data[]`. That hiding is what "abstract data type" meant.

### Prove it to yourself (notes §§1–3)

1. `void inc(int x) { x++; }` vs `void inc(int& x) { x++; }` vs `void inc(int* p) { (*p)++; }`.
2. Recursive `fact(5)` — print `n` on the way in and out.
3. `int f(int n) { return f(n); }` — compile, run with a small ulimit or just know it dies; don't paste a 1000-line ASan stack unless you want to.
4. Two `.cpp` files calling the same `push` — link them; then duplicate `push` in both and read the linker error.

---

## Project step: CALL, RET, and fib.asm (still poked)

### Milestones

**M1 — `Stack` ADT.**
`stack.hpp` / `stack.cpp`. `push`/`pop` return `bool` (success). Commands `push <v>` / `pop` for host-level demo, **or** only used by the CPU — but unit-test them somehow (`ember` command `stack` that prints `top` and the 8 nearest values). Overflow/underflow messages, no crash.

**M2 — `CALL` / `RET`.**
Guest stack in a reserved region (e.g. growing down from `0x0BFF`) **or** the host `Stack` of return addresses — pick one, document. `CALL imm16`: push `PC+3` (or whatever the instruction size is), `PC = imm16`. `RET`: pop `PC`. A program: `CALL printA` then `HALT`, `printA: OUT; RET`. Trace.

**M3 — Recursion.**
Fibonacci or factorial in poked bytecode (Lab 8 will let you write assembly). `fib(6)` = 8. README: calling convention, a trace of stack depth, and **one overflow**: `fib` with a tiny `CAP` or a missing `RET`, sanitizer or your own "stack overflow" error.

**M4 — Split the binary.**
At least four translation units: `main`, `cpu`, `memory`, `stack` (plus `display` if you have it). No giant `main.cpp`. A `CMakeLists.txt` that lists them. The defense may ask "why is `push` not in `cpu.cpp`?"

### Definition of done

- `Stack` ADT with overflow/underflow handled.
- `CALL`/`RET` work; a non-recursive call demo.
- Recursive `fib` or `fact` in bytecode; result checked; overflow demonstrated.
- Multiple `.cpp`/`.hpp` files; CMake lists them.
- Repo tagged `lab-07`.

---

## Deliverable checklist

- [ ] `stack.hpp`/`cpp`; push/pop fail cleanly.
- [ ] `CALL`/`RET`; trace of a one-level call.
- [ ] Recursive program; convention documented; overflow shown.
- [ ] Project split across headers; CMake updated.
- [ ] Git tag `lab-07`.

---

## Reflection — explain it at the whiteboard

1. Draw the stack as `fact(3)` calls `fact(2)` calls `fact(1)`. What is on each frame?
2. When do you pass by value, by pointer, by reference? Give an `ember` example of each.
3. Why is returning via a global a bad idea? What happens with recursion?
4. What does `RET` pop, and why must `CALL` push `PC` *after* the instruction, not the opcode address?
5. Array stack vs linked stack: one advantage each. Which did you pick and why?
6. What is a header guard / `#pragma once` for? What does the linker error "multiple definition" mean?

---

## Stretch

Queue ADT and an opcode `SEND`/`RECV` (too cute — skip unless you want I/O). Tail-recursive `fact` vs naive, Godbolt, see if the compiler turned it into a loop. `inline` vs a normal function: look at Godbolt, don't `#define` macros that evaluate `x++` twice. Templates: `template<typename T> void swap(T& a, T& b)` as a 5-line extra, not a second project.

---

## Resources

**Watch**

- [What is a stack (CS50 or equivalent, ~10 min)](https://www.youtube.com/watch?v=I47Y6VHcXMU) — plates, then frames.
- Ben Eater — [Stack](https://www.youtube.com/watch?v=dveq3NL4jls) on the 8-bit computer, if you're still on that series.

**Read**

- learncpp.com — [functions](https://www.learncpp.com/cpp-tutorial/introduction-to-functions/), [pass by value](https://www.learncpp.com/cpp-tutorial/introduction-to-function-parameters-and-arguments/), [pass by ref](https://www.learncpp.com/cpp-tutorial/pass-by-lvalue-reference/), [recursion](https://www.learncpp.com/cpp-tutorial/recursion/), [header files](https://www.learncpp.com/cpp-tutorial/header-files/).
- Wikipedia — [Call stack](https://en.wikipedia.org/wiki/Call_stack), [Calling convention](https://en.wikipedia.org/wiki/Calling_convention) (skim).
- Nystrom, Crafting Interpreters — [Calls and Functions](https://craftinginterpreters.com/calls-and-functions.html) — the *idea*, even though it's a different language.
