# Lab 05 — Many of One Thing: Arrays, Strings, Search, and a Screen

> "An array is a lie we tell about a stretch of memory: same type, adjacent, indexable in O(1)."

**Weeks:** 9–10 · **Language focus:** 1D arrays, 2D as `y * width + x`, C-strings and `'\0'`, linear search (again, on purpose), bubble/insertion sort · **Project step:** a 64×32 display, `PLOT`, sort a region, print a string · **Course:** [EN](README.md) · [UK](README.uk.md) · **Previous:** [Lab 04](lab-04-the-shape-of-control.md) · **Notes:** [theory + experiments](lab-05-many-of-one-thing.notes.md)

---

## This lab's feature

One byte is a cell. **Many bytes of the same type, packed next to each other,** are an array. The CPU already had this — `ember`'s memory *is* `Byte data[4096]`. This week you start *using* that fact as a programmer: index, nest two indices into a grid, stop at `'\0'`, swap two cells until a slice is sorted.

What makes the array visible is the **display** — and the display is not a separate array. It is **256 bytes of `ember` memory**, at `0xA00`, one bit per pixel ([ISA.md §7](ISA.md#7-the-display-is-memory)). `SHOW` draws them. `PLOT` sets one. But so does `STORE [H], A`, and that is the point of the lab: your screen is a region of the same box you have been dumping since week 2.

Run `dump` after drawing something and read the hex at `0xA00`. Those are your pixels. Two dimensions, a row stride of 8 bytes, one bit per cell — the formula is the whole of "2D", and nothing about it is a metaphor.

Strings are arrays of `char` that agree to end at `0`. You already poked `"AB"` in Lab 1. Now `OUTS addr` prints until `'\0'` or a max length — and you will not walk off the box doing it.

---

## Theory

### 1. An array is storage plus a rule for the i-th element

```cpp
Byte buf[8] = {1, 2, 3};  // rest zeroed
buf[0] = 9;
```

`buf[i]` is `*(buf + i)` (Lab 3). Valid `i` is `0 .. 7`. `buf[8]` is ASan again. The name `buf` in most expressions **decays** to a pointer to the first element — that is why you pass `buf` and `size` to functions separately. (A real `std::array` or `std::span` carries the size; you may look, not substitute, until you can explain decay.)

Initialize. A missing `{}` on `Byte buf[8];` is garbage.

### 2. Two dimensions are one, with a stride

There is no 2D memory. A matrix `m[row][col]` is a formula:

```txt
index = row * NCOLS + col
```

Row-major (C/C++) means **cells of a row sit together**. Nested loops: outer `row`, inner `col` walks memory sequentially — faster, and it matches how you dump a framebuffer.

`ember`'s display adds one twist: a pixel is a **bit**, not a byte, so the row stride is measured in bytes and the column splits into byte-and-bit:

```txt
byte address = 0xA00 + y * 8 + (x / 8)      ; 64 pixels / 8 bits = 8 bytes per row
bit number   = 7 - (x % 8)                  ; bit 7 is the LEFTMOST pixel
lit          = (mem[byte address] >> bit number) & 1
```

`y * 8` is the stride. `x / 8` is which byte in the row. `x % 8` is which bit in
that byte — and `7 -` is there because we write bits left to right but number
them right to left. Get that backwards and your picture comes out mirrored in
groups of eight, which is a wonderfully diagnosable bug.

Setting and clearing that bit is Lab 2's triple, arriving with a job:
`mem[a] |= (1u << n)` and `mem[a] &= ~(1u << n)`.

### 3. Strings: length by convention

A **C-string** is `char s[] = "hi";` which is `{ 'h', 'i', '\0' }`. `strlen` walks until 0. If the 0 is missing, it walks into the void (ASan). In `ember`, guest strings are the same bytes, living in the data region at `0x800`. `OUTS` must have a **cap** (256 bytes, per [ISA.md](ISA.md)) as well as `'\0'` — because the guest program that forgot its terminator is *your* problem to survive, not a reason to read 4 KB of screen memory into the terminal.

`char` is a number. `'0' + 3` is `'3'` — handy for printing a one-digit index without a full formatter.

### 4. Sort is nested loops and a swap

**Bubble sort:** adjacent swaps, outer pass `n` times. **Insertion sort:** take the next element, slide it left into a sorted prefix. Both are O(n²). Both fit on a page. You will sort a guest region in C++ (`sort <lo> <hi>`) and optionally as bytecode (Stretch — tedious, educational).

Swap is the Lab 1 scratch `tmp = a; a = b; b = tmp` — or a function `void swap(Byte& a, Byte& b)` if you have already seen references; otherwise `void swap(Byte* a, Byte* b)`.

Linear search you have (Lab 4). Run it on the framebuffer: "find the first lit pixel."

### Prove it to yourself (notes §§1–3)

1. `int a[] = {1,2,3}; std::cout << sizeof(a) << ' ' << sizeof(&a[0]);` — why different?
2. Fill `int m[2][3]`, print `m[1][2]` and the equivalent `*(&m[0][0] + 1*3 + 2)`.
3. `char s[] = "AB"; s[2] = 'X';` then `std::cout << s;` with ASan — what happens?
4. Bubble-sort `{4, 1, 3, 2}` on paper for one pass, then run it.
5. On paper: a 16×2 display packed into `Byte pixels[4]`. Which byte and which bit is `(9, 1)`? Check with the formula, then with the real `0xA00 + y*8 + x/8` on a 64×32 screen.

---

## Project step: pixels, text, and a sorted row

### Display contract

Fixed, from [ISA.md §7](ISA.md#7-the-display-is-memory) — do not invent your own:

- **64×32** pixels, **1 bit per pixel**, **256 bytes**, at `VRAM_LO = 0xA00`.
- It lives **inside `Memory`**, not in a separate host array. There is no `Byte pixels[]`. There is `mem.data[0xA00 .. 0xAFF]`.
- `show` — print the screen in the terminal (`#` or `█` for a lit pixel, space otherwise).
- Opcodes `0x40`–`0x43`: `CLS`, `PLOT` (`x = A`, `y = B`; off-screen sets `C` and changes nothing), `SHOW`.

A byte per pixel would cost 2048 bytes — half the machine — for a screen that
only needs 256. That is not a style preference; that is why Lab 2 existed.

### Milestones

**M1 — The framebuffer.**
`show()` is **given** — it is a nested loop like Lab 1's dump, and it is scaffolding, not the idea:

```cpp
// GIVEN. Draw VRAM into the terminal.
void show(const Memory& mem) {
    for (int y = 0; y < 32; ++y) {
        for (int x = 0; x < 64; ++x) {
            Byte cell = mem.data[0xA00 + y * 8 + (x / 8)];
            bool lit  = (cell >> (7 - (x % 8))) & 1;
            std::cout << (lit ? '#' : '.');
        }
        std::cout << '\n';
    }
}

// YOURS. The same formula, backwards: set the bit instead of reading it.
// Reject x >= 64 or y >= 32.
void plot(Memory& mem, int x, int y);
void clear(Memory& mem);      // 256 bytes of zero
```

`plot` is three lines and it *is* the lab. Read `show` until you can say which
part of it is the stride, which is the byte, and which is the bit — then write
`plot` without looking back at it.

Draw a border from C++ so `show` has something to photograph.

**M2 — `CLS` / `PLOT` / `SHOW` as instructions.**
A poked program that plots three pixels and `HALT`s. `run`, then `show`.

**M3 — Prove the screen is memory.**
Two things, and they matter more than M2:

1. Run the second program in [ISA.md §9](ISA.md#9-two-programs-to-check-yourself-against): `CLS`, `LOADI A, 0x80`, `LOADH H, 0x0A00`, `STORE [H], A`, `SHOW`. One pixel in the top-left corner, drawn with **no `PLOT` at all**.
2. Draw the border from M1, then `dump` and paste the lines from `0xA00`. Point at one byte and say which eight pixels it is.

If the pixel lands anywhere but the corner, exactly one of three things is wrong: the memory map, your bit order, or `show`. Now you know which three to check.

**M4 — Strings.**
`OUTS` (`0x04`) prints a guest C-string with a cap. Poke `HELLO\0` at `0x800` and print it. Do **not** use `std::string` for the guest; you may use it for the host CLI.

**M5 — Search a region.**
`find` already exists (Lab 4). Point it at the data region, and then at VRAM to
find the first non-zero byte of the picture you drew. Two very different-looking
questions, one loop.

Sorting moved to **Advanced** — it is a good exercise and it is not what this lab
is about. Take it if M1–M4 came out fast.

### Definition of done

- 64×32 1-bit display **inside guest memory** at `0xA00`; `show`, `CLS`, `PLOT`, `SHOW`.
- One pixel lit with `STORE [H], A` and no `PLOT`, plus a dump of VRAM with one byte explained.
- Guest C-string print with a cap; a `HELLO` demo.
- `find` run over both the data region and VRAM.
- The byte/bit address formula in the README, in one block.
- Repo tagged `lab-05`.

---

## Levels

**Pick a landing spot before you start.** Basic is a real, passing lab — not a
failure. Standard is the target. Advanced exists so that the people who arrive
already knowing how to program have somewhere to go, and it is not extra credit
for finishing early: it is a harder version of the same machine. Hours are for
someone doing this subject for the first time.

### Basic — "there is a screen" (~8–10 hours)
- `plot` and `clear` written against the given `show`, using the formula from theory §2. Off-screen coordinates rejected.
- VRAM lives **in `ember` memory** at `0xA00`, 256 bytes, one bit per pixel — no separate host array.
- `CLS`, `PLOT`, `SHOW` as opcodes; a border drawn from C++; a poked program that plots three pixels.
- Repo tagged `lab-05`.

### Standard — target (~13–15 hours)
- Everything in **Definition of done** above.
- The proof that the screen is memory: light the top-left pixel with `STORE [H], A` and no `PLOT` ([ISA.md §9](ISA.md#9-two-programs-to-check-yourself-against)), then dump `0xA00` and point at the byte you wrote.
- `OUTS` with both a `' '` check **and** a cap; `HELLO` printed from `0x800`.
- `find` run over the data region and over VRAM.
- The byte/bit formula in the README, in one block.

### Advanced — distinction (~19–21 hours)
- Everything above, plus `sort <lo> <hi>` in place on guest memory, with before/after dumps.
- The sort visualised as bars on the display, one `SHOW` per pass.
- A bouncing pixel animated from a host loop, or `rowmin <y>`.

---

## Deliverable checklist

- [ ] VRAM at `0xA00` inside `Memory`; `show`; bounds-checked `plot`.
- [ ] `CLS`/`PLOT`/`SHOW` opcodes; three-pixel program.
- [ ] A pixel drawn with `STORE [H], A`; VRAM dump in the README.
- [ ] `OUTS` with `'\0'` and a cap.
- [ ] `find` over data and over VRAM; evidence in the README.
- [ ] Git tag `lab-05`.

---

## Reflection — explain it at the whiteboard

1. Write `buf[i]` as pointer arithmetic. Why is `sizeof(buf)` not `sizeof(ptr)`?
2. Why is `index = y * 8 + x / 8`, not `x * 32 + y`? What breaks if you swap them?
3. Why `7 - (x % 8)` and not `x % 8`? Draw the byte `0x80` as eight pixels.
4. Why must `OUTS` have a cap as well as `'\0'`?
5. Bubble vs insertion: which swaps more on an already-sorted array? Why does that matter on 8 bytes vs 8 million?
6. How many bytes is a 64×32 1-bit display? 8-bit gray? Why did Lab 2 belong in this lab?
7. A guest program can `STORE` into VRAM. It can also `STORE` into its own code. What stops it? What stops a real program on your laptop?

---

## Stretch

`sort <lo> <hi>`, bubble or insertion, in place on guest memory: put 8 bytes at `0x800`, dump, sort, dump again, paste both. Then draw `mem[lo+i]` as a bar and `show` after each pass — a sort you can watch.

Animate a bouncing pixel (`run` in a host loop that `show`s every N steps — a poor man's game loop). Visualize sort as bars. Optional: `rowmin <y>` prints the leftmost lit pixel in that row.

---

## Resources

**Watch**

- Ben Eater — [A simple video card](https://www.youtube.com/watch?v=l7rce6IQDWs) — a *real* framebuffer, read out of RAM by a clock, one pixel at a time. Watch the first fifteen minutes: it is your `show()` in hardware.

**Read**

- learncpp.com — [Arrays](https://www.learncpp.com/cpp-tutorial/introduction-to-arrays/), [C-style strings](https://www.learncpp.com/cpp-tutorial/c-style-strings/).
- Wikipedia — [Row- and column-major](https://en.wikipedia.org/wiki/Row-_and_column-major_order), [Bubble sort](https://en.wikipedia.org/wiki/Bubble_sort) (the GIF).
- [CHIP-8 technical reference](http://devernay.free.fr/hacks/chip8/C8TECH10.HTM) — §2.4 *Display*. A real 1970s virtual machine with a 64×32 monochrome screen, described in one page. Ours is deliberately in that family.
