(function () {
  document.querySelectorAll("[data-copy-url]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var url = btn.getAttribute("data-copy-url");
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () {
          btn.textContent = "कॉपी हो गया!";
          setTimeout(function () {
            btn.textContent = "लिंक कॉपी";
          }, 2000);
        });
      } else {
        prompt("लिंक कॉपी करें:", url);
      }
    });
  });
})();
