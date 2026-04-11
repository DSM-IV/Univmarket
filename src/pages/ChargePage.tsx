import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2, Copy, Info } from "lucide-react";

const PRESET_AMOUNTS = [1000, 3000, 5000, 10000, 30000, 50000];
const VAT_RATE = 0.10; // 부가세 10%
const CHARGE_FEE_RATE = 0.10; // 수수료 10%

function calcChargeDetails(amount: number) {
  const vat = Math.ceil(amount * VAT_RATE);
  const fee = Math.ceil(amount * CHARGE_FEE_RATE);
  const transferAmount = amount + vat + fee;
  return { vat, fee, transferAmount };
}

const BANK_ACCOUNT = {
  bank: "토스뱅크",
  number: "1110-1144-7452",
  holder: "장찬수(유니파일)",
};

export default function ChargePage() {
  const { user, userProfile } = useAuth();
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [step, setStep] = useState<"select" | "transfer" | "done">("select");
  const [senderName, setSenderName] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [receiptType, setReceiptType] = useState<"phone" | "business">("phone");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

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
  const { vat, fee: chargeFee, transferAmount } = calcChargeDetails(amount);

  const handleCopyAccount = async () => {
    try {
      await navigator.clipboard.writeText(`${BANK_ACCOUNT.bank} ${BANK_ACCOUNT.number}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleConfirmTransfer = async () => {
    if (!senderName.trim()) {
      setError("입금자명을 입력해주세요.");
      return;
    }
    if (!/^\d{4}$/.test(senderPhone)) {
      setError("전화번호 뒷자리 4자리를 입력해주세요.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const fn = httpsCallable(functions, "submitChargeRequest");
      await fn({
        amount,
        transferAmount,
        vat,
        fee: chargeFee,
        senderName: senderName.trim(),
        senderPhone: senderPhone.trim(),
        receiptNumber: receiptNumber.trim() || "",
        receiptType: receiptNumber.trim() ? receiptType : "",
      });
      setStep("done");
    } catch (err) {
      setError((err as Error).message || "요청 중 오류가 발생했습니다.");
    } finally {
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

          {step === "select" && (
            <>
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
                      <div className="flex justify-between py-1 text-sm text-muted-foreground">
                        <span>수수료 (10%)</span>
                        <span>+{chargeFee.toLocaleString()}원</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between py-1 text-base font-bold text-[#862633]">
                        <span>송금 금액</span>
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
                onClick={() => {
                  if (amount < 1000) {
                    setError("충전 금액을 선택해주세요.");
                    return;
                  }
                  setError("");
                  setStep("transfer");
                }}
                disabled={amount < 1000}
              >
                다음
              </Button>

              {error && (
                <div className="flex items-center gap-2 bg-destructive/5 text-destructive rounded-lg py-3 px-4 text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}
            </>
          )}

          {step === "transfer" && (
            <>
              {/* Transfer instructions */}
              <div className="rounded-xl border-2 border-[#862633]/20 bg-[#862633]/[0.02] p-5 space-y-4">
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Info className="w-5 h-5 text-[#862633]" />
                  송금 안내
                </h3>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">은행</span>
                    <span className="font-semibold">{BANK_ACCOUNT.bank}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">계좌번호</span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold font-mono">{BANK_ACCOUNT.number}</span>
                      <button
                        onClick={handleCopyAccount}
                        className="text-xs text-[#862633] hover:underline cursor-pointer bg-transparent border-none flex items-center gap-1"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        {copied ? "복사됨" : "복사"}
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">예금주</span>
                    <span className="font-semibold">{BANK_ACCOUNT.holder}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">송금 금액</span>
                    <span className="text-lg font-bold text-[#862633]">{transferAmount.toLocaleString()}원</span>
                  </div>
                  <div className="text-xs text-muted-foreground text-right">
                    (충전 {amount.toLocaleString()}원 + 부가세 {vat.toLocaleString()}원 + 수수료 {chargeFee.toLocaleString()}원)
                  </div>
                </div>

                <div className="bg-amber-50 text-amber-800 rounded-lg p-3.5 text-sm">
                  <p className="font-semibold mb-1">송금 시 입금자명 규칙</p>
                  <p className="text-amber-700">
                    <span className="font-bold">이름 + 전화번호 뒷 4자리</span>로 입금해주세요.
                  </p>
                  <p className="text-amber-600 text-xs mt-1">
                    예시: 홍길동1234
                  </p>
                </div>
              </div>

              {/* Sender info */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    입금자명
                  </label>
                  <Input
                    type="text"
                    placeholder="실명을 입력하세요"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    className="h-11 text-[15px]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    전화번호 뒷 4자리
                  </label>
                  <Input
                    type="text"
                    placeholder="1234"
                    value={senderPhone}
                    onChange={(e) => setSenderPhone(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
                    maxLength={4}
                    className="h-11 text-[15px]"
                  />
                </div>

                {/* 현금영수증 */}
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    현금영수증 발급 번호 <span className="text-muted-foreground font-normal">(선택)</span>
                  </label>
                  <div className="flex gap-2 mb-2">
                    <button
                      type="button"
                      className={cn(
                        "flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors cursor-pointer",
                        receiptType === "phone"
                          ? "border-[#862633] bg-[#862633]/[0.04] text-[#862633]"
                          : "border-border bg-background text-muted-foreground hover:bg-muted/70"
                      )}
                      onClick={() => setReceiptType("phone")}
                    >
                      휴대폰 번호
                    </button>
                    <button
                      type="button"
                      className={cn(
                        "flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors cursor-pointer",
                        receiptType === "business"
                          ? "border-[#862633] bg-[#862633]/[0.04] text-[#862633]"
                          : "border-border bg-background text-muted-foreground hover:bg-muted/70"
                      )}
                      onClick={() => setReceiptType("business")}
                    >
                      사업자 번호
                    </button>
                  </div>
                  <Input
                    type="text"
                    placeholder={receiptType === "phone" ? "01012345678" : "000-00-00000"}
                    value={receiptNumber}
                    onChange={(e) => setReceiptNumber(e.target.value.replace(/[^\d-]/g, ""))}
                    className="h-11 text-[15px]"
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">
                    현금영수증 발급을 원하시면 번호를 입력해주세요.
                  </p>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-destructive/5 text-destructive rounded-lg py-3 px-4 text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 h-12 text-base font-bold"
                  onClick={() => { setStep("select"); setError(""); }}
                >
                  이전
                </Button>
                <Button
                  className="flex-1 h-12 text-base font-bold bg-[#862633] hover:bg-[#6B1E29] text-white"
                  onClick={handleConfirmTransfer}
                  disabled={loading}
                >
                  {loading ? "처리 중..." : "송금을 완료했어요"}
                </Button>
              </div>
            </>
          )}

          {step === "done" && (
            <div className="text-center py-6 space-y-4">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
              <h3 className="text-xl font-bold text-foreground">충전 요청 완료</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                관리자가 입금을 확인한 후 포인트가 지급됩니다.<br />
                보통 <span className="font-semibold text-foreground">1시간 이내</span>에 처리됩니다.
              </p>
              <div className="bg-muted/70 rounded-lg p-4 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">충전 포인트</span>
                  <span className="font-semibold">{amount.toLocaleString()}P</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">송금 금액</span>
                  <span className="font-semibold">{transferAmount.toLocaleString()}원</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">입금자명</span>
                  <span className="font-semibold">{senderName}{senderPhone}</span>
                </div>
                {receiptNumber && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">현금영수증</span>
                    <span className="font-semibold">{receiptType === "phone" ? "휴대폰" : "사업자"} · {receiptNumber}</span>
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  setStep("select");
                  setSelectedAmount(null);
                  setSenderName("");
                  setSenderPhone("");
                  setReceiptNumber("");
                }}
              >
                추가 충전하기
              </Button>
            </div>
          )}
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
              • 환불은 <span className="font-semibold text-foreground">송금하신 계좌</span>로 처리되며,
              영업일 기준 1~3일 이내에 입금됩니다.
            </li>
            <li>
              • 충전 시 부과된 <span className="font-semibold text-foreground">부가세(10%)·수수료(10%)</span>는
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
