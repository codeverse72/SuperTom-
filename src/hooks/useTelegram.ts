/**
 * React Hook for Telegram Mini App WebApp SDK
 * 
 * Provides reactive access to:
 * - Launch context & user information
 * - Raw initData string for future Render backend authentication
 * - Start parameters (referrals & deep links)
 * - Platform & viewport dimensions
 * - BackButton & MainButton controls
 * - Haptic feedback triggers
 * - Native dialogs with browser fallbacks
 */

import { useEffect, useState, useCallback } from 'react';
import { 
  getTelegramWebApp, 
  initTelegramWebApp, 
  isTelegramEnvironment, 
  getRawTelegramInitData,
  getTelegramStartParam,
  getTelegramEnvironmentInfo,
  showBackButton,
  hideBackButton,
  showMainButton,
  hideMainButton,
  triggerHaptic,
  triggerHapticNotification,
  triggerHapticSelection,
  showTelegramAlert,
  showTelegramConfirm,
  showTelegramPopup,
  shareViaTelegram,
  closeTelegramApp,
  TelegramWebApp,
  TelegramWebAppUser,
  TelegramThemeParams,
  PopupParams
} from '../utils/telegram';

export function useTelegram() {
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null);
  const [isTelegram, setIsTelegram] = useState<boolean>(false);
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>('dark');
  const [themeParams, setThemeParams] = useState<TelegramThemeParams>({});
  const [viewportHeight, setViewportHeight] = useState<number>(() => {
    return typeof window !== 'undefined' ? window.innerHeight : 800;
  });

  useEffect(() => {
    initTelegramWebApp();
    const app = getTelegramWebApp();
    setWebApp(app);
    const tgActive = isTelegramEnvironment();
    setIsTelegram(tgActive);

    if (app) {
      if (app.colorScheme) setColorScheme(app.colorScheme);
      if (app.themeParams) setThemeParams(app.themeParams);
      if (app.viewportHeight) setViewportHeight(app.viewportHeight);

      // Handle dynamic Telegram theme change events
      const handleThemeChange = () => {
        if (app.colorScheme) setColorScheme(app.colorScheme);
        if (app.themeParams) setThemeParams(app.themeParams);
      };

      // Handle dynamic viewport resizing
      const handleViewportChange = () => {
        if (app.viewportHeight) setViewportHeight(app.viewportHeight);
      };

      if (app.onEvent) {
        app.onEvent('themeChanged', handleThemeChange);
        app.onEvent('viewportChanged', handleViewportChange);
      }

      return () => {
        if (app.offEvent) {
          app.offEvent('themeChanged', handleThemeChange);
          app.offEvent('viewportChanged', handleViewportChange);
        }
      };
    }
  }, []);

  // Back Button helpers
  const showBack = useCallback((callback: () => void) => {
    showBackButton(callback);
  }, []);

  const hideBack = useCallback(() => {
    hideBackButton();
  }, []);

  // Main Button helpers
  const showMain = useCallback((options: { text: string; onClick: () => void; color?: string; textColor?: string }) => {
    showMainButton(options);
  }, []);

  const hideMain = useCallback(() => {
    hideMainButton();
  }, []);

  // Haptics
  const hapticImpact = useCallback((style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'light') => {
    triggerHaptic(style);
  }, []);

  const hapticNotification = useCallback((type: 'error' | 'success' | 'warning') => {
    triggerHapticNotification(type);
  }, []);

  const hapticSelection = useCallback(() => {
    triggerHapticSelection();
  }, []);

  // Dialogs
  const alert = useCallback((message: string, callback?: () => void) => {
    showTelegramAlert(message, callback);
  }, []);

  const confirm = useCallback((message: string, callback?: (confirmed: boolean) => void) => {
    showTelegramConfirm(message, callback);
  }, []);

  const popup = useCallback((params: PopupParams, callback?: (buttonId: string) => void) => {
    showTelegramPopup(params, callback);
  }, []);

  // Sharing
  const shareLink = useCallback((url: string, text?: string) => {
    shareViaTelegram(url, text);
  }, []);

  // Close app
  const close = useCallback(() => {
    closeTelegramApp();
  }, []);

  return {
    webApp,
    isTelegram,
    initData: getRawTelegramInitData(),
    user: (webApp?.initDataUnsafe?.user as TelegramWebAppUser) || null,
    startParam: getTelegramStartParam(),
    colorScheme,
    themeParams,
    viewportHeight,
    isExpanded: webApp?.isExpanded || false,
    platform: webApp?.platform || 'unknown',
    version: webApp?.version || 'n/a',
    envInfo: getTelegramEnvironmentInfo(),
    
    // Interactive methods
    showBack,
    hideBack,
    showMain,
    hideMain,
    hapticImpact,
    hapticNotification,
    hapticSelection,
    alert,
    confirm,
    popup,
    shareLink,
    close
  };
}
