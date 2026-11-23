import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { useCurationStore } from "./hooks";
import { api, getReadableApiError } from "./api/client";
import { Sidebar, Topbar } from "./components/layout";
import { ToastProvider } from "./components/ui/Toast";
import { PageP0, PageP1, PageExhibits, PageSettings, PageHelp, PageStep1, PageStep2, PageStep3, PageStep4, PageStep5 } from "./pages";
import { getTheme, FONT_UI, FONT_SERIF } from "./constants/theme";
import { ThemeProvider } from "./hooks/useTheme";
import { experimentCondition, newInteractionId, recordInteraction } from './utils/experiment';
import { retryAsync } from "./utils/retry";

const PAGE_COMPONENTS = {
  p0: PageP0,
  p1: PageP1,
  exhibits: PageExhibits,
  settings: PageSettings,
  help: PageHelp,
  step1: PageStep1,
  step2: PageStep2,
  step3: PageStep3,
  step4: PageStep4,
  step5: PageStep5,
};

function CurationApp() {
  const store = useCurationStore();
  const { currentPage, toast, setProjects, setCompletedProjects, darkMode, activeUserId, authInitialized, isLoggedIn } = store;
  const PageComponent = PAGE_COMPONENTS[currentPage] || PageP0;
  const theme = getTheme(darkMode);

  const { currentProject, showToast } = store;
  const projectId = currentProject?.id;
  const condition = experimentCondition(currentProject);
  const stage = /^step[1-5]$/.test(currentPage) ? Number(currentPage.slice(-1)) : null;
  const [savingCondition, setSavingCondition] = useState(false);

  const changeCondition = async value => {
    setSavingCondition(true);
    try {
      const llmParams = { ...currentProject.llmParams, experiment_condition: value || null };
      await api.projects.update(projectId, { llm_params: llmParams });
      store.setCurrentProject(project => project?.id === projectId ? { ...project, llmParams } : project);
      setProjects(items => items.map(item => item.id === projectId ? { ...item, llmParams } : item));
      void recordInteraction(value ? { id: projectId, llmParams } : currentProject, stage, 'condition_change', {
        previous: condition, next: value || null,
      });
    } catch (error) {
      showToast('实验配置保存失败，请重试。', 'error');
    } finally {
      setSavingCondition(false);
    }
  };

  useEffect(() => {
    if (!projectId || !condition || !stage) return;
    const project = { id: projectId, llmParams: { experiment_condition: condition } };
    let visitId;
    const start = () => {
      if (visitId) return;
      visitId = newInteractionId();
      void recordInteraction(project, stage, 'stage_start', { visit_id: visitId });
    };
    const finish = (keepalive = false) => {
      if (!visitId) return;
      void recordInteraction(project, stage, 'stage_end', { visit_id: visitId }, keepalive);
      visitId = null;
    };
    const hide = () => finish(true);
    const restore = event => { if (event.persisted) start(); };
    start();
    window.addEventListener('pagehide', hide);
    window.addEventListener('pageshow', restore);
    return () => {
      window.removeEventListener('pagehide', hide);
      window.removeEventListener('pageshow', restore);
      finish();
    };
  }, [stage, projectId, condition]);
  useEffect(() => {
    const fail = () => showToast('实验过程事件保存失败，请检查连接或数据库配置。', 'error');
    window.addEventListener('experiment-event-save-failed', fail);
    return () => window.removeEventListener('experiment-event-save-failed', fail);
  }, [showToast]);

  const PAGES_THAT_NEED_PROJECTS = ['p0', 'step1', 'step2', 'step3', 'step4', 'step5', 'exhibits'];
  
  useEffect(() => {
    if (!PAGES_THAT_NEED_PROJECTS.includes(currentPage)) return;
    if (!authInitialized) return;
    
    const checkBackend = async () => {
      try {
        await retryAsync(() => api.health(), {
          label: 'health check',
          retries: 3,
          delayMs: 800,
        });
      } catch (error) {
        console.error('后端连接失败:', error);
        store.showToast(getReadableApiError(error, '后端健康检查失败'), 'error');
      }
    };
    checkBackend();
    
    const loadProjects = async () => {
      if (!PAGES_THAT_NEED_PROJECTS.includes(currentPage)) return;
      
      try {
        const [response, completedResponse] = await Promise.all([
          retryAsync(() => api.projects.list(activeUserId), {
            label: 'load projects',
            retries: 3,
            delayMs: 900,
          }),
          retryAsync(() => api.projects.getCompletedList(activeUserId), {
            label: 'load completed projects',
            retries: 3,
            delayMs: 900,
          })
        ]);
        
        const inProgress = response
          .map(p => ({
            ...p,
            _fromApi: true,
            id: p.id,
            title: p.title,
            step: p.step,
            time: p.time || new Date(p.created_at).toLocaleDateString(),
            theme: p.theme,
            narrative: p.narrative,
            narrativeOptions: p.narrative_options,
            selectedNarrative: p.selected_narrative ?? null,
            llmParams: p.llm_params,
            exhibitionTitle: p.exhibition_title,
            uploadedExhibits: p.uploaded_exhibits,
            units: p.units || [],
            keptExhibits: p.kept_exhibits,
            textSections: p.text_sections || [],
            exhibitCount: p.exhibit_count || 0,
          }));
        
        const completed = completedResponse.map(p => ({
            ...p,
            _fromApi: true,
            id: p.project_id || p.id,
            projectId: p.project_id || p.id,
            completedRecordId: p.id,
            title: p.title,
            step: 5,
            time: p.time || new Date(p.created_at).toLocaleDateString(),
            narrative: p.narrative,
            narrativeOptions: p.narrative_options || [],
            selectedNarrative: p.selected_narrative ?? null,
            llmParams: p.llm_params,
            exhibitionTitle: p.exhibition_title,
            uploadedExhibits: p.uploaded_exhibits || [],
            units: p.units || [],
            keptExhibits: p.kept_exhibits || {},
            textSections: p.text_sections || [],
            exhibitConfirmations: p.exhibit_confirmations || {},
          }));
        
        setProjects(inProgress);
        setCompletedProjects(completed);
      } catch (error) {
        console.error('加载项目失败:', error);
        store.showToast(getReadableApiError(error, '项目数据加载失败'), 'error');
      }
    };

    if (PAGES_THAT_NEED_PROJECTS.includes(currentPage)) {
      if (isLoggedIn && activeUserId) {
        loadProjects();
      } else {
        setProjects([]);
        setCompletedProjects([]);
      }
    }
  }, [currentPage, setProjects, setCompletedProjects, activeUserId, authInitialized, isLoggedIn]);

  return (
    <ThemeProvider theme={theme}>
      <ToastProvider toast={toast} theme={theme}>
        <div 
          style={{ 
            margin: 0, 
            padding: 0, 
            background: theme.bgPrimary,
            backgroundImage: `radial-gradient(circle at top right, ${theme.accentSecondary}10 0%, transparent 28%), radial-gradient(circle at top left, ${theme.accentPrimary}0D 0%, transparent 26%)`,
            minHeight: '100vh',
            color: theme.textPrimary,
            transition: 'background 0.3s, color 0.3s',
            fontFamily: "var(--font-ui)",
          }}
        >
          <style>{`
            :root {
              --font-ui: ${FONT_UI};
              --font-serif: ${FONT_SERIF};
            }
            html, body, #root {
              margin: 0;
              min-height: 100%;
              background: ${theme.bgPrimary};
            }
            * {
              box-sizing: border-box;
            }
            button, input, textarea, select {
              font: inherit;
            }
            ::selection {
              background: ${theme.accentPrimary}22;
            }
          `}</style>
          <Sidebar {...store} theme={theme} />
          <Topbar {...store} theme={theme} />
          <div style={{ marginLeft: 232, paddingTop: 52 }}>
            {projectId && stage === 1 && isLoggedIn && (
              <label style={{ display: 'block', padding: '12px 36px 0', color: theme.textSecondary }}>
                实验配置{' '}
                <select value={condition || ''} disabled={savingCondition || store.isGenerating}
                  onChange={event => changeCondition(event.target.value)}>
                  <option value="">普通项目</option>
                  <option value="model">模型组</option>
                  <option value="fixed">对照组</option>
                </select>
              </label>
            )}
            <PageComponent {...store} theme={theme} />
          </div>
        </div>
      </ToastProvider>
    </ThemeProvider>
  );
}

const root = createRoot(document.getElementById("root"));
root.render(<CurationApp />);
