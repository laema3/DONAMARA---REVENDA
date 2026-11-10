import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { useStore, TvMediaItem } from '../store/useStore';
import { extractYouTubeId } from '../pages/TvDisplay';
import { 
  Tv, 
  Plus, 
  Trash2, 
  ExternalLink, 
  Copy, 
  Check, 
  Volume2, 
  VolumeX, 
  Film, 
  Image as ImageIcon, 
  Youtube, 
  ArrowUp, 
  ArrowDown, 
  Sparkles, 
  Save, 
  Clock, 
  Eye, 
  Layers, 
  CheckCircle2, 
  HelpCircle, 
  Megaphone, 
  Play, 
  X,
  Subtitles,
  Upload,
  FileVideo,
  Loader2,
  AlertCircle,
  RefreshCw,
  Smartphone,
  Monitor,
  Maximize2,
  QrCode,
  Download,
  Box
} from 'lucide-react';

export default function TvManagerTab() {
  const { tvMediaList, storeInfo, updateStoreInfo, addTvMedia, updateTvMedia, deleteTvMedia, categories, products } = useStore();

  const [copied, setCopied] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TvMediaItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<TvMediaItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Settings Form State
  const [tvMode, setTvMode] = useState<'fullscreen_media' | 'split_menu' | 'split_orders'>(
    storeInfo.tvMode || 'split_menu'
  );
  const [tvTickerText, setTvTickerText] = useState(
    storeInfo.tvTickerText || '🥟 Salgados fresquinhos saindo a toda hora! Experimente nossos salgados especiais e bebidas geladas. Peça pelo app ou no balcão!'
  );
  const [tvSoundEnabled, setTvSoundEnabled] = useState(storeInfo.tvSoundEnabled || false);
  const [tvShowClock, setTvShowClock] = useState(storeInfo.tvShowClock !== false);
  const [tvShowCaptions, setTvShowCaptions] = useState(storeInfo.tvShowCaptions || false);
  
  // Parse categories helper
  const parseSelectedCategories = (val: any): string[] => {
    if (Array.isArray(val) && val.length > 0) return val;
    if (typeof val === 'string' && val !== '[]' && val !== '') {
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    try {
      const saved = localStorage.getItem('donamara_tv_selected_categories');
      if (saved && saved !== '[]') {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return Array.isArray(val) ? val : [];
  };

  const [tvSelectedCategories, setTvSelectedCategories] = useState<string[]>(() => 
    parseSelectedCategories(storeInfo.tvSelectedCategories)
  );

  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Filter valid in-store categories
  const validCategories = (Array.isArray(categories) ? categories : [])
    .filter(c => c && c.id && typeof c.name === 'string' && c.isVisible !== false && c.availableInStore !== false)
    .sort((a, b) => {
      if (a.order !== undefined && b.order !== undefined && a.order !== b.order) {
        return a.order - b.order;
      }
      return (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' });
    });

  useEffect(() => {
    if (storeInfo) {
      setTvMode(storeInfo.tvMode || 'split_menu');
      if (storeInfo.tvTickerText !== undefined) setTvTickerText(storeInfo.tvTickerText);
      if (storeInfo.tvSoundEnabled !== undefined) setTvSoundEnabled(storeInfo.tvSoundEnabled);
      if (storeInfo.tvShowClock !== undefined) setTvShowClock(storeInfo.tvShowClock);
      if (storeInfo.tvShowCaptions !== undefined) setTvShowCaptions(storeInfo.tvShowCaptions);
      if (storeInfo.tvSelectedCategories !== undefined) {
        setTvSelectedCategories(parseSelectedCategories(storeInfo.tvSelectedCategories));
      }
    }
  }, [storeInfo.tvMode, storeInfo.tvTickerText, storeInfo.tvSoundEnabled, storeInfo.tvShowClock, storeInfo.tvShowCaptions, storeInfo.tvSelectedCategories]);

  const toggleCategorySelection = async (catId: string) => {
    let updated: string[];
    // If currently all are active (empty array), starting a selective filter means all valid except this toggle
    if (tvSelectedCategories.length === 0) {
      updated = validCategories.map(c => c.id).filter(id => id !== catId);
    } else if (tvSelectedCategories.includes(catId)) {
      updated = tvSelectedCategories.filter(id => id !== catId);
    } else {
      updated = [...tvSelectedCategories, catId];
    }
    
    // If all are selected, simplify to empty array (meaning all)
    if (updated.length >= validCategories.length) {
      updated = [];
    }

    setTvSelectedCategories(updated);
    try {
      localStorage.setItem('donamara_tv_selected_categories', JSON.stringify(updated));
    } catch {}

    // Auto-save immediately to store and backend
    try {
      await updateStoreInfo({ tvSelectedCategories: updated });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (e) {
      console.error('Error auto-saving category selection:', e);
    }
  };

  const handleSelectAllCategories = async () => {
    setTvSelectedCategories([]); // Empty array represents all categories
    try {
      localStorage.setItem('donamara_tv_selected_categories', '[]');
    } catch {}
    try {
      await updateStoreInfo({ tvSelectedCategories: [] });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (e) {
      console.error('Error auto-saving category selection:', e);
    }
  };

  const handleModeChange = async (newMode: 'fullscreen_media' | 'split_menu' | 'split_orders') => {
    setTvMode(newMode);
    try {
      await updateStoreInfo({ tvMode: newMode });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (e) {
      console.error('Error saving mode:', e);
    }
  };

  // New/Edit Media Modal Form State
  const [mediaTitle, setMediaTitle] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'youtube' | 'video'>('youtube');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaDuration, setMediaDuration] = useState(15);
  const [mediaShowCaptions, setMediaShowCaptions] = useState(false);
  const [mediaFitMode, setMediaFitMode] = useState<'fit' | 'vertical_smartphone' | 'cover'>('cover');
  const [mediaIsActive, setMediaIsActive] = useState(true);
  const [isSavingMedia, setIsSavingMedia] = useState(false);

  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const videoFileInputRef = useRef<HTMLInputElement>(null);

  // Preview Modal State
  const [previewItem, setPreviewItem] = useState<TvMediaItem | null>(null);
  
  // TV Box APK & Setup Modal State
  const [isApkModalOpen, setIsApkModalOpen] = useState(false);
  const [tvQrCodeUrl, setTvQrCodeUrl] = useState<string>('');

  const tvUrl = typeof window !== 'undefined' ? `${window.location.origin}/tv` : '/tv';
  const tvManifestUrl = typeof window !== 'undefined' ? `${window.location.origin}/manifest-tv.json` : '/manifest-tv.json';
  const pwaBuilderUrl = `https://www.pwabuilder.com?url=${encodeURIComponent(tvUrl)}`;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      QRCode.toDataURL(tvUrl, {
        width: 260,
        margin: 2,
        color: {
          dark: '#1c1917',
          light: '#ffffff'
        }
      }).then(url => {
        setTvQrCodeUrl(url);
      }).catch(err => {
        console.error('Error generating TV QR code:', err);
      });
    }
  }, [tvUrl]);

  const copyTvUrl = () => {
    navigator.clipboard.writeText(tvUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      await updateStoreInfo({
        tvMode,
        tvTickerText,
        tvSoundEnabled,
        tvShowClock,
        tvShowCaptions,
        tvSelectedCategories
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving TV settings:', err);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const openAddModal = () => {
    setEditingItem(null);
    setMediaTitle('');
    setMediaType('youtube');
    setMediaUrl('');
    setMediaDuration(15);
    setMediaShowCaptions(false);
    setMediaFitMode('cover');
    setMediaIsActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (item: TvMediaItem) => {
    setEditingItem(item);
    setMediaTitle(item.title);
    setMediaType(item.type === 'video' ? 'video' : item.type === 'image' ? 'image' : 'youtube');
    setMediaUrl(item.url);
    setMediaDuration(item.durationSeconds || 15);
    setMediaShowCaptions(item.showCaptions || false);
    setMediaFitMode(item.fitMode || (item.url?.includes('/shorts/') ? 'vertical_smartphone' : 'fit'));
    setMediaIsActive(item.isActive);
    setIsModalOpen(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          const resultStr = ev.target.result as string;
          setMediaUrl(resultStr);
          setMediaType('image');
          if (!mediaTitle) {
            setMediaTitle(file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, ' '));
          }

          // Detect aspect ratio of uploaded image
          const img = new Image();
          img.onload = () => {
            if (img.naturalHeight > img.naturalWidth * 1.1) {
              setMediaFitMode('vertical_smartphone');
            }
          };
          img.src = resultStr;
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('video/')) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          const resultStr = ev.target.result as string;
          setMediaUrl(resultStr);
          setMediaType('video');
          if (!mediaTitle) {
            setMediaTitle(file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, ' '));
          }

          // Detect video dimensions and duration to optimize automatically for smartphone videos
          const tempVid = document.createElement('video');
          tempVid.preload = 'metadata';
          tempVid.onloadedmetadata = () => {
            // If recorded vertically on smartphone (height > width)
            if (tempVid.videoHeight > tempVid.videoWidth * 1.05) {
              setMediaFitMode('vertical_smartphone');
            }
            if (tempVid.duration && isFinite(tempVid.duration) && tempVid.duration > 0) {
              setMediaDuration(Math.min(Math.ceil(tempVid.duration), 300));
            }
          };
          tempVid.src = resultStr;
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveMedia = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = mediaTitle.trim();
    let cleanUrl = mediaUrl.trim().replace(/['"]/g, '');
    if (!cleanTitle || !cleanUrl) return;

    let finalType: 'youtube' | 'image' | 'video' = mediaType === 'video' ? 'video' : mediaType === 'image' ? 'image' : 'youtube';
    
    if (cleanUrl.startsWith('data:image') || /\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i.test(cleanUrl)) {
      finalType = 'image';
    } else if (cleanUrl.startsWith('data:video') || /\.(mp4|webm|mov|m4v|avi|mkv)(\?.*)?$/i.test(cleanUrl)) {
      finalType = 'video';
    } else if (mediaType === 'youtube' || extractYouTubeId(cleanUrl)) {
      finalType = 'youtube';
      const ytId = extractYouTubeId(cleanUrl);
      if (ytId) {
        cleanUrl = `https://www.youtube.com/watch?v=${ytId}`;
      }
    }

    // Auto-detect vertical/smartphone if url contains shorts
    let finalFitMode = mediaFitMode;
    if (cleanUrl.includes('/shorts/') && finalFitMode === 'fit') {
      finalFitMode = 'vertical_smartphone';
    }

    setIsSavingMedia(true);
    try {
      if (editingItem) {
        await updateTvMedia(editingItem.id, {
          title: cleanTitle,
          type: finalType,
          url: cleanUrl,
          durationSeconds: Number(mediaDuration) || 15,
          showCaptions: mediaShowCaptions,
          fitMode: finalFitMode,
          isActive: mediaIsActive
        });
      } else {
        await addTvMedia({
          title: cleanTitle,
          type: finalType,
          url: cleanUrl,
          durationSeconds: Number(mediaDuration) || 15,
          order: (tvMediaList?.length || 0) + 1,
          showCaptions: mediaShowCaptions,
          fitMode: finalFitMode,
          isActive: mediaIsActive
        });
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error('Error saving media:', err);
    } finally {
      setIsSavingMedia(false);
    }
  };

  const handleMoveOrder = async (item: TvMediaItem, direction: 'up' | 'down') => {
    const sorted = [...tvMediaList].sort((a, b) => (a.order || 0) - (b.order || 0));
    const index = sorted.findIndex(m => m.id === item.id);
    if (index < 0) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === sorted.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const currentMedia = sorted[index];
    const targetMedia = sorted[targetIndex];

    const tempOrder = currentMedia.order ?? index;
    await updateTvMedia(currentMedia.id, { order: targetMedia.order ?? targetIndex });
    await updateTvMedia(targetMedia.id, { order: tempOrder });
  };

  const handleToggleActive = async (item: TvMediaItem) => {
    await updateTvMedia(item.id, { isActive: !item.isActive });
  };

  const handleDeleteClick = (item: TvMediaItem) => {
    setItemToDelete(item);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      await deleteTvMedia(itemToDelete.id);
      setItemToDelete(null);
    } catch (err) {
      console.error('Error during deletion:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const sortedMedia = [...(tvMediaList || [])].sort((a, b) => (a.order || 0) - (b.order || 0));

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-stone-900 via-stone-850 to-stone-900 text-white rounded-2xl p-6 border border-stone-800 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Tv className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                Smart TV & Mídia Indoor
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold uppercase">
                  Ao Vivo
                </span>
              </h2>
              <p className="text-stone-400 text-sm">
                Exiba vídeos institucionais, novidades, ofertas e chamadas de pedidos na TV da sua loja.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setIsApkModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-bold text-sm shadow-md transition-all active:scale-95 border border-emerald-500/30"
          >
            <Smartphone className="w-4 h-4 text-emerald-200" />
            <span>Instalar em TV Box / APK</span>
          </button>

          <button
            type="button"
            onClick={copyTvUrl}
            className="flex items-center gap-2 px-4 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl font-bold text-sm border border-stone-700 transition-colors shadow-sm"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Link Copiado!' : 'Copiar Link da TV'}
          </button>

          <a
            href="/tv"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-stone-950 rounded-xl font-extrabold text-sm transition-transform active:scale-95 shadow-lg shadow-amber-500/20"
          >
            <ExternalLink className="w-4 h-4" />
            Abrir na TV
          </a>
        </div>
      </div>

      {/* Guide Box for Smart TV & TV Box Setup */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 bg-amber-50/70 border border-amber-200/80 rounded-2xl p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-amber-900">Como conectar na Smart TV da Loja:</h4>
            <p className="text-xs text-amber-800 leading-relaxed">
              1. Abra o navegador web da sua Smart TV ou TV Box.<br/>
              2. Digite o endereço: <strong className="font-mono text-amber-950 bg-amber-200/60 px-1.5 py-0.5 rounded">{tvUrl}</strong><br/>
              3. Pressione a tecla <strong>Enter</strong> ou <strong>F</strong> no controle remoto para tela cheia contínua 24h sem desligar.
            </p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-5 flex flex-col justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Box className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-emerald-950">App para TV Box (Android)</h4>
              <p className="text-xs text-emerald-800 mt-0.5">
                Instale como APK nativo ou PWA para abrir direto ao ligar a TV.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsApkModalOpen(true)}
            className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Ver Opções de APK e Instalação
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left 2 Cols: Playlist Management */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-stone-800 flex items-center gap-2">
                <Film className="w-5 h-5 text-amber-600" />
                Playlist de Vídeos & Banners ({sortedMedia.length})
              </h3>
              <p className="text-xs text-stone-500">Mídias em rotação contínua na tela da TV</p>
            </div>

            <button
              type="button"
              onClick={openAddModal}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-sm shadow-md transition-colors"
            >
              <Plus className="w-4 h-4" />
              Adicionar Mídia
            </button>
          </div>

          {/* Info Banner for YouTube */}
          <div className="bg-gradient-to-r from-red-50 via-amber-50 to-orange-50 border border-red-200/80 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-600 text-white flex items-center justify-center shadow-sm shrink-0">
                <Youtube className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-stone-800">Suporte Completo a Vídeos do YouTube na TV</p>
                <p className="text-stone-600">
                  Basta clicar em <strong>"Adicionar Mídia"</strong> e colar qualquer link de vídeo do YouTube (<code className="bg-white/80 px-1 py-0.5 rounded font-mono text-[11px]">youtube.com/watch?v=...</code>, link curto <code className="bg-white/80 px-1 py-0.5 rounded font-mono text-[11px]">youtu.be/...</code> ou Shorts).
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={openAddModal}
              className="shrink-0 px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors shadow-sm text-xs flex items-center gap-1.5 self-end md:self-center"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar Vídeo
            </button>
          </div>

          {/* Media List */}
          <div className="space-y-3">
            {sortedMedia.length === 0 ? (
              <div className="bg-white border-2 border-dashed border-stone-300 rounded-2xl p-10 text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center mx-auto">
                  <Tv className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-stone-800">Nenhum vídeo personalizado cadastrado</h4>
                  <p className="text-xs text-stone-500 max-w-md mx-auto mt-1">
                    A TV está exibindo no momento a apresentação padrão com fotos e destaques da loja. Clique no botão acima para adicionar seus próprios vídeos institucionais ou banners promocionais!
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openAddModal}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-xl font-bold text-xs hover:bg-orange-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Cadastrar Primeiro Vídeo
                </button>
              </div>
            ) : (
              sortedMedia.map((item, idx) => (
                <div
                  key={item.id}
                  className={`bg-white border rounded-2xl p-4 flex items-center gap-4 transition-all shadow-sm ${
                    item.isActive ? 'border-stone-200 hover:border-amber-400' : 'border-stone-200 opacity-60 bg-stone-50'
                  }`}
                >
                  {/* Order Number & Move Buttons */}
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveOrder(item, 'up')}
                      className="p-1 text-stone-400 hover:text-stone-700 disabled:opacity-20 rounded"
                      title="Mover para Cima"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-bold text-stone-500 font-mono">#{idx + 1}</span>
                    <button
                      type="button"
                      disabled={idx === sortedMedia.length - 1}
                      onClick={() => handleMoveOrder(item, 'down')}
                      className="p-1 text-stone-400 hover:text-stone-700 disabled:opacity-20 rounded"
                      title="Mover para Baixo"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Thumbnail / Icon */}
                  <div className="w-20 h-14 rounded-xl bg-stone-900 overflow-hidden shrink-0 relative flex items-center justify-center border border-stone-200 shadow-inner">
                    {item.type === 'youtube' && extractYouTubeId(item.url) ? (
                      <div className="relative w-full h-full">
                        <img 
                          src={`https://img.youtube.com/vi/${extractYouTubeId(item.url)}/hqdefault.jpg`} 
                          alt={item.title} 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                          }}
                        />
                        <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
                          <Youtube className="w-6 h-6 text-red-500 drop-shadow-md" />
                        </div>
                      </div>
                    ) : item.type === 'video' || item.url?.startsWith('data:video') || item.url?.startsWith('blob:') ? (
                      <div className="flex flex-col items-center justify-center text-blue-400 bg-blue-950/30 w-full h-full">
                        <Film className="w-6 h-6 text-blue-400" />
                        <span className="text-[9px] font-black text-blue-300 uppercase tracking-wider mt-0.5">MP4 / Vídeo</span>
                      </div>
                    ) : item.type === 'image' && item.url ? (
                      <img src={item.url} alt={item.title} className="w-full h-full object-cover" />
                    ) : item.type === 'youtube' ? (
                      <div className="flex flex-col items-center justify-center text-red-500">
                        <Youtube className="w-7 h-7" />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-amber-400">
                        <Film className="w-7 h-7" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-stone-900 truncate">{item.title}</h4>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        item.type === 'video' ? 'bg-blue-100 text-blue-800' :
                        item.type === 'youtube' ? 'bg-red-100 text-red-800' : 'bg-purple-100 text-purple-800'
                      }`}>
                        {item.type === 'video' ? 'Vídeo Direto' : item.type === 'youtube' ? 'YouTube' : 'Banner / Imagem'}
                      </span>
                      {item.fitMode === 'vertical_smartphone' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 flex items-center gap-1">
                          <Smartphone className="w-3 h-3" />
                          Celular / Vertical
                        </span>
                      )}
                      {item.fitMode === 'cover' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 flex items-center gap-1">
                          <Maximize2 className="w-3 h-3" />
                          Preenchimento Total
                        </span>
                      )}
                      {item.type === 'youtube' && (
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                          item.showCaptions ? 'bg-amber-100 text-amber-800' : 'bg-stone-100 text-stone-600'
                        }`}>
                          <Subtitles className="w-3 h-3" />
                          {item.showCaptions ? 'Com Legenda' : 'Sem Legenda'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-stone-500 truncate font-mono mt-0.5">{item.url}</p>
                    <div className="flex items-center gap-4 text-xs text-stone-400 mt-1">
                      <span>Duração: <strong className="text-stone-700">{item.durationSeconds || 15}s</strong></span>
                      <span>•</span>
                      <span className={item.isActive ? 'text-emerald-600 font-medium' : 'text-stone-400'}>
                        {item.isActive ? 'Ativo na Playlist' : 'Pausado'}
                      </span>
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setPreviewItem(item)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-xs font-bold transition-colors"
                      title="Assistir / Testar Prévia"
                    >
                      <Play className="w-3.5 h-3.5 fill-current text-amber-700" />
                      Testar
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleActive(item)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                        item.isActive 
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' 
                          : 'bg-stone-200 text-stone-700 hover:bg-stone-300'
                      }`}
                    >
                      {item.isActive ? 'Ativo' : 'Inativo'}
                    </button>

                    <button
                      type="button"
                      onClick={() => openEditModal(item)}
                      className="p-2 text-stone-600 hover:bg-stone-100 rounded-xl transition-colors text-xs font-medium"
                    >
                      Editar
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteClick(item)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right 1 Col: TV Display Settings */}
        <div className="space-y-6">
          <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm space-y-5">
            <div>
              <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-orange-600" />
                Configurações da Tela
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">Personalize o layout e visual da TV</p>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              
              {/* Display Mode Selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-2">
                  Modo de Exibição
                </label>
                <div className="space-y-2">
                  <label className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                    tvMode === 'fullscreen_media' 
                      ? 'border-orange-500 bg-orange-50/70 ring-2 ring-orange-500/20 shadow-sm' 
                      : 'border-stone-200 hover:bg-stone-50'
                  }`}>
                    <input
                      type="radio"
                      name="tvMode"
                      value="fullscreen_media"
                      checked={tvMode === 'fullscreen_media'}
                      onChange={() => handleModeChange('fullscreen_media')}
                      className="mt-1 text-orange-600 focus:ring-orange-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-stone-900 block">Tela Cheia (Vídeos & Banners)</span>
                        {tvMode === 'fullscreen_media' && (
                          <span className="text-[10px] bg-orange-600 text-white font-bold px-2 py-0.5 rounded-full">Ativo</span>
                        )}
                      </div>
                      <span className="text-xs text-stone-500 mt-0.5 block">Vídeos e fotos ocupando 100% da tela para máximo impacto visual.</span>
                    </div>
                  </label>

                  <label className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                    tvMode === 'split_menu' 
                      ? 'border-orange-500 bg-orange-50/70 ring-2 ring-orange-500/20 shadow-sm' 
                      : 'border-stone-200 hover:bg-stone-50'
                  }`}>
                    <input
                      type="radio"
                      name="tvMode"
                      value="split_menu"
                      checked={tvMode === 'split_menu'}
                      onChange={() => handleModeChange('split_menu')}
                      className="mt-1 text-orange-600 focus:ring-orange-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-stone-900 block">Vídeo + Cardápio Rotativo (10s por Categoria)</span>
                        {tvMode === 'split_menu' && (
                          <span className="text-[10px] bg-orange-600 text-white font-bold px-2 py-0.5 rounded-full">Ativo</span>
                        )}
                      </div>
                      <span className="text-xs text-stone-500 mt-0.5 block">Vídeos ao lado com os produtos e preços alternando automaticamente de 10 em 10 segundos na sequência de categorias.</span>
                    </div>
                  </label>

                  {/* Category Selection for Split Menu */}
                  {tvMode === 'split_menu' && (
                    <div className="p-3.5 bg-orange-50/80 rounded-xl border border-orange-200 space-y-2.5 animate-fade-in">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Layers className="w-4 h-4 text-orange-600" />
                          <span className="text-xs font-black uppercase tracking-wider text-orange-950">
                            Categorias Exibidas na TV
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleSelectAllCategories}
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                            tvSelectedCategories.length === 0 || tvSelectedCategories.length === validCategories.length
                              ? 'bg-orange-600 text-white shadow-xs'
                              : 'bg-white text-orange-800 border border-orange-300 hover:bg-orange-100'
                          }`}
                        >
                          {tvSelectedCategories.length === 0 || tvSelectedCategories.length === validCategories.length
                            ? '✓ Exibir Todas'
                            : 'Marcar Todas'}
                        </button>
                      </div>

                      <p className="text-[11px] text-orange-800 leading-tight">
                        Marque quais categorias devem alternar ao lado do vídeo na TV:
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                        {validCategories.map(cat => {
                          const isChecked = tvSelectedCategories.length === 0 || tvSelectedCategories.includes(cat.id);
                          const count = (products || []).filter(p => p.categoryId === cat.id && p.isActive !== false && p.availableInStore !== false).length;

                          return (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => toggleCategorySelection(cat.id)}
                              className={`flex items-center justify-between p-2 rounded-lg text-left transition-all text-xs border cursor-pointer ${
                                isChecked
                                  ? 'bg-white border-orange-500 text-orange-950 font-bold shadow-xs'
                                  : 'bg-stone-100 border-stone-200 text-stone-400 opacity-60 hover:opacity-100'
                              }`}
                            >
                              <span className="truncate flex items-center gap-1.5">
                                <span className={`w-4 h-4 rounded flex items-center justify-center text-[10px] shrink-0 ${
                                  isChecked ? 'bg-orange-600 text-white font-black' : 'border border-stone-400 bg-white'
                                }`}>
                                  {isChecked ? '✓' : ''}
                                </span>
                                <span className="truncate">{cat.name}</span>
                              </span>
                              <span className="text-[10px] text-stone-400 font-normal shrink-0 ml-1">
                                {count} itens
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="text-[10px] text-orange-900 font-semibold pt-1 border-t border-orange-200/80 flex items-center justify-between">
                        <span>
                          {tvSelectedCategories.length === 0 
                            ? `Exibindo todas as ${validCategories.length} categorias` 
                            : `Exibindo ${tvSelectedCategories.length} de ${validCategories.length} categorias`}
                        </span>
                        <span className="bg-orange-200/60 px-2 py-0.5 rounded text-orange-900">
                          10s por categoria
                        </span>
                      </div>
                    </div>
                  )}

                  <label className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                    tvMode === 'split_orders' 
                      ? 'border-orange-500 bg-orange-50/70 ring-2 ring-orange-500/20 shadow-sm' 
                      : 'border-stone-200 hover:bg-stone-50'
                  }`}>
                    <input
                      type="radio"
                      name="tvMode"
                      value="split_orders"
                      checked={tvMode === 'split_orders'}
                      onChange={() => handleModeChange('split_orders')}
                      className="mt-1 text-orange-600 focus:ring-orange-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-stone-900 block">Vídeo + Chamada de Senhas</span>
                        {tvMode === 'split_orders' && (
                          <span className="text-[10px] bg-orange-600 text-white font-bold px-2 py-0.5 rounded-full">Ativo</span>
                        )}
                      </div>
                      <span className="text-xs text-stone-500 mt-0.5 block">Vídeo ao lado com painel de pedidos "Pronto para Retirada" e "Em Preparação".</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Ticker Text */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                  Texto do Letreiro Rodapé (Ticker)
                </label>
                <textarea
                  rows={3}
                  value={tvTickerText}
                  onChange={(e) => setTvTickerText(e.target.value)}
                  placeholder="Ex: 🥖 Pães quentinhos saindo a cada 20 minutos! Experimente nossa broa e cafés especiais..."
                  className="w-full p-3 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                />
                <p className="text-[10px] text-stone-400 mt-1">Este texto desliza continuamente na barra inferior da TV.</p>
              </div>

              {/* Sound, Clock & Subtitles Toggles */}
              <div className="pt-2 border-t border-stone-100 space-y-3">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm font-medium text-stone-800 flex items-center gap-2">
                    {tvSoundEnabled ? <Volume2 className="w-4 h-4 text-emerald-600" /> : <VolumeX className="w-4 h-4 text-stone-400" />}
                    Áudio & Som de Chamada (Ding-Dong)
                  </span>
                  <input
                    type="checkbox"
                    checked={tvSoundEnabled}
                    onChange={(e) => setTvSoundEnabled(e.target.checked)}
                    className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm font-medium text-stone-800 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-stone-500" />
                    Exibir Relógio & Logo no Topo
                  </span>
                  <input
                    type="checkbox"
                    checked={tvShowClock}
                    onChange={(e) => setTvShowClock(e.target.checked)}
                    className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm font-medium text-stone-800 flex items-center gap-2">
                    <Subtitles className="w-4 h-4 text-stone-500" />
                    Legendas nos Vídeos do YouTube (Padrão)
                  </span>
                  <input
                    type="checkbox"
                    checked={tvShowCaptions}
                    onChange={(e) => setTvShowCaptions(e.target.checked)}
                    className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                  />
                </label>
              </div>

              {/* Quick Test TV Call Button */}
              <div className="p-3.5 bg-amber-50 border border-amber-200/80 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <Megaphone className="w-3.5 h-3.5 text-amber-700" />
                    Teste da Chamada de Pedidos
                  </span>
                </div>
                <p className="text-[11px] text-amber-800 leading-tight">
                  Envia uma notificação de teste com som e banner na TV conectada.
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await fetch('/api/db/tv-call-order', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          orderNumber: '99',
                          customerName: 'Cliente Teste',
                          type: 'balcao'
                        })
                      });
                      alert('Chamada de teste enviada para a Smart TV!');
                    } catch (e) {
                      console.error(e);
                    }
                  }}
                  className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-stone-950 rounded-lg text-xs font-black transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <Megaphone className="w-3.5 h-3.5" />
                  Testar Chamada na TV Agora
                </button>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSavingSettings}
                  className="w-full py-3 bg-stone-900 hover:bg-stone-800 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  {isSavingSettings ? (
                    <>
                      <Clock className="w-4 h-4 animate-spin" />
                      Salvando...
                    </>
                  ) : saveSuccess ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      Configurações Atualizadas!
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Salvar Configurações da TV
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Modal: Add / Edit Media */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[92vh] shadow-2xl flex flex-col border border-stone-200 overflow-hidden">
            {/* Modal Header (Fixed at top) */}
            <div className="px-5 sm:px-6 py-4 border-b border-stone-100 flex items-center justify-between shrink-0 bg-stone-50/80">
              <h3 className="text-base sm:text-lg font-black text-stone-900 flex items-center gap-2">
                <Film className="w-5 h-5 text-orange-600" />
                {editingItem ? 'Editar Mídia da TV' : 'Adicionar Novo Vídeo ou Banner'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-stone-200/60 hover:bg-stone-200 text-stone-600 hover:text-stone-900 flex items-center justify-center text-sm font-bold transition-colors cursor-pointer"
                title="Fechar"
              >
                ✕
              </button>
            </div>

            {/* Modal Body & Form (Scrollable with prominent lateral cursor) */}
            <form onSubmit={handleSaveMedia} id="media-form" className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="px-5 sm:px-6 py-4 overflow-y-auto flex-1 space-y-4 custom-scrollbar">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                    Título / Nome da Mídia
                  </label>
                  <input
                    type="text"
                    required
                    value={mediaTitle}
                    onChange={(e) => setMediaTitle(e.target.value)}
                    placeholder="Ex: Vídeo Institucional DONAMARA ou Banner Salgados Especiais"
                    className="w-full p-3 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                    Tipo de Mídia
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setMediaType('youtube')}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                        mediaType === 'youtube' ? 'border-red-500 bg-red-50 text-red-700 ring-2 ring-red-400/20 shadow-xs' : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                      }`}
                    >
                      <Youtube className="w-5 h-5 text-red-600" />
                      YouTube
                    </button>

                    <button
                      type="button"
                      onClick={() => setMediaType('video')}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                        mediaType === 'video' ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-400/20 shadow-xs' : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                      }`}
                    >
                      <Film className="w-5 h-5 text-blue-600" />
                      Vídeo do Celular / MP4
                    </button>

                    <button
                      type="button"
                      onClick={() => setMediaType('image')}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                        mediaType === 'image' ? 'border-purple-500 bg-purple-50 text-purple-700 ring-2 ring-purple-400/20 shadow-xs' : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                      }`}
                    >
                      <ImageIcon className="w-5 h-5 text-purple-600" />
                      Banner / Imagem
                    </button>
                  </div>
                </div>

                {/* YOUTUBE SECTION */}
                {mediaType === 'youtube' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                        Link do Vídeo no YouTube
                      </label>
                      <input
                        type="text"
                        required
                        value={mediaUrl}
                        onChange={(e) => {
                          const val = e.target.value;
                          setMediaUrl(val);
                          const yt = extractYouTubeId(val);
                          if (yt) {
                            setMediaType('youtube');
                          }
                        }}
                        placeholder="Cole o link do YouTube (Ex: https://www.youtube.com/watch?v=... ou youtu.be/...)"
                        className="w-full p-3 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 outline-none"
                      />

                      {/* Live YouTube Detection & Preview */}
                      {extractYouTubeId(mediaUrl) && (
                        <div className="mt-2.5 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 animate-fade-in">
                          <div className="w-16 h-10 rounded-lg overflow-hidden bg-stone-900 shrink-0 relative">
                            <img 
                              src={`https://img.youtube.com/vi/${extractYouTubeId(mediaUrl)}/hqdefault.jpg`} 
                              alt="Preview"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-xs">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              Vídeo do YouTube Detectado com Sucesso!
                            </div>
                            <p className="text-[11px] text-emerald-700 font-mono truncate">
                              ID: {extractYouTubeId(mediaUrl)}
                            </p>
                          </div>
                        </div>
                      )}

                      {mediaType === 'youtube' && !extractYouTubeId(mediaUrl) && mediaUrl.trim().length > 5 && (
                        <p className="mt-1 text-xs text-amber-600 flex items-center gap-1">
                          <HelpCircle className="w-3.5 h-3.5 shrink-0" />
                          Insira um link válido do YouTube (watch, shorts, youtu.be, etc.)
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* DIRECT VIDEO / SMARTPHONE VIDEO SECTION */}
                {mediaType === 'video' && (
                  <div className="space-y-3 p-4 bg-blue-50/50 border border-blue-200 rounded-2xl animate-fade-in">
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-amber-900">Atenção ao Consumo de Dados (Internet)</p>
                          <p className="text-xs text-amber-800 leading-relaxed">
                            O upload direto de vídeos consome muita internet e pode deixar o carregamento da TV lento. 
                            <strong> Recomendamos fortemente usar links do YouTube</strong> para economizar banda e garantir performance 24h.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold uppercase tracking-wider text-blue-950 flex items-center gap-1.5">
                        <Smartphone className="w-4 h-4 text-blue-600" />
                        Vídeo do Celular / Arquivo de Vídeo
                      </label>
                      <label className="cursor-pointer px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-xs">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Selecionar Vídeo do Celular</span>
                        <input 
                          ref={videoFileInputRef}
                          type="file" 
                          accept="video/*" 
                          onChange={handleVideoUpload} 
                          className="hidden" 
                        />
                      </label>
                    </div>

                    <input
                      type="text"
                      required
                      value={mediaUrl}
                      onChange={(e) => setMediaUrl(e.target.value)}
                      placeholder="Cole o link do vídeo (.mp4, .mov, link direto) ou clique acima para carregar do celular"
                      className="w-full p-3 border border-stone-300 bg-white rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                    />

                    {mediaUrl && (
                      <div className="relative h-44 w-full rounded-xl overflow-hidden bg-black border border-stone-300 flex items-center justify-center">
                        <video 
                          src={mediaUrl} 
                          controls 
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                    )}
                    <p className="text-[11px] text-blue-800 leading-tight">
                      💡 <strong>Dica para Celular:</strong> Vídeos gravados na vertical são ampliados automaticamente para ocupar 100% da altura da TV, com fundo ambiente desfocado dinâmico para não ficarem pequenos!
                    </p>
                  </div>
                )}

                {/* IMAGE / BANNER SECTION */}
                {mediaType === 'image' && (
                  <div className="space-y-3 p-4 bg-purple-50/40 border border-purple-200/80 rounded-2xl">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold uppercase tracking-wider text-purple-950 flex items-center gap-1.5">
                        <ImageIcon className="w-4 h-4 text-purple-600" />
                        Imagem / Banner da TV
                      </label>
                      <label className="cursor-pointer px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-xs">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload de Imagem</span>
                        <input 
                          ref={imageFileInputRef}
                          type="file" 
                          accept="image/*" 
                          onChange={handleImageUpload} 
                          className="hidden" 
                        />
                      </label>
                    </div>

                    <input
                      type="text"
                      required
                      value={mediaUrl}
                      onChange={(e) => setMediaUrl(e.target.value)}
                      placeholder="Cole a URL da imagem ou clique em 'Upload de Imagem' acima"
                      className="w-full p-3 border border-stone-300 bg-white rounded-xl text-sm focus:ring-2 focus:ring-purple-500 outline-none font-mono"
                    />

                    {mediaUrl && (
                      <div className="relative h-36 w-full rounded-xl overflow-hidden bg-stone-900 border border-stone-200">
                        <img src={mediaUrl} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                    Tempo de Exibição (Segundos)
                  </label>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {[10, 15, 25, 45, 60].map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => setMediaDuration(sec)}
                        className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${
                          mediaDuration === sec
                            ? 'bg-orange-500 text-white border-orange-500 shadow-xs'
                            : 'bg-stone-100 text-stone-600 border-stone-200 hover:bg-stone-200'
                        }`}
                      >
                        {sec}s
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    min="5"
                    max="300"
                    value={mediaDuration}
                    onChange={(e) => setMediaDuration(Number(e.target.value))}
                    className="w-full p-3 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                  <p className="text-[10px] text-stone-400 mt-1">Tempo máximo que este vídeo ou banner ficará na tela antes de passar para o próximo da lista.</p>
                </div>

                {/* Video Aspect Ratio & Smartphone Optimization Selector */}
                <div className="p-3.5 bg-blue-50/70 border border-blue-200/90 rounded-2xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-blue-950 flex items-center gap-1.5">
                      <Smartphone className="w-4 h-4 text-blue-600" />
                      Enquadramento & Tamanho na TV
                    </label>
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                      mediaFitMode === 'vertical_smartphone'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : mediaFitMode === 'cover'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-stone-200 text-stone-700'
                    }`}>
                      {mediaFitMode === 'vertical_smartphone' ? '📱 Celular / Vertical (9:16)' : mediaFitMode === 'cover' ? '🔍 Preencher Tudo' : '📺 16:9 Padrão'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setMediaFitMode('vertical_smartphone')}
                      className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                        mediaFitMode === 'vertical_smartphone'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-400/30'
                          : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        <Smartphone className={`w-3.5 h-3.5 shrink-0 ${mediaFitMode === 'vertical_smartphone' ? 'text-white' : 'text-blue-600'}`} />
                        <span>Gravado no Celular</span>
                      </div>
                      <p className={`text-[10px] mt-1.5 leading-tight ${mediaFitMode === 'vertical_smartphone' ? 'text-blue-100' : 'text-stone-500'}`}>
                        Amplia proporcionalmente o vídeo vertical para preencher a altura da TV com fundo ambiente suave, sem ficar pequeno no meio.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMediaFitMode('fit')}
                      className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                        mediaFitMode === 'fit'
                          ? 'bg-stone-900 text-white border-stone-900 shadow-sm ring-2 ring-stone-400/30'
                          : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        <Monitor className={`w-3.5 h-3.5 shrink-0 ${mediaFitMode === 'fit' ? 'text-white' : 'text-stone-700'}`} />
                        <span>Horizontal 16:9</span>
                      </div>
                      <p className={`text-[10px] mt-1.5 leading-tight ${mediaFitMode === 'fit' ? 'text-stone-300' : 'text-stone-500'}`}>
                        Enquadramento tradicional padrão para vídeos gravados na horizontal ou banners.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMediaFitMode('cover')}
                      className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                        mediaFitMode === 'cover'
                          ? 'bg-amber-600 text-white border-amber-600 shadow-sm ring-2 ring-amber-400/30'
                          : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        <Maximize2 className={`w-3.5 h-3.5 shrink-0 ${mediaFitMode === 'cover' ? 'text-white' : 'text-amber-600'}`} />
                        <span>Preencher Tudo</span>
                      </div>
                      <p className={`text-[10px] mt-1.5 leading-tight ${mediaFitMode === 'cover' ? 'text-amber-100' : 'text-stone-500'}`}>
                        Expande a imagem ou vídeo com zoom para cobrir 100% da área sem bordas laterais.
                      </p>
                    </button>
                  </div>
                </div>

                {/* YouTube Subtitles / Closed Captions Selection */}
                {mediaType === 'youtube' && (
                  <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
                        <Subtitles className="w-4 h-4 text-orange-600" />
                        Legendas do Vídeo (YouTube)
                      </label>
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                        mediaShowCaptions ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-stone-200 text-stone-700'
                      }`}>
                        {mediaShowCaptions ? 'Com Legenda' : 'Sem Legenda (Padrão)'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setMediaShowCaptions(false)}
                        className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          !mediaShowCaptions
                            ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                            : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        <span>🚫 Sem Legenda</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setMediaShowCaptions(true)}
                        className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          mediaShowCaptions
                            ? 'bg-orange-600 text-white border-orange-600 shadow-xs'
                            : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        <Subtitles className="w-3.5 h-3.5" />
                        <span>💬 Com Legenda</span>
                      </button>
                    </div>
                    <p className="text-[11px] text-stone-500 leading-tight">
                      {mediaShowCaptions
                        ? 'O player tentará carregar as legendas automáticas ou em português do YouTube.'
                        : 'Remove e bloqueia qualquer legenda automática do YouTube para não poluir a tela.'}
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1 pb-2">
                  <input
                    type="checkbox"
                    id="mediaIsActive"
                    checked={mediaIsActive}
                    onChange={(e) => setMediaIsActive(e.target.checked)}
                    className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500 cursor-pointer"
                  />
                  <label htmlFor="mediaIsActive" className="text-sm font-medium text-stone-800 cursor-pointer">
                    Mídia Ativa (Exibir na Smart TV)
                  </label>
                </div>
              </div>

              {/* Modal Footer (Fixed at bottom with always accessible buttons) */}
              <div className="px-5 sm:px-6 py-4 bg-stone-50 border-t border-stone-200/80 flex items-center justify-end gap-3 shrink-0 rounded-b-3xl">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 text-stone-600 hover:bg-stone-200/70 rounded-xl text-sm font-bold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingMedia}
                  className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-sm font-bold shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  {isSavingMedia ? 'Salvando...' : editingItem ? 'Salvar Alterações' : 'Adicionar à TV'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-stone-200">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            
            <h3 className="text-lg font-black text-stone-900 mb-1">
              Remover da Smart TV?
            </h3>
            <p className="text-stone-600 text-sm mb-6 leading-relaxed">
              Você está prestes a remover o item <strong className="text-stone-900 font-bold font-mono">"{itemToDelete.title}"</strong> da playlist de exibição. Esta ação não poderá ser desfeita.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-700 text-sm font-bold hover:bg-stone-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold shadow-md transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {isDeleting ? 'Removendo...' : 'Sim, Remover Vídeo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Media Test / Preview Modal */}
      {previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-stone-950 text-white rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl border border-stone-800 flex flex-col">
            <div className="p-4 border-b border-stone-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                <h3 className="font-bold text-sm text-stone-200 truncate max-w-md">
                  Prévia: {previewItem.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="p-1.5 text-stone-400 hover:text-white rounded-lg hover:bg-stone-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden">
              {previewItem.type === 'youtube' && extractYouTubeId(previewItem.url) ? (
                <>
                  {(previewItem.fitMode === 'vertical_smartphone' || previewItem.url?.includes('/shorts/')) && (
                    <div 
                      className="absolute inset-0 bg-cover bg-center scale-125 blur-3xl opacity-50 pointer-events-none"
                      style={{
                        backgroundImage: `url('https://img.youtube.com/vi/${extractYouTubeId(previewItem.url)}/hqdefault.jpg')`
                      }}
                    />
                  )}
                  <div className={`relative flex items-center justify-center ${
                    previewItem.fitMode === 'vertical_smartphone' || previewItem.url?.includes('/shorts/')
                      ? 'h-full max-h-full aspect-[9/16] shadow-2xl rounded-xl overflow-hidden border border-white/10'
                      : 'w-full h-full'
                  }`}>
                    <iframe
                      src={`https://www.youtube.com/embed/${extractYouTubeId(previewItem.url)}?autoplay=1&controls=1&rel=0&enablejsapi=1&cc_load_policy=${previewItem.showCaptions ? '1' : '0'}${previewItem.showCaptions ? '' : '&cc_lang_pref=none'}&hl=pt-BR&iv_load_policy=3`}
                      title={previewItem.title}
                      className={`border-0 ${
                        previewItem.fitMode === 'vertical_smartphone' || previewItem.url?.includes('/shorts/')
                          ? 'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-full aspect-video min-w-[177.78%] w-[177.78%] max-w-none'
                          : previewItem.fitMode === 'cover'
                          ? 'w-full h-full scale-125'
                          : 'w-full h-full'
                      }`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </>
              ) : previewItem.type === 'video' || previewItem.url?.startsWith('data:video') || previewItem.url?.startsWith('blob:') ? (
                <>
                  {previewItem.fitMode === 'vertical_smartphone' && (
                    <video
                      src={previewItem.url}
                      muted
                      autoPlay
                      loop
                      playsInline
                      className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-40 scale-110 pointer-events-none"
                    />
                  )}
                  <video
                    src={previewItem.url}
                    controls
                    autoPlay
                    className={`relative z-10 ${
                      previewItem.fitMode === 'vertical_smartphone'
                        ? 'h-full max-h-full aspect-[9/16] object-cover shadow-2xl rounded-xl border border-white/10'
                        : previewItem.fitMode === 'cover'
                        ? 'w-full h-full object-cover'
                        : 'w-full h-full object-contain'
                    }`}
                  />
                </>
              ) : (
                <>
                  {previewItem.fitMode === 'vertical_smartphone' && (
                    <img
                      src={previewItem.url}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-40 scale-110 pointer-events-none"
                    />
                  )}
                  <img
                    src={previewItem.url}
                    alt={previewItem.title}
                    className={`relative z-10 ${
                      previewItem.fitMode === 'vertical_smartphone'
                        ? 'h-full max-h-full aspect-[9/16] object-cover shadow-2xl rounded-xl border border-white/10'
                        : previewItem.fitMode === 'cover'
                        ? 'w-full h-full object-cover'
                        : 'w-full h-full object-contain'
                    }`}
                  />
                </>
              )}
            </div>

            <div className="p-4 border-t border-stone-800 flex items-center justify-between gap-4 bg-stone-900/60">
              <div className="text-xs text-stone-400">
                <span>Duração configurada: <strong className="text-stone-200">{previewItem.durationSeconds || 15}s</strong></span>
                <span className="mx-2">•</span>
                <span>Status: <strong className={previewItem.isActive ? 'text-emerald-400' : 'text-stone-400'}>{previewItem.isActive ? 'Ativo na TV' : 'Inativo'}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href="/tv"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Ver na Smart TV
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewItem(null)}
                  className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold rounded-xl transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* TV Box APK & Installation Modal */}
      {isApkModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto text-stone-100">
            {/* Modal Header */}
            <div className="p-6 border-b border-stone-800 flex items-center justify-between bg-stone-950/60">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Box className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">Instalar App na TV Box / Android TV</h3>
                  <p className="text-xs text-stone-400">Escolha a melhor forma para rodar os vídeos na sua TV Box</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsApkModalOpen(false)}
                className="w-10 h-10 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
              {/* QR Code & Direct URL Box */}
              <div className="p-4 bg-stone-950 rounded-2xl border border-stone-800 flex flex-col sm:flex-row items-center gap-5">
                {tvQrCodeUrl ? (
                  <div className="bg-white p-2.5 rounded-xl shrink-0 shadow-lg">
                    <img src={tvQrCodeUrl} alt="QR Code TV" className="w-32 h-32" />
                  </div>
                ) : (
                  <div className="w-32 h-32 bg-stone-800 rounded-xl flex items-center justify-center shrink-0">
                    <QrCode className="w-10 h-10 text-stone-500 animate-pulse" />
                  </div>
                )}
                <div className="space-y-2 text-center sm:text-left w-full">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">Link Direto da TV / APK</span>
                  <div className="p-2.5 bg-stone-900 rounded-xl border border-stone-800 font-mono text-xs text-amber-300 break-all select-all flex items-center justify-between gap-2">
                    <span>{tvUrl}</span>
                    <button
                      type="button"
                      onClick={copyTvUrl}
                      className="shrink-0 p-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg transition-colors"
                      title="Copiar Link"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-stone-400">
                    Aponte a câmera do celular ou digite o link no navegador da TV Box.
                  </p>
                </div>
              </div>

              {/* 3 Installation Methods */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-stone-200 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  Como rodar na TV Box (3 Opções Práticas):
                </h4>

                {/* Method 1: PWA Native WebAPK */}
                <div className="p-4 bg-stone-850 rounded-2xl border border-stone-700/70 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
                      Opção 1 (Mais Rápida e Fácil)
                    </span>
                    <span className="text-[11px] text-stone-400 font-bold">Sem instalar programas extras</span>
                  </div>
                  <h5 className="text-sm font-bold text-white">Instalar Direto pelo Navegador da TV Box (PWA / WebAPK)</h5>
                  <ol className="text-xs text-stone-300 space-y-1.5 list-decimal list-inside leading-relaxed">
                    <li>Abra o navegador da sua TV Box (<strong>Google Chrome</strong>, <strong>Kiwi Browser</strong> ou <strong>Brave</strong>).</li>
                    <li>Digite o endereço <strong className="text-amber-300">{tvUrl}</strong>.</li>
                    <li>Toque no menu de <strong>3 pontinhos (⋮)</strong> no topo do navegador e clique em <strong>"Instalar Aplicativo"</strong> ou <strong>"Adicionar à Tela Inicial"</strong>.</li>
                    <li>O Android vai criar o ícone nativo do aplicativo na tela inicial da sua TV Box. Ao clicar, ele abre direto em tela cheia e paisagem!</li>
                  </ol>
                </div>

                {/* Method 2: Fully Kiosk Browser */}
                <div className="p-4 bg-stone-850 rounded-2xl border border-emerald-500/40 space-y-2.5 relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      ★ Opção 2 (Recomendada Profissional)
                    </span>
                    <span className="text-[11px] text-emerald-400 font-bold">Liga automático na tomada</span>
                  </div>
                  <h5 className="text-sm font-bold text-white">Fully Kiosk Browser (Padrão Ouro para Mídia Indoor)</h5>
                  <p className="text-xs text-stone-300 leading-relaxed">
                    O <strong>Fully Kiosk Browser</strong> é o aplicativo mais usado no mundo para painéis em TV Box comerciais. Ele faz o painel de vídeos iniciar <strong>automaticamente sozinho</strong> assim que você liga a TV Box na tomada, esconde a barra de botões do Android e impede a tela de travar.
                  </p>
                  <div className="p-3 bg-stone-900 rounded-xl border border-stone-800 text-xs text-stone-300 space-y-1.5">
                    <p><strong>1.</strong> Na Play Store da TV Box, pesquise e instale: <strong>"Fully Kiosk Browser"</strong> (ou baixe o APK em <a href="https://www.fully-kiosk.com" target="_blank" rel="noopener noreferrer" className="text-emerald-400 underline">fully-kiosk.com</a>).</p>
                    <p><strong>2.</strong> Abra o Fully Kiosk e em <strong>Start URL</strong> cole: <code className="text-amber-300 font-mono text-[11px]">{tvUrl}</code></p>
                    <p><strong>3.</strong> Ative a opção <strong>"Run on Boot"</strong> (Iniciar ao ligar a TV Box) e <strong>"Keep Screen On"</strong> (Manter tela ligada).</p>
                  </div>
                </div>

                {/* Method 3: PWABuilder APK Generator */}
                <div className="p-4 bg-stone-850 rounded-2xl border border-stone-700/70 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2.5 py-0.5 rounded-full">
                      Opção 3 (Compilar APK .apk)
                    </span>
                    <span className="text-[11px] text-stone-400 font-bold">Arquivo instalador .apk</span>
                  </div>
                  <h5 className="text-sm font-bold text-white">Gerar Arquivo APK Standalone (.apk)</h5>
                  <p className="text-xs text-stone-300 leading-relaxed">
                    Nossa aplicação já conta com o arquivo de manifesto oficial para TV (<code className="text-stone-400 font-mono text-[11px]">/manifest-tv.json</code>). Você pode gerar um arquivo <code className="text-emerald-400 font-mono text-[11px]">.apk</code> instantaneamente pela ferramenta gratuita da Microsoft (<strong>PWABuilder</strong>) e instalar na TV Box via pendrive.
                  </p>
                  <div className="pt-1">
                    <a
                      href={pwaBuilderUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95"
                    >
                      <Download className="w-4 h-4" />
                      Gerar e Baixar APK no PWABuilder
                      <ExternalLink className="w-3.5 h-3.5 ml-1 opacity-70" />
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-stone-800 bg-stone-950 flex items-center justify-between gap-3">
              <span className="text-xs text-stone-400">
                💡 Ao cadastrar novos vídeos aqui no painel, a TV Box atualiza <strong>em tempo real</strong> sem precisar reinstalar nada!
              </span>
              <button
                type="button"
                onClick={() => setIsApkModalOpen(false)}
                className="px-5 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs rounded-xl transition-colors shrink-0"
              >
                Entendi / Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
