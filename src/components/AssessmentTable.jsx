// src/components/AssessmentTable.jsx
import React, { useState, useEffect } from 'react';
import AssessmentFormModal from './AssessmentFormModal';
import EvaluationFormModal from './EvaluationFormModal';
import { BASE_URL } from '../config/api.js';
import { ArrowLeft, MessageSquare } from 'lucide-react';
import { useModal } from '../context/ModalContext';


export default function AssessmentTable({ selectedComponent, indicators, selectedProgram, currentUser, mode = 'criteria', onBack, sessionData, activeYear }) {
  const { showAlert, showConfirm, showPrompt } = useModal();
  const [evaluatedIndicators, setEvaluatedIndicators] = useState(new Set());
  const [assessingIndicator, setAssessingIndicator] = useState(null);
  const [flash, setFlash] = useState({ message: '', type: 'success' });
  const [criteriaCompletedIds, setCriteriaCompletedIds] = useState(new Set());

  const indicatorList = (indicators && selectedComponent) ? (indicators[selectedComponent.component_id] || indicators[selectedComponent.id] || []) : [];

  // Derived state from sessionData prop
  useEffect(() => {
    if (sessionData) {
      const { evaluations, evaluationsActual } = sessionData;

      // Update evaluated indicators based on mode
      const relevantList = mode === 'evaluation' ? evaluationsActual : evaluations;
      const evaluatedIds = new Set(relevantList.map(ev => String(ev.indicator_id)));
      setEvaluatedIndicators(evaluatedIds);

      // Update criteria completion status for evaluation mode
      if (mode === 'evaluation') {
        const criteriaIds = new Set(evaluations.map(ev => String(ev.indicator_id)));
        setCriteriaCompletedIds(criteriaIds);
      }
    }
  }, [sessionData, mode, selectedComponent]);

  useEffect(() => {
    if (flash.message) {
      const timer = setTimeout(() => setFlash({ message: '', type: 'success' }), 3000);
      return () => clearTimeout(timer);
    }
  }, [flash.message]);

  // Local state to store evaluations, allowing updates without parent refresh
  const [localSessionData, setLocalSessionData] = useState(sessionData || { evaluations: [], evaluationsActual: [] });

  useEffect(() => {
    if (sessionData) {
      setLocalSessionData(sessionData);
    }
  }, [sessionData]);

  // ดึงข้อมูลสถานะการประเมิน (กรณีต้องการรีเฟรชหลังบันทึก)
  const fetchEvaluationStatus = async () => {
    if (!selectedComponent) return;
    try {
      const sessionId = localStorage.getItem('assessment_session_id') || '';
      const major = selectedProgram?.majorName || selectedProgram?.major_name || '';
      const qs = new URLSearchParams({ session_id: sessionId, major_name: major }).toString();

      // Fetch BOTH to update full state
      const [evalRes, actualRes] = await Promise.all([
        fetch(`${BASE_URL}/api/evaluations/history?${qs}`),
        fetch(`${BASE_URL}/api/evaluations-actual/history?${qs}`)
      ]);

      if (evalRes.ok && actualRes.ok) {
        const evaluations = await evalRes.json();
        const evaluationsActual = await actualRes.json();

        // Update local state
        setLocalSessionData({
          evaluations: Array.isArray(evaluations) ? evaluations : [],
          evaluationsActual: Array.isArray(evaluationsActual) ? evaluationsActual : []
        });

        // Update helper sets
        const list = (mode === 'evaluation' ? evaluationsActual : evaluations).filter(ev => String(ev.session_id) === String(sessionId));
        const evaluatedIds = new Set(list.map(ev => String(ev.indicator_id)));
        setEvaluatedIndicators(evaluatedIds);

        if (mode === 'evaluation') {
          const criteriaIds = new Set(evaluations.filter(ev => String(ev.session_id) === String(sessionId)).map(ev => String(ev.indicator_id)));
          setCriteriaCompletedIds(criteriaIds);
        }
      }
    } catch (error) {
      console.error('Error refreshing evaluation status:', error);
    }
  };

  const formatSequence = (seq) => {
    if (!seq) return '';
    try {
      return String(seq)
        .split('.')
        .map(part => String(parseInt(part, 10)))
        .join('.');
    } catch {
      return String(seq);
    }
  };

  const handleAssessClick = (indicator) => {
    setAssessingIndicator(indicator);
  };

  const handleAssessmentComplete = () => {
    setAssessingIndicator(null);
    setFlash({ message: 'บันทึกการประเมินเรียบร้อย', type: 'success' });
    fetchEvaluationStatus(); // รีเฟรชสถานะการประเมิน
  };

  const handleAssessmentCancel = () => {
    setAssessingIndicator(null);
  };

  const updateStatus = async (evaluationId, action, extraBody = {}) => {
    try {
      const url = `${BASE_URL}/api/evaluations-actual/${evaluationId}/${action}`;
      console.log('Sending update to:', url);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...extraBody,
          [action === 'approve' ? 'approved_by' : 'rejected_by']: currentUser?.name || currentUser?.username
        })
      });
      if (res.ok) {
        showAlert({
          title: 'สำเร็จ',
          message: action === 'approve' ? 'อนุมัติการประเมินเรียบร้อย' : (action === 'submit' ? 'ส่งตรวจประเมินเรียบร้อย' : 'ส่งกลับแก้ไขเรียบร้อย'),
          type: 'success'
        });
        fetchEvaluationStatus();
      } else {
        const err = await res.json();
        showAlert({ title: 'ข้อผิดพลาด', message: err.error, type: 'error' });
      }
    } catch (err) {
      showAlert({ title: 'ข้อผิดพลาด', message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ', type: 'error' });
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved': return <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">อนุมัติแล้ว</span>;
      case 'pending_review': return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">รอการตรวจสอบ</span>;
      case 'revision_requested': return <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium">ให้ปรับปรุง</span>;
      case 'submitted': return <span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded text-xs font-medium">ส่งตรวจแล้ว</span>;
      case 'draft': return <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">ฉบับร่าง</span>;
      default: return <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">บันทึกแล้ว</span>;
    }
  };

  // หากกำลังประเมิน ให้แสดงฟอร์มประเมิน
  if (assessingIndicator) {
    // เลือกฟอร์มตาม mode
    const FormComponent = mode === 'evaluation' ? EvaluationFormModal : AssessmentFormModal;

    // Determine ReadOnly Status
    let readOnly = false;
    if (mode === 'evaluation') {
      const evalData = localSessionData?.evaluationsActual?.find(r => String(r.indicator_id) === String(assessingIndicator.id));
      const isApproved = evalData?.status === 'approved';
      const isPending = evalData?.status === 'pending_review';

      const isSystemAdmin = currentUser?.role === 'system_admin';
      const isReporter = currentUser?.role === 'reporter';
      const isManager = ['sar_manager', 'qa_admin'].includes(currentUser?.role);

      // If manager or view-only mode, set readOnly to true
      if (isManager || isApproved || isPending) {
        readOnly = true;
      }

      // Override for system admin or reporter when it's not pending/approved
      if ((isSystemAdmin || isReporter) && !isPending && !isApproved) {
        readOnly = false;
      }
    }

    return (
      <FormComponent
        indicator={assessingIndicator}
        selectedProgram={selectedProgram}
        onComplete={handleAssessmentComplete}
        onCancel={handleAssessmentCancel}
        allEvaluations={localSessionData?.evaluations || []}
        allEvaluationsActual={localSessionData?.evaluationsActual || []}
        activeYear={activeYear}
        readOnly={readOnly}
        currentUser={currentUser}
        onApprove={(id) => {
          updateStatus(id, 'approve').then(() => handleAssessmentComplete());
        }}
        onReject={(id) => {
          showPrompt({
            title: 'ระบุสิ่งที่ควรปรับปรุง',
            message: 'ระบุสิ่งที่ควรปรับปรุงเพื่อแจ้งผู้รับผิดชอบ:',
            placeholder: 'ระบุรายละเอียด...',
            onConfirm: (fb) => {
              if (fb) updateStatus(id, 'reject', { feedback: fb }).then(() => handleAssessmentComplete());
            }
          });
        }}
      />
    );
  }

  const baseIndicatorList = indicatorList;
  const filteredIndicatorList = mode === 'evaluation'
    ? baseIndicatorList.filter(ind => criteriaCompletedIds.has(String(ind.id)))
    : baseIndicatorList;

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium text-gray-900">
            {mode === 'evaluation' ? 'ผลการดำเนินการ' : 'ตัวบ่งชี้การประเมิน'}
          </h3>
          <p className="text-sm text-gray-500">
            {selectedComponent.quality_name}
          </p>
        </div>
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5 mr-1" />
            ย้อนกลับ
          </button>
        )}
      </div>

      {/* Flash Message */}
      {flash.message && (
        <div className={`mx-6 mt-4 rounded-md px-4 py-2 border ${flash.type === 'success'
          ? 'bg-green-50 border-green-200 text-green-800'
          : 'bg-red-50 border-red-200 text-red-800'
          }`}>
          {flash.message}
          <button
            className={`${flash.type === 'success' ? 'text-green-700' : 'text-red-700'} float-right`}
            onClick={() => setFlash({ message: '', type: 'success' })}
          >
            ×
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                ลำดับ
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ตัวบ่งชี้คุณภาพ
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                ชนิดตัวบ่งชี้
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                เกณฑ์มาตรฐาน
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-40">
                สถานะ
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-48">
                การจัดการ
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredIndicatorList.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-500">
                  ไม่มีข้อมูลตัวบ่งชี้
                </td>
              </tr>
            ) : (
              filteredIndicatorList.map((indicator) => (
                <tr key={indicator.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-center text-sm font-medium text-gray-900">
                    {String(indicator.sequence).includes('.') ? (
                      <span className="text-gray-400 text-xs">{formatSequence(indicator.sequence)}</span>
                    ) : (
                      <span className="inline-flex items-center justify-center w-7 h-7 bg-red-600 text-white rounded-full text-xs font-bold">
                        {formatSequence(indicator.sequence)}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div className={String(indicator.sequence).includes('.') ? 'font-normal' : 'font-semibold'}>
                      {indicator.indicator_name}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {indicator.indicator_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {indicator.criteria_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {(() => {
                      const evalData = (mode === 'evaluation' ? localSessionData?.evaluationsActual : localSessionData?.evaluations)
                        ?.find(r => String(r.indicator_id) === String(indicator.id));
                      return (
                        <div className="flex flex-col items-center gap-1">
                          {evalData ? (
                            <>
                              {mode === 'criteria' ? (
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">กำหนดแล้ว</span>
                              ) : (
                                getStatusBadge(evalData.status)
                              )}
                              {evalData.status === 'revision_requested' && evalData.feedback && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    showAlert({
                                      title: 'สิ่งที่ควรปรับปรุง',
                                      message: evalData.feedback,
                                      type: 'info'
                                    });
                                  }}
                                  className="text-[10px] text-red-600 hover:text-red-800 flex items-center justify-center"
                                  title="คลิกเพื่อดูรายละเอียด"
                                >
                                  <MessageSquare className="w-3 h-3 mr-1" />
                                  <span>เหตุผล</span>
                                </button>
                              )}
                            </>
                          ) : (
                            <span className="text-gray-400 text-xs italic">{mode === 'criteria' ? 'ยังไม่ได้กำหนด' : 'ยังไม่ได้บันทึกข้อมูล'}</span>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center space-x-2">
                      {(() => {
                        const evalData = (mode === 'evaluation' ? localSessionData?.evaluationsActual : localSessionData?.evaluations)
                          ?.find(r => String(r.indicator_id) === String(indicator.id));

                        const isApproved = evalData?.status === 'approved';
                        const isPending = evalData?.status === 'pending_review';

                        // Role-based permissions
                        const isSystemAdmin = currentUser?.role === 'system_admin';
                        const isReporter = currentUser?.role === 'reporter';
                        const isManager = ['sar_manager', 'qa_admin'].includes(currentUser?.role);

                        // Actions for Evaluation Mode
                        const canRecordOrEdit = mode === 'evaluation' && (isReporter || isSystemAdmin) && !isPending && !isApproved;
                        const canReview = mode === 'evaluation' && (isManager || isSystemAdmin) && isPending;
                        const canViewOnly = mode === 'evaluation' && evalData && !canRecordOrEdit && !canReview;

                        // Actions for Criteria Mode
                        const canManageCriteria = mode === 'criteria' && (isSystemAdmin || isReporter); // Adjusted to match your usual pattern

                        return (
                          <div className="flex flex-col items-center gap-2">
                            {mode === 'evaluation' ? (
                              <>
                                {canRecordOrEdit && (
                                  <button
                                    onClick={() => handleAssessClick(indicator)}
                                    className="text-xs px-3 py-1.5 rounded transition bg-gray-100 text-gray-700 hover:bg-gray-200"
                                  >
                                    {evalData ? 'แก้ไขข้อมูล' : 'บันทึกข้อมูล'}
                                  </button>
                                )}
                                {canReview && (
                                  <button
                                    onClick={() => handleAssessClick(indicator)}
                                    className="text-xs px-3 py-1.5 rounded transition bg-blue-600 text-white hover:bg-blue-700 font-bold w-full"
                                  >
                                    ตรวจสอบ
                                  </button>
                                )}
                                {canViewOnly && (
                                  <button
                                    onClick={() => handleAssessClick(indicator)}
                                    className="text-xs px-3 py-1.5 rounded transition bg-gray-50 text-blue-600 border border-blue-100 hover:bg-blue-50"
                                  >
                                    ดูข้อมูล
                                  </button>
                                )}
                                {!evalData && isManager && (
                                  <span className="text-xs text-gray-400 italic">รอผู้รับผิดชอบบันทึก</span>
                                )}
                              </>
                            ) : (
                              <button
                                onClick={() => handleAssessClick(indicator)}
                                disabled={!canManageCriteria}
                                className={`text-xs px-3 py-1.5 rounded transition ${!canManageCriteria
                                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                  }`}
                              >
                                {evalData ? 'แก้ไขเกณฑ์' : 'กำหนดเกณฑ์ประเมิน'}
                              </button>
                            )}

                            {evalData && mode === 'evaluation' && (
                              <>
                                {/* Reporter: Submit Button */}
                                {evalData.status !== 'pending_review' && evalData.status !== 'approved' && (currentUser?.role === 'reporter' || currentUser?.role === 'system_admin') && (
                                  <button
                                    onClick={() => {
                                      const evalId = evalData.id || evalData._id;
                                      if (evalId) updateStatus(evalId, 'submit');
                                      else showAlert({ title: 'ข้อผิดพลาด', message: 'ไม่พบรหัสการประเมิน กรุณารีเฟรชหน้าเว็บ', type: 'error' });
                                    }}
                                    className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700"
                                  >
                                    ส่งตรวจประเมิน
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div >
  );
}