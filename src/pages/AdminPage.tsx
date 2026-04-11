import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { collection, query, orderBy, getDocs, doc, updateDoc } from "firebase/firestore";
import { functions, db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { ShieldAlert, Trash2, Ban, Clock, XCircle, ExternalLink, Wallet, CheckCircle, X, GraduationCap, Coins } from "lucide-react";

interface Report {
  id: string;
  materialId: string;
  materialTitle: string;
  type?: "copyright" | "defect";
  reason: string;
  originalSource: string;
  description: string;
  contactEmail: string;
  isRightsHolder: boolean;
  reporterId: string | null;
  reporterName: string;
  purchaseId?: string | null;
  status: string;
  createdAt: string;
}

interface Withdrawal {
  id: string;
  userId: string;
  amount: number;
  fee: number;
  tax: number;
  totalDeduction: number;
  bankName: string;
  accountNumber: string;
  realAccountNumber?: string;
  accountHolder: string;
  status: string;
  description: string;
  createdAt: string;
}

interface ChargeRequest {
  id: string;
  userId: string;
  email: string;
  amount: number;
  senderName: string;
  senderPhone: string;
  receiptNumber?: string;
  receiptType?: string;
  status: string;
  createdAt: string;
}

interface GradeRequest {
  id: string;
  title: string;
  subject: string;
  author: string;
  authorId: string;
  gradeClaim: string;
  gradeImage: string;
  gradeStatus: string;
  createdAt: string;
}

type Section = "reports" | "withdrawals" | "grades" | "charges" | "grants";
type Tab = "pending" | "resolved";

function formatDate(dateStr: string): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("pending");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [banModal, setBanModal] = useState<{ reporterId: string; reporterName: string } | null>(null);
  const [banReason, setBanReason] = useState("");
  const [suspendModal, setSuspendModal] = useState<{ reporterId: string; reporterName: string } | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [suspendDays, setSuspendDays] = useState(7);

  const [section, setSection] = useState<Section>("reports");
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [wdLoading, setWdLoading] = useState(false);
  const [wdTab, setWdTab] = useState<"pending" | "completed" | "rejected">("pending");

  const [chargeRequests, setChargeRequests] = useState<ChargeRequest[]>([]);
  const [chargeLoading, setChargeLoading] = useState(false);
  const [chargeTab, setChargeTab] = useState<"pending" | "approved" | "rejected">("pending");

  const [gradeRequests, setGradeRequests] = useState<GradeRequest[]>([]);
  const [gradeLoading, setGradeLoading] = useState(false);
  const [gradeTab, setGradeTab] = useState<"pending" | "verified" | "rejected">("pending");
  const [gradeImageModal, setGradeImageModal] = useState<string | null>(null);

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
      !confirm(
        `사용자 ${targetId}에게 수익금 ${Math.abs(amountNum).toLocaleString()}원을 ${sign}합니다.\n계속하시겠습니까?`
      )
    ) {
      return;
    }

    setGrantLoading(true);
    try {
      const fn = httpsCallable<
        { targetUserId: string; amount: number; reason: string },
        { success: boolean; balanceAfter: number }
      >(functions, "adminGrantEarnings");
      const result = await fn({
        targetUserId: targetId,
        amount: amountNum,
        reason: grantReason.trim(),
      });
      setGrantResult({
        success: true,
        message: `처리 완료. 현재 수익금 잔액: ${result.data.balanceAfter.toLocaleString()}원`,
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

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/login");
      return;
    }
    fetchReports();
  }, [user, authLoading, navigate]);

  const fetchReports = async () => {
    setLoading(true);
    setError("");
    try {
      const fn = httpsCallable<void, { reports: Report[] }>(functions, "getReports");
      const { data } = await fn();
      setReports(data.reports);
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

  const handleDeleteMaterial = async (report: Report, reason?: "copyright") => {
    const msg = reason === "copyright"
      ? `"${report.materialTitle}" 자료를 저작권 침해 사유로 삭제하시겠습니까?\n구매자에게 저작권 침해 삭제 안내가 표시됩니다.`
      : `"${report.materialTitle}" 자료를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`;
    if (!confirm(msg)) return;

    setActionLoading(report.id);
    try {
      const fn = httpsCallable(functions, "adminDeleteMaterial");
      await fn({ materialId: report.materialId, reportId: report.id, reason });
      setReports((prev) =>
        prev.map((r) =>
          r.id === report.id ? { ...r, status: "resolved" } : r
        )
      );
    } catch {
      const retry = confirm("자료 삭제에 실패했습니다.\n다시 시도하시겠습니까?");
      if (retry) {
        setActionLoading(null);
        handleDeleteMaterial(report, reason);
        return;
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleApproveDefect = async (report: Report) => {
    if (
      !confirm(
        `"${report.materialTitle}" 자료의 하자 신고를 승인합니다.\n\n` +
          `- 해당 자료의 환불되지 않은 모든 구매 건에 대해 포인트가 환불됩니다.\n` +
          `- 판매자의 수익금에서 동일 금액이 회수됩니다.\n` +
          `- 자료가 완전히 삭제됩니다 (복구 불가).\n\n계속하시겠습니까?`
      )
    )
      return;

    setActionLoading(report.id);
    try {
      const fn = httpsCallable<
        { reportId: string },
        { success: boolean; refundedCount: number }
      >(functions, "approveDefectReport");
      const result = await fn({ reportId: report.id });
      alert(`처리 완료: ${result.data.refundedCount}건의 구매가 환불되었습니다.`);
      setReports((prev) =>
        prev.map((r) =>
          r.id === report.id ? { ...r, status: "resolved" } : r
        )
      );
    } catch (e) {
      alert(
        "하자 승인 처리에 실패했습니다.\n" + ((e as Error).message || "")
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleDismiss = async (reportId: string) => {
    if (!confirm("이 신고를 기각하시겠습니까?")) return;

    setActionLoading(reportId);
    try {
      const fn = httpsCallable(functions, "updateReportStatus");
      await fn({ reportId, status: "dismissed" });
      setReports((prev) =>
        prev.map((r) =>
          r.id === reportId ? { ...r, status: "dismissed" } : r
        )
      );
    } catch {
      if (confirm("처리에 실패했습니다.\n다시 시도하시겠습니까?")) {
        setActionLoading(null);
        handleDismiss(reportId);
        return;
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleBanUser = async () => {
    if (!banModal) return;
    if (!confirm(`"${banModal.reporterName}" 판매자를 탈퇴 처리하시겠습니까?\n계정이 비활성화되고 모든 자료가 비공개 됩니다.`)) return;

    setActionLoading("ban");
    try {
      const fn = httpsCallable<
        { targetUserId: string; reason: string },
        { success: boolean; hiddenMaterials: number }
      >(functions, "adminBanUser");
      const { data } = await fn({
        targetUserId: banModal.reporterId,
        reason: banReason,
      });
      alert(`탈퇴 처리 완료. ${data.hiddenMaterials}개 자료가 비공개 되었습니다.`);
      setBanModal(null);
      setBanReason("");
    } catch {
      if (confirm("탈퇴 처리에 실패했습니다.\n다시 시도하시겠습니까?")) {
        setActionLoading(null);
        handleBanUser();
        return;
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleSuspendUser = async () => {
    if (!suspendModal) return;
    if (!confirm(`"${suspendModal.reporterName}" 판매자를 ${suspendDays}일간 정지하시겠습니까?`)) return;

    setActionLoading("suspend");
    try {
      const fn = httpsCallable<
        { targetUserId: string; reason: string; days: number },
        { success: boolean; hiddenMaterials: number; suspendedUntil: string }
      >(functions, "adminSuspendUser");
      const { data } = await fn({
        targetUserId: suspendModal.reporterId,
        reason: suspendReason,
        days: suspendDays,
      });
      const until = new Date(data.suspendedUntil).toLocaleDateString("ko-KR");
      alert(`정지 처리 완료. ${until}까지 정지되며 ${data.hiddenMaterials}개 자료가 비공개 되었습니다.`);
      setSuspendModal(null);
      setSuspendReason("");
      setSuspendDays(7);
    } catch {
      if (confirm("정지 처리에 실패했습니다.\n다시 시도하시겠습니까?")) {
        setActionLoading(null);
        handleSuspendUser();
        return;
      }
    } finally {
      setActionLoading(null);
    }
  };

  const fetchWithdrawals = async () => {
    setWdLoading(true);
    try {
      const fn = httpsCallable<void, { withdrawals: Withdrawal[] }>(functions, "getWithdrawals");
      const { data } = await fn();
      setWithdrawals(data.withdrawals);
    } catch {
      alert("출금 목록을 불러오는 데 실패했습니다.");
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
    if (section === "charges" && chargeRequests.length === 0 && !chargeLoading) {
      fetchChargeRequests();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);

  const fetchGradeRequests = async () => {
    setGradeLoading(true);
    try {
      const q = query(
        collection(db, "materials"),
        orderBy("gradeStatus"),
        orderBy("createdAt", "desc")
      );
      console.log("[admin] fetching grade requests...");
      const snap = await getDocs(q);
      console.log("[admin] grade requests:", snap.size);
      const list = snap.docs
        .filter((d) => d.data().gradeClaim)
        .map((d) => ({
          id: d.id,
          title: d.data().title || "",
          subject: d.data().subject || "",
          author: d.data().author || "",
          authorId: d.data().authorId || "",
          gradeClaim: d.data().gradeClaim || "",
          gradeImage: d.data().gradeImage || "",
          gradeStatus: d.data().gradeStatus || "pending",
          createdAt: d.data().createdAt?.toDate?.()?.toISOString?.() || "",
        }));
      setGradeRequests(list);
    } catch (e) {
      console.error("[admin] fetchGradeRequests error", e);
      alert("성적 인증 목록을 불러오는 데 실패했습니다.\n" + (e as Error).message);
    } finally {
      setGradeLoading(false);
    }
  };

  const handleApproveGrade = async (req: GradeRequest, approvedGrade?: string) => {
    const grade = approvedGrade || req.gradeClaim;
    if (!confirm(`"${req.title}" 자료에 ${grade} 성적 인증을 승인하시겠습니까?`)) return;
    setActionLoading(req.id);
    try {
      await updateDoc(doc(db, "materials", req.id), {
        gradeStatus: "verified",
        verifiedGrade: grade,
      });
      setGradeRequests((prev) =>
        prev.map((r) => r.id === req.id ? { ...r, gradeStatus: "verified" } : r)
      );
    } catch {
      alert("처리에 실패했습니다.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectGrade = async (req: GradeRequest) => {
    if (!confirm(`"${req.title}" 자료의 성적 인증을 거절하시겠습니까?`)) return;
    setActionLoading(req.id);
    try {
      await updateDoc(doc(db, "materials", req.id), {
        gradeStatus: "rejected",
      });
      setGradeRequests((prev) =>
        prev.map((r) => r.id === req.id ? { ...r, gradeStatus: "rejected" } : r)
      );
    } catch {
      alert("처리에 실패했습니다.");
    } finally {
      setActionLoading(null);
    }
  };

  const filteredGradeRequests = gradeRequests.filter((r) => r.gradeStatus === gradeTab);

  const fetchChargeRequests = async () => {
    setChargeLoading(true);
    try {
      const fn = httpsCallable<void, { chargeRequests: ChargeRequest[] }>(functions, "getChargeRequests");
      const { data } = await fn();
      setChargeRequests(data.chargeRequests);
    } catch {
      alert("충전 요청 목록을 불러오는 데 실패했습니다.");
    } finally {
      setChargeLoading(false);
    }
  };

  const handleApproveCharge = async (id: string) => {
    if (!confirm("입금을 확인하고 포인트를 지급하시겠습니까?")) return;
    setActionLoading(id);
    try {
      const fn = httpsCallable(functions, "approveChargeRequest");
      await fn({ requestId: id });
      setChargeRequests((prev) => prev.map((c) => c.id === id ? { ...c, status: "approved" } : c));
    } catch {
      alert("승인 처리에 실패했습니다.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectCharge = async (id: string) => {
    const reason = prompt("거절 사유를 입력하세요:");
    if (reason === null) return;
    setActionLoading(id);
    try {
      const fn = httpsCallable(functions, "rejectChargeRequest");
      await fn({ requestId: id, reason });
      setChargeRequests((prev) => prev.map((c) => c.id === id ? { ...c, status: "rejected" } : c));
    } catch {
      alert("거절 처리에 실패했습니다.");
    } finally {
      setActionLoading(null);
    }
  };

  const filteredChargeRequests = chargeRequests.filter((c) => c.status === chargeTab);

  const handleCompleteWithdrawal = async (id: string) => {
    if (!confirm("입금 완료 처리하시겠습니까?")) return;
    setActionLoading(id);
    try {
      const fn = httpsCallable(functions, "completeWithdrawal");
      await fn({ transactionId: id });
      setWithdrawals((prev) => prev.map((w) => w.id === id ? { ...w, status: "completed" } : w));
    } catch {
      alert("처리에 실패했습니다.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectWithdrawal = async (id: string) => {
    const reason = prompt("거절 사유를 입력하세요 (포인트가 환불됩니다):");
    if (reason === null) return;
    setActionLoading(id);
    try {
      const fn = httpsCallable(functions, "rejectWithdrawal");
      await fn({ transactionId: id, reason });
      setWithdrawals((prev) => prev.map((w) => w.id === id ? { ...w, status: "rejected" } : w));
    } catch {
      alert("처리에 실패했습니다.");
    } finally {
      setActionLoading(null);
    }
  };

  const filteredWithdrawals = withdrawals.filter((w) => w.status === wdTab);

  const filteredReports = reports.filter((r) =>
    tab === "pending" ? r.status === "pending" : r.status !== "pending"
  );

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
            variant={section === "charges" ? "default" : "outline"}
            size="sm"
            onClick={() => setSection("charges")}
          >
            <Coins className="mr-1.5 h-4 w-4" />
            충전 관리
            {chargeRequests.filter((c) => c.status === "pending").length > 0 && (
              <Badge variant="destructive" className="ml-1.5 px-1.5 py-0 text-[10px]">
                {chargeRequests.filter((c) => c.status === "pending").length}
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

        {section === "charges" ? (
          <>
            {/* Charge Tabs */}
            <div className="mb-4 flex border-b border-gray-200">
              {(["pending", "approved", "rejected"] as const).map((t) => (
                <button
                  key={t}
                  className={cn(
                    "flex-1 py-3 text-center text-sm font-medium transition-colors",
                    chargeTab === t
                      ? "border-b-2 border-[#862633] text-[#862633]"
                      : "text-gray-500 hover:text-gray-700"
                  )}
                  onClick={() => setChargeTab(t)}
                >
                  {t === "pending" ? "대기" : t === "approved" ? "승인" : "거절"}
                  {" "}({chargeRequests.filter((c) => c.status === t).length})
                </button>
              ))}
            </div>

            {chargeLoading ? (
              <p className="py-16 text-center text-gray-500">불러오는 중...</p>
            ) : filteredChargeRequests.length === 0 ? (
              <div className="py-16 text-center text-gray-400">
                <Coins className="mx-auto mb-3 h-10 w-10" />
                <p>해당 상태의 충전 요청이 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredChargeRequests.map((req) => (
                  <Card key={req.id} className={cn(req.status === "pending" && "border-l-4 border-l-amber-400")}>
                    <CardContent className="p-5">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <Badge variant={req.status === "pending" ? "destructive" : req.status === "approved" ? "success" : "secondary"}>
                            {req.status === "pending" ? "대기" : req.status === "approved" ? "승인" : "거절"}
                          </Badge>
                          <span className="text-xs text-gray-400">{formatDate(req.createdAt)}</span>
                        </div>
                        <span className="text-lg font-extrabold text-[#862633]">
                          {req.amount.toLocaleString()}원
                        </span>
                      </div>

                      <div className="space-y-1.5 text-sm mb-4">
                        <div className="flex justify-between">
                          <span className="text-gray-500">입금자명</span>
                          <span className="font-semibold">{req.senderName}{req.senderPhone}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">이름</span>
                          <span className="font-medium">{req.senderName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">전화번호 뒷자리</span>
                          <span className="font-medium">{req.senderPhone}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">이메일</span>
                          <span className="font-medium text-xs">{req.email}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">현금영수증</span>
                          <span className="font-medium">
                            {req.receiptNumber
                              ? `${req.receiptType === "phone" ? "휴대폰" : "사업자"} · ${req.receiptNumber}`
                              : "미신청"}
                          </span>
                        </div>
                      </div>

                      {req.status === "pending" && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1 bg-green-600 hover:bg-green-700"
                            onClick={() => handleApproveCharge(req.id)}
                            disabled={actionLoading === req.id}
                          >
                            <CheckCircle className="mr-1 h-4 w-4" />
                            {actionLoading === req.id ? "처리 중..." : "승인 (포인트 지급)"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive border-destructive hover:bg-destructive/5"
                            onClick={() => handleRejectCharge(req.id)}
                            disabled={actionLoading === req.id}
                          >
                            <XCircle className="mr-1 h-4 w-4" />
                            거절
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        ) : section === "grades" ? (
          <>
            {/* Grade Verification Tabs */}
            <div className="mb-4 flex border-b border-gray-200">
              {(["pending", "verified", "rejected"] as const).map((t) => (
                <button
                  key={t}
                  className={cn(
                    "flex-1 py-3 text-center text-sm font-medium transition-colors",
                    gradeTab === t
                      ? "border-b-2 border-[#862633] text-[#862633]"
                      : "text-gray-500 hover:text-gray-700"
                  )}
                  onClick={() => setGradeTab(t)}
                >
                  {t === "pending" ? "심사 대기" : t === "verified" ? "승인 완료" : "거절"}
                  {" "}({gradeRequests.filter((r) => r.gradeStatus === t).length})
                </button>
              ))}
            </div>

            {gradeLoading ? (
              <p className="py-16 text-center text-gray-500">불러오는 중...</p>
            ) : filteredGradeRequests.length === 0 ? (
              <div className="py-16 text-center text-gray-400">
                <GraduationCap className="mx-auto mb-3 h-10 w-10" />
                <p>해당 상태의 성적 인증 요청이 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredGradeRequests.map((req) => (
                  <Card key={req.id} className={cn(req.gradeStatus === "pending" && "border-l-4 border-l-amber-400")}>
                    <CardContent className="p-5">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <Badge variant={req.gradeStatus === "pending" ? "destructive" : req.gradeStatus === "verified" ? "success" : "secondary"}>
                            {req.gradeStatus === "pending" ? "심사 대기" : req.gradeStatus === "verified" ? "승인" : "거절"}
                          </Badge>
                          <span className="text-xs text-gray-400">{formatDate(req.createdAt)}</span>
                        </div>
                        <span className={cn(
                          "text-lg font-extrabold",
                          req.gradeClaim === "P"
                            ? "text-purple-600"
                            : req.gradeClaim.startsWith("A")
                              ? "text-amber-600"
                              : req.gradeClaim.startsWith("B")
                                ? "text-blue-600"
                                : "text-green-600"
                        )}>
                          {req.gradeClaim}
                        </span>
                      </div>

                      <Separator className="mb-3" />

                      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm max-sm:grid-cols-1 mb-4">
                        <div className="flex gap-2">
                          <span className="w-16 shrink-0 font-medium text-gray-500">자료명</span>
                          <Link to={`/material/${req.id}`} className="text-[#862633] hover:underline">
                            {req.title}
                            <ExternalLink className="ml-1 inline-block h-3 w-3" />
                          </Link>
                        </div>
                        <div className="flex gap-2">
                          <span className="w-16 shrink-0 font-medium text-gray-500">과목</span>
                          <span className="text-gray-700">{req.subject}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="w-16 shrink-0 font-medium text-gray-500">판매자</span>
                          <span className="text-gray-700">{req.author}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="w-16 shrink-0 font-medium text-gray-500">신청 성적</span>
                          <span className="text-gray-900 font-bold">{req.gradeClaim}</span>
                        </div>
                      </div>

                      {/* 성적증명서 이미지 */}
                      {req.gradeImage && (
                        <div className="mb-4">
                          <span className="block text-xs font-medium text-gray-500 mb-2">성적증명서</span>
                          <img
                            src={req.gradeImage}
                            alt="성적증명서"
                            className="w-[240px] h-auto rounded-lg border border-gray-200 shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => setGradeImageModal(req.gradeImage)}
                          />
                        </div>
                      )}

                      {/* Actions */}
                      {req.gradeStatus === "pending" && (
                        <>
                          <Separator className="my-4" />
                          <div className="flex flex-wrap gap-2 items-center">
                            <span className="text-xs text-gray-500 mr-1">승인 성적:</span>
                            {["A+", "A", "B+", "B", "C+", "C", "P"].map((g) => (
                              <Button
                                key={g}
                                variant={g === req.gradeClaim ? "default" : "outline"}
                                size="sm"
                                className={cn(
                                  "text-xs font-bold min-w-[40px]",
                                  g === req.gradeClaim && "bg-amber-600 hover:bg-amber-700"
                                )}
                                onClick={() => handleApproveGrade(req, g)}
                                disabled={actionLoading === req.id}
                              >
                                {g}
                              </Button>
                            ))}
                            <div className="ml-auto">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:bg-red-50"
                                onClick={() => handleRejectGrade(req)}
                                disabled={actionLoading === req.id}
                              >
                                <XCircle className="mr-1 h-3.5 w-3.5" />
                                거절
                              </Button>
                            </div>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        ) : section === "withdrawals" ? (
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

            {wdLoading ? (
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

                      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm max-sm:grid-cols-1">
                        <div className="flex gap-2">
                          <span className="w-16 shrink-0 font-medium text-gray-500">입금 계좌</span>
                          <span className="text-gray-900 font-semibold">{w.bankName} {w.realAccountNumber || w.accountNumber}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="w-16 shrink-0 font-medium text-gray-500">예금주</span>
                          <span className="text-gray-700">{w.accountHolder}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="w-16 shrink-0 font-medium text-gray-500">수수료</span>
                          <span className="text-gray-700">{w.fee?.toLocaleString() || 0}원</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="w-16 shrink-0 font-medium text-gray-500">세금</span>
                          <span className="text-gray-700">{w.tax?.toLocaleString() || 0}원</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="w-16 shrink-0 font-medium text-gray-500">총 차감</span>
                          <span className="text-gray-900 font-semibold">{w.totalDeduction?.toLocaleString() || 0}원</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="w-16 shrink-0 font-medium text-gray-500">사용자 ID</span>
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
        ) : section === "grants" ? (
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
        ) : (
          <>

        {/* Report Tabs */}
        <div className="mb-4 flex border-b border-gray-200">
          <button
            className={cn(
              "flex-1 py-3 text-center text-sm font-medium transition-colors",
              tab === "pending"
                ? "border-b-2 border-[#862633] text-[#862633]"
                : "text-gray-500 hover:text-gray-700"
            )}
            onClick={() => setTab("pending")}
          >
            대기 중 ({reports.filter((r) => r.status === "pending").length})
          </button>
          <button
            className={cn(
              "flex-1 py-3 text-center text-sm font-medium transition-colors",
              tab === "resolved"
                ? "border-b-2 border-[#862633] text-[#862633]"
                : "text-gray-500 hover:text-gray-700"
            )}
            onClick={() => setTab("resolved")}
          >
            처리 완료 ({reports.filter((r) => r.status !== "pending").length})
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <p className="py-16 text-center text-gray-500">신고 목록을 불러오는 중...</p>
        ) : error ? (
          <p className="py-16 text-center text-red-500">{error}</p>
        ) : filteredReports.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <ShieldAlert className="mx-auto mb-3 h-10 w-10" />
            <p>{tab === "pending" ? "처리 대기 중인 신고가 없습니다." : "처리된 신고가 없습니다."}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredReports.map((report) => (
              <Card
                key={report.id}
                className={cn(
                  report.status === "pending" && "border-l-4 border-l-amber-400"
                )}
              >
                <CardContent className="p-5">
                  {/* Card header row */}
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          report.status === "pending"
                            ? "destructive"
                            : report.status === "resolved"
                              ? "success"
                              : "secondary"
                        }
                      >
                        {report.status === "pending"
                          ? "대기"
                          : report.status === "resolved"
                            ? "처리 완료"
                            : "기각"}
                      </Badge>
                      <Badge
                        className={cn(
                          "font-bold",
                          (report.type || "copyright") === "defect"
                            ? "bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100"
                            : "bg-red-100 text-red-800 border-red-200 hover:bg-red-100"
                        )}
                      >
                        {(report.type || "copyright") === "defect" ? "자료 하자" : "저작권 침해"}
                      </Badge>
                      <span className="text-xs text-gray-400">
                        {formatDate(report.createdAt)}
                      </span>
                    </div>
                    <Badge variant="outline">{report.reason}</Badge>
                  </div>

                  <Separator className="mb-3" />

                  {/* Body */}
                  <div className="space-y-2.5 text-sm">
                    <div className="flex gap-2">
                      <span className="w-16 shrink-0 font-medium text-gray-500">신고 대상</span>
                      <Link
                        to={`/material/${report.materialId}`}
                        className="text-[#862633] hover:underline"
                      >
                        {report.materialTitle || report.materialId}
                        <ExternalLink className="ml-1 inline-block h-3 w-3" />
                      </Link>
                    </div>

                    {report.originalSource && (
                      <div className="flex gap-2">
                        <span className="w-16 shrink-0 font-medium text-gray-500">원본 출처</span>
                        <span className="text-gray-700">{report.originalSource}</span>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <span className="w-16 shrink-0 font-medium text-gray-500">상세 설명</span>
                      <p className="whitespace-pre-wrap text-gray-700">{report.description}</p>
                    </div>

                    <div className="flex flex-wrap gap-x-6 gap-y-1 pt-1">
                      <div className="flex gap-2">
                        <span className="font-medium text-gray-500">신고자</span>
                        <span className="text-gray-700">{report.reporterName}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="font-medium text-gray-500">연락처</span>
                        <span className="text-gray-700">{report.contactEmail}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="font-medium text-gray-500">권리자</span>
                        <span className="text-gray-700">{report.isRightsHolder ? "예" : "아니오"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  {report.status === "pending" && (
                    <>
                      <Separator className="my-4" />
                      <div className="flex flex-wrap gap-2">
                        {(report.type || "copyright") === "defect" ? (
                          <Button
                            variant="destructive"
                            size="sm"
                            className="bg-amber-600 hover:bg-amber-700"
                            onClick={() => handleApproveDefect(report)}
                            disabled={actionLoading === report.id}
                          >
                            <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                            {actionLoading === report.id ? "처리 중..." : "하자 인정 & 환불"}
                          </Button>
                        ) : null}
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteMaterial(report)}
                          disabled={actionLoading === report.id}
                        >
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                          {actionLoading === report.id ? "처리 중..." : "자료 삭제"}
                        </Button>
                        {(report.type || "copyright") !== "defect" && (
                          <Button
                            variant="destructive"
                            size="sm"
                            className="bg-orange-600 hover:bg-orange-700"
                            onClick={() => handleDeleteMaterial(report, "copyright")}
                            disabled={actionLoading === report.id}
                          >
                            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                            저작권 침해 삭제
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-amber-300 text-amber-700 hover:bg-amber-50"
                          onClick={() =>
                            setSuspendModal({
                              reporterId: report.reporterId || "",
                              reporterName: report.reporterName,
                            })
                          }
                          disabled={!report.reporterId}
                        >
                          <Clock className="mr-1.5 h-3.5 w-3.5" />
                          판매자 정지
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-red-300 text-red-700 hover:bg-red-50"
                          onClick={() =>
                            setBanModal({
                              reporterId: report.reporterId || "",
                              reporterName: report.reporterName,
                            })
                          }
                          disabled={!report.reporterId}
                        >
                          <Ban className="mr-1.5 h-3.5 w-3.5" />
                          판매자 탈퇴
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDismiss(report.id)}
                          disabled={actionLoading === report.id}
                        >
                          <XCircle className="mr-1.5 h-3.5 w-3.5" />
                          기각
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
        )}
      </div>

      {/* Ban Modal */}
      {banModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setBanModal(null)}
        >
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle>판매자 탈퇴 처리</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">
                <strong>{banModal.reporterName}</strong>의 계정을 비활성화하고 모든 자료를 비공개 처리합니다.
              </p>
              <div>
                <label htmlFor="banReason" className="mb-1.5 block text-sm font-medium text-gray-700">
                  탈퇴 사유
                </label>
                <textarea
                  id="banReason"
                  placeholder="탈퇴 사유를 입력하세요"
                  rows={3}
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#862633] focus:outline-none focus:ring-1 focus:ring-[#862633]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setBanModal(null)}>
                  취소
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleBanUser}
                  disabled={actionLoading === "ban"}
                >
                  {actionLoading === "ban" ? "처리 중..." : "탈퇴 처리"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Grade Image Modal */}
      {gradeImageModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setGradeImageModal(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <img
              src={gradeImageModal}
              alt="성적증명서"
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
            />
            <button
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center bg-black/60 text-white rounded-full border-none cursor-pointer hover:bg-black/80 transition-colors"
              onClick={() => setGradeImageModal(null)}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Suspend Modal */}
      {suspendModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSuspendModal(null)}
        >
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle>판매자 정지 처리</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">
                <strong>{suspendModal.reporterName}</strong>의 활동을 일시 정지하고 모든 자료를 비공개 처리합니다.
              </p>
              <div>
                <label htmlFor="suspendDays" className="mb-1.5 block text-sm font-medium text-gray-700">
                  정지 기간
                </label>
                <div className="flex gap-2">
                  {[3, 7, 14, 30].map((d) => (
                    <Button
                      key={d}
                      type="button"
                      variant={suspendDays === d ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSuspendDays(d)}
                    >
                      {d}일
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <label htmlFor="suspendReason" className="mb-1.5 block text-sm font-medium text-gray-700">
                  정지 사유
                </label>
                <textarea
                  id="suspendReason"
                  placeholder="정지 사유를 입력하세요"
                  rows={3}
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#862633] focus:outline-none focus:ring-1 focus:ring-[#862633]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setSuspendModal(null)}>
                  취소
                </Button>
                <Button
                  variant="default"
                  className="bg-amber-600 hover:bg-amber-700"
                  onClick={handleSuspendUser}
                  disabled={actionLoading === "suspend"}
                >
                  {actionLoading === "suspend" ? "처리 중..." : `${suspendDays}일 정지`}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
