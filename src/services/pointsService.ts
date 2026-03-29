import { httpsCallable } from "firebase/functions";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from "firebase/firestore";
import { functions, db } from "../firebase";
import type { Transaction } from "../types";

export type PaymentMethod = "kakaopay" | "toss";

export async function chargeWithKakaopay(amount: number): Promise<string> {
  const fn = httpsCallable<{ amount: number }, { redirectUrl: string }>(
    functions,
    "kakaopayReady"
  );
  const result = await fn({ amount });
  return result.data.redirectUrl;
}

export async function chargeWithTossReady(amount: number): Promise<string> {
  const fn = httpsCallable<{ amount: number }, { orderId: string }>(
    functions,
    "tossReady"
  );
  const result = await fn({ amount });
  return result.data.orderId;
}

export async function chargeWithTossApprove(
  paymentKey: string,
  orderId: string,
  amount: number
): Promise<void> {
  const fn = httpsCallable(functions, "tossApprove");
  await fn({ paymentKey, orderId, amount });
}

export async function purchaseMaterial(
  materialId: string
): Promise<void> {
  const fn = httpsCallable(functions, "purchaseMaterial");
  await fn({ materialId });
}

export async function getTransactions(
  userId: string,
  count: number = 20
): Promise<Transaction[]> {
  const q = query(
    collection(db, "transactions"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(count)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    createdAt: d.data().createdAt?.toDate?.()?.toISOString?.() || "",
  })) as Transaction[];
}

export async function hasPurchased(
  userId: string,
  materialId: string
): Promise<boolean> {
  const q = query(
    collection(db, "purchases"),
    where("buyerId", "==", userId),
    where("materialId", "==", materialId),
    limit(1)
  );
  const snap = await getDocs(q);
  return !snap.empty;
}
