// src/components/AboutContent.jsx
import React from 'react';
import { Building, BookOpen, Award, Users, Globe, CheckCircle } from 'lucide-react';

export default function AboutContent({ currentUser, rolePermissions, standards }) {
  const userRole = (currentUser && rolePermissions[currentUser.role]) || { name: 'Unknown', color: 'bg-gray-500' };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-gray-900">เกี่ยวกับ AUNQA</h3>
        </div>
        <p className="text-gray-600 leading-relaxed mb-6">
          ASEAN University Network - Quality Assurance (AUNQA) เป็นกลไกการประกันคุณภาพการศึกษาระดับอุดมศึกษา
          ที่มุ่งเน้นการพัฒนาคุณภาพสถาบันการศึกษาในภูมิภาคอาเซียนให้เป็นที่ยอมรับในระดับสากล
        </p>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-6 rounded-2xl">
            <h4 className="font-semibold text-blue-900 mb-2">วิสัยทัศน์</h4>
            <p className="text-blue-800 text-sm">
              เป็นผู้นำในการประกันคุณภาพการศึกษาระดับอุดมศึกษาในอาเซียน
            </p>
          </div>
          <div className="bg-gradient-to-r from-green-50 to-green-100 p-6 rounded-2xl">
            <h4 className="font-semibold text-green-900 mb-2">พันธกิจ</h4>
            <p className="text-green-800 text-sm">
              ส่งเสริมและพัฒนาระบบการประกันคุณภาพที่เป็นเลิศ
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-8">
        <h3 className="text-2xl font-bold text-gray-900 mb-6">มาตรฐานการประเมิน</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {standards.map((standard, index) => (
            <div key={index} className="group hover:scale-105 transition-transform duration-300">
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-6 rounded-2xl border border-gray-200 hover:shadow-lg transition-shadow">
                <div className={`${standard.color} w-12 h-12 rounded-2xl flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform`}>
                  {standard.icon}
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">{standard.title}</h4>
                <p className="text-gray-600 text-sm">{standard.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div >
  );
}