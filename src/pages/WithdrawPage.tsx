// 클로즈드 베타 기간 동안 출금 차단.
// 베타 종료 시: commit a19e001 의 WithdrawPage.tsx 를 그대로 복원하고
// 백엔드 BETA_WITHDRAW_DISABLED=false 로 설정.
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, ArrowLeft } from "lucide-react";

export default function WithdrawPage() {
  const { user, userProfile, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">로딩 중...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const earnings = userProfile?.earnings ?? 0;
  const pendingEarnings = userProfile?.pendingEarnings ?? 0;

  return (
    <div className="py-10 pb-20 max-sm:py-6 max-sm:pb-16">
      <div className="max-w-[520px] mx-auto px-6 max-sm:px-4">
        <Link
          to="/mypage"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          마이페이지
        </Link>

        <Card className="border-none shadow-sm">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertCircle className="w-7 h-7 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold tracking-tight">
              지금은 출금이 제한됩니다
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              클로즈드 베타 기간 동안에는 출금 신청을 받지 않습니다.<br />
              정식 오픈 후 적립된 수익금을 출금하실 수 있습니다.
            </p>

            <Separator className="my-2" />

            <div className="w-full space-y-2 text-left">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">현재 수익금</span>
                <span className="font-semibold text-foreground">
                  {earnings.toLocaleString()}원
                </span>
              </div>
              {pendingEarnings > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">정산 대기 중</span>
                  <span className="font-semibold text-amber-600">
                    +{pendingEarnings.toLocaleString()}원
                  </span>
                </div>
              )}
            </div>

            <p className="text-[12px] text-muted-foreground mt-2">
              베타 기간 판매 수수료 0% — 판매 수익 전액이 적립됩니다
            </p>

            <Button variant="secondary" className="w-full mt-2" asChild>
              <Link to="/mypage">마이페이지로 돌아가기</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
