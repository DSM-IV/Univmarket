import { useState } from "react";
import { Link } from "react-router-dom";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, Copy, Check } from "lucide-react";

const SUPPORT_EMAIL = "unifileservice@gmail.com";

export default function Footer() {
  const [showInquiry, setShowInquiry] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <footer className="bg-white border-t border-border mt-auto">
      <div className="max-w-[1140px] mx-auto px-6 pt-12 pb-8">
        {/* Brand */}
        <div className="mb-8">
          <div className="mb-2">
            <span className="font-bold text-[15px]">UniFile</span>
          </div>
          <p className="text-sm text-muted-foreground">
            대학생을 위한 공부자료 마켓플레이스
          </p>
        </div>

        <div className="flex items-center gap-4 pb-8 text-sm">
          <Link to="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">개인정보처리방침</Link>
          <Link to="/terms" className="text-muted-foreground hover:text-foreground transition-colors">이용약관</Link>
          <button
            type="button"
            onClick={() => setShowInquiry(true)}
            className="bg-transparent border-none p-0 cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
          >
            1:1 문의
          </button>
        </div>

        <Separator />

        {/* 사업자 정보 */}
        <div className="pt-6 pb-4 text-xs text-muted-foreground leading-relaxed space-y-1">
          <p>상호: UniFile | 대표: 장찬수 | 사업자등록번호: 883-12-02954</p>
          <p>소재지: 경기도 화성시 병점구 경기대로 1014, 603동 6층 127호(병점동, 병점프라자)</p>
          <p>이메일: UniFileService@gmail.com | 호스팅 서비스: Google Cloud (Firebase)</p>
          <p className="pt-2 text-muted-foreground/80">
            UniFile은 통신판매중개자로서 거래 당사자가 아니며, 판매자가 등록한 자료의 정보 및 거래에 대한 책임은 각 판매자에게 있습니다.
          </p>
        </div>

        <p className="text-center text-xs text-muted-foreground pb-2">
          &copy; 2026 UniFile. All rights reserved.
        </p>
      </div>

      {showInquiry && (
        <div
          className="fixed inset-0 bg-black/45 backdrop-blur-sm flex items-center justify-center z-[200] p-6"
          onClick={() => setShowInquiry(false)}
        >
          <Card
            className="max-w-[420px] w-full shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <CardContent className="p-7">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold tracking-tight">1:1 문의 안내</h2>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                궁금하신 점이나 도움이 필요한 내용이 있으시면 아래 이메일로
                문의해 주세요. 영업일 기준 1~2일 이내에 답변드리겠습니다.
              </p>

              <div className="flex items-center justify-between gap-2 bg-secondary rounded-lg px-4 py-3 mb-5">
                <span className="text-[15px] font-semibold text-foreground truncate">
                  {SUPPORT_EMAIL}
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground transition-colors bg-transparent border-none cursor-pointer shrink-0"
                  aria-label="이메일 주소 복사"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-success" />
                      복사됨
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      복사
                    </>
                  )}
                </button>
              </div>

              <div className="flex gap-2.5">
                <Button
                  variant="secondary"
                  size="lg"
                  className="flex-1"
                  onClick={() => setShowInquiry(false)}
                >
                  닫기
                </Button>
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="flex-1 inline-flex items-center justify-center h-11 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary-dark transition-colors no-underline"
                >
                  메일 보내기
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </footer>
  );
}
