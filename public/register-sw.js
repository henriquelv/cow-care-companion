if ("serviceWorker" in navigator) {
  // Registra cedo para que o primeiro acesso online já prepare o uso offline.
  navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
}
