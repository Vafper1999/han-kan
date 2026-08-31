// ⚠️ ใส่ LIFF ID ที่นี่ (ถ้าอยากใช้สิทธิ์เดียวกับแบดมินตัน ก็ใส่ไอดีของแบดได้เลย)
const LIFF_ID = "2010086764-R4ZjE1aa"; 
const GAS_URL = "https://script.google.com/macros/s/AKfycbzldeglWlPQAiG9KvaIrh-KX7QpUI6ux0bjddW2gKVvu5leHP15x7rUcLURXlBh2TW2/exec";

let flexPayload = null;
let billCount = 0;

window.onload = async () => {
    addPerson('คุณ A');
    addPerson('คุณ B');
    addBill(); 

    try {
        await liff.init({ liffId: LIFF_ID });
        checkPDPA(); // เรียกเช็ค PDPA ทันทีที่โหลด LIFF เสร็จ
    } catch (err) {
        console.error("LIFF Init failed", err);
    }
};

function addPerson(name = '') {
    const div = document.createElement('div');
    div.className = 'person-row';
    div.innerHTML = `
        <input type="text" class="person-name" value="${name}" placeholder="ชื่อ (เช่น คุณ C)" onchange="syncUI()">
        <button class="btn-remove" onclick="this.parentElement.remove(); syncUI()">X</button>
    `;
    document.getElementById('peopleList').appendChild(div);
    syncUI();
}

function addBill() {
    billCount++;
    const div = document.createElement('div');
    div.className = 'card bill-card';
    div.innerHTML = `
        <div class="bill-header">
            <h3 style="margin:0;">🍽️ ร้านที่ ${billCount}</h3>
            <button class="btn-remove" style="padding: 6px 12px;" onclick="this.closest('.bill-card').remove(); syncUI()">ลบบิล</button>
        </div>
        <div class="input-group">
            <input type="text" class="shop-name" placeholder="ชื่อร้าน (ไม่บังคับ)">
        </div>
        <div class="input-group">
            <label>ผู้สำรองจ่ายบิลนี้:</label>
            <select class="payer-select dynamic-names"></select>
        </div>
        <div class="items-container"></div>
        <button class="btn-small" style="width:100%; padding:10px; background:#FFE5D9; color:#E76F51;" onclick="addItem(this)">+ เพิ่มรายการอาหาร</button>
    `;
    document.getElementById('billsContainer').appendChild(div);
    addItem(div.querySelector('.btn-small')); 
    syncUI();
}

function addItem(btn) {
    const container = btn.previousElementSibling;
    const div = document.createElement('div');
    div.className = 'item-row';
    // ปรับ Layout ตรงนี้ให้รองรับมือถือ (ขึ้นบรรทัดใหม่เมื่อจอแคบ)
    div.innerHTML = `
        <div class="item-inputs" style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px;">
            <input type="text" class="item-name" placeholder="ชื่อเมนู" style="flex: 1 1 100%; box-sizing: border-box;">
            <input type="number" class="item-price" placeholder="ราคา (บ.)" style="flex: 1; box-sizing: border-box;">
            <button class="btn-remove-item" onclick="this.closest('.item-row').remove()" style="flex: 0 0 auto; white-space: nowrap;">ลบเมนู</button>
        </div>
        <div class="item-consumers">
            <div class="consumer-header">
                <span>ใครกินเมนูนี้บ้าง?</span>
                <button class="btn-small" onclick="toggleConsumers(this)">เลือกทั้งหมด / ไม่เลือก</button>
            </div>
            <div class="consumers-list dynamic-consumers"></div>
        </div>
    `;
    container.appendChild(div);
    syncUI();
}

function addBankAccount() {
    const div = document.createElement('div');
    div.className = 'bank-row';
    div.innerHTML = `
        <select class="bank-owner-select dynamic-names"></select>
        <input type="text" class="bank-info" placeholder="เช่น กสิกร 0812xxxxxx">
        <button class="btn-remove" onclick="this.parentElement.remove()">X</button>
    `;
    document.getElementById('bankAccountsList').appendChild(div);
    syncUI();
}

function toggleConsumers(btn) {
    const list = btn.closest('.item-consumers').querySelector('.consumers-list');
    const cbs = list.querySelectorAll('input[type="checkbox"]');
    const allChecked = Array.from(cbs).every(cb => cb.checked);
    cbs.forEach(cb => cb.checked = !allChecked);
}

function syncUI() {
    const names = Array.from(document.querySelectorAll('.person-name'))
                      .map(inp => inp.value.trim())
                      .filter(n => n !== '');

    document.querySelectorAll('.dynamic-names').forEach(select => {
        const currentVal = select.value;
        select.innerHTML = '<option value="">-- เลือกคน --</option>';
        names.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name; opt.textContent = name;
            select.appendChild(opt);
        });
        if (names.includes(currentVal)) select.value = currentVal;
    });

    document.querySelectorAll('.dynamic-consumers').forEach(container => {
        const checkedNames = Array.from(container.querySelectorAll('input:checked')).map(cb => cb.value);
        const isInit = container.dataset.init === "true";
        container.innerHTML = '';
        
        names.forEach(name => {
            const label = document.createElement('label');
            label.className = 'cb-label';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.value = name;
            cb.className = 'consumer-cb';
            cb.checked = isInit ? checkedNames.includes(name) : true;
            
            label.appendChild(cb);
            label.append(' ' + name);
            container.appendChild(label);
        });
        container.dataset.init = "true";
    });
}

function calculate() {
    const names = Array.from(document.querySelectorAll('.person-name')).map(inp => inp.value.trim()).filter(n => n !== '');
    if (names.length === 0) return alert("กรุณาใส่ชื่อคนกินอย่างน้อย 1 คน");

    let balancesCents = {};
    names.forEach(n => balancesCents[n] = 0);
    let totalTrip = 0;
    
    let billsDetail = []; // เก็บข้อมูลเพื่อเอาไปแสดงผลใน Flex

    const bills = document.querySelectorAll('.bill-card');
    for (let [index, bill] of bills.entries()) {
        const payer = bill.querySelector('.payer-select').value;
        if (!payer) return alert(`กรุณาเลือก 'ผู้สำรองจ่าย' ในบิลที่ ${index + 1}`);
        
        let shopName = bill.querySelector('.shop-name').value.trim() || `ร้านที่ ${index + 1}`;
        let billTotalCents = 0;
        let billItems = [];
        
        const items = bill.querySelectorAll('.item-row');
        for (let item of items) {
            const itemName = item.querySelector('.item-name').value.trim() || 'เมนูไม่ระบุชื่อ';
            const price = parseFloat(item.querySelector('.item-price').value) || 0;
            const priceCents = Math.round(price * 100);
            const consumers = Array.from(item.querySelectorAll('.consumer-cb:checked')).map(cb => cb.value);
            
            if (priceCents > 0) {
                if (consumers.length === 0) return alert(`รายการ "${itemName}" ไม่มีคนกิน! กรุณาเลือกคนกินด้วยครับ`);
                
                billItems.push({ name: itemName, price: price, consumers: consumers });
                
                const splitCents = Math.floor(priceCents / consumers.length);
                const remainder = priceCents - (splitCents * consumers.length);
                
                consumers.forEach((c, idx) => {
                    let cost = splitCents + (idx === 0 ? remainder : 0);
                    if (balancesCents[c] !== undefined) balancesCents[c] -= cost;
                });
                billTotalCents += priceCents;
            }
        }
        
        if (balancesCents[payer] !== undefined) balancesCents[payer] += billTotalCents;
        totalTrip += (billTotalCents / 100);
        
        if (billItems.length > 0) {
            billsDetail.push({ shopName, payer, items: billItems });
        }
    }

    if(totalTrip === 0) return alert("ยังไม่มียอดค่าอาหารเลยครับ");

    let debtors = [], creditors = [];
    for (let n in balancesCents) {
        if (balancesCents[n] < 0) debtors.push({ name: n, amount: Math.abs(balancesCents[n]) });
        else if (balancesCents[n] > 0) creditors.push({ name: n, amount: balancesCents[n] });
    }

    debtors.sort((a,b) => b.amount - a.amount);
    creditors.sort((a,b) => b.amount - a.amount);

    let transactions = [];
    let d = 0, c = 0;
    while (d < debtors.length && c < creditors.length) {
        let debtor = debtors[d];
        let creditor = creditors[c];
        let amt = Math.min(debtor.amount, creditor.amount);
        
        if (amt > 0) {
            transactions.push({ from: debtor.name, to: creditor.name, amount: amt / 100 });
        }
        
        debtor.amount -= amt;
        creditor.amount -= amt;
        if (debtor.amount === 0) d++;
        if (creditor.amount === 0) c++;
    }

    renderSummary(transactions, totalTrip, billsDetail);
}

function renderSummary(transactions, totalTrip, billsDetail) {
    const tbody = document.querySelector('#resultTable tbody');
    tbody.innerHTML = '';
    
    let summaryText = `🍜 สรุปค่าอาหาร (รวม ${totalTrip.toFixed(2)} บ.)\n`;
    
    // 1. เพิ่มรายละเอียดบิลลงใน Text
    billsDetail.forEach(b => {
        summaryText += `------------------\n🍽️ ${b.shopName} (จ่ายโดย ${b.payer})\n`;
        b.items.forEach(item => {
            summaryText += ` - ${item.name} : ${item.price.toFixed(2)} บ.\n   (หาร: ${item.consumers.join(', ')})\n`;
        });
    });
    
    summaryText += `------------------\n💸 สรุปการโอน (หักลบหนี้แล้ว):\n`;
    let flexTransContents = [];

    if (transactions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="2">ไม่ต้องโอนเงินกันเลย! (เจ๊ากันพอดี)</td></tr>`;
        summaryText += "ไม่ต้องมีการโอนเงิน (เจ๊ากัน)\n";
    }

    transactions.forEach(t => {
        const amtStr = t.amount.toFixed(2);
        tbody.innerHTML += `<tr><td>${t.from} ➡️ ${t.to}</td><td><strong>${amtStr}</strong></td></tr>`;
        summaryText += `- ${t.from} โอนให้ ${t.to}: ${amtStr} บ.\n`;
        
        flexTransContents.push({
            "type": "box", "layout": "horizontal", "margin": "sm",
            "contents": [
              { "type": "text", "text": `${t.from} ➡️ ${t.to}`, "size": "sm", "color": "#555555", "flex": 3 },
              { "type": "text", "text": `${amtStr} ฿`, "size": "sm", "color": "#E76F51", "align": "end", "weight": "bold", "flex": 2 }
            ]
        });
    });

    summaryText += `------------------\n🏦 ข้อมูลบัญชีรับเงิน:\n`;
    let flexBankContents = [];
    
    document.querySelectorAll('.bank-row').forEach(row => {
        let owner = row.querySelector('.bank-owner-select').value;
        let info = row.querySelector('.bank-info').value.trim();
        if (owner && info) {
            summaryText += `${owner}: ${info}\n`;
            flexBankContents.push({
                "type": "box", "layout": "vertical", "margin": "sm",
                "contents": [
                    { "type": "text", "text": owner, "size": "xs", "weight": "bold", "color": "#F4A261" },
                    { "type": "text", "text": info, "size": "xs", "color": "#888888", "wrap": true }
                ]
            });
        }
    });

    document.getElementById('summaryText').value = summaryText;
    document.getElementById('resultSection').classList.remove('hidden');

    // 2. สร้างโครงสร้างรายการอาหารสำหรับ Flex
    let flexBillsContents = [];
    billsDetail.forEach(b => {
        flexBillsContents.push({
            "type": "box", "layout": "vertical", "margin": "md",
            "contents": [
                { "type": "text", "text": `🍽️ ${b.shopName} (จ่ายโดย ${b.payer})`, "weight": "bold", "size": "sm", "color": "#F4A261" }
            ]
        });
        
        b.items.forEach(item => {
            flexBillsContents.push({
                "type": "box", "layout": "horizontal", "margin": "sm",
                "contents": [
                    { "type": "text", "text": `- ${item.name}`, "size": "xs", "color": "#555555", "flex": 3, "wrap": true },
                    { "type": "text", "text": `${item.price.toFixed(2)} ฿`, "size": "xs", "color": "#555555", "flex": 1, "align": "end" }
                ]
            });
            // แถวบอกคนหาร
            flexBillsContents.push({
                "type": "box", "layout": "horizontal",
                "contents": [
                    { "type": "text", "text": `  หาร: ${item.consumers.join(', ')}`, "size": "xxs", "color": "#aaaaaa", "wrap": true }
                ]
            });
        });
    });

    flexPayload = {
        "type": "bubble",
        "size": "mega",
        "header": {
            "type": "box", "layout": "vertical", "backgroundColor": "#F4A261",
            "contents": [{ "type": "text", "text": "🍜 บิลค่าอาหาร", "weight": "bold", "color": "#FFFFFF", "align": "center" }]
        },
        "body": {
            "type": "box", "layout": "vertical", "spacing": "md",
            "contents": [
                { "type": "text", "text": `ยอดรวมทั้งหมด: ${totalTrip.toFixed(2)} บาท`, "weight": "bold", "size": "sm", "color": "#aaaaaa", "align": "center" },
                { "type": "separator", "margin": "md" },
                ...flexBillsContents,
                { "type": "separator", "margin": "md" },
                { "type": "text", "text": "💸 สรุปยอดโอน", "weight": "bold", "size": "xs", "color": "#aaaaaa", "margin": "md" },
                ...flexTransContents
            ]
        }
    };

    if (flexBankContents.length > 0) {
        flexPayload.body.contents.push({ "type": "separator", "margin": "md" });
        flexPayload.body.contents.push({ "type": "text", "text": "🏦 บัญชีรับเงิน", "weight": "bold", "size": "xs", "color": "#aaaaaa", "margin": "md" });
        flexBankContents.forEach(b => flexPayload.body.contents.push(b));
    }
}

// 3. ส่งตรงเข้ากลุ่มโดยใช้ sendMessages
async function sendToLine() {
    if (!flexPayload) return;
    try {
        await liff.sendMessages([
            { "type": "flex", "altText": "🍜 บิลค่าอาหารมาแล้ว!", "contents": flexPayload }
        ]);
        alert("✅ ส่งบิลเข้าแชทเรียบร้อย!");
        liff.closeWindow(); 
    } catch (err) {
        alert("❌ ส่งไม่สำเร็จ! กรุณาเช็คว่าเปิด 'chat_message.write' หรือยัง และต้องเปิดลิงก์จากในแชท LINE เท่านั้น\n\nError: " + err.message);
    }
}

function copyText() {
    const text = document.getElementById('summaryText');
    text.select();
    navigator.clipboard.writeText(text.value).then(() => alert("✅ ก๊อปปี้แล้ว!"));
}

// -----------------------------------------
// ส่วนของระบบ PDPA
// -----------------------------------------
function toggleAcceptBtn() {
    const cb = document.getElementById('acceptCheckbox');
    const btn = document.getElementById('btnAcceptPdpa');
    if (cb.checked) {
        btn.disabled = false;
        btn.removeAttribute('disabled');
        btn.classList.remove('disabled');
    } else {
        btn.disabled = true;
        btn.setAttribute('disabled', 'true');
        btn.classList.add('disabled');
    }
}

function checkPDPA() {
    const isAccepted = localStorage.getItem('pdpa_accepted');
    const modal = document.getElementById('pdpaModal');
    
    if (!isAccepted) {
        modal.classList.remove('hidden');
    } else {
        modal.classList.add('hidden');
    }
}

async function acceptPDPA() {
    // 1. ซ่อน Pop-up ทันที
    document.getElementById('pdpaModal').classList.add('hidden');
    
    // 2. จำไว้ในเครื่อง
    localStorage.setItem('pdpa_accepted', 'true');

    // 3. ยิงเข้าหลังบ้าน (GAS)
    if (liff.isLoggedIn()) {
        try {
            const profile = await liff.getProfile();
            fetch(GAS_URL, {
                method: 'POST',
                body: JSON.stringify({
                    userId: profile.userId,
                    displayName: profile.displayName
                })
            }).catch(e => console.error("Error sending PDPA log:", e));
        } catch (err) {
            console.error("Failed to get profile", err);
        }
    }
}
