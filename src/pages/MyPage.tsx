import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { collection, query, where, orderBy, getDocs, doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import type { Material } from "../types";
import "./MyPage.css";

type Tab = "uploaded" | "purchased";

export default function MyPage() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("uploaded");
  const [uploadedMaterials, setUploadedMaterials] = useState<Material[]>([]);
  const [purchasedMaterials, setPurchasedMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/login");
      return;
    }

    async function fetchData() {
      setLoading(true);
      try {
        // 내가 올린 자료
        const uploadedQuery = query(
          collection(db, "materials"),
          where("authorId", "==", user!.uid),
          orderBy("createdAt", "desc")
        );
        const uploadedSnap = await getDocs(uploadedQuery);
        setUploadedMaterials(
          uploadedSnap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
            createdAt: d.data().createdAt?.toDate?.()?.toISOString?.() || "",
          })) as Material[]
        );

        // 내가 구매한 자료
        const purchasesQuery = query(
          collection(db, "purchases"),
          where("buyerId", "==", user!.uid)
        );
        const purchasesSnap = await getDocs(purchasesQuery);
        const materialIds = purchasesSnap.docs.map((d) => d.data().materialId);

        if (materialIds.length > 0) {
          const materialsData: Material[] = [];
          for (const mid of materialIds) {
            const snap = await getDoc(doc(db, "materials", mid));
            if (snap.exists()) {
              materialsData.push({
                id: snap.id,
                ...snap.data(),
                createdAt: snap.data().createdAt?.toDate?.()?.toISOString?.() || "",
              } as Material);
            }
          }
          setPurchasedMaterials(materialsData);
        }
      } catch (err) {
        console.error("데이터 불러오기 실패:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [user, authLoading, navigate]);

  const handleDownload = async (materialId: string) => {
    setDownloading(materialId);
    try {
      const getDownloadUrl = httpsCallable<
        { materialId: string },
        { downloadUrl: string }
      >(functions, "getDownloadUrl");
      const { data } = await getDownloadUrl({ materialId });
      const a = document.createElement("a");
      a.href = data.downloadUrl;
      a.download = "";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      alert("다운로드에 실패했습니다. 다시 시도해주세요.");
      console.error("다운로드 실패:", err);
    } finally {
      setDownloading(null);
    }
  };

  if (authLoading) return <p className="mypage-loading">불러오는 중...</p>;
  if (!user) return null;

  const currentList = tab === "uploaded" ? uploadedMaterials : purchasedMaterials;

  return (
    <div className="mypage">
      <div className="mypage-inner">
        <div className="mypage-header">
          <div className="mypage-avatar">
            {(user.displayName || user.email || "U").charAt(0).toUpperCase()}
          </div>
          <div className="mypage-user-info">
            <h1 className="mypage-name">{user.displayName || user.email}</h1>
            <p className="mypage-university">{userProfile?.university || ""}</p>
          </div>
          <div className="mypage-stats">
            <div className="mypage-stat">
              <span className="mypage-stat-value">{userProfile?.points?.toLocaleString() || 0}P</span>
              <span className="mypage-stat-label">보유 포인트</span>
            </div>
            <div className="mypage-stat">
              <span className="mypage-stat-value">{uploadedMaterials.length}</span>
              <span className="mypage-stat-label">등록 자료</span>
            </div>
            <div className="mypage-stat">
              <span className="mypage-stat-value">{purchasedMaterials.length}</span>
              <span className="mypage-stat-label">구매 자료</span>
            </div>
          </div>
        </div>

        <div className="mypage-tabs">
          <button
            className={`mypage-tab ${tab === "uploaded" ? "active" : ""}`}
            onClick={() => setTab("uploaded")}
          >
            내가 올린 자료
          </button>
          <button
            className={`mypage-tab ${tab === "purchased" ? "active" : ""}`}
            onClick={() => setTab("purchased")}
          >
            구매한 자료
          </button>
        </div>

        {loading ? (
          <p className="mypage-loading">불러오는 중...</p>
        ) : currentList.length > 0 ? (
          <div className="mypage-list">
            {currentList.map((m) => (
              <div key={m.id} className="mypage-item">
                <Link to={`/material/${m.id}`} className="mypage-item-info">
                  <div className="mypage-item-icon">
                    <span>{m.fileType}</span>
                  </div>
                  <div className="mypage-item-detail">
                    <h3 className="mypage-item-title">{m.title}</h3>
                    <p className="mypage-item-meta">
                      {m.subject}{m.professor ? ` · ${m.professor} 교수` : ""} · {m.price.toLocaleString()}P
                    </p>
                  </div>
                </Link>
                <div className="mypage-item-actions">
                  {tab === "purchased" && (
                    <button
                      className="btn-download"
                      onClick={() => handleDownload(m.id)}
                      disabled={downloading === m.id}
                    >
                      {downloading === m.id ? "준비 중..." : "다운로드"}
                    </button>
                  )}
                  {tab === "uploaded" && (
                    <span className="mypage-item-sales">
                      판매 {m.salesCount || 0}건
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mypage-empty">
            <p>{tab === "uploaded" ? "등록한 자료가 없습니다." : "구매한 자료가 없습니다."}</p>
          </div>
        )}
      </div>
    </div>
  );
}
