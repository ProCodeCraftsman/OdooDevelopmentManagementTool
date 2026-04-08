import { api } from "@/lib/api";
import type { QueryState } from "@/api/development-requests";

export interface SavedView {
  id: number;
  user_id: number;
  name: string;
  is_public: boolean;
  query_state: QueryState;
  created_at: string;
  updated_at: string;
  owner_username?: string;
}

export interface SavedViewCreate {
  name: string;
  is_public: boolean;
  query_state: QueryState;
}

export interface SavedViewUpdate {
  name?: string;
  is_public?: boolean;
  query_state?: QueryState;
}

export const savedViewsApi = {
  list: async (): Promise<SavedView[]> => {
    const res = await api.get<SavedView[]>("/saved-views/");
    return res.data;
  },

  create: async (data: SavedViewCreate): Promise<SavedView> => {
    const res = await api.post<SavedView>("/saved-views/", data);
    return res.data;
  },

  update: async (id: number, data: SavedViewUpdate): Promise<SavedView> => {
    const res = await api.put<SavedView>(`/saved-views/${id}`, data);
    return res.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/saved-views/${id}`);
  },
};
