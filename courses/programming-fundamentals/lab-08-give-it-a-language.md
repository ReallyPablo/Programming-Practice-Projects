# Lab 08 — Give It a Language: Lexer, Lists, and Programs You Can Read

> "A scanner is a program that looks at a string and says what it is — or that it isn't anything."

**Weeks:** 15–16 · **Language focus:** tokens, scanning, linked lists, ADTs, syntax errors, the path from text to bytes · **Project step:** a lexer + assembler; `hello`, `search`, `fib` as `.asm` · **Course:** [EN](README.md) · [UK](README.uk.md) · **Previous:** [Lab 07](lab-07-call-and-return.md) · **Notes:** [theory + experiments](lab-08-give-it-a-language.notes.md)

This lab's skill: recognize strings of a language, or report an error — with a line number. The language is the assembler you write for `ember`.

---

## This lab's feature

Poking `set 0 0x10` was honest. It does not scale. Humans write **text**:

```txt
; hello.asm
LOADI A, 65
OUT
HALT
```

A **lexer** (scanner) walks characters and emits **tokens**: `Ident(LOADI)`, `Ident(A)`, `Comma`, `Number(65)`, `Newline`, `Ident(OUT)`, … Illegal characters, a number like `0xGG`, a string that never ends — **errors**, with a line number. That is L(V) in the only sense that matters: a grammar you can point at, and a program that accepts or rejects.

An **assembler** turns tokens into the bytes `step` already understands, resolving labels (`loop:` → address). A **linked list** of tokens (or of labels) is the data structure: you do not know the length up front; you grow node by node. The list is an ADT (`push_back`, `walk`, `destroy`). Trees are the Stretch (an expression AST); you do not need a full compiler.

And then you cash it in. [Lab 7](lab-07-call-and-return.md) gave you `CALL`, `RET` and a stack. Recursive Fibonacci on this machine is 22 lines of source and 35 bytes — but it contains five addresses (`fib` three times, `ret_a` twice), and **inserting a single instruction moves every address below it**. By hand that is bookkeeping; with an assembler the labels resolve themselves and you think about the algorithm instead. **That is the argument for this whole lab**, and you should be able to make it at the defense: a language is not decoration, it is what makes the next program affordable.

By the showcase, `ember programs/fib.asm` loads, assembles, runs, and prints `8`. A stranger can read the `.asm`. That is a computer with a language.

---

## Theory

### 1. Characters are not tokens

The lexer has a cursor (`i` into a `char[]` or `std::string_view` of the file). It skips spaces and comments (`;` to end of line). Then it **classifies the next lexeme**:

| Kind | Shape (informal) | Example |
|---|---|---|
| Ident | letter, then letter/digit/`_` | `LOADI`, `loop`, `A` |
| Number | `0x` hex, `0b` bin, or decimal | `65`, `0x41`, `0b01000001` |
| Punct | `: ,` | label colon, comma |
| Newline | `\n` | line is a statement |
| Eof | end of file | |

Pseudocode of the loop you will write:

```txt
while not eof:
    skip spaces and comments
    if eof: emit Eof; break
    c = peek()
    if c is letter: ident()
    else if c is digit or c == '0' && peek(1) in 'xb': number()
    else if c in ':,': punct()
    else if c == '\n': newline()
    else error("unexpected char", c, line)
```

`ident()` **consumes** while the char is in the ident class, then emits. A bad chain (`0xGG`, `@foo` if `@` is illegal) is the other half: **report the error**.

Draw a tiny state machine for `0x` hex if you like; do not deliver a flowchart instead of a lexer.

### 2. A grammar small enough to finish

```txt
program      := { line }
line         := [ ident ':' ] [ instruction ] [ comment ] newline
instruction  := mnemonic { operand }
operand      := register | number | ident | '[' (number | 'H') ']'
register     := 'A' | 'B' | 'H'
mnemonic     := any mnemonic in ISA.md
```

The mnemonics and their operand shapes are not yours to invent: they are the
table in [ISA.md §5](ISA.md#5-the-instruction-set). Read the instruction sizes
from the same table your `step()` reads them from — a literal shared constant if
you can manage it, because the day they drift apart is the day your assembler
emits a program that runs and quietly does something else.

Assembler pass 1: lex, then walk tokens, record labels → addresses, adding each
instruction's size as you go. Pass 2: emit bytes, filling in label operands.
Unknown mnemonic, missing comma, `JMP` without a target — errors. Do not recover
brilliantly; **fail clearly**.

### 3. Linked lists: when length is discovered, not declared

A **working** `Token` node with `append`, walk and `destroy` is written out in full in [Notes 08 §3](lab-08-give-it-a-language.notes.md#3-список-бо-довжина-невідома). Treat it as given: copy it, compile it, understand it. Your work is the scanner that produces the tokens and the two passes that consume them — not re-deriving a linked list from scratch under deadline.

```cpp
struct Token {
    enum class Kind { Ident, Number, Comma, Colon, Newline, Eof, /* ... */ };
    Kind kind;
    std::string text;      // or a slice (ptr+len) into the source
    int line;
    Token* next;           // nullptr at the end
};
```

`Token* head = nullptr; Token* tail = nullptr;`  
`append`: `new Token{...}`; if empty, `head = tail = t`; else `tail->next = t; tail = t`.  
Walk: `for (Token* t = head; t; t = t->next)`.  
Destroy: walk and `delete` (Lab 6). ASan will catch the leak if you forget.

A linked list exists because **the file can be any length.** An array of 1024 tokens is allowed if you cap and document; the *list* is the intended ADT. A **binary tree** (Stretch) appears if you parse `2 + 3 * 4`; not required for a one-mnemonic-per-line assembler.

### 4. From source to `run`

```txt
.asm file → lexer → Token list → assembler → bytes in Memory → CPU.run
```

CLI: `./ember programs/hello.asm` (assemble + run) and `./ember` still drops into the poke REPL for debugging. Keep both.

### Prove it to yourself (notes §§1–3)

1. Hand-lex `ADD A, B\n` into a token table (kind, text).
2. Hand-lex `LOADI A, 0xGG` and mark the error.
3. On paper, append three nodes to an empty list; then walk.
4. `new Token` in a loop of 3 without `delete` — LSan; then free the list.
5. Two-pass: `JMP done` / `NOP` / `done: HALT` — what address is `done`?

---

## Project step: a language, four programs, a showcase

### Layout

```txt
src/asm/
  token.hpp      # Kind, Token node
  lexer.hpp/cpp  # lex(source) -> Token* head or error
  assembler.hpp/cpp
programs/
  hello.asm      # OUT a character or OUTS a string
  search.asm     # linear search (Lab 4) as readable source
  fib.asm        # recursive fib -- the payoff for Lab 7's CALL/RET
  bounce.asm     # PLOT a moving pixel (Advanced)
```

### Milestones

**M1 — Lexer.**
Feed a string, get a list of tokens. Reject illegal characters and bad numbers with `line`. Command `lex programs/hello.asm` prints tokens one per line. Paste that output.

**M2 — Assembler.**
Labels, the mnemonics from [ISA.md](ISA.md), numbers in dec/hex/bin. `asm programs/hello.asm` dumps the bytes, or loads them at `0x000`. Round-trip check: assembled `HALT` is the byte `0x00`, and `JMP 0x0123` is `30 23 01` — opcode, then the address little-endian.

**M3 — Three programs, then a fourth if you have time.**

- `hello.asm` — `OUTS` a string you assembled into the data region.
- `search.asm` — Lab 4's linear search, but now *readable*: `loop:`, `found:`, real names. Put it next to the hand-poked hex from Lab 4 in the README. That diff is the lab's whole argument.
- `fib.asm` — **recursive** Fibonacci, using the `CALL`/`RET` and the calling convention from [Lab 7](lab-07-call-and-return.md) and [ISA.md §6](ISA.md#calling-convention). `fib(6)` prints `8`; check a couple more against a calculator (`fib(10)` is `55`).
- `bounce.asm` — a pixel that moves across the display over several frames. This one is **Advanced**, not required: take it if `fib` came out clean and you have a week left.

If `fib` misbehaves, it is almost always the convention: something clobbered `B` or `H` across a `CALL`. Add a `stack` command to the REPL and step it.

**M4 — README as the product.**
This is the file a stranger opens. It should stand alone:

- An architecture diagram: source → tokens → bytes → CPU → screen.
- The [memory map](ISA.md#2-memory-map) and the instructions you implemented, including your own extensions in the same format.
- The calling convention.
- Build and run in three commands.
- Pasted output: `./build/ember programs/fib.asm`, a `dump`, and a frame of `show`. (A GIF of the terminal is nice, not required.)
- Known limits, stated plainly: no macros, no expressions in operands, one instruction per line.
- One honest paragraph: what surprised you across the eight labs.

Tag `v1.0.0` as well as `lab-08`.

### Definition of done

- Lexer emits tokens or a line-numbered error; linked list freed.
- Assembler supports labels, and every mnemonic the programs use, with sizes from [ISA.md](ISA.md).
- `hello.asm`, `search.asm`, `fib.asm` in `programs/`; `fib(6)` prints `8`.
- `./ember path.asm` assemble-and-run; the Lab 1 REPL still there for debugging bytes.
- README a stranger can follow; tags `lab-08` and `v1.0.0`.

---

## Levels

**Pick a landing spot before you start.** Basic is a real, passing lab — not a
failure. Standard is the target. Advanced exists so that the people who arrive
already knowing how to program have somewhere to go, and it is not extra credit
for finishing early: it is a harder version of the same machine. Hours are for
someone doing this subject for the first time.

### Basic — "it reads text" (~9–11 hours)
- A lexer: characters in, tokens out, comments and whitespace skipped. The token node and list from [Notes 08 §3](lab-08-give-it-a-language.notes.md) are given — use them.
- Illegal characters and malformed numbers are rejected **with a line number**, not silently taken as 0.
- `lex programs/hello.asm` prints one token per line; that output is pasted in the README.
- `hello.asm` assembles and runs: `./ember programs/hello.asm` prints something you can read.
- Repo tagged `lab-08`.

### Standard — target (~15–17 hours)
- Everything in **Definition of done** above.
- Two-pass assembler with labels; every mnemonic your programs use, with sizes from [ISA.md](ISA.md).
- `search.asm` runs, and sits in the README next to the hex you poked in Lab 4.
- `fib.asm` runs: recursive Fibonacci, `fib(6)` prints `8`, `fib(10)` prints `55`.
- Token list nodes freed; the happy path sanitizer-clean.
- README a stranger can follow: diagram, memory map, instruction table, build in three commands, pasted output.
- Tags `lab-08` and `v1.0.0`.

### Advanced — distinction (~21–23 hours)
- Everything above, plus `bounce.asm`: a pixel that moves across the display over several frames.
- A disassembler: bytes back to a listing, diffed against the source you assembled.
- An expression parser with a binary-tree AST, or `.define` macros.

---

## Deliverable checklist

- [ ] `lexer` + token list ADT; errors have line numbers.
- [ ] Two-pass assembler; labels work; sizes come from [ISA.md](ISA.md).
- [ ] `hello`, `search`, `fib` as `.asm`; `ember file.asm` runs; `fib(6)` is `8`.
- [ ] List nodes `delete`d; ASan/LSan clean on the happy path.
- [ ] README: diagram, opcodes, build, pasted terminal output.
- [ ] Git tags `lab-08` and `v1.0.0`.

---

## Reflection — explain it at the whiteboard

1. What is a token? Why not `step` on raw source characters?
2. Show the scan of `LOADI A, 0x41`. Where does the cursor sit after the number?
3. Give two strings your lexer *must* reject, and what it prints.
4. Why a linked list (or why a capped array) for tokens? What is the ADT's interface?
5. Why two passes? What breaks with one pass and a `JMP` forward?
6. Why does the CPU not read `.asm` characters directly? What does the lexer add?
7. Show `search.asm` next to the hex you poked in Lab 4. What did the assembler buy you, in one sentence?
8. What would break first if your assembler's size table and `step()`'s disagreed by one byte?

---

## Stretch

`bounce.asm`, if you left it out of M3.

A **disassembler**: bytes back to a readable listing. Run it on a program you just assembled and diff the result against the source — a round trip that finds size bugs nothing else will.

An expression parser (`ADD A, 2+3`) with a **binary tree** AST. A `queue` of pending operands. Macro `.define`. Read Crafting Interpreters, chapter *Scanning*, and list three things you skipped.

---

## Resources

**Watch**

- [Crafting Interpreters — Scanning? (talks by Nystrom, or just read)](https://craftinginterpreters.com/scanning.html) — **read this**. It is the lab.

**Read**

- Nystrom — [Scanning](https://craftinginterpreters.com/scanning.html) and [A bytecode VM](https://craftinginterpreters.com/a-virtual-machine.html) (you already have the VM; steal vocabulary).
- Wikipedia — [Lexical analysis](https://en.wikipedia.org/wiki/Lexical_analysis), [Linked list](https://en.wikipedia.org/wiki/Linked_list).
- Your own Lab 2 opcode table — the assembler's target. If the table and the lexer disagree, the table wins; fix the lexer.
