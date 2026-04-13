import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getCartItems, removeFromCart, type CartItem } from "../services/cartService";
import { purchaseMaterial, hasPurchased } from "../services/pointsService";
import { apiGet } from "../api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { X, ShoppingCart, CheckCircle, AlertCircle, Trash2 } from "lucide-react";

export default function CartPage() {
  const { user, userProfile } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState("");
  const [successCount, setSuccessCount] = useState(0);
  const [deletedItems, setDeletedItems] = useState<CartItem[]>([]);
  const [removingDeleted, setRemovingDeleted] = useState(false);
  const [agreedToRefundPolicy, setAgreedToRefundPolicy] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    getCartItems(user.uid).then(async (list) => {
      // 각 자료가 아직 존재하는지 확인
      const checks = await Promise.all(
        list.map(async (item) => {
          try {
            await apiGet(`/materials/${item.materialId}`);
            return { item, exists: true };
          } catch {
            return { item, exists: false };
          }
        })
      );
      const valid = checks.filter((c) => c.exists).map((c) => c.item);
      const removed = checks.filter((c) => !c.exists).map((c) => c.item);

      setItems(valid);
      setSelected(new Set(valid.map((i) => i.id)));
      setDeletedItems(removed);
      setLoading(false);
    });
  }, [user]);

  if (!user) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-muted/50 py-10 pb-20">
        <div className="mx-auto max-w-5xl px-6 text-center py-20">
          <h2 className="text-xl font-bold tracking-tight mb-4">로그인이 필요합니다</h2>
          <Button asChild>
            <Link to="/login">로그인하기</Link>
          </Button>
        </div>
      </div>
    );
  }

  const handleToggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleAll = () => {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((i) => i.id)));
    }
  };

  const handleRemove = async (id: string) => {
    await removeFromCart(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const selectedItems = items.filter((i) => selected.has(i.id));
  const totalPrice = selectedItems.reduce((sum, i) => sum + i.price, 0);
  const points = userProfile?.points ?? 0;

  const handleBuySelected = async () => {
    if (selectedItems.length === 0) return;
    setBuying(true);
    setError("");
    setSuccessCount(0);

    let purchased = 0;
    for (const item of selectedItems) {
      try {
        const alreadyOwned = await hasPurchased(user.uid, item.materialId);
        if (alreadyOwned) {
          await removeFromCart(item.id);
          purchased++;
          continue;
        }
        await purchaseMaterial(item.materialId);
        await removeFromCart(item.id);
        purchased++;
      } catch (err) {
        const msg = (err as Error).message || "";
        if (msg.includes("포인트가 부족")) {
          setError("포인트가 부족합니다. 충전 후 다시 시도해주세요.");
        } else if (msg.includes("이미 구매")) {
          await removeFromCart(item.id);
          purchased++;
          continue;
        } else {
          setError(`"${item.title}" 구매 중 오류가 발생했습니다.`);
        }
        break;
      }
    }

    setSuccessCount(purchased);
    // 목록 새로고침
    const updated = await getCartItems(user.uid);
    setItems(updated);
    setSelected(new Set(updated.map((i) => i.id)));
    setBuying(false);
  };

  const handleRemoveDeleted = async () => {
    setRemovingDeleted(true);
    await Promise.all(deletedItems.map((item) => removeFromCart(item.id)));
    setDeletedItems([]);
    setRemovingDeleted(false);
  };

  const handleDismissDeleted = () => {
    setDeletedItems([]);
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-muted/50 py-10 pb-20">
        <div className="mx-auto max-w-5xl px-6">
          <h1 className="text-2xl font-bold tracking-tight mb-7">장바구니</h1>
          <p className="text-center text-muted-foreground py-12 text-[15px]">불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-muted/50 py-10 pb-20">
      <div className="mx-auto max-w-5xl px-6">
        <h1 className="text-2xl font-bold tracking-tight mb-7">장바구니</h1>

        {deletedItems.length > 0 && (
          <div className="mb-5 rounded-lg border border-amber-200 bg-amber-500/5 p-4">
            <div className="flex items-start gap-3">
              <Trash2 className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-800 mb-2">
                  삭제된 자료가 {deletedItems.length}건 있습니다
                </p>
                <ul className="space-y-1 mb-3">
                  {deletedItems.map((item) => (
                    <li key={item.id} className="text-[13px] text-amber-700 truncate">
                      • {item.title}
                    </li>
                  ))}
                </ul>
                <p className="text-[13px] text-amber-600 mb-3">
                  판매자가 자료를 삭제하여 더 이상 구매할 수 없습니다. 장바구니에서 삭제하시겠습니까?
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    className="h-8 text-[13px]"
                    onClick={handleRemoveDeleted}
                    disabled={removingDeleted}
                  >
                    {removingDeleted ? "삭제 중..." : "장바구니에서 삭제"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-[13px]"
                    onClick={handleDismissDeleted}
                  >
                    나중에
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {items.length === 0 && deletedItems.length === 0 ? (
          <div className="text-center py-20 px-6">
            <ShoppingCart className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground text-base mb-5 leading-relaxed">장바구니가 비어있습니다.</p>
            <Button asChild>
              <Link to="/browse">자료 찾기</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-6 items-start">
            {/* Cart items list */}
            <div>
              <div className="rounded-lg bg-muted/70 px-4 py-3 mb-3">
                <label className="flex items-center gap-2.5 text-sm font-medium text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.size === items.length}
                    onChange={handleToggleAll}
                    className="h-[18px] w-[18px] accent-[#862633]"
                  />
                  <span>전체 선택 ({selected.size}/{items.length})</span>
                </label>
              </div>

              {items.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-center gap-3 p-4 bg-background border rounded-lg mb-2 transition-colors",
                    selected.has(item.id)
                      ? "border-[#862633]/30 bg-[#862633]/[0.03]"
                      : "border-border"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(item.id)}
                    onChange={() => handleToggle(item.id)}
                    className="h-[18px] w-[18px] accent-[#862633] shrink-0"
                  />
                  <Link to={`/material/${item.materialId}`} className="flex items-center gap-3 flex-1 min-w-0">
                    {item.thumbnail ? (
                      <img src={item.thumbnail} alt="" className="w-14 h-14 rounded object-cover shrink-0" />
                    ) : (
                      <div className="w-14 h-14 rounded bg-[#862633] flex items-center justify-center shrink-0">
                        <span className="text-[10px] text-white font-semibold">{item.category}</span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <span className="block text-sm font-semibold text-foreground truncate">{item.title}</span>
                      <span className="block text-[13px] text-muted-foreground mt-0.5">{item.author}</span>
                    </div>
                  </Link>
                  <span className="text-[15px] font-bold text-foreground whitespace-nowrap shrink-0">
                    {item.price.toLocaleString()}P
                  </span>
                  <button
                    className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors shrink-0"
                    onClick={() => handleRemove(item.id)}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Order summary sidebar */}
            <aside>
              <Card className="sticky top-[88px] shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">주문 요약</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between py-1 text-sm text-muted-foreground">
                    <span>선택한 자료</span>
                    <span>{selectedItems.length}건</span>
                  </div>
                  <div className="flex justify-between py-1 text-sm text-muted-foreground">
                    <span>총 금액</span>
                    <span className="font-bold text-foreground">{totalPrice.toLocaleString()}P</span>
                  </div>
                  <div className="flex justify-between py-1 text-sm text-muted-foreground">
                    <span>보유 포인트</span>
                    <span>{points.toLocaleString()}P</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between py-1 text-sm font-semibold text-foreground">
                    <span>결제 후 잔액</span>
                    <span className={cn(points < totalPrice && "text-destructive")}>
                      {(points - totalPrice).toLocaleString()}P
                    </span>
                  </div>

                  {successCount > 0 && (
                    <div className="flex items-center justify-center gap-2 bg-emerald-500/5 text-emerald-600 rounded-lg py-3 px-4 text-sm font-semibold mt-3">
                      <CheckCircle className="h-4 w-4" />
                      {successCount}건 구매 완료!
                    </div>
                  )}
                  {error && (
                    <div className="flex items-center justify-center gap-2 bg-destructive/5 text-destructive rounded-lg py-3 px-4 text-sm mt-3">
                      <AlertCircle className="h-4 w-4" />
                      {error}
                    </div>
                  )}
                  {error.includes("포인트") && (
                    <Link
                      to="/charge"
                      className="block text-center py-2 text-[13px] text-[#862633] font-semibold hover:opacity-75 transition-opacity"
                    >
                      포인트 충전하기
                    </Link>
                  )}

                  {points < totalPrice && !error && selectedItems.length > 0 && (
                    <div className="bg-amber-500/5 rounded-lg p-3.5 mt-3 text-center">
                      <p className="text-sm text-amber-600 font-semibold mb-1.5">포인트가 부족합니다.</p>
                      <Link
                        to="/charge"
                        className="text-[13px] text-[#862633] font-semibold hover:opacity-75 transition-opacity"
                      >
                        충전하러 가기
                      </Link>
                    </div>
                  )}

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

                  <Button
                    className="w-full mt-4 h-12 text-base font-bold"
                    onClick={handleBuySelected}
                    disabled={buying || selectedItems.length === 0 || !agreedToRefundPolicy}
                  >
                    {buying ? "구매 중..." : `${selectedItems.length}건 구매하기`}
                  </Button>
                </CardContent>
              </Card>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
