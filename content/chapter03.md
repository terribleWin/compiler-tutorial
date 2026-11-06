# 第03章 建立能重复构建与测试的工程

## 本章目标与前置

你已经能运行一个简单 C++ 程序。本章要把“在我的电脑上偶然成功”变成“换一个构建目录仍然得到相同结果”。完成后，你应拥有源码目录、独立构建目录、一个能执行 Sprout 的工具，以及一组能自动区分成功和失败的测试。

所有命令都以项目的 `compiler` 目录为当前目录。先确认你能看见 `src/sprout.cpp` 和 `CMakeLists.txt`，再运行命令。构建输出留在 `build` 中，练习文件留在自己的实验目录中；不要修改原始参考资料库。

## 3.1 四种文件各自承担什么角色

| 文件或目录 | 用途 | 出问题时首先检查 |
| --- | --- | --- |
| `src/sprout.cpp` | 编译器源码 | C++ 编译错误 |
| `examples/` | 输入给编译器的示例程序 | Sprout 语言行为 |
| `build/` | CMake 配置和构建结果 | 编译器选择、生成器、缓存 |
| 你新建的 `hello.spr` | 自己的源程序 | 文本内容、保存路径、编码 |

编译器源码出错时，报错来自 g++、Clang 或 MSVC；Sprout 文件出错时，报错来自我们构建出的 `sprout`。排错前先确认是谁在报告问题，能省去很多无效修改。

## 3.2 先走一条最短构建路径

如果你已有 g++，可以直接构建，以排除构建系统配置造成的干扰：

```text
g++ -std=c++11 -Wall -Wextra -pedantic src/sprout.cpp -o sprout
./sprout --check hello.spr
./sprout hello.spr
```

`-std=c++11` 选择实现语言标准；`-Wall -Wextra` 打开常用警告；`-pedantic` 帮助发现依赖扩展的写法；`-o` 指定输出文件。Windows 上可以把输出名写成 `sprout.exe`。如果命令提示找不到 g++，先安装工具链或切换到已安装的编译器，不要通过删改源码“修复”命令不存在的问题。

Windows 可使用 MSYS2 UCRT64 的 GCC，或 Visual Studio 的 C++ 开发工具。macOS 可使用 Xcode Command Line Tools 提供的 Clang。Linux 可使用发行版提供的 GCC 或 Clang。安装步骤随平台变化，因此本课程把安装后的验收固定为“能显示版本、能构建第02章程序、能执行生成的程序”。请优先按照工具的官方安装文档操作。

## 3.3 使用 CMake 分离配置与构建

推荐的通用流程：

```text
cmake -S . -B build -DCMAKE_CXX_STANDARD=11
cmake --build build --config Release
```

第一行读取当前源码目录，在 `build` 中生成构建文件。第二行调用实际构建工具。`--config Release` 用于支持多配置的生成器；对于单配置生成器，可以在配置阶段添加 `-DCMAKE_BUILD_TYPE=Release`。

g++ 常见输出位置是 `build/sprout`，Visual Studio 多配置构建常见位置是 `build/Release/sprout.exe`。文件在哪里由生成器决定，不能把某个平台的路径当作 CMake 的普遍保证。

下面是解释项目配置的教学片段，不要求替换配套工程的配置：

```cmake
cmake_minimum_required(VERSION 3.12)
project(SproutTutorial LANGUAGES CXX)
if(NOT DEFINED CMAKE_CXX_STANDARD)
  set(CMAKE_CXX_STANDARD 11)
endif()
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
add_executable(sprout src/sprout.cpp)
```

要求标准版本时同时开启 `CMAKE_CXX_STANDARD_REQUIRED`，避免工具在不支持请求标准时悄悄退回较早标准；关闭扩展能让共同子集更清楚。这里的最低 CMake 版本是本教学片段的选择，实际工程要求以随包配置为准。[CMake 的标准属性文档](https://cmake.org/cmake/help/latest/prop_tgt/CXX_STANDARD.html)解释了这些选项的含义。

不要在同一个缓存目录里反复更换编译器。你想比较 GCC 与 Clang 时，分别使用 `build-gcc` 和 `build-clang`；比较标准时使用 `build-cxx11` 和 `build-cxx20`。这样当输出变化时，更容易追踪原因。

## 3.4 你的第一个回归测试

回归测试是为已经确定的行为保留可重复检查。先保存一个最小输入：

```sprout
fn main() -> int {
    print(20 - 3 * 4);
    return 0;
}
```

预期输出 `8`。如果日后修改优先级，让它输出 `68`，测试应该立即失败。不要把程序当前产生的输出直接存成答案；先按语言规则手算答案，再让工具接受检验。

下面是一份可独立运行的 Python 测试示例。把它保存在编译器可执行文件旁边，Windows 下将 `tool` 改为 `./sprout.exe`。它创建临时输入，检查退出状态与输出，并限制执行时间。

```python
import pathlib
import subprocess
import tempfile

tool = "./sprout"
program = "fn main() -> int { print(20 - 3 * 4); return 0; }"
with tempfile.TemporaryDirectory() as folder:
    path = pathlib.Path(folder) / "case.spr"
    path.write_text(program, encoding="utf-8")
    result = subprocess.run(
        [tool, str(path)], text=True, capture_output=True, timeout=5
    )
    assert result.returncode == 0, result.stderr
    assert result.stdout.replace("\r\n", "\n") == "8\n"
print("passed")
```

这只是教你理解测试机制的小程序。配套工程自己的完整测试入口见 `compiler/README.md` 与测试目录，不必用这段片段覆盖它。

## 3.5 错误也必须有测试

再给测试准备 `fn main() -> int { print(unknown); return 0; }`。这次验收条件应是非零退出状态，以及诊断中包含有用的名字或错误类别。错误测试不应该要求“没有崩溃”就算通过，更不能因为打印了某个字符串就忽略失败状态。

自动测试可以分成三层：小函数测试验证扫描数字等局部行为；阶段测试验证 Token、AST 或字节码；端到端测试从源程序跑到输出。初学阶段优先建立端到端案例，再为复杂且容易出错的局部算法增加针对性测试。不要写一个仅把实现重新抄一遍的测试，让两边共享同一个错误。

## 3.6 亲自验证四标准兼容

如果使用 GCC，可以分四次构建并运行同一个测试集：

```text
g++ -std=c++11 -Wall -Wextra -pedantic src/sprout.cpp -o sprout11
g++ -std=c++14 -Wall -Wextra -pedantic src/sprout.cpp -o sprout14
g++ -std=c++17 -Wall -Wextra -pedantic src/sprout.cpp -o sprout17
g++ -std=c++20 -Wall -Wextra -pedantic src/sprout.cpp -o sprout20
```

构建成功只是第一步，还要分别运行测试。因为未定义行为可能在不同优化等级或标准模式下呈现不同结果。调试构建和优化构建也值得比较。支持的环境中，可使用 AddressSanitizer 与 UndefinedBehaviorSanitizer 辅助发现宿主实现的问题；它们不替代语言规范和正确性测试。

## 3.7 常见故障的最短排查

报“找不到文件”时，确认当前目录与文件名；报“不是可执行命令”时，确认工具链与 PATH；程序运行旧结果时，确认刚才构建出的文件路径与执行路径一致；Windows 输出中文乱码时，先保存 UTF-8 文件并检查终端编码。网页上的代码块复制后也应检查普通减号、引号和分号，避免富文本替换字符。

若 C++ 编译失败，先修复最早出现的有意义错误。一个缺失分号可能引出后面几十条连锁错误。若 Sprout 程序失败，把输入缩小到还能重现问题的最小例子，然后逐阶段使用 `--tokens`、`--ast`、`--check`、`--bytecode` 定位。

## 3.8 练习与验收

练习一：为什么测试同时检查标准输出和退出状态？

<details>
<summary>查看答案</summary>

程序可能打印了一部分正确结果后发生错误，也可能成功结束但根本没有执行预期分支。输出检查验证可见计算，退出状态检查验证整体成功，两者回答不同问题。

</details>

练习二：把测试中的乘号改为加号，但保留预期值 `8`，确认测试失败；然后恢复源码。这个实验验证的是测试真的能报警。

<details>
<summary>查看答案</summary>

修改后表达式是 `20 - 3 + 4`，按左结合计算为21，输出与8不同。测试应失败。若依然通过，优先检查是不是执行了旧文件或测试读取了错误路径。

</details>

本章验收：能从新建的构建目录得到工具，成功案例通过，错误案例被拒绝，故意改坏行为时测试会失败。接下来我们先把语言约定写清楚，再实现识别它的程序。

## 来源与延伸阅读

本地资料定位：`compilers-papers-we-love/teaching/Scheme2006 An Incremental Approach to Compiler Construction.pdf` 的开发循环与测试基础设施（前4页）；`compilers-resources/projects/lexer/README.md` 与 `projects/parser/README.md` 的规格、测试输入分离方式。

公开一手资料：[CMake 官方入门教程](https://cmake.org/cmake/help/latest/guide/tutorial/index.html)；[GCC 命令选项](https://gcc.gnu.org/onlinedocs/gcc/Invoking-GCC.html)；[Python subprocess 官方文档](https://docs.python.org/3/library/subprocess.html)。
