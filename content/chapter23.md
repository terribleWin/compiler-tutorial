# 23 AI 编译链：从模型到可部署程序

## 本章位置、学习目标与实验边界

前面的主线让你从 Sprout 源码走到了字节码和本机程序。本章把同样的编译思想迁移到机器学习模型：模型也是一种程序，只是它的主要值变成张量，主要操作变成矩阵乘法、归约、激活与数据搬运。

本章聚焦**从模型入口到部署产物的整条链路**。第 24 章进一步讨论张量调度、融合、分块和 AI 编译器内部，第 25 章讨论用机器学习帮助编译器做决策。它们是三个互相连接但职责不同的主题。

Sprout 主线没有实现张量类型、模型导入或 AI 后端。下面的零依赖实验是一个独立教学小图系统，用来观察类型/形状检查、合法化与数值边界；它不是 PyTorch、ONNX 或 IREE 的替代实现，也不生成本机机器码。真实工具实验另列，并明确记录版本与验证范围。

学习前建议完成第 10、13、16、18、19 章，知道类型检查、IR、语义保持、运行时和工具链分别解决什么问题。你不需要先懂训练算法：本章只使用固定权重的两层计算，关注推理程序怎样变成部署程序。

## 1. 先分清模型、权重、计算与部署

一个模型通常由计算结构、参数和运行状态共同决定。`y = relu(x @ W + b)` 中，x 是每次请求带来的输入，W、b 通常是训练得到的参数。若只保存 W、b，并没有保存怎样计算；若只保存函数名，也不能保证目标机器有相同实现。

推理时还要考虑模型处于训练还是评估模式。随机丢弃、归一化的状态更新、随机数与输入修改，都可能影响可观察行为。导出前固定模式、明确输入与状态，不是为了让工具“更容易成功”，而是为了定义你到底要部署哪个程序。

可以把部署需求先写成一个小契约：输入名字、shape 范围、dtype、输出格式、允许的数值误差、目标平台和资源限制。例如“输入 x 是 [B,3] 的 float32，B 在 2 到 8 之间；权重是固定 [3,2]；输出是 [B,2]；只部署 CPU 推理”。这比一开始就选择某个文件后缀更有用。

## 2. 从 eager 执行到模型捕获

eager 模式下，Python 执行到一个张量操作，就调用相应实现。它自然保留宿主控制流和交互体验。编译执行则尝试先得到一段可分析的张量程序，再集中优化、生成代码，或把它交给独立运行时执行。

模型捕获的困难在于 Python 程序的表达能力远超一个简单计算图。读取文件、改变全局列表、根据张量里的数值进入不同分支，不能都靠“拿一个输入跑一遍并记下操作”可靠保存。一次样例经过的路径，不自动代表所有合法输入的行为。

`torch.export` 的目标是得到完整的导出表示；无法捕获的部分通常需要处理，而不是静默假装它属于图。`torch.compile` 面向运行中加速，可以具有不同的分段、保护和回退策略。应按你所用版本的规则理解二者，不要把导出图和编译缓存视为同一种文件。[PyTorch 2.9 导出文档](https://docs.pytorch.org/docs/2.9/export.html) 是本章所选实验版本的依据。

捕获之后要保留三类东西：张量运算图，参数/用户输入的签名映射，以及 shape 等约束。只有图，没有参数对应关系，部署时可能把权重当成用户输入；只有图，没有约束，则可能对不适用的输入运行错误代码。

## 3. 图 IR 仍然是程序表示

对一个无控制流的前馈小模型，可以把运算写成有向无环图：节点是操作，边是值依赖。拓扑排序确保某个值在使用前已经产生。这里与第 13 章三地址码非常相似，只是一个值可能是几十万个元素的张量。

```text
%x : [B,3]     %w : [3,2]     %b : [2]
       \        /
        MatMul -> %m : [B,2]
                    \       /
                      Add -> %h : [B,2]
                                |
                              ReLU -> %y : [B,2]
```

模型有循环时不能简单说“所有 AI 程序都是 DAG”。一种常见表示是无环的外层值依赖图中包含 If、Loop 或带区域的控制流操作；循环体在自己的区域中描述迭代。分支条件若依赖张量内容，就需要保留相应运行时控制流，或者证明某个分支对契约内所有输入固定。

例如按 batch 大小选择路径，与按 `x.sum()` 的结果选择路径，信息来源不同。前者可能转化为形状约束与特化，后者通常需要数据依赖控制流。把示例输入得到的真假直接写死，会改变其他输入的行为。导出支持何种结构应看对应版本的支持说明与示例，而不是从一次成功推断全部 Python 都可导出。[PyTorch ExportDB](https://docs.pytorch.org/docs/2.9/generated/exportdb/index.html) 提供受支持结构的官方示例。

## 4. Shape、dtype、layout 分别回答什么

shape 是每个轴的长度，rank 是轴数；dtype 是单个元素的表示，如 float32 或 int8；layout/stride 描述逻辑索引与实际存储位置的关系。[2,3] 与 [3,2] 元素总数相同，却不是同一形状；相同 shape 的连续张量和转置视图，也不一定有相同存储关系。

对二维矩阵乘法，[B,K] 乘 [K,N] 得到 [B,N]。K 必须一致。对偏置相加，[N] 可沿前面的轴广播成 [B,N]，但 [B] 一般不能当作输出最后一轴的偏置，除非维度恰好兼容。名字叫 bias 并不会让不合法形状自动变得合法。

广播从末尾轴对齐，每对轴必须相等或其中一个为 1。结果取另一个轴或共同长度。要注意 0 与 1 的边界：不能简单对每对长度取 max，因为长度 0 与 1 广播时对应结果轴可为 0。具体操作仍应按所用格式的算子规范验证。

动态 shape 也不等于完全不知道。`[B,3]` 的 B 可以是有范围的符号，且多个输入可以共享同一符号。`[B,K]@[K,N]` 的收缩维相等关系必须保留；若两个维度仅因为示例都等于 3 而被误认为同一变量，后续特化就可能错误。ONNX 的 shape 推断能传播部分类型与维度，但不保证为所有动态计算推得精确表达式。[ONNX shape 推断说明](https://onnx.ai/onnx/repo-docs/ShapeInference.html) 给出了能力与限制。

dtype 也要独立验证。float16 输入、float32 累加、float16 输出是一项明确策略，不是看到输入低精度就能推断的结论。整数的零点、乘法累加宽度、饱和与舍入同样会影响结果。模型编译器保留这些信息，是因为后端优化必须知道自己允许改变什么。

## 5. 动态维度、特化与保护条件

可以把一个动态模型编译成通用代码，也可以对常见形状生成专门版本，再加运行时保护选择版本。前者减少版本数量，后者可能获得更强优化。选择由输入分布、编译成本、代码大小和目标能力共同决定，没有一种策略总是更好。

假设为 B=4 生成了完全展开的代码，那么 B=6 的输入不能直接使用它。正确系统可以拒绝、不匹配时重新编译，或选择另一份通用实现；不能只因“原来是动态模型”就跳过保护。缓存键还要包含 dtype、布局、目标与相关编译选项。

导出时声明 B 在 2 到 8 之间，也不保证所有后端都支持这个范围的动态运算。每一层都有自己的可表达集合：前端能导出，不代表中间转换、目标后端和运行时全部支持。把约束随产物保存，才能解释失败在哪个阶段。

## 6. 算子分解与合法化

高层 Linear 可以分解成 MatMul 与 Add，ReLU 可以表示为与零逐元素取最大值。这样减少后端必须直接支持的高层操作种类。分解还应核对 NaN、有符号零等数值边界，并保持参数约定：框架中某些线性层把权重存成 [N,K]，而本章数学例子把 W 写成 [K,N]，两者之间需要显式转置，不能只替换操作名字。

合法化表示把程序转换到目标允许的操作/类型集合，并证明所有残留操作合法。若目标只接受 matmul、add、maximum，却还留下一个自定义操作，应报告不支持，而不是让运行时碰运气。类型合法与算子合法也不同：int8 可能是合法存储类型，但某目标未必有相应的 int8 矩阵乘法实现。

分解不是越早越细越好。过早展开一个高层算子，可能丢掉后端识别高效实现所需的结构；保留到合适层次再降级，通常更容易兼顾优化与可移植性。第 24 章会进一步解释这种层次选择与调度。

## 7. ONNX、StableHLO、MLIR 是不同层次的工具

| 名称 | 主要职责 | 不应误认为 |
| --- | --- | --- |
| ONNX | 模型图、算子集、类型与序列化交换约定 | 安装后自动支持所有模型的完整运行时 |
| StableHLO | 面向机器学习的高层算子语义与可移植表示 | 任意版本、任意文本都永久互通 |
| MLIR | 构造多层 IR、dialect、变换与降级的基础设施 | 一个固定且唯一的模型文件格式 |
| IREE | 基于编译器与运行时完成导入、目标生成和部署 | 仅把一个图交给 Python 逐节点执行 |

ONNX 模型的 ir_version、opset_import 与模型自身版本是不同字段。算子语义随 domain/opset 解释，不能通过改一个数字就假定旧模型转换正确。ONNX 图是交换层表示，优化器内部可使用另一种结构。[ONNX IR 规范](https://onnx.ai/onnx/repo-docs/IR.html) 定义了这些边界。

StableHLO 在 MLIR 形式下表达张量操作，规范定义每个操作的输入、结果与语义。它与 ONNX 不构成所有模型必须依次经过的固定链条；具体项目可能从框架直接进入某类 IR，也可能走 ONNX 导入。导入路径和算子覆盖要分别核对。[StableHLO 规范](https://openxla.org/stablehlo/spec) 可用于核实类型和算子含义。

StableHLO 的兼容承诺针对符合条件的可移植序列化产物及版本窗口，不应简单推广到任意 MLIR 文本和所有开发 API。发布时应记录目标版本与序列化方式，而不是只写“已导出 stable 格式”。[官方兼容说明](https://openxla.org/stablehlo/compatibility) 给出具体条件。

## 8. 零依赖实验：构造图、推断形状、合法化并执行

下载包中已提供同一份完整脚本 `compiler/experiments/ai_pipeline_demo.py`。也可把下面保存为 `ai_chain_lab.py`，在一个独立实验目录运行 `python ai_chain_lab.py`。它只用 Python 标准库，输入是一个带固定权重的 Linear+ReLU。我们手工构造“捕获后的图”，没有实现分析任意 Python 函数的捕获器。

本实验仅接受有限的 Python float，用普通浮点作参考算术，不模拟每一步 float32 舍入，也不覆盖 NaN 与有符号零的全部框架规则。它的数值结果是教学基准，真实 float32/量化后端要按各自误差契约比较。代码故意把图合法化与执行分开，使你可以检查两份中间产物。

```python
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
```

先检查输出中的目标操作顺序为 matmul、bias_add、max_zero；结果应是 `[[7.5, 6.5], [0.0, 0.0]]`，改变 batch 后得到 3 行。两个故意错误分别被收缩维检查和输入契约拒绝。打开四个 JSON，比对高层节点、每个值的 shape、低层操作和最终结果。

它还刻意展示了简化边界：bias_add 的执行器只实现一维偏置，图没有循环、别名或修改；合法化临时名字按本例约定生成，没有实现一般用途的全局名字分配器。通用 shape 广播函数的存在，不意味着每个执行原语已经支持全部广播情况。扩展系统时必须让分析能力、目标合法集合和执行器能力一致。

## 9. 量化：改变数值表示需要误差契约

均匀量化常用 `real ≈ scale × (q - zero_point)`。scale 决定步距，zero_point 表示实数零对应的整数位置。编码还要明确取整、裁剪、存储范围和反量化顺序，不能把 float32 强制转换成 int8 就叫完成量化。

上面实验使用对称范围 [-127,127]、零点 0，scale=bound/127。它只是 fake quant：量化后再还原到浮点，观察误差，没有实现整数矩阵乘法。当 bound=1 时，7.5 会被裁剪成可表示的 1；bound=8 时能覆盖 7.5，但步距更粗。这是覆盖范围与分辨率的权衡。

静态量化需要校准数据估计激活范围。校准集应反映部署输入，不应只用方便的全零样例；动态量化在运行时计算部分参数，开销和精度权衡不同。逐通道权重量化允许每个通道有自己的尺度，但尺度轴必须与权重布局一致。[ONNX Runtime 量化文档](https://onnxruntime.ai/docs/performance/model-optimizations/quantization.html) 对静态、动态和 QDQ 表示给出说明。

真正的量化矩阵乘法通常涉及零点校正、较宽整数累加、bias 的尺度与重新量化。最终还要用任务指标和逐层数值比较判断损失，不能只检查“模型能加载”。QDQ 节点出现在图里，也不保证后端最终采用整数内核；要观察实际降级和目标实现。[StableHLO 量化说明](https://openxla.org/stablehlo/quantization) 展示了量化类型与不同合法化方向。

## 10. 可选真实实验 A：固定 PyTorch 2.9.0 捕获小模型

此扩展步骤未在本次本机安装验证；零依赖实验已单独执行。为减少跨版本差异，选择独立 Python 3.11 环境与 PyTorch 2.9.0 CPU 包，不声称它是当前最新版本。安装源、系统支持与具体 wheel 应按 [PyTorch 历史版本页](https://pytorch.org/get-started/previous-versions/) 核对，不把已有大型环境混入这个小实验。

```text
python -m venv .venv-export
# 激活环境后，Windows/Linux 的 CPU 安装示例：
python -m pip install torch==2.9.0 --index-url https://download.pytorch.org/whl/cpu
python -c "import torch; print(torch.__version__)"
```

保存以下为 `export_small.py`。使用 buffer 保存固定权重，避免把常量构造混入 forward；动态 batch 的范围对应本章契约，显式写 strict=True 避免依赖默认值变化。

```python
from pathlib import Path
import torch

assert torch.__version__.split("+")[0] == "2.9.0"

class Small(torch.nn.Module):
    def __init__(self):
        super().__init__()
        self.register_buffer("w", torch.tensor([[1., 2.], [0., -1.], [2., 1.]]))
        self.register_buffer("b", torch.tensor([0.5, -0.5]))

    def forward(self, x):
        return torch.relu(x @ self.w + self.b)

model = Small().eval()
x = torch.tensor([[1., -2., 3.], [0., 2., -1.]])
batch = torch.export.Dim("batch", min=2, max=8)
ep = torch.export.export(model, (x,), dynamic_shapes={"x": {0: batch}}, strict=True)
out = Path("export-artifacts")
out.mkdir(exist_ok=True)
(out / "graph.txt").write_text(str(ep.graph_module.graph), encoding="utf-8")
(out / "signature.txt").write_text(str(ep.graph_signature), encoding="utf-8")
(out / "constraints.txt").write_text(str(ep.range_constraints), encoding="utf-8")
torch.export.save(ep, out / "small.pt2")
with torch.no_grad():
    for rows in (2, 3, 8):
        sample = torch.ones(rows, 3)
        torch.testing.assert_close(model(sample), ep.module()(sample))
    print(ep.module()(x))
print("saved to", out)
```

预期输出数值仍为第一行 7.5、6.5，第二行两个零；保存的图中应有矩阵乘法/加法/激活对应操作，以及参数或 buffer 的签名信息。具体节点名字不是稳定接口，不应照抄某个开发版本的长 dump 当作验收标准。

接着尝试 batch=9 和最后维度为 4 的输入，记录失败类别。是否在导出期、装载期或运行约束检查时失败，需要按你实际工具结果报告。保存程序后重新装载并运行，才能检验序列化链，而不是只证明内存中的 ep 可执行。跨版本长期保存能力另查该格式版本承诺，不推断它与 StableHLO 的兼容政策相同。

## 11. 可选真实实验 B：从 StableHLO 小模块到 IREE CPU 部署

这个实验独立于上面的 PyTorch 导出，不宣称 `small.pt2` 可以直接当 IREE 输入。完整模型导入需选择实际受支持的适配器，例如对应版本的 ONNX 导入或其他框架路径，并逐层核对算子覆盖。

选取 IREE compiler/runtime 同为 3.9.0 的独立实验环境。官方发布页和包页面确认此版本存在；本次没有安装运行这组工具，因此下面是按官方接口整理的扩展步骤，读者需保存实际版本输出与执行日志。[IREE 3.9.0 发布](https://github.com/iree-org/iree/releases/tag/v3.9.0) 与 [CPU 部署指南](https://iree.dev/guides/deployment-configurations/cpu/) 是核对入口。

```text
python -m pip install iree-base-compiler==3.9.0 iree-base-runtime==3.9.0
iree-compile --version
iree-run-module --list_drivers
```

先用一个刻意很小的 StableHLO 模块消除大模型权重与导入器干扰。保存为 `double.mlir`：

```mlir
module {
  func.func @double(%x: tensor<2x2xf32>) -> tensor<2x2xf32> {
    %y = stablehlo.add %x, %x : tensor<2x2xf32>
    return %y : tensor<2x2xf32>
  }
}
```

```text
iree-compile double.mlir --iree-input-type=stablehlo --iree-hal-target-device=local --iree-hal-local-target-device-backends=llvm-cpu --iree-llvmcpu-target-cpu=host -o double.vmfb
iree-run-module --device=local-task --module=double.vmfb --function=double --input="2x2xf32=1"
```

输入每个元素为 1，预期结果每个元素为 2。若工具报告未知选项，先核对实际版本与该版本 `--help`，不把其他年份的旧命令盲目混入。若没有匹配 wheel，可以按固定标签构建或换官方支持的平台，并将这一变更写入实验记录。

vmfb 是部署模块，不等于“所有算术都由一台逐标量字节码解释器执行”。IREE 可在模块中组织运行控制与目标可执行代码；CPU 路线把计算编成目标指令，运行时处理设备、缓冲与调用。host 目标还可能使用本机特性，拿到另一台 CPU 前应重新核对目标设置与兼容性。

大型模型的参数可与代码独立管理，运行时装载与权重生命周期也属于部署链。CPU 上成功执行只是一次目标验证，不能自动推出移动端、另一架构或另一设备同样可运行。关于其分层工具与中间表示，可继续看 [IREE 开发者概览](https://iree.dev/developers/general/developer-overview/)。

## 12. 每层该观察什么，怎样定位第一个分歧

| 阶段 | 保留产物 | 优先检查的问题 |
| --- | --- | --- |
| 原模型 | 模式、参数、输入样例、基准输出 | 参考行为是否固定 |
| 捕获 | 图、签名、约束 | 参数映射与动态维是否正确 |
| 交换/导入 | 格式版本、opset、导入后 IR | 不支持算子与语义差异 |
| 合法化 | 前后 IR、合法操作清单 | 是否残留目标不支持的操作 |
| 数值转换 | dtype、scale、zero point、误差报告 | 舍入/裁剪/累加与尺度轴 |
| 目标生成 | 目标配置、模块、编译日志 | 架构、特性、入口与 ABI |
| 部署 | runtime 版本、输入输出、加载日志 | 缓冲形状、dtype 与运行环境 |

结果错误时先比较最早可观察的中间值。原模型与捕获图已经不同，就不该先调寄存器分配；导入前后相同而量化后漂移，就先看校准与数值表示；只有部署端错误，才优先检查入口签名、权重映射、目标兼容与缓冲传递。

性能测量也要分层。编译时间、第一次加载、首次调用、预热后稳态延迟、吞吐与内存峰值是不同指标。不要用包含一次编译的时间去和仅执行的时间直接比较，也不要因某个图节点更少就断言一定更快。第 24 章将进一步讨论调度和目标性能。

## 13. 常见错误

- 把单个示例形状当成动态契约：保留符号与范围，测试至少三个不同合法 batch。
- 混淆 Linear 权重方向：先写数学 shape，再核对框架存储布局。
- 认为导出成功代表部署成功：逐层检查导入器、合法化、目标与运行时支持。
- 把量化当作类型转换：同时验证校准、尺度、零点、舍入、饱和与任务误差。
- 混用包版本、opset 与 IR 版本：分别记录，不通过改元数据伪装转换。
- 把 PyTorch 导出、ONNX、StableHLO 强行串成唯一流水线：按实际适配器选择路线。
- 只留下最终可执行模块：保留小型输入和中间产物，才能找首个分歧。

## 14. 练习、参考答案与结业验收

练习一：输入从 [2,3] 改为 [5,3]，哪些 shape 会变，哪些参数不变？练习二：把 W 改为 [2,3]，为什么不能继续按相同 MatMul 使用？练习三：校准只见过 [-1,1]，部署出现 7.5，会发生什么？练习四：图中包含自定义 foo，目标只支持三个原语，在哪里拒绝最清楚？

<details><summary>参考答案</summary>

第一题中 MatMul、加偏置、ReLU 的首轴变为 5，W 与 bias 不变；输出为 [5,2]。第二题收缩维 3 与 2 不一致，若参数本意采用另一方向，应在明确语义后转置，而非只改 shape 标签。第三题若仍用覆盖 [-1,1] 的固定尺度，7.5 会被裁剪，误差可远超正常量化步距。第四题在合法化结束的目标合法性检查中报告未支持操作，带来源位置和输入类型，比留到运行时报未知节点更清楚。

</details>

基础验收是独立运行零依赖实验，检查四个中间产物，说明一次形状拒绝与一次校准失配，并确认 eager 与合法化执行结果一致。进阶验收再选择一个真实工具实验，固定版本、保存实际日志、验证正常和错误输入；若完成完整框架到部署链，还应附导入路径、权重来源、格式/opset、数值误差与目标配置。

不要把本章教学图解释器的成功当成已经实现 AI 本机编译后端，也不要把未执行的扩展命令写成通过。下一章从这条链中抽出最关键的性能层，研究张量程序如何变成高效循环、内存访问与目标代码。也可先打开 [张量分块实验室](tensor-lab.html)，观察矩阵形状与分块边界。

## 本章资料核对记录

2026-11-06 联网阅读并核对了上述官方页面的导出约束、ONNX 版本/形状、StableHLO 类型/兼容/量化、IREE CPU 编译与运行以及量化说明。额外核对了 [IREE compiler 3.9.0 包](https://pypi.org/project/iree-base-compiler/3.9.0/) 和 [runtime 3.9.0 包](https://pypi.org/project/iree-base-runtime/3.9.0/) 的发布存在性。选择固定旧版本是为了实验边界明确，不代表推荐读者把所有工程降到该版本。

本次已在本机实际运行完整零依赖脚本，核对正常输出、动态 batch、两个拒绝例、量化裁剪反例和四个 JSON 中间产物。零依赖图结构、输入数据、shape 检查、合法化规则和量化反例由本教程自行设计。未复制论文、模型权重或第三方长代码；没有声称本机已经执行 PyTorch/IREE 扩展。前 22 章的主线与实现边界保持不变。
