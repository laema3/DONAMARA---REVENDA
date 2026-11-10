import { Express, Request, Response } from 'express';
import { buildOrderEscPosBuffer } from './printerRoutes';

export interface AgentPrintJob {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  total: number;
  type: string;
  escPosBase64: string;
  targetIp: string;
  targetPort: number;
  createdAt: number;
  status: 'pending' | 'printed' | 'failed';
  attempts: number;
  error?: string;
  printedAt?: number;
}

// Fila em memória dos pedidos pendentes para o Agente Windows
let pendingJobs: AgentPrintJob[] = [];
let printedJobsHistory: AgentPrintJob[] = [];
let totalPrintedByAgent = 0;

// Estado do Agente Windows conectado
let agentStatus: {
  isOnline: boolean;
  lastSeen: number;
  hostname: string;
  ip: string;
  version: string;
  targetPrinter: string;
} = {
  isOnline: false,
  lastSeen: 0,
  hostname: '',
  ip: '',
  version: '1.0.0',
  targetPrinter: '192.168.0.90:9100'
};

/**
 * Enfileira um pedido para impressão automática pelo Agente Windows do Caixa.
 */
export function queueOrderForAgent(order: any, storeInfo: any): AgentPrintJob | null {
  if (!order || !order.id) return null;

  // Pedidos do Totem (kiosk) agora também são enfileirados para o Agente Windows do Caixa imprimir automaticamente na impressora de rede!

  // Verifica se já está na fila
  const existing = pendingJobs.find(j => j.orderId === order.id);
  if (existing && existing.status === 'pending') {
    return existing;
  }

  const rawIp = (storeInfo?.networkPrinterIp || '').trim();
  const targetIp = (rawIp === '192.168.1.200' || !rawIp) ? '192.168.0.90' : rawIp;
  const targetPort = Number(storeInfo?.networkPrinterPort) || 9100;

  try {
    const escPosBuffer = buildOrderEscPosBuffer(order, storeInfo);
    const escPosBase64 = escPosBuffer.toString('base64');
    const orderNumber = order?.id ? String(order.id).slice(-4).padStart(4, '0') : '0001';

    const job: AgentPrintJob = {
      id: `job_${Date.now()}_${order.id}`,
      orderId: String(order.id),
      orderNumber,
      customerName: String(order.customerName || 'Cliente').trim(),
      total: Number(order.total) || 0,
      type: String(order.type || 'smartphone'),
      escPosBase64,
      targetIp,
      targetPort,
      createdAt: Date.now(),
      status: 'pending',
      attempts: 0
    };

    pendingJobs.push(job);
    console.log(`[Printer Agent] Pedido #${order.id} enfileirado para o Agente Windows (Total na fila: ${pendingJobs.length})`);
    return job;
  } catch (err: any) {
    console.error(`[Printer Agent] Erro ao gerar buffer para pedido #${order?.id}:`, err);
    return null;
  }
}

/**
 * Cria um pedido fictício de teste para envio ao Agente Windows
 */
export function queueTestJobForAgent(storeInfo: any): AgentPrintJob {
  const sampleOrder = {
    id: `TEST-${Date.now().toString().slice(-4)}`,
    customerName: 'TESTE AGENTE WINDOWS (SMARTPHONE)',
    customerPhone: '(11) 99999-9999',
    type: 'smartphone',
    paymentMethod: 'PIX (Celular)',
    total: 32.50,
    createdAt: Date.now(),
    items: [
      { name: 'Pao Frances Quentinho (KG)', price: 12.50, quantity: 1, itemCode: '001' },
      { name: 'Cafe com Leite Grande', price: 8.00, quantity: 1, itemCode: '042' },
      { name: 'Misto Quente na Chapa', price: 12.00, quantity: 1, itemCode: '105' }
    ]
  };

  const rawIp = (storeInfo?.networkPrinterIp || '').trim();
  const targetIp = (rawIp === '192.168.1.200' || !rawIp) ? '192.168.0.90' : rawIp;
  const targetPort = Number(storeInfo?.networkPrinterPort) || 9100;
  const escPosBuffer = buildOrderEscPosBuffer(sampleOrder, storeInfo);

  const job: AgentPrintJob = {
    id: `test_${Date.now()}`,
    orderId: sampleOrder.id,
    orderNumber: sampleOrder.id.replace('TEST-', ''),
    customerName: sampleOrder.customerName,
    total: sampleOrder.total,
    type: 'smartphone_test',
    escPosBase64: escPosBuffer.toString('base64'),
    targetIp,
    targetPort,
    createdAt: Date.now(),
    status: 'pending',
    attempts: 0
  };

  pendingJobs.push(job);
  console.log(`[Printer Agent] Cupom de TESTE enfileirado para o Agente Windows (ID: ${job.id})`);
  return job;
}

export function setupPrinterAgentRoutes(app: Express, getStoreInfo: () => any) {
  // 1. Heartbeat do Agente Windows (enviado a cada 5-10s)
  app.post('/api/printer-agent/heartbeat', (req: Request, res: Response) => {
    const { hostname, ip, version, printerIp } = req.body || {};
    agentStatus = {
      isOnline: true,
      lastSeen: Date.now(),
      hostname: String(hostname || agentStatus.hostname || 'Windows-Caixa'),
      ip: String(ip || req.ip || ''),
      version: String(version || '1.0.0'),
      targetPrinter: String(printerIp || agentStatus.targetPrinter || '192.168.0.90:9100')
    };

    res.json({
      success: true,
      pendingJobsCount: pendingJobs.filter(j => j.status === 'pending').length,
      serverTime: Date.now()
    });
  });

  // 2. Status atual do Agente (usado pelo painel Admin da loja)
  app.get('/api/printer-agent/status', (req: Request, res: Response) => {
    const now = Date.now();
    const isOnline = agentStatus.lastSeen > 0 && (now - agentStatus.lastSeen) < 25000;
    const storeInfo = getStoreInfo?.() || {};
    const configuredIp = storeInfo?.networkPrinterIp || '192.168.0.90';
    const configuredPort = storeInfo?.networkPrinterPort || 9100;

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json({
      isOnline,
      lastSeen: agentStatus.lastSeen,
      secondsAgo: agentStatus.lastSeen > 0 ? Math.round((now - agentStatus.lastSeen) / 1000) : null,
      hostname: agentStatus.hostname || 'Não conectado',
      version: agentStatus.version,
      pendingCount: pendingJobs.filter(j => j.status === 'pending').length,
      totalPrinted: totalPrintedByAgent,
      configuredPrinter: `${configuredIp}:${configuredPort}`,
      recentJobs: printedJobsHistory.slice(-5)
    });
  });

  // 3. Fila de Pedidos Pendentes para o Agente Buscar (Poll a cada 2-3s)
  app.get('/api/printer-agent/jobs', (req: Request, res: Response) => {
    // Atualiza heartbeat passivo ao buscar jobs
    agentStatus.isOnline = true;
    agentStatus.lastSeen = Date.now();

    const jobsToReturn = pendingJobs.filter(j => j.status === 'pending');

    // Marca como tentativas incrementadas
    jobsToReturn.forEach(j => {
      j.attempts += 1;
    });

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json({
      success: true,
      count: jobsToReturn.length,
      jobs: jobsToReturn
    });
  });

  // 4. Confirmação de Impressão (ACK) enviada pelo Agente após imprimir com sucesso
  app.post('/api/printer-agent/ack', (req: Request, res: Response) => {
    const { jobId, orderId, success, error } = req.body || {};

    const jobIndex = pendingJobs.findIndex(j => (jobId && j.id === jobId) || (orderId && j.orderId === orderId));

    if (jobIndex >= 0) {
      const job = pendingJobs[jobIndex];
      if (success) {
        job.status = 'printed';
        job.printedAt = Date.now();
        totalPrintedByAgent += 1;
        printedJobsHistory.push(job);
        // Limita histórico a 50 itens
        if (printedJobsHistory.length > 50) {
          printedJobsHistory.shift();
        }
        // Remove da fila pendente
        pendingJobs.splice(jobIndex, 1);
        console.log(`[Printer Agent ACK] Pedido #${job.orderId} impresso com sucesso pelo Agente Windows!`);
      } else {
        job.status = 'failed';
        job.error = String(error || 'Erro desconhecido');
        console.warn(`[Printer Agent ACK] Falha ao imprimir pedido #${job.orderId}: ${error}`);
      }
      return res.json({ success: true, message: 'Status do job atualizado' });
    }

    res.json({ success: true, message: 'Job não encontrado ou já processado' });
  });

  // 5. Disparar teste manual direto para o Agente Windows
  app.post('/api/printer-agent/test-job', (req: Request, res: Response) => {
    const storeInfo = getStoreInfo?.() || {};
    const job = queueTestJobForAgent(storeInfo);
    res.json({
      success: true,
      message: 'Cupom de teste enfileirado para o Agente Windows!',
      jobId: job.id
    });
  });

  // 6. Download do Arquivo Executável / Script em Lote (.BAT) para o Windows
  // Este arquivo .bat roda nativamente no Windows 10/11 com apenas 2 cliques!
  app.get('/api/printer-agent/download/bat', (req: Request, res: Response) => {
    const host = req.get('x-forwarded-host') || req.get('host') || 'localhost:3000';
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const baseUrl = `${protocol}://${host}`;
    const storeInfo = getStoreInfo?.() || {};
    const printerIp = (storeInfo?.networkPrinterIp || '192.168.0.90').trim();
    const printerPort = Number(storeInfo?.networkPrinterPort) || 9100;

    const batScript = `@echo off
chcp 65001 >nul
title DONAMARA - Agente de Impressao Windows (Auto-Recuperavel)
cls
color 0E

echo ==============================================================================
echo                 DONAMARA - AGENTE DE IMPRESSAO WINDOWS
echo ==============================================================================
echo.
echo  Servidor em Nuvem : ${baseUrl}
echo  Impressora Alvo   : ${printerIp}:${printerPort}
echo.
echo  [+] Este agente fica em segundo plano no computador do Caixa.
echo  [+] Sempre que um cliente pedir pelo celular, ele imprime NA HORA!
echo  [+] Com auto-recuperacao: Se a conexao cair, ele REINICIA SOZINHO!
echo.
echo ==============================================================================
echo.

:AGENT_LOOP
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$serverUrl = '${baseUrl}'; $targetIp = '${printerIp}'; $targetPort = ${printerPort};" ^
  "$ErrorActionPreference = 'Continue';" ^
  "Write-Host '[Iniciando] Conectando ao servidor em nuvem...' -ForegroundColor Green;" ^
  "function Send-RawEscPos { param($ip, $port, $bytes); try { $client = New-Object System.Net.Sockets.TcpClient; $client.SendTimeout = 4000; $client.Connect($ip, $port); $stream = $client.GetStream(); $stream.Write($bytes, 0, $bytes.Length); $stream.Flush(); $stream.Close(); $client.Close(); return $true } catch { Write-Host ('[ERRO IMPRESSORA ' + $ip + ':' + $port + '] ' + $_.Exception.Message) -ForegroundColor Red; return $false } };" ^
  "Write-Host '[Conectado!] Monitorando pedidos do smartphone em segundo plano...' -ForegroundColor Cyan;" ^
  "$printedJobs = @{};" ^
  "$errCount = 0;" ^
  "$loopStartTime = Get-Date;" ^
  "while ($true) {" ^
  "  if (((Get-Date) - $loopStartTime).TotalMinutes -ge 5) {" ^
  "    Write-Host ('[' + (Get-Date -Format 'HH:mm:ss') + '] [REINICIO PROGRAMADO DE 5 MINUTOS PARA LIMPEZA DE SOCKETS E CONEXAO...]') -ForegroundColor Magenta;" ^
  "    exit 1;" ^
  "  }" ^
  "  try {" ^
  "    $hbUrl = $serverUrl + '/api/printer-agent/heartbeat';" ^
  "    $hbBody = @{ hostname = $env:COMPUTERNAME; version = '1.3.0'; printerIp = ($targetIp + ':' + $targetPort) } | ConvertTo-Json;" ^
  "    Invoke-RestMethod -Uri $hbUrl -Method Post -Body $hbBody -ContentType 'application/json' -TimeoutSec 4 -ErrorAction SilentlyContinue | Out-Null;" ^
  "    $jobsUrl = $serverUrl + '/api/printer-agent/jobs';" ^
  "    $response = Invoke-RestMethod -Uri $jobsUrl -Method Get -TimeoutSec 5 -ErrorAction Stop;" ^
  "    if ($response.success) {" ^
  "      $errCount = 0;" ^
  "      $jobs = @($response.jobs);" ^
  "      if ($jobs -and $jobs.Count -gt 0) {" ^
  "        foreach ($job in $jobs) {" ^
  "          if ($job -and $job.id -and -not $printedJobs.ContainsKey($job.id)) {" ^
  "            Write-Host ('[' + (Get-Date -Format 'HH:mm:ss') + '] NOVO PEDIDO #' + $job.orderNumber + ' (' + $job.customerName + ') Total: R$ ' + $job.total) -ForegroundColor Yellow;" ^
  "            $destIp = if ($job.targetIp) { $job.targetIp } else { $targetIp };" ^
  "            $destPort = if ($job.targetPort) { [int]$job.targetPort } else { $targetPort };" ^
  "            $bytes = [System.Convert]::FromBase64String($job.escPosBase64);" ^
  "            Write-Host ('    Enviando para impressora ' + $destIp + ':' + $destPort + '...') -ForegroundColor Gray;" ^
  "            $printSuccess = Send-RawEscPos -ip $destIp -port $destPort -bytes $bytes;" ^
  "            $ackUrl = $serverUrl + '/api/printer-agent/ack';" ^
  "            $ackBody = @{ jobId = $job.id; orderId = $job.orderId; success = $printSuccess } | ConvertTo-Json;" ^
  "            Invoke-RestMethod -Uri $ackUrl -Method Post -Body $ackBody -ContentType 'application/json' -TimeoutSec 4 -ErrorAction SilentlyContinue | Out-Null;" ^
  "            if ($printSuccess) {" ^
  "              $printedJobs[$job.id] = $true;" ^
  "              Write-Host ('    [OK SUCESSO] Pedido #' + $job.orderNumber + ' impresso com corte!') -ForegroundColor Green;" ^
  "            } else {" ^
  "              Write-Host ('    [FALHA] Nao foi possivel comunicar com ' + $destIp + ':' + $destPort) -ForegroundColor Red;" ^
  "            }" ^
  "          }" ^
  "        }" ^
  "      }" ^
  "    }" ^
  "  } catch {" ^
  "    $errCount++;" ^
  "    Write-Host ('[' + (Get-Date -Format 'HH:mm:ss') + '] Conexao instavel... Reagendando (' + $errCount + '/8)') -ForegroundColor DarkYellow;" ^
  "    if ($errCount -ge 8) {" ^
  "      Write-Host ('[' + (Get-Date -Format 'HH:mm:ss') + '] [REINICIANDO AGENTE AUTOMATICAMENTE PARA RESTAURAR SERVICO...]') -ForegroundColor Red;" ^
  "      exit 1;" ^
  "    }" ^
  "  };" ^
  "  Start-Sleep -Seconds 2;" ^
  "}"

echo.
echo [AUTO-RECOVERY] Reiniciando conexao do Agente DONAMARA em 3 segundos...
timeout /t 3 /nobreak >nul
goto AGENT_LOOP
`;

    res.setHeader('Content-Type', 'application/x-bat');
    res.setHeader('Content-Disposition', 'attachment; filename="Iniciar-Agente-DonaMara.bat"');
    res.send(batScript);
  });
}
