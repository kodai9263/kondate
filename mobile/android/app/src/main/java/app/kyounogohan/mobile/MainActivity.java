package app.kyounogohan.mobile;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(FamilyLinksPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
