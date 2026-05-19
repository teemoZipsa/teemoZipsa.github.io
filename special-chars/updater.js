const fs = require('fs');
const path = 'c:/Users/arasoftGJ_01/MyProjects/teemoZipsa/special-chars/pdf-tool/index.html';
let text = fs.readFileSync(path, 'utf-8');

// 1. CSS
const oldCss = `.guide-section{background:var(--bg-bar);border-radius:10px;margin:0 16px 12px;font-size:14px;overflow:hidden}
.guide-section summary{cursor:pointer;padding:14px 16px;font-weight:600;color:var(--text-secondary);list-style:none;display:flex;align-items:center;gap:6px}
.guide-section summary::-webkit-details-marker{display:none}
.guide-section summary::after{content:'▼';font-size:10px;margin-left:auto;transition:transform .2s;color:var(--text-muted)}
.guide-section[open] summary::after{transform:rotate(180deg)}
.guide-content{padding:0 16px 16px;color:var(--text-info);line-height:1.8;font-size:13px}
.guide-content strong{color:var(--text-secondary)}
.guide-content ul,.guide-content ol{margin:8px 0;padding-left:20px}
.guide-content li{margin-bottom:4px}`;

const newCss = `  /* 동적 리포트 & 가이드 표준 CSS */
  @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
  .report-box { margin-top: 20px; padding: 20px; background: var(--bg-bar); border: 1px solid var(--border); border-radius: 12px; }
  .report-box h3 { font-size: 15px; color: var(--text-primary); margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
  .report-box p { font-size: 13px; color: var(--text-secondary); line-height: 1.6; margin-bottom: 8px; }
  .report-box .highlight { color: var(--accent); font-weight: 600; }
  .guide-section { margin: 24px 12px 12px; padding: 24px 20px; background: var(--bg-bar); border-radius: 12px; border: 1px solid var(--border); }
  .guide-section h2 { font-size: 16px; font-weight: 700; color: var(--text-primary); margin-bottom: 16px; display: flex; align-items: center; gap: 8px; line-height: 1.4; }
  .guide { margin-bottom: 12px; background: var(--bg-app); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
  .guide summary { padding: 14px 16px; font-size: 14px; font-weight: 600; color: var(--text-primary); cursor: pointer; list-style: none; display: flex; justify-content: space-between; align-items: center; line-height: 1.4; }
  .guide summary::-webkit-details-marker { display: none; }
  .guide summary::after { content: '▼'; font-size: 10px; color: var(--text-muted); transition: transform 0.2s; flex-shrink: 0; }
  .guide[open] summary::after { transform: rotate(180deg); }
  .guide-content { padding: 0 16px 16px; font-size: 13px; color: var(--text-secondary); line-height: 1.6; }
  .guide-content h3 { font-size: 14px; color: var(--text-primary); margin: 12px 0 8px; }
  .guide-content p { margin-bottom: 12px; }
  .guide-content ul, .guide-content ol { padding-left: 20px; margin-bottom: 12px; }
  .guide-content li { margin-bottom: 4px; }
  .related-tools { margin-top: 24px; padding-top: 20px; border-top: 1px dashed var(--border); }
  .related-tools h3 { font-size: 14px; font-weight: 600; color: var(--text-primary); margin-bottom: 12px; }
  .tags { display: flex; flex-wrap: wrap; gap: 8px; }
  .tag { font-size: 12px; background: var(--bg-btn); color: var(--text-secondary); padding: 6px 12px; border-radius: 16px; text-decoration: none; border: 1px solid var(--border); transition: all 0.2s; }
  .tag:hover { background: var(--accent); color: #fff; border-color: var(--accent); }`;

text = text.replace(oldCss.replace(/\n/g, '\r\n'), newCss);
text = text.replace(oldCss, newCss);

// 2. HTML Replace
const oldHtml = `      <div class="loading" id="watermarkLoading"><span class="spinner"></span>처리 중...</div>
    </div>
  </div>

  <details class="guide-section">
    <summary>📖 사용 방법</summary>
    <div class="guide-content">
      <ul>
        <li><strong>📎 합치기</strong> — 여러 PDF 파일을 하나로 합칩니다. 드래그로 순서를 변경할 수 있습니다.</li>
        <li><strong>✂️ 나누기</strong> — PDF에서 원하는 페이지만 추출합니다. 범위(1-3), 개별(5), 혼합(1-3, 5, 7-10) 입력이 가능합니다.</li>
        <li><strong>🔄 회전</strong> — 각 페이지를 개별 또는 전체 회전합니다. 클릭할 때마다 90°씩 회전합니다.</li>
        <li><strong>↕️ 순서 변경</strong> — 페이지 썸네일을 드래그하여 원하는 순서로 재배치합니다.</li>
        <li><strong>💧 워터마크</strong> — 모든 페이지에 텍스트 워터마크를 추가합니다. 크기, 투명도, 각도를 조절할 수 있습니다.</li>
      </ul>
    </div>
  </details>

  <details class="guide-section">
    <summary>❓ 자주 묻는 질문</summary>
    <div class="guide-content">
      <ul>
        <li><strong>파일이 서버로 전송되나요?</strong><br>아닙니다. 모든 처리는 브라우저에서만 이루어지며, 파일이 외부로 전송되지 않습니다.</li>
        <li><strong>파일 크기 제한이 있나요?</strong><br>서버 제한은 없지만, 브라우저 메모리에 따라 매우 큰 파일(수백 MB)은 처리가 느려질 수 있습니다.</li>
        <li><strong>어떤 PDF 파일이든 지원되나요?</strong><br>대부분의 표준 PDF를 지원합니다. 암호화되거나 보호된 PDF는 처리가 제한될 수 있습니다.</li>
      </ul>
    </div>
  </details>`;

const newHtml = `      <div class="loading" id="watermarkLoading"><span class="spinner"></span>처리 중...</div>
    </div>
    
    <!-- 동적 분석 리포트 영역 -->
    <div id="reportContainer" class="report-box" style="display:none; animation: fadeIn 0.5s ease;"></div>
  </div>

  <section class="guide-section">
    <h2>💡 온라인 무료 PDF 에디터 (합치기/나누기) 완벽 활용 가이드</h2>
    
    <details class="guide" open>
      <summary>내 민감한 계약서나 증명서 PDF를 올려도 안전한가요?</summary>
      <div class="guide-content">
        <p><b>가장 중요: 100% Client-side Processing (브라우저 로컬 구동)</b></p>
        <p>온라인에 검색되는 대부분의 무료 PDF 편집 사이트들은 사용자의 파일을 그들의 클라우드 서버로 업로드하여 처리한 후 다시 다운로드하게 만듭니다. 이 경우 당신의 개인정보나 회사 기밀이 담긴 문서가 외부망에 노출될 위험이 있습니다.</p>
        <p>하지만 본 툴은 <b><code>pdf-lib.js</code> 엔진을 통해 고객님의 기기(PC/모바일) 브라우저 메모리 상에서 직접 PDF 조작</b>합니다. 파일 정보는 저희 서버로 단 한 번도 전송되지 않으며, 서버를 거치지 않기 때문에 속도 면에서도 대용량 작업에 훨씬 유리합니다. 보안이 중요한 이력서, 계약서, 법적 증명 서류도 안심하고 처리하세요.</p>
      </div>
    </details>

    <details class="guide">
      <summary>이 도구 하나로 어떤 PDF 작업들이 가능한가요?</summary>
      <div class="guide-content">
        <ul>
          <li><strong>📎 PDF 합치기 (Merge):</strong> 여러 날짜에 걸쳐 스캔된 여러 장의 PDF 파일들이나, 표지와 본문이 분리된 파일들을 드래그 앤 드롭으로 순서를 맞춰 하나의 파일로 매끄럽게 병합합니다.</li>
          <li><strong>✂️ PDF 나누기 및 분할 (Split):</strong> 방대한 분량의 전공 서적이나 보고서 중에서 내가 필요한 특정 페이지(예: 1-3, 5, 7~10) 번호만 입력하여 별도의 PDF로 깔끔하게 잘라내고 추출(Extract)합니다.</li>
          <li><strong>🔄 PDF 회전 (Rotate):</strong> 스캐너나 휴대폰으로 문서 스캔 시 거꾸로 찍히거나 옆으로 누워버린 페이지를 개별 지정하거나 일괄 선택하여 정방향(90도, 180도, 270도)으로 올바르게 세웁니다.</li>
          <li><strong>↕️ 순서 재배치 (Reorder):</strong> 뒤죽박죽 섞인 페이지의 순서를 썸네일 그리드 화면을 보면서 마우스로 간단히 끌어다 놓아(Drag & Drop) 직관적으로 배열을 교정합니다.</li>
          <li><strong>💧 워터마크 삽입 (Watermark):</strong> "CONFIDENTIAL", "외무비밀", "초안" 등의 기밀 유지용 투명 글씨 패치(Watermark)를 PDF의 모든 페이지 정중앙에 사선 다이아몬드 형태로 일괄 삽입하여 문서 도용을 방지합니다.</li>
        </ul>
      </div>
    </details>

    <details class="guide">
      <summary>왜 파일 병합이나 분할 시 깨짐이나 용량 저하가 없나요?</summary>
      <div class="guide-content">
        <p>일반적인 컨버터 툴들은 PDF를 한 번 이미지(JPG/PNG)로 렌더링(Rasterize)한 뒤 다시 PDF로 감싸는 방식을 취해 글씨가 흐려지거나 벡터 속성이 파괴되는 단점이 있습니다.</p>
        <p>당사의 편집 엔진은 <b>원본 PDF의 바이트(Byte) 배열과 내부 오브젝트 트리(Cross-Reference Table) 수준을 직접 재구성(Re-indexing)</b>하므로, 문서 안에 박혀있는 텍스트 복사(DRM 등 제한 없는 경우)와 원본 이미지 압축 품질, 폰트 임베딩 등 메타데이터가 단 1%의 손실 없이 원형 그대로 유지되는 무손실(Lossless) 조작을 보장합니다.</p>
      </div>
    </details>

    <div class="related-tools">
      <h3>🛠️ 연관된 사무 및 디자인 툴</h3>
      <div class="tags">
        <a href="/special-chars/calculators/" class="tag">일상 생활 계산기</a>
        <a href="/special-chars/word-count/" class="tag">글자수 세기 & 텍스트 검사기</a>
        <a href="/special-chars/image-compress/" class="tag">초고속 이미지 압축기</a>
        <a href="/special-chars/image-format-converter/" class="tag">이미지 WebP 변환기</a>
      </div>
    </div>
  </section>`;

text = text.replace(oldHtml.replace(/\n/g, '\r\n'), newHtml);
text = text.replace(oldHtml, newHtml);

// 3. Tab Script Replace
const oldTab = `document.querySelectorAll('.mode-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(tab.dataset.tab + 'Panel').classList.add('active');
  });
});`;
const newTab = `document.querySelectorAll('.mode-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(tab.dataset.tab + 'Panel').classList.add('active');
    const rep = document.getElementById('reportContainer');
    if(rep) rep.style.display = 'none';
  });
});`;
text = text.replace(oldTab.replace(/\n/g, '\r\n'), newTab);
text = text.replace(oldTab, newTab);

// 4. FormatSize and Report
const oldFuncs = `function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function setLoading(id, show) {
  document.getElementById(id).classList.toggle('show', show);
}`;
const newFuncs = `function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function setLoading(id, show) {
  document.getElementById(id).classList.toggle('show', show);
}

function updateReport(title, filename, bytesSize, descriptionStr, highlightStr) {
  const container = document.getElementById('reportContainer');
  if (!container) return;
  container.style.display = 'block';
  container.innerHTML = \`
    <h3>🚀 \${title} 완료 리포트</h3>
    <p><b>출력 파일명:</b> \${filename}</p>
    <p><b>최종 데이터 크기:</b> <span class="highlight">\${formatSize(bytesSize)}</span></p>
    <p><b>처리 내역:</b> \${descriptionStr}</p>
    <div style="margin-top:12px; padding-top:12px; border-top:1px dashed var(--border);">
      <p style="margin-bottom:0; color:var(--text-info);">💡 <b>테크니컬 스펙:</b> \${highlightStr}</p>
    </div>
  \`;
}`;
text = text.replace(oldFuncs.replace(/\n/g, '\r\n'), newFuncs);
text = text.replace(oldFuncs, newFuncs);

// 5. Operations
text = text.replace(/const result = await merged\.save\(\);[\r\n]+ *downloadPdf\(result, 'merged\.pdf'\);[\r\n]+ *showToast\('합치기 완료!'\);[\r\n]+ *\} catch \(e\) \{/,
`const result = await merged.save();
    downloadPdf(result, 'merged.pdf');
    showToast('합치기 완료!');
    updateReport(
      'PDF 파일 합치기(Merge)', 
      'merged.pdf', 
      result.byteLength, 
      \`총 \${mergeFiles.length}개의 개별 PDF 파일들을 바이너리 스트림으로 병합하여 단일 문서로 패키징했습니다.\`,
      \`본 합치기 도구는 문서 내 텍스트, 이미지 폰트를 재렌더링하지 않고 페이지 트리(Page Tree) 구조만 이식하기 때문에 원래의 고품질 화질과 텍스트 복사 기능이 100% 무손실 리다이렉트 됩니다.\`
    );
  } catch (e) {`);

text = text.replace(/const result = await out\.save\(\);[\r\n]+ *downloadPdf\(result, 'split\.pdf'\);[\r\n]+ *showToast\('나누기 완료! \(' \+ pages\.length \+ '페이지\)'\);[\r\n]+ *\} catch \(e\) \{/,
`const result = await out.save();
    downloadPdf(result, 'split.pdf');
    showToast('나누기 완료! (' + pages.length + '페이지)');
    updateReport(
      'PDF 파일 나누기(Split)', 
      'split.pdf', 
      result.byteLength, 
      \`원본 \${splitPageTotal}페이지 중 고객님이 선택하신 [\${pages.join(', ')}] 번째의 총 \${pages.length}개 페이지만을 정확히 타겟 추출하여 분리해냈습니다.\`,
      \`불필요한 페이지 데이터 쓰레기를 완전히 소거한 최적화된 바이트 배열로 추출되었으므로 이메일 첨부나 관공서 업로드용으로 매우 적합합니다.\`
    );
  } catch (e) {`);

text = text.replace(/const result = await doc\.save\(\);[\r\n]+ *downloadPdf\(result, 'rotated\.pdf'\);[\r\n]+ *showToast\('회전 적용 완료!'\);[\r\n]+ *\} catch \(e\) \{/,
`const result = await doc.save();
    downloadPdf(result, 'rotated.pdf');
    showToast('회전 적용 완료!');
    updateReport(
      'PDF 페이지 회전(Rotate)', 
      'rotated.pdf', 
      result.byteLength, 
      \`선택하신 페이지들의 시각적 방향(Orientation) 매트릭스를 회전 교정하고, 뷰어 캔버스 구조에 맞게 문서 렌더링 트리를 재정립시켰습니다.\`,
      \`단순히 이미지를 돌리는 것이 아니라 PDF 명세서의 Rotate 엔티티 정보 값을 실시간으로 변경하므로, 회전된 텍스트라도 OCR 및 복사 붙여넣기가 정상 지원됩니다.\`
    );
  } catch (e) {`);

text = text.replace(/const result = await out\.save\(\);[\r\n]+ *downloadPdf\(result, 'reordered\.pdf'\);[\r\n]+ *showToast\('순서 변경 완료!'\);[\r\n]+ *\} catch \(e\) \{/,
`const result = await out.save();
    downloadPdf(result, 'reordered.pdf');
    showToast('순서 변경 완료!');
    updateReport(
      'PDF 순서 재배치(Reorder)', 
      'reordered.pdf', 
      result.byteLength, 
      \`원본 문서의 페이지 인덱스 트리 흐름을 사용자께서 지정하신 새로운 플로우 배열([\${order.map(o => o+1).join(', ')}]) 순으로 강제 오버라이딩하여 저장했습니다.\`,
      \`브라우저 가상 렌더링 뷰를 통해 문서를 손쉽게 정리하고, 메모리상에서 내부 구조를 다이렉트로 매핑하여 재조립한 최신의 로컬 처리 결과입니다.\`
    );
  } catch (e) {`);

text = text.replace(/const result = await doc\.save\(\);[\r\n]+ *downloadPdf\(result, 'watermarked\.pdf'\);[\r\n]+ *showToast\('워터마크 적용 완료!'\);[\r\n]+ *\} catch \(e\) \{/,
`const result = await doc.save();
    downloadPdf(result, 'watermarked.pdf');
    showToast('워터마크 적용 완료!');
    updateReport(
      'PDF 워터마크 강제 삽입(Watermark)', 
      'watermarked.pdf', 
      result.byteLength, 
      \`입력하신 기밀 보안 텍스트 "\${text}" 인자를 문서 내 총 \${pages.length}장의 모든 페이지 중앙에 오버레이 렌더링하여 강제 워터마킹 처리했습니다.\`,
      \`설정된 오파시티(Opacity \${opacity})와 회전각(\${angle}도)으로 StandardFont 레이어를 최상단에 덮어씌움으로써, 타인의 무단 프린트 복제나 불법 스크린샷 캡쳐 도용을 심리적, 기술적으로 원천 차단하는 데 도움을 줍니다.\`
    );
  } catch (e) {`);

text = text.replace(/document\.getElementById\('wmAngle'\)\.value = \-45;[\r\n]+ *showToast\('초기화 완료'\);[\r\n]*\}/,
`document.getElementById('wmAngle').value = -45;
  if(document.getElementById('reportContainer')) {
    document.getElementById('reportContainer').style.display = 'none';
  }
  showToast('초기화 완료');
}`);

fs.writeFileSync(path, text, 'utf-8');
console.log('Success');
