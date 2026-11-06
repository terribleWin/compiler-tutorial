---
layout: home
title: Sprout · 从零造编译器
titleTemplate: false
description: 用 C++11/14/17/20，从第一行源代码到可运行的语言。25 章中文教程、完整编译器、练习与交互实验。
hero:
  name: Sprout
  text: 从零造编译器
  tagline: 用 C++ 写一门语言，让编译原理看得见。
  image:
    src: /brand/logo-mark.svg
    alt: Sprout 编译角括号与新芽品牌标志
  actions:
    - theme: brand
      text: 开始第一章
      link: /chapter01.html
    - theme: alt
      text: 查看学习路线
      link: /roadmap.html
    - theme: alt
      text: 下载配套源码
      link: /source.html
features:
  - title: 25 章，循序渐进
    details: 约 6.1 万汉字。从词法、语法、语义检查，到中间表示、优化、代码生成与运行时，沿同一门语言展开。
    link: /roadmap.html
    linkText: 选择你的学习路线
  - title: 一套真正能运行的编译器
    details: 支持变量、条件、循环、函数与递归。以 C++11 为基线，同一份源码通过 C++14、17、20 构建验证。
    link: /source.html
    linkText: 运行 Sprout
  - title: 两个可动手的实验室
    details: 逐步观察表达式如何变成字节码，或单步累加矩阵小块，亲眼核对结构、执行顺序和结果。
    link: /lab.html
    linkText: 打开表达式实验
  - title: 理论、实现与练习相互印证
    details: 用完整演算理解自动机、LL/LR、数据流与 SSA。每章配有实验、常见错误、练习答案与验收条件。
    link: /chapter06.html
    linkText: 从自动机手算开始
  - title: 走向现代 AI 编译
    details: 在传统主线之后，继续探索模型编译链、张量调度、自动调优与学习式优化，并区分实现与扩展实验。
    link: /chapter23.html
    linkText: 阅读 AI 高级专题
  - title: 规范、源码与阅读依据
    details: 明确语言规则和验证范围，保留本地资料的阅读记录与主题地图，方便继续查阅经典教材和原始论文。
    link: /references.html
    linkText: 查看资料与阅读记录
---

<div class="sprout-home-guides">

## 跟着一段程序，走完整条编译链

<div class="sprout-pipeline" aria-label="编译流程">
  <a href="chapter04.html"><span>01</span><strong>定义语言</strong><small>规则与语义</small></a>
  <a href="chapter05.html"><span>02</span><strong>识别单词</strong><small>Token 序列</small></a>
  <a href="chapter07.html"><span>03</span><strong>组织结构</strong><small>AST 语法树</small></a>
  <a href="chapter10.html"><span>04</span><strong>检查含义</strong><small>名字与类型</small></a>
  <a href="chapter11.html"><span>05</span><strong>生成指令</strong><small>字节码与 C++</small></a>
  <a href="chapter12.html"><span>06</span><strong>运行程序</strong><small>栈与调用帧</small></a>
</div>

## 先观察，再亲手实现

<div class="sprout-lab-links">
  <a href="lab.html"><strong>表达式编译实验室 <span>→</span></strong><p>改写一行算式，观察 Token、语法树和指令，再逐条执行。</p><code>2 + 3 * (4 - 1)</code></a>
  <a href="tensor-lab.html"><strong>张量分块实验室 <span>→</span></strong><p>选择分块大小，看矩阵乘怎样组织计算、复用数据并保持结果。</p><code>C[i,j] += A[i,k] * B[k,j]</code></a>
</div>

<p class="sprout-home-note">第一次学习建议按第 1—12 章完成可运行的闭环，再深入优化、后端和 AI 专题。各章明确标注配套实现与扩展实验的边界。</p>

</div>
