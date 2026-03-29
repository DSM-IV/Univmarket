import { useParams, Link } from "react-router-dom";
import { materials } from "../data/mockData";
import "./DetailPage.css";

export default function DetailPage() {
  const { id } = useParams();
  const material = materials.find((m) => m.id === id);

  if (!material) {
    return (
      <div className="detail-not-found">
        <h2>자료를 찾을 수 없습니다</h2>
        <Link to="/browse">둘러보기로 돌아가기</Link>
      </div>
    );
  }

  return (
    <div className="detail">
      <div className="detail-inner">
        <div className="detail-main">
          {/* Preview */}
          <div className="detail-preview">
            <div className="preview-placeholder">
              <span className="preview-filetype">{material.fileType}</span>
              <span className="preview-pages">{material.pages}페이지</span>
            </div>
          </div>

          {/* Info */}
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

        {/* Sidebar */}
        <aside className="detail-sidebar">
          <div className="sidebar-card">
            <div className="sidebar-price">
              {material.price.toLocaleString()}
              <span className="price-unit">원</span>
            </div>
            <button className="btn-buy">구매하기</button>
            <button className="btn-cart">장바구니 담기</button>
            <div className="sidebar-info">
              <p>구매 후 즉시 다운로드 가능</p>
              <p>환불 규정이 적용됩니다</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
