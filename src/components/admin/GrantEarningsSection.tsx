import { useState } from "react";
import { apiPost } from "../../api/client";
import { useDialog } from "../../contexts/DialogContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Wallet, CheckCircle, XCircle } from "lucide-react";

export default function GrantEarningsSection() {
  const dialog = useDialog();
  const [grantTargetId, setGrantTargetId] = useState("");
  const [grantAmount, setGrantAmount] = useState("");
  const [grantReason, setGrantReason] = useState("");
  const [grantLoading, setGrantLoading] = useState(false);
  const [grantResult, setGrantResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleGrantEarnings = async () => {
    setGrantResult(null);
    const targetId = grantTargetId.trim();
    const amountNum = parseInt(grantAmount, 10);

    if (!targetId) {
      setGrantResult({ success: false, message: "대상 사용자 UID를 입력해주세요." });
      return;
    }
    if (!Number.isInteger(amountNum) || amountNum === 0) {
      setGrantResult({ success: false, message: "유효한 금액을 입력해주세요 (0이 아닌 정수)." });
      return;
    }

    const sign = amountNum > 0 ? "지급" : "회수";
    if (
      !(await dialog.confirm({
        title: "수익금 지급 / 회수",
        description: `사용자 ${targetId}에게 수익금 ${Math.abs(amountNum).toLocaleString()}원을 ${sign}합니다.\n계속하시겠습니까?`,
        confirmText: "실행",
      }))
    ) {
      return;
    }

    setGrantLoading(true);
    try {
      const result = await apiPost<{ success: boolean; balanceAfter?: number }>(
        `/admin/users/${targetId}/grant-earnings`,
        { amount: amountNum, reason: grantReason.trim() }
      );
      setGrantResult({
        success: true,
        message: result.balanceAfter !== undefined
          ? `처리 완료. 현재 수익금 잔액: ${Number(result.balanceAfter).toLocaleString()}원`
          : "처리 완료.",
      });
      setGrantAmount("");
      setGrantReason("");
    } catch (e) {
      setGrantResult({
        success: false,
        message: (e as Error).message || "처리에 실패했습니다.",
      });
    } finally {
      setGrantLoading(false);
    }
  };

  return (
    <>
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-bold mb-1 text-gray-900">수익금 지급 / 회수</h2>
          <p className="text-sm text-gray-500 mb-5">
            특정 사용자에게 수익금을 추가하거나 회수합니다. 모든 처리는 admin_log와 transactions에 기록됩니다.
          </p>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                대상 사용자 UID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={grantTargetId}
                onChange={(e) => setGrantTargetId(e.target.value)}
                placeholder="예: abc123def456 (Firebase Auth UID)"
                disabled={grantLoading}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono shadow-sm focus:border-[#862633] focus:outline-none focus:ring-1 focus:ring-[#862633]"
              />
              <p className="mt-1 text-xs text-gray-400">
                Firebase 콘솔 → Authentication에서 이메일로 검색해 UID를 복사할 수 있습니다.
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                금액 <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={grantAmount}
                onChange={(e) => setGrantAmount(e.target.value)}
                placeholder="양수 = 지급, 음수 = 회수 (예: 10000 또는 -5000)"
                disabled={grantLoading}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#862633] focus:outline-none focus:ring-1 focus:ring-[#862633]"
              />
              <p className="mt-1 text-xs text-gray-400">
                한 번에 최대 ±1,000만원까지 가능합니다.
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                사유
              </label>
              <input
                type="text"
                value={grantReason}
                onChange={(e) => setGrantReason(e.target.value)}
                placeholder="예: 이벤트 보상, 테스트, 보정 환불 등"
                disabled={grantLoading}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#862633] focus:outline-none focus:ring-1 focus:ring-[#862633]"
              />
            </div>

            <Button
              onClick={handleGrantEarnings}
              disabled={grantLoading || !grantTargetId.trim() || !grantAmount.trim()}
              className="w-full"
            >
              <Wallet className="mr-2 h-4 w-4" />
              {grantLoading ? "처리 중..." : "지급 / 회수 실행"}
            </Button>

            {grantResult && (
              <div
                className={cn(
                  "flex items-start gap-2 rounded-md px-4 py-3 text-sm",
                  grantResult.success
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-red-50 text-red-600"
                )}
              >
                {grantResult.success ? (
                  <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
                )}
                <span>{grantResult.message}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
