import os
import re

file_path = r"c:\Users\arasoftGJ_01\MyProjects\teemoZipsa\special-chars\en\pdf-tool\index.html"

with open(file_path, "r", encoding="utf-8") as f:
    html_content = f.read()

# 1. Update CSS .mode-tab
html_content = html_content.replace(
    ".mode-tab{flex:1;padding:10px;text-align:center;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s;color:var(--text-info);background:transparent;border:none;font-family:inherit}",
    ".mode-tab{flex:0 0 auto;padding:10px 16px;text-align:center;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s;color:var(--text-info);background:transparent;border:none;font-family:inherit;white-space:nowrap;}"
)

# 2. Add 5 tags to .mode-tabs
tags_block_old = """    <div class="mode-tabs">
      <button class="mode-tab active" data-tab="merge">📎 <span class="tab-label">Merge</span></button>
      <button class="mode-tab" data-tab="split">✂️ <span class="tab-label">Split</span></button>
      <button class="mode-tab" data-tab="rotate">🔄 <span class="tab-label">Rotate</span></button>
      <button class="mode-tab" data-tab="reorder">↕️ <span class="tab-label">Reorder</span></button>
      <button class="mode-tab" data-tab="watermark">💧 <span class="tab-label">Watermark</span></button>
    </div>"""
    
tags_block_new = """    <div class="mode-tabs">
      <button class="mode-tab active" data-tab="merge">📎 <span class="tab-label">Merge</span></button>
      <button class="mode-tab" data-tab="split">✂️ <span class="tab-label">Split</span></button>
      <button class="mode-tab" data-tab="rotate">🔄 <span class="tab-label">Rotate</span></button>
      <button class="mode-tab" data-tab="reorder">↕️ <span class="tab-label">Reorder</span></button>
      <button class="mode-tab" data-tab="watermark">💧 <span class="tab-label">Watermark</span></button>
      <button class="mode-tab" data-tab="delete">🗑️ <span class="tab-label">Delete Pages</span></button>
      <button class="mode-tab" data-tab="img2pdf">🖼️ <span class="tab-label">Images to PDF</span></button>
      <button class="mode-tab" data-tab="pagenum">🔢 <span class="tab-label">Page Numbers</span></button>
      <button class="mode-tab" data-tab="metadata">📝 <span class="tab-label">Metadata</span></button>
      <button class="mode-tab" data-tab="blank">📄 <span class="tab-label">Blank Page</span></button>
    </div>"""

if tags_block_old in html_content:
    html_content = html_content.replace(tags_block_old, tags_block_new)
else:
    print("Tags block not found!")

# 3. Add the 5 panels
new_panels = """    <!-- Delete Panel -->
    <div class="tab-panel" id="deletePanel">
      <div class="drop-zone" id="deleteDropZone">
        <div class="icon">📁</div>
        <div class="text">Click or Drag PDF files here</div>
        <div class="sub">Processed locally, no server upload</div>
        <input type="file" accept=".pdf" id="deleteFileInput">
      </div>
      <div class="info-bar" id="deleteInfo" style="display:none;margin-top:12px">
        📄 Total <span class="highlight" id="deletePageCount">0</span> pages
      </div>
      <div class="field-group" id="deleteRangeGroup" style="display:none;margin-top:12px">
        <div class="field-label">🗑️ Enter Page Numbers to Delete</div>
        <input type="text" class="field-input" id="deleteRange" placeholder="e.g: 3, 5-7 (comma separated)">
      </div>
      <button class="btn btn-primary" id="deleteBtn" style="display:none" onclick="doDelete()">🗑️ Delete Pages</button>
      <div class="loading" id="deleteLoading"><span class="spinner"></span>Processing...</div>
    </div>

    <!-- Image to PDF Panel -->
    <div class="tab-panel" id="img2pdfPanel">
      <div class="drop-zone" id="img2pdfDropZone">
        <div class="icon">📁</div>
        <div class="text">Click or Drag image files here</div>
        <div class="sub">Supports JPG, PNG, WebP · Drag to reorder</div>
        <input type="file" accept="image/jpeg, image/png, image/webp" multiple id="img2pdfFileInput">
      </div>
      <div class="file-list" id="img2pdfFileList"></div>
      <button class="btn btn-primary" id="img2pdfBtn" style="display:none" onclick="doImgToPdf()">🖼️ Convert to PDF</button>
      <div class="loading" id="img2pdfLoading"><span class="spinner"></span>Processing...</div>
    </div>

    <!-- Page Number Panel -->
    <div class="tab-panel" id="pagenumPanel">
      <div class="drop-zone" id="pagenumDropZone">
        <div class="icon">📁</div>
        <div class="text">Click or Drag a PDF file here</div>
        <div class="sub">Processed locally, no server upload</div>
        <input type="file" accept=".pdf" id="pagenumFileInput">
      </div>
      <div id="pagenumControls" style="display:none;margin-top:12px">
        <div class="control-row">
          <label>Font Size</label>
          <input type="range" class="slider" id="pageNumSize" min="8" max="24" value="12" oninput="document.getElementById('pageNumSizeVal').textContent=this.value+'px';">
          <span class="val" id="pageNumSizeVal">12px</span>
        </div>
        <div class="control-row">
          <label>Position</label>
          <select id="pageNumPos" style="background:var(--bg-input);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);padding:6px 8px;font-size:13px;width:100%;outline:none;font-family:inherit">
            <option value="bottom-center">Bottom Center</option>
            <option value="bottom-right">Bottom Right</option>
          </select>
        </div>
        <button class="btn btn-primary" onclick="doPageNum()">✅ Apply</button>
      </div>
      <div class="loading" id="pagenumLoading"><span class="spinner"></span>Processing...</div>
    </div>

    <!-- Metadata Panel -->
    <div class="tab-panel" id="metadataPanel">
      <div class="drop-zone" id="metadataDropZone">
        <div class="icon">📁</div>
        <div class="text">Click or Drag a PDF file here</div>
        <div class="sub">Processed locally, no server upload</div>
        <input type="file" accept=".pdf" id="metadataFileInput">
      </div>
      <div id="metadataControls" style="display:none;margin-top:12px">
        <div class="field-group">
          <div class="field-label">Title</div>
          <input type="text" class="field-input" id="metaTitle">
        </div>
        <div class="field-group">
          <div class="field-label">Author</div>
          <input type="text" class="field-input" id="metaAuthor">
        </div>
        <div class="field-group">
          <div class="field-label">Subject</div>
          <input type="text" class="field-input" id="metaSubject">
        </div>
        <div class="field-group">
          <div class="field-label">Keywords</div>
          <input type="text" class="field-input" id="metaKeywords">
        </div>
        <button class="btn btn-primary" onclick="doMetadata()">✅ Save Attributes</button>
      </div>
      <div class="loading" id="metadataLoading"><span class="spinner"></span>Processing...</div>
    </div>

    <!-- Blank Page Panel -->
    <div class="tab-panel" id="blankPanel">
      <div class="drop-zone" id="blankDropZone">
        <div class="icon">📁</div>
        <div class="text">Click or Drag a PDF file here</div>
        <div class="sub">Processed locally, no server upload</div>
        <input type="file" accept=".pdf" id="blankFileInput">
      </div>
      <div id="blankControls" style="display:none;margin-top:12px">
        <div class="info-bar" style="margin-bottom:12px">
          📄 Total <span class="highlight" id="blankPageCount">0</span> pages
        </div>
        <div class="field-group">
          <div class="field-label">Insert Positions (comma separated, inserted AFTER the page)</div>
          <input type="text" class="field-input" id="blankPositions" placeholder="e.g: 2, 5 (Adds blank page after pages 2 and 5)">
        </div>
        <button class="btn btn-primary" onclick="doBlank()">✅ Insert Blanks</button>
      </div>
      <div class="loading" id="blankLoading"><span class="spinner"></span>Processing...</div>
    </div>
    
    <div class="report-container" id="reportContainer" style="display:none">
<!--report placeholder-->"""

target_str = """    <!-- Watermark Panel -->
    <div class="tab-panel" id="watermarkPanel">
      <div class="drop-zone" id="watermarkDropZone">
        <div class="icon">📁</div>
        <div class="text">Click or Drag a PDF file here</div>
        <div class="sub">Files are not sent to any server</div>
        <input type="file" accept=".pdf" id="watermarkFileInput">
      </div>
      <div id="watermarkControls" style="display:none;margin-top:12px">
        <div class="field-group">
          <div class="field-label">💧 Watermark Text</div>
          <input type="text" class="field-input" id="wmText" value="CONFIDENTIAL" maxlength="30" oninput="updateWmPreview()">
        </div>
        <div class="control-row">
          <label>Font Size</label>
          <input type="range" class="slider" id="wmSize" min="20" max="150" value="50" oninput="document.getElementById('wmSizeVal').textContent=this.value+'px'; updateWmPreview()">
          <span class="val" id="wmSizeVal">50px</span>
        </div>
        <div class="control-row">
          <label>Opacity</label>
          <input type="range" class="slider" id="wmOpacity" min="5" max="80" value="15" oninput="document.getElementById('wmOpacityVal').textContent=(this.value/100).toFixed(2); updateWmPreview()">
          <span class="val" id="wmOpacityVal">0.15</span>
        </div>
        <div class="control-row">
          <label>Angle</label>
          <input type="number" id="wmAngle" value="-45" oninput="updateWmPreview()">
          <span class="val">°</span>
        </div>
        <div class="watermark-preview" id="wmPreview"></div>
        <button class="btn btn-primary" onclick="doWatermark()">✅ Apply</button>
      </div>
      <div class="loading" id="watermarkLoading"><span class="spinner"></span>Processing...</div>
    </div>"""

html_content = html_content.replace(target_str, target_str + "\n\n" + new_panels)

# Then we need to add the report container CSS 
css_report = """
.report-container{margin-top:24px;border:1px solid rgba(167,139,250, .4);border-radius:12px;overflow:hidden;background:rgba(83,52,131, .15);animation:fadeIn .4s ease-out;display:none}
@keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.report-header{background:rgba(83,52,131, .4);padding:12px 16px;display:flex;align-items:center;gap:10px;font-weight:700;color:var(--text-on-accent)}
.report-body{padding:16px;font-size:13px;line-height:1.6;color:var(--text-secondary)}
.report-row{display:flex;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid var(--border)}
.report-row:last-child{margin-bottom:0;padding-bottom:0;border-bottom:none}
.report-label{width:110px;color:var(--text-info);font-weight:600;flex-shrink:0}
.report-value{flex:1;color:var(--text-primary);font-family:monospace;word-break:break-all}
.report-value.highlight{color:var(--accent)}
"""

html_content = html_content.replace("</style>", css_report + "\n</style>")


js_addition = """
/* ===== Dynamic Report ===== */
function updateReport(taskName, fileName, byteSize, sumTxt, techTxt) {
  document.getElementById('reportContainer').style.display = 'block';
  document.getElementById('reportContainer').innerHTML = `
    <div class="report-header">⚙️ Operation Report: ${taskName}</div>
    <div class="report-body">
      <div class="report-row"><div class="report-label">File Output</div><div class="report-value">${fileName}</div></div>
      <div class="report-row"><div class="report-label">Byte Size</div><div class="report-value">${formatSize(byteSize)}</div></div>
      <div class="report-row"><div class="report-label">Summary</div><div class="report-value highlight">${sumTxt}</div></div>
      <div class="report-row"><div class="report-label">Engine Details</div><div class="report-value" style="color:var(--text-muted);font-size:12px">${techTxt}</div></div>
    </div>
  `;
}

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
  } catch (e) { showToast('Failed to read PDF'); }
}, false);

async function doDelete() {
  if (!deletePdfBytes) return;
  const pages = parseRange(document.getElementById('deleteRange').value, deletePageTotal);
  if (!pages.length) return showToast('Please enter valid pages to delete');
  setLoading('deleteLoading', true);
  try {
    const doc = await PDFDocument.load(deletePdfBytes);
    const toRemove = pages.sort((a,b) => b - a);
    for (const p of toRemove) {
        doc.removePage(p - 1);
    }
    const result = await doc.save();
    downloadPdf(result, 'deleted.pdf');
    showToast('Pages deleted successfully!');
    updateReport('Delete Pages', 'deleted.pdf', result.byteLength, `Removed ${pages.length} outlier pages.`, 'Index reordered natively and exported as lossless byte array.');
  } catch (e) { showToast('Error: ' + e.message); }
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
    showToast('PDF conversion complete!');
    updateReport('Image to PDF', 'images.pdf', result.byteLength, `${img2pdfFiles.length} images packed into a single PDF.`, 'Adjusted via browser canvas (JPEG) and embedded directly into vector space.');
  } catch(e) {
    showToast('Error: ' + e.message);
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
  } catch (e) { showToast('Failed to load PDF'); }
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
    showToast('Page numbers added successfully!');
    updateReport('Add Page Numbers', 'numbered.pdf', result.byteLength, `Injected dynamic numbering onto ${pages.length} pages.`, 'StandardFont symbolic injection used for lightweight vector overlays.');
  } catch (e) { showToast('Error: ' + e.message); }
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
  } catch(e) { showToast('Failed to load PDF'); }
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
    showToast('Metadata saved successfully!');
    updateReport('Edit Metadata', 'metadata_update.pdf', result.byteLength, 'Re-bound system meta attributes to your properties.', 'Injecting text strings directly into the Document Dictionary.');
  } catch(e) { showToast('Error: ' + e.message); }
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
  } catch(e) { showToast('Failed to load PDF'); }
  setLoading('blankLoading', false);
}, false);

async function doBlank() {
  if (!blankPdfBytes) return;
  const str = document.getElementById('blankPositions').value;
  const positions = parseRange(str, blankPageTotal);
  if (!positions.length) return showToast('Please specify valid positions for blank pages.');
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
    showToast('Blank pages inserted successfully!');
    updateReport('Insert Blank Pages', 'inserted.pdf', result.byteLength, `${toInsert.length} blank pages added.`, `Allocated transparent canvas layers to the Page Tree, inheriting dimensions from adjacent pages.`);
  } catch(e){ showToast('Error: ' + e.message); }
  setLoading('blankLoading', false);
}
/* ===== Reset ===== */
"""

html_content = html_content.replace("/* ===== Reset ===== */", js_addition)

reset_old = """function resetAll() {
  mergeFiles = [];
  splitPdfBytes = null; splitPageTotal = 0;
  rotatePdfBytes = null; rotateAngles = [];
  reorderPdfBytes = null; reorderPages = [];
  wmPdfBytes = null;"""

reset_new = """function resetAll() {
  mergeFiles = [];
  splitPdfBytes = null; splitPageTotal = 0;
  rotatePdfBytes = null; rotateAngles = [];
  reorderPdfBytes = null; reorderPages = [];
  wmPdfBytes = null;
  deletePdfBytes = null; deletePageTotal = 0;
  img2pdfFiles = [];
  pagenumPdfBytes = null;
  metadataPdfBytes = null;
  blankPdfBytes = null; blankPageTotal = 0;"""

html_content = html_content.replace(reset_old, reset_new)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(html_content)

print("Update Successful.")
