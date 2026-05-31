// Header ad banner slider functionality
(function() {
  const adBanner = document.getElementById('header-ad-banner');
  if (!adBanner) return;

  const slider = adBanner.querySelector('.header-ad-slider');
  if (!slider) return;

  const slides = slider.querySelectorAll('.header-ad-slide');
  if (slides.length === 0) return;

  const dotsContainer = slider.querySelector('.header-ad-dots');
  const prevBtn = slider.querySelector('.header-ad-prev');
  const nextBtn = slider.querySelector('.header-ad-next');

  let currentIndex = 0;
  let autoPlayInterval;

  // Create dots if they don't exist
  if (!dotsContainer) {
    const dotsDiv = document.createElement('div');
    dotsDiv.className = 'header-ad-dots';
    slider.appendChild(dotsDiv);
    
    slides.forEach((_, index) => {
      const dot = document.createElement('button');
      dot.className = 'header-ad-dot' + (index === 0 ? ' active' : '');
      dot.setAttribute('aria-label', 'Go to slide ' + (index + 1));
      dot.addEventListener('click', () => goToSlide(index));
      dotsDiv.appendChild(dot);
    });
  }

  // Create navigation buttons if they don't exist
  if (!prevBtn) {
    const prevDiv = document.createElement('button');
    prevDiv.className = 'header-ad-nav header-ad-prev';
    prevDiv.setAttribute('aria-label', 'Previous slide');
    prevDiv.innerHTML = '‹';
    prevDiv.addEventListener('click', () => goToSlide(currentIndex - 1));
    slider.appendChild(prevDiv);
  }

  if (!nextBtn) {
    const nextDiv = document.createElement('button');
    nextDiv.className = 'header-ad-nav header-ad-next';
    nextDiv.setAttribute('aria-label', 'Next slide');
    nextDiv.innerHTML = '›';
    nextDiv.addEventListener('click', () => goToSlide(currentIndex + 1));
    slider.appendChild(nextDiv);
  }

  function goToSlide(index) {
    if (index < 0) {
      index = slides.length - 1;
    } else if (index >= slides.length) {
      index = 0;
    }

    slides.forEach((slide, i) => {
      slide.classList.toggle('is-active', i === index);
    });

    const dots = slider.querySelectorAll('.header-ad-dot');
    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === index);
    });

    currentIndex = index;
    resetAutoPlay();
  }

  function nextSlide() {
    goToSlide(currentIndex + 1);
  }

  function resetAutoPlay() {
    clearInterval(autoPlayInterval);
    autoPlayInterval = setInterval(nextSlide, 5000);
  }

  // Initialize first slide
  slides[0].classList.add('is-active');

  // Start auto-play
  resetAutoPlay();

  // Pause on hover
  slider.addEventListener('mouseenter', () => {
    clearInterval(autoPlayInterval);
  });

  slider.addEventListener('mouseleave', () => {
    resetAutoPlay();
  });
})();
