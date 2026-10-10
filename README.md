# Ruang Kerja Hermes

Tab tambahan untuk dashboard web Hermes Agent, ditulis dalam bahasa Indonesia. Tujuannya membantu pemilik Hermes melihat gambaran besar aktivitas agent, menjelajahi cara pakai, dan mengaktifkan otomasi awal tanpa mengelola file konfigurasi secara manual.

## Yang tersedia

- **Ringkasan langsung:** status gateway, jumlah proses agent yang sedang berjalan, sambungan Telegram, sesi aktif belakangan ini, aktivitas terbaru, jadwal aktif, dan ringkasan biaya 7 hari.
- **Panduan memilih alat:** kapan memakai ChatGPT, Claude, Gemini, atau Hermes, dengan contoh belajar kedokteran dan proyek web.
- **Otomasi awal:** tiga template yang dapat diaktifkan untuk check-in prioritas, review mingguan, dan sesi belajar singkat. Jadwal dibuat di Cron Hermes sehingga dapat diubah atau dijeda di sana.
- **Telegram:** status sambungan, langkah setup, contoh pesan, dan pilihan pengiriman hasil otomasi ke Telegram setelah home channel siap.

Tab ini membaca data melalui API dashboard Hermes yang sudah ada. Tidak ada token, kata sandi, atau data sesi yang dikirim ke repo GitHub ini.

## Pasang di VPS Hermes

Jalankan di VPS yang memasang Hermes:

```bash
git clone https://github.com/khansazafiri-rgb/hermes.git "$HOME/hermes-ruang-kerja-repo"
sh "$HOME/hermes-ruang-kerja-repo/install.sh"
```

Buka ulang dashboard Hermes. Tab **Ruang Kerja** akan muncul di samping Sessions. Jika belum terlihat, gunakan fitur **Rescan Plugins** di dashboard atau mulai ulang proses dashboard. Pastikan Hermes yang terpasang mendukung [dashboard plugins](https://hermes-agent.nousresearch.com/docs/user-guide/features/extending-the-dashboard).

### VPS ini: Hermes berjalan di Docker

Di VPS dengan container `hermes`, jalankan langkah tambahan berikut setelah pemasangan plugin:

```bash
sh "$HOME/hermes-ruang-kerja-repo/enable-dashboard.sh"
```

Pemasang dashboard membaca pengaturan Docker Compose container `hermes`, membuat pengaturan tambahan pribadi di `~/.config/hermes-ruang-kerja/compose.dashboard.yml`, lalu memulai ulang container Hermes sebentar. Pemasang juga mengaktifkan plugin Ruang Kerja di Hermes agar tabnya tidak disembunyikan. Dashboard dibuka hanya pada alamat jaringan pribadi `100.70.251.71:9119` dan dilindungi nama pengguna serta kata sandi acak. Alamat dan sandi disimpan di `~/.config/hermes-ruang-kerja/login.txt`; baca sendiri di VPS dengan `cat ~/.config/hermes-ruang-kerja/login.txt` dan **jangan kirim isinya ke chat atau GitHub**. Dari perangkat yang tersambung ke jaringan pribadi VPS, buka alamat tersebut, masuk, lalu pilih tab **Ruang Kerja**.

Saat menyalakan ulang layanan lewat Docker Compose di kemudian hari, sertakan berkas tambahan tersebut atau jalankan `enable-dashboard.sh` lagi agar dashboard tetap aktif. [Panduan resmi Hermes Docker](https://hermes-agent.nousresearch.com/docs/user-guide/docker) menjelaskan bahwa dashboard perlu diaktifkan pada container dan akses luar container memerlukan autentikasi.

Untuk pembaruan, jalankan `git -C "$HOME/hermes-ruang-kerja-repo" pull --ff-only`, lalu `sh "$HOME/hermes-ruang-kerja-repo/install.sh"` lagi. Pemasang hanya menyalin berkas plugin dan tidak mengubah token, konfigurasi model, atau jadwal yang sudah ada.

## Menggunakan otomasi

1. Buka **Ruang Kerja → Otomasi**.
2. Pilih profil Hermes dan tujuan pengiriman. **File lokal di VPS** dapat dipakai langsung. Pilihan **Telegram** muncul setelah bot terhubung dan home channel tersedia.
3. Baca contoh dan tekan **Aktifkan otomasi**. Tidak ada jadwal yang dibuat otomatis saat plugin dipasang.
4. Periksa hasilnya di tab **Cron** dan pemakaian model di **Analytics**.

Template menggunakan interval `every 24h` atau `every 7d`, dihitung dari saat diaktifkan di VPS. Jika ingin jam tertentu, ubah jadwalnya di tab Cron dan periksa zona waktu VPS.

## Cara berpikir soal biaya

Hermes adalah agent yang memakai penyedia model yang kamu konfigurasikan, misalnya melalui Nous Portal atau API penyedia lain. Biaya dan batas pemakaian mengikuti penyedia dan paket tersebut. Tugas terjadwal yang menjalankan agent juga dapat memakai model setiap kali berjalan. Untuk mulai hemat, aktifkan satu rutinitas yang bernilai, nilai hasilnya selama seminggu, lalu pantau tab Analytics. Pertanyaan sekali pakai yang tidak perlu tool, jadwal, atau Telegram bisa tetap dikerjakan di aplikasi AI yang sudah kamu pakai.

## Telegram di VPS

Di dashboard Hermes buka **Channels → Telegram**. Setup resmi menyediakan **Create with QR** atau konfigurasi bot dari BotFather. Batasi akses ke ID Telegram milikmu, pastikan kanal menunjukkan `connected`, lalu kirim pesan uji. Untuk menerima hasil Cron dengan target `telegram`, atur home channel Telegram. Jangan menaruh token bot di repo ini.

## Batasan

- Repo ini berisi plugin, bukan salinan data Hermes. Ringkasan live baru muncul setelah plugin dipasang pada dashboard Hermes yang berjalan di VPS.
- `is_active` pada sesi berarti sesi baru aktif belakangan ini; angka `active_agents` menunjukkan proses agent yang sedang berlangsung. Tab ini sengaja tidak menyebut setiap sesi aktif sebagai pekerjaan yang pasti masih berjalan.
- Plugin tidak membaca isi pesan penuh atau membuat klaim progres proyek yang tidak tersedia. Template review mingguan secara eksplisit meminta Hermes mengakui jika data aktivitas tidak tersedia.
- Otomasi dibuat pada profil yang kamu pilih; daftar jadwal menampilkan semua profil.

## Sumber resmi

- [Hermes Web Dashboard](https://hermes-agent.nousresearch.com/docs/user-guide/features/web-dashboard)
- [Extending the Dashboard](https://hermes-agent.nousresearch.com/docs/user-guide/features/extending-the-dashboard)
- [Telegram Setup](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/telegram)
- [Scheduled Tasks](https://hermes-agent.nousresearch.com/docs/user-guide/features/cron/)
- [Nous Portal](https://hermes-agent.nousresearch.com/docs/integrations/nous-portal)
