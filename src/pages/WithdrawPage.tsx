import { useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Wallet, AlertCircle, CheckCircle, ArrowLeft, ShieldCheck, User } from "lucide-react";

const AMOUNTS = [5000, 10000, 30000, 50000, 100000];
const MIN_WITHDRAW = 5000;
const FEE = 500;
const TAX_THRESHOLD = 125000;
const TAX_RATE = 0.088;
const PLATFORM_COMMISSION_RATE = 0.10; // 10% (원래 40%에서 할인)

function calcWithdrawDetails(amount: number) {
  const fee = FEE;
  const commission = Math.ceil(amount * PLATFORM_COMMISSION_RATE);
  const taxable = amount > TAX_THRESHOLD;
  // 세금 포함 금액 = 출금액 / (1 - 세율)  →  세금 = 총액 - 출금액
  const grossAmount = taxable ? Math.ceil(amount / (1 - TAX_RATE)) : amount;
  const tax = grossAmount - amount;
  const totalDeduction = grossAmount + fee + commission;
  return { fee, commission, tax, grossAmount, totalDeduction, taxable };
}

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

  // 본인인증 상태
  const isVerified = userProfile?.identityVerified === true;
  const [verifyName, setVerifyName] = useState("");
  const [verifyBirth, setVerifyBirth] = useState("");
  const [verifyPhone, setVerifyPhone] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState("");

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
  const withdrawAmount = selectedAmount ?? (customAmount ? parseInt(customAmount) : 0);
  const { fee, commission, tax, totalDeduction, taxable } = calcWithdrawDetails(withdrawAmount);
  const isValidAmount = withdrawAmount >= MIN_WITHDRAW && totalDeduction <= earnings;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!withdrawAmount || withdrawAmount < MIN_WITHDRAW) {
      setError(`최소 출금 금액은 ${MIN_WITHDRAW.toLocaleString()}P입니다.`);
      return;
    }
    if (totalDeduction > earnings) {
      setError(`수수료·세금 포함 ${totalDeduction.toLocaleString()}원이 필요합니다. 수익금이 부족합니다.`);
      return;
    }
    if (!bankName.trim() || !accountNumber.trim() || !accountHolder.trim()) {
      setError("계좌 정보를 모두 입력해주세요.");
      return;
    }

    setProcessing(true);
    try {
      const requestWithdraw = httpsCallable(functions, "requestWithdraw");
      await requestWithdraw({
        amount: withdrawAmount,
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        accountHolder: accountHolder.trim(),
      });

      setSuccess(true);
    } catch (err: unknown) {
      const message = (err as { message?: string }).message || "출금 처리 중 오류가 발생했습니다.";
      setError(message);
    } finally {
      setProcessing(false);
    }
  };

  const handleSendCode = async () => {
    setVerifyError("");
    setVerifying(true);
    try {
      const fn = httpsCallable(functions, "requestVerification");
      await fn({
        name: verifyName,
        birth: verifyBirth,
        phone: verifyPhone,
      });
      setCodeSent(true);
    } catch (err: unknown) {
      setVerifyError((err as { message?: string }).message || "인증 요청에 실패했습니다.");
    } finally {
      setVerifying(false);
    }
  };

  const handleVerifyIdentity = async () => {
    setVerifyError("");
    if (!verifyCode.trim()) { setVerifyError("인증번호를 입력해주세요."); return; }
    if (verifyCode.length < 6) { setVerifyError("인증번호 6자리를 입력해주세요."); return; }

    setVerifying(true);
    try {
      const fn = httpsCallable(functions, "confirmVerification");
      await fn({ code: verifyCode });
    } catch (err: unknown) {
      setVerifyError((err as { message?: string }).message || "본인인증에 실패했습니다.");
    } finally {
      setVerifying(false);
    }
  };

  if (!isVerified) {
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
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-[26px] font-extrabold tracking-tight">본인인증</h1>
          </div>
          <p className="text-[15px] text-muted-foreground mb-8">
            최초 출금 시 1회 본인인증이 필요합니다
          </p>

          <Card className="mb-5">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-5">
                <User className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-[15px] font-bold">본인 정보 입력</h2>
              </div>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="block text-[13px] font-semibold text-muted-foreground mb-1.5">이름 (실명)</label>
                  <Input
                    type="text"
                    placeholder="홍길동"
                    value={verifyName}
                    onChange={(e) => setVerifyName(e.target.value)}
                    className="h-11"
                    disabled={codeSent}
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-muted-foreground mb-1.5">생년월일 (6자리)</label>
                  <Input
                    type="text"
                    placeholder="990101"
                    maxLength={6}
                    value={verifyBirth}
                    onChange={(e) => setVerifyBirth(e.target.value.replace(/\D/g, ""))}
                    className="h-11"
                    disabled={codeSent}
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-muted-foreground mb-1.5">휴대폰 번호</label>
                  <div className="flex gap-2">
                    <Input
                      type="tel"
                      placeholder="01012345678"
                      value={verifyPhone}
                      onChange={(e) => setVerifyPhone(e.target.value.replace(/\D/g, ""))}
                      className="h-11 flex-1"
                      disabled={codeSent}
                    />
                    <Button
                      type="button"
                      variant={codeSent ? "outline" : "primary"}
                      className="h-11 shrink-0 px-4"
                      onClick={handleSendCode}
                      disabled={codeSent || verifying}
                    >
                      {verifying && !codeSent ? "발송 중..." : codeSent ? "발송완료" : "인증요청"}
                    </Button>
                  </div>
                </div>

                {codeSent && (
                  <div>
                    <label className="block text-[13px] font-semibold text-muted-foreground mb-1.5">인증번호 (6자리)</label>
                    <Input
                      type="text"
                      placeholder="인증번호 6자리 입력"
                      maxLength={6}
                      value={verifyCode}
                      onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
                      className="h-11"
                    />
                    <p className="text-xs text-muted-foreground mt-1.5">
                      입력하신 휴대폰으로 인증번호가 발송되었습니다.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {verifyError && (
            <div className="flex items-center gap-2 p-3 mb-5 bg-destructive/5 rounded-lg">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
              <p className="text-sm text-destructive">{verifyError}</p>
            </div>
          )}

          {codeSent && (
            <Button
              type="button"
              variant="primary"
              className="w-full h-12 text-base font-bold"
              onClick={handleVerifyIdentity}
              disabled={verifying || verifyCode.length < 6}
            >
              {verifying ? "인증 확인 중..." : "본인인증 완료"}
            </Button>
          )}

          <Card className="mt-8">
            <CardContent className="p-5">
              <h2 className="text-[15px] font-bold mb-3">본인인증 안내</h2>
              <ul className="text-[13px] text-muted-foreground space-y-2 ml-1">
                <li>• 출금 신청 시 <span className="font-semibold text-foreground">최초 1회</span>에 한해 본인인증을 진행합니다.</li>
                <li>• 본인 명의의 휴대폰으로만 인증이 가능합니다.</li>
                <li>• 입력하신 정보는 본인 확인 목적으로만 사용되며 안전하게 보호됩니다.</li>
                <li>• 마지막 출금일로부터 <span className="font-semibold text-foreground">5년 경과 시</span> 재인증이 필요합니다.</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

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
              {withdrawAmount.toLocaleString()}원
            </p>
            <p className="text-xs text-muted-foreground">
              (플랫폼 수수료·출금수수료·세금 포함 총 {totalDeduction.toLocaleString()}원 수익금에서 차감)
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
          <h1 className="text-[26px] font-extrabold tracking-tight">수익금 출금</h1>
        </div>
        <p className="text-[15px] text-muted-foreground mb-8">
          판매 수익금을 계좌로 출금할 수 있습니다
        </p>

        {/* 보유 수익금 */}
        <Card className="mb-6">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground mb-1">출금 가능 수익금</p>
            <p className="text-3xl max-sm:text-2xl font-extrabold tracking-tight">
              {earnings.toLocaleString()}<span className="text-lg font-bold text-muted-foreground ml-1">원</span>
            </p>
            {(userProfile?.pendingEarnings ?? 0) > 0 && (
              <p className="text-xs text-amber-600 mt-2">
                정산 대기 중: {(userProfile?.pendingEarnings ?? 0).toLocaleString()}원 (구매 후 24시간 경과 시 출금 가능)
              </p>
            )}
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-xs text-muted-foreground">
                보유 포인트: <span className="font-semibold text-foreground">{(userProfile?.points ?? 0).toLocaleString()}P</span>
                <span className="ml-2 text-muted-foreground">(포인트는 전액 환불 가능, 출금은 수익금만 가능)</span>
              </p>
            </div>
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
                      a > earnings && "opacity-40 pointer-events-none"
                    )}
                    onClick={() => {
                      setSelectedAmount(a);
                      setCustomAmount("");
                    }}
                    disabled={a > earnings}
                  >
                    {a.toLocaleString()}원
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
                  placeholder={`최소 ${MIN_WITHDRAW.toLocaleString()}원`}
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  min={MIN_WITHDRAW}
                  max={earnings}
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
                  <span className="font-semibold">{withdrawAmount.toLocaleString()}원</span>
                </div>
                <div className="flex justify-between items-center text-sm mb-2">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    플랫폼 수수료 (10%)
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-50 border border-red-200">
                      <span className="text-[11px] text-red-400 line-through">40%</span>
                      <span className="text-[11px] font-bold text-red-600">→ 10%</span>
                    </span>
                  </span>
                  <span className="font-semibold text-amber-600">+{commission.toLocaleString()}원</span>
                </div>
                {taxable && (
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">세금 (8.8%)</span>
                    <span className="font-semibold text-amber-600">+{tax.toLocaleString()}원</span>
                  </div>
                )}
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">출금처리수수료</span>
                  <span className="font-semibold text-amber-600">+{fee.toLocaleString()}원</span>
                </div>
                <Separator className="my-3" />
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-semibold">총 차감 금액</span>
                  <span className={cn("font-bold text-base", !isValidAmount ? "text-destructive" : "text-primary")}>
                    {totalDeduction.toLocaleString()}원
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">출금 후 수익금 잔액</span>
                  <span className={cn("font-semibold", !isValidAmount && "text-destructive")}>
                    {(earnings - totalDeduction).toLocaleString()}원
                  </span>
                </div>
                {!isValidAmount && withdrawAmount >= MIN_WITHDRAW && (
                  <p className="text-xs text-destructive mt-2">
                    수수료·세금 포함 시 보유 수익금이 부족합니다.
                  </p>
                )}
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
            {processing ? "처리 중..." : `${withdrawAmount > 0 ? withdrawAmount.toLocaleString() + "원 " : ""}출금 신청`}
          </Button>

          <p className="text-xs text-muted-foreground text-center mt-4">
            출금은 영업일 기준 1~3일 소요되며, 최소 출금 금액은 {MIN_WITHDRAW.toLocaleString()}원입니다.
          </p>
        </form>

        {/* 출금 안내 */}
        <Card className="mt-8">
          <CardContent className="p-5">
            <h2 className="text-[15px] font-bold mb-3">출금 안내</h2>
            <ul className="text-[13px] text-muted-foreground space-y-2 ml-1">
              <li>• 수익금(판매수익)은 반드시 <span className="font-semibold text-foreground">본인 명의 계좌</span>로만 신청 가능하며, 신청한 다음 영업일에 입금됩니다. (은행 영업일 기준)</li>
              <li>• 계좌번호를 잘못 입력하여 출금된 경우 책임지지 않습니다.</li>
              <li>• 출금 신청 시 최초 1회에 한해 실명확인을 진행합니다. (단, 마지막 출금일로부터 5년 경과 시 재확인 필요)</li>
              <li>• CMA통장 및 가상계좌는 거래시간 제한으로 출금 오류가 발생할 수 있으니, 가급적 <span className="font-semibold text-foreground">입출금이 자유로운 보통예금통장</span>으로 신청해주세요.</li>
            </ul>
          </CardContent>
        </Card>

        {/* 포인트 & 수익금 안내 */}
        <Card className="mt-4">
          <CardContent className="p-5">
            <h2 className="text-[15px] font-bold mb-3">포인트 vs 수익금 안내</h2>
            <ul className="text-[13px] text-muted-foreground space-y-2 ml-1 mb-5">
              <li>• <span className="font-semibold text-foreground">포인트</span>: 충전한 금액이며, 자료 구매에 사용됩니다. 사용하지 않은 포인트는 <span className="font-semibold text-foreground">전액 환불</span>이 가능합니다.</li>
              <li>• <span className="font-semibold text-foreground">수익금</span>: 자료 판매로 얻은 수익이며, 출금 시 플랫폼 수수료가 차감됩니다.</li>
              <li>• 자료를 구매하면 구매자의 <span className="font-semibold text-foreground">포인트</span>가 차감되고, 판매자에게 <span className="font-semibold text-foreground">수익금</span>으로 지급됩니다.</li>
            </ul>
          </CardContent>
        </Card>

        {/* 수수료 & 세금 안내 */}
        <Card className="mt-4">
          <CardContent className="p-5">
            <h2 className="text-[15px] font-bold mb-3">수수료 & 세금 안내</h2>

            {/* 플랫폼 수수료 할인 배너 */}
            <div className="mb-5 p-4 rounded-lg bg-gradient-to-r from-red-50 to-orange-50 border border-red-200">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base font-bold text-red-600">오픈 기념 수수료 할인!</span>
              </div>
              <p className="text-[13px] text-red-700 leading-relaxed">
                플랫폼 수수료 <span className="line-through text-red-400">40%</span> → <span className="font-bold text-red-600 text-base">10%</span> 할인 적용 중
              </p>
              <p className="text-[11px] text-red-500 mt-1">
                * 할인 기간은 사전 공지 후 변경될 수 있습니다.
              </p>
            </div>

            <ul className="text-[13px] text-muted-foreground space-y-2 ml-1 mb-5">
              <li>• 수익금 출금 시 <span className="font-semibold text-foreground">플랫폼 수수료 10%</span>가 차감됩니다. (정상 수수료 40%에서 할인 적용)</li>
              <li>• 최소 출금 금액은 <span className="font-semibold text-foreground">5,000원</span>이며, 출금처리수수료 <span className="font-semibold text-foreground">500원</span>이 추가로 부과됩니다.</li>
              <li>• 신청금액이 <span className="font-semibold text-foreground">건별 125,000원 초과</span> 시 기타소득세와 주민세(8.8%)가 포함된 금액이 수익금 계정에서 출금 처리됩니다.</li>
              <li>• 신청금액이 <span className="font-semibold text-foreground">연간 누적 7,500,000원 초과</span> 시 사업소득세와 주민세(3.3%)가 포함된 금액이 수익금 계정에서 출금 처리됩니다.</li>
            </ul>

            <div className="space-y-4">
              {/* 기타소득 */}
              <div className="rounded-lg border border-border p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="shrink-0 px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-700">기타소득</span>
                  <span className="text-sm font-semibold">건별 125,000원 초과 시</span>
                </div>
                <ul className="text-[13px] text-muted-foreground space-y-1.5 ml-1">
                  <li>• 출금 신청금액이 건별 125,000원을 초과할 경우 기타소득으로 국세청에 통보되며, 기타소득세율(8.8%)이 포함된 금액이 수익금 계정에서 출금됩니다.</li>
                  <li>• 125,000원 이하 출금 시에는 세금이 부과되지 않습니다.</li>
                </ul>
                <div className="mt-3 p-3 rounded-lg bg-muted/50">
                  <p className="text-[12px] text-muted-foreground font-semibold mb-1">출금 예시</p>
                  <p className="text-[12px] text-muted-foreground leading-relaxed">
                    200,000원 출금 시 → 플랫폼 수수료 20,000원(10%) + 세금 포함 219,298원(8.8%) + 출금수수료 500원 = 총 239,798원 차감
                  </p>
                </div>
                <div className="mt-3">
                  <p className="text-[13px] text-muted-foreground leading-relaxed">
                    출금금액(기타소득 지급액)이 <span className="font-semibold text-foreground">7,500,000원</span>(기타소득금액 총 300만 원)을 초과하면 다른 소득과 합산하여 종합소득세로 신고해야 합니다.
                  </p>
                  <div className="mt-2 p-3 rounded-lg bg-muted/50">
                    <p className="text-[12px] text-muted-foreground font-semibold mb-1">기타소득금액 계산</p>
                    <p className="text-[12px] text-muted-foreground leading-relaxed">
                      기타소득금액 = 출금금액(수입금액) − 필요경비(60% 인정)<br />
                      예) 3,000,000원 = 7,500,000원 − 4,500,000원(필요경비 60%)<br />
                      → 300만 원 이하: 분리과세 선택 가능<br />
                      → 300만 원 초과: 종합소득세 합산 신고 대상
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1.5">
                      ※ 필요경비란 노력의 대가로 증빙 없이 인정되는 금액입니다.
                    </p>
                  </div>
                </div>
              </div>

              {/* 사업소득 */}
              <div className="rounded-lg border border-border p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="shrink-0 px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-700">사업소득</span>
                  <span className="text-sm font-semibold">연간 누적 7,500,000원 초과 시</span>
                </div>
                <ul className="text-[13px] text-muted-foreground space-y-1.5 ml-1">
                  <li>• 출금 신청금액이 연간 누적 7,500,000원을 초과하는 경우 계속적·반복적 판매 활동으로 보아 사업소득으로 국세청에 통보됩니다.</li>
                  <li>• 이후 출금 신청금액과 상관없이 사업소득 세율(3.3%)이 포함된 금액이 수익금 계정에서 출금 처리됩니다.</li>
                </ul>
                <div className="mt-3 p-3 rounded-lg bg-muted/50">
                  <p className="text-[12px] text-muted-foreground font-semibold mb-1">출금 예시</p>
                  <p className="text-[12px] text-muted-foreground leading-relaxed">
                    50,000원 출금 시 → 플랫폼 수수료 5,000원(10%) + 세금 포함 51,705원(3.3%) + 출금수수료 500원 = 총 57,205원 차감
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 rounded-lg bg-amber-500/5 border border-amber-200">
              <p className="text-[12px] text-amber-700 leading-relaxed font-medium">
                ※ UniFile 총 출금금액이 7,500,000원 미만이더라도 다른 기타소득 지급액과 합산하여 7,500,000원 이상일 경우 종합소득세 신고 대상입니다. 세금신고 누락 시 가산세 등 불이익이 발생할 수 있으니 반드시 다른 소득과 합산하여 국세청에 소득신고 하시기 바랍니다.
              </p>
            </div>

            <div className="mt-3 p-3 rounded-lg bg-muted/50">
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                ※ 위 안내는 일반적인 기준이며, 개인 상황에 따라 달라질 수 있습니다. 정확한 세무 상담은 국세청(126) 또는 세무사에게 문의하시기 바랍니다.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
