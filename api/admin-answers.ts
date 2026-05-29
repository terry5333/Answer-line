import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './firebase';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { action, type, subject, key } = req.body || req.query;

  // 🟢 動作 1：撈取所有資料 (用來在網頁過濾已綁定檔案，以及產生下拉選單)
  if (action === 'list' || req.method === 'GET') {
    const p1 = db.ref('answers').once('value');
    const p2 = db.ref('textbooks').once('value');
    
    Promise.all([p1, p2])
      .then(function(snapshots) {
        res.status(200).json({ 
          success: true, 
          answers: snapshots[0].val() || {},
          textbooks: snapshots[1].val() || {}
        });
      })
      .catch(function(err) { res.status(500).json({ success: false, message: err.message }); });
    return;
  }

  // 🟢 動作 2：下架檔案或科目
  if (action === 'delete' && req.method === 'POST') {
    if (!type || !subject) { res.status(400).json({ success: false, message: '參數不齊全' }); return; }
    
    // 智慧判斷：如果有傳 key，就刪除單一檔案；如果沒傳 key，就直接把整個科目炸掉
    const targetRef = key ? db.ref(`${type}/${subject}/${key}`) : db.ref(`${type}/${subject}`);
    
    targetRef.remove()
      .then(function() { res.status(200).json({ success: true }); })
      .catch(function(err) { res.status(500).json({ success: false, message: err.message }); });
    return;
  }
  
  res.status(400).json({ success: false, message: '無效的動作' });
}
