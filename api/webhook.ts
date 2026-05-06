import { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import { db } from './firebase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(200).send('OK');
  
  const events = req.body.events;
  if (!events || events.length === 0) return res.status(200).send('OK');

  const LINE_TOKEN = process.env.LINE_ACCESS_TOKEN;

  for (const event of events) {
    if (event.type === 'message' && event.message.type === 'text') {
      const text = event.message.text.trim();
      const userId = event.source.userId;
      const replyToken = event.replyToken;

      try {
        // 1. 選單切換邏輯
        if (text === '社會') {
          await switchMenu(userId, process.env.MENU_SOCIAL, LINE_TOKEN);
          await replyText(replyToken, LINE_TOKEN, '✅ 已為您切換至「社會」選單');
          continue;
        } 
        if (text === '課本') {
          await switchMenu(userId, process.env.MENU_TEXTBOOK, LINE_TOKEN);
          await replyText(replyToken, LINE_TOKEN, '✅ 已為您切換至「課本」選單');
          continue;
        }

        // 2. 解答查詢邏輯 (從 Firebase 抓取)
        const snap = await db.ref(`answers/${text}`).once('value');
        if (snap.exists()) {
          const answerData = snap.val();
          await replyText(replyToken, LINE_TOKEN, `📖 為您找到解答連結：\n${answerData.url}`);
        }

      } catch (e) { console.error(e); }
    }
  }
  return res.status(200).send('OK');
}

async function switchMenu(userId: string, menuId: string | undefined, token: string | undefined) {
  if (!menuId) return;
  await axios.post(`https://api.line.me/v2/bot/user/${userId}/richmenu/${menuId}`, {}, { headers: { Authorization: `Bearer ${token}` } });
}

async function replyText(replyToken: string, token: string | undefined, text: string) {
  await axios.post('https://api.line.me/v2/bot/message/reply', { replyToken, messages: [{ type: 'text', text }] }, { headers: { Authorization: `Bearer ${token}` } });
}
