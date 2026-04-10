import React, { useEffect, useMemo, useState } from 'react';
import {
  Layers, School, BookOpen, ChevronRight,
  Check, ArrowLeft, Target
} from 'lucide-react';
import { BASE_URL } from '../config/api.js';

export default function ProgramSelection({
  storageKey = 'programSelectionV2',
  onComplete,
  mode = 'manage', // 'manage' หรือ 'assess'
  buttonText = null // text สำหรับปุ่ม (ถ้าไม่ระบุจะใช้ default ตาม mode)
}) {
  const [step, setStep] = useState('level'); // level | faculty | major
  const [selectedLevelId, setSelectedLevelId] = useState('');
  const [selectedFacultyId, setSelectedFacultyId] = useState('');
  const [selectedMajorId, setSelectedMajorId] = useState('');

  // Data states
  const [levels, setLevels] = useState([]);
  const [faculties, setFaculties] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch all data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [lRes, fRes, pRes] = await Promise.all([
          fetch(`${BASE_URL}/api/levels`),
          fetch(`${BASE_URL}/api/faculties`),
          fetch(`${BASE_URL}/api/programs`)
        ]);
        if (lRes.ok) setLevels(await lRes.json());
        if (fRes.ok) setFaculties(await fRes.json());
        if (pRes.ok) setPrograms(await pRes.json());
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Load from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setStep(parsed.step || 'level');
        setSelectedLevelId(parsed.selectedLevelId || '');
        setSelectedFacultyId(parsed.selectedFacultyId || '');
        setSelectedMajorId(parsed.selectedMajorId || '');
      }
    } catch { }
  }, [storageKey]);

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        step,
        selectedLevelId,
        selectedFacultyId,
        selectedMajorId,
      }));
    } catch { }
  }, [step, selectedLevelId, selectedFacultyId, selectedMajorId, storageKey]);

  const selectedLevel = useMemo(
    () => levels.find(l => l.id === selectedLevelId) || null,
    [levels, selectedLevelId]
  );

  const selectedFaculty = useMemo(
    () => faculties.find(f => f.id === selectedFacultyId) || null,
    [faculties, selectedFacultyId]
  );

  const facultiesForSelectedLevel = useMemo(() => {
    if (!selectedLevelId) return [];
    return faculties;
  }, [faculties, selectedLevelId]);

  const majorsForSelectedFaculty = useMemo(() => {
    if (!selectedFacultyId) return [];

    // Filter programs strictly by facultyId
    // We use a Map to ensure unique major names if they were duplicated in legacy data
    const uniqueMajors = new Map();

    programs
      .filter(p => String(p.facultyId) === String(selectedFacultyId))
      .forEach(p => {
        if (!uniqueMajors.has(p.majorName)) {
          uniqueMajors.set(p.majorName, {
            id: p.id,
            majorId: p.majorId,
            name: p.majorName
          });
        }
      });

    return Array.from(uniqueMajors.values());
  }, [programs, selectedFacultyId]);

  const selectedMajor = useMemo(
    () => majorsForSelectedFaculty.find(m => m.id === selectedMajorId) || null,
    [majorsForSelectedFaculty, selectedMajorId]
  );

  const getButtonText = () => {
    if (buttonText) return buttonText;
    switch (mode) {
      case 'assess': return 'เข้าสู่การประเมิน';
      case 'manage':
      default: return 'เลือกสาขาเพื่อจัดการ';
    }
  };

  const onChooseLevel = (levelId) => {
    setSelectedLevelId(levelId);
    setStep('faculty');
  };

  const onChooseFaculty = (facId) => {
    setSelectedFacultyId(facId);
    setSelectedMajorId('');
    setStep('major');
  };

  const onChooseMajor = (majId) => {
    setSelectedMajorId(majId);
  };

  const resetToLevel = () => {
    setStep('level');
    setSelectedLevelId('');
    setSelectedFacultyId('');
    setSelectedMajorId('');
  };

  const backOne = () => {
    if (step === 'major') setStep('faculty');
    else if (step === 'faculty') setStep('level');
  };

  if (loading) {
    return <div className="p-12 text-center text-blue-500 font-prompt animate-pulse">กำลังโหลดข้อมูลหลักสูตร...</div>;
  }

  return (
    <div className="space-y-8 font-prompt">
      {/* Breadcrumbs */}
      <div className="text-xs font-bold text-gray-400 flex items-center gap-2 uppercase tracking-widest">
        <button className={`${step === 'level' ? 'text-blue-600' : 'hover:text-blue-400'}`} onClick={resetToLevel}>ระดับ</button>
        <ChevronRight className="w-3 h-3" />
        <button
          disabled={!selectedLevelId}
          className={`${step === 'faculty' ? 'text-blue-600' : selectedLevelId ? 'hover:text-blue-400' : 'opacity-50'}`}
          onClick={() => setStep('faculty')}
        >
          คณะ
        </button>
        <ChevronRight className="w-3 h-3" />
        <span className={`${step === 'major' ? 'text-blue-600' : 'opacity-50'}`}>สาขา / หลักสูตร</span>
      </div>

      {/* Step: Level */}
      {step === 'level' && (
        <section className="bg-white rounded-2xl shadow-sm p-8 border border-gray-100 animate-in fade-in slide-in-from-bottom-2">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-2xl">
              <Layers className="w-6 h-6 text-blue-600" />
            </div>
            เลือกระดับการศึกษา
          </h2>
          {levels.length === 0 ? (
            <div className="py-12 text-center bg-gray-50 rounded-2xl">
              <p className="text-sm text-gray-400">ยังไม่มีข้อมูลระดับในระบบ</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {levels.map(item => (
                <button
                  key={item.id}
                  className="w-full text-left px-6 py-5 rounded-2xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/50 hover:shadow-md transition-all font-bold group flex justify-between items-center"
                  onClick={() => onChooseLevel(item.id)}
                >
                  <span className="text-gray-700 group-hover:text-blue-700">{item.name}</span>
                  <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-400 transition-transform group-hover:translate-x-1" />
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Step: Faculty */}
      {step === 'faculty' && (
        <section className="bg-white rounded-2xl shadow-sm p-8 border border-gray-100 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-2xl">
                <School className="w-6 h-6 text-blue-600" />
              </div>
              เลือกคณะ
            </h2>
            <button onClick={backOne} className="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-full transition-colors">
              <ArrowLeft className="w-4 h-4" />
              ย้อนกลับ
            </button>
          </div>
          {facultiesForSelectedLevel.length === 0 ? (
            <div className="py-12 text-center bg-gray-50 rounded-2xl">
              <p className="text-sm text-gray-400">ยังไม่มีข้อมูลคณะในระบบ</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {facultiesForSelectedLevel.map(f => (
                <button
                  key={f.id}
                  className="w-full text-left px-6 py-5 rounded-2xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/50 hover:shadow-md transition-all font-bold group flex justify-between items-center"
                  onClick={() => onChooseFaculty(f.id)}
                >
                  <span className="text-gray-700 group-hover:text-blue-700">{f.name}</span>
                  <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-400 transition-transform group-hover:translate-x-1" />
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Step: Major */}
      {step === 'major' && (
        <section className="bg-white rounded-2xl shadow-sm p-8 border border-gray-100 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
              <div className="p-2 bg-emerald-50 rounded-2xl">
                <BookOpen className="w-6 h-6 text-emerald-600" />
              </div>
              เลือกสาขาวิชา / หลักสูตร
            </h2>
            <button onClick={backOne} className="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-full transition-colors">
              <ArrowLeft className="w-4 h-4" />
              ย้อนกลับ
            </button>
          </div>

          {majorsForSelectedFaculty.length === 0 ? (
            <div className="py-12 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-100">
              <p className="text-sm text-gray-400">ยังไม่มีรายการสาขาสำหรับ "{selectedFaculty?.name}"</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {majorsForSelectedFaculty.map(m => (
                <button
                  key={m.id}
                  className={`w-full text-left px-6 py-5 rounded-2xl border transition-all font-bold flex justify-between items-center group ${selectedMajorId === m.id
                    ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                    : 'border-gray-100 hover:border-blue-200 hover:bg-blue-50/30'
                    }`}
                  onClick={() => onChooseMajor(m.id)}
                >
                  <span className="flex items-center gap-3">
                    {m.name}
                  </span>
                  {selectedMajorId === m.id ? (
                    <div className="bg-blue-600 p-1.5 rounded-full">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-200 group-hover:text-blue-400" />
                  )}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Summary Card */}
      <section className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-3xl shadow-xl p-8 text-white relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-blue-500/20 rounded-full -ml-10 -mb-10 blur-2xl"></div>

        <h2 className="text-xl font-bold mb-6 flex items-center gap-3 relative z-10">
          <Target className="w-6 h-6" />
          สรุปการทำรายการ
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 relative z-10">
          <div className="p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20">
            <span className="text-[10px] font-black text-blue-200 block uppercase tracking-widest mb-2">ระดับการศึกษา</span>
            <span className="text-sm font-bold">{selectedLevel?.name || '---'}</span>
          </div>
          <div className="p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20">
            <span className="text-[10px] font-black text-blue-200 block uppercase tracking-widest mb-2">คณะ / สังกัด</span>
            <span className="text-sm font-bold">{selectedFaculty?.name || '---'}</span>
          </div>
          <div className="p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20">
            <span className="text-[10px] font-black text-blue-200 block uppercase tracking-widest mb-2">สาขาวิชา / หลักสูตร</span>
            <span className="text-sm font-bold">{selectedMajor?.name || '---'}</span>
          </div>
        </div>

        <button
          className={`w-full py-5 rounded-2xl text-lg font-black transition-all shadow-lg flex items-center justify-center gap-3 relative z-10 ${selectedLevelId && selectedFacultyId && selectedMajorId
            ? 'bg-white text-blue-700 hover:bg-neutral-50 hover:scale-[1.01] active:scale-[0.99]'
            : 'bg-white/20 text-white/50 cursor-not-allowed border border-white/20'
            }`}
          disabled={!(selectedLevelId && selectedFacultyId && selectedMajorId)}
          onClick={() => {
            if (onComplete) {
              onComplete({
                levelId: selectedLevelId,
                facultyId: selectedFacultyId,
                majorId: selectedMajor?.majorId,
                facultyName: selectedFaculty?.name,
                majorName: selectedMajor?.name,
              });
            }
          }}
        >
          {getButtonText()}
          <ChevronRight className="w-6 h-6" />
        </button>
      </section>
    </div>
  );
}
