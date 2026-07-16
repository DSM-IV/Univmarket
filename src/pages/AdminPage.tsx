import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { apiGet, apiGetList } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { useDialog } from "../contexts/DialogContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, Wallet, GraduationCap } from "lucide-react";
import type { Report, Withdrawal, GradeRequest } from "../components/admin/types";
import ReportsSection from "../components/admin/ReportsSection";
import GradeVerificationSection from "../components/admin/GradeVerificationSection";
import WithdrawalsSection from "../components/admin/WithdrawalsSection";
import GrantEarningsSection from "../components/admin/GrantEarningsSection";

type Section = "reports" | "withdrawals" | "grades" | "grants";

export default function AdminPage() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const dialog = useDialog();
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [section, setSection] = useState<Section>("reports");
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [wdLoading, setWdLoading] = useState(false);

  const [gradeRequests, setGradeRequests] = useState<GradeRequest[]>([]);
  const [gradeLoading, setGradeLoading] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/login");
      return;
    }
    // userProfile 로드 대기
    if (!userProfile) return;
    if (userProfile.role !== "admin") {
      setError("관리자 권한이 필요합니다.");
      return;
    }
    fetchReports();
  }, [user, userProfile, authLoading, navigate]);

  const fetchReports = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiGet<{ reports?: Report[] } | Report[]>("/admin/reports");
      setReports(Array.isArray(data) ? data : (data?.reports ?? []));
    } catch (err) {
      const msg = (err as Error).message || "";
      if (msg.includes("관리자")) {
        setError("관리자 권한이 필요합니다.");
      } else {
        setError("신고 목록을 불러오는 데 실패했습니다.");
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchWithdrawals = async () => {
    setWdLoading(true);
    try {
      const list = await apiGetList<Withdrawal>("/admin/withdrawals");
      setWithdrawals(list);
    } catch {
      void dialog.alert({ description: "출금 목록을 불러오는 데 실패했습니다." });
    } finally {
      setWdLoading(false);
    }
  };

  useEffect(() => {
    if (section === "withdrawals" && withdrawals.length === 0 && !wdLoading) {
      fetchWithdrawals();
    }
    if (section === "grades" && gradeRequests.length === 0 && !gradeLoading) {
      fetchGradeRequests();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);

  const fetchGradeRequests = async () => {
    setGradeLoading(true);
    try {
      const list = await apiGetList<GradeRequest>("/admin/grade-requests");
      setGradeRequests(list);
    } catch (e) {
      console.error("[admin] fetchGradeRequests error", e);
      void dialog.alert({ description: "성적 인증 목록을 불러오는 데 실패했습니다.\n" + (e as Error).message });
    } finally {
      setGradeLoading(false);
    }
  };

  if (authLoading) return <p className="py-20 text-center text-gray-500">불러오는 중...</p>;

  if (error === "관리자 권한이 필요합니다.") {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="mx-auto max-w-lg px-4">
          <Card className="text-center">
            <CardContent className="py-10">
              <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-red-400" />
              <h2 className="mb-2 text-xl font-bold text-gray-900">접근 권한이 없습니다</h2>
              <p className="mb-6 text-gray-500">관리자만 접근할 수 있는 페이지입니다.</p>
              <Button asChild>
                <Link to="/">홈으로 돌아가기</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">관리자 페이지</h1>
        </div>

        {/* Section Toggle */}
        <div className="mb-5 flex gap-2">
          <Button
            variant={section === "reports" ? "default" : "outline"}
            size="sm"
            onClick={() => setSection("reports")}
          >
            <ShieldAlert className="mr-1.5 h-4 w-4" />
            신고 관리
          </Button>
          <Button
            variant={section === "withdrawals" ? "default" : "outline"}
            size="sm"
            onClick={() => setSection("withdrawals")}
          >
            <Wallet className="mr-1.5 h-4 w-4" />
            출금 관리
            {withdrawals.filter((w) => w.status === "pending").length > 0 && (
              <Badge variant="destructive" className="ml-1.5 px-1.5 py-0 text-[10px]">
                {withdrawals.filter((w) => w.status === "pending").length}
              </Badge>
            )}
          </Button>
          <Button
            variant={section === "grades" ? "default" : "outline"}
            size="sm"
            onClick={() => setSection("grades")}
          >
            <GraduationCap className="mr-1.5 h-4 w-4" />
            성적 인증
            {gradeRequests.filter((r) => r.gradeStatus === "pending").length > 0 && (
              <Badge variant="destructive" className="ml-1.5 px-1.5 py-0 text-[10px]">
                {gradeRequests.filter((r) => r.gradeStatus === "pending").length}
              </Badge>
            )}
          </Button>
          <Button
            variant={section === "grants" ? "default" : "outline"}
            size="sm"
            onClick={() => setSection("grants")}
          >
            <Wallet className="mr-1.5 h-4 w-4" />
            수익금 지급
          </Button>
        </div>

        {section === "grades" ? (
          <GradeVerificationSection requests={gradeRequests} setRequests={setGradeRequests} loading={gradeLoading} />
        ) : section === "withdrawals" ? (
          <WithdrawalsSection withdrawals={withdrawals} setWithdrawals={setWithdrawals} loading={wdLoading} />
        ) : section === "grants" ? (
          <GrantEarningsSection />
        ) : (
          <ReportsSection reports={reports} setReports={setReports} loading={loading} error={error} />
        )}
      </div>
    </div>
  );
}
