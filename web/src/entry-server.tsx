// @refresh reload
import type { JSX } from "solid-js";
import { getRequestEvent } from "solid-js/web";
import { StartServer, createHandler } from "@solidjs/start/server";

function Analytics() {
  return (
    <script
      defer
      src="https://analytics.fahrezy.work/script.js"
      data-website-id="04c67a3a-d818-4833-ae2c-753a81b432d6"
    />
  );
}

// The document is rendered only on the server, so each page's head is chosen
// here from the requested path.
function pageHead(path: string): JSX.Element {
  if (path.startsWith("/app")) {
    return (
      <>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no"
        />
        <meta name="theme-color" content="#e3ded0" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Genkou Youshi" />
        <link rel="manifest" href="/app/manifest.webmanifest" />
        <Analytics />
        <title>Genkou Youshi</title>
      </>
    );
  }
  if (path.startsWith("/licenses")) {
    return (
      <>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light" />
        <title>Credits &amp; licenses · Genkou Youshi</title>
      </>
    );
  }
  return (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="theme-color" content="#e3ded0" />
      <meta
        name="description"
        content="A calm, focused workspace for practicing Japanese handwriting on traditional genkou youshi manuscript paper."
      />
      <meta
        property="og:title"
        content="Genkou Youshi — Japanese writing practice"
      />
      <meta
        property="og:description"
        content="Practice Japanese handwriting with stroke-order guides, digital manuscript paper, and PDF export."
      />
      <meta property="og:type" content="website" />
      <Analytics />
      <title>Genkou Youshi — Japanese writing practice</title>
    </>
  );
}

export default createHandler(() => (
  <StartServer
    document={({ assets, children, scripts }) => (
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          {pageHead(new URL(getRequestEvent()!.request.url).pathname)}
          <link rel="icon" href="/icon.svg" type="image/svg+xml" />
          {assets}
        </head>
        <body>
          <div id="app">{children}</div>
          {scripts}
        </body>
      </html>
    )}
  />
));
