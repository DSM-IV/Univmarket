import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { confirmCheckout } from "../services/pointsService";

type Status = "verifying" | "success" | "error";

export default function PurchaseSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [status, setStatus] = useState<Status>("verifying");
  const [errorMessage, setErrorMessage] = useState("");
  const [materialIds, setMaterialIds] = useState<number[]>([]);
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (attemptedRef.current) return;
    attemptedRef.current = true;

    const paymentKey = searchParams.get("paymentKey");
    const orderId = searchParams.get("orderId");
    const amountStr = searchParams.get("amount");

    if (!paymentKey || !orderId || !amountStr) {
      setStatus("error");
      setErrorMessage("결제 정보가 누락되었습니다.");
      return;
    }

    const amount = parseInt(amountStr, 10);
    if (!Number.isFinite(amount) || amount <= 0) {
      setStatus("error");
      setErrorMessage("결제 금액 정보가 올바르지 않습니다.");
      return;
    }

    (async () => {
      try {
        const result = await confirmCheckout(paymentKey, orderId, amount);
        setMaterialIds(result.materialIds || []);
        setStatus("success");
      } catch (err) {
        setErrorMessage((err as Error).message || "결제 승인에 실패했습니다.");
        setStatus("error");
      }
    })();
  }, [searchParams]);

  if (status === "verifying") {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-6 py-12 bg-muted/50">
        <Card className="max-w-[420px] w-full text-center shadow-sm">
          <CardContent className="px-10 py-12">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-5">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
            <h1 className="text-[22px] font-bold tracking-tight text-foreground mb-2">결제 확인 중</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              결제를 승인하고 자료를 지급하고 있습니다.<br />
              잠시만 기다려주세요.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-6 py-12 bg-muted/50">
        <Card className="max-w-[420px] w-full text-center shadow-sm">
          <CardContent className="px-10 py-12">
            <div className="w-16 h-16 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-5">
              <AlertCircle className="h-8 w-8" />
            </div>
            <h1 className="text-[22px] font-bold tracking-tight text-foreground mb-2">결제 승인 실패</h1>
            <p className="text-sm text-muted-foreground leading-relaxed mb-6 whitespace-pre-wrap">
              {errorMessage}
            </p>
            <p className="text-[12px] text-muted-foreground leading-relaxed mb-6">
              결제가 이미 완료되었는데도 오류가 표시된다면{" "}
              <a href="mailto:unifileservice@gmail.com" className="underline font-semibold">
                unifileservice@gmail.com
              </a>{" "}
              으로 문의해주세요.
            </p>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => navigate("/cart")}>장바구니</Button>
              <Button variant="outline" asChild>
                <Link to="/mypage">마이페이지</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-6 py-12 bg-muted/50">
      <Card className="max-w-[420px] w-full text-center shadow-sm">
        <CardContent className="px-10 py-12">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="h-8 w-8" />
          </div>
          <h1 className="text-[22px] font-bold tracking-tight text-foreground mb-2">결제 완료!</h1>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            {materialIds.length}건의 자료가 지급되었습니다.<br />
            마이페이지에서 다운로드할 수 있어요.
          </p>
          <div className="flex gap-3 justify-center">
            {materialIds.length === 1 ? (
              <Button asChild>
                <Link to={`/material/${materialIds[0]}`}>자료 보기</Link>
              </Button>
            ) : (
              <Button asChild>
                <Link to="/mypage">내 자료 보기</Link>
              </Button>
            )}
            <Button asChild variant="outline">
              <Link to="/browse">자료 더 찾기</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
