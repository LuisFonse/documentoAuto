document.addEventListener("DOMContentLoaded", async () => {
    const config = window.SUPABASE_CONFIG || {};
    const bucket = config.bucket || "documentos-vehiculo";

    const TIPOS_DOC = [
        { tipo: "permiso_circulacion", nombre: "Permiso de Circulación", icono: "bi-car-front-fill", conVencimiento: true },
        { tipo: "soap", nombre: "Seguro Obligatorio (SOAP)", icono: "bi-shield-check", conVencimiento: true },
        { tipo: "padron", nombre: "Padrón", icono: "bi-file-earmark-text", conVencimiento: false }
    ];

    const MAX_MB = 10;

    const $ = (id) => document.getElementById(id);
    const estadoApp = $("estadoApp");

    // URL a la que vuelven los correos de confirmación y recuperación
    const urlRetorno = `${window.location.origin}${window.location.pathname}`;

    // Si venimos desde el correo de "recuperar clave", lo detectamos antes de crear el cliente
    let modoRecuperacion = /type=recovery/.test(window.location.hash + window.location.search);
    const vieneDeConfirmacion = /type=signup/.test(window.location.hash + window.location.search);

    let cliente = null;
    let vehiculo = null;
    let documentos = [];
    let ocupado = false;

    function setEstado(msg, tipo = "ok") {
        if (!msg) {
            estadoApp.classList.add("oculto");
            return;
        }
        estadoApp.textContent = msg;
        estadoApp.className = `admin-estado ${tipo}`;
        estadoApp.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    function mostrarVista(id) {
        document.querySelectorAll(".vista").forEach((v) => v.classList.add("oculto"));
        $(id).classList.remove("oculto");
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");
    }

    function traducirError(error) {
        const msg = (error && error.message) || String(error);
        const m = msg.toLowerCase();
        if (m.includes("invalid login credentials")) return "Email o clave incorrectos.";
        if (m.includes("email not confirmed")) return "Aún no confirmas tu email. Revisa tu correo (también spam).";
        if (m.includes("rate limit")) return "Se enviaron demasiados correos. Espera un rato e intenta de nuevo.";
        if (m.includes("password should be at least")) return "La clave debe tener al menos 8 caracteres.";
        if (m.includes("same password") || m.includes("different from the old")) return "La nueva clave debe ser distinta a la anterior.";
        if (m.includes("row-level security")) return "No tienes permiso para esta acción.";
        return msg;
    }

    function extension(file) {
        const partes = file.name.split(".");
        return partes.length > 1 ? partes.pop().toLowerCase().replace(/[^a-z0-9]/g, "") : "pdf";
    }

    if (!config.url || !config.anonKey || !window.supabase || !window.supabase.createClient) {
        setEstado("La página no está configurada (falta supabase-config.js).", "error");
        return;
    }

    const supabase = window.supabase.createClient(config.url, config.anonKey);

    // ============================================================
    // AUTENTICACIÓN
    // ============================================================

    supabase.auth.onAuthStateChange((evento) => {
        if (evento === "PASSWORD_RECOVERY") {
            modoRecuperacion = true;
            mostrarVista("vistaNuevaClave");
            setEstado("Escribe tu nueva clave.");
        }
    });

    document.querySelectorAll("[data-ir]").forEach((btn) => {
        btn.addEventListener("click", () => {
            setEstado("");
            mostrarVista(btn.dataset.ir);
        });
    });

    $("loginForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        setEstado("Ingresando...");

        const { error } = await supabase.auth.signInWithPassword({
            email: $("loginEmail").value.trim().toLowerCase(),
            password: $("loginPassword").value
        });

        if (error) {
            setEstado(traducirError(error), "error");
            return;
        }

        await entrarAlPortal();
    });

    $("registroForm").addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = $("registroEmail").value.trim().toLowerCase();
        const clave = $("registroPassword").value;

        if (clave !== $("registroPassword2").value) {
            setEstado("Las claves no coinciden.", "error");
            return;
        }

        setEstado("Verificando email...");

        const { data: autorizado, error: rpcError } = await supabase.rpc("email_autorizado", { p_email: email });

        if (rpcError) {
            setEstado(`No se pudo verificar el email: ${traducirError(rpcError)}`, "error");
            return;
        }

        if (!autorizado) {
            setEstado("Este email no está registrado. Pide al administrador que te registre primero.", "error");
            return;
        }

        const { data, error } = await supabase.auth.signUp({
            email,
            password: clave,
            options: { emailRedirectTo: urlRetorno }
        });

        if (error) {
            setEstado(traducirError(error), "error");
            return;
        }

        // Supabase devuelve identities vacío cuando el email ya tenía cuenta
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
            setEstado("Ese email ya tiene clave. Ingresa, o usa \"¿Olvidaste tu clave?\" si no la recuerdas.", "error");
            mostrarVista("vistaLogin");
            $("loginEmail").value = email;
            return;
        }

        if (data.session) {
            await entrarAlPortal();
            return;
        }

        $("registroForm").reset();
        mostrarVista("vistaLogin");
        $("loginEmail").value = email;
        setEstado(`Listo. Te enviamos un correo a ${email} para confirmar tu cuenta. Ábrelo y luego ingresa con tu clave.`);
    });

    $("recuperarForm").addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = $("recuperarEmail").value.trim().toLowerCase();
        setEstado("Enviando correo...");

        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: urlRetorno });

        if (error) {
            setEstado(traducirError(error), "error");
            return;
        }

        // Mensaje neutro: no revelamos si el email existe o no
        setEstado(`Si ${email} tiene cuenta, te llegará un correo con un enlace para crear una clave nueva. Revisa también spam.`);
        $("recuperarForm").reset();
        mostrarVista("vistaLogin");
    });

    $("nuevaClaveForm").addEventListener("submit", async (e) => {
        e.preventDefault();

        const clave = $("nuevaPassword").value;
        if (clave !== $("nuevaPassword2").value) {
            setEstado("Las claves no coinciden.", "error");
            return;
        }

        setEstado("Guardando clave...");
        const { error } = await supabase.auth.updateUser({ password: clave });

        if (error) {
            setEstado(traducirError(error), "error");
            return;
        }

        modoRecuperacion = false;
        $("nuevaClaveForm").reset();
        history.replaceState(null, "", urlRetorno);
        setEstado("Clave actualizada correctamente.");
        await entrarAlPortal(true);
    });

    $("logoutBtn").addEventListener("click", async () => {
        await supabase.auth.signOut();
        cliente = null;
        vehiculo = null;
        documentos = [];
        mostrarVista("vistaLogin");
        setEstado("Sesión cerrada.");
    });

    // ============================================================
    // PORTAL
    // ============================================================

    async function entrarAlPortal(conservarMensaje = false) {
        const { data, error } = await supabase
            .from("clientes")
            .select("id, nombre, email, nfc_codigo, habilitado")
            .maybeSingle();

        if (error || !data) {
            await supabase.auth.signOut();
            mostrarVista("vistaLogin");
            setEstado(error
                ? `No se pudo cargar tu cuenta: ${traducirError(error)}`
                : "Tu email no está habilitado. Contacta al administrador.", "error");
            return;
        }

        cliente = data;
        $("nombreUsuario").textContent = `Hola, ${cliente.nombre}`;
        $("linkFicha").href = `index.html?card=${encodeURIComponent(cliente.nfc_codigo)}`;

        mostrarVista("vistaPortal");
        if (!conservarMensaje) setEstado("");

        await cargarVehiculo();
        await cargarDocumentos();
    }

    async function cargarVehiculo() {
        const { data, error } = await supabase
            .from("vehiculos")
            .select("id, cliente_id, patente, modelo, foto_path, foto_url")
            .eq("cliente_id", cliente.id)
            .maybeSingle();

        if (error) {
            setEstado(`No se pudo cargar tu vehículo: ${traducirError(error)}`, "error");
            return;
        }

        vehiculo = data;
        $("vehiculoPatente").value = vehiculo ? vehiculo.patente || "" : "";
        $("vehiculoModelo").value = vehiculo ? vehiculo.modelo || "" : "";

        const foto = $("fotoVehiculo");
        if (vehiculo && vehiculo.foto_url) {
            foto.src = vehiculo.foto_url;
            foto.classList.remove("oculto");
        } else {
            foto.classList.add("oculto");
        }
    }

    async function subirArchivo(prefijo, file) {
        const path = `${cliente.id}/${prefijo}-${Date.now()}.${extension(file)}`;

        const { error } = await supabase.storage
            .from(bucket)
            .upload(path, file, { upsert: false, contentType: file.type || undefined });

        if (error) throw error;

        const url = supabase.storage.from(bucket).getPublicUrl(path).data?.publicUrl || "";
        return { path, url };
    }

    async function borrarArchivo(path) {
        if (!path) return;
        await supabase.storage.from(bucket).remove([path]);
    }

    $("vehiculoForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        if (ocupado) return;
        ocupado = true;

        try {
            setEstado("Guardando vehículo...");

            const payload = {
                cliente_id: cliente.id,
                patente: $("vehiculoPatente").value.trim().toUpperCase(),
                modelo: $("vehiculoModelo").value.trim()
            };

            const fotoFile = $("vehiculoFoto").files[0];
            let fotoNueva = null;
            const fotoAnterior = vehiculo ? vehiculo.foto_path : null;

            if (fotoFile) {
                if (!fotoFile.type.startsWith("image/")) {
                    setEstado("La foto debe ser una imagen.", "error");
                    return;
                }
                if (fotoFile.size > MAX_MB * 1024 * 1024) {
                    setEstado(`La foto no puede pesar más de ${MAX_MB} MB.`, "error");
                    return;
                }
                fotoNueva = await subirArchivo("foto", fotoFile);
                payload.foto_path = fotoNueva.path;
                payload.foto_url = fotoNueva.url;
            }

            const { error } = await supabase
                .from("vehiculos")
                .upsert(payload, { onConflict: "cliente_id" });

            if (error) {
                if (fotoNueva) await borrarArchivo(fotoNueva.path);
                setEstado(`No se pudo guardar el vehículo: ${traducirError(error)}`, "error");
                return;
            }

            if (fotoNueva && fotoAnterior) await borrarArchivo(fotoAnterior);

            $("vehiculoFoto").value = "";
            await cargarVehiculo();
            await cargarDocumentos();
            setEstado("Vehículo guardado.");
        } catch (err) {
            setEstado(`No se pudo guardar el vehículo: ${traducirError(err)}`, "error");
        } finally {
            ocupado = false;
        }
    });

    async function cargarDocumentos() {
        documentos = [];

        if (vehiculo) {
            const { data, error } = await supabase
                .from("documentos")
                .select("id, tipo, nombre, archivo_url, archivo_path, vence")
                .eq("vehiculo_id", vehiculo.id);

            if (error) {
                setEstado(`No se pudieron cargar tus documentos: ${traducirError(error)}`, "error");
                return;
            }

            documentos = data || [];
        }

        pintarDocumentos();
    }

    function estadoVencimiento(vence) {
        const fechaVence = new Date(`${vence}T23:59:59`);
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const dias = Math.ceil((fechaVence - hoy) / 86400000);
        const fecha = fechaVence.toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });

        if (dias > 30) {
            return { clase: "ok", icono: "bi-check-circle-fill", texto: `<strong>Vigente</strong><br><small>Vence el ${fecha} (${dias} días)</small>` };
        }
        if (dias >= 0) {
            return { clase: "aviso", icono: "bi-clock-fill", texto: `<strong>Próximo a vencer</strong><br><small>Vence el ${fecha} (${dias} días)</small>` };
        }
        return { clase: "alerta", icono: "bi-exclamation-triangle-fill", texto: `<strong>Vencido</strong><br><small>Venció el ${fecha}. Quítalo y sube el nuevo.</small>` };
    }

    function pintarDocumentos() {
        const contenedor = $("documentosUsuario");
        contenedor.innerHTML = "";

        $("sinVehiculoAviso").classList.toggle("oculto", Boolean(vehiculo));
        if (!vehiculo) return;

        TIPOS_DOC.forEach((def) => {
            const doc = documentos.find((d) => d.tipo === def.tipo);
            const tarjeta = document.createElement("div");
            tarjeta.className = "tarjeta admin-card doc-usuario";

            let estadoHtml;
            if (!doc) {
                estadoHtml = `
                    <div class="vigencia pendiente">
                        <i class="bi bi-cloud-arrow-up-fill"></i>
                        <div><strong>Sin documento</strong><br><small>Súbelo aquí abajo.</small></div>
                    </div>`;
            } else if (def.conVencimiento && doc.vence) {
                const est = estadoVencimiento(doc.vence);
                estadoHtml = `
                    <div class="vigencia ${est.clase}">
                        <i class="bi ${est.icono}"></i>
                        <div>${est.texto}</div>
                    </div>`;
            } else {
                estadoHtml = `
                    <div class="vigencia ok">
                        <i class="bi bi-check-circle-fill"></i>
                        <div><strong>Cargado</strong></div>
                    </div>`;
            }

            const acciones = doc
                ? `<div class="doc-acciones">
                        <a href="${escapeHtml(doc.archivo_url || "#")}" target="_blank" rel="noopener noreferrer">
                            <i class="bi bi-eye-fill"></i> Ver
                        </a>
                        <button type="button" class="admin-btn danger" data-quitar="${def.tipo}">
                            <i class="bi bi-trash3"></i> Quitar
                        </button>
                   </div>`
                : "";

            tarjeta.innerHTML = `
                <h2><i class="bi ${def.icono}"></i> ${def.nombre}</h2>
                ${estadoHtml}
                ${acciones}
                <form class="admin-grid-form two-col form-doc" data-tipo="${def.tipo}">
                    ${def.conVencimiento ? `
                    <label class="campo-archivo">
                        <span>Fecha de vencimiento</span>
                        <input type="date" name="vence" required>
                    </label>` : ""}
                    <label class="campo-archivo">
                        <span>Archivo (PDF o foto, máx. ${MAX_MB} MB)</span>
                        <input type="file" name="archivo" accept="application/pdf,image/*" required>
                    </label>
                    <button type="submit" class="admin-btn principal">
                        <i class="bi bi-upload"></i> ${doc ? "Reemplazar documento" : "Subir documento"}
                    </button>
                </form>
            `;

            contenedor.appendChild(tarjeta);
        });
    }

    async function subirDocumento(tipo, form) {
        const def = TIPOS_DOC.find((t) => t.tipo === tipo);
        const file = form.archivo.files[0];
        const vence = form.vence ? form.vence.value : null;

        if (!file) {
            setEstado("Selecciona un archivo.", "error");
            return;
        }
        if (!(file.type === "application/pdf" || file.type.startsWith("image/"))) {
            setEstado("El archivo debe ser PDF o una imagen.", "error");
            return;
        }
        if (file.size > MAX_MB * 1024 * 1024) {
            setEstado(`El archivo no puede pesar más de ${MAX_MB} MB.`, "error");
            return;
        }
        if (def.conVencimiento && !vence) {
            setEstado("Indica la fecha de vencimiento.", "error");
            return;
        }

        setEstado(`Subiendo ${def.nombre}...`);

        const anterior = documentos.find((d) => d.tipo === tipo);
        let nuevo;

        try {
            nuevo = await subirArchivo(tipo, file);
        } catch (err) {
            setEstado(`No se pudo subir el archivo: ${traducirError(err)}`, "error");
            return;
        }

        const { error } = await supabase
            .from("documentos")
            .upsert({
                vehiculo_id: vehiculo.id,
                tipo,
                nombre: def.nombre,
                vence: def.conVencimiento ? vence : null,
                archivo_path: nuevo.path,
                archivo_url: nuevo.url
            }, { onConflict: "vehiculo_id,tipo" });

        if (error) {
            await borrarArchivo(nuevo.path);
            setEstado(`No se pudo guardar el documento: ${traducirError(error)}`, "error");
            return;
        }

        if (anterior && anterior.archivo_path && anterior.archivo_path !== nuevo.path) {
            await borrarArchivo(anterior.archivo_path);
        }

        await cargarDocumentos();
        setEstado(`${def.nombre} ${anterior ? "reemplazado" : "subido"} correctamente.`);
    }

    async function quitarDocumento(tipo) {
        const def = TIPOS_DOC.find((t) => t.tipo === tipo);
        const doc = documentos.find((d) => d.tipo === tipo);
        if (!doc) return;

        if (!confirm(`¿Quitar ${def.nombre}? Podrás subir uno nuevo después.`)) return;

        setEstado(`Quitando ${def.nombre}...`);

        const { error } = await supabase.from("documentos").delete().eq("id", doc.id);

        if (error) {
            setEstado(`No se pudo quitar: ${traducirError(error)}`, "error");
            return;
        }

        await borrarArchivo(doc.archivo_path);
        await cargarDocumentos();
        setEstado(`${def.nombre} quitado. Ya puedes subir el nuevo.`);
    }

    $("documentosUsuario").addEventListener("submit", async (e) => {
        const form = e.target.closest("form.form-doc");
        if (!form) return;
        e.preventDefault();
        if (ocupado) return;

        ocupado = true;
        const btn = form.querySelector("button[type=submit]");
        btn.disabled = true;
        try {
            await subirDocumento(form.dataset.tipo, form);
        } finally {
            btn.disabled = false;
            ocupado = false;
        }
    });

    $("documentosUsuario").addEventListener("click", async (e) => {
        const btn = e.target.closest("button[data-quitar]");
        if (!btn || ocupado) return;

        ocupado = true;
        try {
            await quitarDocumento(btn.dataset.quitar);
        } finally {
            ocupado = false;
        }
    });

    // ============================================================
    // INICIO
    // ============================================================

    const { data: sesion } = await supabase.auth.getSession();

    if (modoRecuperacion && sesion.session) {
        mostrarVista("vistaNuevaClave");
        setEstado("Escribe tu nueva clave.");
    } else if (sesion.session) {
        if (vieneDeConfirmacion) {
            history.replaceState(null, "", urlRetorno);
            setEstado("¡Email confirmado! Ya puedes cargar tu vehículo y documentos.");
        }
        await entrarAlPortal(vieneDeConfirmacion);
    } else {
        mostrarVista("vistaLogin");
        if (/error_description=/.test(window.location.hash)) {
            const params = new URLSearchParams(window.location.hash.slice(1));
            setEstado(`El enlace del correo no es válido o ya expiró (${params.get("error_description")}). Pide uno nuevo.`, "error");
            history.replaceState(null, "", urlRetorno);
        }
    }
});
