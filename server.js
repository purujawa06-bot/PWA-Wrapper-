const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Endpoint khusus untuk nge-PING mengecek koneksi beneran hidup atau tidak
app.get('/ping', (req, res) => {
    res.status(200).send('pong');
});

// --- 1. HALAMAN GENERATOR (INPUT UI) ---
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>PWA Wrapper Maker</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            body { font-family: sans-serif; background: #121212; color: white; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
            .card { background: #1e1e1e; padding: 2rem; border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); width: 100%; max-width: 400px; }
            h2 { color: #007bff; margin-top: 0; text-align: center; }
            .group { margin-bottom: 15px; }
            label { display: block; font-size: 14px; margin-bottom: 5px; color: #bbb; }
            input { width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #333; background: #2a2a2a; color: white; box-sizing: border-box; }
            button { width: 100%; padding: 12px; border: none; border-radius: 8px; background: #007bff; color: white; font-weight: bold; cursor: pointer; margin-top: 10px; transition: 0.3s; }
            button:hover { background: #0056b3; }
        </style>
    </head>
    <body>
        <div class="card">
            <h2>PWA Generator</h2>
            <div class="group">
                <label>App Name</label>
                <input type="text" id="name" placeholder="Contoh: Toko Saya">
            </div>
            <div class="group">
                <label>Target URL</label>
                <input type="url" id="url" placeholder="https://website-anda.com">
            </div>
            <div class="group">
                <label>Icon URL (PNG)</label>
                <input type="url" id="icon" placeholder="https://cdn-icons-png.flaticon.com/512/888/888857.png">
            </div>
            <button onclick="build()">Generate & Buka</button>
        </div>
        <script>
            function build() {
                const n = encodeURIComponent(document.getElementById('name').value || 'MyPWA');
                const u = encodeURIComponent(document.getElementById('url').value || 'https://bing.com');
                const i = encodeURIComponent(document.getElementById('icon').value || 'https://cdn-icons-png.flaticon.com/512/888/888857.png');
                window.location.href = \`/view?name=\${n}&url=\${u}&icon=\${i}\`;
            }
        </script>
    </body>
    </html>
    `);
});

// --- 2. DYNAMIC MANIFEST ---
app.get('/manifest.json', (req, res) => {
    const { name, url, icon } = req.query;
    const startUrl = `/view?name=${encodeURIComponent(name || 'PWA')}&url=${encodeURIComponent(url || 'https://bing.com')}&icon=${encodeURIComponent(icon || '')}`;

    res.json({
        "name": name || "PWA Wrapper",
        "short_name": name || "PWA",
        "start_url": startUrl, 
        "display": "standalone",
        "background_color": "#121212",
        "theme_color": "#121212",
        "icons": [{ "src": icon, "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }]
    });
});

// --- 3. SERVICE WORKER (Diubah untuk caching HTML) ---
app.get('/sw.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.send(`
        const CACHE_NAME = 'wrapper-cache-v2';

        self.addEventListener('install', e => {
            self.skipWaiting();
        });

        self.addEventListener('activate', e => {
            e.waitUntil(clients.claim());
        });

        self.addEventListener('fetch', e => {
            // Hanya cache request navigasi (Halaman HTML Wrapper) agar bisa offline
            if (e.request.mode === 'navigate') {
                e.respondWith(
                    fetch(e.request)
                        .then(res => {
                            // Simpan halaman sukses ke cache
                            const resClone = res.clone();
                            caches.open(CACHE_NAME).then(cache => cache.put(e.request, resClone));
                            return res;
                        })
                        .catch(() => caches.match(e.request)) // Fallback ambil dari cache kalau offline
                );
            }
        });
    `);
});

// --- 4. WRAPPER PAGE (THE "APP") ---
app.get('/view', (req, res) => {
    const { name, url, icon } = req.query;
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>${name}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
        <link rel="manifest" href="/manifest.json?name=${encodeURIComponent(name)}&url=${encodeURIComponent(url)}&icon=${encodeURIComponent(icon)}">
        <meta name="theme-color" content="#121212">
        <style>
            body, html { margin: 0; padding: 0; height: 100%; width: 100%; overflow: hidden; background: #121212; font-family: sans-serif; }
            
            iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none; z-index: 1; }

            /* --- UI Install Pop-Up --- */
            #install-modal {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.9); display: none; flex-direction: column;
                align-items: center; justify-content: center; z-index: 9999; backdrop-filter: blur(5px);
            }
            .install-card {
                background: #1e1e1e; padding: 30px; border-radius: 15px; text-align: center;
                box-shadow: 0 10px 30px rgba(0,0,0,0.8); max-width: 80%;
            }
            .install-card img { width: 80px; height: 80px; border-radius: 20px; margin-bottom: 15px; }
            .install-btn {
                margin-top: 20px; padding: 15px 30px; background: #007bff; color: #fff;
                border: none; border-radius: 25px; font-weight: bold; font-size: 16px;
                cursor: pointer; width: 100%; box-shadow: 0 5px 15px rgba(0, 123, 255, 0.4);
                animation: bounce 2s infinite;
            }
            @keyframes bounce {
                0%, 20%, 50%, 80%, 100% {transform: translateY(0);}
                40% {transform: translateY(-10px);}
                60% {transform: translateY(-5px);}
            }

            /* --- UI Offline --- */
            #offline-screen { 
                position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
                background: #121212; display: none; flex-direction: column; 
                align-items: center; justify-content: center; text-align: center; z-index: 10;
            }
            .icon-box { 
                width: 80px; height: 80px; background: #222; border-radius: 50%; 
                display: flex; align-items: center; justify-content: center; margin-bottom: 20px;
                box-shadow: 0 0 20px rgba(255,0,0,0.2); animation: pulse 2s infinite;
            }
            @keyframes pulse {
                0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 68, 68, 0.4); }
                70% { transform: scale(1.05); box-shadow: 0 0 0 20px rgba(255, 68, 68, 0); }
                100% { transform: scale(1); }
            }
            .wifi-icon { width: 40px; height: 40px; fill: #ff4444; }
            h1 { font-size: 22px; color: #fff; margin: 10px 0; }
            p { color: #888; max-width: 250px; line-height: 1.5; }
            .loading-text { margin-top: 25px; color: #007bff; font-weight: bold; font-size: 14px; }
        </style>
    </head>
    <body>

        <!-- Install Pop Up -->
        <div id="install-modal">
            <div class="install-card">
                <img src="${icon}" alt="Icon" onerror="this.src='https://cdn-icons-png.flaticon.com/512/888/888857.png'">
                <h1 style="margin-top:0;">Install App</h1>
                <p>Silakan install aplikasi ini ke layar utama Anda untuk melanjutkan.</p>
                <button class="install-btn" onclick="installApp()">INSTALL SEKARANG</button>
            </div>
        </div>

        <!-- UI Offline -->
        <div id="offline-screen">
            <div class="icon-box">
                <svg class="wifi-icon" viewBox="0 0 24 24"><path d="M23.64 7c-.45-.34-4.93-4-11.64-4C5.28 3 .81 6.66.36 7l10.08 12.56c.8 1 2.32 1 3.12 0L23.64 7zm-12.89 11.23L1.92 7.11C2.92 6.36 6.55 4 12 4c5.45 0 9.08 2.36 10.08 3.11l-8.83 11.12c-.53.66-1.51.66-2.5 0z"/></svg>
            </div>
            <h1>Koneksi Terputus</h1>
            <p>Menunggu jaringan kembali...</p>
            <div class="loading-text">Mencoba menyambungkan ulang...</div>
        </div>

        <!-- App Frame -->
        <iframe id="app-frame" src="${url}"></iframe>

        <script>
            // --- 1. Service Worker Registration ---
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('/sw.js');
            }

            // --- 2. Install Pop Up Logic ---
            let deferredPrompt;
            const installModal = document.getElementById('install-modal');
            
            // Cek apakah PWA berjalan di mode standalone (sudah diinstall)
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;

            if (!isStandalone) {
                window.addEventListener('beforeinstallprompt', (e) => {
                    e.preventDefault();
                    deferredPrompt = e;
                    installModal.style.display = 'flex'; // Paksa tampilkan modal
                });
            }

            function installApp() {
                if (deferredPrompt) {
                    deferredPrompt.prompt();
                    deferredPrompt.userChoice.then((choiceResult) => {
                        if (choiceResult.outcome === 'accepted') {
                            installModal.style.display = 'none';
                        }
                        // Jika batal, modal tetap ada karena tidak ada tombol close
                    });
                }
            }

            // --- 3. Offline & Ping Auto Reload Logic ---
            const frame = document.getElementById('app-frame');
            const offline = document.getElementById('offline-screen');
            let pingInterval;

            function showOffline() {
                frame.style.display = 'none';
                offline.style.display = 'flex';
                startPinging();
            }

            // Fungsi untuk nge-ping ke server (Menghindari block CORS dari target URL)
            async function pingServer() {
                try {
                    // Tambahkan timestamp agar tidak kena cache browser
                    const res = await fetch('/ping?_t=' + new Date().getTime(), { method: 'HEAD', cache: 'no-store' });
                    if (res.ok) {
                        clearInterval(pingInterval);
                        window.location.reload(true); // Full page reload!
                    }
                } catch (error) {
                    console.log("Ping gagal, masih offline...");
                }
            }

            function startPinging() {
                if (pingInterval) clearInterval(pingInterval);
                pingInterval = setInterval(pingServer, 3000); // Ping setiap 3 detik
            }

            window.addEventListener('offline', showOffline);
            
            // Saat browser mendeteksi online, langsung coba ping 1 kali, sisanya diurus interval
            window.addEventListener('online', pingServer); 
            
            // Cek kondisi awal saat halaman baru dibuka
            if (!navigator.onLine) {
                showOffline();
            }
        </script>
    </body>
    </html>
    `);
});

app.listen(PORT, () => console.log(`Server jalan di http://localhost:${PORT}`));
