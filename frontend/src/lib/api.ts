import axios, { type AxiosRequestConfig } from "axios";
import { useAuthStore } from "@/store/auth-store";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  // Required so the browser sends the httpOnly refresh-token cookie
  withCredentials: true,
});

// ---------------------------------------------------------------------------
// Thundering-herd mutex
// If multiple 401s arrive simultaneously only ONE /auth/refresh call is fired.
// All other inflight requests are queued and resolved/rejected together.
// ---------------------------------------------------------------------------
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

function flushQueue(error: unknown, token?: string) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });
  failedQueue = [];
}

// ---------------------------------------------------------------------------
// Request interceptor — attach Access Token
// ---------------------------------------------------------------------------
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ---------------------------------------------------------------------------
// Response interceptor — handle 401 with refresh, then retry
// ---------------------------------------------------------------------------
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest: AxiosRequestConfig & { _retry?: boolean } =
      error.config ?? {};

    if (error.code === "ERR_NETWORK" || error.message === "Network Error") {
      console.error("[API] Network Error:", {
        url: originalRequest.url,
        method: originalRequest.method,
      });
    }

    // Only attempt refresh on 401, and not for the refresh endpoint itself
    const is401 = error.response?.status === 401;
    const isRefreshEndpoint = originalRequest.url?.includes("/auth/refresh");
    const alreadyRetried = originalRequest._retry;

    if (!is401 || isRefreshEndpoint || alreadyRetried) {
      if (is401) {
        // Refresh itself failed — hard logout
        useAuthStore.getState().logout();
        window.location.href = "/login";
      }
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // Queue this request until the in-flight refresh settles
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers = {
          ...originalRequest.headers,
          Authorization: `Bearer ${token}`,
        };
        return api(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      // The refresh token is in an httpOnly cookie — no body needed
      const { data } = await api.post<{ access_token: string }>("/auth/refresh");
      const newToken = data.access_token;

      useAuthStore.getState().setToken(newToken);
      api.defaults.headers.common.Authorization = `Bearer ${newToken}`;
      flushQueue(null, newToken);

      originalRequest.headers = {
        ...originalRequest.headers,
        Authorization: `Bearer ${newToken}`,
      };
      return api(originalRequest);
    } catch (refreshError) {
      flushQueue(refreshError);
      useAuthStore.getState().logout();
      window.location.href = "/login";
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);
