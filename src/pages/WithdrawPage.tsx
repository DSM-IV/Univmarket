import { useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { collection, addDoc, serverTimestamp, doc, runTransaction } from "firebase/firestore";
import { db } from "../firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Wallet, AlertCircle, CheckCircle, ArrowLeft } from "lucide-react";

const AMOUNTS = [5000, 10000, 30000, 50000, 100000];
const MIN_WITHDRAW = 5000;

export default function WithdrawPage() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

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

  const points = userProfile?.points ?? 0;
  const withdrawAmount = selectedAmount ?? (customAmount ? parseInt(customAmount) : 0);
  const isValidAmount = withdrawAmount >= MIN_WITHDRAW && withdrawAmount <= points;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!withdrawAmount || withdrawAmount < MIN_WITHDRAW) {
      setError(`최소 출금 금액은 ${MIN_WITHDRAW.toLocaleString()}P입니다.`);
      return;
    }
    if (withdrawAmount > points) {
      setError("보유 포인트보다 많은 금액은 출금할 수 없습니다.");
      return;
    }
    if (!bankName.trim() || !accountNumber.trim() || !accountHolder.trim()) {
      setError("계좌 정보를 모두 입력해주세요.");
      return;
    }

    setProcessing(true);
    try {
      const userRef = doc(db, "users", user.uid);

      await runTransaction(db, async (transaction) => {
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) throw new Error("사용자 정보를 찾을 수 없습니다.");

        const currentPoints = userSnap.data().points || 0;
        if (currentPoints < withdrawAmount) {
          throw new Error("포인트가 부족합니다.");
        }

        transaction.update(userRef, {
          points: currentPoints - withdrawAmount,
        });
      });

      await addDoc(collection(db, "transactions"), {
        userId: user.uid,
        type: "withdraw",
        amount: -withdrawAmount,
        balanceAfter: points - withdrawAmount,
        description: `출금 신청 (${bankName} ${accountNumber})`,
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        accountHolder: accountHolder.trim(),
        status: "pending",
        createdAt: serverTimestamp(),
      });

      setSuccess(true);
    } catch (err) {
      setError((err as Error).message || "출금 처리 중 오류가 발생했습니다.");
    } finally {
      setProcessing(false);
    }
  };

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-6">
        <Card className="w-full max-w-[420px] border-none shadow-md">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center">
              <CheckCircle className="w-7 h-7 text-success" />
            </div>
            <h2 className="text-xl font-bold tracking-tight">출금 신청 완료</h2>
            <p className="text-2xl font-extrabold text-primary tracking-tight">
              {withdrawAmount.toLocaleString()}P
            </p>
            <p className="text-sm text-muted-foreground">
              {bankName} {accountNumber} ({accountHolder})
            </p>
            <p className="text-sm text-muted-foreground">
              영업일 기준 1~3일 내에 입금됩니다.
            </p>
            <Separator className="my-2" />
            <div className="flex gap-3 w-full">
              <Button variant="secondary" className="flex-1" asChild>
                <Link to="/mypage">마이페이지</Link>
              </Button>
              <Button variant="outline" className="flex-1" asChild>
                <Link to="/transactions">거래내역</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

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

        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-[26px] font-extrabold tracking-tight">포인트 출금</h1>
        </div>
        <p className="text-[15px] text-muted-foreground mb-8">
          판매 수익을 계좌로 출금할 수 있습니다
        </p>

        {/* 보유 포인트 */}
        <Card className="mb-6">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground mb-1">보유 포인트</p>
            <p className="text-3xl max-sm:text-2xl font-extrabold tracking-tight">
              {points.toLocaleString()}<span className="text-lg font-bold text-muted-foreground ml-1">P</span>
            </p>
          </CardContent>
        </Card>

        <form onSubmit={handleSubmit}>
          {/* 출금 금액 */}
          <Card className="mb-5">
            <CardContent className="p-5">
              <h2 className="text-[15px] font-bold mb-4">출금 금액</h2>
              <div className="grid grid-cols-3 gap-2 mb-3 max-sm:grid-cols-2">
                {AMOUNTS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    className={cn(
                      "py-2.5 px-3 rounded-lg text-sm font-semibold border transition-colors",
                      selectedAmount === a
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border bg-background text-foreground hover:bg-muted/70",
                      a > points && "opacity-40 pointer-events-none"
                    )}
                    onClick={() => {
                      setSelectedAmount(a);
                      setCustomAmount("");
                    }}
                    disabled={a > points}
                  >
                    {a.toLocaleString()}P
                  </button>
                ))}
                <button
                  type="button"
                  className={cn(
                    "py-2.5 px-3 rounded-lg text-sm font-semibold border transition-colors",
                    selectedAmount === null && customAmount
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-background text-foreground hover:bg-muted/70"
                  )}
                  onClick={() => setSelectedAmount(null)}
                >
                  직접입력
                </button>
              </div>
              {selectedAmount === null && (
                <Input
                  type="number"
                  placeholder={`최소 ${MIN_WITHDRAW.toLocaleString()}P`}
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  min={MIN_WITHDRAW}
                  max={points}
                  className="h-11"
                />
              )}
            </CardContent>
          </Card>

          {/* 계좌 정보 */}
          <Card className="mb-5">
            <CardContent className="p-5">
              <h2 className="text-[15px] font-bold mb-4">입금 계좌</h2>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="block text-[13px] font-semibold text-muted-foreground mb-1.5">은행명</label>
                  <Input
                    type="text"
                    placeholder="예: 국민은행"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    required
                    className="h-11"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-muted-foreground mb-1.5">계좌번호</label>
                  <Input
                    type="text"
                    placeholder="'-' 없이 입력"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    required
                    className="h-11"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-muted-foreground mb-1.5">예금주</label>
                  <Input
                    type="text"
                    placeholder="예금주명"
                    value={accountHolder}
                    onChange={(e) => setAccountHolder(e.target.value)}
                    required
                    className="h-11"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 출금 요약 */}
          {withdrawAmount > 0 && (
            <Card className="mb-5">
              <CardContent className="p-5">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">출금 금액</span>
                  <span className="font-semibold">{withdrawAmount.toLocaleString()}P</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">출금 후 잔액</span>
                  <span className={cn("font-semibold", !isValidAmount && "text-destructive")}>
                    {(points - withdrawAmount).toLocaleString()}P
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 mb-5 bg-destructive/5 rounded-lg">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            disabled={processing || !isValidAmount || !bankName.trim() || !accountNumber.trim() || !accountHolder.trim()}
            className="w-full h-12 text-base font-bold"
          >
            {processing ? "처리 중..." : `${withdrawAmount > 0 ? withdrawAmount.toLocaleString() + "P " : ""}출금 신청`}
          </Button>

          <p className="text-xs text-muted-foreground text-center mt-4">
            출금은 영업일 기준 1~3일 소요되며, 최소 출금 금액은 {MIN_WITHDRAW.toLocaleString()}P입니다.
          </p>
        </form>
      </div>
    </div>
  );
}
