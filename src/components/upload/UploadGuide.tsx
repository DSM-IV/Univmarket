import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Lightbulb, ChevronDown, Camera, FileText, Award } from "lucide-react";

export default function UploadGuide() {
  const [showGuide, setShowGuide] = useState(false);

  return (
    <div className="mb-7">
      <button
        type="button"
        className={cn(
          "w-full flex items-center gap-3 px-5 py-4 rounded-lg border cursor-pointer transition-colors bg-background",
          showGuide
            ? "border-[#862633]/30 bg-[#862633]/[0.03]"
            : "border-border hover:border-[#862633]/30 hover:bg-[#862633]/[0.02]"
        )}
        onClick={() => setShowGuide(!showGuide)}
      >
        <div className="w-8 h-8 rounded-full bg-[#862633]/10 flex items-center justify-center shrink-0">
          <Lightbulb className="w-4 h-4 text-[#862633]" />
        </div>
        <span className="text-[15px] font-bold text-foreground flex-1 text-left">
          잘 팔리는 자료 가이드
        </span>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", showGuide && "rotate-180")} />
      </button>

      {showGuide && (
        <Card className="mt-2 border-[#862633]/20">
          <CardContent className="p-6 max-sm:p-4 space-y-6">
            <p className="text-sm text-muted-foreground leading-relaxed">
              아래 가이드를 참고하면 자료의 판매 전환율이 크게 올라갑니다. 구매자가 신뢰할 수 있는 자료일수록 잘 팔립니다.
            </p>

            {/* 1. 미리보기 이미지 */}
            <div className="flex gap-4 max-sm:flex-col">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <Camera className="w-5 h-5 text-blue-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-[15px] font-bold text-foreground mb-2">
                  1. 미리보기 이미지를 정성스럽게 준비하세요
                </h3>
                <div className="text-[13px] text-muted-foreground leading-relaxed space-y-1.5">
                  <p>
                    구매자는 미리보기 이미지만 보고 구매를 결정합니다. <strong className="text-foreground">자료의 내용과 구성이 한눈에 보이는 캡처</strong>를 올려주세요.
                  </p>
                  <ul className="pl-4 list-disc space-y-1 mt-2">
                    <li><strong className="text-foreground">목차 페이지</strong>를 첫 번째 이미지로 — 전체 구성을 파악할 수 있어요</li>
                    <li><strong className="text-foreground">핵심 내용이 담긴 페이지</strong> 2~3장 — 자료의 퀄리티를 보여주세요</li>
                    <li><strong className="text-foreground">표, 그래프, 정리 노트</strong> 등 시각적으로 정돈된 페이지가 효과적이에요</li>
                    <li>흐릿하거나 잘린 캡처는 피하고, <strong className="text-foreground">깨끗하게 전체 화면을 캡처</strong>하세요</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="border-t border-border" />

            {/* 2. 상세한 자료 설명 */}
            <div className="flex gap-4 max-sm:flex-col">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <FileText className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-[15px] font-bold text-foreground mb-2">
                  2. 자료 설명은 구체적으로 작성하세요
                </h3>
                <div className="text-[13px] text-muted-foreground leading-relaxed space-y-1.5">
                  <p>
                    "시험 정리"보다 <strong className="text-foreground">"2025-1 운영체제 중간고사 범위(1~7장) 핵심 요약 + 기출 복원"</strong>처럼 구체적으로 쓸수록 검색에 잘 노출되고 구매율이 높아집니다.
                  </p>
                  <ul className="pl-4 list-disc space-y-1 mt-2">
                    <li><strong className="text-foreground">어떤 시험/과제</strong>를 위한 자료인지 명시하세요 (중간, 기말, 레포트 등)</li>
                    <li><strong className="text-foreground">다루는 범위</strong>를 구체적으로 적어주세요 (단원, 주차, 챕터 등)</li>
                    <li><strong className="text-foreground">자료의 특장점</strong>을 어필하세요 (교수님 판서 반영, 기출 복원, 핵심 요약 등)</li>
                    <li><strong className="text-foreground">페이지 수와 분량</strong>을 꼭 기입하면 구매 결정에 도움이 됩니다</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="border-t border-border" />

            {/* 3. 성적 인증 시스템 */}
            <div className="flex gap-4 max-sm:flex-col">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <Award className="w-5 h-5 text-amber-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-[15px] font-bold text-foreground mb-2">
                  3. 성적 인증 시스템을 활용하세요
                </h3>
                <div className="text-[13px] text-muted-foreground leading-relaxed space-y-1.5">
                  <p>
                    <strong className="text-foreground">해당 과목에서 높은 성적을 받았다면, 성적 인증을 등록해보세요.</strong> 성적 인증 배지가 표시된 자료는 구매자의 신뢰도가 크게 올라갑니다.
                  </p>
                  <ul className="pl-4 list-disc space-y-1 mt-2">
                    <li>마이페이지에서 <strong className="text-foreground">성적표 캡처를 업로드</strong>하면 관리자 검토 후 인증 배지가 부여됩니다</li>
                    <li><strong className="text-foreground">A+ 인증 자료</strong>는 검색 결과에서 상위에 노출되며 판매량이 평균 2배 이상 높습니다</li>
                    <li>성적 인증은 <strong className="text-foreground">과목별로 한 번만</strong> 하면 해당 과목의 모든 자료에 자동 적용됩니다</li>
                    <li>이름 이외의 개인정보(학번, 생년월일 등)는 <strong className="text-foreground">반드시 모자이크 처리 후 업로드</strong>해야 합니다</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-[#862633]/[0.04] rounded-lg p-4 text-[13px] text-muted-foreground leading-relaxed">
              <strong className="text-foreground">TIP:</strong> 위 세 가지를 모두 갖춘 자료는 평균 대비 <strong className="text-foreground">판매량이 3배 이상</strong> 높습니다. 처음 등록할 때 조금만 신경 쓰면 꾸준한 수익으로 이어집니다.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
