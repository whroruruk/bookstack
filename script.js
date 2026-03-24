const firebaseConfig = {
    apiKey: "AIzaSyBfBYodmAEL-lnKfFn8KLXMc7XqCO1w4zw",
    authDomain: "reading-lab-69ea0.firebaseapp.com",
    projectId: "reading-lab-69ea0",
    storageBucket: "reading-lab-69ea0.firebasestorage.app",
    messagingSenderId: "45130148120",
    appId: "1:45130148120:web:96629d86ca19972c6a166d",
    measurementId: "G-C4YNCKXL96"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const TTB_KEY = 'ttbtwinwhee0938001';

let currentUser = null;
let shelves = [];
const hipColors = ['#ffffff', '#00ff88', '#3a86ff', '#ff006e', '#8338ec', '#ffbe0b', '#adb5bd', '#ff5400', '#00f5d4', '#9d4edd'];

// 로그인 상태 감지
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        document.getElementById('loginBtn').style.display = 'none';
        document.getElementById('logoutBtn').style.display = 'block';
        document.getElementById('mainContent').style.display = 'block';
        document.getElementById('loginMessage').style.display = 'none';
        document.getElementById('syncStatus').innerText = `${user.displayName}님 접속 중`;
        loadData();
    } else {
        currentUser = null;
        document.getElementById('loginBtn').style.display = 'block';
        document.getElementById('logoutBtn').style.display = 'none';
        document.getElementById('mainContent').style.display = 'none';
        document.getElementById('loginMessage').style.display = 'block';
        document.getElementById('syncStatus').innerText = "인증 필요";
    }
});

function handleLogin() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(err => alert("로그인 실패: " + err.message));
}

function handleLogout() {
    auth.signOut();
}

async function save() {
    if (!currentUser) return;
    document.getElementById('syncStatus').innerText = "저장 중...";
    await db.collection("users").doc(currentUser.uid).set({
        shelves: shelves,
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    });
    document.getElementById('syncStatus').innerText = "클라우드 저장됨";
}

async function loadData() {
    const doc = await db.collection("users").doc(currentUser.uid).get();
    if (doc.exists) {
        shelves = doc.data().shelves || [];
    } else {
        shelves = [{ title: 'MY COLLECTION', books: [], color: '#ffffff' }];
    }
    render();
}

async function searchByKeyword() {
    const kw = document.getElementById('kwInput').value;
    if (!kw) return;
    const apiUrl = `https://www.aladin.co.kr/ttb/api/ItemSearch.aspx?ttbkey=${TTB_KEY}&Query=${encodeURIComponent(kw)}&QueryType=Keyword&MaxResults=15&start=1&SearchTarget=Book&output=js&Version=20131101`;
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(apiUrl)}`;

    try {
        const response = await fetch(proxyUrl);
        const rawData = await response.json();
        let content = rawData.contents.trim();
        if (content.endsWith(';')) content = content.substring(0, content.length - 1);
        const data = JSON.parse(content);

        const results = document.getElementById('searchResults');
        results.innerHTML = '';
        if (data.item) {
            data.item.forEach(i => {
                const book = {
                    title: i.title.replace(/<[^>]*>?/gm, ''),
                    cover: i.cover.replace('coversum', 'cover500'),
                    link: i.link,
                    author: i.author ? i.author.split('(지은이)')[0] : "",
                    addedDate: new Date().toLocaleDateString(),
                    memo: ""
                };
                const div = document.createElement('div');
                div.className = 'search-item';
                div.innerHTML = `<img src="${book.cover}"><p style="font-size:9px; color:white; overflow:hidden;">${book.title}</p>`;
                div.onclick = () => { shelves[0].books.unshift(book); save(); render(); };
                results.appendChild(div);
            });
        }
    } catch (e) { console.error(e); }
}

function addShelf() {
    shelves.push({ title: 'NEW STACK', books: [], color: hipColors[Math.floor(Math.random()*hipColors.length)] });
    save(); render();
}

function render() {
    const container = document.getElementById('shelfList');
    container.innerHTML = '';
    shelves.forEach((s, sIdx) => {
        const shelfEl = document.createElement('div');
        shelfEl.className = 'shelf-wrapper';
        shelfEl.innerHTML = `
            <div class="shelf-header">
                <input type="text" class="shelf-title" style="color:${s.color}" value="${s.title}" onchange="shelves[${sIdx}].title=this.value; save();">
            </div>
            <div class="book-grid-display">
                ${s.books.map((b, bIdx) => `<div class="book"><img src="${b.cover}"></div>`).join('')}
            </div>
        `;
        container.appendChild(shelfEl);
    });
}

function clearSearch() { document.getElementById('kwInput').value = ''; document.getElementById('searchResults').innerHTML = ''; }
function toggleStats(e) { document.getElementById('statsBar').classList.toggle('collapsed'); }
function toggleGuide(show) { document.getElementById('guideModal').style.display = show ? 'flex' : 'none'; }
