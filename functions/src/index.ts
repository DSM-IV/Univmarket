import * as admin from "firebase-admin";
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import axios from "axios";
import cors from "cors";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

admin.initializeApp();
const db = admin.firestore();

// 프로덕션 배포 전 반드시 Firebase 환경변수 설정 필요:
// firebase functions:secrets:set ALIGO_API_KEY
// firebase functions:secrets:set ALIGO_USER_ID
// firebase functions:secrets:set ALIGO_SENDER_KEY
// firebase functions:secrets:set ALIGO_SENDER_NUMBER
// firebase functions:secrets:set KAKAOPAY_CID
// firebase functions:secrets:set KAKAOPAY_SECRET_KEY
// firebase functions:secrets:set TOSS_SECRET_KEY
// firebase functions:config:set app.frontend_url="https://unifile.store"
const VIRUSTOTAL_API_KEY = process.env.VIRUSTOTAL_API_KEY || "";

const ALIGO_API_KEY = process.env.ALIGO_API_KEY || "";
const ALIGO_USER_ID = process.env.ALIGO_USER_ID || "";
const ALIGO_SENDER_KEY = process.env.ALIGO_SENDER_KEY || "";
const ALIGO_SENDER_NUMBER = process.env.ALIGO_SENDER_NUMBER || "";

const KAKAOPAY_CID = process.env.KAKAOPAY_CID || "TC0ONETIME";
const KAKAOPAY_SECRET_KEY = process.env.KAKAOPAY_SECRET_KEY || "";
const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY || "";
const FRONTEND_URL = process.env.FRONTEND_URL || "https://unifile.store";

const MIN_CHARGE_AMOUNT = 1000;
const MAX_CHARGE_AMOUNT = 1000000; // 100만원

// Cloudflare R2 - secrets는 함수 내부에서 접근
const R2_SECRETS = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME", "R2_PUBLIC_URL"];

function getR2Client() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

// 회원가입 시 유저 문서 생성
export const createUserProfile = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");

  const { displayName, nickname, email, university, identityVerified, verifiedPhone } = request.data;

  const userRef = db.collection("users").doc(uid);
  const existing = await userRef.get();
  if (existing.exists) return { success: true };

  await userRef.set({
    displayName: displayName || "",
    nickname: nickname || displayName || "",
    email: email || "",
    university: university || "",
    points: 0,
    totalEarned: 0,
    totalSpent: 0,
    identityVerified: identityVerified || false,
    verifiedPhone: verifiedPhone || "",
    identityVerifiedAt: identityVerified ? admin.firestore.FieldValue.serverTimestamp() : null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true };
});

// 카카오톡 인증번호 발송 (회원가입용 - 인증 불필요)
const ALIGO_SECRETS = ["ALIGO_API_KEY", "ALIGO_USER_ID", "ALIGO_SENDER_KEY", "ALIGO_SENDER_NUMBER"];

export const sendKakaoVerification = onCall(
  { secrets: ALIGO_SECRETS },
  async (request) => {
    const { name, phone } = request.data;
    if (!name?.trim()) {
      return { success: false, error: "이름을 입력해주세요." };
    }
    const cleanPhone = (phone || "").replace(/-/g, "");
    if (!/^01[016789]\d{7,8}$/.test(cleanPhone)) {
      return { success: false, error: "올바른 휴대폰 번호를 입력해주세요." };
    }

    // 동일 이름+전화번호로 이미 가입된 유저가 있는지 확인 (중복가입 방지)
    const existingUsers = await db
      .collection("users")
      .where("displayName", "==", name.trim())
      .where("verifiedPhone", "==", cleanPhone)
      .limit(1)
      .get();
    if (!existingUsers.empty) {
      return { success: false, error: "이미 가입된 정보입니다. 기존 계정으로 로그인해주세요." };
    }

    // 인증번호 생성 (6자리)
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const sessionId = `signup_${cleanPhone}_${Date.now()}`;
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5분 후 만료

    // Firestore에 인증 세션 저장
    await db.collection("verification_sessions").doc(sessionId).set({
      name: name.trim(),
      phone: cleanPhone,
      code,
      expiresAt,
      attempts: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 알리고 알림톡 발송
    try {
      if (ALIGO_API_KEY && ALIGO_SENDER_KEY) {
        const formData = new URLSearchParams();
        formData.append("apikey", ALIGO_API_KEY);
        formData.append("userid", ALIGO_USER_ID);
        formData.append("senderkey", ALIGO_SENDER_KEY);
        formData.append("tpl_code", "UG_8781");
        formData.append("sender", ALIGO_SENDER_NUMBER);
        formData.append("receiver_1", cleanPhone);
        formData.append("subject_1", "본인인증");
        formData.append("message_1", "유니파일 본인인증번호\n\n[" + code + "]\n\n타인에게 노출되지 않도록 유의해주세요.");
        const res = await axios.post(
          "https://kakaoapi.aligo.in/akv10/alimtalk/send/",
          formData,
          {
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
          },
        );
        console.log("[ALIGO] 응답:", JSON.stringify(res.data));
        console.log("[ALIGO] 보낸메시지:", formData.get("message_1"));
      } else {
        console.log(`[DEV] 알림톡 인증번호 for ${cleanPhone}: ${code}`);
      }
    } catch (err: any) {
      console.error("알리고 알림톡 발송 오류:", err?.response?.data || err.message);
      console.log(`[FALLBACK] 인증번호 for ${cleanPhone}: ${code}`);
    }

    return { success: true, sessionId };
  },
);

// 카카오톡 인증번호 확인 (회원가입용 - 인증 불필요)
export const verifyKakaoCode = onCall(async (request) => {
  const { sessionId, code } = request.data;
  if (!sessionId || !code?.trim()) {
    return { verified: false, error: "인증 정보가 누락되었습니다." };
  }

  const sessionRef = db.collection("verification_sessions").doc(sessionId);
  const sessionDoc = await sessionRef.get();
  if (!sessionDoc.exists) {
    return { verified: false, error: "인증 세션이 만료되었습니다. 다시 요청해주세요." };
  }

  const session = sessionDoc.data()!;

  // 만료 확인
  const expiresAt = session.expiresAt?.toDate?.() || new Date(0);
  if (Date.now() > expiresAt.getTime()) {
    await sessionRef.delete();
    return { verified: false, error: "인증번호가 만료되었습니다. 다시 요청해주세요." };
  }

  // 시도 횟수 제한 (5회)
  if (session.attempts >= 5) {
    await sessionRef.delete();
    return { verified: false, error: "인증 시도 횟수를 초과했습니다. 다시 요청해주세요." };
  }

  // 코드 검증
  if (session.code !== code.trim()) {
    await sessionRef.update({ attempts: admin.firestore.FieldValue.increment(1) });
    return { verified: false, error: "인증번호가 일치하지 않습니다." };
  }

  // 인증 성공 — 중복 가입 재확인
  const existingUsers = await db
    .collection("users")
    .where("displayName", "==", session.name)
    .where("verifiedPhone", "==", session.phone)
    .limit(1)
    .get();
  if (!existingUsers.empty) {
    await sessionRef.delete();
    return { verified: false, error: "이미 가입된 정보입니다. 기존 계정으로 로그인해주세요." };
  }

  await sessionRef.delete();

  return {
    verified: true,
    name: session.name,
    phone: session.phone,
  };
});

// R2 업로드 presigned URL 생성
export const getUploadUrl = onCall({ secrets: R2_SECRETS }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");

  const { fileName, contentType } = request.data;
  if (!fileName || !contentType) {
    throw new HttpsError("invalid-argument", "파일 정보가 누락되었습니다.");
  }

  const r2 = getR2Client();
  const key = `materials/${uid}/${Date.now()}_${fileName}`;

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 600 }); // 10분

  // 퍼블릭 다운로드 URL
  const publicUrl = process.env.R2_PUBLIC_URL;
  const fileUrl = publicUrl
    ? `${publicUrl}/${key}`
    : `https://${process.env.R2_BUCKET_NAME}.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;

  return { uploadUrl, fileUrl, key };
});

// PDF에 구매자 워터마크 삽입
async function addWatermarkToPdf(pdfBytes: Uint8Array, watermarkText: string): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();

  for (const page of pages) {
    const { width, height } = page.getSize();

    // 하단 워터마크 (작은 글씨)
    page.drawText(watermarkText, {
      x: 10,
      y: 10,
      size: 8,
      font,
      color: rgb(0.75, 0.75, 0.75),
      opacity: 0.5,
    });

    // 대각선 워터마크 (큰 글씨, 반투명)
    page.drawText(watermarkText, {
      x: width * 0.15,
      y: height * 0.4,
      size: 28,
      font,
      color: rgb(0.85, 0.85, 0.85),
      opacity: 0.15,
      rotate: { type: "degrees", angle: 45 } as any,
    });
  }

  return pdfDoc.save();
}

// R2 다운로드 presigned URL 생성 (구매한 유저만, PDF는 워터마크 삽입)
export const getDownloadUrl = onCall({ secrets: R2_SECRETS }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");

  const { materialId } = request.data;
  if (!materialId) {
    throw new HttpsError("invalid-argument", "자료 ID가 누락되었습니다.");
  }

  // 구매 확인
  const purchases = await db
    .collection("purchases")
    .where("buyerId", "==", uid)
    .where("materialId", "==", materialId)
    .limit(1)
    .get();

  let isBuyer = !purchases.empty;

  if (!isBuyer) {
    // 판매자 본인인지 확인
    const materialDoc = await db.collection("materials").doc(materialId).get();
    if (!materialDoc.exists || materialDoc.data()!.authorId !== uid) {
      throw new HttpsError("permission-denied", "구매 후 다운로드할 수 있습니다.");
    }
  }

  const materialDoc = await db.collection("materials").doc(materialId).get();
  if (!materialDoc.exists) {
    throw new HttpsError("not-found", "자료를 찾을 수 없습니다.");
  }

  const r2 = getR2Client();
  const { fileKey, fileName } = materialDoc.data()!;
  const isPdf = (fileName || "").toLowerCase().endsWith(".pdf");

  // PDF 파일이고 구매자인 경우 워터마크 삽입
  if (isPdf && isBuyer) {
    try {
      // R2에서 원본 파일 다운로드
      const getCommand = new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: fileKey,
      });
      const response = await r2.send(getCommand);
      const originalBytes = await response.Body!.transformToByteArray();

      // 구매자 정보 가져오기
      const userDoc = await db.collection("users").doc(uid).get();
      const nickname = userDoc.exists ? (userDoc.data()!.nickname || uid) : uid;
      const purchaseId = purchases.empty ? "owner" : purchases.docs[0].id;
      const watermarkText = `Licensed to ${nickname} (${purchaseId})`;

      // 워터마크 삽입
      const watermarkedBytes = await addWatermarkToPdf(originalBytes, watermarkText);

      // 워터마크된 파일을 임시 키로 R2에 업로드
      const tempKey = `temp-wm/${uid}/${materialId}-${Date.now()}.pdf`;
      const putCommand = new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: tempKey,
        Body: watermarkedBytes,
        ContentType: "application/pdf",
      });
      await r2.send(putCommand);

      // 워터마크된 파일의 presigned URL 생성
      const dlCommand = new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: tempKey,
        ResponseContentDisposition: `attachment; filename="${encodeURIComponent(fileName)}"`,
      });
      const downloadUrl = await getSignedUrl(r2, dlCommand, { expiresIn: 300 });

      return { downloadUrl };
    } catch (err) {
      // 워터마크 실패 시 원본 제공 (fallback)
      console.error("Watermark failed, serving original:", err);
    }
  }

  // 비-PDF 파일 또는 판매자 본인 → 원본 presigned URL
  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: fileKey,
    ResponseContentDisposition: `attachment; filename="${encodeURIComponent(fileName)}"`,
  });

  const downloadUrl = await getSignedUrl(r2, command, { expiresIn: 300 }); // 5분

  return { downloadUrl };
});

// 업로드 파일 바이러스 검사
export const scanFile = onCall({ secrets: R2_SECRETS }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");

  const { materialId } = request.data;
  if (!materialId) throw new HttpsError("invalid-argument", "자료 ID가 누락되었습니다.");

  const materialRef = db.collection("materials").doc(materialId);
  const materialDoc = await materialRef.get();
  if (!materialDoc.exists) throw new HttpsError("not-found", "자료를 찾을 수 없습니다.");

  const material = materialDoc.data()!;
  if (material.authorId !== uid) throw new HttpsError("permission-denied", "본인의 자료만 검사할 수 있습니다.");

  if (!VIRUSTOTAL_API_KEY) {
    // API 키 미설정 시 검사 건너뛰고 통과 처리
    await materialRef.update({ scanStatus: "clean" });
    return { status: "clean" };
  }

  // R2에서 파일 다운로드
  const r2 = getR2Client();
  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: material.fileKey,
  });
  const r2Response = await r2.send(command);
  const fileBytes = await r2Response.Body!.transformToByteArray();

  // VirusTotal에 파일 업로드 스캔 요청
  const FormData = (await import("form-data")).default;
  const form = new FormData();
  form.append("file", Buffer.from(fileBytes), {
    filename: material.fileName || "file",
    contentType: "application/octet-stream",
  });

  const vtUpload = await axios.post(
    "https://www.virustotal.com/api/v3/files",
    form,
    {
      headers: {
        "x-apikey": VIRUSTOTAL_API_KEY,
        ...form.getHeaders(),
      },
      maxBodyLength: 50 * 1024 * 1024,
    }
  );

  const analysisId = vtUpload.data?.data?.id;
  if (!analysisId) {
    await materialRef.update({ scanStatus: "error" });
    throw new HttpsError("internal", "바이러스 검사 요청에 실패했습니다.");
  }

  // 분석 결과 폴링 (최대 60초)
  let scanResult = "scanning";
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 5000));

    const vtResult = await axios.get(
      `https://www.virustotal.com/api/v3/analyses/${analysisId}`,
      { headers: { "x-apikey": VIRUSTOTAL_API_KEY } }
    );

    const status = vtResult.data?.data?.attributes?.status;
    if (status === "completed") {
      const stats = vtResult.data.data.attributes.stats;
      const malicious = (stats.malicious || 0) + (stats.suspicious || 0);
      scanResult = malicious > 0 ? "infected" : "clean";
      break;
    }
  }

  await materialRef.update({ scanStatus: scanResult });

  // 감염 파일 → R2에서 삭제 + 자료 비공개
  if (scanResult === "infected") {
    try {
      const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
      await r2.send(new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: material.fileKey,
      }));
    } catch { /* 삭제 실패해도 진행 */ }
    await materialRef.update({ hidden: true });
  }

  return { status: scanResult };
});

// 카카오페이 결제 준비
export const kakaopayReady = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");

  const { amount } = request.data;
  if (!amount || !Number.isInteger(amount) || amount < MIN_CHARGE_AMOUNT || amount > MAX_CHARGE_AMOUNT) {
    throw new HttpsError("invalid-argument", `충전 금액은 ${MIN_CHARGE_AMOUNT.toLocaleString()}원~${MAX_CHARGE_AMOUNT.toLocaleString()}원이어야 합니다.`);
  }

  const sessionId = db.collection("kakaopay_sessions").doc().id;

  const response = await axios.post(
    "https://open-api.kakaopay.com/online/v1/payment/ready",
    {
      cid: KAKAOPAY_CID,
      partner_order_id: sessionId,
      partner_user_id: uid,
      item_name: `UniFile 포인트 ${amount.toLocaleString()}P`,
      quantity: 1,
      total_amount: amount,
      tax_free_amount: 0,
      approval_url: `${FRONTEND_URL}/charge/success?session_id=${sessionId}`,
      cancel_url: `${FRONTEND_URL}/charge?status=cancel`,
      fail_url: `${FRONTEND_URL}/charge?status=fail`,
    },
    {
      headers: {
        Authorization: `SECRET_KEY ${KAKAOPAY_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  await db.collection("kakaopay_sessions").doc(sessionId).set({
    userId: uid,
    amount,
    tid: response.data.tid,
    status: "ready",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {
    redirectUrl: response.data.next_redirect_pc_url,
    sessionId,
  };
});

// 카카오페이 결제 승인
const ALLOWED_ORIGINS = [FRONTEND_URL, "https://unifile.store", "https://www.unifile.store"];
const corsHandler = cors({ origin: ALLOWED_ORIGINS });

export const kakaopayApprove = onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    const { pg_token, session_id } = req.query;

    if (!pg_token || !session_id) {
      res.redirect(`${FRONTEND_URL}/charge?status=fail`);
      return;
    }

    const sessionRef = db.collection("kakaopay_sessions").doc(session_id as string);
    const sessionDoc = await sessionRef.get();

    if (!sessionDoc.exists) {
      res.redirect(`${FRONTEND_URL}/charge?status=fail`);
      return;
    }

    const session = sessionDoc.data()!;

    if (session.status === "approved") {
      res.redirect(`${FRONTEND_URL}/charge/success?amount=${session.amount}`);
      return;
    }
    if (session.status !== "ready") {
      res.redirect(`${FRONTEND_URL}/charge?status=fail`);
      return;
    }

    try {
      await axios.post(
        "https://open-api.kakaopay.com/online/v1/payment/approve",
        {
          cid: KAKAOPAY_CID,
          tid: session.tid,
          partner_order_id: session_id,
          partner_user_id: session.userId,
          pg_token,
        },
        {
          headers: {
            Authorization: `SECRET_KEY ${KAKAOPAY_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      // Firestore 트랜잭션으로 포인트 충전
      await db.runTransaction(async (tx) => {
        const userRef = db.collection("users").doc(session.userId);
        const userDoc = await tx.get(userRef);

        const currentPoints = userDoc.exists ? userDoc.data()!.points || 0 : 0;
        const newPoints = currentPoints + session.amount;

        tx.set(
          userRef,
          {
            points: newPoints,
            totalEarned: admin.firestore.FieldValue.increment(session.amount),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        tx.create(db.collection("transactions").doc(), {
          userId: session.userId,
          type: "charge",
          amount: session.amount,
          balanceAfter: newPoints,
          balanceType: "points",
          description: `포인트 충전 ${session.amount.toLocaleString()}P`,
          status: "completed",
          kakaopayTid: session.tid,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        tx.update(sessionRef, { status: "approved" });
      });

      res.redirect(
        `${FRONTEND_URL}/charge/success?amount=${session.amount}`
      );
    } catch {
      await sessionRef.update({ status: "failed" });
      res.redirect(`${FRONTEND_URL}/charge?status=fail`);
    }
  });
});

// 토스페이먼츠 결제 준비
export const tossReady = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");

  const { amount } = request.data;
  if (!amount || !Number.isInteger(amount) || amount < MIN_CHARGE_AMOUNT || amount > MAX_CHARGE_AMOUNT) {
    throw new HttpsError("invalid-argument", `충전 금액은 ${MIN_CHARGE_AMOUNT.toLocaleString()}원~${MAX_CHARGE_AMOUNT.toLocaleString()}원이어야 합니다.`);
  }

  const orderId = `unifile_${uid}_${Date.now()}`;

  // 토스 결제 세션 저장
  await db.collection("toss_sessions").doc(orderId).set({
    userId: uid,
    amount,
    status: "ready",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // 토스페이먼츠는 클라이언트에서 SDK로 결제창을 띄우므로 orderId만 반환
  return { orderId };
});

// 토스페이먼츠 결제 승인
export const tossApprove = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");

  const { paymentKey, orderId, amount } = request.data;
  if (!paymentKey || !orderId || !amount) {
    throw new HttpsError("invalid-argument", "결제 정보가 누락되었습니다.");
  }

  // 세션 검증
  const sessionRef = db.collection("toss_sessions").doc(orderId);
  const sessionDoc = await sessionRef.get();

  if (!sessionDoc.exists) {
    throw new HttpsError("not-found", "결제 세션을 찾을 수 없습니다.");
  }

  const session = sessionDoc.data()!;
  if (session.status === "approved") {
    return { success: true }; // 이미 처리 완료된 결제
  }
  if (session.status !== "ready") {
    throw new HttpsError("failed-precondition", "이미 처리되었거나 만료된 결제입니다.");
  }
  if (session.userId !== uid || session.amount !== amount) {
    throw new HttpsError("permission-denied", "결제 정보가 일치하지 않습니다.");
  }

  // 토스페이먼츠 ���제 승인 API 호출
  const authHeader = Buffer.from(`${TOSS_SECRET_KEY}:`).toString("base64");

  try {
    await axios.post(
      "https://api.tosspayments.com/v1/payments/confirm",
      { paymentKey, orderId, amount },
      {
        headers: {
          Authorization: `Basic ${authHeader}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Firestore 트랜잭션으로 포인트 충전
    await db.runTransaction(async (tx) => {
      const userRef = db.collection("users").doc(uid);
      const userDoc = await tx.get(userRef);

      const currentPoints = userDoc.exists ? userDoc.data()!.points || 0 : 0;
      const newPoints = currentPoints + amount;

      tx.set(
        userRef,
        {
          points: newPoints,
          totalEarned: admin.firestore.FieldValue.increment(amount),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      tx.create(db.collection("transactions").doc(), {
        userId: uid,
        type: "charge",
        amount,
        balanceAfter: newPoints,
        balanceType: "points",
        description: `포인트 충전 ${amount.toLocaleString()}P (토스)`,
        status: "completed",
        tossPaymentKey: paymentKey,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      tx.update(sessionRef, { status: "approved", paymentKey });
    });

    return { success: true };
  } catch (err) {
    await sessionRef.update({ status: "failed" });
    const message = axios.isAxiosError(err)
      ? err.response?.data?.message || "결제 승인에 실패했습니다."
      : "결제 승인에 실패했습니다.";
    throw new HttpsError("internal", message);
  }
});

// 자료 구매
export const purchaseMaterial = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");

  const { materialId } = request.data;

  if (!materialId) {
    throw new HttpsError("invalid-argument", "자료 ID가 누락되었습니다.");
  }

  // 서버에서 자료 정보를 직접 조회 (클라이언트 입력을 신뢰하지 않음)
  const materialDoc = await db.collection("materials").doc(materialId).get();
  if (!materialDoc.exists) {
    throw new HttpsError("not-found", "자료를 찾을 수 없습니다.");
  }

  const material = materialDoc.data()!;
  const price = material.price;
  const sellerId = material.authorId;
  const materialTitle = material.title;

  if (sellerId === uid) {
    throw new HttpsError("invalid-argument", "본인의 자료는 구매할 수 없습니다.");
  }

  await db.runTransaction(async (tx) => {
    const buyerRef = db.collection("users").doc(uid);
    const sellerRef = db.collection("users").doc(sellerId);
    const buyerDoc = await tx.get(buyerRef);
    const sellerDoc = await tx.get(sellerRef);

    if (!buyerDoc.exists) {
      throw new HttpsError("not-found", "사용자 정보를 찾을 수 없습니다.");
    }

    const buyerPoints = buyerDoc.data()!.points || 0;
    const sellerEarnings = sellerDoc.exists ? (sellerDoc.data()!.earnings || 0) : 0;
    const sellerPendingEarnings = sellerDoc.exists ? (sellerDoc.data()!.pendingEarnings || 0) : 0;
    if (buyerPoints < price) {
      throw new HttpsError("failed-precondition", "포인트가 부족합니다.");
    }

    // 이미 구매했는지 확인
    const existingPurchase = await db
      .collection("purchases")
      .where("buyerId", "==", uid)
      .where("materialId", "==", materialId)
      .limit(1)
      .get();

    if (!existingPurchase.empty) {
      throw new HttpsError("already-exists", "이미 구매한 자료입니다.");
    }

    const buyerNewPoints = buyerPoints - price;

    // 자료 판매 수 증가
    const materialRef = db.collection("materials").doc(materialId);
    tx.update(materialRef, {
      salesCount: admin.firestore.FieldValue.increment(1),
    });

    // 구매자 포인트 차감
    tx.update(buyerRef, {
      points: buyerNewPoints,
      totalSpent: admin.firestore.FieldValue.increment(price),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 판매자 수익금 보류 지급 (24시간 후 정산)
    tx.set(
      sellerRef,
      {
        pendingEarnings: admin.firestore.FieldValue.increment(price),
        totalEarned: admin.firestore.FieldValue.increment(price),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // 구매자 거래 내역
    tx.create(db.collection("transactions").doc(), {
      userId: uid,
      type: "purchase",
      amount: -price,
      balanceAfter: buyerNewPoints,
      balanceType: "points",
      description: `"${materialTitle}" 구매`,
      relatedMaterialId: materialId,
      relatedUserId: sellerId,
      status: "completed",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 판매자 거래 내역 (수익금 보류 중)
    tx.create(db.collection("transactions").doc(), {
      userId: sellerId,
      type: "sale",
      amount: price,
      balanceAfter: sellerEarnings + sellerPendingEarnings + price,
      balanceType: "earnings",
      description: `"${materialTitle}" 판매 (정산 보류 중)`,
      relatedMaterialId: materialId,
      relatedUserId: uid,
      status: "completed",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 구매 기록
    tx.create(db.collection("purchases").doc(), {
      buyerId: uid,
      sellerId,
      materialId,
      price,
      settled: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  return { success: true };
});

// --- 본인인증 ---

// 인증번호 발송 요청
export const requestVerification = onCall({ secrets: ALIGO_SECRETS }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");

  const { name, birth, phone } = request.data;
  if (!name?.trim()) throw new HttpsError("invalid-argument", "이름을 입력해주세요.");
  if (!/^\d{6}$/.test(birth)) throw new HttpsError("invalid-argument", "생년월일 6자리를 정확히 입력해주세요.");
  const cleanPhone = (phone || "").replace(/-/g, "");
  if (!/^01[016789]\d{7,8}$/.test(cleanPhone)) throw new HttpsError("invalid-argument", "올바른 휴대폰 번호를 입력해주세요.");

  // 인증번호 생성 (6자리)
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5분 후 만료

  // Firestore에 인증 세션 저장
  await db.collection("verification_sessions").doc(uid).set({
    name: name.trim(),
    birth,
    phone: cleanPhone,
    code,
    expiresAt,
    attempts: 0,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // 서버 IP 확인
  try {
    const ipRes = await axios.get("https://api.ipify.org?format=json");
    console.log("[SERVER_IP]", ipRes.data.ip);
  } catch (e) {}

  // 알리고 알림톡 발송 (본인인증)
  try {
    if (ALIGO_API_KEY && ALIGO_SENDER_KEY) {
      const formData = new URLSearchParams();
      formData.append("apikey", ALIGO_API_KEY);
      formData.append("userid", ALIGO_USER_ID);
      formData.append("senderkey", ALIGO_SENDER_KEY);
      formData.append("tpl_code", "UG_8781");
      formData.append("sender", ALIGO_SENDER_NUMBER);
      formData.append("receiver_1", cleanPhone);
      formData.append("subject_1", "본인인증");
      formData.append("message_1", "유니파일 본인인증번호\n\n[" + code + "]\n\n타인에게 노출되지 않도록 유의해주세요.");
      const res = await axios.post(
        "https://kakaoapi.aligo.in/akv10/alimtalk/send/",
        formData,
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
      );
      console.log("[ALIGO] 본인인증 응답:", JSON.stringify(res.data));
      console.log("[ALIGO] 보낸메시지:", formData.get("message_1"));
    } else {
      console.log(`[DEV] 본인인증 코드 for ${cleanPhone}: ${code}`);
    }
  } catch (err: any) {
    console.error("알리고 알림톡 발송 오류:", err?.response?.data || err.message);
    console.log(`[FALLBACK] 본인인증 코드 for ${cleanPhone}: ${code}`);
  }

  return { success: true };
});

// 인증번호 확인
export const confirmVerification = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");

  const { code } = request.data;
  if (!code?.trim()) throw new HttpsError("invalid-argument", "인증번호를 입력해주세요.");

  const sessionRef = db.collection("verification_sessions").doc(uid);
  const sessionDoc = await sessionRef.get();
  if (!sessionDoc.exists) throw new HttpsError("not-found", "인증 세션이 없습니다. 다시 인증을 요청해주세요.");

  const session = sessionDoc.data()!;

  // 만료 확인
  const expiresAt = session.expiresAt?.toDate?.() || new Date(0);
  if (Date.now() > expiresAt.getTime()) {
    await sessionRef.delete();
    throw new HttpsError("deadline-exceeded", "인증번호가 만료되었습니다. 다시 요청해주세요.");
  }

  // 시도 횟수 제한 (5회)
  if (session.attempts >= 5) {
    await sessionRef.delete();
    throw new HttpsError("resource-exhausted", "인증 시도 횟수를 초과했습니다. 다시 요청해주세요.");
  }

  // 코드 검증
  if (session.code !== code.trim()) {
    await sessionRef.update({ attempts: admin.firestore.FieldValue.increment(1) });
    throw new HttpsError("invalid-argument", "인증번호가 일치하지 않습니다.");
  }

  // 인증 성공 — 유저 프로필 업데이트
  const maskedPhone = session.phone.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2");
  await db.collection("users").doc(uid).update({
    identityVerified: true,
    identityVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
    verifiedName: session.name,
    verifiedPhone: maskedPhone,
    verifiedBirth: session.birth,
  });

  await sessionRef.delete();

  return { success: true };
});

// --- 출금 ---

const WITHDRAW_FEE = 500;
const WITHDRAW_MIN = 5000;
const WITHDRAW_TAX_THRESHOLD = 125000;
const WITHDRAW_TAX_RATE = 0.088;
const PLATFORM_COMMISSION_RATE = 0.10; // 플랫폼 수수료 10% (원래 40%에서 할인)

export const requestWithdraw = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");

  const { amount, bankName, accountNumber, accountHolder } = request.data;

  // 입력 검증
  if (!amount || !Number.isInteger(amount) || amount < WITHDRAW_MIN) {
    throw new HttpsError("invalid-argument", `최소 출금 금액은 ${WITHDRAW_MIN.toLocaleString()}원입니다.`);
  }
  if (!bankName?.trim() || !accountNumber?.trim() || !accountHolder?.trim()) {
    throw new HttpsError("invalid-argument", "계좌 정보를 모두 입력해주세요.");
  }

  // 본인인증 확인
  const userDoc = await db.collection("users").doc(uid).get();
  if (!userDoc.exists) throw new HttpsError("not-found", "사용자 정보를 찾을 수 없습니다.");
  if (!userDoc.data()!.identityVerified) {
    throw new HttpsError("failed-precondition", "본인인증이 필요합니다.");
  }

  // 수수료·세금 계산 (서버에서 재계산)
  const fee = WITHDRAW_FEE;
  const commission = Math.ceil(amount * PLATFORM_COMMISSION_RATE); // 플랫폼 수수료 10%
  const taxable = amount > WITHDRAW_TAX_THRESHOLD;
  const grossAmount = taxable ? Math.ceil(amount / (1 - WITHDRAW_TAX_RATE)) : amount;
  const tax = grossAmount - amount;
  const totalDeduction = grossAmount + fee + commission;

  // Firestore 트랜잭션으로 수익금 차감 + 출금 기록
  let balanceAfter = 0;
  await db.runTransaction(async (tx) => {
    const userRef = db.collection("users").doc(uid);
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new HttpsError("not-found", "사용자 정보를 찾을 수 없습니다.");

    const currentEarnings = snap.data()!.earnings || 0;
    if (currentEarnings < totalDeduction) {
      throw new HttpsError("failed-precondition", `수수료·세금 포함 ${totalDeduction.toLocaleString()}원이 필요합니다. 수익금이 부족합니다.`);
    }

    balanceAfter = currentEarnings - totalDeduction;

    tx.update(userRef, {
      earnings: balanceAfter,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 계좌번호 마스킹 (앞4자리 + **** + 뒤2자리)
    const acctTrimmed = accountNumber.trim();
    const maskedAccount = acctTrimmed.length > 6
      ? acctTrimmed.slice(0, 4) + "****" + acctTrimmed.slice(-2)
      : "****";

    const txDocRef = db.collection("transactions").doc();
    tx.create(txDocRef, {
      userId: uid,
      type: "withdraw",
      amount: -amount,
      fee,
      commission,
      tax,
      totalDeduction,
      balanceAfter,
      balanceType: "earnings",
      description: `수익금 출금 신청 (${bankName.trim()} ${maskedAccount})`,
      bankName: bankName.trim(),
      accountNumber: maskedAccount,
      accountHolder: accountHolder.trim(),
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 원본 계좌 정보는 보안 컬렉션에 별도 저장 (관리자만 접근)
    tx.create(db.collection("withdraw_secrets").doc(txDocRef.id), {
      userId: uid,
      bankName: bankName.trim(),
      accountNumber: acctTrimmed,
      accountHolder: accountHolder.trim(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  return { success: true, balanceAfter, totalDeduction, fee, commission, tax };
});

// --- 신고 ---

export const submitReport = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");

  const { materialId, materialTitle, reason, originalSource, description, contactEmail, isRightsHolder } = request.data;

  if (!materialId || !reason || !description?.trim()) {
    throw new HttpsError("invalid-argument", "필수 정보가 누락되었습니다.");
  }

  // 자료 존재 여부 확인
  const materialDoc = await db.collection("materials").doc(materialId).get();
  if (!materialDoc.exists) {
    throw new HttpsError("not-found", "해당 자료를 찾을 수 없습니다.");
  }

  // rate limiting: 동일 사용자 1시간 내 최대 5건
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentReports = await db
    .collection("reports")
    .where("reporterId", "==", uid)
    .where("createdAt", ">=", oneHourAgo)
    .get();

  if (recentReports.size >= 5) {
    throw new HttpsError("resource-exhausted", "단시간에 너무 많은 신고를 제출했습니다. 1시간 후 다시 시도해주세요.");
  }

  // 동일 자료 중복 신고 방지
  const duplicateReport = await db
    .collection("reports")
    .where("reporterId", "==", uid)
    .where("materialId", "==", materialId)
    .where("status", "==", "pending")
    .limit(1)
    .get();

  if (!duplicateReport.empty) {
    throw new HttpsError("already-exists", "이미 해당 자료에 대한 신고가 접수되어 처리 대기 중입니다.");
  }

  const userDoc = await db.collection("users").doc(uid).get();
  const reporterName = userDoc.exists ? (userDoc.data()!.displayName || userDoc.data()!.email) : "알 수 없음";

  await db.collection("reports").add({
    materialId,
    materialTitle: materialTitle || materialDoc.data()!.title,
    reason,
    originalSource: originalSource || "",
    description: description.trim(),
    contactEmail: contactEmail || "",
    isRightsHolder: isRightsHolder || false,
    reporterId: uid,
    reporterName,
    status: "pending",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true };
});

// --- 관리자 기능 ---

// 출금 목록 조회 (관리자)
export const getWithdrawals = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  await verifyAdmin(uid);

  const snap = await db
    .collection("transactions")
    .where("type", "==", "withdraw")
    .orderBy("createdAt", "desc")
    .limit(200)
    .get();

  const withdrawals = await Promise.all(snap.docs.map(async (d) => {
    const data = d.data();
    // 대기 중인 건만 원본 계좌 조회
    let realAccount = "";
    if (data.status === "pending") {
      const secretDoc = await db.collection("withdraw_secrets").doc(d.id).get();
      if (secretDoc.exists) {
        realAccount = secretDoc.data()!.accountNumber;
      }
    }
    return {
      id: d.id,
      ...data,
      realAccountNumber: realAccount,
      createdAt: data.createdAt?.toDate?.()?.toISOString?.() || "",
    };
  }));

  return { withdrawals };
});

// 출금 입금 완료 처리 (관리자)
export const completeWithdrawal = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  await verifyAdmin(uid);

  const { transactionId } = request.data;
  if (!transactionId) throw new HttpsError("invalid-argument", "거래 ID가 누락되었습니다.");

  const txRef = db.collection("transactions").doc(transactionId);
  const txDoc = await txRef.get();
  if (!txDoc.exists) throw new HttpsError("not-found", "거래를 찾을 수 없습니다.");

  const tx = txDoc.data()!;
  if (tx.type !== "withdraw") throw new HttpsError("invalid-argument", "출금 거래가 아닙니다.");
  if (tx.status === "completed") throw new HttpsError("failed-precondition", "이미 처리된 출금입니다.");

  await txRef.update({
    status: "completed",
    completedBy: uid,
    completedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await writeAdminLog(uid, "complete_withdrawal", { transactionId, userId: tx.userId, amount: tx.amount });

  return { success: true };
});

// 출금 거절 처리 (관리자) — 포인트 환불
export const rejectWithdrawal = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  await verifyAdmin(uid);

  const { transactionId, reason } = request.data;
  if (!transactionId) throw new HttpsError("invalid-argument", "거래 ID가 누락되었습니다.");

  const txRef = db.collection("transactions").doc(transactionId);
  const txDoc = await txRef.get();
  if (!txDoc.exists) throw new HttpsError("not-found", "거래를 찾을 수 없습니다.");

  const tx = txDoc.data()!;
  if (tx.type !== "withdraw") throw new HttpsError("invalid-argument", "출금 거래가 아닙니다.");
  if (tx.status !== "pending") throw new HttpsError("failed-precondition", "대기 중인 출금만 거절할 수 있습니다.");

  // 포인트 환불 (totalDeduction 전액)
  const userRef = db.collection("users").doc(tx.userId);
  await db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) throw new HttpsError("not-found", "사용자를 찾을 수 없습니다.");

    const currentPoints = userDoc.data()!.points || 0;
    transaction.update(userRef, {
      points: currentPoints + tx.totalDeduction,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    transaction.update(txRef, {
      status: "rejected",
      rejectedBy: uid,
      rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
      rejectReason: reason || "",
    });
  });

  await writeAdminLog(uid, "reject_withdrawal", { transactionId, userId: tx.userId, amount: tx.amount, reason });

  return { success: true };
});

async function verifyAdmin(uid: string) {
  const userDoc = await db.collection("users").doc(uid).get();
  if (!userDoc.exists || userDoc.data()!.role !== "admin") {
    throw new HttpsError("permission-denied", "관리자 권한이 필요합니다.");
  }
}

async function writeAdminLog(adminUid: string, action: string, details: Record<string, unknown>) {
  await db.collection("admin_logs").add({
    adminUid,
    action,
    details,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

// 신고 목록 조회
export const getReports = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  await verifyAdmin(uid);

  const snap = await db
    .collection("reports")
    .orderBy("createdAt", "desc")
    .limit(100)
    .get();

  return {
    reports: snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.()?.toISOString?.() || "",
    })),
  };
});

// 신고 상태 변경
export const updateReportStatus = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  await verifyAdmin(uid);

  const { reportId, status } = request.data;
  if (!reportId || !status) {
    throw new HttpsError("invalid-argument", "신고 ID와 상태가 필요합니다.");
  }

  await db.collection("reports").doc(reportId).update({
    status,
    resolvedBy: uid,
    resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await writeAdminLog(uid, "update_report_status", { reportId, status });

  return { success: true };
});

// 자료 삭제 (관리자)
export const adminDeleteMaterial = onCall(
  { secrets: R2_SECRETS },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
    await verifyAdmin(uid);

    const { materialId, reportId, reason } = request.data;
    if (!materialId) {
      throw new HttpsError("invalid-argument", "자료 ID가 필요합니다.");
    }

    const materialDoc = await db.collection("materials").doc(materialId).get();
    if (!materialDoc.exists) {
      throw new HttpsError("not-found", "자료를 찾을 수 없습니다.");
    }

    // R2에서 파일 삭제 (최대 3회 재시도)
    const { fileKey } = materialDoc.data()!;
    let r2Deleted = false;
    if (fileKey) {
      const r2 = getR2Client();
      const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await r2.send(
            new DeleteObjectCommand({
              Bucket: process.env.R2_BUCKET_NAME!,
              Key: fileKey,
            })
          );
          r2Deleted = true;
          break;
        } catch (err) {
          if (attempt === 2) {
            // 3회 실패 시 삭제 실패 기록을 남겨 추후 정리 가능하게 함
            await db.collection("failed_deletions").add({
              fileKey,
              materialId,
              error: String(err),
              deletedBy: uid,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
        }
      }
    }

    const isCopyright = reason === "copyright";

    if (isCopyright) {
      // 저작권 침해: 소프트 삭제 (구매자에게 사유 표시를 위해 문서 보존)
      await db.collection("materials").doc(materialId).update({
        hidden: true,
        copyrightDeleted: true,
        copyrightDeletedAt: admin.firestore.FieldValue.serverTimestamp(),
        copyrightDeletedBy: uid,
        fileUrl: "",
        fileKey: "",
      });
    } else {
      // 일반 삭제: Firestore에서 자료 완전 삭제
      await db.collection("materials").doc(materialId).delete();
    }

    // 관련 신고 상태 업데이트
    if (reportId) {
      await db.collection("reports").doc(reportId).update({
        status: "resolved",
        resolution: isCopyright ? "copyright_deleted" : "material_deleted",
        resolvedBy: uid,
        resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    await writeAdminLog(uid, "delete_material", { materialId, reportId, reason, r2Deleted });

    return { success: true, r2Deleted };
  }
);

// 판매자 탈퇴 (관리자)
export const adminBanUser = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  await verifyAdmin(uid);

  const { targetUserId, reason } = request.data;
  if (!targetUserId) {
    throw new HttpsError("invalid-argument", "대상 사용자 ID가 필요합니다.");
  }

  // Firebase Auth에서 계정 비활성화
  await admin.auth().updateUser(targetUserId, { disabled: true });

  // Firestore에 탈퇴 기록
  await db.collection("users").doc(targetUserId).update({
    banned: true,
    bannedAt: admin.firestore.FieldValue.serverTimestamp(),
    bannedBy: uid,
    banReason: reason || "",
  });

  // 해당 판매자의 모든 자료 비공개 처리
  const materials = await db
    .collection("materials")
    .where("authorId", "==", targetUserId)
    .get();

  const batch = db.batch();
  materials.docs.forEach((d) => {
    batch.update(d.ref, { hidden: true });
  });
  await batch.commit();

  await writeAdminLog(uid, "ban_user", { targetUserId, reason, hiddenMaterials: materials.size });

  return { success: true, hiddenMaterials: materials.size };
});

// 판매자 정지 (관리자)
export const adminSuspendUser = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  await verifyAdmin(uid);

  const { targetUserId, reason, days } = request.data;
  if (!targetUserId) {
    throw new HttpsError("invalid-argument", "대상 사용자 ID가 필요합니다.");
  }

  const suspendUntil = new Date();
  suspendUntil.setDate(suspendUntil.getDate() + (days || 7));

  await db.collection("users").doc(targetUserId).update({
    suspended: true,
    suspendedAt: admin.firestore.FieldValue.serverTimestamp(),
    suspendedUntil: suspendUntil,
    suspendedBy: uid,
    suspendReason: reason || "",
  });

  // 정지 기간 동안 자료 비공개
  const materials = await db
    .collection("materials")
    .where("authorId", "==", targetUserId)
    .get();

  const batch = db.batch();
  materials.docs.forEach((d) => {
    batch.update(d.ref, { hidden: true });
  });
  await batch.commit();

  await writeAdminLog(uid, "suspend_user", { targetUserId, reason, days, suspendedUntil: suspendUntil.toISOString(), hiddenMaterials: materials.size });

  return { success: true, hiddenMaterials: materials.size, suspendedUntil: suspendUntil.toISOString() };
});

// 판매자 정지 해제 (관리자)
export const adminUnsuspendUser = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  await verifyAdmin(uid);

  const { targetUserId } = request.data;
  if (!targetUserId) {
    throw new HttpsError("invalid-argument", "대상 사용자 ID가 필요합니다.");
  }

  await db.collection("users").doc(targetUserId).update({
    suspended: false,
    suspendedAt: admin.firestore.FieldValue.delete(),
    suspendedUntil: admin.firestore.FieldValue.delete(),
    suspendedBy: admin.firestore.FieldValue.delete(),
    suspendReason: admin.firestore.FieldValue.delete(),
  });

  // 자료 다시 공개
  const materials = await db
    .collection("materials")
    .where("authorId", "==", targetUserId)
    .get();

  const batch = db.batch();
  materials.docs.forEach((d) => {
    batch.update(d.ref, { hidden: false });
  });
  await batch.commit();

  await writeAdminLog(uid, "unsuspend_user", { targetUserId });

  return { success: true };
});

// --- 마이그레이션 (일회성) ---

// 기존 purchases에 settled: true 추가
export const migratePurchasesSettled = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  await verifyAdmin(uid);

  const snap = await db.collection("purchases").where("settled", "==", null).limit(500).get();
  if (snap.empty) {
    // settled 필드가 아예 없는 문서 조회
    const allSnap = await db.collection("purchases").limit(500).get();
    let count = 0;
    for (let i = 0; i < allSnap.docs.length; i += 500) {
      const batch = db.batch();
      allSnap.docs.slice(i, i + 500).forEach((d) => {
        if (d.data().settled === undefined) {
          batch.update(d.ref, { settled: true });
          count++;
        }
      });
      await batch.commit();
    }
    return { success: true, migrated: count };
  }

  return { success: true, migrated: 0 };
});

// --- 스케줄 작업 ---

// 만료된 결제 세션 정리 (매일 새벽 3시 실행)
export const cleanupExpiredSessions = onSchedule("every day 03:00", async () => {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // 카카오페이 만료 세션 정리
  const kakaoSnap = await db
    .collection("kakaopay_sessions")
    .where("status", "==", "ready")
    .where("createdAt", "<", oneDayAgo)
    .limit(500)
    .get();

  // 토스 만료 세션 정리
  const tossSnap = await db
    .collection("toss_sessions")
    .where("status", "==", "ready")
    .where("createdAt", "<", oneDayAgo)
    .limit(500)
    .get();

  const allDocs = [...kakaoSnap.docs, ...tossSnap.docs];
  if (allDocs.length === 0) return;

  // Firestore batch는 500건 제한이므로 분할 처리
  for (let i = 0; i < allDocs.length; i += 500) {
    const batch = db.batch();
    allDocs.slice(i, i + 500).forEach((d) => {
      batch.update(d.ref, { status: "expired" });
    });
    await batch.commit();
  }
});

// 보류 수익금 정산 (매시간 실행 — 24시간 지난 구매의 판매 수익을 earnings로 이전)
export const settlePendingPoints = onSchedule("every 1 hours", async () => {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // 24시간 지났고, 환불되지 않았으며, 아직 정산되지 않은 구매 조회
  const snap = await db
    .collection("purchases")
    .where("createdAt", "<", cutoff)
    .where("settled", "==", false)
    .limit(200)
    .get();

  if (snap.empty) return;

  // 판매자별로 정산 금액 합산
  const sellerAmounts: Record<string, number> = {};
  const purchaseRefs: FirebaseFirestore.DocumentReference[] = [];

  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.refunded) {
      // 환불된 건은 정산 완료 표시만
      purchaseRefs.push(doc.ref);
      continue;
    }
    const sellerId = data.sellerId;
    const price = data.price;
    sellerAmounts[sellerId] = (sellerAmounts[sellerId] || 0) + price;
    purchaseRefs.push(doc.ref);
  }

  // 판매자별 pendingEarnings → earnings 이전
  for (const [sellerId, amount] of Object.entries(sellerAmounts)) {
    await db.runTransaction(async (tx) => {
      const sellerRef = db.collection("users").doc(sellerId);
      const sellerDoc = await tx.get(sellerRef);
      if (!sellerDoc.exists) return;

      const pending = sellerDoc.data()!.pendingEarnings || 0;
      const settleAmount = Math.min(pending, amount);

      if (settleAmount > 0) {
        tx.update(sellerRef, {
          pendingEarnings: admin.firestore.FieldValue.increment(-settleAmount),
          earnings: admin.firestore.FieldValue.increment(settleAmount),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    });
  }

  // 구매 기록에 정산 완료 표시
  for (let i = 0; i < purchaseRefs.length; i += 500) {
    const batch = db.batch();
    purchaseRefs.slice(i, i + 500).forEach((ref) => {
      batch.update(ref, { settled: true });
    });
    await batch.commit();
  }
});

// --- 환불 ---

const REFUND_DEADLINE_HOURS = 24; // 구매 후 24시간 이내 환불 가능

export const refundPurchase = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");

  const { purchaseId } = request.data;
  if (!purchaseId) {
    throw new HttpsError("invalid-argument", "구매 ID가 누락되었습니다.");
  }

  // 구매 기록 조회
  const purchaseRef = db.collection("purchases").doc(purchaseId);
  const purchaseDoc = await purchaseRef.get();
  if (!purchaseDoc.exists) {
    throw new HttpsError("not-found", "구매 기록을 찾을 수 없습니다.");
  }

  const purchase = purchaseDoc.data()!;
  if (purchase.buyerId !== uid) {
    throw new HttpsError("permission-denied", "본인의 구매만 환불할 수 있습니다.");
  }
  if (purchase.refunded) {
    throw new HttpsError("failed-precondition", "이미 환불된 구매입니다.");
  }

  // 환불 기한 확인
  const purchasedAt = purchase.createdAt?.toDate?.();
  if (!purchasedAt) {
    throw new HttpsError("failed-precondition", "구매 일시를 확인할 수 없습니다.");
  }
  const deadlineMs = REFUND_DEADLINE_HOURS * 60 * 60 * 1000;
  if (Date.now() - purchasedAt.getTime() > deadlineMs) {
    throw new HttpsError("failed-precondition", `구매 후 ${REFUND_DEADLINE_HOURS}시간이 지나 환불할 수 없습니다.`);
  }

  // 다운로드 여부 확인
  if (purchase.downloaded) {
    throw new HttpsError("failed-precondition", "이미 다운로드한 자료는 환불할 수 없습니다.");
  }

  const { price, sellerId, materialId } = purchase;

  await db.runTransaction(async (tx) => {
    const buyerRef = db.collection("users").doc(uid);
    const sellerRef = db.collection("users").doc(sellerId);
    const buyerDoc = await tx.get(buyerRef);
    const sellerDoc = await tx.get(sellerRef);

    const buyerPoints = buyerDoc.exists ? (buyerDoc.data()!.points || 0) : 0;
    const sellerPendingEarnings = sellerDoc.exists ? (sellerDoc.data()!.pendingEarnings || 0) : 0;
    const sellerEarnings = sellerDoc.exists ? (sellerDoc.data()!.earnings || 0) : 0;

    // 보류 수익금에서 우선 차감, 부족하면 정산된 수익금에서 차감
    const fromPending = Math.min(sellerPendingEarnings, price);
    const fromEarnings = price - fromPending;

    if (fromEarnings > sellerEarnings) {
      throw new HttpsError("failed-precondition", "판매자의 수익금이 부족하여 환불할 수 없습니다.");
    }

    // 구매자 포인트 전액 복구
    tx.update(buyerRef, {
      points: buyerPoints + price,
      totalSpent: admin.firestore.FieldValue.increment(-price),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 판매자 수익금 차감 (보류 → 정산 순서)
    tx.update(sellerRef, {
      ...(fromPending > 0 ? { pendingEarnings: admin.firestore.FieldValue.increment(-fromPending) } : {}),
      ...(fromEarnings > 0 ? { earnings: admin.firestore.FieldValue.increment(-fromEarnings) } : {}),
      totalEarned: admin.firestore.FieldValue.increment(-price),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 자료 판매 수 감소
    const materialRef = db.collection("materials").doc(materialId);
    tx.update(materialRef, {
      salesCount: admin.firestore.FieldValue.increment(-1),
    });

    // 구매 기록에 환불 표시
    tx.update(purchaseRef, {
      refunded: true,
      refundedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const sellerBalanceAfter = (sellerEarnings - fromEarnings) + (sellerPendingEarnings - fromPending);

    // 환불 거래 내역 (구매자 - 포인트 복구)
    tx.create(db.collection("transactions").doc(), {
      userId: uid,
      type: "refund",
      amount: price,
      balanceAfter: buyerPoints + price,
      balanceType: "points",
      description: `환불 처리 (포인트 전액 환불)`,
      relatedMaterialId: materialId,
      relatedUserId: sellerId,
      status: "completed",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 환불 거래 내역 (판매자 - 수익금 차감)
    tx.create(db.collection("transactions").doc(), {
      userId: sellerId,
      type: "refund",
      amount: -price,
      balanceAfter: sellerBalanceAfter,
      balanceType: "earnings",
      description: `환불 처리 (구매자 환불)`,
      relatedMaterialId: materialId,
      relatedUserId: uid,
      status: "completed",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  return { success: true };
});

// 포인트 충전 요청 (계좌이체)
export const submitChargeRequest = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");

  const { amount, transferAmount, vat, fee, senderName, senderPhone, receiptNumber, receiptType } = request.data;
  if (!amount || amount < 1000) throw new HttpsError("invalid-argument", "최소 충전 금액은 1,000원입니다.");
  if (!senderName || !senderPhone) throw new HttpsError("invalid-argument", "입금자 정보가 누락되었습니다.");

  // 서버에서 재계산하여 검증
  const serverVat = Math.ceil(amount * 0.10);
  const serverFee = Math.ceil(amount * 0.10);
  const serverTransferAmount = amount + serverVat + serverFee;

  const userDoc = await db.collection("users").doc(uid).get();
  const email = userDoc.data()?.email || "";

  await db.collection("charge_requests").add({
    userId: uid,
    email,
    amount,
    transferAmount: serverTransferAmount,
    vat: serverVat,
    fee: serverFee,
    senderName,
    senderPhone,
    receiptNumber: receiptNumber || "",
    receiptType: receiptType || "",
    status: "pending",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true };
});

// 충전 요청 목록 (관리자)
export const getChargeRequests = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  await verifyAdmin(uid);

  const snap = await db.collection("charge_requests")
    .orderBy("createdAt", "desc")
    .limit(100)
    .get();

  const chargeRequests = snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    createdAt: d.data().createdAt?.toDate?.()?.toISOString?.() || "",
  }));

  return { chargeRequests };
});

// 충전 승인 (관리자)
export const approveChargeRequest = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  await verifyAdmin(uid);

  const { requestId } = request.data;
  if (!requestId) throw new HttpsError("invalid-argument", "요청 ID가 누락되었습니다.");

  const reqRef = db.collection("charge_requests").doc(requestId);
  const reqDoc = await reqRef.get();
  if (!reqDoc.exists) throw new HttpsError("not-found", "충전 요청을 찾을 수 없습니다.");

  const reqData = reqDoc.data()!;
  if (reqData.status !== "pending") throw new HttpsError("failed-precondition", "이미 처리된 요청입니다.");

  const userRef = db.collection("users").doc(reqData.userId);

  await db.runTransaction(async (tx) => {
    const userDoc = await tx.get(userRef);
    const currentPoints = userDoc.exists ? (userDoc.data()!.points || 0) : 0;

    tx.update(userRef, {
      points: currentPoints + reqData.amount,
    });

    tx.update(reqRef, {
      status: "approved",
      approvedBy: uid,
      approvedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    tx.create(db.collection("transactions").doc(), {
      userId: reqData.userId,
      type: "charge",
      amount: reqData.amount,
      balanceAfter: currentPoints + reqData.amount,
      balanceType: "points",
      description: `포인트 충전 (계좌이체)`,
      status: "completed",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  await writeAdminLog(uid, "approve_charge", { requestId, userId: reqData.userId, amount: reqData.amount });

  return { success: true };
});

// 충전 거절 (관리자)
export const rejectChargeRequest = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  await verifyAdmin(uid);

  const { requestId, reason } = request.data;
  if (!requestId) throw new HttpsError("invalid-argument", "요청 ID가 누락되었습니다.");

  const reqRef = db.collection("charge_requests").doc(requestId);
  const reqDoc = await reqRef.get();
  if (!reqDoc.exists) throw new HttpsError("not-found", "충전 요청을 찾을 수 없습니다.");
  if (reqDoc.data()!.status !== "pending") throw new HttpsError("failed-precondition", "이미 처리된 요청입니다.");

  await reqRef.update({
    status: "rejected",
    rejectedBy: uid,
    rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
    rejectReason: reason || "",
  });

  await writeAdminLog(uid, "reject_charge", { requestId, userId: reqDoc.data()!.userId, amount: reqDoc.data()!.amount, reason });

  return { success: true };
});

// ============================================================
// 자료 요청 (이 자료가 필요해요)
// ============================================================

// 자료 요청 등록
export const submitMaterialRequest = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");

  const { subject, professor, description } = request.data;
  if (!subject || !subject.trim()) throw new HttpsError("invalid-argument", "과목명을 입력해주세요.");

  const userDoc = await db.collection("users").doc(uid).get();
  const nickname = userDoc.data()?.nickname || userDoc.data()?.displayName || "익명";

  await db.collection("material_requests").add({
    userId: uid,
    nickname,
    subject: subject.trim(),
    professor: professor?.trim() || "",
    description: description?.trim() || "",
    needCount: 1,
    needUsers: [uid],
    status: "open",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true };
});

// "저도 필요해요" 토글
export const toggleNeedRequest = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");

  const { requestId } = request.data;
  if (!requestId) throw new HttpsError("invalid-argument", "요청 ID가 누락되었습니다.");

  const reqRef = db.collection("material_requests").doc(requestId);
  const reqDoc = await reqRef.get();
  if (!reqDoc.exists) throw new HttpsError("not-found", "요청을 찾을 수 없습니다.");

  const data = reqDoc.data()!;
  const needUsers: string[] = data.needUsers || [];

  if (needUsers.includes(uid)) {
    // 이미 눌렀으면 취소
    await reqRef.update({
      needUsers: admin.firestore.FieldValue.arrayRemove(uid),
      needCount: admin.firestore.FieldValue.increment(-1),
    });
    return { success: true, added: false };
  } else {
    await reqRef.update({
      needUsers: admin.firestore.FieldValue.arrayUnion(uid),
      needCount: admin.firestore.FieldValue.increment(1),
    });
    return { success: true, added: true };
  }
});

// 자료 업로드 시 매칭되는 요청이 있으면 알림 저장
export const onMaterialCreated = onDocumentCreated("materials/{materialId}", async (event) => {
  const snap = event.data;
  if (!snap) return;

  const material = snap.data();
  const subject = (material.subject || "").toLowerCase().trim();
  if (!subject) return;

  // 매칭되는 open 요청 찾기
  const requestsSnap = await db.collection("material_requests")
    .where("status", "==", "open")
    .get();

  for (const reqDoc of requestsSnap.docs) {
    const reqData = reqDoc.data();
    const reqSubject = (reqData.subject || "").toLowerCase().trim();

    if (subject.includes(reqSubject) || reqSubject.includes(subject)) {
      const needUsers: string[] = reqData.needUsers || [];

      // 각 사용자에게 알림 생성 + 알림톡 발송
      const batch = db.batch();
      for (const userId of needUsers) {
        const notifRef = db.collection("notifications").doc();
        batch.set(notifRef, {
          userId,
          type: "material_available",
          title: "요청하신 자료가 등록되었어요!",
          message: `"${reqData.subject}" 관련 자료가 새로 올라왔습니다.`,
          materialId: snap.id,
          materialTitle: material.title || "",
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // 알리고 알림톡 발송 (자료등록)
        if (ALIGO_API_KEY && ALIGO_SENDER_KEY) {
          try {
            const userDoc = await db.collection("users").doc(userId).get();
            const userData = userDoc.data();
            const userPhone = userData?.verifiedPhone;
            const userName = userData?.displayName || "회원";
            if (userPhone) {
              const formData = new URLSearchParams();
              formData.append("apikey", ALIGO_API_KEY);
              formData.append("userid", ALIGO_USER_ID);
              formData.append("senderkey", ALIGO_SENDER_KEY);
              formData.append("tpl_code", "UG_8790");
              formData.append("sender", ALIGO_SENDER_NUMBER);
              formData.append("receiver_1", userPhone);
              formData.append("subject_1", "자료등록");
              formData.append("message_1", `관심과목 자료 등록\n\n${reqData.subject}\n\n${userName}님이 요청한 ${reqData.subject} 과목의 자료가 등록되었어요. 유니파일에서 확인해보세요!`);
              await axios.post(
                "https://kakaoapi.aligo.in/akv10/alimtalk/send/",
                formData.toString(),
                { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
              );
            }
          } catch (err: any) {
            console.error("알리고 자료등록 알림톡 오류:", err?.response?.data || err.message);
          }
        }
      }
      await batch.commit();

      // 요청 상태를 fulfilled로 변경
      await reqDoc.ref.update({ status: "fulfilled", fulfilledMaterialId: snap.id });
    }
  }
});
