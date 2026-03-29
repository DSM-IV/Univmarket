import { useState, useEffect } from "react";
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
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    async function fetchMaterial() {
      if (!id) return;
      try {
        const snap = await getDoc(doc(db, "materials", id));
        if (snap.exists()) {
          setMaterial({
            id: snap.id,
            ...snap.data(),
            createdAt: snap.data().createdAt?.toDate?.()?.toISOString?.() || "",
          } as Material);
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
    setSubmittingReview(true);
    try {
      if (editingReview && myReview) {
        await updateDoc(doc(db, "reviews", myReview.id), {
          rating: reviewRating,
          content: reviewContent.trim(),
        });
      } else {
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
  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : "0";
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
                ★ {avgRating} ({reviews.length}개 리뷰)
              </span>
            </div>

            <div className="detail-author">
              <div className="author-avatar">
                {material.author.charAt(0)}
              </div>
              <div>
                <span className="author-name">{material.author}</span>
                <span className="author-sales">
                  판매 {material.salesCount}건
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
                <span className="spec-value">{material.createdAt}</span>
              </div>
              <div className="spec">
                <span className="spec-label">판매 수</span>
                <span className="spec-value">{material.salesCount}건</span>
              </div>
            </div>

            {/* 후기 섹션 */}
            <div className="reviews-section">
              <h3 className="reviews-title">후기 ({reviews.length})</h3>

              {/* 후기 작성 폼 */}
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

              {/* 내 후기 */}
              {myReview && !editingReview && (
                <div className="review-item review-mine">
                  <div className="review-item-header">
                    <div className="review-item-user">
                      <div className="review-avatar">{myReview.userName.charAt(0)}</div>
                      <div>
                        <span className="review-user-name">{myReview.userName}</span>
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

              {/* 다른 사람 후기 */}
              {reviews.filter((r) => r.userId !== user?.uid).length > 0 ? (
                <div className="review-list">
                  {reviews
                    .filter((r) => r.userId !== user?.uid)
                    .map((review) => (
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
              ) : !myReview ? (
                <p className="reviews-empty">아직 후기가 없습니다.</p>
              ) : null}
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
