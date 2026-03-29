import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import "./Navbar.css";

export default function Navbar() {
  const [searchQuery, setSearchQuery] = useState("");
  const { user, userProfile, logOut } = useAuth();
  const navigate = useNavigate();

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
          <span className="logo-icon">U</span>
          <span className="logo-text">UniVmarket</span>
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
              <Link to="/charge" className="nav-points">
                {(userProfile?.points ?? 0).toLocaleString()}P
              </Link>
              <Link to="/mypage" className="nav-user-name">{user.displayName || user.email}</Link>
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
