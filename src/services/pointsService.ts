import { apiGet, apiGetList, apiPost } from "../api/client";
import type { Transaction } from "../types";

/**
 * 자료 직접결제 — orderId/금액 발급. 이후 Toss SDK 결제창에 사용.
 */
export async function prepareCheckout(
  materialIds: Array<number | string>
): Promise<{ orderId: string; amount: number; orderName: string }> {
  return apiPost("/payments/checkout/prepare", {
    materialIds: materialIds.map((id) => (typeof id === "string" ? Number(id) : id)),
  });
}

/**
 * 자료 직접결제 — Toss success callback 후 호출. 결제 승인 + 자료 지급.
 */
export async function confirmCheckout(
  paymentKey: string,
  orderId: string,
  amount: number
): Promise<{ success: boolean; orderId: string; materialIds: number[] }> {
  return apiPost("/payments/checkout/confirm", { paymentKey, orderId, amount });
}

export async function getTransactions(
  _userId: string,
  count: number = 20
): Promise<Transaction[]> {
  return apiGetList<Transaction>(`/users/me/transactions?limit=${count}`);
}

export async function hasPurchased(
  _userId: string,
  materialId: string
): Promise<boolean> {
  // 엔드포인트가 없거나 일시적 오류면 false로 fail-soft.
  // 진짜 중복 구매는 백엔드 UNIQUE 제약(uq_buyer_material)이 막아줌.
  try {
    const result = await apiGet<{ purchased: boolean }>(`/users/me/purchases/check?materialId=${materialId}`);
    return result.purchased;
  } catch {
    return false;
  }
}
