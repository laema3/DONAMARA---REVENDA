import React from 'react';
import { useStore } from '../store/useStore';

interface ProductImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  containerClassName?: string;
}

export const ProductImage: React.FC<ProductImageProps> = ({ 
  src, 
  alt, 
  className = "w-full h-full object-cover",
  containerClassName = "w-full h-full flex items-center justify-center overflow-hidden"
}) => {
  const storeLogo = useStore(state => state.storeInfo.logoUrl);
  const logoUrl = storeLogo || '/logo.svg';
  
  // Check if src is valid and not a placeholder
  const isValidSrc = src && src.trim() !== '' && !src.includes('unsplash.com');
  
  // Transform insecure HTTP URLs into secure backend proxy URLs
  let finalSrc = src;
  if (isValidSrc && src && src.startsWith('http://')) {
    finalSrc = `/api/image-proxy?url=${encodeURIComponent(src)}`;
  }
  
  const [error, setError] = React.useState(false);
  const [logoError, setLogoError] = React.useState(false);

  const handleError = () => {
    setError(true);
  };

  if (!isValidSrc || error) {
    if (!logoError) {
      return (
        <div className={`${containerClassName} bg-stone-900/5`}>
          <img 
            src={logoUrl} 
            alt={alt || "Logo DONAMARA"} 
            className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-500"
            referrerPolicy="no-referrer"
            onError={() => {
              setLogoError(true);
            }}
          />
        </div>
      );
    }
    
    return (
      <div className={`${containerClassName} bg-stone-950 p-2`}>
        <img 
          src="/logo.svg" 
          alt="DONAMARA" 
          className="w-full h-full object-contain"
        />
      </div>
    );
  }

  return (
    <div className={containerClassName}>
      <img 
        src={finalSrc!} 
        alt={alt} 
        className={className}
        onError={handleError}
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    </div>
  );
};

