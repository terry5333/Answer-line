import { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(200).send('OK');

  const { userId, stuNo } = req.body;
  const token = process.env.LINE_ACCESS_TOKEN;
  const menuMainId = process.env.MENU_MAIN;

  try {
    // 🌟 這裡之後可以加上 Firebase 驗證，現在我們先執行「強制變臉」
    // 呼叫 LINE API 把用戶的選單換成主選單
    await axios.post(
      `https://api.line.me/v2/bot/user/${userId}/richmenu/${menuMainId}`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('綁定出錯:', error.response?.data || error.message);
    return res.status(500).json({ success: false, message: '換選單失敗' });
  }
}
