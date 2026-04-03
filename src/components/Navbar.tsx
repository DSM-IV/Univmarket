import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Plus, Wallet } from "lucide-react";

export default function Navbar() {
  const [cartCount, setCartCount] = useState(0);
  const { user, userProfile, logOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      setCartCount(0);
      return;
    }
    const q = query(collection(db, "carts"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snap) => {
      setCartCount(snap.size);
    }, () => setCartCount(0));
    return unsubscribe;
  }, [user]);

  const handleLogout = async () => {
    await logOut();
    navigate("/");
  };

  return (
    <nav className="sticky top-0 z-50 bg-white/85 backdrop-blur-xl border-b border-border">
      <div className="max-w-[1140px] mx-auto px-6 max-sm:px-4 h-[60px] flex items-center gap-5 max-sm:gap-2">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 shrink-0">
          <span className="w-8 h-8 bg-primary text-white rounded-lg flex items-center justify-center font-extrabold text-base">
            K
          </span>
          <span className="font-bold text-[17px] text-foreground tracking-tight hidden sm:inline">
            KU market
          </span>
        </Link>

        {/* Nav Links */}
        <div className="flex items-center gap-1 shrink-0 ml-auto">
          <Link
            to="/browse"
            className="hidden md:inline-flex px-3.5 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            자료 찾기
          </Link>
          <Link
            to="/upload"
            className="px-3.5 py-1.5 rounded-lg text-sm font-semibold text-primary hover:bg-primary/5 transition-colors"
          >
            자료 판매
          </Link>

          {user ? (
            <>
              <Link
                to="/cart"
                className="relative p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors hidden md:flex"
                title="장바구니"
              >
                <ShoppingCart className="w-[18px] h-[18px]" />
                {cartCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 text-[10px] font-bold leading-4 text-center text-white bg-primary rounded-full">
                    {cartCount}
                  </span>
                )}
              </Link>
              <div className="flex items-center gap-0.5">
                <Link
                  to="/charge"
                  className="px-3 py-1 bg-primary/5 text-primary rounded-l-full text-[13px] font-bold hover:bg-primary/10 transition-colors"
                >
                  {(userProfile?.points ?? 0).toLocaleString()}P
                </Link>
                <Link
                  to="/charge"
                  className="px-2 py-1 bg-primary/5 text-primary rounded-r-full text-[13px] font-bold hover:bg-primary/10 transition-colors flex items-center gap-0.5"
                  title="포인트 충전"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">충전</span>
                </Link>
              </div>
              <Link
                to="/withdraw"
                className="hidden md:inline-flex px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors items-center gap-1"
                title="출금"
              >
                <Wallet className="w-4 h-4" />
                <span className="hidden lg:inline">출금</span>
              </Link>
              {userProfile?.role === "admin" && (
                <Link
                  to="/admin"
                  className="hidden md:inline-flex px-3.5 py-1.5 rounded-lg text-sm font-semibold text-destructive hover:bg-destructive/5 transition-colors"
                >
                  관리자
                </Link>
              )}
              <Link
                to="/mypage"
                className="hidden md:inline-flex text-sm font-semibold text-foreground px-2 py-1.5 hover:text-primary transition-colors"
              >
                마이페이지
              </Link>
              <Button
                variant="default"
                size="sm"
                onClick={handleLogout}
                className="rounded-full"
              >
                로그아웃
              </Button>
            </>
          ) : (
            <Button variant="default" size="sm" className="rounded-full" asChild>
              <Link to="/login">로그인</Link>
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}
