import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { apiGet } from "../api/client";
import { jitterMs } from "../utils/pollWithJitter";
import { Button } from "@/components/ui/button";
import {
  ShoppingCart,
  Wallet,
  Menu,
  X,
  ChevronDown,
  CreditCard,
  User as UserIcon,
  LogOut,
  Shield,
} from "lucide-react";
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

  const displayName = userProfile?.nickname || user?.displayName || user?.email || "유저";

  return (
    <nav className="sticky top-0 z-50 bg-white/85 backdrop-blur-xl border-b border-border">
      <div className="max-w-[1140px] mx-auto px-6 max-sm:px-4 h-[60px] flex items-center gap-5 max-sm:gap-2">
        {/* Logo */}
        <Link to="/" className="flex items-center shrink-0" onClick={() => { closeMobile(); scrollTop(); }}>
          <img src="/logo.png" alt="UniFile" className="h-9" />
        </Link>

        {/* Desktop Nav */}
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

          {/* 공지사항 hover dropdown */}
          <div className="relative group">
            <Link
              to="/notices"
              onClick={scrollTop}
              className="px-3.5 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors inline-flex items-center gap-1"
            >
              공지사항
              <ChevronDown className="w-3 h-3" />
            </Link>
            <div className="absolute left-0 top-full pt-2 hidden group-hover:block">
              <div className="min-w-[150px] rounded-lg border border-border bg-white py-1 shadow-lg">
                <Link
                  to="/notices"
                  onClick={scrollTop}
                  className="block px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
                >
                  공지사항
                </Link>
                <Link
                  to="/events"
                  onClick={scrollTop}
                  className="block px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
                >
                  이벤트
                </Link>
              </div>
            </div>
          </div>

          {user ? (
            <>
              {/* Cart */}
              <Link
                to="/cart"
                onClick={scrollTop}
                className="relative p-2 ml-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex"
                title="장바구니"
              >
                <ShoppingCart className="w-[18px] h-[18px]" />
                {cartCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 text-[10px] font-bold leading-4 text-center text-white bg-primary rounded-full">
                    {cartCount}
                  </span>
                )}
              </Link>

              {/* Notifications */}
              <NotificationPanel />

              {/* User dropdown */}
              <div className="relative group ml-1">
                <Link
                  to="/mypage"
                  onClick={scrollTop}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-secondary transition-colors"
                >
                  <span className="text-sm font-semibold text-foreground max-w-[140px] truncate">
                    {displayName}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                </Link>

                <div className="absolute right-0 top-full pt-2 hidden group-hover:block">
                  <div className="w-64 rounded-xl border border-border bg-white py-1 shadow-lg">
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-border">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {displayName}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {user.email}
                      </p>
                    </div>

                    {/* Points - prominent display */}
                    <Link
                      to="/charge"
                      onClick={scrollTop}
                      className="block px-4 py-3 hover:bg-secondary transition-colors"
                    >
                      <p className="text-[11px] text-muted-foreground">내 포인트</p>
                      <p className="text-lg font-bold text-primary leading-tight mt-0.5">
                        {(userProfile?.points ?? 0).toLocaleString()}P
                      </p>
                    </Link>

                    <div className="h-px bg-border" />

                    {/* Main actions */}
                    <Link
                      to="/mypage"
                      onClick={scrollTop}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
                    >
                      <UserIcon className="w-4 h-4 text-muted-foreground" />
                      마이페이지
                    </Link>
                    <Link
                      to="/charge"
                      onClick={scrollTop}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
                    >
                      <CreditCard className="w-4 h-4 text-muted-foreground" />
                      포인트 충전
                    </Link>
                    <Link
                      to="/withdraw"
                      onClick={scrollTop}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
                    >
                      <Wallet className="w-4 h-4 text-muted-foreground" />
                      출금
                    </Link>

                    {/* Admin only */}
                    {userProfile?.role === "admin" && (
                      <>
                        <div className="h-px bg-border" />
                        <Link
                          to="/admin"
                          onClick={scrollTop}
                          className="flex items-center gap-2.5 px-4 py-2 text-sm font-semibold text-destructive hover:bg-destructive/5 transition-colors"
                        >
                          <Shield className="w-4 h-4" />
                          관리자 콘솔
                        </Link>
                      </>
                    )}

                    {/* Logout */}
                    <div className="h-px bg-border" />
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-destructive hover:bg-destructive/5 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      로그아웃
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <Button variant="default" size="sm" className="rounded-full ml-2" asChild>
              <Link to="/login" onClick={scrollTop}>로그인</Link>
            </Button>
          )}
        </div>

        {/* Mobile: cart + notification + hamburger */}
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
          {/* User header (logged in) */}
          {user && (
            <div className="flex items-center gap-3 px-3 py-3 mb-1 border-b border-border">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
                <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
              </div>
              <Link
                to="/charge"
                onClick={closeMobile}
                className="shrink-0 text-right"
              >
                <p className="text-[10px] text-muted-foreground">내 포인트</p>
                <p className="text-sm font-bold text-primary leading-tight">
                  {(userProfile?.points ?? 0).toLocaleString()}P
                </p>
              </Link>
            </div>
          )}

          {/* Primary nav */}
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
          <Link
            to="/notices"
            onClick={closeMobile}
            className="px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            공지사항
          </Link>
          <Link
            to="/events"
            onClick={closeMobile}
            className="px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            이벤트
          </Link>

          {user ? (
            <>
              <div className="h-px bg-border my-1" />
              <Link
                to="/mypage"
                onClick={closeMobile}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-secondary transition-colors"
              >
                <UserIcon className="w-4 h-4 text-muted-foreground" />
                마이페이지
              </Link>
              <Link
                to="/charge"
                onClick={closeMobile}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-secondary transition-colors"
              >
                <CreditCard className="w-4 h-4 text-muted-foreground" />
                포인트 충전
              </Link>
              <Link
                to="/withdraw"
                onClick={closeMobile}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-secondary transition-colors"
              >
                <Wallet className="w-4 h-4 text-muted-foreground" />
                출금
              </Link>
              {userProfile?.role === "admin" && (
                <Link
                  to="/admin"
                  onClick={closeMobile}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold text-destructive hover:bg-destructive/5 transition-colors"
                >
                  <Shield className="w-4 h-4" />
                  관리자 콘솔
                </Link>
              )}
              <div className="px-3 pt-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => { closeMobile(); handleLogout(); }}
                  className="rounded-full w-full bg-[#862633] hover:bg-[#6B1E29] text-white"
                >
                  <LogOut className="w-4 h-4 mr-1.5" />
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
