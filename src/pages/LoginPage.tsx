import { useState, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60_000; // 1분

const CAMPUSES = [
  { label: "고려대학교(서울)", domain: "korea.ac.kr" },
  { label: "고려대학교(세종)", domain: "sejong.korea.ac.kr" },
];

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [formData, setFormData] = useState({
    emailId: "",
    email: "",
    password: "",
    name: "",
    nickname: "",
  });
  const [selectedCampus, setSelectedCampus] = useState(0);
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

  const { logIn, signUp, resetPassword } = useAuth();
  const navigate = useNavigate();

  const campusDomain = CAMPUSES[selectedCampus].domain;
  const fullEmail = isSignUp ? `${formData.emailId}@${campusDomain}` : formData.email;

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
        if (!formData.emailId.trim()) {
          setError("이메일 아이디를 입력해주세요.");
          setLoading(false);
          return;
        }
        await signUp(fullEmail, formData.password, formData.name, formData.nickname, CAMPUSES[selectedCampus].label);
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
          <Link to="/" className="flex items-center gap-2 font-bold text-lg text-foreground mb-8 no-underline">
            <span className="w-9 h-9 bg-foreground text-white rounded-md flex items-center justify-center font-bold">
              K
            </span>
            <span>KU market</span>
          </Link>

          <h1 className="text-2xl font-bold text-foreground mb-2">
            {resetMode ? "비밀번호 찾기" : isSignUp ? "회원가입" : "로그인"}
          </h1>
          <p className="text-muted-foreground text-[15px] mb-8 leading-relaxed">
            {resetMode
              ? "가입한 이메일을 입력하면 비밀번호 재설정 링크를 보내드립니다"
              : isSignUp
                ? "학교 이메일로 가입하고 자료를 거래하세요"
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
              <p>{fullEmail}로 인증 링크를 보냈습니다. 이메일을 확인하고 인증을 완료한 후 로그인해주세요.</p>
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
                  const loginEmail = isSignUp ? fullEmail : formData.email;
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
                      placeholder="가입한 학교 이메일을 입력하세요"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      className="h-11 text-[15px]"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-12 text-base font-bold mt-3"
                    disabled={loading}
                  >
                    {loading ? "처리 중..." : "재설정 링크 보내기"}
                  </Button>
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
                          className="h-11 text-[15px]"
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
                          className="h-11 text-[15px]"
                        />
                      </div>

                      <div className="mb-4.5">
                        <label className="block text-sm font-semibold text-foreground mb-2">
                          캠퍼스 선택
                        </label>
                        <div className="grid grid-cols-2 gap-2.5">
                          {CAMPUSES.map((campus, idx) => (
                            <button
                              key={campus.domain}
                              type="button"
                              className={cn(
                                "py-3 px-3.5 rounded-md text-sm font-bold transition-colors cursor-pointer border-none",
                                selectedCampus === idx
                                  ? "bg-foreground text-white"
                                  : "bg-secondary text-muted-foreground hover:bg-border hover:text-foreground"
                              )}
                              onClick={() => setSelectedCampus(idx)}
                            >
                              {campus.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="mb-4.5">
                        <label htmlFor="emailId" className="block text-sm font-semibold text-foreground mb-2">
                          학교 이메일
                        </label>
                        <div className="flex items-center rounded-md bg-secondary overflow-hidden transition-all focus-within:bg-muted focus-within:ring-2 focus-within:ring-primary">
                          <div className="flex items-center flex-1 pl-3">
                            <Mail className="w-[18px] h-[18px] text-muted-foreground shrink-0" />
                            <input
                              type="text"
                              id="emailId"
                              name="emailId"
                              placeholder="아이디만 입력"
                              value={formData.emailId}
                              onChange={handleChange}
                              required
                              className="border-none bg-transparent shadow-none py-3 px-2 flex-1 min-w-0 text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0"
                            />
                          </div>
                          <span className="shrink-0 py-3 px-3.5 text-sm text-muted-foreground bg-border font-semibold">
                            @{campusDomain}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          학교 이메일은 소속 학교 인증에 이용됩니다.
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
                        placeholder="학교 이메일을 입력하세요"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        className="h-11 text-[15px]"
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
                      required
                      minLength={6}
                      className="h-11 text-[15px]"
                    />
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

                  <Button
                    type="submit"
                    className="w-full h-12 text-base font-bold mt-3"
                    disabled={loading || (!isSignUp && lockoutRemaining > 0)}
                  >
                    {loading
                      ? "처리 중..."
                      : !isSignUp && lockoutRemaining > 0
                        ? `${lockoutRemaining}초 후 재시도`
                        : isSignUp ? "가입하기" : "로그인"}
                  </Button>
                </>
              )}
            </form>
          )}
        </CardContent>

        <CardFooter className="px-10 pb-11 pt-6 justify-center">
          <p className="text-center text-sm text-muted-foreground">
            {isSignUp ? "이미 계정이 있나요?" : "계정이 없나요?"}{" "}
            <button
              className="bg-transparent text-primary font-bold text-sm border-none cursor-pointer transition-colors hover:text-primary/80"
              onClick={() => { setIsSignUp(!isSignUp); setError(""); setSignUpSuccess(false); setShowResend(false); }}
            >
              {isSignUp ? "로그인" : "회원가입"}
            </button>
          </p>
        </CardFooter>
      </Card>
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
    case "auth/popup-closed-by-user":
      return "로그인 팝업이 닫혔습니다.";
    default:
      return "오류가 발생했습니다. 다시 시도해주세요.";
  }
}
