// src/components/Admin/MasterComponentForm.jsx
import React, { useState, useEffect } from 'react';
import { X, Save, Layers } from 'lucide-react';

export default function MasterComponentForm({ item, programs, rounds, onSubmit, onCancel }) {
    const [formData, setFormData] = useState({
        component_id: '',
        quality_name: '',
        major_name: '',
        year: ''
    });

    useEffect(() => {
        if (item) {
            setFormData({
                component_id: item.component_id || '',
                quality_name: item.quality_name || '',
                major_name: item.major_name || '',
                year: item.year || ''
            });
        }
    }, [item]);

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit(formData);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 flex flex-col max-h-[95vh]">
                <div className="px-8 py-5 bg-gray-50/50 border-b border-gray-100 flex justify-between items-center flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-600 rounded-xl">
                            <Layers className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900">
                            {item ? 'แก้ไขรายละเอียดองค์ประกอบ' : 'เพิ่มองค์ประกอบคุณภาพใหม่'}
                        </h3>
                    </div>
                    <button onClick={onCancel} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
                    <div className="bg-gray-50/50 p-6 rounded-2xl border border-gray-100 space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 ml-1">รหัสองค์ประกอบ</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                                    value={formData.component_id}
                                    onChange={(e) => setFormData({ ...formData, component_id: e.target.value })}
                                    placeholder="เช่น 1 หรือ 1.1"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 ml-1">ปีการศึกษา</label>
                                <select
                                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                                    value={formData.year}
                                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                                >
                                    <option value="">-- อ้างอิงตามปีปัจจุบัน --</option>
                                    {rounds.map(r => (
                                        <option key={r.id} value={r.year}>{r.year}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 ml-1">ชื่อองค์ประกอบคุณภาพ</label>
                            <textarea
                                required
                                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm min-h-[120px]"
                                value={formData.quality_name}
                                onChange={(e) => setFormData({ ...formData, quality_name: e.target.value })}
                                placeholder="ระบุชื่อหรือรายละเอียดองค์ประกอบ..."
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 ml-1">หลักสูตร (เว้นว่างหากเป็นมาตรฐานกลาง)</label>
                            <select
                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                                value={formData.major_name}
                                onChange={(e) => setFormData({ ...formData, major_name: e.target.value })}
                            >
                                <option value="">-- มาตรฐานกลาง (Global) --</option>
                                {programs.map(p => (
                                    <option key={p.id} value={p.majorName || p.major_name}>{p.majorName || p.major_name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="pt-6 flex gap-3 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="flex-1 px-6 py-3 bg-white border border-gray-200 text-gray-600 rounded-2xl font-bold hover:bg-gray-50 transition-all active:scale-95 text-sm"
                        >
                            ยกเลิก
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95 flex items-center justify-center gap-2 text-sm"
                        >
                            <Save className="w-5 h-5" />
                            {item ? 'บันทึกการแก้ไข' : 'สร้างข้อมูล'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
