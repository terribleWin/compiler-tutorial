# 资料地图：从本地专题找到课程入口

本书围绕“用 C++11 写出能编译 Sprout 的工具”重新组织材料，没有沿资料库的文件顺序逐篇翻译。两个原始资料库保持原样，网站发布的是原创讲解、示例和实现，不再分发其中的教材、论文 PDF 或视频。

阅读工作分为两层：先查看目录、说明与资源清单，建立主题地图；再抽读与教学主线直接有关的论文、讲义章节和项目说明。**没有逐页阅读所有 PDF，也没有逐篇验证目录内全部论文。** 各章“来源与延伸阅读”标出实际使用的材料和选读页段；只列为后续方向的专题，不代表已精读。此页帮助你继续利用本地收藏，而不是把目录覆盖率冒充阅读完成度。

## 怎样使用这张地图

第一次学习按第 1—12 章完成可运行闭环，再按第 13—22 章扩展。遇到具体疑问时，先读对应章节和一份原始资料，不需要同时打开十本教材。表内路径相对于两个资料库根目录；浏览器无法直接访问你电脑中的 F 盘，需在本机文件管理器中定位。

## compilers-resources：教材、讲义与实验

| 本地目录 | 对应课程入口 | 学习时要解决的问题 |
| --- | --- | --- |
| `books/Classic Textbooks`、`books/Compiler Labs`、`books/Compilers Projects` | [路线与实验](roadmap.html)、第 1—22 章 | 选择一本核心教材备查，跟随一条实验主线，避免把不同实验语言的规范混在一起 |
| `books/RegEx`、`material/re-nfa-dfa`、`material/general-automata-theory` | [第 5 章](chapter05.html)、[第 6 章](chapter06.html) | 正则怎样构造自动机，最长匹配、状态等价和最小化各解决什么问题 |
| `material/lexical-analysis`、`projects/lexer`、`tools/lexer` | 第 5—6 章 | 如何从字符流得到带位置的 Token，并设计边界测试 |
| `material/cfg-parsing`、`projects/parser`、`tools/parser`、`tools/grammar` | [第 7 章](chapter07.html)、[第 8 章](chapter08.html) | 递归下降与 LL/LR 如何联系，为什么会产生冲突 |
| `material/attributed-grammars` | [第 9 章](chapter09.html)、[第 10 章](chapter10.html)、第 14 章 | 类型、环境等信息怎样沿树或图传递，为什么有些依赖需要迭代 |
| `books/ANTLR`、`books/flex-bison-lex-yacc`、`tools/antlr4`、`projects/flexbison`、`projects/tpantlr2-code`、`projects/tpdsl-code` | 第 5—10 章的扩展阅读 | 手写流程理解后，怎样用生成器替换某一阶段，并保留同一语言契约 |
| `material/code-generation`、`projects/code-generator`、`tools/code-generation` | [第 11 章](chapter11.html)、[第 12 章](chapter12.html)、第 17 章 | AST 怎样变成指令，操作数栈、跳转回填和调用帧如何配合 |
| `books/LLVM`、`material/llvm`、`tools/llvm` | 第 13—16 章、[第 19 章](chapter19.html) | IR、基本块、SSA 与目标生成处于什么层次，怎样接入已有工具链 |
| `books/Computer Architecture`、`material/riscv`、`tools/assembly` | [第 17 章](chapter17.html)、[第 18 章](chapter18.html)、第 19 章 | 寄存器有限时怎么办，ABI、目标文件、链接与运行环境怎样相互约束 |
| `books/PL`、`material/languages`、`tools/runtime` | 第 4、10、18、22 章 | 语法选择如何影响类型、内存、模块和运行时设计 |
| `books/Design Patterns`、`tools/front-end`、`tools/clang`、`tools/gcc`、`tools/compiler-explorer` | 第 2—3、9、20—21 章 | 如何组织所有权、观察各阶段产物并建立可重复测试 |
| `courses`、`lectures`、`projects/nju-cs-labs`、`competitions` | [学习路线](roadmap.html)、第 20—22 章 | 如何把知识切成实验，如何从小语言走向课程实验和竞赛项目 |
| `problem-sets`、`projects/grammar`、`projects/compilers` | 第 6—10、20 章 | 用独立题目和已有工程检验形式推导与实现能力 |
| `material/compilers-history`、`material/tutorial`、`books/Compilers` | 第 1 章、[资料索引](references.html) | 编译器的发展和工程背景；历史工具说明需与当前版本区分 |
| `material/l-systems`、`latex`、`tools/mps`、`tools/xtext`、`tools/compilers-assistant` | 第 8、22 章后的自选阅读 | 扩展到生成系统、语言工作台和辅助工具；它们不是完成 Sprout 的前置要求 |
| `tools/automata`、`papers-we-love` | 第 6 章与下一张论文地图 | 自动机工具辅助观察；旧论文入口应与独立论文库交叉定位 |

这里把相关目录合并展示，不表示同一行的每个文件已经实际读过。原库中不同年份的 LLVM、GCC、RISC-V 手册尤其适合作历史对照；实际安装、API 与命令参数应查对应版本的官方文档。

## compilers-papers-we-love：原论文阅读入口

| 本地专题 | 对应章节 | 建议带着什么问题阅读 |
| --- | --- | --- |
| `teaching`、`history`、`compilers` | 第 1、3、20 章 | 为什么采用增量实现，怎样让每一步都有可验证结果 |
| `re-nfa-dfa` | 第 5—6 章 | 自动机构造、最小化、最长匹配的正确性与复杂度条件是什么 |
| `cfg`、`parsing` | 第 7—8 章 | LL、LR 与通用分析器的能力边界、冲突和错误诊断如何表述 |
| `attributed-grammars`、`type systems` | 第 9—10、14 章 | 树上上下文约束如何形式化，循环依赖与不动点何时可计算 |
| `ir`、`optimization` | 第 13—16 章 | 为什么需要显式定义使用关系，SSA、控制依赖和程序依赖怎样帮助变换 |
| `code-generation`，包括 `code-generation/ra` | 第 17—18 章 | 指令选择、活跃区间、寄存器分配与目标机器约束怎样配合 |
| `llvm`、`riscv` | 第 18—19 章 | 如何区分语言语义、IR 语义、ISA、ABI 与具体运行环境 |
| `compilers-testing`、`testing` | [第 21 章](chapter21.html) | 差分测试需要什么前提，怎样生成有效程序并缩小失败输入 |
| `programming-languages`、`pls`、`dsl` | 第 4、10、22 章 | 新语言和领域语言为什么需要明确类型、求值顺序与运行约定 |
| `dl`、`tools` | 第 19、22 章的后续路线 | 张量与多层 IR、语言工具和研究原型怎样建立在基本编译流程之上 |

入门阶段推荐先读 Ghuloum 的增量教学思路，再在完成 CFG 和数据流后阅读 SSA 原论文，最后研究线性扫描和编译器测试。论文中的记号、源语言、机器和语义可能与 Sprout 不同，借鉴算法前先写下假设；不能把“论文说此改写成立”直接当成当前语言可无条件采用的证明。

## 从资料到代码要经过的检查

资料能解释方法，实际实现还需要自己的契约。采用一个算法前，明确输入、输出和前提；实现后，保留成功样例、拒绝样例与运行时边界样例。主线的精确行为见[源码与规范导读](source.html)，例如 bool 不隐式转 int、整数溢出报错，以及保守返回分析。

本书已运行的编译器模块与后续扩展也要分开核对：词法、语法、静态语义、字节码 VM 和 C++ 目标路径已有配套实现；SSA、直接机器后端、GC、模块和 JIT 作为进阶设计与实验。完整主题地图帮助你继续学习，不意味着这一个小工程已经包含所有工业系统的功能。


## 新增：现代 AI 编译主题的延伸

第 23—25 章在传统路线之后独立增加，不改变原有主线。第 23 章讨论面向 AI 工作负载的模型图与部署链，第 24 章讨论张量程序与调度，第 25 章讨论用机器学习辅助编译决策。对应的本地延伸入口是 `dl/`、`ir/`、`llvm/`、`optimization/` 与 `code-generation/`；这些目录的论文年份与当前工具版本需分别核对。

现代工具的具体接口依照各章链接的官方文档核对，不能直接把旧论文中的 API 当成当前接口。三个专题都有无第三方依赖的 Python 小实验，供先验证流程与结果；大型框架和异构硬件实验另行标出安装与未实测边界。[张量分块实验室](tensor-lab.html)还能逐步显示调度区域与理想化数据复用。
