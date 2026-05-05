import { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';

// Firebase 初始化 (同前)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { subject, title, url } = req.body;
  const db = admin.database();

  try {
    // 存入路徑：answers/subject/uniqueId
    await db.ref(`answers/${subject}`).push({
      title,
      url,
      createdAt: Date.now()
    });
    
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}
