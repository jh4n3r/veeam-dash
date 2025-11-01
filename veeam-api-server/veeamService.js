// veeam-api-server/veeamService.js
const axios = require('axios');
const https = require('https');

// Agentes HTTPS (uno para cada API)
const vbrAgent = new https.Agent({ rejectUnauthorized: false });
const oneAgent = new https.Agent({ rejectUnauthorized: false });

// --- Configuración VBR (Puerto 9419) ---
const VBR_SERVER = process.env.VEEAM_SERVER;
const VBR_PORT = process.env.VEEAM_PORT;
const VBR_USER = process.env.VEEAM_USER;
const VBR_PASS = process.env.VEEAM_PASS;
const VBR_API_VERSION = process.env.VEEAM_API_VERSION;

// --- Configuración Veeam ONE (Puerto 1239) ---
const ONE_SERVER = process.env.VEEAM_ONE_SERVER;
const ONE_PORT = process.env.VEEAM_ONE_PORT;
const ONE_USER = process.env.VEEAM_ONE_USER;
const ONE_PASS = process.env.VEEAM_ONE_PASS;
const ONE_BASE_URL = `https://${ONE_SERVER}:${ONE_PORT}/api`;

// ==========================================================
// --- LÓGICA DE API VBR (PUERTO 9419) ---
// ==========================================================
let vbrToken = null;
let vbrExpiry = new Date(0);
let isFetchingVBRToken = false;
let vbrTokenPromise = null;

const getAuthTokenVBR = () => {
  if (new Date() < vbrExpiry) return Promise.resolve(vbrToken);
  if (isFetchingVBRToken) return vbrTokenPromise;

  const params = new URLSearchParams();
  params.append('grant_type', 'password');
  params.append('username', VBR_USER);
  params.append('password', VBR_PASS);

  const url = `https://${VBR_SERVER}:${VBR_PORT}/api/oauth2/token`;
  console.log(`VBR Token: ${url}`);

  isFetchingVBRToken = true;
  vbrTokenPromise = new Promise(async (resolve, reject) => {
    try {
      const { data } = await axios.post(url, params, {
        httpsAgent: vbrAgent,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'x-api-version': VBR_API_VERSION
        }
      });
      vbrToken = data.access_token;
      vbrExpiry = new Date(Date.now() + (data.expires_in - 60) * 1000);
      console.log("VBR Token OK!");
      resolve(vbrToken);
    } catch (error) {
      console.error("Error token VBR:", error.response?.data || error.message);
      reject(error);
    } finally {
      isFetchingVBRToken = false;
    }
  });
  return vbrTokenPromise;
};

const veamGetVBR = async (endpoint, params = {}) => {
  const token = await getAuthTokenVBR();
  const url = `https://${VBR_SERVER}:${VBR_PORT}/api/v1/${endpoint}`;
  console.log(`VBR_GET: ${url}`, params); 
  try {
    const { data } = await axios.get(url, {
      httpsAgent: vbrAgent,
      headers: { 'Authorization': `Bearer ${token}`, 'x-api-version': VBR_API_VERSION },
      params: params
    });
    console.log(`VBR 200 ${endpoint}`);
    return data;
  } catch (error) {
    if (error.response?.status === 401) {
      vbrToken = null; vbrExpiry = new Date(0);
      return veamGetVBR(endpoint, params);
    }
    console.warn(`VBR ${error.response?.status || 'Error'} en ${endpoint} → []`);
    return { data: [], pagination: {} }; 
  }
};

const getRestorePointsVBR = async (objectId) => {
  const token = await getAuthTokenVBR();
  const url = `https://${VBR_SERVER}:${VBR_PORT}/api/v1/backupObjects/${objectId}/restorePoints`;
  try {
    const { data } = await axios.get(url, {
      httpsAgent: vbrAgent,
      headers: { 'Authorization': `Bearer ${token}`, 'x-api-version': VBR_API_VERSION }
    });
    return data.data || [];
  } catch (error) {
    console.warn(`Error VBR restorePoints ${objectId}`);
    return [];
  }
};

// ==========================================================
// --- LÓGICA DE API VEEAM ONE (PUERTO 1239) ---
// ==========================================================
let oneToken = null;
let oneExpiry = new Date(0);
let isFetchingONEToken = false;
let oneTokenPromise = null;

const getAuthTokenONE = () => {
  if (new Date() < oneExpiry) return Promise.resolve(oneToken);
  if (isFetchingONEToken) return oneTokenPromise;

  const params = new URLSearchParams();
  params.append('grant_type', 'password');
  params.append('username', ONE_USER);
  params.append('password', ONE_PASS);

  const url = `${ONE_BASE_URL}/token`;
  console.log(`VeeamONE Token: ${url}`);

  isFetchingONEToken = true;
  oneTokenPromise = new Promise(async (resolve, reject) => {
    try {
      const { data } = await axios.post(url, params, {
        httpsAgent: oneAgent,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      oneToken = data.access_token;
      oneExpiry = new Date(Date.now() + (data.expires_in - 60) * 1000);
      console.log("VeeamONE Token OK!");
      resolve(oneToken);
    } catch (error) {
      console.error("Error en token de VeeamONE:", error.response?.data || error.message);
      reject(error);
    } finally {
      isFetchingONEToken = false;
    }
  });
  return oneTokenPromise;
};

const veamGetONE = async (endpoint, params = {}) => {
  const token = await getAuthTokenONE();
  const url = `${ONE_BASE_URL}/v2.2/${endpoint}`; // v2.2 de tu swagger.json
  console.log(`VEEAM_ONE_GET: ${url}`, params); 
  try {
    const { data } = await axios.get(url, {
      httpsAgent: oneAgent,
      headers: { 'Authorization': `Bearer ${token}` },
      params: params
    });
    console.log(`VeeamONE 200 ${endpoint}`);
    // La API de Veeam ONE encapsula los datos en 'items'
    return data.items ? { data: data.items, pagination: {} } : { data: data, pagination: {} };
  } catch (error) {
    if (error.response?.status === 401) {
      oneToken = null; oneExpiry = new Date(0);
      return veamGetONE(endpoint, params);
    }
    console.warn(`VeeamONE ${error.response?.status || 'Error'} en ${endpoint} → []`);
    return { data: [], pagination: {} }; 
  }
};

// ==========================================================
// --- EXPORTS UNIFICADOS ---
// ==========================================================
module.exports = {
  // --- Funciones de VBR (9419) ---
  getSessions: () => veamGetVBR('sessions', {
    'limit': 2000,
    'sort': '-creationTime',
    // Filtro comentado, ya que el admin ve todo y VBR no devuelve
    // los jobs de Tape/Copy/Agent en este endpoint de todos modos.
  }),
  getServerInfo: () => veamGetVBR('serverInfo'),
  getManagedServers: () => veamGetVBR('backupInfrastructure/managedServers'),
  getBackupObjects: () => veamGetVBR('backupObjects'),
  getRestorePoints: getRestorePointsVBR,

  // --- Funciones de Veeam ONE (1239) ---
  // Los jobs que nos faltaban
  getBackupToTapeJobs: () => veamGetONE('vbrJobs/backupToTapeJobs'),
  getBackupCopyJobs: () => veamGetONE('vbrJobs/backupCopyJobs'),
  getAgentBackupJobs: () => veamGetONE('vbrJobs/agentBackupJobs'),
  
  // Los reemplazos (mejorados)
  getProxies: () => veamGetONE('vbr/backupProxies'),
  getRepositories: () => veamGetONE('vbr/repositories'),
};