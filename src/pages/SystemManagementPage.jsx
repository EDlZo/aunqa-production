import React, { useEffect } from 'react';
import { Users, Settings, Clock, Shield, ChevronRight, School, Database } from 'lucide-react';

export default function SystemManagementPage({ setActiveTab }) {
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const menus = [
        {
            id: 'user_management',
            title: 'จัดการผู้ใช้งาน',
            description: 'เพิ่ม ลบ แก้ไขข้อมูลผู้ใช้งานและกำหนดสิทธิ์การเข้าถึง',
            icon: <Users className="w-8 h-8 text-blue-600" />,
            color: 'bg-blue-50 text-blue-600',
            action: () => setActiveTab('user_management')
        },
        {
            id: 'round_management',
            title: 'จัดการรอบประเมิน',
            description: 'กำหนดปีการศึกษาและจัดการสถานะรอบการประเมิน',
            icon: <Clock className="w-8 h-8 text-blue-600" />,
            color: 'bg-blue-50 text-blue-600',
            action: () => setActiveTab('round_management')
        },
        {
            id: 'program_management',
            title: 'จัดการหน่วยงานและหลักสูตร',
            description: 'เพิ่ม ลบ แก้ไขข้อมูลระดับการศึกษา คณะ และสาขาวิชา',
            icon: <School className="w-8 h-8 text-blue-600" />,
            color: 'bg-blue-50 text-blue-600',
            action: () => setActiveTab('program_management')
        },
        {
            id: 'database_management',
            title: 'จัดการฐานข้อมูล',
            description: 'ตรวจสอบสถิติ ล้างข้อมูล และรีเซ็ตระบบฐานข้อมูล',
            icon: <Database className="w-8 h-8 text-blue-600" />,
            color: 'bg-blue-50 text-blue-600',
            action: () => setActiveTab('database_management')
        }
    ];

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-prompt">
            <div className="flex-1 container mx-auto px-4 py-8" style={{ backgroundColor: 'gray-50' }}>
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-100 rounded-2xl">
                            <Shield className="w-6 h-6 text-blue-600" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900">จัดการระบบ (System Management)</h1>
                    </div>
                    <p className="text-gray-600 ml-11">ศูนย์รวมการจัดการและตั้งค่าระบบสำหรับผู้ดูแลระบบ</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {menus.map((menu) => (
                        <button
                            key={menu.id}
                            onClick={menu.action}
                            className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200 text-left group"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className={`p-3 rounded-xl ${menu.color}`}>
                                    {menu.icon}
                                </div>
                                <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-500 transition-colors" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                                {menu.title}
                            </h3>
                            <p className="text-sm text-gray-500 leading-relaxed">
                                {menu.description}
                            </p>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
