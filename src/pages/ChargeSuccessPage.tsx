import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";

export default function ChargeSuccessPage() {
  const [searchParams] = useSearchParams();
  const amount = parseInt(searchParams.get("amount") || "0");
  const { userProfile } = useAuth();

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-6 py-12 bg-muted/50">
      <Card className="max-w-[420px] w-full text-center shadow-sm">
        <CardContent className="px-10 py-12">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="h-8 w-8" />
          </div>
          <h1 className="text-[22px] font-bold tracking-tight text-foreground mb-2">충전 완료!</h1>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            포인트가 성공적으로 충전되었습니다.
          </p>
          <div className="text-[28px] font-bold text-[#862633] tracking-tight my-4">
            +{amount.toLocaleString()}P
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            현재 잔액: {(userProfile?.points ?? 0).toLocaleString()}P
          </p>
          <div className="flex gap-3 justify-center">
            <Button asChild>
              <Link to="/browse">자료 찾기</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/charge">추가 충전</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
