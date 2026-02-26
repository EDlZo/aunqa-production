import React, { useEffect, useMemo, useState } from 'react';

const ASSESSMENT_PROGRAMS = [
  {
    id: 'computer-engineering',
    name: 'วิศวกรรมคอมพิวเตอร์',
    faculty: 'คณะวิศวกรรมศาสตร์'
  },
  {
    id: 'computer-engineering-ai',
    name: 'วิศวกรรมคอมพิวเตอร์ปัญญาประดิษฐ์ (AI)',
    faculty: 'คณะวิศวกรรมศาสตร์'
  }
];

export default function AssessmentProgramSelection({ onProgramSelect }) {
  const [selectedProgram, setSelectedProgram] = useState(null);

  // โหลดข้อมูลจาก localStorage เมื่อ component mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('assessmentSelectedProgram');
      if (saved) {
        const parsedProgram = JSON.parse(saved);
        setSelectedProgram(parsedProgram);
        // ส่งข้อมูลไปยัง parent component ทันที
        if (onProgramSelect) {
          onProgramSelect(parsedProgram);
        }
      }
    } catch (error) {
      console.error('Error loading saved program:', error);
    }
  }, [onProgramSelect]);

  const handleSelectProgram = (program) => {
    console.log('🎯 AssessmentProgramSelection: Program selected:', program);

    setSelectedProgram(program);

    // บันทึกลง localStorage
    localStorage.setItem('assessmentSelectedProgram', JSON.stringify(program));

    // ส่งข้อมูลไปยัง parent component
    if (onProgramSelect) {
      console.log('📤 Calling onProgramSelect...');
      onProgramSelect(program);
    }
  };

  const handleReset = () => {
    setSelectedProgram(null);
    localStorage.removeItem('assessmentSelectedProgram');
    if (onProgramSelect) {
      onProgramSelect(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-md p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">เลือกสาขาที่ต้องการประเมิน</h2>

      {/* แสดงผลการเลือก */}
      {selectedProgram && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-green-900">สาขาที่เลือก</h3>
              <p className="text-green-700">{selectedProgram.name}</p>
              <p className="text-sm text-green-600">{selectedProgram.faculty}</p>
            </div>
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              เปลี่ยนสาขา
            </button>
          </div>
        </div>
      )}

      {/* รายการสาขา */}
      {!selectedProgram && (
        <div className="space-y-3">
          {ASSESSMENT_PROGRAMS.map((program) => (
            <button
              key={program.id}
              onClick={() => handleSelectProgram(program)}
              className="w-full text-left p-4 border border-gray-200 rounded-2xl hover:border-blue-300 hover:bg-blue-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">{program.name}</h3>
                  <p className="text-sm text-gray-600">{program.faculty}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* คำอธิบาย */}
      <div className="mt-6 p-4 bg-gray-50 rounded-2xl">
        <p className="text-sm text-gray-600">
          💡 <strong>หมายเหตุ:</strong> หลังจากเลือกสาขาแล้ว ระบบจะแสดงส่วนการเริ่มประเมินผลด้านล่าง
        </p>
      </div>
    </div>
  );
}