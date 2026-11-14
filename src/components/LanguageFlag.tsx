import React from 'react';
import { AppLanguage } from '../i18n/translations';

interface LanguageFlagProps {
  code: AppLanguage | string;
  className?: string;
  circle?: boolean;
}

export const LanguageFlag: React.FC<LanguageFlagProps> = ({
  code,
  className = 'w-6 h-4',
  circle = false,
}) => {
  const normalized = (code || 'en').toLowerCase();

  const containerClasses = `${className} ${
    circle ? 'rounded-full' : 'rounded-[3px]'
  } overflow-hidden inline-flex items-center justify-center shrink-0 shadow-sm border border-white/20 select-none`;

  // 1. UNITED KINGDOM (en)
  if (normalized === 'en') {
    return (
      <span className={containerClasses} aria-label="English Flag" title="English">
        <svg
          viewBox="0 0 60 30"
          className="w-full h-full object-cover"
          preserveAspectRatio={circle ? 'xMidYMid slice' : 'none'}
        >
          <clipPath id="uk-clip">
            <path d="M0,0 v30 h60 v-30 z" />
          </clipPath>
          <clipPath id="uk-diag1">
            <path d="M0,0 L30,15 H0 z M0,30 L30,15 V30 z M60,30 L30,15 H60 z M60,0 L30,15 V0 z" />
          </clipPath>
          <clipPath id="uk-diag2">
            <path d="M0,0 L60,30 M60,0 L0,30" />
          </clipPath>
          {/* Blue background */}
          <rect width="60" height="30" fill="#012169" />
          {/* White diagonal saltire */}
          <path d="M0,0 L60,30 M60,0 L0,30" stroke="#ffffff" strokeWidth="6" />
          {/* Red diagonal counterchanged saltire */}
          <path
            d="M0,0 L60,30 M60,0 L0,30"
            stroke="#C8102E"
            strokeWidth="2"
            strokeDasharray="30 30"
          />
          {/* White central cross */}
          <path d="M30,0 v30 M0,15 h60" stroke="#ffffff" strokeWidth="10" />
          {/* Red central cross */}
          <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
        </svg>
      </span>
    );
  }

  // 2. IRAN / FARSI (fa)
  if (normalized === 'fa') {
    return (
      <span className={containerClasses} aria-label="Persian Flag" title="فارسی">
        <svg
          viewBox="0 0 60 30"
          className="w-full h-full object-cover"
          preserveAspectRatio={circle ? 'xMidYMid slice' : 'none'}
        >
          {/* Green Top */}
          <rect width="60" height="10" fill="#239F40" />
          {/* White Middle */}
          <rect y="10" width="60" height="10" fill="#FFFFFF" />
          {/* Red Bottom */}
          <rect y="20" width="60" height="10" fill="#DA0000" />
          {/* Central Emblem of Iran */}
          <g transform="translate(30, 15) scale(0.24)">
            <path
              d="M0,-14 C2,-10 3,-5 3,0 C3,5 2,10 0,14 C-2,10 -3,5 -3,0 C-3,-5 -2,-10 0,-14 Z"
              fill="#DA0000"
            />
            <path
              d="M-4,-10 C-1,-6 0,-1 0,3 C-6,2 -11,-1 -13,-7 C-10,-10 -6,-11 -4,-10 Z"
              fill="#DA0000"
            />
            <path
              d="M4,-10 C1,-6 0,-1 0,3 C6,2 11,-1 13,-7 C10,-10 6,-11 4,-10 Z"
              fill="#DA0000"
            />
            <path
              d="M-7,6 C-3,10 0,11 0,11 C-4,13 -10,12 -14,6 C-13,4 -10,4 -7,6 Z"
              fill="#DA0000"
            />
            <path
              d="M7,6 C3,10 0,11 0,11 C4,13 10,12 14,6 C13,4 10,4 7,6 Z"
              fill="#DA0000"
            />
            <line x1="0" y1="-17" x2="0" y2="15" stroke="#DA0000" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M-3,-16 Q0,-18 3,-16" stroke="#DA0000" strokeWidth="1.2" fill="none" />
          </g>
        </svg>
      </span>
    );
  }

  // 3. RUSSIA (ru)
  if (normalized === 'ru') {
    return (
      <span className={containerClasses} aria-label="Russian Flag" title="Русский">
        <svg
          viewBox="0 0 60 30"
          className="w-full h-full object-cover"
          preserveAspectRatio={circle ? 'xMidYMid slice' : 'none'}
        >
          {/* White Top */}
          <rect width="60" height="10" fill="#FFFFFF" />
          {/* Blue Middle */}
          <rect y="10" width="60" height="10" fill="#0039A6" />
          {/* Red Bottom */}
          <rect y="20" width="60" height="10" fill="#D52B1E" />
        </svg>
      </span>
    );
  }

  // 4. FRANCE (fr)
  if (normalized === 'fr') {
    return (
      <span className={containerClasses} aria-label="French Flag" title="Français">
        <svg
          viewBox="0 0 60 30"
          className="w-full h-full object-cover"
          preserveAspectRatio={circle ? 'xMidYMid slice' : 'none'}
        >
          {/* Blue Left */}
          <rect width="20" height="30" fill="#002654" />
          {/* White Center */}
          <rect x="20" width="20" height="30" fill="#FFFFFF" />
          {/* Red Right */}
          <rect x="40" width="20" height="30" fill="#CE1126" />
        </svg>
      </span>
    );
  }

  // Fallback
  return (
    <span className={containerClasses} aria-label="Language">
      🌐
    </span>
  );
};
