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
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const uid = req.query.uid as string;
    if (!uid) return res.status(400).json({ success: false, message: 'Missing UID' });

    const userSnap = await db.ref(`users/${uid}`).once('value');
    if (!userSnap.exists()) return res.status(404).json({ success: false, message: '未綁定系統' });
    
    const seat = userSnap.val().seat;
    const studentSnap = await db.ref(`students/${seat}`).once('value');
    if (!studentSnap.exists()) return res.status(404).json({ success: false, message: '學生資料異常' });

    return res.status(200).json({ success: true, seat: seat, student: studentSnap.val() });
  } catch (error) {
    return res.status(500).json({ success: false, message: (error as Error).message });
  }
}
