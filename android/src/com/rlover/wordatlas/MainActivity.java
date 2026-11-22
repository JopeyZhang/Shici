package com.rlover.wordatlas;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.util.Log;
import android.view.View;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

/**
 * 拾词 · 雅思词汇图鉴
 *
 * 纯离线 WebView 壳：词库、插画、界面全部打在 APK 里，不申请网络权限。
 * 学习进度通过 AndroidStore 桥写进 SharedPreferences，卸载才会消失；
 * 发音使用系统 TextToSpeech（不打包音频）。
 */
public class MainActivity extends Activity {

    private static final String TAG = "WordAtlas";
    private static final String PREF = "wordatlas";
    private static final int REQ_EXPORT = 101;
    private static final int REQ_IMPORT = 102;
    private static final int PAPER = 0xFFF6F1E7;
    private static final int INK = 0xFF0D1120;

    private WebView web;
    private SharedPreferences prefs;
    private TextToSpeech tts;
    private volatile boolean ttsReady = false;
    private String pendingExport;
    private final Handler ui = new Handler(Looper.getMainLooper());

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        prefs = getSharedPreferences(PREF, MODE_PRIVATE);

        getWindow().setBackgroundDrawable(new ColorDrawable(PAPER));

        web = new WebView(this);
        web.setBackgroundColor(PAPER);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setAllowFileAccessFromFileURLs(true);
        s.setAllowUniversalAccessFromFileURLs(false);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setTextZoom(100);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        }

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                // 离线应用：不允许跳出到外部浏览器
                return !url.startsWith("file:///android_asset/");
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(android.webkit.ConsoleMessage msg) {
                Log.d(TAG, "console: " + msg.message() + " @" + msg.lineNumber());
                return true;
            }
        });
        web.addJavascriptInterface(new Bridge(), "AndroidStore");

        setContentView(web);
        applyBars(false);
        web.loadUrl("file:///android_asset/index.html");

        initTts();
    }

    // 国产 ROM 的默认 TTS 经常没被正确解析，这里按候选引擎依次重试
    private static final String[] TTS_ENGINES = { null, "com.iflytek.speechsuite", "com.google.android.tts", "com.samsung.SMT" };

    private void initTts() {
        startTts(0);
    }

    private void startTts(final int idx) {
        if (idx >= TTS_ENGINES.length) {
            Log.w(TAG, "no usable TTS engine after retries");
            ttsReady = false;
            return;
        }
        if (tts != null) {
            try { tts.shutdown(); } catch (Exception ignored) {}
            tts = null;
        }
        final String engine = TTS_ENGINES[idx];
        Log.d(TAG, "TTS init try " + (engine == null ? "default" : engine));
        TextToSpeech.OnInitListener listener = status -> onTtsInit(status, idx);
        if (engine == null) {
            tts = new TextToSpeech(getApplicationContext(), listener);
        } else {
            tts = new TextToSpeech(getApplicationContext(), listener, engine);
        }
    }

    private void onTtsInit(int status, int idx) {
        if (status == TextToSpeech.SUCCESS) {
            ttsReady = true;
            Log.d(TAG, "TTS ready with " + (TTS_ENGINES[idx] == null ? "default engine" : TTS_ENGINES[idx]));
            return;
        }
        Log.w(TAG, "TTS init failed at attempt " + idx + ": " + status);
        ttsReady = false;
        final int next = idx + 1;
        if (next < TTS_ENGINES.length) ui.postDelayed(() -> startTts(next), 400);
    }

    private void applyBars(boolean dark) {
        Window w = getWindow();
        int paper = dark ? INK : PAPER;
        w.setStatusBarColor(paper);
        w.setNavigationBarColor(paper);
        View decor = w.getDecorView();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            int flags = decor.getSystemUiVisibility();
            if (dark) {
                flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            } else {
                flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                if (dark) {
                    flags &= ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                } else {
                    flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                }
            }
            decor.setSystemUiVisibility(flags);
        }
        web.setBackgroundColor(paper);
    }

    private void toast(String msg) {
        if (msg == null) return;
        ui.post(() -> Toast.makeText(MainActivity.this, msg, Toast.LENGTH_SHORT).show());
    }

    /** 供网页调用的本地能力：存储、朗读、导入导出、返回、主题。全部离线。 */
    public class Bridge {

        @JavascriptInterface
        public String getItem(String key) {
            return prefs.getString(key, null);
        }

        @JavascriptInterface
        public void setItem(String key, String value) {
            prefs.edit().putString(key, value).apply();
        }

        @JavascriptInterface
        public void removeItem(String key) {
            prefs.edit().remove(key).apply();
        }

        @JavascriptInterface
        public void speak(final String text, final String accent) {
            if (text == null || text.trim().isEmpty()) return;
            ui.post(() -> {
                if (tts == null || !ttsReady) {
                    toast("系统语音未就绪，可在「我的 → 发音」里打开语音设置");
                    return;
                }
                Locale loc = "us".equals(accent) ? Locale.US : Locale.UK;
                int r = tts.setLanguage(loc);
                if (r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED) {
                    toast("手机里没有安装英文语音包");
                    return;
                }
                tts.setSpeechRate(0.95f);
                tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "wa");
            });
        }

        @JavascriptInterface
        public void stopSpeaking() {
            ui.post(() -> {
                if (tts != null) tts.stop();
            });
        }

        @JavascriptInterface
        public void setTheme(final String theme) {
            ui.post(() -> applyBars(!"paper".equals(theme)));
        }

        @JavascriptInterface
        public void toast(String msg) {
            MainActivity.this.toast(msg);
        }

        @JavascriptInterface
        public void exportProgress(String json) {
            pendingExport = json;
            ui.post(() -> {
                try {
                    Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    i.addCategory(Intent.CATEGORY_OPENABLE);
                    i.setType("application/json");
                    i.putExtra(Intent.EXTRA_TITLE, "shici-progress.json");
                    startActivityForResult(i, REQ_EXPORT);
                } catch (Exception e) {
                    toast("这台手机没有可用的文件选择器");
                }
            });
        }

        @JavascriptInterface
        public void importProgress() {
            ui.post(() -> {
                try {
                    Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                    i.addCategory(Intent.CATEGORY_OPENABLE);
                    i.setType("*/*");
                    startActivityForResult(i, REQ_IMPORT);
                } catch (Exception e) {
                    toast("这台手机没有可用的文件选择器");
                }
            });
        }

        @JavascriptInterface
        public String getVersion() {
            return "1.0";
        }

        @JavascriptInterface
        public boolean ttsAvailable() {
            return ttsReady;
        }

        @JavascriptInterface
        public void openTtsSettings() {
            ui.post(() -> {
                try {
                    startActivity(new Intent("com.android.settings.TTS_SETTINGS"));
                } catch (Exception e) {
                    try {
                        startActivity(new Intent(android.provider.Settings.ACTION_SETTINGS));
                    } catch (Exception ignored) {
                        toast("无法打开系统语音设置");
                    }
                }
            });
        }

        @JavascriptInterface
        public void exitApp() {
            ui.post(() -> moveTaskToBack(true));
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (resultCode != RESULT_OK || data == null || data.getData() == null) return;
        final Uri uri = data.getData();
        if (requestCode == REQ_EXPORT) {
            final String json = pendingExport;
            new Thread(() -> {
                try {
                    OutputStream os = getContentResolver().openOutputStream(uri, "wt");
                    os.write((json == null ? "{}" : json).getBytes(StandardCharsets.UTF_8));
                    os.close();
                    toast("学习进度已导出");
                } catch (Exception e) {
                    Log.e(TAG, "export failed", e);
                    toast("导出失败：" + e.getMessage());
                }
            }).start();
        } else if (requestCode == REQ_IMPORT) {
            new Thread(() -> {
                try {
                    InputStream is = getContentResolver().openInputStream(uri);
                    ByteArrayOutputStream bos = new ByteArrayOutputStream();
                    byte[] buf = new byte[8192];
                    int n;
                    while ((n = is.read(buf)) > 0) bos.write(buf, 0, n);
                    is.close();
                    String text = bos.toString("UTF-8");
                    final String js = "window.__onImported && window.__onImported(" + JSONObject.quote(text) + ")";
                    ui.post(() -> web.evaluateJavascript(js, null));
                } catch (Exception e) {
                    Log.e(TAG, "import failed", e);
                    toast("导入失败：" + e.getMessage());
                }
            }).start();
        }
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript(
            "(function(){try{return (window.__appBack&&window.__appBack())||'exit'}catch(e){return 'exit'}})()",
            value -> {
                if (value == null || value.contains("exit")) {
                    moveTaskToBack(true);
                }
            }
        );
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (web != null) web.onPause();
        if (tts != null) tts.stop();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
    }

    @Override
    protected void onDestroy() {
        if (tts != null) {
            tts.stop();
            tts.shutdown();
            tts = null;
        }
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
