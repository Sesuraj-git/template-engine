"use client";
import { triggerSessionUpdate } from "@/store/session-store";
import axios, {
  AxiosInstance,
  InternalAxiosRequestConfig,
  AxiosResponse,
} from "axios";

function getBackendUrl(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("backend_url") || "";
}

function getRefreshApi(): string {
  return `${getBackendUrl()}/auth/refresh-token`;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Decode a JWT payload without verifying the signature. */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const base64 = token.split(".")[1];
    return JSON.parse(Buffer.from(base64, "base64url").toString("utf-8"));
  } catch {
    return null;
  }
}

/** Navigate to the login page and sign out from NextAuth. */
async function handleAuthFailure(): Promise<void> {
  localStorage.clear();

  window.location.href = "/login";
}

// ─── Refresh mutex ──────────────────────────────────────────────────────────
// Prevents multiple simultaneous refresh calls when several requests fail
// at the same time.

let isRefreshing = false;

type QueueItem = {
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
};

let failedQueue: QueueItem[] = [];

function processQueue(error: unknown, token: string | null): void {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error || !token) {
      reject(error);
    } else {
      resolve(token);
    }
  });
  failedQueue = [];
}

// ─── Axios instance ──────────────────────────────────────────────────────────

const api: AxiosInstance = axios.create({
  baseURL: getBackendUrl(),
  headers: { "Content-Type": "application/json" },
});

// ── Request interceptor: attach bearer token + dynamic baseURL ───────────────
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // Resolve baseURL at request time (handles late localStorage writes)
    const url = getBackendUrl();
    if (url) config.baseURL = url;

    const accessToken = localStorage.getItem("accessToken");
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ── Response interceptor: refresh on 400 / 401 and retry ────────────────────
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };
    const status: number | undefined = error.response?.status;

    // Only intercept 401 on the first attempt
    if (status === 401 && !originalRequest._retry) {
      // Queue concurrent requests while a refresh is in-flight
      if (isRefreshing) {
        return new Promise<AxiosResponse>((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(api(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Get current session to read refreshToken + user_role_id
        const accessToken = localStorage.getItem("accessToken");
        const refreshToken = localStorage.getItem("refreshToken");
        if (!accessToken) {
          throw new Error("No access token available");
        }
        if (!refreshToken) {
          throw new Error("No refresh token available");
        }

        const decoded = decodeJwtPayload(accessToken);
        const userRoleId = decoded?.user_role_id as string | undefined;

        // Call the refresh endpoint directly
        const body: Record<string, string> = {
          refresh_token: refreshToken,
        };
        if (userRoleId) body.user_role_id = userRoleId;

        const refreshRes = await axios.put(getRefreshApi(), body);
        const { token: newAccessToken, refresh: newRefreshToken } =
          refreshRes.data as { token: string; refresh: string };

        // Persist new tokens into the NextAuth JWT cookie via update()
        // Use a timeout to prevent indefinite hanging if NextAuth update() fails to resolve
        await Promise.race([
          triggerSessionUpdate({
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Session update timeout")), 3000),
          ),
        ]).catch((err) => console.warn("Session update warning:", err));

        processQueue(null, newAccessToken);

        // Retry the original request with the new token
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);

        // If the refresh itself returned 400, or any failure → logout
        await handleAuthFailure();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default api;
