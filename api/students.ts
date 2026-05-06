import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './firebase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const { stuNo } = req.query;
    if (stuNo) {
      const snap = await db.ref(`students/${stuNo}`).once('value');
      return snap.exists() ? res.json({ success: true, name: snap.val().name }) : res.json({ success: false, message: '找不到學生' });
    }
    const snap = await db.ref('students').once('value');
    return res.json({ success: true, data: snap.val() || {} });
  }
  
  if (req.method === 'POST') {
    const { stuNo, name } = req.body;
    await db.ref(`students/${stuNo}`).update({ name });
    return res.json({ success: true });
  }
}
