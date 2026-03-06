// src/components/Admin/ProgramManagement.jsx
import React, { useState, useEffect } from 'react';
import {
    Layers, School, BookOpen, Plus, Edit, Trash2,
    Search, X, ArrowLeft, ChevronRight, Save, AlertCircle
} from 'lucide-react';
import { useModal } from '../../context/ModalContext';
import { BASE_URL } from '../../config/api.js';

export default function ProgramManagement({ setActiveTab }) {
    const { showAlert, showConfirm } = useModal();
    const [activeSubTab, setActiveSubTab] = useState('levels'); // levels | faculties | programs
    const [loading, setLoading] = useState(false);

    // Data states
    const [levels, setLevels] = useState([]);
    const [faculties, setFaculties] = useState([]);
    const [programs, setPrograms] = useState([]);

    // Modal states
    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [editingItem, setEditingItem] = useState(null);

    // Form states
    const [levelForm, setLevelForm] = useState({ name: '' });
    const [facultyForm, setFacultyForm] = useState({ name: '' });
    const [programForm, setProgramForm] = useState({
        majorName: '',
        facultyId: ''
    });

    useEffect(() => {
        fetchAllData();
    }, []);

    const fetchAllData = async () => {
        setLoading(true);
        try {
            const [lRes, fRes, pRes] = await Promise.all([
                fetch(`${BASE_URL}/api/levels`),
                fetch(`${BASE_URL}/api/faculties`),
                fetch(`${BASE_URL}/api/programs`)
            ]);
            if (lRes.ok) setLevels(await lRes.json());
            if (fRes.ok) setFaculties(await fRes.json());
            if (pRes.ok) setPrograms(await pRes.json());
        } catch (error) {
            console.error('Error fetching program data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (item = null) => {
        setEditingItem(item);
        setEditMode(!!item);

        if (activeSubTab === 'levels') {
            setLevelForm({ name: item?.name || '' });
        } else if (activeSubTab === 'faculties') {
            setFacultyForm({ name: item?.name || '' });
        } else if (activeSubTab === 'programs') {
            setProgramForm({
                majorName: item?.majorName || '',
                facultyId: item?.facultyId || ''
            });
        }
        setShowModal(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setLoading(true);
        const type = activeSubTab; // levels | faculties | programs
        const method = editMode ? 'PATCH' : 'POST';
        const url = editMode ? `${BASE_URL}/api/${type}/${editingItem.id}` : `${BASE_URL}/api/${type}`;

        let body = {};
        if (type === 'levels') body = levelForm;
        if (type === 'faculties') body = facultyForm;
        if (type === 'programs') {
            const faculty = faculties.find(f => f.id === programForm.facultyId);
            body = {
                ...programForm,
                facultyName: faculty?.name || '',
                // Legacy support for mixed case IDs if needed
                majorId: editMode ? editingItem.majorId : `maj-${Date.now()}`
            };
        }

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (res.ok) {
                setShowModal(false);
                fetchAllData();
            } else {
                showAlert({ title: 'ข้อผิดพลาด', message: 'บันทึกไม่สำเร็จ', type: 'error' });
            }
        } catch (error) {
            console.error('Save error:', error);
            showAlert({ title: 'ข้อผิดพลาด', message: 'เกิดข้อผิดพลาดในการบันทึก', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        showConfirm({
            title: 'ยืนยันการลบ',
            message: 'คุณต้องการลบรายการนี้ใช่หรือไม่? การลบอาจส่งผลกระทบต่อข้อมูลที่เกี่ยวข้อง',
            type: 'error',
            onConfirm: async () => {
                setLoading(true);
                try {
                    const res = await fetch(`${BASE_URL}/api/${activeSubTab}/${id}`, { method: 'DELETE' });
                    if (res.ok) {
                        fetchAllData();
                        showAlert({ title: 'สำเร็จ', message: 'ลบข้อมูลเรียบร้อยแล้ว', type: 'success' });
                    } else {
                        showAlert({ title: 'ข้อผิดพลาด', message: 'ลบไม่สำเร็จ', type: 'error' });
                    }
                } catch (error) {
                    console.error('Delete error:', error);
                    showAlert({ title: 'ข้อผิดพลาด', message: 'เกิดข้อผิดพลาดในการลบ', type: 'error' });
                } finally {
                    setLoading(false);
                }
            }
        });
    };

    return (
        <div className="flex flex-col h-full bg-gray-50 font-prompt">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <button
                        onClick={() => setActiveTab('system_management')}
                        className="flex items-center text-gray-500 hover:text-gray-700 mb-2 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 mr-1" />
                        กลับ
                    </button>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <School className="w-8 h-8 text-blue-600" />
                        จัดการหน่วยงานและหลักสูตร
                    </h1>
                    <p className="text-gray-600">จัดการข้อมูลระดับการศึกษา คณะ และสาขาวิชา</p>
                </div>

                <button
                    onClick={() => handleOpenModal()}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md flex items-center hover:bg-blue-700 transition-colors"
                >
                    <Plus className="w-5 h-5 mr-1" />
                    เพิ่ม{activeSubTab === 'levels' ? 'ระดับ' : activeSubTab === 'faculties' ? 'คณะ' : 'สาขาวิชา'}
                </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 mb-6 sticky top-0 bg-gray-50 z-10">
                <button
                    onClick={() => setActiveSubTab('levels')}
                    className={`flex items-center px-6 py-3 border-b-2 text-sm font-medium transition-colors ${activeSubTab === 'levels'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                >
                    <Layers className="w-4 h-4 mr-2" />
                    ระดับ ({levels.length})
                </button>
                <button
                    onClick={() => setActiveSubTab('faculties')}
                    className={`flex items-center px-6 py-3 border-b-2 text-sm font-medium transition-colors ${activeSubTab === 'faculties'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                >
                    <School className="w-4 h-4 mr-2" />
                    คณะ ({faculties.length})
                </button>
                <button
                    onClick={() => setActiveSubTab('programs')}
                    className={`flex items-center px-6 py-3 border-b-2 text-sm font-medium transition-colors ${activeSubTab === 'programs'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                >
                    <BookOpen className="w-4 h-4 mr-2" />
                    สาขาวิชา ({programs.length})
                </button>
            </div>

            {/* List */}
            <div className="bg-white rounded-2xl shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            {activeSubTab === 'levels' && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ชื่อระดับ</th>}
                            {activeSubTab === 'faculties' && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ชื่อคณะ</th>}
                            {activeSubTab === 'programs' && (
                                <>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ชื่อสาขา</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">คณะ</th>
                                </>
                            )}
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">จัดการ</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading && !showModal ? (
                            <tr><td colSpan="5" className="px-8 py-20 text-center text-gray-400 font-medium italic">กำลังโหลดข้อมูล...</td></tr>
                        ) : (
                            (activeSubTab === 'levels' ? levels : activeSubTab === 'faculties' ? faculties : programs).map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">
                                            {activeSubTab === 'programs' ? item.majorName : item.name}
                                        </div>
                                    </td>
                                    {activeSubTab === 'programs' && (
                                        <>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {(() => {
                                                    const faculty = faculties.find(f => f.id === item.facultyId);
                                                    if (faculty) return faculty.name;
                                                    if (item.facultyId) {
                                                        return <span className="text-red-500" title="ลบไปแล้ว">{item.facultyName || 'ไม่พบข้อมูลคณะ'} (!)</span>;
                                                    }
                                                    return item.facultyName || '-';
                                                })()}
                                            </td>
                                        </>
                                    )}
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button
                                            onClick={() => handleOpenModal(item)}
                                            className="text-blue-600 hover:text-blue-900 mr-3"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(item.id)}
                                            className="text-red-600 hover:text-red-900"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                        {((activeSubTab === 'levels' ? levels : activeSubTab === 'faculties' ? faculties : programs).length === 0 && !loading) && (
                            <tr><td colSpan="5" className="px-8 py-20 text-center text-gray-400 font-medium italic">ไม่พบข้อมูลในหมวดหมู่นี้</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/20 backdrop-blur-md flex items-center justify-center z-[100] p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 flex flex-col max-h-[95vh]">
                        <div className="px-8 py-5 bg-gray-50/50 border-b border-gray-100 flex justify-between items-center flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-600 rounded-xl shadow-lg shadow-blue-200">
                                    {activeSubTab === 'levels' ? <Layers className="w-5 h-5 text-white" /> :
                                        activeSubTab === 'faculties' ? <School className="w-5 h-5 text-white" /> :
                                            <BookOpen className="w-5 h-5 text-white" />}
                                </div>
                                <h2 className="text-xl font-bold text-gray-900">
                                    {editMode ? 'แก้ไขข้อมูล' : 'เพิ่ม'}
                                    {activeSubTab === 'levels' ? 'ระดับ' : activeSubTab === 'faculties' ? 'คณะ' : 'สาขาวิชา'}
                                </h2>
                            </div>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>
                        <form onSubmit={handleSave} className="flex flex-col overflow-hidden">
                            <div className="p-8 space-y-6 overflow-y-auto">
                                <div className="bg-gray-50/50 p-6 rounded-2xl border border-gray-100 space-y-6">
                                    {activeSubTab === 'levels' && (
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 ml-1">ชื่อระดับ</label>
                                            <input
                                                type="text"
                                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                                                required
                                                value={levelForm.name}
                                                onChange={(e) => setLevelForm({ name: e.target.value })}
                                                placeholder="เช่น ปริญญาตรี"
                                            />
                                        </div>
                                    )}
                                    {activeSubTab === 'faculties' && (
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 ml-1">ชื่อคณะ</label>
                                            <input
                                                type="text"
                                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                                                required
                                                value={facultyForm.name}
                                                onChange={(e) => setFacultyForm({ name: e.target.value })}
                                                placeholder="เช่น คณะวิศวกรรมศาสตร์"
                                            />
                                        </div>
                                    )}
                                    {activeSubTab === 'programs' && (
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 ml-1">ชื่อสาขาวิชา</label>
                                                <input
                                                    type="text"
                                                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                                                    required
                                                    value={programForm.majorName}
                                                    onChange={(e) => setProgramForm({ ...programForm, majorName: e.target.value })}
                                                    placeholder="เช่น วิศวกรรมคอมพิวเตอร์"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 ml-1 text-blue-500">คณะ</label>
                                                <select
                                                    className="w-full px-4 py-2.5 bg-white border border-blue-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                                                    required
                                                    value={programForm.facultyId}
                                                    onChange={(e) => setProgramForm({ ...programForm, facultyId: e.target.value })}
                                                >
                                                    <option value="">-- เลือกคณะ --</option>
                                                    {faculties.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="px-8 py-6 bg-gray-50/50 border-t border-gray-100 flex gap-3 flex-shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-6 py-3 bg-white border border-gray-200 text-gray-600 rounded-2xl font-bold hover:bg-gray-50 transition-all active:scale-95 text-sm"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95 flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                                >
                                    <Save className="w-5 h-5" />
                                    {loading ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
