import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs, orderBy, query, limit } from "firebase/firestore";
import { db } from "../firebase";
import MaterialCard from "../components/MaterialCard";
import { categories } from "../data/mockData";
import { fetchReviewStats, type ReviewStats } from "../services/reviewStats";
import type { Material } from "../types";
import "./HomePage.css";

export default function HomePage() {
  const [popularMaterials, setPopularMaterials] = useState<Material[]>([]);
  const [recentMaterials, setRecentMaterials] = useState<Material[]>([]);
  const [reviewStats, setReviewStats] = useState<ReviewStats>({});

  useEffect(() => {
    async function fetchMaterials() {
      try {
        const recentQuery = query(collection(db, "materials"), orderBy("createdAt", "desc"), limit(4));
        const popularQuery = query(collection(db, "materials"), orderBy("salesCount", "desc"), limit(4));

        const [recentSnap, popularSnap] = await Promise.all([
          getDocs(recentQuery),
          getDocs(popularQuery),
        ]);

        const recentDocs = recentSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || "",
        })) as Material[];

        const popularDocs = popularSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || "",
        })) as Material[];

        setRecentMaterials(recentDocs);
        setPopularMaterials(popularDocs);

        const allIds = [...new Set([...recentDocs, ...popularDocs].map((d) => d.id))];
        const stats = await fetchReviewStats(allIds);
        setReviewStats(stats);
      } catch (err) {
        console.error("자료 불러오기 실패:", err);
      }
    }
    fetchMaterials();
  }, []);

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
                <span className="category-examples">{cat.examples}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Popular */}
      {popularMaterials.length > 0 && (
        <section className="section">
          <div className="section-inner">
            <div className="section-header">
              <h2 className="section-title">인기 자료</h2>
              <Link to="/browse?sort=popular" className="section-link">전체보기 &rarr;</Link>
            </div>
            <div className="material-grid">
              {popularMaterials.map((m) => (
                <MaterialCard
                  key={m.id}
                  material={m}
                  rating={reviewStats[m.id]?.avgRating}
                  reviewCount={reviewStats[m.id]?.reviewCount}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Recent */}
      {recentMaterials.length > 0 && (
        <section className="section">
          <div className="section-inner">
            <div className="section-header">
              <h2 className="section-title">최신 자료</h2>
              <Link to="/browse?sort=recent" className="section-link">전체보기 &rarr;</Link>
            </div>
            <div className="material-grid">
              {recentMaterials.map((m) => (
                <MaterialCard
                  key={m.id}
                  material={m}
                  rating={reviewStats[m.id]?.avgRating}
                  reviewCount={reviewStats[m.id]?.reviewCount}
                />
              ))}
            </div>
          </div>
        </section>
      )}

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
