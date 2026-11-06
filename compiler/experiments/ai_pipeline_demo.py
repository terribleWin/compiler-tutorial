from itertools import zip_longest
from pathlib import Path
import json
import math

X = [[1.0, -2.0, 3.0], [0.0, 2.0, -1.0]]
W = [[1.0, 2.0], [0.0, -1.0], [2.0, 1.0]]
BIAS = [0.5, -0.5]
HIGH = [
    {"op": "linear", "args": ["x", "w", "b"], "out": "h"},
    {"op": "relu", "args": ["h"], "out": "y"},
]


def matrix_shape(value):
    if not isinstance(value, list) or not value:
        raise ValueError("this lab requires a nonempty matrix")
    if not all(isinstance(row, list) for row in value):
        raise ValueError("expected a list of rows")
    width = len(value[0])
    if width == 0 or any(len(row) != width for row in value):
        raise ValueError("empty or ragged matrix")
    if any(not isinstance(v, float) or not math.isfinite(v)
           for row in value for v in row):
        raise ValueError("this lab requires finite Python floats")
    return (len(value), width)


def matmul_shape(a, b):
    if len(a) != 2 or len(b) != 2 or a[1] != b[0]:
        raise ValueError("matmul contracting dimensions differ")
    return (a[0], b[1])


def broadcast_shape(a, b):
    result = []
    for x, y in zip_longest(reversed(a), reversed(b), fillvalue=1):
        if x == 1:
            result.append(y)
        elif y == 1 or x == y:
            result.append(x)
        else:
            raise ValueError("incompatible broadcasting dimensions")
    return tuple(reversed(result))


def infer_high(graph, shapes):
    shapes = dict(shapes)
    for node in graph:
        op, args, out = node["op"], node["args"], node["out"]
        if out in shapes:
            raise ValueError("duplicate graph value")
        if op == "linear":
            product = matmul_shape(shapes[args[0]], shapes[args[1]])
            result = broadcast_shape(product, shapes[args[2]])
            if result != product:
                raise ValueError("bias must not enlarge linear output")
        elif op == "relu":
            result = shapes[args[0]]
        else:
            raise ValueError("unsupported high-level op: " + op)
        shapes[out] = result
    return shapes


def legalize(graph):
    result = []
    for node in graph:
        op, args, out = node["op"], node["args"], node["out"]
        if op == "linear":
            temp = out + ".product"
            result.append({"op": "matmul", "args": args[:2], "out": temp})
            result.append({"op": "bias_add", "args": [temp, args[2]], "out": out})
        elif op == "relu":
            result.append({"op": "max_zero", "args": args, "out": out})
        else:
            raise ValueError("no legalization rule for " + op)
    return result


def matmul(a, b):
    rows, cols = matmul_shape(matrix_shape(a), matrix_shape(b))
    return [[sum(a[i][k] * b[k][j] for k in range(len(b)))
             for j in range(cols)] for i in range(rows)]


def add_bias(a, bias):
    _, cols = matrix_shape(a)
    if len(bias) != cols:
        raise ValueError("this lab implements only a rank-1 bias")
    return [[v + bias[j] for j, v in enumerate(row)] for row in a]


def run(plan, x):
    batch, width = matrix_shape(x)
    if width != 3 or not 2 <= batch <= 8:
        raise ValueError("input contract requires x:[B,3], 2<=B<=8")
    values = {"x": x, "w": W, "b": BIAS}
    allowed = {"matmul", "bias_add", "max_zero"}
    for node in plan:
        op, args, out = node["op"], node["args"], node["out"]
        if op not in allowed:
            raise ValueError("illegal target operation: " + op)
        operands = [values[name] for name in args]
        if op == "matmul":
            value = matmul(*operands)
        elif op == "bias_add":
            value = add_bias(*operands)
        else:
            value = [[max(0.0, v) for v in row] for row in operands[0]]
        values[out] = value
    return values["y"]


def eager(x):
    shifted = add_bias(matmul(x, W), BIAS)
    return [[max(0.0, v) for v in row] for row in shifted]


def fake_quant(values, bound):
    if bound <= 0:
        raise ValueError("calibration bound must be positive")
    scale = bound / 127.0
    quantized = [max(-127, min(127, round(v / scale))) for v in values]
    restored = [q * scale for q in quantized]
    return scale, quantized, restored


def main():
    shapes = infer_high(HIGH, {"x": (2, 3), "w": (3, 2), "b": (2,)})
    plan = legalize(HIGH)
    expected = [[7.5, 6.5], [0.0, 0.0]]
    assert eager(X) == run(plan, X) == expected
    assert broadcast_shape((0, 3), (1, 3)) == (0, 3)
    print("shapes:", shapes)
    print("lowered:", [node["op"] for node in plan])
    print("output:", run(plan, X))
    changed_batch = X + [[1.0, 1.0, 1.0]]
    assert eager(changed_batch) == run(plan, changed_batch)
    print("dynamic batch:", len(run(plan, changed_batch)))
    for label, operation in [
        ("bad shape", lambda: matmul_shape((2, 4), (3, 2))),
        ("bad input", lambda: run(plan, [[1.0, 2.0]])),
    ]:
        try:
            operation()
        except ValueError as error:
            print(label + ":", error)
        else:
            raise AssertionError("invalid case unexpectedly succeeded")
    scale, q, restored = fake_quant([0.5, 1.0, 7.5], bound=1.0)
    print("bad calibration:", q, [round(v, 6) for v in restored])
    scale2, q2, restored2 = fake_quant([0.5, 1.0, 7.5], bound=8.0)
    print("wider calibration:", q2, [round(v, 6) for v in restored2])
    artifacts = Path("lab23-artifacts")
    artifacts.mkdir(exist_ok=True)
    records = {
        "01-high-graph.json": HIGH,
        "02-value-shapes.json": shapes,
        "03-lowered-plan.json": plan,
        "04-result.json": {"expected": expected, "actual": run(plan, X)},
    }
    for name, record in records.items():
        (artifacts / name).write_text(json.dumps(record, indent=2), encoding="utf-8")
    print("artifacts:", artifacts)


if __name__ == "__main__":
    main()
