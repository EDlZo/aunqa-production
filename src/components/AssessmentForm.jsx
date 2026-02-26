// src/components/AssessmentForm.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, X, CheckCircle, AlertCircle, FileText, Target } from 'lucide-react';
import Header from './Header';
import Footer from './Footer';
import { BASE_URL } from '../config/api.js';


export default function AssessmentForm() {
  const { indicatorId } = useParams();
  const navigate = useNavigate();

  const [indicator, setIndicator] = useState(null);
  const [targetText, setTargetText] = useState('');
  const [score, setScore] = useState('');
  const [comment, setComment] = useState('');
  const [flash, setFlash] = useState({ message: '', type: 'success' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const sessionId = localStorage.getItem('assessment_session_id') || '';
    const sel = localStorage.getItem('selectedProgramContext');
    const major = sel ? (JSON.parse(sel)?.majorName || '') : '';
    const qs = new URLSearchParams({ session_id: sessionId, major_name: major }).toString();

    fetch(`${BASE_URL}/api/indicators/${indicatorId}?${qs}`)
      .then(res => res.json())
      .then(data => setIndicator(data))
      .catch(() => setIndicator(null));
  }, [indicatorId]);

  useEffect(() => {
    if (!flash.message) return;
    const t = setTimeout(() => setFlash({ message: '', type: 'success' }), 3000);
    return () => clearTimeout(t);
  }, [flash.message]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const sessionId = localStorage.getItem('assessment_session_id') || '';
    const sel = localStorage.getItem('selectedProgramContext');
    const major = sel ? (JSON.parse(sel)?.majorName || '') : '';

    const formData = new FormData();
    formData.append('session_id', sessionId);
    formData.append('indicator_id', indicatorId);
    formData.append('score', score);
    formData.append('comment', comment);
    formData.append('status', 'submitted');
    formData.append('major_name', major);

    try {
      const res = await fetch(`${BASE_URL}/api/evaluations`, {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        setFlash({ message: 'บันทึกเกณฑ์การประเมินเรียบร้อย', type: 'success' });
        setTimeout(() => navigate(-1), 1500);
      } else {
        setFlash({ message: 'บันทึกไม่สำเร็จ กรุณาลองใหม่', type: 'error' });
      }
    } catch {
      setFlash({ message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!indicator) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">กำลังโหลดข้อมูลตัวบ่งชี้...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header isMenuOpen={false} setIsMenuOpen={() => { }}
        activeTab={''} setActiveTab={() => { }}
        currentUser={null} handleLogout={() => { }}
        setShowLogin={() => { }} rolePermissions={{}} />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl" style={{ backgroundColor: 'gray-50' }}>
        {/* Header Section */}
        <div className="mb-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center text-gray-500 hover:text-gray-700 mb-2 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-1" />
            กลับ
          </button>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-3">
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-medium">
                    ตัวบ่งชี้ที่ {indicator.sequence}
                  </span>
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-sm">
                    {indicator.indicator_type || '-'}
                  </span>
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  {indicator.indicator_name}
                </h1>
                <p className="text-gray-600">
                  ชนิดเกณฑ์มาตรฐาน: {indicator.criteria_type || '-'}
                </p>
              </div>
              <div className="hidden sm:block">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl flex items-center justify-center border border-blue-100">
                  <Target className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Flash Message */}
        {flash.message && (
          <div className={
            "mb-6 rounded-xl p-4 border border-gray-200 flex items-center justify-between " +
            (flash.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800')
          }>
            <div className="flex items-center">
              {flash.type === 'success' ? (
                <CheckCircle className="w-5 h-5 mr-3" />
              ) : (
                <AlertCircle className="w-5 h-5 mr-3" />
              )}
              <span className="font-medium">{flash.message}</span>
            </div>
            <button
              onClick={() => setFlash({ message: '', type: 'success' })}
              className="ml-4 hover:opacity-70 transition-opacity"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Form Section */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
              <FileText className="w-5 h-5 mr-2 text-gray-600" />
              รายละเอียดการประเมิน
            </h2>

            <div className="space-y-6">
              {/* Target Text */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  เกณฑ์มาตรฐาน <span className="text-red-500">*</span>
                </label>
                <textarea
                  className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all"
                  rows="4"
                  placeholder="รายละเอียดเกณฑ์/ค่าเป้าหมาย..."
                  value={targetText}
                  onChange={(e) => setTargetText(e.target.value)}
                  required
                />
              </div>

              {/* Score Input */}
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    คะแนน <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="5"
                      step="0.1"
                      className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="0.0 - 5.0"
                      value={score}
                      onChange={(e) => setScore(e.target.value)}
                      required
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-gray-500">
                      / 5.0
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">กรุณาใส่คะแนนระหว่าง 0.0 - 5.0</p>
                </div>

                {/* Quick Score Buttons */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    คะแนนด่วน
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {[0, 1, 2, 3, 4, 5].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setScore(num.toString())}
                        className={
                          "py-2 px-3 rounded-2xl border border-gray-300 text-sm font-medium transition-all " +
                          (score === num.toString()
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50')
                        }
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Comment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  หมายเหตุเพิ่มเติม
                </label>
                <textarea
                  className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all"
                  rows="4"
                  placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex-1 px-6 py-3 bg-white text-gray-700 font-medium rounded-2xl border border-gray-300 hover:bg-gray-50 transition-all duration-200"
              disabled={isSubmitting}
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !targetText || !score}
              className="flex-1 px-6 py-3 bg-blue-600 text-white font-medium rounded-2xl hover:bg-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  กำลังบันทึก...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  บันทึกการประเมิน
                </>
              )}
            </button>
          </div>
        </form>
      </main>

      <Footer />
    </div>
  );
}
