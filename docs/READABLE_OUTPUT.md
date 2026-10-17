# Readable output: local naming and formatting

Version2 has two distinct naming stages. They improve readability while preserving the reconstructed program’s bindings; neither can recover an author’s original identifiers after an obfuscator has removed them.

## How local names are produced

1. **Rebuild local lifetimes from VM registers.** `core/variables.py` computes reaching definitions and groups register definitions and uses into local “webs.” Values captured by reference stay unified while the closure is open. This stage is about scope and binding correctness, not English naming; its fallback names are deterministic register-based names.
2. **Collect semantic evidence from the rendered Luau.** `core/names.py` parses the source and records local declaration identity, references, scope, initializers, assignments, callback roles, property names, and labels. The inference rules look for reliable cues such as `Instance.new("Frame")`, `GetService("Players")`, `WaitForChild("Name")`, Roblox signal callback parameters, known methods, and explicit string labels.
3. **Rename conservatively.** Existing multi-character names are preserved unless they match the established generated-name pattern. One-character names are now considered only when the inference produces a distinct, non-generic semantic name. Generic guesses such as `n`, `str`, `tbl`, `value`, or `arg` are not sufficient to overwrite a short name. This avoids turning uncertain guesses into misleading identifiers.
4. **Avoid collisions and inconsistent references.** Candidate names are checked against globals, keywords, and overlapping local scopes. Collisions receive stable numeric suffixes (`frame`, `frame2`, ...). Before editing, every declaration/reference span for a local is validated; the rename is applied to all of them or not applied at all.
5. **Use the same naming pass on captured payloads.** Decrypted `loadstring` chunks go through the same AST-based renamer as lifted source, so they no longer bypass the local-name heuristics.

## Beautification

Captured chunks are parsed and reprinted from the Luau AST, which restores nested block structure and consistent indentation instead of trying to format minified text with regular expressions. Large or multi-line tables are expanded into indented entries; the printer emits explicit statement separators where needed. A literal-only simplifier folds arithmetic, comparisons, and boolean expressions only when all operands are constants; it never removes a call or a variable read. The spacing pass adds restrained separation around multi-line structures, removes trailing whitespace, and caps blank-line runs at one. The formatter discards source comments because the AST does not retain them; it does not attempt to invent comments.

## Limits and correctness

Output review of the five `terrorlua/obfuscator-samples` examples found two different cases. Small checks such as `390ea6acb88b8f9f` reduce to a plain `print("blah blah")`, while the captured payload of `2153b779fa7a87f2` is still a VM-style handler table: it has hundreds of numeric threshold branches, functions with short positional parameters, and tuple returns that carry VM state. Formatting and literal folding can make that dispatcher cleaner, but recovering its original source requires decoding and lifting its virtual instruction stream, not merely renaming locals. The larger `99ba879f8b2ec51c` has readable configuration and feature names in its lifted body, but its captured chunk still carries VM-level code and the runtime trace reports an error.

Names such as `a`, `Z`, or `x` may be deliberate, or they may be minifier output. If the code provides no strong clue, Version2 keeps the identifier rather than guessing. More generally, local names, comments, and some high-level intent are information lost by obfuscation; no deterministic renamer can reconstruct them perfectly from syntax alone. **A 100%-readable output guarantee is therefore not technically supportable for these samples.** The practical ceiling requires further VM-specific bytecode decoding/IR lifting and correction of the tracing failure, with regression tests against samples where a source-level oracle is available.

The regression test exercises a strong constructor-based inference, preserves an ambiguous loop-style short name, checks statement boundaries after callback/table expressions, verifies normalized blank spacing, and parses the combined output with the bundled Luau AST tool.
