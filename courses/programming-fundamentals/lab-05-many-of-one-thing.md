# Lab 05 — Many of One Thing: Arrays, Strings, Search, and a Screen

> "An array is a lie we tell about a stretch of memory: same type, adjacent, indexable in O(1)."

**Weeks:** 9–10 · **Language focus:** 1D arrays, 2D as `y * width + x`, C-strings and `'\0'`, linear search (again, on purpose), bubble/insertion sort · **Project step:** a 64×32 display, `PLOT`, sort a region, print a string · **Course:** [Programming Fundamentals](README.md) · **Previous:** [Lab 04](lab-04-the-shape-of-control.md) · **Notes:** [theory + experiments](lab-05-many-of-one-thing.notes.md)

---

## This lab's feature

One byte is a cell. **Many bytes of the same type, packed next to each other,** are an array. The CPU already had this — `ember`'s memory *is* `Byte data[4096]`. This week you start *using* that fact as a programmer: index, nest two indices into a grid, stop at `'\0'`, swap two cells until a slice is sorted.

The reason it is exciting instead of "fill a matrix from variant 12" is the **display**. 64×32 pixels is a `bool` (or a bit — Lab 2) per cell. `pixel(x, y)` is `pixels[y * 64 + x]`. `PLOT` sets a bit. `cls` plus a loop draws a rectangle. A bouncing pixel is a nested-loop-free animation you `run`. Suddenly 2D indexing is a game, and a row of memory you sort is a bar chart if you plot `mem[i]` as a column height.

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

For the display: `index = y * WIDTH + x`. Row-major (C/C++) means **cells of a row sit together**. Nested loops: outer `y`, inner `x` walks memory sequentially — faster, and matches how you dump a framebuffer.

"Matrices" in older practicals (min of a row, swap diagonals) are this formula plus a loop. If you want that practice, implement `min_row(y)` over the display or over a region of `ember` memory. The screen is the matrix.

### 3. Strings: length by convention

A **C-string** is `char s[] = "hi";` which is `{ 'h', 'i', '\0' }`. `strlen` walks until 0. If the 0 is missing, it walks into the void (ASan). In `ember`, guest strings are the same bytes. `OUTS` must have a **cap** (`max` bytes or until `MEM_SIZE`) as well as `'\0'`.

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
5. Draw a 4×2 "display" in a `char pixels[8]` and write `plot(x,y)` as one line.

---

## Project step: pixels, text, and a sorted row

### Display contract

- **64×32** pixels (change if you must, document).
- Storage: `Byte pixels[WIDTH * HEIGHT / 8]` **bit-packed** (Lab 2 masks) *or* `Byte pixels[WIDTH * HEIGHT]` with 0/1 — bit-packed is the flex; 0/1 is acceptable if you explain the memory cost in the README.
- `show` — print the screen in the terminal (`#`/`█` vs space).
- Opcodes: `CLS` (clear), `PLOT` (set pixel from `A`=`x`, `B`=`y`, or from immediates — document).

### Milestones

**M1 — The framebuffer.**
`plot(x,y)`, `clear()`, `show()`. Out-of-range coordinates rejected. Draw a border (four loops or one clever loop) from C++ so `show` has something to photograph.

**M2 — `PLOT` / `CLS` as instructions.**
A poked program that plots three pixels and `HALT`s. `run` then `show`.

**M3 — Strings.**
`OUTS <addr>` (command and/or opcode) prints a guest C-string with a cap. Poke `HELLO\0` at `0x0200` and print it. Do **not** use `std::string` for the guest; you may use it for the host CLI.

**M4 — Search and sort on a region.**
- `find` already exists; point it at a data region and at "first non-zero pixel" if you expose the buffer.
- `sort <lo> <hi>` bubble or insertion, in-place on guest memory.
- Put 8 bytes, dump, sort, dump again, screenshot both. Optional: after each pass, plot `mem[lo+i]` as a bar and `show` — a visible sort.

### Definition of done

- 64×32 display, `show`, `PLOT`/`CLS`.
- Guest C-string print with a cap; a `HELLO` demo.
- In-place sort of a memory region, before/after dumps.
- 2D index formula in the README in one line.
- Repo tagged `lab-05`.

---

## Deliverable checklist

- [ ] Framebuffer + `show`; bounds-checked `plot`.
- [ ] `PLOT`/`CLS` opcodes; three-pixel program.
- [ ] `OUTS` with `'\0'` and a cap.
- [ ] `sort` on guest memory; evidence in the README.
- [ ] Git tag `lab-05`.

---

## Reflection — explain it at the whiteboard

1. Write `buf[i]` as pointer arithmetic. Why is `sizeof(buf)` not `sizeof(ptr)`?
2. Why is `index = y * WIDTH + x`, not `x * HEIGHT + y`? What breaks if you swap them?
3. Why must `OUTS` have a cap as well as `'\0'`?
4. Bubble vs insertion: which swaps more on an already-sorted array? Why does that matter on 8 bytes vs 8 million?
5. How many bytes is a 64×32 1-bit display? 8-bit gray? Why did Lab 2 belong in this lab?

---

## Stretch

Bit-pack the framebuffer if you didn't. Animate a bouncing pixel (`run` in a host loop that `show`s every N steps — a poor man's game loop). Visualize sort as bars. Optional: treat the display as the "matrix practical" — command `rowmin <y>` prints the leftmost lit pixel in that row.

---

## Resources

**Watch**

- [Inversion of a sprite (bitwise), any CHIP-8 intro](https://www.youtube.com/watch?v=I5e_cUoCYzo) — pixels as bits; 10 minutes of "why masks."
- Ben Eater — [VGA](https://www.youtube.com/watch?v=l7rce6IQDWs) if you want to see a *real* framebuffer timed by a clock.

**Read**

- learncpp.com — [Arrays](https://www.learncpp.com/cpp-tutorial/introduction-to-arrays/), [C-style strings](https://www.learncpp.com/cpp-tutorial/c-style-strings/).
- Wikipedia — [Row- and column-major](https://en.wikipedia.org/wiki/Row-_and_column-major_order), [Bubble sort](https://en.wikipedia.org/wiki/Bubble_sort) (the GIF).
- CHIP-8 display is 64×32. You are in good company.
