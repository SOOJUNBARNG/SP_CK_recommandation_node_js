let allClinicData = [];
let currentClinic = null;

async function loadData() {
  const res = await fetch("timetable.json");
  allClinicData = await res.json();
  populateClinicSelector();
  switchClinic(allClinicData[0].Clinic);
}

function populateClinicSelector() {
  const selector = document.getElementById("clinicSelector");
  selector.innerHTML = allClinicData
    .map(c => `<option value="${c.Clinic}">${c.Clinic}</option>`)
    .join("");
}

function switchClinic(clinicName) {
  currentClinic = allClinicData.find(c => c.Clinic === clinicName);
  renderTable();
  renderBarChart();
}

function renderTable() {
  const container = document.getElementById("timetable-container");
  container.innerHTML = "";

  const timeSlots = generateTimeSlots("09:00", "20:00");
  const table = document.createElement("table");
  table.className = "table table-bordered";

  const thead = document.createElement("thead");
  const header = document.createElement("tr");
  header.innerHTML = "<th>時間・CK</th>";

  // Step 1: Get unique CKs and group patients by CK
  const ckMap = {};
  currentClinic.patients.forEach(p => {
    if (!ckMap[p.CK]) ckMap[p.CK] = [];
    ckMap[p.CK].push(p);
  });

  const ckList = Object.keys(ckMap);
  ckList.forEach(ck => {
    const th = document.createElement("th");
    th.textContent = ck;
    header.appendChild(th);
  });

  thead.appendChild(header);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  timeSlots.forEach(time => {
    const row = document.createElement("tr");
    const timeCell = document.createElement("th");
    timeCell.textContent = time;
    row.appendChild(timeCell);

    ckList.forEach(ck => {
      const td = document.createElement("td");
      const patients = ckMap[ck];

      // Collect patients scheduled at this time under this CK
      const matches = patients
        .map(p => {
          const match = p.schedule.find(s => s.start === time);
          if (match) {
            return {
              name: p.Patient,
              start: match.start,
              end: match.end,
              option1: (p.options[0] && p.options[0].CK_option1) || ""
            };
          }
          return null;
        })
        .filter(Boolean);

      if (matches.length) {
        td.innerHTML = matches.map(m =>
          `<div><strong>${m.name}</strong><br>${m.start}〜${m.end}<br>${m.option1}</div>`
        ).join("<hr>");
      }

      td.onclick = () => {
        const patientName = prompt("どの患者を編集しますか？", matches[0]?.name || "");
        if (!patientName) return;

        const patient = patients.find(p => p.Patient === patientName);
        if (!patient) {
          alert("患者が見つかりません");
          return;
        }

        const newEnd = prompt("終了時刻:", "11:00");
        if (!newEnd) return;

        const option = prompt("CK_option1 入力:", "例: 加藤");
        const newEntry = { start: time, end: newEnd };

        const idx = patient.schedule.findIndex(s => s.start === time);
        if (idx !== -1) patient.schedule[idx] = newEntry;
        else patient.schedule.push(newEntry);

        patient.options[0] = { CK_option1: option };

        renderTable();
        renderBarChart();
      };

      row.appendChild(td);
    });

    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  container.appendChild(table);
}


function renderBarChart() {
  const ctx = document.getElementById("barChart").getContext("2d");

  const allEntries = currentClinic.patients.flatMap(p =>
    p.schedule.map(s => ({
      CK: p.CK,
      start: timeToFloat(s.start),
      end: timeToFloat(s.end)
    }))
  );

  const labels = [...new Set(allEntries.map(e => e.CK))];
  const data = allEntries.map(e => ({
    x: e.CK,
    y: [e.start, e.end]
  }));

  // 🎨 CKごとに色を生成
  const colorMap = {};
  labels.forEach((label, i) => {
    const hue = (i * 60) % 360; // HSLで色を分散
    colorMap[label] = `hsl(${hue}, 70%, 60%)`;
  });

  const backgroundColors = data.map(e => colorMap[e.x]);

  if (window.chartInstance) window.chartInstance.destroy();

  window.chartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "時間帯",
        data,
        backgroundColor: backgroundColors
      }]
    },
    options: {
      parsing: { xAxisKey: "x", yAxisKey: "y" },
      scales: {
        x: {
          title: { display: true, text: "CK（担当者）" }
        },
        y: {
          min: 9,
          max: 20,
          reverse: true,
          ticks: {
            callback: v => `${Math.floor(v)}:00`
          },
          title: {
            display: true,
            text: "時間"
          }
        }
      }
    }
  });
}



function AddNewCK() {
  const ckName = prompt("新しいCK（担当者）名を入力してください:");

  if (!ckName) return;

  // Check if any patient already has this CK in the current clinic
  const exists = currentClinic.patients.some(p => p.CK === ckName);
  if (exists) {
    alert("このCKはすでに存在します。");
    return;
  }

  // Add a dummy patient to represent a new CK column
  currentClinic.patients.push({
    Patient: "",
    schedule: [],
    CK: ckName,
    options: [{ CK_option1: "", CK_option2: "" }]
  });

  renderTable();
  renderBarChart();

  saveTimetable(); 
}

function AddNewCustomer() {
  const customerName = prompt("新しいお客様の名前を入力してください:");
  if (!customerName) return;

  const ckList = [...new Set(currentClinic.patients.map(p => p.CK))];
  const ckName = prompt("担当CKを次から選んでください:\n" + ckList.join(", "));
  if (!ckName || !ckList.includes(ckName)) {
    alert("有効なCK名を入力してください。");
    return;
  }

  const start = prompt("開始時刻を入力してください (例: 09:00):", "09:00");
  const end = prompt("終了時刻を入力してください (例: 11:00):", "11:00");
  if (!start || !end) return;


  // Add new patient under the selected CK
  currentClinic.patients.push({
    Patient: customerName,
    schedule: [start, end],
    CK: ckName,
    options: [{ CK_option1: "", CK_option2: "" }]
  });

  renderTable();
  renderBarChart();

  saveTimetable(); 
}

function DeleteCK() {
  const ckName = prompt("削除するCK（担当者）の名前を入力してください:");
  if (!ckName) return;

  const exists = currentClinic.patients.some(p => p.CK === ckName);
  if (!exists) {
    alert("そのCKは存在しません。");
    return;
  }

  currentClinic.patients = currentClinic.patients.filter(p => p.CK !== ckName);
  renderTable();
  renderBarChart();

  saveTimetable(); 
}

function DeleteCustomer() {
  const customerName = prompt("削除するお客様の名前を入力してください:");
  if (!customerName) return;

  const index = currentClinic.patients.findIndex(p => p.Patient === customerName);
  if (index === -1) {
    alert("そのお客様は存在しません。");
    return;
  }

  currentClinic.patients.splice(index, 1);
  renderTable();
  renderBarChart();

  saveTimetable(); 
}

function saveTimetable() {
  fetch('/save', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(timetable)  // This assumes `timetable` is the full object structure you're modifying
  })
  .then(res => {
    if (!res.ok) throw new Error("Failed to save.");
    return res.text();
  })
  .then(msg => {
    console.log("✅ Save successful:", msg);
  })
  .catch(err => {
    console.error("❌ Save failed:", err);
    alert("保存に失敗しました");
  });
}

function generateTimeSlots(start, end) {
  const slots = [];
  let [sh] = start.split(":").map(Number);
  const [eh] = end.split(":").map(Number);
  while (sh < eh) {
    slots.push(`${String(sh).padStart(2, "0")}:00`);
    sh++;
  }
  return slots;
}

function timeToFloat(t) {
  const [h, m] = t.split(":").map(Number);
  return h + m / 60;
}

loadData();
