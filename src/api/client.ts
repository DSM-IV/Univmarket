import { auth } from "../firebase";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

/**
 * Spring Boot REST API 클라이언트.
 * 모든 요청에 Firebase ID Token을 자동 첨부한다.
 */
async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "요청에 실패했습니다." }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function apiGet<T>(path: string): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}${path}`, { headers });
  return handleResponse<T>(res);
}

/**
 * 배열을 기대하는 GET 호출. 백엔드가 Spring Data Page({content, ...})로 돌려줘도
 * content를 꺼내 주고, null/비배열이면 빈 배열로 정규화한다.
 */
export async function apiGetList<T>(path: string): Promise<T[]> {
  const res = await apiGet<unknown>(path);
  if (Array.isArray(res)) return res as T[];
  if (res && typeof res === "object" && Array.isArray((res as { content?: unknown }).content)) {
    return (res as { content: T[] }).content;
  }
  return [];
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return handleResponse<T>(res);
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PATCH",
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return handleResponse<T>(res);
}

export async function apiDelete<T>(path: string, body?: unknown): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return handleResponse<T>(res);
}
