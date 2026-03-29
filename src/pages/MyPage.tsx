import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import MaterialCard from "../components/MaterialCard";
import type { Material } from "../types";
import "./MyPage.css";

type Tab = "uploaded" | "purchased";

export default function MyPage() {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("uploaded");
  const [uploadedMaterials, setUploadedMaterials] = useState<Material[]>([]);
  const [purchasedMaterials, setPurchasedMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
          uploadedSnap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || "",
          })) as Material[]
        );

        // 내가 구매한 자료
        const purchasesQuery = query(
          collection(db, "purchases"),
          where("buyerId", "==", user!.uid),
          orderBy("createdAt", "desc")
        );
        const purchasesSnap = await getDocs(purchasesQuery);
        const materialIds = purchasesSnap.docs.map((d) => d.data().materialId);

        if (materialIds.length > 0) {
          const materialsData: Material[] = [];
          for (const mid of materialIds) {
            const { getDoc, doc: docRef } = await import("firebase/firestore");
            const snap = await getDoc(docRef(db, "materials", mid));
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
  }, [user, navigate]);

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
          <div className="mypage-grid">
            {currentList.map((m) => (
              <MaterialCard key={m.id} material={m} />
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
