# Wasteland Survivor Android wrapper

This wrapper bundles the current web game, artwork, video, and local Three.js runtime into the APK. It serves the package through Android's `WebViewAssetLoader` at `https://appassets.androidplatform.net/assets/index.html`, so ES modules and other browser assets keep a valid origin without depending on the public site. Debug mode is off by default.

The app forwards Xbox-style D-pad/A/B key events into the web game's existing controller/menu handlers. Physical analog sticks still depend on Android WebView Gamepad API support; the in-game touch controls remain the fallback.

Build from this folder with `gradlew.bat assembleDebug` after the Android SDK and Gradle wrapper are available.
