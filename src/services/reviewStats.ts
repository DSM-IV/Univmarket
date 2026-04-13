import { apiGet } from "../api/client";

export interface ReviewStats {
  [materialId: string]: { avgRating: number; reviewCount: number };
}

export async function fetchReviewStats(materialIds: string[]): Promise<ReviewStats> {
  if (materialIds.length === 0) return {};
  const ids = materialIds.join(",");
  return apiGet<ReviewStats>(`/reviews/stats?materialIds=${ids}`);
}
