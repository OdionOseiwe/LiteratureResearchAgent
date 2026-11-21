import axios from 'axios';

const api = axios.create({ baseURL: '/api', timeout: 30000 });

export async function startResearch(payload) {
  const { data } = await api.post('/research', payload);
  return data; // { ok, id, status }
}

export async function fetchResearch(id) {
  const { data } = await api.get(`/research/${id}`);
  return data.research;
}

export async function fetchReport(id) {
  const { data } = await api.get(`/research/${id}/report`);
  return data; // { ok, report, meta }
}

export async function fetchSources(id) {
  const { data } = await api.get(`/research/${id}/sources`);
  return data; // { ok, sources, total }
}

export async function fetchHistory({ q = '', page = 1, limit = 12 } = {}) {
  const { data } = await api.get('/research/history', { params: { q, page, limit } });
  return data;
}

export async function deleteResearch(id) {
  const { data } = await api.delete(`/research/${id}`);
  return data;
}

/** Build the absolute URL used by the <a download> for PDF downloads. */
export function pdfDownloadUrl(id) {
  return `/api/research/${id}/pdf`;
}

export default api;
