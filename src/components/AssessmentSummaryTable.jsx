import React from 'react';

export default function AssessmentSummaryTable({ data }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 bg-white rounded-2xl shadow">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">ลำดับ</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">องค์ประกอบ</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">ตัวบ่งชี้</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">คะแนน</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">หมายเหตุ</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data && data.length > 0 ? (
            data.map((row, idx) => (
              <tr key={row.id || idx}>
                <td className="px-4 py-2 text-center">{idx + 1}</td>
                <td className="px-4 py-2">{row.component}</td>
                <td className="px-4 py-2">{row.indicator}</td>
                <td className="px-4 py-2 text-center">{row.score}</td>
                <td className="px-4 py-2">{row.note}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={5} className="text-center py-4 text-gray-400">ไม่มีข้อมูล</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
