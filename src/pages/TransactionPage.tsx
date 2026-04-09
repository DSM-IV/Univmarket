import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getTransactions } from "../services/pointsService";
import type { Transaction } from "../types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CreditCard, Receipt } from "lucide-react";

type FilterTab = "all" | "charge" | "purchase" | "sale" | "withdraw";

const TAB_LABELS: Record<FilterTab, string> = {
  all: "전체",
  charge: "충전",
  purchase: "구매",
  sale: "판매",
  withdraw: "출금",
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
          <h1 className="text-2xl font-bold text-gray-900">거래 내역</h1>
          <Button asChild size="sm" variant="outline">
            <Link to="/charge">
              <CreditCard className="mr-1.5 h-4 w-4" />
              포인트 충전
            </Link>
          </Button>
        </div>

        {/* Tabs */}
        <div className="mb-4 flex border-b border-gray-200">
          {(Object.keys(TAB_LABELS) as FilterTab[]).map((key) => (
            <button
              key={key}
              className={cn(
                "flex-1 py-3 text-center text-sm font-medium transition-colors",
                tab === key
                  ? "border-b-2 border-[#862633] text-[#862633]"
                  : "text-gray-500 hover:text-gray-700"
              )}
              onClick={() => setTab(key)}
            >
              {TAB_LABELS[key]}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <p className="py-16 text-center text-gray-500">불러오는 중...</p>
        ) : filtered.length > 0 ? (
          <div className="space-y-2">
            {filtered.map((t) => {
              const income = isIncome(t.type);
              return (
                <Card key={t.id}>
                  <CardContent className="flex items-center justify-between gap-4 max-sm:gap-2 p-4 max-sm:p-3">
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
                          {t.type === "withdraw" && t.status && (
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
                    <div className="shrink-0 text-right">
                      <span
                        className={cn(
                          "block text-sm font-bold",
                          income ? "text-blue-600" : "text-red-500"
                        )}
                      >
                        {income ? "+" : "-"}
                        {Math.abs(t.amount).toLocaleString()}{t.balanceType === "earnings" ? "원" : "P"}
                      </span>
                      <span className="text-xs text-gray-400">
                        {t.balanceType === "earnings" ? "수익금" : "포인트"} 잔액 {t.balanceAfter.toLocaleString()}{t.balanceType === "earnings" ? "원" : "P"}
                      </span>
                    </div>
                  </CardContent>
                </Card>
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
