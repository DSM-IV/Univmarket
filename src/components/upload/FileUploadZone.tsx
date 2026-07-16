import { useState, useRef, type Dispatch, type SetStateAction } from "react";
import { useDialog } from "../../contexts/DialogContext";
import { cn } from "@/lib/utils";
import { Upload, X, CheckCircle } from "lucide-react";
import { getFileTypeLabel, formatFileSize } from "./utils";

const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/x-hwp",
  "application/haansofthwp",
];
const MAX_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_FILES = 10;

interface Props {
  files: File[];
  setFiles: Dispatch<SetStateAction<File[]>>;
  onError: Dispatch<SetStateAction<string>>;
}

export default function FileUploadZone({ files, setFiles, onError }: Props) {
  const dialog = useDialog();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const validateFile = (f: File): string | null => {
    if (f.size > MAX_SIZE) return "파일 크기는 100MB를 초과할 수 없습니다.";
    const ext = f.name.split(".").pop()?.toLowerCase();
    const validExts = ["pdf", "ppt", "pptx", "doc", "docx", "hwp"];
    if (!ext || (!validExts.includes(ext) && !ALLOWED_TYPES.includes(f.type))) {
      return "PDF, PPT, DOCX, HWP 파일만 업로드 가능합니다.";
    }
    return null;
  };

  const addFiles = (incoming: File[]) => {
    if (incoming.length === 0) return;
    const oversized: string[] = [];
    setFiles((prev) => {
      const remaining = MAX_FILES - prev.length;
      if (remaining <= 0) {
        onError(`파일은 최대 ${MAX_FILES}개까지 업로드할 수 있습니다.`);
        return prev;
      }
      const accepted: File[] = [];
      const otherRejections: string[] = [];
      for (const f of incoming) {
        if (accepted.length >= remaining) {
          otherRejections.push(`${f.name} — 최대 ${MAX_FILES}개 초과`);
          break;
        }
        if (f.size > MAX_SIZE) {
          oversized.push(`${f.name} (${formatFileSize(f.size)})`);
          continue;
        }
        const err = validateFile(f);
        if (err) {
          otherRejections.push(`${f.name} — ${err}`);
          continue;
        }
        if (prev.some((p) => p.name === f.name && p.size === f.size)) {
          otherRejections.push(`${f.name} — 이미 추가된 파일`);
          continue;
        }
        accepted.push(f);
      }
      if (otherRejections.length > 0 && accepted.length === 0) {
        onError(otherRejections[0]);
      } else {
        onError("");
      }
      return accepted.length > 0 ? [...prev, ...accepted] : prev;
    });
    // 100MB 초과 파일 alert (가장 흔한 거절 사유라 별도 안내)
    if (oversized.length > 0) {
      void dialog.alert({
        description:
        `다음 파일은 100MB를 초과하여 업로드할 수 없습니다.\n\n` +
        oversized.map((s) => `• ${s}`).join("\n") +
        `\n\n파일을 압축하거나 분할해서 다시 시도해주세요.`
      });
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
    }
  };

  return (
    <div className="mb-4">
      <label className="block text-[13px] font-semibold mb-2 text-foreground">
        파일 업로드 * ({files.length}/{MAX_FILES})
      </label>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.ppt,.pptx,.doc,.docx,.hwp"
        multiple
        onChange={handleFileInput}
        hidden
      />

      {files.length > 0 && (
        <div className="mb-3 space-y-2">
          {files.map((f, idx) => (
            <div
              key={`${f.name}-${f.size}-${idx}`}
              className="flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-3"
            >
              <div className="w-8 h-8 shrink-0 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center">
                <CheckCircle className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-bold text-foreground truncate">{f.name}</p>
                <p className="text-[12px] text-muted-foreground">
                  {getFileTypeLabel(f)} · {formatFileSize(f.size)}
                </p>
              </div>
              <button
                type="button"
                className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-black/5 text-muted-foreground hover:bg-red-500 hover:text-white transition-colors"
                onClick={() => removeFile(idx)}
                aria-label="파일 삭제"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {files.length < MAX_FILES && (
        <div
          className={cn(
            "border-2 border-dashed rounded-lg py-11 px-5 text-center cursor-pointer transition-colors bg-muted",
            dragActive && "border-[#862633] bg-[#862633]/5",
            !dragActive && "border-border hover:border-[#862633]/40 hover:bg-[#862633]/5"
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-10 h-10 mx-auto mb-2.5 text-muted-foreground/60" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground">
            {files.length === 0
              ? "파일을 드래그하거나 클릭하여 업로드"
              : "파일을 더 추가하려면 드래그하거나 클릭하세요"}
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1.5">
            PDF, PPT, DOCX, HWP (파일당 최대 100MB, 최대 {MAX_FILES}개)
          </p>
        </div>
      )}
    </div>
  );
}
