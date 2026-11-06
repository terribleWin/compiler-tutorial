# Sprout 语言与工具契约 · v1

这份规范描述随教学网站交付、已经实现的语言。主线实现是 `src/sprout.cpp`。它不是 C++ 编译器，也不是完整的 SysY 实现：C++ 是编写编译器所用的宿主语言，Sprout 才是被编译的源语言。

## 1. 最小完整程序

```text
fn main() -> int {
    print(1 + 2 * 3);
    return 0;
}
```

输出 `7`，换行。文件建议使用 `.spr` 后缀，保存为无 BOM 的 UTF-8；非注释文本使用 ASCII 字符。扩展名不参与语法判断。每个程序必须定义且只能定义一个 `fn main() -> int`，不接受参数。正常返回时主函数的返回值被忽略，宿主进程返回 0。

## 2. 命令行

```text
sprout file.spr                    # 默认：编译到内存字节码，然后执行
sprout --run file.spr              # 与默认相同
sprout --tokens file.spr           # 仅词法扫描；行:列、种类、拼写
sprout --ast file.spr              # 解析并完成静态检查后打印 AST
sprout --bytecode file.spr         # 打印各函数的字节码
sprout --check file.spr            # 静态检查，通过时输出 OK
sprout --emit-cpp file.spr         # 独立 C++11 目标源码写到标准输出
sprout --help
```

没有参数或参数数目不正确返回 2；`--help` 返回 0。成功执行、展示或检查返回 0。词法、语法、语义、运行错误返回 1，错误写到标准错误流；无法打开文件、未知双参数选项返回 2。`--tokens` 只验证词法，不保证语法正确。其余观察模式均要求静态检查通过。AST、字节码文本供教学观察，格式不作为稳定的机器接口。

## 3. 词法

- 标识符：`[A-Za-z_][A-Za-z_0-9]*`，大小写敏感；关键字不能作标识符。
- 关键字：`fn let if else while return print int bool true false`。
- 整数字面量：十进制 `[0-9]+`，`010` 仍是十进制 10。无十六进制、浮点数、字符串或字符字面量。
- 空白：空格、Tab、CR、LF。Tab 的列计数为一个字符；CRLF 换行只增加一次行号。
- 注释：`//` 到行尾，可包含中文；不支持 `/* ... */` 块注释。
- 分隔符：`( ) { } : ; ,`。运算符优先匹配两个字符，如 `<=`、`!=`、`->`。
- 位置从第 1 行、第 1 列开始。未知字符立即拒绝，不做词法错误恢复。

`int` 取值范围为 -2147483648 到 2147483647。`-2147483648` 被专门接受；`2147483648` 单独出现或 `-(2147483648)` 均拒绝。在实现中，一元负号直接跟数字时会合并为一个带符号数值节点；因此 AST 不必逐字保留源程序拼写。

## 4. 文法

下面采用 EBNF：`{ X }` 表示重复零次或多次，`[ X ]` 表示可选，带引号的是实际字符。

```text
program     = { function } EOF ;
function    = "fn" identifier "(" [ parameters ] ")" "->" type block ;
parameters  = parameter { "," parameter } ;
parameter   = identifier ":" type ;
type        = "int" | "bool" ;
block       = "{" { statement } "}" ;
statement   = block
            | "let" identifier "=" expression ";"
            | identifier "=" expression ";"
            | "print" "(" expression ")" ";"
            | "if" "(" expression ")" block [ "else" block ]
            | "while" "(" expression ")" block
            | "return" expression ";"
            | expression ";" ;
expression  = logicalOr ;
logicalOr   = logicalAnd { "||" logicalAnd } ;
logicalAnd  = equality { "&&" equality } ;
equality    = comparison { ("==" | "!=") comparison } ;
comparison  = additive { ("<" | "<=" | ">" | ">=") additive } ;
additive    = product { ("+" | "-") product } ;
product     = unary { ("*" | "/" | "%") unary } ;
unary       = ("-" | "!") unary | primary ;
primary     = integer | "true" | "false" | identifier
            | identifier "(" [ arguments ] ")"
            | "(" expression ")" ;
arguments   = expression { "," expression } ;
```

函数只允许在顶层定义，不能嵌套；没有全局变量。`if`、`while` 必须写圆括号和花括号。`else if` 不是简写语法，应写为 `else { if (...) { ... } }`。不允许空语句 `;`、空 `return;`、尾逗号或 `let x: int = ...` 类型标注。

## 5. 类型、名字和控制流

`int` 和 `bool` 是不同类型，不隐式转换。`print` 接受两种类型，分别输出十进制整数或 `true` / `false`，每次换行。没有 `void`，所有函数都必须返回声明的类型。

| 表达式 | 操作数 | 结果 |
| --- | --- | --- |
| `+ - * / %`，一元 `-` | int | int |
| `< <= > >=` | int、int | bool |
| `== !=` | 两个相同类型的值 | bool |
| `!`、`&&`、`||` | bool | bool |
| `if`、`while` 条件 | bool | 控制流 |

所有二元运算符都左结合。`1 < 2 < 3` 会先得到 bool 再拿它与 int 比较，因而类型错误；应使用 `(1 < 2) && (2 < 3)`。赋值是语句，不能嵌入表达式。

每个函数拥有独立的局部变量帧。`let` 根据初始化表达式推断类型，必须初始化；之后可以赋同类型新值。同一个块中不能重复声明名字。函数参数与函数最外层花括号处于同一作用域，所以 `fn f(x: int) -> int { let x = 1; ... }` 会拒绝。内层块可遮蔽外层名字。

```text
fn main() -> int {
    let x = 10;
    {
        let x = x + 1; // 先分析右侧，读取外层 x；之后引入内层 x
        print(x);      // 11
    }
    print(x);          // 10
    return 0;
}
```

函数签名先集中登记，再检查函数体，支持前向调用、直接递归和互递归。函数和局部变量使用分开的名字空间，`f(...)` 始终按函数名解析。没有函数值、闭包、指针、引用、数组、结构体或模块。

静态返回检查采用保守规则：`return` 保证返回；`if/else` 两支都保证返回时整个语句保证返回；块中某个语句保证返回时整个块保证返回；`while` 永远不被当作保证返回，即使条件是 `true`。因此 `while (true) { return 1; }` 后面还需要一个静态可见的 `return`。不可达语句仍接受静态检查；本版本不报告不可达代码警告，也不进行常量条件推理。

## 6. 运行语义

- 所有表达式和函数实参按从左到右的顺序求值。
- `&&` 左侧为 false 时跳过右侧；`||` 左侧为 true 时跳过右侧。被跳过的表达式仍必须通过静态检查。
- 整数加减乘、一元负号、除法先使用足够宽的宿主 `int64_t` 计算，再检查 int32 范围。越界立即报错，不回绕，不触发宿主 C++ 有符号溢出。
- `/`、`%` 的零除数报错。整数除法向零截断，例如 `-7 / 3 == -2`；余数与被除数同号，例如 `-7 % 3 == -1`。
- `-2147483648 / -1` 报溢出；`-2147483648 % -1` 得到 0。
- 函数参数按值传递。局部变量和临时操作数栈在返回时释放。
- 表达式语句计算结果后丢弃；`return` 立即结束当前函数。

为了让错误示例能安全结束，本版本限制源文件不超过 1 MiB、解析器活动嵌套层数不超过 256、表达式 AST 高度不超过 128、函数调用深度不超过 256。字节码 VM 在整个程序累计执行超过 1000000 条指令时报错；生成的 C++ 后端在语句和循环检查点计数，同样采用 1000000 上限。**两个后端检查点粒度不同，因此接近资源上限的程序可能在不同位置停止；资源限制不属于跨后端等价承诺。** 单个源语法嵌套会占多个解析函数层数，256 不是允许 256 对括号的承诺。

## 7. 字节码与调用约定

每个函数独立拥有一段指令、参数数和局部变量槽位数。地址是该函数内的指令下标。编译期间每个声明分配一个槽位，退出作用域后不复用槽位，便于观察；循环再次执行相同声明时覆盖原槽位。

| 指令 | 操作数栈变化与行为 |
| --- | --- |
| `PUSH n` | 压入整数或用 0/1 表示的 bool |
| `LOAD slot` | 读取当前帧局部值并压栈 |
| `STORE slot` | 弹出一个值，保存到当前帧 |
| `POP` | 丢弃栈顶 |
| `NEG`、`NOT` | 弹出一元操作数，压回结果 |
| `+ - * / % < <= > >= == !=` | 先弹右值，再弹左值，压回结果 |
| `JMP address` | 无条件跳转 |
| `JZ address` | 弹出 bool；为 false 时跳转 |
| `CALL function` | 按签名弹出 N 个参数；建立帧；返回值压回调用者栈 |
| `RET` | 弹出结果并返回调用者 |
| `PRINT_INT`、`PRINT_BOOL` | 弹出值并打印 |

没有独立 `AND` / `OR` 指令：它们由条件跳转实现。VM 内用 `int64_t` 保存值，但静态检查和运行时检查确保 Sprout 可观察的 int 始终为 int32。此实现的字节码在内存中使用 `Instruction` 数组，没有字节流文件格式、装载器或不可信字节码校验器；不能把 `--bytecode` 文本输出当成可执行文件。

## 8. 两条完整编译路径

```text
源文件 → Lexer → Parser/AST → Checker → Generator → 字节码 → VM → 程序输出
                                    └→ CppEmitter → C++11目标源码
                                                     ↓ g++ / clang++ / MSVC
                                                  本机可执行文件
```

第二条是源码到源码编译，复用宿主工具链的寄存器分配、机器码生成、汇编和链接能力。生成器先将子表达式保存到临时变量，再调用 C++ 函数，避免依赖 C++11 未规定的函数实参求值顺序。输出不依赖 Sprout 编译器的头文件或库；整个目标文件可独立构建。

本版本没有实现 SSA 优化器、LLVM 后端、直接 x86/RISC-V 机器码后端、汇编器或链接器。网站进阶章节讨论这些知识，并把它们作为在现有前后端之间继续扩展的任务，不宣称这些模块已经存在于主线代码中。

## 9. 源码阅读地图

| 符号 | 阅读问题 |
| --- | --- |
| `Pos`、`Error`、`Token` | 如何把错误和原始源位置关联？ |
| `Lexer::scan` | 为什么先读完整标识符再识别关键字？ |
| `Expr`、`Stmt`、`Function` | 哪些字段在解析后还没有填好？ |
| `Parser::expression` | 为什么右侧递归使用 `precedence + 1`？ |
| `Checker::check` | 为何先建全部函数签名再分析函数体？ |
| `Checker::expr`、`Checker::stmt` | 如何把名字替换为槽位/函数编号？ |
| `Generator::expr`、`Generator::stmt` | 哪些跳转地址要回填？ |
| `checked`、`binary`、`VM::call` | 如何同时保证算术语义和调用帧隔离？ |
| `CppEmitter::expr` | 为什么为每个中间值生成临时变量？ |
| `main` | 为什么需要在创建 Lexer 之前保留源字符串的生命周期？ |

完整代码采用一个文件方便复制、浏览和定位，各阶段由注释分开。后续练习可以拆成头文件/源文件，但拆分不是理解编译流程的前置条件。

## 10. 资料来源边界

课程组织参考了用户本地资源库的 `projects/README.md`、`projects/lexer/README.md`、`projects/parser/README.md`、`projects/code-generator/README.md`：它们将词法、语法、代码生成和 VM 作为分阶段任务，并强调规格和测试用例。编译器源码、语言规范和测试均为本教程原创实现；没有复制或再分发资料库的教材 PDF。
