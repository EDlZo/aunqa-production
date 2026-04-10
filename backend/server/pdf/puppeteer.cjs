// puppeteer.cjs - Optimized for A4 PDF Print - Supports Vercel Deployment
const fs = require('fs');
const path = require('path');
const { renderTemplate } = require('./render.cjs');

function loadFontAsBase64(fontPath) {
    try {
        const fontBuffer = fs.readFileSync(fontPath);
        return fontBuffer.toString('base64');
    } catch (e) {
        console.warn('Font not found:', fontPath);
        return null;
    }
}

async function generatePDF(data) {
    let browser;
    try {
        if (process.env.VERCEL) {
            // Vercel / Serverless Environment (Node 20+ / Amazon Linux 2023)
            const puppeteerCore = require('puppeteer-core');
            const chromium = require('@sparticuz/chromium-min');

            chromium.setGraphicsMode = false;

            const executablePath = await chromium.executablePath(
                'https://github.com/Sparticuz/chromium/releases/download/v143.0.4/chromium-v143.0.4-pack.x64.tar'
            );

            browser = await puppeteerCore.launch({
                args: puppeteerCore.defaultArgs({ args: chromium.args, headless: 'shell' }),
                defaultViewport: { width: 1920, height: 1080 },
                executablePath,
                headless: 'shell',
                ignoreHTTPSErrors: true,
            });
        } else {
            // Local Development
            const puppeteerLocal = require('puppeteer');
            browser = await puppeteerLocal.launch({
                headless: 'new',
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
        }

        const page = await browser.newPage();
        const templatePath = path.join(__dirname, 'template.html');
        const stylesPath = path.join(__dirname, 'styles.css');

        const html = fs.readFileSync(templatePath, 'utf8');
        const styles = fs.readFileSync(stylesPath, 'utf8');

        // Load fonts as base64
        const fontRegular = loadFontAsBase64(path.join(__dirname, 'fonts', 'Sarabun-Regular.ttf'));
        const fontBold = loadFontAsBase64(path.join(__dirname, 'fonts', 'Sarabun-Bold.ttf'));

        const fontFaceCSS = `
            ${fontRegular ? `
            @font-face {
                font-family: 'TH Sarabun New';
                font-style: normal;
                font-weight: 400;
                src: url('data:font/truetype;base64,${fontRegular}') format('truetype');
            }` : ''}
            ${fontBold ? `
            @font-face {
                font-family: 'TH Sarabun New';
                font-style: normal;
                font-weight: 700;
                src: url('data:font/truetype;base64,${fontBold}') format('truetype');
            }` : ''}
        `;

        // Inject font-face + styles directly into <head> before rendering
        const htmlWithStyles = html.replace(
            '</head>',
            `<style>${fontFaceCSS}</style><style>${styles}</style></head>`
        );

        // Add fonts to header/footer templates too (isolated context)
        const headerFooterStyle = `<style>${fontFaceCSS}</style>`;
        
        // Handle logo_url conversion to base64 if it's a relative path
        if (data.logo_url && data.logo_url.startsWith('/')) {
            const logoPath = path.join(__dirname, '..', '..', 'public', data.logo_url.substring(1));
            const logoBase64 = loadFontAsBase64(logoPath); // Re-use buffer to base64 helper
            if (logoBase64) {
                const ext = path.extname(logoPath).substring(1) || 'png';
                data.logo_url = `data:image/${ext};base64,${logoBase64}`;
            }
        }

        const finalHtml = renderTemplate(htmlWithStyles, data);
        console.log('[PDF] renderTemplate done, html length:', finalHtml.length);

        await page.setContent(finalHtml, { waitUntil: 'networkidle0' });
        console.log('[PDF] setContent done');

        // Wait for fonts to load
        await page.evaluateHandle('document.fonts.ready');
        console.log('[PDF] fonts ready');

        // Emulate print media BEFORE layout so @page and print CSS applies correctly
        await page.emulateMediaType('print');
        console.log('[PDF] emulateMediaType done');

        // A4 full page height at 96dpi: 297mm * 96/25.4 ≈ 1122.52px
        const PAGE_HEIGHT_PX = (297 / 25.4) * 96;

        // Inject TOC page numbers — accounts for CSS page-break-before: always
        try {
            console.log('[TOC] Starting page number injection...');

            await page.evaluate((pageH) => {
                // In Puppeteer's print layout, page-break-before/after:always does NOT
                // add pixel height to the DOM. We must count forced breaks manually.
                // Avoid double-counting: if prev element had page-break-after, skip page-break-before.

                const allEls = Array.from(document.querySelectorAll('*'));
                const pageNumMap = new Map(); // element → page number it starts on
                let currentPage = 1;
                let lastHadBreakAfter = false;

                for (const el of allEls) {
                    const cs = window.getComputedStyle(el);
                    const pbBefore = cs.getPropertyValue('page-break-before') || cs.getPropertyValue('break-before') || '';
                    const hasBefore = pbBefore === 'always' || pbBefore === 'page';
                    // Only count page-break-before if previous element didn't already break after
                    if (hasBefore && !lastHadBreakAfter) currentPage++;

                    pageNumMap.set(el, currentPage);

                    const pbAfter = cs.getPropertyValue('page-break-after') || cs.getPropertyValue('break-after') || '';
                    const hasAfter = pbAfter === 'always' || pbAfter === 'page';
                    if (hasAfter) currentPage++;
                    lastHadBreakAfter = hasAfter;
                }

                document.querySelectorAll('[data-target]').forEach(numEl => {
                    const targetId = numEl.getAttribute('data-target');
                    const target = document.getElementById(targetId);
                    if (!target) { numEl.textContent = '?'; return; }

                    // Base page from forced breaks
                    const basePage = pageNumMap.get(target) || 1;

                    // Raw offsetTop within its local stacking context (for content within same page)
                    let rawTop = 0;
                    let el = target;
                    while (el && el !== document.body) {
                        rawTop += el.offsetTop || 0;
                        el = el.offsetParent;
                    }
                    const pageOffset = Math.floor(rawTop / pageH);

                    numEl.textContent = String(basePage + pageOffset);
                });
            }, PAGE_HEIGHT_PX);

            // Log TOC results for debugging (includes raw position info)
            const tocResults = await page.evaluate(() => {
                const items = Array.from(document.querySelectorAll('[data-target]'));
                return items.map(el => ({
                    target: el.getAttribute('data-target'),
                    page: el.textContent,
                    found: !!document.getElementById(el.getAttribute('data-target'))
                }));
            });
            console.log('[TOC] results:', JSON.stringify(tocResults));
        } catch (tocErr) {
            console.error('[TOC] evaluate error:', tocErr.message);
        }

        // Bake computed styles of rich-content table cells into inline styles
        // so CSS cascade cannot override what the editor set
        await page.evaluate(() => {
            // Convert px to pt: 1px = 0.75pt (96dpi screen → 72dpi print)
            const pxToPt = (px) => {
                const num = parseFloat(px);
                if (isNaN(num)) return null;
                return (num * 0.75).toFixed(1) + 'pt';
            };

            document.querySelectorAll('.rich-content table td, .rich-content table th').forEach(cell => {
                const cs = window.getComputedStyle(cell);
                const existing = cell.getAttribute('style') || '';

                const inlineMap = {};
                existing.split(';').forEach(rule => {
                    const idx = rule.indexOf(':');
                    if (idx === -1) return;
                    const k = rule.slice(0, idx).trim().toLowerCase();
                    const v = rule.slice(idx + 1).trim();
                    if (k && v) inlineMap[k] = v;
                });

                const props = [
                    'font-weight', 'font-style',
                    'text-align', 'vertical-align',
                    'color', 'background-color',
                    'padding-top', 'padding-bottom', 'padding-left', 'padding-right',
                    'border-top', 'border-bottom', 'border-left', 'border-right',
                    'line-height',
                ];
                props.forEach(prop => {
                    if (!inlineMap[prop]) {
                        const val = cs.getPropertyValue(prop);
                        if (val) inlineMap[prop] = val;
                    }
                });

                // font-size: strip inline font-size — let CSS .rich-content table td { font-size: 10pt } handle it
                delete inlineMap['font-size'];

                cell.setAttribute('style', Object.entries(inlineMap).map(([k, v]) => `${k}:${v}`).join(';'));

                cell.querySelectorAll('p').forEach(p => {
                    const ps = p.getAttribute('style') || '';
                    const pm = {};
                    ps.split(';').forEach(rule => {
                        const idx = rule.indexOf(':');
                        if (idx === -1) return;
                        const k = rule.slice(0, idx).trim().toLowerCase();
                        const v = rule.slice(idx + 1).trim();
                        if (k && v) pm[k] = v;
                    });
                    pm['text-indent'] = '0';
                    pm['margin'] = '0';
                    p.setAttribute('style', Object.entries(pm).map(([k, v]) => `${k}:${v}`).join(';'));
                });
            });

            // Strip all inline font-size from rich-content elements — let CSS cascade handle sizing
            const BROWSER_PX_TO_PT = { 10: 7, 13: 8, 16: 10, 18: 12, 24: 14, 32: 16, 48: 18 };
            document.querySelectorAll('.rich-content span, .rich-content div, .rich-content p, .rich-content font').forEach(el => {
                const style = el.getAttribute('style');
                if (!style || !style.includes('font-size')) return;
                const updated = style.replace(/\s*font-size\s*:[^;}"']+;?/gi, '').trim().replace(/^;+|;+$/g, '');
                if (updated) el.setAttribute('style', updated);
                else el.removeAttribute('style');
            });

            // Handle <font size="N"> attribute — remove it
            document.querySelectorAll('.rich-content font[size]').forEach(el => {
                el.removeAttribute('size');
            });

            // Normalize headings inside rich-content — force to bold 10pt
            document.querySelectorAll('.rich-content h1, .rich-content h2, .rich-content h3, .rich-content h4, .rich-content h5, .rich-content h6').forEach(el => {
                const style = el.getAttribute('style') || '';
                const updated = style.replace(/font-size\s*:[^;]*/gi, '') + ';font-size:10pt;font-weight:bold';
                el.setAttribute('style', updated.replace(/^;/, ''));
            });
        });

        const pdfBuffer = await page.pdf({
            preferCSSPageSize: true, // Crucial for mixed orientation support
            printBackground: true,
            displayHeaderFooter: true,
            headerTemplate: `
                ${headerFooterStyle}
                <div style="font-family: 'TH Sarabun New', sans-serif; width: calc(100% - 40mm); margin: 0 auto; padding-top: 8mm; box-sizing: border-box;">
                    <div style="display: flex; justify-content: space-between; font-size: 11pt; color: #1e40af; font-weight: bold; margin-bottom: 1mm;">
                        <span>${data.faculty_name || 'คณะวิศวกรรมศาสตร์'}</span>
                        <span style="text-align: right;">${data.university_name || 'มหาวิทยาลัยเทคโนโลยีราชมงคลศรีวิชัย'}</span>
                    </div>
                    <div style="width: 100%; height: 1.5pt; background-color: #1e40af;"></div>
                </div>
            `,
            footerTemplate: `
                ${headerFooterStyle}
                <div style="font-family: 'TH Sarabun New', sans-serif; width: calc(100% - 40mm); margin: 0 auto; padding-bottom: 8mm; box-sizing: border-box;">
                    <div style="width: 100%; height: 1pt; background-color: #1e40af; margin-bottom: 2mm;"></div>
                    <div style="display: flex; justify-content: space-between; font-size: 10pt; color: #1e40af; font-weight: bold;">
                        <span style="flex: 1;">รายงานการประเมินคุณภาพการศึกษาภายในหลักสูตร${data.program_name || ''} ปีการศึกษา ${data.year || ''}</span>
                        <span style="width: 40px; text-align: right;">-<span class="pageNumber"></span>-</span>
                    </div>
                </div>
            `
        });

        return pdfBuffer;
    } catch (error) {
        console.error('PDF Generation Error:', error);
        throw error;
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { generatePDF };
