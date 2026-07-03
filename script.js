document.addEventListener("DOMContentLoaded", async () => {
    const iconosPorTipo = {
        padron: "bi-file-earmark-text",
        permiso_circulacion: "bi-car-front-fill",
        soap: "bi-shield-check",
        revision_tecnica: "bi-tools",
        default: "bi-file-earmark"
    };

    function getConfig() {
        return window.SUPABASE_CONFIG || null;
    }

    function isSupabaseDisponible(config) {
        return Boolean(
            config &&
            config.url &&
            config.anonKey &&
            window.supabase &&
            typeof window.supabase.createClient === "function"
        );
    }

    function getCardFromUrl() {
        const params = new URLSearchParams(window.location.search);
        return params.get("card") || params.get("nfc");
    }

    function setHeroDesdeVehiculo(vehiculo) {
        if (!vehiculo) return;

        const modelo = document.querySelector(".hero-modelo");
        const patente = document.querySelector(".hero-patente");

        if (modelo && vehiculo.modelo) {
            modelo.textContent = String(vehiculo.modelo).toUpperCase();
        }

        if (patente && vehiculo.patente) {
            patente.textContent = String(vehiculo.patente).toUpperCase();
        }
    }

    function setModoRestringidoUI() {
        const heroModelo = document.querySelector(".hero-modelo");
        const heroPatente = document.querySelector(".hero-patente");
        const heroSubtitulo = document.querySelector(".hero-subtitulo");

        if (heroModelo) heroModelo.textContent = "ACCESO RESTRINGIDO";
        if (heroPatente) heroPatente.textContent = "";
        if (heroSubtitulo) heroSubtitulo.textContent = "Escanea una tarjeta NFC válida para ver documentos.";

        const foto = document.querySelector(".foto");
        const ficha = document.querySelector(".info-vehiculo");

        if (foto) foto.style.display = "none";
        if (ficha) ficha.style.display = "none";
    }

    function setModoClienteUI() {
        const foto = document.querySelector(".foto");
        const ficha = document.querySelector(".info-vehiculo");

        if (foto) foto.style.display = "block";
        if (ficha) ficha.style.display = "block";
    }

    function setUltimaActualizacion() {
        const fechaActual = new Date().toLocaleDateString("es-CL", {
            day: "2-digit",
            month: "long",
            year: "numeric"
        });

        const fechaEl = document.getElementById("ultimaActualizacion");
        if (fechaEl) {
            fechaEl.textContent = fechaActual;
        }
    }

    function setNumber(id, value) {
        const el = document.getElementById(id);
        if (!el) return;

        let current = 0;
        const safeValue = Number.isFinite(value) ? value : 0;
        const step = safeValue > 0 ? Math.ceil(safeValue / 10) : 1;

        const interval = setInterval(() => {
            current += step;
            if (current >= safeValue) {
                current = safeValue;
                clearInterval(interval);
            }
            el.textContent = current;
        }, 30);
    }

    function renderAccesoRestringido(mensaje) {
        setModoRestringidoUI();

        const contenedor = document.getElementById("lista-documentos");
        if (!contenedor) return;

        contenedor.innerHTML = `
            <div class="tarjeta">
                <h2><i class="bi bi-shield-lock-fill"></i> Acceso restringido</h2>
                <p>${mensaje}</p>
            </div>
        `;

        setNumber("totalDocs", 0);
        setNumber("vigentesDocs", 0);
        setNumber("proximosDocs", 0);
        setNumber("vencidosDocs", 0);
    }

    function renderDocumentos(documentos) {
        const contenedor = document.getElementById("lista-documentos");
        if (!contenedor) return;

        contenedor.innerHTML = "";

        const total = documentos.length;
        let vigentes = 0;
        let proximos = 0;
        let vencidos = 0;

        documentos.forEach((documento, indice) => {
            const tarjeta = document.createElement("div");
            tarjeta.className = "tarjeta";

            tarjeta.style.opacity = "0";
            tarjeta.style.transform = "translateY(18px)";
            tarjeta.style.transition = "all .5s ease";

            let html = `
                <h2>
                    <i class="bi ${documento.icono || iconosPorTipo.default}"></i>
                    ${documento.nombre}
                </h2>
            `;

            if (documento.vence) {
                const fechaVence = new Date(`${documento.vence}T23:59:59`);
                const hoy = new Date();
                hoy.setHours(0, 0, 0, 0);

                const dias = Math.ceil((fechaVence - hoy) / 86400000);
                const fechaBonita = fechaVence.toLocaleDateString("es-CL", {
                    day: "numeric",
                    month: "long",
                    year: "numeric"
                });

                let claseEstado = "";
                let iconoEstado = "";
                let estadoTexto = "";

                if (dias > 30) {
                    vigentes++;
                    claseEstado = "ok";
                    iconoEstado = "bi-check-circle-fill";
                    estadoTexto = `
                        <strong>Documento vigente</strong><br>
                        Restan <strong>${dias}</strong> días<br>
                        <small>Vence el ${fechaBonita}</small>
                    `;
                } else if (dias >= 0) {
                    proximos++;
                    claseEstado = "aviso";
                    iconoEstado = "bi-clock-fill";
                    estadoTexto = `
                        <strong>Próximo a vencer</strong><br>
                        Restan <strong>${dias}</strong> días<br>
                        <small>Vence el ${fechaBonita}</small>
                    `;
                } else {
                    vencidos++;
                    claseEstado = "alerta";
                    iconoEstado = "bi-exclamation-triangle-fill";
                    estadoTexto = `
                        <strong>Documento vencido</strong><br>
                        Hace <strong>${Math.abs(dias)}</strong> días<br>
                        <small>Venció el ${fechaBonita}</small>
                    `;
                }

                html += `
                    <div class="vigencia ${claseEstado}">
                        <i class="bi ${iconoEstado}"></i>
                        <div>${estadoTexto}</div>
                    </div>
                `;
            }

            html += `
                <a href="${documento.archivo}" target="_blank" rel="noopener noreferrer">
                    <i class="bi bi-eye-fill"></i>
                    Ver documento
                </a>
            `;

            tarjeta.innerHTML = html;
            contenedor.appendChild(tarjeta);

            requestAnimationFrame(() => {
                setTimeout(() => {
                    tarjeta.style.opacity = "1";
                    tarjeta.style.transform = "translateY(0)";
                }, indice * 90);
            });
        });

        setNumber("totalDocs", total);
        setNumber("vigentesDocs", vigentes);
        setNumber("proximosDocs", proximos);
        setNumber("vencidosDocs", vencidos);
    }

    async function cargarDocumentosDesdeSupabase(card) {
        const config = getConfig();

        if (!isSupabaseDisponible(config)) {
            return null;
        }

        setModoClienteUI();

        const supabaseClient = window.supabase.createClient(config.url, config.anonKey);

        const { data: cliente, error: clienteError } = await supabaseClient
            .from("clientes")
            .select("id, nombre, habilitado")
            .eq("nfc_codigo", card)
            .eq("habilitado", true)
            .maybeSingle();

        if (clienteError || !cliente) {
            return [];
        }

        const { data: vehiculo, error: vehiculoError } = await supabaseClient
            .from("vehiculos")
            .select("id, patente, modelo")
            .eq("cliente_id", cliente.id)
            .maybeSingle();

        if (vehiculoError || !vehiculo) {
            return [];
        }

        setHeroDesdeVehiculo(vehiculo);

        const { data: documentosDb, error: documentosError } = await supabaseClient
            .from("documentos")
            .select("id, nombre, tipo, archivo_url, archivo_path, vence")
            .eq("vehiculo_id", vehiculo.id)
            .order("nombre", { ascending: true });

        if (documentosError || !documentosDb) {
            return [];
        }

        return documentosDb.map((doc) => {
            let archivo = doc.archivo_url || "#";
            if (!archivo && doc.archivo_path) {
                const urlPublica = supabaseClient.storage
                    .from(config.bucket || "documentos-vehiculo")
                    .getPublicUrl(doc.archivo_path)
                    .data?.publicUrl;
                archivo = urlPublica || "#";
            }

            return {
                nombre: doc.nombre,
                tipo: doc.tipo,
                icono: iconosPorTipo[doc.tipo] || iconosPorTipo.default,
                archivo,
                vence: doc.vence
            };
        });
    }

    const card = getCardFromUrl();

    if (!card) {
        renderAccesoRestringido("Esta tarjeta no es valida. Debes ingresar con un codigo NFC en la URL.");
        setUltimaActualizacion();
        return;
    }

    try {
        const documentosSupabase = await cargarDocumentosDesdeSupabase(card);

        if (documentosSupabase === null) {
            renderAccesoRestringido("Configuracion de Supabase incompleta.");
        } else if (documentosSupabase.length === 0) {
            renderAccesoRestringido("No hay datos disponibles para este codigo NFC o el cliente esta bloqueado.");
        } else {
            renderDocumentos(documentosSupabase);
        }
    } catch (error) {
        console.warn("No se pudo cargar desde Supabase.", error);
        renderAccesoRestringido("No se pudo validar la tarjeta en este momento.");
    }

    setUltimaActualizacion();
});