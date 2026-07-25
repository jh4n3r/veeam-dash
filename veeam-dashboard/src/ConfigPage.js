// veeam-dashboard/src/ConfigPage.js
import React, { useState, useEffect } from 'react';

// --- (Estilos sin cambios) ---
const configLayoutStyle = {
  padding: '24px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  backgroundColor: '#f8f9fa',
  maxWidth: '900px',
  margin: '0 auto'
};
const cardStyle = {
  padding: '24px',
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.07)',
  border: '1px solid #e9ecef',
  marginBottom: '24px'
};
const h3Style = { 
  margin: '0 0 20px', 
  color: '#2c3e50',
  fontWeight: '600',
  borderBottom: '1px solid #e9ecef',
  paddingBottom: '12px'
};
const formGroupStyle = {
  marginBottom: '16px'
};
const labelStyle = {
  display: 'block',
  fontWeight: '600',
  marginBottom: '8px',
  color: '#495057'
};
const inputStyle = {
  width: '100%',
  padding: '10px 14px',
  fontSize: '14px',
  border: '1px solid #ced4da',
  borderRadius: '6px',
  boxSizing: 'border-box'
};

const buttonStyle = {
  backgroundColor: '#007bff',
  color: 'white',
  border: 'none',
  padding: '12px 24px',
  borderRadius: '6px',
  cursor: 'pointer',
  fontWeight: '600',
  fontSize: '16px',
  transition: 'background-color 0.2s ease',
  marginRight: '12px'
};
const testButtonStyle = {
  ...buttonStyle,
  backgroundColor: '#6c757d',
};
const dayToggleStyle = {
  display: 'inline-block',
  marginRight: '8px',
  marginBottom: '8px',
  padding: '8px 14px',
  borderRadius: '20px',
  cursor: 'pointer',
  border: '1px solid #ced4da',
  userSelect: 'none'
};

const DAYS_OF_WEEK = [
  { label: 'Dom', value: '0' },
  { label: 'Lun', value: '1' },
  { label: 'Mar', value: '2' },
  { label: 'Mié', value: '3' },
  { label: 'Jue', value: '4' },
  { label: 'Vie', value: '5' },
  { label: 'Sáb', value: '6' },
];



// --- FIN DE ESTILOS ---

export default function ConfigPage() {
  // Estado para SMTP y Schedule (se guarda en DB)
  const [settings, setSettings] = useState({
    smtp_host: '',
    smtp_port: 587,
    smtp_user: '',
    smtp_pass: '',
    from_email: '',
    to_email: '',
    refresh_interval_minutes: 5
  });
  const [schedule, setSchedule] = useState({
    send_time: '08:00',
    send_days: []
  });
  
  // --- NUEVO: Estado para Veeam API (se guarda en .env) ---
  const [veeamSettings, setVeeamSettings] = useState({
    VEEAM_USER: '',
    VEEAM_PASS: '',
    VEEAM_SERVER: '',
    VEEAM_WINRM_PORT: '5986',
    VEEAM_PORT: '9419',
    VEEAM_API_VERSION: '1.2-rev1',
    VEEAM_ONE_SERVER: '',
    VEEAM_ONE_PORT: '1239',
    VEEAM_ONE_USER: '',
    VEEAM_ONE_PASS: '',
  });
  const [veeamSaveMessage, setVeeamSaveMessage] = useState('');
  const [veeamSaveStatus, setVeeamSaveStatus] = useState('idle');
  // --- FIN NUEVO ---

  const [saveStatus, setSaveStatus] = useState('idle');
  const [testStatus, setTestStatus] = useState('idle');
  const [testMessage, setTestMessage] = useState('');

  // --- OBTENER URL DEL BACKEND ---
  const backendUrl = `http://${window.location.hostname}:3001`;

  // Cargar datos al montar
  useEffect(() => {
    // Cargar SMTP/Schedule (de DB)
    async function loadEmailData() {
      try {
        const response = await fetch(`${backendUrl}/api/settings`);
        const data = await response.json();
        if (data.settings) {
          setSettings(data.settings);
        }
        if (data.schedule) {
          setSchedule({
            send_time: data.schedule.send_time || '08:00',
            send_days: data.schedule.send_days ? data.schedule.send_days.split(',') : []
          });
        }
      } catch (err) {
        console.error("Error cargando configuración SMTP:", err);
      }
    }
    
    // --- NUEVO: Cargar Veeam API (de .env) ---
    async function loadVeeamData() {
      try {
        const response = await fetch(`${backendUrl}/api/veeam-settings`);
        const data = await response.json();
        if (data) {
          setVeeamSettings(data);
        }
      } catch (err) {
        console.error("Error cargando configuración Veeam:", err);
      }
    }
    // --- FIN NUEVO ---

    loadEmailData();
    loadVeeamData(); // <-- Cargar también
  }, [backendUrl]); 

  // Manejador para campos de settings (SMTP/Schedule)
  const handleSettingChange = (e) => {
    const { name, value, type } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value, 10) : value
    }));
  };
  
  // --- NUEVO: Manejador para campos de Veeam API ---
  const handleVeeamSettingChange = (e) => {
    const { name, value } = e.target;
    setVeeamSettings(prev => ({
      ...prev,
      [name]: value
    }));
  };
  // --- FIN NUEVO ---

  // Manejador para la hora
  const handleTimeChange = (e) => {
    setSchedule(prev => ({ ...prev, send_time: e.target.value }));
  };

  // Manejador para los días de la semana
  const handleDayToggle = (dayValue) => {
    setSchedule(prev => {
      const newDays = prev.send_days.includes(dayValue)
        ? prev.send_days.filter(d => d !== dayValue)
        : [...prev.send_days, dayValue];
      return { ...prev, send_days: newDays };
    });
  };

  // Probar SMTP
  const handleTestSmtp = async () => {
    setTestStatus('loading');
    setTestMessage('Probando...');
    try {
      const response = await fetch(`${backendUrl}/api/test-smtp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: settings })
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Error desconocido');
      }

      setTestStatus('success');
      setTestMessage('¡Conexión exitosa!');
      
    } catch (err) {
      setTestStatus('error');
      setTestMessage(err.message);
    } finally {
      setTimeout(() => {
        setTestStatus('idle');
        setTestMessage('');
      }, 3000);
    }
  };

  // Manejador para guardar (MODIFICADO)
  // Ahora guarda AMBAS configuraciones
  const handleSave = async () => {
    setSaveStatus('loading');
    setVeeamSaveStatus('loading');
    setVeeamSaveMessage('');

    // 1. Guardar SMTP/Schedule en DB
    const emailPayload = {
      settings: settings,
      schedule: {
        ...schedule,
        send_days: schedule.send_days.join(',')
      }
    };
    
    // 2. Guardar Veeam API en .env
    const veeamPayload = {
      settings: veeamSettings
    };

    try {
      // Lanzar ambas peticiones en paralelo
      const [emailResponse, veeamResponse] = await Promise.all([
        fetch(`${backendUrl}/api/settings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(emailPayload)
        }),
        fetch(`${backendUrl}/api/veeam-settings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(veeamPayload)
        })
      ]);

      // Revisar respuesta de Email/Schedule
      if (!emailResponse.ok) {
        throw new Error('Error al guardar configuración de Email/Schedule');
      }
      setSaveStatus('success');
      
      // Revisar respuesta de Veeam API
      const veeamData = await veeamResponse.json();
      if (!veeamResponse.ok) {
        setVeeamSaveStatus('error');
        setVeeamSaveMessage(veeamData.error || 'Error al guardar Veeam API');
      } else {
        setVeeamSaveStatus('success');
        setVeeamSaveMessage(veeamData.message); // <-- "¡Guardado! Debes reiniciar..."
      }

    } catch (err) {
      setSaveStatus('error');
      setVeeamSaveStatus('error');
      setVeeamSaveMessage(err.message);
    } finally {
      setTimeout(() => setSaveStatus('idle'), 2000);
      // No limpiar el mensaje de veeamSaveMessage para que el usuario lea
    }
  };
  // --- FIN MODIFICACIÓN ---

  const getSaveButtonText = () => {
    if (saveStatus === 'loading') return 'Guardando...';
    if (saveStatus === 'success' && veeamSaveStatus !== 'error') return '¡Guardado!';
    if (saveStatus === 'error' || veeamSaveStatus === 'error') return 'Error. Reintentar';
    return 'Guardar Configuración';
  };
  
  // --- NUEVO: Estilo para el mensaje de reinicio ---
  const restartMessageStyle = {
    padding: '12px',
    borderRadius: '6px',
    marginTop: '16px',
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: veeamSaveStatus === 'success' ? '#fff3cd' : '#f8d7da',
    color: veeamSaveStatus === 'success' ? '#856404' : '#721c24',
    border: `1px solid ${veeamSaveStatus === 'success' ? '#ffeeba' : '#f5c6cb'}`
  };
  // --- FIN NUEVO ---

  return (
    <div style={configLayoutStyle}>
    
      {/* --- SECCIÓN: CONEXIÓN WINRM A VEEAM --- */}
      <div style={cardStyle}>
        <h3 style={h3Style}>Conexión WinRM a Servidor Veeam</h3>
        <p style={{ fontSize: '13px', color: '#6c757d', marginTop: '-12px', marginBottom: '20px' }}>
          Configura las credenciales de Windows y puerto WinRM (HTTPS) del servidor Veeam para extraer la telemetría.
        </p>
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
          <div style={formGroupStyle}>
            <label style={labelStyle}>Servidor Veeam (IP o Hostname)</label>
            <input type="text" name="VEEAM_SERVER" value={veeamSettings.VEEAM_SERVER} onChange={handleVeeamSettingChange} style={inputStyle} />
          </div>
          <div style={formGroupStyle}>
            <label style={labelStyle}>Puerto WinRM (ej: 5986)</label>
            <input type="text" name="VEEAM_WINRM_PORT" value={veeamSettings.VEEAM_WINRM_PORT} onChange={handleVeeamSettingChange} style={inputStyle} />
          </div>
          <div style={formGroupStyle}>
            <label style={labelStyle}>Usuario WinRM (ej: DOMINIO\Usuario o Administrador)</label>
            <input type="text" name="VEEAM_USER" value={veeamSettings.VEEAM_USER} onChange={handleVeeamSettingChange} style={inputStyle} />
          </div>
          <div style={formGroupStyle}>
            <label style={labelStyle}>Contraseña WinRM</label>
            <input type="password" name="VEEAM_PASS" value={veeamSettings.VEEAM_PASS} onChange={handleVeeamSettingChange} style={inputStyle} />
          </div>
        </div>
        
        {/* --- Mensaje de Guardado/Error de Veeam --- */}
        {veeamSaveMessage && (
          <div style={restartMessageStyle}>
            {veeamSaveMessage}
          </div>
        )}
      </div>
      {/* --- FIN NUEVA SECCIÓN --- */}
    
      <div style={cardStyle}>
        <h3 style={h3Style}>Configuración de Reportes por Email</h3>
        
        <h4 style={{...h3Style, fontSize: '16px', border: 'none'}}>Servidor SMTP (O365)</h4>
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
          <div style={formGroupStyle}>
            <label style={labelStyle}>Host SMTP (ej: smtp.office365.com)</label>
            <input type="text" name="smtp_host" value={settings.smtp_host} onChange={handleSettingChange} style={inputStyle} />
          </div>
          <div style={formGroupStyle}>
            <label style={labelStyle}>Puerto (ej: 587)</label>
            <input type="number" name="smtp_port" value={settings.smtp_port} onChange={handleSettingChange} style={inputStyle} />
          </div>
        </div>
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
          <div style={formGroupStyle}>
            <label style={labelStyle}>Usuario (Email)</label>
            <input type="email" name="smtp_user" value={settings.smtp_user} onChange={handleSettingChange} style={inputStyle} />
          </div>
          <div style={formGroupStyle}>
            <label style={labelStyle}>Contraseña (o Contraseña de App)</label>
            <input type="password" name="smtp_pass" value={settings.smtp_pass} onChange={handleSettingChange} style={inputStyle} />
          </div>
        </div>

        <h4 style={{...h3Style, fontSize: '16px', border: 'none', marginTop: '16px'}}>Configuración de Email</h4>
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
          <div style={formGroupStyle}>
            <label style={labelStyle}>Email "De" (ej: veeam@nexo.com)</label>
            <input type="email" name="from_email" value={settings.from_email} onChange={handleSettingChange} style={inputStyle} />
          </div>
          <div style={formGroupStyle}>
            <label style={labelStyle}>Email "Para" (separar con comas)</label>
            <input type="text" name="to_email" value={settings.to_email} onChange={handleSettingChange} style={inputStyle} />
          </div>
        </div>
        
        <div style={{marginTop: '12px'}}>
          <button 
            onClick={handleTestSmtp}
            style={{
              ...testButtonStyle,
              backgroundColor: testStatus === 'success' ? '#28a745' : (testStatus === 'error' ? '#dc3545' : '#6c757d')
            }}
            disabled={testStatus === 'loading'}
          >
            {testStatus === 'idle' ? 'Probar Conexión SMTP' : testMessage}
          </button>
        </div>
      </div>

      <div style={cardStyle}>
        <h3 style={h3Style}>Programación Automática</h3>
        
        <div style={{...formGroupStyle, maxWidth: '300px'}}>
            <label style={labelStyle}>Intervalo de Actualización de Datos (minutos)</label>
            <input 
              type="number" 
              name="refresh_interval_minutes" 
              value={settings.refresh_interval_minutes} 
              onChange={handleSettingChange} 
              style={inputStyle} 
            />
        </div>

        <h4 style={{...h3Style, fontSize: '16px', border: 'none', marginTop: '16px'}}>Envío de Reporte por Email</h4>
        <div style={{display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '16px', alignItems: 'center'}}>
          <div style={formGroupStyle}>
            <label style={labelStyle}>Hora de envío (24hs)</label>
            <input type="time" name="send_time" value={schedule.send_time} onChange={handleTimeChange} style={inputStyle} />
          </div>
          <div style={formGroupStyle}>
            <label style={labelStyle}>Días de envío</label>
            <div>
              {DAYS_OF_WEEK.map(day => {
                const isSelected = schedule.send_days.includes(day.value);
                return (
                  <span
                    key={day.value}
                    onClick={() => handleDayToggle(day.value)}
                    style={{
                      ...dayToggleStyle,
                      backgroundColor: isSelected ? '#007bff' : '#f8f9fa',
                      color: isSelected ? 'white' : 'black',
                      borderColor: isSelected ? '#007bff' : '#ced4da'
                    }}
                  >
                    {day.label}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      
      <div style={{textAlign: 'right'}}>
        <button 
          onClick={handleSave} 
          style={{...buttonStyle, backgroundColor: saveStatus === 'success' ? '#28a745' : '#007bff'}}
          disabled={saveStatus === 'loading' || veeamSaveStatus === 'loading'}
        >
          {getSaveButtonText()}
        </button>
      </div>
    </div>
  );
}