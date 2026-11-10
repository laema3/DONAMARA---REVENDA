import { Express, Request, Response } from 'express';
import { db, pool, ensureTablesExist, isDatabaseConfigured, getDatabaseUrl, testDatabaseConnection, withDbRetry, isRailwayEnvironment } from '../db/index';
import { categories, products, orders, storeInfo, users, tvMedia, appInstalls, customers, restaurantTables, drivers, deliveryZones, totemBackups, customerAddresses } from '../db/schema';
import { eq, desc, asc, sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { registerAiRoutes } from './aiAssistant';
import { cleanProductDescription } from '../constants';
import { printOrderToNetworkPrinter } from './printerRoutes';
import { queueOrderForAgent } from './printerAgentRoutes';
import { createPixPayment, checkPixStatus, confirmPixPayment, processCardPayment } from './mercadoPagoService';
import { buildDocumentationPdf } from '../utils/generateDocumentationPdf';

// Initial default data for auto-seeding & in-memory fallback (clean state for new ERP integration)
const DEFAULT_CATEGORIES: any[] = [];

const DEFAULT_PRODUCTS: any[] = [];

const DEFAULT_STORE_INFO = {
  id: 'default',
  name: 'DONAMARA - REVENDA',
  themeColor: '#dc2626',
  addButtonColor: '#139f09',
  iconColor: '#dc2626',
  headerPhrase: 'Salgados Especiais e Revenda',
  logoUrl: '/logo.png',
  address: '',
  hours: '',
  instagram: '',
  whatsapp: '',
  categoryTitleColor: '#dc2626',
  deliveryEnabled: false,
  deliveryScheduleEnabled: true,
  deliveryScheduleSlots: '["09:30","10:00","10:30","11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00","18:30","19:00","19:30","09:00"]',
  scheduleSlotItemCapacity: 100,
  schedulePrepTimeNormalMinutes: 40,
  schedulePrepTimeFrozenMinutes: 90,
  inStoreEnabled: true,
  kioskEnabled: false,
  requireQrCodeForOrdering: false,
  isOpen: true,
  ntfyTopic: 'donamara_pedidos',
  ntfyEnabled: true,
  tvTickerText: '🥟 Salgados fresquinhos e crocantes para revenda e consumo! Peça pelo app ou no balcão!',
  tvMode: 'split_orders',
  tvSelectedCategories: '[]',
  tvSoundEnabled: false,
  tvShowClock: true,
  tvShowCaptions: false,
  isMaintenance: false,
  maintenanceMessage: 'Estamos atualizando nosso cardápio e sistemas para melhor atendê-lo. Voltaremos em breve!',
  weeklySchedule: '[]',
  autoOpenClose: false,
  forceOpen: true,
  closedMessage: 'Estamos fechados no momento. Confira nossos horários de atendimento!',
  aiAgentEnabled: false,
  aiAgentName: 'Dona Mara IA',
  aiAgentTone: 'amigavel',
  aiAgentCustomPrompt: 'Salgados fresquinhos para festa e revenda. Aceitamos encomendas pelo app e WhatsApp.',
  aiAgentWhatsAppPhone: '',
  aiAgentWhatsAppDefaultMessage: 'Olá! Gostaria de fazer um pedido.',
  aiAgentTrainingExamples: '[]',
  aiAgentKnowledgeBase: '',
  aiAgentForbiddenPhrases: '',
  aiAgentCreativity: 0.65,
  aiAgentAntiRepeat: true,
  inStoreGpsValidation: false,
  inStoreLatitude: -19.7478,
  inStoreLongitude: -47.9392,
  inStoreMaxRadiusMeters: 150,
  inStorePinValidation: false,
  inStorePinCode: '1234',
  preferredPrinterName: '',
  printerCutMode: 'partial',
  printerCopies: 2,
  totemPrinterCutMode: 'partial',
  totemPrinterCopies: 2,
  totemPrinterBottomSpaceCm: 2.5,
  windowsPrinterCutMode: 'partial',
  windowsPrinterCopies: 2,
  windowsPrinterBottomSpaceCm: 8.0,
  configuredPrinters: '[]',
  caixaPrinterName: '',
  autoPrintOrdersOnCaixa: false,
  printerConnectionType: 'network',
  networkPrinterIp: '',
  networkPrinterPort: 9100,
  mercadoPagoEnabled: false,
  mercadoPagoAccessToken: '',
  mercadoPagoPublicKey: '',
  mercadoPagoPixKey: '',
  deliveryEstimatedTimeMin: 35,
  deliveryEstimatedTimeMax: 50,
  showSystemIntroButton: false,
  minOrderValue: 150,
  smsReminderTime1: '09:00',
  smsReminderTime2: '12:00',
  smsReminderTime3: '15:00',
  smsRemindersEnabled: true,
  autoSmsWebhookUrl: '',
  autoSmsApiKey: '',
};

export function sanitizeStoreInfoPrinters(info: any) {
  if (!info) return info;
  if (info.totemPrinterCopies === undefined || info.totemPrinterCopies === 1) {
    info.totemPrinterCopies = 2;
  }
  if (info.printerCopies === undefined) {
    info.printerCopies = 2;
  }
  if (info.windowsPrinterCopies === undefined) {
    info.windowsPrinterCopies = 2;
  }
  return info;
}

const STORAGE_DIR = path.join(process.cwd(), '.data', 'donamara_persistent_store');
try {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
} catch (e) {}

// Dynamic auto-import for user uploaded backup files
try {
  const assetDir = path.join(process.cwd(), 'public', 'assets', 'aistudio');
  let latestBackupPath: string | null = null;
  let latestMtime = 0;

  if (fs.existsSync(assetDir)) {
    const dirFiles = fs.readdirSync(assetDir);
    for (const file of dirFiles) {
      if (file.startsWith('donamara_backup_') && file.endsWith('.json')) {
        const fullP = path.join(assetDir, file);
        const stat = fs.statSync(fullP);
        if (stat.mtimeMs > latestMtime) {
          latestMtime = stat.mtimeMs;
          latestBackupPath = fullP;
        }
      }
    }
  }

  if (latestBackupPath) {
    const storeInfoPath = path.join(STORAGE_DIR, '.store_info_data.json');
    let shouldImport = !fs.existsSync(storeInfoPath);
    if (fs.existsSync(storeInfoPath)) {
      const existingStat = fs.statSync(storeInfoPath);
      // Importa apenas se o arquivo de backup for significativamente mais recente que o store_info no disco
      if (latestMtime > existingStat.mtimeMs + 10000) {
        shouldImport = true;
      }
    }

    if (shouldImport) {
      const backupRaw = fs.readFileSync(latestBackupPath, 'utf8');
      const backupData = JSON.parse(backupRaw);
      if (backupData) {
        const seedDir = path.join(process.cwd(), 'src', 'data', 'seed');
        if (!fs.existsSync(seedDir)) {
          try { fs.mkdirSync(seedDir, { recursive: true }); } catch (e) {}
        }

        const syncItem = (key: string, fileName: string) => {
          const val = backupData[key];
          if (val !== undefined && val !== null) {
            let finalVal = val;

            // SMART MERGE for orders & customers so existing seed/disk items are NEVER overwritten or lost
            if (key === 'orders' || key === 'customers') {
              const baseName = fileName.replace('.json', '');
              const altName = baseName.includes('_data') ? baseName.replace('_data', '') : baseName + '_data';
              const seedDirFile = path.join(seedDir, `${baseName}.json`);
              const existingSeed: any[] = loadJsonFile(seedDirFile, []);
              const backupList: any[] = Array.isArray(val) ? val : [];

              const map = new Map<string, any>();
              // Carrega primeiro os itens existentes em disco/seed para que eles tenham prioridade absoluta
              for (const item of existingSeed) {
                if (item && item.id) map.set(String(item.id), item);
              }
              // Adiciona os itens do backup apenas se já não existirem
              for (const item of backupList) {
                if (item && item.id && !map.has(String(item.id))) {
                  map.set(String(item.id), item);
                }
              }
              finalVal = Array.from(map.values());
              if (key === 'orders') {
                finalVal.sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
              }
            }

            try {
              fs.writeFileSync(path.join(STORAGE_DIR, `.${fileName}`), JSON.stringify(finalVal, null, 2), 'utf8');
            } catch (e) {}
            try {
              const baseName = fileName.replace('.json', '');
              const altName = baseName.includes('_data') ? baseName.replace('_data', '') : baseName + '_data';
              fs.writeFileSync(path.join(seedDir, `${baseName}.json`), JSON.stringify(finalVal, null, 2), 'utf8');
              fs.writeFileSync(path.join(seedDir, `${altName}.json`), JSON.stringify(finalVal, null, 2), 'utf8');
            } catch (e) {}
          }
        };

        syncItem('storeInfo', 'store_info_data.json');
        syncItem('categories', 'categories_data.json');
        syncItem('products', 'products_data.json');
        syncItem('customers', 'customers_data.json');
        syncItem('users', 'users_data.json');
        syncItem('tvMedia', 'tv_media_data.json');
        syncItem('tables', 'tables_data.json');
        // NOTA: Pedidos nunca são sobrescritos por backups estáticos no boot. Pedidos são transacionais e gerenciados pelo PostgreSQL / disco vivo.
        syncItem('totemBackups', 'totem_backups_data.json');
        syncItem('drivers', 'drivers_data.json');
        syncItem('deliveryZones', 'delivery_zones_data.json');

        console.log(`[Auto-Import Backup] Dados do backup (${path.basename(latestBackupPath)}) importados e mesclados com sucesso para STORAGE_DIR e src/data/seed/!`);
      }
    }
  }
} catch (e) {
  console.warn('Aviso: Falha ao importar backup automático:', e);
}

const STORE_INFO_FILE = path.join(STORAGE_DIR, '.store_info_data.json');
const TV_MEDIA_FILE = path.join(STORAGE_DIR, '.tv_media_data.json');
const CATEGORIES_FILE = path.join(STORAGE_DIR, '.categories_data.json');
const PRODUCTS_FILE = path.join(STORAGE_DIR, '.products_data.json');
const USERS_FILE = path.join(STORAGE_DIR, '.users_data.json');
const ORDERS_FILE = path.join(STORAGE_DIR, '.orders_data.json');
const ORDERS_BACKUP_FILE = path.join(STORAGE_DIR, '.orders_backup_data.json');
const CUSTOMERS_FILE = path.join(STORAGE_DIR, '.customers_data.json');
const TABLES_FILE = path.join(STORAGE_DIR, '.tables_data.json');
const APP_INSTALLS_FILE = path.join(STORAGE_DIR, '.app_installs_data.json');
const TOTEM_BACKUPS_FILE = path.join(STORAGE_DIR, '.totem_backups_data.json');
const MASTER_STATE_FILE = path.join(STORAGE_DIR, '.app_persistent_state.json');
const DRIVERS_FILE = path.join(STORAGE_DIR, '.drivers_data.json');

const DEFAULT_DRIVERS: any[] = [];

let memDrivers: any[] = [];
if (fs.existsSync(DRIVERS_FILE)) {
  try {
    memDrivers = JSON.parse(fs.readFileSync(DRIVERS_FILE, 'utf8'));
  } catch (e) {}
}



const DELIVERY_ZONES_FILE = path.join(STORAGE_DIR, '.delivery_zones_data.json');
const DEFAULT_DELIVERY_ZONES: any[] = [];

let memDeliveryZones: any[] = [];
if (fs.existsSync(DELIVERY_ZONES_FILE)) {
  try {
    memDeliveryZones = JSON.parse(fs.readFileSync(DELIVERY_ZONES_FILE, 'utf8'));
  } catch (e) {}
}

function persistDeliveryZonesToDisk(data: any[]) {
  writeJsonFile(DELIVERY_ZONES_FILE, data);
  persistAllStateToMasterFile();
  syncPublicBackupAssets('deliveryZones', data);
  syncSeedFiles('deliveryZones', data);
}

const DEFAULT_USERS = [
  { id: 1, uid: 'master-1', email: 'camillasites@gmail.com', name: 'Camilla (Master)', role: 'master', password: 'admin' },
  { id: 2, uid: 'master-4', email: 'admin@donamara.com.br', name: 'Admin Master', role: 'master', password: 'admin123' },
];

const DEFAULT_TABLES: any[] = [];

// In-memory runtime state (serves local preview & instant fallback)
let memCategories: any[] = [...DEFAULT_CATEGORIES];
let memProducts: any[] = [...DEFAULT_PRODUCTS];
let memOrders: any[] = [];
let memStoreInfo: any = { ...DEFAULT_STORE_INFO };
let memCustomers: any[] = [];
let memUsers: any[] = [...DEFAULT_USERS];
let memTvMedia: any[] = [];
let memAppInstalls: any[] = [];
let memTables: any[] = [...DEFAULT_TABLES];
let memTotemBackups: any[] = [];

// Helper functions for safe disk persistence
function loadJsonFile<T>(filePath: string, fallback: T): T {
  try {
    // 1. Prioritize direct primary file path if it exists and is valid
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed !== undefined && parsed !== null) {
          if (Array.isArray(fallback)) {
            if (Array.isArray(parsed)) return parsed as unknown as T;
          } else {
            return parsed as T;
          }
        }
      } catch (_) {}
    }

    // 2. Fall back to seed directories if primary file does not exist
    const baseName = path.basename(filePath).replace(/^\./, '');
    const altBaseName = baseName.includes('_data.json') 
      ? baseName.replace('_data.json', '.json') 
      : baseName.replace('.json', '_data.json');

    const candidatePaths = [
      path.join(process.cwd(), 'src', 'data', 'seed', baseName),
      path.join(process.cwd(), 'src', 'data', 'seed', altBaseName),
      path.join(process.cwd(), 'dist', 'seed', baseName),
      path.join(process.cwd(), 'dist', 'seed', altBaseName),
      path.join(process.cwd(), baseName),
      path.join(process.cwd(), altBaseName),
    ];

    for (const cand of candidatePaths) {
      if (fs.existsSync(cand)) {
        try {
          const raw = fs.readFileSync(cand, 'utf8');
          const parsed = JSON.parse(raw);
          if (parsed !== undefined && parsed !== null) {
            if (Array.isArray(fallback)) {
              if (Array.isArray(parsed)) return parsed as unknown as T;
            } else {
              return parsed as T;
            }
          }
        } catch (_) {}
      }
    }
  } catch (e) {
    console.warn(`Aviso: Não foi possível ler ${path.basename(filePath)}:`, e);
  }
  return fallback;
}

function writeJsonFile(filePath: string, data: any) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    // Also keep permanent seed folder synchronized so repo always has latest backup
    // Never overwrite non-empty seed files with an empty array
    if (Array.isArray(data) && data.length === 0) {
      return;
    }
    const baseName = path.basename(filePath).replace(/^\./, '');
    const altBaseName = baseName.includes('_data.json') 
      ? baseName.replace('_data.json', '.json') 
      : baseName.replace('.json', '_data.json');

    const seedDirs = [
      path.join(process.cwd(), 'src', 'data', 'seed'),
      path.join(process.cwd(), 'dist', 'seed')
    ];

    for (const dir of seedDirs) {
      if (dir.includes('dist') && !fs.existsSync(path.join(process.cwd(), 'dist'))) {
        continue;
      }
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(path.join(dir, baseName), JSON.stringify(data, null, 2), 'utf8');
      if (altBaseName !== baseName) {
        fs.writeFileSync(path.join(dir, altBaseName), JSON.stringify(data, null, 2), 'utf8');
      }
    }
  } catch (e) {
    console.warn(`Aviso: Não foi possível gravar ${path.basename(filePath)}:`, e);
  }
}

function persistAllStateToMasterFile() {
  const masterPayload = {
    storeInfo: memStoreInfo,
    tvMedia: memTvMedia,
    categories: memCategories,
    products: memProducts,
    users: memUsers,
    tables: memTables,
    customers: memCustomers,
    orders: memOrders,
    totemBackups: memTotemBackups,
    drivers: memDrivers,
    deliveryZones: memDeliveryZones,
    savedAt: new Date().toISOString()
  };
  writeJsonFile(MASTER_STATE_FILE, masterPayload);
}

// 1. Carregar Estado Inicial de Todos os Arquivos Persistidos
// Permanent bundled seed files (ensures full catalog survives container rebuilds)
const seedProducts: any[] = loadJsonFile(path.join(process.cwd(), 'src', 'data', 'seed', 'products_data.json'), []);
const seedCategories: any[] = loadJsonFile(path.join(process.cwd(), 'src', 'data', 'seed', 'categories_data.json'), []);
const seedCustomers: any[] = loadJsonFile(path.join(process.cwd(), 'src', 'data', 'seed', 'customers_data.json'), []);
const seedStoreInfo: any = loadJsonFile(path.join(process.cwd(), 'src', 'data', 'seed', 'store_info_data.json'), {});
const seedTvMedia: any[] = loadJsonFile(path.join(process.cwd(), 'src', 'data', 'seed', 'tv_media_data.json'), []);
const seedTotemBackups: any[] = loadJsonFile(path.join(process.cwd(), 'src', 'data', 'seed', 'totem_backups_data.json'), []);

// 1. Carregar Estado Inicial de Todos os Arquivos Persistidos
try {
  const masterState = loadJsonFile<any>(MASTER_STATE_FILE, null);

  const diskCategories = loadJsonFile(CATEGORIES_FILE, []);
  const diskProducts = loadJsonFile(PRODUCTS_FILE, []);
  const diskCustomers = loadJsonFile(CUSTOMERS_FILE, []);

  memCategories = (Array.isArray(diskCategories) && diskCategories.length > 0)
    ? diskCategories
    : (Array.isArray(masterState?.categories) && masterState.categories.length > 0)
      ? masterState.categories
      : (Array.isArray(seedCategories) && seedCategories.length > 0)
        ? seedCategories
        : DEFAULT_CATEGORIES;

  memProducts = (Array.isArray(diskProducts) && diskProducts.length > 0)
    ? diskProducts
    : (Array.isArray(masterState?.products) && masterState.products.length > 0)
      ? masterState.products
      : (Array.isArray(seedProducts) && seedProducts.length > 0)
        ? seedProducts
        : DEFAULT_PRODUCTS;

  memTvMedia = loadJsonFile(TV_MEDIA_FILE, masterState?.tvMedia || (Array.isArray(seedTvMedia) && seedTvMedia.length > 0 ? seedTvMedia : []));
  const autoBackupPath = path.join(process.cwd(), 'public', 'assets', 'aistudio', 'donamara_backup_latest_auto.json');
  let backupStoreInfo = null;
  if (fs.existsSync(autoBackupPath)) {
    try {
      const autoJson = JSON.parse(fs.readFileSync(autoBackupPath, 'utf8'));
      if (autoJson && autoJson.storeInfo) {
        backupStoreInfo = autoJson.storeInfo;
      }
    } catch {}
  }
  const diskStoreInfo = loadJsonFile<any>(STORE_INFO_FILE, {});
  const baseStore = { ...DEFAULT_STORE_INFO, ...seedStoreInfo, ...(backupStoreInfo || {}), ...(masterState?.storeInfo || {}) };
  memStoreInfo = {
    ...baseStore,
    ...diskStoreInfo,
    weeklySchedule: (diskStoreInfo.weeklySchedule && diskStoreInfo.weeklySchedule !== '[]')
      ? diskStoreInfo.weeklySchedule
      : (baseStore.weeklySchedule || DEFAULT_STORE_INFO.weeklySchedule)
  };
  const initialDiskOrders = loadJsonFile(ORDERS_FILE, []);
  const initialSeedOrders = loadJsonFile(path.join(process.cwd(), 'src', 'data', 'seed', 'orders_data.json'), []);
  const initOrderMap = new Map<string, any>();
  [...initialSeedOrders, ...initialDiskOrders].forEach((o: any) => {
    if (o && o.id) initOrderMap.set(String(o.id), o);
  });
  memOrders = Array.from(initOrderMap.values()).sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
  const rawCustomers = (Array.isArray(diskCustomers) && diskCustomers.length > 0)
    ? diskCustomers
    : (Array.isArray(masterState?.customers) && masterState.customers.length > 0)
      ? masterState.customers
      : (Array.isArray(seedCustomers) && seedCustomers.length > 0)
        ? seedCustomers
        : [];
  memCustomers = rawCustomers
    .filter((c: any) => c.source !== 'pedido_totem' && c.source !== 'totem' && (c.name || '').toLowerCase() !== 'cliente totem')
    .map((c: any) => ({
      ...c,
      status: (c.status === 'rejected') ? 'rejected' : 'approved'
    }));
  memUsers = loadJsonFile(USERS_FILE, masterState?.users || DEFAULT_USERS);
  const adminMasterIdx = memUsers.findIndex((u: any) => (u.email || '').trim().toLowerCase() === 'admin@donamara.com.br');
  if (adminMasterIdx >= 0) {
    memUsers[adminMasterIdx] = {
      ...memUsers[adminMasterIdx],
      name: memUsers[adminMasterIdx].name || 'Admin Master',
      role: 'master',
      password: 'admin123'
    };
  } else {
    memUsers.push({ id: 2, uid: 'master-4', email: 'admin@donamara.com.br', name: 'Admin Master', role: 'master', password: 'admin123' });
  }
  memTables = loadJsonFile(TABLES_FILE, masterState?.tables || DEFAULT_TABLES);
  memAppInstalls = loadJsonFile(APP_INSTALLS_FILE, []);
  memTotemBackups = loadJsonFile(TOTEM_BACKUPS_FILE, masterState?.totemBackups || (Array.isArray(seedTotemBackups) ? seedTotemBackups : []));

  // Se não houver backups salvos, cria o primeiro backup padrão automaticamente
  if (memTotemBackups.length === 0 && memCategories.length > 0) {
    const activeCats = memCategories.map(c => ({
      id: c.id,
      name: c.name,
      externalId: c.externalId,
      availableForKiosk: c.availableForKiosk !== false
    }));
    const activeProds = memProducts.map(p => ({
      id: p.id,
      name: p.name,
      externalId: p.externalId,
      categoryId: p.categoryId,
      availableForKiosk: p.availableForKiosk !== false
    }));
    memTotemBackups = [{
      id: `totem_bkp_baseline_${Date.now()}`,
      name: 'Backup Inicial Padrão Totem',
      createdAt: new Date().toISOString(),
      activeCategoriesCount: activeCats.filter(c => c.availableForKiosk).length,
      activeProductsCount: activeProds.filter(p => p.availableForKiosk).length,
      categories: activeCats,
      products: activeProds
    }];
    writeJsonFile(TOTEM_BACKUPS_FILE, memTotemBackups);
  }
} catch (e) {
  console.warn('Aviso: Falha na inicialização dos dados persistidos:', e);
}

// A hidratação autoritativa do PostgreSQL é executada sequencialmente pelo server.ts (hydrateFromPostgres)


let productsVersion = Date.now();
let categoriesVersion = Date.now();
let storeInfoVersion = Date.now();

function syncPublicBackupAssets(key: string, data: any) {
  try {
    const assetDir = path.join(process.cwd(), 'public', 'assets', 'aistudio');
    if (!fs.existsSync(assetDir)) {
      fs.mkdirSync(assetDir, { recursive: true });
    }

    // 1. Synchronize all backup JSON files in public/assets/aistudio/
    if (fs.existsSync(assetDir)) {
      const files = fs.readdirSync(assetDir);
      for (const file of files) {
        if (file.startsWith('donamara_backup_') && file.endsWith('.json')) {
          const fullP = path.join(assetDir, file);
          try {
            const raw = fs.readFileSync(fullP, 'utf8');
            const json = JSON.parse(raw);
            if (json && typeof json === 'object') {
              json[key] = data;
              json.updatedAt = new Date().toISOString();
              fs.writeFileSync(fullP, JSON.stringify(json, null, 2), 'utf8');
            }
          } catch (err) {}
        }
      }
    }

    // 2. Also keep a master latest backup asset in public/assets/aistudio
    const autoBackupPath = path.join(assetDir, 'donamara_backup_latest_auto.json');
    let autoData: any = {};
    if (fs.existsSync(autoBackupPath)) {
      try {
        autoData = JSON.parse(fs.readFileSync(autoBackupPath, 'utf8')) || {};
      } catch {}
    }
    autoData[key] = data;
    autoData.storeInfo = (key === 'storeInfo') ? data : (autoData.storeInfo || memStoreInfo);
    autoData.categories = (key === 'categories') ? data : (autoData.categories || memCategories);
    autoData.products = (key === 'products') ? data : (autoData.products || memProducts);
    autoData.customers = (key === 'customers') ? data : (autoData.customers || memCustomers);
    autoData.orders = (key === 'orders') ? data : (autoData.orders || memOrders);
    autoData.users = (key === 'users') ? data : (autoData.users || memUsers);
    autoData.updatedAt = new Date().toISOString();
    fs.writeFileSync(autoBackupPath, JSON.stringify(autoData, null, 2), 'utf8');
  } catch (e) {
    console.warn(`[Sync Public Backup] Aviso ao sincronizar backup public de ${key}:`, e);
  }
}

function syncSeedFiles(key: string, data: any) {
  try {
    const seedDir = path.join(process.cwd(), 'src', 'data', 'seed');
    if (!fs.existsSync(seedDir)) {
      fs.mkdirSync(seedDir, { recursive: true });
    }
    const mapping: Record<string, string> = {
      storeInfo: 'store_info',
      categories: 'categories',
      products: 'products',
      users: 'users',
      customers: 'customers',
      tables: 'tables',
      totemBackups: 'totem_backups',
      drivers: 'drivers',
      deliveryZones: 'delivery_zones',
      tvMedia: 'tv_media',
      orders: 'orders'
    };
    const baseName = mapping[key] || key;
    fs.writeFileSync(path.join(seedDir, `${baseName}_data.json`), JSON.stringify(data, null, 2), 'utf8');
    fs.writeFileSync(path.join(seedDir, `${baseName}.json`), JSON.stringify(data, null, 2), 'utf8');

    const appStatePath = path.join(seedDir, 'app_persistent_state.json');
    if (fs.existsSync(appStatePath)) {
      try {
        const json = JSON.parse(fs.readFileSync(appStatePath, 'utf8')) || {};
        json[key] = data;
        fs.writeFileSync(appStatePath, JSON.stringify(json, null, 2), 'utf8');
      } catch {}
    }

    const appStateDataPath = path.join(seedDir, 'app_persistent_state_data.json');
    if (fs.existsSync(appStateDataPath)) {
      try {
        const json = JSON.parse(fs.readFileSync(appStateDataPath, 'utf8')) || {};
        json[key] = data;
        fs.writeFileSync(appStateDataPath, JSON.stringify(json, null, 2), 'utf8');
      } catch {}
    }

    const masterStatePath = path.join(seedDir, 'master_state.json');
    if (fs.existsSync(masterStatePath)) {
      try {
        const json = JSON.parse(fs.readFileSync(masterStatePath, 'utf8')) || {};
        json[key] = data;
        fs.writeFileSync(masterStatePath, JSON.stringify(json, null, 2), 'utf8');
      } catch {}
    }
  } catch (err) {
    console.warn(`[Sync Seed Files] Erro ao sincronizar seed de ${key}:`, err);
  }
}

function persistTotemBackupsToDisk(data: any[]) {
  writeJsonFile(TOTEM_BACKUPS_FILE, data);
  persistAllStateToMasterFile();
  syncPublicBackupAssets('totemBackups', data);
  syncSeedFiles('totemBackups', data);
}

function persistCategoriesToDisk(data: any[]) {
  if (!Array.isArray(data)) return;
  categoriesVersion = Date.now();
  writeJsonFile(CATEGORIES_FILE, data);
  persistAllStateToMasterFile();
  syncPublicBackupAssets('categories', data);
  syncSeedFiles('categories', data);
}

function persistProductsToDisk(data: any[]) {
  if (!Array.isArray(data)) return;
  productsVersion = Date.now();
  writeJsonFile(PRODUCTS_FILE, data);
  persistAllStateToMasterFile();
  syncPublicBackupAssets('products', data);
  syncSeedFiles('products', data);
}

function persistTvMediaToDisk(data: any[]) {
  writeJsonFile(TV_MEDIA_FILE, data);
  persistAllStateToMasterFile();
  syncPublicBackupAssets('tvMedia', data);
  syncSeedFiles('tvMedia', data);
}

function persistUsersToDisk(data: any[]) {
  writeJsonFile(USERS_FILE, data);
  persistAllStateToMasterFile();
  syncPublicBackupAssets('users', data);
  syncSeedFiles('users', data);
}

export function formatOrderForDb(order: any) {
  return {
    id: String(order.id),
    items: typeof order.items === 'string' ? JSON.parse(order.items) : (order.items || []),
    total: Number(order.total) || 0,
    status: String(order.status || 'pending'),
    createdAt: Number(order.createdAt) || Date.now(),
    type: order.type || 'kiosk',
    paymentMethod: order.paymentMethod || '',
    customerName: order.customerName || '',
    customerPhone: order.customerPhone || null,
    customerId: order.customerId || null,
    customerEmail: order.customerEmail || '',
    customerCpf: order.customerCpf || '',
    deliveryType: order.deliveryType || null,
    deliveryAddress: order.deliveryAddress || null,
    deliveryCep: order.deliveryCep || '',
    deliveryNeighborhood: order.deliveryNeighborhood || '',
    deliveryFee: Number(order.deliveryFee) || 0,
    tableNumber: order.tableNumber ? String(order.tableNumber) : null,
    tableId: order.tableId || null,
    driverId: order.driverId || null,
    driverName: order.driverName || null,
    deliveryStatus: order.deliveryStatus || 'pending',
    deliveryAcceptedAt: order.deliveryAcceptedAt ? Number(order.deliveryAcceptedAt) : null,
    deliveryCompletedAt: order.deliveryCompletedAt ? Number(order.deliveryCompletedAt) : null,
    scheduledTime: order.scheduledTime || null,
    scheduledDate: order.scheduledDate || null,
    scheduledDay: order.scheduledDay || null,
    scheduledPickupTime: order.scheduledPickupTime || null
  };
}

function persistOrdersToDisk(data: any[]) {
  if (!Array.isArray(data)) return;
  writeJsonFile(ORDERS_FILE, data);
  writeJsonFile(ORDERS_BACKUP_FILE, data);
  persistAllStateToMasterFile();
  syncPublicBackupAssets('orders', data);
  syncSeedFiles('orders', data);
}

function persistStoreInfoToDisk(data: any) {
  storeInfoVersion = Date.now();
  writeJsonFile(STORE_INFO_FILE, data);
  persistAllStateToMasterFile();
  syncPublicBackupAssets('storeInfo', data);
  syncSeedFiles('storeInfo', data);
}

function persistCustomersToDisk(data: any[]) {
  writeJsonFile(CUSTOMERS_FILE, data);
  persistAllStateToMasterFile();
  syncPublicBackupAssets('customers', data);
  syncSeedFiles('customers', data);
}

function persistTablesToDisk(data: any[]) {
  writeJsonFile(TABLES_FILE, data);
  persistAllStateToMasterFile();
  syncPublicBackupAssets('tables', data);
  syncSeedFiles('tables', data);
}

function persistDriversToDisk(data: any[]) {
  writeJsonFile(DRIVERS_FILE, data);
  persistAllStateToMasterFile();
  syncPublicBackupAssets('drivers', data);
  syncSeedFiles('drivers', data);
}

function persistAppInstallsToDisk(data: any[]) {
  writeJsonFile(APP_INSTALLS_FILE, data);
}

function calculateNextOrderNumber(currentOrders: any[] = []): string {
  const usedNumbers = new Set<number>();
  let maxNum = 0;
  currentOrders.forEach(o => {
    if (!o || !o.id) return;
    const digits = String(o.id).replace(/\D/g, '');
    if (digits) {
      const num = parseInt(digits, 10);
      if (!isNaN(num) && num >= 1 && num <= 99999) {
        usedNumbers.add(num);
        if (num > maxNum) maxNum = num;
      }
    }
  });
  let candidate = maxNum + 1;
  if (candidate > 99999) {
    candidate = 1;
    while (usedNumbers.has(candidate)) {
      candidate++;
    }
  }
  return String(candidate).padStart(4, '0');
}

export function getMemStoreInfo() {
  return memStoreInfo || DEFAULT_STORE_INFO;
}

export function formatProductForDb(p: any) {
  return {
    id: String(p.id || `prod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`),
    categoryId: p.categoryId ? String(p.categoryId) : (p.category_id ? String(p.category_id) : null),
    name: String(p.name || 'Produto sem nome').trim(),
    description: cleanProductDescription(p.description || '', false),
    price: typeof p.price === 'number' ? (isNaN(p.price) ? 0 : p.price) : (parseFloat(p.price) || 0),
    imageUrl: p.imageUrl ? String(p.imageUrl) : (p.image_url ? String(p.image_url) : ''),
    isActive: p.isActive !== false && p.is_active !== false,
    isAddon: Boolean(p.isAddon || p.is_addon),
    isFlavor: Boolean(p.isFlavor || p.is_flavor),
    addonIds: Array.isArray(p.addonIds) ? p.addonIds : (Array.isArray(p.addon_ids) ? p.addon_ids : []),
    maxAddons: typeof p.maxAddons === 'number' ? p.maxAddons : (parseInt(p.max_addons, 10) || 0),
    flavorIds: Array.isArray(p.flavorIds) ? p.flavorIds : (Array.isArray(p.flavor_ids) ? p.flavor_ids : []),
    externalId: p.externalId ? String(p.externalId) : (p.external_id ? String(p.external_id) : null),
    order: typeof p.order === 'number' ? p.order : (parseInt(p.order, 10) || 0),
    allowFrozen: p.allowFrozen !== false && p.allow_frozen !== false,
    availableForDelivery: p.availableForDelivery !== false && p.available_for_delivery !== false,
    availableInStore: p.availableInStore !== false && p.available_in_store !== false,
    availableForKiosk: p.availableForKiosk !== false && p.available_for_kiosk !== false,
  };
}

export function formatCategoryForDb(c: any) {
  return {
    id: String(c.id || `cat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`),
    name: String(c.name || 'Categoria sem nome').trim(),
    order: typeof c.order === 'number' ? c.order : (parseInt(c.order, 10) || 0),
    externalId: c.externalId ? String(c.externalId) : (c.external_id ? String(c.external_id) : null),
    isVisible: c.isVisible !== false && c.is_visible !== false,
    availableForDelivery: c.availableForDelivery !== false && c.available_for_delivery !== false,
    availableInStore: c.availableInStore !== false && c.available_in_store !== false,
    availableForKiosk: c.availableForKiosk !== false && c.available_for_kiosk !== false,
  };
}

export async function saveProductsToPostgresBatch(productList: any[]): Promise<number> {
  if (!isDatabaseConfigured() || !Array.isArray(productList) || productList.length === 0) return 0;
  const sanitized = productList.map(formatProductForDb);
  const CHUNK_SIZE = 50;
  let savedCount = 0;

  for (let i = 0; i < sanitized.length; i += CHUNK_SIZE) {
    const chunk = sanitized.slice(i, i + CHUNK_SIZE);
    try {
      await withDbRetry(async () => {
        for (const item of chunk) {
          await db.insert(products)
            .values(item)
            .onConflictDoUpdate({
              target: products.id,
              set: {
                name: item.name,
                categoryId: item.categoryId,
                description: item.description,
                price: item.price,
                imageUrl: item.imageUrl,
                isActive: item.isActive,
                isAddon: item.isAddon,
                isFlavor: item.isFlavor,
                addonIds: item.addonIds,
                maxAddons: item.maxAddons,
                flavorIds: item.flavorIds,
                externalId: item.externalId,
                availableForDelivery: item.availableForDelivery,
                availableInStore: item.availableInStore,
                availableForKiosk: item.availableForKiosk,
              }
            });
        }
      });
      savedCount += chunk.length;
    } catch (chunkErr) {
      console.warn(`[DB Batch Insert] Aviso no bloco ${i}-${i + chunk.length}:`, chunkErr);
      for (const item of chunk) {
        try {
          await db.insert(products).values(item).onConflictDoUpdate({
            target: products.id,
            set: {
              name: item.name,
              categoryId: item.categoryId,
              description: item.description,
              price: item.price,
              imageUrl: item.imageUrl,
              isActive: item.isActive,
              externalId: item.externalId,
            }
          });
          savedCount++;
        } catch (itemErr) {
          console.warn(`[DB Product Item Error] Item ${item.id} pulado:`, itemErr);
        }
      }
    }
  }
  return savedCount;
}

export async function saveCategoriesToPostgresBatch(categoryList: any[]): Promise<number> {
  if (!isDatabaseConfigured() || !Array.isArray(categoryList) || categoryList.length === 0) return 0;
  const sanitized = categoryList.map(formatCategoryForDb);
  let saved = 0;
  for (const cat of sanitized) {
    try {
      await withDbRetry(() =>
        db.insert(categories).values(cat).onConflictDoUpdate({
          target: categories.id,
          set: {
            name: cat.name,
            order: cat.order,
            externalId: cat.externalId,
            isVisible: cat.isVisible,
            availableForDelivery: cat.availableForDelivery,
            availableInStore: cat.availableInStore,
            availableForKiosk: cat.availableForKiosk,
          }
        })
      );
      saved++;
    } catch (e) {
      console.warn(`[DB Cat Error] Falha na categoria ${cat.id}:`, e);
    }
  }
  return saved;
}

export function formatCustomerForDb(c: any) {
  let tagsStr = '[]';
  if (Array.isArray(c.tags)) {
    tagsStr = JSON.stringify(c.tags);
  } else if (typeof c.tags === 'string' && c.tags.trim()) {
    try {
      const parsed = JSON.parse(c.tags.trim());
      tagsStr = Array.isArray(parsed) ? JSON.stringify(parsed) : JSON.stringify([String(parsed)]);
    } catch {
      tagsStr = JSON.stringify(c.tags.split(',').map((t: string) => t.trim()).filter(Boolean));
    }
  }
  const extId = c.externalId ? String(c.externalId).trim() : (c.external_id ? String(c.external_id).trim() : null);
  const rawCpf = String(c.cpf ?? '').trim();
  const cleanCpfDigits = rawCpf.replace(/\D/g, '');
  const defaultPassFromCpf = cleanCpfDigits.length >= 5 ? cleanCpfDigits.slice(0, 5) : '12345';
  const rawPass = String(c.password ?? '').trim();
  const finalPassword = (rawPass && rawPass !== '123456') ? rawPass : defaultPassFromCpf;

  return {
    id: String(c.id || (extId ? `bf_cust_${extId}` : `cust_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`)),
    externalId: extId,
    name: String(c.name || 'Cliente').trim(),
    phone: String(c.phone ?? '').trim(),
    email: String(c.email ?? '').trim(),
    cpf: rawCpf,
    password: finalPassword,
    address: String(c.address ?? '').trim(),
    street: String(c.street ?? '').trim(),
    number: String(c.number ?? '').trim(),
    complement: String(c.complement ?? '').trim(),
    neighborhood: String(c.neighborhood ?? '').trim(),
    cep: String(c.cep ?? '').trim(),
    source: String(c.source || 'cadastro_cardapio'),
    totalOrders: typeof c.totalOrders === 'number' ? c.totalOrders : (parseInt(c.total_orders, 10) || 0),
    totalSpent: typeof c.totalSpent === 'number' ? (isNaN(c.totalSpent) ? 0 : c.totalSpent) : (parseFloat(c.total_spent) || 0),
    lastOrderAt: (c.lastOrderAt || c.last_order_at) ? Number(c.lastOrderAt || c.last_order_at) : null,
    createdAt: Number(c.createdAt || c.created_at || Date.now()),
    tags: tagsStr,
    notes: String(c.notes ?? '').trim(),
    defaultAddressId: c.defaultAddressId || c.default_address_id || null,
    status: c.status === 'rejected' ? 'rejected' : (c.status === 'pending' ? 'pending' : 'approved'),
    minOrderValue: typeof c.minOrderValue === 'number' ? c.minOrderValue : (parseFloat(c.min_order_value) || 0),
    monthlyGoal: typeof c.monthlyGoal === 'number' ? c.monthlyGoal : (parseFloat(c.monthly_goal ?? c.monthlyGoal) || 0),
  };
}

export async function saveCustomersToPostgresBatch(customerList: any[]): Promise<number> {
  if (!isDatabaseConfigured() || !Array.isArray(customerList) || customerList.length === 0) return 0;
  const sanitized = customerList.map(formatCustomerForDb);
  const CHUNK_SIZE = 50;
  let savedCount = 0;

  for (let i = 0; i < sanitized.length; i += CHUNK_SIZE) {
    const chunk = sanitized.slice(i, i + CHUNK_SIZE);
    try {
      await withDbRetry(async () => {
        for (const item of chunk) {
          await db.insert(customers)
            .values(item)
            .onConflictDoUpdate({
              target: customers.id,
              set: {
                externalId: item.externalId,
                name: item.name,
                phone: item.phone,
                email: item.email,
                cpf: item.cpf,
                password: item.password,
                address: item.address,
                street: item.street,
                number: item.number,
                complement: item.complement,
                neighborhood: item.neighborhood,
                cep: item.cep,
                source: item.source,
                totalOrders: item.totalOrders,
                totalSpent: item.totalSpent,
                lastOrderAt: item.lastOrderAt,
                tags: item.tags,
                notes: item.notes,
                defaultAddressId: item.defaultAddressId,
                status: item.status,
                minOrderValue: item.minOrderValue,
                monthlyGoal: item.monthlyGoal,
              }
            });
        }
      });
      savedCount += chunk.length;
    } catch (chunkErr) {
      console.warn(`[DB Customers Batch Insert] Aviso no bloco ${i}-${i + chunk.length}:`, chunkErr);
      for (const item of chunk) {
        try {
          await db.insert(customers).values(item).onConflictDoUpdate({
            target: customers.id,
            set: {
              externalId: item.externalId,
              name: item.name,
              phone: item.phone,
              email: item.email,
              cpf: item.cpf,
              password: item.password,
              address: item.address,
              street: item.street,
              number: item.number,
              complement: item.complement,
              neighborhood: item.neighborhood,
              cep: item.cep,
              source: item.source,
              tags: item.tags,
              notes: item.notes,
              status: item.status,
              monthlyGoal: item.monthlyGoal,
            }
          });
          savedCount++;
        } catch (itemErr) {
          console.warn(`[DB Customer Item Error] Item ${item.id} pulado:`, itemErr);
        }
      }
    }
  }
  return savedCount;
}

/**
 * Hidrata o estado em memória diretamente do PostgreSQL ao inicializar o servidor.
 * Garante que em ambientes com disco efêmero (como Render e contêineres),
 * configurações cruciais (horários, status de loja, totem, delivery e agente IA)
 * NUNCA sejam perdidas ao subir novas versões.
 */
let hydrationPromise: Promise<void> | null = null;
let isHydrated = false;

export async function waitForHydration(maxWaitMs = 15000): Promise<void> {
  if (isHydrated) return;
  if (!hydrationPromise) {
    hydrateFromPostgres().catch(() => {});
  }
  if (!hydrationPromise) return;
  try {
    await Promise.race([
      hydrationPromise,
      new Promise<void>((resolve) => setTimeout(resolve, maxWaitMs))
    ]);
  } catch {}
}

export async function hydrateFromPostgres(): Promise<void> {
  if (hydrationPromise) {
    return hydrationPromise;
  }
  hydrationPromise = (async () => {
    await ensureTablesExist();

    if (!isDatabaseConfigured()) {
      console.log('[DB Hydrate] Banco de dados não configurado, mantendo estado do disco/memória.');
      isHydrated = true;
      return;
    }

    try {
      console.log('[DB Hydrate] Hidratando estado da loja e cadastros diretamente do PostgreSQL / Railway...');
      
      // 1. Hidratar Store Info
      try {
        const storeList = await withDbRetry(() => db.select().from(storeInfo).where(eq(storeInfo.id, 'default')));
        const diskVal: any = loadJsonFile(STORE_INFO_FILE, {});
        const autoBackupPath = path.join(process.cwd(), 'public', 'assets', 'aistudio', 'donamara_backup_latest_auto.json');
        let backupStoreInfo = null;
        if (fs.existsSync(autoBackupPath)) {
          try {
            const autoJson = JSON.parse(fs.readFileSync(autoBackupPath, 'utf8'));
            if (autoJson && autoJson.storeInfo) backupStoreInfo = autoJson.storeInfo;
          } catch {}
        }

        if (storeList && storeList.length > 0) {
          const dbRow: any = storeList[0];
          // Se o banco estiver com weeklySchedule vazio ou padrão mas tivermos backup, prioriza o backup/disco!
          const hasValidDbSchedule = dbRow.weeklySchedule && dbRow.weeklySchedule !== '[]' && dbRow.weeklySchedule !== DEFAULT_STORE_INFO.weeklySchedule;
          const chosenStoreSource = (!hasValidDbSchedule && backupStoreInfo?.weeklySchedule && backupStoreInfo.weeklySchedule !== '[]') 
            ? backupStoreInfo 
            : (diskVal?.weeklySchedule && diskVal.weeklySchedule !== '[]' ? diskVal : dbRow);

          const merged: any = { 
            ...DEFAULT_STORE_INFO, 
            ...(backupStoreInfo || {}),
            ...diskVal,
            ...dbRow,
            ...chosenStoreSource,
            id: 'default' 
          };

          if (chosenStoreSource.weeklySchedule && chosenStoreSource.weeklySchedule !== '[]') {
            merged.weeklySchedule = chosenStoreSource.weeklySchedule;
          }
          if (chosenStoreSource.hours) {
            merged.hours = chosenStoreSource.hours;
          }

          memStoreInfo = sanitizeStoreInfoPrinters(merged);
          persistStoreInfoToDisk(memStoreInfo);
          console.log(`[DB Hydrate] StoreInfo carregada AUTORITATIVAMENTE (com fallback inteligente): "${memStoreInfo.name}"`);
        } else {
          // Se a tabela store_info estiver vazia, injeta imediatamente os dados do backup automático ou disco!
          const merged: any = { 
            ...DEFAULT_STORE_INFO, 
            ...(backupStoreInfo || {}),
            ...diskVal,
            id: 'default' 
          };
          memStoreInfo = sanitizeStoreInfoPrinters(merged);
          persistStoreInfoToDisk(memStoreInfo);
          await withDbRetry(() => db.insert(storeInfo).values(memStoreInfo).onConflictDoNothing());
          console.log('[DB Hydrate] Restaurada linha default em store_info no PostgreSQL a partir do backup.');
        }
      } catch (storeErr: any) {
        console.warn('[DB Hydrate] Aviso ao carregar store_info do PostgreSQL:', storeErr?.message || storeErr);
      }

      // 2. Hidratar Categorias
      try {
        const catList = await withDbRetry(() => db.select().from(categories));
        if (catList && catList.length > 0) {
          memCategories = catList.sort((a, b) => (a.order || 0) - (b.order || 0));
          persistCategoriesToDisk(memCategories);
          console.log(`[DB Hydrate] ${memCategories.length} categorias carregadas do PostgreSQL.`);
        } else if (memCategories.length > 0) {
          const saved = await saveCategoriesToPostgresBatch(memCategories);
          console.log(`[DB Hydrate] Banco sem categorias; ${saved} categorias restauradas do backup local para o PostgreSQL.`);
        }
      } catch (catErr: any) {
        console.warn('[DB Hydrate] Aviso ao carregar categories do PostgreSQL:', catErr?.message || catErr);
      }

      // 3. Hidratar Produtos
      try {
        let prodList;
        try {
          prodList = await withDbRetry(() => db.select().from(products));
        } catch (err: any) {
          if (err?.message && (err.message.includes('column') || err.message.includes('does not exist'))) {
            await ensureTablesExist();
            prodList = await withDbRetry(() => db.select().from(products));
          } else {
            throw err;
          }
        }
        if (prodList && prodList.length > 0) {
          memProducts = prodList;
          persistProductsToDisk(memProducts);
          console.log(`[DB Hydrate] ${memProducts.length} produtos carregados do PostgreSQL.`);
        } else if (memProducts.length > 0) {
          const saved = await saveProductsToPostgresBatch(memProducts);
          console.log(`[DB Hydrate] Banco sem produtos; ${saved} produtos restauradas do backup local para o PostgreSQL.`);
        }
      } catch (prodErr: any) {
        console.warn('[DB Hydrate] Aviso ao carregar products do PostgreSQL:', prodErr?.message || prodErr);
      }

    // 3.0. Hidratar Totem Backups
    try {
      const tbList = await withDbRetry(() => db.select().from(totemBackups).orderBy(desc(totemBackups.createdAt)));
      memTotemBackups = tbList || [];
      persistTotemBackupsToDisk(memTotemBackups);
      console.log(`[DB Hydrate] ${memTotemBackups.length} backups do totem carregados do PostgreSQL.`);
    } catch (tbErr: any) {
      console.warn('[DB Hydrate] Aviso ao carregar totem_backups do PostgreSQL:', tbErr?.message || tbErr);
    }

    // 3.1. Hidratar Clientes
    try {
      let custList;
      try {
        custList = await withDbRetry(() => db.select().from(customers));
      } catch (err: any) {
        if (err?.message && (err.message.includes('column') || err.message.includes('does not exist'))) {
          await ensureTablesExist();
          custList = await withDbRetry(() => db.select().from(customers));
        } else {
          throw err;
        }
      }
      if (custList && custList.length > 0) {
        memCustomers = custList;
        persistCustomersToDisk(memCustomers);
        console.log(`[DB Hydrate] ${memCustomers.length} clientes carregados do PostgreSQL.`);
      } else if (memCustomers.length > 0) {
        const saved = await saveCustomersToPostgresBatch(memCustomers);
        console.log(`[DB Hydrate] Banco sem clientes; ${saved} clientes restaurados do backup local para o PostgreSQL.`);
      }
    } catch (custErr: any) {
      console.warn('[DB Hydrate] Aviso ao carregar customers do PostgreSQL:', custErr?.message || custErr);
    }

      // 3.2. Hidratar Pedidos
      try {
        console.log('[DB Hydrate] Consultando pedidos do PostgreSQL para restauração autoritativa...');
        const ordList = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(5000);
        
        if (ordList && ordList.length > 0) {
          // Quando o PostgreSQL possui pedidos, ele é a FONTE AUTORITATIVA DEFINITIVA!
          const parsedDbOrders = ordList.map(o => ({
            ...o,
            items: typeof o.items === 'string' ? JSON.parse(o.items) : (o.items || [])
          }));
          memOrders = parsedDbOrders.sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
          persistOrdersToDisk(memOrders);
          console.log(`[DB Hydrate] SUCESSO: ${memOrders.length} pedidos reais carregados diretamente do PostgreSQL.`);
        } else {
          // Se o banco PostgreSQL está vazio, mas temos pedidos salvos no disco local ou backups automáticos, restaura-os para o PostgreSQL!
          const diskOrders = loadJsonFile(ORDERS_FILE, []);
          const backupOrders = loadJsonFile(ORDERS_BACKUP_FILE, []);
          const autoBackupPath = path.join(process.cwd(), 'public', 'assets', 'aistudio', 'donamara_backup_latest_auto.json');
          let backupOrdersList = [];
          if (fs.existsSync(autoBackupPath)) {
            try {
              const autoJson = JSON.parse(fs.readFileSync(autoBackupPath, 'utf8'));
              if (Array.isArray(autoJson?.orders)) backupOrdersList = autoJson.orders;
            } catch {}
          }

          const combinedMap = new Map<string, any>();
          [...backupOrdersList, ...diskOrders, ...memOrders].forEach((o: any) => {
            if (o && o.id) combinedMap.set(String(o.id), o);
          });
          const restoredOrders = Array.from(combinedMap.values()).sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));

          if (restoredOrders.length > 0) {
            memOrders = restoredOrders;
            persistOrdersToDisk(memOrders);
            console.log(`[DB Hydrate] PostgreSQL sem pedidos; restaurando ${memOrders.length} pedidos do backup local/disco para o PostgreSQL...`);
            for (const ord of memOrders) {
              try {
                const orderForDb = formatOrderForDb(ord);
                await withDbRetry(() => db.insert(orders).values(orderForDb).onConflictDoUpdate({
                  target: orders.id,
                  set: orderForDb
                }));
              } catch (insErr: any) {
                console.warn('[DB Hydrate] Erro ao sincronizar pedido restaurado para o DB:', insErr?.message);
              }
            }
          } else {
            memOrders = [];
            persistOrdersToDisk([]);
            console.log('[DB Hydrate] Nenhum pedido cadastrado no PostgreSQL ou disco. Memória zerada.');
          }
        }
      } catch (ordHydrateErr: any) {
        console.error('[DB Hydrate] ERRO CRÍTICO ao carregar pedidos do PostgreSQL:', ordHydrateErr?.message || ordHydrateErr);
      }

    // 4. Hidratar Mesas
    try {
      const tableList = await db.select().from(restaurantTables);
      if (tableList && tableList.length > 0) {
        memTables = tableList;
        persistTablesToDisk(memTables);
        console.log(`[DB Hydrate] ${memTables.length} mesas carregadas do PostgreSQL.`);
      }
    } catch (tblErr: any) {
      console.warn('[DB Hydrate] Aviso ao carregar restaurant_tables do PostgreSQL:', tblErr?.message || tblErr);
    }

    // 4.1. Hidratar Motoboys
    try {
      const drvList = await db.select().from(drivers);
      if (drvList && drvList.length > 0) {
        memDrivers = drvList;
        persistDriversToDisk(memDrivers);
        console.log(`[DB Hydrate] ${memDrivers.length} motoboys carregados do PostgreSQL.`);
      }
    } catch (drvErr: any) {
      console.warn('[DB Hydrate] Aviso ao carregar drivers do PostgreSQL:', drvErr?.message || drvErr);
    }

    // 4.2. Hidratar Zonas de Entrega
    try {
      const zoneList = await db.select().from(deliveryZones);
      if (zoneList && zoneList.length > 0) {
        memDeliveryZones = zoneList;
        persistDeliveryZonesToDisk(memDeliveryZones);
        console.log(`[DB Hydrate] ${memDeliveryZones.length} zonas de entrega carregadas do PostgreSQL.`);
      }
    } catch (zoneErr: any) {
      console.warn('[DB Hydrate] Aviso ao carregar delivery_zones do PostgreSQL:', zoneErr?.message || zoneErr);
    }

    // 5. Hidratar TV Media
    try {
      const tvList = await db.select().from(tvMedia);
      if (tvList && tvList.length > 0) {
        memTvMedia = tvList.sort((a, b) => (a.order || 0) - (b.order || 0));
        persistTvMediaToDisk(memTvMedia);
        console.log(`[DB Hydrate] ${memTvMedia.length} mídias de TV carregadas do PostgreSQL.`);
      } else if (memTvMedia.length > 0) {
        for (const item of memTvMedia) {
          try {
            await db.insert(tvMedia).values(item).onConflictDoNothing();
          } catch {}
        }
      }
    } catch (tvErr: any) {
      console.warn('[DB Hydrate] Aviso ao carregar tv_media do PostgreSQL:', tvErr?.message || tvErr);
    }

    // 5.1. Hidratar Usuários e garantir usuário Master admin@donamara.com.br (senha admin123)
    try {
      let userList = await db.select().from(users);
      if (userList.length === 0) {
        for (const u of DEFAULT_USERS) {
          await db.insert(users).values(u).onConflictDoNothing();
        }
        userList = await db.select().from(users);
      }
      const existingMasterAdmin = userList.find((u: any) => (u.email || '').trim().toLowerCase() === 'admin@donamara.com.br');
      if (!existingMasterAdmin) {
        await db.insert(users).values({
          uid: 'master-4',
          email: 'admin@donamara.com.br',
          name: 'Admin Master',
          role: 'master',
          password: 'donamara@123'
        }).onConflictDoNothing();
        userList = await db.select().from(users);
      } else if (existingMasterAdmin.role !== 'master' || (existingMasterAdmin.password !== 'donamara@123' && existingMasterAdmin.password !== 'admin123')) {
        await db.update(users)
          .set({ role: 'master', password: 'donamara@123', name: 'Admin Master' })
          .where(eq(users.email, 'admin@donamara.com.br'));
        userList = await db.select().from(users);
      }
      memUsers = userList;
      persistUsersToDisk(memUsers);
      console.log(`[DB Hydrate] ${memUsers.length} usuários carregados do PostgreSQL (admin@donamara.com.br configurado como Master).`);
    } catch (usrErr: any) {
      console.warn('[DB Hydrate] Aviso ao carregar users do PostgreSQL:', usrErr?.message || usrErr);
    }

    // 6. Garantir status padrão 'approved' apenas para clientes sem status ou vindos do ERP (preservando 'pending' para novos cadastros aguardando aprovação)
    try {
      let migrationCount = 0;
      memCustomers = memCustomers.map(c => {
        const cleanCpf = String(c.cpf || '').replace(/\D/g, '');
        const defaultPass = cleanCpf.length >= 5 ? cleanCpf.slice(0, 5) : (c.password || '12345');
        const updatedPass = (!c.password || c.password === '123456') ? defaultPass : c.password;
        if (!c.status || (c.status === 'pending' && c.source === 'bluefocus_erp')) {
          migrationCount++;
          return { ...c, status: 'approved', password: updatedPass };
        }
        if (updatedPass !== c.password) {
          migrationCount++;
          return { ...c, password: updatedPass };
        }
        return c;
      });
      if (migrationCount > 0) {
        persistCustomersToDisk(memCustomers);
      }
    } catch (migErr: any) {
      console.warn('[Migration] Aviso ao normalizar clientes:', migErr.message);
    }

      // Persiste o snapshot mestre atualizado em disco
      persistAllStateToMasterFile();
      console.log('[DB Hydrate] Hidratação do PostgreSQL concluída com sucesso!');
    } catch (globalHydrateErr: any) {
      console.error('[DB Hydrate] Erro durante hidratação inicial do PostgreSQL:', globalHydrateErr);
    } finally {
      isHydrated = true;
    }
  })();
  return hydrationPromise;
}

export function cleanPhoneDigits(phone?: string | null): string {
  if (!phone) return '';
  return String(phone).replace(/\D/g, '');
}

export async function upsertCustomerLead(leadData: {
  name?: string;
  phone?: string;
  email?: string;
  cpf?: string;
  password?: string;
  address?: string;
  source?: string;
  orderTotal?: number;
  isOrder?: boolean;
  tags?: string[];
  notes?: string;
  status?: 'pending' | 'approved' | 'rejected';
  monthlyGoal?: number;
}) {
  // REGRA DE NEGÓCIO: Pedidos feitos pelo totem NÃO viram leads no sistema
  if (leadData.source === 'pedido_totem' || leadData.source === 'totem' || leadData.source === 'kiosk') {
    return null;
  }

  const rawName = (leadData.name || '').trim();
  const phone = (leadData.phone || '').trim();
  const digits = cleanPhoneDigits(phone);
  const rawCpf = (leadData.cpf || '').trim();
  const cpfDigits = rawCpf.replace(/\D/g, '');
  
  if (!rawName && !digits && !cpfDigits) return null;
  if (rawName.toLowerCase() === 'cliente totem') return null;

  const now = Date.now();
  const cleanName = rawName || (digits ? `Cliente (${digits.slice(-4)})` : 'Cliente');

  // Buscar cliente existente por CPF/CNPJ, telefone ou nome
  let existingIndex = -1;
  if (cpfDigits && cpfDigits.length >= 11) {
    existingIndex = memCustomers.findIndex(c => String(c.cpf || '').replace(/\D/g, '') === cpfDigits);
  }
  if (existingIndex === -1 && digits && digits.length >= 8) {
    existingIndex = memCustomers.findIndex(c => {
      const cDigits = cleanPhoneDigits(c.phone || '');
      return cDigits && (cDigits === digits || cDigits.endsWith(digits) || digits.endsWith(cDigits));
    });
  }
  
  if (existingIndex === -1 && cleanName && cleanName.toLowerCase() !== 'cliente') {
    existingIndex = memCustomers.findIndex(c => 
      (c.name || '').trim().toLowerCase() === cleanName.toLowerCase() && 
      (!digits || !c.phone || cleanPhoneDigits(c.phone) === digits)
    );
  }

  let customerRecord: any;

  if (existingIndex >= 0) {
    const existing = memCustomers[existingIndex];
    let parsedTags: string[] = [];
    try {
      parsedTags = Array.isArray(existing.tags) 
        ? existing.tags 
        : typeof existing.tags === 'string' 
        ? JSON.parse(existing.tags || '[]') 
        : [];
    } catch {
      parsedTags = [];
    }

    if (leadData.tags && Array.isArray(leadData.tags)) {
      leadData.tags.forEach(t => {
        if (t && !parsedTags.includes(t)) parsedTags.push(t);
      });
    }

    if (leadData.isOrder) {
      if (!parsedTags.includes('Cliente')) parsedTags.push('Cliente');
      if (leadData.source === 'pedido_delivery' && !parsedTags.includes('Delivery')) parsedTags.push('Delivery');
    } else {
      if (!parsedTags.includes('Lead')) parsedTags.push('Lead');
    }

    const updatedTotalOrders = Number(existing.totalOrders || 0) + (leadData.isOrder ? 1 : 0);
    if (updatedTotalOrders >= 2 && !parsedTags.includes('Recorrente')) {
      parsedTags.push('Recorrente');
    }

    const finalCpf = rawCpf || existing.cpf || '';
    const finalCpfDigits = finalCpf.replace(/\D/g, '');
    const defaultPass = finalCpfDigits.length >= 5 ? finalCpfDigits.slice(0, 5) : '12345';

    customerRecord = {
      ...existing,
      name: (cleanName && cleanName.toLowerCase() !== 'cliente') ? cleanName : existing.name,
      phone: phone || existing.phone,
      email: leadData.email || existing.email || '',
      cpf: finalCpf,
      password: leadData.password || ((existing.password && existing.password !== '123456') ? existing.password : defaultPass),
      address: leadData.address || existing.address || '',
      source: existing.source || leadData.source || 'cadastro_cardapio',
      totalOrders: updatedTotalOrders,
      totalSpent: Number(existing.totalSpent || 0) + (Number(leadData.orderTotal) || 0),
      lastOrderAt: leadData.isOrder ? now : (existing.lastOrderAt || null),
      status: leadData.status || existing.status || 'approved',
      monthlyGoal: leadData.monthlyGoal !== undefined ? Number(leadData.monthlyGoal) || 0 : (Number(existing.monthlyGoal) || 0),
      tags: JSON.stringify(parsedTags),
      notes: leadData.notes !== undefined ? leadData.notes : (existing.notes || ''),
    };

    memCustomers[existingIndex] = customerRecord;
  } else {
    const initialTags: string[] = leadData.tags ? [...leadData.tags] : [];
    if (leadData.isOrder) {
      initialTags.push('Cliente');
      if (leadData.source === 'pedido_delivery') initialTags.push('Delivery');
    } else {
      initialTags.push('Lead');
    }

    const defaultPass = cpfDigits.length >= 5 ? cpfDigits.slice(0, 5) : '12345';

    customerRecord = {
      id: `cust_${now}_${Math.random().toString(36).substring(2, 7)}`,
      name: cleanName,
      phone: phone || '',
      email: leadData.email || '',
      cpf: rawCpf,
      password: leadData.password || defaultPass,
      address: leadData.address || '',
      source: leadData.source || 'cadastro_cardapio',
      totalOrders: leadData.isOrder ? 1 : 0,
      totalSpent: Number(leadData.orderTotal) || 0,
      lastOrderAt: leadData.isOrder ? now : null,
      createdAt: now,
      status: leadData.status || 'approved',
      monthlyGoal: Number(leadData.monthlyGoal) || 0,
      tags: JSON.stringify(initialTags),
      notes: leadData.notes || '',
    };

    memCustomers.unshift(customerRecord);
  }

  persistCustomersToDisk(memCustomers);

  if (isDatabaseConfigured()) {
    try {
      const payload = {
        ...customerRecord,
        tags: typeof customerRecord.tags === 'string' ? customerRecord.tags : JSON.stringify(customerRecord.tags || [])
      };
      await db.insert(customers).values(payload).onConflictDoUpdate({
        target: customers.id,
        set: payload
      });
    } catch (err: any) {
      console.warn('Aviso: Falha ao persistir cliente no DB:', err?.message || err);
    }
  }

  return customerRecord;
}

let latestTvCall: {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  type?: string;
  tableOrDesk?: string;
  calledAt: number;
} | null = null;

// SSE Connections set for real-time synchronization
const sseClients = new Set<Response>();

export function broadcastSSE(data: any) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch (e) {
      sseClients.delete(client);
    }
  }
}

// Keep-alive heartbeat every 15 seconds
setInterval(() => {
  broadcastSSE({ type: 'ping', time: Date.now() });
}, 15000);

export function setupDatabaseRoutes(app: Express, onUpdate?: (target?: string) => void) {
  // Middleware que garante que nenhuma rota /api/db leia ou sobrescreva dados antes da hidratação do Supabase/PostgreSQL concluir
  app.use('/api/db', async (req: Request, res: Response, next) => {
    if (!isHydrated && hydrationPromise) {
      await waitForHydration(12000);
    }
    next();
  });

  app.get('/api/events', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    res.write(`data: ${JSON.stringify({ type: 'connected', time: Date.now() })}\n\n`);
    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
  });

  // Force Hydrate from PostgreSQL (Admin Panic Button)
  app.post('/api/db/force-hydrate', async (req: Request, res: Response) => {
    try {
      console.log('[DB Force Hydrate] Iniciando hidratação manual solicitada pelo Administrador...');
      isHydrated = false;
      hydrationPromise = null;
      await hydrateFromPostgres();
      onUpdate?.('orders');
      res.json({ 
        success: true, 
        message: 'Hidratação concluída com sucesso! Os dados foram recarregados do PostgreSQL.', 
        ordersCount: memOrders.length,
        customersCount: memCustomers.length
      });
    } catch (err: any) {
      console.error('[DB Force Hydrate] Erro:', err);
      res.status(500).json({ success: false, error: err?.message || 'Falha na hidratação manual' });
    }
  });

  // NTFY Proxy Endpoint (Evita bloqueios de CORS no navegador e garante entrega garantida de notificações)
  app.post('/api/ntfy/send', async (req: Request, res: Response) => {
    try {
      const { topic, title, message, priority, tags, clickUrl } = req.body || {};
      const safeTopic = (topic || 'donamara_pedidos').toString().replace(/[^a-zA-Z0-9_-]/g, '') || 'donamara_pedidos';
      
      if (!message) {
        return res.status(400).json({ success: false, error: 'Mensagem é obrigatória' });
      }

      const ntfyPayload: Record<string, any> = {
        topic: safeTopic,
        message: String(message),
        priority: Number(priority) || 4
      };
      if (title) ntfyPayload.title = String(title);
      if (Array.isArray(tags) && tags.length > 0) ntfyPayload.tags = tags;
      if (clickUrl) ntfyPayload.click = String(clickUrl);

      const ntfyRes = await fetch('https://ntfy.sh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        },
        body: JSON.stringify(ntfyPayload)
      });

      if (ntfyRes.ok) {
        return res.json({ success: true, message: 'Notificação enviada com sucesso via ntfy' });
      } else {
        const errText = await ntfyRes.text();
        return res.status(500).json({ success: false, error: 'Falha no serviço ntfy', details: errText });
      }
    } catch (err: any) {
      console.error('[NTFY Proxy Error]:', err);
      return res.status(500).json({ success: false, error: err?.message || 'Erro interno ao enviar ntfy' });
    }
  });

  // Diagnostic Test Connection Route
  app.get('/api/db/test-connection', async (req: Request, res: Response) => {
    const startTime = Date.now();
    const envDetected = {
      DATABASE_URL: !!getDatabaseUrl(),
      PGHOST: !!process.env.PGHOST,
      SQL_HOST: !!process.env.SQL_HOST,
      nodeEnv: process.env.NODE_ENV,
      isRailway: isRailwayEnvironment()
    };

    try {
      const dbStatus = await testDatabaseConnection();
      let orderCount = 0;
      let customerCount = 0;
      let productCount = 0;
      let categoryCount = 0;
      
      if (dbStatus.ok) {
        const oRes = await pool.query('SELECT COUNT(*) as c FROM orders');
        orderCount = parseInt(oRes.rows[0]?.c || '0', 10);
        const cRes = await pool.query('SELECT COUNT(*) as c FROM customers');
        customerCount = parseInt(cRes.rows[0]?.c || '0', 10);
        const pRes = await pool.query('SELECT COUNT(*) as c FROM products');
        productCount = parseInt(pRes.rows[0]?.c || '0', 10);
        const catRes = await pool.query('SELECT COUNT(*) as c FROM categories');
        categoryCount = parseInt(catRes.rows[0]?.c || '0', 10);
      }

      return res.status(200).json({
        success: dbStatus.ok,
        message: dbStatus.ok ? 'Conexão com PostgreSQL ativa!' : 'Falha na conexão com PostgreSQL.',
        details: dbStatus.error || 'Banco de dados respondendo normalmente.',
        host: dbStatus.host,
        productCount,
        categoryCount,
        ordersCount: orderCount,
        customersCount: customerCount,
        stats: {
          orders: orderCount,
          customers: customerCount,
          products: productCount,
          categories: categoryCount
        },
        envDetected,
        isHydrated,
        responseTimeMs: Date.now() - startTime
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || String(err),
        envDetected
      });
    }
  });

  // Categories
  app.get('/api/db/categories', (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.json(memCategories);
  });

  app.post('/api/db/categories', async (req: Request, res: Response) => {
    const data = req.body;
    const newCat = formatCategoryForDb({ ...data, id: data.id || `cat_${Date.now()}` });
    memCategories = [...memCategories.filter(c => c.id !== newCat.id), newCat];
    persistCategoriesToDisk(memCategories);

    if (isDatabaseConfigured()) {
      try {
        await saveCategoriesToPostgresBatch([newCat]);
      } catch (error: any) {
        console.warn('[DB Category Insert Error]:', error?.message || error);
      }
    }
    onUpdate?.('catalog');
    res.json(newCat);
  });

  app.put('/api/db/categories/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const data = req.body;
    let updatedCat: any = { id, ...data };
    memCategories = memCategories.map(c => {
      if (c.id === id) {
        updatedCat = formatCategoryForDb({ ...c, ...data, id });
        return updatedCat;
      }
      return c;
    });
    persistCategoriesToDisk(memCategories);

    if (isDatabaseConfigured()) {
      try {
        await saveCategoriesToPostgresBatch([updatedCat]);
      } catch (error: any) {
        console.warn('[DB Category Update Error]:', error?.message || error);
      }
    }
    onUpdate?.('catalog');
    res.json(updatedCat);
  });

  app.delete('/api/db/categories/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    memCategories = memCategories.filter(c => c.id !== id);
    persistCategoriesToDisk(memCategories);

    if (isDatabaseConfigured()) {
      try {
        await db.delete(categories).where(eq(categories.id, id));
      } catch (error: any) {}
    }
    onUpdate?.('catalog');
    res.json({ success: true, id });
  });

  // --- Totem Backups ---
  app.get('/api/db/totem-backups', async (req: Request, res: Response) => {
    if (isDatabaseConfigured()) {
      try {
        const list = await withDbRetry(() => db.select().from(totemBackups).orderBy(desc(totemBackups.createdAt)));
        if (list && list.length > 0) {
          memTotemBackups = list;
          return res.json(list);
        }
      } catch (err: any) {
        console.warn('[Totem Backups] GET erro:', err?.message);
      }
    }
    res.json(memTotemBackups);
  });

  app.post('/api/db/totem-backups', async (req: Request, res: Response) => {
    try {
      const { name } = req.body || {};
      const now = new Date();
      const dateStr = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const backupName = name && String(name).trim() ? String(name).trim() : `Backup Totem - ${dateStr}`;

      const activeCatList = memCategories.map(c => ({ ...c }));
      const activeProdList = memProducts.map(p => ({ ...p }));

      const newBackup = {
        id: `totem_bkp_${Date.now()}`,
        name: backupName,
        createdAt: new Date().toISOString(),
        activeCategoriesCount: activeCatList.filter(c => c.availableForKiosk !== false).length,
        activeProductsCount: activeProdList.filter(p => p.isActive && p.availableForKiosk !== false).length,
        categories: activeCatList,
        products: activeProdList
      };

      memTotemBackups = [newBackup, ...memTotemBackups.slice(0, 49)];
      persistTotemBackupsToDisk(memTotemBackups);

      if (isDatabaseConfigured()) {
        try {
          await withDbRetry(() => db.insert(totemBackups).values(newBackup).onConflictDoUpdate({
            target: totemBackups.id,
            set: newBackup
          }));
        } catch (dbTbErr) {
          console.warn('[Totem Backup DB Error]:', dbTbErr);
        }
      }

      onUpdate?.('catalog');

      res.json({ success: true, backup: newBackup });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro ao criar backup' });
    }
  });

  app.post('/api/db/totem-backups/restore', async (req: Request, res: Response) => {
    try {
      const { backupId, customBackup } = req.body || {};
      let targetBackup = customBackup;
      let restoredCatCount = 0;
      let restoredProdCount = 0;

      if (!targetBackup && backupId) {
        targetBackup = memTotemBackups.find(b => b.id === backupId);
      }

      if (!targetBackup || (!Array.isArray(targetBackup.categories) && !Array.isArray(targetBackup.products))) {
        return res.status(400).json({ error: 'Backup inválido ou não encontrado.' });
      }

      if (Array.isArray(targetBackup.categories)) {
        memCategories = targetBackup.categories;
        persistCategoriesToDisk(memCategories);
        restoredCatCount = memCategories.length;
      }

      if (Array.isArray(targetBackup.products)) {
        memProducts = targetBackup.products;
        persistProductsToDisk(memProducts);
        restoredProdCount = memProducts.length;
      }

      persistAllStateToMasterFile();

      // Sincroniza com PostgreSQL se configurado
      if (isDatabaseConfigured()) {
        try {
          if (Array.isArray(targetBackup.categories)) {
            for (const c of targetBackup.categories) {
              await db.insert(categories).values(c).onConflictDoUpdate({ target: categories.id, set: c });
            }
          }
          if (Array.isArray(targetBackup.products)) {
            for (const p of targetBackup.products) {
              await db.insert(products).values(p).onConflictDoUpdate({ target: products.id, set: p });
            }
          }
        } catch (dbErr) {
          console.warn('[DB Restore] Aviso ao sincronizar com Postgres:', dbErr);
        }
      }

      onUpdate?.('catalog');
      res.json({
        success: true,
        restoredCatCount,
        restoredProdCount,
        backupName: targetBackup.name || 'Backup Restaurado'
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro ao restaurar backup do totem' });
    }
  });

  app.delete('/api/db/totem-backups/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    memTotemBackups = memTotemBackups.filter(b => b.id !== id);
    persistTotemBackupsToDisk(memTotemBackups);

    if (isDatabaseConfigured()) {
      try {
        await db.delete(totemBackups).where(eq(totemBackups.id, id));
      } catch (dbDelErr) {}
    }

    onUpdate?.('catalog');
    res.json({ success: true, id });
  });

  // Products
  app.get('/api/db/products', (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-cache');

    const defaultCodeMap: Record<string, string> = {
      'prod-1': '1001',
      'prod-2': '1002',
      'prod-3': '2001',
      'prod-4': '2002',
      'prod-5': '3001',
      'prod-6': '3002',
      'prod-7': '4001',
      'prod-8': '4002',
    };

    const attachCodeIfMissing = (p: any, index: number) => {
      let code = p.externalId;
      if (!code || String(code).trim() === '') {
        if (p.id && defaultCodeMap[p.id]) {
          code = defaultCodeMap[p.id];
        } else if (p.id && p.id.startsWith('prod-')) {
          const num = parseInt(p.id.replace('prod-', ''), 10);
          code = isNaN(num) ? String(1000 + index + 1) : String(1000 + num);
        } else {
          code = String(1000 + index + 1);
        }
      }
      return {
        ...p,
        externalId: code,
        description: cleanProductDescription(p.description, false)
      };
    };

    const sanitized = memProducts.map((p, idx) => attachCodeIfMissing(p, idx));
    res.json(sanitized);
  });

  app.post('/api/db/products', async (req: Request, res: Response) => {
    const data = req.body;
    const newProd = formatProductForDb({ ...data, id: data.id || `prod_${Date.now()}` });
    memProducts = [...memProducts.filter(p => p.id !== newProd.id), newProd];
    persistProductsToDisk(memProducts);

    if (isDatabaseConfigured()) {
      try {
        await saveProductsToPostgresBatch([newProd]);
      } catch (error: any) {
        console.warn('[DB Product Insert Error]:', error?.message || error);
      }
    }
    onUpdate?.('catalog');
    res.json(newProd);
  });

  app.post('/api/db/products/batch', async (req: Request, res: Response) => {
    try {
      const items: any[] = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        return res.json({ success: true, count: 0 });
      }

      const itemMap = new Map(memProducts.map(p => [p.id, p]));
      const mergedItems: any[] = [];
      for (const item of items) {
        const merged = formatProductForDb({ ...(itemMap.get(item.id) || {}), ...item });
        itemMap.set(merged.id, merged);
        mergedItems.push(merged);
      }
      memProducts = Array.from(itemMap.values());
      persistProductsToDisk(memProducts);

      if (isDatabaseConfigured()) {
        await saveProductsToPostgresBatch(mergedItems);
      }
      onUpdate?.('catalog');
      res.json({ success: true, count: mergedItems.length });
    } catch (error: any) {
      console.warn('[DB Products Batch Error]:', error?.message || error);
      onUpdate?.('catalog');
      res.json({ success: true, count: (req.body || []).length });
    }
  });

  app.put('/api/db/products/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const data = req.body;
    let updatedProd: any = { id, ...data };
    memProducts = memProducts.map(p => {
      if (p.id === id) {
        updatedProd = formatProductForDb({ ...p, ...data, id });
        return updatedProd;
      }
      return p;
    });
    persistProductsToDisk(memProducts);

    if (isDatabaseConfigured()) {
      try {
        await saveProductsToPostgresBatch([updatedProd]);
      } catch (error: any) {
        console.warn('[DB Product Update Error]:', error?.message || error);
      }
    }
    onUpdate?.('catalog');
    res.json(updatedProd);
  });

  // Purge/clean all barcodes from descriptions in DB & Memory
  app.post('/api/db/products/clean-barcodes', async (req: Request, res: Response) => {
    try {
      let updatedCount = 0;
      memProducts = memProducts.map(p => {
        const cleaned = cleanProductDescription(p.description, false);
        if (cleaned !== p.description) updatedCount++;
        return { ...p, description: cleaned };
      });
      persistProductsToDisk(memProducts);

      if (isDatabaseConfigured()) {
        const allProds = await db.select().from(products);
        for (const prod of allProds) {
          const cleaned = cleanProductDescription(prod.description, false);
          if (cleaned !== prod.description) {
            await db.update(products).set({ description: cleaned }).where(eq(products.id, prod.id));
            updatedCount++;
          }
        }
      }
      onUpdate?.('catalog');
      res.json({ success: true, updatedCount });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/db/products/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    memProducts = memProducts.filter(p => p.id !== id);
    persistProductsToDisk(memProducts);

    if (isDatabaseConfigured()) {
      try {
        await db.delete(products).where(eq(products.id, id));
      } catch (error: any) {}
    }
    onUpdate?.();
    res.json({ success: true, id });
  });

  // Orders
  app.get('/api/db/orders', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    if (!isDatabaseConfigured()) {
      return res.json(memOrders);
    }
    try {
      const list = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(5000);
      const parsedOrders = (list || []).map(o => ({
        ...o,
        items: typeof o.items === 'string' ? JSON.parse(o.items) : (o.items || [])
      }));
      memOrders = parsedOrders;
      persistOrdersToDisk(memOrders);

      return res.json(memOrders);
    } catch (error: any) {
      console.warn('[DB API] Aviso ao buscar pedidos do PostgreSQL:', error?.message);
      return res.json(memOrders);
    }
  });

  app.post('/api/db/orders', async (req: Request, res: Response) => {
    const data = req.body || {};
    
    // Obter lista atualizada de pedidos para calcular o próximo número sequencial garantido
    let currentOrders = [...memOrders];
    if (isDatabaseConfigured()) {
      try {
        const dbList = await db.select().from(orders);
        if (Array.isArray(dbList) && dbList.length > 0) {
          currentOrders = dbList;
        }
      } catch (err) {
        console.warn('Erro ao consultar pedidos do banco para numeração:', err);
      }
    }

    // Se o cliente forneceu um ID com 4 dígitos numéricos que ainda não está em uso, utiliza-o; senão calcula o menor número disponível
    let finalId: string;
    if (data.id && /^\d{4}$/.test(String(data.id)) && !currentOrders.some(o => o.id === String(data.id))) {
      finalId = String(data.id);
    } else {
      finalId = calculateNextOrderNumber(currentOrders);
    }

    // Regra de Negócio:
    // 1. Pedidos do Totem (type === 'kiosk' ou canal totem) e Consumo na Loja (Mesa / dine_in) chegam como 'completed' (Entregue).
    //    Eles disparam impressão automática IMEDIATAMENTE (no servidor e no Caixa).
    // 2. Pedidos de Delivery chegam estritamente como 'pending' (Pendente) e NÃO imprimem na chegada;
    //    eles serão impressos automaticamente após 3 minutos pelo temporizador.
    // 3. Pedidos online de Retirada/Balcão feitos pelo smartphone sem mesa chegam como 'pending'.
    const isKiosk = data.type === 'kiosk' || data.mode === 'kiosk' || (data.customerName && String(data.customerName).toLowerCase().includes('totem'));
    const isDineIn = Boolean(data.tableNumber) || data.type === 'dine_in' || data.deliveryType === 'dine_in';
    const isTotemOrDineIn = isKiosk || isDineIn;

    const isDeliveryOrder = !isTotemOrDineIn && (data.type === 'delivery' || data.deliveryType === 'delivery');

    const initialStatus = isTotemOrDineIn ? (data.status || 'completed') : 'pending';
    const initialDeliveryStatus = isTotemOrDineIn ? (data.deliveryStatus || 'delivered') : 'pending';

    const newOrder = {
      ...data,
      id: finalId,
      createdAt: data.createdAt || Date.now(),
      status: initialStatus,
      deliveryStatus: initialDeliveryStatus,
      customerName: data.customerName || (isKiosk ? 'Cliente Totem' : 'Cliente')
    };

    memOrders = [newOrder, ...memOrders.filter(o => o.id !== newOrder.id)];
    persistOrdersToDisk(memOrders);

    // Auto-capture customer as lead / client for marketing
    // REGRA DE NEGÓCIO: Apenas clientes de delivery e consumo na loja viram leads no sistema.
    // Pedidos feitos pelo totem NÃO viram leads.
    if (newOrder.type !== 'kiosk') {
      const custName = (newOrder.customerName || '').trim();
      const custPhone = (newOrder.customerPhone || '').trim();
      if ((custName && custName.toLowerCase() !== 'cliente' && custName.toLowerCase() !== 'cliente totem') || custPhone) {
        const isDelivery = newOrder.type === 'delivery' || newOrder.deliveryType === 'delivery';
        upsertCustomerLead({
          name: newOrder.customerName,
          phone: newOrder.customerPhone,
          address: newOrder.deliveryAddress || newOrder.address || '',
          source: isDelivery ? 'pedido_delivery' : 'pedido_loja',
          orderTotal: Number(newOrder.total) || 0,
          isOrder: true,
          tags: isDelivery ? ['Cliente', 'Delivery'] : ['Cliente', 'Consumo Loja']
        }).catch(err => console.warn('Erro ao auto-cadastrar lead do pedido:', err));
      }
    }

    // Regra de Negócio:
    // Apenas pedidos que chegam com status 'completed' (Totem e Consumo na Loja/Mesa) disparam impressão automática imediata.
    // Pedidos de Delivery chegam com status 'pending' (Pendente) e NÃO devem ser impressos imediatamente na chegada;
    // eles serão impressos automaticamente após 3 minutos pelo temporizador da cozinha ou quando o operador aceitar/finalizar o pedido.
    const shouldAutoPrintImmediately = (newOrder.status === 'completed' || isTotemOrDineIn) && !isDeliveryOrder;

    if (shouldAutoPrintImmediately) {
      // Enfileira automaticamente para o Agente Windows do Caixa
      queueOrderForAgent(newOrder, memStoreInfo);

      // Impressão automática na Impressora de Rede da Loja (Opção A)
      // Envia diretamente para o IP da impressora térmica com o nome do cliente e número do pedido
      const rawPrinterIp = (memStoreInfo?.networkPrinterIp || '').trim();
      const targetPrinterIp = (rawPrinterIp === '192.168.1.200' || !rawPrinterIp) ? '192.168.0.90' : rawPrinterIp;
      if (targetPrinterIp) {
        printOrderToNetworkPrinter(newOrder, { ...memStoreInfo, networkPrinterIp: targetPrinterIp }).then(printRes => {
          if (printRes.success) {
            console.log(`[Auto-Print Servidor] Pedido #${newOrder.id} (${newOrder.type}) impresso na impressora de rede (${targetPrinterIp})!`);
          } else {
            console.log(`[Auto-Print Servidor] Envio para impressora de rede: ${printRes.message}`);
          }
        }).catch(err => {
          console.warn(`[Auto-Print Servidor] Aviso na impressora de rede:`, err?.message || err);
        });
      }
    } else {
      console.log(`[Auto-Print Servidor] Pedido #${newOrder.id} recebido com status pendente (${newOrder.type || newOrder.deliveryType || 'delivery'}). Não imprime imediatamente; aguardando 3 minutos.`);
    }

    broadcastSSE({ type: 'sync', target: 'orders', orderId: newOrder.id, time: Date.now() });

    // Enviar notificação via NTFY se estiver ativado
    if (memStoreInfo.ntfyEnabled !== false) {
      const topic = (memStoreInfo.ntfyTopic || 'donamara_pedidos').replace(/[^a-zA-Z0-9_-]/g, '');
      const itemsSummary = Array.isArray(newOrder.items) 
        ? newOrder.items.map((it: any) => `${it.quantity}x ${it.name}`).join(', ')
        : 'Itens não detalhados';
      
      const ntfyPayload = {
        topic,
        title: `Pedido #${newOrder.id} - ${newOrder.customerName}`,
        message: `Valor: R$ ${Number(newOrder.total).toFixed(2)}\nItens: ${itemsSummary}`,
        priority: 5,
        tags: ['package', 'star-struck', 'money_with_wings']
      };

      fetch('https://ntfy.sh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(ntfyPayload)
      }).then(res => {
        if (res.ok) console.log(`[NTFY Order] Notificação enviada para o tópico: ${topic}`);
      }).catch(err => console.warn('[NTFY Order] Erro ao enviar:', err.message));
    }

    const orderForDb: any = {
      id: String(newOrder.id),
      items: typeof newOrder.items === 'string' ? JSON.parse(newOrder.items) : (newOrder.items || []),
      total: Number(newOrder.total) || 0,
      status: String(newOrder.status || 'pending'),
      createdAt: Number(newOrder.createdAt) || Date.now(),
      type: newOrder.type || 'kiosk',
      paymentMethod: newOrder.paymentMethod || '',
      customerName: newOrder.customerName || '',
      customerPhone: newOrder.customerPhone || null,
      customerId: newOrder.customerId || null,
      customerEmail: newOrder.customerEmail || '',
      customerCpf: newOrder.customerCpf || '',
      deliveryType: newOrder.deliveryType || null,
      deliveryAddress: newOrder.deliveryAddress || null,
      deliveryCep: newOrder.deliveryCep || '',
      deliveryNeighborhood: newOrder.deliveryNeighborhood || '',
      deliveryFee: Number(newOrder.deliveryFee) || 0,
      tableNumber: newOrder.tableNumber ? String(newOrder.tableNumber) : null,
      tableId: newOrder.tableId || null,
      driverId: newOrder.driverId || null,
      driverName: newOrder.driverName || null,
      deliveryStatus: newOrder.deliveryStatus || 'pending',
      deliveryAcceptedAt: newOrder.deliveryAcceptedAt ? Number(newOrder.deliveryAcceptedAt) : null,
      deliveryCompletedAt: newOrder.deliveryCompletedAt ? Number(newOrder.deliveryCompletedAt) : null,
      scheduledTime: newOrder.scheduledTime || null,
      scheduledDate: newOrder.scheduledDate || null,
      scheduledDay: newOrder.scheduledDay || null,
      scheduledPickupTime: newOrder.scheduledPickupTime || null
    };

    if (isDatabaseConfigured()) {
      try {
        console.log(`[DB Order] Tentando salvar pedido #${orderForDb.id} no PostgreSQL...`);
        const result = await withDbRetry(async () => {
          return await db.insert(orders).values(orderForDb).onConflictDoUpdate({
            target: orders.id,
            set: orderForDb
          }).returning();
        });
        if (result && result.length > 0) {
          console.log(`[DB Order] SUCESSO: Pedido #${orderForDb.id} persistido definitivamente no PostgreSQL.`);
          onUpdate?.('orders');
          return res.json(result[0]);
        } else {
          console.warn(`[DB Order] AVISO: O banco retornou vazio ao salvar #${orderForDb.id}.`);
          onUpdate?.('orders');
          return res.json(newOrder);
        }
      } catch (error: any) {
        console.error(`[CRITICAL] FALHA DEFINITIVA ao salvar pedido #${orderForDb.id} no PostgreSQL:`, error?.message || error);
        onUpdate?.();
        return res.json(newOrder);
      }
    }
    onUpdate?.();
    res.json(newOrder);
  });

  app.post('/api/db/orders/batch', async (req: Request, res: Response) => {
    try {
      const items: any[] = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        return res.json({ success: true, count: 0 });
      }
      const orderMap = new Map<string, any>();
      (memOrders || []).forEach(o => { if (o && o.id) orderMap.set(String(o.id), o); });
      items.forEach(item => {
        if (item && item.id) {
          orderMap.set(String(item.id), { ...(orderMap.get(String(item.id)) || {}), ...item });
        }
      });
      memOrders = Array.from(orderMap.values()).sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
      persistOrdersToDisk(memOrders);

      if (isDatabaseConfigured()) {
        for (const item of items) {
          try {
            const formatted = formatOrderForDb(item);
            await withDbRetry(() => db.insert(orders).values(formatted).onConflictDoUpdate({
              target: orders.id,
              set: formatted
            }));
          } catch (_) {}
        }
      }
      onUpdate?.();
      res.json({ success: true, count: items.length });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Erro ao sincronizar lote de pedidos' });
    }
  });

  // TV Call Order endpoints
  app.get('/api/db/tv-call-order', (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json(latestTvCall || { calledAt: 0 });
  });

  app.post('/api/db/tv-call-order', (req: Request, res: Response) => {
    try {
      const data = req.body || {};
      const orderNumber = data.orderNumber || (data.orderId ? String(data.orderId).slice(-4).padStart(4, '0') : '0001');
      latestTvCall = {
        id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        orderId: data.orderId || `ord_${Date.now()}`,
        orderNumber: String(orderNumber).replace('#', ''),
        customerName: data.customerName || 'Cliente',
        type: data.type || 'balcao',
        tableOrDesk: data.tableOrDesk || '',
        calledAt: Date.now()
      };
      broadcastSSE({ type: 'sync', target: 'tv_call', call: latestTvCall, time: Date.now() });
      onUpdate?.('tv_call');
      res.json({ success: true, call: latestTvCall });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to broadcast TV call' });
    }
  });

  app.put('/api/db/orders/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const data = { ...req.body };

    // Sincronizar deliveryStatus automaticamente conforme o status do pedido para pedidos de delivery
    if (data.status) {
      if (data.status === 'out_for_delivery') {
        data.deliveryStatus = data.deliveryStatus || 'in_transit';
        if (!data.deliveryAcceptedAt) data.deliveryAcceptedAt = Date.now();
      } else if (data.status === 'completed') {
        data.deliveryStatus = data.deliveryStatus || 'delivered';
        if (!data.deliveryCompletedAt) data.deliveryCompletedAt = Date.now();
      } else if (data.status === 'ready_for_delivery') {
        if (!data.deliveryStatus || data.deliveryStatus === 'pending') {
          data.deliveryStatus = 'ready';
        }
      } else if (data.status === 'cancelled') {
        data.deliveryStatus = 'cancelled';
      }
    }

    const targetId = String(id).trim();
    memOrders = memOrders.map(o => (String(o.id).trim() === targetId || String(o.id).endsWith(targetId) || targetId.endsWith(String(o.id))) ? { ...o, ...data } : o);
    persistOrdersToDisk(memOrders);

    const orderData = memOrders.find(o => String(o.id).trim() === targetId || String(o.id).endsWith(targetId) || targetId.endsWith(String(o.id))) || { id, ...data };

    if (data.status === 'ready' || data.status === 'ready_for_pickup') {
      latestTvCall = {
        id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        orderId: id,
        orderNumber: String(id).slice(-4).padStart(4, '0'),
        customerName: orderData.customerName || 'Cliente',
        type: orderData.type || 'balcao',
        tableOrDesk: orderData.table || '',
        calledAt: Date.now()
      };
    }

    broadcastSSE({
      type: 'sync',
      target: 'orders',
      action: 'status_updated',
      orderId: id,
      status: data.status || orderData.status,
      deliveryStatus: data.deliveryStatus || orderData.deliveryStatus,
      customerName: orderData.customerName || 'Cliente',
      customerPhone: orderData.customerPhone || '',
      time: Date.now()
    });

    // Disparo automático via NTFY se ativado (alcance mesmo com app/tela fechada)
    if (data.status && data.status !== 'pending' && memStoreInfo.ntfyEnabled !== false) {
      try {
        const topic = String(memStoreInfo.ntfyTopic || 'donamara_pedidos').trim();
        const statusLabels: Record<string, string> = {
          preparing: '👨‍🍳 Em Preparo na Cozinha',
          ready: '📦 Pronto no Balcão',
          ready_for_pickup: '🛍️ Pronto para Retirada',
          ready_for_delivery: '📦 Pronto para Entrega',
          out_for_delivery: '🛵 Saiu para Entrega',
          completed: '🎉 Concluído / Finalizado',
          cancelled: '⚠️ Cancelado'
        };
        const label = statusLabels[data.status] || `Status: ${data.status}`;
        const cleanPhone = String(orderData.customerPhone || '').replace(/\D/g, '');
        fetch(`https://ntfy.sh/${topic}`, {
          method: 'POST',
          headers: {
            'Title': `🔔 Status Atualizado: Pedido #${String(id).slice(-4)} (${label})`,
            'Priority': 'urgent',
            'Tags': 'bell,package,memo',
            'Click': cleanPhone ? `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(`Olá ${orderData.customerName || 'Cliente'}! Seu pedido #${String(id).slice(-4)} na DONAMARA foi atualizado para: ${label}.`)}` : undefined
          },
          body: `Pedido #${String(id).slice(-4)} (${orderData.customerName || 'Cliente'})\nNovo Status: ${label}\nTelefone: ${orderData.customerPhone || 'Não informado'}`
        }).catch(() => {});
      } catch (ntfyErr) {}
    }

    // Disparo automático via Webhook se configurado
    if (data.status && memStoreInfo.autoSmsWebhookUrl && String(memStoreInfo.autoSmsWebhookUrl).trim() !== '') {
      try {
        const webhookUrl = String(memStoreInfo.autoSmsWebhookUrl).trim();
        const apiKey = String(memStoreInfo.autoSmsApiKey || '').trim();
        fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { 'Authorization': `Bearer ${apiKey}`, 'x-api-key': apiKey } : {})
          },
          body: JSON.stringify({
            event: 'order_status_updated',
            orderId: id,
            status: data.status,
            customerName: orderData.customerName || 'Cliente',
            customerPhone: orderData.customerPhone || '',
            phone: orderData.customerPhone || '',
            number: String(orderData.customerPhone || '').replace(/\D/g, ''),
            message: `Olá ${orderData.customerName || 'Cliente'}! Seu pedido #${String(id).slice(-4)} teve seu status atualizado para: ${data.status}.`
          })
        }).catch(() => {});
      } catch (whErr) {}
    }

    if (isDatabaseConfigured()) {
      try {
        const allowedKeys = [
          'status', 'deliveryStatus', 'driverId', 'driverName',
          'deliveryAcceptedAt', 'deliveryCompletedAt', 'scheduledTime',
          'scheduledDate', 'scheduledDay', 'scheduledPickupTime', 'items', 'total',
          'paymentMethod', 'customerName', 'customerPhone', 'customerEmail', 'customerCpf',
          'deliveryType', 'deliveryAddress', 'deliveryCep', 'deliveryNeighborhood', 'deliveryFee',
          'tableNumber', 'tableId'
        ];
        const updatePayload: any = {};
        for (const k of allowedKeys) {
          if (data[k] !== undefined) {
            if (k === 'items') {
              updatePayload.items = typeof data.items === 'string' ? JSON.parse(data.items) : data.items;
            } else if (k === 'total' || k === 'deliveryFee') {
              updatePayload[k] = Number(data[k]) || 0;
            } else if (k === 'deliveryAcceptedAt' || k === 'deliveryCompletedAt') {
              updatePayload[k] = data[k] ? Number(data[k]) : null;
            } else {
              updatePayload[k] = data[k];
            }
          }
        }
        if (Object.keys(updatePayload).length > 0) {
          const result = await withDbRetry(() => db.update(orders).set(updatePayload).where(eq(orders.id, targetId)).returning());
          onUpdate?.('orders');
          return res.json(result[0] || { id: targetId, ...data });
        }
      } catch (error: any) {
        console.warn(`[DB Order Update] Erro ao atualizar pedido #${targetId} no PostgreSQL:`, error?.message);
        onUpdate?.('orders');
        return res.json({ id: targetId, ...data });
      }
    }
    onUpdate?.('orders');
    res.json({ id: targetId, ...data });
  });

  app.post('/api/db/orders/:id/append-items', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { newItems } = req.body;
      const targetId = String(id).trim();

      const existingOrderIndex = memOrders.findIndex(o => 
        String(o.id).trim() === targetId || String(o.id).endsWith(targetId) || targetId.endsWith(String(o.id))
      );

      if (existingOrderIndex === -1) {
        return res.status(404).json({ error: 'Pedido não encontrado.' });
      }

      const existingOrder = memOrders[existingOrderIndex];

      // Regra 1: Status não pode ter mudado para preparando ou posterior
      if (existingOrder.status !== 'pending') {
        return res.status(400).json({ 
          error: 'O pedido já entrou em preparo pela cozinha ou foi finalizado, portanto não é mais possível fazer acréscimos.' 
        });
      }

      // Regra 2: Condição de pagamento deve ser pagamento na retirada
      const isOnlinePaid = (existingOrder.paymentMethod && existingOrder.paymentMethod.includes('Online')) || existingOrder.paymentStatus === 'approved';
      if (isOnlinePaid) {
        return res.status(400).json({ 
          error: 'Acréscimos só são permitidos para pedidos com pagamento presencial na retirada.' 
        });
      }

      if (!Array.isArray(newItems) || newItems.length === 0) {
        return res.status(400).json({ error: 'Nenhum item informado para acréscimo.' });
      }

      // Regra 3: Mesma modalidade (Congelados vs Prontos)
      const existingItems = Array.isArray(existingOrder.items) 
        ? existingOrder.items 
        : (typeof existingOrder.items === 'string' ? JSON.parse(existingOrder.items) : []);
      
      const orderIsFrozen = existingItems.some((it: any) => 
        it.isFrozen || (it.prepType && it.prepType.startsWith('congelado')) || (it.prepLabel && it.prepLabel.toLowerCase().includes('congelad'))
      );

      const anyNewItemFrozen = newItems.some((it: any) => 
        it.isFrozen || (it.prepType && it.prepType.startsWith('congelado')) || (it.prepLabel && it.prepLabel.toLowerCase().includes('congelad'))
      );
      const anyNewItemNormal = newItems.some((it: any) => 
        !(it.isFrozen || (it.prepType && it.prepType.startsWith('congelado')) || (it.prepLabel && it.prepLabel.toLowerCase().includes('congelad')))
      );

      if (orderIsFrozen && anyNewItemNormal) {
        return res.status(400).json({ 
          error: 'Este pedido é exclusivo de Salgados Congelados (prazo até 48h). Não é permitido acrescentar itens prontos. Caso queira itens prontos, inicie um novo pedido separado.' 
        });
      }

      if (!orderIsFrozen && anyNewItemFrozen) {
        return res.status(400).json({ 
          error: 'Este pedido é de Salgados Prontos. Não é permitido acrescentar itens congelados (prazo até 48h). Caso queira congelados, inicie um novo pedido separado.' 
        });
      }

      // Mescla os itens: se for o mesmo produto, prepType, sabor e adicionais, soma a quantidade; senão adiciona novo
      const mergedItems = [...existingItems];
      for (const newItem of newItems) {
        const existingIdx = mergedItems.findIndex((it: any) => 
          it.productId === newItem.productId &&
          (it.prepType || '') === (newItem.prepType || '') &&
          JSON.stringify(it.addons || []) === JSON.stringify(newItem.addons || []) &&
          JSON.stringify(it.flavor || {}) === JSON.stringify(newItem.flavor || {})
        );

        if (existingIdx >= 0) {
          mergedItems[existingIdx] = {
            ...mergedItems[existingIdx],
            quantity: Number(mergedItems[existingIdx].quantity || 0) + Number(newItem.quantity || 1)
          };
        } else {
          mergedItems.push(newItem);
        }
      }

      // Recalcula o total do pedido
      const itemsTotal = mergedItems.reduce((acc: number, it: any) => {
        const itPrice = Number(it.price) || 0;
        const itQty = Number(it.quantity) || 1;
        const addonsPrice = Array.isArray(it.addons) ? it.addons.reduce((aSum: number, a: any) => aSum + (Number(a.price) || 0), 0) : 0;
        const flavorPrice = it.flavor?.price ? Number(it.flavor.price) : 0;
        return acc + ((itPrice + addonsPrice + flavorPrice) * itQty);
      }, 0);

      const deliveryFee = Number(existingOrder.deliveryFee) || 0;
      const finalTotal = itemsTotal + deliveryFee;

      const updatedOrder = {
        ...existingOrder,
        items: mergedItems,
        total: finalTotal
      };

      memOrders[existingOrderIndex] = updatedOrder;
      persistOrdersToDisk(memOrders);

      if (isDatabaseConfigured()) {
        try {
          await withDbRetry(() => db.update(orders).set({
            items: JSON.stringify(mergedItems),
            total: finalTotal
          }).where(eq(orders.id, existingOrder.id)));
        } catch (dbErr) {
          console.warn('[DB Append Order Error]:', dbErr);
        }
      }

      onUpdate?.('orders');

      broadcastSSE({
        type: 'sync',
        target: 'orders',
        action: 'order_appended',
        orderId: existingOrder.id,
        items: mergedItems,
        total: finalTotal,
        time: Date.now()
      });

      return res.json({
        success: true,
        order: updatedOrder,
        message: `Acréscimo realizado com sucesso no Pedido #${String(existingOrder.id).slice(-4)}!`
      });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Erro ao processar acréscimo no pedido.' });
    }
  });

  app.delete('/api/db/orders', async (req: Request, res: Response) => {
    memOrders = [];
    persistOrdersToDisk(memOrders);
    broadcastSSE({ type: 'sync', target: 'orders', action: 'clear_all', time: Date.now() });

    if (isDatabaseConfigured()) {
      try {
        await withDbRetry(() => db.delete(orders));
        console.log('[DB Orders] Todos os pedidos foram apagados do PostgreSQL com sucesso.');
      } catch (error: any) {
        console.warn('Erro ao limpar todos os pedidos no DB:', error);
      }
    }
    onUpdate?.('orders');
    res.json({ success: true, message: 'Todos os pedidos foram zerados com sucesso.' });
  });

  app.delete('/api/db/orders/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const targetId = String(id).trim();
      console.log(`[API] DELETE order requested: "${targetId}"`);
      
      const beforeCount = memOrders.length;
      memOrders = memOrders.filter(o => String(o.id).trim() !== targetId);
      const afterCount = memOrders.length;
      
      console.log(`[API] memOrders count: ${beforeCount} -> ${afterCount}`);
      persistOrdersToDisk(memOrders);

      broadcastSSE({ type: 'sync', target: 'orders', orderId: targetId, action: 'delete', time: Date.now() });

      if (isDatabaseConfigured()) {
        try {
          const deleted = await withDbRetry(() => db.delete(orders).where(eq(orders.id, targetId)).returning());
          console.log(`[API] DB delete result:`, deleted);
        } catch (error: any) {
          console.error(`[API] DB delete error:`, error.message);
        }
      }
      onUpdate?.('orders');
      res.json({ success: true, id: targetId });
    } catch (err: any) {
      console.error(`[API] Global delete error:`, err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // Store Info
  app.get('/api/db/store-info', (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    res.json(sanitizeStoreInfoPrinters(memStoreInfo));
  });

  app.put('/api/db/store-info', async (req: Request, res: Response) => {
    try {
      const body = req.body || {};
      const sanitized: any = { id: 'default' };

      if (body.name !== undefined) sanitized.name = String(body.name);
      if (body.themeColor !== undefined) sanitized.themeColor = String(body.themeColor);
      if (body.addButtonColor !== undefined) sanitized.addButtonColor = String(body.addButtonColor);
      if (body.iconColor !== undefined) sanitized.iconColor = String(body.iconColor);
      if (body.headerPhrase !== undefined) sanitized.headerPhrase = String(body.headerPhrase);
      if (body.logoUrl !== undefined && body.logoUrl !== null) {
        const strLogo = String(body.logoUrl).trim();
        // Do not let empty string or default overwrite an already uploaded logo unless explicitly intended
        if (strLogo && strLogo !== '') {
          sanitized.logoUrl = strLogo;
        } else if (memStoreInfo.logoUrl) {
          sanitized.logoUrl = memStoreInfo.logoUrl;
        }
      }
      if (body.address !== undefined) sanitized.address = String(body.address);
      if (body.hours !== undefined) sanitized.hours = String(body.hours);
      if (body.instagram !== undefined) sanitized.instagram = String(body.instagram);
      if (body.whatsapp !== undefined) sanitized.whatsapp = String(body.whatsapp);
      if (body.categoryTitleColor !== undefined) sanitized.categoryTitleColor = String(body.categoryTitleColor);
      if (body.deliveryEnabled !== undefined) sanitized.deliveryEnabled = Boolean(body.deliveryEnabled);
      if (body.deliveryScheduleEnabled !== undefined) sanitized.deliveryScheduleEnabled = Boolean(body.deliveryScheduleEnabled);
      if (body.deliveryScheduleSlots !== undefined) {
        sanitized.deliveryScheduleSlots = typeof body.deliveryScheduleSlots === 'string'
          ? body.deliveryScheduleSlots
          : JSON.stringify(body.deliveryScheduleSlots);
      }
      if (body.scheduleSlotItemCapacity !== undefined) sanitized.scheduleSlotItemCapacity = Number(body.scheduleSlotItemCapacity) || 100;
      if (body.schedulePrepTimeNormalMinutes !== undefined) sanitized.schedulePrepTimeNormalMinutes = Number(body.schedulePrepTimeNormalMinutes) || 40;
      if (body.schedulePrepTimeFrozenMinutes !== undefined) sanitized.schedulePrepTimeFrozenMinutes = Number(body.schedulePrepTimeFrozenMinutes) || 90;
      if (body.inStoreEnabled !== undefined) sanitized.inStoreEnabled = Boolean(body.inStoreEnabled);
      if (body.kioskEnabled !== undefined) sanitized.kioskEnabled = Boolean(body.kioskEnabled);
      if (body.requireQrCodeForOrdering !== undefined) sanitized.requireQrCodeForOrdering = Boolean(body.requireQrCodeForOrdering);
      if (body.isOpen !== undefined) sanitized.isOpen = Boolean(body.isOpen);
      if (body.ntfyTopic !== undefined) sanitized.ntfyTopic = String(body.ntfyTopic);
      if (body.ntfyEnabled !== undefined) sanitized.ntfyEnabled = Boolean(body.ntfyEnabled);
      if (body.tvTickerText !== undefined) sanitized.tvTickerText = String(body.tvTickerText);
      if (body.tvMode !== undefined) sanitized.tvMode = String(body.tvMode);
      if (body.tvSoundEnabled !== undefined) sanitized.tvSoundEnabled = Boolean(body.tvSoundEnabled);
      if (body.tvShowClock !== undefined) sanitized.tvShowClock = Boolean(body.tvShowClock);
      if (body.tvShowCaptions !== undefined) sanitized.tvShowCaptions = Boolean(body.tvShowCaptions);
      if (body.isMaintenance !== undefined) sanitized.isMaintenance = Boolean(body.isMaintenance);
      if (body.maintenanceMessage !== undefined) sanitized.maintenanceMessage = String(body.maintenanceMessage);
      if (body.smsReminderTime1 !== undefined) sanitized.smsReminderTime1 = String(body.smsReminderTime1);
      if (body.smsReminderTime2 !== undefined) sanitized.smsReminderTime2 = String(body.smsReminderTime2);
      if (body.smsReminderTime3 !== undefined) sanitized.smsReminderTime3 = String(body.smsReminderTime3);
      if (body.smsRemindersEnabled !== undefined) sanitized.smsRemindersEnabled = Boolean(body.smsRemindersEnabled);
      if (body.autoSmsWebhookUrl !== undefined) sanitized.autoSmsWebhookUrl = String(body.autoSmsWebhookUrl);
      if (body.autoSmsApiKey !== undefined) sanitized.autoSmsApiKey = String(body.autoSmsApiKey);
      if (body.weeklySchedule !== undefined) {
        sanitized.weeklySchedule = typeof body.weeklySchedule === 'string'
          ? body.weeklySchedule
          : JSON.stringify(body.weeklySchedule);
      }
      if (body.autoOpenClose !== undefined) sanitized.autoOpenClose = Boolean(body.autoOpenClose);
      if (body.forceOpen !== undefined) sanitized.forceOpen = Boolean(body.forceOpen);
      if (body.closedMessage !== undefined) sanitized.closedMessage = String(body.closedMessage);
      if (body.aiAgentEnabled !== undefined) sanitized.aiAgentEnabled = Boolean(body.aiAgentEnabled);
      if (body.aiAgentName !== undefined) sanitized.aiAgentName = String(body.aiAgentName);
      if (body.aiAgentTone !== undefined) sanitized.aiAgentTone = String(body.aiAgentTone);
      if (body.aiAgentCustomPrompt !== undefined) sanitized.aiAgentCustomPrompt = String(body.aiAgentCustomPrompt);
      if (body.aiAgentWhatsAppPhone !== undefined) sanitized.aiAgentWhatsAppPhone = String(body.aiAgentWhatsAppPhone);
      if (body.aiAgentWhatsAppDefaultMessage !== undefined) sanitized.aiAgentWhatsAppDefaultMessage = String(body.aiAgentWhatsAppDefaultMessage);
      if (body.aiAgentTrainingExamples !== undefined) {
        sanitized.aiAgentTrainingExamples = typeof body.aiAgentTrainingExamples === 'string'
          ? body.aiAgentTrainingExamples
          : JSON.stringify(body.aiAgentTrainingExamples);
      }
      if (body.aiAgentKnowledgeBase !== undefined) sanitized.aiAgentKnowledgeBase = String(body.aiAgentKnowledgeBase);
      if (body.aiAgentForbiddenPhrases !== undefined) sanitized.aiAgentForbiddenPhrases = String(body.aiAgentForbiddenPhrases);
      if (body.aiAgentCreativity !== undefined) sanitized.aiAgentCreativity = Number(body.aiAgentCreativity) || 0.65;
      if (body.aiAgentAntiRepeat !== undefined) sanitized.aiAgentAntiRepeat = Boolean(body.aiAgentAntiRepeat);
      if (body.preferredPrinterName !== undefined) sanitized.preferredPrinterName = String(body.preferredPrinterName);
      if (body.caixaPrinterName !== undefined) sanitized.caixaPrinterName = String(body.caixaPrinterName);
      if (body.autoPrintOrdersOnCaixa !== undefined) sanitized.autoPrintOrdersOnCaixa = Boolean(body.autoPrintOrdersOnCaixa);
      if (body.printerConnectionType !== undefined) sanitized.printerConnectionType = String(body.printerConnectionType);
      if (body.networkPrinterIp !== undefined) sanitized.networkPrinterIp = String(body.networkPrinterIp);
      if (body.networkPrinterPort !== undefined) sanitized.networkPrinterPort = Number(body.networkPrinterPort) || 9100;
      if (body.printerCutMode !== undefined) sanitized.printerCutMode = String(body.printerCutMode);
      if (body.printerCopies !== undefined) sanitized.printerCopies = Number(body.printerCopies) || 2;
      if (body.totemPrinterCutMode !== undefined) sanitized.totemPrinterCutMode = String(body.totemPrinterCutMode);
      if (body.totemPrinterCopies !== undefined) sanitized.totemPrinterCopies = Number(body.totemPrinterCopies) || 2;
      if (body.totemPrinterBottomSpaceCm !== undefined) sanitized.totemPrinterBottomSpaceCm = Number(body.totemPrinterBottomSpaceCm) || 2.5;
      if (body.windowsPrinterCutMode !== undefined) sanitized.windowsPrinterCutMode = String(body.windowsPrinterCutMode);
      if (body.windowsPrinterCopies !== undefined) sanitized.windowsPrinterCopies = Number(body.windowsPrinterCopies) || 2;
      if (body.windowsPrinterBottomSpaceCm !== undefined) sanitized.windowsPrinterBottomSpaceCm = Number(body.windowsPrinterBottomSpaceCm) || 6.0;
      if (body.configuredPrinters !== undefined) {
        sanitized.configuredPrinters = typeof body.configuredPrinters === 'string'
          ? body.configuredPrinters
          : JSON.stringify(body.configuredPrinters);
      }
      if (body.tvSelectedCategories !== undefined) {
        sanitized.tvSelectedCategories = typeof body.tvSelectedCategories === 'string'
          ? body.tvSelectedCategories
          : JSON.stringify(body.tvSelectedCategories);
      }
      if (body.mercadoPagoEnabled !== undefined) sanitized.mercadoPagoEnabled = Boolean(body.mercadoPagoEnabled);
      if (body.mercadoPagoAccessToken !== undefined) sanitized.mercadoPagoAccessToken = String(body.mercadoPagoAccessToken);
      if (body.mercadoPagoPublicKey !== undefined) sanitized.mercadoPagoPublicKey = String(body.mercadoPagoPublicKey);
      if (body.mercadoPagoPixKey !== undefined) sanitized.mercadoPagoPixKey = String(body.mercadoPagoPixKey);
      if (body.deliveryEstimatedTimeMin !== undefined) sanitized.deliveryEstimatedTimeMin = Number(body.deliveryEstimatedTimeMin) || 35;
      if (body.deliveryEstimatedTimeMax !== undefined) sanitized.deliveryEstimatedTimeMax = Number(body.deliveryEstimatedTimeMax) || 50;
      if (body.showSystemIntroButton !== undefined) sanitized.showSystemIntroButton = Boolean(body.showSystemIntroButton);

      // Preserve existing memory properties if not explicitly provided
      memStoreInfo = { ...memStoreInfo, ...sanitized };
      persistStoreInfoToDisk(memStoreInfo);

      if (isDatabaseConfigured()) {
        try {
          let currentDbRow = {};
          try {
            const list = await withDbRetry(() => db.select().from(storeInfo).where(eq(storeInfo.id, 'default')));
            if (list.length > 0) currentDbRow = list[0];
          } catch (e: any) {
            console.warn('[DB] Select prévio em store_info:', e?.message);
          }

          const fullRecordToPersist = { ...DEFAULT_STORE_INFO, ...currentDbRow, ...memStoreInfo, ...sanitized, id: 'default' };
          memStoreInfo = fullRecordToPersist;
          persistStoreInfoToDisk(memStoreInfo);

          try {
            await withDbRetry(() => db.insert(storeInfo)
              .values(fullRecordToPersist)
              .onConflictDoUpdate({
                target: storeInfo.id,
                set: fullRecordToPersist
              }));
            console.log('[DB] store_info salvo com sucesso no PostgreSQL!');
          } catch (dbErr: any) {
            console.error('[DB Error] Falha ao gravar store_info no PostgreSQL, executando ensureTablesExist...', dbErr?.message || dbErr);
            try {
              await ensureTablesExist();
              await withDbRetry(() => db.insert(storeInfo)
                .values(fullRecordToPersist)
                .onConflictDoUpdate({
                  target: storeInfo.id,
                  set: fullRecordToPersist
                }));
              console.log('[DB] store_info salvo com sucesso no PostgreSQL após atualizar colunas!');
            } catch (retryErr: any) {
              console.error('[DB Error] Falha persistente ao salvar store_info no PostgreSQL:', retryErr?.message || retryErr);
            }
          }

          onUpdate?.('tv');
          return res.json(memStoreInfo);
        } catch (dbErr: any) {
          console.error('Database update error for storeInfo:', dbErr);
          onUpdate?.('tv');
          return res.json(memStoreInfo);
        }
      }
      onUpdate?.('tv');
      return res.json(memStoreInfo);
    } catch (error: any) {
      console.error('Error in PUT /api/db/store-info:', error);
      return res.status(500).json({ error: error.message || 'Erro ao atualizar dados' });
    }
  });

  // Diagnostic DB connection endpoint
  app.get('/api/db-status', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    const configured = isDatabaseConfigured();
    let connected = false;
    let dbHost = 'Nenhum (Modo Local/Memória)';
    let error: string | null = null;

    if (configured) {
      try {
        const testRes = await testDatabaseConnection();
        connected = testRes.ok;
        if (testRes.host) dbHost = testRes.host;
        if (testRes.error) error = testRes.error;
      } catch (err: any) {
        connected = false;
        error = err?.message || String(err);
      }
    }

    res.json({
      configured,
      connected,
      dbHost,
      error,
      mode: connected ? 'postgresql' : (configured ? 'postgresql_error' : 'memory_fallback'),
      counts: {
        products: memProducts.length,
        categories: memCategories.length,
        orders: memOrders.length,
        customers: memCustomers.length,
        tables: memTables.length,
        tvMedia: memTvMedia.length,
      },
      storeName: memStoreInfo?.name || DEFAULT_STORE_INFO.name,
      serverTime: new Date().toISOString()
    });
  });

  // Dynamic App Icon endpoint (serves the exact store logo as real PNG/image for PWA and favicon)
  app.get(['/api/app-icon.png', '/api/app-icon', '/app-icon.png'], (req: Request, res: Response) => {
    try {
      const currentLogo = memStoreInfo?.logoUrl || DEFAULT_STORE_INFO.logoUrl;
      if (currentLogo && currentLogo.startsWith('data:image/')) {
        const matches = currentLogo.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
        if (matches) {
          const mimeType = matches[1] === 'svg+xml' ? 'image/svg+xml' : `image/${matches[1]}`;
          const buffer = Buffer.from(matches[2], 'base64');
          res.setHeader('Content-Type', mimeType);
          res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=43200');
          return res.send(buffer);
        }
      }
      
      // External URL redirect or fallback
      if (currentLogo && currentLogo.startsWith('http')) {
        return res.redirect(currentLogo);
      }
      
      const cleanPath = (currentLogo || 'logo.svg').replace(/^\//, '');
      const localFile = path.join(process.cwd(), 'public', cleanPath);
      if (fs.existsSync(localFile)) {
        res.setHeader('Cache-Control', 'public, max-age=86400');
        if (cleanPath.endsWith('.svg')) res.setHeader('Content-Type', 'image/svg+xml');
        if (cleanPath.endsWith('.png')) res.setHeader('Content-Type', 'image/png');
        return res.sendFile(localFile);
      }
      return res.sendFile(path.join(process.cwd(), 'public', 'logo.svg'));
    } catch (err) {
      return res.sendFile(path.join(process.cwd(), 'public', 'logo.svg'));
    }
  });

  // Auth
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const emailClean = email.trim().toLowerCase();
      if (emailClean === 'admin@donamara.com.br' && (password === 'donamara@123' || password === 'admin123')) {
        return res.json({
          success: true,
          user: {
            id: 2,
            uid: 'master-4',
            name: 'Admin Master',
            email: 'admin@donamara.com.br',
            role: 'master'
          }
        });
      }

      let user = memUsers.find(u => u.email?.toLowerCase() === emailClean);

      if (isDatabaseConfigured()) {
        try {
          const dbUsers = await db.select().from(users).where(eq(users.email, emailClean));
          if (dbUsers.length > 0) {
            user = dbUsers[0];
          }
        } catch (_) {}
      }

      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }

      if (user.password !== password) {
        return res.status(401).json({ error: 'Invalid password' });
      }

      res.json({ 
        success: true, 
        user: {
          id: user.id,
          uid: user.uid,
          name: user.name,
          email: user.email,
          role: emailClean === 'admin@donamara.com.br' ? 'master' : user.role
        }
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Login failed', details: error.message });
    }
  });

  // Users
  app.get('/api/db/users', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    if (!isDatabaseConfigured()) {
      return res.json(memUsers);
    }
    try {
      let list = await db.select().from(users);
      if (list.length === 0) {
        for (const admin of DEFAULT_USERS) {
          await db.insert(users).values(admin).onConflictDoNothing();
        }
        list = await db.select().from(users);
      }
      memUsers = list;
      res.json(list);
    } catch (error: any) {
      res.json(memUsers);
    }
  });

  app.post('/api/db/users', async (req: Request, res: Response) => {
    const data = { ...req.body };
    const emailClean = (data.email || '').trim().toLowerCase();
    if (!emailClean) {
      return res.status(400).json({ error: 'Email é obrigatório' });
    }

    const uid = data.uid || (data.id && isNaN(Number(data.id)) ? String(data.id) : null) || `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    const userData = {
      uid,
      email: emailClean,
      name: data.name || emailClean.split('@')[0],
      role: data.role || 'padrao',
      password: data.password || '123456',
    };

    memUsers = [...memUsers.filter(u => (u.email || '').toLowerCase() !== emailClean && u.uid !== uid), userData];
    persistUsersToDisk(memUsers);

    if (isDatabaseConfigured()) {
      try {
        const existing = await db.select().from(users).where(eq(users.email, emailClean));
        if (existing.length > 0) {
          const updatePayload: any = {
            name: userData.name,
            role: userData.role,
          };
          if (data.password) {
            updatePayload.password = data.password;
          }
          const updated = await db.update(users).set(updatePayload).where(eq(users.email, emailClean)).returning();
          return res.json(updated[0] || userData);
        }
        const result = await db.insert(users).values(userData).returning();
        return res.json(result[0] || userData);
      } catch (error: any) {
        console.error('User DB insert error:', error);
        return res.json(userData);
      }
    }
    res.json(userData);
  });

  app.put('/api/db/users/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const data = { ...req.body };
    delete data.id;

    memUsers = memUsers.map(u => (String(u.id) === String(id) || u.uid === id) ? { ...u, ...data } : u);
    persistUsersToDisk(memUsers);

    if (isDatabaseConfigured()) {
      try {
        let result;
        if (!isNaN(Number(id))) {
          result = await db.update(users).set(data).where(eq(users.id, Number(id))).returning();
        } else {
          result = await db.update(users).set(data).where(eq(users.uid, id)).returning();
        }
        return res.json(result[0] || { id, ...data });
      } catch (error: any) {
        return res.json({ id, ...data });
      }
    }
    res.json({ id, ...data });
  });

  app.delete('/api/db/users/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    memUsers = memUsers.filter(u => String(u.id) !== String(id) && u.uid !== id);
    persistUsersToDisk(memUsers);

    if (isDatabaseConfigured()) {
      try {
        if (!isNaN(Number(id))) {
          await db.delete(users).where(eq(users.id, Number(id)));
        } else {
          await db.delete(users).where(eq(users.uid, id));
        }
      } catch (error: any) {}
    }
    res.json({ success: true, id });
  });

  // Smart TV Media Playlist
  app.get('/api/db/tv-media', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    if (!isDatabaseConfigured()) {
      return res.json(memTvMedia);
    }
    try {
      let list = await db.select().from(tvMedia).orderBy(asc(tvMedia.order));
      if (list && list.length > 0) {
        memTvMedia = list;
      }
      return res.json(list && list.length > 0 ? list : memTvMedia);
    } catch (error: any) {
      return res.json(memTvMedia);
    }
  });

  app.post('/api/db/tv-media', async (req: Request, res: Response) => {
    const data = { ...req.body };
    const id = String(data.id || `tv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
    
    const url = String(data.url || '').trim();
    let type = String(data.type || 'video');

    if (url.startsWith('data:video') || url.startsWith('blob:') || /\.(mp4|webm|mov|m4v|ogg|avi|mkv)(\?.*)?$/i.test(url)) {
      type = 'video';
    } else if (url.startsWith('data:image') || /\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i.test(url)) {
      type = 'image';
    } else if (type === 'youtube' || url.includes('youtube.com') || url.includes('youtu.be')) {
      type = 'youtube';
    }

    const insertData = {
      id,
      title: String(data.title || 'Vídeo TV').trim(),
      type,
      url,
      durationSeconds: Number(data.durationSeconds || data.duration_seconds || 15),
      order: Number(data.order ?? memTvMedia.length + 1),
      showCaptions: data.showCaptions !== undefined ? Boolean(data.showCaptions) : (data.show_captions !== undefined ? Boolean(data.show_captions) : false),
      fitMode: String(data.fitMode || data.fit_mode || (url.includes('/shorts/') ? 'vertical_smartphone' : 'fit')),
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : true
    };

    memTvMedia = [...memTvMedia.filter(m => String(m.id) !== id), insertData];
    persistTvMediaToDisk(memTvMedia);

    if (isDatabaseConfigured()) {
      try {
        const result = await db.insert(tvMedia).values(insertData).onConflictDoUpdate({
          target: tvMedia.id,
          set: insertData
        }).returning();
        onUpdate?.('tv');
        return res.json(result[0] || insertData);
      } catch {
        onUpdate?.('tv');
        return res.json(insertData);
      }
    }
    onUpdate?.('tv');
    res.json(insertData);
  });

  app.put('/api/db/tv-media/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const data = { ...req.body };
    delete data.id;

    const updateData: any = {};
    if (data.title !== undefined) updateData.title = String(data.title).trim();
    if (data.type !== undefined) updateData.type = String(data.type);
    if (data.url !== undefined) {
      updateData.url = String(data.url).trim();
      if (updateData.url.startsWith('data:video') || updateData.url.startsWith('blob:') || /\.(mp4|webm|mov|m4v|ogg|avi|mkv)(\?.*)?$/i.test(updateData.url)) {
        updateData.type = 'video';
      } else if (updateData.url.startsWith('data:image') || /\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i.test(updateData.url)) {
        updateData.type = 'image';
      } else if (updateData.url.includes('youtube.com') || updateData.url.includes('youtu.be')) {
        updateData.type = 'youtube';
      }
    }
    if (data.durationSeconds !== undefined || data.duration_seconds !== undefined) {
      updateData.durationSeconds = Number(data.durationSeconds ?? data.duration_seconds);
    }
    if (data.order !== undefined) updateData.order = Number(data.order);
    if (data.showCaptions !== undefined || data.show_captions !== undefined) {
      updateData.showCaptions = Boolean(data.showCaptions ?? data.show_captions);
    }
    if (data.fitMode !== undefined || data.fit_mode !== undefined) {
      updateData.fitMode = String(data.fitMode ?? data.fit_mode);
    }
    if (data.isActive !== undefined || data.is_active !== undefined) {
      updateData.isActive = Boolean(data.isActive ?? data.is_active);
    }

    memTvMedia = memTvMedia.map(m => String(m.id) === String(id) ? { ...m, ...updateData } : m);
    persistTvMediaToDisk(memTvMedia);

    if (isDatabaseConfigured()) {
      try {
        const result = await db.update(tvMedia).set(updateData).where(eq(tvMedia.id, id)).returning();
        onUpdate?.('tv');
        return res.json(result[0] || { id, ...updateData });
      } catch (updateErr: any) {
        onUpdate?.('tv');
        return res.json({ id, ...updateData });
      }
    }
    onUpdate?.('tv');
    res.json({ id, ...updateData });
  });

  app.delete('/api/db/tv-media/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    memTvMedia = memTvMedia.filter(m => String(m.id) !== String(id));
    persistTvMediaToDisk(memTvMedia);

    if (isDatabaseConfigured()) {
      try {
        await db.delete(tvMedia).where(eq(tvMedia.id, id));
      } catch (delErr: any) {}
    }
    onUpdate?.('tv');
    res.json({ success: true, id });
  });

  // App Installations (PWA tracking)
  app.get('/api/db/app-installs', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    if (!isDatabaseConfigured()) {
      return res.json({
        count: memAppInstalls.length,
        installs: memAppInstalls
      });
    }
    try {
      const list = await db.select().from(appInstalls).orderBy(desc(appInstalls.installedAt));
      memAppInstalls = list;
      return res.json({
        count: list.length,
        installs: list
      });
    } catch (err: any) {
      return res.json({
        count: memAppInstalls.length,
        installs: memAppInstalls
      });
    }
  });

  app.post('/api/db/app-installs', async (req: Request, res: Response) => {
    const data = req.body || {};
    const id = String(data.id || `install_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`);
    const installedAt = Number(data.installedAt || Date.now());
    const platform = String(data.platform || 'unknown');
    const browser = String(data.browser || 'unknown');
    const deviceType = String(data.deviceType || 'mobile');
    const userAgent = String(data.userAgent || req.headers['user-agent'] || '');

    const record = {
      id,
      platform,
      browser,
      deviceType,
      installedAt,
      userAgent
    };

    // Deduplicate in memory
    const existingIndex = memAppInstalls.findIndex(i => i.id === id);
    if (existingIndex >= 0) {
      memAppInstalls[existingIndex] = record;
    } else {
      memAppInstalls = [record, ...memAppInstalls];
    }

    if (isDatabaseConfigured()) {
      try {
        const result = await db.insert(appInstalls).values(record).onConflictDoUpdate({
          target: appInstalls.id,
          set: record
        }).returning();
        onUpdate?.('catalog');
        return res.json({ success: true, install: result[0] || record, count: memAppInstalls.length });
      } catch (err: any) {
        onUpdate?.('catalog');
        return res.json({ success: true, install: record, count: memAppInstalls.length });
      }
    }

    onUpdate?.('catalog');
    return res.json({ success: true, install: record, count: memAppInstalls.length });
  });

  // Customers & Leads Management Endpoints
  app.get('/api/db/customers', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    if (!isDatabaseConfigured()) {
      return res.json(memCustomers);
    }
    try {
      const list = await db.select().from(customers).orderBy(desc(customers.createdAt));
      // Sync memory with DB if DB returned items
      if (list && list.length > 0) {
        memCustomers = list.map(c => ({
          ...c,
          tags: typeof c.tags === 'string' ? c.tags : JSON.stringify(c.tags || [])
        }));
      }
      return res.json(memCustomers);
    } catch (err: any) {
      return res.json(memCustomers);
    }
  });

  app.post('/api/db/customers', async (req: Request, res: Response) => {
    try {
      const body = req.body || {};
      const saved = await upsertCustomerLead({
        name: body.name,
        phone: body.phone,
        email: body.email,
        cpf: body.cpf,
        password: body.password,
        address: body.address,
        source: body.source || 'cadastro_cardapio',
        orderTotal: Number(body.orderTotal) || 0,
        isOrder: !!body.isOrder,
        tags: Array.isArray(body.tags) ? body.tags : typeof body.tags === 'string' ? JSON.parse(body.tags || '[]') : [],
        notes: body.notes,
        status: body.status,
        monthlyGoal: body.monthlyGoal !== undefined ? Number(body.monthlyGoal) || 0 : undefined
      });
      onUpdate?.('catalog');
      return res.json(saved || { success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Erro ao salvar cliente' });
    }
  });

  app.post('/api/db/customers/batch', async (req: Request, res: Response) => {
    try {
      const items: any[] = Array.isArray(req.body) ? req.body : (Array.isArray(req.body?.customers) ? req.body.customers : []);
      if (!Array.isArray(items) || items.length === 0) {
        return res.json({ success: true, count: 0 });
      }

      const itemById = new Map<string, any>();
      const itemByExtId = new Map<string, any>();
      const itemByCpf = new Map<string, any>();
      const itemByPhone = new Map<string, any>();

      for (const c of memCustomers) {
        if (c.id) itemById.set(String(c.id), c);
        if (c.externalId && String(c.externalId).trim() !== '' && String(c.externalId).trim() !== '0') {
          itemByExtId.set(String(c.externalId).trim(), c);
        }
        const cpfDigits = String(c.cpf || '').replace(/\D/g, '');
        if (cpfDigits.length >= 11) itemByCpf.set(cpfDigits, c);
        const phoneDigits = cleanPhoneDigits(c.phone);
        if (phoneDigits.length >= 8) itemByPhone.set(phoneDigits, c);
      }

      const mergedItems: any[] = [];
      for (const raw of items) {
        const extId = raw.externalId ? String(raw.externalId).trim() : (raw.external_id ? String(raw.external_id).trim() : '');
        const cpfDigits = String(raw.cpf || '').replace(/\D/g, '');
        const phoneDigits = cleanPhoneDigits(raw.phone);

        let existing = (raw.id && itemById.get(String(raw.id))) ||
                       (extId && extId !== '0' && (itemByExtId.get(extId) || itemById.get(`bf_cust_${extId}`))) ||
                       (cpfDigits.length >= 11 && itemByCpf.get(cpfDigits)) ||
                       (phoneDigits.length >= 8 && itemByPhone.get(phoneDigits)) ||
                       null;

        const finalCpf = (raw.cpf && String(raw.cpf).trim()) ? String(raw.cpf).trim() : (existing?.cpf || '');
        const finalCpfDigits = finalCpf.replace(/\D/g, '');
        const defaultPass = finalCpfDigits.length >= 5 ? finalCpfDigits.slice(0, 5) : '12345';

        const formatted = formatCustomerForDb({
          ...(existing || {}),
          ...raw,
          id: existing?.id || raw.id || (extId && extId !== '0' ? `bf_cust_${extId}` : `cust_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`),
          externalId: extId || existing?.externalId || null,
          phone: (raw.phone && String(raw.phone).trim()) ? String(raw.phone).trim() : (existing?.phone || ''),
          email: (raw.email && String(raw.email).trim()) ? String(raw.email).trim() : (existing?.email || ''),
          cpf: finalCpf,
          address: (raw.address && String(raw.address).trim()) ? String(raw.address).trim() : (existing?.address || ''),
          street: (raw.street && String(raw.street).trim()) ? String(raw.street).trim() : (existing?.street || ''),
          number: (raw.number && String(raw.number).trim()) ? String(raw.number).trim() : (existing?.number || ''),
          complement: (raw.complement && String(raw.complement).trim()) ? String(raw.complement).trim() : (existing?.complement || ''),
          neighborhood: (raw.neighborhood && String(raw.neighborhood).trim()) ? String(raw.neighborhood).trim() : (existing?.neighborhood || ''),
          cep: (raw.cep && String(raw.cep).trim()) ? String(raw.cep).trim() : (existing?.cep || ''),
          totalOrders: existing?.totalOrders ?? raw.totalOrders ?? 0,
          totalSpent: existing?.totalSpent ?? raw.totalSpent ?? 0,
          lastOrderAt: existing?.lastOrderAt ?? raw.lastOrderAt ?? null,
          createdAt: existing?.createdAt ?? raw.createdAt ?? Date.now(),
          password: (existing?.password && existing.password !== '123456') ? existing.password : ((raw.password && raw.password !== '123456') ? raw.password : defaultPass),
          status: existing?.status === 'rejected' ? 'rejected' : (existing?.status === 'pending' && raw.source !== 'bluefocus_erp' ? 'pending' : (raw.status || 'approved')),
          monthlyGoal: raw.monthlyGoal !== undefined ? Number(raw.monthlyGoal) || 0 : (Number(existing?.monthlyGoal) || 0),
        });

        itemById.set(formatted.id, formatted);
        if (formatted.externalId) itemByExtId.set(formatted.externalId, formatted);
        mergedItems.push(formatted);
      }

      memCustomers = Array.from(itemById.values());
      persistCustomersToDisk(memCustomers);

      if (isDatabaseConfigured()) {
        await saveCustomersToPostgresBatch(mergedItems);
      }
      onUpdate?.('catalog');
      res.json({ success: true, count: mergedItems.length });
    } catch (error: any) {
      console.warn('[DB Customers Batch Error]:', error?.message || error);
      onUpdate?.('catalog');
      res.json({ success: true, count: (req.body || []).length });
    }
  });

  app.put('/api/db/customers/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const data = req.body || {};
    const existingIndex = memCustomers.findIndex(c => c.id === id);
    if (existingIndex >= 0) {
      const updatedCpf = data.cpf !== undefined ? String(data.cpf).trim() : (memCustomers[existingIndex].cpf || '');
      const updatedCpfDigits = updatedCpf.replace(/\D/g, '');
      const updatedDefaultPass = updatedCpfDigits.length >= 5 ? updatedCpfDigits.slice(0, 5) : (memCustomers[existingIndex].password || '12345');
      memCustomers[existingIndex] = {
        ...memCustomers[existingIndex],
        ...data,
        cpf: updatedCpf,
        password: data.password || (data.cpf !== undefined && updatedCpfDigits.length >= 5 ? updatedDefaultPass : memCustomers[existingIndex].password),
        monthlyGoal: data.monthlyGoal !== undefined ? Number(data.monthlyGoal) || 0 : (Number(memCustomers[existingIndex].monthlyGoal) || 0),
        tags: Array.isArray(data.tags) ? JSON.stringify(data.tags) : (data.tags || memCustomers[existingIndex].tags)
      };
      persistCustomersToDisk(memCustomers);
    }

    if (isDatabaseConfigured()) {
      try {
        const payload: any = {
          ...data,
          tags: Array.isArray(data.tags) ? JSON.stringify(data.tags) : data.tags
        };
        if (data.monthlyGoal !== undefined) {
          payload.monthlyGoal = Number(data.monthlyGoal) || 0;
        }
        const result = await db.update(customers).set(payload).where(eq(customers.id, id)).returning();
        onUpdate?.('catalog');
        return res.json(result[0] || memCustomers[existingIndex] || { success: true });
      } catch (err: any) {
        onUpdate?.('catalog');
        return res.json(memCustomers[existingIndex] || { success: true });
      }
    }
    onUpdate?.('catalog');
    res.json(memCustomers[existingIndex] || { success: true });
  });

  app.delete('/api/db/customers/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    memCustomers = memCustomers.filter(c => c.id !== id);
    persistCustomersToDisk(memCustomers);

    if (isDatabaseConfigured()) {
      try {
        await db.delete(customers).where(eq(customers.id, id));
      } catch (err: any) {}
    }
    onUpdate?.('catalog');
    res.json({ success: true, id });
  });

  // Helper para calcular total comprado pelo cliente no mês atual
  const calculateCustomerCurrentMonthSpent = (cust: any): number => {
    if (!cust) return 0;
    const now = new Date();
    const curMonth = now.getMonth();
    const curYear = now.getFullYear();
    const cId = String(cust.id || '');
    const cCpf = String(cust.cpf || '').replace(/\D/g, '');
    const cPhone = cleanPhoneDigits(cust.phone);
    const cName = String(cust.name || '').trim().toLowerCase();

    let sum = 0;
    for (const o of memOrders) {
      if (!o || o.status === 'cancelled' || (o as any).status === 'canceled') continue;
      const oDate = new Date(Number(o.createdAt) || 0);
      if (oDate.getMonth() !== curMonth || oDate.getFullYear() !== curYear) continue;

      const oCustId = String(o.customerId || '');
      const oCpf = String(o.customerCpf || '').replace(/\D/g, '');
      const oPhone = cleanPhoneDigits(o.customerPhone);
      const oName = String(o.customerName || '').trim().toLowerCase();

      const matched =
        (cId && oCustId && cId === oCustId) ||
        (cCpf.length >= 11 && oCpf.length >= 11 && cCpf === oCpf) ||
        (cPhone.length >= 8 && oPhone.length >= 8 && (cPhone === oPhone || cPhone.endsWith(oPhone) || oPhone.endsWith(cPhone))) ||
        (cName && oName && cName === oName);

      if (matched) {
        sum += Number(o.total) || 0;
      }
    }
    return sum;
  };

  app.get('/api/db/customer-profile/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const cleanDigits = String(id || '').replace(/\D/g, '');
      const cust = memCustomers.find(c =>
        c.id === id ||
        (cleanDigits.length >= 11 && String(c.cpf || '').replace(/\D/g, '') === cleanDigits)
      );
      if (!cust) {
        return res.status(404).json({ error: 'Cliente não encontrado.' });
      }
      const currentMonthSpent = calculateCustomerCurrentMonthSpent(cust);
      return res.json({
        success: true,
        customer: cust,
        currentMonthSpent
      });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Erro ao consultar perfil do cliente.' });
    }
  });

  app.post('/api/db/customer-register', async (req: Request, res: Response) => {
    try {
      const { name, phone, email, cpf, password, address, cep, street, number, complement, neighborhood, status, monthlyGoal } = req.body;
      const cleanCpf = String(cpf || '').replace(/\D/g, '');
      if (!name || !cleanCpf || cleanCpf.length < 5) {
        return res.status(400).json({ error: 'Preencha o Nome/Razão Social e um CNPJ ou CPF válido.' });
      }
      if (!phone) {
        return res.status(400).json({ error: 'Informe o WhatsApp / Telefone para contato.' });
      }

      const cleanPhone = String(phone).replace(/\D/g, '');
      const cleanEmail = email ? String(email).trim().toLowerCase() : '';

      const existingByCpf = memCustomers.find(c => {
        const cCpf = String(c.cpf || '').replace(/\D/g, '');
        return cCpf.length >= 5 && (cCpf === cleanCpf || cCpf.replace(/^0+/, '') === cleanCpf.replace(/^0+/, ''));
      });

      if (existingByCpf) {
        if (existingByCpf.status === 'pending') {
          return res.status(400).json({ error: 'Este CNPJ/CPF já possui um cadastro aguardando aprovação do administrador.' });
        }
        if (existingByCpf.status === 'rejected') {
          return res.status(400).json({ error: 'Este CNPJ/CPF possui cadastro reprovado. Entre em contato com o administrador.' });
        }
        return res.status(400).json({ error: 'Este CNPJ/CPF já está cadastrado! Volte para a tela de Login e acesse usando os 5 primeiros dígitos do CNPJ/CPF como senha.' });
      }

      const defaultPassword = cleanCpf.slice(0, 5);
      const finalPassword = (password && String(password).trim().length >= 4) ? String(password).trim() : defaultPassword;
      const finalAddress = address?.trim() || `${street || ''}, ${number || ''}${complement ? ` (${complement})` : ''} - ${neighborhood || ''}${cep ? ` - CEP: ${cep}` : ''}`.replace(/^, /, '').replace(/ - $/, '').trim();
      const finalStatus = 'approved';

      const newCustomer = {
        id: `cust_${Date.now()}`,
        externalId: null,
        name: name.trim(),
        phone: phone.trim(),
        email: cleanEmail,
        cpf: cpf.trim(),
        password: finalPassword,
        address: finalAddress,
        street: street?.trim() || '',
        number: number?.trim() || '',
        complement: complement?.trim() || '',
        neighborhood: neighborhood?.trim() || '',
        cep: cep?.trim() || '',
        source: 'cadastro_cliente',
        totalOrders: 0,
        totalSpent: 0,
        lastOrderAt: null,
        createdAt: Date.now(),
        status: finalStatus,
        minOrderValue: 0,
        monthlyGoal: Number(monthlyGoal) || 0,
        tags: JSON.stringify(['novo_cadastro', 'aprovado']),
        notes: cep ? `CEP Cadastrado: ${cep}` : '',
        defaultAddressId: null
      };

      memCustomers = [newCustomer, ...memCustomers];
      persistCustomersToDisk(memCustomers);

      if (isDatabaseConfigured()) {
        try {
          await db.insert(customers).values(newCustomer).onConflictDoUpdate({
            target: customers.id,
            set: newCustomer
          });
        } catch (e) {
          console.warn('[DB Customer Register Error]:', e);
        }
      }

      onUpdate?.('catalog');

      res.json({ 
        success: true, 
        pendingApproval: false,
        password: finalPassword,
        message: 'Cadastro realizado com sucesso! Você já pode entrar no sistema.',
        customer: newCustomer 
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro ao cadastrar cliente' });
    }
  });

  app.post('/api/db/customer-login', async (req: Request, res: Response) => {
    try {
      const { identifier, password } = req.body;
      if (!identifier || !password) {
        return res.status(400).json({ error: 'Informe o seu CNPJ ou CPF e a senha (5 primeiros dígitos).' });
      }

      const cleanId = String(identifier).trim().toLowerCase();
      const cleanDigits = String(identifier).replace(/\D/g, '');
      const cleanPass = String(password).trim();
      const cleanPassDigits = cleanPass.replace(/\D/g, '');

      // Localizar o cliente pelo CNPJ/CPF (ou código/email/telefone como fallback)
      const custByIdentifier = memCustomers.find(c => {
        const cCpf = String(c.cpf || '').replace(/\D/g, '');
        const cEmail = (c.email || '').trim().toLowerCase();
        const cPhone = String(c.phone || '').replace(/\D/g, '');
        const cExt = String(c.externalId || '').trim().toLowerCase();

        if (cleanDigits.length >= 5 && cCpf.length >= 5) {
          if (cCpf === cleanDigits) return true;
          if (cCpf.replace(/^0+/, '') === cleanDigits.replace(/^0+/, '') && cleanDigits.replace(/^0+/, '').length >= 5) return true;
        }
        if (cEmail.length > 0 && cEmail === cleanId) return true;
        if (cleanDigits.length >= 10 && cPhone === cleanDigits) return true;
        if (cExt.length > 0 && cExt === cleanId) return true;
        return false;
      });

      if (!custByIdentifier) {
        return res.status(401).json({ error: 'CNPJ ou CPF não encontrado no cadastro de clientes.' });
      }

      const cCpf = String(custByIdentifier.cpf || '').replace(/\D/g, '');
      const first5Cpf = cCpf.slice(0, 5);
      const first5Input = cleanDigits.slice(0, 5);
      const storedPass = String(custByIdentifier.password || '').trim();

      const isPassValid =
        (first5Cpf.length >= 5 && (cleanPass === first5Cpf || cleanPassDigits === first5Cpf)) ||
        (first5Input.length >= 5 && (cleanPass === first5Input || cleanPassDigits === first5Input)) ||
        (storedPass.length > 0 && storedPass !== '123456' && storedPass === cleanPass);

      if (!isPassValid) {
        return res.status(401).json({ error: 'Senha incorreta. A senha padrão são os 5 primeiros dígitos do seu CNPJ ou CPF.' });
      }

      if (custByIdentifier.status === 'pending') {
        custByIdentifier.status = 'approved';
        if (isDatabaseConfigured()) {
          try {
            await db.update(customers).set({ status: 'approved' }).where(eq(customers.id, custByIdentifier.id));
          } catch (_) {}
        }
      }

      if (custByIdentifier.status === 'rejected') {
        return res.status(403).json({
          error: 'Seu cadastro não foi aprovado pelo administrador. Entre em contato com a loja.',
          status: 'rejected'
        });
      }

      // Regra de Primeiro Acesso:
      // Se a senha utilizada foi os 5 primeiros dígitos do CNPJ/CPF, ou se a senha cadastrada é a padrão provisória,
      // ou se o cliente nunca alterou a senha (!passwordChangedAt ou mustChangePassword === true),
      // exige troca obrigatória de senha.
      const isDefaultInitialPassword =
        (first5Cpf.length >= 5 && (cleanPass === first5Cpf || cleanPassDigits === first5Cpf)) ||
        (first5Input.length >= 5 && (cleanPass === first5Input || cleanPassDigits === first5Input)) ||
        storedPass === first5Cpf ||
        storedPass === first5Input ||
        storedPass === '123456';

      const mustChangePassword = Boolean(
        isDefaultInitialPassword ||
        (custByIdentifier as any).mustChangePassword === true ||
        !(custByIdentifier as any).passwordChangedAt
      );

      if (mustChangePassword) {
        (custByIdentifier as any).mustChangePassword = true;
      }

      const currentMonthSpent = calculateCustomerCurrentMonthSpent(custByIdentifier);

      res.json({
        success: true,
        customer: custByIdentifier,
        mustChangePassword,
        currentMonthSpent
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro ao realizar login' });
    }
  });

  app.post('/api/db/customer-change-password', async (req: Request, res: Response) => {
    try {
      const { customerId, identifier, newPassword, confirmPassword } = req.body;
      if (!newPassword || typeof newPassword !== 'string') {
        return res.status(400).json({ error: 'Informe a nova senha.' });
      }

      const trimmedNewPass = newPassword.trim();
      if (trimmedNewPass.length < 5) {
        return res.status(400).json({ error: 'A nova senha deve ter no mínimo 5 caracteres.' });
      }

      if (confirmPassword && confirmPassword.trim() !== trimmedNewPass) {
        return res.status(400).json({ error: 'A confirmação de senha não coincide com a nova senha digitada.' });
      }

      const cleanDigits = String(identifier || '').replace(/\D/g, '');
      const cust = memCustomers.find(c => {
        if (customerId && (c.id === customerId || String(c.externalId) === String(customerId))) return true;
        const cCpf = String(c.cpf || '').replace(/\D/g, '');
        if (cleanDigits.length >= 5 && cCpf.length >= 5) {
          if (cCpf === cleanDigits) return true;
          if (cCpf.replace(/^0+/, '') === cleanDigits.replace(/^0+/, '')) return true;
        }
        return false;
      });

      if (!cust) {
        return res.status(404).json({ error: 'Cliente não encontrado.' });
      }

      const cCpfDigits = String(cust.cpf || '').replace(/\D/g, '');
      const first5Cpf = cCpfDigits.slice(0, 5);

      // A nova senha não pode ser igual aos 5 primeiros dígitos do CNPJ ou CPF
      if (first5Cpf.length >= 5 && trimmedNewPass === first5Cpf) {
        return res.status(400).json({
          error: 'A nova senha deve ser diferente dos 5 primeiros dígitos do seu CNPJ ou CPF.'
        });
      }

      // Atualiza a senha e marca que a troca obrigatória foi concluída com sucesso
      cust.password = trimmedNewPass;
      (cust as any).mustChangePassword = false;
      (cust as any).passwordChangedAt = Date.now();

      persistCustomersToDisk(memCustomers);

      if (isDatabaseConfigured()) {
        try {
          await db.update(customers).set({ password: trimmedNewPass }).where(eq(customers.id, cust.id));
        } catch (dbErr) {
          console.warn('[DB Change Password Warning]:', dbErr);
        }
      }

      onUpdate?.('catalog');

      return res.json({
        success: true,
        message: 'Senha alterada com sucesso! Seu acesso está liberado.',
        customer: cust
      });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Erro ao alterar a senha do cliente.' });
    }
  });

  app.post('/api/db/customer-forgot', async (req: Request, res: Response) => {
    try {
      const { identifier } = req.body;
      if (!identifier) {
        return res.status(400).json({ error: 'Informe o seu CNPJ ou CPF cadastrado para recuperar a senha.' });
      }
      const cleanId = String(identifier).trim().toLowerCase();
      const cleanDigits = String(identifier).replace(/\D/g, '');

      const cust = memCustomers.find(c => {
        const cCpf = String(c.cpf || '').replace(/\D/g, '');
        if (cleanDigits.length >= 5 && cCpf.length >= 5) {
          if (cCpf === cleanDigits) return true;
          if (cCpf.replace(/^0+/, '') === cleanDigits.replace(/^0+/, '') && cleanDigits.replace(/^0+/, '').length >= 5) return true;
        }
        const cEmail = (c.email || '').trim().toLowerCase();
        const cPhone = String(c.phone || '').replace(/\D/g, '');
        return (cEmail.length > 0 && cEmail === cleanId) || (cleanDigits.length >= 10 && cPhone === cleanDigits);
      });

      if (!cust) {
        return res.status(404).json({ error: 'Nenhum cliente encontrado com este CNPJ ou CPF.' });
      }

      const cCpf = String(cust.cpf || '').replace(/\D/g, '');
      const recoveredPassword = cCpf.length >= 5 ? cCpf.slice(0, 5) : (cust.password && cust.password !== '123456' ? cust.password : '12345');

      // Garantir que a senha do cliente seja os 5 primeiros dígitos do CNPJ/CPF
      cust.password = recoveredPassword;
      persistCustomersToDisk(memCustomers);
      if (isDatabaseConfigured()) {
        try {
          await db.update(customers).set({ password: recoveredPassword }).where(eq(customers.id, cust.id));
        } catch (e) {}
      }

      res.json({ 
        success: true, 
        customerName: cust.name,
        cpf: cust.cpf,
        status: cust.status || 'approved',
        message: 'Senha recuperada com sucesso!',
        password: recoveredPassword
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro ao recuperar senha' });
    }
  });

  // Endereços do Cliente
  app.get('/api/db/customers/:id/addresses', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (isDatabaseConfigured()) {
        try {
          const addr = await db.select().from(customerAddresses).where(eq(customerAddresses.customerId, id));
          return res.json(addr || []);
        } catch (dbErr) {
          console.warn('[DB] Fallback addresses query:', dbErr);
        }
      }
      res.json([]);
    } catch (err: any) {
      res.json([]);
    }
  });

  app.post('/api/db/customers/:id/addresses', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const data = req.body;
      const newAddr = {
        id: `addr-${Date.now()}`,
        customerId: id,
        alias: data.alias || 'Endereço',
        street: data.street,
        number: data.number,
        complement: data.complement || '',
        neighborhood: data.neighborhood,
        cep: data.cep,
        reference: data.reference || '',
        isDefault: data.isDefault || false,
        createdAt: Date.now()
      };

      if (isDatabaseConfigured()) {
        try {
          if (newAddr.isDefault) {
            await db.update(customerAddresses).set({ isDefault: false }).where(eq(customerAddresses.customerId, id));
          }
          await db.insert(customerAddresses).values(newAddr);
        } catch (dbErr) {
          console.warn('[DB] Fallback insert address:', dbErr);
        }
      }

      res.json({ success: true, address: newAddr });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/db/customers/addresses/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (isDatabaseConfigured()) {
        try {
          await db.delete(customerAddresses).where(eq(customerAddresses.id, id));
        } catch (dbErr) {
          console.warn('[DB] Fallback delete address:', dbErr);
        }
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Histórico de Pedidos do Cliente
  app.get('/api/db/customers/:id/orders', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (isDatabaseConfigured()) {
        try {
          const customerOrders = await db.select().from(orders).where(eq(orders.customerId, id)).orderBy(desc(orders.createdAt));
          if (Array.isArray(customerOrders) && customerOrders.length > 0) {
            return res.json(customerOrders);
          }
        } catch (dbErr) {
          console.warn('[DB] Fallback orders query:', dbErr);
        }
      }
      // fallback in-memory
      const filtered = memOrders.filter(o => 
        (o.customerId && o.customerId === id) || 
        (o.customerPhone && id && id.includes(o.customerPhone.replace(/\D/g, '')))
      ).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      res.json(filtered);
    } catch (err: any) {
      res.json([]);
    }
  });

  // Sync historical leads from orders table
  app.post('/api/db/customers/sync-from-orders', async (req: Request, res: Response) => {
    try {
      let ordersToProcess = [...memOrders];
      if (isDatabaseConfigured()) {
        try {
          const dbOrders = await db.select().from(orders);
          if (dbOrders && dbOrders.length > 0) {
            ordersToProcess = dbOrders;
          }
        } catch (dbErr) {
          // fallback to memOrders
        }
      }

      let count = 0;
      for (const ord of ordersToProcess) {
        // REGRA DE NEGÓCIO: Pedidos feitos pelo totem NÃO viram leads. Apenas delivery e consumo na loja.
        if (ord.type === 'kiosk') continue;

        const custName = (ord.customerName || '').trim();
        const custPhone = (ord.customerPhone || '').trim();
        if ((custName && custName.toLowerCase() !== 'cliente' && custName.toLowerCase() !== 'cliente totem') || custPhone) {
          const isDelivery = ord.type === 'delivery' || ord.deliveryType === 'delivery';
          await upsertCustomerLead({
            name: ord.customerName,
            phone: ord.customerPhone,
            address: ord.deliveryAddress || ord.address || '',
            source: isDelivery ? 'pedido_delivery' : 'pedido_loja',
            orderTotal: Number(ord.total) || 0,
            isOrder: true,
            tags: isDelivery ? ['Cliente', 'Delivery'] : ['Cliente', 'Consumo Loja']
          });
          count++;
        }
      }

      onUpdate?.();
      return res.json({ success: true, synced: count, totalCustomers: memCustomers.length });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Erro ao sincronizar clientes dos pedidos' });
    }
  });

  // Tables & QR Codes endpoints (Controle de Mesas)
  app.get('/api/db/tables', (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json(memTables);
  });

  app.post('/api/db/tables', async (req: Request, res: Response) => {
    try {
      const data = req.body || {};
      const num = parseInt(data.number, 10) || (memTables.length > 0 ? Math.max(...memTables.map(t => t.number || 0)) + 1 : 1);
      const newTable = {
        id: data.id || `table-${num}-${Date.now()}`,
        number: num,
        name: data.name || `Mesa ${String(num).padStart(2, '0')}`,
        section: data.section || 'Salão Principal',
        capacity: parseInt(data.capacity, 10) || 4,
        status: data.status || 'available',
        isActive: data.isActive !== false,
        createdAt: data.createdAt || Date.now(),
      };

      memTables = [...memTables.filter(t => t.id !== newTable.id), newTable].sort((a, b) => (a.number || 0) - (b.number || 0));
      persistTablesToDisk(memTables);

      if (isDatabaseConfigured()) {
        try {
          const result = await db.insert(restaurantTables).values(newTable).onConflictDoUpdate({
            target: restaurantTables.id,
            set: newTable,
          }).returning();
          onUpdate?.('catalog');
          return res.json(result[0] || newTable);
        } catch (dbErr) {
          console.warn('Erro ao salvar mesa no Postgres:', dbErr);
        }
      }

      onUpdate?.('catalog');
      return res.json(newTable);
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Erro ao criar mesa' });
    }
  });

  app.post('/api/db/tables/batch', async (req: Request, res: Response) => {
    try {
      const { tables: newTablesList } = req.body || {};
      if (!Array.isArray(newTablesList) || newTablesList.length === 0) {
        return res.status(400).json({ error: 'Nenhuma mesa enviada para criação em lote' });
      }

      const createdList: any[] = [];
      for (const item of newTablesList) {
        const num = parseInt(item.number, 10) || 1;
        const record = {
          id: item.id || `table-${num}-${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
          number: num,
          name: item.name || `Mesa ${String(num).padStart(2, '0')}`,
          section: item.section || 'Salão Principal',
          capacity: parseInt(item.capacity, 10) || 4,
          status: item.status || 'available',
          isActive: item.isActive !== false,
          createdAt: Date.now(),
        };
        createdList.push(record);
      }

      // Merge into memTables
      for (const c of createdList) {
        const idx = memTables.findIndex(t => t.number === c.number || t.id === c.id);
        if (idx >= 0) {
          memTables[idx] = c;
        } else {
          memTables.push(c);
        }
      }
      memTables.sort((a, b) => (a.number || 0) - (b.number || 0));
      persistTablesToDisk(memTables);

      if (isDatabaseConfigured()) {
        for (const c of createdList) {
          try {
            await db.insert(restaurantTables).values(c).onConflictDoUpdate({
              target: restaurantTables.id,
              set: c
            });
          } catch (err) {}
        }
      }

      onUpdate?.('catalog');
      return res.json({ success: true, count: createdList.length, tables: memTables });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Erro ao processar mesas em lote' });
    }
  });

  app.put('/api/db/tables/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const data = req.body;
    memTables = memTables.map(t => t.id === id ? { ...t, ...data } : t).sort((a, b) => (a.number || 0) - (b.number || 0));
    persistTablesToDisk(memTables);

    if (isDatabaseConfigured()) {
      try {
        const result = await db.update(restaurantTables).set(data).where(eq(restaurantTables.id, id)).returning();
        onUpdate?.('catalog');
        return res.json(result[0] || { id, ...data });
      } catch (error: any) {
        onUpdate?.('catalog');
        return res.json({ id, ...data });
      }
    }
    onUpdate?.('catalog');
    res.json({ id, ...data });
  });

  app.delete('/api/db/tables/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    memTables = memTables.filter(t => t.id !== id);
    persistTablesToDisk(memTables);

    if (isDatabaseConfigured()) {
      try {
        await db.delete(restaurantTables).where(eq(restaurantTables.id, id));
      } catch (err: any) {}
    }
    onUpdate?.('catalog');
    res.json({ success: true, id });
  });

  // Full System Data Backup & Restore endpoints
  app.get('/api/db/backup', (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Content-Disposition', `attachment; filename="donamara-backup-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json({
      storeInfo: memStoreInfo,
      tvMedia: memTvMedia,
      categories: memCategories,
      products: memProducts,
      users: memUsers,
      tables: memTables,
      customers: memCustomers,
      orders: memOrders,
      totemBackups: memTotemBackups,
      drivers: memDrivers,
      deliveryZones: memDeliveryZones,
      exportedAt: new Date().toISOString(),
      version: '2.0.0'
    });
  });

  // Endpoint para ZERAR COMPLETAMENTE o banco de dados (para nova integração ERP)
  app.post('/api/db/reset-all', async (req: Request, res: Response) => {
    try {
      memCategories = [];
      memProducts = [];
      memCustomers = [];
      memOrders = [];
      memTotemBackups = [];
      memTvMedia = [];
      memTables = [];
      memDrivers = [];
      memDeliveryZones = [];
      memAppInstalls = [];
      memStoreInfo = {
        ...memStoreInfo,
        tvSelectedCategories: '[]'
      };

      writeJsonFile(CATEGORIES_FILE, []);
      writeJsonFile(PRODUCTS_FILE, []);
      writeJsonFile(CUSTOMERS_FILE, []);
      writeJsonFile(ORDERS_FILE, []);
      writeJsonFile(ORDERS_BACKUP_FILE, []);
      writeJsonFile(TOTEM_BACKUPS_FILE, []);
      writeJsonFile(TV_MEDIA_FILE, []);
      writeJsonFile(TABLES_FILE, []);
      writeJsonFile(DRIVERS_FILE, []);
      writeJsonFile(DELIVERY_ZONES_FILE, []);
      writeJsonFile(APP_INSTALLS_FILE, []);
      writeJsonFile(STORE_INFO_FILE, memStoreInfo);
      persistAllStateToMasterFile();

      if (isDatabaseConfigured()) {
        const tablesToClear = [
          'categories',
          'products',
          'customers',
          'customer_addresses',
          'orders',
          'totem_backups',
          'tv_media',
          'restaurant_tables',
          'drivers',
          'delivery_zones',
          'app_installs'
        ];
        for (const tbl of tablesToClear) {
          try {
            await pool.query(`DELETE FROM ${tbl}`);
          } catch (e: any) {
            console.warn(`[DB Reset] Aviso ao limpar tabela ${tbl}:`, e?.message);
          }
        }
        try {
          await db.update(storeInfo).set({ tvSelectedCategories: '[]' }).where(eq(storeInfo.id, 'default'));
        } catch (_) {}
      }

      broadcastSSE({ type: 'sync', target: 'reset_all', time: Date.now() });
      onUpdate?.('catalog');
      return res.json({
        success: true,
        message: 'Banco de dados completamente zerado! Categorias, produtos, clientes, pedidos e backups foram limpos.'
      });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Erro ao zerar banco de dados' });
    }
  });

  app.post('/api/db/restore', async (req: Request, res: Response) => {
    try {
      const data = req.body || {};
      let restoredCount = 0;

      if (data.storeInfo && typeof data.storeInfo === 'object') {
        memStoreInfo = { ...DEFAULT_STORE_INFO, ...memStoreInfo, ...data.storeInfo, id: 'default' };
        persistStoreInfoToDisk(memStoreInfo);
        restoredCount++;
      }

      if (Array.isArray(data.tvMedia)) {
        memTvMedia = data.tvMedia;
        persistTvMediaToDisk(memTvMedia);
        restoredCount++;
      }

      if (Array.isArray(data.categories)) {
        memCategories = data.categories;
        persistCategoriesToDisk(memCategories);
        restoredCount++;
      }

      if (Array.isArray(data.products)) {
        memProducts = data.products;
        persistProductsToDisk(memProducts);
        restoredCount++;
      }

      if (Array.isArray(data.users)) {
        memUsers = data.users;
        persistUsersToDisk(memUsers);
        restoredCount++;
      }

      if (Array.isArray(data.tables)) {
        memTables = data.tables;
        persistTablesToDisk(memTables);
        restoredCount++;
      }

      if (Array.isArray(data.customers)) {
        memCustomers = data.customers;
        persistCustomersToDisk(memCustomers);
        restoredCount++;
      }

      if (Array.isArray(data.orders)) {
        memOrders = data.orders;
        persistOrdersToDisk(memOrders);
        restoredCount++;
      }

      if (Array.isArray(data.totemBackups)) {
        memTotemBackups = data.totemBackups;
        persistTotemBackupsToDisk(memTotemBackups);
        restoredCount++;
      }

      if (Array.isArray(data.drivers)) {
        memDrivers = data.drivers;
        persistDriversToDisk(memDrivers);
        restoredCount++;
      }

      if (Array.isArray(data.deliveryZones)) {
        memDeliveryZones = data.deliveryZones;
        persistDeliveryZonesToDisk(memDeliveryZones);
        restoredCount++;
      }

      persistAllStateToMasterFile();

      // If Postgres DB is configured, sync restored items to Postgres tables
      if (isDatabaseConfigured()) {
        try {
          if (data.storeInfo) {
            await db.insert(storeInfo).values(memStoreInfo).onConflictDoUpdate({
              target: storeInfo.id,
              set: memStoreInfo
            });
          }
          if (Array.isArray(data.categories)) {
            for (const c of data.categories) {
              await db.insert(categories).values(c).onConflictDoUpdate({ target: categories.id, set: c });
            }
          }
          if (Array.isArray(data.products)) {
            await saveProductsToPostgresBatch(data.products);
          }
          if (Array.isArray(data.customers)) {
            await saveCustomersToPostgresBatch(data.customers);
          }
          if (Array.isArray(data.tvMedia)) {
            for (const m of data.tvMedia) {
              await db.insert(tvMedia).values(m).onConflictDoUpdate({ target: tvMedia.id, set: m });
            }
          }
          if (Array.isArray(data.tables)) {
            for (const t of data.tables) {
              await db.insert(restaurantTables).values(t).onConflictDoUpdate({ target: restaurantTables.id, set: t });
            }
          }
          if (Array.isArray(data.totemBackups)) {
            for (const tb of data.totemBackups) {
              await db.insert(totemBackups).values(tb).onConflictDoUpdate({ target: totemBackups.id, set: tb });
            }
          }
          if (Array.isArray(data.drivers)) {
            for (const d of data.drivers) {
              await db.insert(drivers).values(d).onConflictDoUpdate({ target: drivers.id, set: d });
            }
          }
          if (Array.isArray(data.deliveryZones)) {
            for (const z of data.deliveryZones) {
              await db.insert(deliveryZones).values(z).onConflictDoUpdate({ target: deliveryZones.id, set: z });
            }
          }
        } catch (dbErr) {
          console.warn('Aviso: Falha parcial ao restaurar no PostgreSQL:', dbErr);
        }
      }

      onUpdate?.();
      return res.json({
        success: true,
        message: 'Backup restaurado com sucesso!',
        restoredCategories: memCategories.length,
        restoredProducts: memProducts.length,
        restoredTvMedia: memTvMedia.length,
        restoredTables: memTables.length
      });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Erro ao restaurar backup' });
    }
  });

  // Snapshot de segurança automático (criado antes de qualquer sincronização ou deploy)
  app.post('/api/db/backup-snapshot', async (req: Request, res: Response) => {
    try {
      const reason = req.body?.reason || 'Snapshot de Segurança';
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const timeStr = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
      const filename = `donamara-backup-pre-sync-${dateStr}_${timeStr}.json`;
      const filepath = path.join(AUTO_BACKUP_DIR, filename);

      const payload = {
        storeInfo: memStoreInfo,
        tvMedia: memTvMedia,
        categories: memCategories,
        products: memProducts,
        users: memUsers,
        tables: memTables,
        customers: memCustomers,
        orders: memOrders,
        totemBackups: memTotemBackups,
        drivers: memDrivers,
        deliveryZones: memDeliveryZones,
        exportedAt: now.toISOString(),
        reason,
        version: '2.0.0'
      };

      if (!fs.existsSync(AUTO_BACKUP_DIR)) {
        fs.mkdirSync(AUTO_BACKUP_DIR, { recursive: true });
      }
      fs.writeFileSync(filepath, JSON.stringify(payload, null, 2), 'utf8');

      // Ponteiro para o snapshot mais recente
      const latestPreSyncPath = path.join(AUTO_BACKUP_DIR, 'donamara-backup-latest-pre-sync.json');
      fs.writeFileSync(latestPreSyncPath, JSON.stringify(payload, null, 2), 'utf8');

      console.log(`[Backup Snapshot] Snapshot pré-sincronização salvo: ${filename} (${reason})`);
      res.json({ success: true, filename, createdAt: now.toISOString() });
    } catch (err: any) {
      console.error('[Backup Snapshot] Erro ao salvar snapshot:', err);
      res.status(500).json({ error: err?.message || 'Erro ao criar snapshot' });
    }
  });

  // Restauração em 1 clique para o snapshot pré-sincronização
  app.post('/api/db/restore-pre-sync', async (req: Request, res: Response) => {
    try {
      const latestPreSyncPath = path.join(AUTO_BACKUP_DIR, 'donamara-backup-latest-pre-sync.json');
      if (!fs.existsSync(latestPreSyncPath)) {
        return res.status(404).json({ error: 'Nenhum snapshot pré-sincronização recente foi encontrado.' });
      }
      const raw = fs.readFileSync(latestPreSyncPath, 'utf8');
      const data = JSON.parse(raw);

      if (data.categories && Array.isArray(data.categories)) {
        memCategories = data.categories;
        persistCategoriesToDisk(memCategories);
      }
      if (data.products && Array.isArray(data.products)) {
        memProducts = data.products;
        persistProductsToDisk(memProducts);
      }
      if (data.storeInfo) {
        memStoreInfo = { ...DEFAULT_STORE_INFO, ...memStoreInfo, ...data.storeInfo };
        persistStoreInfoToDisk(memStoreInfo);
      }
      if (data.totemBackups && Array.isArray(data.totemBackups)) {
        memTotemBackups = data.totemBackups;
        persistTotemBackupsToDisk(memTotemBackups);
      }
      persistAllStateToMasterFile();

      if (isDatabaseConfigured()) {
        try {
          if (Array.isArray(data.categories)) {
            for (const c of data.categories) {
              await db.insert(categories).values(c).onConflictDoUpdate({ target: categories.id, set: c });
            }
          }
          if (Array.isArray(data.products)) {
            await saveProductsToPostgresBatch(data.products);
          }
        } catch (_) {}
      }

      onUpdate?.();
      return res.json({
        success: true,
        message: 'Snapshot pré-sincronização restaurado com sucesso!',
        categoriesCount: memCategories.length,
        productsCount: memProducts.length
      });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Erro ao restaurar snapshot' });
    }
  });

  app.get('/api/db/storage-status', (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json({
      success: true,
      hasPostgres: isDatabaseConfigured(),
      diskFiles: {
        storeInfo: fs.existsSync(STORE_INFO_FILE),
        tvMedia: fs.existsSync(TV_MEDIA_FILE),
        categories: fs.existsSync(CATEGORIES_FILE),
        products: fs.existsSync(PRODUCTS_FILE),
        orders: fs.existsSync(ORDERS_FILE),
        users: fs.existsSync(USERS_FILE),
        tables: fs.existsSync(TABLES_FILE),
        customers: fs.existsSync(CUSTOMERS_FILE),
        masterBackup: fs.existsSync(MASTER_STATE_FILE)
      },
      counts: {
        categories: memCategories.length,
        products: memProducts.length,
        tvMedia: memTvMedia.length,
        tables: memTables.length,
        orders: memOrders.length,
        users: memUsers.length,
        customers: memCustomers.length
      },
      storeName: memStoreInfo.name,
      isOpen: memStoreInfo.isOpen,
      aiAgentEnabled: memStoreInfo.aiAgentEnabled,
      hasCustomLogo: !!(memStoreInfo.logoUrl && memStoreInfo.logoUrl !== '/logo.svg')
    });
  });

  // Automated Hourly Backup Setup & Endpoints
  const AUTO_BACKUP_DIR = path.join(process.cwd(), 'backups');
  try {
    if (!fs.existsSync(AUTO_BACKUP_DIR)) {
      fs.mkdirSync(AUTO_BACKUP_DIR, { recursive: true });
    }
  } catch (e) {}

  function runHourlyBackup() {
    try {
      if (!fs.existsSync(AUTO_BACKUP_DIR)) {
        fs.mkdirSync(AUTO_BACKUP_DIR, { recursive: true });
      }
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const hourStr = String(now.getHours()).padStart(2, '0');
      const filename = `donamara-backup-hourly-${dateStr}_${hourStr}-00.json`;
      const filepath = path.join(AUTO_BACKUP_DIR, filename);

      const payload = {
        storeInfo: memStoreInfo,
        tvMedia: memTvMedia,
        categories: memCategories,
        products: memProducts,
        users: memUsers,
        tables: memTables,
        customers: memCustomers,
        orders: memOrders,
        totemBackups: memTotemBackups,
        exportedAt: now.toISOString(),
        isAutomatedHourly: true,
        version: '2.0.0'
      };

      fs.writeFileSync(filepath, JSON.stringify(payload, null, 2), 'utf8');
      console.log(`[Hourly Backup] Backup automático de hora em hora criado: ${filename}`);

      // Retention: keep last 72 hourly backups (3 days)
      const files = fs.readdirSync(AUTO_BACKUP_DIR)
        .filter(f => f.startsWith('donamara-backup-hourly-') && f.endsWith('.json'))
        .sort();
      
      if (files.length > 72) {
        const filesToDelete = files.slice(0, files.length - 72);
        for (const fileToDel of filesToDelete) {
          try {
            fs.unlinkSync(path.join(AUTO_BACKUP_DIR, fileToDel));
          } catch (err) {}
        }
      }
    } catch (err) {
      console.error('[Hourly Backup] Erro ao gerar backup automático:', err);
    }
  }

  // Run initial hourly backup after 15 seconds of server startup
  setTimeout(() => {
    runHourlyBackup();
  }, 15000);

  // Then run every 1 hour
  setInterval(() => {
    runHourlyBackup();
  }, 60 * 60 * 1000);

  app.get('/api/db/hourly-backups', (req: Request, res: Response) => {
    try {
      if (!fs.existsSync(AUTO_BACKUP_DIR)) {
        return res.json({ success: true, backups: [] });
      }
      const files = fs.readdirSync(AUTO_BACKUP_DIR)
        .filter(f => f.startsWith('donamara-backup-hourly-') && f.endsWith('.json'))
        .sort()
        .reverse();

      const list = files.map(filename => {
        const filepath = path.join(AUTO_BACKUP_DIR, filename);
        const stats = fs.statSync(filepath);
        return {
          filename,
          sizeKb: Math.round(stats.size / 1024),
          createdAt: stats.mtime.toISOString()
        };
      });

      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.json({ success: true, backups: list });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro ao listar backups automáticos' });
    }
  });

  app.get('/api/db/hourly-backups/download/:filename', (req: Request, res: Response) => {
    try {
      const { filename } = req.params;
      const safeName = path.basename(filename);
      const filepath = path.join(AUTO_BACKUP_DIR, safeName);
      if (!fs.existsSync(filepath)) {
        return res.status(404).json({ error: 'Arquivo de backup não encontrado' });
      }
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
      res.setHeader('Content-Type', 'application/json');
      const content = fs.readFileSync(filepath, 'utf8');
      res.send(content);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro ao baixar backup' });
    }
  });

  app.post('/api/db/hourly-backups/restore/:filename', async (req: Request, res: Response) => {
    try {
      const { filename } = req.params;
      const safeName = path.basename(filename);
      const filepath = path.join(AUTO_BACKUP_DIR, safeName);
      if (!fs.existsSync(filepath)) {
        return res.status(404).json({ error: 'Arquivo de backup não encontrado' });
      }
      const raw = fs.readFileSync(filepath, 'utf8');
      const data = JSON.parse(raw);

      if (data.storeInfo && typeof data.storeInfo === 'object') {
        memStoreInfo = { ...DEFAULT_STORE_INFO, ...memStoreInfo, ...data.storeInfo, id: 'default' };
        persistStoreInfoToDisk(memStoreInfo);
      }
      if (Array.isArray(data.tvMedia)) {
        memTvMedia = data.tvMedia;
        persistTvMediaToDisk(memTvMedia);
      }
      if (Array.isArray(data.categories) && data.categories.length > 0) {
        memCategories = data.categories;
        persistCategoriesToDisk(memCategories);
      }
      if (Array.isArray(data.products) && data.products.length > 0) {
        memProducts = data.products;
        persistProductsToDisk(memProducts);
      }
      if (Array.isArray(data.users) && data.users.length > 0) {
        memUsers = data.users;
        persistUsersToDisk(memUsers);
      }
      if (Array.isArray(data.tables) && data.tables.length > 0) {
        memTables = data.tables;
        persistTablesToDisk(memTables);
      }
      if (Array.isArray(data.customers)) {
        memCustomers = data.customers;
        persistCustomersToDisk(memCustomers);
      }
      if (Array.isArray(data.orders)) {
        memOrders = data.orders;
        persistOrdersToDisk(memOrders);
      }
      persistAllStateToMasterFile();
      onUpdate?.();

      return res.json({ success: true, message: 'Backup horário restaurado com sucesso!' });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Erro ao restaurar backup horário' });
    }
  });

  // Drivers & Delivery API
  app.get('/api/db/drivers', async (req: Request, res: Response) => {
    try {
      if (isDatabaseConfigured()) {
        try {
          const list = await db.select().from(drivers);
          if (list.length > 0) {
            memDrivers = list;
            persistDriversToDisk(memDrivers);
            return res.json(memDrivers);
          }
        } catch (e) {}
      }
      if (memDrivers.length === 0) {
        if (fs.existsSync(DRIVERS_FILE)) {
          try {
            memDrivers = JSON.parse(fs.readFileSync(DRIVERS_FILE, 'utf8'));
          } catch (e) {}
        }
        if (memDrivers.length === 0) {
          memDrivers = DEFAULT_DRIVERS;
          persistDriversToDisk(memDrivers);
        }
      }
      res.setHeader('Cache-Control', 'no-cache');
      res.json(memDrivers);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro ao listar motoboys' });
    }
  });

  app.post('/api/db/drivers', async (req: Request, res: Response) => {
    try {
      const data = req.body;
      const newDriver = {
        id: data.id || `driver_${Date.now()}`,
        name: data.name || 'Novo Motoboy',
        phone: data.phone || '',
        vehicle: data.vehicle || 'Moto (Honda Fan - Placa XXX-0000)',
        pixKey: data.pixKey || '',
        status: data.status || 'available',
        pinCode: data.pinCode || '1234',
        createdAt: data.createdAt || Date.now()
      };
      memDrivers = [...memDrivers.filter(d => d.id !== newDriver.id), newDriver];
      persistDriversToDisk(memDrivers);

      if (isDatabaseConfigured()) {
        try {
          await db.insert(drivers).values(newDriver).onConflictDoUpdate({
            target: drivers.id,
            set: newDriver
          });
        } catch (e) {}
      }
      onUpdate?.('catalog');
      res.json({ success: true, driver: newDriver });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro ao salvar motoboy' });
    }
  });

  app.put('/api/db/drivers/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const data = req.body;
      const existing = memDrivers.find(d => d.id === id);
      const updatedDriver = {
        id,
        name: data.name !== undefined ? data.name : (existing?.name || 'Motoboy'),
        phone: data.phone !== undefined ? data.phone : (existing?.phone || ''),
        vehicle: data.vehicle !== undefined ? data.vehicle : (existing?.vehicle || 'Moto'),
        pixKey: data.pixKey !== undefined ? data.pixKey : (existing?.pixKey || ''),
        status: data.status !== undefined ? data.status : (existing?.status || 'available'),
        pinCode: data.pinCode !== undefined ? String(data.pinCode) : (existing?.pinCode || '1234'),
        createdAt: existing?.createdAt || Date.now()
      };
      memDrivers = [...memDrivers.filter(d => d.id !== id), updatedDriver];
      persistDriversToDisk(memDrivers);

      if (isDatabaseConfigured()) {
        try {
          await db.insert(drivers).values(updatedDriver).onConflictDoUpdate({
            target: drivers.id,
            set: updatedDriver
          });
        } catch (e) {}
      }
      onUpdate?.('catalog');
      res.json({ success: true, driver: updatedDriver });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro ao atualizar motoboy' });
    }
  });

  app.delete('/api/db/drivers/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      memDrivers = memDrivers.filter(d => d.id !== id);
      persistDriversToDisk(memDrivers);

      if (isDatabaseConfigured()) {
        try {
          await db.delete(drivers).where(eq(drivers.id, id));
        } catch (e) {}
      }
      onUpdate?.('catalog');
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro ao excluir motoboy' });
    }
  });

  // Delivery Zones / CEP Validation API
  app.get('/api/db/delivery-zones', async (req: Request, res: Response) => {
    try {
      if (isDatabaseConfigured()) {
        try {
          const list = await db.select().from(deliveryZones);
          if (list.length > 0) {
            memDeliveryZones = list;
            persistDeliveryZonesToDisk(memDeliveryZones);
            return res.json(memDeliveryZones);
          }
        } catch (e) {}
      }
      if (memDeliveryZones.length === 0) {
        if (fs.existsSync(DELIVERY_ZONES_FILE)) {
          try {
            memDeliveryZones = JSON.parse(fs.readFileSync(DELIVERY_ZONES_FILE, 'utf8'));
          } catch (e) {}
        }
        if (memDeliveryZones.length === 0) {
          memDeliveryZones = DEFAULT_DELIVERY_ZONES;
          persistDeliveryZonesToDisk(memDeliveryZones);
        }
      }
      res.setHeader('Cache-Control', 'no-cache');
      res.json(memDeliveryZones);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro ao listar zonas de entrega' });
    }
  });

  app.post('/api/db/delivery-zones', async (req: Request, res: Response) => {
    try {
      const data = req.body;
      const newZone = {
        id: data.id || `zone_${Date.now()}`,
        neighborhood: data.neighborhood || 'Novo Bairro',
        cepStart: data.cepStart || data.cep || '38000000',
        cepEnd: data.cepEnd || data.cep || '38099999',
        fee: Number(data.fee) || 5.00,
        isActive: data.isActive !== false,
        createdAt: data.createdAt || Date.now()
      };
      memDeliveryZones = [...memDeliveryZones.filter(z => z.id !== newZone.id), newZone];
      persistDeliveryZonesToDisk(memDeliveryZones);

      if (isDatabaseConfigured()) {
        try {
          await db.insert(deliveryZones).values(newZone).onConflictDoUpdate({
            target: deliveryZones.id,
            set: newZone
          });
        } catch (e) {}
      }
      onUpdate?.('catalog');
      res.json({ success: true, zone: newZone });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro ao salvar zona de entrega' });
    }
  });

  app.delete('/api/db/delivery-zones/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      memDeliveryZones = memDeliveryZones.filter(z => z.id !== id);
      persistDeliveryZonesToDisk(memDeliveryZones);

      if (isDatabaseConfigured()) {
        try {
          await db.delete(deliveryZones).where(eq(deliveryZones.id, id));
        } catch (e) {}
      }
      onUpdate?.('catalog');
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro ao excluir zona de entrega' });
    }
  });

  app.post('/api/db/check-cep', async (req: Request, res: Response) => {
    try {
      const { cep } = req.body;
      if (!cep) {
        return res.status(400).json({ error: 'CEP não informado' });
      }
      const cleanCep = String(cep).replace(/\D/g, '');
      if (cleanCep.length < 5) {
        return res.status(400).json({ error: 'CEP inválido' });
      }

      const numCep = parseInt(cleanCep.padEnd(8, '0'), 10);

      let matchedZone = memDeliveryZones.find(z => {
        if (!z.isActive) return false;
        const startClean = parseInt(String(z.cepStart || z.cep || '38000000').replace(/\D/g, '').padEnd(8, '0'), 10);
        const endClean = parseInt(String(z.cepEnd || z.cep || '38099999').replace(/\D/g, '').padEnd(8, '0'), 10);
        return numCep >= startClean && numCep <= endClean;
      });

      let viaStreet = '';
      let viaBairro = '';

      // Tenta enriquecer com ViaCEP se tiver 8 dígitos
      if (cleanCep.length === 8) {
        try {
          const viaRes = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
          if (viaRes.ok) {
            const viaData: any = await viaRes.json();
            if (viaData && !viaData.erro) {
              viaStreet = viaData.logradouro || '';
              viaBairro = viaData.bairro || '';

              // Se não bateu por faixa, tenta bater pelo bairro do ViaCEP
              if (!matchedZone && viaBairro) {
                const bNorm = viaBairro.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                matchedZone = memDeliveryZones.find(z => {
                  if (!z.isActive) return false;
                  const zn = (z.neighborhood || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                  return zn && (zn === bNorm || bNorm.includes(zn) || zn.includes(bNorm));
                });
              }
            }
          }
        } catch (vErr) {}
      }

      if (matchedZone) {
        return res.json({
          success: true,
          valid: true,
          neighborhood: viaBairro || matchedZone.neighborhood,
          fee: Number(matchedZone.fee) || 0,
          street: viaStreet
        });
      } else {
        return res.json({
          success: true,
          valid: false,
          message: 'INFELIZMENTE NÃO ATENDEMOS ESSA REGIÃO NO MOMENTO.'
        });
      }
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro ao validar CEP' });
    }
  });

  app.post('/api/db/orders/:id/accept-delivery', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { driverId, driverName } = req.body;

      const orderIdx = memOrders.findIndex(o => String(o.id) === String(id));
      if (orderIdx === -1) {
        return res.status(404).json({ error: 'Pedido não encontrado' });
      }

      const ord = memOrders[orderIdx];
      if (ord.driverId && ord.driverId !== driverId && ord.deliveryStatus === 'in_transit') {
        return res.status(400).json({ error: 'Este pedido já foi aceito por outro motoboy!' });
      }

      const matchedDriver = memDrivers.find(d => d.id === driverId);
      const updatedOrder = {
        ...ord,
        driverId,
        driverName: driverName || matchedDriver?.name || 'Motoboy',
        driverPhone: matchedDriver?.phone || null,
        driverVehicle: matchedDriver?.vehicle || null,
        deliveryStatus: 'in_transit',
        deliveryAcceptedAt: Date.now(),
        status: 'out_for_delivery'
      };

      memOrders[orderIdx] = updatedOrder;
      persistOrdersToDisk(memOrders);

      if (isDatabaseConfigured()) {
        try {
          await db.update(orders)
            .set({
              driverId,
              driverName: updatedOrder.driverName,
              deliveryStatus: 'in_transit',
              deliveryAcceptedAt: updatedOrder.deliveryAcceptedAt,
              status: 'out_for_delivery'
            })
            .where(eq(orders.id, id));
        } catch (e) {}
      }

      broadcastSSE({ 
        type: 'sync', 
        target: 'orders', 
        action: 'status_updated', 
        orderId: id, 
        status: 'out_for_delivery', 
        deliveryStatus: 'in_transit',
        customerName: updatedOrder.customerName || 'Cliente',
        customerPhone: updatedOrder.customerPhone || '',
        driverName: updatedOrder.driverName,
        time: Date.now() 
      });
      res.json({ success: true, order: updatedOrder });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro ao aceitar entrega' });
    }
  });

  app.post('/api/db/orders/:id/complete-delivery', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const orderIdx = memOrders.findIndex(o => String(o.id) === String(id));
      if (orderIdx === -1) {
        return res.status(404).json({ error: 'Pedido não encontrado' });
      }

      const ord = memOrders[orderIdx];
      const updatedOrder = {
        ...ord,
        deliveryStatus: 'delivered',
        deliveryCompletedAt: Date.now(),
        status: 'completed'
      };

      memOrders[orderIdx] = updatedOrder;
      persistOrdersToDisk(memOrders);

      if (isDatabaseConfigured()) {
        try {
          await db.update(orders)
            .set({
              deliveryStatus: 'delivered',
              deliveryCompletedAt: updatedOrder.deliveryCompletedAt,
              status: 'completed'
            })
            .where(eq(orders.id, id));
        } catch (e) {}
      }

      broadcastSSE({ 
        type: 'sync', 
        target: 'orders', 
        action: 'status_updated', 
        orderId: id, 
        status: 'completed', 
        deliveryStatus: 'delivered',
        customerName: updatedOrder.customerName || 'Cliente',
        customerPhone: updatedOrder.customerPhone || '',
        time: Date.now() 
      });
      res.json({ success: true, order: updatedOrder });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro ao concluir entrega' });
    }
  });

  app.post('/api/db/orders/:id/assign-driver', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { driverId, driverName } = req.body;
      const orderIdx = memOrders.findIndex(o => String(o.id) === String(id));
      if (orderIdx === -1) {
        return res.status(404).json({ error: 'Pedido não encontrado' });
      }
      const ord = memOrders[orderIdx];
      const matchedDriver = driverId ? memDrivers.find(d => d.id === driverId) : null;
      const updatedOrder = {
        ...ord,
        driverId: driverId || null,
        driverName: driverName || matchedDriver?.name || null,
        driverPhone: matchedDriver?.phone || null,
        driverVehicle: matchedDriver?.vehicle || null,
        deliveryStatus: driverId ? 'in_transit' : 'pending',
        deliveryAcceptedAt: driverId ? (ord.deliveryAcceptedAt || Date.now()) : null,
        status: driverId ? 'out_for_delivery' : ord.status
      };
      memOrders[orderIdx] = updatedOrder;
      persistOrdersToDisk(memOrders);

      if (isDatabaseConfigured()) {
        try {
          await db.update(orders)
            .set({
              driverId: updatedOrder.driverId,
              driverName: updatedOrder.driverName,
              deliveryStatus: updatedOrder.deliveryStatus,
              deliveryAcceptedAt: updatedOrder.deliveryAcceptedAt,
              status: updatedOrder.status
            })
            .where(eq(orders.id, id));
        } catch (e) {}
      }

      broadcastSSE({ 
        type: 'sync', 
        target: 'orders', 
        action: 'status_updated', 
        orderId: id, 
        status: updatedOrder.status, 
        deliveryStatus: updatedOrder.deliveryStatus,
        customerName: updatedOrder.customerName || 'Cliente',
        customerPhone: updatedOrder.customerPhone || '',
        driverName: updatedOrder.driverName,
        time: Date.now() 
      });
      res.json({ success: true, order: updatedOrder });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro ao atribuir motoboy' });
    }
  });

  // =========================================================================
  // Live GPS Tracking Endpoints (Estilo iFood)
  // =========================================================================

  // Endpoint chamado periodicamente pelo App do Motoboy para enviar coordenadas
  app.post('/api/db/drivers/:id/location', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { lat, lng, heading, speed } = req.body;
      if (typeof lat !== 'number' || typeof lng !== 'number') {
        return res.status(400).json({ error: 'Coordenadas lat e lng inválidas' });
      }

      const coords = {
        lat,
        lng,
        heading: typeof heading === 'number' ? heading : 0,
        speed: typeof speed === 'number' ? speed : 0,
        updatedAt: Date.now()
      };

      // Atualiza coordenadas no motoboy
      const drvIdx = memDrivers.findIndex(d => d.id === id);
      if (drvIdx !== -1) {
        memDrivers[drvIdx] = { ...memDrivers[drvIdx], currentCoords: coords };
      }

      // Atualiza coordenadas nos pedidos em rota desse motoboy
      let ordersUpdated = false;
      memOrders = memOrders.map(o => {
        if (o.driverId === id && (o.deliveryStatus === 'in_transit' || o.status === 'out_for_delivery')) {
          ordersUpdated = true;
          return { ...o, driverCoords: coords };
        }
        return o;
      });

      if (ordersUpdated) {
        persistOrdersToDisk(memOrders);
      }

      // Notifica todos os clientes acompanhando em tempo real via SSE
      broadcastSSE({
        type: 'driver_location',
        driverId: id,
        coords,
        time: Date.now()
      });

      res.json({ success: true, coords });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro ao registrar localização do motoboy' });
    }
  });

  // Endpoint chamado pela tela do Cliente para obter dados completos de rastreamento
  app.get('/api/db/orders/:id/tracking', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      let order = memOrders.find(o => String(o.id) === String(id));
      if (!order && isDatabaseConfigured()) {
        try {
          const dbOrders = await db.select().from(orders).where(eq(orders.id, id));
          if (dbOrders && dbOrders.length > 0) {
            order = dbOrders[0] as any;
          }
        } catch (dbErr) {
          console.warn('[DB] Tracking order query fallback error:', dbErr);
        }
      }
      if (!order) {
        return res.status(404).json({ error: 'Pedido não encontrado' });
      }

      const driver = order.driverId ? memDrivers.find(d => d.id === order.driverId) : null;
      const storeCoords = {
        lat: Number(memStoreInfo.inStoreLatitude) || -19.7478,
        lng: Number(memStoreInfo.inStoreLongitude) || -47.9392
      };

      res.json({
        order,
        store: {
          name: memStoreInfo.name || 'DONAMARA - REVENDA',
          address: memStoreInfo.address || 'Av. Principal, 100 - Centro',
          phone: memStoreInfo.phone || '',
          coords: storeCoords
        },
        driver: driver ? {
          id: driver.id,
          name: driver.name,
          phone: driver.phone,
          vehicle: driver.vehicle,
          coords: driver.currentCoords || order.driverCoords || null
        } : null
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro ao buscar dados de rastreamento' });
    }
  });

  // Endpoints para Módulo Pagamento Online (Mercado Pago)
  app.post('/api/mercadopago/create-pix', async (req: Request, res: Response) => {
    try {
      const { orderId, amount, description, payer } = req.body;
      if (!amount || Number(amount) <= 0) {
        return res.status(400).json({ error: 'Valor inválido para cobrança Pix' });
      }

      const pixResult = await createPixPayment({
        orderId: String(orderId || Date.now()),
        amount: Number(amount),
        description,
        payer: payer || {},
        storeInfo: memStoreInfo
      });

      res.json(pixResult);
    } catch (err: any) {
      console.error('[Mercado Pago API] Erro ao criar cobrança Pix:', err);
      res.status(500).json({ error: err?.message || 'Erro ao gerar pagamento Pix' });
    }
  });

  app.get('/api/mercadopago/check-status/:paymentId', async (req: Request, res: Response) => {
    try {
      const { paymentId } = req.params;
      const statusResult = await checkPixStatus(paymentId, memStoreInfo);
      res.json(statusResult);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro ao consultar status do pagamento' });
    }
  });

  app.post('/api/mercadopago/confirm-pix/:paymentId', async (req: Request, res: Response) => {
    try {
      const { paymentId } = req.params;
      const result = confirmPixPayment(paymentId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro ao confirmar Pix' });
    }
  });

  app.post('/api/mercadopago/process-card', async (req: Request, res: Response) => {
    try {
      const { amount, cardType, card, payer, orderId } = req.body;
      if (!amount || Number(amount) <= 0) {
        return res.status(400).json({ success: false, message: 'Valor inválido para pagamento' });
      }
      if (!card || !card.number) {
        return res.status(400).json({ success: false, message: 'Dados do cartão incompletos' });
      }

      const cardResult = await processCardPayment({
        amount: Number(amount),
        cardType: cardType === 'debit' ? 'debit' : 'credit',
        card,
        payer: payer || {},
        orderId: String(orderId || Date.now()),
        storeInfo: memStoreInfo
      });

      res.json(cardResult);
    } catch (err: any) {
      console.error('[Mercado Pago API] Erro ao processar cartão:', err);
      res.status(500).json({ success: false, message: err?.message || 'Erro ao processar cartão' });
    }
  });

  // Background Automation Loop for Delivery Orders (Auto-Print after 3 min, Auto-Status progression)
  setInterval(async () => {
    try {
      const now = Date.now();
      let updated = false;

      memOrders = memOrders.map(order => {
        if (order.status !== 'completed' && order.status !== 'cancelled') {
          const createdAt = order.createdAt ? new Date(order.createdAt).getTime() : now;
          const elapsedMinutes = (now - createdAt) / 60000;

          let newStatus = order.status;
          let newDeliveryStatus = order.deliveryStatus;
          let needsPrint = false;

          // 1. Auto-Print for delivery orders
          if ((order.type === 'delivery' || order.deliveryType === 'delivery') && elapsedMinutes >= 0 && !(order as any).autoPrintedDelivery) {
            (order as any).autoPrintedDelivery = true;
            needsPrint = true;
            updated = true;
          }

          // 2. Auto-Print when advance minutes (default 90 min) remaining until scheduled time
          const advanceMinutes = Number(memStoreInfo.schedulePrepTimeFrozenMinutes) || 90;
          if (order.scheduledDate && order.scheduledTime && !(order as any).autoPrinted90Min) {
            try {
              const [year, month, day] = String(order.scheduledDate).slice(0, 10).split('-').map(Number);
              const [hour, minute] = String(order.scheduledTime).split(':').map(Number);
              if (!isNaN(year) && !isNaN(month) && !isNaN(day) && !isNaN(hour) && !isNaN(minute)) {
                const scheduledDateTime = new Date(year, month - 1, day, hour, minute, 0).getTime();
                const timeRemainingMinutes = (scheduledDateTime - now) / 60000;
                
                if (timeRemainingMinutes <= advanceMinutes && timeRemainingMinutes >= -60) {
                  (order as any).autoPrinted90Min = true;
                  needsPrint = true;
                  updated = true;
                  console.log(`[Auto-Print ${advanceMinutes}Min] Pedido agendado #${order.id} entrou na janela de ${advanceMinutes} min (faltam ${Math.round(timeRemainingMinutes)} min). Acionando .bat agent!`);
                  broadcastSSE({
                    type: 'sync',
                    target: 'orders',
                    action: 'status_updated',
                    orderId: order.id,
                    alertType: 'reminder_90min',
                    status: order.status,
                    message: `Faltam menos de ${advanceMinutes} minutos para a entrega/retirada do seu Pedido #${String(order.id).slice(-4)} agendado para às ${order.scheduledTime || '09:00'}. Nossa equipe já iniciou a preparação!`,
                    time: Date.now()
                  });
                }
              }
            } catch (e) {}
          }

          // 3. Progressão de Status para Delivery:
          if (order.type === 'delivery' || order.deliveryType === 'delivery') {
            if (elapsedMinutes >= 10 && order.status === 'preparing') {
              newStatus = 'ready_for_delivery';
              newDeliveryStatus = 'ready_for_delivery';
              updated = true;
            } else if (elapsedMinutes >= 5 && order.status === 'pending') {
              newStatus = 'preparing';
              newDeliveryStatus = 'preparing';
              updated = true;
            }
          }

          if (needsPrint) {
            queueOrderForAgent(order, memStoreInfo);
            printOrderToNetworkPrinter(order, memStoreInfo).then(res => {
              console.log(`[Auto-Print] Pedido #${order.id} impresso automaticamente via .bat agent:`, res.success);
            }).catch(err => {
              console.warn('[Auto-Print] Erro na impressão automática:', err);
            });

            if (memStoreInfo.ntfyEnabled !== false) {
              const topic = String(memStoreInfo.ntfyTopic || 'donamara_pedidos').trim();
              fetch(`https://ntfy.sh/${topic}`, {
                method: 'POST',
                headers: {
                  'Title': `🚨 [IMPRESSÃO AUTOMÁTICA] Pedido #${String(order.id).slice(-4)}`,
                  'Priority': 'urgent',
                  'Tags': 'printer,bell,alarm_clock',
                },
                body: `Faltam 90 minutos para entrega/retirada do Pedido #${String(order.id).slice(-4)}!\nCliente: ${order.customerName}\nCupom despachado para a impressora!`
              }).catch(() => {});
            }
          }

          if (newStatus !== order.status || newDeliveryStatus !== order.deliveryStatus || needsPrint) {
            const updatedOrd = { ...order, status: newStatus, deliveryStatus: newDeliveryStatus };
            if (isDatabaseConfigured()) {
              db.update(orders)
                .set({ status: newStatus, deliveryStatus: newDeliveryStatus })
                .where(eq(orders.id, order.id))
                .catch(() => {});
            }
            return updatedOrd;
          }
        }
        return order;
      });

      if (updated) {
        persistOrdersToDisk(memOrders);
        broadcastSSE({ type: 'sync', target: 'orders', action: 'delivery_automation', time: Date.now() });
      }
    } catch (err) {
      console.warn('[Delivery Automation] Erro no loop de automação:', err);
    }
  }, 30000);

  // SMS Reminders Storage & Background Automation (3 SMS/day spaced by 3 hours up to pickup day)
  const SMS_REMINDERS_FILE = path.join(STORAGE_DIR, '.sms_reminders_log.json');
  let memSmsReminders: any[] = loadJsonFile(SMS_REMINDERS_FILE, []);
  const persistSmsRemindersToDisk = (data: any[]) => {
    writeJsonFile(SMS_REMINDERS_FILE, data);
  };

  const formatIsoDateToBR = (str: any): string => {
    if (!str) return '';
    return String(str).replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, '$3-$2-$1');
  };

  app.get('/api/db/sms-reminders', (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-cache');
    const sanitized = (memSmsReminders || []).map((r: any) => ({
      ...r,
      scheduledDate: formatIsoDateToBR(r.scheduledDate),
      dateStr: formatIsoDateToBR(r.dateStr),
      message: formatIsoDateToBR(r.message)
    }));
    res.json(sanitized);
  });

  app.post('/api/db/sms-reminders/test', async (req: Request, res: Response) => {
    const { phone, name, orderId } = req.body || {};
    const testReminder = {
      id: `sms_test_${Date.now()}`,
      orderId: orderId || 'TEST',
      customerName: name || 'Cliente Teste',
      customerPhone: phone || '(34) 99999-9999',
      scheduledDate: new Date().toISOString().slice(0, 10),
      scheduledTime: '12:00',
      slot: 'slot_1_09h',
      dateStr: new Date().toISOString().slice(0, 10),
      message: `[TESTE SMS DONAMARA] Olá ${name || 'Cliente'}! Lembrete: Seu pedido agendado #${orderId || 'TEST'} está confirmado.`,
      sentAt: Date.now(),
      status: 'sent'
    };
    memSmsReminders.unshift(testReminder);
    persistSmsRemindersToDisk(memSmsReminders);

    let webhookResponseStatus: number | null = null;
    let webhookResponseBody = '';
    let webhookError: string | null = null;

    if (memStoreInfo.autoSmsWebhookUrl && String(memStoreInfo.autoSmsWebhookUrl).trim() !== '') {
      try {
        const webhookUrl = String(memStoreInfo.autoSmsWebhookUrl).trim();
        const apiKey = String(memStoreInfo.autoSmsApiKey || '').trim();
        const cleanPhone = String(testReminder.customerPhone).replace(/\D/g, '');
        const resp = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { 'Authorization': `Bearer ${apiKey}`, 'x-api-key': apiKey } : {})
          },
          body: JSON.stringify({
            phone: testReminder.customerPhone,
            number: cleanPhone,
            message: testReminder.message,
            text: testReminder.message,
            orderId: testReminder.orderId,
            customerName: testReminder.customerName,
            slot: 'slot_1_09h'
          })
        });
        webhookResponseStatus = resp.status;
        try {
          webhookResponseBody = await resp.text();
        } catch {}
      } catch (err: any) {
        webhookError = err?.message || 'Falha na conexão HTTP com o Webhook';
      }
    }

    res.json({
      success: true,
      reminder: testReminder,
      webhookTested: !!memStoreInfo.autoSmsWebhookUrl,
      webhookResponseStatus,
      webhookResponseBody,
      webhookError
    });
  });

  const isOrderFrozen = (order: any): boolean => {
    if (!order) return false;
    if (order.hasFrozenItems === true || order.isFrozen === true) return true;

    const items = Array.isArray(order.items)
      ? order.items
      : (typeof order.items === 'string' ? (() => { try { return JSON.parse(order.items); } catch { return []; } })() : []);

    if (!Array.isArray(items) || items.length === 0) return false;

    return items.some((it: any) => {
      if (!it) return false;
      if (it.isFrozen) return true;
      if (it.productId === 'prod_congelado') return true;
      const prepType = String(it.prepType || '').toLowerCase();
      if (prepType.includes('congelad') || prepType.startsWith('congelado')) return true;
      const prepLabel = String(it.prepLabel || '').toLowerCase();
      if (prepLabel.includes('congelad')) return true;
      const name = String(it.name || '').toLowerCase();
      if (name.includes('congelad')) return true;
      if (Array.isArray(it.addons) && it.addons.some((a: any) => a.isFrozen || a.productId === 'prod_congelado' || String(a.name || '').toLowerCase().includes('congelad'))) return true;
      if (Array.isArray(it.options) && it.options.some((o: any) => o.isFrozen || String(o.name || '').toLowerCase().includes('congelad'))) return true;
      return false;
    });
  };

  const checkAndTriggerSmsReminders = (forceImmediateSlot: boolean = false) => {
    try {
      const now = new Date();
      let brazilDate = now;
      try {
        brazilDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
      } catch {}

      const currentYear = brazilDate.getFullYear();
      const currentMonth = String(brazilDate.getMonth() + 1).padStart(2, '0');
      const currentDay = String(brazilDate.getDate()).padStart(2, '0');
      const todayStr = `${currentYear}-${currentMonth}-${currentDay}`;
      const currentHour = brazilDate.getHours();
      const currentMinute = brazilDate.getMinutes();
      const currentMinutesOfDay = currentHour * 60 + currentMinute;

      // Horários customizados de disparo definidos pelo lojista no painel
      const parseTimeToMinutes = (tStr: string | undefined, defH: number) => {
        try {
          const [h, m] = String(tStr || '').split(':').map(Number);
          return (isNaN(h) ? defH : h) * 60 + (isNaN(m) ? 0 : m);
        } catch {
          return defH * 60;
        }
      };

      const slot1Mins = parseTimeToMinutes(memStoreInfo.smsReminderTime1, 9);
      const slot2Mins = parseTimeToMinutes(memStoreInfo.smsReminderTime2, 12);
      const slot3Mins = parseTimeToMinutes(memStoreInfo.smsReminderTime3, 15);

      const isSlotDue = (slot: string) => {
        if (forceImmediateSlot) return true;
        if (slot === 'slot_1_09h') return currentMinutesOfDay >= slot1Mins;
        if (slot === 'slot_2_12h') return currentMinutesOfDay >= slot2Mins;
        if (slot === 'slot_3_15h') return currentMinutesOfDay >= slot3Mins;
        return false;
      };

      let newRemindersAdded = false;

      (memOrders || []).forEach(order => {
        if (!order || order.status === 'cancelled' || !order.customerPhone) return;

        const isFinished = order.status === 'completed' || order.status === 'ready' || order.status === 'ready_for_pickup';

        // 1. Notificação de Agendamento (pedidos com scheduledDate)
        if (order.scheduledDate) {
          const scheduledDateStr = String(order.scheduledDate).slice(0, 10);
          const orderDateStr = order.createdAt ? new Date(order.createdAt).toISOString().slice(0, 10) : todayStr;

          if (todayStr >= orderDateStr && todayStr <= scheduledDateStr) {
            ['slot_1_09h', 'slot_2_12h', 'slot_3_15h'].forEach(slot => {
              const reminderKey = `ord_${order.id}_${todayStr}_${slot}`;
              const alreadySent = memSmsReminders.some(r => r && r.reminderKey === reminderKey);

              if (!alreadySent && isSlotDue(slot)) {
                const displayDateBR = formatIsoDateToBR(scheduledDateStr);
                const reminder = {
                  id: `sms_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                  reminderKey,
                  orderId: order.id,
                  customerName: order.customerName || 'Cliente',
                  customerPhone: order.customerPhone,
                  scheduledDate: displayDateBR,
                  scheduledTime: order.scheduledTime || '09:00',
                  slot,
                  type: 'scheduled',
                  dateStr: formatIsoDateToBR(todayStr),
                  message: `Olá ${order.customerName || 'Cliente'}! Lembrete DONAMARA: Seu pedido #${String(order.id).slice(-4)} está agendado para ${displayDateBR} às ${order.scheduledTime || '09:00'}. Estamos te aguardando!`,
                  sentAt: Date.now(),
                  status: 'sent'
                };
                memSmsReminders.unshift(reminder);
                newRemindersAdded = true;
                console.log(`[SMS Automation] SMS agendado gerado para ${order.customerPhone} (${order.customerName}) Pedido #${order.id} (Slot: ${slot}, Data: ${displayDateBR})`);

                // Disparo SSE direto para a tela do smartphone do cliente
                broadcastSSE({
                  type: 'sync',
                  target: 'sms_reminders',
                  action: 'reminder_alert',
                  orderId: order.id,
                  customerName: order.customerName,
                  customerPhone: order.customerPhone,
                  message: reminder.message,
                  time: Date.now()
                });

                // Disparo Automático NTFY (Estilo NTFY 100% gratuito e sem esquecimento)
                if (memStoreInfo.ntfyEnabled !== false) {
                  const topic = String(memStoreInfo.ntfyTopic || 'donamara_pedidos').trim();
                  const cleanPhone = String(order.customerPhone || '').replace(/\D/g, '');
                  const cleanMsg = reminder.message;
                  const slotLabel = slot === 'slot_1_09h' ? 'Manhã (09h)' : slot === 'slot_2_12h' ? 'Almoço (12h)' : 'Tarde (15h)';

                  fetch(`https://ntfy.sh/${topic}`, {
                    method: 'POST',
                    headers: {
                      'Title': `⏰ LEMBRETE DONAMARA: Pedido #${String(order.id).slice(-4)} (${order.customerName})`,
                      'Priority': 'urgent',
                      'Tags': 'alarm_clock,warning,package',
                      'Click': cleanPhone ? `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(cleanMsg)}` : undefined
                    },
                    body: `Lembrete Automático [${slotLabel}]:\nPedido #${String(order.id).slice(-4)} para ${displayDateBR} às ${order.scheduledTime || '09:00'}.\nCliente: ${order.customerName}\nTelefone: ${order.customerPhone}`
                  }).then(() => {
                    console.log(`[Auto NTFY Reminder] Alerta automático de lembrete enviado para ntfy.sh/${topic}`);
                  }).catch(err => {
                    console.warn('[Auto NTFY Reminder Error] Falha ao enviar ntfy:', err?.message);
                  });
                }

                if (memStoreInfo.autoSmsWebhookUrl && String(memStoreInfo.autoSmsWebhookUrl).trim() !== '') {
                  const webhookUrl = String(memStoreInfo.autoSmsWebhookUrl).trim();
                  const apiKey = String(memStoreInfo.autoSmsApiKey || '').trim();
                  fetch(webhookUrl, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      ...(apiKey ? { 'Authorization': `Bearer ${apiKey}`, 'x-api-key': apiKey } : {})
                    },
                    body: JSON.stringify({
                      phone: order.customerPhone,
                      number: String(order.customerPhone).replace(/\D/g, ''),
                      message: reminder.message,
                      text: reminder.message,
                      orderId: order.id,
                      customerName: order.customerName || 'Cliente',
                      slot: slot,
                      scheduledDate: displayDateBR,
                      scheduledTime: order.scheduledTime || '09:00'
                    })
                  }).then(resp => {
                    console.log(`[Auto SMS Webhook] Disparado para ${order.customerPhone}:`, resp.status);
                  }).catch(err => {
                    console.warn('[Auto SMS Webhook Error] Falha ao despachar webhook:', err?.message);
                  });
                }
              }
            });
          }
        }

        // 2. Notificações Periódicas de Congelados (3 vezes ao dia durante o período de 48 horas a partir do envio)
        if (isOrderFrozen(order) && !isFinished) {
          const orderCreatedAtTs = typeof order.createdAt === 'number'
            ? order.createdAt
            : (order.createdAt ? new Date(order.createdAt).getTime() : now.getTime());

          const elapsedMs = now.getTime() - orderCreatedAtTs;
          const elapsedHours = elapsedMs / (1000 * 60 * 60);

          // Válido a partir do envio do pedido (elapsedMs >= 0) e até 48 horas (elapsedHours <= 48)
          if (elapsedMs >= 0 && elapsedHours <= 48) {
            ['slot_1_09h', 'slot_2_12h', 'slot_3_15h'].forEach(slot => {
              const reminderKey = `frozen_${order.id}_${todayStr}_${slot}`;
              const alreadySent = memSmsReminders.some(r => r && r.reminderKey === reminderKey);

              if (!alreadySent && isSlotDue(slot)) {
                const hoursRemaining = Math.max(0, Math.round(48 - elapsedHours));
                const reminderMessage = `Olá ${order.customerName || 'Cliente'}! Informamos que seu pedido #${String(order.id).slice(-4)} contém salgados congelados, que possuem um período de preparo de até 48 horas a partir do envio. Seu pedido pode ficar pronto antes e, caso isso aconteça, nossos atendentes entrarão em contato para avisar!`;

                const reminder = {
                  id: `sms_froz_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                  reminderKey,
                  orderId: order.id,
                  customerName: order.customerName || 'Cliente',
                  customerPhone: order.customerPhone,
                  scheduledDate: `Até 48h (Envio: ${new Date(orderCreatedAtTs).toLocaleDateString('pt-BR')})`,
                  scheduledTime: `${hoursRemaining}h restantes`,
                  slot,
                  type: 'frozen_48h',
                  dateStr: formatIsoDateToBR(todayStr),
                  message: reminderMessage,
                  sentAt: Date.now(),
                  status: 'sent'
                };

                memSmsReminders.unshift(reminder);
                newRemindersAdded = true;
                console.log(`[SMS Automation] Lembrete Congelados 48h gerado para ${order.customerPhone} (${order.customerName}) Pedido #${order.id} (Slot: ${slot})`);

                // Disparo SSE direto para a tela do smartphone do cliente
                const clientFirstName = String(order.customerName || 'Cliente').trim().split(' ')[0];
                broadcastSSE({
                  type: 'sync',
                  target: 'sms_reminders',
                  action: 'reminder_alert',
                  alertType: 'frozen_48h',
                  orderId: order.id,
                  customerName: order.customerName,
                  customerPhone: order.customerPhone,
                  message: reminder.message,
                  shortMessage: `Olá ${clientFirstName}! Prazo de até 48h, podendo adiantar. Se ficar pronto antes, avisaremos você!`,
                  time: Date.now()
                });

                // Disparo Automático NTFY (Push no celular)
                if (memStoreInfo.ntfyEnabled !== false) {
                  const topic = String(memStoreInfo.ntfyTopic || 'donamara_pedidos').trim();
                  const cleanPhone = String(order.customerPhone || '').replace(/\D/g, '');
                  const cleanMsg = reminder.message;
                  const slotLabel = slot === 'slot_1_09h' ? 'Manhã (09h)' : slot === 'slot_2_12h' ? 'Almoço (12h)' : 'Tarde (15h)';

                  fetch(`https://ntfy.sh/${topic}`, {
                    method: 'POST',
                    headers: {
                      'Title': `❄️ [CONGELADOS 48H] Pedido #${String(order.id).slice(-4)} (${order.customerName})`,
                      'Priority': 'urgent',
                      'Tags': 'snowflake,alarm_clock,package',
                      'Click': cleanPhone ? `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(cleanMsg)}` : undefined
                    },
                    body: `Aviso Congelados 48h [${slotLabel}]:\nPedido #${String(order.id).slice(-4)} (${order.customerName} - ${order.customerPhone})\n\n${reminder.message}`
                  }).then(() => {
                    console.log(`[Auto NTFY Frozen Reminder] Enviado para ntfy.sh/${topic}`);
                  }).catch(err => {
                    console.warn('[Auto NTFY Frozen Reminder Error] Falha:', err?.message);
                  });
                }

                // Disparo Automático via Webhook SMS / WhatsApp
                if (memStoreInfo.autoSmsWebhookUrl && String(memStoreInfo.autoSmsWebhookUrl).trim() !== '') {
                  const webhookUrl = String(memStoreInfo.autoSmsWebhookUrl).trim();
                  const apiKey = String(memStoreInfo.autoSmsApiKey || '').trim();
                  fetch(webhookUrl, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      ...(apiKey ? { 'Authorization': `Bearer ${apiKey}`, 'x-api-key': apiKey } : {})
                    },
                    body: JSON.stringify({
                      type: 'frozen_48h',
                      phone: order.customerPhone,
                      number: String(order.customerPhone).replace(/\D/g, ''),
                      message: reminder.message,
                      text: reminder.message,
                      orderId: order.id,
                      customerName: order.customerName || 'Cliente',
                      slot: slot,
                      period: '48h',
                      hoursRemaining
                    })
                  }).then(resp => {
                    console.log(`[Auto SMS Webhook - Frozen] Disparado para ${order.customerPhone}:`, resp.status);
                  }).catch(err => {
                    console.warn('[Auto SMS Webhook - Frozen Error] Falha:', err?.message);
                  });
                }
              }
            });
          }
        }
      });

      if (newRemindersAdded) {
        if (memSmsReminders.length > 500) {
          memSmsReminders = memSmsReminders.slice(0, 500);
        }
        persistSmsRemindersToDisk(memSmsReminders);
        broadcastSSE({ type: 'sync', target: 'sms_reminders', time: Date.now() });
      }
    } catch (err) {
      console.warn('[SMS Automation] Erro no loop de lembretes SMS:', err);
    }
  };

  setInterval(checkAndTriggerSmsReminders, 60 * 1000);

  app.post('/api/db/sms-reminders/trigger-now', (req: Request, res: Response) => {
    try {
      const force = req.body?.force === true;
      checkAndTriggerSmsReminders(force);
      res.json({ success: true, reminders: memSmsReminders });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Endpoint de download nativo do Manual / Documentação em PDF
  app.get('/api/documentation/pdf', (req: Request, res: Response) => {
    try {
      const doc = buildDocumentationPdf();
      const arrayBuffer = doc.output('arraybuffer');
      const buffer = Buffer.from(arrayBuffer);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="Manual_Sistema_DONAMARA.pdf"');
      res.setHeader('Content-Length', buffer.length);
      res.send(buffer);
    } catch (err: any) {
      console.error('[Documentation PDF Error]:', err);
      res.status(500).json({ error: 'Erro ao gerar PDF da documentação: ' + (err?.message || err) });
    }
  });

  // Mount AI Virtual Agent endpoints
  registerAiRoutes(app, () => ({
    categories: memCategories,
    products: memProducts,
    storeInfo: memStoreInfo
  }));
}

