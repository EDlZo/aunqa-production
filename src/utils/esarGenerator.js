import jsPDFSource from 'jspdf';
import autoTable from 'jspdf-autotable';

// Prioritize global jsPDF if available (it has the fonts registered from index.html)
const jsPDF = (typeof window !== 'undefined' && (window.jsPDF || (window.jspdf && (window.jspdf.jsPDF || window.jspdf)))) || jsPDFSource;

/**
 * ESAR Report Generator
 * Generates a comprehensive ESAR report for AUN-QA
 */
export class ESARGenerator {
    constructor(options = {}) {
        this.doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        this.program = options.program || {};
        this.year = options.year || '';
        this.evaluations = options.evaluations || []; // evaluations_actual (Self-Assessment)
        this.indicators = options.indicators || [];
        this.components = options.components || [];
        this.criteria = options.criteria || [];
        this.committeeEvaluations = options.committeeEvaluations || [];
        this.metadata = options.metadata || {};

        this.imageDimensions = new Map();

        this.pageWidth = this.doc.internal.pageSize.getWidth();
        this.pageHeight = this.doc.internal.pageSize.getHeight();
        this.margin = 20;
        this.footerHeight = 15;
        this.safeBottom = this.pageHeight - this.margin - this.footerHeight;
        this.contentWidth = this.pageWidth - (this.margin * 2);

        // Font setting
        let availableFonts = {};
        try { availableFonts = this.doc.getFontList(); } catch (e) { }

        this.fontFamily = 'THSarabun';
        if (!availableFonts[this.fontFamily]) {
            if (availableFonts['Sarabun-Regular']) this.fontFamily = 'Sarabun-Regular';
            else if (availableFonts['Sarabun']) this.fontFamily = 'Sarabun';
            else this.fontFamily = 'helvetica';
        }

        this.doc.setFont(this.fontFamily, 'normal');
    }

    setFontSafe(style = 'normal') {
        try { this.doc.setFont(this.fontFamily, 'normal'); } catch (e) { }
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
                if (['P', 'DIV', 'H1', 'H2', 'H3', 'LI'].includes(node.nodeName.toUpperCase())) {
                    blocks.push({ type: 'text', content: '\n' });
                }
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

    async preloadImages() {
        if (typeof window === 'undefined') return;
        const imageUrls = new Set();
        ['history', 'vision', 'mission', 'structure'].forEach(key => {
            this.extractImageData(this.metadata[key]).forEach(url => imageUrls.add(url));
        });
        if (this.metadata.swot) {
            ['s', 'w', 'o', 't'].forEach(key => this.extractImageData(this.metadata.swot[key]).forEach(url => imageUrls.add(url)));
        }
        this.evaluations.forEach(ev => {
            this.extractImageData(ev.operation_result || ev.result).forEach(url => imageUrls.add(url));
            this.extractImageData(ev.comment).forEach(url => imageUrls.add(url));
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

    addTitle(text, size = 16, style = 'bold') {
        const cleanText = this.stripHtml(text);
        this.doc.setFontSize(size);
        this.setFontSafe(style);
        const splitText = this.doc.splitTextToSize(cleanText, this.contentWidth);
        this.doc.text(splitText, this.pageWidth / 2, this.currentY, { align: 'center' });
        this.currentY += (splitText.length * (size * 0.4)) + 5;
    }

    addText(text, size = 12, style = 'normal', align = 'left') {
        const cleanText = this.stripHtml(text);
        this.doc.setFontSize(size);
        this.setFontSafe(style);
        const splitText = this.doc.splitTextToSize(cleanText, this.contentWidth);
        if (this.currentY + (splitText.length * 5) > this.safeBottom) this.addPage();
        if (align === 'center') this.doc.text(splitText, this.pageWidth / 2, this.currentY, { align: 'center' });
        else this.doc.text(splitText, this.margin, this.currentY);
        this.currentY += (splitText.length * 5) + 2;
    }

    addPage() {
        this.doc.addPage();
        this.currentY = this.margin;
    }

    addFootersToAllPages() {
        const totalPages = this.doc.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            this.doc.setPage(i);
            this.drawSingleFooter(i, totalPages);
        }
    }

    drawSingleFooter(pageNumber, totalPages) {
        const footerY = this.pageHeight - 10;
        this.doc.setFontSize(9);
        this.doc.setFont(this.fontFamily, 'normal');
        this.doc.setTextColor(100, 100, 100);
        this.doc.text(`หน้า ${pageNumber} / ${totalPages}`, this.pageWidth - this.margin, footerY, { align: 'right' });
        this.doc.text(`รายงาน ESAR - ${this.program.majorName || ''} (${this.year})`, this.margin, footerY);
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
                h += (lines.length * 5); // v13 multiplier (compact)
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

    drawBlocks(blocks, cellX, cellY, cellWidth, maxHeight = 9999) {
        let localY = cellY + 2;
        const padding = 6;
        const drawWidth = Math.max(10, cellWidth - padding);

        for (const block of blocks) {
            if (localY > this.safeBottom + 5) break;

            if (block.type === 'text') {
                this.doc.setFontSize(10);
                this.doc.setFont(this.fontFamily, 'normal');
                const split = this.doc.splitTextToSize(block.content, drawWidth);
                this.doc.text(split, cellX + 3, localY + 3);
                localY += (split.length * 5);
            } else if (block.type === 'table') {
                const tableWidth = drawWidth - 1;
                // Calculate equal column widths to match estimation logic
                const numCols = block.content[0] ? block.content[0].length : 1;
                const colWidth = tableWidth / numCols;
                const columnStyles = {};
                for (let i = 0; i < numCols; i++) {
                    columnStyles[i] = { cellWidth: colWidth };
                }

                autoTable(this.doc, {
                    body: block.content,
                    startY: localY + 1,
                    margin: { left: cellX + 2.5 },
                    tableWidth: tableWidth,
                    theme: 'grid',
                    styles: { font: this.fontFamily, fontSize: 8, cellPadding: 1, minCellHeight: 7, lineWidth: 0.1, overflow: 'linebreak' },
                    columnStyles: columnStyles, // Enforce equal width
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
                        if (imgHeight > 60) { imgHeight = 60; imgWidth = imgHeight / ratio; }
                        const offsetX = (drawWidth - imgWidth) / 2;
                        this.doc.addImage(block.content, format, cellX + 3 + offsetX, localY + 1, imgWidth, imgHeight);
                        localY += imgHeight + 3;
                    }
                } catch (e) { }
            }
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

    async generate() {
        await this.preloadImages();
        this.currentY = 60;
        this.renderCoverPage();
        this.addPage();
        this.renderIntroduction();
        this.addPage();
        this.renderOverallSummary();
        this.addPage();
        this.renderSWOT();

        // Sort components by component_id before rendering
        const sortedComponents = [...this.components].sort((a, b) => {
            const idA = parseInt(a.component_id || a.id || 0);
            const idB = parseInt(b.component_id || b.id || 0);
            return idA - idB;
        });

        sortedComponents.forEach(component => {
            if (component) {
                this.addPage();
                this.renderComponentSection(component);
            }
        });
        return this.doc;
    }

    renderIntroduction() {
        this.addTitle('บทที่ 1: โครงร่างองค์กร (Organization Profile)', 16);
        this.currentY += 5;
        if (this.metadata.history) { this.addTitle('ประวัติความเป็นมา (History)', 14, 'bold'); this.addText(this.metadata.history); this.currentY += 5; }
        if (this.metadata.vision) { this.addTitle('วิสัยทัศน์ (Vision)', 14, 'bold'); this.addText(this.metadata.vision); this.currentY += 5; }
        if (this.metadata.mission) { this.addTitle('พันธกิจ (Mission)', 14, 'bold'); this.addText(this.metadata.mission); this.currentY += 5; }
        if (this.metadata.structure) { this.addTitle('โครงสร้างการบริหาร (Organization Structure)', 14, 'bold'); this.addText(this.metadata.structure); this.currentY += 5; }
    }

    renderSWOT() {
        this.addTitle('บทที่ 3: สรุปจุดแข็งและข้อควรพัฒนา', 16);
        this.currentY += 10;
        const sections = [
            { title: 'จุดแข็ง (Strengths)', content: this.metadata.swot?.s },
            { title: 'จุดควรพัฒนา (Areas for Improvement)', content: this.metadata.swot?.w }
        ];
        sections.forEach(section => {
            if (section.content) {
                if (this.currentY + 60 > this.safeBottom) this.addPage();
                this.addTitle(section.title, 14, 'bold');
                this.addText(section.content);
                this.currentY += 5;
            }
        });
    }

    renderCoverPage() {
        this.currentY = 40;
        this.addTitle('รายงานการประเมินตนเอง', 22);
        this.addTitle('(Self-Assessment Report: SAR)', 18);
        this.currentY += 5;
        this.addTitle('ตามเกณฑ์ AUN-QA', 16);
        this.addTitle('(ASEAN University Network-Quality Assurance)', 14);
        this.currentY += 20;
        this.addTitle('ระดับหลักสูตร', 18);
        this.addTitle(this.program.degreeName || this.program.majorName || '', 20);
        this.currentY += 20;
        this.addTitle(`ปีการศึกษา ${this.year}`, 16);
        this.currentY += 40;
        this.addTitle('คณะ/หน่วยงาน', 14, 'normal');
        this.addTitle(this.program.facultyName || '-', 16, 'bold');
        this.currentY += 10;
        this.addTitle('มหาวิทยาลัยเทคโนโลยีราชมงคลศรีวิชัย', 16, 'bold');
    }

    renderOverallSummary() {
        this.addTitle('สรุปคะแนนประเมินตนเองตามเกณฑ์ AUN-QA', 16);
        this.currentY += 5;
        const tableData = [];
        let totalTarget = 0, totalSelf = 0, totalComm = 0;
        let countTarget = 0, countSelf = 0, countComm = 0;

        // Map preparation (Latest record wins)
        const selfMap = {};
        this.evaluations.forEach(r => { selfMap[String(r.indicator_id)] = r; });
        const targetMap = {};
        this.criteria.forEach(r => { targetMap[String(r.indicator_id)] = r; });
        const commMap = {};
        this.committeeEvaluations.forEach(r => { commMap[String(r.indicator_id)] = r; });

        const getVal = (ind, dataMap, key) => {
            const item = dataMap[String(ind.id)] || dataMap[String(ind.indicator_id)] || dataMap[String(ind.sequence)] || {};
            return parseFloat(item?.[key] || item?.['score'] || 0);
        };

        const getAvgScore = (list, dataMap, scoreKey) => {
            const valid = list.map(ind => {
                const val = getVal(ind, dataMap, scoreKey);
                return val > 0 ? val : NaN;
            }).filter(s => !isNaN(s));
            return valid.length > 0 ? (valid.reduce((a, b) => a + b, 0) / valid.length) : null;
        };

        // Sort components by component_id
        const sortedComponents = [...this.components].sort((a, b) => {
            const idA = parseInt(a.component_id || a.id || 0);
            const idB = parseInt(b.component_id || b.id || 0);
            return idA - idB;
        });

        sortedComponents.forEach((component) => {
            const compIndicators = this.indicators.filter(ind =>
                String(ind.component_id) === String(component.id) ||
                String(ind.component_id) === String(component.component_id)
            );

            const targetScore = getAvgScore(compIndicators, targetMap, 'score');
            const selfScore = getAvgScore(compIndicators, selfMap, 'operation_score');
            const commScore = getAvgScore(compIndicators, commMap, 'committee_score');

            tableData.push([
                component.component_id || component.id || '-',
                component.quality_name,
                targetScore !== null ? targetScore.toFixed(2) : '-',
                selfScore !== null ? selfScore.toFixed(2) : '-',
                commScore !== null ? commScore.toFixed(2) : '-'
            ]);

            if (targetScore !== null) { totalTarget += targetScore; countTarget++; }
            if (selfScore !== null) { totalSelf += selfScore; countSelf++; }
            if (commScore !== null) { totalComm += commScore; countComm++; }
        });

        // Add Footer Row to table data
        const footerRow = [
            '',
            'คะแนนเฉลี่ยรวมทุกเกณฑ์',
            countTarget > 0 ? (totalTarget / countTarget).toFixed(2) : '-',
            countSelf > 0 ? (totalSelf / countSelf).toFixed(2) : '-',
            countComm > 0 ? (totalComm / countComm).toFixed(2) : '-'
        ];
        tableData.push(footerRow);

        autoTable(this.doc, {
            head: [['ลำดับ', 'หัวข้อเกณฑ์ AUN-QA', 'เป้าหมาย', 'ประเมินตน', 'กรรมการ']],
            body: tableData,
            startY: this.currentY,
            theme: 'grid',
            styles: { font: this.fontFamily, fontSize: 10, cellPadding: 2, fontStyle: 'normal' },
            headStyles: { fillColor: [51, 65, 85], textColor: 255, halign: 'center', fontStyle: 'normal', cellPadding: 1.5 },
            columnStyles: {
                0: { halign: 'center', cellWidth: 15 },
                2: { halign: 'center', cellWidth: 20 },
                3: { halign: 'center', cellWidth: 20 },
                4: { halign: 'center', cellWidth: 20 }
            },
            didParseCell: (data) => {
                if (data.row.index === tableData.length - 1) {
                    data.cell.styles.font = this.fontFamily;
                    data.cell.styles.fontStyle = 'normal'; // ป้องกันเพี้ยน
                    data.cell.styles.fillColor = [243, 244, 246]; // bg-gray-100
                }
            },
            rowPageBreak: 'avoid'
        });
        this.currentY = this.doc.lastAutoTable.finalY + 10;
    }

    renderComponentSection(component) {
        const componentNumber = component.component_id || component.id || '';
        this.addTitle(`องค์ประกอบที่ ${componentNumber} ${component.quality_name}`, 15);
        this.currentY += 5;

        const compIndicators = this.indicators.filter(ind =>
            String(ind.component_id) === String(component.id) ||
            String(ind.component_id) === String(component.component_id)
        );

        if (compIndicators.length === 0) { this.addText('ไม่พบข้อมูลตัวบ่งชี้ในหมวดนี้', 12, 'italic'); return; }

        // Map preparation (Latest record wins)
        const selfMap = {};
        this.evaluations.forEach(r => { selfMap[String(r.indicator_id)] = r; });
        const targetMap = {};
        this.criteria.forEach(r => { targetMap[String(r.indicator_id)] = r; });
        const commMap = {};
        this.committeeEvaluations.forEach(r => { commMap[String(r.indicator_id)] = r; });

        const getVal = (ind, dataMap, key) => {
            const item = dataMap[String(ind.id)] || dataMap[String(ind.indicator_id)] || dataMap[String(ind.sequence)] || {};
            return parseFloat(item?.[key] || item?.['score'] || 0);
        };

        compIndicators.sort((a, b) => {
            const seqA = String(a.sequence || '').split('.').map(Number);
            const seqB = String(b.sequence || '').split('.').map(Number);
            for (let i = 0; i < Math.max(seqA.length, seqB.length); i++) {
                if ((seqA[i] || 0) < (seqB[i] || 0)) return -1;
                if ((seqA[i] || 0) > (seqB[i] || 0)) return 1;
            }
            return 0;
        });

        const body = compIndicators.map(ind => {
            const evalEntry = selfMap[String(ind.id)] || selfMap[String(ind.indicator_id)] || selfMap[String(ind.sequence)] || {};
            const critEntry = targetMap[String(ind.id)] || targetMap[String(ind.indicator_id)] || targetMap[String(ind.sequence)] || {};
            const commEntry = commMap[String(ind.id)] || commMap[String(ind.indicator_id)] || commMap[String(ind.sequence)] || {};

            const resultText = evalEntry.operation_result || evalEntry.result || '-';
            const targetScore = critEntry.score || '-';
            const selfScore = evalEntry.operation_score || evalEntry.score || '-';
            const commScore = commEntry.committee_score || '-';

            return [
                ind.sequence || '-',
                ind.indicator_name || '-',
                { content: '', blocks: this.parseHtmlToBlocks(resultText) },
                targetScore,
                selfScore,
                commScore
            ];
        });

        // Add Footer Row for averages
        const mainCount = compIndicators.filter(ind => !String(ind.sequence).includes('.')).length;

        const getAvg = (list, dataMap, scoreKey) => {
            const valid = list.map(ind => {
                const val = getVal(ind, dataMap, scoreKey);
                return val > 0 ? val : NaN;
            }).filter(v => !isNaN(v));
            if (valid.length === 0) return '-';
            const avg = valid.reduce((a, b) => a + b, 0) / valid.length;
            return Number.isInteger(avg) ? avg : avg.toFixed(2);
        };

        const targetAvg = getAvg(compIndicators, targetMap, 'score');
        const selfAvg = getAvg(compIndicators, selfMap, 'operation_score');
        const commAvg = getAvg(compIndicators, commMap, 'committee_score');

        body.push([
            '',
            `รวม ${mainCount} ตัวบ่งชี้`,
            '',
            targetAvg,
            selfAvg,
            commAvg
        ]);

        autoTable(this.doc, {
            head: [['ลำดับ', 'ตัวบ่งชี้', 'ผลการดำเนินงาน', 'เป้าหมาย', 'ประเมินตน', 'กรรมการ']],
            body: body,
            startY: this.currentY,
            theme: 'grid',
            styles: { font: this.fontFamily, fontSize: 10, cellPadding: 2, overflow: 'linebreak', fontStyle: 'normal' },
            headStyles: { fillColor: [51, 65, 85], textColor: 255, halign: 'center', fontStyle: 'normal', fontSize: 10, cellPadding: 1.5 },
            columnStyles: {
                0: { halign: 'center', cellWidth: 15 },
                1: { cellWidth: 35 },
                2: { cellWidth: 60 },
                3: { halign: 'center', cellWidth: 20 },
                4: { halign: 'center', cellWidth: 20 },
                5: { halign: 'center', cellWidth: 20 }
            },
            didParseCell: (data) => {
                if (data.section === 'body' && data.column.index === 2) this.tableComplexCellHook(data, 60);
                if (data.row.index === body.length - 1) {
                    data.cell.styles.font = this.fontFamily;
                    data.cell.styles.fontStyle = 'normal'; // ป้องกันเพี้ยน
                    data.cell.styles.fillColor = [243, 244, 246];
                    if (data.column.index === 1) data.cell.styles.halign = 'right';
                }
            },
            didDrawCell: (data) => { if (data.section === 'body' && data.column.index === 2) this.tableComplexDrawHook(data, data.cell.width); },
            rowPageBreak: 'avoid'
        });
        this.currentY = this.doc.lastAutoTable.finalY + 15;
        const evidenceList = [];
        const evidenceLinks = []; // Store links for later

        compIndicators.forEach(ind => {
            const evalData = this.evaluations.find(e => String(e.indicator_id) === String(ind.id));
            if (evalData && evalData.evidence_meta_json) {
                try {
                    const meta = JSON.parse(evalData.evidence_meta_json);
                    Object.values(meta).forEach(m => {
                        const fileName = m.name || m.url || '-';
                        const fileUrl = m.url || '';
                        evidenceList.push([ind.sequence, fileName]);
                        evidenceLinks.push(fileUrl);
                    });
                } catch (e) { }
            }
        });

        if (evidenceList.length > 0) {
            if (this.currentY + 20 > this.safeBottom) this.addPage();
            this.doc.setFontSize(12);
            this.setFontSafe();
            this.doc.text('รายการหลักฐานอ้างอิง:', this.margin, this.currentY);
            this.currentY += 5;

            autoTable(this.doc, {
                head: [['ตัวบ่งชี้', 'ชื่อเอกสารหลักฐาน']],
                body: evidenceList,
                startY: this.currentY,
                theme: 'striped',
                styles: { font: this.fontFamily, fontSize: 9, fontStyle: 'normal' },
                headStyles: { fillColor: [148, 163, 184], textColor: 255, fontStyle: 'normal' },
                columnStyles: {
                    1: { textColor: [37, 99, 235] } // Blue color for links
                },
                didDrawCell: (data) => {
                    // Add clickable link to evidence file name
                    if (data.section === 'body' && data.column.index === 1) {
                        const rowIndex = data.row.index;
                        const url = evidenceLinks[rowIndex];

                        if (url) {
                            // Add underline to indicate it's a link
                            const textWidth = this.doc.getTextWidth(data.cell.text[0] || '');
                            this.doc.setDrawColor(37, 99, 235);
                            this.doc.setLineWidth(0.1);
                            this.doc.line(
                                data.cell.x + 2,
                                data.cell.y + data.cell.height - 2,
                                data.cell.x + 2 + textWidth,
                                data.cell.y + data.cell.height - 2
                            );

                            // Add clickable link
                            this.doc.link(
                                data.cell.x,
                                data.cell.y,
                                data.cell.width,
                                data.cell.height,
                                { url: url }
                            );
                        }
                    }
                },
                rowPageBreak: 'avoid'
            });
            this.currentY = this.doc.lastAutoTable.finalY + 10;
        }
    }

    save(filename = 'ESAR-Report.pdf') { this.addFootersToAllPages(); this.doc.save(filename); }
    getBlob() { this.addFootersToAllPages(); return this.doc.output('blob'); }
}
