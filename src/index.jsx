import { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { useCurationStore } from "./hooks";
import { api, getReadableApiError } from "./api/client";
import { Sidebar, Topbar } from "./components/layout";
import { ToastProvider } from "./components/ui/Toast";
import { PageP0, PageP1, PageExhibits, PageSettings, PageHelp, PageStep1, PageStep2, PageStep3, PageStep4, PageStep5 } from "./pages";
import { getTheme, FONT_UI, FONT_SERIF } from "./constants/theme";
import { ThemeProvider } from "./hooks/useTheme";
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
            <PageComponent {...store} theme={theme} />
          </div>
        </div>
      </ToastProvider>
    </ThemeProvider>
  );
}

const root = createRoot(document.getElementById("root"));
root.render(<CurationApp />);
