import { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';

// 確保 Firebase 只初始化一次
if (!admin.apps.length) {
  // admin.initializeApp({...}); // 之後填入你的 Firebase 設定
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { subject, title, url } = req.body;

  try {
    // 暫時略過寫入邏輯，確保編譯通過
    // await admin.database().ref(`answers/${subject}`).push({ ... });
    res.status(200).json({ success: true });
  } catch (error: any) { // 🌟 加上 :any 解決報錯
    res.status(500).json({ success: false, message: error.message });
  }
}
