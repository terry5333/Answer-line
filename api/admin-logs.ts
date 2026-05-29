import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './firebase';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  // 1. 先抓取學生的綁定資料 (用來把 LINE ID 轉成 座號+姓名)
  const usersPromise = db.ref('users').once('value');
  // 2. 再抓取所有的觀看日誌
  const logsPromise = db.ref('logs/access').once('value');

  Promise.all([usersPromise, logsPromise])
    .then(function(snapshots) {
      const usersData = snapshots[0].val() || {};
      const logsData = snapshots[1].val() || {};
      
      const formattedLogs: any[] = [];
      
      // 將資料組合
      for (const logId in logsData) {
        const log = logsData[logId];
        const user = usersData[log.userId]; // 用 userId 尋找對應的綁定資料
        
        formattedLogs.push({
          seat: user ? user.seat : '未綁定/訪客',
          name: user && user.name ? user.name : '未知',
          subject: log.subject,
          type: log.type === 'textbooks' ? '課本' : '解答',
          time: new Date(log.timestamp).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })
        });
      }

      // 依照時間反序排列 (最新的在最上面)
      formattedLogs.sort(function(a, b) {
        return new Date(b.time).getTime() - new Date(a.time).getTime();
      });

      res.status(200).json({ success: true, logs: formattedLogs });
    })
    .catch(function(err) {
      res.status(500).json({ success: false, message: err.message });
    });
}
