import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './firebase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).send('Method Not Allowed');

  const { stuNo } = req.query;

  try {
    // 從 Firebase 的 students 路徑下找該座號的資料
    const snapshot = await db.ref(`students/${stuNo}`).once('value');
    const studentData = snapshot.val();

    if (studentData) {
      return res.status(200).json({ success: true, name: studentData.name });
    } else {
      return res.status(404).json({ success: false, message: '找不到該座號的學生資料' });
    }
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
