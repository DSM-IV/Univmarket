import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getTransactions } from "../services/pointsService";
import type { Transaction } from "../types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { CreditCard, Receipt, ChevronDown, ChevronUp } from "lucide-react";

type FilterTab = "all" | "charge" | "purchase" | "sale" | "withdraw";

const TAB_LABELS: Record<FilterTab, string> = {
  all: "전체",
  charge: "충전",
  purchase: "구매",
  sale: "판매",
  withdraw: "출금",
};

const BALANCE_TYPE_MAP: Record<string, { label: string; color: string; bg: string }> = {
  charge: { label: "포인트", color: "text-blue-600", bg: "bg-blue-50" },
  purchase: { label: "포인트", color: "text-blue-600", bg: "bg-blue-50" },
  refund: { label: "포인트", color: "text-blue-600", bg: "bg-blue-50" },
  sale: { label: "수익금", color: "text-emerald-600", bg: "bg-emerald-50" },
  withdraw: { label: "수익금", color: "text-emerald-600", bg: "bg-emerald-50" },
  admin_grant: { label: "수익금", color: "text-emerald-600", bg: "bg-emerald-50" },
};

const TYPE_LABELS: Record<string, string> = {
  charge: "충전",
  purchase: "구매",
  sale: "판매",
  refund: "환불",
  withdraw: "출금",
};

const TYPE_BADGE_VARIANT: Record<string, "default" | "primary" | "secondary" | "success" | "destructive" | "outline"> = {
  charge: "primary",
  purchase: "destructive",
  sale: "success",
  refund: "secondary",
  withdraw: "outline",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "처리 대기",
  completed: "완료",
  failed: "실패",
  rejected: "거절 (환불)",
};

function formatDate(iso: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hour = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${year}.${month}.${day} ${hour}:${min}`;
}

function isIncome(type: string): boolean {
  return type === "charge" || type === "sale" || type === "refund";
}

export default function TransactionPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<FilterTab>("all");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/login");
      return;
    }

    async function fetchTransactions() {
      setLoading(true);
      try {
        const data = await getTransactions(user!.uid, 100);
        setTransactions(data);
      } catch (err) {

      } finally {
        setLoading(false);
      }
    }

    fetchTransactions();
  }, [user, authLoading, navigate]);

  if (authLoading) return <p className="py-20 text-center text-gray-500">불러오는 중...</p>;
  if (!user) return null;

  const filtered =
    tab === "all"
      ? transactions
      : transactions.filter((t) => t.type === tab);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-3xl px-4">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">거래 내역</h1>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">포인트</span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">수익금</span>
            </div>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/charge">
              <CreditCard className="mr-1.5 h-4 w-4" />
              포인트 충전
            </Link>
          </Button>
        </div>

        {/* Tabs */}
        <div className="mb-4 flex border-b border-gray-200">
          {(Object.keys(TAB_LABELS) as FilterTab[]).map((key) => {
            const bt = key !== "all" ? BALANCE_TYPE_MAP[key] : null;
            return (
              <button
                key={key}
                className={cn(
                  "flex-1 py-3 text-center text-sm font-medium transition-colors",
                  tab === key
                    ? "border-b-2 border-[#862633] text-[#862633]"
                    : "text-gray-500 hover:text-gray-700",
                  bt && bt.bg
                )}
                onClick={() => setTab(key)}
              >
                {TAB_LABELS[key]}
              </button>
            );
          })}
        </div>

        {/* Content */}
        {loading ? (
          <p className="py-16 text-center text-gray-500">불러오는 중...</p>
        ) : filtered.length > 0 ? (
          <div className="space-y-2">
            {filtered.map((t) => {
              const income = isIncome(t.type);
              const isWithdraw = t.type === "withdraw";
              return (
                <TransactionCard key={t.id} t={t} income={income} isWithdraw={isWithdraw} />
              );
            })}
          </div>
        ) : (
          <div className="py-16 text-center text-gray-400">
            <Receipt className="mx-auto mb-3 h-10 w-10" />
            <p>거래 내역이 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function TransactionCard({ t, income, isWithdraw }: { t: Transaction; income: boolean; isWithdraw: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <Card className={cn(
      "border-l-4",
      BALANCE_TYPE_MAP[t.type]?.label === "포인트" ? "border-l-blue-400" : "border-l-emerald-400",
      isWithdraw && "cursor-pointer"
    )} onClick={() => isWithdraw && setOpen((v) => !v)}>
      <CardContent className="p-4 max-sm:p-3">
        <div className="flex items-center justify-between gap-4 max-sm:gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <Badge variant={TYPE_BADGE_VARIANT[t.type] || "outline"}>
              {TYPE_LABELS[t.type] || t.type}
            </Badge>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900">
                {t.description}
              </p>
              <div className="flex items-center gap-2">
                <p className="text-xs text-gray-400">
                  {formatDate(t.createdAt)}
                </p>
                {isWithdraw && t.status && (
                  <span className={cn(
                    "text-[11px] font-semibold px-1.5 py-0.5 rounded",
                    t.status === "pending" && "bg-amber-100 text-amber-700",
                    t.status === "completed" && "bg-emerald-100 text-emerald-700",
                    t.status === "failed" && "bg-red-100 text-red-700",
                  )}>
                    {STATUS_LABELS[t.status] || t.status}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="shrink-0 text-right">
              <span className={cn("block text-sm font-bold", income ? "text-blue-600" : "text-red-500")}>
                {income ? "+" : "-"}
                {Math.abs(t.amount).toLocaleString()}{t.balanceType === "earnings" ? "원" : "P"}
              </span>
              <span className="text-xs text-gray-400">
                {t.balanceType === "earnings" ? "수익금" : "포인트"} 잔액 {t.balanceAfter.toLocaleString()}{t.balanceType === "earnings" ? "원" : "P"}
              </span>
            </div>
            {isWithdraw && (
              open ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
            )}
          </div>
        </div>

        {/* 출금 상세 정보 */}
        {isWithdraw && open && (
          <div className="mt-3">
            <Separator className="mb-3" />
            <div className="grid grid-cols-2 gap-2 text-sm max-sm:grid-cols-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">입금 계좌</span>
                <span className="font-medium">{t.bankName} {t.accountNumber}</span>
              </div>
              {t.accountHolder && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">예금주</span>
                  <span className="font-medium">{t.accountHolder}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">플랫폼 수수료</span>
                <span>−{(t.commission ?? 0).toLocaleString()}원</span>
              </div>
              {(t.tax ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">세금 (8.8%)</span>
                  <span>−{(t.tax ?? 0).toLocaleString()}원</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">출금수수료</span>
                <span>−{(t.fee ?? 0).toLocaleString()}원</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold">실수령액</span>
                <span className="font-bold text-primary">{(t.received ?? 0).toLocaleString()}원</span>
              </div>
            </div>
            <div className="mt-3 p-2.5 rounded-lg bg-muted text-center">
              <span className="text-xs text-muted-foreground">
                {t.status === "pending" ? "입금 대기 중 — 영업일 기준 1~3일 소요" :
                 t.status === "completed" ? "입금 완료" : "거절됨"}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
