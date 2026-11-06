import { h } from 'vue';
import DefaultTheme from 'vitepress/theme';
import ExpressionLab from './components/ExpressionLab.vue';
import TensorLab from './components/TensorLab.vue';
import ChapterProgress from './components/ChapterProgress.vue';
import CodeEnhancements from './components/CodeEnhancements.vue';
import './custom.css';

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'doc-after': () => h(ChapterProgress),
      'layout-bottom': () => h(CodeEnhancements)
    });
  },
  enhanceApp({ app }) {
    app.component('ExpressionLab', ExpressionLab);
    app.component('TensorLab', TensorLab);
  }
};
