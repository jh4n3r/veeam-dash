// veeam-dashboard/src/DashboardPage.js
import React, { useState, useEffect, useCallback } from 'react';
import { PieChart, Pie, Cell, Legend } from 'recharts';

// --- ESTILOS GLOBALES (Sin cambios) ---
const layoutStyle = {
  padding: '24px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  backgroundColor: '#f8f9fa' 
};
const dualGridStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '24px',
  marginTop: '24px'
};
const cardStyle = {
  padding: '24px',
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.07)',
  border: '1px solid #e9ecef'
};
const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: '14px', marginTop: '8px' };
const headerStyle = { backgroundColor: '#f1f3f5', textAlign: 'left', padding: '8px' };
const cellStyle = { padding: '8px', borderBottom: '1px solid #eee' };
const noDataStyle = { color: '#666', fontStyle: 'italic' };
const h3Style = { 
  margin: '0 0 16px', 
  color: '#2c3e50',
  fontWeight: '600',
  borderBottom: '1px solid #e9ecef',
  paddingBottom: '12px'
};
// --- FIN DE LAS DEFINICIONES DE ESTILO ---

// ==================================================================
// --- COMPONENTE 0: ProgressBar (Sin cambios) ---
// ==================================================================
const ProgressBar = ({ isVisible }) => (
  <>
    <style>
      {`
        @keyframes moveGradient {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .progress-bar-container {
          height: 4px;
          width: 100%;
          background-color: #e9ecef;
          border-radius: 4px;
          overflow: hidden;
          opacity: 0;
          transition: opacity 0.3s ease;
          position: fixed;
          top: 86px; 
          left: 0;
          z-index: 9999;
        }
        .progress-bar-container.visible {
          opacity: 1;
        }
        .progress-bar-inner {
          height: 100%;
          width: 100%;
          background: linear-gradient(
            90deg, 
            #004cffff, 
            #6a168eff, 
            #08325fff
          );
          background-size: 50% 100%;
          animation: moveGradient 1.5s linear infinite;
        }
      `}
    </style>
    <div className={`progress-bar-container ${isVisible ? 'visible' : ''} no-print`}>
      <div className="progress-bar-inner"></div>
    </div>
  </>
);


// ==================================================================
// --- COMPONENTE 1: DateFilter (Sin cambios) ---
// ==================================================================
const DateFilter = ({ onFilterChange }) => {
  const handleChange = (e) => {
    const value = e.target.value;
    let startDate = null;

    if (value === '24h') {
      startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    } else if (value === '7d') {
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    } else if (value === '30d') {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    } else {
      startDate = null; // Todos
    }
    onFilterChange(startDate);
  };

  return (
    <div style={{ 
      marginBottom: '16px', 
      textAlign: 'right', 
      marginLeft: '16px'
    }} className="no-print">
      <label style={{ marginRight: '8px', fontWeight: '600' }}>
        Filtrar por:
      </label>
      <select onChange={handleChange} defaultValue="24h" style={{
        padding: '10px 14px',
        borderRadius: '6px',
        border: '1px solid #ccc',
        fontSize: '14px',
        backgroundColor: '#fff'
      }}>
        <option value="24h">Últimas 24 horas</option>
        <option value="7d">Últimos 7 días</option>
        <option value="30d">Últimos 30 días</option>
        <option value="all">Todos</option>
      </select>
    </div>
  );
};

// ==================================================================
// --- COMPONENTES 2-9 (LastResultGrid, JobsTable, JobStatusPie, etc... SIN CAMBIOS) ---
// ==================================================================
const LastResultGrid = ({ jobs }) => {
  const lastResults = {};
  
  if (jobs && Array.isArray(jobs)) {
    jobs.forEach(job => {
      const jobTime = job.creationTime ? new Date(job.creationTime) : null;
      if (!jobTime && (!job.result || job.result.result === 'Unknown')) {
        return;
      }
      const existing = lastResults[job.name];
      const existingTime = existing ? (existing.creationTime ? new Date(existing.creationTime) : null) : null;

      if (!existing) {
        lastResults[job.name] = job;
        return;
      }
      
      if (jobTime && (!existingTime || jobTime > existingTime)) {
         lastResults[job.name] = job;
      } else if (!jobTime && !existingTime) {
         if (job.result?.result !== 'Unknown') {
            lastResults[job.name] = job;
         }
      }
    });
  }

  const results = Object.values(lastResults);

  return (
    <div style={{ marginTop: '0' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: '12px'
      }}>
        {results.map((job, i) => {
          const status = job.result?.result || 'Unknown';
          const bgColor = {
            Success: '#28a745',
            Warning: '#ffc107',
            Failed: '#dc3545',
            None: '#6c757d',
          }[status] || '#6c757d';

          return (
            <div key={job.name || i} style={{
              backgroundColor: bgColor,
              color: 'white',
              padding: '16px',
              borderRadius: '6px',
              textAlign: 'center',
              fontWeight: 'bold',
              fontSize: '18px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>
                {status}
              </div>
              <div style={{ fontSize: '13px', opacity: 0.9, wordBreak: 'break-word' }}>
                {job.name}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const JobsTable = ({ jobs }) => {
  if (!jobs || jobs.length === 0) {
    return <p style={noDataStyle}>No hay jobs en el rango seleccionado.</p>;
  }

  const thStyle = { padding: '12px 8px', fontWeight: '600', color: '#333' };
  const tdStyle = { padding: '10px 8px', color: '#444' };

  const formatDate = (date) => {
    return new Date(date).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (ms) => {
    if (!ms || ms < 0) return '—';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '—';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  return (
    <div className="jobs-table-container" style={{ overflowX: 'auto', marginTop: '16px' }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '14px',
        backgroundColor: '#fff'
      }}>
        <thead>
          <tr style={{ backgroundColor: '#f8f9fa', textAlign: 'left' }}>
            <th style={thStyle}>Job</th>
            <th style={thStyle}>Tipo</th>
            <th style={thStyle}>Estado</th>
            <th style={thStyle}>Inicio</th>
            <th style={thStyle}>Fin</th>
            <th style={thStyle}>Duración</th>
            <th style={thStyle}>Datos</th>
            <th style={thStyle}>Resultado</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job, i) => {
            const start = job.creationTime;
            const end = job.endTime;
            const duration = (start && end && !job.isFromOneDb) 
              ? formatDuration(new Date(end) - new Date(start)) 
              : '—';
            
            const status = job.result?.result || 'Unknown';
            const color = {
              Success: '#28a745',
              Warning: '#ffc107',
              Failed: '#dc3545',
              None: '#6c757d'
            }[status] || '#6c757d';

            return (
              <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                <td style={tdStyle}><strong>{job.name}</strong></td>
                <td style={tdStyle}>{job.sessionType || '—'}</td>
                <td style={tdStyle}>
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    backgroundColor: color + '20',
                    color: color,
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    {status}
                  </span>
                </td>
                <td style={tdStyle}>{start ? formatDate(start) : '—'}</td>
                <td style={tdStyle}>{(end && !job.isFromOneDb) ? formatDate(end) : '—'}</td>
                <td style={tdStyle}>{duration}</td>
                <td style={tdStyle}>{formatBytes(job.statistics?.processedSize)}</td>
                <td style={tdStyle}>{job.result?.resultDetails || '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const JobStatusPie = ({ jobs }) => {
  if (!jobs || jobs.length === 0) {
    return <p style={noDataStyle}>No hay datos para el gráfico.</p>;
  }

  const success = jobs.filter(j => j.result?.result === 'Success').length;
  const warning = jobs.filter(j => j.result?.result === 'Warning').length;
  const failed = jobs.filter(j => j.result?.result === 'Failed').length;
  const total = success + warning + failed;

  const data = [
    { name: 'Success', value: success },
    { name: 'Warning', value: warning },
    { name: 'Failed', value: failed },
  ];
  const COLORS = ['#28a745', '#ffc107', '#dc3545'];

  const centerLabelStyle = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    textAlign: 'center',
    lineHeight: '1.2',
  };
  const totalCountStyle = {
    fontSize: '36px',
    fontWeight: '600',
    color: '#2c3e50'
  };
  const totalTextStyle = {
    fontSize: '14px',
    color: '#6c757d',
    marginTop: '4px'
  };

  return (
    <div style={{ 
      width: '100%', 
      height: 300, 
      display: 'flex', 
      justifyContent: 'center',
      position: 'relative'
    }}>
      
      <div style={centerLabelStyle}>
        <div style={totalCountStyle}>{total}</div>
        <div style={totalTextStyle}>Total Jobs</div>
      </div>

      <PieChart width={300} height={300}>
        <Pie 
          data={data} 
          dataKey="value" 
          nameKey="name" 
          outerRadius={90}
          innerRadius={65} // Donut
          fill="#8884d8" 
          label
          paddingAngle={3}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Legend />
      </PieChart>
    </div>
  );
};

const ReposUsageBars = ({ repositories = [] }) => {
  if (!repositories.length) {
    return <p style={noDataStyle}>No hay repositorios.</p>;
  }
  const getColor = (p) => {
    const percent = Number(p) || 0;
    return percent > 90 ? '#dc3545' : percent > 75 ? '#ffc107' : '#28a745';
  };
  return (
    <div>
      {repositories.map(r => {
        const percent = Number(r.percent) || 0;
        return (
          <div key={r.id} style={{ marginBottom: '12px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '14px',
              marginBottom: '4px',
              fontWeight: '500'
            }}>
              <span>{r.name}</span>
              <span>{percent.toFixed(1)}%</span>
            </div>
            <div style={{
              height: '20px',
              backgroundColor: '#e9ecef',
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${Math.min(percent, 100)}%`,
                height: '100%',
                backgroundColor: getColor(percent),
                transition: 'width 0.3s ease'
              }}></div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const RestorePointsGrid = ({ backupObjects = [] }) => {
  const withPoints = backupObjects
    .filter(obj => (obj.restorePointsCount || 0) > 0)
    .sort((a, b) => (b.restorePointsCount || 0) - (a.restorePointsCount || 0));

  if (!withPoints.length) {
    return <p style={noDataStyle}>No hay puntos de restauración.</p>;
  }
  return (
    <div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
        gap: '12px',
        marginTop: '8px'
      }}>
        {withPoints.map(obj => (
          <div key={obj.id} style={{
            backgroundColor: '#28a745',
            color: 'white',
            padding: '14px',
            borderRadius: '6px',
            textAlign: 'center',
            fontWeight: 'bold',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '24px' }}>{obj.restorePointsCount}</div>
            <div style={{ fontSize: '11px', opacity: 0.9, wordBreak: 'break-word' }}>
              {obj.name}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ServersTable = ({ servers = [] }) => {
  if (!servers.length) {
    return <p style={noDataStyle}>No hay servidores gestionados.</p>;
  }
  return (
    <div>
      <table style={tableStyle}>
        <thead>
          <tr style={headerStyle}>
            <th style={cellStyle}>Nombre</th>
            <th style={cellStyle}>Tipo</th>
            <th style={cellStyle}>Descripción</th>
          </tr>
        </thead>
        <tbody>
          {servers.map(s => (
            <tr key={s.id}>
              <td style={cellStyle}><strong>{s.name}</strong></td>
              <td style={cellStyle}>{s.type || '—'}</td>
              <td style={cellStyle}>{s.description || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const ProxiesTable = ({ proxies = [] }) => {
  if (!proxies.length) {
    return <p style={noDataStyle}>No hay proxies.</p>;
  }

  return (
    <div>
      <table style={tableStyle}>
        <thead>
          <tr style={headerStyle}>
            <th style={cellStyle}>Nombre</th>
            <th style={cellStyle}>Descripción</th>
            <th style={cellStyle}>Modo</th>
            <th style={cellStyle}>Tareas Concurrentes</th>
          </tr>
        </thead>
        <tbody>
          {proxies.map(p => (
            <tr key={p.id}>
              <td style={cellStyle}><strong>{p.name}</strong></td>
              <td style={cellStyle}>{p.description || '—'}</td>
              <td style={cellStyle}>{p.transportMode || '—'}</td>
              <td style={cellStyle}>{p.maxTaskCount || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const PrintHeader = () => (
  <div className="print-header">
    <h1 style={{ 
      color: '#000', 
      fontFamily: 'Arial, sans-serif', 
      fontSize: '20pt',
      fontWeight: '600',
      textAlign: 'center'
    }}>
      Nexo - Veeam Backup and replications - Historial de Jobs
    </h1>
  </div>
);

const PrintStyles = () => (
  <style>
    {`
      @page {
        size: A4 portrait;
        margin: 15mm !important; 
        
        @top-left { content: none !important; }
        @top-center { content: none !important; }
        @top-right { content: none !important; }
        @bottom-left { content: none !important; }
        @bottom-center { content: none !important; }
        @bottom-right { content: none !important; }
      }

      .print-header {
        display: none;
      }
      
      .pdf-button {
        background-color: #007bff;
        color: white;
        border: none;
        padding: 10px 18px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 600;
        font-size: 14px;
        marginRight: '16px';
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        transition: background-color 0.2s ease, transform 0.2s ease;
      }
      
      .pdf-button:hover {
        background-color: #0056b3;
        transform: translateY(-1px);
      }
      
      .pdf-button:disabled {
        background-color: #6c757d;
        cursor: not-allowed;
      }
      
      .manual-send-button {
        background-color: #28a745; /* Verde */
        color: white;
        border: none;
        padding: 10px 18px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 600;
        font-size: 14px;
        boxShadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        transition: background-color 0.2s ease, transform 0.2s ease;
      }
      .manual-send-button:hover {
        background-color: #218838;
        transform: translateY(-1px);
      }
      .manual-send-button:disabled {
        background-color: #6c757d;
        cursor: not-allowed;
      }
      
      .refresh-button {
        background-color: #17a2b8; /* Cyan */
        color: white;
        border: none;
        padding: 10px 18px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 600;
        font-size: 14px;
        boxShadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        transition: background-color 0.2s ease, transform 0.2s ease;
      }
      .refresh-button:hover {
        background-color: #117a8b;
        transform: translateY(-1px);
      }
      .refresh-button:disabled {
        background-color: #6c757d;
        cursor: not-allowed;
      }
      
      /* --- INICIO: MEJORAS AL PDF --- */
      @media print {
        header, footer {
          display: none !important;
        }
        .print-header {
          display: block !important;
          text-align: center;
          margin-bottom: 20px;
        }
        header.app-header, .no-print {
          display: none !important;
        }
        
        body, div[style*="padding: 24px"] {
          background-color: #ffffff !important;
          padding: 0 !important;
          margin: 0 !important;
          font-family: Arial, sans-serif !important;
          font-size: 10pt;
          -webkit-print-color-adjust: exact;
          color-adjust: exact;
        }
        
        div[style*="box-shadow"] {
          box-shadow: none !important;
          border: 1px solid #eeeeee !important;
          page-break-inside: avoid !important;
          margin-top: 16px !important;
        }
        
        /* Apilar en 1 columna en PDF */
        div[style*="gridTemplateColumns: '1fr 1fr'"] {
          grid-template-columns: 1fr !important;
        }

        /* Ajustar grids de cajas */
        div[style*="gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))'"] {
          grid-template-columns: repeat(4, 1fr) !important;
          gap: 8px !important;
        }
        div[style*="gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))'"] {
          grid-template-columns: repeat(5, 1fr) !important;
          gap: 8px !important;
        }

        .jobs-table-container {
          page-break-inside: auto;
          overflow-x: visible !important;
        }
        thead {
          display: table-header-group;
        }
        tr, td, th {
          page-break-inside: avoid !important;
          padding: 6px 8px !important;
        }
        table {
          font-size: 9pt !important;
        }
        
        * {
          color: #000000 !important;
          box-shadow: none !important;
          -webkit-print-color-adjust: exact;
          color-adjust: exact;
        }
        div[style*="backgroundColor: rgb(40, 167, 69)"],
        div[style*="backgroundColor: rgb(255, 193, 7)"],
        div[style*="backgroundColor: rgb(220, 53, 69)"],
        div[style*="backgroundColor: rgb(108, 117, 125)"] {
          -webkit-print-color-adjust: exact;
          color-adjust: exact;
        }
        div[style*="backgroundColor: rgb(233, 236, 239)"] > div {
           -webkit-print-color-adjust: exact;
           color-adjust: exact;
        }
        .recharts-pie-sector path {
          -webkit-print-color-adjust: exact;
          color-adjust: exact;
        }
      }
      /* --- FIN: MEJORAS AL PDF --- */
    `}
  </style>
);
// ==================================================================
// --- COMPONENTE 11: ManualSendButton (Sin cambios) ---
// ==================================================================
const ManualSendButton = ({ isSending, setIsSending }) => {
  const [message, setMessage] = useState('Enviar Reporte Manual');
  const backendUrl = `http://${window.location.hostname}:3001`; // URL dinámica

  const handleClick = async () => {
    setIsSending(true);
    setMessage('Enviando...');
    try {
      const response = await fetch(`${backendUrl}/api/send-report`, {
        method: 'POST',
      });
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error en el backend');
      }
      setMessage('¡Enviado!');
    } catch (err) {
      console.error(err);
      setMessage(err.message.length > 50 ? 'Error (ver consola)' : err.message);
    } finally {
      setTimeout(() => {
        setIsSending(false);
        setMessage('Enviar Reporte Manual');
      }, 3000);
    }
  };

  const getButtonColor = () => {
    if (message === 'Enviando...') return '#6c757d';
    if (message === '¡Enviado!') return '#28a745';
    if (message.includes('Error')) return '#dc3545';
    return '#28a745';
  };

  return (
    <button
      onClick={handleClick}
      disabled={isSending}
      className="manual-send-button no-print"
      style={{ backgroundColor: getButtonColor() }}
    >
      {message}
    </button>
  );
};

// ==================================================================
// --- COMPONENTE 12: RefreshButton (MODIFICADO/SIMPLIFICADO) ---
// ==================================================================
const RefreshButton = ({ onRefresh, isLoading }) => {
  return (
    <button
      onClick={onRefresh} // <-- Llama directamente a la prop
      disabled={isLoading}
      className="refresh-button no-print"
    >
      {isLoading ? 'Actualizando...' : 'Actualizar Datos'}
    </button>
  );
};


// ==================================================================
// --- COMPONENTE PRINCIPAL: DashboardPage (MODIFICADO) ---
// ==================================================================
export default function DashboardPage() {
  const [allData, setAllData] = useState({
    sessions: [],
    repositories: [],
    proxies: [],
    managedServers: [],
    backupObjects: [],
    lastCacheRefresh: null, 
  });
  const [filteredJobs, setFilteredJobs] = useState([]);
  
  const [isLoadingData, setIsLoadingData] = useState(true); 
  const [isSendingMail, setIsSendingMail] = useState(false); 

  const [pageError, setPageError] = useState(null); 
  
  // URL del Backend
  const backendUrl = `http://${window.location.hostname}:3001`;

  // --- 1. Función para filtrar (Sin cambios) ---
  const handleFilterChange = useCallback((startDate) => {
    const sortedSessions = [...(allData.sessions || [])].sort((a, b) => new Date(b.creationTime) - new Date(a.creationTime));

    if (!startDate) {
      setFilteredJobs(sortedSessions);
    } else {
      const filtered = sortedSessions.filter(session => {
        if (!session.creationTime) return false;
        if (session.isFromOneDb) {
          return true;
        }
        return new Date(session.creationTime) >= startDate;
      });
      setFilteredJobs(filtered);
    }
  }, [allData.sessions]); 

  // --- 2. Cargar datos del CACHÉ (GET /api/summary) ---
  // Esta función AHORA solo carga lo que está en la DB del backend.
  const loadDataFromCache = useCallback(async () => {
    // Solo mostrar "Cargando..." si la pantalla está vacía
    if (allData.sessions.length === 0) {
      setIsLoadingData(true);
    }
    
    try {
      const cacheBuster = `?_=${new Date().getTime()}`;
      const response = await fetch(`${backendUrl}/api/summary${cacheBuster}`);
      
      if (!response.ok) {
        let errorMsg = 'No se pudo cargar los datos del caché del backend';
        try {
          const errData = await response.json();
          errorMsg = errData.error || `Error ${response.status}`;
        } catch (e) { /* ... */ }
        throw new Error(errorMsg);
      }
      
      const data = await response.json();
      
      setAllData({
        sessions: data.sessions || [],
        repositories: data.repositories || [],
        proxies: data.proxies || [],
        managedServers: data.managedServers || [],
        backupObjects: data.backupObjects || [],
        serverInfo: data.serverInfo || {},
        lastCacheRefresh: data.lastCacheRefresh || null 
      });
      
      // Si la carga fue exitosa, limpiar errores
      setPageError(null); 
      
    } catch (err) {
      setPageError(err.message);
      // *** IMPORTANTE: No limpiar 'allData' si falla ***
      // Esto preserva los datos viejos en pantalla.
    } finally {
      setIsLoadingData(false);
    }
  }, [backendUrl, allData.sessions.length]); // Dependencia


  // --- 3. NUEVA FUNCIÓN: Refresco Manual (POST /api/refresh-cache) ---
  // Esta es la lógica que correrá el botón "Actualizar Datos"
  const handleManualRefresh = async () => {
    setIsLoadingData(true);
    setPageError(null); // Limpiar error al reintentar
    
    try {
      const response = await fetch(`${backendUrl}/api/refresh-cache`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Falló la actualización del caché');
      }
      
      // Si el POST (actualización) tuvo éxito, cargar los nuevos datos
      await loadDataFromCache();
      
    } catch (err) {
      console.error("Error en Refresco Manual:", err);
      setPageError(err.message);
      // No llamar a loadDataFromCache(), mantener datos viejos
    } finally {
      setIsLoadingData(false);
    }
  };


  // --- 4. Carga inicial (SOLO al montar) ---
  useEffect(() => {
    loadDataFromCache(); // Carga inicial
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // <-- Se ejecuta solo UNA VEZ al cargar la página

  
  // --- 5. Refresco Automático (MODIFICADO) ---
  useEffect(() => {
    let intervalId = null;
    
    const setupAutoRefresh = async () => {
      try {
        const response = await fetch(`${backendUrl}/api/settings`);
        const data = await response.json();
        const intervalMinutes = data.settings?.refresh_interval_minutes || 5;
        
        intervalId = setInterval(async () => {
          console.log(`[AutoRefresh] Actualizando datos (cada ${intervalMinutes} min)`);
          
          if (isLoadingData) {
            console.log("[AutoRefresh] Omitido: Ya hay un refresco manual en curso.");
            return;
          }
          
          // Lógica de refresco robusta
          try {
            const refreshResponse = await fetch(`${backendUrl}/api/refresh-cache`, {
              method: 'POST',
            });
            if (!refreshResponse.ok) {
               const errData = await refreshResponse.json();
               throw new Error(errData.error);
            }
            // Si el POST tuvo éxito, cargar los nuevos datos
            await loadDataFromCache();
          } catch (err) {
            console.error("[AutoRefresh] Falló: ", err.message);
            setPageError(`Fallo de Auto-Refresh: ${err.message}`);
            // No llamar a loadDataFromCache(), mantener datos viejos
          }
          // --- Fin lógica ---
          
        }, intervalMinutes * 60000);
        
      } catch (err) {
        console.error("No se pudo configurar el refresco automático:", err);
      }
    };
    
    setupAutoRefresh();

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [loadDataFromCache, backendUrl, isLoadingData]); // Dependencias


  // --- 6. Aplicar el filtro inicial (Sin cambios) ---
  useEffect(() => {
    if ((allData.sessions || []).length > 0) {
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      handleFilterChange(startDate);
    }
  }, [allData.sessions, handleFilterChange]); 

  // --- 7. Renderizar ---
  const isBusy = isLoadingData || isSendingMail;

  const formatLastRefresh = (isoDate) => {
    if (!isoDate) return 'Nunca';
    return new Date(isoDate).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };
  const lastRefreshTimestamp = formatLastRefresh(allData.lastCacheRefresh);
  
  // --- Banner de Error ---
  const ErrorBanner = ({ message, onClose }) => (
    <div style={{
      backgroundColor: '#dc3545',
      color: 'white',
      padding: '16px 24px',
      margin: '0 24px 24px 24px',
      borderRadius: '8px',
      fontWeight: '600',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }} className="no-print">
      <span>Error: {message}</span>
      <span onClick={onClose} style={{cursor: 'pointer', fontSize: '20px', marginLeft: '16px'}}>&times;</span>
    </div>
  );

  // --- Estado de Carga Inicial (Solo si la DB está vacía) ---
  if (isLoadingData && allData.sessions.length === 0 && !pageError) {
    return (
      <div style={layoutStyle}>
        <ProgressBar isVisible={true} />
        <h2>Cargando datos de Veeam...</h2>
      </div>
    );
  }
  
  // --- Estado de Error Inicial (No hay NADA en caché) ---
  if (pageError && allData.sessions.length === 0) {
    return (
      <div style={layoutStyle}>
         <ProgressBar isVisible={isBusy} />
         <header 
            className="app-header no-print" 
            style={{ 
              display: 'flex', 
              justifyContent: 'flex-end',
              alignItems: 'center',
              paddingBottom: '16px',
              marginBottom: '24px',
              padding: '0 24px' 
            }}
          >
           <div style={{display: 'flex', alignItems: 'center'}}>
              <div style={{marginRight: '16px'}}>
                 {/* MODIFICADO: onRefresh ahora es handleManualRefresh */}
                <RefreshButton onRefresh={handleManualRefresh} isLoading={isLoadingData} />
              </div>
           </div>
         </header>
         <div style={{...cardStyle, margin: '0 24px'}}>
           <h2 style={{color: 'red'}}>Error: {pageError}</h2> 
           <p>Asegúrate de que el servidor backend (`node index.js`) esté corriendo y que Veeam API sea accesible.</p>
           <p>Los datos en caché no están disponibles.</p>
         </div>
       </div>
    );
  }

  // --- Renderizado Normal (Hay datos en caché) ---
  return (
    <div style={layoutStyle}>
      <PrintHeader /> 
      <PrintStyles /> 
      
      <ProgressBar isVisible={isBusy} />

      <header 
        className="app-header no-print" 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          paddingBottom: '16px',
          marginBottom: '24px',
          // --- AÑADE ESTA LÍNEA ---
          marginTop: '24px' 
          // --- FIN DE LA LÍNEA ---
        }}
      >
        <div style={{
          color: '#6c757d',
          fontSize: '14px',
          fontWeight: '600',
        }}>
          Última actualización: {lastRefreshTimestamp}
        </div>

        <div style={{display: 'flex', alignItems: 'center'}}>
          
          <div style={{marginRight: '16px'}}>
            {/* MODIFICADO: onRefresh ahora es handleManualRefresh */}
            <RefreshButton onRefresh={handleManualRefresh} isLoading={isLoadingData} />
          </div>

          <button
            onClick={() => window.print()}
            className="pdf-button no-print"
            disabled={isBusy}
          >
            Generar PDF
          </button>
          
          <div style={{marginLeft: '16px'}}>
            <ManualSendButton isSending={isSendingMail} setIsSending={setIsSendingMail} />
          </div>

          <DateFilter onFilterChange={handleFilterChange} />
        </div>
      </header>
      
      {/* --- Banner de Error (Hay datos pero el refresco falló) --- */}
      {pageError && allData.sessions.length > 0 && (
        <ErrorBanner message={`${pageError}. Mostrando últimos datos cacheados.`} onClose={() => setPageError(null)} />
      )}

      {/* --- Contenido del Dashboard --- */}
      <div style={{...cardStyle, marginTop: '16px'}}>
        <h3 style={h3Style}>Historial de Jobs (Rango)</h3>
        <JobsTable jobs={filteredJobs} />
      </div>

      <div style={{...cardStyle, marginTop: '24px'}}>
        <h3 style={h3Style}>Último Resultado por Job</h3>
        <LastResultGrid jobs={allData.sessions} />
      </div>

      <div style={dualGridStyle}>
        <div style={cardStyle}>
          <h3 style={h3Style}>Uso de Repositorios</h3>
          <ReposUsageBars repositories={allData.repositories} />
        </div>
        <div style={cardStyle}>
          <h3 style={h3Style}>Estado de Jobs (Rango)</h3>
          <JobStatusPie jobs={filteredJobs} />
        </div>
      </div>

      <div style={dualGridStyle}>
        <div style={cardStyle}>
          <h3 style={h3Style}>Servidores Gestionados</h3>
          <ServersTable servers={allData.managedServers} />
        </div>
        <div style={cardStyle}>
          <h3 style={h3Style}>Proxies</h3>
          <ProxiesTable proxies={allData.proxies} />
        </div>
      </div>

      <div style={{...cardStyle, marginTop: '24px'}}>
        <h3 style={h3Style}>Puntos de Restauración por VM</h3>
        <RestorePointsGrid backupObjects={allData.backupObjects} />
      </div>

    </div>
  );
}