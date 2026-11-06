import { defineConfig } from 'vitepress';
import fs from 'node:fs';
import { chapters, extras } from '../../tools/catalog.mjs';
import { releaseCheck } from './release-check.mjs';

const release = JSON.parse(fs.readFileSync(new URL('../../site-release.json', import.meta.url), 'utf8'));

const sidebar = [];
for (const chapter of chapters) {
  let group = sidebar.find(item => item.text === chapter.part);
  if (!group) sidebar.push(group = { text: chapter.part, collapsed: false, items: [] });
  group.items.push({ text: `${String(chapter.number).padStart(2, '0')}  ${chapter.title}`, link: `/${chapter.id}` });
}
sidebar.push({ text: '工具与附录', collapsed: false, items: extras.map(item => ({ text: item.title, link: `/${item.id}` })) });

const sproutGrammar = {
  name: 'sprout', scopeName: 'source.sprout', aliases: ['Sprout'],
  patterns: [
    { name: 'comment.line.double-slash.sprout', match: '//.*$' },
    { name: 'keyword.control.sprout', match: '\\b(fn|let|if|else|while|return)\\b' },
    { name: 'storage.type.sprout', match: '\\b(int|bool)\\b' },
    { name: 'constant.language.sprout', match: '\\b(true|false)\\b' },
    { name: 'support.function.sprout', match: '\\bprint(?=\\s*\\()' },
    { name: 'entity.name.function.sprout', match: '\\b[A-Za-z_][A-Za-z_0-9]*(?=\\s*\\()' },
    { name: 'constant.numeric.sprout', match: '\\b[0-9]+\\b' },
    { name: 'keyword.operator.sprout', match: '->|==|!=|<=|>=|&&|\\|\\||[+*/%!=<>-]' }
  ]
};

export default defineConfig({
  lang: 'zh-CN',
  title: 'Sprout · 从零造编译器',
  description: '从零用 C++11/14/17/20 自制编译器，25 章中文教程、配套源码、交互实验与 AI 编译专题。',
  base: '/compiler-tutorial/',
  outDir: '../docs',
  cacheDir: './.vitepress/cache',
  cleanUrls: false,
  srcExclude: ['public/**'],
  appearance: true,
  lastUpdated: false,
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/compiler-tutorial/brand/favicon.svg' }],
    ['meta', { name: 'theme-color', content: '#3265df' }],
    ['meta', { name: 'sprout-release', content: release.version }],
    ['script', {}, releaseCheck(release.version, '/compiler-tutorial/')]
  ],
  markdown: {
    lineNumbers: true,
    theme: { light: 'github-light', dark: 'github-dark' },
    languages: [sproutGrammar,
      { name: 'ebnf', scopeName: 'source.ebnf', patterns: [
        { name: 'string.quoted.double.ebnf', begin: '"', end: '"' },
        { name: 'keyword.operator.ebnf', match: '=|\\||[{};]' },
        { name: 'entity.name.type.ebnf', match: '\\b[A-Za-z_][A-Za-z_0-9]*\\b' }
      ] },
      ...['llvm', 'mlir'].map(name => ({ name, scopeName: 'source.' + name, patterns: [
        { name: 'comment.line.semicolon', match: name === 'llvm' ? ';.*$' : '//.*$' },
        { name: 'storage.type', match: '\\b(i[0-9]+|f[0-9]+|void|ptr|tensor|memref|index)\\b' },
        { name: 'keyword.control', match: '\\b(define|declare|ret|br|phi|call|add|mul|func|return|module)\\b' },
        { name: 'entity.name.function', match: '[@%][A-Za-z_0-9.]+' },
        { name: 'constant.numeric', match: '\\b[0-9]+\\b' }
      ] }))
    ],

  },
  themeConfig: {
    logo: { src: '/brand/logo-mark.svg', alt: 'Sprout 萌芽与编译括号标志' },
    siteTitle: 'Sprout',
    nav: [
      { text: '教程', link: '/chapter01', activeMatch: '/chapter' },
      { text: '实验', items: [{ text: '表达式编译', link: '/lab' }, { text: '张量分块', link: '/tensor-lab' }] },
      { text: '源码', link: '/source' }
    ],
    sidebar,
    outline: { level: [2, 3], label: '本页目录' },
    socialLinks: [{ icon: 'github', link: 'https://github.com/terribleWin/compiler-tutorial', ariaLabel: 'GitHub 源码仓库' }],
    search: {
      provider: 'local',
      options: {
        detailedView: true,
        miniSearch: {
          options: { tokenize: text => text.toLowerCase().match(/[a-z0-9_]+|[\u3400-\u9fff]/g) || [] },
          searchOptions: { prefix: true, fuzzy: 0.15, combineWith: 'AND' }
        },
        translations: {
          button: { buttonText: '搜索全书', buttonAriaLabel: '搜索全书' },
          modal: {
            displayDetails: '显示详细结果', resetButtonTitle: '清空搜索', backButtonTitle: '关闭搜索', noResultsText: '没有找到相关内容',
            footer: { selectText: '选择', navigateText: '切换', closeText: '关闭' }
          }
        }
      }
    },
    docFooter: { prev: '上一章', next: '下一章' },
    darkModeSwitchLabel: '外观', lightModeSwitchTitle: '切换为浅色模式', darkModeSwitchTitle: '切换为深色模式',
    sidebarMenuLabel: '课程目录', returnToTopLabel: '回到顶部', skipToContentLabel: '跳到正文'
  }
});
