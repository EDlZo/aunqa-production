// src/pages/RoundManagementPage.jsx
import React, { useState, useEffect } from 'react';
import { ArrowLeft, Clock, Plus, Check, X, AlertCircle, Trash2, Edit2, Save } from 'lucide-react';
import { BASE_URL } from '../config/api';
import { useModal } from '../context/ModalContext';

export default function RoundManagementPage({ setActiveTab }) {
    const { showAlert, showConfirm } = useModal();
    const [rounds, setRounds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        id: null,
        year: '',
        name: '',
        is_active: false,
        start_date: '',
        end_date: ''
    });

    useEffect(() => {
        fetchRounds();
    }, []);

    const fetchRounds = async () => {
        try {
            const res = await fetch(`${BASE_URL}/api/rounds`);
            if (res.ok) {
                const data = await res.json();
                setRounds(data);
            }
        } catch (error) {
            console.error('Error fetching rounds:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = () => {
        setFormData({
            id: null,
            year: (new Date().getFullYear() + 543).toString(), // Default to current Thai year
            name: `ปีการศึกษา ${new Date().getFullYear() + 543}`,
            is_active: false,
            start_date: '',
            end_date: ''
        });
        setShowModal(true);
    };

    const handleEdit = (round) => {
        setFormData({
            id: round.id,
            year: round.year || '',
            name: round.name || '',
            is_active: !!round.is_active,
            start_date: round.start_date || '',
            end_date: round.end_date || ''
        });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            let res;
            if (formData.id) {
                // Update existing round
                res = await fetch(`${BASE_URL}/api/rounds/${formData.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });
            } else {
                // Create new round
                res = await fetch(`${BASE_URL}/api/rounds`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });
            }

            if (res.ok) {
                setShowModal(false);
                fetchRounds();
                showAlert({ title: 'สำเร็จ', message: formData.id ? 'แก้ไขรอบประเมินสำเร็จ' : 'สร้างรอบประเมินสำเร็จ', type: 'success' });
            } else {
                const data = await res.json();
                showAlert({ title: 'ข้อผิดพลาด', message: data.error || 'เกิดข้อผิดพลาด', type: 'error' });
            }
        } catch (error) {
            console.error('Error saving round:', error);
            showAlert({ title: 'ข้อผิดพลาด', message: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้', type: 'error' });
        }
    };

    const handleDelete = (round) => {
        showConfirm({
            title: 'ยืนยันการลบ',
            message: `คุณต้องการลบรอบ "${round.name}" ใช่หรือไม่? ข้อมูลประเมินและไฟล์ทั้งหมดในปีนี้จะถูกลบถาวร ไม่สามารถกู้คืนได้`,
            type: 'error',
            confirmText: 'ลบข้อมูลทั้งหมด',
            onConfirm: async () => {
                try {
                    const res = await fetch(`${BASE_URL}/api/rounds/${round.id}`, { method: 'DELETE' });
                    if (res.ok) {
                        fetchRounds();
                        showAlert({ title: 'สำเร็จ', message: 'ลบรอบประเมินเรียบร้อยแล้ว', type: 'success' });
                    } else {
                        showAlert({ title: 'ข้อผิดพลาด', message: 'ลบรอบประเมินไม่สำเร็จ', type: 'error' });
                    }
                } catch (error) {
                    console.error('Error deleting round:', error);
                    showAlert({ title: 'ข้อผิดพลาด', message: 'ลบรอบประเมินไม่สำเร็จ', type: 'error' });
                }
            }
        });
    };
    const handleStatusChange = async (round, newStatus) => {
        const isActive = newStatus === 'active';
        if (round.is_active === isActive) return;

        if (isActive) {
            showConfirm({
                title: 'เปลี่ยนรอบการประเมิน',
                message: `คุณต้องการเปลี่ยนสถานะรอบ "${round.name}" เป็น "เปิดใช้งาน" ใช่หรือไม่? รอบการประเมินอื่นๆ จะถูกปิดใช้งานโดยอัตโนมัติ`,
                type: 'warning',
                confirmText: 'เปิดใช้งานรอบนี้',
                onConfirm: async () => {
                    await updateRoundStatus(round.id, true);
                }
            });
        } else {
            await updateRoundStatus(round.id, false);
        }
    };

    const updateRoundStatus = async (id, isActive) => {
        try {
            const res = await fetch(`${BASE_URL}/api/rounds/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active: isActive })
            });

            if (res.ok) {
                fetchRounds();
                if (isActive) showAlert({ title: 'สำเร็จ', message: 'เปลี่ยนรอบการประเมินปัจจุบันเรียบร้อยแล้ว', type: 'success' });
            } else {
                showAlert({ title: 'ข้อผิดพลาด', message: 'อัปเดตสถานะไม่สำเร็จ', type: 'error' });
            }
        } catch (error) {
            console.error('Error updating status:', error);
            showAlert({ title: 'ข้อผิดพลาด', message: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้', type: 'error' });
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-prompt">
            <div className="flex-1 container mx-auto px-4 py-8" style={{ backgroundColor: 'gray-50' }}>
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <button
                            onClick={() => setActiveTab('system_management')}
                            className="flex items-center text-gray-500 hover:text-gray-700 mb-2 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 mr-1" />
                            กลับ
                        </button>
                        <h1 className="text-2xl font-semibold text-gray-900 flex items-center">
                            <Clock className="w-8 h-8 mr-2 text-blue-600" />
                            จัดการรอบประเมิน
                        </h1>
                    </div>
                    <button
                        onClick={handleOpenModal}
                        className="bg-blue-600 text-white px-4 py-2 rounded-2xl flex items-center hover:bg-blue-700 transition shadow-sm"
                    >
                        <Plus className="w-5 h-5 mr-1" />
                        เพิ่มรอบประเมิน
                    </button>
                </div>

                <div className="bg-white rounded-2xl shadow overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ปีการศึกษา</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ชื่อรอบ</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ระยะเวลา</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">สถานะ</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">วันที่สร้าง</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">จัดการ</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading ? (
                                <tr><td colSpan="6" className="text-center py-4">กำลังโหลดข้อมูล...</td></tr>
                            ) : rounds.length === 0 ? (
                                <tr><td colSpan="6" className="text-center py-4 text-gray-500">ยังไม่มีรอบประเมินในระบบ</td></tr>
                            ) : (
                                rounds.map((round) => (
                                    <tr key={round.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">{round.year}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{round.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {round.start_date || round.end_date ? (
                                                <div className="text-xs">
                                                    <div>เริ่ม: {round.start_date ? new Date(round.start_date).toLocaleDateString('th-TH') : '-'}</div>
                                                    <div>สิ้นสุด: {round.end_date ? new Date(round.end_date).toLocaleDateString('th-TH') : '-'}</div>
                                                </div>
                                            ) : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <select
                                                value={round.is_active ? 'active' : 'inactive'}
                                                onChange={(e) => handleStatusChange(round, e.target.value)}
                                                className={`text-xs px-2 py-1 rounded-full border ${round.is_active
                                                    ? 'bg-green-100 text-green-800 border-green-200'
                                                    : 'bg-gray-100 text-gray-800 border-gray-200'
                                                    }`}
                                            >
                                                <option value="active">เปิดใช้งาน</option>
                                                <option value="inactive">ปิดใช้งาน</option>
                                            </select>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {(() => {
                                                const dt = round.created_at;
                                                if (!dt) return '-';
                                                const seconds = dt.seconds || dt._seconds;
                                                if (seconds) return new Date(seconds * 1000).toLocaleDateString('th-TH');
                                                return new Date(dt).toLocaleDateString('th-TH');
                                            })()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => handleEdit(round)}
                                                className="text-blue-600 hover:text-blue-900 mr-3"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            {!round.is_active && (
                                                <button
                                                    onClick={() => handleDelete(round)}
                                                    className="text-red-600 hover:text-red-900"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/20 backdrop-blur-md flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 flex flex-col max-h-[95vh]">
                        <div className="px-8 py-5 bg-gray-50/50 border-b border-gray-100 flex justify-between items-center flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-600 rounded-xl shadow-lg shadow-blue-200">
                                    <Clock className="w-5 h-5 text-white" />
                                </div>
                                <h2 className="text-xl font-bold text-gray-900">
                                    {formData.id ? 'แก้ไขรายละเอียดรอบประเมิน' : 'เพิ่มรอบประเมินใหม่'}
                                </h2>
                            </div>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto">
                            <div className="bg-gray-50/50 p-6 rounded-2xl border border-gray-100 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 ml-1 text-gray-500">ปีการศึกษา</label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                                            value={formData.year}
                                            onChange={e => setFormData({ ...formData, year: e.target.value })}
                                            placeholder="เช่น 2567"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 ml-1 text-gray-500">ชื่อรอบ</label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="เช่น ปีการศึกษา 2567"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 ml-1 text-gray-500">วันที่เริ่มต้น</label>
                                        <input
                                            type="date"
                                            className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                                            value={formData.start_date || ''}
                                            onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 ml-1 text-gray-500">วันที่สิ้นสุด</label>
                                        <input
                                            type="date"
                                            className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                                            value={formData.end_date || ''}
                                            onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center p-2">
                                    <input
                                        type="checkbox"
                                        id="is_active"
                                        className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded-2xl transition-all"
                                        checked={formData.is_active}
                                        onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                                    />
                                    <label htmlFor="is_active" className="ml-3 block text-sm font-medium text-gray-700">
                                        ตั้งเป็นรอบปัจจุบัน
                                    </label>
                                </div>
                            </div>

                            <div className="pt-6 flex gap-3 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-6 py-3 bg-white border border-gray-200 text-gray-600 rounded-2xl font-bold hover:bg-gray-50 transition-all active:scale-95 text-sm"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95 flex items-center justify-center gap-2 text-sm"
                                >
                                    <Save className="w-5 h-5" />
                                    {formData.id ? 'บันทึกการแก้ไข' : 'สร้างรอบประเมิน'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
