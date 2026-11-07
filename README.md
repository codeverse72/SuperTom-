# SuperTom 🐱👑
## Premium Cat-Themed Telegram Mining Game – Production Frontend Architecture

SuperTom is a premium, cat-themed Telegram Mini App where players feed biscuits to King Tom, produce Poops (in-game currency), complete missions, spin milestone reward wheels, and exchange Poops for USDT (TRC20).

This repository contains the complete, production-ready React + TypeScript + Tailwind CSS frontend architecture. It is designed to be connected seamlessly to a backend API or deployed within environments such as Google Antigravity / Google AI Studio.

---

## 🚀 Key Features & Architecture

### 1. Visual Identity & 3D Mobile Gaming Interface
- **Dark Castle Aesthetics**: Deep purple background (`#070114`), glowing neon purple/magenta borders, glossy 3D golden buttons, and glassmorphism cards.
- **Cat Mascot**: King Tom lounging on a plush throne wearing a 24k crown, sunglasses, and royal gold coins with animated petting interactions.
- **Responsive Navigation**: Fixed 5-tab bottom navigation (**Home**, **Missions**, **Store**, **Payout**, **Profile**).

### 2. Centralized Feature Availability Control (`src/config/featureConfig.ts`)
When no backend API is connected, all financial operations, verification calls, and transaction requests remain safely **UNAVAILABLE** with clean, professional notices instead of fake/mock state:
- `auth`: Account authentication & Telegram `initData` verification.
- `mining`: Server-validated passive Poop mining rates.
- `biscuit_purchases` & `biscuit_feeding`: Bakery inventory and consumption.
- `spin_rewards` & `spin_timer_sync`: Server-authoritative 2h/4h/8h milestone lucky wheel.
- `mission_verification` & `mission_claiming`: Quest verification via Telegram Bot API.
- `withdrawals`: USDT TRC20 payout requests with strict address format validation.

---

## 📂 Project Structure

```
├── public/
│   └── assets/
│       └── dashboard/       # Optimized 3D game visual assets
├── src/
│   ├── components/          # Modular UI components (Header, BalanceCard, SpinTimer, etc.)
│   ├── config/              # Feature flags & game configurations (featureConfig, gameConfig)
│   ├── context/             # GameContext for application state management
│   ├── hooks/               # Custom hooks (useTelegram, useFeature)
│   ├── pages/               # Tab views (Home, Missions, Store, Payout, Profile)
│   ├── services/            # Typed REST API client & service contracts (auth, user, mining, etc.)
│   ├── types/               # TypeScript interfaces (biscuit, feature, mission, payment, user)
│   └── utils/               # Helper utilities (currency, validation, telegram, errorHandler)
├── index.html               # Main HTML entry with Telegram WebApp SDK script
├── package.json             # NPM dependencies & scripts
├── tsconfig.json            # TypeScript configuration
└── vite.config.ts           # Vite build configuration
```

---

## 🛠️ Getting Started & Setup

### Prerequisites
- **Node.js**: `v18.x` or higher
- **npm** or **pnpm**

### Installation
```bash
# Install package dependencies
npm install

# Start local development server
npm run dev
```
The application will start at `http://localhost:3000`.

### Production Build
```bash
# Run TypeScript validation & build Vite bundle
npm run build
```

---

## 🛡️ Telegram Mini App SDK & Security Directives

1. **Telegram WebApp SDK Integration**: Included via `https://telegram.org/js/telegram-web-app.js` in `index.html` and wrapped safely in `src/utils/telegram.ts` / `src/hooks/useTelegram.ts`.
2. **InitData Verification**:
   - `initDataUnsafe` is used only for non-sensitive client display.
   - Raw `initData` is transmitted securely to backend service (`authService.authenticateTelegram`) for cryptographic HMAC-SHA256 signature verification.
3. **No Financial Credentials in Frontend**: All token generation, wallet payouts, and payment processing must be executed server-side.

---

## ⚙️ Environment Variables (`.env.example`)

To connect to a live backend service, create a `.env` file:
```env
# Backend Base URL (REST API)
VITE_API_BASE_URL="https://your-api-domain.com/api/v1"

# Feature switch flags
VITE_FEATURE_MINING="false"
VITE_FEATURE_STORE="false"
VITE_FEATURE_FEEDING="false"
VITE_FEATURE_SPIN="false"
VITE_FEATURE_MISSION_VERIFY="false"
VITE_FEATURE_WITHDRAWALS="false"
```

---

## 📜 License
Apache-2.0
