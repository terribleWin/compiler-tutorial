# 第25章实验与来源记录

本次仅新增实验，不修改 Sprout 编译器或现有语言行为。

## 实际执行

日期：2026-11-06。系统：Windows 11；Python：3.14.4。命令从课程根目录执行：

```text
python compiler/experiments/ai_tuning_demo.py --output verification/ai-tuning-observed.json
```

执行成功。所有进入计时的候选先与独立整数点积参考实现逐元素比较，通过后才收集计时。训练形状12/16/20、验证形状24、最终测试形状28互不重合。每候选7轮，每轮3次；候选顺序按固定种子打乱。完整运行记录在本次工作目录的 `verification/ai-tuning-observed.json`。

实际模型选择 ikj，验证接受；最终测试基线中位数1798033.333纳秒、MAD33200纳秒；ikj中位数1829366.667纳秒、MAD44533.333纳秒。加速比0.982872，小于1；不宣称加速或统计显著回退。第25章按实际结果如实讲解，没有挑选一次成功计时覆盖失败结果。

本实验只验证未见尺寸，不验证新程序家族或跨硬件泛化。模型 `alpha[s] * n^3` 对不同正 n 的排序不变，只能学习全局偏好的候选；章节明确此限制，并以增加交互特征作为改进练习。计时包含 Python 循环、列表操作和输出分配，不表示本机C++或设备内核性能。

## 联网核对的一手资料

- LLVM官方MLGO文档，Introduction、训练边界：<https://llvm.org/docs/MLGO.html>。核对列出的集成方向为inlining-for-size和greedy register allocation eviction for performance；不把局部启发式扩大成完整寄存器分配器。
- Learning to Optimize Tensor Programs，原论文摘要与元信息：<https://arxiv.org/abs/1805.08166>。仅用作统计代价模型引导搜索的研究入口，不复述其历史性能数据。
- egg原论文摘要和官方项目介绍：<https://arxiv.org/abs/2004.03082>、<https://github.com/egraphs-good/egg>。核对e-graph、equality saturation和领域分析的定位；条件与反例由本教程自行解释。
- Meta Large Language Model Compiler，原论文摘要、引言与任务导航：<https://arxiv.org/abs/2407.02524>、<https://arxiv.org/html/2407.02524v1>。仅作为LLM优化相关研究实例，不以历史模型或任务成绩冒充当前通用能力。
- Alive2官方README的工具列表、独立alive-tv及限制说明：<https://github.com/AliveToolkit/alive2>、<https://raw.githubusercontent.com/AliveToolkit/alive2/master/README.md>。明确refinement检查与不支持跨过程变换的边界。

没有为本章再次抽取或声称完整阅读本地dl目录论文。所有现有第1—22章内容及原编译器文件保持不变。
