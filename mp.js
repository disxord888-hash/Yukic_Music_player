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
let isShuffle = false;

// Time tracking
let cumulativeSeconds = 0;
let lastKnownTime = 0;
let timeUpdateInterval = null;

// Audio Context & Effects
let audioCtx = null;

const MAX_QUEUE = 32767;

// DOM Elements
const el = {
    nowTitle: document.getElementById('now-title'),
    nowAuthor: document.getElementById('now-author'),
    queueList: document.getElementById('queue-list'),
    queueStatus: document.getElementById('queue-status'),
    addUrl: document.getElementById('add-url'),
    addTitle: document.getElementById('add-title'),
    addAuthor: document.getElementById('add-author'),
    fileInput: document.getElementById('file-input'),
    lockOverlay: document.getElementById('lock-overlay'),
    lockProgress: document.getElementById('lock-progress'),
    btnLock: document.getElementById('btn-lock'),
    btnLoop: document.getElementById('btn-loop'),
    btnShuffle: document.getElementById('btn-shuffle'),
    currentTime: document.getElementById('current-time'),
    duration: document.getElementById('duration'),
    cumulativeTime: document.getElementById('cumulative-time'),
    nowId: document.getElementById('now-id'),
    progressBar: document.getElementById('progress-bar'),
    progressContainer: document.getElementById('progress-container')
};

function updateUIStates() {
    el.btnLoop.style.background = isLoop ? 'var(--primary)' : 'var(--bg-item)';
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

        // Update current playback time display
        el.currentTime.innerText = formatTime(cur);
        el.duration.innerText = formatTime(dur);

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
            }
        }

        // Auto-sync Info (ensure title doesn't get stuck)
        if (player.getPlayerState() === YT.PlayerState.PLAYING) {
            syncCurrentInfo();

            // Cumulative Time Logic
            const diff = cur - lastKnownTime;
            if (diff > 0 && diff < 2) {
                cumulativeSeconds += diff;
                el.cumulativeTime.innerText = formatCumulative(cumulativeSeconds);
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
async function addToQueue(uOrId, tIn, aIn) {
    if (queue.length >= MAX_QUEUE) return;
    const cleanId = extractId(uOrId);
    if (!cleanId) return;

    const tempItem = {
        id: cleanId,
        title: tIn || "Loading...",
        author: aIn || "...",
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
            <div class="q-info">
                <span class="q-title">${safe(item.title)}</span>
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

        li.onclick = (e) => {
            if (e.target.closest('.action-btn')) return;
            selectedListIndex = i;
            // Populate edit fields
            el.nowTitle.value = item.title;
            el.nowAuthor.value = item.author;
            el.nowId.value = item.id;
            renderItemsActive();
        };
        li.ondblclick = (e) => {
            if (e.target.closest('.action-btn')) return;
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
    if (isPlayerReady) {
        player.loadVideoById({
            videoId: item.id,
            startSeconds: item.lastTime || 0
        });
    }
    el.nowTitle.value = item.title;
    el.nowAuthor.value = item.author;
    el.nowId.value = shortenUrl(item.id);
    renderItemsActive();
    setTimeout(() => {
        const a = document.querySelector('.queue-item.active');
        if (a) a.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
}

function safe(s) { return s ? s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : ""; }

function skipNext() {
    if (isLoop) return playIndex(currentIndex);
    if (isShuffle && queue.length > 1) {
        let n = currentIndex; while (n === currentIndex) n = Math.floor(Math.random() * queue.length);
        return playIndex(n);
    }
    if (currentIndex < queue.length - 1) playIndex(currentIndex + 1);
    else if (isPlayerReady) player.stopVideo();
}
function skipPrev() { if (currentIndex > 0) playIndex(currentIndex - 1); else if (isPlayerReady) player.seekTo(0); }

// Event Handlers
document.getElementById('btn-add').onclick = () => {
    addToQueue(el.addUrl.value, el.addTitle.value, el.addAuthor.value);
    // el.addUrl.value = ''; // addToQueue内で短縮表示させるため、ここではクリアしないか、完全に消すかはお好み
    el.addUrl.value = el.addTitle.value = el.addAuthor.value = '';
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
el.btnLock.onmousedown = el.lockOverlay.onmousedown = () => {
    lockStartTime = Date.now(); el.lockProgress.style.display = 'block';
    lockTimer = setInterval(() => {
        const p = Math.min(((Date.now() - lockStartTime) / 4000) * 100, 100);
        el.lockProgress.style.width = p + '%';
        if (p >= 100) { clearInterval(lockTimer); isLocked = !isLocked; el.lockOverlay.classList.toggle('active', isLocked); el.lockProgress.style.width = '0%'; }
    }, 50);
};
window.onmouseup = () => { if (lockTimer) { clearInterval(lockTimer); lockTimer = null; } el.lockProgress.style.display = 'none'; };

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
el.btnLoop.onclick = () => { isLoop = !isLoop; updateUIStates(); };
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
document.getElementById('btn-export').onclick = () => {
    const b = new Blob([JSON.stringify(queue, null, 2)], { type: 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'playlist.txt'; a.click();
};
document.getElementById('btn-import').onclick = () => el.fileInput.click();
el.fileInput.onchange = (e) => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader(); r.onload = (ev) => {
        try { const d = JSON.parse(ev.target.result); if (Array.isArray(d)) { queue = d.slice(0, MAX_QUEUE); currentIndex = -1; renderQueue(); if (queue.length > 0) playIndex(0); } } catch (e) { }
    }; r.readAsText(f);
};

// Volume Control Implementation
document.getElementById('volume-slider').oninput = (e) => {
    const val = parseInt(e.target.value);
    if (isPlayerReady) player.setVolume(val);
    document.getElementById('volume-val').innerText = `${val}%`;
};

// Keys
document.addEventListener('keydown', (e) => {
    if (isLocked || e.target.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();

    // Updated Shortcuts
    if (k === 'd') !isLocked && isPlayerReady && player.seekTo(player.getCurrentTime() - 10);
    else if (k === 'j') !isLocked && isPlayerReady && player.seekTo(player.getCurrentTime() + 10);
    else if (k === 'a') playIndex(0);
    else if (k === 'l') playIndex(queue.length - 1);

    // Existing others
    else if (k === 's') skipPrev();
    else if (k === 'k') skipNext();
    else if (k === 'f') isPlayerReady && player.seekTo(player.getCurrentTime() - 2);
    else if (k === 'h') isPlayerReady && player.seekTo(player.getCurrentTime() + 2);
    else if (k === 'g') { e.preventDefault(); document.getElementById('btn-pause').click(); }
    else if (k === 'o') document.getElementById('btn-stop').click();
    else if (k === 'q') el.btnLoop.click();
    else if (k === 'w') el.btnShuffle.click();
    else if (k === '[') {
        const idx = selectedListIndex >= 0 ? selectedListIndex : (currentIndex >= 0 ? currentIndex : -1);
        if (idx >= 0) {
            queue.splice(idx + 1, 0, { ...queue[idx] });
            renderQueue();
        } else el.addUrl.focus();
    }
    else if (k === ']') document.getElementById('btn-delete').click();

    const n = parseInt(e.key);
    if (!isNaN(n)) {
        if (n >= 1 && n <= 5) { const t = currentIndex + (n - 6); if (t >= 0) playIndex(t); }
        else { const v = n === 0 ? 10 : n; const t = currentIndex + (v - 5); if (t < queue.length) playIndex(t); }
    }
});
