# Skill Debug API - Usage Guide

## 🔧 Debug Endpoints Created

I've created temporary debug endpoints to help you fix the worker skills issue:

### **Base URL**
```
https://backend-rp5c.onrender.com/api/v1/debug/skills
```

### **Available Endpoints**

#### **1. Get Worker Skills Debug**
```
GET /api/v1/debug/skills/worker?email=oluwasuyibabayomi@gmail.com
```

**What it does:**
- Finds the worker by email
- Shows their current skills
- Lists all available skills in the system
- Shows all worker-skill relationships (first 10)

**Response Example:**
```json
{
  "success": true,
  "data": {
    "worker": {
      "id": "worker-uuid",
      "fullName": "Oluwasuyi Babayomi",
      "email": "oluwasuyibabayomi@gmail.com",
      "workerSkillsCount": 0,
      "workerSkills": []
    },
    "allSkills": [
      { "id": "skill-1", "name": "Nursing", "category": "Healthcare" },
      { "id": "skill-2", "name": "First Aid", "category": "Healthcare" }
    ],
    "allWorkerSkills": [...],
    "totalWorkerSkills": 25
  }
}
```

#### **2. Add Skills to Worker**
```
POST /api/v1/debug/skills/add
Content-Type: application/json
Authorization: Bearer [your-auth-token]

{
  "email": "oluwasuyibabayomi@gmail.com",
  "skillIds": ["skill-1", "skill-2", "skill-3"]
}
```

#### **3. Remove Skills from Worker**
```
POST /api/v1/debug/skills/remove
Content-Type: application/json
Authorization: Bearer [your-auth-token]

{
  "email": "oluwasuyibabayomi@gmail.com",
  "skillIds": ["skill-1", "skill-2"]
}
```

## 🚀 How to Use

### **Step 1: Check Current State**
```bash
curl -X GET "https://backend-rp5c.onrender.com/api/v1/debug/skills/worker?email=oluwasuyibabayomi@gmail.com" \
  -H "Authorization: Bearer [your-token]"
```

### **Step 2: Add Skills**
```bash
curl -X POST "https://backend-rp5c.onrender.com/api/v1/debug/skills/add" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [your-token]" \
  -d '{
    "email": "oluwasuyibabayomi@gmail.com",
    "skillIds": ["skill-1", "skill-2", "skill-3"]
  }'
```

### **Step 3: Verify Skills Added**
```bash
curl -X GET "https://backend-rp5c.onrender.com/api/v1/debug/skills/worker?email=oluwasuyibabayomi@gmail.com" \
  -H "Authorization: Bearer [your-token]"
```

## 📱 Using in Browser

You can also use these endpoints directly in your browser's developer tools:

1. **Open StaffSync web app**
2. **Open Developer Tools** (F12)
3. **Go to Console tab**
4. **Get your auth token** from localStorage:
   ```javascript
   const token = localStorage.getItem('authToken');
   ```

5. **Test the endpoints:**
   ```javascript
   // Check worker skills
   fetch('https://backend-rp5c.onrender.com/api/v1/debug/skills/worker?email=oluwasuyibabayomi@gmail.com', {
     headers: { 'Authorization': `Bearer ${token}` }
   }).then(r => r.json()).then(console.log);

   // Add skills (replace with actual skill IDs from the response above)
   fetch('https://backend-rp5c.onrender.com/api/v1/debug/skills/add', {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       'Authorization': `Bearer ${token}`
     },
     body: JSON.stringify({
       email: 'oluwasuyibabayomi@gmail.com',
       skillIds: ['skill-id-1', 'skill-id-2', 'skill-id-3']
     })
   }).then(r => r.json()).then(console.log);
   ```

## 🎯 Expected Results

After adding skills, the AssignWorkerModal should show:

```
👤 Oluwasuyi Babayomi
📧 oluwasuyibabayomi@gmail.com
🏷️ Nursing  🏷️ First Aid  🏷️ CPR
```

## ⚠️ Important Notes

- **These are temporary endpoints** - remove them in production
- **You need auth token** from a logged-in admin/manager
- **Check the skill IDs** from the GET endpoint before using POST
- **Test with one worker first** before applying to multiple workers

## 🔍 Debugging Process

1. **Check if worker exists** and has no skills
2. **Get list of available skills** and their IDs
3. **Add appropriate skills** to the worker
4. **Verify skills are added** correctly
5. **Test in AssignWorkerModal** to confirm display works

This should help you identify and fix the skill relationship issue! 🚀
