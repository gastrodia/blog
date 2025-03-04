var BigPicture = (function () {
  var t,
    n,
    e,
    o,
    i,
    r,
    a,
    c,
    p,
    s,
    l,
    d,
    u,
    f,
    m,
    b,
    g,
    h,
    x,
    v,
    y,
    w,
    _,
    T,
    k,
    M,
    S,
    L,
    E,
    A,
    H,
    z,
    C,
    I = [],
    O = {},
    D = "appendChild",
    V = "createElement",
    N = "removeChild";
  function W() {
    var n = t.getBoundingClientRect();
    return (
      "transform:translate3D(" +
      (n.left - (e.clientWidth - n.width) / 2) +
      "px, " +
      (n.top - (e.clientHeight - n.height) / 2) +
      "px, 0) scale3D(" +
      t.clientWidth / o.clientWidth +
      ", " +
      t.clientHeight / o.clientHeight +
      ", 0)"
    );
  }
  function q(t) {
    var n = A.length - 1;
    if (!u) {
      if ((t > 0 && E === n) || (t < 0 && !E)) {
        if (!C.loop)
          return (
            j(i, ""),
            void setTimeout(
              j,
              9,
              i,
              "animation:" +
                (t > 0 ? "bpl" : "bpf") +
                " .3s;transition:transform .35s"
            )
          );
        E = t > 0 ? -1 : n + 1;
      }
      if (
        ([(E = Math.max(0, Math.min(E + t, n))) - 1, E, E + 1].forEach(
          function (t) {
            if (((t = Math.max(0, Math.min(t, n))), !O[t])) {
              var e = A[t].src,
                o = document[V]("IMG");
              o.addEventListener("load", F.bind(null, e)),
                (o.src = e),
                (O[t] = o);
            }
          }
        ),
        O[E].complete)
      )
        return B(t);
      (u = 1),
        j(m, "opacity:.4;"),
        e[D](m),
        (O[E].onload = function () {
          y && B(t);
        }),
        (O[E].onerror = function () {
          (A[E] = {
            error: "Error loading image",
          }),
            y && B(t);
        });
    }
  }
  function B(n) {
    u && (e[N](m), (u = 0));
    var r = A[E];
    if (r.error) alert(r.error);
    else {
      var a = e.querySelector("img:last-of-type");
      j(
        (i = o = O[E]),
        "animation:" +
          (n > 0 ? "bpfl" : "bpfr") +
          " .35s;transition:transform .35s"
      ),
        j(a, "animation:" + (n > 0 ? "bpfol" : "bpfor") + " .35s both"),
        e[D](i),
        r.el && (t = r.el);
    }
    (H.innerHTML = E + 1 + "/" + A.length), X(A[E].caption), M && M([i, A[E]]);
  }
  function P() {
    var t,
      n,
      e = 0.95 * window.innerHeight,
      o = 0.95 * window.innerWidth,
      i = C.dimensions || [1920, 1080],
      r = i[0],
      a = i[1],
      p = a / r;
    p > e / o ? (n = (t = Math.min(a, e)) / p) : (t = (n = Math.min(r, o)) * p),
      (c.style.cssText += "width:" + n + "px;height:" + t + "px;");
  }
  function G(t) {
    ~[1, 4].indexOf(o.readyState)
      ? (U(),
        setTimeout(function () {
          o.play();
        }, 99))
      : o.error
      ? U(t)
      : (f = setTimeout(G, 35, t));
  }
  function R(n) {
    C.noLoader ||
      (n &&
        j(
          m,
          "top:" +
            t.offsetTop +
            "px;left:" +
            t.offsetLeft +
            "px;height:" +
            t.clientHeight +
            "px;width:" +
            t.clientWidth +
            "px"
        ),
      t.parentElement[n ? D : N](m),
      (u = n));
  }
  function X(t) {
    t && (g.innerHTML = t),
      j(b, "opacity:" + (t ? "1;pointer-events:auto" : "0"));
  }
  function F(t) {
    !~I.indexOf(t) && I.push(t);
  }
  function U(t) {
    if ((u && R(), T && T(), "string" == typeof t))
      return (
        $(),
        C.onError
          ? C.onError()
          : alert("Error: The requested " + t + " could not be loaded.")
      );
    _ && F(s),
      (o.style.cssText += W()),
      j(e, "opacity:1;pointer-events:auto"),
      k && (k = setTimeout(k, 410)),
      (v = 1),
      (y = !!A),
      setTimeout(function () {
        (o.style.cssText += "transition:transform .35s;transform:none"),
          h && setTimeout(X, 250, h);
      }, 60);
  }
  function Y(t) {
    var n = t ? t.target : e,
      i = [b, x, r, a, g, L, S, m];
    n.blur(),
      w ||
        ~i.indexOf(n) ||
        ((o.style.cssText += W()),
        j(e, "pointer-events:auto"),
        setTimeout($, 350),
        clearTimeout(k),
        (v = 0),
        (w = 1));
  }
  function $() {
    if (
      ((o === c ? p : o).removeAttribute("src"),
      document.body[N](e),
      e[N](o),
      j(e, ""),
      j(o, ""),
      X(0),
      y)
    ) {
      for (var t = e.querySelectorAll("img"), n = 0; n < t.length; n++)
        e[N](t[n]);
      u && e[N](m),
        e[N](H),
        (y = A = 0),
        (O = {}),
        z || e[N](S),
        z || e[N](L),
        (i.onload = U),
        (i.onerror = U.bind(null, "image"));
    }
    C.onClose && C.onClose(), (w = u = 0);
  }
  function j(t, n) {
    t.style.cssText = n;
  }
  return function (w) {
    var O;
    return (
      n ||
        (function () {
          var t, s;
          function d(t) {
            var n = document[V]("button");
            return (
              (n.className = t),
              (n.innerHTML =
                '<svg viewBox="0 0 48 48"><path d="M28 24L47 5a3 3 0 1 0-4-4L24 20 5 1a3 3 0 1 0-4 4l19 19L1 43a3 3 0 1 0 4 4l19-19 19 19a3 3 0 0 0 4 0v-4L28 24z"/></svg>'),
              n
            );
          }
          function f(t, n) {
            var e = document[V]("button");
            return (
              (e.className = "bp-lr"),
              (e.innerHTML =
                '<svg viewBox="0 0 129 129" height="70" fill="#fff"><path d="M88.6 121.3c.8.8 1.8 1.2 2.9 1.2s2.1-.4 2.9-1.2a4.1 4.1 0 0 0 0-5.8l-51-51 51-51a4.1 4.1 0 0 0-5.8-5.8l-54 53.9a4.1 4.1 0 0 0 0 5.8l54 53.9z"/></svg>'),
              j(e, n),
              (e.onclick = function (n) {
                n.stopPropagation(), q(t);
              }),
              e
            );
          }
          var h = document[V]("STYLE");
          (h.innerHTML =
            "#bp_caption,#bp_container{bottom:0;left:0;right:0;position:fixed;opacity:0}#bp_container>*,#bp_loader{position:absolute;right:0;z-index:10}#bp_container,#bp_caption,#bp_container svg{pointer-events:none}#bp_container{top:0;z-index:9999;background:rgba(0,0,0,.7);opacity:0;transition:opacity .35s}#bp_loader{top:0;left:0;bottom:0;display:flex;align-items:center;cursor:wait;background:0;z-index:9}#bp_loader svg{width:50%;max-width:300px;max-height:50%;margin:auto;animation:bpturn 1s infinite linear}#bp_aud,#bp_container img,#bp_sv,#bp_vid{user-select:none;max-height:96%;max-width:96%;top:0;bottom:0;left:0;margin:auto;box-shadow:0 0 3em rgba(0,0,0,.4);z-index:-1}#bp_sv{background:#111}#bp_sv svg{width:66px}#bp_caption{font-size:.9em;padding:1.3em;background:rgba(15,15,15,.94);color:#fff;text-align:center;transition:opacity .3s}#bp_aud{width:650px;top:calc(50% - 20px);bottom:auto;box-shadow:none}#bp_count{left:0;right:auto;padding:14px;color:rgba(255,255,255,.7);font-size:22px;cursor:default}#bp_container button{position:absolute;border:0;outline:0;background:0;cursor:pointer;transition:all .1s}#bp_container>.bp-x{padding:0;height:41px;width:41px;border-radius:100%;top:8px;right:14px;opacity:.8;line-height:1}#bp_container>.bp-x:focus,#bp_container>.bp-x:hover{background:rgba(255,255,255,.2)}.bp-x svg,.bp-xc svg{height:21px;width:20px;fill:#fff;vertical-align:top;}.bp-xc svg{width:16px}#bp_container .bp-xc{left:2%;bottom:100%;padding:9px 20px 7px;background:#d04444;border-radius:2px 2px 0 0;opacity:.85}#bp_container .bp-xc:focus,#bp_container .bp-xc:hover{opacity:1}.bp-lr{top:50%;top:calc(50% - 130px);padding:99px 0;width:6%;background:0;border:0;opacity:.4;transition:opacity .1s}.bp-lr:focus,.bp-lr:hover{opacity:.8}@keyframes bpf{50%{transform:translatex(15px)}100%{transform:none}}@keyframes bpl{50%{transform:translatex(-15px)}100%{transform:none}}@keyframes bpfl{0%{opacity:0;transform:translatex(70px)}100%{opacity:1;transform:none}}@keyframes bpfr{0%{opacity:0;transform:translatex(-70px)}100%{opacity:1;transform:none}}@keyframes bpfol{0%{opacity:1;transform:none}100%{opacity:0;transform:translatex(-70px)}}@keyframes bpfor{0%{opacity:1;transform:none}100%{opacity:0;transform:translatex(70px)}}@keyframes bpturn{0%{transform:none}100%{transform:rotate(360deg)}}@media (max-width:600px){.bp-lr{font-size:15vw}}"),
            document.head[D](h),
            ((e = document[V]("DIV")).id = "bp_container"),
            (e.onclick = Y),
            (l = d("bp-x")),
            e[D](l),
            "ontouchend" in window &&
              window.visualViewport &&
              ((z = 1),
              (e.ontouchstart = function (n) {
                var e = n.touches,
                  o = n.changedTouches;
                (s = e.length > 1), (t = o[0].pageX);
              }),
              (e.ontouchend = function (n) {
                var e = n.changedTouches;
                if (y && !s && window.visualViewport.scale <= 1) {
                  var o = e[0].pageX - t;
                  o < -30 && q(1), o > 30 && q(-1);
                }
              })),
            (i = document[V]("IMG")),
            ((r = document[V]("VIDEO")).id = "bp_vid"),
            r.setAttribute("playsinline", 1),
            (r.controls = 1),
            (r.loop = 1),
            ((a = document[V]("audio")).id = "bp_aud"),
            (a.controls = 1),
            (a.loop = 1),
            ((H = document[V]("span")).id = "bp_count"),
            ((b = document[V]("DIV")).id = "bp_caption"),
            ((x = d("bp-xc")).onclick = X.bind(null, 0)),
            b[D](x),
            (g = document[V]("SPAN")),
            b[D](g),
            e[D](b),
            (S = f(1, "transform:scalex(-1)")),
            (L = f(-1, "left:0;right:auto")),
            ((m = document[V]("DIV")).id = "bp_loader"),
            (m.innerHTML =
              '<svg viewbox="0 0 32 32" fill="#fff" opacity=".8"><path d="M16 0a16 16 0 0 0 0 32 16 16 0 0 0 0-32m0 4a12 12 0 0 1 0 24 12 12 0 0 1 0-24" fill="#000" opacity=".5"/><path d="M16 0a16 16 0 0 1 16 16h-4A12 12 0 0 0 16 4z"/></svg>'),
            ((c = document[V]("DIV")).id = "bp_sv"),
            (p = document[V]("IFRAME")).setAttribute("allowfullscreen", 1),
            (p.allow = "autoplay; fullscreen"),
            (p.onload = function () {
              return c[N](m);
            }),
            j(
              p,
              "border:0;position:absolute;height:100%;width:100%;left:0;top:0"
            ),
            c[D](p),
            (i.onload = U),
            (i.onerror = U.bind(null, "image")),
            window.addEventListener("resize", function () {
              y || (u && R(1)), o === c && P();
            }),
            document.addEventListener("keyup", function (t) {
              var n = t.keyCode;
              27 === n && v && Y(),
                y &&
                  (39 === n && q(1),
                  37 === n && q(-1),
                  38 === n && q(10),
                  40 === n && q(-10));
            }),
            document.addEventListener("keydown", function (t) {
              y && ~[37, 38, 39, 40].indexOf(t.keyCode) && t.preventDefault();
            }),
            document.addEventListener(
              "focus",
              function (t) {
                v && !e.contains(t.target) && (t.stopPropagation(), l.focus());
              },
              1
            ),
            (n = 1);
        })(),
      u && (clearTimeout(f), $()),
      (C = w),
      (d = w.ytSrc || w.vimeoSrc),
      (T = w.animationStart),
      (k = w.animationEnd),
      (M = w.onChangeImage),
      (_ = 0),
      (h = (t = w.el).getAttribute("data-caption")),
      w.gallery
        ? (function (n, r) {
            var a = C.galleryAttribute || "data-bp";
            if (Array.isArray(n)) (A = n), (h = n[(E = r || 0)].caption);
            else {
              var c = (A = [].slice.call(
                "string" == typeof n
                  ? document.querySelectorAll(n + " [" + a + "]")
                  : n
              )).indexOf(t);
              (E = 0 === r || r ? r : -1 !== c ? c : 0),
                (A = A.map(function (t) {
                  return {
                    el: t,
                    src: t.getAttribute(a),
                    caption: t.getAttribute("data-caption"),
                  };
                }));
            }
            (_ = 1),
              !~I.indexOf((s = A[E].src)) && R(1),
              A.length > 1
                ? (e[D](H),
                  (H.innerHTML = E + 1 + "/" + A.length),
                  z || (e[D](S), e[D](L)))
                : (A = 0),
              ((o = i).src = s);
          })(w.gallery, w.position)
        : d || w.iframeSrc
        ? ((o = c),
          C.ytSrc
            ? (W =
                "https://www.youtube" +
                (C.ytNoCookie ? "-nocookie" : "") +
                ".com/embed/" +
                d +
                "?html5=1&rel=0&playsinline=1&autoplay=1")
            : C.vimeoSrc
            ? (W = "https://player.vimeo.com/video/" + d + "?autoplay=1")
            : C.iframeSrc && (W = C.iframeSrc),
          j(m, ""),
          c[D](m),
          (p.src = W),
          P(),
          setTimeout(U, 9))
        : w.imgSrc
        ? ((_ = 1), !~I.indexOf((s = w.imgSrc)) && R(1), ((o = i).src = s))
        : w.audio
        ? (R(1), ((o = a).src = w.audio), G("audio file"))
        : w.vidSrc
        ? (R(1),
          w.dimensions && j(r, "width:" + w.dimensions[0] + "px"),
          (O = w.vidSrc),
          Array.isArray(O)
            ? ((o = r.cloneNode()),
              O.forEach(function (t) {
                var n = document[V]("SOURCE");
                (n.src = t),
                  (n.type = "video/" + t.match(/.(\w+)$/)[1]),
                  o[D](n);
              }))
            : ((o = r).src = O),
          G("video"))
        : ((o = i).src =
            "IMG" === t.tagName
              ? t.src
              : window
                  .getComputedStyle(t)
                  .backgroundImage.replace(/^url|[(|)|'|"]/g, "")),
      e[D](o),
      document.body[D](e),
      {
        close: Y,
        next: function () {
          return q(1);
        },
        prev: function () {
          return q(-1);
        },
      }
    );
    var W;
  };
})();
