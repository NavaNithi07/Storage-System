import axios from 'axios';

export const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    timeout: 0,
});
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        // Log network errors for debugging
        if (!error.response) {
            console.error('[API] Network error:', error.message, '\nURL:', error.config?.url);
        }
        
        const originalRequest = error.config;
        if (error.response && error.response.status === 401 && !originalRequest._retry) {
            const url = originalRequest.url || '';
            // Only retry if the failed request was NOT a login/register/refresh/google attempt
            if (!url.includes('/auth/login') && !url.includes('/auth/register') && !url.includes('/auth/refresh') && !url.includes('/auth/google')) {
                originalRequest._retry = true;
                const refreshToken = localStorage.getItem('refreshToken');
                if (refreshToken) {
                    try {
                        console.log('[API] Attempting automatic token refresh...');
                        // Use a fresh axios instance or plain request to avoid recursion loops
                        const res = await axios.post(`${API_BASE_URL}/auth/refresh`, { token: refreshToken });
                        const newToken = res.data.token;
                        if (newToken) {
                            console.log('[API] Token refresh succeeded. Retrying request.');
                            localStorage.setItem('token', newToken);
                            originalRequest.headers.Authorization = `Bearer ${newToken}`;
                            return api(originalRequest);
                        }
                    } catch (refreshError) {
                        console.error('[API] Automatic token refresh failed:', refreshError.message);
                    }
                }
                
                // If refresh token was not present or failed, perform logout
                console.warn('[API] Token refresh failed or unavailable — clearing auth data');
                localStorage.removeItem('token');
                localStorage.removeItem('userInfo');
                localStorage.removeItem('refreshToken');
                if (!window.location.pathname.includes('/login')) {
                    window.location.href = '/login';
                }
            }
        }
        return Promise.reject(error);
    }
);

export default api;
