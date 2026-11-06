# 后半课程资料阅读记录

本记录区分“实际读取的内容”与“建议继续阅读”。页码为 PDF 文件从 1 开始计数的物理页，不一定等于书页页码。正文为围绕 Sprout 自行编写的讲解与演算，没有复制或分发教材和论文文件，也没有声称两个目录中的全部文档已逐页读完。

## 本地实际读取

| 资料库与相对路径 | 实读范围 | 用途与边界 |
| --- | --- | --- |
| compilers-resources/projects/README.md | 全部短索引 | 渐进式项目组织，追踪到 Ghuloum 原文链接；未在本次完整精读链接论文 |
| compilers-resources/material/llvm/README.md | 全部索引 | LLVM/IR/SSA 工具与原始文档入口 |
| compilers-resources/lectures/README.md | 全部短索引 | 确认讲义目录；未声称阅读两个 PPTX 的全部页 |
| compilers-resources/material/llvm/LLVM IR Tutorial (2019 LLVM Developers Conference).pdf | PDF 1—7 页 | IR 定位、文本/bitcode、流程、模块/函数/块层次与目标信息；第 11—13、19 章 |
| compilers-resources/material/llvm/LLVM Code Generation (CMSC22600, 2020).pdf | PDF 1—6 页 | 名字/模块/块/类型/SSA、tagged 表示、调用与 GC 信息；第 18—19 章；其旧 API 不作为当前 LLVM 直接可编译方案 |
| compilers-resources/material/riscv/CS61C Great Ideas in Computer Architecture More RISC-V Instructions and How to Implement Functions.pdf | PDF 1—7、15—21 页 | 表示层次、整数指令与循环、汇编/目标/链接流程；第 17—19 章；具体 ABI 另查官方规范 |
| compilers-papers-we-love/ir/TOPLAS1991 Efficiently Computing Static Single Assignment Form and the Control Dependence Graph.pdf | PDF 1—3 页 | SSA 动机、直线改名、分支 φ、常量传播背景；第 13—16 章；没有声称本次完整读完 40 页算法证明 |
| compilers-papers-we-love/code-generation/ra/TOPLAS1999 Linear Scan Register Allocation.pdf | PDF 1—6 页 | 活跃区间保守性、active、过期/溢出、复杂度；第 14、17 章，例子重新设计 |
| compilers-papers-we-love/testing/PLDI2011 Finding and Understanding Bugs in C Compilers.pdf | PDF 1—2 页 | 合法且语义明确的随机程序、差分测试、测试边界；第 21 章 |
| compilers-papers-we-love/compilers-testing/CACM2008 Formal Verification of a Realistic Compiler.pdf | PDF 1—3 页 | 语义保持、验证/翻译验证/证明携带代码、pass 组合；第 21—22 章 |
| compilers-papers-we-love/dl/PhD Thesis2020 Deep Learning for Compilers.pdf | PDF 1—8 页 | Chris Cummins，爱丁堡大学，2020；封面、摘要、目录；只用于定位基准生成/模糊测试/启发式学习三条研究方向 |
| compilers-papers-we-love/dsl/微众-Liquid 智能合约编程语言新探索.pdf | PDF 1—3、10—12 页 | 目录、引言、领域需求、宿主嵌入式 DSL 与示例；第 22 章；不据此判断当前产品状态 |

读取方式为本机 pdftotext 的文本提取。本任务目标是教学内容与概念，不涉及复制原 PDF 版式或重绘其图表，因此未对这些资料逐页作视觉版式审校。

## 联网核对的第一手资料

以下链接于 2026-11-06 查看，用于核对工具职责、格式与继续阅读入口。LLVM 的开发版本网页可能变化，实际环境应固定一组匹配发行版本。

- [LLVM 前端教程](https://llvm.org/docs/tutorial/MyFirstLanguageFrontend/index.html)
- [LLVM Language Reference](https://llvm.org/docs/LangRef.html)，重点核对 φ 的前驱边含义与位置约束
- [LLVM Getting Started](https://llvm.org/docs/GettingStarted.html)
- [LLVM opt](https://llvm.org/docs/CommandGuide/opt.html)
- [LLVM GC](https://llvm.org/docs/GarbageCollection.html)
- [LLVM Testing Infrastructure](https://llvm.org/docs/TestingGuide.html)
- [MLIR Toy Tutorial](https://mlir.llvm.org/docs/Tutorials/Toy/)
- [RISC-V psABI](https://riscv-non-isa.github.io/riscv-elf-psabi-doc/)，重点核对寄存器职责和栈对齐；网页当时展示预发布版本，课程没有依赖其新引入的实验 ABI
- [CompCert 官方项目](https://compcert.org/)

Crafting Interpreters 与 Csmith 项目首页的直接抓取本次未成功，未将未取得的网页正文作为本次实读来源；Csmith 测试思想依据本地论文已读页。

## 课程功能与研究阅读的对应

11—12 章与 20—21 章中的 Sprout CLI 属于真实主线；13—19 章的 IR/SSA/机器后端和 22 章的高级语言特性属于扩展实验。课程覆盖多个主题不等于参考编译器已实现所有主题。读者应先完成主线，再根据每章的验收逐步扩展。

## 后半课程样例验证

在本机实际执行了第 11、12、13、16、20 章所有含完整 main 的 Sprout 代码块：输出依次为 11、24、6、受控除零错误，以及 55/55/false；均与正文一致。第 12 与 20 章还通过 --emit-cpp 生成独立目标，以 g++ -std=c++11 编译并运行，分别得到 24 与 55/55/false。临时文件在独立临时子目录中测试后清理。所有后半章节的代码围栏和 details 标签均成对。

第 19 章 LLVM 命令属于扩展实验步骤；本机本次未安装并执行整组 LLVM 工具，因此不将其记作已运行验证。格式依据官方语言参考与工具文档核对。
