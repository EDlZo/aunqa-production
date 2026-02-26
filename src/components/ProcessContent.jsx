// src/components/ProcessContent.jsx
export default function ProcessContent({ hasPermission }) {
  return (
    <div className="space-y-8">
      {/* ส่วนขั้นตอนการประเมิน */}
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-gray-900">ขั้นตอนการประเมิน</h3>
          {hasPermission('edit_assessments') && (
            <button className="bg-blue-600 text-white px-4 py-2 rounded-2xl text-sm hover:bg-blue-700 transition-colors">
              แก้ไขขั้นตอน
            </button>
          )}
        </div>
        <div className="space-y-6">
          {[
            { step: 1, title: "การเตรียมความพร้อม", desc: "จัดเตรียมเอกสารและข้อมูลที่จำเป็น", duration: "3 เดือน" },
            { step: 2, title: "การประเมินตนเอง", desc: "ดำเนินการประเมินภายในตามมาตรฐาน", duration: "6 เดือน" },
            { step: 3, title: "การตรวจประเมินภายนอก", desc: "คณะกรรมการเข้าตรวจประเมิน", duration: "1 สัปดาห์" },
            { step: 4, title: "การรายงานผล", desc: "ประกาศผลการประเมินและข้อเสนอแนะ", duration: "1 เดือน" }
          ].map((item, index) => (
            <div key={index} className="flex items-start space-x-4 group">
              <div className="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm group-hover:scale-110 transition-transform">
                {item.step}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-gray-900">{item.title}</h4>
                  <span className="text-sm text-blue-600 bg-blue-100 px-3 py-1 rounded-full">{item.duration}</span>
                </div>
                <p className="text-gray-600 mt-1">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}