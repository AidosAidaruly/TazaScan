import java.util.Properties
import java.io.FileInputStream
import java.util.Base64
import java.security.KeyStore

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

val keystoreProperties = Properties()
val demoHttp = providers.gradleProperty("dart-defines").orNull
    ?.split(",")
    ?.any { String(Base64.getDecoder().decode(it), Charsets.UTF_8) == "TAZASCAN_DEMO_HTTP=true" }
    ?: false
val keystorePropertiesFile = rootProject.file("key.properties")
if (keystorePropertiesFile.exists()) {
    FileInputStream(keystorePropertiesFile).use { keystoreProperties.load(it) }
}
val requiredSigningProperties = listOf("storeFile", "storePassword", "keyAlias", "keyPassword")
fun signingProperty(name: String): String? =
    keystoreProperties.getProperty(name)?.trim()?.takeIf { it.isNotEmpty() }
val hasCompleteSigningProperties = requiredSigningProperties.all { signingProperty(it) != null }

// Release builds must be signed with the real release key. Returns a description of
// what is wrong (never a secret value), or null when the release keystore is usable.
fun releaseSigningProblem(): String? {
    if (!keystorePropertiesFile.exists()) {
        return "${keystorePropertiesFile.path} does not exist"
    }
    val missing = requiredSigningProperties.filter { signingProperty(it) == null }
    if (missing.isNotEmpty()) {
        return "key.properties is missing or has empty values for: ${missing.joinToString()}"
    }
    val storeFile = file(signingProperty("storeFile")!!)
    if (!storeFile.isFile) {
        return "storeFile does not point to an existing keystore file: ${storeFile.path}"
    }
    val keyStore = try {
        KeyStore.getInstance(KeyStore.getDefaultType()).apply {
            FileInputStream(storeFile).use { load(it, signingProperty("storePassword")!!.toCharArray()) }
        }
    } catch (error: Exception) {
        return "the keystore could not be opened; check storeFile and storePassword (${error.javaClass.simpleName})"
    }
    val keyAlias = signingProperty("keyAlias")!!
    if (!keyStore.containsAlias(keyAlias)) {
        return "keyAlias does not exist in the keystore"
    }
    val key = try {
        keyStore.getKey(keyAlias, signingProperty("keyPassword")!!.toCharArray())
    } catch (error: Exception) {
        null
    }
    return if (key == null) "the key could not be read; check keyPassword" else null
}

// Only tasks that build, sign or install the release variant require release signing,
// so debug builds, `flutter run` and IDE sync work without key.properties.
val releaseSigningTaskPattern = Regex("^(assemble|bundle|package|sign|install|validateSigning)Release.*")
gradle.taskGraph.whenReady {
    val buildsRelease = allTasks.any { it.project == project && releaseSigningTaskPattern.matches(it.name) }
    if (buildsRelease) {
        releaseSigningProblem()?.let { problem ->
            throw GradleException(
                "Release signing is not configured: $problem.\n" +
                    "Release builds are never signed with the debug key. Copy " +
                    "android/key.properties.example to android/key.properties, set storeFile, " +
                    "storePassword, keyAlias and keyPassword for your upload keystore, and keep " +
                    "both files out of git. See docs/android-release.md."
            )
        }
    }
}

android {
    namespace = "kz.project.project"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        applicationId = "kz.project.project"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
        // Explicit local-demo opt-in; normal release builds still require HTTPS.
        manifestPlaceholders["demoCleartextTraffic"] =
            demoHttp.toString()
    }

    signingConfigs {
        create("release") {
            if (hasCompleteSigningProperties) {
                keyAlias = signingProperty("keyAlias")
                keyPassword = signingProperty("keyPassword")
                storeFile = file(signingProperty("storeFile")!!)
                storePassword = signingProperty("storePassword")
            }
        }
    }

    buildTypes {
        release {
            // Always the release key; validated above before any release task runs.
            signingConfig = signingConfigs.getByName("release")
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
