export const generateDefaultTextSections = (units) => {
  const chineseNumbers = ['一', '二', '三', '四'];
  
  if (!units || units.length === 0) {
    units = [
      { title: '技术之光——东西工匠的智慧交融', desc: '冶金、纺织、玻璃制造' },
      { title: '艺术之韵——跨越地域的审美共鸣', desc: '壁画、雕塑、织锦' },
      { title: '信仰之桥——多元宗教的和平共处', desc: '佛教、祆教、景教' },
      { title: '丝路遗珍——穿越时空的记忆', desc: '地图、银币、瓷器' },
    ];
  }

  const unitTexts = units.slice(0, 4).map((u, i) => ({
    key: `unit${i + 1}`,
    title: `第${chineseNumbers[i]}单元：${u.title || u.title}`,
    edited: false,
    text: `<h3>本单元聚焦</h3>
<p>本单元聚焦<b>「${u.title || '主题'}」</b>，通过精选展品，深入探讨这一主题的历史背景、文化内涵与艺术价值。</p>

<h3>核心叙事</h3>
<p>${u.desc || '本单元将展示相关展品，讲述其背后的历史故事。'}</p>

<h3>展品解读</h3>
<p>通过本单元的展品，我们可以了解${u.theme || '相关内容'}的发展历程和文化意义。</p>`,
  }));

  return [
    {
      key: 'preface',
      title: '展览序言',
      edited: false,
      text: `<h2>跨越千年的回响</h2>
<p>当我们站在这些精美的文物面前，仿佛能够听见千年前那阵阵驼铃声。本展览以精心策划的叙事框架，通过珍贵藏品，带领观众踏上一段跨越时空的文明探索之旅。</p>
<p>展览分为四个单元，分别从不同维度，引领观众走进那段波澜壮阔的历史长河。</p>`,
    },
    ...unitTexts,
    {
      key: 'epilogue',
      title: '展览尾声',
      edited: false,
      text: `<h2>文明精神永续</h2>
<p>每一件文物都是一段尘封的历史，承载着先民的智慧与梦想。它们从遥远的古代走来，向我们诉说着关于交流、理解与进步的故事。</p>
<p>站在这些文物面前，我们不仅在欣赏精美的艺术品，更是在与历史对话。让我们铭记历史，传承文化，在新时代的征程上，续写文明对话的新篇章。</p>
<p><i>感谢您参观本次展览，期待与您下次再见。</i></p>`,
    },
  ];
};
