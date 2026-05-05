import { VercelRequest, VercelResponse } from '@vercel/node';
import * as line from '@line/bot-sdk';
import admin from 'firebase-admin';

// 初始化 Firebase (請確保已在 Vercel 設定私鑰環境變數)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!)),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
}

const db = admin.database();
const client = new line.messagingApi.MessagingApiClient({ channelAccessToken: process.env.LINE_ACCESS_TOKEN! });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const events = req.body.events;
  for (const event of events) {
    const userId = event.source.userId;

    // 1. 處理文字訊息：座號綁定邏輯
    if (event.type === 'message' && event.message.type === 'text') {
      const text = event.message.text.trim();
      if (/^\d+$/.test(text)) { // 如果是純數字座號
        const snapshot = await db.ref(`students/${text}`).once('value');
        const student = snapshot.val();

        if (student) {
          // 發送姓名確認卡片 (Confirm Template)
          await client.replyMessage({
            replyToken: event.replyToken,
            messages: [{
              type: 'template',
              altText: '身分確認',
              template: {
                type: 'confirm',
                text: `你是 ${text} 號 ${student.name} 同學嗎？`,
                actions: [
                  { type: 'postback', label: '是的', data: `action=bind&no=${text}&name=${student.name}`, displayText: '是的，這是我' },
                  { type: 'postback', label: '不是', data: 'action=ignore', displayText: '抱歉，我輸錯了' }
                ]
              }
            }]
          });
        }
      }
    }

    // 2. 處理 Postback：選單切換與綁定成功
    if (event.type === 'postback') {
      const params = new URLSearchParams(event.postback.data);
      const action = params.get('action');

      if (action === 'bind') {
        const no = params.get('no');
        const name = params.get('name');
        // 紀錄綁定資訊
        await db.ref(`users/${userId}`).set({ no, name, boundAt: Date.now() });
        // 綁定成功後瞬間「變臉」切換到主選單
        await client.linkRichMenuToUser({ userId, richMenuId: process.env.MENU_MAIN! });
        await client.replyMessage({
          replyToken: event.replyToken,
          messages: [{ type: 'text', text: `✅ 綁定成功！${name} 同學，歡迎使用系統。` }]
        });
      }

      if (action === 'switch') {
        const target = params.get('target');
        const menuId = target === 'social' ? process.env.MENU_SOCIAL : (target === 'textbook' ? process.env.MENU_TEXTBOOK : process.env.MENU_MAIN);
        await client.linkRichMenuToUser({ userId, richMenuId: menuId! });
      }

      if (action === 'list') {
        const subject = params.get('subject');
        // 這裡實作從 Firebase 撈取解答並回傳 Flex Message 的邏輯
        await sendAnswerFlex(event.replyToken, subject!, userId);
      }
    }
  }
  return res.status(200).send('OK');
}

async function sendAnswerFlex(replyToken: string, subject: string, userId: string) {
  // 這裡回傳一個帶有 LIFF 連結的按鈕，用於追蹤時間
  // 連結格式：https://liff.line.me/YOUR_LIFF_ID?url=解答網址&sub=科目
}
