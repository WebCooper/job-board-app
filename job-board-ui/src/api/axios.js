import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:80',
});

let interceptorRegistered = false;

// Registers a single interceptor that adds the current Auth0 access token.
export const setupInterceptor = (getAccessTokenSilently) => {
  if (interceptorRegistered) {
    return;
  }

  api.interceptors.request.use(
    async (config) => {
      try {
        const token = await getAccessTokenSilently();
        config.headers.Authorization = `Bearer ${token}`;
      } catch (_error) {
        console.warn('No token available. Request will be sent anonymously.');
      }

      return config;
    },
    (error) => Promise.reject(error),
  );

  interceptorRegistered = true;
};

export default api;
