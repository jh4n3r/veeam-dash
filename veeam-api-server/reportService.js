// veeam-api-server/reportService.js
const puppeteer = require('puppeteer');
const nodemailer = require('nodemailer');

/**
 * Inicia un navegador headless, abre tu dashboard de React y lo guarda como PDF.
 */
const generatePdfReport = async () => {
  console.log('Iniciando navegador headless...');
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1600, height: 1200, deviceScaleFactor: 1.5 });
    
    // Navegar a la URL del frontend de React (puerto 3000)
    const dashUrl = process.env.FRONTEND_URL || 'http://localhost:3000/?print=true';
    console.log(`Navegando a ${dashUrl}...`);
    await page.goto(dashUrl, { 
      waitUntil: 'networkidle0',
      timeout: 45000
    });

    // Esperar a que se rendericen los componentes y tablas
    try {
      await page.waitForSelector('.recharts-pie', { timeout: 15000 });
    } catch (e) {
      await page.waitForSelector('table', { timeout: 10000 }).catch(() => {});
    }
    
    await new Promise(r => setTimeout(r, 2000));
    console.log('Dashboard cargado. Generando PDF horizontal completo...');

    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: '10px', right: '10px', bottom: '10px', left: '10px' }
    });

    console.log('PDF generado exitosamente.');
    return pdfBuffer;

  } catch (error) {
    console.error('Error durante la generación del PDF:', error.message);
    if (error.message.includes('Waiting for selector') || error.message.includes('waitForSelector')) {
      throw new Error('No se pudo generar el PDF. El caché está vacío o el servidor no responde. Intente \'Actualizar Datos\' primero.');
    }
    throw error; 
  } finally {
    if (browser) {
      console.log('Cerrando navegador...');
      await browser.close();
    }
  }
};

const createTransporter = (settings) => {
  if (!settings || !settings.smtp_host || !settings.smtp_port || !settings.smtp_user) {
    throw new Error("Configuración SMTP incompleta.");
  }
  const isSecure = (settings.smtp_port === 465);
  return nodemailer.createTransport({
    host: settings.smtp_host,
    port: settings.smtp_port,
    secure: isSecure, 
    auth: {
      user: settings.smtp_user,
      pass: settings.smtp_pass,
    },
    ...(isSecure ? {} : { tls: { ciphers: 'SSLv3' } })
  });
};

/**
 * Prueba la conexión SMTP
 */
const testSmtpConnection = async (settings) => {
  const transporter = createTransporter(settings);
  try {
    await transporter.verify();
    console.log("Prueba SMTP exitosa.");
    return { success: true, message: "¡Conexión exitosa!" };
  } catch (error) {
    console.error("Prueba SMTP fallida:", error.message);
    throw new Error(`Error SMTP: ${error.message}`);
  }
};


/**
 * Envía un email usando Nodemailer con la configuración de la DB.
 */
const sendEmailWithAttachment = async (pdfBuffer, settings) => {
  if (!settings.to_email) {
    throw new Error("Configuración SMTP incompleta. Falta destinatario 'Para'.");
  }
  
  const transporter = createTransporter(settings);

  const mailOptions = {
    from: `"Veeam Dashboard" <${settings.from_email || settings.smtp_user}>`,
    to: settings.to_email,
    subject: 'Reporte Diario de Veeam Dashboard',
    text: 'Adjunto se encuentra el reporte en PDF del estado del dashboard de Veeam.',
    html: '<h3>Reporte de Veeam</h3><p>Adjunto se encuentra el reporte en PDF del estado del dashboard de Veeam.</p>',
    attachments: [
      {
        filename: `Veeam_Dashboard_Report_${new Date().toISOString().split('T')[0]}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }
    ]
  };

  await transporter.sendMail(mailOptions);
  console.log(`Email enviado exitosamente a ${settings.to_email}`);
};

module.exports = { generatePdfReport, sendEmailWithAttachment, testSmtpConnection };