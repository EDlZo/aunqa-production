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
            // Uses chromium-min to avoid 50MB bundle limit — binary downloaded at runtime
            const puppeteerCore = require('puppeteer-core');
            const chromium = require('@sparticuz/chromium-min');

            // Disable WebGL to avoid missing graphics library errors (libnss3.so etc.)
            chromium.setGraphicsMode = false;

            browser = await puppeteerCore.launch({
                args: chromium.args,
                defaultViewport: chromium.defaultViewport,
                executablePath: await chromium.executablePath(
                    'https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar'
                ),
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
                <div style="font-family: 'TH Sarabun New', sans-serif; width: 100%; margin: 0 20mm; padding-top: 10mm;">
                    <div style="display: flex; justify-content: space-between; font-size: 11pt; color: #1e40af; font-weight: bold; margin-bottom: 1mm;">
                        <span>${data.faculty_name || 'คณะวิศวกรรมศาสตร์'}</span>
                        <span style="text-align: right;">${data.university_name || 'มหาวิทยาลัยเทคโนโลยีราชมงคลศรีวิชัย'}</span>
                    </div>
                    <div style="width: 100%; height: 1.5pt; background-color: #1e40af; border-bottom: 0.5pt solid #1e40af;"></div>
                </div>
            `,
            footerTemplate: `
                <div style="font-family: 'TH Sarabun New', sans-serif; width: 100%; margin: 0 20mm; padding-bottom: 10mm;">
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
