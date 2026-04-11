import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { loadTossPayments, ANONYMOUS } from "@tosspayments/tosspayments-sdk";
import { useAuth } from "../contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";
import { chargeWithTossReady } from "../services/pointsService";

const PRESET_AMOUNTS = [1000, 3000, 5000, 10000, 30000, 50000];
const VAT_RATE = 0.10;
const TOSS_CLIENT_KEY = import.meta.env.VITE_TOSS_CLIENT_KEY as string;

function calcChargeDetails(amount: number) {
  const vat = Math.ceil(amount * VAT_RATE);
  const transferAmount = amount + vat;
  return { vat, transferAmount };
}

export default function ChargePage() {
  const { user, userProfile } = useAuth();
  const [searchParams] = useSearchParams();
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const status = searchParams.get("status");
    if (status === "fail") {
      const message = searchParams.get("message");
      setError(message || "결제가 취소되었거나 실패했습니다.");
    }
  }, [searchParams]);

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
  const { vat, transferAmount } = calcChargeDetails(amount);

  const handlePay = async () => {
    if (amount < 1000) {
      setError("충전 금액을 선택해주세요.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const { orderId, paymentAmount } = await chargeWithTossReady(amount);

      const tossPayments = await loadTossPayments(TOSS_CLIENT_KEY);
      const payment = tossPayments.payment({ customerKey: user.uid || ANONYMOUS });

      await payment.requestPayment({
        method: "CARD",
        amount: { currency: "KRW", value: paymentAmount },
        orderId,
        orderName: `UniFile 포인트 충전 ${amount.toLocaleString()}P`,
        successUrl: `${window.location.origin}/charge/success`,
        failUrl: `${window.location.origin}/charge?status=fail`,
        customerEmail: user.email || undefined,
        customerName: userProfile?.nickname || user.displayName || undefined,
        card: {
          useEscrow: false,
          flowMode: "DEFAULT",
          useCardPoint: false,
          useAppCardOnly: false,
        },
      });
      // 리다이렉트 방식이므로 여기에는 도달하지 않음
    } catch (err) {
      const message = (err as Error).message || "결제를 시작할 수 없습니다.";
      setError(message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-start justify-center px-6 py-12 bg-muted/50">
      <div className="w-full max-w-[520px] space-y-4">
        <Card className="w-full shadow-sm">
          <CardHeader>
            <CardTitle className="text-2xl">포인트 충전</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
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
                    type="button"
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

            <div>
              <Separator className="mb-4" />
              <div className="space-y-2 mb-5">
                <div className="flex justify-between py-1 text-sm text-muted-foreground">
                  <span>충전 포인트</span>
                  <span>{amount > 0 ? `${amount.toLocaleString()}P` : "-"}</span>
                </div>
                {amount > 0 && (
                  <>
                    <div className="flex justify-between py-1 text-sm text-muted-foreground">
                      <span>부가세 (10%)</span>
                      <span>+{vat.toLocaleString()}원</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between py-1 text-base font-bold text-[#862633]">
                      <span>결제 금액</span>
                      <span>{transferAmount.toLocaleString()}원</span>
                    </div>
                  </>
                )}
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
              className="w-full h-12 text-base font-bold bg-[#862633] hover:bg-[#6B1E29] text-white"
              onClick={handlePay}
              disabled={amount < 1000 || loading}
            >
              {loading ? "결제창 여는 중..." : "결제하기"}
            </Button>

            {error && (
              <div className="flex items-center gap-2 bg-destructive/5 text-destructive rounded-lg py-3 px-4 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
              토스페이먼츠를 통해 안전하게 결제됩니다.<br />
              결제 완료 후 포인트는 즉시 지급됩니다.
            </p>
          </CardContent>
        </Card>

        {/* 환불 안내 */}
        <Card className="w-full shadow-sm">
          <CardContent className="p-5">
            <h3 className="text-[15px] font-bold mb-3">포인트 환불 안내</h3>
            <ul className="text-[13px] text-muted-foreground space-y-2 ml-1">
              <li>
                • 충전 후 <span className="font-semibold text-foreground">사용하지 않은 포인트</span>는
                언제든지 <span className="font-semibold text-foreground">전액 환불</span>이 가능합니다.
              </li>
              <li>
                • 자료 구매 후 <span className="font-semibold text-foreground">24시간 이내에 다운로드하지 않은 경우</span>,
                해당 포인트는 <span className="font-semibold text-foreground">자동으로 환불</span>됩니다.
              </li>
              <li>
                • 한 번이라도 <span className="font-semibold text-foreground">다운로드한 자료</span>는
                원칙적으로 환불이 불가능합니다. (자료 하자·저작권 문제 등 정당한 사유가 있는 경우 개별 심사)
              </li>
              <li>
                • 환불은 <span className="font-semibold text-foreground">결제하신 수단</span>으로 처리되며,
                영업일 기준 1~3일 이내에 완료됩니다.
              </li>
              <li>
                • 충전 시 부과된 <span className="font-semibold text-foreground">부가세(10%)</span>는
                사용 내역이 없을 경우에 한해 함께 환불됩니다.
              </li>
            </ul>

            <div className="mt-4 p-3.5 rounded-lg bg-amber-50 border border-amber-200">
              <p className="text-[12px] text-amber-800 leading-relaxed">
                환불을 원하시면 <span className="font-semibold">1:1 문의</span> 또는
                <a href="mailto:unifileservice@gmail.com" className="ml-0.5 font-semibold underline">
                  unifileservice@gmail.com
                </a>
                으로 회원 정보·충전 내역과 함께 요청해주세요.
              </p>
            </div>

            <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
              ※ 전자상거래법상 구매 후 7일 이내 청약철회 권리가 보장되나,
              디지털 콘텐츠의 특성상 다운로드 완료 시점에 청약철회권이 제한됩니다 (전자상거래법 제17조).
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
