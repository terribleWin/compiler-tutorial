# 从零造编译器 · The Sprout Compiler Book

中文、面向编译原理新手的教学网站。25 章连接理论、手算、C++ 实现、练习答案与编译器工程；以 C++11 为共同基线，验证 C++14/17/20 模式。

**[在线阅读 · 当前版本](https://terriblewin.github.io/compiler-tutorial/?v=20261106-minimal)**

## 学习入口

- `docs/`：VitePress 生成的静态网站，通过线上地址或本地预览访问。
- `content/`：可编辑 Markdown 课程正文，章节 01—25 和工具附录。
- `compiler/`：真实可运行的编译器、语言规范、示例、测试和从零实作任务。
- `site/.vitepress/`：VitePress 配置、Vue 交互实验、阅读控件与统一排版。
- `brand/`：Sprout 原创 SVG Logo、单色版、深浅组合版和 favicon。
- `verification/`：构建、链接和浏览器验证记录。

## 网站构建与预览

需要 Node.js 22+、npm 和 Python 3；编译 Sprout 另需支持 C++11 的 GCC/Clang 或合适的 MSVC。

```sh
npm ci
npm run build
npm run check
npm run preview
```

打开终端显示地址下的 `/compiler-tutorial/`。字体、图示和脚本均随网站发布；搜索、进度和交互实验在浏览器运行。学习进度仅保存在当前浏览器。

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

已生成的 `docs/` 随仓库提交。仓库 Settings → Pages 使用 `Deploy from a branch`，分支 `main`，目录 `/docs`。每次更新正文后先重新构建并提交 docs。`content/` 保持单一正文来源，构建时自动准备 Markdown、下载文件和 VitePress 页面。CI 负责四标准模式编译和站点完整性检查。发布网页新版时，同步更新 `site-release.json` 与本页在线入口的版本参数；页面会检查发布版本，发现过期时刷新到当前版本。

## 资料使用与许可

两个本地资料库用于建立主题地图与抽读核心材料，阅读记录在 `content/source-notes-*.md`，章节末有原始来源。本仓库不分发这些资料库中的教材、论文 PDF 或视频。课程讲解、示例和实现为本项目原创编排，不宣称逐页精读了两个目录的全部文件。

源码按 MIT 许可；原创教程文字按 CC BY 4.0 许可。引用的外部文献与品牌仍归其权利人所有。见 `LICENSE` 与 `CONTENT-LICENSE.md`。


## 统一版式与品牌

采用 VitePress 1.6.4 默认文档主题，蓝色品牌。桌面正文18px、手机17px，代码约14px；原生 Shiki 高亮与复制，补充行号切换、换行、长代码折叠和放大。两个实验为 Vue 组件，适配站内无刷新导航；学习进度沿用原来的本地记录。

品牌图形将编译角括号与分支新芽结合，提供透明 SVG，可用于网页、演示与印刷。品牌文件见 `brand/README.md`。

`npm run check:browser` 是可选的实际浏览器验证，需要 Playwright 和 Chromium/Edge；可通过 `PLAYWRIGHT_MODULE` 与 `BROWSER_PATH` 指定本机安装。
