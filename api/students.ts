import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './firebase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const { stuNo } = req.query;
    if (stuNo) { // 查詢單一學生
      const snap = await db.ref(`students/${stuNo}`).once('value');
      return snap.exists() ? res.json({ success: true, name: snap.val().name }) : res.json({ success: false });
    }
    const snap = await db.ref('students').once('value'); // 抓全部
    return res.json({ success: true, data: snap.val() || {} });
  }
  if (req.method === 'POST') { // 新增學生
    const { stuNo, name } = req.body;
    await db.ref(`students/${stuNo}`).update({ name });
    return res.json({ success: true });
  }
}
