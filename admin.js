document.addEventListener("DOMContentLoaded", () => {
    const config = window.SUPABASE_CONFIG || {};

    const estadoApp = document.getElementById("estadoApp");
    const loginCard = document.getElementById("loginCard");
    const adminPanel = document.getElementById("adminPanel");

    const loginForm = document.getElementById("loginForm");
    const emailInput = document.getElementById("emailInput");
    const passwordInput = document.getElementById("passwordInput");
    const logoutBtn = document.getElementById("logoutBtn");

    const clienteForm = document.getElementById("clienteForm");
    const clientesBody = document.getElementById("clientesBody");
    const clienteNombre = document.getElementById("clienteNombre");
    const clienteEmail = document.getElementById("clienteEmail");
    const clienteTelefono = document.getElementById("clienteTelefono");
    const clienteNfc = document.getElementById("clienteNfc");
    const clienteHabilitado = document.getElementById("clienteHabilitado");

    const clienteSelect = document.getElementById("clienteSelect");

    const vehiculoForm = document.getElementById("vehiculoForm");
    const vehiculoPatente = document.getElementById("vehiculoPatente");
    const vehiculoModelo = document.getElementById("vehiculoModelo");

    const documentoForm = document.getElementById("documentoForm");
    const docTipo = document.getElementById("docTipo");
    const docNombre = document.getElementById("docNombre");
    const docVence = document.getElementById("docVence");
    const docArchivo = document.getElementById("docArchivo");
    const documentosAdmin = document.getElementById("documentosAdmin");

    if (!config.url || !config.anonKey || !window.supabase || !window.supabase.createClient) {
        setEstado("Configura supabase-config.js con URL y ANON KEY para activar el panel.", "error");
        return;
    }

    const supabase = window.supabase.createClient(config.url, config.anonKey);
    const bucket = config.bucket || "documentos-vehiculo";

    let clientes = [];
    let vehiculoActual = null;

    function setEstado(msg, tipo = "ok") {
        estadoApp.textContent = msg;
        estadoApp.className = `admin-estado ${tipo}`;
    }

    function escapeHtml(value) {
        return String(value || "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");
    }

    function slugifyFileName(name) {
        return name
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9.\-_]/g, "-")
            .replace(/-+/g, "-");
    }

    async function validarAdmin() {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) {
            return false;
        }

        const adminEmails = (config.adminEmails || []).filter(Boolean);
        if (adminEmails.length === 0) {
            setEstado("Agrega tu email admin en supabase-config.js para usar este panel.", "error");
            return false;
        }

        if (!adminEmails.includes(data.user.email)) {
            await supabase.auth.signOut();
            setEstado("Este usuario no tiene permisos de administrador.", "error");
            return false;
        }

        return true;
    }

    function pintarClientes() {
        clientesBody.innerHTML = "";

        if (clientes.length === 0) {
            clientesBody.innerHTML = "<tr><td colspan=\"4\">Sin usuarios aún.</td></tr>";
            return;
        }

        clientes.forEach((cliente) => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>
                    <strong>${escapeHtml(cliente.nombre)}</strong><br>
                    <small>${escapeHtml(cliente.email || "sin email")}</small>
                </td>
                <td>${escapeHtml(cliente.nfc_codigo)}</td>
                <td>${cliente.habilitado ? "Habilitado" : "Bloqueado"}</td>
                <td>
                    <button class="admin-btn mini" data-action="toggle" data-id="${cliente.id}">
                        ${cliente.habilitado ? "Bloquear" : "Habilitar"}
                    </button>
                </td>
            `;
            clientesBody.appendChild(tr);
        });
    }

    function cargarSelectClientes() {
        clienteSelect.innerHTML = "";

        if (clientes.length === 0) {
            const op = document.createElement("option");
            op.value = "";
            op.textContent = "Sin clientes";
            clienteSelect.appendChild(op);
            return;
        }

        clientes.forEach((cliente) => {
            const op = document.createElement("option");
            op.value = cliente.id;
            op.textContent = `${cliente.nombre} (${cliente.nfc_codigo})`;
            clienteSelect.appendChild(op);
        });
    }

    async function cargarClientes() {
        const { data, error } = await supabase
            .from("clientes")
            .select("id, nombre, email, telefono, nfc_codigo, habilitado")
            .order("created_at", { ascending: false });

        if (error) {
            setEstado(`No se pudo cargar clientes: ${error.message}`, "error");
            return;
        }

        clientes = data || [];
        pintarClientes();
        cargarSelectClientes();

        if (clientes.length > 0) {
            clienteSelect.value = clientes[0].id;
            await cargarVehiculoYDocs(clientes[0].id);
        }
    }

    async function crearCliente() {
        const payload = {
            nombre: clienteNombre.value.trim(),
            email: clienteEmail.value.trim() || null,
            telefono: clienteTelefono.value.trim() || null,
            nfc_codigo: clienteNfc.value.trim(),
            habilitado: clienteHabilitado.checked
        };

        const { error } = await supabase.from("clientes").insert(payload);
        if (error) {
            setEstado(`No se pudo crear cliente: ${error.message}`, "error");
            return;
        }

        clienteForm.reset();
        clienteHabilitado.checked = true;
        setEstado("Cliente creado correctamente.");
        await cargarClientes();
    }

    async function toggleCliente(id) {
        const cliente = clientes.find((c) => c.id === id);
        if (!cliente) return;

        const { error } = await supabase
            .from("clientes")
            .update({ habilitado: !cliente.habilitado })
            .eq("id", id);

        if (error) {
            setEstado(`No se pudo actualizar estado: ${error.message}`, "error");
            return;
        }

        setEstado("Estado de cliente actualizado.");
        await cargarClientes();
    }

    async function cargarVehiculoYDocs(clienteId) {
        if (!clienteId) return;

        const { data: vehiculo, error } = await supabase
            .from("vehiculos")
            .select("id, cliente_id, patente, modelo")
            .eq("cliente_id", clienteId)
            .maybeSingle();

        if (error) {
            setEstado(`No se pudo cargar vehículo: ${error.message}`, "error");
            return;
        }

        vehiculoActual = vehiculo;

        if (vehiculoActual) {
            vehiculoPatente.value = vehiculoActual.patente || "";
            vehiculoModelo.value = vehiculoActual.modelo || "";
        } else {
            vehiculoPatente.value = "";
            vehiculoModelo.value = "";
        }

        await cargarDocumentos();
    }

    async function guardarVehiculo() {
        const clienteId = clienteSelect.value;
        if (!clienteId) {
            setEstado("Selecciona un cliente primero.", "error");
            return;
        }

        const payload = {
            cliente_id: clienteId,
            patente: vehiculoPatente.value.trim().toUpperCase(),
            modelo: vehiculoModelo.value.trim()
        };

        if (vehiculoActual) {
            const { error } = await supabase
                .from("vehiculos")
                .update(payload)
                .eq("id", vehiculoActual.id);

            if (error) {
                setEstado(`No se pudo guardar vehículo: ${error.message}`, "error");
                return;
            }
        } else {
            const { data, error } = await supabase
                .from("vehiculos")
                .insert(payload)
                .select("id, cliente_id, patente, modelo")
                .single();

            if (error) {
                setEstado(`No se pudo crear vehículo: ${error.message}`, "error");
                return;
            }

            vehiculoActual = data;
        }

        setEstado("Vehículo guardado correctamente.");
        await cargarDocumentos();
    }

    async function cargarDocumentos() {
        documentosAdmin.innerHTML = "";

        if (!vehiculoActual) {
            documentosAdmin.innerHTML = "<p>Primero guarda el vehículo para este cliente.</p>";
            return;
        }

        const { data, error } = await supabase
            .from("documentos")
            .select("id, nombre, tipo, archivo_url, archivo_path, vence")
            .eq("vehiculo_id", vehiculoActual.id)
            .order("nombre", { ascending: true });

        if (error) {
            setEstado(`No se pudo cargar documentos: ${error.message}`, "error");
            return;
        }

        if (!data || data.length === 0) {
            documentosAdmin.innerHTML = "<p>Aún no hay documentos cargados.</p>";
            return;
        }

        data.forEach((doc) => {
            const item = document.createElement("div");
            item.className = "doc-item";
            item.innerHTML = `
                <div>
                    <strong>${escapeHtml(doc.nombre)}</strong><br>
                    <small>${escapeHtml(doc.tipo)}${doc.vence ? ` | vence: ${doc.vence}` : ""}</small>
                </div>
                <div class="doc-item-actions">
                    <a class="admin-btn mini" href="${doc.archivo_url || "#"}" target="_blank" rel="noopener noreferrer">Ver</a>
                    <button class="admin-btn mini danger" data-delete-doc="${doc.id}" data-path="${doc.archivo_path || ""}">Eliminar</button>
                </div>
            `;
            documentosAdmin.appendChild(item);
        });
    }

    async function subirDocumento() {
        if (!vehiculoActual) {
            setEstado("Primero guarda el vehículo antes de subir documentos.", "error");
            return;
        }

        const file = docArchivo.files[0];
        if (!file) {
            setEstado("Selecciona un PDF para continuar.", "error");
            return;
        }

        const filePath = `${vehiculoActual.cliente_id}/${Date.now()}-${slugifyFileName(file.name)}`;

        const { error: uploadError } = await supabase.storage
            .from(bucket)
            .upload(filePath, file, { upsert: false });

        if (uploadError) {
            setEstado(`No se pudo subir archivo: ${uploadError.message}`, "error");
            return;
        }

        const archivoUrl = supabase.storage.from(bucket).getPublicUrl(filePath).data?.publicUrl || "";

        const payload = {
            vehiculo_id: vehiculoActual.id,
            tipo: docTipo.value,
            nombre: docNombre.value.trim(),
            vence: docVence.value || null,
            archivo_path: filePath,
            archivo_url: archivoUrl
        };

        const { error } = await supabase
            .from("documentos")
            .upsert(payload, { onConflict: "vehiculo_id,tipo" });

        if (error) {
            setEstado(`No se pudo guardar documento: ${error.message}`, "error");
            return;
        }

        documentoForm.reset();
        setEstado("Documento cargado o reemplazado correctamente.");
        await cargarDocumentos();
    }

    async function eliminarDocumento(id, path) {
        const { error } = await supabase
            .from("documentos")
            .delete()
            .eq("id", id);

        if (error) {
            setEstado(`No se pudo eliminar documento: ${error.message}`, "error");
            return;
        }

        if (path) {
            await supabase.storage.from(bucket).remove([path]);
        }

        setEstado("Documento eliminado correctamente.");
        await cargarDocumentos();
    }

    async function modoAdminActivo() {
        loginCard.classList.add("oculto");
        adminPanel.classList.remove("oculto");
        await cargarClientes();
        setEstado("Sesión iniciada.");
    }

    async function bootstrap() {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
            const ok = await validarAdmin();
            if (ok) {
                await modoAdminActivo();
            }
        }
    }

    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        setEstado("Validando acceso...");

        const { error } = await supabase.auth.signInWithPassword({
            email: emailInput.value.trim(),
            password: passwordInput.value
        });

        if (error) {
            const detalles = [
                error.message,
                error.status ? `HTTP ${error.status}` : null,
                error.code ? `code: ${error.code}` : null
            ].filter(Boolean).join(" | ");

            setEstado(`No se pudo iniciar sesión: ${detalles}`, "error");
            console.warn("Supabase auth error", error);
            return;
        }

        const ok = await validarAdmin();
        if (ok) {
            await modoAdminActivo();
        }
    });

    logoutBtn.addEventListener("click", async () => {
        await supabase.auth.signOut();
        adminPanel.classList.add("oculto");
        loginCard.classList.remove("oculto");
        setEstado("Sesión cerrada.");
    });

    clienteForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        await crearCliente();
    });

    clientesBody.addEventListener("click", async (e) => {
        const btn = e.target.closest("button[data-action='toggle']");
        if (!btn) return;
        await toggleCliente(btn.dataset.id);
    });

    clienteSelect.addEventListener("change", async () => {
        await cargarVehiculoYDocs(clienteSelect.value);
    });

    vehiculoForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        await guardarVehiculo();
    });

    documentoForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        await subirDocumento();
    });

    documentosAdmin.addEventListener("click", async (e) => {
        const btn = e.target.closest("button[data-delete-doc]");
        if (!btn) return;

        const ok = confirm("¿Eliminar este documento?");
        if (!ok) return;

        await eliminarDocumento(btn.dataset.deleteDoc, btn.dataset.path);
    });

    bootstrap();
});
