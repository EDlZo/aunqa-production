import React, { useEffect, useState } from 'react';
import PDFViewer from './PDFViewer';
import FileViewer from './FileViewer';
import { FileText, Eye, Download, X } from 'lucide-react';

export default function ReportSection() {
  // --- เพิ่ม state สำหรับฟอร์มผลประเมิน ---
  const [indicators, setIndicators] = useState([]);
  const [majorName, setMajorName] = useState('');
  const [usedTable, setUsedTable] = useState('');
  const [form, setForm] = useState({
    indicator_id: '',
    program_id: '',
    year: '',
    evaluator_id: '',
    score: '',
    comment: '',
    evidence_file: null, // เปลี่ยนเป็น null
    status: 'submitted',
  });
  const [submitMsg, setSubmitMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [showPDFViewer, setShowPDFViewer] = useState(false);
  const [showFileViewer, setShowFileViewer] = useState(false);
  const [viewingFilename, setViewingFilename] = useState('');
  const [history, setHistory] = useState([]);

  const renderMajorHeader = () => (
    <div className="mb-4 p-3 rounded border bg-gray-50 text-sm text-gray-700">
      <div>สาขาที่กำลังประเมิน: <span className="font-medium">{majorName || '—'}</span></div>
      {usedTable && (
        <div className="text-xs text-gray-500">บันทึกลงตาราง: {usedTable}</div>
      )}
    </div>
  );

  // ดึงรายการตัวบ่งชี้
  useEffect(() => {
    try {
      const sel = localStorage.getItem('selectedProgramContext');
      if (sel) {
        const parsed = JSON.parse(sel);
        setMajorName(parsed?.majorName || '');
      }
    } catch {}
    try {
      const sessionId = localStorage.getItem('assessment_session_id') || '';
      const sel = localStorage.getItem('selectedProgramContext');
      const major = sel ? (JSON.parse(sel)?.majorName || '') : '';
      const qs = new URLSearchParams({ session_id: sessionId, major_name: major }).toString();
      fetch(`/api/quality-components1?${qs}`)
        .then(res => res.json())
        .then(data => setIndicators(data))
        .catch(() => setIndicators([]));
    } catch {
      setIndicators([]);
    }
  }, []);

  // handle change
  const handleChange = e => {
    const { name, value, type, files } = e.target;
    if (type === 'file') {
      const file = files[0];
      setForm(f => ({ ...f, [name]: file }));
      setSelectedFile(file);
    } else {
      setForm(f => ({ ...f, [name]: value }));
    }
  };

  // handle submit
  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    setSubmitMsg('');
    const formData = new FormData();
    formData.append('indicator_id', form.indicator_id);
    formData.append('program_id', form.program_id ? form.program_id : 1);
    formData.append('year', form.year ? form.year : 2024);
    formData.append('evaluator_id', form.evaluator_id ? form.evaluator_id : 2);
    formData.append('score', form.score);
    formData.append('comment', form.comment);
    formData.append('status', form.status);
    // attach context for routing to major-specific table
    try {
      const sessionId = localStorage.getItem('assessment_session_id');
      if (sessionId) formData.append('session_id', sessionId);
      const sel = localStorage.getItem('selectedProgramContext');
      if (sel) {
        const parsed = JSON.parse(sel);
        if (parsed?.majorName) formData.append('major_name', parsed.majorName);
      }
    } catch {}
    if (form.evidence_file) formData.append('evidence_file', form.evidence_file);
    try {
      const res = await fetch('/api/evaluations', {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        setUsedTable(data?.table || '');
        setSubmitMsg('บันทึกผลประเมินสำเร็จ!');
        setForm(f => ({ ...f, score: '', comment: '', evidence_file: null }));
        setSelectedFile(null);
      } else {
        setSubmitMsg('เกิดข้อผิดพลาดในการบันทึก');
      }
    } catch {
      setSubmitMsg('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
    setLoading(false);
  };

  // ฟังก์ชันสำหรับแสดงไฟล์ที่เลือก
  const renderSelectedFile = () => {
    if (!selectedFile) return null;

    const isPDF = selectedFile.type === 'application/pdf';
    const isImage = selectedFile.type.startsWith('image/');

    return (
      <div className="mt-2 p-3 bg-blue-50 rounded-2xl border border-blue-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-blue-900">{selectedFile.name}</span>
            <span className="text-xs text-blue-600">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
          </div>
          <div className="flex items-center space-x-1">
            {isPDF && (
              <button
                type="button"
                onClick={() => setShowPDFViewer(true)}
                className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded transition-colors"
                title="ดูไฟล์ PDF"
              >
                <Eye className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setForm(f => ({ ...f, evidence_file: null }));
                setSelectedFile(null);
              }}
              className="p-1 text-red-600 hover:text-red-800 hover:bg-red-100 rounded transition-colors"
              title="ลบไฟล์"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        {isImage && (
          <div className="mt-2">
            <img
              src={URL.createObjectURL(selectedFile)}
              alt="Preview"
              className="max-w-full h-32 object-contain rounded border"
            />
          </div>
        )}
      </div>
    );
  };

  const renderHistory = () => {
    if (!history || history.length === 0) return (
      <div className="text-sm text-gray-500">ยังไม่มีข้อมูลผลประเมินสำหรับสาขานี้</div>
    );
    return (
      <table className="w-full border border-gray-200 mt-2 text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="py-2 px-3">คะแนน</th>
            <th className="py-2 px-3">คอมเมนต์</th>
            <th className="py-2 px-3">ไฟล์</th>
            <th className="py-2 px-3">วันที่</th>
          </tr>
        </thead>
        <tbody>
          {history.map((ev) => (
            <tr key={ev.evaluation_id} className="border-t border-gray-200">
              <td className="py-2 px-3">{ev.score}</td>
              <td className="py-2 px-3">{ev.comment}</td>
              <td className="py-2 px-3">{ev.evidence_file || '-'}</td>
              <td className="py-2 px-3">{ev.created_at?.slice(0, 19).replace('T', ' ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  // ฟังก์ชันสำหรับดูไฟล์ที่อัปโหลดแล้ว
  const handleViewFile = (filename) => {
    setViewingFilename(filename);
    setShowFileViewer(true);
  };

  useEffect(() => {
    // load history for selected major/session
    try {
      const sessionId = localStorage.getItem('assessment_session_id') || '';
      const sel = localStorage.getItem('selectedProgramContext');
      const major = sel ? (JSON.parse(sel)?.majorName || '') : '';
      const qs = new URLSearchParams({ session_id: sessionId, major_name: major }).toString();
      fetch(`/api/evaluations/history?${qs}`)
        .then(r => r.json())
        .then(setHistory)
        .catch(() => setHistory([]));
    } catch {
      setHistory([]);
    }
  }, [submitMsg]);

//   return (
//     <div className="bg-white rounded-2xl shadow-xl p-10 text-center">
//       <h2 className="text-3xl font-bold mb-6 text-purple-700">3. รายงาน</h2>
//       <ul className="text-lg text-gray-700 space-y-3">
//         <li>• รายงานผลการดำเนินงาน</li>
//         <li>• กำหนดค่าตัวชี้วัด</li>
//         <li>• แนบหลักฐานอ้างอิง</li>
//       </ul>
//       <p className="mt-8 text-gray-500">(สำหรับผู้รายงานผล)</p>

//       {/* --- ฟอร์มกรอกผลประเมิน --- */}
//       <div className="bg-purple-50 rounded-xl shadow p-8 mt-10 text-left max-w-xl mx-auto">
//         <h3 className="text-xl font-bold text-purple-800 mb-4">กรอกผลการประเมิน</h3>
//         <form className="space-y-4" onSubmit={handleSubmit}>
//           <div>
//             <label className="block mb-1 font-medium">เลือกตัวบ่งชี้</label>
//             <select
//               name="indicator_id"
//               value={form.indicator_id}
//               onChange={handleChange}
//               className="border rounded px-3 py-2 w-full"
//               required
//             >
//               <option value="">-- เลือก --</option>
//               {indicators.map(ind => (
//                 <option key={ind.id} value={ind.id}>
//                   {ind.quality_name || ind.qualityName} - {ind.indicator}
//                 </option>
//               ))}
//             </select>
//           </div>
//           <div>
//             <label className="block mb-1 font-medium">คะแนน</label>
//             <input
//               type="number"
//               name="score"
//               value={form.score}
//               onChange={handleChange}
//               className="border rounded px-3 py-2 w-full"
//               min="0" max="5" step="0.01"
//               required
//             />
//           </div>
//           <div>
//             <label className="block mb-1 font-medium">คอมเมนต์</label>
//             <textarea
//               name="comment"
//               value={form.comment}
//               onChange={handleChange}
//               className="border rounded px-3 py-2 w-full"
//               rows={2}
//             />
//           </div>
//           <div>
//             <label className="block mb-1 font-medium">แนบไฟล์หลักฐาน</label>
//             <input
//               type="file"
//               name="evidence_file"
//               onChange={handleChange}
//               className="border rounded px-3 py-2 w-full"
//               accept="application/pdf,image/*"
//             />
//             {renderSelectedFile()}
//           </div>
//           <button
//             type="submit"
//             className="bg-purple-700 text-white px-6 py-2 rounded-2xl font-bold hover:bg-purple-800 transition"
//             disabled={loading}
//           >
//             {loading ? 'กำลังบันทึก...' : 'บันทึกผลประเมิน'}
//           </button>
//           {submitMsg && <div className="mt-2 text-purple-700 font-bold">{submitMsg}</div>}
//         </form>
//       </div>

//       {/* --- ตารางผลประเมินย้อนหลัง --- */}
//       <div className="bg-purple-50 rounded-xl shadow p-8 mt-10 text-left max-w-3xl mx-auto">
//         <h3 className="text-xl font-bold text-purple-800 mb-4">ผลประเมินย้อนหลังของคุณ</h3>
//         <EvaluationHistory onViewFile={handleViewFile} />
//       </div>

//       {/* PDF Viewer Modal */}
//       {showPDFViewer && selectedFile && (
//         <PDFViewer
//           file={selectedFile}
//           onClose={() => setShowPDFViewer(false)}
//         />
//       )}

//       {/* File Viewer Modal */}
//       {showFileViewer && viewingFilename && (
//         <FileViewer
//           filename={viewingFilename}
//           onClose={() => setShowFileViewer(false)}
//         />
//       )}
//     </div>
//   );
// }

// // --- เพิ่ม component ย่อยสำหรับแสดงผลประเมินย้อนหลัง ---
// function EvaluationHistory({ onViewFile }) {
//   const [evaluations, setEvaluations] = useState([]);
//   const [indicators, setIndicators] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState('');

//   useEffect(() => {
//     Promise.all([
//       fetch('/api/evaluations').then(res => res.json()).catch(() => []),
//       fetch('/api/quality-components').then(res => res.json()).catch(() => [])
//     ]).then(([evaluationsData, indicatorsData]) => {
//       setEvaluations(evaluationsData);
//       setIndicators(indicatorsData);
//       setLoading(false);
//     }).catch(() => {
//       setError('ไม่สามารถโหลดข้อมูลได้');
//       setLoading(false);
//     });
//   }, []);

//   const getIndicatorName = (indicatorId) => {
//     const indicator = indicators.find(ind => ind.id === indicatorId);
//     return indicator ? (indicator.quality_name || indicator.qualityName) : 'ไม่ทราบ';
//   };

//   if (loading) return <div className="text-center py-4">กำลังโหลด...</div>;
//   if (error) return <div className="text-center py-4 text-red-600">{error}</div>;
//   if (evaluations.length === 0) return <div className="text-center py-4 text-gray-500">ไม่มีข้อมูลผลประเมิน</div>;

//   return (
//     <table className="w-full border mt-2 text-sm">
//       <thead>
//         <tr className="bg-purple-100">
//           <th className="py-2 px-3">ตัวบ่งชี้</th>
//           <th className="py-2 px-3">คะแนน</th>
//           <th className="py-2 px-3">คอมเมนต์</th>
//           <th className="py-2 px-3">ไฟล์หลักฐาน</th>
//           <th className="py-2 px-3">สถานะ</th>
//           <th className="py-2 px-3">วันที่</th>
//         </tr>
//       </thead>
//       <tbody>
//         {evaluations.map(ev => (
//           <tr key={ev.evaluation_id} className="border-t">
//             <td className="py-2 px-3">{getIndicatorName(ev.indicator_id)}</td>
//             <td className="py-2 px-3">{ev.score}</td>
//             <td className="py-2 px-3">{ev.comment}</td>
//             <td className="py-2 px-3">
//               {ev.evidence_file ? (
//                 <div className="flex items-center space-x-1">
//                   <FileText className="w-4 h-4 text-blue-600" />
//                   <button
//                     onClick={() => onViewFile(ev.evidence_file)}
//                     className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
//                   >
//                     {ev.evidence_file}
//                   </button>
//                 </div>
//               ) : (
//                 <span className="text-gray-400">ไม่มีไฟล์</span>
//               )}
//             </td>
//             <td className="py-2 px-3">{ev.status}</td>
//             <td className="py-2 px-3">{ev.created_at && ev.created_at.slice(0, 19).replace('T', ' ')}</td>
//           </tr>
//         ))}
//       </tbody>
//     </table>
//   );
}


