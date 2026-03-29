/**
 * Migration Script: Firebase + Supabase → MongoDB + MinIO
 * รัน: node scripts/migrate-firebase-to-mongo.cjs
 *
 * สิ่งที่ script นี้ทำ:
 * 1. ดึงข้อมูลทุก collection จาก Firestore
 * 2. บันทึกลง MongoDB (เก็บ firebase_id เดิมไว้เพื่อ reference)
 * 3. ดาวน์โหลดไฟล์จาก Supabase Storage แล้วอัปโหลดขึ้น MinIO
 * 4. อัปเดต URL ในฐานข้อมูลให้ชี้มาที่ MinIO
 */

require('dotenv').config();
const admin   = require('firebase-admin');
const mongoose = require('mongoose');
const Minio   = require('minio');
const bcrypt  = require('bcryptjs');
const https   = require('https');
const http    = require('http');
const { createClient } = require('@supabase/supabase-js');

// ─── CONFIG ───────────────────────────────────────────────
const MONGO_URI    = process.env.MONGO_URI    || 'mongodb://localhost:27017/aunqa_db';
const MINIO_BUCKET = process.env.MINIO_BUCKET || 'aunqa-files';

const minioClient = new Minio.Client({
  endPoint:  process.env.MINIO_ENDPOINT  || 'localhost',
  port:      parseInt(process.env.MINIO_PORT || '9000'),
  useSSL:    process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

// ─── FIREBASE INIT ────────────────────────────────────────
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}
const db = admin.firestore();

// ─── MONGOOSE SCHEMAS (minimal — just enough to insert) ───
const anySchema = new mongoose.Schema({ _firebaseId: String }, { strict: false, timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const collections = {
  users:                    mongoose.model('User',                 anySchema, 'users'),
  programs:                 mongoose.model('Program',              anySchema, 'programs'),
  levels:                   mongoose.model('Level',                anySchema, 'levels'),
  faculties:                mongoose.model('Faculty',              anySchema, 'faculties'),
  rounds:                   mongoose.model('Round',                anySchema, 'rounds'),
  quality_components:       mongoose.model('QualityComponent',     anySchema, 'quality_components'),
  indicators:               mongoose.model('Indicator',            anySchema, 'indicators'),
  assessment_sessions:      mongoose.model('AssessmentSession',    anySchema, 'assessment_sessions'),
  evaluations:              mongoose.model('Evaluation',           anySchema, 'evaluations'),
  evaluations_actual:       mongoose.model('EvaluationActual',     anySchema, 'evaluations_actual'),
  committee_evaluations:    mongoose.model('CommitteeEvaluation',  anySchema, 'committee_evaluations'),
  master_quality_components:mongoose.model('MasterQualityComponent', anySchema, 'master_quality_components'),
  master_indicators:        mongoose.model('MasterIndicator',      anySchema, 'master_indicators'),
};

// ─── HELPERS ──────────────────────────────────────────────
function log(msg)  { console.log(`  ✅ ${msg}`); }
function warn(msg) { console.warn(`  ⚠️  ${msg}`); }
function err(msg)  { console.error(`  ❌ ${msg}`); }

// ดึงข้อมูลทั้ง collection จาก Firestore
async function fetchCollection(name) {
  try {
    const snap = await db.collection(name).get();
    return snap.docs.map(doc => ({ _firebaseId: doc.id, ...doc.data() }));
  } catch (e) {
    warn(`Cannot fetch "${name}" from Firestore: ${e.message}`);
    return [];
  }
}

// แปลง Firestore Timestamp → JS Date
function convertTimestamps(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const result = Array.isArray(obj) ? [] : {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val && typeof val === 'object' && (val._seconds !== undefined || val.seconds !== undefined)) {
      result[key] = new Date((val._seconds || val.seconds) * 1000);
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
      result[key] = convertTimestamps(val);
    } else {
      result[key] = val;
    }
  }
  return result;
}

// ดาวน์โหลดไฟล์จาก URL แล้วอัปโหลดขึ้น MinIO
async function migrateFile(url, minioPath) {
  return new Promise((resolve) => {
    if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
      return resolve(null);
    }
    const client = url.startsWith('https') ? https : http;
    client.get(url, (response) => {
      if (response.statusCode !== 200) {
        warn(`HTTP ${response.statusCode} for ${url}`);
        return resolve(null);
      }
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', async () => {
        try {
          const buffer = Buffer.concat(chunks);
          const contentType = response.headers['content-type'] || 'application/octet-stream';
          await new Promise((res2, rej2) => {
            minioClient.putObject(MINIO_BUCKET, minioPath, buffer, buffer.length, { 'Content-Type': contentType }, (e) => e ? rej2(e) : res2());
          });
          resolve(minioPath);
        } catch (e) {
          warn(`MinIO upload failed for ${minioPath}: ${e.message}`);
          resolve(null);
        }
      });
      response.on('error', (e) => { warn(`Download error: ${e.message}`); resolve(null); });
    }).on('error', (e) => { warn(`Request error: ${e.message}`); resolve(null); });
  });
}

// สร้าง presigned URL จาก MinIO
async function getPresignedUrl(minioPath) {
  return new Promise((resolve) => {
    minioClient.presignedGetObject(MINIO_BUCKET, minioPath, 60 * 60 * 24 * 7, (err, url) => {
      resolve(err ? null : url);
    });
  });
}

// ─── MAIN MIGRATION ───────────────────────────────────────
async function migrate() {
  console.log('\n🚀 Starting migration: Firebase + Supabase → MongoDB + MinIO\n');

  // เชื่อมต่อ MongoDB
  await mongoose.connect(MONGO_URI);
  log('MongoDB connected');

  // ตรวจสอบ MinIO bucket
  const bucketExists = await new Promise(r => minioClient.bucketExists(MINIO_BUCKET, (e, ex) => r(ex)));
  if (!bucketExists) {
    await new Promise((res, rej) => minioClient.makeBucket(MINIO_BUCKET, '', e => e ? rej(e) : res()));
  }
  log(`MinIO bucket "${MINIO_BUCKET}" ready`);

  // ─── 1. MIGRATE SIMPLE COLLECTIONS ───────────────────────
  const simpleCollections = [
    'levels', 'faculties', 'programs', 'rounds',
    'quality_components', 'indicators', 'assessment_sessions',
    'evaluations', 'committee_evaluations',
    'master_quality_components', 'master_indicators',
  ];

  for (const colName of simpleCollections) {
    process.stdout.write(`\n📦 Migrating "${colName}"...`);
    const docs = await fetchCollection(colName);
    if (docs.length === 0) { console.log(' (empty, skipped)'); continue; }

    let inserted = 0, skipped = 0;
    for (const doc of docs) {
      const converted = convertTimestamps(doc);
      // ข้ามถ้ามีอยู่แล้ว
      const existing = await collections[colName].findOne({ _firebaseId: converted._firebaseId });
      if (existing) { skipped++; continue; }
      await collections[colName].create(converted);
      inserted++;
    }
    console.log(` done (inserted: ${inserted}, skipped: ${skipped})`);
  }

  // ─── 2. MIGRATE USERS (hash passwords) ───────────────────
  process.stdout.write('\n👤 Migrating "users"...');
  const firebaseUsers = await fetchCollection('users');
  let uInserted = 0, uSkipped = 0;
  for (const doc of firebaseUsers) {
    const converted = convertTimestamps(doc);
    const existing = await collections.users.findOne({ _firebaseId: converted._firebaseId });
    if (existing) { uSkipped++; continue; }

    // Hash password ถ้ายังเป็น plain text
    if (converted.password && !converted.password.startsWith('$2')) {
      converted.password = await bcrypt.hash(converted.password, 12);
    }
    await collections.users.create(converted);
    uInserted++;
  }
  console.log(` done (inserted: ${uInserted}, skipped: ${uSkipped})`);

  // ─── 3. MIGRATE EVALUATIONS_ACTUAL + FILES ────────────────
  process.stdout.write('\n📁 Migrating "evaluations_actual" + files...');
  const firebaseEvals = await fetchCollection('evaluations_actual');
  let eInserted = 0, eSkipped = 0, filesOk = 0, filesFail = 0;

  for (const doc of firebaseEvals) {
    const converted = convertTimestamps(doc);
    const existing = await collections.evaluations_actual.findOne({ _firebaseId: converted._firebaseId });
    if (existing) { eSkipped++; continue; }

    // migrate files ใน evidence_meta_json
    if (converted.evidence_meta_json) {
      try {
        const meta = typeof converted.evidence_meta_json === 'string'
          ? JSON.parse(converted.evidence_meta_json)
          : converted.evidence_meta_json;

        for (const filename of Object.keys(meta)) {
          const fileInfo = meta[filename];
          if (!fileInfo?.url) continue;

          const minioPath = `evidence_actual/${converted.session_id}/${converted.indicator_id}/${filename}`;
          const uploaded = await migrateFile(fileInfo.url, minioPath);
          if (uploaded) {
            const newUrl = await getPresignedUrl(minioPath);
            meta[filename].url = newUrl || fileInfo.url;
            filesOk++;
          } else {
            filesFail++;
          }
        }
        converted.evidence_meta_json = JSON.stringify(meta);
      } catch (e) {
        warn(`Failed to process evidence_meta for doc ${doc._firebaseId}: ${e.message}`);
      }
    }

    await collections.evaluations_actual.create(converted);
    eInserted++;
  }
  console.log(` done (inserted: ${eInserted}, skipped: ${eSkipped}, files: ${filesOk} ok / ${filesFail} failed)`);

  // ─── 4. MIGRATE FILES FROM SUPABASE ───────────────────────
  console.log('\n☁️  Checking Supabase Storage for additional files...');
  try {
    const { data: supabaseFiles, error } = await supabase.storage
      .from(process.env.SUPABASE_BUCKET_NAME || 'evidence-files')
      .list('evidence_actual', { limit: 1000, recursive: true });

    if (error) {
      warn(`Supabase list error: ${error.message}`);
    } else if (supabaseFiles && supabaseFiles.length > 0) {
      console.log(`  Found ${supabaseFiles.length} items in Supabase`);
      let sfOk = 0, sfFail = 0;
      for (const file of supabaseFiles) {
        if (!file.name) continue;
        const filePath = `evidence_actual/${file.name}`;
        const { data: { publicUrl } } = supabase.storage
          .from(process.env.SUPABASE_BUCKET_NAME || 'evidence-files')
          .getPublicUrl(filePath);

        const uploaded = await migrateFile(publicUrl, filePath);
        uploaded ? sfOk++ : sfFail++;
      }
      log(`Supabase files migrated: ${sfOk} ok / ${sfFail} failed`);
    } else {
      log('No additional files found in Supabase');
    }
  } catch (e) {
    warn(`Supabase migration error: ${e.message}`);
  }

  // ─── SUMMARY ──────────────────────────────────────────────
  console.log('\n' + '─'.repeat(50));
  console.log('✅ Migration complete!\n');
  console.log('📊 MongoDB collections:');
  for (const colName of Object.keys(collections)) {
    const count = await collections[colName].countDocuments();
    if (count > 0) console.log(`   ${colName}: ${count} documents`);
  }
  console.log('\n💡 Next step: run "npm run server-mongo" and test the app');

  await mongoose.disconnect();
  process.exit(0);
}

migrate().catch(e => {
  err(`Migration failed: ${e.message}`);
  console.error(e);
  process.exit(1);
});
