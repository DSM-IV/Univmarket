import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, X, ZoomIn } from "lucide-react";
import type { Material } from "../../types";

export default function PreviewSection({ material }: { material: Material }) {
  const [previewIndex, setPreviewIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [brokenIndexes, setBrokenIndexes] = useState<Set<number>>(new Set());

  // 라이트박스: ESC 닫기 + ← / → 로 미리보기 이동, 열려 있는 동안 body 스크롤 잠금
  useEffect(() => {
    if (!lightboxOpen) return;
    const previews = material.previewImages ?? [];
    const total = previews.length || (material.thumbnail ? 1 : 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
      else if (e.key === "ArrowLeft" && total > 1) {
        setPreviewIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "ArrowRight" && total > 1) {
        setPreviewIndex((i) => Math.min(total - 1, i + 1));
      }
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [lightboxOpen, material.previewImages, material.thumbnail]);

  const previewImages = material.previewImages ?? [];
  const lightboxSources = previewImages.length > 0
    ? previewImages
    : (material.thumbnail ? [material.thumbnail] : []);
  const safeIndex = Math.min(previewIndex, lightboxSources.length - 1);
  const hasMany = lightboxSources.length > 1;

  return (
    <>
      {/* Preview section */}
      <Card className="overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border">
          <h3 className="text-[15px] font-semibold m-0">미리보기</h3>
        </div>
        {previewImages?.length > 0 ? (
          <div className="relative bg-secondary flex flex-col items-center p-5">
            <button
              type="button"
              className="group relative w-full cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
              onClick={() => setLightboxOpen(true)}
              aria-label="미리보기 이미지 확대"
            >
              {brokenIndexes.has(previewIndex) ? (
                <div className="w-full h-[280px] flex items-center justify-center bg-muted rounded-sm text-muted-foreground text-sm">
                  이미지를 불러올 수 없습니다
                </div>
              ) : (
                <img
                  src={previewImages[previewIndex]}
                  alt={`미리보기 ${previewIndex + 1}`}
                  className="w-full max-h-[600px] object-contain rounded-sm shadow-md bg-white"
                  onError={() => setBrokenIndexes((prev) => new Set(prev).add(previewIndex))}
                />
              )}
              <span className="pointer-events-none absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-md bg-black/55 text-white text-[11px] font-medium opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity">
                <ZoomIn className="w-3.5 h-3.5" />
                확대
              </span>
            </button>
            {previewImages.length > 1 && (
              <div className="flex items-center justify-center gap-4 mt-3">
                <button
                  className="w-8 h-8 flex items-center justify-center border border-border rounded-full bg-card text-lg text-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed"
                  onClick={() => setPreviewIndex((i) => Math.max(0, i - 1))}
                  disabled={previewIndex === 0}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-semibold text-muted-foreground">
                  {previewIndex + 1} / {previewImages.length}
                </span>
                <button
                  className="w-8 h-8 flex items-center justify-center border border-border rounded-full bg-card text-lg text-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed"
                  onClick={() => setPreviewIndex((i) => Math.min(previewImages.length - 1, i + 1))}
                  disabled={previewIndex === previewImages.length - 1}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ) : material.thumbnail ? (
          <div className="relative bg-secondary flex flex-col items-center p-5">
            <button
              type="button"
              className="group relative w-full cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
              onClick={() => setLightboxOpen(true)}
              aria-label="미리보기 이미지 확대"
            >
              {!brokenIndexes.has(0) && (
                <img
                  src={material.thumbnail}
                  alt="미리보기"
                  className="w-full max-h-[600px] object-contain rounded-sm shadow-md bg-white"
                  onError={() => setBrokenIndexes((prev) => new Set(prev).add(0))}
                />
              )}
              <span className="pointer-events-none absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-md bg-black/55 text-white text-[11px] font-medium opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity">
                <ZoomIn className="w-3.5 h-3.5" />
                확대
              </span>
            </button>
          </div>
        ) : (
          <div className="h-[280px] max-sm:h-[180px] bg-secondary flex flex-col items-center justify-center gap-3">
            <span className="px-4 py-2 rounded-sm font-bold text-lg text-muted-foreground">{material.fileType}</span>
            <span className="text-muted-foreground text-base font-medium">{material.pages}페이지</span>
            <span className="text-muted-foreground text-[13px]">미리보기가 없습니다</span>
          </div>
        )}
      </Card>

      {/* 미리보기 확대 라이트박스 */}
      {lightboxOpen && lightboxSources.length > 0 && (
        <div
          className="fixed inset-0 z-[300] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}
          role="dialog"
          aria-label="미리보기 확대"
        >
          {/* 닫기 버튼 */}
          <button
            type="button"
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            onClick={(e) => { e.stopPropagation(); setLightboxOpen(false); }}
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>

          {/* 좌측 화살표 */}
          {hasMany && safeIndex > 0 && (
            <button
              type="button"
              className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
              onClick={(e) => { e.stopPropagation(); setPreviewIndex((i) => Math.max(0, i - 1)); }}
              aria-label="이전 이미지"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {/* 이미지 */}
          <img
            src={lightboxSources[safeIndex]}
            alt={`미리보기 ${safeIndex + 1}`}
            className="max-w-[95vw] max-h-[90vh] object-contain select-none"
            onClick={(e) => e.stopPropagation()}
            draggable={false}
          />

          {/* 우측 화살표 */}
          {hasMany && safeIndex < lightboxSources.length - 1 && (
            <button
              type="button"
              className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
              onClick={(e) => { e.stopPropagation(); setPreviewIndex((i) => Math.min(lightboxSources.length - 1, i + 1)); }}
              aria-label="다음 이미지"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          {/* 페이지 인디케이터 */}
          {hasMany && (
            <div
              className="absolute bottom-5 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-white/10 text-white text-sm font-medium"
              onClick={(e) => e.stopPropagation()}
            >
              {safeIndex + 1} / {lightboxSources.length}
            </div>
          )}
        </div>
      )}
    </>
  );
}
