import axios from 'axios';

// Configure Axios with baseURL pointing to backend API (port 5000)
// and credentials enabled to allow cookie transmission.
const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor
api.interceptors.request.use(
  (config) => {
    // The frontend and backend live on different domains, and many mobile
    // browsers now block cross-site cookies by default — so the httpOnly
    // cookie alone can silently fail to be sent. As a reliable fallback,
    // also attach the JWT we stored at login as a Bearer header.
    const token = localStorage.getItem('omnichat_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // If a request fails with 401 UnAuthorized, it indicates session expiration.
    // In this case, we could clear local storage, but we leave handling to AuthContext
    // or specific component flows.
    return Promise.reject(error);
  }
);

export default api;
