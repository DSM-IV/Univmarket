import { useState, type Dispatch, type SetStateAction } from "react";
import { Link } from "react-router-dom";
import { apiPatch } from "../../api/client";
import { useDialog } from "../../contexts/DialogContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { XCircle, ExternalLink, X, GraduationCap } from "lucide-react";
import { formatDate, type GradeRequest } from "./types";

interface Props {
  requests: GradeRequest[];
  setRequests: Dispatch<SetStateAction<GradeRequest[]>>;
  loading: boolean;
}

export default function GradeVerificationSection({ requests, setRequests, loading }: Props) {
  const dialog = useDialog();
  const [gradeTab, setGradeTab] = useState<"pending" | "verified" | "rejected">("pending");
  const [gradeImageModal, setGradeImageModal] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleApproveGrade = async (req: GradeRequest, approvedGrade?: string) => {
    const grade = approvedGrade || req.gradeClaim;
    if (!(await dialog.confirm({ title: "성적 인증 승인", description: `"${req.title}" 자료에 ${grade} 성적 인증을 승인하시겠습니까?`, confirmText: "승인" }))) return;
    setActionLoading(req.id);
    try {
      await apiPatch(`/admin/materials/${req.id}/grade`, {
        gradeStatus: "verified",
        verifiedGrade: grade,
      });
      setRequests((prev) =>
        prev.map((r) => r.id === req.id ? { ...r, gradeStatus: "verified" } : r)
      );
    } catch {
      void dialog.alert({ description: "처리에 실패했습니다." });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectGrade = async (req: GradeRequest) => {
    if (!(await dialog.confirm({ title: "성적 인증 거절", description: `"${req.title}" 자료의 성적 인증을 거절하시겠습니까?`, confirmText: "거절", destructive: true }))) return;
    setActionLoading(req.id);
    try {
      await apiPatch(`/admin/materials/${req.id}/grade`, {
        gradeStatus: "rejected",
      });
      setRequests((prev) =>
        prev.map((r) => r.id === req.id ? { ...r, gradeStatus: "rejected" } : r)
      );
    } catch {
      void dialog.alert({ description: "처리에 실패했습니다." });
    } finally {
      setActionLoading(null);
    }
  };

  const filteredGradeRequests = requests.filter((r) => r.gradeStatus === gradeTab);

  return (
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
              {" "}({requests.filter((r) => r.gradeStatus === t).length})
            </button>
          ))}
        </div>

        {loading ? (
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
    </>
  );
}
