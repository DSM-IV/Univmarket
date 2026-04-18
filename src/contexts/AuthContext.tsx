import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  type User,
} from "firebase/auth";
import { auth } from "../firebase";
import { apiGet, apiPost } from "../api/client";
import { jitterMs } from "../utils/pollWithJitter";
import type { UserProfile } from "../types";

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signUp: (email: string, password: string, name: string, nickname: string, university: string, identityVerified?: boolean, verifiedPhone?: string) => Promise<void>;
  logIn: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  logOut: () => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u && !u.emailVerified && u.providerData[0]?.providerId === "password") {
        setUser(null);
        setUserProfile(null);
        setLoading(false);
        return;
      }
      setUser(u);
      if (!u) {
        setUserProfile(null);
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  // Spring Boot API에서 유저 프로필 조회
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function fetchProfile() {
      try {
        const profile = await apiGet<UserProfile>("/users/me");
        if (!cancelled) {
          setUserProfile(profile);
        }
      } catch {
        // 프로필 없음 (아직 생성 전일 수 있음)
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchProfile();

    // 30초마다 프로필 갱신 (jitter ±20%)
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      timer = setTimeout(async () => {
        if (cancelled) return;
        await fetchProfile();
        if (!cancelled) schedule();
      }, jitterMs(30000));
    };
    schedule();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [user]);

  async function refreshProfile() {
    if (!user) return;
    try {
      const profile = await apiGet<UserProfile>("/users/me");
      setUserProfile(profile);
    } catch { /* ignore */ }
  }

  async function signUp(email: string, password: string, name: string, nickname: string, university: string, identityVerified?: boolean, verifiedPhone?: string) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    await apiPost("/users/profile", {
      displayName: name,
      nickname,
      email,
      university,
      identityVerified: identityVerified || false,
      verifiedPhone: verifiedPhone || "",
    });
    await sendEmailVerification(cred.user);
    await signOut(auth);
  }

  async function logIn(email: string, password: string, rememberMe: boolean = false) {
    await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
    const cred = await signInWithEmailAndPassword(auth, email, password);
    if (!cred.user.emailVerified) {
      await signOut(auth);
      const error = new Error("이메일 인증이 완료되지 않았습니다.");
      (error as any).code = "auth/email-not-verified";
      throw error;
    }
  }

  async function resendVerificationEmail() {
    if (auth.currentUser) {
      await sendEmailVerification(auth.currentUser);
    }
  }

  async function resetPassword(email: string) {
    await sendPasswordResetEmail(auth, email);
  }

  async function logOut() {
    await signOut(auth);
    localStorage.removeItem("betaEventPopupHiddenUntil");
  }

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, refreshProfile, signUp, logIn, logOut, resendVerificationEmail, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}
