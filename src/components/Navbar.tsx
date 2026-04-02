import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import "./Navbar.css";

export default function Navbar() {
  const [searchQuery, setSearchQuery] = useState("");
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/browse?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleLogout = async () => {
    await logOut();
    navigate("/");
  };

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="logo">
          <span className="logo-icon">K</span>
          <span className="logo-text">KU market</span>
        </Link>

        <form className="search-bar" onSubmit={handleSearch}>
          <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="자료 검색 (과목명, 키워드...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </form>

        <div className="nav-links">
          <Link to="/browse" className="nav-link">둘러보기</Link>
          <Link to="/upload" className="nav-link nav-link-sell">자료 판매</Link>
          {user ? (
            <>
              <Link to="/cart" className="nav-link nav-cart" title="장바구니">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="21" r="1" />
                  <circle cx="20" cy="21" r="1" />
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                </svg>
                {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
              </Link>
              <Link to="/charge" className="nav-points">
                {(userProfile?.points ?? 0).toLocaleString()}P
              </Link>
              {userProfile?.role === "admin" && (
                <Link to="/admin" className="nav-link nav-link-admin">관리자</Link>
              )}
              <Link to="/mypage" className="nav-user-name">{userProfile?.nickname || user.displayName || user.email}</Link>
              <button onClick={handleLogout} className="nav-link nav-link-login">로그아웃</button>
            </>
          ) : (
            <Link to="/login" className="nav-link nav-link-login">로그인</Link>
          )}
        </div>
      </div>
    </nav>
  );
}
