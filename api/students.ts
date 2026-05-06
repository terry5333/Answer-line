import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './firebase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 處理 GET：獲取所有學生名單
  if (req.method === 'GET') {
    try {
      const snapshot = await db.ref('students').once('value');
      return res.status(200).json({ success: true, data: snapshot.val() || {} });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  // 處理 POST：新增或編輯學生
  if (req.method === 'POST') {
    const { stuNo, name } = req.body;
    if (!stuNo || !name) return res.status(400).json({ success: false, message: '資料不完整' });

    try {
      await db.ref(`students/${stuNo}`).update({ name });
      return res.status(200).json({ success: true, message: '儲存成功' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  res.status(405).send('Method Not Allowed');
}
