export type AppLanguage = 'en' | 'fa' | 'ru' | 'fr';

export interface LanguageOption {
  code: AppLanguage;
  name: string;
  nativeName: string;
  flag: string;
  dir: 'ltr' | 'rtl';
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧', dir: 'ltr' },
  { code: 'fa', name: 'Farsi (Persian)', nativeName: 'فارسی', flag: '🇮🇷', dir: 'rtl' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺', dir: 'ltr' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷', dir: 'ltr' },
];

export const TRANSLATIONS: Record<AppLanguage, Record<string, string>> = {
  en: {
    // Navigation
    'nav.home': 'Home',
    'nav.quests': 'Quests',
    'nav.store': 'Store',
    'nav.payout': 'Payout',
    'nav.profile': 'Profile',

    // Header
    'header.level': 'Lvl',
    'header.tomcoins': 'TomCoins',

    // Home
    'home.activeMining': 'Active Mining',
    'home.hourlyProduction': 'Hourly Production',
    'home.miningRate': 'Mining Rate',
    'home.feedTomBtn': 'FEED TOM (+10/H)',
    'home.feedTomDesc': 'Feed King Tom biscuits to boost mining speed & earn TomCoins',
    'home.spinWheel': 'Lucky Spin',
    'home.spinDesc': 'Win TomCoins, Biscuits & Mining Boosts',
    'home.claim': 'Claim',
    'home.claimTitle': 'Unclaimed TomCoins',
    'home.claimSub': 'Accumulated through royal feline mining',
    'home.readyToClaim': 'Ready to claim',

    // Profile & User Menu
    'profile.title': 'Profile & Settings',
    'profile.guest': 'Guest Player',
    'profile.playerId': 'Player ID',
    'profile.myStats': 'My Stats & Records',
    'profile.myStatsSub': 'Feeding totals, missions & achievements',
    'profile.referral': 'Referral Program',
    'profile.referralSub': 'Invite friends & earn TomCoins',
    'profile.sound': 'Sound Effects',
    'profile.soundSub': 'Crunch, coin dings and fanfare',
    'profile.language': 'Language',
    'profile.languageSub': 'Change app language (English, فارسی, Русский, Français)',
    'profile.support': 'Customer Support',
    'profile.supportSub': '24/7 Live Agent & Payout Help',
    'profile.faq': 'Help & Support',
    'profile.faqSub': 'How to play, mining rules & conversions',
    'profile.about': 'About SuperTom',
    'profile.aboutSub': 'Tokenomics, roadmap and verification',
    'profile.langModalTitle': 'Select Language',
    'profile.langModalDesc': 'Choose the language you want to see the texts in:',
    'profile.langSaved': 'Language preference saved!',

    // Common & Quests & Payout
    'common.close': 'Close',
    'common.confirm': 'Confirm',
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.copied': 'Copied to clipboard!',
    'quests.title': 'Quests & Missions',
    'quests.watchAdsTitle': 'Watch 30 Ads Daily',
    'payout.title': 'Deposit & Withdrawal',
    'payout.activate': 'Activate Withdrawals',
    'payout.freeAdPass': 'Free Ad Pass (Watch 30 Ads/Day for 5 Days)',
  },

  fa: {
    // Navigation
    'nav.home': 'خانه',
    'nav.quests': 'ماموریت‌ها',
    'nav.store': 'فروشگاه',
    'nav.payout': 'برداشت',
    'nav.profile': 'پروفایل',

    // Header
    'header.level': 'سطح',
    'header.tomcoins': 'تام‌کوین',

    // Home
    'home.activeMining': 'استخراج فعال',
    'home.hourlyProduction': 'تولید ساعتی',
    'home.miningRate': 'سرعت استخراج',
    'home.feedTomBtn': 'غذا دادن به تام (+۱۰/ساعت)',
    'home.feedTomDesc': 'با دادن بیسکویت به تام سرعت استخراج را افزایش دهید و تام‌کوین کسب کنید',
    'home.spinWheel': 'گردونه شانس',
    'home.spinDesc': 'برنده تام‌کوین، بیسکویت و افزایش سرعت استخراج شوید',
    'home.claim': 'دریافت',
    'home.claimTitle': 'تام‌کوین‌های ذخیره شده',
    'home.claimSub': 'تولید شده توسط سیستم استخراج سلطنتی',
    'home.readyToClaim': 'آماده دریافت',

    // Profile & User Menu
    'profile.title': 'پروفایل و تنظیمات',
    'profile.guest': 'بازیکن مهمان',
    'profile.playerId': 'شناسه بازیکن',
    'profile.myStats': 'آمار و سوابق من',
    'profile.myStatsSub': 'مجموع بیسکویت‌ها، ماموریت‌ها و دستاوردها',
    'profile.referral': 'برنامه معرفی دوستان',
    'profile.referralSub': 'دعوت از دوستان و دریافت تام‌کوین',
    'profile.sound': 'افکت‌های صوتی',
    'profile.soundSub': 'صدای کرانچ، سکه و پیروزی',
    'profile.language': 'زبان برنامه',
    'profile.languageSub': 'تغییر زبان (انگلیسی، فارسی، روسی، فرانسوی)',
    'profile.support': 'پشتیبانی ۲۴/۷',
    'profile.supportSub': 'پاسخگویی زنده و راهنمایی برداشت',
    'profile.faq': 'راهنما و سوالات متداول',
    'profile.faqSub': 'نحوه بازی، قوانین استخراج و تبدیل ارز',
    'profile.about': 'درباره سوپرتام',
    'profile.aboutSub': 'توکنومیکس، نقشه راه و اصالت پروژه',
    'profile.langModalTitle': 'انتخاب زبان',
    'profile.langModalDesc': 'زبان مورد نظر خود را برای نمایش متون انتخاب کنید:',
    'profile.langSaved': 'زبان با موفقیت ذخیره شد!',

    // Common & Quests & Payout
    'common.close': 'بستن',
    'common.confirm': 'تایید',
    'common.cancel': 'انصراف',
    'common.save': 'ذخیره',
    'common.copied': 'در کلیپ‌بورد کپی شد!',
    'quests.title': 'ماموریت‌ها و جوایز',
    'quests.watchAdsTitle': 'مشاهده روزانه ۳۰ تبلیغ',
    'payout.title': 'واریز و برداشت',
    'payout.activate': 'فعال‌سازی برداشت',
    'payout.freeAdPass': 'مجوز رایگان تبلیغات (مشاهده ۳۰ تبلیغ روزانه به مدت ۵ روز)',
  },

  ru: {
    // Navigation
    'nav.home': 'Главная',
    'nav.quests': 'Задания',
    'nav.store': 'Магазин',
    'nav.payout': 'Выплаты',
    'nav.profile': 'Профиль',

    // Header
    'header.level': 'Ур.',
    'header.tomcoins': 'TomCoins',

    // Home
    'home.activeMining': 'Активный майнинг',
    'home.hourlyProduction': 'Добыча в час',
    'home.miningRate': 'Скорость добычи',
    'home.feedTomBtn': 'КОРМИТЬ ТОМА (+10/Ч)',
    'home.feedTomDesc': 'Кормите Короля Тома печеньем, чтобы ускорить майнинг и заработать TomCoins',
    'home.spinWheel': 'Колесо Фортуны',
    'home.spinDesc': 'Выигрывайте TomCoins, печенье и бусты майнинга',
    'home.claim': 'Забрать',
    'home.claimTitle': 'Несобранные TomCoins',
    'home.claimSub': 'Накоплено благодаря королевскому майнингу',
    'home.readyToClaim': 'Готово к получению',

    // Profile & User Menu
    'profile.title': 'Профиль и настройки',
    'profile.guest': 'Гость',
    'profile.playerId': 'ID игрока',
    'profile.myStats': 'Моя статистика',
    'profile.myStatsSub': 'Кормления, миссии и достижения',
    'profile.referral': 'Реферальная программа',
    'profile.referralSub': 'Приглашайте друзей и получайте TomCoins',
    'profile.sound': 'Звуковые эффекты',
    'profile.soundSub': 'Звуки хруста, монет и победы',
    'profile.language': 'Язык интерфейса',
    'profile.languageSub': 'Сменить язык (English, فارسی, Русский, Français)',
    'profile.support': 'Служба поддержки',
    'profile.supportSub': 'Круглосуточная помощь 24/7 и консультации',
    'profile.faq': 'Помощь и FAQ',
    'profile.faqSub': 'Как играть, правила майнинга и вывод средств',
    'profile.about': 'О проекте SuperTom',
    'profile.aboutSub': 'Токеномика, дорожная карта и смарт-контракты',
    'profile.langModalTitle': 'Выберите язык',
    'profile.langModalDesc': 'Выберите язык, на котором хотите видеть тексты в приложении:',
    'profile.langSaved': 'Языковые настройки сохранены!',

    // Common & Quests & Payout
    'common.close': 'Закрыть',
    'common.confirm': 'Подтвердить',
    'common.cancel': 'Отмена',
    'common.save': 'Сохранить',
    'common.copied': 'Скопировано в буфер обмена!',
    'quests.title': 'Задания и награды',
    'quests.watchAdsTitle': 'Смотреть 30 реклам ежедневно',
    'payout.title': 'Депозит и вывод',
    'payout.activate': 'Активировать вывод',
    'payout.freeAdPass': 'Бесплатный пропуск (30 реклам в день в течение 5 дней)',
  },

  fr: {
    // Navigation
    'nav.home': 'Accueil',
    'nav.quests': 'Quêtes',
    'nav.store': 'Boutique',
    'nav.payout': 'Retraits',
    'nav.profile': 'Profil',

    // Header
    'header.level': 'Niv.',
    'header.tomcoins': 'TomCoins',

    // Home
    'home.activeMining': 'Minage Actif',
    'home.hourlyProduction': 'Production Horaire',
    'home.miningRate': 'Taux de Minage',
    'home.feedTomBtn': 'NOURRIR TOM (+10/H)',
    'home.feedTomDesc': 'Donnez des biscuits au Roi Tom pour booster votre vitesse et gagner des TomCoins',
    'home.spinWheel': 'Roue de la Chance',
    'home.spinDesc': 'Gagnez des TomCoins, des biscuits et des multiplicateurs',
    'home.claim': 'Réclamer',
    'home.claimTitle': 'TomCoins en attente',
    'home.claimSub': 'Accumulés grâce au minage félin royal',
    'home.readyToClaim': 'Prêt à être réclamé',

    // Profile & User Menu
    'profile.title': 'Profil & Paramètres',
    'profile.guest': 'Invité',
    'profile.playerId': 'ID Joueur',
    'profile.myStats': 'Mes Statistiques',
    'profile.myStatsSub': 'Total des repas, missions et succès',
    'profile.referral': 'Programme de Parrainage',
    'profile.referralSub': 'Invitez des amis et gagnez des TomCoins',
    'profile.sound': 'Effets Sonores',
    'profile.soundSub': 'Bruitages de croquettes, pièces et fanfares',
    'profile.language': 'Langue',
    'profile.languageSub': 'Changer la langue (English, فارسی, Русский, Français)',
    'profile.support': 'Support Client 24/7',
    'profile.supportSub': 'Assistance en direct & Aide aux paiements',
    'profile.faq': 'Aide & FAQ',
    'profile.faqSub': 'Règles du jeu, minage et conversions',
    'profile.about': 'À Propos de SuperTom',
    'profile.aboutSub': 'Tokenomics, feuille de route et vérification',
    'profile.langModalTitle': 'Choisir la Langue',
    'profile.langModalDesc': 'Sélectionnez la langue dans laquelle vous souhaitez afficher les textes :',
    'profile.langSaved': 'Préférence de langue enregistrée !',

    // Common & Quests & Payout
    'common.close': 'Fermer',
    'common.confirm': 'Confirmer',
    'common.cancel': 'Annuler',
    'common.save': 'Enregistrer',
    'common.copied': 'Copié dans le presse-papier !',
    'quests.title': 'Quêtes & Missions',
    'quests.watchAdsTitle': 'Regarder 30 publicités par jour',
    'payout.title': 'Dépôt & Retrait',
    'payout.activate': 'Activer les Retraits',
    'payout.freeAdPass': 'Pass Pub Gratuit (30 pubs/jour pendant 5 jours)',
  },
};

