import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export const predictSeverity = async (payload) => {
  const res = await axios.post(`${BASE_URL}/predict`, payload);
  return res.data;
};

export const optimizeResources = async (payload) => {
  const res = await axios.post(`${BASE_URL}/optimize`, payload);
  return res.data;
};