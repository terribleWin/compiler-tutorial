# 从零造编译器 · The Sprout Compiler Book

中文、面向编译原理新手的教学网站。25 章连接理论、手算、C++ 实现、练习答案与编译器工程；以 C++11 为共同基线，验证 C++14/17/20 模式。

网站发布地址：[terriblewin.github.io/compiler-tutorial](https://terriblewin.github.io/compiler-tutorial/)。若首次发布尚在构建，请到仓库 Actions 检查 Pages 状态。

## 学习入口

- `docs/index.html`：生成好的静态网站，可直接打开；全书搜索建议通过本地服务器或网站使用。
- `content/`：可编辑 Markdown 课程正文，章节 01—25 和工具附录。
- `compiler/`：真实可运行的编译器、语言规范、示例、测试和从零实作任务。
- `assets/`：阅读界面、交互实验与代码块控件。
- `verification/`：构建、链接和浏览器验证记录。

## 网站构建与预览

需要 Node.js 20+、npm 和 Python 3；编译 Sprout 另需支持 C++11 的 GCC/Clang 或合适的 MSVC。

```sh
npm ci
npm run build
python tools/package.py
npm run check
python -m http.server 8765 --directory docs
```

打开 http://localhost:8765 。站点无服务端、无账号、无需在线字体或 CDN；搜索、进度、主题与表达式编译在浏览器端运行。学习进度仅保存在当前浏览器。

## 编译器

从课程仓库根目录：

```sh
g++ -std=c++11 -Wall -Wextra -Wpedantic compiler/src/sprout.cpp -o sprout
./sprout compiler/examples/hello.spr
python compiler/tests/run_tests.py ./sprout --native g++
```

Windows 将可执行文件名改为 `sprout.exe`，以 `.\sprout.exe` 运行。其他细节见 `compiler/README.md`、`SPEC.md` 和 `LABS.md`。

## 功能边界

主线已实现 Lexer、Parser、AST、静态语义、字节码和 VM，以及生成独立 C++11 源码的第二后端。SSA、优化器、直接机器码、LLVM、RISC-V、数组、闭包、GC 等在正文中作为扩展实验讲解，不声称已经包含在参考编译器中。浏览器实验只支持整数算术表达式。

## GitHub Pages

已生成的 `docs/` 随仓库提交。仓库 Settings → Pages 使用 `Deploy from a branch`，分支 `main`，目录 `/docs`。每次更新正文后先重新构建并提交 docs。CI 负责四标准模式编译和站点完整性检查。

## 资料使用与许可

两个本地资料库用于建立主题地图与抽读核心材料，阅读记录在 `content/source-notes-*.md`，章节末有原始来源。本仓库不分发这些资料库中的教材、论文 PDF 或视频。课程讲解、示例和实现为本项目原创编排，不宣称逐页精读了两个目录的全部文件。

源码按 MIT 许可；原创教程文字按 CC BY 4.0 许可。引用的外部文献与品牌仍归其权利人所有。见 `LICENSE` 与 `CONTENT-LICENSE.md`。
