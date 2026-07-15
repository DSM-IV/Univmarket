import { Card, CardContent } from "@/components/ui/card";
import type { Material } from "../../types";
import { getFileList, formatBytes } from "./utils";

export default function FileListCard({ material }: { material: Material }) {
  const list = getFileList(material);
  if (list.length === 0) return null;
  return (
    <Card className="mb-6">
      <CardContent className="p-6">
        <h3 className="text-base font-semibold mb-3">포함된 파일 ({list.length}개)</h3>
        <ul className="space-y-2">
          {list.map((f, idx) => (
            <li
              key={`${f.fileKey}-${idx}`}
              className="flex items-center gap-3 rounded-lg border border-border bg-secondary/30 px-3 py-2.5"
            >
              <div className="w-9 h-9 shrink-0 rounded-md bg-primary/10 text-primary flex items-center justify-center text-[11px] font-bold">
                {(f.fileType || "").slice(0, 4) || `#${idx + 1}`}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-foreground truncate">{f.fileName || `파일 ${idx + 1}`}</p>
                <p className="text-[12px] text-muted-foreground">
                  {[f.fileType, formatBytes(f.fileSize)].filter(Boolean).join(" · ") || "-"}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
