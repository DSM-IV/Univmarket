import { useState, useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  chargeWithKakaopay,
  chargeWithTossReady,
  chargeWithTossApprove,
  type PaymentMethod,
} from "../services/pointsService";
import { loadTossPayments } from "@tosspayments/tosspayments-sdk";
import "./ChargePage.css";

const PRESET_AMOUNTS = [1000, 3000, 5000, 10000, 30000, 50000];
const TOSS_CLIENT_KEY = import.meta.env.VITE_TOSS_CLIENT_KEY || "test_ck_test";

export default function ChargePage() {
  const { user, userProfile } = useAuth();
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("kakaopay");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchParams] = useSearchParams();
  const tossRef = useRef<Awaited<ReturnType<typeof loadTossPayments>> | null>(null);

  const status = searchParams.get("status");

  // 토스 결제 승인 처리 (리다이렉트 후)
  const paymentKey = searchParams.get("paymentKey");
  const tossOrderId = searchParams.get("orderId");
  const tossAmount = searchParams.get("amount");

  useEffect(() => {
    if (paymentKey && tossOrderId && tossAmount) {
      handleTossApprove(paymentKey, tossOrderId, parseInt(tossAmount));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentKey, tossOrderId, tossAmount]);

  // 토스 SDK 초기화
  useEffect(() => {
    loadTossPayments(TOSS_CLIENT_KEY).then((tp) => {
      tossRef.current = tp;
    });
  }, []);

  const handleTossApprove = async (pk: string, oid: string, amt: number) => {
    setLoading(true);
    setError("");
    try {
      await chargeWithTossApprove(pk, oid, amt);
      // 성공 시 success 페이지 파라미터로 대체
      window.history.replaceState(null, "", `/charge/success?amount=${amt}`);
      window.location.href = `/charge/success?amount=${amt}`;
    } catch (err) {
      setError((err as Error).message || "결제 승인에 실패했습니다.");
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="charge-page">
        <div className="charge-card">
          <h1>포인트 충전</h1>
          <p className="charge-login-msg">
            로그인이 필요합니다. <Link to="/login">로그인하기</Link>
          </p>
        </div>
      </div>
    );
  }

  const amount = selectedAmount || 0;

  const handleCharge = async () => {
    if (amount < 1000) {
      setError("최소 충전 금액은 1,000원입니다.");
      return;
    }
    setError("");
    setLoading(true);

    try {
      if (paymentMethod === "kakaopay") {
        const redirectUrl = await chargeWithKakaopay(amount);
        window.location.href = redirectUrl;
      } else {
        // 토스페이먼츠
        const orderId = await chargeWithTossReady(amount);
        if (!tossRef.current) {
          throw new Error("결제 모듈을 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
        }
        const payment = tossRef.current.payment({ customerKey: user.uid });
        await payment.requestPayment({
          method: "CARD",
          amount: { currency: "KRW", value: amount },
          orderId,
          orderName: `KU market 포인트 ${amount.toLocaleString()}P`,
          successUrl: `${window.location.origin}/charge?paymentKey={paymentKey}&orderId=${orderId}&amount=${amount}`,
          failUrl: `${window.location.origin}/charge?status=fail`,
        });
      }
    } catch (err) {
      setError((err as Error).message || "충전 중 오류가 발생했습니다.");
      setLoading(false);
    }
  };

  return (
    <div className="charge-page">
      <div className="charge-card">
        <h1>포인트 충전</h1>

        {status === "cancel" && (
          <p className="charge-error">결제가 취소되었습니다.</p>
        )}
        {status === "fail" && (
          <p className="charge-error">결제에 실패했습니다. 다시 시도해주세요.</p>
        )}

        <div className="charge-balance">
          <span className="balance-label">현재 보유 포인트</span>
          <span className="balance-value">
            {(userProfile?.points ?? 0).toLocaleString()}P
          </span>
        </div>

        <Link to="/transactions" className="charge-tx-link">
          거래 내역 보기
        </Link>

        <div className="charge-amounts">
          <h3>충전 금액 선택</h3>
          <div className="amount-grid">
            {PRESET_AMOUNTS.map((a) => (
              <button
                key={a}
                className={`amount-btn ${selectedAmount === a ? "active" : ""}`}
                onClick={() => setSelectedAmount(a)}
              >
                {a.toLocaleString()}원
              </button>
            ))}
          </div>

        </div>

        {/* 결제 수단 선택 */}
        <div className="payment-methods">
          <h3>결제 수단</h3>
          <div className="method-grid">
            <button
              className={`method-btn ${paymentMethod === "kakaopay" ? "active" : ""}`}
              onClick={() => setPaymentMethod("kakaopay")}
            >
              <span className="method-icon method-kakao">K</span>
              <span>카카오페이</span>
            </button>
            <button
              className={`method-btn ${paymentMethod === "toss" ? "active" : ""}`}
              onClick={() => setPaymentMethod("toss")}
            >
              <span className="method-icon method-toss">T</span>
              <span>토스페이먼츠</span>
            </button>
          </div>
        </div>

        {error && <p className="charge-error">{error}</p>}

        <div className="charge-summary">
          <div className="summary-row">
            <span>충전 금액</span>
            <span>{amount > 0 ? `${amount.toLocaleString()}원` : "-"}</span>
          </div>
          <div className="summary-row">
            <span>결제 수단</span>
            <span>{paymentMethod === "kakaopay" ? "카카오페이" : "토스페이먼츠"}</span>
          </div>
          <div className="summary-row">
            <span>충전 후 포인트</span>
            <span>
              {amount > 0
                ? `${((userProfile?.points ?? 0) + amount).toLocaleString()}P`
                : "-"}
            </span>
          </div>
        </div>

        <button
          className={`btn-charge ${paymentMethod === "toss" ? "btn-charge-toss" : ""}`}
          onClick={handleCharge}
          disabled={loading || amount < 1000}
        >
          {loading
            ? "처리 중..."
            : paymentMethod === "kakaopay"
              ? "카카오페이로 충전하기"
              : "토스페이먼츠로 충전하기"}
        </button>
      </div>
    </div>
  );
}
