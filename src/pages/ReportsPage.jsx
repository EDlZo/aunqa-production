// src/pages/ReportsPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Download, Save, School,
  LayoutDashboard, PieChart, BookOpen,
  CheckCircle, AlertCircle, TrendingUp,
  Printer, RefreshCw, ChevronRight, FileSpreadsheet
} from 'lucide-react';
import { generateAssessmentPDF, downloadPDF } from '../utils/pdfGenerator';
import { ESARGenerator } from '../utils/esarGenerator';
import { BASE_URL } from '../config/api.js';
import { useModal } from '../context/ModalContext';
import ProgramSelection from '../components/ProgramSelection';

export default function ReportsPage() {
  const { showAlert } = useModal();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear() + 543);
  const [rounds, setRounds] = useState([]);

  // Independent Data States
  const [esarData, setEsarData] = useState({
    history: '',
    vision: '',
    mission: '',
    structure: '',
    swot: { s: '', w: '', o: '', t: '' }
  });
  const [components, setComponents] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [indicators, setIndicators] = useState([]);
  const [stats, setStats] = useState({ avg: 0, completed: 0, total: 0 });

  const [selectedProgram, setSelectedProgram] = useState(() => {
    try {
      const saved = localStorage.getItem('selectedProgramContext');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

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
      const res = await fetch('/api/rounds');
      if (res.ok) {
        const data = await res.json();
        setRounds(data);
        const active = data.find(r => r.is_active);
        if (active) setSelectedYear(active.year);
      }
    } catch (error) {
      console.error('Failed to load rounds', error);
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
      history: '',
      vision: '',
      mission: '',
      structure: '',
      swot: { s: '', w: '', o: '', t: '' }
    });

    try {
      const qs = new URLSearchParams({
        year: selectedYear,
        major_name: majorName
      }).toString();

      const [metaRes, compRes, evalRes, indRes] = await Promise.all([
        fetch(`/api/esar-metadata?${qs}`),
        fetch(`/api/quality-components?${qs}`),
        fetch(`/api/evaluations-actual/history?${qs}`), // Fetch all, including non-approved
        fetch(`/api/indicators?${qs}`)
      ]);

      if (metaRes.ok) {
        const meta = await metaRes.json();
        if (meta && (meta.history || meta.swot)) {
          setEsarData({
            history: meta.history || '',
            vision: meta.vision || '',
            mission: meta.mission || '',
            structure: meta.structure || '',
            swot: meta.swot || { s: '', w: '', o: '', t: '' }
          });
        } else {
          // Reset if no data found for this year
          setEsarData({
            history: '',
            vision: '',
            mission: '',
            structure: '',
            swot: { s: '', w: '', o: '', t: '' }
          });
        }
      }

      if (compRes.ok) {
        const comps = await compRes.json();
        // Filter only AUN 1-8 for ESAR view usually, but let's keep all
        setComponents(comps);
      }

      if (evalRes.ok) setEvaluations(await evalRes.json());
      if (indRes.ok) setIndicators(await indRes.json());

    } catch (error) {
      console.error('Error fetching ESAR data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate Stats
  useEffect(() => {
    if (evaluations.length > 0 && indicators.length > 0) {
      const getScore = (e) => parseFloat(e.score || e.operation_score || 0);
      const scoredEvals = evaluations.filter(e => getScore(e) > 0);
      const avg = scoredEvals.length > 0 ? (scoredEvals.reduce((a, b) => a + getScore(b), 0) / scoredEvals.length) : 0;
      const completedIds = new Set(evaluations.map(e => String(e.indicator_id)));
      const matchCount = indicators.filter(ind =>
        completedIds.has(String(ind.id)) ||
        completedIds.has(String(ind.indicator_id)) ||
        completedIds.has(String(ind.sequence))
      ).length;

      setStats({
        avg: avg.toFixed(2),
        completed: matchCount,
        total: indicators.length
      });
    } else {
      setStats({ avg: 0, completed: 0, total: helpers_countIndicators() });
    }
  }, [evaluations, indicators]);

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
      const generator = new ESARGenerator({
        program: { majorName, ...selectedProgram },
        year: selectedYear,
        components,
        indicators,
        evaluations,
        metadata: esarData // Pass metadata to generator
      });

      const doc = await generator.generate();
      doc.save(`ESAR_Report_${majorName}_${selectedYear}.pdf`);

    } catch (error) {
      console.error('Error generating full ESAR:', error);
      showAlert({ title: 'ข้อผิดพลาด', message: 'เกิดข้อผิดพลาดในการสร้างรายงาน: ' + error.message, type: 'error' });
    } finally {
      setRefreshing(false);
    }
  };

  // --- Render Components ---

  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-gray-500 text-sm">คะแนนเฉลี่ยรวม</p>
            <p className="text-3xl font-bold text-blue-600">{stats.avg}</p>
          </div>
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
            <TrendingUp size={24} />
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-gray-500 text-sm">ประเมินแล้ว</p>
            <p className="text-3xl font-bold text-green-600">{stats.completed} <span className="text-sm text-gray-400 font-normal">/ {stats.total}</span></p>
          </div>
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600">
            <CheckCircle size={24} />
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-gray-500 text-sm">รอการประเมิน</p>
            <p className="text-3xl font-bold text-orange-600">{Math.max(0, stats.total - stats.completed)}</p>
          </div>
          <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center text-orange-600">
            <RefreshCw size={24} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex flex-col">
            <h3 className="text-lg font-bold text-gray-800">สถานะรายหมวด (องค์ประกอบ {components.length})</h3>
            <span className="text-sm text-gray-500 font-medium">สาขา: {majorName || 'ยังไม่ได้เลือกสาขา'}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                localStorage.removeItem('selectedProgramContext');
                setSelectedProgram(null);
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors shadow-sm"
            >
              <RefreshCw size={14} />
              เปลี่ยนสาขา
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">หมวด</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">จำนวนตัวบ่งชี้</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">ประเมินแล้ว</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">คะแนนเฉลี่ย</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">สถานะ</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {components.map((comp) => {
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

                const score = compEvals.length > 0
                  ? (compEvals.reduce((a, b) => a + parseFloat(b.score || b.operation_score || 0), 0) / compEvals.length).toFixed(2)
                  : '-';

                return (
                  <tr key={comp.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {comp.quality_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500">{compIndicators.length}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500">{completedInComp}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-bold text-blue-600">{score}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {completedInComp > 0 && completedInComp === compIndicators.length ? (
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
        {components.map((comp) => {
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
                            {evaluation ? (
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

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">ประวัติความเป็นมา (History)</label>
        <textarea
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          value={esarData.history}
          onChange={e => setEsarData({ ...esarData, history: e.target.value })}
          placeholder="ระบุประวัติความเป็นมาของหลักสูตร/คณะ..."
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">วิสัยทัศน์ (Vision)</label>
          <textarea
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            value={esarData.vision}
            onChange={e => setEsarData({ ...esarData, vision: e.target.value })}
            placeholder="ระบุวิสัยทัศน์..."
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">พันธกิจ (Mission)</label>
          <textarea
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            value={esarData.mission}
            onChange={e => setEsarData({ ...esarData, mission: e.target.value })}
            placeholder="ระบุพันธกิจ..."
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">โครงสร้างการบริหาร (Organization Structure)</label>
        <textarea
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          value={esarData.structure}
          onChange={e => setEsarData({ ...esarData, structure: e.target.value })}
          placeholder="อธิบายโครงสร้างการบริหาร..."
        />
      </div>

      <div className="flex justify-end pt-4">
        <button
          onClick={handleSaveMetadata}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          disabled={refreshing}
        >
          <Save className="w-4 h-4 mr-2" />
          บันทึกข้อมูล
        </button>
      </div>
    </div>
  );

  const renderSWOT = () => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
      <h3 className="text-lg font-bold text-gray-800 border-b pb-2">บทที่ 3: สรุปจุดแข็งและข้อควรพัฒนา</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-green-50 p-4 rounded-xl border border-green-100">
          <label className="flex items-center text-green-800 font-bold mb-2">
            <CheckCircle className="w-5 h-5 mr-2" /> จุดแข็ง (Strengths)
          </label>
          <textarea
            rows={10}
            className="w-full px-3 py-2 bg-white border border-green-200 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
            value={esarData.swot.s}
            onChange={e => setEsarData({ ...esarData, swot: { ...esarData.swot, s: e.target.value } })}
            placeholder="ระบุจุดแข็งของหลักสูตร..."
          />
        </div>

        <div className="bg-red-50 p-4 rounded-xl border border-red-100">
          <label className="flex items-center text-red-800 font-bold mb-2">
            <AlertCircle className="w-5 h-5 mr-2" /> จุดควรพัฒนา (Areas for Improvement)
          </label>
          <textarea
            rows={10}
            className="w-full px-3 py-2 bg-white border border-red-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
            value={esarData.swot.w}
            onChange={e => setEsarData({ ...esarData, swot: { ...esarData.swot, w: e.target.value } })}
            placeholder="ระบุจุดที่ควรปรับปรุง..."
          />
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <button
          onClick={handleSaveMetadata}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          disabled={refreshing}
        >
          <Save className="w-4 h-4 mr-2" />
          บันทึกข้อมูล
        </button>
      </div>
    </div>
  );

  const renderExport = () => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center space-y-6">
      <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto text-blue-600">
        <FileText size={40} />
      </div>
      <div>
        <h3 className="text-2xl font-bold text-gray-900">สร้างรายงานฉบับสมบูรณ์</h3>
        <p className="text-gray-500 mt-2 max-w-md mx-auto">
          ระบบจะรวบรวมข้อมูลทั้งหมด (บทนำ, ผลประเมินรายข้อ, SWOT, เอกสารแนบ)
          เพื่อสร้างรายงาน ESAR ในรูปแบบ PDF
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

  if (!selectedProgram) {
    return (
      <div className="max-w-4xl mx-auto py-12 font-prompt">
        <div className="text-center mb-8">
          <FileText className="w-16 h-16 text-blue-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900">รายงานการประเมินตนเอง (SAR)</h1>
          <p className="text-gray-600 mt-2">กรุณาเลือกสาขาที่ต้องการดูรายงาน</p>
        </div>
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          <ProgramSelection
            onComplete={(sel) => {
              setSelectedProgram(sel);
              try { localStorage.setItem('selectedProgramContext', JSON.stringify(sel)); } catch { }
            }}
          />
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
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="bg-white border border-gray-300 text-gray-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 shadow-sm"
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
          { id: 'swot', label: '3. สรุปจุดแข็งและข้อควรพัฒนา', icon: PieChart },
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
