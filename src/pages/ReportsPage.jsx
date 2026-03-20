import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Download, Save, School,
  LayoutDashboard, PieChart, BookOpen,
  CheckCircle, AlertCircle, TrendingUp,
  RefreshCw, ChevronRight, FileSpreadsheet, CalendarX, Settings,
  Info
} from 'lucide-react';
import { ESARGenerator } from '../utils/esarGenerator';
import { BASE_URL } from '../config/api.js';
import { useModal } from '../context/ModalContext';
import ProgramSelection from '../components/ProgramSelection';
import RichTextEditor from '../components/RichTextEditor.jsx';

export default function ReportsPage({ setActiveTab: setAppActiveTab }) {
  const { showAlert } = useModal();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear() + 543);
  const [rounds, setRounds] = useState([]);
  const [activeRound, setActiveRound] = useState(null);
  const [loadingRound, setLoadingRound] = useState(true);

  // Independent Data States
  const [esarData, setEsarData] = useState({
    universityInfo: '',
    programInfo: '',
    history: '',
    vision: '',
    mission: '',
    structure: '',
    swot: { s: '', w: '', o: '', t: '' }
  });
  const [components, setComponents] = useState([]);
  const [evaluations, setEvaluations] = useState([]); // evaluations_actual
  const [indicators, setIndicators] = useState([]);
  const [criteria, setCriteria] = useState([]);
  const [committeeEvaluations, setCommitteeEvaluations] = useState([]);
  const [stats, setStats] = useState({ avg: 0, completed: 0, total: 0 });

  const [selectedProgram, setSelectedProgram] = useState(null);

  const majorName = selectedProgram?.majorName || selectedProgram?.major_name || '';

  useEffect(() => {
    fetchRounds();
  }, []);

  useEffect(() => {
    if (selectedProgram && (selectedYear || majorName)) {
      fetchAllData();
    }
  }, [selectedYear, majorName, selectedProgram]);

  const fetchRounds = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/rounds`);
      if (res.ok) {
        const data = await res.json();
        setRounds(data);
        const active = data.find(r => r.is_active);
        setActiveRound(active || null);
        if (active) setSelectedYear(active.year);
      }
    } catch (error) {
      console.error('Failed to load rounds', error);
    } finally {
      setLoadingRound(false);
    }
  };

  const fetchAllData = async () => {
    if (!selectedYear || !majorName) return; // Prevent early fetch

    setLoading(true);
    // Clear old data to prevent flickering
    setComponents([]);
    setEvaluations([]);
    setIndicators([]);
    setEsarData({
      universityInfo: '',
      programInfo: '',
      history: '',
      vision: '',
      mission: '',
      structure: '',
      swot: { s: '', w: '', o: '', t: '' }
    });

    try {
      const qs = new URLSearchParams({
        year: selectedYear,
        major_name: majorName,
      }).toString();

      const [metaRes, bulkRes] = await Promise.all([
        fetch(`/api/esar-metadata?${qs}`),
        fetch(`/api/bulk/session-summary?${qs}`)
      ]);

      if (metaRes.ok) {
        const meta = await metaRes.json();
        if (meta && meta.id) {
          setEsarData({
            universityInfo: meta.universityInfo || '',
            programInfo: meta.programInfo || '',
            history: meta.history || '',
            vision: meta.vision || '',
            mission: meta.mission || '',
            structure: meta.structure || '',
            swot: meta.swot || { s: '', w: '', o: '', t: '' }
          });
        }
      }

      if (bulkRes.ok) {
        const data = await bulkRes.json();
        setComponents(data.components || []);
        setEvaluations(data.evaluations_actual || []); // Self-Assessment
        setIndicators(data.indicators || []);
        setCriteria(data.evaluations || []); // Target definitions
        setCommitteeEvaluations(data.committee_evaluations || []);
      }

    } catch (error) {
      console.error('Error fetching ESAR data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate Stats
  useEffect(() => {
    if (indicators.length > 0) {
      // Map preparation (Latest record wins)
      const selfMap = {};
      evaluations.forEach(r => { selfMap[String(r.indicator_id)] = r; });
      const targetMap = {};
      criteria.forEach(r => { targetMap[String(r.indicator_id)] = r; });
      const commMap = {};
      committeeEvaluations.forEach(r => { commMap[String(r.indicator_id)] = r; });

      const getVal = (ind, dataMap, key) => {
        const item = dataMap[String(ind.id)] || dataMap[String(ind.indicator_id)] || dataMap[String(ind.sequence)] || {};
        return parseFloat(item?.[key] || item?.['score'] || 0);
      };

      const getAvg = (list, dataMap, scoreKey) => {
        const valid = list.map(ind => {
          const val = getVal(ind, dataMap, scoreKey);
          return val > 0 ? val : NaN;
        }).filter(s => !isNaN(s));
        return valid.length > 0 ? (valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(2) : '0.00';
      };

      const selfAvg = getAvg(indicators, selfMap, 'operation_score');
      const targetAvg = getAvg(indicators, targetMap, 'score');
      const commAvg = getAvg(indicators, commMap, 'committee_score');

      const completedIds = new Set(evaluations.map(e => String(e.indicator_id)));
      const matchCount = indicators.filter(ind =>
        completedIds.has(String(ind.id)) ||
        completedIds.has(String(ind.indicator_id)) ||
        completedIds.has(String(ind.sequence))
      ).length;

      setStats({
        avg: selfAvg,
        targetAvg,
        commAvg,
        completed: matchCount,
        total: indicators.length
      });
    } else {
      setStats({ avg: '0.00', targetAvg: '0.00', commAvg: '0.00', completed: 0, total: indicators.length });
    }
  }, [evaluations, indicators, criteria, committeeEvaluations]);

  const helpers_countIndicators = () => indicators.length;

  const handleSaveMetadata = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/esar-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: selectedYear,
          major_name: majorName,
          data: esarData // Send the whole object
        })
      });
      if (res.ok) {
        showAlert({ title: 'สำเร็จ', message: 'บันทึกข้อมูลเรียบร้อยแล้ว', type: 'success' });
      } else {
        throw new Error('Save failed');
      }
    } catch (error) {
      console.error('Save error:', error);
      showAlert({ title: 'ข้อผิดพลาด', message: 'บันทึกไม่สำเร็จ', type: 'error' });
    } finally {
      setRefreshing(false);
    }
  };

  const handleGenerateFullESAR = async () => {
    try {
      setRefreshing(true);

      // Helper to map an indicator to PDF data
      const mapIndicator = (ind) => {
        const evalItem = evaluations.find(e =>
          String(e.indicator_id) === String(ind.id) ||
          String(e.indicator_id) === String(ind.indicator_id) ||
          String(e.indicator_id) === String(ind.sequence)
        );
        const criteriaItem = criteria.find(c =>
          String(c.indicator_id) === String(ind.id) ||
          String(c.indicator_id) === String(ind.indicator_id) ||
          String(c.indicator_id) === String(ind.sequence)
        );
        const evidenceFiles = JSON.parse(evalItem?.evidence_files_json || '[]');
        const evidenceMeta = JSON.parse(evalItem?.evidence_meta_json || '{}');
        const evidenceList = evidenceFiles.map(filename => ({
          number: evidenceMeta[filename]?.number || '1',
          name: evidenceMeta[filename]?.name || filename,
          url: evidenceMeta[filename]?.url || ''
        }));
        const selfScore = evalItem?.operation_score ? parseFloat(evalItem.operation_score) : null;
        const targetScore = criteriaItem?.score ? parseFloat(criteriaItem.score) : null;
        const committeeItem = committeeEvaluations.find(c =>
          String(c.indicator_id) === String(ind.id) ||
          String(c.indicator_id) === String(ind.indicator_id) ||
          String(c.indicator_id) === String(ind.sequence)
        );
        return {
          sequence: ind.sequence,
          indicator_name: ind.indicator_name,
          display_sequence: (() => {
            const seq = String(ind.sequence || '').trim();
            const match = seq.match(/^(\d+)\.0*(\d+)$/);
            return match ? `${match[1]}.${match[2]}` : seq;
          })(),
          evaluation_text: evalItem?.operation_result || evalItem?.evaluation_text || '<i>ยังไม่ได้กรอกข้อมูลผลการดำเนินงาน</i>',
          score: selfScore,
          target_score: targetScore,
          goal_achieved: selfScore !== null && targetScore !== null ? selfScore >= targetScore : false,
          has_evidence: evidenceList.length > 0,
          evidence_list: evidenceList,
          committee_score: committeeItem?.committee_score ? parseFloat(committeeItem.committee_score) : null,
          strengths: committeeItem?.strengths || '',
          improvements: committeeItem?.improvements || '',
          development_plan: committeeItem?.development_plan || ''
        };
      };

      // Group indicators by sequence prefix:
      // Main criteria: sequence is a plain integer string like "1", "2", "3"
      // Sub-indicators: sequence like "1.01", "1.02", "2.01"
      const mainCriteria = indicators
        .filter(ind => /^\d+$/.test(String(ind.sequence).trim()))
        .sort((a, b) => parseInt(a.sequence) - parseInt(b.sequence));

      const buildComponents = mainCriteria.map(main => {
        const prefix = String(main.sequence).trim();
        // Find matching component record for banner name
        const comp = components.find(c =>
          String(c.component_id) === prefix ||
          String(c.id) === prefix
        );
        // Sub-indicators whose sequence starts with "prefix."
        const subInds = indicators
          .filter(ind => {
            const seq = String(ind.sequence).trim();
            return seq.startsWith(prefix + '.') || seq.startsWith(prefix + ' ');
          })
          .sort((a, b) => String(a.sequence).localeCompare(String(b.sequence), undefined, { numeric: true }));

        // Banner: "เกณฑ์คุณภาพที่ N ชื่อ" from main criterion
        const bannerName = `เกณฑ์คุณภาพที่ ${prefix} ${main.indicator_name}`;

        return {
          quality_name: bannerName,
          indicators: subInds.map(mapIndicator)
        };
      }).filter(comp => comp.indicators.length > 0);

      // Prepare data for Puppeteer template
      const reportData = {
        university_name: 'มหาวิทยาลัยเทคโนโลยีราชมงคลศรีวิชัย',
        faculty_name: selectedProgram?.facultyName || selectedProgram?.faculty_name || '',
        logo_url: '/rmutsv-logo.png',
        program_name: majorName,
        year: selectedYear,
        university_info: esarData.universityInfo,
        program_info: esarData.programInfo,
        swot_s: esarData.swot?.s || '',
        swot_w: esarData.swot?.w || '',
        components: buildComponents
      };

      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportData)
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.details || 'การสร้าง PDF ล้มเหลว');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ESAR_Report_${majorName}_${selectedYear}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

    } catch (error) {
      console.error('Error generating PDF via Puppeteer:', error);
      showAlert({ title: 'ข้อผิดพลาด', message: 'เกิดข้อผิดพลาดในการสร้างรายงาน: ' + error.message, type: 'error' });
    } finally {
      setRefreshing(false);
    }
  };

  // --- Render Components ---

  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">เป้าหมาย (เฉลี่ย)</p>
            <p className="text-2xl font-black text-blue-500">{stats.targetAvg}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">ประเมินตน (เฉลี่ย)</p>
            <p className="text-2xl font-black text-blue-600">{stats.avg}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">กรรมการ (เฉลี่ย)</p>
            <p className="text-2xl font-black text-indigo-600">{stats.commAvg}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between border-l-4 border-l-green-500">
          <div>
            <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">ความก้าวหน้า</p>
            <p className="text-2xl font-black text-green-600">{stats.completed} <span className="text-sm text-gray-400 font-normal">/ {stats.total}</span></p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex flex-col">
            <h3 className="text-lg font-bold text-gray-800">สถานะรายหมวด</h3>
            <span className="text-sm text-gray-500 font-medium">สาขา: {majorName || 'ยังไม่ได้เลือกสาขา'}</span>
          </div>
          <div className="flex gap-2">
            {/* Moved to Header */}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">หมวด</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">จำนวนตัวบ่งชี้</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">เป้าหมาย</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">ประเมินตน</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">กรรมการ</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">สถานะ</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {[...components].sort((a, b) => {
                const idA = parseInt(a.component_id || a.id || 0);
                const idB = parseInt(b.component_id || b.id || 0);
                return idA - idB;
              }).map((comp) => {
                const code = comp.quality_code || '';
                const compIndicators = indicators.filter(ind =>
                  String(ind.component_id) === String(comp.id) ||
                  String(ind.component_id) === String(comp.component_id)
                );
                const compEvals = evaluations.filter(e =>
                  compIndicators.some(ind =>
                    String(ind.id) === String(e.indicator_id) ||
                    String(ind.indicator_id) === String(e.indicator_id) ||
                    String(ind.sequence) === String(e.indicator_id)
                  )
                );
                const completedInComp = compIndicators.filter(ind =>
                  compEvals.some(e =>
                    String(ind.id) === String(e.indicator_id) ||
                    String(ind.indicator_id) === String(e.indicator_id) ||
                    String(ind.sequence) === String(e.indicator_id)
                  )
                ).length;

                // Maps for component (inherit from above if needed, or build locally for clarity)
                const cSelfMap = {};
                evaluations.forEach(r => { cSelfMap[String(r.indicator_id)] = r; });
                const cTargetMap = {};
                criteria.forEach(r => { cTargetMap[String(r.indicator_id)] = r; });
                const cCommMap = {};
                committeeEvaluations.forEach(r => { cCommMap[String(r.indicator_id)] = r; });

                const getCompAvg = (dataMap, key) => {
                  const valid = compIndicators.filter(ind => String(ind.sequence).includes('.')).map(ind => {
                    const item = dataMap[String(ind.id)] || dataMap[String(ind.indicator_id)] || dataMap[String(ind.sequence)] || {};
                    const val = parseFloat(item?.[key] || item?.['score'] || 0);
                    return val > 0 ? val : NaN;
                  }).filter(s => !isNaN(s));
                  return valid.length > 0 ? (valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(2) : '-';
                };

                const selfScore = getCompAvg(cSelfMap, 'operation_score');
                const targetScore = getCompAvg(cTargetMap, 'score');
                const commScore = getCompAvg(cCommMap, 'committee_score');

                return (
                  <tr key={comp.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {comp.quality_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500">{compIndicators.filter(ind => String(ind.sequence).includes('.')).length}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-bold text-blue-500">{targetScore}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-bold text-blue-600">{selfScore}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-bold text-indigo-600">{commScore}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {completedInComp > 0 && completedInComp === compIndicators.filter(ind => String(ind.sequence).includes('.')).length ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          ครบถ้วน
                        </span>
                      ) : (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                          {completedInComp > 0 ? 'กำลังดำเนินการ' : 'รอดำเนินการ'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderResults = () => {
    return (
      <div className="space-y-8">
        {[...components].sort((a, b) => {
          const idA = parseInt(a.component_id || a.id || 0);
          const idB = parseInt(b.component_id || b.id || 0);
          return idA - idB;
        }).map((comp) => {
          const compIndicators = indicators.filter(ind =>
            String(ind.component_id) === String(comp.component_id) ||
            String(ind.id) === String(comp.id)
          );

          if (compIndicators.length === 0) return null;

          return (
            <div key={comp.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-bold text-gray-800">
                  องค์ประกอบที่ {comp.component_id || comp.id}: {comp.quality_name}
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">ตัวบ่งชี้</th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {compIndicators.map((ind) => {
                      const evaluation = evaluations.find(e =>
                        String(e.indicator_id) === String(ind.id) ||
                        String(e.indicator_id) === String(ind.indicator_id) ||
                        String(e.indicator_id) === String(ind.sequence)
                      );

                      return (
                        <tr key={ind.id} className="hover:bg-gray-50/50">
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-gray-900">{ind.indicator_id || ind.sequence}. {ind.indicator_name}</div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {!String(ind.sequence).includes('.') ? (
                              <span className="text-gray-400">-</span>
                            ) : (
                              evaluation ? (
                                <span className={`px-2 py-1 text-xs font-semibold rounded-full whitespace-nowrap ${evaluation.status === 'approved'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-yellow-100 text-yellow-800'
                                  }`}>
                                  {evaluation.status === 'approved' ? 'อนุมัติแล้ว' : 'รอตรวจสอบ'}
                                </span>
                              ) : (
                                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-400 whitespace-nowrap">
                                  ยังไม่ประเมิน
                                </span>
                              )
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
        })}
      </div>
    );
  };

  const renderProfileForm = () => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
      <h3 className="text-lg font-bold text-gray-800 border-b pb-2">บทที่ 1: โครงร่างองค์กร (Organization Profile)</h3>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">1. ข้อมูลทั่วไปเกี่ยวกับมหาวิทยาลัยเทคโนโลยีราชมงคลศรีวิชัย</label>
          <RichTextEditor
            value={esarData.universityInfo || ''}
            onChange={val => setEsarData({ ...esarData, universityInfo: val })}
            placeholder="ระบุข้อมูลทั่วไปเกี่ยวกับมหาวิทยาลัย..."
            minHeight={250}
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">2. ข้อมูลทั่วไปเกี่ยวกับหลักสูตร</label>
          <RichTextEditor
            value={esarData.programInfo || ''}
            onChange={val => setEsarData({ ...esarData, programInfo: val })}
            placeholder="ระบุข้อมูลทั่วไปเกี่ยวกับหลักสูตร..."
            minHeight={250}
          />
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <button
          onClick={handleSaveMetadata}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition shadow-md"
          disabled={refreshing}
        >
          <Save className="w-4 h-4 mr-2" />
          บันทึกข้อมูล
        </button>
      </div>
    </div>
  );

  const renderSWOT = () => {
    return (
      <div className="space-y-8">
        {[...components].sort((a, b) => {
          const idA = parseInt(a.component_id || a.id || 0);
          const idB = parseInt(b.component_id || b.id || 0);
          return idA - idB;
        }).map((comp) => {
          const compIndicators = indicators.filter(ind =>
            String(ind.component_id) === String(comp.component_id) ||
            String(ind.id) === String(comp.id)
          );

          if (compIndicators.length === 0) return null;

          return (
            <div key={comp.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-bold text-gray-800">
                  องค์ประกอบที่ {comp.component_id || comp.id}: {comp.quality_name}
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">ตัวบ่งชี้</th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">สถานะของกรรมการ</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {compIndicators.map((ind) => {
                      const commEval = committeeEvaluations.find(e =>
                        String(e.indicator_id) === String(ind.id) ||
                        String(e.indicator_id) === String(ind.indicator_id) ||
                        String(e.indicator_id) === String(ind.sequence)
                      );

                      return (
                        <tr key={ind.id} className="hover:bg-gray-50/50">
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-gray-900">{ind.indicator_id || ind.sequence}. {ind.indicator_name}</div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {!String(ind.sequence).includes('.') ? (
                              <span className="text-gray-400">-</span>
                            ) : (
                              commEval ? (
                                <span className="px-2 py-1 text-xs font-semibold rounded-full whitespace-nowrap bg-green-100 text-green-800">
                                  ประเมินแล้ว
                                </span>
                              ) : (
                                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 whitespace-nowrap">
                                  ยังไม่ประเมิน
                                </span>
                              )
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
        })}
      </div>
    );
  };

  const renderExport = () => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center space-y-6">
      <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto text-blue-600">
        <FileText size={40} />
      </div>
      <div>
        <h3 className="text-2xl font-bold text-gray-900">สร้างรายงานฉบับสมบูรณ์</h3>
        <p className="text-gray-500 mt-2 max-w-md mx-auto">
          ระบบจะรวบรวมข้อมูลทั้งหมด (ส่วนที่ 1 ,ส่วนที่ 2 ,ส่วนที่ 3)
          <br />เพื่อสร้างรายงาน ESAR ในรูปแบบ PDF
        </p>
      </div>

      <div className="flex justify-center gap-4 pt-4">
        <button
          onClick={handleGenerateFullESAR}
          disabled={refreshing}
          className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition shadow-lg transform hover:-translate-y-1 mx-auto"
        >
          {refreshing ? <RefreshCw className="animate-spin mr-2" /> : <Download className="mr-2" />}
          ดาวน์โหลด ESAR PDF
        </button>
      </div>


    </div>
  );

  // Check for active round first
  if (!loadingRound && !activeRound) {
    // Get current user from localStorage to check role
    let currentUserRole = null;
    try {
      const saved = localStorage.getItem('currentUser');
      if (saved) {
        const parsed = JSON.parse(saved);
        currentUserRole = parsed.role;
      }
    } catch { }

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
          <CalendarX className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">ยังไม่อยู่ในช่วงเวลาการประเมิน</h2>
        <p className="text-gray-500 max-w-md mb-8">
          ระบบยังไม่เปิดรับการประเมินในขณะนี้ กรุณาตรวจสอบกำหนดการหรือติดต่อผู้ดูแลระบบ
        </p>
        {['system_admin', 'qa_admin'].includes(currentUserRole) && setAppActiveTab && (
          <button
            onClick={() => setAppActiveTab('round_management')}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-colors shadow-lg"
          >
            <Settings className="w-5 h-5" />
            จัดการรอบประเมิน (สำหรับผู้ดูแล)
          </button>
        )}
      </div>
    );
  }

  if (!selectedProgram) {
    return (
      <div className="max-w-4xl mx-auto py-12 font-prompt">
        <div className="text-center mb-8">
          <FileText className="w-16 h-16 text-blue-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900">รายงานการประเมินตนเอง (SAR)</h1>
          <p className="text-gray-600 mt-2">กรุณาเลือกปีการศึกษาและสาขาที่ต้องการดูรายงาน</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          {/* Year Selection Section */}
          <div className="mb-8 p-6 bg-blue-50/50 rounded-xl border border-blue-100">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              เลือกปีการศึกษา
            </label>
            {loadingRound ? (
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
            <h2 className="text-lg font-semibold text-gray-900 mb-4 text-left">เลือกสาขา</h2>
            <ProgramSelection
              mode="manage"
              storageKey="reportsProgramSelection"
              buttonText="ดูรายงาน"
              onComplete={(sel) => {
                setSelectedProgram(sel);
                try { localStorage.setItem('selectedProgramContext', JSON.stringify(sel)); } catch { }
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8 font-prompt">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="text-blue-600" />
            รายงานการประเมินตนเอง (SAR)
          </h1>
          <p className="text-gray-600 mt-1">บริหารจัดการข้อมูลและสร้างรายงานตามเกณฑ์ AUN-QA</p>
        </div>
        <div className="mt-4 md:mt-0 flex items-center gap-3">
          <button
            onClick={() => {
              localStorage.removeItem('selectedProgramContext');
              setSelectedProgram(null);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 rounded-2xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors shadow-sm"
          >
            <RefreshCw size={16} />
            เปลี่ยนสาขา
          </button>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="bg-white border border-gray-300 text-gray-700 text-sm rounded-2xl focus:ring-blue-500 focus:border-blue-500 block p-2.5 shadow-sm h-[42px]"
          >
            {rounds.map(r => (
              <option key={r.id} value={r.year}>{r.name} {r.is_active ? '(Active)' : ''}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex overflow-x-auto pb-4 gap-2 mb-6 scrollbar-hide">
        {[
          { id: 'dashboard', label: 'ภาพรวม', icon: LayoutDashboard },
          { id: 'profile', label: '1. โครงร่างองค์กร', icon: School },
          { id: 'results', label: '2. ผลการดำเนินงาน', icon: BookOpen },
          { id: 'swot', label: '3. สรุปผลการประเมินตนเอง', icon: PieChart },
          { id: 'export', label: '4. ออกรายงาน', icon: FileText },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center px-4 py-3 rounded-xl whitespace-nowrap transition-all ${activeTab === tab.id
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
              }`}
          >
            <tab.icon className="w-4 h-4 mr-2" />
            <span className="font-medium">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="mb-12">
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'profile' && renderProfileForm()}
        {activeTab === 'results' && renderResults()}
        {activeTab === 'swot' && renderSWOT()}
        {activeTab === 'export' && renderExport()}
      </div>

      {loading && (
        <div className="fixed inset-0 bg-white/50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="flex flex-col items-center">
            <RefreshCw className="w-10 h-10 text-blue-600 animate-spin mb-2" />
            <span className="text-gray-600 font-medium">กำลังโหลดข้อมูล...</span>
          </div>
        </div>
      )}
    </main>
  );
}
