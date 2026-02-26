// src/components/Admin/MasterComponentsTable.jsx
import React, { useState } from 'react';
import { Search, Filter, Edit2, Trash2, Plus, ArrowUpDown } from 'lucide-react';

export default function MasterComponentsTable({ items, onEdit, onDelete, onAdd }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [majorFilter, setMajorFilter] = useState('all');
    const [yearFilter, setYearFilter] = useState('all');

    const majors = ['all', ...new Set(items.map(item => item.major_name || 'Global'))];
    const years = ['all', ...new Set(items.map(item => item.year || 'N/A'))];

    const filteredItems = items.filter(item => {
        const matchesSearch = item.quality_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            String(item.component_id).includes(searchTerm);
        const matchesMajor = majorFilter === 'all' || (item.major_name || 'Global') === majorFilter;
        const matchesYear = yearFilter === 'all' || (item.year || 'N/A') === yearFilter;
        return matchesSearch && matchesMajor && matchesYear;
    });

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-6 p-2">
                <div className="relative flex-1 group w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="ค้นหาตามชื่อหรือรหัสองค์ประกอบ..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <select
                        className="flex-1 md:flex-none px-3 py-2 border border-gray-200 rounded-md text-sm text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        value={majorFilter}
                        onChange={(e) => setMajorFilter(e.target.value)}
                    >
                        <option value="all">ทุกหลักสูตร</option>
                        {majors.filter(m => m !== 'all').map(m => (
                            <option key={m} value={m}>{m}</option>
                        ))}
                    </select>
                    <select
                        className="flex-1 md:flex-none px-3 py-2 border border-gray-200 rounded-md text-sm text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        value={yearFilter}
                        onChange={(e) => setYearFilter(e.target.value)}
                    >
                        <option value="all">ทุกปีการศึกษา</option>
                        {years.filter(y => y !== 'all').map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                    <button
                        onClick={onAdd}
                        className="bg-blue-600 text-white px-4 py-2 rounded-md flex items-center hover:bg-blue-700 transition-colors whitespace-nowrap"
                    >
                        <Plus className="w-5 h-5 mr-1" />
                        เพิ่มองค์ประกอบ
                    </button>
                </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden mb-6">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">ลำดับ</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ชื่อองค์ประกอบคุณภาพ</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">หลักสูตร</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-32">ปีการศึกษา</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">จัดการ</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredItems.map((item) => (
                            <tr key={item.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                    <span className="inline-flex items-center justify-center w-7 h-7 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">
                                        {item.component_id}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="text-sm font-medium text-gray-900">{item.quality_name}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 py-1 text-xs rounded-full ${item.major_name ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}>
                                        {item.major_name || 'Global'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                                    {item.year || '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button
                                        onClick={() => onEdit(item)}
                                        className="text-blue-600 hover:text-blue-900 mr-3"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => onDelete(item.id)}
                                        className="text-red-600 hover:text-red-900"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {filteredItems.length === 0 && (
                            <tr>
                                <td colSpan="5" className="px-6 py-12 text-center text-gray-500 italic">
                                    ไม่พบข้อมูลองค์ประกอบคุณภาพตามเงื่อนไขที่ระบุ
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <div className="text-xs text-gray-400 px-2">
                * ข้อมูล 'Global' คือเกณฑ์มาตรฐานกลางที่ใช้ร่วมกัน หากระบุหลักสูตรจะเป็นเกณฑ์เฉพาะของหลักสูตรนั้น
            </div>
        </div>
    );
}
