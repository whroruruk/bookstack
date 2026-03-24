// 1. 환경 설정 (보안을 위해 API 키를 제거하고 클라이언트 ID만 사용합니다.)
const CLIENT_ID = '982927191150-uc696nka5n0n3j0qmjt0mjnl1tgsj7i0.apps.googleusercontent.com';
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const TTB_KEY = 'ttbtwinwhee0938001';

// 기존 GAS 코드와 동일한 파일명 사용 
const DATA_FILE_NAME = 'My_BookStack_Data_DO_NOT_DELETE'; 

let tokenClient, gapiInited = false, gisInited = false, shelves = [], fileId = null;
const hipColors = ['#ffffff', '#00ff88', '#3a86ff', '#ff006e', '#8338ec', '#ffbe0b', '#adb5bd', '#ff5400', '#00f5d4', '#9d4edd'];

window.onload = () => {
    gapi.load('client', async () => {
        await gapi.client.init({ discoveryDocs: DISCOVERY_DOCS });
        gapiInited = true;
        checkPersistentLogin(); 
    });
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID, scope: SCOPES, callback: async (resp) => {
            if (resp.error) return;
            localStorage.setItem('gapi_token', JSON.stringify(resp));
            await afterLoggedIn();
        },
    });
    gisInited = true;
};

async function checkPersistentLogin() {
    const savedToken = localStorage.getItem('gapi_token');
    if (savedToken) {
        const token = JSON.parse(savedToken);
        gapi.client.setToken(token);
        await afterLoggedIn();
    } else {
        document.getElementById('syncStatus').innerText = "Cloud Ready";
    }
}

async function afterLoggedIn() {
    document.getElementById('loginBtn').style.display = 'none';
    const userActions = document.getElementById('userActions');
    if (userActions) userActions.style.display = 'flex';
    document.getElementById('mainContent').style.display = 'block';
    document.getElementById('loginMessage').style.display = 'none';
    // 폴더 생성 과정을 생략하고 드라이브 전체에서 기존 파일 찾기 실행 
    await findOrCreateDataFile(); 
}

// 2. 기존 파일을 찾는 핵심 로직 (GAS의 getOrCreateFile 기능 이식)
async function findOrCreateDataFile() {
    try {
        // 드라이브 전체에서 해당 이름의 파일을 찾습니다. (폴더 제약 해제)
        const res = await gapi.client.drive.files.list({
            q: `name = '${DATA_FILE_NAME}' and trashed = false`,
            fields: 'files(id, name)'
        });
        
        const files = res.result.files;
        if (files.length > 0) {
            fileId = files[0].id;
            await loadData();
        } else {
            // 파일이 아예 없을 때만 새로 생성합니다.
            shelves = [{ title: 'MY COLLECTION', books: [], color: '#ffffff' }];
            await save();
            render();
        }
    } catch (err) { console.error("File Search Error", err); }
}

async function loadData() {
    try {
        const content = await gapi.client.drive.files.get({ fileId: fileId, alt: 'media' });
        const rawData = content.result;

        // [호환성 핵심] 기존 GAS의 배열 형태를 우선적으로 처리합니다. 
        if (Array.isArray(rawData)) {
            shelves = rawData;
        } else if (rawData && rawData.shelves) {
            shelves = rawData.shelves;
        } else {
            shelves = [{ title: 'MY COLLECTION', books: [], color: '#ffffff' }];
        }
        render();
        document.getElementById('syncStatus').innerText = "Cloud Active";
    } catch (err) { console.error("Data Load Error"); }
}

async function save() {
    if (!gapi.client.getToken()) return;
    document.getElementById('syncStatus').innerText = "Syncing...";
    
    // 기존 GAS 코드와의 호환을 위해 데이터만 깔끔하게 배열 형태로 저장하거나,
    // 메타데이터를 포함한 객체 형태로 저장합니다. (여기서는 호환성을 위해 래핑함)
    const metadata = { 'name': DATA_FILE_NAME };
    const data = { shelves: shelves, lastUpdated: new Date() };
    const boundary = 'foo_bar_baz';
    const body = `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(data)}\r\n--${boundary}--`;

    try {
        const path = fileId ? `/upload/drive/v3/files/${fileId}` : '/upload/drive/v3/files';
        const method = fileId ? 'PATCH' : 'POST';
        const res = await gapi.client.request({
            path: path, method: method, params: { uploadType: 'multipart' },
            headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body: body
        });
        if (!fileId) fileId = res.result.id;
        document.getElementById('syncStatus').innerText = "Cloud Active";
    } catch (err) { document.getElementById('syncStatus').innerText = "Sync Error"; }
}

// 3. UI 렌더링 및 검색 기능 (기존 로직 유지)
function render() {
    const container = document.getElementById('shelfList');
    container.innerHTML = '';
    shelves.forEach((s, sIdx) => {
        const shelfEl = document.createElement('div');
        shelfEl.className = 'shelf-wrapper';
        shelfEl.innerHTML = `
            <div class="shelf-header">
                <input type="text" class="shelf-title" value="${s.title}" style="color:${s.color}; background:transparent; border:none; font-size:1.2rem; font-weight:900;" onchange="shelves[${sIdx}].title=this.value; save();">
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
    const totalCountEl = document.getElementById('totalCount');
    if (totalCountEl) totalCountEl.innerText = shelves.reduce((acc, cur) => acc + cur.books.length, 0);
}

// 기타 함수들 (addShelf, deleteShelf, deleteBook, handleLogin, handleLogout 등은 기존과 동일)
function handleLogin() { tokenClient.requestAccessToken({ prompt: 'consent' }); }
function handleLogout() { localStorage.removeItem('gapi_token'); location.reload(); }
function addShelf() { shelves.push({ title: 'NEW STACK', books: [], color: hipColors[Math.floor(Math.random()*hipColors.length)] }); save(); render(); }
function deleteShelf(idx) { if(confirm("책장을 삭제할까요?")) { shelves.splice(idx, 1); save(); render(); } }
function deleteBook(sIdx, bIdx) { shelves[sIdx].books.splice(bIdx, 1); save(); render(); }
