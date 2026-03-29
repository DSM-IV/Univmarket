import * as admin from "firebase-admin";
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import axios from "axios";
import cors from "cors";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

admin.initializeApp();
const db = admin.firestore();

const KAKAOPAY_CID = "TC0ONETIME"; // 테스트용 CID
const KAKAOPAY_SECRET_KEY = process.env.KAKAOPAY_SECRET_KEY || "";
const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY || "";
const FRONTEND_URL = process.env.FRONTEND_URL || "https://localhost:5173";

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

  const { displayName, email, university } = request.data;

  const userRef = db.collection("users").doc(uid);
  const existing = await userRef.get();
  if (existing.exists) return { success: true };

  await userRef.set({
    displayName: displayName || "",
    email: email || "",
    university: university || "",
    points: 0,
    totalEarned: 0,
    totalSpent: 0,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true };
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

// R2 다운로드 presigned URL 생성 (구매한 유저만)
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

  if (purchases.empty) {
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

  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: fileKey,
    ResponseContentDisposition: `attachment; filename="${encodeURIComponent(fileName)}"`,
  });

  const downloadUrl = await getSignedUrl(r2, command, { expiresIn: 300 }); // 5분

  return { downloadUrl };
});

// 카카오페이 결제 준비
export const kakaopayReady = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");

  const { amount } = request.data;
  if (!amount || amount < 1000) {
    throw new HttpsError("invalid-argument", "최소 충전 금액은 1,000원입니다.");
  }

  const sessionId = db.collection("kakaopay_sessions").doc().id;

  const response = await axios.post(
    "https://open-api.kakaopay.com/online/v1/payment/ready",
    {
      cid: KAKAOPAY_CID,
      partner_order_id: sessionId,
      partner_user_id: uid,
      item_name: `UniVmarket 포인트 ${amount.toLocaleString()}P`,
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
const ALLOWED_ORIGINS = [FRONTEND_URL, "https://dsm-iv.github.io"];
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
  if (!amount || amount < 1000) {
    throw new HttpsError("invalid-argument", "최소 충전 금액은 1,000원입니다.");
  }

  const orderId = `univmarket_${uid}_${Date.now()}`;

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
  if (session.userId !== uid || session.amount !== amount) {
    throw new HttpsError("permission-denied", "결제 정보가 일치하지 않습니다.");
  }

  // 토스페이먼츠 결제 승인 API 호출
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

    if (!buyerDoc.exists) {
      throw new HttpsError("not-found", "사용자 정보를 찾을 수 없습니다.");
    }

    const buyerPoints = buyerDoc.data()!.points || 0;
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

    // 구매자 포인트 차감
    tx.update(buyerRef, {
      points: buyerNewPoints,
      totalSpent: admin.firestore.FieldValue.increment(price),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 판매자 포인트 지급
    tx.set(
      sellerRef,
      {
        points: admin.firestore.FieldValue.increment(price),
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
      description: `"${materialTitle}" 구매`,
      relatedMaterialId: materialId,
      relatedUserId: sellerId,
      status: "completed",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 판매자 거래 내역
    tx.create(db.collection("transactions").doc(), {
      userId: sellerId,
      type: "sale",
      amount: price,
      balanceAfter: -1, // 판매자 잔액은 별도 조회 필요
      description: `"${materialTitle}" 판매`,
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
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  return { success: true };
});
