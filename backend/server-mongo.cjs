// MongoDB + MinIO + JWT Server (Migration from Firebase)
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Minio = require('minio');
const { generatePDF } = require('./server/pdf/puppeteer.cjs');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// ================= MONGODB CONNECTION =================
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/aunqa_db')
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err.message));

// ================= MINIO CLIENT =================
const minioClient = new Minio.Client({
  endPoint:  process.env.MINIO_ENDPOINT  || 'localhost',
  port:      parseInt(process.env.MINIO_PORT || '9000'),
  useSSL:    process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
});
const MINIO_BUCKET = process.env.MINIO_BUCKET || 'aunqa-files';

// Auto-create bucket if not exists
minioClient.bucketExists(MINIO_BUCKET, (err, exists) => {
  if (err) return console.error('MinIO bucket check error:', err);
  if (!exists) {
    minioClient.makeBucket(MINIO_BUCKET, '', (err2) => {
      if (err2) return console.error('MinIO make bucket error:', err2);
      console.log(`✅ MinIO bucket "${MINIO_BUCKET}" created`);
    });
  } else {
    console.log(`✅ MinIO bucket "${MINIO_BUCKET}" ready`);
  }
});

// ================= MONGOOSE SCHEMAS =================
// Transform _id → id ใน JSON response ทุก schema
const schemaOptions = {
  toJSON: {
    virtuals: true,
    transform: (doc, ret) => {
      ret.id = ret._id.toString();
      delete ret.__v;
      return ret;
    }
  },
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
};
const userSchema = new mongoose.Schema({
  email:      { type: String, required: true, unique: true },
  password:   { type: String, required: true },
  first_name: { type: String, default: '' },
  last_name:  { type: String, default: '' },
  full_name:  { type: String, default: '' },
  role_id:    { type: Number, default: 3 },
  faculty_id: { type: String, default: null },
  major_id:   { type: String, default: null },
  major_name: { type: String, default: null },
}, schemaOptions);

const programSchema = new mongoose.Schema({
  levelId:     String,
  facultyId:   String,
  facultyName: String,
  majorId:     String,
  majorName:   String,
  isActive:    { type: Boolean, default: true },
}, schemaOptions);

const qualityComponentSchema = new mongoose.Schema({
  quality_name: String,
  component_id: Number,
  session_id:   String,
  major_name:   String,
  year:         String,
}, schemaOptions);

const indicatorSchema = new mongoose.Schema({
  component_id:   mongoose.Schema.Types.Mixed,
  sequence:       String,
  indicator_type: String,
  criteria_type:  String,
  indicator_name: String,
  data_source:    String,
  session_id:     String,
  major_name:     String,
  year:           String,
}, schemaOptions);

const assessmentSessionSchema = new mongoose.Schema({
  level_id:     String,
  faculty_id:   String,
  faculty_name: String,
  major_id:     String,
  major_name:   String,
  evaluator_id: String,
  round_id:     String,
  round_year:   String,
  round_name:   String,
}, schemaOptions);

const evaluationSchema = new mongoose.Schema({
  session_id:         String,
  indicator_id:       String,
  program_id:         String,
  year:               String,
  evaluator_id:       String,
  score:              Number,
  target_value:       String,
  comment:            String,
  evidence_file_url:  String,
  evidence_file_name: String,
  status:             { type: String, default: 'submitted' },
  major_name:         String,
}, schemaOptions);

const evaluationActualSchema = new mongoose.Schema({
  session_id:          String,
  indicator_id:        String,
  operation_result:    String,
  operation_score:     Number,
  reference_score:     Number,
  goal_achievement:    String,
  evidence_files_json: { type: String, default: '[]' },
  evidence_meta_json:  { type: String, default: '{}' },
  comment:             String,
  major_name:          String,
  year:                String,
  status:              { type: String, default: 'submitted' },
  approved_by:         String,
  approved_at:         Date,
  feedback:            String,
  rejected_by:         String,
  rejected_at:         Date,
}, schemaOptions);

const committeeEvaluationSchema = new mongoose.Schema({
  session_id:       String,
  major_name:       String,
  indicator_id:     String,
  committee_score:  Number,
  strengths:        String,
  improvements:     String,
  development_plan: String,
  year:             String,
}, schemaOptions);

const masterQualityComponentSchema = new mongoose.Schema({
  quality_name: String,
  component_id: Number,
}, schemaOptions);

const masterIndicatorSchema = new mongoose.Schema({
  component_id:   Number,
  sequence:       String,
  indicator_type: String,
  criteria_type:  String,
  indicator_name: String,
  data_source:    String,
  is_archived:    { type: Boolean, default: false },
  archived_at:    Date,
}, schemaOptions);

const roundSchema = new mongoose.Schema({
  name:      String,
  year:      String,
  is_active: { type: Boolean, default: false },
}, schemaOptions);

const levelSchema = new mongoose.Schema({
  name: String,
}, schemaOptions);

const facultySchema = new mongoose.Schema({
  name:     String,
  level_id: String,
}, schemaOptions);

// Models
const User                  = mongoose.model('User', userSchema);
const Program               = mongoose.model('Program', programSchema);
const QualityComponent      = mongoose.model('QualityComponent', qualityComponentSchema, 'quality_components');
const Indicator             = mongoose.model('Indicator', indicatorSchema);
const AssessmentSession     = mongoose.model('AssessmentSession', assessmentSessionSchema, 'assessment_sessions');
const Evaluation            = mongoose.model('Evaluation', evaluationSchema);
const EvaluationActual      = mongoose.model('EvaluationActual', evaluationActualSchema, 'evaluations_actual');
const CommitteeEvaluation   = mongoose.model('CommitteeEvaluation', committeeEvaluationSchema, 'committee_evaluations');
const MasterQualityComponent = mongoose.model('MasterQualityComponent', masterQualityComponentSchema, 'master_quality_components');
const MasterIndicator       = mongoose.model('MasterIndicator', masterIndicatorSchema, 'master_indicators');
const Round                 = mongoose.model('Round', roundSchema);
const Level                 = mongoose.model('Level', levelSchema);
const Faculty               = mongoose.model('Faculty', facultySchema);

// ================= JWT MIDDLEWARE =================
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
}

// ================= MULTER SETUP =================
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('อนุญาตเฉพาะไฟล์ PDF และรูปภาพเท่านั้น'), false);
  },
  limits: { fileSize: 20 * 1024 * 1024, fieldSize: 100 * 1024 * 1024, fields: 100 },
});

// ================= MINIO HELPERS =================
async function uploadToMinio(buffer, filename, mimetype) {
  return new Promise((resolve, reject) => {
    minioClient.putObject(MINIO_BUCKET, filename, buffer, buffer.length, { 'Content-Type': mimetype }, (err) => {
      if (err) reject(err);
      else resolve(filename);
    });
  });
}

async function getMinioPresignedUrl(filename) {
  return new Promise((resolve, reject) => {
    minioClient.presignedGetObject(MINIO_BUCKET, filename, 60 * 60 * 24, (err, url) => {
      if (err) reject(err);
      else resolve(url);
    });
  });
}

async function deleteFromMinio(filename) {
  return new Promise((resolve, reject) => {
    minioClient.removeObject(MINIO_BUCKET, filename, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function generateFilename(originalname) {
  return `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(originalname)}`;
}

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const level = res.statusCode >= 500 ? '❌' : res.statusCode >= 400 ? '⚠️' : '✅';
    console.log(`${level} [${new Date().toLocaleTimeString()}] ${req.method} ${req.path} ${res.statusCode} (${ms}ms)`);
  });
  next();
});

// Global auth middleware — ยกเว้น public routes
const PUBLIC_ROUTES = ['/api/login', '/api/ping', '/api/public-stats'];
app.use((req, res, next) => {
  if (PUBLIC_ROUTES.includes(req.path)) return next();
  return authMiddleware(req, res, next);
});

// ================= AUTH =================
app.post('/api/login', async (req, res) => {
  try {
    const { username, password, role } = req.body;
    const roleMapping = { system_admin:1, sar_manager:2, reporter:3, evaluator:4, external_evaluator:5, executive:6, qa_admin:7 };
    const roleId = roleMapping[role];
    if (!roleId) return res.status(400).json({ success: false, message: 'บทบาทไม่ถูกต้อง' });

    const user = await User.findOne({ email: username, role_id: roleId });
    if (!user) return res.status(401).json({ success: false, message: 'ชื่อผู้ใช้ รหัสผ่าน หรือ Role ไม่ถูกต้อง' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ success: false, message: 'ชื่อผู้ใช้ รหัสผ่าน หรือ Role ไม่ถูกต้อง' });

    const token = jwt.sign({ id: user._id, role_id: user.role_id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    const userData = user.toJSON();
    delete userData.password;
    res.json({ success: true, user: userData, token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ' });
  }
});

// ================= HEALTH CHECK =================
app.get('/api/ping', (req, res) => {
  res.json({ ok: true, pid: process.pid, db: mongoose.connection.readyState === 1, storage: 'minio' });
});

// ================= LEVELS =================
app.get('/api/levels', async (req, res) => {
  try { res.json(await Level.find()); }
  catch (err) { res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลระดับได้' }); }
});
app.post('/api/levels', async (req, res) => {
  try { res.json(await Level.create(req.body)); }
  catch (err) { res.status(500).json({ error: 'เพิ่มระดับไม่สำเร็จ' }); }
});
app.patch('/api/levels/:id', async (req, res) => {
  try { await Level.findByIdAndUpdate(req.params.id, req.body); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: 'แก้ไขระดับไม่สำเร็จ' }); }
});
app.delete('/api/levels/:id', async (req, res) => {
  try { await Level.findByIdAndDelete(req.params.id); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: 'ลบระดับไม่สำเร็จ' }); }
});

// ================= FACULTIES =================
app.get('/api/faculties', async (req, res) => {
  try { res.json(await Faculty.find()); }
  catch (err) { res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลคณะได้' }); }
});
app.post('/api/faculties', async (req, res) => {
  try { res.json(await Faculty.create(req.body)); }
  catch (err) { res.status(500).json({ error: 'เพิ่มคณะไม่สำเร็จ' }); }
});
app.patch('/api/faculties/:id', async (req, res) => {
  try { await Faculty.findByIdAndUpdate(req.params.id, req.body); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: 'แก้ไขคณะไม่สำเร็จ' }); }
});
app.delete('/api/faculties/:id', async (req, res) => {
  try { await Faculty.findByIdAndDelete(req.params.id); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: 'ลบคณะไม่สำเร็จ' }); }
});

// ================= PROGRAMS =================
app.get('/api/programs', async (req, res) => {
  try { res.json(await Program.find()); }
  catch (err) { res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลโปรแกรมได้' }); }
});
app.post('/api/programs', async (req, res) => {
  try { res.json(await Program.create(req.body)); }
  catch (err) { res.status(500).json({ error: 'เพิ่มโปรแกรมไม่สำเร็จ' }); }
});
app.patch('/api/programs/:id', async (req, res) => {
  try { await Program.findByIdAndUpdate(req.params.id, req.body); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: 'แก้ไขโปรแกรมไม่สำเร็จ' }); }
});
app.delete('/api/programs/:id', async (req, res) => {
  try { await Program.findByIdAndDelete(req.params.id); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: 'ลบโปรแกรมไม่สำเร็จ' }); }
});

// ================= QUALITY COMPONENTS =================
app.get('/api/quality-components', async (req, res) => {
  try {
    const { major_name, year } = req.query;
    const filter = {};
    if (major_name) filter.major_name = major_name;
    if (year) filter.year = year;
    const components = await QualityComponent.find(filter).sort({ created_at: -1 });
    res.json(components);
  } catch (err) { res.status(500).json({ error: 'ดึงองค์ประกอบไม่สำเร็จ', details: err.message }); }
});

app.post('/api/quality-components', async (req, res) => {
  try {
    const { quality_name, component_id, session_id, major_name, year } = req.body;
    const doc = await QualityComponent.create({
      quality_name, component_id: parseInt(component_id), session_id, major_name, year: year || null
    });
    res.json({ success: true, id: doc._id });
  } catch (err) { res.status(500).json({ error: 'ไม่สามารถสร้างองค์ประกอบคุณภาพได้', details: err.message }); }
});

app.patch('/api/quality-components/:id', async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.component_id) data.component_id = Number(data.component_id);
    delete data.id;
    await QualityComponent.findByIdAndUpdate(req.params.id, data);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'ไม่สามารถแก้ไของค์ประกอบคุณภาพได้', details: err.message }); }
});

app.delete('/api/quality-components/:id', async (req, res) => {
  try {
    const comp = await QualityComponent.findById(req.params.id);
    if (!comp) return res.status(404).json({ error: 'ไม่พบองค์ประกอบคุณภาพ' });

    // Cascade delete: indicators + evaluations
    const indicators = await Indicator.find({
      component_id: { $in: [comp.component_id, String(comp.component_id), req.params.id] },
      major_name: comp.major_name
    });
    const indicatorIds = indicators.map(i => String(i._id));

    if (indicatorIds.length > 0) {
      await Promise.all([
        Evaluation.deleteMany({ indicator_id: { $in: indicatorIds } }),
        EvaluationActual.deleteMany({ indicator_id: { $in: indicatorIds } }),
        CommitteeEvaluation.deleteMany({ indicator_id: { $in: indicatorIds } }),
        Indicator.deleteMany({ _id: { $in: indicatorIds } }),
      ]);
    }
    await QualityComponent.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'ไม่สามารถลบองค์ประกอบคุณภาพได้', details: err.message }); }
});

// ================= INDICATORS =================
app.get('/api/indicators', async (req, res) => {
  try {
    const { major_name, component_id, year } = req.query;
    const filter = {};
    if (major_name) filter.major_name = major_name;
    if (year) filter.year = year;
    if (component_id) filter.component_id = { $in: [component_id, parseInt(component_id)] };
    const indicators = await Indicator.find(filter);
    indicators.sort((a, b) => String(a.sequence || '').localeCompare(String(b.sequence || ''), undefined, { numeric: true }));
    res.json(indicators);
  } catch (err) { res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลตัวบ่งชี้ได้', details: err.message }); }
});

app.get('/api/indicators-by-component/:componentId', async (req, res) => {
  try {
    const { componentId } = req.params;
    const { major_name, year } = req.query;
    const filter = { component_id: { $in: [componentId, parseInt(componentId)] } };
    if (major_name) filter.major_name = major_name;
    if (year) filter.year = year;
    const indicators = await Indicator.find(filter);
    indicators.sort((a, b) => String(a.sequence || '').localeCompare(String(b.sequence || ''), undefined, { numeric: true }));
    res.json(indicators);
  } catch (err) { res.status(500).json({ error: 'ดึงตัวบ่งชี้ไม่สำเร็จ', details: err.message }); }
});

app.post('/api/indicators', async (req, res) => {
  try {
    const { component_id, sequence, indicator_type, criteria_type, indicator_name, data_source, session_id, major_name, year } = req.body;
    const doc = await Indicator.create({
      component_id: parseInt(component_id), sequence, indicator_type, criteria_type,
      indicator_name, data_source, session_id, major_name, year: year || null
    });
    res.json({ success: true, id: doc._id });
  } catch (err) { res.status(500).json({ error: 'ไม่สามารถสร้างตัวบ่งชี้ได้', details: err.message }); }
});

app.get('/api/indicators/:id', async (req, res) => {
  try {
    const doc = await Indicator.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'ไม่พบตัวบ่งชี้' });
    res.json(doc);
  } catch (err) { res.status(500).json({ error: 'ดึงตัวบ่งชี้ไม่สำเร็จ', details: err.message }); }
});

app.patch('/api/indicators/:id', async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.component_id) data.component_id = parseInt(data.component_id);
    await Indicator.findByIdAndUpdate(req.params.id, data);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'ไม่สามารถแก้ไขตัวบ่งชี้ได้', details: err.message }); }
});

app.delete('/api/indicators/:id', async (req, res) => {
  try { await Indicator.findByIdAndDelete(req.params.id); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: 'ไม่สามารถลบตัวบ่งชี้ได้', details: err.message }); }
});

// ================= BULK OPERATIONS =================
app.post('/api/bulk/indicators', async (req, res) => {
  try {
    const { indicators } = req.body;
    if (!Array.isArray(indicators) || indicators.length === 0)
      return res.status(400).json({ error: 'indicators must be a non-empty array' });
    const docs = indicators.map(i => ({ ...i, component_id: i.component_id ? Number(i.component_id) : i.component_id }));
    const result = await Indicator.insertMany(docs);
    res.json({ success: true, count: result.length, indicators: result });
  } catch (err) { res.status(500).json({ error: 'บันทึกข้อมูลแบบกลุ่มไม่สำเร็จ', details: err.message }); }
});

app.post('/api/bulk/indicators-by-components', async (req, res) => {
  try {
    const { component_ids, major_name } = req.body || {};
    if (!Array.isArray(component_ids)) return res.status(400).json({ error: 'component_ids ต้องเป็นอาเรย์' });
    const filter = { component_id: { $in: component_ids.flatMap(id => [id, parseInt(id)]) } };
    if (major_name) filter.major_name = major_name;
    const indicators = await Indicator.find(filter);
    indicators.sort((a, b) => String(a.sequence || '').localeCompare(String(b.sequence || ''), undefined, { numeric: true }));
    res.json(indicators);
  } catch (err) { res.status(500).json({ error: 'ดึงข้อมูลตัวบ่งชี้แบบกลุ่มไม่สำเร็จ' }); }
});

app.get('/api/bulk/session-summary', async (req, res) => {
  try {
    const { session_id, major_name, year, filter_approved_only } = req.query;
    if (!major_name) return res.status(400).json({ error: 'กรุณาระบุ major_name' });

    const compFilter = { major_name };
    const indFilter  = { major_name };
    if (year) { compFilter.year = year; indFilter.year = year; }

    // สร้าง eval filter แบบ flexible — รองรับทั้ง year และ session_id
    const buildEvalFilter = (extraFilter = {}) => {
      const orConditions = [];
      if (year)       orConditions.push({ major_name, year });
      if (session_id) orConditions.push({ major_name, session_id });
      // fallback: ดึงทั้งหมดของ major ถ้าไม่มี year/session
      if (orConditions.length === 0) return { major_name, ...extraFilter };
      return { $or: orConditions, ...extraFilter };
    };

    const [components, indicators, evaluations, evaluations_actual_raw, committee_evaluations, assessment_sessions] = await Promise.all([
      QualityComponent.find(compFilter),
      Indicator.find(indFilter),
      Evaluation.find(buildEvalFilter()),
      EvaluationActual.find(buildEvalFilter()),
      CommitteeEvaluation.find(buildEvalFilter()),
      AssessmentSession.find({ major_name }),
    ]);

    let evaluations_actual = evaluations_actual_raw;
    if (filter_approved_only === 'true') evaluations_actual = evaluations_actual.filter(ev => ev.status === 'approved');

    indicators.sort((a, b) => String(a.sequence || '').localeCompare(String(b.sequence || ''), undefined, { numeric: true }));
    res.json({ components, evaluations, evaluations_actual, committee_evaluations, indicators, assessment_sessions });
  } catch (err) { res.status(500).json({ error: 'ดึงข้อมูลสรุปไม่สำเร็จ', details: err.message }); }
});

// ================= ASSESSMENT SESSIONS =================
app.post('/api/assessment-sessions', async (req, res) => {
  try {
    const { level_id, faculty_id, faculty_name, major_id, major_name, evaluator_id } = req.body || {};
    if (!level_id) return res.status(400).json({ error: 'level_id จำเป็น' });

    let roundData = {};
    const activeRound = await Round.findOne({ is_active: true });
    if (activeRound) roundData = { round_id: String(activeRound._id), round_year: activeRound.year, round_name: activeRound.name };

    const doc = await AssessmentSession.create({ level_id, faculty_id, faculty_name, major_id, major_name, evaluator_id, ...roundData });
    res.json({ success: true, session_id: doc._id });
  } catch (err) { res.status(500).json({ error: 'สร้างเซสชันไม่สำเร็จ', details: err.message }); }
});

app.get('/api/assessment-sessions/latest', async (req, res) => {
  try {
    const { major_name } = req.query;
    if (!major_name) return res.status(400).json({ error: 'major_name จำเป็น' });
    const latest = await EvaluationActual.findOne({ major_name }).sort({ created_at: -1 });
    if (latest) return res.json({ session_id: String(latest.session_id) });
    const session = await AssessmentSession.findOne({ major_name }).sort({ created_at: -1 });
    res.json({ session_id: session ? String(session._id) : null });
  } catch (err) { res.status(500).json({ error: 'ดึงข้อมูลเซสชันล่าสุดไม่สำเร็จ', details: err.message }); }
});

app.get('/api/assessment-sessions/:id', async (req, res) => {
  try {
    const doc = await AssessmentSession.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'ไม่พบเซสชัน' });
    res.json(doc);
  } catch (err) { res.status(500).json({ error: 'ดึงเซสชันไม่สำเร็จ', details: err.message }); }
});

// ================= EVALUATIONS =================
app.post('/api/evaluations', upload.single('evidence_file'), async (req, res) => {
  try {
    const { session_id, indicator_id, program_id, year, evaluator_id, score, target_value, comment, status, major_name } = req.body;
    let evidenceFileUrl = null, evidenceFileName = null;

    if (req.file) {
      const filename = generateFilename(req.file.originalname);
      await uploadToMinio(req.file.buffer, `evidence/${session_id}/${indicator_id}/${filename}`, req.file.mimetype);
      evidenceFileUrl = await getMinioPresignedUrl(`evidence/${session_id}/${indicator_id}/${filename}`);
      evidenceFileName = req.file.originalname;
    }

    const doc = await Evaluation.create({
      session_id, indicator_id, program_id, year, evaluator_id,
      score: score ? parseFloat(score) : null, target_value, comment,
      evidence_file_url: evidenceFileUrl, evidence_file_name: evidenceFileName,
      status: status || 'submitted', major_name
    });
    res.json({ success: true, evaluation_id: doc._id, evidence_file_url: evidenceFileUrl });
  } catch (err) { res.status(500).json({ error: 'บันทึกผลประเมินไม่สำเร็จ', details: err.message }); }
});

app.get('/api/evaluations', async (req, res) => {
  try {
    const { session_id, major_name, evaluator_id, year } = req.query;
    const filter = {};
    if (session_id) filter.session_id = session_id;
    if (major_name) filter.major_name = major_name;
    if (evaluator_id) filter.evaluator_id = evaluator_id;
    if (year) filter.year = year;
    res.json(await Evaluation.find(filter));
  } catch (err) { res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลการประเมินได้', details: err.message }); }
});

app.get('/api/evaluations/history', async (req, res) => {
  try {
    const { session_id, major_name, year } = req.query;
    const filter = {};
    if (session_id) filter.session_id = session_id;
    if (major_name) filter.major_name = major_name;
    if (year) filter.year = year;
    res.json(await Evaluation.find(filter));
  } catch (err) { res.status(500).json({ error: 'ไม่สามารถดึงประวัติการประเมินได้', details: err.message }); }
});

// ================= EVALUATIONS ACTUAL =================
app.post('/api/evaluations-actual', upload.array('evidence_files', 10), async (req, res) => {
  try {
    const { session_id, indicator_id, operation_result, operation_score, reference_score,
      goal_achievement, evidence_number, evidence_name, evidence_url, comment,
      major_name, status, keep_existing, year, metadata_overrides } = req.body;

    // Block editing approved evaluations
    // Block editing approved evaluations (only check the LATEST record for this indicator/session)
    const latest = await EvaluationActual.findOne({ session_id, indicator_id, major_name }).sort({ created_at: -1 });
    if (latest && latest.status === 'approved') {
      return res.status(403).json({ error: 'cannot_edit_approved', message: 'รายการนี้ได้รับการอนุมัติแล้ว ไม่สามารถแก้ไขได้' });
    }

    let evidenceFiles = [], evidenceMeta = {};

    if (keep_existing === 'true') {
      const existing = latest; // We already fetched it above
      if (existing) {
        evidenceFiles = JSON.parse(existing.evidence_files_json || '[]');
        evidenceMeta  = JSON.parse(existing.evidence_meta_json  || '{}');
      }
    }

    if (metadata_overrides) {
      try {
        const overrides = typeof metadata_overrides === 'string' ? JSON.parse(metadata_overrides) : metadata_overrides;
        Object.keys(overrides).forEach(fn => { if (evidenceMeta[fn]) evidenceMeta[fn] = { ...evidenceMeta[fn], ...overrides[fn] }; });
      } catch (e) { console.error('metadata_overrides parse error:', e); }
    }

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const filename = generateFilename(file.originalname);
        const minioPath = `evidence_actual/${session_id}/${indicator_id}/${filename}`;
        await uploadToMinio(file.buffer, minioPath, file.mimetype);
        const url = await getMinioPresignedUrl(minioPath);
        evidenceFiles.push(filename);
        evidenceMeta[filename] = { name: evidence_name || file.originalname, number: evidence_number || '1', url };
      }
    }

    if (evidence_url) {
      const urlKey = `url_${Date.now()}`;
      evidenceFiles.push(urlKey);
      evidenceMeta[urlKey] = { name: evidence_name || 'URL Evidence', number: evidence_number || '1', url: evidence_url };
    }

    const updateData = {
      operation_result,
      operation_score: operation_score ? parseFloat(operation_score) : null,
      reference_score: reference_score ? parseFloat(reference_score) : null,
      goal_achievement,
      evidence_files_json: JSON.stringify(evidenceFiles),
      evidence_meta_json: JSON.stringify(evidenceMeta),
      comment,
      year: year || null,
      status: status || 'submitted'
    };

    const doc = await EvaluationActual.findOneAndUpdate(
      { _id: latest ? latest._id : new mongoose.Types.ObjectId() },
      { $set: { ...updateData, session_id, indicator_id, major_name } },
      { upsert: true, new: true, runValidators: true }
    );
    res.json({ success: true, evaluation_id: doc._id, evidence_files: evidenceFiles });
  } catch (err) { res.status(500).json({ error: 'บันทึกผลการดำเนินงานไม่สำเร็จ', details: err.message }); }
});

app.get('/api/evaluations-actual/history', async (req, res) => {
  try {
    const { session_id, major_name, year } = req.query;
    if (!major_name) return res.status(400).json({ error: 'กรุณาระบุ major_name' });
    const filter = { major_name };
    if (year) filter.year = year;
    if (session_id) filter.session_id = session_id;
    res.json(await EvaluationActual.find(filter).sort({ created_at: -1 }));
  } catch (err) { res.status(500).json({ error: 'ไม่สามารถดึงประวัติการดำเนินงานได้', details: err.message }); }
});

// Append files to latest actual evaluation
app.post('/api/evaluations-actual/append-files', upload.array('evidence_files', 10), async (req, res) => {
  try {
    const { session_id, indicator_id, major_name, evidence_number, evidence_name } = req.body;
    if (!session_id || !indicator_id) return res.status(400).json({ error: 'ต้องระบุ session_id และ indicator_id' });

    let targetEval = await EvaluationActual.findOne({ session_id, indicator_id, major_name }).sort({ created_at: -1 });
    if (!targetEval) {
      targetEval = new EvaluationActual({ session_id, indicator_id, major_name, evidence_files_json: '[]', evidence_meta_json: '{}', status: 'submitted' });
    }

    const evidenceFiles = JSON.parse(targetEval.evidence_files_json || '[]');
    const evidenceMeta  = JSON.parse(targetEval.evidence_meta_json  || '{}');

    for (const file of (req.files || [])) {
      const filename = generateFilename(file.originalname);
      const minioPath = `evidence_actual/${session_id}/${indicator_id}/${filename}`;
      await uploadToMinio(file.buffer, minioPath, file.mimetype);
      const url = await getMinioPresignedUrl(minioPath);
      evidenceFiles.push(filename);
      evidenceMeta[filename] = { name: evidence_name || file.originalname, number: evidence_number || '1', url };
    }

    await EvaluationActual.findOneAndUpdate(
      { _id: targetEval._id },
      { 
        $set: { 
          evidence_files_json: JSON.stringify(evidenceFiles),
          evidence_meta_json: JSON.stringify(evidenceMeta)
        } 
      }
    );
    res.json({ success: true, files: evidenceFiles, meta: evidenceMeta });
  } catch (err) { res.status(500).json({ error: 'เพิ่มไฟล์ไม่สำเร็จ', details: err.message }); }
});

// Remove file from actual evaluation
app.post('/api/evaluations-actual/remove-file', async (req, res) => {
  try {
    const { session_id, indicator_id, major_name, filename } = req.body;
    if (!session_id || !indicator_id || !filename) return res.status(400).json({ error: 'ต้องระบุ session_id, indicator_id และ filename' });

    const targetEval = await EvaluationActual.findOne({ session_id, indicator_id, major_name }).sort({ created_at: -1 });
    if (!targetEval) return res.status(404).json({ error: 'ไม่พบข้อมูลการประเมิน' });

    const evidenceFiles = JSON.parse(targetEval.evidence_files_json || '[]').filter(f => f !== filename);
    const evidenceMeta  = JSON.parse(targetEval.evidence_meta_json  || '{}');
    delete evidenceMeta[filename];

    await EvaluationActual.findOneAndUpdate(
      { _id: targetEval._id },
      { 
        $set: { 
          evidence_files_json: JSON.stringify(evidenceFiles),
          evidence_meta_json: JSON.stringify(evidenceMeta)
        } 
      }
    );

    // Try to delete from MinIO
    try { await deleteFromMinio(`evidence_actual/${session_id}/${indicator_id}/${filename}`); } catch (e) { /* ignore */ }

    res.json({ success: true, files: evidenceFiles });
  } catch (err) { res.status(500).json({ error: 'ลบไฟล์ไม่สำเร็จ', details: err.message }); }
});

// Workflow: submit / approve / reject
app.post('/api/evaluations-actual/:id/submit', async (req, res) => {
  try { await EvaluationActual.findByIdAndUpdate(req.params.id, { status: 'pending_review', submitted_at: new Date() }); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/evaluations-actual/:id/approve', async (req, res) => {
  try { await EvaluationActual.findByIdAndUpdate(req.params.id, { status: 'approved', approved_at: new Date(), approved_by: req.body.approved_by || 'Manager' }); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/evaluations-actual/:id/reject', async (req, res) => {
  try { await EvaluationActual.findByIdAndUpdate(req.params.id, { status: 'revision_requested', feedback: req.body.feedback || '', rejected_at: new Date(), rejected_by: req.body.rejected_by || 'Manager' }); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ================= COMMITTEE EVALUATIONS =================
app.post('/api/committee-evaluations', async (req, res) => {
  try {
    const { session_id, major_name, indicator_id, committee_score, strengths, improvements, development_plan, year } = req.body;
    const doc = await CommitteeEvaluation.create({
      session_id, major_name, indicator_id,
      committee_score: committee_score ? parseFloat(committee_score) : null,
      strengths, improvements, development_plan, year: year || null
    });
    res.json({ success: true, id: doc._id });
  } catch (err) { res.status(500).json({ error: 'บันทึกการประเมินของคณะกรรมการไม่สำเร็จ', details: err.message }); }
});

app.get('/api/committee-evaluations', async (req, res) => {
  try {
    const { session_id, major_name, indicator_id, year } = req.query;
    const filter = {};
    if (session_id) filter.session_id = session_id;
    if (major_name) filter.major_name = major_name;
    if (indicator_id) filter.indicator_id = indicator_id;
    if (year) filter.year = year;
    res.json(await CommitteeEvaluation.find(filter));
  } catch (err) { res.status(500).json({ error: 'ดึงข้อมูลการประเมินคณะกรรมการไม่สำเร็จ', details: err.message }); }
});

// ================= MASTER QUALITY COMPONENTS =================
app.get('/api/master-quality-components', async (req, res) => {
  try { res.json(await MasterQualityComponent.find().sort({ component_id: 1 })); }
  catch (err) { res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลแม่แบบองค์ประกอบได้' }); }
});
app.post('/api/master-quality-components', async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.component_id) data.component_id = parseInt(data.component_id);
    const doc = await MasterQualityComponent.create(data);
    res.json({ id: doc._id, ...doc.toObject() });
  } catch (err) { res.status(500).json({ error: 'ไม่สามารถสร้างแม่แบบองค์ประกอบได้' }); }
});
app.patch('/api/master-quality-components/:id', async (req, res) => {
  try {
    const data = { ...req.body }; delete data.id;
    if (data.component_id) data.component_id = parseInt(data.component_id);
    await MasterQualityComponent.findByIdAndUpdate(req.params.id, data);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'ไม่สามารถแก้ไขแม่แบบองค์ประกอบได้' }); }
});
app.delete('/api/master-quality-components/:id', async (req, res) => {
  try { await MasterQualityComponent.findByIdAndDelete(req.params.id); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: 'ไม่สามารถลบแม่แบบองค์ประกอบได้' }); }
});

// ================= MASTER INDICATORS =================
app.get('/api/master-indicators', async (req, res) => {
  try {
    const items = await MasterIndicator.find();
    items.sort((a, b) => String(a.sequence || '').localeCompare(String(b.sequence || ''), undefined, { numeric: true }));
    res.json(items);
  } catch (err) { res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลแม่แบบตัวบ่งชี้ได้' }); }
});

app.post('/api/master-indicators', async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.component_id) data.component_id = parseInt(data.component_id);
    // Check duplicate sequence
    if (data.sequence && data.component_id) {
      const dup = await MasterIndicator.findOne({ component_id: data.component_id, sequence: data.sequence });
      if (dup) return res.status(400).json({ error: `ลำดับ "${data.sequence}" มีอยู่แล้วในองค์ประกอบนี้ กรุณาใช้ลำดับอื่น` });
    }
    const doc = await MasterIndicator.create(data);
    res.json({ id: doc._id, ...doc.toObject() });
  } catch (err) { res.status(500).json({ error: 'ไม่สามารถสร้างแม่แบบตัวบ่งชี้ได้' }); }
});

app.post('/api/master-indicators/bulk', async (req, res) => {
  try {
    const items = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'ข้อมูลต้องเป็นอาเรย์' });
    // Check duplicates within batch
    const seen = new Set();
    for (const item of items) {
      const key = `${item.component_id}-${item.sequence}`;
      if (seen.has(key)) return res.status(400).json({ error: `ลำดับ "${item.sequence}" ซ้ำกันในรายการที่กำลังเพิ่ม` });
      seen.add(key);
      // Check against DB
      const dup = await MasterIndicator.findOne({ component_id: parseInt(item.component_id), sequence: item.sequence });
      if (dup) return res.status(400).json({ error: `ลำดับ "${item.sequence}" มีอยู่แล้วในองค์ประกอบนี้` });
    }
    const docs = items.map(i => ({ ...i, component_id: i.component_id ? parseInt(i.component_id) : i.component_id }));
    const result = await MasterIndicator.insertMany(docs);
    res.json(result);
  } catch (err) { res.status(500).json({ error: 'ไม่สามารถสร้างแม่แบบตัวบ่งชี้แบบกลุ่มได้' }); }
});

app.patch('/api/master-indicators/:id', async (req, res) => {
  try {
    const data = { ...req.body }; delete data.id;
    if (data.component_id) data.component_id = parseInt(data.component_id);
    if (data.sequence && data.component_id) {
      const dup = await MasterIndicator.findOne({ component_id: data.component_id, sequence: data.sequence, _id: { $ne: req.params.id } });
      if (dup) return res.status(400).json({ error: `ลำดับ "${data.sequence}" มีอยู่แล้วในองค์ประกอบนี้` });
    }
    await MasterIndicator.findByIdAndUpdate(req.params.id, data);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'ไม่สามารถแก้ไขแม่แบบตัวบ่งชี้ได้' }); }
});

app.delete('/api/master-indicators/:id', async (req, res) => {
  try {
    const master = await MasterIndicator.findById(req.params.id);
    if (!master) return res.status(404).json({ error: 'ไม่พบแม่แบบตัวบ่งชี้' });
    const inUse = await Indicator.findOne({ sequence: master.sequence, component_id: master.component_id });
    if (inUse) {
      await MasterIndicator.findByIdAndUpdate(req.params.id, { is_archived: true, archived_at: new Date() });
      return res.json({ success: true, archived: true, message: 'แม่แบบนี้ถูกใช้งานอยู่ ระบบได้ทำการ Archive แทนการลบ' });
    }
    await MasterIndicator.findByIdAndDelete(req.params.id);
    res.json({ success: true, deleted: true });
  } catch (err) { res.status(500).json({ error: 'ไม่สามารถลบแม่แบบตัวบ่งชี้ได้' }); }
});

app.patch('/api/master-indicators/:id/restore', async (req, res) => {
  try { await MasterIndicator.findByIdAndUpdate(req.params.id, { is_archived: false, archived_at: null }); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: 'ไม่สามารถกู้คืนแม่แบบได้' }); }
});

// ================= USER MANAGEMENT =================
app.get('/api/users', async (req, res) => {
  try {
    const { role_id } = req.query;
    const filter = {};
    if (role_id) filter.role_id = parseInt(role_id);
    const users = await User.find(filter).select('-password');
    res.json(users);
  } catch (err) { res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลผู้ใช้งานได้', details: err.message }); }
});

app.post('/api/users', async (req, res) => {
  try {
    const { email, password, role_id, first_name, last_name, faculty_id, major_id, major_name } = req.body;
    if (!email || !password || !role_id || !first_name || !last_name)
      return res.status(400).json({ success: false, message: 'ข้อมูลไม่ครบถ้วน (Email, Password, Role, ชื่อ, นามสกุล จำเป็น)' });

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ success: false, message: 'ผู้ใช้งานนี้มีอยู่ในระบบแล้ว' });

    const hashed = await bcrypt.hash(password, 12);
    const doc = await User.create({
      email, password: hashed, role_id: parseInt(role_id),
      first_name, last_name, full_name: `${first_name} ${last_name}`.trim(),
      faculty_id: faculty_id || null, major_id: major_id || null, major_name: major_name || null
    });
    res.json({ success: true, id: doc._id, message: 'สร้างผู้ใช้งานสำเร็จ' });
  } catch (err) { res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการสร้างผู้ใช้งาน', details: err.message }); }
});

app.patch('/api/users/:id', async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.password) data.password = await bcrypt.hash(data.password, 12);
    if (data.first_name || data.last_name) {
      const user = await User.findById(req.params.id);
      data.full_name = `${data.first_name || user.first_name} ${data.last_name || user.last_name}`.trim();
    }
    delete data.id;
    await User.findByIdAndUpdate(req.params.id, data);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: 'แก้ไขผู้ใช้งานไม่สำเร็จ', details: err.message }); }
});

app.delete('/api/users/:id', async (req, res) => {
  try { await User.findByIdAndDelete(req.params.id); res.json({ success: true }); }
  catch (err) { res.status(500).json({ success: false, message: 'ลบผู้ใช้งานไม่สำเร็จ' }); }
});

// ================= FILE VIEW =================
app.get('/api/view/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    // Search in evaluations
    const ev = await Evaluation.findOne({ evidence_file_name: filename });
    if (ev && ev.evidence_file_url) return res.redirect(ev.evidence_file_url);

    // Search in evaluations_actual meta
    const actuals = await EvaluationActual.find({ evidence_meta_json: { $regex: filename } });
    for (const doc of actuals) {
      const meta = JSON.parse(doc.evidence_meta_json || '{}');
      if (meta[filename]?.url) return res.redirect(meta[filename].url);
    }

    // Try to get presigned URL from MinIO (validate object exists first)
    try {
      await new Promise((resolve, reject) => {
        minioClient.statObject(MINIO_BUCKET, filename, (err, stat) => {
          if (err) reject(err); else resolve(stat);
        });
      });
      const url = await getMinioPresignedUrl(filename);
      return res.redirect(url);
    } catch (e) { /* not found in minio */ }

    res.status(404).send('<h2>ไม่พบไฟล์</h2><a href="javascript:history.back()">← ย้อนกลับ</a>');
  } catch (err) { res.status(500).json({ error: 'เกิดข้อผิดพลาดในการเรียกดูไฟล์' }); }
});

// ================= PDF GENERATION =================
app.post('/api/generate-pdf', async (req, res) => {
  try {
    const pdfBuffer = await generatePDF(req.body);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=ESAR_Report_${encodeURIComponent(req.body.program_name)}.pdf`);
    res.send(pdfBuffer);
  } catch (err) { res.status(500).json({ error: 'ไม่สามารถสร้างไฟล์ PDF ได้', details: err.message }); }
});

// ================= ROUNDS =================
app.get('/api/rounds', async (req, res) => {
  try { res.json(await Round.find().sort({ created_at: -1 })); }
  catch (err) { res.status(500).json({ error: 'ดึงข้อมูล rounds ไม่สำเร็จ' }); }
});
app.post('/api/rounds', async (req, res) => {
  try { const doc = await Round.create(req.body); res.json({ success: true, id: doc._id }); }
  catch (err) { res.status(500).json({ error: 'สร้าง round ไม่สำเร็จ' }); }
});
app.patch('/api/rounds/:id', async (req, res) => {
  try { await Round.findByIdAndUpdate(req.params.id, req.body); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: 'แก้ไข round ไม่สำเร็จ' }); }
});
// PUT alias for PATCH (frontend uses PUT for rounds)
app.put('/api/rounds/:id', async (req, res) => {
  try { await Round.findByIdAndUpdate(req.params.id, req.body); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: 'แก้ไข round ไม่สำเร็จ' }); }
});
app.delete('/api/rounds/:id', async (req, res) => {
  try { await Round.findByIdAndDelete(req.params.id); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: 'ลบ round ไม่สำเร็จ' }); }
});

// ================= PUBLIC STATS =================
app.get('/api/public-stats', async (req, res) => {
  try {
    const [userCount, indicatorCount, approvedEvals] = await Promise.all([
      User.countDocuments(),
      Indicator.countDocuments(),
      EvaluationActual.find({ status: 'approved' }),
    ]);

    let averageScore = 0;
    if (approvedEvals.length > 0) {
      const sum = approvedEvals.reduce((acc, curr) => acc + (curr.operation_score || 0), 0);
      averageScore = (sum / approvedEvals.length).toFixed(1);
    }

    // Calculate topComponents progress
    const components = await QualityComponent.find();
    // Use a Map to group by name to handle duplicates from different sessions
    const componentMap = new Map(); 
    for (const comp of components) {
      if (!componentMap.has(comp.quality_name)) {
        componentMap.set(comp.quality_name, { id: comp.component_id, name: comp.quality_name });
      }
    }

    const topComponents = [];
    const uniqueCompNames = Array.from(componentMap.keys()).slice(0, 3);

    for (const name of uniqueCompNames) {
      const compInfo = componentMap.get(name);
      // Find all indicators for this component ID (agnostic of session for global stats)
      const indicators = await Indicator.find({ component_id: compInfo.id });
      if (indicators.length === 0) {
        topComponents.push({ name, progress: 0 });
        continue;
      }

      const indicatorIds = indicators.map(ind => String(ind._id));
      const approvedCountForComp = await EvaluationActual.countDocuments({
        indicator_id: { $in: indicatorIds },
        status: 'approved'
      });

      const progress = Math.round((approvedCountForComp / indicators.length) * 100);
      topComponents.push({ name, progress });
    }

    res.json({
      userCount,
      indicatorCount,
      averageScore: String(averageScore),
      topComponents: topComponents.length > 0 ? topComponents : [
        { name: 'องค์ประกอบที่ 1', progress: 0 },
        { name: 'องค์ประกอบที่ 2', progress: 0 },
        { name: 'องค์ประกอบที่ 3', progress: 0 }
      ]
    });
  } catch (err) {
    res.json({ userCount: 0, indicatorCount: 0, averageScore: "0.0", topComponents: [] });
  }
});

// ================= RESET ASSESSMENT DATA =================
app.post('/api/admin/reset-assessment-data', async (req, res) => {
  try {
    const { year } = req.body;
    const modelMap = [
      { model: QualityComponent, yearField: 'year' },
      { model: Indicator,        yearField: 'year' },
      { model: Evaluation,       yearField: 'year' },
      { model: EvaluationActual, yearField: 'year' },
      { model: CommitteeEvaluation, yearField: 'year' },
      { model: AssessmentSession,   yearField: 'round_year' },
    ];
    let totalDeleted = 0;
    for (const { model, yearField } of modelMap) {
      const filter = year ? { [yearField]: String(year) } : {};
      const result = await model.deleteMany(filter);
      totalDeleted += result.deletedCount;
    }
    res.json({ success: true, message: `รีเซ็ตข้อมูลการประเมิน${year ? `ปี ${year} ` : ''}เรียบร้อยแล้ว จำนวน ${totalDeleted} รายการ` });
  } catch (err) { res.status(500).json({ error: 'รีเซ็ตข้อมูลไม่สำเร็จ', details: err.message }); }
});

// ================= DB ADMIN =================
app.get('/api/admin/db-stats', async (req, res) => {
  try {
    const [qc, ind, ev, eva, ce, as, us, ro, pr, mqc, mi] = await Promise.all([
      QualityComponent.countDocuments(), Indicator.countDocuments(),
      Evaluation.countDocuments(), EvaluationActual.countDocuments(),
      CommitteeEvaluation.countDocuments(), AssessmentSession.countDocuments(),
      User.countDocuments(), Round.countDocuments(), Program.countDocuments(),
      MasterQualityComponent.countDocuments(), MasterIndicator.countDocuments(),
    ]);
    res.json({ quality_components: qc, indicators: ind, evaluations: ev, evaluations_actual: eva,
      committee_evaluations: ce, assessment_sessions: as, users: us, rounds: ro, programs: pr,
      master_quality_components: mqc, master_indicators: mi });
  } catch (err) { res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลสถิติฐานข้อมูลได้', details: err.message }); }
});

app.post('/api/admin/clear-collection', async (req, res) => {
  try {
    const modelMap = {
      quality_components: QualityComponent, indicators: Indicator, evaluations: Evaluation,
      evaluations_actual: EvaluationActual, committee_evaluations: CommitteeEvaluation, assessment_sessions: AssessmentSession
    };
    const { collection } = req.body;
    if (!modelMap[collection]) return res.status(400).json({ error: 'ไม่อนุญาตให้ลบข้อมูลในคอลเลกชันนี้' });
    const result = await modelMap[collection].deleteMany({});
    res.json({ success: true, message: `ล้างข้อมูลใน ${collection} จำนวน ${result.deletedCount} รายการ เรียบร้อยแล้ว` });
  } catch (err) { res.status(500).json({ error: 'ไม่สามารถล้างข้อมูลได้', details: err.message }); }
});

// ================= ESAR METADATA =================
const esarMetadataSchema = new mongoose.Schema({
  year:      { type: String, required: true },
  major_name:{ type: String, required: true },
  data:      { type: mongoose.Schema.Types.Mixed, default: {} },
}, schemaOptions);
esarMetadataSchema.index({ year: 1, major_name: 1 }, { unique: true });
const EsarMetadata = mongoose.model('EsarMetadata', esarMetadataSchema, 'esar_metadata');

app.get('/api/esar-metadata', async (req, res) => {
  try {
    const { year, major_name } = req.query;
    if (!year || !major_name) return res.json({});
    const doc = await EsarMetadata.findOne({ year, major_name });
    res.json(doc ? doc.data : {});
  } catch (err) { res.status(500).json({ error: 'ดึงข้อมูล ESAR metadata ไม่สำเร็จ', details: err.message }); }
});

app.post('/api/esar-metadata', async (req, res) => {
  try {
    const { year, major_name, data } = req.body;
    if (!year || !major_name) return res.status(400).json({ error: 'ต้องระบุ year และ major_name' });
    await EsarMetadata.findOneAndUpdate(
      { year, major_name },
      { data },
      { upsert: true, new: true }
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'บันทึกข้อมูล ESAR metadata ไม่สำเร็จ', details: err.message }); }
});

// ================= SERVE FRONTEND =================
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

// ================= START SERVER =================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

module.exports = app;
