// Theme toggle functionality
(function() {
  const themeToggle = document.getElementById('theme-toggle');
  if (!themeToggle) return;

  // Check for saved theme preference or default to light
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);

  // Toggle theme on button click
  themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Add animation class
    document.body.style.transition = 'background-color 0.3s ease, color 0.3s ease';
    setTimeout(() => {
      document.body.style.transition = '';
    }, 300);
  });

  // Listen for system theme changes
  if (window.matchMedia) {
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    darkModeQuery.addEventListener('change', (e) => {
      if (!localStorage.getItem('theme')) {
        const newTheme = e.matches ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
      }
    });
  }
})();

// Mobile menu toggle functionality
(function() {
  const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
  const primaryNav = document.getElementById('primary-nav');
  
  if (!mobileMenuToggle || !primaryNav) return;

  mobileMenuToggle.addEventListener('click', () => {
    mobileMenuToggle.classList.toggle('active');
    primaryNav.classList.toggle('active');
    
    // Prevent body scroll when menu is open
    document.body.classList.toggle('menu-open');
  });

  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (primaryNav.classList.contains('active') && 
        !primaryNav.contains(e.target) && 
        !mobileMenuToggle.contains(e.target)) {
      mobileMenuToggle.classList.remove('active');
      primaryNav.classList.remove('active');
      document.body.classList.remove('menu-open');
    }
  });

  // Close menu when clicking on a menu item
  const menuLinks = primaryNav.querySelectorAll('.primary-menu a');
  menuLinks.forEach(link => {
    link.addEventListener('click', () => {
      mobileMenuToggle.classList.remove('active');
      primaryNav.classList.remove('active');
      document.body.classList.remove('menu-open');
    });
  });
})();
