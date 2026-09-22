# ระบบแดชบอร์ดข้อมูลนักศึกษา (Flask)

เว็บแอปพลิเคชันตามโจทย์งานแลป:
- สร้าง web application ด้วย Flask
- อัปโหลดข้อมูลด้วยไฟล์ CSV ที่กำหนดรูปแบบไว้
- มีหน้าแดชบอร์ด (สถิติ + กราฟ)
- กรองข้อมูลบางส่วนผ่าน API endpoint (`/api/students`) — ทำหน้าที่เป็น Module กรองข้อมูล
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
    sample_students.csv  ไฟล์ตัวอย่างสำหรับทดสอบอัปโหลด
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

ทดสอบอัปโหลดด้วยไฟล์ `data/sample_students.csv` หรือกดปุ่ม "โหลดข้อมูลตัวอย่าง" บนหน้าเว็บ

## รูปแบบไฟล์ CSV ที่รองรับ

คอลัมน์ (ใช้ภาษาไทยหรืออังกฤษก็ได้):

| คอลัมน์ | ตัวอย่าง |
|---|---|
| รหัสนักศึกษา | 641001 |
| ชื่อ | สมชาย ใจดี |
| คณะ | วิศวกรรมศาสตร์ |
| สาขา | วิศวกรรมคอมพิวเตอร์ |
| ชั้นปี | 2 |
| เกรดเฉลี่ย | 3.45 |

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
