(function () {
  "use strict";

  const SDK = window.__HERMES_PLUGIN_SDK__;
  if (!SDK || !window.__HERMES_PLUGINS__) return;

  const React = SDK.React;
  const h = React.createElement;
  const { useState, useEffect, useCallback } = SDK.hooks;
  const API = SDK.api;
  const PREFIX = "hrk";

  const TEMPLATES = [
    {
      id: "checkin",
      name: "Check-in prioritas",
      interval: "every 24h",
      description: "Pengingat singkat untuk memilih pekerjaan utama dan hambatan hari ini.",
      prompt: "Kirim check-in singkat dalam bahasa Indonesia. Tanyakan: (1) satu prioritas terpenting hari ini, (2) langkah konkret berikutnya, dan (3) hambatan yang perlu dibantu. Jangan mengarang status proyek atau menganggap tugas sudah selesai. Jawab maksimal 90 kata.",
      note: "Cocok bila kamu ingin Hermes hadir rutin tanpa banyak panggilan model."
    },
    {
      id: "review",
      name: "Review mingguan",
      interval: "every 7d",
      description: "Membantu menutup minggu dengan daftar selesai, berjalan, dan tertunda.",
      prompt: "Bantu saya melakukan review mingguan dalam bahasa Indonesia. Jika kamu dapat membaca aktivitas atau catatan minggu ini, rangkum pekerjaan yang selesai, yang masih berjalan, dan yang terhambat, sertakan dasar yang tersedia. Jika data tidak tersedia, katakan dengan jelas lalu minta saya memberi tiga kategori tersebut. Akhiri dengan paling banyak tiga langkah minggu depan. Jangan mengarang progres.",
      note: "Review mengandalkan data yang benar-benar tersedia bagi Hermes."
    },
    {
      id: "belajar",
      name: "Sesi belajar singkat",
      interval: "every 24h",
      description: "Undangan belajar aktif; soal hanya dibuat jika kamu meminta topiknya.",
      prompt: "Ajak saya belajar 10 menit dalam bahasa Indonesia. Tanyakan dulu topik kedokteran atau materi yang ingin saya ulang dan format yang saya inginkan: ringkasan, tanya jawab, atau soal. Jangan langsung membuat soal tanpa topik dan jangan mengklaim telah membaca materi yang belum saya kirim. Jawab maksimal 80 kata.",
      note: "Pilihan format tetap di tanganmu, tidak selalu soal."
    }
  ];

  const TOOLS = [
    {
      name: "ChatGPT",
      label: "Belajar & berpikir bersama",
      body: "Pakai untuk memahami konsep, membahas materi, menyusun ide, atau meninjau jawaban saat kamu sedang aktif di chat.",
      example: "“Jelaskan mekanisme ini dengan analogi, lalu uji pemahamanku.”"
    },
    {
      name: "Claude",
      label: "Naskah & telaah panjang",
      body: "Cocok untuk membaca bahan panjang, menyunting tulisan, atau menelaah struktur argumen. Pilih bila alur kerja dan paket yang kamu punya mendukungnya.",
      example: "“Tinjau draf ini dan beri revisi yang paling berdampak.”"
    },
    {
      name: "Gemini",
      label: "Alur Google & materi besar",
      body: "Pertimbangkan saat pekerjaan berpusat di Google Drive, Docs, atau materi panjang dalam ekosistem Google.",
      example: "“Bandingkan catatan dari beberapa dokumen kuliah ini.”"
    },
    {
      name: "Hermes",
      label: "Tugas berulang & selalu siap",
      body: "Pakai saat pekerjaan perlu berjalan di VPS, terhubung ke Telegram, memakai tool atau skill, atau mengirim hasil terjadwal.",
      example: "“Setiap minggu ingatkan aku meninjau pekerjaan yang masih terbuka.”"
    }
  ];

  const TELEGRAM_STEPS = [
    ["1", "Sambungkan bot", "Buka Channels → Telegram di dashboard Hermes. Gunakan Create with QR atau siapkan bot melalui BotFather."],
    ["2", "Batasi akses", "Pastikan akun Telegram milikmu ada di daftar pengguna yang diizinkan dan status kanal Connected."],
    ["3", "Coba tugas kecil", "Kirim satu permintaan jelas, misalnya: “Bantu pilih tiga prioritas hari ini.”"],
    ["4", "Atur pengiriman otomatis", "Set home channel Telegram bila kamu ingin hasil jadwal dikirim ke chat; lalu pilih Telegram saat mengaktifkan otomasi di sini."]
  ];

  function text(value, fallback) {
    if (value === null || value === undefined || value === "") return fallback || "—";
    return String(value);
  }

  function compact(value, max) {
    const plain = text(value, "").replace(/\s+/g, " ").trim();
    return plain.length > max ? plain.slice(0, max - 1) + "…" : plain;
  }

  function when(value) {
    if (!value) return "Belum ada";
    const date = new Date(typeof value === "number" && value < 1e12 ? value * 1000 : value);
    if (Number.isNaN(date.getTime())) return "Belum ada";
    return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(date);
  }

  function platformLabel(source) {
    const value = text(source, "Lainnya").toLowerCase();
    if (value.includes("telegram")) return "Telegram";
    if (value.includes("cron")) return "Otomasi";
    if (value.includes("cli")) return "Terminal";
    if (value.includes("api")) return "API";
    return text(source, "Lainnya");
  }

  function link(href, label, className, extra) {
    return h("a", Object.assign({ href, className: className || "hrk-link" }, extra || {}), label);
  }

  function badge(label, tone) {
    return h("span", { className: "hrk-badge hrk-badge-" + (tone || "neutral") }, label);
  }

  function sectionTitle(kicker, title, subtitle, action) {
    return h("div", { className: "hrk-section-title" },
      h("div", null,
        h("span", { className: "hrk-kicker" }, kicker),
        h("h2", null, title),
        subtitle ? h("p", null, subtitle) : null
      ),
      action || null
    );
  }

  function stat(label, value, note, tone) {
    return h("div", { className: "hrk-stat" },
      h("span", { className: "hrk-stat-label" }, label),
      h("strong", { className: "hrk-stat-value " + (tone || "") }, value),
      h("span", { className: "hrk-stat-note" }, note)
    );
  }

  function formatMoney(amount) {
    const number = Number(amount);
    if (!Number.isFinite(number)) return "Belum tersedia";
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "USD", maximumFractionDigits: number < 1 ? 3 : 2 }).format(number);
  }

  function jobProfile(job) {
    return job.profile || job.profile_name || "default";
  }

  function Workspace() {
    const [tab, setTab] = useState("ringkasan");
    const [data, setData] = useState({ status: null, sessions: [], jobs: [], platforms: [], targets: [], analytics: null });
    const [loadedAt, setLoadedAt] = useState(null);
    const [errors, setErrors] = useState([]);
    const [profile, setProfile] = useState("default");
    const [delivery, setDelivery] = useState("local");
    const [busy, setBusy] = useState("");
    const [notice, setNotice] = useState("");

    const refresh = useCallback(async function () {
      const calls = [
        API.getStatus(),
        API.getSessions(20, 0, { order: "recent" }),
        API.getCronJobs(),
        API.getMessagingPlatforms(),
        API.getCronDeliveryTargets(profile),
        API.getAnalytics(7, profile)
      ];
      const result = await Promise.allSettled(calls);
      const names = ["status", "sessions", "jobs", "platforms", "targets", "analytics"];
      const nextErrors = result.map(function (item, index) { return item.status === "rejected" ? names[index] : null; }).filter(Boolean);
      setData(function (previous) {
        const next = Object.assign({}, previous);
        result.forEach(function (item, index) {
          if (item.status !== "fulfilled") return;
          const value = item.value;
          if (index === 1) next.sessions = Array.isArray(value) ? value : (value.sessions || []);
          else if (index === 2) next.jobs = Array.isArray(value) ? value : (value.jobs || []);
          else if (index === 3) next.platforms = Array.isArray(value) ? value : (value.platforms || []);
          else if (index === 4) next.targets = Array.isArray(value) ? value : (value.targets || []);
          else next[names[index]] = value;
        });
        return next;
      });
      setErrors(nextErrors);
      setLoadedAt(new Date());
    }, [profile]);

    useEffect(function () {
      refresh();
      const timer = window.setInterval(refresh, 15000);
      return function () { window.clearInterval(timer); };
    }, [refresh]);

    const status = data.status || {};
    const sessions = data.sessions;
    const liveSessions = sessions.filter(function (session) { return session.is_active; });
    const recentSessions = sessions.filter(function (session) { return !session.is_active; }).slice(0, 5);
    const activeAgents = Number(status.active_agents || 0);
    const gatewayOn = status.gateway_running === true || status.gateway_state === "running";
    const gatewayLabel = data.status ? (gatewayOn ? "Terhubung" : "Tidak berjalan") : (loadedAt ? "Tidak tersedia" : "Memuat…");
    const telegram = data.platforms.find(function (item) { return item.id === "telegram"; });
    const telegramState = telegram ? telegram.state : (status.gateway_platforms && status.gateway_platforms.telegram && status.gateway_platforms.telegram.state) || "not_configured";
    const telegramReady = telegramState === "connected";
    const telegramLabel = !loadedAt ? "Memuat…" : (telegramReady ? "Terhubung" : "Belum aktif");
    const telegramTarget = data.targets.find(function (item) { return item.id === "telegram"; });
    const telegramDeliverReady = telegramReady && Boolean(telegramTarget && telegramTarget.home_target_set);
    const scheduled = data.jobs.filter(function (job) { return job.enabled && job.state !== "completed"; });
    const nextJob = scheduled.filter(function (job) { return job.next_run_at; }).sort(function (a, b) { return new Date(a.next_run_at) - new Date(b.next_run_at); })[0];
    const usage = data.analytics && data.analytics.totals;
    const totalCost = usage ? (Number(usage.total_actual_cost) || Number(usage.total_estimated_cost) || 0) : null;

    async function activate(template) {
      if (busy) return;
      if (delivery === "telegram" && !telegramDeliverReady) {
        setNotice("Telegram perlu tersambung dan memiliki home channel sebelum menerima hasil otomatis.");
        return;
      }
      if (data.jobs.some(function (job) { return job.name === "Ruang Kerja · " + template.name && jobProfile(job) === profile; })) {
        setNotice("Otomasi ini sudah ada pada profil " + profile + ".");
        return;
      }
      setBusy(template.id);
      setNotice("");
      try {
        await API.createCronJob({
          name: "Ruang Kerja · " + template.name,
          prompt: template.prompt,
          schedule: template.interval,
          deliver: delivery
        }, profile);
        setNotice("Otomasi “" + template.name + "” berhasil dibuat. Lihat jadwalnya di tab Cron.");
        await refresh();
      } catch (error) {
        setNotice("Gagal membuat otomasi: " + text(error && error.message, "periksa konfigurasi Hermes."));
      } finally {
        setBusy("");
      }
    }

    function sessionCard(session, index) {
      return h("div", { className: "hrk-activity", key: session.id || index },
        h("div", { className: "hrk-activity-rail" }, h("span", { className: "hrk-activity-dot" })),
        h("div", { className: "hrk-activity-main" },
          h("div", { className: "hrk-activity-top" },
            h("strong", null, compact(session.title || session.preview || "Percakapan tanpa judul", 74)),
            session.is_active ? badge("Aktif belakangan ini", "green") : badge(platformLabel(session.source), "neutral")
          ),
          h("p", null, compact(session.preview || "Tidak ada cuplikan yang tersedia.", 170)),
          h("span", { className: "hrk-meta" }, platformLabel(session.source) + " · " + when(session.last_active) + (session.model ? " · " + session.model : ""))
        )
      );
    }

    function overview() {
      return h(React.Fragment, null,
        h("div", { className: "hrk-stats" },
          stat("GATEWAY", gatewayLabel, data.status ? (gatewayOn ? "Hermes siap menerima tugas" : "Periksa layanan di VPS") : "Menunggu data dari Hermes", gatewayOn ? "hrk-good" : "hrk-warn"),
          stat("SEDANG BERPROSES", String(activeAgents), activeAgents ? "giliran agent saat ini" : "Hermes sedang menunggu tugas", activeAgents ? "hrk-good" : ""),
          stat("TELEGRAM", telegramLabel, !loadedAt ? "Menunggu status kanal" : (telegramReady ? "Bot siap menerima pesan" : "Lihat panduan sambungan"), telegramReady ? "hrk-good" : "hrk-warn"),
          stat("OTOMASI AKTIF", String(scheduled.length), nextJob ? "Berikutnya " + when(nextJob.next_run_at) : "Belum ada jadwal berikutnya", "")
        ),
        h("div", { className: "hrk-two-col" },
          h("section", { className: "hrk-panel" },
            sectionTitle("01 / LIVE", "Apa yang sedang terjadi", "Pekerjaan lintas sesi dan kanal, bukan progres satu jenis tugas.", link("/sessions", "Lihat semua sesi ↗", "hrk-small-link")),
            activeAgents > 0 ? h("div", { className: "hrk-live-callout" }, h("span", { className: "hrk-pulse" }), "Hermes sedang menangani " + activeAgents + " proses.") : h("div", { className: "hrk-idle" }, "Saat ini tidak ada proses agent yang berjalan."),
            liveSessions.length ? h("div", { className: "hrk-activity-list" }, liveSessions.slice(0, 3).map(sessionCard)) : h("p", { className: "hrk-helper" }, "Sesi yang aktif belakangan ini akan muncul di sini. Status ‘aktif’ menunjukkan sesi baru digunakan; proses yang benar-benar sedang berjalan ditunjukkan oleh angka di atas."),
            h("h3", { className: "hrk-subheading" }, "Aktivitas terakhir"),
            recentSessions.length ? h("div", { className: "hrk-activity-list" }, recentSessions.map(sessionCard)) : h("p", { className: "hrk-empty" }, "Belum ada sesi yang bisa ditampilkan.")
          ),
          h("section", { className: "hrk-panel" },
            sectionTitle("02 / ROUTINE", "Otomasi yang berjalan", "Jadwal dari semua profil Hermes.", link("/cron", "Kelola di Cron ↗", "hrk-small-link")),
            scheduled.length ? h("div", { className: "hrk-job-list" }, scheduled.slice(0, 6).map(function (job) {
              const bad = job.last_status === "delivery_failed" || job.last_status === "error" || job.last_status === "failed";
              return h("div", { className: "hrk-job", key: jobProfile(job) + ":" + job.id },
                h("div", { className: "hrk-job-head" }, h("strong", null, compact(job.name || job.prompt || "Otomasi", 58)), badge(bad ? "Perlu dicek" : "Terjadwal", bad ? "amber" : "green")),
                h("p", null, compact(job.prompt || "", 125)),
                h("div", { className: "hrk-job-foot" }, h("span", null, "Berikutnya: " + when(job.next_run_at)), h("span", null, text(job.deliver, "lokal")))
              );
            })) : h("div", { className: "hrk-empty-state" }, h("strong", null, "Belum ada otomasi aktif"), h("p", null, "Mulai dari satu pengingat yang benar-benar berguna, lalu lihat hasil dan biayanya."), h("button", { className: "hrk-button hrk-button-primary", onClick: function () { setTab("otomasi"); } }, "Jelajahi contoh →")),
            h("div", { className: "hrk-cost" },
              h("div", null, h("span", { className: "hrk-kicker" }, "PENGGUNAAN 7 HARI"), h("strong", null, totalCost === null ? "Belum tersedia" : formatMoney(totalCost))),
              link("/analytics", "Detail biaya ↗", "hrk-small-link")
            )
          )
        )
      );
    }

    function guide() {
      return h(React.Fragment, null,
        sectionTitle("PETA KEPUTUSAN", "Pakai AI yang mana?", "Mulai dari kebutuhanmu. Hermes paling terasa manfaatnya saat ada pekerjaan berulang, akses ke VPS, atau pengiriman lewat Telegram."),
        h("div", { className: "hrk-tool-grid" }, TOOLS.map(function (tool) {
          return h("article", { className: "hrk-tool " + (tool.name === "Hermes" ? "hrk-tool-featured" : ""), key: tool.name },
            h("span", { className: "hrk-tool-number" }, tool.name === "Hermes" ? "04" : "0" + (TOOLS.indexOf(tool) + 1)),
            h("h3", null, tool.name),
            h("strong", null, tool.label),
            h("p", null, tool.body),
            h("blockquote", null, tool.example)
          );
        })),
        h("div", { className: "hrk-advice" },
          h("div", null, h("span", { className: "hrk-kicker" }, "ATURAN PRAKTIS"), h("h3", null, "Pakai Hermes kalau tugasnya perlu hidup di luar chat.")),
          h("p", null, "Untuk pertanyaan sekali pakai, mulai dari AI yang sudah kamu langgani. Tambahkan Hermes ketika kamu membutuhkan jadwal, Telegram, file atau tool di VPS, serta alur yang dipakai berulang. Setiap jadwal yang menjalankan model dapat menambah penggunaan; periksa Analytics setelah mencobanya.")
        ),
        h("div", { className: "hrk-use-cases" },
          h("article", null, h("span", { className: "hrk-kicker" }, "BELAJAR KEDOKTERAN"), h("h3", null, "Belajar aktif tanpa harus selalu membuat soal"), h("p", null, "Minta penjelasan, tabel banding, latihan lisan, atau soal saat memang perlu. Sertakan materi sumber untuk topik yang menuntut ketepatan.")),
          h("article", null, h("span", { className: "hrk-kicker" }, "PROYEK WEB"), h("h3", null, "Pantau pekerjaan yang sedang dibuat"), h("p", null, "Gunakan sesi untuk melihat apa yang Hermes kerjakan dan Cron untuk pengingat atau pemeriksaan rutin pada proyekmu.")),
          h("article", null, h("span", { className: "hrk-kicker" }, "PENGGUNAAN HEMAT"), h("h3", null, "Mulai dari satu otomasi"), h("p", null, "Aktifkan satu jadwal, lihat apakah hasilnya benar-benar membantu, lalu pantau biaya dan frekuensi selama seminggu."))
        )
      );
    }

    function automation() {
      return h(React.Fragment, null,
        sectionTitle("MULAI OTOMATIS", "Pilih satu rutinitas", "Contoh ini tidak aktif sampai kamu menekan tombol. Jadwal interval dihitung dari waktu aktivasi di VPS."),
        h("div", { className: "hrk-config-row" },
          h("label", null, "Profil Hermes", h("input", { className: "hrk-input", value: profile, onChange: function (event) { setProfile(event.target.value.trim() || "default"); }, placeholder: "default" })),
          h("label", null, "Kirim hasil ke", h("select", { className: "hrk-input", value: delivery, onChange: function (event) { setDelivery(event.target.value); } }, h("option", { value: "local" }, "File lokal di VPS"), h("option", { value: "telegram", disabled: !telegramDeliverReady }, telegramDeliverReady ? "Telegram home channel" : "Telegram · perlu disiapkan")))
        ),
        h("div", { className: "hrk-template-grid" }, TEMPLATES.map(function (template) {
          const exists = data.jobs.some(function (job) { return job.name === "Ruang Kerja · " + template.name && jobProfile(job) === profile; });
          return h("article", { className: "hrk-template", key: template.id },
            h("div", { className: "hrk-template-top" }, badge(template.interval === "every 7d" ? "SETIAP 7 HARI" : "SETIAP 24 JAM", "blue"), h("span", null, "0" + (TEMPLATES.indexOf(template) + 1))),
            h("h3", null, template.name),
            h("p", null, template.description),
            h("div", { className: "hrk-template-note" }, template.note),
            h("button", { className: "hrk-button hrk-button-primary", disabled: Boolean(busy) || exists, onClick: function () { activate(template); } }, exists ? "Sudah dibuat" : busy === template.id ? "Membuat…" : "Aktifkan otomasi →")
          );
        })),
        h("p", { className: "hrk-helper" }, "Sesudah diaktifkan, kamu bisa mengubah, menjeda, atau menghapus jadwal di tab Cron. Setiap eksekusi dengan agent dapat memakai kuota model."),
        sectionTitle("YANG SUDAH ADA", "Jadwal di Hermes", "Periksa hasil terakhir dan waktu berikutnya di tab Cron."),
        data.jobs.length ? h("div", { className: "hrk-mini-jobs" }, data.jobs.slice(0, 8).map(function (job) {
          return h("div", { key: jobProfile(job) + ":" + job.id }, h("strong", null, compact(job.name || job.prompt || "Otomasi", 65)), badge(job.enabled ? "Aktif" : "Jeda", job.enabled ? "green" : "neutral"), h("span", null, "Berikutnya: " + when(job.next_run_at) + " · Hasil terakhir: " + text(job.last_status, "belum berjalan")));
        })) : h("p", { className: "hrk-empty" }, "Belum ada jadwal."),
        link("/cron", "Buka pengaturan Cron ↗", "hrk-button hrk-button-outline")
      );
    }

    function telegramGuide() {
      return h(React.Fragment, null,
        sectionTitle("PANDUAN TELEGRAM", "Hermes dari ponselmu", "Telegram adalah pintu masuk percakapan dan tempat menerima hasil tugas terjadwal."),
        h("div", { className: "hrk-telegram-banner" },
          h("div", null, h("span", { className: "hrk-kicker" }, "STATUS KANAL"), h("h3", null, telegramReady ? "Telegram sudah terhubung" : "Telegram belum terhubung"), h("p", null, telegramReady ? "Coba kirim tugas kecil, lalu aktifkan pengiriman otomatis bila home channel sudah diatur." : "Ikuti empat langkah di bawah. Token bot tetap disimpan di Hermes, jangan dimasukkan ke repo GitHub.")),
          badge(telegramReady ? "CONNECTED" : text(telegramState).toUpperCase(), telegramReady ? "green" : "amber")
        ),
        h("div", { className: "hrk-steps" }, TELEGRAM_STEPS.map(function (step) {
          return h("article", { key: step[0] }, h("span", null, step[0]), h("div", null, h("h3", null, step[1]), h("p", null, step[2])));
        })),
        h("div", { className: "hrk-try-box" },
          h("div", null, h("span", { className: "hrk-kicker" }, "COBA KIRIM DI TELEGRAM"), h("p", null, "Bantu aku memilih prioritas hari ini. Tanyakan dulu tiga hal yang perlu kamu tahu, lalu usulkan langkah pertama yang paling kecil.")),
          h("button", { className: "hrk-button hrk-button-outline", onClick: function () { window.navigator.clipboard.writeText("Bantu aku memilih prioritas hari ini. Tanyakan dulu tiga hal yang perlu kamu tahu, lalu usulkan langkah pertama yang paling kecil.").then(function () { setNotice("Contoh pesan disalin."); }).catch(function () { setNotice("Salin teks contoh secara manual."); }); } }, "Salin pesan")
        ),
        h("div", { className: "hrk-links" }, link("/channels", "Buka Channels ↗", "hrk-button hrk-button-primary"), link("https://hermes-agent.nousresearch.com/docs/user-guide/messaging/telegram", "Panduan resmi Telegram ↗", "hrk-button hrk-button-outline", { target: "_blank", rel: "noopener noreferrer" }))
      );
    }

    return h("div", { className: PREFIX },
      h("header", { className: "hrk-hero" },
        h("div", { className: "hrk-hero-main" },
          h("div", { className: "hrk-eyebrow" }, h("span", { className: "hrk-pulse" }), "HERMES · RUANG KERJA PRIBADI"),
          h("h1", null, "Lihat gambaran besar.", h("br"), h("em", null, "Lalu pilih langkah berikutnya.")),
          h("p", null, "Satu tempat untuk melihat aktivitas Hermes, memahami kapan memakainya, dan mencoba otomasi yang benar-benar berguna."),
          h("div", { className: "hrk-hero-actions" }, h("button", { className: "hrk-button hrk-button-light", onClick: function () { setTab("ringkasan"); } }, "Lihat aktivitas →"), h("button", { className: "hrk-button hrk-button-ghost", onClick: function () { setTab("panduan"); } }, "Jelajahi panduan"))
        ),
        h("div", { className: "hrk-hero-side" }, h("span", null, "STATUS SAAT INI"), h("strong", null, data.status ? (gatewayOn ? (activeAgents ? "Hermes sedang bekerja" : "Hermes siap dipakai") : "Gateway belum berjalan") : "Memuat status Hermes"), h("small", null, loadedAt ? "Diperbarui " + when(loadedAt) : "Mengambil data…"))
      ),
      h("nav", { className: "hrk-nav", "aria-label": "Navigasi Ruang Kerja" }, [
        ["ringkasan", "Ringkasan"], ["panduan", "Kapan pakai AI?"], ["otomasi", "Otomasi"], ["telegram", "Telegram"]
      ].map(function (item) { return h("button", { key: item[0], className: tab === item[0] ? "active" : "", onClick: function () { setTab(item[0]); } }, item[1]); }), h("button", { className: "hrk-refresh", onClick: refresh, title: "Muat ulang data" }, "↻ Perbarui")),
      notice ? h("div", { className: "hrk-notice", role: "status" }, notice, h("button", { onClick: function () { setNotice(""); }, "aria-label": "Tutup pesan" }, "×")) : null,
      errors.length ? h("div", { className: "hrk-error", role: "status" }, "Sebagian data belum bisa dimuat (" + errors.join(", ") + "). Coba perbarui atau periksa versi Hermes di VPS.") : null,
      h("main", { className: "hrk-content" }, tab === "ringkasan" ? overview() : tab === "panduan" ? guide() : tab === "otomasi" ? automation() : telegramGuide()),
      h("footer", { className: "hrk-footer" }, h("span", null, "Ruang Kerja untuk Hermes · Data dibaca dari dashboard yang sedang kamu buka."), h("span", null, "Rujukan: ", link("https://hermes-agent.nousresearch.com/docs/user-guide/features/web-dashboard", "Dashboard Hermes ↗", "", { target: "_blank", rel: "noopener noreferrer" })))
    );
  }

  window.__HERMES_PLUGINS__.register("hermes-ruang-kerja", Workspace);
})();
