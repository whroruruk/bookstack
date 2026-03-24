// 1. Firebase 설정
const firebaseConfig = {
    apiKey: "AIzaSyBfBYodmAEL-lnKfFn8KLXMc7XqCO1w4zw",
    authDomain: "reading-lab-69ea0.firebaseapp.com",
    projectId: "reading-lab-69ea0",
    storageBucket: "reading-lab-69ea0.firebasestorage.app",
    messagingSenderId: "45130148120",
    appId: "1:45130148120:web:96629d86ca19972c6a166d",
    measurementId: "G-C4YNCKXL96"
};

// 2. 초기화
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const TTB_KEY = 'ttbtwinwhee0938001';

let currentUser = null;
let shelves = [];
const hipColors = ['#ffffff', '#00ff88', '#3a86ff', '#ff006e', '#8338ec', '#ffbe0b', '#adb5bd', '#ff5400', '#00f5d4', '#9d4edd'];

// 3. 인증 상태 감시 (항상성 유지)
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        document.getElementById('loginBtn').style.display = 'none';
        document.getElementById('logoutBtn').style.display = 'block';
        document.getElementById('mainContent').style.display = 'block';
        document.getElementById('loginMessage').style.display = 'none';
        document.getElementById('syncStatus').innerText = `${user.displayName}님 서재`;
        loadData();
    } else {
        currentUser = null;
        document.getElementById('loginBtn').style.display = 'block';
        document.getElementById('logoutBtn').style.display = 'none';
        document.getElementById('mainContent').style.display = 'none';
        document.getElementById('loginMessage').style.display = 'block';
        document.getElementById('syncStatus').innerText = "로그인 필요";
    }
});

// 4. 로그인/로그아웃 함수
function handleLogin() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(err => {
        console.error("Login Error:", err);
        alert("로그인 중 오류 발생: " + err.message);
    });
}

function handleLogout() {
    auth.signOut();
}

// 5. 데이터 저장 및 불러오기 (대사 작용)
async function save() {
    if (!currentUser) return;
    document.getElementById('syncStatus').innerText = "저장 중...";
    try {
        await db.collection("users").doc(currentUser.uid).set({
            shelves: shelves,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
        document.getElementById('syncStatus').innerText = "저장 완료";
    } catch (e) {
        document.getElementById('syncStatus').innerText = "저장 실패";
    }
}

async function loadData() {
    try {
        const doc = await db.collection("users").doc(currentUser.uid).get();
        if (doc.exists) {
            shelves = doc.data().shelves || [];
        } else {
            shelves = [{ title: 'MY COLLECTION', books: [], color: '#ffffff' }];
        }
        render();
    } catch (e) {
        console.error("Load Error:", e);
    }
}

// 6. 알라딘 검색 (외부 정보 섭취)
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
                    author: i.author ? i.author.split('(지은이)')[0] : "",
                    addedDate: new Date().toLocaleDateString()
                };
                const div = document.createElement('div');
                div.className = 'search-item';
                div.innerHTML = `<img src="${book.cover}"><p style="font-size:9px; color:white; margin-top:5px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis;">${book.title}</p>`;
                div.onclick = () => { 
                    if(shelves.length === 0) shelves.push({ title: 'MY COLLECTION', books: [], color: '#ffffff' });
                    shelves[0].books.unshift(book); 
                    save(); render(); 
                };
                results.appendChild(div);
            });
        }
    } catch (e) { console.error("Search Error:", e); }
}

// 7. UI 렌더링 및 기능 (운동 작용)
function render() {
    const container = document.getElementById('shelfList');
    container.innerHTML = '';
    
    shelves.forEach((s, sIdx) => {
        const shelfEl = document.createElement('div');
        shelfEl.className = 'shelf-wrapper';
        shelfEl.style.marginBottom = "30px";
        shelfEl.innerHTML = `
            <div class="shelf-header" style="margin-bottom:20px; display:flex; align-items:center; gap:10px;">
                <input type="text" class="shelf-title" style="color:${s.color}; background:transparent; border:none; font-size:1.2rem; font-weight:900;" value="${s.title}" onchange="shelves[${sIdx}].title=this.value; save();">
                <button onclick="deleteShelf(${sIdx})" style="background:none; border:none; color:#ff4444; cursor:pointer; font-size:0.8rem;">삭제</button>
            </div>
            <div class="book-grid-display" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(120px, 1fr)); gap:15px;">
                ${s.books.map((b, bIdx) => `
                    <div class="book" style="position:relative;">
                        <img src="${b.cover}" style="width:100%; border-radius:4px;">
                        <button onclick="deleteBook(${sIdx}, ${bIdx})" style="position:absolute; top:5px; right:5px; background:rgba(0,0,0,0.7); color:white; border:none; border-radius:50%; width:20px; height:20px; cursor:pointer;">×</button>
                    </div>
                `).join('')}
            </div>
        `;
        container.appendChild(shelfEl);
    });
    updateTotal();
}

function addShelf() {
    shelves.push({ title: 'NEW STACK', books: [], color: hipColors[Math.floor(Math.random()*hipColors.length)] });
    save(); render();
}

function deleteShelf(idx) {
    if(confirm("책장을 삭제할까요?")) { shelves.splice(idx, 1); save(); render(); }
}

function deleteBook(sIdx, bIdx) {
    shelves[sIdx].books.splice(bIdx, 1); save(); render();
}

function updateTotal() {
    let total = 0;
    shelves.forEach(s => total += s.books.length);
    document.getElementById('totalCount').innerText = total;
}

function clearSearch() { document.getElementById('kwInput').value = ''; document.getElementById('searchResults').innerHTML = ''; }
function toggleStats(e) { document.getElementById('statsBar').classList.toggle('collapsed'); }
function toggleGuide(show) { document.getElementById('guideModal').style.display = show ? 'flex' : 'none'; }
