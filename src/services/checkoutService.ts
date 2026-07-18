import { loadTossPayments, ANONYMOUS } from "@tosspayments/tosspayments-sdk";
import { prepareCheckout } from "./paymentService";

const TOSS_CLIENT_KEY = import.meta.env.VITE_TOSS_CLIENT_KEY || "test_ck_test";

/**
 * 자료 직접결제 시작. 백엔드에서 orderId 발급 → Toss 결제창으로 redirect.
 * 결제 완료 후 /purchase/success?paymentKey&orderId&amount 로 돌아옴.
 */
export async function startCheckout(
  materialIds: Array<number | string>,
  options: { customerKey?: string; customerName?: string; customerEmail?: string } = {}
): Promise<void> {
  if (materialIds.length === 0) {
    throw new Error("결제할 자료가 없습니다.");
  }

  const { orderId, amount, orderName } = await prepareCheckout(materialIds);

  const tossPayments = await loadTossPayments(TOSS_CLIENT_KEY);
  const payment = tossPayments.payment({ customerKey: options.customerKey ?? ANONYMOUS });

  await payment.requestPayment({
    method: "CARD",
    amount: { currency: "KRW", value: amount },
    orderId,
    orderName,
    customerName: options.customerName,
    customerEmail: options.customerEmail,
    successUrl: `${window.location.origin}/purchase/success`,
    failUrl: `${window.location.origin}/purchase/fail`,
  });
}
