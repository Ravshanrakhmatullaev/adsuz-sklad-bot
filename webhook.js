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
      'Prefer': options.method === 'PATCH' ? 'return=minimal' : (options.method === 'POST' ? 'return=representation' : ''),
      ...(options.headers || {})
    }
  });
  if(res.status === 204) return null;
  try { return await res.json(); } catch(e) { return null; }
}

async function tg(method, body) {
  const res = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

async function handleCallback(query) {
  const data = query.data || '';
  const msgId = query.message.message_id;
  const chatId = query.message.chat.id;
  const userName = query.from.first_name + (query.from.last_name ? ' ' + query.from.last_name : '');

  // ── Qidirayapman ──
  if (data.startsWith('search_')) {
    const itemId = data.replace('search_', '');
    await tg('editMessageReplyMarkup', {
      chat_id: chatId, message_id: msgId,
      reply_markup: { inline_keyboard: [[
        { text: '✅ Oldim', callback_data: `got_${itemId}` },
        { text: '❌ Topilmadi', callback_data: `notfound_${itemId}` },
        { text: '⚡ Qisman', callback_data: `partial_${itemId}` }
      ]]}
    });
    await tg('sendMessage', {
      chat_id: chatId,
      text: `🔍 <b>${userName}</b> qidirayapti...`,
      parse_mode: 'HTML',
      reply_to_message_id: msgId
    });
    await tg('answerCallbackQuery', { callback_query_id: query.id, text: 'Qidirayapsiz...' });
  }

  // ── Oldim ──
  else if (data.startsWith('got_')) {
    const itemId = data.replace('got_', '');
    const items = await sbFetch(`bozorlik_list?id=eq.${itemId}&select=*`);
    const item = items && items[0];

    if (item) {
      // Status yangilash
      await sbFetch(`bozorlik_list?id=eq.${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'olindi', olgan_kishi: userName })
      });

      // Sklad prixod (agar sklad_id bo'lsa)
      if (item.sklad_id) {
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
    }

    await tg('editMessageReplyMarkup', { chat_id: chatId, message_id: msgId, reply_markup: { inline_keyboard: [] } });
    await tg('sendMessage', {
      chat_id: chatId,
      text: `✅ <b>${userName}</b> oldi! ${item && item.sklad_id ? 'Sklad yangilandi.' : ''}`,
      parse_mode: 'HTML',
      reply_to_message_id: msgId
    });
    await tg('answerCallbackQuery', { callback_query_id: query.id, text: '✅ Bajarildi!' });
  }

  // ── Topilmadi ──
  else if (data.startsWith('notfound_')) {
    const itemId = data.replace('notfound_', '');
    await sbFetch(`bozorlik_list?id=eq.${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'topilmadi', olgan_kishi: userName })
    });
    await tg('editMessageReplyMarkup', { chat_id: chatId, message_id: msgId, reply_markup: { inline_keyboard: [] } });
    await tg('sendMessage', {
      chat_id: chatId,
      text: `❌ <b>${userName}</b>: topilmadi.`,
      parse_mode: 'HTML',
      reply_to_message_id: msgId
    });
    await tg('answerCallbackQuery', { callback_query_id: query.id, text: '❌ Belgilandi' });
  }

  // ── Qisman ──
  else if (data.startsWith('partial_')) {
    const itemId = data.replace('partial_', '');
    await sbFetch(`bozorlik_list?id=eq.${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'qisman', olgan_kishi: userName })
    });
    await tg('editMessageReplyMarkup', { chat_id: chatId, message_id: msgId, reply_markup: { inline_keyboard: [] } });
    await tg('sendMessage', {
      chat_id: chatId,
      text: `⚡ <b>${userName}</b> qisman oldi. Nechta olganingizni yozing:`,
      parse_mode: 'HTML',
      reply_to_message_id: msgId
    });
    await tg('answerCallbackQuery', { callback_query_id: query.id, text: '⚡ Miqdorni yozing' });
  }
}

// ── Frontenddan xabar yuborish ──
async function handleSend(body) {
  const text = (body.text || '').slice(0, 4096);
  if (!text) return { ok: false, error: "text maydon bo'sh" };
  const chatId = body.chat_id || CHAT_ID;
  const result = await tg('sendMessage', {
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML',
  });
  return result;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, message: 'AdsUz Bot ishlayapti!' });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false });
  }
  try {
    const body = req.body;

    // Frontend dan to'g'ridan xabar yuborish: { text: '...' }
    if (body.text && !body.callback_query && !body.message) {
      const result = await handleSend(body);
      if (result && result.ok) {
        return res.status(200).json({ ok: true, message_id: result.result && result.result.message_id });
      }
      return res.status(500).json({ ok: false, error: (result && result.description) || 'Telegram xato' });
    }

    // Telegram bot webhook events
    if (body.callback_query) {
      await handleCallback(body.callback_query);
    }
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Bot error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}
