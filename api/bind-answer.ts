import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './firebase';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method Not Allowed' });
    return;
  }

  // type 會是 'answers' (解答) 或 'textbooks' (課本)
  const { type, subject, title, url } = req.body;

  if (!type || !subject || !title || !url) {
    res.status(400).json({ message: '資料不完整' });
    return;
  }

  // 動態寫入到對應的資料表 (answers/國文 或 textbooks/國文)
  db.ref(`${type}/${subject}`).push({
    title: title,
    url: url,
    createdAt: new Date().toISOString()
  })
  .then(function() {
    res.status(200).json({ success: true });
  })
  .catch(function(error) {
    res.status(500).json({ success: false, message: error.toString() });
  });
}
