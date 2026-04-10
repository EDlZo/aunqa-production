// API Configuration
// ใช้ environment variables เพื่อความยืดหยุ่นในการ deploy

// Base URL จาก environment variable หรือ default
export const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// API endpoints
export const API_ENDPOINTS = {
  LOGIN: `${BASE_URL}/api/login`,
  QUALITY_COMPONENTS: `${BASE_URL}/api/quality-components`,
  INDICATORS: `${BASE_URL}/api/indicators`,
  INDICATORS_BY_COMPONENT: `${BASE_URL}/api/indicators-by-component`,
  EVALUATIONS: `${BASE_URL}/api/evaluations`,
  EVALUATIONS_ACTUAL: `${BASE_URL}/api/evaluations-actual`,
  COMMITTEE_EVALUATIONS: `${BASE_URL}/api/committee-evaluations`,
  ASSESSMENT_SESSIONS: `${BASE_URL}/api/assessment-sessions`,
  VIEW_FILE: `${BASE_URL}/api/view`,
  INDICATOR_DETAIL: `${BASE_URL}/api/indicator-detail`,
  PING: `${BASE_URL}/api/ping`
};

// Helper function สำหรับสร้าง URL พร้อม query parameters
export const buildApiUrl = (endpoint, params = {}) => {
  const url = new URL(endpoint);
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== null) {
      url.searchParams.append(key, params[key]);
    }
  });
  return url.toString();
};

// Environment information
export const ENV_INFO = {
  NODE_ENV: import.meta.env.MODE,
  API_BASE_URL: BASE_URL,
  IS_DEVELOPMENT: import.meta.env.DEV,
  IS_PRODUCTION: import.meta.env.PROD
};