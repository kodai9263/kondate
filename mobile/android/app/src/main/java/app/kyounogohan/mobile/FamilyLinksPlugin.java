package app.kyounogohan.mobile;

import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "FamilyLinks")
public class FamilyLinksPlugin extends Plugin {
    @PluginMethod
    public void pending(PluginCall call) {
        JSObject result = new JSObject();
        Intent intent = getActivity().getIntent();
        if (intent != null && intent.getData() != null) {
            result.put("url", intent.getData().toString());
            intent.setData(null);
        }
        call.resolve(result);
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        if (intent.getData() != null) {
            JSObject result = new JSObject();
            result.put("url", intent.getData().toString());
            notifyListeners("inviteUrl", result, true);
        }
    }
}
