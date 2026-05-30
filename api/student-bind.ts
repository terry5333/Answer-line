import { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import { db } from './firebase';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  const { action, seat, lineId, avatarUrl } = req.body;

  if (action === 'check') {
    if (!seat) { res.status(400).json({ success: false, message: '請輸入座號' }); return; }
    db.ref(`students/${seat}`).once('value').then(function(snapshot) {
      if (snapshot.exists()) {
        const sData = snapshot.val();
        if (sData.lineId) { res.status(200).json({ success: false, message: '此座號已被綁定！' }); }
        else { res.status(200).json({ success: true, name: sData.name }); }
      } else { res.status(200).json({ success: false, message: '查無此座號，請確認老師是否建檔' }); }
    }).catch(function(err) { res.status(500).json({ success: false, message: err.message }); });
    return;
  } 

  if (action === 'confirm') {
    if (!seat || !lineId) { res.status(400).json({ success: false, message: '參數不完整' }); return; }
    
    const LINE_TOKEN = process.env.LINE_ACCESS_TOKEN;
    
    db.ref(`students/${seat}`).once('value').then(function(snapshot) {
      const sData = snapshot.val();
      const updates: any = {};
      updates[`students/${seat}/lineId`] = lineId;
      updates[`students/${seat}/avatarUrl`] = avatarUrl || ''; // 💡 存入頭像
      updates[`users/${lineId}`] = { seat: seat, name: sData.name, avatarUrl: avatarUrl || '', boundAt: new Date().toISOString() };
      return db.ref().update(updates);
    })
    .then(function() {
      // 1. 更換主選單
      const menuId = process.env.MENU_MAIN || '';
      if (menuId && LINE_TOKEN) {
        return axios.post(`https://api.line.me/v2/bot/user/${lineId}/richmenu/${menuId}`, {}, { headers: { Authorization: `Bearer ${LINE_TOKEN}` } })
        .then(() => Promise.resolve()).catch(e => { console.error('選單失敗', e); return Promise.resolve(); });
      }
      return Promise.resolve();
    })
    .then(function() {
      // 2. 🏆 主動推播綁定成功訊息 (Push API)
      if (LINE_TOKEN) {
        return axios.post(`https://api.line.me/v2/bot/message/push`, {
          to: lineId,
          messages: [{ type: 'text', text: '🎉 系統通知：裝置綁定成功！\n您的專屬學習選單已開通，現在可以開始查閱解答與課本囉！' }]
        }, { headers: { Authorization: `Bearer ${LINE_TOKEN}` } })
        .then(() => Promise.resolve()).catch(e => { console.error('推播失敗', e); return Promise.resolve(); });
      }
      return Promise.resolve();
    })
    .then(function() { res.status(200).json({ success: true }); })
    .catch(function(err) { res.status(500).json({ success: false, message: err.message }); });
    return;
  }
  
  res.status(400).json({ success: false, message: '無效的操作' });
}
