import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { sendNtfyNotification } from '../utils/ntfy';
import { useStore } from '../store/useStore';

interface CustomerFormPopupProps {
  isOpen: boolean;
  onClose: () => void;
  logoUrl: string;
}

export const CustomerFormPopup: React.FC<CustomerFormPopupProps> = ({ isOpen, onClose, logoUrl }) => {
  const { storeInfo, saveCustomer } = useStore();
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const formData = new FormData(e.currentTarget);
    
    try {
      // Save lead to internal database
      await saveCustomer({
        name: name.trim(),
        phone: whatsapp.trim(),
        source: 'popup_novidades',
        tags: ['Popup', 'Lead']
      });

      // Send NTFY Notification
      sendNtfyNotification({
        enabled: storeInfo.ntfyEnabled !== false,
        topic: storeInfo.ntfyTopic || 'donamara_pedidos',
        title: `🥟 Novo Cliente Cadastrado!`,
        message: `Nome: ${name.trim()}\nWhatsApp: ${whatsapp.trim()}\nHorário: ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
        priority: 4,
        tags: ['bust_in_silhouette', 'dumpling', 'new_customer']
      }).catch(err => console.warn('NTFY error in popup:', err));

      const response = await fetch(e.currentTarget.action, {
        method: 'POST',
        body: formData,
        headers: { 'Accept': 'application/json' }
      });
      
      if (response.ok) {
        onClose();
      } else {
        alert('Erro ao enviar. Tente novamente.');
      }
    } catch (error) {
      alert('Erro ao enviar. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm relative shadow-2xl">
        <button onClick={onClose} className="absolute top-4 right-4 text-stone-400 hover:text-stone-600">
          <X className="w-6 h-6" />
        </button>
        
        <div className="flex flex-col items-center mb-6">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-20 w-auto mb-4 object-contain" referrerPolicy="no-referrer" />
          ) : null}
          <h2 className="text-xl font-bold text-stone-800 text-center">Preencha seus dados para receber novidades</h2>
        </div>

        <form action="https://formspree.io/f/xbdzbeoq" method="POST" onSubmit={handleSubmit} className="space-y-4">
          <input type="hidden" name="_subject" value="Novo cliente - DONAMARA - REVENDA" />
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Nome</label>
            <input 
              type="text" 
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-2 rounded-lg border border-stone-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">WhatsApp</label>
            <input 
              type="tel" 
              name="whatsapp"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              required
              className="w-full px-4 py-2 rounded-lg border border-stone-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
          <button 
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-orange-600 text-white font-bold py-3 rounded-lg hover:bg-orange-700 transition-colors disabled:bg-orange-400"
          >
            {isSubmitting ? 'Enviando...' : 'Enviar'}
          </button>
        </form>
      </div>
    </div>
  );
};
