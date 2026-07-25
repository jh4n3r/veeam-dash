import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import html2canvas from 'html2canvas';

// --- ESTILOS MODERNOS Y GLASSMORPHISM ---
const layoutStyle = {
  padding: '24px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  backgroundColor: '#f4f6f9',
  minHeight: '85vh',
  marginTop: '12px'
};

const cardStyle = {
  padding: '24px',
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.06)',
  border: '1px solid #e9ecef',
  marginBottom: '24px'
};

const metricsGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: '16px',
  marginBottom: '24px'
};

const metricCardStyle = (gradientBg) => ({
  padding: '18px 20px',
  borderRadius: '12px',
  color: 'white',
  background: gradientBg,
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.12)',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  minHeight: '95px'
});

const flowContainerStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  gap: '24px',
  marginTop: '20px'
};

const flowColStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '14px',
  backgroundColor: '#f8f9fa',
  padding: '16px',
  borderRadius: '12px',
  border: '1px solid #e9ecef'
};

const columnHeaderStyle = (color) => ({
  fontWeight: '700',
  fontSize: '14px',
  color: '#2c3e50',
  borderBottom: `3px solid ${color}`,
  paddingBottom: '8px',
  marginBottom: '8px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center'
});

const nodeCardStyle = (isActive, isRelated, isDimmed) => ({
  padding: '14px 16px',
  borderRadius: '10px',
  border: isActive
    ? '2px solid #0056b3'
    : (isRelated ? '2px solid #28a745' : '1px solid #dee2e6'),
  backgroundColor: isActive
    ? '#eef5ff'
    : (isRelated ? '#f0fff4' : '#ffffff'),
  boxShadow: isActive
    ? '0 6px 18px rgba(0, 86, 179, 0.22)'
    : (isRelated ? '0 4px 12px rgba(40, 167, 69, 0.15)' : '0 2px 6px rgba(0,0,0,0.04)'),
  cursor: 'pointer',
  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
  opacity: isDimmed ? 0.35 : 1,
  transform: isActive || isRelated ? 'translateY(-2px)' : 'none',
  position: 'relative'
});

const badgeStyle = (bgColor, textColor = '#fff') => ({
  display: 'inline-block',
  padding: '3px 8px',
  borderRadius: '6px',
  fontSize: '11px',
  fontWeight: '600',
  backgroundColor: bgColor,
  color: textColor,
  whiteSpace: 'nowrap'
});

// --- ICONOS SVG VECTORIALES LIMPIOS ---
const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
);

const RefreshIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"></polyline>
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
  </svg>
);

const DownloadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
    <polyline points="7 10 12 15 17 10"></polyline>
    <line x1="12" y1="15" x2="12" y2="3"></line>
  </svg>
);

const DiagramIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1"></rect>
    <rect x="14" y="3" width="7" height="7" rx="1"></rect>
    <rect x="14" y="14" width="7" height="7" rx="1"></rect>
    <rect x="3" y="14" width="7" height="7" rx="1"></rect>
  </svg>
);

const TableIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="21" y2="6"></line>
    <line x1="3" y1="12" x2="21" y2="12"></line>
    <line x1="3" y1="18" x2="21" y2="18"></line>
  </svg>
);

const GraphIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6" cy="6" r="3"></circle>
    <circle cx="18" cy="6" r="3"></circle>
    <circle cx="12" cy="18" r="3"></circle>
    <line x1="8.5" y1="7.5" x2="15.5" y2="7.5"></line>
    <line x1="7.5" y1="8.5" x2="10.5" y2="15.5"></line>
    <line x1="16.5" y1="8.5" x2="13.5" y2="15.5"></line>
  </svg>
);

const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatDate = (dateStr) => {
  if (!dateStr || dateStr === 'N/A' || dateStr === '') return 'No programado / Sin registro';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return dateStr;
  }
};

// ==================================================================
// --- COMPONENTE: SVG Node Graph (Esquema Completo de Nodos y Flechas) ---
// ==================================================================
const NodeTopologyGraph = ({ jobs = [], repositories = [], hoveredNode, setHoveredNode, relatedElements }) => {
  const containerRef = useRef(null);

  // Clasificar jobs por niveles
  const { level0Jobs, level1Jobs, repoNodes } = useMemo(() => {
    const l0 = [];
    const l1 = [];
    
    jobs.forEach(job => {
      const isCopy = job.type === 'BackupCopy' || job.type === 'SimpleBackupCopyPolicy' || job.type === 'BackupToTape' || job.type === 'Tape' || job.type === 'Replica';
      const hasParent = Boolean(job.parentJobId || job.parentJobName);
      if (hasParent || isCopy) {
        l1.push(job);
      } else {
        l0.push(job);
      }
    });

    return { level0Jobs: l0, level1Jobs: l1, repoNodes: repositories };
  }, [jobs, repositories]);

  // Dimensiones estáticas para el lienzo SVG
  const nodeWidth = 240;
  const nodeHeight = 54;
  const colGap = 160;
  const rowGap = 20;
  const col0X = 40;
  const col1X = col0X + nodeWidth + colGap;
  const col2X = col1X + nodeWidth + colGap;

  const maxRows = Math.max(level0Jobs.length, level1Jobs.length, repoNodes.length, 1);
  const graphHeight = Math.max(520, maxRows * (nodeHeight + rowGap) + 90);
  const graphWidth = col2X + nodeWidth + 60;

  // Calcular posiciones Y de los nodos
  const getJobNodePos = (index) => {
    const topMargin = 50;
    return topMargin + index * (nodeHeight + rowGap);
  };

  // Mapear coordenadas de cada nodo para trazar flechas
  const nodeCoords = useMemo(() => {
    const coords = new Map();

    level0Jobs.forEach((job, idx) => {
      const y = getJobNodePos(idx);
      coords.set(`job-${job.id}`, { x: col0X, y, width: nodeWidth, height: nodeHeight, type: 'job', data: job });
    });

    level1Jobs.forEach((job, idx) => {
      const y = getJobNodePos(idx);
      coords.set(`job-${job.id}`, { x: col1X, y, width: nodeWidth, height: nodeHeight, type: 'job', data: job });
    });

    repoNodes.forEach((repo, idx) => {
      const y = getJobNodePos(idx);
      coords.set(`repo-${repo.id}`, { x: col2X, y, width: nodeWidth, height: nodeHeight, type: 'repo', data: repo });
    });

    return coords;
  }, [level0Jobs, level1Jobs, repoNodes, col0X, col1X, col2X]);

  // Construir conexiones/líneas curvas Bezier de TODOS los niveles
  const connections = useMemo(() => {
    const lines = [];

    const jobById = new Map();
    const jobByName = new Map();
    jobs.forEach(j => {
      if (j.id) jobById.set(j.id, j);
      if (j.name) jobByName.set(j.name.toLowerCase(), j);
    });

    jobs.forEach(job => {
      const sourceKey = `job-${job.id}`;
      const sourcePos = nodeCoords.get(sourceKey);
      if (!sourcePos) return;

      // 1. Conexión AfterJob (Padre ➔ Hijo Encadenado)
      let parentJob = null;
      if (job.parentJobId && jobById.has(job.parentJobId)) {
        parentJob = jobById.get(job.parentJobId);
      } else if (job.parentJobName && jobByName.has(job.parentJobName.toLowerCase())) {
        parentJob = jobByName.get(job.parentJobName.toLowerCase());
      }

      if (parentJob) {
        const parentPos = nodeCoords.get(`job-${parentJob.id}`);
        if (parentPos) {
          lines.push({
            id: `chain-${parentJob.id}-${job.id}`,
            fromId: parentJob.id,
            toId: job.id,
            fromKey: `job-${parentJob.id}`,
            toKey: sourceKey,
            x1: parentPos.x + parentPos.width,
            y1: parentPos.y + parentPos.height / 2,
            x2: sourcePos.x,
            y2: sourcePos.y + sourcePos.height / 2,
            label: 'AfterJob',
            type: 'chain'
          });
        }
      }

      // 2. Conexión Origen ➔ Copia / Réplica
      if (job.sourceJobNames && job.sourceJobNames.length > 0) {
        job.sourceJobNames.forEach(sName => {
          const sJob = jobByName.get(sName.toLowerCase());
          if (sJob) {
            const sPos = nodeCoords.get(`job-${sJob.id}`);
            if (sPos) {
              lines.push({
                id: `copy-${sJob.id}-${job.id}`,
                fromId: sJob.id,
                toId: job.id,
                fromKey: `job-${sJob.id}`,
                toKey: sourceKey,
                x1: sPos.x + sPos.width,
                y1: sPos.y + sPos.height / 2,
                x2: sourcePos.x,
                y2: sourcePos.y + sourcePos.height / 2,
                label: 'Copia',
                type: 'copy'
              });
            }
          }
        });
      }

      // 3. Conexión Job ➔ Repositorio Destino (Por ID o por Nombre)
      let repoPos = job.repositoryId ? nodeCoords.get(`repo-${job.repositoryId}`) : null;
      if (!repoPos && job.repositoryName && job.repositoryName !== 'N/A') {
        const repoObj = repoNodes.find(r => r.name.toLowerCase() === job.repositoryName.toLowerCase());
        if (repoObj) repoPos = nodeCoords.get(`repo-${repoObj.id}`);
      }

      if (repoPos) {
        lines.push({
          id: `repo-${job.id}-${repoPos.data.id}`,
          fromId: job.id,
          toId: repoPos.data.id,
          fromKey: sourceKey,
          toKey: `repo-${repoPos.data.id}`,
          x1: sourcePos.x + sourcePos.width,
          y1: sourcePos.y + sourcePos.height / 2,
          x2: repoPos.x,
          y2: repoPos.y + repoPos.height / 2,
          label: 'Destino',
          type: 'repository'
        });
      }
    });

    return lines;
  }, [jobs, nodeCoords, repoNodes]);

  return (
    <div style={{ overflowX: 'auto', backgroundColor: '#ffffff', borderRadius: '12px', padding: '20px', border: '1px solid #e9ecef' }} ref={containerRef} className="printable-diagram-container">
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} className="no-print">
        <span style={{ fontSize: '13px', fontWeight: '600', color: '#495057' }}>
          Esquema Completo de Flechas de Conexión (Jobs Origen ➔ Encadenados/Copia ➔ Repositorios)
        </span>
        <div style={{ display: 'flex', gap: '16px', fontSize: '12px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '3px', border: '1.5px solid #2c3e50', backgroundColor: '#fff' }}></span> Job Origen
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '3px', border: '1.5px solid #6f42c1', backgroundColor: '#f8f0ff' }}></span> Encadenado / Copia
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '3px', border: '1.5px solid #28a745', backgroundColor: '#f0fff4' }}></span> Repositorio
          </span>
        </div>
      </div>

      <svg
        width={graphWidth}
        height={graphHeight}
        viewBox={`0 0 ${graphWidth} ${graphHeight}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block', margin: '0 auto', maxWidth: '100%' }}
      >
        <defs>
          <marker id="arrowhead-default" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 1 L 9 5 L 0 9 z" fill="#6c757d" />
          </marker>
          <marker id="arrowhead-active" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M 0 1 L 9 5 L 0 9 z" fill="#0056b3" />
          </marker>
          <marker id="arrowhead-chain" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 1 L 9 5 L 0 9 z" fill="#8e44ad" />
          </marker>
        </defs>

        {/* ENCABEZADOS DE COLUMNA */}
        <text x={col0X + 10} y="30" fill="#2c3e50" fontSize="13" fontWeight="bold">Jobs Origen (Backup)</text>
        <text x={col1X + 10} y="30" fill="#6f42c1" fontSize="13" fontWeight="bold">Jobs Encadenados / Copia</text>
        <text x={col2X + 10} y="30" fill="#28a745" fontSize="13" fontWeight="bold">Repositorios Destino</text>

        {/* LÍNEAS DE CONEXIÓN CON FLECHAS */}
        {connections.map(conn => {
          const isHighlighted = hoveredNode && (
            (hoveredNode.type === 'job' && (hoveredNode.id === conn.fromId || hoveredNode.id === conn.toId)) ||
            (hoveredNode.type === 'repo' && (hoveredNode.id === conn.fromId || hoveredNode.id === conn.toId)) ||
            (relatedElements.jobs.has(conn.fromId) && relatedElements.jobs.has(conn.toId))
          );

          const strokeColor = isHighlighted ? '#0056b3' : (conn.type === 'chain' ? '#8e44ad' : '#7f8c8d');
          const strokeWidth = isHighlighted ? 2.5 : 1.5;
          const markerId = isHighlighted ? 'url(#arrowhead-active)' : (conn.type === 'chain' ? 'url(#arrowhead-chain)' : 'url(#arrowhead-default)');

          // Curva Bezier suavizada
          const dx = conn.x2 - conn.x1;
          const cx1 = conn.x1 + dx * 0.45;
          const cy1 = conn.y1;
          const cx2 = conn.x1 + dx * 0.55;
          const cy2 = conn.y2;

          const pathD = `M ${conn.x1} ${conn.y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${conn.x2} ${conn.y2}`;

          return (
            <g key={conn.id}>
              <path
                d={pathD}
                fill="none"
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeDasharray={conn.type === 'chain' ? '4 3' : 'none'}
                markerEnd={markerId}
                style={{ transition: 'all 0.2s ease' }}
              />
            </g>
          );
        })}

        {/* NODOS (CAJAS DE JOBS Y REPOS) */}
        {Array.from(nodeCoords.entries()).map(([key, node]) => {
          const isJob = node.type === 'job';
          const nodeData = node.data;
          const isActive = hoveredNode?.type === node.type && hoveredNode.id === nodeData.id;
          const isRelated = isJob ? relatedElements.jobs.has(nodeData.id) : relatedElements.repos.has(nodeData.id);
          const isDimmed = hoveredNode && !isActive && !isRelated;

          const isChained = isJob && Boolean(nodeData.parentJobId || nodeData.parentJobName);
          const isCopy = isJob && (nodeData.type === 'BackupCopy' || nodeData.type === 'SimpleBackupCopyPolicy' || nodeData.type === 'Replica');

          let borderColor = isJob ? '#2c3e50' : '#28a745';
          if (isChained) borderColor = '#6f42c1';
          if (isCopy) borderColor = '#d35400';
          if (isActive) borderColor = '#0056b3';

          let bgColor = '#ffffff';
          if (isChained) bgColor = '#fdf8ff';
          if (isCopy) bgColor = '#fffcf5';
          if (!isJob) bgColor = '#f6fff8';
          if (isActive) bgColor = '#eef5ff';

          const vmsText = (nodeData.targetVMs && nodeData.targetVMs.length > 0) ? nodeData.targetVMs.join(', ') : '';

          return (
            <g
              key={key}
              transform={`translate(${node.x}, ${node.y})`}
              onMouseEnter={() => setHoveredNode({ type: node.type, id: nodeData.id })}
              onMouseLeave={() => setHoveredNode(null)}
              style={{ cursor: 'pointer', opacity: isDimmed ? 0.35 : 1, transition: 'all 0.2s ease' }}
            >
              <rect
                width={node.width}
                height={node.height}
                rx="8"
                ry="8"
                fill={bgColor}
                stroke={borderColor}
                strokeWidth={isActive || isRelated ? '2' : '1.5'}
                style={{
                  filter: isActive ? 'drop-shadow(0px 4px 8px rgba(0,86,179,0.25))' : 'drop-shadow(0px 2px 4px rgba(0,0,0,0.05))'
                }}
              />

              {/* TEXTO DEL NODO */}
              <text
                x="12"
                y="20"
                fill="#1a252f"
                fontSize="12"
                fontWeight="bold"
                style={{ pointerEvents: 'none' }}
              >
                {nodeData.name.length > 28 ? nodeData.name.substring(0, 26) + '...' : nodeData.name}
              </text>

              {/* SUBTEXTO / VMS Y INFORMACIÓN */}
              <text
                x="12"
                y="36"
                fill="#6c757d"
                fontSize="10"
                style={{ pointerEvents: 'none' }}
              >
                {isJob ? (
                  isChained
                    ? `AfterJob: ${nodeData.parentJobName || 'Padre'}`
                    : (vmsText ? `VMs: ${vmsText.substring(0, 26)}` : `Frec: ${nodeData.scheduleDescription || 'Programado'}`)
                ) : (
                  `Uso: ${nodeData.used || 0}GB / ${nodeData.capacity || 0}GB (${nodeData.percent || 0}%)`
                )}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default function DiagramsPage() {
  const [jobs, setJobs] = useState([]);
  const [repositories, setRepositories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedRepoFilter, setSelectedRepoFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('graph'); // 'graph' | 'diagram' | 'table'
  const [hoveredNode, setHoveredNode] = useState(null); // { type: 'job'|'repo', id: string }

  const backendUrl = `http://${window.location.hostname}:3001`;

  // Cargar datos del backend
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const cacheBuster = `?_=${new Date().getTime()}`;
      const response = await fetch(`${backendUrl}/api/summary${cacheBuster}`);
      if (!response.ok) {
        throw new Error(`Error ${response.status}: No se pudieron cargar los datos`);
      }
      const data = await response.json();
      setJobs(data.jobs || []);
      setRepositories(data.repositories || []);
      setError(null);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [backendUrl]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Clasificación de Jobs
  const { primaryJobs, chainedJobs, copyJobs } = useMemo(() => {
    const primary = [];
    const chained = [];
    const copy = [];

    jobs.forEach(job => {
      const isCopyType = job.type === 'BackupCopy' || 
                         job.type === 'SimpleBackupCopyPolicy' || 
                         job.type === 'SimpleBackupCopyWorker' || 
                         job.type === 'BackupToTape' || 
                         job.type === 'Tape' || 
                         job.type === 'Replica';

      const hasParent = Boolean(job.parentJobId || job.parentJobName);

      if (isCopyType) {
        copy.push(job);
      } else if (hasParent) {
        chained.push(job);
      } else {
        primary.push(job);
      }
    });

    return { primaryJobs: primary, chainedJobs: chained, copyJobs: copy };
  }, [jobs]);

  // Filtros aplicados a los jobs
  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      const matchesSearch = !searchTerm || 
        job.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.repositoryName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.parentJobName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (job.targetVMs && job.targetVMs.some(vm => vm.toLowerCase().includes(searchTerm.toLowerCase()))) ||
        job.type?.toLowerCase().includes(searchTerm.toLowerCase());

      const isChained = Boolean(job.parentJobId || job.parentJobName);
      const isCopy = job.type === 'BackupCopy' || job.type === 'SimpleBackupCopyPolicy' || job.type === 'BackupToTape' || job.type === 'Replica';

      let matchesType = true;
      if (selectedType === 'primary') matchesType = !isCopy && !isChained;
      if (selectedType === 'chained') matchesType = isChained;
      if (selectedType === 'copy') matchesType = isCopy;
      if (selectedType === 'replica') matchesType = job.type === 'Replica';

      const matchesRepo = selectedRepoFilter === 'all' || job.repositoryId === selectedRepoFilter;

      return matchesSearch && matchesType && matchesRepo;
    });
  }, [jobs, searchTerm, selectedType, selectedRepoFilter]);

  // Elementos relacionados para Hover
  const relatedElements = useMemo(() => {
    if (!hoveredNode) return { jobs: new Set(), repos: new Set() };
    const relatedJobs = new Set();
    const relatedRepos = new Set();

    if (hoveredNode.type === 'job') {
      const targetJob = jobs.find(j => j.id === hoveredNode.id);
      if (targetJob) {
        relatedJobs.add(targetJob.id);
        if (targetJob.repositoryId) relatedRepos.add(targetJob.repositoryId);

        // Padre
        if (targetJob.parentJobId) relatedJobs.add(targetJob.parentJobId);

        // Hijos encadenados
        jobs.forEach(j => {
          if (j.parentJobId === targetJob.id || (j.parentJobName && j.parentJobName.toLowerCase() === targetJob.name.toLowerCase())) {
            relatedJobs.add(j.id);
            if (j.repositoryId) relatedRepos.add(j.repositoryId);
          }
        });

        // Orígenes de copia
        if (targetJob.sourceJobIds && targetJob.sourceJobIds.length > 0) {
          targetJob.sourceJobIds.forEach(id => relatedJobs.add(id));
        }

        // Si este job es origen de copias
        jobs.forEach(j => {
          if (j.sourceJobIds && j.sourceJobIds.includes(targetJob.id)) {
            relatedJobs.add(j.id);
            if (j.repositoryId) relatedRepos.add(j.repositoryId);
          }
        });
      }
    } else if (hoveredNode.type === 'repo') {
      relatedRepos.add(hoveredNode.id);
      jobs.forEach(j => {
        if (j.repositoryId === hoveredNode.id) {
          relatedJobs.add(j.id);
          if (j.parentJobId) relatedJobs.add(j.parentJobId);
          if (j.sourceJobIds) j.sourceJobIds.forEach(id => relatedJobs.add(id));
        }
      });
    }

    return { jobs: relatedJobs, repos: relatedRepos };
  }, [hoveredNode, jobs]);

  // Exportar Excel Nativo Formateado (.xls)
  const exportToCSV = () => {
    const headers = [
      'Nombre del Job',
      'Tipo de Job',
      'VMs / Objetos Respaldados',
      'Frecuencia (Cada Cuánto)',
      'Ejecuta Tras (Job Padre)',
      'Repositorio Destino',
      'Tipo Repositorio',
      'Última Ejecución',
      'Próxima Ejecución',
      'Puntos de Restauración',
      'Tamaño en Disco'
    ];

    const rows = filteredJobs.map(job => [
      job.name || '',
      job.type || '',
      (job.targetVMs || []).join('; '),
      job.scheduleDescription || 'Manual',
      job.parentJobName || (job.parentJobId ? 'Job Padre Configurado' : 'Ninguno'),
      job.repositoryName || 'N/A',
      job.repositoryType || 'N/A',
      formatDate(job.lastRun),
      formatDate(job.nextRun),
      job.restorePointsCount || 0,
      formatBytes(job.sizeInBytes)
    ]);

    let excelHTML = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8"/>
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Jobs Veeam</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          table { border-collapse: collapse; font-family: Arial, sans-serif; }
          th { background-color: #0056b3; color: #ffffff; font-weight: bold; padding: 10px 14px; border: 1px solid #cccccc; }
          td { padding: 8px 12px; border: 1px solid #e0e0e0; font-size: 13px; }
          tr:nth-child(even) { background-color: #f8f9fa; }
        </style>
      </head>
      <body>
        <h2>Reporte Completo de Configuración y Programación de Jobs - Veeam Backup</h2>
        <table>
          <thead>
            <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${rows.map(row => `<tr>${row.map(cell => `<td>${String(cell).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob(['\uFEFF' + excelHTML], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `esquema-jobs-veeam-${new Date().toISOString().split('T')[0]}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Exportar Diagrama/Lista a PDF Vectorial (Impresión limpia)
  const exportToPDF = () => {
    window.print();
  };

  // Exportar Cualquier Vista Activa (Gráfico, Cuadrícula o Tabla) a Imagen PNG HD (4K)
  const exportToPNG = async () => {
    // 1. Intentar capturar la vista activa mediante html2canvas
    const activeContainer = document.querySelector('.printable-diagram-container') ||
                            document.querySelector('.diagrams-view-container') ||
                            document.querySelector('.jobs-table-container');

    if (activeContainer) {
      try {
        const canvas = await html2canvas(activeContainer, {
          scale: 2, // Calidad Ultra HD
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false
        });

        const imgData = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = imgData;
        link.download = `veeam-${activeTab}-${new Date().toISOString().split('T')[0]}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      } catch (err) {
        console.warn('html2canvas tuvo una advertencia, probando exportación vectorial SVG:', err);
      }
    }

    // Fallback: Exportar SVG puro si se trata de la pestaña de gráfico de flechas
    const svgElement = document.querySelector('.printable-diagram-container svg');
    if (!svgElement) {
      alert('Por favor selecciona la pestaña deseada para exportar.');
      return;
    }

    const viewBox = svgElement.getAttribute('viewBox');
    let width = 1400;
    let height = 1800;
    if (viewBox) {
      const parts = viewBox.split(' ');
      if (parts.length === 4) {
        width = parseFloat(parts[2]);
        height = parseFloat(parts[3]);
      }
    }

    const svgClone = svgElement.cloneNode(true);
    svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svgClone.setAttribute('width', width);
    svgClone.setAttribute('height', height);

    const svgString = new XMLSerializer().serializeToString(svgClone);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const URL = window.URL || window.webkitURL || window;
    const blobURL = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const scale = 2;
      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = height * scale;

      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, width, height);

      const pngData = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.href = pngData;
      downloadLink.download = `esquema-topologia-veeam-HD-${new Date().toISOString().split('T')[0]}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(blobURL);
    };

    img.src = blobURL;
  };

  if (isLoading && jobs.length === 0) {
    return (
      <div style={layoutStyle}>
        <div style={{ ...cardStyle, textAlign: 'center', padding: '40px' }}>
          <h3 style={{ color: '#0056b3' }}>Cargando esquema de conexiones...</h3>
          <p style={{ color: '#6c757d' }}>Consultando información de Veeam Backup & Replication...</p>
        </div>
      </div>
    );
  }

  if (error && jobs.length === 0) {
    return (
      <div style={layoutStyle}>
        <div style={cardStyle}>
          <h3 style={{ color: '#dc3545', margin: 0 }}>Error al cargar datos: {error}</h3>
          <p style={{ marginTop: '8px', color: '#6c757d' }}>Asegúrate de que el servidor backend (puerto 3001) esté activo.</p>
          <button onClick={loadData} style={{ padding: '10px 18px', borderRadius: '6px', backgroundColor: '#007bff', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '600' }}>
            Reintentar Conexión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={layoutStyle}>
      {/* HEADER DE PÁGINA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0, color: '#1a252f', fontSize: '22px', fontWeight: '700' }}>
            Esquema de Conexiones y Programación de Jobs
          </h2>
          <span style={{ fontSize: '13px', color: '#6c757d' }}>
            Visualización interactiva de flujos, repositorios destino, encadenamiento (Post-Job) y frecuencias de ejecución.
          </span>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveTab('graph')}
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              border: activeTab === 'graph' ? '2px solid #0056b3' : '1px solid #ced4da',
              backgroundColor: activeTab === 'graph' ? '#eef5ff' : '#ffffff',
              color: activeTab === 'graph' ? '#0056b3' : '#333',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <GraphIcon /> Esquema Gráfico (Flechas)
          </button>

          <button
            onClick={() => setActiveTab('diagram')}
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              border: activeTab === 'diagram' ? '2px solid #0056b3' : '1px solid #ced4da',
              backgroundColor: activeTab === 'diagram' ? '#eef5ff' : '#ffffff',
              color: activeTab === 'diagram' ? '#0056b3' : '#333',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <DiagramIcon /> Vista Columnas
          </button>

          <button
            onClick={() => setActiveTab('table')}
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              border: activeTab === 'table' ? '2px solid #0056b3' : '1px solid #ced4da',
              backgroundColor: activeTab === 'table' ? '#eef5ff' : '#ffffff',
              color: activeTab === 'table' ? '#0056b3' : '#333',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <TableIcon /> Tabla Detallada
          </button>

          <button
            onClick={loadData}
            style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#17a2b8', color: 'white', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshIcon /> Actualizar
          </button>
          <button
            onClick={exportToPNG}
            style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#6f42c1', color: 'white', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <DownloadIcon /> Exportar Imagen PNG (HD)
          </button>
          <button
            onClick={exportToCSV}
            style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#28a745', color: 'white', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <DownloadIcon /> Exportar Excel
          </button>
          <button
            onClick={exportToPDF}
            style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#dc3545', color: 'white', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <DownloadIcon /> Exportar PDF
          </button>
        </div>
      </div>

      {/* METRICAS RAPIDAS (HEADER CARDS) */}
      <div style={metricsGridStyle}>
        <div style={metricCardStyle('linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)')}>
          <span style={{ fontSize: '13px', opacity: 0.9, fontWeight: '600' }}>Total Jobs Registrados</span>
          <span style={{ fontSize: '28px', fontWeight: 'bold' }}>{jobs.length}</span>
        </div>

        <div style={metricCardStyle('linear-gradient(135deg, #00b09b 0%, #96c93d 100%)')}>
          <span style={{ fontSize: '13px', opacity: 0.9, fontWeight: '600' }}>Jobs Origen (Backup)</span>
          <span style={{ fontSize: '28px', fontWeight: 'bold' }}>{primaryJobs.length}</span>
        </div>

        <div style={metricCardStyle('linear-gradient(135deg, #8e2de2 0%, #4a00e0 100%)')}>
          <span style={{ fontSize: '13px', opacity: 0.9, fontWeight: '600' }}>Jobs Encadenados (Post-Job)</span>
          <span style={{ fontSize: '28px', fontWeight: 'bold' }}>{chainedJobs.length}</span>
        </div>

        <div style={metricCardStyle('linear-gradient(135deg, #f857a6 0%, #ff5858 100%)')}>
          <span style={{ fontSize: '13px', opacity: 0.9, fontWeight: '600' }}>Jobs Copia / Tape / Réplica</span>
          <span style={{ fontSize: '28px', fontWeight: 'bold' }}>{copyJobs.length}</span>
        </div>

        <div style={metricCardStyle('linear-gradient(135deg, #4b6cb7 0%, #182848 100%)')}>
          <span style={{ fontSize: '13px', opacity: 0.9, fontWeight: '600' }}>Repositorios Destino</span>
          <span style={{ fontSize: '28px', fontWeight: 'bold' }}>{repositories.length}</span>
        </div>
      </div>

      {/* BARRA DE FILTROS Y BÚSQUEDA */}
      <div style={{ ...cardStyle, padding: '16px 20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: '1 1 240px', position: 'relative' }}>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por job, VM respaldada, tipo o repositorio..."
              style={{
                width: '100%',
                padding: '10px 14px 10px 34px',
                borderRadius: '8px',
                border: '1px solid #ced4da',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
            <div style={{ position: 'absolute', left: '12px', top: '12px', color: '#6c757d' }}>
              <SearchIcon />
            </div>
          </div>

          <div style={{ width: '200px' }}>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #ced4da', backgroundColor: 'white', fontSize: '13px' }}
            >
              <option value="all">Todos los tipos de Jobs</option>
              <option value="primary">Solo Backup Origen</option>
              <option value="chained">Solo Encadenados (Post-Job)</option>
              <option value="copy">Solo Copia / Tape</option>
              <option value="replica">Solo Réplicas</option>
            </select>
          </div>

          <div style={{ width: '220px' }}>
            <select
              value={selectedRepoFilter}
              onChange={(e) => setSelectedRepoFilter(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #ced4da', backgroundColor: 'white', fontSize: '13px' }}
            >
              <option value="all">Todos los Repositorios</option>
              {repositories.map(repo => (
                <option key={repo.id} value={repo.id}>{repo.name}</option>
              ))}
            </select>
          </div>

          {(searchTerm || selectedType !== 'all' || selectedRepoFilter !== 'all') && (
            <button
              onClick={() => { setSearchTerm(''); setSelectedType('all'); setSelectedRepoFilter('all'); }}
              style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', backgroundColor: '#e2e3e5', color: '#383d41', fontSize: '12px', cursor: 'pointer' }}
            >
              Limpiar Filtros
            </button>
          )}
        </div>
      </div>

      {/* VISTA 1: ESQUEMA GRÁFICO DE NODOS CON FLECHAS (SVG TOPOLOGY GRAPH) */}
      {activeTab === 'graph' && (
        <NodeTopologyGraph
          jobs={filteredJobs}
          repositories={repositories}
          hoveredNode={hoveredNode}
          setHoveredNode={setHoveredNode}
          relatedElements={relatedElements}
        />
      )}

      {/* VISTA 2: DIAGRAMA POR COLUMNAS */}
      {activeTab === 'diagram' && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, color: '#2c3e50', fontSize: '16px' }}>
              Mapa de Topología y Conexiones
            </h3>
            <span style={{ fontSize: '12px', color: '#6c757d' }}>
              Pasa el ratón sobre cualquier tarjeta para iluminar su cadena completa de conexiones.
            </span>
          </div>

          <div style={flowContainerStyle}>
            {/* COLUMNA 1: JOBS PRIMARIOS / ORIGEN */}
            <div style={flowColStyle}>
              <div style={columnHeaderStyle('#007bff')}>
                <span>1. Jobs Origen (Backup)</span>
                <span style={badgeStyle('#007bff')}>{primaryJobs.filter(j => filteredJobs.includes(j)).length}</span>
              </div>
              {primaryJobs.filter(j => filteredJobs.includes(j)).length === 0 ? (
                <div style={{ color: '#999', fontStyle: 'italic', padding: '16px', textAlign: 'center', fontSize: '13px' }}>
                  Sin jobs origen con estos filtros
                </div>
              ) : (
                primaryJobs.filter(j => filteredJobs.includes(j)).map(job => {
                  const isActive = hoveredNode?.type === 'job' && hoveredNode.id === job.id;
                  const isRelated = relatedElements.jobs.has(job.id);
                  const isDimmed = hoveredNode && !isActive && !isRelated;

                  return (
                    <div
                      key={job.id}
                      style={nodeCardStyle(isActive, isRelated, isDimmed)}
                      onMouseEnter={() => setHoveredNode({ type: 'job', id: job.id })}
                      onMouseLeave={() => setHoveredNode(null)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                        <div style={{ fontWeight: '700', fontSize: '13px', color: '#1a252f', flex: 1, paddingRight: '8px' }}>
                          {job.name}
                        </div>
                        <span style={badgeStyle('#cce5ff', '#004085')}>{job.type || 'Backup'}</span>
                      </div>

                      <div style={{ fontSize: '11px', color: '#495057', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {job.targetVMs && job.targetVMs.length > 0 && (
                          <div><strong>VMs respaldadas:</strong> <span style={{ color: '#28a745', fontWeight: '600' }}>{job.targetVMs.join(', ')}</span></div>
                        )}
                        <div><strong>Frecuencia:</strong> {job.scheduleDescription || 'Programado'}</div>
                        <div><strong>Última ejec:</strong> {formatDate(job.lastRun)}</div>
                        <div><strong>Destino:</strong> <span style={{ color: '#0056b3', fontWeight: '600' }}>{job.repositoryName || 'N/A'}</span></div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* COLUMNA 2: JOBS ENCADENADOS (POST-JOB) */}
            <div style={flowColStyle}>
              <div style={columnHeaderStyle('#6f42c1')}>
                <span>2. Jobs Encadenados (Post-Job)</span>
                <span style={badgeStyle('#6f42c1')}>{chainedJobs.filter(j => filteredJobs.includes(j)).length}</span>
              </div>
              {chainedJobs.filter(j => filteredJobs.includes(j)).length === 0 ? (
                <div style={{ color: '#999', fontStyle: 'italic', padding: '16px', textAlign: 'center', fontSize: '13px', border: '1px dashed #ccc', borderRadius: '8px' }}>
                  No hay jobs configurados para ejecutarse tras otro job
                </div>
              ) : (
                chainedJobs.filter(j => filteredJobs.includes(j)).map(job => {
                  const isActive = hoveredNode?.type === 'job' && hoveredNode.id === job.id;
                  const isRelated = relatedElements.jobs.has(job.id);
                  const isDimmed = hoveredNode && !isActive && !isRelated;

                  return (
                    <div
                      key={job.id}
                      style={nodeCardStyle(isActive, isRelated, isDimmed)}
                      onMouseEnter={() => setHoveredNode({ type: 'job', id: job.id })}
                      onMouseLeave={() => setHoveredNode(null)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                        <div style={{ fontWeight: '700', fontSize: '13px', color: '#1a252f', flex: 1, paddingRight: '8px' }}>
                          {job.name}
                        </div>
                        <span style={badgeStyle('#e2d9f3', '#4a00e0')}>{job.type || 'Encadenado'}</span>
                      </div>

                      <div style={{ marginTop: '4px', marginBottom: '6px' }}>
                        <span style={badgeStyle('#fff3cd', '#856404')}>
                          Ejecuta tras: {job.parentJobName || 'Job Padre'}
                        </span>
                      </div>

                      <div style={{ fontSize: '11px', color: '#495057', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {job.targetVMs && job.targetVMs.length > 0 && (
                          <div><strong>VMs respaldadas:</strong> <span style={{ color: '#28a745', fontWeight: '600' }}>{job.targetVMs.join(', ')}</span></div>
                        )}
                        <div><strong>Última ejec:</strong> {formatDate(job.lastRun)}</div>
                        <div><strong>Destino:</strong> <span style={{ color: '#6f42c1', fontWeight: '600' }}>{job.repositoryName || 'N/A'}</span></div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* COLUMNA 3: JOBS DE COPIA / TAPE / REPLICA */}
            <div style={flowColStyle}>
              <div style={columnHeaderStyle('#fd7e14')}>
                <span>3. Copias / Tape / Réplicas</span>
                <span style={badgeStyle('#fd7e14')}>{copyJobs.filter(j => filteredJobs.includes(j)).length}</span>
              </div>
              {copyJobs.filter(j => filteredJobs.includes(j)).length === 0 ? (
                <div style={{ color: '#999', fontStyle: 'italic', padding: '16px', textAlign: 'center', fontSize: '13px' }}>
                  Sin jobs de copia registrados
                </div>
              ) : (
                copyJobs.filter(j => filteredJobs.includes(j)).map(job => {
                  const isActive = hoveredNode?.type === 'job' && hoveredNode.id === job.id;
                  const isRelated = relatedElements.jobs.has(job.id);
                  const isDimmed = hoveredNode && !isActive && !isRelated;

                  return (
                    <div
                      key={job.id}
                      style={nodeCardStyle(isActive, isRelated, isDimmed)}
                      onMouseEnter={() => setHoveredNode({ type: 'job', id: job.id })}
                      onMouseLeave={() => setHoveredNode(null)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                        <div style={{ fontWeight: '700', fontSize: '13px', color: '#1a252f', flex: 1, paddingRight: '8px' }}>
                          {job.name}
                        </div>
                        <span style={badgeStyle('#ffe8cc', '#d35400')}>{job.type}</span>
                      </div>

                      {job.sourceJobNames && job.sourceJobNames.length > 0 && (
                        <div style={{ marginTop: '4px', marginBottom: '6px' }}>
                          <span style={badgeStyle('#d4edda', '#155724')}>
                            Origen: {job.sourceJobNames.join(', ')}
                          </span>
                        </div>
                      )}

                      <div style={{ fontSize: '11px', color: '#495057', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <div><strong>Frecuencia:</strong> Continuous / Copia</div>
                        <div><strong>Destino:</strong> <span style={{ color: '#d35400', fontWeight: '600' }}>{job.repositoryName || 'N/A'}</span></div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* COLUMNA 4: REPOSITORIOS DESTINO */}
            <div style={flowColStyle}>
              <div style={columnHeaderStyle('#28a745')}>
                <span>4. Repositorios Destino</span>
                <span style={badgeStyle('#28a745')}>{repositories.length}</span>
              </div>
              {repositories.length === 0 ? (
                <div style={{ color: '#999', fontStyle: 'italic', padding: '16px', textAlign: 'center', fontSize: '13px' }}>
                  Sin repositorios en caché
                </div>
              ) : (
                repositories.map(repo => {
                  const isActive = hoveredNode?.type === 'repo' && hoveredNode.id === repo.id;
                  const isRelated = relatedElements.repos.has(repo.id);
                  const isDimmed = hoveredNode && !isActive && !isRelated;

                  const assignedJobsCount = jobs.filter(j => j.repositoryId === repo.id).length;

                  return (
                    <div
                      key={repo.id}
                      style={nodeCardStyle(isActive, isRelated, isDimmed)}
                      onMouseEnter={() => setHoveredNode({ type: 'repo', id: repo.id })}
                      onMouseLeave={() => setHoveredNode(null)}
                    >
                      <div style={{ fontWeight: '700', fontSize: '13px', color: '#1a252f', marginBottom: '4px' }}>
                        {repo.name}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#6c757d', marginBottom: '6px' }}>
                        <span>Tipo: <strong>{repo.type || 'Local'}</strong></span>
                        <span style={badgeStyle('#e2e3e5', '#383d41')}>{assignedJobsCount} jobs asignados</span>
                      </div>

                      <div style={{ marginTop: '6px', height: '7px', width: '100%', backgroundColor: '#e9ecef', borderRadius: '4px', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${Math.min(100, repo.percent || 0)}%`,
                            backgroundColor: repo.percent > 85 ? '#dc3545' : (repo.percent > 70 ? '#ffc107' : '#28a745'),
                            transition: 'width 0.4s ease'
                          }}
                        />
                      </div>

                      <div style={{ fontSize: '10px', color: '#6c757d', marginTop: '4px', textAlign: 'right' }}>
                        {repo.used || 0} GB de {repo.capacity || 0} GB ({repo.percent || 0}%)
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* VISTA 3: LISTADO DETALLADO EN TABLA */}
      {activeTab === 'table' && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, color: '#2c3e50', fontSize: '16px' }}>
              Listado Completo de Configuración y Programación de Jobs
            </h3>
            <span style={{ fontSize: '12px', color: '#6c757d' }}>
              Mostrando {filteredJobs.length} de {jobs.length} jobs
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f1f3f5', borderBottom: '2px solid #dee2e6', color: '#495057', textAlign: 'left' }}>
                  <th style={{ padding: '12px 10px' }}>Nombre del Job</th>
                  <th style={{ padding: '12px 10px' }}>Tipo</th>
                  <th style={{ padding: '12px 10px' }}>VMs Respaldadas</th>
                  <th style={{ padding: '12px 10px' }}>Frecuencia ("Cada Cuánto")</th>
                  <th style={{ padding: '12px 10px' }}>Ejecución Tras (Job Padre)</th>
                  <th style={{ padding: '12px 10px' }}>Repositorio Destino</th>
                  <th style={{ padding: '12px 10px' }}>Última Ejecución</th>
                  <th style={{ padding: '12px 10px' }}>Próxima Ejecución</th>
                  <th style={{ padding: '12px 10px', textAlign: 'center' }}>RPs</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right' }}>Tamaño</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.length === 0 ? (
                  <tr>
                    <td colSpan="10" style={{ padding: '24px', textAlign: 'center', color: '#999', fontStyle: 'italic' }}>
                      No se encontraron trabajos con los criterios seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredJobs.map((job, idx) => {
                    const isChained = Boolean(job.parentJobId || job.parentJobName);
                    const isCopy = job.type === 'BackupCopy' || job.type === 'SimpleBackupCopyPolicy' || job.type === 'BackupToTape';

                    return (
                      <tr key={job.id || idx} style={{ borderBottom: '1px solid #e9ecef', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                        <td style={{ padding: '12px 10px', fontWeight: '600', color: '#1a252f' }}>
                          {job.name}
                        </td>
                        <td style={{ padding: '12px 10px' }}>
                          <span style={badgeStyle(
                            isCopy ? '#ffe8cc' : (isChained ? '#e2d9f3' : '#cce5ff'),
                            isCopy ? '#d35400' : (isChained ? '#4a00e0' : '#004085')
                          )}>
                            {job.type}
                          </span>
                        </td>
                        <td style={{ padding: '12px 10px', color: '#28a745', fontWeight: '600', fontSize: '12px' }}>
                          {job.targetVMs && job.targetVMs.length > 0 ? job.targetVMs.join(', ') : '—'}
                        </td>
                        <td style={{ padding: '12px 10px', fontWeight: '500', color: '#333' }}>
                          {job.scheduleDescription || 'Manual'}
                        </td>
                        <td style={{ padding: '12px 10px' }}>
                          {job.parentJobName ? (
                            <span style={badgeStyle('#fff3cd', '#856404')}>
                              {job.parentJobName}
                            </span>
                          ) : (
                            <span style={{ color: '#aaa', fontSize: '12px' }}>Ninguno (Independiente)</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 10px', color: '#0056b3', fontWeight: '600' }}>
                          {job.repositoryName || 'N/A'}
                        </td>
                        <td style={{ padding: '12px 10px', color: '#495057', fontSize: '12px' }}>
                          {formatDate(job.lastRun)}
                        </td>
                        <td style={{ padding: '12px 10px', color: '#495057', fontSize: '12px' }}>
                          {formatDate(job.nextRun)}
                        </td>
                        <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: '600' }}>
                          {job.restorePointsCount || 0}
                        </td>
                        <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: '500' }}>
                          {formatBytes(job.sizeInBytes)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
