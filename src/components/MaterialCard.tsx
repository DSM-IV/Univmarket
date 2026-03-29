import { Link } from "react-router-dom";
import type { Material } from "../types";
import "./MaterialCard.css";

interface Props {
  material: Material;
}

export default function MaterialCard({ material }: Props) {
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
        <div className="card-footer">
          <div className="card-rating">
            <span className="star">★</span>
            <span>{material.rating}</span>
            <span className="review-count">({material.reviewCount})</span>
          </div>
          <span className="card-price">
            {material.price.toLocaleString()}원
          </span>
        </div>
      </div>
    </Link>
  );
}
