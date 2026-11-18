/* =========================================================
   GLOSSY — app.js
   - data/content.json 의 3개 국어(KR/JP/EN) 문구를 화면에 반영
   - 예약 링크: 한국어 → 카카오톡 / 일본어·영어 → LINE
   - 메뉴 그룹 · 갤러리(라이트박스) · 릴스 캐러셀 · FAQ 아코디언
   ========================================================= */
(function () {
  "use strict";

  /* ---------- 1. 기본값 ---------- */
  var URLS = {
    kakao: "https://pf.kakao.com/_GBytb",
    kakaoHome: "https://pf.kakao.com/_GBytb",
    naver: "https://naver.me/GUwJMSUY",
    instagram: "https://www.instagram.com/glossy_brow/",
    instagramLip: "https://www.instagram.com/glossy_lip.blush/",
    line: "https://lin.ee/L5jfV7r",
    classKakao: "https://open.kakao.com/o/sPfxHVli"
  };

  var LANG_KEY = "glossy-lang";
  var CONTENT_KEY = "glossy-content-v";

  var META = {
    kr: {
      lang: "ko",
      title: "GLOSSY 글로시｜수원 눈썹문신 · 입술 반영구 · 광교 아트메이크업",
      desc: "수원 광교 글로시(GLOSSY). 눈썹·입술·아이라인 반영구와 잔혼 커버, 속눈썹펌. 얼굴 골격과 눈동자 색까지 살펴 가장 잘 어울리는 디자인을 제안합니다. 상현역 2번 출구 도보 5–7분, 일요일 휴무, 무료 주차."
    },
    jp: {
      lang: "ja",
      title: "GLOSSY（グロッシー）｜水原 アートメイク · 眉・リップ専門",
      desc: "水原（スウォン）のアートメイクスタジオ GLOSSY。眉・リップ・アイラインのアートメイク、残りカバー、まつげパーマ。骨格と瞳の色まで見て、いちばん似合うデザインをご提案します。サンヒョン駅2番出口から徒歩5〜7分、日曜定休、無料駐車。"
    },
    en: {
      lang: "en",
      title: "GLOSSY｜Brow & lip art makeup studio in Suwon, Korea",
      desc: "GLOSSY is an art makeup studio in Suwon, Korea. Brows, lips, eyeliner, correction work and lash lifts, designed around your bone structure and colouring. 5–7 min from Sanghyeon Station, closed Sundays, free parking."
    }
  };

  var IG_PATH = "M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.3 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.3 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.3-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c.1-1.2.3-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2Zm0 5.3a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Zm0 7.4a2.9 2.9 0 1 1 0-5.8 2.9 2.9 0 0 1 0 5.8Zm5.7-7.6a1.05 1.05 0 1 1-2.1 0 1.05 1.05 0 0 1 2.1 0Z";

  var CONTENT = null;
  var lang = "kr";

  /* ---------- 2. 도구 ---------- */
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }
  function pick(v) {
    if (v === null || v === undefined) return "";
    if (typeof v === "string") return v;
    if (typeof v === "object") {
      if (v[lang] !== undefined && v[lang] !== null && String(v[lang]).trim() !== "") return String(v[lang]);
      if (v.kr !== undefined && v.kr !== null) return String(v.kr);
    }
    return "";
  }
  function list(v) { return Array.isArray(v) ? v : []; }
  function getPath(path) {
    var parts = String(path).split("."), cur = CONTENT;
    for (var i = 0; i < parts.length; i++) {
      if (cur === null || cur === undefined) return null;
      cur = cur[parts[i]];
    }
    return cur;
  }
  function toast(msg) {
    var t = $("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("is-on");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove("is-on"); }, 2200);
  }
  function sectionOn(key) {
    return !CONTENT || !CONTENT.sections || CONTENT.sections[key] !== false;
  }

  /* ---------- 3. 링크 ---------- */
  function applyChannels() {
    if (CONTENT && CONTENT.channels) {
      Object.keys(CONTENT.channels).forEach(function (k) {
        if (typeof CONTENT.channels[k] === "string" && CONTENT.channels[k].trim() && URLS[k] !== undefined) {
          URLS[k] = CONTENT.channels[k].trim();
        }
      });
    }
    document.querySelectorAll("[data-link]").forEach(function (a) {
      var key = a.getAttribute("data-link");
      if (key === "primary") return;
      var url = URLS[key];
      if (!url) return;
      a.setAttribute("href", url);
      if (/^https?:/i.test(url)) {
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener");
      } else {
        a.removeAttribute("target");
        a.removeAttribute("rel");
      }
    });
  }

  function applyPrimary() {
    var toLine = lang !== "kr";
    document.querySelectorAll('[data-link="primary"]').forEach(function (a) {
      a.classList.toggle("is-line", toLine);
      if (toLine) {
        a.setAttribute("href", URLS.line);
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener");
      } else {
        a.setAttribute("href", URLS.kakao);
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener");
      }
      var label = a.querySelector("span");
      var long = a.classList.contains("btn--lg");
      var text = pick(getPath(long ? "ui.ctaPrimaryLong" : "ui.ctaPrimary")) || "";
      if (label && text) label.innerHTML = text;
    });
    var box = $("lineBox");
    if (box) box.hidden = !toLine;
  }

  /* ---------- 4. 문구 ---------- */
  function applyText() {
    if (!CONTENT) return;
    document.querySelectorAll("[data-content]").forEach(function (node) {
      var out = pick(getPath(node.getAttribute("data-content")));
      if (out.trim() !== "") node.innerHTML = out;
    });
    document.querySelectorAll("[data-img]").forEach(function (node) {
      var src = getPath(node.getAttribute("data-img"));
      if (typeof src === "string" && src.trim() && node.getAttribute("src") !== src) node.src = src;
      var altPath = node.getAttribute("data-img-alt");
      if (altPath) {
        var alt = pick(getPath(altPath));
        if (alt.trim()) node.alt = alt;
      }
    });
    var ld = document.querySelector('script[type="application/ld+json"]');
    if (ld) {
      try {
        var data = JSON.parse(ld.textContent);
        data.description = META[lang].desc;
        ld.textContent = JSON.stringify(data, null, 2);
      } catch (e) {}
    }
  }

  function applyMeta() {
    var m = META[lang] || META.kr;
    document.documentElement.setAttribute("lang", m.lang);
    document.title = m.title;
    var d = document.querySelector('meta[name="description"]');
    if (d) d.setAttribute("content", m.desc);
    var ot = document.querySelector('meta[property="og:title"]');
    if (ot) ot.setAttribute("content", m.title);
    var od = document.querySelector('meta[property="og:description"]');
    if (od) od.setAttribute("content", m.desc);
    var ol = document.querySelector('meta[property="og:locale"]');
    if (ol) ol.setAttribute("content", lang === "kr" ? "ko_KR" : lang === "jp" ? "ja_JP" : "en_US");
    document.querySelectorAll(".lang button").forEach(function (b) {
      var on = b.getAttribute("data-lang") === lang;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    document.querySelectorAll("[data-link]").forEach(function (a) {
      if (a.getAttribute("data-link") === "line") a.classList.add("is-line");
    });
  }

  /* ---------- 5. 렌더 ---------- */
  function renderStats() {
    var wrap = $("statsGrid");
    if (!wrap || !CONTENT || !Array.isArray(CONTENT.stats)) return;
    wrap.innerHTML = "";
    CONTENT.stats.forEach(function (s) {
      var box = el("div", "stat reveal");
      box.appendChild(el("p", "stat__num", pick(s.num)));
      var label = el("p", "stat__label");
      label.innerHTML = pick(s.label);
      box.appendChild(label);
      wrap.appendChild(box);
    });
  }

  function renderPillars() {
    var ul = $("pillars");
    if (!ul || !CONTENT || !CONTENT.about) return;
    ul.innerHTML = "";
    list(CONTENT.about.pillars).forEach(function (p, i) {
      var li = el("li", "reveal");
      li.appendChild(el("span", null, (i + 1 < 10 ? "0" : "") + (i + 1)));
      var box = el("div");
      box.appendChild(el("h3", null, pick(p.title)));
      box.appendChild(el("p", null, pick(p.desc)));
      li.appendChild(box);
      ul.appendChild(li);
    });
  }

  function renderMenu() {
    var host = $("menuList");
    var sec = $("menu");
    if (!host || !CONTENT || !CONTENT.menu) return;
    if (sec) sec.hidden = !sectionOn("menu");
    if (!sectionOn("menu")) return;

    var groups = [], map = {};
    list(CONTENT.menu.items).forEach(function (it) {
      var key = pick(it.group) || "-";
      if (!map[key]) { map[key] = { name: key, items: [] }; groups.push(map[key]); }
      map[key].items.push(it);
    });

    host.innerHTML = "";
    groups.forEach(function (g, gi) {
      var box = el("div", "menugrp reveal");
      var head = el("div", "menugrp__head");
      head.appendChild(el("h3", "menugrp__name", g.name));
      head.appendChild(el("span", "menugrp__count", String(g.items.length) + (lang === "kr" ? " 항목" : lang === "jp" ? " メニュー" : " items")));
      box.appendChild(head);

      var ul = el("ul", "menugrp__items");
      g.items.forEach(function (it) {
        var li = el("li");
        li.appendChild(el("span", "menugrp__name2", pick(it.name)));
        var price = pick(it.price);
        var priceNode = el("span", "menugrp__price" + (/[0-9]/.test(price) ? " is-full" : ""), price);
        li.appendChild(priceNode);
        var desc = pick(it.desc);
        if (desc) li.appendChild(el("span", "menugrp__desc", desc));
        ul.appendChild(li);
      });
      box.appendChild(ul);
      host.appendChild(box);
    });
  }

  /* ---------- 6. 갤러리 + 라이트박스 ---------- */
  var GAL = [];
  var galIndex = 0;

  function renderGallery() {
    var grid = $("galGrid");
    var sec = $("gallery");
    if (!grid || !CONTENT || !CONTENT.gallery) return;
    if (sec) sec.hidden = !sectionOn("gallery");
    if (!sectionOn("gallery")) return;

    GAL = list(CONTENT.gallery.items);
    grid.innerHTML = "";
    GAL.forEach(function (it, i) {
      var b = el("button", "gal__item reveal");
      b.type = "button";
      b.setAttribute("aria-label", pick(it.cap) + " — " + pick(getPath("ui.galOpen")));
      var media = el("span", "gal__media");
      var img = el("img");
      img.src = it.image || "";
      img.alt = pick(it.alt) || pick(it.cap);
      img.loading = "lazy";
      img.decoding = "async";
      img.width = 900; img.height = 1125;
      media.appendChild(img);
      b.appendChild(media);
      var cap = el("span", "gal__cap");
      cap.appendChild(el("span", "gal__cap-t", pick(it.cap)));
      cap.appendChild(el("span", "gal__cap-i", "GLOSSY"));
      b.appendChild(cap);
      b.addEventListener("click", function () { openLightbox(i); });
      grid.appendChild(b);
    });
  }

  function openLightbox(i) {
    var dlg = $("lightbox");
    if (!dlg || !GAL.length) return;
    galIndex = (i + GAL.length) % GAL.length;
    var it = GAL[galIndex];
    var img = $("lightboxImg");
    img.src = it.image || "";
    img.alt = pick(it.alt) || pick(it.cap);
    $("lightboxCap").textContent = pick(it.cap);
    var src = $("lightboxSrc");
    if (src) {
      if (it.url) { src.href = it.url; src.hidden = false; }
      else src.hidden = true;
    }
    if (typeof dlg.showModal === "function") {
      if (!dlg.open) dlg.showModal();
    } else {
      dlg.setAttribute("open", "");
    }
  }

  function initLightbox() {
    var dlg = $("lightbox");
    if (!dlg) return;
    var close = $("lightboxClose"), prev = $("lightboxPrev"), next = $("lightboxNext");
    if (close) close.addEventListener("click", function () { dlg.close ? dlg.close() : dlg.removeAttribute("open"); });
    if (prev) prev.addEventListener("click", function () { openLightbox(galIndex - 1); });
    if (next) next.addEventListener("click", function () { openLightbox(galIndex + 1); });
    dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close ? dlg.close() : dlg.removeAttribute("open"); });
    dlg.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { e.preventDefault(); openLightbox(galIndex - 1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); openLightbox(galIndex + 1); }
    });
  }

  /* ---------- 7. 릴스 ---------- */
  function renderReels() {
    var track = $("reelTrack");
    var sec = $("reels");
    if (!track || !CONTENT || !CONTENT.showcase) return;
    if (sec) sec.hidden = !sectionOn("reels");
    if (!sectionOn("reels")) return;
    track.innerHTML = "";
    list(CONTENT.showcase.reels).forEach(function (r, i) {
      var li = el("li", "reels__slide");
      li.setAttribute("role", "listitem");
      var a = el("a", "reel");
      a.href = r.url || URLS.instagram;
      a.target = "_blank"; a.rel = "noopener";
      a.setAttribute("aria-label", pick(r.title) + " — Instagram");

      var media = el("span", "reel__media");
      if (r.video) {
        var v = el("video", "reel__video");
        v.src = r.video;
        if (r.poster) v.poster = r.poster;
        v.width = 720; v.height = 1280;
        v.muted = true; v.loop = true; v.playsInline = true;
        v.preload = "metadata";
        v.setAttribute("muted", "");
        v.setAttribute("loop", "");
        v.setAttribute("playsinline", "");
        v.setAttribute("aria-hidden", "true");
        v.tabIndex = -1;
        media.appendChild(v);
      } else if (r.poster) {
        var p = el("img", "reel__video");
        p.src = r.poster; p.alt = ""; p.loading = "lazy";
        media.appendChild(p);
      }
      media.appendChild(el("span", "reel__no", "REEL " + (i + 1 < 10 ? "0" : "") + (i + 1)));
      var ig = el("span", "reel__ig");
      ig.setAttribute("aria-hidden", "true");
      ig.innerHTML = '<svg viewBox="0 0 24 24"><path d="' + IG_PATH + '"/></svg>';
      media.appendChild(ig);

      var meta = el("span", "reel__meta");
      meta.appendChild(el("span", "reel__t", pick(r.title)));
      meta.appendChild(el("span", "reel__d", pick(r.desc)));
      meta.appendChild(el("span", "reel__cta", "→"));
      a.appendChild(media);
      a.appendChild(meta);
      li.appendChild(a);
      track.appendChild(li);
    });
  }

  function initReels() {
    var root = $("reelsBox");
    if (!root) return;
    var viewport = $("reelViewport");
    var track = $("reelTrack");
    if (!viewport || !track || !track.children.length) return;

    var slides = Array.prototype.slice.call(track.children);
    var videos = Array.prototype.slice.call(track.querySelectorAll("video"));
    var prevBtn = $("reelPrev"), nextBtn = $("reelNext"), toggleBtn = $("reelToggle"), dotsWrap = $("reelDots");
    var reduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    var interval = 6000;
    var index = 0, maxIndex = Math.max(0, slides.length - 1);
    var userPaused = !!(reduce && reduce.matches), hovering = false, inView = false;
    var timer = null, holdTimer = null, frame = null;

    if (dotsWrap) dotsWrap.innerHTML = "";
    var dots = slides.map(function (s, i) {
      var b = el("button", "reels__dot");
      b.type = "button";
      b.setAttribute("aria-label", (i + 1) + " / " + slides.length);
      b.setAttribute("aria-current", i === 0 ? "true" : "false");
      b.addEventListener("click", function () { goTo(i); restart(); });
      if (dotsWrap) dotsWrap.appendChild(b);
      return b;
    });

    function step() {
      if (slides.length < 2) return 0;
      return slides[1].offsetLeft - slides[0].offsetLeft;
    }
    function positions() {
      var s = step();
      if (!s) return;
      var per = Math.max(1, Math.floor((viewport.clientWidth + 4) / s));
      maxIndex = Math.max(0, slides.length - per);
    }
    function goTo(i, instant) {
      index = Math.max(0, Math.min(maxIndex, i));
      var left = slides[index].offsetLeft - slides[0].offsetLeft;
      var smooth = !instant && !(reduce && reduce.matches);
      try { viewport.scrollTo({ left: left, behavior: smooth ? "smooth" : "auto" }); }
      catch (e) { viewport.scrollLeft = left; }
      paint();
    }
    function paint() {
      dots.forEach(function (d, i) { d.setAttribute("aria-current", i === index ? "true" : "false"); });
    }
    function isVisible(slide) {
      var start = slide.offsetLeft - slides[0].offsetLeft;
      var left = viewport.scrollLeft, right = left + viewport.clientWidth;
      return start + slide.offsetWidth > left + 36 && start < right - 36;
    }
    function safePlay(v) {
      if (!v.paused) return;
      var p = v.play();
      if (p && p.catch) p.catch(function () {});
    }
    function playVisible() {
      var run = inView && !userPaused && !document.hidden;
      videos.forEach(function (v) {
        var slide = v.closest ? v.closest(".reels__slide") : null;
        if (run && slide && isVisible(slide)) safePlay(v);
        else if (!v.paused && v.readyState >= 2) v.pause();
      });
    }
    function tick() {
      if (userPaused || hovering || !inView || document.hidden) return;
      goTo(index + 1 > maxIndex ? 0 : index + 1);
    }
    function restart() {
      if (timer) clearInterval(timer);
      timer = setInterval(tick, interval);
    }
    function setToggle() {
      if (!toggleBtn) return;
      toggleBtn.setAttribute("aria-pressed", userPaused ? "true" : "false");
      toggleBtn.setAttribute("aria-label", pick(userPaused ? getPath("ui.reelPlayOn") : getPath("ui.reelPlay")));
    }

    if (prevBtn) prevBtn.addEventListener("click", function () { goTo(index - 1 < 0 ? maxIndex : index - 1); restart(); });
    if (nextBtn) nextBtn.addEventListener("click", function () { goTo(index + 1 > maxIndex ? 0 : index + 1); restart(); });
    if (toggleBtn) toggleBtn.addEventListener("click", function () {
      userPaused = !userPaused; setToggle(); playVisible(); restart();
    });

    root.addEventListener("pointerenter", function () { hovering = true; });
    root.addEventListener("pointerleave", function () { hovering = false; });
    root.addEventListener("focusin", function () { hovering = true; });
    root.addEventListener("focusout", function (e) { if (!root.contains(e.relatedTarget)) hovering = false; });
    root.addEventListener("touchstart", function () {
      hovering = true;
      if (holdTimer) clearTimeout(holdTimer);
    }, { passive: true });
    root.addEventListener("touchend", function () {
      if (holdTimer) clearTimeout(holdTimer);
      holdTimer = setTimeout(function () { hovering = false; }, 6000);
    }, { passive: true });

    viewport.addEventListener("scroll", function () {
      if (frame) return;
      frame = requestAnimationFrame(function () {
        frame = null;
        var s = step();
        if (s) {
          index = Math.max(0, Math.min(maxIndex, Math.round(viewport.scrollLeft / s)));
          paint();
        }
        playVisible();
      });
    }, { passive: true });

    viewport.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { e.preventDefault(); goTo(index - 1 < 0 ? maxIndex : index - 1); restart(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); goTo(index + 1 > maxIndex ? 0 : index + 1); restart(); }
    });

    document.addEventListener("visibilitychange", playVisible);

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { inView = en.isIntersecting; playVisible(); });
      }, { threshold: 0.12 }).observe(root);
    } else { inView = true; }

    var rt = null;
    window.addEventListener("resize", function () {
      if (rt) clearTimeout(rt);
      rt = setTimeout(function () { positions(); goTo(index, true); playVisible(); }, 180);
    });

    if (reduce && reduce.addEventListener) {
      reduce.addEventListener("change", function (e) { userPaused = e.matches; setToggle(); playVisible(); });
    }

    positions(); paint(); setToggle(); restart();
    videos.forEach(function (v) { v.muted = true; });
    playVisible();
    setTimeout(playVisible, 600);
  }

  /* ---------- 8. 공간 · 리뷰 · 예약 · FAQ ---------- */
  function renderSpace() {
    var ul = $("spacePoints");
    var sec = $("space");
    if (!ul || !CONTENT || !CONTENT.space) return;
    if (sec) sec.hidden = !sectionOn("space");
    if (!sectionOn("space")) return;
    ul.innerHTML = "";
    list(CONTENT.space.points).forEach(function (p) {
      var li = el("li", "reveal");
      li.appendChild(el("b", null, pick(p.t)));
      li.appendChild(el("span", null, pick(p.d)));
      ul.appendChild(li);
    });
  }

  function renderReviews() {
    var sec = $("reviews");
    if (sec) sec.hidden = !sectionOn("reviews");
    if (!sectionOn("reviews") || !CONTENT || !CONTENT.reviews) return;
    var kw = $("kwList");
    if (kw) {
      kw.innerHTML = "";
      list(CONTENT.reviews.keywords).forEach(function (k) {
        var li = el("li");
        li.appendChild(el("span", null, pick(k.t)));
        if (k.n) li.appendChild(el("b", null, k.n));
        kw.appendChild(li);
      });
    }
    var qs = $("quoteList");
    if (qs) {
      qs.innerHTML = "";
      list(CONTENT.reviews.items).forEach(function (q) {
        var li = el("li", "quote reveal");
        li.appendChild(el("p", null, pick(q.text)));
        li.appendChild(el("cite", null, pick(q.meta)));
        qs.appendChild(li);
      });
    }
  }

  function renderReserve() {
    var sec = $("reserve");
    if (sec) sec.hidden = !sectionOn("reserve");
    if (!sectionOn("reserve") || !CONTENT || !CONTENT.reserve) return;
    var ol = $("steps");
    if (ol) {
      ol.innerHTML = "";
      list(CONTENT.reserve.steps).forEach(function (s, i) {
        var li = el("li", "reveal");
        li.appendChild(el("span", "steps__no", "STEP " + (i + 1)));
        li.appendChild(el("h3", null, pick(s.title)));
        li.appendChild(el("p", null, pick(s.desc)));
        ol.appendChild(li);
      });
    }
    var notes = $("bookNotes");
    if (notes) {
      notes.innerHTML = "";
      list(CONTENT.reserve.notes).forEach(function (n) {
        notes.appendChild(el("li", null, pick(n)));
      });
    }
  }

  function renderFaq() {
    var wrap = $("faqList");
    var sec = $("faq");
    if (!wrap || !CONTENT || !CONTENT.faq) return;
    if (sec) sec.hidden = !sectionOn("faq");
    if (!sectionOn("faq")) return;
    wrap.innerHTML = "";
    list(CONTENT.faq.items).forEach(function (item, i) {
      var d = el("details", "faq__item reveal");
      if (i === 0) d.open = true;
      var s = el("summary", "faq__q");
      s.appendChild(el("span", "faq__q-t", pick(item.q)));
      s.appendChild(el("span", "faq__plus", ""));
      d.appendChild(s);
      var a = el("div", "faq__a");
      a.appendChild(el("p", null, pick(item.a)));
      d.appendChild(a);
      wrap.appendChild(d);
    });
  }

  /* ---------- 9. 헤더 · 메뉴 · FAB ---------- */
  var hdr = $("hdr"), burger = $("burger"), body = document.body;
  var footerVisible = false;

  function onScroll() {
    if (hdr) hdr.classList.toggle("is-scrolled", window.scrollY > 10);
    var fab = document.querySelector(".fab");
    if (fab) fab.classList.toggle("is-on", window.scrollY > 520 && !footerVisible);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  if ("IntersectionObserver" in window) {
    var ft = document.querySelector(".ft");
    if (ft) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { footerVisible = en.isIntersecting; });
        onScroll();
      }, { threshold: 0.02 }).observe(ft);
    }
  }
  onScroll();

  if (burger) {
    burger.addEventListener("click", function () {
      var open = body.classList.toggle("nav-open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
      burger.setAttribute("aria-label", open ? "메뉴 닫기" : "메뉴 열기");
    });
  }
  document.querySelectorAll("#nav a").forEach(function (a) {
    a.addEventListener("click", function () {
      body.classList.remove("nav-open");
      if (burger) burger.setAttribute("aria-expanded", "false");
    });
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && body.classList.contains("nav-open")) {
      body.classList.remove("nav-open");
      if (burger) burger.setAttribute("aria-expanded", "false");
    }
  });

  /* ---------- 10. 스크롤 리빌 ---------- */
  var observer = null;
  if ("IntersectionObserver" in window) {
    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add("is-in");
          observer.unobserve(en.target);
        }
      });
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.05 });
  }
  function initReveal() {
    var nodes = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
    if (observer) nodes.forEach(function (n) { observer.observe(n); });
    else nodes.forEach(function (n) { n.classList.add("is-in"); });
  }
  setTimeout(function () {
    document.querySelectorAll(".reveal:not(.is-in)").forEach(function (n) {
      var r = n.getBoundingClientRect();
      if (r.top < window.innerHeight * 1.25) n.classList.add("is-in");
    });
  }, 1800);

  /* ---------- 11. 언어 ---------- */
  function renderAll() {
    renderStats();
    renderPillars();
    renderMenu();
    renderGallery();
    renderReels();
    renderSpace();
    renderReviews();
    renderReserve();
    renderFaq();
    initReveal();
  }

  function setLang(next, save) {
    if (!META[next]) next = "kr";
    lang = next;
    applyMeta();
    applyText();
    applyPrimary();
    renderAll();
    if (save) { try { localStorage.setItem(LANG_KEY, lang); } catch (e) {} }
    var u = new URL(window.location.href);
    if (lang === "kr") u.searchParams.delete("lang"); else u.searchParams.set("lang", lang);
    try { history.replaceState(null, "", u.toString()); } catch (e) {}
  }

  document.querySelectorAll(".lang button").forEach(function (b) {
    b.addEventListener("click", function () { setLang(b.getAttribute("data-lang"), true); });
  });

  /* ---------- 12. content.json ---------- */
  function loadContent() {
    var bust = "";
    try {
      var v = localStorage.getItem(CONTENT_KEY);
      if (v) bust = "?v=" + encodeURIComponent(v);
    } catch (e) {}
    return fetch("data/content.json" + bust, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!data || typeof data !== "object") throw new Error("invalid");
        CONTENT = data;
        return CONTENT;
      })
      .catch(function () { CONTENT = null; return null; });
  }

  function initialLang() {
    var q = null;
    try { q = new URLSearchParams(window.location.search).get("lang"); } catch (e) {}
    if (q && META[q]) return q;
    try {
      var s = localStorage.getItem(LANG_KEY);
      if (s && META[s]) return s;
    } catch (e) {}
    return "kr";
  }

  /* ---------- 13. 시작 ---------- */
  lang = initialLang();
  initLightbox();
  applyChannels();
  applyMeta();
  applyPrimary();

  loadContent().then(function () {
    if (CONTENT) {
      applyChannels();
      applyText();
      renderAll();
    }
    applyPrimary();
    initReveal();
    initReels();
    onScroll();
  });
})();
