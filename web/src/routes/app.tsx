import { onMount } from "solid-js";
import { clientOnly } from "@solidjs/start";

// The workspace relies on IndexedDB, canvas, and WASM, so it never renders on
// the server; the prerendered page is only its document shell.
const PracticeApp = clientOnly(() => import("../practice-app"));

export default function AppRoute() {
  onMount(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    const serviceWorkerUrl = `/app/sw.js?v=${__BUILD_ID__}`;
    const register = () =>
      void navigator.serviceWorker.register(serviceWorkerUrl, {
        scope: "/app/",
        updateViaCache: "none",
      });
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  });

  return <PracticeApp />;
}
