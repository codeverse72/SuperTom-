import React from 'react';

export interface BiscuitSvgProps {
  biscuitId: string;
  color?: string;
  size?: number;
  className?: string;
}

export const BiscuitSvg: React.FC<BiscuitSvgProps> = ({
  biscuitId,
  color,
  size = 48,
  className = '',
}) => {
  const normId = biscuitId.toLowerCase();

  // 1. Common Biscuit: Warm honey-baked crunchy cookie with cookie docking & royal paw print
  if (normId === 'common' || normId.includes('bronze')) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`filter drop-shadow-[0_4px_8px_rgba(180,83,9,0.4)] ${className}`}
      >
        <defs>
          <linearGradient id="commonGrad" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F59E0B" />
            <stop offset="50%" stopColor="#D97706" />
            <stop offset="100%" stopColor="#92400E" />
          </linearGradient>
          <radialGradient id="commonCrust" cx="50%" cy="50%" r="50%">
            <stop offset="70%" stopColor="#FBBF24" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#78350F" stopOpacity="0.8" />
          </radialGradient>
        </defs>

        {/* Outer Crunchy Scalloped Biscuit Base */}
        <path
          d="M18 10C13.58 10 10 13.58 10 18C10 20.3 11 22.3 12.6 23.7C10.8 25.1 9.5 27.2 9.5 29.6C9.5 32 10.8 34.1 12.6 35.5C11 36.9 10 38.9 10 41.2C10 45.62 13.58 49.2 18 49.2C20.3 49.2 22.3 48.2 23.7 46.6C25.1 48.4 27.2 49.7 29.6 49.7C32 49.7 34.1 48.4 35.5 46.6C36.9 48.2 38.9 49.2 41.2 49.2C45.62 49.2 49.2 45.62 49.2 41.2C49.2 38.9 48.2 36.9 46.6 35.5C48.4 34.1 49.7 32 49.7 29.6C49.7 27.2 48.4 25.1 46.6 23.7C48.2 22.3 49.2 20.3 49.2 18C49.2 13.58 45.62 10 41.2 10C38.9 10 36.9 11 35.5 12.6C34.1 10.8 32 9.5 29.6 9.5C27.2 9.5 25.1 10.8 23.7 12.6C22.3 11 20.3 10 18 10Z"
          fill="url(#commonGrad)"
          stroke="#78350F"
          strokeWidth="1.5"
        />
        <path
          d="M18 10C13.58 10 10 13.58 10 18C10 20.3 11 22.3 12.6 23.7C10.8 25.1 9.5 27.2 9.5 29.6C9.5 32 10.8 34.1 12.6 35.5C11 36.9 10 38.9 10 41.2C10 45.62 13.58 49.2 18 49.2C20.3 49.2 22.3 48.2 23.7 46.6C25.1 48.4 27.2 49.7 29.6 49.7C32 49.7 34.1 48.4 35.5 46.6C36.9 48.2 38.9 49.2 41.2 49.2C45.62 49.2 49.2 45.62 49.2 41.2C49.2 38.9 48.2 36.9 46.6 35.5C48.4 34.1 49.7 32 49.7 29.6C49.7 27.2 48.4 25.1 46.6 23.7C48.2 22.3 49.2 20.3 49.2 18C49.2 13.58 45.62 10 41.2 10C38.9 10 36.9 11 35.5 12.6C34.1 10.8 32 9.5 29.6 9.5C27.2 9.5 25.1 10.8 23.7 12.6C22.3 11 20.3 10 18 10Z"
          fill="url(#commonCrust)"
        />

        {/* Docking holes / Cookie crumb pinholes */}
        <circle cx="21" cy="20" r="1.3" fill="#78350F" opacity="0.7" />
        <circle cx="38" cy="20" r="1.3" fill="#78350F" opacity="0.7" />
        <circle cx="21" cy="39" r="1.3" fill="#78350F" opacity="0.7" />
        <circle cx="38" cy="39" r="1.3" fill="#78350F" opacity="0.7" />

        {/* Embossed Royal Feline Paw in center */}
        <g fill="#FEF3C7" opacity="0.95" filter="drop-shadow(0 1px 1px #78350F)">
          {/* Main Pad */}
          <ellipse cx="29.5" cy="32" rx="5.5" ry="4.5" />
          {/* 4 Toe Beans */}
          <circle cx="24" cy="24" r="2.2" />
          <circle cx="28" cy="22.5" r="2.2" />
          <circle cx="32" cy="23" r="2.2" />
          <circle cx="35.5" cy="25" r="2.2" />
        </g>
      </svg>
    );
  }

  // 2. Silver Biscuit: Luminous platinum-silver heraldic shield biscuit with diamond facets & sparkle glints
  if (normId === 'silver') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`filter drop-shadow-[0_4px_10px_rgba(148,163,184,0.5)] ${className}`}
      >
        <defs>
          <linearGradient id="silverGrad" x1="10" y1="8" x2="54" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="25%" stopColor="#E2E8F0" />
            <stop offset="55%" stopColor="#94A3B8" />
            <stop offset="100%" stopColor="#475569" />
          </linearGradient>
          <linearGradient id="silverRim" x1="12" y1="10" x2="52" y2="54" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#64748B" />
          </linearGradient>
        </defs>

        {/* Polished Hexagonal Shield Cookie */}
        <polygon
          points="32,8 54,18 54,44 32,56 10,44 10,18"
          fill="url(#silverGrad)"
          stroke="url(#silverRim)"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />

        {/* Inner Beveled Perimeter */}
        <polygon
          points="32,13 49,21 49,41 32,51 15,41 15,21"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="1"
          opacity="0.6"
        />

        {/* Center Royal Silver Crown Crest */}
        <path
          d="M24 37L22 28L28 32L32 25L36 32L42 28L40 37H24Z"
          fill="#FFFFFF"
          stroke="#334155"
          strokeWidth="1.2"
          strokeLinejoin="round"
          filter="drop-shadow(0 2px 3px rgba(51,65,85,0.4))"
        />
        <circle cx="22" cy="27" r="1.2" fill="#E2E8F0" />
        <circle cx="32" cy="24" r="1.4" fill="#FFFFFF" />
        <circle cx="42" cy="27" r="1.2" fill="#E2E8F0" />

        {/* Radiant Sparkle Glints */}
        <path
          d="M46 14L47.5 17.5L51 19L47.5 20.5L46 24L44.5 20.5L41 19L44.5 17.5Z"
          fill="#FFFFFF"
          opacity="0.9"
        />
        <circle cx="18" cy="46" r="1.5" fill="#FFFFFF" opacity="0.8" />
      </svg>
    );
  }

  // 3. Gold Biscuit: 24K pure gold scalloped royal medallion with embossed crown & ruby jewels
  if (normId === 'gold') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`filter drop-shadow-[0_4px_12px_rgba(234,179,8,0.6)] ${className}`}
      >
        <defs>
          <linearGradient id="goldGrad" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FEF08A" />
            <stop offset="30%" stopColor="#FACC15" />
            <stop offset="70%" stopColor="#CA8A04" />
            <stop offset="100%" stopColor="#854D0E" />
          </linearGradient>
          <radialGradient id="goldSheen" cx="40%" cy="35%" r="60%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.7" />
            <stop offset="50%" stopColor="#FEF08A" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#713F12" stopOpacity="0.8" />
          </radialGradient>
        </defs>

        {/* Ornate Scalloped Medallion Cookie */}
        <circle cx="32" cy="32" r="23" fill="url(#goldGrad)" stroke="#713F12" strokeWidth="2" />
        <circle cx="32" cy="32" r="23" fill="url(#goldSheen)" />

        {/* Rope Border */}
        <circle cx="32" cy="32" r="19.5" fill="none" stroke="#FEF9C3" strokeWidth="1.5" strokeDasharray="3 2" />

        {/* Center 3D Royal Crown */}
        <path
          d="M22 39L19 27L27 32L32 23L37 32L45 27L42 39H22Z"
          fill="#FEF9C3"
          stroke="#713F12"
          strokeWidth="1.5"
          strokeLinejoin="round"
          filter="drop-shadow(0 2px 4px rgba(113,63,18,0.5))"
        />

        {/* Crown Jewel Insets */}
        <circle cx="32" cy="22" r="1.8" fill="#EF4444" stroke="#713F12" strokeWidth="0.8" />
        <circle cx="19" cy="26" r="1.5" fill="#3B82F6" stroke="#713F12" strokeWidth="0.8" />
        <circle cx="45" cy="26" r="1.5" fill="#10B981" stroke="#713F12" strokeWidth="0.8" />
        <circle cx="32" cy="36" r="1.5" fill="#EF4444" />

        {/* Brilliant Solar Glints */}
        <path
          d="M17 14L18.5 18L22 19.5L18.5 21L17 25L15.5 21L12 19.5L15.5 18Z"
          fill="#FFFFFF"
        />
        <path
          d="M48 42L49 44.5L51.5 45.5L49 46.5L48 49L47 46.5L44.5 45.5L47 44.5Z"
          fill="#FEF08A"
        />
      </svg>
    );
  }

  // 4. Diamond Biscuit: Radiant celestial prism azure diamond star with cosmic cyan halo
  if (normId === 'diamond') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`filter drop-shadow-[0_4px_14px_rgba(6,182,212,0.7)] ${className}`}
      >
        <defs>
          <linearGradient id="diamondGrad" x1="12" y1="8" x2="52" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ECFEFF" />
            <stop offset="30%" stopColor="#67E8F9" />
            <stop offset="70%" stopColor="#0891B2" />
            <stop offset="100%" stopColor="#164E63" />
          </linearGradient>
          <linearGradient id="diamondFacet" x1="32" y1="12" x2="32" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#0E7490" stopOpacity="0.4" />
          </linearGradient>
        </defs>

        {/* Octagonal Gemstone Cookie Contour */}
        <polygon
          points="22,10 42,10 54,22 54,42 42,54 22,54 10,42 10,22"
          fill="url(#diamondGrad)"
          stroke="#A5F3FC"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* Facet Geometries */}
        <polygon
          points="26,17 38,17 47,26 47,38 38,47 26,47 17,38 17,26"
          fill="url(#diamondFacet)"
          stroke="#FFFFFF"
          strokeWidth="1.2"
        />

        {/* Diagonal Ray Lines */}
        <line x1="22" y1="10" x2="26" y2="17" stroke="#A5F3FC" strokeWidth="1" />
        <line x1="42" y1="10" x2="38" y2="17" stroke="#A5F3FC" strokeWidth="1" />
        <line x1="54" y1="22" x2="47" y2="26" stroke="#A5F3FC" strokeWidth="1" />
        <line x1="54" y1="42" x2="47" y2="38" stroke="#A5F3FC" strokeWidth="1" />
        <line x1="42" y1="54" x2="38" y2="47" stroke="#A5F3FC" strokeWidth="1" />
        <line x1="22" y1="54" x2="26" y2="47" stroke="#A5F3FC" strokeWidth="1" />
        <line x1="10" y1="42" x2="17" y2="38" stroke="#A5F3FC" strokeWidth="1" />
        <line x1="10" y1="22" x2="17" y2="26" stroke="#A5F3FC" strokeWidth="1" />

        {/* Central Brilliant Celestial Star */}
        <polygon
          points="32,24 34.5,29.5 40,32 34.5,34.5 32,40 29.5,34.5 24,32 29.5,29.5"
          fill="#FFFFFF"
          filter="drop-shadow(0 0 6px #A5F3FC)"
        />

        {/* Prismatic Sparkle Corner */}
        <path
          d="M48 12L49.5 15.5L53 17L49.5 18.5L48 22L46.5 18.5L43 17L46.5 15.5Z"
          fill="#FFFFFF"
        />
      </svg>
    );
  }

  // 5. Dynamic / Newly Launched Custom Biscuits (e.g., Ruby, Emerald, Amethyst, Cosmic, etc.)
  const theme = color || '#A855F7';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`filter drop-shadow-[0_4px_12px_rgba(168,85,247,0.5)] ${className}`}
    >
      <defs>
        <linearGradient id={`dynGrad_${normId}`} x1="10" y1="8" x2="54" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.8" />
          <stop offset="25%" stopColor={theme} />
          <stop offset="100%" stopColor="#1E0B36" />
        </linearGradient>
      </defs>

      {/* Royal Crowned Medallion Cookie Base */}
      <circle
        cx="32"
        cy="32"
        r="23"
        fill={`url(#dynGrad_${normId})`}
        stroke={theme}
        strokeWidth="2.5"
      />

      {/* Inner Scalloped Filigree */}
      <circle
        cx="32"
        cy="32"
        r="18.5"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="1.2"
        strokeDasharray="4 2"
        opacity="0.85"
      />

      {/* Center Royal Feline Emblem */}
      <path
        d="M24 37L22 28L28 32L32 25L36 32L42 28L40 37H24Z"
        fill="#FFFFFF"
        stroke={theme}
        strokeWidth="1.2"
        strokeLinejoin="round"
        filter="drop-shadow(0 2px 4px rgba(0,0,0,0.5))"
      />

      <circle cx="32" cy="24" r="1.5" fill="#FEF08A" />

      {/* Sparkling Accent Star */}
      <path
        d="M47 13L48.5 16.5L52 18L48.5 19.5L47 23L45.5 19.5L42 18L45.5 16.5Z"
        fill="#FFFFFF"
      />
    </svg>
  );
};
