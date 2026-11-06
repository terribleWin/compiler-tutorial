# 配套源码：把整条主线运行一遍

参考实现是一份可以完整阅读的 C++11 源文件，包含 Lexer、Parser、AST、Checker、字节码 Generator、VM 和 CppEmitter。它面向教学，优先把阶段边界、检查和求值顺序写清楚。

- [下载源码与示例、测试和规范](downloads/sprout-source.zip)
- [直接阅读完整实现](implementation.html)
- [完整语言规范](spec.html)与[从零实现的八个实验](exercises.html)
- [下载单文件 sprout.cpp](downloads/sprout.cpp)
- [GitHub 仓库](https://github.com/terribleWin/compiler-tutorial)

压缩包内有完整的 `compiler/` 目录，以下命令从课程仓库根目录执行；只下载源码包时，也应在包含 `compiler/` 的目录执行。示例中的 `.spr` 是约定后缀，扩展名本身不影响解析。

## 1. 构建与第一个程序

```bash
g++ -std=c++11 -Wall -Wextra -Wpedantic compiler/src/sprout.cpp -o sprout
./sprout compiler/examples/hello.spr
```

Windows PowerShell：

```powershell
g++ -std=c++11 -Wall -Wextra -Wpedantic compiler/src/sprout.cpp -o sprout.exe
.\sprout.exe compiler/examples/hello.spr
```

随包 `hello.spr` 输出两行：

```text
7
true
```

首页的 42 示例是另一份最小程序；输出取决于实际输入文件，不要把不同示例的结果混在一起。

## 2. 观察每个阶段

```bash
./sprout --tokens compiler/examples/hello.spr
./sprout --ast compiler/examples/hello.spr
./sprout --check compiler/examples/hello.spr
./sprout --bytecode compiler/examples/hello.spr
./sprout compiler/examples/fibonacci.spr
```

`--check` 通过时输出 `OK`。`--tokens` 只做词法扫描；其余观察模式先完成静态检查。Fibonacci 示例输出前十项，每项独占一行，从 0、1 开始。若只想验证 `fib(10) == 55`，需要把调用改为 `print(fib(10));`。

成功返回进程码 0；编译或运行错误返回 1；文件与命令行使用错误返回 2。Sprout 的 `main` 必须返回 int，但正常返回值不作为宿主进程的退出码。

## 3. 获得本机可执行程序

在 POSIX 终端或 PowerShell 7 中：

```bash
./sprout --emit-cpp compiler/examples/fibonacci.spr > program.cpp
g++ -std=c++11 program.cpp -o program
./program
```

Windows 把可执行文件名改为 `sprout.exe`、`program.exe`。旧版 Windows PowerShell 5.1 的重定向默认编码不适合这里，可让 Python 原样保存输出字节：

```powershell
python -c "import subprocess,pathlib; r=subprocess.run(['./sprout.exe','--emit-cpp','compiler/examples/fibonacci.spr'],capture_output=True,check=True); pathlib.Path('program.cpp').write_bytes(r.stdout)"
g++ -std=c++11 program.cpp -o program.exe
.\program.exe
```

生成的源码不依赖 Sprout 编译器或额外运行库。这个后端把 Sprout 翻译为 C++，再由宿主编译器完成机器码生成和链接。它与直接发射汇编的实验路线有所不同，各自完成的步骤在第 17–19 章说明。

## 4. 用 CMake 构建

```bash
cmake -S compiler -B compiler/build -DCMAKE_CXX_STANDARD=11
cmake --build compiler/build --config Release
ctest --test-dir compiler/build -C Release --output-on-failure
```

单配置构建通常在 `compiler/build/sprout` 或 `sprout.exe`；Visual Studio 多配置通常在 `compiler/build/Release/sprout.exe`。C++ 标准可改成 14、17、20，MSVC 的最低显式模式是 C++14。

## 5. 运行行为测试

```bash
python compiler/tests/run_tests.py ./sprout
python compiler/tests/run_tests.py ./sprout --native g++
```

这些检查覆盖优先级、左结合、名字遮蔽、循环、递归、互递归、左右求值顺序、短路、副作用、类型拒绝、整数边界、除零与资源上限。`--native g++` 还构建并运行生成的 C++，包括四个标准模式下的差分检查。Windows 参数改为 `./sprout.exe`。

## 6. 读代码时抓住这些接口

| 符号 | 输入 → 输出 | 推荐章节 |
| --- | --- | --- |
| `Lexer::scan` | 源文本 → Token 序列 | 第 5、6 章 |
| `Parser` | Token → 语法树和函数集合 | 第 7–9 章 |
| `Checker` | AST → 类型、绑定和槽位信息 | 第 10 章 |
| `Generator` | 已检查 AST → 每个函数的字节码 | 第 11 章 |
| `VM` | 字节码 → 输出或运行陷阱 | 第 12 章 |
| `CppEmitter` | 已检查 AST → 独立 C++ 源码 | 第 17、20 章 |

可以在完整源码页使用浏览器查找类名。源码块提供行号、换行、放大与复制；复制不会包含行号。返回源码包查看 `SPEC.md` 获取全部边界条件，查看 `LABS.md` 获取分阶段验收任务。

## 7. 已知限制也属于规范

本实现没有字符串、数组、全局变量、结构体、闭包或文件 IO。没有 SSA 优化器、直接机器码后端、字节码文件装载器或不可信字节码验证器。`--bytecode` 是供阅读的文本，不能交给 VM 当作文件执行。

所有算术值按 int32 检查，bool 不与 int 隐式转换。函数必须静态保证返回；`while` 即使条件恒为 true，也不计为“保证返回”。源文件、语法深度、调用深度和执行量有上限；VM 的指令步数与 C++ 后端的检查点粒度不同，接近资源上限的程序不承诺在同一位置停止。

理解边界后，再按[结业路线](roadmap.html)添加一个新功能。修改前先运行全部测试，修改后补上新功能的成功与失败样例。


## 新增 AI 专题的独立实验

源码压缩包还包含 `compiler/experiments/`：第 23 章的小型 AI 图编译链、第 24 章的矩阵乘调度、第 25 章的自动调优与学习式代价模型。它们用 Python 标准库演示现代编译方法，不把 Python 循环计时当作原生内核或 GPU 性能结论。具体命令、断言和实验边界以三章正文说明为准。

也可分别下载：[AI 图编译链实验](downloads/ai_pipeline_demo.py)、[张量调度实验](downloads/tensor_schedule_demo.py)、[自动调优实验](downloads/ai_tuning_demo.py)。
