import { Link, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function PurchaseFailPage() {
  const [searchParams] = useSearchParams();
  const code = searchParams.get("code");
  const message = searchParams.get("message");

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-6 py-12 bg-muted/50">
      <Card className="max-w-[420px] w-full text-center shadow-sm">
        <CardContent className="px-10 py-12">
          <div className="w-16 h-16 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-5">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h1 className="text-[22px] font-bold tracking-tight text-foreground mb-2">결제가 취소되었습니다</h1>
          <p className="text-sm text-muted-foreground leading-relaxed mb-2 whitespace-pre-wrap">
            {message || "결제가 완료되지 않았습니다."}
          </p>
          {code && (
            <p className="text-[12px] text-muted-foreground mb-6">코드: {code}</p>
          )}
          <div className="flex gap-3 justify-center mt-6">
            <Button asChild>
              <Link to="/cart">장바구니로</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/browse">자료 찾기</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
