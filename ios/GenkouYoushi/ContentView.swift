//

import SwiftUI

struct ContentView: View {
    @State private var workspaceModel = PracticeWorkspaceModel()

    var body: some View {
        Group {
            if workspaceModel.isLoadingDocuments {
                ProgressView("Loading practice sheets…")
            } else {
                PracticeWorkspaceView(model: workspaceModel)
            }
        }
        .task {
            await workspaceModel.loadDocuments()
        }
    }
}

#Preview {
    ContentView()
        .frame(width: 1_366, height: 1_024)
}
