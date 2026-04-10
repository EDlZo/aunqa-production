import React, { useEffect, useState } from 'react';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Star } from 'lucide-react';
import { Bar, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

export default function ResultsContent({ hasPermission, achievements }) {
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/evaluations')
      .then(res => res.json())
      .then(data => {
        setEvaluations(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // คำนวณคะแนนเฉลี่ย
  const avgScore = evaluations.length > 0
    ? (evaluations.reduce((sum, ev) => sum + Number(ev.score || 0), 0) / evaluations.length).toFixed(2)
    : '-';
  // อัตราผ่านเกณฑ์ (เช่น score >= 4)
  const passCount = evaluations.filter(ev => Number(ev.score) >= 4).length;
  const passRate = evaluations.length > 0 ? ((passCount / evaluations.length) * 100).toFixed(0) : '-';
  // จำนวนปีที่มีผลประเมิน (unique year)
  const years = Array.from(new Set(evaluations.map(ev => ev.year)));

  // --- เตรียมข้อมูลสำหรับ Bar Chart ---
  const avgScoreByYear = years.map(year => {
    const yearEvals = evaluations.filter(ev => ev.year === year);
    if (yearEvals.length === 0) return 0;
    return (
      yearEvals.reduce((sum, ev) => sum + Number(ev.score || 0), 0) / yearEvals.length
    ).toFixed(2);
  });
  const barData = {
    labels: years,
    datasets: [
      {
        label: 'คะแนนเฉลี่ย',
        data: avgScoreByYear,
        backgroundColor: 'rgba(34,197,94,0.7)',
      },
    ],
  };
  const barOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: true, text: 'คะแนนเฉลี่ยแยกตามปี' },
    },
    scales: {
      y: { beginAtZero: true, max: 5 }
    }
  };

  // --- Pie Chart: ผ่าน/ไม่ผ่าน ---
  const passCountPie = evaluations.filter(ev => Number(ev.score) >= 4).length;
  const failCountPie = evaluations.length - passCountPie;
  const pieData = {
    labels: ['ผ่านเกณฑ์', 'ไม่ผ่านเกณฑ์'],
    datasets: [
      {
        data: [passCountPie, failCountPie],
        backgroundColor: ['#22c55e', '#f87171'],
        borderWidth: 1,
      },
    ],
  };
  const pieOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'bottom' },
      title: { display: true, text: 'สัดส่วนผลประเมินที่ผ่านเกณฑ์' },
    },
  };

  // --- ฟังก์ชัน export PDF ---
  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("รายงานผลการประเมิน", 20, 20);
    autoTable(doc, {
      head: [["หัวข้อ", "คะแนน"]],
      body: [
        ["ตัวอย่าง 1", "5"],
        ["ตัวอย่าง 2", "4"],
      ],
    });
    doc.save("report.pdf");
  };

  // return (
  //   <div className="space-y-6">
  //     <div className="bg-white rounded-xl shadow-lg p-8">
  //       <div className="flex items-center justify-between mb-6">
  //         <h3 className="text-2xl font-bold text-gray-900">ผลการประเมิน</h3>
  //         {hasPermission && hasPermission('create_reports') && (
  //           <button className="bg-green-600 text-white px-4 py-2 rounded-2xl text-sm hover:bg-green-700 transition-colors">
  //             สร้างรายงาน
  //           </button>
  //         )}
  //         <button
  //           className="bg-green-600 text-white px-4 py-2 rounded-2xl text-sm hover:bg-green-700 transition-colors"
  //           onClick={handleExportPDF}
  //         >
  //           ดาวน์โหลดรายงาน PDF
  //         </button>
  //       </div>
  //       <div className="space-y-4">
  //         {achievements && achievements.map((achievement, index) => (
  //           <div key={index} className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-2xl border border-green-200">
  //             <div className="flex items-center space-x-4">
  //               <div className="bg-green-500 text-white rounded-full w-12 h-12 flex items-center justify-center font-bold">
  //                 {achievement.year}
  //               </div>
  //               <div>
  //                 <h4 className="font-semibold text-green-900">{achievement.title}</h4>
  //                 <p className="text-green-700 text-sm">คะแนน: {achievement.score}</p>
  //               </div>
  //             </div>
  //             <Star className="w-8 h-8 text-yellow-500 fill-yellow-500" />
  //           </div>
  //         ))}
  //       </div>
  //     </div>
  //     <div className="bg-white rounded-xl shadow-lg p-8">
  //       <h3 className="text-2xl font-bold text-gray-900 mb-6">สถิติการประเมิน</h3>
  //       {loading ? (
  //         <div className="text-gray-400">กำลังโหลด...</div>
  //       ) : (
  //         <div className="grid md:grid-cols-3 gap-6">
  //           <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl">
  //             <div className="text-3xl font-bold text-blue-600 mb-2">{avgScore}</div>
  //             <div className="text-blue-800 font-medium">คะแนนเฉลี่ย</div>
  //           </div>
  //           <div className="text-center p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-2xl">
  //             <div className="text-3xl font-bold text-green-600 mb-2">{passRate}%</div>
  //             <div className="text-green-800 font-medium">อัตราผ่านเกณฑ์</div>
  //           </div>
  //           <div className="text-center p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl">
  //             <div className="text-3xl font-bold text-purple-600 mb-2">{years.length}</div>
  //             <div className="text-purple-800 font-medium">จำนวนปีที่ผ่าน</div>
  //           </div>
  //         </div>
  //       )}
  //     </div>
  //     {/* --- กราฟคะแนนเฉลี่ยแยกตามปี --- */}
  //     {!loading && years.length > 0 && (
  //       <div className="bg-white rounded-xl shadow-lg p-8">
  //         <h3 className="text-2xl font-bold text-gray-900 mb-6">กราฟคะแนนเฉลี่ยแยกตามปี</h3>
  //         <Bar data={barData} options={barOptions} />
  //       </div>
  //     )}
  //     {/* --- Pie Chart --- */}
  //     {!loading && evaluations.length > 0 && (
  //       <div className="bg-white rounded-xl shadow-lg p-8">
  //         <h3 className="text-2xl font-bold text-gray-900 mb-6">กราฟสัดส่วนผลประเมินที่ผ่านเกณฑ์</h3>
  //         <Pie data={pieData} options={pieOptions} />
  //       </div>
  //     )}
  //   </div>
  // );
}