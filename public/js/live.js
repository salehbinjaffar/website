(function () {
  var video = document.getElementById("live-player");
  if (!video) return;
  var src = video.getAttribute("data-hls");
  if (!src) return;

  var unmuteBtn = document.getElementById("live-unmute");

  function showUnmuteIfNeeded() {
    if (!unmuteBtn) return;
    if (video.muted) {
      unmuteBtn.hidden = false;
    } else {
      unmuteBtn.hidden = true;
    }
  }

  function tryAutoplay() {
    video.muted = true;
    return video.play().then(function () {
      showUnmuteIfNeeded();
    }).catch(function () {
      if (unmuteBtn) unmuteBtn.hidden = false;
    });
  }

  if (unmuteBtn) {
    unmuteBtn.addEventListener("click", function () {
      video.muted = false;
      video.volume = 1;
      unmuteBtn.hidden = true;
      video.play().catch(function () {});
    });
  }

  video.addEventListener("volumechange", showUnmuteIfNeeded);

  function pickAutoLevel(hls) {
    if (!hls || !hls.levels || !hls.levels.length) return;
    hls.currentLevel = -1;
  }

  function onResize(hls) {
    if (!hls) return;
    pickAutoLevel(hls);
  }

  if (video.canPlayType("application/vnd.apple.mpegurl")) {
    video.src = src;
    video.addEventListener("loadedmetadata", tryAutoplay, { once: true });
    window.addEventListener("orientationchange", function () {
      setTimeout(tryAutoplay, 300);
    });
    return;
  }

  if (typeof Hls !== "undefined" && Hls.isSupported()) {
    var hls = new Hls({
      enableWorker: true,
      capLevelToPlayerSize: true,
      startLevel: -1,
      maxBufferLength: 25,
      maxMaxBufferLength: 60,
    });
    hls.loadSource(src);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, function () {
      pickAutoLevel(hls);
      tryAutoplay();
    });

    hls.on(Hls.Events.LEVEL_SWITCHED, function () {
      var level = hls.levels[hls.currentLevel];
      if (level && level.height) {
        video.setAttribute("data-quality", level.height + "p");
      }
    });

    var resizeTimer;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        onResize(hls);
      }, 200);
    });
    window.addEventListener("orientationchange", function () {
      setTimeout(function () {
        onResize(hls);
        tryAutoplay();
      }, 400);
    });

    hls.on(Hls.Events.ERROR, function (_, data) {
      if (data.fatal) {
        console.error("HLS error", data);
        var msg = document.createElement("p");
        msg.className = "live-placeholder";
        msg.textContent =
          "स्ट्रीम लोड नहीं हो सकी। पेज रिफ्रेश करें या बाद में कोशिश करें।";
        video.parentNode.appendChild(msg);
      }
    });
    return;
  }

  video.outerHTML =
    '<p class="live-placeholder">इस ब्राउज़र में HLS समर्थित नहीं है। Safari या Chrome आज़माएं।</p>';
})();
