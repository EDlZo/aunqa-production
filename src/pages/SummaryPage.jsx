import React, { useEffect, useState } from 'react';
import { FileText, GraduationCap, BarChart3 } from 'lucide-react';
import ProgramSelection from '../components/ProgramSelection';
import { BASE_URL } from '../config/api.js';


export default function SummaryPage({ currentUser }) {
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [rows, setRows] = useState([]); // evaluations_actual
  const [loading, setLoading] = useState(false); // General loading
  const [loadingRounds, setLoadingRounds] = useState(true);
  const [indicatorMap, setIndicatorMap] = useState({}); // id -> detail
  const [components, setComponents] = useState([]);
  const [componentIndicatorsCount, setComponentIndicatorsCount] = useState({}); // componentId -> count
  const [viewComponent, setViewComponent] = useState(null);
  const [viewIndicators, setViewIndicators] = useState([]);
  const [detailIndicator, setDetailIndicator] = useState(null);
  const [detailEvaluation, setDetailEvaluation] = useState(null);
  const [criteriaMap, setCriteriaMap] = useState({}); // indicator_id -> { target_value, score }
  const [committeeMap, setCommitteeMap] = useState({}); // indicator_id -> { committee_score, strengths, improvements }
  const [operationMap, setOperationMap] = useState({}); // indicator_id -> evaluation record
  const [allIndicatorsMap, setAllIndicatorsMap] = useState({}); // componentId -> indicators[]

  useEffect(() => {
    // 1. Fetch Rounds
    const fetchRounds = async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/rounds`);
        if (res.ok) {
          const data = await res.json();
          setRounds(data);
          const active = data.find(r => r.is_active);
          // Default to active year if available, otherwise first
          if (active) setSelectedYear(active.year);
          else if (data.length > 0) setSelectedYear(data[0].year);
        }
      } catch (err) {
        console.error('Error fetching rounds:', err);
      } finally {
        setLoadingRounds(false);
      }
    };
    fetchRounds();

    // 2. Reset other states
    setSelectedProgram(null);
    setViewComponent(null);
    setViewIndicators([]);
  }, []);

  useEffect(() => {
    const fetchAllSummaryData = async () => {
      const major = selectedProgram?.majorName || selectedProgram?.major_name || '';
      if (!major) return;

      if (!loadingRounds && !selectedYear) return;

      // Note: We now prioritized YEAR selection. 
      // So we don't necessarily need session_id if endpoints support year.
      // But for compatibility, let's try to resolve session if we can, or rely on bulk endpoint's year support.

      setLoading(true);
      setComponents([]);
      setRows([]);
      setIndicatorMap({});
      setCriteriaMap({});
      setCommitteeMap({});
      setComponentIndicatorsCount({});
      setAllIndicatorsMap({});

      try {
        // Use year if available to fetch data directly
        const qsObj = { major_name: major };
        if (selectedYear) qsObj.year = selectedYear;
        // If we had a session_id logic before, we can keep it as fallback or override? 
        // Actually, user wants "Year" view. So session_id from localStorage might be stale/wrong year.
        // We should IGNORE localStorage session_id here and trust Year + Major.

        const qs = new URLSearchParams({
          ...qsObj,
          filter_approved_only: 'true'  // กรองเฉพาะผลดำเนินงานที่อนุมัติแล้ว
        }).toString();
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

          // Map indicators (id -> detail)
          const indMap = {};
          indicators.forEach(ind => { indMap[ind.id] = ind; });
          setIndicatorMap(indMap);

          // Map criteria (indicator_id -> target/score)
          const critMap = {};
          evaluations.forEach(r => {
            critMap[String(r.indicator_id)] = { target_value: r.target_value || '', score: r.score || '' };
          });
          setCriteriaMap(critMap);

          // Map committee (indicator_id -> results)
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
          const allIndsMap = {};
          indicators.forEach(ind => {
            const cid = String(ind.component_id);
            if (!allIndsMap[cid]) allIndsMap[cid] = [];
            if (!allIndsMap[cid].some(existing => existing.id === ind.id)) {
              allIndsMap[cid].push(ind);
            }
          });

          // Mix mapping so either Firestore ID or Logical ID works
          components.forEach(comp => {
            const fireId = String(comp.id);
            const logId = String(comp.component_id);
            if (!allIndsMap[fireId] && allIndsMap[logId]) allIndsMap[fireId] = allIndsMap[logId];
            else if (!allIndsMap[logId] && allIndsMap[fireId]) allIndsMap[logId] = allIndsMap[fireId];
          });
          setAllIndicatorsMap(allIndsMap);

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
          setIndicatorMap({});
          setCriteriaMap({});
          setCommitteeMap({});
          setComponentIndicatorsCount({});
        }
      } catch (err) {
        console.error('Error fetching comprehensive summary:', err);
        // ใช้ข้อมูลเริ่มต้นเมื่อเกิดข้อผิดพลาด
        setComponents([]);
        setRows([]);
        setIndicatorMap({});
        setCriteriaMap({});
        setCommitteeMap({});
        setComponentIndicatorsCount({});
      } finally {
        setLoading(false);
      }
    };

    fetchAllSummaryData();
  }, [selectedProgram, selectedYear, loadingRounds]);

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
    const logicalId = String(component.component_id);

    // Use pre-fetched indicators if available
    if (allIndicatorsMap[compId] || allIndicatorsMap[logicalId]) {
      setViewIndicators(allIndicatorsMap[compId] || allIndicatorsMap[logicalId]);
      return;
    }

    setViewIndicators([]);
    const sessionId = localStorage.getItem('assessment_session_id') || '';
    const major = selectedProgram?.majorName || selectedProgram?.major_name || '';
    try {
      const res = await fetch(`${BASE_URL}/api/indicators-by-component/${encodeURIComponent(component.id)}?${new URLSearchParams({ session_id: sessionId, major_name: major }).toString()}`);
      const inds = res.ok ? await res.json() : [];
      setViewIndicators(Array.isArray(inds) ? inds : []);
    } catch { setViewIndicators([]); }
  };

  const openIndicatorDetail = (indicator) => {
    setDetailIndicator(indicator);
    // หา evaluation ล่าสุดของตัวบ่งชี้นี้จาก rows
    const list = rows.filter(r =>
      String(r.indicator_id) === String(indicator.id) ||
      String(r.indicator_id) === String(indicator.indicator_id) ||
      String(r.indicator_id) === String(indicator.sequence)
    )
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
    setDetailEvaluation(list[0] || null);
  };

  // หน้ารายละเอียด (แบบหน้าใหม่ ไม่ใช้ป๊อปอัป)
  if (detailIndicator) {
    const crit = getIndicatorData(detailIndicator, criteriaMap);
    const committee = getIndicatorData(detailIndicator, committeeMap);

    return (
      <div className="container mx-auto px-4">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <button
            onClick={() => { setDetailIndicator(null); setDetailEvaluation(null); }}
            className="hover:text-gray-700 transition-colors"
          >
            สรุปผล
          </button>
          <span className="text-gray-400">/</span>
          <span className="text-gray-500 font-medium">รายละเอียดการประเมิน</span>
        </div>

        <div className="bg-white rounded-2xl shadow-xl shadow-blue-900/5 border border-gray-100 overflow-hidden">
          {/* Header Card */}
          <div className="bg-gradient-to-r from-blue-50 to-blue-60 px-8 py-10 text-gray-800 relative overflow-hidden">
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/60 backdrop-blur-md rounded-full text-blue-700 text-xs font-semibold uppercase tracking-wider mb-4 border border-blue-200">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                ตัวบ่งชี้ {detailIndicator.sequence}
              </div>
              <h2 className="text-3xl font-bold leading-tight">{detailIndicator.indicator_name}</h2>
              <div className="mt-6 flex flex-wrap gap-4">
                <div className="flex items-center gap-2 text-blue-600 text-sm">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <span>{viewComponent?.quality_name}</span>
                </div>
                <div className="flex items-center gap-2 text-blue-600 text-sm">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>บันทึกล่าสุด: {(() => {
                    // หาข้อมูลล่าสุดจาก rows เหมือนหน้าผลการประเมิน
                    const latestRecord = rows
                      .filter(r => String(r.indicator_id) === String(detailIndicator.id))
                      .sort((a, b) => {
                        const getTime = (val) => {
                          if (!val) return 0;
                          if (val instanceof Date) return val.getTime();
                          if (typeof val === 'string') return new Date(val).getTime();
                          if (val._seconds) return val._seconds * 1000;
                          return 0;
                        };
                        return getTime(b.created_at) - getTime(a.created_at);
                      })[0];

                    if (!latestRecord || !latestRecord.created_at) {
                      return 'ยังไม่มีข้อมูล';
                    }

                    try {
                      const date = new Date(latestRecord.created_at);
                      if (isNaN(date.getTime())) {
                        return 'ยังไม่มีข้อมูล';
                      }
                      return date.toLocaleDateString('th-TH', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      });
                    } catch (error) {
                      return 'ยังไม่มีข้อมูล';
                    }
                  })()}</span>
                </div>
              </div>
            </div>
            {/* Decorative background element */}
            <div className="absolute top-0 right-0 -transtion-y-1/2 translate-x-1/4 w-96 h-96 bg-blue-300/20 rounded-full blur-3xl" />
          </div>

          <div className="p-8 space-y-10">
            {/* Section: ผลการดำเนินงาน (เนื้อหาข้อความ) */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 bg-gray-50 rounded-t-2xl">
                <div className="w-8 h-8 bg-blue-100 rounded-2xl flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900">ผลการดำเนินงาน</h3>
              </div>
              <div className="p-6">
                <div className="prose max-w-none text-gray-700">
                  {detailEvaluation?.operation_result ? (
                    <div dangerouslySetInnerHTML={{ __html: detailEvaluation.operation_result }} />
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="font-medium">ยังไม่มีข้อมูลผลการดำเนินงาน</p>
                      <p className="text-sm text-gray-400 mt-1">ยังไม่มีการบันทึกรายละเอียดผลการดำเนินงาน</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Section: Result Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* ผลการดำเนินงาน Card */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-100 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-green-900">ผลการดำเนินงาน</h3>
                </div>

                <div className="space-y-4">
                  <div className="bg-white/60 rounded-xl p-4 border border-green-200/50">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-green-600 font-medium">ค่าเป้าหมาย</div>
                        <div className="text-green-900 font-bold text-lg">{crit.target_value || '-'}</div>
                      </div>
                      <div>
                        <div className="text-green-600 font-medium">คะแนนเป้าหมาย</div>
                        <div className="text-green-900 font-bold text-lg">{crit.score || '-'}</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/60 rounded-xl p-4 border border-green-200/50">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-green-600 font-medium">ผลการดำเนินงาน</div>
                        <div className="text-green-900 font-bold text-lg">{detailEvaluation?.operation_score ?? '-'}</div>
                      </div>
                      <div>
                        <div className="text-green-600 font-medium">การบรรลุเป้าหมาย</div>
                        <div className="text-green-900 font-bold text-lg">{detailEvaluation?.goal_achievement ?? '-'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* คะแนนประเมิน Card */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-blue-900">คะแนนประเมิน</h3>
                </div>

                <div className="space-y-4">
                  <div className="bg-white/60 rounded-xl p-4 border border-blue-200/50">
                    <div className="text-blue-600 font-medium text-sm mb-2">คะแนนประเมิน (กรรมการ)</div>
                    <div className="text-blue-900 font-bold text-2xl">{committee.committee_score || '-'}</div>
                  </div>

                  <div className="bg-white/60 rounded-xl p-4 border border-blue-200/50">
                    <div className="text-blue-600 font-medium text-sm mb-2">Strengths (จุดแข็ง)</div>
                    <div className="text-blue-900 text-sm">
                      {committee.strengths ? (
                        <div dangerouslySetInnerHTML={{ __html: committee.strengths }} />
                      ) : (
                        <em className="text-blue-600">ยังไม่มีข้อมูล</em>
                      )}
                    </div>
                  </div>

                  <div className="bg-white/60 rounded-xl p-4 border border-blue-200/50">
                    <div className="text-blue-600 font-medium text-sm mb-2">Areas for Improvement</div>
                    <div className="text-blue-900 text-sm">
                      {committee.improvements ? (
                        <div dangerouslySetInnerHTML={{ __html: committee.improvements }} />
                      ) : (
                        <em className="text-blue-600">ยังไม่มีข้อมูล</em>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* รายการหลักฐานอ้างอิง */}
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900">รายการหลักฐานอ้างอิง</h3>
              </div>

              {(() => {
                // ดึงข้อมูลหลักฐานจาก detailEvaluation
                const evidenceFiles = [];
                let evidenceMeta = {};

                // 1. ดึงจากไฟล์เดียวแบบเดิม (legacy)
                if (detailEvaluation?.evidence_file) {
                  evidenceFiles.push(detailEvaluation.evidence_file);
                }

                // 2. ดึงจาก JSON (ระบบใหม่ รองรับหลายไฟล์)
                if (detailEvaluation?.evidence_files_json) {
                  try {
                    const files = typeof detailEvaluation.evidence_files_json === 'string'
                      ? JSON.parse(detailEvaluation.evidence_files_json)
                      : detailEvaluation.evidence_files_json;
                    if (Array.isArray(files)) {
                      files.forEach(f => {
                        if (!evidenceFiles.includes(f)) evidenceFiles.push(f);
                      });
                    }
                  } catch (e) { console.error('Error parsing evidence_files_json:', e); }
                }

                // 3. ดึง metadata ของหลักฐาน
                if (detailEvaluation?.evidence_meta_json) {
                  try {
                    evidenceMeta = typeof detailEvaluation.evidence_meta_json === 'string'
                      ? JSON.parse(detailEvaluation.evidence_meta_json)
                      : detailEvaluation.evidence_meta_json;
                  } catch (e) { console.error('Error parsing evidence_meta_json:', e); }
                }

                if (evidenceFiles.length === 0) {
                  return (
                    <div className="text-center py-12 bg-white rounded-xl border-2 border-dashed border-gray-300">
                      <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div className="text-gray-500 font-medium">ไม่มีหลักฐานอ้างอิง</div>
                      <div className="text-gray-400 text-sm mt-1">ยังไม่มีการอัปโหลดเอกสารหลักฐาน</div>
                    </div>
                  );
                }

                return (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">หมายเลข</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">ชื่อหลักฐานอ้างอิง</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">เอกสารหลักฐาน</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {evidenceFiles.map((filename, index) => {
                            const fileMeta = evidenceMeta[filename] || {};
                            const evidenceNumber = fileMeta.number || `${index + 1}`;
                            const evidenceName = fileMeta.name || detailEvaluation?.evidence_name || filename;

                            return (
                              <tr key={index} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 text-sm font-medium text-gray-900 text-center bg-gray-50 border-r border-gray-200 w-20">
                                  {evidenceNumber}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-900 border-r border-gray-200">
                                  {evidenceName}
                                </td>
                                <td className="px-6 py-4 text-sm text-center">
                                  {(fileMeta.url || (filename.startsWith('url_') && detailEvaluation?.evidence_url)) ? (
                                    <a
                                      href={fileMeta.url || detailEvaluation?.evidence_url}
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
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // หากยังไม่ได้เลือกสาขา ให้แสดงหน้าเลือกสาขา (และปี)
  if (!selectedProgram) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <div className="text-center mb-8">
          <BarChart3 className="w-16 h-16 text-blue-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900">สรุปผลการดำเนินการคุณภาพการศึกษา</h1>
          <p className="text-gray-600 mt-2">กรุณาเลือกปีการศึกษาและสาขาที่ต้องการดูสรุปผล</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          {/* Year Selection Section */}
          <div className="mb-8 p-6 bg-blue-50/50 rounded-xl border border-blue-100">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              เลือกปีการศึกษา
            </label>
            {loadingRounds ? (
              <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
            ) : (
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="block w-full px-4 py-3 rounded-2xl border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white text-gray-900 text-base text-left"
              >
                {rounds.map(r => (
                  <option key={r.id} value={r.year}>
                    ปีการศึกษา {r.year} {r.is_active ? '(รอบปัจจุบัน)' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="border-t border-gray-100 pt-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">เลือกสาขา</h2>
            <ProgramSelection
              mode="assess"
              storageKey="summaryProgramSelection"
              buttonText="ดูสรุปผล"
              onComplete={(s) => {
                setSelectedProgram(s);
                try { localStorage.setItem('selectedProgramContext', JSON.stringify(s)); } catch { }
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
            ปี {selectedYear}
          </span>
          <h1 className="text-3xl font-bold">สรุปผลการดำเนินการ</h1>
        </div>
        <p className="text-gray-600 mt-1">ดูสรุปผลการดำเนินงานและการประเมินสำหรับแต่ละตัวบ่งชี้</p>
      </div>

      {/* Program info and change button */}
      <div className="mb-6 flex items-center justify-between">
        <div className="text-sm text-gray-700">
          <span className="text-gray-500">กำลังดูสรุปผลของ:</span>{' '}
          <span className="font-medium">{selectedProgram?.majorName || selectedProgram?.major_name || '-'}</span>
          {selectedProgram?.facultyName ? <span className="ml-1 text-gray-500">({selectedProgram.facultyName})</span> : null}
        </div>
        <div className="flex gap-2">
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
      {!viewComponent && !detailIndicator && (
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-2xl p-8 mb-8 border border-blue-200">
          <div className="flex items-center gap-3 mb-6">
            <BarChart3 className="w-8 h-8 text-blue-600" />
            <div>
              <h2 className="text-xl font-bold text-gray-900">ขั้นตอนการดูสรุปผลการดำเนินงาน</h2>
              <p className="text-gray-600 text-sm">ทำตามขั้นตอนเพื่อดูสรุปผลการดำเนินงานและการประเมิน</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">เลือกองค์ประกอบ</h3>
                <p className="text-sm text-gray-600">เลือกองค์ประกอบคุณภาพที่ต้องการดูสรุปผล</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">ดูรายละเอียดตัวบ่งชี้</h3>
                <p className="text-sm text-gray-600">ตรวจสอบผลการดำเนินงานและการประเมินของแต่ละตัวบ่งชี้</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">วิเคราะห์และปรับปรุง</h3>
                <p className="text-sm text-gray-600">วิเคราะห์ผลลัพธ์และวางแผนการปรับปรุงคุณภาพ</p>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Components Selection */}
      {!viewComponent && !detailIndicator && (
        <div className="bg-white shadow-md border border-gray-200 rounded-xl overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-gray-200 bg-white">
            <h3 className="text-lg font-bold text-gray-900">เลือกองค์ประกอบคุณภาพเพื่อดูสรุปผล</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">องค์ประกอบที่</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">ชื่อองค์ประกอบ</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">ตัวบ่งชี้</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr><td colSpan={3} className="text-center py-6">กำลังโหลด...</td></tr>
                ) : components.length === 0 ? (
                  <tr><td colSpan={3} className="text-center py-6 text-gray-400">ยังไม่มีองค์ประกอบ</td></tr>
                ) : (
                  [...components].sort((a, b) => {
                    const idA = parseInt(a.component_id || a.id || 0);
                    const idB = parseInt(b.component_id || b.id || 0);
                    return idA - idB;
                  }).map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 text-center text-sm font-medium text-gray-900 border-r border-gray-200">
                        <span className="inline-flex items-center justify-center w-8 h-8 bg-red-500 text-white rounded-full text-sm font-bold">
                          {c.component_id || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900 border-r border-gray-200">
                        <div className="font-medium text-gray-900">{c.quality_name}</div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <button
                          className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all shadow-sm"
                          onClick={() => handleViewIndicators(c)}
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
      )}


      {/* Indicators Table */}
      {viewComponent && (
        <div className="bg-white rounded-2xl shadow-md">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                สรุปผล - {viewComponent.quality_name}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                ตัวบ่งชี้และผลการดำเนินงาน (Read Only)
              </p>
            </div>
            <button
              onClick={() => { setViewComponent(null); setViewIndicators([]); }}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              กลับ
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 whitespace-nowrap">
                    ลำดับ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                    ตัวบ่งชี้
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 whitespace-nowrap">
                    ค่าเป้าหมาย
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 whitespace-nowrap">
                    ประเมินตน
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 whitespace-nowrap">
                    บรรลุ
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 whitespace-nowrap">
                    ประเมินกรรมการ
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    รายละเอียด
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {viewIndicators.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-500">
                      ไม่มีข้อมูลตัวบ่งชี้
                    </td>
                  </tr>
                ) : (
                  viewIndicators.map((ind) => {
                    const latest = rows.find(r =>
                      String(r.indicator_id) === String(ind.id) ||
                      String(r.indicator_id) === String(ind.indicator_id) ||
                      String(r.indicator_id) === String(ind.sequence)
                    );
                    const crit = getIndicatorData(ind, criteriaMap);
                    const committee = getIndicatorData(ind, committeeMap);

                    return (
                      <tr key={ind.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-center text-sm font-semibold text-gray-900 border-r border-gray-200">
                          {String(ind.sequence).includes('.') ? (
                            <span>{ind.sequence}</span>
                          ) : (
                            <span className="inline-flex items-center justify-center w-8 h-8 bg-red-500 text-white rounded-full text-sm font-bold">
                              {ind.sequence}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 border-r border-gray-200 text-left">
                          <div className={(String(ind.sequence).includes('.') ? 'font-normal' : 'font-bold') + ' text-gray-900 text-left'}>
                            {ind.indicator_name}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center text-sm text-gray-900 border-r border-gray-200">
                          {crit.score || '-'}
                        </td>
                        <td className="px-6 py-4 text-center text-sm text-gray-900 border-r border-gray-200">
                          {latest ? `${latest.operation_score ?? '-'}` : '-'}
                        </td>
                        <td className="px-6 py-4 text-center text-sm border-r border-gray-200">
                          {latest && latest.goal_achievement ? (
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${latest.goal_achievement === 'บรรลุ' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}>
                              {latest.goal_achievement}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="px-6 py-4 text-center text-sm border-r border-gray-200 font-medium">
                          {committee.committee_score || '-'}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => openIndicatorDetail(ind)}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors whitespace-nowrap"
                          >
                            ดูรายละเอียด
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {viewIndicators.length > 0 && (
                <tfoot className="bg-gray-100 font-bold">
                  <tr>
                    <td className="px-6 py-4 border-r border-gray-200"></td>
                    <td className="px-6 py-4 text-right text-sm text-gray-900 border-r border-gray-200">
                      รวม {viewIndicators.filter(ind => !String(ind.sequence).includes('.')).length} ตัวบ่งชี้
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-gray-900 border-r border-gray-200">
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
                    <td className="px-6 py-4 text-center text-sm text-gray-900 border-r border-gray-200">
                      {(() => {
                        const validScores = viewIndicators.map(ind => {
                          const latest = getIndicatorData(ind, operationMap);
                          const val = parseFloat(latest?.operation_score || 0);
                          return val > 0 ? val : NaN;
                        }).filter(s => !isNaN(s));
                        if (validScores.length === 0) return '-';
                        const avg = validScores.reduce((a, b) => a + b, 0) / validScores.length;
                        return Number.isInteger(avg) ? avg : avg.toFixed(2);
                      })()}
                    </td>
                    <td className="px-6 py-4 border-r border-gray-200"></td>
                    <td className="px-6 py-4 text-center text-sm text-gray-900 border-r border-gray-200">
                      {(() => {
                        const validScores = viewIndicators.map(ind => {
                          const committee = getIndicatorData(ind, committeeMap);
                          const val = parseFloat(committee.committee_score || 0);
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
      )}

      {/* ลบ modal; ใช้หน้าเต็มด้านบนแทน */}


    </div>
  );
}
