import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './firebase';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const { subject, title, url } = req.body;

  // 嚴格使用 Callback 寫入資料
  db.ref(`answers/${subject}`).push({
    title: title,
    url: url,
    createdAt: new Date().toISOString()
  })
  .then(function() {
    res.status(200).json({ success: true });
  })
  .catch(function(error) {
    res.status(500).json({ success: false, message: error.message });
  });
}
