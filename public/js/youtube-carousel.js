(function() {
  const grid = document.getElementById('youtubeVideosGrid');
  const prevBtn = document.getElementById('youtubeCarouselPrev');
  const nextBtn = document.getElementById('youtubeCarouselNext');

  if (!grid || !prevBtn || !nextBtn) return;

  const cardWidth = 280;
  const scrollAmount = cardWidth * 2;

  function updateNavButtons() {
    const maxScroll = grid.scrollWidth - grid.clientWidth;
    prevBtn.disabled = grid.scrollLeft <= 0;
    nextBtn.disabled = grid.scrollLeft >= maxScroll - 1;
  }

  prevBtn.addEventListener('click', () => {
    grid.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
  });

  nextBtn.addEventListener('click', () => {
    grid.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  });

  grid.addEventListener('scroll', updateNavButtons);
  window.addEventListener('resize', updateNavButtons);

  updateNavButtons();
})();
