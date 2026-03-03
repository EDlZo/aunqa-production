// Firebase-based// Dependencies
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
require('dotenv').config();

// Firebase Admin SDK
const admin = require('firebase-admin');

// Supabase Client
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_ANON_KEY || 'placeholder-key'
);

console.log('✅ Supabase client initialized');
console.log('📦 Bucket:', process.env.SUPABASE_BUCKET_NAME);

// Create uploads directory if it doesn't exist (only in non-Vercel environment)
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!process.env.VERCEL && !fs.existsSync(UPLOADS_DIR)) {
  try {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    console.log('📁 Created uploads directory');
  } catch (err) {
    console.error('❌ Failed to create uploads directory:', err.message);
  }
}

// Initialize Firebase Admin with environment variables
let db = null;
let isFirebaseInitialized = false;

if (!admin.apps.length) {
  try {
    // Try to use environment variables first
    if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PROJECT_ID) {
      console.log('🔑 Using Firebase environment variables');
      console.log('📧 Client Email:', process.env.FIREBASE_CLIENT_EMAIL);
      console.log('🆔 Project ID:', process.env.FIREBASE_PROJECT_ID);

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        }),
        // storageBucket: process.env.FIREBASE_STORAGE_BUCKET // Commented out to force local storage
      });
      console.log('✅ Firebase Admin initialized with environment variables (local storage)');
      isFirebaseInitialized = true;
    } else {
      console.log('⚠️ Missing Firebase environment variables:');
      console.log('- FIREBASE_PRIVATE_KEY:', !!process.env.FIREBASE_PRIVATE_KEY);
      console.log('- FIREBASE_CLIENT_EMAIL:', !!process.env.FIREBASE_CLIENT_EMAIL);
      console.log('- FIREBASE_PROJECT_ID:', !!process.env.FIREBASE_PROJECT_ID);

      // Fallback to service account file (Only in development)
      if (process.env.NODE_ENV !== 'production' && fs.existsSync('./firebase-service-account.json')) {
        const serviceAccount = require('./firebase-service-account.json');
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'aunqa-esar.appspot.com'
        });
        console.log('✅ Firebase Admin initialized with service account file');
        isFirebaseInitialized = true;
      } else {
        console.log('❌ Firebase Admin not initialized: Missing credentials and no service account file');
        console.log('🔄 Will use mock data for development');
      }
    }
  } catch (error) {
    console.error('❌ Firebase Admin initialization failed:', error);
    console.log('🔄 Will use mock data for development');
  }
}

if (isFirebaseInitialized && admin.apps.length) {
  try {
    db = admin.firestore();
    console.log('✅ Firestore database initialized');
  } catch (error) {
    console.error('❌ Firestore initialization failed:', error);
    db = null;
  }
} else {
  console.log('❌ Firestore database not available - using mock data');
}

// Mock data for when Firebase is not available
const mockData = {
  programs: [
    { id: '1', levelId: '1', facultyId: '1', facultyName: 'คณะวิศวกรรมศาสตร์', majorId: '1', majorName: 'วิศวกรรมคอมพิวเตอร์' },
    { id: '2', levelId: '1', facultyId: '1', facultyName: 'คณะวิศวกรรมศาสตร์', majorId: '2', majorName: 'วิศวกรรมคอมพิวเตอร์ปัญญาประดิษฐ์ (AI)' }
  ],
  quality_components: [
    { id: '1', component_id: '2', quality_name: 'องค์ประกอบที่ 2 : ผลการดำเนินงานตามเกณฑ์ AUN-QA' }
  ],
  indicators: [
    { id: '1', component_id: '1', sequence: '2.1', indicator_name: 'ตัวบ่งชี้ตัวอย่าง', indicator_type: 'ผลลัพธ์', criteria_type: 'เชิงคุณภาพ' }
  ],
  evaluations: [],
  evaluations_actual: [],
  committee_evaluations: [],
  assessment_sessions: []
};

// Helper function to get mock data or real data
async function getData(collection, filters = {}) {
  // Normalize collection name
  const colMap = {
    'qualityComponents': 'quality_components',
    'evaluationsActual': 'evaluations_actual',
    'committeeEvaluations': 'committee_evaluations',
    'assessmentSessions': 'assessment_sessions'
  };
  const normalizedCollection = colMap[collection] || collection;

  if (db) {
    try {
      let query = db.collection(normalizedCollection);

      // Apply filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          // Optimization: If it's an ID field, search for both String and Number versions in one query
          if (key === 'session_id' || key === 'indicator_id' || key === 'component_id') {
            const possibleValues = new Set();
            possibleValues.add(String(value));
            if (!isNaN(value)) possibleValues.add(Number(value));

            const valuesArray = Array.from(possibleValues);
            if (valuesArray.length > 1) {
              query = query.where(key, 'in', valuesArray);
            } else {
              query = query.where(key, '==', valuesArray[0]);
            }
          } else {
            query = query.where(key, '==', value);
          }
        }
      });

      const snapshot = await query.get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error(`Error fetching ${normalizedCollection}:`, error);
      return [];
    }
  } else {
    // Return mock data
    let data = mockData[normalizedCollection] || [];

    // Apply filters to mock data
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') { // Added value !== ''
        data = data.filter(item => {
          // Flexible type comparison for mock data
          // For session_id and indicator_id, allow comparison as both string and number
          if ((key === 'session_id' || key === 'indicator_id') && !isNaN(value)) {
            return String(item[key]) === String(value) || Number(item[key]) === Number(value);
          }
          return String(item[key]) === String(value);
        });
      }
    });

    return data;
  }
}

// Helper function to add data
async function addData(collection, data) {
  // Normalize collection name
  const colMap = {
    'qualityComponents': 'quality_components',
    'evaluationsActual': 'evaluations_actual',
    'committeeEvaluations': 'committee_evaluations',
    'assessmentSessions': 'assessment_sessions'
  };
  const normalizedCollection = colMap[collection] || collection;

  if (db) {
    try {
      // Ensure component_id is Number if present
      const processedData = { ...data };
      if (processedData.component_id !== undefined && !isNaN(processedData.component_id)) {
        processedData.component_id = Number(processedData.component_id);
      }

      const docRef = await db.collection(normalizedCollection).add({
        ...processedData,
        created_at: admin.firestore.FieldValue.serverTimestamp()
      });
      return { id: docRef.id, success: true };
    } catch (error) {
      console.error(`Error adding to ${normalizedCollection}:`, error);
      return { success: false, error: error.message };
    }
  } else {
    // Mock success for development
    const mockId = Date.now().toString();
    return { id: mockId, success: true };
  }
}
// Disable Firebase Storage - using local file storage instead
const bucket = null;
console.log('📦 Using local file storage (Firebase Storage disabled)');

// Collections
const firebaseConfig = {
  apiKey: "AIzaSyA7hRJDJpixXHtSfYHapEqv9eePXoakLz8",
  authDomain: "aunqa-esar.firebaseapp.com",
  projectId: "aunqa-esar",
  storageBucket: "aunqa-esar.firebasestorage.app",
  messagingSenderId: "1043756688021",
  appId: "1:1043756688021:web:5172408a9000ca8e67319c",
  measurementId: "G-7T1KV7GPQG"
};

// Multer setup for temporary file handling (before uploading to Firebase Storage)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const tempDir = os.tmpdir();
    cb(null, tempDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const originalExt = path.extname(file.originalname);
    cb(null, uniqueSuffix + originalExt);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    if (file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('อนุญาตเฉพาะไฟล์ PDF และรูปภาพเท่านั้น'), false);
    }
  },
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB per file
    fieldSize: 100 * 1024 * 1024, // 100MB for fields (essential for base64 images in HTML)
    fields: 100 // Allow more fields
  }
});

const app = express();
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Serve uploaded files statically
app.use('/uploads', express.static(UPLOADS_DIR));
console.log('📁 Serving uploads from:', UPLOADS_DIR);

// Debug middleware
app.use((req, res, next) => {
  console.log(`[REQ] [${new Date().toLocaleTimeString()}] ${req.method} ${req.path}`);
  next();
});

// ================= FILE MANAGEMENT (Top Priority) =================
// Append files to latest actual evaluation
app.post('/api/evaluations-actual/append-files', upload.array('evidence_files', 10), async (req, res) => {
  try {
    console.log('➡️ [APPEND-FILES] Payload:', req.body);
    const { session_id, indicator_id, major_name, evidence_number, evidence_name } = req.body;

    if (!session_id || !indicator_id) {
      return res.status(400).json({ error: 'ต้องระบุ session_id และ indicator_id' });
    }

    // Find latest evaluation for this indicator/session
    console.log(`Searching for evaluations with session_id: ${session_id}, indicator_id: ${indicator_id}`);
    const evaluations = await getData('evaluationsActual', { session_id, indicator_id });
    console.log(`Found ${evaluations.length} evaluations`);

    evaluations.sort((a, b) => {
      const getT = (v) => v?.created_at?._seconds || v?.created_at?.seconds || 0;
      return getT(b) - getT(a);
    });

    let targetEval = evaluations[0];
    let isUpdate = true;

    if (!targetEval) {
      targetEval = {
        session_id,
        indicator_id,
        major_name,
        evidence_files_json: '[]',
        evidence_meta_json: '{}',
        status: 'submitted'
      };
      isUpdate = false;
    }

    const files = Array.isArray(req.files) ? req.files : [];
    const evidenceFiles = JSON.parse(targetEval.evidence_files_json || '[]');
    const evidenceMeta = JSON.parse(targetEval.evidence_meta_json || '{}');

    for (const file of files) {
      evidenceFiles.push(file.filename);
      let publicUrl = null;
      try {
        const destination = `evidence_actual/${session_id}/${indicator_id}/${file.filename}`;
        publicUrl = await uploadFileToFirebase(file.path, destination);
      } catch (uploadError) { console.error(`Failed to upload ${file.filename}:`, uploadError); }

      evidenceMeta[file.filename] = {
        name: evidence_name || file.originalname,
        number: evidence_number || '1',
        url: publicUrl
      };
    }

    const updatedData = {
      ...targetEval,
      evidence_files_json: JSON.stringify(evidenceFiles),
      evidence_meta_json: JSON.stringify(evidenceMeta)
    };

    if (isUpdate) {
      await db.collection('evaluations_actual').doc(targetEval.id).update({
        evidence_files_json: updatedData.evidence_files_json,
        evidence_meta_json: updatedData.evidence_meta_json
      });
    } else {
      await addData('evaluationsActual', updatedData);
    }

    res.json({ success: true, files: evidenceFiles, meta: evidenceMeta });
  } catch (error) {
    console.error('Error appending files:', error);
    res.status(500).json({ error: 'เพิ่มไฟล์ไม่สำเร็จ', details: error.message });
  }
});

// Remove a single file from the latest actual evaluation
app.post('/api/evaluations-actual/remove-file', async (req, res) => {
  try {
    console.log('➡️ [REMOVE-FILE] Payload:', req.body);
    const { session_id, indicator_id, filename } = req.body;

    if (!session_id || !indicator_id || !filename) {
      return res.status(400).json({ error: 'ต้องระบุ session_id, indicator_id และ filename' });
    }

    console.log(`Searching for evaluations with session_id: ${session_id}, indicator_id: ${indicator_id}`);
    const evaluations = await getData('evaluationsActual', { session_id, indicator_id });
    console.log(`Found ${evaluations.length} evaluations`);

    evaluations.sort((a, b) => {
      const getT = (v) => v?.created_at?._seconds || v?.created_at?.seconds || 0;
      return getT(b) - getT(a);
    });

    const targetEval = evaluations[0];
    if (!targetEval) {
      console.log('❌ No evaluation found for this indicator/session');
      return res.status(404).json({ error: 'ไม่พบข้อมูลการประเมิน' });
    }

    console.log('✅ Found target evaluation:', targetEval.id);

    let evidenceFiles = JSON.parse(targetEval.evidence_files_json || '[]');
    let evidenceMeta = JSON.parse(targetEval.evidence_meta_json || '{}');
    const updatedFiles = evidenceFiles.filter(f => f !== filename);
    if (evidenceMeta[filename]) delete evidenceMeta[filename];

    await db.collection('evaluations_actual').doc(targetEval.id).update({
      evidence_files_json: JSON.stringify(updatedFiles),
      evidence_meta_json: JSON.stringify(evidenceMeta)
    });

    try {
      const storagePath = `evidence_actual/${session_id}/${indicator_id}/${filename}`;
      await supabase.storage.from(process.env.SUPABASE_BUCKET_NAME).remove([storagePath]);
    } catch (e) { console.warn('Supabase delete error:', e.message); }

    res.json({ success: true, files: updatedFiles });
  } catch (error) {
    console.error('Error removing file:', error);
    res.status(500).json({ error: 'ลบไฟล์ไม่สำเร็จ', details: error.message });
  }
});

// Aliases for frontend typos
app.post('/api/evaluation_tual/remove-file', (req, res, next) => {
  req.url = '/api/evaluations-actual/remove-file';
  next();
});
app.post('/api/evaluation_tual/append-files', (req, res, next) => {
  req.url = '/api/evaluations-actual/append-files';
  next();
});

// Health check
app.get('/api/ping', (req, res) => {
  res.json({
    ok: true,
    pid: process.pid,
    cwd: process.cwd(),
    firebase: !!db,
    storage: !!bucket
  });
});

// ================= LEVELS =================
app.get('/api/levels', async (req, res) => {
  try {
    const levels = await getData('levels');
    res.json(levels);
  } catch (error) {
    console.error('Error fetching levels:', error);
    res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลระดับได้' });
  }
});

app.post('/api/levels', async (req, res) => {
  try {
    const result = await addData('levels', req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'เพิ่มระดับไม่สำเร็จ' });
  }
});

app.patch('/api/levels/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection('levels').doc(id).update(req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'แก้ไขระดับไม่สำเร็จ' });
  }
});

app.delete('/api/levels/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection('levels').doc(id).delete();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'ลบระดับไม่สำเร็จ' });
  }
});

// ================= FACULTIES =================
app.get('/api/faculties', async (req, res) => {
  try {
    const faculties = await getData('faculties');
    res.json(faculties);
  } catch (error) {
    console.error('Error fetching faculties:', error);
    res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลคณะได้' });
  }
});

app.post('/api/faculties', async (req, res) => {
  try {
    const result = await addData('faculties', req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'เพิ่มคณะไม่สำเร็จ' });
  }
});

app.patch('/api/faculties/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection('faculties').doc(id).update(req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'แก้ไขคณะไม่สำเร็จ' });
  }
});

app.delete('/api/faculties/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection('faculties').doc(id).delete();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'ลบคณะไม่สำเร็จ' });
  }
});

// ================= PROGRAMS =================
app.get('/api/programs', async (req, res) => {
  try {
    const programs = await getData('programs');
    res.json(programs);
  } catch (error) {
    console.error('Error fetching programs:', error);
    res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลโปรแกรมได้', details: error.message });
  }
});

app.post('/api/programs', async (req, res) => {
  try {
    const result = await addData('programs', req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'เพิ่มโปรแกรมไม่สำเร็จ' });
  }
});

app.patch('/api/programs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection('programs').doc(id).update(req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'แก้ไขโปรแกรมไม่สำเร็จ' });
  }
});

app.delete('/api/programs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection('programs').doc(id).delete();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'ลบโปรแกรมไม่สำเร็จ' });
  }
});

// ================= QUALITY COMPONENTS =================
app.get('/api/quality-components', async (req, res) => {
  try {
    if (!db) {
      // Use mock data when Firebase is not available
      const { session_id, major_name } = req.query || {};
      const components = await getData('qualityComponents', { major_name });
      return res.json(components);
    }

    const { session_id, major_name, year } = req.query || {};

    // Use simple query without complex ordering to avoid index requirements
    let query = db.collection('quality_components');

    if (major_name) {
      query = query.where('major_name', '==', major_name);
    }

    // Add year filter
    if (year) {
      if (year === 'legacy') {
        // Hard to filter for missing field without composite index, maybe skip or filter in memory?
        // For now, assume legacy data has no year field.
      } else {
        query = query.where('year', '==', year);
      }
    }

    // Remove ordering to avoid index requirement
    // query = query.orderBy('created_at', 'desc');

    const snapshot = await query.get();
    const components = [];

    snapshot.forEach(doc => {
      components.push({ id: doc.id, ...doc.data() });
    });

    // Sort in memory instead
    components.sort((a, b) => {
      if (a.created_at && b.created_at) {
        return b.created_at.seconds - a.created_at.seconds;
      }
      return 0;
    });

    res.json(components);
  } catch (error) {
    console.error('Error fetching quality components:', error);
    res.status(500).json({ error: 'ดึงองค์ประกอบไม่สำเร็จ', details: error.message });
  }
});

app.post('/api/quality-components', async (req, res) => {
  try {
    const { quality_name, component_id, session_id, major_name, year } = req.body;

    const result = await addData('qualityComponents', {
      quality_name,
      component_id: parseInt(component_id),
      session_id,
      major_name,
      year: year || null
    });

    if (result.success) {
      res.json({ success: true, id: result.id });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Error creating quality component:', error);
    res.status(500).json({ error: 'ไม่สามารถสร้างองค์ประกอบคุณภาพได้', details: error.message });
  }
});

app.delete('/api/quality-components/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!db) return res.json({ success: true }); // Mock success

    // 1. Get the component data first to find its component_id
    const docRef = db.collection('quality_components').doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return res.status(404).json({ error: 'ไม่พบองค์ประกอบคุณภาพ' });
    }

    const { component_id, major_name, year } = docSnap.data();

    // 2. Delete associated indicators and ALL evaluation data
    const batch = db.batch();

    if (component_id || id) {
      const indicatorsRef = db.collection('indicators');
      const evalRef = db.collection('evaluations');
      const evalActualRef = db.collection('evaluations_actual');
      const commEvalRef = db.collection('committee_evaluations');

      let indicatorsToDeleteDocs = [];

      // Find indicators by logical component_id OR Firestore Doc ID
      if (component_id) {
        const q1 = await indicatorsRef.where('component_id', '==', component_id).where('major_name', '==', major_name).get();
        q1.forEach(doc => indicatorsToDeleteDocs.push(doc));
      }
      if (id) {
        const q2 = await indicatorsRef.where('component_id', '==', id).where('major_name', '==', major_name).get();
        q2.forEach(doc => indicatorsToDeleteDocs.push(doc));
      }

      // De-duplicate indicator documents
      const uniqueIndicatorDocs = [];
      const seenPaths = new Set();
      indicatorsToDeleteDocs.forEach(doc => {
        if (!seenPaths.has(doc.ref.path)) {
          seenPaths.add(doc.ref.path);
          uniqueIndicatorDocs.push(doc);
        }
      });

      let totalIndicatorDeletes = 0;
      let totalEvalDeletes = 0;

      for (const indDoc of uniqueIndicatorDocs) {
        const indicatorId = indDoc.id;

        // Delete the indicator itself
        batch.delete(indDoc.ref);
        totalIndicatorDeletes++;

        // Delete related evaluations for this specific indicator
        const e1 = await evalRef.where('indicator_id', '==', indicatorId).get();
        e1.forEach(doc => { batch.delete(doc.ref); totalEvalDeletes++; });

        const e2 = await evalActualRef.where('indicator_id', '==', indicatorId).get();
        e2.forEach(doc => { batch.delete(doc.ref); totalEvalDeletes++; });

        const e3 = await commEvalRef.where('indicator_id', '==', indicatorId).get();
        e3.forEach(doc => { batch.delete(doc.ref); totalEvalDeletes++; });
      }

      // Finally delete the component itself
      batch.delete(docRef);

      await batch.commit();
      console.log(`[CASCADE DELETE] Component ${id} removed. Indicators: ${totalIndicatorDeletes}, Evaluations: ${totalEvalDeletes}`);
    } else {
      await docRef.delete();
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting quality component:', error);
    res.status(500).json({ error: 'ไม่สามารถลบองค์ประกอบคุณภาพได้', details: error.message });
  }
});

app.patch('/api/quality-components/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    delete updateData.id; // Don't include ID in update

    if (!db) return res.json({ success: true }); // Mock success

    // Ensure component_id is Number if present
    if (updateData.component_id !== undefined && !isNaN(updateData.component_id)) {
      updateData.component_id = Number(updateData.component_id);
    }

    await db.collection('quality_components').doc(id).update({
      ...updateData,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating quality component:', error);
    res.status(500).json({ error: 'ไม่สามารถแก้ไของค์ประกอบคุณภาพได้', details: error.message });
  }
});

// ================= INDICATORS =================
app.get('/api/indicators', async (req, res) => {
  try {
    const { session_id, major_name, component_id, year } = req.query;
    const filters = {};
    if (component_id) filters.component_id = component_id;
    if (major_name) filters.major_name = major_name;
    if (year) filters.year = year;

    const indicators = await getData('indicators', filters);

    // Sort indicators by sequence numerically (e.g., 2.1 < 2.10)
    indicators.sort((a, b) => {
      const seqA = String(a.sequence || '');
      const seqB = String(b.sequence || '');
      return seqA.localeCompare(seqB, undefined, { numeric: true, sensitivity: 'base' });
    });

    res.json(indicators);
  } catch (error) {
    console.error('Error fetching indicators:', error);
    res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลตัวบ่งชี้ได้', details: error.message });
  }
});

app.get('/api/indicators-by-component/:componentId', async (req, res) => {
  try {
    const { componentId } = req.params;
    const { session_id, major_name, year } = req.query;

    const filters = {
      component_id: componentId,
      major_name
    };
    if (year) filters.year = year;

    const indicators = await getData('indicators', filters);

    // Sort indicators by sequence numerically
    indicators.sort((a, b) => {
      const seqA = String(a.sequence || '');
      const seqB = String(b.sequence || '');
      return seqA.localeCompare(seqB, undefined, { numeric: true, sensitivity: 'base' });
    });

    res.json(indicators);
  } catch (error) {
    console.error('Error fetching indicators by component:', error);
    res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลตัวบ่งชี้ได้', details: error.message });
  }
});

app.post('/api/indicators', async (req, res) => {
  try {
    const { component_id, sequence, indicator_type, criteria_type, indicator_name, data_source, session_id, major_name, year } = req.body;

    const result = await addData('indicators', {
      component_id: parseInt(component_id),
      sequence,
      indicator_type,
      criteria_type,
      indicator_name,
      data_source,
      session_id,
      major_name,
      year: year || null
    });

    if (result.success) {
      res.json({ success: true, id: result.id });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Error creating indicator:', error);
    res.status(500).json({ error: 'ไม่สามารถสร้างตัวบ่งชี้ได้', details: error.message });
  }
});

app.delete('/api/indicators/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!db) return res.json({ success: true });

    await db.collection('indicators').doc(id).delete();
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting indicator:', error);
    res.status(500).json({ error: 'ไม่สามารถลบตัวบ่งชี้ได้', details: error.message });
  }
});

app.patch('/api/indicators/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    // Ensure component_id remains integer if present
    if (updateData.component_id) {
      updateData.component_id = parseInt(updateData.component_id);
    }

    if (!db) {
      return res.json({ success: true });
    }

    await db.collection('indicators').doc(id).update(updateData);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating indicator:', error);
    res.status(500).json({ error: 'ไม่สามารถแก้ไขตัวบ่งชี้ได้', details: error.message });
  }
});

// ================= MASTER CRITERIA TEMPLATES =================

// Master Quality Components
app.get('/api/master-quality-components', async (req, res) => {
  try {
    if (!db) return res.json([]);
    const snapshot = await db.collection('master_quality_components').orderBy('component_id').get();
    const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(items);
  } catch (error) {
    console.error('Error fetching master components:', error);
    res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลแม่แบบองค์ประกอบได้' });
  }
});

app.post('/api/master-quality-components', async (req, res) => {
  try {
    const data = { ...req.body, created_at: admin.firestore.FieldValue.serverTimestamp() };
    if (data.component_id) data.component_id = parseInt(data.component_id);

    if (!db) return res.json({ id: Date.now(), ...data });
    const docRef = await db.collection('master_quality_components').add(data);
    res.json({ id: docRef.id, ...data });
  } catch (error) {
    console.error('Error creating master component:', error);
    res.status(500).json({ error: 'ไม่สามารถสร้างแม่แบบองค์ประกอบได้' });
  }
});

app.patch('/api/master-quality-components/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = { ...req.body };
    if (data.component_id) data.component_id = parseInt(data.component_id);
    delete data.id;

    if (!db) return res.json({ success: true });
    await db.collection('master_quality_components').doc(id).update(data);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating master component:', error);
    res.status(500).json({ error: 'ไม่สามารถแก้ไขแม่แบบองค์ประกอบได้' });
  }
});

app.delete('/api/master-quality-components/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!db) return res.json({ success: true });
    await db.collection('master_quality_components').doc(id).delete();
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting master component:', error);
    res.status(500).json({ error: 'ไม่สามารถลบแม่แบบองค์ประกอบได้' });
  }
});

// Master Indicators
app.get('/api/master-indicators', async (req, res) => {
  try {
    if (!db) return res.json([]);
    const snapshot = await db.collection('master_indicators').get();
    const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Sort by sequence numerically
    items.sort((a, b) => {
      const seqA = String(a.sequence || '');
      const seqB = String(b.sequence || '');
      return seqA.localeCompare(seqB, undefined, { numeric: true, sensitivity: 'base' });
    });

    res.json(items);
  } catch (error) {
    console.error('Error fetching master indicators:', error);
    res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลแม่แบบตัวบ่งชี้ได้' });
  }
});

app.post('/api/master-indicators', async (req, res) => {
  try {
    const data = { ...req.body, created_at: admin.firestore.FieldValue.serverTimestamp() };
    if (data.component_id) data.component_id = parseInt(data.component_id);

    if (!db) return res.json({ id: Date.now(), ...data });
    const docRef = await db.collection('master_indicators').add(data);
    res.json({ id: docRef.id, ...data });
  } catch (error) {
    console.error('Error creating master indicator:', error);
    res.status(500).json({ error: 'ไม่สามารถสร้างแม่แบบตัวบ่งชี้ได้' });
  }
});

app.post('/api/master-indicators/bulk', async (req, res) => {
  try {
    const items = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'ข้อมูลต้องเป็นอาเรย์' });
    }

    const results = [];
    if (!db) {
      return res.json(items.map((item, index) => ({ id: Date.now() + index, ...item })));
    }

    const batch = db.batch();
    const collection = db.collection('master_indicators');

    for (const item of items) {
      const docRef = collection.doc();
      const data = {
        ...item,
        created_at: admin.firestore.FieldValue.serverTimestamp()
      };
      if (data.component_id) data.component_id = parseInt(data.component_id);
      delete data.id; // Ensure no existing ID is saved

      batch.set(docRef, data);
      results.push({ id: docRef.id, ...data });
    }

    await batch.commit();
    res.json(results);
  } catch (error) {
    console.error('Error creating bulk master indicators:', error);
    res.status(500).json({ error: 'ไม่สามารถสร้างแม่แบบตัวบ่งชี้แบบกลุ่มได้' });
  }
});

app.patch('/api/master-indicators/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = { ...req.body };
    if (data.component_id) data.component_id = parseInt(data.component_id);
    delete data.id;

    if (!db) return res.json({ success: true });
    await db.collection('master_indicators').doc(id).update(data);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating master indicator:', error);
    res.status(500).json({ error: 'ไม่สามารถแก้ไขแม่แบบตัวบ่งชี้ได้' });
  }
});

app.delete('/api/master-indicators/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!db) return res.json({ success: true });
    await db.collection('master_indicators').doc(id).delete();
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting master indicator:', error);
    res.status(500).json({ error: 'ไม่สามารถลบแม่แบบตัวบ่งชี้ได้' });
  }
});

// ================= BULK OPERATIONS =================
app.get('/api/bulk/session-summary', async (req, res) => {
  try {
    const { session_id, major_name, year, filter_approved_only } = req.query;
    if (!major_name) return res.status(400).json({ error: 'กรุณาระบุ major_name' });

    console.log(`[BULK] Fetching session summary for major: ${major_name}, session: ${session_id}, year: ${year}`);

    if (year) {
      const sessionSnap = await db.collection('assessment_sessions')
        .where('major_name', '==', major_name)
        .where('round_year', '==', String(year))
        .get();
      const yearSessionIds = sessionSnap.docs.map(doc => doc.id);

      if (session_id) {
        // If session_id is provided, only include it if it's one of the sessions for this year
        // OR if no sessions were found for this year (legacy support)
        if (yearSessionIds.length === 0 || yearSessionIds.includes(String(session_id))) {
          targetSessionIds = [String(session_id)];
        } else {
          // session_id doesn't match the year, but we have others for the year
          targetSessionIds = yearSessionIds;
        }
      } else {
        targetSessionIds = yearSessionIds;
      }
    } else if (session_id) {
      targetSessionIds = [String(session_id)];
    }

    // Fetch Components and Indicators
    let components = [];
    let indicators = [];

    const fetchItemsRobustly = async (collectionName) => {
      let resultsMap = new Map();

      if (year) {
        const yearStr = String(year);
        const yearNum = parseInt(year);

        const queries = [
          db.collection(collectionName).where('major_name', '==', major_name).where('year', '==', yearStr).get()
        ];
        if (!isNaN(yearNum) && String(yearNum) === yearStr) {
          queries.push(db.collection(collectionName).where('major_name', '==', major_name).where('year', '==', yearNum).get());
        }

        const snaps = await Promise.all(queries);
        snaps.forEach(snap => {
          if (snap) snap.docs.forEach(doc => resultsMap.set(doc.id, { id: doc.id, ...doc.data() }));
        });
      } else {
        const snap = await db.collection(collectionName).where('major_name', '==', major_name).get();
        snap.docs.forEach(doc => resultsMap.set(doc.id, { id: doc.id, ...doc.data() }));
      }

      return Array.from(resultsMap.values());
    };

    [components, indicators] = await Promise.all([
      fetchItemsRobustly('quality_components'),
      fetchItemsRobustly('indicators')
    ]);

    // Fetch ALL sessions for this major (for absolute fallback)
    const fetchAllMajorSessions = async () => {
      const snap = await db.collection('assessment_sessions').where('major_name', '==', major_name).get();
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    };
    const assessment_sessions = await fetchAllMajorSessions();

    // Robust Evaluation Fetcher
    const fetchEvaluationsRobustly = async (collectionName) => {
      let resultsMap = new Map();

      // 1. By Year field directly
      if (year) {
        const yearStr = String(year);
        const yearNum = parseInt(year);

        const queries = [
          db.collection(collectionName).where('major_name', '==', major_name).where('year', '==', yearStr).get()
        ];
        if (!isNaN(yearNum) && String(yearNum) === yearStr) {
          queries.push(db.collection(collectionName).where('major_name', '==', major_name).where('year', '==', yearNum).get());
        }

        const snaps = await Promise.all(queries);
        snaps.forEach(snap => {
          if (snap) snap.docs.forEach(doc => resultsMap.set(doc.id, { id: doc.id, ...doc.data() }));
        });
      }

      // 2. By targetSessionIds
      if (targetSessionIds.length > 0) {
        for (let i = 0; i < targetSessionIds.length; i += 30) {
          const chunk = targetSessionIds.slice(i, i + 30);
          const snap = await db.collection(collectionName)
            .where('session_id', 'in', chunk)
            .get();
          snap.docs.forEach(doc => resultsMap.set(doc.id, { id: doc.id, ...doc.data() }));
        }
      }

      // 3. Fallback: If no evaluations found for CURRENT year/sessions, 
      // check if we have any evaluations for THIS MAJOR at all (only for 'evaluations' collection - which are target/criteria)
      if (collectionName === 'evaluations' && resultsMap.size === 0) {
        console.log(`[BULK] Fallback: Fetching all evaluations for major: ${major_name}`);
        const snap = await db.collection(collectionName).where('major_name', '==', major_name).get();
        snap.docs.forEach(doc => {
          const d = doc.data();
          // Filter in memory for year mismatch (e.g. "2569,2569" vs "2569")
          const dYear = String(d.year || '');
          if (year && (dYear === String(year) || dYear.includes(String(year)))) {
            resultsMap.set(doc.id, { id: doc.id, ...doc.data() });
          } else if (!year) {
            resultsMap.set(doc.id, { id: doc.id, ...doc.data() });
          }
        });

        // If STILL empty, take most recent per indicator (any year)
        if (resultsMap.size === 0) {
          snap.docs.forEach(doc => {
            const d = doc.data();
            const existing = resultsMap.get(String(d.indicator_id));
            if (!existing || (d.created_at && (!existing.created_at || d.created_at > existing.created_at))) {
              resultsMap.set(String(d.indicator_id), { id: doc.id, ...doc.data() });
            }
          });
        }
      }

      return Array.from(resultsMap.values());
    };

    let [evaluations, evaluations_actual, committee_evaluations] = await Promise.all([
      fetchEvaluationsRobustly('evaluations'),
      fetchEvaluationsRobustly('evaluations_actual'),
      fetchEvaluationsRobustly('committee_evaluations')
    ]);

    // Filtering and Sorting
    if (filter_approved_only === 'true') {
      evaluations_actual = evaluations_actual.filter(ev => ev.status === 'approved');
    }

    indicators.sort((a, b) => {
      const seqA = String(a.sequence || '');
      const seqB = String(b.sequence || '');
      return seqA.localeCompare(seqB, undefined, { numeric: true, sensitivity: 'base' });
    });

    res.json({
      components,
      evaluations,
      evaluations_actual,
      committee_evaluations,
      indicators,
      assessment_sessions
    });
  } catch (error) {
    console.error('Error in session summary batch:', error);
    res.status(500).json({ error: 'ดึงข้อมูลสรุปไม่สำเร็จ', details: error.message });
  }
});

app.post('/api/bulk/indicators', async (req, res) => {
  try {
    const { indicators } = req.body;

    if (!Array.isArray(indicators)) {
      return res.status(400).json({ error: 'ข้อมูลตัวบ่งชี้ต้องเป็น array' });
    }

    const results = [];
    for (const indicator of indicators) {
      const result = await addData('indicators', indicator);
      results.push(result);
    }

    res.json({ success: true, results });
  } catch (error) {
    console.error('Error bulk creating indicators:', error);
    res.status(500).json({ error: 'ไม่สามารถสร้างตัวบ่งชี้แบบกลุ่มได้', details: error.message });
  }
});

// ================= ASSESSMENT SESSIONS =================
app.post('/api/assessment-sessions', async (req, res) => {
  try {
    const { level_id, faculty_id, faculty_name, major_id, major_name, evaluator_id } = req.body;

    const result = await addData('assessmentSessions', {
      level_id,
      faculty_id,
      faculty_name,
      major_id,
      major_name,
      evaluator_id
    });

    if (result.success) {
      res.json({ success: true, session_id: result.id });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Error creating assessment session:', error);
    res.status(500).json({ error: 'ไม่สามารถสร้าง session ได้', details: error.message });
  }
});

app.get('/api/assessment-sessions/latest', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Firebase not initialized' });
    }

    const { major_name, evaluator_id } = req.query;
    if (!major_name) {
      return res.status(400).json({ error: 'major_name จำเป็น' });
    }

    console.log(`🔍 Looking for latest session for major: ${major_name}`);

    // Prefer finding sessions that ALREADY have evaluation data
    const evalSnap = await db.collection('evaluations_actual')
      .where('major_name', '==', major_name)
      .get();

    if (!evalSnap.empty) {
      const evals = evalSnap.docs.map(doc => doc.data());
      // Sort in-memory to avoid index requirement
      evals.sort((a, b) => {
        const getTime = (val) => {
          if (!val) return 0;
          if (val.seconds) return val.seconds * 1000;
          if (val._seconds) return val._seconds * 1000;
          if (val.toDate) return val.toDate().getTime();
          if (typeof val === 'string') return new Date(val).getTime();
          return 0;
        };
        return getTime(b.created_at) - getTime(a.created_at);
      });
      console.log(`✅ Found session with data: ${evals[0].session_id}`);
      return res.json({ session_id: String(evals[0].session_id) });
    }

    // Fallback to assessment_sessions if no evaluation data exists yet
    let query = db.collection('assessment_sessions')
      .where('major_name', '==', major_name);

    const snapshot = await query.get();
    if (snapshot.empty) {
      return res.json({ session_id: null });
    }

    const sessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Sort by created_at in memory
    sessions.sort((a, b) => {
      const getTime = (val) => {
        if (!val) return 0;
        if (val.seconds) return val.seconds * 1000;
        if (val._seconds) return val._seconds * 1000;
        if (typeof val === 'string') return new Date(val).getTime();
        return 0;
      };
      return getTime(b.created_at) - getTime(a.created_at);
    });

    res.json({ session_id: sessions[0].id });
  } catch (error) {
    console.error('Error fetching latest session:', error);
    res.status(500).json({ error: 'ดึงข้อมูลเซสชันล่าสุดไม่สำเร็จ', details: error.message });
  }
});

// Helper to extract base64 images from HTML, upload them, and return modified HTML
async function extractAndUploadBase64Images(html, sessionId, indicatorId) {
  if (!html || typeof html !== 'string' || !html.includes('data:image')) return html;

  const base64Regex = /src="data:image\/([a-zA-Z]*);base64,([^"]*)"/g;
  let resultHtml = html;
  const matches = [];
  let match;

  // Collect all matches first to avoid regex state issues during async loop
  while ((match = base64Regex.exec(html)) !== null) {
    matches.push({
      full: match[0],
      type: match[1],
      data: match[2]
    });
  }

  for (const item of matches) {
    try {
      const buffer = Buffer.from(item.data, 'base64');
      const filename = `embedded_${Date.now()}_${Math.round(Math.random() * 1000)}.${item.type || 'png'}`;
      const destination = `evidence_actual/${sessionId}/${indicatorId}/${filename}`;

      const { error } = await supabase.storage
        .from(process.env.SUPABASE_BUCKET_NAME)
        .upload(destination, buffer, {
          contentType: `image/${item.type || 'png'}`,
          upsert: true
        });

      if (!error) {
        const { data: { publicUrl } } = supabase.storage
          .from(process.env.SUPABASE_BUCKET_NAME)
          .getPublicUrl(destination);

        resultHtml = resultHtml.replace(item.full, `src="${publicUrl}"`);
        console.log(`✅ Uploaded embedded image: ${filename}`);
      } else {
        console.error('Supabase embedded upload error:', error);
      }
    } catch (e) {
      console.error('Failed to process embedded image:', e);
    }
  }

  return resultHtml;
}

// Helper function to upload file to Supabase Storage
async function uploadFileToFirebase(localPath, destination) {
  try {
    // Read file from local path
    const fileBuffer = fs.readFileSync(localPath);
    const fileName = path.basename(destination);
    const filePath = destination;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(process.env.SUPABASE_BUCKET_NAME)
      .upload(filePath, fileBuffer, {
        contentType: 'application/octet-stream',
        upsert: false
      });

    if (error) {
      console.error('Supabase upload error:', error);
      throw error;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(process.env.SUPABASE_BUCKET_NAME)
      .getPublicUrl(filePath);

    // Delete temp file
    try {
      fs.unlinkSync(localPath);
    } catch (e) {
      console.warn('Could not delete temp file:', e.message);
    }

    return publicUrl;
  } catch (error) {
    console.error('Error uploading to Supabase:', error);
    throw error;
  }
}

async function getLatestEvaluationActual(sessionId, indicatorId) {
  if (!db) return null;
  try {
    // Try both string and number for robust matching
    const sessionIds = [sessionId, parseInt(sessionId)].filter(v => v !== null && !isNaN(v));
    const indicatorIds = [indicatorId, parseInt(indicatorId)].filter(v => v !== null && !isNaN(v));

    let allDocs = [];
    for (const sid of sessionIds) {
      for (const iid of indicatorIds) {
        const snapshot = await db.collection('evaluations_actual')
          .where('session_id', '==', sid)
          .where('indicator_id', '==', iid)
          .get();
        snapshot.forEach(doc => allDocs.push({ id: doc.id, ...doc.data() }));
      }
    }

    if (allDocs.length === 0) return null;

    // Helper for robust timestamp comparison
    const getTime = (val) => {
      if (!val) return 0;
      if (val instanceof Date) return val.getTime();
      if (typeof val === 'string') return new Date(val).getTime();
      if (val && typeof val === 'object') {
        if (val.seconds) return val.seconds * 1000;
        if (val._seconds) return val._seconds * 1000;
        if (val.toDate && typeof val.toDate === 'function') return val.toDate().getTime();
      }
      return 0;
    };

    allDocs.sort((a, b) => getTime(b.created_at) - getTime(a.created_at));
    return allDocs[0];
  } catch (error) {
    console.error('Error in getLatestEvaluationActual:', error);
    return null;
  }
}

// ================= LOGIN =================
app.post('/api/login', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ success: false, message: 'Firebase not initialized' });
    }

    const { username, password, role } = req.body;
    console.log(`Login attempt: user=${username}, role=${role}`);

    const roleMapping = {
      'system_admin': 1,
      'sar_manager': 2,
      'reporter': 3,
      'evaluator': 4,
      'external_evaluator': 5,
      'executive': 6,
      'qa_admin': 7
    };

    const roleId = roleMapping[role];
    if (!roleId) {
      return res.status(400).json({ success: false, message: 'บทบาทไม่ถูกต้อง' });
    }

    // Query Firestore
    const usersRef = db.collection('users');
    const query = usersRef
      .where('email', '==', username)
      .where('password', '==', password)
      .where('role_id', '==', roleId);

    const snapshot = await query.get();

    if (snapshot.empty) {
      return res.status(401).json({
        success: false,
        message: 'ชื่อผู้ใช้ รหัสผ่าน หรือ Role ไม่ถูกต้อง'
      });
    }

    const userDoc = snapshot.docs[0];
    const userData = { id: userDoc.id, ...userDoc.data() };

    res.json({ success: true, user: userData });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ' });
  }
});

// ================= USER MANAGEMENT =================
// Get all users
app.get('/api/users', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Firebase not initialized' });
    }

    const { role_id } = req.query;
    let query = db.collection('users');

    if (role_id) {
      query = query.where('role_id', '==', parseInt(role_id));
    }

    const snapshot = await query.get();
    const users = snapshot.docs.map(doc => {
      const data = doc.data();
      // Don't send passwords back
      delete data.password;
      return { id: doc.id, ...data };
    });

    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลผู้ใช้งานได้', details: error.message });
  }
});

// Create new user
app.post('/api/users', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Firebase not initialized' });
    }

    const { email, password, role_id, first_name, last_name, faculty_id, major_id, major_name } = req.body;

    // Basic validation
    // Require first_name and last_name now, or at least one of them? The user requested separation.
    // Let's require both or just names.
    if (!email || !password || !role_id || !first_name || !last_name) {
      return res.status(400).json({ success: false, message: 'ข้อมูลไม่ครบถ้วน (Email, Password, Role, ชื่อ, นามสกุล จำเป็น)' });
    }

    // Check if user already exists
    const existingUser = await db.collection('users').where('email', '==', email).get();
    if (!existingUser.empty) {
      return res.status(400).json({ success: false, message: 'ผู้ใช้งานนี้มีอยู่ในระบบแล้ว' });
    }

    const full_name = `${first_name} ${last_name}`.trim();

    const userData = {
      email,
      password, // In a real app, hash this!
      role_id: parseInt(role_id),
      first_name,
      last_name,
      full_name, // Keep for backward compatibility
      faculty_id: faculty_id || null,
      major_id: major_id || null,
      major_name: major_name || null,
      created_at: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('users').add(userData);
    res.json({ success: true, id: docRef.id, message: 'สร้างผู้ใช้งานสำเร็จ' });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ success: false, message: 'สร้างผู้ใช้งานไม่สำเร็จ', details: error.message });
  }
});

// Update user
app.put('/api/users/:id', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Firebase not initialized' });
    }

    const { id } = req.params;
    const { email, password, role_id, first_name, last_name, full_name, faculty_id, major_id, major_name } = req.body;

    const updateData = {};
    if (email) updateData.email = email;
    if (password) updateData.password = password; // Only update if provided
    if (role_id) updateData.role_id = parseInt(role_id);

    // Handle names
    if (first_name || last_name) {
      if (first_name) updateData.first_name = first_name;
      if (last_name) updateData.last_name = last_name;

      // If we have both new values, construct full_name.
      // If only one, we might need to fetch existing to reconstruct, OR just trust client sends both or client sends correct full_name?
      // Safest: Client sends updated full_name OR we fetch.
      // For simplicity: If client sends first/last, we update them. 
      // We also allow client to send full_name directly if they want (legacy support), but if first/last are present, we prioritize/sync them.

      // Let's assume frontend sends all modified fields. 
      // If first_name is changed, we update it.
      // We should really update full_name too.
      // Let's reconstruct full_name from the updateData + existing data if potential overlap?
      // Actually, for PUT, usually the client has the full object state.

      // If full_name is NOT provided but first/last ARE, we can't easily reconstruction without reading first.
      // Optimization: Just update what is sent. 
      // BUT logic elsewhere might rely on full_name.
      // So let's construct full_name from first/last if provided together.
      if (first_name && last_name) {
        updateData.full_name = `${first_name} ${last_name}`.trim();
      } else if (full_name) {
        updateData.full_name = full_name;
      }
    } else if (full_name) {
      updateData.full_name = full_name;
    }

    if (faculty_id !== undefined) updateData.faculty_id = faculty_id;
    if (major_id !== undefined) updateData.major_id = major_id;
    if (major_name !== undefined) updateData.major_name = major_name;

    updateData.updated_at = admin.firestore.FieldValue.serverTimestamp();

    await db.collection('users').doc(id).update(updateData);
    res.json({ success: true, message: 'อัปเดตข้อมูลสำเร็จ' });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ success: false, message: 'อัปเดตข้อมูลไม่สำเร็จ', details: error.message });
  }
});

// Delete user
app.delete('/api/users/:id', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Firebase not initialized' });
    }

    const { id } = req.params;
    await db.collection('users').doc(id).delete();
    res.json({ success: true, message: 'ลบผู้ใช้งานสำเร็จ' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ success: false, message: 'ลบผู้ใช้งานไม่สำเร็จ', details: error.message });
  }
});

// ================= INDICATORS =================
app.get('/api/indicators/:id', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Firebase not initialized' });
    }

    const doc = await db.collection('indicators').doc(req.params.id).get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'ไม่พบข้อมูลตัวบ่งชี้' });
    }

    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error('Error fetching indicator:', error);
    res.status(500).json({ error: 'ดึงข้อมูลตัวบ่งชี้ไม่สำเร็จ', details: error.message });
  }
});

app.post('/api/indicators', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Firebase not initialized' });
    }

    const {
      component_id,
      sequence,
      indicator_type,
      criteria_type,
      indicator_name,
      data_source,
      session_id,
      major_name
    } = req.body || {};

    const indicatorData = {
      component_id,
      sequence,
      indicator_type,
      criteria_type,
      indicator_name,
      data_source: data_source || null,
      session_id: session_id || null,
      major_name: major_name || null,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('indicators').add(indicatorData);
    res.json({ success: true, id: docRef.id });
  } catch (error) {
    console.error('Error creating indicator:', error);
    res.status(500).json({ error: 'บันทึกข้อมูลตัวบ่งชี้ไม่สำเร็จ', details: error.message });
  }
});

app.delete('/api/indicators/:id', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Firebase not initialized' });
    }

    await db.collection('indicators').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting indicator:', error);
    res.status(500).json({ error: 'ลบตัวบ่งชี้ไม่สำเร็จ', details: error.message });
  }
});

app.get('/api/indicators-by-component/:componentId', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Firebase not initialized' });
    }

    const possibleIds = new Set();
    possibleIds.add(String(componentId));
    if (!isNaN(componentId)) possibleIds.add(Number(componentId));

    const idArray = Array.from(possibleIds);
    let query = db.collection('indicators').where('component_id', 'in', idArray);

    if (major_name) {
      query = query.where('major_name', '==', major_name);
    }
    if (year) {
      query = query.where('year', '==', year);
    }

    const snapshot = await query.get();
    const allIndicators = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Sort in memory by sequence
    allIndicators.sort((a, b) => {
      const seqA = a.sequence || '';
      const seqB = b.sequence || '';
      return seqA.localeCompare(seqB);
    });

    console.log(`✅ Found ${allIndicators.length} indicators for component_id: ${componentId}`);

    res.json(allIndicators);
  } catch (error) {
    console.error('Error fetching indicators by component:', error);
    res.status(500).json({ error: 'ดึงตัวบ่งชี้ไม่สำเร็จ', details: error.message });
  }
});

app.post('/api/bulk/indicators-by-components', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Firebase not initialized' });
    }

    const { component_ids, major_name } = req.body || {};
    if (!Array.isArray(component_ids)) {
      return res.status(400).json({ error: 'component_ids ต้องเป็นอาเรย์' });
    }

    // Firestore doesn't support 'IN' with more than 10-30 items depending on version
    // But we can fetch indicators and filter or do multiple queries
    // For simplicity and to avoid too many queries, let's fetch all indicators for the major
    // and then filter in memory if there are many components.

    let query = db.collection('indicators');
    if (major_name) {
      query = query.where('major_name', '==', major_name);
    }

    const snapshot = await query.get();
    const allIndicators = [];
    snapshot.forEach(doc => {
      const data = { id: doc.id, ...doc.data() };
      // Filter by component_ids in memory to handle type mismatches (string/number)
      if (component_ids.some(id => String(id) === String(data.component_id))) {
        allIndicators.push(data);
      }
    });

    // Sort by sequence
    allIndicators.sort((a, b) => {
      const seqA = String(a.sequence || '');
      const seqB = String(b.sequence || '');
      return seqA.localeCompare(seqB, undefined, { numeric: true, sensitivity: 'base' });
    });

    res.json(allIndicators);
  } catch (error) {
    console.error('Error in bulk indicators fetch:', error);
    res.status(500).json({ error: 'ดึงข้อมูลตัวบ่งชี้แบบกลุ่มไม่สำเร็จ' });
  }
});

// บันทึกตัวบ่งชี้แบบกลุ่ม (Batch Create)
app.post('/api/bulk/indicators', async (req, res) => {
  try {
    if (!db) return res.status(500).json({ error: 'Firebase not initialized' });
    const { indicators } = req.body;
    if (!Array.isArray(indicators) || indicators.length === 0) {
      return res.status(400).json({ error: 'indicators must be a non-empty array' });
    }

    console.log(`[BULK] Creating ${indicators.length} indicators`);

    const batch = db.batch();
    const results = [];
    const timestamp = new Date().toISOString();

    for (const item of indicators) {
      const docRef = db.collection('indicators').doc();
      const docData = {
        ...item,
        component_id: item.component_id ? Number(item.component_id) : item.component_id,
        created_at: timestamp
      };
      batch.set(docRef, docData);
      results.push({ id: docRef.id, ...docData });
    }

    await batch.commit();
    res.json({ success: true, count: results.length, indicators: results });
  } catch (error) {
    console.error('Error in bulk indicators creation:', error);
    res.status(500).json({ error: 'บันทึกข้อมูลแบบกลุ่มไม่สำเร็จ', details: error.message });
  }
});

// ================= ASSESSMENT SESSIONS =================
app.post('/api/assessment-sessions', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Firebase not initialized' });
    }

    const { level_id, faculty_id, faculty_name, major_id, major_name, evaluator_id } = req.body || {};

    if (!level_id) {
      return res.status(400).json({ error: 'level_id จำเป็น' });
    }

    // Fetch active round
    let roundData = {};
    try {
      const roundSnap = await db.collection('rounds').where('is_active', '==', true).limit(1).get();
      if (!roundSnap.empty) {
        const r = roundSnap.docs[0].data();
        roundData = {
          round_id: roundSnap.docs[0].id,
          round_year: r.year,
          round_name: r.name
        };
      } else {
        console.log('⚠️ No active round found when creating session.');
      }
    } catch (e) {
      console.warn('Failed to fetch active round for session:', e);
    }

    const sessionData = {
      level_id,
      faculty_id: faculty_id || null,
      faculty_name: faculty_name || null,
      major_id: major_id || null,
      major_name: major_name || null,
      evaluator_id: evaluator_id || null,
      ...roundData,
      created_at: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('assessment_sessions').add(sessionData);
    res.json({ success: true, session_id: docRef.id });
  } catch (error) {
    console.error('Error creating assessment session:', error);
    res.status(500).json({ error: 'สร้างเซสชันไม่สำเร็จ', details: error.message });
  }
});

app.get('/api/assessment-sessions/:id', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Firebase not initialized' });
    }

    const doc = await db.collection('assessment_sessions').doc(req.params.id).get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'ไม่พบเซสชัน' });
    }

    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error('Error fetching assessment session:', error);
    res.status(500).json({ error: 'ดึงเซสชันไม่สำเร็จ', details: error.message });
  }
});

// ================= EVALUATIONS =================
app.post('/api/evaluations', upload.single('evidence_file'), async (req, res) => {
  try {
    const {
      session_id,
      indicator_id,
      program_id,
      year,
      evaluator_id,
      score,
      target_value,
      comment,
      status,
      major_name
    } = req.body;

    let evidenceFileUrl = null;

    // Upload file to Firebase Storage if provided
    if (req.file && bucket) {
      try {
        const destination = `evidence/${session_id}/${indicator_id}/${req.file.filename}`;
        evidenceFileUrl = await uploadFileToFirebase(req.file.path, destination);
      } catch (uploadError) {
        console.error('File upload error:', uploadError);
        // Continue without file if upload fails
      }
    }

    const evaluationData = {
      session_id: session_id || null,
      indicator_id: indicator_id || null,
      program_id: program_id || null,
      year: year || null,
      evaluator_id: evaluator_id || null,
      score: score ? parseFloat(score) : null,
      target_value: target_value || null,
      comment: comment || null,
      evidence_file_url: evidenceFileUrl,
      evidence_file_name: req.file ? req.file.originalname : null,
      status: status || 'submitted',
      major_name: major_name || null
    };

    const result = await addData('evaluations', evaluationData);

    if (result.success) {
      res.json({
        success: true,
        evaluation_id: result.id,
        evidence_file_url: evidenceFileUrl
      });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Error creating evaluation:', error);
    res.status(500).json({ error: 'บันทึกผลประเมินไม่สำเร็จ', details: error.message });
  }
});

app.get('/api/evaluations', async (req, res) => {
  try {
    const { evaluator_id, program_id, year, component_id, session_id, major_name } = req.query;

    const filters = {};
    if (session_id) filters.session_id = session_id;
    if (major_name) filters.major_name = major_name;
    if (evaluator_id) filters.evaluator_id = parseInt(evaluator_id);
    if (year) filters.year = year; // Allow filtering by year

    const evaluations = await getData('evaluations', filters);
    res.json(evaluations);
  } catch (error) {
    console.error('Error fetching evaluations:', error);
    res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลการประเมินได้', details: error.message });
  }
});

app.get('/api/evaluations/history', async (req, res) => {
  try {
    const { session_id, major_name, year } = req.query;

    const filters = {};
    if (session_id) filters.session_id = session_id;
    if (major_name) filters.major_name = major_name;
    if (year) filters.year = year; // Allow filtering by year

    const evaluations = await getData('evaluations', filters);
    res.json(evaluations);
  } catch (error) {
    console.error('Error fetching evaluation history:', error);
    res.status(500).json({ error: 'ไม่สามารถดึงประวัติการประเมินได้', details: error.message });
  }
});

// ================= EVALUATIONS ACTUAL =================
app.post('/api/evaluations-actual', upload.array('evidence_files', 10), async (req, res) => {
  try {
    const { session_id, indicator_id, operation_result, operation_score, reference_score, goal_achievement, evidence_number, evidence_name, evidence_url, comment, major_name, status, keep_existing, year } = req.body;

    // Check if there is already an approved evaluation for this indicator
    if (db) {
      const existingApproved = await db.collection('evaluations_actual')
        .where('session_id', '==', session_id)
        .where('indicator_id', '==', indicator_id)
        .where('status', '==', 'approved')
        .get();

      if (!existingApproved.empty) {
        return res.status(403).json({
          error: 'cannot_edit_approved',
          message: 'รายการนี้ได้รับการอนุมัติแล้ว ไม่สามารถแก้ไขได้'
        });
      }
    }

    let evidenceFiles = [];
    let evidenceMeta = {};

    // Handle uploaded files
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        evidenceFiles.push(file.filename);

        let publicUrl = null;
        try {
          // Upload to Supabase Storage
          const destination = `evidence_actual/${session_id}/${indicator_id}/${file.filename}`;
          publicUrl = await uploadFileToFirebase(file.path, destination);
        } catch (uploadError) {
          console.error(`Failed to upload ${file.filename} to Supabase:`, uploadError);
        }

        evidenceMeta[file.filename] = {
          name: evidence_name || file.originalname,
          number: evidence_number || '1',
          url: publicUrl // Save the Cloud Storage URL here
        };
      }
    }

    // Handle URL evidence
    if (evidence_url) {
      const urlKey = `url_${Date.now()}`;
      evidenceFiles.push(urlKey);
      evidenceMeta[urlKey] = {
        name: evidence_name || 'URL Evidence',
        number: evidence_number || '1',
        url: evidence_url
      };
    }

    // NEW: Extract and upload large base64 images from HTML to stay under Firestore 1MB limit
    console.log('🖼️ Checking for embedded base64 images...');
    const processedResult = await extractAndUploadBase64Images(operation_result, session_id, indicator_id);
    const processedComment = await extractAndUploadBase64Images(comment, session_id, indicator_id);

    const evaluationData = {
      session_id,
      indicator_id,
      operation_result: processedResult,
      operation_score: operation_score ? parseFloat(operation_score) : null,
      reference_score: reference_score ? parseFloat(reference_score) : null,
      goal_achievement,
      evidence_files_json: JSON.stringify(evidenceFiles),
      evidence_meta_json: JSON.stringify(evidenceMeta),
      comment: processedComment,
      major_name,
      year: year || null,
      status: status || 'submitted'
    };

    const result = await addData('evaluationsActual', evaluationData);

    if (result.success) {
      res.json({
        success: true,
        evaluation_id: result.id,
        evidence_files: evidenceFiles
      });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Error creating actual evaluation:', error);
    res.status(500).json({ error: 'บันทึกผลการดำเนินงานไม่สำเร็จ', details: error.message });
  }
});

// --- Workflow Endpoints ---
app.post('/api/evaluations-actual/:id/submit', async (req, res) => {
  try {
    const { id } = req.params;
    if (!db) return res.json({ success: true }); // Mock success
    await db.collection('evaluations_actual').doc(id).update({
      status: 'pending_review',
      submitted_at: admin.firestore.FieldValue.serverTimestamp()
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/evaluations-actual/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { approved_by } = req.body;
    if (!db) return res.json({ success: true });
    await db.collection('evaluations_actual').doc(id).update({
      status: 'approved',
      approved_at: admin.firestore.FieldValue.serverTimestamp(),
      approved_by: approved_by || 'Manager'
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/evaluations-actual/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { feedback, rejected_by } = req.body;
    if (!db) return res.json({ success: true });
    await db.collection('evaluations_actual').doc(id).update({
      status: 'revision_requested',
      feedback: feedback || '',
      rejected_at: admin.firestore.FieldValue.serverTimestamp(),
      rejected_by: rejected_by || 'Manager'
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});




app.get('/api/evaluations-actual/history', async (req, res) => {
  try {
    const { session_id, major_name, year, filter_approved_only } = req.query;
    if (!major_name) return res.status(400).json({ error: 'กรุณาระบุ major_name' });

    let targetSessionIds = [];
    if (session_id) {
      targetSessionIds = [String(session_id)];
    } else if (year) {
      const sessionSnap = await db.collection('assessment_sessions')
        .where('major_name', '==', major_name)
        .where('round_year', '==', year)
        .get();
      targetSessionIds = sessionSnap.docs.map(doc => doc.id);
    }

    let resultsMap = new Map();

    // Query 1: By Year
    if (year) {
      const snap = await db.collection('evaluations_actual')
        .where('major_name', '==', major_name)
        .where('year', '==', year)
        .get();
      snap.docs.forEach(doc => resultsMap.set(doc.id, { id: doc.id, ...doc.data() }));
    }

    // Query 2: By Session IDs
    if (targetSessionIds.length > 0) {
      for (let i = 0; i < targetSessionIds.length; i += 30) {
        const chunk = targetSessionIds.slice(i, i + 30);
        const snap = await db.collection('evaluations_actual')
          .where('major_name', '==', major_name)
          .where('session_id', 'in', chunk)
          .get();
        snap.docs.forEach(doc => resultsMap.set(doc.id, { id: doc.id, ...doc.data() }));
      }
    }

    // Query 3: Explicit session_id fallback
    if (session_id && resultsMap.size === 0) {
      const snap = await db.collection('evaluations_actual')
        .where('major_name', '==', major_name)
        .where('session_id', '==', String(session_id))
        .get();
      snap.docs.forEach(doc => resultsMap.set(doc.id, { id: doc.id, ...doc.data() }));
    }

    let evaluations = Array.from(resultsMap.values());

    // Soft Match Fallback
    if (evaluations.length === 0 && year) {
      const orphanSnap = await db.collection('evaluations_actual')
        .where('major_name', '==', major_name)
        .get();
      evaluations = orphanSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(ev => !ev.year || ev.year === '');
    }

    res.json(evaluations);
  } catch (error) {
    console.error('Error fetching actual evaluation history:', error);
    res.status(500).json({ error: 'ไม่สามารถดึงประวัติการดำเนินงานได้', details: error.message });
  }
});

// ================= COMMITTEE EVALUATIONS =================
app.post('/api/committee-evaluations', async (req, res) => {
  try {
    const { session_id, major_name, indicator_id, committee_score, strengths, improvements, year } = req.body;

    const evaluationData = {
      session_id,
      major_name,
      indicator_id,
      committee_score: committee_score ? parseFloat(committee_score) : null,
      strengths,
      improvements,
      year: year || null
    };

    const result = await addData('committeeEvaluations', evaluationData);

    if (result.success) {
      res.json({ success: true, id: result.id });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Error creating committee evaluation:', error);
    res.status(500).json({ error: 'บันทึกการประเมินของคณะกรรมการไม่สำเร็จ', details: error.message });
  }
});

// ================= FILE HANDLING =================
app.get('/api/view/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;

    // 1. Try to find the file in evaluations (Legacy/Simple)
    const evalSnap = await db.collection('evaluations')
      .where('evidence_file_name', '==', filename)
      .limit(1)
      .get();

    if (!evalSnap.empty && evalSnap.docs[0].data().evidence_file_url) {
      console.log(`🔗 Redirecting to evaluation URL for: ${filename}`);
      return res.redirect(evalSnap.docs[0].data().evidence_file_url);
    }

    // 2. Try to find the file in evaluations_actual (New system)
    // Since filenames are in a JSON array, we have to search slightly differently or find by meta
    // But filenames in evaluations_actual are often the 'key' in evidence_meta_json
    // Firestore doesn't support searching inside JSON keys easily, so we might need a broader query
    // or just assume if it's not in evaluations, it might be in actual.

    const actualSnap = await db.collection('evaluations_actual').get();
    for (const doc of actualSnap.docs) {
      const data = doc.data();
      const meta = data.evidence_meta_json ? JSON.parse(data.evidence_meta_json) : {};
      if (meta[filename] && meta[filename].url) {
        console.log(`🔗 Redirecting to actual evaluation URL for: ${filename}`);
        return res.redirect(meta[filename].url);
      }
    }

    // 3. Check if file exists locally in uploads directory as a fallback
    const publicLocalPath = path.join(UPLOADS_DIR, filename);
    if (fs.existsSync(publicLocalPath)) {
      return res.sendFile(publicLocalPath);
    }

    // 4. Search in Supabase Storage root as a last resort
    const { data: files } = await supabase.storage
      .from(process.env.SUPABASE_BUCKET_NAME)
      .list('', { search: filename });

    if (files && files.length > 0) {
      const { data: { publicUrl } } = supabase.storage
        .from(process.env.SUPABASE_BUCKET_NAME)
        .getPublicUrl(files[0].name);
      return res.redirect(publicUrl);
    }

    // Also check the specific session/indicator structure in uploads if it was ever used locally
    // Our local structure often matches: uploads/evidence_actual/${session_id}/${indicator_id}/${file.filename}
    // But since we only have 'filename' here, we'd need to recursive search if we really wanted to be thorough locals.

    // For now, if not in root uploads, show the Cloud message
    res.status(404).send(`
      <html>
        <body style="font-family: sans-serif; padding: 40px; text-align: center; color: #333; line-height: 1.6;">
          <h2 style="color: #1d4ed8; margin-bottom: 20px;">หาไฟล์ไม่พบในระบบ Local</h2>
          <p>ลิงก์ที่คุณกำลังเปิดเป็นรูปแบบเก่า (Local Storage) และไฟล์นี้ไม่มีอยู่ใน Server เครื่องนี้แล้วครับ</p>
          
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 25px; border-radius: 16px; display: inline-block; margin-top: 20px; text-align: left; max-width: 500px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
            <p style="font-weight: 700; color: #1e293b; margin-top: 0;">วิธีแก้ไข:</p>
            <ol style="margin-bottom: 0;">
              <li><strong>ไฟล์ที่เพิ่งอัปโหลด:</strong> โปรดกลับไปที่หน้า "สรุปผล" ระบบจะใช้ลิงก์จาก Cloud Storage ให้โดยอัตโนมัติ</li>
              <li><strong>ไฟล์เก่า:</strong> หากเป็นไฟล์ที่เคยอัปโหลดทิ้งไว้และหาไม่พบจริงๆ แนะนำให้ลองอัปโหลดใหม่อีกครั้งครับ ระบบใหม่จะเก็บไว้ใน Cloud ถาวรและปลอดภัยกว่าเดิมครับ</li>
            </ol>
          </div>
          
          <p style="margin-top: 30px; font-size: 0.85rem; color: #94a3b8; font-family: monospace;">
            Resource: ${filename}
          </p>
          <a href="javascript:history.back()" style="display: inline-block; margin-top: 20px; color: #3b82f6; text-decoration: none; font-weight: 500;">← ย้อนกลับ</a>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error viewing file:', error);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการเรียกดูไฟล์' });
  }
});

// ================= DATABASE ADMINISTRATION =================
app.get('/api/admin/db-stats', async (req, res) => {
  try {
    if (!db) {
      // Mock stats for development
      return res.json({
        quality_components: 1,
        indicators: 1,
        evaluations: 0,
        evaluations_actual: 0,
        committee_evaluations: 0,
        assessment_sessions: 2,
        users: mockData.users?.length || 10,
        rounds: 1,
        programs: mockData.programs?.length || 2
      });
    }

    const collections = [
      'quality_components', 'indicators', 'evaluations',
      'evaluations_actual', 'committee_evaluations',
      'assessment_sessions', 'users', 'rounds', 'programs'
    ];

    const stats = {};
    const promises = collections.map(async (col) => {
      const snap = await db.collection(col).count().get();
      stats[col] = snap.data().count;
    });

    // Calculate Storage Size
    let totalSizeBytes = 0;
    if (bucket) {
      try {
        const [files] = await bucket.getFiles({ prefix: 'evidence/' });
        files.forEach(file => {
          totalSizeBytes += parseInt(file.metadata.size || 0);
        });
      } catch (storageError) {
        console.error('Error calculating storage size:', storageError);
      }
    }
    stats.file_storage = totalSizeBytes;

    await Promise.all(promises);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching db-stats:', error);
    res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลสถิติฐานข้อมูลได้', details: error.message });
  }
});

app.post('/api/admin/clear-collection', async (req, res) => {
  try {
    const { collection } = req.body;
    const allowedCollections = [
      'quality_components', 'indicators', 'evaluations',
      'evaluations_actual', 'committee_evaluations',
      'assessment_sessions'
    ];

    if (!allowedCollections.includes(collection)) {
      return res.status(400).json({ error: 'ไม่อนุญาตให้ลบข้อมูลในคอลเลกชันนี้ หรือคอลเลกชันนี้มีความสำคัญสูง' });
    }

    if (!db) {
      console.log(`[ADMIN] Mock clear collection: ${collection}`);
      return res.json({ success: true, message: `(Mock) ล้างข้อมูลใน ${collection} เรียบร้อยแล้ว` });
    }

    // Delete in batches of 500
    const collectionRef = db.collection(collection);
    const snapshot = await collectionRef.get();

    if (snapshot.empty) {
      return res.json({ success: true, message: `คอลเลกชัน ${collection} ไม่มีข้อมูลให้ลบ` });
    }

    const chunks = [];
    const docs = snapshot.docs;
    for (let i = 0; i < docs.length; i += 500) {
      chunks.push(docs.slice(i, i + 500));
    }

    for (const chunk of chunks) {
      const batch = db.batch();
      chunk.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }

    console.log(`[ADMIN] Cleared ${snapshot.size} documents from ${collection}`);
    res.json({ success: true, message: `ล้างข้อมูลใน ${collection} จำนวน ${snapshot.size} รายการ เรียบร้อยแล้ว` });
  } catch (error) {
    console.error(`Error clearing collection ${req.body.collection}:`, error);
    res.status(500).json({ error: 'ไม่สามารถล้างข้อมูลได้', details: error.message });
  }
});

app.post('/api/admin/reset-assessment-data', async (req, res) => {
  try {
    const { year } = req.body;
    const collectionsToClear = [
      'quality_components', 'indicators', 'evaluations',
      'evaluations_actual', 'committee_evaluations',
      'assessment_sessions'
    ];

    if (!db) {
      console.log(`[ADMIN] Mock reset assessment data${year ? ` for year ${year}` : ''}`);
      return res.json({ success: true, message: `(Mock) รีเซ็ตข้อมูลการประเมิน${year ? `ปี ${year} ` : ''}เรียบร้อยแล้ว` });
    }

    let totalDeleted = 0;
    for (const collectionName of collectionsToClear) {
      const collectionRef = db.collection(collectionName);
      let snapshot;

      if (year) {
        const yearField = collectionName === 'assessment_sessions' ? 'round_year' : 'year';
        const yearStr = String(year);
        const yearNum = parseInt(year);

        // Fetch docs for both string and number versions of the year
        const [snapStr, snapNum] = await Promise.all([
          collectionRef.where(yearField, '==', yearStr).get(),
          !isNaN(yearNum) && yearStr !== String(yearNum) ? null : collectionRef.where(yearField, '==', isNaN(yearNum) ? yearStr : yearNum).get()
        ]);

        const docs = new Map();
        if (snapStr) snapStr.docs.forEach(doc => docs.set(doc.id, doc));
        if (snapNum) snapNum.docs.forEach(doc => docs.set(doc.id, doc));

        const docsArray = Array.from(docs.values());
        if (docsArray.length > 0) {
          for (let i = 0; i < docsArray.length; i += 500) {
            const batch = db.batch();
            const chunk = docsArray.slice(i, i + 500);
            chunk.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
          }
          totalDeleted += docsArray.length;
        }
      } else {
        // Total Reset - Delete everything in these collections
        snapshot = await collectionRef.get();
        if (!snapshot.empty) {
          const docs = snapshot.docs;
          for (let i = 0; i < docs.length; i += 500) {
            const batch = db.batch();
            const chunk = docs.slice(i, i + 500);
            chunk.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
          }
          totalDeleted += snapshot.size;
        }
      }
    }

    console.log(`[ADMIN] Reset assessment data: Deleted ${totalDeleted} documents across ${collectionsToClear.length} collections${year ? ` (Year: ${year})` : ''}`);
    res.json({
      success: true,
      message: year
        ? `รีเซ็ตข้อมูลการประเมินปี ${year} เรียบร้อยแล้ว (ลบ ${totalDeleted} รายการ)`
        : 'รีเซ็ตข้อมูลการประเมินทั้งหมด (Wipe All Years) เรียบร้อยแล้ว'
    });
  } catch (error) {
    console.error('Error resetting assessment data:', error);
    res.status(500).json({ error: 'ไม่สามารถรีเซ็ตข้อมูลได้', details: error.message });
  }
});

// ================= PUBLIC STATISTICS =================
app.get('/api/public-stats', async (req, res) => {
  try {
    if (!db) {
      return res.json({
        userCount: 0,
        indicatorCount: 0,
        averageScore: "0.0",
        topComponents: []
      });
    }

    // 0. Get Active Year
    const roundSnap = await db.collection('rounds').where('is_active', '==', true).limit(1).get();
    let currentYear = null;
    if (!roundSnap.empty) {
      currentYear = roundSnap.docs[0].data().year;
    }

    // 1. Basic Counts
    const userSnap = await db.collection('users').count().get();
    let indicatorCount = 0;
    if (currentYear) {
      const indCountSnap = await db.collection('indicators').where('year', '==', String(currentYear)).count().get();
      indicatorCount = indCountSnap.data().count;
    } else {
      const indCountSnap = await db.collection('indicators').count().get();
      indicatorCount = indCountSnap.data().count;
    }

    // 2. Average Score (Committee) - Filtered by Year
    let commQuery = db.collection('committee_evaluations');
    if (currentYear) commQuery = commQuery.where('year', '==', String(currentYear));
    const commSnap = await commQuery.get();

    let totalScoreAll = 0;
    let scoreCountAll = 0;
    commSnap.docs.forEach(doc => {
      const s = parseFloat(doc.data().committee_score);
      if (!isNaN(s) && s > 0) {
        totalScoreAll += s;
        scoreCountAll++;
      }
    });
    const avgScore = scoreCountAll > 0 ? (totalScoreAll / scoreCountAll).toFixed(1) : "0.0";

    // 3. Completion Progress per Component - Filtered by Year
    let actualQuery = db.collection('evaluations_actual');
    if (currentYear) actualQuery = actualQuery.where('year', '==', String(currentYear));
    const actualSnap = await actualQuery.get();

    const evaluatedIndicatorIds = new Set();
    actualSnap.docs.forEach(doc => {
      const id = doc.data().indicator_id;
      if (id) evaluatedIndicatorIds.add(String(id));
    });

    let indQuery = db.collection('indicators');
    if (currentYear) indQuery = indQuery.where('year', '==', String(currentYear));
    const indSnap = await indQuery.get();

    const compSnap = await db.collection('quality_components').get();
    const compIdToName = new Map();
    compSnap.docs.forEach(doc => {
      const d = doc.data();
      if (d.component_id && d.quality_name) {
        compIdToName.set(String(d.component_id), d.quality_name);
      }
    });

    const nameToProgress = new Map();

    indSnap.docs.forEach(doc => {
      const d = doc.data();
      const compId = d.component_id ? String(d.component_id) : null;
      const name = compId ? compIdToName.get(compId) : null;

      if (name) {
        if (!nameToProgress.has(name)) nameToProgress.set(name, { total: 0, done: 0 });
        const stats = nameToProgress.get(name);
        stats.total++;
        if (evaluatedIndicatorIds.has(String(doc.id)) || (d.indicator_id && evaluatedIndicatorIds.has(String(d.indicator_id)))) {
          stats.done++;
        }
      }
    });

    let topComponents = Array.from(nameToProgress.entries())
      .map(([name, stats]) => ({
        name,
        progress: stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0
      }))
      .sort((a, b) => b.progress - a.progress)
      .slice(0, 3);

    // 4. Fallback/Fill with unique names if < 3
    if (topComponents.length < 3) {
      const usedNames = new Set(topComponents.map(c => c.name));
      const allUniqueNames = Array.from(new Set(Array.from(compIdToName.values())));

      const availableNames = allUniqueNames.filter(name => !usedNames.has(name));
      availableNames.slice(0, 3 - topComponents.length).forEach(name => {
        topComponents.push({ name, progress: 0 });
      });
    }

    res.json({
      userCount: userSnap.data().count,
      indicatorCount: indicatorCount,
      averageScore: avgScore,
      topComponents,
      currentYear: currentYear
    });
  } catch (error) {
    console.error('Error in /api/public-stats:', error);
    res.status(500).json({ error: 'Failed to fetch public statistics' });
  }
});

// ================= START SERVER =================
const PORT = process.env.PORT || 3002;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Firebase server running on port ${PORT}`);
    console.log('Note: Add Firebase service account key to enable full functionality');
  });
}

module.exports = app;
// ================= ROUNS (ACADEMIC YEARS) =================
app.get('/api/rounds', async (req, res) => {
  try {
    if (!db) return res.status(500).json({ error: 'Firebase not initialized' });

    const snapshot = await db.collection('rounds').orderBy('year', 'desc').get();
    const rounds = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(rounds);
  } catch (error) {
    console.error('Error fetching rounds:', error);
    res.status(500).json({ error: 'ดึงข้อมูลรอบประเมินไม่สำเร็จ' });
  }
});

app.post('/api/rounds', async (req, res) => {
  try {
    if (!db) return res.status(500).json({ error: 'Firebase not initialized' });

    const { year, name, is_active, start_date, end_date } = req.body;

    // Basic validation
    if (!year || !name) {
      return res.status(400).json({ error: 'ข้อมูลไม่ครบถ้วน (Year, Name จำเป็น)' });
    }

    // If setting to active, we might want to deactivate others? 
    // For now, let's allow multiple or just handle it simple.
    // Usually only one active round.
    if (is_active) {
      // Deactivate others?
      const activeSnaps = await db.collection('rounds').where('is_active', '==', true).get();
      const batch = db.batch();
      activeSnaps.docs.forEach(doc => {
        batch.update(doc.ref, { is_active: false });
      });
      await batch.commit();
    }

    const newRound = {
      year,
      name,
      is_active: !!is_active,
      start_date: start_date || null,
      end_date: end_date || null,
      created_at: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('rounds').add(newRound);
    res.json({ success: true, id: docRef.id, message: 'สร้างรอบประเมินสำเร็จ' });
  } catch (error) {
    console.error('Error creating round:', error);
    res.status(500).json({ error: 'สร้างรอบประเมินไม่สำเร็จ' });
  }
});

app.put('/api/rounds/:id', async (req, res) => {
  try {
    if (!db) return res.status(500).json({ error: 'Firebase not initialized' });

    const { id } = req.params;
    const updateData = {};
    const { year, name, is_active, start_date, end_date } = req.body;

    if (year) updateData.year = year;
    if (name) updateData.name = name;
    if (start_date !== undefined) updateData.start_date = start_date;
    if (end_date !== undefined) updateData.end_date = end_date;
    if (is_active !== undefined) {
      updateData.is_active = is_active;

      // If activating this one, deactivate others
      if (is_active) {
        const activeSnaps = await db.collection('rounds').where('is_active', '==', true).get();
        const batch = db.batch();
        activeSnaps.docs.forEach(doc => {
          if (doc.id !== id) {
            batch.update(doc.ref, { is_active: false });
          }
        });
        await batch.commit();
      }
    }

    updateData.updated_at = admin.firestore.FieldValue.serverTimestamp();

    await db.collection('rounds').doc(id).update(updateData);
    res.json({ success: true, message: 'อัปเดตรอบประเมินสำเร็จ' });
  } catch (error) {
    console.error('Error updating round:', error);
    res.status(500).json({ error: 'อัปเดตรอบประเมินไม่สำเร็จ' });
  }
});

app.delete('/api/rounds/:id', async (req, res) => {
  try {
    if (!db) return res.status(500).json({ error: 'Firebase not initialized' });
    const { id } = req.params;
    await db.collection('rounds').doc(id).delete();
    res.json({ success: true, message: 'ลบรอบประเมินสำเร็จ' });
  } catch (error) {
    console.error('Error deleting round:', error);
    res.status(500).json({ error: 'ลบรอบประเมินไม่สำเร็จ' });
  }
});

// ================= PUBLIC STATISTICS =================
app.get('/api/public-stats', async (req, res) => {
  try {
    if (!db) {
      return res.json({
        userCount: 0,
        indicatorCount: 0,
        averageScore: "0.0",
        topComponents: []
      });
    }

    // 1. Basic Counts
    const userSnap = await db.collection('users').count().get();
    const indicatorSnap = await db.collection('indicators').count().get();

    // 2. Average Score (Committee)
    // We need to fetch committee evaluations to calculate average score
    const commSnap = await db.collection('committee_evaluations').get();
    let totalScore = 0;
    let scoreCount = 0;
    commSnap.docs.forEach(doc => {
      const s = parseFloat(doc.data().committee_score);
      if (!isNaN(s) && s > 0) { // Only consider valid, positive scores
        totalScore += s;
        scoreCount++;
      }
    });
    const avgScore = scoreCount > 0 ? (totalScore / scoreCount).toFixed(1) : "0.0";

    // 3. Top Components for Hero Card
    // Get all quality components to map indicator IDs to component names
    const compSnap = await db.collection('quality_components').limit(10).get(); // Limit to a reasonable number
    const indicatorsData = await db.collection('indicators').get(); // Get all indicators to map to components

    const indToComp = new Map(); // Map indicator_id to quality_name
    indicatorsData.docs.forEach(doc => {
      const data = doc.data();
      // Use doc.id as the primary key for indicators
      if (data.quality_name) {
        indToComp.set(doc.id, data.quality_name);
      }
    });

    const componentsMap = new Map(); // quality_name -> { sum: totalScore, count: numberOfScores }
    commSnap.docs.forEach(doc => {
      const data = doc.data();
      // Ensure indicator_id exists and is a string/number that can be used as a key
      const indicatorId = data.indicator_id;
      const qName = indToComp.get(indicatorId); // Get component name using indicator_id
      const score = parseFloat(data.committee_score);

      if (qName && !isNaN(score) && score > 0) {
        if (!componentsMap.has(qName)) {
          componentsMap.set(qName, { sum: 0, count: 0 });
        }
        const entry = componentsMap.get(qName);
        entry.sum += score;
        entry.count++;
      }
    });

    // Calculate average score for each component and sort
    let topComponents = Array.from(componentsMap.entries())
      .map(([name, stats]) => ({
        name,
        // Assuming max score is 5 for progress calculation
        progress: Math.round((stats.sum / (stats.count * 5)) * 100)
      }))
      .sort((a, b) => b.progress - a.progress) // Sort by progress descending
      .slice(0, 3); // Take top 3

    // Fallback if not enough data-mapped components or no evaluations
    if (topComponents.length < 3) {
      const usedNames = new Set(topComponents.map(c => c.name));
      compSnap.docs.forEach(doc => {
        const name = doc.data().quality_name;
        if (name && !usedNames.has(name) && topComponents.length < 3) {
          topComponents.push({ name, progress: 0 }); // Add with 0% progress
          usedNames.add(name);
        }
      });
    }

    res.json({
      userCount: userSnap.data().count,
      indicatorCount: indicatorSnap.data().count,
      averageScore: avgScore,
      topComponents
    });
  } catch (error) {
    console.error('Error fetching public stats:', error);
    res.status(500).json({ error: 'Failed to fetch public statistics', details: error.message });
  }
});

// ================= ESAR METADATA =================
console.log('Registering ESAR Metadata routes...');
app.get('/api/esar-metadata', async (req, res) => {
  try {
    const { session_id, major_name, year } = req.query;
    // Allow fetching by just major_name and year, or session_id
    if (!session_id && (!major_name || !year)) {
      // return res.status(400).json({ error: 'Need session_id or (major_name + year)' });
      // Allow fetching all if admin? No, let's return empty if no filters
      return res.json({});
    }

    const filters = {};
    if (session_id) filters.session_id = session_id;
    if (major_name) filters.major_name = major_name;
    if (year) filters.year = year;

    const metadata = await getData('esar_metadata', filters);
    res.json(metadata[0] || {});
  } catch (error) {
    console.error('Error fetching ESAR metadata:', error);
    res.status(500).json({ error: 'Failed to fetch metadata' });
  }
});

app.post('/api/esar-metadata', async (req, res) => {
  try {
    const { session_id, major_name, year, data } = req.body;

    const filters = {};
    if (session_id) filters.session_id = session_id;
    if (major_name) filters.major_name = major_name;
    if (year) filters.year = year;

    const existing = await getData('esar_metadata', filters);

    if (existing.length > 0) {
      const id = existing[0].id;
      if (db) {
        await db.collection('esar_metadata').doc(id).update({
          ...data,
          updated_at: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      res.json({ success: true, id });
    } else {
      const newData = {
        session_id,
        major_name,
        year,
        ...data
      };
      const result = await addData('esar_metadata', newData);
      res.json(result);
    }
  } catch (error) {
    console.error('Error saving ESAR metadata:', error);
    res.status(500).json({ error: 'Failed to save metadata' });
  }
});
