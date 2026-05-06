import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './firebase';

export default function handler(req: VercelRequest, res: VercelResponse) {
  // 處理跨域與方法錯誤
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, message: 'Method Not Allowed' });
    return;
  }

  const { subject, title, url } = req.body;

  // 阻擋空資料
  if (!subject || !title || !url) {
    res.status(400).json({ success: false, message: '系統偵測到資料不完整，請確認標題與網址' });
    return;
  }

  // 100% 純 Callback 寫入
  db.ref(`answers/${subject}`).push({
    title: title,
    url: url,
    createdAt: new Date().toISOString()
  })
  .then(function() {
    res.status(200).json({ success: true, message: '寫入成功' });
  })
  .catch(function(error) {
    // 寫入失敗時，把錯誤訊息直接噴回前端顯示
    res.status(500).json({ success: false, message: error.toString() });
  });
}
