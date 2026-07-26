import * as fs from 'fs';

let code = fs.readFileSync('server.ts', 'utf8');

// 1. Add log entry to batch-update-scores
code = code.replace(
  `      if (count > 0) {\n        await batch.commit();\n      }`,
  `      if (count > 0) {\n        await batch.commit();\n      }\n      if (updated > 0) {\n        await addDoc(collection(firestoreDb, "activity_logs"), {\n          operation: "Batch Update Scores",\n          admin_name: req.body.adminName || "System",\n          admin_role: req.body.adminRole || "admin",\n          records_processed: updated,\n          timestamp: new Date().toISOString()\n        });\n      }`
);

// 2. Add log entry to update-user
code = code.replace(
  `      res.json({ success: true, message: "User details updated successfully" });`,
  `      await addDoc(collection(firestoreDb, "activity_logs"), {\n        operation: "Update User Details",\n        admin_name: req.body.adminName || "System",\n        admin_role: req.body.adminRole || "admin",\n        records_processed: 1,\n        timestamp: new Date().toISOString()\n      });\n      res.json({ success: true, message: "User details updated successfully" });`
);

// 3. Add log entry to resolve-duplicates
code = code.replace(
  `      await batch.commit();\n\n      res.json({ success: true, message: \`Deleted \${recordsToDelete.length} records.\` });`,
  `      await batch.commit();\n      await addDoc(collection(firestoreDb, "activity_logs"), {\n        operation: "Resolve Duplicates",\n        admin_name: req.body.adminName || "System",\n        admin_role: req.body.adminRole || "admin",\n        records_processed: recordsToDelete.length,\n        timestamp: new Date().toISOString()\n      });\n      res.json({ success: true, message: \`Deleted \${recordsToDelete.length} records.\` });`
);

// 4. Add log entry to fix-all-duplicates
code = code.replace(
  `      await batch.commit();\n\n      res.json({ success: true, count: selectedRecords.length });`,
  `      await batch.commit();\n      await addDoc(collection(firestoreDb, "activity_logs"), {\n        operation: "Batch Reassign IDs",\n        admin_name: req.body.adminName || "System",\n        admin_role: req.body.adminRole || "admin",\n        records_processed: selectedRecords.length,\n        timestamp: new Date().toISOString()\n      });\n      res.json({ success: true, count: selectedRecords.length });`
);

code = code.replace(
  `      await batch.commit();\n\n      res.json({ success: true, resolved: duplicatesForBatch.length });`,
  `      await batch.commit();\n      await addDoc(collection(firestoreDb, "activity_logs"), {\n        operation: "Fix All Duplicates",\n        admin_name: req.body.adminName || "System",\n        admin_role: req.body.adminRole || "admin",\n        records_processed: duplicatesForBatch.length,\n        timestamp: new Date().toISOString()\n      });\n      res.json({ success: true, resolved: duplicatesForBatch.length });`
);

// 5. Add /api/activity-logs endpoint
if (!code.includes('/api/activity-logs')) {
  code = code.replace(
    `  // Find duplicates or similar entries`,
    `  app.post("/api/activity-logs", async (req, res) => {\n    try {\n      if (!firestoreDb) return res.status(500).json({ error: "DB not loaded" });\n      \n      const { adminId, adminName, password, limitCount = 100 } = req.body;\n      const normalizedName = adminName ? String(adminName).trim().toLowerCase() : "";\n      const isAuthorized = (password && password === process.env.ADMIN_PASSWORD) || \n                           (adminId === "000126" && normalizedName === "ariel orcia pesalver") || \n                           (adminId === "xir pogs" && normalizedName === "ariel pesalver" && password === "0000") || \n                           (req.body.adminRole === "admin" || req.body.adminRole === "co_admin");\n      if (!isAuthorized) {\n        return res.status(401).json({ error: "Unauthorized" });\n      }\n\n      const q = query(collection(firestoreDb, "activity_logs"), orderBy("timestamp", "desc"), limit(limitCount));\n      const snap = await getDocs(q);\n      const logs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));\n      res.json({ logs });\n    } catch (err: any) {\n      console.error("error fetching activity logs:", err);\n      res.status(500).json({ error: err.message });\n    }\n  });\n\n  // Find duplicates or similar entries`
  );
}

fs.writeFileSync('server.ts', code);
