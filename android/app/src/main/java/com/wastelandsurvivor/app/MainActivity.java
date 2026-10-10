package com.wastelandsurvivor.app;

import android.app.Activity;
import android.net.Uri;
import android.os.Bundle;
import android.os.Build;
import android.util.Log;
import android.view.KeyEvent;
import android.view.View;
import android.window.OnBackInvokedCallback;
import android.window.OnBackInvokedDispatcher;
import android.webkit.ConsoleMessage;
import android.webkit.WebSettings;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebChromeClient;
import android.webkit.WebViewClient;

import androidx.webkit.WebViewAssetLoader;

public class MainActivity extends Activity {
    private static final String TAG = "WastelandWeb";
    private WebView webView;
    private static final String GAME_URL = "https://appassets.androidplatform.net/assets/index.html";

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        if (BuildConfig.DEBUG) WebView.setWebContentsDebuggingEnabled(true);
        getWindow().getDecorView().setSystemUiVisibility(5894);
        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setUserAgentString(settings.getUserAgentString() + " WastelandSurvivorAndroid/1.0");
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);
        WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onConsoleMessage(ConsoleMessage message) {
                if (BuildConfig.DEBUG) {
                    Log.e(TAG, message.message() + " @" + message.sourceId() + ":" + message.lineNumber());
                }
                return true;
            }
        });
        webView.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override public WebResourceResponse shouldInterceptRequest(WebView view, String url) {
                return assetLoader.shouldInterceptRequest(Uri.parse(url));
            }

            @Override public void onPageFinished(WebView view, String url) {
                if (BuildConfig.DEBUG) Log.i(TAG, "page finished: " + url);
                super.onPageFinished(view, url);
            }

            @Override public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                if (BuildConfig.DEBUG) Log.e(TAG, "page error " + errorCode + ": " + description + " @" + failingUrl);
                super.onReceivedError(view, errorCode, description, failingUrl);
            }
        });
        setContentView(webView);
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    OnBackInvokedDispatcher.PRIORITY_DEFAULT, backCallback);
        }
        // Refresh packaged game files while keeping DOM storage for player profiles.
        webView.clearCache(true);
        webView.loadUrl(GAME_URL);
    }

    @Override public boolean dispatchKeyEvent(KeyEvent event) {
        if (webView != null && event.getAction() == KeyEvent.ACTION_DOWN) {
            String key = event.getKeyCode() == KeyEvent.KEYCODE_BUTTON_A ? "GamepadA" :
                    event.getKeyCode() == KeyEvent.KEYCODE_BUTTON_B ? "GamepadB" : event.getKeyCode() == KeyEvent.KEYCODE_DPAD_UP ? "ArrowUp" :
                    event.getKeyCode() == KeyEvent.KEYCODE_DPAD_DOWN ? "ArrowDown" : event.getKeyCode() == KeyEvent.KEYCODE_DPAD_LEFT ? "ArrowLeft" :
                    event.getKeyCode() == KeyEvent.KEYCODE_DPAD_RIGHT ? "ArrowRight" : null;
            if (key != null) webView.evaluateJavascript("window.dispatchEvent(new KeyboardEvent('keydown',{key:" + quote(key) + ",bubbles:true}));", null);
        }
        return super.dispatchKeyEvent(event);
    }

    private final OnBackInvokedCallback backCallback = this::handleBack;

    private void handleBack() {
        if (webView == null) {
            super.onBackPressed();
            return;
        }
        webView.evaluateJavascript("window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));", null);
    }

    @Override public void onBackPressed() { handleBack(); }

    private static String quote(String value) { return "'" + value.replace("'", "\\'") + "'"; }
    @Override protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.onResume();
            webView.evaluateJavascript("window.dispatchEvent(new Event('android-app-resumed'));", null);
        }
    }
    @Override protected void onPause() {
        if (webView != null) {
            webView.evaluateJavascript("window.dispatchEvent(new Event('android-app-paused'));", null);
            webView.onPause();
        }
        super.onPause();
    }
}
