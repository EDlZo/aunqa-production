// src/components/Footer.jsx
import React from 'react';
import { BookOpen, MapPin, Mail, Phone } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Main Footer Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
          {/* University Info */}
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-600 rounded-2xl">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white leading-tight">
                  มหาวิทยาลัยเทคโนโลยีราชมงคลศรีวิชัย
                </h3>
                <p className="text-[10px] text-gray-400">Rajamangala University of Technology Srivijaya</p>
              </div>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed max-w-sm">
              แพลตฟอร์มสนับสนุนการประเมินคุณภาพ AUN-QA เพื่อการพัฒนาอย่างต่อเนื่องของคณะ/สาขา มุ่งมั่นสร้างคุณภาพการศึกษาที่ยอดเยี่ยม
            </p>
          </div>

          {/* Contact Info */}
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-gray-700 rounded-2xl flex-shrink-0">
                <MapPin className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-xs">
                <p className="text-gray-300 font-medium">ที่อยู่</p>
                <p className="text-gray-400">1 ถ.ราชมงคลสงขลา ต.บ่อยาง อ.เมือง จ.สงขลา 90000</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gray-700 rounded-2xl flex-shrink-0">
                <Mail className="w-4 h-4 text-blue-400" />
              </div>
              <a href="mailto:saraban@rmutsv.ac.th" className="text-xs text-gray-300 hover:text-blue-400 transition-colors">
                saraban@rmutsv.ac.th
              </a>
            </div>

            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gray-700 rounded-2xl flex-shrink-0">
                <Phone className="w-4 h-4 text-blue-400" />
              </div>
              <a href="tel:+6674317100" className="text-xs text-gray-300 hover:text-blue-400 transition-colors">
                +66 74 317 100
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-gray-700">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-2 md:space-y-0">
            <div className="text-center md:text-left">
              <p className="text-[11px] text-gray-400">
                &copy; {currentYear} มหาวิทยาลัยเทคโนโลยีราชมงคลศรีวิชัย วิทยาเขตสงขลา. สงวนลิขสิทธิ์.
              </p>
            </div>

            <div className="flex items-center space-x-4 text-[11px] text-gray-400">

            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}