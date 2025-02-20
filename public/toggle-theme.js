const primaryColorScheme = ""; // "light" | "dark"

// Get theme data from local storage
const currentTheme = localStorage.getItem("theme");

function getPreferTheme() {
  // return theme value in local storage if it is set
  if (currentTheme) return currentTheme;

  // return primary color scheme if it is set
  if (primaryColorScheme) return primaryColorScheme;

  // return user device's prefer color scheme
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

window.theme = getPreferTheme();

function setPreference() {
  localStorage.setItem("theme", theme);
  setCommentsTheme(theme);
  reflectPreference();
}

function setCommentsTheme(theme) {
  const iframe = document.querySelector("iframe.giscus-frame");
  if (!iframe) return;
  iframe.contentWindow.postMessage(
    { giscus: { setConfig: { theme } } },
    "https://giscus.app"
  );
}

function reflectPreference() {
  document.firstElementChild.setAttribute("data-theme", window.theme);

  document
    .querySelector("#theme-btn")
    ?.setAttribute("aria-label", window.theme);
}

// set early so no page flashes / CSS is made aware
reflectPreference();

window.addEventListener("load", () => {
  // set on load so screen readers can get the latest value on the button
  setCommentsTheme(window.theme);
  reflectPreference();

  // now this script can find and listen for clicks on the control
  document.querySelector("#theme-btn")?.addEventListener("click", () => {
    window.theme = window.theme === "light" ? "dark" : "light";
    setPreference();
  });
});

// sync with system changes
window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", ({ matches: isDark }) => {
    window.theme = isDark ? "dark" : "light";
    setPreference();
  });
