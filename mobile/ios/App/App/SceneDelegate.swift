import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    static var pendingInviteURL: String?
    static weak var linksPlugin: FamilyLinksPlugin?

    static func receive(_ url: URL) {
        if let plugin = linksPlugin, plugin.hasListeners("inviteUrl") {
            pendingInviteURL = nil
            plugin.notifyListeners("inviteUrl", data: ["url": url.absoluteString])
        } else { pendingInviteURL = url.absoluteString }
    }

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        if let url = connectionOptions.urlContexts.first?.url ?? connectionOptions.userActivities.first?.webpageURL {
            Self.receive(url)
        }
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = FamilyBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        if let url = URLContexts.first?.url { Self.receive(url) }
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        if let url = userActivity.webpageURL { Self.receive(url) }
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

@objc(FamilyLinksPlugin)
public class FamilyLinksPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FamilyLinksPlugin"
    public let jsName = "FamilyLinks"
    public let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "pending", returnType: CAPPluginReturnPromise)]
    public override func load() { SceneDelegate.linksPlugin = self }
    @objc func pending(_ call: CAPPluginCall) {
        if let url = SceneDelegate.pendingInviteURL {
            SceneDelegate.pendingInviteURL = nil
            call.resolve(["url": url])
        } else { call.resolve([:]) }
    }
}
