/**
 * API 응답을 배열로 정규화한다.
 * - 이미 배열이면 그대로
 * - Spring Data Page 객체({content: [...], ...})면 content 추출
 * - 그 외(undefined/null/객체)이면 빈 배열
 *
 * 백엔드 응답 shape가 List<T> ↔ Page<T> 사이에서 바뀌어도
 * 프론트의 .filter/.map 렌더가 크래시하지 않게 방어한다.
 */
export function toArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object" && Array.isArray((value as { content?: unknown }).content)) {
    return (value as { content: T[] }).content;
  }
  return [];
}
