package fr.f21digital.cockpit

import android.os.Bundle
import android.view.WindowManager
import androidx.activity.OnBackPressedCallback
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.getcapacitor.BridgeActivity
import fr.f21digital.cockpit.launcher.AppLauncherPlugin
import fr.f21digital.cockpit.obd.ObdBluetoothPlugin

/**
 * Activité unique : WebView Capacitor en plein écran immersif, écran maintenu allumé.
 * La pause/reprise est propagée à la WebView (événement visibilitychange côté JS).
 */
class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(ObdBluetoothPlugin::class.java)
        registerPlugin(AppLauncherPlugin::class.java)
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        enterImmersive()
        // Bouton retour (ou BACK d'une future passerelle) : transmis à l'InputManager de l'interface
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                bridge?.webView?.evaluateJavascript(
                    "window.dispatchEvent(new CustomEvent('f21-input',{detail:{action:'back',source:'android'}}))", null,
                )
            }
        })
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) enterImmersive()
    }

    private fun enterImmersive() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }
}
