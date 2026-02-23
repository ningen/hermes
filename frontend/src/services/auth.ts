/**
 * 認証 API サービス
 */

import { api } from './api';

interface User {
  id: string;
  email: string;
  name: string | null;
}

interface AuthResponse {
  user: User;
  token: string;
}

interface MeResponse {
  user: User;
}

export async function register(
  email: string,
  password: string,
  name?: string
): Promise<AuthResponse> {
  return api.post<AuthResponse>('/auth/register', { email, password, name });
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  return api.post<AuthResponse>('/auth/login', { email, password });
}

export async function getMe(token: string): Promise<MeResponse> {
  return api.get<MeResponse>('/auth/me', token);
}

export async function logout(token: string): Promise<void> {
  await api.post('/auth/logout', {}, token);
}
