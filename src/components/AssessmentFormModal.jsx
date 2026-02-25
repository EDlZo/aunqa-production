// src/components/AssessmentFormModal.jsx
import React, { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useModal } from '../context/ModalContext';
import { BASE_URL } from '../config/api.js';


export default function AssessmentFormModal({ indicator, selectedProgram, onComplete, onCancel, activeYear }) {
  const { showAlert } = useModal();
  const [targetValue, setTargetValue] = useState('');
  const [score, setScore] = useState('');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [evaluationHistory, setEvaluationHistory] = useState([]);

  useEffect(() => {
    // โหลดข้อมูลการประเมินเดิม (ถ้ามี)
    fetchExistingEvaluation();
    // โหลดประวัติการประเมิน
    fetchEvaluationHistory();
  }, [indicator]);

  const fetchExistingEvaluation = async () => {
    try {
      let sessionId = localStorage.getItem('assessment_session_id') || '';
      // normalize milliseconds to seconds if needed
      const altId = sessionId && sessionId.length > 10 ? String(Math.floor(Number(sessionId) / 1000)) : '';
      const major = selectedProgram?.majorName || selectedProgram?.major_name || '';
      const qs = new URLSearchParams({ session_id: sessionId, major_name: major }).toString();

      let res = await fetch(`${BASE_URL}/api/evaluations/history?${qs}`);
      if (res.ok) {
        let evaluations = await res.json();
        let list = (Array.isArray(evaluations) ? evaluations : []).filter(ev => !sessionId || String(ev.session_id) === String(sessionId));
        // try altId (seconds) if nothing matches
        if (list.length === 0 && altId) {
          list = (Array.isArray(evaluations) ? evaluations : []).filter(ev => String(ev.session_id) === altId);
          if (list.length > 0) {
            sessionId = altId;
            try { localStorage.setItem('assessment_session_id', altId); } catch { }
          }
        }
        let evaluation = list.find(ev => String(ev.indicator_id) === String(indicator.id));
        if (!evaluation) {
          const resLegacy = await fetch(`${BASE_URL}/api/evaluations/history?${new URLSearchParams({ session_id: '2147483647', major_name: major }).toString()}`);
          if (resLegacy.ok) {
            const rows = await resLegacy.json();
            evaluation = (Array.isArray(rows) ? rows : []).find(ev => String(ev.indicator_id) === String(indicator.id));
          }
        }
        if (evaluation) {
          setTargetValue(evaluation.target_value || '');
          setScore(evaluation.score || '');
          setComment(evaluation.comment || '');
        }
      }
    } catch (error) {
      console.error('Error fetching existing evaluation:', error);
    }
  };

  const fetchEvaluationHistory = async () => {
    try {
      let sessionId = localStorage.getItem('assessment_session_id') || '';
      const altId = sessionId && sessionId.length > 10 ? String(Math.floor(Number(sessionId) / 1000)) : '';
      const major = selectedProgram?.majorName || selectedProgram?.major_name || '';
      const qs = new URLSearchParams({ session_id: sessionId, major_name: major }).toString();

      let res = await fetch(`${BASE_URL}/api/evaluations/history?${qs}`);
      if (res.ok) {
        let evaluations = await res.json();
        let filtered = (Array.isArray(evaluations) ? evaluations : []).filter(ev => !sessionId || String(ev.session_id) === String(sessionId));
        if (filtered.length === 0 && altId) {
          filtered = (Array.isArray(evaluations) ? evaluations : []).filter(ev => String(ev.session_id) === altId);
          if (filtered.length > 0) {
            try { localStorage.setItem('assessment_session_id', altId); } catch { }
          }
        }
        if (filtered.length === 0) {
          const resLegacy = await fetch(`${BASE_URL}/api/evaluations/history?${new URLSearchParams({ session_id: '2147483647', major_name: major }).toString()}`);
          if (resLegacy.ok) filtered = await resLegacy.json();
        }
        const history = (Array.isArray(filtered) ? filtered : [])
          .filter(ev => String(ev.indicator_id) === String(indicator.id))
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
        setEvaluationHistory(history);
      }
    } catch (error) {
      console.error('Error fetching evaluation history:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const sessionId = localStorage.getItem('assessment_session_id') || '';
      const major = selectedProgram?.majorName || selectedProgram?.major_name || '';

      const formData = new FormData();
      formData.append('session_id', sessionId);
      formData.append('indicator_id', indicator.id);
      formData.append('score', score);
      formData.append('target_value', targetValue);
      formData.append('comment', comment);
      formData.append('status', 'draft');
      formData.append('major_name', major);
      if (activeYear) formData.append('year', activeYear);

      if (activeYear) formData.append('year', activeYear);

      const res = await fetch(`${BASE_URL}/api/evaluations`, {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        onComplete();
      } else {
        showAlert({ title: 'ข้อผิดพลาด', message: 'บันทึกการประเมินไม่สำเร็จ', type: 'error' });
      }
    } catch (error) {
      console.error('Error submitting evaluation:', error);
      showAlert({ title: 'ข้อผิดพลาด', message: 'เกิดข้อผิดพลาดในการบันทึก', type: 'error' });
    }

    setLoading(false);
  };


  return (
    <div className="bg-white rounded-lg shadow-md">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">ผลการดำเนินการ</h3>
          <p className="text-sm text-gray-600 mt-1">
            {indicator.sequence} : {indicator.indicator_name}
          </p>
        </div>
        <button
          onClick={onCancel}
          className="flex items-center text-gray-500 hover:text-gray-700 mb-2 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 mr-1" />
          กลับ
        </button>
      </div>

      <div className="p-6">
        {/* ข้อมูลตัวบ่งชี้ */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-500">ชนิดตัวบ่งชี้</div>
              <div className="font-medium">{indicator.indicator_type || '-'}</div>
            </div>
            <div>
              <div className="text-gray-500">ชนิดเกณฑ์มาตรฐาน</div>
              <div className="font-medium">{indicator.criteria_type || '-'}</div>
            </div>
          </div>
        </div>

        {/* เกณฑ์การประเมิน */}
        <div className="mb-6">
          <h4 className="text-md font-medium text-gray-900 mb-3">เกณฑ์การประเมิน</h4>
          <div className="overflow-x-auto">
            <table className="w-full border border-gray-200">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-200 px-4 py-2 text-center font-medium text-gray-700">ระดับ 1</th>
                  <th className="border border-gray-200 px-4 py-2 text-center font-medium text-gray-700">ระดับ 2</th>
                  <th className="border border-gray-200 px-4 py-2 text-center font-medium text-gray-700">ระดับ 3</th>
                  <th className="border border-gray-200 px-4 py-2 text-center font-medium text-gray-700">ระดับ 4</th>
                  <th className="border border-gray-200 px-4 py-2 text-center font-medium text-gray-700">ระดับ 5</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-200 px-4 py-2 text-sm text-gray-600">มีการดำเนินงานระดับ 1</td>
                  <td className="border border-gray-200 px-4 py-2 text-sm text-gray-600">มีการดำเนินงานระดับ 2</td>
                  <td className="border border-gray-200 px-4 py-2 text-sm text-gray-600">มีการดำเนินงานระดับ 3</td>
                  <td className="border border-gray-200 px-4 py-2 text-sm text-gray-600">มีการดำเนินงานระดับ 4</td>
                  <td className="border border-gray-200 px-4 py-2 text-sm text-gray-600">มีการดำเนินงานระดับ 5-7</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ฟอร์มการประเมิน */}
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ค่าเป้าหมาย <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="กรอกค่าเป้าหมาย"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                คะแนนการประเมิน <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                max="5"
                step="0.1"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.0 - 5.0"
                required
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">หมายเหตุ</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows="4"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="กรอกหมายเหตุเพิ่มเติม (ถ้ามี)"
            />
          </div>


          {/* ปุ่มดำเนินการ */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-gray-600 text-white py-2 rounded-md hover:bg-gray-700 transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-green-600 text-white py-2 rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'กำลังบันทึก...' : 'บันทึกการประเมิน'}
            </button>
          </div>
        </form>

        {/* ประวัติการประเมิน */}
        {evaluationHistory.length > 0 && (
          <div className="mt-8 border-t border-gray-200 pt-6">
            <h4 className="text-md font-medium text-gray-900 mb-4">
              ประวัติการประเมิน ({evaluationHistory.length} ครั้ง)
            </h4>
            <div className="space-y-4">
              {evaluationHistory.map((evaluation, index) => (
                <div key={evaluation.evaluation_id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-sm font-medium text-gray-900">
                      การประเมินครั้งที่ {evaluationHistory.length - index}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(evaluation.created_at).toLocaleString('th-TH')}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">ค่าเป้าหมาย</label>
                      <div className="text-sm text-gray-900 bg-white px-3 py-2 rounded border">
                        {evaluation.target_value || '-'}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">คะแนน</label>
                      <div className="text-sm text-gray-900 bg-white px-3 py-2 rounded border">
                        {evaluation.score || '-'}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">หมายเหตุ</label>
                      <div className="text-sm text-gray-900 bg-white px-3 py-2 rounded border">
                        {evaluation.comment || '-'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}