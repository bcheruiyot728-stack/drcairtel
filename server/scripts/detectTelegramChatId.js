const fs = require('fs');
const path = require('path');
const https = require('https');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = envContent
  .split(/\r?\n/)
  .reduce((acc, line) => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) acc[match[1].trim()] = match[2].trim();
    return acc;
  }, {});

const botToken = env.TELEGRAM_BOT_TOKEN;
const currentChatId = env.TELEGRAM_CHAT_ID;

if (!botToken) {
  console.error('No TELEGRAM_BOT_TOKEN found in server/.env');
  process.exit(1);
}

if (!currentChatId || currentChatId === 'YOUR_CHAT_ID_HERE') {
  console.log('Attempting to auto-detect TELEGRAM_CHAT_ID from Telegram getUpdates...');
} else {
  console.log(`TELEGRAM_CHAT_ID is already set to ${currentChatId}.`);
  process.exit(0);
}

const url = `https://api.telegram.org/bot${botToken}/getUpdates`;

https.get(url, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      if (!json.ok) {
        console.error('Telegram API error:', json.description || JSON.stringify(json));
        process.exit(1);
      }

      const ids = new Set();
      for (const update of json.result || []) {
        const chat =
          update.message?.chat ||
          update.edited_message?.chat ||
          update.channel_post?.chat ||
          update.edited_channel_post?.chat ||
          update.callback_query?.message?.chat ||
          update.inline_query?.from ||
          update.chosen_inline_result?.from;
        if (chat?.id) {
          ids.add(chat.id);
        }
      }

      if (!ids.size) {
        console.error('No chat IDs found. Send a message to the bot or group first, then retry.');
        process.exit(1);
      }

      const chatIds = [...ids];
      const chatId = chatIds[0];
      const updatedContent = envContent.replace(/^(TELEGRAM_CHAT_ID\s*=\s*).*/m, `$1${chatId}`);

      if (updatedContent !== envContent) {
        fs.writeFileSync(envPath, updatedContent, 'utf8');
        console.log(`Updated TELEGRAM_CHAT_ID in server/.env to ${chatId}`);
      } else {
        console.log('TELEGRAM_CHAT_ID already matches detected value.');
      }

      if (chatIds.length > 1) {
        console.log('Multiple chat IDs found:', chatIds.join(', '));
      }
    } catch (error) {
      console.error('Failed to parse Telegram response:', error.message);
      console.error('Raw response:', data);
      process.exit(1);
    }
  });
}).on('error', (error) => {
  console.error('Request failed:', error.message);
  process.exit(1);
});
