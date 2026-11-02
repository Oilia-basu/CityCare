# Hospital Appointment Booking System (MERN)

Patients, doctors, receptionists and administrators on one platform: real booking with double-booking protection,
Razorpay payments (server-verified), notifications, email, analytics and audit logs.

```
backend/   Express + Mongoose API   (controllers → services → models, JWT in HTTP-only cookies)
frontend/  React (Vite) + Bootstrap 5, Axios, Context API, Recharts, React Toastify
```

## Run locally

1. **Backend**
   ```bash
   cd backend
   cp .env.example .env        # fill MONGO_URI and JWT_SECRET at minimum
   npm install
   npm run seed                # creates admin + settings + departments (use `npm run seed:demo` for demo staff/patient)
   npm run dev                 # http://localhost:5000
   ```
2. **Frontend**
   ```bash
   cd frontend
   cp .env.example .env
   npm install
   npm run dev                 # http://localhost:5173
   ```
3. Log in at `/admin/login` with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from your `.env` (default `admin@hospital.com` / `Admin@12345` — change it).
   With `seed:demo` (password `Demo@12345`): `reception@hospital.com`, `doctor1@hospital.com`, `doctor2@hospital.com`, `patient@hospital.com`.

Only `MONGO_URI` and `JWT_SECRET` are required to boot. Without optional keys:
- **Email** → messages are printed to the server console (password-reset links too, in development).
- **Cloudinary** → image uploads return a clear "not configured" error; everything else works.
- **Razorpay** → "Pay online" returns a clear error; "Pay at hospital" works.

## How the important parts work

| Concern | Implementation |
|---|---|
| **No double booking** | `Appointment.slotKey` (`doctor_date_time`) has a *partial unique index*; it is set while a slot is held and `$unset` when cancelled/rejected. Two simultaneous requests → one gets a 409. Works on Atlas without transactions. |
| **Reschedule** | One atomic `findOneAndUpdate` swaps `slotKey` – new slot reserved and old released together. |
| **Slot generation** | `services/availabilityService.js` – weekly schedule, breaks, blocked dates, leave, per-day capacity, lead time, max advance days. |
| **Fees & identity** | Fee, doctor, department and patient are always read from the database; payment status is never taken from the client. |
| **Payments** | `create-order` (fee from DB) → Razorpay Checkout → `verify` (HMAC signature, idempotent) + `/api/payments/webhook` safety net. Late payments for expired slots are auto-refunded. |
| **Unpaid holds** | Online bookings hold the slot for `reservationMinutes`; a job releases expired holds every minute. |
| **Status rules** | Transition table + per-role permissions in `appointmentService.js` (Pending → Confirmed → Checked-In → In-Progress → Completed, etc.). |
| **Time** | Stored as UTC (`startAt`) plus hospital-local `YYYY-MM-DD` / `HH:mm`; set `HOSPITAL_UTC_OFFSET_MINUTES` (IST = 330). |
| **Security** | bcrypt(12), JWT cookie (`httpOnly`, `secure` + `SameSite=None` in production), Helmet, CORS allow-list, rate limits, NoSQL-operator stripping, express-validator, upload type/size limits, no stack traces in production, audit log. |

## Roles & areas

- **Public**: home, doctors, doctor details, departments, about, contact, register, login (patient / `/doctor/login` / `/receptionist/login` / `/admin/login`), forgot/reset password.
- **Patient** `/patient`: dashboard, booking wizard, appointments (pay, reschedule, cancel, review, receipt), payments, notifications, profile, change password.
- **Doctor** `/doctor`: dashboard, requests (accept/reject), appointments (start/complete with notes, patient info), weekly schedule, blocked dates, leave, profile.
- **Receptionist** `/receptionist`: daily overview, walk-in registration, patient search, book on behalf, reschedule/cancel, check-in with queue numbers, queue board, mark cash paid, receipts.
- **Admin** `/admin`: dashboard + charts, doctors (create/verify/schedule/deactivate), patients, receptionists, departments, appointments, payments & refunds, analytics, CSV export, announcements, settings (booking rules, payment options), activity log.

## API summary

Auth `/api/auth/{register,login,logout,me,forgot-password,reset-password,change-password,profile}` ·
Patients `/api/patients/{profile,appointments,dashboard}` · Doctors `/api/doctors[/:id[/availability]]`, `/profile`, `/dashboard`, `/appointments`, `/availability` ·
Appointments `/api/appointments[/:id][/cancel|reschedule|status|receipt]`, `/available-slots` ·
Receptionist `/api/receptionist/{dashboard,patients,appointments,queue}` · Admin `/api/admin/*` ·
Payments `/api/payments/{create-order,verify,history,refund,webhook,:appointmentId/mark-paid}` ·
Notifications `/api/notifications[/:id/read|read-all]` · Reviews `/api/reviews`, `/api/reviews/doctor/:id` · Public `/api/public/{hospital,contact}`.
List endpoints support `page`, `limit`, `search`, `sort` and filters.

## Deploy

- **Database**: MongoDB Atlas (allow Render's IPs). **Images**: Cloudinary.
- **Backend (Render)**: use `render.yaml` or create a Node web service with root `backend`; set env vars from `.env.example`
  (`NODE_ENV=production`, `CLIENT_URL=https://<your-vercel-domain>`). Run `npm run seed` once from the Render shell.
- **Frontend (Vercel)**: root `frontend`, framework Vite, env `VITE_API_URL=https://<render-app>.onrender.com/api`, `VITE_RAZORPAY_KEY_ID`. `vercel.json` handles SPA routing.
- **Razorpay webhook**: URL `https://<render-app>.onrender.com/api/payments/webhook`, events `payment.captured`, `payment.failed`, secret = `RAZORPAY_WEBHOOK_SECRET`.
- Cookies across domains need HTTPS on both sides (production sets `Secure; SameSite=None`). If a browser blocks third-party cookies, put both under one parent domain (e.g. `app.example.com` / `api.example.com`).

## Testing checklist (Postman / browser)

1. Register, log in/out, wrong password, duplicate email, wrong-portal login, role-protected routes (expect 401/403).
2. Doctor with Mon–Fri 10:00–14:00, 30-min slots, break 12:00–12:30 → 7 slots; weekend/blocked/leave/past dates → none.
3. Book the same slot from two browsers at once → one 409. Cancel → slot reopens. Reschedule → old slot reopens.
4. Pay online with Razorpay test keys; tamper with the signature → 400; replay verify → idempotent; abandon payment → slot released after the hold.
5. Cancel a paid appointment → refund; completed appointments cannot be cancelled; review only after completion.
6. Receptionist check-in on the appointment day → queue number; dashboards update after each action.

## Payments are currently OFF (cash only)
Online payment is disabled by default. Patients and reception book with **Pay at hospital**; reception/admin record the cash with **Mark paid**.
The Razorpay code is kept: to enable it later, add `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` (and `RAZORPAY_WEBHOOK_SECRET`) to the backend `.env`,
`VITE_RAZORPAY_KEY_ID` to the frontend `.env`, then switch on "Allow online payment" in Admin → Hospital settings.
