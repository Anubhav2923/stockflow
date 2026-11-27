import type {z} from 'zod';
import type { loginSchema } from "./auth.validation.ts";

export type LoginInput = z.infer<typeof loginSchema>;

export interface AuthUser {
    id: string;
    username: string;
}

export interface LoginResponse {
    user: AuthUser;
    accessToken: string;
    tokenType: "Bearer";
    expiresIn: number;
}
