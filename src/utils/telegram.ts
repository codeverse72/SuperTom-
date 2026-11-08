/**
 * Telegram Mini App WebApp SDK Integration Helper
 * 
 * Provides production-ready detection, initialization, and interface helpers
 * for running inside the Telegram desktop, Android, and iOS clients.
 * 
 * Complies with official Telegram WebApps API:
 * https://core.telegram.org/bots/webapps
 * 
 * SECURITY DIRECTIVES:
 * 1. Never trust `initDataUnsafe` as proof of user identity on the client.
 * 2. Raw `initData` must be sent to the Render backend for cryptographic HMAC-SHA256 signature verification.
 * 3. Never expose bot tokens or sensitive secrets on the frontend.
 */

export interface TelegramWebAppUser {
  id: number;
  is_bot?: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
  is_premium?: boolean;
  added_to_attachment_menu?: boolean;
  allows_write_to_pm?: boolean;
}

export interface TelegramThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
  header_bg_color?: string;
  bottom_bar_bg_color?: string;
  accent_text_color?: string;
  section_bg_color?: string;
  section_header_text_color?: string;
  subtitle_text_color?: string;
  destructive_text_color?: string;
}

export interface PopupButton {
  id?: string;
  type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive';
  text?: string;
}

export interface PopupParams {
  title?: string;
  message: string;
  buttons?: PopupButton[];
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe?: {
    query_id?: string;
    user?: TelegramWebAppUser;
    receiver?: TelegramWebAppUser;
    chat?: unknown;
    chat_type?: 'sender' | 'private' | 'group' | 'supergroup' | 'channel';
    chat_instance?: string;
    start_param?: string;
    can_send_after?: number;
    auth_date?: number | string;
    hash?: string;
  };
  version: string;
  platform: 'android' | 'android_x' | 'ios' | 'macos' | 'tdesktop' | 'weba' | 'web' | 'unknown' | string;
  colorScheme: 'light' | 'dark';
  themeParams: TelegramThemeParams;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  headerColor: string;
  backgroundColor: string;
  bottomBarColor?: string;
  BackButton: {
    isVisible: boolean;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
    show: () => void;
    hide: () => void;
  };
  MainButton: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    isProgressVisible: boolean;
    setText: (text: string) => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
    show: () => void;
    hide: () => void;
    enable: () => void;
    disable: () => void;
    showProgress: (leaveActive?: boolean) => void;
    hideProgress: () => void;
    setParams: (params: { text?: string; color?: string; text_color?: string; is_active?: boolean; is_visible?: boolean }) => void;
  };
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
  ready: () => void;
  expand: () => void;
  close: () => void;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
  setBottomBarColor?: (color: string) => void;
  enableClosingConfirmation?: () => void;
  disableClosingConfirmation?: () => void;
  showAlert: (message: string, callback?: () => void) => void;
  showConfirm: (message: string, callback?: (confirmed: boolean) => void) => void;
  showPopup: (params: PopupParams, callback?: (buttonId: string) => void) => void;
  openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
  openTelegramLink: (url: string) => void;
  sendData: (data: string) => void;
  onEvent: (eventType: string, eventHandler: () => void) => void;
  offEvent: (eventType: string, eventHandler: () => void) => void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

/**
 * Returns the Telegram WebApp object if running inside Telegram.
 */
export function getTelegramWebApp(): TelegramWebApp | null {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    return window.Telegram.WebApp;
  }
  return null;
}

/**
 * Checks if the app is currently running inside the Telegram Mini App environment.
 */
export function isTelegramEnvironment(): boolean {
  const webApp = getTelegramWebApp();
  return Boolean(
    webApp && 
    typeof webApp.initData === 'string' &&
    webApp.platform !== undefined
  );
}

/**
 * Checks if the app is running in a standard standalone browser.
 */
export function isBrowserEnvironment(): boolean {
  return !isTelegramEnvironment();
}

/**
 * Returns a diagnostic summary of the Telegram environment.
 */
export function getTelegramEnvironmentInfo() {
  const webApp = getTelegramWebApp();
  const isTg = isTelegramEnvironment();
  return {
    isTelegram: isTg,
    platform: webApp?.platform || 'browser',
    version: webApp?.version || 'n/a',
    colorScheme: webApp?.colorScheme || 'dark',
    hasInitData: Boolean(webApp?.initData && webApp.initData.length > 0),
    userId: webApp?.initDataUnsafe?.user?.id ?? null,
    username: webApp?.initDataUnsafe?.user?.username ?? null,
    startParam: getTelegramStartParam(),
  };
}

/**
 * Synchronizes Telegram viewport height with CSS custom properties.
 */
function syncViewportCss(webApp: TelegramWebApp): void {
  if (typeof document === 'undefined') return;
  const vh = webApp.viewportHeight || window.innerHeight;
  const stableVh = webApp.viewportStableHeight || vh;
  document.documentElement.style.setProperty('--tg-viewport-height', `${vh}px`);
  document.documentElement.style.setProperty('--tg-viewport-stable-height', `${stableVh}px`);
}

/**
 * Safely initializes the Telegram WebApp viewport, styling, and event listeners.
 */
export function initTelegramWebApp(): void {
  const webApp = getTelegramWebApp();
  if (!webApp) return;

  try {
    // Notify Telegram client that Mini App is initialized
    webApp.ready();

    // Request full viewport expansion to avoid unwanted sheet bouncing
    webApp.expand();

    // Set brand header & background colors (SuperTom dark castle palette)
    if (webApp.setHeaderColor) {
      webApp.setHeaderColor('#0c021c');
    }
    if (webApp.setBackgroundColor) {
      webApp.setBackgroundColor('#070112');
    }
    if (webApp.setBottomBarColor) {
      webApp.setBottomBarColor('#0c021c');
    }

    // Enable closing confirmation to prevent accidental swipes on mobile
    if (webApp.enableClosingConfirmation) {
      webApp.enableClosingConfirmation();
    }

    // Set initial viewport CSS custom properties
    syncViewportCss(webApp);

    // Bind viewport changed listener
    if (webApp.onEvent) {
      webApp.onEvent('viewportChanged', () => {
        syncViewportCss(webApp);
      });
    }
  } catch (err) {
    console.warn('Failed to initialize Telegram WebApp settings:', err);
  }
}

/**
 * Retrieves the raw initData string for secure transmission to backend.
 * Returns null if not in Telegram or initData is empty.
 */
export function getRawTelegramInitData(): string | null {
  const webApp = getTelegramWebApp();
  if (webApp && webApp.initData && webApp.initData.length > 0) {
    return webApp.initData;
  }
  return null;
}

/**
 * Extracts the start parameter from Telegram initDataUnsafe or fallback URL search parameters.
 * Supports: ?tgWebAppStartParam=..., ?startapp=..., ?start=...
 */
export function getTelegramStartParam(): string | null {
  const webApp = getTelegramWebApp();
  if (webApp?.initDataUnsafe?.start_param) {
    return webApp.initDataUnsafe.start_param;
  }

  if (typeof window !== 'undefined' && window.location) {
    const params = new URLSearchParams(window.location.search);
    return params.get('tgWebAppStartParam') || params.get('startapp') || params.get('start') || null;
  }

  return null;
}

/**
 * Configured bot username placeholder for deep linking.
 */
export function getTelegramBotUsername(): string {
  return import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'SuperTomBot';
}

/**
 * Generates an official Telegram deep link for sharing and referrals.
 */
export function generateReferralLink(referralCode: string): string {
  const botUsername = getTelegramBotUsername();
  return `https://t.me/${botUsername}?startapp=${encodeURIComponent(referralCode)}`;
}

/**
 * Opens the native Telegram share dialog to send referral/invite link.
 */
export function shareViaTelegram(shareUrl: string, text?: string): void {
  const webApp = getTelegramWebApp();
  const caption = text || 'Join me on SuperTom and start mining with King Tom! 👑🐱';
  const tgShareUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(caption)}`;

  if (webApp?.openTelegramLink) {
    try {
      webApp.openTelegramLink(tgShareUrl);
      return;
    } catch {
      // fallback
    }
  }

  if (typeof window !== 'undefined') {
    window.open(tgShareUrl, '_blank', 'noopener,noreferrer');
  }
}

// Global reference for active BackButton callback to avoid duplicate listeners
let activeBackButtonCallback: (() => void) | null = null;

/**
 * Shows the native Telegram Back Button with a clean, single-callback registration.
 */
export function showBackButton(callback: () => void): void {
  const webApp = getTelegramWebApp();
  if (!webApp?.BackButton) return;

  try {
    if (activeBackButtonCallback) {
      webApp.BackButton.offClick(activeBackButtonCallback);
    }
    activeBackButtonCallback = callback;
    webApp.BackButton.onClick(callback);
    webApp.BackButton.show();
  } catch (err) {
    console.warn('Failed to show Telegram BackButton:', err);
  }
}

/**
 * Hides the native Telegram Back Button and unbinds active listeners.
 */
export function hideBackButton(): void {
  const webApp = getTelegramWebApp();
  if (!webApp?.BackButton) return;

  try {
    if (activeBackButtonCallback) {
      webApp.BackButton.offClick(activeBackButtonCallback);
      activeBackButtonCallback = null;
    }
    webApp.BackButton.hide();
  } catch (err) {
    console.warn('Failed to hide Telegram BackButton:', err);
  }
}

// Global reference for active MainButton callback
let activeMainButtonCallback: (() => void) | null = null;

/**
 * Configures and displays the Telegram Main Button if appropriate.
 */
export function showMainButton(options: {
  text: string;
  onClick: () => void;
  color?: string;
  textColor?: string;
}): void {
  const webApp = getTelegramWebApp();
  if (!webApp?.MainButton) return;

  try {
    if (activeMainButtonCallback) {
      webApp.MainButton.offClick(activeMainButtonCallback);
    }
    activeMainButtonCallback = options.onClick;
    webApp.MainButton.setText(options.text);
    if (options.color && options.textColor && webApp.MainButton.setParams) {
      webApp.MainButton.setParams({
        color: options.color,
        text_color: options.textColor,
        is_active: true,
        is_visible: true
      });
    }
    webApp.MainButton.onClick(options.onClick);
    webApp.MainButton.show();
  } catch (err) {
    console.warn('Failed to show Telegram MainButton:', err);
  }
}

/**
 * Hides the Telegram Main Button and cleans up callbacks.
 */
export function hideMainButton(): void {
  const webApp = getTelegramWebApp();
  if (!webApp?.MainButton) return;

  try {
    if (activeMainButtonCallback) {
      webApp.MainButton.offClick(activeMainButtonCallback);
      activeMainButtonCallback = null;
    }
    webApp.MainButton.hide();
  } catch (err) {
    console.warn('Failed to hide Telegram MainButton:', err);
  }
}

/**
 * Triggers native Telegram haptic feedback impact.
 */
export function triggerHaptic(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'light'): void {
  const webApp = getTelegramWebApp();
  if (webApp?.HapticFeedback) {
    try {
      webApp.HapticFeedback.impactOccurred(style);
    } catch {
      // ignore
    }
  }
}

/**
 * Triggers native Telegram notification haptic feedback (error | success | warning).
 */
export function triggerHapticNotification(type: 'error' | 'success' | 'warning'): void {
  const webApp = getTelegramWebApp();
  if (webApp?.HapticFeedback) {
    try {
      webApp.HapticFeedback.notificationOccurred(type);
    } catch {
      // ignore
    }
  }
}

/**
 * Triggers native Telegram selection changed haptic feedback (subtle tick).
 */
export function triggerHapticSelection(): void {
  const webApp = getTelegramWebApp();
  if (webApp?.HapticFeedback) {
    try {
      webApp.HapticFeedback.selectionChanged();
    } catch {
      // ignore
    }
  }
}

/**
 * Displays a native Telegram alert with browser fallback.
 */
export function showTelegramAlert(message: string, callback?: () => void): void {
  const webApp = getTelegramWebApp();
  if (webApp?.showAlert) {
    webApp.showAlert(message, callback);
  } else if (typeof window !== 'undefined') {
    window.alert(message);
    callback?.();
  }
}

/**
 * Displays a native Telegram confirmation dialog with browser fallback.
 */
export function showTelegramConfirm(message: string, callback?: (confirmed: boolean) => void): void {
  const webApp = getTelegramWebApp();
  if (webApp?.showConfirm) {
    webApp.showConfirm(message, callback);
  } else if (typeof window !== 'undefined') {
    const result = window.confirm(message);
    callback?.(result);
  }
}

/**
 * Displays a native Telegram popup with custom buttons and browser fallback.
 */
export function showTelegramPopup(params: PopupParams, callback?: (buttonId: string) => void): void {
  const webApp = getTelegramWebApp();
  if (webApp?.showPopup) {
    webApp.showPopup(params, callback);
  } else if (typeof window !== 'undefined') {
    const title = params.title ? `${params.title}\n\n` : '';
    const result = window.confirm(`${title}${params.message}`);
    callback?.(result ? 'ok' : 'cancel');
  }
}

/**
 * Closes the Telegram Mini App inside the Telegram client.
 */
export function closeTelegramApp(): void {
  const webApp = getTelegramWebApp();
  if (webApp?.close) {
    webApp.close();
  }
}
