import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";

export interface ReviewStats {
  [materialId: string]: { avgRating: number; reviewCount: number };
}

export async function fetchReviewStats(materialIds: string[]): Promise<ReviewStats> {
  if (materialIds.length === 0) return {};

  const stats: ReviewStats = {};
  materialIds.forEach((id) => { stats[id] = { avgRating: 0, reviewCount: 0 }; });

  // Firestore 'in' 쿼리는 최대 30개까지 지원
  const chunks: string[][] = [];
  for (let i = 0; i < materialIds.length; i += 30) {
    chunks.push(materialIds.slice(i, i + 30));
  }

  for (const chunk of chunks) {
    const q = query(collection(db, "reviews"), where("materialId", "in", chunk));
    const snap = await getDocs(q);
    const grouped: { [id: string]: number[] } = {};

    snap.docs.forEach((doc) => {
      const data = doc.data();
      if (!grouped[data.materialId]) grouped[data.materialId] = [];
      grouped[data.materialId].push(data.rating);
    });

    Object.entries(grouped).forEach(([id, ratings]) => {
      const avg = ratings.reduce((s, r) => s + r, 0) / ratings.length;
      stats[id] = { avgRating: Math.round(avg * 10) / 10, reviewCount: ratings.length };
    });
  }

  return stats;
}
