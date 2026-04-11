import { useState, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import TermsContent from "@/components/legal/TermsContent";
import PrivacyContent from "@/components/legal/PrivacyContent";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60_000; // 1분


export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    nickname: "",
  });
  const [selectedUniversity, setSelectedUniversity] = useState("고려대학교(서울)");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [signUpSuccess, setSignUpSuccess] = useState(false);
  const [showResend, setShowResend] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(false);

  const [rememberMe, setRememberMe] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);

  const failCountRef = useRef(0);
  const lockoutTimerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const [capsLock, setCapsLock] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showFullTerms, setShowFullTerms] = useState(false);
  const [showFullPrivacy, setShowFullPrivacy] = useState(false);

  const { logIn, signUp, resetPassword } = useAuth();
  const navigate = useNavigate();


  const startLockout = useCallback(() => {
    const unlockAt = Date.now() + LOCKOUT_MS;
    setLockoutRemaining(Math.ceil(LOCKOUT_MS / 1000));
    clearInterval(lockoutTimerRef.current);
    lockoutTimerRef.current = setInterval(() => {
      const left = Math.ceil((unlockAt - Date.now()) / 1000);
      if (left <= 0) {
        clearInterval(lockoutTimerRef.current);
        setLockoutRemaining(0);
        failCountRef.current = 0;
      } else {
        setLockoutRemaining(left);
      }
    }, 1000);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (lockoutRemaining > 0) {
      setError(`너무 많은 시도가 있었습니다. ${lockoutRemaining}초 후에 다시 시도해주세요.`);
      return;
    }

    setLoading(true);

    try {
      if (resetMode) {
        await resetPassword(formData.email);
        setResetSent(true);
        setLoading(false);
        return;
      }
      if (isSignUp) {
        if (!formData.email.trim()) {
          setError("이메일을 입력해주세요.");
          setLoading(false);
          return;
        }
        if (!formData.email.trim().endsWith("@korea.ac.kr")) {
          setError("고려대학교 이메일(@korea.ac.kr)만 사용할 수 있습니다.");
          setLoading(false);
          return;
        }
        if (!agreeTerms || !agreePrivacy) {
          setError("이용약관과 개인정보처리방침에 모두 동의해주세요.");
          setLoading(false);
          return;
        }
        await signUp(formData.email, formData.password, formData.name, formData.nickname, selectedUniversity);
        setSignUpSuccess(true);
        setLoading(false);
        return;
      } else {
        await logIn(formData.email, formData.password, rememberMe);
      }
      failCountRef.current = 0;
      navigate("/");
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "auth/email-not-verified") {
        setShowResend(true);
      }

      // 로그인 실패 횟수 추적 (로그인 모드에서만)
      if (!isSignUp && !resetMode) {
        failCountRef.current++;
        if (failCountRef.current >= MAX_ATTEMPTS) {
          startLockout();
          setError(`로그인 시도가 ${MAX_ATTEMPTS}회를 초과했습니다. 1분 후에 다시 시도해주세요.`);
          setLoading(false);
          return;
        }
      }

      setError(getErrorMessage(err, isSignUp));
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-6 py-12 bg-secondary">
      <Card className="w-full max-w-[420px] border-none shadow-sm">
        <CardHeader className="px-10 pt-11 pb-0">
          <Link to="/" className="flex items-center mb-8 no-underline">
            <img src="/logo.png" alt="UniFile" className="h-10" />
          </Link>

          <h1 className="text-2xl font-bold text-foreground mb-2">
            {resetMode ? "비밀번호 찾기" : isSignUp ? "회원가입" : "로그인"}
          </h1>
          <p className="text-muted-foreground text-[15px] mb-8 leading-relaxed">
            {resetMode
              ? "가입한 이메일을 입력하면 비밀번호 재설정 링크를 보내드립니다"
              : isSignUp
                ? "고려대학교 이메일로 가입하여 자료를 거래하세요"
                : "계정에 로그인하세요"}
          </p>
        </CardHeader>

        <CardContent className="px-10 pb-0">
          {resetSent && (
            <div className="bg-success/5 text-[#1B8A4A] p-3.5 rounded-md text-sm mb-4.5 leading-relaxed">
              <p className="font-bold mb-1">비밀번호 재설정 이메일을 보냈습니다.</p>
              <p>이메일을 확인하고 링크를 클릭하여 비밀번호를 재설정해주세요.</p>
              <Button
                type="button"
                variant="ghost"
                className="w-full mt-3 text-muted-foreground font-semibold text-sm hover:bg-secondary hover:text-foreground"
                onClick={() => { setResetMode(false); setResetSent(false); setError(""); }}
              >
                로그인으로 돌아가기
              </Button>
            </div>
          )}

          {signUpSuccess && (
            <div className="bg-success/5 text-[#1B8A4A] p-3.5 rounded-md text-sm mb-4.5 leading-relaxed">
              <p className="font-bold mb-1">회원가입이 완료되었습니다!</p>
              <p>{formData.email}로 인증 링크를 보냈습니다. 이메일을 확인하고 인증을 완료한 후 로그인해주세요.</p>
            </div>
          )}

          {error && (
            <p className="bg-destructive/5 text-destructive p-3 rounded-md text-sm font-medium mb-4.5">
              {error}
            </p>
          )}

          {showResend && (
            <Button
              type="button"
              variant="secondary"
              className="w-full mb-4 font-bold text-sm"
              disabled={resendCooldown}
              onClick={async () => {
                try {
                  setResendCooldown(true);
                  const { signInWithEmailAndPassword: signInTemp, sendEmailVerification: sendVerif, signOut: signOutTemp } = await import("firebase/auth");
                  const { auth: firebaseAuth } = await import("../firebase");
                  const loginEmail = formData.email;
                  const cred = await signInTemp(firebaseAuth, loginEmail, formData.password);
                  await sendVerif(cred.user);
                  await signOutTemp(firebaseAuth);
                  setError("");
                  setShowResend(false);
                  setSignUpSuccess(true);
                  setTimeout(() => setResendCooldown(false), 60000);
                } catch {
                  setResendCooldown(false);
                  setError("인증 이메일 재발송에 실패했습니다. 다시 시도해주세요.");
                }
              }}
            >
              {resendCooldown ? "잠시 후 다시 시도해주세요" : "인증 이메일 재발송"}
            </Button>
          )}

          {!signUpSuccess && !resetSent && (
            <form onSubmit={handleSubmit}>
              {resetMode ? (
                <>
                  <div className="mb-4.5">
                    <label htmlFor="email" className="block text-sm font-semibold text-foreground mb-2">
                      이메일
                    </label>
                    <Input
                      type="email"
                      id="email"
                      name="email"
                      placeholder="가입한 이메일을 입력하세요"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      className="h-11 text-[15px] focus:ring-primary"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full h-12 text-base font-bold mt-3 rounded-lg bg-gradient-to-r from-[#862633] to-[#A83344] !text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                    disabled={loading}
                  >
                    {loading ? "처리 중..." : "재설정 링크 보내기"}
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full mt-3 text-muted-foreground font-semibold text-sm hover:bg-secondary hover:text-foreground"
                    onClick={() => { setResetMode(false); setError(""); }}
                  >
                    로그인으로 돌아가기
                  </Button>
                </>
              ) : (
                <>
                  {isSignUp && (
                    <>
                      <div className="mb-4.5">
                        <label htmlFor="name" className="block text-sm font-semibold text-foreground mb-2">
                          이름
                        </label>
                        <Input
                          type="text"
                          id="name"
                          name="name"
                          placeholder="실명을 입력하세요"
                          value={formData.name}
                          onChange={handleChange}
                          required
                          className="h-11 text-[15px] focus:ring-primary"
                        />
                      </div>
                      <div className="mb-4.5">
                        <label htmlFor="nickname" className="block text-sm font-semibold text-foreground mb-2">
                          닉네임
                        </label>
                        <Input
                          type="text"
                          id="nickname"
                          name="nickname"
                          placeholder="다른 사용자에게 표시될 닉네임"
                          value={formData.nickname}
                          onChange={handleChange}
                          required
                          className="h-11 text-[15px] focus:ring-primary"
                        />
                      </div>

                      <div className="mb-4.5">
                        <label className="block text-sm font-semibold text-foreground mb-2">
                          학교
                        </label>
                        <div className="h-11 px-3 flex items-center text-[15px] rounded-md border border-border bg-muted text-foreground">
                          고려대학교(서울)
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5">
                          현재 클로즈드 베타 기간으로 고려대학교만 이용 가능합니다.
                        </p>
                      </div>

                      <div className="mb-4.5">
                        <label htmlFor="email" className="block text-sm font-semibold text-foreground mb-2">
                          고려대학교 이메일
                        </label>
                        <Input
                          type="email"
                          id="email"
                          name="email"
                          placeholder="example@korea.ac.kr"
                          value={formData.email}
                          onChange={handleChange}
                          required
                          className="h-11 text-[15px] focus:ring-primary"
                        />
                        <p className="text-xs text-muted-foreground mt-1.5">
                          @korea.ac.kr 이메일만 사용 가능합니다.
                        </p>
                      </div>
                    </>
                  )}

                  {!isSignUp && (
                    <div className="mb-4.5">
                      <label htmlFor="email" className="block text-sm font-semibold text-foreground mb-2">
                        이메일
                      </label>
                      <Input
                        type="email"
                        id="email"
                        name="email"
                        placeholder="이메일을 입력하세요"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        className="h-11 text-[15px] focus:ring-primary"
                      />
                    </div>
                  )}

                  <div className="mb-4.5">
                    <label htmlFor="password" className="block text-sm font-semibold text-foreground mb-2">
                      비밀번호
                    </label>
                    <Input
                      type="password"
                      id="password"
                      name="password"
                      placeholder="비밀번호를 입력하세요"
                      value={formData.password}
                      onChange={handleChange}
                      onKeyDown={(e) => setCapsLock(e.getModifierState("CapsLock"))}
                      onKeyUp={(e) => setCapsLock(e.getModifierState("CapsLock"))}
                      required
                      minLength={6}
                      className="h-11 text-[15px] focus:ring-primary"
                    />
                    {capsLock && (
                      <p className="text-xs text-amber-600 mt-1.5 font-medium">
                        Caps Lock이 켜져 있습니다
                      </p>
                    )}
                  </div>

                  {!isSignUp && (
                    <div className="flex items-center justify-between mb-2 -mt-0.5">
                      <label className="inline-flex items-center gap-2 text-sm text-muted-foreground cursor-pointer leading-none">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="w-4 h-4 m-0 p-0 shrink-0 accent-foreground"
                        />
                        <span className="align-middle leading-4 font-medium">로그인 유지</span>
                      </label>
                      <button
                        type="button"
                        className="bg-transparent text-muted-foreground text-[13px] font-medium p-0 border-none cursor-pointer transition-colors hover:text-foreground"
                        onClick={() => { setResetMode(true); setError(""); }}
                      >
                        비밀번호 찾기
                      </button>
                    </div>
                  )}

                  {isSignUp && (
                    <div className="mb-4 mt-2 space-y-2.5">
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={agreeTerms && agreePrivacy}
                          onChange={(e) => {
                            setAgreeTerms(e.target.checked);
                            setAgreePrivacy(e.target.checked);
                          }}
                          className="w-4 h-4 mt-0.5 shrink-0 accent-[#862633]"
                        />
                        <span className="text-sm font-bold text-foreground">전체 동의</span>
                      </label>
                      <div className="border border-border rounded-lg p-3.5 space-y-2">
                        <div>
                          <div className="flex items-start gap-2.5">
                            <label className="flex items-start gap-2.5 cursor-pointer flex-1">
                              <input
                                type="checkbox"
                                checked={agreeTerms}
                                onChange={(e) => setAgreeTerms(e.target.checked)}
                                className="w-4 h-4 mt-0.5 shrink-0 accent-[#862633]"
                              />
                              <span className="text-sm text-foreground">
                                <span className="text-destructive font-bold">[필수]</span>{" "}
                                이용약관에 동의합니다
                              </span>
                            </label>
                            <button
                              type="button"
                              className="bg-transparent border-none p-0 cursor-pointer text-muted-foreground hover:text-foreground transition-colors shrink-0"
                              onClick={() => setShowTerms(!showTerms)}
                              aria-label="이용약관 보기"
                            >
                              <ChevronDown className={`w-4 h-4 transition-transform ${showTerms ? "rotate-180" : ""}`} />
                            </button>
                          </div>
                          {showTerms && (
                            <div className="mt-2 ml-6.5 max-h-48 overflow-y-auto rounded border border-border bg-secondary/50 p-3 text-xs text-muted-foreground leading-relaxed space-y-2">
                              <p className="font-semibold text-foreground">이용약관 (시행일: 2026년 4월 1일)</p>
                              <p><strong>제 1 조 (목적)</strong> 이 약관은 UniFile(이하 "회사")이 제공하는 서비스 이용에 있어 회사와 "회원"의 권리 및 의무, 기타 필요한 사항을 규정함을 목적으로 합니다.</p>
                              <p><strong>제 2 조 (정의)</strong> "회원"이란 회사와 이용계약을 체결하고 서비스를 이용하는 자, "판매회원"이란 자료를 등록하고 판매하는 회원, "구매회원"이란 자료를 구매하는 회원, "포인트"란 서비스 내에서 자료 구매 등에 사용할 수 있는 결제 수단을 말합니다.</p>
                              <p><strong>제 5 조 (이용계약의 성립)</strong> 이용자 가입 신청 내역을 작성 후 가입 버튼을 누름과 동시에 이 약관에 동의하는 것으로 간주됩니다.</p>
                              <p><strong>제 9 조 (회사의 의무)</strong> 회사는 계속적이고 안정적인 서비스의 제공을 위하여 최선을 다합니다.</p>
                              <p><strong>제 11 조 (회원의 의무)</strong> 회원은 허위내용 기재, 제3자의 개인정보 도용, 저작권 침해, 명예훼손 등의 행위를 하여서는 아니됩니다.</p>
                              <p><strong>제 14 조 (자료대금 및 수수료)</strong> 회사는 구매회원이 지급한 자료대금 중 수수료 및 제세공과금을 제외한 나머지 금액을 판매회원의 계정에 적립합니다.</p>
                              <p><strong>제 19 조 (계약의 해지)</strong> 이용계약이 해지된 경우, 회원이 등록한 자료는 삭제되며, 보유한 포인트 기타 혜택은 모두 소멸합니다.</p>
                              <p className="text-[11px] pt-1 border-t border-border">
                                <button
                                  type="button"
                                  onClick={() => setShowFullTerms(true)}
                                  className="bg-transparent border-none p-0 cursor-pointer text-[#862633] hover:underline text-[11px]"
                                >
                                  전문 보기 →
                                </button>
                              </p>
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="flex items-start gap-2.5">
                            <label className="flex items-start gap-2.5 cursor-pointer flex-1">
                              <input
                                type="checkbox"
                                checked={agreePrivacy}
                                onChange={(e) => setAgreePrivacy(e.target.checked)}
                                className="w-4 h-4 mt-0.5 shrink-0 accent-[#862633]"
                              />
                              <span className="text-sm text-foreground">
                                <span className="text-destructive font-bold">[필수]</span>{" "}
                                개인정보처리방침에 동의합니다
                              </span>
                            </label>
                            <button
                              type="button"
                              className="bg-transparent border-none p-0 cursor-pointer text-muted-foreground hover:text-foreground transition-colors shrink-0"
                              onClick={() => setShowPrivacy(!showPrivacy)}
                              aria-label="개인정보처리방침 보기"
                            >
                              <ChevronDown className={`w-4 h-4 transition-transform ${showPrivacy ? "rotate-180" : ""}`} />
                            </button>
                          </div>
                          {showPrivacy && (
                            <div className="mt-2 ml-6.5 max-h-48 overflow-y-auto rounded border border-border bg-secondary/50 p-3 text-xs text-muted-foreground leading-relaxed space-y-2">
                              <p className="font-semibold text-foreground">개인정보처리방침 (시행일: 2026년 4월 4일 | v1.1)</p>
                              <p><strong>수집하는 개인정보</strong> 필수항목: ID, 비밀번호, 닉네임, 학교명, 학교 이메일 주소. 출금 시: 이름, 생년월일, 휴대폰 번호, 은행명, 계좌번호, 예금주명.</p>
                              <p><strong>수집 및 이용 목적</strong> 회원제 서비스 이용에 따른 본인 식별, 재학생 인증, 출금 처리, 서비스 통계 분석에 이용합니다.</p>
                              <p><strong>제3자 제공</strong> 이용자의 사전 동의 없이 개인정보를 외부에 공개하지 않습니다. 단, 법령의 규정에 의한 경우는 예외입니다.</p>
                              <p><strong>보유 기간</strong> 계약/청약철회 기록 5년, 대금결제 기록 5년, 소비자 불만 기록 3년, 접속 로그 3개월 (관련 법령 근거).</p>
                              <p><strong>동의 철회</strong> 회원탈퇴를 통해 언제든지 동의를 철회할 수 있으며, 탈퇴 후 90일간 재가입 방지를 위해 정보를 보존한 후 삭제합니다.</p>
                              <p><strong>기술적 보호 대책</strong> 비밀번호 암호화, 해킹 대비 백업 및 백신 운영, 암호화 통신을 통해 개인정보를 보호합니다.</p>
                              <p className="text-[11px] pt-1 border-t border-border">
                                <button
                                  type="button"
                                  onClick={() => setShowFullPrivacy(true)}
                                  className="bg-transparent border-none p-0 cursor-pointer text-[#862633] hover:underline text-[11px]"
                                >
                                  전문 보기 →
                                </button>
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full h-12 text-base font-bold mt-3 rounded-lg bg-gradient-to-r from-[#862633] to-[#A83344] !text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                    disabled={loading || (!isSignUp && lockoutRemaining > 0)}
                  >
                    {loading
                      ? "처리 중..."
                      : !isSignUp && lockoutRemaining > 0
                        ? `${lockoutRemaining}초 후 재시도`
                        : isSignUp ? "가입하기" : "로그인"}
                  </button>
                </>
              )}
            </form>
          )}
        </CardContent>

        <CardFooter className="px-10 pb-11 pt-6 justify-center">
          <p className="text-center text-sm text-muted-foreground">
            {isSignUp ? "이미 계정이 있나요?" : "계정이 없나요?"}{" "}
            <button
              className="bg-transparent text-[#862633] font-bold text-sm border-none cursor-pointer transition-colors hover:text-[#A83344]"
              onClick={() => { setIsSignUp(!isSignUp); setError(""); setSignUpSuccess(false); setShowResend(false); setAgreeTerms(false); setAgreePrivacy(false); setShowTerms(false); setShowPrivacy(false); setSelectedUniversity("고려대학교(서울)"); }}
            >
              {isSignUp ? "로그인" : "회원가입"}
            </button>
          </p>
        </CardFooter>
      </Card>

      {(showFullTerms || showFullPrivacy) && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[300] p-4"
          onClick={() => { setShowFullTerms(false); setShowFullPrivacy(false); }}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-bold text-gray-900">
                {showFullTerms ? "이용약관 전문" : "개인정보처리방침 전문"}
              </h2>
              <button
                type="button"
                onClick={() => { setShowFullTerms(false); setShowFullPrivacy(false); }}
                className="bg-transparent border-none p-1 cursor-pointer text-muted-foreground hover:text-foreground transition-colors rounded"
                aria-label="닫기"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {showFullTerms ? <TermsContent /> : <PrivacyContent />}
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end">
              <Button
                variant="secondary"
                onClick={() => { setShowFullTerms(false); setShowFullPrivacy(false); }}
              >
                닫기
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getErrorMessage(err: unknown, isSignUp: boolean): string {
  const code = (err as { code?: string }).code;
  switch (code) {
    case "auth/email-already-in-use":
    case "auth/invalid-credential":
      return isSignUp
        ? "가입할 수 없는 이메일이거나 이미 사용 중입니다."
        : "이메일 또는 비밀번호가 올바르지 않습니다.";
    case "auth/invalid-email":
      return "유효하지 않은 이메일 형식입니다.";
    case "auth/weak-password":
      return "비밀번호는 6자 이상이어야 합니다.";
    case "auth/email-not-verified":
      return "이메일 인증이 완료되지 않았습니다. 이메일을 확인해주세요.";
    case "auth/too-many-requests":
      return "너무 많은 시도가 있었습니다. 잠시 후 다시 시도해주세요.";
    case "auth/user-disabled":
      return "이 계정은 이용이 정지되었습니다. 문의사항은 고객센터로 연락해주세요.";
    case "auth/popup-closed-by-user":
      return "로그인 팝업이 닫혔습니다.";
    default:
      if (err instanceof Error && err.message) return err.message;
      return "오류가 발생했습니다. 다시 시도해주세요.";
  }
}
