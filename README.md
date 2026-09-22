# ระบบแดชบอร์ดข้อมูลพนักงาน (Flask, HR)

เว็บแอปพลิเคชันตามโจทย์งานแลป:
- สร้าง web application ด้วย Flask
- อัปโหลดข้อมูลด้วยไฟล์ที่กำหนด (CSV/TSV เช่น `HR_DATA.txt`)
- มีหน้าแดชบอร์ด (สถิติ + กราฟ)
- กรองข้อมูลบางส่วนผ่าน API endpoint (`/api/employees`) — ทำหน้าที่เป็น Module กรองข้อมูล
- พร้อม deploy ขึ้น Vercel

## โครงสร้างไฟล์

```
flask-app/
  app.py              โค้ด Flask หลัก (routes ทั้งหมด)
  requirements.txt    dependency (Flask)
  vercel.json         คำสั่ง build/route สำหรับ Vercel
  templates/
    index.html        หน้าแดชบอร์ด (Jinja2 template)
  static/
    style.css          สไตล์
    app.js             เรียก API, วาดกราฟ, กรองตาราง (ฝั่ง client)
  data/
    HR_DATA.txt        ไฟล์ข้อมูลพนักงานจริง (tab-separated, 3,310 แถว) สำหรับทดสอบอัปโหลด
    hr_sample.csv      ไฟล์ตัวอย่างขนาดเล็ก (comma-separated, 25 แถว)
```

## รันในเครื่องตัวเอง

```bash
cd flask-app
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

เปิดเบราว์เซอร์ไปที่ `http://127.0.0.1:5000`

ทดสอบอัปโหลดด้วยไฟล์ `data/HR_DATA.txt` (ของจริง, tab-separated) หรือ
`data/hr_sample.csv` (ตัวอย่างเล็ก, comma-separated) หรือกดปุ่ม
"โหลดข้อมูลตัวอย่าง" บนหน้าเว็บ

## รูปแบบไฟล์ที่รองรับ

รองรับทั้ง `.csv` (คั่นด้วยจุลภาค) และ `.tsv`/`.txt` (คั่นด้วย tab เช่นไฟล์
export จากระบบ HR) ระบบจะตรวจจับตัวคั่นให้อัตโนมัติ

คอลัมน์ที่รู้จัก (ใช้ชื่อคอลัมน์แบบเดิมจากไฟล์ export ได้เลย):

| คอลัมน์ในไฟล์ | เก็บเป็น field |
|---|---|
| Employee_Name | name |
| EmpID | id |
| Department | department |
| Position | position |
| ManagerName | manager |
| EmploymentStatus | status |
| Sex | sex |
| MaritalDesc | marital_status |
| RaceDesc | race |
| State | state |
| DateofHire | date_of_hire |
| DateofTermination | date_of_termination |
| PerformanceScore | performance |
| EngagementSurvey | engagement |
| EmpSatisfaction | satisfaction |
| PayRate | pay_rate |
| RecruitmentSource | recruitment_source |
| SpecialProjectsCount | special_projects |
| DaysLateLast30 | days_late |

## Deploy ขึ้น Vercel

```bash
npm install -g vercel     # ถ้ายังไม่มี Vercel CLI
cd flask-app
vercel
```

ตอบคำถามตามค่าเริ่มต้นได้เลย ระบบจะอ่าน `vercel.json` และ `requirements.txt`
โดยอัตโนมัติ แล้วขึ้นโปรเจกต์เป็น Serverless Function

**ข้อควรทราบ:** บน Vercel ระบบไฟล์เป็นแบบ ephemeral (ไฟล์ที่บันทึกไว้จะหายไปเมื่อ
function เย็นตัวลงหรือ deploy ใหม่) โค้ดนี้จึงเก็บข้อมูลที่อัปโหลดไว้ที่ `/tmp`
ซึ่งเหมาะสำหรับสาธิต/งานแลป แต่ถ้าต้องการข้อมูลถาวรจริง ให้เปลี่ยนไปใช้ฐานข้อมูล
เช่น Vercel Postgres, Supabase หรือ MongoDB Atlas แทนการเขียนไฟล์ JSON ตรงๆ
