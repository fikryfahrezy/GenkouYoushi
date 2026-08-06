//

import SwiftUI

struct ContentView: View {
    @State private var workspaceModel = PracticeWorkspaceModel()

    var body: some View {
        PracticeWorkspaceView(model: workspaceModel)
    }
}

#Preview {
    ContentView()
        .frame(width: 1_366, height: 1_024)
}
