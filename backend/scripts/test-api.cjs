#!/usr/bin/env node
/**
 * AUNQA-ESAR API Test Script
 * รัน: node scripts/test-api.cjs
 * ทดสอบ CRUD ทุก endpoint แล้ว cleanup ข้อมูลทดสอบออกทั้งหมด
 */

const http = require('http');
require('dotenv').config();

const BASE = `http://localhost:${process.env.PORT || 5000}`;
let TOKEN = '';
let PASS = 0, FAIL = 0;

// ─── HTTP helpers ────────────────────────────────────────────────────────────
function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost',
      port: process.env.PORT || 5000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const req = http.request(opts, (res) => {
      let raw = '';
      res.on('data', (c) => (raw += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// ─── Test helpers ────────────────────────────────────────────────────────────
const colors = { green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', cyan: '\x1b[36m', reset: '\x1b[0m', bold: '\x1b[1m' };
const c = (color, text) => `${colors[color]}${text}${colors.reset}`;

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ${c('green', '✓')} ${label}`);
    PASS++;
  } else {
    console.log(`  ${c('red', '✗')} ${label}${detail ? ` — ${c('yellow', detail)}` : ''}`);
    FAIL++;
  }
}

function section(name) {
  console.log(`\n${c('cyan', c('bold', `▶ ${name}`))}`);
}

// ─── Cleanup registry ────────────────────────────────────────────────────────
const cleanup = [];
function registerCleanup(method, path) { cleanup.push({ method, path }); }

// ─── Tests ───────────────────────────────────────────────────────────────────
async function run() {
  console.log(c('bold', '\n╔══════════════════════════════════════╗'));
  console.log(c('bold',   '║   AUNQA-ESAR API Test Suite          ║'));
  console.log(c('bold',   '╚══════════════════════════════════════╝'));
  console.log(`Target: ${c('cyan', BASE)}\n`);

  // ── 1. Health ──────────────────────────────────────────────────────────────
  section('Health Check');
  const ping = await request('GET', '/api/ping');
  assert('GET /api/ping → 200', ping.status === 200);
  assert('DB connected', ping.body.db === true, `db=${ping.body.db}`);
  assert('Storage is minio', ping.body.storage === 'minio');

  // ── 2. Auth ────────────────────────────────────────────────────────────────
  section('Authentication');

  // สร้าง test admin user ก่อน (ใช้ bcrypt hash ตรงๆ)
  const bcrypt = require('bcryptjs');
  const mongoose = require('mongoose');
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/aunqa_db');
  const UserModel = mongoose.model('User', new mongoose.Schema({
    email: String, password: String, first_name: String, last_name: String,
    full_name: String, role_id: Number, faculty_id: String, major_id: String, major_name: String,
  }));
  const testEmail = `test_admin_${Date.now()}@test.local`;
  const hash = await bcrypt.hash('TestPass123!', 10);
  const testUser = await UserModel.create({
    email: testEmail, password: hash,
    first_name: 'Test', last_name: 'Admin', full_name: 'Test Admin',
    role_id: 1,
  });
  console.log(`  ${c('yellow', '→')} Created temp admin: ${testEmail}`);

  const loginOk = await request('POST', '/api/login', { username: testEmail, password: 'TestPass123!', role: 'system_admin' });
  assert('POST /api/login → 200', loginOk.status === 200);
  assert('Returns token', !!loginOk.body.token);
  assert('success: true', loginOk.body.success === true);
  TOKEN = loginOk.body.token;

  const loginBad = await request('POST', '/api/login', { username: 'wrong@test.com', password: 'bad', role: 'system_admin' });
  assert('Login with wrong creds → 401', loginBad.status === 401);

  const noToken = await request('GET', '/api/users');
  assert('No token → 401', noToken.status === 401);

  const badToken = await request('GET', '/api/users', null, 'invalid.token.here');
  assert('Invalid token → 401', badToken.status === 401);

  // ── 3. Rounds ──────────────────────────────────────────────────────────────
  section('Rounds CRUD');
  const roundCreate = await request('POST', '/api/rounds', { name: 'TEST Round 2569', year: '2569', is_active: false }, TOKEN);
  assert('POST /api/rounds → 200', roundCreate.status === 200);
  const roundId = roundCreate.body.id || roundCreate.body._id;
  assert('Returns id', !!roundId);
  registerCleanup('DELETE', `/api/rounds/${roundId}`);

  const roundsGet = await request('GET', '/api/rounds', null, TOKEN);
  assert('GET /api/rounds → 200', roundsGet.status === 200);
  assert('Returns array', Array.isArray(roundsGet.body));
  assert('Contains created round', roundsGet.body.some(r => r.id === roundId || r._id === roundId));

  const roundPatch = await request('PUT', `/api/rounds/${roundId}`, { name: 'TEST Round 2569 (updated)' }, TOKEN);
  assert('PUT /api/rounds/:id → 200', roundPatch.status === 200);

  // ── 4. Programs ────────────────────────────────────────────────────────────
  section('Programs CRUD');
  const progCreate = await request('POST', '/api/programs', { majorName: 'TEST Major', facultyName: 'TEST Faculty', levelId: '1' }, TOKEN);
  assert('POST /api/programs → 200', progCreate.status === 200);
  const progId = progCreate.body.id || progCreate.body._id;
  assert('Returns id', !!progId);
  registerCleanup('DELETE', `/api/programs/${progId}`);

  const progsGet = await request('GET', '/api/programs', null, TOKEN);
  assert('GET /api/programs → 200', progsGet.status === 200);
  assert('Returns array', Array.isArray(progsGet.body));

  const progPatch = await request('PATCH', `/api/programs/${progId}`, { majorName: 'TEST Major (updated)' }, TOKEN);
  assert('PATCH /api/programs/:id → 200', progPatch.status === 200);

  // ── 5. Levels & Faculties ──────────────────────────────────────────────────
  section('Levels & Faculties CRUD');
  const levelCreate = await request('POST', '/api/levels', { name: 'TEST Level' }, TOKEN);
  assert('POST /api/levels → 200', levelCreate.status === 200);
  const levelId = levelCreate.body.id || levelCreate.body._id;
  registerCleanup('DELETE', `/api/levels/${levelId}`);

  const levelsGet = await request('GET', '/api/levels', null, TOKEN);
  assert('GET /api/levels → 200', levelsGet.status === 200);

  const facCreate = await request('POST', '/api/faculties', { name: 'TEST Faculty', level_id: levelId }, TOKEN);
  assert('POST /api/faculties → 200', facCreate.status === 200);
  const facId = facCreate.body.id || facCreate.body._id;
  registerCleanup('DELETE', `/api/faculties/${facId}`);

  const facsGet = await request('GET', '/api/faculties', null, TOKEN);
  assert('GET /api/faculties → 200', facsGet.status === 200);

  // ── 6. Quality Components ──────────────────────────────────────────────────
  section('Quality Components CRUD');
  const testMajor = `TEST_MAJOR_${Date.now()}`;
  const compCreate = await request('POST', '/api/quality-components', {
    quality_name: 'TEST AUN.1', component_id: 1, major_name: testMajor, year: '2569'
  }, TOKEN);
  assert('POST /api/quality-components → 200', compCreate.status === 200);
  const compId = compCreate.body.id;
  assert('Returns id', !!compId);
  registerCleanup('DELETE', `/api/quality-components/${compId}`);

  const compsGet = await request('GET', `/api/quality-components?major_name=${encodeURIComponent(testMajor)}&year=2569`, null, TOKEN);
  assert('GET /api/quality-components → 200', compsGet.status === 200);
  assert('Returns created component', compsGet.body.some(c => c.id === compId));

  const compPatch = await request('PATCH', `/api/quality-components/${compId}`, { quality_name: 'TEST AUN.1 (updated)' }, TOKEN);
  assert('PATCH /api/quality-components/:id → 200', compPatch.status === 200);

  // ── 7. Indicators ──────────────────────────────────────────────────────────
  section('Indicators CRUD');
  const indCreate = await request('POST', '/api/indicators', {
    component_id: 1, sequence: '1.1', indicator_name: 'TEST Indicator',
    major_name: testMajor, year: '2569'
  }, TOKEN);
  assert('POST /api/indicators → 200', indCreate.status === 200);
  const indId = indCreate.body.id;
  assert('Returns id', !!indId);
  registerCleanup('DELETE', `/api/indicators/${indId}`);

  const indsGet = await request('GET', `/api/indicators?major_name=${encodeURIComponent(testMajor)}&year=2569`, null, TOKEN);
  assert('GET /api/indicators → 200', indsGet.status === 200);
  assert('Returns created indicator', indsGet.body.some(i => i.id === indId));

  const indById = await request('GET', `/api/indicators/${indId}`, null, TOKEN);
  assert('GET /api/indicators/:id → 200', indById.status === 200);
  assert('Correct indicator_name', indById.body.indicator_name === 'TEST Indicator');

  const indPatch = await request('PATCH', `/api/indicators/${indId}`, { indicator_name: 'TEST Indicator (updated)' }, TOKEN);
  assert('PATCH /api/indicators/:id → 200', indPatch.status === 200);

  const indsByComp = await request('GET', `/api/indicators-by-component/1?major_name=${encodeURIComponent(testMajor)}&year=2569`, null, TOKEN);
  assert('GET /api/indicators-by-component/:id → 200', indsByComp.status === 200);

  // ── 8. Assessment Session ──────────────────────────────────────────────────
  section('Assessment Sessions');
  const sessCreate = await request('POST', '/api/assessment-sessions', {
    level_id: '1', faculty_id: '1', faculty_name: 'TEST Faculty',
    major_id: '1', major_name: testMajor, evaluator_id: testUser._id.toString()
  }, TOKEN);
  assert('POST /api/assessment-sessions → 200', sessCreate.status === 200);
  const sessionId = sessCreate.body.session_id;
  assert('Returns session_id', !!sessionId);

  const sessLatest = await request('GET', `/api/assessment-sessions/latest?major_name=${encodeURIComponent(testMajor)}`, null, TOKEN);
  assert('GET /api/assessment-sessions/latest → 200', sessLatest.status === 200);

  // ── 9. Bulk Session Summary ────────────────────────────────────────────────
  section('Bulk Session Summary');
  const summary = await request('GET', `/api/bulk/session-summary?major_name=${encodeURIComponent(testMajor)}&year=2569`, null, TOKEN);
  assert('GET /api/bulk/session-summary → 200', summary.status === 200);
  assert('Has components', Array.isArray(summary.body.components));
  assert('Has indicators', Array.isArray(summary.body.indicators));
  assert('Has evaluations_actual', Array.isArray(summary.body.evaluations_actual));
  assert('Has committee_evaluations', Array.isArray(summary.body.committee_evaluations));

  // ── 10. Evaluations Actual ─────────────────────────────────────────────────
  section('Evaluations Actual');
  const evalHistory = await request('GET', `/api/evaluations-actual/history?major_name=${encodeURIComponent(testMajor)}&year=2569`, null, TOKEN);
  assert('GET /api/evaluations-actual/history → 200', evalHistory.status === 200);
  assert('Returns array', Array.isArray(evalHistory.body));

  // ── 11. Committee Evaluations ──────────────────────────────────────────────
  section('Committee Evaluations');
  const commCreate = await request('POST', '/api/committee-evaluations', {
    session_id: sessionId, major_name: testMajor, indicator_id: indId,
    committee_score: 3, strengths: '<p>จุดเด่น</p>',
    improvements: '<p>จุดพัฒนา</p>', development_plan: '<p>แผน</p>', year: '2569'
  }, TOKEN);
  assert('POST /api/committee-evaluations → 200', commCreate.status === 200);

  const commGet = await request('GET', `/api/committee-evaluations?major_name=${encodeURIComponent(testMajor)}&year=2569`, null, TOKEN);
  assert('GET /api/committee-evaluations → 200', commGet.status === 200);
  assert('Returns array', Array.isArray(commGet.body));

  // ── 12. Master Data ────────────────────────────────────────────────────────
  section('Master Data');
  const masterCompCreate = await request('POST', '/api/master-quality-components', {
    quality_name: 'TEST Master Component', component_id: 99
  }, TOKEN);
  assert('POST /api/master-quality-components → 200', masterCompCreate.status === 200);
  const masterCompId = masterCompCreate.body.id;
  registerCleanup('DELETE', `/api/master-quality-components/${masterCompId}`);

  const masterCompsGet = await request('GET', '/api/master-quality-components', null, TOKEN);
  assert('GET /api/master-quality-components → 200', masterCompsGet.status === 200);

  const masterIndCreate = await request('POST', '/api/master-indicators', {
    component_id: 99, sequence: '99.1', indicator_name: 'TEST Master Indicator'
  }, TOKEN);
  assert('POST /api/master-indicators → 200', masterIndCreate.status === 200);
  const masterIndId = masterIndCreate.body.id;
  registerCleanup('DELETE', `/api/master-indicators/${masterIndId}`);

  const masterIndsGet = await request('GET', '/api/master-indicators', null, TOKEN);
  assert('GET /api/master-indicators → 200', masterIndsGet.status === 200);

  // ── 13. ESAR Metadata ──────────────────────────────────────────────────────
  section('ESAR Metadata');
  const esarSave = await request('POST', '/api/esar-metadata', {
    major_name: testMajor, year: '2569',
    university_info: '<p>TEST</p>', program_info: '<p>TEST</p>'
  }, TOKEN);
  assert('POST /api/esar-metadata → 200', esarSave.status === 200);

  const esarGet = await request('GET', `/api/esar-metadata?major_name=${encodeURIComponent(testMajor)}&year=2569`, null, TOKEN);
  assert('GET /api/esar-metadata → 200', esarGet.status === 200);

  // ── 14. Security ───────────────────────────────────────────────────────────
  section('Security');
  const typoEndpoint = await request('POST', '/api/evaluation_tual/remove-file', {}, TOKEN);
  assert('Typo endpoint removed → 404', typoEndpoint.status === 404);

  const fileNotFound = await request('GET', '/api/view/nonexistent_file_xyz_12345.pdf', null, TOKEN);
  assert('GET /api/view/nonexistent → 404', fileNotFound.status === 404);

  // ── 15. Admin ──────────────────────────────────────────────────────────────
  section('Admin');
  const dbStats = await request('GET', '/api/admin/db-stats', null, TOKEN);
  assert('GET /api/admin/db-stats → 200', dbStats.status === 200);

  const pubStats = await request('GET', '/api/public-stats');
  assert('GET /api/public-stats → 200', pubStats.status === 200);

  // ── CLEANUP ────────────────────────────────────────────────────────────────
  section('Cleanup (ลบข้อมูลทดสอบ)');

  // ลบ committee evaluations และ assessment sessions ผ่าน MongoDB โดยตรง
  const CommitteeEval = mongoose.model('CommitteeEvaluation',
    new mongoose.Schema({ session_id: String, major_name: String, indicator_id: String,
      committee_score: Number, strengths: String, improvements: String,
      development_plan: String, year: String }), 'committee_evaluations');
  const AssessmentSession = mongoose.model('AssessmentSession',
    new mongoose.Schema({ major_name: String }), 'assessment_sessions');
  const EsarMeta = mongoose.model('EsarMetadata',
    new mongoose.Schema({ major_name: String, year: String }), 'esar_metadata');

  const commDel = await CommitteeEval.deleteMany({ major_name: testMajor });
  console.log(`  ${c('yellow', '→')} Deleted ${commDel.deletedCount} committee evaluations`);

  const sessDel = await AssessmentSession.deleteMany({ major_name: testMajor });
  console.log(`  ${c('yellow', '→')} Deleted ${sessDel.deletedCount} assessment sessions`);

  const esarDel = await EsarMeta.deleteMany({ major_name: testMajor });
  console.log(`  ${c('yellow', '→')} Deleted ${esarDel.deletedCount} esar metadata`);

  // ลบผ่าน API (registered cleanup)
  for (const { method, path } of cleanup.reverse()) {
    const r = await request(method, path, null, TOKEN);
    const ok = r.status === 200 || r.status === 204;
    console.log(`  ${ok ? c('green', '✓') : c('red', '✗')} ${method} ${path} → ${r.status}`);
  }

  // ลบ test user
  await UserModel.findByIdAndDelete(testUser._id);
  console.log(`  ${c('yellow', '→')} Deleted temp admin user: ${testEmail}`);

  await mongoose.disconnect();

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(42));
  console.log(c('bold', `Results: ${c('green', `${PASS} passed`)}  ${FAIL > 0 ? c('red', `${FAIL} failed`) : c('green', '0 failed')}`));
  console.log('─'.repeat(42) + '\n');

  if (FAIL > 0) process.exit(1);
}

run().catch((err) => {
  console.error(c('red', '\n❌ Test runner error:'), err.message);
  process.exit(1);
});
