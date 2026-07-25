// veeam-dashboard/src/LogsPage.js
import React, { useState, useEffect, useCallback } from 'react';

// --- ESTILOS REUTILIZADOS DEL DASHBOARD ---
const layoutStyle = {
    padding: '24px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    backgroundColor: '#f8f9fa'
};

const cardStyle = {
    padding: '24px',
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.07)',
    border: '1px solid #e9ecef'
};

const h3Style = {
    margin: '0 0 16px',
    color: '#2c3e50',
    fontWeight: '600',
    borderBottom: '1px solid #e9ecef',
    paddingBottom: '12px'
};

// --- COMPONENTE: Barra de Progreso ---
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

// --- COMPONENTE: Tabla de Logs ---
const LogsTable = ({ jobs, searchTerm, typeFilter, statusFilter }) => {
    const [sortConfig, setSortConfig] = useState({ key: 'creationTime', direction: 'desc' });
    const [currentPage, setCurrentPage] = useState(1);
    const [expandedRow, setExpandedRow] = useState(null);
    const itemsPerPage = 50;

    // Filtrar jobs
    const filteredJobs = jobs.filter(job => {
        const matchesSearch = !searchTerm ||
            job.name?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = typeFilter === 'all' || job.sessionType === typeFilter;
        const matchesStatus = statusFilter === 'all' || 
            (statusFilter === 'Retry' ? (job.isRetry || job.willRetry) : job.result?.result === statusFilter);

        return matchesSearch && matchesType && matchesStatus;
    });

    // Ordenar jobs
    const sortedJobs = [...filteredJobs].sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];

        if (sortConfig.key === 'result') {
            aVal = a.result?.result || '';
            bVal = b.result?.result || '';
        }

        if (sortConfig.key === 'creationTime') {
            aVal = aVal ? new Date(aVal) : new Date(0);
            bVal = bVal ? new Date(bVal) : new Date(0);
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    // Paginación
    const totalPages = Math.ceil(sortedJobs.length / itemsPerPage);
    const paginatedJobs = sortedJobs.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const toggleRow = (index) => {
        setExpandedRow(expandedRow === index ? null : index);
    };

    const formatDate = (date) => {
        if (!date) return '—';
        return new Date(date).toLocaleString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatDuration = (start, end) => {
        if (!start || !end) return '—';
        const ms = new Date(end) - new Date(start);
        if (ms < 0) return '—';
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

    const thStyle = {
        padding: '12px 8px',
        fontWeight: '600',
        color: '#333',
        cursor: 'pointer',
        userSelect: 'none',
        position: 'relative'
    };

    const tdStyle = { padding: '10px 8px', color: '#444' };

    if (!jobs || jobs.length === 0) {
        return <p style={{ color: '#666', fontStyle: 'italic' }}>No hay logs disponibles.</p>;
    }

    return (
        <>
            <div style={{ marginBottom: '16px', color: '#6c757d', fontSize: '14px' }}>
                Mostrando {paginatedJobs.length} de {filteredJobs.length} registros
                {filteredJobs.length !== jobs.length && ` (${jobs.length} total)`}
            </div>

            <div style={{ overflowX: 'auto' }}>
                <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '14px',
                    backgroundColor: '#fff'
                }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f8f9fa', textAlign: 'left' }}>
                            <th style={{ ...thStyle, width: '40px' }}></th>
                            <th style={thStyle} onClick={() => handleSort('name')}>
                                Job {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th style={thStyle} onClick={() => handleSort('sessionType')}>
                                Tipo {sortConfig.key === 'sessionType' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th style={thStyle} onClick={() => handleSort('result')}>
                                Estado {sortConfig.key === 'result' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th style={thStyle} onClick={() => handleSort('creationTime')}>
                                Inicio {sortConfig.key === 'creationTime' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th style={thStyle}>Fin</th>
                            <th style={thStyle}>Duración</th>
                            <th style={thStyle}>Datos</th>
                            <th style={thStyle}>Resultado</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedJobs.map((job, i) => {
                            const status = job.result?.result || 'Unknown';
                            const color = {
                                Success: '#28a745',
                                Warning: '#ffc107',
                                Failed: '#dc3545',
                                None: '#6c757d'
                            }[status] || '#6c757d';

                            const isExpanded = expandedRow === i;

                            return (
                                <React.Fragment key={i}>
                                    <tr
                                        style={{ borderBottom: isExpanded ? 'none' : '1px solid #eee', cursor: 'pointer', backgroundColor: isExpanded ? '#f8f9fa' : 'white' }}
                                        onClick={() => toggleRow(i)}
                                    >
                                        <td style={{ ...tdStyle, textAlign: 'center', color: '#007bff', userSelect: 'none' }}>
                                            {isExpanded ? '▼' : '▶'}
                                        </td>
                                        <td style={tdStyle}><strong>{job.name}</strong></td>
                                        <td style={tdStyle}>{job.sessionType || '—'}</td>
                                        <td style={tdStyle}>
                                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
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
                                                {job.isRetry && (
                                                    <span style={{
                                                        display: 'inline-block',
                                                        padding: '2px 8px',
                                                        borderRadius: '12px',
                                                        backgroundColor: '#e2e3e5',
                                                        color: '#383d41',
                                                        fontSize: '11px',
                                                        fontWeight: 'bold'
                                                    }}>
                                                        Reintento
                                                    </span>
                                                )}
                                                {job.willRetry && (
                                                    <span style={{
                                                        display: 'inline-block',
                                                        padding: '2px 8px',
                                                        borderRadius: '12px',
                                                        backgroundColor: '#fff3cd',
                                                        color: '#856404',
                                                        fontSize: '11px',
                                                        fontWeight: 'bold'
                                                    }}>
                                                        Se reintentará
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td style={tdStyle}>{formatDate(job.creationTime)}</td>
                                        <td style={tdStyle}>{job.endTime && !job.isFromOneDb ? formatDate(job.endTime) : '—'}</td>
                                        <td style={tdStyle}>{!job.isFromOneDb ? formatDuration(job.creationTime, job.endTime) : '—'}</td>
                                        <td style={tdStyle}>{formatBytes(job.statistics?.processedSize)}</td>
                                        <td style={tdStyle}>{job.result?.result || '—'}</td>
                                    </tr>
                                    {isExpanded && (
                                        <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '1px solid #eee' }}>
                                            <td colSpan="9" style={{ padding: '0 16px 16px 16px' }}>
                                                <div style={{
                                                    backgroundColor: 'white',
                                                    padding: '16px',
                                                    borderRadius: '8px',
                                                    border: '1px solid #e9ecef',
                                                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.03)'
                                                }}>
                                                    <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#495057' }}>Detalles del Resultado</h4>
                                                    <div style={{
                                                        fontSize: '14px',
                                                        color: '#333',
                                                        whiteSpace: 'pre-wrap',
                                                        fontFamily: 'monospace',
                                                        backgroundColor: '#f1f3f5',
                                                        padding: '12px',
                                                        borderRadius: '6px',
                                                        maxHeight: '300px',
                                                        overflowY: 'auto'
                                                    }}>
                                                        {job.result?.resultDetails || 'No hay detalles adicionales disponibles.'}
                                                    </div>

                                                    <div style={{ marginTop: '12px', fontSize: '13px', color: '#6c757d', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                                                        <div><strong>ID de Sesión:</strong> {job.id || 'N/A'}</div>
                                                        <div><strong>Origen:</strong> {job.isFromOneDb ? 'Veeam ONE (Histórico)' : 'Veeam Backup & Replication'}</div>
                                                        {job.creationTimeUtc && <div><strong>Inicio (UTC):</strong> {job.creationTimeUtc}</div>}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
                <div style={{
                    marginTop: '16px',
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '8px',
                    alignItems: 'center'
                }}>
                    <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '6px',
                            border: '1px solid #ccc',
                            backgroundColor: currentPage === 1 ? '#e9ecef' : '#fff',
                            cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                        }}
                    >
                        Anterior
                    </button>
                    <span style={{ color: '#6c757d' }}>
                        Página {currentPage} de {totalPages}
                    </span>
                    <button
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '6px',
                            border: '1px solid #ccc',
                            backgroundColor: currentPage === totalPages ? '#e9ecef' : '#fff',
                            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                        }}
                    >
                        Siguiente
                    </button>
                </div>
            )}
        </>
    );
};

// --- COMPONENTE PRINCIPAL ---
export default function LogsPage() {
    const [allJobs, setAllJobs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');

    const backendUrl = `http://${window.location.hostname}:3001`;

    // Cargar datos
    const loadLogs = useCallback(async () => {
        setIsLoading(true);
        try {
            const cacheBuster = `?_=${new Date().getTime()}`;
            const response = await fetch(`${backendUrl}/api/summary${cacheBuster}`);

            if (!response.ok) {
                throw new Error(`Error ${response.status}: No se pudo cargar los logs`);
            }

            const data = await response.json();
            setAllJobs(data.sessions || []);
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [backendUrl]);

    useEffect(() => {
        loadLogs();
    }, [loadLogs]);

    // Obtener tipos únicos de jobs
    const jobTypes = ['all', ...new Set(allJobs.map(j => j.sessionType).filter(Boolean))];
    const statuses = ['all', 'Success', 'Warning', 'Failed', 'Retry', 'None'];

    // Exportar CSV
    const exportToCSV = () => {
        const filteredJobs = allJobs.filter(job => {
            const matchesSearch = !searchTerm || job.name?.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesType = typeFilter === 'all' || job.sessionType === typeFilter;
            const matchesStatus = statusFilter === 'all' || 
                (statusFilter === 'Retry' ? (job.isRetry || job.willRetry) : job.result?.result === statusFilter);
            return matchesSearch && matchesType && matchesStatus;
        });

        const headers = ['Job', 'Tipo', 'Estado', 'Inicio', 'Fin', 'Resultado'];
        const rows = filteredJobs.map(job => [
            job.name || '',
            job.sessionType || '',
            job.result?.result || '',
            job.creationTime || '',
            job.endTime || '',
            job.result?.resultDetails || ''
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `veeam-logs-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    if (isLoading && allJobs.length === 0) {
        return (
            <div style={layoutStyle}>
                <ProgressBar isVisible={true} />
                <h2>Cargando logs...</h2>
            </div>
        );
    }

    if (error && allJobs.length === 0) {
        return (
            <div style={layoutStyle}>
                <div style={cardStyle}>
                    <h2 style={{ color: 'red' }}>Error: {error}</h2>
                    <p>No se pudieron cargar los logs del servidor.</p>
                    <button
                        onClick={loadLogs}
                        style={{
                            padding: '10px 18px',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: '#007bff',
                            color: 'white',
                            cursor: 'pointer',
                            fontWeight: '600'
                        }}
                    >
                        Reintentar
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={layoutStyle}>
            <ProgressBar isVisible={isLoading} />

            {/* Header con filtros */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '24px',
                flexWrap: 'wrap',
                gap: '16px'
            }}>
                <h2 style={{ margin: 0, color: '#2c3e50' }}>Logs de Jobs</h2>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <button
                        onClick={loadLogs}
                        disabled={isLoading}
                        style={{
                            padding: '10px 18px',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: '#17a2b8',
                            color: 'white',
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                            fontWeight: '600'
                        }}
                    >
                        {isLoading ? 'Actualizando...' : 'Actualizar'}
                    </button>

                    <button
                        onClick={exportToCSV}
                        style={{
                            padding: '10px 18px',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: '#28a745',
                            color: 'white',
                            cursor: 'pointer',
                            fontWeight: '600'
                        }}
                    >
                        Exportar CSV
                    </button>
                </div>
            </div>



            {/* Filtros */}
            <div style={{
                ...cardStyle,
                marginBottom: '24px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '16px'
            }}>
                <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#495057' }}>
                        Buscar por nombre
                    </label>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Escriba el nombre del job..."
                        style={{
                            width: '100%',
                            padding: '10px',
                            borderRadius: '6px',
                            border: '1px solid #ced4da',
                            fontSize: '14px'
                        }}
                    />
                </div>

                <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#495057' }}>
                        Filtrar por tipo
                    </label>
                    <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '10px',
                            borderRadius: '6px',
                            border: '1px solid #ced4da',
                            fontSize: '14px'
                        }}
                    >
                        {jobTypes.map(type => (
                            <option key={type} value={type}>
                                {type === 'all' ? 'Todos los tipos' : type}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#495057' }}>
                        Filtrar por estado
                    </label>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '10px',
                            borderRadius: '6px',
                            border: '1px solid #ced4da',
                            fontSize: '14px'
                        }}
                    >
                        {statuses.map(status => (
                            <option key={status} value={status}>
                                {status === 'all' ? 'Todos los estados' : (status === 'Retry' ? 'Reintentos (Retry)' : status)}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Tabla de logs */}
            <div style={cardStyle}>
                <h3 style={h3Style}>Todos los Logs de Jobs</h3>
                <LogsTable
                    jobs={allJobs}
                    searchTerm={searchTerm}
                    typeFilter={typeFilter}
                    statusFilter={statusFilter}
                />
            </div>
        </div>
    );
}
