import SwiftUI
import WebKit

struct SVGReferenceView: UIViewRepresentable {
    let data: Data

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = false
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        guard context.coordinator.loadedData != data else { return }
        context.coordinator.loadedData = data
        webView.loadHTMLString(Self.centeredHTML(for: data), baseURL: nil)
    }

    private static func centeredHTML(for data: Data) -> String {
        let encodedSVG = data.base64EncodedString()

        return """
        <!doctype html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            html, body {
              width: 100%;
              height: 100%;
              margin: 0;
              overflow: hidden;
              background: transparent;
            }
            body {
              display: flex;
              align-items: center;
              justify-content: center;
            }
            img {
              display: block;
              width: 100%;
              height: 100%;
              object-fit: contain;
            }
          </style>
        </head>
        <body>
          <img src="data:image/svg+xml;base64,\(encodedSVG)" alt="">
        </body>
        </html>
        """
    }

    final class Coordinator {
        var loadedData: Data?
    }
}
