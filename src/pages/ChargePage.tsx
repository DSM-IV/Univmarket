import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle, Copy, Clock } from "lucide-react";
import { apiPost, apiGetList } from "../api/client";

const PRESET_AMOUNTS = [1000, 3000, 5000, 10000, 30000, 50000];
const VAT_RATE = 0.10;

// 입금 계좌 정보 (클로즈드 베타 기간 동안 수동 계좌이체)
const BANK_NAME = "토스뱅크";
const BANK_ACCOUNT = "100011447452";
const BANK_HOLDER = "장찬수";

interface ChargeRequest {
  id: number;
  amount: number | string;
  transferAmount: number | string;
  vat: number | string;
  senderName: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

function calcChargeDetails(amount: number) {
  const vat = Math.ceil(amount * VAT_RATE);
  const transferAmount = amount + vat;
  return { vat, transferAmount };
}

function formatStatus(status: string): { label: string; color: string } {
  switch (status) {
    case "approved":
      return { label: "충전 완료", color: "text-green-600 bg-green-50 border-green-200" };
    case "rejected":
      return { label: "거절됨", color: "text-destructive bg-destructive/5 border-destructive/30" };
    default:
      return { label: "입금 확인 대기", color: "text-amber-700 bg-amber-50 border-amber-200" };
  }
}

export default function ChargePage() {
  const { user, userProfile, refreshProfile } = useAuth();
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [senderName, setSenderName] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [myRequests, setMyRequests] = useState<ChargeRequest[]>([]);

  const loadMyRequests = async () => {
    if (!user) return;
    try {
      const list = await apiGetList<ChargeRequest>("/charge-requests/me?limit=10");
      setMyRequests(list);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadMyRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!userProfile) return;
    setSenderName((prev) => prev || userProfile.nickname || "");
  }, [userProfile]);

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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  const handleSubmit = async () => {
    setError("");
    setSuccess("");
    if (amount < 1000) {
      setError("충전 금액을 선택해 주세요.");
      return;
    }
    if (!senderName.trim()) {
      setError("입금자명을 입력해 주세요.");
      return;
    }
    if (!/^[0-9\-]{9,15}$/.test(senderPhone.trim())) {
      setError("입금자 연락처 형식이 올바르지 않습니다.");
      return;
    }

    setLoading(true);
    try {
      await apiPost("/charge-requests", {
        amount,
        senderName: senderName.trim(),
        senderPhone: senderPhone.trim(),
      });
      setSuccess("충전 요청이 접수되었습니다. 입금 확인 후 포인트가 지급됩니다.");
      setSelectedAmount(null);
      await loadMyRequests();
      await refreshProfile();
    } catch (err) {
      setError((err as Error).message || "요청 접수에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-start justify-center px-6 py-12 bg-muted/50">
      <div className="w-full max-w-[560px] space-y-4">
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

            {/* 베타 기간 안내 */}
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-[13px] font-semibold text-amber-900 mb-1">
                클로즈드 베타 기간 안내
              </p>
              <p className="text-[12px] leading-relaxed text-amber-800">
                베타 기간 동안은 계좌이체로만 충전이 가능합니다. 입금 후 관리자가 확인하면
                포인트가 자동 지급됩니다. (영업일 기준 24시간 이내)
              </p>
            </div>

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

            {/* 금액 요약 */}
            {amount > 0 && (
              <div>
                <Separator className="mb-4" />
                <div className="space-y-2">
                  <div className="flex justify-between py-1 text-sm text-muted-foreground">
                    <span>충전 포인트</span>
                    <span>{amount.toLocaleString()}P</span>
                  </div>
                  <div className="flex justify-between py-1 text-sm text-muted-foreground">
                    <span>부가세 (10%)</span>
                    <span>+{vat.toLocaleString()}원</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between py-1 text-base font-bold text-[#862633]">
                    <span>입금하실 금액</span>
                    <span>{transferAmount.toLocaleString()}원</span>
                  </div>
                </div>
              </div>
            )}

            {/* 입금 계좌 */}
            {amount > 0 && (
              <div className="rounded-lg border border-border bg-background p-4 space-y-2">
                <p className="text-[13px] font-semibold text-foreground mb-2">입금 계좌</p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">은행</span>
                  <span className="font-medium text-foreground">{BANK_NAME}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">계좌번호</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-foreground">{BANK_ACCOUNT}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(BANK_ACCOUNT.replace(/-/g, ""))}
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                      title="계좌번호 복사"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">예금주</span>
                  <span className="font-medium text-foreground">{BANK_HOLDER}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">입금 금액</span>
                  <span className="font-bold text-[#862633]">{transferAmount.toLocaleString()}원</span>
                </div>
              </div>
            )}

            {/* 입금자 정보 */}
            {amount > 0 && (
              <div className="space-y-3">
                <div>
                  <label className="block text-[13px] font-semibold text-foreground mb-1.5">
                    입금자명 <span className="text-destructive">*</span>
                  </label>
                  <Input
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    placeholder="실제 입금자명과 동일하게 입력"
                    maxLength={20}
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-foreground mb-1.5">
                    연락처 <span className="text-destructive">*</span>
                  </label>
                  <Input
                    value={senderPhone}
                    onChange={(e) => setSenderPhone(e.target.value)}
                    placeholder="010-1234-5678"
                    maxLength={15}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  입금자명과 실제 입금 내역이 일치하지 않으면 충전이 지연될 수 있습니다.
                </p>
              </div>
            )}

            <Button
              className="w-full h-12 text-base font-bold bg-[#862633] hover:bg-[#6B1E29] text-white"
              onClick={handleSubmit}
              disabled={amount < 1000 || loading}
            >
              {loading ? "요청 중..." : "충전 요청하기"}
            </Button>

            {error && (
              <div className="flex items-center gap-2 bg-destructive/5 text-destructive rounded-lg py-3 px-4 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 bg-green-50 text-green-700 border border-green-200 rounded-lg py-3 px-4 text-sm">
                <CheckCircle className="h-4 w-4 shrink-0" />
                <span>{success}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 내 충전 요청 내역 */}
        {myRequests.length > 0 && (
          <Card className="w-full shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">내 충전 요청</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {myRequests.map((req) => {
                const status = formatStatus(req.status);
                return (
                  <div
                    key={req.id}
                    className="flex items-center justify-between py-2.5 border-b border-border last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {Number(req.amount).toLocaleString()}P 충전
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(req.createdAt).toLocaleString("ko-KR", {
                          year: "2-digit",
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold border",
                        status.color
                      )}
                    >
                      {req.status === "pending" && <Clock className="h-3 w-3" />}
                      {req.status === "approved" && <CheckCircle className="h-3 w-3" />}
                      {req.status === "rejected" && <AlertCircle className="h-3 w-3" />}
                      {status.label}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

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
            </ul>

            <div className="mt-4 p-3.5 rounded-lg bg-amber-50 border border-amber-200">
              <p className="text-[12px] text-amber-800 leading-relaxed">
                환불을 원하시면{" "}
                <a
                  href="mailto:unifileservice@gmail.com"
                  className="font-semibold underline"
                >
                  unifileservice@gmail.com
                </a>
                으로 회원 정보·충전 내역과 함께 요청해 주세요.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
