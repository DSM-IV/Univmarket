import { useState, useRef, type Dispatch, type SetStateAction } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { X, Image } from "lucide-react";
import type { PreviewImage } from "./utils";

const MAX_PREVIEWS = 5;

interface Props {
  images: PreviewImage[];
  setImages: Dispatch<SetStateAction<PreviewImage[]>>;
  onError: Dispatch<SetStateAction<string>>;
}

export default function PreviewImageSection({ images, setImages, onError }: Props) {
  const previewInputRef = useRef<HTMLInputElement>(null);
  const [draggedPreviewIdx, setDraggedPreviewIdx] = useState<number | null>(null);
  const [dragOverPreviewIdx, setDragOverPreviewIdx] = useState<number | null>(null);

  const handlePreviewImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const remaining = MAX_PREVIEWS - images.length;
    if (remaining <= 0) {
      onError(`미리보기 이미지는 최대 ${MAX_PREVIEWS}장까지 첨부 가능합니다.`);
      return;
    }

    const newImages: PreviewImage[] = [];
    for (let i = 0; i < Math.min(files.length, remaining); i++) {
      const f = files[i];
      if (!f.type.startsWith("image/")) continue;
      if (f.size > 5 * 1024 * 1024) continue;
      newImages.push({ file: f, url: URL.createObjectURL(f) });
    }

    if (newImages.length === 0) {
      onError("이미지 파일만 업로드 가능합니다. (최대 5MB)");
      return;
    }

    setImages((prev) => [...prev, ...newImages]);
    onError("");
    if (previewInputRef.current) previewInputRef.current.value = "";
  };

  const removePreviewImage = (index: number) => {
    setImages((prev) => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
  };

  // 미리보기 이미지 드래그 정렬 — 첫 번째가 자동으로 대표 이미지
  const handlePreviewDragStart = (idx: number) => (e: React.DragEvent) => {
    setDraggedPreviewIdx(idx);
    e.dataTransfer.effectAllowed = "move";
  };

  const handlePreviewDragOver = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverPreviewIdx !== idx) setDragOverPreviewIdx(idx);
  };

  const handlePreviewDrop = (targetIdx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverPreviewIdx(null);
    const sourceIdx = draggedPreviewIdx;
    setDraggedPreviewIdx(null);
    if (sourceIdx === null || sourceIdx === targetIdx) return;
    setImages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(sourceIdx, 1);
      next.splice(targetIdx, 0, moved);
      return next;
    });
  };

  const handlePreviewDragEnd = () => {
    setDraggedPreviewIdx(null);
    setDragOverPreviewIdx(null);
  };

  return (
    <div>
      <label className="block text-[13px] font-semibold mb-2 text-foreground">
        미리보기 이미지 * ({images.length}/{MAX_PREVIEWS})
      </label>
      <p className="text-[13px] text-muted-foreground mb-2.5 leading-relaxed">
        자료의 내용을 확인할 수 있는 이미지를 첨부해주세요. 드래그해서 순서를 바꿀 수 있고, 가장 앞에 있는 이미지가 대표 이미지가 됩니다.
      </p>

      {images.length > 0 && (
        <div className="flex gap-2.5 flex-wrap mb-3">
          {images.map((img, idx) => (
            <div
              key={idx}
              draggable
              onDragStart={handlePreviewDragStart(idx)}
              onDragOver={handlePreviewDragOver(idx)}
              onDrop={handlePreviewDrop(idx)}
              onDragEnd={handlePreviewDragEnd}
              className={cn(
                "relative w-[120px] h-[150px] rounded-md overflow-hidden shadow-sm cursor-move transition-all",
                draggedPreviewIdx === idx && "opacity-40",
                dragOverPreviewIdx === idx && draggedPreviewIdx !== idx && "ring-2 ring-[#862633] ring-offset-1"
              )}
            >
              <img src={img.url} alt={`미리보기 ${idx + 1}`} className="w-full h-full object-cover pointer-events-none" />
              {idx === 0 && (
                <Badge className="absolute top-1.5 left-1.5 text-[10px] font-bold bg-[#862633] text-white hover:bg-[#862633]">
                  대표
                </Badge>
              )}
              <button
                type="button"
                className="absolute top-1.5 right-1.5 w-[22px] h-[22px] flex items-center justify-center bg-black/50 text-white border-none rounded-full cursor-pointer p-0 transition-colors hover:bg-red-500"
                onClick={() => removePreviewImage(idx)}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {images.length < MAX_PREVIEWS && (
        <div
          className="border-2 border-dashed border-border rounded-lg cursor-pointer transition-colors overflow-hidden bg-muted hover:border-[#862633]/40 hover:bg-[#862633]/5"
          onClick={() => previewInputRef.current?.click()}
        >
          <input
            ref={previewInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handlePreviewImages}
            hidden
          />
          <div className="flex flex-col items-center gap-1.5 py-8 px-5 text-muted-foreground/60 text-sm">
            <Image className="w-6 h-6" strokeWidth={1.5} />
            <span>클릭하여 미리보기 이미지 첨부</span>
            <span className="text-xs text-muted-foreground/60">JPG, PNG (최대 5MB, {MAX_PREVIEWS}장까지)</span>
          </div>
        </div>
      )}
    </div>
  );
}
