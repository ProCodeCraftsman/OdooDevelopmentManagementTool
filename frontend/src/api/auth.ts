import { api } from "@/lib/api";
import type { TokenRequest, TokenResponse, UserCreate, User } from "@/types/api";

export const authApi = {
  login: async (data: TokenRequest): Promise<TokenResponse> => {
    const response = await api.post<TokenResponse>("/auth/token", data);
    return response.data;
  },
  register: async (data: UserCreate): Promise<User> => {
    const response = await api.post<User>("/auth/register", data);
    return response.data;
  },
};
