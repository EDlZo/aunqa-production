// src/components/Admin/MasterIndicatorForm.jsx
import React, { useState, useEffect } from 'react';
import { X, Save, Plus, Trash2, List, Activity } from 'lucide-react';
import { BASE_URL } from '../../config/api.js';

export default function MasterIndicatorForm({ item, components, programs, rounds, onSubmit, onCancel }) {
    const [formData, setFormData] = useState({
        sequence: '',
        indicator_name: '',
        indicator_type: 'Quantitative',
        criteria_type: 'AUN-QA',
        component_id: '',
        major_name: '',
        year: '',
        data_source: '',
        parent_id: ''
    });

    const [subItems, setSubItems] = useState([]);
    const [componentIndicators, setComponentIndicators] = useState([]);

    useEffect(() => {
        if (item?.id) {
            // MODE: EDIT
            setFormData({
                sequence: item.sequence || '',
                indicator_name: item.indicator_name || '',
                indicator_type: item.indicator_type || 'Quantitative',
                criteria_type: item.criteria_type || 'AUN-QA',
                component_id: item.component_id || '',
                major_name: item.major_name || '',
                year: item.year || '',
                data_source: item.data_source || '',
                parent_id: item.parent_id || ''
            });
        } else if (item?.parent_id) {
            // MODE: ADD SUB-INDICATOR
            // Inherit everything from parent EXCEPT name and sequence
            setFormData({
                sequence: '', // Let user type 1.1 etc
                indicator_name: '', // NEW sub-item name
                indicator_type: item.indicator_type || 'Quantitative',
                criteria_type: item.criteria_type || 'AUN-QA',
                component_id: item.component_id || '',
                major_name: item.major_name || '',
                year: item.year || '',
                data_source: item.data_source || '',
                parent_id: item.parent_id
            });
        } else if (item || components.length > 0) {
            // MODE: NEW (Possibly with component pre-fill)
            const initialCompId = item?.component_id || components[0]?.component_id;
            setFormData({
                sequence: item?.sequence || '',
                indicator_name: '',
                indicator_type: item?.indicator_type || 'Quantitative',
                criteria_type: item?.criteria_type || 'AUN-QA',
                component_id: initialCompId || '',
                major_name: item?.major_name || '',
                year: item?.year || '',
                data_source: '',
                parent_id: ''
            });
        }
    }, [item, components]);

    useEffect(() => {
        const fetchComponentIndicators = async () => {
            if (!formData.component_id) {
                setComponentIndicators([]);
                return;
            }
            try {
                const url = `${BASE_URL}/api/master-indicators`;
                console.log('Fetching sibling indicators:', url);
                const res = await fetch(url);
                if (res.ok) {
                    const data = await res.json();
                    const filtered = data.filter(ind =>
                        String(ind.component_id) === String(formData.component_id) &&
                        (!item || ind.id !== item.id)
                    );
                    setComponentIndicators(filtered);
                }
            } catch (err) { console.error('Error fetching sibling indicators:', err); }
        };
        fetchComponentIndicators();
    }, [formData.component_id, item]);

    const addSubItem = () => {
        // Find existing children for this parent from the database
        const dbChildren = componentIndicators.filter(i =>
            String(i.parent_id) === String(formData.parent_id || item?.id)
        );

        // Combine with children already added in the form
        const currentSequences = [
            ...dbChildren.map(c => c.sequence),
            ...subItems.map(s => s.sequence)
        ].filter(s => s && s.includes('.'));

        let nextSeq = '';
        const parentSeq = formData.sequence || item?.sequence || '1';

        if (currentSequences.length > 0) {
            // Find max existing suffix
            const suffixes = currentSequences.map(seq => {
                const parts = seq.split('.');
                return parseInt(parts[parts.length - 1]) || 0;
            });
            const maxSuffix = Math.max(...suffixes);

            // Reconstruct the sequence using the parent parts
            const parts = parentSeq.split('.');
            nextSeq = `${parts[0]}.${maxSuffix + 1}`;
        } else {
            // First sub-item
            const parts = parentSeq.split('.');
            nextSeq = `${parts[0]}.1`;
        }

        setSubItems([...subItems, { sequence: nextSeq, indicator_name: '' }]);
    };

    const removeSubItem = (index) => {
        setSubItems(subItems.filter((_, i) => i !== index));
    };

    const updateSubItem = (index, field, value) => {
        const updated = [...subItems];
        updated[index][field] = value;
        setSubItems(updated);
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        if (subItems.length === 0) {
            onSubmit(formData);
        } else {
            // Bulk Add
            const mainItem = { ...formData };
            const children = subItems.filter(s => s.indicator_name.trim() !== '').map(s => ({
                ...formData,
                sequence: s.sequence,
                indicator_name: s.indicator_name,
                // parent_id should be determined AFTER mainItem is saved or we need a way to link them
                // For master templates, we can use a temporary link or handle it in backend
                // But for now, let's send them as a list and handle parenting if possible
                // If mainItem is being created, we don't have its ID yet.
                _is_bulk: true
            }));

            onSubmit([mainItem, ...children]);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[95vh]">
                <div className="px-8 py-5 bg-gray-50/50 border-b border-gray-100 flex justify-between items-center flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-600 rounded-xl">
                            <List className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900">
                            {item?.id ? 'แก้ไขรายละเอียดตัวบ่งชี้' : item?.parent_id ? 'เพิ่มหัวข้อย่อยเพิ่มเติม' : 'จัดการแม่แบบตัวบ่งชี้'}
                        </h3>
                    </div>
                    <button onClick={onCancel} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
                    {/* Parent Info (If any) */}
                    {formData.parent_id && (
                        <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-center gap-3">
                            <div className="p-2 bg-amber-100 rounded-2xl">
                                <Activity className="w-4 h-4 text-amber-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Parent Indicator (หัวข้อหลัก)</p>
                                <p className="text-sm font-bold text-amber-900 truncate">
                                    {item?.parent_name || item?.indicator_name || componentIndicators.find(i => i.id === formData.parent_id)?.indicator_name || 'Loading parent info...'}
                                </p>
                            </div>

                        </div>
                    )}

                    {/* Main Fields Group */}
                    <div className="bg-gray-50/50 p-6 rounded-2xl border border-gray-100 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="col-span-1">
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 ml-1">องค์ประกอบ</label>
                                <select
                                    required
                                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                                    value={formData.component_id}
                                    onChange={(e) => setFormData({ ...formData, component_id: e.target.value })}
                                >
                                    <option value="">-- เลือกองค์ประกอบ --</option>
                                    {components.map(comp => (
                                        <option key={comp.id} value={comp.component_id}>
                                            ({comp.component_id}) {comp.quality_name.substring(0, 50)}...
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-span-1">
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 ml-1">รหัสลำดับ</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                                    value={formData.sequence}
                                    onChange={(e) => setFormData({ ...formData, sequence: e.target.value })}
                                    placeholder="เช่น 1 หรือ 1.1"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 ml-1">ชื่อตัวบ่งชี้ / รายละเอียด</label>
                            <textarea
                                required
                                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm min-h-[80px]"
                                value={formData.indicator_name}
                                onChange={(e) => setFormData({ ...formData, indicator_name: e.target.value })}
                                placeholder="ระบุรายละเอียดตัวบ่งชี้..."
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 ml-1">ประเภท</label>
                                <select
                                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                                    value={formData.indicator_type}
                                    onChange={(e) => setFormData({ ...formData, indicator_type: e.target.value })}
                                >
                                    <option value="Quantitative">Quantitative (เชิงปริมาณ)</option>
                                    <option value="Qualitative">Qualitative (เชิงคุณภาพ)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 ml-1">เกณฑ์</label>
                                <select
                                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                                    value={formData.criteria_type}
                                    onChange={(e) => setFormData({ ...formData, criteria_type: e.target.value })}
                                >
                                    <option value="AUN-QA">AUN-QA</option>
                                    <option value="Other">อื่นๆ</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Existing Sub-items / Bulk Add Section (Only for Main Indicators) */}
                    {!formData.parent_id && (
                        <div className="space-y-4 pt-2">
                            {item?.id && componentIndicators.filter(i => i.parent_id === item.id).length > 0 && (
                                <div className="bg-blue-50/30 border border-blue-100 p-4 rounded-2xl">
                                    <h4 className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-2">Existing Sub-indicators ({componentIndicators.filter(i => i.parent_id === item.id).length})</h4>
                                    <div className="space-y-1">
                                        {componentIndicators.filter(i => i.parent_id === item.id).map(sib => (
                                            <div key={sib.id} className="text-xs text-gray-600 flex items-start gap-2">
                                                <span className="font-bold text-blue-400">
                                                    {sib.sequence ? sib.sequence.split('.').map(p => parseInt(p, 10)).join('.') : '-'}
                                                </span>
                                                <span className="truncate">{sib.indicator_name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center justify-between ml-1">
                                <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                    <Plus className="w-4 h-4 text-blue-500" />
                                    {item?.id ? 'เพิ่มหัวข้อย่อยเพิ่มเติม' : 'เพิ่มหัวข้อย่อยพร้อมกัน (เลือกได้หลายข้อ)'}
                                </h4>
                                <button
                                    type="button"
                                    onClick={addSubItem}
                                    className="text-[11px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-2xl transition-all"
                                >
                                    + เพิ่มรายการ
                                </button>
                            </div>

                            {subItems.length > 0 && (
                                <div className="space-y-3">
                                    {subItems.map((si, index) => (
                                        <div key={index} className="flex gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                            <input
                                                type="text"
                                                className="w-24 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                                                value={si.sequence}
                                                onChange={(e) => updateSubItem(index, 'sequence', e.target.value)}
                                                placeholder="ลำดับ"
                                            />
                                            <input
                                                type="text"
                                                className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                                                value={si.indicator_name}
                                                onChange={(e) => updateSubItem(index, 'indicator_name', e.target.value)}
                                                placeholder="ชื่อตัวบ่งชี้ย่อย..."
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeSubItem(index)}
                                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="pt-6 flex gap-3 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="flex-1 px-6 py-3 bg-white border border-gray-200 text-gray-600 rounded-2xl font-bold hover:bg-gray-50 transition-all active:scale-95"
                        >
                            ยกเลิก
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95 flex items-center justify-center gap-2"
                        >
                            <Save className="w-5 h-5" />
                            {item?.id ? 'บันทึกการแก้ไข' : (subItems.length > 0 ? `บันทึกทั้งหมด (${subItems.length + 1})` : 'สร้างข้อมูล')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

