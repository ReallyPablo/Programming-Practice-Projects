# Lab 02 — Bits Don't Lie: Number Systems, Flags, and the ALU

> "There are 10 kinds of people in the world: those who understand binary, and those who don't."

**Weeks:** 3–4 · **Language focus:** binary and hex, two's complement, bitwise operators, masks, shifts, flags · **Project step:** an ALU, a flags register, opcode decode, a CPU that can `step` · **Course:** [EN](README.md) · [UK](README.uk.md) · **Previous:** [Lab 01](lab-01-a-box-of-bytes.md) · **Notes:** [theory + experiments](lab-02-bits-dont-lie.notes.md)

---

## This lab's feature

Every value in `ember` is already bits. Last week you printed them. This week you **work** them.

Bitwise operations (`& | ^ ~ << >>`) look like trivia until you need to *decode an instruction*. A byte `0xA3` is not "a number you add." It is a pack of fields: maybe a 4-bit opcode, a 2-bit register, a 2-bit mode. You get the opcode with a **mask** and a **shift**. You set a flag without touching the others with `|`. You ask "is this negative?" by testing one bit. That is how real CPUs, file formats, network packets, and game input bits work — and it is how your virtual CPU will work for the rest of the semester.

Number systems are the same idea from the other side: hex is bits grouped by four, so a dump is readable; two's complement is *why* `~x + 1` is `-x` and why `0b11111111` as `int8_t` is `-1`. Once you have implemented `ADD` both as C++ `+` and as a loop over bits (Stretch, or a short version in the notes), "the ALU" stops being a box on a slide.

---

## Theory

### 1. Positional systems, and why programmers live in hex

A number is a polynomial. `0b1011` = 1·8 + 0·4 + 1·2 + 1·1 = 11. `0x2F` = 2·16 + 15 = 47. Hex is shorthand for bits: one hex digit = four bits (`F` = `1111`). A byte is two hex digits. That is why `dump` was already hex last week — you were reading bits in comfortable groups.

Convert by hand a few times, then stop: the computer will do it. You still need to *read* a dump and a mask.

### 2. Two's complement: negative numbers are just bits

For an n-bit unsigned value, the bits mean 0 … 2ⁿ−1. For **two's complement** signed, the same bits mean −2ⁿ⁻¹ … 2ⁿ⁻¹−1. The high bit is the sign: 1 means negative. Negation is **invert all bits, add one**:

```txt
  5 in 8 bits:  00000101
  ~5:           11111010
  ~5 + 1:       11111011   = -5
```

Consequence: `0xFF` as `uint8_t` is 255; as `int8_t` is −1. Same byte. The type is the story (Lab 1). Addition is the same circuit for signed and unsigned — flags (carry, overflow, zero, sign) are how you *interpret* the result. Your ALU will set those flags.

### 3. The six operators, and the two that bite

| Op | Name | Bit rule | Use in `ember` |
|---|---|---|---|
| `~` | not | flip every bit | invert a mask |
| `&` | and | 1 only if both 1 | **mask**: keep the bits you care about |
| `\|` | or | 1 if either 1 | **set** bits |
| `^` | xor | 1 if different | toggle; also "add without carry" |
| `<<` | shift left | move toward the high bit, 0 in | `x << n` is `x * 2ⁿ` (unsigned) |
| `>>` | shift right | move toward the low bit | `x >> n` is `x / 2ⁿ` (unsigned). **Signed** `>>` is implementation-defined / arithmetic — sign bit may fill. Use unsigned when you mean bits. |

The two bugs you will hit:

1. **Operator precedence.** `x & 1 == 0` is `x & (1 == 0)` because `==` binds tighter than `&`. Always parenthesize: `(x & 1) == 0`.
2. **Shifting into sign bits, shifting by ≥ width.** `1 << 31` on a 32-bit signed `int` is UB. Write `1u << 31` or use `std::uint32_t`.

### 4. Masks: how instructions become fields

To read a bit field, **shift it to bit 0, then AND with a mask of that many 1s**:

```cpp
// byte:  opcode:4 | dest:2 | src:2
std::uint8_t ins = 0b1011'10'01;
std::uint8_t opcode = (ins >> 4) & 0x0F;  // 0b1011
std::uint8_t dest   = (ins >> 2) & 0x03;  // 0b10
std::uint8_t src    =  ins       & 0x03;  // 0b01
```

To **set** bit `n`: `flags |=  (1u << n)`.  
To **clear** bit `n`: `flags &= ~(1u << n)`.  
To **test** bit `n`: `(flags & (1u << n)) != 0`.

That triple is the whole of "bit flags." Status registers in real CPUs are exactly this.

### 5. An opcode is a byte with a meaning

From this week on, `ember` has a written-down instruction set: **[ISA.md](ISA.md)**.
Open it now and keep it open. It lists, for every instruction, the opcode byte,
the **size in bytes**, which flags it touches, and what it does.

Do not invent your own numbering. That table is the contract your CPU, your
assembler (Lab 8) and your programs all depend on, and the single most expensive
bug in this course is a `step()` that advances `PC` by 2 where the table says 3 —
the machine keeps running and executes operand bytes as instructions.

This week you implement the `0x0_` group (`HALT`, `NOP`) and the whole `0x1_`
group (the ALU). Everything else can wait for its lab. Add your own instructions
later if you want — [ISA.md §8](ISA.md#8-your-extensions) reserves `0x70`–`0xFF`
for exactly that.

The shape of `step()` never changes: **read `mem[pc]`, switch on the opcode, do
the bits, advance `pc` by the size from the table.**

Notice the structure in the numbering: the **high nibble is the group**
(`0x1_` is the ALU). That is not decoration — it is a bit field, and §4 above is
how you read it: `group = (op >> 4) & 0x0F`.

### Prove it to yourself (scratch program or `ember`, ~15 minutes)

Required — notes §§1–4:

1. Print `5`, `~5`, `~5 + 1` for an `int8_t`. Then `uint8_t x = 5; std::cout << (int)(~x);` — why is that not `-6`?
2. `0b1011'0000 & 0b1111'0000`, `|`, `^` — predict, then run.
3. Extract three fields from `0b1011'10'01` with the snippet in §4.
4. `int x = 2; std::cout << (x & 1 == 0);` vs `(x & 1) == 0`. Explain.
5. Implement 8-bit `add(uint8_t a, uint8_t b, bool& carry)` with a `for` over bits (`^` for sum bit, `&` plus `<<` for carry) and check against `uint8_t(a + b)`.

---

## Project step: a CPU that can take one step

### Layout

```txt
src/
  cpu.hpp      # struct Flags { bool z, n, c; }; struct CPU { Memory* mem; uint16_t pc; uint8_t a, b; Flags f; };
  cpu.cpp      # step(), dump_regs()
  alu.hpp/cpp  # add/sub/and/or/xor/not/shl/shr on uint8_t, returning value + flags
  opcodes.hpp  # enum class Op : uint8_t { Halt = 0x00, ... }
```

Registers `A` and `B` are enough. `PC` is a `uint16_t` into the 4 KB box. Flags: **Z** (result is 0), **N** (high bit of result is 1), **C** (carry out of bit 7 on add/shift).

### Milestones

**M1 — ALU as functions, tested by hand.**
`alu.cpp` implements the ops on `uint8_t` and returns flags. A command `alu add 200 100` (or a tiny `test_alu` you run once) prints `result=44  Z=0 N=0 C=1` — 200+100 = 300 = 256+44, carry set. Do the same for `AND`, `SHL`. Put two worked examples in the README.

**M2 — Encode, load, `step`.**
`set` a few bytes of program at address 0 (e.g. `ADD`, then `HALT`). Command `regs` prints `PC A B Z N C`. Command `step` executes one instruction. `ADD` uses `A` and `B`; `HALT` sets a `halted` flag so further `step`s refuse. After `ADD`, `PC` has advanced by 1 (or by 2 once immediates exist).

**M3 — A program you can see.**
Poke `A=7`, `B=1`, bytes `[AND, HALT]`, `step` twice. Dump registers. Then a three-instruction sequence of your own (e.g. `SHL` until carry). Record the trace in the README: each line is `PC mem[PC] → new A/flags`.

**M4 — Decode with masks, not magic.**
Write a `decode(Byte)` that splits the opcode into **group** (high nibble) and
**index** (low nibble) with `>>` and `&`, and use the group to route the `switch`
— `0x0_` here, `0x1_` there. Not a magic number per instruction: a *field*. The
notes experiment §3 must appear in `cpu.cpp`, not only in a scratch file.

### Definition of done

- ALU operations exist as functions that set Z/N/C; wrap is `uint8_t`.
- `step` implements the `0x0_` and `0x1_` groups from [ISA.md](ISA.md), with the opcodes, sizes and flag effects from that table — `HALT`, `NOP`, `ADD`, `SUB`, `AND`, `OR`, `XOR`, `NOT`, `SHL`, `SHR`, `INC`, `DEC`.
- `regs` and a multi-step trace in the README.
- Decode uses bitwise ops. Precedence bug from §3 was encountered or shown.
- Repo tagged `lab-02`.

---

## Levels

**Pick a landing spot before you start.** Basic is a real, passing lab — not a
failure. Standard is the target. Advanced exists so that the people who arrive
already knowing how to program have somewhere to go, and it is not extra credit
for finishing early: it is a harder version of the same machine. Hours are for
someone doing this subject for the first time.

### Basic — "it steps" (~8–10 hours)
- ALU functions on `uint8_t` for `ADD`, `SUB`, `AND`, `OR`, `XOR`, `NOT`, `SHL`, `SHR`, `INC`, `DEC`, each returning a value and setting `Z`/`N`/`C`.
- `regs` prints `PC A B Z N C`.
- `step` runs `NOP`, `HALT` and `ADD` from bytes you poked with `set`.
- The README says which rows of [ISA.md](ISA.md) you have implemented.
- Repo tagged `lab-02`.

### Standard — target (~12–14 hours)
- Everything in **Definition of done** above.
- `decode()` extracts the group with `(op >> 4) & 0x0F` — a mask and a shift, not a magic number per instruction.
- A trace of a 3+ instruction program in the README: `PC`, opcode, resulting `A` and flags, one line per step.
- Two worked wrap/carry examples (`200 + 100`, and one of your own).

### Advanced — distinction (~17–19 hours)
- Everything above, plus `ADD` implemented **as bits** (the notes §5 loop) used as the real ALU, with `uint8_t(a+b)` kept as a Debug assert.
- A status byte in the spare region mirroring the flags, so a guest program can read its own flags.

---

## Deliverable checklist

- [ ] `alu` functions + flags; two worked wrap/carry examples in the README.
- [ ] `CPU` with `A`, `B`, `PC`, flags; `step` and `regs`.
- [ ] The README states which rows of [ISA.md](ISA.md) you have implemented, and lists any extensions of your own in the same format.
- [ ] Trace of a 3+ instruction poke-program.
- [ ] Mask/shift decode somewhere in `cpu.cpp`.
- [ ] Git tag `lab-02`.

---

## Reflection — explain it at the whiteboard

1. Convert `0xA3` to binary and to decimal, out loud, without a calculator.
2. Why is `0xFF` both 255 and −1? What did the type do?
3. Draw a byte. Show how to *set*, *clear*, and *test* bit 3.
4. Why parenthesize `x & MASK == 0`? What does it evaluate to without parens?
5. What is a carry flag for, if `uint8_t` already wraps?
6. Why do instruction sets pack fields into bytes instead of storing "ADD" as text?
7. `LOADI` does not touch the flags ([ISA.md §3](ISA.md#3-flags)). Why does that mean `LOADI A, 0` followed by `JZ` will not jump?

---

## Stretch

Implement **ADD as bits only** (the notes §5 loop) and use it as the real ALU; keep `uint8_t(a+b)` as an assert in Debug. Then add a **status byte** at a fixed address in the spare region (e.g. `0xB00` — not inside CODE, where your programs live) that mirrors `Z`/`N`/`C` as bits, so a program you write later can `LOAD` its own flags. Document it in your README as an extension, in [ISA.md](ISA.md) format. Optional: [Ben Eater's ALU](https://www.youtube.com/watch?v=S-3sWq561PI) — pause and name each chip as one of your functions.

---

## Resources

**Watch**

- Ben Eater — [Arithmetic logic unit (ALU)](https://www.youtube.com/watch?v=S-3sWq561PI) (~45 min). This lab's hardware twin.
- Crash Course CS — [Representing Numbers and Letters](https://www.youtube.com/watch?v=1GSjbWt0c9M) if hex still slips.

**Read**

- learncpp.com — [Bitwise operators](https://www.learncpp.com/cpp-tutorial/bitwise-operators/) and [bit flags](https://www.learncpp.com/cpp-tutorial/bit-manipulation-with-bitwise-operators-and-bit-masks/).
- Wikipedia — [Two's complement](https://en.wikipedia.org/wiki/Two%27s_complement) (the pictures).
- [Bitwise hacks](https://graphics.stanford.edu/~seander/bithacks.html) — a buffet; steal `x & (x-1)` (clear lowest set bit) for a notes experiment if you have time.
