import { Loader2 } from 'lucide-react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AperturaPage } from './pages/AperturaPage';
import { CierreCajaPage } from './pages/CierreCajaPage';
import { ComprobanteCierrePage } from './pages/ComprobanteCierrePage';
import { EncargadoBasePage } from './pages/EncargadoBasePage';
import { HistorialEncargadoPage } from './pages/HistorialEncargadoPage';
import { LoginPage } from './pages/LoginPage';
import { MostradorBasePage } from './pages/MostradorBasePage';

function PantallaCarga() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
      <div className="flex items-center gap-2.5 text-sm font-medium text-slate-600">
        <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
        <span>Cargando sesión de mostrador...</span>
      </div>
    </div>
  );
}

function RutasAplicacion() {
  const { usuario, turnoActivo, cargando } = useAuth();

  if (cargando) {
    return <PantallaCarga />;
  }

  const rutaInicioUsuario = !usuario
    ? '/login'
    : usuario.rol_usuario === 'ENCARGADO'
      ? '/admin'
      : turnoActivo
        ? '/mostrador'
        : '/apertura';

  return (
    <Routes>
      <Route
        path="/login"
        element={
          usuario ? <Navigate to={rutaInicioUsuario} replace /> : <LoginPage />
        }
      />
      <Route
        path="/admin"
        element={
          !usuario ? (
            <Navigate to="/login" replace />
          ) : usuario.rol_usuario !== 'ENCARGADO' ? (
            <Navigate to={turnoActivo ? '/mostrador' : '/apertura'} replace />
          ) : (
            <EncargadoBasePage />
          )
        }
      />
      <Route
        path="/admin/historial"
        element={
          !usuario ? (
            <Navigate to="/login" replace />
          ) : usuario.rol_usuario !== 'ENCARGADO' ? (
            <Navigate to={turnoActivo ? '/mostrador' : '/apertura'} replace />
          ) : (
            <HistorialEncargadoPage />
          )
        }
      />
      <Route
        path="/apertura"
        element={
          !usuario ? (
            <Navigate to="/login" replace />
          ) : turnoActivo ? (
            <Navigate to="/mostrador" replace />
          ) : (
            <AperturaPage />
          )
        }
      />
      <Route
        path="/mostrador"
        element={
          !usuario ? (
            <Navigate to="/login" replace />
          ) : !turnoActivo ? (
            <Navigate to="/apertura" replace />
          ) : (
            <MostradorBasePage />
          )
        }
      />
      <Route
        path="/mostrador/:idTurno"
        element={
          !usuario ? (
            <Navigate to="/login" replace />
          ) : usuario.rol_usuario !== 'ENCARGADO' ? (
            <Navigate to={turnoActivo ? '/mostrador' : '/apertura'} replace />
          ) : (
            <MostradorBasePage />
          )
        }
      />
      <Route
        path="/cierre"
        element={
          !usuario ? (
            <Navigate to="/login" replace />
          ) : !turnoActivo ? (
            <Navigate to="/apertura" replace />
          ) : (
            <CierreCajaPage />
          )
        }
      />
      <Route
        path="/cierre/turno/:idTurno"
        element={
          !usuario ? (
            <Navigate to="/login" replace />
          ) : usuario.rol_usuario !== 'ENCARGADO' ? (
            <Navigate to={turnoActivo ? '/mostrador' : '/apertura'} replace />
          ) : (
            <CierreCajaPage />
          )
        }
      />
      <Route
        path="/cierre/comprobante/:idArqueo"
        element={
          !usuario ? <Navigate to="/login" replace /> : <ComprobanteCierrePage />
        }
      />
      <Route path="*" element={<Navigate to={rutaInicioUsuario} replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <RutasAplicacion />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
