(function () {
  function rowHtml(prefix, i, cols) {
    if (prefix === "rss") {
      return (
        "<tr><td><input name=\"rss_url_" +
        i +
        '" type="url" placeholder="https://example.com/rss.xml" value="' +
        (cols[0] || "") +
        '"></td><td><button type="button" class="link-btn row-remove">हटाएं</button></td></tr>'
      );
    }
    if (prefix === "breaking") {
      return (
        "<tr><td><input name=\"breaking_text_" +
        i +
        '" value="' +
        (cols[0] || "") +
        '"></td><td><input name="breaking_url_' +
        i +
        '" value="' +
        (cols[1] || "/") +
        '"></td><td><button type="button" class="link-btn row-remove">हटाएं</button></td></tr>'
      );
    }
    return (
      "<tr><td><input name=\"slider_title_" +
      i +
      '" value="' +
      (cols[0] || "") +
      '"></td><td><input name="slider_image_' +
      i +
      '" value="' +
      (cols[1] || "") +
      '"></td><td><input name="slider_link_' +
      i +
      '" value="' +
      (cols[2] || "") +
      '"></td><td><button type="button" class="link-btn row-remove">हटाएं</button></td></tr>'
    );
  }

  function bindTable(tableId, prefix, addBtnAttr) {
    var tbody = document.querySelector("#" + tableId + " tbody");
    if (!tbody) return;
    document.querySelector("[" + addBtnAttr + "]")?.addEventListener("click", function () {
      var i = tbody.querySelectorAll("tr").length;
      tbody.insertAdjacentHTML("beforeend", rowHtml(prefix, i, ["", prefix === "breaking" ? "/" : ""]));
    });
    tbody.addEventListener("click", function (e) {
      if (!e.target.classList.contains("row-remove")) return;
      e.target.closest("tr")?.remove();
      tbody.querySelectorAll("tr").forEach(function (tr, idx) {
        tr.querySelectorAll("input").forEach(function (inp) {
          var n = inp.getAttribute("name");
          if (!n) return;
          inp.setAttribute("name", n.replace(/_\d+$/, "_" + idx));
        });
      });
    });
  }

  bindTable("rss-feed-table", "rss", "data-add-rss");
  bindTable("breaking-table", "breaking", "data-add-breaking");
  bindTable("slider-table", "slider", "data-add-slider");
})();
