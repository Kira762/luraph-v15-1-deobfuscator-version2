"""Conservative simplification of expressions with only literal operands.

No local/global reads or calls are removed. Luau numeric arithmetic is IEEE-754;
we evaluate through Python floats and decline folds outside finite, representable
ranges or when the result cannot be represented faithfully.
"""
import math


def _number(node):
    while node and node.get("type") == "AstExprGroup":
        node = node.get("expr")
    if node and node.get("type") == "AstExprConstantNumber":
        try:
            return float(node["value"])
        except (TypeError, ValueError, OverflowError):
            return None
    return None


def _constant_number(value):
    if not math.isfinite(value):
        return None
    if value.is_integer() and abs(value) < 2 ** 53:
        out = int(value)
    else:
        out = value
    return {"type": "AstExprConstantNumber", "value": out}


def _fold(node):
    t = node.get("type")
    if t == "AstExprUnary":
        child = node.get("expr", {})
        if node.get("op") == "Minus" and child.get("type") == "AstExprConstantNumber":
            n = _number(child)
            folded = _constant_number(-n) if n is not None else None
            return folded
        if node.get("op") == "Not" and child.get("type") == "AstExprConstantBool":
            return {"type": "AstExprConstantBool", "value": not child["value"]}
        return None

    if t == "AstExprBinary":
        op = node.get("op")
        left, right = node.get("left", {}), node.get("right", {})
        left_value, right_value = left, right
        while left_value.get("type") == "AstExprGroup":
            left_value = left_value.get("expr", {})
        while right_value.get("type") == "AstExprGroup":
            right_value = right_value.get("expr", {})
        a, b = _number(left_value), _number(right_value)
        if a is not None and b is not None:
            try:
                operations = {
                    "Add": lambda: a + b,
                    "Sub": lambda: a - b,
                    "Mul": lambda: a * b,
                    "Div": lambda: a / b,
                    "FloorDiv": lambda: math.floor(a / b),
                    "Mod": lambda: a % b,
                    "Pow": lambda: a ** b,
                }
                if op in operations:
                    folded = _constant_number(float(operations[op]()))
                    if folded is not None:
                        return folded
            except (ArithmeticError, OverflowError, ValueError):
                pass
            comparisons = {
                "CompareEq": lambda: a == b,
                "CompareNe": lambda: a != b,
                "CompareLt": lambda: a < b,
                "CompareLe": lambda: a <= b,
                "CompareGt": lambda: a > b,
                "CompareGe": lambda: a >= b,
            }
            if op in comparisons:
                return {"type": "AstExprConstantBool", "value": comparisons[op]()}

        if op in ("CompareEq", "CompareNe"):
            lt, rt = left.get("type"), right.get("type")
            if lt == rt == "AstExprConstantString":
                equal = left.get("value") == right.get("value")
                return {"type": "AstExprConstantBool", "value": equal if op == "CompareEq" else not equal}
            if lt == rt == "AstExprConstantBool":
                equal = left.get("value") == right.get("value")
                return {"type": "AstExprConstantBool", "value": equal if op == "CompareEq" else not equal}

        if op in ("And", "Or") and left.get("type") == right.get("type") == "AstExprConstantBool":
            a_bool, b_bool = left["value"], right["value"]
            value = (a_bool and b_bool) if op == "And" else (a_bool or b_bool)
            return {"type": "AstExprConstantBool", "value": value}
    return None


def simplify(root):
    """Simplify literal-only expression subtrees in place; return fold count."""
    count = 0

    def visit(value):
        nonlocal count
        if isinstance(value, list):
            for i, item in enumerate(value):
                value[i] = visit(item)
            return value
        if not isinstance(value, dict):
            return value
        for key, item in list(value.items()):
            if isinstance(item, (dict, list)):
                value[key] = visit(item)
        folded = _fold(value)
        if folded is not None:
            count += 1
            return folded
        return value

    return visit(root), count
