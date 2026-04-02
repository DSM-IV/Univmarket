import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  sendEmailVerification,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  type User,
} from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "../firebase";
import type { UserProfile } from "../types";

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signUp: (email: string, password: string, name: string, university: string) => Promise<void>;
  logIn: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  logInWithGoogle: () => Promise<void>;
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

async function ensureUserDoc(user: User, university?: string) {
  const createUserProfile = httpsCallable(functions, "createUserProfile");
  await createUserProfile({
    displayName: user.displayName || "",
    email: user.email || "",
    university: university || "",
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      // 이메일/비밀번호 가입자는 이메일 인증 완료 전까지 로그인 상태로 취급하지 않음
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

  // Firestore 유저 프로필 실시간 구독
  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (snap.exists()) {
        setUserProfile(snap.data() as UserProfile);
      } else {
        // 문서가 없으면 Cloud Function으로 생성
        ensureUserDoc(user);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  async function signUp(email: string, password: string, name: string, university: string) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    await ensureUserDoc(cred.user, university);
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

  async function logInWithGoogle() {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    await ensureUserDoc(cred.user);
  }

  async function resetPassword(email: string) {
    await sendPasswordResetEmail(auth, email);
  }

  async function logOut() {
    await signOut(auth);
  }

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, signUp, logIn, logInWithGoogle, logOut, resendVerificationEmail, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}
