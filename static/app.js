(function () {
  "use strict";

  var gpaChart = null;

  function showToast(msg) {
    var t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.classList.remove("show"); }, 2600);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function gpaClass(g) {
    if (g >= 3.25) return "gpa-good";
    if (g >= 2.5) return "gpa-mid";
    return "gpa-low";
  }

  function currentQuery() {
    var params = new URLSearchParams();
    var faculty = document.getElementById("facultyFilter").value;
    var year = document.getElementById("yearFilter").value;
    var q = document.getElementById("searchInput").value.trim();
    if (faculty) params.set("faculty", faculty);
    if (year) params.set("year", year);
    if (q) params.set("q", q);
    return params.toString();
  }

  function refresh() {
    fetch("/api/students?" + currentQuery())
      .then(function (r) { return r.json(); })
      .then(renderAll)
      .catch(function () { showToast("โหลดข้อมูลไม่สำเร็จ"); });
  }

  function renderAll(data) {
    renderStats(data);
    renderFacultyBars(data.faculty_counts);
    renderChart(data.gpa_by_year);
    renderTable(data.students, data.total);
  }

  function renderStats(data) {
    var cards = [
      { num: data.total.toLocaleString("th-TH"), lbl: "นักศึกษาทั้งหมด" },
      { num: data.total ? data.avg_gpa.toFixed(2) : "—", lbl: "เกรดเฉลี่ยรวม" },
      { num: data.faculty_count, lbl: "จำนวนคณะ" },
      { num: data.honors, lbl: "เกียรตินิยม (GPA ≥ 3.50)" }
    ];
    document.getElementById("statsRow").innerHTML = cards.map(function (c) {
      return '<div class="stat"><div class="num">' + c.num + '</div><div class="lbl">' + c.lbl + '</div></div>';
    }).join("");
  }

  function renderFacultyBars(counts) {
    var wrap = document.getElementById("facultyBars");
    var entries = Object.keys(counts).map(function (k) { return [k, counts[k]]; });
    if (!entries.length) {
      wrap.innerHTML = '<div style="font-size:12.5px;color:var(--ink-soft);">ยังไม่มีข้อมูล</div>';
      return;
    }
    entries.sort(function (a, b) { return b[1] - a[1]; });
    var max = entries[0][1];
    wrap.innerHTML = entries.map(function (e) {
      var pct = Math.round((e[1] / max) * 100);
      return '<div class="fb-row">' +
        '<div class="fb-name">' + escapeHtml(e[0]) + '</div>' +
        '<div class="fb-track"><div class="fb-fill" style="width:' + pct + '%"></div></div>' +
        '<div class="fb-count">' + e[1] + '</div>' +
        '</div>';
    }).join("");
  }

  function renderChart(gpaByYear) {
    var ctx = document.getElementById("gpaChart").getContext("2d");
    var years = [1, 2, 3, 4];
    var avgs = years.map(function (y) { return gpaByYear[y] || 0; });
    if (gpaChart) gpaChart.destroy();
    gpaChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: years.map(function (y) { return "ปี " + y; }),
        datasets: [{ label: "เกรดเฉลี่ย", data: avgs, backgroundColor: "#b8902f", borderRadius: 3, maxBarThickness: 46 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, max: 4, ticks: { stepSize: 1 }, grid: { color: "#ece7d8" } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  function renderTable(students, total) {
    document.getElementById("countTag").textContent = students.length.toLocaleString("th-TH") + " รายการ";
    var body = document.getElementById("tableBody");
    var empty = document.getElementById("emptyState");
    var table = document.getElementById("dataTable");

    if (!total) {
      table.style.display = "none";
      empty.style.display = "block";
      empty.querySelector(".big").textContent = "ยังไม่มีข้อมูล";
      empty.querySelector(".hint").textContent = "อัปโหลดไฟล์ CSV หรือกดโหลดข้อมูลตัวอย่างเพื่อเริ่มต้น";
      return;
    }
    if (!students.length) {
      table.style.display = "none";
      empty.style.display = "block";
      empty.querySelector(".big").textContent = "ไม่พบข้อมูลที่ตรงกับตัวกรอง";
      empty.querySelector(".hint").textContent = "ลองเปลี่ยนคณะ ชั้นปี หรือคำค้นหา";
      return;
    }
    table.style.display = "table";
    empty.style.display = "none";
    body.innerHTML = students.map(function (s) {
      return "<tr>" +
        "<td>" + escapeHtml(s.id) + "</td>" +
        "<td>" + escapeHtml(s.name) + "</td>" +
        "<td>" + escapeHtml(s.faculty) + "</td>" +
        "<td>" + escapeHtml(s.major) + "</td>" +
        "<td>ปี " + s.year + "</td>" +
        "<td><span class='gpa-pill " + gpaClass(s.gpa) + "'>" + s.gpa.toFixed(2) + "</span></td>" +
        "</tr>";
    }).join("");
  }

  function reloadFilterOptions(data) {
    // rebuild <select> option lists after new data arrives (upload / sample)
    var facSel = document.getElementById("facultyFilter");
    var yearSel = document.getElementById("yearFilter");
    var faculties = Object.keys(data.faculty_counts).sort();
    var years = Object.keys(data.gpa_by_year).filter(function (y) { return data.gpa_by_year[y] > 0 || true; });
    facSel.innerHTML = '<option value="">ทุกคณะ</option>' + faculties.map(function (f) {
      return '<option value="' + escapeHtml(f) + '">' + escapeHtml(f) + '</option>';
    }).join("");
    yearSel.innerHTML = '<option value="">ทุกชั้นปี</option>' + [1, 2, 3, 4].map(function (y) {
      return '<option value="' + y + '">ปี ' + y + '</option>';
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
        return fetch("/api/students").then(function (r) { return r.json(); }).then(function (data) {
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
        return fetch("/api/students").then(function (r) { return r.json(); }).then(function (data) {
          reloadFilterOptions(data);
          renderAll(data);
        });
      })
      .catch(function () { showToast("โหลดข้อมูลตัวอย่างไม่สำเร็จ"); });
  });

  document.getElementById("facultyFilter").addEventListener("change", refresh);
  document.getElementById("yearFilter").addEventListener("change", refresh);
  document.getElementById("searchInput").addEventListener("input", refresh);

  refresh();
})();
