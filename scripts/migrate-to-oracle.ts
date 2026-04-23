/**
 * Firestore → Oracle Migration Script
 *
 * Reads all Firestore collections and writes to Oracle 23ai (univmarket schema)
 * via the oracledb thin driver (no Oracle Instant Client required).
 *
 * Usage (from project root):
 *   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json \
 *   DB_USERNAME=univmarket DB_PASSWORD=devpass \
 *   DB_CONNECT_STRING=localhost:1521/FREEPDB1 \
 *     npx ts-node --project functions/tsconfig.json scripts/migrate-to-oracle.ts
 *
 * Env vars:
 *   GOOGLE_APPLICATION_CREDENTIALS  Firebase service account JSON path
 *   DB_USERNAME                     Oracle user (default: univmarket)
 *   DB_PASSWORD                     Oracle password (default: devpass)
 *   DB_CONNECT_STRING               host:port/service (default: localhost:1521/FREEPDB1)
 *   MIGRATE_DRY_RUN                 If "1", read Firestore but don't write Oracle
 *   MIGRATE_KEEP_DATA               If "1", skip the WIPE step (append mode — danger)
 *
 * Idempotency:
 *   By default, all 15 target tables are wiped (DELETE in reverse FK order)
 *   before insert, so the script can be re-run safely for rehearsals.
 *
 * Tables migrated (15):
 *   users, materials, material_files, material_preview_images,
 *   purchases, transactions, withdraw_secrets, reviews, reports,
 *   notifications, admin_logs, cart, material_requests,
 *   raffle_entries, charge_requests
 *
 * Tables intentionally skipped (3):
 *   payment_sessions, verification_sessions  — TTL session data
 *   material_request_comments                — Spring-only feature, not in Firestore
 */

import * as admin from "firebase-admin";
import oracledb from "oracledb";

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});
const fdb = admin.firestore();

const DRY_RUN = process.env.MIGRATE_DRY_RUN === "1";
const KEEP_DATA = process.env.MIGRATE_KEEP_DATA === "1";

const ORACLE_CONFIG: oracledb.ConnectionAttributes = {
  user: process.env.DB_USERNAME || "univmarket",
  password: process.env.DB_PASSWORD || "devpass",
  connectString: process.env.DB_CONNECT_STRING || "localhost:1521/FREEPDB1",
};

oracledb.autoCommit = false;
oracledb.fetchAsString = [oracledb.CLOB];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type FirestoreDoc = admin.firestore.QueryDocumentSnapshot;

/** Convert any Firestore timestamp shape to a JS Date (or null). */
function toDate(val: unknown): Date | null {
  if (val == null) return null;
  if (val instanceof admin.firestore.Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  if (typeof val === "string") {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof val === "object" && val !== null && "_seconds" in val) {
    const o = val as { _seconds: number; _nanoseconds?: number };
    return new Date(o._seconds * 1000 + (o._nanoseconds ?? 0) / 1e6);
  }
  return null;
}

function str(val: unknown, max?: number): string | null {
  if (val == null) return null;
  const s = String(val);
  if (s === "") return null;
  if (max && s.length > max) return s.substring(0, max);
  return s;
}

function strDefault(val: unknown, dflt: string, max?: number): string {
  return str(val, max) ?? dflt;
}

function num(val: unknown): number {
  if (val == null) return 0;
  if (typeof val === "number" && Number.isFinite(val)) return Math.trunc(val);
  const n = Number(val);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function numOrNull(val: unknown): number | null {
  if (val == null) return null;
  if (typeof val === "number" && Number.isFinite(val)) return Math.trunc(val);
  const n = Number(val);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function bool(val: unknown): boolean {
  return val === true;
}

function jsonStr(val: unknown): string | null {
  if (val == null) return null;
  try {
    return JSON.stringify(val);
  } catch {
    return null;
  }
}

/** Read every document from a Firestore collection (handles >10k docs via pagination). */
async function readAll(name: string): Promise<FirestoreDoc[]> {
  const out: FirestoreDoc[] = [];
  let last: FirestoreDoc | undefined;
  const PAGE = 5000;
  while (true) {
    let q: admin.firestore.Query = fdb.collection(name).orderBy("__name__").limit(PAGE);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;
    out.push(...snap.docs);
    last = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < PAGE) break;
  }
  return out;
}

/** executeMany helper with logging + batching. */
async function bulkInsert(
  conn: oracledb.Connection,
  table: string,
  sql: string,
  rows: Record<string, unknown>[],
  bindDefs: Record<string, oracledb.BindParameter>
): Promise<void> {
  if (rows.length === 0) {
    console.error(`[oracle]   ${table}: 0 rows`);
    return;
  }
  if (DRY_RUN) {
    console.error(`[oracle]   ${table}: ${rows.length} rows (DRY RUN — skipping insert)`);
    return;
  }
  const BATCH = 500;
  let written = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    await conn.executeMany(sql, slice, { bindDefs, autoCommit: false });
    written += slice.length;
  }
  console.error(`[oracle]   ${table}: ${written} rows`);
}

// ---------------------------------------------------------------------------
// WIPE — reverse FK order
// ---------------------------------------------------------------------------

const WIPE_ORDER = [
  "cart",
  "charge_requests",
  "raffle_entries",
  "material_request_comments",
  "material_requests",
  "notifications",
  "withdraw_secrets",
  "reports",
  "reviews",
  "transactions",
  "purchases",
  "material_preview_images",
  "material_files",
  "materials",
  "admin_logs",
  "users",
];

async function wipe(conn: oracledb.Connection): Promise<void> {
  if (KEEP_DATA) {
    console.error("[oracle] WIPE skipped (MIGRATE_KEEP_DATA=1)");
    return;
  }
  if (DRY_RUN) {
    console.error("[oracle] WIPE skipped (MIGRATE_DRY_RUN=1)");
    return;
  }
  console.error("[oracle] Wiping target tables (reverse FK order)...");
  for (const t of WIPE_ORDER) {
    const r = await conn.execute(`DELETE FROM ${t}`);
    console.error(`[oracle]   ${t}: ${r.rowsAffected ?? 0} rows deleted`);
  }
  await conn.commit();
}

// ---------------------------------------------------------------------------
// IDENTITY restart — after explicit-id inserts
// ---------------------------------------------------------------------------

async function restartIdentity(conn: oracledb.Connection, table: string): Promise<void> {
  if (DRY_RUN) return;
  const res = await conn.execute<{ MAX_ID: number | null }>(
    `SELECT MAX(id) AS MAX_ID FROM ${table}`,
    [],
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  );
  const max = res.rows?.[0]?.MAX_ID ?? 0;
  const next = (max ?? 0) + 1;
  await conn.execute(
    `ALTER TABLE ${table} MODIFY (id GENERATED BY DEFAULT AS IDENTITY (START WITH ${next}))`
  );
  console.error(`[oracle]   ${table}: identity restarted at ${next}`);
}

// ---------------------------------------------------------------------------
// Insert: users
// ---------------------------------------------------------------------------

const USERS_SQL = `
INSERT INTO users (
  id, firebase_uid, email, display_name, nickname, university,
  points, earnings, pending_earnings, total_earned, total_spent,
  role, identity_verified, identity_verified_at,
  verified_name, verified_phone, verified_birth,
  banned, banned_at, ban_reason,
  suspended, suspended_until, suspend_reason,
  created_at, updated_at
) VALUES (
  :id, :firebase_uid, :email, :display_name, :nickname, :university,
  :points, :earnings, :pending_earnings, :total_earned, :total_spent,
  :role, :identity_verified, :identity_verified_at,
  :verified_name, :verified_phone, :verified_birth,
  :banned, :banned_at, :ban_reason,
  :suspended, :suspended_until, :suspend_reason,
  :created_at, :updated_at
)`;

const USERS_BINDS: Record<string, oracledb.BindParameter> = {
  id: { type: oracledb.NUMBER },
  firebase_uid: { type: oracledb.STRING, maxSize: 128 },
  email: { type: oracledb.STRING, maxSize: 255 },
  display_name: { type: oracledb.STRING, maxSize: 100 },
  nickname: { type: oracledb.STRING, maxSize: 16 },
  university: { type: oracledb.STRING, maxSize: 50 },
  points: { type: oracledb.NUMBER },
  earnings: { type: oracledb.NUMBER },
  pending_earnings: { type: oracledb.NUMBER },
  total_earned: { type: oracledb.NUMBER },
  total_spent: { type: oracledb.NUMBER },
  role: { type: oracledb.STRING, maxSize: 10 },
  identity_verified: { type: oracledb.DB_TYPE_BOOLEAN },
  identity_verified_at: { type: oracledb.DATE },
  verified_name: { type: oracledb.STRING, maxSize: 50 },
  verified_phone: { type: oracledb.STRING, maxSize: 20 },
  verified_birth: { type: oracledb.STRING, maxSize: 6 },
  banned: { type: oracledb.DB_TYPE_BOOLEAN },
  banned_at: { type: oracledb.DATE },
  ban_reason: { type: oracledb.STRING, maxSize: 500 },
  suspended: { type: oracledb.DB_TYPE_BOOLEAN },
  suspended_until: { type: oracledb.DATE },
  suspend_reason: { type: oracledb.STRING, maxSize: 500 },
  created_at: { type: oracledb.DATE },
  updated_at: { type: oracledb.DATE },
};

async function insertUsers(
  conn: oracledb.Connection,
  docs: FirestoreDoc[],
  userIdMap: Map<string, number>
): Promise<void> {
  let seq = 0;
  const rows = docs.map((doc) => {
    const d = doc.data();
    const id = ++seq;
    userIdMap.set(doc.id, id);
    return {
      id,
      firebase_uid: doc.id,
      email: strDefault(d.email, `${doc.id}@firebase.local`, 255),
      display_name: str(d.displayName, 100),
      nickname: str(d.nickname, 16),
      university: str(d.university, 50),
      points: num(d.points),
      earnings: num(d.earnings),
      pending_earnings: num(d.pendingEarnings),
      total_earned: num(d.totalEarned),
      total_spent: num(d.totalSpent),
      role: strDefault(d.role, "user", 10),
      identity_verified: bool(d.identityVerified),
      identity_verified_at: toDate(d.identityVerifiedAt),
      verified_name: str(d.verifiedName, 50),
      verified_phone: str(d.verifiedPhone, 20),
      verified_birth: str(d.verifiedBirth, 6),
      banned: bool(d.banned),
      banned_at: toDate(d.bannedAt),
      ban_reason: str(d.banReason, 500),
      suspended: bool(d.suspended),
      suspended_until: toDate(d.suspendedUntil),
      suspend_reason: str(d.suspendReason, 500),
      created_at: toDate(d.createdAt) ?? new Date(),
      updated_at: toDate(d.updatedAt) ?? toDate(d.createdAt) ?? new Date(),
    };
  });
  await bulkInsert(conn, "users", USERS_SQL, rows, USERS_BINDS);
}

// ---------------------------------------------------------------------------
// Insert: materials (+ child denormalization)
// ---------------------------------------------------------------------------

const MATERIALS_SQL = `
INSERT INTO materials (
  id, author_id, title, description, price,
  subject, professor, category, department, semester,
  file_type, pages, file_count,
  file_key, file_url, file_name, file_size, content_type,
  thumbnail, sales_count, view_count,
  grade_image, grade_claim, grade_status, verified_grade,
  scan_status, hidden, copyright_deleted,
  created_at, updated_at
) VALUES (
  :id, :author_id, :title, :description, :price,
  :subject, :professor, :category, :department, :semester,
  :file_type, :pages, :file_count,
  :file_key, :file_url, :file_name, :file_size, :content_type,
  :thumbnail, :sales_count, :view_count,
  :grade_image, :grade_claim, :grade_status, :verified_grade,
  :scan_status, :hidden, :copyright_deleted,
  :created_at, :updated_at
)`;

const MATERIALS_BINDS: Record<string, oracledb.BindParameter> = {
  id: { type: oracledb.NUMBER },
  author_id: { type: oracledb.NUMBER },
  title: { type: oracledb.STRING, maxSize: 200 },
  description: { type: oracledb.CLOB },
  price: { type: oracledb.NUMBER },
  subject: { type: oracledb.STRING, maxSize: 50 },
  professor: { type: oracledb.STRING, maxSize: 50 },
  category: { type: oracledb.STRING, maxSize: 20 },
  department: { type: oracledb.STRING, maxSize: 50 },
  semester: { type: oracledb.STRING, maxSize: 20 },
  file_type: { type: oracledb.STRING, maxSize: 50 },
  pages: { type: oracledb.NUMBER },
  file_count: { type: oracledb.NUMBER },
  file_key: { type: oracledb.STRING, maxSize: 500 },
  file_url: { type: oracledb.STRING, maxSize: 1000 },
  file_name: { type: oracledb.STRING, maxSize: 200 },
  file_size: { type: oracledb.NUMBER },
  content_type: { type: oracledb.STRING, maxSize: 100 },
  thumbnail: { type: oracledb.STRING, maxSize: 1000 },
  sales_count: { type: oracledb.NUMBER },
  view_count: { type: oracledb.NUMBER },
  grade_image: { type: oracledb.STRING, maxSize: 1000 },
  grade_claim: { type: oracledb.STRING, maxSize: 10 },
  grade_status: { type: oracledb.STRING, maxSize: 20 },
  verified_grade: { type: oracledb.STRING, maxSize: 10 },
  scan_status: { type: oracledb.STRING, maxSize: 20 },
  hidden: { type: oracledb.DB_TYPE_BOOLEAN },
  copyright_deleted: { type: oracledb.DB_TYPE_BOOLEAN },
  created_at: { type: oracledb.DATE },
  updated_at: { type: oracledb.DATE },
};

const MATERIAL_FILES_SQL = `
INSERT INTO material_files (
  material_id, idx, file_url, file_key, file_name, file_size, file_type
) VALUES (
  :material_id, :idx, :file_url, :file_key, :file_name, :file_size, :file_type
)`;

const MATERIAL_FILES_BINDS: Record<string, oracledb.BindParameter> = {
  material_id: { type: oracledb.NUMBER },
  idx: { type: oracledb.NUMBER },
  file_url: { type: oracledb.STRING, maxSize: 1000 },
  file_key: { type: oracledb.STRING, maxSize: 500 },
  file_name: { type: oracledb.STRING, maxSize: 200 },
  file_size: { type: oracledb.NUMBER },
  file_type: { type: oracledb.STRING, maxSize: 50 },
};

const MATERIAL_PREVIEWS_SQL = `
INSERT INTO material_preview_images (material_id, idx, url)
VALUES (:material_id, :idx, :url)`;

const MATERIAL_PREVIEWS_BINDS: Record<string, oracledb.BindParameter> = {
  material_id: { type: oracledb.NUMBER },
  idx: { type: oracledb.NUMBER },
  url: { type: oracledb.STRING, maxSize: 1000 },
};

async function insertMaterials(
  conn: oracledb.Connection,
  docs: FirestoreDoc[],
  userIdMap: Map<string, number>,
  materialIdMap: Map<string, number>
): Promise<void> {
  let seq = 0;
  const matRows: Record<string, unknown>[] = [];
  const fileRows: Record<string, unknown>[] = [];
  const previewRows: Record<string, unknown>[] = [];
  let skipped = 0;

  for (const doc of docs) {
    const d = doc.data();
    const authorId = d.authorId ? userIdMap.get(d.authorId) : null;
    if (!authorId) {
      skipped++;
      continue; // FK-orphan; cannot insert without a valid author
    }
    const id = ++seq;
    materialIdMap.set(doc.id, id);

    matRows.push({
      id,
      author_id: authorId,
      title: strDefault(d.title, "(제목 없음)", 200),
      description: str(d.description) ?? "", // CLOB — empty string OK
      price: num(d.price),
      subject: str(d.subject, 50),
      professor: str(d.professor, 50),
      category: str(d.category, 20),
      department: str(d.department, 50),
      semester: str(d.semester, 20),
      file_type: str(d.fileType, 50),
      pages: num(d.pages),
      file_count: num(d.fileCount) || (Array.isArray(d.fileUrls) ? d.fileUrls.length : (d.fileUrl ? 1 : 0)),
      file_key: str(d.fileKey, 500),
      file_url: str(d.fileUrl, 1000),
      file_name: str(d.fileName, 200),
      file_size: numOrNull(d.fileSize),
      content_type: str(d.contentType, 100),
      thumbnail: str(d.thumbnail, 1000),
      sales_count: num(d.salesCount),
      view_count: num(d.viewCount),
      grade_image: str(d.gradeImage, 1000),
      grade_claim: str(d.gradeClaim, 10),
      grade_status: str(d.gradeStatus, 20),
      verified_grade: str(d.verifiedGrade, 10),
      scan_status: strDefault(d.scanStatus, "pending", 20),
      hidden: bool(d.hidden),
      copyright_deleted: bool(d.copyrightDeleted),
      created_at: toDate(d.createdAt) ?? new Date(),
      updated_at: toDate(d.updatedAt) ?? toDate(d.createdAt) ?? new Date(),
    });

    // Denormalize fileUrls/Keys/Names/Sizes/Types arrays → material_files rows
    const fUrls = Array.isArray(d.fileUrls) ? d.fileUrls : [];
    const fKeys = Array.isArray(d.fileKeys) ? d.fileKeys : [];
    const fNames = Array.isArray(d.fileNames) ? d.fileNames : [];
    const fSizes = Array.isArray(d.fileSizes) ? d.fileSizes : [];
    const fTypes = Array.isArray(d.fileTypes) ? d.fileTypes : [];
    const len = Math.max(fUrls.length, fKeys.length, fNames.length, fSizes.length, fTypes.length);
    for (let i = 0; i < len; i++) {
      fileRows.push({
        material_id: id,
        idx: i,
        file_url: str(fUrls[i], 1000),
        file_key: str(fKeys[i], 500),
        file_name: str(fNames[i], 200),
        file_size: numOrNull(fSizes[i]),
        file_type: str(fTypes[i], 50),
      });
    }

    // Denormalize previewImages array → material_preview_images rows
    const previews = Array.isArray(d.previewImages) ? d.previewImages : [];
    for (let i = 0; i < previews.length; i++) {
      previewRows.push({
        material_id: id,
        idx: i,
        url: str(previews[i], 1000),
      });
    }
  }

  if (skipped > 0) {
    console.error(`[oracle]   materials: ${skipped} docs skipped (orphaned authorId)`);
  }
  await bulkInsert(conn, "materials", MATERIALS_SQL, matRows, MATERIALS_BINDS);
  await bulkInsert(conn, "material_files", MATERIAL_FILES_SQL, fileRows, MATERIAL_FILES_BINDS);
  await bulkInsert(conn, "material_preview_images", MATERIAL_PREVIEWS_SQL, previewRows, MATERIAL_PREVIEWS_BINDS);
}

// ---------------------------------------------------------------------------
// Insert: purchases
// ---------------------------------------------------------------------------

const PURCHASES_SQL = `
INSERT INTO purchases (
  id, buyer_id, seller_id, material_id, price,
  settled, downloaded, downloaded_at,
  refunded, refunded_at, refund_reason, created_at
) VALUES (
  :id, :buyer_id, :seller_id, :material_id, :price,
  :settled, :downloaded, :downloaded_at,
  :refunded, :refunded_at, :refund_reason, :created_at
)`;

const PURCHASES_BINDS: Record<string, oracledb.BindParameter> = {
  id: { type: oracledb.NUMBER },
  buyer_id: { type: oracledb.NUMBER },
  seller_id: { type: oracledb.NUMBER },
  material_id: { type: oracledb.NUMBER },
  price: { type: oracledb.NUMBER },
  settled: { type: oracledb.DB_TYPE_BOOLEAN },
  downloaded: { type: oracledb.DB_TYPE_BOOLEAN },
  downloaded_at: { type: oracledb.DATE },
  refunded: { type: oracledb.DB_TYPE_BOOLEAN },
  refunded_at: { type: oracledb.DATE },
  refund_reason: { type: oracledb.STRING, maxSize: 100 },
  created_at: { type: oracledb.DATE },
};

async function insertPurchases(
  conn: oracledb.Connection,
  docs: FirestoreDoc[],
  userIdMap: Map<string, number>,
  materialIdMap: Map<string, number>,
  purchaseIdMap: Map<string, number>
): Promise<void> {
  let seq = 0;
  const rows: Record<string, unknown>[] = [];
  let skipped = 0;
  // Dedup by (buyer_id, material_id) — schema has UNIQUE constraint
  const seen = new Set<string>();

  for (const doc of docs) {
    const d = doc.data();
    const buyerId = d.buyerId ? userIdMap.get(d.buyerId) : null;
    const sellerId = d.sellerId ? userIdMap.get(d.sellerId) : null;
    const materialId = d.materialId ? materialIdMap.get(d.materialId) : null;
    if (!buyerId || !sellerId || !materialId) {
      skipped++;
      continue;
    }
    const dedupKey = `${buyerId}_${materialId}`;
    if (seen.has(dedupKey)) {
      skipped++;
      continue;
    }
    seen.add(dedupKey);

    const id = ++seq;
    purchaseIdMap.set(doc.id, id);
    // settled in Firestore can be timestamp (settled at) or null
    rows.push({
      id,
      buyer_id: buyerId,
      seller_id: sellerId,
      material_id: materialId,
      price: num(d.price),
      settled: !!d.settled,
      downloaded: bool(d.downloaded),
      downloaded_at: toDate(d.downloadedAt),
      refunded: bool(d.refunded),
      refunded_at: toDate(d.refundedAt),
      refund_reason: str(d.refundReason, 100),
      created_at: toDate(d.createdAt) ?? new Date(),
    });
  }
  if (skipped > 0) {
    console.error(`[oracle]   purchases: ${skipped} docs skipped (orphan FK or duplicate)`);
  }
  await bulkInsert(conn, "purchases", PURCHASES_SQL, rows, PURCHASES_BINDS);
}

// ---------------------------------------------------------------------------
// Insert: transactions
// ---------------------------------------------------------------------------

const TRANSACTIONS_SQL = `
INSERT INTO transactions (
  id, user_id, type, amount, balance_after, balance_type, description, status,
  kakaopay_tid, toss_payment_key, toss_payment_amount,
  fee, commission, tax, total_deduction, received,
  bank_name, account_number, account_holder,
  related_material_id, related_user_id,
  granted_by, completed_by, completed_at,
  rejected_by, rejected_at, reject_reason,
  created_at
) VALUES (
  :id, :user_id, :type, :amount, :balance_after, :balance_type, :description, :status,
  :kakaopay_tid, :toss_payment_key, :toss_payment_amount,
  :fee, :commission, :tax, :total_deduction, :received,
  :bank_name, :account_number, :account_holder,
  :related_material_id, :related_user_id,
  :granted_by, :completed_by, :completed_at,
  :rejected_by, :rejected_at, :reject_reason,
  :created_at
)`;

const TRANSACTIONS_BINDS: Record<string, oracledb.BindParameter> = {
  id: { type: oracledb.NUMBER },
  user_id: { type: oracledb.NUMBER },
  type: { type: oracledb.STRING, maxSize: 30 },
  amount: { type: oracledb.NUMBER },
  balance_after: { type: oracledb.NUMBER },
  balance_type: { type: oracledb.STRING, maxSize: 10 },
  description: { type: oracledb.STRING, maxSize: 500 },
  status: { type: oracledb.STRING, maxSize: 20 },
  kakaopay_tid: { type: oracledb.STRING, maxSize: 100 },
  toss_payment_key: { type: oracledb.STRING, maxSize: 200 },
  toss_payment_amount: { type: oracledb.NUMBER },
  fee: { type: oracledb.NUMBER },
  commission: { type: oracledb.NUMBER },
  tax: { type: oracledb.NUMBER },
  total_deduction: { type: oracledb.NUMBER },
  received: { type: oracledb.NUMBER },
  bank_name: { type: oracledb.STRING, maxSize: 30 },
  account_number: { type: oracledb.STRING, maxSize: 30 },
  account_holder: { type: oracledb.STRING, maxSize: 50 },
  related_material_id: { type: oracledb.NUMBER },
  related_user_id: { type: oracledb.NUMBER },
  granted_by: { type: oracledb.STRING, maxSize: 128 },
  completed_by: { type: oracledb.STRING, maxSize: 128 },
  completed_at: { type: oracledb.DATE },
  rejected_by: { type: oracledb.STRING, maxSize: 128 },
  rejected_at: { type: oracledb.DATE },
  reject_reason: { type: oracledb.STRING, maxSize: 500 },
  created_at: { type: oracledb.DATE },
};

async function insertTransactions(
  conn: oracledb.Connection,
  docs: FirestoreDoc[],
  userIdMap: Map<string, number>,
  materialIdMap: Map<string, number>,
  transactionIdMap: Map<string, number>
): Promise<void> {
  let seq = 0;
  const rows: Record<string, unknown>[] = [];
  let skipped = 0;
  for (const doc of docs) {
    const d = doc.data();
    const userId = d.userId ? userIdMap.get(d.userId) : null;
    if (!userId) {
      skipped++;
      continue;
    }
    const id = ++seq;
    transactionIdMap.set(doc.id, id);
    rows.push({
      id,
      user_id: userId,
      type: strDefault(d.type, "unknown", 30),
      amount: num(d.amount),
      balance_after: numOrNull(d.balanceAfter),
      balance_type: str(d.balanceType, 10) ?? "points",
      description: str(d.description, 500),
      status: strDefault(d.status, "completed", 20),
      kakaopay_tid: str(d.kakaopayTid, 100),
      toss_payment_key: str(d.tossPaymentKey, 200),
      toss_payment_amount: numOrNull(d.tossPaymentAmount),
      fee: numOrNull(d.fee),
      commission: numOrNull(d.commission),
      tax: numOrNull(d.tax),
      total_deduction: numOrNull(d.totalDeduction),
      received: numOrNull(d.received),
      bank_name: str(d.bankName, 30),
      account_number: str(d.accountNumber, 30),
      account_holder: str(d.accountHolder, 50),
      related_material_id: d.relatedMaterialId ? materialIdMap.get(d.relatedMaterialId) ?? null : null,
      related_user_id: d.relatedUserId ? userIdMap.get(d.relatedUserId) ?? null : null,
      granted_by: str(d.grantedBy, 128),
      completed_by: str(d.completedBy, 128),
      completed_at: toDate(d.completedAt),
      rejected_by: str(d.rejectedBy, 128),
      rejected_at: toDate(d.rejectedAt),
      reject_reason: str(d.rejectReason, 500),
      created_at: toDate(d.createdAt) ?? new Date(),
    });
  }
  if (skipped > 0) {
    console.error(`[oracle]   transactions: ${skipped} docs skipped (orphan userId)`);
  }
  await bulkInsert(conn, "transactions", TRANSACTIONS_SQL, rows, TRANSACTIONS_BINDS);
}

// ---------------------------------------------------------------------------
// Insert: withdraw_secrets (depends on transactions)
// ---------------------------------------------------------------------------

const WITHDRAW_SQL = `
INSERT INTO withdraw_secrets (
  id, transaction_id, user_id, bank_name, account_number, account_holder, created_at
) VALUES (
  :id, :transaction_id, :user_id, :bank_name, :account_number, :account_holder, :created_at
)`;

const WITHDRAW_BINDS: Record<string, oracledb.BindParameter> = {
  id: { type: oracledb.NUMBER },
  transaction_id: { type: oracledb.NUMBER },
  user_id: { type: oracledb.NUMBER },
  bank_name: { type: oracledb.STRING, maxSize: 30 },
  account_number: { type: oracledb.STRING, maxSize: 200 },
  account_holder: { type: oracledb.STRING, maxSize: 50 },
  created_at: { type: oracledb.DATE },
};

async function insertWithdrawSecrets(
  conn: oracledb.Connection,
  docs: FirestoreDoc[],
  userIdMap: Map<string, number>,
  transactionIdMap: Map<string, number>
): Promise<void> {
  let seq = 0;
  const rows: Record<string, unknown>[] = [];
  let skipped = 0;
  for (const doc of docs) {
    const d = doc.data();
    // Firestore doc id == transaction firestore id (per existing convention)
    const txId = transactionIdMap.get(doc.id);
    const userId = d.userId ? userIdMap.get(d.userId) : null;
    if (!txId || !userId) {
      skipped++;
      continue;
    }
    rows.push({
      id: ++seq,
      transaction_id: txId,
      user_id: userId,
      bank_name: strDefault(d.bankName, "", 30),
      account_number: strDefault(d.accountNumber, "", 200),
      account_holder: strDefault(d.accountHolder, "", 50),
      created_at: toDate(d.createdAt) ?? new Date(),
    });
  }
  if (skipped > 0) {
    console.error(`[oracle]   withdraw_secrets: ${skipped} docs skipped (orphan transaction or user)`);
  }
  await bulkInsert(conn, "withdraw_secrets", WITHDRAW_SQL, rows, WITHDRAW_BINDS);
}

// ---------------------------------------------------------------------------
// Insert: reviews
// ---------------------------------------------------------------------------

const REVIEWS_SQL = `
INSERT INTO reviews (id, user_id, material_id, rating, content, created_at)
VALUES (:id, :user_id, :material_id, :rating, :content, :created_at)`;

const REVIEWS_BINDS: Record<string, oracledb.BindParameter> = {
  id: { type: oracledb.NUMBER },
  user_id: { type: oracledb.NUMBER },
  material_id: { type: oracledb.NUMBER },
  rating: { type: oracledb.NUMBER },
  content: { type: oracledb.STRING, maxSize: 1000 },
  created_at: { type: oracledb.DATE },
};

async function insertReviews(
  conn: oracledb.Connection,
  docs: FirestoreDoc[],
  userIdMap: Map<string, number>,
  materialIdMap: Map<string, number>
): Promise<void> {
  let seq = 0;
  let skipped = 0;
  const rows: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  for (const doc of docs) {
    const d = doc.data();
    const uid = d.userId ? userIdMap.get(d.userId) : null;
    const mid = d.materialId ? materialIdMap.get(d.materialId) : null;
    if (!uid || !mid) {
      skipped++;
      continue;
    }
    const k = `${uid}_${mid}`;
    if (seen.has(k)) {
      skipped++;
      continue;
    }
    seen.add(k);
    const rating = Math.min(5, Math.max(1, num(d.rating) || 5));
    rows.push({
      id: ++seq,
      user_id: uid,
      material_id: mid,
      rating,
      content: strDefault(d.content, "", 1000),
      created_at: toDate(d.createdAt) ?? new Date(),
    });
  }
  if (skipped > 0) console.error(`[oracle]   reviews: ${skipped} docs skipped`);
  await bulkInsert(conn, "reviews", REVIEWS_SQL, rows, REVIEWS_BINDS);
}

// ---------------------------------------------------------------------------
// Insert: reports
// ---------------------------------------------------------------------------

const REPORTS_SQL = `
INSERT INTO reports (
  id, material_id, reporter_id, type, reason, description,
  original_source, contact_email, is_rights_holder, purchase_id,
  status, resolution, resolved_by, resolved_at, created_at
) VALUES (
  :id, :material_id, :reporter_id, :type, :reason, :description,
  :original_source, :contact_email, :is_rights_holder, :purchase_id,
  :status, :resolution, :resolved_by, :resolved_at, :created_at
)`;

const REPORTS_BINDS: Record<string, oracledb.BindParameter> = {
  id: { type: oracledb.NUMBER },
  material_id: { type: oracledb.NUMBER },
  reporter_id: { type: oracledb.NUMBER },
  type: { type: oracledb.STRING, maxSize: 20 },
  reason: { type: oracledb.STRING, maxSize: 100 },
  description: { type: oracledb.CLOB },
  original_source: { type: oracledb.STRING, maxSize: 500 },
  contact_email: { type: oracledb.STRING, maxSize: 200 },
  is_rights_holder: { type: oracledb.DB_TYPE_BOOLEAN },
  purchase_id: { type: oracledb.NUMBER },
  status: { type: oracledb.STRING, maxSize: 20 },
  resolution: { type: oracledb.STRING, maxSize: 50 },
  resolved_by: { type: oracledb.STRING, maxSize: 128 },
  resolved_at: { type: oracledb.DATE },
  created_at: { type: oracledb.DATE },
};

async function insertReports(
  conn: oracledb.Connection,
  docs: FirestoreDoc[],
  userIdMap: Map<string, number>,
  materialIdMap: Map<string, number>,
  purchaseIdMap: Map<string, number>
): Promise<void> {
  let seq = 0;
  let skipped = 0;
  const rows: Record<string, unknown>[] = [];
  for (const doc of docs) {
    const d = doc.data();
    const reporterId = d.reporterId ? userIdMap.get(d.reporterId) : null;
    const materialId = d.materialId ? materialIdMap.get(d.materialId) : null;
    if (!reporterId || !materialId) {
      skipped++;
      continue;
    }
    rows.push({
      id: ++seq,
      material_id: materialId,
      reporter_id: reporterId,
      type: strDefault(d.type, "copyright", 20),
      reason: strDefault(d.reason, "", 100),
      description: str(d.description) ?? "",
      original_source: str(d.originalSource, 500),
      contact_email: str(d.contactEmail, 200),
      is_rights_holder: bool(d.isRightsHolder),
      purchase_id: d.purchaseId ? purchaseIdMap.get(d.purchaseId) ?? null : null,
      status: strDefault(d.status, "pending", 20),
      resolution: str(d.resolution, 50),
      resolved_by: str(d.resolvedBy, 128),
      resolved_at: toDate(d.resolvedAt),
      created_at: toDate(d.createdAt) ?? new Date(),
    });
  }
  if (skipped > 0) console.error(`[oracle]   reports: ${skipped} docs skipped`);
  await bulkInsert(conn, "reports", REPORTS_SQL, rows, REPORTS_BINDS);
}

// ---------------------------------------------------------------------------
// Insert: notifications
// ---------------------------------------------------------------------------

const NOTIFS_SQL = `
INSERT INTO notifications (
  id, user_id, type, title, message, material_id, material_title, is_read, created_at
) VALUES (
  :id, :user_id, :type, :title, :message, :material_id, :material_title, :is_read, :created_at
)`;

const NOTIFS_BINDS: Record<string, oracledb.BindParameter> = {
  id: { type: oracledb.NUMBER },
  user_id: { type: oracledb.NUMBER },
  type: { type: oracledb.STRING, maxSize: 30 },
  title: { type: oracledb.STRING, maxSize: 200 },
  message: { type: oracledb.STRING, maxSize: 500 },
  material_id: { type: oracledb.NUMBER },
  material_title: { type: oracledb.STRING, maxSize: 200 },
  is_read: { type: oracledb.DB_TYPE_BOOLEAN },
  created_at: { type: oracledb.DATE },
};

async function insertNotifications(
  conn: oracledb.Connection,
  docs: FirestoreDoc[],
  userIdMap: Map<string, number>,
  materialIdMap: Map<string, number>
): Promise<void> {
  let seq = 0;
  let skipped = 0;
  const rows: Record<string, unknown>[] = [];
  for (const doc of docs) {
    const d = doc.data();
    const uid = d.userId ? userIdMap.get(d.userId) : null;
    if (!uid) {
      skipped++;
      continue;
    }
    rows.push({
      id: ++seq,
      user_id: uid,
      type: strDefault(d.type, "info", 30),
      title: strDefault(d.title, "", 200),
      message: strDefault(d.message, "", 500),
      material_id: d.materialId ? materialIdMap.get(d.materialId) ?? null : null,
      material_title: str(d.materialTitle, 200),
      is_read: bool(d.read),
      created_at: toDate(d.createdAt) ?? new Date(),
    });
  }
  if (skipped > 0) console.error(`[oracle]   notifications: ${skipped} docs skipped`);
  await bulkInsert(conn, "notifications", NOTIFS_SQL, rows, NOTIFS_BINDS);
}

// ---------------------------------------------------------------------------
// Insert: admin_logs (no user FK — admin_uid is opaque string)
// ---------------------------------------------------------------------------

const ADMIN_LOGS_SQL = `
INSERT INTO admin_logs (id, admin_uid, action, details, created_at)
VALUES (:id, :admin_uid, :action, :details, :created_at)`;

const ADMIN_LOGS_BINDS: Record<string, oracledb.BindParameter> = {
  id: { type: oracledb.NUMBER },
  admin_uid: { type: oracledb.STRING, maxSize: 128 },
  action: { type: oracledb.STRING, maxSize: 50 },
  details: { type: oracledb.STRING, maxSize: 32767 }, // JSON column accepts string bind
  created_at: { type: oracledb.DATE },
};

async function insertAdminLogs(conn: oracledb.Connection, docs: FirestoreDoc[]): Promise<void> {
  let seq = 0;
  const rows: Record<string, unknown>[] = [];
  for (const doc of docs) {
    const d = doc.data();
    rows.push({
      id: ++seq,
      admin_uid: strDefault(d.adminUid, "unknown", 128),
      action: strDefault(d.action, "unknown", 50),
      details: jsonStr(d.details) ?? "{}",
      created_at: toDate(d.createdAt) ?? new Date(),
    });
  }
  await bulkInsert(conn, "admin_logs", ADMIN_LOGS_SQL, rows, ADMIN_LOGS_BINDS);
}

// ---------------------------------------------------------------------------
// Insert: cart (Firestore: "carts" plural → Oracle: "cart" singular)
// ---------------------------------------------------------------------------

const CART_SQL = `
INSERT INTO cart (
  id, user_id, material_id, title, price, author, category, thumbnail, added_at
) VALUES (
  :id, :user_id, :material_id, :title, :price, :author, :category, :thumbnail, :added_at
)`;

const CART_BINDS: Record<string, oracledb.BindParameter> = {
  id: { type: oracledb.NUMBER },
  user_id: { type: oracledb.NUMBER },
  material_id: { type: oracledb.NUMBER },
  title: { type: oracledb.STRING, maxSize: 200 },
  price: { type: oracledb.NUMBER },
  author: { type: oracledb.STRING, maxSize: 100 },
  category: { type: oracledb.STRING, maxSize: 20 },
  thumbnail: { type: oracledb.STRING, maxSize: 1000 },
  added_at: { type: oracledb.DATE },
};

async function insertCart(
  conn: oracledb.Connection,
  docs: FirestoreDoc[],
  userIdMap: Map<string, number>,
  materialIdMap: Map<string, number>
): Promise<void> {
  let seq = 0;
  let skipped = 0;
  const rows: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  for (const doc of docs) {
    const d = doc.data();
    const uid = d.userId ? userIdMap.get(d.userId) : null;
    const mid = d.materialId ? materialIdMap.get(d.materialId) : null;
    if (!uid || !mid) {
      skipped++;
      continue;
    }
    const k = `${uid}_${mid}`;
    if (seen.has(k)) {
      skipped++;
      continue;
    }
    seen.add(k);
    rows.push({
      id: ++seq,
      user_id: uid,
      material_id: mid,
      title: strDefault(d.title, "", 200),
      price: num(d.price),
      author: str(d.author, 100),
      category: str(d.category, 20),
      thumbnail: str(d.thumbnail, 1000),
      added_at: toDate(d.addedAt) ?? new Date(),
    });
  }
  if (skipped > 0) console.error(`[oracle]   cart: ${skipped} docs skipped`);
  await bulkInsert(conn, "cart", CART_SQL, rows, CART_BINDS);
}

// ---------------------------------------------------------------------------
// Insert: material_requests
// ---------------------------------------------------------------------------

const MAT_REQ_SQL = `
INSERT INTO material_requests (
  id, user_id, nickname, subject, professor, description, category,
  need_count, status, created_at
) VALUES (
  :id, :user_id, :nickname, :subject, :professor, :description, :category,
  :need_count, :status, :created_at
)`;

const MAT_REQ_BINDS: Record<string, oracledb.BindParameter> = {
  id: { type: oracledb.NUMBER },
  user_id: { type: oracledb.NUMBER },
  nickname: { type: oracledb.STRING, maxSize: 16 },
  subject: { type: oracledb.STRING, maxSize: 50 },
  professor: { type: oracledb.STRING, maxSize: 50 },
  description: { type: oracledb.CLOB },
  category: { type: oracledb.STRING, maxSize: 20 },
  need_count: { type: oracledb.NUMBER },
  status: { type: oracledb.STRING, maxSize: 20 },
  created_at: { type: oracledb.DATE },
};

async function insertMaterialRequests(
  conn: oracledb.Connection,
  docs: FirestoreDoc[],
  userIdMap: Map<string, number>
): Promise<void> {
  let seq = 0;
  let skipped = 0;
  const rows: Record<string, unknown>[] = [];
  for (const doc of docs) {
    const d = doc.data();
    const uid = d.userId ? userIdMap.get(d.userId) : null;
    if (!uid) {
      skipped++;
      continue;
    }
    rows.push({
      id: ++seq,
      user_id: uid,
      nickname: strDefault(d.nickname, "익명", 16),
      subject: strDefault(d.subject, "", 50),
      professor: str(d.professor, 50),
      description: str(d.description) ?? "",
      category: str(d.category, 20) ?? "수업",
      need_count: num(d.needCount) || 1,
      status: strDefault(d.status, "open", 20),
      created_at: toDate(d.createdAt) ?? new Date(),
    });
  }
  if (skipped > 0) console.error(`[oracle]   material_requests: ${skipped} docs skipped`);
  await bulkInsert(conn, "material_requests", MAT_REQ_SQL, rows, MAT_REQ_BINDS);
}

// ---------------------------------------------------------------------------
// Insert: raffle_entries
// ---------------------------------------------------------------------------

const RAFFLE_SQL = `
INSERT INTO raffle_entries (id, user_id, product_id, count, created_at)
VALUES (:id, :user_id, :product_id, :count, :created_at)`;

const RAFFLE_BINDS: Record<string, oracledb.BindParameter> = {
  id: { type: oracledb.NUMBER },
  user_id: { type: oracledb.NUMBER },
  product_id: { type: oracledb.STRING, maxSize: 100 },
  count: { type: oracledb.NUMBER },
  created_at: { type: oracledb.DATE },
};

async function insertRaffleEntries(
  conn: oracledb.Connection,
  docs: FirestoreDoc[],
  userIdMap: Map<string, number>
): Promise<void> {
  let seq = 0;
  let skipped = 0;
  const rows: Record<string, unknown>[] = [];
  for (const doc of docs) {
    const d = doc.data();
    // raffle_entries doc id format: `${uid}_${productId}` — uid in d.uid or in id prefix
    const firebaseUid = (d.uid as string) || doc.id.split("_")[0];
    const uid = userIdMap.get(firebaseUid);
    if (!uid) {
      skipped++;
      continue;
    }
    rows.push({
      id: ++seq,
      user_id: uid,
      product_id: strDefault(d.productId, "unknown", 100),
      count: num(d.count) || 1,
      created_at: toDate(d.createdAt) ?? new Date(),
    });
  }
  if (skipped > 0) console.error(`[oracle]   raffle_entries: ${skipped} docs skipped`);
  await bulkInsert(conn, "raffle_entries", RAFFLE_SQL, rows, RAFFLE_BINDS);
}

// ---------------------------------------------------------------------------
// Insert: charge_requests
// ---------------------------------------------------------------------------

const CHARGE_SQL = `
INSERT INTO charge_requests (
  id, user_id, email, amount, transfer_amount, vat,
  sender_name, sender_phone, receipt_number, receipt_type,
  status, created_at
) VALUES (
  :id, :user_id, :email, :amount, :transfer_amount, :vat,
  :sender_name, :sender_phone, :receipt_number, :receipt_type,
  :status, :created_at
)`;

const CHARGE_BINDS: Record<string, oracledb.BindParameter> = {
  id: { type: oracledb.NUMBER },
  user_id: { type: oracledb.NUMBER },
  email: { type: oracledb.STRING, maxSize: 255 },
  amount: { type: oracledb.NUMBER },
  transfer_amount: { type: oracledb.NUMBER },
  vat: { type: oracledb.NUMBER },
  sender_name: { type: oracledb.STRING, maxSize: 50 },
  sender_phone: { type: oracledb.STRING, maxSize: 20 },
  receipt_number: { type: oracledb.STRING, maxSize: 100 },
  receipt_type: { type: oracledb.STRING, maxSize: 20 },
  status: { type: oracledb.STRING, maxSize: 20 },
  created_at: { type: oracledb.DATE },
};

async function insertChargeRequests(
  conn: oracledb.Connection,
  docs: FirestoreDoc[],
  userIdMap: Map<string, number>
): Promise<void> {
  let seq = 0;
  let skipped = 0;
  const rows: Record<string, unknown>[] = [];
  for (const doc of docs) {
    const d = doc.data();
    const uid = d.userId ? userIdMap.get(d.userId) : null;
    if (!uid) {
      skipped++;
      continue;
    }
    rows.push({
      id: ++seq,
      user_id: uid,
      email: strDefault(d.email, "", 255),
      amount: num(d.amount),
      transfer_amount: num(d.transferAmount),
      vat: numOrNull(d.vat),
      sender_name: str(d.senderName, 50),
      sender_phone: str(d.senderPhone, 20),
      receipt_number: str(d.receiptNumber, 100),
      receipt_type: str(d.receiptType, 20),
      status: strDefault(d.status, "pending", 20),
      created_at: toDate(d.createdAt) ?? new Date(),
    });
  }
  if (skipped > 0) console.error(`[oracle]   charge_requests: ${skipped} docs skipped`);
  await bulkInsert(conn, "charge_requests", CHARGE_SQL, rows, CHARGE_BINDS);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const t0 = Date.now();
  console.error(`[migrate] Starting Firestore → Oracle migration`);
  console.error(`[migrate]   DRY_RUN=${DRY_RUN} KEEP_DATA=${KEEP_DATA}`);
  console.error(`[migrate]   Oracle: ${ORACLE_CONFIG.user}@${ORACLE_CONFIG.connectString}`);

  // ---- Read all Firestore collections in parallel ----
  console.error(`\n[firestore] Reading all collections...`);
  const [
    usersDocs,
    materialsDocs,
    purchasesDocs,
    transactionsDocs,
    reviewsDocs,
    reportsDocs,
    notificationsDocs,
    withdrawSecretsDocs,
    adminLogsDocs,
    cartsDocs,
    materialRequestsDocs,
    raffleEntriesDocs,
    chargeRequestsDocs,
  ] = await Promise.all([
    readAll("users"),
    readAll("materials"),
    readAll("purchases"),
    readAll("transactions"),
    readAll("reviews"),
    readAll("reports"),
    readAll("notifications"),
    readAll("withdraw_secrets"),
    readAll("admin_logs"),
    readAll("carts"),
    readAll("material_requests"),
    readAll("raffle_entries"),
    readAll("charge_requests"),
  ]);

  console.error(`[firestore]   users:             ${usersDocs.length}`);
  console.error(`[firestore]   materials:         ${materialsDocs.length}`);
  console.error(`[firestore]   purchases:         ${purchasesDocs.length}`);
  console.error(`[firestore]   transactions:      ${transactionsDocs.length}`);
  console.error(`[firestore]   reviews:           ${reviewsDocs.length}`);
  console.error(`[firestore]   reports:           ${reportsDocs.length}`);
  console.error(`[firestore]   notifications:     ${notificationsDocs.length}`);
  console.error(`[firestore]   withdraw_secrets:  ${withdrawSecretsDocs.length}`);
  console.error(`[firestore]   admin_logs:        ${adminLogsDocs.length}`);
  console.error(`[firestore]   carts:             ${cartsDocs.length}`);
  console.error(`[firestore]   material_requests: ${materialRequestsDocs.length}`);
  console.error(`[firestore]   raffle_entries:    ${raffleEntriesDocs.length}`);
  console.error(`[firestore]   charge_requests:   ${chargeRequestsDocs.length}`);

  // ---- Connect Oracle ----
  let conn: oracledb.Connection | undefined;
  if (!DRY_RUN) {
    console.error(`\n[oracle] Connecting...`);
    conn = await oracledb.getConnection(ORACLE_CONFIG);
    console.error(`[oracle] Connected`);
  } else {
    // For DRY_RUN, still need a fake conn for the bulkInsert signature; create a stub
    conn = {
      execute: async () => ({ rowsAffected: 0 }),
      executeMany: async () => ({}),
      commit: async () => {},
      close: async () => {},
    } as unknown as oracledb.Connection;
  }

  try {
    // ---- WIPE ----
    if (!DRY_RUN) {
      await wipe(conn);
    }

    // ---- INSERT in dependency order ----
    const userIdMap = new Map<string, number>();
    const materialIdMap = new Map<string, number>();
    const purchaseIdMap = new Map<string, number>();
    const transactionIdMap = new Map<string, number>();

    console.error(`\n[oracle] Inserting...`);

    // 1. users (no FK)
    await insertUsers(conn, usersDocs, userIdMap);
    // 2. admin_logs (no FK)
    await insertAdminLogs(conn, adminLogsDocs);
    // 3. materials → material_files, material_preview_images (depends on users)
    await insertMaterials(conn, materialsDocs, userIdMap, materialIdMap);
    // 4. purchases (depends on users, materials)
    await insertPurchases(conn, purchasesDocs, userIdMap, materialIdMap, purchaseIdMap);
    // 5. transactions (depends on users; soft-refs materials)
    await insertTransactions(conn, transactionsDocs, userIdMap, materialIdMap, transactionIdMap);
    // 6. withdraw_secrets (depends on transactions)
    await insertWithdrawSecrets(conn, withdrawSecretsDocs, userIdMap, transactionIdMap);
    // 7. reviews (depends on users, materials)
    await insertReviews(conn, reviewsDocs, userIdMap, materialIdMap);
    // 8. reports (depends on users, materials, soft-refs purchases)
    await insertReports(conn, reportsDocs, userIdMap, materialIdMap, purchaseIdMap);
    // 9. notifications (depends on users, soft-refs materials)
    await insertNotifications(conn, notificationsDocs, userIdMap, materialIdMap);
    // 10. cart (depends on users; materials only soft via Long materialId per entity)
    await insertCart(conn, cartsDocs, userIdMap, materialIdMap);
    // 11. material_requests (depends on users)
    await insertMaterialRequests(conn, materialRequestsDocs, userIdMap);
    // 12. raffle_entries (depends on users)
    await insertRaffleEntries(conn, raffleEntriesDocs, userIdMap);
    // 13. charge_requests (depends on users)
    await insertChargeRequests(conn, chargeRequestsDocs, userIdMap);

    if (!DRY_RUN) {
      await conn.commit();
      console.error(`\n[oracle] Commit OK`);

      // ---- Restart IDENTITY counters so future Spring inserts don't clash ----
      console.error(`\n[oracle] Restarting IDENTITY counters...`);
      for (const t of [
        "users", "materials", "purchases", "transactions",
        "reviews", "reports", "notifications", "withdraw_secrets",
        "admin_logs", "cart", "material_requests",
        "raffle_entries", "charge_requests",
      ]) {
        await restartIdentity(conn, t);
      }
    }

    console.error(`\n[migrate] Done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  } catch (err) {
    console.error(`\n[migrate] FATAL — rolling back:`, err);
    if (!DRY_RUN && conn) {
      try { await conn.rollback(); } catch {}
    }
    throw err;
  } finally {
    if (!DRY_RUN && conn) {
      try { await conn.close(); } catch {}
    }
    await admin.app().delete();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
