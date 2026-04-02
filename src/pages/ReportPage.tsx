import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import "./ReportPage.css";

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
      <div className="report-page">
        <div className="report-inner">
          <div className="report-success-card">
            <div className="report-success-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h2>신고가 접수되었습니다</h2>
            <p>검토 후 조치 결과를 이메일로 안내드리겠습니다.</p>
            <p className="report-success-sub">
              일반적으로 영업일 기준 3~5일 내에 처리됩니다.
            </p>
            <div className="report-success-actions">
              {materialId && (
                <button
                  className="btn-report-back"
                  onClick={() => navigate(`/material/${materialId}`)}
                >
                  자료 페이지로 돌아가기
                </button>
              )}
              <button
                className="btn-report-home"
                onClick={() => navigate("/")}
              >
                홈으로
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="report-page">
      <div className="report-inner">
        <h1 className="report-title">저작권 침해 신고</h1>
        <p className="report-subtitle">
          저작권을 침해하는 자료를 발견하셨다면 아래 양식을 통해 신고해주세요.
        </p>

        <div className="report-notice">
          <div className="report-notice-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
          </div>
          <div className="report-notice-content">
            <strong>신고 전 확인사항</strong>
            <ul>
              <li>허위 신고는 서비스 이용이 제한될 수 있습니다.</li>
              <li>신고 내용은 저작권자 확인 및 조치 목적으로만 사용됩니다.</li>
              <li>접수된 신고는 검토 후 해당 자료의 삭제 또는 판매 중지 조치가 이루어질 수 있습니다.</li>
            </ul>
          </div>
        </div>

        <form className="report-form" onSubmit={handleSubmit}>
          {materialTitle && (
            <div className="form-section">
              <h2>신고 대상 자료</h2>
              <div className="report-target">
                <span className="report-target-label">자료명</span>
                <span className="report-target-value">{materialTitle}</span>
              </div>
            </div>
          )}

          <div className="form-section">
            <h2>신고 사유</h2>
            <div className="form-group">
              <label htmlFor="reason">침해 유형 *</label>
              <select
                id="reason"
                name="reason"
                value={formData.reason}
                onChange={handleChange}
                required
              >
                <option value="">선택하세요</option>
                {REPORT_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="originalSource">원본 출처</label>
              <input
                type="text"
                id="originalSource"
                name="originalSource"
                placeholder="예: 「운영체제 10판」 Abraham Silberschatz 저, ISBN 978-89-..."
                value={formData.originalSource}
                onChange={handleChange}
              />
              <span className="form-hint">
                침해된 원본 저작물의 제목, 저자, ISBN 또는 URL 등을 입력해주세요.
              </span>
            </div>
            <div className="form-group">
              <label htmlFor="description">상세 설명 *</label>
              <textarea
                id="description"
                name="description"
                placeholder="저작권 침해의 구체적인 내용을 설명해주세요.&#10;예: 해당 자료의 3~15페이지가 교재의 내용을 그대로 복사하여 작성되었습니다."
                rows={5}
                value={formData.description}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-section">
            <h2>신고자 정보</h2>
            <div className="form-group">
              <label htmlFor="contactEmail">연락처 이메일 *</label>
              <input
                type="email"
                id="contactEmail"
                name="contactEmail"
                placeholder="처리 결과를 받으실 이메일"
                value={formData.contactEmail}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="isRightsHolder"
                  checked={formData.isRightsHolder}
                  onChange={handleChange}
                />
                <span>본인이 해당 저작물의 저작권자 또는 권리자입니다.</span>
              </label>
            </div>
          </div>

          {error && <p className="report-error">{error}</p>}

          <button type="submit" className="btn-report-submit" disabled={submitting}>
            {submitting ? "접수 중..." : "신고 접수하기"}
          </button>
        </form>
      </div>
    </div>
  );
}
