import { useState, useEffect, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  doc, getDoc, collection, query, where, orderBy,
  getDocs, addDoc, serverTimestamp, updateDoc, deleteDoc,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { purchaseMaterial, hasPurchased } from "../services/pointsService";
import type { Material } from "../types";
import "./DetailPage.css";

interface Review {
  id: string;
  userId: string;
  userName: string;
  materialId: string;
  rating: number;
  content: string;
  createdAt: string;
}

type ReviewSort = "recent" | "rating-high";

function formatDate(dateStr: string): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export default function DetailPage() {
  const { id } = useParams();
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();

  const [material, setMaterial] = useState<Material | null>(null);
  const [loading, setLoading] = useState(true);
  const [owned, setOwned] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState("");

  // 후기
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewContent, setReviewContent] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [myReview, setMyReview] = useState<Review | null>(null);
  const [editingReview, setEditingReview] = useState(false);
  const [reviewSort, setReviewSort] = useState<ReviewSort>("recent");
  const [downloading, setDownloading] = useState(false);
  const [authorSalesCount, setAuthorSalesCount] = useState(0);

  useEffect(() => {
    async function fetchMaterial() {
      if (!id) return;
      try {
        const snap = await getDoc(doc(db, "materials", id));
        if (snap.exists()) {
          const mat = {
            id: snap.id,
            ...snap.data(),
            createdAt: snap.data().createdAt?.toDate?.()?.toISOString?.() || "",
          } as Material;
          setMaterial(mat);

          // 판매자의 총 판매 수 조회
          const authorMaterialsQuery = query(
            collection(db, "materials"),
            where("authorId", "==", snap.data().authorId)
          );
          const authorSnap = await getDocs(authorMaterialsQuery);
          const totalSales = authorSnap.docs.reduce(
            (sum, d) => sum + (d.data().salesCount || 0), 0
          );
          setAuthorSalesCount(totalSales);
        }
      } catch (err) {
        console.error("자료 불러오기 실패:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchMaterial();
  }, [id]);

  useEffect(() => {
    if (user && material) {
      hasPurchased(user.uid, material.id).then(setOwned);
    }
  }, [user, material]);

  // 후기 불러오기
  useEffect(() => {
    if (!id) return;
    async function fetchReviews() {
      const q = query(
        collection(db, "reviews"),
        where("materialId", "==", id),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.()?.toISOString?.() || "",
      })) as Review[];
      setReviews(list);

      if (user) {
        const mine = list.find((r) => r.userId === user.uid);
        if (mine) setMyReview(mine);
      }
    }
    fetchReviews();
  }, [id, user]);

  const handleSubmitReview = async () => {
    if (!user || !id || !reviewContent.trim()) return;
    // 중복 등록 방지
    if (myReview && !editingReview) return;

    setSubmittingReview(true);
    try {
      if (editingReview && myReview) {
        await updateDoc(doc(db, "reviews", myReview.id), {
          rating: reviewRating,
          content: reviewContent.trim(),
        });
      } else {
        // 서버에서 한번 더 중복 확인
        const existingQuery = query(
          collection(db, "reviews"),
          where("materialId", "==", id),
          where("userId", "==", user.uid)
        );
        const existingSnap = await getDocs(existingQuery);
        if (!existingSnap.empty) {
          alert("이미 후기를 작성하셨습니다.");
          setMyReview({
            id: existingSnap.docs[0].id,
            ...existingSnap.docs[0].data(),
            createdAt: existingSnap.docs[0].data().createdAt?.toDate?.()?.toISOString?.() || "",
          } as Review);
          setSubmittingReview(false);
          return;
        }

        await addDoc(collection(db, "reviews"), {
          userId: user.uid,
          userName: user.displayName || user.email || "익명",
          materialId: id,
          rating: reviewRating,
          content: reviewContent.trim(),
          createdAt: serverTimestamp(),
        });
      }
      // 새로고침
      const q = query(
        collection(db, "reviews"),
        where("materialId", "==", id),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.()?.toISOString?.() || "",
      })) as Review[];
      setReviews(list);
      setMyReview(list.find((r) => r.userId === user.uid) || null);
      setReviewContent("");
      setEditingReview(false);
    } catch (err) {
      console.error("후기 등록 실패:", err);
      alert("후기 등록에 실패했습니다.");
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleDeleteReview = async () => {
    if (!myReview) return;
    if (!confirm("후기를 삭제하시겠습니까?")) return;
    try {
      await deleteDoc(doc(db, "reviews", myReview.id));
      setReviews(reviews.filter((r) => r.id !== myReview.id));
      setMyReview(null);
      setReviewContent("");
    } catch (err) {
      console.error("후기 삭제 실패:", err);
    }
  };

  const handleEditReview = () => {
    if (!myReview) return;
    setReviewRating(myReview.rating);
    setReviewContent(myReview.content);
    setEditingReview(true);
  };

  const handleDownload = async () => {
    if (!material) return;
    setDownloading(true);
    try {
      const getDownloadUrl = httpsCallable<
        { materialId: string },
        { downloadUrl: string }
      >(functions, "getDownloadUrl");
      const { data } = await getDownloadUrl({ materialId: material.id });
      window.open(data.downloadUrl, "_blank");
    } catch (err) {
      alert("다운로드에 실패했습니다. 다시 시도해주세요.");
      console.error("다운로드 실패:", err);
    } finally {
      setDownloading(false);
    }
  };

  // 별점 통계
  const ratingStats = useMemo(() => {
    const counts = [0, 0, 0, 0, 0]; // 1~5점
    reviews.forEach((r) => { counts[r.rating - 1]++; });
    const total = reviews.length;
    const avg = total > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / total).toFixed(1)
      : "0.0";
    return { counts, total, avg };
  }, [reviews]);

  // 정렬된 다른 사람 후기
  const sortedOtherReviews = useMemo(() => {
    const others = reviews.filter((r) => r.userId !== user?.uid);
    if (reviewSort === "rating-high") {
      return [...others].sort((a, b) => b.rating - a.rating);
    }
    // recent: createdAt 기준 (이미 desc로 불러왔으므로 그대로)
    return others;
  }, [reviews, user?.uid, reviewSort]);

  if (loading) {
    return <div className="detail-not-found"><p>불러오는 중...</p></div>;
  }

  if (!material) {
    return (
      <div className="detail-not-found">
        <h2>자료를 찾을 수 없습니다</h2>
        <Link to="/browse">둘러보기로 돌아가기</Link>
      </div>
    );
  }

  const handleBuyClick = () => {
    if (!user) {
      navigate("/login");
      return;
    }
    setError("");
    setShowModal(true);
  };

  const handleConfirmPurchase = async () => {
    setBuying(true);
    setError("");
    try {
      await purchaseMaterial(material.id);
      setOwned(true);
      setShowModal(false);
    } catch (err) {
      const msg = (err as Error).message || "구매 중 오류가 발생했습니다.";
      if (msg.includes("포인트가 부족")) {
        setError("insufficient");
      } else {
        setError(msg);
      }
    } finally {
      setBuying(false);
    }
  };

  const points = userProfile?.points ?? 0;
  const canReview = owned && !myReview && !editingReview;

  return (
    <div className="detail">
      <div className="detail-inner">
        <div className="detail-main">
          <div className="detail-preview">
            <div className="preview-placeholder">
              <span className="preview-filetype">{material.fileType}</span>
              <span className="preview-pages">{material.pages}페이지</span>
            </div>
          </div>

          <div className="detail-info">
            <div className="detail-badges">
              <span className="badge badge-category">{material.category}</span>
              <span className="badge badge-filetype">{material.fileType}</span>
            </div>
            <h1 className="detail-title">{material.title}</h1>
            <div className="detail-meta">
              <span>{material.university}</span>
              <span>·</span>
              <span>{material.subject}</span>
              <span>·</span>
              <span className="detail-rating">
                ★ {ratingStats.avg} ({ratingStats.total}개 리뷰)
              </span>
            </div>

            <div className="detail-author">
              <div className="author-avatar">
                {material.author.charAt(0)}
              </div>
              <div>
                <span className="author-name">{material.author}</span>
                <span className="author-sales">
                  총 판매 {authorSalesCount}건
                </span>
              </div>
            </div>

            <div className="detail-description">
              <h3>자료 설명</h3>
              <p>{material.description}</p>
            </div>

            <div className="detail-specs">
              <div className="spec">
                <span className="spec-label">파일 형식</span>
                <span className="spec-value">{material.fileType}</span>
              </div>
              <div className="spec">
                <span className="spec-label">페이지 수</span>
                <span className="spec-value">{material.pages}페이지</span>
              </div>
              <div className="spec">
                <span className="spec-label">등록일</span>
                <span className="spec-value">{formatDate(material.createdAt)}</span>
              </div>
              <div className="spec">
                <span className="spec-label">판매 수</span>
                <span className="spec-value">{material.salesCount}건</span>
              </div>
            </div>

            {/* 후기 섹션 */}
            <div className="reviews-section">
              <h3 className="reviews-title">후기 ({ratingStats.total})</h3>

              {/* 별점 분포 그래프 */}
              {ratingStats.total > 0 && (
                <div className="rating-summary">
                  <div className="rating-summary-left">
                    <span className="rating-big">{ratingStats.avg}</span>
                    <span className="rating-big-stars">
                      {"★".repeat(Math.round(Number(ratingStats.avg)))}
                      {"☆".repeat(5 - Math.round(Number(ratingStats.avg)))}
                    </span>
                    <span className="rating-total">{ratingStats.total}개 리뷰</span>
                  </div>
                  <div className="rating-bars">
                    {[5, 4, 3, 2, 1].map((star) => {
                      const count = ratingStats.counts[star - 1];
                      const pct = ratingStats.total > 0 ? (count / ratingStats.total) * 100 : 0;
                      return (
                        <div key={star} className="rating-bar-row">
                          <span className="rating-bar-label">{star}점</span>
                          <div className="rating-bar-track">
                            <div className="rating-bar-fill" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="rating-bar-count">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 후기 작성 폼 (구매자 + 아직 후기 안 쓴 경우만) */}
              {(canReview || editingReview) && (
                <div className="review-form">
                  <div className="review-rating-input">
                    <span className="review-rating-label">평점</span>
                    <div className="review-stars-input">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          className={`review-star-btn ${star <= reviewRating ? "active" : ""}`}
                          onClick={() => setReviewRating(star)}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea
                    className="review-textarea"
                    placeholder="후기를 작성해주세요..."
                    value={reviewContent}
                    onChange={(e) => setReviewContent(e.target.value)}
                    maxLength={1000}
                    rows={3}
                  />
                  <div className="review-form-actions">
                    {editingReview && (
                      <button
                        className="btn-review-cancel"
                        onClick={() => { setEditingReview(false); setReviewContent(""); }}
                      >
                        취소
                      </button>
                    )}
                    <button
                      className="btn-review-submit"
                      onClick={handleSubmitReview}
                      disabled={submittingReview || !reviewContent.trim()}
                    >
                      {submittingReview ? "등록 중..." : editingReview ? "수정하기" : "후기 등록"}
                    </button>
                  </div>
                </div>
              )}

              {/* 내 후기 (항상 최상단) */}
              {myReview && !editingReview && (
                <div className="review-item review-mine">
                  <div className="review-item-header">
                    <div className="review-item-user">
                      <div className="review-avatar">{myReview.userName.charAt(0)}</div>
                      <div>
                        <span className="review-user-name">
                          {myReview.userName}
                          <span className="review-mine-badge">내 후기</span>
                        </span>
                        <span className="review-stars">
                          {"★".repeat(myReview.rating)}{"☆".repeat(5 - myReview.rating)}
                        </span>
                      </div>
                    </div>
                    <div className="review-item-actions">
                      <button className="btn-review-edit" onClick={handleEditReview}>수정</button>
                      <button className="btn-review-delete" onClick={handleDeleteReview}>삭제</button>
                    </div>
                  </div>
                  <p className="review-content">{myReview.content}</p>
                </div>
              )}

              {/* 정렬 옵션 + 다른 사람 후기 */}
              {sortedOtherReviews.length > 0 && (
                <>
                  <div className="review-sort-bar">
                    <button
                      className={`review-sort-btn ${reviewSort === "recent" ? "active" : ""}`}
                      onClick={() => setReviewSort("recent")}
                    >
                      최신순
                    </button>
                    <button
                      className={`review-sort-btn ${reviewSort === "rating-high" ? "active" : ""}`}
                      onClick={() => setReviewSort("rating-high")}
                    >
                      평점 높은순
                    </button>
                  </div>
                  <div className="review-list">
                    {sortedOtherReviews.map((review) => (
                      <div key={review.id} className="review-item">
                        <div className="review-item-header">
                          <div className="review-item-user">
                            <div className="review-avatar">{review.userName.charAt(0)}</div>
                            <div>
                              <span className="review-user-name">{review.userName}</span>
                              <span className="review-stars">
                                {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <p className="review-content">{review.content}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {ratingStats.total === 0 && (
                <p className="reviews-empty">아직 후기가 없습니다.</p>
              )}
            </div>
          </div>
        </div>

        <aside className="detail-sidebar">
          <div className="sidebar-card">
            <div className="sidebar-price">
              {material.price.toLocaleString()}
              <span className="price-unit">P</span>
            </div>
            {user && (
              <div className="sidebar-balance">
                보유 포인트: {points.toLocaleString()}P
              </div>
            )}
            {owned ? (
              <>
                <button
                  className="btn-buy btn-download-main"
                  onClick={handleDownload}
                  disabled={downloading}
                >
                  {downloading ? "준비 중..." : "다운로드"}
                </button>
                <p className="sidebar-owned-label">구매 완료된 자료입니다</p>
              </>
            ) : (
              <button className="btn-buy" onClick={handleBuyClick}>
                구매하기
              </button>
            )}
            <div className="sidebar-info">
              <p>{owned ? "파일을 다운로드할 수 있습니다" : "구매 후 즉시 다운로드 가능"}</p>
              <p>포인트로 결제됩니다</p>
            </div>
          </div>
        </aside>
      </div>

      {/* 구매 확인 모달 */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2>구매 확인</h2>
            <div className="modal-info">
              <p className="modal-title">{material.title}</p>
              <div className="modal-row">
                <span>가격</span>
                <span>{material.price.toLocaleString()}P</span>
              </div>
              <div className="modal-row">
                <span>보유 포인트</span>
                <span>{points.toLocaleString()}P</span>
              </div>
              <div className="modal-row modal-row-after">
                <span>구매 후 잔액</span>
                <span className={points < material.price ? "text-danger" : ""}>
                  {(points - material.price).toLocaleString()}P
                </span>
              </div>
            </div>

            {error === "insufficient" ? (
              <div className="modal-error">
                <p>포인트가 부족합니다.</p>
                <Link to="/charge" className="btn-to-charge">
                  포인트 충전하기
                </Link>
              </div>
            ) : error ? (
              <p className="modal-error-text">{error}</p>
            ) : null}

            <div className="modal-actions">
              <button
                className="btn-modal-cancel"
                onClick={() => setShowModal(false)}
              >
                취소
              </button>
              <button
                className="btn-modal-confirm"
                onClick={handleConfirmPurchase}
                disabled={buying || points < material.price}
              >
                {buying ? "처리 중..." : "구매하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
