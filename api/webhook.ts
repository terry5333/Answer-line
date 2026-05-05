import { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

const lineClient = axios.create({
  baseURL: 'https://api.line.me/v2/bot',
  headers: {
    // 加上 as string 告訴系統：我保證這裡會有字串
    'Authorization': `Bearer ${process.env.LINE_ACCESS_TOKEN as string}`,
    'Content-Type': 'application/json',
  },
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(200).send('OK');

  try {
    const events = req.body.events;

    if (!events || events.length === 0) {
      console.log('✅ 收到 LINE 驗證請求，成功回傳 200');
      return res.status(200).send('OK');
    }

    for (const event of events) {
      const userId = event.source.userId;

      if (event.type === 'postback') {
        const data = new URLSearchParams(event.postback.data);
        const action = data.get('action');

        if (action === 'switch') {
          const target = data.get('target');
          let targetMenuId = '';

          // 🌟 使用 as string 強制轉型，解除 TypeScript 警告
          if (target === 'main') targetMenuId = (process.env.MENU_MAIN as string) || '';
          if (target === 'social') targetMenuId = (process.env.MENU_SOCIAL as string) || '';
          if (target === 'textbook') targetMenuId = (process.env.MENU_TEXTBOOK as string) || '';

          if (targetMenuId) {
            await lineClient.post(`/user/${userId}/richmenu/${targetMenuId}`);
          }
        }

        if (action === 'list') {
          // 🌟 確保 subject 絕對是個字串
          const subject = data.get('subject') || '未知科目';
          
          await lineClient.post('/message/reply', {
            replyToken: event.replyToken,
            messages: [{
              type: 'text',
              text: `你點擊了 ${subject} 的解答！`
            }]
          });
        }
      }
    }

    return res.status(200).send('OK');

  } catch (err) {
    // 🌟 將 err 強制轉型為 any，讓它允許讀取 response 屬性
    const error = err as any;
    console.error('❌ Webhook 執行發生錯誤:', error?.response?.data || error?.message || '未知錯誤');
    return res.status(200).send('OK');
  }
}import { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

const lineClient = axios.create({
  baseURL: 'https://api.line.me/v2/bot',
  headers: {
    // 加上 as string 告訴系統：我保證這裡會有字串
    'Authorization': `Bearer ${process.env.LINE_ACCESS_TOKEN as string}`,
    'Content-Type': 'application/json',
  },
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(200).send('OK');

  try {
    const events = req.body.events;

    if (!events || events.length === 0) {
      console.log('✅ 收到 LINE 驗證請求，成功回傳 200');
      return res.status(200).send('OK');
    }

    for (const event of events) {
      const userId = event.source.userId;

      if (event.type === 'postback') {
        const data = new URLSearchParams(event.postback.data);
        const action = data.get('action');

        if (action === 'switch') {
          const target = data.get('target');
          let targetMenuId = '';

          // 🌟 使用 as string 強制轉型，解除 TypeScript 警告
          if (target === 'main') targetMenuId = (process.env.MENU_MAIN as string) || '';
          if (target === 'social') targetMenuId = (process.env.MENU_SOCIAL as string) || '';
          if (target === 'textbook') targetMenuId = (process.env.MENU_TEXTBOOK as string) || '';

          if (targetMenuId) {
            await lineClient.post(`/user/${userId}/richmenu/${targetMenuId}`);
          }
        }

        if (action === 'list') {
          // 🌟 確保 subject 絕對是個字串
          const subject = data.get('subject') || '未知科目';
          
          await lineClient.post('/message/reply', {
            replyToken: event.replyToken,
            messages: [{
              type: 'text',
              text: `你點擊了 ${subject} 的解答！`
            }]
          });
        }
      }
    }

    return res.status(200).send('OK');

  } catch (err) {
    // 🌟 將 err 強制轉型為 any，讓它允許讀取 response 屬性
    const error = err as any;
    console.error('❌ Webhook 執行發生錯誤:', error?.response?.data || error?.message || '未知錯誤');
    return res.status(200).send('OK');
  }
}import { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

const lineClient = axios.create({
  baseURL: 'https://api.line.me/v2/bot',
  headers: {
    // 加上 as string 告訴系統：我保證這裡會有字串
    'Authorization': `Bearer ${process.env.LINE_ACCESS_TOKEN as string}`,
    'Content-Type': 'application/json',
  },
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(200).send('OK');

  try {
    const events = req.body.events;

    if (!events || events.length === 0) {
      console.log('✅ 收到 LINE 驗證請求，成功回傳 200');
      return res.status(200).send('OK');
    }

    for (const event of events) {
      const userId = event.source.userId;

      if (event.type === 'postback') {
        const data = new URLSearchParams(event.postback.data);
        const action = data.get('action');

        if (action === 'switch') {
          const target = data.get('target');
          let targetMenuId = '';

          // 🌟 使用 as string 強制轉型，解除 TypeScript 警告
          if (target === 'main') targetMenuId = (process.env.MENU_MAIN as string) || '';
          if (target === 'social') targetMenuId = (process.env.MENU_SOCIAL as string) || '';
          if (target === 'textbook') targetMenuId = (process.env.MENU_TEXTBOOK as string) || '';

          if (targetMenuId) {
            await lineClient.post(`/user/${userId}/richmenu/${targetMenuId}`);
          }
        }

        if (action === 'list') {
          // 🌟 確保 subject 絕對是個字串
          const subject = data.get('subject') || '未知科目';
          
          await lineClient.post('/message/reply', {
            replyToken: event.replyToken,
            messages: [{
              type: 'text',
              text: `你點擊了 ${subject} 的解答！`
            }]
          });
        }
      }
    }

    return res.status(200).send('OK');

  } catch (err) {
    // 🌟 將 err 強制轉型為 any，讓它允許讀取 response 屬性
    const error = err as any;
    console.error('❌ Webhook 執行發生錯誤:', error?.response?.data || error?.message || '未知錯誤');
    return res.status(200).send('OK');
  }
}
