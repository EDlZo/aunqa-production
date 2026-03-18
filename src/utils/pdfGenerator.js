// src/utils/pdfGenerator.js
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export class PDFGenerator {
  constructor() {
    this.doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
    this.margin = 20;
    this.footerHeight = 15;
    this.safeBottom = this.pageHeight - this.margin - this.footerHeight;
    this.contentWidth = this.pageWidth - (this.margin * 2);
    this.currentY = this.margin;
    this.imageDimensions = new Map();
  }

  decodeHtmlEntities(text) {
    if (!text) return "";
    return text
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<p[^>]*>/gi, '\n')
      .replace(/<\/p>/gi, '')
      .replace(/<li[^>]*>/gi, '\n• ')
      .replace(/<\/li>/gi, '');
  }

  parseHtmlToBlocks(html) {
    if (!html || typeof window === 'undefined') return [{ type: 'text', content: this.stripHtml(html) }];
    const parser = new DOMParser();
    const doc = parser.parseFromString(html || '', 'text/html');
    const blocks = [];

    const walk = (node) => {
      if (node.nodeType === 3) {
        const text = node.textContent;
        if (text && text.trim()) blocks.push({ type: 'text', content: this.decodeHtmlEntities(text) });
      } else if (node.nodeName.toUpperCase() === 'IMG') {
        const src = node.getAttribute('src');
        if (src) blocks.push({ type: 'image', content: src });
      } else if (node.nodeName.toUpperCase() === 'TABLE') {
        const rows = [];
        Array.from(node.rows).forEach(tr => {
          const cols = [];
          Array.from(tr.cells).forEach(cell => {
            const cellBlocks = this.parseHtmlToBlocks(cell.innerHTML);
            cols.push({ content: '', blocks: cellBlocks });
          });
          if (cols.length > 0) rows.push(cols);
        });
        if (rows.length > 0) blocks.push({ type: 'table', content: rows });
      } else if (node.nodeName.toUpperCase() === 'BR') {
        blocks.push({ type: 'text', content: '\n' });
      } else {
        node.childNodes.forEach(walk);
        if (['P', 'DIV', 'H1', 'H2', 'H3', 'LI'].includes(node.nodeName.toUpperCase())) blocks.push({ type: 'text', content: '\n' });
      }
    };
    doc.body.childNodes.forEach(walk);

    const merged = [];
    blocks.forEach(b => {
      if (b.type === 'text') {
        if (merged.length > 0 && merged[merged.length - 1].type === 'text') merged[merged.length - 1].content += b.content;
        else merged.push({ ...b });
      } else merged.push(b);
    });

    merged.forEach(b => {
      if (b.type === 'text') b.content = b.content.replace(/^\s+|\s+$/g, (m) => m.includes('\n') ? '\n' : '');
    });

    const finalBlocks = merged.filter(b => b.type !== 'text' || b.content.trim() || b.content === '\n');
    return finalBlocks.length > 0 ? finalBlocks : [{ type: 'text', content: '-' }];
  }

  async preloadImages(indicators = []) {
    if (typeof window === 'undefined') return;
    const imageUrls = new Set();
    indicators.forEach(ind => {
      const result = ind.result || ind.operation_result || '';
      const comment = ind.comment || '';
      this.extractImageData(result).forEach(url => imageUrls.add(url));
      this.extractImageData(comment).forEach(url => imageUrls.add(url));
    });

    const promises = Array.from(imageUrls).map(url => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          this.imageDimensions.set(url, { width: img.naturalWidth, height: img.naturalHeight, ratio: img.naturalHeight / img.naturalWidth });
          resolve();
        };
        img.onerror = () => resolve();
        img.src = url;
      });
    });
    await Promise.all(promises);
  }

  extractImageData(html) {
    const images = [];
    if (!html || typeof html !== 'string') return images;
    const imgRegex = /<img[^>]+src\s*=\s*(["'])(.*?)\1/gi;
    let match;
    while ((match = imgRegex.exec(html)) !== null) images.push(match[2]);
    return images;
  }

  stripHtml(html) {
    if (!html) return "";
    let text = this.decodeHtmlEntities(html);
    return text.replace(/<[^>]*>?/gm, '').trim();
  }

  estimateBlocksHeight(blocks, colWidth) {
    let h = 2;
    const padding = 6;
    const drawWidth = Math.max(10, colWidth - padding);

    // Ensure we calculate height using the same font size as drawing (10pt)
    try { this.doc.setFontSize(10); } catch (e) { }

    blocks.forEach(block => {
      if (block.type === 'text') {
        const lines = this.doc.splitTextToSize(block.content, drawWidth);
        h += (lines.length * 5); // v13 multiplier
      } else if (block.type === 'table') {
        let tableH = 2;
        block.content.forEach(row => {
          let maxRowH = 0;
          // Account for cell padding per cell (1mm left + 1mm right = 2mm)
          const approxColW = (drawWidth - 1) / (row.length || 1);
          const nestedCellContentW = approxColW - 2;
          row.forEach(cell => {
            const cellH = this.estimateBlocksHeight(cell.blocks || [], nestedCellContentW + padding);
            if (cellH > maxRowH) maxRowH = cellH;
          });
          tableH += Math.max(7, maxRowH);
        });
        h += tableH + 4;
      } else if (block.type === 'image') {
        const dim = this.imageDimensions.get(block.content);
        const ratio = dim ? dim.ratio : 0.6;
        h += Math.min(60, drawWidth * ratio) + 8;
      }
    });
    return h + 2;
  }

  drawBlocks(blocks, cellX, cellY, cellWidth, maxHeight = 0) {
    let localY = cellY + 2;
    const padding = 6;
    const drawWidth = Math.max(10, cellWidth - padding);
    const isTopLevel = maxHeight === 0;

    for (const block of blocks) {
      if (isTopLevel && localY > this.safeBottom - 5) {
        this.addPage();
        localY = this.margin + 5;
      } else if (!isTopLevel && localY > cellY + maxHeight - 2) {
        break; 
      }

      if (block.type === 'text') {
        this.doc.setFontSize(10);
        const split = this.doc.splitTextToSize(block.content, drawWidth);
        
        if (isTopLevel) {
          split.forEach(line => {
            if (localY > this.safeBottom - 5) {
              this.addPage();
              localY = this.margin + 5;
            }
            this.doc.text(line, cellX + 2, localY + 3);
            localY += 6;
          });
        } else {
          this.doc.text(split, cellX + 2, localY + 3);
          localY += (split.length * 5);
        }
      } else if (block.type === 'table') {
        const tableWidth = drawWidth - 1;
        const numCols = block.content[0] ? block.content[0].length : 1;
        const colWidth = tableWidth / numCols;
        const columnStyles = {};
        for (let i = 0; i < numCols; i++) {
          columnStyles[i] = { cellWidth: colWidth };
        }

        if (isTopLevel && localY + 20 > this.safeBottom) {
          this.addPage();
          localY = this.margin + 5;
        }

        this.doc.autoTable({
          body: block.content,
          startY: localY + 1,
          margin: { left: cellX + 2.5 },
          tableWidth: tableWidth,
          theme: 'grid',
          styles: { font: 'Sarabun', fontSize: 9, cellPadding: 1, minCellHeight: 7, lineWidth: 0.1, overflow: 'linebreak' },
          columnStyles: columnStyles,
          didParseCell: (hookData) => this.tableComplexCellHook(hookData, tableWidth),
          didDrawCell: (hookData) => this.tableComplexDrawHook(hookData, tableWidth)
        });
        localY = this.doc.lastAutoTable.finalY + 2;
      } else if (block.type === 'image') {
        try {
          if (block.content) {
            let format = 'PNG';
            if (block.content.startsWith('data:image')) {
              const typeMatch = block.content.match(/data:image\/([a-zA-Z]+);base64/);
              format = typeMatch ? typeMatch[1].toUpperCase() : 'PNG';
            }
            const dim = this.imageDimensions.get(block.content);
            const ratio = dim ? dim.ratio : 0.6;
            let imgWidth = drawWidth;
            let imgHeight = drawWidth * ratio;
            if (imgHeight > 80) { imgHeight = 80; imgWidth = imgHeight / ratio; }

            if (isTopLevel && localY + imgHeight + 5 > this.safeBottom) {
              this.addPage();
              localY = this.margin + 5;
            }

            const offsetX = (drawWidth - imgWidth) / 2;
            this.doc.addImage(block.content, format, cellX + 2 + offsetX, localY + 1, imgWidth, imgHeight);
            localY += imgHeight + 3;
          }
        } catch (e) { }
      }
    }
    
    if (isTopLevel) {
      this.currentY = localY;
    }
  }

  tableComplexCellHook(data, availableWidth) {
    if (data.cell.raw && typeof data.cell.raw === 'object' && data.cell.raw.blocks) {
      const h = this.estimateBlocksHeight(data.cell.raw.blocks, data.cell.width || availableWidth);
      if (data.cell.styles.minCellHeight < h + 1) data.cell.styles.minCellHeight = h + 1;
    }
  }

  tableComplexDrawHook(data, availableWidth) {
    if (data.cell.raw && typeof data.cell.raw === 'object' && data.cell.raw.blocks) {
      this.drawBlocks(data.cell.raw.blocks, data.cell.x, data.cell.y, data.cell.width || availableWidth, data.cell.height);
    }
  }

  addHeader(title, subtitle) {
    this.addTitle(title, 18, 'bold');
    if (subtitle) this.addTitle(subtitle, 14, 'normal');
    this.currentY += 5;
  }

  addInfoSection(data) {
    const info = [['ชื่อรายงาน:', data.title || '-'], ['ปีการศึกษา:', data.year || '-'], ['ผู้ประเมิน:', data.evaluator || '-'], ['วันที่ประเมิน:', new Date().toLocaleDateString('th-TH')]];
    info.forEach(([label, value]) => this.addText(`${label} ${value}`, 11));
    this.currentY += 5;
  }

  addChart(title, data) {
    this.ensureSpace(60);
    this.addTitle(title, 14, 'bold');
    const chartHeight = 40;
    const barWidth = this.contentWidth / (data.length || 1);
    data.forEach((item, i) => {
      const x = this.margin + (i * barWidth);
      const h = (item.value / 7) * chartHeight;
      this.doc.setFillColor(59, 130, 246);
      this.doc.rect(x + 5, this.currentY + chartHeight - h, barWidth - 10, h, 'F');
      this.doc.setFontSize(8);
      this.doc.text(item.label, x + (barWidth / 2), this.currentY + chartHeight + 4, { align: 'center' });
    });
    this.currentY += chartHeight + 15;
  }

  addText(text, size = 12, style = 'normal', align = 'left') {
    const cleanText = this.stripHtml(text);
    this.doc.setFontSize(size);
    this.doc.setFont('helvetica', style === 'bold' ? 'bold' : 'normal');
    const splitText = this.doc.splitTextToSize(cleanText, this.contentWidth);
    if (this.currentY + (splitText.length * 5) > this.safeBottom) { this.doc.addPage(); this.currentY = this.margin; }
    if (align === 'center') this.doc.text(splitText, this.pageWidth / 2, this.currentY, { align: 'center' });
    else this.doc.text(splitText, this.margin, this.currentY);
    this.currentY += (splitText.length * 5) + 2;
  }

  ensureSpace(h) { if (this.currentY + h > this.safeBottom) { this.doc.addPage(); this.currentY = this.margin; } }

  addTitle(text, size = 16, style = 'bold') {
    const cleanText = this.stripHtml(text);
    this.doc.setFontSize(size);
    this.doc.setFont('helvetica', style === 'normal' ? 'normal' : 'bold');
    const splitText = this.doc.splitTextToSize(cleanText, this.contentWidth);
    this.doc.text(splitText, this.pageWidth / 2, this.currentY, { align: 'center' });
    this.currentY += (splitText.length * (size * 0.4)) + 5;
  }

  addTable(headers, data, title = '') {
    if (title) { this.doc.setFontSize(14); this.doc.setFont('helvetica', 'bold'); this.doc.text(title, this.margin, this.currentY); this.currentY += 10; }
    this.doc.autoTable({
      head: [headers], body: data, startY: this.currentY, margin: { left: this.margin, right: this.margin },
      styles: { font: 'helvetica', fontSize: 10, cellPadding: 3, overflow: 'linebreak' },
      headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      didParseCell: (data) => { if (data.section === 'body' && data.cell.raw && data.cell.raw.blocks) this.tableComplexCellHook(data, this.contentWidth / headers.length); },
      didDrawCell: (data) => { if (data.section === 'body' && data.cell.raw && data.cell.raw.blocks) this.tableComplexDrawHook(data, data.cell.width); },
      rowPageBreak: 'avoid'
    });
    this.currentY = this.doc.lastAutoTable.finalY + 10;
  }

  addSummarySection(indicators) {
    this.doc.setFontSize(14); this.doc.setFont('helvetica', 'bold'); this.doc.text('สรุปผลการประเมิน', this.margin, this.currentY); this.currentY += 10;
    const tableData = indicators.map((indicator, index) => {
      const result = indicator.result || indicator.operation_result || '';
      return [index + 1, String(indicator.name || indicator.indicator_name || '-'), String(indicator.type || '-'), String(indicator.score || indicator.operation_score || '-'), String(indicator.status || '-'), { content: '', blocks: this.parseHtmlToBlocks(result || indicator.comment || '-') }];
    });
    this.addTable(['ลำดับ', 'ตัวบ่งชี้', 'ประเภท', 'คะแนน', 'สถานะ', 'หมายเหตุ/ผลดำเนินงาน'], tableData);
  }

  save(filename) { this.addFootersToAllPages(); this.doc.save(filename); }
  getBlob() { this.addFootersToAllPages(); return this.doc.output('blob'); }
  addFootersToAllPages() {
    const totalPages = this.doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) { this.doc.setPage(i); this.drawSingleFooter(i, totalPages); }
  }
  drawSingleFooter(pageNumber, totalPages) {
    const footerY = this.pageHeight - 15;
    this.doc.setDrawColor(200, 200, 200); this.doc.setLineWidth(0.1); this.doc.line(this.margin, footerY - 5, this.pageWidth - this.margin, footerY - 5);
    this.doc.setFontSize(9); this.doc.setFont('helvetica', 'normal'); this.doc.setTextColor(100, 100, 100);
    this.doc.text(`พิมพ์เมื่อ ${new Date().toLocaleString('th-TH')}`, this.margin, footerY);
    this.doc.text('ระบบประกันคุณภาพ AUN-QA', this.pageWidth / 2, footerY, { align: 'center' });
    this.doc.text(`หน้า ${pageNumber} / ${totalPages}`, this.pageWidth - this.margin, footerY, { align: 'right' });
  }

  async generateAssessmentReport(reportData, indicators = []) {
    await this.preloadImages(indicators); this.addHeader(reportData.title, 'รายงานการประเมินคุณภาพ AUN-QA'); this.addInfoSection(reportData);
    if (indicators.length > 0) this.addSummarySection(indicators);
    if (indicators.length > 0) {
      const scoreData = indicators.filter(i => i.score).map(i => ({ label: i.name.substring(0, 10) + '...', value: parseFloat(i.score) }));
      if (scoreData.length > 0) this.addChart('กราฟคะแนนการประเมิน', scoreData);
    }
    return this;
  }

  async generateSummaryReport(summaryData) {
    this.addHeader('รายงานสรุปการประเมิน', 'ภาพรวมผลการประเมินคุณภาพ');
    const summaryInfo = [['จำนวนรายงานทั้งหมด:', summaryData.totalReports || '0'], ['รายงานที่สมบูรณ์:', summaryData.completedReports || '0'], ['รายงานที่ดำเนินการ:', summaryData.inProgressReports || '0'], ['คะแนนเฉลี่ยทั้งหมด:', summaryData.averageScore || '0.00'], ['ตัวบ่งชี้ทั้งหมด:', summaryData.totalIndicators || '0'], ['การประเมินทั้งหมด:', summaryData.totalEvaluations || '0']];
    this.doc.setFontSize(12); let y = this.currentY;
    summaryInfo.forEach(([label, value]) => { this.doc.setFont('helvetica', 'bold'); this.doc.text(label, this.margin, y); this.doc.setFont('helvetica', 'normal'); this.doc.text(value, this.margin + 60, y); y += 8; });
    this.currentY = y + 10;
    if (summaryData.statusData) this.addPieChart('สัดส่วนสถานะรายงาน', summaryData.statusData);
    return this;
  }

  addPieChart(title, data) {
    this.doc.setFontSize(14); this.doc.setFont('helvetica', 'bold'); this.doc.text(title, this.margin, this.currentY); this.currentY += 15;
    const centerX = this.pageWidth / 2, centerY = this.currentY + 30, radius = 25, total = data.reduce((sum, item) => sum + item.value, 0);
    let currentAngle = 0;
    data.forEach((item, index) => {
      const sliceAngle = (item.value / total) * 360, endAngle = currentAngle + sliceAngle;
      this.doc.setFillColor(...this.getColorByIndex(index)); this.doc.circle(centerX, centerY, radius, 'F');
      const legendY = this.currentY + 70 + (index * 8); this.doc.setFillColor(...this.getColorByIndex(index)); this.doc.rect(this.margin, legendY, 5, 5, 'F');
      this.doc.setFontSize(10); this.doc.setFont('helvetica', 'normal'); this.doc.text(`${item.label}: ${item.value}`, this.margin + 10, legendY + 4);
      currentAngle = endAngle;
    });
    this.currentY += 100;
  }

  getColorByIndex(index) {
    const colors = [[59, 130, 246], [16, 185, 129], [96, 165, 250], [239, 68, 68], [139, 92, 246], [236, 72, 153]];
    return colors[index % colors.length];
  }
}

export const generateAssessmentPDF = async (reportData, indicators = [], filename = 'assessment-report.pdf') => { const pdf = new PDFGenerator(); await pdf.generateAssessmentReport(reportData, indicators); pdf.save(filename); };
export const generateSummaryPDF = async (summaryData, filename = 'summary-report.pdf') => { const pdf = new PDFGenerator(); await pdf.generateSummaryReport(summaryData); pdf.save(filename); };
export const downloadPDF = async (reportData, indicators = []) => { const pdf = new PDFGenerator(); await pdf.generateAssessmentReport(reportData, indicators); return pdf.getBlob(); };
