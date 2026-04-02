import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getCartItems, removeFromCart, type CartItem } from "../services/cartService";
import { purchaseMaterial, hasPurchased } from "../services/pointsService";
import "./CartPage.css";

export default function CartPage() {
  const { user, userProfile } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState("");
  const [successCount, setSuccessCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    getCartItems(user.uid).then((list) => {
      setItems(list);
      setSelected(new Set(list.map((i) => i.id)));
      setLoading(false);
    });
  }, [user]);

  if (!user) {
    return (
      <div className="cart-page">
        <div className="cart-empty">
          <h2>로그인이 필요합니다</h2>
          <Link to="/login" className="btn-cart-login">로그인하기</Link>
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

  if (loading) {
    return (
      <div className="cart-page">
        <div className="cart-inner">
          <h1 className="cart-title">장바구니</h1>
          <p className="cart-loading">불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="cart-page">
      <div className="cart-inner">
        <h1 className="cart-title">장바구니</h1>

        {items.length === 0 ? (
          <div className="cart-empty">
            <p>장바구니가 비어있습니다.</p>
            <Link to="/browse" className="btn-cart-browse">자료 둘러보기</Link>
          </div>
        ) : (
          <div className="cart-layout">
            <div className="cart-list">
              <div className="cart-list-header">
                <label className="cart-check-all">
                  <input
                    type="checkbox"
                    checked={selected.size === items.length}
                    onChange={handleToggleAll}
                  />
                  <span>전체 선택 ({selected.size}/{items.length})</span>
                </label>
              </div>

              {items.map((item) => (
                <div key={item.id} className={`cart-item ${selected.has(item.id) ? "selected" : ""}`}>
                  <input
                    type="checkbox"
                    checked={selected.has(item.id)}
                    onChange={() => handleToggle(item.id)}
                    className="cart-item-check"
                  />
                  <Link to={`/material/${item.materialId}`} className="cart-item-info">
                    {item.thumbnail ? (
                      <img src={item.thumbnail} alt="" className="cart-item-thumb" />
                    ) : (
                      <div className="cart-item-thumb-placeholder">
                        <span>{item.category}</span>
                      </div>
                    )}
                    <div className="cart-item-text">
                      <span className="cart-item-title">{item.title}</span>
                      <span className="cart-item-author">{item.author}</span>
                    </div>
                  </Link>
                  <span className="cart-item-price">{item.price.toLocaleString()}P</span>
                  <button className="cart-item-remove" onClick={() => handleRemove(item.id)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            <aside className="cart-summary">
              <div className="cart-summary-card">
                <h3>주문 요약</h3>
                <div className="cart-summary-row">
                  <span>선택한 자료</span>
                  <span>{selectedItems.length}건</span>
                </div>
                <div className="cart-summary-row">
                  <span>총 금액</span>
                  <span className="cart-summary-total">{totalPrice.toLocaleString()}P</span>
                </div>
                <div className="cart-summary-row">
                  <span>보유 포인트</span>
                  <span>{points.toLocaleString()}P</span>
                </div>
                <div className="cart-summary-row cart-summary-after">
                  <span>결제 후 잔액</span>
                  <span className={points < totalPrice ? "text-danger" : ""}>
                    {(points - totalPrice).toLocaleString()}P
                  </span>
                </div>

                {successCount > 0 && (
                  <p className="cart-success">{successCount}건 구매 완료!</p>
                )}
                {error && <p className="cart-error">{error}</p>}
                {error.includes("포인트") && (
                  <Link to="/charge" className="btn-cart-charge">포인트 충전하기</Link>
                )}

                {points < totalPrice && !error && selectedItems.length > 0 && (
                  <div className="cart-insufficient">
                    <p>포인트가 부족합니다.</p>
                    <Link to="/charge" className="btn-cart-charge">충전하러 가기</Link>
                  </div>
                )}

                <button
                  className="btn-cart-buy"
                  onClick={handleBuySelected}
                  disabled={buying || selectedItems.length === 0}
                >
                  {buying ? "구매 중..." : `${selectedItems.length}건 구매하기`}
                </button>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
