import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './firebase';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const { uid, subj, type, title, url } = req.query;

  if (!url) { res.status(400).send('Missing file URL'); return; }

  // 1. 在點擊當下，精準抓取該 LINE ID 對應的真實座號與姓名
  db.ref(`users/${uid}`).once('value')
    .then(function(snapshot) {
      const user = snapshot.val() || {};
      
      // 2. 寫入萬無一失的極其詳細日誌 (鎖死姓名座號 + 檔案名稱)
      return db.ref('logs/access').push({
        userId: uid || 'unknown',
        seat: user.seat || '未綁定/訪客',
        name: user.name || '未知',
        type: type || '解答',
        subject: subj || '通用',
        fileTitle: title || '未命名文件',
        timestamp: new Date().toISOString()
      });
    })
    .then(function() {
      // 3. 毫秒級轉址：把學生無感重新導向到真正的 Google Drive 檔案
      res.writeHead(302, { Location: String(url) });
      res.end();
    })
    .catch(function(err) {
      console.error('Logging failed:', err);
      // 防呆：即使資料庫剛好斷線，也務必讓學生能順利打開檔案，隨後跳轉
      res.writeHead(302, { Location: String(url) });
      res.end();
    });
}
