import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { DialogProvider } from "./contexts/DialogContext";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ErrorBoundary from "./components/ErrorBoundary";
import HomePage from "./pages/HomePage";
import BrowsePage from "./pages/BrowsePage";
import DetailPage from "./pages/DetailPage";
import UploadPage from "./pages/UploadPage";
import LoginPage from "./pages/LoginPage";
import PurchaseSuccessPage from "./pages/PurchaseSuccessPage";
import PurchaseFailPage from "./pages/PurchaseFailPage";
import CartPage from "./pages/CartPage";
import MyPage from "./pages/MyPage";
import ReportPage from "./pages/ReportPage";
import TermsPage from "./pages/TermsPage";
import PrivacyPage from "./pages/PrivacyPage";
import TransactionPage from "./pages/TransactionPage";
import AdminPage from "./pages/AdminPage";
import WithdrawPage from "./pages/WithdrawPage";
import KoreaUnivPage from "./pages/KoreaUnivPage";
import UnivLandingPage from "./pages/UnivLandingPage";
import { UNIV_CONFIGS } from "./data/univConfig";
import NotFoundPage from "./pages/NotFoundPage";
import EventsPage from "./pages/EventsPage";
import NoticesPage from "./pages/NoticesPage";
import SellerPage from "./pages/SellerPage";
import RequestDetailPage from "./pages/RequestDetailPage";

function SuspensionBanner() {
  const { userProfile } = useAuth();
  if (!userProfile?.suspended) return null;

  const until = userProfile.suspendedUntil
    ? new Date(userProfile.suspendedUntil).toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="bg-amber-500 text-white text-center py-3 px-4 text-sm font-semibold">
      <p>
        계정이 일시 정지되었습니다.
        {userProfile.suspendReason && <> 사유: {userProfile.suspendReason}</>}
        {until && <> (해제 예정: {until})</>}
      </p>
      <p className="text-amber-100 text-xs mt-1">
        정지 기간 동안 자료 판매 및 일부 기능이 제한됩니다.
      </p>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DialogProvider>
        <div className="min-h-screen flex flex-col">
          <SuspensionBanner />
          <Navbar />
          <ErrorBoundary>
            <Routes>
            <Route path="/" element={<KoreaUnivPage />} />
            {/* 클로즈드 베타 종료 후 복원 */}
            <Route path="/home" element={<HomePage />} />
            <Route path="/browse" element={<BrowsePage />} />
            <Route path="/material/:id" element={<DetailPage />} />
            <Route path="/seller/:authorId" element={<SellerPage />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/purchase/success" element={<PurchaseSuccessPage />} />
            <Route path="/purchase/fail" element={<PurchaseFailPage />} />
            <Route path="/mypage" element={<MyPage />} />
            <Route path="/report" element={<ReportPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/transactions" element={<TransactionPage />} />
            <Route path="/withdraw" element={<WithdrawPage />} />
            <Route path="/univ/korea" element={<KoreaUnivPage />} />
            <Route path="/univ/snu" element={<UnivLandingPage config={UNIV_CONFIGS.snu} />} />
            <Route path="/univ/yonsei" element={<UnivLandingPage config={UNIV_CONFIGS.yonsei} />} />
            <Route path="/univ/sogang" element={<UnivLandingPage config={UNIV_CONFIGS.sogang} />} />
            <Route path="/univ/skku" element={<UnivLandingPage config={UNIV_CONFIGS.skku} />} />
            <Route path="/univ/hanyang" element={<UnivLandingPage config={UNIV_CONFIGS.hanyang} />} />
            <Route path="/univ/cau" element={<UnivLandingPage config={UNIV_CONFIGS.cau} />} />
            <Route path="/univ/khu" element={<UnivLandingPage config={UNIV_CONFIGS.khu} />} />
            <Route path="/univ/hufs" element={<UnivLandingPage config={UNIV_CONFIGS.hufs} />} />
            <Route path="/univ/uos" element={<UnivLandingPage config={UNIV_CONFIGS.uos} />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/request/:id" element={<RequestDetailPage />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/notices" element={<NoticesPage />} />
            <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </ErrorBoundary>
          <Footer />
        </div>
        </DialogProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
