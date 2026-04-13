/**
 * Firestore → PostgreSQL Migration Script
 *
 * Reads all data from Firestore collections and generates a .sql file
 * with INSERT statements in correct dependency order.
 *
 * Usage:
 *   npx ts-node --project ../functions/tsconfig.json migrate-to-postgres.ts > migration.sql
 *
 * Requires:
 *   - GOOGLE_APPLICATION_CREDENTIALS env var pointing to a service account JSON
 *   - firebase-admin (already in functions/package.json)
 */

import * as admin from "firebase-admin";

// ---------------------------------------------------------------------------
// Init Firebase Admin
// ---------------------------------------------------------------------------

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});
const db = admin.firestore();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a Firestore Timestamp (or Date, or null) to a PostgreSQL timestamp literal */
function toTimestamp(val: unknown): string {
  if (!val) return "NULL";
  if (typeof val === "string") {
    // Already an ISO string
    return `'${val}'`;
  }
  if (val instanceof admin.firestore.Timestamp) {
    return `'${val.toDate().toISOString()}'`;
  }
  if (val instanceof Date) {
    return `'${val.toISOString()}'`;
  }
  // Firestore sometimes stores { _seconds, _nanoseconds } plain objects
  if (typeof val === "object" && val !== null && "_seconds" in val) {
    const obj = val as { _seconds: number; _nanoseconds: number };
    const d = new Date(obj._seconds * 1000 + obj._nanoseconds / 1e6);
    return `'${d.toISOString()}'`;
  }
  return "NULL";
}

/** Escape a string for safe inclusion in a SQL literal */
function esc(val: unknown): string {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
  if (typeof val === "number") {
    if (!Number.isFinite(val)) return "NULL";
    return String(val);
  }
  if (typeof val === "object") {
    // Arrays and objects → store as JSONB
    return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
  }
  // String
  return `'${String(val).replace(/'/g, "''")}'`;
}

/** Read every document from a Firestore collection (handles >10k docs) */
async function readAll(collectionName: string): Promise<admin.firestore.QueryDocumentSnapshot[]> {
  const docs: admin.firestore.QueryDocumentSnapshot[] = [];
  let lastDoc: admin.firestore.QueryDocumentSnapshot | undefined;
  const PAGE = 5000;

  while (true) {
    let q: admin.firestore.Query = db.collection(collectionName).orderBy("__name__").limit(PAGE);
    if (lastDoc) {
      q = q.startAfter(lastDoc);
    }
    const snap = await q.get();
    if (snap.empty) break;
    docs.push(...snap.docs);
    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < PAGE) break;
  }

  return docs;
}

// ---------------------------------------------------------------------------
// SQL generation per collection
// ---------------------------------------------------------------------------

function generateUsersSQL(
  docs: admin.firestore.QueryDocumentSnapshot[],
  idMap: Map<string, number>
): string[] {
  const lines: string[] = [];
  let seq = 1;

  for (const doc of docs) {
    const d = doc.data();
    const id = seq++;
    idMap.set(doc.id, id); // firebase_uid → sequential id

    lines.push(
      `INSERT INTO users (id, firebase_uid, display_name, nickname, email, university, points, earnings, pending_earnings, total_earned, total_spent, role, identity_verified, verified_phone, identity_verified_at, banned, banned_at, banned_by, ban_reason, suspended, suspended_at, suspended_until, suspended_by, suspend_reason, created_at, updated_at) VALUES (` +
        `${id}, ` +
        `${esc(doc.id)}, ` +
        `${esc(d.displayName || "")}, ` +
        `${esc(d.nickname || "")}, ` +
        `${esc(d.email || "")}, ` +
        `${esc(d.university || "")}, ` +
        `${d.points ?? 0}, ` +
        `${d.earnings ?? 0}, ` +
        `${d.pendingEarnings ?? 0}, ` +
        `${d.totalEarned ?? 0}, ` +
        `${d.totalSpent ?? 0}, ` +
        `${esc(d.role || "user")}, ` +
        `${esc(d.identityVerified ?? false)}, ` +
        `${esc(d.verifiedPhone || "")}, ` +
        `${toTimestamp(d.identityVerifiedAt)}, ` +
        `${esc(d.banned ?? false)}, ` +
        `${toTimestamp(d.bannedAt)}, ` +
        `${esc(d.bannedBy || null)}, ` +
        `${esc(d.banReason || null)}, ` +
        `${esc(d.suspended ?? false)}, ` +
        `${toTimestamp(d.suspendedAt)}, ` +
        `${toTimestamp(d.suspendedUntil)}, ` +
        `${esc(d.suspendedBy || null)}, ` +
        `${esc(d.suspendReason || null)}, ` +
        `${toTimestamp(d.createdAt)}, ` +
        `${toTimestamp(d.updatedAt)}` +
        `);`
    );
  }
  return lines;
}

function generateMaterialsSQL(
  docs: admin.firestore.QueryDocumentSnapshot[],
  userIdMap: Map<string, number>,
  materialIdMap: Map<string, number>
): string[] {
  const lines: string[] = [];
  let seq = 1;

  for (const doc of docs) {
    const d = doc.data();
    const id = seq++;
    materialIdMap.set(doc.id, id);

    const authorPgId = d.authorId ? userIdMap.get(d.authorId) ?? null : null;

    lines.push(
      `INSERT INTO materials (id, firestore_id, author_id, author_firebase_uid, author_name, title, description, category, department, semester, subject, professor, price, file_type, pages, file_url, file_key, file_name, file_size, file_urls, file_keys, file_names, file_sizes, file_types, file_count, thumbnail, preview_images, rating, review_count, sales_count, scan_status, hidden, grade_image, grade_claim, grade_status, created_at) VALUES (` +
        `${id}, ` +
        `${esc(doc.id)}, ` +
        `${authorPgId !== null ? authorPgId : "NULL"}, ` +
        `${esc(d.authorId || null)}, ` +
        `${esc(d.author || "")}, ` +
        `${esc(d.title || "")}, ` +
        `${esc(d.description || "")}, ` +
        `${esc(d.category || "")}, ` +
        `${esc(d.department || "")}, ` +
        `${esc(d.semester || "")}, ` +
        `${esc(d.subject || "")}, ` +
        `${esc(d.professor || "")}, ` +
        `${d.price ?? 0}, ` +
        `${esc(d.fileType || "")}, ` +
        `${d.pages ?? 0}, ` +
        `${esc(d.fileUrl || "")}, ` +
        `${esc(d.fileKey || "")}, ` +
        `${esc(d.fileName || "")}, ` +
        `${d.fileSize ?? 0}, ` +
        `${esc(d.fileUrls || [])}, ` +
        `${esc(d.fileKeys || [])}, ` +
        `${esc(d.fileNames || [])}, ` +
        `${esc(d.fileSizes || [])}, ` +
        `${esc(d.fileTypes || [])}, ` +
        `${d.fileCount ?? 1}, ` +
        `${esc(d.thumbnail || "")}, ` +
        `${esc(d.previewImages || [])}, ` +
        `${d.rating ?? 0}, ` +
        `${d.reviewCount ?? 0}, ` +
        `${d.salesCount ?? 0}, ` +
        `${esc(d.scanStatus || "")}, ` +
        `${esc(d.hidden ?? false)}, ` +
        `${esc(d.gradeImage || null)}, ` +
        `${esc(d.gradeClaim || null)}, ` +
        `${esc(d.gradeStatus || null)}, ` +
        `${toTimestamp(d.createdAt)}` +
        `);`
    );
  }
  return lines;
}

function generatePurchasesSQL(
  docs: admin.firestore.QueryDocumentSnapshot[],
  userIdMap: Map<string, number>,
  materialIdMap: Map<string, number>
): string[] {
  const lines: string[] = [];
  let seq = 1;

  for (const doc of docs) {
    const d = doc.data();
    const id = seq++;

    const buyerPgId = d.buyerId ? userIdMap.get(d.buyerId) ?? null : null;
    const sellerPgId = d.sellerId ? userIdMap.get(d.sellerId) ?? null : null;
    const materialPgId = d.materialId ? materialIdMap.get(d.materialId) ?? null : null;

    lines.push(
      `INSERT INTO purchases (id, firestore_id, buyer_id, buyer_firebase_uid, seller_id, seller_firebase_uid, material_id, material_firestore_id, price, settled, refunded, created_at) VALUES (` +
        `${id}, ` +
        `${esc(doc.id)}, ` +
        `${buyerPgId !== null ? buyerPgId : "NULL"}, ` +
        `${esc(d.buyerId || null)}, ` +
        `${sellerPgId !== null ? sellerPgId : "NULL"}, ` +
        `${esc(d.sellerId || null)}, ` +
        `${materialPgId !== null ? materialPgId : "NULL"}, ` +
        `${esc(d.materialId || null)}, ` +
        `${d.price ?? 0}, ` +
        `${esc(d.settled ?? null)}, ` +
        `${esc(d.refunded ?? false)}, ` +
        `${toTimestamp(d.createdAt)}` +
        `);`
    );
  }
  return lines;
}

function generateTransactionsSQL(
  docs: admin.firestore.QueryDocumentSnapshot[],
  userIdMap: Map<string, number>,
  materialIdMap: Map<string, number>
): string[] {
  const lines: string[] = [];
  let seq = 1;

  for (const doc of docs) {
    const d = doc.data();
    const id = seq++;

    const userPgId = d.userId ? userIdMap.get(d.userId) ?? null : null;
    const relatedUserPgId = d.relatedUserId ? userIdMap.get(d.relatedUserId) ?? null : null;
    const relatedMaterialPgId = d.relatedMaterialId ? materialIdMap.get(d.relatedMaterialId) ?? null : null;

    lines.push(
      `INSERT INTO transactions (id, firestore_id, user_id, user_firebase_uid, type, amount, fee, commission, tax, total_deduction, received, balance_after, balance_type, description, related_material_id, related_user_id, bank_name, account_number, account_holder, status, granted_by, rejected_by, rejected_at, reject_reason, created_at) VALUES (` +
        `${id}, ` +
        `${esc(doc.id)}, ` +
        `${userPgId !== null ? userPgId : "NULL"}, ` +
        `${esc(d.userId || null)}, ` +
        `${esc(d.type || "")}, ` +
        `${d.amount ?? 0}, ` +
        `${d.fee ?? "NULL"}, ` +
        `${d.commission ?? "NULL"}, ` +
        `${d.tax ?? "NULL"}, ` +
        `${d.totalDeduction ?? "NULL"}, ` +
        `${d.received ?? "NULL"}, ` +
        `${d.balanceAfter ?? 0}, ` +
        `${esc(d.balanceType || "points")}, ` +
        `${esc(d.description || "")}, ` +
        `${relatedMaterialPgId !== null ? relatedMaterialPgId : "NULL"}, ` +
        `${relatedUserPgId !== null ? relatedUserPgId : "NULL"}, ` +
        `${esc(d.bankName || null)}, ` +
        `${esc(d.accountNumber || null)}, ` +
        `${esc(d.accountHolder || null)}, ` +
        `${esc(d.status || "completed")}, ` +
        `${esc(d.grantedBy || null)}, ` +
        `${esc(d.rejectedBy || null)}, ` +
        `${toTimestamp(d.rejectedAt)}, ` +
        `${esc(d.rejectReason || null)}, ` +
        `${toTimestamp(d.createdAt)}` +
        `);`
    );
  }
  return lines;
}

function generateReviewsSQL(
  docs: admin.firestore.QueryDocumentSnapshot[],
  userIdMap: Map<string, number>,
  materialIdMap: Map<string, number>
): string[] {
  const lines: string[] = [];
  let seq = 1;

  for (const doc of docs) {
    const d = doc.data();
    const id = seq++;

    const userPgId = d.userId ? userIdMap.get(d.userId) ?? null : null;
    const materialPgId = d.materialId ? materialIdMap.get(d.materialId) ?? null : null;

    lines.push(
      `INSERT INTO reviews (id, firestore_id, user_id, user_firebase_uid, user_name, material_id, material_firestore_id, rating, content, created_at) VALUES (` +
        `${id}, ` +
        `${esc(doc.id)}, ` +
        `${userPgId !== null ? userPgId : "NULL"}, ` +
        `${esc(d.userId || null)}, ` +
        `${esc(d.userName || "")}, ` +
        `${materialPgId !== null ? materialPgId : "NULL"}, ` +
        `${esc(d.materialId || null)}, ` +
        `${d.rating ?? 0}, ` +
        `${esc(d.content || "")}, ` +
        `${toTimestamp(d.createdAt)}` +
        `);`
    );
  }
  return lines;
}

function generateReportsSQL(
  docs: admin.firestore.QueryDocumentSnapshot[],
  userIdMap: Map<string, number>,
  materialIdMap: Map<string, number>
): string[] {
  const lines: string[] = [];
  let seq = 1;

  for (const doc of docs) {
    const d = doc.data();
    const id = seq++;

    const reporterPgId = d.reporterId ? userIdMap.get(d.reporterId) ?? null : null;
    const materialPgId = d.materialId ? materialIdMap.get(d.materialId) ?? null : null;

    lines.push(
      `INSERT INTO reports (id, firestore_id, material_id, material_firestore_id, material_title, type, reason, original_source, description, contact_email, is_rights_holder, reporter_id, reporter_firebase_uid, reporter_name, purchase_id, status, created_at) VALUES (` +
        `${id}, ` +
        `${esc(doc.id)}, ` +
        `${materialPgId !== null ? materialPgId : "NULL"}, ` +
        `${esc(d.materialId || null)}, ` +
        `${esc(d.materialTitle || "")}, ` +
        `${esc(d.type || "copyright")}, ` +
        `${esc(d.reason || "")}, ` +
        `${esc(d.originalSource || "")}, ` +
        `${esc(d.description || "")}, ` +
        `${esc(d.contactEmail || "")}, ` +
        `${esc(d.isRightsHolder ?? false)}, ` +
        `${reporterPgId !== null ? reporterPgId : "NULL"}, ` +
        `${esc(d.reporterId || null)}, ` +
        `${esc(d.reporterName || "")}, ` +
        `${esc(d.purchaseId || null)}, ` +
        `${esc(d.status || "pending")}, ` +
        `${toTimestamp(d.createdAt)}` +
        `);`
    );
  }
  return lines;
}

function generateNotificationsSQL(
  docs: admin.firestore.QueryDocumentSnapshot[],
  userIdMap: Map<string, number>,
  materialIdMap: Map<string, number>
): string[] {
  const lines: string[] = [];
  let seq = 1;

  for (const doc of docs) {
    const d = doc.data();
    const id = seq++;

    const userPgId = d.userId ? userIdMap.get(d.userId) ?? null : null;
    const materialPgId = d.materialId ? materialIdMap.get(d.materialId) ?? null : null;

    lines.push(
      `INSERT INTO notifications (id, firestore_id, user_id, user_firebase_uid, type, title, message, material_id, material_firestore_id, material_title, read, created_at) VALUES (` +
        `${id}, ` +
        `${esc(doc.id)}, ` +
        `${userPgId !== null ? userPgId : "NULL"}, ` +
        `${esc(d.userId || null)}, ` +
        `${esc(d.type || "")}, ` +
        `${esc(d.title || "")}, ` +
        `${esc(d.message || "")}, ` +
        `${materialPgId !== null ? materialPgId : "NULL"}, ` +
        `${esc(d.materialId || null)}, ` +
        `${esc(d.materialTitle || "")}, ` +
        `${esc(d.read ?? false)}, ` +
        `${toTimestamp(d.createdAt)}` +
        `);`
    );
  }
  return lines;
}

function generateWithdrawSecretsSQL(
  docs: admin.firestore.QueryDocumentSnapshot[],
  userIdMap: Map<string, number>
): string[] {
  const lines: string[] = [];
  let seq = 1;

  for (const doc of docs) {
    const d = doc.data();
    const id = seq++;

    const userPgId = d.userId ? userIdMap.get(d.userId) ?? null : null;

    lines.push(
      `INSERT INTO withdraw_secrets (id, firestore_id, transaction_firestore_id, user_id, user_firebase_uid, bank_name, account_number, account_holder, created_at) VALUES (` +
        `${id}, ` +
        `${esc(doc.id)}, ` +
        `${esc(doc.id)}, ` + // doc.id matches the transaction doc id
        `${userPgId !== null ? userPgId : "NULL"}, ` +
        `${esc(d.userId || null)}, ` +
        `${esc(d.bankName || "")}, ` +
        `${esc(d.accountNumber || "")}, ` +
        `${esc(d.accountHolder || "")}, ` +
        `${toTimestamp(d.createdAt)}` +
        `);`
    );
  }
  return lines;
}

function generateAdminLogsSQL(
  docs: admin.firestore.QueryDocumentSnapshot[],
  userIdMap: Map<string, number>
): string[] {
  const lines: string[] = [];
  let seq = 1;

  for (const doc of docs) {
    const d = doc.data();
    const id = seq++;

    const adminPgId = d.adminUid ? userIdMap.get(d.adminUid) ?? null : null;

    lines.push(
      `INSERT INTO admin_logs (id, firestore_id, admin_id, admin_firebase_uid, action, details, created_at) VALUES (` +
        `${id}, ` +
        `${esc(doc.id)}, ` +
        `${adminPgId !== null ? adminPgId : "NULL"}, ` +
        `${esc(d.adminUid || null)}, ` +
        `${esc(d.action || "")}, ` +
        `${esc(d.details || {})}, ` +
        `${toTimestamp(d.createdAt)}` +
        `);`
    );
  }
  return lines;
}

function generateCartsSQL(
  docs: admin.firestore.QueryDocumentSnapshot[],
  userIdMap: Map<string, number>,
  materialIdMap: Map<string, number>
): string[] {
  const lines: string[] = [];
  let seq = 1;

  for (const doc of docs) {
    const d = doc.data();
    const id = seq++;

    const userPgId = d.userId ? userIdMap.get(d.userId) ?? null : null;
    const materialPgId = d.materialId ? materialIdMap.get(d.materialId) ?? null : null;

    lines.push(
      `INSERT INTO carts (id, firestore_id, user_id, user_firebase_uid, material_id, material_firestore_id, title, price, author, category, thumbnail, added_at) VALUES (` +
        `${id}, ` +
        `${esc(doc.id)}, ` +
        `${userPgId !== null ? userPgId : "NULL"}, ` +
        `${esc(d.userId || null)}, ` +
        `${materialPgId !== null ? materialPgId : "NULL"}, ` +
        `${esc(d.materialId || null)}, ` +
        `${esc(d.title || "")}, ` +
        `${d.price ?? 0}, ` +
        `${esc(d.author || "")}, ` +
        `${esc(d.category || "")}, ` +
        `${esc(d.thumbnail || "")}, ` +
        `${toTimestamp(d.addedAt)}` +
        `);`
    );
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const out: string[] = [];

  out.push("-- ============================================================");
  out.push("-- Firestore → PostgreSQL Migration");
  out.push(`-- Generated at: ${new Date().toISOString()}`);
  out.push("-- ============================================================");
  out.push("");
  out.push("BEGIN;");
  out.push("");

  // ID maps: Firestore doc id → PostgreSQL sequential id
  const userIdMap = new Map<string, number>();
  const materialIdMap = new Map<string, number>();

  // ---- Read all collections ----
  console.error("[migrate] Reading Firestore collections...");

  console.error("[migrate]   users...");
  const usersDocs = await readAll("users");
  console.error(`[migrate]     → ${usersDocs.length} docs`);

  console.error("[migrate]   materials...");
  const materialsDocs = await readAll("materials");
  console.error(`[migrate]     → ${materialsDocs.length} docs`);

  console.error("[migrate]   purchases...");
  const purchasesDocs = await readAll("purchases");
  console.error(`[migrate]     → ${purchasesDocs.length} docs`);

  console.error("[migrate]   transactions...");
  const transactionsDocs = await readAll("transactions");
  console.error(`[migrate]     → ${transactionsDocs.length} docs`);

  console.error("[migrate]   reviews...");
  const reviewsDocs = await readAll("reviews");
  console.error(`[migrate]     → ${reviewsDocs.length} docs`);

  console.error("[migrate]   reports...");
  const reportsDocs = await readAll("reports");
  console.error(`[migrate]     → ${reportsDocs.length} docs`);

  console.error("[migrate]   notifications...");
  const notificationsDocs = await readAll("notifications");
  console.error(`[migrate]     → ${notificationsDocs.length} docs`);

  console.error("[migrate]   withdraw_secrets...");
  const withdrawSecretsDocs = await readAll("withdraw_secrets");
  console.error(`[migrate]     → ${withdrawSecretsDocs.length} docs`);

  console.error("[migrate]   admin_logs...");
  const adminLogsDocs = await readAll("admin_logs");
  console.error(`[migrate]     → ${adminLogsDocs.length} docs`);

  console.error("[migrate]   carts...");
  const cartsDocs = await readAll("carts");
  console.error(`[migrate]     → ${cartsDocs.length} docs`);

  // ---- Generate SQL in dependency order ----

  console.error("[migrate] Generating SQL...");

  // 1. Users (no dependencies)
  out.push("-- ---- users ----");
  out.push(...generateUsersSQL(usersDocs, userIdMap));
  out.push(`SELECT setval('users_id_seq', ${userIdMap.size || 1});`);
  out.push("");

  // 2. Materials (depends on users)
  out.push("-- ---- materials ----");
  out.push(...generateMaterialsSQL(materialsDocs, userIdMap, materialIdMap));
  out.push(`SELECT setval('materials_id_seq', ${materialIdMap.size || 1});`);
  out.push("");

  // 3. Purchases (depends on users + materials)
  out.push("-- ---- purchases ----");
  const purchaseLines = generatePurchasesSQL(purchasesDocs, userIdMap, materialIdMap);
  out.push(...purchaseLines);
  out.push(`SELECT setval('purchases_id_seq', ${purchasesDocs.length || 1});`);
  out.push("");

  // 4. Transactions (depends on users + materials)
  out.push("-- ---- transactions ----");
  const txLines = generateTransactionsSQL(transactionsDocs, userIdMap, materialIdMap);
  out.push(...txLines);
  out.push(`SELECT setval('transactions_id_seq', ${transactionsDocs.length || 1});`);
  out.push("");

  // 5. Reviews (depends on users + materials)
  out.push("-- ---- reviews ----");
  out.push(...generateReviewsSQL(reviewsDocs, userIdMap, materialIdMap));
  out.push(`SELECT setval('reviews_id_seq', ${reviewsDocs.length || 1});`);
  out.push("");

  // 6. Reports (depends on users + materials)
  out.push("-- ---- reports ----");
  out.push(...generateReportsSQL(reportsDocs, userIdMap, materialIdMap));
  out.push(`SELECT setval('reports_id_seq', ${reportsDocs.length || 1});`);
  out.push("");

  // 7. Notifications (depends on users + materials)
  out.push("-- ---- notifications ----");
  out.push(...generateNotificationsSQL(notificationsDocs, userIdMap, materialIdMap));
  out.push(`SELECT setval('notifications_id_seq', ${notificationsDocs.length || 1});`);
  out.push("");

  // 8. Withdraw secrets (depends on users)
  out.push("-- ---- withdraw_secrets ----");
  out.push(...generateWithdrawSecretsSQL(withdrawSecretsDocs, userIdMap));
  out.push(`SELECT setval('withdraw_secrets_id_seq', ${withdrawSecretsDocs.length || 1});`);
  out.push("");

  // 9. Admin logs (depends on users)
  out.push("-- ---- admin_logs ----");
  out.push(...generateAdminLogsSQL(adminLogsDocs, userIdMap));
  out.push(`SELECT setval('admin_logs_id_seq', ${adminLogsDocs.length || 1});`);
  out.push("");

  // 10. Carts (depends on users + materials)
  out.push("-- ---- carts ----");
  out.push(...generateCartsSQL(cartsDocs, userIdMap, materialIdMap));
  out.push(`SELECT setval('carts_id_seq', ${cartsDocs.length || 1});`);
  out.push("");

  out.push("COMMIT;");
  out.push("");

  // Print summary to stderr
  console.error("[migrate] Done!");
  console.error(`[migrate] Summary:`);
  console.error(`[migrate]   users:             ${usersDocs.length}`);
  console.error(`[migrate]   materials:         ${materialsDocs.length}`);
  console.error(`[migrate]   purchases:         ${purchasesDocs.length}`);
  console.error(`[migrate]   transactions:      ${transactionsDocs.length}`);
  console.error(`[migrate]   reviews:           ${reviewsDocs.length}`);
  console.error(`[migrate]   reports:           ${reportsDocs.length}`);
  console.error(`[migrate]   notifications:     ${notificationsDocs.length}`);
  console.error(`[migrate]   withdraw_secrets:  ${withdrawSecretsDocs.length}`);
  console.error(`[migrate]   admin_logs:        ${adminLogsDocs.length}`);
  console.error(`[migrate]   carts:             ${cartsDocs.length}`);

  // Output SQL to stdout
  process.stdout.write(out.join("\n") + "\n");

  // Clean shutdown
  await admin.app().delete();
}

main().catch((err) => {
  console.error("[migrate] FATAL:", err);
  process.exit(1);
});
