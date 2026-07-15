// 대학별 랜딩 페이지(UnivLandingPage) 설정.
// 9개 대학 페이지가 구조적으로 동일하여, 차이나는 값만 config 로 추출했다.
// 히어로 "File in XX" 애니메이션의 글자 시퀀스도 여기서 모델링한다.

/**
 * 히어로 "File in " 뒤에 붙는 대학 글자 하나.
 * - slide: 항상 보이며 translateX 로 슬라이드 인 + 색 전환 (대부분의 "U")
 * - expand: overflow-hidden 상태에서 maxWidth/opacity 로 펼쳐짐
 */
export type HeroLetter =
  | {
      kind: "slide";
      char: string;
      /** transform 전 translateX 오프셋(em). transformed 시 0 으로. */
      offsetEm: number;
      colorFrom: string;
      colorTo: string;
    }
  | {
      kind: "expand";
      char: string;
      /** 펼쳐졌을 때 maxWidth(em) */
      widthEm: number;
      color: string;
      /** transform 전에도 보이는 글자(연세대의 첫 글자 Y) */
      initiallyVisible?: boolean;
    };

export interface UnivConfig {
  /** 루트 div 테마 클래스, 예: "snu-theme" */
  themeClass: string;
  /** 서브타이틀에 쓰는 대학 약칭, 예: "서울대" */
  univName: string;
  /** 히어로 "File" 단어의 transform 전 translateX 오프셋(em) */
  fileOffsetEm: number;
  /** "File in " 뒤에 붙는 대학 글자 시퀀스 */
  letters: HeroLetter[];
}

export const UNIV_CONFIGS = {
  snu: {
    themeClass: "snu-theme",
    univName: "서울대",
    fileOffsetEm: 2.2,
    letters: [
      { kind: "expand", char: "S", widthEm: 0.65, color: "#003458" },
      { kind: "expand", char: "N", widthEm: 0.65, color: "#003458" },
      { kind: "slide", char: "U", offsetEm: -2.5, colorFrom: "#1B3A5C", colorTo: "#003458" },
    ],
  },
  yonsei: {
    themeClass: "yonsei-theme",
    univName: "연세대",
    fileOffsetEm: 3.5,
    letters: [
      { kind: "expand", char: "Y", widthEm: 0.65, color: "#003876", initiallyVisible: true },
      { kind: "expand", char: "o", widthEm: 0.65, color: "#003876" },
      { kind: "expand", char: "n", widthEm: 0.65, color: "#003876" },
      { kind: "expand", char: "s", widthEm: 0.65, color: "#003876" },
      { kind: "expand", char: "e", widthEm: 0.65, color: "#003876" },
      { kind: "expand", char: "i", widthEm: 0.65, color: "#003876" },
    ],
  },
  sogang: {
    themeClass: "sogang-theme",
    univName: "서강대",
    fileOffsetEm: 2.2,
    letters: [
      { kind: "expand", char: "S", widthEm: 0.65, color: "#9E1B32" },
      { kind: "expand", char: "G", widthEm: 0.65, color: "#9E1B32" },
      { kind: "slide", char: "U", offsetEm: -2.5, colorFrom: "#1B3A5C", colorTo: "#9E1B32" },
    ],
  },
  skku: {
    themeClass: "skku-theme",
    univName: "성균관대",
    fileOffsetEm: 3,
    letters: [
      { kind: "expand", char: "S", widthEm: 0.65, color: "#004B49" },
      { kind: "expand", char: "K", widthEm: 0.65, color: "#004B49" },
      { kind: "expand", char: "K", widthEm: 0.65, color: "#004B49" },
      { kind: "slide", char: "U", offsetEm: -2.5, colorFrom: "#1B3A5C", colorTo: "#004B49" },
    ],
  },
  hanyang: {
    themeClass: "hanyang-theme",
    univName: "한양대",
    fileOffsetEm: 2.5,
    letters: [
      { kind: "expand", char: "H", widthEm: 0.65, color: "#0E4A84" },
      { kind: "expand", char: "Y", widthEm: 0.65, color: "#0E4A84" },
      { kind: "slide", char: "U", offsetEm: -2.5, colorFrom: "#1B3A5C", colorTo: "#0E4A84" },
    ],
  },
  cau: {
    themeClass: "cau-theme",
    univName: "중앙대",
    fileOffsetEm: 2.2,
    letters: [
      { kind: "expand", char: "C", widthEm: 0.65, color: "#004C97" },
      { kind: "expand", char: "A", widthEm: 0.65, color: "#004C97" },
      { kind: "slide", char: "U", offsetEm: -2.5, colorFrom: "#1B3A5C", colorTo: "#004C97" },
    ],
  },
  khu: {
    themeClass: "khu-theme",
    univName: "경희대",
    fileOffsetEm: 2.2,
    letters: [
      { kind: "expand", char: "K", widthEm: 0.65, color: "#7B2D26" },
      { kind: "expand", char: "H", widthEm: 0.65, color: "#7B2D26" },
      { kind: "slide", char: "U", offsetEm: -2.5, colorFrom: "#1B3A5C", colorTo: "#7B2D26" },
    ],
  },
  hufs: {
    themeClass: "hufs-theme",
    univName: "한국외대",
    fileOffsetEm: 3,
    letters: [
      { kind: "expand", char: "H", widthEm: 0.65, color: "#003478" },
      { kind: "slide", char: "U", offsetEm: -2.5, colorFrom: "#1B3A5C", colorTo: "#003478" },
      { kind: "expand", char: "F", widthEm: 0.65, color: "#003478" },
      { kind: "expand", char: "S", widthEm: 0.55, color: "#003478" },
    ],
  },
  uos: {
    themeClass: "uos-theme",
    univName: "시립대",
    fileOffsetEm: 2.2,
    letters: [
      { kind: "slide", char: "U", offsetEm: -2.5, colorFrom: "#1B3A5C", colorTo: "#003DA5" },
      { kind: "expand", char: "O", widthEm: 0.65, color: "#003DA5" },
      { kind: "expand", char: "S", widthEm: 0.55, color: "#003DA5" },
    ],
  },
} satisfies Record<string, UnivConfig>;
