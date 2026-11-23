import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PageP0 } from './pages/PageP0';
import { PageStep5 } from './pages/PageStep5';
import { Sidebar } from './components/layout/Sidebar';
import { api } from './api/client';
import { FONT_SERIF, FONT_UI, getTheme } from './constants/theme';

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

const units = sections.map((section) => ({ id: `unit-${Number(section.id) + 1}`, tag: `第${Number(section.id) + 1}单元`, title: section.title.split('：')[1] }));
const keptExhibits = Object.fromEntries(sections.map((section, index) => [units[index].id, section.exhibits]));
const textSections = [
  { key: 'preface', title: '序言', text: '<p>从器物出发，观察生活与文化的联系。</p>' },
  ...sections.map((section, index) => ({ key: units[index].id, title: units[index].title, text: `<p>${section.content}</p>` })),
  { key: 'epilogue', title: '尾声', text: '<p>在展品的对照中回望文化的延续。</p>' },
];
const project = {
  id: 'gallery-preview-sample', projectId: 'gallery-preview-sample',
  title: '示例策展方案', step: 5, status: 'completed', time: '演示数据',
  narrative: { title: '示例策展方案' }, units, keptExhibits, textSections,
  uploadedExhibits: Object.values(keptExhibits).flat(),
};

api.projects.getCompleted = async () => ({
  narrative: project.narrative,
  units,
  kept_exhibits: keptExhibits,
  text_sections: textSections,
  uploaded_exhibits: project.uploadedExhibits,
  exhibition_title: project.title,
});

function Demo() {
  const theme = getTheme(false);
  const [currentPage, setCurrentPage] = useState('p0');
  const [currentProject, setCurrentProject] = useState(null);
  const [activeUnits, setUnits] = useState(units);
  const [activeExhibits, setKeptExhibits] = useState(keptExhibits);
  const [activeTexts, setTextSections] = useState(textSections);
  const [showExport, setShowExport] = useState(false);
  const [warningVisible, setWarningVisible] = useState(false);
  const openProject = (loadedProject) => {
    setCurrentProject(loadedProject);
    setUnits(loadedProject.units || []);
    setKeptExhibits(loadedProject.keptExhibits || {});
    setTextSections(loadedProject.textSections || []);
    setCurrentPage('step5');
  };
  const backToProjects = () => { setCurrentProject(null); setCurrentPage('p0'); };

  return (
    <div style={{ minHeight: '100vh', background: theme.bgPrimary, color: theme.textPrimary, fontFamily: 'var(--font-ui)' }}>
      <style>{`:root{--font-ui:${FONT_UI};--font-serif:${FONT_SERIF}}*{box-sizing:border-box}body{margin:0;background:${theme.bgPrimary}}`}</style>
      <Sidebar currentPage={currentPage} currentStep={5} currentProject={currentProject} navigateTo={backToProjects} createNewProject={() => {}} theme={theme} />
      <div style={{ marginLeft: 232, paddingTop: 52 }}>
        <div style={{ position: 'fixed', top: 0, left: 232, right: 0, zIndex: 90, height: 52, background: theme.bgElevated, borderBottom: `1px solid ${theme.border}`, padding: '16px 36px', fontWeight: 700 }}>智能策展助手</div>
        <div style={{ padding: '9px 36px', fontSize: 12, background: theme.humanEdited, color: theme.textSecondary }}>本地演示使用示例项目数据；真实项目会读取已保存的大纲与展品。</div>
        {currentPage === 'p0' ? (
          <PageP0 projects={[]} completedProjects={[project]} navigateTo={setCurrentPage} openProject={openProject} createNewProject={() => {}} setProjects={() => {}} setCompletedProjects={() => {}} showToast={() => {}} refreshProjects={() => {}} setCurrentStep={() => {}} setCurrentPage={setCurrentPage} isLoggedIn theme={theme} />
        ) : (
          <PageStep5 setPage={setCurrentPage} goPrevStep={backToProjects} warningVisible={warningVisible} setWarningVisible={setWarningVisible} showExport={showExport} setShowExport={setShowExport} completeProject={backToProjects} currentProject={currentProject} theme={theme} keptExhibits={activeExhibits} setKeptExhibits={setKeptExhibits} units={activeUnits} setUnits={setUnits} textSections={activeTexts} setTextSections={setTextSections} />
        )}
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<Demo />);
