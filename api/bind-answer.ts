import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './firebase';

export default function handler(req: VercelRequest, res: VercelResponse) {
  // 處理跨域請求
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ message: 'Method Not Allowed' }); return; }

  const { type, subject, title, url } = req.body;

  // 防呆檢查
  if (!type || !subject || !title || !url) {
    res.status(400).json({ success: false, message: '資料不完整，請確認科目、標題與網址' });
    return;
  }

  // 寫入對應節點 (type 會是 'answers' 或 'textbooks')
  db.ref(`${type}/${subject}`).push({
    title: title,
    url: url,
    createdAt: new Date().toISOString()
  })
  .then(function() {
    res.status(200).json({ success: true, message: '寫入成功' });
  })
  .catch(function(error) {
    res.status(500).json({ success: false, message: error.toString() });
  });
}
