import React, { useState, useEffect, useMemo } from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title as ChartTitle,
} from 'chart.js';
import { Doughnut, Bar, Line } from 'react-chartjs-2';
import { LayoutDashboard, FileText, CheckCircle, GraduationCap, Clock, RefreshCcw, ChevronRight, BarChart3, Activity, X } from 'lucide-react';
import ProgramSelection from './ProgramSelection';
import { BASE_URL } from '../config/api.js';


ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ChartTitle
);

export default function DashboardContent({ user }) {
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalComponents: 0,
    totalIndicators: 0,
    completedAssessments: 0,
    averageScore: 0,
    componentProgress: [],
    recentEvaluations: [],
    allEvaluations: [] // Added to store all for modal
  });
  const [showAllModal, setShowAllModal] = useState(false); // Modal state
  const [historicalStats, setHistoricalStats] = useState([]); // Array of { year, avgScore }

  const [rounds, setRounds] = useState([]);
  const [selectedYear, setSelectedYear] = useState('');

  // Load selected program from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('selectedProgramContext');
      if (saved) {
        setSelectedProgram(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load program context', e);
    }

    // Fetch rounds
    fetch('/api/rounds')
      .then(res => res.json())
      .then(data => {
        setRounds(data);
        const active = data.find(r => r.is_active);
        if (active) setSelectedYear(active.year);
        else if (data.length > 0) setSelectedYear(data[0].year);
        else setSelectedYear(''); // No legacy fallback
      })
      .catch(err => console.error('Failed to load rounds', err));
  }, []);

  useEffect(() => {
    if (selectedProgram) {
      fetchDashboardData();
      fetchHistoricalTrends();
    }
  }, [selectedProgram, selectedYear, rounds]);

  const fetchHistoricalTrends = async () => {
    if (!selectedProgram || rounds.length === 0) return;

    try {
      const { majorName } = selectedProgram;

      const yearlyData = await Promise.all(rounds.map(async (round) => {
        const qs = new URLSearchParams({
          major_name: majorName,
          year: round.year
        }).toString();

        const res = await fetch(`${BASE_URL}/api/bulk/session-summary?${qs}`);
        if (!res.ok) return { year: round.year, avgScore: 0 };

        const data = await res.json();
        const evalsActual = data.evaluations_actual || [];

        // Logic: Take only the latest score per indicator to avoid duplicate sessions inflation
        const latestMap = new Map();
        evalsActual.forEach(ev => {
          const key = String(ev.indicator_id);
          const score = parseFloat(ev.operation_score) || 0;
          if (score <= 0) return;

          const existing = latestMap.get(key);
          const currentTimestamp = ev.created_at?.seconds || ev.created_at?._seconds || new Date(ev.created_at).getTime() / 1000 || 0;
          const existingTimestamp = existing ? (existing.created_at?.seconds || existing.created_at?._seconds || new Date(existing.created_at).getTime() / 1000 || 0) : 0;

          if (!existing || currentTimestamp > existingTimestamp) {
            latestMap.set(key, ev);
          }
        });

        const activeScores = Array.from(latestMap.values()).map(ev => parseFloat(ev.operation_score));
        const avg = activeScores.length > 0 ? (activeScores.reduce((a, b) => a + b, 0) / activeScores.length) : 0;

        return { year: round.year, avgScore: parseFloat(avg.toFixed(3)) };
      }));

      setHistoricalStats(yearlyData.sort((a, b) => a.year.localeCompare(b.year)));
    } catch (err) {
      console.error('Failed to fetch historical trends', err);
    }
  };

  const fetchDashboardData = async () => {
    if (!selectedYear) return; // ป้องกันการดึงข้อมูลทั้งหมดตอนที่ยังไม่ได้เลือกปี
    setLoading(true);
    setStats({
      totalComponents: 0,
      totalIndicators: 0,
      completedAssessments: 0,
      averageScore: 0,
      componentProgress: [],
      recentEvaluations: [],
      allEvaluations: []
    });

    try {
      const { majorName } = selectedProgram;
      const qs = new URLSearchParams({
        major_name: majorName,
        year: selectedYear
      }).toString();

      // Use the new bulk session summary endpoint
      const res = await fetch(`${BASE_URL}/api/bulk/session-summary?${qs}`);
      if (!res.ok) throw new Error('Failed to fetch dashboard data');

      const fullData = await res.json();
      const {
        components = [],
        evaluations_actual = [],
        indicators = []
      } = fullData;

      // Filter and deduplicate indicators to only those relevant to current year components
      const componentIds = new Set(components.map(c => String(c.component_id)));
      const componentDocIds = new Set(components.map(c => String(c.id)));

      const filteredIndicators = indicators.filter(ind =>
        componentIds.has(String(ind.component_id)) || componentDocIds.has(String(ind.component_id))
      );

      const totalIndicatorsCount = filteredIndicators.length;
      const activeIndicatorIds = new Set(filteredIndicators.map(ind => String(ind.id)));
      const activeIndicatorSequences = new Set(filteredIndicators.map(ind => String(ind.sequence)));
      const activeIndicatorLogicalIds = new Set(filteredIndicators.map(ind => String(ind.indicator_id || "")));

      // Deduplicate evaluations: take only the latest for each indicator if multiple exist
      const latestMap = new Map();
      evaluations_actual.forEach(ev => {
        // Must belong to our relevant indicators
        if (!activeIndicatorIds.has(String(ev.indicator_id)) &&
          !activeIndicatorSequences.has(String(ev.indicator_id)) &&
          !activeIndicatorLogicalIds.has(String(ev.indicator_id))) return;

        const key = String(ev.indicator_id);
        const existing = latestMap.get(key);

        const currentTimestamp = ev.created_at?.seconds || ev.created_at?._seconds || new Date(ev.created_at).getTime() / 1000 || 0;
        const existingTimestamp = existing ? (existing.created_at?.seconds || existing.created_at?._seconds || new Date(existing.created_at).getTime() / 1000 || 0) : 0;

        if (!existing || currentTimestamp > existingTimestamp) {
          latestMap.set(key, ev);
        }
      });

      const uniqueEvaluatedActual = Array.from(latestMap.values());
      const evaluatedIndicatorIds = new Set(uniqueEvaluatedActual.map(ev => String(ev.indicator_id)));

      // Average score based on unique/latest evaluations
      const allScores = uniqueEvaluatedActual
        .map(ev => parseFloat(ev.operation_score) || 0)
        .filter(s => s > 0);

      const averageScore = allScores.length > 0
        ? (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(2)
        : "0.00";

      // Calculate progress and score per component
      const componentStats = components.map(c => {
        const componentIndicators = filteredIndicators.filter(ind =>
          String(ind.component_id) === String(c.id) || String(ind.component_id) === String(c.component_id)
        );

        const completedInComponent = componentIndicators.filter(ind =>
          evaluatedIndicatorIds.has(String(ind.id)) ||
          evaluatedIndicatorIds.has(String(ind.indicator_id)) ||
          evaluatedIndicatorIds.has(String(ind.sequence))
        ).length;

        const totalInComponent = componentIndicators.length;
        const progress = totalInComponent > 0 ? Math.round((completedInComponent / totalInComponent) * 100) : 0;

        const componentScores = uniqueEvaluatedActual
          .filter(ev => {
            return componentIndicators.some(ind =>
              String(ind.id) === String(ev.indicator_id) ||
              String(ind.indicator_id) === String(ev.indicator_id) ||
              String(ind.sequence) === String(ev.indicator_id)
            );
          })
          .map(ev => parseFloat(ev.operation_score) || 0)
          .filter(s => s > 0);

        const score = componentScores.length > 0
          ? (componentScores.reduce((a, b) => a + b, 0) / componentScores.length).toFixed(2)
          : "0.00";

        return { name: c.quality_name, progress, score };
      });

      const processedEvaluations = uniqueEvaluatedActual
        .sort((a, b) => {
          const dateA = a.created_at?.seconds || a.created_at?._seconds || new Date(a.created_at).getTime() / 1000 || 0;
          const dateB = b.created_at?.seconds || b.created_at?._seconds || new Date(b.created_at).getTime() / 1000 || 0;
          return dateB - dateA;
        })
        .filter(ev => {
          const ind = filteredIndicators.find(i =>
            String(i.id) === String(ev.indicator_id) ||
            String(i.indicator_id) === String(ev.indicator_id) ||
            String(i.sequence) === String(ev.indicator_id)
          );
          return ind && String(ind.sequence || "").includes('.');
        })
        .map(ev => {
          const ind = filteredIndicators.find(i =>
            String(i.id) === String(ev.indicator_id) ||
            String(i.indicator_id) === String(ev.indicator_id) ||
            String(i.sequence) === String(ev.indicator_id)
          );

          let dateStr = 'ไม่ระบุวันที่';
          if (ev.created_at) {
            const seconds = ev.created_at.seconds || ev.created_at._seconds;
            if (seconds) dateStr = new Date(seconds * 1000).toLocaleDateString('th-TH');
            else {
              const d = new Date(ev.created_at);
              if (!isNaN(d.getTime())) dateStr = d.toLocaleDateString('th-TH');
            }
          }

          return {
            ...ev,
            display_id: ind ? ind.sequence : 'ไม่พบข้อมูล',
            display_name: ind ? ind.indicator_name : 'ไม่พบชื่อตัวบ่งชี้',
            display_date: dateStr,
            display_score: ev.operation_score || ev.score || '-'
          };
        });

      setStats({
        totalComponents: components.length,
        totalIndicators: totalIndicatorsCount,
        completedAssessments: evaluatedIndicatorIds.size,
        averageScore,
        componentProgress: componentStats,
        recentEvaluations: processedEvaluations.slice(0, 5),
        allEvaluations: processedEvaluations
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const progressData = {
    labels: ['Completed', 'Remaining'],
    datasets: [{
      data: [stats.completedAssessments, Math.max(0, stats.totalIndicators - stats.completedAssessments)],
      backgroundColor: ['#2563eb', '#f3f4f6'],
      borderWidth: 0,
      circumference: 180,
      rotation: 270,
    }]
  };

  const barData = {
    labels: stats.componentProgress.map(p => p.name.length > 20 ? p.name.substring(0, 20) + '...' : p.name),
    datasets: [{
      label: 'Progress (%)',
      data: stats.componentProgress.map(p => p.progress),
      backgroundColor: '#2563eb',
      borderRadius: 4,
    }]
  };

  if (!selectedProgram) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <div className="text-center mb-8">
          <LayoutDashboard className="w-16 h-16 text-blue-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-2">กรุณาเลือกสาขาเพื่อต้องการดู Dashboard</p>
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
    <div className="max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3">
            <BarChart3 className="text-blue-600" />
            ภาพรวมการพัฒนาคุณภาพการศึกษา
          </h1>
          <div className="flex items-center gap-2 mt-1 text-gray-500">
            <span className="font-medium text-blue-700">{selectedProgram.majorName}</span>
            <span>•</span>
            <span>{selectedProgram.facultyName}</span>
            <span>•</span>
            <span className="flex items-center gap-1"><Clock size={14} /> ข้อมูล ณ วันที่ {new Date().toLocaleDateString('th-TH')}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <select
            className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
          >
            {rounds.map(r => (
              <option key={r.id} value={r.year}>{r.name} {r.is_active ? '(Active)' : ''}</option>
            ))}
          </select>
          <button
            onClick={() => setSelectedProgram(null)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors shadow-sm"
          >
            <RefreshCcw size={16} /> เปลี่ยนสาขา
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[
          { label: 'องค์ประกอบทั้งหมด', value: stats.totalComponents, icon: GraduationCap, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'ตัวบ่งชี้ทั้งหมด', value: stats.totalIndicators, icon: FileText, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'ประเมินแล้ว', value: stats.completedAssessments, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'คะแนนเฉลี่ย', value: stats.averageScore, icon: BarChart3, color: 'text-blue-600', bg: 'bg-blue-50' },
        ].map((stat, idx) => (
          <div key={idx} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className={`${stat.bg} ${stat.color} p-3 rounded-xl`}>
              <stat.icon size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">{stat.label}</p>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Yearly Trend Chart */}
      <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm mb-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-xl font-bold text-gray-900">แนวโน้มคะแนนประเมินรายปี</h3>
            <p className="text-sm text-gray-500 mt-1">เปรียบเทียบคะแนนเฉลี่ยจากคณะกรรมการในแต่ละปีการศึกษา</p>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full">
            <Activity className="w-3.5 h-3.5" />
            AUN-QA TREND
          </div>
        </div>
        <div className="h-[300px]">
          {historicalStats.length > 0 ? (
            <Line
              data={{
                labels: historicalStats.map(d => `ปี ${d.year}`),
                datasets: [
                  {
                    label: 'คะแนนเฉลี่ยรวม',
                    data: historicalStats.map(d => d.avgScore),
                    borderColor: 'rgba(59, 130, 246, 1)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 3,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: 'rgba(59, 130, 246, 1)',
                    pointBorderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    tension: 0.4,
                    fill: true,
                  }
                ]
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    backgroundColor: '#1e293b',
                    padding: 12,
                    titleFont: { size: 14, weight: 'bold' },
                    bodyFont: { size: 13 },
                    cornerRadius: 8,
                  }
                },
                scales: {
                  y: {
                    min: 0,
                    max: 5,
                    ticks: { stepSize: 1 },
                    grid: { color: '#f1f5f9' }
                  },
                  x: {
                    grid: { display: false }
                  }
                }
              }}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400 italic">
              กำลังโหลดข้อมูลแนวโน้ม...
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Main Charts */}
        <div className="lg:col-span-2 space-y-8">
          {/* Bar Chart */}
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-bold text-gray-900">ร้อยละความก้าวหน้าตามองค์ประกอบ</h3>
                <p className="text-sm text-gray-500 mt-1">เปรียบเทียบความคืบหน้าการทำงานในแต่ละหมวดหมู่</p>
              </div>
            </div>
            <div className="h-[350px]">
              <Bar
                data={barData}
                options={{
                  indexAxis: 'y',
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    x: { max: 100, grid: { display: false } },
                    y: { grid: { display: false } }
                  }
                }}
              />
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">กิจกรรมล่าสุด</h3>
              <button
                onClick={() => setShowAllModal(true)}
                className="text-sm text-blue-600 font-medium flex items-center gap-1 hover:underline"
              >
                ดูทั้งหมด <ChevronRight size={16} />
              </button>
            </div>
            <div className="space-y-4">
              {stats.recentEvaluations.length > 0 ? stats.recentEvaluations.map((ev, i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 border border-transparent hover:border-blue-100 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-blue-600 shadow-sm">
                      <FileText size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">ตัวบ่งชี้ที่ {ev.display_id}</p>
                      <p className="text-[10px] text-gray-400 truncate max-w-[200px]">{ev.display_name}</p>
                      <p className="text-xs text-blue-600 font-bold mt-1">คะแนน: {ev.display_score}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">{ev.display_date}</p>
                    <span className="inline-block px-2 py-1 bg-green-100 text-green-700 text-[10px] uppercase font-bold rounded-full mt-1">สมบูรณ์</span>
                  </div>
                </div>
              )) : (
                <div className="text-center py-8 text-gray-400 italic">ไม่มีกิจกรรมล่าสุด</div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Secondary Charts & Info */}
        <div className="space-y-8">
          {/* Gauge Chart */}
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden">
            <h3 className="text-xl font-bold text-gray-900 mb-2">ภาพรวมความก้าวหน้า</h3>
            <p className="text-sm text-gray-500 mb-8">ร้อยละการรายงานข้อมูลทั้งหมด</p>
            <div className="relative h-48 flex items-center justify-center">
              <Doughnut
                data={progressData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  cutout: '80%',
                  plugins: { legend: { display: false }, tooltip: { enabled: false } }
                }}
              />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-2 text-center">
                <p className="text-4xl font-extrabold text-gray-900">
                  {Math.floor((stats.completedAssessments / (stats.totalIndicators || 1)) * 100)}%
                </p>
                <p className="text-xs text-gray-400 font-medium">COMPLETE</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-50">
              <div className="text-center">
                <p className="text-xs text-gray-400">เป้าหมาย</p>
                <p className="text-lg font-bold text-gray-900">100%</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-400">สถานะ</p>
                <p className="text-lg font-bold text-blue-600">On Track</p>
              </div>
            </div>
          </div>

          {/* Tips Card */}
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-8 rounded-3xl shadow-lg relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="text-white text-xl font-bold mb-4 italic text-right">AUN-QA Insight</h3>
              <p className="text-blue-50 mb-6 text-sm leading-relaxed">
                "การรักษามาตรฐานคุณภาพการศึกษาอย่างต่อเนื่อง ช่วยส่งเสริมความเป็นเลิศทางวิชาการและการยอมรับในระดับสากล"
              </p>
              <button className="w-full py-3 bg-white/20 backdrop-blur-md border border-white/30 text-white rounded-xl text-sm font-bold hover:bg-white/30 transition-all uppercase tracking-wider">
                Explore Best Practices
              </button>
            </div>
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-black/10 rounded-full blur-3xl"></div>
          </div>
        </div>
      </div>
      {/* All Activities Modal */}
      {showAllModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setShowAllModal(false)}
          />
          <div className="relative w-full max-w-2xl bg-white/90 backdrop-blur-md rounded-[2.5rem] shadow-2xl border border-white/50 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-white/50">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">กิจกรรมทั้งหมด</h3>
                <p className="text-sm text-gray-500 mt-1">ประวัติการประเมินตัวบ่งชี้ทั้งหมดของ {selectedProgram.majorName}</p>
              </div>
              <button
                onClick={() => setShowAllModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-900"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-grow overflow-y-auto p-8 space-y-4 custom-scrollbar">
              {stats.allEvaluations.length > 0 ? stats.allEvaluations.map((ev, i) => (
                <div key={i} className="flex items-center justify-between p-5 rounded-2xl bg-white/50 border border-gray-100 hover:border-blue-200 transition-all shadow-sm">
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-sm border border-blue-100/50">
                      <FileText size={22} />
                    </div>
                    <div>
                      <p className="text-base font-bold text-gray-900">ตัวบ่งชี้ที่ {ev.display_id}</p>
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{ev.display_name}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                          คะแนน: {ev.display_score}
                        </span>
                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                          <Clock size={10} /> {ev.display_date}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="px-3 py-1 bg-green-100 text-green-700 text-[10px] uppercase font-bold rounded-full border border-green-200 shadow-sm">
                      สมบูรณ์
                    </span>
                  </div>
                </div>
              )) : (
                <div className="text-center py-20">
                  <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100">
                    <Activity className="text-gray-300 w-10 h-10" />
                  </div>
                  <p className="text-gray-400 italic font-medium">ไม่มีประวัติกิจกรรมในรายการนี้</p>
                </div>
              )}
            </div>

            <div className="p-6 bg-gray-50/50 border-t border-gray-100 text-center">
              <button
                onClick={() => setShowAllModal(false)}
                className="px-8 py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100 transition-all shadow-sm active:scale-95"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}