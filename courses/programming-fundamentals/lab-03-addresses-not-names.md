# Lab 03 — Addresses, Not Names: Pointers and Memory

> "A pointer is a variable whose value is an address. Everything else is consequences."

**Weeks:** 5–6 · **Language focus:** addresses, `&` and `*`, typed vs `void*`, `sizeof`, pointer arithmetic, null, the difference between a name and a location · **Project step:** `LOAD`/`STORE`, immediates, the address register `H`, a PC that *walks* memory · **Course:** [EN](README.md) · [UK](README.uk.md) · **Previous:** [Lab 02](lab-02-bits-dont-lie.md) · **Notes:** [theory + experiments](lab-03-addresses-not-names.notes.md)

---

## This lab's feature

Last week the CPU added registers. Registers are names. Memory is a street of numbered houses. A **pointer** is a slip of paper with a house number on it.

In C++, `&x` is "the address of `x`." `*p` is "the thing at address `p`." `p + 1` is not "one more byte" — it is "one more *element of the type `p` points at*." That last sentence is the entire subject of pointer arithmetic, and it is why `ember`'s program counter is a `uint16_t` index into `Byte data[4096]`, not a host `int*` you increment casually.

This lab makes the VM a von Neumann machine: **instructions and data live in the same box.** `PC` is an address. `LOAD A, [addr]` copies a byte from memory into a register. `STORE [addr], A` copies the other way. `LOADI A, imm` reads the *next* byte after the opcode — which means `step` must increment `PC` by more than one. You will also meet `void*` and `sizeof`, and you will let AddressSanitizer yell when you walk off the array on purpose.

And `ember` grows a register that is **not** a value: **`H`**, sixteen bits wide, whose whole job is to hold an address. `LOAD A, [H]` follows it; `INCH` walks it to the next cell. `A` and `B` hold numbers; `H` holds *where*. That is a pointer, built into the hardware — and it is the reason a program can loop over memory at all, instead of only touching addresses it knew when it was assembled.

This is also the lab where the [memory map](ISA.md#2-memory-map) starts to matter: code lives at `0x000`, your data at `0x800`. Two regions, one box.

What this lab is not: "bypass strict typing" by casting a `float*` to `int*` and pretending you decoded the bits. That is undefined behaviour. The honest way to see a float's bytes is `std::memcpy` into a `uint32_t` (or a dump of `ember` memory you stored them in). Sanitizers stay on.

---

## Theory

### 1. Names live in the compiler; addresses live in the machine

```cpp
int x = 65;
int* p = &x;     // p holds the address of x
*p = 66;         // the memory that x names now holds 66
```

`x` is a name the compiler uses. After compilation there is a location. `&` takes that location. `*` follows a location to a value. Drawing this once — box `x` with `65` in it, arrow from `p` — is worth more than a page of syntax.

**Null:** `nullptr` (or `0` in old code) means "this pointer does not point." Dereferencing it is UB; ASan will usually catch it. In `ember`, an address `>= MEM_SIZE` is the analogue: reject it, do not wrap unless you *mean* wrap and document it.

### 2. A pointer has a type so `*` and `+` know the size

`int*`, `char*`, `Byte*` are different. `sizeof(*p)` is the size of the **pointee**. `p + 1` adds `sizeof(*p)` bytes to the address. That is why you iterate a `Byte*` over `ember` memory one cell at a time, and why `int* q = ...; q + 1` skips four bytes on a typical machine.

```cpp
Byte* base = mem.data;          // address of cell 0
Byte* cell = base + 10;         // cell 10, because sizeof(Byte)==1
*cell = 0x41;
```

Inside the VM, prefer **indices** (`uint16_t addr`) over host pointers for guest addresses. Host pointers are how *your C++* talks to the `data` array. Guest addresses are numbers the ember-program sees. Mixing them is the classic bug: storing a host pointer into ember memory and expecting it to mean something on another machine (or after realloc). Don't.

### 3. `void*` is "an address of unknown type"

You can assign any object pointer to `void*` and back with a cast. You **cannot** dereference or increment a `void*` — the compiler does not know the size. That is the whole feature. Use it when you must pass "some buffer" (later: a dump function). Do not use it to launder types and read a `float` as `int`. **Type punning through the wrong pointer is UB.** To inspect bytes of a `float`:

```cpp
float f = 1.0f;
std::uint32_t bits;
std::memcpy(&bits, &f, sizeof(bits));   // the defined way
```

Or `set` the four bytes into `ember` and dump them. Same insight, no UB.

### 4. `sizeof`, alignment, and why the dump is the truth

`sizeof(T)` is how many bytes a `T` occupies, including padding inside structs (Lab 6). `sizeof(p)` where `p` is a pointer is the size of the *address* (8 on a 64-bit host), not the pointee. `sizeof(*p)` is the pointee. Print both this week; they confuse everyone once.

### 5. The program counter is a pointer by another name

`PC` holds a guest address. `step`:

1. `Byte op = mem.get(cpu.pc);`
2. decode;
3. if the instruction has an immediate, `Byte imm = mem.get(cpu.pc + 1);`
4. execute;
5. `cpu.pc += size_of_this_instruction` — the size from [ISA.md](ISA.md), not a guess.

`LOAD A, [addr]` needs a 16-bit address: two bytes, little-endian (you discovered endianness in Lab 1 Stretch; do it for real now). `STORE` is the inverse. After this, a program can put data at `0x800` and code at `0x000` and *find* the data by address.

### 6. `H` — a pointer the CPU can hold

`LOAD A, [0x0800]` has the address baked into the instruction. To walk an array
you need an address the program can **change**, and eight bits are not enough to
reach 4096 cells. So the CPU gets a 16-bit register whose value is an address:

```txt
LOADH H, 0x0800     ; H now points at the first byte of the data region
LOAD  A, [H]        ; A = mem[H]        -- *p
INCH                ; H = H + 1         -- ++p
LOAD  A, [H]        ; the next cell
```

Compare with the C++ on the left of your screen:

```cpp
Byte* p = &mem.data[0x800];
Byte a = *p;
++p;
a = *p;
```

Same three ideas, two notations: a register that holds a location, an operation
that follows it, an operation that moves it. `INCH` moves `H` by **one byte**
because an `ember` cell is one byte — which is exactly why `p + 1` on an `int*`
moves four. Pointer arithmetic counts *elements*, and here the element is a byte.

You will not write a loop yet — jumps arrive in [Lab 4](lab-04-the-shape-of-control.md).
This week `H` is stepped by hand, and that is enough to see it.

### Prove it to yourself (notes §§1–4)

1. `int x = 65; int* p = &x; std::cout << x << ' ' << *p << ' ' << p << '\n'; *p = 1; std::cout << x;`
2. `int a[3] = {10,20,30}; int* p = a; std::cout << *p << ' ' << *(p+1) << ' ' << *(p+2);` — then print `(p+1) - p` and the *byte* distance if you cast to `char*`.
3. `sizeof(int*)` vs `sizeof(int)` vs `sizeof(void*)`.
4. Write a function `void inc(int* p) { *p = *p + 1; }` and call `inc(&x)`. Then try `void inc(int p) { p = p + 1; }` — why doesn't `x` change?
5. Walk one past the end of a 4-element array with ASan on. Read the report. That is M4.

---

## Project step: load, store, and an immediate

### Milestones

**M1 — Guest addresses are numbers.**
`get`/`set` already take an address. Add `get16`/`set16` little-endian. `regs` also prints `PC` and `H`. Document endianness with a dump: `set16 0 0x1234` → bytes `34 12`. Little-endian is not a style choice here: [ISA.md §4](ISA.md#4-encoding) says every 16-bit operand in the instruction stream is stored low byte first, so `LOADH H, 0x0A00` assembles to `28 00 0A`.

**M2 — The `0x2_` group.**
Implement [ISA.md](ISA.md) rows `0x20`–`0x2C`: `LOADI A/B`, `LOAD A/B, [addr16]`, `STORE [addr16], A/B`, `MOV`, and the address register — `LOADH`, `LOAD A, [H]`, `STORE [H], A`, `INCH`, `DECH`. Plus `OUT` (`0x02`) and `OUTN` (`0x03`) from the control group, so a program can say something.

Sizes come from the table. `step` must not run off the end of memory: if `PC` would fetch past `MEM_SIZE`, halt with an error (this is a bounds-checked pointer).

**M3 — A program that uses data.**
Poke at `0x800` the bytes of a message (`65 66 67 0` — `ABC`). At `0x000`, a program that loads from `0x800` into `A`, `OUT`s it, and halts. Run with `run` (step until `HALT`). Paste the terminal line that prints `A` and the `dump` of both regions.

Then do it a second time **through `H`**: `LOADH H, 0x0800`, `LOAD A, [H]`, `OUT`, `INCH`, `LOAD A, [H]`, `OUT`, `HALT` — and watch `regs` show `H` moving. The output is `AB`. Those seven instructions are the loop you will write for real in Lab 4.

**M4 — The host pointer vs the guest address.**
In the README: one paragraph on why `CPU` holds `Memory*` (host pointer to the whole box) plus `uint16_t pc` and `uint16_t h` (guest addresses), not `Byte*` pointers into `data`. Note that `H` is a pointer you can dump: it is a number inside the machine, so a guest program can compute with it. A host `Byte*` is meaningless to the guest and different on every run.

Then: temporarily write a 3-line program that does `data[MEM_SIZE] = 1` (off-by-one). Paste the ASan report — [errors.notes.md §3](errors.notes.md) explains which three lines of it matter. Restore the bounds check. That report is the deliverable.

### Definition of done

- `get16`/`set16` little-endian; documented.
- The `0x2_` group from [ISA.md](ISA.md), plus `OUT` and `OUTN`; `run` until HALT.
- A program that loads data from a different region than code, once with an absolute address and once through `H`.
- ASan off-by-one captured and fixed; host vs guest explained.
- Repo tagged `lab-03`.

---

## Levels

### Basic — "the CPU can reach memory" (~10–12 hours)
- `get16` / `set16`, little-endian, documented with a dump.
- `LOADI A/B`, `LOAD`, `STORE`, `OUT` from [ISA.md](ISA.md), with the sizes from the table.
- `run` executes until `HALT` or an error.
- A program with code at `0x000` and data at `0x800` that prints a character.
- Repo tagged `lab-03`.

### Standard — target (~15–17 hours)
- Everything in **Definition of done** above.
- The address register `H`: `LOADH`, `LOAD A, [H]`, `STORE [H], A`, `INCH`. This is the lab's whole idea in hardware — a register that holds an address instead of a value.
- `OUTN` as well as `OUT`.
- An ASan report for a deliberate off-by-one, pasted, then fixed.
- One paragraph in the README: host pointer vs guest address, and a bug that mixing them would cause.

### Advanced — distinction (~20 hours)
- Everything above, plus a `void dump(const void* ptr, std::size_t n)` that hexdumps any host object — `dump(&cpu, sizeof(cpu))`.
- A four-byte copy loop driven by `H`, stepped by hand and traced.

---

## Deliverable checklist

- [ ] 16-bit little-endian memory accessors.
- [ ] `LOADI` / `LOAD` / `STORE` / `MOV` / `OUT` / `OUTN`; `run`.
- [ ] `H`, `LOADH`, `LOAD A, [H]`, `STORE [H], A`, `INCH`; `regs` shows `H`.
- [ ] Code at `0x000`, data at `0x800`, a trace in the README.
- [ ] ASan report for an off-by-one, then the fix.
- [ ] Git tag `lab-03`.

---

## Reflection — explain it at the whiteboard

1. Draw `int x = 65; int* p = &x;` as boxes and an arrow. What is `p`, what is `*p`, what is `&p`?
2. Why does `p + 1` depend on the type of `p`?
3. Why can't you dereference `void*`?
4. Why is reading a `float` through an `int*` undefined, and what do you do instead?
5. What is the difference between a host pointer and a guest address in `ember`? Give a bug that mixing them would cause.
6. `inc(int x)` vs `inc(int* p)` — which one can the callee use to change the caller's `x`, and why?
7. `A` is 8 bits, `H` is 16. Why can `H` not be 8 bits? What is the largest address a byte can name?
8. Write `LOAD A, [H]` / `INCH` as two lines of C++ with a `Byte*`. Which one is `*p` and which is `++p`?

---

## Stretch

A `void dump(const void* ptr, std::size_t n)` that hexdumps any host object — `dump(&cpu, sizeof(cpu))` shows you your own CPU as bytes. That's `void*` earning its keep, and it previews Lab 6's question about struct layout.

Then: a four-byte copy driven entirely by `H` and `MOV`, stepped by hand, traced in the README. Or add `HLOW` ([ISA.md](ISA.md) `0x2D`) so a program can print how far `H` has walked.

---

## Resources

**Watch**

- [Pointers in C/C++ (mycodeschool, 17 min)](https://www.youtube.com/watch?v=zuegQmMdy8M) — boxes and arrows, slowly.
- Ben Eater — [RAM](https://www.youtube.com/watch?v=ui20Nla5JXw) if "address line" is still abstract.

**Read**

- learncpp.com — [Introduction to pointers](https://www.learncpp.com/cpp-tutorial/introduction-to-pointers/), [null](https://www.learncpp.com/cpp-tutorial/null-pointers/), [pointer arithmetic](https://www.learncpp.com/cpp-tutorial/pointer-arithmetic-and-subscripting/).
- cppreference — [`reinterpret_cast` / type aliasing](https://en.cppreference.com/w/cpp/language/reinterpret_cast) (the rule you're *not* breaking) and [`memcpy`](https://en.cppreference.com/w/cpp/string/byte/memcpy).
- CS:APP §3.4 (machine-level addressing) if you want the assembly view of `&` and `*`.
