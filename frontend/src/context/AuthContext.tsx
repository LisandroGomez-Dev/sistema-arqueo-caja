import * as Sentry from '@sentry/react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  guardarToken,
  iniciarSesionPin,
  invalidarCacheOperativa,
  limpiarToken,
  obtenerTokenGuardado,
  obtenerTurnoActivo,
  obtenerUsuarioActual,
  type OperadorPublico,
  type TurnoActivo,
} from '../services/api';

interface AuthContextValue {
  usuario: OperadorPublico | null;
  turnoActivo: TurnoActivo | null;
  cargando: boolean;
  iniciarSesion: (idUsuario: string, pin: string) => Promise<TurnoActivo | null>;
  cerrarSesion: () => void;
  refrescarTurnoActivo: () => Promise<TurnoActivo | null>;
  setTurnoActivo: (turno: TurnoActivo | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<OperadorPublico | null>(null);
  const [turnoActivo, setTurnoActivo] = useState<TurnoActivo | null>(null);
  const [cargando, setCargando] = useState(true);

  const cerrarSesion = useCallback(() => {
    limpiarToken();
    invalidarCacheOperativa();
    setUsuario(null);
    setTurnoActivo(null);
    Sentry.setUser(null);
  }, []);

  const refrescarTurnoActivo = useCallback(async (): Promise<TurnoActivo | null> => {
    const { turno } = await obtenerTurnoActivo();
    setTurnoActivo(turno);
    return turno;
  }, []);

  useEffect(() => {
    let cancelado = false;

    async function hidratarSesion() {
      const token = obtenerTokenGuardado();
      if (!token) {
        if (!cancelado) setCargando(false);
        return;
      }

      try {
        const [{ usuario: me }, { turno }] = await Promise.all([
          obtenerUsuarioActual(token),
          obtenerTurnoActivo(token),
        ]);
        if (!cancelado) {
          setUsuario(me);
          setTurnoActivo(turno);
          Sentry.setUser({ id: me.id_usuario, username: me.nombre_completo });
          Sentry.setTag('rol_usuario', me.rol_usuario);
        }
      } catch {
        if (!cancelado) {
          cerrarSesion();
        }
      } finally {
        if (!cancelado) {
          setCargando(false);
        }
      }
    }

    void hidratarSesion();
    return () => {
      cancelado = true;
    };
  }, [cerrarSesion]);

  const iniciarSesion = useCallback(
    async (idUsuario: string, pin: string): Promise<TurnoActivo | null> => {
      const { token, usuario: operador, turno } = await iniciarSesionPin(
        idUsuario,
        pin,
      );
      guardarToken(token);
      invalidarCacheOperativa();
      setUsuario(operador);
      setTurnoActivo(turno);
      Sentry.setUser({
        id: operador.id_usuario,
        username: operador.nombre_completo,
      });
      Sentry.setTag('rol_usuario', operador.rol_usuario);

      return turno;
    },
    [],
  );

  return (
    <AuthContext.Provider
      value={{
        usuario,
        turnoActivo,
        cargando,
        iniciarSesion,
        cerrarSesion,
        refrescarTurnoActivo,
        setTurnoActivo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe utilizarse dentro de AuthProvider.');
  }
  return ctx;
}
