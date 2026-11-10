import dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

dotenv.config();

declare global {
  var _postgresPool: Pool | undefined;
}

let railwayInternalUnreachable = false;

export const isRailwayEnvironment = (): boolean => {
  return Boolean(
    process.env.RAILWAY_DEPLOYMENT_ID ||
    process.env.RAILWAY_ENVIRONMENT ||
    process.env.RAILWAY_ENVIRONMENT_NAME ||
    process.env.RAILWAY_PROJECT_ID ||
    process.env.RAILWAY_SERVICE_ID ||
    process.env.RAILWAY_REPLICA_ID ||
    process.env.RAILWAY_PUBLIC_DOMAIN ||
    process.env.RAILWAY_STATIC_URL
  );
};

export const getDatabaseUrl = (): string | undefined => {
  const rawUrl =
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DB_URL ||
    process.env.SUPABASE_DATABASE_URL ||
    process.env.DIRECT_URL ||
    process.env.DATABASE_PUBLIC_URL ||
    process.env.DATABASE_PRIVATE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRESQL_URL ||
    process.env.RAILWAY_DATABASE_URL ||
    process.env.PGDATABASE_URL ||
    process.env.POSTGRESQL_DATABASE_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.STORAGE_URL ||
    process.env.STORAGE_POSTGRES_URL;

  if (rawUrl && rawUrl.trim()) {
    try {
      const trimmed = rawUrl.trim();
      if (trimmed.includes('pgbouncer=') || trimmed.includes('connection_limit=')) {
        const urlObj = new URL(trimmed);
        urlObj.searchParams.delete('pgbouncer');
        urlObj.searchParams.delete('connection_limit');
        return urlObj.toString();
      }
      return trimmed;
    } catch {
      return rawUrl.trim();
    }
  }

  const host = process.env.PGHOST || process.env.SQL_HOST || (isRailwayEnvironment() ? 'postgres.railway.internal' : undefined);
  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    const user = process.env.PGUSER || process.env.SQL_ADMIN_USER || process.env.SQL_USER || process.env.POSTGRES_USER || 'postgres';
    const password = process.env.PGPASSWORD || process.env.SQL_ADMIN_PASSWORD || process.env.SQL_PASSWORD || process.env.POSTGRES_PASSWORD || 'BtAxfEbKUqAEUhgOosZGQojEekrKcMl';
    const database = process.env.PGDATABASE || process.env.SQL_DB_NAME || process.env.POSTGRES_DB || 'railway';
    const port = process.env.PGPORT || process.env.SQL_PORT || '5432';
    if (host.startsWith('/')) {
      return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@localhost/${database}?host=${encodeURIComponent(host)}`;
    }
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
  }

  return undefined;
};

export const isDatabaseConfigured = (): boolean => {
  if (process.env.SQL_HOST && process.env.SQL_DB_NAME && (process.env.SQL_USER || process.env.SQL_ADMIN_USER)) {
    return true;
  }
  const dbUrl = getDatabaseUrl();
  if (dbUrl && dbUrl.trim() !== '') {
    // Se o host for postgres.railway.internal e NÃO estivermos no ambiente Railway, evita bloquear o preview local
    if (dbUrl.includes('.railway.internal') && !isRailwayEnvironment()) {
      return false;
    }
    return true;
  }
  return false;
};

export const createPool = (forceSsl?: boolean) => {
  if (!global._postgresPool || forceSsl !== undefined) {
    if (global._postgresPool && forceSsl !== undefined) {
      try { global._postgresPool.end().catch(() => {}); } catch {}
    }

    if (process.env.SQL_HOST) {
      const user = process.env.SQL_USER || process.env.SQL_ADMIN_USER || 'postgres';
      const password = process.env.SQL_PASSWORD || process.env.SQL_ADMIN_PASSWORD || '';
      const database = process.env.SQL_DB_NAME || 'postgres';
      console.log(`[DB] Criando Pool PostgreSQL via Cloud SQL Object Method (${process.env.SQL_HOST}, DB: ${database}, User: ${user})`);
      global._postgresPool = new Pool({
        host: process.env.SQL_HOST,
        user,
        password,
        database,
        max: 10,
        connectionTimeoutMillis: 15000,
        idleTimeoutMillis: 30000,
      });

      global._postgresPool.on('error', (err) => {
        console.error('Unexpected error on idle SQL pool client:', err);
      });
      return global._postgresPool;
    }

    const dbUrl = getDatabaseUrl();
    const rawHost = process.env.PGHOST;
    const hasExplicitUrl = Boolean(
      process.env.DATABASE_URL ||
      process.env.SUPABASE_DB_URL ||
      process.env.SUPABASE_DATABASE_URL ||
      process.env.DIRECT_URL ||
      process.env.DATABASE_PUBLIC_URL ||
      process.env.DATABASE_PRIVATE_URL ||
      process.env.POSTGRES_URL ||
      process.env.POSTGRESQL_URL ||
      process.env.RAILWAY_DATABASE_URL
    );

    if (!hasExplicitUrl && rawHost && rawHost.startsWith('/')) {
      const user = process.env.PGUSER || process.env.SQL_ADMIN_USER || process.env.SQL_USER || process.env.POSTGRES_USER || 'postgres';
      const password = process.env.PGPASSWORD || process.env.SQL_ADMIN_PASSWORD || process.env.SQL_PASSWORD || process.env.POSTGRES_PASSWORD || '';
      const database = process.env.PGDATABASE || process.env.SQL_DB_NAME || process.env.POSTGRES_DB || 'postgres';
      console.log(`[DB] Criando Pool PostgreSQL via Unix Socket (${rawHost}, DB: ${database})`);
      global._postgresPool = new Pool({
        host: rawHost,
        user,
        password,
        database,
        max: 10,
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000,
      });
    } else if (dbUrl) {
      const isUnixSocket = dbUrl.includes('/cloudsql') || dbUrl.includes('/app/cloudsql') || dbUrl.includes('host=%2F');
      const isLocal = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
      const isRailwayInternal = dbUrl.includes('.railway.internal');
      const useSSL = forceSsl !== undefined
        ? forceSsl
        : (!isUnixSocket && !isLocal && !isRailwayInternal && !dbUrl.includes('sslmode=disable'));

      const sslConfig = useSSL ? { rejectUnauthorized: false } : false;

      console.log(`[DB] Criando Pool PostgreSQL (SSL: ${useSSL}, RailwayInternal: ${isRailwayInternal}, UnixSocket: ${isUnixSocket})`);
      global._postgresPool = new Pool({
        connectionString: dbUrl,
        max: 10,
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000,
        keepAlive: true,
        ssl: sslConfig
      });
    } else {
      // Local development dummy pool
      global._postgresPool = new Pool({
        host: 'localhost',
        user: 'postgres',
        password: '',
        database: 'donamararevenda',
        port: 5432,
        max: 1,
        connectionTimeoutMillis: 500,
        idleTimeoutMillis: 500,
        ssl: false
      });
    }

    global._postgresPool.on('error', (err) => {
      console.warn('[DB Pool Notice] Conexão ociosa reciclada:', err?.message || err);
    });
  }
  return global._postgresPool;
};

export let pool = createPool();

export let db = drizzle(pool, { schema });

/**
 * Executa uma operação no banco de dados com auto-recuperação transparente em caso de socket fechado ou queda transitória.
 */
export async function withDbRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const msg = String(err?.message || err?.cause?.message || err?.cause || '');
      const isTransient =
        msg.includes('ECONNRESET') ||
        msg.includes('EPIPE') ||
        msg.includes('Connection terminated') ||
        msg.includes('socket closed') ||
        msg.includes('closed unexpectedly') ||
        msg.includes('terminating connection') ||
        msg.includes('connection reset') ||
        msg.includes('Client has encountered a connection error');
      if (isTransient && attempt < retries) {
        const delay = attempt * 400;
        console.warn(`[DB Retry] Tentativa ${attempt} encontrou socket transitório (${msg}), reconectando em ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  return await fn();
}

export async function testDatabaseConnection(): Promise<{ ok: boolean; host?: string; error?: string }> {
  if (!isDatabaseConfigured()) {
    return { ok: false, error: 'Variável de conexão (DATABASE_URL) não configurada ou host interno Railway fora do ambiente Railway.' };
  }
  try {
    const pingPromise = pool.query('SELECT 1 as ping');
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout (10s)')), 10000));
    const res: any = await Promise.race([pingPromise, timeoutPromise]);
    const dbUrl = getDatabaseUrl() || '';
    let host = 'PostgreSQL / Railway';
    try {
      if (dbUrl.includes('@')) {
        host = dbUrl.split('@')[1].split('/')[0].split(':')[0];
      }
    } catch {}
    return { ok: Boolean(res && res.rows && res.rows.length > 0), host };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

export async function ensureTablesExist() {
  if (!isDatabaseConfigured()) {
    return;
  }

  let isConnected = false;
  const dbUrl = getDatabaseUrl() || '';
  const initialSsl = !dbUrl.includes('.railway.internal') && !dbUrl.includes('localhost') && !dbUrl.includes('sslmode=disable');

  console.log(`[DB] Iniciando verificação de tabelas... (Host: ${dbUrl.includes('@') ? dbUrl.split('@')[1].split('/')[0] : 'local'})`);

  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const pingPromise = pool.query('SELECT 1 as ping');
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('PostgreSQL indisponível ou tempo limite atingido (15s)')), 15000));
      await Promise.race([pingPromise, timeoutPromise]);
      isConnected = true;
      railwayInternalUnreachable = false;
      break;
    } catch (pingErr: any) {
      const errMsg = String(pingErr?.message || pingErr || '');
      console.warn(`[DB] Tentativa ${attempt}/5 falhou: ${errMsg}`);
      
      if (errMsg.includes('ENOTFOUND') && dbUrl.includes('.railway.internal')) {
        console.warn('[DB] Host interno postgres.railway.internal inacessível fora da rede Railway.');
        if (attempt === 5) {
          railwayInternalUnreachable = true;
          return;
        }
      }
      
      if (attempt === 1 && (errMsg.includes('SSL') || errMsg.includes('pg_hba.conf') || errMsg.includes('ECONNRESET') || errMsg.includes('Connection terminated'))) {
        console.log(`[DB] Tentando alternar modo SSL para ${!initialSsl}...`);
        pool = createPool(!initialSsl);
        db = drizzle(pool, { schema });
        continue;
      }
      
      if (attempt < 5) {
        const delay = 2000 + (attempt * 1000);
        console.warn(`[DB] Aguardando ${delay}ms para nova tentativa...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  if (!isConnected) {
    console.error('[DB] ERRO CRÍTICO: Não foi possível conectar ao PostgreSQL após 5 tentativas. O sistema entrará em modo de OPERAÇÃO LIMITADA (Apenas Memória/Disco Local). Dados novos serão perdidos no próximo deploy!');
    railwayInternalUnreachable = true;
    return;
  }

  const runQuery = async (sql: string) => {
    try {
      await pool.query(sql);
    } catch (e: any) {
      console.warn('[DB Migration Warning]:', e?.message || e);
    }
  };

  // Executa a criação e atualização de todas as tabelas em bloco otimizado para inicialização rápida no Cloud Run + Supabase
  await runQuery(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      uid TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL,
      password TEXT,
      name TEXT,
      role TEXT DEFAULT 'operator',
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      "order" INTEGER DEFAULT 0,
      external_id TEXT,
      is_visible BOOLEAN DEFAULT TRUE,
      available_for_delivery BOOLEAN DEFAULT TRUE,
      available_in_store BOOLEAN DEFAULT TRUE,
      available_for_kiosk BOOLEAN DEFAULT TRUE
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      category_id TEXT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      price DOUBLE PRECISION NOT NULL DEFAULT 0,
      image_url TEXT DEFAULT '',
      is_active BOOLEAN DEFAULT TRUE,
      is_addon BOOLEAN DEFAULT FALSE,
      is_flavor BOOLEAN DEFAULT FALSE,
      addon_ids JSONB DEFAULT '[]'::jsonb,
      max_addons INTEGER DEFAULT 0,
      flavor_ids JSONB DEFAULT '[]'::jsonb,
      external_id TEXT,
      "order" INTEGER DEFAULT 0,
      allow_frozen BOOLEAN DEFAULT TRUE,
      available_for_delivery BOOLEAN DEFAULT TRUE,
      available_in_store BOOLEAN DEFAULT TRUE,
      available_for_kiosk BOOLEAN DEFAULT TRUE
    );
    ALTER TABLE products ADD COLUMN IF NOT EXISTS "order" INTEGER DEFAULT 0;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS allow_frozen BOOLEAN DEFAULT TRUE;

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      external_id TEXT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT DEFAULT '',
      cpf TEXT DEFAULT '',
      password TEXT DEFAULT '123456',
      address TEXT DEFAULT '',
      street TEXT DEFAULT '',
      number TEXT DEFAULT '',
      complement TEXT DEFAULT '',
      neighborhood TEXT DEFAULT '',
      cep TEXT DEFAULT '',
      source TEXT DEFAULT 'cadastro_cardapio',
      total_orders INTEGER DEFAULT 0,
      total_spent DOUBLE PRECISION DEFAULT 0,
      last_order_at BIGINT,
      created_at BIGINT NOT NULL,
      tags TEXT DEFAULT '[]',
      notes TEXT DEFAULT '',
      default_address_id TEXT,
      status TEXT DEFAULT 'approved',
      min_order_value DOUBLE PRECISION DEFAULT 0,
      monthly_goal DOUBLE PRECISION DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS customer_addresses (
      id TEXT PRIMARY KEY,
      customer_id TEXT,
      alias TEXT DEFAULT 'Principal',
      street TEXT NOT NULL,
      number TEXT NOT NULL,
      complement TEXT,
      neighborhood TEXT NOT NULL,
      cep TEXT NOT NULL,
      reference TEXT,
      is_default BOOLEAN DEFAULT FALSE,
      created_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      items JSONB NOT NULL,
      total DOUBLE PRECISION NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at BIGINT NOT NULL,
      type TEXT DEFAULT 'kiosk',
      payment_method TEXT DEFAULT '',
      customer_name TEXT DEFAULT '',
      customer_phone TEXT,
      customer_id TEXT,
      customer_email TEXT DEFAULT '',
      customer_cpf TEXT DEFAULT '',
      delivery_type TEXT,
      delivery_address TEXT,
      delivery_cep TEXT DEFAULT '',
      delivery_neighborhood TEXT DEFAULT '',
      delivery_fee DOUBLE PRECISION DEFAULT 0,
      table_number TEXT,
      table_id TEXT,
      driver_id TEXT,
      driver_name TEXT,
      delivery_status TEXT DEFAULT 'pending',
      delivery_accepted_at BIGINT,
      delivery_completed_at BIGINT,
      scheduled_time TEXT
    );

    CREATE TABLE IF NOT EXISTS delivery_zones (
      id TEXT PRIMARY KEY,
      neighborhood TEXT NOT NULL,
      cep_start TEXT NOT NULL DEFAULT '38000000',
      cep_end TEXT NOT NULL DEFAULT '38099999',
      fee DOUBLE PRECISION NOT NULL DEFAULT 5.00,
      is_active BOOLEAN DEFAULT TRUE,
      created_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS drivers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      vehicle TEXT DEFAULT 'Moto (Honda Fan - Placa XXX-0000)',
      pix_key TEXT DEFAULT '',
      status TEXT DEFAULT 'available',
      pin_code TEXT DEFAULT '1234',
      created_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS restaurant_tables (
      id TEXT PRIMARY KEY,
      number INTEGER NOT NULL,
      name TEXT NOT NULL,
      section TEXT DEFAULT 'Salão Principal',
      capacity INTEGER DEFAULT 4,
      status TEXT DEFAULT 'available',
      is_active BOOLEAN DEFAULT TRUE,
      created_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS store_info (
      id TEXT PRIMARY KEY DEFAULT 'default',
      name TEXT DEFAULT 'DONAMARA - REVENDA',
      theme_color TEXT DEFAULT '#e6a800',
      add_button_color TEXT DEFAULT '#e6a800',
      icon_color TEXT DEFAULT '#e6a800',
      header_phrase TEXT DEFAULT 'Salgados Especiais e Revenda',
      logo_url TEXT DEFAULT '',
      address TEXT DEFAULT '',
      hours TEXT DEFAULT '',
      instagram TEXT DEFAULT '',
      whatsapp TEXT DEFAULT '',
      category_title_color TEXT DEFAULT '#e6a800',
      delivery_enabled BOOLEAN DEFAULT FALSE,
      delivery_schedule_enabled BOOLEAN DEFAULT FALSE,
      delivery_schedule_slots TEXT DEFAULT '["08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00","18:30","19:00","19:30"]',
      min_order_value DOUBLE PRECISION DEFAULT 0,
      in_store_enabled BOOLEAN DEFAULT TRUE,
      kiosk_enabled BOOLEAN DEFAULT FALSE,
      require_qr_code_for_ordering BOOLEAN DEFAULT FALSE,
      is_open BOOLEAN DEFAULT TRUE,
      ntfy_topic TEXT DEFAULT 'donamara_pedidos',
      ntfy_enabled BOOLEAN DEFAULT TRUE,
      tv_ticker_text TEXT DEFAULT '',
      tv_mode TEXT DEFAULT 'split_menu',
      tv_selected_categories TEXT DEFAULT '[]',
      tv_sound_enabled BOOLEAN DEFAULT FALSE,
      tv_show_clock BOOLEAN DEFAULT TRUE,
      tv_show_captions BOOLEAN DEFAULT FALSE,
      is_maintenance BOOLEAN DEFAULT FALSE,
      maintenance_message TEXT DEFAULT 'Estamos atualizando nosso cardápio e sistemas para melhor atendê-lo. Voltaremos em breve!',
      weekly_schedule TEXT DEFAULT '[]',
      auto_open_close BOOLEAN DEFAULT FALSE,
      force_open BOOLEAN DEFAULT FALSE,
      closed_message TEXT DEFAULT 'Estamos fechados no momento. Confira nossos horários de atendimento!',
      ai_agent_enabled BOOLEAN DEFAULT TRUE,
      ai_agent_name TEXT DEFAULT 'Dona Mara IA',
      ai_agent_tone TEXT DEFAULT 'amigavel',
      ai_agent_custom_prompt TEXT DEFAULT '',
      ai_agent_whatsapp_phone TEXT DEFAULT '',
      ai_agent_whatsapp_default_message TEXT DEFAULT 'Olá! Gostaria de fazer um pedido ou tirar uma dúvida.',
      ai_agent_training_examples TEXT DEFAULT '[]',
      ai_agent_knowledge_base TEXT DEFAULT '',
      ai_agent_forbidden_phrases TEXT DEFAULT '',
      ai_agent_creativity DOUBLE PRECISION DEFAULT 0.65,
      ai_agent_anti_repeat BOOLEAN DEFAULT TRUE,
      in_store_gps_validation BOOLEAN DEFAULT FALSE,
      in_store_latitude DOUBLE PRECISION DEFAULT -19.7478,
      in_store_longitude DOUBLE PRECISION DEFAULT -47.9392,
      in_store_max_radius_meters INTEGER DEFAULT 150,
      in_store_pin_validation BOOLEAN DEFAULT FALSE,
      in_store_pin_code TEXT DEFAULT '1234',
      preferred_printer_name TEXT DEFAULT '',
      printer_cut_mode TEXT DEFAULT 'partial',
      printer_copies INTEGER DEFAULT 2,
      totem_printer_cut_mode TEXT DEFAULT 'partial',
      totem_printer_copies INTEGER DEFAULT 2,
      totem_printer_bottom_space_cm DOUBLE PRECISION DEFAULT 2.5,
      windows_printer_cut_mode TEXT DEFAULT 'partial',
      windows_printer_copies INTEGER DEFAULT 2,
      windows_printer_bottom_space_cm DOUBLE PRECISION DEFAULT 8.0,
      configured_printers TEXT DEFAULT '[]',
      caixa_printer_name TEXT DEFAULT '',
      auto_print_orders_on_caixa BOOLEAN DEFAULT TRUE,
      printer_connection_type TEXT DEFAULT 'network',
      network_printer_ip TEXT DEFAULT '',
      network_printer_port INTEGER DEFAULT 9100,
      mercado_pago_enabled BOOLEAN DEFAULT TRUE,
      mercado_pago_access_token TEXT DEFAULT '',
      mercado_pago_public_key TEXT DEFAULT '',
      mercado_pago_pix_key TEXT DEFAULT '',
      delivery_estimated_time_min INTEGER DEFAULT 35,
      delivery_estimated_time_max INTEGER DEFAULT 50,
      online_payment_enabled BOOLEAN DEFAULT FALSE,
      online_payment_operator TEXT DEFAULT 'mercadopago',
      online_payment_public_key TEXT DEFAULT '',
      online_payment_secret_key TEXT DEFAULT '',
      show_system_intro_button BOOLEAN DEFAULT TRUE
    );

    CREATE TABLE IF NOT EXISTS tv_media (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      url TEXT NOT NULL,
      duration_seconds INTEGER DEFAULT 15,
      "order" INTEGER DEFAULT 1,
      show_captions BOOLEAN DEFAULT FALSE,
      fit_mode TEXT DEFAULT 'fit',
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS app_installs (
      id TEXT PRIMARY KEY,
      platform TEXT DEFAULT 'unknown',
      browser TEXT DEFAULT 'unknown',
      device_type TEXT DEFAULT 'mobile',
      installed_at BIGINT NOT NULL,
      user_agent TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS totem_backups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      active_categories_count INTEGER DEFAULT 0,
      active_products_count INTEGER DEFAULT 0,
      categories JSONB DEFAULT '[]'::jsonb,
      products JSONB DEFAULT '[]'::jsonb
    );
  `);

  // Garantir colunas incrementais caso o banco já existisse anteriormente
  await runQuery(`
    ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_visible BOOLEAN DEFAULT TRUE;
    ALTER TABLE categories ADD COLUMN IF NOT EXISTS external_id TEXT;
    ALTER TABLE categories ADD COLUMN IF NOT EXISTS available_for_delivery BOOLEAN DEFAULT TRUE;
    ALTER TABLE categories ADD COLUMN IF NOT EXISTS available_in_store BOOLEAN DEFAULT TRUE;
    ALTER TABLE categories ADD COLUMN IF NOT EXISTS available_for_kiosk BOOLEAN DEFAULT TRUE;

    ALTER TABLE products ADD COLUMN IF NOT EXISTS available_for_delivery BOOLEAN DEFAULT TRUE;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS available_in_store BOOLEAN DEFAULT TRUE;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS available_for_kiosk BOOLEAN DEFAULT TRUE;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS is_addon BOOLEAN DEFAULT FALSE;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS is_flavor BOOLEAN DEFAULT FALSE;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS addon_ids JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS max_addons INTEGER DEFAULT 0;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS flavor_ids JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS external_id TEXT;

    ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_customer_id_customers_id_fk;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email TEXT DEFAULT '';
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_cpf TEXT DEFAULT '';
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_cep TEXT DEFAULT '';
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_neighborhood TEXT DEFAULT '';
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_fee DOUBLE PRECISION DEFAULT 0;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_id TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_name TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'pending';
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_accepted_at BIGINT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_completed_at BIGINT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS scheduled_time TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS scheduled_date TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS scheduled_day TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS scheduled_pickup_time TEXT;

    ALTER TABLE customers ADD COLUMN IF NOT EXISTS external_id TEXT;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS email TEXT DEFAULT '';
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS cpf TEXT DEFAULT '';
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS password TEXT DEFAULT '123456';
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS address TEXT DEFAULT '';
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS street TEXT DEFAULT '';
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS number TEXT DEFAULT '';
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS complement TEXT DEFAULT '';
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS neighborhood TEXT DEFAULT '';
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS cep TEXT DEFAULT '';
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'cadastro_cardapio';
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS total_orders INTEGER DEFAULT 0;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS total_spent DOUBLE PRECISION DEFAULT 0;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_order_at BIGINT;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS tags TEXT DEFAULT '[]';
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS default_address_id TEXT;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'approved';
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS min_order_value DOUBLE PRECISION DEFAULT 0;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS monthly_goal DOUBLE PRECISION DEFAULT 0;

    ALTER TABLE store_info ADD COLUMN IF NOT EXISTS min_order_value DOUBLE PRECISION DEFAULT 0;
    ALTER TABLE store_info ADD COLUMN IF NOT EXISTS delivery_schedule_enabled BOOLEAN DEFAULT FALSE;
    ALTER TABLE store_info ADD COLUMN IF NOT EXISTS delivery_schedule_slots TEXT DEFAULT '["08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00","18:30","19:00","19:30"]';
    ALTER TABLE store_info ADD COLUMN IF NOT EXISTS online_payment_enabled BOOLEAN DEFAULT FALSE;
    ALTER TABLE store_info ADD COLUMN IF NOT EXISTS online_payment_operator TEXT DEFAULT 'mercadopago';
    ALTER TABLE store_info ADD COLUMN IF NOT EXISTS online_payment_public_key TEXT DEFAULT '';
    ALTER TABLE store_info ADD COLUMN IF NOT EXISTS online_payment_secret_key TEXT DEFAULT '';
    ALTER TABLE store_info ADD COLUMN IF NOT EXISTS mercado_pago_enabled BOOLEAN DEFAULT TRUE;
    ALTER TABLE store_info ADD COLUMN IF NOT EXISTS mercado_pago_access_token TEXT DEFAULT '';
    ALTER TABLE store_info ADD COLUMN IF NOT EXISTS mercado_pago_public_key TEXT DEFAULT '';
    ALTER TABLE store_info ADD COLUMN IF NOT EXISTS mercado_pago_pix_key TEXT DEFAULT '';
    ALTER TABLE store_info ADD COLUMN IF NOT EXISTS delivery_estimated_time_min INTEGER DEFAULT 35;
    ALTER TABLE store_info ADD COLUMN IF NOT EXISTS delivery_estimated_time_max INTEGER DEFAULT 50;
    ALTER TABLE store_info ADD COLUMN IF NOT EXISTS schedule_slot_item_capacity INTEGER DEFAULT 100;
    ALTER TABLE store_info ADD COLUMN IF NOT EXISTS schedule_prep_time_normal_minutes INTEGER DEFAULT 40;
    ALTER TABLE store_info ADD COLUMN IF NOT EXISTS schedule_prep_time_frozen_minutes INTEGER DEFAULT 90;
    ALTER TABLE store_info ADD COLUMN IF NOT EXISTS show_system_intro_button BOOLEAN DEFAULT TRUE;
    ALTER TABLE store_info ADD COLUMN IF NOT EXISTS sms_reminder_time_1 TEXT DEFAULT '09:00';
    ALTER TABLE store_info ADD COLUMN IF NOT EXISTS sms_reminder_time_2 TEXT DEFAULT '12:00';
    ALTER TABLE store_info ADD COLUMN IF NOT EXISTS sms_reminder_time_3 TEXT DEFAULT '15:00';
    ALTER TABLE store_info ADD COLUMN IF NOT EXISTS sms_reminders_enabled BOOLEAN DEFAULT TRUE;
    ALTER TABLE store_info ADD COLUMN IF NOT EXISTS auto_sms_webhook_url TEXT DEFAULT '';
    ALTER TABLE store_info ADD COLUMN IF NOT EXISTS auto_sms_api_key TEXT DEFAULT '';
    ALTER TABLE store_info ADD COLUMN IF NOT EXISTS order_sound_enabled BOOLEAN DEFAULT TRUE;
    ALTER TABLE store_info ADD COLUMN IF NOT EXISTS order_chime_enabled BOOLEAN DEFAULT TRUE;
  `);
}
