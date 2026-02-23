// src/App.jsx
import React, { useState, useEffect } from 'react';
import {
  Award, BookOpen, Users, Globe, CheckCircle, Star,
  ChevronRight, Menu, X, GraduationCap, Building,
  FileText, Lock, User, Eye, EyeOff, Shield, UserCheck, Settings, LogOut, LayoutDashboard, Target, Layers, CalendarX
} from 'lucide-react';

// Import Components ที่จะสร้างขึ้นมาใหม่
import Header from './components/Header';
import Footer from './components/Footer';
import SummaryPage from './pages/SummaryPage';
import AssessmentPage from './pages/AssessmentPage';
import CommitteeEvaluationPage from './pages/CommitteeEvaluationPage';
import ReportsPage from './pages/ReportsPage';
import HeroSection from './components/HeroSection';
import LoginModal from './components/LoginModal';
import AboutContent from './components/AboutContent';
import ProcessContent from './components/ProcessContent';
import ResultsContent from './components/ResultsContent';
import DashboardContent from './components/DashboardContent';
import DefineComponentSection from './components/Quality/DefineComponentSection';
import ProgramSelection from './components/ProgramSelection';
import AssessmentTablePage from './pages/AssessmentTablePage';
import ConnectionStatus from './components/ConnectionStatus';
import UserManagementPage from './pages/UserManagementPage';
import SystemManagementPage from './pages/SystemManagementPage';
import RoundManagementPage from './pages/RoundManagementPage';
import DatabaseManagementPage from './pages/DatabaseManagementPage';
import ProgramManagement from './components/Admin/ProgramManagement';
import { BASE_URL } from './config/api';
import { ModalProvider } from './context/ModalContext';


export default function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('about');
  const [showLogin, setShowLogin] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [activeRound, setActiveRound] = useState(null);
  const [loadingRound, setLoadingRound] = useState(true);
  const [publicStats, setPublicStats] = useState(null);

  // Restore session from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('currentUser');
      if (saved) {
        const parsed = JSON.parse(saved);
        setCurrentUser(parsed);
        setActiveTab('dashboard');
      }
      const sel = localStorage.getItem('selectedProgramContext');
      if (sel) {
        try { setSelectedProgram(JSON.parse(sel)); } catch { }
      }
    } catch { }
  }, []);

  // เลื่อนหน้าต่างกลับไปบนสุดเสมอเมื่อสลับเมนู/แท็บ
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [activeTab]);

  // Fetch Active Round
  useEffect(() => {
    const checkActiveRound = async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/rounds`);
        if (res.ok) {
          const rounds = await res.json();
          const active = rounds.find(r => r.is_active);
          setActiveRound(active || null);
        }
      } catch (error) {
        console.error('Error fetching rounds:', error);
      } finally {
        setLoadingRound(false);
      }
    };
    checkActiveRound();

    // Set up an interval or similar if we want real-time, but for now just fetch on mount
    // Or maybe refresh when activeTab changes to ensure we catch updates?
    // Let's rely on mount + maybe manual refresh if needed.
    // Actually, adding activeTab as dep might be too aggressive if they switch tabs often, 
    // but it ensures they don't get stuck in a state if someone else opens a round.
    // Let's add it to run occasionally or just on mount for now.
  }, [activeTab]); // Refresh round status when tab changes to ensure up-to-date access

  // Fetch Public Stats for Hero Section
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/public-stats`);
        if (res.ok) {
          const data = await res.json();
          setPublicStats(data);
        }
      } catch (error) {
        console.error('Error fetching public stats:', error);
      }
    };
    fetchStats();
  }, []);

  // ไม่ใช้ mock users แล้ว ใช้ API จริง

  const rolePermissions = {
    system_admin: { name: 'System Admin', color: 'bg-red-600', permissions: ['manage_structure', 'manage_users', 'view_all'] },
    sar_manager: { name: 'SAR Manager', color: 'bg-blue-600', permissions: ['select_criteria', 'set_targets', 'set_weights', 'manage_rounds', 'check_completeness', 'view_reports'] },
    reporter: { name: 'Reporter', color: 'bg-green-600', permissions: ['fill_results', 'upload_evidence', 'write_sar', 'edit_own_data'] },
    external_evaluator: { name: 'External Evaluator', color: 'bg-purple-600', permissions: ['view_assigned_limited', 'give_scores', 'give_feedback'] },
    executive: { name: 'Executive', color: 'bg-gray-600', permissions: ['view_summary', 'view_dashboard', 'compare_results'] },
    qa_admin: { name: 'QA Admin', color: 'bg-indigo-600', permissions: ['manage_structure', 'view_all', 'view_summary', 'view_dashboard', 'view_reports'] }
  };



  const handleLogout = () => {
    setCurrentUser(null);
    setActiveTab('about');
    try { localStorage.removeItem('currentUser'); } catch { }
  };

  // ข้อมูลเหล่านี้จะถูกส่งเป็น props ไปยัง TabContent และ Component ย่อย
  const standards = [
    { title: "การบริหารจัดการเชิงกลยุทธ์", description: "การวางแผนและการบริหารจัดการที่มีประสิทธิภาพ", icon: <Building className="w-6 h-6" />, color: "bg-blue-500" },
    { title: "การเรียนการสอน", description: "คุณภาพการศึกษาและหลักสูตรที่ทันสมัย", icon: <BookOpen className="w-6 h-6" />, color: "bg-green-500" },
    { title: "การวิจัยและนวัตกรรม", description: "การพัฒนาองค์ความรู้และนวัตกรรม", icon: <Award className="w-6 h-6" />, color: "bg-purple-500" },
    { title: "การบริการวิชาการ", description: "การบริการแก่สังคมและชุมชน", icon: <Users className="w-6 h-6" />, color: "bg-orange-500" },
    { title: "การทำนุบำรุงศิลปวัทนธรรม", description: "การอนุรักษ์และส่งเสริมศิลปวัทนธรรม", icon: <Globe className="w-6 h-6" />, color: "bg-red-500" },
    { title: "การประกันคุณภาพภายใน", description: "ระบบการประกันคุณภาพที่มีประสิทธิภาพ", icon: <CheckCircle className="w-6 h-6" />, color: "bg-indigo-500" }
  ];

  const achievements = [
    { year: "2024", title: "ผ่านการประเมิน AUNQA ระดับดีเยี่ยม", score: "4.8/5.0" },
    { year: "2023", title: "รางวัลความเป็นเลิศทางวิชาการ ASEAN", score: "4.7/5.0" },
    { year: "2022", title: "การรับรองมาตรฐานสากล ISO 21001", score: "4.6/5.0" },
  ];

  // Logic สำหรับแสดงเนื้อหาแต่ละ Tab
  const TabContent = () => {
    if (!currentUser && !['about', 'summary', 'process', 'results'].includes(activeTab)) {
      return (
        <div className="text-center py-16">
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-md mx-auto">
            <Lock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">กรุณาเข้าสู่ระบบ</h3>
            <p className="text-gray-600 mb-6">เข้าสู่ระบบเพื่อดูเนื้อหาและใช้งานฟีเจอร์ต่างๆ</p>
            <button
              onClick={() => setShowLogin(true)}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              เข้าสู่ระบบ
            </button>
          </div>
        </div>
      );
    }


    // ป้องกัน error ถ้า currentUser เป็น null (เช่นหน้า summary)
    let userRole, hasPermission;
    if (currentUser) {
      userRole = rolePermissions[currentUser.role];
      hasPermission = (permission) => userRole.permissions.includes(permission);
    } else {
      userRole = null;
      hasPermission = () => false;
    }

    // Role-based access control for tabs
    const role = currentUser?.role;

    switch (activeTab) {
      case 'about':
        return <AboutContent currentUser={currentUser} rolePermissions={rolePermissions} standards={standards} />;

      // Check for Restricted Tabs (Require Active Round)
      case 'programs':
      case 'manage':
      case 'committee':
      case 'assessment_criteria':
      case 'assessment_evaluation':
      case 'assessment_table':
      case 'database_management':
      case 'dashboard': // User requested dashboard to be restricted too
        // Special case: System Admin or QA Admin might still want to see things?
        // Usually Admins create rounds, so if they haven't created one, they probably know why.
        // But let's stick to the rule: No Active Round = Block these pages.
        // Unless we want to allow Admins to "Preview"? 
        // For now, block everyone to enforce "Not Assessment Period".
        // UPDATE: User requested System Admin to always see these pages.

        if (!loadingRound && !activeRound && currentUser?.role !== 'system_admin') {
          return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                <CalendarX className="w-12 h-12 text-gray-400" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">ยังไม่อยู่ในช่วงเวลาการประเมิน</h2>
              <p className="text-gray-500 max-w-md mb-8">
                ระบบยังไม่เปิดรับการประเมินในขณะนี้ กรุณาตรวจสอบกำหนดการหรือติดต่อผู้ดูแลระบบ
              </p>
              {['system_admin', 'qa_admin'].includes(role) && (
                <button
                  onClick={() => setActiveTab('round_management')}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg"
                >
                  <Settings className="w-5 h-5" />
                  จัดการรอบประเมิน (สำหรับผู้ดูแล)
                </button>
              )}
            </div>
          );
        }
        // Fallthrough to normal rendering for these cases (using a second switch or if/else blocks inside)
        // Since we can't fallthrough effectively in React return, we handle specific cases below.
        break;

      default:
        break;
    }

    // Secondary Switch for content handling after restriction check
    switch (activeTab) {
      case 'programs':
        // Only Admin or QA Admin can access programs setup
        if (role !== 'system_admin' && role !== 'qa_admin') {
          return <div className="p-8 text-center text-red-600">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</div>;
        }
        return (
          <div className="max-w-4xl mx-auto py-12">
            <div className="text-center mb-8">
              <GraduationCap className="w-16 h-16 text-blue-600 mx-auto mb-4" />
              <h1 className="text-3xl font-bold text-gray-900">จัดการองค์ประกอบคุณภาพการศึกษา</h1>
              <p className="text-gray-600 mt-2">กรุณาเลือกสาขาที่ต้องการจัดการข้อมูล</p>
            </div>
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
              <ProgramSelection
                onComplete={(sel) => {
                  try { localStorage.setItem('selectedProgramContext', JSON.stringify(sel)); } catch { }
                  const majorName = sel.majorName || sel.major_name || '';

                  // Try recovery first
                  fetch(`${BASE_URL}/api/assessment-sessions/latest?major_name=${encodeURIComponent(majorName)}`)
                    .then(r => r.json())
                    .then(recoveryData => {
                      if (recoveryData && recoveryData.session_id) {
                        try { localStorage.setItem('assessment_session_id', String(recoveryData.session_id)); } catch { }
                        setActiveTab('manage');
                      } else {
                        // Create new if recovery fails
                        fetch(`${BASE_URL}/api/assessment-sessions`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            level_id: sel.levelId,
                            faculty_id: sel.facultyId,
                            faculty_name: sel.facultyName,
                            major_id: sel.majorId,
                            major_name: majorName,
                            evaluator_id: currentUser?.user_id || null,
                          })
                        }).then(r => r.json()).then(data => {
                          if (data && data.session_id) {
                            try { localStorage.setItem('assessment_session_id', String(data.session_id)); } catch { }
                          }
                          setActiveTab('manage');
                        }).catch(() => setActiveTab('manage'));
                      }
                    })
                    .catch(() => setActiveTab('manage'));
                }}
              />
            </div>
          </div>
        );
      case 'manage':
        {
          const sel = selectedProgram;
          // Only Admin or QA Admin can access management
          if (role !== 'system_admin' && role !== 'qa_admin') {
            return <div className="p-8 text-center text-red-600">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</div>;
          }
          if (!sel) {
            return (
              <div className="max-w-4xl mx-auto py-12">
                <div className="text-center mb-8">
                  <Layers className="w-16 h-16 text-blue-600 mx-auto mb-4" />
                  <h1 className="text-3xl font-bold text-gray-900">จัดการองค์ประกอบคุณภาพการศึกษา</h1>
                  <p className="text-gray-600 mt-2">กรุณาเลือกสาขาที่ต้องการจัดการข้อมูล</p>
                </div>
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
                  <ProgramSelection
                    onComplete={(s) => {
                      try { localStorage.setItem('selectedProgramContext', JSON.stringify(s)); } catch { }
                      setSelectedProgram(s);
                      const majorName = s.majorName || s.major_name || '';

                      // Try recovery first
                      fetch(`${BASE_URL}/api/assessment-sessions/latest?major_name=${encodeURIComponent(majorName)}`)
                        .then(r => r.json())
                        .then(recoveryData => {
                          if (recoveryData && recoveryData.session_id) {
                            try { localStorage.setItem('assessment_session_id', String(recoveryData.session_id)); } catch { }
                            setActiveTab('manage');
                          } else {
                            // Create new if recovery fails
                            fetch(`${BASE_URL}/api/assessment-sessions`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                level_id: s.levelId,
                                faculty_id: s.facultyId,
                                faculty_name: s.facultyName,
                                major_id: s.majorId,
                                major_name: majorName,
                                evaluator_id: currentUser?.user_id || null,
                              })
                            }).then(r => r.json()).then(data => {
                              if (data && data.session_id) {
                                try { localStorage.setItem('assessment_session_id', String(data.session_id)); } catch { }
                              }
                              setActiveTab('manage');
                            }).catch(() => setActiveTab('manage'));
                          }
                        })
                        .catch(() => setActiveTab('manage'));
                    }}
                  />
                </div>
              </div>
            );
          }

          return (
            <div className="max-w-6xl mx-auto">
              {/* Header */}
              <div className="mb-6">
                <h1 className="text-3xl font-bold">จัดการองค์ประกอบคุณภาพการศึกษา</h1>
                <p className="text-gray-600 mt-1">จัดการข้อมูลกลุ่มคุณภาพ องค์ประกอบ และตัวบ่งชี้</p>
              </div>

              {/* Program info and change button */}
              <div className="mb-6 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  <span className="text-gray-500">กำลังจัดการของ:</span>{' '}
                  <span className="font-medium">{sel?.majorName || '-'}</span>
                  {sel?.facultyName ? <span className="ml-1 text-gray-500">({sel.facultyName})</span> : null}
                </div>
                <button
                  onClick={() => { try { localStorage.removeItem('selectedProgramContext'); localStorage.removeItem('assessment_session_id'); } catch { }; setSelectedProgram(null); setActiveTab('manage'); }}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  เปลี่ยนสาขา
                </button>
              </div>

              {/* Steps section */}
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-2xl p-8 mb-8 border border-blue-200">
                <div className="flex items-center gap-3 mb-6">
                  <Layers className="w-8 h-8 text-blue-600" />
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">ขั้นตอนการจัดการองค์ประกอบคุณภาพ</h2>
                    <p className="text-gray-600 text-sm">ทำตามขั้นตอนเพื่อจัดการข้อมูลองค์ประกอบและตัวบ่งชี้ให้ครบถ้วน</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">สร้างองค์ประกอบ</h3>
                      <p className="text-sm text-gray-600">เพิ่มองค์ประกอบคุณภาพใหม่และกำหนดรายละเอียด</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">เพิ่มตัวบ่งชี้</h3>
                      <p className="text-sm text-gray-600">สร้างตัวบ่งชี้และกำหนดรายละเอียดสำหรับแต่ละองค์ประกอบ</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">ตรวจสอบและจัดการ</h3>
                      <p className="text-sm text-gray-600">ตรวจสอบความถูกต้องและจัดการข้อมูลที่มีอยู่</p>
                    </div>
                  </div>
                </div>
              </div>

              <DefineComponentSection />
            </div>
          );
        }
      case 'process':
        return <ProcessContent hasPermission={hasPermission} user={currentUser} />;
      case 'results':
        return <ResultsContent hasPermission={hasPermission} achievements={achievements} />;
      case 'summary':
        return <SummaryPage currentUser={currentUser} />;
      case 'committee':
        // Only Executive, SAR Manager, External Evaluator, Admin, QA Admin can access
        if (!['system_admin', 'sar_manager', 'executive', 'external_evaluator', 'qa_admin'].includes(role)) {
          return <div className="p-8 text-center text-red-600">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</div>;
        }
        return <CommitteeEvaluationPage currentUser={currentUser} />;
      case 'assessment_criteria':
        return <AssessmentPage currentUser={currentUser} setActiveTab={setActiveTab} assessmentMode="criteria" />;
      case 'assessment_evaluation':
        return <AssessmentPage currentUser={currentUser} setActiveTab={setActiveTab} assessmentMode="evaluation" />;
      case 'assessment_table':
        return <AssessmentTablePage setActiveTab={setActiveTab} />;
      case 'reports':
        return (
          <>
            <ReportsPage setActiveTab={setActiveTab} />
          </>
        );
      case 'dashboard':
        return <DashboardContent user={currentUser} />;
      case 'system_management':
        if (role !== 'system_admin') {
          return <div className="p-8 text-center text-red-600">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</div>;
        }
        return <SystemManagementPage setActiveTab={setActiveTab} />;
      case 'round_management':
        if (role !== 'system_admin') {
          return <div className="p-8 text-center text-red-600">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</div>;
        }
        return <RoundManagementPage setActiveTab={setActiveTab} />;
      case 'user_management':
        if (role !== 'system_admin') {
          return <div className="p-8 text-center text-red-600">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</div>;
        }
        return <UserManagementPage setActiveTab={setActiveTab} />;
      case 'database_management':
        if (role !== 'system_admin') {
          return <div className="p-8 text-center text-red-600">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</div>;
        }
        return <DatabaseManagementPage setActiveTab={setActiveTab} />;
      case 'program_management':
        if (role !== 'system_admin') {
          return <div className="p-8 text-center text-red-600">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</div>;
        }
        return <ProgramManagement setActiveTab={setActiveTab} />;
      default:
        return null;
    }
  };

  return (
    <ModalProvider>
      <div className="min-h-screen flex flex-col bg-slate-50 font-['Sarabun']">
        <ConnectionStatus />
        <Header
          isMenuOpen={isMenuOpen}
          setIsMenuOpen={setIsMenuOpen}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          currentUser={currentUser}
          handleLogout={handleLogout}
          setShowLogin={setShowLogin}
          rolePermissions={rolePermissions}
        />

        {activeTab === 'about' && (
          <HeroSection
            onGoResults={() => setActiveTab('summary')}
            onGoProcess={() => setActiveTab('process')}
            publicStats={publicStats}
          />
        )}

        <main className="flex-grow container mx-auto px-4 py-8">
          <TabContent />
        </main>

        {showLogin && (
          <LoginModal
            onLogin={(user) => {
              setCurrentUser(user);
              try { localStorage.setItem('currentUser', JSON.stringify(user)); } catch { }
              setShowLogin(false);
              setActiveTab('dashboard'); // เปลี่ยนไปหน้า dashboard หลังจากเข้าสู่ระบบ
            }}
            onClose={() => setShowLogin(false)}
          />
        )}

        <Footer />
      </div>
    </ModalProvider>
  );
}