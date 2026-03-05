// src/components/IndicatorTable.jsx
import React, { useState, useEffect } from 'react';
import { AUNQA_SUBITEMS } from '../templates/aunqa';
import IndicatorForm from './IndicatorForm';
import { BASE_URL } from '../config/api.js';
import { Trash2 } from 'lucide-react';


export default function IndicatorTable({
  selectedComponent,
  indicators,
  onEditClick,
  onDeleteClick,
  onAddIndicator,
  onUpdateIndicator,
  onAfterBulkAdded,
  onAssessingChange,
  evaluatedMap = {},
  onMarkEvaluated
}) {
  const [showForm, setShowForm] = useState(true);

  const formatSequence = (seq) => {
    if (!seq) return '';
    try {
      // Split by dot and remove leading zeros from each part
      return String(seq).split('.')
        .map(part => String(parseInt(part, 10)))
        .join('.');
    } catch {
      return String(seq);
    }
  };

  const pad2 = (n) => {
    try { return String(parseInt(String(n), 10)).padStart(2, '0'); } catch { return '00'; }
  };



  // State สำหรับฟอร์ม
  const [indicatorSequence, setIndicatorSequence] = useState('');
  const [indicatorType, setIndicatorType] = useState('');
  const [criteriaType, setCriteriaType] = useState('');
  const [indicatorName, setIndicatorName] = useState('');
  const [dataSource, setDataSource] = useState('');
  const [parentId, setParentId] = useState(''); // Parent for the new indicator
  const [error, setError] = useState('');
  const [flash, setFlash] = useState({ message: '', type: 'success' });
  const [assessIndicator, setAssessIndicator] = useState(null);
  const [assessTarget, setAssessTarget] = useState('');
  const [assessScore, setAssessScore] = useState('');
  const [assessComment, setAssessComment] = useState('');
  const [evaluatedIndicators, setEvaluatedIndicators] = useState(new Set()); // เก็บ ID ของตัวบ่งชี้ที่ประเมินแล้ว
  const [evaluationHistory, setEvaluationHistory] = useState([]); // เก็บประวัติการประเมินสำหรับตัวบ่งชี้ปัจจุบัน
  const [editingIndicator, setEditingIndicator] = useState(null); // ตัวบ่งชี้ที่กำลังแก้ไข
  const [masterIndicators, setMasterIndicators] = useState([]); // แม่แบบตัวบ่งชี้จากระบบ
  const [rounds, setRounds] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [allMasterComponents, setAllMasterComponents] = useState([]);
  const [selectedMasterId, setSelectedMasterId] = useState(''); // เก็บ ID ของแม่แบบที่เลือก

  useEffect(() => {
    fetchMasterIndicators();
  }, [selectedComponent, allMasterComponents]);

  const fetchMasterIndicators = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/master-indicators`);
      if (res.ok) {
        const data = await res.json();
        let compId = selectedComponent?.component_id || selectedComponent?.componentId;

        console.log(`🔍 Checking indicators for component: "${selectedComponent?.quality_name}" (ID in DB: ${compId})`);

        // Fallback: ถ้าไม่มี component_id ให้ลองหาจากชื่อใน allMasterComponents
        if (!compId && selectedComponent?.quality_name) {
          console.log(`⚠️ Missing component_id. Searching in ${allMasterComponents.length} master templates...`);
          const matchedMaster = allMasterComponents.find(c =>
            String(c.quality_name || '').trim().toLowerCase() === String(selectedComponent.quality_name || '').trim().toLowerCase()
          );
          if (matchedMaster) {
            compId = matchedMaster.component_id;
            console.log(`✅ Healed missing component_id for "${selectedComponent.quality_name}" -> ${compId}`);
          } else {
            console.log(`❌ Could not find master template with name: "${selectedComponent.quality_name}"`);
            console.log('Available master components:', allMasterComponents.map(c => c.quality_name));
          }
        }

        // กรองเฉพาะตัวบ่งชี้ขององค์ประกอบนี้ 
        const filtered = data.filter(ind => {
          const indCompId = String(ind.component_id);
          const targetCompId = String(compId);
          return indCompId === targetCompId;
        });

        console.log(`📊 Found ${filtered.length} master indicators for ID ${compId}`);
        setMasterIndicators(filtered);
      }
    } catch (err) { console.error('Error fetching master indicators:', err); }
  };

  const fetchMeta = async () => {
    try {
      const [rRes, pRes, cRes] = await Promise.all([
        fetch(`${BASE_URL}/api/rounds`),
        fetch(`${BASE_URL}/api/programs`),
        fetch(`${BASE_URL}/api/master-quality-components`)
      ]);
      if (rRes.ok) setRounds(await rRes.json());
      if (pRes.ok) setPrograms(await pRes.json());
      if (cRes.ok) setAllMasterComponents(await cRes.json());
    } catch (err) { console.error('Error fetching meta:', err); }
  };

  useEffect(() => {
    fetchMeta();
  }, []);

  useEffect(() => {
    if (!flash.message) return;
    const t = setTimeout(() => setFlash({ message: '', type: 'success' }), 3000);
    return () => clearTimeout(t);
  }, [flash.message]);

  // ดึงข้อมูลการประเมินเพื่อเช็คสถานะ
  const fetchEvaluationStatus = async () => {
    if (!selectedComponent) return;
    try {
      let sessionId = localStorage.getItem('assessment_session_id') || '';
      const altId = sessionId && sessionId.length > 10 ? String(Math.floor(Number(sessionId) / 1000)) : '';
      const sel = localStorage.getItem('selectedProgramContext');
      const major = sel ? (JSON.parse(sel)?.majorName || JSON.parse(sel)?.major_name || '') : '';
      const qs = new URLSearchParams({ session_id: sessionId, major_name: major }).toString();

      let res = await fetch(`${BASE_URL}/api/evaluations/history?${qs}`);
      if (res.ok) {
        let evaluations = await res.json();
        // กรองเฉพาะของ session ปัจจุบัน และสถานะที่ส่งแล้ว
        let list = (Array.isArray(evaluations) ? evaluations : [])
          .filter(ev => String(ev.session_id) === String(sessionId) && (ev.status ? String(ev.status).toLowerCase() === 'submitted' : true));
        // ลองใช้รูปแบบ seconds หากยังไม่เจอ
        if (list.length === 0 && altId) {
          list = (Array.isArray(evaluations) ? evaluations : [])
            .filter(ev => String(ev.session_id) === altId && (ev.status ? String(ev.status).toLowerCase() === 'submitted' : true));
          if (list.length > 0) {
            try { localStorage.setItem('assessment_session_id', altId); } catch { }
          }
        }
        let evaluatedIds = new Set(list.map(ev => String(ev.indicator_id)));
        // ถ้ายังว่าง ลองดึงผ่าน endpoint component_id เฉพาะ component ปัจจุบัน
        if (evaluatedIds.size === 0 && selectedComponent?.id) {
          const qs2 = new URLSearchParams({ component_id: selectedComponent.id, session_id: sessionId, major_name: major }).toString();
          const res2 = await fetch(`${BASE_URL}/api/evaluations?${qs2}`);
          if (res2.ok) {
            const rows = await res2.json();
            evaluatedIds = new Set((Array.isArray(rows) ? rows : []).map(r => String(r.indicator_id)));
          }
        }
        // ถ้ายังว่าง ให้ fallback legacy id
        if (evaluatedIds.size === 0) {
          const qsLegacy = new URLSearchParams({ session_id: '2147483647', major_name: major }).toString();
          const resLegacy = await fetch(`${BASE_URL}/api/evaluations/history?${qsLegacy}`);
          if (resLegacy.ok) {
            const rows = await resLegacy.json();
            evaluatedIds = new Set((Array.isArray(rows) ? rows : []).map(r => String(r.indicator_id)));
          }
        }
        setEvaluatedIndicators(evaluatedIds);
      } else {
        console.error('Failed to fetch evaluations:', res.status, res.statusText);
      }
    } catch (error) {
      console.error('Error fetching evaluation status:', error);
    }
  };

  // เรียกดึงข้อมูลสถานะการประเมินเมื่อ component หรือ indicators เปลี่ยน
  useEffect(() => {
    fetchEvaluationStatus();
  }, [selectedComponent, indicators]);

  // ดึงข้อมูลการประเมินเฉพาะตัวบ่งชี้ที่เลือก
  const fetchIndicatorEvaluation = async (indicatorId) => {
    try {
      const sessionId = localStorage.getItem('assessment_session_id') || '';
      const sel = localStorage.getItem('selectedProgramContext');
      const major = sel ? (JSON.parse(sel)?.majorName || JSON.parse(sel)?.major_name || '') : '';
      const qs = new URLSearchParams({ session_id: sessionId, major_name: major }).toString();

      // ลองหาใน session ปัจจุบันก่อน
      let res = await fetch(`${BASE_URL}/api/evaluations/history?${qs}`);
      if (res.ok) {
        const evaluations = await res.json();
        const evaluation = (Array.isArray(evaluations) ? evaluations : [])
          .filter(ev => String(ev.session_id) === String(sessionId))
          .find(ev => String(ev.indicator_id) === String(indicatorId));
        if (evaluation) return evaluation;
      }

      // ถ้าไม่พบ ให้ดึงทุก session ใน major เดียวกันผ่าน /api/evaluations
      if (selectedComponent?.id) {
        const qs2 = new URLSearchParams({ component_id: selectedComponent.id, major_name: major }).toString();
        res = await fetch(`${BASE_URL}/api/evaluations?${qs2}`);
        if (res.ok) {
          const rows = await res.json();
          const history = (Array.isArray(rows) ? rows : [])
            .filter(ev => String(ev.indicator_id) === String(indicatorId))
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
          return history[0] || null;
        }
      }
    } catch (error) {
      console.error('Error fetching indicator evaluation:', error);
    }
    return null;
  };

  // ดึงประวัติการประเมินทั้งหมดของตัวบ่งชี้ (รวมทั้ง session ปัจจุบันและทั้งหมดใน major)
  const fetchIndicatorHistory = async (indicatorId) => {
    try {
      const sessionId = localStorage.getItem('assessment_session_id') || '';
      const sel = localStorage.getItem('selectedProgramContext');
      const major = sel ? (JSON.parse(sel)?.majorName || JSON.parse(sel)?.major_name || '') : '';
      if (!selectedComponent?.id) { setEvaluationHistory([]); return; }

      const qs1 = new URLSearchParams({ session_id: sessionId, major_name: major }).toString();
      const qs2 = new URLSearchParams({ component_id: selectedComponent.id, major_name: major }).toString();

      const [res1, res2] = await Promise.all([
        fetch(`${BASE_URL}/api/evaluations/history?${qs1}`),
        fetch(`${BASE_URL}/api/evaluations?${qs2}`)
      ]);

      const arr1 = res1.ok ? await res1.json() : [];
      const arr2 = res2.ok ? await res2.json() : [];

      const merged = [...(Array.isArray(arr1) ? arr1 : []), ...(Array.isArray(arr2) ? arr2 : [])];

      // กรองเฉพาะตัวบ่งชี้นี้ และลบซ้ำตาม evaluation_id
      const byIndicator = merged.filter(ev => String(ev.indicator_id) === String(indicatorId));
      const seen = new Set();
      const deduped = [];
      for (const ev of byIndicator) {
        const key = String(ev.evaluation_id || `${ev.session_id}-${ev.indicator_id}-${ev.created_at}`);
        if (!seen.has(key)) { seen.add(key); deduped.push(ev); }
      }

      deduped.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setEvaluationHistory(deduped);
    } catch (error) {
      console.error('Error fetching indicator history:', error);
      setEvaluationHistory([]);
    }
  };

  // ฟังอีเวนต์จากพาเรนท์เพื่อปิดหน้าเกณฑ์ (ใช้ตอนกดปุ่มกลับด้านบนของ DefineComponentSection)
  useEffect(() => {
    const handler = () => setAssessIndicator(null);
    window.addEventListener('close-assessment', handler);
    return () => window.removeEventListener('close-assessment', handler);
  }, []);

  // แจ้งให้หน้าพ่อทราบสถานะการอยู่ในหน้าประเมิน เพื่อซ่อน/แสดงปุ่มกลับของหน้าด้านนอก
  useEffect(() => {
    if (typeof onAfterBulkAdded === 'undefined' && typeof onAssessingChange === 'undefined') return;
    if (typeof onAssessingChange === 'function') {
      try { onAssessingChange(Boolean(assessIndicator)); } catch { }
    }
  }, [assessIndicator]);

  if (!selectedComponent) {
    return null;
  }
  const indicatorList = indicators?.[selectedComponent.id] || [];

  const handleOpenForm = () => {
    setShowForm(true);
    setIndicatorSequence('');
    setIndicatorType('');
    setCriteriaType('');
    setIndicatorName('');
    setDataSource('');
    setError('');
  };

  const handleCancel = () => {
    setIndicatorSequence('');
    setIndicatorType('');
    setCriteriaType('');
    setIndicatorName('');
    setDataSource('');
    setParentId('');
    setSelectedMasterId('');
    setEditingIndicator(null);
    setError('');
    setShowForm(true);
  };

  const handleEdit = (indicator) => {
    setEditingIndicator(indicator);
    setIndicatorSequence(indicator.sequence || '');
    setIndicatorType(indicator.indicator_type || '');
    setCriteriaType(indicator.criteria_type || '');
    setIndicatorName(indicator.indicator_name || '');
    setDataSource(indicator.data_source || '');
    setParentId(indicator.parent_id || '');
    setShowForm(true);
    // Scroll to form or show user we are editing
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const mainMatch = String(indicatorName || '').match(/^\s*AUN\.(\d+)/i);
    if (!mainMatch) {
      if (!indicatorSequence || !indicatorType || !criteriaType || !indicatorName) {
        setError('กรุณากรอกข้อมูลให้ครบถ้วน');
        return;
      }
      // ตรวจซ้ำก่อนเพิ่ม (ลำดับหรือชื่อซ้ำ)
      const dupBySeq = indicatorList.some(ind => String(ind.sequence).trim() === String(indicatorSequence).trim());
      // Removed duplicate name check as per request
      // const dupByName = indicatorList.some(ind => {
      //   const nameA = String(ind.indicator_name || ind.indicatorName || '').trim().toLowerCase();
      //   const nameB = String(indicatorName).trim().toLowerCase();
      //   return nameA === nameB;
      // });
      if (dupBySeq) {
        setFlash({ message: 'มีตัวบ่งชี้ลำดับนี้แล้ว', type: 'error' });
        return;
      }
    }
    // 1. หารหัสองค์ประกอบที่ถูกต้อง (Heal ID if missing)
    let healedCompId = selectedComponent?.component_id || selectedComponent?.componentId;
    if (!healedCompId && selectedComponent?.quality_name) {
      const matchedMaster = allMasterComponents.find(c =>
        String(c.quality_name || '').trim().toLowerCase() === String(selectedComponent.quality_name || '').trim().toLowerCase()
      );
      if (matchedMaster) {
        healedCompId = matchedMaster.component_id;
        console.log(`✅ Healed ID for Submit: ${healedCompId}`);
      }
    }

    // สร้าง object ตัวบ่งชี้ใหม่
    const newIndicator = {
      component_id: healedCompId,
      sequence: indicatorSequence,
      indicator_type: indicatorType,
      criteria_type: criteriaType,
      indicator_name: indicatorName,
      data_source: dataSource,
      parent_id: parentId
    };
    try {
      if (editingIndicator) {
        // Mode: Update
        if (typeof onUpdateIndicator === 'function') {
          await onUpdateIndicator(editingIndicator.id, {
            sequence: indicatorSequence,
            indicator_type: indicatorType,
            criteria_type: criteriaType,
            indicator_name: indicatorName,
            data_source: dataSource,
            parent_id: parentId
          });
          setFlash({ message: 'แก้ไขตัวบ่งชี้สำร็จ', type: 'success' });
          handleCancel(); // Clear form and exit edit mode
        }
        return;
      }

      if (mainMatch) {
        // การทำงานเดิม (ยกเลิกการเพิ่มหัวข้อย่อยอัตโนมัติ 8 ข้อตามคำขอผู้ใช้)
        // เราจะเพิ่มเฉพาะหัวข้อหลักที่ผู้ใช้เลือกเท่านั้น

        const mainCode = `AUN.${mainMatch[1]}`;
        const mainPart = String(parseInt(mainMatch[1], 10));

        const existsMain = indicatorList.some(ind => {
          // Removed duplicate name check as per request
          // const nameA = String(ind.indicator_name || ind.indicatorName || '').trim().toLowerCase();
          // const nameB = String(indicatorName).trim().toLowerCase();
          return String(ind.sequence) === mainPart; // || nameA === nameB;
        });

        if (existsMain) {
          setFlash({ message: 'มีตัวบ่งชี้ลำดับนี้แล้ว', type: 'error' });
          return;
        }

        // ส่งให้ component แม่จัดการเพิ่มเฉพาะหัวข้อหลัก
        if (typeof onAddIndicator === 'function') {
          // 1. Add Main Indicator
          await onAddIndicator({
            indicator_name: indicatorName,
            sequence: mainPart,
            indicator_type: indicatorType || 'ผลลัพธ์',
            criteria_type: criteriaType || 'เชิงคุณภาพ',
            data_source: dataSource || ''
          });

          // 2. Add Sub-indicators (RESTORED)
          const list = AUNQA_SUBITEMS[mainCode] || [];
          for (const item of list) {
            await onAddIndicator({
              indicator_name: item.text,
              sequence: `${mainPart}.${item.seq}`,
              indicator_type: 'ผลลัพธ์',
              criteria_type: 'เชิงคุณภาพ',
              data_source: ''
            });
          }

          setIndicatorSequence('');
          setIndicatorName('');
          setFlash({ message: `เพิ่มตัวบ่งชี้ ${mainCode} และข้อย่อยเรียบร้อย`, type: 'success' });

          if (typeof onAfterBulkAdded === 'function') {
            await onAfterBulkAdded();
          }
        }
        return;
      }
      // เรียก API เพิ่มตัวบ่งชี้ ผ่าน prop onAddIndicator ของ component แม่ (DefineComponentSection)
      if (typeof onAddIndicator === 'function') {
        try {
          // 1. เพิ่มตัวบ่งชี้หลัก (ที่เลือกจาก dropdown หรือกรอกเอง)
          await onAddIndicator(newIndicator);

          // 2. ถ้าเลือกจากแม่แบบ ให้ดึงข้อย่อยมาเพิ่มด้วย
          let addedCount = 1;
          if (selectedMasterId) {
            const children = masterIndicators.filter(m => m.parent_id === selectedMasterId);
            if (children.length > 0) {
              // เรียงลำดับข้อย่อยตามลำดับ (sequence)
              children.sort((a, b) => String(a.sequence).localeCompare(String(b.sequence), undefined, { numeric: true }));

              for (const child of children) {
                await onAddIndicator({
                  component_id: healedCompId,
                  indicator_name: child.indicator_name,
                  sequence: child.sequence,
                  indicator_type: child.indicator_type,
                  criteria_type: child.criteria_type,
                  data_source: child.data_source || ''
                });
                addedCount++;
              }
            }
          }

          // รีเซ็ตฟอร์มหลังจากสำเร็จ (Parent component จะจัดการ Refresh ข้อมูลเอง)
          setIndicatorSequence('');
          setIndicatorType('');
          setCriteriaType('');
          setIndicatorName('');
          setDataSource('');
          setSelectedMasterId('');
          setError('');

          setFlash({
            message: selectedMasterId && addedCount > 1
              ? `เพิ่มตัวบ่งชี้และข้อย่อยทั้งหมด ${addedCount} รายการเรียบร้อย`
              : 'เพิ่มตัวบ่งชี้เรียบร้อย',
            type: 'success'
          });

          if (typeof onAfterBulkAdded === 'function') {
            await onAfterBulkAdded(healedCompId);
          }
        } catch (err) {
          setError('เกิดข้อผิดพลาดในการบันทึกตัวบ่งชี้');
        }
      }
    } catch (err) {
      setError('เกิดข้อผิดพลาดในการบันทึกตัวบ่งชี้');
    }
  };

  const handleSubmitAssessment = async () => {
    if (!assessIndicator) return;
    let sessionId = localStorage.getItem('assessment_session_id') || '';
    const normalizedId = sessionId && sessionId.length > 10 ? String(Math.floor(Number(sessionId) / 1000)) : sessionId;
    if (normalizedId !== sessionId) {
      try { localStorage.setItem('assessment_session_id', normalizedId); } catch { }
    }
    const sel = localStorage.getItem('selectedProgramContext');
    const major = sel ? (JSON.parse(sel)?.majorName || JSON.parse(sel)?.major_name || '') : '';

    // เช็คว่าเคยประเมินแล้วหรือไม่
    const existingEvaluation = await fetchIndicatorEvaluation(assessIndicator.id);

    const formData = new FormData();
    formData.append('session_id', normalizedId);
    formData.append('indicator_id', assessIndicator.id);
    formData.append('score', assessScore);
    formData.append('target_value', assessTarget); // เก็บ target ใน target_value field
    formData.append('comment', assessComment);
    formData.append('status', 'submitted');
    formData.append('major_name', major);

    console.log('Sending evaluation data:', {
      session_id: sessionId,
      indicator_id: assessIndicator.id,
      score: assessScore,
      target_value: assessTarget,
      comment: assessComment,
      major_name: major
    });

    try {
      const res = await fetch(`${BASE_URL}/api/evaluations`, { method: 'POST', body: formData });
      const responseText = await res.text();
      console.log('Server response:', responseText);

      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = { success: false, error: 'Invalid response format' };
      }

      if (res.ok && responseData.success) {
        const message = existingEvaluation ?
          'อัปเดตเกณฑ์การประเมินเรียบร้อย' :
          'บันทึกเกณฑ์การประเมินเรียบร้อย';
        setFlash({ message, type: 'success' });
        setAssessIndicator(null);
        setAssessTarget('');
        setAssessScore('');
        setAssessComment('');
        // อัปเดตสถานะการประเมิน
        await fetchEvaluationStatus();
        // รีเฟรชประวัติการประเมิน
        if (assessIndicator) {
          await fetchIndicatorHistory(assessIndicator.id);
        }
        // reset all fields
      } else {
        const errorMessage = responseData.error || responseData.details || 'บันทึกไม่สำเร็จ';
        setFlash({ message: errorMessage, type: 'error' });
        console.error('Server error:', responseData);
      }
    } catch (error) {
      console.error('Network error:', error);
      setFlash({ message: 'บันทึกไม่สำเร็จ: ' + error.message, type: 'error' });
    }
  };

  // Single-view mode: show only assessment form when assessIndicator is selected
  if (assessIndicator) {
    return (
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-medium text-gray-900">เกณฑ์การประเมิน</h3>
          <button
            className="flex items-center text-gray-500 hover:text-gray-700 mb-2 transition-colors"
            onClick={() => { setAssessIndicator(null); if (typeof onAssessingChange === 'function') { try { onAssessingChange(false); } catch { } } }}
          >
            <ArrowLeft className="w-5 h-5 mr-1" />
            กลับ
          </button>
        </div>
        {flash.message && (
          <div className={`mb-4 rounded-md px-4 py-2 border ${flash.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
            {flash.message}
            <button className={`${flash.type === 'success' ? 'text-green-700' : 'text-red-700'} float-right`} onClick={() => setFlash({ message: '', type: 'success' })}>×</button>
          </div>
        )}
        <div className="bg-white border border-gray-200 rounded-2xl">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <div className="text-sm text-gray-700 mb-2">{assessIndicator.sequence} : {assessIndicator.indicator_name}</div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-500">ชนิดตัวบ่งชี้</div>
                <div className="font-medium">{assessIndicator.indicator_type || '-'}</div>
              </div>
              <div>
                <div className="text-gray-500">ชนิดเกณฑ์มาตรฐาน</div>
                <div className="font-medium">{assessIndicator.criteria_type || '-'}</div>
              </div>
            </div>
          </div>
          <div className="p-4">
            {/* เกณฑ์การประเมิน - แสดงเป็นตาราง */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">เกณฑ์การประเมิน</label>
              <div className="overflow-x-auto">
                <table className="w-full border border-gray-200">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-200 px-4 py-2 text-center font-medium text-gray-700">ระดับ 1</th>
                      <th className="border border-gray-200 px-4 py-2 text-center font-medium text-gray-700">ระดับ 2</th>
                      <th className="border border-gray-200 px-4 py-2 text-center font-medium text-gray-700">ระดับ 3</th>
                      <th className="border border-gray-200 px-4 py-2 text-center font-medium text-gray-700">ระดับ 4</th>
                      <th className="border border-gray-200 px-4 py-2 text-center font-medium text-gray-700">ระดับ 5</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-gray-200 px-4 py-2 text-sm text-gray-600">มีการดำเนินงานระดับ 1</td>
                      <td className="border border-gray-200 px-4 py-2 text-sm text-gray-600">มีการดำเนินงานระดับ 2</td>
                      <td className="border border-gray-200 px-4 py-2 text-sm text-gray-600">มีการดำเนินงานระดับ 3</td>
                      <td className="border border-gray-200 px-4 py-2 text-sm text-gray-600">มีการดำเนินงานระดับ 4</td>
                      <td className="border border-gray-200 px-4 py-2 text-sm text-gray-600">มีการดำเนินงานระดับ 5-7</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* ช่องกรอกข้อมูล */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">ค่าเป้าหมาย</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={assessTarget}
                  onChange={e => setAssessTarget(e.target.value)}
                  placeholder="กรอกค่าเป้าหมาย"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">คะแนนค่าเป้าหมาย</label>
                <input
                  type="number"
                  min="0"
                  max="5"
                  step="0.1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={assessScore}
                  onChange={e => setAssessScore(e.target.value)}
                  placeholder="0.0 - 5.0"
                />
              </div>
            </div>

            {/* ช่องหมายเหตุ */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">หมายเหตุ</label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows="3"
                value={assessComment}
                onChange={e => setAssessComment(e.target.value)}
                placeholder="กรอกหมายเหตุเพิ่มเติม (ถ้ามี)"
              />
            </div>

            <div className="flex gap-3">
              <button className="flex-1 bg-gray-600 text-white py-2 rounded-md hover:bg-gray-700" onClick={() => setAssessIndicator(null)}>ยกเลิก</button>
              <button className="flex-1 bg-green-600 text-white py-2 rounded-md hover:bg-green-700" onClick={handleSubmitAssessment}>บันทึก</button>
            </div>
          </div>
        </div>

        {/* แสดงประวัติการประเมิน */}
        {evaluationHistory.length > 0 && (
          <div className="mt-6 bg-white border border-gray-200 rounded-2xl">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h4 className="text-sm font-medium text-gray-900">ประวัติการประเมิน ({evaluationHistory.length} ครั้ง)</h4>
            </div>
            <div className="p-4">
              <div className="space-y-4">
                {evaluationHistory.map((evaluation, index) => (
                  <div key={evaluation.evaluation_id} className="border border-gray-200 rounded-2xl p-4 bg-gray-50">
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-sm font-medium text-gray-900">
                        การประเมินครั้งที่ {evaluationHistory.length - index}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(evaluation.created_at).toLocaleString('th-TH')}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">ค่าเป้าหมาย</label>
                        <div className="text-sm text-gray-900 bg-white px-3 py-2 rounded border">
                          {evaluation.target_value || '-'}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">คะแนน</label>
                        <div className="text-sm text-gray-900 bg-white px-3 py-2 rounded border">
                          {evaluation.score || '-'}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">หมายเหตุ</label>
                        <div className="text-sm text-gray-900 bg-white px-3 py-2 rounded border">
                          {evaluation.comment || '-'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mb-8">
      <div className="mb-4">
        <h3 className="text-lg font-medium text-gray-900">ข้อมูลตัวบ่งชี้ที่กำหนดไว้:</h3>
      </div>

      {showForm && (
        <div className="mb-8">
          <IndicatorForm
            selectedComponent={selectedComponent}
            indicatorSequence={indicatorSequence}
            setIndicatorSequence={setIndicatorSequence}
            indicatorType={indicatorType}
            setIndicatorType={setIndicatorType}
            criteriaType={criteriaType}
            setCriteriaType={setCriteriaType}
            indicatorName={indicatorName}
            setIndicatorName={setIndicatorName}
            dataSource={dataSource}
            setDataSource={setDataSource}
            parentId={parentId}
            setParentId={setParentId}
            indicatorList={indicatorList}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            error={error}
            flash={flash}
            onDismissFlash={() => setFlash({ message: '', type: 'success' })}
            masterIndicators={masterIndicators}
            selectedMasterId={selectedMasterId}
            setSelectedMasterId={setSelectedMasterId}
            programs={programs}
            rounds={rounds}
            allMasterComponents={allMasterComponents}
            onRefreshMaster={fetchMasterIndicators}
          />
        </div>
      )}

      <div className="bg-gray-50 border border-gray-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                  ลำดับ
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                  ตัวบ่งชี้
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                  ชนิดตัวบ่งชี้
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                  ชนิดเกณฑ์มาตรฐาน
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                  จัดการ
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {indicatorList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-gray-500">ไม่มีข้อมูลตัวบ่งชี้</td>
                </tr>
              ) : (
                indicatorList.map((indicator) => {
                  const sequenceLabel = String(indicator.sequence);
                  const isSub = sequenceLabel.includes('.');
                  const level = isSub ? sequenceLabel.split('.').length - 1 : 0;

                  return (
                    <tr key={indicator.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 text-center text-sm font-semibold text-gray-900 border-r border-gray-200">
                        {!isSub ? (
                          <span className="inline-flex items-center justify-center w-8 h-8 bg-red-600 text-white rounded-full text-sm font-bold shadow-sm">
                            {formatSequence(indicator.sequence)}
                          </span>
                        ) : (
                          <span className="text-gray-500 font-medium">
                            {formatSequence(indicator.sequence, true)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900 border-r border-gray-200">
                        <div
                          className={`${!isSub ? 'font-bold text-gray-900' : 'font-medium text-gray-700'} transition-all`}
                          style={{ paddingLeft: `${level * 1.5}rem` }}
                        >
                          {isSub && <span className="text-gray-400 mr-2"></span>}
                          {indicator.indicator_name}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center text-sm text-gray-900 border-r border-gray-200">
                        <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${indicator.indicator_type === 'Quantitative' ? 'bg-indigo-100 text-indigo-800' : 'bg-blue-100 text-blue-800'}`}>
                          {indicator.indicator_type}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center text-sm text-gray-900 border-r border-gray-200">
                        <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${indicator.criteria_type === 'AUN-QA' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                          {indicator.criteria_type}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center gap-1">

                          <button
                            onClick={() => onDeleteClick(indicator.id, selectedComponent.id)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-all duration-200 group"
                            title="ลบตัวบ่งชี้"
                          >
                            <Trash2 className="w-5 h-5 group-hover:scale-110" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
