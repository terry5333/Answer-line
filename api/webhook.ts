import { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import { db } from './firebase';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.status(200).send('OK'); return; }
  const events = req.body.events;
  if (!events || events.length === 0) { res.status(200).send('OK'); return; }

  const LINE_TOKEN = process.env.LINE_ACCESS_TOKEN;
  const host = req.headers.host || ''; 

  const tasks = events.map(function(event: any) {
    const replyToken = event.replyToken;
    const userId = event.source?.userId || ''; 

    if (event.type === 'message' && event.message.type === 'text') {
      const text = event.message.text.trim();

      // 🏆 新增：攔截「會員」關鍵字，彈出數位會員卡開啟按鈕
      if (text === '會員') {
        const LIFF_MEMBER_URL = process.env.LIFF_MEMBER_URL || `https://liff.line.me/請填寫您的會員LIFF_ID`;
        const flexMessage = {
          type: "flex", altText: "數位會員卡",
          contents: {
            type: "bubble", size: "kilo",
            body: {
              type: "box", layout: "vertical", paddingAll: "28px", backgroundColor: "#FFFFFF",
              contents: [
                { type: "text", text: "✦ Smart Education", color: "#4A8B6F", size: "xs", weight: "bold" },
                { type: "text", text: "數位學生證", color: "#1E293B", size: "xl", weight: "bold", margin: "md" },
                { type: "text", text: "點擊下方按鈕出示您的身分 QR Code 與權限資訊。", color: "#94A3B8", size: "xs", margin: "sm", wrap: true },
                { type: "button", style: "primary", color: "#3A5FC4", margin: "xl", action: { type: "uri", label: "開啟身分卡", uri: LIFF_MEMBER_URL } }
              ]
            }
          }
        };
        return axios.post('https://api.line.me/v2/bot/message/reply', { replyToken: replyToken, messages: [flexMessage] }, { headers: { Authorization: `Bearer ${LINE_TOKEN}` } }).then(() => Promise.resolve());
      }

      if (text === '社會' || text === '課本' || text === '主選單' || text === '返回主選單') {
        let menuId = '';
        if (text === '社會') menuId = process.env.MENU_SOCIAL || '';
        else if (text === '課本') menuId = process.env.MENU_TEXTBOOK || '';
        else menuId = process.env.MENU_MAIN || '';

        if (menuId && userId) return switchRichMenu(userId, menuId, LINE_TOKEN);
        return Promise.resolve();
      } 
      else {
        return db.ref(`users/${userId}`).once('value').then(async function(userSnap) {
          if (!userSnap.exists()) return replyText(replyToken, LINE_TOKEN, '⚠️ 權限不足\n您尚未綁定系統，請先點擊選單的「身分認證」進行綁定喔！');

          const userData = userSnap.val();
          const seat = userData.seat;
          let studentGroups: any = {};
          
          if (seat) {
            const studentSnap = await db.ref(`students/${seat}`).once('value');
            if (studentSnap.exists()) studentGroups = studentSnap.val().groups || {};
          }

          let dbNode = 'answers'; let subject = text; let logType = '解答';
          if (text.endsWith('課本') && text !== '課本') { dbNode = 'textbooks'; subject = text.replace('課本', ''); logType = '課本'; }

          return db.ref(`${dbNode}/${subject}`).once('value').then(function(snapshot) {
            if (snapshot.exists()) {
              const dataList = Object.values(snapshot.val());
              const allowedDataList = dataList.filter((item: any) => {
                const itemGroups: string[] = Array.isArray(item.groups) ? item.groups : [item.group || '全體'];
                if (itemGroups.includes('全體')) return true; 
                return itemGroups.some((g: string) => studentGroups[g] === true);
              });
              if (allowedDataList.length === 0) return replyText(replyToken, LINE_TOKEN, `⚠️ 權限受限\n目前「${text}」分類中，沒有開放給您所屬身分組的專屬資源喔！`);

              const prefix = dbNode === 'textbooks' ? '課本' : '解答';
              return sendFlexMessage(replyToken, LINE_TOKEN, `${subject}${prefix}專區`, allowedDataList, userId, host, subject, logType, studentGroups);
            } else {
              return replyText(replyToken, LINE_TOKEN, `目前資料庫還沒有「${text}」的檔案喔！`);
            }
          });
        }).catch((error) => Promise.resolve());
      }
    }
    return Promise.resolve();
  });

  Promise.all(tasks).then(() => res.status(200).send('OK')).catch(() => res.status(500).send('Error'));
}

function switchRichMenu(userId: string, menuId: string, token: string | undefined) {
  return axios.post(`https://api.line.me/v2/bot/user/${userId}/richmenu/${menuId}`, {}, { headers: { Authorization: `Bearer ${token}` } }).then(() => Promise.resolve()).catch(() => Promise.resolve());
}

function sendFlexMessage(replyToken: string, token: string | undefined, titleText: string, items: any[], userId: string, host: string, subject: string, logType: string, studentGroups: any) {
  const listItems = items.map(function(item: any) {
    const proxyUrl = `https://${host}/api/view?uid=${userId}&subj=${encodeURIComponent(subject)}&type=${encodeURIComponent(logType)}&title=${encodeURIComponent(item.title)}&url=${encodeURIComponent(item.url)}`;
    return {
      type: "box", layout: "horizontal", spacing: "md", paddingAll: "18px", cornerRadius: "20px", backgroundColor: "#FFFFFF", alignItems: "center",
      action: { type: "uri", label: "開啟檔案", uri: proxyUrl },
      contents: [
        { type: "box", layout: "vertical", width: "4px", backgroundColor: "#4A8B6F", cornerRadius: "md", contents: [{ type: "filler" }] }, 
        { type: "text", text: "📄", flex: 0, size: "md", gravity: "center" },
        { type: "box", layout: "vertical", flex: 1, contents: [{ type: "text", text: item.title, weight: "bold", color: "#334155", size: "sm", wrap: true }] },
        { type: "box", layout: "vertical", backgroundColor: "#EDF5F1", paddingStart: "12px", paddingEnd: "10px", paddingTop: "6px", paddingBottom: "6px", cornerRadius: "10px", flex: 0, contents: [{ type: "text", text: "開啟", color: "#4A8B6F", size: "xs", weight: "bold", align: "center" }] }
      ]
    };
  });

  const myGroupNames = Object.keys(studentGroups || {});
  const studentBadgeContents = myGroupNames.length > 0 
    ? myGroupNames.map((g: string) => ({ type: "box", layout: "horizontal", backgroundColor: "#3A5FC4", paddingStart: "8px", paddingEnd: "8px", paddingTop: "3px", paddingBottom: "3px", cornerRadius: "6px", contents: [{ type: "text", text: g, color: "#FFFFFF", size: "xxs", weight: "bold", align: "center" }] }))
    : [{ type: "box", layout: "horizontal", backgroundColor: "#64748B", paddingStart: "8px", paddingEnd: "8px", paddingTop: "3px", paddingBottom: "3px", cornerRadius: "6px", contents: [{ type: "text", text: "一般全體", color: "#FFFFFF", size: "xxs", weight: "bold", align: "center" }] }];

  const flexMessage = {
    type: "flex", altText: titleText,
    contents: {
      type: "bubble", size: "mega",
      body: {
        type: "box", layout: "vertical", paddingAll: "0px", backgroundColor: "#F4F7F6",
        contents: [
          { type: "box", layout: "vertical", paddingAll: "24px", backgroundColor: "#FFFFFF", contents: [
              { type: "box", layout: "horizontal", contents: [{ type: "text", text: "✦ Smart Education", color: "#4A8B6F", size: "xs", weight: "bold" }, { type: "text", text: logType, color: "#D4654A", size: "xs", weight: "bold", align: "end" }] },
              { type: "text", text: titleText, color: "#0F172A", size: "xxl", weight: "bold", margin: "md" },
              { type: "box", layout: "vertical", backgroundColor: "#F8FAFC", paddingAll: "12px", cornerRadius: "14px", margin: "lg", spacing: "sm", contents: [{ type: "text", text: "👤 目前已認證的身分權限：", color: "#64748B", size: "xxs", weight: "bold" }, { type: "box", layout: "horizontal", spacing: "sm", wrap: true, contents: studentBadgeContents }] }
            ] 
          },
          { type: "box", layout: "vertical", paddingAll: "20px", spacing: "md", contents: listItems.length > 0 ? listItems : [{ type: "text", text: "此分類暫無檔案", color: "#94a3b8", size: "sm", align: "center" }] }
        ]
      }
    }
  };
  return axios.post('https://api.line.me/v2/bot/message/reply', { replyToken: replyToken, messages: [flexMessage] }, { headers: { Authorization: `Bearer ${token}` } }).then(() => Promise.resolve());
}

function replyText(replyToken: string, token: string | undefined, text: string) {
  return axios.post('https://api.line.me/v2/bot/message/reply', { replyToken: replyToken, messages: [{ type: 'text', text: text }] }, { headers: { Authorization: `Bearer ${token}` } }).then(() => Promise.resolve());
}
