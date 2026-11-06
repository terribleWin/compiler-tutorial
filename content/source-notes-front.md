# 前端课程资料读取记录

这份记录说明第01—10章的实际阅读边界。资料库很大，课程没有声称逐页读完全部电子书和论文。目录检索用于确定覆盖主题；下面表格中的具体页段和文本才属于本次实际读取的内容。教材 PDF 没有复制进网站，课程中的解释、程序、文法与演算表为重新组织或独立推导。

## 本地读取

路径前缀分别是 `F:/NJU-compiler/compilers-resources/` 与 `F:/NJU-compiler/compilers-papers-we-love/`。PDF 使用本机 pdftotext 进行文本提取，本次研究关注算法与教学内容，没有据此复刻原图版式。

| 资料 | 实际范围 | 采用方式 |
| --- | --- | --- |
| `compilers-resources/projects/README.md` | 全文 | 找到增量式编译器项目原始入口 |
| `compilers-resources/projects/lexer/README.md` | 全文 | 学习规格、测试与多语言参考分开的实践组织 |
| `compilers-resources/projects/parser/README.md` | 全文 | 确认语法分析实践资源入口 |
| `compilers-papers-we-love/parsing/README.md` | 全文 | 确认 Ford 的 Packrat/PEG 第一手资料入口 |
| `compilers-papers-we-love/teaching/Scheme2006 An Incremental Approach to Compiler Construction.pdf` | PDF 第1—4页文本 | 摘要、面向新手的增量开发、测试基础设施与逐步扩展思想；没有照搬 Scheme/x86 实现 |
| `compilers-papers-we-love/parsing/InformationAndControl (1965 Knuth) On the Translation of Languages from Left to Right.pdf` | PDF 第1—2页文本 | LR(k) 问题背景、文法与从左到右分析的定义背景；未将整篇定理证明称作已研读 |
| `compilers-resources/material/re-nfa-dfa/REToC Step-by-step Conversion of Regular Expressions to C Code.pdf` | PDF 第1—4页文本 | 正则按结构拆解为 Thompson 小机器的教学顺序；第06章另用原创例子完整手算 |
| `compilers-resources/material/re-nfa-dfa/Minimizing Finite Automata (eecs.berkeley.edu).pdf` | 全文3页文本 | 不可区分状态、表填充最小化、正确性与 O(字母表大小×状态数²)复杂度 |
| `compilers-resources/material/attributed-grammars/Attributed Grammars (cs.uiowa.edu).pdf` | PDF 第1—3页，对应原书第59—61页 | CFG 与上下文约束区分、综合/继承信息、树上属性约束 |

此外检索了两个库的相关目录，确认自动机、LL/LR、CYK/Earley、属性文法、类型系统与教学论文的覆盖范围。章节中标为“后续导读”的目录条目只表示可继续阅读的资源，不表示本次逐篇读取。

## 公开第一手资料与核对方式

网页在2026年11月6日通过网络工具检索；部分直接抓取遇到超时，随后通过原作者或官方域名的搜索结果核对主题及入口。未引用非官方博客作为算法结论依据。章节末的“延伸阅读”允许指向尚未完整阅读的官方资料，不能与本次实际精读记录混淆。

| 入口 | 用途 |
| --- | --- |
| [Crafting Interpreters：Scanning](https://craftinginterpreters.com/scanning.html) | 核对扫描与关键字/标识符的教学入口 |
| [Crafting Interpreters：Parsing Expressions](https://craftinginterpreters.com/parsing-expressions.html) | 核对优先级、递归下降和错误恢复主题 |
| [Crafting Interpreters：Compiling Expressions](https://craftinginterpreters.com/compiling-expressions.html) | 核对扫描、字节码编译与VM的闭环结构 |
| [Crafting Interpreters：Resolving and Binding](https://craftinginterpreters.com/resolving-and-binding.html) | 核对词法作用域、声明与绑定主题；Sprout初始化规则独立规定 |
| [CMake CXX_STANDARD](https://cmake.org/cmake/help/latest/prop_tgt/CXX_STANDARD.html) | 核对标准模式、REQUIRED与EXTENSIONS属性 |
| [GNU Bison Shift/Reduce](https://www.gnu.org/s/bison/manual/html_node/Shift_002fReduce.html) | 核对移进归约冲突与悬挂else讨论 |
| [Standard C++ C++14 FAQ](https://isocpp.org/wiki/faq/cpp14-library) | 核对make_unique的C++14版本边界 |
| [Microsoft unique_ptr](https://learn.microsoft.com/en-us/cpp/cpp/how-to-create-and-use-unique-ptr-instances) | 核对唯一所有权与移动语义入门解释 |
| [LLVM 前端教程](https://llvm.org/docs/tutorial/MyFirstLanguageFrontend/index.html) | 核对手写前端与AST主题入口 |
| [Clang Expressive Diagnostics](https://clang.llvm.org/diagnostics.html) | 核对诊断关注位置、原因与相关语境的工程方向 |

## 实现一致性核对

前10章已经与配套 `compiler/SPEC.md` 核对：CLI、int32/bool、main约束、短路、前向调用、局部遮蔽、初始化读取外层、参数与最外层body同作用域、直接最小负字面量、else必须块、保守返回分析。分层递归下降片段属于教学算法；参考实现使用优先级爬升处理二元表达式，二者树形与语义目标相同。

前半教程包含有意写错的程序与不完整教学片段，均以语境或“教学片段”标记。它们不能被当作可替换参考实现源码的补丁。完整合法的Sprout例子适合提取后运行，错误例子适合检查诊断。
