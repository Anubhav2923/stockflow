import axios from "axios";
import { QueryClient, useQuery } from "@tanstack/react-query";

export const origin =
  import.meta.env.VITE_API_ORIGIN || "http://localhost:5000";
export const api = axios.create({
  baseURL: origin + "/api/v1",
  timeout: 15000,
});
export const queries = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 3000, refetchInterval: 15000 },
  },
});
export const authKey = "stockflow.token";
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem(authKey);
  if (token) config.headers.Authorization = "Bearer " + token;
  return config;
});
api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401 && sessionStorage.getItem(authKey)) {
      sessionStorage.removeItem(authKey);
      location.replace("/login");
    }
    return Promise.reject(error);
  },
);
export function message(error: unknown) {
  if (axios.isAxiosError(error))
    return String(
      error.response?.data?.error?.details?.[0]?.message ||
        error.response?.data?.message ||
        error.message,
    );
  return error instanceof Error ? error.message : "Request failed";
}
export async function read<T>(path: string): Promise<T> {
  return (await api.get(path)).data.data;
}
export function useData<T>(path: string) {
  return useQuery({ queryKey: [path], queryFn: () => read<T>(path) });
}
export type Product = {
  id: number;
  name: string;
  sku: string;
  category: string | null;
  description: string | null;
  remainingQuantity: number;
  isActive: boolean;
};
export type Batch = {
  id: number;
  receivedAt: string;
  receivedQuantity: number;
  remainingQuantity: number;
  unitCost: string;
};
export type Inventory = Product & {
  batches: Batch[];
  value: string;
  averageCost: string;
};
export type Entry = {
  id: number;
  type: "PURCHASE" | "SALE";
  productId: number;
  product: { name: string; sku: string };
  at: string;
  quantity: number;
  unitPrice: string;
  amount: string;
  cogs: string;
  allocations: { batchId: number; quantity: number; unitCost: string }[];
};
export type Totals = {
  stock: number;
  value: string;
  cogs: string;
  purchaseCost: string;
  averageCost: string;
};
export type Receipt = {
  eventId: string;
  status: string;
  reason?: string;
  resultId?: number;
  eventType: string;
  productId: number;
  quantity?: number;
  unitPrice?: string;
};
// Format PostgreSQL decimal strings directly, retaining precision even for large balances.
const rupees = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 4,
});
export const money = (v: string | number) => rupees.format(v as number);
export const date = (v: string) =>
  new Date(v).toLocaleString("en-IN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
export function toast(text: string) {
  window.dispatchEvent(new CustomEvent("stockflow:toast", { detail: text }));
}
