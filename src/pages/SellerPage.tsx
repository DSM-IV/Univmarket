import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { apiGet } from "../api/client";
import MaterialCard from "../components/MaterialCard";
import { fetchReviewStats, type ReviewStats } from "../services/reviewStats";
import type { Material } from "../types";
import { ChevronLeft } from "lucide-react";

export default function SellerPage() {
  const { authorId } = useParams();
  const [nickname, setNickname] = useState("");
  const [materials, setMaterials] = useState<Material[]>([]);
  const [reviewStats, setReviewStats] = useState<ReviewStats>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!authorId) return;
      try {
        const sellerData = await apiGet<{ nickname: string; materials: Material[] }>(`/users/${authorId}/profile`);
        setNickname(sellerData.nickname || "익명");

        const docs = (sellerData.materials || []).filter(
          (m: any) => !m.hidden && m.scanStatus !== "infected" && m.scanStatus !== "scanning"
        );
        setMaterials(docs);

        const stats = await fetchReviewStats(docs.map((d) => d.id));
        setReviewStats(stats);
      } finally {
        setLoading(false);
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorId]);

  const totalSales = materials.reduce((sum, m) => sum + (m.salesCount || 0), 0);

  return (
    <div className="pt-10 pb-20 min-h-[60vh] max-sm:pt-6 max-sm:pb-14">
      <div className="max-w-[1140px] mx-auto px-6 max-sm:px-4">
        <Link
          to="/browse"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ChevronLeft className="w-4 h-4" />
          자료 찾기로 돌아가기
        </Link>

        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 rounded-full bg-primary text-white flex items-center justify-center font-bold text-2xl shrink-0">
            {(nickname || "?").charAt(0)}
          </div>
          <div className="min-w-0">
            <h1 className="text-[24px] font-extrabold tracking-[-0.03em] truncate">
              {nickname || "익명"}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              자료 {materials.length}건 · 총 판매 {totalSales}건
            </p>
          </div>
        </div>

        <h2 className="text-lg font-bold mb-4">판매 중인 자료</h2>

        {loading ? (
          <p className="text-center text-muted-foreground py-12">불러오는 중...</p>
        ) : materials.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">판매 중인 자료가 없습니다.</p>
        ) : (
          <div className="grid grid-cols-4 gap-5 max-md:grid-cols-3 max-sm:grid-cols-2">
            {materials.map((m) => (
              <MaterialCard
                key={m.id}
                material={m}
                rating={reviewStats[m.id]?.avgRating}
                reviewCount={reviewStats[m.id]?.reviewCount}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
