import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './firebase';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const { uid, type, title, url } = req.query;

  if (!url) {
    res.status(400).send('Missing file URL');
    return;
  }

  const fileUrl = String(url);

  db.ref(`users/${uid}`).once('value')
    .then(function(snapshot) {
      const user = snapshot.val() || {};
      
      // 🏆 關鍵修正：不紀錄科目節點，只紀錄開啟的具體檔案名稱 (fileTitle) 與 類型 (type)
      return db.ref('logs/access').push({
        userId: uid || 'unknown',
        seat: user.seat || '未綁定',
        name: user.name || '未知',
        type: type || '解答', 
        fileTitle: title || '未命名文件',
        timestamp: new Date().toISOString()
      });
    })
    .then(function() {
      res.writeHead(302, { Location: fileUrl });
      res.end();
    })
    .catch(function(err) {
      console.error('日誌寫入異常:', err);
      res.writeHead(302, { Location: fileUrl });
      res.end();
    });
}
