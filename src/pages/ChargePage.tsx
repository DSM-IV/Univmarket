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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";

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
      <div className="min-h-[calc(100vh-64px)] flex items-start justify-center p-12 bg-muted/50">
        <Card className="w-full max-w-[520px] shadow-sm">
          <CardHeader>
            <CardTitle className="text-2xl">포인트 충전</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">
              로그인이 필요합니다.{" "}
              <Link to="/login" className="text-[#862633] font-semibold hover:underline">
                로그인하기
              </Link>
            </p>
          </CardContent>
        </Card>
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
    <div className="min-h-[calc(100vh-64px)] flex items-start justify-center px-6 py-12 bg-muted/50">
      <Card className="w-full max-w-[520px] shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl">포인트 충전</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {status === "cancel" && (
            <div className="flex items-center gap-2 bg-destructive/5 text-destructive rounded-lg py-3 px-4 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              결제가 취소되었습니다.
            </div>
          )}
          {status === "fail" && (
            <div className="flex items-center gap-2 bg-destructive/5 text-destructive rounded-lg py-3 px-4 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              결제에 실패했습니다. 다시 시도해주세요.
            </div>
          )}

          {/* Current balance */}
          <div className="flex justify-between items-center rounded-lg bg-muted/70 px-5 py-4">
            <span className="text-sm text-muted-foreground">현재 보유 포인트</span>
            <span className="text-[22px] font-bold text-[#862633] tracking-tight">
              {(userProfile?.points ?? 0).toLocaleString()}P
            </span>
          </div>

          <Link
            to="/transactions"
            className="block text-center text-sm font-semibold text-[#862633] hover:opacity-75 hover:underline transition-opacity"
          >
            거래 내역 보기
          </Link>

          {/* Amount selection */}
          <div>
            <h3 className="text-[15px] font-semibold text-foreground mb-3">충전 금액 선택</h3>
            <div className="grid grid-cols-3 gap-2.5 max-sm:grid-cols-2">
              {PRESET_AMOUNTS.map((a) => (
                <button
                  key={a}
                  className={cn(
                    "py-3.5 rounded-lg border text-[15px] font-semibold transition-colors cursor-pointer",
                    selectedAmount === a
                      ? "border-[#862633] bg-[#862633]/[0.04] text-[#862633]"
                      : "border-border bg-background text-foreground hover:bg-muted/70"
                  )}
                  onClick={() => setSelectedAmount(a)}
                >
                  {a.toLocaleString()}원
                </button>
              ))}
            </div>
          </div>

          {/* Payment method */}
          <div>
            <h3 className="text-[15px] font-semibold text-foreground mb-3">결제 수단</h3>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                className={cn(
                  "flex items-center justify-center gap-2.5 py-4 rounded-lg border text-[15px] font-semibold transition-colors cursor-pointer",
                  paymentMethod === "kakaopay"
                    ? "border-[#862633] bg-[#862633]/[0.04] text-[#862633]"
                    : "border-border bg-background text-foreground hover:bg-muted/70"
                )}
                onClick={() => setPaymentMethod("kakaopay")}
              >
                <span className="w-7 h-7 rounded flex items-center justify-center font-extrabold text-sm bg-[#FEE500] text-[#191919]">
                  K
                </span>
                <span>카카오페이</span>
              </button>
              <button
                className={cn(
                  "flex items-center justify-center gap-2.5 py-4 rounded-lg border text-[15px] font-semibold transition-colors cursor-pointer",
                  paymentMethod === "toss"
                    ? "border-[#862633] bg-[#862633]/[0.04] text-[#862633]"
                    : "border-border bg-background text-foreground hover:bg-muted/70"
                )}
                onClick={() => setPaymentMethod("toss")}
              >
                <span className="w-7 h-7 rounded flex items-center justify-center font-extrabold text-sm bg-[#0064FF] text-white">
                  T
                </span>
                <span>토스페이먼츠</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-destructive/5 text-destructive rounded-lg py-3 px-4 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Charge summary */}
          <div>
            <Separator className="mb-4" />
            <div className="space-y-2 mb-5">
              <div className="flex justify-between py-1 text-sm text-muted-foreground">
                <span>충전 금액</span>
                <span>{amount > 0 ? `${amount.toLocaleString()}원` : "-"}</span>
              </div>
              <div className="flex justify-between py-1 text-sm text-muted-foreground">
                <span>결제 수단</span>
                <span>{paymentMethod === "kakaopay" ? "카카오페이" : "토스페이먼츠"}</span>
              </div>
              <div className="flex justify-between py-1 text-base font-bold text-foreground">
                <span>충전 후 포인트</span>
                <span>
                  {amount > 0
                    ? `${((userProfile?.points ?? 0) + amount).toLocaleString()}P`
                    : "-"}
                </span>
              </div>
            </div>
          </div>

          <Button
            className={cn(
              "w-full h-12 text-base font-bold",
              paymentMethod === "kakaopay"
                ? "bg-[#FEE500] text-[#191919] hover:bg-[#F5DC00]"
                : "bg-[#0064FF] text-white hover:bg-[#0055DD]"
            )}
            onClick={handleCharge}
            disabled={loading || amount < 1000}
          >
            {loading
              ? "처리 중..."
              : paymentMethod === "kakaopay"
                ? "카카오페이로 충전하기"
                : "토스페이먼츠로 충전하기"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
