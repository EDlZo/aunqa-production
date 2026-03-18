const puppeteer = require('puppeteer');
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
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

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

        const finalHtml = renderTemplate(htmlWithStyles, data);

        await page.setContent(finalHtml, { waitUntil: 'networkidle0' });

        // Wait for fonts to load
        await page.evaluateHandle('document.fonts.ready');

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '25mm', bottom: '25mm', left: '20mm', right: '20mm' },
            displayHeaderFooter: true,
            headerTemplate: `
                <div style="font-family: 'TH Sarabun New', sans-serif; font-size: 8pt; width: 100%; text-align: center; border-bottom: 0.5pt solid #eee; padding-bottom: 5px; color: #666; margin: 0 20mm;">
                    ${data.university_name || ''} | ${data.faculty_name || ''} | ESAR ${data.year || ''}
                </div>
            `,
            footerTemplate: `
                <div style="font-family: 'TH Sarabun New', sans-serif; font-size: 9pt; width: 100%; text-align: center; color: #666;">
                    - <span class="pageNumber"></span> -
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
