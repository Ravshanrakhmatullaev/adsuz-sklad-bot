const SUPABASE_URL = 'https://jxxmbgmbaqausqunfyna.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4eG1iZ21iYXFhdXNxdW5meW5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA0MjA3NzksImV4cCI6MjA2NTk5Njc3OX0.G3bULfygRDeqZxOdBDUop296K60_cWCVLFBCZfXkWPo';
const BOT_TOKEN = '8636816129:AAE-sBNfcLy8e4EXqepHhDfhHG_p6PDZPxU';
const CHAT_ID = '-4273189072';
const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function sbFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': options.method === 'POST' ? 'return=representation' : '',
      ...(options.headers || {})
    }
  });
  return res.json();
}

async function tgCall(method, body) {
  const res = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

async function handleCallback(query) {
  const data = query.data;
  const msgId = query.message.message_id;
  const userName = query.from.first_name + (query.from.last_name ? ' ' + query.from.last_name : '');

  if (data.startsWith('search_')) {
    const itemId = data.replace('search_', '');

    await tgCall('editMessageReplyMarkup', {
      chat_id: CHAT_ID,
      message_id: msgId,
      reply_markup: {
        inline_keyboard: [[
          { text: '✅ Oldim', callback_data: `got_${itemId}` },
          { text: '❌ Topilmadi', callback_data: `notfound_${itemId}` },
          { text: '⚡ Qisman', callback_data: `partial_${itemId}` }
        ]]
      }
    });

    await tgCall('answerCallbackQuery', { callback_query_id: query.id, text: `${userName} qidirayapti...` });

    await tgCall('sendMessage', {
      chat_id: CHAT_ID,
      text: `🔍 *${userName}* qidirayapti...`,
      parse_mode: 'Markdown',
      reply_to_message_id: msgId
    });
  }

  else if (data.startsWith('got_')) {
    const itemId = data.replace('got_', '');
    const items = await sbFetch(`bozorlik_list?id=eq.${itemId}&select=*`);
    const item = items && items[0];

    if (item && item.sklad_id) {
      await sbFetch('sklad_harakati', {
        method: 'POST',
        body: JSON.stringify({
          sklad_id: item.sklad_id,
          tur: 'prixod',
          miqdor: item.miqdor,
          sabab: `Bozordan olindi — ${userName}`,
          user_email: 'bot@adsuz.uz',
          user_name: userName,
          sana: new Date().toLocaleString('uz-UZ')
        })
      });
    }

    if (item) {
      await sbFetch(`bozorlik_list?id=eq.${itemId}`, {
        method: 'PATCH',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify({ status: 'olindi', olgan_kishi: userName })
      });
    }

    await tgCall('editMessageReplyMarkup', {
      chat_id: CHAT_ID, message_id: msgId,
      reply_markup: { inline_keyboard: [] }
    });
    await tgCall('answerCallbackQuery', { callback_query_id: query.id, text: 'Ajoyib!' });
    await tgCall('sendMessage', {
      chat_id: CHAT_ID,
      text: `✅ *${userName}* oldi! Sklad avtomatik yangilandi.`,
      parse_mode: 'Markdown',
      reply_to_message_id: msgId
    });
  }

  else if (data.startsWith('notfound_')) {
    const itemId = data.replace('notfound_', '');

    await sbFetch(`bozorlik_list?id=eq.${itemId}`, {
      method: 'PATCH',
      headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify({ status: 'topilmadi', olgan_kishi: userName })
    });

    await tgCall('editMessageReplyMarkup', {
      chat_id: CHAT_ID, message_id: msgId,
      reply_markup: { inline_keyboard: [] }
    });
    await tgCall('answerCallbackQuery', { callback_query_id: query.id, text: 'Belgilandi' });
    await tgCall('sendMessage', {
      chat_id: CHAT_ID,
      text: `❌ *${userName}*: topilmadi.`,
      parse_mode: 'Markdown',
      reply_to_message_id: msgId
    });
  }

  else if (data.startsWith('partial_')) {
    await tgCall('editMessageReplyMarkup', {
      chat_id: CHAT_ID, message_id: msgId,
      reply_markup: { inline_keyboard: [] }
    });
    await tgCall('answerCallbackQuery', { callback_query_id: query.id, text: 'Miqdorni yozing' });
    await tgCall('sendMessage', {
      chat_id: CHAT_ID,
      text: `⚡ *${userName}* qisman oldi. Nechta olganingizni yozing:`,
      parse_mode: 'Markdown',
      reply_to_message_id: msgId
    });
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true, message: 'AdsUz Sklad Bot ishlayapti!' });
  }
  try {
    const body = req.body;
    if (body.callback_query) {
      await handleCallback(body.callback_query);
    }
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(200).json({ ok: true });
  }
}
