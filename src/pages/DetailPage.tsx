import { useState, useEffect, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { apiGet, apiGetList, apiPost, apiPatch, apiDelete } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { purchaseMaterial, hasPurchased } from "../services/pointsService";
import { addToCart, isInCart } from "../services/cartService";
import { departments, convergenceMajors, exchangeCountries } from "../data/mockData";
import type { Material } from "../types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ChevronLeft, ChevronRight, Download, ShoppingCart, GraduationCap } from "lucide-react";

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
  const { user, userProfile, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [material, setMaterial] = useState<Material | null>(null);
  const [loading, setLoading] = useState(true);
  const [owned, setOwned] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [agreedToRefundPolicy, setAgreedToRefundPolicy] = useState(false);
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
  const [authorNickname, setAuthorNickname] = useState("");
  const [inCart, setInCart] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);

  // 자료 수정/삭제
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPrice, setEditPrice] = useState(0);
  const [editSubject, setEditSubject] = useState("");
  const [editProfessor, setEditProfessor] = useState("");
  const [editDepartment, setEditDepartment] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
      isInCart(user.uid, material.id).then(setInCart);
    }
  }, [user, material]);

  // 후기 불러오기
  useEffect(() => {
    if (!id) return;
    async function fetchReviews() {
      try {
        const list = await apiGetList<Review>(`/materials/${id}/reviews`);
        setReviews(list);
        if (user) {
          const mine = list.find((r) => r.userId === user.uid);
          if (mine) setMyReview(mine);
        }
      } catch { /* ignore */ }
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
        await apiPatch(`/reviews/${myReview.id}`, {
          rating: reviewRating,
          content: reviewContent.trim(),
        });
      } else {
        try {
          await apiPost("/reviews", {
            materialId: id,
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
      const list = await apiGetList<Review>(`/materials/${id}/reviews`);
      setReviews(list);
      setMyReview(list.find((r) => r.userId === user.uid) || null);
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
      setReviews(reviews.filter((r) => r.id !== myReview.id));
      setMyReview(null);
      setReviewContent("");
    } catch { /* ignore */ }
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
      const data = await apiPost<{ downloadUrl: string }>(`/materials/${material.id}/download-url`);
      const a = document.createElement("a");
      a.href = data.downloadUrl;
      a.download = "";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      alert("다운로드에 실패했습니다. 다시 시도해주세요.");
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

  const handleStartEdit = () => {
    if (!material) return;
    setEditTitle(material.title);
    setEditDescription(material.description);
    setEditPrice(material.price);
    setEditSubject(material.subject);
    setEditProfessor(material.professor || "");
    setEditDepartment(material.department || "");
    setEditing(true);
  };

  const handleCancelEdit = () => {
    setEditing(false);
  };

  const handleSaveEdit = async () => {
    if (!material || !id) return;
    const priceInt = Math.floor(Number(editPrice));
    if (!Number.isInteger(priceInt) || priceInt < 0 || priceInt > 500000) {
      alert("가격은 0원 이상 500,000원 이하의 정수여야 합니다.");
      return;
    }
    setSaving(true);
    try {
      const updated = await apiPatch<Material>(`/materials/${id}`, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        price: priceInt,
        subject: editSubject.trim(),
        professor: editProfessor.trim(),
        department: (material.category === "수업" || material.category === "이중전공 & 융합전공 & 전과" || material.category === "동아리 & 학회" || material.category === "교환학생") ? editDepartment : "",
      });
      setMaterial(updated);
      setEditing(false);
    } catch {
      alert("자료 수정에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMaterial = async () => {
    if (!material || !id) return;
    if (!confirm("정말 이 자료를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) return;
    setDeleting(true);
    try {
      await apiDelete(`/materials/${id}`);
      navigate("/mypage");
    } catch {
      alert("자료 삭제에 실패했습니다.");
      setDeleting(false);
    }
  };

  const handleAddToCart = async () => {
    if (!user) {
      navigate("/login");
      return;
    }
    setAddingToCart(true);
    try {
      await addToCart(user.uid, {
        id: material.id,
        title: material.title,
        price: material.price,
        author: material.author,
        category: material.category,
        thumbnail: material.thumbnail,
      });
      setInCart(true);
    } catch (err) {

    } finally {
      setAddingToCart(false);
    }
  };

  const handleBuyClick = () => {
    if (!user) {
      navigate("/login");
      return;
    }
    setError("");
    setAgreedToRefundPolicy(false);
    setShowModal(true);
  };

  const handleConfirmPurchase = async () => {
    setBuying(true);
    setError("");
    try {
      await purchaseMaterial(material.id);
      await refreshProfile();
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
  const previewImages = material.previewImages ?? [];

  return (
    <div className="py-10 pb-20 md:py-6 md:pb-14">
      <div className="max-w-[1200px] mx-auto px-6 grid grid-cols-[1fr_340px] gap-9 items-start md:max-lg:grid-cols-[1fr_340px] max-md:grid-cols-1 max-md:px-4 max-md:gap-6">
        {/* Main content */}
        <div className="flex flex-col gap-6">
          {/* Preview section */}
          <Card className="overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border">
              <h3 className="text-[15px] font-semibold m-0">미리보기</h3>
            </div>
            {previewImages?.length > 0 ? (
              <div className="relative bg-secondary flex flex-col items-center p-5">
                <img
                  src={previewImages[previewIndex]}
                  alt={`미리보기 ${previewIndex + 1}`}
                  className="w-full max-h-[600px] object-contain rounded-sm shadow-md bg-white"
                  onError={(e) => {
                    const target = e.currentTarget;
                    target.style.display = "none";
                    const fallback = document.createElement("div");
                    fallback.className = "w-full h-[280px] flex items-center justify-center bg-muted rounded-sm text-muted-foreground text-sm";
                    fallback.textContent = "이미지를 불러올 수 없습니다";
                    target.parentElement?.insertBefore(fallback, target);
                  }}
                />
                {previewImages.length > 1 && (
                  <div className="flex items-center justify-center gap-4 mt-3">
                    <button
                      className="w-8 h-8 flex items-center justify-center border border-border rounded-full bg-card text-lg text-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed"
                      onClick={() => setPreviewIndex((i) => Math.max(0, i - 1))}
                      disabled={previewIndex === 0}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-sm font-semibold text-muted-foreground">
                      {previewIndex + 1} / {previewImages.length}
                    </span>
                    <button
                      className="w-8 h-8 flex items-center justify-center border border-border rounded-full bg-card text-lg text-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed"
                      onClick={() => setPreviewIndex((i) => Math.min(previewImages.length - 1, i + 1))}
                      disabled={previewIndex === previewImages.length - 1}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ) : material.thumbnail ? (
              <div className="relative bg-secondary flex flex-col items-center p-5">
                <img
                  src={material.thumbnail}
                  alt="미리보기"
                  className="w-full max-h-[600px] object-contain rounded-sm shadow-md bg-white"
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
              </div>
            ) : (
              <div className="h-[280px] max-sm:h-[180px] bg-gradient-to-br from-[#667eea] to-[#764ba2] flex flex-col items-center justify-center gap-3">
                <span className="bg-white/90 px-4 py-2 rounded-sm font-bold text-lg">{material.fileType}</span>
                <span className="text-white text-base font-medium">{material.pages}페이지</span>
                <span className="text-white/70 text-[13px]">미리보기가 없습니다</span>
              </div>
            )}
          </Card>

          {/* Info section */}
          <div>
            {editing ? (
              <Card className="border-2 border-primary-light">
                <CardContent className="p-6">
                  <h3 className="text-lg font-bold mb-5">자료 수정</h3>
                  <div className="mb-4">
                    <label className="block text-[13px] font-semibold text-muted-foreground mb-1.5">제목</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2.5 border border-border rounded-sm text-sm font-[inherit] transition-colors focus:outline-none focus:border-primary"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-[13px] font-semibold text-muted-foreground mb-1.5">과목</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2.5 border border-border rounded-sm text-sm font-[inherit] transition-colors focus:outline-none focus:border-primary"
                      value={editSubject}
                      onChange={(e) => setEditSubject(e.target.value)}
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-[13px] font-semibold text-muted-foreground mb-1.5">교수</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2.5 border border-border rounded-sm text-sm font-[inherit] transition-colors focus:outline-none focus:border-primary"
                      value={editProfessor}
                      onChange={(e) => setEditProfessor(e.target.value)}
                    />
                  </div>
                  {(material.category === "수업" || material.category === "이중전공 & 융합전공 & 전과" || material.category === "동아리 & 학회" || material.category === "교환학생") && (
                    <div className="mb-4">
                      <label className="block text-[13px] font-semibold text-muted-foreground mb-1.5">
                        {material.category === "교환학생"
                          ? "국가"
                          : material.category === "동아리 & 학회"
                          ? "유형"
                          : material.category === "이중전공 & 융합전공 & 전과"
                          ? "학과 / 융합전공"
                          : "학과"}
                      </label>
                      <select
                        className="w-full px-3 py-2.5 border border-border rounded-sm text-sm font-[inherit] transition-colors focus:outline-none focus:border-primary"
                        value={editDepartment}
                        onChange={(e) => setEditDepartment(e.target.value)}
                      >
                        {material.category === "교환학생" ? (
                          <>
                            <option value="">국가를 선택하세요</option>
                            {Object.entries(exchangeCountries).map(([region, countries]) => (
                              <optgroup key={region} label={region}>
                                {countries.map((c) => (
                                  <option key={c} value={c}>{c}</option>
                                ))}
                              </optgroup>
                            ))}
                          </>
                        ) : material.category === "동아리 & 학회" ? (
                          <>
                            <option value="">유형을 선택하세요</option>
                            <option value="동아리">동아리</option>
                            <option value="학회">학회</option>
                          </>
                        ) : material.category === "이중전공 & 융합전공 & 전과" ? (
                          <>
                            <option value="">학과/융합전공을 선택하세요</option>
                            <optgroup label="학과">
                              {departments.map((dept) => (
                                <option key={dept} value={dept}>{dept}</option>
                              ))}
                            </optgroup>
                            <optgroup label="융합전공">
                              {convergenceMajors.map((m) => (
                                <option key={m} value={m}>{m}</option>
                              ))}
                            </optgroup>
                          </>
                        ) : (
                          <>
                            <option value="">학과를 선택하세요</option>
                            {departments.map((dept) => (
                              <option key={dept} value={dept}>{dept}</option>
                            ))}
                          </>
                        )}
                      </select>
                    </div>
                  )}
                  <div className="mb-4">
                    <label className="block text-[13px] font-semibold text-muted-foreground mb-1.5">가격 (P)</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2.5 border border-border rounded-sm text-sm font-[inherit] transition-colors focus:outline-none focus:border-primary"
                      value={editPrice}
                      onChange={(e) => setEditPrice(Number(e.target.value))}
                      min={0}
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-[13px] font-semibold text-muted-foreground mb-1.5">설명</label>
                    <textarea
                      className="w-full px-3 py-2.5 border border-border rounded-sm text-sm font-[inherit] resize-y transition-colors focus:outline-none focus:border-primary"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={5}
                    />
                  </div>
                  <div className="flex gap-2 justify-end mt-2">
                    <Button
                      variant="secondary"
                      onClick={handleCancelEdit}
                      disabled={saving}
                    >
                      취소
                    </Button>
                    <Button
                      variant="primary"
                      onClick={handleSaveEdit}
                      disabled={saving || !editTitle.trim() || !editSubject.trim()}
                    >
                      {saving ? "저장 중..." : "저장"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
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
              </>
            )}

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

            {/* 후기 섹션 */}
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
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#862633] to-[#A83344] text-white flex items-center justify-center text-[13px] font-bold">
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
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#862633] to-[#A83344] text-white flex items-center justify-center text-[13px] font-bold">
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
          </div>
        </div>

        {/* Sidebar */}
        <aside className="max-md:order-none">
          <Card className="sticky top-[84px] max-md:static">
            <CardContent className="p-7">
              <div className="text-[32px] font-extrabold tracking-tight mb-5 max-md:text-[28px]">
                {material.price.toLocaleString()}
                <span className="text-lg font-medium text-muted-foreground">P</span>
              </div>
              {user && (
                <p className="text-sm text-muted-foreground mb-4">
                  보유 포인트: {points.toLocaleString()}P
                </p>
              )}
              {material.authorId === user?.uid ? (
                <>
                  <p className="text-center text-[13px] text-success font-medium mb-2.5">내가 등록한 자료입니다</p>
                  <Button
                    className="w-full mb-2.5 bg-success hover:bg-success/90 text-white"
                    size="lg"
                    onClick={handleDownload}
                    disabled={downloading}
                  >
                    <Download className="w-4 h-4 mr-1" />
                    {downloading ? "준비 중..." : "다운로드"}
                  </Button>
                  <div className="flex gap-2 mt-2.5 mb-2.5">
                    <Button
                      variant="ghost"
                      className="flex-1 bg-primary/5 text-primary hover:bg-primary/10"
                      onClick={handleStartEdit}
                      disabled={editing}
                    >
                      수정
                    </Button>
                    <Button
                      variant="ghost"
                      className="flex-1 bg-destructive/5 text-destructive hover:bg-destructive/10"
                      onClick={handleDeleteMaterial}
                      disabled={deleting}
                    >
                      {deleting ? "삭제 중..." : "삭제"}
                    </Button>
                  </div>
                </>
              ) : owned ? (
                <>
                  <Button
                    className="w-full mb-2.5 bg-success hover:bg-success/90 text-white"
                    size="lg"
                    onClick={handleDownload}
                    disabled={downloading}
                  >
                    <Download className="w-4 h-4 mr-1" />
                    {downloading ? "준비 중..." : "다운로드"}
                  </Button>
                  <p className="text-center text-[13px] text-success font-medium mb-2.5">구매 완료된 자료입니다</p>
                </>
              ) : (
                <>
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full mb-2.5"
                    onClick={handleBuyClick}
                  >
                    구매하기
                  </Button>
                  <Button
                    variant="secondary"
                    size="lg"
                    className="w-full mb-4"
                    onClick={inCart ? () => navigate("/cart") : handleAddToCart}
                    disabled={addingToCart}
                  >
                    <ShoppingCart className="w-4 h-4 mr-1" />
                    {addingToCart ? "추가 중..." : inCart ? "장바구니 보기" : "장바구니에 담기"}
                  </Button>
                  {user && points < material.price && (
                    <div className="bg-amber-500/5 rounded-lg p-3.5 text-center mb-4">
                      <p className="text-sm text-amber-600 font-semibold mb-1.5">포인트가 부족합니다.</p>
                      <Link
                        to="/charge"
                        className="text-[13px] text-primary font-semibold hover:opacity-75 transition-opacity"
                      >
                        충전하러 가기
                      </Link>
                    </div>
                  )}
                </>
              )}
              <Separator className="my-4" />
              <div className="space-y-1">
                <p className="text-[13px] text-muted-foreground">{owned ? "파일을 다운로드할 수 있습니다" : "구매 후 즉시 다운로드 가능"}</p>
                <p className="text-[13px] text-muted-foreground">포인트로 결제됩니다</p>
              </div>
              {owned && material.authorId !== user?.uid && (
                <Link
                  to={`/report?type=defect&materialId=${material.id}&title=${encodeURIComponent(material.title)}`}
                  className="block text-center py-2 mt-3 text-[13px] text-amber-700 font-medium transition-colors hover:text-amber-900"
                >
                  자료 하자 신고
                </Link>
              )}
              <Link
                to={`/report?materialId=${material.id}&title=${encodeURIComponent(material.title)}`}
                className="block text-center py-2 mt-1 text-[13px] text-muted-foreground transition-colors hover:text-destructive"
              >
                저작권 침해 신고
              </Link>
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* 구매 확인 모달 */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/45 backdrop-blur-sm flex items-center justify-center z-[200] p-6"
          onClick={() => setShowModal(false)}
        >
          <Card className="max-w-[420px] w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-8">
              <h2 className="text-xl font-bold mb-5 tracking-tight">구매 확인</h2>
              <div>
                <p className="font-semibold mb-4 text-[15px]">{material.title}</p>
                <div className="flex justify-between py-2 text-sm text-muted-foreground">
                  <span>가격</span>
                  <span>{material.price.toLocaleString()}P</span>
                </div>
                <div className="flex justify-between py-2 text-sm text-muted-foreground">
                  <span>보유 포인트</span>
                  <span>{points.toLocaleString()}P</span>
                </div>
                <div className="flex justify-between py-3 text-sm font-semibold text-foreground border-t border-border mt-1">
                  <span>구매 후 잔액</span>
                  <span className={cn(points < material.price && "text-destructive")}>
                    {(points - material.price).toLocaleString()}P
                  </span>
                </div>
              </div>

              {error === "insufficient" ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center my-4">
                  <p className="text-destructive text-sm mb-3">포인트가 부족합니다.</p>
                  <Link
                    to="/charge"
                    className="inline-block px-5 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-dark transition-colors"
                  >
                    포인트 충전하기
                  </Link>
                </div>
              ) : error ? (
                <p className="text-destructive text-sm my-3">{error}</p>
              ) : null}

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-4 text-[13px] leading-relaxed text-amber-900">
                <p className="font-semibold mb-1.5">환불 정책 안내</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>구매 후 <span className="font-semibold">24시간 이내에 다운로드하지 않으면 자동으로 환불</span>됩니다.</li>
                  <li>한 번이라도 <span className="font-semibold">다운로드한 이후에는 환불이 불가능</span>합니다.</li>
                </ul>
                <label className="flex items-start gap-2 mt-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="mt-0.5 w-4 h-4 accent-amber-600 cursor-pointer"
                    checked={agreedToRefundPolicy}
                    onChange={(e) => setAgreedToRefundPolicy(e.target.checked)}
                  />
                  <span className="text-[13px] font-medium text-amber-900">
                    위 환불 정책을 이해하며 동의했습니다.
                  </span>
                </label>
              </div>

              <div className="flex gap-2.5 mt-5">
                <Button
                  variant="secondary"
                  size="lg"
                  className="flex-1"
                  onClick={() => setShowModal(false)}
                >
                  취소
                </Button>
                <Button
                  variant="primary"
                  size="lg"
                  className="flex-1"
                  onClick={handleConfirmPurchase}
                  disabled={buying || points < material.price || !agreedToRefundPolicy}
                >
                  {buying ? "처리 중..." : "구매하기"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
