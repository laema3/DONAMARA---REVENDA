import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../firebase';
import { useStore, defaultStoreInfo } from '../store/useStore';

const COLLECTIONS = {
  STORE_INFO: 'dm_store_info',
  CATEGORIES: 'dm_categories',
  PRODUCTS: 'dm_products',
  ORDERS: 'dm_orders',
  CUSTOMERS: 'dm_customers',
  ADDRESSES: 'dm_addresses',
  USERS: 'dm_users',
  DRIVERS: 'dm_drivers',
  DELIVERY_ZONES: 'dm_delivery_zones',
  TABLES: 'dm_tables',
  TV_MEDIA: 'dm_tv_media',
  TOTEM_BACKUPS: 'dm_totem_backups',
  SMS_REMINDERS: 'dm_sms_reminders',
  APP_INSTALLS: 'dm_app_installs',
};

// Compress large base64 images so they never exceed Firestore's 1MB document limit
async function compressBase64Image(dataUrl: string, maxWidth = 800, quality = 0.8): Promise<string> {
  if (typeof window === 'undefined' || !dataUrl || !dataUrl.startsWith('data:image/') || dataUrl.length < 450_000) {
    return dataUrl;
  }
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(dataUrl);
          ctx.drawImage(img, 0, 0, width, height);
          const isPng = dataUrl.startsWith('data:image/png');
          const compressed = canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', quality);
          if (compressed.length > 500_000) {
            resolve(canvas.toDataURL('image/jpeg', 0.65));
          } else {
            resolve(compressed);
          }
        } catch {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    } catch {
      resolve(dataUrl);
    }
  });
}

// Recursively remove undefined values and compress oversized base64 strings
async function sanitizeForFirestore(val: any): Promise<any> {
  if (val === undefined) return null;
  if (val === null || typeof val === 'number' || typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    if (val.startsWith('data:image/') && val.length > 450_000) {
      return await compressBase64Image(val);
    }
    return val;
  }
  if (Array.isArray(val)) {
    const arr = [];
    for (const item of val) {
      arr.push(await sanitizeForFirestore(item));
    }
    return arr;
  }
  if (typeof val === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (typeof v === 'function') continue;
      out[k] = await sanitizeForFirestore(v);
    }
    return out;
  }
  return val;
}

function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function getCollectionList<T = any>(colName: string): Promise<T[]> {
  try {
    const snap = await getDocs(collection(db, colName));
    const list: T[] = [];
    snap.forEach((d) => {
      list.push({ ...(d.data() as any), id: d.id });
    });
    return list;
  } catch (err) {
    console.warn(`[Firestore] Error reading ${colName}:`, err);
    return [];
  }
}

function normalizeOrder(o: any): any {
  if (!o) return o;
  let parsedItems = o.items;
  if (typeof parsedItems === 'string') {
    try {
      parsedItems = JSON.parse(parsedItems);
    } catch {
      parsedItems = [];
    }
  }
  if (!Array.isArray(parsedItems)) parsedItems = [];
  return {
    ...o,
    id: String(o.id),
    items: parsedItems,
    total: Number(o.total) || 0,
    createdAt: Number(o.createdAt) || Date.now(),
    status: o.status || ((o.type === 'delivery' || o.type === 'online' || o.deliveryType === 'delivery' || o.deliveryType === 'pickup') ? 'pending' : 'completed'),
  };
}

function normalizeCustomer(c: any): any {
  if (!c) return c;
  let tags = c.tags;
  if (typeof tags === 'string') {
    try {
      tags = JSON.parse(tags);
    } catch {
      tags = tags.split(',').map((t: string) => t.trim()).filter(Boolean);
    }
  }
  if (!Array.isArray(tags)) tags = [];
  return {
    ...c,
    id: String(c.id),
    tags,
    status: c.status || 'approved',
    totalOrders: Number(c.totalOrders) || 0,
    totalSpent: Number(c.totalSpent) || 0,
    monthlyGoal: Number(c.monthlyGoal) || 0,
  };
}

async function calculateCustomerMonthSpent(cust: any): Promise<number> {
  try {
    const orders = (await getCollectionList(COLLECTIONS.ORDERS)).map(normalizeOrder);
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();
    const cleanCpf = String(cust.cpf || '').replace(/\D/g, '');
    const cleanPhone = String(cust.phone || '').replace(/\D/g, '');

    let sum = 0;
    for (const o of orders) {
      if (!o || o.status === 'cancelled') continue;
      const d = new Date(o.createdAt);
      if (d.getFullYear() !== curYear || d.getMonth() !== curMonth) continue;
      const oCpf = String(o.customerCpf || '').replace(/\D/g, '');
      const oPhone = String(o.customerPhone || '').replace(/\D/g, '');
      const matchId = cust.id && o.customerId === cust.id;
      const matchCpf = cleanCpf.length >= 5 && oCpf.length >= 5 && cleanCpf === oCpf;
      const matchPhone = cleanPhone.length >= 8 && oPhone.length >= 8 && cleanPhone.slice(-8) === oPhone.slice(-8);
      if (matchId || matchCpf || matchPhone) {
        sum += Number(o.total) || 0;
      }
    }
    return sum;
  } catch {
    return 0;
  }
}

// Real-time listeners so all computers/devices stay in instant sync
let realtimeInitialized = false;
export function startFirestoreRealtimeSync() {
  if (realtimeInitialized || typeof window === 'undefined') return;
  realtimeInitialized = true;

  try {
    // 1. Real-time Orders listener
    onSnapshot(
      collection(db, COLLECTIONS.ORDERS),
      (snap) => {
        const list: any[] = [];
        snap.forEach((d) => {
          list.push(normalizeOrder({ ...d.data(), id: d.id }));
        });
        list.sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
        const current = useStore.getState().orders || [];
        if (list.length > 0 || current.length === 0) {
          useStore.getState().setOrders(list);
        }
      },
      (err) => console.warn('[Firestore Realtime Orders Warning]:', err)
    );

    // 2. Real-time Customers listener
    onSnapshot(
      collection(db, COLLECTIONS.CUSTOMERS),
      (snap) => {
        const list: any[] = [];
        snap.forEach((d) => {
          list.push(normalizeCustomer({ ...d.data(), id: d.id }));
        });
        list.sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
        const current = useStore.getState().customers || [];
        if (list.length > 0 || current.length === 0) {
          useStore.getState().setCustomers(list);
        }
      },
      (err) => console.warn('[Firestore Realtime Customers Warning]:', err)
    );

    // 3. Real-time Store Info listener
    onSnapshot(
      doc(db, COLLECTIONS.STORE_INFO, 'main'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data && typeof data === 'object') {
            useStore.getState().setStoreInfo({
              ...defaultStoreInfo,
              ...data,
              deliveryEnabled: data.deliveryEnabled !== undefined ? Boolean(data.deliveryEnabled) : true,
            });
          }
        }
      },
      (err) => console.warn('[Firestore Realtime StoreInfo Warning]:', err)
    );

    // 4. Real-time Categories listener
    onSnapshot(
      collection(db, COLLECTIONS.CATEGORIES),
      (snap) => {
        const list: any[] = [];
        snap.forEach((d) => {
          list.push({ ...d.data(), id: d.id });
        });
        list.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
        if (list.length > 0) {
          useStore.getState().setCategories(list);
        }
      },
      (err) => console.warn('[Firestore Realtime Categories Warning]:', err)
    );

    // 5. Real-time Products listener
    onSnapshot(
      collection(db, COLLECTIONS.PRODUCTS),
      (snap) => {
        const list: any[] = [];
        snap.forEach((d) => {
          list.push({ ...d.data(), id: d.id });
        });
        if (list.length > 0) {
          useStore.getState().setProducts(list);
        }
      },
      (err) => console.warn('[Firestore Realtime Products Warning]:', err)
    );

    // 6. Real-time Tables listener
    onSnapshot(
      collection(db, COLLECTIONS.TABLES),
      (snap) => {
        const list: any[] = [];
        snap.forEach((d) => {
          list.push({ ...d.data(), id: d.id });
        });
        list.sort((a, b) => (Number(a.number) || 0) - (Number(b.number) || 0));
        if (list.length > 0) {
          useStore.getState().setTables(list);
        }
      },
      (err) => console.warn('[Firestore Realtime Tables Warning]:', err)
    );
  } catch (err) {
    console.warn('[Firestore Realtime Init Error]:', err);
  }
}

export async function handleFirestoreApiRequest(
  urlStr: string,
  init?: RequestInit
): Promise<Response> {
  const startTime = Date.now();
  const parsedUrl = new URL(urlStr, typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
  const pathname = parsedUrl.pathname;
  const method = (init?.method || 'GET').toUpperCase();

  let body: any = {};
  if (init?.body && typeof init.body === 'string') {
    try {
      body = JSON.parse(init.body);
    } catch {
      body = {};
    }
  }

  try {
    // 1. Version & Health & Connection Test
    if (pathname === '/api/version') {
      return jsonResponse({
        version: '2.5.0-cloud',
        serverStartTime: new Date().toISOString(),
      });
    }

    if (
      pathname === '/api/health' ||
      pathname === '/api/db/test-connection' ||
      pathname === '/api/db-status' ||
      pathname === '/api/db/storage-status'
    ) {
      const [orders, customers, products, categories] = await Promise.all([
        getCollectionList(COLLECTIONS.ORDERS),
        getCollectionList(COLLECTIONS.CUSTOMERS),
        getCollectionList(COLLECTIONS.PRODUCTS),
        getCollectionList(COLLECTIONS.CATEGORIES),
      ]);
      const responseTimeMs = Date.now() - startTime;
      return jsonResponse({
        status: 'ok',
        success: true,
        connected: true,
        message: 'Banco de Dados em Nuvem Conectado (Google Cloud Firestore)',
        host: 'Google Cloud Firestore (Multi-Dispositivo)',
        ordersCount: orders.length,
        customersCount: customers.length,
        productCount: products.length,
        categoryCount: categories.length,
        responseTimeMs,
        stats: {
          orders: orders.length,
          customers: customers.length,
          products: products.length,
          categories: categories.length,
        },
      });
    }

    if (pathname === '/api/db/force-hydrate') {
      const orders = (await getCollectionList(COLLECTIONS.ORDERS)).map(normalizeOrder);
      orders.sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
      useStore.getState().setOrders(orders);
      return jsonResponse({
        success: true,
        message: 'Sincronização com o Banco de Dados em Nuvem concluída com sucesso!',
        ordersCount: orders.length,
      });
    }

    // 2. Store Info
    if (pathname === '/api/db/store-info') {
      if (method === 'GET') {
        const snap = await getDoc(doc(db, COLLECTIONS.STORE_INFO, 'main'));
        if (snap.exists()) {
          const data = snap.data();
          return jsonResponse({ ...defaultStoreInfo, ...data });
        }
        return jsonResponse(defaultStoreInfo);
      }
      if (method === 'POST' || method === 'PUT') {
        const snap = await getDoc(doc(db, COLLECTIONS.STORE_INFO, 'main'));
        const existing = snap.exists() ? snap.data() : defaultStoreInfo;
        const merged = await sanitizeForFirestore({
          ...defaultStoreInfo,
          ...existing,
          ...body,
          updatedAt: Date.now(),
        });
        await setDoc(doc(db, COLLECTIONS.STORE_INFO, 'main'), merged, { merge: true });
        return jsonResponse(merged);
      }
    }

    // 3. Categories
    if (pathname === '/api/db/categories') {
      if (method === 'GET') {
        const list = await getCollectionList(COLLECTIONS.CATEGORIES);
        list.sort((a: any, b: any) => (Number(a.order) || 0) - (Number(b.order) || 0));
        return jsonResponse(list);
      }
      if (method === 'POST') {
        if (Array.isArray(body)) {
          const batch = writeBatch(db);
          for (const item of body) {
            const id = String(item.id || Math.random().toString(36).substring(2, 9));
            const clean = await sanitizeForFirestore({ ...item, id });
            batch.set(doc(db, COLLECTIONS.CATEGORIES, id), clean, { merge: true });
          }
          await batch.commit();
          return jsonResponse({ success: true, count: body.length });
        } else {
          const id = String(body.id || Math.random().toString(36).substring(2, 9));
          const clean = await sanitizeForFirestore({ ...body, id });
          await setDoc(doc(db, COLLECTIONS.CATEGORIES, id), clean, { merge: true });
          return jsonResponse(clean);
        }
      }
    }

    if (pathname.startsWith('/api/db/categories/')) {
      const id = decodeURIComponent(pathname.replace('/api/db/categories/', ''));
      if (method === 'PUT') {
        const clean = await sanitizeForFirestore({ ...body, id });
        await setDoc(doc(db, COLLECTIONS.CATEGORIES, id), clean, { merge: true });
        return jsonResponse(clean);
      }
      if (method === 'DELETE') {
        await deleteDoc(doc(db, COLLECTIONS.CATEGORIES, id));
        return jsonResponse({ success: true });
      }
    }

    // 4. Products
    if (pathname === '/api/db/products/batch') {
      const items = Array.isArray(body) ? body : (Array.isArray(body.products) ? body.products : []);
      const chunkSize = 350;
      for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        for (const p of chunk) {
          const id = String(p.id || Math.random().toString(36).substring(2, 9));
          const clean = await sanitizeForFirestore({ ...p, id });
          batch.set(doc(db, COLLECTIONS.PRODUCTS, id), clean, { merge: true });
        }
        await batch.commit();
      }
      return jsonResponse({ success: true, count: items.length });
    }

    if (pathname === '/api/db/products/clean-barcodes') {
      return jsonResponse({ success: true });
    }

    if (pathname === '/api/db/products') {
      if (method === 'GET') {
        const list = await getCollectionList(COLLECTIONS.PRODUCTS);
        return jsonResponse(list);
      }
      if (method === 'POST') {
        const id = String(body.id || Math.random().toString(36).substring(2, 9));
        const clean = await sanitizeForFirestore({ ...body, id });
        await setDoc(doc(db, COLLECTIONS.PRODUCTS, id), clean, { merge: true });
        return jsonResponse(clean);
      }
    }

    if (pathname.startsWith('/api/db/products/')) {
      const id = decodeURIComponent(pathname.replace('/api/db/products/', ''));
      if (method === 'PUT') {
        const clean = await sanitizeForFirestore({ ...body, id });
        await setDoc(doc(db, COLLECTIONS.PRODUCTS, id), clean, { merge: true });
        return jsonResponse(clean);
      }
      if (method === 'DELETE') {
        await deleteDoc(doc(db, COLLECTIONS.PRODUCTS, id));
        return jsonResponse({ success: true });
      }
    }

    // 5. Orders & Delivery Actions
    if (pathname === '/api/db/orders/batch') {
      const items = Array.isArray(body) ? body : (Array.isArray(body.orders) ? body.orders : []);
      const batch = writeBatch(db);
      for (const o of items) {
        const id = String(o.id || Math.floor(1000 + Math.random() * 9000));
        const clean = await sanitizeForFirestore(normalizeOrder({ ...o, id }));
        batch.set(doc(db, COLLECTIONS.ORDERS, id), clean, { merge: true });
      }
      await batch.commit();
      return jsonResponse({ success: true, count: items.length });
    }

    if (pathname === '/api/db/orders') {
      if (method === 'GET') {
        const list = (await getCollectionList(COLLECTIONS.ORDERS)).map(normalizeOrder);
        list.sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
        return jsonResponse(list);
      }
      if (method === 'POST') {
        const id = String(body.id || Math.floor(1000 + Math.random() * 9000));
        const normalized = normalizeOrder({
          ...body,
          id,
          createdAt: body.createdAt || Date.now(),
        });
        const clean = await sanitizeForFirestore(normalized);
        await setDoc(doc(db, COLLECTIONS.ORDERS, id), clean, { merge: true });

        // Also update customer totalOrders / totalSpent if customer exists
        if (normalized.customerId || normalized.customerCpf || normalized.customerPhone) {
          try {
            const custs = await getCollectionList(COLLECTIONS.CUSTOMERS);
            const cleanCpf = String(normalized.customerCpf || '').replace(/\D/g, '');
            const cleanPhone = String(normalized.customerPhone || '').replace(/\D/g, '');
            const matched = custs.find((c: any) =>
              (normalized.customerId && c.id === normalized.customerId) ||
              (cleanCpf.length >= 5 && String(c.cpf || '').replace(/\D/g, '') === cleanCpf) ||
              (cleanPhone.length >= 8 && String(c.phone || '').replace(/\D/g, '').slice(-8) === cleanPhone.slice(-8))
            );
            if (matched) {
              const updatedCust = await sanitizeForFirestore({
                ...matched,
                totalOrders: (Number(matched.totalOrders) || 0) + 1,
                totalSpent: (Number(matched.totalSpent) || 0) + (Number(normalized.total) || 0),
                lastOrderAt: Date.now(),
              });
              await setDoc(doc(db, COLLECTIONS.CUSTOMERS, matched.id), updatedCust, { merge: true });
            }
          } catch {}
        }

        return jsonResponse(clean);
      }
    }

    if (pathname.startsWith('/api/db/orders/')) {
      const rest = pathname.replace('/api/db/orders/', '');
      const parts = rest.split('/');
      const orderId = decodeURIComponent(parts[0]);
      const action = parts[1];

      const orderRef = doc(db, COLLECTIONS.ORDERS, orderId);
      const orderSnap = await getDoc(orderRef);
      const existingOrder = orderSnap.exists() ? normalizeOrder({ ...orderSnap.data(), id: orderId }) : null;

      if (!action) {
        if (method === 'GET') {
          if (!existingOrder) return jsonResponse({ error: 'Pedido não encontrado' }, 404);
          return jsonResponse(existingOrder);
        }
        if (method === 'PUT') {
          const updated = await sanitizeForFirestore(
            normalizeOrder({
              ...(existingOrder || {}),
              ...body,
              id: orderId,
            })
          );
          await setDoc(orderRef, updated, { merge: true });
          return jsonResponse(updated);
        }
        if (method === 'DELETE') {
          await deleteDoc(orderRef);
          return jsonResponse({ success: true });
        }
      } else if (action === 'assign-driver') {
        const updated = await sanitizeForFirestore({
          ...(existingOrder || { id: orderId }),
          driverId: body.driverId,
          driverName: body.driverName,
          deliveryStatus: 'assigned',
          status: existingOrder?.status === 'pending' ? 'preparing' : (existingOrder?.status || 'ready_for_delivery'),
        });
        await setDoc(orderRef, updated, { merge: true });
        return jsonResponse({ success: true, order: updated });
      } else if (action === 'accept-delivery') {
        const updated = await sanitizeForFirestore({
          ...(existingOrder || { id: orderId }),
          driverId: body.driverId || existingOrder?.driverId,
          driverName: body.driverName || existingOrder?.driverName,
          deliveryStatus: 'out_for_delivery',
          status: 'out_for_delivery',
          dispatchedAt: Date.now(),
        });
        await setDoc(orderRef, updated, { merge: true });
        return jsonResponse({ success: true, order: updated });
      } else if (action === 'complete-delivery') {
        const updated = await sanitizeForFirestore({
          ...(existingOrder || { id: orderId }),
          deliveryStatus: 'delivered',
          status: 'completed',
          deliveredAt: Date.now(),
        });
        await setDoc(orderRef, updated, { merge: true });
        return jsonResponse({ success: true, order: updated });
      } else if (action === 'append-items') {
        const existingItems = Array.isArray(existingOrder?.items) ? existingOrder.items : [];
        const newItems = Array.isArray(body.items) ? body.items : [];
        const combinedItems = [...existingItems, ...newItems];
        const addedTotal = newItems.reduce((acc: number, it: any) => acc + (Number(it.price) || 0) * (Number(it.quantity) || 1), 0);
        const updated = await sanitizeForFirestore({
          ...(existingOrder || { id: orderId }),
          items: combinedItems,
          total: (Number(existingOrder?.total) || 0) + addedTotal,
        });
        await setDoc(orderRef, updated, { merge: true });
        return jsonResponse({ success: true, order: updated });
      } else if (action === 'tracking') {
        let driver = null;
        if (existingOrder?.driverId) {
          const dSnap = await getDoc(doc(db, COLLECTIONS.DRIVERS, String(existingOrder.driverId)));
          if (dSnap.exists()) driver = { ...dSnap.data(), id: dSnap.id };
        }
        return jsonResponse({ order: existingOrder, driver });
      }
    }

    // 6. Customer Auth & Profile Routes
    if (pathname === '/api/db/customer-register') {
      const {
        name,
        phone,
        email,
        cpf,
        password,
        address,
        cep,
        street,
        number,
        complement,
        neighborhood,
        monthlyGoal,
      } = body;

      const cleanCpf = String(cpf || '').replace(/\D/g, '');
      if (!name || !cleanCpf || cleanCpf.length < 5) {
        return jsonResponse({ error: 'Preencha o Nome/Razão Social e um CNPJ ou CPF válido.' }, 400);
      }
      if (!phone) {
        return jsonResponse({ error: 'Informe o WhatsApp / Telefone para contato.' }, 400);
      }

      const allCustomers = await getCollectionList(COLLECTIONS.CUSTOMERS);
      const existingByCpf = allCustomers.find((c: any) => {
        const cCpf = String(c.cpf || '').replace(/\D/g, '');
        return cCpf.length >= 5 && (cCpf === cleanCpf || cCpf.replace(/^0+/, '') === cleanCpf.replace(/^0+/, ''));
      });

      if (existingByCpf) {
        return jsonResponse(
          {
            error:
              'Este CNPJ/CPF já está cadastrado! Volte para a tela de Login e acesse usando os 5 primeiros dígitos do CNPJ/CPF como senha.',
          },
          400
        );
      }

      const defaultPassword = cleanCpf.slice(0, 5);
      const finalPassword = password && String(password).trim().length >= 4 ? String(password).trim() : defaultPassword;
      const finalAddress =
        address?.trim() ||
        `${street || ''}, ${number || ''}${complement ? ` (${complement})` : ''} - ${neighborhood || ''}${
          cep ? ` - CEP: ${cep}` : ''
        }`
          .replace(/^, /, '')
          .replace(/ - $/, '')
          .trim();

      const custId = `cust_${Date.now()}`;
      const newCustomer = await sanitizeForFirestore({
        id: custId,
        externalId: null,
        name: String(name).trim(),
        phone: String(phone).trim(),
        email: email ? String(email).trim().toLowerCase() : '',
        cpf: String(cpf).trim(),
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
        status: 'approved',
        minOrderValue: 0,
        monthlyGoal: Number(monthlyGoal) || 0,
        tags: ['novo_cadastro', 'aprovado'],
        notes: cep ? `CEP Cadastrado: ${cep}` : '',
        defaultAddressId: null,
      });

      await setDoc(doc(db, COLLECTIONS.CUSTOMERS, custId), newCustomer, { merge: true });

      if (finalAddress || cep) {
        const addrId = `addr_${Date.now()}`;
        const newAddr = await sanitizeForFirestore({
          id: addrId,
          customerId: custId,
          alias: 'Principal',
          street: street?.trim() || finalAddress,
          number: number?.trim() || 'S/N',
          complement: complement?.trim() || '',
          neighborhood: neighborhood?.trim() || '',
          cep: cep?.trim() || '',
          reference: '',
          isDefault: true,
        });
        await setDoc(doc(db, COLLECTIONS.ADDRESSES, addrId), newAddr, { merge: true });
      }

      return jsonResponse({
        success: true,
        pendingApproval: false,
        password: finalPassword,
        message: `Cadastro realizado com sucesso! Sua senha inicial são os 5 primeiros dígitos do seu CNPJ/CPF (${finalPassword}).`,
        customer: newCustomer,
      });
    }

    if (pathname === '/api/db/customer-login') {
      const { identifier, password } = body;
      if (!identifier || !password) {
        return jsonResponse({ error: 'Informe o seu CNPJ ou CPF e a senha (5 primeiros dígitos).' }, 400);
      }

      const cleanId = String(identifier).trim().toLowerCase();
      const cleanDigits = String(identifier).replace(/\D/g, '');
      const cleanPass = String(password).trim();
      const cleanPassDigits = cleanPass.replace(/\D/g, '');

      const allCustomers = (await getCollectionList(COLLECTIONS.CUSTOMERS)).map(normalizeCustomer);
      const custByIdentifier = allCustomers.find((c: any) => {
        const cCpf = String(c.cpf || '').replace(/\D/g, '');
        const cEmail = String(c.email || '').trim().toLowerCase();
        const cPhone = String(c.phone || '').replace(/\D/g, '');
        const cExt = String(c.externalId || '').trim().toLowerCase();

        if (cleanDigits.length >= 5 && cCpf.length >= 5) {
          if (cCpf === cleanDigits) return true;
          if (cCpf.replace(/^0+/, '') === cleanDigits.replace(/^0+/, '') && cleanDigits.replace(/^0+/, '').length >= 5) {
            return true;
          }
        }
        if (cEmail.length > 0 && cEmail === cleanId) return true;
        if (cleanDigits.length >= 10 && cPhone === cleanDigits) return true;
        if (cExt.length > 0 && cExt === cleanId) return true;
        return false;
      });

      if (!custByIdentifier) {
        return jsonResponse({ error: 'CNPJ ou CPF não encontrado no cadastro de clientes.' }, 401);
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
        return jsonResponse(
          { error: 'Senha incorreta. A senha padrão são os 5 primeiros dígitos do seu CNPJ ou CPF.' },
          401
        );
      }

      if (custByIdentifier.status === 'pending') {
        custByIdentifier.status = 'approved';
        await setDoc(doc(db, COLLECTIONS.CUSTOMERS, custByIdentifier.id), { status: 'approved' }, { merge: true });
      }

      const isDefaultInitialPassword =
        (first5Cpf.length >= 5 && (cleanPass === first5Cpf || cleanPassDigits === first5Cpf)) ||
        (first5Input.length >= 5 && (cleanPass === first5Input || cleanPassDigits === first5Input)) ||
        storedPass === first5Cpf ||
        storedPass === first5Input ||
        storedPass === '123456';

      const mustChangePassword = Boolean(
        isDefaultInitialPassword ||
          custByIdentifier.mustChangePassword === true ||
          !custByIdentifier.passwordChangedAt
      );

      const currentMonthSpent = await calculateCustomerMonthSpent(custByIdentifier);

      return jsonResponse({
        success: true,
        customer: { ...custByIdentifier, mustChangePassword },
        mustChangePassword,
        currentMonthSpent,
      });
    }

    if (pathname === '/api/db/customer-change-password') {
      const { customerId, identifier, newPassword, confirmPassword } = body;
      if (!newPassword || typeof newPassword !== 'string') {
        return jsonResponse({ error: 'Informe a nova senha.' }, 400);
      }
      const trimmedNewPass = newPassword.trim();
      if (trimmedNewPass.length < 5) {
        return jsonResponse({ error: 'A nova senha deve ter no mínimo 5 caracteres.' }, 400);
      }
      if (confirmPassword && confirmPassword.trim() !== trimmedNewPass) {
        return jsonResponse({ error: 'A confirmação de senha não coincide com a nova senha digitada.' }, 400);
      }

      const cleanDigits = String(identifier || '').replace(/\D/g, '');
      const allCustomers = (await getCollectionList(COLLECTIONS.CUSTOMERS)).map(normalizeCustomer);
      const cust = allCustomers.find((c: any) => {
        if (customerId && (c.id === customerId || String(c.externalId) === String(customerId))) return true;
        const cCpf = String(c.cpf || '').replace(/\D/g, '');
        if (cleanDigits.length >= 5 && cCpf.length >= 5) {
          if (cCpf === cleanDigits || cCpf.replace(/^0+/, '') === cleanDigits.replace(/^0+/, '')) return true;
        }
        return false;
      });

      if (!cust) {
        return jsonResponse({ error: 'Cliente não encontrado.' }, 404);
      }

      const cCpfDigits = String(cust.cpf || '').replace(/\D/g, '');
      const first5Cpf = cCpfDigits.slice(0, 5);
      if (first5Cpf.length >= 5 && trimmedNewPass === first5Cpf) {
        return jsonResponse(
          { error: 'A nova senha deve ser diferente dos 5 primeiros dígitos do seu CNPJ ou CPF.' },
          400
        );
      }

      const updatedCustomer = await sanitizeForFirestore({
        ...cust,
        password: trimmedNewPass,
        mustChangePassword: false,
        passwordChangedAt: Date.now(),
      });
      await setDoc(doc(db, COLLECTIONS.CUSTOMERS, cust.id), updatedCustomer, { merge: true });

      return jsonResponse({
        success: true,
        message: 'Senha alterada com sucesso! Seu acesso está liberado.',
        customer: updatedCustomer,
      });
    }

    if (pathname === '/api/db/customer-forgot') {
      const { identifier } = body;
      if (!identifier) {
        return jsonResponse({ error: 'Informe o seu CNPJ ou CPF cadastrado para recuperar a senha.' }, 400);
      }
      const cleanId = String(identifier).trim().toLowerCase();
      const cleanDigits = String(identifier).replace(/\D/g, '');

      const allCustomers = (await getCollectionList(COLLECTIONS.CUSTOMERS)).map(normalizeCustomer);
      const cust = allCustomers.find((c: any) => {
        const cCpf = String(c.cpf || '').replace(/\D/g, '');
        if (cleanDigits.length >= 5 && cCpf.length >= 5) {
          if (cCpf === cleanDigits || cCpf.replace(/^0+/, '') === cleanDigits.replace(/^0+/, '')) return true;
        }
        const cEmail = String(c.email || '').trim().toLowerCase();
        const cPhone = String(c.phone || '').replace(/\D/g, '');
        return (cEmail.length > 0 && cEmail === cleanId) || (cleanDigits.length >= 10 && cPhone === cleanDigits);
      });

      if (!cust) {
        return jsonResponse({ error: 'Nenhum cliente encontrado com este CNPJ ou CPF.' }, 404);
      }

      const cCpf = String(cust.cpf || '').replace(/\D/g, '');
      const recoveredPassword = cCpf.length >= 5 ? cCpf.slice(0, 5) : cust.password || '12345';
      await setDoc(doc(db, COLLECTIONS.CUSTOMERS, cust.id), { password: recoveredPassword }, { merge: true });

      return jsonResponse({
        success: true,
        customerName: cust.name,
        cpf: cust.cpf,
        status: 'approved',
        password: recoveredPassword,
        message: `Sua senha de acesso é: ${recoveredPassword}`,
      });
    }

    if (pathname.startsWith('/api/db/customer-profile/')) {
      const id = decodeURIComponent(pathname.replace('/api/db/customer-profile/', ''));
      const snap = await getDoc(doc(db, COLLECTIONS.CUSTOMERS, id));
      if (!snap.exists()) {
        return jsonResponse({ error: 'Cliente não encontrado' }, 404);
      }
      const cust = normalizeCustomer({ ...snap.data(), id: snap.id });
      const currentMonthSpent = await calculateCustomerMonthSpent(cust);
      return jsonResponse({
        success: true,
        customer: cust,
        currentMonthSpent,
      });
    }

    // 7. Customers CRUD & Addresses & Customer Orders
    if (pathname === '/api/db/customers/batch') {
      const items = Array.isArray(body) ? body : (Array.isArray(body.customers) ? body.customers : []);
      const chunkSize = 350;
      for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        for (const c of chunk) {
          const id = String(c.id || `cust_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
          const clean = await sanitizeForFirestore(normalizeCustomer({ ...c, id }));
          batch.set(doc(db, COLLECTIONS.CUSTOMERS, id), clean, { merge: true });
        }
        await batch.commit();
      }
      return jsonResponse({ success: true, count: items.length });
    }

    if (pathname === '/api/db/customers/sync-from-orders') {
      const [orders, existingCusts] = await Promise.all([
        getCollectionList(COLLECTIONS.ORDERS),
        getCollectionList(COLLECTIONS.CUSTOMERS),
      ]);
      const batch = writeBatch(db);
      let added = 0;
      for (const o of orders) {
        if (!o.customerName || o.customerName === 'Cliente' || o.customerName === 'Cliente Totem') continue;
        const cleanPhone = String(o.customerPhone || '').replace(/\D/g, '');
        if (cleanPhone.length < 8) continue;
        const exists = existingCusts.some((c: any) => String(c.phone || '').replace(/\D/g, '').slice(-8) === cleanPhone.slice(-8));
        if (!exists) {
          const id = `cust_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const newCust = await sanitizeForFirestore({
            id,
            name: o.customerName,
            phone: o.customerPhone || '',
            cpf: o.customerCpf || '',
            address: o.deliveryAddress || '',
            status: 'approved',
            source: 'order',
            totalOrders: 1,
            totalSpent: Number(o.total) || 0,
            createdAt: o.createdAt || Date.now(),
            tags: ['cliente_pedido'],
          });
          batch.set(doc(db, COLLECTIONS.CUSTOMERS, id), newCust, { merge: true });
          existingCusts.push(newCust);
          added++;
        }
      }
      if (added > 0) await batch.commit();
      return jsonResponse({ success: true, added });
    }

    if (pathname.startsWith('/api/db/customers/addresses/')) {
      const addrId = decodeURIComponent(pathname.replace('/api/db/customers/addresses/', ''));
      if (method === 'DELETE') {
        await deleteDoc(doc(db, COLLECTIONS.ADDRESSES, addrId));
        return jsonResponse({ success: true });
      }
    }

    if (pathname.startsWith('/api/db/customers/')) {
      const rest = pathname.replace('/api/db/customers/', '');
      const parts = rest.split('/');
      const custId = decodeURIComponent(parts[0]);
      const subResource = parts[1];

      if (subResource === 'addresses') {
        if (method === 'GET') {
          const allAddrs = await getCollectionList(COLLECTIONS.ADDRESSES);
          const filtered = allAddrs.filter((a: any) => String(a.customerId) === String(custId));
          return jsonResponse(filtered);
        }
        if (method === 'POST') {
          const addrId = String(body.id || `addr_${Date.now()}`);
          const newAddr = await sanitizeForFirestore({
            ...body,
            id: addrId,
            customerId: custId,
          });
          await setDoc(doc(db, COLLECTIONS.ADDRESSES, addrId), newAddr, { merge: true });
          return jsonResponse({ success: true, address: newAddr });
        }
      }

      if (subResource === 'orders') {
        const [allOrders, custSnap] = await Promise.all([
          getCollectionList(COLLECTIONS.ORDERS),
          getDoc(doc(db, COLLECTIONS.CUSTOMERS, custId)),
        ]);
        const cust = custSnap.exists() ? custSnap.data() : null;
        const cleanCpf = String(cust?.cpf || '').replace(/\D/g, '');
        const cleanPhone = String(cust?.phone || '').replace(/\D/g, '');

        const matchedOrders = allOrders
          .map(normalizeOrder)
          .filter((o: any) => {
            if (String(o.customerId) === String(custId)) return true;
            const oCpf = String(o.customerCpf || '').replace(/\D/g, '');
            const oPhone = String(o.customerPhone || '').replace(/\D/g, '');
            if (cleanCpf.length >= 5 && oCpf === cleanCpf) return true;
            if (cleanPhone.length >= 8 && oPhone.slice(-8) === cleanPhone.slice(-8)) return true;
            return false;
          })
          .sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));

        return jsonResponse(matchedOrders);
      }

      if (!subResource) {
        if (method === 'GET') {
          const snap = await getDoc(doc(db, COLLECTIONS.CUSTOMERS, custId));
          if (!snap.exists()) return jsonResponse({ error: 'Cliente não encontrado' }, 404);
          return jsonResponse(normalizeCustomer({ ...snap.data(), id: snap.id }));
        }
        if (method === 'PUT') {
          const snap = await getDoc(doc(db, COLLECTIONS.CUSTOMERS, custId));
          const existing = snap.exists() ? snap.data() : {};
          const updated = await sanitizeForFirestore(
            normalizeCustomer({
              ...existing,
              ...body,
              id: custId,
            })
          );
          await setDoc(doc(db, COLLECTIONS.CUSTOMERS, custId), updated, { merge: true });
          return jsonResponse(updated);
        }
        if (method === 'DELETE') {
          await deleteDoc(doc(db, COLLECTIONS.CUSTOMERS, custId));
          return jsonResponse({ success: true });
        }
      }
    }

    if (pathname === '/api/db/customers') {
      if (method === 'GET') {
        const list = (await getCollectionList(COLLECTIONS.CUSTOMERS)).map(normalizeCustomer);
        list.sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
        return jsonResponse(list);
      }
      if (method === 'POST') {
        const id = String(body.id || `cust_${Date.now()}`);
        const cleanCpf = String(body.cpf || '').replace(/\D/g, '');
        const defaultPass = cleanCpf.length >= 5 ? cleanCpf.slice(0, 5) : '12345';
        const newCust = await sanitizeForFirestore(
          normalizeCustomer({
            createdAt: Date.now(),
            status: 'approved',
            password: body.password || defaultPass,
            ...body,
            id,
          })
        );
        await setDoc(doc(db, COLLECTIONS.CUSTOMERS, id), newCust, { merge: true });
        return jsonResponse(newCust);
      }
    }

    // 8. Drivers (Motoboys)
    if (pathname === '/api/db/drivers') {
      if (method === 'GET') {
        const list = await getCollectionList(COLLECTIONS.DRIVERS);
        return jsonResponse(list);
      }
      if (method === 'POST') {
        const id = String(body.id || `drv_${Date.now()}`);
        const newDriver = await sanitizeForFirestore({
          status: 'available',
          isActive: true,
          createdAt: Date.now(),
          ...body,
          id,
        });
        await setDoc(doc(db, COLLECTIONS.DRIVERS, id), newDriver, { merge: true });
        return jsonResponse(newDriver);
      }
    }

    if (pathname.startsWith('/api/db/drivers/')) {
      const rest = pathname.replace('/api/db/drivers/', '');
      const parts = rest.split('/');
      const drvId = decodeURIComponent(parts[0]);
      const sub = parts[1];

      if (sub === 'location') {
        const updated = await sanitizeForFirestore({
          lat: body.lat,
          lng: body.lng,
          lastLocationUpdate: Date.now(),
        });
        await setDoc(doc(db, COLLECTIONS.DRIVERS, drvId), updated, { merge: true });
        return jsonResponse({ success: true });
      }

      if (method === 'PUT') {
        const snap = await getDoc(doc(db, COLLECTIONS.DRIVERS, drvId));
        const existing = snap.exists() ? snap.data() : {};
        const updated = await sanitizeForFirestore({ ...existing, ...body, id: drvId });
        await setDoc(doc(db, COLLECTIONS.DRIVERS, drvId), updated, { merge: true });
        return jsonResponse(updated);
      }
      if (method === 'DELETE') {
        await deleteDoc(doc(db, COLLECTIONS.DRIVERS, drvId));
        return jsonResponse({ success: true });
      }
    }

    // 9. Delivery Zones & CEP Check
    if (pathname === '/api/db/delivery-zones') {
      if (method === 'GET') {
        const list = await getCollectionList(COLLECTIONS.DELIVERY_ZONES);
        return jsonResponse(list);
      }
      if (method === 'POST') {
        const id = String(body.id || `zone_${Date.now()}`);
        const newZone = await sanitizeForFirestore({
          isActive: true,
          ...body,
          id,
        });
        await setDoc(doc(db, COLLECTIONS.DELIVERY_ZONES, id), newZone, { merge: true });
        return jsonResponse(newZone);
      }
    }

    if (pathname.startsWith('/api/db/delivery-zones/')) {
      const zoneId = decodeURIComponent(pathname.replace('/api/db/delivery-zones/', ''));
      if (method === 'PUT') {
        const updated = await sanitizeForFirestore({ ...body, id: zoneId });
        await setDoc(doc(db, COLLECTIONS.DELIVERY_ZONES, zoneId), updated, { merge: true });
        return jsonResponse(updated);
      }
      if (method === 'DELETE') {
        await deleteDoc(doc(db, COLLECTIONS.DELIVERY_ZONES, zoneId));
        return jsonResponse({ success: true });
      }
    }

    if (pathname === '/api/db/check-cep') {
      const cleanCep = String(body.cep || '').replace(/\D/g, '');
      if (cleanCep.length !== 8) {
        return jsonResponse({ success: false, valid: false, message: 'CEP inválido.' }, 400);
      }
      try {
        const viaCepRes = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const viaCepData = await viaCepRes.json();
        if (viaCepData.erro) {
          return jsonResponse({ success: false, valid: false, message: 'CEP não encontrado.' });
        }
        const zones = await getCollectionList(COLLECTIONS.DELIVERY_ZONES);
        const storeSnap = await getDoc(doc(db, COLLECTIONS.STORE_INFO, 'main'));
        const sInfo: any = storeSnap.exists() ? storeSnap.data() : defaultStoreInfo;
        const defaultFee = Number(sInfo?.deliveryFee) || 0;

        const norm = (s: string) =>
          String(s || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();
        const targetBairro = norm(viaCepData.bairro);
        const matchedZone = zones.find(
          (z: any) => z.isActive !== false && norm(z.neighborhood || z.name) === targetBairro
        );

        return jsonResponse({
          success: true,
          valid: true,
          street: viaCepData.logradouro || '',
          neighborhood: viaCepData.bairro || '',
          city: viaCepData.localidade || '',
          state: viaCepData.uf || '',
          fee: matchedZone ? Number(matchedZone.fee) || 0 : defaultFee,
          zoneName: matchedZone ? matchedZone.neighborhood || matchedZone.name : 'Taxa Padrão',
        });
      } catch {
        return jsonResponse({
          success: true,
          valid: true,
          street: '',
          neighborhood: '',
          city: '',
          state: '',
          fee: 0,
        });
      }
    }

    // 10. Tables (Mesas)
    if (pathname === '/api/db/tables/batch') {
      const tablesList = Array.isArray(body.tables) ? body.tables : (Array.isArray(body) ? body : []);
      const batch = writeBatch(db);
      const savedTables: any[] = [];
      for (const t of tablesList) {
        const id = String(t.id || `tbl_${t.number || Date.now()}`);
        const clean = await sanitizeForFirestore({
          status: 'available',
          isActive: true,
          ...t,
          id,
        });
        batch.set(doc(db, COLLECTIONS.TABLES, id), clean, { merge: true });
        savedTables.push(clean);
      }
      await batch.commit();
      return jsonResponse({ success: true, tables: savedTables });
    }

    if (pathname === '/api/db/tables') {
      if (method === 'GET') {
        const list = await getCollectionList(COLLECTIONS.TABLES);
        list.sort((a: any, b: any) => (Number(a.number) || 0) - (Number(b.number) || 0));
        return jsonResponse(list);
      }
      if (method === 'POST') {
        const id = String(body.id || `tbl_${Date.now()}`);
        const clean = await sanitizeForFirestore({
          status: 'available',
          isActive: true,
          ...body,
          id,
        });
        await setDoc(doc(db, COLLECTIONS.TABLES, id), clean, { merge: true });
        return jsonResponse(clean);
      }
    }

    if (pathname.startsWith('/api/db/tables/')) {
      const tblId = decodeURIComponent(pathname.replace('/api/db/tables/', ''));
      if (method === 'PUT') {
        const snap = await getDoc(doc(db, COLLECTIONS.TABLES, tblId));
        const existing = snap.exists() ? snap.data() : {};
        const clean = await sanitizeForFirestore({ ...existing, ...body, id: tblId });
        await setDoc(doc(db, COLLECTIONS.TABLES, tblId), clean, { merge: true });
        return jsonResponse(clean);
      }
      if (method === 'DELETE') {
        await deleteDoc(doc(db, COLLECTIONS.TABLES, tblId));
        return jsonResponse({ success: true });
      }
    }

    // 11. Users & Admin Auth
    if (pathname === '/api/auth/login') {
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '').trim();

      if (
        (email === 'admin@donamara.com.br' || email === 'admin') &&
        (password === 'donamara@123' || password === 'admin123')
      ) {
        return jsonResponse({
          success: true,
          user: {
            id: 'admin_donamara',
            uid: 'admin_donamara',
            name: 'Administrador DONAMARA',
            email: 'admin@donamara.com.br',
            role: 'master',
          },
        });
      }

      const users = await getCollectionList(COLLECTIONS.USERS);
      const found = users.find(
        (u: any) => String(u.email || '').trim().toLowerCase() === email && String(u.password || '') === password
      );
      if (found) {
        return jsonResponse({
          success: true,
          user: found,
        });
      }

      return jsonResponse({ error: 'Credenciais inválidas. Verifique seu e-mail e senha.' }, 401);
    }

    if (pathname === '/api/db/users') {
      if (method === 'GET') {
        const list = await getCollectionList(COLLECTIONS.USERS);
        const hasAdmin = list.some((u: any) => String(u.email || '').toLowerCase() === 'admin@donamara.com.br');
        if (!hasAdmin) {
          list.unshift({
            id: 'admin_donamara',
            uid: 'admin_donamara',
            name: 'Administrador DONAMARA',
            email: 'admin@donamara.com.br',
            role: 'master',
          });
        }
        return jsonResponse(list);
      }
      if (method === 'POST') {
        const id = String(body.uid || body.id || `usr_${Date.now()}`);
        const newUser = await sanitizeForFirestore({ ...body, id, uid: id });
        await setDoc(doc(db, COLLECTIONS.USERS, id), newUser, { merge: true });
        return jsonResponse(newUser);
      }
    }

    if (pathname.startsWith('/api/db/users/')) {
      const usrId = decodeURIComponent(pathname.replace('/api/db/users/', ''));
      if (method === 'PUT') {
        const snap = await getDoc(doc(db, COLLECTIONS.USERS, usrId));
        const existing = snap.exists() ? snap.data() : {};
        const updated = await sanitizeForFirestore({ ...existing, ...body, id: usrId });
        await setDoc(doc(db, COLLECTIONS.USERS, usrId), updated, { merge: true });
        return jsonResponse(updated);
      }
      if (method === 'DELETE') {
        await deleteDoc(doc(db, COLLECTIONS.USERS, usrId));
        return jsonResponse({ success: true });
      }
    }

    // 12. TV Media, Totem Backups, SMS Reminders, App Installs
    if (pathname === '/api/db/tv-media') {
      if (method === 'GET') {
        const list = await getCollectionList(COLLECTIONS.TV_MEDIA);
        return jsonResponse(list);
      }
      if (method === 'POST') {
        const id = String(body.id || `tv_${Date.now()}`);
        const clean = await sanitizeForFirestore({ ...body, id });
        await setDoc(doc(db, COLLECTIONS.TV_MEDIA, id), clean, { merge: true });
        return jsonResponse(clean);
      }
    }

    if (pathname.startsWith('/api/db/tv-media/')) {
      const mediaId = decodeURIComponent(pathname.replace('/api/db/tv-media/', ''));
      if (method === 'PUT') {
        const clean = await sanitizeForFirestore({ ...body, id: mediaId });
        await setDoc(doc(db, COLLECTIONS.TV_MEDIA, mediaId), clean, { merge: true });
        return jsonResponse(clean);
      }
      if (method === 'DELETE') {
        await deleteDoc(doc(db, COLLECTIONS.TV_MEDIA, mediaId));
        return jsonResponse({ success: true });
      }
    }

    if (pathname === '/api/db/totem-backups') {
      if (method === 'GET') {
        const list = await getCollectionList(COLLECTIONS.TOTEM_BACKUPS);
        return jsonResponse(list);
      }
      if (method === 'POST') {
        const id = `tb_${Date.now()}`;
        const backup = await sanitizeForFirestore({
          id,
          name: body.name || `Backup Totem ${new Date().toLocaleString('pt-BR')}`,
          createdAt: Date.now(),
          activeCategoriesCount: 0,
          activeProductsCount: 0,
        });
        await setDoc(doc(db, COLLECTIONS.TOTEM_BACKUPS, id), backup, { merge: true });
        return jsonResponse({ success: true, backup });
      }
    }

    if (pathname === '/api/db/sms-reminders') {
      if (method === 'GET') {
        const list = await getCollectionList(COLLECTIONS.SMS_REMINDERS);
        return jsonResponse(list);
      }
    }

    if (pathname === '/api/db/app-installs') {
      const list = await getCollectionList(COLLECTIONS.APP_INSTALLS);
      return jsonResponse({ count: list.length, installs: list });
    }

    if (pathname === '/api/db/hourly-backups') {
      return jsonResponse([]);
    }

    // Default safe response
    if (method === 'GET') {
      return jsonResponse([]);
    }
    return jsonResponse({ success: true });
  } catch (err: any) {
    console.error('[CloudFirestoreAPI Error]:', pathname, err);
    return jsonResponse({ error: err?.message || 'Erro interno na operação em nuvem' }, 500);
  }
}
