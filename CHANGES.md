# Gradelytics v2.0 — Change Log

## What's New

### Authentication & Role System
- **Role-selector on Login page** — users choose Student / Teacher / Admin before signing in; mismatched roles produce a clear error message
- **Multi-step Registration** — Step 1: role choice, Step 2: account details, Step 3 (students only): full academic profile with subjects & tests
- **Role validation on login** — server rejects login if the chosen role doesn't match the account's actual role
- **Unique User IDs** — every user gets a prefixed ID on creation (STU-XXXXXXXX, TCH-XXXXXXXX, ADM-XXXXXXXX); shown on dashboard

### Student Features
- **MyProfilePage (`/my-profile`)** — students can view, edit, and manage their own academic profile
  - Edit core details (level, degree type, year, course, attendance, study hours, CGPA)
  - Add unlimited semesters, each with multiple subjects and multiple tests/assignments per subject
  - CGPA/TGPA field (scale 0–10)
  - Degree type selection: Graduation, PG, PhD, Diploma, Certificate, Other
  - Education level: School, University, Vocational, Other
- **Student Dashboard** — shows their own Unique ID, KPIs (attendance, study hours, CGPA, prediction), and latest semester subjects
- **Self-registration of academic data** — on signup (step 3), students can immediately enter their subjects and test scores

### Teacher Features
- **Students search by Unique ID** — teachers can paste a student's STU-ID to locate and open their profile
- **Filtered student list** — teachers only see students they've added (not all students)
- **Add Student page** has two modes: "Add New" and "Search by Student ID"

### Admin Panel (`/admin`)
- View all users (students + teachers + admins) in a searchable, filterable table
- Filter by role (all / student / teacher / admin)
- Search by name, email, or Unique ID
- System-wide stats: total users, students, teachers, student docs, predictions run
- Recent registrations widget
- Delete user action

### Authorization Rules (enforced on both client and server)
- Students: access only their own data
- Teachers: see only students they created; can search any student by Unique ID
- Admins: full access

### UI/UX
- **Light / Dark mode toggle** in sidebar — persisted to localStorage
- CSS variables updated with full light-theme palette
- Role-specific accent colors throughout (Student = blue, Teacher = green, Admin = purple)
- Sidebar navigation is role-aware (students see My Profile instead of Students list)

## File Inventory (new / changed)

### Backend (server/)
| File | Status |
|------|--------|
| `models/User.js` | Updated — added `uniqueId`, `managedStudents` fields |
| `models/Student.js` | Updated — added `semesters`, `degreeType`, `cgpa`, richer schema |
| `routes/auth.js` | Updated — role validation on login, student record auto-creation on register |
| `routes/students.js` | Updated — full RBAC, student self-service, teacher ID search endpoint |
| `routes/admin.js` | New — admin user management & stats |
| `routes/analytics.js` | Updated — removed blanket teacher/admin lock |
| `index.js` | Updated — registers `/api/admin` |
| `package.json` | Updated — added `uuid` dependency |

### Frontend (client/src/)
| File | Status |
|------|--------|
| `context/AuthContext.js` | Updated — dark mode state + `toggleDarkMode` |
| `services/api.js` | Updated — added `adminAPI`, `studentsAPI.search`, `authAPI.myStudentRecord` |
| `index.css` | Updated — light-theme CSS variables, `[data-theme]` selectors |
| `App.js` | Updated — role-based routing, new pages registered |
| `pages/LoginPage.js` | Rewritten — role selector tabs |
| `pages/RegisterPage.js` | Rewritten — 3-step flow with academic data |
| `pages/Dashboard.js` | Rewritten — student vs teacher/admin views |
| `pages/MyProfilePage.js` | New — student self-service profile management |
| `pages/AdminPage.js` | New — admin user management UI |
| `pages/AddStudentPage.js` | Updated — search-by-ID mode added |
| `components/layout/Layout.js` | Updated — dark mode toggle, role-based nav, uniqueId display |
