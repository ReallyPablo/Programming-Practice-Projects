# Lab 07 — Call and Return: Functions, the Stack, and Recursion

> "A function is a named jump with a promise to come back. The stack is how the promise is kept."

**Weeks:** 13–14 · **Language focus:** functions, pass-by-value vs pointer vs reference, headers and translation units, the call stack, recursion · **Project step:** a `Stack` ADT, `SP`, `PUSH`/`POP`, `CALL`/`RET`, recursive factorial in bytecode · **Course:** [EN](README.md) · [UK](README.uk.md) · **Previous:** [Lab 06](lab-06-named-bundles.md) · **Notes:** [theory + experiments](lab-07-call-and-return.notes.md)

---

## This lab's feature

You have been writing functions since Lab 1 (`main`, `dump`, `step`). This week they become a **subject**: a function has a name, parameters, a return value or `void`, and a **frame** on the call stack. Passing `CPU` by value would copy the machine every `step` — so you pass `CPU&`. Passing `int x` copies the number; the callee cannot change the caller's `x`. That is not a style rule. It is how the stack works.

Then you implement the same idea *inside* ember. The machine grows a stack pointer **`SP`** and a stack region at `0xF00`–`0xFFF` ([ISA.md §2](ISA.md#2-memory-map)). **`PUSH A`** puts a byte there; **`POP A`** takes it back. **`CALL addr`** pushes the return address and sets `PC = addr`. **`RET`** pops it back. Recursion is a function that `CALL`s itself — it works because each call's data sits at a different place on the stack, and it stops working when the stack runs out, which you will also show.

Functions, headers, ADTs and recursion are one lab here because they are one mechanism. The **ADT** is `Stack`: `push` / `pop` / `empty` / `full`, array or linked — you pick, you hide the representation behind `stack.hpp`.

You write **factorial** this week, not Fibonacci. Recursive `fact(5)` is about fifteen instructions; recursive `fib` is about forty, and hand-assembling forty bytes with hand-computed jump targets teaches hexadecimal arithmetic, not recursion. `fib` is [Lab 8](lab-08-give-it-a-language.md)'s deliverable, written in the assembly language you are two weeks away from having. The mechanism you build now is what makes it possible.

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

**Return:** `return x;` copies (or moves) a value to the caller. `void` returns nothing. Prefer returning a value when there is one result (`Byte alu_add(...)`). Use out-parameters (`bool& carry`) when you must return two things and haven't made a `struct AluResult` yet. Do **not** return through globals.

**Overload** (same name, different parameter types) is resolved at compile time. Fine for `dump(const Memory&)` vs `dump(const CPU&)`. Do not overload as a party trick.

### 3. Recursion needs a base case and a smaller case

```cpp
int fact(int n) {
    if (n <= 1) return 1;       // base
    return n * fact(n - 1);     // smaller
}
```

Without a base case, stack overflow. Tail recursion is a special case compilers *may* turn into a loop; do not count on it.

Guest `fact`: `CALL` itself with `A` holding `n`. The machine gives you a stack for return addresses; **everything else you must save yourself**. `fact` needs `n` back after the recursive call has finished stomping on `A`, so it pushes it first:

```txt
fact:   ...                 ; if n is 0 or 1, jump to base
        PUSH  A             ; save n -- the call will destroy A
        DEC   A             ; n - 1
        CALL  fact          ; A = fact(n-1)
        POP   B             ; B = the n we saved
        MUL   A, B          ; A = fact(n-1) * n
        RET
base:   LOADI A, 1
        RET
```

That `PUSH` before the call and `POP` after it *is* what a stack frame is. Real compilers emit the same two instructions for the same reason; they just also have a name for the region between them.

The full listing, with addresses and assembled bytes, is **given** in [ISA.md §6](ISA.md#a-worked-example). Type it in, run it, trace it. You are not meant to derive thirty bytes of hexadecimal — you are meant to watch a stack grow and shrink.

The calling convention — argument in `A`, result in `A`, `B` and `H` caller-saved — is written down once, in [ISA.md §6](ISA.md#calling-convention). Restate it in your own README. Two functions that disagree about who saves `B` is the defining bug of this lab, and it is invisible until you can point at the rule.

Fibonacci without memoisation is exponentially slow: `fib(10)` is fine, `fib(40)` is a lecture on why stacks and time both matter. You will write it in [Lab 8](lab-08-give-it-a-language.md), in text, with labels the assembler resolves for you.

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

`#include "stack.hpp"` copies the promise into each `.cpp`. **One definition** of `push` lives in `stack.cpp`. Circular includes: `#pragma once` and "include what you use."

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

**M1 — `SP`, `PUSH`, `POP`, and the `Stack` ADT.**
`SP` starts at `0xFFF`; the stack region is `0xF00`–`0xFFF`. Implement `PUSH A`, `POP A`, `PUSH B`, `POP B` ([ISA.md](ISA.md) `0x50`–`0x53`), empty-descending as the table describes.

Put the push/pop logic behind an ADT in `stack.hpp` / `stack.cpp` — `push`/`pop` returning `bool` for success — so that `cpu.cpp` never touches the stack representation directly. Add an `ember` command `stack` that prints `SP` and the top few bytes, so you can see it.

Overflow (below `STACK_LO`) and underflow (above `STACK_HI`) stop the machine with **your** message. Never a host crash, never a silent wrap.

**M2 — `CALL` / `RET`.**
Exactly as [ISA.md §6](ISA.md#6-how-call-and-ret-work-exactly) specifies: push low byte then high byte of `PC + 3`, pop high then low. A program: `CALL printA`, `HALT`; `printA: OUT`, `RET`. Trace it in the README — one line per step with `PC`, `SP`, and the two stack bytes. Say out loud why the pushed address is `PC + 3` and not the address of the `CALL` itself.

**M3 — Recursion: `fact`.**
Implement `MUL` (`0x1B`) — one line in your ALU — then poke in the listing from [ISA.md §6](ISA.md#a-worked-example) and run it.

- `fact(5)` prints `120`, in 60 steps, and `SP` is back at `0xFFF`.
- `fact(0)` and `fact(1)` both print `1`. Change the first byte pair and check.
- Trace it: one line per `CALL` and `RET` with `SP` and `A`. How deep does it go?

Then make it yours — one of these, your pick, written up in the README:

- Change it to count down and print each `n` on the way in and out, so the trace matches the C++ `fact` from the notes.
- Remove the `PUSH A` / `POP B` pair and explain what it prints and why.
- Make `fact(6)` and explain the answer (720 does not fit in a byte — what does `C` say?).

Finally, **one deliberate overflow**: delete the base case, or shrink the stack region. It must be caught by *your* error message, not by a host crash.

**M4 — Split the binary.**
At least four translation units: `main`, `cpu`, `memory`, `stack` (plus `display` if you have it). No giant `main.cpp`. A `CMakeLists.txt` that lists them. The defense may ask "why is `push` not in `cpu.cpp`?"

### Definition of done

- `SP`, `PUSH`/`POP`, and a `Stack` ADT with overflow/underflow handled.
- `CALL`/`RET` match [ISA.md §6](ISA.md#6-how-call-and-ret-work-exactly) byte for byte; a non-recursive call demo, traced.
- `MUL` implemented; recursive `fact(5) = 120` running; calling convention written down; the listing modified once and explained; overflow demonstrated.
- Multiple `.cpp`/`.hpp` files; CMake lists them.
- Repo tagged `lab-07`.

---

## Levels

**Pick a landing spot before you start.** Basic is a real, passing lab — not a
failure. Standard is the target. Advanced exists so that the people who arrive
already knowing how to program have somewhere to go, and it is not extra credit
for finishing early: it is a harder version of the same machine. Hours are for
someone doing this subject for the first time.

### Basic — "a call comes back" (~8–10 hours)
- `SP` starts at `0xFFF`; `PUSH A` / `POP A` / `PUSH B` / `POP B` per [ISA.md](ISA.md), empty-descending.
- Overflow below `0xF00` and underflow above `0xFFF` stop the machine with **your** message. No host crash, no silent wrap.
- `CALL` / `RET` with the byte order from [ISA.md §6](ISA.md#6-how-call-and-ret-work-exactly), and a one-level call demo (`CALL printA` / `OUT` / `RET` / `HALT`) traced in the README.
- `MUL` implemented; the given `fact` listing poked in and printing `120`.
- Repo tagged `lab-07`.

### Standard — target (~13–15 hours)
- Everything in **Definition of done** above.
- The `Stack` ADT: `stack.hpp` / `stack.cpp`, `push`/`pop` returning `bool`, and nothing outside `stack.cpp` touching the representation. The project split across at least four translation units, all listed in `CMakeLists.txt`.
- `fact` traced by depth, modified once (M3 offers three options) and the result explained.
- The calling convention from [ISA.md §6](ISA.md#calling-convention) restated in your own README.
- One deliberate stack overflow caught by your own error.

### Advanced — distinction (~18–19 hours)
- Everything above, plus `MUL` written as a **subroutine** by repeated addition, and a step-count comparison against the opcode.
- `PUSH H` / `POP H` and a function that needs them.
- A linked-node `Stack` behind the same interface, swapped in without touching `cpu.cpp`.

---

## Deliverable checklist

- [ ] `SP` + `PUSH`/`POP`; `stack.hpp`/`cpp`; push/pop fail cleanly.
- [ ] `CALL`/`RET`; trace of a one-level call showing `PC` and `SP`.
- [ ] `MUL`; recursive `fact` running and traced; one modification explained; convention documented; overflow shown.
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
7. In guest `fact`, why must `n` be pushed *before* the recursive `CALL`? What does the program print if you forget?
8. The stack grows down from `0xFFF`, the heap grows up from `0xC00`. On a machine with no fence between them, what does "stack overflow" actually corrupt?

---

## Stretch

Write `MUL` as a **subroutine** instead of an opcode — repeated addition in a loop, using the stack for its own saved registers. Then use it from `fact` and compare step counts. This is the honest way an 8-bit machine without a multiplier does it.

`PUSH H` / `POP H` ([ISA.md](ISA.md) `0x56`/`0x57`) and a subroutine that needs them — one that walks memory and must restore the caller's pointer.

A linked-node `Stack` behind the same `stack.hpp` interface; swap the implementation without touching `cpu.cpp` and write down one advantage of each. That swap *is* what an ADT buys you.

Tail-recursive `fact` vs naive in [Godbolt](https://godbolt.org/) — did the compiler turn one into a loop? `inline` vs a normal function; and don't `#define` macros that evaluate `x++` twice. Templates: `template<typename T> void swap(T& a, T& b)` as a five-line extra, not a second project.

If `fact` came out clean and you want more: look at the two `JZ base` operands in the given listing. They are the same two bytes. Now insert one instruction above `base` and work out how many bytes in the listing change. Then stop — you are meant to feel that, and [Lab 8](lab-08-give-it-a-language.md) is the answer.

---

## Resources

**Watch**

- [What is a stack (CS50 or equivalent, ~10 min)](https://www.youtube.com/watch?v=I47Y6VHcXMU) — plates, then frames.
- Ben Eater — [Stack](https://www.youtube.com/watch?v=dveq3NL4jls) on the 8-bit computer, if you're still on that series.

**Read**

- learncpp.com — [functions](https://www.learncpp.com/cpp-tutorial/introduction-to-functions/), [pass by value](https://www.learncpp.com/cpp-tutorial/introduction-to-function-parameters-and-arguments/), [pass by ref](https://www.learncpp.com/cpp-tutorial/pass-by-lvalue-reference/), [recursion](https://www.learncpp.com/cpp-tutorial/recursion/), [header files](https://www.learncpp.com/cpp-tutorial/header-files/).
- Wikipedia — [Call stack](https://en.wikipedia.org/wiki/Call_stack), [Calling convention](https://en.wikipedia.org/wiki/Calling_convention) (skim).
- Nystrom, Crafting Interpreters — [Calls and Functions](https://craftinginterpreters.com/calls-and-functions.html) — the *idea*, even though it's a different language.
