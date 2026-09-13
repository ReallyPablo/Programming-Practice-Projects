# Lab 01 — A Box of Bytes: Types, Compilation, and a Memory You Can See

> "The purpose of computing is insight, not numbers."
> — Richard Hamming

**Weeks:** 1–2 · **Language focus:** what a program is, compilation, integer and floating types as *sizes*, overflow, `const`, characters as numbers, a tiny CLI · **Project step:** a 4 KB box of memory you can dump and poke · **Course:** [Programming Fundamentals — Build a Computer You Can See](README.md) · **Notes:** [theory + experiments](lab-01-a-box-of-bytes.notes.md)

---

## This lab's feature

A computer does not know about "integers" or "variables." It has **bytes** — groups of eight bits — sitting in memory, and a processor that can add them, copy them, and jump. Everything you will ever program is a story about those bytes.

A **type** is the story: how many bytes, which operations are allowed, and how the bits are read. `int` is not "a number." It is (usually) four bytes, two's complement, with wrap-on-overflow that the language calls *undefined* if it is signed. `char` is one byte that we sometimes print as a glyph. `float` is a scientific-notation trick that cannot hold `0.1` exactly. Once you have seen a byte printed as decimal, hex, binary, *and* a character at the same time, types stop being vocabulary from a lecture and become a view of memory.

This lab builds that view. You will compile a real C++ program with warnings and sanitizers on, stop it in a debugger, and grow it into `ember`: 4096 bytes with a prompt that dumps them. By the end of the course that box will be a computer. Today it is just honest.

---

## Theory

### 1. Source is not what runs

You write text. The **compiler** translates it into **machine code** the CPU can execute. Roughly:

```txt
source.cpp  →  preprocessor  →  compiler  →  assembler  →  linker  →  ember
   text           headers         .o files      bytes       libraries    a program
```

You do not need to recite the pipeline. You need three consequences:

- A **syntax error** is the compiler refusing to translate. The program never existed.
- A **warning** is the compiler saying "this is legal and I am suspicious." We treat warnings as errors (`-Werror`) so suspicion cannot hide.
- A **runtime error** is the program running and then doing something the machine or the sanitizer hates: dividing by zero, walking off an array, using an uninitialized value. The compiler cannot catch all of these — that is why **AddressSanitizer** and **UndefinedBehaviorSanitizer** exist, and why they stay on all semester.

`main` is a function the runtime *calls* when the program starts. `return 0` means success to the operating system. That is the whole contract for Lab 1.

### 2. A type is a size and a set of operations

Declare `int x = 65;` and the compiler picks a few bytes (print `sizeof(int)` — know *your* number, do not memorize a textbook's), stores a two's-complement representation of 65 there, and will let you `+ - * / %` on it. The **same bits** `01000001` are also the ASCII character `'A'`. Memory does not care. Your type annotation is a promise about how you will read them.

| Type (typical 64-bit) | `sizeof` | What it's for |
|---|---|---|
| `char` / `std::uint8_t` | 1 | A byte. Characters. The cell of `ember`'s memory. |
| `std::uint16_t` | 2 | Addresses into 4 KB. An unsigned 16-bit integer. |
| `int` / `std::int32_t` | 4 | Everyday signed integers. Overflow of *signed* `int` is undefined. |
| `unsigned` / `std::uint32_t` | 4 | Modular arithmetic. Overflow wraps. Prefer this when wrap is the point. |
| `float` | 4 | ~7 decimal digits. Fast, approximate. |
| `double` | 8 | ~16 decimal digits. Default for real arithmetic. |

Prefer the `<cstdint>` names (`std::uint8_t`, `std::uint16_t`) when the width *matters* — it does, in a VM. Use `int` for loop indices until Lab 5 tells you otherwise.

**Literals:** `65` is decimal, `0x41` is hex, `0b01000001` is binary (C++14), `'A'` is a character, `65.0` is a double. They can be the same bits. Write all four next to a dump this week.

**Integer division truncates toward zero:** `5 / 2` is `2`, not `2.5`. Remainder is `%`. Mixing `int` and `double` converts; know which way (`int` → `double` is usual in `1 / 2.0`).

**`const`** means "this name will not be used to change the bits." The bits still sit in memory. Use `const` by default for values that should not move — `const std::size_t MEM_SIZE = 4096;` — so the compiler yells if you accidentally do.

### 3. Overflow, floats, and other lies

Unsigned wrap is defined: `std::uint8_t x = 255; x = x + 1;` → `0`. Signed overflow is **undefined behaviour** — the compiler may assume it never happens and then your loop does something insane. In `ember`, memory cells are **unsigned bytes**. Arithmetic you implement later (Lab 2) will wrap on purpose, on `uint8_t` / `uint16_t`.

Floating point is scientific notation in binary: a sign, an exponent, a fraction. It cannot represent most decimals. `0.1 + 0.2 == 0.3` is `false`. This is not a bug in your compiler. Do not use `==` on floats for "are these the same measurement"; compare a difference against a tolerance, or (better, this course) keep money and pixels in integers.

### 4. Characters are numbers with a costume

`'A'` is the integer 65 in ASCII. `'A' + 1` is `'B'`. A **string** this early is a sequence of those bytes ending in `'\0'` (Lab 5 treats this properly). Escape sequences: `'\n'` newline, `'\t'` tab, `'\\'` a real backslash. You can store any byte, including ones that do not print; a dump that shows `.` for non-printable ASCII is a gift to your future self.

### 5. Variables are names for storage; initialization is not optional

`int x;` without an initializer is a named box with **garbage** in it (whatever was in that stack slot). Reading it is UB. Always initialize: `int x = 0;`. A **literal** is a value written in the source. A **constant** is a named value that cannot be assigned to. A **variable** is a named value that can.

Scope starts next lab in anger; for now: a name lives from its declaration to the end of the `{ }` block it sits in.

### Prove it to yourself (a 15-line program, ~15 minutes)

Required — notes §§1–4, same snippets:

1. Print `sizeof(char)`, `sizeof(int)`, `sizeof(float)`, `sizeof(double)`, `sizeof(void*)`. Write the numbers in the README. They are *your* machine's.
2. `std::uint8_t u = 255; u = u + 1;` and `int s = 2147483647; s = s + 1;` — compile the second with sanitizers. What happens to each?
3. `std::cout << (0.1 + 0.2) << '\n';` and `std::cout << std::boolalpha << (0.1 + 0.2 == 0.3) << '\n';`
4. Print `65`, `0x41`, `static_cast<int>('A')`, and `static_cast<char>(65)` on four lines. Then `'A' + 1`.
5. `int a = 5, b = 2; std::cout << a / b << ' ' << a / 2.0 << '\n';`

---

## Project step: a box of 4096 bytes

### Set up the project

```bash
mkdir ember && cd ember
git init
# CMakeLists.txt: C++17, -Wall -Wextra -Werror, sanitizers for Debug
```

Target layout at the end of this lab:

```txt
ember/
  CMakeLists.txt
  README.md
  src/
    main.cpp          # reads a line, dispatches a command, loops until quit
    memory.hpp        # const MEM_SIZE = 4096; using Byte = std::uint8_t;
    memory.cpp        # Memory: a Byte array, get/set with bounds checks
    dump.cpp          # hex + ASCII dump, like hexdump -C
    dump.hpp
  .clang-format
  .gitignore          # build/, .idea/, *.o
```

Use a `struct Memory { Byte data[MEM_SIZE]{}; };` — the `{}` **zeroes** the box. That one brace is the difference between a computer and garbage.

### Milestones

**M1 — It builds, it runs, sanitizers are on.**
`cmake -S . -B build -DCMAKE_BUILD_TYPE=Debug` then `cmake --build build`. `./build/ember` prints a one-line greeting and a prompt. A `CMakeLists.txt` that does not pass `-fsanitize=address,undefined` on Apple/Linux Debug builds is not done. Hit a breakpoint on the greeting with lldb/gdb/your IDE; screenshot or write the command you used in the README.

**M2 — The box exists and you can dump it.**
Command `dump` prints 4096 bytes as hex, 16 bytes per line, with an ASCII gutter (printable `0x20–0x7E`, otherwise `.`). Address column in hex. After a fresh start the dump is all zeroes — *prove it* with a screenshot.

**M3 — Peek and poke.**
`set <addr> <value>` writes a byte (`value` accepted as decimal or `0x` hex). `get <addr>` prints that byte as **decimal, hex, binary, and character**. Reject addresses `>= 4096` with a message; do not crash. *Check:* `set 0 65` then `get 0` shows `65  0x41  0b01000001  'A'`.

**M4 — Break it on purpose, then write it down.**
Three experiments, evidence in the README:

1. `set 0 255` then mentally add one (or a tiny `inc` command). Show wrap to 0. Contrast with a *signed* `int` overflow compiled with UBSan (snippet from theory §3).
2. Store the bytes of a `float` (or just type `0.1` in a scratch program) and explain why `== 0.3` fails — one paragraph, not a IEEE-754 essay.
3. `set 0 65` / `set 1 66` / `set 2 0` and dump — you have a C-string `"AB"` sitting in memory. Note the `0` that terminates it. Lab 5 will care.

### Definition of done

- The project builds with C++17, warnings-as-errors, and sanitizers in Debug.
- `dump` / `get` / `set` / `quit` work; out-of-range addresses are rejected.
- `get` shows four views of the same byte.
- The three experiments are in the README with numbers or screenshots.
- You have stopped the program in a debugger once.
- Repo tagged `lab-01`.

---

## Deliverable checklist

- [ ] CMake project, C++17, `-Wall -Wextra -Werror`, ASan+UBSan on Debug (Unix).
- [ ] `Memory` of 4096 zeroed bytes; bounds-checked `get`/`set`.
- [ ] `dump` in hex + ASCII; `get` in dec/hex/bin/char; `quit`.
- [ ] Debugger breakpoint documented; sizeof table in the README.
- [ ] Experiments 1–3 documented.
- [ ] Git tag `lab-01`.

---

## Reflection — explain it at the whiteboard

1. What does the compiler do? Name one error it can catch and one it cannot.
2. Why is `sizeof` not the same on every machine? What *is* the same if you use `std::uint8_t`?
3. Why is signed overflow undefined but unsigned wrap defined? Which one should `ember`'s bytes use, and why?
4. Why is `0.1 + 0.2` not `0.3`? When would you store a quantity as `int` instead of `float`?
5. The bits `01000001` — give three types you might use to read them, and what you'd "see."
6. What is the difference between a literal, a `const`, and a variable? Why initialize?
7. What does AddressSanitizer buy you that a passing "it printed 42" test does not?

---

## Stretch

Write `set16 <addr> <value>` that stores a 16-bit value. Then answer, with a dump: **where does the low byte go?** (This is [endianness](https://en.wikipedia.org/wiki/Endianness). Your laptop is almost certainly little-endian: `set16 0 0x1234` puts `34` at address 0 and `12` at address 1.) Optionally paste the same `int x = 65;` into [Compiler Explorer](https://godbolt.org/) and circle the instruction that moves 65 into a register.

---

## Resources

**Watch**

- Crash Course Computer Science — [How Computers Calculate (11 min)](https://www.youtube.com/watch?v=1I5ZMmrOfnA) and [Registers and RAM (12 min)](https://www.youtube.com/watch?v=fpnE6UAfbtU). Binary, then "the box." Watch these first if "byte" still feels like vocabulary.
- Ben Eater — [How do computers work? (short)](https://www.youtube.com/watch?v=ZXlr4s_yzkE). A register is a thing you can point at on a desk.

**Read**

- learncpp.com — [Introduction to programming](https://www.learncpp.com/cpp-tutorial/introduction-to-these-tutorials/), [Variables and initialization](https://www.learncpp.com/cpp-tutorial/variable-assignment-and-initialization/), [Void, literals, const](https://www.learncpp.com/cpp-tutorial/constants/). The textbook for the C++ spelling.
- cppreference — [`cstdint`](https://en.cppreference.com/w/cpp/header/cstdint), [fundamental types](https://en.cppreference.com/w/cpp/language/types). The widths.
- Goldberg — [What Every Computer Scientist Should Know About Floating-Point Arithmetic](https://docs.oracle.com/cd/E19957-01/806-3568/ncg_goldberg.html) is the famous paper; you need *one page of intuition*, not the paper. The experiment in §3 is enough for this lab.
- CMake — [tutorial, step 1](https://cmake.org/cmake/help/latest/guide/tutorial/index.html). Twenty minutes; you'll live in it all semester.
