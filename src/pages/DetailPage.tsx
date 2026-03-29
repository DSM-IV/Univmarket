import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { materials } from "../data/mockData";
import { useAuth } from "../contexts/AuthContext";
import { purchaseMaterial, hasPurchased } from "../services/pointsService";
import "./DetailPage.css";

export default function DetailPage() {
  const { id } = useParams();
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const material = materials.find((m) => m.id === id);

  const [owned, setOwned] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user && material) {
      hasPurchased(user.uid, material.id).then(setOwned);
    }
  }, [user, material]);

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
      await purchaseMaterial(
        material.id,
        material.title,
        material.price,
        material.authorId
      );
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
                ★ {material.rating} ({material.reviewCount}개 리뷰)
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
              <button className="btn-buy btn-owned" disabled>
                구매 완료
              </button>
            ) : (
              <button className="btn-buy" onClick={handleBuyClick}>
                구매하기
              </button>
            )}
            <div className="sidebar-info">
              <p>구매 후 즉시 다운로드 가능</p>
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
