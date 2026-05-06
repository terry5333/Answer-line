import { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import { db } from './firebase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(200).send('OK');
  
  const { userId, stuNo } = req.body;
  
  try {
    await db.ref(`users/${userId}`).set({ stuNo, isBound: true, time: new Date().toISOString() });
    
    await axios.post(
      `https://api.line.me/v2/bot/user/${userId}/richmenu/${process.env.MENU_MAIN}`,
      {},
      { headers: { Authorization: `Bearer ${process.env.LINE_ACCESS_TOKEN}` } }
    );
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: '綁定或換選單失敗' });
  }
}
