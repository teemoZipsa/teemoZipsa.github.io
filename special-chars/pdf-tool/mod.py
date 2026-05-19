import os
import re

file_path = r"c:\Users\arasoftGJ_01\MyProjects\teemoZipsa\special-chars\pdf-tool\index.html"

with open(file_path, "r", encoding="utf-8") as f:
    html_content = f.read()

# 1. Update CSS .mode-tab
html_content = html_content.replace(
    ".mode-tab{flex:1;padding:10px;text-align:center;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s;color:var(--text-info);background:transparent;border:none;font-family:inherit}",
    ".mode-tab{flex:0 0 auto;padding:10px 16px;text-align:center;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s;color:var(--text-info);background:transparent;border:none;font-family:inherit;white-space:nowrap;}"
)

# 2. Update CSS MQ
html_content = html_content.replace(
    "@media(max-width:480px){\n  .mode-tab{font-size:11px;padding:8px 4px}\n  .mode-tab .tab-label{display:none}\n}",
    "@media(max-width:480px){\n  .mode-tab{font-size:12px;padding:10px 12px}\n}"
)

# 3. Add 5 tags to .mode-tabs
tags_block_old = """    <div class="mode-tabs">
      <button class="mode-tab active" data-tab="merge">📎 <span class="tab-label">합치기</span></button>
      <button class="mode-tab" data-tab="split">✂️ <span class="tab-label">나누기</span></button>
      <button class="mode-tab" data-tab="rotate">🔄 <span class="tab-label">회전</span></button>
      <button class="mode-tab" data-tab="reorder">↕️ <span class="tab-label">순서</span></button>
      <button class="mode-tab" data-tab="watermark">💧 <span class="tab-label">워터마크</span></button>
    </div>"""
    
tags_block_new = """    <div class="mode-tabs">
      <button class="mode-tab active" data-tab="merge">📎 <span class="tab-label">합치기</span></button>
      <button class="mode-tab" data-tab="split">✂️ <span class="tab-label">나누기</span></button>
      <button class="mode-tab" data-tab="rotate">🔄 <span class="tab-label">회전</span></button>
      <button class="mode-tab" data-tab="reorder">↕️ <span class="tab-label">순서</span></button>
      <button class="mode-tab" data-tab="watermark">💧 <span class="tab-label">워터마크</span></button>
      <button class="mode-tab" data-tab="delete">🗑️ <span class="tab-label">페이지 삭제</span></button>
      <button class="mode-tab" data-tab="img2pdf">🖼️ <span class="tab-label">이미지 변환</span></button>
      <button class="mode-tab" data-tab="pagenum">🔢 <span class="tab-label">페이지 번호</span></button>
      <button class="mode-tab" data-tab="metadata">📝 <span class="tab-label">메타데이터</span></button>
      <button class="mode-tab" data-tab="blank">📄 <span class="tab-label">빈 페이지</span></button>
    </div>"""

html_content = html_content.replace(tags_block_old, tags_block_new)

# 4. Add the 5 panels
new_panels = """    <!-- Delete Panel -->
    <div class="tab-panel" id="deletePanel">
      <div class="drop-zone" id="deleteDropZone">
        <div class="icon">📁</div>
        <div class="text">PDF 파일을 여기에 드래그하거나 클릭하세요</div>
        <div class="sub">파일이 서버로 전송되지 않습니다</div>
        <input type="file" accept=".pdf" id="deleteFileInput">
      </div>
      <div class="info-bar" id="deleteInfo" style="display:none;margin-top:12px">
        📄 총 <span class="highlight" id="deletePageCount">0</span>페이지
      </div>
      <div class="field-group" id="deleteRangeGroup" style="display:none;margin-top:12px">
        <div class="field-label">🗑️ 삭제할 페이지 번호 입력</div>
        <input type="text" class="field-input" id="deleteRange" placeholder="예: 3, 5-7 (콤마 단위 입력)">
      </div>
      <button class="btn btn-primary" id="deleteBtn" style="display:none" onclick="doDelete()">🗑️ 삭제하기</button>
      <div class="loading" id="deleteLoading"><span class="spinner"></span>처리 중...</div>
    </div>

    <!-- Image to PDF Panel -->
    <div class="tab-panel" id="img2pdfPanel">
      <div class="drop-zone" id="img2pdfDropZone">
        <div class="icon">📁</div>
        <div class="text">이미지 파일들을 여기에 드래그하거나 클릭하세요</div>
        <div class="sub">JPG, PNG, WebP 파일 지원 · 드래그로 순서 변경</div>
        <input type="file" accept="image/jpeg, image/png, image/webp" multiple id="img2pdfFileInput">
      </div>
      <div class="file-list" id="img2pdfFileList"></div>
      <button class="btn btn-primary" id="img2pdfBtn" style="display:none" onclick="doImgToPdf()">🖼️ PDF로 변환하기</button>
      <div class="loading" id="img2pdfLoading"><span class="spinner"></span>처리 중...</div>
    </div>

    <!-- Page Number Panel -->
    <div class="tab-panel" id="pagenumPanel">
      <div class="drop-zone" id="pagenumDropZone">
        <div class="icon">📁</div>
        <div class="text">PDF 파일을 여기에 드래그하거나 클릭하세요</div>
        <div class="sub">파일이 서버로 전송되지 않습니다</div>
        <input type="file" accept=".pdf" id="pagenumFileInput">
      </div>
      <div id="pagenumControls" style="display:none;margin-top:12px">
        <div class="control-row">
          <label>글자 크기</label>
          <input type="range" class="slider" id="pageNumSize" min="8" max="24" value="12" oninput="document.getElementById('pageNumSizeVal').textContent=this.value+'px';">
          <span class="val" id="pageNumSizeVal">12px</span>
        </div>
        <div class="control-row">
          <label>위치</label>
          <select id="pageNumPos" style="background:var(--bg-input);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);padding:6px 8px;font-size:13px;width:100%;outline:none;font-family:inherit">
            <option value="bottom-center">하단 중앙</option>
            <option value="bottom-right">하단 우측</option>
          </select>
        </div>
        <button class="btn btn-primary" onclick="doPageNum()">✅ 적용</button>
      </div>
      <div class="loading" id="pagenumLoading"><span class="spinner"></span>처리 중...</div>
    </div>

    <!-- Metadata Panel -->
    <div class="tab-panel" id="metadataPanel">
      <div class="drop-zone" id="metadataDropZone">
        <div class="icon">📁</div>
        <div class="text">PDF 파일을 여기에 드래그하거나 클릭하세요</div>
        <div class="sub">파일이 서버로 전송되지 않습니다</div>
        <input type="file" accept=".pdf" id="metadataFileInput">
      </div>
      <div id="metadataControls" style="display:none;margin-top:12px">
        <div class="field-group">
          <div class="field-label">제목 (Title)</div>
          <input type="text" class="field-input" id="metaTitle">
        </div>
        <div class="field-group">
          <div class="field-label">작성자 (Author)</div>
          <input type="text" class="field-input" id="metaAuthor">
        </div>
        <div class="field-group">
          <div class="field-label">주제 (Subject)</div>
          <input type="text" class="field-input" id="metaSubject">
        </div>
        <div class="field-group">
          <div class="field-label">키워드 (Keywords)</div>
          <input type="text" class="field-input" id="metaKeywords">
        </div>
        <button class="btn btn-primary" onclick="doMetadata()">✅ 속성 저장</button>
      </div>
      <div class="loading" id="metadataLoading"><span class="spinner"></span>처리 중...</div>
    </div>

    <!-- Blank Page Panel -->
    <div class="tab-panel" id="blankPanel">
      <div class="drop-zone" id="blankDropZone">
        <div class="icon">📁</div>
        <div class="text">PDF 파일을 여기에 드래그하거나 클릭하세요</div>
        <div class="sub">파일이 서버로 전송되지 않습니다</div>
        <input type="file" accept=".pdf" id="blankFileInput">
      </div>
      <div id="blankControls" style="display:none;margin-top:12px">
        <div class="info-bar" style="margin-bottom:12px">
          📄 총 <span class="highlight" id="blankPageCount">0</span>페이지
        </div>
        <div class="field-group">
          <div class="field-label">삽입할 위치 (콤마 단위, 번호 뒤에 삽입됨)</div>
          <input type="text" class="field-input" id="blankPositions" placeholder="예: 2, 5 (2번째, 5번째 페이지 장 뒤에 추가)">
        </div>
        <button class="btn btn-primary" onclick="doBlank()">✅ 삽입하기</button>
      </div>
      <div class="loading" id="blankLoading"><span class="spinner"></span>처리 중...</div>
    </div>
    
    <!-- 동적 분석 리포트 영역 -->"""

html_content = html_content.replace("    <!-- 동적 분석 리포트 영역 -->", new_panels)


# 5. JS Scripts addition
js_addition = """
/* ===== DELETE ===== */
let deletePdfBytes = null;
let deletePageTotal = 0;

setupDropZone('deleteDropZone', 'deleteFileInput', async files => {
  const file = files[0];
  deletePdfBytes = await file.arrayBuffer();
  try {
    const doc = await PDFDocument.load(deletePdfBytes);
    deletePageTotal = doc.getPageCount();
    document.getElementById('deletePageCount').textContent = deletePageTotal;
    document.getElementById('deleteInfo').style.display = 'flex';
    document.getElementById('deleteRangeGroup').style.display = 'block';
    document.getElementById('deleteBtn').style.display = 'block';
  } catch (e) { showToast('PDF를 읽을 수 없습니다'); }
}, false);

async function doDelete() {
  if (!deletePdfBytes) return;
  const pages = parseRange(document.getElementById('deleteRange').value, deletePageTotal);
  if (!pages.length) return showToast('삭제할 유효 페이지를 입력하세요');
  setLoading('deleteLoading', true);
  try {
    const doc = await PDFDocument.load(deletePdfBytes);
    const toRemove = pages.sort((a,b) => b - a);
    for (const p of toRemove) {
        doc.removePage(p - 1);
    }
    const result = await doc.save();
    downloadPdf(result, 'deleted.pdf');
    showToast('페이지 삭제 완료!');
    updateReport('PDF 페이지 삭제(Delete)', 'deleted.pdf', result.byteLength, `총 ${pages.length}장의 아웃라이어 페이지를 파괴했습니다.`, '삭제 후 Page Tree 인덱스가 재정렬되며 무손실 바이트 어레이로 출력.');
  } catch (e) { showToast('오류: ' + e.message); }
  setLoading('deleteLoading', false);
}

/* ===== IMG2PDF ===== */
let img2pdfFiles = [];
setupDropZone('img2pdfDropZone', 'img2pdfFileInput', files => {
  img2pdfFiles = img2pdfFiles.concat(files);
  renderImg2pdfList();
}, true);

function renderImg2pdfList() {
  const list = document.getElementById('img2pdfFileList');
  list.innerHTML = '';
  document.getElementById('img2pdfBtn').style.display = img2pdfFiles.length > 0 ? 'block' : 'none';
  img2pdfFiles.forEach((f, i) => {
    const el = document.createElement('div');
    el.className = 'file-item';
    el.draggable = true;
    el.dataset.idx = i;
    el.innerHTML = `<span class="grip">☰</span><span class="name">${escapeHtml(f.name)}</span><span class="size">${formatSize(f.size)}</span><button class="remove-btn" data-i="${i}">✕</button>`;
    el.querySelector('.remove-btn').addEventListener('click', e => {
      e.stopPropagation();
      img2pdfFiles.splice(+e.target.dataset.i, 1);
      renderImg2pdfList();
    });
    el.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', i); el.classList.add('dragging'); });
    el.addEventListener('dragend', () => el.classList.remove('dragging'));
    el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('drag-over'); });
    el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
    el.addEventListener('drop', e => {
      e.preventDefault(); el.classList.remove('drag-over');
      const from = +e.dataTransfer.getData('text/plain');
      const to = i;
      if (from !== to) {
        const [item] = img2pdfFiles.splice(from, 1);
        img2pdfFiles.splice(to, 0, item);
        renderImg2pdfList();
      }
    });
    list.appendChild(el);
  });
}

function processImageToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0,0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.95));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function doImgToPdf() {
  if (!img2pdfFiles.length) return;
  setLoading('img2pdfLoading', true);
  try {
    const out = await PDFDocument.create();
    for (const file of img2pdfFiles) {
      const dataUrl = await processImageToDataUrl(file);
      const res = await fetch(dataUrl);
      const buf = await res.arrayBuffer();
      const img = await out.embedJpg(buf);
      const { width, height } = img.scale(1);
      // A4 default
      const page = out.addPage([width, height]);
      page.drawImage(img, { x: 0, y: 0, width, height });
    }
    const result = await out.save();
    downloadPdf(result, 'images.pdf');
    showToast('PDF 변환 완료!');
    updateReport('이미지 PDF 병합(Img2Pdf)', 'images.pdf', result.byteLength, `${img2pdfFiles.length}장의 사진이 단일 PDF로 포장되었습니다.`, '브라우저 캔버스를 통한 투명도 보정(JPEG 컨버팅) 후, Base64 임베딩으로 Vector 도큐먼트 규격화 진행.');
  } catch(e) {
    showToast('오류: ' + e.message);
  }
  setLoading('img2pdfLoading', false);
}

/* ===== PAGENUM ===== */
let pagenumPdfBytes = null;
setupDropZone('pagenumDropZone', 'pagenumFileInput', async files => {
  const file = files[0];
  pagenumPdfBytes = new Uint8Array(await file.arrayBuffer());
  setLoading('pagenumLoading', true);
  try {
    // Validate
    await PDFDocument.load(pagenumPdfBytes);
    document.getElementById('pagenumControls').style.display = 'block';
  } catch (e) { showToast('PDF를 읽을 수 없습니다'); }
  setLoading('pagenumLoading', false);
}, false);

async function doPageNum() {
  if (!pagenumPdfBytes) return;
  setLoading('pagenumLoading', true);
  try {
    const doc = await PDFDocument.load(pagenumPdfBytes);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const pages = doc.getPages();
    const size = +document.getElementById('pageNumSize').value;
    const pos = document.getElementById('pageNumPos').value;
    
    pages.forEach((page, idx) => {
      const { width, height } = page.getSize();
      const text = `${idx + 1} / ${pages.length}`;
      const textWidth = font.widthOfTextAtSize(text, size);
      let x = (width - textWidth) / 2;
      let y = 30; // bottom baseline
      
      if (pos === 'bottom-right') {
        x = width - textWidth - 30;
      }
      
      page.drawText(text, {
        x, y, size, font, color: rgb(0,0,0)
      });
    });
    const result = await doc.save();
    downloadPdf(result, 'numbered.pdf');
    showToast('페이지 번호 삽입 완료!');
    updateReport('페이지 번호 주입(PageNum)', 'numbered.pdf', result.byteLength, '총 ' + pages.length + '장의 페이지 하단에 동적 넘버링을 완료했습니다.', 'StandardFont 심볼릭 인젝션을 사용하여 가벼운 벡터 아웃라인으로 오버레이.');
  } catch (e) { showToast('오류: ' + e.message); }
  setLoading('pagenumLoading', false);
}

/* ===== METADATA ===== */
let metadataPdfBytes = null;
setupDropZone('metadataDropZone', 'metadataFileInput', async files => {
  const file = files[0];
  metadataPdfBytes = new Uint8Array(await file.arrayBuffer());
  setLoading('metadataLoading', true);
  try {
    const doc = await PDFDocument.load(metadataPdfBytes);
    document.getElementById('metaTitle').value = doc.getTitle() || '';
    document.getElementById('metaAuthor').value = doc.getAuthor() || '';
    document.getElementById('metaSubject').value = doc.getSubject() || '';
    document.getElementById('metaKeywords').value = doc.getKeywords() || '';
    document.getElementById('metadataControls').style.display = 'block';
  } catch(e) { showToast('PDF를 읽을 수 없습니다'); }
  setLoading('metadataLoading', false);
}, false);

async function doMetadata() {
  if (!metadataPdfBytes) return;
  setLoading('metadataLoading', true);
  try {
    const doc = await PDFDocument.load(metadataPdfBytes);
    doc.setTitle(document.getElementById('metaTitle').value);
    doc.setAuthor(document.getElementById('metaAuthor').value);
    doc.setSubject(document.getElementById('metaSubject').value);
    doc.setKeywords([document.getElementById('metaKeywords').value]);
    const result = await doc.save();
    downloadPdf(result, 'metadata_update.pdf');
    showToast('메타데이터 저장 완료!');
    updateReport('메타데이터 편집(Set Attributes)', 'metadata_update.pdf', result.byteLength, '입력하신 속성 프로퍼티로 시스템 메타 영역을 리바인드했습니다.', 'Document Dictionary에 직접 텍스트 스트링을 Inject.');
  } catch(e) { showToast('오류: ' + e.message); }
  setLoading('metadataLoading', false);
}

/* ===== BLANK PAGE ===== */
let blankPdfBytes = null;
let blankPageTotal = 0;
setupDropZone('blankDropZone', 'blankFileInput', async files => {
  const file = files[0];
  blankPdfBytes = new Uint8Array(await file.arrayBuffer());
  setLoading('blankLoading', true);
  try {
    const doc = await PDFDocument.load(blankPdfBytes);
    blankPageTotal = doc.getPageCount();
    document.getElementById('blankPageCount').textContent = blankPageTotal;
    document.getElementById('blankControls').style.display = 'block';
  } catch(e) { showToast('PDF를 읽을 수 없습니다'); }
  setLoading('blankLoading', false);
}, false);

async function doBlank() {
  if (!blankPdfBytes) return;
  const str = document.getElementById('blankPositions').value;
  const positions = parseRange(str, blankPageTotal);
  if (!positions.length) return showToast('빈 페이지를 넣을 번호를 지정하세요.');
  setLoading('blankLoading', true);
  try {
    const doc = await PDFDocument.load(blankPdfBytes);
    // Insert back to front to preserve index alignment!
    const toInsert = positions.sort((a,b) => b - a);
    const pages = doc.getPages();
    let sampleSize = [595.28, 841.89]; // A4
    if(pages.length > 0) {
      const sz = pages[0].getSize();
      sampleSize = [sz.width, sz.height];
    }
    
    for (const p of toInsert) {
      doc.insertPage(p, sampleSize);
    }
    const result = await doc.save();
    downloadPdf(result, 'inserted.pdf');
    showToast('빈 페이지 삽입 완료!');
    updateReport('빈 페이지 주입(Insert Page)', 'inserted.pdf', result.byteLength, `총 ${toInsert.length}장의 빈 페이지가 삽입되었습니다.`, `인접한 페이지의 Dimensions(${Math.round(sampleSize[0])}x${Math.round(sampleSize[1])})를 계승(Inherit)한 투명 캔버스 레이어를 Page Tree에 할당.`);
  } catch(e){ showToast('오류: ' + e.message); }
  setLoading('blankLoading', false);
}
/* ===== Reset All Reset ===== */
"""

html_content = html_content.replace("/* ===== Reset ===== */", js_addition + "\n/* ===== Reset ===== */")

reset_old = """function resetAll() {
  mergeFiles = [];
  splitPdfBytes = null; splitPageTotal = 0;
  rotatePdfBytes = null; rotateAngles = [];
  reorderPdfBytes = null; reorderPages = [];
"""
reset_new = """function resetAll() {
  mergeFiles = [];
  splitPdfBytes = null; splitPageTotal = 0;
  rotatePdfBytes = null; rotateAngles = [];
  reorderPdfBytes = null; reorderPages = [];
  deletePdfBytes = null; deletePageTotal = 0;
  img2pdfFiles = [];
  pagenumPdfBytes = null;
  metadataPdfBytes = null;
  blankPdfBytes = null; blankPageTotal = 0;
"""
html_content = html_content.replace(reset_old, reset_new)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(html_content)

print("Update Successful.")
