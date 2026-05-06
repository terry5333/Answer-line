import { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import { db } from './firebase'; // 引入剛才寫好的 Firebase 模組

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { userId, stuNo } = req.body;
  const token = process.env.LINE_ACCESS_TOKEN as string;
  const menuMainId = process.env.MENU_MAIN as string;

  try {
    // 1. 將學生資料寫入 Firebase (路徑: users/LINE_ID)
    await db.ref(`users/${userId}`).set({
      stuNo: stuNo,
      isBound: true,
      boundAt: new Date().toISOString()
    });

    // 2. 呼叫 LINE API，強制切換至「主選單」
    if (menuMainId) {
      await axios.post(
        `https://api.line.me/v2/bot/user/${userId}/richmenu/${menuMainId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
    }

    return res.status(200).json({ success: true, message: "綁定成功" });
  } catch (error: any) {
    console.error('綁定出錯:', error.response?.data || error.message);
    return res.status(500).json({ success: false, message: '伺服器錯誤' });
  }
}
