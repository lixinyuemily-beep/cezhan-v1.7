import { useState, useCallback, useEffect } from 'react';
import { api } from '../api/client';
import { generateDefaultTextSections } from '../data/textTemplates';
import {
  getExhibitImage,
  getExhibitIntroduction,
  getExhibitMaterial,
  getExhibitName,
  getExhibitOther,
  getExhibitPlace,
  getExhibitTime,
  normalizeImportedExhibit,
  normalizePreviewExhibitGroups,
} from '../utils/exhibitFields';

const initialProject = {
  id: null,
  title: '',
  exhibitCount: 0,
  uploaded: false,
  currentStep: 1,
  narrativeDirection: null,
  units: [],
  exhibits: {},
  texts: {},
};

const DEFAULT_NARRATIVE_RHYTHM = {
  enabled: true,
  presetKey: 'release',
  points: [34, 28, 24, 42, 76, 66],
  stages: ['开场', '铺垫', '转折', '深入', '高潮', '余韵'],
  summary: '前段刻意压低节奏、留出铺垫和沉淀空间，中后段快速抬升并形成靠后的高潮，尾段略作回落，适合层层蓄势后集中释放。',
};

const DEFAULT_ADVANCED_SETTINGS = {
  unitCount: 3,
  unitCountMax: 6,
  itemsPerUnitMin: 5,
  itemsPerUnit: 10,
  itemsPerUnitMax: 10,
  temperature: 0.9,
};

const AUTH_STORAGE_KEY = 'curation_auth_session';
const GUEST_USER_ID_STORAGE_KEY = 'curation_guest_user_id';

function generateGuestUserId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `guest_${crypto.randomUUID()}`;
  }
  return `guest_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getInitialGuestUserId() {
  if (typeof localStorage === 'undefined') return generateGuestUserId();
  const saved = localStorage.getItem(GUEST_USER_ID_STORAGE_KEY);
  if (saved) return saved;
  const next = generateGuestUserId();
  localStorage.setItem(GUEST_USER_ID_STORAGE_KEY, next);
  return next;
}

function readStoredAuthSession() {
  if (typeof localStorage === 'undefined') return null;
  const saved = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!saved) return null;
  try {
    return JSON.parse(saved);
  } catch (error) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

function normalizeAdvancedSettings(settings = {}) {
  const unitCountMax = Math.max(2, Number(settings.unitCountMax ?? DEFAULT_ADVANCED_SETTINGS.unitCountMax));
  const legacyItemsPerUnit = Number(settings.itemsPerUnit ?? DEFAULT_ADVANCED_SETTINGS.itemsPerUnit);
  const rawItemsPerUnitMin = Number(settings.itemsPerUnitMin ?? Math.min(DEFAULT_ADVANCED_SETTINGS.itemsPerUnitMin, legacyItemsPerUnit));
  const rawItemsPerUnitMax = Number(settings.itemsPerUnitMax ?? legacyItemsPerUnit);
  const itemsPerUnitMin = Math.max(2, Math.min(rawItemsPerUnitMin, rawItemsPerUnitMax));
  const itemsPerUnitMax = Math.max(itemsPerUnitMin, rawItemsPerUnitMax);

  return {
    unitCount: Math.min(unitCountMax, Math.max(2, Number(settings.unitCount ?? DEFAULT_ADVANCED_SETTINGS.unitCount))),
    unitCountMax,
    itemsPerUnitMin,
    itemsPerUnit: itemsPerUnitMax,
    itemsPerUnitMax,
    temperature: Number(settings.temperature ?? DEFAULT_ADVANCED_SETTINGS.temperature),
  };
}

export function useCurationStore() {
  const storedAuthSession = readStoredAuthSession();
  const [currentPage, setCurrentPage] = useState('p0');
  const [currentStep, setCurrentStep] = useState(1);
  const [projects, setProjects] = useState([]);
  const [completedProjects, setCompletedProjects] = useState([]);
  const [authSession, setAuthSession] = useState(storedAuthSession);
  const [authUser, setAuthUser] = useState(storedAuthSession?.user || null);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [guestUserId] = useState(() => getInitialGuestUserId());
  const [authPanelOpen, setAuthPanelOpen] = useState(false);
  const [authPromptMessage, setAuthPromptMessage] = useState('');
  
  const [currentProject, setCurrentProject] = useState(null);
  
  const [exhibitTitle, setExhibitTitle] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadedExhibits, setUploadedExhibits] = useState([]);
  const [additionalIntent, setAdditionalIntent] = useState('');
  const [narrativeRhythm, setNarrativeRhythm] = useState(DEFAULT_NARRATIVE_RHYTHM);
  const [advancedSettings, setAdvancedSettings] = useState(DEFAULT_ADVANCED_SETTINGS);
  
  const [uploaded, setUploaded] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(true);
  const [selectedNarrative, setSelectedNarrative] = useState(null);
  const [narrativeOptions, setNarrativeOptions] = useState([]);
  const [units, setUnits] = useState([]);
  const [exhibitConfirmations, setExhibitConfirmations] = useState({});
  const [keptExhibits, setKeptExhibits] = useState({});
  const [textSections, setTextSections] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [warningVisible, setWarningVisible] = useState(true);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' });
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });
  const isLoggedIn = !!authUser;
  const activeUserId = authUser?.id || null;

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  useEffect(() => {
    if (authSession) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authSession));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }, [authSession]);

  useEffect(() => {
    let cancelled = false;

    const bootstrapAuth = async () => {
      if (!storedAuthSession?.access_token) {
        setAuthInitialized(true);
        return;
      }

      try {
        const response = await api.auth.me(storedAuthSession.access_token);
        if (cancelled) return;
        const nextUser = response.user || storedAuthSession.user || null;
        setAuthUser(nextUser);
        setAuthSession({
          ...storedAuthSession,
          user: nextUser,
        });
      } catch (error) {
        if (cancelled) return;
        setAuthSession(null);
        setAuthUser(null);
      } finally {
        if (!cancelled) {
          setAuthInitialized(true);
        }
      }
    };

    bootstrapAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  const showToast = useCallback((message, type = 'info', duration = 3000) => {
    setToast({ visible: true, message, type });
    setTimeout(() => {
      setToast({ visible: false, message: '', type: 'info' });
    }, duration);
  }, []);

  const requireLogin = useCallback((actionLabel = '继续操作') => {
    setAuthPromptMessage(`登录后即可${actionLabel}，并查看你自己的项目与展品数据。`);
    setAuthPanelOpen(true);
    showToast('请先登录后继续', 'info');
  }, [showToast]);

  const navigateTo = useCallback((page) => {
    if (page.startsWith('step')) {
      const step = parseInt(page.replace('step', ''), 10);
      setCurrentStep(step);
    }
    setCurrentPage(page);
  }, []);

  const goToStep = useCallback((step) => {
    setCurrentStep(step);
    setCurrentPage(`step${step}`);
    if (step === 4) {
      const mockTextSections = generateDefaultTextSections(units.length > 0 ? units : [
        { title: '技术之光——东西工匠的智慧交融', desc: '冶金、纺织、玻璃制造' },
        { title: '艺术之韵——跨越地域的审美共鸣', desc: '壁画、雕塑、织锦' },
        { title: '信仰之桥——多元宗教的和平共处', desc: '佛教、祆教、景教' },
        { title: '丝路遗珍——穿越时空的记忆', desc: '地图、银币、瓷器' },
      ]);
      setTextSections(mockTextSections);
    }
  }, [units]);

  const goNextStep = useCallback(async () => {
    const nextStep = currentStep + 1;
    if (currentStep === 1 && (selectedNarrative === null || selectedNarrative === undefined || !narrativeOptions[selectedNarrative])) {
      showToast('请先选择一个叙事方向', 'info');
      setIsGenerating(false);
      return;
    }

    if (nextStep <= 5) {
      if (currentProject?.id) {
        try {
          const updateData = {
            step: nextStep,
          };
          
          if (currentStep === 1) {
            if (selectedNarrative !== null && selectedNarrative !== undefined) {
              updateData.selected_narrative = selectedNarrative;
              updateData.narrative = narrativeOptions[selectedNarrative] || {};
            }
            updateData.narrative_options = narrativeOptions;
            updateData.exhibition_title = exhibitTitle;
            updateData.uploaded_exhibits = uploadedExhibits;
            updateData.llm_params = {
              exhibition_title: exhibitTitle,
              additional_intent: additionalIntent,
              narrative_rhythm: narrativeRhythm,
            };
          } else if (currentStep === 2) {
            updateData.units = units;
          } else if (currentStep === 3) {
            updateData.units = units;
            const regularUnits = units.filter(u => u.tag !== '序章' && u.tag !== '尾声');
            const convertedKeptExhibits = {};
            regularUnits.forEach((unit, index) => {
              if (keptExhibits[unit.id]) {
                convertedKeptExhibits[String(index)] = keptExhibits[unit.id];
              } else if (keptExhibits[index] !== undefined) {
                convertedKeptExhibits[String(index)] = keptExhibits[index];
              } else if (keptExhibits[String(index)]) {
                convertedKeptExhibits[String(index)] = keptExhibits[String(index)];
              }
            });
            updateData.kept_exhibits = convertedKeptExhibits;
            updateData.exhibit_confirmations = exhibitConfirmations;
          } else if (currentStep === 4) {
            updateData.text_sections = textSections;
          }
          
          await api.projects.update(currentProject.id, updateData);
          
          if (currentStep === 4) {
            setCurrentProject(prev => prev ? { ...prev, textSections } : prev);
          }
        } catch (error) {
          console.error('保存步骤失败:', error);
        }
      }
      
      if (nextStep === 4 && currentStep === 3) {
        const regularUnits = units.filter(u => u.tag !== '序章' && u.tag !== '尾声');
        const convertedKeptExhibits = {};
        regularUnits.forEach((unit, index) => {
          if (keptExhibits[unit.id]) {
            convertedKeptExhibits[String(index)] = keptExhibits[unit.id];
          } else if (keptExhibits[index] !== undefined) {
            convertedKeptExhibits[String(index)] = keptExhibits[index];
          }
        });
        if (keptExhibits['_leftovers']) {
          convertedKeptExhibits['_leftovers'] = keptExhibits['_leftovers'];
        }
        if (Object.keys(convertedKeptExhibits).length > 0) {
          setKeptExhibits(convertedKeptExhibits);
          if (currentProject?.id) {
            try {
              await api.projects.update(currentProject.id, {
                kept_exhibits: convertedKeptExhibits,
              });
            } catch (err) {
              console.error('保存展品索引失败:', err);
            }
          }
        }
        
        const narrative = narrativeOptions[selectedNarrative] || { title: '', desc: '' };
        const exhibitionTitle = exhibitTitle || narrative?.title || '展览';
        const unitCount = regularUnits.length;
        const activeNarrativeRhythm = currentProject?.llmParams?.narrative_rhythm || narrativeRhythm;
        
        try {
          const textSectionsData = [];
          
          const prefaceUnit = units.find(u => u.tag === '序章');
          if (prefaceUnit) {
            try {
              const response = await api.ai.generatePreface(exhibitionTitle, unitCount, narrative, activeNarrativeRhythm);
              textSectionsData.push({
                key: 'preface',
                title: '展览序言',
                text: response.content || '<p>序言生成失败</p>',
                edited: false,
              });
            } catch (err) {
              console.error('生成序言失败:', err);
              textSectionsData.push({
                key: 'preface',
                title: '展览序言',
                text: '<p>序言生成失败，请手动编辑</p>',
                edited: false,
              });
            }
          }
          
          for (let unitIndex = 0; unitIndex < units.length; unitIndex++) {
            const unit = units[unitIndex];
            if (unit.tag === '序章' || unit.tag === '尾声') continue;
            
            const regularUnitIndex = units.filter(u => u.tag !== '序章' && u.tag !== '尾声').indexOf(unit);
            const unitId = String(regularUnitIndex);
            const unitExhibits = keptExhibits[unitId] || [];
            
            try {
              const response = await api.ai.generateTextSection({
                unit: unit,
                exhibits: unitExhibits,
                narrative: narrative,
                narrative_rhythm: activeNarrativeRhythm,
              });
              
              let content = response.content || '';
              let exhibitSummaries = [];
              
              try {
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                  const parsed = JSON.parse(jsonMatch[0]);
                  if (parsed.intro) {
                    content = `<p>${parsed.intro}</p>`;
                  }
                  if (parsed.exhibits && Array.isArray(parsed.exhibits)) {
                    exhibitSummaries = parsed.exhibits;
                  }
                }
              } catch (e) {
                console.error('解析文本响应失败:', e);
              }
              
              textSectionsData.push({
                key: unitId,
                title: unit.title,
                text: content,
                exhibits: exhibitSummaries,
                edited: false,
              });
            } catch (err) {
              console.error(`生成单元 "${unit.title}" 文本失败:`, err);
              textSectionsData.push({
                key: unitId,
                title: unit.title,
                text: '<p>文本生成失败，请手动编辑</p>',
                exhibits: [],
                edited: false,
              });
            }
          }
          
          const epilogueUnit = units.find(u => u.tag === '尾声');
          if (epilogueUnit) {
            try {
              const response = await api.ai.generateEpilogue(exhibitionTitle, unitCount, narrative, activeNarrativeRhythm);
              textSectionsData.push({
                key: 'epilogue',
                title: '展览尾声',
                text: response.content || '<p>尾声生成失败</p>',
                edited: false,
              });
            } catch (err) {
              console.error('生成尾声失败:', err);
              textSectionsData.push({
                key: 'epilogue',
                title: '展览尾声',
                text: '<p>尾声生成失败，请手动编辑</p>',
                edited: false,
              });
            }
          }
          
          if (textSectionsData.length > 0) {
            setTextSections(textSectionsData);
            
            if (currentProject?.id) {
              try {
                await api.projects.update(currentProject.id, {
                  text_sections: textSectionsData,
                  step: 4
                });
                setCurrentProject(prev => prev ? { ...prev, textSections: textSectionsData, step: 4 } : prev);
              } catch (err) {
                console.error('保存文本段落失败:', err);
              }
            }
          } else {
            const mockTextSections = generateDefaultTextSections(units);
            setTextSections(mockTextSections);
          }
        } catch (error) {
          console.error('生成文本失败:', error);
          const mockTextSections = generateDefaultTextSections(units);
          setTextSections(mockTextSections);
        } finally {
          setIsGenerating(false);
        }
        
        setCurrentStep(4);
        setCurrentPage('step4');
      } else {
        setCurrentStep(nextStep);
        setCurrentPage(`step${nextStep}`);
        setIsGenerating(false);
      }
    }
  }, [currentStep, units, currentProject, selectedNarrative, narrativeOptions, keptExhibits, exhibitTitle, textSections, exhibitConfirmations, uploadedExhibits, additionalIntent, narrativeRhythm, showToast]);

  const goPrevStep = useCallback(() => {
    const prevStep = currentStep - 1;
    if (prevStep >= 1) {
      setCurrentStep(prevStep);
      setCurrentPage(`step${prevStep}`);
    }
  }, [currentStep]);

  const createNewProject = useCallback(() => {
    setUploaded(false);
    setUploadedFile(null);
    setUploadedExhibits([]);
    setExhibitTitle('');
    setAdditionalIntent('');
    setNarrativeRhythm(DEFAULT_NARRATIVE_RHYTHM);
    setAdvancedSettings(DEFAULT_ADVANCED_SETTINGS);
    setShowAdvanced(true);
    setSelectedNarrative(null);
    setUnits([]);
    setExhibitConfirmations({});
    setKeptExhibits({});
    setTextSections([]);
    setShowExport(false);
    setWarningVisible(true);
    setCurrentStep(1);
    setCurrentPage('p1');
  }, []);

  const saveAIGeneratedData = useCallback(async (projectId, aiResult, llmParams) => {
    if (!activeUserId) {
      requireLogin('保存并编辑策展项目');
      return;
    }
    const projectTitle = llmParams.exhibition_title || aiResult.data.narrative.title;
    
    try {
      const createData = {
        title: projectTitle,
        user_id: activeUserId,
        theme: llmParams.exhibition_title || null,
        step: 1,
        status: 'in_progress',
        exhibit_count: llmParams.exhibits.length,
        llm_params: llmParams,
        uploaded_exhibits: llmParams.exhibits,
        exhibition_title: llmParams.exhibition_title,
        narrative: null,
        narrative_options: aiResult.data.narrativeOptions || [],
        selected_narrative: null,
      };
      
      const backendProject = await api.projects.create(createData);
      
      const newProject = {
        id: backendProject.id,
        title: projectTitle,
        step: 1,
        time: '刚刚',
        exhibitCount: llmParams.exhibits.length,
        llmParams: llmParams,
        uploadedExhibits: llmParams.exhibits,
        exhibitTitle: llmParams.exhibition_title,
        narrative: null,
        narrativeOptions: aiResult.data.narrativeOptions,
        selectedNarrative: null,
        units: [],
        textSections: [],
        exhibitRecommendations: [],
      };
      
      setProjects(prev => {
        const existing = prev.filter(p => p.id !== backendProject.id);
        return [newProject, ...existing];
      });
      setCurrentProject(newProject);
      setCurrentStep(1);
      setCurrentPage('step1');
      setUnits([]);
      setTextSections([]);
      setSelectedNarrative(null);
      setNarrativeOptions(aiResult.data.narrativeOptions || []);
    } catch (error) {
      console.error('创建项目失败:', error);
      const newProject = {
        id: projectId,
        title: projectTitle,
        step: 1,
        time: '刚刚',
        exhibitCount: llmParams.exhibits.length,
        llmParams: llmParams,
        narrative: null,
        narrativeOptions: aiResult.data.narrativeOptions,
        selectedNarrative: null,
        units: [],
        textSections: [],
        exhibitRecommendations: [],
      };
      
      setProjects(prev => {
        const existing = prev.filter(p => p.id !== projectId);
        return [newProject, ...existing];
      });
      setCurrentProject(newProject);
      setCurrentStep(1);
      setCurrentPage('step1');
      setUnits([]);
      setTextSections([]);
      setSelectedNarrative(null);
      setNarrativeOptions(aiResult.data.narrativeOptions || []);
    }
  }, [activeUserId, requireLogin]);

  const refreshProjects = useCallback(async (userId = activeUserId) => {
    if (!userId) {
      setProjects([]);
      setCompletedProjects([]);
      return;
    }
    try {
      const [response, completedResponse] = await Promise.all([
        api.projects.list(userId),
        api.projects.getCompletedList(userId)
      ]);
      
      const inProgress = response
        .filter(p => p.status !== 'completed')
        .map(p => ({
          id: p.id,
          title: p.title,
          step: p.step,
          time: p.time || new Date(p.created_at).toLocaleDateString(),
          theme: p.theme,
          narrative: p.narrative,
          narrativeOptions: p.narrative_options,
          selectedNarrative: p.selected_narrative ?? null,
          llmParams: p.llm_params,
          units: [],
          textSections: [],
          exhibitCount: p.exhibit_count || 0,
        }));
      
      const completed = completedResponse.map(p => ({
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
      console.error('刷新项目失败:', error);
    }
  }, [activeUserId, setProjects, setCompletedProjects]);

  const generateStep2Data = useCallback((projectId, aiResult) => {
    setUnits(aiResult.data.units);
    setTextSections(aiResult.data.textSections);
    
    setCurrentStep(2);
    setCurrentPage('step2');
    
    setProjects(prev => prev.map(p => {
      if (p.id === projectId) {
        const updated = { 
          ...p, 
          step: 2,
          units: aiResult.data.units,
          textSections: aiResult.data.textSections,
          exhibitRecommendations: aiResult.data.exhibitRecommendations,
        };
        setCurrentProject(updated);
        return updated;
      }
      return p;
    }));
  }, []);

  const openProject = useCallback(async (project) => {
    let projectData = { ...project };
    
    if (project._fromApi) {
      const projectUnits = project.units || [];
      projectData = {
        ...project,
        selectedNarrative: project.selectedNarrative ?? project.selected_narrative ?? null,
        narrative: project.narrative,
        narrativeOptions: project.narrativeOptions || project.narrative_options || [],
        llmParams: project.llmParams || project.llm_params,
        exhibitionTitle: project.exhibitionTitle || project.exhibition_title,
        uploadedExhibits: project.uploadedExhibits || project.uploaded_exhibits,
        units: projectUnits,
        keptExhibits: normalizePreviewExhibitGroups(project.keptExhibits || project.kept_exhibits || {}, projectUnits),
        textSections: project.textSections || project.text_sections || [],
        exhibitConfirmations: project.exhibitConfirmations || project.exhibit_confirmations,
      };
    } else {
      const projectUnits = project.units || [];
      projectData = {
        ...project,
        selectedNarrative: project.selectedNarrative ?? project.selected_narrative ?? null,
        narrative: project.narrative || project.narrative,
        narrativeOptions: project.narrativeOptions || project.narrative_options || [],
        llmParams: project.llmParams || project.llm_params,
        exhibitionTitle: project.exhibitionTitle || project.exhibition_title,
        uploadedExhibits: project.uploadedExhibits || project.uploaded_exhibits,
        units: projectUnits,
        keptExhibits: normalizePreviewExhibitGroups(project.keptExhibits || project.kept_exhibits || {}, projectUnits),
        textSections: project.textSections || project.text_sections || [],
        exhibitConfirmations: project.exhibitConfirmations || project.exhibit_confirmations,
      };
    }
    
    setCurrentProject(projectData);
    setCurrentStep(project.step);
    setCurrentPage(`step${project.step}`);
    setShowAdvanced(true);
    
    setSelectedNarrative(projectData.selectedNarrative);
    setNarrativeOptions(projectData.narrativeOptions);
    
    if (projectData.exhibitionTitle) {
      setExhibitTitle(projectData.exhibitionTitle);
    }
    if (projectData.uploadedExhibits && projectData.uploadedExhibits.length > 0) {
      setUploadedExhibits(projectData.uploadedExhibits);
      setUploaded(true);
    }
    if (projectData.exhibitConfirmations) {
      setExhibitConfirmations(projectData.exhibitConfirmations);
    }
    
    if (projectData.llmParams) {
      const llmParams = projectData.llmParams;
      const exhibits = llmParams.exhibits || [];
      if (exhibits.length > 0 && !projectData.uploadedExhibits) {
        setUploadedExhibits(exhibits);
        setUploaded(true);
      }
      if (!projectData.exhibitionTitle) {
        setExhibitTitle(llmParams.exhibition_title || '');
      }
      setAdditionalIntent(llmParams.additional_intent || '');
      setNarrativeRhythm(llmParams.narrative_rhythm || DEFAULT_NARRATIVE_RHYTHM);
      setAdvancedSettings(normalizeAdvancedSettings(llmParams.advanced_settings));
    } else {
      setNarrativeRhythm(DEFAULT_NARRATIVE_RHYTHM);
      setAdvancedSettings(DEFAULT_ADVANCED_SETTINGS);
    }
    
    if (projectData.units && projectData.units.length > 0) {
      setUnits(projectData.units);
      
      if (projectData.keptExhibits) {
        setKeptExhibits(projectData.keptExhibits);
      }
      
      if (projectData.step >= 4 && projectData.textSections) {
        setTextSections(projectData.textSections);
      }
    } else if (projectData.step >= 2) {
      try {
        const unitsData = await api.projects.getUnits(project.id);
        if (unitsData && unitsData.length > 0) {
          setUnits(unitsData);
          
          const exhibitsData = {};
          for (const unit of unitsData) {
            const unitExhibits = await api.exhibits.list({ unit_id: unit.id, user_id: activeUserId });
            if (unitExhibits && unitExhibits.length > 0) {
              exhibitsData[unit.id] = unitExhibits.map(ex => ({
                ...normalizeImportedExhibit(ex),
                mat: getExhibitMaterial(ex),
                sz: getExhibitOther(ex),
                era: getExhibitTime(ex),
                id: ex.id || ex.编号 || '',
                stars: ex.confidence || ex.stars || 5,
                ctx: ex.ctx || "用户保留",
                src: ex.source || "用户上传",
                kept: true,
              }));
            }
          }
          if (Object.keys(exhibitsData).length > 0) {
            setKeptExhibits(exhibitsData);
          }
        }
      } catch (error) {
        console.error('加载项目数据失败:', error);
      }
    }
    
    if (project.step >= 4) {
      if (project.textSections && project.textSections.length > 0) {
        setTextSections(project.textSections);
      } else {
        try {
          const textSectionsData = await api.projects.getTextSections(project.id);
          if (textSectionsData && textSectionsData.length > 0) {
            setTextSections(textSectionsData);
          } else {
            const mockTextSections = generateDefaultTextSections(units.length > 0 ? units : [
              { title: '技术之光——东西工匠的智慧交融', desc: '冶金、纺织、玻璃制造' },
              { title: '艺术之韵——跨越地域的审美共鸣', desc: '壁画、雕塑、织锦' },
              { title: '信仰之桥——多元宗教的和平共处', desc: '佛教、祆教、景教' },
              { title: '丝路遗珍——穿越时空的记忆', desc: '地图、银币、瓷器' },
            ]);
            setTextSections(mockTextSections);
          }
        } catch (error) {
          console.error('加载文本段落失败:', error);
        }
      }
    }
  }, [units]);

  const resetProjectState = useCallback(() => {
    setUploaded(false);
    setUploadedFile(null);
    setUploadedExhibits([]);
    setExhibitTitle('');
    setAdditionalIntent('');
    setNarrativeRhythm(DEFAULT_NARRATIVE_RHYTHM);
    setAdvancedSettings(DEFAULT_ADVANCED_SETTINGS);
    setShowAdvanced(true);
    setSelectedNarrative(null);
    setUnits([]);
    setExhibitConfirmations({});
    setKeptExhibits({});
    setTextSections([]);
    setCurrentProject(null);
    setShowExport(false);
    setWarningVisible(true);
  }, []);

  const initializeProjectData = useCallback((step) => {
    if (step === 4) {
      const mockTextSections = generateDefaultTextSections(units.length > 0 ? units : [
        { title: '技术之光——东西工匠的智慧交融', desc: '冶金、纺织、玻璃制造' },
        { title: '艺术之韵——跨越地域的审美共鸣', desc: '壁画、雕塑、织锦' },
        { title: '信仰之桥——多元宗教的和平共处', desc: '佛教、祆教、景教' },
        { title: '丝路遗珍——穿越时空的记忆', desc: '地图、银币、瓷器' },
      ]);
      setTextSections(mockTextSections);
    }
  }, [units]);

  const buildLLMParams = useCallback(() => {
    if (!uploadedExhibits.length) return null;
    
    return {
      exhibition_title: exhibitTitle || null,
      exhibits: uploadedExhibits.map(ex => ({
        id: ex.id || ex.编号 || ex.ID || null,
        name: getExhibitName(ex) || null,
        time: getExhibitTime(ex) || null,
        place: getExhibitPlace(ex) || null,
        material: getExhibitMaterial(ex) || null,
        other: getExhibitOther(ex) || null,
        introduction: getExhibitIntroduction(ex) || null,
        image_url: getExhibitImage(ex) || null,
        // 兼容后端旧逻辑
        era: getExhibitTime(ex) || null,
        size: getExhibitOther(ex) || null,
        origin: getExhibitPlace(ex) || null,
        description: getExhibitIntroduction(ex) || null,
      })),
      additional_intent: additionalIntent || null,
      narrative_rhythm: narrativeRhythm,
      advanced_settings: normalizeAdvancedSettings(advancedSettings),
    };
  }, [exhibitTitle, uploadedExhibits, additionalIntent, narrativeRhythm, advancedSettings]);

  const completeProject = useCallback(async () => {
    if (currentProject) {
      try {
        const completedData = {
          narrative_title: currentProject.narrative?.title || exhibitTitle || '',
          units: units,
          text_sections: textSections,
          kept_exhibits: keptExhibits,
          exhibition_title: exhibitTitle || currentProject.exhibitionTitle || '',
          narrative: currentProject.narrative || {},
          narrative_options: narrativeOptions || [],
          selected_narrative: selectedNarrative ?? currentProject.selectedNarrative ?? null,
          llm_params: currentProject.llmParams || {
            exhibits: uploadedExhibits,
            exhibition_title: exhibitTitle,
            additional_intent: additionalIntent,
            narrative_rhythm: narrativeRhythm,
            advanced_settings: normalizeAdvancedSettings(advancedSettings),
          },
          uploaded_exhibits: uploadedExhibits || currentProject.uploadedExhibits || [],
          exhibit_confirmations: exhibitConfirmations,
        };
        
        await api.projects.complete(currentProject.id, completedData);
        
        setProjects(prev => prev.filter(p => p.id !== currentProject.id));
        setCompletedProjects(prev => [{
          ...currentProject,
          _fromApi: true,
          id: currentProject.id,
          title: currentProject.title,
          time: new Date().toLocaleDateString(),
          units: units,
          textSections: textSections,
          keptExhibits: keptExhibits,
          exhibitionTitle: exhibitTitle || currentProject.exhibitionTitle || '',
          narrative: currentProject.narrative || {},
          narrativeOptions: narrativeOptions || [],
          selectedNarrative: selectedNarrative ?? currentProject.selectedNarrative ?? null,
          llmParams: currentProject.llmParams,
          uploadedExhibits: uploadedExhibits || currentProject.uploadedExhibits || [],
          exhibitConfirmations: exhibitConfirmations,
        }, ...prev]);
      } catch (error) {
        console.error('保存完成项目失败:', error);
      }
    }
    setCurrentProject(null);
    resetProjectState();
    setCurrentPage('p0');
    setCurrentStep(1);
  }, [currentProject, units, textSections, keptExhibits, exhibitTitle, narrativeOptions, selectedNarrative, uploadedExhibits, additionalIntent, narrativeRhythm, exhibitConfirmations]);

  const sendEmailCode = useCallback(async (email) => {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    try {
      const response = await api.auth.sendCode({ email: normalizedEmail });
      showToast(response.message || '验证码已发送', 'success');
      if (response.debug_code) {
        showToast(`开发环境验证码：${response.debug_code}`, 'info', 5000);
      }
      return {
        success: true,
        email: response.email || normalizedEmail,
        debugCode: response.debug_code || '',
      };
    } catch (error) {
      showToast(error.message || '验证码发送失败', 'error');
      return { success: false, error: error.message };
    }
  }, [showToast]);

  const verifyEmailCode = useCallback(async (email, code) => {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedCode = String(code || '').trim();
    try {
      const response = await api.auth.verifyCode({ email: normalizedEmail, code: normalizedCode });
      if (!response.session) {
        throw new Error('登录成功但未获取到会话信息');
      }
      setAuthSession({
        ...response.session,
        user: response.user,
      });
      setAuthUser(response.user);
      setAuthPanelOpen(false);
      setAuthPromptMessage('');
      setProjects([]);
      setCompletedProjects([]);
      resetProjectState();
      setCurrentPage('p0');
      setCurrentStep(1);
      showToast(response.message || '登录成功', 'success');
      return { success: true };
    } catch (error) {
      showToast(error.message || '验证码校验失败', 'error');
      return { success: false, error: error.message };
    }
  }, [resetProjectState, showToast]);

  const logout = useCallback(() => {
    setAuthSession(null);
    setAuthUser(null);
    setAuthPanelOpen(false);
    setAuthPromptMessage('');
    setProjects([]);
    setCompletedProjects([]);
    resetProjectState();
    setCurrentPage('p0');
    setCurrentStep(1);
    showToast('已退出登录', 'info');
  }, [resetProjectState, showToast]);

  return {
    currentPage,
    setCurrentPage,
    currentStep,
    setCurrentStep,
    projects,
    setProjects,
    completedProjects,
    setCompletedProjects,
    currentProject,
    setCurrentProject,
    uploaded,
    setUploaded,
    uploadedFile,
    setUploadedFile,
    uploadedExhibits,
    setUploadedExhibits,
    exhibitTitle,
    setExhibitTitle,
    additionalIntent,
    setAdditionalIntent,
    narrativeRhythm,
    setNarrativeRhythm,
    advancedSettings,
    setAdvancedSettings,
    showAdvanced,
    setShowAdvanced,
    selectedNarrative,
    setSelectedNarrative,
    narrativeOptions,
    setNarrativeOptions,
    units,
    setUnits,
    exhibitConfirmations,
    setExhibitConfirmations,
    keptExhibits,
    setKeptExhibits,
    textSections,
    setTextSections,
    isGenerating,
    showExport,
    setShowExport,
    warningVisible,
    setWarningVisible,
    toast,
    showToast,
    darkMode,
    setDarkMode,
    authSession,
    authUser,
    authInitialized,
    isLoggedIn,
    guestUserId,
    activeUserId,
    authPanelOpen,
    setAuthPanelOpen,
    authPromptMessage,
    setAuthPromptMessage,
    requireLogin,
    sendEmailCode,
    verifyEmailCode,
    logout,
    navigateTo,
    goToStep,
    goNextStep,
    goPrevStep,
    createNewProject,
    openProject,
    resetProjectState,
    completeProject,
    buildLLMParams,
    saveAIGeneratedData,
    generateStep2Data,
    refreshProjects,
  };
}
