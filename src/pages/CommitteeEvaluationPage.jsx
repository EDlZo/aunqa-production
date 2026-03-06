import React, { useState, useEffect } from 'react';
import { GraduationCap, ClipboardCheck, Eye, ChevronRight, CheckCircle2, Search, X, ChevronLeft, Target, BookOpen, Clock, FileText, BarChart3, Activity, Star, Save, Link2, ShieldCheck } from 'lucide-react';
import ProgramSelection from '../components/ProgramSelection.jsx';
import { BASE_URL } from '../config/api.js';

// import CommitteeEvaluationModal from '../components/CommitteeEvaluationModal.jsx';

export default function CommitteeEvaluationPage({ currentUser }) {
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [components, setComponents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeYear, setActiveYear] = useState(null);
  const [viewComponent, setViewComponent] = useState(null);
  const [viewIndicators, setViewIndicators] = useState([]);
  const [componentIndicatorsCount, setComponentIndicatorsCount] = useState({}); // componentId -> count of main indicators
  const [evaluatingIndicator, setEvaluatingIndicator] = useState(null);
  const [flash, setFlash] = useState({ message: '', type: 'success' });
  const [rows, setRows] = useState([]); // evaluations_actual
  const [criteriaMap, setCriteriaMap] = useState({}); // indicator_id -> { target_value, score }
  const [committeeMap, setCommitteeMap] = useState({}); // indicator_id -> { committee_score, strengths, improvements }
  const [operationMap, setOperationMap] = useState({}); // indicator_id -> evaluation record
  const [allIndicatorsMap, setAllIndicatorsMap] = useState({}); // componentId -> indicators[]
  // ฟิลด์แก้ไขของหน้าแบบเต็ม (ต้องอยู่นอกการเรนเดอร์แบบมีเงื่อนไข เพื่อไม่ให้ผิดกติกา Hooks)
  const [editorScore, setEditorScore] = useState('');
  const [editorStrengths, setEditorStrengths] = useState('');
  const [editorImprovements, setEditorImprovements] = useState('');

  useEffect(() => {
    // สำหรับหน้าสรุปผลการประเมิน ให้เริ่มต้นใหม่เสมอ
    // ล้างข้อมูลเก่าและไม่โหลดจาก localStorage
    setSelectedProgram(null);
    setViewComponent(null);
    setViewIndicators([]);

    // Fetch active round
    fetch(`${BASE_URL}/api/rounds`)
      .then(res => res.json())
      .then(data => {
        const active = data.find(r => r.is_active);
        if (active) setActiveYear(active.year);
        else if (data.length > 0) setActiveYear(data[0].year);
      })
      .catch(err => console.error('Failed to load rounds', err));
  }, []);

  useEffect(() => {
    if (selectedProgram) {
      fetchAllCommitteeData();
    }
  }, [selectedProgram, activeYear]);


  // ตั้งค่า initial values เมื่อเลือกตัวบ่งชี้เพื่อประเมิน
  useEffect(() => {
    if (!evaluatingIndicator) return;
    const key = String(evaluatingIndicator.id);
    const committee = committeeMap[key] || {};
    setEditorScore(committee.committee_score || '');
    setEditorStrengths(committee.strengths || '');
    setEditorImprovements(committee.improvements || '');
  }, [evaluatingIndicator, committeeMap]);

  const fetchAllCommitteeData = async () => {
    if (!selectedProgram) return;
    setLoading(true);
    try {
      const sessionId = localStorage.getItem('assessment_session_id') || '';
      const major = selectedProgram.majorName || selectedProgram.major_name;
      const params = { session_id: sessionId, major_name: major, filter_approved_only: 'true' };
      if (activeYear) params.year = activeYear;
      const qs = new URLSearchParams(params).toString();

      console.log(`[BULK] Fetching committee data bundle for ${major}`);
      const res = await fetch(`${BASE_URL}/api/bulk/session-summary?${qs}`);

      if (res.ok) {
        const data = await res.json();
        const {
          components = [],
          evaluations = [],
          evaluations_actual = [],
          committee_evaluations = [],
          indicators = []
        } = data;

        setComponents(components);
        setRows(evaluations_actual);

        // Map criteria (indicator_id -> target/score)
        const critMap = {};
        evaluations.forEach(r => {
          critMap[String(r.indicator_id)] = { target_value: r.target_value || '', score: r.score || '' };
        });
        setCriteriaMap(critMap);

        // Map committee evaluations
        const commMap = {};
        committee_evaluations.forEach(r => {
          commMap[String(r.indicator_id)] = {
            committee_score: r.committee_score || '',
            strengths: r.strengths || '',
            improvements: r.improvements || ''
          };
        });
        setCommitteeMap(commMap);

        // Group indicators by component_id (Agnostic mapping)
        const indMap = {};
        indicators.forEach(ind => {
          const cid = String(ind.component_id);
          // Key by whatever is provided (Logical ID or Firestore ID)
          if (!indMap[cid]) indMap[cid] = [];
          if (!indMap[cid].some(existing => existing.id === ind.id)) {
            indMap[cid].push(ind);
          }
        });

        // To be safe, also ensure we map by Firestore ID if indicators use logical ID
        components.forEach(comp => {
          const firestoreId = String(comp.id);
          const logicalId = String(comp.component_id);
          if (!indMap[firestoreId] && indMap[logicalId]) indMap[firestoreId] = indMap[logicalId];
          else if (!indMap[logicalId] && indMap[firestoreId]) indMap[logicalId] = indMap[firestoreId];
        });
        setAllIndicatorsMap(indMap);

        // Map for evaluations_actual (latest record wins)
        const opMap = {};
        evaluations_actual.forEach(r => { opMap[String(r.indicator_id)] = r; });
        setOperationMap(opMap);

        // Count main indicators per component (ID-agnostic)
        const countMap = {};
        components.forEach(comp => {
          const mainCount = indicators.filter(ind => {
            const indCid = String(ind?.component_id);
            const matches = (indCid === String(comp.id) || indCid === String(comp.component_id));
            return matches && !String(ind?.sequence ?? '').includes('.');
          }).length;
          countMap[comp.id] = mainCount;
        });
        setComponentIndicatorsCount(countMap);
      } else {
        console.warn('API response not OK:', res.status, res.statusText);
        // ใช้ข้อมูลเริ่มต้นเมื่อ API ไม่พร้อมใช้งาน
        setComponents([]);
        setRows([]);
        setCriteriaMap({});
        setCommitteeMap({});
        setAllIndicatorsMap({});
        setComponentIndicatorsCount({});
      }
    } catch (error) {
      console.error('Error fetching committee data bundle:', error);
      // ใช้ข้อมูลเริ่มต้นเมื่อเกิดข้อผิดพลาด
      setComponents([]);
      setRows([]);
      setCriteriaMap({});
      setCommitteeMap({});
      setAllIndicatorsMap({});
      setComponentIndicatorsCount({});
    } finally {
      setLoading(false);
    }
  };

  // Helper for ID-agnostic lookup
  const getIndicatorData = (indicator, dataMap) => {
    if (!indicator) return {};
    return (
      dataMap[String(indicator.id)] ||
      dataMap[String(indicator.indicator_id)] ||
      dataMap[String(indicator.sequence)] ||
      {}
    );
  };

  const handleViewIndicators = async (component) => {
    setViewComponent(component);
    const compId = String(component.id);

    // Use pre-fetched indicators if available for instant load
    if (allIndicatorsMap[compId]) {
      setViewIndicators(allIndicatorsMap[compId]);
      return;
    }

    setLoading(true);
    try {
      const sessionId = localStorage.getItem('assessment_session_id') || '';
      const major = selectedProgram.majorName || selectedProgram.major_name;
      const params = { session_id: sessionId, major_name: major };
      if (activeYear) params.year = activeYear;
      const qs = new URLSearchParams(params).toString();

      const response = await fetch(
        `${BASE_URL}/api/indicators-by-component/${encodeURIComponent(component.id)}?${qs}`
      );
      if (response.ok) {
        const data = await response.json();
        setViewIndicators(data);
        // Update map for next time
        setAllIndicatorsMap(prev => ({ ...prev, [compId]: data }));
      }
    } catch (error) {
      console.error('Error fetching indicators:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEvaluationComplete = () => {
    setEvaluatingIndicator(null);
    setFlash({ message: 'บันทึกการประเมินเรียบร้อย', type: 'success' });
    // รีเฟรชข้อมูล
    fetchAllCommitteeData();
  };

  const handleEvaluationCancel = () => {
    setEvaluatingIndicator(null);
  };

  const handleEvaluationSaved = () => {
    // รีเฟรชข้อมูลหลังจากบันทึกการประเมิน
    fetchAllCommitteeData();
    setFlash({ message: 'บันทึกการประเมินเรียบร้อยแล้ว', type: 'success' });
    setTimeout(() => setFlash({ message: '', type: 'success' }), 3000);
  };

  const handleSaveCommittee = async () => {
    if (!evaluatingIndicator) return;
    try {
      const sessionId = localStorage.getItem('assessment_session_id') || '';
      const major = selectedProgram.majorName || selectedProgram.major_name;
      const body = {
        session_id: sessionId,
        major_name: major,
        year: activeYear, // Add year to committee evaluation
        indicator_id: evaluatingIndicator.id,
        committee_score: editorScore,
        strengths: editorStrengths,
        improvements: editorImprovements,
      };
      const res = await fetch(`${BASE_URL}/api/committee-evaluations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setCommitteeMap(prev => ({
          ...prev,
          [String(evaluatingIndicator.id)]: { committee_score: editorScore, strengths: editorStrengths, improvements: editorImprovements },
        }));
        handleEvaluationSaved();
        setEvaluatingIndicator(null);
      } else {
        setFlash({ message: 'บันทึกไม่สำเร็จ', type: 'error' });
      }
    } catch (e) {
      setFlash({ message: 'เกิดข้อผิดพลาดในการบันทึก', type: 'error' });
    }
  };

  // หากกำลังประเมิน ให้แสดงหน้าเต็มเหมือน Summary + ช่องกรอกคะแนนกรรมการ
  if (evaluatingIndicator) {
    const ind = evaluatingIndicator;
    const latest = rows
      .filter(r => String(r.indicator_id) === String(ind.id))
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
      })[0] || null;
    const crit = criteriaMap[String(ind.id)] || {};
    const committee = committeeMap[String(ind.id)] || {};

    // สร้างส่วนแสดงหลักฐานอ้างอิงเหมือน SummaryPage
    const renderEvidence = () => {
      const evidenceFiles = [];
      let evidenceMeta = {};

      // 1. ดึงจากไฟล์เดียวแบบเดิม (legacy)
      if (latest?.evidence_file) {
        evidenceFiles.push(latest.evidence_file);
      }

      // 2. ดึงจาก JSON (ระบบใหม่ รองรับหลายไฟล์)
      if (latest?.evidence_files_json) {
        try {
          const files = typeof latest.evidence_files_json === 'string'
            ? JSON.parse(latest.evidence_files_json)
            : latest.evidence_files_json;
          if (Array.isArray(files)) {
            files.forEach(f => {
              if (!evidenceFiles.includes(f)) evidenceFiles.push(f);
            });
          }
        } catch (e) { console.error('Error parsing evidence_files_json:', e); }
      }

      // 3. ดึง Metadata
      if (latest?.evidence_meta_json) {
        try {
          evidenceMeta = typeof latest.evidence_meta_json === 'string'
            ? JSON.parse(latest.evidence_meta_json)
            : latest.evidence_meta_json;
        } catch (e) { console.error('Error parsing evidence_meta_json:', e); }
      }

      if (evidenceFiles.length === 0) {
        return (
          <div className="text-center py-4 text-gray-500">
            <div className="text-sm">ไม่มีหลักฐานอ้างอิง</div>
          </div>
        );
      }
      return (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">หมายเลข</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ชื่อหลักฐานอ้างอิง</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">เอกสารหลักฐาน</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {evidenceFiles.map((filename, index) => {
                const fileMeta = evidenceMeta[filename] || {};
                const evidenceNumber = fileMeta.number || (index + 1).toString();
                const evidenceName = fileMeta.name || latest?.evidence_name || filename;
                return (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium text-center bg-gray-50 w-20">{evidenceNumber}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{evidenceName}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">
                      {(fileMeta.url || (filename.startsWith('url_') && latest?.evidence_url)) ? (
                        <a
                          href={fileMeta.url || latest?.evidence_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center px-3 py-1.5 bg-green-100 text-green-700 rounded-2xl hover:bg-green-200 transition-colors text-xs font-medium"
                        >
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          เปิด
                        </a>
                      ) : (
                        <a
                          href={`${BASE_URL}/api/view/${encodeURIComponent(filename)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center px-3 py-1.5 bg-blue-100 text-blue-700 rounded-2xl hover:bg-blue-200 transition-colors text-xs font-medium"
                        >
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          เปิด
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    };

    return (
      <div className="max-w-6xl mx-auto py-8 px-4">
        {/* Breadcrumb/Navigation */}
        <div className="flex items-center gap-2 mb-6 text-sm">
          <button
            onClick={() => setEvaluatingIndicator(null)}
            className="text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            กลับไปที่รายการตัวบ่งชี้
          </button>
          <span className="text-gray-400">/</span>
          <span className="text-gray-500 font-medium">รายละเอียดการประเมิน</span>
        </div>

        <div className="bg-white rounded-2xl shadow-xl shadow-blue-900/5 border border-gray-100 overflow-hidden">
          {/* Header Card */}
          <div className="bg-gradient-to-r from-blue-50 to-blue-60 px-8 py-10 text-gray-800 relative overflow-hidden">
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/60 backdrop-blur-md rounded-full text-blue-700 text-xs font-semibold uppercase tracking-wider mb-4 border border-blue-200">
                <Target className="w-3.5 h-3.5" />
                ตัวบ่งชี้ {ind.sequence}
              </div>
              <h2 className="text-3xl font-bold leading-tight">{ind.indicator_name}</h2>
              <div className="mt-6 flex flex-wrap gap-4">
                <div className="flex items-center gap-2 text-blue-600 text-sm">
                  <BookOpen className="w-4 h-4" />
                  <span>{viewComponent?.quality_name}</span>
                </div>
                <div className="flex items-center gap-2 text-blue-600 text-sm">
                  <Clock className="w-4 h-4" />
                  <span>บันทึกล่าสุด: {latest ? new Date(latest.created_at).toLocaleDateString('th-TH', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) : 'ยังไม่มีข้อมูล'}</span>
                </div>
              </div>
            </div>
            {/* Decorative background element */}
            <div className="absolute top-0 right-0 -transtion-y-1/2 translate-x-1/4 w-96 h-96 bg-blue-300/20 rounded-full blur-3xl" />
          </div>

          <div className="p-8 space-y-10">
            {/* Section: Result Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              <div className="lg:col-span-8 space-y-6">
                <div className="flex items-center gap-2 text-gray-900 font-bold text-lg border-b border-gray-100 pb-3">
                  <FileText className="w-5 h-5 text-blue-600" />
                  ผลการดำเนินงาน
                </div>
                <div
                  className="prose max-w-none text-gray-700 bg-gray-50/50 rounded-xl p-6 border border-gray-100 shadow-inner leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: latest?.operation_result || '<div class="text-gray-400 italic">ไม่มีข้อมูลการดำเนินงาน</div>' }}
                />
              </div>

              <div className="lg:col-span-4 space-y-6">
                <div className="flex items-center gap-2 text-gray-900 font-bold text-lg border-b border-gray-100 pb-3">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                  ผลลัพธ์เชิงตัวเลข
                </div>

                <div className="space-y-4">
                  <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">เป้าหมาย</span>
                      <Target className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-gray-900">{crit.score || '-'}</span>
                      <span className="text-sm text-gray-500">(เป้าหมาย: {crit.target_value || '-'})</span>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">ผลลัพธ์จริง</span>
                      <Activity className="w-4 h-4 text-green-400" />
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-green-600">{latest?.operation_score ?? '-'}</span>
                    </div>
                  </div>

                  <div className={`rounded-xl border p-5 shadow-sm ${latest?.goal_achievement === 'บรรลุ'
                    ? 'bg-green-50 border-green-100'
                    : latest?.goal_achievement === 'ไม่บรรลุ'
                      ? 'bg-red-50 border-red-100'
                      : 'bg-yellow-50 border-yellow-100'
                    }`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-semibold uppercase tracking-wider ${latest?.goal_achievement === 'บรรลุ' ? 'text-green-600' : 'text-gray-500'
                        }`}>การบรรลุเป้าหมาย</span>
                      {latest?.goal_achievement === 'บรรลุ' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                    </div>
                    <div className={`text-xl font-bold ${latest?.goal_achievement === 'บรรลุ' ? 'text-green-700' : 'text-gray-800'
                      }`}>
                      {latest?.goal_achievement || 'รอยืนยัน'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section: Committee Review */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-gray-900 font-bold text-lg border-b border-gray-100 pb-3">
                <ClipboardCheck className="w-5 h-5 text-indigo-600" />
                การประเมินโดยคณะกรรมการ
              </div>

              {['system_admin', 'external_evaluator'].includes(currentUser?.role) ? (
                <div className="bg-indigo-50/30 rounded-2xl p-8 border border-indigo-100 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
                    <div className="md:col-span-1">
                      <label className="block text-sm font-bold text-gray-700 mb-2">คะแนนประเมิน</label>
                      <div className="relative">
                        <Star className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-yellow-500" />
                        <input
                          type="number"
                          step="0.1"
                          max="5"
                          min="0"
                          value={editorScore}
                          onChange={e => setEditorScore(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-bold text-lg shadow-sm"
                          placeholder="0.0"
                        />
                      </div>
                    </div>
                    <div className="md:col-span-3 space-y-6">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Strengths (จุดแข็ง)</label>
                        <textarea
                          value={editorStrengths}
                          onChange={e => setEditorStrengths(e.target.value)}
                          className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm"
                          rows={3}
                          placeholder="ระบุจุดแข็งที่พบจากการพิจารณาหลักฐาน..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Areas for Improvement (ข้อควรพัฒนา)</label>
                        <textarea
                          value={editorImprovements}
                          onChange={e => setEditorImprovements(e.target.value)}
                          className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm"
                          rows={3}
                          placeholder="ระบุแนวทางที่ควรปรับปรุงเพื่อผลลัพธ์ที่ดีขึ้น..."
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      className="px-6 py-2.5 text-sm font-semibold bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 rounded-xl transition-all shadow-sm"
                      onClick={() => setEvaluatingIndicator(null)}
                    >
                      ยกเลิก
                    </button>
                    <button
                      className="px-8 py-2.5 text-sm font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700 hover:shadow-lg hover:shadow-indigo-900/20 transition-all flex items-center gap-2"
                      onClick={handleSaveCommittee}
                    >

                      บันทึกผลการประเมิน
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">คะแนนประเมิน</div>
                    <div className="text-3xl font-black text-gray-800">{committee.committee_score || '-'}</div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">จุดแข็ง</div>
                    <div className="text-gray-700 text-sm italic">{committee.strengths || 'ยังไม่มีข้อมูล'}</div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">ข้อควรพัฒนา</div>
                    <div className="text-gray-700 text-sm italic">{committee.improvements || 'ยังไม่มีข้อมูล'}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Section: Evidence */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-gray-900 font-bold text-lg border-b border-gray-100 pb-3">
                <Link2 className="w-5 h-5 text-purple-600" />
                รายการหลักฐานอ้างอิง
              </div>

              <div className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                {renderEvidence()}
              </div>
            </div>
          </div>

          {/* Footer Card */}
          <div className="bg-gray-50 border-t border-gray-100 px-8 py-6 flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-400 text-xs font-medium italic">

            </div>
            <button
              className="px-6 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors"
              onClick={() => setEvaluatingIndicator(null)}
            >
            </button>
          </div>
        </div>
      </div>
    );
  }

  // หากยังไม่ได้เลือกสาขา ให้แสดงหน้าเลือกสาขา
  if (!selectedProgram) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <div className="text-center mb-8">
          <ClipboardCheck className="w-16 h-16 text-blue-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900">ผลการประเมิน</h1>
          <p className="text-gray-600 mt-2">กรุณาเลือกสาขาที่ต้องการประเมิน</p>
        </div>
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          <ProgramSelection
            onComplete={(s) => {
              setSelectedProgram(s);
              try { localStorage.setItem('selectedProgramContext', JSON.stringify(s)); } catch { }
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {flash.message && (
        <div className={`mb-4 rounded-md px-4 py-2 border transition-all ${flash.type === 'success'
          ? 'bg-green-50 border-green-200 text-green-800'
          : 'bg-red-50 border-red-200 text-red-800'
          }`}>
          {flash.message}
          <button
            className={`${flash.type === 'success' ? 'text-green-700' : 'text-red-700'} float-right font-bold`}
            onClick={() => setFlash({ message: '', type: 'success' })}
          >
            ×
          </button>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold">ผลการประเมิน</h1>
        <p className="text-gray-600 mt-1">ประเมินผลการดำเนินงานและให้คะแนนสำหรับแต่ละตัวบ่งชี้</p>
      </div>

      {/* Program info and change button */}
      <div className="mb-6 flex items-center justify-between">
        <div className="text-sm text-gray-700">
          <span className="text-gray-500">กำลังประเมินของ:</span>{' '}
          <span className="font-medium">{selectedProgram?.majorName || selectedProgram?.major_name || '-'}</span>
          {selectedProgram?.facultyName ? <span className="ml-1 text-gray-500">({selectedProgram.facultyName})</span> : null}
        </div>
        <div className="flex gap-2">
          {viewComponent && (
            <button
              onClick={() => { setViewComponent(null); setViewIndicators([]); }}
              className="px-4 py-2 text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl transition-colors border border-gray-200"
            >
              กลับหน้าหลัก
            </button>
          )}
          <button
            onClick={() => setSelectedProgram(null)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            เปลี่ยนสาขา
          </button>
        </div>
      </div>

      {/* Steps section */}
      <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-2xl p-8 mb-8 border border-blue-200">
        <div className="flex items-center gap-3 mb-6">
          <ClipboardCheck className="w-8 h-8 text-blue-600" />
          <div>
            <h2 className="text-xl font-bold text-gray-900">ขั้นตอนการประเมินผลการดำเนินงาน</h2>
            <p className="text-gray-600 text-sm">ทำตามขั้นตอนเพื่อประเมินผลการดำเนินงานให้ครบทุกตัวบ่งชี้</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">เลือกองค์ประกอบ</h3>
              <p className="text-sm text-gray-600">เลือกองค์ประกอบคุณภาพที่ต้องการประเมิน</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">ประเมินตัวบ่งชี้</h3>
              <p className="text-sm text-gray-600">ให้คะแนนและข้อเสนอแนะสำหรับแต่ละตัวบ่งชี้</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">ตรวจสอบและบันทึก</h3>
              <p className="text-sm text-gray-600">ตรวจสอบความถูกต้องและบันทึกผลการประเมิน</p>
            </div>
          </div>
        </div>
      </div>

      {!viewComponent ? (
        <>
          {/* ตารางองค์ประกอบหลัก */}
          <div className="bg-white shadow-md border border-gray-200 rounded-xl overflow-hidden mb-8">
            <div className="px-6 py-4 border-b border-gray-200 bg-white">
              <h3 className="text-lg font-bold text-gray-900">เลือกองค์ประกอบคุณภาพเพื่อประเมิน</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                      องค์ประกอบที่
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                      ชื่อองค์ประกอบ
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                      จำนวน
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ตัวบ่งชี้
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                        <div className="inline-flex items-center text-sm">
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          กำลังโหลด...
                        </div>
                      </td>
                    </tr>
                  ) : components.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-16 text-center text-gray-400">
                        <div className="bg-gray-50/50 p-8 flex flex-col items-center">
                          <Search className="h-14 w-14 text-gray-200 mb-4" />
                          <p className="text-gray-500 font-medium text-lg">ไม่พบข้อมูลองค์ประกอบคุณภาพ</p>
                          <p className="text-gray-400 text-sm mt-1">กรุณากำหนดเกณฑ์และเพิ่มองค์ประกอบคุณภาพในปีกิจกรรมที่เลือก</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    [...components].sort((a, b) => {
                      const idA = parseInt(a.component_id || a.id || 0);
                      const idB = parseInt(b.component_id || b.id || 0);
                      return idA - idB;
                    }).map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-4 text-center border-r border-gray-200">
                          <span className="inline-flex items-center justify-center w-8 h-8 bg-red-500 text-white rounded-full text-sm font-bold shadow-sm">
                            {c.component_id || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-900 border-r border-gray-200">
                          <div
                            className="font-medium cursor-pointer hover:text-blue-600 transition-colors"
                            onClick={() => handleViewIndicators(c)}
                          >
                            {c.quality_name}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center border-r border-gray-200">
                          <span className="inline-flex items-center justify-center w-8 h-8 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                            {componentIndicatorsCount[c.id] ?? '-'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <button
                            onClick={() => handleViewIndicators(c)}
                            className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all shadow-sm"
                          >
                            <svg className="w-3.5 h-3.5 mr-1.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            ตัวบ่งชี้
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* รายการตัวบ่งชี้ขององค์ประกอบที่เลือก */
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between border-none">
            <div>
              <div className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">ตัวบ่งชี้ขององค์ประกอบ</div>
              <div className="font-bold text-lg text-gray-900">{viewComponent.quality_name}</div>
            </div>
            <button
              className="p-2 hover:bg-gray-200 rounded-full transition-colors"
              onClick={() => { setViewComponent(null); setViewIndicators([]); }}
              title="ปิด"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          <div className="bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 whitespace-nowrap">ลำดับ</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">ชื่อตัวบ่งชี้</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 whitespace-nowrap">เป้าหมาย</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 whitespace-nowrap">ประเมินตน</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 whitespace-nowrap">บรรลุ</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr><td colSpan={7} className="text-center py-6">กำลังโหลด...</td></tr>
                  ) : viewIndicators.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-6 text-gray-400">ยังไม่มีตัวบ่งชี้</td></tr>
                  ) : (
                    viewIndicators
                      .filter((ind) => {
                        // แสดงเฉพาะตัวบ่งชี้ที่มีผลดำเนินการที่ approved แล้ว
                        const hasApprovedResult = rows.some(r =>
                          String(r.indicator_id) === String(ind.id) ||
                          String(r.indicator_id) === String(ind.indicator_id) ||
                          String(r.indicator_id) === String(ind.sequence)
                        );
                        return hasApprovedResult;
                      })
                      .map((ind) => {
                        const actual = rows.find(r =>
                          String(r.indicator_id) === String(ind.id) ||
                          String(r.indicator_id) === String(ind.indicator_id) ||
                          String(r.indicator_id) === String(ind.sequence)
                        );
                        const crit = getIndicatorData(ind, criteriaMap);
                        const comm = getIndicatorData(ind, committeeMap);
                        const hasCommitteeScore = !!comm?.committee_score;

                        return (
                          <tr key={ind.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-4 text-center border-r border-gray-200">
                              {String(ind.sequence).includes('.') ? (
                                <span className="text-sm font-medium text-gray-600">{ind.sequence}</span>
                              ) : (
                                <span className="inline-flex items-center justify-center w-8 h-8 bg-red-500 text-white rounded-full text-xs font-bold shadow-sm">
                                  {ind.sequence}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-4 text-sm text-left border-r border-gray-200">
                              <div className={(String(ind.sequence).includes('.') ? 'font-normal' : 'font-bold') + ' text-gray-900'}>
                                {ind.indicator_name}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center text-sm border-r border-gray-200">
                              {crit?.score || '-'}
                            </td>
                            <td className="px-4 py-4 text-center text-sm border-r border-gray-200">
                              {actual ? `${actual.operation_score ?? '-'}` : '-'}
                            </td>
                            <td className="px-4 py-4 text-center text-sm border-r border-gray-200">
                              {actual && actual.goal_achievement ? (
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${actual.goal_achievement === 'บรรลุ' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                  }`}>
                                  {actual.goal_achievement}
                                </span>
                              ) : '-'}
                            </td>
                            <td className="px-4 py-4 text-center">
                              {['system_admin', 'external_evaluator'].includes(currentUser?.role) ? (
                                <button
                                  onClick={() => setEvaluatingIndicator(ind)}
                                  className={`inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg shadow-sm transition-all whitespace-nowrap ${hasCommitteeScore
                                    ? 'bg-green-600 text-white hover:bg-green-700'
                                    : 'bg-blue-600 text-white hover:bg-blue-700'
                                    }`}
                                >
                                  {hasCommitteeScore ? <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> : <ClipboardCheck className="w-3.5 h-3.5 mr-1" />}
                                  ประเมินผล
                                </button>
                              ) : (
                                <button
                                  onClick={() => setEvaluatingIndicator(ind)}
                                  className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 shadow-sm transition-all whitespace-nowrap"
                                >
                                  <Search className="w-3.5 h-3.5 mr-1" />
                                  รายละเอียด
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
                {viewIndicators.length > 0 && (
                  <tfoot className="bg-gray-100 font-bold">
                    <tr>
                      <td className="px-4 py-4 border-r border-gray-200"></td>
                      <td className="px-4 py-4 text-right text-sm text-gray-900 border-r border-gray-200">
                        รวม {viewIndicators.filter(ind => !String(ind.sequence).includes('.') && rows.some(r =>
                          String(r.indicator_id) === String(ind.id) ||
                          String(r.indicator_id) === String(ind.indicator_id) ||
                          String(r.indicator_id) === String(ind.sequence)
                        )).length} ตัวบ่งชี้
                      </td>
                      <td className="px-4 py-4 text-center text-sm text-gray-900 border-r border-gray-200">
                        {(() => {
                          const validScores = viewIndicators.map(ind => {
                            const crit = getIndicatorData(ind, criteriaMap);
                            const val = parseFloat(crit.score || 0);
                            return val > 0 ? val : NaN;
                          }).filter(s => !isNaN(s));
                          if (validScores.length === 0) return '-';
                          const avg = validScores.reduce((a, b) => a + b, 0) / validScores.length;
                          return Number.isInteger(avg) ? avg : avg.toFixed(2);
                        })()}
                      </td>
                      <td className="px-4 py-4 text-center text-sm text-gray-900 border-r border-gray-200">
                        {(() => {
                          const validScores = viewIndicators.map(ind => {
                            const actual = getIndicatorData(ind, operationMap);
                            const val = parseFloat(actual?.operation_score || 0);
                            return val > 0 ? val : NaN;
                          }).filter(s => !isNaN(s));
                          if (validScores.length === 0) return '-';
                          const avg = validScores.reduce((a, b) => a + b, 0) / validScores.length;
                          return Number.isInteger(avg) ? avg : avg.toFixed(2);
                        })()}
                      </td>
                      <td className="px-4 py-4 border-r border-gray-200"></td>
                      <td className="px-4 py-4 text-center text-sm text-gray-900 border-r border-gray-200">
                        {(() => {
                          const validScores = viewIndicators.map(ind => {
                            const comm = getIndicatorData(ind, committeeMap);
                            const val = parseFloat(comm?.committee_score || 0);
                            return val > 0 ? val : NaN;
                          }).filter(s => !isNaN(s));
                          if (validScores.length === 0) return '-';
                          const avg = validScores.reduce((a, b) => a + b, 0) / validScores.length;
                          return Number.isInteger(avg) ? avg : avg.toFixed(2);
                        })()}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
          <div className="px-6 py-4 bg-gray-50 border-t flex items-center text-xs text-gray-500 border-none">
            <div className="flex items-center mr-4">
              <div className="w-2 h-2 bg-blue-600 rounded-full mr-1.5"></div>
              <span>รอการประเมิน</span>
            </div>
            <div className="flex items-center">
              <div className="w-2 h-2 bg-green-600 rounded-full mr-1.5"></div>
              <span>ประเมินแล้ว</span>
            </div>
            <div className="ml-auto italic">หน้าสำหรับกรรมการประเมิน</div>
          </div>
        </div>
      )}
    </div>
  );
}