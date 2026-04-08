import { api } from "@/lib/api";
import type { Role } from "./roles";

export interface User {
  id: number;
  username: string;
  email: string;
  is_active: boolean;
  roles: Pick<Role, "id" | "name" | "priority" | "permissions">[];
}

export interface UserCreate {
  username: string;
  email: string;
  password: string;
  role_ids: number[];
}

export interface UserUpdate {
  username?: string;
  email?: string;
  password?: string;
  is_active?: boolean;
  role_ids?: number[];
}

export const usersApi = {
  list: async (): Promise<User[]> => {
    const response = await api.get("/users");
    return response.data;
  },

  listAssignable: async (): Promise<User[]> => {
    const response = await api.get("/users/assignable");
    return response.data;
  },

  get: async (id: number): Promise<User> => {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },

  create: async (data: UserCreate): Promise<User> => {
    const response = await api.post("/users", data);
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
