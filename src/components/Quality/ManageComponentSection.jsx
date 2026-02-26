import React, { useEffect, useState } from 'react';
export default function ManageComponentSection() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saveMsg, setSaveMsg] = useState('');

  useEffect(() => {
    try {
      const sessionId = localStorage.getItem('assessment_session_id') || '';
      const sel = localStorage.getItem('selectedProgramContext');
      const major = sel ? (JSON.parse(sel)?.majorName || '') : '';
      const qs = new URLSearchParams({ session_id: sessionId, major_name: major }).toString();
      fetch(`/api/quality-components1?${qs}`)
        .then(res => res.json())
        .then(data => {
        setItems(data.map(item => ({
          ...item,
          target: item.target || '',
          weight: item.weight || ''
        })));
        setLoading(false);
        })
        .catch(() => {
          setError('ไม่สามารถโหลดข้อมูลได้');
          setLoading(false);
        });
    } catch {
      setError('ไม่สามารถโหลดข้อมูลได้');
      setLoading(false);
    }
  }, []);

  const handleChange = (idx, field, value) => {
    setItems(items => items.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaveMsg('');
    let success = true;
    for (const item of items) {
      const ctx = (() => {
        try {
          const sessionId = localStorage.getItem('assessment_session_id') || '';
          const sel = localStorage.getItem('selectedProgramContext');
          const major = sel ? (JSON.parse(sel)?.majorName || '') : '';
          return { session_id: sessionId, major_name: major };
        } catch { return { session_id: '', major_name: '' }; }
      })();

      const res = await fetch(`/api/quality-components1/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: item.target, weight: item.weight, ...ctx })
      });
      if (!res.ok) success = false;
    }
    setSaveMsg(success ? 'บันทึกข้อมูลสำเร็จ' : 'บันทึกข้อมูลบางรายการไม่สำเร็จ');
    setTimeout(() => setSaveMsg(''), 2000);
  };
  return (
    <div className="max-w-6xl mx-auto py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">จัดการองค์ประกอบ</h1>
        <p className="text-sm text-gray-600">กำหนดค่าเป้าหมายและน้ำหนักขององค์ประกอบคุณภาพ</p>
      </div>
      <div className="bg-white rounded-2xl shadow p-6">
        {loading ? (
          <p className="text-gray-500">กำลังโหลดข้อมูล...</p>
        ) : error ? (
          <p className="text-red-600">{error}</p>
        ) : items.length === 0 ? (
          <p className="text-gray-500">ยังไม่มีข้อมูล</p>
        ) : (
          <form onSubmit={handleSave}>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">องค์ประกอบคุณภาพ</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">เป้าหมาย</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">น้ำหนัก (%)</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {items.map((item, idx) => (
                    <tr key={item.id || idx}>
                      <td className="px-4 py-3 text-sm text-gray-900">{item.quality_name || item.qualityName}</td>
                      <td className="px-4 py-3">
                        <input
                          className="border rounded px-2 py-1 w-48"
                          value={item.target}
                          onChange={e => handleChange(idx, 'target', e.target.value)}
                          placeholder="เป้าหมาย"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          className="border rounded px-2 py-1 w-24 text-center"
                          value={item.weight}
                          onChange={e => handleChange(idx, 'weight', e.target.value)}
                          placeholder="%"
                          type="number"
                          min="0"
                          max="100"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button type="submit" className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">บันทึก</button>
              {saveMsg && <span className="text-green-600 text-sm">{saveMsg}</span>}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
