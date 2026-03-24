// Lightweight rich text editor using contenteditable and document.execCommand
// Provides Word-like basic formatting without external dependencies
import React, { useEffect, useRef, useState, useCallback } from 'react';
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
  Merge,
  Scissors,
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
  const [fontSize, setFontSize] = useState('3');
  const [foreColor, setForeColor] = useState('#111827');
  const [cellBgColor, setCellBgColor] = useState('#ffffff');
  const [selectedCells, setSelectedCells] = useState([]); // cells highlighted for merge
  const isMouseDown = useRef(false);
  const selStartCell = useRef(null);
  const [tablePickerOpen, setTablePickerOpen] = useState(false);
  const [tableHover, setTableHover] = useState({ r: 0, c: 0 }); // hovered grid cell
  const tablePickerRef = useRef(null);

  // Custom undo/redo stack for table operations (DOM mutations bypass browser undo)
  const undoStack = useRef([]);
  const redoStack = useRef([]);

  const saveSnapshot = useCallback(() => {
    const html = editorRef.current?.innerHTML || '';
    undoStack.current.push(html);
    if (undoStack.current.length > 100) undoStack.current.shift();
    redoStack.current = []; // clear redo on new action
  }, []);

  const customUndo = useCallback(() => {
    if (undoStack.current.length === 0) {
      // Fall back to browser undo for typing
      document.execCommand('undo');
      return;
    }
    const current = editorRef.current?.innerHTML || '';
    redoStack.current.push(current);
    const prev = undoStack.current.pop();
    editorRef.current.innerHTML = prev;
    onChange && onChange(prev);
  }, [onChange]);

  const customRedo = useCallback(() => {
    if (redoStack.current.length === 0) {
      document.execCommand('redo');
      return;
    }
    const current = editorRef.current?.innerHTML || '';
    undoStack.current.push(current);
    const next = redoStack.current.pop();
    editorRef.current.innerHTML = next;
    onChange && onChange(next);
  }, [onChange]);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    // Keep DOM in sync only when external value truly differs from current HTML
    if (typeof value === 'string' && value !== el.innerHTML) {
      el.innerHTML = value || '';
    }
  }, [value]);

  // Intercept Ctrl+Z / Ctrl+Y to use custom stack when it has entries
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        if (undoStack.current.length > 0) {
          e.preventDefault();
          customUndo();
        }
        // else let browser handle it
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))
      ) {
        if (redoStack.current.length > 0) {
          e.preventDefault();
          customRedo();
        }
      }
    };
    el.addEventListener('keydown', onKeyDown);
    return () => el.removeEventListener('keydown', onKeyDown);
  }, [customUndo, customRedo]);

  const handleInput = () => {
    const html = editorRef.current?.innerHTML || '';
    onChange && onChange(html);
  };

  // ── Cell selection for merge ──────────────────────────────────────────────
  const getCellFromEvent = (e) => {
    let el = e.target;
    while (el && el !== editorRef.current) {
      if (el.nodeName === 'TD' || el.nodeName === 'TH') return el;
      el = el.parentElement;
    }
    return null;
  };

  // Get all cells in a rectangular region between two cells in the same table
  const getCellsInRect = (table, c1, c2) => {
    // Build a grid map: grid[row][col] = cell
    const grid = [];
    const cellPos = new Map(); // cell -> {r1,c1,r2,c2}
    for (let r = 0; r < table.rows.length; r++) {
      if (!grid[r]) grid[r] = [];
      for (let c = 0; c < table.rows[r].cells.length; c++) {
        const cell = table.rows[r].cells[c];
        const rs = cell.rowSpan || 1;
        const cs = cell.colSpan || 1;
        // find first empty slot in this row
        let col = 0;
        while (grid[r][col]) col++;
        for (let dr = 0; dr < rs; dr++) {
          if (!grid[r + dr]) grid[r + dr] = [];
          for (let dc = 0; dc < cs; dc++) {
            grid[r + dr][col + dc] = cell;
          }
        }
        cellPos.set(cell, { r1: r, c1: col, r2: r + rs - 1, c2: col + cs - 1 });
      }
    }
    const p1 = cellPos.get(c1);
    const p2 = cellPos.get(c2);
    if (!p1 || !p2) return [c1];
    const minR = Math.min(p1.r1, p2.r1), maxR = Math.max(p1.r2, p2.r2);
    const minC = Math.min(p1.c1, p2.c1), maxC = Math.max(p1.c2, p2.c2);
    const seen = new Set();
    const result = [];
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        const cell = grid[r]?.[c];
        if (cell && !seen.has(cell)) { seen.add(cell); result.push(cell); }
      }
    }
    return result;
  };

  const handleCellMouseDown = useCallback((e) => {
    const cell = getCellFromEvent(e);
    if (!cell) return;
    isMouseDown.current = true;
    selStartCell.current = cell;
    // clear previous highlights
    editorRef.current?.querySelectorAll('td.rte-sel,th.rte-sel').forEach(c => c.classList.remove('rte-sel'));
    cell.classList.add('rte-sel');
    setSelectedCells([cell]);
  }, []);

  const handleCellMouseOver = useCallback((e) => {
    if (!isMouseDown.current || !selStartCell.current) return;
    const cell = getCellFromEvent(e);
    if (!cell) return;
    const table = cell.closest('table');
    const startTable = selStartCell.current.closest('table');
    if (table !== startTable) return;
    const cells = getCellsInRect(table, selStartCell.current, cell);
    editorRef.current?.querySelectorAll('td.rte-sel,th.rte-sel').forEach(c => c.classList.remove('rte-sel'));
    cells.forEach(c => c.classList.add('rte-sel'));
    setSelectedCells(cells);
  }, []);

  const handleCellMouseUp = useCallback(() => {
    isMouseDown.current = false;
  }, []);

  // ── Merge selected cells ──────────────────────────────────────────────────
  const mergeCells = () => {
    const cells = editorRef.current?.querySelectorAll('td.rte-sel,th.rte-sel') || [];
    if (cells.length < 2) { alert('เลือก cell อย่างน้อย 2 cell เพื่อผสาน'); return; }
    saveSnapshot();
    const table = cells[0].closest('table');

    // Build grid to find bounding box
    const grid = [];
    const cellPos = new Map();
    for (let r = 0; r < table.rows.length; r++) {
      if (!grid[r]) grid[r] = [];
      for (let c = 0; c < table.rows[r].cells.length; c++) {
        const cell = table.rows[r].cells[c];
        const rs = cell.rowSpan || 1;
        const cs = cell.colSpan || 1;
        let col = 0;
        while (grid[r][col]) col++;
        for (let dr = 0; dr < rs; dr++) {
          if (!grid[r + dr]) grid[r + dr] = [];
          for (let dc = 0; dc < cs; dc++) grid[r + dr][col + dc] = cell;
        }
        cellPos.set(cell, { r1: r, c1: col, r2: r + rs - 1, c2: col + cs - 1 });
      }
    }

    const selSet = new Set(cells);
    let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
    cells.forEach(cell => {
      const p = cellPos.get(cell);
      if (!p) return;
      minR = Math.min(minR, p.r1); maxR = Math.max(maxR, p.r2);
      minC = Math.min(minC, p.c1); maxC = Math.max(maxC, p.c2);
    });

    // Collect combined HTML from all selected cells
    const combinedHtml = Array.from(cells).map(c => c.innerHTML.trim()).filter(h => h && h !== '&nbsp;').join(' ');

    // Set first cell to span the whole rect
    const firstCell = cells[0];
    firstCell.rowSpan = maxR - minR + 1;
    firstCell.colSpan = maxC - minC + 1;
    firstCell.innerHTML = combinedHtml || '&nbsp;';
    firstCell.classList.remove('rte-sel');

    // Remove all other selected cells
    cells.forEach((cell, i) => {
      if (i === 0) return;
      cell.classList.remove('rte-sel');
      cell.parentElement?.removeChild(cell);
    });

    // Clean up empty rows
    Array.from(table.rows).forEach(row => {
      if (row.cells.length === 0) row.parentElement?.removeChild(row);
    });

    setSelectedCells([]);
    handleInput();
  };

  // ── Split merged cell ─────────────────────────────────────────────────────
  const splitCell = () => {
    const sel = window.getSelection();
    let cell = null;
    if (sel?.rangeCount) {
      let node = sel.getRangeAt(0).startContainer;
      while (node && node !== editorRef.current) {
        if (node.nodeName === 'TD' || node.nodeName === 'TH') { cell = node; break; }
        node = node.parentNode;
      }
    }
    // fallback: use first selected cell
    if (!cell) cell = editorRef.current?.querySelector('td.rte-sel,th.rte-sel');
    if (!cell) { alert('วางเคอร์เซอร์ใน cell ที่ต้องการแยก'); return; }

    const rs = cell.rowSpan || 1;
    const cs = cell.colSpan || 1;
    if (rs === 1 && cs === 1) { alert('cell นี้ไม่ได้ถูกผสาน'); return; }

    saveSnapshot();

    const table = cell.closest('table');
    const tr = cell.parentElement;
    const rowIndex = tr.rowIndex;

    // Find column index in grid
    const grid = [];
    const cellPos = new Map();
    for (let r = 0; r < table.rows.length; r++) {
      if (!grid[r]) grid[r] = [];
      for (let c = 0; c < table.rows[r].cells.length; c++) {
        const tc = table.rows[r].cells[c];
        const trs = tc.rowSpan || 1;
        const tcs = tc.colSpan || 1;
        let col = 0;
        while (grid[r][col]) col++;
        for (let dr = 0; dr < trs; dr++) {
          if (!grid[r + dr]) grid[r + dr] = [];
          for (let dc = 0; dc < tcs; dc++) grid[r + dr][col + dc] = tc;
        }
        if (!cellPos.has(tc)) cellPos.set(tc, { r: r, c: col });
      }
    }

    const pos = cellPos.get(cell);
    if (!pos) return;

    // Reset original cell to 1x1
    cell.rowSpan = 1;
    cell.colSpan = 1;

    // Insert new cells for each extra col in same row
    for (let dc = 1; dc < cs; dc++) {
      const newCell = document.createElement(cell.nodeName.toLowerCase());
      newCell.style.cssText = cell.style.cssText;
      newCell.innerHTML = '&nbsp;';
      // insert after cell
      const ref = grid[rowIndex][pos.c + dc];
      if (ref && ref !== cell && ref.parentElement === tr) {
        tr.insertBefore(newCell, ref);
      } else {
        tr.appendChild(newCell);
      }
    }

    // Insert new rows for each extra rowspan
    for (let dr = 1; dr < rs; dr++) {
      const targetRow = table.rows[rowIndex + dr];
      if (!targetRow) break;
      for (let dc = 0; dc < cs; dc++) {
        const newCell = document.createElement(cell.nodeName.toLowerCase());
        newCell.style.cssText = cell.style.cssText;
        newCell.innerHTML = '&nbsp;';
        const ref = grid[rowIndex + dr][pos.c + dc];
        if (ref && ref.parentElement === targetRow) {
          targetRow.insertBefore(newCell, ref);
        } else {
          targetRow.appendChild(newCell);
        }
      }
    }

    cell.classList.remove('rte-sel');
    setSelectedCells([]);
    handleInput();
  };

  // Clean Word HTML: preserve table structure (colspan/rowspan/colors) and strip Office junk
  const cleanWordHtml = (html) => {
    // Step 1: Remove only "empty" conditional comments like <!--[if !supportMSOPaddingAlt]>...<![endif]-->
    // but KEEP the inner content of <!--[if ...]>...<![endif]--> that wraps real content
    let clean = html
      // Remove mso XML blocks entirely
      .replace(/<xml>[\s\S]*?<\/xml>/gi, '')
      // Remove Office namespace tags but keep their text content
      .replace(/<o:p[^>]*>([\s\S]*?)<\/o:p>/gi, '$1')
      .replace(/<\/?w:[^>]*>/gi, '')
      .replace(/<\/?m:[^>]*>/gi, '')
      .replace(/<\/?v:[^>]*>/gi, '')
      .replace(/<\/?st1:[^>]*>/gi, '')
      // Remove conditional comments wrapper but keep inner HTML
      .replace(/<!--\[if[^\]]*\]>/gi, '')
      .replace(/<!\[endif\]-->/gi, '')
      // Remove HTML comments
      .replace(/<!--[\s\S]*?-->/g, '')
      // Replace Word's "windowtext" keyword with real color
      .replace(/\bwindowtext\b/gi, '#000000')
      // Replace "1.0pt" border thickness with px equivalent
      .replace(/(\d+)\.0pt/gi, (_, n) => `${Math.round(n * 1.333)}px`);

    // Step 2: Parse into DOM
    const parser = new DOMParser();
    const doc = parser.parseFromString(clean, 'text/html');

    // Step 3: Extract background color from Word's <style> block before removing it
    // Word puts cell colors in CSS classes like .msoDontBreak { background: pink }
    const styleColorMap = {};
    doc.querySelectorAll('style').forEach((styleEl) => {
      const text = styleEl.textContent;
      // Match patterns like .className { ... background:#color ... }
      const classRules = text.matchAll(/\.([\w-]+)\s*\{([^}]+)\}/g);
      for (const match of classRules) {
        const className = match[1];
        const rules = match[2];
        const bgMatch = rules.match(/background(?:-color)?\s*:\s*([^;]+)/i);
        const colorMatch = rules.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
        if (bgMatch || colorMatch) {
          styleColorMap[className] = {};
          if (bgMatch) styleColorMap[className].backgroundColor = bgMatch[1].trim();
          if (colorMatch) styleColorMap[className].color = colorMatch[1].trim();
        }
      }
      styleEl.remove();
    });

    // Step 4: Remove unwanted tags
    doc.querySelectorAll('script,meta,link,head').forEach((el) => el.remove());

    // Step 5: Process all elements
    doc.querySelectorAll('*').forEach((el) => {
      const tag = el.tagName.toLowerCase();

      // Apply colors from class-based styles before removing class
      const cls = el.getAttribute('class') || '';
      if (cls && styleColorMap[cls]) {
        const existing = el.getAttribute('style') || '';
        const extra = Object.entries(styleColorMap[cls])
          .map(([k, v]) => `${k.replace(/([A-Z])/g, '-$1').toLowerCase()}:${v}`)
          .join(';');
        el.setAttribute('style', existing ? `${existing};${extra}` : extra);
      }

      // Clean style: keep visual properties, drop mso-* junk
      if (el.hasAttribute('style')) {
        const styleStr = el.getAttribute('style');
        const tag2 = el.tagName.toLowerCase();
        const kept = [];
        styleStr.split(';').forEach((rule) => {
          const colonIdx = rule.indexOf(':');
          if (colonIdx === -1) return;
          const p = rule.slice(0, colonIdx).trim().toLowerCase();
          const v = rule.slice(colonIdx + 1).trim();
          if (!v) return;
          if (p.startsWith('mso-') || p.startsWith('-aw-') || p.startsWith('font-variant')) return;
          // For tables: skip margin and width (we set them ourselves)
          if ((tag2 === 'table') && (p.startsWith('margin') || p === 'width' || p === 'max-width')) return;
          const allowed = [
            'color', 'background-color', 'background',
            'font-size', 'font-weight', 'font-style', 'font-family',
            'text-align', 'text-decoration', 'vertical-align',
            'border', 'border-top', 'border-bottom', 'border-left', 'border-right',
            'border-collapse', 'border-spacing',
            'padding', 'padding-top', 'padding-bottom', 'padding-left', 'padding-right',
            'margin', 'margin-top', 'margin-bottom', 'margin-left', 'margin-right',
            'width', 'height', 'min-width', 'max-width',
            'white-space', 'line-height',
          ];
          if (allowed.includes(p)) kept.push(`${p}:${v}`);
        });
        if (kept.length > 0) el.setAttribute('style', kept.join(';'));
        else el.removeAttribute('style');
      }

      // Remove Office/Word-specific attributes but KEEP colspan, rowspan, width, height, align, valign
      const keepAttrs = new Set(['colspan', 'rowspan', 'width', 'height', 'align', 'valign', 'style', 'href', 'src', 'alt']);
      Array.from(el.attributes).forEach((attr) => {
        if (!keepAttrs.has(attr.name.toLowerCase())) {
          el.removeAttribute(attr.name);
        }
      });

      // For td/th: remove fixed width, ensure padding and fallback border
      if (tag === 'td' || tag === 'th') {
        let style = el.getAttribute('style') || '';
        // Remove fixed pt/in width from cells
        style = style.replace(/(?:^|;)\s*width\s*:[^;]+/gi, '');
        el.setAttribute('style', style.replace(/^;/, ''));
        el.removeAttribute('width');

        const finalStyle = el.getAttribute('style') || '';
        const hasBorder = finalStyle.includes('border-top') || finalStyle.includes('border-bottom') ||
          finalStyle.includes('border-left') || finalStyle.includes('border-right') ||
          /(?:^|;)\s*border\s*:/.test(finalStyle);
        if (!hasBorder) {
          el.setAttribute('style', `${finalStyle};border:1px solid #94a3b8`.replace(/^;/, ''));
        }
        if (!finalStyle.includes('padding')) {
          el.setAttribute('style', `${el.getAttribute('style')};padding:4px 8px`);
        }
      }

      // Ensure table has border-collapse and fits container — override everything Word set
      if (tag === 'table') {
        el.removeAttribute('width');
        el.setAttribute('style', 'border-collapse:collapse;width:100%;max-width:100%;margin:8px 0;word-break:break-word');
      }
    });

    // Step 6: Flatten thead/tbody — move all rows into a single tbody so rowspan works across sections
    doc.querySelectorAll('table').forEach((table) => {
      const allRows = Array.from(table.querySelectorAll('tr'));
      // Remove all thead/tbody/tfoot
      table.querySelectorAll('thead,tbody,tfoot').forEach(s => {
        while (s.firstChild) table.appendChild(s.firstChild);
        s.remove();
      });
      // Wrap all rows in one tbody
      const tbody = doc.createElement('tbody');
      allRows.forEach(tr => tbody.appendChild(tr));
      table.appendChild(tbody);
    });

    return doc.body.innerHTML;
  };

  const handlePaste = (e) => {
    const clipboardData = e.clipboardData || window.clipboardData;
    const htmlData = clipboardData.getData('text/html');

    if (htmlData) {
      e.preventDefault();
      saveSnapshot();
      const cleaned = cleanWordHtml(htmlData);

      // Use DOM insertion directly to avoid browser sanitization from execCommand
      // which strips rowspan/colspan attributes
      const sel = window.getSelection();
      if (sel && sel.rangeCount) {
        const range = sel.getRangeAt(0);
        range.deleteContents();

        const fragment = document.createDocumentFragment();
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = cleaned;
        while (tempDiv.firstChild) {
          fragment.appendChild(tempDiv.firstChild);
        }
        range.insertNode(fragment);

        // Move cursor to end of inserted content
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      } else {
        // Fallback: append to editor
        editorRef.current.innerHTML += cleaned;
      }

      handleInput();
    }
    // If no HTML data, let default paste handle plain text
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

  const insertTable = (rows, cols) => {
    saveSnapshot();
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
    setTablePickerOpen(false);
  };

  // Close table picker when clicking outside
  useEffect(() => {
    if (!tablePickerOpen) return;
    const handler = (e) => {
      if (tablePickerRef.current && !tablePickerRef.current.contains(e.target)) {
        setTablePickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [tablePickerOpen]);

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

    saveSnapshot();

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

  const applyCellBg = (color) => {
    saveSnapshot();
    // Apply to all rte-sel cells, or fallback to cursor cell
    const selCells = editorRef.current?.querySelectorAll('td.rte-sel,th.rte-sel') || [];
    if (selCells.length > 0) {
      selCells.forEach(cell => { cell.style.backgroundColor = color; });
    } else {
      const sel = window.getSelection();
      if (!sel?.rangeCount) return;
      let node = sel.getRangeAt(0).startContainer;
      while (node && node !== editorRef.current) {
        if (node.nodeName === 'TD' || node.nodeName === 'TH') {
          node.style.backgroundColor = color;
          break;
        }
        node = node.parentNode;
      }
    }
    handleInput();
  };

  return (
    <div className={`border border-blue-300 rounded-md flex flex-col ${pageMode ? 'bg-gray-200' : ''}`}>
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

          {/* Table grid picker — like Word */}
          <div ref={tablePickerRef} className="relative">
            <button
              type="button"
              title="สร้างตาราง"
              onClick={() => setTablePickerOpen(v => !v)}
              className="p-1.5 hover:bg-blue-100 rounded text-gray-700 flex items-center gap-0.5"
            >
              <TableIcon size={16} />
            </button>
            {tablePickerOpen && (
              <div
                className="absolute left-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded shadow-lg p-2 select-none"
                onMouseLeave={() => setTableHover({ r: 0, c: 0 })}
              >
                <div className="text-xs text-center text-gray-500 mb-1">
                  {tableHover.r > 0 && tableHover.c > 0
                    ? `${tableHover.r} × ${tableHover.c}`
                    : 'เลือกขนาดตาราง'}
                </div>
                <div className="grid gap-[2px]" style={{ gridTemplateColumns: 'repeat(10, 16px)' }}>
                  {Array.from({ length: 100 }, (_, i) => {
                    const r = Math.floor(i / 10) + 1;
                    const c = (i % 10) + 1;
                    const active = r <= tableHover.r && c <= tableHover.c;
                    return (
                      <div
                        key={i}
                        onMouseEnter={() => setTableHover({ r, c })}
                        onClick={() => insertTable(tableHover.r, tableHover.c)}
                        className={`w-4 h-4 border cursor-pointer rounded-sm transition-colors ${
                          active
                            ? 'bg-blue-400 border-blue-500'
                            : 'bg-gray-100 border-gray-300 hover:bg-blue-100'
                        }`}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="relative group ml-auto flex items-center bg-blue-50 px-2 rounded-lg border border-blue-200">
            <span className="text-[10px] font-bold text-blue-600 mr-2 uppercase tracking-tighter">จัดการตาราง</span>
            <IconBtn title="เพิ่มแถวบน" onClick={() => tableOp('addRowAbove')} className="hover:text-blue-600"><div className="flex flex-col items-center"><ChevronRight size={12} className="-rotate-90" /> <div className="w-3 h-[2px] bg-current" /></div></IconBtn>
            <IconBtn title="เพิ่มแถวล่าง" onClick={() => tableOp('addRowBelow')} className="hover:text-blue-600"><div className="flex flex-col items-center"><div className="w-3 h-[2px] bg-current" /> <ChevronRight size={12} className="rotate-90" /></div></IconBtn>
            <IconBtn title="เพิ่มคอลัมน์ซ้าย" onClick={() => tableOp('addColLeft')} className="hover:text-blue-600"><div className="flex items-center"><ChevronRight size={12} className="rotate-180" /> <div className="w-[2px] h-3 bg-current" /></div></IconBtn>
            <IconBtn title="เพิ่มคอลัมน์ขวา" onClick={() => tableOp('addColRight')} className="hover:text-blue-600"><div className="flex items-center"><div className="w-[2px] h-3 bg-current" /> <ChevronRight size={12} /></div></IconBtn>
            <span className="mx-1 w-px h-4 bg-blue-200" />
            <IconBtn title="ผสาน cell" onClick={mergeCells} className="text-purple-600 hover:bg-purple-50"><Merge size={14} /></IconBtn>
            <IconBtn title="แยก cell" onClick={splitCell} className="text-purple-600 hover:bg-purple-50"><Scissors size={14} /></IconBtn>
            <span className="mx-1 w-px h-4 bg-blue-200" />
            <label title="สีพื้นหลัง cell (วางเคอร์เซอร์ใน cell หรือเลือกหลาย cell แล้วเลือกสี)" className="flex items-center gap-1 cursor-pointer text-[10px] text-blue-700">
              <span>สี cell</span>
              <input
                type="color"
                className="w-6 h-6 p-0 border rounded cursor-pointer"
                value={cellBgColor}
                onChange={(e) => { setCellBgColor(e.target.value); applyCellBg(e.target.value); }}
              />
            </label>
            <span className="mx-1 w-px h-4 bg-blue-200" />            <IconBtn title="ลบแถว" onClick={() => tableOp('delRow')} className="text-red-500 hover:bg-red-50"><Eraser size={14} /></IconBtn>
            <IconBtn title="ลบคอลัมน์" onClick={() => tableOp('delCol')} className="text-red-500 hover:bg-red-50"><div className="relative"><Eraser size={14} /><div className="absolute top-0 right-0 w-1 h-3 bg-red-500 rotate-45 transform origin-top-left -translate-x-1" /></div></IconBtn>
            <IconBtn title="ลบตาราง" onClick={() => tableOp('delTable')} className="text-red-600 hover:bg-red-100"><Trash2 size={14} /></IconBtn>
          </div>

          <span className="mx-1 w-px h-5 bg-gray-300" />
          <IconBtn title="ย้อนกลับ (Ctrl+Z)" onClick={customUndo}><Undo2 size={16} /></IconBtn>
          <IconBtn title="ทำซ้ำ (Ctrl+Y)" onClick={customRedo}><Redo2 size={16} /></IconBtn>
          <span className="mx-1 w-px h-5 bg-gray-300" />
        </div>
      )}
      <div className={`${pageMode ? 'p-10 overflow-auto' : ''}`}>
        <div
          ref={editorRef}
          role="textbox"
          aria-label={ariaLabel}
          contentEditable={!readOnly}
          onInput={handleInput}
          onPaste={!readOnly ? handlePaste : undefined}
          onMouseDown={!readOnly ? handleCellMouseDown : undefined}
          onMouseOver={!readOnly ? handleCellMouseOver : undefined}
          onMouseUp={!readOnly ? handleCellMouseUp : undefined}
          className={`px-12 py-12 outline-none bg-white shadow-2xl mx-auto transition-all ${readOnly ? 'text-gray-700 cursor-default' : ''}`}
          style={{
            minHeight,
            width: pageMode ? '297mm' : '100%',
            minWidth: pageMode ? '297mm' : 'auto',
            maxWidth: 'none',
            height: 'auto',
            overflowY: 'visible',
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
        /* Merge selection highlight */
        td.rte-sel, th.rte-sel { outline: 2px solid #7c3aed !important; background-color: rgba(124,58,237,0.08) !important; }

        [contenteditable] table {
           table-layout: auto;
           background-color: white;
           display: table;
           width: 100% !important;
           max-width: 100% !important;
           word-break: break-word;
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


