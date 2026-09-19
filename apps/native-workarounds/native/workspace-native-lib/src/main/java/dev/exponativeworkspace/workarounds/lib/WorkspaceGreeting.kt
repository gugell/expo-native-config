package dev.exponativeworkspace.workarounds.lib

/** Proves the local module is compiled into the app, not merely included. */
object WorkspaceGreeting {
    const val TAG: String = "workspace-native-lib"

    fun greeting(): String = "Hello from a local Gradle module"
}
