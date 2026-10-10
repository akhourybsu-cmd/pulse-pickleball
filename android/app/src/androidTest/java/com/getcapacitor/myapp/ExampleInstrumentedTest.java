package com.getcapacitor.myapp;

import static org.junit.Assert.*;

import android.content.Context;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.pulsepb.app.MainActivity;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;

/**
 * Instrumented test, which will execute on an Android device.
 *
 * @see <a href="http://d.android.com/tools/testing">Testing documentation</a>
 */
@RunWith(AndroidJUnit4.class)
public class ExampleInstrumentedTest {

    private JSONObject asset(Context context, String name) throws Exception {
        try (InputStream input = context.getAssets().open(name);
             ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096];
            int count;
            while ((count = input.read(buffer)) != -1) bytes.write(buffer, 0, count);
            return new JSONObject(bytes.toString("UTF-8"));
        }
    }

    @Test
    public void bundlesThePulseProductionApp() throws Exception {
        // Context of the app under test.
        Context appContext = InstrumentationRegistry.getInstrumentation().getTargetContext();

        assertEquals("com.pulsepb.app", appContext.getPackageName());
        JSONObject config = asset(appContext, "capacitor.config.json");
        assertEquals("com.pulsepb.app", config.getString("appId"));
        assertTrue("Store builds must launch their bundled app",
            !config.has("server") || !config.getJSONObject("server").has("url"));
        JSONObject release = asset(appContext, "public/backend-release.json");
        assertEquals("production", release.getString("mode"));
        assertEquals("rqfqwavhtfwwtmfjnxkx", release.getString("projectId"));
        assertTrue(release.getString("revision").matches("[a-f0-9]{40}"));
    }

    @Test
    public void launchesAndRendersTheBundledApp() throws Exception {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(45);
            AtomicBoolean rendered = new AtomicBoolean(false);
            while (!rendered.get() && System.nanoTime() < deadline) {
                CountDownLatch checked = new CountDownLatch(1);
                scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(
                    "Boolean(document.querySelector('#root')?.children.length)",
                    value -> { rendered.set("true".equals(value)); checked.countDown(); }
                ));
                assertTrue("WebView callback timed out", checked.await(5, TimeUnit.SECONDS));
                if (!rendered.get()) Thread.sleep(250);
            }
            assertTrue("The bundled PULSE screen never rendered", rendered.get());
        }
    }
}
