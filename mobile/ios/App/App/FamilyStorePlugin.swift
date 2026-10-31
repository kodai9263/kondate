import Capacitor
import StoreKit

class FamilyBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(FamilyStorePlugin())
    }
}

@objc(FamilyStorePlugin)
public class FamilyStorePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FamilyStorePlugin"
    public let jsName = "FamilyStore"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "products", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "transactions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "finish", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "manage", returnType: CAPPluginReturnPromise)
    ]
    private let ids: Set<String> = ["app.kyounogohan.mobile.family.monthly", "app.kyounogohan.mobile.family.yearly"]
    private var observer: Task<Void, Never>?

    public override func load() {
        observer = Task { [weak self] in
            for await result in Transaction.updates {
                guard let self, case .verified(let transaction) = result,
                      self.ids.contains(transaction.productID) else { continue }
                self.notifyListeners("transactionUpdated", data: [:], retainUntilConsumed: true)
            }
        }
    }
    deinit { observer?.cancel() }

    @objc func products(_ call: CAPPluginCall) {
        Task {
            do {
                let products = try await Product.products(for: ids)
                call.resolve(["products": products.map { ["id": $0.id, "price": $0.displayPrice, "name": $0.displayName] }])
            } catch { call.reject("購入プランを読み込めませんでした。", "store_unavailable") }
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        guard let id = call.getString("productId"), ids.contains(id),
              let rawToken = call.getString("appAccountToken"), let token = UUID(uuidString: rawToken) else {
            call.reject("購入情報を確認できません。", "invalid_purchase"); return
        }
        Task { @MainActor in
            do {
                guard let product = try await Product.products(for: [id]).first else {
                    call.reject("このプランは現在購入できません。", "product_unavailable"); return
                }
                switch try await product.purchase(options: [.appAccountToken(token)]) {
                case .success(let result):
                    guard case .verified(let transaction) = result else {
                        call.reject("Appleの購入情報を確認できません。", "unverified"); return
                    }
                    // サーバーの保存に成功するまではfinishしない。通信失敗後も再送できる。
                    call.resolve(["status": "purchased", "transaction": ["id": String(transaction.id), "signedTransaction": result.jwsRepresentation]])
                case .pending: call.resolve(["status": "pending"])
                case .userCancelled: call.resolve(["status": "cancelled"])
                @unknown default: call.reject("購入結果を確認できません。", "unknown_result")
                }
            } catch { call.reject("購入を完了できませんでした。時間をおいて再度お試しください。", "purchase_failed") }
        }
    }

    private func collect() async -> [[String: String]] {
        var values: [UInt64: [String: String]] = [:]
        for await result in Transaction.currentEntitlements {
            if case .verified(let transaction) = result, ids.contains(transaction.productID) {
                values[transaction.id] = ["id": String(transaction.id), "signedTransaction": result.jwsRepresentation]
            }
        }
        for await result in Transaction.unfinished {
            if case .verified(let transaction) = result, ids.contains(transaction.productID) {
                values[transaction.id] = ["id": String(transaction.id), "signedTransaction": result.jwsRepresentation]
            }
        }
        return Array(values.values)
    }
    @objc func transactions(_ call: CAPPluginCall) {
        Task { call.resolve(["transactions": await collect()]) }
    }
    @objc func restore(_ call: CAPPluginCall) {
        Task {
            do {
                try await AppStore.sync()
                call.resolve(["transactions": await collect()])
            } catch { call.reject("購入の復元を完了できませんでした。", "restore_failed") }
        }
    }
    @objc func finish(_ call: CAPPluginCall) {
        guard let rawId = call.getString("transactionId"), let id = UInt64(rawId) else {
            call.reject("取引番号を確認できません。", "invalid_transaction"); return
        }
        Task {
            for await result in Transaction.unfinished {
                if case .verified(let transaction) = result, transaction.id == id, ids.contains(transaction.productID) {
                    await transaction.finish()
                }
            }
            call.resolve()
        }
    }
    @objc func manage(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard let scene = self.bridge?.viewController?.view.window?.windowScene else {
                call.reject("契約管理を開けません。", "scene_unavailable"); return
            }
            do { try await AppStore.showManageSubscriptions(in: scene); call.resolve() }
            catch { call.reject("契約管理を開けませんでした。", "manage_failed") }
        }
    }
}
