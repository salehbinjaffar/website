(function () {
  var root = document.querySelector("[data-slider]");
  if (!root) return;

  var slides = root.querySelectorAll(".slider-slide");
  var dots = root.querySelectorAll(".slider-dot");
  var prev = root.querySelector(".slider-prev");
  var next = root.querySelector(".slider-next");
  var index = 0;
  var timer;

  function show(i) {
    if (!slides.length) return;
    index = (i + slides.length) % slides.length;
    slides.forEach(function (s, n) {
      s.classList.toggle("is-active", n === index);
    });
    dots.forEach(function (d, n) {
      d.classList.toggle("active", n === index);
    });
  }

  function nextSlide() {
    show(index + 1);
  }

  function start() {
    stop();
    timer = setInterval(nextSlide, 5000);
  }

  function stop() {
    if (timer) clearInterval(timer);
  }

  if (prev) prev.addEventListener("click", function () { show(index - 1); start(); });
  if (next) next.addEventListener("click", function () { show(index + 1); start(); });
  dots.forEach(function (d) {
    d.addEventListener("click", function () {
      show(Number(d.getAttribute("data-go")) || 0);
      start();
    });
  });

  root.addEventListener("mouseenter", stop);
  root.addEventListener("mouseleave", start);

  show(0);
  start();
})();
