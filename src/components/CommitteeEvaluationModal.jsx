import React, { useState, useEffect } from 'react';
import RichTextEditor from './RichTextEditor.jsx';
import { useModal } from '../context/ModalContext';

export default function CommitteeEvaluationModal({ indicator, selectedProgram, onComplete, onCancel }) {
  const { showAlert } = useModal();
  const [committeeScore, setCommitteeScore] = useState('');
  const [strengths, setStrengths] = useState('');
  const [improvements, setImprovements] = useState('');
  const [loading, setLoading] = useState(false);
  const [existingEvaluation, setExistingEvaluation] = useState(null);

  useEffect(() => {
    fetchExistingEvaluation();
  }, [indicator]);

  const fetchExistingEvaluation = async () => {
    if (!indicator || !selectedProgram) return;

    try {
      const response = await fetch(`/api/committee-evaluations?indicator_id=${indicator.id}&major_name=${encodeURIComponent(selectedProgram.major_name)}&session_id=${selectedProgram.session_id}`);
      if (response.ok) {
        const data = await response.json();
        if (data.length > 0) {
          const latest = data[0];
          setExistingEvaluation(latest);
          setCommitteeScore(latest.committee_score || '');
          setStrengths(latest.strengths || '');
          setImprovements(latest.improvements || '');
        }
      }
    } catch (error) {
      console.error('Error fetching existing evaluation:', error);
    }
  };

  const handleSubmit = async () => {
    if (!committeeScore) {
      showAlert({
        title: 'ข้อมูลไม่ครบถ้วน',
        message: 'กรุณากรอกคะแนนประเมิน',
        type: 'warning'
      });
      return;
    }

    setLoading(true);
    try {
      const evaluationData = {
        indicator_id: indicator.id,
        major_name: selectedProgram.major_name,
        session_id: selectedProgram.session_id,
        committee_score: committeeScore,
        strengths: strengths,
        improvements: improvements
      };

      const response = await fetch('/api/committee-evaluations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(evaluationData),
      });

      if (response.ok) {
        onComplete();
      } else {
        const errorData = await response.json();
        showAlert({
          title: 'ข้อผิดพลาด',
          message: `เกิดข้อผิดพลาด: ${errorData.error || 'ไม่สามารถบันทึกข้อมูลได้'}`,
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Error submitting evaluation:', error);
      showAlert({
        title: 'ข้อผิดพลาด',
        message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">ประเมินผลโดยกรรมการ</h3>
              <p className="text-sm text-gray-600 mt-1">
                {indicator?.indicator_name}
              </p>
            </div>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-6">
          {/* คะแนนประเมิน (กรรมการ) */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              คะแนนประเมิน (กรรมการ)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="5"
              value={committeeScore}
              onChange={(e) => setCommitteeScore(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="กรอกคะแนน 0-5"
            />
          </div>

          {/* Strengths (จุดแข็ง) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Strengths (จุดแข็ง)
            </label>
            <div className="border border-gray-300 rounded-md">
              <RichTextEditor
                value={strengths}
                onChange={setStrengths}
                placeholder="ระบุจุดแข็งของตัวบ่งชี้..."
              />
            </div>
          </div>

          {/* Areas for Improvement (เรื่องที่พัฒนา/ปรับปรุงได้) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Areas for Improvement (เรื่องที่พัฒนา/ปรับปรุงได้)
            </label>
            <div className="border border-gray-300 rounded-md">
              <RichTextEditor
                value={improvements}
                onChange={setImprovements}
                placeholder="ระบุเรื่องที่ควรพัฒนา/ปรับปรุง..."
              />
            </div>
          </div>

          {/* ข้อมูลเพิ่มเติม */}
          {existingEvaluation && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
              <h4 className="text-sm font-medium text-blue-900 mb-2">ข้อมูลการประเมินเดิม</h4>
              <div className="text-xs text-blue-700">
                <p>บันทึกล่าสุด: {new Date(existingEvaluation.created_at).toLocaleString('th-TH')}</p>
                {existingEvaluation.committee_score && (
                  <p>คะแนนเดิม: {existingEvaluation.committee_score}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 disabled:opacity-50"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'กำลังบันทึก...' : 'บันทึกการประเมิน'}
          </button>
        </div>
      </div>
    </div>
  );
}
