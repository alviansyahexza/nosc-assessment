# Technical Debt & Unresolved Issues
*(As of current session)*

### ✅ 1. Pelanggaran Zona Waktu di Frontend (SELESAI)
* **Kondisi Saat Ini:** Frontend masih menggunakan fungsi bawaan `toISOString()` saat melakukan pencarian jadwal (*Availability*).
* **Dampaknya:** Frontend akan selalu mengirimkan format waktu dengan akhiran `Z` (murni UTC tanpa informasi *offset* lokal). Jika ini dibiarkan, saat kita menerapkan *Timezone-Blinded Backend*, semua pesanan akan ditolak karena sistem akan keliru membaca jam UTC sebagai jam lokal.
* **Solusi Menunggu:** Mengganti semua pemanggilan `toISOString()` di `App.tsx` dan `BookingFlow.tsx` menggunakan fungsi `formatISO()` dari `date-fns`.

### ✅ 2. Validasi Jam Kerja & Istirahat di Backend (SELESAI)
* **Kondisi Saat Ini:** *Implementation Plan* sudah disetujui, tapi kode belum dieksekusi. API `POST /appointments` masih mengizinkan pembuatan jadwal di jam 3 pagi (selama tidak bertabrakan dengan jadwal pasien lain).
* **Solusi Menunggu:** Memasukkan logika validasi *Drizzle Query Builder* ke dalam fungsi `createBooking` di `DrizzleAppointmentRepository.ts` untuk memblokir jadwal yang berada di luar tabel `working_hours` atau yang menabrak `breaks`.

### 📦 3. Ketidakpatuhan Format Kembalian (*Response*) API Booking
* **Kondisi Saat Ini:** Saat ini `POST /appointments` hanya mengembalikan `{ success: true, appointmentId: 123 }`.
* **Dampaknya:** Melanggar kontrak API `README.md` yang mewajibkan API mengembalikan data lengkap: `id, starts_at, ends_at, buffer_before_min, buffer_after_min`.
* **Solusi Menunggu:** Memodifikasi `bookingService` dan `appointmentsController` agar merakit dan mengembalikan objek utuh tersebut setelah jadwal berhasil dibuat.

### 🔗 4. Relasi "Doctor Services" (Belum Disentuh)
* **Kondisi Saat Ini:** Keterampilan spesialisasi Dokter belum terikat dengan Layanan (*Services*). 
* **Dampaknya:** Fitur filter tidak bisa diimplementasikan secara sempurna.
* **Solusi Menunggu:** Membuat tabel relasi *Many-to-Many* (`doctor_services`) untuk mendukung pencarian ketersediaan jadwal yang lebih akurat.
