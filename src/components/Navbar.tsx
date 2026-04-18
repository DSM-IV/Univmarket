import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { apiGet } from "../api/client";
import { jitterMs } from "../utils/pollWithJitter";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Wallet, Menu, X } from "lucide-react";
import NotificationPanel from "./NotificationPanel";

export default function Navbar() {
  const [cartCount, setCartCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, userProfile, logOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      setCartCount(0);
      return;
    }
    let cancelled = false;
    async function fetchCount() {
      try {
        const items = await apiGet<{ length: number } & unknown[]>("/cart");
        if (!cancelled) setCartCount(Array.isArray(items) ? items.length : 0);
      } catch { if (!cancelled) setCartCount(0); }
    }
    fetchCount();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      timer = setTimeout(async () => {
        if (cancelled) return;
        await fetchCount();
        if (!cancelled) schedule();
      }, jitterMs(15000));
    };
    schedule();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [user]);

  const handleLogout = async () => {
    await logOut();
    navigate("/");
  };

  const scrollTop = () => window.scrollTo({ top: 0, behavior: "smooth" });
  const closeMobile = () => { setMobileOpen(false); scrollTop(); };

  return (
    <nav className="sticky top-0 z-50 bg-white/85 backdrop-blur-xl border-b border-border">
      <div className="max-w-[1140px] mx-auto px-6 max-sm:px-4 h-[60px] flex items-center gap-5 max-sm:gap-2">
        {/* Logo */}
        <Link to="/" className="flex items-center shrink-0" onClick={() => { closeMobile(); scrollTop(); }}>
          <img src="/logo.png" alt="UniFile" className="h-9" />
        </Link>

        {/* Desktop Nav Links */}
        <div className="hidden md:flex items-center gap-1 shrink-0 ml-auto">
          <Link
            to="/browse"
            onClick={scrollTop}
            className="px-3.5 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            자료 찾기
          </Link>
          <Link
            to="/upload"
            onClick={scrollTop}
            className="px-3.5 py-1.5 rounded-lg text-sm font-semibold text-primary hover:bg-primary/5 transition-colors"
          >
            자료 판매
          </Link>

          {user ? (
            <>
              <Link
                to="/cart"
                onClick={scrollTop}
                className="relative p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex"
                title="장바구니"
              >
                <ShoppingCart className="w-[18px] h-[18px]" />
                {cartCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 text-[10px] font-bold leading-4 text-center text-white bg-primary rounded-full">
                    {cartCount}
                  </span>
                )}
              </Link>
              <NotificationPanel />
              <Link
                to="/charge"
                onClick={scrollTop}
                className="px-3.5 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                {(userProfile?.points ?? 0).toLocaleString()}P
              </Link>
              <Link
                to="/withdraw"
                onClick={scrollTop}
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors inline-flex items-center gap-1"
                title="출금"
              >
                <Wallet className="w-4 h-4" />
                <span className="hidden lg:inline">출금</span>
              </Link>
              {userProfile?.role === "admin" && (
                <Link
                  to="/admin"
                  onClick={scrollTop}
                  className="px-3.5 py-1.5 rounded-lg text-sm font-semibold text-destructive hover:bg-destructive/5 transition-colors"
                >
                  관리자
                </Link>
              )}
              <Link
                to="/mypage"
                onClick={scrollTop}
                className="text-sm font-semibold text-foreground px-2 py-1.5 hover:text-primary transition-colors"
              >
                마이페이지
              </Link>
              <Button
                variant="default"
                size="sm"
                onClick={handleLogout}
                className="rounded-full bg-[#862633] hover:bg-[#6B1E29] text-white"
              >
                로그아웃
              </Button>
            </>
          ) : (
            <Button variant="default" size="sm" className="rounded-full" asChild>
              <Link to="/login" onClick={scrollTop}>로그인</Link>
            </Button>
          )}
        </div>

        {/* Mobile: key actions + hamburger */}
        <div className="flex md:hidden items-center gap-1 ml-auto">
          {user && (
            <>
            <NotificationPanel onNavigate={closeMobile} />
            <Link
              to="/cart"
              className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              onClick={closeMobile}
            >
              <ShoppingCart className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 text-[10px] font-bold leading-4 text-center text-white bg-primary rounded-full">
                  {cartCount}
                </span>
              )}
            </Link>
            </>
          )}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            aria-label="메뉴"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-white/95 backdrop-blur-xl px-6 pb-4 pt-2 flex flex-col gap-1">
          <Link
            to="/browse"
            onClick={closeMobile}
            className="px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            자료 찾기
          </Link>
          <Link
            to="/upload"
            onClick={closeMobile}
            className="px-3 py-2.5 rounded-lg text-sm font-semibold text-primary hover:bg-primary/5 transition-colors"
          >
            자료 판매
          </Link>

          {user ? (
            <>
              <Link
                to="/charge"
                onClick={closeMobile}
                className="px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                포인트 {(userProfile?.points ?? 0).toLocaleString()}P
              </Link>
              <Link
                to="/withdraw"
                onClick={closeMobile}
                className="px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors inline-flex items-center gap-1"
              >
                <Wallet className="w-4 h-4" />
                출금
              </Link>
              {userProfile?.role === "admin" && (
                <Link
                  to="/admin"
                  onClick={closeMobile}
                  className="px-3 py-2.5 rounded-lg text-sm font-semibold text-destructive hover:bg-destructive/5 transition-colors"
                >
                  관리자
                </Link>
              )}
              <Link
                to="/mypage"
                onClick={closeMobile}
                className="px-3 py-2.5 rounded-lg text-sm font-semibold text-foreground hover:text-primary transition-colors"
              >
                마이페이지
              </Link>
              <div className="px-3 pt-1">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => { closeMobile(); handleLogout(); }}
                  className="rounded-full w-full bg-[#862633] hover:bg-[#6B1E29] text-white"
                >
                  로그아웃
                </Button>
              </div>
            </>
          ) : (
            <div className="px-3 pt-1">
              <Button variant="default" size="sm" className="rounded-full w-full" asChild>
                <Link to="/login" onClick={closeMobile}>로그인</Link>
              </Button>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
