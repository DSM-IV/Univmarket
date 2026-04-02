import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import "./AdminPage.css";

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

  const filteredReports = reports.filter((r) =>
    tab === "pending" ? r.status === "pending" : r.status !== "pending"
  );

  if (authLoading) return <p className="admin-loading">불러오는 중...</p>;

  if (error === "관리자 권한이 필요합니다.") {
    return (
      <div className="admin-page">
        <div className="admin-inner">
          <div className="admin-denied">
            <h2>접근 권한이 없습니다</h2>
            <p>관리자만 접근할 수 있는 페이지입니다.</p>
            <Link to="/">홈으로 돌아가기</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-inner">
        <div className="admin-header">
          <h1>관리자 페이지</h1>
          <p>저작권 침해 신고를 관리하고 조치를 취할 수 있습니다.</p>
        </div>

        <div className="admin-tabs">
          <button
            className={`admin-tab ${tab === "pending" ? "active" : ""}`}
            onClick={() => setTab("pending")}
          >
            대기 중 ({reports.filter((r) => r.status === "pending").length})
          </button>
          <button
            className={`admin-tab ${tab === "resolved" ? "active" : ""}`}
            onClick={() => setTab("resolved")}
          >
            처리 완료 ({reports.filter((r) => r.status !== "pending").length})
          </button>
        </div>

        {loading ? (
          <p className="admin-loading">신고 목록을 불러오는 중...</p>
        ) : error ? (
          <p className="admin-error">{error}</p>
        ) : filteredReports.length === 0 ? (
          <div className="admin-empty">
            <p>{tab === "pending" ? "처리 대기 중인 신고가 없습니다." : "처리된 신고가 없습니다."}</p>
          </div>
        ) : (
          <div className="admin-report-list">
            {filteredReports.map((report) => (
              <div key={report.id} className={`admin-report-card ${report.status}`}>
                <div className="report-card-header">
                  <div className="report-card-meta">
                    <span className={`report-status-badge ${report.status}`}>
                      {report.status === "pending"
                        ? "대기"
                        : report.status === "resolved"
                          ? "처리 완료"
                          : "기각"}
                    </span>
                    <span className="report-date">{formatDate(report.createdAt)}</span>
                  </div>
                  <span className="report-reason-badge">{report.reason}</span>
                </div>

                <div className="report-card-body">
                  <div className="report-field">
                    <span className="report-field-label">신고 대상</span>
                    <Link to={`/material/${report.materialId}`} className="report-material-link">
                      {report.materialTitle || report.materialId}
                    </Link>
                  </div>

                  {report.originalSource && (
                    <div className="report-field">
                      <span className="report-field-label">원본 출처</span>
                      <span>{report.originalSource}</span>
                    </div>
                  )}

                  <div className="report-field">
                    <span className="report-field-label">상세 설명</span>
                    <p className="report-description">{report.description}</p>
                  </div>

                  <div className="report-field-row">
                    <div className="report-field">
                      <span className="report-field-label">신고자</span>
                      <span>{report.reporterName}</span>
                    </div>
                    <div className="report-field">
                      <span className="report-field-label">연락처</span>
                      <span>{report.contactEmail}</span>
                    </div>
                    <div className="report-field">
                      <span className="report-field-label">권리자 여부</span>
                      <span>{report.isRightsHolder ? "예" : "아니오"}</span>
                    </div>
                  </div>
                </div>

                {report.status === "pending" && (
                  <div className="report-card-actions">
                    <button
                      className="btn-admin-delete"
                      onClick={() => handleDeleteMaterial(report)}
                      disabled={actionLoading === report.id}
                    >
                      {actionLoading === report.id ? "처리 중..." : "자료 삭제"}
                    </button>
                    <button
                      className="btn-admin-ban"
                      onClick={() =>
                        setBanModal({
                          reporterId: report.reporterId || "",
                          reporterName: report.reporterName,
                        })
                      }
                      disabled={!report.reporterId}
                    >
                      판매자 탈퇴
                    </button>
                    <button
                      className="btn-admin-dismiss"
                      onClick={() => handleDismiss(report.id)}
                      disabled={actionLoading === report.id}
                    >
                      기각
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {banModal && (
        <div className="modal-overlay" onClick={() => setBanModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2>판매자 탈퇴 처리</h2>
            <p className="ban-modal-desc">
              <strong>{banModal.reporterName}</strong>의 계정을 비활성화하고 모든 자료를 비공개 처리합니다.
            </p>
            <div className="form-group">
              <label htmlFor="banReason">탈퇴 사유</label>
              <textarea
                id="banReason"
                placeholder="탈퇴 사유를 입력하세요"
                rows={3}
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
              />
            </div>
            <div className="modal-actions">
              <button className="btn-modal-cancel" onClick={() => setBanModal(null)}>
                취소
              </button>
              <button
                className="btn-admin-ban-confirm"
                onClick={handleBanUser}
                disabled={actionLoading === "ban"}
              >
                {actionLoading === "ban" ? "처리 중..." : "탈퇴 처리"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
