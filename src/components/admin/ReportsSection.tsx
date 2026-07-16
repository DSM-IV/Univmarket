import { useState, type Dispatch, type SetStateAction } from "react";
import { Link } from "react-router-dom";
import { apiPost, apiDelete } from "../../api/client";
import { useDialog } from "../../contexts/DialogContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { ShieldAlert, Trash2, Ban, Clock, XCircle, ExternalLink, CheckCircle } from "lucide-react";
import { formatDate, type Report } from "./types";

type Tab = "pending" | "resolved";

interface Props {
  reports: Report[];
  setReports: Dispatch<SetStateAction<Report[]>>;
  loading: boolean;
  error: string;
}

export default function ReportsSection({ reports, setReports, loading, error }: Props) {
  const dialog = useDialog();
  const [tab, setTab] = useState<Tab>("pending");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [banModal, setBanModal] = useState<{ reporterId: string; reporterName: string } | null>(null);
  const [banReason, setBanReason] = useState("");
  const [suspendModal, setSuspendModal] = useState<{ reporterId: string; reporterName: string } | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [suspendDays, setSuspendDays] = useState(7);

  const handleDeleteMaterial = async (report: Report, reason?: "copyright") => {
    const msg = reason === "copyright"
      ? `"${report.materialTitle}" 자료를 저작권 침해 사유로 삭제하시겠습니까?\n구매자에게 저작권 침해 삭제 안내가 표시됩니다.`
      : `"${report.materialTitle}" 자료를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`;
    if (!(await dialog.confirm({ title: "자료 삭제", description: msg, confirmText: "삭제", destructive: true }))) return;

    setActionLoading(report.id);
    try {
      await apiDelete(`/admin/materials/${report.materialId}`, { reportId: report.id, reason });
      setReports((prev) =>
        prev.map((r) =>
          r.id === report.id ? { ...r, status: "resolved" } : r
        )
      );
    } catch {
      const retry = await dialog.confirm({ title: "처리 실패", description: "자료 삭제에 실패했습니다.\n다시 시도하시겠습니까?", confirmText: "다시 시도" });
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
      !(await dialog.confirm({
        title: "하자 인정 & 환불",
        description:
          `"${report.materialTitle}" 자료의 하자 신고를 승인합니다.\n\n` +
          `- 해당 자료의 환불되지 않은 모든 구매 건에 대해 결제 금액이 환불됩니다.\n` +
          `- 판매자의 수익금에서 동일 금액이 회수됩니다.\n` +
          `- 자료가 완전히 삭제됩니다 (복구 불가).\n\n계속하시겠습니까?`,
        confirmText: "승인",
        destructive: true,
      }))
    )
      return;

    setActionLoading(report.id);
    try {
      const result = await apiPost<{ success: boolean; refundedCount: number }>(
        `/admin/reports/${report.id}/approve-defect`
      );
      void dialog.alert({ description: `처리 완료: ${result.refundedCount}건의 구매가 환불되었습니다.` });
      setReports((prev) =>
        prev.map((r) =>
          r.id === report.id ? { ...r, status: "resolved" } : r
        )
      );
    } catch (e) {
      void dialog.alert({
        description: "하자 승인 처리에 실패했습니다.\n" + ((e as Error).message || ""),
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDismiss = async (reportId: string) => {
    if (!(await dialog.confirm({ title: "신고 기각", description: "이 신고를 기각하시겠습니까?", confirmText: "기각", destructive: true }))) return;

    setActionLoading(reportId);
    try {
      await apiPost(`/admin/reports/${reportId}/status`, { status: "dismissed" });
      setReports((prev) =>
        prev.map((r) =>
          r.id === reportId ? { ...r, status: "dismissed" } : r
        )
      );
    } catch {
      if (await dialog.confirm({ title: "처리 실패", description: "처리에 실패했습니다.\n다시 시도하시겠습니까?", confirmText: "다시 시도" })) {
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
    if (!(await dialog.confirm({ title: "판매자 탈퇴 처리", description: `"${banModal.reporterName}" 판매자를 탈퇴 처리하시겠습니까?\n계정이 비활성화되고 모든 자료가 비공개 됩니다.`, confirmText: "탈퇴 처리", destructive: true }))) return;

    setActionLoading("ban");
    try {
      const data = await apiPost<{ success: boolean; hiddenMaterials: number }>(
        `/admin/users/${banModal.reporterId}/ban`,
        { reason: banReason }
      );
      void dialog.alert({ description: `탈퇴 처리 완료. ${data.hiddenMaterials}개 자료가 비공개 되었습니다.` });
      setBanModal(null);
      setBanReason("");
    } catch {
      if (await dialog.confirm({ title: "처리 실패", description: "탈퇴 처리에 실패했습니다.\n다시 시도하시겠습니까?", confirmText: "다시 시도" })) {
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
    if (!(await dialog.confirm({ title: "판매자 정지", description: `"${suspendModal.reporterName}" 판매자를 ${suspendDays}일간 정지하시겠습니까?`, confirmText: "정지", destructive: true }))) return;

    setActionLoading("suspend");
    try {
      const data = await apiPost<{ success: boolean; hiddenMaterials: number; suspendedUntil: string }>(
        `/admin/users/${suspendModal.reporterId}/suspend`,
        { reason: suspendReason, days: suspendDays }
      );
      const until = new Date(data.suspendedUntil).toLocaleDateString("ko-KR");
      void dialog.alert({ description: `정지 처리 완료. ${until}까지 정지되며 ${data.hiddenMaterials}개 자료가 비공개 되었습니다.` });
      setSuspendModal(null);
      setSuspendReason("");
      setSuspendDays(7);
    } catch {
      if (await dialog.confirm({ title: "처리 실패", description: "정지 처리에 실패했습니다.\n다시 시도하시겠습니까?", confirmText: "다시 시도" })) {
        setActionLoading(null);
        handleSuspendUser();
        return;
      }
    } finally {
      setActionLoading(null);
    }
  };

  const filteredReports = reports.filter((r) =>
    tab === "pending" ? r.status === "pending" : r.status !== "pending"
  );

  return (
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
    </>
  );
}
