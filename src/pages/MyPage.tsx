import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiGet, apiPost, apiPatch } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import type { Material } from "../types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Download, FileText, Upload, ShoppingBag, RotateCcw, AlertTriangle, Pencil, Check, X } from "lucide-react";

type Tab = "uploaded" | "purchased";

interface PurchaseInfo {
  id: string;
  materialId: string;
  createdAt: Date | null;
  refunded?: boolean;
  downloaded?: boolean;
}

const REFUND_DEADLINE_HOURS = 24;

export default function MyPage() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("uploaded");
  const [uploadedMaterials, setUploadedMaterials] = useState<Material[]>([]);
  const [purchasedMaterials, setPurchasedMaterials] = useState<Material[]>([]);
  const [purchases, setPurchases] = useState<PurchaseInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [refunding, setRefunding] = useState<string | null>(null);
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [savingNickname, setSavingNickname] = useState(false);
  const [nicknameError, setNicknameError] = useState("");

  const startEditNickname = () => {
    setNicknameDraft(userProfile?.nickname || "");
    setNicknameError("");
    setEditingNickname(true);
  };

  const cancelEditNickname = () => {
    setEditingNickname(false);
    setNicknameError("");
  };

  const saveNickname = async () => {
    const trimmed = nicknameDraft.trim();
    if (trimmed.length < 2 || trimmed.length > 16) {
      setNicknameError("닉네임은 2~16자여야 합니다.");
      return;
    }
    if (!/^[\p{L}\p{N}_.-]+$/u.test(trimmed)) {
      setNicknameError("한글/영문/숫자/._- 만 사용할 수 있습니다.");
      return;
    }
    if (trimmed === (userProfile?.nickname || "")) {
      setEditingNickname(false);
      return;
    }
    setSavingNickname(true);
    setNicknameError("");
    try {
      await apiPatch("/users/nickname", { nickname: trimmed });
      setEditingNickname(false);
    } catch (e) {
      setNicknameError((e as Error).message || "변경에 실패했습니다.");
    } finally {
      setSavingNickname(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/login");
      return;
    }

    async function fetchData() {
      setLoading(true);
      try {
        // 내가 올린 자료
        const uploaded = await apiGet<Material[]>("/users/me/materials");
        setUploadedMaterials(uploaded);

        // 내가 구매한 자료 (purchases response includes material data)
        const purchasesResp = await apiGet<{
          purchases: PurchaseInfo[];
          materials: Material[];
        }>("/users/me/purchases");
        const purchaseInfos: PurchaseInfo[] = purchasesResp.purchases.map((p: any) => ({
          ...p,
          createdAt: p.createdAt ? new Date(p.createdAt) : null,
        }));
        setPurchases(purchaseInfos);

        const materialIds = purchaseInfos.filter((p) => !p.refunded).map((p) => p.materialId);
        if (materialIds.length > 0) {
          const materialsData: Material[] = [...purchasesResp.materials];
          // 삭제되어 조회되지 않는 자료도 placeholder로 추가
          for (const mid of materialIds) {
            if (!materialsData.find((m) => m.id === mid)) {
              materialsData.push({
                id: mid,
                title: "삭제된 자료",
                description: "",
                price: 0,
                category: "수업",
                subject: "",
                author: "",
                authorId: "",
                thumbnail: "",
                rating: 0,
                reviewCount: 0,
                salesCount: 0,
                createdAt: "",
                pages: 0,
                fileType: "",
                _deleted: true,
              } as Material & { _deleted: boolean });
            }
          }
          setPurchasedMaterials(materialsData);
        }
      } catch (err) {

      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [user, authLoading, navigate]);

  const handleDownload = async (materialId: string) => {
    setDownloading(materialId);
    try {
      const data = await apiPost<{ downloadUrl: string }>(`/materials/${materialId}/download-url`);
      const a = document.createElement("a");
      a.href = data.downloadUrl;
      a.download = "";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      alert("다운로드에 실패했습니다. 다시 시도해주세요.");

    } finally {
      setDownloading(null);
    }
  };

  const handleRefund = async (materialId: string) => {
    const purchase = purchases.find((p) => p.materialId === materialId && !p.refunded);
    if (!purchase) return;
    if (!confirm("정말 환불하시겠습니까? 환불 후 자료를 다운로드할 수 없습니다.")) return;

    setRefunding(materialId);
    try {
      const result = await apiPost<{ success: boolean }>(`/purchases/${purchase.id}/refund`);
      if (result) {
        // 서버 확인 후 UI 업데이트
        setPurchasedMaterials((prev) => prev.filter((m) => m.id !== materialId));
        setPurchases((prev) => prev.map((p) => p.id === purchase.id ? { ...p, refunded: true } : p));
        alert("환불이 완료되었습니다.");
      }
    } catch (err: unknown) {
      alert((err as { message?: string }).message || "환불 처리에 실패했습니다.");
    } finally {
      setRefunding(null);
    }
  };

  const canRefund = (materialId: string): boolean => {
    const purchase = purchases.find((p) => p.materialId === materialId && !p.refunded);
    if (!purchase || !purchase.createdAt || purchase.downloaded) return false;
    return Date.now() - purchase.createdAt.getTime() < REFUND_DEADLINE_HOURS * 60 * 60 * 1000;
  };

  if (authLoading) return <p className="py-20 text-center text-gray-500">불러오는 중...</p>;
  if (!user) return null;

  const currentList = tab === "uploaded" ? uploadedMaterials : purchasedMaterials;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-3xl px-4">
        {/* Profile Header */}
        <Card className="mb-6">
          <CardContent className="flex flex-col items-center gap-5 p-6 max-sm:p-4 sm:flex-row sm:items-start">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#862633] text-2xl font-bold text-white">
              {(userProfile?.nickname || user.displayName || user.email || "U").charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0 text-center sm:text-left">
              {editingNickname ? (
                <div className="flex flex-col items-center gap-1.5 sm:items-start">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={nicknameDraft}
                      onChange={(e) => setNicknameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveNickname();
                        if (e.key === "Escape") cancelEditNickname();
                      }}
                      disabled={savingNickname}
                      autoFocus
                      maxLength={16}
                      placeholder="닉네임"
                      className="h-9 rounded-md border border-gray-300 bg-white px-3 text-base sm:text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#862633] w-44"
                    />
                    <button
                      type="button"
                      onClick={saveNickname}
                      disabled={savingNickname}
                      className="flex h-9 w-9 items-center justify-center rounded-md bg-[#862633] text-white hover:bg-[#A83344] transition-colors disabled:opacity-50 border-none cursor-pointer"
                      aria-label="저장"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditNickname}
                      disabled={savingNickname}
                      className="flex h-9 w-9 items-center justify-center rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-50 border-none cursor-pointer"
                      aria-label="취소"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {nicknameError && (
                    <p className="text-xs text-red-600">{nicknameError}</p>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 justify-center sm:justify-start">
                  <h1 className="text-xl font-bold text-gray-900 truncate">
                    {userProfile?.nickname || user.displayName || user.email}
                  </h1>
                  <button
                    type="button"
                    onClick={startEditNickname}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors border-none cursor-pointer"
                    aria-label="닉네임 변경"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <p className="mt-0.5 text-sm text-gray-500">
                {userProfile?.university || ""}
              </p>
            </div>
            <div className="flex gap-6 max-sm:gap-3 text-center">
              <Link to="/transactions" className="group no-underline">
                <span className="block text-lg font-bold text-blue-600 group-hover:underline">
                  {(userProfile?.points ?? 0).toLocaleString()}P
                </span>
                <span className="text-xs text-gray-500">포인트</span>
              </Link>
              <Link to="/withdraw" className="group no-underline">
                <span className="block text-lg font-bold text-emerald-600 group-hover:underline">
                  {(userProfile?.earnings ?? 0).toLocaleString()}원
                </span>
                <span className="text-xs text-gray-500">수익금</span>
              </Link>
              <div>
                <span className="block text-lg font-bold text-gray-900">
                  {uploadedMaterials.length}
                </span>
                <span className="text-xs text-gray-500">등록 자료</span>
              </div>
              <div>
                <span className="block text-lg font-bold text-gray-900">
                  {purchasedMaterials.length}
                </span>
                <span className="text-xs text-gray-500">구매 자료</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <div className="mb-4 flex border-b border-gray-200">
          <button
            className={cn(
              "flex-1 py-3 text-center text-sm font-medium transition-colors",
              tab === "uploaded"
                ? "border-b-2 border-[#862633] text-[#862633]"
                : "text-gray-500 hover:text-gray-700"
            )}
            onClick={() => setTab("uploaded")}
          >
            <Upload className="mr-1.5 inline-block h-4 w-4" />
            내가 올린 자료
          </button>
          <button
            className={cn(
              "flex-1 py-3 text-center text-sm font-medium transition-colors",
              tab === "purchased"
                ? "border-b-2 border-[#862633] text-[#862633]"
                : "text-gray-500 hover:text-gray-700"
            )}
            onClick={() => setTab("purchased")}
          >
            <ShoppingBag className="mr-1.5 inline-block h-4 w-4" />
            구매한 자료
          </button>
        </div>

        {/* 무단 재배포 경고 (구매한 자료 탭) */}
        {tab === "purchased" && (
          <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-xs leading-relaxed text-amber-800">
              <strong className="font-semibold">무단 재배포 금지</strong> — 구매한 자료에는 구매자 정보가 포함된 워터마크가 삽입되어 있습니다.
              무단 복제·재배포 시 <strong className="font-semibold">저작권법에 따라 민·형사상 책임</strong>을 질 수 있으며, 유출 경로가 추적됩니다.
            </p>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <p className="py-16 text-center text-gray-500">불러오는 중...</p>
        ) : currentList.length > 0 ? (
          <div className="space-y-3">
            {currentList.map((m) => {
              const isCopyrightDeleted = (m as any).copyrightDeleted === true;
              const isDeleted = (m as any)._deleted === true;
              const isUnavailable = isCopyrightDeleted || isDeleted;

              return (
              <Card key={m.id} className={`transition-shadow hover:shadow-md ${isUnavailable ? "opacity-70" : ""}`}>
                <CardContent className="flex items-center gap-4 p-4">
                  {isUnavailable ? (
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-gray-900">
                          {isCopyrightDeleted ? m.title : "삭제된 자료"}
                        </h3>
                        <p className="mt-0.5 text-xs text-destructive font-medium">
                          {isCopyrightDeleted
                            ? "저작권 침해로 인해 삭제된 자료입니다."
                            : "삭제된 자료입니다."}
                        </p>
                      </div>
                    </div>
                  ) : (
                  <Link
                    to={`/material/${m.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3 no-underline"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                      <Badge variant="outline" className="text-xs">
                        {m.fileType}
                      </Badge>
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-gray-900">
                        {m.title}
                      </h3>
                      <p className="mt-0.5 truncate text-xs text-gray-500">
                        {m.subject}
                        {m.professor ? ` · ${m.professor} 교수` : ""} ·{" "}
                        {m.price.toLocaleString()}P
                      </p>
                    </div>
                  </Link>
                  )}
                  <div className="shrink-0 flex items-center gap-2">
                    {tab === "purchased" && !isUnavailable && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleDownload(m.id)}
                          disabled={downloading === m.id}
                        >
                          <Download className="mr-1.5 h-3.5 w-3.5" />
                          {downloading === m.id ? "준비 중..." : "다운로드"}
                        </Button>
                        {canRefund(m.id) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRefund(m.id)}
                            disabled={refunding === m.id}
                            className="text-destructive border-destructive/30 hover:bg-destructive/5"
                          >
                            <RotateCcw className="mr-1 h-3.5 w-3.5" />
                            {refunding === m.id ? "처리 중..." : "환불"}
                          </Button>
                        )}
                      </>
                    )}
                    {tab === "uploaded" && (
                      <div className="text-right">
                        {(m as any).scanStatus === "scanning" && (
                          <span className="block text-xs text-amber-600 font-medium mb-0.5">검사 중</span>
                        )}
                        {(m as any).scanStatus === "infected" && (
                          <span className="block text-xs text-destructive font-medium mb-0.5">위험 파일</span>
                        )}
                        <span className="text-xs text-gray-500">
                          판매 {m.salesCount || 0}건
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              );
            })}
          </div>
        ) : (
          <div className="py-16 text-center text-gray-400">
            <FileText className="mx-auto mb-3 h-10 w-10" />
            <p>{tab === "uploaded" ? "등록한 자료가 없습니다." : "구매한 자료가 없습니다."}</p>
          </div>
        )}
      </div>
    </div>
  );
}
