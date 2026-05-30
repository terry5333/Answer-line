import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './firebase';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const { uid, subj, type, title, url } = req.query;

  if (!url) {
    res.status(400).send('Missing file URL');
    return;
  }

  const fileUrl = String(url);

  // 🏆 關鍵修正：精準查詢 users 節點
  db.ref(`users/${uid}`).once('value')
    .then(function(snapshot) {
      const user = snapshot.val() || {};
      
      // 鎖死欄位：寫入一律使用 userId、seat、name，讓後台 100% 讀得到！
      return db.ref('logs/access').push({
        userId: uid || 'unknown',
        seat: user.seat || '未綁定',
        name: user.name || '未知',
        type: type || '解答',
        subject: subj || '通用',
        fileTitle: title || '整個專區',
        timestamp: new Date().toISOString()
      });
    })
    .then(function() {
      // 順利跳轉
      res.writeHead(302, { Location: fileUrl });
      res.end();
    })
    .catch(function(err) {
      console.error('日誌寫入失敗，但仍執行跳轉:', err);
      res.writeHead(302, { Location: fileUrl });
      res.end();
    });
}
