// src/pages/IndicatorDetail.jsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { BASE_URL } from '../config/api.js';


export default function IndicatorDetail() {
  const { componentId } = useParams();
  const [indicators, setIndicators] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${BASE_URL}/api/indicators-by-component/${componentId}`)
      .then(res => res.json())
      .then(data => setIndicators(data))
      .catch(() => setError('ไม่สามารถโหลดตัวบ่งชี้ได้'));
  }, [componentId]);

  if (error) return <div>{error}</div>;
  if (!indicators.length) return <div>ไม่มีตัวบ่งชี้สำหรับองค์ประกอบนี้</div>;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold mb-4">ตัวบ่งชี้สำหรับองค์ประกอบ {componentId}</h2>
      <ul className="list-disc pl-6">
        {indicators.map(ind => (
          <li key={ind.id}>
            {ind.sequence}. {ind.indicator_name} ({ind.indicator_type} / {ind.criteria_type})
          </li>
        ))}
      </ul>
    </div>
  );
}
