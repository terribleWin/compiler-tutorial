# 第02章 足够写编译器的 C++ 基础

## 本章目标与前置

前置条件是会编辑文本。学完本章，你应能编译一个 C++ 程序，理解变量、函数、分支、循环、结构体、容器和对象所有权，并看懂后续的 Token、AST 和符号表教学代码。不要试图一次学完整个 C++。模板元编程、复杂继承体系和并发都不是搭建第一台编译器的必要条件。

本课程以 C++11 为共同基线。C++14、17、20 提供有用的工具，但“切换语言标准”不会自动把你的编译器变成另一个语言。Sprout 的语义由我们自己的规范决定，不由宿主编译器默认行为决定。

## 2.1 让一个最小 C++ 程序运行

把下面完整程序保存为 `warmup.cpp`。`#include` 引入声明；`main` 是 C++ 程序的入口；`std::cout` 把内容写向标准输出。两个小于号组成的 `<<` 是输出运算符，这里可以暂时读作“送进去”。

```cpp
#include <iostream>

int twice(int value) {
    return value * 2;
}

int main() {
    int answer = twice(21);
    std::cout << answer << '\n';
    return 0;
}
```

```text
g++ -std=c++11 -Wall -Wextra -pedantic warmup.cpp -o warmup
./warmup
```

预期输出 `42`。函数 `twice` 接收一个名为 `value` 的整数，返回它的两倍。调用时，实参 `21` 的值传给形参。C++ 的 `int` 与 Sprout 的 `int` 名字相同，但范围规则不应混用；Sprout 明确选择32位有符号整数，我们在实现中使用固定宽度类型并检查边界。

## 2.2 从容器与循环到扫描器

字符串 `std::string` 是字符序列，动态数组 `std::vector<T>` 保存一串同类对象。`size()` 返回元素数量，合法下标从0开始，最后一个下标是 `size() - 1`。空容器没有合法下标，因此每次读取前都要检查边界。

```cpp
#include <iostream>
#include <string>
#include <vector>

int main() {
    std::string source = "a1+2";
    std::vector<char> digits;
    for (std::size_t i = 0; i < source.size(); ++i) {
        char c = source[i];
        if (c >= '0' && c <= '9') {
            digits.push_back(c);
        }
    }
    for (char c : digits) {
        std::cout << c << '\n';
    }
}
```

预期依次输出 `1` 和 `2`。这里已经出现词法分析的雏形：从左到右读取、按类别判断、收集结果。真实扫描器还必须将连续数字合成一个整数 Token，区分关键字和标识符，并保存位置。

范围循环 `for (char c : digits)` 是 C++11 已有功能。`auto` 也是 C++11 已有功能，但它表示让编译器根据初始化表达式推导类型，不表示变量没有类型。例如 `auto count = 3;` 中 `count` 仍然是整数。

## 2.3 结构体、枚举和不变量

一个 Token 不只有文字，还需要种类和位置。用结构体把这些数据放在一起，比维护四个靠下标对齐的数组更可靠。

```cpp
// 教学片段：表示设计，字段名不要求与参考实现完全相同。
enum class TokenKind { Identifier, Integer, Plus, End };

struct Position {
    std::size_t offset;
    std::size_t line;
    std::size_t column;
};

struct Token {
    TokenKind kind;
    std::string text;
    Position start;
};
```

`enum class` 把一组有限选择表示成明确类型，避免用随意的数字 `0`、`1` 猜测含义。结构体的设计还应配合不变量：位置从哪开始计数？结束 Token 是否只有一个？数字 Token 的文字能否为空？不变量是程序员为数据约定的持续成立条件。它能把后续排错从“哪里都有可能错”缩小到某个阶段的边界。

`const` 表示通过当前变量不能修改对象。函数参数写成 `const std::string& source`，既避免复制整个字符串，也保证函数不会通过这个引用改写它。引用像对象的另一个名字；它不拥有对象的存储。被引用对象销毁后，引用不会神奇地延长其寿命。

## 2.4 栈、堆与 RAII

函数内的局部对象通常随作用域结束而销毁。动态创建的对象可以活得更久，但必须明确由谁释放。C++ 的 RAII 思想是把资源寿命绑定到对象寿命：资源管理对象构造时接管资源，析构时释放资源。文件流和标准容器也遵循这种思路。

对于一棵 AST，父节点通常唯一拥有孩子节点。C++11 的 `std::unique_ptr<T>` 正好表达这种唯一所有权。

```cpp
// 教学片段：展示唯一所有权与移动，需包含 <memory>、<utility>。
struct Node {
    virtual ~Node() {}
};

struct IntegerNode : Node {
    int value;
    explicit IntegerNode(int v) : value(v) {}
};

std::unique_ptr<Node> makeInteger(int value) {
    return std::unique_ptr<Node>(new IntegerNode(value));
}

void ownershipExample() {
    std::unique_ptr<Node> first = makeInteger(7);
    std::unique_ptr<Node> second = std::move(first);
    // first 此时为空，second 接管对象。不要再通过 first 访问节点。
}
```

`std::move` 本身并没有搬运对象，它让后续操作可以选择移动构造或移动赋值。`unique_ptr` 不能被复制，因为复制会让两个对象都以为自己负责唯一释放。把它移动进 `std::vector<std::unique_ptr<Node>>` 后，容器成为节点所有权链的一部分。

基类通过指针销毁派生对象时，需要虚析构函数。相反，如果所有 AST 都使用一个带种类标签的结构体，则未必需要继承。两种设计都能正确工作；第09章会讨论取舍。不要为了显得“面向对象”而给每一个字段再包一层工厂和管理器。

## 2.5 四个语言版本如何兼容

| 标准 | 本课程可用写法 | 适合的编译器场景 | 保留 C++11 时的选择 |
| --- | --- | --- | --- |
| C++11 | `unique_ptr`、移动语义、`enum class`、范围循环 | AST 所有权、Token 种类 | 直接使用 |
| C++14 | `make_unique`、泛型 lambda | 节点构造、简短遍历函数 | 显式构造 `unique_ptr`、写明确参数类型 |
| C++17 | `variant`、`optional`、`string_view`、结构化绑定 | 节点联合、可选值、无拷贝文本视图 | 标签结构体、显式状态、保存字符串或偏移 |
| C++20 | `span`、concepts、ranges | 非拥有连续视图、模板接口约束 | 指针加长度、普通函数与标准算法 |

表中的后续标准功能是可选改造方向，主线不会依赖它们。C++14 的 `std::make_unique` 不能直接写进要求 C++11 构建的源码。C++17 的 `string_view` 不拥有字符，若源字符串已销毁，视图就悬空；换成更新标准并不能消除寿命问题。C++20 的 modules 也不是编译器项目的必需依赖。

想保留四标准兼容性，优先用共同子集实现核心算法。在实验分支中尝试新特性，并用同一组输入比较行为。标准版本的兼容表示同一份源码可以在这些模式下构建，不保证不同处理器、操作系统和标准库的二进制文件互相通用。

## 2.6 整数与错误为什么要特别小心

C++ 有符号整数溢出不能拿来定义 Sprout 的溢出行为。实现32位整数加法时，可以先把两个值提升到64位，再检查结果是否落在允许范围内，最后转换回32位。除法还要先判断除数为零，以及最小负数除以 `-1` 的特殊溢出情形。先做运算再检查，可能已经太晚。

编译错误可以通过异常向调用栈上层传播，也可以用显式结果类型返回。初学版本可以用 `std::runtime_error` 表达失败，但应在命令行入口统一捕获并转成清楚的诊断和失败状态。不要捕获所有错误后继续假装编译成功。异常对象也不是 Sprout 语言的异常机制；它只是我们实现工具时使用的 C++ 控制流程。

## 2.7 动手练习

练习一：把数字扫描程序改成统计源字符串中数字字符的个数。输入 `abc123+45` 应得到 `5`，而不是整数 `168`。

<details>
<summary>查看答案</summary>

使用从0开始的计数器，在发现 `'0' <= c && c <= '9'` 时递增一次。字符数量与整数的数值是两个不同问题。真实词法分析器要先确定边界，再转换数值。

</details>

练习二：`std::unique_ptr<Node> b = a;` 为什么不能通过编译？怎样让 `b` 接管所有权？

<details>
<summary>查看答案</summary>

第一种写法请求复制唯一所有权，类型不允许。可写 `std::unique_ptr<Node> b = std::move(a);`，此后 `a` 为空。若只是临时查看节点，使用不拥有对象的引用或指针，并保证拥有者的寿命足够长。

</details>

练习三：把 `warmup.cpp` 分别以 `-std=c++11`、`-std=c++14`、`-std=c++17`、`-std=c++20` 构建，确认都输出 `42`。再尝试在11模式中引入 `make_unique`，观察“宿主语言版本错误”与“Sprout 编译错误”出现在哪两个不同工具中。

本章验收：你能独立写一个遍历字符串的函数，能解释 `const T&` 与 `unique_ptr<T>` 的不同职责，能指出新标准可选特性的最低版本。接下来将这些知识放进可重复构建的项目。

## 来源与延伸阅读

本地资料定位：`compilers-resources/projects/lexer/README.md` 的分词任务组织方式。本章 C++ 入门例子为本课程编写。

公开一手资料：[Standard C++：C++14 标准库 FAQ](https://isocpp.org/wiki/faq/cpp14-library)；[Microsoft：创建和使用 unique_ptr](https://learn.microsoft.com/en-us/cpp/cpp/how-to-create-and-use-unique-ptr-instances)；[C++ 标准工作草案档案](https://www.open-std.org/jtc1/sc22/wg21/docs/standards)。新版本功能请同时检查所用编译器及标准库的实现情况。
