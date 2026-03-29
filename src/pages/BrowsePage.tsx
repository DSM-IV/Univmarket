import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import MaterialCard from "../components/MaterialCard";
import { materials, categories } from "../data/mockData";
import type { Category } from "../types";
import "./BrowsePage.css";

export default function BrowsePage() {
  const [searchParams] = useSearchParams();
  const initialCategory = searchParams.get("category") as Category | null;
  const initialQuery = searchParams.get("q") || "";
  const initialSort = searchParams.get("sort") || "popular";

  const [selectedCategory, setSelectedCategory] = useState<Category | "전체">(
    initialCategory || "전체"
  );
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [sortBy, setSortBy] = useState(initialSort);

  const filtered = useMemo(() => {
    let result = [...materials];

    if (selectedCategory !== "전체") {
      result = result.filter((m) => m.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.subject.toLowerCase().includes(q) ||
          m.university.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q)
      );
    }

    if (sortBy === "popular") {
      result.sort((a, b) => b.salesCount - a.salesCount);
    } else if (sortBy === "recent") {
      result.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } else if (sortBy === "price-low") {
      result.sort((a, b) => a.price - b.price);
    } else if (sortBy === "price-high") {
      result.sort((a, b) => b.price - a.price);
    } else if (sortBy === "rating") {
      result.sort((a, b) => b.rating - a.rating);
    }

    return result;
  }, [selectedCategory, searchQuery, sortBy]);

  return (
    <div className="browse">
      <div className="browse-inner">
        <h1 className="browse-title">자료 둘러보기</h1>

        {/* Filters */}
        <div className="browse-filters">
          <div className="filter-search">
            <input
              type="text"
              placeholder="검색어 입력..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="filter-categories">
            <button
              className={`filter-chip ${selectedCategory === "전체" ? "active" : ""}`}
              onClick={() => setSelectedCategory("전체")}
            >
              전체
            </button>
            {categories.map((cat) => (
              <button
                key={cat.name}
                className={`filter-chip ${selectedCategory === cat.name ? "active" : ""}`}
                onClick={() => setSelectedCategory(cat.name)}
              >
                {cat.icon} {cat.name}
              </button>
            ))}
          </div>
          <div className="filter-sort">
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="popular">인기순</option>
              <option value="recent">최신순</option>
              <option value="rating">평점순</option>
              <option value="price-low">가격 낮은순</option>
              <option value="price-high">가격 높은순</option>
            </select>
          </div>
        </div>

        {/* Results */}
        <p className="browse-count">총 {filtered.length}개의 자료</p>
        {filtered.length > 0 ? (
          <div className="browse-grid">
            {filtered.map((m) => (
              <MaterialCard key={m.id} material={m} />
            ))}
          </div>
        ) : (
          <div className="browse-empty">
            <p>검색 결과가 없습니다.</p>
            <p>다른 키워드로 검색해 보세요.</p>
          </div>
        )}
      </div>
    </div>
  );
}
