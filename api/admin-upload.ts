import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './firebase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { subject, title, url } = req.body;

  try {
    // 將解答連結推送到 Firebase (路徑: answers/科目)
    await db.ref(`answers/${subject}`).push({
      title: title,
      url: url,
      createdAt: new Date().toISOString()
    });

    return res.status(200).json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
