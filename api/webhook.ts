import { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

// 設定環境變數（請在 Vercel 後台填入對應的 ID）
const LINE_ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN;
const MENU_MAIN = process.env.MENU_MAIN; // 圖一 ID
const MENU_SOCIAL = process.env.MENU_SOCIAL; // 圖二 ID
const MENU_TEXTBOOK = process.env.MENU_TEXTBOOK; // 圖三 ID

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(200).send('OK');

  const event = req.body.events[0];
  if (!event) return res.status(200).send('OK');

  const userId = event.source.userId;

  // 1. 處理 Postback 動作 (選單切換、列出解答)
  if (event.type === 'postback') {
    const data = new URLSearchParams(event.postback.data);
    const action = data.get('action');

    // --- A. 切換選單邏輯 ---
    if (action === 'switch') {
      const target = data.get('target');
      let menuId = MENU_MAIN;
      if (target === 'social') menuId = MENU_SOCIAL;
      if (target === 'textbook') menuId = MENU_TEXTBOOK;

      await axios.post(`https://api.line.me/v2/bot/user/${userId}/richmenu/${menuId}`, {}, {
        headers: { Authorization: `Bearer ${LINE_ACCESS_TOKEN}` }
      });
    }

    // --- B. 列出解答邏輯 (Flex Message) ---
    if (action === 'list') {
      const subject = data.get('subject');
      // 這裡去 Firebase 抓取該科目的解答清單，然後組合 Flex Message
      await sendAnswerList(event.replyToken, subject, userId);
    }
  }

  // 2. 處理文字訊息 (座號綁定與姓名確認)
  if (event.type === 'message' && event.message.type === 'text') {
    const text = event.message.text.trim();
    if (/^\d+$/.test(text)) { // 如果輸入純數字（座號）
      await handleBindingSearch(event.replyToken, text);
    }
  }

  return res.status(200).send('OK');
}

// 模擬 Firebase 紀錄觀看時間的邏輯
async function recordClick(userId: string, subject: string) {
  // Firebase 寫入邏輯：db.ref('logs').push({ userId, subject, time: Date.now() });
  console.log(`User ${userId} viewed ${subject}`);
}
