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
    
    console.log('Navegando a http://localhost:3000...');
    // Corregido: Esperar a que el HTML cargue
    await page.goto('http://localhost:3000/', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Esperar a que el gráfico (y los datos del caché) se rendericen
    await page.waitForSelector('.recharts-pie', { timeout: 15000 });
    console.log('Dashboard cargado. Generando PDF...');

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
    });

    console.log('PDF generado en memoria.');
    return pdfBuffer;

  } catch (error) {
    console.error('Error durante la generación del PDF:', error.message);
    // Si falla el selector, es porque el caché está vacío.
    if (error.message.includes("Waiting for selector")) {
        throw new Error("No se pudo generar el PDF. El caché de datos está vacío. Intente una 'Actualización Manual' primero.");
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