/* =========================================================
   GLOSSY — 관리자 (admin.js)
   - data/content.json 을 폼으로 그리고 GitHub Contents API 로 커밋
   - 사진은 브라우저에서 줄여 저장소에 업로드
   - 토큰·PIN 은 이 브라우저(localStorage)에만 저장
   ========================================================= */
(function () {
  "use strict";

  var qs = new URLSearchParams(location.search);
  var OWNER = qs.get("owner") || "snow196830-stack";
  var REPO = qs.get("repo") || "glossybrow";
  var BRANCH = qs.get("branch") || "main";
  var FILE_PATH = "data/content.json";
  var API = (qs.get("api") || "https://api.github.com").replace(/\/$/, "");
  var LIVE = qs.get("live") || ("https://" + OWNER + ".github.io/" + REPO + "/data/content.json");

  var KEY_TOKEN = "glossy-admin-token";
  var KEY_TOKEN_PIN = "glossy-admin-token-pin";
  var KEY_CONTENT_V = "glossy-content-v";

  var LANGS = ["kr", "jp", "en"];
  var LANG_NAME = { kr: "한국어", jp: "日本語", en: "English" };

  var state = {
    content: null,
    pristine: null,
    token: null,
    dirty: false,
    saving: false,
    editLang: "kr",
    pendingImages: {},
    loadFailed: false
  };

  /* ---------- 도구 ---------- */
  function $(id) { return document.getElementById(id); }
  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "class") n.className = attrs[k];
        else if (k === "html") n.innerHTML = attrs[k];
        else if (k === "hidden") n.hidden = !!attrs[k];
        else n.setAttribute(k, attrs[k]);
      });
    }
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function localDate() {
    var d = new Date();
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function nowISO() { return new Date().toISOString(); }
  function fmtDate(iso) {
    if (!iso) return "기록 없음";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return d.getFullYear() + "." + p(d.getMonth() + 1) + "." + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }
  function isLangObj(v) {
    return v && typeof v === "object" && !Array.isArray(v) && ("kr" in v || "jp" in v || "en" in v);
  }
  function getPath(path) {
    var parts = String(path).split("."), cur = state.content;
    for (var i = 0; i < parts.length; i++) {
      if (cur === null || cur === undefined || typeof cur !== "object") return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }
  function setPath(path, val) {
    var parts = String(path).split("."), cur = state.content;
    for (var i = 0; i < parts.length - 1; i++) {
      if (typeof cur[parts[i]] !== "object" || cur[parts[i]] === null) cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = val;
  }
  function ensureLang(path) {
    var v = getPath(path);
    if (!isLangObj(v)) {
      v = { kr: typeof v === "string" ? v : "", jp: "", en: "" };
      setPath(path, v);
    }
    return v;
  }

  /* ---------- 상태 ---------- */
  function markDirty() {
    state.dirty = true;
    setStatus("저장되지 않은 변경사항이 있습니다", "dirty");
  }
  function setStatus(msg, kind) {
    var s = $("saveStatus");
    if (!s) return;
    s.className = "savebar__status" + (kind ? " is-" + kind : "");
    s.textContent = msg;
  }
  function setConn(ok, text) {
    var d = $("connDot");
    if (d) d.className = "dot" + (ok === true ? " is-ok" : ok === "warn" ? " is-warn" : ok === false ? " is-bad" : "");
    var t = $("connText");
    if (t) t.textContent = text;
  }
  function setGateAlert(msg, kind) {
    var box = $("gateAlert");
    if (!box) return;
    box.hidden = !msg;
    box.className = "alert" + (kind ? " is-" + kind : "");
    box.textContent = msg || "";
  }

  /* ---------- 입력 ---------- */
  function field(label, value, opts) {
    opts = opts || {};
    var wrap = el("label", { class: "field" + (opts.full ? " field--full" : "") });
    wrap.appendChild(el("span", { class: "field__label" }, label));
    var input;
    if (opts.textarea) {
      input = el("textarea", { class: "input", rows: opts.rows || 3 });
      if (opts.placeholder) input.placeholder = opts.placeholder;
      input.value = value == null ? "" : String(value);
    } else {
      input = el("input", { class: "input", type: "text" });
      if (opts.placeholder) input.placeholder = opts.placeholder;
      input.value = value == null ? "" : String(value);
    }
    input.addEventListener("input", function () {
      if (opts.onInput) opts.onInput(input.value);
      if (!opts.noDirty) markDirty();
    });
    wrap.appendChild(input);
    if (opts.note) wrap.appendChild(el("span", { class: "field__note" }, opts.note));
    return wrap;
  }

  /* 언어 객체를 지원하는 텍스트 필드 */
  function textField(label, path, opts) {
    opts = opts || {};
    var val = getPath(path);
    var isObj = isLangObj(val);
    var lang = state.editLang;
    var current = isObj ? (val[lang] != null ? val[lang] : "") : (val == null ? "" : val);
    var note = opts.note;
    if (isObj) {
      var base = val.kr || "";
      note = (note ? note + " " : "") + "[" + LANG_NAME[lang] + "] 편집 중" + (lang !== "kr" && base ? " · 비우면 한국어가 표시됩니다." : "");
    }
    return field(label, current, {
      textarea: opts.textarea,
      rows: opts.rows,
      placeholder: opts.placeholder,
      full: opts.full,
      note: note,
      onInput: function (v) {
        if (isObj) ensureLang(path)[lang] = v;
        else setPath(path, v);
      }
    });
  }

  function toggleField(label, path, note) {
    var wrap = el("label", { class: "check", style: "margin-bottom:8px" });
    var cb = el("input", { type: "checkbox" });
    cb.checked = getPath(path) !== false;
    cb.addEventListener("change", function () { setPath(path, cb.checked); markDirty(); });
    wrap.appendChild(cb);
    wrap.appendChild(el("span", null, label + (note ? " — " + note : "")));
    return wrap;
  }

  /* ---------- 이미지 ---------- */
  function imageField(item, opts) {
    opts = opts || {};
    var dir = opts.dir || "assets/gallery/";
    var maxW = opts.w || 900;
    var wrap = el("div", { class: "imgfield" });
    var preview = el("img", { class: "imgfield__preview", alt: "" });
    var raw = state.pendingImages[item.id + "|" + opts.key] || item[opts.key] || "";
    if (raw) preview.src = /^https?:|^data:/.test(raw) ? raw : "../" + raw.replace(/^\.\.?\//, "");

    var body = el("div", { class: "imgfield__body" });
    var pathInput = el("input", { class: "input", type: "text", placeholder: dir + "새사진.jpg" });
    pathInput.value = item[opts.key] || "";
    pathInput.addEventListener("input", function () {
      item[opts.key] = pathInput.value.trim();
      if (/^https?:|^data:/.test(item[opts.key])) preview.src = item[opts.key];
      else if (item[opts.key]) preview.src = "../" + item[opts.key].replace(/^\.\.?\//, "");
      markDirty();
    });

    var actions = el("div", { class: "imgfield__actions" });
    var fileLabel = el("label", { class: "btn btn--sm" }, "사진 선택");
    var file = el("input", { type: "file", accept: "image/*" });
    file.hidden = true;
    file.style.display = "none";
    fileLabel.appendChild(file);
    fileLabel.style.cursor = "pointer";
    actions.appendChild(fileLabel);

    var clear = el("button", { class: "btn btn--sm", type: "button" }, "사진 비우기");
    clear.addEventListener("click", function () {
      delete state.pendingImages[item.id + "|" + opts.key];
      item[opts.key] = "";
      pathInput.value = "";
      preview.removeAttribute("src");
      markDirty();
    });
    actions.appendChild(clear);

    file.addEventListener("change", function () {
      var f = file.files && file.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          var cw = Math.min(maxW, img.width);
          var ch = Math.round(img.height * cw / img.width);
          var canvas = document.createElement("canvas");
          canvas.width = cw; canvas.height = ch;
          canvas.getContext("2d").drawImage(img, 0, 0, cw, ch);
          var data = canvas.toDataURL("image/jpeg", 0.86);
          state.pendingImages[item.id + "|" + opts.key] = data;
          preview.src = data;
          if (!item[opts.key] || !new RegExp("^" + dir).test(item[opts.key])) {
            var safe = String(item.id || "img").replace(/[^a-z0-9_-]/gi, "");
            item[opts.key] = dir + safe + (opts.key === "image" ? "" : "-" + opts.key) + ".jpg";
            pathInput.value = item[opts.key];
          }
          markDirty();
          setStatus("사진을 준비했습니다. 저장하면 업로드됩니다.", "dirty");
        };
        img.src = String(reader.result);
      };
      reader.readAsDataURL(f);
      file.value = "";
    });

    body.appendChild(pathInput);
    body.appendChild(actions);
    body.appendChild(el("span", { class: "imgfield__hint" }, "사진을 고르면 가로 " + maxW + "px로 줄여 " + dir + " 에 올라갑니다. 또는 이미 올라간 파일 경로를 직접 적어도 됩니다."));
    wrap.appendChild(preview);
    wrap.appendChild(body);
    return wrap;
  }

  /* ---------- 목록 편집기 ---------- */
  function listEditor(cfg) {
    var wrap = el("div", { class: "list" });
    var arr = getPath(cfg.path);
    if (!Array.isArray(arr)) { arr = []; setPath(cfg.path, arr); }

    arr.forEach(function (item, i) {
      var box = el("div", { class: "item" });
      var head = el("div", { class: "item__head" });
      head.appendChild(el("span", { class: "item__no" }, String(i + 1).padStart(2, "0") + ". " + (cfg.title(item, i) || "")));
      var tools = el("div", { class: "item__tools" });
      var up = el("button", { class: "iconbtn", type: "button", title: "위로" }, "↑");
      up.disabled = i === 0;
      up.addEventListener("click", function () { arr.splice(i - 1, 0, arr.splice(i, 1)[0]); markDirty(); renderAll(); });
      var down = el("button", { class: "iconbtn", type: "button", title: "아래로" }, "↓");
      down.disabled = i === arr.length - 1;
      down.addEventListener("click", function () { arr.splice(i + 1, 0, arr.splice(i, 1)[0]); markDirty(); renderAll(); });
      var del = el("button", { class: "iconbtn", type: "button", title: "삭제" }, "✕");
      del.addEventListener("click", function () {
        if (arr.length <= (cfg.min || 0)) { setStatus("최소 " + cfg.min + "개는 남겨야 합니다.", "warn"); return; }
        if (!confirm("이 항목을 삭제할까요? (저장 전까지는 되돌릴 수 있습니다)")) return;
        arr.splice(i, 1); markDirty(); renderAll();
      });
      tools.appendChild(up); tools.appendChild(down); tools.appendChild(del);
      head.appendChild(tools);
      box.appendChild(head);

      var fields = el("div", { class: "fields" });
      cfg.cols.forEach(function (c) {
        if (c.img) {
          var opts = { key: c.k, dir: c.dir || "assets/gallery/", w: c.w || 900 };
          fields.appendChild(imageField(item, opts));
          return;
        }
        if (c.lang) {
          var val = item[c.k];
          var isObj = isLangObj(val);
          var current = isObj ? (val[state.editLang] || "") : (val || "");
          fields.appendChild(field(c.l + " [" + LANG_NAME[state.editLang] + "]", current, {
            textarea: c.textarea,
            full: c.full,
            onInput: function (v) {
              if (isObj) { item[c.k][state.editLang] = v; }
              else {
                var obj = { kr: c.langDefault || "", jp: "", en: "" };
                obj[state.editLang] = v;
                item[c.k] = obj;
              }
            }
          }));
        } else {
          fields.appendChild(field(c.l, item[c.k], {
            textarea: c.textarea,
            full: c.full,
            onInput: function (v) { item[c.k] = v; }
          }));
        }
      });
      box.appendChild(fields);
      wrap.appendChild(box);
    });

    var add = el("button", { class: "btn btn--add", type: "button" }, cfg.addLabel);
    add.addEventListener("click", function () { arr.push(cfg.factory()); markDirty(); renderAll(); });
    wrap.appendChild(add);
    return wrap;
  }

  /* 문자열 목록 (예약 주의사항 등) */
  function stringListEditor(path, label, addLabel) {
    var wrap = el("div", { class: "list" });
    var arr = getPath(path);
    if (!Array.isArray(arr)) { arr = []; setPath(path, arr); }
    arr.forEach(function (item, i) {
      var box = el("div", { class: "item" });
      var head = el("div", { class: "item__head" });
      head.appendChild(el("span", { class: "item__no" }, String(i + 1).padStart(2, "0") + ". " + label));
      var tools = el("div", { class: "item__tools" });
      var del = el("button", { class: "iconbtn", type: "button", title: "삭제" }, "✕");
      del.addEventListener("click", function () {
        if (!confirm("이 항목을 삭제할까요?")) return;
        arr.splice(i, 1); markDirty(); renderAll();
      });
      tools.appendChild(del);
      head.appendChild(tools);
      box.appendChild(head);
      var fields = el("div", { class: "fields" });
      var isObj = isLangObj(item);
      fields.appendChild(field(LANG_NAME[state.editLang] + " 문구", isObj ? (item[state.editLang] || "") : item, {
        textarea: true,
        full: true,
        onInput: function (v) {
          if (isObj) item[state.editLang] = v;
          else { var o = { kr: v, jp: "", en: "" }; arr[i] = o; }
        }
      }));
      box.appendChild(fields);
      wrap.appendChild(box);
    });
    var add = el("button", { class: "btn btn--add", type: "button" }, addLabel);
    add.addEventListener("click", function () { arr.push({ kr: "", jp: "", en: "" }); markDirty(); renderAll(); });
    wrap.appendChild(add);
    return wrap;
  }

  /* ---------- 섹션 ---------- */
  var SECTIONS = [
    {
      id: "basic",
      title: "1. 기본 · 공지",
      lead: "맨 위 띠와 가게 이름입니다.",
      render: function (box) {
        var f = el("div", { class: "fields" });
        f.appendChild(textField("브랜드 영문 (로고)", "site.name"));
        f.appendChild(textField("브랜드 한글", "site.nameKo"));
        f.appendChild(textField("한 줄 소개", "site.tagline", { full: true }));
        f.appendChild(textField("상단 공지 문구", "notice.text", { full: true, note: "맨 위 검은 띠에 나옵니다." }));
        box.appendChild(f);
      }
    },
    {
      id: "sections",
      title: "2. 보이는 영역",
      lead: "끄면 홈페이지에서 그 영역이 사라집니다. (저장 후 반영)",
      render: function (box) {
        var f = el("div");
        [
          ["about", "브랜드 소개"], ["menu", "시술·가격"], ["gallery", "갤러리"], ["reels", "릴스"],
          ["space", "공간 소개"], ["class", "수강"], ["japan", "일본 고객 안내"], ["reviews", "리뷰"],
          ["reserve", "예약 안내"], ["faq", "예약 전 안내(FAQ)"], ["visit", "오시는 길"]
        ].forEach(function (p) { f.appendChild(toggleField(p[1], "sections." + p[0])); });
        box.appendChild(f);
      }
    },
    {
      id: "hero",
      title: "3. 첫 화면",
      lead: "방문자가 가장 먼저 보는 문구입니다. 줄바꿈은 &lt;br&gt; 로 넣습니다.",
      render: function (box) {
        var f = el("div", { class: "fields" });
        f.appendChild(textField("영문 소제목", "hero.eyebrow", { full: true }));
        f.appendChild(textField("큰 제목", "hero.title", { textarea: true, rows: 3, full: true }));
        f.appendChild(textField("소개 문단", "hero.lead", { textarea: true, rows: 4, full: true }));
        f.appendChild(textField("버튼 아래 안내", "hero.note", { full: true }));
        f.appendChild(textField("배지 숫자", "hero.badgeNum"));
        f.appendChild(textField("배지 문구", "hero.badgeTxt", { note: "<br>로 줄을 바꿀 수 있습니다." }));
        f.appendChild(imageField({ id: "hero", image: getPath("hero.image") }, { key: "image", dir: "assets/", w: 1200 }));
        f.appendChild(textField("사진 설명(대체 텍스트)", "hero.imageAlt", { full: true }));
        box.appendChild(f);
        box.appendChild(el("p", { class: "card__lead", style: "margin:16px 0 6px" }, "숫자 4개"));
        box.appendChild(listEditor({
          path: "stats",
          addLabel: "+ 숫자 추가",
          min: 0,
          factory: function () { return { num: "", label: { kr: "", jp: "", en: "" } }; },
          title: function (it) { return (it.num || "") + " · " + (it.label && (it.label.kr || it.label)) || ""; },
          cols: [
            { k: "num", l: "숫자 (356)" },
            { k: "label", l: "설명 (<small>보조</small> 가능)", lang: true }
          ]
        }));
      }
    },
    {
      id: "about",
      title: "4. 브랜드 소개",
      lead: "소개 문단과 네 가지 특징, 인용 문구입니다.",
      render: function (box) {
        var f = el("div", { class: "fields" });
        f.appendChild(textField("영문 소제목", "about.eyebrow"));
        f.appendChild(textField("제목", "about.title", { textarea: true, rows: 2 }));
        f.appendChild(textField("소개 문단", "about.lead", { textarea: true, rows: 4, full: true }));
        f.appendChild(textField("인용 문구", "about.quote", { textarea: true, rows: 2, full: true }));
        f.appendChild(textField("인용 출처", "about.quoteSrc", { full: true }));
        f.appendChild(imageField({ id: "about", image: getPath("about.image") }, { key: "image", dir: "assets/", w: 900 }));
        f.appendChild(textField("사진 설명(대체 텍스트)", "about.imageAlt", { full: true }));
        f.appendChild(textField("사진 캡션", "about.caption"));
        box.appendChild(f);
        box.appendChild(listEditor({
          path: "about.pillars",
          addLabel: "+ 특징 추가",
          min: 1,
          factory: function () { return { title: { kr: "", jp: "", en: "" }, desc: { kr: "", jp: "", en: "" } }; },
          title: function (it, i) { return (it.title && (it.title.kr || it.title)) || ("특징 " + (i + 1)); },
          cols: [{ k: "title", l: "제목", lang: true }, { k: "desc", l: "설명", lang: true, textarea: true }]
        }));
      }
    },
    {
      id: "menu",
      title: "5. 시술 · 가격",
      lead: "‘그룹’이 같은 항목끼리 홈페이지에서 한 묶음으로 나옵니다. (예: 반영구 / 잔혼 커버 / 속눈썹펌)",
      render: function (box) {
        var f = el("div", { class: "fields" });
        f.appendChild(textField("영문 소제목", "menu.eyebrow"));
        f.appendChild(textField("제목", "menu.title"));
        f.appendChild(textField("섹션 소개", "menu.lead", { textarea: true, full: true }));
        f.appendChild(textField("맨 아래 안내", "menu.footnote", { textarea: true, rows: 3, full: true }));
        box.appendChild(f);
        box.appendChild(listEditor({
          path: "menu.items",
          addLabel: "+ 시술 추가",
          min: 1,
          factory: function () { return { group: { kr: "", jp: "", en: "" }, name: { kr: "", jp: "", en: "" }, desc: { kr: "", jp: "", en: "" }, price: { kr: "", jp: "", en: "" } }; },
          title: function (it, i) { return (it.name && (it.name.kr || it.name)) || ("시술 " + (i + 1)); },
          cols: [
            { k: "group", l: "그룹 (반영구 / 잔혼 커버 / 속눈썹펌)", lang: true },
            { k: "name", l: "시술 이름", lang: true },
            { k: "desc", l: "설명", lang: true, textarea: true, full: true },
            { k: "price", l: "금액 (상담 시 안내 / 44,000원)", lang: true }
          ]
        }));
      }
    },
    {
      id: "gallery",
      title: "6. 갤러리",
      lead: "사진을 누르면 크게 볼 수 있습니다. 사진은 8장 안팎이 보기 좋습니다.",
      render: function (box) {
        var f = el("div", { class: "fields" });
        f.appendChild(textField("영문 소제목", "gallery.eyebrow"));
        f.appendChild(textField("제목", "gallery.title"));
        f.appendChild(textField("섹션 소개", "gallery.lead", { textarea: true, full: true }));
        box.appendChild(f);
        box.appendChild(listEditor({
          path: "gallery.items",
          addLabel: "+ 사진 추가",
          min: 0,
          factory: function () { return { id: "g" + Math.random().toString(36).slice(2, 7), image: "", cap: { kr: "", jp: "", en: "" }, alt: { kr: "", jp: "", en: "" }, url: "" }; },
          title: function (it, i) { return (it.cap && (it.cap.kr || it.cap)) || ("사진 " + (i + 1)); },
          cols: [
            { k: "image", l: "사진", img: true, dir: "assets/gallery/", w: 900 },
            { k: "url", l: "원본 게시물 주소 (선택)" },
            { k: "cap", l: "사진 설명", lang: true },
            { k: "alt", l: "대체 텍스트(접근성)", lang: true }
          ]
        }));
      }
    },
    {
      id: "reels",
      title: "7. 릴스",
      lead: "영상 파일은 assets/reels/ 에 있어야 재생됩니다. 카드를 누르면 원본 릴스가 열립니다.",
      render: function (box) {
        var f = el("div", { class: "fields" });
        f.appendChild(textField("영문 소제목", "showcase.eyebrow"));
        f.appendChild(textField("제목", "showcase.title"));
        f.appendChild(textField("섹션 소개", "showcase.lead", { textarea: true, full: true }));
        box.appendChild(f);
        box.appendChild(listEditor({
          path: "showcase.reels",
          addLabel: "+ 릴스 추가",
          min: 0,
          factory: function () { return { id: "reel-" + Math.random().toString(36).slice(2, 7), url: "", video: "", poster: "", title: { kr: "", jp: "", en: "" }, desc: { kr: "", jp: "", en: "" } }; },
          title: function (it, i) { return (it.title && (it.title.kr || it.title)) || ("릴스 " + (i + 1)); },
          cols: [
            { k: "url", l: "인스타그램 릴스 주소", full: true },
            { k: "video", l: "영상 파일 (assets/reels/…mp4)" },
            { k: "poster", l: "썸네일 파일 (assets/reels/…jpg)" },
            { k: "title", l: "제목", lang: true },
            { k: "desc", l: "설명", lang: true, textarea: true }
          ]
        }));
      }
    },
    {
      id: "space",
      title: "8. 공간 소개",
      lead: "시술실 사진과 세 가지 안내입니다.",
      render: function (box) {
        var f = el("div", { class: "fields" });
        f.appendChild(textField("영문 소제목", "space.eyebrow"));
        f.appendChild(textField("제목", "space.title", { textarea: true, rows: 2 }));
        f.appendChild(textField("소개 문단", "space.lead", { textarea: true, rows: 3, full: true }));
        f.appendChild(imageField({ id: "space", image: getPath("space.image") }, { key: "image", dir: "assets/", w: 1100 }));
        f.appendChild(textField("사진 설명(대체 텍스트)", "space.imageAlt", { full: true }));
        box.appendChild(f);
        box.appendChild(listEditor({
          path: "space.points",
          addLabel: "+ 안내 추가",
          min: 0,
          factory: function () { return { t: { kr: "", jp: "", en: "" }, d: { kr: "", jp: "", en: "" } }; },
          title: function (it, i) { return (it.t && (it.t.kr || it.t)) || ("안내 " + (i + 1)); },
          cols: [{ k: "t", l: "제목", lang: true }, { k: "d", l: "설명", lang: true, textarea: true }]
        }));
      }
    },
    {
      id: "class",
      title: "9. 수강",
      lead: "정규·원데이 클래스 안내입니다.",
      render: function (box) {
        var f = el("div", { class: "fields" });
        f.appendChild(textField("영문 소제목", "class.eyebrow"));
        f.appendChild(textField("제목", "class.title", { textarea: true, rows: 2 }));
        f.appendChild(textField("소개 문단", "class.lead", { textarea: true, rows: 3, full: true }));
        f.appendChild(textField("본문", "class.body", { textarea: true, rows: 3, full: true }));
        f.appendChild(textField("버튼 문구", "class.cta"));
        f.appendChild(textField("아래 안내", "class.note", { textarea: true, rows: 2, full: true }));
        box.appendChild(f);
      }
    },
    {
      id: "japan",
      title: "10. 일본 고객 안내",
      lead: "LINE 안내 블록입니다. 일본어는 위 언어 버튼을 日本語로 바꿔 고칩니다.",
      render: function (box) {
        var f = el("div", { class: "fields" });
        f.appendChild(textField("영문 소제목", "japan.eyebrow"));
        f.appendChild(textField("제목", "japan.title"));
        f.appendChild(textField("소개 문단", "japan.lead", { textarea: true, rows: 3, full: true }));
        f.appendChild(textField("버튼 문구", "japan.cta"));
        f.appendChild(textField("아래 안내 (방일 일정 등)", "japan.note", { textarea: true, rows: 2, full: true, note: "일정이 지나면 꼭 고쳐 주세요." }));
        box.appendChild(f);
      }
    },
    {
      id: "reviews",
      title: "11. 리뷰",
      lead: "평점·리뷰 수·키워드·인용 문구입니다.",
      render: function (box) {
        var f = el("div", { class: "fields" });
        f.appendChild(textField("영문 소제목", "reviews.eyebrow"));
        f.appendChild(textField("제목", "reviews.title", { textarea: true, rows: 2 }));
        f.appendChild(textField("섹션 소개", "reviews.lead", { textarea: true, rows: 3, full: true }));
        f.appendChild(textField("평점", "reviews.rating"));
        f.appendChild(textField("리뷰 수 문구", "reviews.count"));
        f.appendChild(textField("맨 아래 안내", "reviews.note", { textarea: true, rows: 2, full: true }));
        box.appendChild(f);
        box.appendChild(el("p", { class: "card__lead", style: "margin:16px 0 6px" }, "키워드"));
        box.appendChild(listEditor({
          path: "reviews.keywords",
          addLabel: "+ 키워드 추가",
          min: 0,
          factory: function () { return { t: { kr: "", jp: "", en: "" }, n: "" }; },
          title: function (it) { return (it.t && (it.t.kr || it.t)) || ""; },
          cols: [{ k: "t", l: "키워드", lang: true }, { k: "n", l: "선택 인원 (267)" }]
        }));
        box.appendChild(el("p", { class: "card__lead", style: "margin:16px 0 6px" }, "인용 리뷰"));
        box.appendChild(listEditor({
          path: "reviews.items",
          addLabel: "+ 리뷰 추가",
          min: 0,
          factory: function () { return { text: { kr: "", jp: "", en: "" }, meta: { kr: "", jp: "", en: "" } }; },
          title: function (it, i) { return (it.meta && (it.meta.kr || it.meta)) || ("리뷰 " + (i + 1)); },
          cols: [
            { k: "text", l: "리뷰 문장", lang: true, textarea: true, full: true },
            { k: "meta", l: "출처 (네이버 방문자 리뷰 · 2026.11)", lang: true }
          ]
        }));
      }
    },
    {
      id: "reserve",
      title: "12. 예약",
      lead: "예약 3단계와 주의 문구입니다.",
      render: function (box) {
        var f = el("div", { class: "fields" });
        f.appendChild(textField("영문 소제목", "reserve.eyebrow"));
        f.appendChild(textField("제목", "reserve.title"));
        f.appendChild(textField("섹션 소개", "reserve.lead", { textarea: true, full: true }));
        f.appendChild(textField("쿠폰 안내", "reserve.coupons", { full: true }));
        f.appendChild(textField("맨 아래 안내", "reserve.note", { textarea: true, rows: 2, full: true }));
        box.appendChild(f);
        box.appendChild(listEditor({
          path: "reserve.steps",
          addLabel: "+ 단계 추가",
          min: 1,
          factory: function () { return { title: { kr: "", jp: "", en: "" }, desc: { kr: "", jp: "", en: "" } }; },
          title: function (it, i) { return (it.title && (it.title.kr || it.title)) || ("단계 " + (i + 1)); },
          cols: [{ k: "title", l: "제목", lang: true }, { k: "desc", l: "설명", lang: true, textarea: true }]
        }));
        box.appendChild(el("p", { class: "card__lead", style: "margin:16px 0 6px" }, "주의 문구 (검은 영역에 나옵니다)"));
        box.appendChild(stringListEditor("reserve.notes", "주의 문구", "+ 주의 문구 추가"));
      }
    },
    {
      id: "faq",
      title: "13. 예약 전 안내 (FAQ)",
      lead: "질문/답 목록입니다. 예약 전에 꼭 읽어야 하는 내용을 넣어 두세요.",
      render: function (box) {
        var f = el("div", { class: "fields" });
        f.appendChild(textField("영문 소제목", "faq.eyebrow"));
        f.appendChild(textField("제목", "faq.title"));
        f.appendChild(textField("섹션 소개", "faq.lead", { textarea: true, full: true }));
        box.appendChild(f);
        box.appendChild(listEditor({
          path: "faq.items",
          addLabel: "+ 질문 추가",
          min: 1,
          factory: function () { return { q: { kr: "", jp: "", en: "" }, a: { kr: "", jp: "", en: "" } }; },
          title: function (it, i) { return (it.q && (it.q.kr || it.q)) || ("질문 " + (i + 1)); },
          cols: [{ k: "q", l: "질문", lang: true }, { k: "a", l: "답변", lang: true, textarea: true }]
        }));
      }
    },
    {
      id: "visit",
      title: "14. 오시는 길",
      lead: "주소·운영 시간·오는 길입니다.",
      render: function (box) {
        var f = el("div", { class: "fields" });
        f.appendChild(textField("주소", "visit.address", { full: true }));
        f.appendChild(textField("주소 보조 설명", "visit.addressNote", { full: true }));
        f.appendChild(textField("운영 시간", "visit.hours"));
        f.appendChild(textField("운영 시간 보조", "visit.hoursNote"));
        f.appendChild(textField("전화번호", "visit.phone"));
        f.appendChild(textField("오는 길", "visit.transit", { textarea: true, rows: 3, full: true }));
        f.appendChild(textField("주차", "visit.parking", { textarea: true, rows: 2, full: true }));
        f.appendChild(textField("지도 아래 안내", "visit.mapNote", { full: true }));
        box.appendChild(f);
      }
    },
    {
      id: "channels",
      title: "15. 링크",
      lead: "홈페이지의 모든 예약 버튼이 이 주소로 연결됩니다. 비우면 기본 링크가 쓰입니다.",
      render: function (box) {
        var f = el("div", { class: "fields" });
        f.appendChild(textField("카카오톡 채널", "channels.kakao", { full: true }));
        f.appendChild(textField("네이버 플레이스 / 예약", "channels.naver", { full: true }));
        f.appendChild(textField("인스타그램 (@glossy_brow)", "channels.instagram", { full: true }));
        f.appendChild(textField("립 인스타그램 (@glossy_lip.blush)", "channels.instagramLip", { full: true }));
        f.appendChild(textField("LINE 초대 링크", "channels.line", { full: true, note: "lin.ee/... 형태의 초대 링크" }));
        f.appendChild(textField("수강 오픈채팅", "channels.classKakao", { full: true }));
        box.appendChild(f);
      }
    },
    {
      id: "footer",
      title: "16. 푸터 · 기타",
      lead: "맨 아래 문구입니다.",
      render: function (box) {
        var f = el("div", { class: "fields" });
        f.appendChild(textField("한 줄 소개", "footer.desc", { full: true }));
        f.appendChild(textField("사진·영상 출처 안내", "footer.disclaimer", { textarea: true, rows: 2, full: true }));
        f.appendChild(textField("저작권 문구", "footer.copyright", { full: true }));
        box.appendChild(f);
      }
    }
  ];

  /* ---------- 전체 렌더 ---------- */
  function renderAll() {
    var host = $("sections");
    if (!host) return;
    host.innerHTML = "";
    SECTIONS.forEach(function (sec) {
      var card = el("section", { class: "card" });
      var head = el("header", { class: "card__head" });
      head.appendChild(el("h2", null, sec.title));
      var lead = el("p", { class: "card__lead" });
      lead.innerHTML = sec.lead;
      head.appendChild(lead);
      card.appendChild(head);
      try { sec.render(card); }
      catch (e) { card.appendChild(el("p", { class: "alert" }, "이 부분을 그리지 못했습니다: " + e.message)); }
      host.appendChild(card);
    });
    updateMeta();
    if ($("editLangName")) $("editLangName").textContent = LANG_NAME[state.editLang];
  }

  function updateMeta() {
    var c = state.content || {};
    var gal = (c.gallery && Array.isArray(c.gallery.items)) ? c.gallery.items.length : 0;
    var reels = (c.showcase && Array.isArray(c.showcase.reels)) ? c.showcase.reels.length : 0;
    var menu = (c.menu && Array.isArray(c.menu.items)) ? c.menu.items.length : 0;
    var meta = $("metaInfo");
    if (meta) meta.textContent = "시술 " + menu + " · 사진 " + gal + " · 릴스 " + reels + " · 마지막 저장 " + fmtDate(c.updatedAt);
    if ($("repoName")) $("repoName").textContent = OWNER + "/" + REPO;
    if ($("gateRepo")) $("gateRepo").textContent = OWNER + "/" + REPO;
  }

  /* ---------- GitHub ---------- */
  function hdrs(token) {
    var h = { "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
    if (token) h.Authorization = "Bearer " + token;
    return h;
  }
  function ghMessage(status) {
    if (status === 401) return "토큰이 유효하지 않습니다. 새 토큰으로 다시 연결해 주세요.";
    if (status === 403) return "권한이 없거나 요청 한도를 넘었습니다. 토큰의 ‘Contents: Read and write’ 권한을 확인해 주세요.";
    if (status === 404) return "저장소나 파일을 찾을 수 없습니다. 토큰의 저장소 접근 범위를 확인해 주세요.";
    if (status === 409) return "다른 곳에서 먼저 저장되었습니다. 다시 시도해 주세요.";
    if (status === 422) return "GitHub가 이 내용을 받아들이지 않았습니다(422). 잠시 후 다시 시도해 주세요.";
    return "GitHub 오류 (" + status + ")";
  }
  async function ghJson(url, opts) {
    var res = await fetch(url, opts);
    if (!res.ok) {
      var detail = "";
      try { var j = await res.json(); detail = j && j.message ? " — " + j.message : ""; } catch (e) {}
      var err = new Error(ghMessage(res.status) + detail);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }
  async function verifyToken(token) {
    var d = await ghJson(API + "/repos/" + OWNER + "/" + REPO, { headers: hdrs(token), cache: "no-store" });
    var perm = d.permissions || {};
    if (!(perm.push || perm.admin || perm.maintain)) {
      throw new Error("이 토큰으로는 저장할 수 없습니다. Permissions → Contents: Read and write 로 다시 만들어 주세요.");
    }
    return d;
  }
  function b64encodeUtf8(str) {
    var bytes = new TextEncoder().encode(str);
    var out = "", chunk = 0x8000;
    for (var i = 0; i < bytes.length; i += chunk) {
      out += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(out);
  }

  /* ---------- PIN ---------- */
  function subtleOk() { return !!(window.crypto && window.crypto.subtle && window.isSecureContext); }
  function toB64(bytes) { return btoa(String.fromCharCode.apply(null, bytes)); }
  function fromB64(s) { var bin = atob(s); var a = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a; }
  async function deriveKey(pin, salt) {
    var base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: salt, iterations: 200000, hash: "SHA-256" },
      base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
    );
  }
  async function encryptToken(token, pin) {
    var salt = crypto.getRandomValues(new Uint8Array(16));
    var iv = crypto.getRandomValues(new Uint8Array(12));
    var key = await deriveKey(pin, salt);
    var ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, new TextEncoder().encode(token));
    return { v: 1, salt: toB64(salt), iv: toB64(iv), ct: toB64(new Uint8Array(ct)) };
  }
  async function decryptToken(blob, pin) {
    var key = await deriveKey(pin, fromB64(blob.salt));
    var pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(blob.iv) }, key, fromB64(blob.ct));
    return new TextDecoder().decode(pt);
  }

  /* ---------- 화면 전환 ---------- */
  function showGate() {
    $("gate").hidden = false; $("pinGate").hidden = true;
    $("editor").hidden = true; $("savebar").hidden = true; $("lockBtn").hidden = true;
    setConn(null, "토큰 연결 전");
  }
  function showPinGate() {
    $("gate").hidden = true; $("pinGate").hidden = false;
    $("editor").hidden = true; $("savebar").hidden = true; $("lockBtn").hidden = true;
    setConn("warn", "PIN 잠금");
  }
  function enterEditor() {
    $("gate").hidden = true; $("pinGate").hidden = true;
    $("editor").hidden = false; $("savebar").hidden = false;
    $("lockBtn").hidden = !state.token;
    if (state.token) {
      setConn(true, "GitHub 연결됨 · 저장 가능");
      $("saveBtn").textContent = "저장 및 홈페이지 반영";
    } else {
      setConn("warn", "토큰 없이 편집 중 · 저장 불가");
      $("saveBtn").textContent = "토큰 연결하고 저장";
    }
    setStatus(state.dirty ? "저장되지 않은 변경사항이 있습니다" : "변경사항 없음", state.dirty ? "dirty" : "");
  }

  async function onConnect(ev) {
    ev.preventDefault();
    var token = $("tokenInput").value.trim();
    if (!token) { setGateAlert("토큰을 붙여넣어 주세요."); return; }
    if (!state.content || state.loadFailed) {
      setGateAlert("content.json 을 먼저 불러와야 합니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.", "warn");
      return;
    }
    setGateAlert("토큰을 확인하는 중…", "warn");
    var btn = $("gateSubmit");
    btn.disabled = true;
    try {
      var repo = await verifyToken(token);
      state.token = token;
      var remember = $("rememberToken").checked;
      var usePin = $("usePin").checked;
      if (remember && usePin) {
        if (!subtleOk()) throw new Error("이 브라우저에서는 PIN 잠금을 쓸 수 없습니다. 일반 저장을 이용해 주세요.");
        var pin = $("pinInput").value.trim();
        if (pin.length < 4) throw new Error("PIN은 4자리 이상으로 정해 주세요.");
        localStorage.setItem(KEY_TOKEN_PIN, JSON.stringify(await encryptToken(token, pin)));
        localStorage.removeItem(KEY_TOKEN);
      } else if (remember) {
        localStorage.setItem(KEY_TOKEN, token);
        localStorage.removeItem(KEY_TOKEN_PIN);
      } else {
        localStorage.removeItem(KEY_TOKEN);
        localStorage.removeItem(KEY_TOKEN_PIN);
      }
      setGateAlert("");
      enterEditor();
      setStatus(remember ? "연결되었습니다. 이제 내용을 고치고 저장하세요." : "연결되었습니다. (이 브라우저에는 저장하지 않음)", "ok");
      setConn(true, "GitHub 연결됨 · " + (repo.full_name || (OWNER + "/" + REPO)));
    } catch (err) {
      state.token = null;
      setGateAlert(err.message || String(err));
    } finally {
      btn.disabled = false;
    }
  }

  async function onPinUnlock(ev) {
    ev.preventDefault();
    var pin = $("pinUnlock").value.trim();
    var box = $("pinAlert");
    box.hidden = true;
    var raw = localStorage.getItem(KEY_TOKEN_PIN);
    if (!raw) { showGate(); return; }
    try {
      var token = await decryptToken(JSON.parse(raw), pin);
      await verifyToken(token);
      state.token = token;
      enterEditor();
      setStatus("PIN 잠금이 풀렸습니다.", "ok");
    } catch (e) {
      box.hidden = false;
      box.className = "alert";
      box.textContent = "PIN이 맞지 않거나 토큰이 만료되었습니다. 다시 시도해 주세요.";
    }
  }

  function logout() {
    if (!confirm("이 브라우저에서 토큰을 지울까요? 다시 저장하려면 토큰을 새로 넣어야 합니다.")) return;
    try { localStorage.removeItem(KEY_TOKEN); localStorage.removeItem(KEY_TOKEN_PIN); } catch (e) {}
    state.token = null;
    $("tokenInput").value = "";
    showGate();
    setGateAlert("토큰을 지웠습니다.", "ok");
  }

  /* ---------- 검증 ---------- */
  function validate() {
    var p = [];
    var ch = state.content.channels || {};
    [["kakao", "카카오톡 주소"], ["naver", "네이버 주소"], ["instagram", "인스타그램 주소"], ["line", "LINE 링크"]].forEach(function (pair) {
      var v = (ch[pair[0]] || "").trim();
      if (!v) p.push(pair[1] + "가 비어 있습니다.");
      else if (!/^https?:\/\/\S+$/i.test(v)) p.push(pair[1] + "가 http(s):// 로 시작하지 않습니다.");
    });
    ((state.content.gallery && state.content.gallery.items) || []).forEach(function (it, i) {
      if (!String(it.image || "").trim()) p.push("갤러리 " + (i + 1) + "의 사진 경로가 비어 있습니다.");
      if (it.url && !/^https?:\/\//i.test(it.url)) p.push("갤러리 " + (i + 1) + "의 링크를 확인해 주세요.");
    });
    ((state.content.showcase && state.content.showcase.reels) || []).forEach(function (it, i) {
      if (it.url && !/^https?:\/\//i.test(it.url)) p.push("릴스 " + (i + 1) + "의 주소를 확인해 주세요.");
      if (it.video && !/^assets\//.test(it.video)) p.push("릴스 " + (i + 1) + "의 영상 경로는 assets/ 로 시작해야 합니다.");
    });
    return p;
  }

  /* ---------- 이미지 업로드 ---------- */
  async function putFile(path, dataUrl, message) {
    var base64 = String(dataUrl).split(",")[1];
    var sha = null;
    try {
      var cur = await ghJson(API + "/repos/" + OWNER + "/" + REPO + "/contents/" + encodeURI(path) + "?ref=" + encodeURIComponent(BRANCH),
        { headers: hdrs(state.token), cache: "no-store" });
      sha = cur.sha;
    } catch (e) {
      if (e.status !== 404) throw e;
    }
    var body = { message: message, content: base64, branch: BRANCH };
    if (sha) body.sha = sha;
    var res = await fetch(API + "/repos/" + OWNER + "/" + REPO + "/contents/" + encodeURI(path), {
      method: "PUT",
      headers: Object.assign(hdrs(state.token), { "Content-Type": "application/json" }),
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error("사진 업로드 실패 (" + path + ") — " + ghMessage(res.status));
  }

  /* ---------- 저장 ---------- */
  async function save() {
    if (state.saving) return;
    if (!state.token) {
      $("gate").hidden = false; $("editor").hidden = true; $("savebar").hidden = true;
      $("gate").scrollIntoView({ behavior: "smooth", block: "start" });
      setGateAlert("저장하려면 먼저 토큰을 연결해 주세요.", "warn");
      return;
    }
    var problems = validate();
    if (problems.length) {
      setStatus("확인해 주세요: " + problems[0] + (problems.length > 1 ? " 외 " + (problems.length - 1) + "건" : ""), "bad");
      return;
    }

    state.saving = true;
    var btn = $("saveBtn");
    btn.disabled = true;
    var oldLabel = btn.textContent;
    btn.textContent = "저장 중…";

    try {
      var keys = Object.keys(state.pendingImages);
      for (var k = 0; k < keys.length; k++) {
        var key = keys[k];
        var parts = key.split("|");
        var itemId = parts[0], prop = parts[1];
        var target = null;
        if (["hero", "about", "space"].indexOf(itemId) >= 0) {
          target = getPath(itemId);
        } else {
          findItems(function (it) { if (it.id === itemId && it[prop] !== undefined) target = it; });
        }
        if (!target || !target[prop]) continue;
        setStatus("사진을 올리는 중… (" + (k + 1) + "/" + keys.length + ")", "");
        await putFile(target[prop], state.pendingImages[key], "사진 추가 (관리자 페이지)");
      }
      state.pendingImages = {};

      setStatus("GitHub에 저장하는 중…", "");
      var updatedAt = nowISO();
      state.content.updatedAt = updatedAt;
      var json = JSON.stringify(state.content, null, 2) + "\n";

      var sha = null;
      try {
        var remote = await ghJson(API + "/repos/" + OWNER + "/" + REPO + "/contents/" + FILE_PATH + "?ref=" + encodeURIComponent(BRANCH),
          { headers: hdrs(state.token), cache: "no-store" });
        sha = remote.sha;
      } catch (e) {
        if (e.status !== 404) throw e;
      }

      var body = {
        message: "홈페이지 내용 수정 (관리자 페이지 " + localDate() + ")",
        content: b64encodeUtf8(json),
        branch: BRANCH
      };
      if (sha) body.sha = sha;

      var res = await fetch(API + "/repos/" + OWNER + "/" + REPO + "/contents/" + FILE_PATH, {
        method: "PUT",
        headers: Object.assign(hdrs(state.token), { "Content-Type": "application/json" }),
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        var j = null;
        try { j = await res.json(); } catch (e) {}
        throw new Error(ghMessage(res.status) + (j && j.message ? " — " + j.message : ""));
      }

      state.pristine = clone(state.content);
      state.dirty = false;
      try { localStorage.setItem(KEY_CONTENT_V, String(Date.now())); } catch (e) {}

      setStatus("GitHub 저장 완료 · 홈페이지에 반영되는 중입니다 (보통 30~60초)…", "");
      var secs = await waitLive(updatedAt);
      if (secs) setStatus("홈페이지에 반영되었습니다 (" + secs + "초). 새로고침해 확인해 보세요.", "ok");
      else setStatus("GitHub 저장은 끝났습니다. 홈페이지 반영은 아직 확인되지 않았습니다 — 1~2분 뒤 새로고침해 보세요.", "warn");
    } catch (err) {
      setStatus(err.message || "저장에 실패했습니다.", "bad");
    } finally {
      state.saving = false;
      btn.disabled = false;
      btn.textContent = oldLabel;
    }
  }

  function findItems(fn) {
    var roots = ["gallery.items", "showcase.reels", "menu.items", "reviews.items", "reviews.keywords", "about.pillars", "space.points", "reserve.steps", "faq.items", "stats"];
    roots.forEach(function (p) {
      var arr = getPath(p);
      if (Array.isArray(arr)) arr.forEach(function (it) { if (it && typeof it === "object") fn(it); });
    });
    ["hero", "about", "space"].forEach(function (k) {
      var o = getPath(k);
      if (o && typeof o === "object") fn(o);
    });
  }

  async function waitLive(updatedAt) {
    for (var i = 1; i <= 15; i++) {
      await sleep(6000);
      try {
        var r = await fetch(LIVE + "?t=" + Date.now(), { cache: "no-store" });
        if (r.ok) {
          var d = await r.json();
          if (d && d.updatedAt === updatedAt) return i * 6;
        }
      } catch (e) {}
      if (i % 3 === 0) setStatus("홈페이지 반영 확인 중… (" + (i * 6) + "초)", "");
    }
    return 0;
  }

  /* ---------- 백업 ---------- */
  function download() {
    var json = JSON.stringify(state.content, null, 2) + "\n";
    var blob = new Blob([json], { type: "application/json" });
    var a = el("a", { href: URL.createObjectURL(blob), download: "content.json" });
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function upload(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(String(reader.result));
        state.content = normalize(data);
        state.dirty = true;
        renderAll();
        setStatus("파일을 불러왔습니다. 확인한 뒤 저장하세요.", "warn");
      } catch (e) {
        setStatus("JSON 파일을 읽지 못했습니다: " + e.message, "bad");
      }
    };
    reader.readAsText(file, "utf-8");
  }

  /* ---------- 정규화 ---------- */
  function normalize(c) {
    c = (c && typeof c === "object") ? c : {};
    ["site", "notice", "sections", "hero", "menu", "gallery", "showcase", "about", "space", "class", "japan", "reviews", "reserve", "faq", "visit", "channels", "footer", "ui"].forEach(function (k) {
      if (typeof c[k] !== "object" || c[k] === null) c[k] = {};
    });
    if (!Array.isArray(c.stats)) c.stats = [];
    if (!Array.isArray(c.menu.items)) c.menu.items = [];
    if (!Array.isArray(c.gallery.items)) c.gallery.items = [];
    if (!Array.isArray(c.showcase.reels)) c.showcase.reels = [];
    if (!Array.isArray(c.about.pillars)) c.about.pillars = [];
    if (!Array.isArray(c.space.points)) c.space.points = [];
    if (!Array.isArray(c.reviews.keywords)) c.reviews.keywords = [];
    if (!Array.isArray(c.reviews.items)) c.reviews.items = [];
    if (!Array.isArray(c.reserve.steps)) c.reserve.steps = [];
    if (!Array.isArray(c.reserve.notes)) c.reserve.notes = [];
    if (!Array.isArray(c.faq.items)) c.faq.items = [];
    ["about", "menu", "gallery", "reels", "space", "class", "japan", "reviews", "reserve", "faq", "visit"].forEach(function (k) {
      if (typeof c.sections[k] !== "boolean") c.sections[k] = true;
    });
    if (typeof c.updatedAt !== "string") c.updatedAt = "";
    if (typeof c.version !== "number") c.version = 1;
    return c;
  }

  async function loadContent() {
    var res = await fetch("../" + FILE_PATH + "?t=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return normalize(await res.json());
  }

  /* ---------- 이벤트 ---------- */
  function bind() {
    $("gateForm").addEventListener("submit", onConnect);
    $("pinForm").addEventListener("submit", onPinUnlock);
    $("gateSkip").addEventListener("click", function () {
      state.token = null;
      enterEditor();
      setStatus("토큰 없이 편집 중입니다. 저장하려면 토큰을 연결해 주세요.", "warn");
    });
    $("pinReset").addEventListener("click", function () {
      localStorage.removeItem(KEY_TOKEN_PIN);
      showGate();
    });
    $("lockBtn").addEventListener("click", logout);
    $("usePin").addEventListener("change", function () {
      $("pinInput").disabled = !this.checked;
      if (this.checked) $("pinInput").focus();
    });
    $("rememberToken").addEventListener("change", function () {
      if (!this.checked) { $("usePin").checked = false; $("pinInput").disabled = true; }
    });

    document.querySelectorAll("[data-editlang]").forEach(function (b) {
      b.addEventListener("click", function () {
        state.editLang = b.getAttribute("data-editlang");
        document.querySelectorAll("[data-editlang]").forEach(function (x) {
          x.classList.toggle("is-on", x === b);
        });
        renderAll();
      });
    });

    $("saveBtn").addEventListener("click", save);
    $("revertBtn").addEventListener("click", function () {
      if (!state.pristine) return;
      if (!confirm("저장하지 않은 변경사항을 모두 버리고 마지막으로 불러온 상태로 돌아갈까요?")) return;
      state.content = clone(state.pristine);
      state.pendingImages = {};
      state.dirty = false;
      renderAll();
      setStatus("되돌렸습니다.", "");
    });
    $("downloadBtn").addEventListener("click", download);
    $("uploadInput").addEventListener("change", function () {
      var f = this.files && this.files[0];
      if (f) upload(f);
      this.value = "";
    });
    $("reloadBtn").addEventListener("click", async function () {
      if (state.dirty && !confirm("저장하지 않은 변경사항이 사라집니다. 계속할까요?")) return;
      try {
        var c = await loadContent();
        state.content = c;
        state.pristine = clone(c);
        state.pendingImages = {};
        state.dirty = false;
        renderAll();
        setStatus("GitHub의 최신 내용을 다시 불러왔습니다.", "ok");
      } catch (e) {
        setStatus(e.message, "bad");
      }
    });

    $("jsonLoad").addEventListener("click", function () {
      $("jsonArea").value = JSON.stringify(state.content, null, 2);
      setJsonMsg("현재 내용을 불러왔습니다.", "ok");
    });
    $("jsonCheck").addEventListener("click", function () {
      try {
        JSON.parse($("jsonArea").value);
        setJsonMsg("정상적인 JSON입니다.", "ok");
      } catch (e) {
        setJsonMsg("JSON 오류: " + e.message, "bad");
      }
    });
    $("jsonApply").addEventListener("click", function () {
      try {
        var data = JSON.parse($("jsonArea").value);
        state.content = normalize(data);
        state.dirty = true;
        renderAll();
        setJsonMsg("편집기에 적용했습니다. 저장을 눌러 반영하세요.", "ok");
        setStatus("JSON을 적용했습니다. 저장되지 않았습니다.", "dirty");
      } catch (e) {
        setJsonMsg("JSON 오류: " + e.message, "bad");
      }
    });

    window.addEventListener("beforeunload", function (e) {
      if (!state.dirty) return;
      e.preventDefault();
      e.returnValue = "";
    });
  }

  function setJsonMsg(msg, kind) {
    var n = $("jsonMsg");
    if (!n) return;
    n.textContent = msg;
    n.className = "json__msg" + (kind ? " is-" + kind : "");
  }

  async function init() {
    bind();
    try {
      state.content = await loadContent();
      state.pristine = clone(state.content);
    } catch (e) {
      state.loadFailed = true;
      document.body.insertAdjacentHTML("afterbegin", '<div class="alert" style="margin:16px">content.json 을 불러오지 못했습니다. (' + e.message + ") 페이지를 새로고침해 주세요.</div>");
      showGate();
      $("gateSkip").hidden = true;
      return;
    }
    renderAll();

    var plain = null, pinRaw = null;
    try {
      plain = localStorage.getItem(KEY_TOKEN);
      pinRaw = localStorage.getItem(KEY_TOKEN_PIN);
    } catch (e) {}

    if (plain) {
      state.token = plain;
      enterEditor();
      verifyToken(plain)
        .then(function (repo) { setConn(true, "GitHub 연결됨 · " + (repo.full_name || REPO)); })
        .catch(function () {
          state.token = null;
          setConn(false, "토큰이 만료되었습니다 — 다시 연결해 주세요");
          showGate();
          setGateAlert("저장된 토큰이 만료되었거나 권한이 없습니다. 새 토큰을 넣어 주세요.");
        });
    } else if (pinRaw) {
      showPinGate();
      setTimeout(function () { $("pinUnlock").focus(); }, 80);
    } else {
      showGate();
    }
  }

  init();
})();
