// @refresh reload
import { StartClient, mount } from "@solidjs/start/client";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("App root is missing.");
mount(() => <StartClient />, root);
