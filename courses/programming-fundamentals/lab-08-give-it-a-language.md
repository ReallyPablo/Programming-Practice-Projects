# Lab 08 — Give It a Language: Lexer, Lists, and Programs You Can Read

> "A scanner is a program that looks at a string and says what it is — or that it isn't anything."

**Weeks:** 15–16 · **Language focus:** tokens, scanning, linked lists, ADTs, syntax errors, the path from text to bytes · **Project step:** a lexer + assembler; `hello`, `search`, `fib`, `bounce` as `.asm` · **Course:** [Programming Fundamentals](README.md) · **Previous:** [Lab 07](lab-07-call-and-return.md) · **Notes:** [theory + experiments](lab-08-give-it-a-language.notes.md)

This lab **is** the old "RGR." The skill was always: recognize strings of a language, or report an error. The language is no longer `$` + hex + `:`. It is **yours**.

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

`ident()` **consumes** while the char is in the ident class, then emits. That consumption is the "scanner that recognizes a chain." A bad chain (`0xGG`, `@foo` if `@` is illegal) is the other half of the RGR: **report error**.

Draw a tiny state machine for `0x` hex if you like; do not deliver a flowchart instead of a lexer.

### 2. A grammar small enough to finish

```txt
program      := { line }
line         := [ ident ':' ] [ instruction ] [ comment ] newline
instruction  := mnemonic { operand }
operand      := register | number | ident
register     := 'A' | 'B'  (and SP/PC if you have them)
mnemonic     := LOADI | LOAD | STORE | ADD | ... | CALL | RET | HALT | ...
```

Assembler pass 1: lex, then walk tokens, record labels → addresses (instruction sizes you already know from `step`). Pass 2: emit bytes, filling in label operands. Unknown mnemonic, missing comma, `JMP` without a target — errors. Do not recover brilliantly; **fail clearly**.

### 3. Linked lists: when length is discovered, not declared

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

This is the linear linked structure from the old Lab 2.3 / 2.5, with a reason to exist: **the file can be any length.** An array of 1024 tokens is allowed if you cap and document; the *list* is the intended ADT. A **binary tree** (Stretch) appears if you parse `2 + 3 * 4`; not required for a one-mnemonic-per-line assembler.

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
  fib.asm        # recursive fib (Lab 7)
  bounce.asm     # PLOT a moving pixel (Lab 5–6)
```

### Milestones

**M1 — Lexer.**
Feed a string, get a list of tokens. Reject illegal characters and bad numbers with `line`. Command `lex programs/hello.asm` prints tokens one per line. Screenshot.

**M2 — Assembler.**
Labels, mnemonics from your opcode table, numbers in dec/hex/bin. `asm programs/hello.asm` dumps the bytes (or loads them at `0x0000`). Round-trip: assembled `HALT` is `0x00` (or whatever you chose).

**M3 — Four programs.**
All four `.asm` files run. `fib` prints the right number. `bounce` shows at least a few frames (`show` in a host loop, or `PLOT` then `show` once — document). `search` finds a poked/included byte.

**M4 — README as the product.**
Architecture diagram (source → tokens → bytes → CPU). Opcode table. Calling convention. How to build and run in three commands. A GIF or screenshot of `bounce` or the dump+output of `fib`. Known limits (no macros, no expressions, one instruction per line). Tag `v1.0.0` as well as `lab-08`.

### Definition of done

- Lexer emits tokens or a line-numbered error; linked list freed.
- Assembler supports labels and your full opcode set used by the four programs.
- `hello`, `search`, `fib`, `bounce` in `programs/`.
- `./ember path.asm` assemble-and-run.
- README a stranger can follow; tags `lab-08` and `v1.0.0`.

---

## Deliverable checklist

- [ ] `lexer` + token list ADT; errors have line numbers.
- [ ] Two-pass assembler; labels work.
- [ ] Four `.asm` demos; `ember file.asm` runs.
- [ ] List nodes `delete`d; ASan/LSan clean on the happy path.
- [ ] README: diagram, opcodes, build, screenshots.
- [ ] Git tags `lab-08` and `v1.0.0`.

---

## Reflection — explain it at the whiteboard

1. What is a token? Why not `step` on raw source characters?
2. Show the scan of `LOADI A, 0x41`. Where does the cursor sit after the number?
3. Give two strings your lexer *must* reject, and what it prints.
4. Why a linked list (or why a capped array) for tokens? What is the ADT's interface?
5. Why two passes? What breaks with one pass and a `JMP` forward?
6. How is this the same problem as "recognize `$` + hex + `:`"? How is it not?

---

## Stretch

Expression parser (`ADD A, 2+3`) with a **binary tree** AST — the old "nonlinear structure" lab, finally with a job. A `queue` of pending operands. Macro `.define`. A disassembler (`bytes → guess at asm`) for the dump. Read Crafting Interpreters, chapter *Scanning*, and list three things you skipped.

---

## Resources

**Watch**

- [Crafting Interpreters — Scanning? (talks by Nystrom, or just read)](https://craftinginterpreters.com/scanning.html) — **read this**. It is the lab.

**Read**

- Nystrom — [Scanning](https://craftinginterpreters.com/scanning.html) and [A bytecode VM](https://craftinginterpreters.com/a-virtual-machine.html) (you already have the VM; steal vocabulary).
- Wikipedia — [Lexical analysis](https://en.wikipedia.org/wiki/Lexical_analysis), [Linked list](https://en.wikipedia.org/wiki/Linked_list).
- Your own Lab 2 opcode table — the assembler's target. If the table and the lexer disagree, the table wins; fix the lexer.
