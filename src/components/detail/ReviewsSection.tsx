import { useState, useMemo } from "react";
import { apiGetList, apiPost, apiPatch, apiDelete } from "../../api/client";
import { useAuth } from "../../contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, getRatingStats, type Review } from "./utils";

type ReviewSort = "recent" | "rating-high";

interface Props {
  materialId: string;
  owned: boolean;
  reviews: Review[];
  onReviewsChange: (list: Review[]) => void;
}

export default function ReviewsSection({ materialId, owned, reviews, onReviewsChange }: Props) {
  const { user } = useAuth();

  const [reviewRating, setReviewRating] = useState(5);
  const [reviewContent, setReviewContent] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [editingReview, setEditingReview] = useState(false);
  const [reviewSort, setReviewSort] = useState<ReviewSort>("recent");

  const myReview = useMemo(() => reviews.find((r) => r.userId === user?.uid) ?? null, [reviews, user?.uid]);

  const handleSubmitReview = async () => {
    if (!user || !materialId || !reviewContent.trim()) return;
    // 중복 등록 방지
    if (myReview && !editingReview) return;

    setSubmittingReview(true);
    try {
      if (editingReview && myReview) {
        await apiPatch(`/reviews/${myReview.id}`, {
          rating: reviewRating,
          content: reviewContent.trim(),
        });
      } else {
        try {
          await apiPost("/reviews", {
            materialId,
            rating: reviewRating,
            content: reviewContent.trim(),
          });
        } catch (e) {
          const msg = (e as Error).message || "후기 등록에 실패했습니다.";
          alert(msg);
          setSubmittingReview(false);
          return;
        }
      }
      // 새로고침
      const list = await apiGetList<Review>(`/materials/${materialId}/reviews`);
      onReviewsChange(list);
      setReviewContent("");
      setEditingReview(false);
    } catch {
      alert("후기 등록에 실패했습니다.");
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleDeleteReview = async () => {
    if (!myReview) return;
    if (!confirm("후기를 삭제하시겠습니까?")) return;
    try {
      await apiDelete(`/reviews/${myReview.id}`);
      onReviewsChange(reviews.filter((r) => r.id !== myReview.id));
      setReviewContent("");
    } catch { /* ignore */ }
  };

  const handleEditReview = () => {
    if (!myReview) return;
    setReviewRating(myReview.rating);
    setReviewContent(myReview.content);
    setEditingReview(true);
  };

  // 별점 통계
  const ratingStats = useMemo(() => getRatingStats(reviews), [reviews]);

  // 정렬된 다른 사람 후기
  const sortedOtherReviews = useMemo(() => {
    const others = reviews.filter((r) => r.userId !== user?.uid);
    if (reviewSort === "rating-high") {
      return [...others].sort((a, b) => b.rating - a.rating);
    }
    // recent: createdAt 기준 (이미 desc로 불러왔으므로 그대로)
    return others;
  }, [reviews, user?.uid, reviewSort]);

  const canReview = owned && !myReview && !editingReview;

  return (
    <Card className="mt-6">
      <CardContent className="p-6">
        <h3 className="text-lg font-bold mb-5 tracking-tight">후기 ({ratingStats.total})</h3>

        {/* 별점 분포 그래프 */}
        {ratingStats.total > 0 && (
          <div className="flex gap-8 p-5 bg-secondary rounded-lg mb-6 max-md:flex-col max-md:gap-4">
            <div className="flex flex-col items-center justify-center min-w-[100px]">
              <span className="text-[40px] font-extrabold leading-none tracking-tight">{ratingStats.avg}</span>
              <span className="text-base text-amber-400 my-1.5 tracking-widest">
                {"★".repeat(Math.round(Number(ratingStats.avg)))}
                {"☆".repeat(5 - Math.round(Number(ratingStats.avg)))}
              </span>
              <span className="text-[13px] text-muted-foreground">{ratingStats.total}개 리뷰</span>
            </div>
            <div className="flex-1 flex flex-col gap-1.5 justify-center">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = ratingStats.counts[star - 1];
                const pct = ratingStats.total > 0 ? (count / ratingStats.total) * 100 : 0;
                return (
                  <div key={star} className="flex items-center gap-2">
                    <span className="text-[13px] text-muted-foreground w-7 text-right">{star}점</span>
                    <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[13px] text-muted-foreground w-6">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 후기 작성 폼 (구매자 + 아직 후기 안 쓴 경우만) */}
        {(canReview || editingReview) && (
          <div className="mb-6 pb-6 border-b border-border">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-sm font-semibold text-muted-foreground">평점</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    className={cn(
                      "bg-transparent border-none text-2xl p-0 cursor-pointer transition-colors",
                      star <= reviewRating ? "text-amber-400" : "text-border",
                      "hover:text-amber-500"
                    )}
                    onClick={() => setReviewRating(star)}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
            <textarea
              className="w-full p-3 border border-border rounded-lg text-sm font-[inherit] resize-y mb-3 transition-colors focus:outline-none focus:border-primary"
              placeholder="후기를 작성해주세요..."
              value={reviewContent}
              onChange={(e) => setReviewContent(e.target.value)}
              maxLength={1000}
              rows={3}
            />
            <div className="flex gap-2 justify-end">
              {editingReview && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => { setEditingReview(false); setReviewContent(""); }}
                >
                  취소
                </Button>
              )}
              <Button
                variant="primary"
                size="sm"
                onClick={handleSubmitReview}
                disabled={submittingReview || !reviewContent.trim()}
              >
                {submittingReview ? "등록 중..." : editingReview ? "수정하기" : "후기 등록"}
              </Button>
            </div>
          </div>
        )}

        {/* 내 후기 (항상 최상단) */}
        {myReview && !editingReview && (
          <div className="p-4 border border-primary-light bg-primary/5 rounded-lg mb-3">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-[13px] font-bold">
                  {myReview.userName.charAt(0)}
                </div>
                <div>
                  <span className="block text-sm font-semibold">
                    {myReview.userName}
                    <span className="inline-block ml-2 px-2 py-0.5 text-[11px] font-semibold text-primary bg-primary/10 rounded-full align-middle">내 후기</span>
                  </span>
                  <span className="text-[13px] text-amber-400 tracking-wider">
                    {"★".repeat(myReview.rating)}{"☆".repeat(5 - myReview.rating)}
                    <span className="ml-2 text-xs text-muted-foreground tracking-normal">{formatDate(myReview.createdAt)}</span>
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  className="bg-transparent border-none text-[13px] text-primary cursor-pointer px-2 py-1 rounded hover:bg-primary/5"
                  onClick={handleEditReview}
                >
                  수정
                </button>
                <button
                  className="bg-transparent border-none text-[13px] text-destructive cursor-pointer px-2 py-1 rounded hover:bg-destructive/5"
                  onClick={handleDeleteReview}
                >
                  삭제
                </button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed m-0">{myReview.content}</p>
          </div>
        )}

        {/* 정렬 옵션 + 다른 사람 후기 */}
        {sortedOtherReviews.length > 0 && (
          <>
            <div className="flex gap-1.5 mb-4">
              <button
                className={cn(
                  "px-3.5 py-1.5 text-[13px] font-semibold border-none rounded-full cursor-pointer transition-colors",
                  reviewSort === "recent"
                    ? "text-white bg-primary"
                    : "text-muted-foreground bg-secondary hover:bg-border"
                )}
                onClick={() => setReviewSort("recent")}
              >
                최신순
              </button>
              <button
                className={cn(
                  "px-3.5 py-1.5 text-[13px] font-semibold border-none rounded-full cursor-pointer transition-colors",
                  reviewSort === "rating-high"
                    ? "text-white bg-primary"
                    : "text-muted-foreground bg-secondary hover:bg-border"
                )}
                onClick={() => setReviewSort("rating-high")}
              >
                평점 높은순
              </button>
            </div>
            <div className="flex flex-col gap-3">
              {sortedOtherReviews.map((review) => (
                <div key={review.id} className="p-4 border border-border rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-[13px] font-bold">
                        {review.userName.charAt(0)}
                      </div>
                      <div>
                        <span className="block text-sm font-semibold">{review.userName}</span>
                        <span className="text-[13px] text-amber-400 tracking-wider">
                          {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
                          <span className="ml-2 text-xs text-muted-foreground tracking-normal">{formatDate(review.createdAt)}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed m-0">{review.content}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {ratingStats.total === 0 && (
          <p className="text-center py-6 text-muted-foreground text-sm">아직 후기가 없습니다.</p>
        )}
      </CardContent>
    </Card>
  );
}
