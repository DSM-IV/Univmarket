import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { apiGet, apiGetList, apiPost, apiDelete } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Hand, Upload, Send, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface MaterialRequest {
  id: string;
  userId: string;
  nickname: string;
  subject: string;
  professor: string;
  description: string;
  needCount: number;
  needUsers: string[];
  status: string;
  category?: string;
  createdAt: string;
}

interface Comment {
  id: string;
  userId: string;
  nickname: string;
  content: string;
  createdAt: string;
}

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [request, setRequest] = useState<MaterialRequest | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [loading, setLoading] = useState(true);
  const [needLoading, setNeedLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 요청 데이터 로드
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const data = await apiGet<MaterialRequest>(`/material-requests/${id}`);
        setRequest(data);
      } catch {
        // not found
      }
      setLoading(false);
    })();
  }, [id]);

  // 댓글 폴링
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const fetchComments = async () => {
      try {
        const data = await apiGetList<Comment>(`/material-requests/${id}/comments`);
        if (!cancelled) setComments(data);
      } catch {
        // ignore
      }
    };
    fetchComments();
    const interval = setInterval(fetchComments, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [id]);

  const handleToggleNeed = async () => {
    if (!user || !id) return;
    setNeedLoading(true);
    try {
      const data = await apiPost<{ added: boolean; deleted?: boolean }>(`/material-requests/${id}/toggle-need`);
      if (data.deleted) {
        navigate("/");
        return;
      }
      // 로컬 상태 업데이트
      setRequest((prev) => {
        if (!prev) return prev;
        const newNeedUsers = data.added
          ? [...prev.needUsers, user.uid]
          : prev.needUsers.filter((u) => u !== user.uid);
        return { ...prev, needCount: newNeedUsers.length, needUsers: newNeedUsers };
      });
    } catch {}
    setNeedLoading(false);
  };

  const handleSubmitComment = async () => {
    if (!user || !id || !commentText.trim()) return;
    setSubmitting(true);
    try {
      await apiPost(`/material-requests/${id}/comments`, {
        content: commentText.trim(),
      });
      setCommentText("");
      // 댓글 목록 새로고침
      const updated = await apiGetList<Comment>(`/material-requests/${id}/comments`);
      setComments(updated);
    } catch {
      alert("댓글 등록에 실패했습니다.");
    }
    setSubmitting(false);
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!id || !confirm("댓글을 삭제하시겠습니까?")) return;
    await apiDelete(`/material-requests/${id}/comments/${commentId}`);
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  };

  const timeAgo = (iso: string) => {
    if (!iso) return "";
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "방금";
    if (mins < 60) return `${mins}분 전`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    return `${days}일 전`;
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <p className="text-muted-foreground">로딩 중...</p>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">요청을 찾을 수 없습니다.</p>
        <Link to="/" className="text-primary text-sm font-semibold">홈으로 돌아가기</Link>
      </div>
    );
  }

  const alreadyNeed = user && request.needUsers.includes(user.uid);

  return (
    <div className="min-h-[70vh] bg-muted/30">
      <div className="mx-auto max-w-[720px] px-6 py-12 max-sm:py-8">
        {/* 뒤로가기 */}
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          돌아가기
        </Link>

        {/* 요청 상세 */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-3">
              {request.category && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-primary/10 text-primary">
                  {request.category}
                </span>
              )}
              <span className="text-xs text-muted-foreground">{request.nickname}</span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">{timeAgo(request.createdAt)}</span>
            </div>

            <h1 className="text-xl font-bold text-foreground mb-1">{request.subject}</h1>
            {request.professor && (
              <p className="text-sm text-muted-foreground mb-3">{request.professor} 교수님</p>
            )}
            {request.description && (
              <p className="text-sm text-muted-foreground leading-relaxed mb-5">{request.description}</p>
            )}

            <div className="flex items-center gap-3">
              <button
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer border-none",
                  alreadyNeed
                    ? "bg-[#862633] text-white"
                    : "bg-[#862633]/5 text-[#862633] hover:bg-[#862633]/10"
                )}
                onClick={handleToggleNeed}
                disabled={!user || needLoading}
              >
                <Hand className="w-4 h-4" />
                저도 필요해요
                <span className="ml-0.5 font-bold">{request.needCount}</span>
              </button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const params = new URLSearchParams({
                    category: request.category || "수업",
                    subject: request.subject,
                    professor: request.professor || "",
                  });
                  navigate(`/upload?${params.toString()}`);
                }}
              >
                <Upload className="w-4 h-4 mr-1" />
                이 과목 자료 업로드
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 댓글 섹션 */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-[15px] font-bold mb-4">댓글 {comments.length > 0 && `(${comments.length})`}</h2>

            {/* 댓글 입력 */}
            {user ? (
              <div className="flex gap-2 mb-6">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && handleSubmitComment()}
                  placeholder="댓글을 입력하세요..."
                  className="flex-1 h-10 px-3 rounded-lg border border-border bg-background text-sm outline-none focus:border-[#862633] transition-colors"
                  maxLength={500}
                />
                <Button
                  size="sm"
                  className="h-10 bg-[#862633] hover:bg-[#6B1E29] text-white"
                  onClick={handleSubmitComment}
                  disabled={submitting || !commentText.trim()}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="mb-6 text-center py-4 bg-muted rounded-lg">
                <Link to="/login" className="text-sm text-primary font-semibold">로그인 후 댓글을 작성할 수 있습니다</Link>
              </div>
            )}

            {/* 댓글 목록 */}
            {comments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">아직 댓글이 없어요. 첫 댓글을 남겨보세요!</p>
            ) : (
              <div className="space-y-4">
                {comments.map((c) => (
                  <div key={c.id} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
                      {c.nickname?.charAt(0) || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{c.nickname}</span>
                        <span className="text-[11px] text-muted-foreground">{timeAgo(c.createdAt)}</span>
                        {user?.uid === c.userId && (
                          <button
                            onClick={() => handleDeleteComment(c.id)}
                            className="text-muted-foreground hover:text-destructive transition-colors ml-auto bg-transparent border-none cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-foreground mt-0.5 leading-relaxed">{c.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
