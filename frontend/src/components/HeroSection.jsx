// src/components/HeroSection.jsx
import React from 'react';
import { FileText, ChevronRight, Award, Users, Target, TrendingUp } from 'lucide-react';

export default function HeroSection({ onGoResults, onGoProcess, publicStats }) {
  const stats = [
    { icon: <Award className="w-6 h-6" />, label: "มาตรฐานสากล", value: "AUN-QA" },
    { icon: <Users className="w-6 h-6" />, label: "ผู้ประเมิน", value: `${publicStats?.userCount || 0}` },
    { icon: <Target className="w-6 h-6" />, label: "ตัวบ่งชี้", value: `${publicStats?.indicatorCount || 0}` },
    { icon: <TrendingUp className="w-6 h-6" />, label: "คะแนนเฉลี่ย", value: `${publicStats?.averageScore || "0.0"}` }
  ];

  // Helper for dynamic component bars
  const defaultComponents = [

  ];

  const displayComponents = publicStats?.topComponents?.length > 0
    ? publicStats.topComponents.map((c, i) => ({
      ...c,
      color: i === 0 ? "bg-green-500" : i === 1 ? "bg-blue-500" : "bg-purple-500"
    }))
    : defaultComponents;

  return (
    <section className="relative bg-gradient-to-br from-blue-50 via-white to-indigo-50 overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}
        ></div>
      </div>

      <div className="relative container mx-auto px-4 py-16 lg:py-24">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-medium">
                <Award className="w-4 h-4 mr-2" />
                ระบบประกันคุณภาพระดับสากล
              </div>
              <h1 className="text-4xl lg:text-6xl font-bold text-gray-900 leading-tight">
                ระบบประกันคุณภาพ <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                  AUN-QA
                </span>
              </h1>
              <p className="text-lg text-gray-600 leading-relaxed max-w-2xl">
                แพลตฟอร์มการประเมินคุณภาพการศึกษามาตรฐานสากล สำหรับมหาวิทยาลัยเทคโนโลยีราชมงคลศรีวิชัย
                ดูแลโดยคณะกรรมการประกันคุณภาพภายในสถาบัน
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={onGoResults}
                className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-medium rounded-2xl hover:bg-blue-700 transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl"
              >
                <FileText className="w-5 h-5 mr-2" />
                ดูผลการประเมิน
                <ChevronRight className="w-4 h-4 ml-2" />
              </button>
              <button
                onClick={onGoProcess}
                className="inline-flex items-center justify-center px-6 py-3 bg-white text-gray-700 font-medium rounded-2xl border border-gray-300 hover:bg-gray-50 transition-all duration-200"
              >
                <ChevronRight className="w-5 h-5 mr-2" />
                แนวทางและขั้นตอน
              </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 pt-8">
              {stats.map((stat, index) => (
                <div key={index} className="text-center group">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl mb-3 group-hover:bg-blue-200 transition-colors">
                    {stat.icon}
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                  <div className="text-sm text-gray-600">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Content - Visual Element */}
          <div className="relative">
            <div className="relative bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">ภาพรวมการประเมิน</h3>
                  <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                    ดำเนินการแล้ว
                  </span>
                </div>

                <div className="space-y-3">
                  {displayComponents.map((comp, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl">
                      <span className="text-sm text-gray-600 truncate max-w-[150px]" title={comp.name}>{comp.name}</span>
                      <div className="flex items-center">
                        <div className="w-24 bg-gray-200 rounded-full h-2 mr-2">
                          <div className={`${comp.color} h-2 rounded-full transition-all duration-1000`} style={{ width: `${comp.progress}%` }}></div>
                        </div>
                        <span className="text-sm font-medium">{comp.progress}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Floating Elements */}
            <div className="absolute -top-4 -right-4 w-20 h-20 bg-blue-100 rounded-full opacity-50 blur-xl"></div>
          </div>
        </div>
      </div>
    </section>
  );
}