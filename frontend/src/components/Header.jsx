// src/components/Header.jsx
import React, { useState } from 'react';
import { GraduationCap, Menu, X, LogOut, ChevronDown, Shield } from 'lucide-react';

export default function Header({
  isMenuOpen, setIsMenuOpen, activeTab, setActiveTab,
  currentUser, handleLogout, setShowLogin, rolePermissions
}) {
  const [logoOk, setLogoOk] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const isManageFlowActive = activeTab === 'programs' || activeTab === 'manage';

  const navigation = [
    { name: 'เกี่ยวกับ', tab: 'about' },
    { name: 'ขั้นตอน', tab: 'process' },
  ];

  if (currentUser) {
    const role = currentUser.role;

    // แดชบอร์ด (Admin, Executive, SAR Manager, QA Admin)
    if (['system_admin', 'executive', 'sar_manager', 'qa_admin'].includes(role)) {
      navigation.push({ name: 'แดชบอร์ด', tab: 'dashboard' });
    }

    // จัดการองค์ประกอบพื้นฐาน (Admin, QA Admin)
    if (['system_admin', 'qa_admin'].includes(role)) {
      navigation.push({ name: 'จัดการองค์ประกอบ', tab: 'programs', active: isManageFlowActive });
    }

    // กำหนดค่าเป้าหมาย (Admin, SAR Manager)
    if (['system_admin', 'sar_manager'].includes(role)) {
      navigation.push({ name: 'กำหนดค่าเป้าหมาย', tab: 'assessment_criteria' });
    }

    // ผลการดำเนินการ (Reporter, Admin, SAR Manager, QA Admin)
    if (['system_admin', 'reporter', 'sar_manager', 'qa_admin'].includes(role)) {
      navigation.push({ name: 'ผลดำเนินงาน', tab: 'assessment_evaluation' });
    }

    // ประเมิน (External Evaluator, SAR Manager, Admin)
    if (['system_admin', 'sar_manager', 'external_evaluator'].includes(role)) {
      navigation.push({ name: 'ผลการประเมิน', tab: 'committee' });
    }

    // รายงานและสรุป (ทุกคน)
    navigation.push({ name: 'สรุปผล', tab: 'summary' });
    navigation.push({ name: 'รายงาน', tab: 'reports' });
  } else {
    // Guest Navigation
    navigation.push({ name: 'สรุปผล', tab: 'summary' });
  }

  return (
    <header className="bg-white/95 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Brand */}
          <div className="flex items-center space-x-2 flex-shrink-0">
            <div className="p-1.5 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100">
              {logoOk ? (
                <img
                  src="/rmutsv-logo.png"
                  alt="RMUTSV Logo"
                  className="w-7 h-7 object-contain"
                  onError={() => setLogoOk(false)}
                />
              ) : (
                <GraduationCap className="w-5 h-5 text-blue-600" />
              )}
            </div>
            <div className="hidden xl:block">
              <h1 className="text-[15px] font-bold text-gray-900 leading-tight">มหาวิทยาลัยเทคโนโลยีราชมงคลศรีวิชัย</h1>
              <p className="text-[11px] text-gray-600 font-medium whitespace-nowrap">ระบบประกันคุณภาพ AUN-QA</p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-0.5 ml-auto mr-4">
            {navigation.map((item) => (
              <button
                key={item.tab}
                onClick={() => setActiveTab(item.tab)}
                className={`px-3 py-2 rounded-2xl text-[13px] font-bold whitespace-nowrap transition-all duration-200 ${(item.active ? item.active : activeTab === item.tab)
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
              >
                {item.name}
              </button>
            ))}
          </nav>

          {/* User Section */}
          <div className="flex items-center space-x-2 flex-shrink-0">
            {currentUser ? (
              <div className="relative">
                <button
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="flex items-center space-x-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-all duration-200 border border-transparent hover:border-gray-200 group"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium shadow-sm transition-transform group-hover:scale-105 ${rolePermissions[currentUser.role]?.color || 'bg-gray-400'
                    }`}>
                    {(currentUser.full_name || currentUser.name)?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <div className="hidden md:block text-left">
                    <div className="text-sm font-semibold text-gray-900 leading-tight">{currentUser.full_name || currentUser.name}</div>
                    <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">{rolePermissions[currentUser.role]?.name || 'สมาชิก'}</div>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isProfileOpen ? 'rotate-180' : ''}`} />
                </button>

                {isProfileOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setIsProfileOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-43 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-20 animate-in fade-in zoom-in-95 duration-100">
                      <div className="px-4 py-2 border-b border-gray-50 md:hidden">
                        <p className="text-sm font-medium text-gray-900 truncate">{currentUser.full_name || currentUser.name}</p>
                        <p className="text-xs text-gray-500">{rolePermissions[currentUser.role]?.name || 'สมาชิก'}</p>
                      </div>

                      {currentUser.role === 'system_admin' && (
                        <button
                          onClick={() => {
                            setActiveTab('system_management');
                            setIsProfileOpen(false);
                          }}
                          className="w-full flex items-center space-x-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left font-medium border-b border-gray-50"
                        >
                          <div className="p-1.5 bg-indigo-50 rounded-2xl">
                            <Shield className="w-4 h-4 text-indigo-600" />
                          </div>
                          <span>จัดการระบบ</span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          handleLogout();
                          setIsProfileOpen(false);
                        }}
                        className="w-full flex items-center space-x-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors text-left font-medium"
                      >
                        <div className="p-1.5 bg-red-100 rounded-2xl">
                          <LogOut className="w-4 h-4" />
                        </div>
                        <span className="whitespace-nowrap">ออกจากระบบ</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button
                onClick={() => setShowLogin(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-2xl text-sm font-medium hover:bg-blue-700 transition-all duration-200 transform hover:scale-105 shadow-sm hover:shadow-md"
              >
                เข้าสู่ระบบ
              </button>
            )}

            {/* Mobile Menu Button */}
            <button
              className="lg:hidden p-2 rounded-2xl hover:bg-gray-100 transition-colors"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="lg:hidden border-t border-gray-200 py-4 animate-in slide-in-from-top duration-200">
            <nav className="space-y-1">
              {navigation.map((item) => (
                <button
                  key={item.tab}
                  onClick={() => {
                    setActiveTab(item.tab);
                    setIsMenuOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3 rounded-2xl text-sm font-medium transition-colors ${(item.active ? item.active : activeTab === item.tab)
                    ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-600'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                >
                  {item.name}
                </button>
              ))}

              {currentUser && (
                <div className="border-t border-gray-200 mt-4 pt-4">
                  <div className="px-4 py-3 bg-gray-50 rounded-2xl mb-3">
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium ${rolePermissions[currentUser.role]?.color || 'bg-gray-400'
                        }`}>
                        {(currentUser.full_name || currentUser.name)?.charAt(0)?.toUpperCase() || 'U'}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{currentUser.full_name || currentUser.name}</div>
                        <div className="text-xs text-gray-500">{rolePermissions[currentUser.role]?.name || 'สมาชิก'}</div>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      handleLogout();
                      setIsMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-3 text-sm text-red-600 hover:bg-red-50 rounded-2xl transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>ออกจากระบบ</span>
                  </button>
                </div>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}