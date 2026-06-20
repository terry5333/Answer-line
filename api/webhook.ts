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
        return db.ref(`users/${userId}`).once('value').then(async function(userSnap) {
          if (!userSnap.exists()) {
            return replyText(replyToken, LINE_TOKEN, '⚠️ 權限不足\n您尚未綁定系統，請先點擊選單的「身分認證」進行綁定喔！');
          }

          const userData = userSnap.val();
          const seat = userData.seat;
          let studentGroups: any = {};
          
          if (seat) {
            const studentSnap = await db.ref(`students/${seat}`).once('value');
            if (studentSnap.exists()) {
              studentGroups = studentSnap.val().groups || {};
            }
          }

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
              
              const allowedDataList = dataList.filter((item: any) => {
                const itemGroups: string[] = Array.isArray(item.groups) ? item.groups : [item.group || '全體'];
                if (itemGroups.includes('全體')) return true; 
                return itemGroups.some((g: string) => studentGroups[g] === true);
              });

              if (allowedDataList.length === 0) {
                return replyText(replyToken, LINE_TOKEN, `⚠️ 權限受限\n目前「${text}」分類中，沒有開放給您所屬身分組的專屬資源喔！`);
              }

              const prefix = dbNode === 'textbooks' ? '課本' : '解答';
              return sendFlexMessage(replyToken, LINE_TOKEN, `${subject}${prefix}專區`, allowedDataList, userId, host, subject, logType, studentGroups);
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

function sendFlexMessage(replyToken: string, token: string | undefined, titleText: string, items: any[], userId: string, host: string, subject: string, logType: string, studentGroups: any) {
  const listItems = items.map(function(item: any) {
    const proxyUrl = `https://${host}/api/view?uid=${userId}&subj=${encodeURIComponent(subject)}&type=${encodeURIComponent(logType)}&title=${encodeURIComponent(item.title)}&url=${encodeURIComponent(item.url)}`;
    
    return {
      type: "box", 
      layout: "horizontal", 
      spacing: "md", 
      paddingAll: "16px", 
      cornerRadius: "20px", 
      backgroundColor: "#FFFFFF", 
      alignItems: "center",
      action: { type: "uri", label: "開啟檔案", uri: proxyUrl },
      contents: [
        { type: "box", layout: "vertical", width: "4px", backgroundColor: "#4A8B6F", cornerRadius: "md", contents: [{ type: "filler" }] }, 
        { type: "text", text: "📄", flex: 0, size: "md" },
        { 
          type: "box", layout: "vertical", flex: 1, spacing: "xs",
          contents: [
            { type: "text", text: item.title, weight: "bold", color: "#334155", size: "sm", wrap: true }
          ]
        },
        { type: "box", layout: "vertical", backgroundColor: "#EDF5F1", paddingAll: "6px", cornerRadius: "8px", flex: 0, contents: [
          { type: "text", text: "開啟", color: "#4A8B6F", size: "xxs", weight: "bold", align: "center" }
        ]}
      ]
    };
  });

  const myGroupNames = Object.keys(studentGroups || {});
  
  // 🔥 關鍵修正：將膠囊標籤裡的 flex 屬性徹底拔除，解決 wrap 衝突！
  const studentBadgeContents = myGroupNames.length > 0 
    ? myGroupNames.map((g: string) => ({
        type: "box", layout: "vertical", backgroundColor: "#3A5FC4", paddingStart: "6px", paddingEnd: "6px", paddingTop: "2px", paddingBottom: "2px", cornerRadius: "4px",
        contents: [{ type: "text", text: g, color: "#FFFFFF", size: "xxs", weight: "bold" }]
      }))
    : [{
        type: "box", layout: "vertical", backgroundColor: "#64748B", paddingStart: "6px", paddingEnd: "6px", paddingTop: "2px", paddingBottom: "2px", cornerRadius: "4px",
        contents: [{ type: "text", text: "一般全體", color: "#FFFFFF", size: "xxs", weight: "bold" }]
      }];

  const flexMessage = {
    type: "flex", 
    altText: titleText,
    contents: {
      type: "bubble", 
      size: "mega",
      body: {
        type: "box", 
        layout: "vertical", 
        paddingAll: "0px", 
        backgroundColor: "#F4F7F6",
        contents: [
          { 
            type: "box", 
            layout: "vertical", 
            paddingAll: "24px", 
            backgroundColor: "#FFFFFF",
            contents: [
              { type: "box", layout: "horizontal", contents: [
                { type: "text", text: "✦ Smart Education", color: "#4A8B6F", size: "xs", weight: "bold" },
                { type: "text", text: logType, color: "#D4654A", size: "xs", weight: "bold", align: "end" }
              ]},
              { type: "text", text: titleText, color: "#1E293B", size: "xxl", weight: "bold", margin: "md" },
              { 
                type: "box", layout: "horizontal", spacing: "xs", margin: "md", alignItems: "center",
                contents: [
                  { type: "text", text: "您的身分組：", color: "#64748B", size: "xs", flex: 0 },
                  { type: "box", layout: "horizontal", spacing: "xs", flex: 1, wrap: true, contents: studentBadgeContents }
                ]
              }
            ] 
          },
          { 
            type: "box", 
            layout: "vertical", 
            paddingAll: "24px", 
            spacing: "lg", 
            contents: listItems.length > 0 ? listItems : [{ type: "text", text: "此分類暫無檔案", color: "#94a3b8", size: "sm", align: "center" }] 
          }
        ]
      }
    }
  };
  return axios.post('https://api.line.me/v2/bot/message/reply', { replyToken: replyToken, messages: [flexMessage] }, { headers: { Authorization: `Bearer ${token}` } }).then(function() { return Promise.resolve(); });
}

function replyText(replyToken: string, token: string | undefined, text: string) {
  return axios.post('https://api.line.me/v2/bot/message/reply', { replyToken: replyToken, messages: [{ type: 'text', text: text }] }, { headers: { Authorization: `Bearer ${token}` } }).then(function() { return Promise.resolve(); });
}
