```diff
--- a/app/api/desktop-sync/route.ts
+++ b/app/api/desktop-sync/route.ts
@@ -239,7 +239,7 @@
           id: uuidv4(),
           type: 'desktop-call-started',
           deviceSettings: body.deviceSettings, // This now includes mimeType
-          deepgramApiKey: deepgramApiKey, // Include the API key
+          deepgramApiKey: deepgramApiKey, // Include the API key // [part 2]
           timestamp: body.timestamp
         };
         
```