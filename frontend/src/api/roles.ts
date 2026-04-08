import { api } from "@/lib/api";

export interface Role {
  id: number;
  name: string;
  description: string | null;
  permissions: string[];
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const rolesApi = {
  list: async (): Promise<Role[]> => {
    const response = await api.get("/roles");
    return response.data;
  },

  listAll: async (): Promise<Role[]> => {
    const response = await api.get("/roles/all");
    return response.data;
  },

  get: async (id: number): Promise<Role> => {
    const response = await api.get(`/roles/${id}`);
    return response.data;
  },

  create: async (data: Partial<Role>): Promise<Role> => {
    const response = await api.post("/roles", data);
    return response.data;
  },

  update: async (id: number, data: Partial<Role>): Promise<Role> => {
    const response = await api.patch(`/roles/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/roles/${id}`);
  },
};
