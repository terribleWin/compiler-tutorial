# 资料、来源与阅读记录

本书以你提供的两个资料库建立主题地图，抽读其中的核心教学材料与论文，再围绕统一的 Sprout 语言重新组织讲解、例子、算法演算和代码。原始教材、论文和视频没有复制进网站。

## 两个资料库的角色

| 资料库 | 本次目录盘点 | 在本书中的作用 |
| --- | --- | --- |
| compilers-resources | 5905 个非 Git 元数据文件，其中 144 个 PDF | 教材与课程路线、自动机与分析算法、实验组织、LLVM/RISC-V 工具入口 |
| compilers-papers-we-love | 186 个非 Git 元数据文件，其中 178 个 PDF | 经典算法原始论文、SSA、寄存器分配、测试、类型系统和研究方向 |

文件数包含工具文档、源码和附属文件，不能理解成“5905 篇独立教学文章”。例如第一个库的 `tools/` 包含大量随工具分发的 HTML 文档。盘点时间为 2026 年 11 月 6 日。

原始入口：[南大 compilers-resources](https://git.nju.edu.cn/hengxin/compilers-resources)、[compilers-papers-we-love](https://github.com/courses-at-nju-by-hfwei/compilers-papers-we-love)。逐主题对应见[主题覆盖地图](coverage.html)。

## 实际阅读边界

目录检索与书目浏览用于判断覆盖范围；实际抽读的文件、页数和使用方式另行记录。没有把两个目录的全部 PDF 逐页读完，也没有将未读材料包装成已精读来源。每章末尾给出相关原始资料；“延伸阅读”表示建议继续读，不等于本次全文阅读记录。

以下两节自动收录本项目的详细阅读记录，便于你检查课程依据。页码均以具体文件的物理页为准。

## 推荐的第一手公开资料

| 学习内容 | 入口 | 阅读方式 |
| --- | --- | --- |
| 增量构建编译器 | [Ghuloum：An Incremental Approach](http://scheme2006.cs.uchicago.edu/11-ghuloum.pdf) | 学习怎样把大任务拆成小闭环，而不是照抄目标架构 |
| 词法、递归下降、VM | [Crafting Interpreters](https://craftinginterpreters.com/) | 作者公开书，从扫描到字节码，比较语言规则差异 |
| LL/LR 与生成器 | [GNU Bison 手册](https://www.gnu.org/software/bison/manual/bison.html) | 先掌握本书手算，再看冲突、语义值与诊断 |
| PEG 与 Packrat | [Bryan Ford 的研究页](https://bford.info/packrat/) | 注意有序选择与 CFG 二义性的区别 |
| LLVM 前端与工具链 | [LLVM 前端教程](https://llvm.org/docs/tutorial/MyFirstLanguageFrontend/index.html) | 从 Lexer/AST 到 IR，和 Sprout 的独立主线作比较 |
| LLVM IR 的精确规则 | [LLVM Language Reference](https://llvm.org/docs/LangRef.html) | 查询类型、指令、φ、poison 等语义；不要只凭教程片段猜测 |
| 多层 IR 与领域编译 | [MLIR Toy Tutorial](https://mlir.llvm.org/docs/Tutorials/Toy/) | 先理解降低与 IR，再接触 dialect 和张量计算 |
| RISC-V 二进制接口 | [RISC-V psABI](https://riscv-non-isa.github.io/riscv-elf-psabi-doc/) | 区分指令集规范、ABI 与具体工具链 |
| 经验证的编译器 | [CompCert 官方项目](https://compcert.org/) | 了解语义保持的证明范围，以及它与测试的关系 |
| 构建工程 | [CMake 教程](https://cmake.org/cmake/help/latest/guide/tutorial/) | 对照自己的生成器和平台，不混用构建目录 |
| C++ 标准模式 | [GCC 选项](https://gcc.gnu.org/onlinedocs/gcc/C_002b_002b-Dialect-Options.html)、[Clang 支持状态](https://clang.llvm.org/cxx_status.html) | 版本、标准模式和实现完整性分别核对 |
| 发布本站 | [GitHub Pages 文档](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) | 本项目采用 main 分支的 /docs 静态目录 |

这些网页与工具会变化，LLVM 拓展尤其需要固定一致版本。本书主线不依赖在线库或 LLVM API，便于保持 C++11 基线和离线实践。

## 如何使用龙书、虎书和专题论文

第一轮只选一本系统教材配合本书，不需要在动手前读完。读扫描器时查正则与自动机；读 Parser 时查 LL/LR；完成 VM 后再查 IR、优化和后端。论文适合带着具体问题读：先写下问题，找定义与核心图例，自己做一个小例子，再追证明和复杂度。

例如读 SSA 论文之前，先试着为有分支的 `x` 重命名；遇到无法确定使用哪个版本时，φ 的动机才会变得具体。读线性扫描论文之前，先画四个区间塞进两个寄存器，看见 spill 的必要性。

## 许可与引用

本书教程与实现为独立编排；不会把资料库的 MIT 仓库许可解读为其中所有教材 PDF 都可以再分发。原始文献各自遵循原作者或出版方的许可。原创教程按 CC BY 4.0，源码与代码示例按 MIT 许可，完整条款在项目仓库中。
