package fr.f21digital.cockpit.obd

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothSocket
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import java.io.InputStream
import java.io.OutputStream
import java.util.UUID
import java.util.concurrent.Executors

/**
 * Liaison série Bluetooth classique (SPP) vers un adaptateur ELM327.
 * Toutes les commandes passent par ObdReadOnlyGuard : aucune écriture vers les calculateurs.
 */
@CapacitorPlugin(
    name = "ObdBluetooth",
    permissions = [
        Permission(alias = "bt31", strings = [Manifest.permission.BLUETOOTH_CONNECT, Manifest.permission.BLUETOOTH_SCAN]),
        Permission(alias = "btLegacy", strings = [Manifest.permission.BLUETOOTH, Manifest.permission.BLUETOOTH_ADMIN, Manifest.permission.ACCESS_FINE_LOCATION]),
    ],
)
class ObdBluetoothPlugin : Plugin() {
    private val sppUuid: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
    private val io = Executors.newSingleThreadExecutor()
    private var socket: BluetoothSocket? = null
    private var input: InputStream? = null
    private var output: OutputStream? = null

    private val adapter: BluetoothAdapter?
        get() = (context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager)?.adapter

    private val permAlias get() = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) "bt31" else "btLegacy"

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        val a = adapter
        call.resolve(JSObject().put("available", a != null).put("enabled", a?.isEnabled == true))
    }

    
@PluginMethod
fun requestBluetoothPermissions(call: PluginCall) {
    if (getPermissionState(permAlias) == PermissionState.GRANTED) {
        call.resolve(JSObject().put("granted", true))
    } else {
        requestPermissionForAlias(permAlias, call, "onPermResult")
    }
}


    @PermissionCallback
    private fun onPermResult(call: PluginCall) {
        call.resolve(JSObject().put("granted", getPermissionState(permAlias) == PermissionState.GRANTED))
    }

    @SuppressLint("MissingPermission")
    @PluginMethod
    fun listDevices(call: PluginCall) {
        val a = adapter ?: return call.reject("Bluetooth indisponible")
        if (getPermissionState(permAlias) != PermissionState.GRANTED) return call.reject("Autorisation Bluetooth requise")
        val found = LinkedHashMap<String, JSObject>()
        a.bondedDevices?.forEach { d -> found[d.address] = deviceJson(d, true) }
        if (!call.getBoolean("discover", false)!!) return resolveDevices(call, found)
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(c: Context, intent: Intent) {
                if (intent.action == BluetoothDevice.ACTION_FOUND) {
                    val d: BluetoothDevice? = if (Build.VERSION.SDK_INT >= 33)
                        intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE, BluetoothDevice::class.java)
                    else @Suppress("DEPRECATION") intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE)
                    if (d != null && !found.containsKey(d.address)) found[d.address] = deviceJson(d, false)
                }
            }
        }
        context.registerReceiver(receiver, IntentFilter(BluetoothDevice.ACTION_FOUND))
        a.startDiscovery()
        bridge.executeOnMainThread {
            android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                try { a.cancelDiscovery(); context.unregisterReceiver(receiver) } catch (_: Exception) {}
                resolveDevices(call, found)
            }, 8000)
        }
    }

    private fun resolveDevices(call: PluginCall, found: Map<String, JSObject>) {
        val arr = JSArray()
        found.values.forEach { arr.put(it) }
        call.resolve(JSObject().put("devices", arr))
    }

    @SuppressLint("MissingPermission")
    private fun deviceJson(d: BluetoothDevice, bonded: Boolean) =
        JSObject().put("name", d.name ?: "").put("address", d.address).put("bonded", bonded)

    @SuppressLint("MissingPermission")
    @PluginMethod
    fun connect(call: PluginCall) {
        val address = call.getString("address") ?: return call.reject("Adresse manquante")
        val a = adapter ?: return call.reject("Bluetooth indisponible")
        io.execute {
            try {
                closeQuietly()
                a.cancelDiscovery()
                val dev = a.getRemoteDevice(address)
                val s = try {
                    dev.createRfcommSocketToServiceRecord(sppUuid).also { it.connect() }
                } catch (e: Exception) {
                    dev.createInsecureRfcommSocketToServiceRecord(sppUuid).also { it.connect() }
                }
                socket = s
                input = s.inputStream
                output = s.outputStream
                call.resolve(JSObject().put("connected", true).put("name", dev.name ?: address))
            } catch (e: Exception) {
                closeQuietly()
                call.reject("Connexion impossible : ${e.message}")
            }
        }
    }

    @PluginMethod
    fun disconnect(call: PluginCall) {
        io.execute { closeQuietly(); call.resolve() }
    }

    @PluginMethod
    fun send(call: PluginCall) {
        val raw = call.getString("command") ?: return call.reject("Commande manquante")
        if (!ObdReadOnlyGuard.isAllowed(raw)) return call.reject("Commande refusée (lecture seule) : $raw")
        val cmd = ObdReadOnlyGuard.normalize(raw)
        val timeout = (call.getInt("timeoutMs") ?: 1500).toLong()
        io.execute {
            val out = output
            val inp = input
            if (out == null || inp == null) return@execute call.reject("Non connecté")
            try {
                while (inp.available() > 0) inp.read() // vide le tampon
                out.write("$cmd\r".toByteArray(Charsets.US_ASCII))
                out.flush()
                val sb = StringBuilder()
                val deadline = System.currentTimeMillis() + timeout
                while (System.currentTimeMillis() < deadline) {
                    if (inp.available() > 0) {
                        val c = inp.read()
                        if (c < 0) break
                        if (c.toChar() == '>') break
                        sb.append(c.toChar())
                    } else Thread.sleep(5)
                }
                if (System.currentTimeMillis() >= deadline && sb.isEmpty()) call.reject("Délai dépassé ($cmd)")
                else call.resolve(JSObject().put("response", sb.toString().trim()))
            } catch (e: Exception) {
                closeQuietly()
                call.reject("Liaison interrompue : ${e.message}")
            }
        }
    }

    private fun closeQuietly() {
        try { input?.close() } catch (_: Exception) {}
        try { output?.close() } catch (_: Exception) {}
        try { socket?.close() } catch (_: Exception) {}
        socket = null; input = null; output = null
    }

    override fun handleOnDestroy() {
        io.execute { closeQuietly() }
        super.handleOnDestroy()
    }
}
