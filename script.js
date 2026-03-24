async function loadData() {
    try {
        const res = await gapi.client.drive.files.list({
            q: `name = '${DATA_FILE_NAME}' and '${folderId}' in parents and trashed = false`,
            fields: 'files(id, name)'
        });
        
        if (res.result.files.length > 0) {
            fileId = res.result.files[0].id;
            const content = await gapi.client.drive.files.get({ fileId: fileId, alt: 'media' });
            const rawData = content.result;

            // 호환성 처리: 데이터가 배열이면 바로 할당, 객체면 shelves 키에서 추출
            if (Array.isArray(rawData)) {
                shelves = rawData;
            } else {
                shelves = rawData.shelves || [];
            }
        } else {
            shelves = [{ title: 'MY COLLECTION', books: [], color: '#ffffff' }];
            await save();
        }
        render();
    } catch (err) { 
        console.error("데이터 로드 오류", err); 
    }
}
