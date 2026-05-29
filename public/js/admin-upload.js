/**
 * Easy image upload: pick file → preview → base64 in hidden field on submit.
 */
(function () {
  var MAX_W = 1920;
  var QUALITY = 0.88;

  function resizeFile(file, cb) {
    if (!file.type.match(/^image\//)) {
      cb(null, "केवल इमेज फाइल चुनें (JPG, PNG, WebP, GIF)");
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      cb(null, "फाइल 6MB से छोटी होनी चाहिए");
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var w = img.width;
        var h = img.height;
        if (w > MAX_W) {
          h = Math.round((h * MAX_W) / w);
          w = MAX_W;
        }
        var canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        var mime = file.type === "image/png" ? "image/png" : "image/jpeg";
        cb(canvas.toDataURL(mime, QUALITY), null);
      };
      img.onerror = function () {
        cb(null, "इमेज पढ़ नहीं सकी");
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function bindUpload(inputId, previewId, hiddenId, statusId) {
    var input = document.getElementById(inputId);
    var preview = document.getElementById(previewId);
    var hidden = document.getElementById(hiddenId);
    var status = statusId ? document.getElementById(statusId) : null;
    if (!input || !hidden) return;

    input.addEventListener("change", function () {
      var file = input.files && input.files[0];
      if (!file) return;
      if (status) status.textContent = "अपलोड तैयार हो रहा है…";
      resizeFile(file, function (dataUrl, err) {
        if (err) {
          if (status) status.textContent = err;
          return;
        }
        hidden.value = dataUrl;
        if (preview) {
          preview.src = dataUrl;
          preview.style.display = "block";
        }
        if (status) status.textContent = "इमेज तैयार — सेव दबाएं";
      });
    });
  }

  bindUpload("logo-file", "logo-preview", "logo-base64", "logo-status");
  bindUpload("article-image-file", "article-image-preview", "image-base64", "article-image-status");
})();
