// Stash demo data: made-up notes, Inbox messages and collections, with bills,
// receipts, a prescription and a lab report drawn right here on the device,
// and a small PDF. Nothing is downloaded and nothing real is in it: every
// name is invented (Dr Asha Verma, City Clinic, Nimrah Cafe, My scooter).
// Loaded and removed from Settings → Your data. window.CPDemo
(function () {
  "use strict";

  const DAY = 86400000;
  const inr = (n) => "₹" + n.toLocaleString("en-IN");

  // ---------- Pictures ----------
  function canvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return [c, c.getContext("2d")]; }
  const jpg = (c) => c.toDataURL("image/jpeg", 0.82);
  const font = (w, s, mono) => w + " " + s + "px " + (mono ? "ui-monospace, Menlo, Consolas, monospace" : "-apple-system, system-ui, 'Segoe UI', sans-serif");

  // A paper slip (bill, receipt) photographed on a table.
  function slip({ title, sub, lines, total, foot, table = "#6b5b4b", tilt = -0.025 }) {
    const W = 600, H = 820;
    const [c, x] = canvas(W, H);
    const g = x.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, table); g.addColorStop(1, "#2e2620");
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.save();
    x.translate(W / 2, H / 2); x.rotate(tilt); x.translate(-W / 2, -H / 2);
    x.shadowColor = "rgba(0,0,0,.45)"; x.shadowBlur = 30; x.shadowOffsetY = 12;
    x.fillStyle = "#fbfaf6"; x.fillRect(110, 60, 380, 700);
    x.shadowColor = "transparent";
    x.fillStyle = "#1d1d1d"; x.textAlign = "center";
    x.font = font(700, 26); x.fillText(title, W / 2, 112);
    x.font = font(400, 14); (sub || []).forEach((t, i) => x.fillText(t, W / 2, 138 + i * 18));
    x.textAlign = "left"; x.font = font(400, 15, true);
    let y = 210;
    x.fillText("-".repeat(36), 130, y - 22);
    for (const [name, amt] of lines) {
      x.fillText(name, 130, y);
      x.textAlign = "right"; x.fillText(amt, 470, y); x.textAlign = "left";
      y += 28;
    }
    x.fillText("-".repeat(36), 130, y); y += 34;
    x.font = font(700, 19, true); x.fillText("TOTAL", 130, y); x.textAlign = "right"; x.fillText(total, 470, y); x.textAlign = "center";
    x.font = font(400, 13); (foot || []).forEach((t, i) => x.fillText(t, W / 2, y + 50 + i * 18));
    x.font = font(700, 12); x.fillStyle = "rgba(200,40,40,.55)"; x.fillText("SAMPLE · DEMO DATA", W / 2, 735);
    x.restore();
    return jpg(c);
  }
  // A letterhead page (prescription, lab report).
  function letter({ head, sub, accent, rows, note, table = "#d9d4cc" }) {
    const W = 600, H = 800;
    const [c, x] = canvas(W, H);
    x.fillStyle = table; x.fillRect(0, 0, W, H);
    x.shadowColor = "rgba(0,0,0,.25)"; x.shadowBlur = 24; x.shadowOffsetY = 8;
    x.fillStyle = "#ffffff"; x.fillRect(50, 40, 500, 720);
    x.shadowColor = "transparent";
    x.fillStyle = accent; x.fillRect(50, 40, 500, 8);
    x.fillStyle = "#1b1b1f"; x.font = font(700, 24); x.fillText(head, 80, 100);
    x.fillStyle = "#666"; x.font = font(400, 14); (sub || []).forEach((t, i) => x.fillText(t, 80, 124 + i * 19));
    x.strokeStyle = "#ddd"; x.beginPath(); x.moveTo(80, 190); x.lineTo(520, 190); x.stroke();
    let y = 230;
    for (const r of rows) {
      if (r.h) { x.fillStyle = accent; x.font = font(700, 16); x.fillText(r.h, 80, y); y += 30; continue; }
      x.fillStyle = "#1b1b1f"; x.font = font(600, 16); x.fillText(r[0], 80, y);
      x.fillStyle = "#555"; x.font = font(400, 15); x.fillText(r[1] || "", 320, y);
      if (r[2]) { x.fillStyle = "#888"; x.font = font(400, 13); x.fillText(r[2], 80, y + 20); y += 18; }
      y += 34;
    }
    x.fillStyle = "#555"; x.font = font(400, 14);
    (note || []).forEach((t, i) => x.fillText(t, 80, 640 + i * 20));
    x.fillStyle = "rgba(200,40,40,.5)"; x.font = font(700, 13); x.textAlign = "center"; x.fillText("SAMPLE · DEMO DATA · NOT A REAL DOCUMENT", W / 2, 740);
    return jpg(c);
  }
  // Simple "photos": a scooter, a plate of food, a palace at dusk.
  function scooter() {
    const [c, x] = canvas(640, 480);
    const g = x.createLinearGradient(0, 0, 0, 480); g.addColorStop(0, "#9fd3ff"); g.addColorStop(0.62, "#e8f4ff"); g.addColorStop(0.62, "#8a8f98"); g.addColorStop(1, "#5c616a");
    x.fillStyle = g; x.fillRect(0, 0, 640, 480);
    x.fillStyle = "#111"; [[200, 360], [450, 360]].forEach(([cx, cy]) => { x.beginPath(); x.arc(cx, cy, 52, 0, 7); x.fill(); x.fillStyle = "#bbb"; x.beginPath(); x.arc(cx, cy, 20, 0, 7); x.fill(); x.fillStyle = "#111"; });
    x.fillStyle = "#14b8a6"; x.beginPath(); x.moveTo(150, 330); x.quadraticCurveTo(170, 250, 300, 260); x.lineTo(420, 260); x.quadraticCurveTo(500, 270, 500, 340); x.lineTo(150, 340); x.fill();
    x.fillStyle = "#0f766e"; x.fillRect(300, 230, 110, 26);
    x.strokeStyle = "#333"; x.lineWidth = 10; x.beginPath(); x.moveTo(440, 270); x.lineTo(470, 170); x.stroke();
    x.lineWidth = 8; x.beginPath(); x.moveTo(445, 170); x.lineTo(505, 165); x.stroke();
    x.fillStyle = "#ffe08a"; x.beginPath(); x.arc(485, 205, 13, 0, 7); x.fill();
    return jpg(c);
  }
  function plate(colors) {
    const [c, x] = canvas(640, 480);
    x.fillStyle = "#7a4e2d"; x.fillRect(0, 0, 640, 480);
    for (let i = 0; i < 640; i += 40) { x.fillStyle = i % 80 ? "rgba(0,0,0,.06)" : "rgba(255,255,255,.04)"; x.fillRect(i, 0, 20, 480); }
    x.fillStyle = "#f4f1ea"; x.beginPath(); x.arc(320, 240, 190, 0, 7); x.fill();
    x.fillStyle = "#e7e2d6"; x.beginPath(); x.arc(320, 240, 150, 0, 7); x.fill();
    colors.forEach(([col, dx, dy, r]) => { x.fillStyle = col; x.beginPath(); x.ellipse(320 + dx, 240 + dy, r, r * 0.8, 0.4, 0, 7); x.fill(); });
    return jpg(c);
  }
  function palace() {
    const [c, x] = canvas(640, 480);
    const g = x.createLinearGradient(0, 0, 0, 480); g.addColorStop(0, "#2b2d6e"); g.addColorStop(0.55, "#f08a5d"); g.addColorStop(1, "#3a2a2a");
    x.fillStyle = g; x.fillRect(0, 0, 640, 480);
    x.fillStyle = "#24161a";
    x.fillRect(120, 260, 400, 160); x.fillRect(280, 180, 80, 100);
    [[160, 240], [300, 150], [480, 240]].forEach(([dx, dy]) => { x.beginPath(); x.arc(dx, dy + 22, 30, Math.PI, 0); x.fill(); });
    x.fillStyle = "#ffd36b"; for (let i = 0; i < 9; i++) for (let j = 0; j < 3; j++) x.fillRect(140 + i * 42, 290 + j * 40, 8, 14);
    return jpg(c);
  }

  // ---------- A small real PDF ----------
  function pdf(title, lines) {
    const esc = (s) => String(s).replace(/[\\()]/g, (m) => "\\" + m).replace(/[^\x20-\x7e]/g, "-");
    const body = ["BT /F2 18 Tf 56 780 Td (" + esc(title) + ") Tj ET", "BT /F1 11 Tf 56 750 Td 16 TL"];
    lines.forEach((l) => body.push("(" + esc(l) + ") Tj T*"));
    body.push("ET", "BT /F2 9 Tf 56 60 Td (SAMPLE - DEMO DATA - NOT A REAL DOCUMENT) Tj ET");
    const stream = body.join("\n");
    const objs = [
      "<</Type/Catalog/Pages 2 0 R>>",
      "<</Type/Pages/Kids[3 0 R]/Count 1>>",
      "<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R/F2 6 0 R>>>>>>",
      "<</Length " + stream.length + ">>stream\n" + stream + "\nendstream",
      "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
      "<</Type/Font/Subtype/Type1/BaseFont/Helvetica-Bold>>"
    ];
    let out = "%PDF-1.4\n";
    const offs = [];
    objs.forEach((o, i) => { offs.push(out.length); out += (i + 1) + " 0 obj\n" + o + "\nendobj\n"; });
    const xref = out.length;
    out += "xref\n0 " + (objs.length + 1) + "\n0000000000 65535 f \n" + offs.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("");
    out += "trailer\n<</Size " + (objs.length + 1) + "/Root 1 0 R>>\nstartxref\n" + xref + "\n%%EOF\n";
    return { data: "data:application/pdf;base64," + btoa(out), size: out.length };
  }

  // ---------- The pack ----------
  function pack(now = Date.now()) {
    const ago = (d, h = 10) => { const t = new Date(now - d * DAY); t.setHours(h, 15, 0, 0); return t.getTime(); };
    const pic = {
      cafe: slip({ title: "NIMRAH CAFE", sub: ["Charminar Road · Hyderabad", "Table 6 · Bill #2231"], lines: [["Irani chai x2", inr(60)], ["Osmania biscuits", inr(80)], ["Chicken sandwich", inr(220)], ["Lemon soda", inr(70)], ["Bun maska x2", inr(120)], ["GST 5%", inr(28)], ["Round off", inr(2)]], total: inr(580), foot: ["Thank you! Visit again"] }),
      pharmacy: slip({ title: "CITY CLINIC PHARMACY", sub: ["Ground floor, City Clinic", "Bill #P-77812"], lines: [["Vitamin D3 60K x4", inr(240)], ["Calcium tabs x30", inr(310)], ["Cough syrup 100ml", inr(145)], ["Bandage roll", inr(60)], ["Thermometer", inr(1095)]], total: inr(1850), foot: ["Keep this bill for your records"], table: "#4b5b6b", tilt: 0.02 }),
      fuel: slip({ title: "HIGHWAY FUELS", sub: ["Outer Ring Road", "Pump 3 · Petrol"], lines: [["Rate / L", inr(106)], ["Litres", "5.20"], ["Amount", inr(551)]], total: inr(551), foot: ["Vehicle: My scooter"], table: "#3f4a3f", tilt: -0.04 }),
      prescription: letter({ head: "Dr Asha Verma", sub: ["MBBS, MD (General Medicine)", "City Clinic · Reg. no. DEMO-0000"], accent: "#16a34a",
        rows: [{ h: "Rx" }, ["Vitamin D3 60K", "1 capsule weekly", "after food · 8 weeks"], ["Calcium 500 mg", "1 tablet daily", "after dinner · 30 days"], { h: "Advice" }, ["Walk 30 minutes a day", ""], ["Review in 6 weeks", "with blood test"]],
        note: ["Patient: Sample Person, 34", "Date: as filed in Stash"] }),
      lab: letter({ head: "City Clinic Laboratory", sub: ["Complete blood count (sample report)", "Collected 8:10 am · Reported 2:30 pm"], accent: "#7c3aed",
        rows: [["Haemoglobin", "13.6 g/dL", "Range 12.0 - 15.5"], ["WBC count", "7,200 /µL", "Range 4,000 - 11,000"], ["Platelets", "2.6 lakh /µL", "Range 1.5 - 4.5 lakh"], ["Vitamin D", "18 ng/mL", "Range 30 - 100"]],
        note: ["Sample report made up for the Stash demo."], table: "#cfd6e0" }),
      scooter: scooter(),
      coffee: plate([["#5b3a1e", 0, 0, 70], ["#c69c6d", 0, 0, 50]]),
      dosa: plate([["#d9a441", -20, 0, 120], ["#f3e2b0", 40, 30, 40], ["#a33b20", 90, -60, 26], ["#f5f5f5", -90, 70, 24]]),
      palace: palace()
    };
    const rx = pdf("Prescription - Dr Asha Verma, City Clinic", ["Patient: Sample Person, 34", "", "1. Vitamin D3 60K - 1 capsule weekly after food, 8 weeks", "2. Calcium 500 mg - 1 tablet daily after dinner, 30 days", "", "Advice: walk 30 minutes a day. Review in 6 weeks with a blood test.", "", "Dr Asha Verma, MBBS, MD"]);
    const discharge = pdf("Discharge summary - City Clinic", ["Patient: Sample Person, 34", "Admitted: 3 days, day care ward", "Reason: observation after a minor procedure", "Condition at discharge: stable", "Follow-up: Dr Asha Verma in 1 week", "", "This is a made-up summary for the Stash demo."]);

    const notes = [
      { title: "Groceries", content: "- [ ] milk\n- [ ] curd\n- [x] bread\n- [ ] tomatoes\n- [ ] coriander", color: "#ffd60a", pinned: true, createdAt: ago(1), updatedAt: ago(0, 9) },
      { title: "Trip to Mysore", content: "# Plan\nTrain at **6:15 am**, coach B2, seat 41.\n- Palace in the evening (lights at 7)\n- Chamundi hills early morning\n- ==Book the homestay==\n\n## Packing\n- [ ] charger\n- [ ] umbrella", createdAt: ago(9), updatedAt: ago(2) },
      { title: "Ideas", content: "Stash themes that *change with the icon*.\nA ++monthly summary++ for each collection.\n~~Dark mode only~~ Auto is better.", color: "#bf5af2", createdAt: ago(14), updatedAt: ago(5) },
      { title: "Wi-Fi at City Clinic", content: "Ask at the front desk. Works in the waiting area only.", createdAt: ago(20), updatedAt: ago(20) },
      { title: "Lemon rice", content: "1. Cook rice, let it cool\n2. Mustard, chana dal, curry leaves, peanuts\n3. Turmeric, then rice\n4. Lemon juice at the end, off the heat", color: "#30d158", images: [pic.dosa], createdAt: ago(30), updatedAt: ago(30) },
      { title: "Books to read", content: "- The Psychology of Money\n- Atomic Habits\n- Wings of Fire", createdAt: ago(40), updatedAt: ago(40) },
      { title: "Scooter service", content: "Next service at **12,500 km**. Ask about the brake pads.", remindAt: now + 10 * DAY, createdAt: ago(6), updatedAt: ago(6) }
    ];
    const inbox = [
      { content: "Call City Clinic to book the follow-up", createdAt: ago(0, 8), updatedAt: ago(0, 8) },
      { content: "Lunch with the team", images: [pic.cafe], createdAt: ago(1, 13), updatedAt: ago(1, 13) },
      { title: "Prescription - Dr Asha Verma.pdf", files: [{ name: "Prescription - Dr Asha Verma.pdf", type: "application/pdf", size: rx.size, data: rx.data }], createdAt: ago(2, 18), updatedAt: ago(2, 18) },
      { content: "https://example.com/recipes/lemon-rice", createdAt: ago(3, 20), updatedAt: ago(3, 20) },
      { content: "Fuel 5.2 L ₹551 at 12,180 km", images: [pic.fuel], createdAt: ago(4, 9), updatedAt: ago(4, 9) }
    ];
    const collections = [
      { template: "hospital", name: "Health", pages: [{ name: "Dr Asha Verma", type: "doctor" }], entries: [
        { s: "Prescriptions", page: "Dr Asha Verma", title: "Prescription", note: "Vitamin D3 weekly for 8 weeks. Review in 6 weeks.", at: ago(12, 11), photos: [pic.prescription] },
        { s: "Bills", page: "Dr Asha Verma", title: "Consultation fee", amount: 70000, at: ago(12, 11) },
        { s: "Lab Reports", page: "Dr Asha Verma", title: "Blood test (CBC, Vitamin D)", note: "Vitamin D low; rest in range.", at: ago(14, 9), photos: [pic.lab], amount: 120000 },
        { s: "Medicines", title: "Pharmacy bill", amount: 185000, at: ago(12, 12), photos: [pic.pharmacy] },
        { s: "Bills", title: "Day care: discharge summary", note: "Discharge summary PDF is in the Inbox demo.", amount: 450000, at: ago(60, 16) }
      ] },
      { template: "bike", name: "Vehicles", pages: [{ name: "My scooter", type: "vehicle" }], entries: [
        { s: "Fuel", page: "My scooter", title: "Fill-up", amount: 55100, at: ago(4, 9), fields: { Odometer: 12180, Litres: 5.2 }, photos: [pic.fuel] },
        { s: "Fuel", page: "My scooter", title: "Fill-up", amount: 53000, at: ago(18, 9), fields: { Odometer: 11960, Litres: 5 } },
        { s: "Fuel", page: "My scooter", title: "Fill-up", amount: 58300, at: ago(33, 9), fields: { Odometer: 11720, Litres: 5.5 } },
        { s: "Service", page: "My scooter", title: "General service", note: "Oil change, chain adjusted. Brake pads at 50%.", amount: 240000, at: ago(45, 17), fields: { Odometer: 11500 } },
        { s: "Insurance & papers", page: "My scooter", title: "Insurance renewed", note: "Policy for one year.", amount: 198000, at: ago(70, 12) },
        { s: "Photos", page: "My scooter", title: "Washed and shiny", at: ago(8, 16), photos: [pic.scooter] }
      ] },
      { template: "food", name: "Food", pages: [{ name: "Nimrah Cafe", type: "restaurant" }], entries: [
        { s: "Bills", page: "Nimrah Cafe", title: "Lunch with the team", amount: 58000, at: ago(1, 13), photos: [pic.cafe], rating: 4 },
        { s: "Dishes", page: "Nimrah Cafe", title: "Irani chai", note: "Best with Osmania biscuits.", rating: 5, at: ago(15, 17), photos: [pic.coffee] },
        { s: "Wishlist", title: "Masala dosa near the station", at: ago(3, 20) }
      ] },
      { template: "trips", name: "Trips", pages: [{ name: "Mysore", type: "place" }], entries: [
        { s: "Tickets", page: "Mysore", title: "Train to Mysore", note: "Coach B2, seat 41. Leaves 6:15 am.", amount: 75000, at: ago(25, 6) },
        { s: "Stays", page: "Mysore", title: "Homestay, 2 nights", amount: 240000, at: ago(25, 13) },
        { s: "Meals", page: "Mysore", title: "Masala dosa breakfast", amount: 12000, at: ago(24, 8), photos: [pic.dosa] },
        { s: "Photos", page: "Mysore", title: "Palace lights", at: ago(24, 19), photos: [pic.palace] }
      ] }
    ];
    return { notes, inbox, collections, files: { discharge } };
  }

  window.CPDemo = { pack, pdf };
})();
