(function () {
  function rowHtml(prefix, i, label, url) {
    return (
      "<tr>" +
      '<td><input name="' + prefix + '_label_' + i + '" value="' + (label || "") + '" placeholder="लेबल"></td>' +
      '<td><input name="' + prefix + '_url_' + i + '" value="' + (url || "") + '" placeholder="/ या https://"></td>' +
      '<td><button type="button" class="link-btn row-remove">हटाएं</button></td>' +
      "</tr>"
    );
  }

  function bindTable(tableId, prefix, countId) {
    var tbody = document.querySelector("#" + tableId + " tbody");
    var countInput = document.getElementById(countId);
    if (!tbody || !countInput) return;

    function updateCount() {
      countInput.value = String(tbody.querySelectorAll("tr").length);
    }

    document.querySelector("[data-add-" + prefix + "]")?.addEventListener("click", function () {
      var i = tbody.querySelectorAll("tr").length;
      tbody.insertAdjacentHTML("beforeend", rowHtml(prefix, i, "", "/"));
      updateCount();
    });

    tbody.addEventListener("click", function (e) {
      if (e.target.classList.contains("row-remove")) {
        e.target.closest("tr")?.remove();
        tbody.querySelectorAll("tr").forEach(function (tr, idx) {
          tr.querySelectorAll("input").forEach(function (input) {
            var name = input.getAttribute("name");
            if (!name) return;
            input.setAttribute("name", name.replace(/_\d+$/, "_" + idx));
          });
        });
        updateCount();
      }
    });

    updateCount();
  }

  bindTable("menu-table", "menu", "menu_count");
  bindTable("top-table", "top", "top_count");
})();
