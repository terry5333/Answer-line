import { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import { db } from './firebase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(200).send('OK');
  
  const { userId, displayName } = req.body;
  
  try {
    // 1. 只記錄 LINE 用戶資料，不問學生資訊
    await db.ref(`users/${userId}`).set({
      displayName: displayName || '未知用戶',
      isBound: true,
      boundTime: new Date().toISOString()
    });
    
    // 2. 切換至預設選單 (MENU_MAIN)
    if (process.env.MENU_MAIN) {
      await axios.post(
        `https://api.line.me/v2/bot/user/${userId}/richmenu/${process.env.MENU_MAIN}`,
        {},
        { headers: { Authorization: `Bearer ${process.env.LINE_ACCESS_TOKEN}` } }
      );
    }
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: '綁定失敗' });
  }
}
