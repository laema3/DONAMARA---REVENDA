import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useStore, TvMediaItem, Product } from '../store/useStore';
import { shouldExcludeProduct, isExcludedCategory } from '../constants';
import { 
  Maximize, 
  Minimize, 
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  Volume2, 
  VolumeX, 
  Clock, 
  Sparkles, 
  ShoppingBag, 
  Radio, 
  Layers, 
  ChevronRight,
  Flame,
  Coffee,
  CheckCircle2,
  BellRing,
  Megaphone,
  ChefHat,
  Youtube,
  Film,
  X
} from 'lucide-react';

// Extract YouTube Video ID from any YouTube URL format (including Shorts, Live, Embed, youtu.be, etc.)
export function extractYouTubeId(url: string | undefined | null): string | null {
  if (!url) return null;
  let str = String(url).trim();

  // If it's a data URI (base64 uploaded video/image) or blob URL, it is NEVER a YouTube video
  if (str.startsWith('data:') || str.startsWith('blob:') || str.startsWith('file:')) {
    return null;
  }

  // If it has a direct video or image file extension, it is NOT YouTube
  if (/\.(mp4|webm|mov|m4v|ogg|avi|mkv|jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i.test(str)) {
    return null;
  }

  // Very long strings (> 500 chars) are data/blobs, never YouTube URLs
  if (str.length > 500) {
    return null;
  }

  // If iframe html snippet was pasted
  const iframeMatch = str.match(/src=["'](.*?)["']/i);
  if (iframeMatch && iframeMatch[1]) {
    str = iframeMatch[1].trim();
  }

  // If directly an 11-char ID without slashes or query parameters (only if alphanumeric with _ or -)
  if (/^[a-zA-Z0-9_-]{11}$/.test(str) && !str.includes('/') && !str.includes('.')) {
    return str;
  }

  try {
    const fullUrl = str.startsWith('http://') || str.startsWith('https://') ? str : `https://${str}`;
    const parsed = new URL(fullUrl);
    
    // youtu.be/ID
    if (parsed.hostname.includes('youtu.be')) {
      const id = parsed.pathname.replace(/^\/+/, '').split('/')[0].split('?')[0];
      if (id && id.length === 11) return id;
    }
    
    // youtube.com / m.youtube.com / youtube-nocookie.com
    if (parsed.hostname.includes('youtube.com') || parsed.hostname.includes('youtube-nocookie.com')) {
      const v = parsed.searchParams.get('v');
      if (v && v.length === 11) return v;

      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts.length >= 2 && ['shorts', 'embed', 'live', 'v'].includes(parts[0])) {
        if (parts[1] && parts[1].length === 11) return parts[1];
      }
    }
  } catch {
    // fallback to regex matching on youtube domains only
  }

  // Strictly only match if the URL explicitly mentions youtube or youtu.be
  if (!str.toLowerCase().includes('youtube') && !str.toLowerCase().includes('youtu.be')) {
    return null;
  }

  // 1. Check for query parameter v=
  const vMatch = str.match(/[?&]v=([a-zA-Z0-9_-]{11})(?:[&?]|$)/);
  if (vMatch && vMatch[1]) {
    return vMatch[1];
  }

  // 2. Check for youtu.be/ID
  const youtuMatch = str.match(/youtu\.be\/([a-zA-Z0-9_-]{11})(?:[?&/]|$)/);
  if (youtuMatch && youtuMatch[1]) {
    return youtuMatch[1];
  }

  // 3. Check for /shorts/ID, /embed/ID, /v/ID, /live/ID
  const pathMatch = str.match(/\/(?:shorts|embed|v|live)\/([a-zA-Z0-9_-]{11})(?:[?&/]|$)/);
  if (pathMatch && pathMatch[1]) {
    return pathMatch[1];
  }

  // 4. Any youtube URL with 11 char ID in path or query
  const generalMatch = str.match(/(?:youtube(?:-nocookie)?\.com|youtu\.be)\/(?:watch\?.*v=|(?:embed|v|shorts|live)\/|)([\w-]{11})/);
  if (generalMatch && generalMatch[1] && generalMatch[1].length === 11) {
    return generalMatch[1];
  }

  return null;
}

// Synthesize pleasant restaurant chime tone (Ding-Dong) using Web Audio API
function playChimeSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const now = ctx.currentTime;

    // Ding (880Hz -> A5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    osc1.frequency.exponentialRampToValueAtTime(440, now + 0.8);
    gain1.gain.setValueAtTime(0.4, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.8);

    // Dong (587.33Hz -> D5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(587.33, now + 0.35);
    osc2.frequency.exponentialRampToValueAtTime(293.66, now + 1.6);
    gain2.gain.setValueAtTime(0.45, now + 0.35);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.6);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.35);
    osc2.stop(now + 1.6);
  } catch (e) {
    console.warn('[TV Audio] Chime error:', e);
  }
}

// Speak Portuguese announcement
function speakOrderCall(orderNumber: string, customerName: string) {
  try {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const text = `Atenção: Senha número ${orderNumber}, ${customerName || 'cliente'}, favor retirar o pedido no balcão!`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 0.95;
    utterance.pitch = 1.05;
    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.warn('[TV Speech] Error:', e);
  }
}

export interface TvCallItem {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  type?: string;
  tableOrDesk?: string;
  calledAt: number;
}

export default function TvDisplay() {
  const { tvMediaList, storeInfo, categories, products, orders, fetchData } = useStore();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isMuted, setIsMuted] = useState(storeInfo.tvSoundEnabled === false);
  const [playbackProgress, setPlaybackProgress] = useState(0);

  const searchParams = new URLSearchParams(window.location.search);
  const urlModeParam = searchParams.get('mode') as any;
  const mode = urlModeParam || storeInfo.tvMode || 'split_menu';

  // Active TV Call state for popup overlay
  const [activeCall, setActiveCall] = useState<TvCallItem | null>(null);
  const lastProcessedCallId = useRef<string>('');
  const callDismissTimer = useRef<any>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mediaViewportRef = useRef<HTMLDivElement | null>(null);
  const [viewportDimensions, setViewportDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [fillFeedbackMsg, setFillFeedbackMsg] = useState<string | null>(null);
  const fillFeedbackTimer = useRef<any>(null);

  // Fill Mode: 'cover' (100% preenchimento da tela) | 'smart_zoom' (zoom 135% para eliminar bordas de vídeos gravados com margem) | 'fit' (proporção original com fundo ambiente)
  const [mediaFillMode, setMediaFillMode] = useState<'cover' | 'smart_zoom' | 'fit'>(() => {
    try {
      const saved = localStorage.getItem('donamara_tv_fill_mode');
      if (saved === 'cover' || saved === 'smart_zoom' || saved === 'fit') return saved;
      const legacy = localStorage.getItem('donamara_tv_fill_youtube');
      if (legacy !== null) return legacy === 'true' ? 'cover' : 'fit';
      return 'cover'; // Default to cover (100% fill)
    } catch {
      return 'cover';
    }
  });

  // Custom Zoom Level (0.8x to 2.5x) to eliminate baked-in black borders
  const [videoZoomLevel, setVideoZoomLevel] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('donamara_tv_video_zoom');
      const num = saved ? parseFloat(saved) : 1.0;
      return isNaN(num) || num < 0.8 || num > 3 ? 1.0 : num;
    } catch {
      return 1.0;
    }
  });

  const forceFillYouTube = mediaFillMode !== 'fit';

  const effectiveZoom = useMemo(() => {
    let base = videoZoomLevel;
    if (mediaFillMode === 'smart_zoom') {
      base *= 1.35;
    }
    return Math.round(base * 100) / 100;
  }, [mediaFillMode, videoZoomLevel]);

  const hideControlsTimer = useRef<any>(null);
  const progressTimer = useRef<any>(null);
  const watchdogTimer = useRef<any>(null);

  // Auto-detected aspect ratio map for uploaded videos & images
  const [detectedAspectMap, setDetectedAspectMap] = useState<Record<string, 'vertical' | 'horizontal'>>({});

  // Active items filter (prioritizing user's registered TV playlist)
  const activeMedia = useMemo(() => {
    if (tvMediaList && tvMediaList.length > 0) {
      const active = tvMediaList.filter(m => m.isActive !== false);
      if (active.length > 0) return active;
      return tvMediaList;
    }
    
    // Default fallback playlist only if database playlist is totally empty
    return [
      {
        id: 'default-1',
        title: 'Pães Artesanais & Quentinhos',
        type: 'image' as const,
        url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=1600&auto=format&fit=crop&q=85',
        durationSeconds: 12,
        order: 1,
        isActive: true
      },
      {
        id: 'default-2',
        title: 'Cafés Especiais & Grãos Selecionados',
        type: 'image' as const,
        url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=1600&auto=format&fit=crop&q=85',
        durationSeconds: 12,
        order: 2,
        isActive: true
      },
      {
        id: 'default-3',
        title: 'Confeitaria Artesanal & Bolos',
        type: 'image' as const,
        url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=1600&auto=format&fit=crop&q=85',
        durationSeconds: 12,
        order: 3,
        isActive: true
      },
      {
        id: 'default-4',
        title: 'Salgados & Croissants Folhados',
        type: 'image' as const,
        url: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=1600&auto=format&fit=crop&q=85',
        durationSeconds: 12,
        order: 4,
        isActive: true
      }
    ];
  }, [tvMediaList]);

  // Keep a stable ref of activeMedia so callbacks and timers never re-trigger on background syncs
  const activeMediaRef = useRef<TvMediaItem[]>(activeMedia);
  activeMediaRef.current = activeMedia;

  const currentItem: TvMediaItem | undefined = activeMedia[currentIndex % activeMedia.length];

  // Advance to next media (increments index so 1-item playlists loop and re-render reliably)
  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => prev + 1);
    setPlaybackProgress(0);
  }, []);

  const handlePrev = useCallback(() => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
    setPlaybackProgress(0);
  }, []);

  // Listen to YouTube postMessage events (auto-skip on end or playback error)
  useEffect(() => {
    const handleWindowMessage = (e: MessageEvent) => {
      try {
        if (typeof e.data === 'string') {
          const data = JSON.parse(e.data);
          if (data.event === 'onStateChange' && data.info === 0) {
            // Video ended
            handleNext();
          } else if (data.event === 'onError') {
            console.warn('[YouTube TV] Embed error code:', data.info);
            setTimeout(() => handleNext(), 1500);
          }
        }
      } catch (err) {
        // ignore other messages
      }
    };
    window.addEventListener('message', handleWindowMessage);
    return () => window.removeEventListener('message', handleWindowMessage);
  }, [handleNext]);

  const processIncomingTvCall = useCallback((call: TvCallItem) => {
    if (call && call.id && call.id !== lastProcessedCallId.current) {
      if (Date.now() - call.calledAt < 35000) {
        lastProcessedCallId.current = call.id;
        setActiveCall(call);

        // Sound & Voice
        if (!isMuted) {
          playChimeSound();
          setTimeout(() => {
            speakOrderCall(call.orderNumber, call.customerName);
          }, 900);
        }

        // Auto dismiss after 10 seconds
        if (callDismissTimer.current) clearTimeout(callDismissTimer.current);
        callDismissTimer.current = setTimeout(() => {
          setActiveCall(null);
        }, 10000);
      }
    }
  }, [isMuted]);

  // Poll for TV Call events (backup)
  useEffect(() => {
    const checkTvCall = async () => {
      try {
        const res = await fetch('/api/db/tv-call-order', { cache: 'no-store' });
        if (res.ok) {
          const call: TvCallItem = await res.json();
          processIncomingTvCall(call);
        }
      } catch (err) {
        // silent
      }
    };

    const callInterval = setInterval(checkTvCall, 8000);
    return () => {
      clearInterval(callInterval);
      if (callDismissTimer.current) clearTimeout(callDismissTimer.current);
    };
  }, [processIncomingTvCall]);

  // Sync initial data and connect to SSE for real-time changes
  useEffect(() => {
    fetchData();

    // Polling rápido a cada 15 segundos para garantir sincronização imediata de vídeos da TV em qualquer estação remota
    const fastInterval = setInterval(() => {
      fetchData();
    }, 15000);

    // Polling de segurança de longo prazo
    const interval = setInterval(() => {
      fetchData();
    }, 600000);

    let debounceTimer: any = null;

    // Realtime SSE
    const es = new EventSource('/api/events');
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'sync') {
          if (data.target === 'orders' || data.target === 'tv_call') {
             if (data.target === 'tv_call' && data.call) processIncomingTvCall(data.call);
             return;
          }
          
          if (debounceTimer) clearTimeout(debounceTimer);
          const delay = data.target === 'tv' ? 200 : 3000;
          debounceTimer = setTimeout(() => {
            fetchData();
          }, delay);
        } else if (data.type === 'tv') {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            fetchData();
          }, 200);
        }
      } catch (err) {
        // ignore
      }
    };

    return () => {
      clearInterval(fastInterval);
      clearInterval(interval);
      if (debounceTimer) clearTimeout(debounceTimer);
      es.close();
    };
  }, [fetchData, processIncomingTvCall]);

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync muted setting from store
  useEffect(() => {
    setIsMuted(storeInfo.tvSoundEnabled !== true);
  }, [storeInfo.tvSoundEnabled]);

  // Keep Screen Awake (Wake Lock API) for TV Box & Smart TV continuous playback
  useEffect(() => {
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        }
      } catch (err) {
        // WakeLock may be rejected if tab is backgrounded
      }
    };

    requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLock) {
        wakeLock.release().catch(() => {});
      }
    };
  }, []);

  // Auto-hide controls and cursor after 3 seconds of mouse inactivity
  const handleMouseMove = () => {
    setShowControls(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(() => {
      setShowControls(false);
    }, 3500);
  };

  // Cycle fill screen mode: cover -> smart_zoom (135%) -> fit (com fundo ambiente) -> cover
  const cycleFillMode = useCallback(() => {
    setMediaFillMode(prev => {
      let next: 'cover' | 'smart_zoom' | 'fit';
      let msg = '';
      if (prev === 'cover') {
        next = 'smart_zoom';
        msg = '🔍 Zoom Expandido 135%: Preenchendo ao máximo e eliminando barras pretas';
      } else if (prev === 'smart_zoom') {
        next = 'fit';
        msg = '📐 Proporção Original: Espaço preto preenchido com fundo dinâmico';
      } else {
        next = 'cover';
        msg = '📺 Preenchimento Total: Ocupando 100% da área do vídeo';
      }
      try {
        localStorage.setItem('donamara_tv_fill_mode', next);
        localStorage.setItem('donamara_tv_fill_youtube', next !== 'fit' ? 'true' : 'false');
      } catch {}

      setFillFeedbackMsg(msg);
      if (fillFeedbackTimer.current) clearTimeout(fillFeedbackTimer.current);
      fillFeedbackTimer.current = setTimeout(() => {
        setFillFeedbackMsg(null);
      }, 3000);

      return next;
    });
  }, []);

  const adjustZoom = useCallback((delta: number) => {
    setVideoZoomLevel(prev => {
      const next = Math.max(0.8, Math.min(2.5, Math.round((prev + delta) * 10) / 10));
      try {
        localStorage.setItem('donamara_tv_video_zoom', String(next));
      } catch {}
      setFillFeedbackMsg(`🔎 Zoom do Vídeo: ${Math.round(next * 100)}%`);
      if (fillFeedbackTimer.current) clearTimeout(fillFeedbackTimer.current);
      fillFeedbackTimer.current = setTimeout(() => {
        setFillFeedbackMsg(null);
      }, 2500);
      return next;
    });
  }, []);

  const resetZoom = useCallback(() => {
    setVideoZoomLevel(1.0);
    setMediaFillMode('cover');
    try {
      localStorage.setItem('donamara_tv_video_zoom', '1.0');
      localStorage.setItem('donamara_tv_fill_mode', 'cover');
      localStorage.setItem('donamara_tv_fill_youtube', 'true');
    } catch {}
    setFillFeedbackMsg('✨ Preenchimento Total: 100% do campo (Padrão)');
    if (fillFeedbackTimer.current) clearTimeout(fillFeedbackTimer.current);
    fillFeedbackTimer.current = setTimeout(() => {
      setFillFeedbackMsg(null);
    }, 2500);
  }, []);

  // For backwards compatibility with any existing callers
  const toggleYouTubeFill = cycleFillMode;

  // Track media viewport dimensions with ResizeObserver for exact 100% edge-to-edge coverage
  useEffect(() => {
    if (!mediaViewportRef.current) return;
    const updateSize = () => {
      if (mediaViewportRef.current) {
        const rect = mediaViewportRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setViewportDimensions({ width: Math.round(rect.width), height: Math.round(rect.height) });
        }
      }
    };

    updateSize();

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setViewportDimensions({ width: Math.round(width), height: Math.round(height) });
        }
      }
    });

    ro.observe(mediaViewportRef.current);
    window.addEventListener('resize', updateSize);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, [mode, isFullscreen]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    };
  }, []);

  // Keyboard & TV Box Remote Control Navigation (DPad / IR Remote keys)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      if (key === 'f' || key === 'F' || key === 'Enter' || key === 'Select') {
        // Enter / OK on remote or F key toggles fullscreen
        toggleFullscreen();
      } else if (key === 'c' || key === 'C' || key === 'z' || key === 'Z') {
        // C / Z cycles video fill mode (occupy whole screen / zoom / fit)
        cycleFillMode();
      } else if (key === '+' || key === '=') {
        // + increases zoom to eliminate black borders
        adjustZoom(0.15);
      } else if (key === '-' || key === '_') {
        // - decreases zoom
        adjustZoom(-0.15);
      } else if (key === '0') {
        // 0 resets zoom to 100%
        resetZoom();
      } else if (key === 'm' || key === 'M' || key === 'VolumeMute') {
        setIsMuted(prev => !prev);
      } else if (key === 'ArrowRight' || key === ' ' || key === 'MediaTrackNext' || key === 'ChannelUp') {
        handleNext();
      } else if (key === 'ArrowLeft' || key === 'MediaTrackPrevious' || key === 'ChannelDown') {
        handlePrev();
      } else if (key === 'r' || key === 'R') {
        window.location.reload();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, toggleYouTubeFill]);

  // Master Slide Timer and Safety Watchdog for ALL Media
  useEffect(() => {
    if (!currentItem) return;

    if (progressTimer.current) clearInterval(progressTimer.current);
    if (watchdogTimer.current) clearTimeout(watchdogTimer.current);
    setPlaybackProgress(0);

    const isDirectVideo = currentItem.type === 'video' || currentItem.url?.startsWith('data:video') || currentItem.url?.startsWith('blob:') || (
      !currentItem.url?.includes('youtube.com') && !currentItem.url?.includes('youtu.be') && /\.(mp4|webm|mov|m4v|ogg)(\?.*)?$/i.test(currentItem.url || '')
    );

    // Calculate baseline duration
    const baseDurationSec = currentItem.durationSeconds && currentItem.durationSeconds >= 3
      ? currentItem.durationSeconds
      : isDirectVideo ? 15 : currentItem.type === 'youtube' ? 25 : 12;

    const durationMs = baseDurationSec * 1000;
    const intervalTime = 100;
    let elapsed = 0;

    // Run interval progress timer for images and youtube
    if (!isDirectVideo) {
      progressTimer.current = setInterval(() => {
        elapsed += intervalTime;
        setPlaybackProgress(Math.min((elapsed / durationMs) * 100, 100));

        if (elapsed >= durationMs) {
          clearInterval(progressTimer.current);
          handleNext();
        }
      }, intervalTime);
    }

    // Safety Watchdog: Guarantees transition even if video playback stalls or fails to trigger onEnded
    const watchdogTimeout = Math.max(durationMs + 2500, 6000);
    watchdogTimer.current = setTimeout(() => {
      handleNext();
    }, watchdogTimeout);

    return () => {
      if (progressTimer.current) clearInterval(progressTimer.current);
      if (watchdogTimer.current) clearTimeout(watchdogTimer.current);
    };
  }, [currentIndex, currentItem?.id, currentItem?.url, handleNext]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(err => {
        console.error(`Error attempting to exit fullscreen: ${err.message}`);
      });
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  // Helper to identify addon products
  const isAddonProduct = useCallback((p: any) => {
    if (!p) return false;
    const cat = (categories || []).find(c => c.id === p.categoryId);
    const catName = (cat?.name || '').toLowerCase();
    const catWords = catName.split(/[\s-]+/);
    return (
      p.isAddon === true ||
      p.categoryId === 'fly938s' ||
      (p.name && p.name.toUpperCase().startsWith('ADICIONAL')) ||
      catWords.includes('adicionais') ||
      catWords.includes('adicional')
    );
  }, [categories]);

  // Group products by in-store active categories for the 10-second sequence
  const menuCategoryGroups = useMemo(() => {
    // Parse selected categories from storeInfo or localStorage fallback
    let selectedCatList: string[] = [];
    const sourceCats = storeInfo?.tvSelectedCategories || localStorage.getItem('donamara_tv_selected_categories');
    if (sourceCats) {
      if (Array.isArray(sourceCats)) {
        selectedCatList = sourceCats;
      } else if (typeof sourceCats === 'string' && sourceCats !== '[]') {
        try {
          const parsed = JSON.parse(sourceCats);
          if (Array.isArray(parsed)) selectedCatList = parsed;
        } catch {}
      }
    }

    // 1. Filter only categories available for in-store consumption and not excluded
    const validInStoreCategories = (Array.isArray(categories) ? categories : [])
      .filter(c => c && c.id && typeof c.name === 'string')
      .filter(c => {
        const isExcluded = isExcludedCategory(c.name);
        const isVisible = c.isVisible !== false;
        const availableInStore = c.availableInStore !== false;
        const matchesSelection = selectedCatList.length === 0 || 
          selectedCatList.includes(c.id) || 
          selectedCatList.includes(c.name) ||
          selectedCatList.some(s => s.toLowerCase() === c.name.toLowerCase() || s.toLowerCase() === c.id.toLowerCase());
        return !isExcluded && isVisible && availableInStore && matchesSelection;
      })
      .sort((a, b) => {
        if (a.order !== undefined && b.order !== undefined && a.order !== b.order) {
          return a.order - b.order;
        }
        return (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' });
      });

    // 2. Map categories to their in-store available products
    const groups = validInStoreCategories.map(cat => {
      const catProducts = (Array.isArray(products) ? products : []).filter(p => {
        const isActive = p.isActive !== false;
        const matchesCategory = p.categoryId === cat.id;
        const isAvailableInStore = p.availableInStore !== false;
        const isExcluded = shouldExcludeProduct(p, categories);
        const isAddon = isAddonProduct(p);
        const isFlavor = p.isFlavor === true;

        return isActive && matchesCategory && isAvailableInStore && !isExcluded && !isAddon && !isFlavor;
      }).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' }));

      return {
        category: cat,
        products: catProducts
      };
    }).filter(g => g.products.length > 0);

    // Fallback if no categories or all categorized products empty
    if (groups.length === 0 && Array.isArray(products) && products.length > 0) {
      const inStoreFallbackProds = products.filter(p => 
        p.isActive !== false && 
        p.availableInStore !== false && 
        !p.isFlavor && 
        !p.isAddon && 
        !isAddonProduct(p) && 
        !shouldExcludeProduct(p, categories)
      ).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' }));

      if (inStoreFallbackProds.length > 0) {
        return [{
          category: { id: 'destaques', name: 'Mais Pedidos da Loja', order: 1, availableInStore: true, isVisible: true },
          products: inStoreFallbackProds
        }];
      }
    }

    return groups;
  }, [categories, products, isAddonProduct, storeInfo?.tvSelectedCategories]);

  // Group all categories and slice them into 4-product slides
  const allMenuSlides = useMemo(() => {
    const slides: Array<{
      id: string;
      category: any;
      categoryIndex: number;
      totalCategories: number;
      pageIndex: number;
      totalPages: number;
      products: Product[];
      totalCategoryProducts: number;
    }> = [];

    menuCategoryGroups.forEach((group, catIdx) => {
      const prods = group.products || [];
      const totalPages = Math.max(1, Math.ceil(prods.length / 4));
      
      for (let p = 0; p < totalPages; p++) {
        const slice = prods.slice(p * 4, (p + 1) * 4);
        slides.push({
          id: `${group.category.id || catIdx}-slide-${p}`,
          category: group.category,
          categoryIndex: catIdx,
          totalCategories: menuCategoryGroups.length,
          pageIndex: p,
          totalPages: totalPages,
          products: slice,
          totalCategoryProducts: prods.length,
        });
      }
    });

    return slides;
  }, [menuCategoryGroups]);

  // 10-Second Continuous 4-by-4 Product Slide Rotation State
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [categoryTimeProgress, setCategoryTimeProgress] = useState(0);

  // Keep a ref of allMenuSlides length so interval does not get reset by background store polling
  const slidesCountRef = useRef(allMenuSlides.length);
  useEffect(() => {
    slidesCountRef.current = allMenuSlides.length;
  }, [allMenuSlides.length]);

  // Current active slide (4 items)
  const currentSlide = allMenuSlides.length > 0
    ? (allMenuSlides[activeSlideIndex % allMenuSlides.length] || allMenuSlides[0])
    : null;

  // Handle exact 7-second rotation for each block of 3 items
  useEffect(() => {
    if (allMenuSlides.length === 0) return;

    setCategoryTimeProgress(0);
    const stepDurationMs = 7000; // Exact 7 seconds per slide of 3 items
    const stepMs = 100;
    let elapsed = 0;

    const interval = setInterval(() => {
      elapsed += stepMs;
      setCategoryTimeProgress(Math.min((elapsed / stepDurationMs) * 100, 100));

      if (elapsed >= stepDurationMs) {
        clearInterval(interval);
        setCategoryTimeProgress(0);
        setActiveSlideIndex((prev) => {
          const total = slidesCountRef.current || 1;
          return (prev + 1) % total;
        });
      }
    }, stepMs);

    return () => clearInterval(interval);
  }, [activeSlideIndex, allMenuSlides.length > 0]);

  // Ready orders for the order call panel mode
  const readyOrders = useMemo(() => {
    return orders.filter(o => o.status === 'ready').slice(0, 6);
  }, [orders]);

  const preparingOrders = useMemo(() => {
    return orders.filter(o => o.status === 'preparing').slice(0, 6);
  }, [orders]);

  // Helper function to aggressively disable YouTube closed captions / subtitles via postMessage API
  const disableYouTubeCaptions = (iframe: HTMLIFrameElement | null) => {
    if (!iframe || !iframe.contentWindow) return;
    
    const sendCommand = (func: string, args: any[] = []) => {
      try {
        iframe.contentWindow?.postMessage(
          JSON.stringify({ event: 'command', func, args }),
          '*'
        );
      } catch {
        // ignore cross-origin errors
      }
    };

    // Explicitly unload and turn off CC tracks
    sendCommand('unloadModule', ['captions']);
    sendCommand('unloadModule', ['cc']);
    sendCommand('setOption', ['captions', 'track', {}]);
    sendCommand('setOption', ['cc', 'track', {}]);
    sendCommand('setOption', ['captions', 'fontSize', -1]);
  };

  // Strict Media Type Classification
  const isDirectVideo = currentItem?.type === 'video' || (
    currentItem?.type !== 'youtube' &&
    currentItem?.type !== 'image' &&
    (
      currentItem?.url?.startsWith('data:video') ||
      currentItem?.url?.startsWith('blob:') ||
      /\.(mp4|webm|mov|m4v|ogg|avi|mkv)(\?.*)?$/i.test(currentItem?.url || '')
    )
  );

  const youtubeId = !isDirectVideo && (
    currentItem?.type === 'youtube' ||
    (!currentItem?.type && !currentItem?.url?.startsWith('data:') && !currentItem?.url?.startsWith('blob:'))
  ) ? extractYouTubeId(currentItem?.url) : null;

  const isYoutube = currentItem?.type === 'youtube' || (!isDirectVideo && currentItem?.type !== 'image' && !!youtubeId);
  const shouldShowCaptions = currentItem?.showCaptions !== undefined ? currentItem.showCaptions : (storeInfo.tvShowCaptions || false);
  
  const currentItemKey = currentItem?.id || currentItem?.url || '';
  const isDetectedVertical = detectedAspectMap[currentItemKey] === 'vertical';
  const isSmartphoneVideo = currentItem?.fitMode === 'vertical_smartphone' || currentItem?.url?.includes('/shorts/') || isDetectedVertical;
  const itemFitMode = currentItem?.fitMode ? currentItem.fitMode : (isSmartphoneVideo ? 'vertical_smartphone' : 'fit');

  const shouldFill = mediaFillMode !== 'fit' || itemFitMode === 'cover';

  // Dynamic layout to guarantee the YouTube iframe covers 100% of the video area without letterboxing
  const youtubeEmbedLayout = useMemo(() => {
    // If user explicitly configured vertical smartphone and chose not to force fill
    if (itemFitMode === 'vertical_smartphone' && !shouldFill) {
      return {
        wrapperClass: 'h-full max-h-full aspect-[9/16] w-auto shadow-[0_0_70px_rgba(0,0,0,0.9)] rounded-2xl overflow-hidden border border-white/15',
        iframeClass: 'border-0 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-full aspect-video min-w-[177.78%] w-[177.78%] max-w-none',
        iframeStyle: undefined as React.CSSProperties | undefined
      };
    }

    // When filling the entire video field (default behavior requested by user):
    if (shouldFill) {
      const { width, height } = viewportDimensions;
      const targetAspect = (itemFitMode === 'vertical_smartphone') ? (9 / 16) : (16 / 9);

      if (width > 0 && height > 0) {
        const containerAspect = width / height;
        let calculatedWidth = width;
        let calculatedHeight = height;

        if (containerAspect < targetAspect) {
          // Container is narrower/taller than video (e.g. split_menu mode 62% width on 1080p TV)
          // Video fills 100% of container height, and width expands to keep 16:9 eliminating black bars
          calculatedHeight = height;
          calculatedWidth = Math.ceil(height * targetAspect);
        } else {
          // Container is wider than video (e.g. ultra-wide or banner TV)
          // Video fills 100% of container width, and height expands to keep 16:9 eliminating black bars
          calculatedWidth = width;
          calculatedHeight = Math.ceil(width / targetAspect);
        }

        // Apply zoom scale if requested
        if (effectiveZoom !== 1.0) {
          calculatedWidth = Math.round(calculatedWidth * effectiveZoom);
          calculatedHeight = Math.round(calculatedHeight * effectiveZoom);
        }

        // Add 8px bleed to guarantee no subpixel borders on high-DPI TVs or scaling
        calculatedWidth += 8;
        calculatedHeight += 8;

        return {
          wrapperClass: 'w-full h-full relative overflow-hidden flex items-center justify-center',
          iframeClass: 'border-0 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 max-w-none pointer-events-auto',
          iframeStyle: {
            width: `${calculatedWidth}px`,
            height: `${calculatedHeight}px`,
          } as React.CSSProperties | undefined
        };
      }

      // Responsive CSS fallback before ResizeObserver dimensions are populated
      return {
        wrapperClass: 'w-full h-full relative overflow-hidden flex items-center justify-center',
        iframeClass: 'border-0 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 min-w-full min-h-full max-w-none scale-[1.38]',
        iframeStyle: {
          width: 'max(100%, 178vh)',
          height: 'max(100%, 56.25vw)',
        } as React.CSSProperties | undefined
      };
    }

    // Standard contained fit (when user explicitly turns off fill)
    return {
      wrapperClass: 'w-full h-full relative flex items-center justify-center overflow-hidden',
      iframeClass: 'border-0 relative z-10 w-full h-full',
      iframeStyle: undefined as React.CSSProperties | undefined
    };
  }, [itemFitMode, shouldFill, effectiveZoom, viewportDimensions]);

  return (
    <div 
      ref={containerRef}
      className={`relative w-screen h-screen bg-black overflow-hidden font-sans select-none ${!showControls ? 'cursor-none' : ''}`}
      onDoubleClick={toggleFullscreen}
    >
      {/* Dynamic Background subtle glow - Content stops right above the bottom ticker */}
      <div className="absolute inset-x-0 top-0 bottom-14 bg-stone-950 flex">
        {/* Main Content Area */}
        <div className={`relative h-full transition-all duration-700 flex flex-col ${
          mode === 'fullscreen_media' ? 'w-full' : 'w-[62%]'
        }`}>
          
          {/* Media Viewport */}
          <div 
            ref={mediaViewportRef}
            className="relative flex-1 w-full h-full overflow-hidden bg-black flex items-center justify-center"
          >
            
            {/* 1. YouTube Embed Player */}
            {isYoutube && youtubeId ? (
              <div className="relative w-full h-full bg-stone-950 overflow-hidden flex items-center justify-center">
                {/* Visual Ambient Backdrop so screen is NEVER black around the player */}
                <div 
                  className="absolute inset-0 bg-cover bg-center transition-all duration-1000 transform scale-125 blur-3xl opacity-60 pointer-events-none"
                  style={{
                    backgroundImage: `url('https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg'), url('https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg')`
                  }}
                >
                  <div className="absolute inset-0 bg-black/40 backdrop-blur-md pointer-events-none" />
                </div>

                <div className={youtubeEmbedLayout.wrapperClass}>
                  <iframe
                    id="tv-youtube-player"
                    key={`yt-${currentItem?.id || youtubeId}-${currentIndex}-${shouldShowCaptions ? 'captions-on' : 'captions-off'}-${itemFitMode}-${mediaFillMode}-${effectiveZoom}`}
                    src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=${isMuted ? '1' : '0'}&controls=0&loop=1&playlist=${youtubeId}&modestbranding=1&playsinline=1&rel=0&enablejsapi=1&cc_load_policy=${shouldShowCaptions ? '1' : '0'}${shouldShowCaptions ? '' : '&cc_lang_pref=none'}&hl=pt-BR&iv_load_policy=3&disablekb=1&fs=0`}
                    title={currentItem?.title || 'Vídeo Smart TV'}
                    className={youtubeEmbedLayout.iframeClass}
                    style={youtubeEmbedLayout.iframeStyle}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    onLoad={(e) => {
                      const iframe = e.currentTarget as HTMLIFrameElement;
                      if (!shouldShowCaptions) {
                        disableYouTubeCaptions(iframe);
                        setTimeout(() => disableYouTubeCaptions(iframe), 400);
                        setTimeout(() => disableYouTubeCaptions(iframe), 1200);
                        setTimeout(() => disableYouTubeCaptions(iframe), 2500);
                        setTimeout(() => disableYouTubeCaptions(iframe), 4500);
                      } else {
                        try {
                          iframe.contentWindow?.postMessage(
                            JSON.stringify({ event: 'command', func: 'loadModule', args: ['captions'] }),
                            '*'
                          );
                        } catch {}
                      }
                    }}
                  />
                </div>
              </div>
            ) : isDirectVideo || currentItem?.type === 'video' ? (
              /* 2. Direct Video Player (.mp4, .webm, .mov, uploaded file) */
              <div className="relative w-full h-full bg-stone-950 flex items-center justify-center overflow-hidden">
                {/* Ambient Blurred Video Background: Always active to eliminate black space around the video */}
                <video
                  key={`ambient-vid-${currentItem.id || currentItem.url}-${currentIndex}`}
                  src={currentItem.url}
                  autoPlay
                  loop
                  muted
                  playsInline
                  aria-hidden="true"
                  className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-60 scale-125 pointer-events-none transform-gpu"
                />
                <div className="absolute inset-0 bg-black/40 backdrop-blur-md pointer-events-none" />

                <video
                  key={`vid-${currentItem.id || currentItem.url}-${currentIndex}-${itemFitMode}-${mediaFillMode}`}
                  ref={videoRef}
                  src={currentItem.url}
                  autoPlay
                  playsInline
                  muted={isMuted}
                  onLoadedMetadata={(e) => {
                    const vid = e.currentTarget;
                    if (vid.videoHeight && vid.videoWidth && vid.videoHeight > vid.videoWidth * 1.05) {
                      if (detectedAspectMap[currentItemKey] !== 'vertical') {
                        setDetectedAspectMap(prev => ({ ...prev, [currentItemKey]: 'vertical' }));
                      }
                    }
                    if (vid.duration && vid.duration > 0 && isFinite(vid.duration)) {
                      if (watchdogTimer.current) clearTimeout(watchdogTimer.current);
                      const vidMs = (vid.duration + 2) * 1000;
                      watchdogTimer.current = setTimeout(() => {
                        handleNext();
                      }, vidMs);
                    }
                    vid.play().catch(() => {
                      vid.muted = true;
                      vid.play().catch(() => {});
                    });
                  }}
                  onEnded={() => {
                    handleNext();
                  }}
                  onTimeUpdate={(e) => {
                    const vid = e.currentTarget;
                    if (vid.duration && vid.duration > 0 && isFinite(vid.duration)) {
                      const pct = (vid.currentTime / vid.duration) * 100;
                      setPlaybackProgress(Math.min(pct, 100));
                      if (vid.currentTime >= vid.duration - 0.4) {
                        handleNext();
                      }
                    }
                  }}
                  onError={() => {
                    console.warn('Video failed to load or unsupported format:', currentItem.url);
                    setTimeout(() => {
                      handleNext();
                    }, 1500);
                  }}
                  className={`animate-fade-in transition-all duration-300 ${
                    itemFitMode === 'vertical_smartphone' && !shouldFill
                      ? 'relative z-10 h-full max-h-full aspect-[9/16] object-cover shadow-[0_0_70px_rgba(0,0,0,0.9)] rounded-2xl border border-white/15'
                      : shouldFill
                      ? 'relative z-10 w-full h-full object-cover'
                      : 'relative z-10 w-full h-full object-contain'
                  }`}
                  style={effectiveZoom !== 1.0 ? { transform: `scale(${effectiveZoom})` } : undefined}
                />
              </div>
            ) : (
              /* 3. Image / Promotional Banner */
              <div className="relative w-full h-full overflow-hidden bg-stone-950 flex items-center justify-center">
                {/* Ambient Blurred Background for Images: Always active to eliminate black space around banner */}
                <img
                  key={`ambient-img-${currentItem?.id || currentItem?.url}-${currentIndex}`}
                  src={currentItem?.url}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-60 scale-125 pointer-events-none transform-gpu"
                />
                <div className="absolute inset-0 bg-black/40 backdrop-blur-md pointer-events-none" />

                <img
                  key={`img-${currentItem?.id || currentItem?.url}-${currentIndex}-${itemFitMode}-${mediaFillMode}`}
                  src={currentItem?.url}
                  alt={currentItem?.title || 'Banner'}
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    if (img.naturalHeight && img.naturalWidth && img.naturalHeight > img.naturalWidth * 1.05) {
                      if (detectedAspectMap[currentItemKey] !== 'vertical') {
                        setDetectedAspectMap(prev => ({ ...prev, [currentItemKey]: 'vertical' }));
                      }
                    }
                  }}
                  className={`transition-all duration-300 ease-out transform-gpu animate-fade-in ${
                    itemFitMode === 'vertical_smartphone' && !shouldFill
                      ? 'relative z-10 h-full max-h-full aspect-[9/16] object-cover shadow-[0_0_70px_rgba(0,0,0,0.9)] rounded-2xl border border-white/15'
                      : shouldFill
                      ? 'relative z-10 w-full h-full object-cover scale-100'
                      : 'relative z-10 w-full h-full object-contain'
                  }`}
                  style={effectiveZoom !== 1.0 ? { transform: `scale(${effectiveZoom})` } : (itemFitMode === 'cover' ? {
                    animation: 'zoomSlow 14s infinite alternate ease-in-out'
                  } : undefined)}
                  onError={(e) => {
                    // Fallback to placeholder if image fails
                    console.warn('Image failed to load:', currentItem?.url);
                  }}
                />
                {/* Image Gradient vignette for readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none" />
                
                {/* Media Title Overlay */}
                {currentItem?.title && (
                  <div className="absolute bottom-8 left-10 right-10 max-w-2xl bg-black/60 backdrop-blur-md p-6 rounded-2xl border border-white/10 shadow-2xl animate-fade-in z-20">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                      <span className="text-xs font-bold uppercase tracking-widest text-amber-300">Destaque do Dia</span>
                    </div>
                    <h2 className="text-3xl font-extrabold text-white tracking-tight drop-shadow-md">
                      {currentItem.title}
                    </h2>
                  </div>
                )}
              </div>
            )}

            {/* Notification Toast when Toggling Fill Screen / Fit Proportion */}
            {fillFeedbackMsg && (
              <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-stone-900/95 text-amber-300 border border-amber-500/40 px-5 py-2.5 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-2.5 z-50 text-xs sm:text-sm font-bold animate-fade-in pointer-events-none">
                <Maximize2 className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{fillFeedbackMsg}</span>
              </div>
            )}

            {/* Top Bar Overlay (Logo, Clock & Live Indicator) */}
            {storeInfo.tvShowClock !== false && (
              <div className="absolute top-0 left-0 right-0 p-6 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/30 to-transparent pointer-events-none z-20">
                
                {/* Brand Logo & Name */}
                <div className="flex items-center gap-4 bg-stone-900/85 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-amber-500/20 shadow-2xl">
                  <div className="w-14 h-14 rounded-2xl overflow-hidden bg-gradient-to-br from-amber-950 to-stone-950 p-1 border border-amber-500/40 shadow-lg flex items-center justify-center shrink-0">
                    <img 
                      src={storeInfo.logoUrl || '/logo.svg'} 
                      alt={storeInfo.name || 'DONAMARA - REVENDA'} 
                      className="w-full h-full object-contain drop-shadow-md hover:scale-105 transition-transform"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div>
                    <h1 className="text-xl font-black text-white tracking-wide leading-none">{storeInfo.name || 'DONAMARA - REVENDA'}</h1>
                    <p className="text-xs text-amber-300 font-medium tracking-wider uppercase mt-1.5">
                      {storeInfo.headerPhrase || 'Salgados Especiais e Revenda'}
                    </p>
                  </div>
                </div>

                {/* Clock & Status */}
                <div className="flex items-center gap-4">
                  <div className="bg-stone-900/80 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 shadow-xl flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-2xl font-black text-white leading-none tracking-wider font-mono">
                        {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </p>
                      <p className="text-xs text-stone-300 font-semibold capitalize mt-1">
                        {currentTime.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
                      </p>
                    </div>
                    <div className="w-px h-8 bg-white/20" />
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Ao Vivo na Loja</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Playlist Progress Indicator Bar */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-white/10 z-30">
              <div 
                className="h-full bg-amber-400 transition-all duration-150 ease-linear shadow-[0_0_10px_#f59e0b]"
                style={{ width: `${playbackProgress}%` }}
              />
            </div>

            {/* Floating Navigation Controls (Shows on mouse hover, hides on TV idle) */}
            <div className={`absolute bottom-6 right-6 flex items-center gap-2.5 transition-opacity duration-300 z-40 ${
              showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}>
              <button
                type="button"
                onClick={handlePrev}
                className="p-3 bg-stone-900/90 text-white hover:bg-amber-500 hover:text-stone-950 rounded-xl backdrop-blur-md border border-white/10 shadow-xl transition-all cursor-pointer"
                title="Mídia Anterior"
              >
                <ChevronRight className="w-5 h-5 rotate-180" />
              </button>

              <button
                type="button"
                onClick={() => setIsMuted(!isMuted)}
                className="p-3 bg-stone-900/90 text-white hover:bg-amber-500 hover:text-stone-950 rounded-xl backdrop-blur-md border border-white/10 shadow-xl transition-all cursor-pointer"
                title={isMuted ? "Ativar Som (M)" : "Silenciar (M)"}
              >
                {isMuted ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5 text-emerald-400" />}
              </button>

              {/* Toggle Ocupar Todo o Campo / Zoom 135% / Proporção Original */}
              <button
                type="button"
                onClick={cycleFillMode}
                className={`p-3 rounded-xl backdrop-blur-md border shadow-xl transition-all cursor-pointer flex items-center gap-2 ${
                  mediaFillMode === 'cover'
                    ? 'bg-amber-500 text-stone-950 border-amber-400 ring-2 ring-amber-400/40 shadow-amber-500/20'
                    : mediaFillMode === 'smart_zoom'
                    ? 'bg-amber-400 text-stone-950 border-amber-300 ring-2 ring-amber-300/40 shadow-amber-400/20'
                    : 'bg-stone-900/90 text-stone-300 hover:bg-amber-500 hover:text-stone-950 border-white/10'
                }`}
                title={
                  mediaFillMode === 'cover'
                    ? "Preenchimento Total (100% da área). Pressione 'C' ou 'Z' para Zoom 135%."
                    : mediaFillMode === 'smart_zoom'
                    ? "Zoom Expandido 135% (Elimina bordas pretas). Pressione 'C' ou 'Z' para Proporção Original."
                    : "Proporção Original com Fundo Dinâmico. Pressione 'C' ou 'Z' para Preenchimento Total."
                }
              >
                {mediaFillMode === 'smart_zoom' ? (
                  <ZoomIn className="w-5 h-5" />
                ) : mediaFillMode === 'cover' ? (
                  <Maximize2 className="w-5 h-5" />
                ) : (
                  <Minimize2 className="w-5 h-5" />
                )}
                <span className="text-xs font-bold hidden sm:inline">
                  {mediaFillMode === 'cover' ? 'Preenchido' : mediaFillMode === 'smart_zoom' ? 'Zoom 135%' : 'Proporção'}
                </span>
              </button>

              {/* Zoom Buttons (+ e -) */}
              <div className="flex items-center bg-stone-900/90 backdrop-blur-md rounded-xl border border-white/10 shadow-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => adjustZoom(-0.15)}
                  className="p-3 text-stone-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  title="Diminuir Zoom (-)"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={resetZoom}
                  className="px-2.5 py-3 text-[11px] font-mono font-bold text-amber-400 hover:text-amber-300 hover:bg-white/10 transition-colors cursor-pointer"
                  title="Restaurar Zoom Padrão (0)"
                >
                  {Math.round(effectiveZoom * 100)}%
                </button>
                <button
                  type="button"
                  onClick={() => adjustZoom(0.15)}
                  className="p-3 text-stone-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  title="Aumentar Zoom (+)"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleNext}
                className="p-3 bg-stone-900/90 text-white hover:bg-amber-500 hover:text-stone-950 rounded-xl backdrop-blur-md border border-white/10 shadow-xl transition-all cursor-pointer"
                title="Próxima Mídia (Espaço / Seta Direita)"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={toggleFullscreen}
                className="p-3 bg-stone-900/90 text-white hover:bg-amber-500 hover:text-stone-950 rounded-xl backdrop-blur-md border border-white/10 shadow-xl transition-all cursor-pointer"
                title="Tela Cheia (F)"
              >
                {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Side Panel: Split Menu Mode (10-Second Category Sequence Rotation) */}
        {mode === 'split_menu' && (
          <div className="w-[38%] h-full bg-stone-900 border-l border-stone-800 flex flex-col p-6 lg:p-8 overflow-hidden">
            {/* Header: Category Badge, Name, Page and 10s Timer */}
            <div className="mb-4 pb-3 border-b-2 border-stone-800 shrink-0">
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="w-3.5 h-3.5 rounded-full bg-amber-400 animate-pulse shadow-[0_0_12px_#f59e0b]" />
                  <span className="text-xs lg:text-sm font-black uppercase tracking-widest text-amber-400">
                    {menuCategoryGroups.length > 1 
                      ? `Categoria ${(currentSlide?.categoryIndex ?? 0) + 1} de ${menuCategoryGroups.length}`
                      : 'Cardápio em Destaque'}
                  </span>
                  {(currentSlide?.totalPages ?? 1) > 1 && (
                    <span className="text-xs lg:text-sm font-black px-2.5 py-0.5 rounded-md bg-amber-400/20 text-amber-300 border border-amber-400/40">
                      Página {(currentSlide?.pageIndex ?? 0) + 1} de {currentSlide?.totalPages}
                    </span>
                  )}
                </div>
                <span className="text-xs lg:text-sm font-black text-amber-300 tracking-wider bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 rounded-lg">
                  Próximos em {Math.max(1, Math.ceil(7 * (1 - categoryTimeProgress / 100)))}s
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <h3 className="text-2xl lg:text-3xl xl:text-4xl font-black text-white uppercase tracking-tight line-clamp-1 drop-shadow-md">
                  {currentSlide?.category.name || 'Cardápio'}
                </h3>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs lg:text-sm px-3 py-1 rounded-full bg-amber-500/25 text-amber-300 font-black border border-amber-500/40 shadow-xs">
                    {currentSlide?.totalCategoryProducts || 0} itens
                  </span>
                </div>
              </div>

              {/* 10-Second Category Progress Bar */}
              <div className="w-full h-2.5 bg-stone-800 rounded-full overflow-hidden mt-3 shadow-inner">
                <div 
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-100 ease-linear shadow-[0_0_14px_#f59e0b]"
                  style={{ width: `${categoryTimeProgress}%` }}
                />
              </div>

              {/* Category Indicators / Dots */}
              {menuCategoryGroups.length > 1 && (
                <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1 no-scrollbar">
                  {menuCategoryGroups.map((group, idx) => {
                    const isSelected = currentSlide?.categoryIndex === idx;
                    return (
                      <button
                        key={group.category.id}
                        type="button"
                        onClick={() => {
                          const targetIdx = allMenuSlides.findIndex(s => s.categoryIndex === idx);
                          if (targetIdx !== -1) {
                            setActiveSlideIndex(targetIdx);
                            setCategoryTimeProgress(0);
                          }
                        }}
                        className={`px-3 py-1 rounded-xl text-xs lg:text-sm font-black tracking-tight whitespace-nowrap transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500 text-stone-950 font-black shadow-md scale-105 border-2 border-amber-400'
                            : 'bg-stone-800/90 text-stone-300 border border-stone-700 hover:bg-stone-700 hover:text-white'
                        }`}
                      >
                        {group.category.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Category Products List with Fade Transition (4 items per 10-second page) */}
            <div 
              key={currentSlide?.id || activeSlideIndex}
              className="flex-1 min-h-0 space-y-2.5 overflow-y-auto pr-1 animate-fade-in"
            >
              {currentSlide && currentSlide.products.length > 0 ? (
                currentSlide.products.map((product) => {
                  const hasValidImage = product.imageUrl && product.imageUrl.trim() !== '' && !product.imageUrl.includes('unsplash.com');
                  const formattedImageSrc = hasValidImage && product.imageUrl?.startsWith('http://') 
                    ? `/api/image-proxy?url=${encodeURIComponent(product.imageUrl)}` 
                    : (product.imageUrl || '');

                  return (
                    <div 
                      key={product.id}
                      className="bg-stone-800/90 border-2 border-stone-700/70 rounded-3xl p-4 lg:p-5 flex items-center gap-4 hover:border-amber-500/60 transition-all shadow-xl"
                    >
                      {hasValidImage ? (
                        <img
                          src={formattedImageSrc}
                          alt={product.name}
                          className="w-20 h-20 lg:w-28 lg:h-28 object-cover rounded-2xl shrink-0 bg-stone-900 border border-white/10 shadow-md"
                          onError={(e) => {
                            const target = e.currentTarget as HTMLImageElement;
                            target.src = storeInfo.logoUrl || '/logo.svg';
                            target.className = "w-20 h-20 lg:w-28 lg:h-28 object-contain p-2 rounded-2xl shrink-0 bg-stone-950 border border-amber-500/30 shadow-md";
                          }}
                        />
                      ) : (
                        <div className="w-20 h-20 lg:w-28 lg:h-28 rounded-2xl bg-stone-950 border border-amber-500/30 p-2 flex items-center justify-center shrink-0 shadow-md">
                          <img 
                            src={storeInfo.logoUrl || '/logo.svg'} 
                            alt={storeInfo.name || 'DONAMARA - REVENDA'} 
                            className="w-full h-full object-contain drop-shadow-sm"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-white font-black text-2xl lg:text-3xl xl:text-4xl truncate leading-tight tracking-tight">
                          {product.name}
                        </h4>
                        {product.description && (
                          <p className="text-stone-300 text-sm lg:text-base line-clamp-1 mt-1 font-medium">
                            {product.description}
                          </p>
                        )}
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="text-amber-400 font-black text-2xl lg:text-3xl xl:text-4xl tracking-tight drop-shadow-[0_2px_8px_rgba(245,158,11,0.3)]">
                            R$ {Number(product.price).toFixed(2).replace('.', ',')}
                          </span>
                          <span className="text-[11px] lg:text-xs uppercase font-black px-2.5 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                            Disponível
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="h-full flex items-center justify-center text-stone-400 text-center p-6 text-base font-bold">
                  Nenhum produto cadastrado nesta categoria
                </div>
              )}
            </div>
          </div>
        )}

        {/* Side Panel: Split Orders Call Mode */}
        {mode === 'split_orders' && (
          <div className="w-[38%] h-full bg-stone-900 border-l border-stone-800 flex flex-col p-6 lg:p-8 overflow-hidden">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-stone-800">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <BellRing className="w-5 h-5 animate-bounce" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-wider">Painel de Pedidos</h3>
                <p className="text-xs text-stone-400 font-medium">Acompanhe a sua chamada</p>
              </div>
            </div>

            {/* Ready Orders */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <h4 className="text-xs font-black uppercase tracking-wider text-emerald-400">Pronto para Retirada</h4>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {readyOrders.length > 0 ? (
                  readyOrders.map(o => (
                    <div key={o.id} className="bg-emerald-950/60 border-2 border-emerald-500/70 p-3 rounded-2xl text-center shadow-lg animate-pulse">
                      <span className="text-xs text-emerald-300 font-semibold block">Senha</span>
                      <span className="text-2xl font-black text-white tracking-widest font-mono">
                        #{String(o.id).slice(-4).padStart(4, '0')}
                      </span>
                      <p className="text-[11px] text-emerald-200 truncate font-medium mt-1">{o.customerName || 'Cliente'}</p>
                    </div>
                  ))
                ) : (
                  <div className="col-span-2 py-6 text-center text-stone-500 bg-stone-800/40 rounded-2xl border border-stone-800 text-xs">
                    Nenhum pedido aguardando retirada no momento
                  </div>
                )}
              </div>
            </div>

            {/* Preparing Orders */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <h4 className="text-xs font-black uppercase tracking-wider text-amber-400">Em Preparação</h4>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {preparingOrders.length > 0 ? (
                  preparingOrders.map(o => (
                    <div key={o.id} className="bg-stone-800/80 border border-stone-700/80 p-2.5 rounded-xl text-center">
                      <span className="text-[10px] text-stone-400 block font-semibold">Senha</span>
                      <span className="text-lg font-bold text-amber-300 font-mono">
                        #{String(o.id).slice(-4).padStart(4, '0')}
                      </span>
                      <p className="text-[10px] text-stone-300 truncate mt-0.5">{o.customerName || 'Cliente'}</p>
                    </div>
                  ))
                ) : (
                  <div className="col-span-2 py-4 text-center text-stone-500 bg-stone-800/40 rounded-xl text-xs">
                    Todos os pedidos preparados!
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Fullscreen TV Order Call Banner Popup Overlay */}
      {activeCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl p-8 animate-fade-in">
          <div className="relative w-full max-w-4xl bg-gradient-to-b from-stone-900 via-stone-900 to-black border-4 border-amber-400 rounded-3xl shadow-[0_0_80px_rgba(245,158,11,0.5)] p-10 text-center overflow-hidden">
            {/* Ambient glowing radial light */}
            <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
            
            {/* Close button for manual dismiss */}
            <button
              onClick={() => setActiveCall(null)}
              className="absolute top-6 right-6 p-3 rounded-full bg-stone-800 text-stone-400 hover:text-white hover:bg-stone-700 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Header with Bell and Pulsing Rings */}
            <div className="flex flex-col items-center justify-center mb-6">
              <div className="relative w-24 h-24 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 text-stone-950 flex items-center justify-center shadow-2xl mb-4">
                <div className="absolute inset-0 rounded-full bg-amber-400 animate-ping opacity-60" />
                <BellRing className="w-12 h-12 relative z-10 animate-bounce" />
              </div>
              <div className="inline-flex items-center gap-2 px-6 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-sm font-black uppercase tracking-widest">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                Pedido Pronto para Retirada!
              </div>
            </div>

            {/* Password Number */}
            <div className="my-4">
              <span className="text-stone-400 text-sm font-bold uppercase tracking-widest block mb-1">
                Número da Senha
              </span>
              <div className="text-8xl md:text-9xl font-black text-amber-400 font-mono tracking-wider drop-shadow-[0_0_35px_rgba(245,158,11,0.6)]">
                #{activeCall.orderNumber}
              </div>
            </div>

            {/* Customer Name */}
            <div className="mt-6 mb-8">
              <span className="text-stone-400 text-xs uppercase tracking-widest block mb-1">
                Cliente
              </span>
              <h3 className="text-4xl md:text-5xl font-black text-white uppercase tracking-wide">
                {activeCall.customerName}
              </h3>
              {activeCall.tableOrDesk && (
                <p className="text-lg text-amber-300 font-bold mt-2">
                  📍 {activeCall.tableOrDesk}
                </p>
              )}
            </div>

            {/* Instruction Footer */}
            <div className="pt-6 border-t border-stone-800 flex items-center justify-center gap-3">
              <ChefHat className="w-6 h-6 text-amber-400" />
              <p className="text-lg md:text-xl font-bold text-stone-200">
                Por favor, retire o seu pedido no <span className="text-amber-400 underline">balcão de atendimento</span>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Bottom News Ticker (Letreiro Rodapé Animado) */}
      <div className="absolute bottom-0 left-0 right-0 h-14 bg-stone-950 text-white font-black flex items-center z-30 shadow-2xl overflow-hidden border-t-2 border-amber-500/30">
        <div className="px-6 py-2.5 bg-amber-600 text-white uppercase tracking-widest text-xs font-black shrink-0 flex items-center gap-2 shadow-md z-10 border-r border-amber-500/40">
          <Flame className="w-4 h-4 text-white animate-pulse" />
          <span>Informativo</span>
        </div>
        
        <div className="flex-1 overflow-hidden relative">
          <div className="whitespace-nowrap flex items-center gap-12 animate-marquee text-lg md:text-xl font-bold text-white tracking-wider drop-shadow-md">
            <span className="text-white font-black">{storeInfo.tvTickerText || '🥟 Salgados fresquinhos e crocantes para revenda e consumo! Peça pelo app ou no balcão!'}</span>
            <span className="text-amber-400 font-bold text-xl">•</span>
            <span className="text-white font-black">🥟 Venha conhecer nossa linha completa de salgados especiais para festas e revenda!</span>
            <span className="text-amber-400 font-bold text-xl">•</span>
            <span className="text-white font-black">📱 Faça seu pedido com praticidade pelo nosso Cardápio Digital!</span>
            <span className="text-amber-400 font-bold text-xl">•</span>
            <span className="text-white font-black">🥟 DONAMARA • Revenda de Salgados</span>
          </div>
        </div>
      </div>

      {/* Custom Styles for Smooth Animations */}
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .animate-marquee {
          display: inline-block;
          animation: marquee 35s linear infinite;
        }
        .animate-fade-in {
          animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.99); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes zoomSlow {
          0% { transform: scale(1); }
          100% { transform: scale(1.08); }
        }
      `}</style>
    </div>
  );
}
