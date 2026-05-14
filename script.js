let playerCount = 0;
let flexPayload = null; // เก็บข้อมูลไว้ส่งเข้าไลน์

// ⚠️ ใส่ LIFF ID ที่สร้างมาตรงนี้
const LIFF_ID = "YOUR_LIFF_ID_HERE"; 

window.onload = async () => {
    addPlayer('ว๊าฟ', 100);
    addPlayer('แม็ก', 150);
    
    // ตั้งค่า LIFF
    try {
        await liff.init({ liffId: LIFF_ID });
        // ถ้าเปิดในแอป LINE ให้โชว์ปุ่มส่งเข้ากลุ่ม
        if (liff.isInClient()) {
            document.getElementById('btnSendLine').classList.remove('hidden');
        }
    } catch (err) {
        console.error("LIFF Init failed", err);
    }
};

function addPlayer(name = '', cost = '') {
    playerCount++;
    const id = `player_${playerCount}`;
    const div = document.createElement('div');
    div.className = 'player-row';
    div.id = id;
    div.innerHTML = `
        <input type="text" class="p-name" placeholder="ชื่อ" value="${name}">
        <input type="number" class="p-cost" placeholder="ค่าอาหาร (บ.)" value="${cost}">
        <button class="btn-remove" onclick="removePlayer('${id}')">X</button>
    `;
    document.getElementById('playersList').appendChild(div);
}

function removePlayer(id) { document.getElementById(id).remove(); }

function calculate() {
    const deliveryFee = parseFloat(document.getElementById('deliveryFee').value) || 0;
    const discount = parseFloat(document.getElementById('discount').value) || 0;
    const ppNumber = document.getElementById('promptpay').value.trim();
    const receiverName = document.getElementById('receiverName').value.trim() || 'คนรับเงิน';
    
    const rows = document.querySelectorAll('.player-row');
    let players = [];
    let totalFood = 0;

    rows.forEach((row, index) => {
        const name = row.querySelector('.p-name').value.trim() || `คนที่ ${index+1}`;
        const cost = parseFloat(row.querySelector('.p-cost').value) || 0;
        totalFood += cost;
        players.push({ name, cost });
    });

    if (players.length === 0) return alert("กรุณาเพิ่มคนกิน");

    // ส่วนต่างที่ต้องหารเท่ากัน
    const sharedExtra = deliveryFee - discount; 
    const sharePerPerson = sharedExtra / players.length;
    const totalTrip = totalFood + sharedExtra;

    const tbody = document.querySelector('#resultTable tbody');
    tbody.innerHTML = '';
    
    let summaryText = `🍜 สรุปค่าอาหาร\nยอดรวม: ${totalTrip.toFixed(2)} บาท\n------------------\n`;
    let flexContents = []; // สำหรับ Flex Message

    players.forEach(p => {
        const netPay = p.cost + sharePerPerson;
        const netStr = netPay > 0 ? netPay.toFixed(2) : "0.00";
        const shareStr = sharePerPerson > 0 ? `+${sharePerPerson.toFixed(2)}` : sharePerPerson.toFixed(2);

        tbody.innerHTML += `<tr>
            <td>${p.name}</td>
            <td>${p.cost}</td>
            <td>${shareStr}</td>
            <td><strong>${netStr}</strong></td>
        </tr>`;

        summaryText += `- ${p.name}: ${netStr} บ.\n`;
        
        // ใส่ข้อมูลคนจ่ายใน Flex
        flexContents.push({
            "type": "box", "layout": "horizontal",
            "contents": [
              { "type": "text", "text": p.name, "size": "sm", "color": "#555555", "flex": 0 },
              { "type": "text", "text": `${netStr} ฿`, "size": "sm", "color": "#111111", "align": "end", "weight": "bold" }
            ]
        });
    });

    summaryText += `------------------\nโอนให้: ${receiverName}\nพร้อมเพย์: ${ppNumber || '-'}`;
    document.getElementById('summaryText').value = summaryText;

    // สร้าง QR Code พร้อมเพย์ ถ้ามีการกรอกเบอร์
    let qrUrl = "";
    if (ppNumber) {
        // ใช้ API สร้าง QR PromptPay
        qrUrl = `https://promptpay.io/${ppNumber}/${totalTrip}.png`;
        document.getElementById('qrImage').src = qrUrl;
        document.getElementById('qrAmountText').textContent = totalTrip.toFixed(2);
        document.getElementById('qrContainer').classList.remove('hidden');
    } else {
        document.getElementById('qrContainer').classList.add('hidden');
    }

    // เตรียม Flex Message Payload
    prepareFlexMessage(totalTrip, flexContents, receiverName, ppNumber, qrUrl);
    document.getElementById('resultSection').classList.remove('hidden');
}

function prepareFlexMessage(total, listContents, receiver, pp, qrUrl) {
    let bodyContents = [
        { "type": "text", "text": "🍜 บิลค่าอาหารมาแล้ว!", "weight": "bold", "color": "#1DB446", "size": "sm" },
        { "type": "text", "text": `${total.toFixed(2)} ฿`, "weight": "bold", "size": "xxl", "margin": "md" },
        { "type": "separator", "margin": "xxl" },
        { "type": "box", "layout": "vertical", "margin": "xxl", "spacing": "sm", "contents": listContents },
        { "type": "separator", "margin": "xxl" },
        { "type": "box", "layout": "horizontal", "margin": "md", "contents": [
            { "type": "text", "text": "โอนที่", "size": "xs", "color": "#aaaaaa", "flex": 0 },
            { "type": "text", "text": receiver, "color": "#aaaaaa", "size": "xs", "align": "end" }
        ]}
    ];

    if (pp) {
        bodyContents.push({
            "type": "box", "layout": "horizontal",
            "contents": [
                { "type": "text", "text": "พร้อมเพย์", "size": "xs", "color": "#aaaaaa", "flex": 0 },
                { "type": "text", "text": pp, "color": "#aaaaaa", "size": "xs", "align": "end" }
            ]
        });
    }

    flexPayload = {
        "type": "bubble",
        "body": { "type": "box", "layout": "vertical", "contents": bodyContents }
    };

    // ถ้ามี QR ให้เพิ่ม Hero Image
    if (qrUrl) {
        flexPayload.hero = {
            "type": "image",
            "url": qrUrl,
            "size": "full",
            "aspectRatio": "1:1",
            "aspectMode": "cover"
        };
    }
}

async function sendToLine() {
    if (!flexPayload) return;
    try {
        await liff.sendMessages([
            { "type": "flex", "altText": "🍜 บิลค่าอาหารมาแล้ว!", "contents": flexPayload }
        ]);
        alert("✅ ส่งบิลเข้ากลุ่มเรียบร้อย!");
        liff.closeWindow(); // ปิดหน้าต่างให้เนียนๆ
    } catch (err) {
        alert("ส่งไม่สำเร็จ: " + err.message);
    }
}

function copyText() {
    const text = document.getElementById('summaryText');
    text.select();
    navigator.clipboard.writeText(text.value).then(() => alert("✅ ก๊อปปี้แล้ว!"));
}