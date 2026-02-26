import React, { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Download, Eye, X, FileText, RotateCw, ZoomIn, ZoomOut } from 'lucide-react';
import { BASE_URL } from '../config/api.js';


// ตั้งค่า worker สำหรับ react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

export default function FileViewer({ filename, onClose }) {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fileExists, setFileExists] = useState(false);

  const isPDF = filename && filename.toLowerCase().endsWith('.pdf');
  const isImage = filename && /\.(jpg|jpeg|png|gif|webp)$/i.test(filename);
  const fileUrl = filename ? `${BASE_URL}/uploads/${filename}` : null;

  // ตรวจสอบว่าไฟล์มีอยู่จริงหรือไม่
  useEffect(() => {
    if (filename) {
      checkFileExists();
    }
  }, [filename]);

  const checkFileExists = async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/check-file/${filename}`);
      if (response.ok) {
        setFileExists(true);
        setLoading(false);
      } else {
        setError('ไม่พบไฟล์');
        setLoading(false);
      }
    } catch (err) {
      console.error('Error checking file:', err);
      setError('ไม่สามารถตรวจสอบไฟล์ได้');
      setLoading(false);
    }
  };

  function onDocumentLoadSuccess({ numPages }) {
    setNumPages(numPages);
    setPageNumber(1);
    setLoading(false);
  }

  function onDocumentLoadError(error) {
    console.error('Error loading PDF:', error);
    setError('ไม่สามารถโหลดไฟล์ PDF ได้');
    setLoading(false);
  }

  function changePage(offset) {
    setPageNumber(prevPageNumber => prevPageNumber + offset);
  }

  function previousPage() {
    changePage(-1);
  }

  function nextPage() {
    changePage(1);
  }

  function zoomIn() {
    setScale(prevScale => Math.min(prevScale + 0.2, 3.0));
  }

  function zoomOut() {
    setScale(prevScale => Math.max(prevScale - 0.2, 0.5));
  }

  function rotate() {
    setRotation(prevRotation => (prevRotation + 90) % 360);
  }

  function downloadFile() {
    if (filename) {
      // ใช้ fetch เพื่อดาวน์โหลดไฟล์
      fetch(`${BASE_URL}/api/download/${filename}`)
        .then(response => {
          if (response.ok) {
            return response.blob();
          }
          throw new Error('ไม่สามารถดาวน์โหลดไฟล์ได้');
        })
        .then(blob => {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        })
        .catch(error => {
          console.error('Download error:', error);
          alert('ไม่สามารถดาวน์โหลดไฟล์ได้: ' + error.message);
        });
    }
  }

  function handleImageLoad() {
    setLoading(false);
  }

  function handleImageError() {
    setError('ไม่สามารถโหลดรูปภาพได้');
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">
            {filename || 'File Viewer'}
          </h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={downloadFile}
              className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-colors"
              title="ดาวน์โหลด"
            >
              <Download className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-colors"
              title="ปิด"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Controls for PDF */}
        {isPDF && (
          <div className="flex items-center justify-between p-4 border-b bg-gray-50">
            <div className="flex items-center space-x-2">
              <button
                onClick={previousPage}
                disabled={pageNumber <= 1}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                ก่อนหน้า
              </button>
              <span className="text-sm text-gray-600">
                หน้า {pageNumber} จาก {numPages || '?'}
              </span>
              <button
                onClick={nextPage}
                disabled={pageNumber >= numPages}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                ถัดไป
              </button>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={zoomOut}
                className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-colors"
                title="ย่อ"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-600 min-w-[60px] text-center">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={zoomIn}
                className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-colors"
                title="ขยาย"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={rotate}
                className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-colors"
                title="หมุน"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* File Content */}
        <div className="flex-1 overflow-auto p-4 flex justify-center">
          <div className="bg-gray-100 rounded-2xl p-4 shadow-inner">
            {loading && (
              <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600">กำลังโหลดไฟล์...</span>
              </div>
            )}
            
            {error && (
              <div className="text-center p-8 text-red-600">
                <p>{error}</p>
                <p className="text-sm text-gray-500 mt-2">กรุณาตรวจสอบไฟล์และลองใหม่อีกครั้ง</p>
                <button
                  onClick={onClose}
                  className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                >
                  ปิด
                </button>
              </div>
            )}

            {!loading && !error && fileExists && fileUrl && (
              <>
                {isPDF && (
                  <Document
                    file={fileUrl}
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={onDocumentLoadError}
                    loading={
                      <div className="flex items-center justify-center p-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <span className="ml-2 text-gray-600">กำลังโหลด PDF...</span>
                      </div>
                    }
                    error={
                      <div className="text-center p-8 text-red-600">
                        <p>ไม่สามารถโหลดไฟล์ PDF ได้</p>
                        <p className="text-sm text-gray-500 mt-2">กรุณาตรวจสอบไฟล์และลองใหม่อีกครั้ง</p>
                      </div>
                    }
                  >
                    <Page
                      pageNumber={pageNumber}
                      scale={scale}
                      rotate={rotation}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                    />
                  </Document>
                )}

                {isImage && (
                  <img
                    src={fileUrl}
                    alt={filename}
                    onLoad={handleImageLoad}
                    onError={handleImageError}
                    className="max-w-full max-h-[70vh] object-contain"
                    style={{ transform: `rotate(${rotation}deg) scale(${scale})` }}
                  />
                )}

                {!isPDF && !isImage && (
                  <div className="text-center p-8 text-gray-500">
                    <FileText className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                    <p>ไม่สามารถแสดงไฟล์ประเภทนี้ได้</p>
                    <p className="text-sm mt-2">กรุณาดาวน์โหลดไฟล์เพื่อดู</p>
                    <button
                      onClick={downloadFile}
                      className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      ดาวน์โหลดไฟล์
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 