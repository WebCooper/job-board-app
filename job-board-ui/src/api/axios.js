import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_GATEWAY_URL,
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
        console.log('No token available or user not logged in. Sending request without token.');
      }

      return config;
    },
    (error) => Promise.reject(error),
  );

  interceptorRegistered = true;
};

export default api;
