# C++11 / 14 / 17 / 20 兼容手册

本书编写的是“用 C++ 实现一门语言的编译器”，并不实现 C++ 编译器。C++ 标准版本约束的是宿主实现；Sprout 的 `int`、作用域和求值顺序由 Sprout 规范单独定义。

## 一个基线，四个构建目标

主线以 C++11 为最低要求，采用标准库，不依赖 LLVM、Flex 或 Bison。相同源码应在 `-std=c++11`、`c++14`、`c++17`、`c++20` 下构建。网站发布前的实际检查记录见仓库中的 `verification/`；远端 CI 会继续验证四种模式。

```bash
g++ -std=c++11 -Wall -Wextra -pedantic compiler/src/sprout.cpp -o sprout
g++ -std=c++14 -Wall -Wextra -pedantic compiler/src/sprout.cpp -o sprout14
g++ -std=c++17 -Wall -Wextra -pedantic compiler/src/sprout.cpp -o sprout17
g++ -std=c++20 -Wall -Wextra -pedantic compiler/src/sprout.cpp -o sprout20
```

Windows 的可执行文件通常为 `sprout.exe`，运行写作 `./sprout.exe`；Unix 类系统为 `./sprout`。终端所处目录应是课程仓库根目录。

这里的“兼容”是同一份源码能在这些标准模式编译，不等于承诺所有历史编译器发行版都正确实现了标准。建议使用仍维护的 GCC、Clang 或 MSVC；具体安装和选项以各工具官方说明为准。MSVC 没有独立的 `/std:c++11` 模式，可用 `/std:c++14` 构建这份 C++11 源码，C++11 严格模式由 GCC/Clang 检查。

## 特性使用对照

| 需求 | C++11 主线 | C++14 可选 | C++17 可选 | C++20 可选 |
| --- | --- | --- | --- | --- |
| AST 独占所有权 | `unique_ptr<T>(new T(...))` | `make_unique<T>(...)` | 同前 | 同前 |
| 不同种类的节点 | 枚举 kind 加节点对象（源码使用 `enum`） | 同前 | `variant` 与 `visit` | 同前 |
| 可能不存在的查找结果 | 指针、返回状态或显式结构 | 同前 | `optional<T>` | 同前 |
| 只读文本切片 | `string` 副本或起止偏移 | 同前 | `string_view` | 同前 |
| 遍历符号表 | 普通迭代器和 range-for | 泛型 lambda | 结构化绑定 | ranges 视图 |
| 只读连续指令序列 | `vector` 的常引用 | 同前 | 同前 | `span<const Instruction>` |
| 模板分派与约束 | 普通模板，必要时 SFINAE | 同前 | `if constexpr` 可用于编译期分支，约束仍可用 SFINAE | concepts |
| 模块化源码 | `.h/.cpp` | 同前 | 同前 | 可研究 modules，非本书依赖 |

不要把新语法简单塞进 `#if` 后就认为迁移结束。改变容器、所有权或切片生命周期，可能改变程序正确性；版本分支越多，测试组合越多。先保留共同基线，只有确实改善一个接口时再局部采用新特性。

## C++11 的安全构造写法

以下是独立教学片段，展示所有权，不对应完整 Parser 接口：

```cpp
#include <memory>
#include <utility>

struct Expr {
    virtual ~Expr() {}
};

struct Neg : Expr {
    std::unique_ptr<Expr> child;
    explicit Neg(std::unique_ptr<Expr> p) : child(std::move(p)) {}
};

std::unique_ptr<Expr> make_neg(std::unique_ptr<Expr> child) {
    return std::unique_ptr<Expr>(new Neg(std::move(child)));
}
```

`std::move` 表示允许转移资源，不是“立即搬动字节”。移动后的 `unique_ptr` 为空，不应继续解引用。基类通过基类指针删除派生对象时需要虚析构。把裸指针交给第二个 `unique_ptr` 会造成双重释放。

在 C++14 下可把返回表达式改成 `std::make_unique<Neg>(std::move(child))`。若此时返回类型仍为 `unique_ptr<Expr>`，派生到基类的所有权转换会发生在返回处。

## C++17 的 string_view 陷阱

```cpp
// 教学反例：返回的视图指向已经销毁的临时字符串。
#include <string>
#include <string_view>
std::string_view bad() {
    std::string text = "let";
    return std::string_view(text);
}
```

词法分析器可以持有整份源文件，把 Token 记为偏移与长度；视图只能在该源文件缓冲区存活且地址稳定期间使用。若源文本被替换、移动或 `string` 重新分配，旧视图可能失效。C++11 版本直接保存 Token 文本虽有复制开销，却更容易解释生命周期。

## C++20 的 span 与 concepts

`span` 适合给验证器传递一段指令而不复制，也不拥有内存。底层 `vector` 扩容后旧 `span` 同样可能失效。concepts 适合约束后端接口的模板参数，不会自动证明生成代码正确，也不会替代语义检查。

新手不必为了“现代 C++”先学复杂元编程。编译器的核心困难是建立正确的不变量：Token 位置可信、AST 结构正确、名字绑定唯一、字节码栈平衡。简单清楚的实现通常更便于验证这些条件。

## 不依赖宿主语言偶然行为

Sprout 规定整数为有符号 32 位，溢出必须报错。C++ 的有符号溢出不可用来实现环绕。因此应先用更宽的整数计算、检查范围，再缩窄；除法单独检查零与最小整数除以 `-1`。

在 C++11/14 中，也不能用一个复杂目标表达式来偷偷决定 Sprout 实参或二元操作数的求值顺序。先把每个操作数结果依次存入临时变量，再调用运行时辅助函数。这一点会在本机后端章再次讨论。

## 迁移验收

1. 在四个标准模式下编译，开启警告。
2. 对每个可执行文件运行相同的成功、静态拒绝和运行陷阱测试。
3. 对递归、遮蔽、短路和算术边界特别回归。
4. 对生成的目标源码也运行四标准构建，比较输出与失败行为。
5. 改用 `variant` 或 `string_view` 后，补上访问穷尽性或生命周期测试。

来源：[WG21 公开文档入口](https://www.open-std.org/jtc1/sc22/wg21/)、[GCC C++ 方言选项](https://gcc.gnu.org/onlinedocs/gcc/C_002b_002b-Dialect-Options.html)、[Clang C++ 支持状态](https://clang.llvm.org/cxx_status.html)。语言标准与编译器版本支持情况应分开查阅。
