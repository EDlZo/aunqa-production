import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, AlertCircle } from 'lucide-react';
import { BASE_URL } from '../config/api.js';

export default function ConnectionStatus() {
  const [status, setStatus] = useState('checking'); // 'online', 'offline', 'checking'
  const [lastCheck, setLastCheck] = useState(null);

  const checkConnection = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(`${BASE_URL}/api/ping`, {
        signal: controller.signal,
        cache: 'no-cache'
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        setStatus(data.firebase ? 'online' : 'limited');
      } else {
        setStatus('offline');
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        setStatus('timeout');
      } else {
        setStatus('offline');
      }
    }
    setLastCheck(new Date());
  };

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const getStatusInfo = () => {
    switch (status) {
      case 'online':
        return {
          icon: <Wifi className="w-4 h-4" />,
          text: 'เชื่อมต่อแล้ว',
          color: 'text-green-600 bg-green-50 border-green-200'
        };
      case 'limited':
        return {
          icon: <AlertCircle className="w-4 h-4" />,
          text: 'โหลดข้อมูลจำกัด',
          color: 'text-yellow-600 bg-yellow-50 border-yellow-200'
        };
      case 'offline':
        return {
          icon: <WifiOff className="w-4 h-4" />,
          text: 'ไม่สามารถเชื่อมต่อได้',
          color: 'text-red-600 bg-red-50 border-red-200'
        };
      case 'timeout':
        return {
          icon: <WifiOff className="w-4 h-4" />,
          text: 'การเชื่อมต่อช้า',
          color: 'text-orange-600 bg-orange-50 border-orange-200'
        };
      default:
        return {
          icon: <AlertCircle className="w-4 h-4 animate-pulse" />,
          text: 'กำลังตรวจสอบ...',
          color: 'text-gray-600 bg-gray-50 border-gray-200'
        };
    }
  };

  const statusInfo = getStatusInfo();

  // Don't show if online
  if (status === 'online') return null;

  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-2xl border text-sm font-medium ${statusInfo.color}`}>
      {statusInfo.icon}
      <span>{statusInfo.text}</span>
      {lastCheck && (
        <button
          onClick={checkConnection}
          className="ml-2 text-xs underline hover:no-underline"
          title="ตรวจสอบการเชื่อมต่อใหม่"
        >
          ลองใหม่
        </button>
      )}
    </div>
  );
}