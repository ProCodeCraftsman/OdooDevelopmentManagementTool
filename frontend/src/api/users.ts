import { api } from "@/lib/api";
import type { Role } from "./roles";

export interface User {
  id: number;
  username: string;
  email: string;
  is_active: boolean;
  is_admin: boolean;
  role_id: number | null;
  role: Pick<Role, "id" | "name" | "priority"> | null;
}

export interface UserUpdate {
  username?: string;
  email?: string;
  password?: string;
  is_admin?: boolean;
  is_active?: boolean;
  role_id?: number | null;
}

export const usersApi = {
  list: async (): Promise<User[]> => {
    const response = await api.get("/users");
    return response.data;
  },

  get: async (id: number): Promise<User> => {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },

  update: async (id: number, data: UserUpdate): Promise<User> => {
    const response = await api.patch(`/users/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/users/${id}`);
  },
};
