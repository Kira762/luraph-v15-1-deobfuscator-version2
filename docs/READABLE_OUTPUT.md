# Readable output: local naming and formatting

Version2 has two distinct naming stages. They improve readability while preserving the reconstructed program’s bindings; neither can recover an author’s original identifiers after an obfuscator has removed them.

## How local names are produced

1. **Rebuild local lifetimes from VM registers.** `core/variables.py` computes reaching definitions and groups register definitions and uses into local “webs.” Values captured by reference stay unified while the closure is open. This stage is about scope and binding correctness, not English naming; its fallback names are deterministic register-based names.
2. **Collect semantic evidence from the rendered Luau.** `core/names.py` parses the source and records local declaration identity, references, scope, initializers, assignments, callback roles, property names, and labels. The inference rules look for reliable cues such as `Instance.new("Frame")`, `GetService("Players")`, `WaitForChild("Name")`, Roblox signal callback parameters, known methods, and explicit string labels.
3. **Rename conservatively.** Existing multi-character names are preserved unless they match the established generated-name pattern. One-character names are now considered only when the inference produces a distinct, non-generic semantic name. Generic guesses such as `n`, `str`, `tbl`, `value`, or `arg` are not sufficient to overwrite a short name. This avoids turning uncertain guesses into misleading identifiers.
4. **Avoid collisions and inconsistent references.** Candidate names are checked against globals, keywords, and overlapping local scopes. Collisions receive stable numeric suffixes (`frame`, `frame2`, ...). Before editing, every declaration/reference span for a local is validated; the rename is applied to all of them or not applied at all.
5. **Use the same naming pass on captured payloads.** Decrypted `loadstring` chunks go through the same AST-based renamer as lifted source, so they no longer bypass the local-name heuristics.

## Beautification

Captured chunks are parsed and reprinted from the Luau AST, which restores nested block structure and consistent indentation instead of trying to format minified text with regular expressions. The printer emits explicit statement separators where needed, then the spacing pass adds restrained separation around multi-line structures. Trailing whitespace is removed, and blank-line runs are capped at one. The formatter discards source comments because the AST does not retain them; it does not attempt to invent comments.

## Limits and correctness

Names such as `a`, `Z`, or `x` may be deliberate, or they may be minifier output. If the code provides no strong clue, Version2 keeps the identifier rather than guessing. More generally, local names, comments, and some high-level intent are information lost by obfuscation; no deterministic renamer can reconstruct them perfectly from syntax alone. The goal is useful, explainable names where evidence exists, and unchanged bindings everywhere else.

The regression test exercises a strong constructor-based inference, preserves an ambiguous loop-style short name, checks statement boundaries after callback/table expressions, verifies normalized blank spacing, and parses the combined output with the bundled Luau AST tool.
