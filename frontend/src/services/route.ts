
/**
 * Email Route API サービス
 */

import { api } from "./api";


export interface EmailRoute {
  id: string;
  emailAddress: string;
  userId: string;
  isActive: boolean;
  createdAt: number;
}


export async function getEmailRoute(token: string): Promise<EmailRoute> {
    return api.get<EmailRoute>('/email-route', token)
}