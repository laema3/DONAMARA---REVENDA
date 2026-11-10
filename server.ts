import express from "express";
import path from "path";
import axios from "axios";
import { XMLParser, XMLBuilder } from "fast-xml-parser";
import dotenv from "dotenv";
import compression from "compression";
import { setupDatabaseRoutes, hydrateFromPostgres, getMemStoreInfo, broadcastSSE } from "./src/server/dbRoutes";
import { setupPrinterRoutes } from "./src/server/printerRoutes";
import { setupPrinterAgentRoutes } from "./src/server/printerAgentRoutes";
import { ensureTablesExist, testDatabaseConnection } from "./src/db/index";
import { cleanProductDescription } from "./src/constants";

dotenv.config();

// Global crash protection for container environments (Render, Cloud Run, etc.)
process.on('uncaughtException', (err) => {
  console.error('[Process] Uncaught Exception capturada (evitando queda do servidor):', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Process] Unhandled Rejection capturada (evitando queda do servidor):', reason);
});

export const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Middleware registration (immediately available)
app.use(compression());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Prevent browser caching on DB API routes (ensures instant sync across mobile & desktop)
app.use('/api/db', (req, res, next) => {
  // For catalog endpoints, allow revalidation via ETag / 304 Not Modified
  if (req.path === '/products' || req.path === '/categories' || req.path === '/tables' || req.path === '/store-info' || req.path === '/tv-media') {
    res.setHeader('Cache-Control', 'no-cache');
  } else {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

app.use((req, res, next) => {
  const host = req.headers.host;
  // Log only API requests or page routes (skip internal Vite module compilation requests)
  if (!req.url.startsWith('/@') && !req.url.startsWith('/src/') && !req.url.startsWith('/node_modules/') && !req.url.includes('.tsx') && !req.url.includes('.ts')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} (Host: ${host})`);
  }
  next();
});

const SERVER_START_TIME = new Date().toISOString();
const RAILWAY_DEPLOYMENT_ID = process.env.RAILWAY_DEPLOYMENT_ID || process.env.RAILWAY_SNAPSHOT_ID || '';
const RAILWAY_GIT_COMMIT_SHA = process.env.RAILWAY_GIT_COMMIT_SHA || '';
const RAILWAY_GIT_COMMIT_MESSAGE = process.env.RAILWAY_GIT_COMMIT_MESSAGE || '';
const RAILWAY_ENVIRONMENT = process.env.RAILWAY_ENVIRONMENT_NAME || '';
const APP_BUILD_VERSION = process.env.APP_VERSION || (RAILWAY_GIT_COMMIT_SHA ? `2.5.0-${RAILWAY_GIT_COMMIT_SHA.slice(0, 7)}` : (RAILWAY_DEPLOYMENT_ID ? `2.5.0-${RAILWAY_DEPLOYMENT_ID.slice(0, 8)}` : "2.5.0"));

app.get("/api/version", (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.json({ 
    version: APP_BUILD_VERSION,
    railwayDeploymentId: RAILWAY_DEPLOYMENT_ID || null,
    railwaySnapshotId: process.env.RAILWAY_SNAPSHOT_ID || null,
    railwayCommitSha: RAILWAY_GIT_COMMIT_SHA || null,
    railwayCommitMessage: RAILWAY_GIT_COMMIT_MESSAGE || null,
    railwayEnvironment: RAILWAY_ENVIRONMENT || null,
    serverStartTime: SERVER_START_TIME,
  });
});

app.get("/api/ping", (req, res) => {
  res.json({ message: "pong", time: new Date().toISOString() });
});

app.get("/api/health", async (req, res) => {
  const dbStatus = await testDatabaseConnection();
  res.json({ 
    status: "ok", 
    node: process.version,
    env: process.env.NODE_ENV,
    db: dbStatus,
    time: new Date().toISOString()
  });
});

// Real-time broadcast sync delegation to dbRoutes unified SSE
export function broadcastSync(target = 'sync') {
  broadcastSSE({ type: target === 'sync' ? 'sync' : 'sync', target: target === 'sync' ? undefined : target, time: Date.now() });
}

// Mount Cloud SQL PostgreSQL API routes immediately
try {
  setupDatabaseRoutes(app, broadcastSync);
  setupPrinterRoutes(app);
  setupPrinterAgentRoutes(app, getMemStoreInfo);
} catch (err) {
  console.error("Erro ao registrar rotas do DB:", err);
}

// Image Proxy Route to prevent Mixed Content (HTTP -> HTTPS) SSL protocol errors
app.get("/api/image-proxy", async (req, res) => {
  const imageUrl = req.query.url as string;
  if (!imageUrl) {
    return res.status(400).send("URL parameter is required");
  }
  try {
    const response = await axios.get(imageUrl, {
      responseType: "stream",
      timeout: 4500,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });
    if (response.headers["content-type"]) {
      res.setHeader("Content-Type", response.headers["content-type"]);
    }
    res.setHeader("Cache-Control", "public, max-age=604800, immutable"); // Cache 7 dias quando sucesso
    response.data.pipe(res);
  } catch (error: any) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    const transparentGif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
    res.setHeader("Content-Type", "image/gif");
    res.status(200).send(transparentGif);
  }
});

// Helper function to diagnose and format BlueFocus errors friendly
function formatBlueFocusError(error: any): { message: string; details: any } {
  let friendlyMessage = "Erro ao comunicar com o servidor da BlueFocus";
  const errorDetail = error.response?.data || error.message || error.code || String(error);

  if (error.code === 'ECONNREFUSED') {
    friendlyMessage = "Conexão recusada pelo servidor BlueFocus (porta 8082 fechada ou serviço parado no computador local).";
  } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
    friendlyMessage = "Tempo limite esgotado (Timeout) ao conectar ao servidor BlueFocus. Verifique se o roteador/computador está online.";
  } else if (error.code === 'ENOTFOUND') {
    friendlyMessage = "Endereço DDNS não encontrado. Verifique o endereço configurado do servidor ERP.";
  } else if (error.response?.status === 401 || error.response?.status === 403) {
    friendlyMessage = "Chave de autenticação rejeitada pela BlueFocus. Verifique o campo 'autentica'.";
  } else if (typeof errorDetail === 'string') {
    if (errorDetail.includes('<Message>')) {
      const match = errorDetail.match(/<Message>(.*?)<\/Message>/);
      if (match) friendlyMessage = match[1];
    } else if (errorDetail.includes('<faultstring>')) {
      const match = errorDetail.match(/<faultstring>(.*?)<\/faultstring>/);
      if (match) friendlyMessage = match[1];
    } else if (errorDetail.includes('Erro')) {
      friendlyMessage = errorDetail.substring(0, 180);
    }
  }

  return { message: friendlyMessage, details: errorDetail };
}

// API Route for BlueFocus Product Sync
  app.post("/api/bluefocus/sync-products", async (req, res) => {
    console.log(`[Sync] Recebida requisição de sincronização: ${req.method} ${req.url}`);
    try {
      const {
        empresaId: reqEmpresaId, 
        usuarioId: reqUsuarioId, 
        pdvCodigo: reqPdvCodigo, 
        syncUrl: reqSyncUrl,
        tipoAtualizacao: reqTipoAtualizacao,
        tipo: reqTipo,
        dataInicial: reqDataInicial,
        startCargaNumero = 0,
        startCargaSequencia = 0,
        startProdutoId = 0,
        pessoaId: reqPessoaId = 0,
        authToken,
        batchSize = 50, // Number of iterations per request
        excludeKeywords = []
      } = req.body;

      const authKey = process.env.BLUE_FOCUS_AUTH_KEY || process.env.BLUEFOCUS_AUTH_KEY || process.env.BLUEFOCUS_AUTH_TOKEN;
      const empresaId = reqEmpresaId || process.env.BLUEFOCUS_EMPRESA_ID || process.env.BLUEFOCUS_EMPRESA || 'DONAMARA';
      const usuarioId = reqUsuarioId || process.env.BLUEFOCUS_USUARIO_ID || process.env.BLUEFOCUS_USUARIO || 'CONSULTA';
      const pdvCodigo = reqPdvCodigo || process.env.BLUEFOCUS_PDV_CODIGO || '1000';
      const syncUrl = reqSyncUrl || process.env.BLUEFOCUS_SYNC_URL || "";
      const tipoAtualizacao = reqTipoAtualizacao || 'A';
      const tipo = reqTipo || '4';
      const dataInicial = reqDataInicial || '30/12/1899';

      console.log(`Batch Sync: Empresa: [${empresaId}], Carga: ${startCargaNumero}/${startCargaSequencia}, Batch: ${batchSize}`);

      const isValidToken = (t?: string) => {
        if (!t) return false;
        const clean = String(t).trim();
        return clean.length > 5 && !clean.includes('XXXX') && clean !== 'AGUARDANDO_CHAVE' && clean !== 'undefined' && clean !== 'null';
      };

      const headers: any = {
        "Content-Type": "text/xml; charset=utf-8"
      };
      
      if (isValidToken(authToken)) {
        headers["autentica"] = authToken.trim();
      } else if (isValidToken(authKey)) {
        headers["autentica"] = authKey.trim();
      }

      let allMappedProducts: any[] = [];
      let currentCargaNumero = parseInt(String(startCargaNumero));
      let currentCargaSequencia = parseInt(String(startCargaSequencia));
      let lastProdutoId = parseInt(String(startProdutoId)); // The manual says to use this for pagination
      let hasMore = true;
      let iterations = 0;
      let lastXml = "";
      let snFim = 'N';
      let ignoredCount = 0;
      let ignoredBreakdown: Record<string, number> = { suspended: 0, filtered: 0 };
      let lastBatchProducts: any[] = [];
      
      const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]/g, " ").toUpperCase().trim();
      const excludeList = Array.isArray(excludeKeywords) ? excludeKeywords.map((k: string) => normalize(k)).filter(k => k.length > 0) : [];
      
      // Track visited markers to prevent infinite loops
      const visitedMarkers = new Set<string>();

      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        isArray: (name) => ["ProdutoItem", "produtoitem", "Produto", "PrecoProdutoItem"].includes(name)
      });

      const getVal = (obj: any, key: string) => {
        if (!obj || typeof obj !== 'object') return undefined;
        const lowerKey = key.toLowerCase();
        
        // Direct match or namespace match
        for (const k in obj) {
          const cleanK = k.toLowerCase().split(':').pop();
          if (cleanK === lowerKey) {
            const val = obj[k];
            // Handle { "#text": "value" } or similar from fast-xml-parser
            if (val && typeof val === 'object' && val['#text'] !== undefined) return val['#text'];
            return val;
          }
        }
        return undefined;
      };

      const soapTipoAtualizacao = String(tipoAtualizacao);
      const isFullSync = soapTipoAtualizacao === 'C' || (currentCargaNumero === 0 && currentCargaSequencia === 0);
      // Always request Tipo 4 (Produtos) for product sync, overriding legacy '1' (Cadastros Gerais)
      const soapTipo = (tipo === '1' || !tipo) ? '4' : String(tipo);

      const maxIterationsPerCall = Math.min(Number(batchSize) || 20, 20);

      while (iterations < maxIterationsPerCall && hasMore) {
        let soapCargaNumero = currentCargaNumero;
        let soapCargaSequencia = currentCargaSequencia;
        let soapProdutoId = lastProdutoId;

        if (isFullSync && iterations === 1) {
          soapCargaNumero = parseInt(String(startCargaNumero)) || 0;
          soapCargaSequencia = parseInt(String(startCargaSequencia)) || 0;
          soapProdutoId = parseInt(String(startProdutoId)) || 0;
        }

        // Respeita o tipo de atualização solicitado (C=Carga Total, A=Alterações)
        // Nota: Alguns ambientes BlueFocus podem exigir 'A' mesmo para carga inicial, 
        // mas aqui permitimos o controle pelo frontend/configuração.
        const finalTipoAtualizacao = soapTipoAtualizacao;

        const markerKey = `${soapCargaNumero}-${soapCargaSequencia}-${soapProdutoId}`;
        if (visitedMarkers.has(markerKey)) {
          console.log(`Marker ${markerKey} already visited. Stopping.`);
          hasMore = false;
          break;
        }
        visitedMarkers.add(markerKey);
        
        // Pequeno delay entre iterações SOAP dentro do mesmo request para não sobrecarregar o ERP
        if (iterations > 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        iterations++;

        
        console.log(`[BlueFocus] Iniciando requisição: Tipo=${soapTipo}, Atualizacao=${finalTipoAtualizacao}, Carga=${soapCargaNumero}/${soapCargaSequencia}, Iteração=${iterations}`);

        const soapDataInicio = dataInicial || "30/12/1899";

        const soapEnvelope = `<?xml version="1.0"?>
<SOAP-ENV:Envelope 
xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" 
xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<SOAP-ENV:Body>
<IntegracaoFcxExportaCadSAT.Execute xmlns="Valim">
<Sdtwebserviceentradaexpcadastro>
<EmpresaId>${empresaId}</EmpresaId>
<UsuarioId>${usuarioId}</UsuarioId>
<PDVCodigo>${pdvCodigo}</PDVCodigo>
<TipoAtualizacao>${finalTipoAtualizacao}</TipoAtualizacao>
<Tipo>${soapTipo}</Tipo>
<PessoaId>${reqPessoaId || 0}</PessoaId>
<CargaPDVNumero>${soapCargaNumero}</CargaPDVNumero>
<CargaPDVSequencia>${soapCargaSequencia}</CargaPDVSequencia>
<ProdutoId>${soapProdutoId}</ProdutoId>
<DataHoraInicio>${soapDataInicio}</DataHoraInicio>
</Sdtwebserviceentradaexpcadastro>
</IntegracaoFcxExportaCadSAT.Execute>
</SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;

        try {
          const currentTimeout = tipo === '1' ? 45000 : 15000;
          
          const response = await axios.post(syncUrl, soapEnvelope, { 
            headers, 
            timeout: currentTimeout 
          });
          lastXml = response.data;
          
          const jsonObj = parser.parse(response.data);
          const envelope = getVal(jsonObj, "Envelope");
          const body = getVal(envelope, "Body");
          const executeResponse = getVal(body, "IntegracaoFcxExportaCadSAT.ExecuteResponse") || getVal(body, "ExecuteResponse");
          const saiaExp = getVal(executeResponse, "Sdtwebservicesaidaexpcadastrosat") || getVal(executeResponse, "Sdtwebserviceout") || executeResponse;

          if (!saiaExp) {
            console.log("[Sync] Resposta vazia ou estrutura desconhecida. Debug XML:", lastXml.substring(0, 1000));
            hasMore = false;
            break;
          }

          const msgErro = getVal(saiaExp, "MsgErro");
          if (msgErro && msgErro !== "" && msgErro !== "OK") {
            return res.status(400).json({ error: msgErro, debugXml: lastXml.substring(0, 2000) });
          }

          let products = getVal(saiaExp, "ProdutoItem") || getVal(saiaExp, "Produto");
          let productsArray: any[] = [];
          
          if (products) {
            productsArray = Array.isArray(products) ? products : [products];
            lastBatchProducts = productsArray; // Keep for the response summary
            console.log(`[Sync] Iteração ${iterations}: Encontrados ${productsArray.length} itens no XML.`);
            
            for (const item of productsArray) {
              const pId = String(getVal(item, "ProdutoId") || "");
              if (!pId) continue;

              // Filter out suspended products
              const isSuspended = getVal(item, "ProdutoSNSuspenso") === 'S';
              if (isSuspended) {
                ignoredCount++;
                ignoredBreakdown.suspended++;
                continue;
              }

              // Update lastProdutoId for next loop paging as per documentation
              const currentId = parseInt(pId);
              if (!isNaN(currentId)) {
                lastProdutoId = currentId;
              }

              const pName = String(getVal(item, "ProdutoDescricaoResumida") || getVal(item, "ProdutoDescricao") || "Sem Nome");
              const pCat = String(getVal(item, "ProdutoFamiliaDescricao") || "");
              const normalizedName = normalize(pName);
              const normalizedCat = normalize(pCat);
              
              // Filter out excluded keywords by name or category
              if (excludeList.some(k => normalizedName.includes(k) || normalizedCat.includes(k))) {
                const matchingKey = excludeList.find(k => normalizedName.includes(k) || normalizedCat.includes(k)) || "unspecified";
                ignoredBreakdown[matchingKey] = (ignoredBreakdown[matchingKey] || 0) + 1;
                ignoredCount++;
                ignoredBreakdown.filtered++;
                continue;
              }

              let price = 0;
              const priceItems = getVal(item, "PrecoProdutoItem");
              if (priceItems) {
                const priceArray = Array.isArray(priceItems) ? priceItems : [priceItems];
                // Try to find the 'V' (Venda) price type
                const vPrice = priceArray.find((p: any) => 
                  getVal(p, "PrecoProdutoPrecoTipo") === 'V' || 
                  String(getVal(p, "PrecoProdutoPrecoDesc")).toLowerCase().includes('venda')
                ) || priceArray[0];
                price = parseFloat(String(getVal(vPrice, "PrecoProdutoValor") || 0).replace(',', '.'));
              } else {
                price = parseFloat(String(getVal(item, "ProdutoValorUnitario") || getVal(item, "ProdutoPrecoVenda") || 0).replace(',', '.'));
              }

              // Extract barcode from CodigoBarrasItem if available
              let barcode = "";
              const barcodeItems = getVal(item, "CodigoBarrasItem");
              if (barcodeItems) {
                const barcodeArray = Array.isArray(barcodeItems) ? barcodeItems : [barcodeItems];
                barcode = String(getVal(barcodeArray[0], "CodigoBarras") || "");
              }

              const rawDesc = getVal(item, "ProdutoDescricao") || "";
              const finalDesc = cleanProductDescription(rawDesc, true);

              // Base URL derivation for static mercadoria images (supports BlueFocus Cloud & Local Server)
              const baseUrl = syncUrl 
                ? String(syncUrl).split('?')[0].replace(/\/(servlet|ws|bluefocus|aintegracao).*$/i, '').replace(/\/+$/, '') 
                : '';
              const activeAuthToken = headers["autentica"] || "";
              const isBlueFocusCloud = String(syncUrl).toLowerCase().includes('bluefocuscloud') || String(syncUrl).toLowerCase().includes('app.bluefocus.com.br');
              const standardMercadoriaUrl = (isBlueFocusCloud && activeAuthToken && pId)
                ? `https://www.app.bluefocus.com.br/BlueFocusCloud/${activeAuthToken}/mercadoria/${pId}.jpg`
                : (baseUrl && pId)
                  ? `${baseUrl}/static/mercadoria/${pId}.jpg`
                  : "";
              const rawImgUrl = getVal(item, "ProdutoUrlImagem") || getVal(item, "UrlImagem") || getVal(item, "ProdutoImagemUrl") || getVal(item, "ImagemUrl") || getVal(item, "ProdutoImagem") || getVal(item, "Imagem") || getVal(item, "ProdutoFoto") || getVal(item, "Foto") || getVal(item, "UrlFoto") || getVal(item, "FotoUrl") || getVal(item, "ProdutoFotoUrl") || getVal(item, "ProdutoCaminhoImagem") || getVal(item, "CaminhoImagem") || getVal(item, "ProdutoLinkImagem") || getVal(item, "LinkImagem") || "";

              let finalImgUrl = rawImgUrl;
              if (finalImgUrl && !finalImgUrl.startsWith("http://") && !finalImgUrl.startsWith("https://") && baseUrl) {
                const cleanPath = finalImgUrl.startsWith("/") ? finalImgUrl : `/${finalImgUrl}`;
                finalImgUrl = `${baseUrl}${cleanPath}`;
              }
              if (!finalImgUrl) {
                finalImgUrl = standardMercadoriaUrl;
              }

              // Extract category/family/group safely from all known BlueFocus XML tags
              const rawCatId = getVal(item, "ProdutoFamiliaId") || 
                               getVal(item, "FamiliaId") || 
                               getVal(item, "ProdutoGrupoId") || 
                               getVal(item, "GrupoId") || 
                               getVal(item, "ProdutoSubGrupoId") || 
                               getVal(item, "SubGrupoId") || 
                               getVal(item, "ProdutoSecaoId") || 
                               getVal(item, "SecaoId") || 
                               getVal(item, "ProdutoFamiliaCod") || 
                               getVal(item, "ProdutoGrupoCod") || 
                               "0";

              let rawCatName = getVal(item, "ProdutoFamiliaDescricao") || 
                                getVal(item, "FamiliaDescricao") || 
                                getVal(item, "ProdutoGrupoDescricao") || 
                                getVal(item, "GrupoDescricao") || 
                                getVal(item, "ProdutoSubGrupoDescricao") || 
                                getVal(item, "SubGrupoDescricao") || 
                                getVal(item, "ProdutoSecaoDescricao") || 
                                getVal(item, "SecaoDescricao") || 
                                getVal(item, "ProdutoFamiliaNome") || 
                                getVal(item, "ProdutoGrupoNome") || 
                                "";

              if (!rawCatName && String(rawCatId) !== "0" && String(rawCatId) !== "") {
                rawCatName = `Grupo ${rawCatId}`;
              } else if (!rawCatName) {
                rawCatName = "Geral";
              }

              allMappedProducts.push({
                externalId: pId,
                name: getVal(item, "ProdutoDescricaoResumida") || getVal(item, "ProdutoDescricao") || "Sem Nome",
                description: finalDesc,
                price: price,
                imageUrl: finalImgUrl, 
                isActive: true,
                categoryExternalId: String(rawCatId),
                categoryName: String(rawCatName).trim()
              });
            }
          }

          // For Full Sync (Tipo 1), if snFim is not found, assume 'S' (finished)
          // For Change Sync (Tipo 4), if snFim is not found, assume 'N' to continue searching
          snFim = getVal(saiaExp, "SNFim") || (tipo === '1' ? 'S' : 'N');
          
          if (snFim === 'S') {
            hasMore = false;
          } else {
            // Try to get markers from the response root first
            const rootNextNumero = getVal(saiaExp, "CargaPDVNumero");
            const rootNextSequencia = getVal(saiaExp, "CargaPDVSequencia");
            
            if (rootNextNumero !== undefined && rootNextSequencia !== undefined) {
              const nNum = parseInt(String(rootNextNumero));
              const nSeq = parseInt(String(rootNextSequencia));
              
              if (nNum === currentCargaNumero && nSeq === currentCargaSequencia) {
                currentCargaSequencia++;
              } else {
                currentCargaNumero = nNum;
                currentCargaSequencia = nSeq;
              }
            } else if (productsArray.length > 0) {
              const lastProduct = productsArray[productsArray.length - 1];
              const pNextNumero = parseInt(String(getVal(lastProduct, "CargaPDVNumero") || currentCargaNumero));
              const pNextSequencia = parseInt(String(getVal(lastProduct, "CargaPDVSequencia") || currentCargaSequencia));
              
              if (pNextNumero === currentCargaNumero && pNextSequencia === currentCargaSequencia) {
                currentCargaSequencia++;
              } else {
                currentCargaNumero = pNextNumero;
                currentCargaSequencia = pNextSequencia;
              }
            } else {
              // No products and no markers in root? 
              // If SNFim is N, we try to advance sequencia to avoid getting stuck, 
              // but only for a few iterations.
              currentCargaSequencia++;
              if (iterations > 10) { 
                hasMore = false;
              }
            }
          }
        } catch (error: any) {
          console.error("Batch Error:", error.message);
          const { message: friendlyMsg, details: det } = formatBlueFocusError(error);
          return res.status(500).json({ 
            error: friendlyMsg,
            details: det,
            debugXml: error.response?.data ? String(error.response.data).substring(0, 2000) : undefined
          });
        }
      }

      res.json({ 
        products: allMappedProducts,
        nextCargaNumero: currentCargaNumero,
        nextCargaSequencia: currentCargaSequencia,
        snFim: snFim, // Retorna o marcador real de fim do ERP para permitir paginação correta no frontend
        iterations: iterations,
        ignoredCount: ignoredCount,
        ignoredBreakdown: ignoredBreakdown,
        lastProcessedName: lastBatchProducts.length > 0 ? String(getVal(lastBatchProducts[lastBatchProducts.length - 1], "ProdutoDescricaoResumida") || getVal(lastBatchProducts[lastBatchProducts.length - 1], "ProdutoDescricao") || "Sem Nome") : null,
        lastProductName: allMappedProducts.length > 0 ? allMappedProducts[allMappedProducts.length - 1].name : null,
        lastProductId: allMappedProducts.length > 0 ? allMappedProducts[allMappedProducts.length - 1].externalId : null,
        debugXml: lastXml.substring(0, 5000)
      });
    } catch (error: any) {
      console.error("BlueFocus Sync Error!");
      if (error.response) {
        console.error("Status:", error.response.status);
        console.error("Data:", error.response.data);
      } else if (error.request) {
        console.error("No response received from BlueFocus.");
      } else {
        console.error("Error setting up request:", error.message);
      }
      
      const { message: friendlyMessage, details: errorDetail } = formatBlueFocusError(error);

      res.status(500).json({ 
        error: friendlyMessage,
        details: errorDetail 
      });
    }
  });

  // API Route for BlueFocus Customer (Pessoa/Cliente) Sync
  app.post("/api/bluefocus/sync-customers", async (req, res) => {
    console.log(`[Sync Customers] Recebida requisição de sincronização de clientes: ${req.method} ${req.url}`);
    try {
      const {
        empresaId: reqEmpresaId,
        usuarioId: reqUsuarioId,
        pdvCodigo: reqPdvCodigo,
        syncUrl: reqSyncUrl,
        tipoAtualizacao: reqTipoAtualizacao,
        tipo: reqTipo,
        tipoCliente: reqTipoCliente,
        dataInicial: reqDataInicial,
        startCargaNumero = 0,
        startCargaSequencia = 0,
        startPessoaId = 0,
        authToken,
        batchSize = 20
      } = req.body;

      const authKey = process.env.BLUE_FOCUS_AUTH_KEY || process.env.BLUEFOCUS_AUTH_KEY || process.env.BLUEFOCUS_AUTH_TOKEN;
      const empresaId = reqEmpresaId || process.env.BLUEFOCUS_EMPRESA_ID || process.env.BLUEFOCUS_EMPRESA || 'DONAMARA';
      const usuarioId = reqUsuarioId || process.env.BLUEFOCUS_USUARIO_ID || process.env.BLUEFOCUS_USUARIO || 'CONSULTA';
      const pdvCodigo = reqPdvCodigo || process.env.BLUEFOCUS_PDV_CODIGO || '1000';
      const syncUrl = reqSyncUrl || process.env.BLUEFOCUS_SYNC_URL || "";
      const tipoAtualizacao = reqTipoAtualizacao || 'A';
      const dataInicial = reqDataInicial || '30/12/1899';

      const isValidToken = (t?: string) => {
        if (!t) return false;
        const clean = String(t).trim();
        return clean.length > 5 && !clean.includes('XXXX') && clean !== 'AGUARDANDO_CHAVE' && clean !== 'undefined' && clean !== 'null';
      };

      const headers: any = {
        "Content-Type": "text/xml; charset=utf-8"
      };
      if (isValidToken(authToken)) {
        headers["autentica"] = authToken.trim();
      } else if (isValidToken(authKey)) {
        headers["autentica"] = authKey.trim();
      }

      let allMappedCustomers: any[] = [];
      let currentCargaNumero = parseInt(String(startCargaNumero)) || 0;
      let currentCargaSequencia = parseInt(String(startCargaSequencia)) || 0;
      let lastPessoaId = parseInt(String(startPessoaId)) || 0;
      let hasMore = true;
      let iterations = 0;
      let lastXml = "";
      let snFim = 'N';
      let ignoredCount = 0;
      let ignoredBreakdown: Record<string, number> = { suspended: 0, withoutName: 0 };
      let lastBatchPeople: any[] = [];

      const visitedMarkers = new Set<string>();

      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        isArray: (name) => [
          "PessoaItem", "pessoaitem", "Pessoa", "PessoasItem", "ClienteItem", "clienteitem", "Cliente",
          "ParticipanteItem", "CadastroPessoaItem", "EnderecoItem", "PessoaEnderecoItem",
          "TelefoneItem", "PessoaTelefoneItem", "FoneItem", "EmailItem", "PessoaEmailItem"
        ].includes(name)
      });

      const getVal = (obj: any, key: string) => {
        if (!obj || typeof obj !== 'object') return undefined;
        const lowerKey = key.toLowerCase();
        for (const k in obj) {
          const cleanK = k.toLowerCase().split(':').pop();
          if (cleanK === lowerKey) {
            const val = obj[k];
            if (val && typeof val === 'object' && val['#text'] !== undefined) return val['#text'];
            return val;
          }
        }
        return undefined;
      };

      const getFirstVal = (obj: any, keys: string[]): string => {
        if (!obj || typeof obj !== 'object') return "";
        for (const k of keys) {
          const v = getVal(obj, k);
          if (v !== undefined && v !== null && typeof v !== 'object' && String(v).trim() !== "") {
            return String(v).trim();
          }
        }
        return "";
      };

      const extractPeopleArray = (saiaExp: any): any[] => {
        if (!saiaExp || typeof saiaExp !== 'object') return [];
        const directKeys = [
          "PessoaItem", "Pessoa", "PessoasItem", "Pessoas",
          "ClienteItem", "Cliente", "ClientesItem", "Clientes",
          "ParticipanteItem", "CadastroPessoaItem"
        ];
        for (const key of directKeys) {
          const found = getVal(saiaExp, key);
          if (found) {
            return Array.isArray(found) ? found : [found];
          }
        }
        // Fallback: inspect any key in saiaExp that looks like a person/customer collection (excluding Produto)
        for (const rawKey of Object.keys(saiaExp)) {
          const cleanK = (rawKey.toLowerCase().split(':').pop() || '');
          if (
            (cleanK.includes('pessoa') || cleanK.includes('cliente') || cleanK.includes('parceiro') || cleanK.includes('consumidor')) &&
            !cleanK.includes('produto')
          ) {
            const val = saiaExp[rawKey];
            if (val && typeof val === 'object') {
              return Array.isArray(val) ? val : [val];
            }
          }
        }
        return [];
      };

      const buildCustomerSoap = (t: string, tAtu: string, pId: number, cNum: number, cSeq: number) => `<?xml version="1.0"?>
<SOAP-ENV:Envelope 
xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" 
xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<SOAP-ENV:Body>
<IntegracaoFcxExportaCadSAT.Execute xmlns="Valim">
<Sdtwebserviceentradaexpcadastro>
<EmpresaId>${empresaId}</EmpresaId>
<UsuarioId>${usuarioId}</UsuarioId>
<PDVCodigo>${pdvCodigo}</PDVCodigo>
<TipoAtualizacao>${tAtu}</TipoAtualizacao>
<Tipo>${t}</Tipo>
<PessoaId>${pId}</PessoaId>
<CargaPDVNumero>${cNum}</CargaPDVNumero>
<CargaPDVSequencia>${cSeq}</CargaPDVSequencia>
<ProdutoId>0</ProdutoId>
<DataHoraInicio>${dataInicial || "30/12/1899"}</DataHoraInicio>
</Sdtwebserviceentradaexpcadastro>
</IntegracaoFcxExportaCadSAT.Execute>
</SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;

      // Default Tipo for Pessoas/Clientes in BlueFocus Valim (probes '2', '3', '1', '5' if not locked)
      const requestedTipo = reqTipoCliente || (reqTipo && String(reqTipo) !== '4' ? String(reqTipo) : '2');
      let activeTipo = String(requestedTipo);
      let activeTipoAtualizacao = String(tipoAtualizacao || 'A');
      const maxIterationsPerCall = Math.min(Number(batchSize) || 10, 20);

      while (iterations < maxIterationsPerCall && hasMore) {
        const soapCargaNumero = currentCargaNumero;
        const soapCargaSequencia = currentCargaSequencia;
        const soapPessoaId = lastPessoaId;

        const markerKey = `${activeTipo}-${activeTipoAtualizacao}-${soapCargaNumero}-${soapCargaSequencia}-${soapPessoaId}`;
        if (visitedMarkers.has(markerKey)) {
          console.log(`[Sync Customers] Marker ${markerKey} already visited. Stopping.`);
          hasMore = false;
          break;
        }
        visitedMarkers.add(markerKey);

        if (iterations > 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        iterations++;

        console.log(`[BlueFocus Customers] Requisitando: Tipo=${activeTipo}, Atualizacao=${activeTipoAtualizacao}, Carga=${soapCargaNumero}/${soapCargaSequencia}, PessoaId=${soapPessoaId}, Iteração=${iterations}`);

        try {
          const executeRequest = async (t: string, tAtu: string) => {
            const envXml = buildCustomerSoap(t, tAtu, soapPessoaId, soapCargaNumero, soapCargaSequencia);
            const resp = await axios.post(syncUrl, envXml, { headers, timeout: 25000 });
            const rawXml = resp.data;
            const parsed = parser.parse(rawXml);
            const env = getVal(parsed, "Envelope");
            const bdy = getVal(env, "Body");
            const execResp = getVal(bdy, "IntegracaoFcxExportaCadSAT.ExecuteResponse") || getVal(bdy, "ExecuteResponse");
            const out = getVal(execResp, "Sdtwebservicesaidaexpcadastrosat") || getVal(execResp, "Sdtwebserviceout") || execResp;
            return { rawXml, saiaExp: out };
          };

          let { rawXml, saiaExp } = await executeRequest(activeTipo, activeTipoAtualizacao);
          lastXml = rawXml;

          // Auto-discover the right Tipo for Pessoas/Clientes on the very first call if initial response has no people
          if (iterations === 1 && extractPeopleArray(saiaExp).length === 0) {
            const candidateTipos = Array.from(new Set([activeTipo, '2', '3', '1', '5']));
            const candidateAtus = activeTipoAtualizacao === 'C' ? ['C', 'A'] : [activeTipoAtualizacao];
            let foundMatch = false;

            for (const cAtu of candidateAtus) {
              for (const cTipo of candidateTipos) {
                if (cTipo === activeTipo && cAtu === activeTipoAtualizacao) {
                  const hasNextMarkers = getVal(saiaExp, "SNFim") === 'N' && !getVal(saiaExp, "ProdutoItem");
                  if (hasNextMarkers) {
                    foundMatch = true;
                    break;
                  }
                  continue;
                }
                try {
                  console.log(`[BlueFocus Customers] Sondando Tipo=${cTipo}, TipoAtualizacao=${cAtu} para localizar cadastro de clientes...`);
                  const probe = await executeRequest(cTipo, cAtu);
                  const probePeople = extractPeopleArray(probe.saiaExp);
                  const probeSnFim = getVal(probe.saiaExp, "SNFim");
                  const hasOnlyProducts = Boolean(getVal(probe.saiaExp, "ProdutoItem")) && probePeople.length === 0;
                  if (probePeople.length > 0 || (probeSnFim === 'N' && !hasOnlyProducts)) {
                    activeTipo = cTipo;
                    activeTipoAtualizacao = cAtu;
                    rawXml = probe.rawXml;
                    saiaExp = probe.saiaExp;
                    lastXml = rawXml;
                    foundMatch = true;
                    console.log(`[BlueFocus Customers] Tipo localizado com sucesso: Tipo=${activeTipo}, Atualizacao=${activeTipoAtualizacao} (${probePeople.length} itens no lote inicial)`);
                    break;
                  }
                } catch (_) {}
              }
              if (foundMatch) break;
            }
          }

          if (!saiaExp) {
            console.log("[Sync Customers] Resposta vazia ou estrutura desconhecida.");
            hasMore = false;
            break;
          }

          const msgErro = getVal(saiaExp, "MsgErro");
          if (msgErro && msgErro !== "" && msgErro !== "OK") {
            return res.status(400).json({ error: msgErro, debugXml: lastXml.substring(0, 2000) });
          }

          const peopleArray = extractPeopleArray(saiaExp);
          if (peopleArray.length > 0) {
            lastBatchPeople = peopleArray;
            console.log(`[Sync Customers] Iteração ${iterations}: Encontrados ${peopleArray.length} clientes no XML.`);

            for (const item of peopleArray) {
              const pId = getFirstVal(item, ["PessoaId", "ClienteId", "PessoaCodigo", "ClienteCodigo", "Codigo", "Id"]);
              if (!pId) continue;

              const currentId = parseInt(pId, 10);
              if (!isNaN(currentId)) {
                lastPessoaId = currentId;
              }

              const isSuspended =
                getVal(item, "PessoaSNSuspenso") === 'S' ||
                getVal(item, "PessoaSNBloqueado") === 'S' ||
                getVal(item, "PessoaSNInativo") === 'S' ||
                getVal(item, "PessoaSNAtivo") === 'N' ||
                getVal(item, "ClienteSNSuspenso") === 'S' ||
                getVal(item, "TipoAtualizacao") === 'E';

              if (isSuspended) {
                ignoredCount++;
                ignoredBreakdown.suspended++;
                continue;
              }

              const pName = getFirstVal(item, [
                "PessoaNome", "PessoaRazaoSocial", "PessoaNomeFantasia", "PessoaFantasia",
                "PessoaDescricao", "ClienteNome", "ClienteRazaoSocial", "Nome", "RazaoSocial", "NomeFantasia"
              ]);

              if (!pName) {
                ignoredCount++;
                ignoredBreakdown.withoutName++;
                continue;
              }

              const cpf = getFirstVal(item, [
                "PessoaCPF", "PessoaCNPJ", "PessoaCPFCNPJ", "PessoaCpfCnpj", "PessoaCnpjCpf",
                "PessoaDocumento", "PessoaInscricaoFederal", "ClienteCPF", "ClienteCNPJ",
                "CPF", "CNPJ", "CPFCNPJ", "CpfCnpj", "Documento"
              ]);

              // Extract phone from direct fields or nested TelefoneItem / PessoaTelefoneItem
              let phone = getFirstVal(item, [
                "PessoaCelular", "PessoaFoneCelular", "PessoaWhatsApp", "PessoaFone",
                "PessoaTelefone", "PessoaFone1", "PessoaTelefone1", "PessoaFone2", "PessoaTelefone2",
                "ClienteCelular", "ClienteTelefone", "ClienteFone", "Celular", "Telefone", "Fone"
              ]);
              const ddd = getFirstVal(item, ["PessoaDDD", "PessoaFoneDDD", "ClienteDDD", "DDD"]);

              if (!phone) {
                const telItems = getVal(item, "TelefoneItem") || getVal(item, "PessoaTelefoneItem") || getVal(item, "FoneItem");
                if (telItems) {
                  const telArr = Array.isArray(telItems) ? telItems : [telItems];
                  for (const tObj of telArr) {
                    const candidatePhone = getFirstVal(tObj, ["PessoaFone", "PessoaTelefone", "Telefone", "Fone", "Numero", "Celular"]);
                    const candidateDdd = getFirstVal(tObj, ["PessoaDDD", "PessoaFoneDDD", "DDD"]);
                    if (candidatePhone) {
                      phone = candidateDdd && !candidatePhone.startsWith(candidateDdd) ? `${candidateDdd}${candidatePhone}` : candidatePhone;
                      break;
                    }
                  }
                }
              } else if (ddd && !phone.replace(/\D/g, '').startsWith(ddd.replace(/\D/g, ''))) {
                phone = `(${ddd.replace(/\D/g, '')}) ${phone}`;
              }

              // Extract email from direct fields or nested EmailItem / PessoaEmailItem
              let email = getFirstVal(item, [
                "PessoaEmail", "PessoaEMail", "PessoaEmailNfe", "PessoaEmailComercial",
                "ClienteEmail", "Email", "EMail"
              ]).toLowerCase();
              if (!email) {
                const emailItems = getVal(item, "EmailItem") || getVal(item, "PessoaEmailItem");
                if (emailItems) {
                  const emailArr = Array.isArray(emailItems) ? emailItems : [emailItems];
                  email = getFirstVal(emailArr[0], ["PessoaEmail", "Email", "EMail", "EnderecoEmail"]).toLowerCase();
                }
              }

              // Extract address from direct fields or nested EnderecoItem / PessoaEnderecoItem
              const endItems = getVal(item, "EnderecoItem") || getVal(item, "PessoaEnderecoItem");
              const primaryEnd = endItems ? (Array.isArray(endItems) ? endItems[0] : endItems) : null;

              const street = getFirstVal(item, ["PessoaLogradouro", "PessoaEndereco", "ClienteEndereco", "Logradouro", "Endereco", "Rua"]) ||
                             getFirstVal(primaryEnd, ["PessoaLogradouro", "PessoaEndereco", "EnderecoLogradouro", "Logradouro", "Endereco", "Rua"]);
              const number = getFirstVal(item, ["PessoaNumero", "PessoaEndNumero", "PessoaEnderecoNumero", "ClienteNumero", "Numero"]) ||
                             getFirstVal(primaryEnd, ["PessoaNumero", "PessoaEndNumero", "PessoaEnderecoNumero", "EnderecoNumero", "Numero"]);
              const complement = getFirstVal(item, ["PessoaComplemento", "PessoaEndComplemento", "PessoaEnderecoComplemento", "Complemento"]) ||
                                 getFirstVal(primaryEnd, ["PessoaComplemento", "PessoaEndComplemento", "EnderecoComplemento", "Complemento"]);
              const neighborhood = getFirstVal(item, ["PessoaBairro", "PessoaEndBairro", "PessoaEnderecoBairro", "ClienteBairro", "Bairro"]) ||
                                   getFirstVal(primaryEnd, ["PessoaBairro", "PessoaEndBairro", "EnderecoBairro", "Bairro"]);
              const cep = getFirstVal(item, ["PessoaCEP", "PessoaCep", "PessoaEndCEP", "PessoaEnderecoCEP", "ClienteCEP", "CEP", "Cep"]) ||
                          getFirstVal(primaryEnd, ["PessoaCEP", "PessoaCep", "PessoaEndCEP", "EnderecoCEP", "CEP", "Cep"]);
              const city = getFirstVal(item, ["PessoaCidade", "PessoaMunicipio", "PessoaMunicipioDescricao", "ClienteCidade", "Cidade", "Municipio"]) ||
                           getFirstVal(primaryEnd, ["PessoaCidade", "PessoaMunicipio", "PessoaMunicipioDescricao", "EnderecoCidade", "Cidade", "Municipio"]);
              const uf = getFirstVal(item, ["PessoaUF", "PessoaEstado", "ClienteUF", "UF"]) ||
                         getFirstVal(primaryEnd, ["PessoaUF", "PessoaEstado", "EnderecoUF", "UF"]);

              const obs = getFirstVal(item, ["PessoaObservacao", "PessoaObs", "ClienteObservacao", "Observacao", "Obs"]);

              const addressParts: string[] = [];
              if (street) addressParts.push(`${street}${number ? `, ${number}` : ''}`);
              if (complement) addressParts.push(`(${complement})`);
              if (neighborhood) addressParts.push(`- ${neighborhood}`);
              if (city) addressParts.push(`- ${city}${uf ? `/${uf}` : ''}`);
              if (cep) addressParts.push(`- CEP: ${cep}`);
              const fullAddress = addressParts.join(' ').replace(/\s+/g, ' ').trim();

              const notesParts: string[] = [`Código ERP: ${pId}`];
              if (cpf) notesParts.push(`CPF/CNPJ: ${cpf}`);
              if (obs) notesParts.push(obs);

              allMappedCustomers.push({
                externalId: pId,
                name: pName,
                phone: phone || '',
                email: email || '',
                cpf: cpf || '',
                street: street || '',
                number: number || '',
                complement: complement || '',
                neighborhood: neighborhood || '',
                cep: cep || '',
                address: fullAddress,
                notes: notesParts.join(' | '),
                source: 'bluefocus_erp',
                status: 'approved',
                tags: ['Cliente', 'BlueFocus ERP']
              });
            }
          }

          snFim = getVal(saiaExp, "SNFim") || (activeTipo === '1' ? 'S' : 'N');

          if (snFim === 'S') {
            hasMore = false;
          } else {
            const rootNextNumero = getVal(saiaExp, "CargaPDVNumero");
            const rootNextSequencia = getVal(saiaExp, "CargaPDVSequencia");

            if (rootNextNumero !== undefined && rootNextSequencia !== undefined) {
              const nNum = parseInt(String(rootNextNumero), 10);
              const nSeq = parseInt(String(rootNextSequencia), 10);
              if (nNum === currentCargaNumero && nSeq === currentCargaSequencia) {
                currentCargaSequencia++;
              } else {
                currentCargaNumero = nNum;
                currentCargaSequencia = nSeq;
              }
            } else if (peopleArray.length > 0) {
              const lastPerson = peopleArray[peopleArray.length - 1];
              const pNextNumero = parseInt(String(getVal(lastPerson, "CargaPDVNumero") || currentCargaNumero), 10);
              const pNextSequencia = parseInt(String(getVal(lastPerson, "CargaPDVSequencia") || currentCargaSequencia), 10);

              if (pNextNumero === currentCargaNumero && pNextSequencia === currentCargaSequencia) {
                currentCargaSequencia++;
              } else {
                currentCargaNumero = pNextNumero;
                currentCargaSequencia = pNextSequencia;
              }
            } else {
              currentCargaSequencia++;
              if (iterations > 8) {
                hasMore = false;
              }
            }
          }
        } catch (error: any) {
          console.error("[Sync Customers] Batch Error:", error.message);
          const { message: friendlyMsg, details: det } = formatBlueFocusError(error);
          return res.status(500).json({
            error: friendlyMsg,
            details: det,
            debugXml: error.response?.data ? String(error.response.data).substring(0, 2000) : undefined
          });
        }
      }

      const lastRawPerson = lastBatchPeople.length > 0 ? lastBatchPeople[lastBatchPeople.length - 1] : null;
      const lastProcessedName = lastRawPerson
        ? getFirstVal(lastRawPerson, ["PessoaNome", "PessoaRazaoSocial", "PessoaNomeFantasia", "ClienteNome", "Nome"]) || "Cliente ERP"
        : null;

      res.json({
        customers: allMappedCustomers,
        nextCargaNumero: currentCargaNumero,
        nextCargaSequencia: currentCargaSequencia,
        nextPessoaId: lastPessoaId,
        detectedTipo: activeTipo,
        snFim: snFim,
        iterations: iterations,
        ignoredCount: ignoredCount,
        ignoredBreakdown: ignoredBreakdown,
        lastProcessedName,
        lastCustomerName: allMappedCustomers.length > 0 ? allMappedCustomers[allMappedCustomers.length - 1].name : null,
        lastCustomerId: allMappedCustomers.length > 0 ? allMappedCustomers[allMappedCustomers.length - 1].externalId : (lastPessoaId ? String(lastPessoaId) : null),
        debugXml: lastXml.substring(0, 5000)
      });
    } catch (error: any) {
      console.error("BlueFocus Customer Sync Error!", error?.message || error);
      const { message: friendlyMessage, details: errorDetail } = formatBlueFocusError(error);
      res.status(500).json({
        error: friendlyMessage,
        details: errorDetail
      });
    }
  });

  // API Route for BlueFocus Order Export (Pre-Sale)
  app.post("/api/bluefocus/export-order", async (req, res) => {
    console.log(`[Order] Recebida exportação de pedido: ${req.url}`);
    try {
      const { 
        order,
        empresaId: reqEmpresaId,
        usuarioId: reqUsuarioId,
        pdvCodigo: reqPdvCodigo,
        orderUrl: reqOrderUrl,
        authToken
      } = req.body;
      
      const authKey = process.env.BLUE_FOCUS_AUTH_KEY || process.env.BLUEFOCUS_AUTH_KEY || process.env.BLUEFOCUS_AUTH_TOKEN;
      const empresaId = reqEmpresaId || process.env.BLUEFOCUS_EMPRESA_ID || process.env.BLUEFOCUS_EMPRESA || 'DONAMARA';
      const usuarioId = reqUsuarioId || process.env.BLUEFOCUS_USUARIO_ID || process.env.BLUEFOCUS_USUARIO || 'CONSULTA';
      const pdvCodigo = reqPdvCodigo || process.env.BLUEFOCUS_PDV_CODIGO || '1000';

      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const dateTimeStr = now.toISOString().replace(/\.\d{3}Z$/, 'Z');

      // Map items to BlueFocus XML format
      const itemsXml = order.items.map((item: any, index: number) => `
        <ProdutoItem>
          <SaidaItemSeq>${index + 1}</SaidaItemSeq>
          <SaidaItemLoteProdutoId>${item.externalId || item.productId}</SaidaItemLoteProdutoId>
          <SaidaItemUnidadeId>UN</SaidaItemUnidadeId>
          <SaidaItemCodigoBarras>${item.externalId || item.productId}</SaidaItemCodigoBarras>
          <SaidaItemQuantidade>${item.quantity}</SaidaItemQuantidade>
          <SaidaItemValorUnitario>${item.price}</SaidaItemValorUnitario>
          <SaidaItemCancelado>N</SaidaItemCancelado>
          <SaidaItemTotalizador>T1</SaidaItemTotalizador>
          <SaidaItemTipoTributacao>T</SaidaItemTipoTributacao>
        </ProdutoItem>`).join('');

      const resolvedClienteId = order.customerExternalId ||
        (order.customerId && String(order.customerId).startsWith('bf_cust_') ? String(order.customerId).replace('bf_cust_', '') : null) ||
        '100';

      const soapEnvelope = `<?xml version="1.0"?>
<SOAP-ENV:Envelope 
xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" 
xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<SOAP-ENV:Body>
<IntegracaoFcxRegistraVenda.Execute xmlns="Valim">
<Sdtwebserviceentradavenda>
<Venda>
<TipoVenda>P</TipoVenda>
<EmpresaId>${empresaId}</EmpresaId>
<UsuarioId>${usuarioId}</UsuarioId>
<PDVCodigo>${pdvCodigo}</PDVCodigo>
<SaidaSNCancela>N</SaidaSNCancela>
<SaidaDataEmissao>${dateStr}</SaidaDataEmissao>
<SaidaClienteId>${resolvedClienteId}</SaidaClienteId>
<SaidaDataHoraInclusao>${dateTimeStr}</SaidaDataHoraInclusao>
<SaidaUsuarioInclusao>${usuarioId}</SaidaUsuarioInclusao>
<SaidaNumeroVendaFCX>${order.id.replace(/\D/g, '').substring(0, 9) || Math.floor(Math.random() * 100000)}</SaidaNumeroVendaFCX>
${itemsXml}
<ParcelaItem>
<SaidaPagtoParcelaSequencia>1</SaidaPagtoParcelaSequencia>
<SaidaPagtoParcelaFormaId>1</SaidaPagtoParcelaFormaId>
<SaidaPagtoParcelaValor>${order.total}</SaidaPagtoParcelaValor>
<SaidaPagtoParcelaVencimento>${dateStr}</SaidaPagtoParcelaVencimento>
</ParcelaItem>
</Venda>
</Sdtwebserviceentradavenda>
</IntegracaoFcxRegistraVenda.Execute>
</SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;

      const isValidToken = (t?: string) => {
        if (!t) return false;
        const clean = String(t).trim();
        return clean.length > 5 && !clean.includes('XXXX') && clean !== 'AGUARDANDO_CHAVE';
      };

      const headers: any = {
        "Content-Type": "text/xml; charset=utf-8"
      };
      
      if (isValidToken(authToken)) {
        headers["autentica"] = authToken.trim();
      } else if (isValidToken(authKey)) {
        headers["autentica"] = authKey.trim();
      }

      const response = await axios.post(
        reqOrderUrl || process.env.BLUEFOCUS_ORDER_URL || "",
        soapEnvelope,
        { headers }
      );

      const parser = new XMLParser();
      const jsonObj = parser.parse(response.data);
      
      const body = jsonObj["SOAP-ENV:Envelope"]?.["SOAP-ENV:Body"];
      const executeResponse = body?.["IntegracaoFcxRegistraVenda.ExecuteResponse"] || body?.["IntegracaoFcxRegPreVendaSat.ExecuteResponse"];
      const saiaVenda = executeResponse?.["Sdtwebservicesaidavenda"];
      const msgErro = saiaVenda?.["MsgErro"];

      if (msgErro) {
        return res.status(400).json({ error: msgErro });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("BlueFocus Export Error!");
      if (error.response) {
        console.error("Status:", error.response.status);
        console.error("Data:", error.response.data);
      } else if (error.request) {
        console.error("No response received from BlueFocus.");
      } else {
        console.error("Error setting up request:", error.message);
      }
      
      const errorDetail = error.response?.data || error.message;
      console.error("BlueFocus Export Error Details:", errorDetail);
      res.status(500).json({ 
        error: "Erro ao exportar venda para BlueFocus",
        details: errorDetail
      });
    }
  });

  // API Route to proxy NTFY push notifications reliably from backend (no CORS, no adblock issues)
  app.post("/api/ntfy/send", async (req, res) => {
    try {
      const { topic, title, message, priority, tags, clickUrl } = req.body || {};
      const cleanTopic = (topic || "donamara_pedidos").trim().replace(/[^a-zA-Z0-9_-]/g, "") || "donamara_pedidos";
      
      if (!message) {
        return res.status(400).json({ error: "Mensagem é obrigatória" });
      }

      const payload: Record<string, any> = {
        topic: cleanTopic,
        message: String(message),
        priority: Number(priority) || 4,
      };

      if (title) payload.title = String(title);
      if (Array.isArray(tags) && tags.length > 0) payload.tags = tags;
      if (clickUrl) payload.click = String(clickUrl);

      const ntfyRes = await axios.post("https://ntfy.sh", payload, {
        headers: {
          "Content-Type": "application/json; charset=utf-8"
        },
        timeout: 10000
      });

      console.log(`[NTFY] Notificação enviada com sucesso para tópico "${cleanTopic}" (HTTP ${ntfyRes.status})`);
      res.json({ success: true, status: ntfyRes.status });
    } catch (err: any) {
      console.warn("[NTFY Proxy Erro]:", err?.response?.data || err?.message || err);
      // Return 200 with success: false to never crash calling app flows
      res.json({ success: false, error: err?.message || "Failed to send notification" });
    }
  });

  app.use("/api/*", (req, res) => {
    console.log(`[404] Rota API não encontrada: ${req.method} ${req.url}`);
    res.status(404).json({ 
      error: "Rota da API não encontrada no servidor Express.",
      path: req.originalUrl,
      method: req.method
    });
  });

  // Start server and initialize services
  async function startServer() {
    // Vite middleware for development or Static Serving for production
    if (process.env.NODE_ENV !== "production") {
      console.log("[Dev] Configurando middleware do Vite...");
      try {
        const { createServer: createViteServer } = await import("vite");
        const vite = await createViteServer({
          server: { 
            middlewareMode: true,
            allowedHosts: true,
          },
          appType: "spa",
        });
        app.use(vite.middlewares);
        console.log("[Dev] Vite middleware configurado.");
      } catch (viteErr) {
        console.error("[Dev] Erro ao iniciar Vite:", viteErr);
      }
    } else {
      const distPath = path.resolve(process.cwd(), "dist");
      console.log(`[Prod] Servindo arquivos estáticos de: ${distPath}`);
      
      app.get('/manifest.json', (req, res) => {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
        res.setHeader('Content-Type', 'application/manifest+json');
        res.sendFile(path.join(distPath, 'manifest.json'));
      });

      app.get('/manifest-totem.json', (req, res) => {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
        res.setHeader('Content-Type', 'application/manifest+json');
        res.sendFile(path.join(distPath, 'manifest-totem.json'));
      });

      // Serve static files with long-term caching for assets
      app.use(express.static(distPath, {
        index: false,
        maxAge: '1d'
      }));

      // SPA Fallback: All routes not caught by API or static files go to index.html
      app.get("*", (req, res) => {
        const indexPath = path.join(distPath, "index.html");
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Surrogate-Control', 'no-store');
        res.setHeader('CDN-Cache-Control', 'no-store');

        const reqPath = (req.path || '').toLowerCase();
        const isTotemReq = reqPath.startsWith('/totem') || reqPath.startsWith('/kiosk');
        const isTvReq = reqPath.startsWith('/tv');

        // Se for acesso ao totem ou TV, envia o HTML com a tag de manifesto específica
        if (isTotemReq || isTvReq) {
          const fs = require('fs');
          fs.readFile(indexPath, 'utf8', (err: any, htmlContent: string) => {
            if (err) {
              console.error(`[Prod] Erro ao ler index.html de ${indexPath}:`, err);
              return res.sendFile(indexPath);
            }
            const targetManifest = isTvReq ? '/manifest-tv.json' : '/manifest-totem.json';
            const targetTitle = isTvReq ? 'Smart TV & Painel de Mídia | DONAMARA' : 'Totem Autoatendimento | DONAMARA';
            const modifiedHtml = htmlContent
              .replace(/href="\/manifest\.json"/g, `href="${targetManifest}"`)
              .replace(/<title>.*?<\/title>/gi, `<title>${targetTitle}</title>`);
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.send(modifiedHtml);
          });
          return;
        }

        res.sendFile(indexPath, (err) => {
          if (err) {
            console.error(`[Prod] Erro ao enviar index.html de ${indexPath}:`, err);
            res.status(500).send("Erro ao carregar o aplicativo. Verifique se o build (dist/) foi concluído.");
          }
        });
      });
    }

    // Inicia a porta HTTP imediatamente para passar no health check do Google Cloud Run,
    // enquanto o middleware waitForHydration em /api/db garante que nenhuma rota de dados responda antes do Supabase hidratar.
    const server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
    });
    server.keepAliveTimeout = 120000;
    server.headersTimeout = 120000;

    (async () => {
      try {
        console.log("[DB] Inicializando tabelas e hidratando dados do PostgreSQL / Supabase...");
        await ensureTablesExist();
        await hydrateFromPostgres();
        console.log("[DB] Estado da loja, catálogo e cadastros hidratados com sucesso do PostgreSQL / Supabase.");
      } catch (dbInitErr) {
        console.error("[DB] Aviso na inicialização do banco de dados:", dbInitErr);
      }
    })();
  }

  startServer().catch(err => {
    console.error("Erro fatal ao iniciar o servidor:", err);
  });

export default app;
