import { apiGet, apiPost } from "../api/client";
import type { Transaction } from "../types";

export type PaymentMethod = "kakaopay" | "toss" | "card";

export async function chargeWithKakaopay(amount: number): Promise<string> {
  const result = await apiPost<{ redirectUrl: string }>("/payments/kakaopay/ready", { amount });
  return result.redirectUrl;
}

export async function chargeWithTossReady(
  amount: number
): Promise<{ orderId: string; paymentAmount: number; vat: number }> {
  return apiPost("/payments/toss/ready", { amount });
}

export async function chargeWithTossApprove(
  paymentKey: string,
  orderId: string,
  amount: number
): Promise<{ pointAmount: number }> {
  return apiPost("/payments/toss/approve", { paymentKey, orderId, amount });
}

export async function purchaseMaterial(materialId: string): Promise<void> {
  await apiPost(`/materials/${materialId}/purchase`);
}

export async function getTransactions(
  _userId: string,
  count: number = 20
): Promise<Transaction[]> {
  return apiGet<Transaction[]>(`/users/me/transactions?limit=${count}`);
}

export async function hasPurchased(
  _userId: string,
  materialId: string
): Promise<boolean> {
  const result = await apiGet<{ purchased: boolean }>(`/users/me/purchases/check?materialId=${materialId}`);
  return result.purchased;
}
