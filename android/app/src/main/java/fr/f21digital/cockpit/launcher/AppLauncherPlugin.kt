package fr.f21digital.cockpit.launcher

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.media.AudioManager
import android.net.Uri
import android.provider.Settings
import android.util.Base64
import android.view.KeyEvent
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.ByteArrayOutputStream

/** Fonctions multimédia Android standard : lancement d'applications, touches média, volume. */
@CapacitorPlugin(name = "AppLauncher")
class AppLauncherPlugin : Plugin() {

    @PluginMethod
    fun listApps(call: PluginCall) {
        Thread {
            try {
                val pm = context.packageManager
                val launcher = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
                val music = pm.queryIntentActivities(Intent.makeMainSelectorActivity(Intent.ACTION_MAIN, Intent.CATEGORY_APP_MUSIC), 0).map { it.activityInfo.packageName }.toSet() +
                    pm.queryIntentActivities(Intent(Intent.ACTION_VIEW).setDataAndType(Uri.parse("file:///x.mp3"), "audio/*"), 0).map { it.activityInfo.packageName }
                val maps = pm.queryIntentActivities(Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q=")), 0).map { it.activityInfo.packageName }.toSet()
                val arr = JSArray()
                pm.queryIntentActivities(launcher, 0)
                    .filter { it.activityInfo.packageName != context.packageName }
                    .sortedBy { it.loadLabel(pm).toString().lowercase() }
                    .forEach { ri ->
                        val pkg = ri.activityInfo.packageName
                        arr.put(
                            JSObject()
                                .put("packageName", pkg)
                                .put("label", ri.loadLabel(pm).toString())
                                .put("icon", iconBase64(ri.loadIcon(pm)))
                                .put("category", when (pkg) { in maps -> "navigation"; in music -> "music"; else -> "other" }),
                        )
                    }
                call.resolve(JSObject().put("apps", arr))
            } catch (e: Exception) {
                call.reject("Liste des applications indisponible : ${e.message}")
            }
        }.start()
    }

    private fun iconBase64(d: android.graphics.drawable.Drawable): String {
        val size = 96
        val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        d.setBounds(0, 0, size, size)
        d.draw(c)
        val out = ByteArrayOutputStream()
        bmp.compress(Bitmap.CompressFormat.PNG, 90, out)
        return Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
    }

    @PluginMethod
    fun launch(call: PluginCall) {
        val pkg = call.getString("packageName") ?: return call.reject("Paquet manquant")
        val intent = context.packageManager.getLaunchIntentForPackage(pkg) ?: return call.reject("Application introuvable")
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
        call.resolve()
    }

    @PluginMethod
    fun openCategory(call: PluginCall) {
        val cat = when (call.getString("category")) {
            "maps" -> Intent.CATEGORY_APP_MAPS
            "browser" -> Intent.CATEGORY_APP_BROWSER
            else -> Intent.CATEGORY_APP_MUSIC
        }
        val intent = Intent.makeMainSelectorActivity(Intent.ACTION_MAIN, cat).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        val ok = intent.resolveActivity(context.packageManager) != null
        if (ok) context.startActivity(intent)
        call.resolve(JSObject().put("launched", ok))
    }

    @PluginMethod
    fun openSettings(call: PluginCall) {
        val action = when (call.getString("panel")) {
            "sound" -> Settings.ACTION_SOUND_SETTINGS
            "general" -> Settings.ACTION_SETTINGS
            else -> Settings.ACTION_BLUETOOTH_SETTINGS
        }
        try {
            context.startActivity(Intent(action).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            call.resolve()
        } catch (e: Exception) {
            call.reject("Réglages non accessibles sur cet appareil")
        }
    }

    @PluginMethod
    fun mediaKey(call: PluginCall) {
        val code = when (call.getString("key")) {
            "next" -> KeyEvent.KEYCODE_MEDIA_NEXT
            "previous" -> KeyEvent.KEYCODE_MEDIA_PREVIOUS
            else -> KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE
        }
        val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        am.dispatchMediaKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, code))
        am.dispatchMediaKeyEvent(KeyEvent(KeyEvent.ACTION_UP, code))
        call.resolve()
    }

    @PluginMethod
    fun getVolume(call: PluginCall) {
        val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        call.resolve(JSObject().put("value", am.getStreamVolume(AudioManager.STREAM_MUSIC)).put("max", am.getStreamMaxVolume(AudioManager.STREAM_MUSIC)))
    }

    @PluginMethod
    fun setVolume(call: PluginCall) {
        val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        val v = call.getInt("value") ?: return call.reject("Valeur manquante")
        am.setStreamVolume(AudioManager.STREAM_MUSIC, v.coerceIn(0, am.getStreamMaxVolume(AudioManager.STREAM_MUSIC)), 0)
        call.resolve()
    }
}
