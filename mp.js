// Yuki Player Logic - Performance Optimized

// State
let queue = [];
let currentIndex = -1;
let selectedListIndex = -1;
let player = null;
let isPlayerReady = false;
let isLocked = false;
let lockTimer = null;
let lockStartTime = 0;
let isLoop = false;
let isQueueLoop = false;
let isShuffle = false;
let isTouchDevice = false;
let importedFileNames = new Set();

// Vocaloid曲キャッシュ（動的取得用）
let vocaloidCache = [];
let vocaloidCacheTime = 0;
const VOCALOID_CACHE_DURATION = 30 * 60 * 1000; // 30分キャッシュ

// Vocaloardから動的に曲を取得
async function fetchVocaloidSongs() {
    const now = Date.now();
    // キャッシュが有効ならそれを使う
    if (vocaloidCache.length > 0 && (now - vocaloidCacheTime) < VOCALOID_CACHE_DURATION) {
        return vocaloidCache;
    }

    try {
        // ランダムなページを選択（1-6）
        const randomPage = Math.floor(Math.random() * 6) + 1;
        const urls = [
            `https://vocaloard.injpok.tokyo/?s=2&g=${randomPage}`,
            `https://vocaloard.injpok.tokyo/?s=1&g=${randomPage}`,
            `https://vocaloard.injpok.tokyo/?s=3&g=${randomPage}`
        ];
        const url = urls[Math.floor(Math.random() * urls.length)];

        // CORSプロキシを使用
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        const data = await response.json();
        const html = data.contents;

        // プレイリストURLからビデオIDを抽出
        const playlistMatch = html.match(/watch_videos\?video_ids=([^"&]+)/);
        if (playlistMatch) {
            const ids = playlistMatch[1].split(',').filter(id => id.length === 11);
            vocaloidCache = ids.map(id => ({ id, title: 'Loading...', author: 'Vocaloid' }));
            vocaloidCacheTime = now;
            return vocaloidCache;
        }

        // 個別リンクからも抽出を試みる
        const linkMatches = html.matchAll(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/g);
        const ids = [...new Set([...linkMatches].map(m => m[1]))];
        if (ids.length > 0) {
            vocaloidCache = ids.map(id => ({ id, title: 'Loading...', author: 'Vocaloid' }));
            vocaloidCacheTime = now;
            return vocaloidCache;
        }
    } catch (e) {
        console.warn('Vocaloard fetch failed:', e);
    }

    // フォールバック: 静的リスト
    return [
        { id: "bB7XYri8O4c", title: "千本桜", author: "黒うさP" },
        { id: "1urGM6LFpQ", title: "メルト", author: "ryo" },
        { id: "Mqps4anhz0Q", title: "ワールドイズマイン", author: "ryo" },
        { id: "HOz-9FzIDf0", title: "マトリョシカ", author: "ハチ" },
        { id: "Ej8EaLF382c", title: "砂の惑星", author: "ハチ" },
        { id: "e-U0Yb0c-50", title: "シャルル", author: "バルーン" },
        { id: "dJf4wCdLU18", title: "ロキ", author: "みきとP" },
        { id: "hxSg2Ioz3LM", title: "ダブルラリアット", author: "アゴアニキP" },
        { id: "gcS04BI2sbk", title: "ローリンガール", author: "wowaka" },
        { id: "L5guLvJhxi4", title: "アンノウン・マザーグース", author: "wowaka" },
        { id: "Ahq6qe_kBYg", title: "KING", author: "Kanaria" },
        { id: "dHXC_ahjtEE", title: "酔いどれ知らず", author: "Kanaria" },
        { id: "-wNRC69Ypco", title: "ヒバナ", author: "DECO*27" },
        { id: "HOz-9FzIDf0", title: "ゴーストルール", author: "DECO*27" },
        { id: "Njd3RTSu5jk", title: "ラビットホール", author: "DECO*27" },
        { id: "fJjD7rqcLqY", title: "ヴァンパイア", author: "DECO*27" },
        { id: "iP1EAgXd42s", title: "たびだちのうた", author: "烏屋茶房" },
        { id: "STBoCK69vVQ", title: "スポットレイト", author: "稲葉曇" },
        { id: "cF91xil98Mc", title: "CONNECT:COMMUNE", author: "FLAVOR FOLEY" },
        { id: "w44WoaDCFJQ", title: "KAWAII100%", author: "めろくる" },
        { id: "lccaBSbyAs8", title: "プシュケー", author: "wotaku" },
        { id: "FvOpPeKSf_4", title: "強風オールバック", author: "ゆこぴ" },
        { id: "r80-XbeMvC8", title: "可愛くてごめん", author: "HoneyWorks" },
        { id: "egcUvLgE1dU", title: "神っぽいな", author: "ピノキオピー" },
        { id: "xPSEPhkPRkY", title: "すろぉもぉしょん", author: "ピノキオピー" },
        { id: "OxmHkzkRV9Q", title: "ノンブレス・オブリージュ", author: "ピノキオピー" },
        { id: "7g6PN7JfpGE", title: "転生林檎", author: "ピノキオピー" },
        { id: "TBREQMI_MdU", title: "フォニイ", author: "ツミキ" },
        { id: "HXmOr3cXcqI", title: "トンデモワンダーズ", author: "sasakure.UK" },
        { id: "OvE_0Tq7Q_k", title: "ビターチョコデコレーション", author: "syudou" },
        { id: "kzOhbI1uGv8", title: "キュートなカノジョ", author: "syudou" },
        { id: "9Xzs_TG9LI8", title: "命に嫌われている", author: "カンザキイオリ" }
    ];
}

// Time tracking
let cumulativeSeconds = 0;
let lastKnownTime = 0;
let timeUpdateInterval = null;

// Audio Context & Effects
let audioCtx = null;

const MAX_QUEUE = 32767;

// Tier ranking order (higher index = better tier)
const TIER_ORDER = ['×', '△', '★', '★★', '★★★', '★★★★', '★★★★★', '★★★★★★'];

// Tier theme colors
const TIER_THEMES = {
    '★★★★★★': { primary: '#990000', light: '#cc0000', accent: '#660000' }, // 6: 濃紅
    '★★★★★': { primary: '#ff0000', light: '#ff4d4d', accent: '#cc0000' }, // 5: 赤
    '★★★★': { primary: '#ffa500', light: '#ffc04d', accent: '#cc8400' }, // 4: オレンジ
    '★★★': { primary: '#ffff00', light: '#ffff80', accent: '#cccc00' }, // 3: 黄色
    '★★': { primary: '#9ad82e', light: '#bef264', accent: '#65a30d' }, // 2: 黄緑
    '★': { primary: '#3b82f6', light: '#93c5fd', accent: '#1d4ed8' }, // 1: 青
    '△': { primary: '#8b5cf6', light: '#a78bfa', accent: '#f43f5e' }, // △: デフォルト
    '×': { primary: '#475569', light: '#94a3b8', accent: '#1e293b' }, // ×: グレー
    '': { primary: '#475569', light: '#94a3b8', accent: '#1e293b' } // Empty defaults to × color
};

function applyTierTheme(tier) {
    const theme = TIER_THEMES[tier] || TIER_THEMES[''];
    const root = document.documentElement;
    root.style.setProperty('--primary', theme.primary);
    root.style.setProperty('--primary-light', theme.light);
    root.style.setProperty('--accent', theme.accent);

    // Convert hex to rgba for active background
    const hexToRgba = (hex, alpha) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };
    root.style.setProperty('--active-bg', hexToRgba(theme.primary, 0.25));

    // Also update progress bar directly for immediate effect
    const progressBar = document.getElementById('progress-bar');
    if (progressBar) {
        progressBar.style.background = theme.primary;
        progressBar.style.boxShadow = `0 0 15px ${theme.primary}`;
    }

    console.log('Theme applied:', tier, theme);
}

function getTierRank(tier) {
    if (!tier) return -1; // No tier = lowest priority
    const idx = TIER_ORDER.indexOf(tier);
    return idx >= 0 ? idx : -1;
}

// DOM Elements
const el = {
    nowTitle: document.getElementById('now-title'),
    nowAuthor: document.getElementById('now-author'),
    queueList: document.getElementById('queue-list'),
    queueStatus: document.getElementById('queue-status'),
    addUrl: document.getElementById('add-url'),
    addTitle: document.getElementById('add-title'),
    addAuthor: document.getElementById('add-author'),
    addTier: document.getElementById('add-tier'),
    sortMode: document.getElementById('sort-mode'),
    fileInput: document.getElementById('file-input'),
    lockOverlay: document.getElementById('lock-overlay'),
    lockProgress: document.getElementById('lock-progress'),
    btnLock: document.getElementById('btn-lock'),
    btnLoop: document.getElementById('btn-loop'),
    btnQueueLoop: document.getElementById('btn-queue-loop'),
    btnShuffle: document.getElementById('btn-shuffle'),
    currentTime: document.getElementById('current-time'),
    duration: document.getElementById('duration'),
    cumulativeTime: document.getElementById('cumulative-time'),
    nowId: document.getElementById('now-id'),
    progressBar: document.getElementById('progress-bar'),
    progressContainer: document.getElementById('progress-container'),
    lockCircles: document.querySelectorAll('.lock-fg-circle'),
    volumeSlider: document.getElementById('volume-slider'),
    volumeInput: document.getElementById('volume-input'),
    helpBtn: document.getElementById('help-btn'),
    helpModal: document.getElementById('help-modal'),
    shortcutInput: document.getElementById('shortcut-input'),
    presetSelect: document.getElementById('preset-select')
};
const announcementTimes = document.querySelectorAll('.ann-time');
const announcementMsgs = document.querySelectorAll('.ann-msg');

function updateUIStates() {
    el.btnLoop.style.background = isLoop ? 'var(--primary)' : 'var(--bg-item)';
    el.btnQueueLoop.style.background = isQueueLoop ? 'var(--primary)' : 'var(--bg-item)';
    el.btnShuffle.style.background = isShuffle ? 'var(--primary)' : 'var(--bg-item)';
}

// --- YouTube API ---
function onYouTubeIframeAPIReady() {
    player = new YT.Player('youtube-player', {
        height: '100%', width: '100%', videoId: '',
        playerVars: {
            'playsinline': 1,
            'controls': 1,
            'disablekb': 1,
            'iv_load_policy': 3,
            'origin': window.location.origin,
            'autoplay': 1
        },
        events: {
            'onReady': (e) => {
                isPlayerReady = true;
                startTimeUpdates();
            },
            'onStateChange': (e) => {
                if (e.data === YT.PlayerState.ENDED) skipNext();
                if (e.data === YT.PlayerState.PLAYING) syncCurrentInfo();
            },
            'onError': (e) => {
                // エラーコード: 2=無効なパラメータ, 5=HTML5エラー, 100=動画が見つからない, 101/150=埋め込み禁止
                console.warn('YouTube Player Error:', e.data, 'for index:', currentIndex);
                if (currentIndex >= 0 && currentIndex < queue.length) {
                    const failedItem = queue[currentIndex];
                    console.log('Removing failed video:', failedItem.id, failedItem.title);
                    // 現在の曲を削除して次へ
                    queue.splice(currentIndex, 1);
                    if (queue.length > 0) {
                        // インデックスが範囲外にならないように調整
                        currentIndex = Math.min(currentIndex, queue.length - 1);
                        renderQueue();
                        playIndex(currentIndex);
                    } else {
                        currentIndex = -1;
                        renderQueue();
                        el.nowTitle.value = "";
                        el.nowAuthor.value = "";
                    }
                }
            }
        }
    });
}

function startTimeUpdates() {
    if (timeUpdateInterval) clearInterval(timeUpdateInterval);
    timeUpdateInterval = setInterval(() => {
        if (!isPlayerReady || !player || typeof player.getCurrentTime !== 'function') return;

        const cur = player.getCurrentTime();
        const dur = player.getDuration();
        const nowMs = Date.now();

        // Standard Time Update
        el.currentTime.innerText = formatTime(cur);
        el.duration.innerText = formatTime(dur);
        el.cumulativeTime.innerText = formatCumulative(cumulativeSeconds);

        // Update Progress Bar
        if (dur > 0) {
            const pct = (cur / dur) * 100;
            el.progressBar.style.width = pct + '%';

            // Update Mini Progress Bar in Queue
            const mini = document.getElementById(`mini-progress-${currentIndex}`);
            if (mini) mini.style.width = pct + '%';

            // Save state
            if (currentIndex >= 0 && queue[currentIndex]) {
                queue[currentIndex].lastTime = cur;
                queue[currentIndex].duration = dur; // 長さを保存しておく
            }
        }

        // Auto-sync Info
        if (player.getPlayerState() === YT.PlayerState.PLAYING) {
            syncCurrentInfo();
            const diff = cur - lastKnownTime;
            if (diff > 0 && diff < 2) {
                cumulativeSeconds += diff;
            }
        }
        lastKnownTime = cur;
    }, 500);
}

function syncCurrentInfo() {
    if (currentIndex >= 0 && queue[currentIndex]) {
        const item = queue[currentIndex];

        // Fallback: If title is Loading or Video(ID), try getting from player
        if (isPlayerReady && player && typeof player.getVideoData === 'function') {
            const data = player.getVideoData();
            if (data && data.title && (item.title === "Loading..." || item.title.startsWith("Video ("))) {
                item.title = data.title;
                item.author = data.author || item.author;
                renderQueue(); // Update list display
            }
        }

        // Only update if values are different to avoid flickering cursor
        if (el.nowTitle.value !== item.title && document.activeElement !== el.nowTitle) {
            el.nowTitle.value = item.title;
        }
        if (el.nowAuthor.value !== item.author && document.activeElement !== el.nowAuthor) {
            el.nowAuthor.value = item.author;
        }
        if (el.nowId.value !== shortenUrl(item.id) && document.activeElement !== el.nowId) {
            el.nowId.value = shortenUrl(item.id);
        }
    }
}

function formatTime(s) {
    if (!s || isNaN(s)) return "0:00";
    const m = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${m}:${secs.toString().padStart(2, '0')}`;
}

function formatCumulative(s) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const secs = Math.floor(s % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function parseTimeToSeconds(str) {
    const parts = str.split(':').reverse();
    let s = 0;
    if (parts[0]) s += parseInt(parts[0]) || 0;     // 秒
    if (parts[1]) s += (parseInt(parts[1]) || 0) * 60;  // 分
    if (parts[2]) s += (parseInt(parts[2]) || 0) * 3600; // 時
    return s;
}

// --- Utilities ---
function shortenUrl(u) {
    const id = extractId(u);
    return id ? `https://www.youtube.com/watch?v=${id}` : u;
}

function extractId(u) {
    if (!u) return null;
    if (u.length === 11) return u;
    if (u.includes('/shorts/')) return u.split('/shorts/')[1]?.split(/[?&]/)[0];
    const m = u.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|music\.youtube\.com\/watch\?v=)([^#&?]*).*/);
    return (m && m[2].length === 11) ? m[2] : null;
}

async function isStrictlyShort(id) {
    return new Promise((res) => {
        const i = new Image();
        i.src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
        i.onload = () => res(i.width > 0 && i.width < i.height);
        i.onerror = () => res(false);
    });
}

async function getMetaData(id) {
    if (!id) return { title: "Invalid ID", author: "YouTube Video", isShort: false };

    return new Promise((resolve) => {
        const callbackName = 'yt_meta_' + Math.floor(Math.random() * 1000000);
        const script = document.createElement('script');

        const timeout = setTimeout(() => {
            if (window[callbackName]) {
                delete window[callbackName];
                if (script.parentNode) script.parentNode.removeChild(script);
                console.warn("Metadata timeout for:", id);
                resolve({ title: `Video (${id})`, author: "YouTube Video", isShort: false });
            }
        }, 5000);

        window[callbackName] = (data) => {
            clearTimeout(timeout);
            if (script.parentNode) script.parentNode.removeChild(script);
            delete window[callbackName];

            const title = data.title || `Video (${id})`;
            const author = data.author_name || "YouTube Artist";
            resolve({ title, author, isShort: (title.toLowerCase().includes('#shorts')) });
        };

        script.src = `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${id}&callback=${callbackName}`;
        document.body.appendChild(script);
    });
}

// --- Main ---
async function addToQueue(uOrId, tIn, aIn, tierIn) {
    if (queue.length >= MAX_QUEUE) return;
    const cleanId = extractId(uOrId);
    if (!cleanId) return;

    const tempItem = {
        id: cleanId,
        title: tIn || "Loading...",
        author: aIn || "...",
        tier: tierIn || "",
        lastTime: 0
    };
    queue.push(tempItem);
    const idx = queue.length - 1;
    renderQueue();

    // UIのURLを短縮表示（貼り付け直後などに反映）
    if (el.addUrl.value.includes(cleanId)) {
        el.addUrl.value = shortenUrl(cleanId);
    }

    if (!tIn || !aIn) {
        getMetaData(cleanId).then(meta => {
            if (meta.isShort) {
                // Find and remove ALL matches if it's a short
                queue = queue.filter(it => it.id !== cleanId);
                renderQueue();
                alert("ショート動画のため除外されました");
                return;
            }
            // Update ALL matching items in the queue
            queue.forEach((it, qIdx) => {
                if (it.id === cleanId) {
                    it.title = meta.title;
                    it.author = meta.author;
                    if (currentIndex === qIdx) {
                        el.nowTitle.value = it.title;
                        el.nowAuthor.value = it.author;
                    }
                }
            });
            renderQueue();
            renderItemsActive(); // 三角マークなどの表示を確定
        });
    }
    if (currentIndex === -1) playIndex(idx);
}

function checkTouchDevice() {
    isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    if (isTouchDevice) {
        document.body.classList.add('mobile-ui');
    } else {
        document.body.classList.remove('mobile-ui');
    }
}

// 初期実行とリサイズ時に再確認
checkTouchDevice();
window.addEventListener('resize', checkTouchDevice);

function getTierBadgeHTML(tier) {
    if (!tier) return '';
    const tierClass = getTierColorClass(tier);
    return `<span class="tier-badge ${tierClass}">${tier}</span>`;
}

function getTierColorClass(tier) {
    if (!tier || tier === '×') return 'tier-x';
    if (tier === '★★★★★★') return 'tier-6';
    if (tier === '★★★★★') return 'tier-5';
    if (tier === '★★★★') return 'tier-4';
    if (tier === '★★★') return 'tier-3';
    if (tier === '★★') return 'tier-2';
    if (tier === '★') return 'tier-1';
    if (tier === '△') return 'tier-0';
    return '';
}

function getTierSelectHTML(currentTier, index) {
    const tiers = ['×', '★★★★★★', '★★★★★', '★★★★', '★★★', '★★', '★', '△'];
    let options = tiers.map(t => `<option value="${t}" ${t === currentTier ? 'selected' : ''}>${t}</option>`).join('');
    return `<select class="tier-inline-select" data-idx="${index}">${options}</select>`;
}

function renderQueue() {
    const frag = document.createDocumentFragment();
    el.queueList.innerHTML = '';
    queue.forEach((item, i) => {
        const li = document.createElement('li');
        li.className = `queue-item ${i === currentIndex ? 'active' : ''} ${i === selectedListIndex ? 'selected' : ''}`;
        li.setAttribute('data-idx', i);
        li.draggable = true;

        const isCurrent = (i === currentIndex);
        // lastTimeがあればバーの初期幅を計算（正確な時間は再生中に更新されるが、概算で出す）
        // 実際にはdurationが必要だが、ここではlastTime > 0なら少し進んでいるように見せる、または0にする
        li.innerHTML = `
            <span class="q-idx">${isCurrent ? '▶' : i + 1}</span>
            <img class="q-thumb" src="https://i.ytimg.com/vi/${item.id}/mqdefault.jpg" alt="thumb">
            <div class="q-info">
                <div class="q-title-row">
                    <span class="q-title">${safe(item.title)}</span>
                    ${getTierSelectHTML(item.tier, i)}
                </div>
                <span class="q-author">${safe(item.author)}</span>
                <div class="mini-progress-bg">
                    <div class="mini-progress-bar" id="mini-progress-${i}" style="width: 0%"></div>
                </div>
            </div>
            <div class="q-actions">
                <button class="action-btn copy-btn" title="Copy">📋</button>
                <button class="action-btn del-btn" title="Delete">🗑️</button>
            </div>
        `;

        // Tier select change handler
        const tierSelect = li.querySelector('.tier-inline-select');
        tierSelect.onclick = (e) => e.stopPropagation();
        tierSelect.onchange = (e) => {
            e.stopPropagation();
            const idx = parseInt(e.target.dataset.idx);
            queue[idx].tier = e.target.value;
            // Apply tier theme
            applyTierTheme(e.target.value);
            // If sort mode is tier, re-sort
            if (el.sortMode && el.sortMode.value === 'tier') {
                sortQueueByTier();
            }
        };

        li.onclick = (e) => {
            if (e.target.closest('.action-btn') || e.target.closest('.tier-inline-select')) return;
            selectedListIndex = i;
            // Populate edit fields
            el.nowTitle.value = item.title;
            el.nowAuthor.value = item.author;
            el.nowId.value = item.id;
            renderItemsActive();
        };
        li.ondblclick = (e) => {
            if (e.target.closest('.action-btn') || e.target.closest('.tier-inline-select')) return;
            playIndex(i);
        };

        li.querySelector('.copy-btn').onclick = () => {
            queue.splice(i + 1, 0, { ...queue[i] });
            renderQueue();
        };
        li.querySelector('.del-btn').onclick = () => {
            deleteItemByIndex(i);
        };

        li.ondragstart = (e) => {
            e.dataTransfer.setData('text/plain', i);
            e.target.classList.add('dragging');
        };
        li.ondragend = (e) => e.target.classList.remove('dragging');
        li.ondragover = (e) => e.preventDefault();
        li.ondrop = (e) => {
            e.preventDefault();
            const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
            const toIdx = i;
            if (fromIdx !== toIdx) {
                const playingId = currentIndex >= 0 ? queue[currentIndex].id : null;
                const [movedItem] = queue.splice(fromIdx, 1);
                queue.splice(toIdx, 0, movedItem);
                currentIndex = playingId ? queue.findIndex(it => it.id === playingId) : -1;
                selectedListIndex = -1;
                renderQueue();
            }
        };

        frag.appendChild(li);
    });
    el.queueList.appendChild(frag);
    el.queueStatus.innerText = `${queue.length} / ${MAX_QUEUE}`;
}

function sortQueueByTier() {
    const playingId = currentIndex >= 0 ? queue[currentIndex].id : null;
    queue.sort((a, b) => {
        const rankA = getTierRank(a.tier);
        const rankB = getTierRank(b.tier);
        return rankB - rankA; // Higher tier first
    });
    currentIndex = playingId ? queue.findIndex(it => it.id === playingId) : -1;
    selectedListIndex = -1;
    renderQueue();
}

function deleteItemByIndex(idx) {
    const isRemovingCurrent = (idx === currentIndex);
    queue.splice(idx, 1);
    if (isRemovingCurrent) {
        if (queue.length > 0) {
            currentIndex = Math.min(idx, queue.length - 1);
            playIndex(currentIndex);
        } else {
            if (isPlayerReady) player.stopVideo();
            currentIndex = -1;
            el.nowTitle.value = ""; el.nowAuthor.value = "";
        }
    } else if (currentIndex > idx) {
        currentIndex--;
    }
    selectedListIndex = -1;
    renderQueue();
}

function renderItemsActive() {
    document.querySelectorAll('.queue-item').forEach((li, idx) => {
        const isActive = (idx === currentIndex);
        li.classList.toggle('active', isActive);
        li.classList.toggle('selected', idx === selectedListIndex);

        // 再生マーク（三角）を確実に表示
        const qIdx = li.querySelector('.q-idx');
        if (qIdx) {
            qIdx.innerHTML = isActive ? '▶' : (idx + 1);
        }
    });
}

function playIndex(i) {
    if (i < 0 || i >= queue.length) return;
    currentIndex = i;
    const item = queue[i];

    // 【再生時】終了の0.3秒前から終了+10sまでの間なら、最初から再生
    let startTime = item.lastTime || 0;
    const d = item.duration || 0;
    if (d > 0 && startTime >= d - 0.3 && startTime <= d + 10) {
        startTime = 0;
    }

    if (isPlayerReady) {
        player.loadVideoById({
            videoId: item.id,
            startSeconds: startTime
        });
    }
    el.nowTitle.value = item.title;
    el.nowAuthor.value = item.author;
    el.nowId.value = shortenUrl(item.id);

    // Apply tier theme for current song
    applyTierTheme(item.tier || '');

    renderItemsActive();
}

function safe(s) { return s ? s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : ""; }

function skipNext() {
    // 現在の曲の再生位置をリセット（もう一度再生できるように）
    if (currentIndex >= 0 && queue[currentIndex]) {
        queue[currentIndex].lastTime = 0;
    }

    if (isLoop) return playIndex(currentIndex);
    if (isShuffle && queue.length > 1) {
        let n = currentIndex; while (n === currentIndex) n = Math.floor(Math.random() * queue.length);
        return playIndex(n);
    }
    if (currentIndex < queue.length - 1) {
        playIndex(currentIndex + 1);
    } else {
        if (isQueueLoop && queue.length > 0) {
            playIndex(0);
        } else if (isPlayerReady) {
            player.stopVideo();
        }
    }
}
function skipPrev() { if (currentIndex > 0) playIndex(currentIndex - 1); else if (isPlayerReady) player.seekTo(0); }

// Event Handlers
document.getElementById('btn-add').onclick = () => {
    addToQueue(el.addUrl.value, el.addTitle.value, el.addAuthor.value, el.addTier ? el.addTier.value : '');
    // el.addUrl.value = ''; // addToQueue内で短縮表示させるため、ここではクリアしないか、完全に消すかはお好み
    el.addUrl.value = el.addTitle.value = el.addAuthor.value = '';
    if (el.addTier) el.addTier.value = '';
};

// Sort mode change handler
if (el.sortMode) {
    el.sortMode.onchange = () => {
        if (el.sortMode.value === 'tier') {
            sortQueueByTier();
        }
        // 'manual' doesn't need action - user can drag to reorder
    };
}

// Add tier dropdown theme change
if (el.addTier) {
    el.addTier.onchange = () => {
        applyTierTheme(el.addTier.value);
    };
}

document.getElementById('btn-recommend-vocaloid').onclick = async () => {
    const btn = document.getElementById('btn-recommend-vocaloid');
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ Loading...';
    btn.disabled = true;

    try {
        const songs = await fetchVocaloidSongs();
        // 30曲をランダムに追加（重複を避けてシャッフル）
        const shuffled = [...songs].sort(() => Math.random() - 0.5);
        const toAdd = shuffled.slice(0, Math.min(30, shuffled.length));
        for (const item of toAdd) {
            addToQueue(item.id, item.title, item.author);
        }
    } catch (e) {
        console.error('Vocaloid fetch error:', e);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
};
el.addUrl.oninput = () => {
    const id = extractId(el.addUrl.value);
    if (id && el.addUrl.value.length > 30) {
        el.addUrl.value = shortenUrl(id);
    }
};
document.getElementById('btn-copy-sel')?.addEventListener('click', () => {
    const idx = selectedListIndex >= 0 ? selectedListIndex : currentIndex;
    if (idx >= 0) {
        queue.splice(idx + 1, 0, { ...queue[idx] });
        renderQueue();
    }
});
document.getElementById('btn-delete').onclick = () => {
    const idx = selectedListIndex >= 0 ? selectedListIndex : currentIndex;
    if (idx >= 0) deleteItemByIndex(idx);
};
document.getElementById('btn-clear').onclick = () => {
    if (confirm("情報をすべて初期化（消去）しますか？")) {
        queue = []; currentIndex = selectedListIndex = -1;
        if (isPlayerReady) player.stopVideo();
        renderQueue();
    }
};
document.getElementById('btn-dedupe').onclick = () => {
    const s = new Set(); const old = queue.length; const id = currentIndex >= 0 ? queue[currentIndex].id : null;
    queue = queue.filter(x => !s.has(x.id) && s.add(x.id));
    currentIndex = id ? queue.findIndex(x => x.id === id) : -1;
    renderQueue(); alert(`重複 ${old - queue.length} 件を削除しました`);
};

// Lock Timer Logic
function updateLockProgress(p) {
    if (el.lockCircles) {
        el.lockCircles.forEach(circle => {
            const circumference = circle.getTotalLength();
            const offset = circumference - (p / 100) * circumference;
            circle.style.strokeDasharray = circumference;
            circle.style.strokeDashoffset = offset;
        });
    }
}

el.btnLock.onmousedown = el.lockOverlay.onmousedown = (e) => {
    // タッチデバイスでの重複動作防止
    if (e.type === 'touchstart') e.preventDefault();

    lockStartTime = Date.now();
    updateLockProgress(0);

    lockTimer = setInterval(() => {
        const p = Math.min(((Date.now() - lockStartTime) / 4000) * 100, 100);
        updateLockProgress(p);

        if (p >= 100) {
            clearInterval(lockTimer);
            isLocked = !isLocked;
            el.lockOverlay.classList.toggle('active', isLocked);
            updateLockProgress(0);
        }
    }, 50);
};

// Touch events for mobile
el.btnLock.ontouchstart = el.lockOverlay.ontouchstart = el.btnLock.onmousedown;

window.onmouseup = window.ontouchend = () => {
    if (lockTimer) {
        clearInterval(lockTimer);
        lockTimer = null;
    }
    updateLockProgress(0);
};

// Controls
document.getElementById('btn-prev').onclick = () => !isLocked && skipPrev();
document.getElementById('btn-next').onclick = () => !isLocked && skipNext();
document.getElementById('btn-pause').onclick = () => {
    if (!isLocked && isPlayerReady) {
        const s = player.getPlayerState();
        if (s === 1) player.pauseVideo(); else player.playVideo();
    }
};
document.getElementById('btn-stop').onclick = () => !isLocked && isPlayerReady && player.stopVideo();
document.getElementById('btn-seek-back').onclick = () => !isLocked && isPlayerReady && player.seekTo(player.getCurrentTime() - 2);
document.getElementById('btn-seek-fwd').onclick = () => !isLocked && isPlayerReady && player.seekTo(player.getCurrentTime() + 2);

// New 10s Seeks
if (document.getElementById('btn-seek-back10')) {
    document.getElementById('btn-seek-back10').onclick = () => !isLocked && isPlayerReady && player.seekTo(player.getCurrentTime() - 10);
}
if (document.getElementById('btn-seek-fwd10')) {
    document.getElementById('btn-seek-fwd10').onclick = () => !isLocked && isPlayerReady && player.seekTo(player.getCurrentTime() + 10);
}

document.getElementById('btn-first').onclick = () => !isLocked && playIndex(0);
document.getElementById('btn-last').onclick = () => !isLocked && playIndex(queue.length - 1);
el.btnLoop.onclick = () => { isLoop = !isLoop; if (isLoop) isQueueLoop = false; updateUIStates(); };
el.btnQueueLoop.onclick = () => { isQueueLoop = !isQueueLoop; if (isQueueLoop) isLoop = false; updateUIStates(); };
el.btnShuffle.onclick = () => { isShuffle = !isShuffle; updateUIStates(); };

el.nowTitle.oninput = () => {
    const idx = selectedListIndex >= 0 ? selectedListIndex : currentIndex;
    if (idx >= 0) {
        queue[idx].title = el.nowTitle.value;
        const target = document.querySelector(`.queue-item[data-idx="${idx}"] .q-title`);
        if (target) target.innerText = el.nowTitle.value;
    }
};
el.nowAuthor.oninput = () => {
    const idx = selectedListIndex >= 0 ? selectedListIndex : currentIndex;
    if (idx >= 0) {
        queue[idx].author = el.nowAuthor.value;
        const target = document.querySelector(`.queue-item[data-idx="${idx}"] .q-author`);
        if (target) target.innerText = el.nowAuthor.value;
    }
};
el.nowId.oninput = () => {
    const idx = selectedListIndex >= 0 ? selectedListIndex : currentIndex;
    if (idx >= 0) {
        const inputVal = el.nowId.value;
        const newId = extractId(inputVal);
        if (newId) {
            queue[idx].id = newId;
            // 短縮して表示
            const clean = shortenUrl(inputVal);
            if (el.nowId.value !== clean && !clean.includes('undefined')) {
                // 自動短縮（ユーザーが入力中なので、フォーカス位置に注意が必要だが、基本は貼り付け時に効く）
            }
            if (idx === currentIndex && isPlayerReady) {
                player.cueVideoById(newId);
            }
        }
    }
};
el.nowId.onchange = () => {
    const idx = selectedListIndex >= 0 ? selectedListIndex : currentIndex;
    if (idx >= 0) {
        const clean = shortenUrl(el.nowId.value);
        el.nowId.value = clean;
        const newId = extractId(clean);
        if (newId) {
            queue[idx].id = newId;
            // 情報を再取得
            getMetaData(newId).then(meta => {
                queue[idx].title = meta.title;
                queue[idx].author = meta.author;
                renderQueue();
                if ((selectedListIndex >= 0 ? selectedListIndex : currentIndex) === idx) {
                    el.nowTitle.value = meta.title;
                    el.nowAuthor.value = meta.author;
                }
            });
            if (idx === currentIndex && isPlayerReady) {
                player.loadVideoById(newId);
            }
        }
    }
};

// Progress Bar Click to Seek
el.progressContainer.onclick = (e) => {
    if (!isPlayerReady || !player) return;
    const rect = el.progressContainer.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const dur = player.getDuration();
    if (dur > 0) player.seekTo(dur * pos);
};

// IO
// Tier形式変換関数
function convertOldTierToNew(tier) {
    if (!tier || tier === '×') return '×';
    // 既に新形式の場合はそのまま返す
    if (tier.includes('★') || tier === '△') return tier;
    // 旧形式から新形式への変換
    const tierMap = {
        'SSSSS': '★★★★★',
        'SSSS': '★★★★',
        'SSS': '★★★',
        'SS': '★★',
        'S+': '★',
        'S': '★',
        'S-': '★',
        'A+': '△',
        'A': '△',
        'A-': '△',
        'B+': '△',
        'B': '△',
        'B-': '△',
        'C+': '×',
        'C': '×',
        'C-': '×',
        'D+': '×',
        'D': '×',
        'D-': '×',
        'F': '×',
        'F-': '×',
        'F--': '★★★★★★'
    };
    return tierMap[tier] !== undefined ? tierMap[tier] : '×';
}

function processImportFile(f) {
    if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => {
        try {
            const d = JSON.parse(ev.target.result);
            let importedQueue = [];
            if (Array.isArray(d)) {
                // 旧形式 (配列のみ) - 既存のキューに追加
                importedQueue = d;
            } else if (d && d.queue) {
                // 新形式
                importedQueue = d.queue;
                // 初めて読み込むファイル名の場合のみ、再生時間を合算
                if (!importedFileNames.has(f.name)) {
                    cumulativeSeconds += (d.cumulativeSeconds || 0);
                    importedFileNames.add(f.name);
                    el.cumulativeTime.innerText = formatCumulative(cumulativeSeconds);
                }
            }
            // Tier形式を変換
            importedQueue = importedQueue.map(item => ({
                ...item,
                tier: convertOldTierToNew(item.tier)
            }));
            queue = [...queue, ...importedQueue].slice(0, MAX_QUEUE);
            // インポート後はリストを再描画
            renderQueue();
        } catch (e) {
            console.error("Import failed:", e);
        }
    };
    r.readAsText(f);
}

document.getElementById('btn-export').onclick = () => {
    // 日付名を作成 (YYYYMMDD_HHMMSS.txt)
    const now = new Date();
    const y = now.getFullYear();
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    const d = now.getDate().toString().padStart(2, '0');
    const h = now.getHours().toString().padStart(2, '0');
    const min = now.getMinutes().toString().padStart(2, '0');
    const sec = now.getSeconds().toString().padStart(2, '0');
    const filename = `${y}${m}${d}_${h}${min}${sec}.txt`;

    // プレイリストと累計時間を一緒に保存
    const exportData = {
        queue: queue,
        cumulativeSeconds: cumulativeSeconds
    };
    const b = new Blob([JSON.stringify(exportData, null, 2)], { type: 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = filename; a.click();
};
document.getElementById('btn-import').onclick = () => el.fileInput.click();
el.fileInput.onchange = (e) => processImportFile(e.target.files[0]);

// Drag & Drop Import
const dropOverlay = document.createElement('div');
dropOverlay.className = 'drop-overlay';
dropOverlay.innerHTML = '<div class="drop-msg">ファイルをここにドロップしてインポート</div>';
document.body.appendChild(dropOverlay);

let dragCounter = 0;
document.addEventListener('dragenter', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter++;
    dropOverlay.classList.add('active');
});

document.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter--;
    if (dragCounter === 0) {
        dropOverlay.classList.remove('active');
    }
});

document.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
});

document.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter = 0;
    dropOverlay.classList.remove('active');
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
        const f = files[0];
        if (f.name.endsWith('.json') || f.name.endsWith('.txt')) {
            processImportFile(f);
        }
    }
});

// Volume Control Implementation
function updateVolume(val) {
    val = Math.max(0, Math.min(100, val));
    if (isPlayerReady) player.setVolume(val);
    el.volumeSlider.value = val;
    el.volumeInput.value = val;
}

el.volumeSlider.oninput = (e) => updateVolume(parseInt(e.target.value));
el.volumeInput.onchange = (e) => updateVolume(parseInt(e.target.value));
el.volumeInput.oninput = (e) => {
    const val = parseInt(e.target.value);
    if (!isNaN(val)) updateVolume(val);
};

// Shortcuts Help
el.helpBtn.onclick = () => el.helpModal.classList.toggle('active');

function handleShortcutKey(k, e = null) {
    if (isLocked) return;

    // Updated Shortcuts
    if (k === 'd') isPlayerReady && player.seekTo(player.getCurrentTime() - 10);
    else if (k === 'j') isPlayerReady && player.seekTo(player.getCurrentTime() + 10);
    else if (k === 'a') playIndex(0);
    else if (k === 'l') playIndex(queue.length - 1);

    // Existing others
    else if (k === 's') skipPrev();
    else if (k === 'k') skipNext();
    else if (k === 'f') isPlayerReady && player.seekTo(player.getCurrentTime() - 2);
    else if (k === 'h') isPlayerReady && player.seekTo(player.getCurrentTime() + 2);
    else if (k === 'g') { if (e) e.preventDefault(); document.getElementById('btn-pause').click(); }
    else if (k === 'o') document.getElementById('btn-stop').click();
    else if (k === 'q') el.btnLoop.click();
    else if (k === 'e') el.btnQueueLoop.click();
    else if (k === 'w') el.btnShuffle.click();
    else if (k === '[') {
        const idx = selectedListIndex >= 0 ? selectedListIndex : (currentIndex >= 0 ? currentIndex : -1);
        if (idx >= 0) {
            queue.splice(idx + 1, 0, { ...queue[idx] });
            renderQueue();
        } else el.addUrl.focus();
    }
    else if (k === ']') document.getElementById('btn-delete').click();
    else if (k === 'v') document.getElementById('btn-recommend-vocaloid').click();

    const n = parseInt(k);
    if (!isNaN(n)) {
        if (n >= 1 && n <= 5) { const t = currentIndex + (n - 6); if (t >= 0) playIndex(t); }
        else { const v = n === 0 ? 10 : n; const t = currentIndex + (v - 5); if (t < queue.length) playIndex(t); }
    }
}

// Global Keys
document.addEventListener('keydown', (e) => {
    // Esc is allowed even if an input is focused, depending on preference.
    // However, usually Esc is used to blur or close.
    // Let's make it toggle the modal even if an input is focused if we want it to be a global shortcut.
    // But common practice is to let inputs handle Esc if they need to.

    if (e.key === 'Escape') {
        el.helpModal.classList.toggle('active');
        return;
    }

    if (isLocked || e.target.tagName === 'INPUT') return;
    handleShortcutKey(e.key.toLowerCase(), e);
});

// Shortcut Input Listener
el.shortcutInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const val = el.shortcutInput.value.toLowerCase();
        if (val) {
            handleShortcutKey(val);
            el.shortcutInput.value = ''; // 入力後にクリア
        }
    }
});
// Preset Selection Logic
async function loadPresetFile(filename) {
    if (!filename) return;
    try {
        const response = await fetch(filename);
        if (!response.ok) throw new Error('File not found');
        const d = await response.json();

        if (d && d.queue) {
            if (confirm('現在のキューをクリアしてプリセットを読み込みますか？')) {
                queue = d.queue.map(item => ({
                    ...item,
                    tier: convertOldTierToNew(item.tier)
                }));
                cumulativeSeconds = d.cumulativeSeconds || 0;
                if (el.cumulativeTime) el.cumulativeTime.innerText = formatCumulative(cumulativeSeconds);
                renderQueue();

                if (queue.length > 0) {
                    playIndex(0);
                }
            }
        }
    } catch (e) {
        console.warn('Preset load failed:', e);
        alert('プリセットの読み込みに失敗しました');
    }
}

if (el.presetSelect) {
    el.presetSelect.onchange = (e) => {
        loadPresetFile(e.target.value);
        e.target.value = ''; // 選択後に表示をPresetsに戻す
    };
}
