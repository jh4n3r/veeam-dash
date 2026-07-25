// veeam-dashboard/src/App.js
import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import DashboardPage from './DashboardPage';
import LogsPage from './LogsPage';
import ConfigPage from './ConfigPage';
import DiagramsPage from './DiagramsPage';

// --- Estilos para la Navegación (MODIFICADO) ---
const navStyle = {
  display: 'flex',
  background: '#343a40',
  padding: '0 24px',
  borderBottom: '4px solid #007bff',

  // --- NUEVO: Hacer la barra FIJA ---
  position: 'fixed',
  top: '0',
  left: '0',
  right: '0', // o width: '100%'
  zIndex: 1020 // z-index alto
  // --- FIN NUEVO ---
};

// --- AÑADE ESTE BLOQUE DE VUELTA ---
const navLinkStyle = {
  color: 'white',
  padding: '16px 20px',
  textDecoration: 'none',
  fontWeight: '600',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
};
// --- FIN DEL BLOQUE A AÑADIR ---
// --- Estilo para el Título Principal ---
const headerTitleStyle = {
  color: '#ffffff',
  fontWeight: '700',
  margin: '0',
  padding: '14px 0',
  fontSize: '20px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
};

// --- Contenedor del Layout ---
const layoutStyle = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  backgroundColor: '#f8f9fa',
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column'
};

// --- ESTILO DE FOOTER ---
const footerStyle = {
  textAlign: 'center',
  padding: '20px',
  marginTop: 'auto',
  backgroundColor: '#343a40',
  color: '#adb5bd',
  fontSize: '14px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
};

// --- Estilo para el enlace del Footer ---
const footerLinkStyle = {
  color: '#ffffff',
  fontWeight: '600',
  textDecoration: 'none',
  transition: 'color 0.2s ease',
};


function App() {
  return (
    <BrowserRouter>
      <div style={layoutStyle}>

        {/* --- BARRA DE NAVEGACIÓN --- */}
        <nav style={navStyle} className="app-navbar no-print">
          <div style={{ ...navLinkStyle, marginRight: 'auto' }}>
            <h1 style={headerTitleStyle}>Veeam Dashboard</h1>
          </div>
          <Link to="/" style={navLinkStyle}>Dashboard</Link>
          <Link to="/logs" style={navLinkStyle}>Logs</Link>
          <Link to="/diagrams" style={navLinkStyle}>Diagramas</Link>
          <Link to="/config" style={navLinkStyle}>Configuración</Link>
        </nav>

        {/* --- CONTENIDO DE LA PÁGINA (MODIFICADO) --- */}
        <div style={{
          flex: '1 0 auto',
          paddingBottom: '24px',
          paddingTop: '88px' // Offset amplio para la barra fija superior
        }} className="app-content">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/logs" element={<LogsPage />} />
            <Route path="/diagrams" element={<DiagramsPage />} />
            <Route path="/config" element={<ConfigPage />} />
          </Routes>
        </div>

        {/* --- FOOTER --- */}
        <footer style={footerStyle} className="no-print">
          <span style={{ marginRight: '8px' }}>Desarrollado por</span>
          <a
            href="https://github.com/jh4n3r"
            target="_blank"
            rel="noopener noreferrer"
            style={footerLinkStyle}
          >
            @jh4n3r
          </a>
        </footer>

      </div>
    </BrowserRouter>
  );
}

export default App;