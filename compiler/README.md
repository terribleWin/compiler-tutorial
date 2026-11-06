# Sprout：C++11 起步的完整小型编译器

先阅读网站的“环境搭建”和“第一门语言”，再逐步查看 `src/sprout.cpp`。这份代码提供词法、语法、AST、名字解析、类型检查、字节码生成、栈式虚拟机和独立 C++ 目标源码生成；确切语言边界见 [SPEC.md](SPEC.md)。

## 直接构建

以下命令在本目录 `compiler/` 执行。终端需能找到 GCC 的 `g++` 或 Clang 的 `clang++`。

```sh
g++ -std=c++11 -Wall -Wextra -Wpedantic src/sprout.cpp -o sprout
./sprout examples/hello.spr
```

Windows PowerShell：

```powershell
g++ -std=c++11 -Wall -Wextra -Wpedantic src/sprout.cpp -o sprout.exe
.\sprout.exe examples/hello.spr
```

预期输出：

```text
7
true
```

标准库以 C++11 为基线；也可将 `-std=c++11` 替换为 `-std=c++14`、`-std=c++17`、`-std=c++20`。不需要 LLVM、Flex、Bison 或外部 C++ 依赖。构建在 GCC 上验证；MSVC 推荐通过 CMake 使用其支持的 C++14 或更新模式，MSVC 没有独立 `/std:c++11` 开关。

## 观察编译过程

```sh
./sprout --tokens examples/hello.spr
./sprout --ast examples/hello.spr
./sprout --check examples/hello.spr
./sprout --bytecode examples/hello.spr
./sprout examples/fibonacci.spr
```

最后一个程序输出 `0 1 1 2 3 5 8 13 21 34`，每个数独占一行。`examples/type-error.spr` 是故意写错的负例，应在执行前报告 `expected int, got bool`。

## 生成可以独立运行的本机程序

POSIX 终端或 PowerShell 7：

```sh
./sprout --emit-cpp examples/fibonacci.spr > program.cpp
g++ -std=c++11 program.cpp -o program
./program
```

Windows PowerShell 7 可将文件名替换为 `sprout.exe`、`program.exe`，执行文件前加 `.\`。旧版 Windows PowerShell 5.1 的 `>` 会输出 UTF-16，建议通过 Python 保存输出以确保 UTF-8：

```powershell
python -c "import subprocess,pathlib; p=subprocess.run(['./sprout.exe','--emit-cpp','examples/fibonacci.spr'],capture_output=True,check=True); pathlib.Path('program.cpp').write_bytes(p.stdout)"
g++ -std=c++11 program.cpp -o program.exe
.\program.exe
```

此处是 Sprout → C++ 源码 → 宿主编译器 → 本机程序。不能跳过第二步并把 C++ 文本直接执行。生成的文件没有对 Sprout 编译器或自定义库的依赖。

## CMake 与自动测试

```sh
cmake -S . -B build -DCMAKE_CXX_STANDARD=11
cmake --build build --config Release
ctest --test-dir build -C Release --output-on-failure
```

单配置生成器通常将程序放在 `build/sprout`；Visual Studio 多配置生成器通常放在 `build/Release/sprout.exe`。在 Windows 的 MSYS2 环境中可用 `-G "MinGW Makefiles"` 选择已安装的对应工具链；不要混用 MSYS 和 UCRT64 的编译器/库。

已有构建时，也可直接运行无依赖测试脚本：

```sh
python tests/run_tests.py ./sprout
python tests/run_tests.py ./sprout --native g++
```

第一条检查 VM、静态错误、运行时错误和观察模式。第二条额外检查生成的 C++ 在 11/14/17/20 四种模式下与 VM 输出一致，以及本机后端保留零除、溢出、死循环和递归保护。临时测试文件放在 `compiler/build/test-runs/`，运行结束自动清理。

## 从零实现时的建议顺序

1. 完成 `Token` 与 `Lexer`，只运行 `--tokens`，先验证关键字边界和注释。
2. 完成 AST 和 `Parser`，用 `1+2*3`、`20-5-2` 验证树形；暂时不运行程序。
3. 完成 `Checker`，拒绝未声明变量、错误类型和漏写返回；为名字分配槽位。
4. 完成 `Generator` 的常量、算术、打印与返回，再运行最小程序。
5. 加局部变量、分支、循环；画出跳转地址后再写回填。
6. 加函数签名表、CALL/RET 和帧；先双参数函数，再递归和互递归。
7. 加短路逻辑、资源限制和负例；不要把异常当作普通数值。
8. 最后阅读 `CppEmitter`，比较两条编译路径，做输出与陷阱的差分测试。

可执行里程碑入口、练习验收见 [LABS.md](LABS.md)。每一步都从完整语言中抽取一个可验证的小闭环，而不是先背完全部理论才开始编程。
