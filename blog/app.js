/*!
 * 티모집사 가이드 — blog renderer
 * Loads data/trends.json, data/articles.json, data/mapping.json and hydrates
 * elements marked with [data-render="..."]. If any fetch fails the static
 * HTML fallback inside the element stays put — no broken page.
 */
(function(){
  'use strict';

  // ---------- helpers ----------
  function $(sel, root){ return (root||document).querySelector(sel); }
  function $$(sel, root){ return Array.from((root||document).querySelectorAll(sel)); }
  function escapeHTML(s){ return String(s||'').replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function pad(n){ return n<10? '0'+n : ''+n; }

  function fmtRelative(iso){
    if(!iso) return '';
    var d = new Date(iso);
    if(isNaN(d.getTime())) return '';
    return pad(d.getMonth()+1)+'.'+pad(d.getDate())+' · '+pad(d.getHours())+':'+pad(d.getMinutes());
  }
  function fmtDate(iso){
    if(!iso) return '';
    var d = new Date(iso);
    if(isNaN(d.getTime())) return iso;
    return pad(d.getMonth()+1)+'.'+pad(d.getDate());
  }
  function refreshLabel(policy){
    if(policy === 'manual_on_release') return '배포 전 수동 갱신';
    return '갱신 방식 미표시';
  }

  function itemPosition(item, index){
    var value = Number(item && item.position);
    return Number.isFinite(value) && value > 0 ? value : index + 1;
  }
  function originLabel(item){
    if(item && item.origin === 'google_suggest') return '검색 제안';
    if(item && item.origin === 'editorial_fallback') return '편집 추천';
    return '출처 미표시';
  }

  // ---------- mapping resolver ----------
  function makeResolver(mapping, articlesById){
    var direct = mapping.keyword_to_content || {};
    var contains = mapping.contains_fallback || [];
    var tools = mapping.tools || {};

    return function resolve(keyword){
      var hit = direct[keyword];
      if(!hit){
        for(var i=0;i<contains.length;i++){
          if(keyword.indexOf(contains[i].match) !== -1){ hit = contains[i]; break; }
        }
      }
      if(!hit) return { article:null, tool:null };
      var article = hit.article ? articlesById[hit.article] : null;
      var tool = hit.tool ? tools[hit.tool] : null;
      return { article: article || null, tool: tool || null };
    };
  }

  // ---------- INDEX: trend spotlight + list ----------
  function renderTrendHero(root, trends, resolve){
    if(!root) return;
    var items = (trends.items || []).slice().sort(function(a,b){ return itemPosition(a, 0) - itemPosition(b, 0); });
    if(!items.length) return;

    var top = items[0];
    var rest = items.slice(1, 10);
    var topMap = resolve(top.keyword);

    var topPosition = itemPosition(top, 0);

    var spot =
      '<article class="spot">'+
        '<div class="spot-rank">'+ pad(topPosition) +'</div>'+
        '<div class="spot-body">'+
          '<div class="spot-meta">'+
            '<span class="badge-new">'+ escapeHTML(originLabel(top)) +'</span>'+
            '<span>검색량 순위가 아닌 주제 목록</span>'+
          '</div>'+
          '<h2 class="spot-kw">'+ escapeHTML(top.keyword) +'</h2>'+
          '<div class="spot-cta">'+
            (topMap.article
              ? '<a href="'+ escapeHTML(topMap.article.url) +'" class="primary">관련 가이드 읽기 →</a>'
              : '')+
            (topMap.tool
              ? '<a href="'+ escapeHTML(topMap.tool.url) +'" class="ghost">'+ escapeHTML(topMap.tool.icon||'') +' '+ escapeHTML(topMap.tool.name) +'</a>'
              : '')+
          '</div>'+
        '</div>'+
      '</article>';

    var rows = rest.map(function(it, index){
      var position = itemPosition(it, index + 1);
      var map = resolve(it.keyword);
      var href = (map.article && map.article.url) || (map.tool && map.tool.url) || '';
      var keywordNode = href
        ? '<a class="kw" href="'+ escapeHTML(href) +'"><span>'+ escapeHTML(it.keyword) +'</span></a>'
        : '<span class="kw" aria-disabled="true"><span>'+ escapeHTML(it.keyword) +'</span></span>';
      return '<li class="ri">'+
        '<span class="rk">'+ position +'</span>'+
        keywordNode+
        '<span class="ch ch-flat">'+ escapeHTML(href ? originLabel(it) : '관련 콘텐츠 없음') +'</span>'+
      '</li>';
    }).join('');

    var list = '<ol class="rank-list" aria-label="검색 주제 2~10">'+ rows +'</ol>';
    root.innerHTML = spot + list;
  }

  // ---------- INDEX: keyword mapping cards ----------
  function renderKwMapping(root, trends, resolve){
    if(!root) return;
    var seenArticles = {};
    var items = [];
    (trends.items || []).some(function(item){
      var mapped = resolve(item.keyword);
      var articleUrl = mapped.article && mapped.article.url;
      if(!articleUrl || seenArticles[articleUrl]) return false;
      seenArticles[articleUrl] = true;
      items.push(item);
      return items.length >= 3;
    });
    if(!items.length) return;
    var html = items.map(function(it, index){
      var map = resolve(it.keyword);
      var art = map.article;
      var tool = map.tool;
      if(!art) return '';
      var thumb = '<div class="ph-fill">'+ escapeHTML(art.thumbnailLabel || art.tag || '') +'</div>';
      if(art.thumbnail){
        thumb = '<img src="'+ escapeHTML(art.thumbnail) +'" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"/>';
      }
      return '<article class="kw-card">'+
        '<a class="article-link" href="'+ escapeHTML(art.url) +'">'+
          '<div class="kw-hd"><span class="rk">주제 '+ itemPosition(it, index) +'</span><span class="kw">'+ escapeHTML(it.keyword) +'</span></div>'+
          '<div class="thumb">'+ thumb +'</div>'+
          '<div class="body">'+
            '<span class="tag">'+ escapeHTML(art.tag || '') +'</span>'+
            '<h3>'+ escapeHTML(art.title) +'</h3>'+
            '<p>'+ escapeHTML(art.summary || '') +'</p>'+
          '</div>'+
        '</a>'+
        (tool
          ? '<a class="related-tool" href="'+ escapeHTML(tool.url) +'"><div class="ic">'+ escapeHTML(tool.icon||'') +'</div>'+
              '<div><b>'+ escapeHTML(tool.name) +'</b></div><span class="arr">바로 →</span></a>'
          : '')+
      '</article>';
    }).join('');
    if(html) root.innerHTML = html;
  }

  // ---------- INDEX: smart tools auto-recommended ----------
  function renderSmartTools(root, trends, mapping){
    if(!root) return;
    var direct = mapping.keyword_to_content || {};
    var contains = mapping.contains_fallback || [];
    var tools = mapping.tools || {};
    var items = trends.items || [];
    var seen = {};
    var picks = [];
    items.forEach(function(it){
      if(picks.length >= 4) return;
      var hit = direct[it.keyword];
      if(!hit){
        for(var i=0;i<contains.length;i++){
          if(it.keyword.indexOf(contains[i].match) !== -1){ hit = contains[i]; break; }
        }
      }
      if(!hit || !hit.tool || seen[hit.tool]) return;
      var tool = tools[hit.tool];
      if(!tool) return;
      seen[hit.tool] = true;
      picks.push({ tool: tool, via: it.keyword });
    });
    if(!picks.length) return;
    var html = picks.map(function(p){
      var icCls = p.tool.color === 'teal' ? 'ic teal' : (p.tool.color === 'warn' ? 'ic warn' : 'ic');
      return '<a class="stool" href="'+ escapeHTML(p.tool.url) +'">'+
        '<div class="'+ icCls +'">'+ escapeHTML(p.tool.icon||'') +'</div>'+
        '<b>'+ escapeHTML(p.tool.name) +'</b>'+
        '<span>'+ escapeHTML(p.tool.desc || '') +'</span>'+
        '<span class="via">"'+ escapeHTML(p.via) +'" 키워드에서</span>'+
      '</a>';
    }).join('');
    root.innerHTML = html;
  }

  // ---------- INDEX: article stream ----------
  function renderArticleStream(root, articles){
    if(!root) return;
    if(!articles || !articles.length) return;
    var tagColorClass = function(cat){
      if(/고양이|반려/.test(cat||'')) return 'teal';
      if(/금융|구독|생활/.test(cat||'')) return 'warn';
      return '';
    };
    var html = articles.map(function(a){
      var sz = a.size || 'med';
      var tagCls = 'tag ' + tagColorClass(a.category);
      var thumb = a.thumbnail
        ? '<img src="'+ escapeHTML(a.thumbnail) +'" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"/>'
        : '<div class="ph-fill '+ (tagColorClass(a.category)==='warn'?'warn':(tagColorClass(a.category)==='teal'?'':'blue')) +'">'+ escapeHTML(a.thumbnailLabel || a.tag || '') +'</div>';
      return '<a href="'+ escapeHTML(a.url) +'" class="scard '+ sz +'">'+
        '<div class="thumb">'+ thumb +'</div>'+
        '<div class="body">'+
          '<span class="'+ tagCls +'">'+ escapeHTML(a.tag || '') +'</span>'+
          '<h4>'+ escapeHTML(a.title) +'</h4>'+
          (a.summary ? '<p>'+ escapeHTML(a.summary) +'</p>' : '')+
          '<div class="meta"><span>'+ escapeHTML(a.author||'') +' · '+ fmtDate(a.date) +'</span>'+
            (a.readMinutes ? '<span class="read">'+ a.readMinutes +'분</span>' : '')+
          '</div>'+
        '</div>'+
      '</a>';
    }).join('');
    root.innerHTML = html;
  }

  // ---------- ARTICLE: sidebar trends ----------
  function renderSidebarTrends(roots, trends){
    if(!roots.length) return;
    var items = (trends.items || []).slice().sort(function(a,b){ return itemPosition(a, 0) - itemPosition(b, 0); });
    roots.forEach(function(root){
      var limit = parseInt(root.getAttribute('data-limit') || '7', 10);
      var slice = items.slice(0, limit);
      root.innerHTML = slice.map(function(it, index){
        var position = itemPosition(it, index);
        return '<li>'+
          '<span class="rk">'+ position +'</span>'+
          '<span class="kw">'+ escapeHTML(it.keyword) +'</span>'+
          '<span class="ch ch-flat">'+ escapeHTML(originLabel(it)) +'</span>'+
        '</li>';
      }).join('');
    });
  }

  // ---------- update timestamps ----------
  function updateMeta(trends){
    var meta = trends.last_updated || '';
    var rel = fmtRelative(meta);
    var heroMeta = $('#heroMeta');
    if(heroMeta && rel) heroMeta.textContent = rel + ' 데이터 변경 · ' + refreshLabel(trends.refresh_policy);
    var sideMeta = $('#sideMeta');
    if(sideMeta && rel) sideMeta.textContent = rel.split('·').pop().trim();
    var tickerMeta = $('#tickerMeta');
    if(tickerMeta && rel) tickerMeta.textContent = rel.split('·').pop().trim() + ' 데이터';
  }

  // ---------- boot ----------
  function load(url){
    return fetch(url, { cache: 'no-cache' }).then(function(r){
      if(!r.ok) throw new Error(url + ' ' + r.status);
      return r.json();
    });
  }

  // Resolve base path so /blog/, /blog/index.html, and
  // /blog/<slug>/index.html all find the same data/ folder.
  function dataBase(){
    var path = location.pathname.replace(/\/+$/,'/');
    // strip trailing filename
    path = path.replace(/[^\/]+\.html?$/i, '');
    // ensure trailing slash
    if(!/\/$/.test(path)) path += '/';
    // if we are inside a subfolder of /blog/, walk up to /blog/
    var idx = path.indexOf('/blog/');
    if(idx >= 0) return path.substring(0, idx + '/blog/'.length) + 'data/';
    return path + 'data/';
  }

  var base = dataBase();

  Promise.all([ load(base+'trends.json'), load(base+'articles.json'), load(base+'mapping.json') ])
    .then(function(res){
      var trends = res[0], articles = res[1], mapping = res[2];
      var byId = {}; articles.forEach(function(a){ byId[a.id] = a; });
      var resolve = makeResolver(mapping, byId);

      // INDEX renders
      renderTrendHero($('[data-render="trend-spotlight-grid"]'), trends, resolve);
      renderKwMapping($('[data-render="kw-mapping"]'), trends, resolve);
      renderSmartTools($('[data-render="smart-tools"]'), trends, mapping);
      renderArticleStream($('[data-render="article-stream"]'), articles);

      // ARTICLE renders
      renderSidebarTrends($$('[data-render="sidebar-trends"]'), trends);

      updateMeta(trends);
    })
    .catch(function(err){
      // Silent: leave static fallback HTML and its original timestamp unchanged.
      console.warn('[blog] data load failed, keeping static fallback:', err.message);
    });
})();
