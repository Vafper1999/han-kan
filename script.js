// ⚠️ ใส่ LIFF ID ที่นี่
const LIFF_ID = "2010086764-R4ZjE1aa"; 
let flexPayload = null;
let billCount = 0;

window.onload = async () => {
    // กำหนดชื่อเริ่มต้น
    addPerson('คุณ A');
    addPerson('คุณ B');
    addBill(); // สร้างบิลร้านแรกให้เลย

    try {
        await liff.init({ liffId: LIFF_ID });
    } catch (err) {
        console.error("LIFF Init failed", err);
    }
};

// ================= UI Management =================
function addPerson(name = '') {
    const div = document.createElement('div');
    div.className = 'person-row';
    div.innerHTML = `
        <input type="text" class="person-name" value="${name}" placeholder="ชื่อ (เช่น คุณ A)" onchange="syncUI()">
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
    addItem(div.querySelector('.btn-small')); // แอดไอเทมแรกให้อัตโนมัติ
    syncUI();
}

function addItem(btn) {
    const container = btn.previousElementSibling;
    const div = document.createElement('div');
    div.className = 'item-row';
    div.innerHTML = `
        <div class="item-inputs">
            <input type="text" class="item-name" placeholder="ชื่อเมนู" style="flex:2">
            <input type="number" class="item-price" placeholder="ราคา" style="flex:1">
            <button class="btn-remove-item" onclick="this.closest('.item-row').remove()">X</button>
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

// อัปเดต Dropdown และ Checkbox ทุกครั้งที่แก้ชื่อคน
function syncUI() {
    const names = Array.from(document.querySelectorAll('.person-name'))
                      .map(inp => inp.value.trim())
                      .filter(n => n !== '');

    // อัปเดต Dropdowns
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

    // อัปเดต Checkboxes (จำค่าที่เคยติ๊กไว้ด้วย)
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
            // ถ้าสร้างใหม่ให้ติ๊กถูกหมด แต่ถ้าเคยสร้างแล้วให้อิงค่าเดิม
            cb.checked = isInit ? checkedNames.includes(name) : true;
            
            label.appendChild(cb);
            label.append(' ' + name);
            container.appendChild(label);
        });
        container.dataset.init = "true";
    });
}

// ================= Calculation =================
function calculate() {
    const names = Array.from(document.querySelectorAll('.person-name')).map(inp => inp.value.trim()).filter(n => n !== '');
    if (names.length === 0) return alert("กรุณาใส่ชื่อคนกินอย่างน้อย 1 คน");

    // แปลงเงินเป็นหน่วย "สตางค์" เพื่อป้องกันปัญหาทศนิยมคลาดเคลื่อนของ Javascript
    let balancesCents = {};
    names.forEach(n => balancesCents[n] = 0);
    let totalTrip = 0;

    const bills = document.querySelectorAll('.bill-card');
    for (let bill of bills) {
        const payer = bill.querySelector('.payer-select').value;
        if (!payer) return alert("กรุณาเลือก 'ผู้สำรองจ่าย' ให้ครบทุกบิล");
        
        let billTotalCents = 0;
        const items = bill.querySelectorAll('.item-row');
        
        for (let item of items) {
            const price = parseFloat(item.querySelector('.item-price').value) || 0;
            const priceCents = Math.round(price * 100);
            const consumers = Array.from(item.querySelectorAll('.consumer-cb:checked')).map(cb => cb.value);
            
            if (priceCents > 0) {
                if (consumers.length === 0) return alert("มีรายการอาหารที่ไม่มีคนกิน! กรุณาติ๊กเลือกคนกินด้วยครับ");
                
                // หารแบบเป๊ะๆ เศษสตางค์ปัดให้คนแรก
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
    }

    if(totalTrip === 0) return alert("ยังไม่มียอดค่าอาหารเลยครับ");

    // หักลบหนี้ (Debt Simplification)
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

    renderSummary(transactions, totalTrip);
}

function renderSummary(transactions, totalTrip) {
    const tbody = document.querySelector('#resultTable tbody');
    tbody.innerHTML = '';
    
    let summaryText = `🍜 สรุปยอดค่าอาหาร (รวม ${totalTrip.toFixed(2)} บ.)\n------------------\n💸 สรุปการโอน (หักลบหนี้แล้ว):\n`;
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
    let bankInfos = [];
    let flexBankContents = [];
    
    document.querySelectorAll('.bank-row').forEach(row => {
        let owner = row.querySelector('.bank-owner-select').value;
        let info = row.querySelector('.bank-info').value.trim();
        if (owner && info) {
            bankInfos.push({owner, info});
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

    if (bankInfos.length === 0) summaryText += "ยังไม่ได้ระบุบัญชี\n";

    document.getElementById('summaryText').value = summaryText;
    document.getElementById('resultSection').classList.remove('hidden');

    // Build Flex Message
    flexPayload = {
        "type": "bubble",
        "header": {
            "type": "box", "layout": "vertical", "backgroundColor": "#F4A261",
            "contents": [{ "type": "text", "text": "🍜 สรุปยอดหารค่าอาหาร", "weight": "bold", "color": "#FFFFFF", "align": "center" }]
        },
        "body": {
            "type": "box", "layout": "vertical", "spacing": "md",
            "contents": [
                { "type": "text", "text": `ยอดรวมทั้งหมด: ${totalTrip.toFixed(2)} บาท`, "weight": "bold", "size": "sm", "color": "#aaaaaa", "align": "center" },
                { "type": "separator", "margin": "md" },
                ...flexTransContents
            ]
        }
    };

    if (flexBankContents.length > 0) {
        flexPayload.body.contents.push({ "type": "separator", "margin": "xl" });
        flexPayload.body.contents.push({ "type": "text", "text": "🏦 บัญชีรับเงิน", "weight": "bold", "size": "xs", "color": "#aaaaaa", "margin": "md" });
        flexBankContents.forEach(b => flexPayload.body.contents.push(b));
    }
}

async function sendToLine() {
    if (!flexPayload) return;
    try {
        // ใช้ sendMessages เพื่อส่งเข้าแชทกลุ่มที่เปิด LIFF อยู่โดยตรง
        await liff.sendMessages([
            { "type": "flex", "altText": "🍜 บิลค่าอาหารมาแล้ว!", "contents": flexPayload }
        ]);
        alert("✅ ส่งบิลเข้าแชทเรียบร้อย!");
        liff.closeWindow(); 
    } catch (err) {
        alert("❌ ส่งไม่สำเร็จ! กรุณาเช็คว่าเปิด 'chat_message.write' ในหน้า LINE Developers หรือยัง\n\nError: " + err.message);
    }
}

function copyText() {
    const text = document.getElementById('summaryText');
    text.select();
    navigator.clipboard.writeText(text.value).then(() => alert("✅ ก๊อปปี้แล้ว!"));
}
