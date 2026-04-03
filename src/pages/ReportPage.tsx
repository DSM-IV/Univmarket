import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CheckCircle, Info, AlertTriangle } from "lucide-react";

const REPORT_REASONS = [
  "교재/서적 무단 복제",
  "강의자료 무단 배포",
  "논문/학술자료 무단 사용",
  "타인의 자료를 본인 것으로 위장",
  "기타 저작권 침해",
];

export default function ReportPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const materialId = searchParams.get("materialId") || "";
  const materialTitle = searchParams.get("title") || "";

  const [formData, setFormData] = useState({
    reason: "",
    originalSource: "",
    description: "",
    contactEmail: user?.email || "",
    isRightsHolder: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      setFormData({ ...formData, [name]: (e.target as HTMLInputElement).checked });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.reason) {
      setError("신고 사유를 선택해주세요.");
      return;
    }
    if (!formData.description.trim()) {
      setError("상세 설명을 작성해주세요.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await addDoc(collection(db, "reports"), {
        materialId,
        materialTitle,
        reason: formData.reason,
        originalSource: formData.originalSource,
        description: formData.description.trim(),
        contactEmail: formData.contactEmail,
        isRightsHolder: formData.isRightsHolder,
        reporterId: user?.uid || null,
        reporterName: user?.displayName || user?.email || "비회원",
        status: "pending",
        createdAt: serverTimestamp(),
      });
      setSubmitted(true);
    } catch (err) {
      setError((err as Error).message || "신고 접수 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="mx-auto max-w-lg px-4">
          <Card className="text-center">
            <CardContent className="py-10">
              <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-500" />
              <h2 className="mb-2 text-xl font-bold text-gray-900">
                신고가 접수되었습니다
              </h2>
              <p className="mb-1 text-gray-600">
                검토 후 조치 결과를 이메일로 안내드리겠습니다.
              </p>
              <p className="mb-6 text-sm text-gray-400">
                일반적으로 영업일 기준 3~5일 내에 처리됩니다.
              </p>
              <div className="flex justify-center gap-3">
                {materialId && (
                  <Button
                    variant="outline"
                    onClick={() => navigate(`/material/${materialId}`)}
                  >
                    자료 페이지로 돌아가기
                  </Button>
                )}
                <Button onClick={() => navigate("/")}>홈으로</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-2xl px-4">
        <h1 className="mb-1 text-2xl font-bold text-gray-900">저작권 침해 신고</h1>
        <p className="mb-6 text-sm text-gray-500">
          저작권을 침해하는 자료를 발견하셨다면 아래 양식을 통해 신고해주세요.
        </p>

        {/* Notice */}
        <div className="mb-6 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="text-sm text-amber-800">
            <strong className="mb-1 block">신고 전 확인사항</strong>
            <ul className="ml-4 list-disc space-y-0.5">
              <li>허위 신고는 서비스 이용이 제한될 수 있습니다.</li>
              <li>신고 내용은 저작권자 확인 및 조치 목적으로만 사용됩니다.</li>
              <li>접수된 신고는 검토 후 해당 자료의 삭제 또는 판매 중지 조치가 이루어질 수 있습니다.</li>
            </ul>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Target material */}
          {materialTitle && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">신고 대상 자료</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">자료명</span>
                  <span className="text-sm font-medium text-gray-900">{materialTitle}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Reason section */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">신고 사유</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label htmlFor="reason" className="mb-1.5 block text-sm font-medium text-gray-700">
                  침해 유형 *
                </label>
                <select
                  id="reason"
                  name="reason"
                  value={formData.reason}
                  onChange={handleChange}
                  required
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-[#862633] focus:outline-none focus:ring-1 focus:ring-[#862633]"
                >
                  <option value="">선택하세요</option>
                  {REPORT_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="originalSource" className="mb-1.5 block text-sm font-medium text-gray-700">
                  원본 출처
                </label>
                <Input
                  type="text"
                  id="originalSource"
                  name="originalSource"
                  placeholder="예: 「운영체제 10판」 Abraham Silberschatz 저, ISBN 978-89-..."
                  value={formData.originalSource}
                  onChange={handleChange}
                />
                <p className="mt-1 text-xs text-gray-400">
                  침해된 원본 저작물의 제목, 저자, ISBN 또는 URL 등을 입력해주세요.
                </p>
              </div>
              <div>
                <label htmlFor="description" className="mb-1.5 block text-sm font-medium text-gray-700">
                  상세 설명 *
                </label>
                <textarea
                  id="description"
                  name="description"
                  placeholder={"저작권 침해의 구체적인 내용을 설명해주세요.\n예: 해당 자료의 3~15페이지가 교재의 내용을 그대로 복사하여 작성되었습니다."}
                  rows={5}
                  value={formData.description}
                  onChange={handleChange}
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#862633] focus:outline-none focus:ring-1 focus:ring-[#862633]"
                />
              </div>
            </CardContent>
          </Card>

          {/* Reporter info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">신고자 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label htmlFor="contactEmail" className="mb-1.5 block text-sm font-medium text-gray-700">
                  연락처 이메일 *
                </label>
                <Input
                  type="email"
                  id="contactEmail"
                  name="contactEmail"
                  placeholder="처리 결과를 받으실 이메일"
                  value={formData.contactEmail}
                  onChange={handleChange}
                  required
                />
              </div>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  name="isRightsHolder"
                  checked={formData.isRightsHolder}
                  onChange={handleChange}
                  className="h-4 w-4 rounded border-gray-300 text-[#862633] focus:ring-[#862633]"
                />
                <span className="text-sm text-gray-700">
                  본인이 해당 저작물의 저작권자 또는 권리자입니다.
                </span>
              </label>
            </CardContent>
          </Card>

          {error && (
            <div className="flex items-center gap-2 rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" size="lg" disabled={submitting}>
            {submitting ? "접수 중..." : "신고 접수하기"}
          </Button>
        </form>
      </div>
    </div>
  );
}
