import { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

const LINE_API = 'https://api.line.me/v2/bot';
const HEADERS = {
  'Authorization': `Bearer ${process.env.LINE_ACCESS_TOKEN}`,
  'Content-Type': 'application/json'
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const event = req.body.events[0];
  if (!event) return res.status(200).send('OK');

  const userId = event.source.userId;

  // 1. 處理 Postback (切換選單與功能)
  if (event.type === 'postback') {
    const data = new URLSearchParams(event.postback.data);
    const action = data.get('action');

    // 切換選單
    if (action === 'switch') {
      const target = data.get('target');
      const menuId = target === 'social' ? process.env.MENU_SOCIAL : 
                     target === 'textbook' ? process.env.MENU_TEXTBOOK : process.env.MENU_MAIN;
      
      await axios.post(`${LINE_API}/user/${userId}/richmenu/${menuId}`, {}, { headers: HEADERS });
    }

    // 顯示解答清單 (Flex Message)
    if (action === 'list') {
      const subject = data.get('subject');
      // 這裡實作回傳 Flex Message 的邏輯
      await reply(event.replyToken, [{ type: 'text', text: `正在查詢${subject}的解答...` }]);
    }
  }

  // 2. 處理文字 (座號綁定)
  if (event.type === 'message' && event.message.type === 'text') {
    const text = event.message.text.trim();
    if (/^\d+$/.test(text)) {
      // 這裡可以傳送確認身分的 Template 訊息
      await reply(event.replyToken, [{ type: 'text', text: `您輸入的座號是 ${text}，請確認身分。` }]);
    }
  }

  return res.status(200).send('OK');
}

async function reply(token: string, messages: any[]) {
  await axios.post(`${LINE_API}/message/reply`, { replyToken: token, messages }, { headers: HEADERS });
}
