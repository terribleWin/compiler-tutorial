# 交互实验室：看见表达式的编译过程

输入一段整数算术表达式，观察字符如何变成 Token、AST 和栈式字节码，再逐条执行。这是专为演示设计的浏览器微型编译器，支持 `+ - * / %`、一元正负号、括号和 int32 检查。它不支持完整 Sprout 的变量、函数、布尔或控制流；完整实现请下载 C++ 源码。

实验额外接受一元正号 `+3`，便于观察前缀运算；完整 Sprout 不接受一元 `+`，迁移表达式时应去掉它。两者采用相同的 int32 算术边界：`-2147483648 / -1` 报溢出，`-2147483648 % -1` 得到 0；正字面量 `2147483648` 本身无效，因此 `-(2147483648)` 也会被拒绝。实验中的 `ADD`、`MUL` 等是便于阅读的教学指令名，真实编译器使用 `+`、`*` 等操作码。

<div class="lab-box">
<label for="expression">源表达式</label>
<textarea id="expression" spellcheck="false" aria-describedby="lab-description">2 + 3 * (4 - 1)</textarea>
<p id="lab-description" class="tiny">修改表达式后重新编译。整数除法向零截断，溢出与除零会停止执行。</p>
<div class="lab-samples"><button type="button" data-expression="2 + 3 * 4">优先级</button><button type="button" data-expression="(2 + 3) * 4">改变结合</button><button type="button" data-expression="20 - 5 - 3">左结合</button><button type="button" data-expression="-7 / 2">整数除法</button><button type="button" data-expression="1 / (3 - 3)">除零诊断</button><button type="button" data-expression="2147483647 + 1">溢出诊断</button></div>
<div class="lab-controls"><button type="button" id="compile">编译</button><button type="button" id="step">执行一步</button><button type="button" id="run">运行到底</button><button type="button" id="reset">重置执行</button></div>
<div class="lab-error" id="lab-error" role="alert"></div>
<div class="lab-tabs" role="tablist" aria-label="编译阶段"><button type="button" id="tab-tokens" role="tab" aria-selected="true" aria-controls="lab-output" data-tab="tokens">Token</button><button type="button" id="tab-ast" role="tab" aria-selected="false" aria-controls="lab-output" data-tab="ast">AST</button><button type="button" id="tab-bytecode" role="tab" aria-selected="false" aria-controls="lab-output" data-tab="bytecode">字节码</button></div>
<pre class="lab-output" id="lab-output" role="tabpanel" aria-label="所选编译阶段输出"></pre>
<div class="lab-status" aria-live="polite"><span>PC <strong id="lab-pc">0</strong></span><span>栈 <strong id="lab-stack">[]</strong></span><span>结果 <strong id="lab-result">—</strong></span></div>
<div class="table-scroll lab-trace"><table><thead><tr><th>PC</th><th>执行指令</th><th>执行前栈</th><th>执行后栈</th></tr></thead><tbody id="trace-body"></tbody></table></div>
</div>
<script defer src="assets/lab.js"></script>

## 先预测，再点击

默认输入 `2 + 3 * (4 - 1)` 的结果为 11。AST 的根是加法，右子树是乘法，而减法位于乘法的右子树。编译器先为子表达式产生指令，再产生当前运算的指令，所以不需要 VM 再理解括号或运算符优先级。

```text
PUSH 2      栈 [2]
PUSH 3      栈 [2, 3]
PUSH 4      栈 [2, 3, 4]
PUSH 1      栈 [2, 3, 4, 1]
SUB         栈 [2, 3, 3]
MUL         栈 [2, 9]
ADD         栈 [11]
```

执行 `SUB` 时，先弹出右操作数 1，再弹出左操作数 4，计算的是 `4 - 1`。把顺序写反不会影响加法与乘法，却会破坏减法、除法和比较，因此测试不能只用交换律成立的运算。

## 三个小实验

1. 输入 `20 - 5 - 3`。结果为什么是 12 而不是 18？对比 AST 的左右子树。
2. 输入 `-7 / 2`。为什么结果是 -3？如果使用向下取整将得到什么？
3. 输入 `1 / (3 - 3)`。Token 和 AST 都合法，为什么执行时仍失败？

<details>
<summary>展开解释</summary>

减法在文法中为左结合，所以树表示 `(20 - 5) - 3`。整数除法向零截断，-3.5 截为 -3；向下取整则是 -4。除零需要知道运行时操作数，当前实验把它作为 VM 陷阱，而不是语法错误。更强的优化器可以提前发现常量除零，但必须保持语言所规定的失败行为。

</details>

## 用本地编译器重做实验

把表达式放入 `fn main() -> int { print(表达式); return 0; }`，运行 `sprout --tokens`、`--ast`、`--bytecode` 和默认执行模式。浏览器微型实验的输出格式不承诺与 C++ 参考实现逐字相同；比较的重点是结构、求值顺序和计算结果。

下一步阅读[第 7 章：递归下降](chapter07.html)和[第 11 章：字节码生成](chapter11.html)，自己实现实验中观察到的过程。
