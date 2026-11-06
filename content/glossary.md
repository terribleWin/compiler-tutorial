# 术语速查：先用一句话抓住含义

同一个“CFG”可能指上下文无关文法，也可能指控制流图。本书按章节语境区分；遇到缩写先问它描述的是语法结构，还是程序执行路径。

## 字符到结构

| 中文 | 英文 | 直观解释与阅读入口 |
| --- | --- | --- |
| 词素 | lexeme | 源码里实际出现的一段拼写，如 `count` |
| 词法单元 | token | 拼写加种类和位置，交给 Parser 的输入；[第 5 章](chapter05.html) |
| 最长匹配 | maximal munch | 在当前位置尽可能读出最长合法词素，如先识别 `>=` |
| 正则表达式 | regular expression | 描述标识符、整数等局部字符模式的规则 |
| 非确定有限自动机 | NFA | 一次输入可能有多个候选状态，也可能走 ε 边 |
| 确定有限自动机 | DFA | 每个状态对一个输入字符至多有一个后继；[第 6 章](chapter06.html) |
| ε 闭包 | epsilon closure | 不消费字符，沿任意条 ε 边可到达的状态集合 |
| 上下文无关文法 | context-free grammar | 用产生式定义括号、语句、表达式等递归结构 |
| 终结符 | terminal | 文法中不能继续展开的基本符号，通常对应 Token |
| 非终结符 | nonterminal | 可以用产生式继续展开的语法类别 |
| 二义性 | ambiguity | 同一输入具有两种不同语法树 |
| 左递归 | left recursion | 展开后最左边又出现自身，朴素递归下降可能不消费输入就递归 |
| FIRST / FOLLOW | first / follow set | 可作为开头的终结符集合，以及可跟在某非终结符后面的终结符集合 |
| 移进 / 归约 | shift / reduce | LR 中把输入压栈，或把产生式右部替换成左部；[第 8 章](chapter08.html) |
| 抽象语法树 | AST | 去掉括号等表面细节后保留程序结构的树；[第 9 章](chapter09.html) |
| 具体语法树 | CST | 更贴近文法和源码拼写的树，适合格式化与源码工具 |
| 属性文法 | attribute grammar | 给语法节点附加计算规则，如类型从孩子汇总、环境向孩子传递 |

## 结构到含义

| 中文 | 英文 | 直观解释与阅读入口 |
| --- | --- | --- |
| 绑定 | binding | 把某个名字的使用关联到唯一声明 |
| 符号表 | symbol table | 保存名字、类型、位置、槽位等编译期信息 |
| 作用域 | scope | 一条声明在哪段源码中可见 |
| 遮蔽 | shadowing | 内层声明暂时盖住同名外层声明；[第 10 章](chapter10.html) |
| 静态语义 | static semantics | 运行之前可检查的约束，如变量已声明、类型匹配 |
| 动态语义 | dynamic semantics | 程序实际执行时的含义，如求值顺序和异常 |
| 左值 | lvalue | 可被写入的位置概念，本书主线赋值目标限为变量 |
| 短路 | short-circuit evaluation | 左操作数已能决定结果时不计算右操作数 |
| 未定义行为 | undefined behavior | 语言规范不再约束程序结果的情形；Sprout 用检查来避免整数溢出落入宿主 UB |
| 不变量 | invariant | 在某个阶段必须持续成立的条件，如每个变量使用都已绑定 |
| 健全性 | soundness | 分析结果保证不会漏掉其声称能排除的错误；保守分析可产生额外拒绝 |

## 中间层与优化

| 中文 | 英文 | 直观解释与阅读入口 |
| --- | --- | --- |
| 中间表示 | IR | 适合分析和变换、位于源码与目标代码之间的形式 |
| 降低 | lowering | 把高级操作转换成更基础的操作，如把 `for` 改写成 `while` |
| 字节码 | bytecode | 给虚拟机执行的指令，本书用内存指令数组表示；[第 11 章](chapter11.html) |
| 操作数栈 | operand stack | 保存中间计算值，不等于所有机器上的硬件栈 |
| 调用帧 | call frame | 一次函数调用的参数、局部值和返回状态；[第 12 章](chapter12.html) |
| 三地址码 | three-address code | 一条常见计算写成 `t = a op b`，显式命名临时值 |
| 基本块 | basic block | 单入口、内部没有分支跳出的顺序指令段 |
| 控制流图 | control-flow graph | 基本块为点、可能跳转为边的图；[第 13 章](chapter13.html) |
| 数据流分析 | data-flow analysis | 沿 CFG 传播抽象信息，如变量是否活跃 |
| 不动点 | fixed point | 再应用传递规则，信息已不再变化；[第 14 章](chapter14.html) |
| 支配 | dominance | 从入口到 B 的每条路径都经过 A，则 A 支配 B |
| SSA | static single assignment | 每个变量版本只定义一次；不同路径的值用 φ 合并 |
| φ 节点 | phi node | 根据实际进入的前驱边选择对应值；[第 15 章](chapter15.html) |
| 公共子表达式消除 | CSE | 在合法条件下重用之前计算的同一表达式 |
| 死代码消除 | DCE | 删除结果不用、且没有可观察影响的计算 |
| pass | compiler pass | 进行一次分析或变换的阶段；[第 16 章](chapter16.html) |
| 别名 | aliasing | 两个看似不同的引用可能指向同一存储位置 |

## 后端与工程

| 中文 | 英文 | 直观解释与阅读入口 |
| --- | --- | --- |
| 指令选择 | instruction selection | 把 IR 操作匹配到目标指令 |
| 活跃区间 | live interval | 线性指令次序中一个值可能仍会使用的区段 |
| 寄存器分配 | register allocation | 把大量虚拟值放入有限物理寄存器 |
| 溢出到栈 | spill | 寄存器不足时把值保存到内存；[第 17 章](chapter17.html) |
| ABI | application binary interface | 函数参数、返回值、寄存器和数据布局等二进制约定 |
| 重定位 | relocation | 链接器确定地址后修补引用位置 |
| 垃圾回收 | garbage collection | 运行时回收不再能被程序访问的对象；[第 18 章](chapter18.html) |
| AOT / JIT | ahead-of-time / just-in-time | 提前编译和运行时即时编译 |
| 目标三元组 | target triple | 工具链描述目标架构、供应商、操作系统/环境的标识；[第 19 章](chapter19.html) |
| 差分测试 | differential testing | 比较两个实现或两种编译路径的可观察行为 |
| 蜕变测试 | metamorphic testing | 对有已知关系的输入做变换，检查输出关系 |
| 模糊测试 | fuzzing | 自动生成或变异大量输入，发现崩溃与错误 |
| 缩减 | reduction | 将失败程序缩成仍能复现的最小例子；[第 21 章](chapter21.html) |
| 自举 | bootstrapping | 用语言自身编写的编译器编译自己；[第 22 章](chapter22.html) |

这些解释用于入门定位。精确定义、成立条件和反例应回到相应章节，不要仅凭一个术语名称决定优化或实现。
