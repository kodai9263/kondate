import { createRoot } from "react-dom/client";
import { Menu } from "./MobileMenu";
createRoot(document.getElementById("root")!).render(<div className="app-shell"><main><p className="read-only-note">表示確認用サンプルです。家族のデータは変更しません。</p><nav className="mobile-tabs" aria-label="画面構成の見本">{["今日", "献立", "買い物", "メニュー", "設定"].map((label) => <button key={label} aria-current={label === "メニュー" ? "page" : undefined} disabled>{label}</button>)}</nav><Menu accessToken="sample" online={true} /></main></div>);
