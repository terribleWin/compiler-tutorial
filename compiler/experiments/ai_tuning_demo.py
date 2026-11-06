"""Chapter 25: correctness-gated tuning with disjoint workload shapes.

Python 3.8+, standard library only. No model/API/GPU dependencies.
This measures Python loops, including output allocation, not native kernels.
Usage: python experiments/ai_tuning_demo.py [--output tuning-result.json]
"""
import argparse
import json
import platform
import random
import statistics
import sys
import time
from pathlib import Path

SEED = 20261106
TRAIN = (12, 16, 20)
VALIDATION = 24
TEST = 28
SCHEDULES = ("ijk", "ikj", "k4", "k8")
ROUNDS = 7
BATCH = 3


def matrices(n):
    rng = random.Random(SEED + n)
    return ([[rng.randint(-3, 3) for _ in range(n)] for _ in range(n)],
            [[rng.randint(-3, 3) for _ in range(n)] for _ in range(n)])


def kernel(a, b, schedule):
    n = len(a)
    c = [[0] * n for _ in range(n)]
    if schedule == "ijk":
        for i in range(n):
            for j in range(n):
                total = 0
                for k in range(n):
                    total += a[i][k] * b[k][j]
                c[i][j] = total
    elif schedule == "ikj":
        for i in range(n):
            row = c[i]
            for k in range(n):
                x, brow = a[i][k], b[k]
                for j in range(n):
                    row[j] += x * brow[j]
    else:
        block = int(schedule[1:])
        for kk in range(0, n, block):
            for i in range(n):
                row = c[i]
                for k in range(kk, min(kk + block, n)):
                    x, brow = a[i][k], b[k]
                    for j in range(n):
                        row[j] += x * brow[j]
    return c


def reference(a, b):
    n = len(a)
    return [[sum(x * y for x, y in zip(a[i], column))
             for column in zip(*b)] for i in range(n)]


def measure(n, schedules):
    schedules = tuple(dict.fromkeys(schedules))
    a, b = matrices(n)
    expected = reference(a, b)
    samples = {s: [] for s in schedules}
    for schedule in schedules:
        actual = kernel(a, b, schedule)
        if actual != expected:
            raise RuntimeError("incorrect schedule: " + schedule)
        kernel(a, b, schedule)  # Untimed warm-up.
    rng = random.Random(SEED + 1000 + n)
    for _ in range(ROUNDS):
        order = list(schedules)
        rng.shuffle(order)
        for schedule in order:
            begin = time.perf_counter_ns()
            for _ in range(BATCH):
                kernel(a, b, schedule)
            samples[schedule].append((time.perf_counter_ns() - begin) / BATCH)
    result = {}
    for schedule, values in samples.items():
        median = statistics.median(values)
        result[schedule] = {
            "median_ns": median,
            "mad_ns": statistics.median(abs(v - median) for v in values),
            "samples_ns": values,
        }
    return result


def run():
    # Split workload families/shapes before collecting any timing labels.
    if set(TRAIN) & {VALIDATION, TEST} or VALIDATION == TEST:
        raise RuntimeError("workload split overlaps")
    training = {n: measure(n, SCHEDULES) for n in TRAIN}
    # Through-origin least squares: time(schedule,n) = alpha[schedule] * n**3.
    denominator = sum(n ** 6 for n in TRAIN)
    alpha = {s: sum((n ** 3) * training[n][s]["median_ns"] for n in TRAIN)
             / denominator for s in SCHEDULES}
    predicted = min(SCHEDULES, key=lambda s: alpha[s] * VALIDATION ** 3)
    validation = measure(VALIDATION, ("ijk", predicted))
    # Gate chosen in advance: require >3% validation improvement; else baseline.
    model_ok = (validation[predicted]["median_ns"]
                < 0.97 * validation["ijk"]["median_ns"])
    selected = predicted if model_ok else "ijk"
    # Freeze the policy here. Do not tune on or fit to TEST measurements.
    test = measure(TEST, ("ijk", selected))
    return {
        "seed": SEED, "python": sys.version.split()[0],
        "platform": platform.platform(), "rounds": ROUNDS, "batch": BATCH,
        "train_shapes": TRAIN, "validation_shape": VALIDATION, "test_shape": TEST,
        "training": training, "alpha_ns_per_n_cubed": alpha,
        "model_candidate": predicted, "validation": validation,
        "selected_before_test": selected, "test": test,
        "test_speedup": test["ijk"]["median_ns"] / test[selected]["median_ns"],
        "correctness": "all measured schedules match exact integer reference",
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    report = json.dumps(run(), indent=2)
    if args.output:
        args.output.write_text(report + "\n", encoding="utf-8")
    print(report)
