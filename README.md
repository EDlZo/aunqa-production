Website : https://aunqa-esar.vercel.app/

# AUNQA-ESAR Assessment System

ระบบประเมินคุณภาพการศึกษา AUNQA-ESAR ที่ใช้ React + Vite และ Firebase

## 🚀 การติดตั้งและใช้งาน

### 1. ติดตั้ง Dependencies
```bash
npm install
```

### 2. ตั้งค่า Environment Variables
```bash
# Copy ไฟล์ตัวอย่าง
cp .env.example .env

# แก้ไขค่าใน .env ให้ตรงกับ Firebase project ของคุณ
```

### 3. ตั้งค่า Firebase
1. สร้าง Firebase project ที่ [Firebase Console](https://console.firebase.google.com)
2. เปิดใช้งาน Firestore Database
3. ดาวน์โหลด Service Account Key และบันทึกเป็น `firebase-service-account.json`
4. อัปเดตค่าใน `.env` ให้ตรงกับ project ของคุณ

### 4. เริ่มใช้งาน

#### เริ่ม Firebase Server (Backend)
```bash
npm run server-firebase
```
Server จะทำงานที่ port 3002

#### เริ่ม Frontend Development Server
```bash
npm run dev
```
Frontend จะทำงานที่ port 5173 หรือ 5174

### 5. เข้าใช้งานระบบ
- เปิดเบราว์เซอร์ไปที่: `http://localhost:5173`
- Login ด้วย:
  - **Username**: dev@test.com
  - **Password**: adminpass
  - **Role**: System Admin

## 📁 โครงสร้างโปรเจค

```
├── src/
│   ├── components/          # React Components
│   ├── pages/              # หน้าต่างๆ ของระบบ
│   ├── firebase/           # Firebase configuration
│   ├── config/             # API configuration
│   └── utils/              # Utility functions
├── server-firebase.cjs     # Firebase backend server
├── firebase-service-account.json  # Firebase service account key
├── .env                    # Environment variables
└── uploads/                # ไฟล์ที่อัปโหลด
```

## 🔧 Environment Variables

### Frontend (Vite)
- `VITE_API_BASE_URL`: URL ของ API server
- `VITE_FIREBASE_*`: Firebase configuration สำหรับ frontend

### Backend (Node.js)
- `PORT`: Port ของ Firebase server (default: 3002)
- `FIREBASE_PROJECT_ID`: Firebase project ID
- `FIREBASE_SERVICE_ACCOUNT_PATH`: Path ไปยัง service account key

## 📝 Scripts ที่สำคัญ

```bash
# เริ่ม Firebase server
npm run server-firebase

# เริ่ม development server
npm run dev

# Build สำหรับ production
npm run build

# Preview production build
npm run preview
```

## 🔥 Firebase Collections

ระบบใช้ Firebase Firestore กับ collections ต่อไปนี้:
- `users` - ข้อมูลผู้ใช้
- `quality_components` - องค์ประกอบคุณภาพ
- `indicators` - ตัวบ่งชี้
- `evaluations` - การประเมิน
- `assessment_sessions` - เซสชันการประเมิน
- `committee_evaluations` - การประเมินของคณะกรรมการ

## 🛠️ การพัฒนา

### การเพิ่ม API Endpoint ใหม่
1. เพิ่ม route ใน `server-firebase.cjs`
2. อัปเดต `src/config/api.js` ถ้าจำเป็น
3. ใช้งานใน React components

### การเพิ่ม Component ใหม่
1. สร้างไฟล์ใน `src/components/`
2. Import และใช้งานในหน้าที่ต้องการ

## 🔒 Security

- ไฟล์ `.env` และ `firebase-service-account.json` ถูก ignore ใน git
- ใช้ Firebase Security Rules เพื่อควบคุมการเข้าถึงข้อมูล
- CORS ถูกตั้งค่าให้รองรับเฉพาะ localhost ในโหมด development

## 📞 การแก้ไขปัญหา

### ปัญหาที่พบบ่อย
1. **Login ไม่ได้**: ตรวจสอบว่า Firebase server ทำงานอยู่
2. **ข้อมูลไม่แสดง**: ตรวจสอบ API URLs ใน browser console
3. **Firebase error**: ตรวจสอบ service account key และ project ID

### การตรวจสอบ
```bash
# ตรวจสอบ Firebase server
curl http://localhost:3002/api/ping

# ตรวจสอบ login API
curl -X POST -H "Content-Type: application/json" \
  -d '{"username": "dev@test.com", "password": "adminpass", "role": "system_admin"}' \
  http://localhost:3002/api/login
```
