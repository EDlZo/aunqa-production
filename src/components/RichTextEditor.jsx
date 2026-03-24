// Lightweight rich text editor using contenteditable and document.execCommand
// Provides Word-like basic formatting without external dependencies
import React, { useEffect, useRef, useState } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List as BulletList,
  ListOrdered,
  IndentIncrease,
  IndentDecrease,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link as LinkIcon,
  Unlink,
  Image as ImageIcon,
  Table as TableIcon,
  Undo2,
  Redo2,
  Eraser,
  Quote,
  ChevronRight,
  Trash2,
} from 'lucide-react';

export default function RichTextEditor({
  value,
  onChange,
  placeholder,
  ariaLabel,
  minHeight = 120,
  readOnly = false,
  pageMode = false // New prop to simulate A4 Page width
}) {
  const editorRef = useRef(null);
  const toolbarRef = useRef(null);
  const fileInputRef = useRef(null);
  const [fontName, setFontName] = useState('Sarabun');
  const [fontSize, setFontSize] = useState('3'); // 1-7 scale for execCommand
  const [foreColor, setForeColor] = useState('#111827');
  const [hiliteColor, setHiliteColor] = useState('#ffffff');

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    // Keep DOM in sync only when external value truly differs from current HTML
    if (typeof value === 'string' && value !== el.innerHTML) {
      el.innerHTML = value || '';
    }
  }, [value]);

  const handleInput = () => {
    const html = editorRef.current?.innerHTML || '';
    onChange && onChange(html);
  };

  const apply = (cmd, valueArg = null) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, valueArg);
    handleInput();
  };

  const applyBlockFormat = (tag) => {
    editorRef.current?.focus();
    document.execCommand('formatBlock', false, tag);
    handleInput();
  };

  const promptLink = () => {
    const url = window.prompt('ใส่ลิงก์ (URL):', 'https://');
    if (url) apply('createLink', url);
  };

  const clearFormat = () => {
    apply('removeFormat');
    apply('unlink');
  };

  const insertImageFromDevice = () => {
    fileInputRef.current?.click();
  };

  const onPickImage = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      editorRef.current?.focus();
      document.execCommand('insertImage', false, dataUrl);
      handleInput();
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsDataURL(file);
  };

  const insertTable = () => {
    const rows = Math.min(20, Math.max(1, Number(window.prompt('จำนวนแถว:', '2')) || 2));
    const cols = Math.min(20, Math.max(1, Number(window.prompt('จำนวนคอลัมน์:', '2')) || 2));
    const table = document.createElement('table');
    table.style.borderCollapse = 'collapse';
    table.style.width = '100%';
    table.style.margin = '8px 0';
    for (let r = 0; r < rows; r++) {
      const tr = document.createElement('tr');
      for (let c = 0; c < cols; c++) {
        const td = document.createElement('td');
        td.style.border = '1px solid #D1D5DB';
        td.style.padding = '8px';
        td.innerHTML = '&nbsp;';
        tr.appendChild(td);
      }
      table.appendChild(tr);
    }
    editorRef.current?.focus();
    document.execCommand('insertHTML', false, table.outerHTML);
    handleInput();
  };

  const tableOp = (op) => {
    editorRef.current?.focus();
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    let node = sel.getRangeAt(0).startContainer;
    while (node && node.nodeName !== 'TD' && node.nodeName !== 'TH' && node !== editorRef.current) {
      node = node.parentNode;
    }
    if (!node || node === editorRef.current) {
      alert('กรุณาวางเคอร์เซอร์ในตารางเพื่อใช้งาน');
      return;
    }

    const cell = node;
    const tr = cell.parentNode;
    const table = tr.parentNode.closest('table');
    const rowIndex = tr.rowIndex;
    const cellIndex = cell.cellIndex;

    if (op === 'addRowBelow') {
      const newTr = table.insertRow(rowIndex + 1);
      for (let i = 0; i < tr.cells.length; i++) {
        const newCell = newTr.insertCell(i);
        newCell.style.border = '1px solid #D1D5DB';
        newCell.style.padding = '8px';
        newCell.innerHTML = '&nbsp;';
      }
    } else if (op === 'addRowAbove') {
      const newTr = table.insertRow(rowIndex);
      for (let i = 0; i < tr.cells.length; i++) {
        const newCell = newTr.insertCell(i);
        newCell.style.border = '1px solid #D1D5DB';
        newCell.style.padding = '8px';
        newCell.innerHTML = '&nbsp;';
      }
    } else if (op === 'addColRight') {
      for (let i = 0; i < table.rows.length; i++) {
        const newCell = table.rows[i].insertCell(cellIndex + 1);
        newCell.style.border = '1px solid #D1D5DB';
        newCell.style.padding = '8px';
        newCell.innerHTML = '&nbsp;';
      }
    } else if (op === 'addColLeft') {
      for (let i = 0; i < table.rows.length; i++) {
        const newCell = table.rows[i].insertCell(cellIndex);
        newCell.style.border = '1px solid #D1D5DB';
        newCell.style.padding = '8px';
        newCell.innerHTML = '&nbsp;';
      }
    } else if (op === 'delRow') {
      table.deleteRow(rowIndex);
    } else if (op === 'delCol') {
      for (let i = 0; i < table.rows.length; i++) {
        table.rows[i].deleteCell(cellIndex);
      }
    } else if (op === 'delTable') {
      table.remove();
    }
    handleInput();
  };

  return (
    <div className={`border border-blue-300 rounded-md overflow-hidden flex flex-col ${pageMode ? 'bg-gray-200' : ''}`}>
      {!readOnly && (
        <div ref={toolbarRef} className="flex flex-wrap gap-1 items-center sticky top-0 z-20 border-b px-2 py-1" style={{ backgroundColor: '#f8fafc' }}>
          <select className="border rounded px-2 py-1 text-sm bg-white" value={fontName} onChange={(e) => { setFontName(e.target.value); apply('fontName', e.target.value); }}>
            <option value="Sarabun">Sarabun</option>
            <option value="TH Sarabun New">TH Sarabun New</option>
            <option value="Tahoma">Tahoma</option>
            <option value="Times New Roman">Times New Roman</option>
          </select>
          <select className="border rounded px-2 py-1 text-sm bg-white" value={fontSize} onChange={(e) => { setFontSize(e.target.value); apply('fontSize', e.target.value); }}>
            <option value="2">เล็ก</option>
            <option value="3">ปกติ</option>
            <option value="4">ใหญ่</option>
            <option value="5">ใหญ่มาก</option>
          </select>
          <span className="mx-1 w-px h-5 bg-gray-300" />
          <IconBtn title="ตัวหนา" onClick={() => apply('bold')}><Bold size={16} /></IconBtn>
          <IconBtn title="ตัวเอียง" onClick={() => apply('italic')}><Italic size={16} /></IconBtn>
          <IconBtn title="ขีดเส้นใต้" onClick={() => apply('underline')}><Underline size={16} /></IconBtn>
          <input title="สีตัวอักษร" type="color" className="w-7 h-7 p-0 border rounded cursor-pointer" value={foreColor} onChange={(e) => { setForeColor(e.target.value); apply('foreColor', e.target.value); }} />
          <span className="mx-1 w-px h-5 bg-gray-300" />
          <IconBtn title="รายการจุด" onClick={() => apply('insertUnorderedList')}><BulletList size={16} /></IconBtn>
          <IconBtn title="รายการเลข" onClick={() => apply('insertOrderedList')}><ListOrdered size={16} /></IconBtn>
          <span className="mx-1 w-px h-5 bg-gray-300" />
          <IconBtn title="ชิดซ้าย" onClick={() => apply('justifyLeft')}><AlignLeft size={16} /></IconBtn>
          <IconBtn title="กึ่งกลาง" onClick={() => apply('justifyCenter')}><AlignCenter size={16} /></IconBtn>
          <IconBtn title="ชิดขวา" onClick={() => apply('justifyRight')}><AlignRight size={16} /></IconBtn>
          <span className="mx-1 w-px h-5 bg-gray-300" />
          <IconBtn title="ใส่ลิงก์" onClick={promptLink}><LinkIcon size={16} /></IconBtn>
          <IconBtn title="รูปภาพ" onClick={insertImageFromDevice}><ImageIcon size={16} /></IconBtn>
          <IconBtn title="สร้างตาราง" onClick={insertTable}><TableIcon size={16} /></IconBtn>

          <div className="relative group ml-auto flex items-center bg-blue-50 px-2 rounded-lg border border-blue-200">
            <span className="text-[10px] font-bold text-blue-600 mr-2 uppercase tracking-tighter">จัดการตาราง</span>
            <IconBtn title="เพิ่มแถวบน" onClick={() => tableOp('addRowAbove')} className="hover:text-blue-600"><div className="flex flex-col items-center"><ChevronRight size={12} className="-rotate-90" /> <div className="w-3 h-[2px] bg-current" /></div></IconBtn>
            <IconBtn title="เพิ่มแถวล่าง" onClick={() => tableOp('addRowBelow')} className="hover:text-blue-600"><div className="flex flex-col items-center"><div className="w-3 h-[2px] bg-current" /> <ChevronRight size={12} className="rotate-90" /></div></IconBtn>
            <IconBtn title="เพิ่มคอลัมน์ซ้าย" onClick={() => tableOp('addColLeft')} className="hover:text-blue-600"><div className="flex items-center"><ChevronRight size={12} className="rotate-180" /> <div className="w-[2px] h-3 bg-current" /></div></IconBtn>
            <IconBtn title="เพิ่มคอลัมน์ขวา" onClick={() => tableOp('addColRight')} className="hover:text-blue-600"><div className="flex items-center"><div className="w-[2px] h-3 bg-current" /> <ChevronRight size={12} /></div></IconBtn>
            <span className="mx-1 w-px h-4 bg-blue-200" />
            <IconBtn title="ลบแถว" onClick={() => tableOp('delRow')} className="text-red-500 hover:bg-red-50"><Eraser size={14} /></IconBtn>
            <IconBtn title="ลบคอลัมน์" onClick={() => tableOp('delCol')} className="text-red-500 hover:bg-red-50"><div className="relative"><Eraser size={14} /><div className="absolute top-0 right-0 w-1 h-3 bg-red-500 rotate-45 transform origin-top-left -translate-x-1" /></div></IconBtn>
            <IconBtn title="ลบตาราง" onClick={() => tableOp('delTable')} className="text-red-600 hover:bg-red-100"><Trash2 size={14} /></IconBtn>
          </div>

          <span className="mx-1 w-px h-5 bg-gray-300" />
          <IconBtn title="ล้างฟอร์แมต" onClick={clearFormat}><Eraser size={16} /></IconBtn>
        </div>
      )}
      <div className={`flex-1 overflow-auto ${pageMode ? 'p-10' : ''}`}>
        <div
          ref={editorRef}
          role="textbox"
          aria-label={ariaLabel}
          contentEditable={!readOnly}
          onInput={handleInput}
          className={`px-12 py-12 outline-none bg-white shadow-2xl mx-auto transition-all ${readOnly ? 'text-gray-700 cursor-default' : ''}`}
          style={{
            minHeight,
            width: pageMode ? '297mm' : '100%',
            minWidth: pageMode ? '297mm' : 'auto',
            maxWidth: 'none'
          }}
          data-placeholder={placeholder}
          onBlur={handleInput}
          suppressContentEditableWarning
        />
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />
      <style>{`
        [contenteditable][data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: #9CA3AF; 
        }
        table { font-size: inherit; border-collapse: collapse; margin: 10px 0; }
        table td, table th { 
          vertical-align: top; 
          border: 1px solid #94a3b8; 
          padding: 8px; 
          min-width: 50px; 
          position: relative;
        }
        /* Visual indicator for focused cell */
        td:focus, th:focus { outline: 2px solid #3b82f6; outline-offset: -2px; }

        [contenteditable] table {
           table-layout: auto;
           background-color: white;
           display: table;
           width: auto !important;
           max-width: none !important; /* Allow bleed to prevent squashing */
        }
        [contenteditable] th {
           background-color: #fce7f3; 
           font-weight: bold;
        }
        [contenteditable] img {
           max-width: 100%;
           height: auto;
           cursor: nwse-resize;
           display: inline-block;
        }
      `}</style>
    </div>
  );
}

function IconBtn({ title, onClick, children }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="p-1.5 hover:bg-blue-100 rounded text-gray-700"
    >
      {children}
    </button>
  );
}


