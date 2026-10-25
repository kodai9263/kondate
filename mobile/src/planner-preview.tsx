import { createRoot } from "react-dom/client";
import { Planner } from "./MobilePlanner";
createRoot(document.getElementById("root")!).render(<div className="app-shell"><main><p className="read-only-note">表示・操作検証用のサンプルです。家族のデータは変更しません。</p><Planner accessToken="local-preview" online={true} onSaved={() => {}} /></main></div>);
