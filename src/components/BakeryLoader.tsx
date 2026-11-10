import React from 'react';
import { Croissant } from 'lucide-react';

interface BakeryLoaderProps {
  isLoading?: boolean;
}

export const BakeryLoader: React.FC<BakeryLoaderProps> = ({ isLoading = true }) => {
  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-50 transition-opacity duration-300">
      <div className="text-center">
        <div className="inline-block animate-bounce">
          <Croissant size={64} className="text-orange-500" />
        </div>
        <p className="mt-4 text-stone-600 font-medium font-serif italic text-lg animate-pulse">
          Preparando delícias...
        </p>
      </div>
    </div>
  );
};
