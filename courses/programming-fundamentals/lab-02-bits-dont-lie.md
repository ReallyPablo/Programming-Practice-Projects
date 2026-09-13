# Lab 02 — Bits Don't Lie: Number Systems, Flags, and the ALU

> "There are 10 kinds of people in the world: those who understand binary, and those who don't."

**Weeks:** 3–4 · **Language focus:** binary and hex, two's complement, bitwise operators, masks, shifts, flags · **Project step:** an ALU, a flags register, opcode decode, a CPU that can `step` · **Course:** [Programming Fundamentals](README.md) · **Previous:** [Lab 01](lab-01-a-box-of-bytes.md) · **Notes:** [theory + experiments](lab-02-bits-dont-lie.notes.md)

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

Pick a tiny encoding and write it in the README. One workable scheme (you may change it if you document it):

```txt
0x00 HALT
0x01 NOP
0x10 ADD   A, B     ; A = A + B, set Z/N/C
0x11 SUB   A, B
0x12 AND   A, B
0x13 OR    A, B
0x14 XOR   A, B
0x15 NOT   A
0x16 SHL   A
0x17 SHR   A
0x20 LOADI A, imm   ; next byte is the immediate (Lab 3 walks PC)
```

This week `LOADI` can wait until Lab 3 if you like; `ADD`/`AND`/`HALT`/`NOP` are enough to `step`. The point is: **`step()` reads `mem[pc]`, switches on the opcode, does the bits, advances `pc`.**

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
Even if your opcodes are whole bytes this week, write `decode(Byte)` that uses `>>` and `&` to split a packed format **or** document why yours are one-byte opcodes and still extract *something* with a mask (e.g. "high nibble is the group: 0x1x is ALU"). The notes experiment §3 must appear in `cpu.cpp`, not only in a scratch file.

### Definition of done

- ALU operations exist as functions that set Z/N/C; wrap is `uint8_t`.
- `step` implements at least `NOP`, `HALT`, `ADD`, `AND`, `OR`, `XOR`, `NOT`, `SHL`, `SHR` (SUB welcome).
- `regs` and a multi-step trace in the README.
- Decode uses bitwise ops. Precedence bug from §3 was encountered or shown.
- Repo tagged `lab-02`.

---

## Deliverable checklist

- [ ] `alu` functions + flags; two worked wrap/carry examples in the README.
- [ ] `CPU` with `A`, `B`, `PC`, flags; `step` and `regs`.
- [ ] Opcode table in the README (the contract for later labs).
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

---

## Stretch

Implement **ADD as bits only** (the notes §5 loop) and use it as the real ALU; keep `uint8_t(a+b)` as an assert in Debug. Then add a **status byte** in memory at a fixed address (e.g. `0x0FF`) that mirrors flags as bits, so a program you write later can `LOAD` its own flags. Optional: [Ben Eater's ALU](https://www.youtube.com/watch?v=S-3sWq561PI) — pause and name each chip as one of your functions.

---

## Resources

**Watch**

- Ben Eater — [Arithmetic logic unit (ALU)](https://www.youtube.com/watch?v=S-3sWq561PI) (~45 min). This lab's hardware twin.
- Crash Course CS — [Representing Numbers and Letters](https://www.youtube.com/watch?v=1GSjbWt0c9M) if hex still slips.

**Read**

- learncpp.com — [Bitwise operators](https://www.learncpp.com/cpp-tutorial/bitwise-operators/) and [bit flags](https://www.learncpp.com/cpp-tutorial/bit-manipulation-with-bitwise-operators-and-bit-masks/).
- Wikipedia — [Two's complement](https://en.wikipedia.org/wiki/Two%27s_complement) (the pictures).
- [Bitwise hacks](https://graphics.stanford.edu/~seander/bithacks.html) — a buffet; steal `x & (x-1)` (clear lowest set bit) for a notes experiment if you have time.
