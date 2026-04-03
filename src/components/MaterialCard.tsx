import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Star } from "lucide-react";
import type { Material } from "../types";

interface Props {
  material: Material;
  rating?: number;
  reviewCount?: number;
}

export default function MaterialCard({ material, rating, reviewCount }: Props) {
  const displayRating = rating ?? material.rating ?? 0;
  const displayReviewCount = reviewCount ?? material.reviewCount ?? 0;

  return (
    <Link
      to={`/material/${material.id}`}
      className="group flex flex-col bg-card rounded-xl border border-border overflow-hidden transition-all hover:-translate-y-1 hover:shadow-lg hover:border-transparent"
    >
      {/* Thumbnail */}
      <div className="relative h-[148px] bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-start justify-between p-3 overflow-hidden">
        {material.thumbnail && (
          <img
            src={material.thumbnail}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        <Badge variant="secondary" className="relative z-10 bg-white/95 text-foreground text-[11px]">
          {material.category}
        </Badge>
        <Badge className="relative z-10 bg-black/35 text-white text-[11px] border-none">
          {material.fileType}
        </Badge>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-1.5 p-4 flex-1">
        <h3 className="text-[15px] font-semibold text-foreground leading-snug line-clamp-2 tracking-tight">
          {material.title}
        </h3>
        <p className="text-[13px] text-muted-foreground">
          {material.department && (
            <span className="inline-block text-[11px] font-semibold text-success bg-success/8 px-1.5 py-0.5 rounded mr-1.5">
              {material.department}
            </span>
          )}
          {material.subject}
          {material.professor ? ` · ${material.professor} 교수` : ""}
        </p>

        <div className="flex items-center gap-2.5 text-[13px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            {displayRating} ({displayReviewCount})
          </span>
          <span>판매 {material.salesCount || 0}건</span>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end mt-auto pt-2.5 border-t border-border/50">
          <span className="text-base font-bold text-primary tracking-tight">
            {material.price.toLocaleString()}P
          </span>
        </div>
      </div>
    </Link>
  );
}
