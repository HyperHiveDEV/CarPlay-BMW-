package fr.f21digital.cockpit.obd

/**
 * Garde lecture seule côté natif (défense en profondeur, identique à src/obd/readOnlyGuard.ts).
 * Autorisé : configuration ELM327 (AT…), OBD Mode 01 (données courantes), Mode 09 PID 02 (VIN).
 * Tout le reste (Mode 04 effacement, Mode 08, services UDS d'écriture/codage/routines…) est refusé.
 */
object ObdReadOnlyGuard {
    private val allowedAt = setOf(
        "ATZ", "ATWS", "ATD", "ATE0", "ATL0", "ATS0", "ATH0", "ATH1", "ATSP0", "ATDP", "ATDPN",
        "ATRV", "ATI", "AT@1", "ATAT1", "ATAT2", "ATST32", "ATST64", "ATST96", "ATSTFF",
    )
    private val mode01 = Regex("^01[0-9A-F]{2}$")

    fun normalize(cmd: String) = cmd.replace(Regex("\\s+"), "").uppercase()

    fun isAllowed(cmd: String): Boolean {
        val c = normalize(cmd)
        return c in allowedAt || mode01.matches(c) || c == "0902"
    }
}
