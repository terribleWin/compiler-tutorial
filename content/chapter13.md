# 13 三地址码、基本块与控制流图

## 本章位置与学习目标

本章开始是**扩展实验**。现有主线是 AST→字节码→VM，以及 AST→C++→本机程序；没有宣称已经实现独立三地址 IR、SSA 优化器或 RISC-V 后端。我们会从手算和小结构出发，说明怎样逐步插入这些层。前置是第 11 章的跳转和第 12 章的执行状态。

学完后，你应能给中间结果命名，划分基本块，建立 CFG 的前驱/后继，并用结构验证器发现不完整的 IR。先在纸上做对，再写程序，不必一开始就把整个编译器架构推倒重来。

## 为中间结果起名字

栈指令的输入藏在执行历史里。读到 ADD 时需要追踪此前的栈；三地址码直接写 `t3 = add t1,t2`。它通常有一个结果、最多两个显式输入。“三地址”不要求每条都恰好三项，常量、复制、调用和跳转各有自己的格式。

将 `y=(a+b)*(a-b)` 改写：

```text
t0 = add a, b
t1 = sub a, b
t2 = mul t0, t1
y = copy t2
```

当 a=7、b=2 时结果为 45。显式名字让“谁使用了 t0”变成可以直接检索的问题，也更容易发现公共子表达式。t0 只是虚拟名字，不是物理寄存器；真正放在寄存器还是内存，要等后端分配。

第一版数据结构可以只有 ValueId、BlockId、Opcode、Instruction、Terminator、Block、Function。类型存入值表，每条指令带源码位置。C++11 的结构体、枚举与 vector 足够，不需要复杂的元编程。输入个数与操作码关系最好集中验证，避免 add 意外接受一个参数。

## 基本块与花括号不同

基本块是一段顺序执行的指令：控制流从开头进入，到结尾才离开。在不考虑异常的教学 IR 中，块内部没有分支目标或中途跳转。它可以只有一条终结指令，因此源语言中的空 then 也有合法表示。

从线性指令划块时先找 leader：第一条、跳转目标、跳转或 return 后面的一条。每个 leader 开始一个块，直到下一个 leader 前结束。不可达代码也可先划块，之后再按可达性删除。

花括号表示词法作用域，基本块表示控制流。一个带 while 的源码块会拆成多个基本块；多个连续源码语句可能合在同一个基本块。不要用花括号数去猜 CFG 节点数。

## 完整实例：求 1+2+3

```sprout
fn main() -> int {
    let i = 1;
    let sum = 0;
    while (i < 4) {
        sum = sum + i;
        i = i + 1;
    }
    print(sum);
    return 0;
}
```

教学 IR 写成四块：

```text
entry:
    i = 1
    sum = 0
    jump test
test:
    c = lt i, 4
    branch c, body, exit
body:
    sum = add sum, i
    i = add i, 1
    jump test
exit:
    print sum
    return 0
```

边为 entry→test、test→body、test→exit、body→test。test 的前驱是 entry 与 body；body 和 exit 的前驱都是 test。手动沿图走，i 依次是 1、2、3，sum 依次是 1、3、6，最后输出 6。

CFG 记录结构上可能发生的跳转，不保证本次运行走遍所有边。常量分析以后也许能证明某条边不可达，但在证明之前应保留它。函数调用不是当前函数内的一条普通跳转边：它还会返回。跨函数的调用图应作为另一种结构处理。

## 终结指令是块的边界契约

每个块最后应有一个终结：jump、branch 或 return。发出 return 后不能在同一块继续追加加法。应由 IR 构造器立即拒绝这种操作，或明确开始另一个不可达块，再由后续处理删除。

把终结与普通指令分开存储会让结构更清楚。建立前驱表时遍历每个终结的目标，给目标块加入当前块。修改分支后必须更新图信息，或者清空后统一重建，不能留下“后继已经改了、前驱还是旧值”的状态。

```cpp
// 教学片段，非参考工程的已有 API。
for (const Block& b : function.blocks) {
    for (BlockId next : successors(b.terminator)) {
        predecessors[next].push_back(b.id);
    }
}
```

## 先写验证器，再写优化器

至少检查：入口存在；每块有且只有一个末尾终结；目标块都存在；输入值合法且类型相容；前驱后继互相匹配。SSA 版本还要验证单一定义与支配关系，留到第 15 章。第一版非 SSA IR 则要考虑某变量是否在所有路径上被初始化。

练习时故意把 body 的跳转目标改成不存在的编号，再删掉 exit 的 return。正确的验证器应分别指出目标无效和缺少终结，而不是等执行时崩溃。每个修改 IR 的 pass 后都运行验证器，是建立复杂优化器时非常有效的习惯。

值名、块名和源码位置应稳定可读。dump 输出 `b2: t7 = add t1,t6`，比直接打印对象内存地址更适合调试和回归测试。一个 AST 表达式展开成多条 IR 时可以共享位置；合并指令时则要有明确的来源策略。

## 实验与验收

把 `if (x<0) { print(0-x); } else { print(x); } return 0;` 划块并列边。再把两个分支都改为直接返回，观察 join 是否仍然需要。最后在求和循环里加嵌套 if，检查回边仍然回到条件块。

<details><summary>参考答案</summary>

第一版可分 entry、then、else、join，entry 分别到 then/else，它们都到 join，join 返回。若两边都直接返回，可达的 join 不再需要；具体是否保留一个不可达块取决于构造器，清理后应删除它。验收重点是边和行为准确，不是强行让块数量等于某个固定答案。

</details>

## 来源与后续

本地 `compilers-resources/material/llvm/LLVM IR Tutorial (2019 LLVM Developers Conference).pdf` 第 3—7 页介绍 IR 层次与目标信息；`compilers-papers-we-love/ir/TOPLAS1991 Efficiently Computing Static Single Assignment Form and the Control Dependence Graph.pdf` 第 1—3 页讨论表示方式为何影响优化。[LLVM 语言参考](https://llvm.org/docs/LangRef.html) 可查块和函数的精确定义。下一章在 CFG 上计算活跃变量。
