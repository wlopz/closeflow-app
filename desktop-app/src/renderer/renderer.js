```diff
--- a/desktop-app/src/renderer/renderer.js
+++ b/desktop-app/src/renderer/renderer.js
@@ -400,7 +400,7 @@
             // CRITICAL FIX: Get the actual MIME type from the MediaRecorder
             let actualMimeType = null;
             
-            console.log('🎤 ENHANCED LOGGING: Attempting to retrieve MIME type from window.closeFlowActualMimeType');
+            console.log('🎤 ENHANCED LOGGING: Attempting to retrieve MIME type from window.closeFlowActualMimeType'); // [part 1]
             
             // Check if the MIME type was set by the audio capture process
             if (window.closeFlowActualMimeType) {
@@ -408,7 +408,7 @@
                 console.log('✅ ENHANCED LOGGING: Retrieved MIME type from window:', actualMimeType);
             } else {
                 console.log('⚠️ ENHANCED LOGGING: No MIME type found in window.closeFlowActualMimeType');
             }
 
             const result = await ipcRenderer.invoke('start-call-analysis', {
                 inputDeviceId: this.selectedDevices.input,
                 outputDeviceId: this.selectedDevices.output,
                 systemAudioSourceId: this.selectedSystemAudioSource,
-                mimeType: actualMimeType // Pass the actual MIME type (or null if not available)
+                mimeType: actualMimeType // Pass the actual MIME type (or null if not available) // [part 1]
             });
             
             if (!result.success) {
@@ -450,7 +450,7 @@
     processAudioChunk(chunk) {
         console.log('🎧 ENHANCED LOGGING: Processing audio chunk for playback');
         
-        let actualMimeType = 'audio/webm;codecs=opus';
+        let actualMimeType = 'audio/webm;codecs=opus'; // [part 1]
         
         // The `window.closeFlowActualMimeType` is set in the renderer process
         if (window.closeFlowActualMimeType) {
```