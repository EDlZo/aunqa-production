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

        await page.setContent(finalHtml, { waitUntil: 'networkidle0' });

        // Wait for fonts to load
        await page.evaluateHandle('document.fonts.ready');

        // Bake computed styles of rich-content table cells into inline styles
        // so CSS cascade cannot override what the editor set
        await page.evaluate(() => {
            // Convert browser px to pt (browser = 96dpi, print = 72dpi)
            // But Word's 16pt in browser = 21.3px, we want to keep it as pt
            // So we convert: pt = px * 72 / 96 = px * 0.75
            // Then scale down to fit PDF page: Word uses ~16pt for body but PDF uses 10pt
            // Scale factor: 10/16 = 0.625
            const pxToPt = (px) => {
                const num = parseFloat(px);
                if (isNaN(num)) return null;
                const pt = num * 0.75; // px to pt
                // Cap at 16pt max to prevent oversized text in PDF
                return Math.min(pt, 16).toFixed(1) + 'pt';
            };

            document.querySelectorAll('.rich-content table td, .rich-content table th').forEach(cell => {
                const cs = window.getComputedStyle(cell);
                const existing = cell.getAttribute('style') || '';

                // Parse existing inline style
                const inlineMap = {};
                existing.split(';').forEach(rule => {
                    const idx = rule.indexOf(':');
                    if (idx === -1) return;
                    const k = rule.slice(0, idx).trim().toLowerCase();
                    const v = rule.slice(idx + 1).trim();
                    if (k && v) inlineMap[k] = v;
                });

                // Properties to bake (excluding font-size — handle separately)
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

                // Handle font-size: convert px to pt and cap
                if (!inlineMap['font-size']) {
                    const fsPt = pxToPt(cs.getPropertyValue('font-size'));
                    if (fsPt) inlineMap['font-size'] = fsPt;
                } else {
                    // If editor set font-size in pt already, keep it but cap at 14pt
                    const existing_fs = inlineMap['font-size'];
                    if (existing_fs.endsWith('pt')) {
                        const val = parseFloat(existing_fs);
                        if (!isNaN(val)) inlineMap['font-size'] = Math.min(val, 16).toFixed(1) + 'pt';
                    } else if (existing_fs.endsWith('px')) {
                        const fsPt = pxToPt(existing_fs);
                        if (fsPt) inlineMap['font-size'] = fsPt;
                    }
                }

                cell.setAttribute('style', Object.entries(inlineMap).map(([k, v]) => `${k}:${v}`).join(';'));

                // Reset <p> tags inside cells — remove text-indent and margin added by .rich-content p
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
