import axios from 'axios';

// 生产环境默认同源访问 API；开发环境由 Vite proxy 负责转发。
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const EXHIBIT_PARSE_START_TIMEOUT = 30 * 60 * 1000;
const EXHIBIT_PARSE_POLL_INTERVAL_MS = 1200;
const AI_GENERATION_TIMEOUT = 3 * 60 * 1000;
const AI_UNITS_GENERATION_TIMEOUT = 3 * 60 * 1000;
const AI_BATCH_GENERATION_TIMEOUT = 5 * 60 * 1000;
const AUTH_STORAGE_KEY = 'curation_auth_session';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
});

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

apiClient.interceptors.request.use((config) => {
  const session = readStoredAuthSession();
  const token = session?.access_token;
  if (token && !config.headers?.Authorization) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`,
    };
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.code === 'ECONNABORTED') {
      const url = String(error.config?.url || '');
      if (url.includes('/ai/units')) {
        return Promise.reject(new Error('单元结构生成超时，请稍后重试；如果展品较多，请减少单次展品数量或稍后再试。'));
      }
      if (url.includes('/exhibits/parse-template')) {
        return Promise.reject(new Error('展品清单解析超时，请稍后重试；如果上传的是带大量图片的 Excel，请尽量控制文件大小。'));
      }
      if (url.includes('/ai/')) {
        return Promise.reject(new Error('AI 生成超时，请稍后重试。'));
      }
      return Promise.reject(new Error('请求超时，请稍后重试。'));
    }
    if (error.response?.status !== 404) {
      const message = error.response?.data?.detail || error.message || '请求失败';
      console.error('API Error:', message);
    }
    return Promise.reject(new Error(error.response?.data?.detail || error.message || '请求失败'));
  }
);

const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

async function waitForExhibitParseTask(taskId, options = {}) {
  const intervalMs = Number(options.intervalMs || EXHIBIT_PARSE_POLL_INTERVAL_MS);

  for (let attempt = 0; attempt < 1800; attempt += 1) {
    const task = await apiClient.get(`/exhibits/parse-template-tasks/${taskId}`, {
      params: options.userId ? { user_id: options.userId } : undefined,
    });
    options.onTaskProgress?.(task);

    if (task.status === 'success') {
      return task.result;
    }
    if (task.status === 'failed') {
      throw new Error(task.error || '文件解析失败');
    }

    await sleep(intervalMs);
  }

  throw new Error('解析任务等待超时，请稍后重试。');
}

export const api = {
  auth: {
    sendCode: (data) => apiClient.post('/auth/send-code', data),
    verifyCode: (data) => apiClient.post('/auth/verify-code', data),
    me: (token) => apiClient.get('/auth/me', { headers: { Authorization: `Bearer ${token}` } }),
  },

  projects: {
    list: (userId) => apiClient.get('/projects', { params: { user_id: userId } }),
    get: (projectId) => apiClient.get(`/projects/${projectId}`),
    create: (data) => apiClient.post('/projects', data),
    update: (projectId, data) => apiClient.put(`/projects/${projectId}`, data),
    delete: (projectId) => apiClient.delete(`/projects/${projectId}`),
    versions: (projectId) => apiClient.get(`/projects/${projectId}/versions`),
    getUnits: (projectId) => apiClient.get(`/projects/${projectId}/units`),
    createUnit: (data) => apiClient.post('/projects/units', data),
    updateUnit: (unitId, data) => apiClient.put(`/projects/units/${unitId}`, data),
    deleteUnit: (unitId) => apiClient.delete(`/projects/units/${unitId}`),
    getTextSections: (projectId) => apiClient.get(`/projects/${projectId}/text-sections`),
    createTextSection: (data) => apiClient.post('/projects/text-sections', data),
    updateTextSection: (sectionId, data) => apiClient.put(`/projects/text-sections/${sectionId}`, data),
    deleteTextSection: (sectionId) => apiClient.delete(`/projects/text-sections/${sectionId}`),
    complete: (projectId, data) => apiClient.post(`/projects/${projectId}/complete`, data),
    getCompletedList: (userId) => apiClient.get('/projects/completed/list', { params: { user_id: userId } }),
    getCompleted: (projectId) => apiClient.get(`/projects/completed/${projectId}`),
    deleteCompleted: (projectId) => apiClient.delete(`/projects/completed/${projectId}`),
  },
  
  exhibits: {
    list: (params) => apiClient.get('/exhibits', { params }),
    getAll: (params = {}) => apiClient.get('/exhibits/all', { params }),
    search: (keyword, params = {}) => apiClient.get('/exhibits/search', { params: { keyword, ...params } }),
    startParseTemplateTask: (file, options = {}) => {
      const formData = new FormData();
      formData.append('file', file);
      return apiClient.post('/exhibits/parse-template', formData, {
        params: options.userId ? { user_id: options.userId } : undefined,
        timeout: EXHIBIT_PARSE_START_TIMEOUT,
        onUploadProgress: options.onUploadProgress,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
    },
    getParseTemplateTask: (taskId, params = {}) => apiClient.get(`/exhibits/parse-template-tasks/${taskId}`, { params }),
    parseTemplate: async (file, options = {}) => {
      const task = await api.exhibits.startParseTemplateTask(file, options);
      options.onTaskProgress?.(task);
      return waitForExhibitParseTask(task.task_id, options);
    },
    get: (exhibitId, params = {}) => apiClient.get(`/exhibits/${exhibitId}`, { params }),
    create: (data, params = {}) => apiClient.post('/exhibits', data, { params }),
    update: (exhibitId, data, params = {}) => apiClient.put(`/exhibits/${exhibitId}`, data, { params }),
    delete: (exhibitId, params = {}) => apiClient.delete(`/exhibits/${exhibitId}`, { params }),
    createBatch: (data, params = {}) => apiClient.post('/exhibits/batch', data, { params }),
    deleteAll: (params = {}) => apiClient.delete('/exhibits/all', { params }),
  },
  
  ai: {
    generateNarrative: (data) => apiClient.post('/ai/narrative', data),
    generateUnits: (data) => apiClient.post('/ai/units', data, { timeout: AI_UNITS_GENERATION_TIMEOUT }),
    recommendExhibits: (data) => apiClient.post('/ai/recommend', data),
    recommendExhibitsBatch: (data) => apiClient.post('/ai/recommend-batch', data),
    generateTextSectionsBatch: (data) => apiClient.post('/ai/text-sections-batch', data, { timeout: AI_BATCH_GENERATION_TIMEOUT }),
    generateTextSection: (data) => apiClient.post('/ai/text-section', data, { timeout: AI_GENERATION_TIMEOUT }),
    generatePreface: (exhibitionTitle, unitCount, narrative, narrativeRhythm) => 
      apiClient.post('/ai/preface', {}, { timeout: AI_GENERATION_TIMEOUT, params: { exhibition_title: exhibitionTitle, unit_count: unitCount, narrative_title: narrative?.title || '', narrative_desc: narrative?.desc || '', narrative_rhythm: narrativeRhythm ? JSON.stringify(narrativeRhythm) : '' } }),
    generateEpilogue: (exhibitionTitle, unitCount, narrative, narrativeRhythm) => 
      apiClient.post('/ai/epilogue', {}, { timeout: AI_GENERATION_TIMEOUT, params: { exhibition_title: exhibitionTitle, unit_count: unitCount, narrative_title: narrative?.title || '', narrative_desc: narrative?.desc || '', narrative_rhythm: narrativeRhythm ? JSON.stringify(narrativeRhythm) : '' } }),
    generateOutline: (data) => apiClient.post('/ai/outline', data),
    health: () => apiClient.get('/ai/health'),
  },
  
  health: () => apiClient.get('/health'),
};

export default api;
