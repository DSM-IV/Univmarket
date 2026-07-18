import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { apiGet, apiGetList } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { hasPurchased } from "../services/paymentService";
import type { Material } from "../types";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GraduationCap } from "lucide-react";
import { formatDate, getRatingStats, type Review } from "../components/detail/utils";
import FileListCard from "../components/detail/FileListCard";
import PreviewSection from "../components/detail/PreviewSection";
import ReviewsSection from "../components/detail/ReviewsSection";
import PurchaseSidebar from "../components/detail/PurchaseSidebar";

export default function DetailPage() {
  const { id } = useParams();
  const { user } = useAuth();

  const [material, setMaterial] = useState<Material | null>(null);
  const [loading, setLoading] = useState(true);
  const [owned, setOwned] = useState(false);

  // 후기
  const [reviews, setReviews] = useState<Review[]>([]);
  const [authorSalesCount, setAuthorSalesCount] = useState(0);
  const [authorNickname, setAuthorNickname] = useState("");

  useEffect(() => {
    async function fetchMaterial() {
      if (!id) return;
      try {
        const mat = await apiGet<Material & { authorNickname?: string; authorTotalSales?: number }>(`/materials/${id}`);
        // Spring은 author를 객체로 보냄. 프론트 여러 곳에서 material.authorId 쓰니 평탄화.
        const authorObj = (mat.author && typeof mat.author === "object")
          ? mat.author as { firebaseUid?: string; nickname?: string; displayName?: string }
          : null;
        const flat = { ...mat, authorId: (mat as any).authorId || authorObj?.firebaseUid };
        setMaterial(flat as Material);
        setAuthorSalesCount(mat.authorTotalSales || 0);
        setAuthorNickname(mat.authorNickname || authorObj?.nickname || authorObj?.displayName || "익명");
      } catch {
        // not found
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
      try {
        const list = await apiGetList<Review>(`/materials/${id}/reviews`);
        setReviews(list);
      } catch { /* ignore */ }
    }
    fetchReviews();
  }, [id]);

  // 별점 통계 (헤더 ★ 표시용)
  const ratingStats = useMemo(() => getRatingStats(reviews), [reviews]);

  if (loading) {
    return <div className="text-center py-24 px-6"><p>불러오는 중...</p></div>;
  }

  if (!material) {
    return (
      <div className="text-center py-24 px-6">
        <h2 className="text-xl font-bold mb-3">자료를 찾을 수 없습니다</h2>
        <Link to="/browse" className="text-primary font-medium hover:underline">둘러보기로 돌아가기</Link>
      </div>
    );
  }

  if ((material as any).copyrightDeleted) {
    return (
      <div className="text-center py-24 px-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-50 mb-5">
          <svg className="w-8 h-8 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86l-8.6 14.86A1 1 0 002.56 20h18.88a1 1 0 00.87-1.28l-8.6-14.86a1 1 0 00-1.72 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold mb-2 text-foreground">저작권 침해로 인해 삭제된 자료입니다</h2>
        <p className="text-sm text-muted-foreground mb-6">해당 자료는 저작권 침해 신고 접수 후 검토를 거쳐 삭제되었습니다.</p>
        <Link to="/browse" className="text-primary font-medium hover:underline">둘러보기로 돌아가기</Link>
      </div>
    );
  }

  return (
    <div className="py-10 pb-20 md:py-6 md:pb-14">
      <div className="max-w-[1200px] mx-auto px-6 grid grid-cols-[1fr_340px] gap-9 items-start md:max-lg:grid-cols-[1fr_340px] max-md:grid-cols-1 max-md:px-4 max-md:gap-6">
        {/* Main content */}
        <div className="flex flex-col gap-6">
          <PreviewSection key={material.id} material={material} />

          {/* Info section */}
          <div>
                <div className="flex gap-2 mb-3 flex-wrap">
                  <Badge variant="primary">{material.category}</Badge>
                  {material.department && (
                    <Badge variant="success">{material.department}</Badge>
                  )}
                  <Badge variant="secondary">{material.fileType}</Badge>
                  {(material as any).gradeStatus === "verified" && (material as any).verifiedGrade && (
                    <Badge className={cn(
                      "font-extrabold gap-1",
                      (material as any).verifiedGrade === "P"
                        ? "bg-purple-500/15 text-purple-700 border-purple-400/40 hover:bg-purple-500/20"
                        : (material as any).verifiedGrade.startsWith("A")
                          ? "bg-amber-500/15 text-amber-700 border-amber-400/40 hover:bg-amber-500/20"
                          : (material as any).verifiedGrade.startsWith("B")
                            ? "bg-blue-500/15 text-blue-700 border-blue-400/40 hover:bg-blue-500/20"
                            : "bg-green-500/15 text-green-700 border-green-400/40 hover:bg-green-500/20"
                    )}>
                      <GraduationCap className="w-3 h-3" />
                      성적 인증 {(material as any).verifiedGrade}
                    </Badge>
                  )}
                  {(material as any).gradeStatus === "pending" && (material as any).gradeClaim && material.authorId === user?.uid && (
                    <Badge className="bg-secondary text-muted-foreground hover:bg-secondary">
                      성적 인증 심사 중 ({(material as any).gradeClaim})
                    </Badge>
                  )}
                </div>
                <h1 className="text-[26px] font-bold leading-[1.35] tracking-tight max-md:text-[22px]">{material.title}</h1>
                <div className="flex items-center gap-2 text-muted-foreground text-sm mt-2">
                  <span>{material.subject}</span>
                  {material.professor && (
                    <>
                      <span>·</span>
                      <span>{material.professor} 교수</span>
                    </>
                  )}
                  <span>·</span>
                  <span className="text-amber-400">
                    ★ {ratingStats.avg} ({ratingStats.total}개 리뷰)
                  </span>
                </div>

                <Link
                  to={`/seller/${material.authorId}`}
                  className="flex items-center gap-3 p-4 bg-secondary rounded-lg mt-4 mb-6 hover:bg-accent transition-colors group"
                >
                  <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-base shrink-0">
                    {(authorNickname || "?").charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <span className="block font-semibold text-sm group-hover:underline truncate">
                      {authorNickname || "익명"}
                    </span>
                    <span className="text-[13px] text-muted-foreground">
                      총 판매 {authorSalesCount}건
                    </span>
                  </div>
                </Link>

                <Card className="mb-6">
                  <CardContent className="p-6">
                    <h3 className="text-base font-semibold mb-3">자료 설명</h3>
                    <p className="text-[15px] text-muted-foreground leading-[1.7] whitespace-pre-wrap">{material.description}</p>
                  </CardContent>
                </Card>

                <FileListCard material={material} />

            {/* Specs grid */}
            <div className="grid grid-cols-2 gap-2.5 max-sm:grid-cols-1">
              <Card>
                <CardContent className="p-4">
                  <span className="block text-xs text-muted-foreground mb-1">파일 형식</span>
                  <span className="text-[15px] font-semibold">{material.fileType}</span>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <span className="block text-xs text-muted-foreground mb-1">페이지 수</span>
                  <span className="text-[15px] font-semibold">{material.pages}페이지</span>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <span className="block text-xs text-muted-foreground mb-1">등록일</span>
                  <span className="text-[15px] font-semibold">{formatDate(material.createdAt)}</span>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <span className="block text-xs text-muted-foreground mb-1">판매 수</span>
                  <span className="text-[15px] font-semibold">{material.salesCount}건</span>
                </CardContent>
              </Card>
            </div>

            <ReviewsSection
              materialId={material.id}
              owned={owned}
              reviews={reviews}
              onReviewsChange={setReviews}
            />
          </div>
        </div>

        {/* Sidebar */}
        <PurchaseSidebar material={material} owned={owned} />
      </div>
    </div>
  );
}
