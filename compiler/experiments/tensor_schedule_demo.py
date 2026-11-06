import math
import platform
import statistics
import time


def shape(matrix):
    if not matrix or not matrix[0]:
        raise ValueError("this lab requires positive dimensions")
    width = len(matrix[0])
    if any(len(row) != width for row in matrix):
        raise ValueError("ragged matrix")
    return len(matrix), width


def dimensions(a, b):
    m, k = shape(a)
    kb, n = shape(b)
    if k != kb:
        raise ValueError("inner dimensions do not match")
    return m, k, n


def matmul_ijk(a, b):
    m, k, n = dimensions(a, b)
    c = [[0 for _ in range(n)] for _ in range(m)]
    for i in range(m):
        for j in range(n):
            acc = 0
            for r in range(k):
                acc += a[i][r] * b[r][j]
            c[i][j] = acc
    return c


def matmul_ikj(a, b):
    m, k, n = dimensions(a, b)
    c = [[0 for _ in range(n)] for _ in range(m)]
    for i in range(m):
        for r in range(k):
            av = a[i][r]
            for j in range(n):
                c[i][j] += av * b[r][j]
    return c


def matmul_tiled(a, b, bm=4, bk=5, bn=3):
    if min(bm, bk, bn) <= 0:
        raise ValueError("tile sizes must be positive")
    m, k, n = dimensions(a, b)
    c = [[0 for _ in range(n)] for _ in range(m)]
    for i0 in range(0, m, bm):
        for j0 in range(0, n, bn):
            for r0 in range(0, k, bk):
                for i in range(i0, min(i0 + bm, m)):
                    for r in range(r0, min(r0 + bk, k)):
                        av = a[i][r]
                        for j in range(j0, min(j0 + bn, n)):
                            c[i][j] += av * b[r][j]
    return c


def matmul_bias_relu_fused(a, b, bias):
    m, k, n = dimensions(a, b)
    if len(bias) != n:
        raise ValueError("bias width does not match output")
    out = [[0 for _ in range(n)] for _ in range(m)]
    for i in range(m):
        for j in range(n):
            acc = 0
            for r in range(k):
                acc += a[i][r] * b[r][j]
            out[i][j] = max(acc + bias[j], 0)
    return out


def inputs(m, k, n):
    a = [[(i * 17 + r * 3) % 11 - 5 for r in range(k)]
         for i in range(m)]
    b = [[(r * 7 + j * 5) % 13 - 6 for j in range(n)]
         for r in range(k)]
    return a, b


def median_seconds(fn, a, b, repeats=7):
    fn(a, b)  # warm-up, outside the timed samples
    samples = []
    for _ in range(repeats):
        start = time.perf_counter()
        result = fn(a, b)
        samples.append(time.perf_counter() - start)
        assert shape(result) == (len(a), len(b[0]))
    return statistics.median(samples)


def main():
    checks = 0
    for dims in [(1, 1, 1), (5, 7, 6), (9, 5, 11)]:
        a, b = inputs(*dims)
        reference = matmul_ijk(a, b)
        assert matmul_ikj(a, b) == reference
        checks += 1
        assert matmul_tiled(a, b) == reference
        checks += 1
        bias = [j - 2 for j in range(dims[2])]
        unfused = [[max(value + bias[j], 0)
                    for j, value in enumerate(row)]
                   for row in reference]
        assert matmul_bias_relu_fused(a, b, bias) == unfused
        checks += 1
    print("correctness checks:", checks)

    a, b = inputs(5, 7, 6)
    print("checksum 5x7 @ 7x6:", sum(map(sum, matmul_tiled(a, b))))
    x, y, z = 1e16, -1e16, 1.0
    print("reduction order:", (x + y) + z, x + (y + z))
    print("fsum reference:", math.fsum([x, y, z]))

    print("python:", platform.python_version())
    a, b = inputs(24, 20, 28)
    for fn in [matmul_ijk, matmul_ikj, matmul_tiled]:
        elapsed = median_seconds(fn, a, b)
        print(fn.__name__, "median_ms=", format(elapsed * 1000, ".3f"))


if __name__ == "__main__":
    main()
