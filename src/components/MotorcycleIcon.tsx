import React from 'react';

export const MotorcycleIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg 
    className={className} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2.2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    {/* Wheels */}
    <circle cx="5" cy="18" r="3" />
    <circle cx="19" cy="18" r="3" />
    {/* Frame & Body */}
    <path d="M5 15h4l3-6h3l2 3" />
    <path d="M12 9l2-3h3" />
    {/* Delivery Trunk / Box */}
    <path d="M15 10h4v5h-4z" fill="currentColor" fillOpacity="0.2" />
    <path d="M15 10h4v5h-4z" />
    {/* Rider */}
    <circle cx="9" cy="7" r="2" />
    <path d="M9 9v3l3 2" />
  </svg>
);
