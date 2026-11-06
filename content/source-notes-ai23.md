# 第 23 章联网资料与样例验证记录

日期：2026-11-06。仅采用项目官方文档、官方发布与官方维护的包页面。本章没有改变前 22 章，也没有给 Sprout 主线添加 AI 后端。

## 实际阅读范围

| 官方来源 | 实读部分与本章用途 |
| --- | --- |
| [PyTorch 2.9 torch.export](https://docs.pytorch.org/docs/2.9/export.html) | 导出图/签名、Expressing Dynamism、Named Dims、序列化、strict 与不可捕获控制流；据此选择2.9.0独立实验，不混入main版新API |
| [PyTorch 2.9 ExportDB](https://docs.pytorch.org/docs/2.9/generated/exportdb/index.html) | 控制流支持示例的官方入口；本章没有完整复制其示例 |
| [PyTorch 2.9 ONNX](https://docs.pytorch.org/docs/2.9/onnx.html) | 确认框架导出与交换格式是不同步骤；本章未给出未经验证的PyTorch→IREE直接命令 |
| [PyTorch Previous Versions](https://pytorch.org/get-started/previous-versions/) | v2.9.0 Windows/Linux CPU wheel命令；不需要安装本实验未使用的vision/audio包 |
| [ONNX Concepts](https://onnx.ai/onnx/intro/concepts.html) | 图、算子集与shape/type inference基本职责 |
| [ONNX IR](https://onnx.ai/onnx/repo-docs/IR.html) | Models、opset_import、Graphs与顶层值依赖；区分IR版本/opset/模型版本 |
| [ONNX Shape Inference](https://onnx.ai/onnx/repo-docs/ShapeInference.html) | 符号维传播与推断限制，不假定通用动态shape求解完备 |
| [ONNX MatMul](https://onnx.ai/onnx/operators/onnx__MatMul.html) | MatMul算子入口；本章教学实验收窄到二维，不声称实现全部ONNX MatMul语义 |
| [StableHLO spec](https://openxla.org/stablehlo/spec) | Programs、Tensor Types与操作语义组织；不将MLIR基础设施等同单一模型格式 |
| [StableHLO Compatibility](https://openxla.org/stablehlo/compatibility) | Versions/Guarantees；强调可移植序列化产物、窗口与条件，不泛化到任意文本 |
| [StableHLO Quantization](https://openxla.org/stablehlo/quantization) | scale/zero point、per-tensor/per-axis、QDQ与整数化合法化方向 |
| [ONNX Runtime Quantization](https://onnxruntime.ai/docs/performance/model-optimizations/quantization.html) | Quantization Overview、QOperator/QDQ、静态/动态校准与预处理；本章未据此复制或运行具体量化工具代码 |
| [IREE CPU deployment](https://iree.dev/guides/deployment-configurations/cpu/) | compiler/runtime区分、local-task、输入导入、CPU目标参数与run-module；只采用CPU路径 |
| [IREE Developer overview](https://iree.dev/developers/general/developer-overview/) | 输入dialect、iree-opt/compile/run-module等工具分工 |
| [IREE v3.9.0 release](https://github.com/iree-org/iree/releases/tag/v3.9.0) | 确认固定发布标签存在 |
| [IREE compiler 3.9.0](https://pypi.org/project/iree-base-compiler/3.9.0/) 与 [runtime 3.9.0](https://pypi.org/project/iree-base-runtime/3.9.0/) | 确认匹配包版本存在；并未安装它们或声称本机已通过IREE验证 |

直接获取IREE v3.9.0标签下某个文档源文件的请求未成功；本章依据官方发布页和当前官方CPU指南整理命令，并将真实工具实验明确标为未本机运行。安装后须保存该版本 --help 与实际命令输出，不把参考步骤算作通过。

## 实际验证

- 新增完整脚本：`compiler/experiments/ai_pipeline_demo.py`，与章节第一个Python代码块一致。
- 使用本机Python在独立临时工作目录运行，输出形状为x:[2,3]、w:[3,2]、b:[2]、h/y:[2,2]。
- 合法化操作序列为matmul、bias_add、max_zero；最终输出 `[[7.5,6.5],[0.0,0.0]]`。
- batch改为3时与eager参考实现相同；不合法收缩维、违反输入契约均被ValueError拒绝。
- 零长度shape广播的0与1边界断言通过；数值执行器明确只接收非空、规则、有限Python浮点矩阵。
- 范围校准过窄时7.5恢复为1.0；较宽范围恢复约7.496063，体现裁剪与量化步距权衡。
- 四个JSON中间产物全部写出并重新读取核对，临时输出清理后不进入发布源码。
- 两个Python代码块均通过语法编译检查；第二个依赖PyTorch的代码块未执行。
- IREE/StableHLO扩展模块未在本机编译运行，不计入通过项目。
