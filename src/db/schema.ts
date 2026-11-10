import { pgTable, text, integer, boolean, doublePrecision, jsonb, timestamp, serial, bigint } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table (linked to Firebase Auth UID)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique('users_uid_key'),
  email: text('email').notNull(),
  password: text('password'),
  name: text('name'),
  role: text('role').default('operator'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Categories table
export const categories = pgTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  order: integer('order').default(0),
  externalId: text('external_id'),
  isVisible: boolean('is_visible').default(true),
  availableForDelivery: boolean('available_for_delivery').default(true),
  availableInStore: boolean('available_in_store').default(true),
  availableForKiosk: boolean('available_for_kiosk').default(true),
});

// Products table
export const products = pgTable('products', {
  id: text('id').primaryKey(),
  categoryId: text('category_id'),
  name: text('name').notNull(),
  description: text('description').default(''),
  price: doublePrecision('price').notNull().default(0),
  imageUrl: text('image_url').default(''),
  isActive: boolean('is_active').default(true),
  isAddon: boolean('is_addon').default(false),
  isFlavor: boolean('is_flavor').default(false),
  addonIds: jsonb('addon_ids').$type<string[]>().default([]),
  maxAddons: integer('max_addons').default(0),
  flavorIds: jsonb('flavor_ids').$type<string[]>().default([]),
  externalId: text('external_id'),
  order: integer('order').default(0),
  allowFrozen: boolean('allow_frozen').default(true),
  availableForDelivery: boolean('available_for_delivery').default(true),
  availableInStore: boolean('available_in_store').default(true),
  availableForKiosk: boolean('available_for_kiosk').default(true),
});

// Orders table
export const orders = pgTable('orders', {
  id: text('id').primaryKey(),
  items: jsonb('items').notNull(),
  total: doublePrecision('total').notNull().default(0),
  status: text('status').notNull().default('pending'),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  type: text('type').default('kiosk'),
  paymentMethod: text('payment_method').default(''),
  customerName: text('customer_name').default(''),
  customerPhone: text('customer_phone'),
  customerId: text('customer_id'),
  customerEmail: text('customer_email').default(''),
  customerCpf: text('customer_cpf').default(''),
  deliveryType: text('delivery_type'),
  deliveryAddress: text('delivery_address'),
  deliveryCep: text('delivery_cep').default(''),
  deliveryNeighborhood: text('delivery_neighborhood').default(''),
  deliveryFee: doublePrecision('delivery_fee').default(0),
  tableNumber: text('table_number'),
  tableId: text('table_id'),
  driverId: text('driver_id'),
  driverName: text('driver_name'),
  deliveryStatus: text('delivery_status').default('pending'), // 'pending' | 'assigned' | 'in_transit' | 'delivered'
  deliveryAcceptedAt: bigint('delivery_accepted_at', { mode: 'number' }),
  deliveryCompletedAt: bigint('delivery_completed_at', { mode: 'number' }),
  scheduledTime: text('scheduled_time'),
  scheduledDate: text('scheduled_date'),
  scheduledDay: text('scheduled_day'),
  scheduledPickupTime: text('scheduled_pickup_time'),
});

// Delivery Zones / Bairros e CEPs table
export const deliveryZones = pgTable('delivery_zones', {
  id: text('id').primaryKey(),
  neighborhood: text('neighborhood').notNull(),
  cepStart: text('cep_start').notNull(),
  cepEnd: text('cep_end').notNull(),
  fee: doublePrecision('fee').notNull().default(5.00),
  isActive: boolean('is_active').default(true),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
});

// Drivers / Motoboys table
export const drivers = pgTable('drivers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  vehicle: text('vehicle').default('Moto (Honda Fan - Placa XXX-0000)'),
  pixKey: text('pix_key').default(''),
  status: text('status').default('available'), // 'available' | 'busy' | 'offline'
  pinCode: text('pin_code').default('1234'),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
});

// Restaurant Tables (Controle de Mesas e QR Codes)
export const restaurantTables = pgTable('restaurant_tables', {
  id: text('id').primaryKey(),
  number: integer('number').notNull(),
  name: text('name').notNull(),
  section: text('section').default('Salão Principal'),
  capacity: integer('capacity').default(4),
  status: text('status').default('available'), // 'available' | 'occupied' | 'reserved'
  isActive: boolean('is_active').default(true),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
});

// Store Info table
export const storeInfo = pgTable('store_info', {
  id: text('id').primaryKey().default('default'),
  name: text('name').default('DONAMARA - REVENDA'),
  themeColor: text('theme_color').default('#dc2626'),
  addButtonColor: text('add_button_color').default('#dc2626'),
  iconColor: text('icon_color').default('#dc2626'),
  headerPhrase: text('header_phrase').default('Salgados Especiais e Revenda'),
  logoUrl: text('logo_url').default(''),
  address: text('address').default(''),
  hours: text('hours').default(''),
  instagram: text('instagram').default(''),
  whatsapp: text('whatsapp').default(''),
  categoryTitleColor: text('category_title_color').default('#dc2626'),
  deliveryEnabled: boolean('delivery_enabled').default(true),
  deliveryScheduleEnabled: boolean('delivery_schedule_enabled').default(false),
  deliveryScheduleSlots: text('delivery_schedule_slots').default('["08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00","18:30","19:00","19:30"]'),
  scheduleSlotItemCapacity: integer('schedule_slot_item_capacity').default(100),
  schedulePrepTimeNormalMinutes: integer('schedule_prep_time_normal_minutes').default(40),
  schedulePrepTimeFrozenMinutes: integer('schedule_prep_time_frozen_minutes').default(90),
  minOrderValue: doublePrecision('min_order_value').default(0),
  inStoreEnabled: boolean('in_store_enabled').default(true),
  kioskEnabled: boolean('kiosk_enabled').default(true),
  requireQrCodeForOrdering: boolean('require_qr_code_for_ordering').default(true),
  isOpen: boolean('is_open').default(true),
  ntfyTopic: text('ntfy_topic').default('donamara_pedidos'),
  ntfyEnabled: boolean('ntfy_enabled').default(true),
  tvTickerText: text('tv_ticker_text').default('🥟 Salgados fresquinhos e crocantes para revenda e consumo! Peça pelo app ou no balcão!'),
  tvMode: text('tv_mode').default('fullscreen_media'),
  tvSelectedCategories: text('tv_selected_categories').default('[]'),
  tvSoundEnabled: boolean('tv_sound_enabled').default(false),
  tvShowClock: boolean('tv_show_clock').default(true),
  tvShowCaptions: boolean('tv_show_captions').default(false),
  isMaintenance: boolean('is_maintenance').default(false),
  maintenanceMessage: text('maintenance_message').default('Estamos atualizando nosso cardápio e sistemas para melhor atendê-lo. Voltaremos em breve!'),
  weeklySchedule: text('weekly_schedule').default('[]'),
  autoOpenClose: boolean('auto_open_close').default(false),
  forceOpen: boolean('force_open').default(false),
  closedMessage: text('closed_message').default('Estamos fechados no momento. Confira nossos horários de atendimento!'),
  aiAgentEnabled: boolean('ai_agent_enabled').default(true),
  aiAgentName: text('ai_agent_name').default('Dona Mara IA'),
  aiAgentTone: text('ai_agent_tone').default('amigavel'),
  aiAgentCustomPrompt: text('ai_agent_custom_prompt').default(''),
  aiAgentWhatsAppPhone: text('ai_agent_whatsapp_phone').default(''),
  aiAgentWhatsAppDefaultMessage: text('ai_agent_whatsapp_default_message').default('Olá! Gostaria de fazer um pedido ou tirar uma dúvida.'),
  aiAgentTrainingExamples: text('ai_agent_training_examples').default('[]'),
  aiAgentKnowledgeBase: text('ai_agent_knowledge_base').default(''),
  aiAgentForbiddenPhrases: text('ai_agent_forbidden_phrases').default(''),
  aiAgentCreativity: doublePrecision('ai_agent_creativity').default(0.65),
  aiAgentAntiRepeat: boolean('ai_agent_anti_repeat').default(true),
  inStoreGpsValidation: boolean('in_store_gps_validation').default(false),
  inStoreLatitude: doublePrecision('in_store_latitude').default(-19.7478),
  inStoreLongitude: doublePrecision('in_store_longitude').default(-47.9392),
  inStoreMaxRadiusMeters: integer('in_store_max_radius_meters').default(150),
  inStorePinValidation: boolean('in_store_pin_validation').default(false),
  inStorePinCode: text('in_store_pin_code').default('1234'),
  preferredPrinterName: text('preferred_printer_name').default(''),
  printerCutMode: text('printer_cut_mode').default('partial'),
  printerCopies: integer('printer_copies').default(2),
  totemPrinterCutMode: text('totem_printer_cut_mode').default('partial'),
  totemPrinterCopies: integer('totem_printer_copies').default(2),
  totemPrinterBottomSpaceCm: doublePrecision('totem_printer_bottom_space_cm').default(2.5),
  windowsPrinterCutMode: text('windows_printer_cut_mode').default('partial'),
  windowsPrinterCopies: integer('windows_printer_copies').default(2),
  windowsPrinterBottomSpaceCm: doublePrecision('windows_printer_bottom_space_cm').default(8.0),
  configuredPrinters: text('configured_printers').default('[]'),
  caixaPrinterName: text('caixa_printer_name').default(''),
  autoPrintOrdersOnCaixa: boolean('auto_print_orders_on_caixa').default(true),
  printerConnectionType: text('printer_connection_type').default('network'),
  networkPrinterIp: text('network_printer_ip').default(''),
  networkPrinterPort: integer('network_printer_port').default(9100),
  mercadoPagoEnabled: boolean('mercado_pago_enabled').default(true),
  mercadoPagoAccessToken: text('mercado_pago_access_token').default(''),
  mercadoPagoPublicKey: text('mercado_pago_public_key').default(''),
  mercadoPagoPixKey: text('mercado_pago_pix_key').default(''),
  deliveryEstimatedTimeMin: integer('delivery_estimated_time_min').default(35),
  deliveryEstimatedTimeMax: integer('delivery_estimated_time_max').default(50),
  onlinePaymentEnabled: boolean('online_payment_enabled').default(false),
  onlinePaymentOperator: text('online_payment_operator').default('mercadopago'),
  onlinePaymentPublicKey: text('online_payment_public_key').default(''),
  onlinePaymentSecretKey: text('online_payment_secret_key').default(''),
  showSystemIntroButton: boolean('show_system_intro_button').default(true),
  smsReminderTime1: text('sms_reminder_time_1').default('09:00'),
  smsReminderTime2: text('sms_reminder_time_2').default('12:00'),
  smsReminderTime3: text('sms_reminder_time_3').default('15:00'),
  smsRemindersEnabled: boolean('sms_reminders_enabled').default(true),
  autoSmsWebhookUrl: text('auto_sms_webhook_url').default(''),
  autoSmsApiKey: text('auto_sms_api_key').default(''),
  orderSoundEnabled: boolean('order_sound_enabled').default(true),
  orderChimeEnabled: boolean('order_chime_enabled').default(true),
});

// TV Media Playlist table for Smart TV Indoor Signage
export const tvMedia = pgTable('tv_media', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  type: text('type').notNull().default('video'), // 'video' | 'image' | 'youtube'
  url: text('url').notNull(),
  durationSeconds: integer('duration_seconds').default(15),
  order: integer('order').default(0),
  showCaptions: boolean('show_captions').default(false),
  fitMode: text('fit_mode').default('fit'), // 'fit' | 'vertical_smartphone' | 'cover'
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

// App Installs tracking table for PWA
export const appInstalls = pgTable('app_installs', {
  id: text('id').primaryKey(),
  platform: text('platform').default('unknown'), // 'android', 'ios', 'windows', 'macos', 'linux', 'other'
  browser: text('browser').default('unknown'), // 'chrome', 'safari', 'edge', 'firefox', 'samsung', 'other'
  deviceType: text('device_type').default('mobile'), // 'mobile', 'tablet', 'desktop'
  installedAt: bigint('installed_at', { mode: 'number' }).notNull(),
  userAgent: text('user_agent').default(''),
});

// Customers & Marketing Leads table
export const customers = pgTable('customers', {
  id: text('id').primaryKey(),
  externalId: text('external_id'),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  email: text('email').default(''),
  cpf: text('cpf').default(''),
  password: text('password').default('123456'),
  address: text('address').default(''),
  street: text('street').default(''),
  number: text('number').default(''),
  complement: text('complement').default(''),
  neighborhood: text('neighborhood').default(''),
  cep: text('cep').default(''),
  source: text('source').default('cadastro_cardapio'), // 'cadastro_cardapio' | 'pedido_delivery' | 'pedido_loja' | 'pedido_totem' | 'assistente_ia' | 'popup_novidades' | 'manual' | 'bluefocus_erp'
  totalOrders: integer('total_orders').default(0),
  totalSpent: doublePrecision('total_spent').default(0),
  lastOrderAt: bigint('last_order_at', { mode: 'number' }),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  tags: text('tags').default('[]'),
  notes: text('notes').default(''),
  defaultAddressId: text('default_address_id'),
  status: text('status').default('approved'),
  minOrderValue: doublePrecision('min_order_value').default(0),
  monthlyGoal: doublePrecision('monthly_goal').default(0),
});

// Customer Addresses table
export const customerAddresses = pgTable('customer_addresses', {
  id: text('id').primaryKey(),
  customerId: text('customer_id').references(() => customers.id),
  alias: text('alias').default('Principal'), // 'Casa', 'Trabalho', etc.
  street: text('street').notNull(),
  number: text('number').notNull(),
  complement: text('complement'),
  neighborhood: text('neighborhood').notNull(),
  cep: text('cep').notNull(),
  reference: text('reference'),
  isDefault: boolean('is_default').default(false),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
});

// Totem Backups table (guarantees totem backups are never lost on deploy)
export const totemBackups = pgTable('totem_backups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: text('created_at').notNull(),
  activeCategoriesCount: integer('active_categories_count').default(0),
  activeProductsCount: integer('active_products_count').default(0),
  categories: jsonb('categories').default([]),
  products: jsonb('products').default([]),
});

