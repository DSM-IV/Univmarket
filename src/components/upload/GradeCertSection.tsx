import { useRef, type Dispatch, type SetStateAction } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { X, GraduationCap } from "lucide-react";
import type { PreviewImage } from "./utils";

interface Props {
  gradeImage: PreviewImage | null;
  setGradeImage: Dispatch<SetStateAction<PreviewImage | null>>;
  gradeClaim: string;
  setGradeClaim: Dispatch<SetStateAction<string>>;
  onError: Dispatch<SetStateAction<string>>;
}

export default function GradeCertSection({ gradeImage, setGradeImage, gradeClaim, setGradeClaim, onError }: Props) {
  const gradeInputRef = useRef<HTMLInputElement>(null);

  return (
    <Card>
      <CardContent className="p-7 max-sm:p-5">
        <div className="flex items-center gap-3 mb-5 pb-3.5 border-b border-border">
          <GraduationCap className="w-5 h-5 text-amber-500" />
          <div>
            <h2 className="text-[17px] font-bold text-foreground tracking-tight">
              성적 인증
              <Badge className="ml-2 text-[11px] bg-secondary text-muted-foreground hover:bg-secondary">선택</Badge>
            </h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              해당 과목의 성적을 인증하면 자료에 성적 배지가 표시됩니다
            </p>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-[13px] font-semibold mb-2 text-foreground">
            취득 성적
          </label>
          <div className="flex flex-wrap gap-2">
            {["A+", "A", "B+", "B", "C+", "C", "P"].map((grade) => (
              <button
                key={grade}
                type="button"
                className={cn(
                  "px-4 py-2 rounded-lg border text-sm font-bold transition-colors cursor-pointer",
                  gradeClaim === grade
                    ? grade === "P"
                      ? "border-purple-500 bg-purple-500/10 text-purple-700"
                      : grade.startsWith("A")
                        ? "border-amber-500 bg-amber-500/10 text-amber-700"
                        : grade.startsWith("B")
                          ? "border-blue-500 bg-blue-500/10 text-blue-700"
                          : "border-green-500 bg-green-500/10 text-green-700"
                    : "border-border bg-background text-muted-foreground hover:bg-muted/70"
                )}
                onClick={() => setGradeClaim(gradeClaim === grade ? "" : grade)}
              >
                {grade}
              </button>
            ))}
          </div>
        </div>

        {gradeClaim && (
          <div className="mb-4">
            <label className="block text-[13px] font-semibold mb-2 text-foreground">
              성적증명서 캡처 *
            </label>
            <p className="text-[12px] text-muted-foreground mb-2 leading-relaxed">
              성적증명서에서 해당 과목의 성적이 보이는 부분을 캡처해 주세요. 이름 이외의 개인정보(학번, 생년월일 등)는 반드시 모자이크 처리해야 합니다.
            </p>
            <p className="text-[11px] text-red-500 mb-2.5 leading-relaxed font-medium">
              ⚠ 허위 성적 증명 시 형법 제231조(사문서위조) 및 제234조(위조사문서행사)에 따라 5년 이하의 징역 또는 1천만 원 이하의 벌금에 처해질 수 있으며, 전자상거래법 제21조에 따라 허위·과장 정보 제공에 대한 법적 제재를 받을 수 있습니다.
            </p>

            {gradeImage ? (
              <div className="relative inline-block">
                <img
                  src={gradeImage.url}
                  alt="성적증명서"
                  className="w-[200px] h-[150px] object-cover rounded-lg border border-border shadow-sm"
                />
                <button
                  type="button"
                  className="absolute top-1.5 right-1.5 w-[22px] h-[22px] flex items-center justify-center bg-black/50 text-white border-none rounded-full cursor-pointer p-0 transition-colors hover:bg-red-500"
                  onClick={() => {
                    URL.revokeObjectURL(gradeImage.url);
                    setGradeImage(null);
                    if (gradeInputRef.current) gradeInputRef.current.value = "";
                  }}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div
                className="border-2 border-dashed border-border rounded-lg cursor-pointer transition-colors overflow-hidden bg-muted hover:border-amber-400/60 hover:bg-amber-500/5"
                onClick={() => gradeInputRef.current?.click()}
              >
                <input
                  ref={gradeInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    if (!f.type.startsWith("image/")) {
                      onError("이미지 파일만 업로드 가능합니다.");
                      return;
                    }
                    if (f.size > 5 * 1024 * 1024) {
                      onError("이미지 파일은 5MB를 초과할 수 없습니다.");
                      return;
                    }
                    setGradeImage({ file: f, url: URL.createObjectURL(f) });
                    onError("");
                  }}
                  hidden
                />
                <div className="flex flex-col items-center gap-1.5 py-8 px-5 text-muted-foreground/60 text-sm">
                  <GraduationCap className="w-6 h-6" strokeWidth={1.5} />
                  <span>클릭하여 성적증명서 캡처 첨부</span>
                  <span className="text-xs text-muted-foreground/60">JPG, PNG (최대 5MB)</span>
                </div>
              </div>
            )}
          </div>
        )}

        {!gradeClaim && (
          <div className="bg-secondary/80 rounded-lg p-3.5 text-[13px] text-muted-foreground leading-relaxed">
            성적을 선택하면 성적증명서 업로드 영역이 나타납니다. 관리자 검토 후 인증 배지가 자료에 표시됩니다.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
