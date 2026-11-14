import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  TelegramBotController,
  BOT_TRANSLATIONS,
} from '../dist/modules/telegramBot/telegramBotController.js';

describe('Telegram Bot Multi-Language System Suite', () => {
  describe('1. Multilingual Language Prompt', () => {
    test('should present all 4 supported languages (English, Farsi, Russian, French)', () => {
      const { text, inlineKeyboard } = TelegramBotController.renderLanguagePrompt();

      assert.ok(text.includes('Choose Your Language'));
      assert.ok(text.includes('زبان خود را انتخاب کنید'));
      assert.ok(text.includes('Выберите язык'));
      assert.ok(text.includes('Choisissez votre langue'));

      assert.equal(inlineKeyboard.length, 2);
      assert.equal(inlineKeyboard[0].length, 2);
      assert.equal(inlineKeyboard[1].length, 2);

      // Row 1: English & Farsi
      assert.equal(inlineKeyboard[0][0].text, '🇬🇧 English');
      assert.equal(inlineKeyboard[0][0].callback_data, 'set_lang:en');
      assert.equal(inlineKeyboard[0][1].text, '🇮🇷 فارسی');
      assert.equal(inlineKeyboard[0][1].callback_data, 'set_lang:fa');

      // Row 2: Russian & French
      assert.equal(inlineKeyboard[1][0].text, '🇷🇺 Русский');
      assert.equal(inlineKeyboard[1][0].callback_data, 'set_lang:ru');
      assert.equal(inlineKeyboard[1][1].text, '🇫🇷 Français');
      assert.equal(inlineKeyboard[1][1].callback_data, 'set_lang:fr');
    });

    test('should preserve referral code in callback_data when present', () => {
      const refCode = 'TOMVIP99';
      const { inlineKeyboard } = TelegramBotController.renderLanguagePrompt(refCode);

      assert.equal(inlineKeyboard[0][0].callback_data, 'set_lang:en:TOMVIP99');
      assert.equal(inlineKeyboard[0][1].callback_data, 'set_lang:fa:TOMVIP99');
      assert.equal(inlineKeyboard[1][0].callback_data, 'set_lang:ru:TOMVIP99');
      assert.equal(inlineKeyboard[1][1].callback_data, 'set_lang:fr:TOMVIP99');
    });
  });

  describe('2. Perfectly Translated Bot Content Per Language', () => {
    test('English welcome message and action buttons', async () => {
      const { text, inlineKeyboard } = await TelegramBotController.renderWelcomeMessage('en', {
        firstName: 'Alex',
        isReturningUser: false,
      });

      assert.ok(text.includes('WELCOME TO SUPERTOM!'));
      assert.ok(text.includes('Welcome, <b>Alex</b>!'));
      assert.ok(text.includes('Feed Tom'));
      assert.ok(text.includes('Open SuperTom'));

      // Check change language button exists in Row 3
      assert.equal(inlineKeyboard[2][0].text, '🌐 Change Language');
      assert.equal(inlineKeyboard[2][0].callback_data, 'prompt_lang');
    });

    test('Farsi (Persian) welcome message and action buttons', async () => {
      const { text, inlineKeyboard } = await TelegramBotController.renderWelcomeMessage('fa', {
        firstName: 'علی',
        isReturningUser: false,
      });

      assert.ok(text.includes('به سوپرتام خوش آمدید!'));
      assert.ok(text.includes('خوش آمدید، <b>علی</b> عزیز!'));
      assert.ok(text.includes('غذا دادن به تام'));
      assert.ok(text.includes('ورود به سوپرتام'));

      // Check change language button exists
      assert.equal(inlineKeyboard[2][0].text, '🌐 تغییر زبان');
      assert.equal(inlineKeyboard[2][0].callback_data, 'prompt_lang');
    });

    test('Russian welcome message and action buttons', async () => {
      const { text, inlineKeyboard } = await TelegramBotController.renderWelcomeMessage('ru', {
        firstName: 'Иван',
        isReturningUser: true,
      });

      assert.ok(text.includes('ДОБРО ПОЖАЛОВАТЬ В SUPERTOM!'));
      assert.ok(text.includes('С возвращением, <b>Иван</b>!'));
      assert.ok(text.includes('Кормить Тома'));
      assert.ok(text.includes('Открыть SuperTom'));

      // Check change language button exists
      assert.equal(inlineKeyboard[2][0].text, '🌐 Сменить язык');
      assert.equal(inlineKeyboard[2][0].callback_data, 'prompt_lang');
    });

    test('French welcome message and action buttons', async () => {
      const { text, inlineKeyboard } = await TelegramBotController.renderWelcomeMessage('fr', {
        firstName: 'Pierre',
        isReturningUser: false,
      });

      assert.ok(text.includes('BIENVENUE SUR SUPERTOM !'));
      assert.ok(text.includes('Bienvenue, <b>Pierre</b> !'));
      assert.ok(text.includes('Nourrir Tom'));
      assert.ok(text.includes('Ouvrir SuperTom'));

      // Check change language button exists
      assert.equal(inlineKeyboard[2][0].text, '🌐 Changer de langue');
      assert.equal(inlineKeyboard[2][0].callback_data, 'prompt_lang');
    });
  });

  describe('3. Mini App URL Language Parameterization', () => {
    test('should include selected lang code in mini app URL', () => {
      const urlEn = TelegramBotController.resolveMiniAppUrl(null, 'en');
      assert.ok(urlEn.includes('lang=en'));

      const urlFa = TelegramBotController.resolveMiniAppUrl('REF123', 'fa');
      assert.ok(urlFa.includes('lang=fa'));
      assert.ok(urlFa.includes('startapp=REF123'));

      const urlRu = TelegramBotController.resolveMiniAppUrl(null, 'ru');
      assert.ok(urlRu.includes('lang=ru'));

      const urlFr = TelegramBotController.resolveMiniAppUrl(null, 'fr');
      assert.ok(urlFr.includes('lang=fr'));
    });
  });
});
