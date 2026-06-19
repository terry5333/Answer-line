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

      if (text === '社會' || text === '課本' || text === '主選單' || text === '返回主選單') {
        let menuId = '';
        if (text === '社會') menuId = process.env.MENU_SOCIAL || '';
        else if (text === '課本') menuId = process.env.MENU_TEXTBOOK || '';
        else menuId = process.env.MENU_MAIN || '';

        if (menuId && userId) {
          return switchRichMenu(userId, menuId, LINE_TOKEN);
        }
        return Promise.resolve();
      } 
      else {
        // 🏆 擋修機制：查詢前先驗證身分
        // 加上 async 關鍵字，讓我們可以在裡面使用 await 撈取身分組
        return db.ref(`users/${userId}`).once('value').then(async function(userSnap) {
          if (!userSnap.exists()) {
            // 沒有綁定，直接退回
            return replyText(replyToken, LINE_TOKEN, '⚠️ 權限不足\n您尚未綁定系統，請先點擊選單的「身分認證」進行綁定喔！');
          }

          // 🏆 取得學生的座號，藉此去 students 節點拿取最新的「身分組標籤」
          const userData = userSnap.val();
          const seat = userData.seat;
          let studentGroups: any = {};
          
          if (seat) {
            const studentSnap = await db.ref(`students/${seat}`).once('value');
            if (studentSnap.exists()) {
              // 把學生身上的標籤抓下來，例如 { "補習班": true, "A組": true }
              studentGroups = studentSnap.val().groups || {};
            }
          }

          // 已綁定，繼續處理解答邏輯
          let dbNode = 'answers'; 
          let subject = text;
          let logType = '解答';

          if (text.endsWith('課本') && text !== '課本') {
            dbNode = 'textbooks';
            subject = text.replace('課本', ''); 
            logType = '課本';
          }

          return db.ref(`${dbNode}/${subject}`).once('value').then(function(snapshot) {
            if (snapshot.exists()) {
              const dataList = Object.values(snapshot.val());
              
              // 🛡️ 終極權限過濾器：檢查身分證！
              const allowedDataList = dataList.filter((item: any) => {
                const reqGroup = item.group || '全體';
                if (reqGroup === '全體') return true; // 1. 全體開放，直接放行
                if (studentGroups[reqGroup] === true) return true; // 2. 學生身上有專屬標籤，放行
                return false; // 3. 權限不符，擋下剃除！
              });

              // 如果剃除完之後，發現這科他一份解答都沒資格看
              if (allowedDataList.length === 0) {
                return replyText(replyToken, LINE_TOKEN, `⚠️ 權限受限\n目前「${text}」分類中，沒有開放給您所屬身分組的專屬資源喔！`);
              }

              const prefix = dbNode === 'textbooks' ? '課本' : '解答';
              return sendFlexMessage(replyToken, LINE_TOKEN, `${subject}${prefix}專區`, allowedDataList, userId, host, subject, logType);
            } else {
              return replyText(replyToken, LINE_TOKEN, `目前資料庫還沒有「${text}」的檔案喔！`);
            }
          });
        }).catch(function(error) {
          console.error('執行失敗:', error);
          return Promise.resolve();
        });
      }
    }
    return Promise.resolve();
  });

  Promise.all(tasks).then(function() { res.status(200).send('OK'); }).catch(function() { res.status(500).send('Error'); });
}

function switchRichMenu(userId: string, menuId: string, token: string | undefined) {
  return axios.post(`https://api.line.me/v2/bot/user/${userId}/richmenu/${menuId}`, {}, { headers: { Authorization: `Bearer ${token}` } }).then(function() { return Promise.resolve(); }).catch(function() { return Promise.resolve(); });
}

function sendFlexMessage(replyToken: string, token: string | undefined, titleText: string, items: any[], userId: string, host: string, subject: string, logType: string) {
  const listItems = items.map(function(item: any) {
    const proxyUrl = `https://${host}/api/view?uid=${userId}&subj=${encodeURIComponent(subject)}&type=${encodeURIComponent(logType)}&title=${encodeURIComponent(item.title)}&url=${encodeURIComponent(item.url)}`;
    return {
      type: "box", layout: "horizontal", spacing: "md", paddingAll: "16px", cornerRadius: "16px", backgroundColor: "#f8fafc",
      action: { type: "uri", label: "開啟檔案", uri: proxyUrl },
      contents: [
        { type: "text", text: "📄", flex: 0, size: "md", gravity: "center" },
        { type: "text", text: item.title, weight: "bold", color: "#111111", size: "sm", gravity: "center", wrap: true }
      ]
    };
  });

  const flexMessage = {
    type: "flex", altText: titleText,
    contents: {
      type: "bubble", size: "mega",
      body: {
        type: "box", layout: "vertical", paddingAll: "0px",
        contents: [
          { type: "box", layout: "vertical", backgroundColor: "#000000", paddingAll: "24px", contents: [{ type: "text", text: "Smart Education", color: "#888888", size: "xs", weight: "bold" }, { type: "text", text: titleText, color: "#ffffff", size: "xl", weight: "bold", margin: "sm" }] },
          { type: "box", layout: "vertical", paddingAll: "24px", spacing: "md", contents: listItems.length > 0 ? listItems : [{ type: "text", text: "此分類暫無檔案", color: "#94a3b8", size: "sm", align: "center" }] }
        ]
      }
    }
  };
  return axios.post('https://api.line.me/v2/bot/message/reply', { replyToken: replyToken, messages: [flexMessage] }, { headers: { Authorization: `Bearer ${token}` } }).then(function() { return Promise.resolve(); });
}

function replyText(replyToken: string, token: string | undefined, text: string) {
  return axios.post('https://api.line.me/v2/bot/message/reply', { replyToken: replyToken, messages: [{ type: 'text', text: text }] }, { headers: { Authorization: `Bearer ${token}` } }).then(function() { return Promise.resolve(); });
}
