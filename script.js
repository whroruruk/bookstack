// [주의] 구글 클라우드 콘솔에서 발급받은 실제 값으로 교체해야 합니다.
const CLIENT_ID = 'YOUR_CLIENT_ID.apps.googleusercontent.com';
const API_KEY = 'YOUR_API_KEY';
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
const SCOPES = 'https://www.googleapis.com/auth/drive.appdata';
const TTB_KEY = 'ttbtwinwhee0938001';

let tokenClient;
let gapiInited = false;
let gisInited = false;
let shelves = [];
let fileId = null;

// 1. 초기 반응 체계 설정
window.onload = () => {
    gapi.load('client', async () => {
        await gapi.client.init({ apiKey: API_KEY, discoveryDocs: DISCOVERY_DOCS });
        gapiInited = true;
        updateStatus();
    });
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID, scope: SCOPES, callback: '', 
    });
    gisInited = true;
};

function updateStatus() {
    if (gapiInited && gisInited) document.getElementById('syncStatus').innerText = "연결 준비 완료";
}

// 2. 로그인 및 개체 식별
function handleLogin() {
    tokenClient.callback = async (resp) => {
        if (resp.error) return;
        document.getElementById('loginBtn').style.display = 'none';
        document.getElementById('logoutBtn').style.display = 'block';
        document.getElementById('mainContent').style.display = 'block';
        document.getElementById('loginMessage').style.display = 'none';
        await loadData();
    };
    tokenClient.requestAccessToken({ prompt: 'consent' });
}

function handleLogout() {
    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token);
        gapi.client.setToken('');
        location.reload();
    }
}

// 3. 구글 드라이브와 대사 작용 (Load/Save)
async function loadData() {
    try {
        const response = await gapi.client.drive.files.list({
            q: "name = 'bookstack_data.json'", spaces: 'appDataFolder', fields: 'files(id, name)'
        });
        const files = response.result.files;
        if (files.length > 0) {
            fileId = files[0].id;
            const content = await gapi.client.drive.files.get({ fileId: fileId, alt: 'media' });
            shelves = content.result.shelves || [];
        } else {
            shelves = [{ title: 'MY COLLECTION', books: [], color: '#ffffff' }];
            await save();
        }
        render();
    } catch (err) { console.error("Data Load Error:", err); }
}

async function save() {
    document.getElementById('syncStatus').innerText = "개인 서고에 기록 중...";
    const metadata = { 'name': 'bookstack_data.json', 'parents': ['appDataFolder'] };
    const data = { shelves: shelves, lastUpdated: new Date() };

    try {
        const boundary = 'foo_bar_baz';
        const delimiter = "\r\n--" + boundary + "\r\n";
        const close_delim = "\r\n--" + boundary + "--";
        const body = delimiter + 'Content-Type: application/json\r\n\r\n' + JSON.stringify(metadata) +
                     delimiter + 'Content-Type: application/json\r\n\r\n' + JSON.stringify(data) + close_delim;

        if (!fileId) {
            const res = await gapi.client.request({
                path: '/upload/drive/v3/files', method: 'POST',
                params: { uploadType: 'multipart' },
                headers: { 'Content-Type': 'multipart/related; boundary=' + boundary }, body: body
            });
            fileId = res.result.id;
        } else {
            await gapi.client.request({
                path: '/upload/drive/v3/files/' + fileId, method: 'PATCH',
                params: { uploadType: 'multipart' },
                headers: { 'Content-Type': 'multipart/related; boundary=' + boundary }, body: body
            });
        }
        document.getElementById('syncStatus').innerText = "동기화 완료";
    } catch (err) { document.getElementById('syncStatus').innerText = "기록 실패"; }
}

// 4. 도서 검색 및 UI 렌더링 (이전 로직 유지)
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
                const book = { title: i.title, cover: i.cover.replace('coversum', 'cover500'), author: i.author, addedDate: new Date().toLocaleDateString() };
                const div = document.createElement('div');
                div.className = 'search-item';
                div.innerHTML = `<img src="${book.cover}">`;
                div.onclick = () => { shelves[0].books.unshift(book); save(); render(); };
                results.appendChild(div);
            });
        }
    } catch (e) { console.error("Search Error"); }
}

function render() {
    const container = document.getElementById('shelfList');
    container.innerHTML = '';
    shelves.forEach((s, sIdx) => {
        const shelfEl = document.createElement('div');
        shelfEl.className = 'shelf-wrapper';
        shelfEl.innerHTML = `
            <div class="shelf-header">
                <input type="text" class="shelf-title" value="${s.title}" style="color:${s.color};" onchange="shelves[${sIdx}].title=this.value; save();">
            </div>
            <div class="book-grid-display">
                ${s.books.map((b, bIdx) => `<div class="book"><img src="${b.cover}"></div>`).join('')}
            </div>
        `;
        container.appendChild(shelfEl);
    });
    document.getElementById('totalCount').innerText = shelves.reduce((acc, cur) => acc + cur.books.length, 0);
}

function addShelf() {
    shelves.push({ title: 'NEW STACK', books: [], color: '#00ff88' });
    save(); render();
}
function clearSearch() { document.getElementById('kwInput').value = ''; document.getElementById('searchResults').innerHTML = ''; }
function toggleStats() { document.getElementById('statsBar').classList.toggle('collapsed'); }
function toggleGuide(show) { document.getElementById('guideModal').style.display = show ? 'flex' : 'none'; }
