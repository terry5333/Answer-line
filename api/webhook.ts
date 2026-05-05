import { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

// 建立帶有驗證 Header 的 axios 實例，避免重複寫
const lineClient = axios.create({
  baseURL: 'https://api.line.me/v2/bot',
  headers: {
    'Authorization': `Bearer ${process.env.LINE_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. 只接受 POST 請求
  if (req.method !== 'POST') {
    return res.status(200).send('Method Not Allowed, but OK for LINE');
  }

  try {
    const events = req.body.events;

    // 🌟 2. 終極防呆：處理 LINE 後台的 Verify 測試請求 (空陣列)
    if (!events || events.length === 0) {
      console.log('✅ 收到 LINE 驗證請求，成功回傳 200');
      return res.status(200).send('OK');
    }

    // 3. 處理每一個傳進來的事件
    for (const event of events) {
      const userId = event.source.userId;

      // ==========================================
      //        處理 Postback (圖文選單點擊事件)
      // ==========================================
      if (event.type === 'postback') {
        const data = new URLSearchParams(event.postback.data);
        const action = data.get('action');

        // 👉 功能 A：切換選單 (變臉)
        if (action === 'switch') {
          const target = data.get('target');
          let targetMenuId = '';

          if (target === 'main') targetMenuId = process.env.MENU_MAIN;
          if (target === 'social') targetMenuId = process.env.MENU_SOCIAL;
          if (target === 'textbook') targetMenuId = process.env.MENU_TEXTBOOK;

          if (targetMenuId) {
            await lineClient.post(`/user/${userId}/richmenu/${targetMenuId}`);
            console.log(`已將用戶 ${userId} 切換至 ${target} 選單`);
          }
        }

        // 👉 功能 B：點擊科目，推播解答列表 (Flex Message)
        if (action === 'list') {
          const subject = data.get('subject');
          
          // 這裡先放一組公版的 Carousel Flex Message，之後可以串 Firebase 動態替換
          await lineClient.post('/message/reply', {
            replyToken: event.replyToken,
            messages: [
              {
                type: 'flex',
                altText: `查看 ${subject} 解答`,
                contents: {
                  type: 'carousel',
                  contents: [
                    {
                      type: 'bubble',
                      size: 'micro',
                      header: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                          { type: 'text', text: `${subject.toUpperCase()} 解答`, weight: 'bold', color: '#ffffff' }
                        ],
                        backgroundColor: '#3b82f6'
                      },
                      body: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                          { type: 'text', text: '第一章 課後練習', size: 'sm', wrap: true }
                        ]
                      },
                      footer: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                          {
                            type: 'button',
                            action: { type: 'uri', label: '點我看解答', uri: 'https://google.com' }, // 替換成真實網址
                            style: 'primary',
                            color: '#3b82f6'
                          }
                        ]
                      }
                    }
                  ] // end of contents array
                }
              }
            ]
          });
        }

        // 👉 功能 C：開啟課本 (網址)
        if (action === 'view' && data.get('type') === 'textbook') {
          const subject = data.get('subject');
          
          await lineClient.post('/message/reply', {
            replyToken: event.replyToken,
            messages: [
              {
                type: 'text',
                text: `📚 這是你的 ${subject} 課本連結：\nhttps://example.com/${subject}` // 替換成真實課本連結
              }
            ]
          });
        }
      }
    }

    // 4. 順利執行完畢，一定要回傳 200 給 LINE
    return res.status(200).send('OK');

  } catch (error) {
    // 🌟 5. 錯誤捕捉：印出錯誤讓你看，但依然回傳 200，避免 LINE 無限重傳導致系統癱瘓
    console.error('❌ Webhook 執行發生錯誤:', error?.response?.data || error.message);
    return res.status(200).send('OK');
  }
}
