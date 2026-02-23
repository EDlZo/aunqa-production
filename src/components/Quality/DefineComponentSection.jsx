// src/components/DefineComponentSection.jsx
import React, { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useModal } from '../../context/ModalContext';
import QualityComponentsTable from '../Quality/QualityComponentsTable';
import AddQualityForm from './AddQualityForm';
import EditQualityForm from './EditQualityForm'; // เพิ่ม modal แก้ไข
import IndicatorForm from '../IndicatorForm';
import IndicatorTable from '../IndicatorTable';
import InstructionsSection from '../InstructionsSection';
import { AUNQA_SUBITEMS } from '../../templates/aunqa';
import { BASE_URL } from '../../config/api.js';


function pad2(n) {
  try { return String(parseInt(String(n), 10)).padStart(2, '0'); } catch { return '00'; }
}

// Helper to pad sequence like "1" to "01" or "1.1" to "01.01"
const normalizeSequence = (seq) => {
  if (!seq) return '';
  return String(seq).split('.')
    .map(part => {
      const p = part.trim();
      return p.length === 1 ? '0' + p : p;
    })
    .join('.');
};

// seedIndicatorsForMainCode removed as it is unused and logic is handled elsewhere


export default function DefineComponentSection({ forcedMajor, forcedYear }) {
  const { showAlert, showConfirm } = useModal();
  const [qualityName, setQualityName] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [componentId, setComponentId] = useState('1');
  const [activeRound, setActiveRound] = useState(null);

  // Fetch active round
  useEffect(() => {
    fetch(`${BASE_URL}/api/rounds`)
      .then(res => res.json())
      .then(data => {
        const active = data.find(r => r.is_active);
        if (active) setActiveRound(active);
      })
      .catch(err => console.error('Failed to load rounds', err));
  }, []);

  const [showIndicatorForm, setShowIndicatorForm] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [indicatorSequence, setIndicatorSequence] = useState('');
  const [indicatorType, setIndicatorType] = useState('');
  const [criteriaType, setCriteriaType] = useState('');
  const [indicatorName, setIndicatorName] = useState('');
  const [dataSource, setDataSource] = useState('');
  const [indicators, setIndicators] = useState({});
  const [isAssessing, setIsAssessing] = useState(false);
  const [evaluatedMap, setEvaluatedMap] = useState({}); // { [indicatorId]: true }

  const [editItem, setEditItem] = useState(null); // สำหรับ modal แก้ไข
  const [selectedIndicator, setSelectedIndicator] = useState(null);
  const [currentContext, setCurrentContext] = useState({ facultyName: '', majorName: '' });

  // ดึงข้อมูลจาก backend
  useEffect(() => {
    const fetchQualityComponents = async () => {
      try {
        let sessionId = localStorage.getItem('assessment_session_id');
        if (!sessionId) {
          sessionId = Math.floor(Date.now() / 1000).toString();
          localStorage.setItem('assessment_session_id', sessionId);
        }

        let major = forcedMajor !== undefined ? forcedMajor : '';
        if (forcedMajor === undefined) {
          const sel = localStorage.getItem('selectedProgramContext');
          if (sel) {
            try {
              const parsed = JSON.parse(sel);
              major = parsed?.majorName || parsed?.major_name || '';
            } catch { }
          }
        }

        const year = forcedYear || activeRound?.year || '';

        if (!year) return; // Prevent early fetch

        setCurrentContext({
          facultyName: '',
          majorName: major
        });

        const qs = new URLSearchParams({
          session_id: sessionId,
          major_name: major,
          year: year
        }).toString();

        const res = await fetch(`${BASE_URL}/api/quality-components?${qs}`);
        if (res.ok) {
          const data = await res.json();
          setItems(Array.isArray(data) ? data : []);
        } else {
          console.warn('API response not OK:', res.status, res.statusText);
          setItems([]);
        }
      } catch (error) {
        console.error('Error fetching quality components:', error);
        setItems([]);
        setError('ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
      } finally {
        setLoading(false);
      }
    };
    fetchQualityComponents();
  }, [activeRound, forcedMajor, forcedYear]);

  // ฟังก์ชันเพิ่มองค์ประกอบ
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!componentId || !qualityName) return;

    // Check for existing component_id for this year/major
    const exists = items.some(item => parseInt(item.component_id) === parseInt(componentId));
    if (exists) {
      setError(`มีองค์ประกอบที่ ${componentId} อยู่ในระบบแล้ว`);
      return;
    }

    const ctx = (() => {
      try {
        let sessionId = localStorage.getItem('assessment_session_id');
        if (!sessionId) {
          sessionId = Math.floor(Date.now() / 1000).toString();
          localStorage.setItem('assessment_session_id', sessionId);
        }
        const sel = localStorage.getItem('selectedProgramContext');
        const major = sel ? (JSON.parse(sel)?.majorName || JSON.parse(sel)?.major_name || '') : '';
        return { session_id: sessionId, major_name: major, year: activeRound?.year };
      } catch { return { session_id: '', major_name: '', year: activeRound?.year }; }
    })();

    const newItem = {
      component_id: !isNaN(componentId) && !isNaN(parseInt(componentId)) ? parseInt(componentId) : componentId,
      quality_name: qualityName,
      ...ctx
    };
    const res = await fetch(`${BASE_URL}/api/quality-components`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newItem)
    });

    if (res.ok) {
      const result = await res.json();
      setItems([...items, { ...newItem, id: result.id }]);

      setComponentId('1');
      setQualityName('');
      setShowAddForm(false);
    } else {
      setError('บันทึกข้อมูลไม่สำเร็จ');
    }
  };

  // ฟังก์ชันลบองค์ประกอบ
  const handleDelete = async (id) => {
    showConfirm({
      title: 'ยืนยันการลบ',
      message: 'ยืนยันการลบองค์ประกอบนี้? ข้อมูลตัวบ่งชี้ภายในจะถูกลบทั้งหมด',
      type: 'error',
      onConfirm: async () => {
        const ctxParams = (() => {
          try {
            const sessionId = localStorage.getItem('assessment_session_id') || '';
            const sel = localStorage.getItem('selectedProgramContext');
            const major = sel ? (JSON.parse(sel)?.majorName || JSON.parse(sel)?.major_name || '') : '';
            return new URLSearchParams({ session_id: sessionId, major_name: major }).toString();
          } catch { return ''; }
        })();

        const res = await fetch(`${BASE_URL}/api/quality-components/${id}?${ctxParams}`, { method: 'DELETE' });
        if (res.ok) {
          setItems(items.filter(item => item.id !== id));
          showAlert({ title: 'สำเร็จ', message: 'ลบองค์ประกอบเรียบร้อยแล้ว', type: 'success' });
        } else {
          setError('ลบข้อมูลไม่สำเร็จ');
          showAlert({ title: 'ข้อผิดพลาด', message: 'ลบข้อมูลไม่สำเร็จ', type: 'error' });
        }
      }
    });
  };

  // ฟังก์ชันแก้ไของค์ประกอบ
  const handleEdit = (item) => {
    setEditItem(item);
  };

  const handleSaveEdit = async (updatedItem) => {
    try {
      console.log('ส่งข้อมูลแก้ไขไปยัง backend:', updatedItem); // log ข้อมูลที่ส่ง

      const ctx = (() => {
        try {
          const sessionId = localStorage.getItem('assessment_session_id') || '';
          const sel = localStorage.getItem('selectedProgramContext');
          const major = sel ? (JSON.parse(sel)?.majorName || JSON.parse(sel)?.major_name || '') : '';
          return { session_id: sessionId, major_name: major };
        } catch { return { session_id: '', major_name: '' }; }
      })();

      const res = await fetch(`${BASE_URL}/api/quality-components/${updatedItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updatedItem, ...ctx })
      });

      console.log('HTTP response status:', res.status); // log status code

      if (res.ok) {
        const result = await res.json();
        console.log('ผลลัพธ์จาก backend:', result); // log response body
        setItems(prev => prev.map(it => it.id === updatedItem.id ? updatedItem : it));
        setEditItem(null);
      } else {
        const errorText = await res.text(); // อ่านข้อความ error จาก server
        console.error('แก้ไขข้อมูลไม่สำเร็จ:', errorText);
        setError('แก้ไขข้อมูลไม่สำเร็จ');
      }
    } catch (err) {
      console.error('เกิดข้อผิดพลาดในการแก้ไขข้อมูล:', err);
      setError('เกิดข้อผิดพลาดในการแก้ไขข้อมูล');
    }
  };



  // ฟังก์ชันเปิดฟอร์มตัวบ่งชี้
  const openIndicatorForm = (component) => {
    setSelectedComponent(component);
    setShowIndicatorForm(true);
  };

  // ดึง indicators จาก backend ทุกครั้งที่เลือก component หรือเปิดฟอร์มตัวบ่งชี้
  useEffect(() => {
    if (!selectedComponent || !activeRound) return; // Wait for activeRound

    try {
      const sessionId = localStorage.getItem('assessment_session_id') || '';
      const sel = localStorage.getItem('selectedProgramContext');
      const major = sel ? (JSON.parse(sel)?.majorName || JSON.parse(sel)?.major_name || '') : '';
      const qsObj = { session_id: sessionId, major_name: major };
      if (activeRound && activeRound.year) {
        qsObj.year = activeRound.year;
      }
      const qs = new URLSearchParams(qsObj).toString();
      fetch(`${BASE_URL}/api/indicators-by-component/${selectedComponent.component_id}?${qs}`)
        .then(res => res.json())
        .then(async (data) => {
          setIndicators(prev => ({ ...prev, [selectedComponent.id]: data }));
          // ดึงประวัติการประเมินเพื่อทำเครื่องหมายสถานะหลังรีเฟรช
          try {
            const history = await fetch(`${BASE_URL}/api/evaluations/history?${qs}`).then(r => r.json());
            const map = {};
            if (Array.isArray(history)) {
              history.forEach(row => {
                if (row.indicator_id && row.session_id == sessionId) {
                  map[row.indicator_id] = true;
                }
              });
            }
            setEvaluatedMap(map);
          } catch { }
        })
        .catch(() => {
          setIndicators(prev => ({ ...prev, [selectedComponent.id]: [] }));
        });
    } catch {
      setIndicators(prev => ({ ...prev, [selectedComponent.id]: [] }));
    }
  }, [selectedComponent, showIndicatorForm, activeRound]); // Add activeRound dependency

  // ฟังก์ชันเพิ่มตัวบ่งชี้ (Refactored to accept payload from IndicatorTable)
  const handleAddIndicator = async (indicatorData) => {
    // If called via event (legacy), we shouldn't really support it here anymore, 
    // but let's handle the payload structure.
    if (!selectedComponent) return;

    const ctx = (() => {
      try {
        const sessionId = localStorage.getItem('assessment_session_id') || '';
        const sel = localStorage.getItem('selectedProgramContext');
        const major = sel ? (JSON.parse(sel)?.majorName || JSON.parse(sel)?.major_name || '') : '';
        // Use activeRound.year if available, otherwise fallback to null (which backend might handle or error)
        return { session_id: sessionId, major_name: major, year: activeRound?.year };
      } catch { return { session_id: '', major_name: '', year: activeRound?.year }; }
    })();

    if (!ctx.year) {
      showAlert({
        title: 'ข้อมูลไม่พร้อม',
        message: 'กรุณารอข้อมูลปีการศึกษาโหลดสักครู่ หรือตรวจสอบการตั้งค่ารอบการประเมิน',
        type: 'warning'
      });
      return;
    }

    const newIndicator = {
      component_id: indicatorData.component_id || selectedComponent.component_id,
      sequence: indicatorData.sequence || indicatorSequence, // Fallback if needed
      indicator_type: indicatorData.indicator_type || indicatorType,
      criteria_type: indicatorData.criteria_type || criteriaType,
      indicator_name: indicatorData.indicator_name || indicatorName,
      data_source: indicatorData.data_source || dataSource,
      ...ctx
    };

    try {
      // NOTE: Clientside duplicate check is now handled in IndicatorTable/Form. 
      // We just perform the save here.

      const res = await fetch(`${BASE_URL}/api/indicators`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newIndicator)
      });

      if (res.ok) {
        const result = await res.json();
        const addedItem = {
          ...newIndicator,
          id: result.id
        };

        setIndicators(prev => {
          const newList = [...(prev[selectedComponent.id] || []), addedItem];
          // เรียงลำดับทันทีในหน้าจอโดยใช้ numeric sorting
          newList.sort((a, b) => normalizeSequence(a.sequence).localeCompare(normalizeSequence(b.sequence), undefined, { numeric: true }));
          return { ...prev, [selectedComponent.id]: newList };
        });

        // Reset form states in parent if any (mostly handled in child now)
        setError('');
      } else {
        setError('บันทึกตัวบ่งชี้ไม่สำเร็จ');
        throw new Error('Save failed'); // Construct error to let child know
      }
    } catch (err) {
      setError('เกิดข้อผิดพลาดในการบันทึกตัวบ่งชี้');
      throw err;
    }
  };


  // ฟังก์ชันลบตัวบ่งชี้
  const handleDeleteIndicator = async (indicatorId, componentId) => {
    // หาตัวบ่งชี้ที่จะลบเพื่อเช็คว่าเป็นหัวข้อหลักหรือไม่
    const list = indicators[componentId] || [];
    const target = list.find(i => i.id === indicatorId);
    if (!target) return;

    // เช็คว่ามีลูกหรือไม่
    const isMain = !String(target.sequence).includes('.');
    const idsToDelete = [indicatorId];

    if (isMain) {
      const prefix = String(target.sequence) + '.';
      const subs = list.filter(i => String(i.sequence).startsWith(prefix));
      if (subs.length > 0) {
        showConfirm({
          title: 'ยืนยันการลบลำดับหลัก',
          message: `ยืนยันการลบตัวบ่งชี้ ${target.sequence} และข้อย่อยทั้งหมดจำนวน ${subs.length} รายการ?`,
          type: 'error',
          onConfirm: () => performDeleteIndicator(indicatorId, componentId, subs.map(s => s.id))
        });
      } else {
        showConfirm({
          title: 'ยืนยันการลบ',
          message: 'ยืนยันการลบตัวบ่งชี้นี้?',
          type: 'warning',
          onConfirm: () => performDeleteIndicator(indicatorId, componentId, [])
        });
      }
    } else {
      showConfirm({
        title: 'ยืนยันการลบ',
        message: 'ยืนยันการลบตัวบ่งชี้นี้?',
        type: 'warning',
        onConfirm: () => performDeleteIndicator(indicatorId, componentId, [])
      });
    }
  };

  const performDeleteIndicator = async (indicatorId, componentId, subIds = []) => {
    const idsToDelete = [indicatorId, ...subIds];
    try {
      const ctxParams = (() => {
        try {
          const sessionId = localStorage.getItem('assessment_session_id') || '';
          const sel = localStorage.getItem('selectedProgramContext');
          const major = sel ? (JSON.parse(sel)?.majorName || JSON.parse(sel)?.major_name || '') : '';
          return new URLSearchParams({ session_id: sessionId, major_name: major }).toString();
        } catch { return ''; }
      })();

      // ลบทั้งหมดแบบ Parallel
      await Promise.all(idsToDelete.map(id =>
        fetch(`${BASE_URL}/api/indicators/${id}?${ctxParams}`, { method: 'DELETE' })
      ));

      setIndicators(prev => ({
        ...prev,
        [componentId]: prev[componentId].filter(ind => !idsToDelete.includes(ind.id))
      }));
      showAlert({ title: 'สำเร็จ', message: 'ลบตัวบ่งชี้เรียบร้อยแล้ว', type: 'success' });
    } catch (err) {
      console.error('Delete error', err);
      setError('เกิดข้อผิดพลาดในการลบตัวบ่งชี้');
      showAlert({ title: 'ข้อผิดพลาด', message: 'ไม่สามารถลบตัวบ่งชี้ได้', type: 'error' });
    }
  };

  const handleUpdateIndicator = async (indicatorId, updatedData) => {
    if (!selectedComponent) return;
    try {
      const res = await fetch(`${BASE_URL}/api/indicators/${indicatorId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      });

      if (res.ok) {
        setIndicators(prev => {
          const list = prev[selectedComponent.id] || [];
          const newList = list.map(ind => ind.id === indicatorId ? { ...ind, ...updatedData } : ind);
          // Sort after update as sequence might change
          newList.sort((a, b) => normalizeSequence(a.sequence).localeCompare(normalizeSequence(b.sequence), undefined, { numeric: true }));
          return { ...prev, [selectedComponent.id]: newList };
        });
      } else {
        throw new Error('บันทึกการแก้ไขไม่สำเร็จ');
      }
    } catch (err) {
      console.error('Update indicator error:', err);
      throw err;
    }
  };

  // ฟังก์ชันแก้ไขตัวบ่งชี้ (ส่งต่อไปยัง IndicatorTable)
  const handleEditIndicator = (indicator) => {
    // This state is actually owned by IndicatorTable now
    setSelectedIndicator(indicator);
  };

  // ฟังก์ชันเปิด/ปิดฟอร์ม
  const openAddForm = () => setShowAddForm(true);
  const closeAddForm = () => {
    setShowAddForm(false);
    setQualityName('');
    setError('');
  };

  const closeIndicatorForm = () => {
    setShowIndicatorForm(false);
    setSelectedComponent(null);
    setIndicatorName('');
    setIndicatorType('');
    setCriteriaType('');
    setDataSource('');
    setIndicatorSequence('');
    setError('');
  };

  // แสดงฟอร์มเพิ่มองค์ประกอบ
  if (showAddForm) {
    return (
      <AddQualityForm
        qualityName={qualityName}
        componentId={componentId}
        setComponentId={setComponentId}
        setQualityName={setQualityName}
        onSubmit={handleAdd}
        onCancel={closeAddForm}
        error={error}
      />
    );
  }

  // แสดงฟอร์มตัวบ่งชี้
  if (selectedComponent) {
    return (
      <div>
        {isAssessing ? null : (
          <button
            onClick={() => setSelectedComponent(null)}
            className="flex items-center text-gray-500 hover:text-gray-700 mb-2 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-1" />
            กลับ
          </button>
        )}
        {/* UI เพิ่มหัวข้อย่อยโดยอัตโนมัติถูกถอดออก ตามคำขอ */}
        {/* ฟอร์มย้ายไปอยู่ใน IndicatorTable ให้แสดงเพียงอันเดียวตลอด */}
        <IndicatorTable
          selectedComponent={selectedComponent}
          indicators={indicators}
          onEditClick={handleEditIndicator}
          onDeleteClick={handleDeleteIndicator}
          onAddIndicator={handleAddIndicator}
          onUpdateIndicator={handleUpdateIndicator}
          onAfterBulkAdded={async (healedId) => {
            try {
              const sessionId = localStorage.getItem('assessment_session_id') || '';
              const sel = localStorage.getItem('selectedProgramContext');
              const major = sel ? (JSON.parse(sel)?.majorName || JSON.parse(sel)?.major_name || '') : '';
              const qsObj = { session_id: sessionId, major_name: major };
              if (activeRound && activeRound.year) {
                qsObj.year = activeRound.year; // Ensure refresh uses year
              }
              const qs = new URLSearchParams(qsObj).toString();

              const targetId = healedId || selectedComponent.component_id;
              const refreshed = await fetch(`${BASE_URL}/api/indicators-by-component/${targetId}?${qs}`).then(r => r.json()).catch(() => []);
              setIndicators(prev => ({ ...prev, [selectedComponent.id]: Array.isArray(refreshed) ? refreshed : [] }));

              // refresh evaluated map as well
              const history = await fetch(`${BASE_URL}/api/evaluations/history?${qs}`).then(r => r.json()).catch(() => []);
              const map = {};
              if (Array.isArray(history)) {
                history.forEach(row => { if (row.indicator_id && row.session_id == sessionId) map[row.indicator_id] = true; });
              }
              setEvaluatedMap(map);
            } catch { }
          }}
          onAssessingChange={setIsAssessing}
          evaluatedMap={evaluatedMap}
          onMarkEvaluated={(indicatorId, val) => setEvaluatedMap(prev => ({ ...prev, [indicatorId]: !!val }))}
        />
      </div>
    );
  }

  // หน้าแสดงตารางหลัก
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
      <div className="text-center mb-8">

      </div>

      <div className="text-center mb-8">
        {activeRound && (
          <div className="px-4 py-3 bg-blue-50 text-blue-700 rounded-lg text-sm font-semibold mb-4 border border-blue-200 inline-flex items-center">
            <span className="mr-2">📅</span> กำลังแก้ไขเกณฑ์สำหรับ: {activeRound.name} (ปี {activeRound.year})
          </div>
        )}
      </div>

      <InstructionsSection />

      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-xl font-semibold text-gray-900">ส่วนที่ 1 องค์ประกอบคุณภาพ ระดับหลักสูตร</h3>
        <button
          onClick={openAddForm}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors shadow-sm"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          เพิ่มองค์ประกอบ
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <QualityComponentsTable
          items={items}
          loading={loading}
          error={error}
          onAddClick={openAddForm}
          onEditClick={handleEdit}
          onDeleteClick={handleDelete}
          onIndicatorClick={openIndicatorForm}
          indicators={indicators}
        />
      </div>

      {/* Modal แก้ไข */}
      {editItem && (
        <EditQualityForm
          item={editItem}
          onSave={handleSaveEdit}
          onCancel={() => setEditItem(null)}
        />
      )}
    </div>
  );
}
