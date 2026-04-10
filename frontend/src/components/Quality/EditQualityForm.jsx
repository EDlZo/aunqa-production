import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function EditQualityForm({ item, onSave, onCancel }) {
  const [qualityName, setQualityName] = useState('');
  const [componentId, setComponentId] = useState('');
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (item) {
      setQualityName(item.qualityName || item.quality_name);
      setComponentId(item.componentId || item.component_id);
      setIsVisible(true);
    }
  }, [item]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!qualityName || !componentId) return;

    const updatedItem = { ...item, quality_name: qualityName, component_id: componentId };

    setIsVisible(false); // เริ่ม animation ปิด
    setTimeout(async () => {
      await onSave(updatedItem); // บันทึกข้อมูล
      window.location.reload();   // รีโหลดหน้าเว็บทันที
    }, 200);
  };

  const handleCancel = () => {
    setIsVisible(false);
    setTimeout(() => onCancel(), 200);
  };

  return createPortal(
    <div
      className={`fixed inset-0 bg-white bg-opacity-30 flex items-center justify-center z-50 transition-opacity duration-200
        ${isVisible ? 'opacity-100' : 'opacity-0'}`}
    >
      <div
        className={`bg-white p-6 rounded-2xl shadow-lg w-96 transform transition-transform duration-200
          ${isVisible ? 'scale-100' : 'scale-95'}`}
      >
        <h2 className="text-lg font-bold mb-4 text-center">แก้ไข้อค์ประกอบ</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">ชื่อองค์ประกอบ</label>
            <input
              type="text"
              value={qualityName}
              onChange={(e) => setQualityName(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">องค์ประกอบที่</label>
            <input
              type="text"
              value={componentId}
              onChange={(e) => setComponentId(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              required
            />
          </div>
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 transition-colors duration-200"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors duration-200"
            >
              บันทึก
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
