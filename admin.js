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
    const clienteSubmit = document.getElementById("clienteSubmit");
    const clienteCancelar = document.getElementById("clienteCancelar");
    const regenerarNfc = document.getElementById("regenerarNfc");

    const TOTAL_DOCS = 3;

    let clientes = [];
    let editandoId = null;

    function setEstado(msg, tipo = "ok") {
        estadoApp.textContent = msg;
        estadoApp.className = `admin-estado ${tipo}`;
    }

    if (!config.url || !config.anonKey || !window.supabase || !window.supabase.createClient) {
        setEstado("Configura supabase-config.js con URL y ANON KEY para activar el panel.", "error");
        return;
    }

    const supabase = window.supabase.createClient(config.url, config.anonKey);

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");
    }

    // Código NFC aleatorio (sin caracteres confusos como 0/o, 1/l/i)
    function generarCodigoNfc() {
        const alfabeto = "abcdefghjkmnpqrstuvwxyz23456789";
        const bytes = new Uint8Array(8);
        crypto.getRandomValues(bytes);
        let codigo = "";
        bytes.forEach((b) => { codigo += alfabeto[b % alfabeto.length]; });
        return `nfc-${codigo}`;
    }

    function linkFicha(codigo) {
        const base = window.location.href.replace(/admin\.html.*$/, "");
        return `${base}index.html?card=${encodeURIComponent(codigo)}`;
    }

    async function copiarLink(codigo) {
        const link = linkFicha(codigo);
        try {
            await navigator.clipboard.writeText(link);
            setEstado(`Link copiado: ${link}`);
        } catch {
            prompt("Copia este link:", link);
        }
    }

    function primero(valor) {
        if (Array.isArray(valor)) return valor[0] || null;
        return valor || null;
    }

    async function validarAdmin() {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) return false;

        const { data: esAdmin, error: rpcError } = await supabase.rpc("es_admin");

        if (rpcError) {
            setEstado(`No se pudo validar permisos (¿ejecutaste supabase-migracion-usuarios.sql?): ${rpcError.message}`, "error");
            await supabase.auth.signOut();
            return false;
        }

        if (!esAdmin) {
            await supabase.auth.signOut();
            setEstado("Este usuario no tiene permisos de administrador. Si eres usuario, entra por mi-auto.html.", "error");
            return false;
        }

        return true;
    }

    function pintarClientes() {
        clientesBody.innerHTML = "";

        if (clientes.length === 0) {
            clientesBody.innerHTML = "<tr><td colspan=\"6\">Sin usuarios aún.</td></tr>";
            return;
        }

        clientes.forEach((cliente) => {
            const vehiculo = primero(cliente.vehiculos);
            const docs = vehiculo && Array.isArray(vehiculo.documentos) ? vehiculo.documentos.length : 0;

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>
                    <strong>${escapeHtml(cliente.nombre)}</strong><br>
                    <small>${escapeHtml(cliente.email || "sin email")}</small>
                    ${cliente.telefono ? `<br><small>${escapeHtml(cliente.telefono)}</small>` : ""}
                </td>
                <td>${escapeHtml(cliente.nfc_codigo)}</td>
                <td>${vehiculo
                    ? `${escapeHtml(vehiculo.patente)}<br><small>${escapeHtml(vehiculo.modelo)}</small>`
                    : "<small>Pendiente</small>"}</td>
                <td>${docs}/${TOTAL_DOCS}</td>
                <td>${cliente.habilitado ? "Habilitado" : "Bloqueado"}</td>
                <td class="acciones-celda">
                    <button class="admin-btn mini secundario" data-action="copiar" data-codigo="${escapeHtml(cliente.nfc_codigo)}" title="Copiar link de la ficha"><i class="bi bi-link-45deg"></i> Link</button>
                    <a class="admin-btn mini secundario" target="_blank" rel="noopener" title="Diseño de la tarjeta para imprimir"
                       href="tarjeta.html?codigo=${encodeURIComponent(cliente.nfc_codigo)}&nombre=${encodeURIComponent(cliente.nombre || "")}&patente=${encodeURIComponent(vehiculo ? vehiculo.patente || "" : "")}">
                        <i class="bi bi-credit-card-2-front"></i> Tarjeta
                    </a>
                    <button class="admin-btn mini secundario" data-action="editar" data-id="${cliente.id}">Editar</button>
                    <button class="admin-btn mini ${cliente.habilitado ? "danger" : "secundario"}" data-action="toggle" data-id="${cliente.id}">
                        ${cliente.habilitado ? "Bloquear" : "Habilitar"}
                    </button>
                </td>
            `;
            clientesBody.appendChild(tr);
        });
    }

    async function cargarClientes() {
        const { data, error } = await supabase
            .from("clientes")
            .select("id, nombre, email, telefono, nfc_codigo, habilitado, created_at, vehiculos(patente, modelo, documentos(id))")
            .order("created_at", { ascending: false });

        if (error) {
            setEstado(`No se pudo cargar usuarios: ${error.message}`, "error");
            return;
        }

        clientes = data || [];
        pintarClientes();
    }

    function salirDeEdicion() {
        editandoId = null;
        clienteForm.reset();
        clienteHabilitado.checked = true;
        clienteNfc.value = generarCodigoNfc();
        regenerarNfc.classList.remove("oculto");
        clienteSubmit.textContent = "Crear usuario";
        clienteCancelar.classList.add("oculto");
    }

    function entrarEnEdicion(id) {
        const cliente = clientes.find((c) => c.id === id);
        if (!cliente) return;

        editandoId = id;
        clienteNombre.value = cliente.nombre || "";
        clienteEmail.value = cliente.email || "";
        clienteTelefono.value = cliente.telefono || "";
        clienteNfc.value = cliente.nfc_codigo || "";
        clienteHabilitado.checked = Boolean(cliente.habilitado);
        regenerarNfc.classList.add("oculto");
        clienteSubmit.textContent = "Guardar cambios";
        clienteCancelar.classList.remove("oculto");
        clienteNombre.focus();
        setEstado(`Editando a ${cliente.nombre}.`);
    }

    function mensajeError(error) {
        if (error.code === "23505") {
            return "Ya existe un usuario con ese email o código NFC.";
        }
        return error.message;
    }

    async function guardarCliente() {
        const payload = {
            nombre: clienteNombre.value.trim(),
            email: clienteEmail.value.trim().toLowerCase(),
            telefono: clienteTelefono.value.trim() || null,
            nfc_codigo: clienteNfc.value.trim(),
            habilitado: clienteHabilitado.checked
        };

        const consulta = editandoId
            ? supabase.from("clientes").update(payload).eq("id", editandoId)
            : supabase.from("clientes").insert(payload);

        let { error } = await consulta;

        // Si (muy raro) el código aleatorio ya existía, se genera otro y se reintenta una vez
        if (error && error.code === "23505" && !editandoId && String(error.message).includes("nfc")) {
            payload.nfc_codigo = generarCodigoNfc();
            ({ error } = await supabase.from("clientes").insert(payload));
        }

        if (error) {
            setEstado(`No se pudo guardar: ${mensajeError(error)}`, "error");
            return;
        }

        setEstado(editandoId
            ? "Usuario actualizado."
            : `Usuario creado. Ahora ${payload.email} puede entrar a mi-auto.html y crear su clave.`);
        salirDeEdicion();
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

        setEstado(cliente.habilitado ? "Usuario bloqueado." : "Usuario habilitado.");
        await cargarClientes();
    }

    async function modoAdminActivo() {
        loginCard.classList.add("oculto");
        adminPanel.classList.remove("oculto");
        await cargarClientes();
        setEstado("Sesión iniciada.");
    }

    async function bootstrap() {
        const { data } = await supabase.auth.getSession();
        if (data.session && await validarAdmin()) {
            await modoAdminActivo();
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
            setEstado(`No se pudo iniciar sesión: ${error.message}`, "error");
            return;
        }

        if (await validarAdmin()) {
            await modoAdminActivo();
        }
    });

    logoutBtn.addEventListener("click", async () => {
        await supabase.auth.signOut();
        adminPanel.classList.add("oculto");
        loginCard.classList.remove("oculto");
        salirDeEdicion();
        setEstado("Sesión cerrada.");
    });

    clienteForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        await guardarCliente();
    });

    clienteCancelar.addEventListener("click", () => {
        salirDeEdicion();
        setEstado("Edición cancelada.");
    });

    clientesBody.addEventListener("click", async (e) => {
        const btn = e.target.closest("button[data-action]");
        if (!btn) return;

        if (btn.dataset.action === "toggle") {
            await toggleCliente(btn.dataset.id);
        } else if (btn.dataset.action === "copiar") {
            await copiarLink(btn.dataset.codigo);
        } else if (btn.dataset.action === "editar") {
            entrarEnEdicion(btn.dataset.id);
        }
    });

    regenerarNfc.addEventListener("click", () => {
        clienteNfc.value = generarCodigoNfc();
    });

    clienteNfc.value = generarCodigoNfc();
    bootstrap();
});
