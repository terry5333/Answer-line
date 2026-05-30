import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './firebase';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const action = req.body?.action || req.query?.action;

  // 🏆 核心新增：刪除一筆特定的單個日誌紀錄
  if (req.method === 'POST' && action === 'clearSingle') {
    const logId = req.body.logId;
    if (!logId) { res.status(400).json({ success: false, message: '缺少日誌 ID' }); return; }

    db.ref(`logs/access/${logId}`).remove()
      .then(function() { res.status(200).json({ success: true }); })
      .catch(function(err) { res.status(500).json({ success: false, message: err.message }); });
    return;
  }

  // 一鍵清空全班所有數位足跡
  if (req.method === 'POST' && action === 'clearAll') {
    db.ref('logs/access').remove()
      .then(function() { res.status(200).json({ success: true }); })
      .catch(function(err) { res.status(500).json({ success: false, message: err.message }); });
    return;
  }

  // 讀取現存日誌紀錄
  const usersPromise = db.ref('users').once('value');
  const logsPromise = db.ref('logs/access').once('value');

  Promise.all([usersPromise, logsPromise])
    .then(function(snapshots) {
      const usersData = snapshots[0].val() || {};
      const logsData = snapshots[1].val() || {};
      const formattedLogs: any[] = [];
      
      for (const logId in logsData) {
        const log = logsData[logId];
        const user = usersData[log.userId];
        
        formattedLogs.push({
          id: logId, // 🏆 關鍵：把 Firebase 的唯一 ID 傳給前端，用來精準定位單筆刪除
          seat: log.seat || (user ? user.seat : '未綁定'),
          name: log.name || (user && user.name ? user.name : '未知'),
          fileTitle: log.fileTitle || '未命名文件',
          type: log.type || '解答',
          time: new Date(log.timestamp).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })
        });
      }

      formattedLogs.sort(function(a, b) {
        return new Date(b.time).getTime() - new Date(a.time).getTime();
      });

      res.status(200).json({ success: true, logs: formattedLogs });
    })
    .catch(function(err) {
      res.status(500).json({ success: false, message: err.message });
    });
}
