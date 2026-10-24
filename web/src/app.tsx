import { Suspense } from "solid-js";
import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";

// Each page ships its own global stylesheet, so plain links do full page loads
// instead of client-side navigation that would mix the pages' styles.
export default function App() {
  return (
    <Router
      explicitLinks
      root={(props) => <Suspense>{props.children}</Suspense>}
    >
      <FileRoutes />
    </Router>
  );
}
