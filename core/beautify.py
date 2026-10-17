"""Readable Luau output pass for captured plaintext chunks."""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import backend
import luauast
import names
import spacing


def beautify_text(text):
    """Reconstruct indentation, infer names where supported, and normalize spacing."""
    rendered = backend.run_big_stack(lambda: luauast.render(luauast.parse(text)))

    if not os.environ.get("DEVIRT_NO_NAMES"):
        try:
            rendered = backend.run_big_stack(lambda: names.rename_text(rendered))
        except Exception as ex:
            print("[!] payload naming pass failed: %s" % ex, file=sys.stderr)

    try:
        rendered = backend.run_big_stack(lambda: spacing.space(rendered))
    except Exception as ex:
        print("[!] payload spacing pass failed: %s" % ex, file=sys.stderr)

    return spacing.normalize_blank_lines(rendered)


def main():
    if len(sys.argv) != 2:
        raise SystemExit("usage: beautify.py <input.lua>")
    with open(sys.argv[1], encoding="latin-1") as f:
        source = f.read()
    result = beautify_text(source)
    sys.stdout.buffer.write(result.encode("latin-1"))


if __name__ == "__main__":
    main()
