import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getTransactions } from "../services/pointsService";
import type { Transaction } from "../types";
import "./TransactionPage.css";

type FilterTab = "all" | "charge" | "purchase" | "sale";

const TAB_LABELS: Record<FilterTab, string> = {
  all: "전체",
  charge: "충전",
  purchase: "구매",
  sale: "판매",
};

const TYPE_LABELS: Record<string, string> = {
  charge: "충전",
  purchase: "구매",
  sale: "판매",
  refund: "환불",
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
        console.error("거래 내역 불러오기 실패:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchTransactions();
  }, [user, authLoading, navigate]);

  if (authLoading) return <p className="tx-loading">불러오는 중...</p>;
  if (!user) return null;

  const filtered =
    tab === "all"
      ? transactions
      : transactions.filter((t) => t.type === tab);

  return (
    <div className="tx-page">
      <div className="tx-inner">
        <div className="tx-header">
          <h1 className="tx-title">거래 내역</h1>
          <Link to="/charge" className="tx-charge-link">
            포인트 충전
          </Link>
        </div>

        <div className="tx-tabs">
          {(Object.keys(TAB_LABELS) as FilterTab[]).map((key) => (
            <button
              key={key}
              className={`tx-tab ${tab === key ? "active" : ""}`}
              onClick={() => setTab(key)}
            >
              {TAB_LABELS[key]}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="tx-loading">불러오는 중...</p>
        ) : filtered.length > 0 ? (
          <div className="tx-list">
            {filtered.map((t) => {
              const income = isIncome(t.type);
              return (
                <div key={t.id} className="tx-item">
                  <div className="tx-item-left">
                    <span className={`tx-type-badge ${t.type}`}>
                      {TYPE_LABELS[t.type] || t.type}
                    </span>
                    <div className="tx-item-detail">
                      <p className="tx-item-desc">{t.description}</p>
                      <p className="tx-item-date">{formatDate(t.createdAt)}</p>
                    </div>
                  </div>
                  <div className="tx-item-right">
                    <span className={`tx-amount ${income ? "income" : "expense"}`}>
                      {income ? "+" : "-"}
                      {Math.abs(t.amount).toLocaleString()}P
                    </span>
                    <span className="tx-balance">
                      잔액 {t.balanceAfter.toLocaleString()}P
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="tx-empty">
            <p>거래 내역이 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}
