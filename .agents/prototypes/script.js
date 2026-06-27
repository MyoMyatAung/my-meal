/* ============================================================
   Meal Planner prototype — shared script
   Page-agnostic behaviors only (see §9):
     1. Theme toggle  (localStorage.theme <-> .dark on <html>, swap sun/moon)
     2. Mobile nav drawer (open/close below 860px, click-to-close backdrop)
     3. lucide.createIcons() on DOMContentLoaded
   Page-specific behaviors (filters, chips, counters, modal, banner,
   segmented toggling) ship with their own pages in later steps.
   ============================================================ */

(function () {
  "use strict";

  var STORAGE_KEY = "theme";

  /* ---------- Theme ---------- */

  function getStoredTheme() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function storeTheme(value) {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch (e) {
      /* storage may be unavailable (private mode) — non-fatal */
    }
  }

  function isDark() {
    return document.documentElement.classList.contains("dark");
  }

  function applyThemeIcon() {
    // Show the icon for the mode you can switch TO:
    // dark active -> show sun (switch to light); light active -> show moon.
    document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
      var sun = btn.querySelector("[data-theme-icon-sun]");
      var moon = btn.querySelector("[data-theme-icon-moon]");
      if (sun) sun.hidden = !isDark();
      if (moon) moon.hidden = isDark();
      btn.setAttribute("aria-label", isDark() ? "Switch to light theme" : "Switch to dark theme");
    });
  }

  function toggleTheme() {
    var next = isDark() ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    storeTheme(next);
    applyThemeIcon();
  }

  function initThemeToggle() {
    // Honour a stored preference on load (also re-applied inline in <head>
    // to avoid a flash, this is the durable application + icon sync).
    var stored = getStoredTheme();
    if (stored === "dark" || stored === "light") {
      document.documentElement.classList.toggle("dark", stored === "dark");
    }
    applyThemeIcon();
    document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
      btn.addEventListener("click", toggleTheme);
    });
  }

  /* ---------- Mobile nav drawer ---------- */

  function initMobileNav() {
    var sidebar = document.querySelector(".sidebar");
    var backdrop = document.querySelector(".nav-backdrop");
    var openBtn = document.querySelector("[data-nav-open]");
    if (!sidebar) return;

    function open() {
      sidebar.setAttribute("data-open", "true");
      if (backdrop) backdrop.setAttribute("data-open", "true");
      if (openBtn) openBtn.setAttribute("aria-expanded", "true");
    }

    function close() {
      sidebar.removeAttribute("data-open");
      if (backdrop) backdrop.removeAttribute("data-open");
      if (openBtn) openBtn.setAttribute("aria-expanded", "false");
    }

    function isOpen() {
      return sidebar.getAttribute("data-open") === "true";
    }

    if (openBtn) {
      openBtn.addEventListener("click", function () {
        if (isOpen()) close();
        else open();
      });
    }
    if (backdrop) backdrop.addEventListener("click", close);

    // Close after following a nav link, and on Escape.
    sidebar.addEventListener("click", function (e) {
      if (e.target.closest('a[href]')) close();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && isOpen()) close();
    });

    // Reset drawer state when resizing up to desktop.
    window.addEventListener("resize", function () {
      if (window.innerWidth > 860 && isOpen()) close();
    });
  }

  /* ---------- Segmented control helper ---------- */

  function initSegmentedControls() {
    document.querySelectorAll(".segmented").forEach(function (group) {
      group.addEventListener("click", function (e) {
        var btn = e.target.closest(".segmented__btn");
        if (!btn) return;
        group.querySelectorAll(".segmented__btn").forEach(function (b) {
          b.setAttribute("aria-pressed", "false");
        });
        btn.setAttribute("aria-pressed", "true");
      });
    });
  }

  /* ---------- URL query param helper ---------- */

  function getQueryParam(name) {
    var params = new URLSearchParams(window.location.search);
    return params.get(name);
  }

  /* ---------- Boot ---------- */

  function boot() {
    initThemeToggle();
    initMobileNav();
    initSegmentedControls();
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
