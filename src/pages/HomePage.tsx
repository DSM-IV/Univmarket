import { Link } from "react-router-dom";
import MaterialCard from "../components/MaterialCard";
import { materials, categories } from "../data/mockData";
import "./HomePage.css";

export default function HomePage() {
  const popularMaterials = [...materials]
    .sort((a, b) => b.salesCount - a.salesCount)
    .slice(0, 4);

  const recentMaterials = [...materials]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 4);

  return (
    <div className="home">
      {/* Hero */}
      <section className="hero">
        <div className="hero-inner">
          <h1 className="hero-title">
            대학 공부자료,<br />
            <span className="highlight">사고 팔고</span> 쉽게.
          </h1>
          <p className="hero-subtitle">
            전국 대학생들이 만든 양질의 공부자료를 만나보세요.<br />
            내 자료를 올려 수익도 창출할 수 있어요.
          </p>
          <div className="hero-actions">
            <Link to="/browse" className="btn btn-primary btn-lg">자료 둘러보기</Link>
            <Link to="/upload" className="btn btn-outline btn-lg">자료 판매하기</Link>
          </div>
          <div className="hero-stats">
            <div className="stat">
              <span className="stat-value">12,400+</span>
              <span className="stat-label">등록된 자료</span>
            </div>
            <div className="stat">
              <span className="stat-value">8,200+</span>
              <span className="stat-label">판매자</span>
            </div>
            <div className="stat">
              <span className="stat-value">150+</span>
              <span className="stat-label">대학교</span>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="section">
        <div className="section-inner">
          <h2 className="section-title">카테고리</h2>
          <div className="category-grid">
            {categories.map((cat) => (
              <Link
                to={`/browse?category=${encodeURIComponent(cat.name)}`}
                key={cat.name}
                className="category-card"
              >
                <span className="category-icon">{cat.icon}</span>
                <span className="category-name">{cat.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Popular */}
      <section className="section">
        <div className="section-inner">
          <div className="section-header">
            <h2 className="section-title">인기 자료</h2>
            <Link to="/browse?sort=popular" className="section-link">전체보기 &rarr;</Link>
          </div>
          <div className="material-grid">
            {popularMaterials.map((m) => (
              <MaterialCard key={m.id} material={m} />
            ))}
          </div>
        </div>
      </section>

      {/* Recent */}
      <section className="section">
        <div className="section-inner">
          <div className="section-header">
            <h2 className="section-title">최신 자료</h2>
            <Link to="/browse?sort=recent" className="section-link">전체보기 &rarr;</Link>
          </div>
          <div className="material-grid">
            {recentMaterials.map((m) => (
              <MaterialCard key={m.id} material={m} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <div className="cta-inner">
          <h2>내 공부자료로 수익을 만들어 보세요</h2>
          <p>노트, 족보, 레포트 등 어떤 자료든 판매할 수 있어요</p>
          <Link to="/upload" className="btn btn-primary btn-lg">지금 시작하기</Link>
        </div>
      </section>
    </div>
  );
}
