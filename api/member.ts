import { VercelRequest, VercelResponse } from '@vercel/node';
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
      }),
      databaseURL: process.env.FIREBASE_DATABASE_URL
    });
  } catch (error) {}
}

const db = admin.database();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    let uid, avatarUrl;
    
    // 支援 GET 與 POST 雙向獲取，以接收前端送來的頭像網址
    if (req.method === 'POST') {
      uid = req.body.uid;
      avatarUrl = req.body.avatarUrl;
    } else {
      uid = req.query.uid as string;
      avatarUrl = req.query.avatarUrl as string;
    }

    if (!uid) return res.status(400).json({ success: false, message: 'Missing UID' });

    const userSnap = await db.ref(`users/${uid}`).once('value');
    if (!userSnap.exists()) return res.status(404).json({ success: false, message: '未綁定系統' });
    
    const seat = userSnap.val().seat;
    const studentRef = db.ref(`students/${seat}`);
    const studentSnap = await studentRef.once('value');
    
    if (!studentSnap.exists()) return res.status(404).json({ success: false, message: '學生資料異常' });

    // 🏆 自動更新頭像：若前端有傳入 LINE 頭像，立刻更新至資料庫
    if (avatarUrl) {
      await studentRef.update({ avatarUrl: avatarUrl });
    }

    const updatedStudentSnap = await studentRef.once('value');

    return res.status(200).json({ success: true, seat: seat, student: updatedStudentSnap.val() });
  } catch (error) {
    return res.status(500).json({ success: false, message: (error as Error).message });
  }
}
