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

  // sparkline SVG path from array of values
  function sparkPath(values, w, h){
    if(!values || !values.length) return '';
    var min = Math.min.apply(null, values);
    var max = Math.max.apply(null, values);
    var range = max - min || 1;
    var step = w / Math.max(values.length - 1, 1);
    var pts = values.map(function(v, i){
      var x = i * step;
      var y = h - ((v - min) / range) * h;
      return x.toFixed(1)+' '+y.toFixed(1);
    });
    return 'M' + pts.join(' L');
  }

  function changeLabel(item){
    switch(item.change){
      case 'up':   return '▲ ' + (item.delta || '');
      case 'down': return '▼ ' + Math.abs(item.delta || 0);
      case 'new':  return 'NEW';
      case 'flat': default: return '—';
    }
  }
  function changeClass(c){
    return ({ up:'ch-up', down:'ch-down', new:'ch-new', flat:'ch-flat' })[c] || 'ch-flat';
  }
  function changeColor(c){
    return ({ up:'#fb7185', down:'#7dd3fc', new:'#3ed6ba', flat:'#94a3b8' })[c] || '#94a3b8';
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
    var items = (trends.items || []).slice().sort(function(a,b){ return a.rank - b.rank; });
    if(!items.length) return;

    var top = items[0];
    var rest = items.slice(1, 10);
    var topMap = resolve(top.keyword);

    var spotPath = sparkPath(top.sparkline || [], 240, 50);

    var spot =
      '<article class="spot">'+
        '<div class="spot-rank">'+ pad(top.rank) +'</div>'+
        '<div class="spot-body">'+
          '<div class="spot-meta">'+
            (top.change==='new'
              ? '<span class="badge-new">NEW</span>'
              : '<span class="badge-rise">'+ escapeHTML(changeLabel(top)) +' ranks</span>')+
            (top.growth24h ? '<span>지난 24시간 '+ escapeHTML(top.growth24h) +' 검색량</span>' : '')+
          '</div>'+
          '<h2 class="spot-kw">'+ escapeHTML(top.keyword) +'</h2>'+
          '<div class="spot-spark">'+
            '<svg viewBox="0 0 240 54" preserveAspectRatio="none" aria-hidden="true">'+
              '<defs><linearGradient id="spotGradJ" x1="0" x2="0" y1="0" y2="1">'+
                '<stop offset="0%" stop-color="#3ed6ba" stop-opacity=".6"/>'+
                '<stop offset="100%" stop-color="#3ed6ba" stop-opacity="0"/>'+
              '</linearGradient></defs>'+
              '<path d="'+ spotPath +'" fill="none" stroke="#3ed6ba" stroke-width="2.5" stroke-linecap="round"/>'+
              '<path d="'+ spotPath +' L240 54 L0 54 Z" fill="url(#spotGradJ)"/>'+
            '</svg>'+
            '<div class="spot-stats">'+
              (top.growth24h ? '<span>24h <b>'+ escapeHTML(top.growth24h) +'</b></span>' : '')+
            '</div>'+
          '</div>'+
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

    var rows = rest.map(function(it){
      var path = sparkPath(it.sparkline || [], 80, 18);
      var stroke = changeColor(it.change);
      var nb = it.change==='new' ? '<span class="nb">NEW</span>' : '';
      var topCls = it.rank <= 3 ? ' t' : '';
      return '<li class="ri'+topCls+'">'+
        '<span class="rk">'+ it.rank +'</span>'+
        '<a class="kw" href="#"><span>'+ escapeHTML(it.keyword) +'</span>'+ nb +'</a>'+
        '<span class="spk"><svg viewBox="0 0 80 22" preserveAspectRatio="none">'+
          '<path d="'+ path +'" fill="none" stroke="'+ stroke +'" stroke-width="1.8" stroke-linecap="round"/>'+
        '</svg></span>'+
        '<span class="ch '+ changeClass(it.change) +'">'+ escapeHTML(changeLabel(it)) +'</span>'+
      '</li>';
    }).join('');

    var list = '<ol class="rank-list" aria-label="2위~10위 키워드">'+ rows +'</ol>';
    root.innerHTML = spot + list;
  }

  // ---------- INDEX: keyword mapping cards ----------
  function renderKwMapping(root, trends, resolve){
    if(!root) return;
    var items = (trends.items || []).slice(0, 3);
    if(!items.length) return;
    var html = items.map(function(it){
      var map = resolve(it.keyword);
      var art = map.article;
      var tool = map.tool;
      if(!art) return '';
      var thumb = '<div class="ph-fill">'+ escapeHTML(art.thumbnailLabel || art.tag || '') +'</div>';
      if(art.thumbnail){
        thumb = '<img src="'+ escapeHTML(art.thumbnail) +'" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"/>';
      }
      var chCls = it.change==='new' ? 'new' : (it.change==='up' ? 'up' : '');
      return '<a class="kw-card" href="'+ escapeHTML(art.url) +'">'+
        '<div class="kw-hd"><span class="rk">#'+ it.rank +'</span><span class="kw">'+ escapeHTML(it.keyword) +'</span>'+
          '<span class="ch '+ chCls +'">'+ escapeHTML(changeLabel(it)) +'</span></div>'+
        '<div class="thumb">'+ thumb +'</div>'+
        '<div class="body">'+
          '<span class="tag">'+ escapeHTML(art.tag || '') +'</span>'+
          '<h3>'+ escapeHTML(art.title) +'</h3>'+
          '<p>'+ escapeHTML(art.summary || '') +'</p>'+
        '</div>'+
        (tool
          ? '<div class="related-tool"><div class="ic">'+ escapeHTML(tool.icon||'') +'</div>'+
              '<div><b>'+ escapeHTML(tool.name) +'</b></div><span class="arr">바로 →</span></div>'
          : '')+
      '</a>';
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
    var items = (trends.items || []).slice().sort(function(a,b){ return a.rank - b.rank; });
    roots.forEach(function(root){
      var limit = parseInt(root.getAttribute('data-limit') || '7', 10);
      var slice = items.slice(0, limit);
      root.innerHTML = slice.map(function(it){
        var topCls = it.rank <= 3 ? ' top' : '';
        return '<li>'+
          '<span class="rk'+topCls+'">'+ it.rank +'</span>'+
          '<span class="kw">'+ escapeHTML(it.keyword) +'</span>'+
          '<span class="ch '+ changeClass(it.change) +'">'+ escapeHTML(changeLabel(it)) +'</span>'+
        '</li>';
      }).join('');
    });
  }

  // ---------- update timestamps ----------
  function updateMeta(trends){
    var meta = trends.last_updated || new Date().toISOString();
    var rel = fmtRelative(meta);
    var heroMeta = $('#heroMeta');
    if(heroMeta && rel) heroMeta.textContent = rel + ' 갱신 · 매 '+ (trends.refresh_minutes||10) +'분';
    var sideMeta = $('#sideMeta');
    if(sideMeta && rel) sideMeta.textContent = rel.split('·').pop().trim();
    var tickerMeta = $('#tickerMeta');
    if(tickerMeta && rel) tickerMeta.textContent = rel.split('·').pop().trim() + ' 갱신';
  }

  // ---------- boot ----------
  function load(url){
    return fetch(url, { cache: 'no-cache' }).then(function(r){
      if(!r.ok) throw new Error(url + ' ' + r.status);
      return r.json();
    });
  }

  // Resolve base path so /blog/, /blog/index.html, /blog/article.html, and
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
      // Silent: leave static fallback HTML alone. Still update timestamps to "now".
      console.warn('[blog] data load failed, keeping static fallback:', err.message);
    });
})();
