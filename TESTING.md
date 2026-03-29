# วิธีทดสอบระบบ AUNQA-ESAR

## 1. ทดสอบ Server Health

```bash
# Start server
node server-mongo.cjs

# Health check
curl http://localhost:5000/api/ping
# Expected: { "ok": true, "db": true, "storage": "minio" }
```

---

## 2. ทดสอบ Authentication

```bash
# Login (แทนที่ email/password ด้วยข้อมูลจริง)
curl -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"dev@test.com","password":"devpass","role":"system_admin"}'
# Expected: { "success": true, "token": "...", "user": {...} }
```

---

## 3. ทดสอบ CRUD หลัก

### Programs
```bash
TOKEN="your_jwt_token_here"

# GET
curl http://localhost:5000/api/programs -H "Authorization: Bearer $TOKEN"

# POST
curl -X POST http://localhost:5000/api/programs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"majorName":"วิศวกรรมคอมพิวเตอร์","facultyName":"วิศวกรรมศาสตร์"}'

# PATCH
curl -X PATCH http://localhost:5000/api/programs/PROGRAM_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"majorName":"วิศวกรรมคอมพิวเตอร์ (แก้ไข)"}'

# DELETE
curl -X DELETE http://localhost:5000/api/programs/PROGRAM_ID \
  -H "Authorization: Bearer $TOKEN"
```

### Quality Components
```bash
# GET (filter by major_name and year)
curl "http://localhost:5000/api/quality-components?major_name=วิศวกรรมคอมพิวเตอร์&year=2569" \
  -H "Authorization: Bearer $TOKEN"
```

### Bulk Session Summary
```bash
curl "http://localhost:5000/api/bulk/session-summary?major_name=วิศวกรรมคอมพิวเตอร์&year=2569" \
  -H "Authorization: Bearer $TOKEN"
# Expected: { components: [...], indicators: [...], evaluations: [...], ... }
```

---

## 4. ทดสอบ File Upload (MinIO)

```bash
# Upload evidence file
curl -X POST http://localhost:5000/api/evaluations-actual \
  -H "Authorization: Bearer $TOKEN" \
  -F "session_id=SESSION_ID" \
  -F "indicator_id=INDICATOR_ID" \
  -F "major_name=วิศวกรรมคอมพิวเตอร์" \
  -F "operation_result=<p>ผลการดำเนินงาน</p>" \
  -F "evidence_files=@/path/to/file.pdf"
# Expected: { "success": true, "evidence_files": ["filename.pdf"] }

# View file
curl "http://localhost:5000/api/view/FILENAME" -H "Authorization: Bearer $TOKEN"
# Expected: redirect to MinIO presigned URL
```

---

## 5. ทดสอบ PDF Generation

```bash
curl -X POST http://localhost:5000/api/generate-pdf \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"program_name":"วิศวกรรมคอมพิวเตอร์","year":"2569","components":[]}' \
  --output test-report.pdf
# Expected: PDF file downloaded
```

---

## 6. ทดสอบผ่าน UI (Manual)

| Feature | Steps | Expected |
|---------|-------|----------|
| Login | เข้า http://localhost:5173 → กรอก email/password/role | เข้าสู่ระบบสำเร็จ |
| เลือกหลักสูตร | คลิก "เริ่มประเมิน" → เลือก level/faculty/major | แสดงหน้า assessment |
| กรอกผลดำเนินงาน | คลิก indicator → กรอกข้อมูล → บันทึก | บันทึกสำเร็จ ไม่มี error |
| อัพโหลดไฟล์ | กรอกผลดำเนินงาน → แนบไฟล์ PDF → บันทึก | ไฟล์ปรากฏในรายการ |
| ดูไฟล์ | คลิกลิงก์ไฟล์ | เปิด PDF ใน browser |
| สร้างรายงาน | ไปหน้า "รายงาน" → เลือกหลักสูตร → "สร้าง PDF" | ดาวน์โหลด PDF |
| กรรมการประเมิน | Login role=external_evaluator → ให้คะแนน | บันทึกคะแนนสำเร็จ |

---

## 7. ตรวจสอบ Security

```bash
# ทดสอบว่า endpoint ที่ต้องการ auth ถูก block โดยไม่มี token
curl http://localhost:5000/api/users
# Expected: 401 Unauthorized (ถ้า authMiddleware ถูก apply)

# ทดสอบ token หมดอายุ
curl http://localhost:5000/api/programs \
  -H "Authorization: Bearer invalid_token_here"
# Expected: 401 Invalid token
```

---

## 8. ตรวจสอบ MinIO

เปิด MinIO Console: http://localhost:9001
- Login: ใช้ MINIO_ACCESS_KEY / MINIO_SECRET_KEY จาก .env
- ตรวจสอบ bucket `aunqa-files` มีไฟล์ที่อัพโหลด
- ตรวจสอบ folder structure: `evidence_actual/{session_id}/{indicator_id}/`
