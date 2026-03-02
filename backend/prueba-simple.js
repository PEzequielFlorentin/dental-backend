console.log("=== PRUEBA INICIADA ===");
console.log("Directorio actual:", process.cwd());

// Servidor HTTP nativo de Node (sin Express)
const http = require("http");

const server = http.createServer((req, res) => {
  console.log("✅ Petición recibida:", req.url);
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ 
    mensaje: "¡Funciona desde Node puro!", 
    hora: new Date().toLocaleTimeString(),
    ruta: req.url 
  }));
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log("=".repeat(50));
  console.log(`🎉 SERVIDOR HTTP en puerto ${PORT}`);
  console.log(`🔗 http://localhost:${PORT}`);
  console.log("=".repeat(50));
  
  // Auto-probar después de 1 segundo
  setTimeout(() => {
    console.log("Auto-probando conexión...");
    const req = http.get(`http://localhost:${PORT}`, (response) => {
      let data = "";
      response.on("data", chunk => data += chunk);
      response.on("end", () => {
        console.log("✅ Auto-prueba exitosa:", JSON.parse(data));
      });
    });
    req.on("error", (err) => {
      console.error("❌ Auto-prueba falló:", err.message);
    });
  }, 1000);
});

// Manejar errores
server.on("error", (err) => {
  console.error("❌ Error del servidor:", err.message);
  if (err.code === "EADDRINUSE") {
    console.error("Puerto", PORT, "en uso. Prueba con otro.");
  }
});
