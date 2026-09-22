(function () {
  "use strict";

  var deptChart = null;

  function showToast(msg) {
    var t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.classList.remove("show"); }, 2600);
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function perfClass(p) {
    if (p === "Exceeds" || p === "Fully Meets") return "pill-good";
    if (p === "Needs Improvement") return "pill-mid";
    if (p === "PIP") return "pill-low";
    return "pill-other";
  }

  function statusClass(s) {
    if (s === "Active" || s === "Future Start") return "pill-active";
    if (s === "Voluntarily Terminated" || s === "Terminated for Cause") return "pill-term";
    return "pill-other";
  }

  function currentQuery() {
    var params = new URLSearchParams();
    var department = document.getElementById("departmentFilter").value;
    var status = document.getElementById("statusFilter").value;
    var performance = document.getElementById("performanceFilter").value;
    var sex = document.getElementById("sexFilter").value;
    var q = document.getElementById("searchInput").value.trim();
    if (department) params.set("department", department);
    if (status) params.set("status", status);
    if (performance) params.set("performance", performance);
    if (sex) params.set("sex", sex);
    if (q) params.set("q", q);
    return params.toString();
  }

  function refresh() {
    fetch("/api/employees?" + currentQuery())
      .then(function (r) { return r.json(); })
      .then(renderAll)
      .catch(function () { showToast("โหลดข้อมูลไม่สำเร็จ"); });
  }

  function renderAll(data) {
    renderStats(data);
    renderBars("statusBars", data.status_counts, "ยังไม่มีข้อมูล");
    renderBars("perfBars", data.performance_counts, "ยังไม่มีข้อมูล");
    renderChart(data.department_counts);
    renderTable(data.employees, data.total);
  }

  function renderStats(data) {
    var cards = [
      { num: data.total.toLocaleString("th-TH"), lbl: "พนักงานทั้งหมด" },
      { num: data.active.toLocaleString("th-TH"), lbl: "พนักงานที่ยังทำงานอยู่ (Active)" },
      { num: data.terminated.toLocaleString("th-TH"), lbl: "พ้นสภาพการจ้าง" },
      { num: data.total ? "$" + data.avg_pay.toFixed(1) : "—", lbl: "อัตราค่าจ้างเฉลี่ย/ชม." },
      { num: data.total ? data.avg_engagement.toFixed(2) : "—", lbl: "Engagement Survey เฉลี่ย" }
    ];
    document.getElementById("statsRow").innerHTML = cards.map(function (c) {
      return '<div class="stat"><div class="num">' + c.num + '</div><div class="lbl">' + c.lbl + '</div></div>';
    }).join("");
  }

  function renderBars(elId, counts, emptyMsg) {
    var wrap = document.getElementById(elId);
    var entries = Object.keys(counts).map(function (k) { return [k, counts[k]]; });
    if (!entries.length) {
      wrap.innerHTML = '<div style="font-size:12.5px;color:var(--ink-soft);">' + emptyMsg + '</div>';
      return;
    }
    entries.sort(function (a, b) { return b[1] - a[1]; });
    var max = entries[0][1];
    wrap.innerHTML = entries.map(function (e) {
      var pct = max ? Math.round((e[1] / max) * 100) : 0;
      return '<div class="b-row">' +
        '<div class="b-name">' + escapeHtml(e[0]) + '</div>' +
        '<div class="b-track"><div class="b-fill" style="width:' + pct + '%"></div></div>' +
        '<div class="b-count">' + e[1] + '</div>' +
        '</div>';
    }).join("");
  }

  function renderChart(departmentCounts) {
    var ctx = document.getElementById("deptChart").getContext("2d");
    var entries = Object.keys(departmentCounts).map(function (k) { return [k, departmentCounts[k]]; });
    entries.sort(function (a, b) { return b[1] - a[1]; });
    if (deptChart) deptChart.destroy();
    deptChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: entries.map(function (e) { return e[0]; }),
        datasets: [{ label: "จำนวนพนักงาน", data: entries.map(function (e) { return e[1]; }), backgroundColor: "#b8902f", borderRadius: 3, maxBarThickness: 40 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: "y",
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, grid: { color: "#ece7d8" }, ticks: { precision: 0 } },
          y: { grid: { display: false }, ticks: { font: { size: 11 } } }
        }
      }
    });
  }

  function renderTable(employees, total) {
    document.getElementById("countTag").textContent = employees.length.toLocaleString("th-TH") + " รายการ";
    var body = document.getElementById("tableBody");
    var empty = document.getElementById("emptyState");
    var table = document.getElementById("dataTable");

    if (!total) {
      table.style.display = "none";
      empty.style.display = "block";
      empty.querySelector(".big").textContent = "ยังไม่มีข้อมูล";
      empty.querySelector(".hint").textContent = "อัปโหลดไฟล์ CSV/TSV หรือกดโหลดข้อมูลตัวอย่างเพื่อเริ่มต้น";
      return;
    }
    if (!employees.length) {
      table.style.display = "none";
      empty.style.display = "block";
      empty.querySelector(".big").textContent = "ไม่พบข้อมูลที่ตรงกับตัวกรอง";
      empty.querySelector(".hint").textContent = "ลองเปลี่ยนแผนก สถานะ ผลประเมิน หรือคำค้นหา";
      return;
    }
    table.style.display = "table";
    empty.style.display = "none";
    body.innerHTML = employees.map(function (e) {
      var payDisplay = e.pay_rate ? "$" + Number(e.pay_rate).toFixed(2) : "—";
      return "<tr>" +
        "<td>" + escapeHtml(e.name) + "</td>" +
        "<td>" + escapeHtml(e.department) + "</td>" +
        "<td>" + escapeHtml(e.position) + "</td>" +
        "<td>" + escapeHtml(e.manager) + "</td>" +
        "<td><span class='pill " + statusClass(e.status) + "'>" + escapeHtml(e.status) + "</span></td>" +
        "<td>" + escapeHtml(e.sex) + "</td>" +
        "<td><span class='pill " + perfClass(e.performance) + "'>" + escapeHtml(e.performance) + "</span></td>" +
        "<td>" + (e.engagement ? Number(e.engagement).toFixed(2) : "—") + "</td>" +
        "<td>" + payDisplay + "</td>" +
        "<td>" + escapeHtml(e.date_of_hire) + "</td>" +
        "<td><button class=\"danger-small\" onclick=\"deleteEmployee(\'" + escapeHtml(e.id) + "\')\">ลบ</button></td>" +
        "</tr>";
    }).join("");
  }

  function reloadFilterOptions(data) {
    // rebuild <select> option lists after new data arrives (upload / sample)
    var deptSel = document.getElementById("departmentFilter");
    var statusSel = document.getElementById("statusFilter");
    var perfSel = document.getElementById("performanceFilter");

    var departments = Object.keys(data.department_counts).sort();
    var statuses = Object.keys(data.status_counts).sort();
    var performances = Object.keys(data.performance_counts).sort();

    deptSel.innerHTML = '<option value="">ทุกแผนก</option>' + departments.map(function (d) {
      return '<option value="' + escapeHtml(d) + '">' + escapeHtml(d) + '</option>';
    }).join("");
    statusSel.innerHTML = '<option value="">ทุกสถานะ</option>' + statuses.map(function (s) {
      return '<option value="' + escapeHtml(s) + '">' + escapeHtml(s) + '</option>';
    }).join("");
    perfSel.innerHTML = '<option value="">ทุกผลประเมิน</option>' + performances.map(function (p) {
      return '<option value="' + escapeHtml(p) + '">' + escapeHtml(p) + '</option>';
    }).join("");
  }

  document.getElementById("uploadBtn").addEventListener("click", function () {
    document.getElementById("fileInput").click();
  });

  document.getElementById("fileInput").addEventListener("change", function (e) {
    var file = e.target.files[0];
    if (!file) return;
    var formData = new FormData();
    formData.append("file", file);
    fetch("/upload", { method: "POST", body: formData })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res.ok) { showToast(res.message || "อัปโหลดไม่สำเร็จ"); return; }
        showToast("อัปโหลดสำเร็จ: " + res.count + " รายการ");
        return fetch("/api/employees").then(function (r) { return r.json(); }).then(function (data) {
          reloadFilterOptions(data);
          renderAll(data);
        });
      })
      .catch(function () { showToast("อัปโหลดไม่สำเร็จ"); });
    e.target.value = "";
  });

  document.getElementById("sampleBtn").addEventListener("click", function () {
    fetch("/api/sample", { method: "POST" })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        showToast("โหลดข้อมูลตัวอย่างแล้ว: " + res.count + " รายการ");
        return fetch("/api/employees").then(function (r) { return r.json(); }).then(function (data) {
          reloadFilterOptions(data);
          renderAll(data);
        });
      })
      .catch(function () { showToast("โหลดข้อมูลตัวอย่างไม่สำเร็จ"); });
  });

  document.getElementById("departmentFilter").addEventListener("change", refresh);
  document.getElementById("statusFilter").addEventListener("change", refresh);
  document.getElementById("performanceFilter").addEventListener("change", refresh);
  document.getElementById("sexFilter").addEventListener("change", refresh);
  document.getElementById("searchInput").addEventListener("input", refresh);

  window.deleteEmployee = function(id) {
    if (!confirm("ต้องการลบข้อมูลพนักงานคนนี้ใช่หรือไม่?")) return;
    fetch("/api/employees/" + encodeURIComponent(id), {method:"DELETE"})
      .then(r=>r.json()).then(res=>{ if(!res.ok) throw new Error(res.message); showToast("ลบข้อมูลแล้ว"); refresh(); })
      .catch(e=>showToast(e.message || "ลบข้อมูลไม่สำเร็จ"));
  };
  document.getElementById("addBtn").addEventListener("click", function(){ document.getElementById("employeeModal").style.display="flex"; });
  document.getElementById("cancelAddBtn").addEventListener("click", function(){ document.getElementById("employeeModal").style.display="none"; });
  document.getElementById("employeeForm").addEventListener("submit", function(ev){
    ev.preventDefault();
    var obj={}; new FormData(ev.target).forEach(function(v,k){obj[k]=v;});
    fetch("/api/employees",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(obj)})
      .then(r=>r.json()).then(res=>{if(!res.ok) throw new Error(res.message); document.getElementById("employeeModal").style.display="none"; ev.target.reset(); showToast("เพิ่มพนักงานแล้ว"); refresh();})
      .catch(e=>showToast(e.message || "เพิ่มข้อมูลไม่สำเร็จ"));
  });
  document.getElementById("deleteAllBtn").addEventListener("click", function(){
    if(!confirm("ลบข้อมูลพนักงานทั้งหมดใช่หรือไม่? การกระทำนี้ย้อนกลับไม่ได้")) return;
    fetch("/api/employees",{method:"DELETE"}).then(r=>r.json()).then(()=>{showToast("ลบข้อมูลทั้งหมดแล้ว");refresh();}).catch(()=>showToast("ลบข้อมูลไม่สำเร็จ"));
  });

  refresh();
})();
