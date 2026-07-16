import { useState, type Dispatch, type SetStateAction } from "react";
import { apiPost } from "../../api/client";
import { useDialog } from "../../contexts/DialogContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Wallet, CheckCircle, X } from "lucide-react";
import { formatDate, type Withdrawal } from "./types";

interface Props {
  withdrawals: Withdrawal[];
  setWithdrawals: Dispatch<SetStateAction<Withdrawal[]>>;
  loading: boolean;
}

export default function WithdrawalsSection({ withdrawals, setWithdrawals, loading }: Props) {
  const dialog = useDialog();
  const [wdTab, setWdTab] = useState<"pending" | "completed" | "rejected">("pending");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleCompleteWithdrawal = async (id: string) => {
    if (!(await dialog.confirm({ title: "입금 완료 처리", description: "입금 완료 처리하시겠습니까?", confirmText: "완료 처리" }))) return;
    setActionLoading(id);
    try {
      await apiPost(`/admin/withdrawals/${id}/complete`);
      setWithdrawals((prev) => prev.map((w) => w.id === id ? { ...w, status: "completed" } : w));
    } catch {
      void dialog.alert({ description: "처리에 실패했습니다." });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectWithdrawal = async (id: string) => {
    const reason = prompt("거절 사유를 입력하세요 (수익금이 복구됩니다):");
    if (reason === null) return;
    setActionLoading(id);
    try {
      await apiPost(`/admin/withdrawals/${id}/reject`, { reason });
      setWithdrawals((prev) => prev.map((w) => w.id === id ? { ...w, status: "rejected" } : w));
    } catch {
      void dialog.alert({ description: "처리에 실패했습니다." });
    } finally {
      setActionLoading(null);
    }
  };

  const filteredWithdrawals = withdrawals.filter((w) => w.status === wdTab);

  return (
    <>
      {/* Withdrawal Tabs */}
      <div className="mb-4 flex border-b border-gray-200">
        {(["pending", "completed", "rejected"] as const).map((t) => (
          <button
            key={t}
            className={cn(
              "flex-1 py-3 text-center text-sm font-medium transition-colors",
              wdTab === t
                ? "border-b-2 border-[#862633] text-[#862633]"
                : "text-gray-500 hover:text-gray-700"
            )}
            onClick={() => setWdTab(t)}
          >
            {t === "pending" ? "입금 대기" : t === "completed" ? "입금 완료" : "거절"}
            {" "}({withdrawals.filter((w) => w.status === t).length})
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-16 text-center text-gray-500">불러오는 중...</p>
      ) : filteredWithdrawals.length === 0 ? (
        <div className="py-16 text-center text-gray-400">
          <Wallet className="mx-auto mb-3 h-10 w-10" />
          <p>해당 상태의 출금 신청이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredWithdrawals.map((w) => (
            <Card key={w.id} className={cn(w.status === "pending" && "border-l-4 border-l-amber-400")}>
              <CardContent className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <Badge variant={w.status === "pending" ? "destructive" : w.status === "completed" ? "success" : "secondary"}>
                      {w.status === "pending" ? "입금 대기" : w.status === "completed" ? "완료" : "거절"}
                    </Badge>
                    <span className="text-xs text-gray-400">{formatDate(w.createdAt)}</span>
                  </div>
                  <span className="text-lg font-bold text-gray-900">
                    {Math.abs(w.amount).toLocaleString()}원
                  </span>
                </div>

                <Separator className="mb-3" />

                {/* 실 입금액 강조 */}
                <div className="mb-3 p-3 rounded-lg bg-primary/5 border border-primary/20 flex items-center justify-between">
                  <span className="text-sm font-semibold text-primary">실 입금액</span>
                  <span className="text-lg font-extrabold text-primary">{(w.received ?? 0).toLocaleString()}원</span>
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm max-sm:grid-cols-1">
                  <div className="flex gap-2">
                    <span className="w-20 shrink-0 font-medium text-gray-500">입금 계좌</span>
                    <span className="text-gray-900 font-semibold">{w.bankName} {w.realAccountNumber || w.accountNumber}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="w-20 shrink-0 font-medium text-gray-500">예금주</span>
                    <span className="text-gray-700">{w.accountHolder}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="w-20 shrink-0 font-medium text-gray-500">신청 금액</span>
                    <span className="text-gray-900 font-semibold">{Math.abs(w.amount).toLocaleString()}원</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="w-20 shrink-0 font-medium text-gray-500">플랫폼 수수료</span>
                    <span className="text-gray-700">−{(w.commission ?? 0).toLocaleString()}원</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="w-20 shrink-0 font-medium text-gray-500">세금</span>
                    <span className="text-gray-700">{w.tax ? `−${w.tax.toLocaleString()}원` : "없음"}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="w-20 shrink-0 font-medium text-gray-500">출금수수료</span>
                    <span className="text-gray-700">−{(w.fee ?? 0).toLocaleString()}원</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="w-20 shrink-0 font-medium text-gray-500">사용자 ID</span>
                    <span className="text-gray-500 text-xs font-mono">{w.userId}</span>
                  </div>
                </div>

                {w.status === "pending" && (
                  <>
                    <Separator className="my-4" />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleCompleteWithdrawal(w.id)}
                        disabled={actionLoading === w.id}
                      >
                        <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                        {actionLoading === w.id ? "처리 중..." : "입금 완료"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-red-300 text-red-700 hover:bg-red-50"
                        onClick={() => handleRejectWithdrawal(w.id)}
                        disabled={actionLoading === w.id}
                      >
                        <X className="mr-1.5 h-3.5 w-3.5" />
                        거절
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
