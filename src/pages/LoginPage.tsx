import { useState, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import "./LoginPage.css";

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
  const lockoutTimerRef = useRef<ReturnType<typeof setInterval>>();

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
        await signUp(fullEmail, formData.password, formData.name, CAMPUSES[selectedCampus].label);
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
    <div className="login-page">
      <div className="login-card">
        <Link to="/" className="login-logo">
          <span className="login-logo-icon">K</span>
          <span>KU market</span>
        </Link>

        <h1>{resetMode ? "비밀번호 찾기" : isSignUp ? "회원가입" : "로그인"}</h1>
        <p className="login-subtitle">
          {resetMode
            ? "가입한 이메일을 입력하면 비밀번호 재설정 링크를 보내드립니다"
            : isSignUp
              ? "학교 이메일로 가입하고 자료를 거래하세요"
              : "계정에 로그인하세요"}
        </p>

        {resetSent && (
          <div className="login-success">
            <p>비밀번호 재설정 이메일을 보냈습니다.</p>
            <p>이메일을 확인하고 링크를 클릭하여 비밀번호를 재설정해주세요.</p>
            <button
              type="button"
              className="btn-back-login"
              onClick={() => { setResetMode(false); setResetSent(false); setError(""); }}
            >
              로그인으로 돌아가기
            </button>
          </div>
        )}

        {signUpSuccess && (
          <div className="login-success">
            <p>회원가입이 완료되었습니다!</p>
            <p>{fullEmail}로 인증 링크를 보냈습니다. 이메일을 확인하고 인증을 완료한 후 로그인해주세요.</p>
          </div>
        )}

        {error && <p className="login-error">{error}</p>}

        {showResend && (
          <button
            type="button"
            className="btn-resend"
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
          </button>
        )}

        {!signUpSuccess && !resetSent && <form onSubmit={handleSubmit}>
          {resetMode ? (
            <>
              <div className="form-group">
                <label htmlFor="email">이메일</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  placeholder="가입한 학교 이메일을 입력하세요"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>
              <button type="submit" className="btn-login" disabled={loading}>
                {loading ? "처리 중..." : "재설정 링크 보내기"}
              </button>
              <button
                type="button"
                className="btn-back-login"
                onClick={() => { setResetMode(false); setError(""); }}
              >
                로그인으로 돌아가기
              </button>
            </>
          ) : (
            <>
              {isSignUp && (
                <>
                  <div className="form-group">
                    <label htmlFor="name">이름</label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      placeholder="이름을 입력하세요"
                      value={formData.name}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>캠퍼스 선택</label>
                    <div className="campus-selector">
                      {CAMPUSES.map((campus, idx) => (
                        <button
                          key={campus.domain}
                          type="button"
                          className={`campus-btn ${selectedCampus === idx ? "active" : ""}`}
                          onClick={() => setSelectedCampus(idx)}
                        >
                          {campus.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="emailId">학교 이메일</label>
                    <div className="email-input-row">
                      <div className="email-id-wrapper">
                        <svg className="email-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="4" width="20" height="16" rx="2" />
                          <path d="M22 7l-10 6L2 7" />
                        </svg>
                        <input
                          type="text"
                          id="emailId"
                          name="emailId"
                          placeholder="아이디만 입력"
                          value={formData.emailId}
                          onChange={handleChange}
                          required
                        />
                      </div>
                      <span className="email-domain">@{campusDomain}</span>
                    </div>
                    <p className="email-hint">학교 이메일은 소속 학교 인증에 이용됩니다.</p>
                  </div>
                </>
              )}

              {!isSignUp && (
                <div className="form-group">
                  <label htmlFor="email">이메일</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    placeholder="학교 이메일을 입력하세요"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>
              )}

              <div className="form-group">
                <label htmlFor="password">비밀번호</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  placeholder="비밀번호를 입력하세요"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  minLength={6}
                />
              </div>

              {!isSignUp && (
                <div className="login-options">
                  <label className="remember-me">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <span>로그인 유지</span>
                  </label>
                  <button
                    type="button"
                    className="btn-forgot"
                    onClick={() => { setResetMode(true); setError(""); }}
                  >
                    비밀번호 찾기
                  </button>
                </div>
              )}

              <button type="submit" className="btn-login" disabled={loading || (!isSignUp && lockoutRemaining > 0)}>
                {loading
                  ? "처리 중..."
                  : !isSignUp && lockoutRemaining > 0
                    ? `${lockoutRemaining}초 후 재시도`
                    : isSignUp ? "가입하기" : "로그인"}
              </button>
            </>
          )}
        </form>}

        <p className="login-toggle">
          {isSignUp ? "이미 계정이 있나요?" : "계정이 없나요?"}{" "}
          <button onClick={() => { setIsSignUp(!isSignUp); setError(""); setSignUpSuccess(false); setShowResend(false); }}>
            {isSignUp ? "로그인" : "회원가입"}
          </button>
        </p>
      </div>
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
