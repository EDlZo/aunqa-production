// src/components/EvaluationFormModal.jsx
import React, { useState, useEffect, useRef } from 'react';
import RichTextEditor from './RichTextEditor.jsx';
import { BASE_URL } from '../config/api.js';
import {
  Target,
  FileText,
  BarChart3,
  Activity,
  ClipboardCheck,
  Plus,
  X,
  ChevronLeft,
  Save,
  ShieldCheck,
  Link2,
  AlertCircle,
  Clock,
  ArrowLeft,
  Upload
} from 'lucide-react';
import { useModal } from '../context/ModalContext';

export default function EvaluationFormModal({ indicator, selectedProgram, onComplete, onCancel, allEvaluations, allEvaluationsActual, activeYear, readOnly, currentUser, onApprove, onReject }) {
  const { showAlert, showConfirm, showPrompt } = useModal();
  // ข้อมูลจากการประเมินเกณฑ์ก่อนหน้า (target_value, score)
  const [criteriaData, setCriteriaData] = useState({ target_value: '', score: '' });

  // ข้อมูลการประเมินผลใหม่
  const [operationResult, setOperationResult] = useState(''); // ผลการดำเนินงาน
  const [operationScore, setOperationScore] = useState(''); // คะแนนผลการดำเนินงาน
  const [referenceScore, setReferenceScore] = useState(''); // คะแนนอ้างอิงเกณฑ์
  const [goalAchievement, setGoalAchievement] = useState(''); // การบรรลุเป้า
  const [evidenceNumber, setEvidenceNumber] = useState(''); // หมายเลขหลักฐานอ้างอิง
  const [evidenceName, setEvidenceName] = useState(''); // ชื่อหลักฐานอ้างอิง
  const [evidenceUrl, setEvidenceUrl] = useState(''); // URL หลักฐาน
  const [evidenceFiles, setEvidenceFiles] = useState([]); // ไฟล์หลักฐานหลายไฟล์
  const [comment, setComment] = useState(''); // หมายเหตุ
  const [evidenceType, setEvidenceType] = useState('file'); // 'file' หรือ 'url'

  const [loading, setLoading] = useState(false);
  const [evaluationHistory, setEvaluationHistory] = useState([]);
  const [showEvidenceModal, setShowEvidenceModal] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [pendingEvidenceFiles, setPendingEvidenceFiles] = useState([]); // ไฟล์หลักฐานที่ยังไม่ได้บันทึก
  const fileInputRef = useRef(null);

  // Helper: try relative /api first; if 404, retry against backend port 3001
  const fetchWithFallback = async (path, options) => {
    try {
      const res = await fetch(path, options);
      if (res.status !== 404) return res;
    } catch { }
    try {
      const url = path.startsWith('/api') || path.startsWith('/uploads') ? `${BASE_URL}${path}` : path;
      return await fetch(url, options);
    } catch (err) {
      throw err;
    }
  };

  useEffect(() => {
    // โหลดข้อมูลเกณฑ์การประเมินและการประเมินเดิมจาก props (ถ้ามี)
    if (allEvaluations && allEvaluationsActual) {
      const criteria = allEvaluations.find(ev => String(ev.indicator_id) === String(indicator.id));
      if (criteria) {
        setCriteriaData({
          target_value: criteria.target_value || '',
          score: criteria.score || ''
        });
      }

      const existing = allEvaluationsActual.find(ev => String(ev.indicator_id) === String(indicator.id));
      if (existing) {
        setOperationResult(existing.operation_result || '');
        setOperationScore(existing.operation_score || '');
        setReferenceScore(existing.reference_score || '');
        setGoalAchievement(existing.goal_achievement || '');
        setEvidenceNumber(existing.evidence_number || '');
        setEvidenceName(existing.evidence_name || '');
        setEvidenceUrl(existing.evidence_url || '');
        setComment(existing.comment || '');
      }

      // สำหรับประวัติ (evaluationHistory) ถ้าจะให้สมบูรณ์ควรกรองจาก allEvaluationsActual 
      // แต่ในโมดอลเดิมมีการ fetch แยกเพื่อเอาประวัติทั้งหมดทุก session
      // เพื่อความเร็ว เราจะใช้ข้อมูลปัจจุบันก่อน แล้วค่อย fetch history จริงๆ เพิ่มเติม
      const currentHistory = allEvaluationsActual
        .filter(ev => String(ev.indicator_id) === String(indicator.id))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setEvaluationHistory(currentHistory);
    } else {
      fetchCriteriaData();
      fetchExistingEvaluation();
      fetchEvaluationHistory();
    }
  }, [indicator, allEvaluations, allEvaluationsActual]);

  const fetchCriteriaData = async () => {
    try {
      const sessionId = localStorage.getItem('assessment_session_id') || '';
      const major = selectedProgram?.majorName || selectedProgram?.major_name || '';
      const qs = new URLSearchParams({ session_id: sessionId, major_name: major }).toString();

      // 1) ค้นหาจาก session ปัจจุบันก่อน
      let res = await fetch(`${BASE_URL}/api/evaluations/history?${qs}`);
      let criteriaEvaluation = null;
      if (res.ok) {
        const evaluations = await res.json();
        criteriaEvaluation = (Array.isArray(evaluations) ? evaluations : [])
          .filter(ev => String(ev.session_id) === String(sessionId))
          .find(ev => String(ev.indicator_id) === String(indicator.id));
      }

      // 2) ถ้ายังไม่พบ ให้ค้นจากทุก session ของสาขานี้ แล้วเลือกอันท้ายสุดของตัวบ่งชี้นี้
      if (!criteriaEvaluation) {
        const qsAll = new URLSearchParams({ major_name: major }).toString();
        res = await fetch(`${BASE_URL}/api/evaluations?${qsAll}`);
        if (res.ok) {
          const rows = await res.json();
          const list = (Array.isArray(rows) ? rows : [])
            .filter(ev => String(ev.indicator_id) === String(indicator.id))
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
          criteriaEvaluation = list[0] || null;
        }
      }

      if (criteriaEvaluation) {
        setCriteriaData({
          target_value: criteriaEvaluation.target_value || '',
          score: criteriaEvaluation.score || ''
        });
      } else {
        setCriteriaData({ target_value: '', score: '' });
      }
    } catch (error) {
      console.error('Error fetching criteria data:', error);
    }
  };

  const fetchExistingEvaluation = async () => {
    try {
      const sessionId = localStorage.getItem('assessment_session_id') || '';
      const altId = sessionId && sessionId.length > 10 ? String(Math.floor(Number(sessionId) / 1000)) : '';
      const major = selectedProgram?.majorName || selectedProgram?.major_name || '';
      const qs = new URLSearchParams({ session_id: sessionId, major_name: major }).toString();

      // ดึงจากตาราง evaluations_actual (ตารางผลการดำเนินการ)
      const res = await fetchWithFallback(`/api/evaluations-actual/history?${qs}`);
      if (res.ok) {
        let evaluations = await res.json();
        let list = (Array.isArray(evaluations) ? evaluations : [])
          .filter(ev => !sessionId || String(ev.session_id) === String(sessionId))
          .sort((a, b) => {
            const getTime = (val) => {
              if (!val) return 0;
              if (val instanceof Date) return val.getTime();
              if (typeof val === 'string') return new Date(val).getTime();
              if (val && typeof val === 'object') {
                if (val.seconds) return val.seconds * 1000;
                if (val._seconds) return val._seconds * 1000;
              }
              return 0;
            };
            return getTime(b.created_at) - getTime(a.created_at);
          });

        if (list.length === 0 && altId) {
          list = (Array.isArray(evaluations) ? evaluations : [])
            .filter(ev => String(ev.session_id) === altId)
            .sort((a, b) => {
              const getTime = (val) => {
                if (!val) return 0;
                if (val instanceof Date) return val.getTime();
                if (typeof val === 'string') return new Date(val).getTime();
                if (val && typeof val === 'object') {
                  if (val.seconds) return val.seconds * 1000;
                  if (val._seconds) return val._seconds * 1000;
                }
                return 0;
              };
              return getTime(b.created_at) - getTime(a.created_at);
            });
          if (list.length > 0) {
            try { localStorage.setItem('assessment_session_id', altId); } catch { }
          }
        }

        let evaluation = list.find(ev => String(ev.indicator_id) === String(indicator.id));
        if (!evaluation) {
          // fallback legacy session id
          const resLegacy = await fetchWithFallback(`/api/evaluations-actual/history?${new URLSearchParams({ session_id: '2147483647', major_name: selectedProgram?.majorName || '' }).toString()}`);
          if (resLegacy.ok) {
            const rows = await resLegacy.json();
            evaluation = (Array.isArray(rows) ? rows : [])
              .filter(ev => String(ev.indicator_id) === String(indicator.id))
              .sort((a, b) => {
                const getTime = (val) => {
                  if (!val) return 0;
                  if (val instanceof Date) return val.getTime();
                  if (typeof val === 'string') return new Date(val).getTime();
                  if (val && typeof val === 'object') {
                    if (val.seconds) return val.seconds * 1000;
                    if (val._seconds) return val._seconds * 1000;
                  }
                  return 0;
                };
                return getTime(b.created_at) - getTime(a.created_at);
              })?.[0];
          }
        }
        if (evaluation) {
          setOperationResult(evaluation.operation_result || '');
          setOperationScore(evaluation.operation_score || '');
          setReferenceScore(evaluation.reference_score || '');
          setGoalAchievement(evaluation.goal_achievement || '');
          setEvidenceNumber(evaluation.evidence_number || '');
          setEvidenceName(evaluation.evidence_name || '');
          setEvidenceUrl(evaluation.evidence_url || '');
          // evidence_file is not read into state; only shown in history/summary
          setComment(evaluation.comment || '');
        }
      }
    } catch (error) {
      console.error('Error fetching existing evaluation:', error);
    }
  };

  const fetchEvaluationHistory = async () => {
    try {
      const sessionId = localStorage.getItem('assessment_session_id') || '';
      const altId = sessionId && sessionId.length > 10 ? String(Math.floor(Number(sessionId) / 1000)) : '';
      const major = selectedProgram?.majorName || selectedProgram?.major_name || '';
      let historyRows = [];
      // 1) session ปัจจุบัน
      let res = await fetchWithFallback(`/api/evaluations-actual/history?${new URLSearchParams({ session_id: sessionId, major_name: major }).toString()}`);
      if (res.ok) {
        const rows = await res.json();
        historyRows = Array.isArray(rows) ? rows : [];
        historyRows = historyRows.filter(ev => String(ev.session_id) === String(sessionId));
      }

      // 2) ลองใช้ id แบบวินาทีถ้าข้อ 1 ว่าง
      if (historyRows.length === 0 && altId) {
        res = await fetchWithFallback(`/api/evaluations-actual/history?${new URLSearchParams({ session_id: altId, major_name: major }).toString()}`);
        if (res.ok) {
          const rows = await res.json();
          historyRows = Array.isArray(rows) ? rows : [];
          historyRows = historyRows.filter(ev => String(ev.session_id) === altId);
          if (historyRows.length > 0) {
            try { localStorage.setItem('assessment_session_id', altId); } catch { }
          }
        }
      }

      // 3) Fallback legacy id
      if (historyRows.length === 0) {
        res = await fetchWithFallback(`/api/evaluations-actual/history?${new URLSearchParams({ session_id: '2147483647', major_name: major }).toString()}`);
        if (res.ok) {
          const rows = await res.json();
          historyRows = Array.isArray(rows) ? rows : [];
        }
      }

      const history = historyRows
        .filter(ev => String(ev.indicator_id) === String(indicator.id))
        .sort((a, b) => {
          const getTime = (val) => {
            if (!val) return 0;
            if (val instanceof Date) return val.getTime();
            if (typeof val === 'string') return new Date(val).getTime();
            if (val && typeof val === 'object') {
              if (val.seconds) return val.seconds * 1000;
              if (val._seconds) return val._seconds * 1000;
            }
            return 0;
          };
          return getTime(b.created_at) - getTime(a.created_at);
        });
      setEvaluationHistory(history);
    } catch (error) {
      console.error('Error fetching evaluation history:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const sessionId = localStorage.getItem('assessment_session_id') || '';
      const major = selectedProgram?.majorName || selectedProgram?.major_name || '';

      console.log('========== FORM SUBMISSION ==========');
      console.log('Session ID:', sessionId);
      console.log('Indicator ID:', indicator.id);
      console.log('Major:', major);
      console.log('pendingEvidenceFiles:', pendingEvidenceFiles);

      const maxAllowed = criteriaData.score ? parseFloat(criteriaData.score) : 5.0;
      const opScoreNum = parseFloat(operationScore) || 0;
      const refScoreNum = parseFloat(referenceScore) || 0;

      if (opScoreNum > maxAllowed || refScoreNum > maxAllowed) {
        showAlert({
          title: 'คะแนนเกินเป้าหมาย',
          message: `คะแนนต้องไม่เกินคะแนนเป้าหมายที่กำหนดไว้ (${maxAllowed})`,
          type: 'warning'
        });
        setLoading(false);
        return;
      }

      const formData = new FormData();
      formData.append('session_id', sessionId);
      formData.append('indicator_id', indicator.id);
      formData.append('operation_result', operationResult);
      formData.append('operation_score', operationScore);
      formData.append('reference_score', referenceScore);
      formData.append('goal_achievement', goalAchievement);
      formData.append('evidence_number', evidenceNumber);
      formData.append('evidence_name', evidenceName);
      formData.append('evidence_url', evidenceUrl);
      formData.append('comment', comment);
      formData.append('major_name', major);
      formData.append('status', 'draft');
      if (activeYear) formData.append('year', activeYear);
      // Keep previous files when submitting a new record (merge server-side)
      formData.append('keep_existing', 'true');

      // เพิ่มไฟล์หลักฐานที่ยังไม่ได้บันทึก
      if (pendingEvidenceFiles && pendingEvidenceFiles.length > 0) {
        const numbers = pendingEvidenceFiles.map(item => item.number);
        const names = pendingEvidenceFiles.map(item => item.name);
        const urls = pendingEvidenceFiles.map(item => item.url);

        // ใช้ข้อมูลหลักฐานจากไฟล์แรก (หรือไฟล์เดียว) เป็นข้อมูลหลัก
        const firstEvidence = pendingEvidenceFiles[0];
        if (firstEvidence) {
          formData.set('evidence_number', firstEvidence.number || '');
          formData.set('evidence_name', firstEvidence.name || '');
          formData.set('evidence_url', firstEvidence.url || '');
        }

        // เพิ่มเฉพาะไฟล์ที่มีจริง (ไม่ใช่ URL-only)
        pendingEvidenceFiles.forEach(item => {
          if (item.file) {
            formData.append('evidence_files', item.file);
          }
        });

        formData.append('evidence_numbers', JSON.stringify(numbers));
        formData.append('evidence_names', JSON.stringify(names));
        formData.append('evidence_urls', JSON.stringify(urls));
      }

      // multiple files (ไฟล์หลักฐานจาก state เดิม)
      if (Array.isArray(evidenceFiles)) {
        evidenceFiles.forEach((f) => formData.append('evidence_files', f));
      }

      console.log('--- FormData Contents ---');
      let fileCount = 0;
      for (let [key, value] of formData.entries()) {
        if (value instanceof File) {
          fileCount++;
          console.log(`${key}: [File] ${value.name} (${value.size} bytes)`);
        } else {
          console.log(`${key}: ${value}`);
        }
      }
      console.log('Total files in FormData:', fileCount);
      console.log('========== SENDING TO SERVER ==========');

      const res = await fetchWithFallback('/api/evaluations-actual', {
        method: 'POST',
        body: formData
      });

      console.log('========== SERVER RESPONSE ==========');
      console.log('Response status:', res.status);
      console.log('Response ok:', res.ok);

      if (res.ok) {
        const data = await res.json();
        console.log('Response data:', data);
        try { localStorage.setItem('last_summary_major', selectedProgram?.majorName || ''); } catch { }
        if (fileInputRef.current) { try { fileInputRef.current.value = ''; } catch { } }
        setPendingEvidenceFiles([]);
        onComplete();
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.error('Server error:', res.status, errorData);

        if (res.status === 403 && errorData.error === 'cannot_edit_approved') {
          showAlert({
            title: 'ไม่สามารถบันทึกได้',
            message: 'รายการนี้ได้รับการอนุมัติเรียบร้อยแล้ว ไม่สามารถแก้ไขได้อีกต่อไป',
            type: 'warning'
          });
        } else {
          showAlert({
            title: 'ข้อผิดพลาด',
            message: 'บันทึกไม่สำเร็จ: ' + (errorData.message || res.status),
            type: 'error'
          });
        }
      }
    } catch (error) {
      console.error('========== SUBMISSION ERROR ==========');
      showAlert({ title: 'ข้อผิดพลาด', message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ: ' + error.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleAppendFiles = async (filesToAdd, numbers = [], names = []) => {
    try {
      const sessionId = localStorage.getItem('assessment_session_id') || '';
      const major = selectedProgram?.majorName || '';
      const fd = new FormData();
      fd.append('session_id', sessionId);
      fd.append('indicator_id', indicator.id);
      fd.append('major_name', major);
      filesToAdd.forEach(f => fd.append('evidence_files', f));
      // pass metadata arrays aligned with files
      fd.append('evidence_numbers', JSON.stringify(numbers));
      fd.append('evidence_names', JSON.stringify(names));
      const res = await fetchWithFallback('/api/evaluations-actual/append-files', {
        method: 'POST',
        body: fd
      });
      if (!res.ok) {
        showAlert({ title: 'ข้อผิดพลาด', message: 'เพิ่มไฟล์ไม่สำเร็จ', type: 'error' });
      }
      // refresh history to reflect new files
      await fetchEvaluationHistory();
    } catch (err) {
      console.error('Error appending files:', err);
      showAlert({ title: 'ข้อผิดพลาด', message: 'เกิดข้อผิดพลาดในการเพิ่มไฟล์', type: 'error' });
    }
  };

  const handleRemoveFile = async (filename) => {
    try {
      // ตรวจสอบว่าเป็นไฟล์ที่ยังไม่ได้บันทึกหรือไม่
      const isUnSavedFile = evidenceFiles && evidenceFiles.some(f => f.name === filename);

      if (isUnSavedFile) {
        // ลบไฟล์จาก state (ยังไม่ได้บันทึก)
        setEvidenceFiles(prev => prev.filter(f => f.name !== filename));
        return;
      }

      // ลบไฟล์จากฐานข้อมูล (บันทึกแล้ว)
      const sessionId = localStorage.getItem('assessment_session_id') || '';
      const major = selectedProgram?.majorName || selectedProgram?.major_name || '';
      const res = await fetchWithFallback('/api/evaluations-actual/remove-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, indicator_id: indicator.id, major_name: major, filename })
      });
      if (res.ok) {
        showAlert({ title: 'สำเร็จ', message: 'ลบไฟล์เรียบร้อยแล้ว', type: 'success' });
        fetchExistingData();
      } else {
        const err = await res.json();
        showAlert({ title: 'ข้อผิดพลาด', message: err.error, type: 'error' });
      }
    } catch (err) {
      showAlert({ title: 'ข้อผิดพลาด', message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ', type: 'error' });
    }
  };

  const latestFiles = (() => {
    // รวมไฟล์จากประวัติและไฟล์ที่ยังไม่ได้บันทึก
    let files = [];
    let meta = {};
    let evidence_number = '';
    let evidence_name = '';
    let evidence_url = '';

    // 1. ดึงข้อมูลจากประวัติ (ไฟล์ที่บันทึกแล้ว)
    if (evaluationHistory && evaluationHistory.length > 0) {
      const latest = evaluationHistory[0];
      if (latest.evidence_files_json) {
        try {
          const filesArray = typeof latest.evidence_files_json === 'string'
            ? JSON.parse(latest.evidence_files_json)
            : latest.evidence_files_json;
          if (Array.isArray(filesArray)) files.push(...filesArray);
        } catch { }
      }
      if (latest.evidence_file && !files.includes(latest.evidence_file)) files.push(latest.evidence_file);

      if (latest.evidence_meta_json) {
        try {
          meta = typeof latest.evidence_meta_json === 'string'
            ? JSON.parse(latest.evidence_meta_json)
            : latest.evidence_meta_json;
        } catch { }
      }
      evidence_number = latest.evidence_number || '';
      evidence_name = latest.evidence_name || '';
      evidence_url = latest.evidence_url || '';
    }

    // 2. เพิ่มไฟล์ที่ยังไม่ได้บันทึก
    if (pendingEvidenceFiles && pendingEvidenceFiles.length > 0) {
      pendingEvidenceFiles.forEach((item, index) => {
        // กรณีมีไฟล์: ใช้ชื่อไฟล์
        // กรณีไม่มีไฟล์: ใช้ชื่อจาก metadata หรือ "url_only"
        const filename = item.file
          ? `pending_${index}_${item.file.name}`
          : `pending_${index}_url_${item.name || 'only'}`;
        files.push(filename);
        meta[filename] = {
          number: item.number,
          name: item.name,
          url: item.url
        };
      });
    }

    return files.map((f, index) => ({
      filename: f,
      meta: meta[f] || {},
      evidence_number: f.startsWith('pending_') ? meta[f]?.number || '' : (meta[f]?.number || `${index + 1}`),
      evidence_name: f.startsWith('pending_') ? meta[f]?.name || '' : (meta[f]?.name || evidence_name),
      evidence_url: f.startsWith('pending_') ? '' : evidence_url,
      isPending: f.startsWith('pending_')
    }));
  })();

  return (
    <div className="bg-white rounded-2xl shadow-md">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">บันทึกผลการดำเนินการ</h3>
          <p className="text-sm text-gray-600 mt-1">
            {indicator.sequence} : {indicator.indicator_name}
          </p>
        </div>
        <button
          onClick={onCancel}
          className="flex items-center text-gray-500 hover:text-gray-700 mb-2 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 mr-1" />
          กลับ
        </button>
      </div>

      <div className="p-6">
        {/* ข้อมูลเกณฑ์เป้าหมายเดิม */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-6">
          <div className="flex items-center gap-2 text-blue-800 font-bold mb-2">
            <Target className="w-4 h-4" />
            ข้อมูลเป้าหมายที่กำหนดไว้
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-500">ค่าเป้าหมาย</div>
              <div className="font-medium text-blue-900">{criteriaData.target_value || '-'}</div>
            </div>
            <div>
              <div className="text-gray-500">คะแนนเป้าหมาย</div>
              <div className="font-medium text-blue-900">{criteriaData.score || '-'}</div>
            </div>
          </div>
        </div>

        {/* ฟอร์มการประเมินผลการดำเนินการ */}
        <form onSubmit={handleSubmit}>
          {/* ผลการดำเนินงาน */}
          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              ผลการดำเนินงาน (สิ่งที่เกิดขึ้นจริง) <span className="text-red-500">*</span>
            </label>
            <div className="border border-gray-300 rounded-md overflow-hidden">
              <RichTextEditor
                value={operationResult}
                onChange={setOperationResult}
                placeholder="ระบุรายละเอียดผลลัพธ์ที่เกิดขึ้นจริงจากการดำเนินการ..."
                ariaLabel="ผลการดำเนินงาน"
                minHeight={200}
                readOnly={readOnly}
              />
            </div>
          </div>

          {/* Numerical Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-500" />
                คะแนนผลการดำเนินงาน
              </label>
              <input
                type="number"
                min="0"
                max={criteriaData.score || "5"}
                step="0.1"
                value={operationScore}
                onChange={(e) => setOperationScore(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                placeholder={`0.0 - ${criteriaData.score || "5.0"}`}
                required
                disabled={readOnly}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                <Activity className="w-4 h-4 text-green-500" />
                คะแนนอ้างอิงเกณฑ์
              </label>
              <input
                type="number"
                min="0"
                max={criteriaData.score || "5"}
                step="0.1"
                value={referenceScore}
                onChange={(e) => setReferenceScore(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                placeholder={`0.0 - ${criteriaData.score || "5.0"}`}
                required
                disabled={readOnly}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-purple-500" />
                การบรรลุเป้า
              </label>
              <select
                value={goalAchievement}
                onChange={(e) => setGoalAchievement(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                required
                disabled={readOnly}
              >
                <option value="">เลือกสถานะ...</option>
                <option value="บรรลุ">บรรลุ</option>
                <option value="ไม่บรรลุ">ไม่บรรลุ</option>
                <option value="บรรลุบางส่วน">บรรลุบางส่วน</option>
              </select>
            </div>
          </div>

          {/* Evidence Section */}
          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-indigo-600" />
                หลักฐานอ้างอิง
              </span>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => setShowEvidenceModal(true)}
                  className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700 transition-colors flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> เพิ่มหลักฐาน
                </button>
              )}
            </label>

            <div className="border border-gray-200 rounded-2xl overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2 font-bold text-gray-600 w-16 text-center">No.</th>
                    <th className="px-4 py-2 font-bold text-gray-600">ชื่อเอกสาร</th>
                    <th className="px-4 py-2 font-bold text-gray-600">ประเภท/ลิงก์</th>
                    <th className="px-4 py-2 font-bold text-gray-600 w-16 text-center">ลบ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {latestFiles.length > 0 ? (
                    latestFiles.map((file, index) => (
                      <tr key={file.filename || index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-center text-gray-500">{file.meta?.number || `${index + 1}`}</td>
                        <td className="px-4 py-3 font-medium text-gray-800">
                          {file.meta?.name || file.evidence_name || file.filename}
                        </td>
                        <td className="px-4 py-3">
                          {file.filename.startsWith('url_') || (file.filename.startsWith('pending_') && !file.filename.match(/\.(pdf|jpg|jpeg|png|doc|docx)$/i)) ? (
                            <div className="flex items-center gap-2">
                              {(file.meta?.url || file.evidence_url) ? (
                                <a href={file.meta?.url || file.evidence_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">เปิดลิงก์ URL</a>
                              ) : <span className="text-gray-400 italic">ไม่มีลิงก์</span>}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              {file.isPending ? (
                                <span className="text-gray-500 italic max-w-[150px] truncate">{file.filename.replace(/^pending_\d+_/, '')} (ฉบับร่าง)</span>
                              ) : (
                                <a href={file.meta?.url || `${BASE_URL}/api/view/${encodeURIComponent(file.filename)}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">เปิดไฟล์เอกสาร</a>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {!readOnly && (
                            <button
                              type="button"
                              onClick={() => file.isPending ? setPendingEvidenceFiles(prev => prev.filter((_, i) => i !== parseInt(file.filename.match(/pending_(\d+)_/)?.[1] || '0'))) : handleRemoveFile(file.filename)}
                              className="text-red-400 hover:text-red-600 transition-colors"
                            >
                              <X className="w-4 h-4 mx-auto" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="px-4 py-8 text-center text-gray-400 italic">ยังไม่มีเอกสารแนบ</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              หมายเหตุเพิ่มเติม
            </label>
            <div className="border border-gray-300 rounded-md overflow-hidden">
              <RichTextEditor
                value={comment}
                onChange={setComment}
                placeholder="ระบุหมายเหตุหรือข้อเสนอแนะเพิ่มเติม (ถ้ามี)..."
                ariaLabel="หมายเหตุ"
                minHeight={100}
                readOnly={readOnly}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2 bg-gray-200 text-gray-800 font-bold rounded-xl hover:bg-gray-300 transition-colors flex-1"
            >
              {readOnly ? 'ปิด' : 'ยกเลิก'}
            </button>

            {readOnly && onApprove && onReject && evaluationHistory.length > 0 &&
              evaluationHistory[0].status === 'pending_review' &&
              (['sar_manager', 'qa_admin', 'system_admin'].includes(currentUser?.role)) && (
                <>
                  <button
                    type="button"
                    onClick={() => onReject(evaluationHistory[0].id || evaluationHistory[0]._id)}
                    className="px-6 py-2 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 transition-colors flex-1"
                  >
                    ส่งกลับแก้ไข
                  </button>
                  <button
                    type="button"
                    onClick={() => onApprove(evaluationHistory[0].id || evaluationHistory[0]._id)}
                    className="px-6 py-2 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors flex-1"
                  >
                    อนุมัติ
                  </button>
                </>
              )}

            {!readOnly && (
              <button
                type="submit"
                disabled={loading || !operationResult}
                className="px-6 py-2 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors flex-1"
              >
                {loading ? 'กำลังบันทึก...' : 'บันทึกผลการดำเนินงาน'}
              </button>
            )}
          </div>
        </form>

        {/* History Section ที่คงไว้ในสไตล์เดิม */}
        {evaluationHistory.length > 0 && (
          <div className="mt-12 border-t border-gray-200 pt-8">
            <h4 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Clock className="w-5 h-5 text-gray-400" />
              ประวัติการบันทึกผล ({evaluationHistory.length} รายการ)
            </h4>
            <div className="space-y-4">
              {evaluationHistory.map((evaluation, index) => (
                <div key={evaluation.id || index} className="border border-gray-200 rounded-2xl p-5 bg-gray-50">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-sm font-bold text-gray-700 bg-gray-200 px-3 py-1 rounded">ครั้งที่ {evaluationHistory.length - index}</span>
                    <span className="text-xs text-gray-500">
                      {(() => {
                        const val = evaluation.created_at;
                        if (!val) return '-';
                        if (val instanceof Date) return val.toLocaleString('th-TH');
                        if (typeof val === 'string') return new Date(val).toLocaleString('th-TH');
                        if (val && typeof val === 'object') {
                          if (val.seconds) return new Date(val.seconds * 1000).toLocaleString('th-TH');
                          if (val._seconds) return new Date(val._seconds * 1000).toLocaleString('th-TH');
                        }
                        return '-';
                      })()}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="bg-white p-3 rounded border border-gray-200">
                      <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">คะแนนผลการดำเนินงาน</div>
                      <div className="text-sm font-bold text-gray-800">{evaluation.operation_score || '0.0'}</div>
                    </div>
                    <div className="bg-white p-3 rounded border border-gray-200">
                      <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">คะแนนอ้างอิงเกณฑ์</div>
                      <div className="text-sm font-bold text-gray-800">{evaluation.reference_score || '0.0'}</div>
                    </div>
                    <div className="bg-white p-3 rounded border border-gray-200">
                      <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">การบรรลุเป้า</div>
                      <div className={`text-sm font-bold ${evaluation.goal_achievement === 'บรรลุ' ? 'text-green-600' : 'text-amber-600'}`}>{evaluation.goal_achievement || '-'}</div>
                    </div>
                  </div>
                  {/* Evidence in history */}
                  {(() => {
                    let files = [];
                    let meta = {};
                    if (evaluation.evidence_files_json) {
                      try { files = JSON.parse(evaluation.evidence_files_json) || []; } catch { }
                    }
                    if (evaluation.evidence_meta_json) {
                      try { meta = JSON.parse(evaluation.evidence_meta_json) || {}; } catch { }
                    }
                    if (files.length === 0) return null;
                    return (
                      <div className="flex flex-wrap gap-2 pt-2">
                        {files.map((fname, fidx) => (
                          <a
                            key={fname || fidx}
                            href={meta[fname]?.url || (fname.startsWith('url_') ? meta[fname]?.url : `${BASE_URL}/api/view/${encodeURIComponent(fname)}`)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs bg-white border border-gray-200 px-2 py-1 rounded hover:bg-gray-50 text-blue-600 flex items-center gap-1"
                          >
                            <Link2 className="w-3 h-3" />
                            {meta[fname]?.name || fname}
                          </a>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Evidence Modal ยังจำเป็นต้องใช้เป็น Overlay เพื่อคงความง่ายในการกรอก metadata */}
      {showEvidenceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-white">
              <h4 className="font-bold text-gray-800 flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-600" />
                เพิ่มรายละเอียดหลักฐาน
              </h4>
              <button onClick={() => setShowEvidenceModal(false)} className="bg-gray-50 p-1 rounded-full shadow-sm text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-1">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 px-1">ลำดับ</label>
                  <input
                    type="text"
                    value={evidenceNumber}
                    onChange={(e) => setEvidenceNumber(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-sm"
                    placeholder="1.1-1"
                  />
                </div>
                <div className="col-span-3">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 px-1">ชื่อเรียกหลักฐาน</label>
                  <input
                    type="text"
                    value={evidenceName}
                    onChange={(e) => setEvidenceName(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-sm"
                    placeholder="เช่น รายงานการประชุม..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2">ประเภทหลักฐาน</label>
                <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setEvidenceType('file')}
                    className={`flex-1 py-2 px-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${evidenceType === 'file' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    <FileText className="w-4 h-4" /> ไฟล์
                  </button>
                  <button
                    type="button"
                    onClick={() => setEvidenceType('url')}
                    className={`flex-1 py-2 px-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${evidenceType === 'url' ? 'bg-white shadow-sm text-green-600' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    <Link2 className="w-4 h-4" /> URL
                  </button>
                </div>
              </div>

              {evidenceType === 'file' ? (
                <div>
                  <div className="mt-1">
                    <input
                      type="file"
                      id="evidence-file-input"
                      ref={fileInputRef}
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      onChange={(e) => setEvidenceFiles(Array.from(e.target.files || []))}
                      style={{ display: 'none' }}
                    />
                    <label
                      htmlFor="evidence-file-input"
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragging(true);
                      }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragging(false);
                        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                          setEvidenceFiles(Array.from(e.dataTransfer.files));
                        }
                      }}
                      className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 group ${isDragging ? 'bg-blue-50 border-blue-500 scale-[1.02]' : 'bg-gray-50 border-gray-300 hover:bg-gray-100 hover:border-blue-400'}`}
                    >
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <div className="p-3 bg-white rounded-full shadow-sm mb-3 group-hover:scale-110 transition-transform">
                          <Upload className="w-6 h-6 text-blue-600" />
                        </div>
                        <p className="mb-1 text-sm text-gray-700 font-semibold">
                          {evidenceFiles.length > 0 ? 'เลือกไฟล์ใหม่' : 'คลิกเพื่อเลือกไฟล์'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {evidenceFiles.length > 0 ? evidenceFiles[0].name : 'PDF, JPG, PNG หรือ Word (ไม่เกิน 10MB)'}
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              ) : (
                <div className="animate-in slide-in-from-left-2 duration-200">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 px-1">ลิงก์ URL</label>
                  <input
                    type="url"
                    value={evidenceUrl}
                    onChange={(e) => setEvidenceUrl(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all outline-none text-sm"
                    placeholder="https://..."
                  />
                </div>
              )}
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex gap-3">
              <button
                type="button"
                onClick={() => setShowEvidenceModal(false)}
                className="flex-1 py-2 text-gray-600 font-bold hover:underline"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!evidenceNumber || !evidenceName) {
                    showAlert({ title: 'ข้อมูลไม่ครบ', message: 'กรุณากรอกข้อมูลให้ครบถ้วน', type: 'warning' });
                    return;
                  }
                  if (evidenceType === 'file' && evidenceFiles.length === 0) {
                    showAlert({ title: 'ไม่ได้เลือกไฟล์', message: 'กรุณาเลือกไฟล์', type: 'warning' });
                    return;
                  }
                  if (evidenceType === 'url' && !evidenceUrl) {
                    showAlert({ title: 'ไม่ได้กรอก URL', message: 'กรุณากรอก URL', type: 'warning' });
                    return;
                  }

                  const newEvidence = {
                    file: evidenceType === 'file' ? evidenceFiles[0] : null,
                    number: evidenceNumber,
                    name: evidenceName,
                    url: evidenceType === 'url' ? evidenceUrl : ''
                  };

                  setPendingEvidenceFiles(prev => [...prev, newEvidence]);
                  setEvidenceNumber('');
                  setEvidenceName('');
                  setEvidenceFiles([]);
                  setEvidenceUrl('');
                  setShowEvidenceModal(false);
                }}
                className="flex-1 py-2 bg-blue-600 text-white font-bold rounded hover:bg-blue-700 transition-colors"
              >
                เพิ่มรายการ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}