import csv
import io
import json
import os
import random
import requests

from flask import Flask, render_template, request, jsonify

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app = Flask(__name__, template_folder=os.path.join(BASE_DIR, "templates"), static_folder=os.path.join(BASE_DIR, "static"))
app.config["MAX_CONTENT_LENGTH"] = 5 * 1024 * 1024

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
DATA_FILE = os.path.join(BASE_DIR, "data", "employees.json")

FIELD_MAP = {
    "empid":"id","id":"id","employee_name":"name","name":"name","department":"department","dept":"department",
    "position":"position","managername":"manager","manager":"manager","employmentstatus":"status","status":"status",
    "sex":"sex","gender":"sex","maritaldesc":"marital_status","marital_status":"marital_status","racedesc":"race","race":"race",
    "state":"state","dateofhire":"date_of_hire","date_of_hire":"date_of_hire","dateoftermination":"date_of_termination",
    "date_of_termination":"date_of_termination","performancescore":"performance","performance":"performance",
    "engagementsurvey":"engagement","engagement":"engagement","empsatisfaction":"satisfaction","satisfaction":"satisfaction",
    "payrate":"pay_rate","pay_rate":"pay_rate","salary":"pay_rate","recruitmentsource":"recruitment_source",
    "recruitment_source":"recruitment_source","specialprojectscount":"special_projects","special_projects":"special_projects",
    "dayslatelast30":"days_late","days_late":"days_late",
}
EMPTY_RECORD = {"id":"","name":"","department":"","position":"","manager":"","status":"","sex":"","marital_status":"","race":"","state":"",
"date_of_hire":"","date_of_termination":"","performance":"","engagement":0.0,"satisfaction":0,"pay_rate":0.0,"recruitment_source":"","special_projects":0,"days_late":0}
TERMINATED_STATUSES = {"Voluntarily Terminated","Terminated for Cause"}

def generate_sample_data():
    departments={"Sales":["Area Sales Manager","Sales Representative"],"IT/IS":["IT Support","Database Administrator","Network Engineer"],
    "Production":["Production Technician I","Production Technician II","Production Manager"],"Software Engineering":["Software Engineer","Senior Software Engineer"],
    "Admin Offices":["Administrative Assistant","Accountant"],"Executive Office":["CEO","President & CEO"]}
    statuses=["Active","Active","Active","Voluntarily Terminated","Terminated for Cause","Leave of Absence"]
    performances=["Exceeds","Fully Meets","Fully Meets","Needs Improvement","PIP"]
    first=["James","Maria","Michael","Susan","Edward","Hannah","Jessica","David","Linda","Robert"]
    last=["Gonzalez","Cockel","Bunbury","Buck","Jacobi","Riordan","Ferguson","Stanley","Monroe","Smith"]
    managers=["Peter Monroe","David Stanley","John Smith","Lynn Daneault","Kissy Sullivan"]
    sources=["Employee Referral","Billboard","Social Networks - Facebook Twitter etc","Diversity Job Fair"]
    rows=[]
    for i in range(60):
        dept=random.choice(list(departments.keys()))
        rows.append({"id":f"{1000000000+i}","name":f"{random.choice(last)}, {random.choice(first)}","department":dept,"position":random.choice(departments[dept]),
        "manager":random.choice(managers),"status":random.choice(statuses),"sex":random.choice(["M","F"]),"marital_status":random.choice(["Single","Married","Divorced","Separated"]),
        "race":random.choice(["White","Black or African American","Asian","Hispanic","Two or more races"]),"state":random.choice(["MA","CT","NH","VA","ND"]),
        "date_of_hire":f"{random.randint(1,28):02d}-{random.randint(1,12):02d}-{random.randint(8,22):02d}","date_of_termination":"","performance":random.choice(performances),
        "engagement":round(random.uniform(1.5,5.0),2),"satisfaction":random.randint(1,5),"pay_rate":round(random.uniform(15,80),2),
        "recruitment_source":random.choice(sources),"special_projects":random.randint(0,6),"days_late":random.randint(0,5)})
    save_employees(rows)
    return rows

def db_enabled(): return bool(SUPABASE_URL and SUPABASE_KEY)

def supabase_request(method,path,params=None,body=None):
    headers={"apikey":SUPABASE_KEY,"Authorization":f"Bearer {SUPABASE_KEY}","Content-Type":"application/json"}
    if method in {"POST","PATCH","PUT","DELETE"}: headers["Prefer"]="return=minimal"
    response=requests.request(method,f"{SUPABASE_URL}/rest/v1/{path}",params=params,json=body,headers=headers,timeout=15)
    response.raise_for_status()
    return response.json() if response.content else []

def load_employees():
    if db_enabled(): return supabase_request("GET","employees",{"select":"*","order":"id"})
    if not os.path.exists(DATA_FILE):
        return generate_sample_data()
    try:
        with open(DATA_FILE,encoding="utf-8") as f: return json.load(f)
    except Exception: return generate_sample_data()

def save_employees(employees):
    if db_enabled():
        supabase_request("DELETE","employees",{"id":"not.is.null"})
        if employees: supabase_request("POST","employees",body=employees)
        return
    os.makedirs(os.path.dirname(DATA_FILE),exist_ok=True)
    with open(DATA_FILE,"w",encoding="utf-8") as f: json.dump(employees,f,ensure_ascii=False,indent=2)

def normalize_row(row):
    out=dict(EMPTY_RECORD)
    for key,value in row.items():
        if key is None: continue
        mapped=FIELD_MAP.get(key.strip().lower())
        if mapped: out[mapped]=value.strip() if isinstance(value,str) else value
    try: out["engagement"]=round(float(out["engagement"]),2)
    except (ValueError,TypeError): out["engagement"]=0.0
    try: out["satisfaction"]=int(float(out["satisfaction"]))
    except (ValueError,TypeError): out["satisfaction"]=0
    try: out["pay_rate"]=round(float(out["pay_rate"]),2)
    except (ValueError,TypeError): out["pay_rate"]=0.0
    try: out["special_projects"]=int(float(out["special_projects"]))
    except (ValueError,TypeError): out["special_projects"]=0
    try: out["days_late"]=int(float(out["days_late"]))
    except (ValueError,TypeError): out["days_late"]=0
    return out

def sniff_delimiter(sample):
    first_line=sample.splitlines()[0] if sample else ""
    return "\t" if first_line.count("\t") >= first_line.count(",") else ","

@app.route("/")
def index():
    employees=load_employees()
    return render_template("index.html",
        departments=sorted({e["department"] for e in employees if e["department"]}),
        statuses=sorted({e["status"] for e in employees if e["status"]}),
        performances=sorted({e["performance"] for e in employees if e["performance"]}),
        has_data=bool(employees))

@app.route("/api/employees",methods=["POST"])
def add_employee():
    data=request.get_json(silent=True) or {}; row=normalize_row(data)
    if not row["id"]: row["id"]=str(1000000000+random.randint(10000,99999))
    if not row["name"]: return jsonify({"ok":False,"message":"กรุณากรอกชื่อพนักงาน"}),400
    employees=load_employees()
    if any(str(e.get("id"))==str(row["id"]) for e in employees): return jsonify({"ok":False,"message":"รหัสพนักงานซ้ำ"}),400
    employees.append(row); save_employees(employees)
    return jsonify({"ok":True,"employee":row})

@app.route("/api/employees/<employee_id>",methods=["PUT"])
def update_employee(employee_id):
    data=request.get_json(silent=True) or {}
    employees=load_employees()
    for i,e in enumerate(employees):
        if str(e.get("id")) == str(employee_id):
            row=normalize_row({**e,**data})
            row["id"]=e["id"]
            if not row["name"]: return jsonify({"ok":False,"message":"กรุณากรอกชื่อพนักงาน"}),400
            employees[i]=row
            save_employees(employees)
            return jsonify({"ok":True,"employee":row})
    return jsonify({"ok":False,"message":"ไม่พบพนักงาน"}),404

@app.route("/api/employees/<employee_id>",methods=["DELETE"])
def delete_employee(employee_id):
    employees=load_employees()
    new_employees=[e for e in employees if str(e.get("id")) != str(employee_id)]
    if len(new_employees)==len(employees): return jsonify({"ok":False,"message":"ไม่พบพนักงาน"}),404
    save_employees(new_employees); return jsonify({"ok":True})

@app.route("/api/employees",methods=["DELETE"])
def delete_all_employees():
    save_employees([]); return jsonify({"ok":True})

@app.route("/upload",methods=["POST"])
def upload():
    file=request.files.get("file")
    if not file or file.filename=="": return jsonify({"ok":False,"message":"ไม่พบไฟล์ที่อัปโหลด"}),400
    if not file.filename.lower().endswith((".csv",".txt",".tsv")): return jsonify({"ok":False,"message":"รองรับเฉพาะไฟล์ .csv, .tsv หรือ .txt เท่านั้น"}),400
    raw=file.stream.read().decode("utf-8-sig"); reader=csv.DictReader(io.StringIO(raw),delimiter=sniff_delimiter(raw))
    rows=[normalize_row(row) for row in reader if row]; rows=[r for r in rows if r["name"] or r["id"]]
    if not rows: return jsonify({"ok":False,"message":"อ่านไฟล์ไม่สำเร็จ หรือไม่มีข้อมูลในไฟล์"}),400
    save_employees(rows); return jsonify({"ok":True,"count":len(rows)})

@app.route("/api/employees")
def api_employees():
    employees=load_employees()
    department=request.args.get("department","").strip(); status=request.args.get("status","").strip()
    performance=request.args.get("performance","").strip(); sex=request.args.get("sex","").strip(); q=request.args.get("q","").strip().lower(); salary_min=request.args.get("salary_min","").strip(); salary_max=request.args.get("salary_max","").strip(); engagement_min=request.args.get("engagement_min","").strip(); engagement_max=request.args.get("engagement_max","").strip()
    try: salary_min=float(salary_min) if salary_min else None
    except ValueError: salary_min=None
    try: salary_max=float(salary_max) if salary_max else None
    except ValueError: salary_max=None
    try: engagement_min=float(engagement_min) if engagement_min else None
    except ValueError: engagement_min=None
    try: engagement_max=float(engagement_max) if engagement_max else None
    except ValueError: engagement_max=None
    def matches(e):
        if department and e["department"]!=department:return False
        if status and e["status"]!=status:return False
        if performance and e["performance"]!=performance:return False
        if sex and e["sex"]!=sex:return False
        if salary_min is not None and e["pay_rate"] < salary_min:return False
        if salary_max is not None and e["pay_rate"] > salary_max:return False
        if engagement_min is not None and e["engagement"] < engagement_min:return False
        if engagement_max is not None and e["engagement"] > engagement_max:return False
        if q and q not in " ".join([e["name"],e["position"],e["manager"]]).lower():return False
        return True
    filtered=[e for e in employees if matches(e)]; total=len(employees)
    active=sum(1 for e in employees if e["status"]=="Active"); terminated=sum(1 for e in employees if e["status"] in TERMINATED_STATUSES)
    avg_pay=round(sum(e["pay_rate"] for e in employees)/total,2) if total else 0
    avg_engagement=round(sum(e["engagement"] for e in employees)/total,2) if total else 0
    department_counts={}; status_counts={}; performance_counts={}
    for e in employees:
        if e["department"]: department_counts[e["department"]]=department_counts.get(e["department"],0)+1
        if e["status"]: status_counts[e["status"]]=status_counts.get(e["status"],0)+1
        if e["performance"]: performance_counts[e["performance"]]=performance_counts.get(e["performance"],0)+1
    return jsonify({"employees":filtered,"total":total,"active":active,"terminated":terminated,"avg_pay":avg_pay,"avg_engagement":avg_engagement,
    "department_counts":department_counts,"status_counts":status_counts,"performance_counts":performance_counts})

@app.route("/api/sample",methods=["POST"])
def api_sample():
    rows=generate_sample_data(); return jsonify({"ok":True,"count":len(rows)})

if __name__=="__main__":\n    port = int(os.environ.get("PORT", "5000"))\n    app.run(host="0.0.0.0", port=port, debug=True)
