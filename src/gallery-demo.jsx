import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GalleryPreview } from './components/GalleryPreview';
import { getTheme } from './constants/theme';

function sampleImage(title, color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480"><rect width="640" height="480" fill="${color}"/><circle cx="320" cy="210" r="95" fill="#d8c6a6"/><path d="M230 280h180l40 100H190z" fill="#705d48"/><text x="320" y="435" text-anchor="middle" font-size="28" fill="#25364a">${title}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const sections = [
  {
    id: '0', title: '第一单元：器物与生活',
    content: '以日常器物为线索，观察工艺、材料与生活方式之间的联系。',
    exhibits: [
      { name: '陶器', introduction: '展示材料与器型之间的关系。', image_url: sampleImage('陶器', '#a9b6aa') },
      { name: '青铜器', introduction: '呈现器物在不同场景中的用途。', image_url: sampleImage('青铜器', '#8a9e94') },
      { name: '纺织品', introduction: '说明工艺如何融入日常生活。', image_url: sampleImage('纺织品', '#b8a4a0') },
    ],
  },
  {
    id: '1', title: '第二单元：交流与传承',
    content: '通过展品之间的联系呈现文化交流和技艺传承。',
    exhibits: [
      { name: '瓷器', introduction: '展示制作技艺和审美变化。', image_url: sampleImage('瓷器', '#a4b8c3') },
      { name: '漆器', introduction: '呈现材料处理与装饰工艺。', image_url: sampleImage('漆器', '#a8917d') },
      { name: '书画', introduction: '连接文本叙事与视觉表达。', image_url: sampleImage('书画', '#c5bdaa') },
      { name: '玉器', introduction: '展示造型及其文化寓意。', image_url: sampleImage('玉器', '#a2b9ab') },
      { name: '木雕', introduction: '呈现手工技艺的延续。', image_url: sampleImage('木雕', '#b19a78') },
    ],
  },
];

function Demo() {
  const [open, setOpen] = useState(true);
  const theme = getTheme(false);
  return open ? (
    <GalleryPreview title="示例策展方案" sections={sections} theme={theme} onClose={() => setOpen(false)} />
  ) : (
    <main style={{ padding: 40, fontFamily: 'sans-serif' }}><h1>展厅预览演示</h1><p>此页使用示例数据；实际功能从完整大纲读取项目内容。</p><button onClick={() => setOpen(true)}>重新打开预览</button></main>
  );
}

createRoot(document.getElementById('root')).render(<Demo />);
