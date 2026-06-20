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
              // 🏆 將認證權限 studentGroups 無縫帶入全新的美學渲染大腦
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

// 🏆 【極簡美學完全體】精心雕琢的 Clean UI 檔案清單 Flex Message
function sendFlexMessage(replyToken: string, token: string | undefined, titleText: string, items: any[], userId: string, host: string, subject: string, logType: string, studentGroups: any) {
  
  // 下方列表：渲染出極具空氣感的精緻白色懸浮卡片
  const listItems = items.map(function(item: any) {
    const proxyUrl = `https://${host}/api/view?uid=${userId}&subj=${encodeURIComponent(subject)}&type=${encodeURIComponent(logType)}&title=${encodeURIComponent(item.title)}&url=${encodeURIComponent(item.url)}`;
    
    return {
      type: "box", 
      layout: "horizontal", 
      spacing: "md", 
      paddingAll: "18px", 
      cornerRadius: "20px", // 大圓角極簡卡片
      backgroundColor: "#FFFFFF", // 純白卡片本體
      alignItems: "center",
      action: { type: "uri", label: "開啟檔案", uri: proxyUrl },
      contents: [
        // 左側高雅的質感綠色定位線
        { type: "box", layout: "vertical", width: "4px", backgroundColor: "#4A8B6F", cornerRadius: "md", contents: [{ type: "filler" }] }, 
        { type: "text", text: "📄", flex: 0, size: "md", gravity: "center" },
        { 
          type: "box", layout: "vertical", flex: 1,
          contents: [
            { type: "text", text: item.title, weight: "bold", color: "#334155", size: "sm", wrap: true }
          ]
        },
        // 右側精心設計的莫蘭迪綠膠囊按鈕
        { 
          type: "box", layout: "vertical", backgroundColor: "#EDF5F1", paddingStart: "12px", paddingEnd: "10px", paddingTop: "6px", paddingBottom: "6px", cornerRadius: "10px", flex: 0, 
          contents: [
            { type: "text", text: "開啟", color: "#4A8B6F", size: "xs", weight: "bold", align: "center" }
          ]
        }
      ]
    };
  });

  // 頂部狀態列：動態抽離出學生自己當前擁有的身份組標籤
  const myGroupNames = Object.keys(studentGroups || {});
  const studentBadgeContents = myGroupNames.length > 0 
    ? myGroupNames.map((g: string) => ({
        type: "box", layout: "horizontal", backgroundColor: "#3A5FC4", paddingStart: "8px", paddingEnd: "8px", paddingTop: "3px", paddingBottom: "3px", cornerRadius: "6px",
        contents: [{ type: "text", text: g, color: "#FFFFFF", size: "xxs", weight: "bold", align: "center" }]
      }))
    : [{
        type: "box", layout: "horizontal", backgroundColor: "#64748B", paddingStart: "8px", paddingEnd: "8px", paddingTop: "3px", paddingBottom: "3px", cornerRadius: "6px",
        contents: [{ type: "text", text: "一般全體", color: "#FFFFFF", size: "xxs", weight: "bold", align: "center" }]
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
        backgroundColor: "#F4F7F6", // 高級淺微灰底色，襯托出上方卡片的懸浮感
        contents: [
          // ─── 頂部高階純白資訊中樞 ───
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
              { type: "text", text: titleText, color: "#0F172A", size: "xxl", weight: "bold", margin: "md" },
              
              // 👤 獨立封裝的「學生當前身份認證標籤區塊」，採用 iOS 式圓角背板
              { 
                type: "box", layout: "vertical", backgroundColor: "#F8FAFC", paddingAll: "12px", cornerRadius: "14px", margin: "lg", spacing: "sm",
                contents: [
                  { type: "text", text: "👤 目前已認證的身分權限：", color: "#64748B", size: "xxs", weight: "bold" },
                  { type: "box", layout: "horizontal", spacing: "sm", contents: studentBadgeContents }
                ]
              }
            ] 
          },
          // ─── 下方高級懸浮卡片容器 ───
          { 
            type: "box", 
            layout: "vertical", 
            paddingAll: "20px", 
            spacing: "md", 
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
