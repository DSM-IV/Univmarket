import { Link } from "react-router-dom";
import type { Material } from "../types";
import "./MaterialCard.css";

interface Props {
  material: Material;
  rating?: number;
  reviewCount?: number;
}

export default function MaterialCard({ material, rating, reviewCount }: Props) {
  const displayRating = rating ?? material.rating ?? 0;
  const displayReviewCount = reviewCount ?? material.reviewCount ?? 0;

  return (
    <Link to={`/material/${material.id}`} className="material-card">
      <div className="card-thumbnail">
        <span className="card-category">{material.category}</span>
        <span className="card-filetype">{material.fileType}</span>
      </div>
      <div className="card-body">
        <h3 className="card-title">{material.title}</h3>
        <p className="card-meta">
          {material.university} · {material.subject}
        </p>
        <div className="card-stats">
          <span className="card-stat">
            <span className="star">★</span> {displayRating} ({displayReviewCount})
          </span>
          <span className="card-stat">
            판매 {material.salesCount || 0}건
          </span>
        </div>
        <div className="card-footer">
          <span className="card-price">
            {material.price.toLocaleString()}P
          </span>
        </div>
      </div>
    </Link>
  );
}
