import 'dotenv/config';
import { PrismaClient, RolUsuario } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEMO_IDS = {
  cajero1: '11111111-1111-4111-8111-111111111111',
  cajero2: '11111111-1111-4111-8111-111111111112',
  encargado: '22222222-2222-4222-8222-222222222222',
  configuracion: '33333333-3333-4333-8333-333333333333',
  metodoEfectivo: '44444444-4444-4444-8444-444444444441',
  metodoQr: '44444444-4444-4444-8444-444444444442',
  metodoTarjeta: '44444444-4444-4444-8444-444444444443',
  caja1: '55555555-5555-4555-8555-555555555501',
  caja2: '55555555-5555-4555-8555-555555555502',
  caja3: '55555555-5555-4555-8555-555555555503',
  caja4: '55555555-5555-4555-8555-555555555504',
} as const;

async function main(): Promise<void> {
  const cajero1Pin = process.env.SEED_CAJERO_PIN ?? '1234';
  const cajero2Pin = process.env.SEED_CAJERO2_PIN ?? '4321';
  const encargadoPin = process.env.SEED_ENCARGADO_PIN ?? '5678';

  const [cajero1Hash, cajero2Hash, encargadoHash] = await Promise.all([
    bcrypt.hash(cajero1Pin, 10),
    bcrypt.hash(cajero2Pin, 10),
    bcrypt.hash(encargadoPin, 10),
  ]);

  const usuariosDemo = [
    {
      id_usuario: DEMO_IDS.cajero1,
      nombre_completo: 'Lucas Gómez',
      pin_acceso_hash: cajero1Hash,
      rol_usuario: RolUsuario.CAJERO,
    },
    {
      id_usuario: DEMO_IDS.cajero2,
      nombre_completo: 'Sofía Pérez',
      pin_acceso_hash: cajero2Hash,
      rol_usuario: RolUsuario.CAJERO,
    },
    {
      id_usuario: DEMO_IDS.encargado,
      nombre_completo: 'Martín Ruiz',
      pin_acceso_hash: encargadoHash,
      rol_usuario: RolUsuario.ENCARGADO,
    },
  ];

  for (const u of usuariosDemo) {
    await prisma.usuario.upsert({
      where: { id_usuario: u.id_usuario },
      update: {
        nombre_completo: u.nombre_completo,
        pin_acceso_hash: u.pin_acceso_hash,
        rol_usuario: u.rol_usuario,
        esta_activo: true,
      },
      create: {
        ...u,
        esta_activo: true,
      },
    });
  }

  await prisma.configuracionCaja.upsert({
    where: { id_configuracion: DEMO_IDS.configuracion },
    update: {
      nombre_comercio: 'Supermercado Mayorista — Sucursal Centro',
      multiplo_redondeo_efectivo: '0.00',
      id_usuario_actualizacion: DEMO_IDS.encargado,
    },
    create: {
      id_configuracion: DEMO_IDS.configuracion,
      nombre_comercio: 'Supermercado Mayorista — Sucursal Centro',
      multiplo_redondeo_efectivo: '0.00',
      id_usuario_actualizacion: DEMO_IDS.encargado,
    },
  });

  const metodos = [
    {
      id_metodo_pago: DEMO_IDS.metodoEfectivo,
      codigo_metodo: 'EFECTIVO',
      nombre_metodo: 'Efectivo',
      permite_redondeo: true,
    },
    {
      id_metodo_pago: DEMO_IDS.metodoQr,
      codigo_metodo: 'QR_TRANSFERENCIA',
      nombre_metodo: 'QR / Transferencia',
      permite_redondeo: false,
    },
    {
      id_metodo_pago: DEMO_IDS.metodoTarjeta,
      codigo_metodo: 'TARJETA',
      nombre_metodo: 'Tarjeta Débito / Crédito',
      permite_redondeo: false,
    },
  ];

  for (const metodo of metodos) {
    await prisma.metodoPago.upsert({
      where: { codigo_metodo: metodo.codigo_metodo },
      update: {
        nombre_metodo: metodo.nombre_metodo,
        permite_redondeo: metodo.permite_redondeo,
        esta_activo: true,
      },
      create: {
        ...metodo,
        esta_activo: true,
      },
    });
  }

  const cajas = [
    { id_caja: DEMO_IDS.caja1, numero_caja: 1, nombre_caja: 'Caja 1 — Línea Principal' },
    { id_caja: DEMO_IDS.caja2, numero_caja: 2, nombre_caja: 'Caja 2 — Línea Principal' },
    { id_caja: DEMO_IDS.caja3, numero_caja: 3, nombre_caja: 'Caja 3 — Caja Rápida' },
    { id_caja: DEMO_IDS.caja4, numero_caja: 4, nombre_caja: 'Caja 4 — Mayorista' },
  ];

  for (const caja of cajas) {
    await prisma.caja.upsert({
      where: { numero_caja: caja.numero_caja },
      update: {
        nombre_caja: caja.nombre_caja,
        esta_activa: true,
      },
      create: {
        ...caja,
        esta_activa: true,
      },
    });
  }

  console.log('Seed multi-caja de ArqueoCaja ejecutado correctamente.');
}

main()
  .catch((error) => {
    console.error('Error al ejecutar el seed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
