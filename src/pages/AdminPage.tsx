import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { ShieldAlert, Trash2, Ban, Clock, XCircle, ExternalLink } from "lucide-react";

interface Report {
  id: string;
  materialId: string;
  materialTitle: string;
  reason: string;
  originalSource: string;
  description: string;
  contactEmail: string;
  isRightsHolder: boolean;
  reporterId: string | null;
  reporterName: string;
  status: string;
  createdAt: string;
}

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

  const handleDeleteMaterial = async (report: Report) => {
    if (!confirm(`"${report.materialTitle}" 자료를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;

    setActionLoading(report.id);
    try {
      const fn = httpsCallable(functions, "adminDeleteMaterial");
      await fn({ materialId: report.materialId, reportId: report.id });
      setReports((prev) =>
        prev.map((r) =>
          r.id === report.id ? { ...r, status: "resolved" } : r
        )
      );
    } catch {
      alert("자료 삭제에 실패했습니다.");
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
      alert("처리에 실패했습니다.");
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
      alert("탈퇴 처리에 실패했습니다.");
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
      alert("정지 처리에 실패했습니다.");
    } finally {
      setActionLoading(null);
    }
  };

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
          <p className="mt-1 text-sm text-gray-500">
            저작권 침해 신고를 관리하고 조치를 취할 수 있습니다.
          </p>
        </div>

        {/* Tabs */}
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
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteMaterial(report)}
                          disabled={actionLoading === report.id}
                        >
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                          {actionLoading === report.id ? "처리 중..." : "자료 삭제"}
                        </Button>
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
